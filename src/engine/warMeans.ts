import { regimeAtStart } from "./abroad";
import { menOf, menTotal, trainingQuality } from "./army";
import { baseLevel, combatPower } from "./arsenal";
import { yearOf } from "./calendar";
import { STEP_YEARS } from "./economy";
import { regimeKindOf } from "./parliament";
import { peopleIn } from "./population";
import { distanceKm, STRAIT_KM } from "./provinces";
import { roll } from "./dice";
import { alliesOf, landHolders, powers, tieOf, warBetween } from "./relations";
import type { GameState, MapIndex, MapRegion, RegimeKind, RegionState, Resistance, ScenarioId, Terrain, War } from "./types";

/**
 * Wars need means. Numbers of soldiers and guns (engine/arsenal.ts) say what
 * an army is; these say what it can do with them:
 *
 * - readiness: a peacetime army cannot strike at full weight in its first
 *   week. The side that chose the moment starts mobilised, the side it
 *   attacked starts with what stood ready, and both reach full weight over
 *   the era's mobilisation; career soldiers are ready sooner than reservists.
 * - reach: strength falls with distance from home. Over land, past a
 *   thousand kilometres of road and rail; across a sea, an army also needs
 *   ships to carry and keep it and a sea it can cross. A small far-away
 *   country cannot conquer a large one.
 * - will to fight: support for the war at home – it matters most where votes
 *   count, and an invaded people rallies to the war whatever it thinks of
 *   the government – the enemy on the country's own soil, most of the country
 *   lost, and the war-weariness that losses against the population and the
 *   years of war bring. An army fights at full weight only with the will.
 * - resistance: occupied land whose people are not the occupier's breeds
 *   partisans. They tie down troops, kill soldiers and cut supply near the
 *   front. Hostility depends on whose people they are, who occupies them and
 *   how near the fighting is; acceptance builds only after a peace, over
 *   years.
 * - settling: taking a capital is not winning. A war ends by terms; a side
 *   whose will has broken seeks them.
 *
 * The fronts (engine/fronts.ts) weigh each side's strength by these, the
 * war-plan decision (engine/intentions.ts) consults the planner's means, and
 * the turn moves resistance, the partisans' toll, weariness's hold on support
 * and the terms a broken side seeks (applyWarMeans). Everything is pure and
 * deterministic: the dice are seeded by the game, the turn and what is cast.
 */

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const round = (v: number) => Math.round(v);
const round2 = (v: number) => Math.round(v * 100) / 100;
const YEAR_MS = 365.25 * 86400000;
const yearsFrom = (from: string, to: string) => Math.max(0, (Date.parse(to) - Date.parse(from)) / YEAR_MS);
const addMonths = (date: string, months: number) => new Date(Date.parse(date) + (months / 12) * YEAR_MS).toISOString().slice(0, 10);

/** Months an army of each era takes to bring its reserves up to full weight. */
export const MOBILISE_MONTHS: Record<ScenarioId, number> = { "1914": 1, "1939": 1.5, "1950": 2.5, "1964": 2.5, "1991": 3, "1999": 3, "2014": 3, "2022": 3.5 };

/** Readiness on the day a war begins: for the side that chose the moment, a country that entered it later, and the side attacked. */
const READY_START = { struck: 0.75, joined: 0.65, attacked: 0.5 } as const;
/** What career soldiers add to readiness on the first day, at an all-career army. */
const READY_PRO = 0.2;

/** How much the support at home moves the will to fight, by the kind of government; the rest is what the state can make its people bear. */
const WILL_WEIGHT: Record<RegimeKind, number> = { democracy: 1, limited: 0.7, party: 0.4, autocracy: 0.45, military: 0.5 };
/** What a state that does not ask its people can make them bear. */
const WILL_FORCED = 60;
/** The enemy on the country's own soil: the will it adds, and the support for the war an invaded people rallies to at the least. */
const HOME_SOIL = 10;
const RALLY = 70;
/** How hard losses weigh on each kind of government. */
const LOSS_SENSE: Record<RegimeKind, number> = { democracy: 1.25, limited: 1, party: 0.7, autocracy: 0.75, military: 0.85 };

/** Kilometres from home before reach falls over land, and the distance over which it then halves again. */
const LAND_FREE = 1000;
const LAND_SPAN = 3000;
/** Across a sea: the most an expedition can bring, and the distance that halves it. */
const SEA_MAX = 0.6;
const SEA_SPAN = 2000;
/** Major warships per thousand soldiers that carry and keep a whole army overseas. */
const LIFT_NORM = 0.15;
/** How many provinces into the enemy's land an army fighting its way forward from its own still counts as linked by land. */
const LINK_HOPS = 3;
/** An army cut off inland, with no road home and no coast. */
const CUT_OFF = 0.3;
/** An expedition across the sea lands part of its weight at first and builds up over a month and a month more for every DEPLOY_KM. */
const DEPLOY_START = 0.15;
const DEPLOY_KM = 4000;

/** A defender's strength in its own land: local knowledge, short supply, its people behind it. */
export const HOME_EDGE = 1.15;

/** Hostility of a people to an occupier at war with their country, 0–100, before how it occupies. */
const HOSTILITY = 70;
/** How the occupation goes, by the occupier's kind of government. */
const OCCUPIER: Record<RegimeKind, number> = { democracy: 0.75, limited: 0.95, party: 1.1, autocracy: 1.15, military: 1.1 };
/** Years of peace over which a people comes to accept its new rulers (to about two thirds). */
const ACCEPTANCE_YEARS = 8;
/** Where resistance starts in a province just taken, against where hostility heads: partisans organise over months. */
const ORGANISING = 0.1;
/** Half-lives of resistance, years: it organises in months and dies down over years. */
const RISE = 0.5;
const FALL = 2;
/** Soldiers a thousand people in full revolt tie down: about the twenty a thousand that keeping order against an insurgency takes. */
const GARRISON = 0.02;
/** The most of an army its occupations can tie down. */
const MAX_TIED = 0.5;
/** Partisans kill this share of the garrison a year, and wound twice as many. */
const PARTISAN_TOLL = 0.04;
/** Cover for partisans, by terrain. */
const COVER: Record<Terrain, number> = { plains: 1, desert: 0.8, hills: 1.2, forest: 1.3, tundra: 0.8, wetlands: 1.3, jungle: 1.5, mountains: 1.5 };
/** Below this share of the means it needs, an attacker fights for a border, not a country. */
export const LIMITED = 0.6;
/** Below this will to fight, a side's principal weighs asking for terms, about this often a year. */
export const BROKEN = 25;
const SEEK_TERMS = 1.5;

type MeansState = Pick<GameState, "countries" | "regions" | "wars" | "date"> &
  Partial<Pick<GameState, "chronicle" | "scenarioId" | "player" | "politics" | "alliances" | "step">>;

/** The wars a country fights, a truce or not. */
const warsOf = (state: Pick<GameState, "wars">, tag: string) => state.wars.filter((w) => w.attackers.includes(tag) || w.defenders.includes(tag));

/** When each country entered each war, by the chronicle's record ("war:country" → the period it entered in); one pass over the chronicle. */
export function entryDates(state: Partial<Pick<GameState, "chronicle">>): Map<string, string> {
  const out = new Map<string, string>();
  for (const e of state.chronicle ?? []) for (const c of e.applied) if (c.kind === "enter") out.set(`${c.war}:${c.country}`, e.from);
  return out;
}

/** The day a country went to war in one war: the war's start, or the period it entered it. */
function enteredOn(war: War, tag: string, entries: Map<string, string>): string {
  const d = entries.get(`${war.id}:${tag}`);
  return d && d > war.since ? d : war.since;
}

/**
 * What the means read off the state, once for a pass over many countries:
 * when each country entered its wars, each country's own people and the
 * share of them under an enemy's hold, who has the enemy on its soil, and
 * each holder's provinces in revolt.
 */
export interface Reading {
  entries: Map<string, string>;
  people: Map<string, { people: number; lost: number }>;
  invaded: Set<string>;
  revolts: Map<string, { provinces: number; need: number; levels: number }>;
}

export function readState(state: Pick<GameState, "regions" | "wars"> & Partial<Pick<GameState, "chronicle">>, map?: Record<string, MapRegion> | null): Reading {
  const foes = new Map<string, Set<string>>();
  for (const w of state.wars) {
    if (w.truce) continue;
    for (const [mine, theirs] of [
      [w.attackers, w.defenders],
      [w.defenders, w.attackers],
    ]) {
      for (const t of mine) {
        const set = foes.get(t) ?? new Set<string>();
        theirs.forEach((x) => set.add(x));
        foes.set(t, set);
      }
    }
  }
  const tally = new Map<string, { people: number; lost: number; provinces: number; taken: number }>();
  const invaded = new Set<string>();
  const revolts = new Map<string, { provinces: number; need: number; levels: number }>();
  for (const [id, r] of Object.entries(state.regions)) {
    const n = peopleIn(r, map?.[id]);
    const t = tally.get(r.owner) ?? { people: 0, lost: 0, provinces: 0, taken: 0 };
    t.people += n;
    t.provinces += 1;
    if (r.controller !== r.owner) {
      t.lost += n;
      t.taken += 1;
    }
    tally.set(r.owner, t);
    const f = foes.get(r.owner);
    if (f && (f.has(r.controller) || (r.contested !== undefined && f.has(r.contested)))) invaded.add(r.owner);
    if (r.resistance && r.resistance.level >= 1) {
      const v = revolts.get(r.controller) ?? { provinces: 0, need: 0, levels: 0 };
      v.provinces += 1;
      v.levels += r.resistance.level;
      v.need += revolt(r, map?.[id]) * GARRISON;
      revolts.set(r.controller, v);
    }
  }
  const people = new Map([...tally].map(([tag, t]) => [tag, { people: t.people, lost: t.people > 0 ? t.lost / t.people : t.provinces ? t.taken / t.provinces : 0 }] as const));
  return { entries: entryDates(state), people, invaded, revolts };
}

/** How a country is governed: the player's by the regime the game master described, the rest by the engine's politics abroad. */
export function regimeOf(state: Pick<GameState, "countries"> & Partial<Pick<GameState, "player" | "politics" | "scenarioId">>, tag: string): RegimeKind {
  if (tag === state.player && state.scenarioId) return regimeKindOf(state as Pick<GameState, "politics" | "scenarioId" | "player">);
  return state.countries[tag]?.domestic?.regime ?? (state.scenarioId ? regimeAtStart(state.scenarioId, tag) : "limited");
}

/** The share of career soldiers in a country's army. */
function proShare(state: MeansState, tag: string): number {
  const men = menOf(state, state.countries[tag]);
  const total = menTotal(men);
  return total > 0 ? men.pro / total : 0.2;
}

/**
 * How ready a country's army is to fight at full weight, 0–1: by how long it
 * has been at war, whether it chose the moment, its career soldiers and the
 * era's mobilisation. A country at peace is as ready as an army attacked
 * today. `ahead` reads it some months on (the middle of a turn).
 */
export function readiness(state: MeansState, tag: string, reading?: Pick<Reading, "entries">, ahead = 0): number {
  const era = state.scenarioId ?? "2022";
  const entries = reading?.entries ?? entryDates(state);
  const pro = READY_PRO * proShare(state, tag);
  const at = ahead ? addMonths(state.date, ahead) : state.date;
  let best = READY_START.attacked + pro;
  for (const w of warsOf(state, tag)) {
    const since = enteredOn(w, tag, entries);
    const start = (since > w.since ? READY_START.joined : w.attackers.includes(tag) ? READY_START.struck : READY_START.attacked) + pro;
    const months = yearsFrom(since, at) * 12;
    best = Math.max(best, start + (1 - start) * Math.min(1, months / MOBILISE_MONTHS[era]));
  }
  return round2(Math.min(1, best));
}

/** Support for the government at home, 0–100: the engine's figure abroad; for the player, the parties in government and the street. */
export function backing(state: Pick<GameState, "countries"> & Partial<Pick<GameState, "player" | "politics">>, tag: string): number {
  if (tag === state.player) {
    const p = state.politics;
    if (!p) return 50;
    const government = p.parties.filter((x) => x.status === "ruling" || x.status === "coalition").reduce((s, x) => s + (x.support ?? 0), 0);
    return clamp(0.5 * (government || 50) + 0.5 * (100 - p.unrest), 0, 100);
  }
  return state.countries[tag]?.domestic?.support ?? 50;
}

/** Whether an enemy holds or fights in the country's own land. */
export function onHomeSoil(state: Pick<GameState, "regions" | "wars">, tag: string, reading = readState(state)): boolean {
  return reading.invaded.has(tag);
}

/** What weighs on a country at war, 0–1 each: its losses against its people, and the years of war. */
export function wearinessParts(state: MeansState, tag: string, map?: Record<string, MapRegion> | null, reading = readState(state, map)): { pain: number; time: number } {
  const wars = warsOf(state, tag);
  if (!wars.length) return { pain: 0, time: 0 };
  const since = wars.map((w) => enteredOn(w, tag, reading.entries)).sort()[0];
  const years = yearsFrom(since, state.date);
  let lost = 0;
  for (const w of wars) {
    const l = w.losses?.[tag];
    if (l) lost += l.killed + 0.25 * l.wounded + 0.5 * (l.captured ?? 0);
  }
  const own = reading.people.get(tag)?.people ?? 0;
  // Without people on record, about twenty times the army.
  const people = own > 0 ? own : 20 * (state.countries[tag]?.economy?.troops ?? 0);
  const perMillion = people > 0 ? (lost / people) * 1e6 : 0;
  const sense = LOSS_SENSE[regimeOf(state, tag)] * (reading.invaded.has(tag) ? 0.8 : 1);
  return {
    pain: clamp((Math.log10(1 + perMillion / 2000) / 2) * sense, 0, 1),
    time: clamp(0.6 * (years / (years + 4)) * sense, 0, 1),
  };
}

/**
 * War-weariness, 0–100: how much the war's losses against the population and
 * its length have worn down a country. Democracies feel losses most; people
 * defending their own land bear more. None at peace.
 */
export function warWeariness(state: MeansState, tag: string, map?: Record<string, MapRegion> | null, reading = readState(state, map)): number {
  const { pain, time } = wearinessParts(state, tag, map, reading);
  return round(100 * (1 - (1 - pain) * (1 - time)));
}

/**
 * The will to fight, 0–100: support at home (where votes count it is most of
 * it; a dictatorship can make its people bear more), the enemy on its own
 * soil, most of the country lost, and war-weariness wearing it down.
 */
export function willToFight(state: MeansState, tag: string, map?: Record<string, MapRegion> | null, reading = readState(state, map)): number {
  const w = WILL_WEIGHT[regimeOf(state, tag)];
  const home = reading.invaded.has(tag);
  // Invaded, people rally to the war whatever they think of the government.
  const support = home ? Math.max(RALLY, backing(state, tag)) : backing(state, tag);
  let will = w * support + (1 - w) * WILL_FORCED;
  if (home) will += HOME_SOIL;
  will -= 30 * Math.max(0, (reading.people.get(tag)?.lost ?? 0) - 0.4);
  will *= 1 - (0.9 * warWeariness(state, tag, map, reading)) / 100;
  return round(clamp(will, 5, 100));
}

/** What the will to fight makes of an army's strength: all of it at full will, under a third when it is gone (an army that will not fight melts away). */
export const commitment = (will: number) => 0.3 + (0.7 * clamp(will, 0, 100)) / 100;

/** A country's ships against what it takes to carry and keep its army overseas, 0.1–1. */
export function navalLift(state: Pick<GameState, "countries" | "date">, tag: string): number {
  const c = state.countries[tag];
  const ships = c?.arsenal?.stock.ships;
  const troops = c?.economy?.troops ?? 0;
  if (!ships?.n || troops <= 0) return 0.1;
  const k = ships.n * 1.4 ** (ships.level - Math.max(1, baseLevel("ships", yearOf(state.date))));
  return round2(clamp(k / troops / LIFT_NORM, 0.1, 1));
}

/** A side's warships, weighed by their level. */
function fleet(state: Pick<GameState, "countries" | "date">, side: string[]): number {
  const year = yearOf(state.date);
  return side.reduce((sum, tag) => {
    const s = state.countries[tag]?.arsenal?.stock.ships;
    return sum + (s?.n ? s.n * 1.4 ** (s.level - Math.max(1, baseLevel("ships", year))) : 0);
  }, 0);
}

/** A province of resistance's strength: people in revolt, by their hostility and the cover the land gives, thousands. */
function revolt(r: RegionState, map: MapRegion | undefined): number {
  if (!r.resistance || r.contested) return 0;
  return (r.resistance.level / 100) * peopleIn(r, map) * (map ? (COVER[map.terrain] ?? 1) : 1);
}

/** What its occupations cost a country: the provinces in revolt, the soldiers they tie down (thousands), the share of its army, and their mean resistance. */
export function resistanceOf(
  state: Pick<GameState, "countries" | "regions" | "wars">,
  tag: string,
  map?: Record<string, MapRegion> | null,
  reading: Pick<Reading, "revolts"> = readState(state, map),
): { provinces: number; need: number; share: number; level: number } {
  const v = reading.revolts.get(tag) ?? { provinces: 0, need: 0, levels: 0 };
  const troops = state.countries[tag]?.economy?.troops ?? 0;
  return { provinces: v.provinces, need: round2(v.need), share: troops > 0 ? round2(Math.min(MAX_TIED, v.need / troops)) : 0, level: v.provinces ? round(v.levels / v.provinces) : 0 };
}

/**
 * The attacker's means as the war-plan decision sees them, with no map: a
 * fleet to reach a distant target across the sea (closeness below 70: people
 * more than about 1,500 km apart, and no land of theirs touching – the course
 * keeps that from the map's neighbours; the distance itself is in the balance
 * of strength), a trained army, and the will at home. Each is 1 when it is
 * enough; only a shortfall lowers the factor its odds are multiplied by.
 * Below LIMITED the attacker fights for a border, not a country.
 */
export function attackMeans(state: GameState, by: string, target: string): { reach: number; ready: number; will: number; factor: number; limited: boolean } {
  const tie = tieOf(state, by, target);
  const reach = tie.near >= 70 || tie.land ? 1 : round2(0.35 + 0.65 * navalLift(state, by));
  const quality = trainingQuality(menOf(state, state.countries[by]));
  const ready = round2(clamp(quality / 0.95, 0.5, 1));
  const will = willToFight(state, by);
  const factor = round2(reach * ready * (will >= 50 ? 1 : 0.5 + will / 100));
  return { reach, ready, will, factor, limited: factor < LIMITED };
}

/** Whether a war's attackers fight for limited aims: their principal's means fall short against the principal defender. */
export function limitedAims(state: GameState, war: Pick<War, "attackers" | "defenders">): boolean {
  const by = war.attackers[0];
  const target = war.defenders[0];
  if (!by || !target || by === state.player) return false;
  return attackMeans(state, by, target).limited;
}

/** A front's view of the means: each country's force, its reach to a province, home soil, partisans in the rear, limited aims. */
export interface FrontMeans {
  /** What of a country's power reaches the fighting: readiness, will and the troops its occupations tie down. */
  force(tag: string): number;
  /** How much of a country's force reaches a province, 0.05–1: distance from home, and across a sea, ships. */
  reach(tag: string, id: string, side: string[], enemy: string[]): number;
  /** HOME_EDGE where a member of the side owns the province, else 1. */
  home(side: string[], id: string): number;
  /** A side's supply at a province, cut by partisans in the occupied land behind it, 0.7–1. */
  partisans(side: string[], id: string): number;
  /** Whether a war's attackers fight only for the land next to their own. */
  limited(war: War): boolean;
  /** A country's will to fight, 0–100. */
  will(tag: string): number;
}

/** Means that change nothing: for a state or map without what they read. */
const NEUTRAL: FrontMeans = { force: () => 1, reach: () => 1, home: () => 1, partisans: () => 1, limited: () => false, will: () => 60 };

/**
 * The means at the fronts for one turn, read in the middle of the period so a
 * month-long turn that begins a war is fought half mobilised. Without the
 * scenario (an older test's bare state) the means are neutral; without the
 * map's centres, reach is full.
 */
export function frontMeans(state: MeansState, index: Pick<MapIndex, "neighbors"> & Partial<Pick<MapIndex, "regions">>): FrontMeans {
  if (!state.scenarioId) return NEUTRAL;
  const full = state as GameState;
  const months = (state.step ? STEP_YEARS[state.step] : 1 / 12) * 12;
  const map = index.regions ?? null;
  const reading = readState(state, map);
  const forces = new Map<string, number>();
  const wills = new Map<string, number>();
  const will = (tag: string) => {
    let w = wills.get(tag);
    if (w === undefined) wills.set(tag, (w = willToFight(state, tag, map, reading)));
    return w;
  };
  const force = (tag: string) => {
    let f = forces.get(tag);
    if (f === undefined) {
      const tied = resistanceOf(state, tag, map, reading).share;
      f = readiness(state, tag, reading, months / 2) * commitment(will(tag)) * (1 - tied);
      forces.set(tag, f);
    }
    return f;
  };

  // Each country's home: the provinces it owns and holds, and where its people live among them.
  const homes = new Map<string, { ids: string[]; at: [number, number][]; centre: [number, number] | null }>();
  const homeOf = (tag: string) => {
    let h = homes.get(tag);
    if (!h) {
      const ids: string[] = [];
      const at: [number, number][] = [];
      let x = 0;
      let y = 0;
      let w = 0;
      for (const [id, r] of Object.entries(state.regions)) {
        const p = map?.[id];
        if (r.owner !== tag || r.controller !== tag || !p?.at) continue;
        ids.push(id);
        at.push(p.at);
        const k = Math.max(1, peopleIn(r, p));
        x += p.at[0] * k;
        y += p.at[1] * k;
        w += k;
      }
      homes.set(tag, (h = { ids, at, centre: w > 0 ? [x / w, y / w] : null }));
    }
    return h;
  };
  // Coastal provinces by cells of four degrees, for the straits an army crosses (provinces.ts STRAIT_KM).
  let grid: Map<string, string[]> | null = null;
  const cellOf = (at: [number, number]) => [Math.floor(at[0] / 4), Math.floor(at[1] / 4)];
  const straits = new Map<string, string[]>();
  const across = (id: string): string[] => {
    let known = straits.get(id);
    if (!known) straits.set(id, (known = crossings(id)));
    return known;
  };
  const crossings = (id: string): string[] => {
    const p = map?.[id];
    if (!map || !p?.at || !p.coastal) return [];
    if (!grid) {
      grid = new Map();
      for (const [q, r] of Object.entries(map)) {
        if (!r.at || !r.coastal || !state.regions[q]) continue;
        const [cx, cy] = cellOf(r.at);
        const key = `${cx},${cy}`;
        const list = grid.get(key);
        if (list) list.push(q);
        else grid.set(key, [q]);
      }
    }
    const [cx, cy] = cellOf(p.at);
    const out: string[] = [];
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const q of grid.get(`${cx + dx},${cy + dy}`) ?? []) if (q !== id && distanceKm(p.at, map[q].at!) <= STRAIT_KM) out.push(q);
    return out;
  };
  // The land a side's troops can march through, over land and across straits – its own, its members' and their allies' – in
  // connected parts, so each member's home is linked to a front or not.
  const parts = new Map<string, Map<string, number>>();
  const partsOf = (side: string[]) => {
    const key = [...side].sort().join("+");
    let label = parts.get(key);
    if (label) return label;
    const friends = new Set<string>(side);
    if (state.alliances) for (const t of side) for (const x of alliesOf(full, t)) friends.add(x);
    label = new Map<string, number>();
    let n = 0;
    for (const [id, r] of Object.entries(state.regions)) {
      if (label.has(id) || !friends.has(r.controller)) continue;
      n += 1;
      label.set(id, n);
      const queue = [id];
      while (queue.length) {
        const x = queue.pop()!;
        for (const y of [...(index.neighbors[x] ?? []), ...across(x)]) {
          if (label.has(y) || !state.regions[y] || !friends.has(state.regions[y].controller)) continue;
          label.set(y, n);
          queue.push(y);
        }
      }
    }
    parts.set(key, label);
    return label;
  };
  /**
   * Whether a member's troops reach a province by land or across a strait from home, through land its side holds:
   * next to it, or fighting their way in from it, up to LINK_HOPS provinces into the enemy's land.
   */
  const linkedTo = (tag: string, id: string, side: string[]) => {
    const label = partsOf(side);
    const mine = new Set(homeOf(tag).ids.map((h) => label.get(h)));
    if ([id, ...(index.neighbors[id] ?? []), ...across(id)].some((x) => mine.has(label.get(x)))) return true;
    const seen = new Set([id]);
    let ring = [id];
    for (let hop = 1; hop < LINK_HOPS && ring.length; hop++) {
      const next: string[] = [];
      for (const x of ring) {
        for (const y of index.neighbors[x] ?? []) {
          if (seen.has(y) || !state.regions[y]) continue;
          seen.add(y);
          next.push(y);
        }
      }
      if (next.some((y) => (index.neighbors[y] ?? []).some((z) => mine.has(label.get(z))))) return true;
      ring = next;
    }
    return false;
  };
  const control = new Map<string, number>();
  /** How freely a side crosses the sea against the enemy's fleet: 1 at an even fight or better. */
  const seaOf = (side: string[], enemy: string[]) => {
    const key = `${[...side].sort().join("+")}|${[...enemy].sort().join("+")}`;
    let c = control.get(key);
    if (c === undefined) {
      const mine = fleet(state, side);
      const theirs = fleet(state, enemy);
      c = mine + theirs > 0 ? clamp((2 * mine) / (mine + theirs), 0.2, 1) : 1;
      control.set(key, c);
    }
    return c;
  };
  // When each country went to war against an enemy, for how far its expedition has built up (read in the middle of the turn).
  const midTurn = addMonths(state.date, months / 2);
  const deployed = (tag: string, enemy: string[], d: number) => {
    const war = state.wars.find((w) => !w.truce && ((w.attackers.includes(tag) && enemy.some((e) => w.defenders.includes(e))) || (w.defenders.includes(tag) && enemy.some((e) => w.attackers.includes(e)))));
    if (!war) return 1;
    const since = yearsFrom(enteredOn(war, tag, reading.entries), midTurn) * 12;
    return DEPLOY_START + (1 - DEPLOY_START) * Math.min(1, since / (1 + d / DEPLOY_KM));
  };
  const reaches = new Map<string, number>();
  const reach = (tag: string, id: string, side: string[], enemy: string[]) => {
    const at = map?.[id]?.at;
    if (!at) return 1;
    const key = `${tag}:${id}:${side.join("+")}`;
    let k = reaches.get(key);
    if (k !== undefined) return k;
    const home = homeOf(tag);
    if (!home.at.length || !home.centre) k = 1;
    else {
      // The distance from home: halfway between its nearest province and where its people live – an army is raised and supplied from the whole country.
      // The nearest province is found on a flat projection around the front (a few multiplications each), then measured on the globe.
      const k0 = Math.cos((at[1] * Math.PI) / 180);
      let best = home.at[0];
      let flat = Infinity;
      for (const h of home.at) {
        let dx = Math.abs(h[0] - at[0]);
        if (dx > 180) dx = 360 - dx;
        const f = (dx * k0) ** 2 + (h[1] - at[1]) ** 2;
        if (f < flat) {
          flat = f;
          best = h;
        }
      }
      const d = 0.5 * distanceKm(at, best) + 0.5 * distanceKm(at, home.centre);
      // Over land; across a sea, by ships; inland with no road home, no more than what lands on the coast – an encircled army fights with what it carries and what comes by air.
      const sea = () => clamp(((navalLift(state, tag) * seaOf(side, enemy) * SEA_MAX) / (1 + d / SEA_SPAN)) * deployed(tag, enemy, d), 0.03, 1);
      k = linkedTo(tag, id, side) ? clamp(1 / (1 + Math.max(0, d - LAND_FREE) / LAND_SPAN), 0.3, 1) : map?.[id]?.coastal ? sea() : Math.min(CUT_OFF, sea());
    }
    reaches.set(key, k);
    return k;
  };
  const home = (side: string[], id: string) => (side.includes(state.regions[id]?.owner ?? "") ? HOME_EDGE : 1);
  const partisans = (side: string[], id: string) => {
    let worst = 0;
    for (const n of [id, ...(index.neighbors[id] ?? [])]) {
      const r = state.regions[n];
      if (r?.resistance && side.includes(r.controller) && !side.includes(r.resistance.of)) worst = Math.max(worst, r.resistance.level);
    }
    return 1 - (0.3 * worst) / 100;
  };
  const limits = new Map<string, boolean>();
  const limited = (war: War) => {
    let l = limits.get(war.id);
    if (l === undefined) limits.set(war.id, (l = limitedAims(full, war)));
    return l;
  };
  return { force, reach, home, partisans, limited, will };
}

/** One side's means in a war, for the game master and the player: weighed by each member's strength. */
export interface SideMeans {
  /** Readiness, %. */
  ready: number;
  /** Strength that reaches the front from home, %. */
  reach: number;
  will: number;
  weary: number;
  /** Troops tied down by partisans in the land it occupies, % of its armies. */
  rear: number;
  /** Provinces of its occupations in revolt. */
  revolts: number;
  /** It fights for the land next to its own only (the attackers' side). */
  limited: boolean;
}

/** One member's means in a war: readiness, reach and the share tied down as fractions, will and weariness 0–100. */
export interface MemberMeans {
  tag: string;
  ready: number;
  reach: number;
  will: number;
  weary: number;
  tied: number;
  revolts: number;
}

/**
 * Each member's and each side's means in a war. `front` is the war's front
 * provinces (engine/fronts.ts warFront), for reach; without the map, reach is
 * full. `means` lets a caller reuse one turn's front means for every war.
 */
export function warMeans(
  state: GameState,
  war: War,
  index: Pick<MapIndex, "neighbors" | "regions"> | null,
  front: string[] = [],
  means: FrontMeans = index ? frontMeans(state, index) : NEUTRAL,
): { attackers: SideMeans; defenders: SideMeans; members: MemberMeans[] } {
  const map = index?.regions ?? null;
  const reading = readState(state, map);
  const members: MemberMeans[] = [];
  const side = (tags: string[], enemy: string[], attackers: boolean): SideMeans => {
    let weight = 0;
    const sum = { ready: 0, reach: 0, will: 0, weary: 0, rear: 0 };
    let revolts = 0;
    for (const tag of tags) {
      const rest = resistanceOf(state, tag, map, reading);
      const m: MemberMeans = {
        tag,
        ready: readiness(state, tag, reading),
        reach: front.length && index ? front.reduce((s, id) => s + means.reach(tag, id, tags, enemy), 0) / front.length : 1,
        will: willToFight(state, tag, map, reading),
        weary: warWeariness(state, tag, map, reading),
        tied: rest.share,
        revolts: rest.provinces,
      };
      members.push(m);
      const w = Math.max(1, combatPower(state, tag));
      weight += w;
      sum.ready += w * m.ready;
      sum.reach += w * m.reach;
      sum.will += w * m.will;
      sum.weary += w * m.weary;
      sum.rear += w * m.tied;
      revolts += m.revolts;
    }
    const avg = (v: number) => (weight > 0 ? v / weight : 0);
    return {
      ready: round(avg(sum.ready) * 100),
      reach: round(avg(sum.reach) * 100),
      will: round(avg(sum.will)),
      weary: round(avg(sum.weary)),
      rear: round(avg(sum.rear) * 100),
      revolts,
      limited: attackers && means.limited(war),
    };
  };
  return { attackers: side(war.attackers, war.defenders, true), defenders: side(war.defenders, war.attackers, false), members };
}

/** A war's means in one line for the game master: "means A/D: ready 82/57%, reach 100/31%, will 58/81, weary 12/9, tied down by partisans 4/0%". */
export function meansLine(m: { attackers: SideMeans; defenders: SideMeans }): string {
  const a = m.attackers;
  const d = m.defenders;
  const rear = a.rear || d.rear ? `, tied down by partisans ${a.rear}/${d.rear}%` : "";
  return `means A/D: ready ${a.ready}/${d.ready}%, reach ${a.reach}/${d.reach}%, will ${a.will}/${d.will}, weary ${a.weary}/${d.weary}${rear}${a.limited ? ", A fights for limited aims" : ""}`;
}

// --- The turn: resistance in occupied land, the partisans' toll, weariness at home ---

/** Where a province's resistance heads, 0–100. `owners` is every country that owns land. */
function hostility(state: GameState, id: string, r: RegionState, rec: Resistance, neighbors: Record<string, string[]> | null, to: string, owners: Set<string>): number {
  const holder = r.controller;
  let t = HOSTILITY * OCCUPIER[regimeOf(state, holder)];
  // A claimant that takes land it calls its own finds some who welcome it.
  if ((state.countries[holder]?.course?.aims ?? []).some((a) => a.kind === "reclaim" && a.target === rec.of)) t *= 0.75;
  // The fighting next door keeps people's anger up – their own side's troops in sight; their country gone, hope ebbs.
  const friends = new Set(state.wars.flatMap((w) => (w.attackers.includes(rec.of) ? w.attackers : w.defenders.includes(rec.of) ? w.defenders : [])));
  if (neighbors && (neighbors[id] ?? []).some((n) => friends.has(state.regions[n]?.controller ?? "") || friends.has(state.regions[n]?.contested ?? ""))) t *= 1.1;
  const nation = state.countries[rec.of];
  if (!owners.has(rec.of) && !nation?.dormant && !nation?.exile) t *= 0.7;
  // After a peace, acceptance builds over years, and nobody fights on for a war that is over.
  if (rec.peace) t *= 0.6 * Math.exp(-yearsFrom(rec.peace, to) / ACCEPTANCE_YEARS);
  return clamp(t, 0, 100);
}

/** Moves a level toward its target over a period, faster up than down. */
function settleLevel(level: number, target: number, years: number): number {
  const half = target > level ? RISE : FALL;
  return level + (target - level) * (1 - 0.5 ** (years / half));
}

/**
 * The turn's resistance: a province an enemy took in a war this turn becomes
 * its people's to resist; one it annexed by conquest too, with the clock of
 * acceptance started; one back in its people's hands is free of it, and one
 * long accepted forgets it. Every level heads to where hostility puts it.
 * Mutates `next.regions`.
 */
export function moveResistance(before: GameState, next: GameState, ctx: { to: string; years: number; neighbors?: Record<string, string[]> | null }): void {
  const neighbors = ctx.neighbors ?? null;
  const owners = new Set(Object.values(next.regions).map((r) => r.owner));
  for (const [id, r] of Object.entries(next.regions)) {
    const was = before.regions[id];
    let rec = r.resistance;
    if (rec && r.controller === rec.of && (r.owner === rec.of || !warBetween(next, r.owner, rec.of))) {
      delete r.resistance;
      continue;
    }
    if (!rec) {
      const changed = was && was.controller !== r.controller;
      const occupied = changed && r.controller !== r.owner && warBetween(next, r.controller, r.owner);
      const conquered = was && was.owner !== r.owner && was.controller !== r.controller && warBetween(before, was.owner, r.owner);
      if (!occupied && !conquered) continue;
      rec = { of: occupied ? r.owner : was!.owner, level: 0 };
      if (conquered && !warBetween(next, r.owner, rec.of)) rec.peace = ctx.to;
      rec.level = ORGANISING * hostility(next, id, r, rec, neighbors, ctx.to, owners);
      r.resistance = { ...rec, level: round2(rec.level) };
      continue;
    }
    // A peace that left the province with its holder starts the people's acceptance.
    if (!rec.peace && r.owner === r.controller && !warBetween(next, r.controller, rec.of)) rec = { ...rec, peace: ctx.to };
    const level = settleLevel(rec.level, hostility(next, id, r, rec, neighbors, ctx.to, owners), ctx.years);
    if (rec.peace && level < 5 && yearsFrom(rec.peace, ctx.to) > 2 * ACCEPTANCE_YEARS) {
      delete r.resistance;
      continue;
    }
    r.resistance = { ...rec, level: round2(level) };
  }
}

/**
 * The partisans' toll this period: soldiers of the occupier killed and
 * wounded, added to the record of the war it fights against the province's
 * people, if that war goes on. Mutates `next.wars`.
 */
export function partisanLosses(next: GameState, years: number, map?: Record<string, MapRegion> | null): void {
  const toll = new Map<string, number>();
  for (const [id, r] of Object.entries(next.regions)) {
    if (!r.resistance) continue;
    const war = warBetween(next, r.controller, r.resistance.of);
    if (!war || war.truce) continue;
    const key = `${war.id}|${r.controller}`;
    toll.set(key, (toll.get(key) ?? 0) + revolt(r, map?.[id]) * GARRISON * PARTISAN_TOLL * years);
  }
  for (const [key, killed] of toll) {
    if (killed < 0.001) continue;
    const [warId, tag] = key.split("|");
    const war = next.wars.find((w) => w.id === warId);
    if (!war) continue;
    const had = war.losses?.[tag];
    war.losses = { ...war.losses, [tag]: { ...had, killed: Math.round(((had?.killed ?? 0) + killed) * 1000) / 1000, wounded: Math.round(((had?.wounded ?? 0) + 2 * killed) * 1000) / 1000 } };
  }
}

/**
 * War-weariness at home: abroad, a war's losses hold support below where the
 * economy and the years of war (engine/abroad.ts) put it – about fifteen
 * points at the heaviest losses; for the player, they keep unrest from
 * falling below four tenths of the weariness. Runs after politics abroad
 * have moved. Mutates `next`.
 */
export function wearinessAtHome(next: GameState, years: number, map?: Record<string, MapRegion> | null, reading = readState(next, map)): void {
  const pace = 1 - 0.5 ** (years / 0.5);
  for (const [tag, c] of Object.entries(next.countries)) {
    if (tag === next.player || !c.domestic || !warsOf(next, tag).length) continue;
    const { pain } = wearinessParts(next, tag, map, reading);
    if (pain <= 0) continue;
    c.domestic = { ...c.domestic, support: Math.round(clamp(c.domestic.support - 15 * pain * pace, 5, 90) * 100) / 100 };
  }
  if (next.politics && warsOf(next, next.player).length) {
    const floor = round(0.4 * warWeariness(next, next.player, map, reading));
    if (next.politics.unrest < floor) next.politics = { ...next.politics, unrest: floor };
  }
}

/**
 * A side whose will has broken seeks terms: its principal (the strongest of
 * its members, whose peace ends the war) weighs asking for peace – a peace
 * plan at its secret decision, which the engine's plans then carry on
 * (engine/intentions.ts), the enemy's acceptance and the terms with it. By
 * seeded dice, never for the player's government, whose orders decide, and
 * never twice for one war. Mutates `next.plans`.
 */
export function seekTerms(next: GameState, ctx: { turn: number; to: string; years: number; map?: Record<string, MapRegion> | null }, reading = readState(next, ctx.map)): void {
  const plans = next.plans;
  if (!plans) return;
  const power = powers(next, landHolders(next));
  const principal = (side: string[]) => [...side].sort((a, b) => (power.get(b) ?? 0) - (power.get(a) ?? 0) || a.localeCompare(b))[0];
  const chance = 1 - Math.exp(-SEEK_TERMS * ctx.years);
  for (const war of next.wars) {
    if (war.truce) continue;
    for (const [side, other] of [
      [war.attackers, war.defenders],
      [war.defenders, war.attackers],
    ]) {
      const tag = principal(side);
      const enemy = principal(other);
      if (!tag || !enemy || tag === next.player || !next.countries[tag]?.domestic) continue;
      if (plans.some((p) => !p.end && p.kind === "peace" && p.by === tag && p.war === war.id)) continue;
      if (willToFight(next, tag, ctx.map, reading) >= BROKEN) continue;
      if (roll(next.seed ?? next.id, ctx.turn, `terms:${tag}:${war.id}`) >= chance) continue;
      plans.push({ id: `t${ctx.turn}-${tag}-${war.id}`, kind: "peace", by: tag, target: enemy, war: war.id, cause: "weariness", stage: "decision", since: ctx.to, moved: ctx.to });
    }
  }
}

/** The whole turn's means, after politics abroad have moved: resistance, the partisans' toll, weariness at home, and terms sought where the will has broken. */
export function applyWarMeans(before: GameState, next: GameState, ctx: { to: string; years: number; map?: Record<string, MapRegion> | null; neighbors?: Record<string, string[]> | null }): void {
  moveResistance(before, next, ctx);
  partisanLosses(next, ctx.years, ctx.map);
  const reading = readState(next, ctx.map);
  wearinessAtHome(next, ctx.years, ctx.map, reading);
  seekTerms(next, { turn: before.turn, to: ctx.to, years: ctx.years, map: ctx.map }, reading);
}

/**
 * Resistance for a save from before it (save step 26): every province an
 * enemy took in play, by the chronicle's record of its occupation, gets its
 * people's resistance, grown for the time it has been held.
 */
export function seedResistance<T extends GameState>(state: T): T {
  const taken = new Map<string, { to: string; date: string }>();
  for (const e of state.chronicle) for (const c of e.applied) if (c.kind === "occupy" && c.from !== c.to) taken.set(c.region, { to: c.to, date: e.to });
  if (!taken.size) return state;
  const owners = new Set(Object.values(state.regions).map((r) => r.owner));
  let regions: Record<string, RegionState> | undefined;
  for (const [id, t] of taken) {
    const r = state.regions[id];
    if (!r || r.resistance || r.controller !== t.to || r.controller === r.owner || !warBetween(state, r.controller, r.owner)) continue;
    regions ??= { ...state.regions };
    const rec: Resistance = { of: r.owner, level: 0 };
    const target = hostility(state, id, r, rec, null, state.date, owners);
    regions[id] = { ...r, resistance: { of: r.owner, level: round2(settleLevel(ORGANISING * target, target, yearsFrom(t.date, state.date))) } };
  }
  return regions ? { ...state, regions } : state;
}

/** Where a province's people stand against its holder, for the province's card: their country, the resistance and whether a peace has begun their acceptance. */
export function provinceResistance(r: RegionState | undefined): Resistance | null {
  return r?.resistance && r.resistance.level >= 1 && r.controller !== r.resistance.of ? r.resistance : null;
}

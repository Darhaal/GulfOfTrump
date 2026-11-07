import { z } from "zod";
import { addYears, newDomestic, yearsBetween } from "./abroad";
import { addStep } from "./calendar";
import { adm0Provinces, footprint, provincesNamed } from "./colonialLand";
import { countryColor } from "./colors";
import { fixed, roll } from "./dice";
import { startingEconomy, STEP_YEARS } from "./economy";
import { governs } from "./figures";
import { endWar } from "./foreign";
import { countryName } from "./names";
import { peopleIn } from "./population";
import { getScenario } from "./scenarios";
import { MODERN } from "./scenarios/coldwar";
import { COLONIES, FREE_GROUPS, SETTLER_COLONIES, type ColonySeed } from "./scenarios/colonies";
import { en } from "./text";
import { COLONY_COURSES } from "./types";
import type { Alliance, AppliedChange, Colony, ColonyChange, ColonyCourse, ColonyHow, ColonyStage, CountryState, GameState, Localized, MapRegion, RegionState } from "./types";

/**
 * Decolonisation as a process. Every colony – land a power rules overseas
 * that would be a state of its own – has a national movement whose pressure
 * grows with the era's norm (low before the Great War, rising after 1945,
 * all but universal after 1960), with the metropole's weakness, with the
 * wave of colonies already free and with war. It climbs from quiet rule to
 * demands, and the metropole answers: it hands the colony over (talks, a day
 * set, a handover), offers self-government in a federation (autonomy, then
 * independence inside its community), puts it off, or fights; a colony kept
 * too long rises in a colonial war, carried by the dormant movement and the
 * fronts the wars already have, which ends in a handover, the movement
 * crushed, or the movement taking the land.
 *
 * In the historical mode the calendar of scenarios/colonies.ts makes each
 * dated independence a plan: the engine moves it toward history's day (Libya
 * in December 1951, the seventeen states of 1960, Algeria after its war),
 * hastens it when the metropole is beaten, opens and closes the colonial
 * wars history fought; a colony the player rules waits for the player's
 * answer instead, by orders or the panel. New states take their modern
 * borders, their period name and, near history's day, their real first
 * leaders.
 *
 * Everything is decided by seeded dice from the state before the turn
 * (castColonies), so the game master is told what the period brings and
 * the browser that applies the turn comes to the same.
 */

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round1 = (value: number) => Math.round(value * 10) / 10;

/** The calendar by id. */
const SEEDS = new Map(COLONIES.map((s) => [s.id, s]));
export const colonySeed = (c: Pick<Colony, "seed">): ColonySeed | undefined => (c.seed ? SEEDS.get(c.seed) : undefined);

/** Pressure at which a movement makes its demands, the metropole must answer, and a colony kept from it may rise. */
export const DEMANDS = 30;
export const ANSWER = 60;
export const RISING = 70;
/** Years before history's day the talks are under way. */
const TALKS_AHEAD = 1.5;

/** Points of the world's norm against colonial rule, by year: the mandates after 1918, the Charter after 1945, Bandung, the UN's declaration of December 1960. */
const NORM: [number, number][] = [
  [1900, 0.04],
  [1918, 0.08],
  [1920, 0.14],
  [1939, 0.2],
  [1945, 0.4],
  [1955, 0.6],
  [1960, 0.85],
  [1975, 1],
];

/** How far the world holds colonial rule wrong in a year, 0–1. */
export function eraNorm(date: string): number {
  const year = Number(date.slice(0, 4)) + (Number(date.slice(5, 7)) - 1) / 12;
  if (year <= NORM[0][0]) return NORM[0][1];
  for (let i = 1; i < NORM.length; i++) {
    const [y1, v1] = NORM[i];
    const [y0, v0] = NORM[i - 1];
    if (year <= y1) return v0 + ((v1 - v0) * (year - y0)) / (y1 - y0);
  }
  return 1;
}

/** The map the engine reads colonies from: the provinces, and their land borders for the free mode's search. */
export interface ColonyMap {
  regions: Record<string, MapRegion>;
  neighbors?: Record<string, string[]> | null;
}

export { footprint, provincesNamed };

/** The colony's land under foreign rule: its provinces not held by the state it becomes. */
function landOf(state: Pick<GameState, "regions">, c: Pick<Colony, "adm0" | "plus" | "minus" | "tag">, regions: Record<string, MapRegion>): string[] {
  return footprint(c, regions).filter((id) => state.regions[id] && state.regions[id].owner !== c.tag);
}

/** Who rules most of a stretch of land. */
function rulerOf(state: Pick<GameState, "regions">, land: string[]): string | undefined {
  const count = new Map<string, number>();
  for (const id of land) count.set(state.regions[id].owner, (count.get(state.regions[id].owner) ?? 0) + 1);
  return [...count].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
}

/** The colony's own name: the calendar's, a free-mode group's, the modern state's. */
export function colonyName(c: Pick<Colony, "seed" | "tag" | "id">): Localized {
  const seed = colonySeed(c);
  return seed?.name ?? countryName(seed?.tag ?? c.tag) ?? FREE_GROUPS.find((g) => g.id === c.id)?.name ?? { en: c.tag, ru: c.tag, uk: c.tag };
}

function holdsLand(state: Pick<GameState, "regions">, tag: string): boolean {
  for (const id in state.regions) if (state.regions[id].owner === tag) return true;
  return false;
}

/** The game's start date, for which of the calendar's days still lie ahead. */
const startOf = (state: Pick<GameState, "scenarioId" | "variant">) => getScenario(state.scenarioId, state.variant).startDate;

const historical = (state: Pick<GameState, "mode">) => state.mode === "historical";

/** The calendar's seeds a game plays: those still ahead of its start; in the free mode only those that are colonies, not unions or partitions. */
function seedsFor(state: Pick<GameState, "scenarioId" | "variant" | "mode">): ColonySeed[] {
  const start = startOf(state);
  return COLONIES.filter((s) => s.due > start && (historical(state) || !s.history));
}

/** Pressure on the start date: the closer history's day, the stronger the movement; without a day, the era's. */
function startingPressure(state: Pick<GameState, "date" | "seed" | "id">, id: string, due?: string): number {
  const spread = (fixed(`colony:${state.seed ?? state.id}:${id}`) - 0.5) * 12;
  if (due) return round1(clamp(75 - 4 * Math.max(0, yearsBetween(state.date, due)) + spread, 3, 80));
  return round1(clamp(60 * eraNorm(state.date) + spread, 2, 60));
}

/** A seed's colony as it stands: its war if the date has its movement fighting, talks with the day agreed if history's day is near. */
function recordFor(state: GameState, seed: ColonySeed, of: string, late: boolean): Colony {
  const movement = seed.war?.tag;
  const war = movement && state.countries[movement]?.dormant ? state.wars.find((w) => w.attackers.includes(movement) && w.defenders.includes(of)) : undefined;
  const due = historical(state) && !late ? seed.due : undefined;
  let pressure = startingPressure(state, seed.id, seed.due);
  if (war) pressure = Math.max(pressure, 75);
  // Talks under way on the start date stand: the day is agreed (Libya's, set by the United Nations in 1949).
  const talks = Boolean(due && !war && yearsBetween(state.date, due) <= TALKS_AHEAD && seed.how !== "war");
  const stage: ColonyStage = war ? "war" : talks ? "talks" : pressure >= DEMANDS ? "demands" : "rule";
  const course: ColonyCourse | undefined = war ? "fight" : talks ? (seed.how === "community" ? "federation" : "hand-over") : undefined;
  return {
    id: seed.id,
    tag: seed.tag,
    of,
    adm0: [...seed.adm0],
    ...(seed.plus ? { plus: [...seed.plus] } : {}),
    ...(seed.minus ? { minus: [...seed.minus] } : {}),
    seed: seed.id,
    stage,
    since: state.date,
    pressure,
    ...(due ? { due } : {}),
    ...(war && movement ? { war: war.id, movement } : {}),
    ...(course ? { course, answered: course } : {}),
  };
}

/** A seed's colony, if a power it names now rules most of its land. */
function seedColony(state: GameState, seed: ColonySeed, regions: Record<string, MapRegion>, late = false): Colony | null {
  const land = landOf(state, seed, regions);
  if (!land.length) return null;
  const of = rulerOf(state, land);
  if (!of || !seed.from.includes(of)) return null;
  return recordFor(state, seed, of, late);
}

/**
 * The colonies the calendar does not name: land a power rules that its home
 * cannot reach by land (the salt-water rule of the UN's 1960 resolutions)
 * and that would be a state of its own. Its home is the land of its own
 * modern country, else its most populous province.
 */
function freeColonies(state: GameState, map: ColonyMap, claimed: Set<string>): Colony[] {
  const neighbors = map.neighbors;
  if (!neighbors) return [];
  const byOwner = new Map<string, string[]>();
  for (const [id, r] of Object.entries(state.regions)) {
    if (!map.regions[id]) continue;
    const list = byOwner.get(r.owner);
    if (list) list.push(id);
    else byOwner.set(r.owner, [id]);
  }
  const out: Colony[] = [];
  for (const [owner, ids] of [...byOwner].sort((a, b) => a[0].localeCompare(b[0]))) {
    const own = new Set(ids);
    let home = ids.filter((id) => MODERN[map.regions[id].adm0] === owner);
    if (!home.length) home = [ids.reduce((a, b) => (peopleIn(state.regions[b], map.regions[b]) > peopleIn(state.regions[a], map.regions[a]) ? b : a))];
    const reached = new Set(home);
    const queue = [...home];
    while (queue.length) {
      const id = queue.pop()!;
      for (const n of neighbors[id] ?? []) {
        if (own.has(n) && !reached.has(n)) {
          reached.add(n);
          queue.push(n);
        }
      }
    }
    // A modern country part of which the home reaches is the home's, its islands with it (Sakhalin, Saaremaa); one a
    // calendar's colony covers in part is that colony's (the British Cameroons).
    const homeland = new Set<string>();
    for (const id of reached) homeland.add(map.regions[id].adm0);
    // A colony is most of a modern country: a province or two of another's (Königsberg, Karafuto, Kinmen) is a border, not a colony.
    const held = new Map<string, number>();
    for (const id of ids) held.set(map.regions[id].adm0, (held.get(map.regions[id].adm0) ?? 0) + 1);
    const groups = new Map<string, Set<string>>();
    for (const id of ids) {
      if (reached.has(id) || claimed.has(id)) continue;
      const adm0 = map.regions[id].adm0;
      const whole = adm0Provinces(adm0, map.regions);
      if (homeland.has(adm0) || (held.get(adm0) ?? 0) * 2 <= whole.length || whole.some((p) => claimed.has(p))) continue;
      const tag = FREE_GROUPS.find((g) => g.adm0.includes(adm0))?.tag ?? MODERN[adm0];
      if (!tag || tag === owner || (byOwner.has(tag) && !state.countries[tag]?.dormant)) continue;
      groups.set(tag, (groups.get(tag) ?? new Set()).add(adm0));
    }
    for (const [tag, adm0] of groups) {
      const group = FREE_GROUPS.find((g) => g.tag === tag);
      const id = group?.id ?? `${owner}:${tag}`;
      const pressure = startingPressure(state, id);
      out.push({ id, tag, of: owner, adm0: group ? [...group.adm0] : [...adm0].sort(), stage: pressure >= DEMANDS ? "demands" : "rule", since: state.date, pressure });
    }
  }
  return out;
}

/** What a colony has been through that a record taking its place keeps: its war, movement and answer. */
const carried = (c: Colony): Partial<Colony> => ({
  stage: c.stage,
  since: c.since,
  ...(c.war ? { war: c.war } : {}),
  ...(c.movement ? { movement: c.movement } : {}),
  ...(c.course ? { course: c.course } : {}),
  ...(c.answered ? { answered: c.answered } : {}),
});

/**
 * The colonies of a game: as the save keeps them, else read from the map
 * (a new game's first turn, a save from before them) – the calendar's that a
 * power it names rules now, and in the free mode the rest the salt-water
 * rule finds. The calendar's that come into a named power's hands later
 * (Singapore in Malaysia, Libya in British hands) join on later turns, and
 * take over a colony the free search found on the same land.
 */
export function coloniesOf(state: GameState, map: ColonyMap): Colony[] {
  if (state.colonies) {
    const known = new Set(state.colonies.map((c) => c.seed ?? c.id));
    let list = state.colonies;
    for (const seed of seedsFor(state)) {
      if (known.has(seed.id)) continue;
      const c = seedColony(state, seed, map.regions, yearsBetween(seed.due, state.date) > 2);
      if (!c) continue;
      const mine = new Set(footprint(c, map.regions));
      const over = list.find((o) => !o.end && o.of === c.of && footprint(o, map.regions).some((id) => mine.has(id)));
      if (over?.seed) continue;
      const record: Colony = over ? { ...c, ...carried(over), pressure: Math.max(over.pressure, c.pressure) } : c;
      list = over ? list.map((o) => (o === over ? record : o)) : [...list, record];
    }
    return list;
  }
  const list: Colony[] = [];
  const claimed = new Set<string>();
  for (const seed of seedsFor(state)) {
    const c = seedColony(state, seed, map.regions);
    if (!c) continue;
    const mine = footprint(c, map.regions);
    if (mine.some((id) => claimed.has(id))) continue;
    for (const id of mine) claimed.add(id);
    list.push(c);
  }
  // The historical mode keeps to the calendar: a land history did not free within the date's years stays as it was unless the game changes it.
  return historical(state) ? list : [...list, ...freeColonies(state, map, claimed)];
}

/** Who holds land, and how much of each owner's home (its own modern country) an enemy holds: read in one pass a turn, the map being large. */
interface Census {
  holders: Set<string>;
  /** Provinces each owner holds. */
  owned: Map<string, number>;
  home: Map<string, { all: number; lost: number }>;
}

function censusOf(state: Pick<GameState, "regions">, regions: Record<string, MapRegion>): Census {
  const holders = new Set<string>();
  const owned = new Map<string, number>();
  const home = new Map<string, { all: number; lost: number }>();
  for (const id in state.regions) {
    const r = state.regions[id];
    holders.add(r.owner);
    owned.set(r.owner, (owned.get(r.owner) ?? 0) + 1);
    const p = regions[id];
    if (!p || MODERN[p.adm0] !== r.owner) continue;
    let h = home.get(r.owner);
    if (!h) home.set(r.owner, (h = { all: 0, lost: 0 }));
    h.all += 1;
    if (r.controller !== r.owner) h.lost += 1;
    else if (r.contested) h.lost += 0.5;
  }
  return { holders, owned, home };
}

/** How weak a metropole is, 0–1: its home occupied, a war of its own, an unstable government; a government in exile, wholly. */
function weaknessOf(state: GameState, tag: string, census: Census, memo: Map<string, number>): number {
  const known = memo.get(tag);
  if (known !== undefined) return known;
  const c = state.countries[tag];
  let w = 1;
  if (c && !c.exile) {
    const h = census.home.get(tag);
    const share = h?.all ? h.lost / h.all : census.holders.has(tag) ? 0 : 1;
    // Its wars, other than those with colonial movements.
    const wars = state.wars.filter((x) => (x.attackers.includes(tag) || x.defenders.includes(tag)) && ![...x.attackers, ...x.defenders].every((t) => t === tag || state.countries[t]?.dormant));
    const stability = c.domestic?.stability ?? 60;
    w = clamp(share * 1.2 + (wars.length ? 0.15 : 0) + clamp((50 - stability) / 100, 0, 0.2), 0, 1);
  }
  memo.set(tag, w);
  return w;
}

/** The share of the game's colonies that came free within the last ten years: the wave. */
function waveOf(colonies: Colony[], date: string): number {
  if (!colonies.length) return 0;
  const free = colonies.filter((c) => c.end && c.end.how !== "gone" && yearsBetween(c.end.date, date) <= 10).length;
  return free / colonies.length;
}

/** The most fighters a rising starts with, thousands: the Viet Minh's main force by 1954. */
const MAX_FIGHTERS = 150;

/** The movement's fighters on the day it rises, thousands: a few in a thousand of the colony's people, more under more pressure. */
function fightersOf(state: GameState, land: string[], pressure: number, regions: Record<string, MapRegion>): number {
  const people = land.reduce((sum, id) => sum + peopleIn(state.regions[id], regions[id]), 0);
  return round1(clamp(people * 0.004 * (pressure / 100), 0.5, MAX_FIGHTERS));
}

/** The provinces a rising begins in: the calendar's, else the roughest and most populous of the colony. */
function risingPlaces(state: GameState, c: Colony, of: string, land: string[], regions: Record<string, MapRegion>): string[] {
  const open = (id: string) => {
    const r = state.regions[id];
    return Boolean(r && r.owner === of && r.controller === of && !r.contested);
  };
  const inLand = new Set(land);
  const named = provincesNamed(colonySeed(c)?.war?.where ?? [], regions).filter((id) => inLand.has(id) && open(id));
  if (named.length) return named.slice(0, 4);
  const rough = (id: string) => (["mountains", "hills", "jungle", "forest", "wetlands"].includes(regions[id]?.terrain ?? "") ? 1 : 0);
  const n = clamp(Math.round(land.length / 10), 1, 3);
  return land
    .filter(open)
    .sort((a, b) => rough(b) - rough(a) || peopleIn(state.regions[b], regions[b]) - peopleIn(state.regions[a], regions[a]) || a.localeCompare(b))
    .slice(0, n);
}

/** What one colony does in the coming period: decided before the turn, told to the game master, carried out after it. */
export interface ColonyMove {
  colony: string;
  /** Its metropole now. */
  of: string;
  pressure: number;
  stage: ColonyStage;
  /** What happens, in order, and the day. */
  events: { change: ColonyChange; date: string }[];
  course?: ColonyCourse;
  answered?: ColonyCourse;
  due?: string;
  /** It rises: where, how much of each province the movement holds, and its fighters, thousands. */
  rising?: { where: string[]; held: number; fighters: number };
  /** Its war ends this period: settled (talks follow) or the movement crushed. */
  peace?: "agreement" | "crushed";
  /** It comes free this period, how, on what day. */
  free?: { how: ColonyHow; date: string };
  /** Its land has gone to the state it would become. */
  gone?: boolean;
  /** The calendar's war is behind it. */
  fought?: boolean;
  /** Its movement fought the metropole to the table. */
  won?: boolean;
}

/** The AI metropole's answer to a colony's demands, by its appetite for force, its regime, its settlers, the era and its weakness. */
function chooseCourse(state: GameState, c: Colony, of: string, weakness: number, norm: number, dice: (key: string) => number): ColonyCourse {
  const m = state.countries[of];
  const hawk = m?.course?.hawk ?? 50;
  const regime = m?.domestic?.regime ?? "limited";
  const settlers = c.adm0.some((a) => SETTLER_COLONIES.has(a)) ? 1 : 0;
  const hard = regime === "autocracy" || regime === "party" || regime === "military" ? 1 : 0;
  const scores: [ColonyCourse, number][] = [
    ["hand-over", 0.4 + 0.8 * norm + (regime === "democracy" ? 0.3 : 0) - 0.5 * settlers - hawk / 200 + 0.5 * weakness],
    ["federation", 0.35 + (of === "france" ? 0.35 : of === "uk" ? 0.1 : 0) - 0.2 * settlers],
    ["fight", 0.1 + hawk / 150 + 0.6 * settlers + 0.4 * hard - 0.4 * norm - 0.3 * weakness],
    ["delay", 0.45],
  ];
  return scores.map(([course, s]) => [course, s + (dice(`answer:${course}`) - 0.5) * 0.3] as const).sort((a, b) => b[1] - a[1])[0][0];
}

const hazard = (perYear: number, years: number) => 1 - Math.exp(-Math.max(0, perYear) * years);
const addDays = (date: string, days: number) => addYears(date, days / 365.25);

/** History's day, moved a little by the game's own dice: never a script to the day. */
function plannedDay(state: Pick<GameState, "seed" | "id">, c: Colony): string {
  const days = Math.round((fixed(`colony-day:${state.seed ?? state.id}:${c.id}`) - 0.4) * 110);
  return addDays(c.due!, days);
}

/** How a colony let go by its metropole comes free: into the state it joins, inside the community it was offered, as the movement that fought for it, or handed over. */
function freeHow(c: Colony, seed: ColonySeed | undefined, dice: (key: string) => number): ColonyHow {
  if (seed?.how === "union") return "union";
  if (c.won) return "war";
  if (c.answered === "federation" || c.course === "federation") return "community";
  // Most of Britain's colonies stayed in the Commonwealth.
  if (seed?.how === "community" || (c.of === "uk" && dice("commonwealth") < 0.7)) return "community";
  return "handover";
}

/**
 * The period's colonies, decided by the game's dice from the state before
 * the turn: the list as it stands (read from the map when the save has
 * none) and what each colony does.
 */
export function castColonies(state: GameState, map: ColonyMap | null): { colonies: Colony[]; moves: ColonyMove[] } {
  if (!map) return { colonies: state.colonies ?? [], moves: [] };
  const colonies = coloniesOf(state, map);
  const from = state.date;
  const to = addStep(from, state.step);
  const years = STEP_YEARS[state.step];
  const norm = eraNorm(from);
  const wave = waveOf(colonies, from);
  const memo = new Map<string, number>();
  const census = censusOf(state, map.regions);
  const game = state.seed ?? state.id;
  const moves: ColonyMove[] = [];
  for (const c of colonies) {
    if (c.end) continue;
    const dice = (key: string) => roll(game, state.turn, `colony:${c.id}:${key}`);
    const land = landOf(state, c, map.regions);
    const of = land.length ? rulerOf(state, land) : undefined;
    const seed = colonySeed(c);
    // Its land gone to the state it would become, to its movement, or to a state of its own the game master made there
    // (one that holds nothing outside it): the colony's way is over.
    const local = of !== undefined && (census.owned.get(of) ?? 0) <= land.filter((id) => state.regions[id].owner === of).length && of !== state.player;
    if (!of || (c.movement && of === c.movement) || local) {
      moves.push({ colony: c.id, of: c.of, pressure: c.pressure, stage: c.stage, events: [], gone: true });
      continue;
    }
    const player = of === state.player && governs(state);
    const weakness = weaknessOf(state, of, census, memo);
    const war = c.war ? state.wars.find((w) => w.id === c.war) : undefined;
    const move: ColonyMove = { colony: c.id, of, pressure: c.pressure, stage: c.stage, events: [], course: c.course, answered: c.answered, due: c.due };
    const event = (change: ColonyChange, date = to) => move.events.push({ change, date });
    const startRising = (pressure: number, date = to) => {
      const where = risingPlaces(state, c, of, land, map.regions);
      if (!where.length) return false;
      move.rising = { where, held: Math.round(10 + dice("held") * 15), fighters: fightersOf(state, land, pressure, map.regions) };
      move.stage = "war";
      event("rising", date);
      return true;
    };
    // A war the game master ended outside the engine: the colony goes back to its demands, and the calendar's war is over.
    const endedOutside = c.stage === "war" && !war;
    if (endedOutside) move.stage = "demands";
    const growth =
      7 * norm +
      6 * weakness +
      5 * wave +
      (move.stage === "war" ? 4 : 0) +
      (c.course === "delay" ? 3 : c.course === "fight" ? 2 : 0) +
      (move.stage === "autonomy" && yearsBetween(c.since, from) < 3 ? -6 : 0);
    move.pressure = round1(clamp(c.pressure + growth * years, 0, 100));

    // The historical mode: the calendar's plan, while a power it names rules the colony and the player is not that power.
    if (historical(state) && c.due && seed && seed.from.includes(of) && !player) {
      let day = plannedDay(state, c);
      // A beaten metropole lets go sooner: Syria and Lebanon after France fell, Indonesia after Japan.
      if (weakness >= 0.5 && yearsBetween(from, day) < 5 && day > addYears(from, 0.5)) day = addYears(from, 0.5);
      const ahead = yearsBetween(to, day);
      // The movement's strength follows the plan: history's day near, its war on.
      move.pressure = round1(clamp(75 - 4 * Math.max(0, ahead) + (war ? 10 : 0), 3, 100));
      if (endedOutside) move.fought = true;
      const w = seed.war;
      if (w && !war && !c.fought && !endedOutside && to >= w.since && (!w.until || from < w.until) && day > to && seed.how !== "union") {
        if (startRising(Math.max(move.pressure, 60), w.since > from ? w.since : from)) move.course = move.answered = "fight";
      } else if (w && war && w.until && to >= w.until && day > to) {
        move.peace = w.ends === "crushed" ? "crushed" : "agreement";
        move.fought = true;
        move.stage = "demands";
        if (move.peace === "crushed") move.pressure = round1(Math.max(DEMANDS, move.pressure - 25));
        event(move.peace, w.until > from ? w.until : from);
      }
      const union = seed.how === "union";
      if (day <= to && (!union || (state.countries[c.tag] && census.holders.has(c.tag)))) {
        move.free = { how: seed.how, date: day > from ? day : from };
      } else if (move.stage !== "war") {
        // The stages follow the plan quietly; the news tells the talks that set the day.
        const stage: ColonyStage = ahead <= TALKS_AHEAD ? "talks" : move.pressure >= DEMANDS || ahead <= 10 ? "demands" : "rule";
        if (stage === "talks" && c.stage !== "talks" && !union) event("talks");
        move.stage = stage;
        if (stage === "talks") move.course = move.answered = seed.how === "community" ? "federation" : "hand-over";
      }
      moves.push(move);
      continue;
    }

    // Everyone else: the free mode, a colony another power has taken, and every colony the player rules.
    // A course the player chose since the last turn is acted on now.
    if (player && c.course && c.course !== c.answered) {
      move.answered = c.course;
      if (c.course === "hand-over") {
        if (war) {
          move.peace = "agreement";
          move.won = true;
        }
        move.stage = "talks";
        const soon = addYears(to, 0.3 + dice("handover") * 0.5);
        move.due = c.stage === "talks" && c.due && c.due < soon ? c.due : soon;
        event(war ? "agreement" : "talks");
      } else if (c.course === "federation") {
        if (war) move.peace = "agreement";
        move.stage = "autonomy";
        move.pressure = round1(Math.max(0, move.pressure - 20));
        event(war ? "agreement" : "autonomy");
      } else if (c.course === "delay") {
        if (c.due) move.due = addYears(c.due > to ? c.due : to, 3);
        if (move.stage === "talks" || move.stage === "autonomy") move.stage = "demands";
        move.pressure = round1(Math.min(100, move.pressure + 5));
        event("delayed");
      } else {
        if (move.stage === "talks" || move.stage === "autonomy") move.stage = "demands";
        move.pressure = round1(Math.min(100, move.pressure + 5));
        event("refused");
      }
    }
    // History's day passing with no answer from the player angers the colony, once.
    if (player && historical(state) && c.seed && c.due && c.due > from && c.due <= to && !c.course) move.pressure = round1(Math.min(100, move.pressure + 15));

    if (move.peace) {
      // A war settled this period: its talks or self-government follow next turn.
    } else if (move.stage === "talks") {
      if (!move.due) move.due = addYears(to, 1.5 + dice("talks") * 2.5);
      else if (move.due <= to) {
        move.free = { how: freeHow({ ...c, course: move.course, answered: move.answered }, seed, dice), date: move.due > from ? move.due : from };
        if (move.free.how === "union" && !(state.countries[c.tag] && census.holders.has(c.tag))) delete move.free;
      }
    } else if (move.stage === "autonomy") {
      if (!player && (move.pressure >= 90 || (yearsBetween(c.since, to) >= 2 && dice("community") < hazard(0.3, years)))) move.free = { how: "community", date: to };
      else if (player && move.pressure >= 85 && dice("rising") < hazard(0.2, years)) startRising(move.pressure);
    } else if (move.stage === "war" && war) {
      const fighting = land.filter((id) => state.regions[id].controller === c.movement || state.regions[id].contested === c.movement);
      const held = land.filter((id) => state.regions[id].controller === c.movement).length;
      const warYears = yearsBetween(war.since, from);
      if (land.length && held / land.length >= 0.5) {
        move.free = { how: "war", date: to };
      } else if (!fighting.length && move.pressure < 75 && dice("crushed") < hazard(0.35, years)) {
        move.peace = "crushed";
        move.stage = "demands";
        move.pressure = round1(Math.max(0, move.pressure - 30));
        event("crushed");
      } else if (!player) {
        const m = state.countries[of];
        const hard = ["autocracy", "party", "military"].includes(m?.domestic?.regime ?? "") ? 0.6 : 1;
        const giveIn = (0.04 + 0.03 * warYears + 0.35 * weakness + 0.15 * norm) * (1 - (m?.course?.hawk ?? 50) / 200) * hard;
        if (dice("give-in") < hazard(giveIn, years)) {
          move.peace = "agreement";
          move.won = true;
          move.stage = "talks";
          move.course = move.answered = "hand-over";
          move.due = addYears(to, 0.3 + dice("handover") * 0.5);
          event("agreement");
        }
      }
    } else if (move.stage === "rule" || move.stage === "demands") {
      if (move.stage === "rule" && move.pressure >= DEMANDS) {
        move.stage = "demands";
        event("demands");
      }
      // The AI metropole answers once the demands are loud enough; after a delay it thinks again when they grow louder still.
      const rethink = move.course === "delay" && move.pressure >= 85 && dice("rethink") < hazard(0.4, years);
      if (!player && move.stage === "demands" && move.pressure >= ANSWER && (!move.course || rethink)) {
        const course = rethink ? "hand-over" : chooseCourse(state, c, of, weakness, norm, dice);
        move.course = move.answered = course;
        if (course === "hand-over") {
          move.stage = "talks";
          move.due = addYears(to, 1.5 + dice("talks") * 2.5);
          event("talks");
        } else if (course === "federation") {
          move.stage = "autonomy";
          move.pressure = round1(Math.max(0, move.pressure - 20));
          event("autonomy");
        } else event(course === "delay" ? "delayed" : "refused");
      }
      // A colony kept from its independence rises.
      const kept = move.stage === "demands" && (player || move.course === "delay" || move.course === "fight");
      if (kept && move.pressure >= RISING) {
        const h = (0.15 + (0.5 * (move.pressure - RISING)) / (100 - RISING)) * (move.course === "fight" ? 1.5 : 1);
        if (dice("rising") < hazard(h, years)) startRising(move.pressure);
      }
    }
    moves.push(move);
  }
  return { colonies, moves };
}

/** A movement's name while it fights, where the calendar has none: "Kenya Liberation Front". */
function movementName(c: Colony): Localized {
  const n = colonyName(c);
  return { en: `${n.en} Liberation Front`, ru: `Фронт освобождения (${n.ru})`, uk: `Фронт визволення (${n.uk})` };
}

function warName(c: Colony): Localized {
  const n = colonyName(c);
  return { en: `${n.en} War of Independence`, ru: `Война за независимость (${n.ru})`, uk: `Війна за незалежність (${n.uk})` };
}

const MOVEMENT_GOVERNMENT: Localized = { en: "National liberation movement at war", ru: "Национально-освободительное движение в войне", uk: "Національно-визвольний рух у війні" };
const NEW_STATE: Localized = { en: "Newly independent republic", ru: "Только что независимая республика", uk: "Щойно незалежна республіка" };

/** The community a colony joins on independence: the Commonwealth, the French Union or Community, or one its metropole founds. */
function joinCommunity(next: GameState, of: string, tag: string, date: string): string {
  const find = (id: string) => next.alliances.find((a) => a.id === id);
  let bloc: Alliance | undefined = of === "uk" ? find("commonwealth") : of === "france" ? ((date < "1958-10-04" ? find("french-union") : undefined) ?? find("french-community")) : find(`${of}-community`);
  if (!bloc) {
    const m = next.countries[of]?.name;
    const local = (l: "ru" | "uk") => (typeof m === "string" ? m : (m?.[l] ?? of));
    const name: Localized =
      of === "uk"
        ? { en: "British Commonwealth", ru: "Британское Содружество", uk: "Британська Співдружність" }
        : of === "france"
          ? { en: "French Community", ru: "Французское сообщество", uk: "Французька спільнота" }
          : { en: `${en(m) || of} Community`, ru: `Сообщество: ${local("ru")}`, uk: `Спільнота: ${local("uk")}` };
    bloc = { id: of === "uk" ? "commonwealth" : of === "france" ? "french-community" : `${of}-community`, name, members: [of], since: date, kind: "organization", founder: of };
    next.alliances.push(bloc);
  }
  if (!bloc.members.includes(tag)) bloc.members.push(tag);
  return bloc.id;
}

/** The leader a new state gets: history's first near history's day; else the movement's; else none, for the game master to name. */
function leaderFor(state: GameState, c: Colony, date: string): string | undefined {
  const seed = colonySeed(c);
  if (seed?.leader && (historical(state) || Math.abs(yearsBetween(seed.due, date)) <= 8)) return seed.leader;
  const movement = c.movement ? state.countries[c.movement] : undefined;
  return seed?.war?.apart ? undefined : movement?.leader;
}

/**
 * The period's colonies carried out on the state after the turn: pressure
 * and stages, the risings opened and the wars closed, the new states made
 * with their land, leader and community, the orders' answers kept, and the
 * record of it all.
 */
export function applyColonies(
  before: GameState,
  next: GameState,
  cast: { colonies: Colony[]; moves: ColonyMove[] },
  ctx: { turn: number; to: string; regions: Record<string, MapRegion> | null; words?: { colony: string; course: ColonyCourse }[] },
  applied: AppliedChange[],
): void {
  if (!ctx.regions) return;
  const regions = ctx.regions;
  const byId = new Map(cast.moves.map((m) => [m.colony, m]));
  let wars = 0;
  const list: Colony[] = cast.colonies.map((c) => ({ ...c }));
  for (const c of list) {
    const m = byId.get(c.id);
    if (!m) continue;
    const name = colonyName(c);
    const note = (change: ColonyChange, extra: Partial<Extract<AppliedChange, { kind: "colony" }>> = {}) =>
      applied.push({ kind: "colony", colony: c.id, country: c.tag, of: m.of, name, change, ...extra });
    if (m.gone) {
      c.end = { date: ctx.to, turn: ctx.turn, how: "gone" };
      continue;
    }
    if (m.stage !== c.stage) c.since = m.events.at(-1)?.date ?? ctx.to;
    c.of = m.of;
    c.stage = m.stage;
    c.pressure = m.pressure;
    if (m.course) c.course = m.course;
    if (m.answered) c.answered = m.answered;
    if (m.due) c.due = m.due;
    if (m.fought) c.fought = true;
    if (m.won) c.won = true;

    // A land waiting to join a state has no movement of its own to tell of, only its union.
    const union = colonySeed(c)?.how === "union";
    for (const e of m.events) {
      if (union || e.change === "rising" || e.change === "crushed" || e.change === "agreement") continue;
      note(e.change, e.change === "talks" && c.due ? { due: c.due } : {});
    }

    if (m.peace) {
      const war = c.war ? next.wars.find((w) => w.id === c.war) : undefined;
      if (war) endWar(next, war, applied);
      if (m.peace === "crushed" && c.movement && next.countries[c.movement]?.dormant) {
        const e = next.countries[c.movement].economy;
        if (e) next.countries[c.movement].economy = { ...e, troops: 0 };
      }
      note(m.peace, { ...(c.war ? { war: c.war } : {}), ...(c.movement ? { movement: c.movement } : {}) });
      delete c.war;
    }

    if (m.rising) rise(c, m, note);
    if (m.free) free(c, m, name);
  }

  // The player's answers in this turn's orders, acted on from the next turn (castColonies).
  for (const w of ctx.words ?? []) {
    const c = list.find((x) => !x.end && x.id === w.colony && x.of === next.player);
    if (c) c.course = w.course;
  }
  next.colonies = list;

  function rise(c: Colony, m: ColonyMove, note: (change: ColonyChange, extra?: Partial<Extract<AppliedChange, { kind: "colony" }>>) => void): void {
    const seed = colonySeed(c);
    const free = (tag: string | undefined): tag is string => Boolean(tag && next.countries[tag] && !holdsLand(next, tag));
    const tag = free(seed?.war?.tag) ? seed!.war!.tag! : free(c.movement) ? c.movement! : c.tag;
    if (next.countries[tag] && holdsLand(next, tag)) {
      c.stage = "demands";
      return;
    }
    const land = new Set(landOf(next, c, regions));
    const was = next.countries[tag];
    const leader = seed?.war?.leader ?? was?.leader;
    next.countries[tag] = {
      ...(was ?? { tag, color: countryColor(tag) }),
      tag,
      name: seed?.war?.movement ?? movementName(c),
      ...(leader ? { leader } : {}),
      government: MOVEMENT_GOVERNMENT,
      dormant: true,
      economy: startingEconomy([], next.scenarioId, { troops: m.rising!.fighters, army: 0.3, growth: 0 }),
    };
    const id = `w${ctx.turn}-c${++wars}`;
    const name = seed?.war?.name ?? warName(c);
    next.wars.push({ id, name, attackers: [tag], defenders: [m.of], since: m.events.find((e) => e.change === "rising")?.date ?? before.date });
    for (const pid of m.rising!.where) {
      const r = next.regions[pid];
      if (!r || r.owner !== m.of || r.controller !== m.of || r.contested || !land.has(pid)) continue;
      r.contested = tag;
      r.held = m.rising!.held;
    }
    applied.push({ kind: "war", war: id, name, sides: [tag, m.of], colony: c.id });
    c.war = id;
    c.movement = tag;
    note("rising", { war: id, movement: tag });
  }

  function free(c: Colony, m: ColonyMove, name: Localized): void {
    const seed = colonySeed(c);
    const date = m.free!.date;
    let how = m.free!.how;
    // Its land the metropole (or another power the calendar names) rules, and that the metropole or the movement holds: a
    // province a third power occupies in a war of its own stays the metropole's until that war's end.
    const ours = (tag: string) => tag === m.of || Boolean(seed?.from.includes(tag)) || tag === c.movement;
    const land = footprint(c, regions).filter((id) => {
      const r = next.regions[id];
      return r && r.owner !== c.tag && ours(r.owner) && (ours(r.controller) || r.controller === c.tag) && (!r.contested || ours(r.contested) || r.contested === c.tag);
    });
    // The war ends as the colony comes free.
    const war = c.war ? next.wars.find((w) => w.id === c.war) : undefined;
    if (war) endWar(next, war, applied);
    delete c.war;
    const movement = c.movement && next.countries[c.movement] && !holdsLand(next, c.movement) ? c.movement : undefined;
    const tag = how !== "union" && movement && !seed?.war?.apart ? movement : c.tag;
    const exists = next.countries[tag];
    if (how === "union") {
      if (!exists || !holdsLand(next, tag)) return;
    } else if (exists && holdsLand(next, tag)) {
      // A state already free there takes the land: British Somaliland joining Somalia.
      how = "union";
    } else {
      const leader = leaderFor(next, c, date);
      const country: CountryState = {
        ...(exists ?? { tag, color: countryColor(tag) }),
        tag,
        name: seed?.name ?? countryName(c.tag) ?? colonyName(c),
        government: seed?.government ?? NEW_STATE,
      };
      delete country.dormant;
      if (leader) country.leader = leader;
      else delete country.leader;
      country.domestic = newDomestic(country, next.scenarioId, date);
      next.countries[tag] = country;
    }
    // A movement the state is not given to has done its work.
    if (movement && movement !== tag) {
      next.countries[movement].dormant = true;
      const e = next.countries[movement].economy;
      if (e) next.countries[movement].economy = { ...e, troops: 0 };
    }
    for (const id of land) {
      const r: RegionState = next.regions[id];
      r.owner = tag;
      r.controller = tag;
      delete r.contested;
      delete r.held;
      delete r.taken;
      delete r.behind;
      delete r.resistance;
    }
    const bloc = how === "community" ? joinCommunity(next, m.of, tag, date) : undefined;
    c.end = { date, turn: ctx.turn, how };
    // The record keeps the state it became: the movement's own tag where the movement took power (1957's FLN).
    c.tag = tag;
    const leader = how !== "union" ? next.countries[tag]?.leader : undefined;
    applied.push({ kind: "colony", colony: c.id, country: tag, of: m.of, name, change: "independence", how, ...(bloc ? { bloc } : {}), ...(leader ? { leader } : {}) });
  }
}

/** The player's colonies, live: for the panel and the game master. */
export function playerColonies(state: GameState, map: ColonyMap | null): Colony[] {
  const list = map ? coloniesOf(state, map) : (state.colonies ?? []);
  return list.filter((c) => !c.end && c.of === state.player);
}

/** The player's answer for one of its colonies, given on the panel: acted on when the turn is played. */
export function setColonyCourse(state: GameState, id: string, course: ColonyCourse, map: ColonyMap | null): GameState {
  const list = map ? coloniesOf(state, map) : (state.colonies ?? []);
  if (!governs(state) || !list.some((c) => c.id === id && !c.end && c.of === state.player)) return state;
  return { ...state, colonies: list.map((c) => (c.id === id ? { ...c, course } : c)) };
}

/** What the world stage may answer for the player's colonies: the course its orders set for one of them. */
export const coloniesField = z
  .array(z.object({ colony: z.string().trim().min(1).max(80), course: z.enum(COLONY_COURSES) }))
  .max(12)
  .catch([])
  .default([]);

/** The orders' answers for the player's own colonies only, one per colony, found by its id, its tag or its name. */
export function sanitizeColonyWords(state: GameState, raw: z.infer<typeof coloniesField>, map: ColonyMap | null): { colony: string; course: ColonyCourse }[] {
  if (!governs(state)) return [];
  const mine = playerColonies(state, map);
  const out: { colony: string; course: ColonyCourse }[] = [];
  for (const w of raw) {
    const key = w.colony.trim().toLowerCase();
    const c = mine.find((x) => x.id === key || x.tag === key || Object.values(colonyName(x)).some((n) => n.toLowerCase() === key));
    if (c && !out.some((o) => o.colony === c.id)) out.push({ colony: c.id, course: w.course });
  }
  return out;
}

const STAGE_EN: Record<ColonyStage, string> = { rule: "quiet", demands: "demands independence", talks: "talks, a day set", autonomy: "self-governing in a federation", war: "colonial war" };
const HOW_EN: Record<ColonyHow, string> = { handover: "handed over", community: "inside its metropole's community", war: "won after a colonial war", union: "joins" };

/**
 * The game master's part: what the engine decided for the colonies this
 * period, the colonial wars, the days history set that are coming, and the
 * player's own colonies waiting for its answer.
 */
export function describeColonies(state: GameState, name: (tag: string) => string, map: ColonyMap | null): string[] {
  if (!map) return [];
  const { colonies, moves } = castColonies(state, map);
  const byId = new Map(colonies.map((c) => [c.id, c]));
  const label = (c: Colony) => `${en(colonyName(c))} [${c.tag}]`;
  const now: string[] = [];
  for (const m of moves) {
    const c = byId.get(m.colony)!;
    const seed = colonySeed(c);
    for (const e of seed?.how === "union" ? [] : m.events) {
      if (e.change === "rising") now.push(`a colonial war breaks out in ${label(c)} on ${e.date}: ${en(seed?.war?.movement ?? movementName(c))} rises against ${name(m.of)} [${m.of}]`);
      else if (e.change === "crushed") now.push(`${name(m.of)} crushes the rising in ${label(c)}`);
      else if (e.change === "agreement") now.push(`${name(m.of)} and the movement of ${label(c)} agree to end the war; independence is to follow`);
      else if (e.change === "talks") now.push(`${name(m.of)} opens talks on the independence of ${label(c)}${m.due ? `, set for ${m.due}` : ""}`);
      else if (e.change === "autonomy") now.push(`${name(m.of)} grants ${label(c)} self-government within a federation`);
      else if (e.change === "delayed") now.push(`${name(m.of)} puts off the independence of ${label(c)}`);
      else if (e.change === "refused") now.push(`${name(m.of)} refuses ${label(c)} independence`);
      else if (e.change === "demands") now.push(`a national movement in ${label(c)} demands independence from ${name(m.of)}`);
    }
    if (m.free) {
      const leader = m.free.how === "union" ? undefined : leaderFor(state, { ...c, ...(m.rising ? { movement: c.tag } : {}) }, m.free.date);
      now.push(
        m.free.how === "union"
          ? `${en(colonyName(c))} passes from ${name(m.of)} [${m.of}] to ${name(c.tag)} [${c.tag}] on ${m.free.date}`
          : `${label(c)} becomes independent of ${name(m.of)} [${m.of}] on ${m.free.date} (${HOW_EN[m.free.how]}${leader ? `; its first government: ${leader}` : "; its first leader is named next period"})`,
      );
    }
  }
  const live = colonies.filter((c) => !c.end);
  const wars = live.filter((c) => c.war && state.wars.some((w) => w.id === c.war));
  const freeNow = new Set(moves.filter((m) => m.free).map((m) => m.colony));
  const coming = historical(state)
    ? live
        .filter((c) => c.due && c.of !== state.player && !freeNow.has(c.id))
        .sort((a, b) => a.due!.localeCompare(b.due!))
        .slice(0, 8)
    : [];
  const mine = governs(state) ? live.filter((c) => c.of === state.player) : [];
  // States lately free that nobody leads yet: the game master names their first government.
  const unnamed = colonies.filter((c) => c.end && c.end.how !== "gone" && c.end.how !== "union" && yearsBetween(c.end.date, state.date) <= 3 && state.countries[c.tag] && !state.countries[c.tag].leader && c.tag !== state.player);
  if (!now.length && !wars.length && !coming.length && !mine.length && !unnamed.length) return [];
  const lines = ["", "DECOLONISATION (the engine's, already decided: tell what it brings this period as it is; never transfer a colony's land or create its state yourself – the engine does):"];
  if (now.length) lines.push(`- THIS PERIOD: ${now.join("; ")}.`);
  if (wars.length) lines.push(`- COLONIAL WARS: ${wars.map((c) => `${c.war} – ${name(c.movement ?? c.tag)} [${c.movement ?? c.tag}] against ${name(c.of)} in ${en(colonyName(c))}`).join("; ")}. The engine decides how each ends.`);
  if (coming.length) lines.push(`- COMING (history's days, a tendency): ${coming.map((c) => `${en(colonyName(c))} from ${name(c.of)} ${c.due} (${STAGE_EN[c.stage]})`).join("; ")}.`);
  if (unnamed.length) lines.push(`- NEW STATES WITHOUT A NAMED LEADER (name their first government in leaders, a real person of that country and time): ${unnamed.map((c) => `${name(c.tag)} [${c.tag}]`).join(", ")}.`);
  if (mine.length) {
    lines.push(
      `- THE PLAYER'S COLONIES (pressure 0–100, stage; the player answers by orders: hand over, delay, fight, or self-government in a federation): ${mine
        .map((c) => `${label(c)} ${Math.round(c.pressure)}, ${STAGE_EN[c.stage]}${c.course ? `, course ${c.course}` : ", no answer yet"}${c.due ? `, ${c.stage === "talks" ? "day set" : "history's day"} ${c.due}` : ""}`)
        .join("; ")}.`,
    );
  }
  return lines;
}

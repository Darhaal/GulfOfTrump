import { baseLevel, combatParts, combatPower, splitStrength } from "./arsenal";
import { yearOf } from "./calendar";
import { roll } from "./dice";
import { attacking, byYear, COUNTER_PACE, digEdge, LATE_SHARE, BOTCHED_PACE, POSTURE_EDGE, POSTURE_PACE, POSTURE_RANK, PREP_EDGE } from "./doctrine";
import { STEP_YEARS } from "./economy";
import { airUnits, armourUnits } from "./forces";
import { distanceKm, islandOf, LANDING_KM, railLevel } from "./provinces";
import type { GameState, MapIndex, MapRegion, Posture, Terrain, War, WeaponKind } from "./types";
import { frontMeans, type FrontMeans } from "./warMeans";

/**
 * Fronts the game master leaves alone still move. In a war being fought (no
 * truce), the balance of strength where the front runs sets how it goes this
 * period: the stronger side gains ground in the provinces the front runs
 * through and breaks into new ones next to its own, the weaker yields; in an
 * even fight the defender has the edge, and mountains, forests, marshes,
 * rivers and the lack of railways slow an attacker.
 *
 * Strength is soldiers and heavy weapons (engine/arsenal.ts combatPower),
 * spread along every front a country fights on, so a long front is a thin
 * one; at a province, each side counts the members that hold it, fight in it
 * or hold land next to it, and what its members far from it send. Each
 * member has one budget: a quarter of it (FAR) goes to the theatres of its
 * wars it holds nothing in, split between them by their fronts, and the rest
 * stands where it fights – never more than its whole power in all. Its tanks
 * and guns weigh where its formations mass them (`mass`, engine/formations.ts):
 * a sector it attacks from has more of them, man for man, and its armour edge
 * there with them.
 *
 * The pace follows the odds and the means of manoeuvre. It is counted in
 * land, not in provinces: points a month of a province of PACE_KM2 (a
 * hundred kilometres across, so a point is about a kilometre), each province
 * giving up as many of its own points as its depth against that one allows
 * (paceScale), and breakthroughs and pursuits counted by the land they take,
 * so a front moves as far in a month on a map of small provinces as on one
 * of large ones. An even fight is
 * attrition, a few points of a province a month, as in 1915 or 2022; past
 * about two to one an attacker breaks through, and with the odds
 * overwhelming it pursues, whole provinces falling in weeks. How fast it
 * runs once through is the era's motorisation, and how free it is to run is
 * its armour against the enemy's, its aircraft against the enemy's aircraft
 * and air defence, and the enemy's drones that see every column (MOBILITY):
 * tanks the enemy cannot stop and command of the air also count as more
 * strength (SHOCK). A defender whose will is breaking or that is encircled
 * gives ground faster; rough ground slows manoeuvre more than it slows a
 * grinding advance.
 *
 * A side's strength at a province also falls with its depth in enemy land:
 * the hops from the nearest province of its own it holds, so an offensive
 * that runs far from home runs short of supplies (SUPPLY). And a war wears
 * its armies down: the longer it has lasted, the slower its fronts move
 * (EXHAUSTION), so a long war settles into lines that weariness and peace
 * plans can end.
 *
 * What of its power a country brings to a front also depends on its means
 * (engine/warMeans.ts): how ready its army is, how far the front lies from
 * home and across what sea, its will to fight, and the troops its own
 * occupations tie down; a defender fights harder on its own soil, and
 * partisans behind a side's lines cut its supply. An attacker short of the
 * means fights for limited aims: it breaks into the enemy's land only next to
 * its own.
 *
 * A war whose front has no fight in it at all sees the side that started it
 * probe the enemy's line now and then, unless it is hopelessly weaker.
 *
 * A line that has stood for months digs in (engine/doctrine.ts digEdge): an
 * attack needs that much more edge to gain ground there, most in 1915–17, in
 * Korea's second year and since 2015. And each side fights by its formations'
 * postures (engine/formations.ts, `Stances`): a formation holding its line
 * gains no ground but clears a lodgement in it, one probing gains a little, an
 * offensive what the balance allows, an all-out assault a little more with
 * everything thrown in, and one withdrawing gives ground; without formations
 * every side attacks wherever it can, as before.
 *
 * No side gains ground where none of its members reaches (NO_REACH): a
 * landing on one part of an island takes what its ships keep supplied, not
 * the island's other parts beyond them.
 *
 * The engine moves only provinces the turn's answer did not name: where the
 * answer moved a war's front, the rest of it only drifts, and the game
 * master's offensives are its own. The dice are seeded by the game, the turn
 * and the province, so the server and the browser agree.
 */

/**
 * The province a front's pace is counted in, km²: a hundred kilometres
 * across (about the median province), so a point of it a month is about a
 * kilometre. A smaller province gives up more of its own points for the
 * same advance, a larger one fewer: by the root of the areas (its depth).
 */
export const PACE_KM2 = 10_000;
/** The bounds of that scale: a city province does not fall in a day, nor a Siberian one in a decade. */
const PACE_SCALE_MIN = 0.25;
const PACE_SCALE_MAX = 3;

/** Points of a province for each point of the reference province an advance makes: its depth against PACE_KM2's (1 without an area). */
export function paceScale(p: Pick<MapRegion, "area"> | undefined): number {
  if (!p?.area || p.area <= 0) return 1;
  return Math.min(PACE_SCALE_MAX, Math.max(PACE_SCALE_MIN, Math.sqrt(PACE_KM2 / p.area)));
}

/** How deep a province is against the reference one: what crossing it counts for in a pursuit or a line of supply. */
const depthIn = (p: Pick<MapRegion, "area"> | undefined) => 1 / paceScale(p);

/** The largest edge counted, in doublings (16 : 1). */
const MAX_EDGE = 4;
/** Points of a province a month at one doubling of strength beyond the defender's edge, the grinding part of an advance; it grows faster than the edge (CURVE). */
const RATE = 10;
const CURVE = 1.3;
/** Manoeuvre: points a month at one doubling beyond BREAK, at full motorisation and freedom; it grows as the 1.5th power, up to MAX_RUN doublings. */
const MANOEUVRE = 320;
const BREAK = 0.5;
const MAX_RUN = 2.5;
/** Doublings of strength that tanks the enemy cannot stop and command of the air add, at a full edge in the means of manoeuvre. */
const SHOCK = 0.8;
/** The dice's spread on a contested province's share, points a month (at the square root of the months). */
const SPREAD = 3;
/** Breakthroughs a side makes a month along one war's front, in provinces of PACE_KM2 (a smaller one counts for less, at least LEAST_BREAK): in attrition, and the most in pursuit. */
const BREAKS_MONTH = 3;
const MAX_BREAKS_MONTH = 24;
/** More of them once a pursuit is on (a pace past 60 points a month): a front in rout opens everywhere at once. */
const PURSUIT_BREAKS = 28;
const LEAST_BREAK = 0.25;
/** How far a pursuit runs in one period: provinces of PACE_KM2 overrun one after another (the first and two more). */
const PURSUIT_DEPTH = 3;
/** Below this reach a pursuit runs no further: no army is supplied there (tests/support/stats.ts IMPOSSIBLE_REACH). */
const NO_REACH = 0.15;
/** The part of a period a breakthrough spends advancing once it is in: the rest goes on breaking in. */
const ADVANCING = 0.8;
/** The most a breakthrough takes of a province it does not overrun. */
const MAX_OPENING = 90;
/** A contest's share beyond which the province falls, and below which its attacker is driven out (as in engine/outcome.ts). */
const FALLS = 95;
const DRIVEN_OUT = 5;
/** The share of a member's power that goes to the theatres of its wars it holds nothing in, split between them. */
const FAR = 0.25;
/** How much more of its tanks, guns and aircraft a formation draws than one holding, man for man; an all-out assault more again (engine/formations.ts shares them out the same way). */
export const MASSED: Record<Posture, number> = { withdraw: 0.5, hold: 1, probe: 1.5, offensive: 3, assault: 4 };
/** A side's strength for each province of PACE_KM2's depth into enemy land past the second, from the nearest province of its own it holds. */
const SUPPLY = 0.88;
/** Years of war that halve the pace of its fronts. */
const EXHAUSTION = 4;
/** Below this will to fight a side starts to break: its enemy gains up to (1 + COLLAPSE) times as fast at a will of ten. */
const BREAKING = 40;
const COLLAPSE = 1.5;

/** How hard each terrain is to attack across: plains are open, mountains hold. */
const TERRAIN: Record<Terrain, number> = { plains: 1, desert: 0.9, hills: 0.75, forest: 0.7, tundra: 0.6, wetlands: 0.55, jungle: 0.5, mountains: 0.45 };

/** How much a province slows an attacker: terrain, a major river, and no railway to bring supplies up. */
export function going(p: MapRegion | undefined): number {
  if (!p) return 0.8;
  let k = TERRAIN[p.terrain] ?? 0.8;
  if (p.rv?.length) k *= 0.85;
  if (railLevel(p) === "none") k *= 0.85;
  return k;
}

/** How fast an army moves once nothing stops it: on foot and by rail, then by lorry and half-track, then fully mechanised. */
export const motorisation = (year: number) =>
  byYear(
    [
      [1900, 0.4],
      [1918, 0.5],
      [1939, 0.85],
      [1950, 1],
      [1990, 1.1],
    ],
    year,
  );

/**
 * The edge, in doublings, an attacker needs to gain ground at all: machine
 * guns and artillery held every line until tanks and aircraft could break
 * them; precision fires and drones that see every column hold them again.
 */
export const defenceOf = (year: number) =>
  byYear(
    [
      [1914, 0.45],
      [1930, 0.45],
      [1939, 0.35],
      [2005, 0.35],
      [2015, 0.75],
    ],
    year,
  );

/** What a side brings to manoeuvre at a war's front: tanks per thousand soldiers (by type), aircraft in the fight for the air (fighters above all), air defence weighed against them, and drones per thousand soldiers, each by its level against the day's. */
export interface SideManoeuvre {
  armour: number;
  air: number;
  airDefence: number;
  drones: number;
}

/** A side's means of manoeuvre against the other's: the edge in armour and in the air (0–1 each), and in all (0–1.1), cut by the enemy's drones. */
export interface MobilityEdge {
  armour: number;
  air: number;
  edge: number;
}

/** One weapon's weight against the day's level. */
const levelled = (n: number, level: number, kind: WeaponKind, year: number) => n * 1.6 ** (level - Math.max(1, baseLevel(kind, year)));

/** A side's means of manoeuvre, each member counted by `share`: the part of its army that reaches the front. */
export function sideManoeuvre(state: Pick<GameState, "countries" | "date">, side: string[], share: (tag: string) => number): SideManoeuvre {
  const year = yearOf(state.date);
  let men = 0;
  let tanks = 0;
  let air = 0;
  let airDefence = 0;
  let drones = 0;
  for (const tag of side) {
    const c = state.countries[tag];
    const k = share(tag);
    if (!c || k <= 0) continue;
    const s = c.arsenal?.stock ?? {};
    men += (c.economy?.troops ?? 0) * k;
    // Tanks as a breakthrough weighs them, aircraft as the fight for the air does: fighters above all (engine/forces.ts).
    if (s.tanks?.n) tanks += levelled(armourUnits(s.tanks, year), s.tanks.level, "tanks", year) * k;
    if (s.aircraft?.n) air += levelled(airUnits(s.aircraft, year), s.aircraft.level, "aircraft", year) * k;
    // An anti-aircraft gun of 1939 denies the air less than a missile battery of today.
    if (s.airDefence?.n) airDefence += s.airDefence.n * 0.15 * 2 ** (s.airDefence.level - 2) * k;
    if (s.drones?.n) drones += levelled(s.drones.n, s.drones.level, "drones", year) * k;
  }
  const per = Math.max(1, men);
  return { armour: tanks / per, air, airDefence, drones: drones / per };
}

/** The edge of one side's means of manoeuvre over the other's. */
export function mobilityEdge(mine: SideManoeuvre, theirs: SideManoeuvre, year: number): MobilityEdge {
  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
  const armour = clamp01(Math.log2((mine.armour + 0.3) / (theirs.armour + 0.3)) / 2.5);
  const air = clamp01(Math.log2((mine.air + 1) / (theirs.air + theirs.airDefence + 1)) / 3);
  return { armour, air, edge: (motorisation(year) * (armour + air)) / 2 / (1 + theirs.drones) };
}

/** A front move the engine makes: a province's new share for the side in "to", its fall, or its attacker driven out ("occupy" by the holder). */
export interface FrontMove {
  region: string;
  to: string;
  mode: "contest" | "occupy";
  share?: number;
}

/** Wars being fought now. */
const fought = (state: Pick<GameState, "wars">) => state.wars.filter((w) => !w.truce);

/** The provinces of a war's front: those each side holds next to the other's, and those the front runs through. */
export function warFront(state: Pick<GameState, "regions">, index: Pick<MapIndex, "neighbors">, war: Pick<War, "attackers" | "defenders">): string[] {
  const a = new Set(war.attackers);
  const d = new Set(war.defenders);
  const out: string[] = [];
  for (const [id, r] of Object.entries(state.regions)) {
    const enemy = a.has(r.controller) ? d : d.has(r.controller) ? a : null;
    if (!enemy) continue;
    if ((r.contested && enemy.has(r.contested)) || (index.neighbors[id] ?? []).some((n) => state.regions[n] && enemy.has(state.regions[n].controller))) out.push(id);
  }
  return out;
}

/** How a side advances at one province: the edge it fights at (manoeuvre included), the doublings past what it needs, points of the province a month, and the same pace in points of a province of PACE_KM2 (about kilometres). */
export interface Advance {
  edge: number;
  surplus: number;
  rate: number;
  pace: number;
}

type StrengthState = Pick<GameState, "countries" | "regions" | "wars" | "date"> & Partial<Pick<GameState, "chronicle" | "scenarioId" | "player" | "politics" | "alliances" | "step" | "plans">>;

/**
 * The strength of the fighting at each front: every country's power, as far
 * as its means bring it to the fighting, spread over the front provinces it
 * holds or fights in, across all its wars; and how fast each side can
 * advance at a province.
 */
export function frontStrength(state: StrengthState, index: Pick<MapIndex, "neighbors"> & Partial<Pick<MapIndex, "regions" | "coasts">>) {
  const fronts = new Map<string, string[]>(fought(state).map((w) => [w.id, warFront(state, index, w)]));
  const posts = new Map<string, Set<string>>();
  const post = (tag: string, id: string) => {
    const set = posts.get(tag) ?? new Set<string>();
    set.add(id);
    posts.set(tag, set);
  };
  for (const ids of fronts.values()) {
    for (const id of ids) {
      const r = state.regions[id];
      post(r.controller, id);
      if (r.contested) post(r.contested, id);
    }
  }
  const means = frontMeans(state, index);
  const year = yearOf(state.date);
  const defence = defenceOf(year);
  const motor = motorisation(year);
  const power = new Map<string, number>();
  const powerOf = (tag: string) => {
    let p = power.get(tag);
    if (p === undefined) power.set(tag, (p = combatPower(state, tag) * means.force(tag)));
    return p;
  };
  /** A country's strength at one of its front provinces: what it does not send to the theatres it is absent from, spread over its posts. */
  const density = (tag: string) => (powerOf(tag) * (posts.has(tag) && absentHolding(tag).all > 0 ? 1 - FAR : 1)) / Math.max(1, posts.get(tag)?.size ?? 0);
  /** Whether a country fights at a province: it holds it, fights in it, or holds land next to it. */
  const present = (tag: string, id: string) => {
    const r = state.regions[id];
    return r.controller === tag || r.contested === tag || (index.neighbors[id] ?? []).some((n) => state.regions[n]?.controller === tag);
  };
  /** How deep each province a side holds lies from the nearest province of its own it holds, by side: in provinces of PACE_KM2, along the fewest hops. */
  const depths = new Map<string, Map<string, number>>();
  const depthOf = (side: string[]) => {
    const key = [...side].sort().join("+");
    let d = depths.get(key);
    if (d) return d;
    d = new Map<string, number>();
    const mine = new Set(side);
    let edge: string[] = [];
    for (const [id, r] of Object.entries(state.regions)) {
      if (mine.has(r.owner) && mine.has(r.controller)) {
        d.set(id, 0);
        edge.push(id);
      }
    }
    while (edge.length) {
      const next: string[] = [];
      for (const id of edge) {
        for (const n of index.neighbors[id] ?? []) {
          if (d.has(n) || !state.regions[n] || !mine.has(state.regions[n].controller)) continue;
          d.set(n, d.get(id)! + depthIn(index.regions?.[n]));
          next.push(n);
        }
      }
      edge = next;
    }
    depths.set(key, d);
    return d;
  };
  /** How well a side is supplied at a province: full near its own land, less the deeper it stands in the enemy's. */
  const supply = (side: string[], id: string) => {
    const d = depthOf(side);
    const r = state.regions[id];
    let depth = side.includes(r.controller) ? d.get(id) : undefined;
    if (depth === undefined) for (const n of index.neighbors[id] ?? []) if (d.has(n)) depth = Math.min(depth ?? Infinity, d.get(n)! + depthIn(index.regions?.[id]));
    return SUPPLY ** Math.max(0, (depth ?? 2) - 2);
  };
  /**
   * A war's theatres: the parts of its front joined by land or a narrow
   * strait. A member fighting in one theatre is far from another – the
   * Soviet army on Malta does not stand in Vietnam – and the game master
   * leading one leaves the others to the engine.
   */
  const theatres = new Map<string, Map<string, number>>();
  const theatreMap = (war: Pick<War, "id">) => {
    let label = theatres.get(war.id);
    if (label) return label;
    label = new Map<string, number>();
    const front = new Set(fronts.get(war.id) ?? []);
    let n = 0;
    for (const id of front) {
      if (label.has(id)) continue;
      n += 1;
      label.set(id, n);
      const queue = [id];
      while (queue.length) {
        const x = queue.pop()!;
        for (const y of [...(index.neighbors[x] ?? []), ...means.across(x)]) {
          if (!front.has(y) || label.has(y)) continue;
          label.set(y, n);
          queue.push(y);
        }
      }
    }
    theatres.set(war.id, label);
    return label;
  };
  const theatreOf = (war: Pick<War, "id">, id: string) => theatreMap(war).get(id);
  /** Whether a member is far from a province of a war's front: it holds and fights in none of that theatre, or in no front at all. */
  const farFrom = (war: Pick<War, "id">, tag: string, id: string) => {
    const theatre = theatreOf(war, id);
    return !posts.has(tag) || (theatre !== undefined && !presentIn(war, theatre).has(tag));
  };
  /**
   * A member's far share is split over the front provinces its sides hold in the theatres it is absent from, across all its
   * wars: how many there are in all, and in each war.
   */
  const absents = new Map<string, { all: number; byWar: Map<string, number> }>();
  const absentHolding = (tag: string) => {
    let a = absents.get(tag);
    if (a) return a;
    a = { all: 0, byWar: new Map() };
    for (const w of fought(state)) {
      const side = w.attackers.includes(tag) ? w.attackers : w.defenders.includes(tag) ? w.defenders : null;
      if (!side) continue;
      let n = 0;
      for (const id of fronts.get(w.id) ?? []) if (side.includes(state.regions[id].controller) && farFrom(w, tag, id)) n += 1;
      if (n) a.byWar.set(w.id, n);
      a.all += n;
    }
    absents.set(tag, a);
    return a;
  };
  /** The part of a member's budget one war has: its posts on that war's front and its far share there. */
  const warShares = new Map<string, number>();
  const warShare = (war: Pick<War, "id">, tag: string) => {
    const key = `${war.id}|${tag}`;
    let k = warShares.get(key);
    if (k !== undefined) return k;
    const mine = posts.get(tag);
    const far = absentHolding(tag);
    const count = (warId: string) => (mine ? (fronts.get(warId) ?? []).filter((x) => mine.has(x)).length : 0);
    const total = fought(state).filter((w) => w.attackers.includes(tag) || w.defenders.includes(tag)).reduce((sum, w) => sum + count(w.id), 0);
    k = (total > 0 ? ((far.all > 0 ? 1 - FAR : 1) * count(war.id)) / total : 0) + (far.all > 0 ? (FAR * (far.byWar.get(war.id) ?? 0)) / far.all : 0);
    warShares.set(key, k);
    return k;
  };
  // Where the formations mass their tanks and guns: each member's share of its heavy weapons at a sector against an even one (`mass`).
  const massed = new Map<string, number>();
  const heavies = new Map<string, number>();
  /** The share of a country's power in its tanks and guns: what massing moves (its aircraft fly over every sector). */
  const heavyShare = (tag: string) => {
    let h = heavies.get(tag);
    if (h === undefined) {
      const parts = combatParts(state, tag);
      h = parts.men + parts.heavy > 0 ? parts.massed / (parts.men + parts.heavy) : 0;
      heavies.set(tag, h);
    }
    return h;
  };
  /** What massing does at a sector: its share of the heavy weapons against an even one, with diminishing returns – the roads, the frontage and the enemy's reserves take their part. */
  const massAt = (war: Pick<War, "id">, tag: string, id: string) => Math.sqrt(massed.get(`${war.id}|${tag}|${id}`) ?? 1);
  /** A side's massing at a province: its member holding or fighting in it, else its most massed member attacking it. */
  const sideMass = (war: Pick<War, "id">, side: string[], id: string) => {
    if (!massed.size) return 1;
    const r = state.regions[id];
    const own = side.includes(r?.controller ?? "") ? r.controller : r?.contested && side.includes(r.contested) ? r.contested : undefined;
    if (own) return massAt(war, own, id);
    return Math.max(...side.map((tag) => massAt(war, tag, id)));
  };
  /** The members that hold or fight in a province of a theatre. */
  const inTheatre = new Map<string, Set<string>>();
  const presentIn = (war: Pick<War, "id">, theatre: number) => {
    const key = `${war.id}|${theatre}`;
    let set = inTheatre.get(key);
    if (!set) {
      set = new Set<string>();
      for (const [id, t] of theatreMap(war)) {
        if (t !== theatre) continue;
        set.add(state.regions[id].controller);
        if (state.regions[id].contested) set.add(state.regions[id].contested!);
      }
      inTheatre.set(key, set);
    }
    return set;
  };
  /** Thousand soldiers behind each unit of a country's strength: what the frontage and the lift count in. */
  const troopsPer = (tag: string) => {
    const p = powerOf(tag);
    return p > 0 ? (state.countries[tag]?.economy?.troops ?? 0) / p : 0;
  };
  /**
   * A member's strength at a province within what its lift lands there (a landing on a hostile shore), and on an island
   * as far as its side's command of the sea and the air keeps it supplied (engine/warMeans.ts).
   */
  const landed = (tag: string, side: string[], enemy: string[], id: string, raw: number) => {
    if (raw <= 0) return 0;
    const k = means.overseas(tag, id, side, enemy);
    const cap = means.lift(tag, id, side, enemy);
    if (!(cap < Infinity)) return raw * k;
    const per = troopsPer(tag);
    return (per > 0 ? Math.min(raw, cap / per) : raw) * k;
  };
  /**
   * What one member of a side brings to a province of a war's front, before the side's supply, home soil and partisans:
   * spread over its front provinces where it fights in the province's theatre; a share of what it can send where it fights
   * in none of it; and onto a hostile shore no more than its lift lands.
   */
  const brings = (war: Pick<War, "id">, tag: string, side: string[], enemy: string[], id: string) => {
    if (farFrom(war, tag, id)) return landed(tag, side, enemy, id, (powerOf(tag) * means.reach(tag, id, side, enemy) * FAR) / Math.max(1, absentHolding(tag).all));
    if (!present(tag, id)) return 0;
    // Its tanks and guns where its formations mass them: more where it attacks, fewer where it holds.
    const h = heavyShare(tag);
    return landed(tag, side, enemy, id, density(tag) * (1 - h + h * massAt(war, tag, id)) * means.reach(tag, id, side, enemy));
  };
  /** What multiplies a whole side's strength at a province: supply, home soil, partisans behind it. */
  const sideFactor = (side: string[], id: string) => supply(side, id) * means.home(side, id) * means.partisans(side, id);
  /** What of each member's strength fits in a province: no more soldiers than its frontage holds (engine/warMeans.ts FRONTAGE), all scaled alike. */
  const fitted = (side: string[], enemy: string[], id: string, each: number[]) => {
    // The soldiers there, before what the sea and the air do to their supply.
    const troops = side.reduce((sum, tag, i) => sum + (each[i] ? (each[i] * troopsPer(tag)) / means.overseas(tag, id, side, enemy) : 0), 0);
    const cap = means.frontage(id);
    return troops > cap ? cap / troops : 1;
  };
  /** A side's strength at a province of a war's front against `enemy`: what reaches it from each member's home, on its own soil or not, with partisans behind it or not. */
  const strengths = new Map<string, number>();
  const at = (war: Pick<War, "id">, side: string[], enemy: string[], id: string) => {
    const key = `${war.id}|${side.join("+")}|${id}`;
    let v = strengths.get(key);
    if (v === undefined) {
      const each = side.map((tag) => brings(war, tag, side, enemy, id));
      strengths.set(key, (v = each.reduce((a, b) => a + b, 0) * fitted(side, enemy, id, each) * sideFactor(side, id)));
    }
    return v;
  };
  /** Each member's strength at a province: what it brings, within the frontage, times its side's supply, home soil and partisans. */
  const members = (war: Pick<War, "id">, side: string[], enemy: string[], id: string) => {
    const each = side.map((tag) => brings(war, tag, side, enemy, id));
    const k = sideFactor(side, id) * fitted(side, enemy, id, each);
    return side.map((tag, i) => ({ tag, strength: each[i] * k }));
  };
  /**
   * A landing's strength at an enemy-held province no front reaches yet: each member of `side` as if it fought there too
   * (its strength spread over one more province), within its reach and its lift; or, for the holder's side, its members
   * there or next to it, likewise spread over one more province. Within the frontage, with supply, home soil and partisans.
   */
  const landingAt = (side: string[], enemy: string[], id: string, holding: boolean) => {
    const each = side.map((tag) => {
      if (holding && !present(tag, id)) return 0;
      return landed(tag, side, enemy, id, (powerOf(tag) / ((posts.get(tag)?.size ?? 0) + 1)) * means.reach(tag, id, side, enemy));
    });
    return each.reduce((a, b) => a + b, 0) * fitted(side, enemy, id, each) * sideFactor(side, id);
  };
  /** The edge of `side` over `other` at a province, in doublings within ±MAX_EDGE. */
  const edge = (war: Pick<War, "id">, side: string[], other: string[], id: string) =>
    Math.max(-MAX_EDGE, Math.min(MAX_EDGE, Math.log2((at(war, side, other, id) + 1) / (at(war, other, side, id) + 1))));

  // The means of manoeuvre of each side of each war, each member by the share of its army that reaches the front.
  const mobility = new Map<string, { attackers: SideManoeuvre; defenders: SideManoeuvre }>();
  const manoeuvreOf = (war: Pick<War, "id" | "attackers" | "defenders">) => {
    let m = mobility.get(war.id);
    if (m) return m;
    const front = fronts.get(war.id) ?? [];
    // Reach at a few provinces along the front, evenly spaced.
    const sample = front.length <= 8 ? front : Array.from({ length: 8 }, (_, i) => front[Math.floor((i * front.length) / 8)]);
    // Each member by the part of its budget this war has – its posts on this front and its far share here – as to the front's strength.
    const share = (side: string[], enemy: string[]) => (tag: string) =>
      means.force(tag) * warShare(war, tag) * (sample.length ? sample.reduce((s, id) => s + means.reach(tag, id, side, enemy), 0) / sample.length : 1);
    m = { attackers: sideManoeuvre(state, war.attackers, share(war.attackers, war.defenders)), defenders: sideManoeuvre(state, war.defenders, share(war.defenders, war.attackers)) };
    mobility.set(war.id, m);
    return m;
  };
  /** The edge of one side's means of manoeuvre over the other's in a war. */
  const mobilityOf = (war: Pick<War, "id" | "attackers" | "defenders">, side: string[]): MobilityEdge => {
    const m = manoeuvreOf(war);
    const mine = side === war.attackers ? m.attackers : m.defenders;
    const theirs = side === war.attackers ? m.defenders : m.attackers;
    return mobilityEdge(mine, theirs, year);
  };
  /** The edge of one side's means of manoeuvre at a province: each side's armour as its formations there massed it. */
  const mobilityAt = (war: Pick<War, "id" | "attackers" | "defenders">, side: string[], id: string): MobilityEdge => {
    if (!massed.size) return mobilityOf(war, side);
    const m = manoeuvreOf(war);
    const other = side === war.attackers ? war.defenders : war.attackers;
    const mine = side === war.attackers ? m.attackers : m.defenders;
    const theirs = side === war.attackers ? m.defenders : m.attackers;
    return mobilityEdge({ ...mine, armour: mine.armour * sideMass(war, side, id) }, { ...theirs, armour: theirs.armour * sideMass(war, other, id) }, year);
  };
  /** How free a side is to run once through: its armour and air edge, cut by the enemy's drones. */
  const freedomOf = (war: Pick<War, "id" | "attackers" | "defenders">, side: string[]) => {
    const m = manoeuvreOf(war);
    const theirs = side === war.attackers ? m.defenders : m.attackers;
    const e = mobilityOf(war, side);
    return (0.3 + (0.7 * (e.armour + e.air)) / 2) / (1 + theirs.drones);
  };
  /** How much faster a side gives ground where it is breaking: its will to fight, and how surrounded the province is. */
  const collapse = (losing: string[], winning: string[], id: string) => {
    const r = state.regions[id];
    const principal = losing.includes(r.controller) ? r.controller : r.contested && losing.includes(r.contested) ? r.contested : losing[0];
    const will = means.will(principal);
    const breaking = 1 + COLLAPSE * Math.min(1, Math.max(0, (BREAKING - will) / (BREAKING - 10)));
    const around = (index.neighbors[id] ?? []).filter((n) => state.regions[n]);
    const theirs = around.filter((n) => winning.includes(state.regions[n].controller)).length;
    const surrounded = around.length ? 1 + 2 * Math.max(0, theirs / around.length - 0.5) : 1;
    return Math.min(3, breaking * surrounded);
  };
  const years = (war: Pick<War, "since">) => Math.max(0, (Date.parse(state.date) - Date.parse(war.since)) / (365.25 * 86400000));
  /** How a long war has worn its armies down. */
  const tiredOf = (war: Pick<War, "since">) => 1 / (1 + years(war) / EXHAUSTION);
  /** Points of a province of PACE_KM2 a month at `s` doublings beyond what is needed: the grind, and manoeuvre once through. */
  const rateAt = (s: number, go: number, freedom: number) => {
    if (s <= 0) return 0;
    const run = Math.min(MAX_RUN, Math.max(0, s - BREAK));
    return RATE * s ** CURVE * go + MANOEUVRE * motor * run ** 1.5 * go ** 1.5 * freedom;
  };
  /**
   * How `side` advances at a province against `other`: the edge it fights at
   * with its means of manoeuvre, the doublings past the defender's edge (or,
   * holding the province, past none), and points a month with the terrain,
   * the enemy breaking and the war's weariness – of a province of PACE_KM2
   * (`pace`) and of this one (`rate`, by its depth). `base` gives the edge
   * instead, for a province beyond the front an advance runs into.
   */
  const advances = new Map<string, Advance>();
  const advance = (war: War, side: string[], other: string[], id: string, holds: boolean, base?: number, extra = 0): Advance => {
    const key = base === undefined ? `${war.id}|${side.join("+")}|${id}|${holds}|${extra}` : "";
    const known = key ? advances.get(key) : undefined;
    if (known) return known;
    const a = advanceAt(war, side, other, id, holds, base, extra);
    if (key) advances.set(key, a);
    return a;
  };
  /** What an attack needs at a province, in doublings: the era's defence and what the line's age has dug in. */
  const needAt = (id: string) => defence + digEdge(state.regions[id]?.dug, year);
  const advanceAt = (war: War, side: string[], other: string[], id: string, holds: boolean, base?: number, extra = 0): Advance => {
    const e = (base ?? edge(war, side, other, id) + SHOCK * (mobilityAt(war, side, id).edge - mobilityAt(war, other, id).edge)) + extra;
    // A lodgement dug in is as hard to clear as a line to break: between the two the line stands.
    const dig = digEdge(state.regions[id]?.dug, year);
    const surplus = holds ? e + defence - dig : e - defence - dig;
    // The holder knows its ground: rough ground slows its counterstrokes less than an attacker's advance.
    const go = going(index.regions?.[id]);
    const pace = rateAt(surplus, holds ? 1 : go, freedomOf(war, side)) * (holds ? go ** 0.5 : 1) * collapse(other, side, id) * tiredOf(war);
    return { edge: e, surplus, rate: pace * paceScale(index.regions?.[id]), pace };
  };
  /** How a landing on an enemy-held province no front reaches would go: the edge of what `side` can land against the garrison, with the means of manoeuvre. */
  const landing = (war: War, side: string[], other: string[], id: string): Advance => {
    const e = Math.max(-MAX_EDGE, Math.min(MAX_EDGE, Math.log2((landingAt(side, other, id, false) + 1) / (landingAt(other, side, id, true) + 1)))) + SHOCK * (mobilityOf(war, side).edge - mobilityOf(war, other).edge);
    const surplus = e - defence;
    const go = going(index.regions?.[id]);
    const pace = rateAt(surplus, go, freedomOf(war, side)) * tiredOf(war);
    return { edge: e, surplus, rate: pace * paceScale(index.regions?.[id]), pace };
  };
  /**
   * The turn's formations mass their tanks and guns where they attack (engine/formations.ts): each member's heavy weapons at
   * a sector by its formation's posture against its others, man for man, at the provinces it holds and attacks. The
   * readings made before are read again.
   */
  const mass = (units: TurnUnits) => {
    massed.clear();
    for (const [warId, list] of Object.entries(units)) {
      const byTag = new Map<string, FieldUnit[]>();
      for (const u of list) (byTag.get(u.tag) ?? byTag.set(u.tag, []).get(u.tag)!).push(u);
      for (const [tag, mine] of byTag) {
        const men = (u: FieldUnit) => u.men ?? u.sector.length;
        const all = mine.reduce((sum, u) => sum + men(u), 0);
        const weight = mine.reduce((sum, u) => sum + men(u) * MASSED[u.posture], 0);
        if (all <= 0 || weight <= 0) continue;
        const own = new Set(mine.flatMap((u) => u.sector));
        for (const u of mine) {
          const k = (MASSED[u.posture] * all) / weight;
          for (const id of u.sector) massed.set(`${warId}|${tag}|${id}`, k);
          // The provinces it attacks from its sector: its target and the enemy's next to its line, by its most massed formation there.
          for (const id of [...(u.target ? [u.target] : []), ...u.sector.flatMap((x) => index.neighbors[x] ?? [])]) {
            if (own.has(id)) continue;
            const key = `${warId}|${tag}|${id}`;
            massed.set(key, Math.max(massed.get(key) ?? 0, k));
          }
        }
      }
    }
    strengths.clear();
    advances.clear();
  };
  return { fronts, edge, at, members, powerOf, means, mobilityOf, mobilityAt, manoeuvreOf, supply, advance, landing, theatreOf, tiredOf, defence, motor, needAt, mass };
}

export type FrontStrength = ReturnType<typeof frontStrength>;

/** Each side's whole strength in a war, for the game master: the members' power, split between the wars each fights. */
export function warStrength(state: Pick<GameState, "countries" | "wars" | "date">, war: Pick<War, "attackers" | "defenders">): { attackers: number; defenders: number } {
  return splitStrength(state, war);
}

/** A war's pace: the fronts barely moving, a grind of a few points a month, a breakthrough, or a pursuit with provinces falling in weeks. */
export type PacePhase = "stalemate" | "attrition" | "breakthrough" | "pursuit";
/** Why a front moves as it does, for the game master and the war panel. */
export type PaceReason = "odds" | "even" | "armour" | "air" | "terrain" | "collapse" | "weary" | "drones" | "home";

export interface WarPace {
  phase: PacePhase;
  /** The side that gains ground, if any does. */
  side: "attackers" | "defenders" | null;
  /** Its pace at its best sectors, points of a province of PACE_KM2 a month (about kilometres). */
  rate: number;
  /** Its strength against the enemy's there, as "n : 1". */
  odds: number;
  reasons: PaceReason[];
}

/** Points of a province of PACE_KM2 a month that set each phase. */
const PHASES: [PacePhase, number][] = [
  ["pursuit", 150],
  ["breakthrough", 40],
  ["attrition", 4],
];

/**
 * How one war's fronts move, read from the provinces the front runs through
 * and the sectors either side could break into: the side gaining ground at
 * its three best, the phase its pace makes, and the reasons, the strongest
 * first. Null for a war with no shared land front.
 */
export function warPace(state: StrengthState, index: Pick<MapIndex, "neighbors"> & Partial<Pick<MapIndex, "regions">>, war: War, strength: FrontStrength = frontStrength(state, index)): WarPace | null {
  const front = strength.fronts.get(war.id) ?? (war.truce ? warFront(state, index, war) : []);
  if (!front.length) return null;
  const sides = { attackers: war.attackers, defenders: war.defenders } as const;
  const sideOf = (tag: string) => (war.attackers.includes(tag) ? "attackers" : war.defenders.includes(tag) ? "defenders" : null);
  const best = { attackers: [] as { a: Advance; id: string }[], defenders: [] as { a: Advance; id: string }[] };
  for (const id of front) {
    const r = state.regions[id];
    const holder = sideOf(r.controller);
    if (!holder) continue;
    const enemy = holder === "attackers" ? "defenders" : "attackers";
    if (r.contested && sideOf(r.contested) === enemy) {
      best[enemy].push({ a: strength.advance(war, sides[enemy], sides[holder], id, false), id });
      best[holder].push({ a: strength.advance(war, sides[holder], sides[enemy], id, true), id });
    } else {
      // A sector the enemy could break into from its land next door.
      if ((index.neighbors[id] ?? []).some((n) => state.regions[n] && sideOf(state.regions[n].controller) === enemy)) best[enemy].push({ a: strength.advance(war, sides[enemy], sides[holder], id, false), id });
    }
  }
  const top = (list: { a: Advance; id: string }[]) => {
    const sorted = [...list].sort((x, y) => y.a.pace - x.a.pace).slice(0, 3);
    return { rate: sorted.length ? sorted.reduce((s, x) => s + x.a.pace, 0) / sorted.length : 0, list: sorted };
  };
  const a = top(best.attackers);
  const d = top(best.defenders);
  const lead = a.rate >= d.rate ? "attackers" : "defenders";
  const winner = lead === "attackers" ? a : d;
  const rate = winner.rate;
  const phase = PHASES.find(([, min]) => rate >= min)?.[0] ?? "stalemate";
  const mine = sides[lead];
  const theirs = sides[lead === "attackers" ? "defenders" : "attackers"];
  const ids = winner.list.map((x) => x.id);
  const odds = ids.length ? ids.reduce((s, id) => s + 2 ** strength.edge(war, mine, theirs, id), 0) / ids.length : 1;
  const reasons: PaceReason[] = [];
  const mob = strength.mobilityOf(war, mine);
  const other = strength.mobilityOf(war, theirs);
  if (phase === "stalemate" || phase === "attrition") {
    if (odds < 1.6) reasons.push("even");
    else if (ids.some((id) => state.regions[id] && theirs.includes(state.regions[id].owner))) reasons.push("home");
  } else if (odds >= 5) reasons.push("odds");
  if (mob.armour >= 0.5 && mob.edge - other.edge > 0.25) reasons.push("armour");
  if (mob.air >= 0.5 && mob.edge - other.edge > 0.25) reasons.push("air");
  const willOf = (side: readonly string[]) => Math.min(...side.map((t) => strength.means.will(t)));
  if (willOf(theirs) < BREAKING) reasons.push("collapse");
  const rough = ids.length ? ids.reduce((s, id) => s + going(index.regions?.[id]), 0) / ids.length : 1;
  if (rough < 0.6 && phase !== "pursuit") reasons.push("terrain");
  if (strength.tiredOf(war) < 0.75) reasons.push("weary");
  const drones = (side: readonly string[]) => side.reduce((s, t) => s + (state.countries[t]?.arsenal?.stock.drones?.n ?? 0), 0);
  if ((phase === "stalemate" || phase === "attrition") && drones(theirs) + drones(mine) > 0 && yearOf(state.date) >= 2014) reasons.push("drones");
  return { phase, side: rate >= PHASES[2][1] ? lead : null, rate: Math.round(rate), odds: Math.round(odds * 10) / 10, reasons: reasons.slice(0, 3) };
}

/** A war's pace in one line for the game master: "pace: pursuit by A – whole provinces fall within days or weeks (best sectors: a province in ~9 days; odds 18:1; overwhelming odds, tanks the enemy cannot stop)". */
export function paceLine(p: WarPace | null): string {
  if (!p) return "";
  const why: Record<PaceReason, string> = {
    odds: "overwhelming odds",
    even: "evenly matched",
    armour: "tanks the enemy cannot stop",
    air: "command of the air",
    terrain: "rough ground",
    collapse: "the losing side's will breaking",
    weary: "a long war's weariness",
    drones: "drones and precision fires",
    home: "the defender on its own ground",
  };
  const by = p.side ? ` by ${p.side === "attackers" ? "A" : "D"}` : "";
  const reasons = p.reasons.length ? `; ${p.reasons.map((r) => why[r]).join(", ")}` : "";
  const scale: Record<PacePhase, string> = {
    stalemate: "the line barely moves",
    attrition: "a few points of a province a month",
    breakthrough: "tens of points a month, a province in weeks",
    pursuit: "whole provinces fall within days or weeks",
  };
  const speed = p.rate >= 100 ? `a province in ~${provinceDays(p.rate)} days, ~${p.rate} km a month` : `~${p.rate} points of a province, ~${p.rate} km, a month`;
  return `pace: ${p.phase}${by} – ${scale[p.phase]} (best sectors: ${speed}; odds ${p.odds}:1${reasons})`;
}

/** Days a province of PACE_KM2 takes to fall at a pace in points a month. */
export const provinceDays = (rate: number) => Math.max(2, Math.round(3000 / Math.max(1, rate)));

/**
 * How a side fights at a province this turn, by its formation there (engine/formations.ts): its posture, the doublings its
 * posture and its guns add to an attack, the share of the pace its attack makes, and how hard it clears a lodgement in its
 * own line. Without formations every side attacks wherever it can (OPEN).
 */
export interface Stance {
  posture: Posture;
  edge: number;
  pace: number;
  counter: number;
  /** It may probe a quiet line now and then: all but a formation falling back or told by the player to hold. */
  probes: boolean;
}
export type Stances = (war: War, side: string[], id: string) => Stance;
export const OPEN: Stance = { posture: "offensive", edge: 0, pace: 1, counter: 1, probes: true };
const openStances: Stances = () => OPEN;

/** A formation as the fronts and the losses read it this turn (engine/formations.ts PlannedUnit). */
export interface FieldUnit {
  id: string;
  tag: string;
  sector: string[];
  posture: Posture;
  prep: number;
  /** The player told it its task. */
  ordered?: boolean;
  /** The order that set its posture came late, or was botched. */
  late?: boolean;
  botched?: boolean;
  /** Where it attacks when nothing of its sector is fought over yet. */
  target?: string;
  commander: { skill: number };
  /** Doublings a joint offensive or operation with allies adds to its attacks this turn (engine/joint.ts). */
  joint?: number;
  /** Thousands of soldiers in it, for how its tanks and guns are shared out (`mass`); its sector's provinces without it. */
  men?: number;
}
/** The turn's formations by war. */
export type TurnUnits = Record<string, FieldUnit[]>;

/**
 * Finds a side's formation at a province: the one whose sector holds it (of the member holding or fighting in it first),
 * else the most forward of the side's formations next to it – the one an attack on an enemy province comes from.
 */
export function unitsAt(units: TurnUnits, state: Pick<GameState, "regions">, index: Pick<MapIndex, "neighbors">) {
  const byWar = new Map<string, Map<string, FieldUnit>>();
  for (const [war, list] of Object.entries(units)) {
    const map = new Map<string, FieldUnit>();
    for (const u of list) for (const id of u.sector) map.set(`${u.tag}|${id}`, u);
    byWar.set(war, map);
  }
  return (war: string, side: readonly string[], id: string): FieldUnit | undefined => {
    const map = byWar.get(war);
    if (!map) return undefined;
    const r = state.regions[id];
    for (const tag of [r?.controller, r?.contested, ...side]) {
      if (!tag || !side.includes(tag)) continue;
      const u = map.get(`${tag}|${id}`);
      if (u) return u;
    }
    let best: FieldUnit | undefined;
    for (const n of index.neighbors[id] ?? []) {
      for (const tag of side) {
        const u = map.get(`${tag}|${n}`);
        if (u && (!best || POSTURE_RANK[u.posture] > POSTURE_RANK[best.posture])) best = u;
      }
    }
    return best;
  };
}

/** How a formation's posture, guns, orders and allies make it fight (engine/doctrine.ts, engine/joint.ts); its commander's skill tells in its losses (engine/warLosses.ts). */
export function stanceOf(u: Pick<FieldUnit, "posture" | "prep" | "late" | "botched" | "ordered" | "joint">): Stance {
  const guns = u.posture === "offensive" || u.posture === "assault" ? PREP_EDGE * (u.botched ? 0 : u.prep) : 0;
  const pace = POSTURE_PACE[u.posture] * (u.late ? LATE_SHARE : 1) * (u.botched ? BOTCHED_PACE : 1);
  const probes = u.posture !== "withdraw" && !(u.posture === "hold" && u.ordered);
  // Allies attacking together where their lines meet: the enemy cannot shift its reserves from one to the other.
  const allies = u.posture === "probe" || u.posture === "offensive" || u.posture === "assault" ? (u.joint ?? 0) : 0;
  return { posture: u.posture, edge: POSTURE_EDGE[u.posture] + guns + allies, pace, counter: COUNTER_PACE[u.posture], probes };
}

/** The stances of the turn's formations; a side with no formation at a province (a war begun this turn) attacks wherever it can. */
export function stancesFrom(units: TurnUnits, state: Pick<GameState, "regions">, index: Pick<MapIndex, "neighbors">): Stances {
  const at = unitsAt(units, state, index);
  const memo = new Map<string, Stance>();
  return (war, side, id) => {
    const key = `${war.id}|${side.join("+")}|${id}`;
    let s = memo.get(key);
    if (!s) {
      const u = at(war.id, side, id);
      memo.set(key, (s = u ? stanceOf(u) : OPEN));
    }
    return s;
  };
}

/** A side falling back gives up this much of a province it holds where the enemy fights, and leaves a lodgement of its own outright. */
const WITHDRAWAL = 40;

/**
 * The engine's front moves for this turn, for the wars being fought before
 * it: none in a war the answer ends or pauses, none in provinces the answer
 * named. Each side fights by its `stances` (engine/formations.ts); `strength`,
 * when given, is the reading of the fronts already made for them.
 */
export function frontMoves(state: GameState, index: MapIndex, named: ReadonlySet<string>, ending: ReadonlySet<string> = new Set(), stances: Stances = openStances, given?: FrontStrength): FrontMove[] {
  const months = (STEP_YEARS[state.step] ?? 1 / 12) * 12;
  const game = state.seed ?? state.id;
  const dice = (key: string) => roll(game, state.turn, `front:${key}`);
  const strength = given ?? frontStrength(state, index);
  const { fronts, edge, means, advance, landing, theatreOf, tiredOf } = strength;
  const moves: FrontMove[] = [];
  const done = new Set<string>(named);
  /** The best reach any member of a side has at a province (engine/warMeans.ts). */
  const reachOf = (side: string[], other: string[], id: string) => Math.max(0.01, ...side.map((tag) => means.reach(tag, id, side, other)));

  for (const war of fought(state)) {
    if (ending.has(war.id)) continue;
    const front = fronts.get(war.id) ?? [];
    const a = new Set(war.attackers);
    const d = new Set(war.defenders);
    const sideOf = (tag: string) => (a.has(tag) ? war.attackers : d.has(tag) ? war.defenders : null);
    // Where the answer moved a theatre of this war's front, the game master leads it there: the rest of that theatre only drifts,
    // and it opens no new fights; the war's other theatres the engine still moves.
    const theatre = (id: string) => theatreOf(war, id) ?? 0;
    const ledTheatres = new Set(front.filter((id) => named.has(id)).map(theatre));
    const led = (id: string) => ledTheatres.has(theatre(id));
    const tired = tiredOf(war);

    // The provinces the front runs through: the side holding part gains or yields by the balance there and the postures.
    for (const id of front) {
      if (done.has(id)) continue;
      const r = state.regions[id];
      const attacker = r.contested ? sideOf(r.contested) : null;
      const holding = sideOf(r.controller);
      if (!attacker || !holding || attacker === holding) continue;
      done.add(id);
      const scale = led(id) ? 0.5 : 1;
      const mine = stances(war, attacker, id);
      const theirs = stances(war, holding, id);
      let push: number;
      if (mine.posture === "withdraw") push = -WITHDRAWAL / months;
      else if (theirs.posture === "withdraw") push = WITHDRAWAL / months;
      else {
        const on = attacking(mine.posture) ? advance(war, attacker, holding, id, false, undefined, mine.edge) : null;
        // A lodgement held still keeps its ground unless the holder can clear it; one pressed forward gains what the balance allows.
        const counter = () => advance(war, holding, attacker, id, true).rate * theirs.counter;
        push = on && on.surplus > 0 ? on.rate * mine.pace : -counter();
      }
      const gain = push * months * scale;
      // The dice's spread is ground too: more of a small province, less of a large one.
      const noise = (dice(id) - 0.5) * 2 * SPREAD * Math.sqrt(months) * scale * paceScale(index.regions[id]);
      let delta = gain + noise;
      // A front in a war being fought never stands entirely still.
      if (Math.abs(delta) < 1) delta = delta < 0 || (delta === 0 && push < 0) ? -1 : 1;
      // No ground where the attacker's supply does not reach: a landing on one part of an island keeps to what its ships supply.
      if (delta > 0 && reachOf(attacker, holding, id) < NO_REACH) delta = 0;
      const share = Math.round((r.held ?? 30) + delta);
      if (share > FALLS) moves.push({ region: id, to: r.contested!, mode: "occupy" });
      else if (share < DRIVEN_OUT) moves.push({ region: id, to: r.controller, mode: "occupy" });
      else moves.push({ region: id, to: r.contested!, mode: "contest", share });
    }

    // An attacker short of the means fights for limited aims: it breaks in only next to its own land.
    const limited = means.limited(war);
    const border = (id: string) => (index.neighbors[id] ?? []).some((n) => state.regions[n] && a.has(state.regions[n].owner) && a.has(state.regions[n].controller));
    // Provinces that fall this period, and to whom.
    const fallen = new Map(moves.filter((m) => m.mode === "occupy").map((m) => [m.region, m.to]));

    // Breakthroughs: where a side is stronger, it opens fights in the enemy's provinces next to its own, its strongest sectors first;
    // in a pursuit a province it overruns early in the period opens the way to the next, as far as the period's time allows.
    for (const [side, other] of [
      [war.attackers, war.defenders],
      [war.defenders, war.attackers],
    ]) {
      const mine = new Set(side);
      const allowed = (id: string) => !done.has(id) && !led(id) && !state.regions[id].contested && other.includes(state.regions[id].controller) && (!limited || side !== war.attackers || border(id));
      const ours = (n: string) => Boolean(state.regions[n]) && (fallen.has(n) ? mine.has(fallen.get(n)!) : mine.has(state.regions[n].controller));
      const nextTo = (id: string) => (index.neighbors[id] ?? []).some(ours);
      const sectors = front
        // Only where the side's formation there attacks, and its supply reaches.
        .filter((id) => allowed(id) && nextTo(id) && reachOf(side, other, id) >= NO_REACH)
        .map((id) => {
          const stance = stances(war, side, id);
          // A line its holder abandons is walked into.
          const yielding = stances(war, other, id).posture === "withdraw" ? 1 : 0;
          return { id, stance, adv: attacking(stance.posture) ? advance(war, side, other, id, false, undefined, stance.edge + yielding) : null, time: months, hops: 0, depth: 0 };
        })
        .flatMap((s) => (s.adv && s.adv.surplus > 0.15 ? [{ ...s, adv: s.adv }] : []))
        .sort((x, y) => y.adv.pace - x.adv.pace || y.adv.surplus - x.adv.surplus);
      if (!sectors.length) continue;
      const tempo = sectors[0].adv.pace / (sectors[0].adv.pace + 60);
      const limit = Math.max(1, Math.round(months * Math.min(MAX_BREAKS_MONTH, BREAKS_MONTH + 9 * tempo + PURSUIT_BREAKS * Math.max(0, tempo - 0.5))));
      let broken = 0;
      const queue = [...sectors];
      while (queue.length && broken < limit) {
        const s = queue.shift()!;
        if (done.has(s.id)) continue;
        const go = going(index.regions[s.id]);
        const k = paceScale(index.regions[s.id]);
        const surplus = s.adv.surplus - 0.15;
        // A probe tries less often and gets less far, an all-out assault more.
        const chance = Math.min(0.95, s.time * (0.5 * surplus * go * tired + s.adv.pace / 80) * s.stance.pace);
        if (dice(`${war.id}:${s.id}:break${s.hops ? `:${s.hops}` : ""}`) >= chance) continue;
        // A breakthrough counts the land it opens: a province of PACE_KM2 is one, a smaller one less.
        broken += Math.max(LEAST_BREAK, 1 / (k * k));
        done.add(s.id);
        // The member next to the province carries the attack.
        const by = side.find((tag) => (index.neighbors[s.id] ?? []).some((n) => (fallen.get(n) ?? state.regions[n]?.controller) === tag)) ?? side[0];
        const gained = (6 + 4 * surplus * go) * k + ADVANCING * s.adv.rate * s.time * s.stance.pace;
        if (gained > FALLS + 5) {
          // Overrun: the province falls, and what is left of the period carries the advance on.
          moves.push({ region: s.id, to: by, mode: "occupy" });
          fallen.set(s.id, by);
          const left = s.time - (FALLS - 6) / Math.max(1, ADVANCING * s.adv.rate);
          // No further than an army reaches from its own in one period: PURSUIT_DEPTH provinces of PACE_KM2 overrun one after another.
          const depth = s.depth + depthIn(index.regions[s.id]);
          if (left <= 0.05 || depth >= PURSUIT_DEPTH - 1e-9) continue;
          for (const n of index.neighbors[s.id] ?? []) {
            if (!state.regions[n] || !allowed(n) || queue.some((q) => q.id === n)) continue;
            // Not into land beyond its reach (an army far from home, across the sea): there the run stops.
            const reachHere = reachOf(side, other, s.id);
            const reachThere = reachOf(side, other, n);
            if (reachThere < NO_REACH) continue;
            // The advance runs on at the edge it broke through with, less for the ground it runs further from supply and from home.
            const adv = advance(war, side, other, n, false, s.adv.edge + 1.5 * Math.log2(SUPPLY) * depthIn(index.regions[n]) + Math.min(0, Math.log2(reachThere / reachHere)));
            if (adv.surplus > 0.15) queue.push({ id: n, stance: s.stance, adv, time: left, hops: s.hops + 1, depth });
          }
          queue.sort((x, y) => y.adv.pace - x.adv.pace);
        } else {
          const share = Math.round(Math.max(DRIVEN_OUT + 1, Math.min(MAX_OPENING, gained)));
          moves.push({ region: s.id, to: by, mode: "contest", share });
        }
      }
    }

    // A theatre with no fighting anywhere along it: the side that started the war probes its best sector there now and then.
    for (const t of new Set(front.map(theatre))) {
      if (ledTheatres.has(t)) continue;
      const part = front.filter((id) => theatre(id) === t);
      if (part.some((id) => state.regions[id].contested) || moves.some((m) => part.includes(m.region))) continue;
      const probe = part
        .filter((id) => !done.has(id) && d.has(state.regions[id].controller) && (index.neighbors[id] ?? []).some((n) => a.has(state.regions[n]?.controller ?? "")))
        .filter((id) => (!limited || border(id)) && stances(war, war.attackers, id).probes && reachOf(war.attackers, war.defenders, id) >= NO_REACH)
        .map((id) => ({ id, e: edge(war, war.attackers, war.defenders, id) }))
        .sort((x, y) => y.e - x.e)[0];
      if (probe && probe.e > -1 && dice(`${war.id}:probe${t > 1 ? `:${t}` : ""}`) < Math.min(0.9, 0.4 * months)) {
        done.add(probe.id);
        const by = war.attackers.find((tag) => (index.neighbors[probe.id] ?? []).some((n) => state.regions[n]?.controller === tag)) ?? war.attackers[0];
        moves.push({ region: probe.id, to: by, mode: "contest", share: Math.round(Math.max(DRIVEN_OUT + 1, Math.min(MAX_OPENING / 2, 8 * going(index.regions[probe.id]) * paceScale(index.regions[probe.id])))) });
      }
    }

    // Landings: an island in the enemy's hands that no front reaches, where what a side's ships can land and keep there beats
    // the garrison by a clear margin, sees a beachhead now and then – one a war a period at most. Landings on a mainland coast are
    // the orders' and the game master's to make.
    for (const [side, other] of [
      [war.attackers, war.defenders],
      [war.defenders, war.attackers],
    ]) {
      if (limited && side === war.attackers) continue;
      const best = islandTargets(state, index, side, other, means)
        // Not where its supply does not reach, as any other ground (a far power's beachhead at a reach of 0.13 froze where it landed).
        .filter((id) => !done.has(id) && !(islandOf(index, id) ?? []).some((x) => named.has(x)) && reachOf(side, other, id) >= NO_REACH)
        .map((id) => ({ id, adv: landing(war, side, other, id) }))
        .filter((s) => s.adv.surplus > LANDING_MARGIN)
        .sort((x, y) => y.adv.surplus - x.adv.surplus || x.id.localeCompare(y.id))[0];
      if (!best) continue;
      const go = going(index.regions[best.id]);
      const surplus = best.adv.surplus - LANDING_MARGIN;
      if (dice(`${war.id}:${best.id}:landing`) >= Math.min(0.9, months * (0.4 * surplus * go * tired + best.adv.pace / 120))) continue;
      done.add(best.id);
      // The member that can land the most carries it.
      const by = [...side].sort((x, y) => means.lift(y, best.id, side, other) - means.lift(x, best.id, side, other) || x.localeCompare(y))[0];
      moves.push({ region: best.id, to: by, mode: "contest", share: Math.round(Math.max(DRIVEN_OUT + 1, Math.min(MAX_OPENING / 2, (6 + 4 * surplus * go) * paceScale(index.regions[best.id])))) });
      break;
    }
  }
  return moves;
}

/** The surplus a landing needs over the defender's edge before the engine makes it: a landing is a risk taken only with a clear margin. */
const LANDING_MARGIN = 0.3;

/** Kilometres in a degree of latitude, on distanceKm's globe. */
const LAT_KM = (6371 * Math.PI) / 180;

/**
 * The islands a side could land on in a war: the enemy's coastal provinces on
 * an island where its side holds nothing, not fought over yet, that one of
 * its members can reach across the sea (engine/warMeans.ts lift) or a
 * narrow strait; those it can land the most on first, at most `limit`.
 */
export function islandTargets(state: Pick<GameState, "regions">, index: Pick<MapIndex, "neighbors" | "regions">, side: string[], other: string[], means: Pick<FrontMeans, "lift">, limit = 8): string[] {
  const mine = new Set(side);
  // The side's own shores, to keep to the islands a landing could cross to at all (LANDING_KM, centre to centre less the islands' breadth).
  const shores = Object.entries(state.regions).flatMap(([id, r]) => (mine.has(r.controller) && index.regions[id]?.coastal && index.regions[id].at ? [index.regions[id].at!] : []));
  if (!shores.length) return [];
  const near: { id: string; km: number }[] = [];
  for (const [id, r] of Object.entries(state.regions)) {
    const p = index.regions[id];
    if (r.contested || !other.includes(r.controller) || !p?.coastal || !p.at) continue;
    const island = islandOf(index, id);
    if (!island || island.some((x) => mine.has(state.regions[x]?.controller ?? "") || (state.regions[x]?.contested !== undefined && mine.has(state.regions[x].contested!)))) continue;
    let km = Infinity;
    for (const at of shores) {
      // A shore farther north or south than the nearest so far is farther away whatever its longitude.
      if (Math.abs(at[1] - p.at[1]) * LAT_KM > km) continue;
      km = Math.min(km, distanceKm(p.at, at));
    }
    if (km - Math.sqrt(Math.max(1, p.area) / Math.PI) <= LANDING_KM) near.push({ id, km });
  }
  const out: { id: string; cap: number }[] = [];
  for (const { id } of near.sort((x, y) => x.km - y.km || x.id.localeCompare(y.id)).slice(0, 3 * limit)) {
    // Across a narrow strait (Hainan from the mainland) its troops cross as if by land: the lift is no bound there.
    const cap = Math.max(0, ...side.map((tag) => means.lift(tag, id, side, other)));
    if (cap > 0) out.push({ id, cap });
  }
  return out
    .sort((x, y) => y.cap - x.cap || x.id.localeCompare(y.id))
    .slice(0, limit)
    .map((x) => x.id);
}

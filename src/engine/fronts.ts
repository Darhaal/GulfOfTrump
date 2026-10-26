import { baseLevel, combatPower } from "./arsenal";
import { yearOf } from "./calendar";
import { roll } from "./dice";
import { STEP_YEARS } from "./economy";
import { railLevel } from "./provinces";
import type { GameState, MapIndex, MapRegion, Terrain, War, WeaponKind } from "./types";
import { frontMeans } from "./warMeans";

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
 * or hold land next to it, and a quarter of what its members far from any
 * front can send.
 *
 * The pace follows the odds and the means of manoeuvre. An even fight is
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
 * The engine moves only provinces the turn's answer did not name: where the
 * answer moved a war's front, the rest of it only drifts, and the game
 * master's offensives are its own. The dice are seeded by the game, the turn
 * and the province, so the server and the browser agree.
 */

/** The largest edge counted, in doublings (16 : 1). */
const MAX_EDGE = 4;
/** Points of a province a month at one doubling of strength beyond the defender's edge, the grinding part of an advance; it grows faster than the edge (CURVE). */
const RATE = 10;
const CURVE = 1.3;
/** Manoeuvre: points a month at one doubling beyond BREAK, at full motorisation and freedom; it grows as the 1.5th power, up to MAX_RUN doublings. */
const MANOEUVRE = 200;
const BREAK = 0.5;
const MAX_RUN = 2.5;
/** Doublings of strength that tanks the enemy cannot stop and command of the air add, at a full edge in the means of manoeuvre. */
const SHOCK = 0.8;
/** The dice's spread on a contested province's share, points a month (at the square root of the months). */
const SPREAD = 3;
/** Breakthroughs a side makes a month along one war's front: in attrition, and the most in pursuit. */
const BREAKS_MONTH = 3;
const MAX_BREAKS_MONTH = 12;
/** The part of a period a breakthrough spends advancing once it is in: the rest goes on breaking in. */
const ADVANCING = 0.8;
/** The most a breakthrough takes of a province it does not overrun. */
const MAX_OPENING = 90;
/** A contest's share beyond which the province falls, and below which its attacker is driven out (as in engine/outcome.ts). */
const FALLS = 95;
const DRIVEN_OUT = 5;
/** What a side's members far from every front add along it. */
const FAR = 0.25;
/** A side's strength for each hop into enemy land past the second, from the nearest province of its own it holds. */
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

/** Straight lines between the years. */
function byYear(curve: [number, number][], year: number): number {
  if (year <= curve[0][0]) return curve[0][1];
  for (let i = 1; i < curve.length; i++) {
    const [y, v] = curve[i];
    if (year <= y) {
      const [y0, v0] = curve[i - 1];
      return v0 + ((v - v0) * (year - y0)) / (y - y0);
    }
  }
  return curve[curve.length - 1][1];
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

/** What a side brings to manoeuvre at a war's front: tanks per thousand soldiers, combat aircraft, air defence weighed against them, and drones per thousand soldiers, each by its level against the day's. */
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
    if (s.tanks?.n) tanks += levelled(s.tanks.n, s.tanks.level, "tanks", year) * k;
    if (s.aircraft?.n) air += levelled(s.aircraft.n, s.aircraft.level, "aircraft", year) * k;
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

/** How a side advances at one province: the edge it fights at (manoeuvre included), the doublings past what it needs, and points of the province a month. */
export interface Advance {
  edge: number;
  surplus: number;
  rate: number;
}

type StrengthState = Pick<GameState, "countries" | "regions" | "wars" | "date"> & Partial<Pick<GameState, "chronicle" | "scenarioId" | "player" | "politics" | "alliances" | "step" | "plans">>;

/**
 * The strength of the fighting at each front: every country's power, as far
 * as its means bring it to the fighting, spread over the front provinces it
 * holds or fights in, across all its wars; and how fast each side can
 * advance at a province.
 */
export function frontStrength(state: StrengthState, index: Pick<MapIndex, "neighbors"> & Partial<Pick<MapIndex, "regions">>) {
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
  /** A country's strength at one of its front provinces. */
  const density = (tag: string) => powerOf(tag) / Math.max(1, posts.get(tag)?.size ?? 0);
  /** Whether a country fights at a province: it holds it, fights in it, or holds land next to it. */
  const present = (tag: string, id: string) => {
    const r = state.regions[id];
    return r.controller === tag || r.contested === tag || (index.neighbors[id] ?? []).some((n) => state.regions[n]?.controller === tag);
  };
  /** Hops from each province a side holds to the nearest province of its own it holds, by side. */
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
    for (let hop = 1; edge.length; hop++) {
      const next: string[] = [];
      for (const id of edge) {
        for (const n of index.neighbors[id] ?? []) {
          if (d.has(n) || !state.regions[n] || !mine.has(state.regions[n].controller)) continue;
          d.set(n, hop);
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
    if (depth === undefined) for (const n of index.neighbors[id] ?? []) if (d.has(n)) depth = Math.min(depth ?? Infinity, d.get(n)! + 1);
    return SUPPLY ** Math.max(0, (depth ?? 2) - 2);
  };
  const holdings = new Map<string, number>();
  /** The provinces of a war's front a side holds, for what its far members spread over. */
  const holdingOf = (war: Pick<War, "id">, side: string[]) => {
    const key = `${war.id}|${side.join("+")}`;
    let n = holdings.get(key);
    if (n === undefined) holdings.set(key, (n = (fronts.get(war.id) ?? []).filter((f) => side.includes(state.regions[f].controller)).length));
    return n;
  };
  /** What one member of a side brings to a province of a war's front, before the side's supply, home soil and partisans. */
  const brings = (war: Pick<War, "id">, tag: string, side: string[], enemy: string[], id: string) => {
    if (!posts.has(tag)) return (powerOf(tag) * means.reach(tag, id, side, enemy) * FAR) / Math.max(1, holdingOf(war, side));
    return present(tag, id) ? density(tag) * means.reach(tag, id, side, enemy) : 0;
  };
  /** What multiplies a whole side's strength at a province: supply, home soil, partisans behind it. */
  const sideFactor = (side: string[], id: string) => supply(side, id) * means.home(side, id) * means.partisans(side, id);
  /** A side's strength at a province of a war's front against `enemy`: what reaches it from each member's home, on its own soil or not, with partisans behind it or not. */
  const strengths = new Map<string, number>();
  const at = (war: Pick<War, "id">, side: string[], enemy: string[], id: string) => {
    const key = `${war.id}|${side.join("+")}|${id}`;
    let v = strengths.get(key);
    if (v === undefined) strengths.set(key, (v = side.reduce((sum, tag) => sum + brings(war, tag, side, enemy, id), 0) * sideFactor(side, id)));
    return v;
  };
  /** Each member's strength at a province: what it brings, times its side's supply, home soil and partisans. */
  const members = (war: Pick<War, "id">, side: string[], enemy: string[], id: string) => {
    const k = sideFactor(side, id);
    return side.map((tag) => ({ tag, strength: brings(war, tag, side, enemy, id) * k }));
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
    // A member far from every front brings what it can send, as to the front's strength.
    const share = (side: string[], enemy: string[]) => (tag: string) =>
      means.force(tag) * (posts.has(tag) ? 1 : FAR) * (sample.length ? sample.reduce((s, id) => s + means.reach(tag, id, side, enemy), 0) / sample.length : 1);
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
  /** Points of a province a month at `s` doublings beyond what is needed: the grind, and manoeuvre once through. */
  const rateAt = (s: number, go: number, freedom: number) => {
    if (s <= 0) return 0;
    const run = Math.min(MAX_RUN, Math.max(0, s - BREAK));
    return RATE * s ** CURVE * go + MANOEUVRE * motor * run ** 1.5 * go ** 1.5 * freedom;
  };
  /**
   * How `side` advances at a province against `other`: the edge it fights at
   * with its means of manoeuvre, the doublings past the defender's edge (or,
   * holding the province, past none), and points a month with the terrain,
   * the enemy breaking and the war's weariness. `base` gives the edge
   * instead, for a province beyond the front an advance runs into.
   */
  const advances = new Map<string, Advance>();
  const advance = (war: War, side: string[], other: string[], id: string, holds: boolean, base?: number): Advance => {
    const key = base === undefined ? `${war.id}|${side.join("+")}|${id}|${holds}` : "";
    const known = key ? advances.get(key) : undefined;
    if (known) return known;
    const a = advanceAt(war, side, other, id, holds, base);
    if (key) advances.set(key, a);
    return a;
  };
  const advanceAt = (war: War, side: string[], other: string[], id: string, holds: boolean, base?: number): Advance => {
    const e = base ?? edge(war, side, other, id) + SHOCK * (mobilityOf(war, side).edge - mobilityOf(war, other).edge);
    const surplus = holds ? e + defence : e - defence;
    // The holder knows its ground: rough ground slows its counterstrokes less than an attacker's advance.
    const go = going(index.regions?.[id]);
    const rate = rateAt(surplus, holds ? 1 : go, freedomOf(war, side)) * (holds ? go ** 0.5 : 1) * collapse(other, side, id) * tiredOf(war);
    return { edge: e, surplus, rate };
  };
  return { fronts, edge, at, members, powerOf, means, mobilityOf, advance, tiredOf, defence, motor };
}

export type FrontStrength = ReturnType<typeof frontStrength>;

/** Each side's whole strength in a war, for the game master: the members' power, split between the wars each fights. */
export function warStrength(state: Pick<GameState, "countries" | "wars" | "date">, war: Pick<War, "attackers" | "defenders">): { attackers: number; defenders: number } {
  const wars = fought(state);
  const side = (tags: string[]) => tags.reduce((sum, tag) => sum + combatPower(state, tag) / Math.max(1, wars.filter((w) => w.attackers.includes(tag) || w.defenders.includes(tag)).length), 0);
  return { attackers: side(war.attackers), defenders: side(war.defenders) };
}

/** A war's pace: the fronts barely moving, a grind of a few points a month, a breakthrough, or a pursuit with provinces falling in weeks. */
export type PacePhase = "stalemate" | "attrition" | "breakthrough" | "pursuit";
/** Why a front moves as it does, for the game master and the war panel. */
export type PaceReason = "odds" | "even" | "armour" | "air" | "terrain" | "collapse" | "weary" | "drones" | "home";

export interface WarPace {
  phase: PacePhase;
  /** The side that gains ground, if any does. */
  side: "attackers" | "defenders" | null;
  /** Its pace at its best sectors, points of a province a month. */
  rate: number;
  /** Its strength against the enemy's there, as "n : 1". */
  odds: number;
  reasons: PaceReason[];
}

/** Points of a province a month that set each phase. */
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
    const sorted = [...list].sort((x, y) => y.a.rate - x.a.rate).slice(0, 3);
    return { rate: sorted.length ? sorted.reduce((s, x) => s + x.a.rate, 0) / sorted.length : 0, list: sorted };
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
  const speed = p.rate >= 100 ? `a province in ~${provinceDays(p.rate)} days` : `~${p.rate} points of a province a month`;
  return `pace: ${p.phase}${by} – ${scale[p.phase]} (best sectors: ${speed}; odds ${p.odds}:1${reasons})`;
}

/** Days a province takes to fall at a pace in points a month. */
export const provinceDays = (rate: number) => Math.max(2, Math.round(3000 / Math.max(1, rate)));

/**
 * The engine's front moves for this turn, for the wars being fought before
 * it: none in a war the answer ends or pauses, none in provinces the answer named.
 */
export function frontMoves(state: GameState, index: MapIndex, named: ReadonlySet<string>, ending: ReadonlySet<string> = new Set()): FrontMove[] {
  const months = (STEP_YEARS[state.step] ?? 1 / 12) * 12;
  const game = state.seed ?? state.id;
  const dice = (key: string) => roll(game, state.turn, `front:${key}`);
  const strength = frontStrength(state, index);
  const { fronts, edge, means, advance, tiredOf } = strength;
  const moves: FrontMove[] = [];
  const done = new Set<string>(named);

  for (const war of fought(state)) {
    if (ending.has(war.id)) continue;
    const front = fronts.get(war.id) ?? [];
    if (!front.length) continue;
    const a = new Set(war.attackers);
    const d = new Set(war.defenders);
    const sideOf = (tag: string) => (a.has(tag) ? war.attackers : d.has(tag) ? war.defenders : null);
    // Where the answer moved this war's front, the game master leads it: the rest only drifts, and it opens no new fights.
    const led = front.some((id) => named.has(id));
    const tired = tiredOf(war);
    const scale = led ? 0.5 : 1;

    // The provinces the front runs through: the side holding part gains or yields by the balance there.
    for (const id of front) {
      if (done.has(id)) continue;
      const r = state.regions[id];
      const attacking = r.contested ? sideOf(r.contested) : null;
      const holding = sideOf(r.controller);
      if (!attacking || !holding || attacking === holding) continue;
      done.add(id);
      const on = advance(war, attacking, holding, id, false);
      const back = on.surplus > 0 ? 0 : advance(war, holding, attacking, id, true).rate;
      const push = on.surplus > 0 ? on.rate : -back;
      const gain = push * months * scale;
      const noise = (dice(id) - 0.5) * 2 * SPREAD * Math.sqrt(months) * scale;
      let delta = gain + noise;
      // A front in a war being fought never stands entirely still.
      if (Math.abs(delta) < 1) delta = delta < 0 || (delta === 0 && push < 0) ? -1 : 1;
      const share = Math.round((r.held ?? 30) + delta);
      if (share > FALLS) moves.push({ region: id, to: r.contested!, mode: "occupy" });
      else if (share < DRIVEN_OUT) moves.push({ region: id, to: r.controller, mode: "occupy" });
      else moves.push({ region: id, to: r.contested!, mode: "contest", share });
    }
    if (led) continue;

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
      const allowed = (id: string) => !done.has(id) && !state.regions[id].contested && other.includes(state.regions[id].controller) && (!limited || side !== war.attackers || border(id));
      const ours = (n: string) => Boolean(state.regions[n]) && (fallen.has(n) ? mine.has(fallen.get(n)!) : mine.has(state.regions[n].controller));
      const nextTo = (id: string) => (index.neighbors[id] ?? []).some(ours);
      const sectors = front
        .filter((id) => allowed(id) && nextTo(id))
        .map((id) => ({ id, adv: advance(war, side, other, id, false), time: months, hops: 0 }))
        .filter((s) => s.adv.surplus > 0.15)
        .sort((x, y) => y.adv.rate - x.adv.rate || y.adv.surplus - x.adv.surplus);
      if (!sectors.length) continue;
      const tempo = sectors[0].adv.rate / (sectors[0].adv.rate + 60);
      const limit = Math.max(1, Math.round(months * Math.min(MAX_BREAKS_MONTH, BREAKS_MONTH + 9 * tempo)));
      let broken = 0;
      const queue = [...sectors];
      while (queue.length && broken < limit) {
        const s = queue.shift()!;
        if (done.has(s.id)) continue;
        const go = going(index.regions[s.id]);
        const surplus = s.adv.surplus - 0.15;
        const chance = Math.min(0.95, s.time * (0.5 * surplus * go * tired + s.adv.rate / 80));
        if (dice(`${war.id}:${s.id}:break${s.hops ? `:${s.hops}` : ""}`) >= chance) continue;
        broken += 1;
        done.add(s.id);
        // The member next to the province carries the attack.
        const by = side.find((tag) => (index.neighbors[s.id] ?? []).some((n) => (fallen.get(n) ?? state.regions[n]?.controller) === tag)) ?? side[0];
        const gained = 6 + 4 * surplus * go + ADVANCING * s.adv.rate * s.time;
        if (gained > FALLS + 5) {
          // Overrun: the province falls, and what is left of the period carries the advance on.
          moves.push({ region: s.id, to: by, mode: "occupy" });
          fallen.set(s.id, by);
          const left = s.time - (FALLS - 6) / Math.max(1, ADVANCING * s.adv.rate);
          // No further than an army reaches by land from its own in one period (engine/warMeans.ts LINK_HOPS).
          if (left <= 0.05 || s.hops >= 2) continue;
          for (const n of index.neighbors[s.id] ?? []) {
            if (!state.regions[n] || !allowed(n) || queue.some((q) => q.id === n)) continue;
            // The advance runs on at the edge it broke through with, less for each hop further from supply.
            const adv = advance(war, side, other, n, false, s.adv.edge + 1.5 * Math.log2(SUPPLY));
            if (adv.surplus > 0.15) queue.push({ id: n, adv, time: left, hops: s.hops + 1 });
          }
          queue.sort((x, y) => y.adv.rate - x.adv.rate);
        } else {
          const share = Math.round(Math.max(DRIVEN_OUT + 1, Math.min(MAX_OPENING, gained)));
          moves.push({ region: s.id, to: by, mode: "contest", share });
        }
      }
    }

    // A war with no fighting anywhere along its front: the side that started it probes its best sector now and then.
    if (!front.some((id) => state.regions[id].contested) && !moves.some((m) => front.includes(m.region))) {
      const probe = front
        .filter((id) => !done.has(id) && d.has(state.regions[id].controller) && (index.neighbors[id] ?? []).some((n) => a.has(state.regions[n]?.controller ?? "")))
        .filter((id) => !limited || border(id))
        .map((id) => ({ id, e: edge(war, war.attackers, war.defenders, id) }))
        .sort((x, y) => y.e - x.e)[0];
      if (probe && probe.e > -1 && dice(`${war.id}:probe`) < Math.min(0.9, 0.4 * months)) {
        done.add(probe.id);
        const by = war.attackers.find((tag) => (index.neighbors[probe.id] ?? []).some((n) => state.regions[n]?.controller === tag)) ?? war.attackers[0];
        moves.push({ region: probe.id, to: by, mode: "contest", share: Math.round(Math.max(DRIVEN_OUT + 1, 8 * going(index.regions[probe.id]))) });
      }
    }
  }
  return moves;
}

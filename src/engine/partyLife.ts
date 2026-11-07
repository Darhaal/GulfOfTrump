import { campTilt } from "./classes";
import { roll } from "./dice";
import { defaultStrength, findParty, fitSeats, goneParty, loyaltyOf, MAX_GONE, normalise, type PoliticsChange, uniqueId } from "./politics";

export { defaultStrength };
import { movementParty, regimeNow } from "./role";
import { UNDERGROUND_ENDS } from "./scenarios/underground";
import { en } from "./text";
import { DISCONTENTS, OPINION_CAMPS } from "./types";
import type { AppliedChange, Discontent, GameState, GoneParty, OpinionCamp, OrderVerdict, Party, PartyEnd, PartyStance, Politics, RegimeKind, ScenarioId } from "./types";
import { onHomeSoil } from "./warMeans";

/**
 * Parties that live and die by the engine, not only by the game master's
 * word. Every turn, once the turn's own changes have landed:
 *
 * 1. Wear-down. A banned or underground party keeps an organisation (its
 *    strength, 0–100). The state's pressure wears it down – the harder the
 *    police state (the regime, its laws, the loyalty of the police and the
 *    security services), the steadier the regime and the more the period's
 *    orders, bans and foiled plots strike at it – while foreign backing,
 *    mass discontent, a war on the country's own land (which also draws the
 *    state's forces away) and the people's sympathy shelter it. Broken
 *    (below END_STRENGTH) it ends: "crushed" when the state did it,
 *    "faded" when it withered. A legal party with almost no support and no
 *    seats folds, when a larger party speaks for its camp and its people
 *    have somewhere to go; the only voice of its camp lingers on the fringe. In the historical mode the movements history broke by a
 *    known time (scenarios/underground.ts) follow it while the state is
 *    strong: pressed a little less until a year before it, harder after.
 * 2. Rise. Opinion falls into camps (CAMP_STANCE), weighted by the era and
 *    the times (a slump swells the left and the nationalists, a war on the
 *    land the nationalists). A camp no party speaks for, while people are
 *    unhappy (unrest, a slump, a war, a scandal, a generation come of age
 *    since the last new party), may give rise to a new party: the engine
 *    decides when and what it stands for, the game master names it and its
 *    leader in the next answer (politics.named).
 * 3. Splits and mergers. A party with a deep internal divide – a big tent,
 *    power just lost, its ideas moving fast, a coalition with a partner far
 *    from it, hard times – may split; two small legal parties close in their
 *    ideas, below the threshold, may merge, the larger keeping its name
 *    (undergrounds do not: their cells cannot trust each other, and the
 *    engine cannot tell one nation's from another's).
 *
 * Every change goes into the report, ended parties into a short record
 * (Politics.gone), and the game master is told so the story follows
 * (describePartyLife); it cannot keep an ended party alive
 * (sanitizePartyWords). The player's own movement is never touched. The
 * dice are the game's own (engine/dice.ts).
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round1 = (v: number) => Math.round(v * 10) / 10;
const round2 = (v: number) => Math.round(v * 100) / 100;
const lower = (s: string) => s.trim().toLowerCase();
const YEAR_MS = 365.25 * 86_400_000;
const yearsBetween = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / YEAR_MS;
/** Independent odds added up: two halves make three quarters. */
const either = (parts: number[]) => 1 - parts.reduce((p, x) => p * (1 - clamp(x, 0, 1)), 1);
/** A yearly chance over a turn of this many years. */
const overTurn = (yearly: number, years: number) => 1 - (1 - clamp(yearly, 0, 1)) ** years;

export const isOutlawed = (p: Pick<Party, "status">): boolean => p.status === "underground" || p.status === "banned";

// ——— The numbers ———

/** Below this strength an organisation underground is broken and the party ends. */
export const END_STRENGTH = 4;
/** Strength lost a year at net pressure 1: this share of what is left, and a floor that finishes the last cells. */
export const WEAR_SHARE = 0.4;
export const WEAR_FLOOR = 3;
/** The most an organisation underground grows in a year when the times shelter it. */
export const MAX_GROWTH = 15;
/** How much the shelter (backing, discontent, war, sympathy) weighs against the state's pressure. */
export const SHELTER_WEIGHT = 0.8;
/** How much of the state's reach a war on the land takes away, per point of `war` (0.5 when the enemy is on the land): 30%. */
export const WAR_REACH = 0.6;
/** The state's pressure from which an end counts as crushed rather than faded. */
export const CRUSH_PRESSURE = 0.35;
/** History's pull before a movement's known end, in the historical mode: the state's pressure eased by this share, so it does not end long before. */
export const HISTORY_EASE = -0.2;
/** A legal party below this support (%) and with no seats folds with FOLD_CHANCE a year, when a larger party speaks for its camp at least FOLD_COVER. */
export const FOLD_SUPPORT = 0.8;
export const FOLD_CHANCE = 0.3;
export const FOLD_COVER = 0.5;
/** A new party's support: this share of the opinion no one spoke for, within RISE_SUPPORT %. */
export const RISE_SHARE = 0.25;
export const RISE_SUPPORT = [1, 6] as const;
/** A party the engine made is left alone this long – no split, merger or fold – and no other rises within it. */
export const GRACE_YEARS = 2;
/** The engine makes no party beyond this many. */
export const MAX_PARTIES = 10;
/** A camp no party speaks for must hold this much opinion (%) before a party may rise from it. */
export const RISE_GAP = 6;
/** The most a rise can be likely in a year. */
export const MAX_RISE = 0.6;
/** Within this distance on the three axes a party speaks for a camp, fully at its centre. */
export const CAMP_REACH = 8;
/** Two parties closer than this, each below MERGE_SUPPORT %, may merge. */
export const MERGE_DISTANCE = 5;
export const MERGE_SUPPORT = 7;
/** A divide (0–1) below this never splits a party. */
export const SPLIT_RIFT = 0.3;

/** Where each camp of opinion stands: economy (left–right), freedom (authoritarian–liberal), nation (open–nationalist). */
export const CAMP_STANCE: Record<OpinionCamp, PartyStance> = {
  communist: { economy: -8, freedom: -6, nation: -1 },
  socialist: { economy: -5, freedom: 4, nation: -3 },
  agrarian: { economy: -2, freedom: 0, nation: 5 },
  liberal: { economy: 3, freedom: 8, nation: -5 },
  conservative: { economy: 5, freedom: -1, nation: 4 },
  nationalist: { economy: 3, freedom: -7, nation: 9 },
  religious: { economy: 1, freedom: -4, nation: 6 },
  green: { economy: -4, freedom: 7, nation: -7 },
};

/** Each camp's share of opinion in an ordinary year of each era, % – the greens only once the movement exists. */
const CAMP_WEIGHTS: Record<ScenarioId, Record<OpinionCamp, number>> = {
  "1914": { communist: 5, socialist: 20, agrarian: 20, liberal: 16, conservative: 18, nationalist: 12, religious: 9, green: 0 },
  "1933": { communist: 13, socialist: 17, agrarian: 15, liberal: 10, conservative: 16, nationalist: 20, religious: 9, green: 0 },
  "1939": { communist: 12, socialist: 17, agrarian: 13, liberal: 10, conservative: 16, nationalist: 22, religious: 10, green: 0 },
  "1950": { communist: 15, socialist: 20, agrarian: 12, liberal: 12, conservative: 18, nationalist: 11, religious: 12, green: 0 },
  "1957": { communist: 13, socialist: 21, agrarian: 10, liberal: 14, conservative: 19, nationalist: 10, religious: 12, green: 1 },
  "1964": { communist: 11, socialist: 22, agrarian: 8, liberal: 16, conservative: 20, nationalist: 9, religious: 11, green: 3 },
  "1973": { communist: 10, socialist: 21, agrarian: 7, liberal: 17, conservative: 19, nationalist: 10, religious: 10, green: 6 },
  "1979": { communist: 10, socialist: 20, agrarian: 7, liberal: 16, conservative: 20, nationalist: 10, religious: 11, green: 6 },
  "1991": { communist: 9, socialist: 18, agrarian: 6, liberal: 20, conservative: 18, nationalist: 14, religious: 7, green: 8 },
  "1999": { communist: 7, socialist: 19, agrarian: 5, liberal: 19, conservative: 19, nationalist: 14, religious: 7, green: 10 },
  "2014": { communist: 5, socialist: 17, agrarian: 4, liberal: 18, conservative: 19, nationalist: 18, religious: 8, green: 11 },
  "2022": { communist: 5, socialist: 16, agrarian: 4, liberal: 18, conservative: 18, nationalist: 20, religious: 8, green: 11 },
};

/** How hard each kind of rule holds down what it outlaws, before its laws and its police. */
const REGIME_GRIP: Record<RegimeKind, number> = { democracy: 0.05, limited: 0.2, party: 0.45, autocracy: 0.4, military: 0.4 };

const distance = (a: PartyStance, b: PartyStance) => Math.hypot(a.economy - b.economy, a.freedom - b.freedom, a.nation - b.nation);

/** The camp nearest to a party's ideas. */
export function campOf(stance: PartyStance): OpinionCamp {
  return OPINION_CAMPS.reduce((best, c) => (distance(stance, CAMP_STANCE[c]) < distance(stance, CAMP_STANCE[best]) ? c : best), OPINION_CAMPS[0]);
}

// ——— The state and the times ———

/**
 * How hard the player's state holds down what it outlaws, 0–1: the kind of
 * rule, its laws (assembly, press, elections, the death penalty, exit,
 * martial law) and how loyal its police and security services are.
 */
export function policeState(state: Pick<GameState, "politics" | "scenarioId" | "player"> & Partial<Pick<GameState, "defeat">>): number {
  const p = state.politics;
  if (!p) return 0;
  const laws = p.laws ?? {};
  let grip = REGIME_GRIP[regimeNow(state)];
  grip += laws.assembly === "banned" ? 0.1 : laws.assembly === "permit" ? 0.03 : 0;
  grip += laws.press === "state" || laws.press === "censored" ? 0.08 : laws.press === "restricted" ? 0.03 : 0;
  grip += laws.elections === "suspended" ? 0.05 : laws.elections === "managed" ? 0.03 : 0;
  grip += laws.deathPenalty === "applied" ? 0.05 : 0;
  grip += laws.exit === "closed" ? 0.05 : laws.exit === "permit" ? 0.02 : 0;
  grip += laws.martial === "martial" ? 0.08 : laws.martial === "emergency" ? 0.04 : 0;
  const l = loyaltyOf(p);
  grip += ((l.police + l.security) / 2 - 50) / 125;
  return round2(clamp(grip, 0, 1));
}

/** The times as they bear on the parties: the economy's pain, the war, and each cause of discontent, 0–1. */
export interface Times {
  /** How hard the economy bites, 0–1: a slump, joblessness, prices. */
  pain: number;
  /** An enemy holds or fights in the country's own land. */
  homeSoil: boolean;
  atWar: boolean;
  /** Each cause of discontent, 0–1, and all of them together. */
  causes: Record<Discontent, number>;
  discontent: number;
}

const SCANDAL = (c: AppliedChange) =>
  (c.kind === "cabinet" && c.event === "leak") || (c.kind === "official" && (c.change === "arrested" || c.change === "fled")) || (c.kind === "plot" && c.change === "discovered" && Boolean(c.cabinet));

/** The times at the end of the period, read off the state after the turn and what the turn changed. */
export function timesOf(before: GameState, next: GameState, applied: AppliedChange[], to: string, strain = 0): Times {
  const player = next.player;
  const e = next.countries[player]?.economy;
  const slump = e ? either([clamp(-e.growth / 5, 0, 1) * 0.35, clamp((e.unemployment - 10) / 15, 0, 1) * 0.3, clamp((e.inflation - 15) / 40, 0, 1) * 0.25]) : 0;
  const pain = e ? clamp(Math.max(-e.growth / 5, (e.unemployment - 8) / 15, (e.inflation - 15) / 40), 0, 1) : 0;
  const atWar = next.wars.some((w) => w.attackers.includes(player) || w.defenders.includes(player));
  const homeSoil = atWar && onHomeSoil(next, player);
  const scandal = applied.some(SCANDAL) || (before.chronicle.at(-1)?.applied ?? []).some(SCANDAL);
  // A generation comes of age a dozen years after the last new party, or the start.
  const born = (next.politics?.parties ?? []).map((p) => p.origin?.date).filter((d): d is string => Boolean(d));
  const since = [before.chronicle[0]?.from ?? before.date, ...born].sort().at(-1)!;
  const causes: Record<Discontent, number> = {
    unrest: clamp(((next.politics?.unrest ?? 0) - 25) / 50, 0, 1) * 0.5,
    slump,
    // A war on the land, any war, and the families' anger at a long mobilisation (engine/mobilisation.ts).
    war: Math.max(homeSoil ? 0.3 : atWar ? 0.12 : 0, 0.4 * clamp(strain / 100, 0, 1)),
    scandal: scandal ? 0.2 : 0,
    generation: clamp((yearsBetween(since, to) - 12) / 8, 0, 1) * 0.3,
  };
  return { pain, homeSoil, atWar, causes, discontent: round2(either(Object.values(causes))) };
}

/** Each camp's share of opinion now, %: the era's, swelled or shrunk by hard times and a war on the land, and by the classes' anger (engine/classes.ts campTilt). */
export function opinionOf(scenario: ScenarioId, times: Pick<Times, "pain" | "homeSoil">, classes?: Partial<Record<OpinionCamp, number>>): Record<OpinionCamp, number> {
  const base = CAMP_WEIGHTS[scenario] ?? CAMP_WEIGHTS["1950"];
  const p = times.pain;
  const factor: Record<OpinionCamp, number> = {
    communist: 1 + 0.8 * p,
    socialist: 1 + 0.5 * p,
    agrarian: 1,
    liberal: 1 - 0.3 * p,
    conservative: 1 - 0.2 * p,
    nationalist: (1 + 0.5 * p) * (times.homeSoil ? 1.4 : 1),
    religious: 1,
    green: times.homeSoil ? 0.6 : 1,
  };
  const raw = OPINION_CAMPS.map((c) => [c, base[c] * factor[c] * (classes?.[c] ?? 1)] as const);
  const total = raw.reduce((s, [, v]) => s + v, 0) || 1;
  return Object.fromEntries(raw.map(([c, v]) => [c, round1((v / total) * 100)])) as Record<OpinionCamp, number>;
}

/** How far a party speaks for a camp, 0–1: near its centre fully, an outlawed one only in whispers. */
const voice = (p: Party, camp: OpinionCamp) => Math.max(0, 1 - distance(p.stance, CAMP_STANCE[camp]) / CAMP_REACH) * (isOutlawed(p) ? 0.7 : 1);

/** The share of opinion (%) in each camp that no party speaks for. */
export function unrepresented(parties: Party[], opinion: Record<OpinionCamp, number>): Record<OpinionCamp, number> {
  return Object.fromEntries(OPINION_CAMPS.map((c) => [c, round1(opinion[c] * (1 - either(parties.map((p) => voice(p, c)))))])) as Record<OpinionCamp, number>;
}

// ——— Wear-down ———

/** What bears on an outlawed party in a period, each in the units wearOf adds them in. */
export interface Pressure {
  /** The police state, 0–1. */
  police: number;
  /** How steady the regime is, 0–1 (100 less unrest). */
  stability: number;
  /** The period's blows aimed at it: orders against it, a fresh ban, a foiled plot, 0–1.5. */
  repression: number;
  /** History's pull, in the historical mode: HISTORY_EASE until a year before the movement was broken, 0 then, up to 3 after. */
  anchor: number;
  /** Shelter: foreign backing, mass discontent, a war on the land, the people's sympathy. */
  backing: number;
  discontent: number;
  war: number;
  sympathy: number;
}

/** The net pressure on an organisation: positive wears it down, negative lets it grow. A war on the land draws the police and the troops away. */
export function netPressure(f: Pressure): number {
  const pressure = f.police * (0.5 + 0.5 * f.stability) * (1 + f.repression) * (1 + f.anchor) * (1 - WAR_REACH * f.war);
  const shelter = f.backing + f.discontent + f.war + f.sympathy;
  return pressure - SHELTER_WEIGHT * shelter;
}

/** An organisation's strength after some years under this pressure, in quarter-year steps. */
export function wearOf(strength: number, f: Pressure, years: number, support: number): number {
  const net = netPressure(f);
  let s = strength;
  const steps = Math.max(1, Math.ceil(years / 0.25));
  const dt = years / steps;
  for (let i = 0; i < steps; i += 1) {
    const change = net > 0 ? -net * (WEAR_SHARE * s + WEAR_FLOOR) : Math.min(MAX_GROWTH, -net * 0.25 * (100 - s));
    // A party almost nobody sympathises with withers even when left alone.
    s = clamp(s + (change - (support < 1 ? 2 : 0)) * dt, 0, 100);
  }
  return round1(s);
}

/** History's end for a party, in the historical mode: the anchor whose names it goes by. */
export function historyEnd(state: Pick<GameState, "scenarioId" | "player">, p: Pick<Party, "name" | "short" | "ideology">): string | undefined {
  const text = [p.name, p.short ?? "", p.ideology].join(" | ");
  return UNDERGROUND_ENDS.find((a) => a.scenario === state.scenarioId && a.country === state.player && a.match.test(text))?.by;
}

const REPRESSIVE =
  /crush|suppress|liquidat|eradicat|destroy|wipe out|\bhunt|arrest|round up|\braid|purge|deport|\bban\b|outlaw|root out|stamp out|eliminat|annihilat|exterminat|repress|crack down|crackdown|mop up|подав|ликвид|уничтож|разгром|искорен|арест|облав|зачист|депорт|выселит|запрет|репресс|раздав|истреб|добит|покончит|придуш|ліквід|знищ|викорін|арешт|висел|заборон|репрес|розчав|винищ|покінчит/i;

/** Whether an order names the party, by its name, short name or the names history knows it by. */
function names(order: string, p: Party, state: Pick<GameState, "scenarioId" | "player">): boolean {
  const o = order.toLowerCase();
  if (o.includes(lower(p.name))) return true;
  if (p.short && p.short.length >= 2 && new RegExp(`(^|[^\\p{L}])${p.short.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}]|$)`, "iu").test(order)) return true;
  const text = [p.name, p.short ?? "", p.ideology].join(" | ");
  return UNDERGROUND_ENDS.some((a) => a.scenario === state.scenarioId && a.country === state.player && a.match.test(text) && a.match.test(order));
}

/**
 * The period's blows aimed at a party: the player's orders against it (by how they went), a fresh ban, support cut, a
 * plot of its foiled, and the interior minister's watch on it (engine/ministers.ts). An order the repressions already
 * carried out as a case (engine/repressions.ts) struck there – the leader taken, the cells broken, or a martyr made –
 * and is not counted again; nor is the support such a case cut.
 */
function repressionOf(p: Party, was: Party | undefined, ctx: PartyContext, state: GameState, applied: AppliedChange[]): number {
  let r = 0;
  ctx.orders.forEach((order, i) => {
    if (ctx.cases?.orders.includes(i + 1) || !REPRESSIVE.test(order) || !names(order, p, state)) return;
    const verdict = ctx.verdicts.find((v) => v.n === i + 1)?.result;
    r += verdict === "success" ? 0.8 : verdict === "failed" ? 0.15 : 0.5;
  });
  if (was && !isOutlawed(was) && isOutlawed(p)) r += 0.5;
  if (was && was.support > 0 && p.support <= was.support * 0.8 && !ctx.cases?.parties.includes(p.id)) r += 0.3;
  if (applied.some((c) => c.kind === "plot" && c.change === "foiled" && byParty(c.title, p))) r += 0.3;
  r += ctx.watched?.[p.id] ?? 0;
  return clamp(r, 0, 1.5);
}

/** Whether a plot's title or author points at the party. */
const byParty = (text: string, p: Pick<Party, "name" | "short">) => {
  const t = lower(text);
  return t.includes(lower(p.name)) || Boolean(p.short && p.short.length >= 2 && t.split(/[^\p{L}\p{N}()]+/u).includes(lower(p.short)));
};

/** A backer by tag or name, if it is a government the state knows and not the player's own. */
export function backerTag(state: Pick<GameState, "countries" | "player">, raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const key = lower(raw);
  const tag = state.countries[key] ? key : Object.values(state.countries).find((c) => lower(en(c.name)) === key)?.tag;
  return tag && tag !== state.player && !state.countries[tag]?.dormant ? tag : undefined;
}

// ——— The turn ———

export interface PartyContext {
  turn: number;
  to: string;
  years: number;
  /** The period's orders and the game master's verdicts on them, for the blows aimed at a party. */
  orders: string[];
  verdicts: OrderVerdict[];
  /** The strain of a long mobilisation on the player's people, 0–100 (engine/mobilisation.ts). */
  strain?: number;
  /** The period's cases (engine/repressions.ts): the orders they answered, and the parties they struck. */
  cases?: { orders: number[]; parties: string[] };
  /** The interior minister's watch this period, by party: what it adds to the blows aimed at the party (engine/ministers.ts). */
  watched?: Record<string, number>;
}

/** A party that ends this turn, and how. */
interface Ending {
  party: Party;
  how: PartyEnd;
  into?: string;
}

/**
 * One turn of the parties' lives on the player's politics, in place: the
 * wear-down of the outlawed and the folding of the empty, mergers, splits
 * and a rise. `before` is the state the turn began from.
 */
export function advanceParties(before: GameState, next: GameState, ctx: PartyContext, applied: AppliedChange[]): void {
  const politics = next.politics;
  // Before the game master has described the parties, there is nothing to live or die.
  if (!politics?.parties.length) return;
  const seed = before.seed ?? before.id;
  const dice = (key: string) => roll(seed, before.turn, `party:${key}`);
  const was = new Map((before.politics?.parties ?? []).map((p) => [p.id, p]));
  const own = movementParty(next)?.id;
  const police = policeState(next);
  const times = timesOf(before, next, applied, ctx.to, ctx.strain);
  const stability = 1 - politics.unrest / 100;
  const house = politics.parliament;
  const enemies = next.wars.flatMap((w) => (w.attackers.includes(next.player) ? w.defenders : w.defenders.includes(next.player) ? w.attackers : []));
  const young = (p: Party) => Boolean(p.origin && yearsBetween(p.origin.date, ctx.to) < GRACE_YEARS);
  let parties = politics.parties.map((p) => ({ ...p }));
  const endings: Ending[] = [];

  // The old government's parties, outlawed by the player's rising, fight on in the war: not an underground the rebels' police wear down (engine/civilWar.ts).
  const fighting = new Set((next.civilWars ?? []).filter((c) => !c.end && c.player === "rebels" && c.rebels === next.player).flatMap((c) => (c.outlawed ?? []).map((o) => o.id)));

  // 1. Wear-down and folding.
  for (const p of parties) {
    if (p.id === own || fighting.has(p.id)) continue;
    const backer = backerTag(next, p.backer);
    if (backer) p.backer = backer;
    else delete p.backer;
    if (!isOutlawed(p)) {
      delete p.strength;
      const camp = campOf(p.stance);
      const covered = parties.some((o) => o !== p && o.support > p.support && voice(o, camp) >= FOLD_COVER);
      if (p.status === "opposition" && !(p.seats ?? 0) && p.support < FOLD_SUPPORT && covered && !young(p) && dice(`fold:${p.id}`) < overTurn(FOLD_CHANCE, ctx.years)) endings.push({ party: p, how: "faded" });
      continue;
    }
    const prior = was.get(p.id);
    // Driven underground this turn, a party keeps the members it had in the open; one the game master brought in underground starts by its sympathy.
    const start = p.strength === undefined || (prior && !isOutlawed(prior)) ? defaultStrength(p.support) : p.strength;
    const end = next.mode === "historical" ? historyEnd(next, p) : undefined;
    const f: Pressure = {
      police,
      stability,
      repression: repressionOf(p, prior, ctx, next, applied),
      anchor: end && police >= 0.5 ? clamp(yearsBetween(end, ctx.to) + 1, HISTORY_EASE, 3) : 0,
      backing: backer ? (enemies.includes(backer) ? 0.5 : 0.4) : enemies.length ? 0.15 : 0,
      discontent: clamp((politics.unrest - 30) / 50, 0, 0.6),
      war: times.homeSoil ? 0.5 : 0,
      sympathy: clamp(p.support / 25, 0, 0.6),
    };
    const strength = wearOf(start, f, ctx.years, p.support);
    // As the organisation is broken, people stop counting themselves its own.
    if (strength < start && start > 0) p.support = round1(p.support * Math.sqrt(strength / start));
    p.strength = strength;
    if (strength < END_STRENGTH) {
      const pressure = f.police * (1 + f.repression) * (1 + f.anchor);
      endings.push({ party: p, how: pressure >= CRUSH_PRESSURE ? "crushed" : "faded" });
    }
  }
  const ended = new Set(endings.map((e) => e.party.id));
  parties = parties.filter((p) => !ended.has(p.id));

  // 2. Mergers: the closest pair of small legal parties, the larger keeping its name.
  const pairs: { a: Party; b: Party; d: number }[] = [];
  const mergeable = parties.filter((p) => p.id !== own && !p.unnamed && !young(p) && p.support < MERGE_SUPPORT && p.status === "opposition");
  for (let i = 0; i < mergeable.length; i += 1) {
    for (let j = i + 1; j < mergeable.length; j += 1) {
      const [a, b] = [mergeable[i], mergeable[j]];
      const d = distance(a.stance, b.stance);
      if (d < MERGE_DISTANCE) pairs.push({ a, b, d });
    }
  }
  const pair = pairs.sort((x, y) => x.d - y.d || x.a.id.localeCompare(y.a.id))[0];
  if (pair) {
    const squeeze = house?.threshold && pair.a.support < house.threshold && pair.b.support < house.threshold ? 1.5 : 1;
    if (dice(`merge:${pair.a.id}:${pair.b.id}`) < overTurn(0.3 * (1 - pair.d / MERGE_DISTANCE) * squeeze, ctx.years)) {
      const [big, small] = pair.a.support > pair.b.support || (pair.a.support === pair.b.support && pair.a.id < pair.b.id) ? [pair.a, pair.b] : [pair.b, pair.a];
      const total = big.support + small.support || 1;
      const mix = (k: keyof PartyStance) => round1((big.stance[k] * big.support + small.stance[k] * small.support) / total);
      big.stance = { economy: mix("economy"), freedom: mix("freedom"), nation: mix("nation") };
      big.support = round1(big.support + small.support);
      if (big.seats !== undefined || small.seats !== undefined) big.seats = (big.seats ?? 0) + (small.seats ?? 0);
      if (!big.backer && small.backer) big.backer = small.backer;
      endings.push({ party: small, how: "merged", into: big.name });
      parties = parties.filter((p) => p.id !== small.id);
      applied.push({ kind: "party", party: big.name, change: "merged", from: small.name });
    }
  }

  // An angry class swells the camps it leans to: angry workers the left, angry peasants the agrarians (engine/classes.ts).
  const opinion = opinionOf(next.scenarioId, times, campTilt(next.society?.[next.player]?.classes));
  const gaps = () => unrepresented(parties, opinion);
  const taken = new Set([...parties.map((p) => p.id), ...(politics.gone ?? []).map((g) => g.id), ...endings.map((e) => e.party.id)]);

  // 3. Splits: the party most divided, if the dice say its divide breaks it this period.
  if (parties.length < MAX_PARTIES) {
    const ruling = parties.find((p) => p.status === "ruling");
    const rift = (p: Party) => {
      const prior = was.get(p.id);
      const drift = p.was ? Math.abs(p.stance.economy - p.was.economy) + Math.abs(p.stance.freedom - p.was.freedom) + Math.abs(p.stance.nation - p.was.nation) : 0;
      const lost = prior && (prior.status === "ruling" || prior.status === "coalition") && p.status !== "ruling" && p.status !== "coalition" ? 0.35 : 0;
      const strain = p.status === "coalition" && ruling ? clamp((distance(p.stance, ruling.stance) - 7) / 8, 0, 1) * 0.3 : 0;
      const sum = clamp((p.support - 25) / 35, 0, 1) * 0.3 + lost + clamp(drift / 6, 0, 1) * 0.25 + strain + times.discontent * 0.15;
      // A dictatorship's party does not split in the open.
      return sum * (p.status === "ruling" ? 1 - 0.7 * police : 1);
    };
    const candidates = parties
      .filter((p) => p.id !== own && !fighting.has(p.id) && !p.unnamed && !young(p) && (isOutlawed(p) ? p.support >= 5 && (p.strength ?? 0) >= 30 : p.support >= 8))
      .map((p) => ({ p, rift: rift(p) }))
      .filter((x) => x.rift > SPLIT_RIFT)
      .sort((a, b) => b.rift - a.rift || a.p.id.localeCompare(b.p.id));
    const breaking = candidates.find(({ p, rift: r }) => dice(`split:${p.id}`) < overTurn(clamp((r - SPLIT_RIFT) * 0.8, 0, 0.4), ctx.years));
    if (breaking) {
      const parent = breaking.p;
      const share = 0.2 + 0.2 * dice(`split-share:${parent.id}`);
      // The splinter pulls toward the camp nearby that no one speaks for, else further out along its own strongest line.
      const gap = gaps();
      const toward = OPINION_CAMPS.map((c) => ({ c, pull: gap[c] * Math.max(0, 1 - distance(parent.stance, CAMP_STANCE[c]) / 14) })).sort((a, b) => b.pull - a.pull)[0];
      const target = toward.pull > 1 ? CAMP_STANCE[toward.c] : { economy: parent.stance.economy * 1.6, freedom: parent.stance.freedom * 1.6, nation: parent.stance.nation * 1.6 };
      const d = distance(parent.stance, target) || 1;
      const step = Math.min(4, d) / d;
      const stance = {
        economy: round1(clamp(parent.stance.economy + (target.economy - parent.stance.economy) * step, -10, 10)),
        freedom: round1(clamp(parent.stance.freedom + (target.freedom - parent.stance.freedom) * step, -10, 10)),
        nation: round1(clamp(parent.stance.nation + (target.nation - parent.stance.nation) * step, -10, 10)),
      };
      const camp = campOf(stance);
      const name = placeholder(camp, parties);
      const splinter: Party = {
        id: uniqueId(name, taken),
        name,
        ideology: "",
        support: round1(parent.support * share),
        status: parent.status === "ruling" || parent.status === "coalition" ? "opposition" : parent.status,
        stance,
        ...(parent.seats ? { seats: Math.round(parent.seats * share) } : house ? { seats: 0 } : {}),
        ...(isOutlawed(parent) ? { strength: round1((parent.strength ?? 0) * share) } : {}),
        origin: { how: "split", date: ctx.to, camp, from: parent.name },
        unnamed: true,
        was: stance,
      };
      parent.support = round1(parent.support - splinter.support);
      if (parent.seats) parent.seats -= splinter.seats ?? 0;
      if (isOutlawed(parent)) parent.strength = round1((parent.strength ?? 0) * (1 - share / 2));
      parties.push(splinter);
      applied.push({ kind: "party", party: splinter.name, change: "split", camp, from: parent.name });
    }
  }

  // 4. A rise: from the camp with the most opinion no party speaks for, while people are unhappy.
  const lastBorn = parties.map((p) => p.origin?.date).filter((d): d is string => Boolean(d)).sort().at(-1);
  if (parties.length < MAX_PARTIES && !(lastBorn && yearsBetween(lastBorn, ctx.to) < GRACE_YEARS)) {
    const gap = gaps();
    const camp = OPINION_CAMPS.reduce((best, c) => (gap[c] > gap[best] ? c : best), OPINION_CAMPS[0]);
    const yearly = clamp((gap[camp] - RISE_GAP) / 25, 0, MAX_RISE) * times.discontent * (1 - 0.85 * police);
    if (yearly > 0 && dice("rise") < overTurn(yearly, ctx.years)) {
      const laws = politics.laws ?? {};
      const hidden = police > 0.55 || laws.assembly === "banned" || laws.elections === "suspended";
      const jitter = (k: string) => round1((dice(`rise-${k}`) - 0.5) * 2);
      const c = CAMP_STANCE[camp];
      const stance = { economy: clamp(c.economy + jitter("economy"), -10, 10), freedom: clamp(c.freedom + jitter("freedom"), -10, 10), nation: clamp(c.nation + jitter("nation"), -10, 10) };
      const name = placeholder(camp, parties);
      const support = round1(clamp(gap[camp] * RISE_SHARE, ...RISE_SUPPORT));
      const why = DISCONTENTS.filter((k) => times.causes[k] >= 0.1).sort((a, b) => times.causes[b] - times.causes[a]);
      parties.push({
        id: uniqueId(name, taken),
        name,
        ideology: "",
        support,
        status: hidden ? "underground" : "opposition",
        stance,
        ...(house ? { seats: 0 } : {}),
        ...(hidden ? { strength: Math.round(12 + 10 * dice("rise-strength")) } : {}),
        origin: { how: "rose", date: ctx.to, camp, ...(why.length ? { why } : {}) },
        unnamed: true,
        was: stance,
      });
      applied.push({ kind: "party", party: name, change: "rose", camp });
    }
  }

  // The ended parties leave, with their plots; the record keeps them.
  const gone: GoneParty[] = [...(politics.gone ?? [])];
  let plots = politics.plots;
  for (const e of endings) {
    if (e.how !== "merged") applied.push({ kind: "party", party: e.party.name, change: e.how, ...(e.party.unnamed && e.party.origin ? { camp: e.party.origin.camp, unnamed: true, ...(e.party.origin.from ? { from: e.party.origin.from } : {}) } : {}) });
    gone.push(goneParty(e.party, e.how, { turn: ctx.turn, to: ctx.to }, e.into));
    if (e.how === "merged") continue;
    for (const plot of plots.filter((x) => !x.cabinet && (byParty(x.by, e.party) || byParty(x.title, e.party)))) {
      if (plot.known) applied.push({ kind: "plot", title: plot.title, change: "faded" });
      plots = plots.filter((x) => x !== plot);
    }
  }
  const out: Politics = { ...politics, parties, plots, ...(gone.length ? { gone: gone.slice(-MAX_GONE) } : {}) };
  // Shares are settled again only when a party came, went or lost its people; otherwise the turn's own figures stand.
  const reshaped = endings.length > 0 || parties.length !== politics.parties.length || parties.some((p, i) => p.id !== politics.parties[i]?.id || p.support !== politics.parties[i].support);
  next.politics = reshaped ? settle(out, was) : out;
}

/** Shares back to 100, seats within the house, and each party's change against the turn's start. */
function settle(politics: Politics, was: Map<string, Party>): Politics {
  const parties = fitSeats(normalise(politics.parties), politics.parliament?.seats).map((p) => ({ ...p, trend: round1(p.support - (was.get(p.id)?.support ?? 0)) }));
  return { ...politics, parties };
}

/** The name an engine-made party goes by until the game master names it: unique among the parties. */
function placeholder(camp: OpinionCamp, parties: Party[]): string {
  const base = `New ${camp} movement`;
  let name = base;
  for (let i = 2; parties.some((p) => lower(p.name) === lower(name)); i += 1) name = `${base} ${i}`;
  return name;
}

// ——— The game master's word ———

/** A name down to its letters and digits: "OUN (b)" and "oun-b" are one. */
const letters = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/**
 * The ended party a name the game master writes stands for, when no party
 * alive goes by it: by its id, name or short name, the same letters, or a
 * name history knows it by (scenarios/underground.ts) – "UPA" for a crushed
 * "OUN(b)", "Lithuanian partisans" for the LLKS.
 */
export function endedParty(state: Pick<GameState, "politics" | "scenarioId" | "player">, key: string): GoneParty | undefined {
  const p = state.politics;
  if (!p?.gone?.length || findParty(p.parties, key)) return undefined;
  const k = letters(key);
  const anchors = UNDERGROUND_ENDS.filter((a) => a.scenario === state.scenarioId && a.country === state.player && a.match.test(key));
  return (
    findParty(p.gone, key) ??
    p.gone.find((g) => Boolean(k) && (letters(g.name) === k || (g.short && letters(g.short) === k) || g.id === k)) ??
    p.gone.find((g) => anchors.some((a) => a.match.test([g.name, g.short ?? ""].join(" | "))))
  );
}

/**
 * The turn's word on the parties, checked against the state: nothing for a
 * party that has ended (it stays gone, under any name it went by), no new
 * plot of its, names only for the parties the engine made and not yet
 * named, and backers only governments the state knows. Returns what was
 * dropped.
 */
export function sanitizePartyWords(state: Pick<GameState, "politics" | "countries" | "player" | "scenarioId">, raw: PoliticsChange | undefined): { politics: PoliticsChange | undefined; dropped: number } {
  if (!raw || !state.politics) return { politics: raw, dropped: 0 };
  const current = state.politics.parties;
  const gone = state.politics.gone ?? [];
  let dropped = 0;
  const drop = () => {
    dropped += 1;
    return false;
  };
  const parties = raw.parties.filter((u) => !endedParty(state, u.party) || drop()).map((u) => (typeof u.backer === "string" ? { ...u, backer: backerTag(state, u.backer) } : u));
  // A plot the government does not know yet, by an underground that is no more, is not raised again.
  const known = new Set(state.politics.plots.map((x) => lower(x.title)));
  const plots = raw.plots.filter((u) => known.has(lower(u.title)) || !gone.some((g) => g.how !== "merged" && byParty(u.by, g)) || current.some((p) => byParty(u.by, p)) || drop());
  const seen = new Set<string>();
  const named = (raw.named ?? []).filter((n) => {
    const target = findParty(current, n.party);
    const clash = current.some((p) => p !== target && lower(p.name) === lower(n.name)) || Boolean(endedParty(state, n.name));
    const ok = Boolean(target?.unnamed) && !clash && !seen.has(target!.id);
    if (ok) seen.add(target!.id);
    else dropped += 1;
    return ok;
  });
  return { politics: { ...raw, parties, plots, named: named.length ? named : undefined }, dropped };
}

/** How a party ended, for the game master. */
const ENDED: Record<PartyEnd, string> = { crushed: "crushed by the state", faded: "faded away", merged: "merged", dissolved: "dissolved" };

/**
 * The parties' lives for the game master: the parties the engine made that
 * need a name, the organisations underground and how strong they are, and
 * the parties that no longer exist – those ended last period to be shown in
 * the story. `brief`: for the story, which does not name them.
 */
export function describePartyLife(politics: Politics, turn: number, brief = false): string[] {
  const lines: string[] = [];
  const unnamed = politics.parties.filter((p) => p.unnamed);
  if (unnamed.length) {
    lines.push(
      brief
        ? "New parties the engine made this period (the next stage names them; tell how they came about):"
        : "NEW PARTIES THE ENGINE MADE: name each in politics.named by its id – a name people of that time and place would give it, its short name, its leader and its ideology in a few words – and show how it came about:",
    );
    for (const p of unnamed) {
      const how = p.origin?.how === "split" ? `a faction that split from ${p.origin.from}` : "a new movement";
      const why = p.origin?.how === "rose" && p.origin.why?.length ? ` – rose from ${p.origin.why.join(", ")}` : "";
      lines.push(`- [${p.id}] ${how} of the ${p.origin?.camp ?? campOf(p.stance)} camp (economy ${p.stance.economy}, freedom ${p.stance.freedom}, nation ${p.stance.nation}), ${p.status}, support ${p.support}%${why}`);
    }
  }
  const under = politics.parties.filter((p) => isOutlawed(p) && p.strength !== undefined);
  if (under.length) {
    lines.push(
      `Organisations underground, strength 0–100 (the engine wears them down under repression – faster under a strong police state and a steady regime, slower with foreign backing, discontent or a war on the land – and ends them when broken; show raids, arrests and defections as they weaken): ${under.map((p) => `${p.name} ${Math.round(p.strength!)}${p.backer ? ` (backed by ${p.backer})` : ""}`).join("; ")}`,
    );
  }
  const gone = politics.gone ?? [];
  if (gone.length) {
    const fresh = gone.some((g) => g.turn === turn - 1);
    lines.push(
      `Parties that no longer exist – never list them in politics.parties or bring them back under any name${fresh ? "; tell the end of those ended LAST PERIOD in the story (the last arrests, the last fighters killed or giving themselves up, leaders fled abroad, members gone over to others)" : ""}: ${gone
        .map((g) => `${g.name} (${g.how === "merged" && g.into ? `merged into ${g.into}` : ENDED[g.how]} ${g.date.slice(0, 7)}${g.turn === turn - 1 ? ", LAST PERIOD" : ""})`)
        .join("; ")}`,
    );
  }
  return lines;
}

/** A save from before the parties lived (step 40): every outlawed party gets its organisation's strength from its sympathy. */
export function seedPartyStrength<T extends Pick<GameState, "politics">>(state: T): T {
  const p = state.politics;
  if (!p?.parties.some((x) => isOutlawed(x) && x.strength === undefined)) return state;
  return { ...state, politics: { ...p, parties: p.parties.map((x) => (isOutlawed(x) && x.strength === undefined ? { ...x, strength: defaultStrength(x.support) } : x)) } };
}

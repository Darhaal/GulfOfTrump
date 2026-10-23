import { z } from "zod";
import { combatPower } from "./arsenal";
import { ARMY_SECRECY, estimate, fogOn, knowledgeOf, type Estimate } from "./fog";
import type { GameState, War, WarLosses, WeaponKind } from "./types";

/**
 * What each war has cost its sides: soldiers killed and wounded, and weapons
 * lost, since it began. The turn's game master reports a period's dead and
 * wounded by war and side (`warLosses`); the engine keeps them within what
 * the armies and the fighting allow and works out the rest itself, as it
 * does for weapons (engine/arsenal.ts), whose losses it splits between a
 * country's wars. It is the war's own record: soldiers and people still
 * follow the economy and population fields, which already count the dead.
 */

const tag = z.string().trim().min(1).max(80);

/** The game master's word on a period's losses (merged into OutcomeSchema as `warLosses`): thousands of soldiers. */
export const warLossesField = z
  .array(
    z.object({
      war: z.string().trim().min(1).max(300),
      country: tag,
      killed: z.number().finite().min(0),
      wounded: z.number().finite().min(0).optional().catch(undefined),
    }),
  )
  .max(24)
  .catch([])
  .default([]);

export type WarLossWord = z.infer<typeof warLossesField>[number];

/** A period's losses checked against the state: the war by its id, within what a period of fighting can take. */
export interface WarLossEntry {
  war: string;
  country: string;
  killed: number;
  wounded?: number;
}

/** Share of a side's soldiers killed in a month of the hardest fighting: the most the game master may report. */
export const MAX_KILLED_MONTH = 0.05;
/** Share killed in a month of the heaviest fighting along a whole front, the engine's own figure: about the great wars' rate. */
const KILLED_MONTH = 0.01;
/** At war with no land front of its own: losses at sea and in the air, a small share of the land fighting's. */
const NO_FRONT = 0.03;
/** Wounded for every soldier killed, when the game master gives no figure; and the most it may give. */
export const WOUNDED_PER_KILLED = 3;
const MAX_WOUNDED_PER_KILLED = 5;
/** Under a truce: the most of a fighting period's losses the game master may still report (skirmishes, mines, snipers). */
const TRUCE_SHARE = 0.1;

/** Thousands to the nearest soldier. */
const round2 = (n: number) => Math.round(n * 1000) / 1000;

const sideOf = (war: Pick<War, "attackers" | "defenders">, country: string) => (war.attackers.includes(country) ? war.attackers : war.defenders.includes(country) ? war.defenders : null);
const enemiesIn = (war: Pick<War, "attackers" | "defenders">, country: string) => (war.attackers.includes(country) ? war.defenders : war.defenders.includes(country) ? war.attackers : []);

/** Provinces where a country fights the enemies of one war: contested by it, or held by it and contested by them. */
export function warFrontsOf(state: Pick<GameState, "regions">, war: Pick<War, "attackers" | "defenders">, country: string): number {
  const enemies = new Set(enemiesIn(war, country));
  let n = 0;
  for (const r of Object.values(state.regions)) {
    if (!r.contested) continue;
    if ((r.contested === country && enemies.has(r.controller)) || (r.controller === country && enemies.has(r.contested))) n += 1;
  }
  return n;
}

/** The wars a country fights this period, a truce aside. */
const fighting = (state: Pick<GameState, "wars">, country: string) => state.wars.filter((w) => !w.truce && sideOf(w, country));

/** The share of a country's soldiers that one war takes: by its fronts in each war it fights, evenly where it has none. */
function troopShare(state: Pick<GameState, "wars" | "regions">, war: War, country: string): number {
  const wars = fighting(state, country);
  if (wars.length <= 1) return 1;
  const fronts = wars.map((w) => warFrontsOf(state, w, country));
  const total = fronts.reduce((a, b) => a + b, 0);
  if (!total) return 1 / wars.length;
  const mine = fronts[wars.findIndex((w) => w.id === war.id)] ?? 0;
  return Math.max(0.1, mine / total);
}

/** What the engine expects a war to cost a country this period, thousands of soldiers, before the game master's word. */
export function expectedWarLosses(state: Pick<GameState, "countries" | "regions" | "wars" | "date">, war: War, country: string, years: number): { killed: number; wounded: number } {
  const troops = state.countries[country]?.economy?.troops ?? 0;
  if (war.truce || troops <= 0 || !sideOf(war, country)) return { killed: 0, wounded: 0 };
  const fronts = warFrontsOf(state, war, country);
  const intensity = fronts ? Math.min(1, 0.25 + fronts / 8) : NO_FRONT;
  const mine = Math.max(1, combatPower(state, country));
  const theirs = enemiesIn(war, country).reduce((sum, e) => sum + combatPower(state, e), 0);
  const factor = Math.min(1.6, Math.max(0.6, Math.sqrt(theirs / mine)));
  const killed = troops * troopShare(state, war, country) * KILLED_MONTH * intensity * factor * years * 12;
  return { killed: round2(killed), wounded: round2(killed * WOUNDED_PER_KILLED) };
}

/**
 * Keeps the game master's losses for wars that exist and countries that
 * fight them, once per war and country, and no more than a period of the
 * hardest fighting could kill from the soldiers that war takes; a truce
 * allows a tenth of that. Wounded stay within five for every one killed.
 */
export function sanitizeWarLosses(state: GameState, word: WarLossWord[], findWar: (key: string) => War | undefined, years: number): WarLossEntry[] {
  const seen = new Set<string>();
  return word.flatMap((l) => {
    const war = findWar(l.war);
    const troops = state.countries[l.country]?.economy?.troops ?? 0;
    if (!war || !sideOf(war, l.country) || troops <= 0) return [];
    const key = `${war.id}:${l.country}`;
    if (seen.has(key)) return [];
    seen.add(key);
    const most = troops * troopShare(state, war, l.country) * MAX_KILLED_MONTH * Math.max(0.25, years * 12) * (war.truce ? TRUCE_SHARE : 1);
    const killed = round2(Math.min(l.killed, most));
    const wounded = l.wounded === undefined ? undefined : round2(Math.min(l.wounded, Math.max(killed, 0.01) * MAX_WOUNDED_PER_KILLED));
    return [{ war: war.id, country: l.country, killed, ...(wounded !== undefined ? { wounded } : {}) }];
  });
}

/**
 * The period's losses join each war's record: the game master's figures
 * where it gave them, else the engine's; and every country's weapons lost
 * this period, split between the wars it fights by what each cost it in
 * men. `before` is the state the period began with. Mutates `next.wars`.
 */
export function recordWarLosses(next: GameState, before: GameState, word: WarLossEntry[], years: number, armsLost: Map<string, Partial<Record<WeaponKind, number>>>): void {
  const reported = new Map(word.map((l) => [`${l.war}:${l.country}`, l]));
  // What each war costs each country in men this period, for the record and to split its weapons lost.
  const cost = new Map<string, { killed: number; wounded: number }>();
  for (const war of next.wars) {
    const was = before.wars.find((w) => w.id === war.id);
    // A war the answer began fights from this period; one under a truce all period costs nothing unless reported.
    const asWas: War = was ? { ...war, truce: was.truce && war.truce ? was.truce : undefined } : { ...war, truce: undefined };
    for (const country of [...war.attackers, ...war.defenders]) {
      const r = reported.get(`${war.id}:${country}`);
      // The fronts the period's fighting opened count as much as those it began with.
      const wars = was ? before.wars : [...before.wars, asWas];
      const atStart = expectedWarLosses({ ...before, wars }, asWas, country, years);
      const atEnd = expectedWarLosses({ ...before, wars, regions: next.regions }, asWas, country, years);
      const expected = atEnd.killed > atStart.killed ? atEnd : atStart;
      const killed = r ? r.killed : expected.killed;
      const wounded = r ? (r.wounded ?? round2(r.killed * WOUNDED_PER_KILLED)) : expected.wounded;
      cost.set(`${war.id}:${country}`, { killed, wounded });
    }
  }
  for (const war of next.wars) {
    for (const country of [...war.attackers, ...war.defenders]) {
      const { killed, wounded } = cost.get(`${war.id}:${country}`)!;
      // The weapons the country lost this period, by this war's share of its dead.
      const lost = armsLost.get(country);
      const mine = next.wars.filter((w) => sideOf(w, country)).map((w) => cost.get(`${w.id}:${country}`)?.killed ?? 0);
      const total = mine.reduce((a, b) => a + b, 0);
      const wars = mine.length;
      const share = total > 0 ? killed / total : 1 / Math.max(1, wars);
      const arms: Partial<Record<WeaponKind, number>> = {};
      for (const [kind, n] of Object.entries(lost ?? {}) as [WeaponKind, number][]) {
        const part = round2(n * share);
        if (part >= 0.5) arms[kind] = part;
      }
      if (killed <= 0 && wounded <= 0 && !Object.keys(arms).length) continue;
      const had = war.losses?.[country];
      const sum: Partial<Record<WeaponKind, number>> = { ...(had?.arms ?? {}) };
      for (const [kind, n] of Object.entries(arms) as [WeaponKind, number][]) sum[kind] = round2((sum[kind] ?? 0) + n);
      const entry: WarLosses = { killed: round2((had?.killed ?? 0) + killed), wounded: round2((had?.wounded ?? 0) + wounded), ...(Object.keys(sum).length ? { arms: sum } : {}) };
      war.losses = { ...war.losses, [country]: entry };
    }
  }
}

/** Heavy weapons lost, in pieces: everything but rifles. */
export const heavyLost = (l: WarLosses | undefined) => Object.entries(l?.arms ?? {}).reduce((sum, [kind, n]) => (kind === "rifles" ? sum : sum + (n ?? 0)), 0);

/** A side's losses as the player's government knows them: its own exactly, the others' as its intelligence estimates them (engine/fog.ts). */
export interface LossesView {
  killed: Estimate;
  wounded: Estimate;
  heavy: Estimate;
}

export function lossesView(state: GameState, war: War, country: string): LossesView | null {
  const l = war.losses?.[country];
  if (!l) return null;
  const heavy = heavyLost(l);
  const exact = (n: number): Estimate => ({ value: n, low: n, high: n, exact: true });
  if (country === state.player || !fogOn(state)) return { killed: exact(l.killed), wounded: exact(l.wounded), heavy: exact(heavy) };
  const score = knowledgeOf(state, country).score - ARMY_SECRECY;
  const key = `losses:${war.id}:${country}`;
  return { killed: estimate(l.killed, score, state, `${key}:killed`), wounded: estimate(l.wounded, score, state, `${key}:wounded`), heavy: estimate(heavy, score, state, `${key}:heavy`) };
}

/** A war's record for the prompt: "losses so far (thousands killed/wounded): germany 16/48, poland 66/133". */
export function lossesLine(war: War): string {
  const entries = Object.entries(war.losses ?? {}).filter(([, l]) => l.killed > 0 || l.wounded > 0);
  if (!entries.length) return "";
  return ` | losses so far (thousands killed/wounded): ${entries.map(([c, l]) => `${c} ${Math.round(l.killed * 10) / 10}/${Math.round(l.wounded * 10) / 10}`).join(", ")}`;
}

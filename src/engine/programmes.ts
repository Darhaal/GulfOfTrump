import type { CountryState, PolicyKind, Programme } from "./types";

/**
 * What a policy does once a government has adopted it (engine/policies.ts),
 * and what a trade agreement brings: a programme that runs for some years
 * and shifts where the country's economy and politics drift – the growth
 * trend in economy.ts, the support and stability targets in abroad.ts. The
 * table is all there is to it, so the economy and politics read it without
 * importing the planners.
 */

export interface ProgrammeEffect {
  /** How long it runs, years. */
  years: number;
  /** Years before its growth shows. */
  lag: number;
  /** Growth it adds once it shows, points a year. */
  growth: number;
  /** Growth before then (a reform's first pain). */
  early?: number;
  /** Support and stability it moves, points, for the first `mood` years. */
  support?: number;
  stability?: number;
  mood?: number;
  /** Budget lines it adds while it runs, as shares of GDP. */
  lines?: Partial<Record<"army" | "industry" | "social" | "other", number>>;
}

export const PROGRAMMES: Record<PolicyKind | "trade", ProgrammeEffect> = {
  infrastructure: { years: 6, lag: 1, growth: 0.4, support: 1, mood: 2, lines: { industry: 0.006 } },
  industry: { years: 5, lag: 1, growth: 0.5, lines: { industry: 0.008 } },
  technology: { years: 6, lag: 2, growth: 0.4, lines: { industry: 0.003, other: 0.002 } },
  market: { years: 5, lag: 1, growth: 0.7, early: -0.6, support: -4, mood: 2 },
  austerity: { years: 3, lag: 0, growth: -0.5, support: -6, mood: 2 },
  stimulus: { years: 2, lag: 0, growth: 0.6, support: 3, mood: 1, lines: { social: 0.01 } },
  armament: { years: 4, lag: 0, growth: -0.1 },
  disarmament: { years: 3, lag: 0, growth: 0.1 },
  liberalise: { years: 3, lag: 0, growth: 0, support: 5, stability: -6, mood: 2 },
  crackdown: { years: 3, lag: 0, growth: 0, support: -6, stability: 6, mood: 3 },
  trade: { years: 8, lag: 0.5, growth: 0.25 },
};

/** Most a country's programmes together move its growth, points, and its support or stability. */
const MAX_GROWTH = 1.5;
const MAX_MOOD = 10;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const years = (from: string, to: string) => (Date.parse(to) - Date.parse(from)) / (365.25 * 86400000);

/** What one programme does on a date. */
export function programmeEffect(p: Programme, date: string): { growth: number; support: number; stability: number } {
  const e = PROGRAMMES[p.kind];
  const t = years(p.since, date);
  if (t < 0 || date >= p.until) return { growth: 0, support: 0, stability: 0 };
  const growth = t < e.lag ? (e.early ?? 0) : (p.gain ?? e.growth);
  const mood = t < (e.mood ?? 0);
  return { growth, support: mood ? (e.support ?? 0) : 0, stability: mood ? (e.stability ?? 0) : 0 };
}

/** What all a country's programmes do on a date: growth points, and support and stability points. */
export function programmeShift(c: Pick<CountryState, "programmes"> | undefined, date: string): { growth: number; support: number; stability: number } {
  let growth = 0;
  let support = 0;
  let stability = 0;
  for (const p of c?.programmes ?? []) {
    const e = programmeEffect(p, date);
    growth += e.growth;
    support += e.support;
    stability += e.stability;
  }
  return { growth: clamp(growth, -MAX_GROWTH, MAX_GROWTH), support: clamp(support, -MAX_MOOD, MAX_MOOD), stability: clamp(stability, -MAX_MOOD, MAX_MOOD) };
}

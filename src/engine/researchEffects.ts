import type { GameState, ResearchDirection } from "./types";

/**
 * What the player's research does, read from the year of technology each
 * direction has reached (engine/research.ts) against the calendar: a few
 * years ahead of history bring a little more growth, better weapons, more
 * food and medicine, sharper intelligence; years behind cost as much. Kept
 * apart from research.ts so the arsenal, the provision and the fog of war
 * can read it without importing research's own dependencies.
 */

type ResearchState = Pick<GameState, "research" | "date">;

/** The date as a year with its months. */
export const yearFraction = (date: string) => Number(date.slice(0, 4)) + (Number(date.slice(5, 7)) - 1) / 12;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** The year of technology a direction has reached: the calendar's when there is no research to read. */
export function techYear(state: ResearchState, direction: ResearchDirection): number {
  return state.research?.tech?.[direction] ?? yearFraction(state.date);
}

/** Years a direction is ahead of history (negative: behind). */
export function aheadOf(state: ResearchState, direction: ResearchDirection): number {
  return techYear(state, direction) - yearFraction(state.date);
}

/** Industry's and communications' parts of the growth bonus, before the bounds. */
export const industryGrowth = (state: ResearchState): number => 0.04 * aheadOf(state, "industry");
export const communicationsGrowth = (state: ResearchState): number => 0.02 * aheadOf(state, "communications");

/** Percentage points of GDP growth a year: industry and communications ahead of the world, or behind it. */
export function growthBonus(state: ResearchState): number {
  return clamp(industryGrowth(state) + communicationsGrowth(state), -0.3, 0.5);
}

/** What the arms money buys, against history's factories: industry's lead makes them more efficient. */
export function armsEfficiency(state: ResearchState): number {
  return 1 + clamp(0.02 * aheadOf(state, "industry"), -0.15, 0.25);
}

/** Share added to the harvest: better seed, fertiliser and machines. */
export function harvestBonus(state: ResearchState): number {
  return clamp(0.015 * aheadOf(state, "agriculture"), -0.1, 0.15);
}

/** Share added to medicine's provision. */
export function medicineBonus(state: ResearchState): number {
  return clamp(0.015 * aheadOf(state, "medicine"), -0.1, 0.12);
}

/** Percentage points added to the population's growth a year. */
export function populationBonus(state: ResearchState): number {
  return clamp(0.02 * aheadOf(state, "medicine"), -0.1, 0.2);
}

/** Points added to what the government knows of other countries: signals, computers and, early, satellites. */
export function intelligenceBonus(state: ResearchState): number {
  const satellites = techYear(state, "strategic") >= 1957 && yearFraction(state.date) < 1957 ? 5 : 0;
  return Math.round(clamp(aheadOf(state, "communications"), -5, 10)) + satellites;
}

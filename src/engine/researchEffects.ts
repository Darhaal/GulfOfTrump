import type { GameState, ResearchDirection } from "./types";

/**
 * What the player's research does, read from the year of technology each
 * direction has reached (engine/research.ts) against the calendar: a few
 * years ahead of history bring a larger economy, better weapons, more
 * food and medicine, sharper intelligence; years behind cost as much. Kept
 * apart from research.ts so the arsenal, the provision and the fog of war
 * can read it without importing research's own dependencies.
 */

type ResearchState = Pick<GameState, "research" | "date">;

/**
 * The date as a year with its days: 1950-07-02 is 1950.5. To the day, so a
 * weekly turn moves the calendar a week, as research moves it: by the month
 * alone the calendar stood still for four weeks and then jumped, and every
 * direction's lead rose and fell with it.
 */
export function yearFraction(date: string): number {
  const year = Number(date.slice(0, 4));
  const start = Date.UTC(year, 0, 1);
  const day = Date.UTC(year, Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)) || 1);
  return year + (day - start) / (Date.UTC(year + 1, 0, 1) - start);
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** The year of technology a direction has reached: the calendar's when there is no research to read. */
export function techYear(state: ResearchState, direction: ResearchDirection): number {
  return state.research?.tech?.[direction] ?? yearFraction(state.date);
}

/** Years a direction is ahead of history (negative: behind). */
export function aheadOf(state: ResearchState, direction: ResearchDirection): number {
  return techYear(state, direction) - yearFraction(state.date);
}

/**
 * Industry's and communications' parts of the economy's output, as shares of
 * it, before the bounds: a year of technology is about what a year of
 * history's progress added to output (1.5% for industry, half that for
 * communications), so a lead raises the economy's level – not its growth
 * forever – and losing the lead takes the gain back.
 */
export const industryOutput = (state: ResearchState): number => 0.015 * aheadOf(state, "industry");
export const communicationsOutput = (state: ResearchState): number => 0.0075 * aheadOf(state, "communications");

/** Share added to the economy's output by industry and communications ahead of the world (taken away behind it). */
export function outputBonus(state: ResearchState): number {
  return clamp(industryOutput(state) + communicationsOutput(state), -0.1, 0.2);
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

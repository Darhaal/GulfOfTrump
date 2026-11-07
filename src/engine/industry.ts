import { yearOf } from "./calendar";
import { heavyArms, LEAN_MAX, leanGoods, leanOf, MAX_TILT, splitGrowth, tiltOf } from "./development";
import { budgetNorms } from "./economy";
import { incomeOf, socialist } from "./society";
import type { Economy, GameState, MapRegion } from "./types";

/**
 * Light and heavy industry as two parts of the economy. Heavy industry –
 * steel, machines, chemicals, energy and arms, Soviet statistics' "group A"
 * – makes the means of production; light industry – cloth, shoes,
 * furniture, the food plants, "group B" – the goods people buy.
 *
 * How the two stand in a country's output is the usual for its income and
 * its system, moved by what the game did. The usual rises with income as
 * Hoffmann found it in every industrialising country (consumer goods first,
 * then capital goods: India and China about a quarter heavy around 1950,
 * Britain about half, the United States over half), and a planned economy
 * leans 25 points heavier (the Soviet Union's group A was 61% in 1940, 69%
 * in 1950, 74% by 1970; China's went from 36% in 1952 to 57% by 1978). The
 * government splits the industry line between the two (`Economy.tilt`,
 * points from the usual split, the player's and the industry minister's
 * lever); the structure follows the money over years (`Economy.lean`,
 * points from the usual share: about six years at the era's usual line,
 * faster with more money), and a system changed overnight leaves its plants
 * as they were – the usual moves, the structure does not.
 *
 * What each feeds is read off the structure and the split
 * (engine/development.ts): heavy industry past the usual makes the arms
 * money buy more (the steel and the plants at hand) and the money tilted to
 * it adds growth (the machines the rest is built with); light industry past
 * the usual holds the people's goods up and the money tilted to it takes a
 * little growth; heavy industry past the usual takes the goods from the
 * shops – the queues of a planned economy. The trend tables already carry
 * what a system's usual structure gave (engine/economy.ts), so every effect
 * is measured from the usual for the era, income and system, never twice.
 * Pure.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

/** Points a planned economy's usual structure leans to heavy industry past a market economy's at the same income. */
export const PLANNED_HEAVY = 25;
/** The structure follows the split over this many years (63% of the way) at the era's usual industry line. */
const STRUCTURE_YEARS = 6;
/** The bounds of the usual heavy share, %. */
const NORM_BOUNDS = [12, 85] as const;

type IndustryState = Pick<GameState, "countries" | "player" | "date" | "scenarioId" | "regions" | "wars"> & Partial<Pick<GameState, "politics" | "society" | "variant" | "sanctions">>;

/**
 * How planned a country's economy is, 0 (a market) to 1 (planned as the
 * Soviet states planned theirs): the player's economic law when its laws are
 * known; else a socialist government's, fully until 1992 and less after (a
 * party state that runs a market, as China's and Vietnam's do).
 */
export function plannedness(state: Pick<GameState, "countries" | "player" | "date"> & Partial<Pick<GameState, "politics">>, tag: string): number {
  if (tag === state.player) {
    const law = state.politics?.laws?.economy;
    if (law === "planned") return 1;
    if (law === "mixed") return 0.4;
    if (law === "market") return 0;
  }
  if (!socialist(state, tag)) return 0;
  return yearOf(state.date) <= 1992 ? 1 : 0.4;
}

/** Heavy industry's usual share of industrial output in a market economy at this real income per head (dollars of 2019), %: the richer, the heavier. */
export function marketHeavy(income: number): number {
  return clamp(25 + 7 * Math.log2(Math.max(250, income) / 1000), 18, 62);
}

/** Heavy industry's usual share of output, %, for an income and how planned the economy is. */
export const heavyNorm = (income: number, planned: number): number => round1(clamp(marketHeavy(income) + PLANNED_HEAVY * clamp(planned, 0, 1), NORM_BOUNDS[0], NORM_BOUNDS[1]));

/** A country's two industries now. Shares %, money $bn a year. */
export interface Industry {
  /** Heavy and light industry's shares of industrial output. */
  heavy: number;
  light: number;
  /** The usual heavy share for the era, income and system. */
  norm: number;
  /** How planned the economy is, 0–1. */
  planned: number;
  /** The split of the industry line: points moved to heavy industry from the usual (negative: to light), and the heavy share it makes. */
  tilt: number;
  split: number;
  /** The industry line, and what goes to each. */
  money: number;
  heavyMoney: number;
  lightMoney: number;
  /** Points heavy industry stands past the usual share. */
  lean: number;
  /** What it feeds: the arms money's worth against the usual (1.05: 5% more), growth points a year from the split, goods points from the structure. */
  arms: number;
  growth: number;
  goods: number;
}

/** The industry line against the era's usual share of GDP. */
function lineRatio(state: Pick<GameState, "regions" | "scenarioId" | "countries">, tag: string, e: Pick<Economy, "gdp" | "budget">): number {
  const norm = budgetNorms(state, tag, null).industry;
  return norm > 0 ? Math.max(0, e.budget.industry) / Math.max(0.01, e.gdp) / norm : 1;
}

/** A country's light and heavy industry, or null without an economy or people. */
export function industryOf(state: IndustryState, map: Record<string, MapRegion> | null | undefined, tag: string): Industry | null {
  const e = state.countries[tag]?.economy;
  if (!e || !map) return null;
  const income = incomeOf(state, map, tag);
  if (income === null) return null;
  const planned = plannedness(state, tag);
  const norm = heavyNorm(income, planned);
  const lean = leanOf(e);
  const tilt = tiltOf(e);
  const heavy = round1(clamp(norm + lean, 5, 95));
  const split = round1(clamp(norm + tilt, 5, 95));
  const money = Math.max(0, e.budget.industry);
  return {
    heavy,
    light: round1(100 - heavy),
    norm,
    planned,
    tilt,
    split,
    money,
    heavyMoney: (money * split) / 100,
    lightMoney: (money * (100 - split)) / 100,
    lean: round1(lean),
    arms: Math.round(heavyArms(e) * 1000) / 1000,
    growth: splitGrowth(tilt, lineRatio(state, tag, e)),
    goods: Math.round(leanGoods(lean) * 1000) / 10,
  };
}

/**
 * The structure after a turn, in place on `next`: every country's moves
 * towards its split, faster the more its industry line, and a system changed
 * this turn (a law, a revolution, a fall) leaves its plants where they were
 * against the new usual. Kept only while it stands apart from the usual.
 */
export function advanceIndustry(before: Pick<GameState, "countries" | "player" | "date" | "politics">, next: GameState, years: number): void {
  if (years <= 0) return;
  for (const [tag, c] of Object.entries(next.countries)) {
    const e = c.economy;
    if (!e) continue;
    const tilt = tiltOf(e);
    let lean = leanOf(e);
    if (before.countries[tag]?.economy) lean -= PLANNED_HEAVY * (plannedness(next, tag) - plannedness(before, tag));
    const pace = clamp(lineRatio(next, tag, e), 0.25, 2) / STRUCTURE_YEARS;
    lean = clamp(tilt + (lean - tilt) * Math.exp(-years * pace), -LEAN_MAX, LEAN_MAX);
    const kept = Math.round(lean * 100) / 100;
    if (Math.abs(kept) >= 0.05) e.lean = kept;
    else delete e.lean;
    if (e.tilt !== undefined && !tilt) delete e.tilt;
  }
}

/** The player's government splits the industry line between heavy and light industry: points to heavy (negative: to light) from the usual split, which also becomes the industry minister's baseline. */
export function setSplit<T extends Pick<GameState, "countries" | "player" | "ministers" | "updatedAt">>(state: T, tilt: number, now = new Date()): T {
  const country = state.countries[state.player];
  const e = country?.economy;
  if (!e || !Number.isFinite(tilt)) return state;
  const t = Math.round(clamp(tilt, -MAX_TILT, MAX_TILT));
  const economy: Economy = { ...e };
  if (t) economy.tilt = t;
  else delete economy.tilt;
  return { ...state, countries: { ...state.countries, [state.player]: { ...country, economy } }, ministers: { ...state.ministers, set: { ...state.ministers?.set, tilt: t } }, updatedAt: now.toISOString() };
}

/** "+3" or "−2": a signed figure for the prompt. */
const signed = (n: number, digits = 0) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(Math.round(n * 10 ** digits) / 10 ** digits)}`;

/**
 * The player's two industries for the game master, in a line: the shares,
 * the usual, the split of the industry line and what each feeds, so the
 * story's shops, queues, plants and arms match the engine's.
 */
export function industryLine(state: IndustryState, map: Record<string, MapRegion> | null | undefined): string {
  const i = industryOf(state, map, state.player);
  if (!i) return "";
  const system = i.planned >= 0.7 ? "a planned economy" : i.planned > 0 ? "a mixed economy" : "a market economy";
  const parts = [
    `industry: heavy ${Math.round(i.heavy)}% of output (steel, machines, chemicals, energy, arms), light ${Math.round(i.light)}% (cloth, shoes, furniture, food plants); usual for ${system} at this income: heavy ${Math.round(i.norm)}%`,
    `the industry line is split ${Math.round(i.split)}% heavy / ${Math.round(100 - i.split)}% light${i.tilt ? ` (the government moved ${Math.abs(i.tilt)} points to ${i.tilt > 0 ? "heavy" : "light"} industry)` : ""}`,
  ];
  const effects = [
    Math.abs(i.arms - 1) >= 0.005 ? `the arms money buys ${signed((i.arms - 1) * 100)}%` : "",
    Math.abs(i.goods) >= 0.5 ? `everyday goods ${signed(i.goods)} points` : "",
    Math.abs(i.growth) >= 0.05 ? `growth ${signed(i.growth, 2)} a year from the split` : "",
  ].filter(Boolean);
  if (Math.abs(i.lean) >= 1 || effects.length) parts.push(`heavy industry stands ${signed(i.lean)} points from the usual${effects.length ? `: ${effects.join(", ")}` : ""}`);
  parts.push("heavy industry past the usual means queues and shortages in the shops but more arms; light industry past it, goods and contented workers");
  return parts.join("; ");
}

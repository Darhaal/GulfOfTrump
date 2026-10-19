import type { ResourceType } from "./resources";
import type { ScenarioId } from "./types";

/**
 * Real amounts for the game's resource points. A province's output is a
 * point score against the leading region of its day, compressed like a
 * square root; squared and summed over the world it is scaled to the real
 * world output of the start date, so a country's points read as tonnes
 * (cubic metres for gas) a year. The points of the start dates follow each
 * region's real output, so the main producers come out near their real
 * figures; output nobody maps (small mines, wildcat fields) lifts them a
 * little.
 */

/** What a resource is counted in. */
export const MEASURE: Record<ResourceType, "t" | "m3"> = {
  oil: "t",
  gas: "m3",
  coal: "t",
  iron: "t",
  copper: "t",
  gold: "t",
  nickel: "t",
  tin: "t",
  bauxite: "t",
  rubber: "t",
  uranium: "t",
};

/**
 * World output a year on each start date, as in the year before it: tonnes
 * (iron as usable ore, copper, nickel and tin as metal in ore, uranium as
 * metal), gas in cubic metres.
 */
export const WORLD_OUTPUT: Record<ScenarioId, Record<ResourceType, number>> = {
  "1914": { oil: 55e6, gas: 17e9, coal: 1340e6, iron: 175e6, copper: 1.0e6, gold: 700, nickel: 30e3, tin: 130e3, bauxite: 540e3, rubber: 120e3, uranium: 0 },
  "1939": { oil: 285e6, gas: 75e9, coal: 1450e6, iron: 200e6, copper: 2.2e6, gold: 1200, nickel: 120e3, tin: 180e3, bauxite: 4.4e6, rubber: 1.0e6, uranium: 800 },
  "1991": { oil: 3150e6, gas: 2050e9, coal: 4700e6, iron: 950e6, copper: 9.0e6, gold: 2150, nickel: 930e3, tin: 180e3, bauxite: 110e6, rubber: 5.2e6, uranium: 40e3 },
  "2014": { oil: 4130e6, gas: 3370e9, coal: 7900e6, iron: 2250e6, copper: 18.3e6, gold: 3000, nickel: 2.6e6, tin: 300e3, bauxite: 280e6, rubber: 12e6, uranium: 59.6e3 },
  "2022": { oil: 4220e6, gas: 4040e9, coal: 8170e6, iron: 2600e6, copper: 21.2e6, gold: 3000, nickel: 2.7e6, tin: 300e3, bauxite: 390e6, rubber: 14e6, uranium: 48.3e3 },
};

/** Barrels in a tonne of crude. */
export const BARRELS_PER_TONNE = 7.33;

/** Real units a year per point of each resource, given the world's points. */
export function unitsPerPoint(era: ScenarioId, world: Partial<Record<ResourceType, number>>): Partial<Record<ResourceType, number>> {
  const out: Partial<Record<ResourceType, number>> = {};
  for (const [type, points] of Object.entries(world) as [ResourceType, number][]) {
    const real = WORLD_OUTPUT[era][type];
    if (points > 0 && real > 0) out[type] = real / points;
  }
  return out;
}

export type AmountUnit = "t" | "kt" | "mt" | "gt" | "m3m" | "m3b";

/** An amount in the largest unit that keeps it above one: 535 million t, 18 billion m³, 310 thousand t. */
export function scaleAmount(value: number, measure: "t" | "m3"): { n: number; unit: AmountUnit } {
  const v = Math.abs(value);
  if (measure === "m3") return v >= 1e9 ? { n: value / 1e9, unit: "m3b" } : { n: value / 1e6, unit: "m3m" };
  if (v >= 1e9) return { n: value / 1e9, unit: "gt" };
  if (v >= 1e6) return { n: value / 1e6, unit: "mt" };
  if (v >= 1e3) return { n: value / 1e3, unit: "kt" };
  return { n: value, unit: "t" };
}

/** Three significant figures at most, no trailing noise: 535, 42.7, 3.1, 0.25. */
export function roundAmount(n: number): number {
  const v = Math.abs(n);
  const digits = v >= 100 ? 0 : v >= 10 ? 1 : v >= 1 ? 1 : 2;
  return Math.round(n * 10 ** digits) / 10 ** digits;
}

const EN_UNIT: Record<AmountUnit, string> = { t: "t", kt: "thousand t", mt: "million t", gt: "billion t", m3m: "million m3", m3b: "billion m3" };

/** "535 million t", "18 billion m3": an amount for the game master. */
export function amountEn(value: number, type: ResourceType): string {
  const { n, unit } = scaleAmount(value, MEASURE[type]);
  return `${roundAmount(n)} ${EN_UNIT[unit]}`;
}

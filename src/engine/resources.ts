import type { MapRegion } from "./types";

/** Strategic resources, as listed in scripts/resources.mjs. */
export const RESOURCE_TYPES = ["oil", "gas", "coal", "iron", "copper", "gold", "nickel", "tin", "bauxite", "rubber", "uranium"] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

/** Output checkpoints, [year, output 0–10], oldest first. */
export type ResourceCurve = [number, number][];
/** A resource of a province and how its output changed over time. */
export type ResourceEntry = [ResourceType, ResourceCurve];

export interface ResourceOutput {
  type: ResourceType;
  /** 1–10 against the leading region of its day, square-root compressed, one decimal. */
  output: number;
}

/** Output in a year: nothing before the first checkpoint, linear between them, the last one after. */
export function outputAt(curve: ResourceCurve, year: number): number {
  if (!curve.length || year < curve[0][0]) return 0;
  for (let i = 1; i < curve.length; i += 1) {
    const [y1, v1] = curve[i];
    if (year < y1) {
      const [y0, v0] = curve[i - 1];
      return v0 + ((v1 - v0) * (year - y0)) / (y1 - y0);
    }
  }
  return curve[curve.length - 1][1];
}

/**
 * Output on a straight scale, 10 for the leading region: squaring undoes the
 * points' square-root compression, so a region with a quarter of the
 * leader's output counts 2.5, not 5, and sums are in proportion to tonnes.
 */
export const linearOutput = (points: number) => (points * points) / 10;

/** Output below this is a field that closed or has not really started. */
const MIN_OUTPUT = 0.5;

/** What a province yields in a year, biggest first. */
export function activeResources(region: Pick<MapRegion, "res"> | undefined, year: number): ResourceOutput[] {
  if (!region?.res) return [];
  return region.res
    .map(([type, curve]) => ({ type, output: Math.round(outputAt(curve, year) * 10) / 10 }))
    .filter((r) => r.output >= MIN_OUTPUT)
    .sort((a, b) => b.output - a.output);
}

/** Output of one resource in a province in a year (0 when it has none). */
export function resourceOutput(region: Pick<MapRegion, "res"> | undefined, type: ResourceType, year: number): number {
  return activeResources(region, year).find((r) => r.type === type)?.output ?? 0;
}

/** "oil 9.5, coal 4" — the form the prompt and the turn report use. */
export function formatResources(list: ResourceOutput[]): string {
  return list.map((r) => `${r.type} ${r.output}`).join(", ");
}

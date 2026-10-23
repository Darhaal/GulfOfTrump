import type { ResourceType } from "@/engine/resources";
import type { Side } from "@/engine/sides";
import type { Terrain } from "@/engine/types";

/**
 * Map-mode colours. Like country colours they are data, the same in both
 * themes: a terrain map reads the same by day and by night.
 */
export const TERRAIN_COLORS: Record<Terrain, string> = {
  plains: "#b9cf8a",
  forest: "#5f8f5a",
  hills: "#c2a96f",
  mountains: "#9b8a7a",
  desert: "#e6d29a",
  tundra: "#cfd9dc",
  jungle: "#3f7a4a",
  wetlands: "#7fa8a0",
};

const FERTILITY_STOPS: [number, [number, number, number]][] = [
  [0, [214, 196, 160]],
  [35, [196, 196, 120]],
  [65, [126, 176, 96]],
  [100, [46, 120, 64]],
];

/** Barren sand to rich green. */
export function fertilityColor(value: number): string {
  const v = Math.max(0, Math.min(100, value));
  for (let i = 1; i < FERTILITY_STOPS.length; i += 1) {
    const [x1, c1] = FERTILITY_STOPS[i];
    const [x0, c0] = FERTILITY_STOPS[i - 1];
    if (v <= x1) {
      const t = (v - x0) / (x1 - x0);
      const mix = c0.map((c, k) => Math.round(c + (c1[k] - c) * t));
      return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`;
    }
  }
  return "rgb(46, 120, 64)";
}


/** One colour per strategic resource, for the resources mode and its legend. */
export const RESOURCE_COLORS: Record<ResourceType, string> = {
  oil: "#6a3fa0",
  gas: "#7aa6d6",
  coal: "#3f3f3f",
  iron: "#b5523b",
  copper: "#d08a45",
  gold: "#e3b93c",
  nickel: "#8fa3a8",
  tin: "#b9c2c9",
  bauxite: "#c76f8e",
  rubber: "#4f9a5a",
  uranium: "#9ccf3c",
};

/** Grey land of the resource and transport maps: a theme token, light or dark. */
export const QUIET_LAND = "var(--map-quiet)";

/** The diplomatic view's colours, theme tokens: the country it is about, allies green, enemies red, pacts and truces muted. */
export const SIDE_FILL: Record<Side, string> = {
  self: "var(--map-self)",
  ally: "var(--map-ally)",
  partner: "var(--map-partner)",
  pact: "var(--map-pact)",
  truce: "var(--map-pact)",
  enemy: "var(--map-enemy)",
};

/** A country's colour in the diplomatic view: by its side, or the quiet land when it has none. */
export const sideFill = (side: Side | undefined) => (side ? SIDE_FILL[side] : QUIET_LAND);

/** A resource's colour laid over the grey land, deeper with output (0–10). */
export function resourceTint(color: string, output: number, floor = 30): string {
  if (output <= 0) return QUIET_LAND;
  const share = Math.round(floor + (100 - floor) * Math.sqrt(Math.min(10, output) / 10));
  return `color-mix(in srgb, ${color} ${share}%, ${QUIET_LAND})`;
}

const hex = (color: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16)) as [number, number, number];
const rgb = ([r, g, b]: number[]) => `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;

/** A colour moved towards another by t (0 = a, 1 = b); both #rrggbb. */
export function mix(a: string, b: string, t: number): string {
  const ca = hex(a);
  const cb = hex(b);
  return rgb(ca.map((c, i) => c + (cb[i] - c) * t));
}

/** People per km², on a log scale: empty steppe to megacity. */
export const DENSITY_STOPS: [number, string][] = [
  [0, "#f3eee0"],
  [2, "#ece0bd"],
  [10, "#efc88a"],
  [40, "#e79a5c"],
  [150, "#d2623f"],
  [500, "#a8353b"],
  [2000, "#5f1d3a"],
];

export function densityColor(perKm2: number): string {
  if (perKm2 <= 0) return DENSITY_STOPS[0][1];
  const at = (v: number) => Math.log10(v + 1);
  const v = at(perKm2);
  for (let i = 1; i < DENSITY_STOPS.length; i += 1) {
    const [x1, c1] = DENSITY_STOPS[i];
    const [x0, c0] = DENSITY_STOPS[i - 1];
    if (v <= at(x1)) return mix(c0, c1, (v - at(x0)) / (at(x1) - at(x0)));
  }
  return DENSITY_STOPS[DENSITY_STOPS.length - 1][1];
}

/** Country colours softened towards paper for the political map: the same hues, less shout. */
export const softened = (color: string) => (color.startsWith("#") ? mix(color, "#f1ede4", 0.16) : color);

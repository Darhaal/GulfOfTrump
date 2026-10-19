import type { CityKind } from "./cities";

/** A place projected into map units, ready to be laid out. */
export interface PlacePoint {
  name: string;
  px: number;
  py: number;
  kind: CityKind;
  /** The zoom from which the place may be drawn. */
  minZoom: number;
  /** Higher wins a spot when labels would collide. */
  priority: number;
  /** Dot radius on screen, larger for bigger places (see placeRadius). */
  r: number;
}

/** A dot's radius in pixels by importance: a capital's ring, then by population (thousands). */
export function placeRadius(kind: CityKind, pop: number): number {
  if (kind === "capital") return 3;
  return Math.min(3, Math.max(1, 0.7 + 0.6 * Math.log10(pop + 1)));
}

/** From this zoom every place that fits gets its dot, even where its name does not. */
export const ALL_DOTS_ZOOM = 10;

export interface PlacedLabel {
  place: PlacePoint;
  /** Where the name goes relative to the dot; null for a capital whose name found no room. */
  side: "right" | "left" | "above" | "below" | null;
}

/** Size of a place's name on screen, in pixels. */
export const PLACE_STYLE: Record<CityKind, { font: number }> = {
  capital: { font: 11.5 },
  city: { font: 10.5 },
  seat: { font: 9.5 },
  town: { font: 9 },
};

/** A rough width of a name in a given font size: enough to keep names apart. */
const textWidth = (name: string, font: number) => name.length * font * 0.58 + 2;

/** Places on a uniform grid of map cells, for fast "what is in this rectangle" queries. */
export class PlaceIndex {
  private cells = new Map<string, PlacePoint[]>();

  constructor(
    points: PlacePoint[],
    private size = 8,
  ) {
    for (const p of points) {
      const key = this.key(p.px, p.py);
      const list = this.cells.get(key);
      if (list) list.push(p);
      else this.cells.set(key, [p]);
    }
  }

  private key(x: number, y: number) {
    return `${Math.floor(x / this.size)},${Math.floor(y / this.size)}`;
  }

  /** Places inside the rectangle (map units) that may show at zoom k, most important first. */
  query(x0: number, y0: number, x1: number, y1: number, k: number): PlacePoint[] {
    const out: PlacePoint[] = [];
    for (let gx = Math.floor(x0 / this.size); gx <= Math.floor(x1 / this.size); gx += 1) {
      for (let gy = Math.floor(y0 / this.size); gy <= Math.floor(y1 / this.size); gy += 1) {
        for (const p of this.cells.get(`${gx},${gy}`) ?? []) {
          if (p.minZoom <= k && p.px >= x0 && p.px <= x1 && p.py >= y0 && p.py <= y1) out.push(p);
        }
      }
    }
    return out.sort((a, b) => b.priority - a.priority);
  }
}

type Box = [number, number, number, number];

/**
 * Which places to draw on screen and where their names go, so no two names
 * or dots overlap: the most important place takes its spot first, then each
 * next one tries right, left, above and below its dot. A place whose name
 * finds no room keeps only its dot if it is a capital, or from
 * ALL_DOTS_ZOOM on, so the closest view shows every town.
 * Coordinates are SVG viewBox units for a view {k, x, y}; sizes are pixels,
 * `unit` viewBox units to a pixel; `obstacles` are boxes already taken
 * (country names).
 */
export function layoutPlaces(
  candidates: PlacePoint[],
  view: { k: number; x: number; y: number },
  width: number,
  height: number,
  obstacles: Box[] = [],
  unit = 1,
): PlacedLabel[] {
  const CELL = 40;
  const grid = new Map<string, Box[]>();
  const cellsOf = ([x0, y0, x1, y1]: Box) => {
    const keys: string[] = [];
    for (let gx = Math.floor(x0 / CELL); gx <= Math.floor(x1 / CELL); gx += 1) {
      for (let gy = Math.floor(y0 / CELL); gy <= Math.floor(y1 / CELL); gy += 1) keys.push(`${gx},${gy}`);
    }
    return keys;
  };
  const hits = (b: Box) =>
    cellsOf(b).some((key) => (grid.get(key) ?? []).some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]));
  const take = (b: Box) => {
    for (const key of cellsOf(b)) {
      const list = grid.get(key);
      if (list) list.push(b);
      else grid.set(key, [b]);
    }
  };
  obstacles.forEach(take);

  // Breathing room around every name and dot, so a busy region still reads.
  const PAD = 5 * unit;
  const out: PlacedLabel[] = [];
  for (const place of candidates) {
    const sx = place.px * view.k + view.x;
    const sy = place.py * view.k + view.y;
    if (sx < -20 || sx > width + 20 || sy < -20 || sy > height + 20) continue;
    const font = PLACE_STYLE[place.kind].font * unit;
    const r = place.r * unit;
    const dotOnly = () => {
      // No room for a name: the dot alone, where dots do not touch.
      if (place.kind !== "capital" && view.k < ALL_DOTS_ZOOM) return;
      const tight: Box = [sx - r - 1.5 * unit, sy - r - 1.5 * unit, sx + r + 1.5 * unit, sy + r + 1.5 * unit];
      if (hits(tight)) return;
      take([sx - r - 0.5 * unit, sy - r - 0.5 * unit, sx + r + 0.5 * unit, sy + r + 0.5 * unit]);
      out.push({ place, side: null });
    };
    const dot: Box = [sx - r - PAD, sy - r - PAD, sx + r + PAD, sy + r + PAD];
    if (hits(dot)) {
      dotOnly();
      continue;
    }
    const w = textWidth(place.name, font);
    const h = font * 1.15;
    const gap = r * 1.7;
    const sides: [PlacedLabel["side"], Box][] = [
      ["right", [sx + gap, sy - h / 2 - PAD, sx + gap + w + PAD, sy + h / 2 + PAD]],
      ["left", [sx - gap - w - PAD, sy - h / 2 - PAD, sx - gap, sy + h / 2 + PAD]],
      ["above", [sx - w / 2 - PAD, sy - gap - h - PAD, sx + w / 2 + PAD, sy - gap]],
      ["below", [sx - w / 2 - PAD, sy + gap, sx + w / 2 + PAD, sy + gap + h + PAD]],
    ];
    const free = sides.find(([, box]) => !hits(box));
    if (!free) {
      dotOnly();
      continue;
    }
    take([sx - r - unit, sy - r - unit, sx + r + unit, sy + r + unit]);
    take(free[1]);
    out.push({ place, side: free[0] });
  }
  return out;
}

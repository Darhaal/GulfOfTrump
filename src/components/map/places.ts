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
  /** Dot radius on screen, pixels, by the place's size (see placeRadius); the closest zooms grow it to the city's real extent. */
  r: number;
  /** The city's built-up radius in map units (see cityRadiusKm): its true size once the zoom shows it. */
  extent?: number;
  /** English name on the map files: the key the game state uses for towns. */
  key?: string;
  /** People on the start date, thousands. */
  pop?: number;
}

/**
 * A dot's radius in pixels by size, in steps: a capital, then by population
 * (thousands). Fixed on screen whatever the zoom, so a dot never shrinks as
 * the map comes closer.
 */
export function placeRadius(kind: CityKind, pop: number): number {
  const bySize = pop >= 5000 ? 4.2 : pop >= 1000 ? 3.5 : pop >= 400 ? 2.9 : pop >= 100 ? 2.3 : pop >= 25 ? 1.8 : 1.4;
  return kind === "capital" ? Math.max(3.8, bySize) : bySize;
}

/** People per km² of a built-up city, on average across the eras. */
const URBAN_DENSITY = 4500;

/** A city's built-up radius in km: the area its people would cover at an average city's density. */
export const cityRadiusKm = (pop: number) => Math.sqrt((Math.max(pop, 1) * 1000) / URBAN_DENSITY / Math.PI);

/**
 * A dot's radius on screen in viewBox units at zoom k: the size step, a
 * little smaller on the widest views so the world map stays quiet, and from
 * the zoom where the city's true extent is larger, that extent. It only
 * grows as the zoom does.
 */
export function dotRadius(place: Pick<PlacePoint, "r" | "extent">, k: number, unit = 1): number {
  const quiet = Math.min(1, 0.65 + (0.35 * Math.max(0, k - 1)) / 3);
  return Math.max(place.r * quiet * unit, (place.extent ?? 0) * k);
}

/** How far a name sits from its dot's centre, in viewBox units: just past the dot's edge. */
export const labelGap = (r: number, unit = 1) => r + 2.5 * unit;

/** From this zoom a place whose name finds no room keeps its dot wherever dots do not touch; closer still, they may sit nearer. */
export const ALL_DOTS_ZOOM = 3;

/** The most places drawn at once: enough for the closest zoom, few enough for a smooth map. */
export const MAX_PLACED = 1400;

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
 * finds no room keeps only its dot (its name shows on hover) if it is a
 * capital, or from ALL_DOTS_ZOOM on, where dots do not touch; the closer the
 * zoom, the closer dots may sit, so the closest view shows every town. No
 * more than MAX_PLACED places are drawn.
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
  // Dots alone keep this much air between them: more on wide views, less close in.
  const air = (view.k < 6 ? 4 : view.k < 12 ? 2.5 : 1.5) * unit;
  for (const place of candidates) {
    if (out.length >= MAX_PLACED) break;
    const sx = place.px * view.k + view.x;
    const sy = place.py * view.k + view.y;
    const r = dotRadius(place, view.k, unit);
    if (sx < -20 - r || sx > width + 20 + r || sy < -20 - r || sy > height + 20 + r) continue;
    const font = PLACE_STYLE[place.kind].font * unit;
    const dotOnly = () => {
      // No room for a name: the dot alone, where dots do not touch.
      if (place.kind !== "capital" && view.k < ALL_DOTS_ZOOM) return;
      const tight: Box = [sx - r - air, sy - r - air, sx + r + air, sy + r + air];
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
    const gap = labelGap(r, unit);
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

/**
 * The drawn place under a point (viewBox units on screen) at a view: the
 * nearest whose dot, or a small target around it, covers the point. The
 * dots themselves take no pointer events, so the map answers for them.
 */
export function placeAt(placed: PlacedLabel[], x: number, y: number, view: { k: number; x: number; y: number }, unit = 1): PlacePoint | null {
  let best: PlacePoint | null = null;
  let bestDistance = Infinity;
  for (const { place } of placed) {
    const distance = Math.hypot(place.px * view.k + view.x - x, place.py * view.k + view.y - y);
    const reach = Math.max(dotRadius(place, view.k, unit), 7 * unit);
    if (distance <= reach && distance < bestDistance) {
      best = place;
      bestDistance = distance;
    }
  }
  return best;
}

/** Line segments in map units by grid cell, to tell whether a railway passes near a town. */
export class SegmentIndex {
  private cells = new Map<string, [number, number, number, number, number][]>();

  constructor(private size = 2) {}

  private key(x: number, y: number) {
    return `${Math.floor(x / this.size)},${Math.floor(y / this.size)}`;
  }

  /** A segment from (x0, y0) to (x1, y1) of a line of some rank. */
  add(x0: number, y0: number, x1: number, y1: number, rank: number) {
    const seg: [number, number, number, number, number] = [x0, y0, x1, y1, rank];
    const keys = new Set<string>();
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / this.size));
    for (let i = 0; i <= steps; i += 1) keys.add(this.key(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps));
    for (const k of keys) {
      const list = this.cells.get(k);
      if (list) list.push(seg);
      else this.cells.set(k, [seg]);
    }
  }

  /** The best (lowest) rank of a line within `within` map units of (x, y), or null when none passes near. */
  nearest(x: number, y: number, within: number): number | null {
    let rank: number | null = null;
    for (let gx = Math.floor((x - within) / this.size); gx <= Math.floor((x + within) / this.size); gx += 1) {
      for (let gy = Math.floor((y - within) / this.size); gy <= Math.floor((y + within) / this.size); gy += 1) {
        for (const [x0, y0, x1, y1, r] of this.cells.get(`${gx},${gy}`) ?? []) {
          const dx = x1 - x0;
          const dy = y1 - y0;
          const t = dx || dy ? Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / (dx * dx + dy * dy))) : 0;
          if (Math.hypot(x0 + t * dx - x, y0 + t * dy - y) <= within && (rank === null || r < rank)) rank = r;
        }
      }
    }
    return rank;
  }
}

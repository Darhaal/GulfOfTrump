import { geoBounds, geoContains } from "d3-geo";
import { feature } from "topojson-client";
import type { ProvinceTopology } from "./provinces";

/**
 * Towns inside provinces. A front runs through a contested province along
 * the towns each side holds: the game master names them, the engine keeps
 * the names it knows, the map gives each town the land nearest to it.
 * Big cities come from public/maps/cities.json, the rest from towns.json
 * (GeoNames, 15 000 people and more).
 */

export interface Town {
  /** English name, as the map files have it: the key the game state uses. */
  n: string;
  ru?: string;
  uk?: string;
  /** [longitude, latitude]. */
  at: [number, number];
  /** People today, thousands. */
  pop: number;
}

/** A city of cities.json: the fields the towns need. */
export interface CitySource {
  n: string;
  ru?: string;
  uk?: string;
  x: number;
  y: number;
  p50: number;
  p90: number;
  p20: number;
}

/** A town of towns.json: [name, x, y, people today in thousands, seat, ru?, uk?]. */
export type TownSource = [string, number, number, number, 0 | 1, (string | 0)?, (string | 0)?];

/** Cities and towns as one list, a town that is also a city counted once. */
export function mergePlaces(cities: CitySource[], towns: TownSource[]): Town[] {
  const out: Town[] = cities.map((c) => ({ n: c.n, ...(c.ru ? { ru: c.ru } : {}), ...(c.uk ? { uk: c.uk } : {}), at: [c.x, c.y], pop: Math.max(c.p20, c.p90, c.p50) }));
  // Cities by tenth-of-a-degree cells, to find a town that is one of them.
  const grid = new Map<string, Town[]>();
  const key = (x: number, y: number) => `${Math.round(x * 10)},${Math.round(y * 10)}`;
  for (const c of out) {
    const k = key(c.at[0], c.at[1]);
    grid.set(k, [...(grid.get(k) ?? []), c]);
  }
  for (const [n, x, y, pop, , ru, uk] of towns) {
    const around = [-1, 0, 1].flatMap((dx) => [-1, 0, 1].flatMap((dy) => grid.get(key(x + dx / 10, y + dy / 10)) ?? []));
    if (around.some((c) => Math.abs(c.at[0] - x) < 0.08 && Math.abs(c.at[1] - y) < 0.08 && (c.n === n || c.pop >= pop))) continue;
    out.push({ n, ...(ru ? { ru } : {}), ...(uk ? { uk } : {}), at: [x, y], pop });
  }
  return out;
}

/**
 * Each province's towns, biggest first. A town belongs to the province whose
 * outline contains it. Only the provinces asked for are worked out (the ones
 * a front runs through), each once.
 */
export function townIndex(topology: ProvinceTopology, places: Town[]): (province: string) => Town[] {
  const features = (feature(topology as never, topology.objects.regions as never) as unknown as { features: { properties: { id: string } }[] }).features;
  const byId = new Map(features.map((f) => [f.properties.id, f]));
  const cache = new Map<string, Town[]>();
  return (province) => {
    const known = cache.get(province);
    if (known) return known;
    const f = byId.get(province);
    if (!f) return [];
    const [[w, s], [e, n]] = geoBounds(f as never);
    // A province across the antimeridian wraps round.
    const across = w > e;
    const list = places
      .filter(({ at: [x, y] }) => y >= s && y <= n && (across ? x >= w || x <= e : x >= w && x <= e) && geoContains(f as never, [x, y]))
      .sort((a, b) => b.pop - a.pop);
    cache.set(province, list);
    return list;
  };
}

/** A town of the province by any of its names, as its English name. */
export function matchTown(towns: Town[], name: string): string | undefined {
  const key = name.trim().toLowerCase().replace(/[’']/g, "");
  const norm = (s?: string) => s?.toLowerCase().replace(/[’']/g, "");
  return towns.find((t) => norm(t.n) === key || norm(t.ru) === key || norm(t.uk) === key)?.n;
}

/** What a town weighs on the front: a city stands for more land than a town, though not in proportion to its people. */
const weight = (t: Town) => Math.sqrt(Math.max(1, t.pop));

/** The weight of the towns named among a province's towns, %. */
export function townShare(towns: Town[], taken: string[]): number {
  const total = towns.reduce((s, t) => s + weight(t), 0);
  if (!total) return 0;
  const held = towns.filter((t) => taken.includes(t.n)).reduce((s, t) => s + weight(t), 0);
  return Math.round((held / total) * 100);
}

/**
 * The towns the attacker holds after its towns' weight moved to `share` %
 * without the game master naming them: it keeps what it held and takes the
 * towns nearest those next (nearest its own side when it holds none), or
 * gives up its farthest-forward towns first.
 */
export function adjustTaken(towns: Town[], taken: string[], share: number, centre: [number, number], toward: [number, number]): string[] {
  if (!towns.length) return [];
  const dir = [toward[0] - centre[0], toward[1] - centre[1]];
  const len = Math.hypot(dir[0], dir[1]) || 1;
  // Nearest the attacker's side first.
  const order = [...towns].sort((a, b) => ((b.at[0] - a.at[0]) * dir[0]) / len + ((b.at[1] - a.at[1]) * dir[1]) / len);
  let held = order.filter((t) => taken.includes(t.n)).map((t) => t.n);
  // An advance goes on from the towns it holds: the nearest of them falls next.
  const from = towns.filter((t) => taken.includes(t.n));
  const gap = (t: Town) => (from.length ? Math.min(...from.map((h) => Math.hypot(h.at[0] - t.at[0], h.at[1] - t.at[1]))) : 0);
  const advance = from.length ? [...towns].sort((a, b) => gap(a) - gap(b)) : order;
  const target = Math.max(0, Math.min(100, share));
  if (townShare(towns, held) < target) {
    for (const t of advance) {
      if (townShare(towns, held) >= target) break;
      // Taking a town that overshoots by more than it closes is left for later.
      if (held.includes(t.n)) continue;
      const after = townShare(towns, [...held, t.n]);
      if (after - target > target - townShare(towns, held)) continue;
      held = [...held, t.n];
    }
  } else {
    for (const t of [...order].reverse()) {
      if (townShare(towns, held) <= target) break;
      if (!held.includes(t.n)) continue;
      const after = townShare(towns, held.filter((n) => n !== t.n));
      if (target - after > townShare(towns, held) - target) continue;
      held = held.filter((n) => n !== t.n);
    }
  }
  return held;
}

/**
 * Moves a value on one scale (a province's land, %) by a change on another
 * (its town folk, %), in proportion to what is left to gain or to lose:
 * taking half of what the holder still had takes about half of its land.
 */
export function carry(before: number, after: number, base: number): number {
  const v = after >= before ? base + (100 - base) * (before >= 100 ? 0 : (after - before) / (100 - before)) : before <= 0 ? base : (base * after) / before;
  return Math.max(0, Math.min(100, v));
}

import type { GeoPath } from "d3-geo";
import type { MultiPolygon, Polygon } from "geojson";
import { merge } from "topojson-client";
import type { GeometryObject } from "topojson-specification";
import { peopleIn } from "@/engine/population";
import type { AppliedChange, MapRegion, RegionState } from "@/engine/types";
import type { RegionTopology } from "@/lib/maps";

type Point = [number, number];

const propsOf = (g: GeometryObject) => (g as GeometryObject<MapRegion>).properties as MapRegion;

export interface CountryLabel {
  tag: string;
  x: number;
  y: number;
  size: number;
  /** The provinces of the land the name sits on: the holder's home. */
  core: string[];
}

/**
 * One name per holder, on its home: of the stretches of land it holds
 * (provinces joined by a border), the one with the most of its own people.
 * Land it only occupies counts a quarter and empty land by its area, so
 * "Germany" stays over Germany when Germany also holds Greenland, and
 * "France" over France rather than the Sahara.
 */
export function countryLabels(topology: RegionTopology, adjacency: number[][], regions: Record<string, RegionState>, path: GeoPath): CountryLabel[] {
  const geoms = topology.objects.regions.geometries as GeometryObject[];
  const byHolder = new Map<string, number[]>();
  geoms.forEach((g, i) => {
    const holder = regions[propsOf(g).id]?.controller;
    if (!holder) return;
    const list = byHolder.get(holder) ?? [];
    list.push(i);
    byHolder.set(holder, list);
  });
  const out: CountryLabel[] = [];
  for (const [tag, list] of byHolder) {
    const mine = new Set(list);
    const seen = new Set<number>();
    let best: number[] = [];
    let bestScore = -1;
    for (const start of list) {
      if (seen.has(start)) continue;
      const part = [start];
      seen.add(start);
      for (let j = 0; j < part.length; j++) {
        for (const n of adjacency[part[j]] ?? []) {
          if (mine.has(n) && !seen.has(n)) {
            seen.add(n);
            part.push(n);
          }
        }
      }
      let score = 0;
      for (const i of part) {
        const p = propsOf(geoms[i]);
        score += (regions[p.id]?.owner === tag ? 1 : 0.25) * (peopleIn(regions[p.id], p) + p.area / 1000);
      }
      if (score > bestScore) {
        bestScore = score;
        best = part;
      }
    }
    if (!best.length) continue;
    const merged = merge(topology as never, best.map((i) => geoms[i]) as never) as MultiPolygon;
    let polygon: Polygon | null = null;
    let area = 0;
    for (const coordinates of merged.coordinates) {
      const candidate: Polygon = { type: "Polygon", coordinates };
      const a = path.area(candidate);
      if (a > area) {
        area = a;
        polygon = candidate;
      }
    }
    if (!polygon) continue;
    const [x, y] = path.centroid(polygon);
    if (Number.isFinite(x) && Number.isFinite(y)) out.push({ tag, x, y, size: Math.sqrt(area), core: best.map((i) => propsOf(geoms[i]).id) });
  }
  return out;
}

/** "war" when two holders fight each other, "truce" while a ceasefire holds, null otherwise. */
export function hostility(wars: { attackers: string[]; defenders: string[]; truce?: unknown }[]): (a: string, b: string) => "war" | "truce" | null {
  const pairs = new Map<string, "war" | "truce">();
  for (const war of wars) {
    const state = war.truce ? "truce" : "war";
    for (const a of war.attackers) {
      for (const d of war.defenders) {
        for (const key of [`${a}|${d}`, `${d}|${a}`]) if (pairs.get(key) !== "war") pairs.set(key, state);
      }
    }
  }
  return (a, b) => pairs.get(`${a}|${b}`) ?? null;
}

export type MoveKind = "take" | "push" | "free";

/** How a province changed in a turn, for its highlight. */
export interface ChangedProvince {
  /** Who gained it (or, for a push, who pushed). */
  by: string;
  kind: MoveKind | "annex" | "hold";
  /** The side pushed back, when the holder of a contested province gained ground. */
  against?: string;
}

export interface TurnMove {
  key: string;
  by: string;
  kind: MoveKind;
  from: Point;
  to: Point;
  /** Provinces in this push. */
  count: number;
  /** No land of the mover borders it: a landing. */
  sea: boolean;
}

/**
 * The turn's changes as the map tells them: every province that changed
 * hands, and arrows — one per stretch of land a side took, from the land it
 * held next to it (or, for a landing, from its nearest province).
 */
export function turnMoves(
  applied: AppliedChange[],
  regions: Record<string, RegionState>,
  centre: (id: string) => Point | undefined,
  neighbours: (id: string) => string[],
  limit = 30,
): { changed: Map<string, ChangedProvince>; moves: TurnMove[] } {
  const changed = new Map<string, ChangedProvince>();
  for (const c of applied) {
    // An entry from before provinces names whole-country regions the map no longer has.
    if ("region" in c && !regions[c.region]) continue;
    if (c.kind === "occupy" && c.from !== c.to) changed.set(c.region, { by: c.to, kind: "take" });
    else if (c.kind === "liberate") changed.set(c.region, { by: c.to, kind: "free" });
    else if (c.kind === "annex" && c.from !== c.to) changed.set(c.region, { by: c.to, kind: "annex" });
    else if (c.kind === "contest") {
      // A smaller share than before: the holder won ground back.
      const back = c.held !== undefined && c.was !== undefined && c.held < c.was;
      changed.set(c.region, back ? { by: c.holder, kind: "hold", against: c.by } : { by: c.by, kind: "push" });
    } else if (c.kind === "repel") changed.set(c.region, { by: c.holder, kind: "hold", against: c.by });
  }

  // Stretches of land one side took the same way in this turn.
  const groups = new Map<string, string[]>();
  for (const [id, c] of changed) {
    if (c.kind === "annex" || c.kind === "hold") continue;
    const key = `${c.by}|${c.kind}`;
    groups.set(key, [...(groups.get(key) ?? []), id]);
  }
  const moves: TurnMove[] = [];
  for (const [key, ids] of groups) {
    const [by, kind] = key.split("|") as [string, MoveKind];
    const pending = new Set(ids);
    for (const start of ids) {
      if (!pending.has(start)) continue;
      const part = [start];
      pending.delete(start);
      for (let j = 0; j < part.length; j++) {
        for (const n of neighbours(part[j])) {
          if (pending.has(n)) {
            pending.delete(n);
            part.push(n);
          }
        }
      }
      const target = mean(part.map(centre));
      if (!target) continue;
      // Where the push came from: the mover's own land on the edge of the stretch.
      const inPart = new Set(part);
      const edge = new Set<string>();
      for (const id of part) {
        for (const n of neighbours(id)) if (!inPart.has(n) && !changed.has(n) && regions[n]?.controller === by) edge.add(n);
      }
      let source = mean([...edge].map(centre));
      let sea = false;
      if (!source) {
        // A landing: from the mover's nearest province.
        let best: Point | undefined;
        let bestDist = Infinity;
        for (const [id, r] of Object.entries(regions)) {
          if (r.controller !== by || changed.has(id)) continue;
          const c = centre(id);
          if (!c) continue;
          const d = (c[0] - target[0]) ** 2 + (c[1] - target[1]) ** 2;
          if (d < bestDist) {
            bestDist = d;
            best = c;
          }
        }
        source = best;
        sea = true;
      }
      if (!source || (source[0] === target[0] && source[1] === target[1])) continue;
      moves.push({ key: `${key}|${start}`, by, kind, from: source, to: target, count: part.length, sea });
    }
  }
  // The holder pushing the other side back: from the province towards the land the other side holds next to it.
  for (const [id, c] of changed) {
    if (c.kind !== "hold" || !c.against) continue;
    const from = centre(id);
    const enemy = mean(neighbours(id).filter((n) => regions[n]?.controller === c.against).map(centre));
    if (!from || !enemy) continue;
    const to: Point = [from[0] + (enemy[0] - from[0]) * 0.7, from[1] + (enemy[1] - from[1]) * 0.7];
    moves.push({ key: `${c.by}|hold|${id}`, by: c.by, kind: "push", from, to, count: 1, sea: false });
  }
  moves.sort((a, b) => b.count - a.count);
  return { changed, moves: moves.slice(0, limit) };
}

function mean(points: (Point | undefined)[]): Point | undefined {
  const list = points.filter((p): p is Point => Boolean(p) && Number.isFinite(p![0]) && Number.isFinite(p![1]));
  if (!list.length) return undefined;
  return [list.reduce((s, p) => s + p[0], 0) / list.length, list.reduce((s, p) => s + p[1], 0) / list.length];
}

/**
 * An arrow from a to b as SVG paths in map units: a gentle curve and its
 * head. `head` is the head's length in map units (screen pixels / zoom).
 * A push across a short border would make a stub, so an arrow is at least
 * five heads long, reaching back along its direction.
 */
export function arrowPath(to: Point, origin: Point, head: number): { line: string; tip: string } {
  let dx = to[0] - origin[0];
  let dy = to[1] - origin[1];
  let length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  if (length < head * 5) {
    length = head * 5;
    dx = ux * length;
    dy = uy * length;
  }
  const from: Point = [to[0] - dx, to[1] - dy];
  // Bend a little to one side, so arrows read as movement, not as lines on the map.
  const bend = Math.min(length * 0.18, head * 4);
  const cx = (from[0] + to[0]) / 2 - uy * bend;
  const cy = (from[1] + to[1]) / 2 + ux * bend;
  // The head points along the curve's last stretch.
  const tx = to[0] - cx;
  const ty = to[1] - cy;
  const tl = Math.hypot(tx, ty) || 1;
  const hx = tx / tl;
  const hy = ty / tl;
  const base: Point = [to[0] - hx * head, to[1] - hy * head];
  const half = head * 0.55;
  const tip = `M${to[0]},${to[1]}L${base[0] - hy * half},${base[1] + hx * half}L${base[0] + hy * half},${base[1] - hx * half}Z`;
  return { line: `M${from[0]},${from[1]}Q${cx},${cy} ${base[0]},${base[1]}`, tip };
}

/** The provinces a turn changed: taken, freed, annexed, fought over or held. */
export function changedRegions(applied: AppliedChange[]): string[] {
  const ids = new Set<string>();
  for (const c of applied) {
    if (c.kind === "occupy" || c.kind === "liberate" || c.kind === "annex" || c.kind === "contest" || c.kind === "repel") ids.add(c.region);
  }
  return [...ids];
}

/** The rings of an SVG path as d3-geo writes it ("M x,y L x,y … Z"). */
export function pathRings(d: string): Point[][] {
  const rings: Point[][] = [];
  for (const part of d.split(/(?=M)/)) {
    const ring = [...part.matchAll(/(-?\d*\.?\d+(?:e-?\d+)?),(-?\d*\.?\d+(?:e-?\d+)?)/gi)].map((m) => [Number(m[1]), Number(m[2])] as Point);
    if (ring.length >= 3) rings.push(ring);
  }
  return rings;
}

const ringArea = (ring: Point[]) => {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  return Math.abs(a) / 2;
};

/** A ring cut to the side of a line where the projection on `dir` is at least `cut` (Sutherland–Hodgman). */
function clipRing(ring: Point[], dir: Point, cut: number): Point[] {
  const t = (p: Point) => p[0] * dir[0] + p[1] * dir[1] - cut;
  const out: Point[] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const ta = t(a);
    const tb = t(b);
    if (ta >= 0) out.push(a);
    if (ta >= 0 !== tb >= 0) {
      const f = ta / (ta - tb);
      out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
    }
  }
  return out;
}

const fmt = (p: Point) => `${Math.round(p[0] * 100) / 100},${Math.round(p[1] * 100) / 100}`;

/**
 * A contested province split along the front: the part the attacker holds,
 * on the side facing `toward` (where its own land lies), with the area of
 * `share` per cent of the province; and the front line across it.
 */
export function splitProvince(d: string, centre: Point, toward: Point, share: number): { held: string; free: string; front: string } | null {
  const rings = pathRings(d);
  const len = Math.hypot(toward[0] - centre[0], toward[1] - centre[1]);
  if (!rings.length || len === 0) return null;
  const dir: Point = [(toward[0] - centre[0]) / len, (toward[1] - centre[1]) / len];
  const total = rings.reduce((s, r) => s + ringArea(r), 0);
  if (total <= 0) return null;
  const target = (Math.min(100, Math.max(0, share)) / 100) * total;
  const proj = rings.flat().map((p) => p[0] * dir[0] + p[1] * dir[1]);
  let lo = Math.min(...proj);
  let hi = Math.max(...proj);
  // A higher cut leaves less land on the attacker's side.
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    const area = rings.reduce((s, r) => s + ringArea(clipRing(r, dir, mid)), 0);
    if (area > target) lo = mid;
    else hi = mid;
  }
  const cut = (lo + hi) / 2;
  const clipped = rings.map((r) => clipRing(r, dir, cut)).filter((r) => r.length >= 3);
  const held = clipped.map((r) => `M${r.map(fmt).join("L")}Z`).join("");
  const free = rings.map((r) => clipRing(r, [-dir[0], -dir[1]], -cut)).filter((r) => r.length >= 3).map((r) => `M${r.map(fmt).join("L")}Z`).join("");
  // The front: the clipped edges that run along the cut.
  const on = (p: Point) => Math.abs(p[0] * dir[0] + p[1] * dir[1] - cut) < 1e-6 * Math.max(1, Math.abs(cut));
  const front = clipped
    .flatMap((r) => r.map((p, i) => [p, r[(i + 1) % r.length]] as [Point, Point]))
    .filter(([a, b]) => on(a) && on(b) && (a[0] !== b[0] || a[1] !== b[1]))
    .map(([a, b]) => `M${fmt(a)}L${fmt(b)}`)
    .join("");
  return { held, free, front };
}

/** Whether a point lies inside rings (even-odd). */
export function insideRings(rings: Point[][], p: Point): boolean {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

/**
 * A contested province divided among its towns, each taking the land
 * nearest to it: the cells of the towns the attacker holds, and the front
 * where they meet the cells of the towns it does not.
 */
export function splitByTowns(d: string, towns: { at: Point; taken: boolean }[]): { held: string; free: string; front: string } | null {
  const rings = pathRings(d);
  if (!rings.length || towns.length < 2 || !towns.some((t) => t.taken)) return null;
  // The bisector between towns i and j: the side of i is where p·dir ≥ cut.
  const bisector = (a: Point, b: Point) => {
    const len = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1;
    const dir: Point = [(a[0] - b[0]) / len, (a[1] - b[1]) / len];
    return { dir, cut: ((a[0] + b[0]) / 2) * dir[0] + ((a[1] + b[1]) / 2) * dir[1] };
  };
  const held: string[] = [];
  const free: string[] = [];
  const front: string[] = [];
  towns.forEach((town, i) => {
    let cell = rings;
    towns.forEach((other, j) => {
      if (i === j || (other.at[0] === town.at[0] && other.at[1] === town.at[1])) return;
      const { dir, cut } = bisector(town.at, other.at);
      cell = cell.map((r) => clipRing(r, dir, cut)).filter((r) => r.length >= 3);
    });
    if (!town.taken) {
      for (const r of cell) free.push(`M${r.map(fmt).join("L")}Z`);
      return;
    }
    for (const r of cell) {
      held.push(`M${r.map(fmt).join("L")}Z`);
      // Edges on a bisector with a town the attacker does not hold are the front.
      r.forEach((a, k) => {
        const b = r[(k + 1) % r.length];
        const lies = towns.some((other, j) => {
          if (j === i || other.taken) return false;
          const { dir, cut } = bisector(town.at, other.at);
          const eps = 1e-7 * Math.max(1, Math.abs(cut));
          return Math.abs(a[0] * dir[0] + a[1] * dir[1] - cut) < eps && Math.abs(b[0] * dir[0] + b[1] * dir[1] - cut) < eps;
        });
        if (lies && (a[0] !== b[0] || a[1] !== b[1])) front.push(`M${fmt(a)}L${fmt(b)}`);
      });
    }
  });
  return held.length ? { held: held.join(""), free: free.join(""), front: front.join("") } : null;
}

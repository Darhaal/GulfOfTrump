// Finer provinces (`npm run maps -- --fine 1994`, a prototype): Natural
// Earth's large first-level divisions split into parts by land and people.
//
// A division gets sqrt(area / AREA_KM2 * people / PEOPLE_K) parts — the
// geometric mean of its land and its people, so Uttar Pradesh and the Ruhr
// split finely, Siberia and the Sahara coarsely, and a small province never.
// The parts are seeded at the division's largest places (Natural Earth's
// populated places, public domain, with Russian and Ukrainian names), spread
// over its land by weighted k-means (a quarter area, the rest people, so
// parts are smaller where people live), drawn as the Voronoi cells of the
// result with wavy borders, and cut out of the division. Each part is named
// after its largest place, or failing one its largest town (towns.json,
// GeoNames, CC BY 4.0), or failing that its largest village (GeoNames'
// places of 1,000 to 15,000), or failing that the land it lies in (Natural Earth's
// geography regions: "Lesser Khingan Range") or its direction; the part holding the
// division's largest place keeps the division's id and name, the others get
// `<division id>-<place>`.
//
// Everything here is deterministic: the same sources give the same parts,
// and so the same ids, on every build. The ids are frozen besides
// (scripts/split-ids.json, each division's parts by cell): a part's name can
// change – new towns, better Cyrillic names – and its id never does, since
// saves keep provinces by id. Only a division whose number of parts changes
// is given new ids, and the build says which.

/** The split rule: a part per this much land… */
export const AREA_KM2 = 10000;
/** …and this many people (thousands, in 1991), as a geometric mean. */
export const PEOPLE_K = 1000;
/** No division splits into more parts than this… */
export const MAX_PARTS = 24;
/** …or into parts smaller than this on average. */
export const MIN_PART_KM2 = 4000;
/** Deserts and tundra count their land at this weight. */
const BARREN = { desert: 0.5, tundra: 0.5 };
/** Where the parts go: this much by land, the rest by people, so parts are small where people live and the empty north is a few big ones. */
const LAND_WEIGHT = 0.25;

/** How many parts a division splits into (1: it stays whole). */
export function partsFor({ area, pop = 0, terrain }) {
  const w = Math.sqrt(((area * (BARREN[terrain] ?? 1)) / AREA_KM2) * (pop / PEOPLE_K));
  return Math.max(1, Math.min(MAX_PARTS, Math.floor(area / MIN_PART_KM2), Math.round(w)));
}

const RAD = Math.PI / 180;

/** Eight directions, for a part with no place to be named after. */
const DIRECTIONS = [
  { name: "east", ru: "восток", uk: "схід" },
  { name: "north-east", ru: "северо-восток", uk: "північний схід" },
  { name: "north", ru: "север", uk: "північ" },
  { name: "north-west", ru: "северо-запад", uk: "північний захід" },
  { name: "west", ru: "запад", uk: "захід" },
  { name: "south-west", ru: "юго-запад", uk: "південний захід" },
  { name: "south", ru: "юг", uk: "південь" },
  { name: "south-east", ru: "юго-восток", uk: "південний схід" },
];

/** A small deterministic generator (mulberry32). */
function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A hash of a few numbers, for the wavy borders: the same edge always waves the same way. */
function hash(...values) {
  let h = 2166136261;
  for (const v of values) {
    h ^= Math.round(v * 1e6) | 0;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mapCoords(geometry, fn) {
  const walk = (c) => (typeof c[0] === "number" ? fn(c) : c.map(walk));
  return { type: geometry.type, coordinates: walk(geometry.coordinates) };
}

/**
 * The Voronoi cells of points in the plane, as polygons that share their
 * vertices exactly (each vertex is computed once), so neighbouring cells
 * meet without gaps. Sixteen ghost points on a circle of three times
 * `reach` keep every real cell bounded while the real cells still cover
 * everything within `reach` of the origin. Brute force over triples: there
 * are never more than a few dozen points.
 */
function voronoi(centers, reach) {
  const ghosts = Array.from({ length: 16 }, (_, i) => [3 * reach * Math.cos((i * Math.PI) / 8), 3 * reach * Math.sin((i * Math.PI) / 8)]);
  const pts = [...centers, ...ghosts];
  const vertices = [];
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      for (let l = j + 1; l < pts.length; l++) {
        const [ax, ay] = pts[i], [bx, by] = pts[j], [cx, cy] = pts[l];
        const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
        if (Math.abs(d) < 1e-12) continue;
        const a2 = ax * ax + ay * ay, b2 = bx * bx + by * by, c2 = cx * cx + cy * cy;
        const ux = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d;
        const uy = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d;
        const r2 = (ux - ax) ** 2 + (uy - ay) ** 2;
        let empty = true;
        for (let m = 0; m < pts.length && empty; m++) {
          if (m === i || m === j || m === l) continue;
          if ((ux - pts[m][0]) ** 2 + (uy - pts[m][1]) ** 2 < r2 * (1 - 1e-9)) empty = false;
        }
        if (!empty) continue;
        // Four points on one circle give the same vertex twice: keep one, with every point it touches.
        const same = vertices.find((v) => Math.abs(v.x - ux) < 1e-9 && Math.abs(v.y - uy) < 1e-9);
        if (same) for (const p of [i, j, l]) same.of.add(p);
        else vertices.push({ id: vertices.length, x: ux, y: uy, of: new Set([i, j, l]) });
      }
    }
  }
  return centers.map((c, i) => {
    const ring = vertices.filter((v) => v.of.has(i)).sort((a, b) => Math.atan2(a.y - c[1], a.x - c[0]) - Math.atan2(b.y - c[1], b.x - c[0]));
    return { ring, neighbour: (a, b) => [...a.of].find((p) => p !== i && b.of.has(p)) };
  });
}

/**
 * The points of a wavy border between two Voronoi vertices, from the one
 * with the lower id: midpoint displacement down to segments of a twelfth
 * of `scale` (a part's width), each midpoint moved across its segment by
 * up to a sixth of the segment and never more than `scale` / 7, seeded by
 * the edge's ends, so both cells draw the same line.
 */
function wave(a, b, scale) {
  const rnd = random(hash(a.x, a.y, b.x, b.y));
  const out = [];
  const split = (p, q, level) => {
    const dx = q[0] - p[0], dy = q[1] - p[1];
    const length = Math.hypot(dx, dy);
    if (length < scale / 12 || level > 12) return;
    const off = Math.max(-scale / 7, Math.min(scale / 7, (rnd() - 0.5) * 0.34 * length)) / length;
    const m = [(p[0] + q[0]) / 2 - dy * off, (p[1] + q[1]) / 2 + dx * off];
    split(p, m, level + 1);
    out.push(m);
    split(m, q, level + 1);
  };
  split([a.x, a.y], [b.x, b.y], 0);
  return out;
}

/** The point inside a polygon's largest part on the horizontal line through its middle: a label point that is never in a bay. */
export function innerPoint(geometry) {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  const ringArea = (r) => {
    let s = 0;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]);
    return Math.abs(s / 2);
  };
  const biggest = polygons.reduce((best, p) => (ringArea(p[0]) > ringArea(best[0]) ? p : best), polygons[0]);
  const ys = biggest[0].map((p) => p[1]);
  const y = (Math.min(...ys) + Math.max(...ys)) / 2 + 1e-7;
  const xs = [];
  for (const ring of biggest) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > y) !== (yj > y)) xs.push(xi + ((y - yi) * (xj - xi)) / (yj - yi));
    }
  }
  xs.sort((p, q) => p - q);
  let best = null;
  for (let k = 0; k + 1 < xs.length; k += 2) if (!best || xs[k + 1] - xs[k] > best[1] - best[0]) best = [xs[k], xs[k + 1]];
  return best ? [(best[0] + best[1]) / 2, y] : biggest[0][0];
}

/**
 * Splits the large divisions of a province collection (properties: pid,
 * name, ru, uk, adm0, terrain, area, pop) into parts. Returns the new
 * collection, each part carrying `up` (the division's id), and a summary.
 *
 * `places` are Natural Earth's populated places, `towns` GeoNames' towns
 * and `villages` its smaller places, all as [lon, lat, people (thousands),
 * name, ru, uk]; `lands`
 * Natural Earth's geography regions as { name, ru, uk, box, geometry }, the
 * most local first; `tools` the build's geometry helpers and mapshaper, and
 * `frozen` the ids of each division's parts by cell from earlier builds.
 * The summary's `ids` are this build's, by division and cell; `refrozen` the
 * divisions whose parts changed in number and took new ids.
 */
export async function splitLarge(collection, places, towns, lands, { bbox, contains, slug, run, frozen = {}, villages = [] }) {
  const used = new Set(collection.features.map((f) => f.properties.pid));
  // The frozen ids are taken already, so a new part never takes one of them.
  for (const ids of Object.values(frozen)) for (const id of ids) used.add(id);
  const unique = (id) => {
    let candidate = id;
    for (let i = 2; used.has(candidate); i += 1) candidate = `${id}-${i}`;
    used.add(candidate);
    return candidate;
  };
  const out = [];
  const summary = { split: 0, parts: 0, unnamed: 0, skipped: [], ids: {}, refrozen: [] };
  // The names each country's provinces already have, so no two of them are named alike.
  const names = new Map();
  for (const f of collection.features) {
    if (!names.has(f.properties.adm0)) names.set(f.properties.adm0, new Set());
    names.get(f.properties.adm0).add(f.properties.name);
  }
  for (const f of collection.features) {
    const p = f.properties;
    const k = partsFor(p);
    if (k < 2 || !f.geometry) {
      out.push(f);
      continue;
    }
    // A division across the antimeridian (Chukotka, the Aleutians) is worked on with its western longitudes moved east.
    const box0 = bbox(f.geometry);
    const wrap = box0[2] - box0[0] > 180;
    const geometry = wrap ? mapCoords(f.geometry, ([x, y]) => [x < 0 ? x + 360 : x, y]) : f.geometry;
    const [x0, y0, x1, y1] = bbox(geometry);
    const lon0 = (x0 + x1) / 2, lat0 = (y0 + y1) / 2, kx = Math.cos(lat0 * RAD);
    const project = ([x, y]) => [(x - lon0) * kx, y - lat0];
    const unproject = ([x, y]) => [x / kx + lon0, y + lat0];

    // Sample points on a grid inside the division.
    let samples = [];
    for (let target = k * 120, tries = 0; samples.length < k * 30 && tries < 3; target *= 4, tries++) {
      samples = [];
      const step = Math.sqrt(((x1 - x0) * kx * (y1 - y0)) / target);
      for (let x = x0 + step / kx / 2; x < x1; x += step / kx) {
        for (let y = y0 + step / 2; y < y1; y += step) if (contains(geometry, [x, y])) samples.push(project([x, y]));
      }
    }
    if (samples.length < k * 4) {
      summary.skipped.push(p.pid);
      out.push(f);
      continue;
    }
    // Its places and towns, biggest first.
    const within = (list) =>
      list
        .map((pl) => ({ pl, at: [wrap && pl[0] < 0 ? pl[0] + 360 : pl[0], pl[1]] }))
        .filter(({ at }) => at[0] >= x0 && at[0] <= x1 && at[1] >= y0 && at[1] <= y1 && contains(geometry, at))
        .map(({ pl, at }) => ({ xy: project(at), people: pl[2], name: pl[3], ru: pl[4], uk: pl[5] }))
        .sort((a, b) => b.people - a.people || a.name.localeCompare(b.name));
    const inside = within(places);
    const nearest = (xy, list) => {
      let best = 0, bd = Infinity;
      list.forEach((c, i) => {
        const d = (c[0] - xy[0]) ** 2 + (c[1] - xy[1]) ** 2;
        if (d < bd) { bd = d; best = i; }
      });
      return best;
    };
    // Weights: a quarter land (each sample alike), the rest people (the towns at their nearest sample, the countryside spread evenly).
    const urban = new Float64Array(samples.length);
    let townsPeople = 0;
    for (const t of inside) {
      if (t.people < 20) continue;
      urban[nearest(t.xy, samples)] += t.people;
      townsPeople += t.people;
    }
    const people = Math.max(p.pop ?? 0, townsPeople);
    const rural = Math.max(people - townsPeople, people * 0.4) / samples.length;
    const weights = Array.from(samples, (_, i) => LAND_WEIGHT / samples.length + ((1 - LAND_WEIGHT) * (urban[i] + rural)) / (townsPeople + rural * samples.length));

    // Seeds: the biggest places at least a part's half-width apart, then the samples farthest from every seed.
    const spacing = (0.55 * Math.sqrt(p.area / k)) / 111;
    const centers = [];
    for (const t of inside) {
      if (centers.length >= k) break;
      if (centers.every((c) => (c[0] - t.xy[0]) ** 2 + (c[1] - t.xy[1]) ** 2 >= spacing * spacing)) centers.push([...t.xy]);
    }
    while (centers.length < k) {
      let far = 0, fd = -1;
      samples.forEach((s, i) => {
        const d = Math.min(...centers.map((c) => (c[0] - s[0]) ** 2 + (c[1] - s[1]) ** 2), Infinity);
        if (d > fd) { fd = d; far = i; }
      });
      centers.push([...samples[far]]);
    }
    // Weighted k-means.
    for (let iteration = 0; iteration < 12; iteration++) {
      const sx = new Float64Array(k), sy = new Float64Array(k), sw = new Float64Array(k);
      samples.forEach((s, i) => {
        const c = nearest(s, centers);
        sx[c] += s[0] * weights[i];
        sy[c] += s[1] * weights[i];
        sw[c] += weights[i];
      });
      for (let c = 0; c < k; c++) if (sw[c] > 0) centers[c] = [sx[c] / sw[c], sy[c] / sw[c]];
    }

    // The cells, with wavy borders between real neighbours, back in longitude and latitude.
    const cells = voronoi(centers, Math.hypot((x1 - x0) * kx, y1 - y0) / 2 + 0.01);
    const scale = Math.sqrt(p.area / k) / 111;
    const waves = new Map();
    const rings = cells.map(({ ring, neighbour }) => {
      const coords = [];
      ring.forEach((a, n) => {
        const b = ring[(n + 1) % ring.length];
        coords.push([a.x, a.y]);
        const other = neighbour(a, b);
        if (other === undefined || other >= k) return;
        const [lo, hi] = a.id < b.id ? [a, b] : [b, a];
        const key = `${lo.id}:${hi.id}`;
        if (!waves.has(key)) waves.set(key, wave(lo, hi, scale));
        const line = waves.get(key);
        coords.push(...(a === lo ? line : [...line].reverse()));
      });
      coords.push(coords[0]);
      return coords.map(unproject);
    });

    // Each part is named after its biggest place; the part with the division's biggest place keeps its id and name.
    const named = new Array(k).fill(null);
    for (const t of [...inside, ...(inside.length >= k ? [] : within(towns))]) {
      const c = nearest(t.xy, centers);
      if (!named[c]) named[c] = t;
    }
    // A part still without a name takes its largest village.
    if (named.some((t) => !t)) {
      for (const t of within(villages)) {
        const c = nearest(t.xy, centers);
        if (!named[c]) named[c] = t;
      }
    }
    const main = inside.length ? nearest(inside[0].xy, centers) : 0;
    // A part with no place or town is named after the land it lies in (a range, a plateau, a desert), else after its side of the division.
    // A name the country already has takes the division's name as well, then its side, then a number.
    const seen = names.get(p.adm0);
    // The ids this division's parts had: kept by cell while it splits into as many parts.
    const kept = frozen[p.pid]?.length === k ? frozen[p.pid] : null;
    if (frozen[p.pid] && !kept) summary.refrozen.push(p.pid);
    const ids = [];
    const cellFeatures = rings.map((ring, c) => {
      let label;
      const angle = Math.atan2(centers[c][1] - centers[main][1], centers[c][0] - centers[main][0]);
      const side = DIRECTIONS[(Math.round(angle / (Math.PI / 4)) + 8) % 8];
      const tagged = (l, tag) => ({ name: `${l.name} (${tag.name})`, ru: l.ru ? `${l.ru} (${tag.ru ?? tag.name})` : null, uk: l.uk ? `${l.uk} (${tag.uk ?? tag.name})` : null });
      if (c === main) label = { name: p.name, ru: p.ru, uk: p.uk };
      else {
        if (named[c]) label = named[c];
        else {
          const [lon, lat] = unproject(centers[c]);
          const at = [wrap && lon > 180 ? lon - 360 : lon, lat];
          const land = lands.find((l) => at[0] >= l.box[0] && at[0] <= l.box[2] && at[1] >= l.box[1] && at[1] <= l.box[3] && contains(l.geometry, at));
          label = land ?? tagged(p, side);
          summary.unnamed += 1;
        }
        label = { name: label.name, ru: label.ru ?? null, uk: label.uk ?? null };
        if (seen.has(label.name)) label = tagged(label, p);
        if (seen.has(label.name)) label = tagged(label, side);
        for (let n = 2, base = label; seen.has(label.name); n += 1) label = { name: `${base.name} ${n}`, ru: base.ru ? `${base.ru} ${n}` : null, uk: base.uk ? `${base.uk} ${n}` : null };
      }
      seen.add(label.name);
      const id = kept ? kept[c] : c === main ? p.pid : unique(`${p.pid}-${slug(label.name)}`);
      ids.push(id);
      return { type: "Feature", properties: { cell: c, pid: id, name: label.name, ru: label.ru ?? null, uk: label.uk ?? null }, geometry: { type: "Polygon", coordinates: [ring] } };
    });
    const clipped = await run("-i cells.json division.json combine-files -clip division target=cells -o out.json format=geojson target=cells", {
      "cells.json": { type: "FeatureCollection", features: cellFeatures },
      "division.json": { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry }] },
    });
    let parts = 0;
    for (const piece of clipped.features) {
      if (!piece.geometry) continue;
      const g = wrap ? mapCoords(piece.geometry, ([x, y]) => [x > 180 ? x - 360 : x, y]) : piece.geometry;
      const { pid, name, ru, uk } = piece.properties;
      out.push({ type: "Feature", properties: { ...p, pid, name, ru, uk, up: p.pid }, geometry: g });
      parts += 1;
    }
    summary.ids[p.pid] = ids;
    summary.split += 1;
    summary.parts += parts;
  }
  return { collection: { type: "FeatureCollection", features: out }, summary };
}

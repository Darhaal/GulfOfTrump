// Builds the four province maps in public/maps.
//
//   npm run maps
//
// Two sources, both pinned:
// - Natural Earth admin-1 (public domain) gives the provinces: modern
//   first-level divisions, grouped where a country's are tiny (British
//   councils, Slovenian municipalities). Natural Earth's geography regions and
//   populated places give each province a terrain, a fertility and a city.
// - aourednik/historical-basemaps (GPL-3.0) gives the borders of 1914, 1938,
//   1994 and 2010. Every province is cut along them: a province split by a
//   historical border becomes one province per side when each side holds a
//   real share of it; slivers from mismatched digitising go to the main part.
//
// Each province keeps the historical polygon it fell in (`hist`, `owner`);
// the scenarios turn those into owners for their own date, in code. Each era
// also gets the province's population on the scenario's start date and its
// railways then. The output stays under GPL-3.0 (see public/maps/README.md).
//
// Shared layers: water.json (rivers, lakes), transport.json (railways with
// the year they were built, ports) and cities.json, public domain; towns.json
// from GeoNames (CC BY 4.0).

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mapshaper from "mapshaper";
import { describeLand } from "./land.mjs";
import { POPULATION, POPULATION_YEAR, PROVINCE_POPULATION, REGION_GROWTH } from "./population.mjs";
import { parseResources, RESOURCE_POINTS, RESOURCE_SIDES, RESOURCES } from "./resources.mjs";
import { parseTowns, taggedNames, townCountries, townIds, unzip, wikidataLabels } from "./towns.mjs";
import { railSince } from "./transport.mjs";
import { innerPoint, splitLarge } from "./split.mjs";
import { geoArea, geoCentroid, geoDistance } from "d3-geo";
import { feature as topoFeature } from "topojson-client";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CACHE = path.join(ROOT, "scripts", ".cache");
const OUT = path.join(ROOT, "public", "maps");
/** The finer map's part ids, frozen (scripts/split.mjs). */
const SPLIT_IDS = path.join(ROOT, "scripts", "split-ids.json");

const HIST_REPO = "aourednik/historical-basemaps";
const HIST_COMMIT = "da7a4b735ecef70aebdc9c73e409d8a2500d50f3";
const NE_REPO = "nvkelso/natural-earth-vector";
const NE_COMMIT = "ca96624a56bd078437bca8184e78163e5039ad19";
const YEARS = [1914, 1938, 1994, 2010];
const EARTH_KM = 6371.0088;

/** A historical side must hold this share of a province to become its own province… */
const MIN_PART_SHARE = 0.15;
/** …and at least this much land, so a coastal mismatch never makes a province. */
const MIN_PART_KM2 = 1500;
/** On the finer map, a country merged by region keeps divisions this large on average (scripts/split.mjs splits the big ones). */
const FINE_UNIT_KM2 = 2500;

/** Region and owner ids: lowercase ASCII words joined by dashes. */
export function slug(name) {
  return String(name)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function* points(coords) {
  if (typeof coords[0] === "number") yield coords;
  else for (const c of coords) yield* points(c);
}

function centroid(geometry) {
  let x = 0, y = 0, n = 0;
  for (const [px, py] of points(geometry.coordinates)) { x += px; y += py; n += 1; }
  return [x / n, y / n];
}

function bbox(geometry) {
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of points(geometry.coordinates)) {
    b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y);
    b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y);
  }
  return b;
}

function inRing([px, py], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function contains(geometry, point) {
  if (!geometry) return false;
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some(([outer, ...holes]) => inRing(point, outer) && !holes.some((h) => inRing(point, h)));
}

/**
 * A function that finds the feature holding a point (or -1): bounding boxes
 * on a 2° grid, then the exact test. With `snap`, a point just off every
 * feature — a coastal city the simplified outline missed, like New York —
 * goes to the feature with the nearest vertex within that many degrees.
 */
function locator(features, snap = 0) {
  const CELL = 2;
  const grid = new Map();
  const boxes = features.map((f) => bbox(f.geometry));
  boxes.forEach(([x0, y0, x1, y1], i) => {
    for (let gx = Math.floor(x0 / CELL); gx <= Math.floor(x1 / CELL); gx += 1) {
      for (let gy = Math.floor(y0 / CELL); gy <= Math.floor(y1 / CELL); gy += 1) {
        const key = `${gx},${gy}`;
        const list = grid.get(key) ?? [];
        list.push(i);
        grid.set(key, list);
      }
    }
  });
  return ([x, y]) => {
    const cell = grid.get(`${Math.floor(x / CELL)},${Math.floor(y / CELL)}`) ?? [];
    for (const i of cell) {
      const [x0, y0, x1, y1] = boxes[i];
      if (x >= x0 && x <= x1 && y >= y0 && y <= y1 && contains(features[i].geometry, [x, y])) return i;
    }
    if (!snap) return -1;
    let best = -1, bestDistance = snap * snap;
    for (const i of cell) {
      const [x0, y0, x1, y1] = boxes[i];
      if (x < x0 - snap || x > x1 + snap || y < y0 - snap || y > y1 + snap) continue;
      for (const [px, py] of points(features[i].geometry.coordinates)) {
        const d = (px - x) ** 2 + (py - y) ** 2;
        if (d < bestDistance) { bestDistance = d; best = i; }
      }
    }
    return best;
  };
}

// d3 reads a ring wound the other way round as everything outside it;
// whichever side is smaller is the polygon. Each part of a multipolygon is
// measured on its own, since parts can come wound either way.
const km2 = (feature) => {
  const g = feature.geometry;
  if (!g) return 0;
  const parts = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  let total = 0;
  for (const coordinates of parts) {
    const a = geoArea({ type: "Polygon", coordinates });
    total += Math.min(a, 4 * Math.PI - a);
  }
  return total * EARTH_KM * EARTH_KM;
};

/** The centre of a province as [lon, lat], with every part wound the way d3 reads it. */
const center = (feature) => {
  const g = feature.geometry;
  const parts = (g.type === "Polygon" ? [g.coordinates] : g.coordinates).map((coordinates) =>
    geoArea({ type: "Polygon", coordinates }) > 2 * Math.PI ? coordinates.map((ring) => [...ring].reverse()) : coordinates,
  );
  return geoCentroid({ type: "MultiPolygon", coordinates: parts }).map((v) => Math.round(v * 10) / 10);
};

async function cached(name, url) {
  const file = path.join(CACHE, name);
  if (existsSync(file)) return JSON.parse(await readFile(file, "utf8"));
  console.log(`downloading ${url}`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const text = await response.text();
  await writeFile(file, text);
  return JSON.parse(text);
}

/** A downloaded binary file, kept in the cache. */
async function cachedBuffer(name, url) {
  const file = path.join(CACHE, name);
  if (existsSync(file)) return readFile(file);
  console.log(`downloading ${url}`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, buffer);
  return buffer;
}

const histFile = (year) =>
  cached(`world_${year}.geojson`, `https://raw.githubusercontent.com/${HIST_REPO}/${HIST_COMMIT}/geojson/world_${year}.geojson`);
const neFile = (name) =>
  cached(`${name}.geojson`, `https://raw.githubusercontent.com/${NE_REPO}/${NE_COMMIT}/geojson/${name}.geojson`);

const started = Date.now();
const log = (message) => console.log(`[${((Date.now() - started) / 1000).toFixed(0)}s] ${message}`);

async function run(commands, input) {
  const output = await mapshaper.applyCommands(commands, input);
  return JSON.parse(output["out.json"]);
}

// ---------------------------------------------------------------------------
// Historical borders
// ---------------------------------------------------------------------------

/**
 * Unnamed pieces the rules below get wrong, by a point inside them or their
 * approximate centre. The Faroes sit closer to Shetland than to anything
 * Danish, Åland closer to Sweden, the Dodecanese to the Anatolian coast — and
 * in 1994/2010 Switzerland's real outline is unnamed while its named sliver
 * lies just across the Italian border.
 */
const ISLETS = [
  { near: [-6.9, 61.9], name: { all: "Denmark" } },
  { near: [19.95, 60.2], name: { all: "Finland" } },
  { near: [27.5, 36.55], name: { 1914: "Kingdom of Italy", 1994: "Greece", 2010: "Greece" } },
  { near: [8.2, 46.8], name: { all: "Switzerland" } },
];

/** Historical polygons with a name (`hid`) and a raw owner slug, cleaned of overlaps. */
async function historicalLayer(year) {
  const collection = await histFile(year);
  // Antarctica is a strip along the bottom edge that nobody plays.
  const features = collection.features.filter((f) => f.geometry && bbox(f.geometry)[3] > -60);
  const named = features.filter((f) => f.properties.NAME);
  const byName = new Map(named.map((f) => [f.properties.NAME, f]));

  for (const islet of features.filter((f) => !f.properties.NAME)) {
    const [cx, cy] = centroid(islet.geometry);
    // 1. A hand-placed answer for the few the rules below get wrong.
    const manual = ISLETS.find(({ near }) =>
      contains(islet.geometry, near) || (Math.abs(near[0] - cx) < 0.6 && Math.abs(near[1] - cy) < 0.6));
    const manualName = manual && (manual.name[year] ?? manual.name.all);
    // 2. A named region with a vertex inside this piece owns it (the source
    //    sometimes names only a sliver inside a country's real outline).
    // 3. Otherwise the named region with the closest vertex.
    let best = manualName ? byName.get(manualName) : undefined;
    best ??= named.find((f) => contains(islet.geometry, points(f.geometry.coordinates).next().value));
    if (!best) {
      let bestDistance = Infinity;
      for (const f of named) {
        for (const [x, y] of points(f.geometry.coordinates)) {
          const d = (x - cx) ** 2 + (y - cy) ** 2;
          if (d < bestDistance) { bestDistance = d; best = f; }
        }
      }
    }
    islet.properties = { ...best.properties };
  }

  const input = {
    type: "FeatureCollection",
    features: features.map((f) => ({
      type: "Feature",
      properties: { hid: slug(f.properties.NAME), hname: f.properties.NAME.trim(), owner: slug((f.properties.SUBJECTO || f.properties.NAME).trim()) },
      geometry: f.geometry,
    })),
  };
  // Same-name pieces become one polygon; overlapping duplicates are cleaned.
  return run("-i hist.json -dissolve hid copy-fields=hname,owner -clean -o out.json format=geojson", { "hist.json": input });
}

// ---------------------------------------------------------------------------
// Provinces
// ---------------------------------------------------------------------------

/**
 * Natural Earth's first-level divisions, regrouped where they are too small
 * to play: a country of many tiny units is merged by its `region` field
 * (England's regions instead of 232 councils), or into one province when it
 * has no regions; microstates are always one province.
 *
 * With `fine` (the finer prototype), a country merged by region whose
 * divisions average FINE_UNIT_KM2 or more keeps them (France's departments,
 * Japan's prefectures, Thailand's provinces); each remembers its region's
 * name (`upName`) for the resources table.
 */
function groupAdmin1(admin1, { fine = false } = {}) {
  const byCountry = new Map();
  for (const f of admin1.features) {
    // Antarctica is a strip along the bottom edge that nobody plays.
    if (f.properties.adm0_a3 === "ATA" || (f.geometry && bbox(f.geometry)[3] < -60)) continue;
    const list = byCountry.get(f.properties.adm0_a3) ?? [];
    list.push({ feature: f, km: km2(f) });
    byCountry.set(f.properties.adm0_a3, list);
  }
  const used = new Set();
  const unique = (id) => {
    let candidate = id || "p";
    for (let i = 2; used.has(candidate); i += 1) candidate = `${id}-${i}`;
    used.add(candidate);
    return candidate;
  };
  const features = [];
  const ungroup = [];
  for (const [adm0, list] of byCountry) {
    const p0 = list[0].feature.properties;
    const n = list.length;
    const area = list.reduce((s, x) => s + x.km, 0);
    const regions = new Set(list.map((x) => x.feature.properties.region).filter(Boolean));
    let mode = "keep";
    if (area < 5000) mode = "one";
    else if ((n > 40 && area / n < 20000) || area / n < 2000) {
      if (regions.size >= 2 && regions.size <= 40 && regions.size < n) mode = "region";
      else if (area / n < 2000 && n > 12) mode = "one";
    }
    const prefix = (/^[A-Z]{2}$/.test(p0.iso_a2) ? p0.iso_a2 : adm0).toLowerCase();
    const groups = new Map();
    for (const { feature } of list) {
      const p = feature.properties;
      const key = mode === "one" ? adm0 : mode === "region" ? `r:${p.region || p.name_en || p.name}` : `u:${p.adm1_code}`;
      const group = groups.get(key) ?? [];
      group.push(feature);
      groups.set(key, group);
    }
    for (const [key, group] of groups) {
      const p = group[0].properties;
      let name, ru, uk;
      if (mode === "one") {
        name = p.admin; ru = null; uk = null;
      } else if (mode === "region") {
        const region = key.slice(2);
        const same = group.find((f) => (f.properties.name_en || f.properties.name) === region);
        name = region; ru = same?.properties.name_ru ?? null; uk = same?.properties.name_uk ?? null;
      } else {
        name = p.name_en || p.name || p.woe_name || p.gn_name || p.name_alt || p.adm1_code;
        ru = p.name_ru ?? null; uk = p.name_uk ?? null;
      }
      // Natural Earth files Crimea and Sevastopol under Russia; their ISO
      // codes (UA-43, UA-40) say Ukraine, and so do the ids and adm0 here.
      const iso = mode === "keep" ? (p.iso_3166_2 || "").split("-")[0] : "";
      const ownPrefix = /^[A-Z]{2}$/.test(iso) ? iso.toLowerCase() : prefix;
      const ownAdm0 = iso === "UA" ? "UKR" : adm0;
      const pid = unique(mode === "one" ? prefix : `${ownPrefix}-${slug(name)}`);
      for (const f of group) {
        if (fine && mode === "region" && area / n >= FINE_UNIT_KM2) ungroup.push({ at: features.length, unit: f.properties, upName: name, prefix });
        features.push({ type: "Feature", properties: { pid, name, ru, uk, adm0: ownAdm0 }, geometry: f.geometry });
      }
    }
  }
  if (ungroup.length) {
    // The kept divisions' ids, unique among every other province's.
    const kept = new Set(ungroup.map((u) => u.at));
    const fineUsed = new Set(features.filter((_, i) => !kept.has(i)).map((f) => f.properties.pid));
    for (const { at, unit, upName, prefix } of ungroup) {
      const name = unit.name_en || unit.name || unit.woe_name || unit.gn_name || unit.name_alt || unit.adm1_code;
      const iso = (unit.iso_3166_2 || "").split("-")[0];
      const base = `${/^[A-Z]{2}$/.test(iso) ? iso.toLowerCase() : prefix}-${slug(name)}`;
      let pid = base;
      for (let i = 2; fineUsed.has(pid); i += 1) pid = `${base}-${i}`;
      fineUsed.add(pid);
      features[at].properties = { pid, name, ru: unit.name_ru ?? null, uk: unit.name_uk ?? null, adm0: features[at].properties.adm0, upName };
    }
  }
  return { type: "FeatureCollection", features };
}

/**
 * Strategic resources from scripts/resources.mjs, on the provinces they
 * name. On the finer map a region the table names that was kept as its
 * divisions puts them on its most populous division.
 */
function attachResources(provinces) {
  // The parts of a split division are named after towns: only the part that keeps the division's name matches.
  const byKey = new Map(provinces.features.filter((f) => f.properties.up == null || f.properties.up === f.properties.pid).map((f) => [`${f.properties.adm0}|${f.properties.name}`.toLowerCase(), f]));
  for (const f of provinces.features) {
    if (!f.properties.upName) continue;
    const key = `${f.properties.adm0}|${f.properties.upName}`.toLowerCase();
    const known = byKey.get(key);
    if (!known || (known.properties.upName && (f.properties.pop ?? 0) > (known.properties.pop ?? 0))) byKey.set(key, f);
  }
  const missing = [];
  for (const [adm0, name, spec] of RESOURCES) {
    const f = byKey.get(`${adm0}|${name}`.toLowerCase());
    if (!f) {
      missing.push(`${adm0} ${name}`);
      continue;
    }
    const list = f.properties.res ? JSON.parse(f.properties.res) : [];
    list.push(...parseResources(spec));
    f.properties.res = JSON.stringify(list);
  }
  if (missing.length) console.warn(`resources not placed: ${missing.join("; ")}`);
}

/**
 * The parts of a province cut by a historical border all start with its
 * resources; the main part keeps them, less the shares RESOURCE_SIDES gives
 * the side a mine lay on, so nothing is counted twice. A share of output is
 * the root of it in points.
 */
function shareResources(geometries) {
  const parts = new Map();
  for (const g of geometries) {
    const base = g.properties.id.replace(/-p\d+$/, "");
    parts.set(base, [...(parts.get(base) ?? []), g]);
  }
  for (const list of parts.values()) {
    const main = list.find((g) => !/-p\d+$/.test(g.properties.id));
    // Output the finer map placed by its mines (placeMines) is where it belongs already.
    if (list.some((g) => g.properties.mined)) continue;
    if (list.length < 2 || !main?.properties.res) continue;
    const sides = RESOURCE_SIDES[`${main.properties.adm0}|${main.properties.name}`] ?? {};
    for (const g of list) {
      const res = g.properties.res
        .map(([type, curve]) => {
          const given = Object.values(sides).reduce((s, side) => s + (side[type] ?? 0), 0);
          const share = g === main ? Math.max(0, 1 - given) : (sides[g.properties.owner]?.[type] ?? 0);
          return [type, curve.map(([y, v]) => [y, Math.round(v * Math.sqrt(share) * 10) / 10])];
        })
        .filter(([, curve]) => curve.some(([, v]) => v > 0));
      if (res.length) g.properties.res = res;
      else delete g.properties.res;
    }
  }
}

/**
 * On a finer map, the output of a region RESOURCE_POINTS knows goes from the
 * provinces the table put it on (its most populous division, or every piece
 * of a cut one) to the provinces holding its mines, each the share dug
 * there (output adds as squares: a share's points are its root).
 */
function placeMines(features, year) {
  const find = locator(features, 0.2);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  for (const [key, mines] of Object.entries(RESOURCE_POINTS)) {
    const entry = RESOURCES.find(([adm0, name]) => `${adm0}|${name}` === key);
    if (!entry) continue;
    const curves = parseResources(entry[2]);
    let placed = false;
    for (const f of features) {
      if (!f.properties.res) continue;
      const res = JSON.parse(f.properties.res);
      const kept = res.filter((r) => !curves.some((c) => same(c, r)));
      if (kept.length === res.length) continue;
      placed = true;
      f.properties.res = kept.length ? JSON.stringify(kept) : "";
    }
    if (!placed) continue;
    const shares = new Map();
    for (const mine of mines) {
      const i = find(mine.at);
      if (i < 0) {
        log(`${year}: ${key}: no province holds the mine at ${mine.at}`);
        continue;
      }
      const s = shares.get(i) ?? {};
      for (const [type] of curves) if (mine[type]) s[type] = (s[type] ?? 0) + mine[type];
      shares.set(i, s);
    }
    for (const [i, s] of shares) {
      const f = features[i];
      const res = f.properties.res ? JSON.parse(f.properties.res) : [];
      for (const [type, curve] of curves) {
        if (!s[type]) continue;
        if (res.some((r) => r[0] === type)) {
          log(`${year}: ${key}: ${f.properties.id} has ${type} of its own; the mine's is left out`);
          continue;
        }
        res.push([type, curve.map(([y, v]) => [y, Math.round(v * Math.sqrt(Math.min(1, s[type])) * 10) / 10])]);
      }
      if (res.length) f.properties.res = JSON.stringify(res);
      f.properties.mined = "1";
    }
  }
}

/**
 * The major rivers through each province (Natural Earth scale rank 5 and
 * up), most important first: a river vertex inside the province counts.
 */
function attachRivers(provinces, rivers) {
  const find = locator(provinces.features);
  const found = provinces.features.map(() => new Map());
  for (const r of rivers.features) {
    const name = r.properties.name_en || r.properties.name;
    if (!name || !r.geometry || r.properties.scalerank > 5) continue;
    for (const point of points(r.geometry.coordinates)) {
      const i = find(point);
      if (i >= 0 && !found[i].has(name)) found[i].set(name, r.properties.scalerank);
    }
  }
  provinces.features.forEach((f, i) => {
    const names = [...found[i].entries()].sort((a, b) => a[1] - b[1]).slice(0, 4).map(([n]) => n);
    if (names.length) f.properties.rv = names.join("|");
  });
}

/**
 * Which province a Natural Earth place lies in: the one that contains it,
 * else the one its record names (ADM1NAME), else the nearest within 0.3°.
 */
function placeFinder(features) {
  const inside = locator(features);
  const near = locator(features, 0.3);
  const byName = new Map();
  features.forEach((f, i) => {
    const key = `${f.properties.adm0}|${f.properties.name}`.toLowerCase();
    if (!byName.has(key)) byName.set(key, i);
  });
  return (place) => {
    const i = inside(place.geometry.coordinates);
    if (i >= 0) return i;
    return byName.get(`${place.properties.ADM0_A3}|${place.properties.ADM1NAME}`.toLowerCase()) ?? near(place.geometry.coordinates);
  };
}

/**
 * A place's own population today, in thousands. POP_MAX is often the whole
 * agglomeration, given to every suburb in it as well; POP_MIN is the place.
 */
const ownPopulation = (p) => (p.POP_MIN || p.POP_MAX || 0) / 1000;

/** A place's population in thousands on a start date, from Natural Earth's series. */
function placePopulation(p, year) {
  const now = ownPopulation(p);
  if (year >= 2015) return p.POP2020 || now;
  if (year >= 1985) return p.POP1990 || now * 0.65;
  if (year >= 1935) return p.POP1950 ? p.POP1950 * 0.8 : now * 0.3;
  return p.POP1950 ? p.POP1950 * 0.55 : now * 0.2;
}

/**
 * Population on the start date, in thousands. Each country's total
 * (scripts/population.mjs) is shared out in two parts: its cities' people go
 * to the provinces they stand in; the rest follows half settlement — every
 * town on Natural Earth's list counts by the square root of its size — and
 * half the land, area weighted by fertility, so a province with no listed town
 * still has its villages, while the Nile valley and the Punjab fill and Sinai
 * stays thin. Where
 * today's census shares are known (PROVINCE_POPULATION) they replace the
 * towns, and in 2022 they are the whole answer.
 */
function attachPopulation(features, year, { places, countries }) {
  const column = [1914, 1939, 1991, 2022].indexOf(POPULATION_YEAR[year]);
  const find = placeFinder(features);
  const urban = new Float64Array(features.length);
  const settled = new Float64Array(features.length);
  const urbanToday = new Float64Array(features.length);
  for (const place of places.features) {
    const i = find(place);
    if (i < 0) continue;
    // Only real cities count as urban; small towns are part of the countryside.
    if (ownPopulation(place.properties) >= 50) {
      urban[i] += placePopulation(place.properties, POPULATION_YEAR[year]);
      urbanToday[i] += placePopulation(place.properties, 2022);
    }
    settled[i] += Math.max(ownPopulation(place.properties), 1) ** 0.8;
  }
  const rural = new Float64Array(features.length);
  // Towns in a desert oasis stand for fewer villages around them than towns in a delta.
  const towned = (i) => settled[i] * (0.15 + features[i].properties.fertility / 100);
  const fields = (i) => features[i].properties.area * (0.0003 + (features[i].properties.fertility / 100) ** 2.5);
  const byCountry = new Map();
  features.forEach((f, i) => byCountry.set(f.properties.adm0, [...(byCountry.get(f.properties.adm0) ?? []), i]));
  const guessed = [];
  for (const [adm0, list] of byCountry) {
    let total = POPULATION[adm0]?.[column];
    if (total === undefined) {
      const country = countries.get(adm0);
      // A territory Natural Earth gives no estimate for: ten people per km².
      total = country ? (country.pop / 1000) * (REGION_GROWTH[country.region]?.[column] ?? 1) : list.reduce((s, i) => s + features[i].properties.area, 0) * 0.01;
      guessed.push(adm0);
    }
    const towns = list.reduce((s, i) => s + towned(i), 0);
    const land = list.reduce((s, i) => s + fields(i), 0);
    for (const i of list) rural[i] = (towns > 0 ? (0.5 * towned(i)) / towns : 0) + (land > 0 ? ((towns > 0 ? 0.5 : 1) * fields(i)) / land : 0);
    const census = PROVINCE_POPULATION[adm0];
    if (census) {
      // A province cut by a historical border shares its figure by area; the
      // parts of a division split on the finer map (`up`), by its towns and land.
      const base = (i) => features[i].properties.up ?? features[i].properties.id.replace(/-p\d+$/, "");
      const areaOf = new Map();
      const ruralOf = new Map();
      for (const i of list) {
        areaOf.set(base(i), (areaOf.get(base(i)) ?? 0) + features[i].properties.area);
        ruralOf.set(base(i), (ruralOf.get(base(i)) ?? 0) + rural[i]);
      }
      const known = list.filter((i) => census[base(i)] !== undefined);
      // Thousands today; in earlier years only the people outside today's
      // big cities, since the cities are counted on their own.
      const weight = (i) => {
        const today = features[i].properties.up != null && ruralOf.get(base(i)) > 0
          ? (census[base(i)] * 1000 * rural[i]) / ruralOf.get(base(i))
          : (census[base(i)] * 1000 * features[i].properties.area) / areaOf.get(base(i));
        return POPULATION_YEAR[year] === 2022 ? today : Math.max(today - urbanToday[i], today * 0.03);
      };
      // Provinces the table leaves out keep their towns, in the table's units.
      const scale = known.reduce((s, i) => s + weight(i), 0) / Math.max(1e-9, known.reduce((s, i) => s + rural[i], 0));
      for (const i of list) rural[i] = census[base(i)] !== undefined ? weight(i) : rural[i] * scale;
      if (POPULATION_YEAR[year] === 2022) list.forEach((i) => (urban[i] = 0));
    }
    const cities = list.reduce((s, i) => s + urban[i], 0);
    const countryside = list.reduce((s, i) => s + rural[i], 0);
    // City figures are agglomerations that can overlap; they never take more than 60%.
    const share = cities > 0 ? Math.min(0.6, cities / total) : 0;
    const growth = naturalGrowth(adm0, column, countries);
    for (const i of list) {
      const pop = total * ((cities > 0 ? (share * urban[i]) / cities : 0) + (countryside > 0 ? ((1 - share) * rural[i]) / countryside : 0));
      features[i].properties.pop = Math.round(pop);
      if (growth !== null) features[i].properties.gr = growth;
    }
  }
  return guessed.length;
}

const CHECKPOINTS = [1914, 1939, 1991, 2022];

/**
 * How fast a country's people grew on average after the start date, % a
 * year: from the start to the next checkpoint in POPULATION (or its
 * region's growth). It includes the era's wars and famines, so it is a
 * tendency, not a birth rate. After 2022 there is no next checkpoint: the
 * last thirty years' pace, with growth slowed a quarter as birth rates fall.
 */
function naturalGrowth(adm0, column, countries) {
  const region = countries.get(adm0)?.region;
  const series = POPULATION[adm0] ?? (REGION_GROWTH[region] ? REGION_GROWTH[region] : null);
  if (!series) return null;
  const [from, to] = column < 3 ? [column, column + 1] : [2, 3];
  if (!(series[from] > 0) || !(series[to] > 0)) return null;
  const rate = ((series[to] / series[from]) ** (1 / (CHECKPOINTS[to] - CHECKPOINTS[from])) - 1) * 100;
  return Math.round((column < 3 || rate < 0 ? rate : rate * 0.75) * 100) / 100;
}

/** Natural Earth's railways cut into segments: midpoint, length in km and the year built. */
function railSegments(railroads) {
  const xs = [], ys = [], kms = [], years = [];
  for (const f of railroads.features) {
    if (!f.geometry || f.properties.scalerank > 8) continue;
    const lines = f.geometry.type === "LineString" ? [f.geometry.coordinates] : f.geometry.coordinates;
    const since = railSince(lines[0][Math.floor(lines[0].length / 2)]);
    for (const line of lines) {
      for (let k = 1; k < line.length; k += 1) {
        const a = line[k - 1], b = line[k];
        xs.push((a[0] + b[0]) / 2);
        ys.push((a[1] + b[1]) / 2);
        kms.push(geoDistance(a, b) * EARTH_KM);
        years.push(since);
      }
    }
  }
  return { x: Float64Array.from(xs), y: Float64Array.from(ys), km: Float64Array.from(kms), since: Int16Array.from(years) };
}

/** Kilometres of railway in each province on the start date (Natural Earth's main network, so an index more than a census). */
function attachRail(features, year, rails) {
  const find = locator(features);
  const km = new Float64Array(features.length);
  const date = POPULATION_YEAR[year];
  for (let s = 0; s < rails.x.length; s += 1) {
    if (rails.since[s] > date) continue;
    const i = find([rails.x[s], rails.y[s]]);
    if (i >= 0) km[i] += rails.km[s];
  }
  features.forEach((f, i) => {
    if (km[i] >= 1) f.properties.rail = Math.round(km[i]);
  });
}

/** Railways (with the year built, where after 1914) and ports, shared by every era. */
async function buildTransport(railroads) {
  const ports = await neFile("ne_10m_ports");
  const rails = {
    type: "FeatureCollection",
    features: railroads.features
      .filter((f) => f.geometry && f.properties.scalerank <= 8)
      .map((f) => {
        const first = f.geometry.type === "LineString" ? f.geometry.coordinates : f.geometry.coordinates[0];
        const since = railSince(first[Math.floor(first.length / 2)]);
        return { type: "Feature", properties: { r: f.properties.scalerank, s: since }, geometry: f.geometry };
      }),
  };
  const harbours = {
    type: "FeatureCollection",
    features: ports.features
      .filter((f) => f.geometry && f.properties.name)
      .map((f) => ({ type: "Feature", properties: { n: f.properties.name, r: f.properties.scalerank }, geometry: f.geometry })),
  };
  const out = await mapshaper.applyCommands(
    "-i railways.json ports.json combine-files -dissolve r,s target=railways -simplify 5% keep-shapes target=railways -o out.json format=topojson target=* quantization=30000",
    { "railways.json": rails, "ports.json": harbours },
  );
  const topo = JSON.parse(out["out.json"]);
  topo.meta = { source: `${NE_REPO}@${NE_COMMIT} (public domain)`, since: "scripts/transport.mjs" };
  const text = JSON.stringify(topo);
  await writeFile(path.join(OUT, "transport.json"), text);
  log(`transport.json  ${rails.features.length} railway lines, ${harbours.features.length} ports  ${(text.length / 1024).toFixed(0)} KB`);
}

/** Rivers and lakes for the map, shared by every era. */
async function buildWater() {
  const rivers = await neFile("ne_10m_rivers_lake_centerlines");
  const lakes = await neFile("ne_10m_lakes");
  const keepRivers = {
    type: "FeatureCollection",
    features: rivers.features
      .filter((f) => f.geometry && f.properties.scalerank <= 7)
      .map((f) => ({ type: "Feature", properties: { n: f.properties.name_en || f.properties.name || "", r: f.properties.scalerank }, geometry: f.geometry })),
  };
  const keepLakes = {
    type: "FeatureCollection",
    features: lakes.features
      .filter((f) => f.geometry && f.properties.scalerank <= 5 && bbox(f.geometry)[3] > -60)
      .map((f) => ({ type: "Feature", properties: { n: f.properties.name || "", r: f.properties.scalerank }, geometry: f.geometry })),
  };
  const out = await mapshaper.applyCommands(
    "-i rivers.json lakes.json combine-files -simplify 8% keep-shapes -o out.json format=topojson quantization=40000",
    { "rivers.json": keepRivers, "lakes.json": keepLakes },
  );
  const topo = JSON.parse(out["out.json"]);
  topo.meta = { source: `${NE_REPO}@${NE_COMMIT} (public domain)` };
  const text = JSON.stringify(topo);
  await writeFile(path.join(OUT, "water.json"), text);
  log(`water.json  ${keepRivers.features.length} rivers, ${keepLakes.features.length} lakes  ${(text.length / 1024).toFixed(0)} KB`);
}

/** Smaller places that were capitals or flashpoints in one of the eras. */
const EXTRA_CITIES = ["Kaunas", "Klaipėda", "Chernivtsi", "Uzhhorod", "Ivano-Frankivsk", "Gdańsk", "Szczecin", "Poznań", "Luhansk", "Zaporizhzhia", "Kropyvnytskyi", "Sevastopol", "Tobruk", "Narvik"];

/**
 * Places for the map: Natural Earth's cities and towns of scale rank 6 and
 * up, every national and provincial capital and a few flashpoints, with names
 * in three languages and the populations of 1950, 1990 and 2020, from which
 * the game picks what mattered in each era.
 */
async function buildCities(places) {
  const cities = places.features
    .filter((f) => {
      const p = f.properties;
      return p.SCALERANK <= 6 || p.ADM0CAP === 1 || /^Admin-1/.test(p.FEATURECLA) || EXTRA_CITIES.includes(p.NAME_EN || p.NAME);
    })
    .map((f) => {
      const p = f.properties;
      const [x, y] = f.geometry.coordinates;
      return {
        n: p.NAME_EN || p.NAME,
        ...(p.NAME_RU ? { ru: p.NAME_RU } : {}),
        ...(p.NAME_UK ? { uk: p.NAME_UK } : {}),
        x: Math.round(x * 1000) / 1000,
        y: Math.round(y * 1000) / 1000,
        r: p.SCALERANK,
        ...(p.ADM0CAP === 1 ? { cap: 1 } : {}),
        ...(/^Admin-1/.test(p.FEATURECLA) ? { adm1: 1 } : {}),
        a: p.ADM0_A3,
        p50: p.POP1950 || 0,
        p90: p.POP1990 || 0,
        p20: p.POP2020 || Math.round((p.POP_MAX || 0) / 1000),
      };
    });
  const text = JSON.stringify(cities);
  await writeFile(path.join(OUT, "cities.json"), text);
  log(`cities.json  ${cities.length} cities  ${(text.length / 1024).toFixed(0)} KB`);
  return cities;
}

const GEONAMES = "https://download.geonames.org/export/dump";
const WIKIDATA_SPARQL = "https://query.wikidata.org/sparql";

/** One answer of Wikidata's query service, kept in the cache by its query; asked again after a pause on a 429 or 5xx, which it gives now and then. */
async function askWikidata(query) {
  const file = path.join(CACHE, `geonames/wikidata/${createHash("sha1").update(query).digest("hex").slice(0, 16)}.json`);
  if (existsSync(file)) return JSON.parse(await readFile(file, "utf8"));
  let text = null;
  for (let attempt = 0; text === null; attempt += 1) {
    // A dropped connection is asked again like a refusal.
    const response = await fetch(WIKIDATA_SPARQL, {
      method: "POST",
      headers: { accept: "application/sparql-results+json", "content-type": "application/x-www-form-urlencoded", "user-agent": "GulfOfTrump-maps/1.0" },
      body: new URLSearchParams({ query }),
    }).catch((error) => ({ ok: false, status: error.code ?? error.message }));
    if (response.ok) text = await response.text().catch(() => null);
    if (text !== null) break;
    if (attempt >= 5) throw new Error(`Wikidata: ${response.status}`);
    await new Promise((resolve) => setTimeout(resolve, 5000 * (attempt + 1)));
  }
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, text);
  return JSON.parse(text);
}

/**
 * The Russian and Ukrainian names of a GeoNames list's places: as GeoNames
 * tags them in the alternate names of every country they lie in, and where it
 * tags none, Wikidata's labels of the same places (by their GeoNames id).
 */
async function placeNames(text, what) {
  const tagged = new Map();
  const ids = townIds(text);
  const countries = townCountries(text);
  for (const country of countries) {
    const zip = await cachedBuffer(`geonames/${country}.zip`, `${GEONAMES}/alternatenames/${country}.zip`).catch(() => null);
    if (!zip) {
      log(`${what}: no alternate names for ${country}`);
      continue;
    }
    taggedNames(unzip(zip, `${country}.txt`), tagged, ids);
  }
  const untagged = [...ids].filter((id) => !tagged.get(id)?.ru || !tagged.get(id)?.uk);
  const labels = await wikidataLabels(untagged, askWikidata);
  log(`${what}: tagged names of ${countries.length} countries; Wikidata labels for ${labels.size} of ${untagged.length} places GeoNames does not name`);
  return { tagged, labels };
}

/**
 * GeoNames' places of 1,000 to 15,000 people (cities1000), as splitLarge's
 * towns: they name the finer map's parts no town lies in. Kept in the cache
 * once made (delete scripts/.cache/geonames/villages.json to make it again).
 */
async function loadVillages() {
  const cached = path.join(CACHE, "geonames", "villages.json");
  if (existsSync(cached)) return JSON.parse(await readFile(cached, "utf8"));
  const all = unzip(await cachedBuffer("geonames/cities1000.zip", `${GEONAMES}/cities1000.zip`), "cities1000.txt");
  const text = all
    .split("\n")
    .filter((line) => {
      const people = Number(line.split("\t")[14]);
      return people >= 1000 && people < 15000;
    })
    .join("\n");
  const { tagged, labels } = await placeNames(text, "villages");
  const villages = parseTowns(text, [], tagged, labels, { min: 1000, max: 15000 }).map(([name, x, y, people, , ru, uk]) => [x, y, people, name, ru || null, uk || null]);
  await writeFile(cached, JSON.stringify(villages));
  return villages;
}

/** Towns of 15,000 people and more from GeoNames that cities.json does not hold (see scripts/towns.mjs). */
async function buildTowns(cities) {
  const text = unzip(await cachedBuffer("geonames/cities15000.zip", `${GEONAMES}/cities15000.zip`), "cities15000.txt");
  const { tagged, labels } = await placeNames(text, "towns");
  const towns = parseTowns(text, cities, tagged, labels);
  const named = towns.filter((t) => t[5] || t[6]).length;
  log(`towns: ${named} of ${towns.length} with a Russian or Ukrainian name`);
  const out = JSON.stringify({ source: "GeoNames cities15000 (CC BY 4.0), https://www.geonames.org/; Russian and Ukrainian names also from Wikidata (CC0)", towns });
  await writeFile(path.join(OUT, "towns.json"), out);
  log(`towns.json  ${towns.length} towns  ${(out.length / 1024).toFixed(0)} KB`);
}

async function buildProvinces({ fine = null } = {}) {
  const admin1 = await neFile("ne_10m_admin_1_states_provinces");
  const grouped = groupAdmin1(admin1, { fine: Boolean(fine) });
  log("grouped admin-1");
  // Simplify once here, before every era's cut, so the cuts stay fast.
  let provinces = await run(
    // Simplify before dissolving: the 10m source is detailed enough that
    // dissolving and cleaning it at full resolution takes many minutes.
    `-i base.json -simplify 5% weighted keep-shapes -dissolve pid copy-fields=name,ru,uk,adm0${fine ? ",upName" : ""} -clean -o out.json format=geojson`,
    { "base.json": grouped },
  );
  provinces.features = provinces.features.filter((f) => f.geometry);
  log("dissolved and simplified provinces");
  // The geography regions are only sampled; a coarse copy is plenty.
  const regions = await run("-i regions.json -simplify 10% keep-shapes -o out.json format=geojson", {
    "regions.json": await neFile("ne_10m_geography_regions_polys"),
  });
  const rivers = await neFile("ne_10m_rivers_lake_centerlines");
  describeLand(provinces, regions, rivers, { bbox, contains, centroid });
  log("terrain and fertility");
  if (fine) {
    provinces = await splitProvinces(provinces, { ...fine, regions });
    describeLand(provinces, regions, rivers, { bbox, contains, centroid });
    log("finer provinces: terrain and fertility of the parts");
  }
  attachResources(provinces);
  attachRivers(provinces, rivers);
  log("resources and rivers");
  log(`${provinces.features.length} base provinces`);
  return provinces;
}

/**
 * The finer prototype's split (scripts/split.mjs): each division's people
 * in 1991 are estimated the way an era's are, then the large ones are cut
 * into parts. A part keeps its division's id in `up` through the build.
 */
async function splitProvinces(provinces, { allPlaces, countries, regions }) {
  const estimate = provinces.features.map((f) => ({ ...f, properties: { ...f.properties, id: f.properties.pid, area: Math.round(km2(f)) } }));
  attachPopulation(estimate, 1994, { places: allPlaces, countries });
  provinces.features.forEach((f, i) => {
    f.properties.area = estimate[i].properties.area;
    f.properties.pop = estimate[i].properties.pop;
  });
  const places = allPlaces.features
    .filter((f) => f.geometry)
    .map((f) => {
      const p = f.properties;
      return [...f.geometry.coordinates, ownPopulation(p), p.NAME_EN || p.NAME, p.NAME_RU || null, p.NAME_UK || null];
    });
  // GeoNames' towns name the parts with no Natural Earth place (the committed towns.json: [name, x, y, people, seat, ru?, uk?]).
  const towns = JSON.parse(readFileSync(path.join(OUT, "towns.json"), "utf8")).towns.map(([name, x, y, people, , ru, uk]) => [x, y, people, name, ru || null, uk || null]);
  // Places of 1,000 people and more name the parts no town lies in, before a landform or a side – those with a Russian name only:
  // "Córdoba (north)" reads in Cyrillic, a hamlet with no Cyrillic name would not.
  const villages = (await loadVillages()).filter((v) => v[4]);
  // Natural Earth's landforms (ranges, plateaus, deserts, plains, not islands or coasts, which many provinces share) name the parts with no town at all, the most local first.
  const LANDFORMS = new Set(["Range/mtn", "Plateau", "Desert", "Plain", "Basin", "Lowland", "Valley", "Wetlands", "Tundra", "Delta", "Foothills", "Depression", "Gorge"]);
  const caps = (s) => (s === s.toUpperCase() ? s.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (m) => m.toUpperCase()) : s);
  // The selva has no Russian name in Natural Earth and a Ukrainian one in capitals; its parts are the emptiest of all, with no village to be named after.
  const LAND_NAMES = { Selva: { ru: "Сельва", uk: "Сельва" } };
  const lands = regions.features
    .filter((f) => f.geometry && f.properties.NAME && LANDFORMS.has(f.properties.FEATURECLA))
    .map((f) => {
      const name = caps(f.properties.NAME_EN || f.properties.NAME);
      const ru = LAND_NAMES[name]?.ru ?? (f.properties.NAME_RU ? caps(f.properties.NAME_RU) : null);
      const uk = LAND_NAMES[name]?.uk ?? (f.properties.NAME_UK ? caps(f.properties.NAME_UK) : null);
      return { name, ru, uk, rank: f.properties.SCALERANK, box: bbox(f.geometry), geometry: f.geometry };
    })
    .sort((a, b) => b.rank - a.rank || a.name.localeCompare(b.name));
  // The parts' ids as earlier builds gave them (scripts/split.mjs): saves keep provinces by id, so a renamed part keeps its own.
  const frozen = existsSync(SPLIT_IDS) ? JSON.parse(readFileSync(SPLIT_IDS, "utf8")) : {};
  const { collection, summary } = await splitLarge(provinces, places, towns, lands, { bbox, contains, slug, run, frozen, villages });
  log(`finer provinces: ${summary.split} divisions split into ${summary.parts} parts (${summary.unnamed} named by direction; too thin to split: ${summary.skipped.join(", ") || "none"})`);
  if (summary.refrozen.length) console.warn(`finer provinces: new ids for divisions whose parts changed in number (old saves lose them): ${summary.refrozen.join(", ")}`);
  // New divisions and changed ones are frozen as they came; the rest stay as they were.
  const table = { ...frozen };
  for (const [pid, ids] of Object.entries(summary.ids)) if (!table[pid] || summary.refrozen.includes(pid)) table[pid] = ids;
  const sorted = Object.fromEntries(Object.keys(table).sort().map((key) => [key, table[key]]));
  await writeFile(SPLIT_IDS, `${JSON.stringify(sorted, null, 1)}\n`);
  // Mends the T-junctions where a part's edge meets a neighbour's border, so neighbours share their arcs.
  const cleaned = await run("-i parts.json -clean -o out.json format=geojson", { "parts.json": collection });
  cleaned.features = cleaned.features.filter((f) => f.geometry);
  for (const f of cleaned.features) {
    delete f.properties.area;
    delete f.properties.cell;
  }
  return cleaned;
}

// ---------------------------------------------------------------------------
// One era
// ---------------------------------------------------------------------------

function nearestHistorical(feature, hist) {
  const c = centroid(feature.geometry);
  const inside = hist.features.find((h) => h.geometry && contains(h.geometry, c));
  if (inside) return inside.properties;
  let best = null, bestDistance = Infinity;
  for (const h of hist.features) {
    if (!h.geometry) continue;
    for (const [x, y] of points(h.geometry.coordinates)) {
      const d = (x - c[0]) ** 2 + (y - c[1]) ** 2;
      if (d < bestDistance) { bestDistance = d; best = h.properties; }
    }
  }
  return best;
}

const SIDES = {
  north: { name: "north", ru: "север", uk: "північ" },
  south: { name: "south", ru: "юг", uk: "південь" },
  east: { name: "east", ru: "восток", uk: "схід" },
  west: { name: "west", ru: "запад", uk: "захід" },
};

/**
 * A province cut by a historical border keeps its name on the main part; the
 * other parts get the side they lie on — "Minsk Region (west)" is the
 * Polish part of 1938, "Minsk Region" the Soviet one.
 */
function nameParts(collection) {
  const byId = new Map(collection.features.filter((f) => f.geometry).map((f) => [f.properties.id, f]));
  for (const f of byId.values()) {
    const match = /^(.*)-p\d+$/.exec(f.properties.id);
    const main = match && byId.get(match[1]);
    if (!main) continue;
    const [x, y] = centroid(f.geometry);
    const [mx, my] = centroid(main.geometry);
    const side = SIDES[Math.abs(x - mx) > Math.abs(y - my) ? (x > mx ? "east" : "west") : y > my ? "north" : "south"];
    for (const k of ["name", "ru", "uk"]) if (f.properties[k]) f.properties[k] = `${f.properties[k]} (${side[k]})`;
  }
}

/**
 * On the finer map, a historical side holding enough of a whole division for
 * a province of its own (as the standard map cuts it) keeps one though no
 * single part of the division holds enough of it: its largest piece, which
 * the standard map's province then lies in (German Upper Silesia in 1914,
 * spread over two parts of the Silesian Voivodeship). A side that is some
 * part's own, or has a piece of its own already, changes nothing.
 */
function keepDivisionSides(year, shares, partKey, divisionOf) {
  const divisions = new Map();
  for (const [pid, { total, by }] of shares) {
    const up = divisionOf(pid);
    const d = divisions.get(up) ?? { total: 0, by: new Map(), best: new Map(), kept: new Set() };
    d.total += total;
    for (const [hid, area] of by) {
      d.by.set(hid, (d.by.get(hid) ?? 0) + area);
      if (partKey.has(`${pid}|${hid}`)) d.kept.add(hid);
      const best = d.best.get(hid);
      if (!best || area > best.area) d.best.set(hid, { pid, area });
    }
    divisions.set(up, d);
  }
  const taken = new Set(partKey.values());
  for (const [up, d] of divisions) {
    for (const [hid, area] of d.by) {
      if (d.kept.has(hid) || area / d.total < MIN_PART_SHARE || area / 1e6 < MIN_PART_KM2) continue;
      const { pid } = d.best.get(hid);
      let n = 2;
      while (taken.has(`${pid}-p${n}`)) n += 1;
      partKey.set(`${pid}|${hid}`, `${pid}-p${n}`);
      taken.add(`${pid}-p${n}`);
      log(`${year}: ${pid}-p${n} keeps ${hid}'s ${Math.round(area / 1e6)} km² of ${up}`);
    }
  }
}

async function buildEra(year, provinces, { allPlaces, countries, rails }, { fine = false } = {}) {
  const hist = await historicalLayer(year);
  log(`${year}: historical layer`);
  const histById = new Map(hist.features.map((f) => [f.properties.hid, f.properties]));
  const provinceById = new Map(provinces.features.map((f) => [f.properties.pid, f]));

  const pieces = await run(
    "-i base.json hist.json combine-files -union target=base,hist fields=pid,hid -each \"area=this.area\" -o out.json format=geojson",
    { "base.json": { type: "FeatureCollection", features: provinces.features.map((f) => ({ ...f, properties: { pid: f.properties.pid } })) },
      "hist.json": { type: "FeatureCollection", features: hist.features.map((f) => ({ ...f, properties: { hid: f.properties.hid } })) } },
  );

  log(`${year}: cut along historical borders`);
  // Which historical sides hold a real share of each province?
  const shares = new Map();
  for (const piece of pieces.features) {
    const { pid, hid, area } = piece.properties;
    if (!pid || !piece.geometry) continue;
    const entry = shares.get(pid) ?? { total: 0, by: new Map() };
    entry.total += area;
    if (hid) entry.by.set(hid, (entry.by.get(hid) ?? 0) + area);
    shares.set(pid, entry);
  }

  const partKey = new Map(); // `${pid}|${hid}` -> final province id
  const dominant = new Map(); // pid -> hid of the main part
  for (const [pid, { total, by }] of shares) {
    const sides = [...by.entries()].sort((a, b) => b[1] - a[1]);
    if (!sides.length) {
      const near = nearestHistorical(provinceById.get(pid), hist);
      dominant.set(pid, near.hid);
      partKey.set(`${pid}|${near.hid}`, pid);
      continue;
    }
    dominant.set(pid, sides[0][0]);
    partKey.set(`${pid}|${sides[0][0]}`, pid);
    let n = 2;
    for (const [hid, area] of sides.slice(1)) {
      if (area / total >= MIN_PART_SHARE && area / 1e6 >= MIN_PART_KM2) partKey.set(`${pid}|${hid}`, `${pid}-p${n++}`);
    }
  }
  if (fine) keepDivisionSides(year, shares, partKey, (pid) => provinceById.get(pid).properties.up ?? pid);

  const features = [];
  for (const piece of pieces.features) {
    const { pid, hid } = piece.properties;
    if (!pid || !piece.geometry) continue;
    const id = partKey.get(`${pid}|${hid}`) ?? partKey.get(`${pid}|${dominant.get(pid)}`);
    const side = id === pid ? dominant.get(pid) : hid;
    const base = provinceById.get(pid).properties;
    const h = histById.get(side);
    features.push({
      type: "Feature",
      properties: {
        id, name: base.name, ru: base.ru, uk: base.uk, adm0: base.adm0, res: base.res, rv: base.rv,
        hist: side, owner: h.owner, terrain: base.terrain, fertility: base.fertility, ...(fine ? { up: base.up } : {}),
      },
      geometry: piece.geometry,
    });
  }
  // Provinces the cut never touched (no historical polygon overlaps them at all).
  for (const [pid, province] of provinceById) {
    if (shares.has(pid)) continue;
    const near = nearestHistorical(province, hist);
    const base = province.properties;
    features.push({
      type: "Feature",
      properties: { id: pid, name: base.name, ru: base.ru, uk: base.uk, adm0: base.adm0, res: base.res, rv: base.rv, hist: near.hid, owner: near.owner, terrain: base.terrain, fertility: base.fertility, ...(fine ? { up: base.up } : {}) },
      geometry: province.geometry,
    });
  }

  const merged = await run(
    `-i pieces.json -dissolve id copy-fields=name,ru,uk,adm0,res,rv,hist,owner,terrain,fertility${fine ? ",up" : ""} -o out.json format=geojson`,
    { "pieces.json": { type: "FeatureCollection", features } },
  );

  log(`${year}: merged parts`);
  nameParts(merged);

  // Specks under a square kilometre (rocks, digitising leftovers) are not provinces.
  merged.features = merged.features.filter((f) => f.geometry && km2(f) >= 1);
  // Area, centre (lon, lat to a tenth of a degree) and the largest city of each province.
  for (const f of merged.features) {
    f.properties.area = Math.round(km2(f));
    // As text through mapshaper, like res and rv; an array again in the output.
    f.properties.at = center(f).join(",");
  }
  const findCity = placeFinder(merged.features);
  for (const place of [...allPlaces.features].sort((a, b) => (b.properties.POP_MAX || 0) - (a.properties.POP_MAX || 0))) {
    const i = findCity(place);
    if (i >= 0 && !merged.features[i].properties.city) merged.features[i].properties.city = place.properties.NAME;
  }
  const guessed = attachPopulation(merged.features, year, { places: allPlaces, countries });
  attachRail(merged.features, year, rails);
  // Income: GDP per person of the modern country in 2019, the base the
  // economy scales back to each date (src/engine/economy.ts).
  for (const f of merged.features) {
    const income = countries.get(f.properties.adm0)?.income;
    if (income) f.properties.inc = Math.round(income / 100) * 100;
  }
  log(`${year}: population (${guessed} countries by regional growth) and railways`);
  if (fine) {
    attachCoarse(merged.features, year);
    placeMines(merged.features, year);
  }

  const topo = await run(
    "-i provinces.json -simplify 45% keep-shapes -o out.json format=topojson quantization=60000",
    { "provinces.json": merged },
  );
  const [layer] = Object.keys(topo.objects);
  topo.objects = { regions: topo.objects[layer] };
  topo.objects.regions.geometries = topo.objects.regions.geometries.filter((g) => g.type);

  // Coastal: a province owns an arc no other province shares (with the sea).
  const uses = new Map();
  const walk = (arcs, fn) => (typeof arcs[0] === "number" ? arcs.forEach(fn) : arcs.forEach((a) => walk(a, fn)));
  for (const g of topo.objects.regions.geometries) walk(g.arcs, (a) => uses.set(a < 0 ? ~a : a, (uses.get(a < 0 ? ~a : a) ?? 0) + 1));
  for (const g of topo.objects.regions.geometries) {
    let coastal = false;
    walk(g.arcs, (a) => { if (uses.get(a < 0 ? ~a : a) === 1) coastal = true; });
    g.properties.coastal = coastal;
    for (const k of ["ru", "uk", "city", "res", "rv", "rail", "inc", "gr", "was"]) if (g.properties[k] == null || g.properties[k] === "") delete g.properties[k];
    delete g.properties.up;
    if (g.properties.res) g.properties.res = JSON.parse(g.properties.res);
    if (g.properties.rv) g.properties.rv = g.properties.rv.split("|");
    if (g.properties.at) g.properties.at = g.properties.at.split(",").map(Number);
  }
  shareResources(topo.objects.regions.geometries);
  for (const g of topo.objects.regions.geometries) delete g.properties.mined;

  topo.meta = {
    sources: [`${NE_REPO}@${NE_COMMIT} (public domain)`, `${HIST_REPO}@${HIST_COMMIT} world_${year}.geojson (GPL-3.0)`],
    license: "GPL-3.0",
    ...(fine ? { fine: `scripts/split.mjs; was: the province of world_${year}.json each lies in` } : {}),
  };
  const name = fine ? `world_${year}_fine.json` : `world_${year}.json`;
  const text = JSON.stringify(topo);
  await writeFile(path.join(OUT, name), text);
  const split = topo.objects.regions.geometries.filter((g) => /-p\d+$/.test(g.properties.id)).length;
  console.log(`${name}  ${topo.objects.regions.geometries.length} provinces (${split} split parts)  ${(text.length / 1024).toFixed(0)} KB`);
}

/**
 * On the finer map, each province records the province of the standard map
 * it lies in (`was`, where the id differs): a point well inside it, looked
 * up in that era's world_<year>.json. Saves and scenario data written for
 * the standard map find their provinces through it (engine/refine.ts).
 */
function attachCoarse(features, year) {
  const coarse = JSON.parse(readFileSync(path.join(OUT, `world_${year}.json`), "utf8"));
  const regions = topoFeature(coarse, coarse.objects.regions).features;
  const find = locator(regions, 0.5);
  const ids = new Set(regions.map((r) => r.properties.id));
  let moved = 0;
  for (const f of features) {
    // A province the standard map has by the same id is that province (an enclave like Daejeon has no hole in its neighbour to be found by).
    if (ids.has(f.properties.id)) continue;
    const i = find(innerPoint(f.geometry));
    // An islet the standard map's outline left out lies in its division's province.
    const up = f.properties.up;
    const was = i >= 0 ? regions[i].properties.id : up && ids.has(up) ? up : null;
    if (was && was !== f.properties.id) {
      f.properties.was = was;
      moved += 1;
    }
  }
  // A standard province no finer one's inner point fell in (a sliver cut by a historical border) takes the finer province
  // holding its own inner point, where that one's standard province keeps other parts: every standard id stays resolvable.
  const coarseOf = (f) => f.properties.was ?? f.properties.id;
  const count = new Map();
  for (const f of features) count.set(coarseOf(f), (count.get(coarseOf(f)) ?? 0) + 1);
  const fineFind = locator(features, 0.5);
  const lost = [];
  for (const r of regions) {
    if (count.has(r.properties.id)) continue;
    const i = fineFind(innerPoint(r.geometry));
    const f = i >= 0 ? features[i] : null;
    if (!f || ids.has(f.properties.id) || (count.get(coarseOf(f)) ?? 0) < 2) {
      lost.push(r.properties.id);
      continue;
    }
    count.set(coarseOf(f), count.get(coarseOf(f)) - 1);
    f.properties.was = r.properties.id;
    count.set(r.properties.id, 1);
    log(`${year}: ${f.properties.id} stands for ${r.properties.id}, which no finer province lay in`);
  }
  log(`${year}: ${moved} finer provinces lie in a standard province of another id; standard provinces with no finer one: ${lost.length ? lost.join(", ") : "none"}`);
}

// `npm run maps -- --era 1994` builds one era's map and nothing else;
// `npm run maps -- --fine 1994` builds that era's finer prototype,
// world_1994_fine.json (scripts/split.mjs), from its standard map.
const args = process.argv.slice(2);
const flag = (name) => (args.includes(name) ? Number(args[args.indexOf(name) + 1]) : null);
const fineYear = flag("--fine");
const only = fineYear ?? flag("--era");
if (only !== null && !YEARS.includes(only)) throw new Error(`--era, --fine: one of ${YEARS.join(", ")}`);

await mkdir(CACHE, { recursive: true });
await mkdir(OUT, { recursive: true });
const allPlaces = await neFile("ne_10m_populated_places");
const countries = new Map(
  (await neFile("ne_50m_admin_0_countries")).features.map((f) => [
    f.properties.ADM0_A3,
    { pop: f.properties.POP_EST, region: f.properties.REGION_UN, income: f.properties.POP_EST > 0 ? (f.properties.GDP_MD * 1e6) / f.properties.POP_EST : 0 },
  ]),
);
const provinces = await buildProvinces({ fine: fineYear === null ? null : { allPlaces, countries } });
const railroads = await neFile("ne_10m_railroads");
const context = { allPlaces, countries, rails: railSegments(railroads) };
log("places, countries and railways");
for (const year of only === null ? YEARS : [only]) await buildEra(year, provinces, context, { fine: fineYear !== null });
if (only === null) {
  await buildWater();
  await buildTransport(railroads);
  await buildTowns(await buildCities(allPlaces));
}

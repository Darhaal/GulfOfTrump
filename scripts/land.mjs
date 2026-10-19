/** Fertility of a sample point by the land it lies in; dry land keeps a little over half of it. */
const POINT_FERTILITY = { river: 80, desert: 5, tundra: 5, mountains: 20, wetlands: 30, jungle: 40, forest: 40, hills: 45, plains: 65 };
const DRY = 0.55;
/** Sample points per province, on a grid over its bounding box. */
const SAMPLES = 144;
/** How far from a great river dry land counts as watered, in degrees. */
const RIVER_REACH = 0.12;

/**
 * Natural Earth names some regions by a class that misleads at this scale:
 * the Appalachians are old, low hills; the Western Plateau is Australia's
 * desert interior; the Amazon and Congo basins are rainforest, not river
 * plains; the Great Artesian Basin and the Sahel are dry. The Punjab is filed
 * as a desert, though it is the irrigated land of five rivers; the Canadian
 * Shield as tundra, though most of it is boreal forest (the Barren Grounds
 * are the tundra). The Great Rift Valley is a rift, not a river valley: it
 * runs from the Afar desert to Kenya's highlands. The Atlas outline takes in
 * the coastal plains of the Maghreb; its named ranges stay mountains.
 */
const REGION_KIND = {
  "APPALACHIAN MTS.": "hills",
  "GREAT DIVIDING RANGE": "hills",
  "ATLAS MOUNTAINS": "hills",
  "GREAT RIFT VALLEY": "lowland",
  "PLATEAU OF TIBET": "mountains",
  "WESTERN PLATEAU": "desert",
  "GREAT BASIN": "desert",
  "TARIM BASIN": "desert",
  "Qaidam Basin": "desert",
  "Ustyurt Plateau": "desert",
  "Junggar Basin": "dry",
  "GREAT ARTESIAN BASIN": "dry",
  "SAHEL": "dry",
  "KAZAKH STEPPE": "dry",
  "KAZAKH UPLAND": "dry",
  "MONGOLIAN PLATEAU": "dry",
  "TURAN LOWLAND": "dry",
  "CASPIAN DEPRESSION": "dry",
  "NULLARBOR PLAIN": "dry",
  "Great Karroo": "dry",
  "Northern Karroo": "dry",
  "CAATINGAS": "dry",
  "AMAZON BASIN": "jungle",
  "CONGO BASIN": "jungle",
  "GUIANA SHIELD": "jungle",
  "SELVAS": "jungle",
  "CANADIAN SHIELD": "forest",
  "NORTH SLOPE": "tundra",
  "NORTH SIBERIAN LOWLAND": "tundra",
  "KOLYMA LOWLAND": "tundra",
  "MURRAY-DARLING BASIN": "river",
  "SICHUAN BASIN": "river",
  "PUNJAB": "river",
};

/**
 * Natural Earth's Sahara and Libyan Desert reach past the desert's edge: into
 * the Sahel as far as Gezira and Darfur, and over Cyrenaica's Green Mountain.
 * There they make the land dry, not desert: south of 16°N where the Sahel
 * overlaps them, and wherever a mountain range does.
 */
const BROAD_DESERTS = new Set(["SAHARA", "LIBYAN DESERT"]);
const SAHEL_EDGE = 16;

/** Alluvial plains that rivers water, which Natural Earth leaves unnamed; they count as river valleys. */
const IRRIGATED = [
  ["Mesopotamian alluvium", [[43.7, 34.3], [44.8, 34.1], [45.5, 33.6], [46.3, 32.9], [47.5, 32.1], [47.9, 31.3], [48.6, 30.5], [48.6, 29.9], [47.8, 29.9], [46.6, 30.4], [45.6, 30.9], [44.7, 31.5], [44.0, 32.3], [43.6, 33.2]]],
  ["Indus plain", [[70.5, 31.6], [70.2, 30.5], [69.8, 29.3], [69.0, 28.6], [68.2, 28.4], [67.8, 27.8], [67.7, 27.0], [67.9, 26.2], [67.8, 25.2], [67.5, 24.4], [68.4, 23.9], [68.9, 24.6], [69.3, 25.2], [69.4, 26.2], [69.4, 27.2], [70.3, 28.2], [71.5, 29.0], [72.6, 29.9], [73.3, 30.6], [74.2, 31.0], [72.5, 31.9], [71.5, 31.8]]],
];

/**
 * Climate where no region decides it. Natural Earth names the great deserts
 * but not the dry lands around them, so Sinai, Arabia, the Iranian plateau
 * and the Horn of Africa would otherwise read as green plains. The first zone
 * that holds a point decides: a desert zone makes open land desert and
 * mountains dry; a dry zone makes the land dry; a savanna zone only keeps the
 * rainforest out. Outside every zone the latitude decides.
 */
const CLIMATE = [
  ["Sinai", "desert", [[32.35, 31.25], [34.25, 31.32], [34.9, 29.5], [34.4, 28.0], [34.2, 27.7], [33.5, 28.2], [32.6, 29.9], [32.35, 30.6]]],
  ["Arabian Peninsula", "desert", [[35.0, 29.4], [35.4, 30.0], [35.9, 30.6], [36.2, 31.2], [36.3, 31.8], [36.6, 32.3], [37.3, 32.6], [38.8, 33.4], [41.0, 32.0], [44.0, 30.5], [46.5, 29.1], [47.2, 30.0], [48.0, 30.0], [48.2, 29.4], [48.4, 28.5], [49.6, 27.0], [50.2, 26.3], [50.8, 26.3], [51.6, 26.2], [51.7, 25.0], [52.2, 24.2], [54.5, 24.6], [55.6, 25.6], [56.1, 26.3], [56.5, 26.3], [56.5, 25.0], [57.5, 23.9], [58.8, 23.6], [59.9, 22.5], [58.8, 20.5], [57.8, 19.0], [56.0, 17.9], [55.0, 17.0], [52.3, 16.1], [49.0, 14.6], [48.0, 14.0], [46.5, 13.4], [45.5, 14.2], [45.1, 15.0], [44.9, 16.0], [44.6, 17.0], [44.0, 17.5], [43.3, 17.5], [42.8, 16.6], [42.6, 16.4], [41.8, 17.8], [40.6, 19.6], [39.2, 21.4], [38.6, 22.6], [37.5, 24.6], [36.5, 26.0], [35.2, 28.0], [34.8, 28.4]]],
  ["Iranian deserts and Balochistan", "desert", [[50.8, 35.0], [52.5, 35.2], [54.5, 35.6], [56.5, 35.4], [58.0, 35.0], [59.5, 34.0], [60.6, 33.5], [61.0, 32.0], [62.0, 32.8], [63.5, 32.4], [65.0, 32.0], [66.0, 31.6], [66.6, 31.0], [67.5, 30.5], [68.2, 30.2], [69.3, 31.3], [70.1, 30.6], [69.8, 29.4], [69.0, 28.6], [68.2, 28.4], [67.8, 27.8], [67.7, 27.0], [67.9, 26.2], [67.8, 25.2], [67.4, 24.8], [66.6, 25.4], [64.5, 25.2], [61.6, 25.2], [59.5, 25.4], [58.0, 25.6], [57.3, 25.9], [57.0, 27.0], [56.2, 27.4], [55.6, 28.6], [55.0, 29.6], [54.3, 30.6], [53.6, 31.6], [52.6, 32.6], [51.9, 33.6], [51.3, 34.4]]],
  ["Caspian deserts", "desert", [[50.5, 44.8], [52.5, 45.6], [55.0, 46.0], [58.0, 45.8], [59.5, 44.0], [58.8, 42.0], [57.5, 41.3], [57.2, 39.6], [56.0, 38.8], [54.8, 38.2], [53.8, 37.4], [53.0, 37.6], [52.8, 39.6], [52.6, 41.5], [51.0, 42.8], [50.2, 44.4]]],
  ["Gulf of Sidra", "desert", [[14.3, 31.2], [14.6, 32.3], [15.5, 31.4], [16.6, 31.3], [18.2, 30.8], [19.4, 30.4], [20.1, 30.9], [20.2, 31.4], [20.6, 31.0], [20.6, 29.5], [18.0, 29.5], [15.0, 30.0]]],
  ["Peruvian coast", "desert", [[-81.4, -4.2], [-80.4, -3.4], [-79.9, -4.6], [-79.4, -6.0], [-78.6, -7.9], [-77.6, -9.9], [-76.6, -11.8], [-75.8, -13.4], [-74.8, -15.0], [-72.6, -16.3], [-71.2, -17.2], [-70.3, -18.4], [-70.6, -18.9], [-71.8, -17.6], [-73.6, -16.4], [-75.8, -15.0], [-76.6, -13.8], [-77.6, -12.0], [-78.4, -10.4], [-79.4, -8.4], [-80.0, -7.2], [-81.3, -6.0], [-81.3, -5.0]]],
  ["Iranian plateau and Afghanistan", "dry", [[44.3, 39.4], [46.0, 39.0], [47.5, 39.3], [48.3, 39.4], [48.4, 38.6], [48.5, 38.0], [49.0, 37.0], [50.0, 36.4], [51.5, 36.0], [53.0, 36.0], [54.2, 36.4], [55.0, 37.0], [56.0, 37.4], [57.5, 37.9], [59.0, 37.6], [60.5, 36.9], [61.2, 36.6], [62.5, 35.8], [64.0, 36.4], [65.5, 37.2], [66.6, 37.4], [67.8, 37.2], [69.4, 37.2], [70.6, 37.6], [71.6, 37.0], [71.4, 36.0], [71.6, 35.0], [71.0, 34.0], [70.0, 33.6], [69.8, 32.6], [69.3, 31.3], [69.0, 29.0], [67.0, 25.0], [57.0, 25.0], [56.0, 27.0], [54.0, 26.5], [52.0, 27.5], [50.6, 29.3], [50.5, 31.0], [49.8, 32.5], [49.0, 33.5], [48.0, 35.0], [47.0, 36.4], [45.6, 37.0], [44.8, 37.4], [44.3, 38.4]]],
  ["Mesopotamia and the Jazira", "dry", [[38.5, 36.0], [40.5, 36.8], [42.3, 37.1], [43.2, 36.6], [44.0, 35.8], [45.0, 35.0], [45.8, 34.2], [46.4, 33.2], [47.6, 32.4], [48.6, 32.8], [49.8, 32.5], [50.5, 31.0], [50.6, 29.3], [49.0, 30.0], [48.0, 29.6], [47.0, 29.0], [44.5, 29.2], [41.5, 31.5], [39.0, 32.5], [38.5, 34.0]]],
  ["Kazakh drylands", "dry", [[46.8, 48.0], [50.0, 49.5], [54.0, 50.0], [58.0, 50.6], [61.5, 50.6], [66.0, 50.0], [71.0, 49.5], [76.0, 48.8], [80.0, 48.5], [82.5, 47.5], [82.0, 45.5], [80.5, 44.8], [79.0, 44.0], [76.0, 44.2], [73.0, 43.6], [70.0, 43.0], [67.0, 43.5], [61.0, 44.5], [58.0, 45.8], [55.0, 46.0], [52.5, 45.6], [50.5, 44.8], [47.0, 45.5]]],
  ["Inner Asia", "dry", [[82.5, 47.5], [85.5, 49.0], [87.8, 49.2], [90.0, 50.4], [92.5, 50.8], [95.0, 50.0], [98.0, 51.0], [99.5, 51.6], [102.0, 51.2], [105.0, 50.4], [107.5, 49.8], [110.0, 49.4], [114.0, 50.0], [116.5, 49.8], [119.0, 49.6], [121.0, 47.5], [121.5, 45.5], [123.0, 44.5], [122.0, 43.0], [119.5, 42.0], [117.0, 41.5], [114.0, 41.0], [111.0, 40.6], [110.5, 39.0], [107.5, 37.5], [105.5, 36.0], [104.0, 36.0], [102.5, 37.0], [100.0, 38.6], [98.0, 39.5], [95.0, 40.0], [92.0, 42.5], [89.0, 43.2], [86.0, 44.0], [83.0, 44.5], [82.0, 45.5]]],
  ["Horn of Africa", "dry", [[39.6, 14.6], [41.6, 13.4], [43.3, 12.6], [44.5, 10.5], [47.0, 11.2], [51.4, 12.0], [51.4, 10.4], [50.6, 9.0], [49.2, 6.0], [47.8, 4.2], [46.0, 2.2], [43.6, 0.0], [41.8, -1.8], [40.4, -2.6], [39.8, -1.2], [38.4, -0.2], [37.4, 0.6], [36.4, 1.2], [35.6, 1.6], [34.6, 3.6], [35.6, 4.8], [37.0, 4.4], [38.6, 4.0], [39.8, 4.0], [41.0, 4.4], [42.4, 5.4], [42.6, 8.2], [41.8, 9.2], [40.6, 9.4], [40.0, 10.4], [39.8, 12.0], [39.6, 13.6]]],
  ["Patagonia and the Monte", "dry", [[-69.8, -26.5], [-66.6, -26.8], [-65.8, -28.5], [-66.0, -31.0], [-65.6, -33.0], [-66.0, -35.0], [-64.5, -37.0], [-63.0, -39.0], [-62.2, -40.6], [-64.0, -42.0], [-65.0, -44.0], [-67.0, -46.2], [-67.5, -49.0], [-68.4, -52.4], [-71.0, -52.2], [-72.2, -50.0], [-71.8, -46.5], [-71.6, -43.0], [-71.4, -40.0], [-70.8, -37.0], [-70.0, -33.0], [-69.8, -30.0]]],
  ["Sudanian savanna", "savanna", [[-18, 8], [15, 8], [15, 6.5], [41.5, 6.5], [41.5, 12], [-18, 12]]],
  ["Southern savanna", "savanna", [[11, -12], [29.5, -12], [29.5, -6.5], [11, -6.5]]],
  ["East African plateau", "savanna", [[29.5, -12], [41.5, -12], [41.5, 6.5], [29.5, 6.5]]],
  ["Indochina lowlands", "savanna", [[102, 8], [109.5, 8], [109.5, 12], [102, 12]]],
];

/** Kinds that say what grows on the land; a point with none of them takes its climate from the zones or the latitude. */
const CLIMATE_KINDS = ["river", "desert", "dry", "tundra", "wetlands", "jungle", "forest"];

/** Where the taiga begins: far south in the Russian Far East and around Baikal, where the climate is continental. */
const taigaLine = (x, y) => (y < 0 ? 57 : x >= 120 ? 49 : x >= 90 ? 52 : 57);

/**
 * The few provinces the samples still misread, set by hand: Cairo, whose
 * governorate reaches far into the Eastern Desert though the city lives on
 * the Nile; the Faiyum oasis, watered by a canal no river line shows;
 * Samarkand, the Zeravshan valley, which Natural Earth's Karakum outline
 * covers; California, whose Central Valley feeds the country while ranges
 * and deserts fill most of the map.
 */
const PROVINCE_LAND = {
  "eg-cairo": { terrain: "plains", fertility: 60 },
  "eg-faiyum": { terrain: "plains", fertility: 70 },
  "uz-samarqand": { terrain: "plains", fertility: 55 },
  "us-california": { fertility: 60 },
};

function classify(f) {
  const named = REGION_KIND[f.properties.NAME];
  if (named) return named;
  switch (f.properties.FEATURECLA) {
    case "Range/mtn": return "mountains";
    case "Desert": return "desert";
    case "Tundra": return "tundra";
    case "Wetlands": return "wetlands";
    case "Plateau":
    case "Foothills": return "hills";
    case "Delta":
    case "Valley": return "river";
    case "Plain":
    case "Lowland":
    case "Basin":
    case "Depression": return "lowland";
    default: return null;
  }
}

function pointFertility(kinds) {
  if (kinds.has("river")) return POINT_FERTILITY.river;
  const kind = ["desert", "tundra", "mountains", "wetlands", "jungle", "forest", "hills"].find((k) => kinds.has(k)) ?? "plains";
  return POINT_FERTILITY[kind] * (kinds.has("dry") ? DRY : 1);
}

/** A test for "within reach of a great river": river segments on a 1° grid. */
function riverReach(rivers) {
  const grid = new Map();
  for (const f of rivers?.features ?? []) {
    if (!f.geometry || f.properties.featurecla !== "River" || f.properties.scalerank > 7) continue;
    const lines = f.geometry.type === "LineString" ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const line of lines) {
      for (let k = 1; k < line.length; k += 1) {
        const a = line[k - 1], b = line[k];
        for (let gx = Math.floor(Math.min(a[0], b[0]) - RIVER_REACH); gx <= Math.floor(Math.max(a[0], b[0]) + RIVER_REACH); gx += 1) {
          for (let gy = Math.floor(Math.min(a[1], b[1]) - RIVER_REACH); gy <= Math.floor(Math.max(a[1], b[1]) + RIVER_REACH); gy += 1) {
            const key = `${gx},${gy}`;
            if (!grid.has(key)) grid.set(key, []);
            grid.get(key).push([a, b]);
          }
        }
      }
    }
  }
  return (x, y) => {
    const segments = grid.get(`${Math.floor(x)},${Math.floor(y)}`);
    if (!segments) return false;
    const c = Math.cos((y * Math.PI) / 180);
    for (const [a, b] of segments) {
      const ax = (a[0] - x) * c, ay = a[1] - y, bx = (b[0] - x) * c, by = b[1] - y;
      const dx = bx - ax, dy = by - ay;
      const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
      if (Math.hypot(ax + t * dx, ay + t * dy) <= RIVER_REACH) return true;
    }
    return false;
  };
}

/**
 * Terrain and fertility from points sampled on a grid inside the province.
 * Each point takes its land from Natural Earth's geography regions; where
 * none says what grows there, from the climate zones above, else from the
 * latitude (tundra in the far north, taiga below it, rainforest near the
 * equator, plains between). Desert and dry land within reach of a great
 * river is watered. The terrain is the land that holds enough of the points;
 * the fertility is the mean over the points, less a little for the cold.
 */
export function describeLand(provinces, regions, rivers, { bbox, contains, centroid }) {
  const area = (kind, geometry) => ({ kind, geometry, box: bbox(geometry) });
  const ring = (points) => ({ type: "Polygon", coordinates: [[...points, points[0]]] });
  const classes = regions.features
    .map((f) => {
      const kind = classify(f);
      return kind && f.geometry ? { ...area(kind, f.geometry), broad: BROAD_DESERTS.has(f.properties.NAME) } : null;
    })
    .filter(Boolean)
    .concat(IRRIGATED.map(([, points]) => area("river", ring(points))));
  const zones = CLIMATE.map(([, kind, points]) => area(kind, ring(points)));
  const inside = (a, x, y) => x >= a.box[0] && x <= a.box[2] && y >= a.box[1] && y <= a.box[3] && contains(a.geometry, [x, y]);
  const watered = riverReach(rivers);

  const land = (x, y) => {
    // A point can lie in several regions (a valley inside a range): count each kind once.
    const kinds = new Set();
    let broad = false;
    for (const c of classes) {
      if (!inside(c, x, y)) continue;
      if (c.broad) broad = true;
      else kinds.add(c.kind);
    }
    if (broad) kinds.add(kinds.has("mountains") || (kinds.has("dry") && y < SAHEL_EDGE) ? "dry" : "desert");
    if (!CLIMATE_KINDS.some((k) => kinds.has(k))) {
      const zone = zones.find((z) => inside(z, x, y));
      if (zone?.kind === "desert") kinds.add(kinds.has("mountains") ? "dry" : "desert");
      else if (zone?.kind === "dry") kinds.add("dry");
      else if (Math.abs(y) >= 66) kinds.add("tundra");
      else if (Math.abs(y) >= taigaLine(x, y)) kinds.add("forest");
      else if (Math.abs(y) < 12 && !zone && kinds.size === 0) kinds.add("jungle");
    }
    // Watered desert is a river valley, like the Nile's; watered dry land farms like the plains.
    if ((kinds.has("desert") || kinds.has("dry")) && watered(x, y)) {
      if (kinds.has("desert")) kinds.add("river");
      kinds.delete("dry");
    }
    if (kinds.has("river")) {
      kinds.delete("desert");
      kinds.delete("dry");
    }
    return kinds;
  };

  for (const province of provinces.features) {
    const g = province.geometry;
    if (!g) continue;
    const [x0, y0, x1, y1] = bbox(g);
    const step = Math.max(0.03, Math.sqrt(((x1 - x0) * (y1 - y0)) / SAMPLES));
    const counts = {};
    let samples = 0, total = 0;
    const take = (x, y) => {
      const kinds = land(x, y);
      for (const k of kinds) counts[k] = (counts[k] ?? 0) + 1;
      total += pointFertility(kinds);
      samples += 1;
    };
    for (let x = x0 + step / 2; x < x1; x += step) {
      for (let y = y0 + step / 2; y < y1; y += step) if (contains(g, [x, y])) take(x, y);
    }
    // An islet the grid misses is read at its centre.
    const [cx, cy] = centroid(g);
    if (!samples) take(cx, cy);
    const share = (k) => (counts[k] ?? 0) / samples;

    let terrain;
    if (share("desert") >= 0.35) terrain = "desert";
    else if (share("mountains") >= 0.35 && share("mountains") > share("lowland")) terrain = "mountains";
    else if (share("tundra") >= 0.4) terrain = "tundra";
    else if (share("wetlands") >= 0.4) terrain = "wetlands";
    else if (share("jungle") >= 0.4) terrain = "jungle";
    else if (share("forest") >= 0.5) terrain = "forest";
    else if (share("hills") >= 0.4) terrain = "hills";
    else terrain = "plains";

    let fertility = total / samples;
    if (Math.abs(cy) > 55) fertility -= 10;
    const fixed = PROVINCE_LAND[province.properties.pid];
    province.properties.terrain = fixed?.terrain ?? terrain;
    province.properties.fertility = fixed?.fertility ?? Math.round(Math.max(0, Math.min(100, fertility)));
  }
}

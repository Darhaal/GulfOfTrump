import { yearOf } from "./calendar";
import type { ArmsOrder, ArmsStock, ArmsType, GameState, MapRegion, ScenarioId, WeaponKind } from "./types";

/**
 * Armed forces by type. Aircraft, ships and tanks are each counted by the
 * types that do different jobs:
 *
 * - fighters fight for the air against the enemy's fighters and air defence
 *   (the fronts' mobility, engine/fronts.ts); attack planes and tactical
 *   bombers add most at the front; strategic bombers strike the enemy's
 *   economy and industry (a small, bounded toll); transports carry troops
 *   and supplies by air;
 * - capital ships and carriers, with the escorts, hold the sea and blockade;
 *   submarines raid the enemy's trade; landing ships and transports carry an
 *   army across a sea and keep it supplied (engine/warMeans.ts);
 * - light, medium, heavy and main battle tanks weigh differently in a
 *   breakthrough; infantry fighting vehicles carry the infantry with them.
 *
 * The start counts of the day (engine/arsenal.ts ARMS_SEEDS) are of the
 * combat types: combat aircraft, major warships and submarines, tanks. The
 * support types – transport aircraft, landing ships, infantry fighting
 * vehicles – come on top of them, at the era's ratio. A start splits each
 * count by the era's mix, adjusted for the size of the force (a small navy
 * has no capital ships, a small air force no strategic bombers, a poor army
 * fewer fighting vehicles), and by the great powers' own orders of
 * magnitude where they differed. Industry builds by the era's mix too, and
 * serves the player's orders for a type first.
 *
 * The weights are scaled so that a force of the era's own mix weighs what
 * the kind weighed before it was split: only a force that differs from the
 * mix – a fleet of submarines, an air force of bombers – fights differently.
 */

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** The year each technology level of a kind came into service; a kind exists from its first. */
export const LEVEL_YEARS: Record<WeaponKind, number[]> = {
  // Bolt-action rifles; self-loaders and sub-machine guns; assault rifles; their second generation; optics and night sights; modern kits.
  rifles: [0, 1940, 1947, 1960, 1990, 2010],
  // Horse-drawn guns; motorised; rocket launchers; self-propelled; counter-battery radar and MLRS; guided shells.
  artillery: [0, 1925, 1943, 1960, 1980, 2005],
  // The first tanks (1916); interwar; the Panther and the T-34/85; the first main battle tanks; the M1, Leopard 2 and T-80; active protection.
  tanks: [1916, 1930, 1943, 1955, 1979, 2010],
  // Biplanes; fast monoplanes; jets; supersonic; the fourth generation; the fifth.
  aircraft: [1911, 1930, 1944, 1955, 1975, 2005],
  // Dreadnoughts; fast battleships and carriers; radar fleets; missiles and nuclear submarines; Aegis; today's.
  ships: [0, 1935, 1944, 1960, 1980, 2010],
  // Anti-aircraft guns; with predictors; radar-laid; missiles; the S-300 and Patriot; the S-400 and after.
  airDefence: [1915, 1935, 1944, 1957, 1980, 2007],
  // Reconnaissance drones (the Scout over Lebanon, 1982); armed (2001); cheap long-range; mass loitering munitions.
  drones: [1982, 2001, 2010, 2020],
};

export const maxLevel = (kind: WeaponKind) => LEVEL_YEARS[kind].length;

/** The level history has reached for a kind in a year; 0 before the kind exists. */
export function baseLevel(kind: WeaponKind, year: number): number {
  return LEVEL_YEARS[kind].filter((y) => y <= year).length;
}

export const KIND_TYPES = {
  tanks: ["light", "medium", "heavy", "mbt", "ifv"],
  aircraft: ["fighter", "attack", "bomber", "transport"],
  ships: ["capital", "escort", "submarine", "landing"],
} as const satisfies Partial<Record<WeaponKind, readonly ArmsType[]>>;

export type TypedKind = keyof typeof KIND_TYPES;
export const TYPED_KINDS = Object.keys(KIND_TYPES) as TypedKind[];
export const isTyped = (kind: WeaponKind): kind is TypedKind => kind in KIND_TYPES;

/** The type of each kind that serves the rest: counted on top of the combat types. */
export const SUPPORT: Record<TypedKind, ArmsType> = { tanks: "ifv", aircraft: "transport", ships: "landing" };
const COMBAT: Record<TypedKind, ArmsType[]> = { tanks: ["light", "medium", "heavy", "mbt"], aircraft: ["fighter", "attack", "bomber"], ships: ["capital", "escort", "submarine"] };

export const TYPE_KIND = Object.fromEntries(TYPED_KINDS.flatMap((k) => KIND_TYPES[k].map((t) => [t, k]))) as Record<ArmsType, TypedKind>;

/**
 * What each type is: the years it is built, its cost against the kind's
 * average unit, its weight at the front (combat types against the era's
 * mix, support types against the kind's average), how exposed it is in the
 * fighting, and what it adds to a breakthrough, to the fight for the air
 * and to command of the sea.
 */
interface TypeInfo {
  from: number;
  until?: number;
  cost: number;
  weight: number;
  exposure: number;
  armour?: number;
  air?: number;
  sea?: number;
}

const INFO: Record<ArmsType, TypeInfo> = {
  fighter: { from: 1915, cost: 1, weight: 1, exposure: 1, air: 1 },
  attack: { from: 1911, cost: 1, weight: 1.3, exposure: 1.4, air: 0.35 },
  bomber: { from: 1914, cost: 3, weight: 0.6, exposure: 0.6, air: 0.1 },
  transport: { from: 1920, cost: 0.8, weight: 0.05, exposure: 0.3 },
  capital: { from: 0, cost: 4, weight: 0, exposure: 0.7, sea: 3 },
  escort: { from: 0, cost: 0.6, weight: 0, exposure: 1, sea: 1 },
  submarine: { from: 1900, cost: 1, weight: 0, exposure: 1.2, sea: 0.6 },
  landing: { from: 0, cost: 0.4, weight: 0, exposure: 1.3 },
  light: { from: 1916, cost: 0.6, weight: 0.6, exposure: 1.2, armour: 0.5 },
  medium: { from: 1917, until: 1980, cost: 1, weight: 1, exposure: 1, armour: 1 },
  heavy: { from: 1916, until: 1975, cost: 1.6, weight: 1.4, exposure: 0.8, armour: 1.25 },
  mbt: { from: 1960, cost: 1.2, weight: 1.3, exposure: 0.9, armour: 1.3 },
  ifv: { from: 1966, cost: 0.35, weight: 0.3, exposure: 1.3, armour: 0.25 },
};

/** Whether a type is built in a year. */
export const typeBuilt = (type: ArmsType, year: number) => year >= INFO[type].from && (INFO[type].until === undefined || year < INFO[type].until!);

/**
 * The era's mix of each kind: the combat types' shares of the count, then
 * the support type per combat unit. Straight lines between the years.
 */
const ERA: Record<TypedKind, [number, ...number[]][]> = {
  // light, medium, heavy, main battle; fighting vehicles per tank.
  tanks: [
    [1916, 0.3, 0.1, 0.6, 0, 0],
    [1925, 0.55, 0.3, 0.15, 0, 0],
    [1939, 0.5, 0.42, 0.08, 0, 0],
    [1945, 0.2, 0.65, 0.15, 0, 0],
    [1955, 0.15, 0.65, 0.2, 0, 0],
    [1965, 0.1, 0.3, 0.08, 0.52, 0.05],
    [1975, 0.08, 0.05, 0, 0.87, 0.35],
    [1991, 0.05, 0, 0, 0.95, 0.5],
    [2010, 0.04, 0, 0, 0.96, 0.9],
    [2022, 0.04, 0, 0, 0.96, 1.1],
  ],
  // fighters, attack and tactical bombers, strategic bombers; transports per combat aircraft.
  aircraft: [
    [1911, 0, 1, 0, 0],
    [1916, 0.35, 0.6, 0.05, 0],
    [1925, 0.4, 0.48, 0.12, 0.03],
    [1939, 0.45, 0.4, 0.15, 0.1],
    [1945, 0.5, 0.32, 0.18, 0.2],
    [1950, 0.55, 0.3, 0.15, 0.2],
    [1964, 0.58, 0.3, 0.12, 0.25],
    [1991, 0.6, 0.35, 0.05, 0.2],
    [2022, 0.65, 0.32, 0.03, 0.2],
  ],
  // capital ships and carriers, escorts, submarines; landing ships and transports per warship.
  ships: [
    [1900, 0.4, 0.5, 0.1, 0.02],
    [1914, 0.35, 0.5, 0.15, 0.02],
    [1939, 0.2, 0.55, 0.25, 0.05],
    [1945, 0.18, 0.5, 0.32, 0.4],
    [1950, 0.15, 0.55, 0.3, 0.25],
    [1964, 0.1, 0.55, 0.35, 0.2],
    [1991, 0.1, 0.55, 0.35, 0.15],
    [2022, 0.08, 0.62, 0.3, 0.15],
  ],
};

/** A mix: the combat types' shares (adding up to 1) and the support type per combat unit. */
export interface Mix {
  shares: Partial<Record<ArmsType, number>>;
  support: number;
}

function normalise(kind: TypedKind, raw: number[], year: number, support: number): Mix {
  const types = COMBAT[kind];
  const shares: Partial<Record<ArmsType, number>> = {};
  let sum = 0;
  types.forEach((t, i) => {
    const v = typeBuilt(t, year) ? Math.max(0, raw[i] ?? 0) : 0;
    if (v > 0) {
      shares[t] = v;
      sum += v;
    }
  });
  if (sum <= 0) {
    // Nothing of the mix is built yet (or any more): the type of the day nearest it.
    const t = types.find((x) => typeBuilt(x, year)) ?? types[0];
    return { shares: { [t]: 1 }, support: typeBuilt(SUPPORT[kind], year) ? support : 0 };
  }
  for (const t of Object.keys(shares) as ArmsType[]) shares[t] = shares[t]! / sum;
  return { shares, support: typeBuilt(SUPPORT[kind], year) ? Math.max(0, support) : 0 };
}

const mixes = new Map<string, Mix>();

/** The era's mix of a kind in a year. */
export function eraMix(kind: TypedKind, year: number): Mix {
  const key = `${kind}:${Math.floor(year)}`;
  const known = mixes.get(key);
  if (known) return known;
  const rows = ERA[kind];
  let row = rows[rows.length - 1].slice(1);
  if (year <= rows[0][0]) row = rows[0].slice(1);
  else
    for (let i = 1; i < rows.length; i++) {
      if (year > rows[i][0]) continue;
      const [y0, ...a] = rows[i - 1];
      const [y1, ...b] = rows[i];
      const k = (year - y0) / (y1 - y0);
      row = a.map((v, j) => v + (b[j] - v) * k);
      break;
    }
  const n = COMBAT[kind].length;
  const mix = normalise(kind, row.slice(0, n), Math.floor(year), row[n]);
  mixes.set(key, mix);
  return mix;
}

/**
 * The great powers' own mixes on each start date, where they differed from
 * the era's: combat shares in the order of the era table, then the support
 * type per combat unit. Orders of magnitude from the same sources as the
 * counts (engine/arsenal.ts): Jane's and the naval lists for the fleets, the
 * air forces' orders of battle, the IISS Military Balance from 1950 on.
 */
type Override = Partial<Record<TypedKind, number[]>>;
const OVERRIDES: Partial<Record<ScenarioId, Record<string, Override>>> = {
  "1914": {
    uk: { ships: [0.35, 0.5, 0.15, 0.02] },
    germany: { ships: [0.3, 0.55, 0.15, 0.01] },
    russia: { ships: [0.2, 0.6, 0.2, 0.02] },
  },
  "1939": {
    // The Luftwaffe's bombers flew for the army; most of the Kriegsmarine's ships were U-boats.
    germany: { aircraft: [0.35, 0.5, 0.15, 0.15], ships: [0.1, 0.3, 0.6, 0], tanks: [0.75, 0.25, 0, 0, 0] },
    uk: { aircraft: [0.4, 0.3, 0.3, 0.05], ships: [0.25, 0.57, 0.18, 0.02] },
    france: { ships: [0.2, 0.45, 0.35, 0.02], tanks: [0.6, 0.3, 0.1, 0, 0] },
    // The Red Army's tank park was light (T-26, BT); the fleet was mostly submarines.
    ussr: { aircraft: [0.45, 0.33, 0.22, 0.08], ships: [0.03, 0.2, 0.77, 0.02], tanks: [0.85, 0.12, 0.03, 0, 0] },
    italy: { ships: [0.15, 0.4, 0.45, 0.02], tanks: [0.9, 0.1, 0, 0, 0] },
    usa: { aircraft: [0.4, 0.35, 0.25, 0.1], ships: [0.17, 0.6, 0.23, 0.05] },
    japan: { aircraft: [0.45, 0.4, 0.15, 0.08], ships: [0.22, 0.55, 0.23, 0.08], tanks: [0.8, 0.2, 0, 0, 0] },
  },
  "1950": {
    usa: { aircraft: [0.5, 0.3, 0.2, 0.25], ships: [0.15, 0.55, 0.3, 0.35], tanks: [0.15, 0.75, 0.1, 0, 0] },
    // The Soviet fleet of 1950 was a coastal one: some three hundred submarines, few big ships, few landing ships.
    ussr: { aircraft: [0.55, 0.33, 0.12, 0.12], ships: [0.04, 0.26, 0.7, 0.06], tanks: [0.1, 0.75, 0.15, 0, 0] },
    uk: { aircraft: [0.5, 0.3, 0.2, 0.15], ships: [0.15, 0.6, 0.25, 0.2], tanks: [0.15, 0.7, 0.15, 0, 0] },
    france: { ships: [0.12, 0.65, 0.23, 0.15] },
    // The PLA's navy was gunboats and the landing ships taken from the Nationalists.
    china: { aircraft: [0.6, 0.4, 0, 0.1], ships: [0, 1, 0, 0.4], tanks: [0.2, 0.8, 0, 0, 0] },
    taiwan: { ships: [0, 0.9, 0.1, 0.5], aircraft: [0.5, 0.45, 0.05, 0.15] },
    "north-korea": { aircraft: [0.45, 0.55, 0, 0.05], ships: [0, 1, 0, 0.05], tanks: [0, 1, 0, 0, 0] },
  },
  "1964": {
    usa: { aircraft: [0.55, 0.35, 0.1, 0.3], ships: [0.12, 0.55, 0.33, 0.3], tanks: [0.1, 0.4, 0.05, 0.45, 0] },
    ussr: { aircraft: [0.6, 0.3, 0.1, 0.15], ships: [0.03, 0.3, 0.67, 0.08], tanks: [0.08, 0.5, 0.12, 0.3, 0.04] },
    china: { aircraft: [0.75, 0.22, 0.03, 0.08], ships: [0, 0.85, 0.15, 0.3], tanks: [0.15, 0.85, 0, 0, 0] },
    uk: { aircraft: [0.5, 0.38, 0.12, 0.15], ships: [0.08, 0.62, 0.3, 0.15] },
    "north-vietnam": { aircraft: [1, 0, 0, 0.1], ships: [0, 1, 0, 0] },
    "south-vietnam": { aircraft: [0.3, 0.7, 0, 0.25], ships: [0, 1, 0, 0.3] },
  },
  // Turkey's landing ships and craft, built up after the Cyprus crises of 1964 and 1967.
  "1973": {
    turkey: { ships: [0.05, 0.55, 0.4, 0.8] },
  },
  "1991": {
    ussr: { aircraft: [0.6, 0.35, 0.05, 0.15], ships: [0.07, 0.35, 0.58, 0.15], tanks: [0.03, 0, 0, 0.97, 0.5] },
    usa: { aircraft: [0.6, 0.35, 0.05, 0.25], ships: [0.15, 0.48, 0.37, 0.2], tanks: [0.02, 0, 0, 0.98, 0.45] },
    uk: { ships: [0.05, 0.62, 0.33, 0.15] },
    china: { aircraft: [0.7, 0.24, 0.06, 0.1], ships: [0.01, 0.69, 0.3, 0.2], tanks: [0.1, 0, 0, 0.9, 0.1] },
  },
  "1999": {
    russia: { aircraft: [0.6, 0.33, 0.07, 0.15], ships: [0.06, 0.39, 0.55, 0.15], tanks: [0.02, 0, 0, 0.98, 0.6] },
    usa: { aircraft: [0.6, 0.35, 0.05, 0.25], ships: [0.15, 0.47, 0.38, 0.2], tanks: [0.02, 0, 0, 0.98, 0.5] },
    china: { aircraft: [0.72, 0.22, 0.06, 0.1], ships: [0.01, 0.7, 0.29, 0.2], tanks: [0.1, 0, 0, 0.9, 0.15] },
  },
  "2014": {
    russia: { aircraft: [0.58, 0.32, 0.1, 0.15], ships: [0.06, 0.39, 0.55, 0.2], tanks: [0.02, 0, 0, 0.98, 1.3] },
    ukraine: { aircraft: [0.6, 0.4, 0, 0.1], ships: [0, 1, 0, 0.1], tanks: [0, 0, 0, 1, 1.3] },
    usa: { aircraft: [0.6, 0.35, 0.05, 0.3], ships: [0.16, 0.48, 0.36, 0.2], tanks: [0, 0, 0, 1, 1] },
    china: { aircraft: [0.68, 0.24, 0.08, 0.1], ships: [0.02, 0.7, 0.28, 0.2], tanks: [0.08, 0, 0, 0.92, 0.5] },
  },
  "2022": {
    russia: { aircraft: [0.58, 0.32, 0.1, 0.15], ships: [0.06, 0.39, 0.55, 0.2], tanks: [0.02, 0, 0, 0.98, 1.4] },
    ukraine: { aircraft: [0.6, 0.4, 0, 0.1], ships: [0, 1, 0, 0.1], tanks: [0, 0, 0, 1, 1.3] },
    usa: { aircraft: [0.6, 0.35, 0.05, 0.3], ships: [0.16, 0.48, 0.36, 0.2], tanks: [0, 0, 0, 1, 1] },
    china: { aircraft: [0.65, 0.27, 0.08, 0.1], ships: [0.02, 0.7, 0.28, 0.2], tanks: [0.08, 0, 0, 0.92, 0.7] },
    uk: { ships: [0.07, 0.6, 0.33, 0.2] },
    france: { ships: [0.04, 0.66, 0.3, 0.15] },
    turkey: { ships: [0, 0.76, 0.24, 0.2] },
  },
};

/** The smallest forces that have each type: fewer warships than this have no capital ships, and so on. */
const SMALLEST: Partial<Record<ArmsType, number>> = { capital: 25, submarine: 8, bomber: 250, heavy: 100 };
/** Where a small force's share of a type it does not have goes. */
const INSTEAD: Partial<Record<ArmsType, ArmsType>> = { capital: "escort", submarine: "escort", bomber: "attack", heavy: "medium" };

/** A country's mix of a kind on a start date: its own where known, else the era's adjusted for the size and wealth of the force. */
export function startMix(scenarioId: ScenarioId | undefined, tag: string, kind: TypedKind, combat: number, year: number, wealth = 1): Mix {
  const own = scenarioId ? OVERRIDES[scenarioId]?.[tag]?.[kind] : undefined;
  if (own) return normalise(kind, own.slice(0, COMBAT[kind].length), year, own[COMBAT[kind].length] ?? 0);
  const era = eraMix(kind, year);
  const shares = { ...era.shares };
  for (const [t, least] of Object.entries(SMALLEST) as [ArmsType, number][]) {
    if (TYPE_KIND[t] !== kind || !shares[t] || combat >= least) continue;
    const to = INSTEAD[t]!;
    shares[to] = (shares[to] ?? 0) + shares[t]!;
    delete shares[t];
  }
  return { shares, support: era.support * (wealth < 0.6 ? 0.5 : 1) };
}

/** Whole numbers that add up to `total`, as near the shares as can be (the largest remainders round up). */
function apportion(total: number, shares: Partial<Record<ArmsType, number>>): Partial<Record<ArmsType, number>> {
  const entries = (Object.entries(shares) as [ArmsType, number][]).filter(([, s]) => s > 0);
  const whole = Math.round(Math.max(0, total));
  const raw = entries.map(([t, s]) => [t, whole * s] as const);
  const out: Partial<Record<ArmsType, number>> = {};
  let left = whole;
  for (const [t, v] of raw) {
    out[t] = Math.floor(v);
    left -= out[t]!;
  }
  const order = [...raw].sort((a, b) => b[1] - Math.floor(b[1]) - (a[1] - Math.floor(a[1])) || a[0].localeCompare(b[0]));
  for (let i = 0; left > 0 && order.length; i = (i + 1) % order.length, left--) out[order[i][0]]! += 1;
  for (const t of Object.keys(out) as ArmsType[]) if (!out[t]) delete out[t];
  return out;
}

/** The types of a count of combat units split by a mix, with the support type on top. */
export function splitByMix(kind: TypedKind, combat: number, mix: Mix): Partial<Record<ArmsType, number>> {
  const out = apportion(combat, mix.shares);
  const support = Math.round(combat * mix.support);
  if (support > 0) out[SUPPORT[kind]] = support;
  return out;
}

const sumOf = (types: Partial<Record<ArmsType, number>>) => Object.values(types).reduce((s: number, v) => s + (v ?? 0), 0);

/**
 * The types of a stock: as counted, or – for a save from before them – its
 * count split by the era's combat mix, with no support types.
 */
export function typesOf(stock: ArmsStock | undefined, kind: TypedKind, year: number): Partial<Record<ArmsType, number>> {
  if (!stock?.n) return {};
  if (stock.types && Object.keys(stock.types).length) return stock.types;
  return apportion(stock.n, eraMix(kind, year).shares);
}

/** The count of one type in a country's arsenal. */
export function countOf(stock: Partial<Record<WeaponKind, ArmsStock>> | undefined, type: ArmsType, year: number): number {
  const kind = TYPE_KIND[type];
  return typesOf(stock?.[kind], kind, year)[type] ?? 0;
}

/** The weight of a mix's combat types against the plain count, by one of the types' measures. */
function mixNorm(kind: TypedKind, year: number, measure: (i: TypeInfo) => number): number {
  const mix = eraMix(kind, year);
  let norm = 0;
  for (const [t, s] of Object.entries(mix.shares) as [ArmsType, number][]) norm += s * measure(INFO[t]);
  return norm > 0 ? norm : 1;
}

/**
 * A stock counted by one of the types' measures: combat types against the
 * era's mix (so a force of the mix counts its plain number), support types
 * by their own measure.
 */
function measured(stock: ArmsStock | undefined, kind: TypedKind, year: number, measure: (i: TypeInfo) => number): number {
  if (!stock?.n) return 0;
  if (!stock.types || !Object.keys(stock.types).length) return stock.n;
  const norm = mixNorm(kind, year, measure);
  let v = 0;
  for (const [t, n] of Object.entries(stock.types) as [ArmsType, number][]) {
    if (!n) continue;
    v += t === SUPPORT[kind] ? n * measure(INFO[t]) : (n * measure(INFO[t])) / norm;
  }
  return v;
}

/** A kind's weight at the front, in its plain units: attack planes count for more than fighters, a heavy tank for more than a light one, a fighting vehicle for a third of a tank. */
export const combatUnits = (stock: ArmsStock | undefined, kind: TypedKind, year: number) => measured(stock, kind, year, (i) => i.weight);
/** Tanks as a breakthrough counts them. */
export const armourUnits = (stock: ArmsStock | undefined, year: number) => measured(stock, "tanks", year, (i) => i.armour ?? 0);
/** Aircraft as the fight for the air counts them: fighters above all. */
export const airUnits = (stock: ArmsStock | undefined, year: number) => measured(stock, "aircraft", year, (i) => i.air ?? 0);

/** One unit's weight against the day's level. */
const levelled = (stock: ArmsStock, kind: WeaponKind, year: number, base = 1.4) => base ** (stock.level - Math.max(1, baseLevel(kind, year)));

/** A country's command of the sea: capital ships and carriers most, escorts, and submarines that deny the sea, by their level. */
export function seaPower(state: Pick<GameState, "countries" | "date">, tag: string): number {
  const s = state.countries[tag]?.arsenal?.stock.ships;
  if (!s?.n) return 0;
  const year = yearOf(state.date);
  const t = typesOf(s, "ships", year);
  return ((t.capital ?? 0) * 3 + (t.escort ?? 0) + (t.submarine ?? 0) * 0.6) * levelled(s, "ships", year);
}

// --- The lift: what carries an army across a sea and keeps it there ---

/** Thousand soldiers a landing ship lands and keeps supplied a month close by; transport aircraft carry far fewer. */
const LIFT_SHIP = 1.5;
const AIRLIFT = 0.02;
/** The distances that halve what a ship and a transport aircraft carry a month: more days at sea or in the air for each trip. */
const LIFT_KM = 3000;
const AIR_KM = 1000;
/** What other warships carry: little on a hostile shore, more into a friendly port, with the merchant ships they guard. */
const WARSHIP_ASSAULT = 0.1;
const WARSHIP_PORT = 0.6;
/** Fishing boats, ferries and barges across a narrow strait: a share of the army a month, falling by e for every IMPROVISED_KM past the first STRAIT_FREE_KM of sea. */
const IMPROVISED = 0.03;
const IMPROVISED_KM = 40;
const STRAIT_FREE_KM = 20;
/** No more than this many thousand soldiers a month cross in boats alone. */
const IMPROVISED_MAX = 200;
/** Months of what its lift carries an army ashore can be: past it, the lift is spent keeping it supplied. */
export const LIFT_MONTHS = 3;

/**
 * Thousand soldiers a month a country's ships and transport aircraft carry
 * `km` across the sea and keep supplied: onto a hostile shore its landing
 * ships do it, into a friendly port its warships and the merchant ships
 * they guard help. Higher technology carries more.
 */
export function seaLift(state: Pick<GameState, "countries" | "date">, tag: string, km: number, port = false): number {
  const stock = state.countries[tag]?.arsenal?.stock;
  if (!stock) return 0;
  const year = yearOf(state.date);
  let lift = 0;
  if (stock.ships?.n) {
    const t = typesOf(stock.ships, "ships", year);
    const k = levelled(stock.ships, "ships", year, 1.25);
    lift += ((t.landing ?? 0) * LIFT_SHIP + ((t.capital ?? 0) + (t.escort ?? 0)) * (port ? WARSHIP_PORT : WARSHIP_ASSAULT)) * k / (1 + km / LIFT_KM);
  }
  if (stock.aircraft?.n) lift += ((countOf(stock, "transport", year) * AIRLIFT) * levelled(stock.aircraft, "aircraft", year, 1.25)) / (1 + km / AIR_KM);
  return lift;
}

/** What boats of every kind carry across a narrow strait a month: thousand soldiers. */
export function improvisedLift(troops: number, km: number): number {
  if (!(km < Infinity) || troops <= 0) return 0;
  return Math.min(IMPROVISED_MAX, IMPROVISED * troops * Math.exp(-Math.max(0, km - STRAIT_FREE_KM) / IMPROVISED_KM));
}

/** The force a landing needs, thousand soldiers: a fifth of the army, within bounds. */
export const landingNeed = (troops: number) => clamp(0.2 * troops, 30, 400);

/** A country's lift against the force a landing needs, 0.1–1: the war-plan decision's measure of a fleet that can carry an army over the sea (1,500 km). */
export function liftShare(state: Pick<GameState, "countries" | "date">, tag: string): number {
  const troops = state.countries[tag]?.economy?.troops ?? 0;
  if (troops <= 0) return 0.1;
  return Math.round(clamp((seaLift(state, tag, 1500) * LIFT_MONTHS) / landingNeed(troops), 0.1, 1) * 100) / 100;
}

// --- The war at sea and in the air beyond the fronts: raiders, blockades, strategic bombing ---

/** The most of its imports submarines can cut, and a fleet's blockade on top; and the most of both together. */
const RAID_MAX = 0.25;
const BLOCKADE_MAX = 0.2;
const CUT_MAX = 0.45;
/** A country that also trades by land with countries not at war with it depends on the sea for this much of its imports. */
const LAND_TRADE = 0.35;
/** The most of its output strategic bombing takes from a country a year, and of its arms industry. */
export const BOMB_MAX = 0.03;
const BOMB_INDUSTRY = 6;

/** Each country's enemies in wars being fought. */
function foesOf(state: Pick<GameState, "wars">): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const w of state.wars) {
    if (w.truce) continue;
    for (const [mine, theirs] of [
      [w.attackers, w.defenders],
      [w.defenders, w.attackers],
    ]) {
      for (const t of mine) {
        const set = out.get(t) ?? new Set<string>();
        theirs.forEach((x) => set.add(x));
        out.set(t, set);
      }
    }
  }
  return out;
}

/** Each country's friends in its wars being fought: its co-belligerents. */
function friendsOf(state: Pick<GameState, "wars">): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const w of state.wars) {
    if (w.truce) continue;
    for (const side of [w.attackers, w.defenders]) for (const t of side) side.forEach((x) => (out.get(t) ?? out.set(t, new Set()).get(t)!).add(x));
  }
  return out;
}

/**
 * The share of its imports each country at war loses to the enemy at sea:
 * its enemies' submarines against its own and its co-belligerents'
 * escorts, and a blockade by a fleet that commands the sea. A country that
 * also trades by land with countries not at war with it depends on the sea
 * for only part of its imports; a country with no coast is not touched.
 */
export function seaCuts(state: Pick<GameState, "countries" | "regions" | "wars" | "date">, map: Record<string, MapRegion> | null, neighbors?: Record<string, string[]> | null): Map<string, number> {
  const out = new Map<string, number>();
  const foes = foesOf(state);
  if (!foes.size) return out;
  const friends = friendsOf(state);
  const year = yearOf(state.date);
  const coastal = new Set<string>();
  const openBorder = new Set<string>();
  const gdp = (tag: string) => state.countries[tag]?.economy?.gdp ?? 0;
  for (const [id, r] of Object.entries(state.regions)) {
    if (map?.[id]?.coastal) coastal.add(r.controller);
    if (!foes.has(r.controller)) continue;
    for (const n of neighbors?.[id] ?? []) {
      const other = state.regions[n]?.controller;
      // A real partner by land: a neighbour not at war with it, with an economy of some size against its own.
      if (other && other !== r.controller && !foes.get(r.controller)?.has(other) && gdp(other) >= 0.3 * gdp(r.controller)) openBorder.add(r.controller);
    }
  }
  const subs = (tag: string) => {
    const s = state.countries[tag]?.arsenal?.stock.ships;
    return s?.n ? countOf(state.countries[tag]!.arsenal!.stock, "submarine", year) * levelled(s, "ships", year) : 0;
  };
  const escorts = (tag: string) => {
    const s = state.countries[tag]?.arsenal?.stock.ships;
    if (!s?.n) return 0;
    const t = typesOf(s, "ships", year);
    return ((t.escort ?? 0) + 0.5 * (t.capital ?? 0)) * levelled(s, "ships", year);
  };
  for (const [tag, enemies] of foes) {
    if (map && !coastal.has(tag)) continue;
    const side = friends.get(tag) ?? new Set([tag]);
    const raiders = [...enemies].reduce((s, e) => s + subs(e), 0);
    const guard = [...side].reduce((s, f) => s + escorts(f), 0);
    const theirSea = [...enemies].reduce((s, e) => s + seaPower(state, e), 0);
    const ourSea = [...side].reduce((s, f) => s + seaPower(state, f), 0);
    const raid = RAID_MAX * (raiders / (raiders + guard + 5));
    const command = theirSea + ourSea > 0 ? theirSea / (theirSea + ourSea) : 0;
    const blockade = BLOCKADE_MAX * clamp((command - 0.6) / 0.4, 0, 1);
    const cut = Math.min(CUT_MAX, (raid + blockade) * (neighbors && openBorder.has(tag) ? LAND_TRADE : 1));
    if (cut >= 0.01) out.set(tag, Math.round(cut * 100) / 100);
  }
  return out;
}

/**
 * The share of its output strategic bombing takes from each country at war
 * a year: its enemies' strategic bombers, by their level, against its
 * fighters and air defence, and against the size of the country (a
 * hundred bombers are nothing over a great power). Small and bounded:
 * BOMB_MAX a year at most.
 */
export function bombing(state: Pick<GameState, "countries" | "wars" | "date">, people?: Map<string, { people: number }>): Map<string, number> {
  const out = new Map<string, number>();
  const foes = foesOf(state);
  if (!foes.size) return out;
  const year = yearOf(state.date);
  const bombers = (tag: string) => {
    const s = state.countries[tag]?.arsenal?.stock;
    return s?.aircraft?.n ? countOf(s, "bomber", year) * levelled(s.aircraft, "aircraft", year, 1.6) : 0;
  };
  const shield = (tag: string) => {
    const s = state.countries[tag]?.arsenal?.stock;
    if (!s) return 0;
    const fighters = s.aircraft?.n ? countOf(s, "fighter", year) * levelled(s.aircraft, "aircraft", year, 1.6) : 0;
    const guns = s.airDefence?.n ? s.airDefence.n * 0.15 * 2 ** (s.airDefence.level - 2) : 0;
    return fighters + guns;
  };
  for (const [tag, enemies] of foes) {
    const b = [...enemies].reduce((s, e) => s + bombers(e), 0);
    if (b < 1) continue;
    // Millions of people: the country's own where known, else about fifty times its army.
    const size = Math.max(1, people?.get(tag)?.people ?? 50 * (state.countries[tag]?.economy?.troops ?? 0)) / 1000;
    const damage = BOMB_MAX * (b / (b + 0.5 * shield(tag) + 10)) * Math.min(1, b / (5 * size));
    if (damage >= 0.0005) out.set(tag, Math.round(damage * 10000) / 10000);
  }
  return out;
}

/** Import cuts from two causes (sanctions, the war at sea): the larger counts. */
export function mergeCuts(a: Map<string, number>, b: Map<string, number>): Map<string, number> {
  const out = new Map(a);
  for (const [tag, cut] of b) out.set(tag, Math.max(out.get(tag) ?? 0, cut));
  return out;
}

/** What strategic bombing leaves of a country's arms industry: the bombing's share of output, several times over, at most a fifth. */
export const industryLeft = (damage: number) => Math.max(0.8, 1 - BOMB_INDUSTRY * damage);

// --- Orders: what the player told industry to build ---

/** The most of the arms money the player's orders take first, the most orders kept, and how long one stands. */
export const ORDER_SHARE = 0.4;
export const MAX_ORDERS = 4;
export const ORDER_YEARS = 2;

/** The type or kind an order names, read from a word the game master wrote: a type, a kind, or a common name of one. */
export function orderTarget(word: string): ArmsType | WeaponKind | null {
  const w = word.trim().toLowerCase().replace(/[\s_-]+/g, "");
  const names: Record<string, ArmsType | WeaponKind> = {
    fighter: "fighter", fighters: "fighter",
    attack: "attack", attackaircraft: "attack", tacticalbomber: "attack", tacticalbombers: "attack", strikeaircraft: "attack",
    bomber: "bomber", bombers: "bomber", strategicbomber: "bomber", strategicbombers: "bomber",
    transport: "transport", transports: "transport", transportaircraft: "transport",
    capital: "capital", capitalships: "capital", carrier: "capital", carriers: "capital", battleship: "capital", battleships: "capital", cruiser: "capital", cruisers: "capital",
    escort: "escort", escorts: "escort", destroyer: "escort", destroyers: "escort", frigate: "escort", frigates: "escort", corvette: "escort", corvettes: "escort",
    submarine: "submarine", submarines: "submarine", sub: "submarine", subs: "submarine",
    landing: "landing", landingships: "landing", landingship: "landing", landingcraft: "landing", troopships: "landing", amphibious: "landing",
    light: "light", lighttanks: "light", medium: "medium", mediumtanks: "medium", heavy: "heavy", heavytanks: "heavy",
    mbt: "mbt", mainbattletanks: "mbt", mainbattletank: "mbt",
    ifv: "ifv", ifvs: "ifv", infantryfightingvehicles: "ifv", apc: "ifv", apcs: "ifv",
    rifles: "rifles", artillery: "artillery", guns: "artillery", tanks: "tanks", tank: "tanks", aircraft: "aircraft", planes: "aircraft",
    ships: "ships", warships: "ships", navy: "ships", airdefence: "airDefence", airdefense: "airDefence", sams: "airDefence", drones: "drones", drone: "drones",
  };
  return names[w] ?? null;
}

/** The kind an order's type belongs to. */
export const orderKind = (target: ArmsType | WeaponKind): WeaponKind => (target in TYPE_KIND ? TYPE_KIND[target as ArmsType] : (target as WeaponKind));

/** Orders still standing on a date: not filled, not lapsed. */
export const standingOrders = (orders: ArmsOrder[] | undefined, date: string): ArmsOrder[] =>
  (orders ?? []).filter((o) => o.built < o.n && Date.parse(date) - Date.parse(o.since) < ORDER_YEARS * 365.25 * 86400000);

/** Weights for the parts of a stock's types, for splitting a loss or a delivery: count times exposure. */
export function exposureOf(type: ArmsType): number {
  return INFO[type].exposure;
}

/** What one unit of a type costs against the kind's average unit of the era's mix. */
export function relativeCost(type: ArmsType, year: number): number {
  const kind = TYPE_KIND[type];
  if (type === SUPPORT[kind]) return INFO[type].cost;
  return INFO[type].cost / mixNorm(kind, year, (i) => i.cost);
}

/** A stock's types after a loss of `lost` units, split by how exposed each type is; returns the new types and what each lost. */
export function takeFromTypes(types: Partial<Record<ArmsType, number>>, lost: number): { types: Partial<Record<ArmsType, number>>; lost: Partial<Record<ArmsType, number>> } {
  const total = sumOf(types);
  if (lost <= 0 || total <= 0) return { types: { ...types }, lost: {} };
  if (lost >= total) return { types: {}, lost: { ...types } };
  const weights = (Object.entries(types) as [ArmsType, number][]).map(([t, n]) => [t, n * INFO[t].exposure] as const);
  const sum = weights.reduce((s, [, w]) => s + w, 0);
  const out: Partial<Record<ArmsType, number>> = {};
  const gone: Partial<Record<ArmsType, number>> = {};
  let left = lost;
  // Most exposed first, so a rounding never takes more of a type than it has.
  for (const [t, w] of [...weights].sort((a, b) => b[1] - a[1])) {
    const n = types[t] ?? 0;
    const take = Math.min(n, left, (lost * w) / sum);
    gone[t] = take;
    left -= take;
  }
  // What the shares could not take (a type ran out) comes from the rest, in proportion.
  if (left > 1e-9) {
    for (const [t] of weights) {
      const room = (types[t] ?? 0) - (gone[t] ?? 0);
      const take = Math.min(room, left);
      gone[t] = (gone[t] ?? 0) + take;
      left -= take;
      if (left <= 1e-9) break;
    }
  }
  for (const [t, n] of Object.entries(types) as [ArmsType, number][]) {
    const kept = n - (gone[t] ?? 0);
    if (kept > 1e-9) out[t] = kept;
  }
  return { types: out, lost: gone };
}

/**
 * A stock's types after a loss: first what the game master named by type
 * (scaled to the loss the engine kept, each within what the type has), the
 * rest by how exposed each type is.
 */
export function loseTypes(types: Partial<Record<ArmsType, number>>, lost: number, named?: Partial<Record<ArmsType, number>>): { types: Partial<Record<ArmsType, number>>; lost: Partial<Record<ArmsType, number>> } {
  const asked = named ? sumOf(named) : 0;
  if (!asked || lost <= 0) return takeFromTypes(types, lost);
  const k = Math.min(1, lost / asked);
  const left = { ...types };
  const gone: Partial<Record<ArmsType, number>> = {};
  let rest = lost;
  for (const [t, n] of Object.entries(named!) as [ArmsType, number][]) {
    const take = Math.min(left[t] ?? 0, n * k, rest);
    if (take <= 0) continue;
    gone[t] = take;
    left[t] = (left[t] ?? 0) - take;
    rest -= take;
  }
  const after = takeFromTypes(left, rest);
  return { types: after.types, lost: addTypes(gone, after.lost) };
}

/** Types rounded to whole units, adding up to the rounded total. */
export function roundTypes(types: Partial<Record<ArmsType, number>>): Partial<Record<ArmsType, number>> {
  const total = sumOf(types);
  if (total <= 0) return {};
  const shares = Object.fromEntries((Object.entries(types) as [ArmsType, number][]).map(([t, n]) => [t, n / total])) as Partial<Record<ArmsType, number>>;
  return apportion(total, shares);
}

/** Two sets of types added together. */
export function addTypes(a: Partial<Record<ArmsType, number>>, b: Partial<Record<ArmsType, number>>): Partial<Record<ArmsType, number>> {
  const out = { ...a };
  for (const [t, n] of Object.entries(b) as [ArmsType, number][]) if (n) out[t] = (out[t] ?? 0) + n;
  return out;
}

/** A set of types scaled to a new total, keeping their shares. */
export function scaleTypes(types: Partial<Record<ArmsType, number>>, total: number): Partial<Record<ArmsType, number>> {
  const sum = sumOf(types);
  if (sum <= 0 || total <= 0) return {};
  return Object.fromEntries((Object.entries(types) as [ArmsType, number][]).map(([t, n]) => [t, (n * total) / sum])) as Partial<Record<ArmsType, number>>;
}

export const typesTotal = sumOf;

/**
 * Types for a save from before them (save step 37): each country's aircraft,
 * ships and tanks split by its mix (the great powers' own on the save's
 * start date, else the era's at the save's date, adjusted for the size of
 * the force), with the support types – transport aircraft, landing ships,
 * fighting vehicles – added on top at the era's ratio, as a new game has
 * them.
 */
export function splitArsenals<T extends Pick<GameState, "countries" | "date"> & Partial<Pick<GameState, "scenarioId">>>(state: T): T {
  const year = yearOf(state.date);
  let countries: GameState["countries"] | null = null;
  for (const [tag, c] of Object.entries(state.countries)) {
    const stock = c.arsenal?.stock;
    if (!stock) continue;
    let next = stock;
    for (const kind of TYPED_KINDS) {
      const s = stock[kind];
      if (!s?.n || (s.types && Object.keys(s.types).length)) continue;
      const types = splitByMix(kind, s.n, startMix(state.scenarioId, tag, kind, s.n, year));
      next = { ...next, [kind]: { ...s, n: sumOf(types), types } };
    }
    if (next === stock) continue;
    countries ??= { ...state.countries };
    countries[tag] = { ...c, arsenal: { ...c.arsenal!, stock: next } };
  }
  return countries ? ({ ...state, countries } as T) : state;
}

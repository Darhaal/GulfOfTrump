import { z } from "zod";
import { yearOf } from "./calendar";
import { nationalAccounts, STEP_YEARS } from "./economy";
import type { ResourceType } from "./resources";
import { WEAPON_KINDS, type AppliedChange, type Arsenal, type ArmsStock, type GameState, type MapRegion, type ScenarioId, type WeaponKind } from "./types";

/**
 * Every country's weapons: rifles (in thousands), artillery, tanks, combat
 * aircraft, major warships, air-defence guns and launchers, and drones —
 * how many, and of what technology level. The army budget buys new ones
 * each month, at the price of the day and as fast as industry and its
 * strategic resources allow; a war wears them down by the fighting on the
 * fronts and the balance of strength; the game master may report what a
 * battle really cost, within limits. The player's research can bring a
 * level before history does (engine/research.ts).
 */

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

/** The highest level of a kind the player's research has brought ("gen:tanks:3"). */
export function researchedLevel(state: Pick<GameState, "research">, kind: WeaponKind): number {
  let level = 0;
  for (const d of state.research?.done ?? []) {
    const [prefix, k, n] = d.id.split(":");
    if (prefix === "gen" && k === kind) level = Math.max(level, Number(n) || 0);
  }
  return level;
}

/** The level a country builds a kind at in a year: history's, a level less for a poor army, the player's research ahead of it. */
export function buildLevel(state: Pick<GameState, "player" | "research">, tag: string, kind: WeaponKind, year: number, rich = true): number {
  const base = baseLevel(kind, year);
  const own = tag === state.player ? researchedLevel(state, kind) : 0;
  if (own > base) return own;
  return base === 0 ? 0 : Math.max(1, base - (rich ? 0 : 1));
}

/** What a unit costs, millions of dollars of the day, with its upkeep and ammunition; rifles per thousand. Straight lines between the years. */
const COST: Record<WeaponKind, [number, number][]> = {
  rifles: [[1900, 0.06], [1939, 0.2], [1950, 0.35], [1964, 0.5], [1991, 1.5], [2014, 3], [2022, 3.5]],
  artillery: [[1900, 0.05], [1939, 0.17], [1950, 0.4], [1964, 1], [1991, 4], [2014, 8], [2022, 10]],
  tanks: [[1916, 0.1], [1939, 0.4], [1950, 1], [1964, 1.5], [1991, 8], [2014, 12], [2022, 15]],
  aircraft: [[1911, 0.05], [1939, 0.25], [1950, 1.2], [1964, 6], [1991, 40], [2014, 80], [2022, 100]],
  ships: [[1900, 6], [1939, 15], [1950, 25], [1964, 60], [1991, 600], [2014, 1000], [2022, 1200]],
  airDefence: [[1915, 0.04], [1939, 0.07], [1950, 0.3], [1964, 3], [1991, 30], [2014, 60], [2022, 70]],
  // A strike drone of 2022 is a fraction of a 1991 one.
  drones: [[1982, 1], [1991, 1.5], [2014, 1], [2022, 0.5]],
};

/** The cost of one unit of a kind in a year, $bn. */
export function unitCost(kind: WeaponKind, year: number): number {
  const curve = COST[kind];
  let value = curve[0][1];
  for (let i = 0; i < curve.length; i += 1) {
    const [y, v] = curve[i];
    if (year >= y) value = v;
    const next = curve[i + 1];
    if (next && year >= y && year < next[0]) value = v + ((next[1] - v) * (year - y)) / (next[0] - y);
  }
  return value / 1000;
}

/** How a year's arms money is split between the kinds, before the player's priorities. */
function mixAt(year: number): Record<WeaponKind, number> {
  if (year < 1916) return { rifles: 0.15, artillery: 0.35, tanks: 0, aircraft: 0.05, ships: 0.45, airDefence: 0, drones: 0 };
  if (year < 1945) return { rifles: 0.08, artillery: 0.22, tanks: 0.18, aircraft: 0.3, ships: 0.15, airDefence: 0.07, drones: 0 };
  if (year < 1982) return { rifles: 0.05, artillery: 0.15, tanks: 0.18, aircraft: 0.35, ships: 0.17, airDefence: 0.1, drones: 0 };
  if (year < 2014) return { rifles: 0.03, artillery: 0.14, tanks: 0.15, aircraft: 0.33, ships: 0.17, airDefence: 0.13, drones: 0.005 };
  return { rifles: 0.03, artillery: 0.16, tanks: 0.12, aircraft: 0.28, ships: 0.15, airDefence: 0.14, drones: 0.01 };
}

/** The strategic resources each kind is built from: a shortage of any of them slows it. */
const NEEDS: Record<WeaponKind, ResourceType[]> = {
  rifles: ["iron"],
  artillery: ["iron", "coal"],
  tanks: ["iron", "oil"],
  aircraft: ["bauxite", "oil"],
  ships: ["iron", "coal"],
  airDefence: ["iron"],
  drones: [],
};

/** Share of the army budget spent on new weapons, in peace and at war; the rest is pay, food and upkeep. */
const PROCUREMENT = { peace: 0.3, war: 0.5 };
/** No country turns more than this share of its GDP a year into new weapons. */
const MAX_ARMS_SHARE = 0.35;
/** Old weapons retired each year. */
const RETIRE = 0.03;

/**
 * The weapons of the main powers on each start date, from the standard
 * counts of the day (rounded): for 1914 the mobilisation returns and the
 * naval lists; for 1939 Jentz's Panzertruppen, the RAF's first-line return
 * and Soviet archives as Glantz gives them; from 1950 on the IISS Military
 * Balance of the year before, with the US Army's own figures for Korea.
 * Ships are major warships and submarines, air defence guns or launchers.
 */
export const ARMS_SEEDS: Record<ScenarioId, Record<string, Partial<Record<WeaponKind, number>>>> = {
  "1914": {
    germany: { rifles: 5000, artillery: 7000, aircraft: 230, ships: 240 },
    france: { rifles: 4000, artillery: 4300, aircraft: 140, ships: 185 },
    russia: { rifles: 4600, artillery: 7000, aircraft: 250, ships: 150 },
    uk: { rifles: 1000, artillery: 1500, aircraft: 110, ships: 480 },
    "austria-hungary": { rifles: 2500, artillery: 3100, aircraft: 40, ships: 55 },
    italy: { rifles: 1500, artillery: 2500, aircraft: 60, ships: 100 },
    usa: { rifles: 700, artillery: 600, aircraft: 30, ships: 150 },
    japan: { rifles: 1200, artillery: 2000, aircraft: 15, ships: 120 },
    ottoman: { rifles: 900, artillery: 1800, aircraft: 10, ships: 30 },
    serbia: { rifles: 350, artillery: 700, aircraft: 3, ships: 0 },
  },
  "1939": {
    // Germany on 1 September: 3,195 tanks (Jentz), about 3,600 combat aircraft, 2,600 heavy and 6,700 light Flak guns.
    germany: { rifles: 4500, artillery: 8000, tanks: 3200, aircraft: 3600, ships: 95, airDefence: 9000 },
    poland: { rifles: 1300, artillery: 4300, tanks: 880, aircraft: 400, ships: 10, airDefence: 400 },
    uk: { rifles: 1500, artillery: 2000, tanks: 1150, aircraft: 1900, ships: 330, airDefence: 950 },
    france: { rifles: 5000, artillery: 11000, tanks: 3300, aircraft: 1700, ships: 175, airDefence: 1500 },
    // The Red Army's tank park in September 1939: about 21,000.
    ussr: { rifles: 8000, artillery: 40000, tanks: 21000, aircraft: 10000, ships: 225, airDefence: 3500 },
    italy: { rifles: 3500, artillery: 7000, tanks: 1500, aircraft: 1800, ships: 240, airDefence: 1000 },
    usa: { rifles: 2000, artillery: 2500, tanks: 400, aircraft: 2500, ships: 330, airDefence: 500 },
    japan: { rifles: 3000, artillery: 9000, tanks: 1700, aircraft: 3000, ships: 220, airDefence: 1000 },
    china: { rifles: 2000, artillery: 1500, tanks: 50, aircraft: 200, ships: 10, airDefence: 200 },
  },
  "1950": {
    // The Korean People's Army on 25 June: 242 T-34/85s and about 210 aircraft; the ROK army had no tanks and 91 howitzers.
    "north-korea": { rifles: 250, artillery: 1600, tanks: 242, aircraft: 210, ships: 20, airDefence: 100 },
    "south-korea": { rifles: 100, artillery: 91, tanks: 0, aircraft: 10, ships: 15, airDefence: 0 },
    usa: { rifles: 4000, artillery: 6000, tanks: 5000, aircraft: 10000, ships: 300, airDefence: 2000 },
    ussr: { rifles: 10000, artillery: 50000, tanks: 35000, aircraft: 15000, ships: 450, airDefence: 15000 },
    china: { rifles: 4000, artillery: 8000, tanks: 400, aircraft: 200, ships: 50, airDefence: 300 },
    uk: { rifles: 2500, artillery: 5000, tanks: 3000, aircraft: 2000, ships: 300, airDefence: 2500 },
    france: { rifles: 2000, artillery: 4000, tanks: 2000, aircraft: 1000, ships: 150, airDefence: 1000 },
    // Occupied Japan had no armed forces until the Police Reserve of August 1950.
    japan: { rifles: 0, artillery: 0, tanks: 0, aircraft: 0, ships: 0, airDefence: 0 },
  },
  "1964": {
    usa: { rifles: 5000, artillery: 8000, tanks: 12000, aircraft: 10000, ships: 380, airDefence: 3000 },
    ussr: { rifles: 12000, artillery: 60000, tanks: 40000, aircraft: 12000, ships: 600, airDefence: 8000 },
    // North Vietnam: the first 36 MiG-17s came from China in August 1964, with about 1,400 anti-aircraft guns.
    "north-vietnam": { rifles: 400, artillery: 2000, tanks: 60, aircraft: 36, ships: 30, airDefence: 1400 },
    "south-vietnam": { rifles: 500, artillery: 600, tanks: 150, aircraft: 250, ships: 50, airDefence: 50 },
    china: { rifles: 10000, artillery: 20000, tanks: 3000, aircraft: 2500, ships: 300, airDefence: 3000 },
    uk: { rifles: 1000, artillery: 2000, tanks: 1500, aircraft: 1300, ships: 200, airDefence: 500 },
    france: { rifles: 1500, artillery: 2500, tanks: 1500, aircraft: 1200, ships: 130, airDefence: 600 },
  },
  "1991": {
    // The Soviet armed forces on the eve of the coup: about 54,000 tanks.
    ussr: { rifles: 20000, artillery: 55000, tanks: 54000, aircraft: 8000, ships: 520, airDefence: 8000, drones: 0 },
    usa: { rifles: 6000, artillery: 8000, tanks: 15600, aircraft: 6000, ships: 340, airDefence: 1500, drones: 0 },
    germany: { rifles: 2000, artillery: 4000, tanks: 6000, aircraft: 700, ships: 100, airDefence: 600, drones: 0 },
    uk: { rifles: 600, artillery: 800, tanks: 1200, aircraft: 600, ships: 100, airDefence: 400, drones: 0 },
    france: { rifles: 1000, artillery: 1500, tanks: 1300, aircraft: 700, ships: 100, airDefence: 500, drones: 0 },
    china: { rifles: 10000, artillery: 18000, tanks: 8000, aircraft: 5000, ships: 300, airDefence: 2000, drones: 0 },
  },
  "1999": {
    // Yugoslavia before the bombing: about 1,270 tanks and 240 combat aircraft (IISS 1998/99).
    yugoslavia: { rifles: 1000, artillery: 1800, tanks: 1270, aircraft: 240, ships: 20, airDefence: 200, drones: 0 },
    usa: { rifles: 5000, artillery: 6000, tanks: 8000, aircraft: 4500, ships: 300, airDefence: 1000, drones: 200 },
    russia: { rifles: 15000, artillery: 26000, tanks: 20000, aircraft: 2200, ships: 160, airDefence: 3000, drones: 20 },
    uk: { rifles: 400, artillery: 450, tanks: 600, aircraft: 500, ships: 70, airDefence: 250, drones: 10 },
    france: { rifles: 600, artillery: 800, tanks: 1000, aircraft: 500, ships: 60, airDefence: 300, drones: 10 },
    germany: { rifles: 800, artillery: 2000, tanks: 2800, aircraft: 450, ships: 40, airDefence: 300, drones: 0 },
    china: { rifles: 8000, artillery: 14000, tanks: 8500, aircraft: 3500, ships: 200, airDefence: 1500, drones: 0 },
  },
  "2014": {
    // Ukraine in January 2014 (IISS 2014): 775 tanks in service, about 160 combat aircraft, most not airworthy.
    ukraine: { rifles: 3000, artillery: 1500, tanks: 800, aircraft: 160, ships: 15, airDefence: 250, drones: 10 },
    russia: { rifles: 10000, artillery: 5500, tanks: 2600, aircraft: 1400, ships: 100, airDefence: 1500, drones: 500 },
    usa: { rifles: 4000, artillery: 2500, tanks: 2800, aircraft: 3500, ships: 190, airDefence: 1000, drones: 1000 },
    uk: { rifles: 300, artillery: 250, tanks: 230, aircraft: 250, ships: 30, airDefence: 100, drones: 300 },
    germany: { rifles: 400, artillery: 250, tanks: 320, aircraft: 200, ships: 25, airDefence: 100, drones: 100 },
    france: { rifles: 400, artillery: 300, tanks: 250, aircraft: 300, ships: 30, airDefence: 150, drones: 50 },
    china: { rifles: 8000, artillery: 13000, tanks: 7000, aircraft: 2500, ships: 200, airDefence: 2000, drones: 500 },
    poland: { rifles: 500, artillery: 800, tanks: 900, aircraft: 100, ships: 20, airDefence: 200, drones: 50 },
    belarus: { rifles: 600, artillery: 1000, tanks: 500, aircraft: 70, ships: 0, airDefence: 200, drones: 20 },
  },
  "2022": {
    // The two armies on 24 February (IISS Military Balance 2022): Russia about 3,300 active tanks, Ukraine about 900.
    russia: { rifles: 10000, artillery: 5000, tanks: 3300, aircraft: 1400, ships: 90, airDefence: 1500, drones: 2000 },
    ukraine: { rifles: 3000, artillery: 1800, tanks: 900, aircraft: 120, ships: 10, airDefence: 300, drones: 300 },
    usa: { rifles: 4000, artillery: 2000, tanks: 2600, aircraft: 3300, ships: 200, airDefence: 1000, drones: 1500 },
    belarus: { rifles: 600, artillery: 1000, tanks: 500, aircraft: 70, ships: 0, airDefence: 200, drones: 50 },
    poland: { rifles: 500, artillery: 600, tanks: 650, aircraft: 90, ships: 15, airDefence: 150, drones: 50 },
    uk: { rifles: 300, artillery: 250, tanks: 230, aircraft: 250, ships: 30, airDefence: 100, drones: 300 },
    germany: { rifles: 400, artillery: 250, tanks: 320, aircraft: 220, ships: 25, airDefence: 100, drones: 100 },
    france: { rifles: 400, artillery: 200, tanks: 220, aircraft: 300, ships: 30, airDefence: 120, drones: 50 },
    china: { rifles: 7000, artillery: 9000, tanks: 5400, aircraft: 2400, ships: 300, airDefence: 2500, drones: 2000 },
    turkey: { rifles: 1000, artillery: 2500, tanks: 2300, aircraft: 300, ships: 50, airDefence: 100, drones: 300 },
  },
};

/** Weapons per thousand soldiers on each start date, for the countries without a count of their own (rifles: per soldier). */
const PER_THOUSAND: Record<ScenarioId, Record<WeaponKind, number>> = {
  "1914": { rifles: 3, artillery: 5, tanks: 0, aircraft: 0.1, ships: 0.15, airDefence: 0, drones: 0 },
  "1939": { rifles: 2, artillery: 3, tanks: 0.6, aircraft: 0.6, ships: 0.08, airDefence: 0.8, drones: 0 },
  "1950": { rifles: 2, artillery: 4, tanks: 1.5, aircraft: 1.5, ships: 0.1, airDefence: 2, drones: 0 },
  "1964": { rifles: 2, artillery: 3, tanks: 1.5, aircraft: 1, ships: 0.1, airDefence: 2, drones: 0 },
  "1991": { rifles: 2.5, artillery: 4, tanks: 4, aircraft: 1.5, ships: 0.08, airDefence: 1.5, drones: 0.02 },
  "1999": { rifles: 2.5, artillery: 4, tanks: 4, aircraft: 1.5, ships: 0.08, airDefence: 1.5, drones: 0.05 },
  "2014": { rifles: 3, artillery: 4, tanks: 3, aircraft: 1.2, ships: 0.08, airDefence: 1, drones: 0.5 },
  "2022": { rifles: 3, artillery: 4, tanks: 3, aircraft: 1, ships: 0.08, airDefence: 1, drones: 1 },
};

/** Kinds a poor army has fewer of, by how much it spends on each soldier. */
const HEAVY: WeaponKind[] = ["tanks", "aircraft", "ships", "airDefence", "drones"];

/** The year each country first had atomic weapons (the bomb tested, or bought, as history has it). */
export const NUCLEAR_SINCE: Record<string, number> = {
  usa: 1945,
  ussr: 1949,
  russia: 1949,
  uk: 1952,
  france: 1960,
  china: 1964.8,
  israel: 1967,
  india: 1974,
  pakistan: 1998,
  "north-korea": 2006,
};

/** Fractional years of a date, for comparing with NUCLEAR_SINCE. */
const yearFraction = (date: string) => yearOf(date) + (Number(date.slice(5, 7)) - 1) / 12;

const round = (v: number) => Math.round(v);
const round1 = (v: number) => Math.round(v * 10) / 10;

/** How much an army spends on each soldier against the median army, square-rooted: 1 for the median, under 0.6 for a poor one. */
function wealthOf(state: Pick<GameState, "countries">): (tag: string) => number {
  const spend = Object.values(state.countries)
    .flatMap((c) => (c.economy && c.economy.troops >= 5 ? [c.economy.budget.army / c.economy.troops] : []))
    .sort((a, b) => a - b);
  const median = spend.length ? spend[Math.floor(spend.length / 2)] : 0;
  return (tag) => {
    const e = state.countries[tag]?.economy;
    if (!e || !median || e.troops <= 0) return 1;
    return Math.min(2.5, Math.max(0.3, Math.sqrt(e.budget.army / e.troops / median)));
  };
}

/** Whether any province a country owns lies on the sea. */
function coastalCountries(state: Pick<GameState, "regions">, map: Record<string, MapRegion> | null): Set<string> | null {
  if (!map) return null;
  const out = new Set<string>();
  for (const [id, r] of Object.entries(state.regions)) if (map[id]?.coastal) out.add(r.owner);
  return out;
}

/** A country's weapons on a start date: the counts of the day for the main powers, from its army for the rest. */
export function startingArsenal(
  state: Pick<GameState, "scenarioId" | "date" | "player" | "research">,
  tag: string,
  troops: number,
  wealth: number,
  coastal: boolean,
): Arsenal {
  const year = yearOf(state.date);
  const seed = ARMS_SEEDS[state.scenarioId]?.[tag];
  const stock: Arsenal["stock"] = {};
  for (const kind of WEAPON_KINDS) {
    const level = buildLevel(state, tag, kind, year, wealth >= 0.6);
    if (level === 0 && !seed?.[kind]) continue;
    let n = seed?.[kind];
    if (n === undefined) {
      if (kind === "ships" && !coastal) continue;
      const per = PER_THOUSAND[state.scenarioId][kind];
      n = kind === "rifles" ? troops * per : troops * per * (HEAVY.includes(kind) ? wealth : 1);
    }
    if (n > 0 || seed?.[kind] !== undefined) stock[kind] = { n: round(n), level: Math.max(1, level) };
  }
  const nuclear = (NUCLEAR_SINCE[tag] ?? Infinity) <= yearFraction(state.date);
  return { stock, ...(nuclear ? { nuclear: true } : {}) };
}

/** Every country with an economy and no weapons gets them; the state is returned as it was when nobody lacks them. */
export function seedArsenals<T extends Pick<GameState, "countries" | "regions" | "scenarioId" | "date" | "player" | "research">>(state: T, map: Record<string, MapRegion> | null): T {
  const missing = Object.values(state.countries).filter((c) => c.economy && !c.dormant && !c.arsenal);
  if (!missing.length) return state;
  const wealth = wealthOf(state);
  const coast = coastalCountries(state, map);
  const countries = { ...state.countries };
  for (const c of missing) countries[c.tag] = { ...c, arsenal: startingArsenal(state, c.tag, c.economy!.troops, wealth(c.tag), coast ? coast.has(c.tag) : true) };
  return { ...state, countries };
}

/** What a country's weapons and soldiers weigh in a war: thousands of soldiers, armed or not, and the heavy weapons by their level against the day's. */
const WEIGHT: Partial<Record<WeaponKind, number>> = { artillery: 0.04, tanks: 0.08, aircraft: 0.1, airDefence: 0.03, drones: 0.02 };

export function combatPower(state: Pick<GameState, "countries" | "date">, tag: string): number {
  const c = state.countries[tag];
  const troops = c?.economy?.troops ?? 0;
  const stock = c?.arsenal?.stock ?? {};
  const year = yearOf(state.date);
  // Soldiers without rifles count for half.
  const armed = stock.rifles ? Math.min(1, stock.rifles.n / Math.max(1, troops)) : 1;
  let power = troops * (0.5 + 0.5 * armed);
  for (const [kind, w] of Object.entries(WEIGHT) as [WeaponKind, number][]) {
    const s = stock[kind];
    if (!s?.n) continue;
    power += w * s.n * 1.6 ** (s.level - Math.max(1, baseLevel(kind, year)));
  }
  return power;
}

/** Wars being fought now (not under a truce), with each country's enemies. */
export function enemiesOf(state: Pick<GameState, "wars">): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const w of state.wars) {
    if (w.truce) continue;
    for (const [mine, theirs] of [
      [w.attackers, w.defenders],
      [w.defenders, w.attackers],
    ]) {
      for (const tag of mine) {
        const set = out.get(tag) ?? new Set<string>();
        for (const e of theirs) set.add(e);
        out.set(tag, set);
      }
    }
  }
  return out;
}

/** Kinds that fight on the ground: a country with no front of its own hardly loses them. */
const GROUND: WeaponKind[] = ["rifles", "artillery", "tanks"];

/** How hard a country fights with a kind: more with every contested province it is in; at war with no front of its own, only in the air and at sea. */
function intensity(fronts: number, kind: WeaponKind): number {
  if (!fronts) return GROUND.includes(kind) ? 0.02 : 0.08;
  return Math.min(1, 0.2 + fronts / 8);
}

/** Contested provinces a country is in, on either side. */
function frontsOf(state: Pick<GameState, "regions">, tag: string): number {
  let fronts = 0;
  for (const r of Object.values(state.regions)) if (r.contested && (r.contested === tag || r.controller === tag || r.owner === tag)) fronts += 1;
  return fronts;
}

/** Share of each kind lost in a month of the hardest fighting. */
const LOSS_RATE: Record<WeaponKind, number> = { rifles: 0.01, artillery: 0.02, tanks: 0.04, aircraft: 0.025, ships: 0.01, airDefence: 0.015, drones: 0.12 };

/** What the engine expects a country to lose this turn, by kind, before the game master's word. */
export function expectedLosses(state: Pick<GameState, "countries" | "regions" | "wars" | "date">, tag: string, years: number): Partial<Record<WeaponKind, number>> {
  const enemies = enemiesOf(state).get(tag);
  const stock = state.countries[tag]?.arsenal?.stock;
  if (!enemies?.size || !stock) return {};
  const mine = Math.max(1, combatPower(state, tag));
  const theirs = [...enemies].reduce((sum, e) => sum + combatPower(state, e), 0);
  const factor = Math.min(1.6, Math.max(0.6, Math.sqrt(theirs / mine)));
  const months = years * 12;
  const fronts = frontsOf(state, tag);
  const out: Partial<Record<WeaponKind, number>> = {};
  for (const [kind, s] of Object.entries(stock) as [WeaponKind, ArmsStock][]) {
    const rate = Math.min(0.5, LOSS_RATE[kind] * intensity(fronts, kind) * factor);
    const lost = s.n * (1 - (1 - rate) ** months);
    if (lost >= 0.5) out[kind] = round(lost);
  }
  return out;
}

/** The most of its stock a country can lose in a turn of so many months, whatever the game master says. */
export const maxLossShare = (months: number) => Math.min(0.7, 0.15 * Math.max(0.25, months));

/** What the game master may say about weapons in a turn's answer (merged into OutcomeSchema as `arms`). */
const tag = z.string().trim().min(1).max(80);
export const armsField = z
  .object({
    // Losses a battle of the period really caused, by country and kind; and who took them, if they were captured.
    losses: z
      .array(z.object({ country: tag, kind: z.enum(WEAPON_KINDS), lost: z.number().finite().min(0), capturedBy: tag.optional().catch(undefined) }))
      .max(24)
      .catch([])
      .default([]),
    // The kinds a directive or order told the player's industry to build first.
    focus: z.array(z.enum(WEAPON_KINDS)).max(2).optional().catch(undefined),
    // Research projects a directive or order started or stopped.
    research: z
      .array(z.object({ project: z.string().trim().min(1).max(60), action: z.enum(["start", "stop"]).catch("start") }))
      .max(3)
      .catch([])
      .default([]),
  })
  .catch({ losses: [], research: [] })
  .default({ losses: [], research: [] });

export type ArmsWord = z.infer<typeof armsField>;

/** Kinds the player can build now: history has them, or research brought them. */
export function availableKinds(state: Pick<GameState, "player" | "research" | "date">): WeaponKind[] {
  const year = yearOf(state.date);
  return WEAPON_KINDS.filter((k) => buildLevel(state, state.player, k, year) > 0);
}

/**
 * Keeps what the game master may change: losses only for a country at war
 * (or going to war in the same answer) and no more than a turn of the
 * hardest fighting could take, captures only by its enemy and no more than
 * half of what it lost; the player's priorities only among kinds it can
 * build. Research is checked by engine/research.ts.
 */
export function sanitizeArms(state: GameState, word: ArmsWord, fighting: Set<string>): Omit<ArmsWord, "research"> {
  const months = STEP_YEARS[state.step] * 12;
  const enemies = enemiesOf(state);
  const seen = new Set<string>();
  const losses = word.losses.flatMap((l) => {
    const stock = state.countries[l.country]?.arsenal?.stock[l.kind];
    const key = `${l.country}:${l.kind}`;
    if (!stock || !fighting.has(l.country) || seen.has(key)) return [];
    seen.add(key);
    const lost = round(Math.min(l.lost, stock.n * maxLossShare(months)));
    const captor = l.capturedBy && l.capturedBy !== l.country && enemies.get(l.country)?.has(l.capturedBy) && state.countries[l.capturedBy] ? l.capturedBy : undefined;
    return [{ country: l.country, kind: l.kind, lost, ...(captor ? { capturedBy: captor } : {}) }];
  });
  const can = new Set(availableKinds(state));
  const focus = word.focus ? [...new Set(word.focus.filter((k) => can.has(k)))].slice(0, 2) : undefined;
  return { losses, ...(focus ? { focus } : {}) };
}

/** Production of a country over the turn: the arms money, split by the mix and its priorities, at the day's prices, slowed by shortages. */
export function production(
  state: Pick<GameState, "countries" | "player" | "research" | "date" | "politics" | "wars">,
  tag: string,
  years: number,
  options: { shortages?: ResourceType[]; coastal?: boolean; researchSpend?: number; rich?: boolean } = {},
): Partial<Record<WeaponKind, { n: number; level: number }>> {
  const c = state.countries[tag];
  const e = c?.economy;
  if (!e || !c.arsenal) return {};
  const year = yearOf(state.date);
  const atWar = enemiesOf(state).has(tag);
  const yearly = Math.max(0, Math.min(e.budget.army * (atWar ? PROCUREMENT.war : PROCUREMENT.peace), e.gdp * MAX_ARMS_SHARE) - (options.researchSpend ?? 0));
  if (!yearly) return {};
  // A planned economy pays its factories in its own money: weapons cost it less in dollars.
  const planned = tag === state.player ? state.politics?.laws?.economy === "planned" : c.domestic?.regime === "party";
  const price = planned ? 0.6 : 1;
  const mix = mixAt(year);
  const focus = new Set(c.arsenal.focus ?? []);
  const kinds = WEAPON_KINDS.filter((k) => buildLevel(state, tag, k, year, options.rich ?? true) > 0 && !(k === "ships" && options.coastal === false));
  const weights = kinds.map((k) => mix[k] * (focus.has(k) ? 2 : 1) * (k === "drones" && atWar ? 6 : 1));
  const total = weights.reduce((a, b) => a + b, 0);
  if (!total) return {};
  const short = new Set(options.shortages ?? []);
  const out: Partial<Record<WeaponKind, { n: number; level: number }>> = {};
  kinds.forEach((kind, i) => {
    const slowed = NEEDS[kind].filter((r) => short.has(r)).reduce((f) => f * 0.6, 1);
    const n = ((yearly * weights[i]) / total / (unitCost(kind, year) * price)) * years * slowed;
    if (n > 0) out[kind] = { n, level: buildLevel(state, tag, kind, year, options.rich ?? true) };
  });
  return out;
}

/** Weapons that change hands this turn: arms bought by contract ($bn a year) or given in kind ($bn). */
export interface Delivery {
  from: string;
  to: string;
  /** $bn over the turn. */
  money: number;
  /** Given from the giver's own stores, which shrink; bought ones are newly made. */
  fromStock: boolean;
}

/** What a delivery buys: the money split by the day's mix among the kinds the giver has or makes, at its level and prices. */
function delivered(next: GameState, d: Delivery, year: number, coastal: boolean): Partial<Record<WeaponKind, ArmsStock>> {
  const giver = next.countries[d.from]?.arsenal;
  const mix = mixAt(year);
  const kinds = WEAPON_KINDS.filter((k) => (d.fromStock ? (giver?.stock[k]?.n ?? 0) > 0 : buildLevel(next, d.from, k, year) > 0) && !(k === "ships" && !coastal) && k !== "rifles");
  const total = kinds.reduce((sum, k) => sum + mix[k], 0);
  const out: Partial<Record<WeaponKind, ArmsStock>> = {};
  if (!total || d.money <= 0) return out;
  for (const k of kinds) {
    let n = (d.money * mix[k]) / total / unitCost(k, year);
    if (d.fromStock && giver?.stock[k]) n = Math.min(n, giver.stock[k]!.n * 0.3);
    if (n < 0.5) continue;
    out[k] = { n: round(n), level: d.fromStock && giver?.stock[k] ? giver.stock[k]!.level : Math.max(1, buildLevel(next, d.from, k, year)) };
  }
  return out;
}

/** Adds weapons to a stock, blending their levels. */
function add(arsenal: Arsenal, kind: WeaponKind, n: number, level: number): void {
  const s = arsenal.stock[kind];
  const total = (s?.n ?? 0) + n;
  if (total <= 0) return;
  arsenal.stock[kind] = { n: round(total), level: round1(((s?.level ?? level) * (s?.n ?? 0) + level * n) / total) };
}

/**
 * Moves every country's weapons through one turn: new ones are built,
 * old ones retire, wars wear them down — by the game master's word where
 * it gave one, else by the engine's own rule — and captured ones change
 * hands. Countries without weapons get them first. `researchSpend` is the
 * player's military research this turn, $bn a year, taken from its arms
 * money. Mutates `next`.
 */
export function advanceArsenals(
  next: GameState,
  before: GameState,
  word: Omit<ArmsWord, "research">,
  years: number,
  map: Record<string, MapRegion> | null,
  applied: AppliedChange[],
  researchSpend = 0,
  deliveries: Delivery[] = [],
): void {
  const seeded = seedArsenals(next, map);
  next.countries = seeded.countries;
  const accounts = map ? nationalAccounts(next, map) : null;
  const coast = coastalCountries(next, map);
  const wealth = wealthOf(next);
  const reported = new Map(word.losses.map((l) => [`${l.country}:${l.kind}`, l]));
  if (word.focus && next.countries[next.player]?.arsenal) next.countries[next.player].arsenal!.focus = word.focus;
  const captured: { by: string; from: string; kind: WeaponKind; n: number; level: number }[] = [];

  for (const [tag, country] of Object.entries(next.countries)) {
    const arsenal = country.arsenal;
    if (!arsenal || !country.economy) continue;
    const made = production(next, tag, years, {
      shortages: accounts?.get(tag)?.shortages,
      coastal: coast ? coast.has(tag) : undefined,
      researchSpend: tag === next.player ? researchSpend : 0,
      rich: wealth(tag) >= 0.6,
    });
    const expected = before.countries[tag]?.arsenal ? expectedLosses(before, tag, years) : {};
    const stock: Arsenal["stock"] = {};
    const madeOut: Arsenal["made"] = {};
    const lostOut: Arsenal["lost"] = {};
    for (const kind of WEAPON_KINDS) {
      const s = arsenal.stock[kind];
      const m = made[kind];
      if (!s && !m) continue;
      const old = s ? s.n * Math.max(0, 1 - RETIRE * years) : 0;
      const word = reported.get(`${tag}:${kind}`);
      const lost = Math.min(old, word ? word.lost : (expected[kind] ?? 0));
      if (word?.capturedBy && lost > 0) captured.push({ by: word.capturedBy, from: tag, kind, n: round(lost / 2), level: s?.level ?? 1 });
      const kept = old - lost;
      const add = m?.n ?? 0;
      const n = kept + add;
      const level = n > 0 ? ((s?.level ?? m!.level) * kept + (m?.level ?? 0) * add) / n : (s?.level ?? m?.level ?? 1);
      stock[kind] = { n: round(n), level: round1(Math.max(1, level)) };
      if (add >= 0.5) madeOut[kind] = round(add);
      if (lost >= 0.5) lostOut[kind] = round(lost);
    }
    const nuclear = arsenal.nuclear || (tag !== next.player && (NUCLEAR_SINCE[tag] ?? Infinity) <= yearFraction(next.date));
    next.countries[tag] = {
      ...country,
      arsenal: {
        stock,
        ...(arsenal.focus?.length ? { focus: arsenal.focus } : {}),
        ...(tag === next.player ? { made: madeOut, lost: lostOut } : {}),
        ...(nuclear ? { nuclear: true } : {}),
      },
    };
  }

  // Captured weapons serve their new owner, at their old level.
  for (const c of captured) {
    const arsenal = next.countries[c.by]?.arsenal;
    if (!arsenal || c.n < 1) continue;
    add(arsenal, c.kind, c.n, c.level);
    applied.push({ kind: "captured", by: c.by, from: c.from, arms: c.kind, n: c.n });
  }

  // Arms bought or given arrive; given ones leave the giver's stores.
  const year = yearOf(next.date);
  const got: Arsenal["got"] = {};
  for (const d of deliveries) {
    const to = next.countries[d.to]?.arsenal;
    if (!to || d.from === d.to) continue;
    for (const [kind, w] of Object.entries(delivered(next, d, year, coast ? coast.has(d.to) : true)) as [WeaponKind, ArmsStock][]) {
      add(to, kind, w.n, w.level);
      const giver = next.countries[d.from]?.arsenal?.stock[kind];
      if (d.fromStock && giver) giver.n = round(Math.max(0, giver.n - w.n));
      if (d.to === next.player) got[kind] = (got[kind] ?? 0) + w.n;
    }
  }
  if (Object.keys(got).length && next.countries[next.player]?.arsenal) next.countries[next.player].arsenal!.got = got;
}

const KIND_EN: Record<WeaponKind, string> = { rifles: "rifles (thousands)", artillery: "guns", tanks: "tanks", aircraft: "combat aircraft", ships: "warships", airDefence: "air-defence guns or launchers", drones: "drones" };

/** A country's weapons in one English line: "tanks 3,300 (level 5.6), …; atomic weapons". */
export function arsenalLine(arsenal: Arsenal | undefined): string {
  if (!arsenal) return "";
  const parts = (Object.entries(arsenal.stock) as [WeaponKind, ArmsStock][]).filter(([, s]) => s.n > 0).map(([k, s]) => `${KIND_EN[k]} ${s.n.toLocaleString("en-US")} (level ${s.level})`);
  if (arsenal.nuclear) parts.push("atomic weapons");
  return parts.join(", ");
}

/**
 * The weapons the game master needs for the turn: the player's, with what
 * it built and lost last turn and its priorities; the arms of every side in
 * the player's wars; and the balance of strength in every war.
 */
export function describeArms(state: GameState): string[] {
  const player = state.countries[state.player];
  const lines: string[] = ["", "ARMS (rifles in thousands, the rest in pieces; technology level 1 = the Great War … 6 = today; the engine builds them from the army budget and wears them down in war):"];
  if (player?.arsenal) {
    lines.push(`- ${state.player} (the player): ${arsenalLine(player.arsenal) || "none"}`);
    const made = Object.entries(player.arsenal.made ?? {}).map(([k, n]) => `${KIND_EN[k as WeaponKind]} +${n}`);
    const lost = Object.entries(player.arsenal.lost ?? {}).map(([k, n]) => `${KIND_EN[k as WeaponKind]} −${n}`);
    if (made.length || lost.length) lines.push(`  last turn: built ${made.join(", ") || "nothing"}; lost ${lost.join(", ") || "nothing"}`);
    if (player.arsenal.focus?.length) lines.push(`  industry builds first: ${player.arsenal.focus.map((k) => KIND_EN[k]).join(", ")}`);
  }
  const enemies = enemiesOf(state);
  const shown = new Set([state.player]);
  for (const tag of [...(enemies.get(state.player) ?? [])]) {
    if (shown.has(tag)) continue;
    shown.add(tag);
    const line = arsenalLine(state.countries[tag]?.arsenal);
    if (line) lines.push(`- ${tag} (at war with the player): ${line}`);
  }
  const balance = state.wars
    .filter((w) => !w.truce)
    .map((w) => {
      const side = (tags: string[]) => Math.round(tags.reduce((sum, t) => sum + combatPower(state, t), 0));
      return `- ${typeof w.name === "string" ? w.name : w.name.en}: attackers ${side(w.attackers)} vs defenders ${side(w.defenders)}`;
    });
  if (balance.length) lines.push("STRENGTH IN EACH WAR (soldiers and weapons by their level, in thousand-soldier equivalents; battles should reflect it):", ...balance);
  return lines.length > 2 ? lines : [];
}

/** The player's industry builds these kinds first (at most two, among those it can build); none to spread the money by the usual mix. */
export function setFocus<T extends Pick<GameState, "countries" | "player" | "research" | "date" | "updatedAt">>(state: T, kinds: WeaponKind[], now = new Date()): T {
  const country = state.countries[state.player];
  if (!country?.arsenal) return state;
  const can = new Set(availableKinds(state));
  const focus = [...new Set(kinds.filter((k) => can.has(k)))].slice(0, 2);
  const arsenal: Arsenal = { ...country.arsenal };
  delete arsenal.focus;
  if (focus.length) arsenal.focus = focus;
  return { ...state, countries: { ...state.countries, [state.player]: { ...country, arsenal } }, updatedAt: now.toISOString() };
}

/** What the player's army buys a year now, $bn, before research takes its share. */
export function procurement(state: Pick<GameState, "countries" | "player" | "wars">): { yearly: number; atWar: boolean } {
  const e = state.countries[state.player]?.economy;
  const atWar = enemiesOf(state).has(state.player);
  if (!e) return { yearly: 0, atWar };
  return { yearly: Math.min(e.budget.army * (atWar ? PROCUREMENT.war : PROCUREMENT.peace), e.gdp * MAX_ARMS_SHARE), atWar };
}

/** The resources a kind is built from. */
export const needsOf = (kind: WeaponKind): ResourceType[] => NEEDS[kind];

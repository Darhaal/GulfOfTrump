import { z } from "zod";
import { advanceMen, menOf, menTotal, startingMen, trainingQuality } from "./army";
import { yearOf } from "./calendar";
import { nationalAccounts, STEP_YEARS } from "./economy";
import { heavyArms } from "./development";
import {
  addTypes,
  baseLevel,
  combatUnits,
  eraMix,
  industryLeft,
  isTyped,
  MAX_ORDERS,
  ORDER_SHARE,
  orderKind,
  orderTarget,
  relativeCost,
  bombing,
  loseTypes,
  roundTypes,
  scaleTypes,
  splitByMix,
  standingOrders,
  startMix,
  SUPPORT,
  TYPE_KIND,
  typesOf,
  typesTotal,
  typeBuilt,
  type TypedKind,
} from "./forces";
import { priceRatio } from "./prices";
import { armsEfficiency, techYear } from "./researchEffects";
import type { ResourceType } from "./resources";
import { ARMS_TYPES, WEAPON_KINDS, type AppliedChange, type ArmsOrder, type ArmsType, type Arsenal, type ArmsStock, type GameState, type MapRegion, type ScenarioId, type War, type WeaponKind } from "./types";

/**
 * Every country's weapons: rifles (in thousands), artillery, tanks, aircraft,
 * ships, air-defence guns and launchers, and drones — how many, and of what
 * technology level; aircraft, ships and tanks by their types too
 * (engine/forces.ts). The army budget buys new ones
 * each month, at the price of the day and as fast as industry and its
 * strategic resources allow; a war wears them down by the fighting on the
 * fronts and the balance of strength; the game master may report what a
 * battle really cost, within limits. The player's research can bring a
 * level before history does (engine/research.ts).
 */

// The technology levels live in engine/forces.ts, which this module builds on; they are read from here as before.
export { baseLevel, LEVEL_YEARS, maxLevel } from "./forces";

/**
 * The level a country builds a kind at in a year: history's, a level less
 * for a poor army. The player builds at the year its military research has
 * reached instead — ahead of history, or behind it when neglected — and a
 * lead in research is not lost to a poor army's penalty.
 */
export function buildLevel(state: Pick<GameState, "player" | "research" | "date">, tag: string, kind: WeaponKind, year: number, rich = true): number {
  const own = tag === state.player && state.research?.tech ? Math.floor(techYear(state, "military")) : year;
  const base = baseLevel(kind, own);
  if (base === 0) return 0;
  return own > year ? base : Math.max(1, base - (rich ? 0 : 1));
}

/**
 * What a unit costs, millions of dollars of the day by the calendar, with its upkeep and ammunition; rifles per thousand.
 * Straight lines between the years; a game reads them at its own prices (engine/prices.ts priceRatio), so the army line,
 * a share of a GDP grown by the era's dollar, buys as much as it did.
 */
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

/** The cost of one unit of a kind in a year, $bn: in the game's dollar when its start date is given. */
export function unitCost(kind: WeaponKind, year: number, era?: ScenarioId): number {
  const curve = COST[kind];
  let value = curve[0][1];
  for (let i = 0; i < curve.length; i += 1) {
    const [y, v] = curve[i];
    if (year >= y) value = v;
    const next = curve[i + 1];
    if (next && year >= y && year < next[0]) value = v + ((next[1] - v) * (year - y)) / (next[0] - y);
  }
  return (value / 1000) * priceRatio(era, year);
}

/** How a year's arms money is split between the kinds. */
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
  "1933": {
    // Versailles's Reichswehr: 100,000 men, 288 field guns, no tanks, no aircraft and no submarines, a coastal navy of old battleships.
    germany: { rifles: 250, artillery: 300, tanks: 0, aircraft: 0, ships: 30, airDefence: 0 },
    // The Red Army had some 4,500 tanks by the end of the first five-year plan, most of them light.
    ussr: { rifles: 3000, artillery: 17000, tanks: 4500, aircraft: 4000, ships: 100, airDefence: 1000 },
    france: { rifles: 4000, artillery: 11000, tanks: 3500, aircraft: 2000, ships: 180, airDefence: 800 },
    uk: { rifles: 1500, artillery: 1500, tanks: 350, aircraft: 850, ships: 300, airDefence: 300 },
    italy: { rifles: 2500, artillery: 5000, tanks: 300, aircraft: 1200, ships: 200, airDefence: 500 },
    japan: { rifles: 1800, artillery: 3000, tanks: 400, aircraft: 1500, ships: 200, airDefence: 300 },
    usa: { rifles: 1500, artillery: 2000, tanks: 200, aircraft: 1700, ships: 300, airDefence: 200 },
    poland: { rifles: 1000, artillery: 2500, tanks: 300, aircraft: 700, ships: 8, airDefence: 100 },
    czechoslovakia: { rifles: 800, artillery: 1800, tanks: 100, aircraft: 600, ships: 0, airDefence: 200 },
    china: { rifles: 2000, artillery: 1000, tanks: 20, aircraft: 100, ships: 20, airDefence: 50 },
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
  "1957": {
    // The year the Sandys White Paper cut Britain's army and the Soviet Union was halfway through Khrushchev's cuts; Syria and Egypt newly armed by the Soviet bloc.
    usa: { rifles: 5000, artillery: 7000, tanks: 10000, aircraft: 12000, ships: 400, airDefence: 2500 },
    ussr: { rifles: 11000, artillery: 55000, tanks: 38000, aircraft: 14000, ships: 550, airDefence: 12000 },
    china: { rifles: 6000, artillery: 15000, tanks: 2000, aircraft: 2000, ships: 150, airDefence: 2000 },
    uk: { rifles: 1500, artillery: 3000, tanks: 2000, aircraft: 1800, ships: 250, airDefence: 1500 },
    france: { rifles: 2000, artillery: 3500, tanks: 2000, aircraft: 1300, ships: 140, airDefence: 800 },
    "west-germany": { rifles: 200, artillery: 300, tanks: 600, aircraft: 150, ships: 20, airDefence: 100 },
    israel: { rifles: 150, artillery: 300, tanks: 400, aircraft: 150, ships: 10, airDefence: 100 },
    egypt: { rifles: 200, artillery: 500, tanks: 400, aircraft: 200, ships: 20, airDefence: 300 },
    syria: { rifles: 80, artillery: 200, tanks: 200, aircraft: 60, ships: 2, airDefence: 100 },
    turkey: { rifles: 500, artillery: 2000, tanks: 1200, aircraft: 400, ships: 40, airDefence: 300 },
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
  "1973": {
    // On 6 October (IISS 1973/74): Israel about 1,700 tanks and 440 combat aircraft; Egypt 2,200 tanks and some 150 SAM batteries; Syria 1,800 tanks.
    israel: { rifles: 400, artillery: 600, tanks: 1700, aircraft: 440, ships: 25, airDefence: 150 },
    egypt: { rifles: 700, artillery: 2000, tanks: 2200, aircraft: 600, ships: 50, airDefence: 1500 },
    syria: { rifles: 300, artillery: 1200, tanks: 1800, aircraft: 350, ships: 20, airDefence: 800 },
    iraq: { rifles: 200, artillery: 700, tanks: 1300, aircraft: 220, ships: 10, airDefence: 300 },
    jordan: { rifles: 100, artillery: 200, tanks: 450, aircraft: 50, ships: 0, airDefence: 100 },
    usa: { rifles: 4000, artillery: 6000, tanks: 9500, aircraft: 6000, ships: 400, airDefence: 2000 },
    ussr: { rifles: 12000, artillery: 50000, tanks: 42000, aircraft: 9000, ships: 600, airDefence: 10000 },
    china: { rifles: 10000, artillery: 18000, tanks: 8000, aircraft: 4000, ships: 300, airDefence: 3000 },
    uk: { rifles: 800, artillery: 1000, tanks: 900, aircraft: 600, ships: 150, airDefence: 400 },
    france: { rifles: 1200, artillery: 1500, tanks: 1000, aircraft: 550, ships: 110, airDefence: 400 },
    "west-germany": { rifles: 1000, artillery: 2500, tanks: 3500, aircraft: 500, ships: 70, airDefence: 600 },
    // North Vietnam's air defence after Linebacker II; the South's air force, left the Americans' aircraft, the world's fourth in numbers.
    "north-vietnam": { rifles: 900, artillery: 3000, tanks: 600, aircraft: 200, ships: 30, airDefence: 5000 },
    "south-vietnam": { rifles: 1500, artillery: 1500, tanks: 600, aircraft: 900, ships: 100, airDefence: 100 },
    // Turkey's army and the landing fleet it put ashore at Kyrenia in July 1974; Greece's junta.
    turkey: { rifles: 600, artillery: 2500, tanks: 1500, aircraft: 300, ships: 60, airDefence: 400 },
    greece: { rifles: 300, artillery: 1000, tanks: 700, aircraft: 200, ships: 50, airDefence: 200 },
  },
  "1979": {
    // The Soviet Union at the height of its arms build-up; Iran with the Shah's arsenal and half its officers gone.
    ussr: { rifles: 14000, artillery: 55000, tanks: 50000, aircraft: 8500, ships: 600, airDefence: 10000 },
    usa: { rifles: 4000, artillery: 6000, tanks: 11000, aircraft: 5500, ships: 350, airDefence: 1500 },
    china: { rifles: 10000, artillery: 18000, tanks: 10000, aircraft: 5000, ships: 300, airDefence: 3000 },
    afghanistan: { rifles: 120, artillery: 600, tanks: 600, aircraft: 150, ships: 0, airDefence: 300 },
    iran: { rifles: 400, artillery: 1000, tanks: 1700, aircraft: 450, ships: 25, airDefence: 1000 },
    iraq: { rifles: 400, artillery: 1500, tanks: 2500, aircraft: 340, ships: 20, airDefence: 1000 },
    israel: { rifles: 400, artillery: 1000, tanks: 3000, aircraft: 550, ships: 30, airDefence: 200 },
    egypt: { rifles: 800, artillery: 2000, tanks: 1600, aircraft: 450, ships: 40, airDefence: 1200 },
    syria: { rifles: 400, artillery: 1500, tanks: 2600, aircraft: 400, ships: 20, airDefence: 1000 },
    vietnam: { rifles: 1500, artillery: 5000, tanks: 1500, aircraft: 400, ships: 60, airDefence: 5000 },
    uk: { rifles: 700, artillery: 900, tanks: 900, aircraft: 550, ships: 120, airDefence: 400 },
    france: { rifles: 1200, artillery: 1400, tanks: 1100, aircraft: 550, ships: 100, airDefence: 400 },
    "west-germany": { rifles: 1000, artillery: 2500, tanks: 4000, aircraft: 500, ships: 70, airDefence: 700 },
    pakistan: { rifles: 450, artillery: 1000, tanks: 1000, aircraft: 250, ships: 20, airDefence: 300 },
    india: { rifles: 1200, artillery: 3000, tanks: 2000, aircraft: 650, ships: 50, airDefence: 1000 },
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
  "1933": { rifles: 2, artillery: 3, tanks: 0.2, aircraft: 0.4, ships: 0.1, airDefence: 0.3, drones: 0 },
  "1939": { rifles: 2, artillery: 3, tanks: 0.6, aircraft: 0.6, ships: 0.08, airDefence: 0.8, drones: 0 },
  "1950": { rifles: 2, artillery: 4, tanks: 1.5, aircraft: 1.5, ships: 0.1, airDefence: 2, drones: 0 },
  "1957": { rifles: 2, artillery: 3.5, tanks: 1.5, aircraft: 1.2, ships: 0.1, airDefence: 2, drones: 0 },
  "1964": { rifles: 2, artillery: 3, tanks: 1.5, aircraft: 1, ships: 0.1, airDefence: 2, drones: 0 },
  "1973": { rifles: 2, artillery: 3.5, tanks: 2.5, aircraft: 1.2, ships: 0.09, airDefence: 1.8, drones: 0 },
  "1979": { rifles: 2, artillery: 3.5, tanks: 3, aircraft: 1.3, ships: 0.09, airDefence: 1.7, drones: 0 },
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
    if (!(n > 0) && seed?.[kind] === undefined) continue;
    // The count of the day is of the combat types; the support type comes on top of it (engine/forces.ts).
    if (isTyped(kind) && n > 0) {
      const types = splitByMix(kind, round(n), startMix(state.scenarioId, tag, kind, round(n), year, wealth));
      stock[kind] = { n: typesTotal(types), level: Math.max(1, level), types };
    } else stock[kind] = { n: round(n), level: Math.max(1, level) };
  }
  const nuclear = (NUCLEAR_SINCE[tag] ?? Infinity) <= yearFraction(state.date);
  return { stock, men: startingMen(tag, troops, year), ...(nuclear ? { nuclear: true } : {}) };
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

/**
 * What a country's weapons and soldiers weigh in a war: thousands of soldiers
 * by their training, armed or not, and the heavy weapons by their level
 * against the day's; tanks and aircraft by their types (engine/forces.ts
 * combatUnits: attack planes over fighters, strategic bombers little at the
 * front, transports and fighting vehicles a fraction). Ships fight at sea.
 */
const WEIGHT: Partial<Record<WeaponKind, number>> = { artillery: 0.04, tanks: 0.08, aircraft: 0.1, airDefence: 0.03, drones: 0.02 };

export function combatPower(state: Pick<GameState, "countries" | "date">, tag: string): number {
  const p = combatParts(state, tag);
  return p.men + p.heavy;
}

/** A country's combat power in its parts: its soldiers, its heavy weapons, and of them the tanks and guns a staff masses where it attacks (engine/fronts.ts). */
export function combatParts(state: Pick<GameState, "countries" | "date">, tag: string): { men: number; heavy: number; massed: number } {
  const c = state.countries[tag];
  const troops = c?.economy?.troops ?? 0;
  const stock = c?.arsenal?.stock ?? {};
  const year = yearOf(state.date);
  // Soldiers without rifles count for half; career soldiers for more than conscripts, recruits for about half.
  const armed = stock.rifles ? Math.min(1, stock.rifles.n / Math.max(1, troops)) : 1;
  const men = troops * trainingQuality(menOf(state, c)) * (0.5 + 0.5 * armed);
  let heavy = 0;
  let massed = 0;
  for (const [kind, w] of Object.entries(WEIGHT) as [WeaponKind, number][]) {
    const s = stock[kind];
    if (!s?.n) continue;
    const v = w * (isTyped(kind) ? combatUnits(s, kind, year) : s.n) * 1.6 ** (s.level - Math.max(1, baseLevel(kind, year)));
    heavy += v;
    if (kind === "tanks" || kind === "artillery") massed += v;
  }
  return { men, heavy, massed };
}

/** Each side's whole strength in a war: the members' power, split between the wars each fights – one figure for the game master wherever it is told (engine/fronts.ts warStrength). */
export function splitStrength(state: Pick<GameState, "countries" | "wars" | "date">, war: Pick<War, "attackers" | "defenders">): { attackers: number; defenders: number } {
  const wars = state.wars.filter((w) => !w.truce);
  const side = (tags: string[]) => tags.reduce((sum, tag) => sum + combatPower(state, tag) / Math.max(1, wars.filter((w) => w.attackers.includes(tag) || w.defenders.includes(tag)).length), 0);
  return { attackers: side(war.attackers), defenders: side(war.defenders) };
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

/**
 * What the engine expects a country to lose this turn, by kind, before the
 * game master's word, by a share of its whole stock; `quiet` reads it with no
 * front of its own, the losses at sea and in the air. Where the map is known
 * the fighting's own exchange (engine/warLosses.ts warExchange) is used instead.
 */
export function expectedLosses(state: Pick<GameState, "countries" | "regions" | "wars" | "date">, tag: string, years: number, quiet = false): Partial<Record<WeaponKind, number>> {
  const enemies = enemiesOf(state).get(tag);
  const stock = state.countries[tag]?.arsenal?.stock;
  if (!enemies?.size || !stock) return {};
  const mine = Math.max(1, combatPower(state, tag));
  const theirs = [...enemies].reduce((sum, e) => sum + combatPower(state, e), 0);
  const factor = Math.min(1.6, Math.max(0.6, Math.sqrt(theirs / mine)));
  const months = years * 12;
  const fronts = quiet ? 0 : frontsOf(state, tag);
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
/** A kind or one of its types (engine/forces.ts): "aircraft" or "bomber", "ships" or "landing". */
const ARMS_WORDS = [...WEAPON_KINDS, ...ARMS_TYPES] as const;
/** The kinds and types as the game master's answer shape lists them. */
export const ARMS_KIND_WORDS = ARMS_WORDS.join("|");
export const armsField = z
  .object({
    // Losses a battle of the period really caused, by country and kind or type; and who took them, if they were captured.
    losses: z
      .array(z.object({ country: tag, kind: z.enum(ARMS_WORDS), lost: z.number().finite().min(0), capturedBy: tag.optional().catch(undefined) }))
      .max(24)
      .catch([])
      .default([]),
    // Shifts of the research money a directive or order made: a direction and percentage points (engine/research.ts bounds them).
    research: z
      .array(z.object({ direction: z.string().trim().min(1).max(30), shift: z.number() }))
      .max(2)
      .catch([])
      .default([]),
    // What the player's orders told industry to build: a type or kind and how many (engine/forces.ts orderTarget reads the word).
    orders: z
      .array(z.object({ type: z.string().trim().min(1).max(40), n: z.number().finite() }))
      .max(MAX_ORDERS)
      .catch([])
      .default([]),
  })
  .catch({ losses: [], research: [], orders: [] })
  .default({ losses: [], research: [], orders: [] });

export type ArmsWord = z.infer<typeof armsField>;

/** A loss the engine keeps: the kind, and the type when the game master named one. */
export interface ArmsLoss {
  country: string;
  kind: WeaponKind;
  type?: ArmsType;
  lost: number;
  capturedBy?: string;
}

/** Kinds the player can build now: history has them, or research brought them. */
export function availableKinds(state: Pick<GameState, "player" | "research" | "date">): WeaponKind[] {
  const year = yearOf(state.date);
  return WEAPON_KINDS.filter((k) => buildLevel(state, state.player, k, year) > 0);
}

/**
 * Keeps what the game master may change: losses only for a country at war
 * (or going to war in the same answer) and no more than a turn of the
 * hardest fighting could take of a kind (its types together), captures only
 * by its enemy and no more than half of what it lost. A loss named by type
 * is kept within what the country has of the type. Research is checked by
 * engine/research.ts, orders by sanitizeOrders.
 */
export function sanitizeArms(state: GameState, word: Pick<ArmsWord, "losses">, fighting: Set<string>): { losses: ArmsLoss[] } {
  const months = STEP_YEARS[state.step] * 12;
  const enemies = enemiesOf(state);
  const year = yearOf(state.date);
  const seen = new Set<string>();
  const room = new Map<string, number>();
  const losses = word.losses.flatMap((l): ArmsLoss[] => {
    const type = (ARMS_TYPES as readonly string[]).includes(l.kind) ? (l.kind as ArmsType) : undefined;
    const kind = type ? TYPE_KIND[type] : (l.kind as WeaponKind);
    const stock = state.countries[l.country]?.arsenal?.stock[kind];
    const key = `${l.country}:${kind}:${type ?? ""}`;
    if (!stock || !fighting.has(l.country) || seen.has(key)) return [];
    seen.add(key);
    const kindKey = `${l.country}:${kind}`;
    const left = room.get(kindKey) ?? stock.n * maxLossShare(months);
    const has = type && isTyped(kind) ? (typesOf(stock, kind, year)[type] ?? 0) : stock.n;
    const lost = round(Math.min(l.lost, left, has));
    if (lost <= 0) return [];
    room.set(kindKey, left - lost);
    const captor = l.capturedBy && l.capturedBy !== l.country && enemies.get(l.country)?.has(l.capturedBy) && state.countries[l.capturedBy] ? l.capturedBy : undefined;
    return [{ country: l.country, kind, ...(type ? { type } : {}), lost, ...(captor ? { capturedBy: captor } : {}) }];
  });
  return { losses };
}

/**
 * The player's orders to industry, as the engine keeps them: a type or kind
 * it can build now, a whole number no larger than two years of all its arms
 * money could buy, one order per type; a new order for a type replaces the
 * old one, an order of 0 cancels it.
 */
export function sanitizeOrders(state: GameState, words: ArmsWord["orders"]): { type: ArmsType | WeaponKind; n: number }[] {
  const year = yearOf(state.date);
  const can = new Set(availableKinds(state));
  const money = procurement(state).yearly * 2;
  const seen = new Set<string>();
  return words.flatMap((w) => {
    const target = orderTarget(w.type);
    if (!target || seen.has(target)) return [];
    const kind = orderKind(target);
    const typed = target in TYPE_KIND;
    if (!can.has(kind) || (typed && !typeBuilt(target as ArmsType, year))) return [];
    seen.add(target);
    const each = unitCost(kind, year, state.scenarioId) * (typed ? relativeCost(target as ArmsType, year) : 1);
    const most = each > 0 ? Math.floor(money / each) : 0;
    return [{ type: target, n: Math.max(0, Math.min(Math.round(w.n), most)) }];
  });
}

/** The player's standing orders after this turn's word: replaced, cancelled or added, at most MAX_ORDERS. */
export function placeOrders(state: GameState, next: GameState, orders: { type: ArmsType | WeaponKind; n: number }[], date: string): void {
  const arsenal = next.countries[next.player]?.arsenal;
  if (!arsenal || !orders.length) return;
  let list = standingOrders(arsenal.orders, state.date);
  for (const o of orders) {
    list = list.filter((x) => x.type !== o.type);
    if (o.n > 0) list.push({ type: o.type, n: o.n, built: 0, since: date });
  }
  arsenal.orders = list.slice(-MAX_ORDERS);
  if (!arsenal.orders.length) delete arsenal.orders;
}

/** What a turn's production of one kind brings: how many, at what level, and of which types (fractions until they join the stock). */
export interface Made {
  n: number;
  level: number;
  types?: Partial<Record<ArmsType, number>>;
}

/**
 * Production of a country over the turn: the arms money, split by the mix,
 * at the day's prices, slowed by shortages and by the enemy's strategic
 * bombing (`bombed`, the share of output it takes a year). Aircraft, ships
 * and tanks are built by the era's mix of types, the support type on top
 * (engine/forces.ts). The player's standing orders for a type or kind take
 * up to ORDER_SHARE of the money first; `filled` gets how many each order
 * was built this turn.
 */
export function production(
  state: Pick<GameState, "countries" | "player" | "research" | "date" | "politics" | "wars"> & Partial<Pick<GameState, "scenarioId">>,
  tag: string,
  years: number,
  options: { shortages?: ResourceType[]; coastal?: boolean; rich?: boolean; bombed?: number; filled?: number[] } = {},
): Partial<Record<WeaponKind, Made>> {
  const c = state.countries[tag];
  const e = c?.economy;
  if (!e || !c.arsenal) return {};
  const year = yearOf(state.date);
  const atWar = enemiesOf(state).has(tag);
  const money = Math.min(e.budget.army * (atWar ? PROCUREMENT.war : PROCUREMENT.peace), e.gdp * MAX_ARMS_SHARE);
  // The player's industrial research makes its factories more (or less) efficient than history's (engine/researchEffects.ts).
  // Heavy industry past its usual share has the steel and the plants at hand: the money buys more (engine/industry.ts).
  const yearly = (tag === state.player ? money * armsEfficiency(state) : money) * (options.bombed ? industryLeft(options.bombed) : 1) * heavyArms(e);
  if (!yearly) return {};
  // A planned economy pays its factories in its own money: weapons cost it less in dollars.
  const planned = tag === state.player ? state.politics?.laws?.economy === "planned" : c.domestic?.regime === "party";
  const price = planned ? 0.6 : 1;
  const mix = mixAt(year);
  const kinds = WEAPON_KINDS.filter((k) => buildLevel(state, tag, k, year, options.rich ?? true) > 0 && !(k === "ships" && options.coastal === false));
  const weights = kinds.map((k) => mix[k] * (k === "drones" && atWar ? 6 : 1));
  const total = weights.reduce((a, b) => a + b, 0);
  if (!total) return {};
  const short = new Set(options.shortages ?? []);
  const slowed = (kind: WeaponKind) => NEEDS[kind].filter((r) => short.has(r)).reduce((f) => f * 0.6, 1);
  const out: Partial<Record<WeaponKind, Made>> = {};
  const put = (kind: WeaponKind, n: number, types?: Partial<Record<ArmsType, number>>) => {
    if (!(n > 0)) return;
    const had = out[kind];
    out[kind] = { n: (had?.n ?? 0) + n, level: buildLevel(state, tag, kind, year, options.rich ?? true), ...(types || had?.types ? { types: addTypes(had?.types ?? {}, types ?? {}) } : {}) };
  };
  /** A kind's units split by the era's mix: the combat types, and the support type on top, out of the same money. */
  const byMix = (kind: TypedKind, units: number) => {
    const m = eraMix(kind, year);
    const support = SUPPORT[kind];
    const combat = units / (1 + m.support * relativeCost(support, year));
    const types: Partial<Record<ArmsType, number>> = {};
    // The shares are of the count; an average combat unit of the mix costs the kind's unit (engine/forces.ts relativeCost).
    for (const [t, share] of Object.entries(m.shares) as [ArmsType, number][]) types[t] = combat * share;
    if (m.support > 0) types[support] = combat * m.support;
    return types;
  };
  const unit = (kind: WeaponKind) => unitCost(kind, year, state.scenarioId) * price;

  // The player's orders first, up to their share of the money.
  const orders = tag === state.player ? standingOrders(c.arsenal.orders, state.date) : [];
  let spent = 0;
  if (orders.length) {
    const cost = (o: ArmsOrder) => {
      const kind = orderKind(o.type);
      if (!kinds.includes(kind)) return 0;
      const each = unit(kind) * (o.type in TYPE_KIND ? relativeCost(o.type as ArmsType, year) : 1);
      return Math.max(0, o.n - o.built) * each;
    };
    const needs = orders.map(cost);
    const want = needs.reduce((a, b) => a + b, 0);
    const budget = yearly * years * ORDER_SHARE;
    const k = want > budget ? budget / want : 1;
    spent = Math.min(want, budget);
    orders.forEach((o, i) => {
      if (!needs[i]) return;
      const kind = orderKind(o.type);
      const typed = o.type in TYPE_KIND;
      const each = unit(kind) * (typed ? relativeCost(o.type as ArmsType, year) : 1);
      const n = ((needs[i] * k) / each) * slowed(kind);
      const index = c.arsenal!.orders!.indexOf(o);
      if (options.filled && index >= 0) options.filled[index] = (options.filled[index] ?? 0) + n;
      if (typed) put(kind, n, { [o.type]: n });
      else put(kind, n, isTyped(kind) ? byMix(kind, n) : undefined);
    });
  }

  // The rest of the money by the era's mix.
  const rest = yearly * years - spent;
  kinds.forEach((kind, i) => {
    const n = ((rest * weights[i]) / total / unit(kind)) * slowed(kind);
    if (!(n > 0)) return;
    if (isTyped(kind)) {
      const types = byMix(kind, n);
      put(kind, typesTotal(types), types);
    } else put(kind, n);
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
    let n = (d.money * mix[k]) / total / unitCost(k, year, next.scenarioId);
    if (d.fromStock && giver?.stock[k]) n = Math.min(n, giver.stock[k]!.n * 0.3);
    if (n < 0.5) continue;
    const level = d.fromStock && giver?.stock[k] ? giver.stock[k]!.level : Math.max(1, buildLevel(next, d.from, k, year));
    // Given from stores, of the giver's types; bought new, of the era's mix (engine/forces.ts).
    const types = isTyped(k) ? roundTypes(d.fromStock && giver?.stock[k] ? scaleTypes(typesOf(giver.stock[k], k, year), round(n)) : splitByMix(k, round(n), { shares: eraMix(k, year).shares, support: 0 })) : undefined;
    out[k] = { n: round(n), level, ...(types && Object.keys(types).length ? { types } : {}) };
  }
  return out;
}

/**
 * How much of the arms given to a country at war reach it, 0–1: all of them
 * over a land border with the giver or with a country not at war with it;
 * else what the war at sea lets through its ports (`seaCut`, engine/forces.ts
 * seaCuts); none to a land with neither. A country at peace gets them all.
 */
export function routeShare(state: Pick<GameState, "regions" | "wars">, from: string, to: string, seaCut: number, neighbors: Record<string, string[]> | null, map: Record<string, MapRegion> | null): number {
  const live = state.wars.filter((w) => !w.truce);
  const enemies = new Set(live.flatMap((w) => (w.attackers.includes(to) ? w.defenders : w.defenders.includes(to) ? w.attackers : [])));
  if (!enemies.size || !neighbors) return 1;
  let coast = !map;
  for (const [id, r] of Object.entries(state.regions)) {
    if (r.controller !== to) continue;
    if (map?.[id]?.coastal) coast = true;
    for (const n of neighbors[id] ?? []) {
      const o = state.regions[n]?.controller;
      if (o && o !== to && (o === from || !enemies.has(o))) return 1;
    }
  }
  return coast ? Math.max(0, Math.min(1, 1 - seaCut)) : 0;
}

/**
 * A beaten army gives up its weapons: of each kind it keeps `keep(kind)`
 * (what escaped with it), the winner takes half of the rest at its level, and
 * the rest is destroyed. Mutates `next`.
 */
export function surrenderArms(next: GameState, from: string, to: string | undefined, keep: (kind: WeaponKind) => number, applied: AppliedChange[]): void {
  const arsenal = next.countries[from]?.arsenal;
  if (!arsenal) return;
  const year = yearOf(next.date);
  const winner = to ? next.countries[to]?.arsenal : undefined;
  for (const kind of WEAPON_KINDS) {
    const s = arsenal.stock[kind];
    if (!s?.n) continue;
    const gone = s.n * (1 - Math.max(0, Math.min(1, keep(kind))));
    if (gone <= 0) continue;
    const taken = round(gone / 2);
    if (to && winner && taken >= 1) {
      add(winner, kind, taken, s.level, year, isTyped(kind) ? scaleTypes(typesOf(s, kind, year), taken) : undefined);
      if (kind !== "rifles") applied.push({ kind: "captured", by: to, from, arms: kind, n: taken });
    }
    arsenal.stock[kind] = remove(s, kind, gone, year);
  }
}

/** Adds weapons to a stock, blending their levels; aircraft, ships and tanks of the types given (else of the era's mix). */
function add(arsenal: Arsenal, kind: WeaponKind, n: number, level: number, year: number, types?: Partial<Record<ArmsType, number>>): void {
  const s = arsenal.stock[kind];
  const total = (s?.n ?? 0) + n;
  if (total <= 0) return;
  const next: ArmsStock = { n: round(total), level: round1(((s?.level ?? level) * (s?.n ?? 0) + level * n) / total) };
  if (isTyped(kind)) next.types = roundTypes(addTypes(typesOf(s, kind, year), types ?? scaleTypes(eraMix(kind, year).shares, n)));
  arsenal.stock[kind] = next.types ? { ...next, n: typesTotal(next.types) } : next;
}

/** Takes weapons out of a stock (given away or captured), of its types in proportion. */
function remove(stock: ArmsStock, kind: WeaponKind, n: number, year: number): ArmsStock {
  const left = Math.max(0, stock.n - n);
  if (!isTyped(kind)) return { ...stock, n: round(left) };
  const types = roundTypes(scaleTypes(typesOf(stock, kind, year), left));
  return { ...stock, n: typesTotal(types), types };
}

/** The period's fighting, as the engine weighed it (engine/warLosses.ts): each country's weapons lost in it and the share of its army that fought. */
export interface ArmsExchange {
  arms: Map<string, Partial<Record<WeaponKind, number>>>;
  engaged: Map<string, number>;
}

/** How far the game master's weapons lost may exceed the engine's figure; and what it may report beyond it where the engine saw little fighting, a share of the engaged stock a month. */
const ARMS_SLACK = 3;
const ARMS_QUIET = 0.01;

/**
 * Moves every country's weapons through one turn: new ones are built,
 * old ones retire, wars wear them down — by the game master's word where
 * it gave one, else by the engine's own rule — and captured ones change
 * hands. Countries without weapons get them first. With the period's
 * `exchange`, the engine's figure is what the fighting cost each country
 * (a country at war with no fighting of its own loses a little at sea and
 * in the air), and the game master's word is kept within three times it.
 * Mutates `next`; what each country lost goes into `lostBy`, for the wars'
 * records.
 */
export function advanceArsenals(
  next: GameState,
  before: GameState,
  word: { losses: ArmsLoss[] },
  years: number,
  map: Record<string, MapRegion> | null,
  applied: AppliedChange[],
  deliveries: Delivery[] = [],
  lostBy?: Map<string, Partial<Record<WeaponKind, number>>>,
  exchange?: ArmsExchange,
): void {
  const seeded = seedArsenals(next, map);
  next.countries = seeded.countries;
  const accounts = map ? nationalAccounts(next, map) : null;
  const coast = coastalCountries(next, map);
  const wealth = wealthOf(next);
  const reported = new Map<string, { lost: number; capturedBy?: string; types: Partial<Record<ArmsType, number>> }>();
  for (const l of word.losses) {
    const key = `${l.country}:${l.kind}`;
    const had = reported.get(key) ?? { lost: 0, types: {} };
    had.lost += l.lost;
    if (l.type) had.types[l.type] = (had.types[l.type] ?? 0) + l.lost;
    if (l.capturedBy) had.capturedBy = l.capturedBy;
    reported.set(key, had);
  }
  const fighting = enemiesOf(next);
  const year0 = yearOf(next.date);
  // The enemy's strategic bombers slow each country's arms industry (engine/forces.ts).
  const bombed = bombing(before);
  const captured: { by: string; from: string; kind: WeaponKind; n: number; level: number; types?: Partial<Record<ArmsType, number>> }[] = [];

  for (const [tag, country] of Object.entries(next.countries)) {
    const arsenal = country.arsenal;
    if (!arsenal || !country.economy) continue;
    const filled: number[] = [];
    const made = production(next, tag, years, {
      shortages: accounts?.get(tag)?.shortages,
      coastal: coast ? coast.has(tag) : undefined,
      rich: wealth(tag) >= 0.6,
      bombed: bombed.get(tag),
      filled,
    });
    const engaged = exchange?.engaged.get(tag) ?? 0;
    const expected = !before.countries[tag]?.arsenal ? {} : !exchange ? expectedLosses(before, tag, years) : engaged > 0 ? (exchange.arms.get(tag) ?? {}) : expectedLosses(before, tag, years, true);
    const stock: Arsenal["stock"] = {};
    const madeOut: Arsenal["made"] = {};
    const lostOut: Arsenal["lost"] = {};
    for (const kind of WEAPON_KINDS) {
      const s = arsenal.stock[kind];
      const m = made[kind];
      if (!s && !m) continue;
      const old = s ? s.n * Math.max(0, 1 - RETIRE * years) : 0;
      const word = reported.get(`${tag}:${kind}`);
      // The game master's word, within three times what the fighting cost and a little beyond where the engine saw little of it.
      const said = word && exchange ? Math.min(word.lost, Math.max(ARMS_SLACK * (expected[kind] ?? 0), old * ARMS_QUIET * years * 12 * Math.max(0.05, engaged))) : word?.lost;
      const lost = Math.min(old, said ?? expected[kind] ?? 0);
      const kept = old - lost;
      const add = m?.n ?? 0;
      const n = kept + add;
      const level = n > 0 ? ((s?.level ?? m!.level) * kept + (m?.level ?? 0) * add) / n : (s?.level ?? m?.level ?? 1);
      if (isTyped(kind)) {
        // Old ones retire of every type alike; losses fall on the types the game master named, the rest on the most exposed (engine/forces.ts).
        const before = scaleTypes(typesOf(s, kind, year0), old);
        const { types: left, lost: gone } = loseTypes(before, lost, word?.types);
        const types = roundTypes(addTypes(left, m?.types ?? {}));
        if (word?.capturedBy && lost > 0) captured.push({ by: word.capturedBy, from: tag, kind, n: round(lost / 2), level: s?.level ?? 1, types: scaleTypes(gone, lost / 2) });
        if (typesTotal(types) > 0 || s) stock[kind] = { n: typesTotal(types), level: round1(Math.max(1, level)), types };
      } else {
        if (word?.capturedBy && lost > 0) captured.push({ by: word.capturedBy, from: tag, kind, n: round(lost / 2), level: s?.level ?? 1 });
        stock[kind] = { n: round(n), level: round1(Math.max(1, level)) };
      }
      if (add >= 0.5) madeOut[kind] = round(add);
      if (lost >= 0.5) lostOut[kind] = round(lost);
    }
    if (lostBy && Object.keys(lostOut).length) lostBy.set(tag, lostOut);
    // The bomb comes with a country's first test (engine/atom.ts); a save from before the atomic programmes keeps history's calendar.
    const nuclear = arsenal.nuclear || (!next.atom && tag !== next.player && (NUCLEAR_SINCE[tag] ?? Infinity) <= yearFraction(next.date));
    // Recruits train, the call-up adds new ones, and losses or demobilisation take men away.
    const men = advanceMen(menOf(before, before.countries[tag] ?? country), country.economy.troops, years * 12, year0, fighting.has(tag));
    // The player's orders count what was built for them; filled or lapsed ones go.
    const orders = tag === next.player ? standingOrders((arsenal.orders ?? []).map((o, i) => ({ ...o, built: Math.round((o.built + (filled[i] ?? 0)) * 10) / 10 })), next.date) : [];
    next.countries[tag] = {
      ...country,
      arsenal: {
        stock,
        ...(tag === next.player ? { made: madeOut, lost: lostOut } : {}),
        ...(nuclear ? { nuclear: true } : {}),
        men,
        ...(tag === next.player && arsenal.organisation ? { organisation: arsenal.organisation } : {}),
        ...(orders.length ? { orders } : {}),
      },
    };
  }

  // Captured weapons serve their new owner, at their old level.
  for (const c of captured) {
    const arsenal = next.countries[c.by]?.arsenal;
    if (!arsenal || c.n < 1) continue;
    add(arsenal, c.kind, c.n, c.level, year0, c.types);
    applied.push({ kind: "captured", by: c.by, from: c.from, arms: c.kind, n: c.n });
  }

  // Arms bought or given arrive; given ones leave the giver's stores.
  const year = yearOf(next.date);
  const got: Arsenal["got"] = {};
  for (const d of deliveries) {
    const to = next.countries[d.to]?.arsenal;
    if (!to || d.from === d.to) continue;
    for (const [kind, w] of Object.entries(delivered(next, d, year, coast ? coast.has(d.to) : true)) as [WeaponKind, ArmsStock][]) {
      add(to, kind, w.n, w.level, year, w.types);
      const giver = next.countries[d.from]?.arsenal;
      if (d.fromStock && giver?.stock[kind]) giver.stock[kind] = remove(giver.stock[kind]!, kind, w.n, year);
      if (d.to === next.player) got[kind] = (got[kind] ?? 0) + w.n;
    }
  }
  if (Object.keys(got).length && next.countries[next.player]?.arsenal) next.countries[next.player].arsenal!.got = got;
}

const KIND_EN: Record<WeaponKind, string> = { rifles: "rifles (thousands)", artillery: "guns", tanks: "armour", aircraft: "aircraft", ships: "ships", airDefence: "air-defence guns or launchers", drones: "drones" };
export const TYPE_EN: Record<ArmsType, string> = {
  fighter: "fighters",
  attack: "attack and tactical bombers",
  bomber: "strategic bombers",
  transport: "transport aircraft",
  capital: "capital ships and carriers",
  escort: "escorts",
  submarine: "submarines",
  landing: "landing ships and transports",
  light: "light tanks",
  medium: "medium tanks",
  heavy: "heavy tanks",
  mbt: "main battle tanks",
  ifv: "infantry fighting vehicles",
};

/** A country's weapons in one English line: "armour 3,300 (main battle tanks 3,200, light tanks 100; level 5.6), …; atomic weapons". */
export function arsenalLine(arsenal: Arsenal | undefined, year?: number): string {
  if (!arsenal) return "";
  const parts = (Object.entries(arsenal.stock) as [WeaponKind, ArmsStock][])
    .filter(([, s]) => s.n > 0)
    .map(([k, s]) => {
      const types = isTyped(k) && year !== undefined ? (Object.entries(typesOf(s, k, year)) as [ArmsType, number][]).filter(([, n]) => n > 0) : [];
      const split = types.length ? `${types.map(([t, n]) => `${TYPE_EN[t]} ${n.toLocaleString("en-US")}`).join(", ")}; ` : "";
      return `${KIND_EN[k]} ${s.n.toLocaleString("en-US")} (${split}level ${s.level})`;
    });
  if (arsenal.nuclear) parts.push("atomic weapons");
  return parts.join(", ");
}

/** The player's orders to industry in one English line: "landing ships and transports 120 (built 35 since 1953-06-16)". */
export function ordersLine(orders: ArmsOrder[] | undefined): string {
  return (orders ?? []).map((o) => `${o.type in TYPE_KIND ? TYPE_EN[o.type as ArmsType] : KIND_EN[o.type as WeaponKind]} ${o.n} (built ${Math.floor(o.built)} since ${o.since})`).join("; ");
}

/**
 * The weapons the game master needs for the turn: the player's, with what
 * it built and lost last turn; the arms of every side in
 * the player's wars; and the balance of strength in every war.
 */
export function describeArms(state: GameState): string[] {
  const player = state.countries[state.player];
  const lines: string[] = ["", "ARMS (rifles in thousands, the rest in pieces; technology level 1 = the Great War … 6 = today; the engine builds them from the army budget and wears them down in war):"];
  if (player?.arsenal) {
    lines.push(`- ${state.player} (the player): ${arsenalLine(player.arsenal, yearOf(state.date)) || "none"}`);
    const orders = ordersLine(standingOrders(player.arsenal.orders, state.date));
    if (orders) lines.push(`  ordered from industry (built first from the arms money): ${orders}`);
    const made = Object.entries(player.arsenal.made ?? {}).map(([k, n]) => `${KIND_EN[k as WeaponKind]} +${n}`);
    const lost = Object.entries(player.arsenal.lost ?? {}).map(([k, n]) => `${KIND_EN[k as WeaponKind]} −${n}`);
    if (made.length || lost.length) lines.push(`  last turn: built ${made.join(", ") || "nothing"}; lost ${lost.join(", ") || "nothing"}`);
    const men = menOf(state, player);
    if (menTotal(men) > 0) lines.push(`  soldiers by training (thousands): ${Math.round(men.pro)} career, ${Math.round(men.trained)} trained conscripts, ${Math.round(men.recruits)} recruits still in training`);
  }
  const enemies = enemiesOf(state);
  const shown = new Set([state.player]);
  for (const tag of [...(enemies.get(state.player) ?? [])]) {
    if (shown.has(tag)) continue;
    shown.add(tag);
    const line = arsenalLine(state.countries[tag]?.arsenal, yearOf(state.date));
    if (line) lines.push(`- ${tag} (at war with the player): ${line}`);
  }
  const balance = state.wars
    .filter((w) => !w.truce)
    .map((w) => {
      const s = splitStrength(state, w);
      return `- ${typeof w.name === "string" ? w.name : w.name.en}: attackers ${Math.round(s.attackers)} vs defenders ${Math.round(s.defenders)}`;
    });
  if (balance.length) lines.push("STRENGTH IN EACH WAR (soldiers by their training and weapons by their level, in thousand-soldier equivalents, a member's split between the wars it fights as under WARS; battles should reflect it):", ...balance);
  return lines.length > 2 ? lines : [];
}

/** What the player's army spends on new weapons a year now, $bn. */
export function procurement(state: Pick<GameState, "countries" | "player" | "wars">): { yearly: number; atWar: boolean } {
  const e = state.countries[state.player]?.economy;
  const atWar = enemiesOf(state).has(state.player);
  if (!e) return { yearly: 0, atWar };
  return { yearly: Math.min(e.budget.army * (atWar ? PROCUREMENT.war : PROCUREMENT.peace), e.gdp * MAX_ARMS_SHARE), atWar };
}

/** The resources a kind is built from. */
export const needsOf = (kind: WeaponKind): ResourceType[] => NEEDS[kind];

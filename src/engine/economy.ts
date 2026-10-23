import { yearOf } from "./calendar";
import { peopleIn } from "./population";
import { programmeShift } from "./programmes";
import { crisisLimits, interestOf } from "./crises";
import { callUpFactor } from "./laws";
import { BEHIND_CALL_UP, BEHIND_TAKES, countsFor, heldBehind } from "./occupation";
import { activeResources, linearOutput, RESOURCE_TYPES, type ResourceType } from "./resources";
import type { Budget, Economy, EconomyFigures, GameState, MapRegion, RegionState, ScenarioId, TimeStep } from "./types";
import { unitsPerPoint } from "./units";

/**
 * The economy of every country: GDP, budget, debt, reserves, prices, jobs,
 * the army, and the strategic resources it produces, needs, stores and
 * trades. Money is in billions of US dollars of the day. The model proposes
 * changes each turn (see `EconomyChange`); the engine limits them, keeps the
 * books (deficits add to debt, trade moves reserves, a cut-off empties the
 * stores) and grows GDP. Start values come from each province's income today
 * scaled back to the date, with hand-set figures for the main countries.
 */

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number, digits = 1) => Math.round(value * 10 ** digits) / 10 ** digits;
/**
 * Money in $bn kept to six significant figures: a fixed number of decimals
 * froze small economies, whose monthly growth was smaller than the last digit,
 * and gave the small states of 1914 no social budget at all.
 */
export const money = (value: number) => (value === 0 || !Number.isFinite(value) ? 0 : Number(value.toPrecision(6)));

/** Years in one turn. */
export const STEP_YEARS: Record<TimeStep, number> = { week: 7 / 365, month: 1 / 12, quarter: 0.25, half: 0.5, year: 1 };

interface Era {
  /** GDP per person in dollars of the day, from today's (2019) income of the province. */
  perCapita: (income: number) => number;
  /** Tax take as a share of GDP, for rich and poor countries. */
  revenue: [number, number];
  /** Social spending as a share of GDP, for rich and poor countries. */
  social: [number, number];
  industry: number;
  army: number;
  /** Soldiers per person in peacetime. */
  troops: number;
  /** Most of the population that can be put in uniform. */
  mobilise: number;
  debt: number;
  reserves: number;
  inflation: number;
  unemployment: number;
  /** Growth a peaceful economy drifts back to, % a year. */
  trend: number;
  /** How fast dollars lose value, % a year: GDP is counted in dollars of the day. */
  dollar: number;
  /** World market value of each resource as a share of world GDP: its world output at the day's price. */
  markets: Record<ResourceType, number>;
  /**
   * How a country's use of resources follows its income: use per person
   * grows with income per person to this power (1: in step with GDP, 0: the
   * same for everyone). Poor countries burn more per dollar than rich ones.
   */
  use: number;
}

const pre1914 = (income: number) => clamp(0.5 * (income / 2000) ** -0.35, 0.1, 0.6);

const ERAS: Record<ScenarioId, Era> = {
  "1914": {
    perCapita: (income) => income * pre1914(income) * 0.04,
    revenue: [0.1, 0.06],
    social: [0.015, 0.005],
    industry: 0.01,
    army: 0.035,
    troops: 0.007,
    mobilise: 0.12,
    debt: 0.4,
    reserves: 0.05,
    inflation: 1,
    unemployment: 5,
    trend: 2,
    dollar: 1,
    markets: { oil: 0.0021, gas: 0.0004, coal: 0.018, iron: 0.0035, copper: 0.0018, gold: 0.0025, nickel: 0.00014, tin: 0.0007, bauxite: 0.000015, rubber: 0.0012, uranium: 0 },
    use: 1,
  },
  "1939": {
    perCapita: (income) => income * pre1914(income) * 1.35 * 0.053,
    revenue: [0.22, 0.1],
    social: [0.05, 0.01],
    industry: 0.03,
    army: 0.04,
    troops: 0.008,
    mobilise: 0.15,
    debt: 0.5,
    reserves: 0.05,
    inflation: 2,
    unemployment: 8,
    trend: 3,
    dollar: 2,
    markets: { oil: 0.005, gas: 0.001, coal: 0.012, iron: 0.002, copper: 0.0013, gold: 0.0032, nickel: 0.00022, tin: 0.0005, bauxite: 0.00005, rubber: 0.0009, uranium: 0 },
    use: 1,
  },
  "1950": {
    // Dollars of 1950: the US at about $2,000 a head, Western Europe far behind it (PER_CAPITA).
    perCapita: (income) => income * 0.028,
    revenue: [0.25, 0.1],
    social: [0.08, 0.02],
    industry: 0.04,
    army: 0.05,
    troops: 0.008,
    mobilise: 0.15,
    debt: 0.6,
    reserves: 0.08,
    inflation: 3,
    unemployment: 4,
    trend: 5,
    dollar: 2.5,
    markets: { oil: 0.008, gas: 0.0008, coal: 0.0105, iron: 0.0017, copper: 0.001, gold: 0.0009, nickel: 0.00014, tin: 0.0003, bauxite: 0.00003, rubber: 0.0018, uranium: 0.0001 },
    use: 1,
  },
  "1964": {
    perCapita: (income) => income * 0.055,
    revenue: [0.28, 0.12],
    social: [0.1, 0.03],
    industry: 0.04,
    army: 0.06,
    troops: 0.008,
    mobilise: 0.15,
    debt: 0.45,
    reserves: 0.08,
    inflation: 3,
    unemployment: 4,
    trend: 5,
    dollar: 2,
    markets: { oil: 0.0087, gas: 0.0026, coal: 0.0094, iron: 0.0024, copper: 0.0017, gold: 0.00064, nickel: 0.0003, tin: 0.0003, bauxite: 0.00012, rubber: 0.001, uranium: 0.0002 },
    use: 0.9,
  },
  "1991": {
    perCapita: (income) => income * (0.15 + 0.3 * Math.min(1, income / 30000)),
    revenue: [0.33, 0.18],
    social: [0.18, 0.04],
    industry: 0.04,
    army: 0.03,
    troops: 0.006,
    mobilise: 0.12,
    debt: 0.5,
    reserves: 0.08,
    inflation: 5,
    unemployment: 7,
    trend: 3,
    dollar: 3,
    markets: { oil: 0.02, gas: 0.008, coal: 0.0075, iron: 0.0012, copper: 0.00085, gold: 0.001, nickel: 0.0003, tin: 0.00004, bauxite: 0.00011, rubber: 0.0002, uranium: 0.0001 },
    use: 0.8,
  },
  "1999": {
    perCapita: (income) => income * (0.2 + 0.35 * Math.min(1, income / 40000)),
    revenue: [0.36, 0.2],
    social: [0.2, 0.05],
    industry: 0.04,
    army: 0.022,
    troops: 0.005,
    mobilise: 0.1,
    debt: 0.6,
    reserves: 0.12,
    inflation: 4,
    unemployment: 8,
    trend: 3,
    dollar: 2.5,
    markets: { oil: 0.014, gas: 0.005, coal: 0.004, iron: 0.0008, copper: 0.0006, gold: 0.0007, nickel: 0.0002, tin: 0.00004, bauxite: 0.0001, rubber: 0.0003, uranium: 0.00003 },
    use: 0.75,
  },
  "2014": {
    perCapita: (income) => income * 0.95,
    revenue: [0.35, 0.2],
    social: [0.2, 0.05],
    industry: 0.04,
    army: 0.018,
    troops: 0.004,
    mobilise: 0.1,
    debt: 0.65,
    reserves: 0.15,
    inflation: 3,
    unemployment: 7,
    trend: 3,
    dollar: 1,
    markets: { oil: 0.035, gas: 0.012, coal: 0.008, iron: 0.0035, copper: 0.0016, gold: 0.0016, nickel: 0.0004, tin: 0.000075, bauxite: 0.00012, rubber: 0.0004, uranium: 0.00007 },
    use: 0.7,
  },
  "2022": {
    perCapita: (income) => income * 1.05 * 1.15,
    revenue: [0.35, 0.2],
    social: [0.2, 0.05],
    industry: 0.04,
    army: 0.02,
    troops: 0.004,
    mobilise: 0.1,
    debt: 0.7,
    reserves: 0.15,
    inflation: 7,
    unemployment: 6,
    trend: 2.5,
    dollar: 4,
    markets: { oil: 0.03, gas: 0.015, coal: 0.01, iron: 0.004, copper: 0.0019, gold: 0.0017, nickel: 0.0006, tin: 0.00009, bauxite: 0.00016, rubber: 0.00022, uranium: 0.00006 },
    use: 0.7,
  },
};

/**
 * Countries whose growth since the date makes today's income a poor guide:
 * GDP per person in dollars of the day, by modern country (Natural Earth
 * adm0_a3).
 */
const PER_CAPITA: Record<string, Partial<Record<ScenarioId, number>>> = {
  // Before the hryvnia, rouble and lira fell in 2014–2015.
  BLR: { "2014": 7900, "1950": 400, "1964": 800, "1999": 1200 },
  KAZ: { "2014": 13600, "1950": 350, "1964": 700, "1999": 1100 },
  TUR: { "2014": 12500, "1950": 170, "1964": 300 },
  CHN: { "1914": 25, "1939": 30, "1991": 330, "1950": 50, "1964": 85, "1999": 870 },
  TWN: { "1914": 40, "1939": 70, "1991": 9000, "1950": 90, "1964": 180, "1999": 13000 },
  JPN: { "1914": 60, "1939": 160, "1991": 29000, "1950": 150, "1964": 850, "1999": 34000 },
  KOR: { "1914": 30, "1939": 50, "1991": 7500, "1950": 70, "1964": 110, "1999": 9600 },
  PRK: { "1914": 30, "1939": 50, "1991": 1000, "1950": 60, "1964": 150, "1999": 450 },
  IND: { "1991": 310, "1950": 60, "1964": 100 },
  PAK: { "1991": 400, "1950": 70, "1964": 90 },
  BGD: { "1991": 280, "1950": 50, "1964": 70 },
  IDN: { "1914": 30, "1939": 40, "1991": 600, "1950": 60, "1964": 70, "1999": 680 },
  VNM: { "1914": 25, "1939": 30, "1991": 140, "1950": 50, "1964": 90, "1999": 370 },
  THA: { "1991": 1700, "1950": 80, "1964": 120 },
  MYS: { "1991": 2700, "1950": 300, "1964": 300 },
  DEU: { "1914": 230, "1991": 23000, "1950": 450, "1964": 1800 },
  AUT: { "1991": 22000, "1950": 380, "1964": 1200 },
  ITA: { "1991": 21000, "1950": 330, "1964": 1100 },
  BRA: { "1991": 3000, "2014": 12100, "1950": 230, "1964": 260, "1999": 3400 },
  RUS: { "1914": 100, "1939": 220, "1991": 3500, "2014": 15500, "1950": 700, "1964": 1300, "1999": 1350 },
  UKR: { "1914": 70, "1939": 120, "1991": 1500, "2014": 4000, "1950": 500, "1964": 1000, "1999": 640 },
  SAU: { "1914": 15, "1939": 20, "1950": 200, "1964": 450 },
  ARE: { "1914": 15, "1939": 20 },
  QAT: { "1914": 15, "1939": 20 },
  KWT: { "1914": 15, "1939": 20, "1991": 8000, "1950": 400, "1964": 3500 },
  BHR: { "1914": 15, "1939": 25 },
  OMN: { "1914": 15, "1939": 20 },
  // The Cold War dates: Europe and Japan still far behind America, the East at its own (overvalued) rates; 1999 after the crises in Asia, Russia and Brazil.
  PHL: { "1950": 140, "1964": 170 },
  MMR: { "1950": 50, "1964": 70, "1999": 200 },
  LKA: { "1950": 120, "1964": 140 },
  GBR: { "1950": 720, "1964": 1750 },
  FRA: { "1950": 650, "1964": 1900 },
  ESP: { "1950": 250, "1964": 600 },
  PRT: { "1950": 220, "1964": 400 },
  GRC: { "1950": 210, "1964": 650 },
  NLD: { "1950": 500, "1964": 1500 },
  BEL: { "1950": 750, "1964": 1700 },
  SWE: { "1950": 950, "1964": 2600 },
  CHE: { "1950": 1000, "1964": 2500 },
  NOR: { "1950": 750, "1964": 2000 },
  DNK: { "1950": 800, "1964": 2100 },
  FIN: { "1950": 550, "1964": 1700 },
  IRL: { "1950": 450, "1964": 900 },
  CAN: { "1950": 1400, "1964": 2600 },
  AUS: { "1950": 900, "1964": 2000 },
  NZL: { "1950": 1100, "1964": 2000 },
  ARG: { "1950": 460, "1964": 900, "1999": 7700 },
  URY: { "1950": 450, "1964": 700 },
  VEN: { "1950": 520, "1964": 900, "1999": 4100 },
  CHL: { "1950": 300, "1964": 600 },
  MEX: { "1950": 300, "1964": 450, "1999": 5000 },
  COL: { "1950": 250, "1964": 300 },
  PER: { "1950": 170, "1964": 300 },
  CUB: { "1950": 300, "1964": 500 },
  ISR: { "1950": 450, "1964": 1200 },
  ZAF: { "1950": 280, "1964": 550 },
  EGY: { "1950": 120, "1964": 160 },
  IRN: { "1950": 120, "1964": 230 },
  IRQ: { "1950": 120, "1964": 250, "1999": 900 },
  LBY: { "1950": 40, "1964": 600 },
  UZB: { "1950": 250, "1964": 500 },
  GEO: { "1950": 350, "1964": 700 },
  ARM: { "1950": 300, "1964": 650 },
  AZE: { "1950": 350, "1964": 650 },
  EST: { "1950": 550, "1964": 1100 },
  LVA: { "1950": 550, "1964": 1100 },
  LTU: { "1950": 450, "1964": 1000 },
  MDA: { "1950": 300, "1964": 600 },
  KGZ: { "1950": 220, "1964": 450 },
  TJK: { "1950": 200, "1964": 400 },
  TKM: { "1950": 250, "1964": 500 },
  POL: { "1950": 350, "1964": 800 },
  CZE: { "1950": 650, "1964": 1300 },
  SVK: { "1950": 400, "1964": 1000 },
  HUN: { "1950": 400, "1964": 900 },
  ROU: { "1950": 250, "1964": 600 },
  BGR: { "1950": 250, "1964": 600 },
  ALB: { "1950": 120, "1964": 250 },
  SRB: { "1950": 220, "1964": 450, "1999": 1500 },
  HRV: { "1950": 300, "1964": 600 },
  SVN: { "1950": 450, "1964": 900 },
  BIH: { "1950": 160, "1964": 350 },
  MKD: { "1950": 150, "1964": 350 },
  MNE: { "1950": 150, "1964": 350, "1999": 1700 },
  KOS: { "1950": 100, "1964": 200, "1999": 400 },
};

/** What a scenario sets by hand for a country on its start date; shares are of GDP. */
interface EconomySeed {
  gdp?: number;
  troops?: number;
  army?: number;
  revenue?: number;
  debt?: number;
  inflation?: number;
  unemployment?: number;
  growth?: number;
}

export const ECONOMY_SEEDS: Record<ScenarioId, Record<string, EconomySeed>> = {
  "1914": {
    germany: { troops: 800, army: 0.04, debt: 0.45, growth: 3 },
    russia: { troops: 1400, army: 0.05, debt: 0.45, growth: 4 },
    france: { troops: 900, army: 0.045, revenue: 0.09, debt: 0.9, growth: 2 },
    uk: { troops: 400, army: 0.035, debt: 0.3, growth: 2 },
    china: { troops: 500, army: 0.03, debt: 0.3, growth: 1 },
    "austria-hungary": { troops: 450, army: 0.03, debt: 0.6, growth: 2 },
    italy: { troops: 300, army: 0.035, debt: 0.8, growth: 2 },
    ottoman: { troops: 300, army: 0.05, debt: 0.6, growth: 1 },
    usa: { troops: 100, army: 0.007, debt: 0.03, growth: 3 },
    japan: { troops: 250, army: 0.06, debt: 0.6, growth: 3 },
    serbia: { troops: 200, army: 0.06, debt: 0.5, growth: 2 },
  },
  "1939": {
    germany: { troops: 2700, army: 0.23, revenue: 0.3, debt: 0.4, unemployment: 0.5, growth: 5 },
    ussr: { troops: 2000, army: 0.15, revenue: 0.4, debt: 0.1, unemployment: 0, growth: 4 },
    uk: { troops: 900, army: 0.12, revenue: 0.15, debt: 1.5, unemployment: 6, growth: 3 },
    france: { troops: 2700, army: 0.09, revenue: 0.15, debt: 1.3, unemployment: 3, growth: 2 },
    poland: { troops: 1300, army: 0.08, debt: 0.3, growth: 3 },
    italy: { troops: 1600, army: 0.1, debt: 1, growth: 2 },
    japan: { troops: 1700, army: 0.22, debt: 0.6, inflation: 6, growth: 4 },
    usa: { troops: 330, army: 0.015, debt: 0.45, unemployment: 17, growth: 8 },
    china: { troops: 2500, army: 0.25, debt: 0.3, inflation: 30, growth: -3 },
  },
  "1950": {
    usa: { troops: 1460, army: 0.05, debt: 0.9, unemployment: 5.3, inflation: 1, growth: 8 },
    ussr: { troops: 2900, army: 0.17, revenue: 0.4, debt: 0.1, unemployment: 0, growth: 8 },
    uk: { troops: 690, army: 0.066, revenue: 0.33, debt: 1.5, unemployment: 1.5, growth: 3 },
    france: { troops: 600, army: 0.06, debt: 0.4, inflation: 10, growth: 6 },
    china: { troops: 5000, army: 0.08, debt: 0.05, inflation: 20, growth: 15 },
    taiwan: { troops: 600, army: 0.15, inflation: 50, growth: 5 },
    "north-korea": { troops: 135, army: 0.2, growth: 5 },
    "south-korea": { troops: 98, army: 0.05, inflation: 40, growth: 0 },
    japan: { troops: 10, army: 0.002, debt: 0.2, inflation: 15, growth: 11 },
    "west-germany": { troops: 10, army: 0, debt: 0.2, unemployment: 10, growth: 16 },
    "east-germany": { troops: 50, army: 0.02, growth: 12 },
    yugoslavia: { troops: 400, army: 0.15, growth: 2 },
    india: { troops: 400, army: 0.02, growth: 3 },
    "viet-minh": { troops: 120, army: 0.3, growth: 0 },
    vietnam: { troops: 50, army: 0.08, growth: 0 },
  },
  "1964": {
    usa: { troops: 2690, army: 0.085, debt: 0.47, unemployment: 5.2, inflation: 1.3, growth: 5.8 },
    ussr: { troops: 3300, army: 0.12, revenue: 0.4, debt: 0.05, unemployment: 0, growth: 5 },
    china: { troops: 2900, army: 0.06, debt: 0.02, growth: 15 },
    uk: { troops: 425, army: 0.06, debt: 0.8, unemployment: 1.7, growth: 5 },
    france: { troops: 600, army: 0.05, debt: 0.3, growth: 6 },
    "west-germany": { troops: 430, army: 0.045, debt: 0.2, unemployment: 0.7, growth: 6.7 },
    "east-germany": { troops: 120, army: 0.04, growth: 4 },
    japan: { troops: 246, army: 0.01, growth: 11 },
    "north-vietnam": { troops: 250, army: 0.15, growth: 5 },
    "south-vietnam": { troops: 514, army: 0.12, inflation: 5, growth: 3 },
    "viet-cong": { troops: 100, army: 0.3, growth: 0 },
    laos: { troops: 60, army: 0.15 },
    "pathet-lao": { troops: 20, army: 0.3 },
    india: { troops: 870, army: 0.035, growth: 7 },
    pakistan: { troops: 250, army: 0.045 },
    indonesia: { troops: 350, army: 0.06, inflation: 110, growth: 3 },
    "south-korea": { troops: 600, army: 0.05, inflation: 30, growth: 9 },
    "north-korea": { troops: 370, army: 0.15 },
    taiwan: { troops: 600, army: 0.09, growth: 12 },
    israel: { troops: 50, army: 0.08 },
    egypt: { troops: 180, army: 0.09 },
    cuba: { troops: 100, army: 0.06 },
  },
  "1991": {
    ussr: { gdp: 1000, troops: 3400, army: 0.15, debt: 0.4, inflation: 90, unemployment: 2, growth: -5 },
    usa: { troops: 2000, army: 0.047, debt: 0.6, unemployment: 6.8, inflation: 4.2, growth: 0 },
    china: { troops: 3000, army: 0.03, debt: 0.05, inflation: 3, growth: 9 },
    japan: { troops: 240, army: 0.01, debt: 0.6, unemployment: 2.1, growth: 3.4 },
    germany: { troops: 450, army: 0.02, debt: 0.4, unemployment: 6, growth: 5 },
    uk: { troops: 300, army: 0.04, debt: 0.33, unemployment: 8.5, inflation: 7.5, growth: -1 },
    france: { troops: 450, army: 0.035, debt: 0.36, unemployment: 9, growth: 1 },
    yugoslavia: { troops: 180, army: 0.06, inflation: 120, growth: -10 },
    india: { troops: 1300, army: 0.03, debt: 0.5, inflation: 13, growth: 1 },
    iraq: { troops: 400, army: 0.2, inflation: 50, growth: -30 },
  },
  "1999": {
    yugoslavia: { troops: 110, army: 0.06, inflation: 45, unemployment: 27, growth: 2 },
    usa: { troops: 1385, army: 0.03, debt: 0.62, inflation: 2.2, unemployment: 4.2, growth: 4.5 },
    russia: { troops: 1200, army: 0.03, debt: 0.9, inflation: 85, unemployment: 13, growth: 1 },
    china: { troops: 2500, army: 0.02, inflation: -1.4, growth: 7.6 },
    germany: { troops: 330, army: 0.015, debt: 0.61, unemployment: 10.5, inflation: 0.6, growth: 2 },
    uk: { troops: 212, army: 0.025, debt: 0.43, unemployment: 6, growth: 3 },
    france: { troops: 317, army: 0.027, debt: 0.59, unemployment: 11.5, growth: 3.4 },
    italy: { troops: 265, army: 0.02, debt: 1.13, unemployment: 11.3, growth: 1.6 },
    japan: { troops: 236, army: 0.01, debt: 1.3, inflation: -0.3, growth: 0 },
    india: { troops: 1175, army: 0.03, debt: 0.7, inflation: 5, growth: 6 },
    pakistan: { troops: 590, army: 0.05, growth: 4 },
    ukraine: { troops: 310, army: 0.03, inflation: 22, growth: -0.2 },
    turkey: { troops: 640, army: 0.045, inflation: 65 },
    greece: { troops: 165, army: 0.048 },
    israel: { troops: 175, army: 0.085 },
    iraq: { troops: 430, army: 0.1, inflation: 130, growth: 0 },
    "north-korea": { troops: 1080, army: 0.25, growth: 0 },
    "south-korea": { troops: 690, army: 0.028, growth: 10 },
    taiwan: { troops: 376, army: 0.03 },
    indonesia: { inflation: 20, growth: 0.8 },
    brazil: { inflation: 8, growth: 0.5 },
    argentina: { growth: -3.4 },
    croatia: { troops: 60, army: 0.05 },
    "bosnia-and-herzegovina": { troops: 40, army: 0.05 },
    albania: { troops: 50, army: 0.03 },
    macedonia: { troops: 16, army: 0.025 },
    kosovo: { troops: 15, army: 0.3 },
    montenegro: { troops: 15, army: 0.05 },
  },
  "2014": {
    ukraine: { troops: 130, army: 0.01, debt: 0.4, inflation: 0.5, unemployment: 7.3, growth: 0 },
    russia: { troops: 845, army: 0.035, debt: 0.13, inflation: 6.5, unemployment: 5.5, growth: 1.3 },
    usa: { troops: 1400, army: 0.035, debt: 1.03, inflation: 1.5, unemployment: 6.7, growth: 2 },
    china: { troops: 2300, army: 0.02, debt: 0.4, inflation: 2.5, unemployment: 4.1, growth: 7.5 },
    germany: { troops: 185, army: 0.012, debt: 0.77, inflation: 1.4, unemployment: 5, growth: 0.5 },
    uk: { troops: 160, army: 0.023, debt: 0.85, inflation: 2.5, unemployment: 7.2, growth: 2 },
    france: { troops: 220, army: 0.022, debt: 0.93, inflation: 1, unemployment: 10, growth: 0.5 },
    poland: { troops: 100, army: 0.018, debt: 0.56, inflation: 0.9, unemployment: 10, growth: 1.7 },
    belarus: { troops: 48, army: 0.012, debt: 0.4, inflation: 18, growth: 1 },
    turkey: { troops: 400, army: 0.022, debt: 0.36, inflation: 7.5, growth: 4 },
    japan: { troops: 247, army: 0.01, debt: 2.4, inflation: 0.4, growth: 1.5 },
    india: { troops: 1325, army: 0.025, debt: 0.67, inflation: 9.5, growth: 6 },
    iran: { troops: 520, army: 0.025, inflation: 35, growth: -1 },
    "north-korea": { troops: 1190, army: 0.2, growth: 1 },
    "south-korea": { troops: 650, army: 0.026, debt: 0.36, growth: 3 },
    "saudi-arabia": { troops: 230, army: 0.09, debt: 0.03, growth: 3 },
  },
  "2022": {
    russia: { troops: 1000, army: 0.04, debt: 0.17, inflation: 9, unemployment: 4, growth: 2 },
    ukraine: { troops: 250, army: 0.04, debt: 0.5, inflation: 10, unemployment: 9, growth: 3 },
    usa: { troops: 1350, army: 0.035, debt: 1.2, inflation: 7.5, unemployment: 3.8, growth: 2 },
    china: { troops: 2000, army: 0.017, debt: 0.75, inflation: 2, unemployment: 5.5, growth: 4 },
    germany: { troops: 183, army: 0.013, debt: 0.67, inflation: 7, unemployment: 3, growth: 1.5 },
    uk: { troops: 150, army: 0.022, debt: 1, inflation: 8, unemployment: 3.8, growth: 3 },
    france: { troops: 205, army: 0.019, debt: 1.12, inflation: 5, unemployment: 7.3, growth: 2.5 },
    poland: { troops: 115, army: 0.022, debt: 0.5, inflation: 13, growth: 5 },
    belarus: { troops: 48, army: 0.012, debt: 0.4, inflation: 10 },
    turkey: { troops: 355, army: 0.018, debt: 0.4, inflation: 70, growth: 5 },
    india: { troops: 1450, army: 0.025, debt: 0.84, inflation: 6.7, growth: 7 },
    japan: { troops: 247, army: 0.01, debt: 2.6, inflation: 2, growth: 1 },
    iran: { troops: 610, army: 0.025, inflation: 40, growth: 3 },
    israel: { troops: 170, army: 0.045, debt: 0.6, growth: 5 },
    "north-korea": { troops: 1280, army: 0.2, growth: -1 },
    "south-korea": { troops: 500, army: 0.027, debt: 0.5, growth: 2.6 },
    "saudi-arabia": { troops: 250, army: 0.07, debt: 0.25, growth: 7 },
    taiwan: { troops: 170, army: 0.024, debt: 0.3, growth: 3 },
  },
};

/** GDP per person of a province on a date, in dollars of the day. */
export function provinceIncome(region: Pick<MapRegion, "inc" | "adm0">, era: ScenarioId): number {
  const fixed = PER_CAPITA[region.adm0]?.[era];
  if (fixed !== undefined) return fixed;
  return ERAS[era].perCapita(region.inc ?? 3000);
}

/** The share of GDP a government of the era spent on its people, in a rich country or a poor one. */
export const socialNorm = (era: ScenarioId, rich: boolean) => ERAS[era].social[rich ? 0 : 1];

/** Today's (2019) income per person above which a country counts as rich, as the starting budget judges it. */
export const RICH_INCOME = 20000;

/** Total spending a year. */
export const spending =(e: Economy) => e.budget.army + e.budget.industry + e.budget.social + e.budget.other;
/** Revenue minus spending: negative is a deficit. */
export const balance = (e: Economy) => e.budget.revenue - spending(e);

/** A country's starting economy, from the provinces it owns and the scenario's figures. */
export function startingEconomy(provinces: MapRegion[], era: ScenarioId, seed: EconomySeed = {}): Economy {
  const e = ERAS[era];
  let people = 0;
  let gdp = 0;
  let richness = 0;
  for (const p of provinces) {
    const pop = p.pop ?? 0;
    people += pop;
    gdp += (pop * 1000 * provinceIncome(p, era)) / 1e9;
    richness += pop * (p.inc ?? 3000);
  }
  gdp = seed.gdp ?? Math.max(0.05, gdp);
  // Rich countries tax and spend more on their people.
  const rich = people > 0 && richness / people >= RICH_INCOME;
  const revenue = gdp * (seed.revenue ?? e.revenue[rich ? 0 : 1]);
  const army = gdp * (seed.army ?? e.army);
  const social = gdp * e.social[rich ? 0 : 1];
  const industry = gdp * e.industry;
  // The rest of the budget runs a small deficit, as most governments did.
  const other = Math.max(revenue * 0.15, revenue * 1.03 - army - social - industry);
  return {
    gdp: money(gdp),
    growth: seed.growth ?? e.trend,
    inflation: seed.inflation ?? e.inflation,
    unemployment: seed.unemployment ?? e.unemployment,
    budget: { revenue: money(revenue), army: money(army), industry: money(industry), social: money(social), other: money(other) },
    debt: money(gdp * (seed.debt ?? e.debt)),
    reserves: money(gdp * e.reserves),
    troops: Math.round(seed.troops ?? people * e.troops),
    tradeCut: 0,
    stocks: {},
  };
}

/** Gives every country without an economy one, from the land it owns now (new games and older saves). */
export function seedEconomies<T extends Pick<GameState, "countries" | "regions" | "scenarioId">>(state: T, regions: Record<string, MapRegion>): T {
  const missing = Object.keys(state.countries).filter((tag) => !state.countries[tag].economy);
  if (!missing.length) return state;
  const owned = provincesByOwner(state.regions, regions);
  const countries = { ...state.countries };
  for (const tag of missing) {
    countries[tag] = { ...countries[tag], economy: startingEconomy(owned.get(tag) ?? [], state.scenarioId, ECONOMY_SEEDS[state.scenarioId][tag]) };
  }
  return { ...state, countries };
}

/** Share of a province's output its owner keeps under someone else's occupation, and the share the occupier takes. */
const OWNER_UNDER_OCCUPATION = 0.3;
const OCCUPIER_TAKES = 0.4;

/**
 * Who draws on a province's output: its owner in full; under occupation on a
 * front a part to the owner and a part to the occupier; once the front has
 * left it behind, the captor alone, less than from its own land
 * (engine/occupation.ts). The rest is lost.
 */
export function outputShares(r: RegionState): [string, number][] {
  if (r.controller === r.owner) return [[r.owner, 1]];
  if (heldBehind(r)) return [[r.controller, BEHIND_TAKES]];
  return [[r.owner, OWNER_UNDER_OCCUPATION], [r.controller, OCCUPIER_TAKES]];
}

/**
 * GDP follows land and people. Each province's output is valued at the rate
 * of the economy it belonged to at the start of the turn (its owner's GDP
 * per unit of people times income), then moves with the province: an
 * annexation carries it whole to the new owner, an occupation leaves a part
 * to the owner and gives a part to the occupier, and people lost to war,
 * famine or flight take their share with them. What one side loses the
 * other gains, so the world's GDP does not jump when a border moves; taxes
 * follow GDP. `before` is the start of the turn with the period's natural
 * growth applied; `economies` (already advanced) change in place, except
 * for countries that did not exist before the turn.
 */
export function followLand(
  before: Record<string, RegionState>,
  after: Record<string, RegionState>,
  map: Record<string, MapRegion>,
  era: ScenarioId,
  economies: Record<string, Economy>,
  existed: (tag: string) => boolean,
): void {
  const value = (r: RegionState, p: MapRegion) => peopleIn(r, p) * provinceIncome(p, era);
  const base = new Map<string, number>();
  for (const [id, r] of Object.entries(before)) {
    const p = map[id];
    if (!p) continue;
    for (const [tag, share] of outputShares(r)) base.set(tag, (base.get(tag) ?? 0) + value(r, p) * share);
  }
  const rate = (tag: string) => {
    const b = base.get(tag) ?? 0;
    return b > 0 && economies[tag] ? economies[tag].gdp / b : 0;
  };
  const delta = new Map<string, number>();
  const add = (tag: string, v: number) => delta.set(tag, (delta.get(tag) ?? 0) + v);
  for (const [id, r] of Object.entries(after)) {
    const p = map[id];
    const old = before[id];
    if (!p || !old) continue;
    const k = rate(old.owner);
    if (!k) continue;
    for (const [tag, share] of outputShares(old)) add(tag, -value(old, p) * share * k);
    for (const [tag, share] of outputShares(r)) add(tag, value(r, p) * share * k);
  }
  for (const [tag, d] of delta) {
    const e = economies[tag];
    if (!e || !existed(tag) || Math.abs(d) < e.gdp * 0.002) continue;
    const gdp = Math.max(0.05, e.gdp + d);
    const ratio = gdp / e.gdp;
    e.gdp = money(gdp);
    e.budget.revenue = money(e.budget.revenue * ratio);
    // The schools, pensions, roads and offices of land lost are no longer paid for, nor those of land won paid by nobody;
    // the army stays what it is. Without this a state that lost most of its land kept its whole civil budget on a
    // fraction of its taxes, and printed money for decades.
    for (const line of ["industry", "social", "other"] as const) e.budget[line] = money(e.budget[line] * ratio);
  }
}

/** What a country produces, needs and trades this year, derived from the map and the economies. */
export interface Accounts {
  /** People in the provinces it owns, and in those the front has left behind in its hands, thousands. */
  population: number;
  /** Most it could put in uniform, thousands. */
  mobilisable: number;
  production: Partial<Record<ResourceType, number>>;
  need: Partial<Record<ResourceType, number>>;
  /** Surplus (+) or lack (−) of each resource, $bn a year at the day's prices. */
  trade: Partial<Record<ResourceType, number>>;
  /** $bn a year sold abroad and bought abroad (imports actually obtained). */
  exports: number;
  imports: number;
  /** Resources it lacks and cannot import, with months of store left. */
  shortages: ResourceType[];
  /** The world's scale, the same for every country: real units a year per point, and $bn a year per point. */
  world?: WorldScale;
}

export interface WorldScale {
  perPoint: Partial<Record<ResourceType, number>>;
  price: Partial<Record<ResourceType, number>>;
}

/** The resources industry works up, which countries use in the same proportion. */
const METALS: ResourceType[] = ["iron", "copper", "nickel", "tin", "bauxite", "rubber"];

/**
 * How much more (or less) of a resource a country uses than its income,
 * people and own fields suggest, where the difference is large on a start
 * date: China's coal and metals, Korea's heavy industry, the gas of
 * Ukraine and Iran, Britain's thrift with oil before the war. Tuned so the
 * main users come out near their real consumption. "metals" covers iron,
 * copper, nickel, tin, bauxite and rubber.
 */
const USE: Record<ScenarioId, Record<string, Partial<Record<ResourceType | "metals", number>>>> = {
  "1914": {
    usa: { oil: 1.75, iron: 1.7 },
    uk: { oil: 0.45, coal: 0.75 },
    germany: { oil: 0.4, iron: 3 },
    "austria-hungary": { oil: 0.5 },
    france: { oil: 0.3 },
    russia: { coal: 0.6, iron: 0.6 },
    canada: { coal: 1.9 },
    china: { coal: 0.4 },
    italy: { coal: 0.4 },
    belgium: { iron: 3 },
  },
  "1939": {
    usa: { oil: 1.75 },
    uk: { oil: 0.4, iron: 0.6 },
    germany: { oil: 0.35, iron: 1.7 },
    france: { oil: 0.5 },
    italy: { oil: 0.3, coal: 0.5 },
    japan: { oil: 0.6 },
    canada: { oil: 1.5, coal: 1.7 },
    ussr: { iron: 1.7 },
    poland: { coal: 0.75 },
  },
  "1950": {
    usa: { oil: 1.9, iron: 1.6 },
    uk: { oil: 0.5, coal: 0.9 },
    ussr: { oil: 0.6, iron: 1.6 },
    "west-germany": { coal: 1.4, iron: 1.8 },
    china: { coal: 0.5 },
    japan: { oil: 0.3 },
    canada: { oil: 1.5, coal: 1.3 },
  },
  "1964": {
    usa: { oil: 1.6, iron: 1.1 },
    ussr: { coal: 1.3, iron: 2 },
    japan: { oil: 1.2, iron: 2.5 },
    "west-germany": { coal: 1.2, iron: 1.6 },
    china: { coal: 1.6 },
    uk: { coal: 1.1 },
    canada: { oil: 1.3 },
    france: { coal: 0.8 },
  },
  "1991": {
    ussr: { oil: 1.6, gas: 1.4, metals: 3, iron: 4.6 },
    china: { coal: 1.6, metals: 3, iron: 4 },
    japan: { gas: 0.4, coal: 0.5 },
    usa: { iron: 0.3, metals: 0.6 },
    uk: { oil: 0.65 },
    "saudi-arabia": { oil: 0.4 },
    australia: { coal: 0.55 },
    yugoslavia: { coal: 2.7 },
    romania: { gas: 2 },
    france: { gas: 0.7 },
    india: { iron: 2.3 },
    "south-korea": { oil: 1.5, metals: 2.5 },
    brazil: { iron: 1.7 },
  },
  "1999": {
    russia: { oil: 1.4, gas: 1.5, metals: 2.5, iron: 3.5 },
    china: { coal: 1.6, metals: 2.8, iron: 3.5 },
    japan: { gas: 0.5, coal: 0.6 },
    usa: { iron: 0.25, metals: 0.55 },
    "south-korea": { oil: 2, metals: 2.3, iron: 2 },
    ukraine: { gas: 3, iron: 8 },
    india: { iron: 2 },
    brazil: { iron: 1.7 },
    uk: { oil: 0.65 },
    yugoslavia: { coal: 2.5 },
  },
  "2014": {
    usa: { iron: 0.15, metals: 0.45 },
    china: { gas: 0.45, coal: 1.45, metals: 2.6, iron: 3 },
    japan: { oil: 1.5, gas: 1.6, iron: 1.3 },
    russia: { oil: 0.7, iron: 1.6 },
    "south-korea": { oil: 2.3, gas: 2, coal: 2.5, metals: 1.8, iron: 2 },
    iran: { gas: 1.8 },
    mexico: { gas: 1.5 },
    "united-arab-emirates": { gas: 1.8 },
    italy: { gas: 2 },
    india: { gas: 0.45 },
    ukraine: { gas: 2.8, iron: 9 },
    belarus: { gas: 10 },
    australia: { coal: 0.35 },
    indonesia: { coal: 0.25 },
    germany: { iron: 0.6 },
  },
  "2022": {
    usa: { coal: 0.5, iron: 0.15, metals: 0.4 },
    china: { coal: 1.35, gas: 0.75, metals: 3, iron: 2.9 },
    india: { coal: 1.5, gas: 0.45 },
    russia: { coal: 0.75, iron: 1.6 },
    "south-korea": { oil: 2.5, gas: 1.9, coal: 2.5, metals: 1.8 },
    indonesia: { coal: 0.3 },
    australia: { coal: 0.3 },
    turkey: { coal: 1.7 },
    vietnam: { coal: 1.8 },
    uk: { oil: 0.7 },
    iran: { gas: 1.7, iron: 2.2 },
    mexico: { gas: 1.7 },
    italy: { gas: 1.9 },
    "united-arab-emirates": { gas: 1.8 },
    ukraine: { gas: 1.8, iron: 8 },
    belarus: { gas: 10 },
    germany: { iron: 0.5 },
  },
};

/**
 * Uranium the reactors of each country burn a year on the start date,
 * tonnes: nuclear power, not income, decides who needs it.
 */
const REACTORS: Record<ScenarioId, Record<string, number>> = {
  "1914": {},
  "1939": {},
  // The early dates count the bomb programmes too: then, not power, decided who wanted uranium.
  "1950": { usa: 2000, ussr: 1500, uk: 300 },
  "1964": { usa: 14000, ussr: 9000, uk: 2500, france: 1500, china: 300, canada: 100 },
  "1991": {
    usa: 18000, france: 9000, ussr: 9000, japan: 7000, germany: 3500, uk: 2500, "south-korea": 2500, canada: 1800, sweden: 1500, spain: 1200,
    belgium: 1000, taiwan: 1000, czechoslovakia: 600, bulgaria: 600, switzerland: 500, finland: 500, hungary: 400, "south-africa": 300, india: 200,
    argentina: 150, brazil: 100, netherlands: 100, yugoslavia: 100, mexico: 100,
  },
  "1999": {
    usa: 18000, france: 9000, japan: 7500, russia: 5000, germany: 3300, "south-korea": 3000, uk: 2500, ukraine: 2400, canada: 1700,
    sweden: 1500, spain: 1500, taiwan: 1100, belgium: 1000, bulgaria: 600, czechia: 600, china: 500, switzerland: 500, finland: 500,
    hungary: 400, slovakia: 400, lithuania: 400, india: 300, "south-africa": 300, mexico: 200, argentina: 150, slovenia: 150, brazil: 100,
    netherlands: 100, armenia: 80,
  },
  "2014": {
    usa: 19000, france: 9000, china: 6000, russia: 5500, "south-korea": 4000, ukraine: 2400, japan: 2000, germany: 2000, uk: 2000, canada: 1700,
    sweden: 1500, spain: 1300, taiwan: 1100, india: 1000, belgium: 1000, czechia: 600, finland: 500, switzerland: 500, slovakia: 400, hungary: 350,
    bulgaria: 300, "south-africa": 300, brazil: 300, mexico: 250, romania: 200, argentina: 150, pakistan: 150, iran: 150, slovenia: 150, armenia: 100, netherlands: 100,
  },
  "2022": {
    usa: 18000, china: 9900, france: 8000, russia: 5600, "south-korea": 4200, ukraine: 2400, japan: 2000, canada: 1600, uk: 1500, germany: 1500,
    india: 1500, sweden: 1400, spain: 1200, belgium: 1000, taiwan: 900, "united-arab-emirates": 600, czechia: 600, finland: 500, switzerland: 400,
    slovakia: 400, hungary: 400, bulgaria: 300, "south-africa": 300, brazil: 300, pakistan: 300, mexico: 300, argentina: 200, romania: 200, iran: 150,
    slovenia: 150, armenia: 100, belarus: 100, netherlands: 100,
  },
};

/** A country's weight in the world's use of a resource, before its people and income. */
function intensity(era: ScenarioId, tag: string, type: ResourceType): number {
  const k = USE[era][tag];
  return k?.[type] ?? (METALS.includes(type) ? k?.metals : undefined) ?? 1;
}

/**
 * Share of a resource's use that stays where it is dug: coal and gas travel
 * badly and their producers burn them at home, oil less so; metals and
 * uranium go wherever industry and reactors are. A country's own fields
 * count even when an enemy holds them, so an occupation leaves the need behind.
 */
const HOME: Partial<Record<ResourceType, number>> = { coal: 0.6, gas: 0.5, oil: 0.25 };

/** Stores are counted in months of need, up to this many. */
export const MAX_STOCK_MONTHS = 12;
/** Months in store before anything is known. */
export const DEFAULT_STOCK_MONTHS = 3;

/**
 * Every country's resources and trade. A province yields its points squared
 * (output on a straight scale), so a country's share of the world's output
 * is close to its real share. The world's output is used by people, more of
 * it the richer they are (the era's `use`), partly where it is dug (`HOME`),
 * and more or less where a country leans on a resource (`USE`); uranium by
 * reactors (`REACTORS`). What a country produces beyond its need is
 * exported, what it lacks is imported — unless its imports are cut, and then
 * it lives off its stores.
 */
export function nationalAccounts(state: Pick<GameState, "countries" | "regions" | "scenarioId" | "date"> & Partial<Pick<GameState, "player" | "politics">>, regions: Record<string, MapRegion>): Map<string, Accounts> {
  const era = ERAS[state.scenarioId];
  const year = yearOf(state.date);
  const out = new Map<string, Accounts>();
  const get = (tag: string) => {
    let a = out.get(tag);
    if (!a) {
      a = { population: 0, mobilisable: 0, production: {}, need: {}, trade: {}, exports: 0, imports: 0, shortages: [] };
      out.set(tag, a);
    }
    return a;
  };
  const world: Partial<Record<ResourceType, number>> = {};
  // Output of the land each country owns, whoever holds it, or holds behind the front until a peace (engine/occupation.ts).
  const owned = new Map<string, Partial<Record<ResourceType, number>>>();
  // People of captured land behind the front: counted as the captor's, few of them called up.
  const captured = new Map<string, number>();
  for (const [id, r] of Object.entries(state.regions)) {
    const p = regions[id];
    if (!p) continue;
    const by = countsFor(r);
    const n = peopleIn(r, p);
    get(by).population += n;
    if (by !== r.owner) captured.set(by, (captured.get(by) ?? 0) + n);
    for (const { type, output } of activeResources(p, year)) {
      const held = get(r.controller);
      const amount = linearOutput(output);
      held.production[type] = (held.production[type] ?? 0) + amount;
      world[type] = (world[type] ?? 0) + amount;
      const own = owned.get(by) ?? {};
      own[type] = (own[type] ?? 0) + amount;
      owned.set(by, own);
    }
  }
  let worldGdp = 0;
  for (const c of Object.values(state.countries)) worldGdp += c.economy?.gdp ?? 0;
  // Each country's call on the world's output: its people weighted by income per head,
  // its own fields for the part used where it is dug, and how heavily it leans on the resource.
  const weight = new Map<string, number>();
  let weights = 0;
  for (const [tag, c] of Object.entries(state.countries)) {
    const people = out.get(tag)?.population ?? 0;
    if (!c.economy || people <= 0) continue;
    const w = c.economy.gdp ** era.use * people ** (1 - era.use);
    weight.set(tag, w);
    weights += w;
  }
  const callOf = (tag: string, type: ResourceType) => {
    if (type === "uranium") return REACTORS[state.scenarioId][tag] ?? 0;
    const home = HOME[type] ?? 0;
    const total = world[type] ?? 0;
    if (!weights || !total) return 0;
    return intensity(state.scenarioId, tag, type) * ((1 - home) * ((weight.get(tag) ?? 0) / weights) + home * ((owned.get(tag)?.[type] ?? 0) / total));
  };
  const calls: Partial<Record<ResourceType, number>> = {};
  for (const [tag, c] of Object.entries(state.countries)) {
    if (!c.economy) continue;
    for (const type of RESOURCE_TYPES) calls[type] = (calls[type] ?? 0) + callOf(tag, type);
  }
  for (const [tag, c] of Object.entries(state.countries)) {
    const a = get(tag);
    // The player's call-up law widens or narrows the reserve; captured land gives few soldiers.
    const callable = a.population - (captured.get(tag) ?? 0) * (1 - BEHIND_CALL_UP);
    a.mobilisable = Math.round(callable * era.mobilise * (tag === state.player ? callUpFactor(state.politics?.laws) : 1));
    if (!c.economy || worldGdp <= 0) continue;
    for (const type of RESOURCE_TYPES) {
      const total = world[type] ?? 0;
      if (!total) continue;
      const call = calls[type] ?? 0;
      const need = call > 0 ? (total * callOf(tag, type)) / call : 0;
      a.need[type] = round(need, 3);
      const price = (worldGdp * era.markets[type]) / total;
      const surplus = (a.production[type] ?? 0) - need;
      a.trade[type] = round(surplus * price, 2);
      if (surplus > 0) a.exports += surplus * price;
      else a.imports += -surplus * price * (1 - c.economy.tradeCut);
      if (surplus < 0 && c.economy.tradeCut > 0 && (c.economy.stocks[type] ?? 3) <= 0) a.shortages.push(type);
    }
    a.exports = round(a.exports, 2);
    a.imports = round(a.imports, 2);
  }
  // One scale for the world: points as real amounts, and the day's price of a point.
  const price: Partial<Record<ResourceType, number>> = {};
  for (const type of RESOURCE_TYPES) if (world[type] && worldGdp > 0) price[type] = (worldGdp * era.markets[type]) / world[type]!;
  const scale: WorldScale = { perPoint: unitsPerPoint(state.scenarioId, world), price };
  for (const a of out.values()) a.world = scale;
  return out;
}

/** A change the model proposes for one country this turn. */
export interface EconomyChange {
  country: string;
  /** Real growth, % a year over the period. */
  growth?: number;
  inflation?: number;
  unemployment?: number;
  /** New budget levels, $bn a year. */
  revenue?: number;
  army?: number;
  industry?: number;
  social?: number;
  other?: number;
  /** Change in soldiers, thousands: mobilisation up, losses and demobilisation down. */
  troops?: number;
  /** Loans raised (+) or repaid (−) beyond the budget, $bn. */
  borrow?: number;
  /** Share of imports cut off by blockade, sanctions or war, 0–1. */
  tradeCut?: number;
}

/** Limits a proposed change to what the country can do: no budget line more than triples in a turn, taxes stay below 70% of GDP. */
export function limitChange(change: EconomyChange, current: Economy): EconomyChange {
  const out: EconomyChange = { country: change.country };
  const level = (value: number | undefined, now: number, cap: number) =>
    value === undefined ? undefined : round(clamp(value, 0, Math.min(cap, now * 3 + current.gdp * 0.03)), 2);
  if (change.growth !== undefined) out.growth = round(clamp(change.growth, -40, 30));
  if (change.inflation !== undefined) out.inflation = round(clamp(change.inflation, -20, 5000));
  if (change.unemployment !== undefined) out.unemployment = round(clamp(change.unemployment, 0, 60));
  out.revenue = level(change.revenue, current.budget.revenue, current.gdp * 0.7);
  out.army = level(change.army, current.budget.army, current.gdp * 0.8);
  out.industry = level(change.industry, current.budget.industry, current.gdp * 0.5);
  out.social = level(change.social, current.budget.social, current.gdp * 0.5);
  out.other = level(change.other, current.budget.other, current.gdp * 0.5);
  if (change.troops !== undefined) out.troops = Math.round(clamp(change.troops, -current.troops, 50000));
  if (change.borrow !== undefined) out.borrow = round(clamp(change.borrow, -current.reserves, current.gdp * 0.3), 2);
  if (change.tradeCut !== undefined) out.tradeCut = round(clamp(change.tradeCut, 0, 1), 2);
  for (const key of Object.keys(out) as (keyof EconomyChange)[]) if (out[key] === undefined) delete out[key];
  return out;
}

/** Share of a budget's army line that pays, feeds and equips the soldiers, so it follows their number. */
const PAY_SHARE = 0.5;
/** Of the people, the share who work or look for work: soldiers called up leave it. */
const WORKFORCE = 0.45;
/** Of a deficit with its interest, the share met from the reserves while they last above their floor; the rest is borrowed. */
const RESERVE_SHARE = 0.25;
/** The band the reserves settle in, as shares of the era's normal holdings: drawn no lower for a deficit, pulled back above it. */
const RESERVE_FLOOR = 0.5;
const RESERVE_CEILING = 2;
/** Of a deficit and interest, the share of GDP a government abroad lets run before it trims, unless its debt is past 90% of GDP. */
const TOLERATED_DEFICIT = 0.03;
/** Prices settle back to no more than this once nothing pushes them, % a year: a date's surge (2022's) does not last forever. */
const CALM_INFLATION = 4;
/** Debt past this many years of GDP makes a government abroad default; what is left after the write-down. */
const DEFAULT_DEBT = 3;
const RESTRUCTURED_DEBT = 1.2;
/** The surplus, as a share of GDP, a government abroad with little debt keeps before it gives the rest back. */
const SURPLUS_KEPT = 0.02;
/** Most of a year's GDP the trade in strategic resources moves the reserves by, before the share that reaches them. */
const TRADE_HELD = 0.25;
/** Of the gap between unemployment and the era's usual level, the share that closes in a year. */
const UNEMPLOYMENT_RETURN = 0.2;

/** In a war that is not under a truce. */
function fighting(state: Partial<Pick<GameState, "wars" | "date">>, tag: string): boolean {
  return (state.wars ?? []).some((w) => (w.attackers.includes(tag) || w.defenders.includes(tag)) && !(w.truce && state.date && w.truce.until > state.date));
}

/**
 * Moves every economy forward by one turn of `years`. The model's changes
 * land first (troops limited by who is left to call up); what it leaves
 * alone, the engine moves by cause:
 * - growth drifts back towards the era's trend, less what sanctions and
 *   cut-off imports take; a crisis caps it whatever the model says;
 * - inflation drifts back towards the era's norm, held up by a deficit, cut
 *   imports and a shortage, and kept rising while a deficit is printed;
 * - unemployment follows growth against the trend, and falls as men are
 *   called up;
 * - a bigger army costs more: half its budget follows the number of soldiers;
 * - a blockade the model reported fades once the country is at peace, never
 *   below the sanctions in force;
 * - GDP grows with real growth and the dollar, an untouched budget keeps its
 *   share of GDP, and a government abroad with a deficit it cannot carry
 *   trims spending and raises taxes;
 * - the interest on the debt is paid every turn; a deficit with it is met
 *   partly from the reserves while they stand above half the era's normal
 *   holdings, the rest borrowed; a surplus pays down half of what is owed and
 *   puts the rest by; the trade in strategic resources moves the reserves,
 *   and the rest of the economy pulls them back into a band of half to twice
 *   the era's normal holdings (less so when trade is cut); what the reserves
 *   cannot cover is borrowed;
 * - a country whose imports are cut lives off its stores.
 * Pure; returns the new economies by country.
 */
export function advanceEconomies(
  state: Pick<GameState, "countries" | "regions" | "scenarioId" | "date"> & Partial<Pick<GameState, "player" | "wars" | "politics">>,
  changes: EconomyChange[],
  years: number,
  regions: Record<string, MapRegion> | null,
  /** Imports cut off by sanctions (engine/trade.ts), on top of what the model reports. */
  cuts: Map<string, number> = new Map(),
  /** Share of exports sanctions take away (engine/trade.ts). */
  exportCuts: Map<string, number> = new Map(),
): Record<string, Economy> {
  const era = ERAS[state.scenarioId];
  const accounts = regions ? nationalAccounts(state, regions) : null;
  const byCountry = new Map(changes.map((c) => [c.country, c]));
  const out: Record<string, Economy> = {};
  for (const [tag, country] of Object.entries(state.countries)) {
    const before = country.economy;
    if (!before) continue;
    const change = byCountry.get(tag) ?? { country: tag };
    const e: Economy = structuredClone(before);
    const a = accounts?.get(tag);
    const atWar = fighting(state, tag);
    const gdpBefore = Math.max(0.01, before.gdp);

    // A blockade or war cut the model reported lasts while the country fights, then fades by half a year; sanctions in force stay.
    const carried = change.tradeCut ?? (atWar ? before.tradeCut : before.tradeCut * 0.5 ** years);
    e.tradeCut = Math.max(carried < 0.02 ? 0 : round(carried, 2), cuts.get(tag) ?? 0);

    // What sanctions and cut imports take from the economy each year: exports lost (half of them sold elsewhere at a discount) and imports gone without.
    const exportCut = exportCuts.get(tag) ?? 0;
    const lostExports = a ? a.exports * exportCut * 0.5 : 0;
    const goneWithout = a && e.tradeCut < 1 ? (a.imports * e.tradeCut) / (1 - e.tradeCut) : 0;
    const drag = Math.min(10, ((lostExports + goneWithout) / gdpBefore) * 100);

    // Growth drifts back towards the era's trend, less the drag and moved by the policies at work (engine/programmes.ts), unless the model says otherwise.
    const shift = programmeShift(country, state.date).growth;
    e.growth = change.growth ?? round(e.growth + (era.trend + shift - drag - e.growth) * Math.min(1, years) * 0.5);

    // Crises bite whatever the game master says: no growth through a shortage, hyperinflation or a debt crisis,
    // and prices that cannot fall while the deficit is printed.
    const limits = crisisLimits(before, a, state.scenarioId);
    if (limits.growthCap !== undefined) e.growth = Math.min(e.growth, limits.growthCap);

    // Prices drift back towards the era's norm, held up by a deficit beyond what lenders fund quietly, cut imports and a shortage.
    if (change.inflation !== undefined) e.inflation = change.inflation;
    else {
      const deficit = ((-balance(before) + interestOf(before, state.scenarioId)) / gdpBefore) * 100;
      const pressure = Math.max(0, deficit - 4) + e.tradeCut * 15 + (a?.shortages.length && e.tradeCut > 0 ? 10 : 0);
      e.inflation = round(before.inflation + (Math.min(era.inflation, CALM_INFLATION) + pressure - before.inflation) * Math.min(1, years * 0.5));
    }
    if (limits.printing) e.inflation = Math.max(e.inflation, round(before.inflation + 8 * years));

    // In dollars, a country's own inflation is offset by its currency falling;
    // what it does to people is the model's to judge (growth, stability).
    const nominal = Math.max(0.05, (1 + e.growth / 100) * (1 + era.dollar / 100)) ** years;
    const gdp = before.gdp * nominal;
    for (const key of ["revenue", "army", "industry", "social", "other"] as const) {
      e.budget[key] = money(change[key] ?? before.budget[key] * nominal);
    }
    e.gdp = money(gdp);

    // Soldiers: no more than are left to call up, a third of them a month at most.
    if (change.troops !== undefined) {
      const room = a ? Math.max(0, a.mobilisable - before.troops) : Infinity;
      const pace = a ? a.mobilisable * Math.min(1, years * 4) : Infinity;
      e.troops = Math.max(0, before.troops + Math.min(change.troops, room, pace));
      // More soldiers cost more: their pay and kit follow their number unless the model set the army's budget itself.
      if (change.army === undefined && before.troops > 0) e.budget.army = money(Math.max(0, e.budget.army * (1 + PAY_SHARE * (e.troops / before.troops - 1))));
    }

    // Jobs follow growth against the trend (a point of unemployment for every two and a half of growth lost),
    // and the called-up leave the workforce.
    if (change.unemployment !== undefined) e.unemployment = change.unemployment;
    else {
      const workforce = (a?.population ?? 0) * WORKFORCE;
      const drafted = workforce > 0 ? (Math.max(0, e.troops - before.troops) / workforce) * 100 : 0;
      // Out of a slump, jobs come back slowly towards the era's usual level, rather than staying lost for decades.
      const back = (era.unemployment - before.unemployment) * Math.min(1, UNEMPLOYMENT_RETURN * years);
      e.unemployment = round(clamp(before.unemployment - 0.4 * (e.growth - era.trend) * years - drafted + back, 0, 60));
    }

    // A government abroad that the model leaves alone keeps its books like most did: it lets run a deficit that does not raise
    // its debt against GDP (and a small one besides while the debt is moderate), and closes the rest a quarter a year, half by
    // trimming spending and half by taxes; past 90% of GDP it aims a point lower and moves twice as fast. A war is paid for first.
    const untouched = (["revenue", "army", "industry", "social", "other"] as const).every((k) => change[k] === undefined);
    if (tag !== state.player && untouched && !atWar) {
      const ratio = before.debt / gdpBefore;
      const heavy = ratio > 0.9;
      const steady = Math.max(0, ((1 + e.growth / 100) * (1 + era.dollar / 100) - 1) * ratio);
      const allowed = heavy ? Math.max(0, steady - 0.01) : Math.max(TOLERATED_DEFICIT, steady);
      const excess = -balance(e) + interestOf(before, state.scenarioId) - allowed * e.gdp;
      if (excess > 0) {
        const fix = excess * Math.min(1, years * (heavy ? 0.5 : 0.25));
        e.budget.other = money(Math.max(e.budget.revenue * 0.1, e.budget.other - fix / 2));
        e.budget.revenue = money(Math.min(e.gdp * 0.5, e.budget.revenue + fix / 2));
      }
      // Nor does it hoard: a surplus past two points of GDP with little debt left goes back in lower taxes and more spending at home.
      const spare = balance(e) - interestOf(before, state.scenarioId) - SURPLUS_KEPT * e.gdp;
      if (spare > 0 && ratio < 0.3) {
        const give = spare * Math.min(1, years * 0.25);
        e.budget.revenue = money(Math.max(e.gdp * 0.05, e.budget.revenue - give / 2));
        e.budget.social = money(e.budget.social + give / 2);
      }
    }

    // The books, every turn whatever the game master says. Loans it reports add to both the debt and the reserves.
    // The period's balance after interest: a deficit is met partly from the reserves above their floor, the rest borrowed;
    // a surplus pays down half of what is owed and puts the rest by.
    const borrow = change.borrow ?? 0;
    const norm = gdpBefore * era.reserves;
    const gap = balance(e) * years - interestOf(before, state.scenarioId) * years;
    let debt = before.debt + borrow;
    let reserves = before.reserves + borrow;
    if (gap < 0) {
      const drawn = Math.min(-gap * RESERVE_SHARE, Math.max(0, before.reserves - norm * RESERVE_FLOOR));
      reserves -= drawn;
      debt += -gap - drawn;
    } else {
      const repaid = Math.min(Math.max(0, debt), gap / 2);
      debt -= repaid;
      reserves += gap - repaid;
    }
    // Trade in strategic resources moves the reserves. The rest of the current account and the flows of capital pull them
    // back into a band around what the era's states held, so a country that buys its oil does not run dry in peace,
    // nor one that sells it pile up gold forever.
    // The surplus or gap in that trade is held within a quarter of GDP a year: a state that has lost most of its land
    // still digs the resources the accounts value, and must not pile up gold many times its shrunken economy.
    const traded = a ? clamp(a.exports - lostExports - a.imports, -TRADE_HELD * gdpBefore, TRADE_HELD * gdpBefore) : 0;
    reserves += traded * years * 0.2;
    const settle = Math.min(Math.max(reserves, norm * RESERVE_FLOOR), norm * RESERVE_CEILING);
    reserves += (settle - reserves) * Math.min(1, years * 0.25) * (1 - e.tradeCut);
    // Reserves past the band pay off debt first, never below the eighth of GDP that keeps a borrower trusted (crises.ts interestRate).
    const idle = reserves - Math.max(norm * RESERVE_CEILING, 0.125 * gdpBefore);
    if (idle > 0 && debt > 0) {
      const paid = Math.min(debt, idle * Math.min(1, years));
      debt -= paid;
      reserves -= paid;
    }
    if (reserves < 0) debt -= reserves;
    // A government abroad whose debt has outgrown its economy past any hope of paying – most often a state that lost
    // most of its land and kept its debt – defaults, and its creditors write the debt down.
    if (tag !== state.player && debt > DEFAULT_DEBT * e.gdp) debt = RESTRUCTURED_DEBT * e.gdp;
    e.debt = money(Math.max(0, debt));
    e.reserves = money(Math.max(0, reserves));

    // Stores, in months of need: cut-off imports eat them, a surplus refills them.
    if (a) {
      for (const type of RESOURCE_TYPES) {
        const need = a.need[type] ?? 0;
        if (!need) continue;
        const lack = Math.max(0, need - (a.production[type] ?? 0)) / need;
        const store = e.stocks[type] ?? DEFAULT_STOCK_MONTHS;
        const next = lack > 0 ? store - lack * e.tradeCut * years * 12 : store + years * 3;
        e.stocks[type] = round(clamp(next, 0, MAX_STOCK_MONTHS));
      }
    }
    out[tag] = e;
  }
  return out;
}

/**
 * The player sets the budget between turns: new levels, limited like any
 * change (no line more than triples, taxes stay below 70% of GDP). The
 * first budget of the period is remembered, so the turn's game master sees
 * where it started and judges what the new one does to growth and unrest.
 */
export function setBudget<T extends Pick<GameState, "countries" | "player" | "date" | "budgetSet" | "updatedAt">>(state: T, budget: Budget, now = new Date()): T {
  const country = state.countries[state.player];
  const economy = country?.economy;
  if (!economy) return state;
  const limited = limitChange({ country: state.player, ...budget }, economy);
  const after: Budget = {
    revenue: limited.revenue ?? economy.budget.revenue,
    army: limited.army ?? economy.budget.army,
    industry: limited.industry ?? economy.budget.industry,
    social: limited.social ?? economy.budget.social,
    other: limited.other ?? economy.budget.other,
  };
  return {
    ...state,
    countries: { ...state.countries, [state.player]: { ...country, economy: { ...economy, budget: after } } },
    budgetSet: { date: state.date, before: state.budgetSet?.before ?? economy.budget, after },
    updatedAt: now.toISOString(),
  };
}

/** The figures the turn report compares for the player. */
/**
 * The bounds of boundEconomy, in years of output where they are money. Past
 * anything the engine lets a country reach however long the game runs – it
 * settles reserves around a tenth to a third of GDP and caps taxes at 70% of
 * it, so even a country that spent nothing could not put by a year of output
 * every year – and past any country in history (the largest reserves ever
 * held were about 1.3 years of output): what lies beyond was written into
 * the save by hand.
 */
export const ECONOMY_BOUNDS = { reserves: 2, reservesPerYear: 1, revenue: 2, troops: 1_000_000 } as const;

/** What a country's money is measured against: its own output, or a quarter of the largest economy's for a government left with little land (one in exile keeps its gold). */
export interface EconomyBasis {
  /** The largest GDP in the world. */
  largest: number;
  /** Years since the game began. */
  years: number;
}

/**
 * An economy with what no game could have reached taken out: reserves past
 * two years of output and one more for every year played, taxes past two,
 * a billion soldiers, stores past what the engine keeps, rates outside any
 * country's, figures that are not numbers. Debt and spending have no
 * ceiling: a game can run them up, and more of either never helps a player.
 * A save edited by hand, or a cloud copy changed outside the game, loads as
 * a country the engine can run; a played game, however long, loads unchanged.
 */
export function boundEconomy(e: Economy, basis: EconomyBasis = { largest: 0, years: 0 }): Economy {
  const n = (value: number, min: number, max = Infinity) => (Number.isFinite(value) ? clamp(value, min, max) : min);
  const gdp = Number.isFinite(e.gdp) && e.gdp > 0 ? e.gdp : 0.05;
  const output = Math.max(gdp, (Number.isFinite(basis.largest) ? basis.largest : 0) / 4);
  const years = Number.isFinite(basis.years) ? Math.max(0, basis.years) : 0;
  return {
    ...e,
    gdp,
    growth: n(e.growth, -100, 100),
    inflation: n(e.inflation, -100, 1_000_000),
    unemployment: n(e.unemployment, 0, 100),
    budget: {
      revenue: n(e.budget.revenue, 0, output * ECONOMY_BOUNDS.revenue),
      army: n(e.budget.army, 0),
      industry: n(e.budget.industry, 0),
      social: n(e.budget.social, 0),
      other: n(e.budget.other, 0),
    },
    debt: n(e.debt, 0),
    reserves: n(e.reserves, 0, output * (ECONOMY_BOUNDS.reserves + ECONOMY_BOUNDS.reservesPerYear * years)),
    troops: n(e.troops, 0, ECONOMY_BOUNDS.troops),
    tradeCut: n(e.tradeCut, 0, 1),
    ...(e.stocks ? { stocks: Object.fromEntries(Object.entries(e.stocks).map(([k, v]) => [k, n(v ?? 0, 0, MAX_STOCK_MONTHS)])) } : {}),
  };
}

/** Every country's economy within boundEconomy, `years` after the game began; the same object where nothing was out of bounds. */
export function boundEconomies<T extends Pick<GameState, "countries">>(state: T, years = 0): T {
  const largest = Math.max(0, ...Object.values(state.countries).map((c) => (c.economy && Number.isFinite(c.economy.gdp) ? c.economy.gdp : 0)));
  let countries: GameState["countries"] | null = null;
  for (const [tag, country] of Object.entries(state.countries)) {
    if (!country.economy) continue;
    const bounded = boundEconomy(country.economy, { largest, years });
    if (JSON.stringify(bounded) === JSON.stringify(country.economy)) continue;
    countries ??= { ...state.countries };
    countries[tag] = { ...country, economy: bounded };
  }
  return countries ? { ...state, countries } : state;
}

export const snapshot = (e: Economy): EconomyFigures => ({ gdp: e.gdp, debt: e.debt, reserves: e.reserves, troops: e.troops, balance: round(balance(e), 2) });

/** "$39 bn", "$1.2 tn", "$450 M" — for the prompt. */
export function formatMoney(billions: number): string {
  const abs = Math.abs(billions);
  const sign = billions < 0 ? "-" : "";
  if (abs >= 1000) return `${sign}$${round(abs / 1000, abs >= 10000 ? 0 : 1)} tn`;
  if (abs >= 1) return `${sign}$${round(abs, abs >= 100 ? 0 : 1)} bn`;
  return `${sign}$${Math.round(abs * 1000)} M`;
}

/** The provinces each country owns, with their map data. */
function provincesByOwner(regions: Record<string, RegionState>, map: Record<string, MapRegion>): Map<string, MapRegion[]> {
  const out = new Map<string, MapRegion[]>();
  for (const [id, r] of Object.entries(regions)) {
    const p = map[id];
    if (!p) continue;
    const list = out.get(r.owner) ?? [];
    // The people there now: a scenario on another date's map starts them from its own figures.
    list.push(r.pop !== undefined ? { ...p, pop: r.pop } : p);
    out.set(r.owner, list);
  }
  return out;
}

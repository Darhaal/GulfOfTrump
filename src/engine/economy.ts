import { yearOf } from "./calendar";
import { colonialOf } from "./colonialLand";
import { peopleIn } from "./population";
import { yearFraction } from "./researchEffects";
import { REGIMES } from "./scenarios/regimes";
import { literacyAtStart, literacyNow } from "./societyTables";
import { programmeShift } from "./programmes";
import { crisisLimits, interestOf } from "./crises";
import { advanceDevelopment, effortOf, EXTRACTION_MAX, extractionOf, FACTORIES_BOUNDS, GOODS_VALUE, goodsLine, leanOf, researchGoods, splitGrowth, tiltOf } from "./development";
import { bombing } from "./forces";
import { callUpFactor } from "./laws";
import { BEHIND_CALL_UP, BEHIND_TAKES, countsFor, heldBehind } from "./occupation";
import { shortOf, uraniumCall } from "./energy";
import { MOBILISATION_LOSS, mobilisationLoss, strainOf, warCallUp } from "./mobilisation";
import { DOLLAR } from "./prices";
import { activeResources, linearOutput, RESOURCE_TYPES, type ResourceType } from "./resources";
import type { Budget, Economy, EconomyFigures, GameState, MapRegion, OutputLosses, RegimeKind, RegionState, ScenarioId, TimeStep } from "./types";
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
 * Growth, inflation and unemployment kept to three decimals; shown to one.
 * Kept to one, a weekly turn's drift (a hundredth of the gap, or less) was
 * rounded away: growth five points off its trend, inflation five off calm and
 * unemployment thirteen off normal never moved in a weekly game.
 */
const rate = (value: number) => round(value, 3);
/** A rate as the game master reads it, to one decimal. */
export const rateText = (value: number) => String(round(value, 1));
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
    markets: { oil: 0.0021, gas: 0.0004, coal: 0.018, iron: 0.0035, copper: 0.0018, gold: 0.0025, nickel: 0.00014, tin: 0.0007, bauxite: 0.000015, rubber: 0.0012, uranium: 0 },
    use: 1,
  },
  "1933": {
    // The depth of the Depression: dollars of 1933, about two-thirds of 1939's output a head (the US at some $450).
    perCapita: (income) => income * pre1914(income) * 1.35 * 0.053 * 0.66,
    revenue: [0.18, 0.09],
    social: [0.04, 0.008],
    industry: 0.025,
    army: 0.03,
    troops: 0.006,
    mobilise: 0.14,
    debt: 0.6,
    reserves: 0.06,
    inflation: 0,
    unemployment: 15,
    trend: 3,
    markets: { oil: 0.004, gas: 0.0008, coal: 0.013, iron: 0.0016, copper: 0.0008, gold: 0.0045, nickel: 0.00015, tin: 0.0004, bauxite: 0.00003, rubber: 0.0004, uranium: 0 },
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
    markets: { oil: 0.008, gas: 0.0008, coal: 0.0105, iron: 0.0017, copper: 0.001, gold: 0.0009, nickel: 0.00014, tin: 0.0003, bauxite: 0.00003, rubber: 0.0018, uranium: 0.0001 },
    use: 1,
  },
  "1957": {
    // Between the two: the US at about $2,600 a head, Western Europe and Japan growing fast.
    perCapita: (income) => income * 0.039,
    revenue: [0.27, 0.11],
    social: [0.09, 0.025],
    industry: 0.04,
    army: 0.06,
    troops: 0.008,
    mobilise: 0.15,
    debt: 0.5,
    reserves: 0.08,
    inflation: 3,
    unemployment: 4,
    trend: 5,
    markets: { oil: 0.0085, gas: 0.0016, coal: 0.01, iron: 0.002, copper: 0.0014, gold: 0.00075, nickel: 0.0002, tin: 0.0003, bauxite: 0.00007, rubber: 0.0014, uranium: 0.00015 },
    use: 0.95,
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
    markets: { oil: 0.0087, gas: 0.0026, coal: 0.0094, iron: 0.0024, copper: 0.0017, gold: 0.00064, nickel: 0.0003, tin: 0.0003, bauxite: 0.00012, rubber: 0.001, uranium: 0.0002 },
    use: 0.9,
  },
  "1973": {
    // A third of the way from 1964 to 1991 (provinceIncome): the US at about $6,700 a head; oil still at three dollars a barrel before the embargo.
    perCapita: (income) => income * 0.055 ** (2 / 3) * (0.15 + 0.3 * Math.min(1, income / 30000)) ** (1 / 3),
    revenue: [0.3, 0.14],
    social: [0.13, 0.03],
    industry: 0.04,
    army: 0.05,
    troops: 0.007,
    mobilise: 0.14,
    debt: 0.4,
    reserves: 0.08,
    inflation: 7,
    unemployment: 4,
    trend: 5,
    markets: { oil: 0.012, gas: 0.004, coal: 0.0085, iron: 0.0018, copper: 0.0017, gold: 0.001, nickel: 0.0003, tin: 0.00012, bauxite: 0.00012, rubber: 0.0006, uranium: 0.00008 },
    use: 0.85,
  },
  "1979": {
    // Five-ninths of the way from 1964 to 1991: the US at about $11,600 a head, oil at thirty dollars after Iran's revolution.
    perCapita: (income) => income * 0.055 ** (4 / 9) * (0.15 + 0.3 * Math.min(1, income / 30000)) ** (5 / 9),
    revenue: [0.32, 0.16],
    social: [0.16, 0.035],
    industry: 0.04,
    army: 0.045,
    troops: 0.0065,
    mobilise: 0.13,
    debt: 0.45,
    reserves: 0.08,
    inflation: 10,
    unemployment: 6,
    trend: 3.5,
    markets: { oil: 0.045, gas: 0.01, coal: 0.011, iron: 0.002, copper: 0.0014, gold: 0.0015, nickel: 0.0003, tin: 0.0002, bauxite: 0.00012, rubber: 0.0004, uranium: 0.0003 },
    use: 0.82,
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

/**
 * 1973 and 1979 where the path from 1964 to 1991 misleads: the oil states
 * before and after the price rose fivefold, Japan, Western Europe and Brazil
 * at the floating dollar's rates, Israel at war's cost (dollars of the day).
 */
const SEVENTIES: Record<string, Partial<Record<ScenarioId, number>>> = {
  SAU: { "1973": 2200, "1979": 9500 },
  KWT: { "1973": 6500, "1979": 18000 },
  ARE: { "1973": 9000, "1979": 25000 },
  QAT: { "1973": 9000, "1979": 25000 },
  BHR: { "1973": 2000, "1979": 6000 },
  OMN: { "1973": 600, "1979": 3000 },
  LBY: { "1973": 2400, "1979": 8000 },
  IRQ: { "1973": 500, "1979": 2500 },
  IRN: { "1973": 800, "1979": 2200 },
  VEN: { "1973": 1500, "1979": 3800 },
  NGA: { "1973": 250, "1979": 800 },
  JPN: { "1973": 3800, "1979": 8800 },
  DEU: { "1973": 5000, "1979": 11000 },
  FRA: { "1973": 4700, "1979": 10000 },
  GBR: { "1973": 3400, "1979": 7800 },
  ITA: { "1973": 2700, "1979": 6000 },
  NLD: { "1973": 4700, "1979": 10500 },
  BEL: { "1973": 4900, "1979": 11000 },
  SWE: { "1973": 6300, "1979": 12500 },
  CHE: { "1973": 7000, "1979": 16000 },
  AUT: { "1973": 3900, "1979": 9000 },
  ESP: { "1973": 1900, "1979": 5300 },
  CAN: { "1973": 6000, "1979": 10000 },
  AUS: { "1973": 5100, "1979": 9800 },
  ISR: { "1973": 3500, "1979": 5000 },
  BRA: { "1973": 900, "1979": 1900 },
};
for (const [code, values] of Object.entries(SEVENTIES)) PER_CAPITA[code] = { ...PER_CAPITA[code], ...values };

/** 1933 where the Depression struck harder or softer than the world's: dollars of 1933. */
const DEPRESSION: Record<string, number> = { CHN: 25, TWN: 55, JPN: 140, KOR: 45, PRK: 45, IDN: 35, VNM: 28, RUS: 180, UKR: 90, SAU: 15, ARE: 15, QAT: 15, KWT: 15, BHR: 20, OMN: 15 };
for (const [code, value] of Object.entries(DEPRESSION)) PER_CAPITA[code] = { ...PER_CAPITA[code], "1933": value };

/** Dates that lie between two others on the same path: the earlier, the later, and how far along, by years. */
const BETWEEN: Partial<Record<ScenarioId, [ScenarioId, ScenarioId, number]>> = { "1973": ["1964", "1991", 1 / 3], "1979": ["1964", "1991", 5 / 9] };

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
  // January 1933: the Depression's trough – a quarter of America's workforce and nearly a third of Germany's idle; the Reichswehr held at 100,000.
  "1933": {
    germany: { troops: 100, army: 0.01, revenue: 0.2, debt: 0.3, unemployment: 30, inflation: -2, growth: 2 },
    usa: { troops: 135, army: 0.012, debt: 0.4, unemployment: 25, inflation: -5, growth: -2 },
    uk: { troops: 340, army: 0.025, revenue: 0.2, debt: 1.7, unemployment: 21, inflation: -2, growth: 1 },
    france: { troops: 650, army: 0.04, revenue: 0.2, debt: 1.1, unemployment: 5, inflation: -3, growth: -1 },
    ussr: { troops: 900, army: 0.06, revenue: 0.4, debt: 0.1, unemployment: 0, growth: 3 },
    italy: { troops: 400, army: 0.05, debt: 0.9, unemployment: 10, growth: 0 },
    japan: { troops: 300, army: 0.05, debt: 0.5, inflation: 2, growth: 6 },
    poland: { troops: 300, army: 0.07, unemployment: 15, growth: -2 },
    czechoslovakia: { troops: 150, army: 0.03, unemployment: 15 },
    austria: { troops: 22, army: 0.01, unemployment: 25 },
    spain: { troops: 120, army: 0.03, unemployment: 12 },
    china: { troops: 2000, army: 0.08, debt: 0.3, growth: 0 },
    manchukuo: { troops: 100, army: 0.06 },
    "chinese-soviet-republic": { troops: 100, army: 0.4, growth: 0 },
    bolivia: { troops: 60, army: 0.25, growth: -5 },
    paraguay: { troops: 40, army: 0.3 },
    peru: { troops: 20, army: 0.06 },
    colombia: { troops: 15, army: 0.05 },
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
  // October 1957: the Cold War's dearest years in arms, Algeria at war, Europe and Japan growing fast, America sliding into recession.
  "1957": {
    usa: { troops: 2800, army: 0.1, debt: 0.6, unemployment: 4.3, inflation: 3.3, growth: 2 },
    ussr: { troops: 3900, army: 0.13, revenue: 0.4, debt: 0.05, unemployment: 0, growth: 7 },
    uk: { troops: 700, army: 0.07, revenue: 0.32, debt: 1.3, unemployment: 1.4, growth: 2 },
    france: { troops: 1000, army: 0.075, debt: 0.35, inflation: 4, growth: 6 },
    china: { troops: 2500, army: 0.06, debt: 0.02, growth: 5 },
    taiwan: { troops: 600, army: 0.12, growth: 7 },
    "west-germany": { troops: 120, army: 0.04, debt: 0.2, unemployment: 3.5, growth: 6 },
    "east-germany": { troops: 90, army: 0.03, growth: 7 },
    japan: { troops: 200, army: 0.013, growth: 8 },
    india: { troops: 450, army: 0.02, growth: 4 },
    pakistan: { troops: 200, army: 0.04 },
    egypt: { troops: 100, army: 0.08 },
    israel: { troops: 50, army: 0.08 },
    syria: { troops: 50, army: 0.06 },
    turkey: { troops: 500, army: 0.05 },
    hungary: { troops: 50, army: 0.02, growth: 2 },
    "south-korea": { troops: 650, army: 0.05, inflation: 20, growth: 8 },
    "north-korea": { troops: 350, army: 0.12 },
    "north-vietnam": { troops: 250, army: 0.12 },
    "south-vietnam": { troops: 150, army: 0.08 },
    indonesia: { troops: 200, army: 0.05, inflation: 15 },
    fln: { troops: 40, army: 0.3, growth: 0 },
    "malayan-communists": { troops: 2, army: 0.3, growth: 0 },
    "july-26-movement": { troops: 0.3, army: 0.3, growth: 0 },
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
  // October 1973: the long boom's last year – inflation rising everywhere, the Middle East armed as never before (Israel and Egypt at a fifth of GDP).
  "1973": {
    usa: { troops: 2250, army: 0.06, debt: 0.33, unemployment: 4.8, inflation: 6.2, growth: 5.6 },
    ussr: { troops: 4000, army: 0.12, revenue: 0.4, debt: 0.05, unemployment: 0, growth: 4 },
    uk: { troops: 360, army: 0.05, debt: 0.55, unemployment: 2.6, inflation: 9, growth: 6 },
    france: { troops: 500, army: 0.035, debt: 0.2, inflation: 7, growth: 5.5 },
    "west-germany": { troops: 475, army: 0.035, debt: 0.18, unemployment: 1.2, inflation: 7, growth: 4.7 },
    "east-germany": { troops: 140, army: 0.05, growth: 5 },
    japan: { troops: 233, army: 0.009, inflation: 11, growth: 8 },
    china: { troops: 2900, army: 0.07, debt: 0.02, growth: 7 },
    // Israel called up its reserves on the morning of 6 October: some 375,000 under arms within two days.
    israel: { troops: 375, army: 0.3, inflation: 20, growth: 6 },
    egypt: { troops: 300, army: 0.2, inflation: 5 },
    syria: { troops: 130, army: 0.15 },
    iraq: { troops: 100, army: 0.1 },
    jordan: { troops: 70, army: 0.15 },
    "saudi-arabia": { troops: 40, army: 0.08 },
    iran: { troops: 210, army: 0.08, growth: 10 },
    turkey: { troops: 455, army: 0.04 },
    greece: { troops: 160, army: 0.045 },
    "north-vietnam": { troops: 570, army: 0.25, growth: 3 },
    "south-vietnam": { troops: 1100, army: 0.25, inflation: 30, growth: -2 },
    "viet-cong": { troops: 100, army: 0.3, growth: 0 },
    cambodia: { troops: 200, army: 0.4, inflation: 100, growth: -15 },
    "khmer-rouge": { troops: 60, army: 0.4, growth: 0 },
    laos: { troops: 60, army: 0.2 },
    "pathet-lao": { troops: 35, army: 0.3 },
    india: { troops: 950, army: 0.03, inflation: 18, growth: 3 },
    pakistan: { troops: 400, army: 0.06, inflation: 20 },
    "north-korea": { troops: 470, army: 0.15 },
    "south-korea": { troops: 630, army: 0.045, growth: 14 },
    taiwan: { troops: 500, army: 0.08, growth: 12 },
    portugal: { troops: 220, army: 0.07, inflation: 13, growth: 11 },
    mpla: { troops: 5, army: 0.3, growth: 0 },
    frelimo: { troops: 10, army: 0.3, growth: 0 },
    paigc: { troops: 7, army: 0.3, growth: 0 },
    rhodesia: { troops: 10, army: 0.05 },
    zanu: { troops: 2, army: 0.3, growth: 0 },
    ethiopia: { troops: 45, army: 0.03 },
    eplf: { troops: 10, army: 0.3, growth: 0 },
    chile: { troops: 75, army: 0.04, inflation: 500, growth: -5 },
  },
  // December 1979: the second oil shock – inflation in double figures in the West, Iran in revolution, the Soviet Union's growth slowing.
  "1979": {
    usa: { troops: 2030, army: 0.048, debt: 0.32, unemployment: 6, inflation: 11.3, growth: 3.2 },
    ussr: { troops: 4400, army: 0.13, revenue: 0.4, debt: 0.05, unemployment: 0, growth: 2 },
    uk: { troops: 320, army: 0.047, debt: 0.45, unemployment: 5.3, inflation: 13.4, growth: 3.7 },
    france: { troops: 500, army: 0.039, debt: 0.2, unemployment: 6, inflation: 10.8, growth: 3.2 },
    "west-germany": { troops: 495, army: 0.033, debt: 0.3, unemployment: 3.2, inflation: 4, growth: 4.2 },
    "east-germany": { troops: 160, army: 0.06, growth: 4 },
    japan: { troops: 240, army: 0.009, debt: 0.4, inflation: 3.6, growth: 5.5 },
    china: { troops: 4300, army: 0.08, debt: 0.02, inflation: 2, growth: 7.6 },
    afghanistan: { troops: 70, army: 0.1, growth: -5 },
    mujahideen: { troops: 40, army: 0.3, growth: 0 },
    iran: { troops: 240, army: 0.06, inflation: 11, growth: -10 },
    iraq: { troops: 220, army: 0.1, growth: 8 },
    israel: { troops: 165, army: 0.24, inflation: 110, growth: 4 },
    egypt: { troops: 395, army: 0.12, inflation: 10, growth: 6 },
    syria: { troops: 230, army: 0.15 },
    "saudi-arabia": { troops: 45, army: 0.12 },
    turkey: { troops: 566, army: 0.045, inflation: 60, growth: -0.5 },
    vietnam: { troops: 1000, army: 0.2, growth: -2 },
    cambodia: { troops: 30, army: 0.2, growth: -10 },
    "khmer-rouge": { troops: 30, army: 0.4, growth: 0 },
    india: { troops: 1100, army: 0.03, inflation: 15, growth: -5 },
    pakistan: { troops: 430, army: 0.06, inflation: 9 },
    "north-korea": { troops: 650, army: 0.15 },
    "south-korea": { troops: 600, army: 0.05, inflation: 18, growth: 7 },
    taiwan: { troops: 450, army: 0.07, growth: 8 },
    ethiopia: { troops: 250, army: 0.1 },
    eplf: { troops: 20, army: 0.3, growth: 0 },
    somalia: { troops: 50, army: 0.1 },
    angola: { troops: 40, army: 0.15 },
    unita: { troops: 15, army: 0.3, growth: 0 },
    morocco: { troops: 117, army: 0.07 },
    polisario: { troops: 5, army: 0.3, growth: 0 },
    rhodesia: { troops: 30, army: 0.1, growth: -2 },
    zanu: { troops: 20, army: 0.3, growth: 0 },
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
  // 1957 lies halfway between the two Cold War dates: their figures' geometric mean, where both have one.
  const [a, b] = [PER_CAPITA[region.adm0]?.["1950"], PER_CAPITA[region.adm0]?.["1964"]];
  if (era === "1957" && a !== undefined && b !== undefined) return Math.round(Math.sqrt(a * b));
  // 1973 and 1979 lie on the path from 1964 to 1991: the geometric mean of the two dates' figures, weighted by the years.
  const between = BETWEEN[era];
  if (between) {
    const [from, to, t] = between;
    const at = (date: ScenarioId) => PER_CAPITA[region.adm0]?.[date] ?? ERAS[date].perCapita(region.inc ?? 3000);
    return Math.round(at(from) ** (1 - t) * at(to) ** t);
  }
  return ERAS[era].perCapita(region.inc ?? 3000);
}

/** The share of GDP a government of the era spent on its people, in a rich country or a poor one. */
export const socialNorm = (era: ScenarioId, rich: boolean) => ERAS[era].social[rich ? 0 : 1];
/** The reserves a state of the era held, as a share of GDP. */
export const reserveNorm = (era: ScenarioId) => ERAS[era].reserves;
/** The debt an era's governments carried as a matter of course, share of GDP: past it a careful minister of the economy runs no deficit (engine/ministers.ts). */
export const debtNorm = (era: ScenarioId) => ERAS[era].debt;
/** The share of its people an era's country could put in uniform at most (Accounts.mobilisable, before the call-up law). */
export const mobiliseNorm = (era: ScenarioId) => ERAS[era].mobilise;
/** The army a government raises from so many thousand people and so much output: the era's usual soldiers and army budget, as a new country starts (startingEconomy). */
export const raisedArmy = (people: number, gdp: number, era: ScenarioId) => ({ troops: Math.round(Math.max(0, people) * ERAS[era].troops), army: money(Math.max(0, gdp) * ERAS[era].army) });

/** Today's (2019) income per person above which a country counts as rich, as the starting budget judges it. */
export const RICH_INCOME = 20000;

/** Total spending a year. */
export const spending =(e: Economy) => e.budget.army + e.budget.industry + e.budget.social + e.budget.other;
/** Revenue minus spending: negative is a deficit. */
export const balance = (e: Economy) => e.budget.revenue - spending(e);

/**
 * Money a government pays outside its budget's lines – a joint project, the Games, warheads, a launch site: from its
 * reserves, the rest borrowed, and counted in the deficit the crises, the economy minister, the panel and prices read
 * (Economy.offBudget, $bn a year over the turn of `years`). Mutates `e`.
 */
export function payOffBudget(e: Economy, cost: number, years: number): void {
  if (!(cost > 0)) return;
  const paid = Math.min(cost, Math.max(0, e.reserves));
  e.reserves = Math.round((e.reserves - paid) * 100) / 100;
  e.debt = Math.round((e.debt + cost - paid) * 100) / 100;
  e.offBudget = money((e.offBudget ?? 0) + cost / Math.max(1 / 52, years));
}

/** The deficit a government runs, $bn a year: spending past revenue, the interest on its debt and what it paid outside the budget. */
export const deficitOf = (e: Economy, interest: number) => -balance(e) + interest + (e.offBudget ?? 0);

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
    // the army stays what it is, but never more than half of what is left: a government that has lost its land does not
    // borrow for an army it cannot use. Without this a state that lost most of its land kept its whole civil budget on a
    // fraction of its taxes, and printed money for decades.
    for (const line of ["industry", "social", "other"] as const) e.budget[line] = money(e.budget[line] * ratio);
    if (ratio < 1) e.budget.army = money(Math.min(e.budget.army, LANDLESS_ARMY * gdp));
  }
}

/** The most of its output a government that has lost land keeps spending on its army. */
const LANDLESS_ARMY = 0.5;

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
  /** $bn a year of resources it must buy abroad, before any cut. */
  importNeed: number;
  /** $bn a year of resources cut off with their stores empty: what the economy goes without (gold, a store of value, aside). */
  goneWithout: number;
  /** Resources it goes short of: imports cut and the stores empty (gold aside). */
  shortages: ResourceType[];
  /** The value (people times income) of the land it holds of its own: its resource appetites go with it (Economy.land). */
  held: number;
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
  "1933": {
    usa: { oil: 1.8 },
    uk: { oil: 0.4, iron: 0.6 },
    germany: { oil: 0.35, iron: 1.4 },
    france: { oil: 0.5 },
    italy: { oil: 0.3, coal: 0.5 },
    japan: { oil: 0.6 },
    canada: { oil: 1.5, coal: 1.7 },
    ussr: { iron: 1.5 },
    poland: { coal: 0.75 },
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
  "1957": {
    usa: { oil: 1.75, iron: 1.35 },
    uk: { oil: 0.55, coal: 0.9 },
    ussr: { oil: 0.7, coal: 1.15, iron: 1.8 },
    "west-germany": { coal: 1.3, iron: 1.7 },
    china: { coal: 0.6 },
    japan: { oil: 0.4 },
    canada: { oil: 1.5, coal: 1.2 },
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
  "1973": {
    usa: { oil: 1.6, iron: 0.8 },
    ussr: { oil: 1.2, gas: 1.2, coal: 1.3, iron: 2.5 },
    japan: { oil: 1.6, iron: 2.5 },
    "west-germany": { coal: 1.1, iron: 1.5 },
    china: { coal: 1.6, iron: 2 },
    uk: { coal: 1 },
    canada: { oil: 1.3 },
    france: { coal: 0.8 },
  },
  "1979": {
    usa: { oil: 1.5, iron: 0.6 },
    ussr: { oil: 1.3, gas: 1.3, coal: 1.3, metals: 2, iron: 3 },
    japan: { oil: 1.4, iron: 2.3 },
    "west-germany": { coal: 1.1, iron: 1.3 },
    china: { coal: 1.6, metals: 2, iron: 2.5 },
    uk: { coal: 0.9 },
    "south-korea": { oil: 1.3, metals: 1.8 },
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
 * A country's weight in the world's use of a resource, before its people and income. A heavy appetite was the land's
 * that justified it – Ukraine's iron the Donbas's and Kryvyi Rih's steel towns – so its excess over 1 goes with that
 * land: scaled by `kept`, the share of the land's value it held when the books began that it still holds.
 */
function intensity(era: ScenarioId, tag: string, type: ResourceType, kept = 1): number {
  const k = USE[era][tag];
  const factor = k?.[type] ?? (METALS.includes(type) ? k?.metals : undefined) ?? 1;
  return factor > 1 ? 1 + (factor - 1) * clamp(kept, 0, 1) : factor;
}

/** Of the land a country held when its books began (Economy.land), the share it still holds. */
const keptLand = (e: Pick<Economy, "land"> | undefined, a: Pick<Accounts, "held"> | undefined) => (e?.land && a ? clamp(a.held / e.land, 0, 1) : 1);

/** Months of need the stores refill by in a year while the imports come; a cut slows it in proportion. */
const REFILL = 3;

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
 * reactors (engine/energy.ts). What a country produces beyond its need is
 * exported, what it lacks is imported — unless its imports are cut, and then
 * it lives off its stores.
 */
export function nationalAccounts(state: Pick<GameState, "countries" | "regions" | "scenarioId" | "date"> & Partial<Pick<GameState, "player" | "politics" | "energy">>, regions: Record<string, MapRegion>): Map<string, Accounts> {
  const era = ERAS[state.scenarioId];
  const year = yearOf(state.date);
  const out = new Map<string, Accounts>();
  const get = (tag: string) => {
    let a = out.get(tag);
    if (!a) {
      a = { population: 0, mobilisable: 0, production: {}, need: {}, trade: {}, exports: 0, imports: 0, importNeed: 0, goneWithout: 0, shortages: [], held: 0 };
      out.set(tag, a);
    }
    return a;
  };
  const world: Partial<Record<ResourceType, number>> = {};
  // Output of the land each country owns, whoever holds it, or holds behind the front until a peace (engine/occupation.ts).
  const owned = new Map<string, Partial<Record<ResourceType, number>>>();
  // People of captured land behind the front: counted as the captor's, few of them called up.
  const captured = new Map<string, number>();
  // How hard each holder works its mines and wells (engine/development.ts): what it digs past the land's own output is
  // counted in the world's too, so the world's need still equals its output.
  const worked = new Map<string, number>();
  for (const [tag, c] of Object.entries(state.countries)) if (c.economy?.extraction) worked.set(tag, extractionOf(c.economy));
  for (const [id, r] of Object.entries(state.regions)) {
    const p = regions[id];
    if (!p) continue;
    const by = countsFor(r);
    const n = peopleIn(r, p);
    get(by).population += n;
    if (by !== r.owner) captured.set(by, (captured.get(by) ?? 0) + n);
    if (r.controller === by) get(by).held += n * provinceIncome(p, state.scenarioId);
    for (const { type, output } of activeResources(p, year)) {
      const held = get(r.controller);
      const amount = linearOutput(output);
      const dug = amount * (worked.get(r.controller) ?? 1);
      held.production[type] = (held.production[type] ?? 0) + dug;
      world[type] = (world[type] ?? 0) + dug;
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
    // Uranium by the reactors and bombs (engine/energy.ts): the start date's, moved by the reactors built and lost since.
    if (type === "uranium") return uraniumCall(state, tag);
    const home = HOME[type] ?? 0;
    const total = world[type] ?? 0;
    if (!weights || !total) return 0;
    return intensity(state.scenarioId, tag, type, keptLand(state.countries[tag]?.economy, out.get(tag))) * ((1 - home) * ((weight.get(tag) ?? 0) / weights) + home * ((owned.get(tag)?.[type] ?? 0) / total));
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
      else if (surplus < 0) {
        const lack = -surplus * price;
        const cut = c.economy.tradeCut;
        a.importNeed += lack;
        a.imports += lack * (1 - cut);
        // Short only of what is cut off once the stores are empty, and only of that share: a cut of a tenth costs a little,
        // a blockade a lot. Gold is a store of value, not an input: its lack stops no factory.
        if (cut > 0 && type !== "gold" && (c.economy.stocks[type] ?? DEFAULT_STOCK_MONTHS) <= 0) {
          a.shortages.push(type);
          a.goneWithout += lack * cut;
        }
      }
    }
    a.exports = round(a.exports, 2);
    a.imports = round(a.imports, 2);
    a.importNeed = round(a.importNeed, 2);
    a.goneWithout = round(a.goneWithout, 3);
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

/**
 * Limits a proposed change to what the country can do: no budget line more than triples in a turn, taxes stay below
 * 70% of GDP. With the era (the game master's answer), the "other" line is cut no lower than half its usual share in
 * one go, nor by more than a quarter at once below it: the state's upkeep is not every order's purse.
 */
export function limitChange(change: EconomyChange, current: Economy, era?: ScenarioId): EconomyChange {
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
  out.other = limitOther(level(change.other, current.budget.other, current.gdp * 0.5), current, era);
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
/** Debt past this many years of GDP makes a government default – the player's as any other; what is left after the write-down. */
const DEFAULT_DEBT = 3;
const RESTRUCTURED_DEBT = 1.2;
/** Years after a default in which lenders lend nothing: a deficit the reserves cannot meet is printed. */
export const DEFAULT_YEARS = 3;
/** Points a year prices rise while a deficit is printed, for each point of GDP printed, and the most. */
const PRINT_RISE = 0.8;
const PRINT_MAX_RISE = 40;
/** The pull a deficit borrowed puts on prices is bounded: past four points of GDP it approaches this many points. */
const DEFICIT_PULL = 40;
/** The pull on prices of a shortage that cuts off all the resources it must import. */
const SHORTAGE_PULL = 10;
/** The surplus, as a share of GDP, a government abroad with little debt keeps before it gives the rest back. */
const SURPLUS_KEPT = 0.02;
/** Most of a year's GDP the trade in strategic resources moves the reserves by, before the share that reaches them. */
const TRADE_HELD = 0.25;
/** Of the gap between unemployment and the era's usual level, the share that closes in a year. */
const UNEMPLOYMENT_RETURN = 0.2;
/**
 * Growth points a doubling of the industry budget past the era's usual share
 * of GDP buys, and the most it can (factories, roads and power take years to
 * build and pay back less the more there are); cut below the usual share, the
 * points lost per halving and the most that can be lost. Calibrated on the
 * policies (programmes.ts: 0.8% of GDP more for industry, half a point).
 */
const INVEST_GAIN = 1.2;
const INVEST_MAX = 2;
const INVEST_LOSS = 1;
const INVEST_MAX_LOSS = 1.5;
/** Taxes past the era's usual take for a rich country by this share of GDP start to hold growth back, by this many points per point of GDP. */
const TAX_ROOM = 0.05;
const TAX_DRAG = 0.08;
/**
 * A war on a country's own soil: the share of output it holds the economy
 * below its level while the fronts are there, by the share of its people on
 * them, and the most. The output of occupied land and of the people who flee
 * is already lost to it (followLand); this is the rest – bridges, railways,
 * factories and fields near the front. The blow is hardest when the war
 * arrives; an economy then learns to work around a front that stands, and
 * keeps three tenths of the gap while it stands (Ukraine shrank by a third in
 * 2022 and grew again in 2023). A level, not a toll on growth: a toll of
 * points a year compounded for as long as the front stood.
 */
const HOME_WAR = 0.02;
/** The share of its people on the front from which a war counts fully as fought at home: a skirmish in one far colony is not. */
const HOME_WAR_FULL = 0.05;
const HOME_WAR_FRONT = 0.25;
const HOME_WAR_MAX = 0.1;
const HOME_WAR_KEPT = 0.3;
/** Years over which the rest of the war's toll fades as the economy adapts (to a third in about nine months). */
const HOME_WAR_ADAPT = 0.75;
/** The share of output a shortage of electricity takes for each share of the demand unmet: a third of it missing, about an eighth of output. */
const POWER_LOSS = 0.4;
/** Trade cut off – imports gone without, exports lost – takes its value from output, up to this share of it. */
const TRADE_LOSS_MAX = 0.3;
/** Strategic bombing holds output below its level by up to this many years of the share it takes a year; repaired over about a year once it stops. */
const BOMB_LEVEL = 3;
const REPAIR_YEARS = 1;
/** All the losses of level together take no more than this share of output. */
const LOSSES_MAX = 0.6;
/** Plants under construction take about this share of the industry line in an ordinary year; what they take past it is not invested elsewhere. */
const PLANTS_USUAL = 0.15;
/** The shares of the army and industry budgets that go to research (engine/research.ts): the industry line's is spent there, not again on factories. */
export const RESEARCH_POOL = { army: 0.2, industry: 0.3 };
/** Share of GDP a soldier called up from work takes with him, against his share of the workforce: the army pays him, but he no longer makes anything. */
const DRAFT_COST = 0.4;

/**
 * What a change in soldiers from `from` to `e.troops` does to output: men called up from work no longer make anything –
 * output falls by their share of the workforce, less those the draft takes from among the jobless – and men sent home in
 * peace go back to work where there are jobs for them; those a war takes do not come back. The labour of the men under
 * arms is charged here once; a long mobilisation's strain takes only the rest (engine/mobilisation.ts). One path for
 * every call-up: the game master's and the engine's. Mutates `e` (GDP and taxes).
 */
export function draftOutput(e: Economy, from: number, ctx: { population: number; unemployment: number; normal: number; atWar: boolean }): void {
  const workforce = ctx.population * WORKFORCE;
  if (workforce <= 0) return;
  const jobless = (Math.max(0, ctx.unemployment - ctx.normal / 2) / 100) * workforce;
  const fromWork = Math.max(0, e.troops - from - jobless);
  const home = ctx.atWar || ctx.unemployment > ctx.normal ? 0 : Math.max(0, from - e.troops);
  const ratio = clamp(1 - (DRAFT_COST * (fromWork - home)) / workforce, 0.7, 1.1);
  if (ratio === 1) return;
  e.gdp = money(e.gdp * ratio);
  e.budget.revenue = money(e.budget.revenue * ratio);
}
/** How far the game master's growth may stray from what the engine's causes give, points below and above: past them it would count again what the land lost already takes. */
const GROWTH_BELOW = 10;
const GROWTH_ABOVE = 6;
/** How fast a growth already outside those bounds is pulled into them while the game master holds it there, a year: 63% of the way in six months. */
const HOLD_PULL = 2;
/** The army's share of GDP a government abroad moves to in a war fought on its own soil (at least), and against the era's usual share in a war abroad. */
const WAR_FOOTING_HOME = 0.1;
const WAR_FOOTING_HOME_ERA = 3;
const WAR_FOOTING_ABROAD_ERA = 1.5;
/** Of a war's rise in the army budget, the share raised in war taxes; the rest is borrowed. */
const WAR_TAXES = 0.3;
/** How fast the army budget goes to a war footing and back, a year: 86% of the way in half a year, whatever the turn's length. */
const WAR_PACE = 4;

/** In a war that is not under a truce. */
function fighting(state: Partial<Pick<GameState, "wars" | "date">>, tag: string): boolean {
  return (state.wars ?? []).some((w) => (w.attackers.includes(tag) || w.defenders.includes(tag)) && !(w.truce && state.date && w.truce.until > state.date));
}

/**
 * Share of each country's own people whose province is a front or under an
 * enemy's guns – where its war is fought at home. Land the front has left
 * behind in an enemy's hands has left the country's economy (followLand) and
 * counts no more.
 */
export function frontsAtHome(regions: Record<string, RegionState>, map: Record<string, MapRegion>, colonial?: ReadonlySet<string>): Map<string, number> {
  const people = new Map<string, number>();
  const front = new Map<string, number>();
  for (const [id, r] of Object.entries(regions)) {
    const p = map[id];
    // A colony's land is not the metropole's own soil: a colonial war there is a war away (engine/colonialLand.ts).
    if (!p || heldBehind(r) || colonial?.has(id)) continue;
    const n = peopleIn(r, p);
    people.set(r.owner, (people.get(r.owner) ?? 0) + n);
    if (r.contested || r.controller !== r.owner) front.set(r.owner, (front.get(r.owner) ?? 0) + n);
  }
  const out = new Map<string, number>();
  for (const [tag, n] of front) {
    const all = people.get(tag) ?? 0;
    if (all > 0 && n > 0) out.set(tag, n / all);
  }
  return out;
}

/** What drives a country's growth, points a year: the engine's causes, which the game master may move within bounds. */
export interface GrowthCauses {
  /** The era's trend. */
  trend: number;
  /** Policies at work (programmes.ts). */
  policies: number;
  /** The industry budget against the era's usual share. */
  investment: number;
  /** Taxes past the era's usual take. */
  taxes: number;
  /** The state's upkeep run down by an "other" line kept below its usual share. */
  upkeep: number;
  /** What holds output below its level, % of it (Economy.losses, Economy.strained): not points a year, a gap kept while its cause stands. */
  losses: GrowthLosses;
  /** A crisis that caps growth whatever its causes say (engine/crises.ts crisisLimits): the cap, points a year, and the crisis. */
  cap?: { value: number; by: CapCause };
}

/** The losses of level, % of output. */
export interface GrowthLosses {
  /** Trade cut off: imports gone without, exports lost to sanctions. */
  trade: number;
  /** A war on the country's own soil. */
  war: number;
  /** Electricity it went without (engine/energy.ts). */
  power: number;
  /** Strategic bombing. */
  bombing: number;
  /** A long mobilisation's strain (engine/mobilisation.ts). */
  strain: number;
}

/** The crises that cap growth. */
export type CapCause = "inflation" | "debt";

/**
 * What the budget's industry line and taxes do to growth, points a year; what policies add to the industry line is theirs
 * (programmes.ts) and not counted twice. Power plants are investment like any other, so the whole line counts here; it is
 * the consumer factories and the mines that do not get what the plants took (industryInvested). The line's split between
 * heavy and light industry is in its investment (engine/industry.ts): money tilted to heavy industry builds more, to light
 * industry less (`split`).
 */
export function budgetGrowth(e: Pick<Economy, "gdp" | "budget"> & Partial<Pick<Economy, "tilt">>, era: ScenarioId, policyIndustry = 0): { investment: number; taxes: number; split: number } {
  const E = ERAS[era];
  const gdp = Math.max(0.01, e.gdp);
  const ratio = Math.max(0, e.budget.industry / gdp - policyIndustry) / E.industry;
  const investment = ratio >= 1 ? Math.min(INVEST_MAX, INVEST_GAIN * Math.log2(ratio)) : Math.max(-INVEST_MAX_LOSS, INVEST_LOSS * Math.log2(Math.max(ratio, 1 / 8)));
  const taxes = Math.max(0, e.budget.revenue / gdp - E.revenue[0] - TAX_ROOM) * 100 * TAX_DRAG;
  const split = splitGrowth(tiltOf(e), ratio);
  return { investment: round(investment + split, 2), taxes: round(taxes, 2), split };
}

// --- the state's upkeep: the "other" line ------------------------------------

/** The era's floor for the state's running costs, share of GDP: a little under what the leanest of its usual budgets (a poor country's) leaves for them. */
const OTHER_FLOOR = (era: ScenarioId) => 0.12 * ERAS[era].revenue[1];
/** The state's running costs take at least this share of what it collects: every starting budget leaves them that much. */
const OTHER_OF_REVENUE = 0.15;
/** Points of growth a state run down to nothing costs a year: roads, power lines and offices decaying, permits and courts stalled. */
const UPKEEP_DRAG = 2.5;
/** Years over which the "other" line kept low wears the state down (the time constant), and over which restoring it mends it. */
const NEGLECT_YEARS = 1.5;
const MEND_YEARS = 1;
/** One answer may take the "other" line no lower than this share of its usual level, nor cut more than this share of it at once. */
const OTHER_TURN_FLOOR = 0.5;
const OTHER_TURN_CUT = 0.25;

/** What one ministry the government created adds to the state's usual running costs, and what one it closed saves (its work goes elsewhere). */
export const MINISTRY_UPKEEP = 0.02;
export const MINISTRY_SAVING = 0.015;

/**
 * How the player's cabinet weighs on the "other" line's usual share: each ministry created adds its offices, staff and
 * buildings, each standard one closed saves a little less than it cost (engine/ministries.ts). Other countries, and the
 * standard eight, are the usual.
 */
export function cabinetUpkeep(state: Partial<Pick<GameState, "cabinetShape" | "player">>, tag: string): number {
  if (tag !== state.player || !state.cabinetShape) return 1;
  const created = state.cabinetShape.created?.length ?? 0;
  const closed = state.cabinetShape.closed?.length ?? 0;
  return Math.max(0.8, 1 + MINISTRY_UPKEEP * created - MINISTRY_SAVING * closed);
}

/**
 * The usual share of GDP for the "other" line – the administration, police,
 * courts, roads and the state's upkeep: a seventh of what the government
 * collects, never less than the era's floor, and more for a cabinet with
 * ministries of its own making (cabinetUpkeep). Above it more brings little;
 * below it the state runs down.
 */
export function otherNorm(e: Pick<Economy, "gdp" | "budget" | "war">, era: ScenarioId, cabinet = 1): number {
  // War taxes are raised for the war (Economy.war), not for the offices.
  const collected = Math.max(0, e.budget.revenue - WAR_TAXES * (e.war ?? 0));
  return Math.max(OTHER_FLOOR(era), (OTHER_OF_REVENUE * collected) / Math.max(0.01, e.gdp)) * cabinet;
}

/** A line within a tenth of its usual share is the usual: war taxes or a deficit closed by taxes do not run the state down. */
const OTHER_GRACE = 0.9;

/** How far the "other" line falls short of its usual share, 0–1: none within a tenth of it, about half at half of it, all at nothing. */
export function otherShortfall(e: Pick<Economy, "gdp" | "budget" | "war">, era: ScenarioId, cabinet = 1): number {
  return clamp(1 - e.budget.other / Math.max(0.01, e.gdp) / otherNorm(e, era, cabinet) / OTHER_GRACE, 0, 1);
}

/** The state's run-down after `years`: towards the shortfall – deeper the further and the longer the line is cut – and mended, a little faster, as it is restored. */
export function advanceNeglect(was: number, shortfall: number, years: number): number {
  const tau = shortfall > was ? NEGLECT_YEARS : MEND_YEARS;
  const next = was + (shortfall - was) * (1 - Math.exp(-Math.max(0, years) / tau));
  return next < 0.001 ? 0 : round(next, 4);
}

/** What a run-down state costs growth, points a year (none or negative). */
export const upkeepDrag = (neglect = 0) => -round(UPKEEP_DRAG * clamp(neglect, 0, 1), 2);

/** Holds one answer's cut of the "other" line: never below half its usual level in one go, nor more than a quarter of it at once below that level. */
function limitOther(value: number | undefined, current: Economy, era: ScenarioId | undefined): number | undefined {
  if (value === undefined || !era) return value;
  const norm = otherNorm(current, era) * current.gdp;
  if (value >= norm) return value;
  return round(Math.max(value, Math.min(current.budget.other, Math.max(norm * OTHER_TURN_FLOOR, current.budget.other * (1 - OTHER_TURN_CUT)))), 2);
}

/**
 * The shares of GDP the budget is judged against, for the panel's hints: the
 * era's usual industry line, the social line the people's provision is
 * measured by (a rich country's or a poor one's, as engine/provision.ts
 * judges it), and the tax take past which growth is held back.
 */
export function budgetNorms(state: Pick<GameState, "regions" | "scenarioId"> & Partial<Pick<GameState, "countries" | "cabinetShape" | "player">>, tag: string, map: Record<string, MapRegion> | null): { industry: number; social: number; taxes: number; other: number } {
  const E = ERAS[state.scenarioId];
  let people = 0;
  let richness = 0;
  if (map) {
    for (const [id, r] of Object.entries(state.regions)) {
      if (countsFor(r) !== tag) continue;
      const n = peopleIn(r, map[id]);
      people += n;
      richness += n * (map[id]?.inc ?? 3000);
    }
  }
  const e = state.countries?.[tag]?.economy;
  return { industry: E.industry, social: socialNorm(state.scenarioId, people > 0 && richness / people >= RICH_INCOME), taxes: E.revenue[0] + TAX_ROOM, other: e ? otherNorm(e, state.scenarioId, cabinetUpkeep(state, tag)) : OTHER_FLOOR(state.scenarioId) };
}

/** The share of GDP the policies at work add to the industry line (engine/programmes.ts). */
function policyIndustry(country: Pick<GameState["countries"][string], "programmes">, date: string): number {
  return (country.programmes ?? []).reduce((s, p) => s + (p.until > date ? (p.lines?.industry ?? 0) : 0), 0);
}

/** A war on soil whose `share` of the people live on a front, fought for `years`: the share of output it holds back. */
export function homeWarLoss(share: number, years = 0): number {
  if (share <= 0.003) return 0;
  return Math.min(HOME_WAR_MAX, HOME_WAR * Math.min(1, share / HOME_WAR_FULL) + HOME_WAR_FRONT * share) * (HOME_WAR_KEPT + (1 - HOME_WAR_KEPT) * Math.exp(-Math.max(0, years) / HOME_WAR_ADAPT));
}

/** The losses of level together, as one share of output: each takes its share of what the others leave. */
export function lossOf(losses: OutputLosses | undefined): number {
  if (!losses) return 0;
  const left = (["power", "trade", "war", "bombing"] as const).reduce((k, key) => k * (1 - clamp(losses[key] ?? 0, 0, 1)), 1);
  return Math.min(LOSSES_MAX, 1 - left);
}

/** What the output of a country lost to every standing cause comes to, share of what it would make: the levels and the mobilisation's strain. */
export const heldDown = (e: Pick<Economy, "losses" | "strained">) => 1 - (1 - lossOf(e.losses)) * (1 - (e.strained ?? 0));

/**
 * The losses of level a country's standing causes hold it at now: the shortage of electricity over the last turn, trade
 * cut off (`trade`, $bn a year: imports gone without once the stores are empty, exports lost), the war on its own soil,
 * and strategic bombing (`bombed`, the share of output it takes a year), which wears the economy down towards three years
 * of it while it lasts and is repaired over about a year once it stops. `potential` is the output without the losses.
 */
export function outputLosses(was: OutputLosses | undefined, ctx: { short: number; trade: number; potential: number; atHome: number; warYears: number; bombed: number; years: number }): OutputLosses {
  const out: OutputLosses = {};
  const set = (key: keyof OutputLosses, v: number) => {
    if (v >= 0.0005) out[key] = round(v, 4);
  };
  set("power", POWER_LOSS * clamp(ctx.short, 0, 1));
  set("trade", Math.min(TRADE_LOSS_MAX, ctx.potential > 0 ? Math.max(0, ctx.trade) / ctx.potential : 0));
  set("war", homeWarLoss(ctx.atHome, ctx.warYears));
  const bombedWas = was?.bombing ?? 0;
  const target = BOMB_LEVEL * Math.max(0, ctx.bombed);
  set("bombing", target >= bombedWas ? bombedWas + Math.min(target - bombedWas, ctx.bombed * ctx.years) : bombedWas - (bombedWas - target) * (1 - Math.exp(-ctx.years / REPAIR_YEARS)));
  return out;
}

/**
 * The industry line as the consumer factories and the mines read it (engine/development.ts), $bn a year: the line is spent
 * once – the research pool takes its share (RESEARCH_POOL, engine/research.ts), the plants under construction what they
 * took over the last turn (`plants`, engine/energy.ts), and the rest builds factories and works the mines. Read against the
 * era's usual line, whose research share and ordinary plants (about a seventh of it, the world's GDP-weighted median) are
 * part of the usual too, so only the plants' spending past their usual share comes off.
 */
export function industryInvested(industry: number, plants = 0): number {
  const line = Math.max(0, industry);
  const research = RESEARCH_POOL.industry * line;
  const built = Math.max(PLANTS_USUAL * line, Math.max(0, plants));
  const rest = Math.max(0, line - research - built);
  // As a line of the usual shape: the rest scaled back up by the share the usual line leaves for it.
  return rest / (1 - RESEARCH_POOL.industry - PLANTS_USUAL);
}

/** Years from one day to another. */
const yearsBetween = (from: string, to: string) => Math.max(0, (Date.parse(to) - Date.parse(from)) / (365.25 * 86_400_000));

/** Years since the oldest war a country is fighting began, on `date`. */
function yearsAtWar(state: Partial<Pick<GameState, "wars">>, tag: string, date: string): number {
  const since = (state.wars ?? []).filter((w) => w.attackers.includes(tag) || w.defenders.includes(tag)).map((w) => w.since).sort()[0];
  return since ? Math.max(0, (Date.parse(date) - Date.parse(since)) / (365.25 * 86_400_000)) : 0;
}

// --- the trend each economy drifts to --------------------------------------

/** Growth of income per head at the frontier – the richest large economies – by era, % a year. */
const FRONTIER: [number, number][] = [
  [1914, 1.3],
  [1939, 1.6],
  [1950, 2.3],
  [1964, 2.6],
  [1975, 1.9],
  [1991, 1.8],
  [1999, 1.9],
  [2014, 1.3],
  [2022, 1.2],
];
/** A table of years read in a year: straight between its years, held beyond them (the world's pace is the calendar's, whatever date the game began on). */
function byYear(table: [number, number][], year: number): number {
  if (year <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    const [y1, v1] = table[i];
    if (year <= y1) {
      const [y0, v0] = table[i - 1];
      return v0 + ((v1 - v0) * (year - y0)) / (y1 - y0);
    }
  }
  return table[table.length - 1][1];
}
/**
 * Points of growth for each step of e between a country's income per head and the frontier's, at full capability
 * (conditional convergence, about 2% of the log gap a year): strongest in the post-war boom, when Europe and Japan
 * rebuilt and copied, weaker once most of the world could read and the gaps that remained were institutions'.
 */
const CATCH_UP: [number, number][] = [
  [1914, 1.5],
  [1939, 1.5],
  [1950, 2.2],
  [1964, 2],
  [1975, 1.4],
  [1991, 1.1],
  [1999, 1.2],
  [2014, 1.2],
  [2022, 1.1],
];
/** The gap a rich country does not close: catching up starts below two thirds of the frontier's income. */
const CLUB = Math.log(1.5);
const CATCH_UP_MAX = 6;
/** A large economy sets the frontier, a small oil state does not: thousands of people. */
const FRONTIER_PEOPLE = 10_000;
/** The trend's bounds, % a year: a country's drift is never a boom or a collapse of its own. */
const TREND_BOUNDS = [-3, 11] as const;
/** How well a kind of government turns a gap into growth: planned economies did well in the 1950s, badly by the 1980s. */
const REGIME_CAPABILITY: Record<RegimeKind, number> = { democracy: 1, limited: 0.85, party: 0.85, autocracy: 0.75, military: 0.75 };
const PARTY_ERA: [number, number][] = [
  [1914, 0.8],
  [1939, 0.9],
  [1950, 0.9],
  [1964, 0.8],
  [1975, 0.7],
  [1991, 0.6],
  [1999, 0.85],
];

/** How a country was governed on the start date, by the date's table (engine/abroad.ts regimeAtStart, read here without politics): the player's, which keeps no politics abroad. */
function regimeOnDate(era: ScenarioId, tag: string): RegimeKind {
  const table = REGIMES[era];
  for (const kind of ["democracy", "limited", "party", "military"] as const) if (table[kind].split(/\s+/).includes(tag)) return kind;
  return "autocracy";
}

/** What the trends of a turn read once: each country's people, their literacy on the start date and their natural growth; the frontier's income per head. */
export interface TrendBasis {
  people: Map<string, number>;
  literate: Map<string, number>;
  growth: Map<string, number>;
  frontier: number;
}

/** One pass over the provinces: people by the country that counts them, with the start's literacy and the map's natural growth. */
export function trendBasis(state: Pick<GameState, "countries" | "regions" | "scenarioId">, map: Record<string, MapRegion>): TrendBasis {
  const people = new Map<string, number>();
  const literate = new Map<string, number>();
  const growth = new Map<string, number>();
  const known = new Map<string, number>();
  for (const [id, r] of Object.entries(state.regions)) {
    const p = map[id];
    if (!p) continue;
    const n = peopleIn(r, p);
    if (n <= 0) continue;
    const tag = countsFor(r);
    let l = known.get(p.adm0);
    if (l === undefined) known.set(p.adm0, (l = literacyAtStart(p, state.scenarioId)));
    people.set(tag, (people.get(tag) ?? 0) + n);
    literate.set(tag, (literate.get(tag) ?? 0) + n * l);
    growth.set(tag, (growth.get(tag) ?? 0) + n * (p.gr ?? 0));
  }
  let frontier = 0;
  for (const [tag, n] of people) {
    literate.set(tag, (literate.get(tag) ?? 0) / n);
    growth.set(tag, (growth.get(tag) ?? 0) / n);
    const gdp = state.countries[tag]?.economy?.gdp ?? 0;
    if (n >= FRONTIER_PEOPLE && gdp > 0) frontier = Math.max(frontier, gdp / n);
  }
  return { people, literate, growth, frontier };
}

/** A country's trend and what it is made of, % a year. */
export interface Trend {
  trend: number;
  /** The frontier's growth of income per head. */
  frontier: number;
  /** Catching up with the frontier, as far as the country's capability allows. */
  catchUp: number;
  /** Its people's natural growth, the map's pace moved by its demography (engine/society.ts). */
  people: number;
  /** How much of its gap it can turn into growth, 0–1.2: schooling, government, stability, openness, peace. */
  capability: number;
  /** Its income per head against the frontier's, 0–1. */
  income: number;
}

/**
 * The growth a country's economy drifts to: the frontier's growth of income
 * per head, plus catching up – one to two points (by era) for each step of e
 * between its income per head and two thirds of the frontier's, at most six – times what
 * it can make of the gap (literacy past 30%, its kind of government, its
 * stability, trade open or cut, peace or a war at home), plus its people's
 * natural growth. Japan, West Germany and Italy of 1950 or South Korea of
 * 1964 catch up fast; a country that cannot read, an unstable, closed or
 * war-torn one lags; a rich one grows at the frontier's pace.
 */
export function countryTrend(
  state: Pick<GameState, "countries" | "scenarioId" | "date"> & Partial<Pick<GameState, "player" | "politics" | "society" | "wars">>,
  tag: string,
  basis: TrendBasis,
  ctx: { exportCut?: number; atHome?: number } = {},
): Trend {
  const era = state.scenarioId;
  const country = state.countries[tag];
  const e = country?.economy;
  const n = basis.people.get(tag) ?? 0;
  const year = yearFraction(state.date);
  const frontier = round(byYear(FRONTIER, year), 2);
  if (!e || n <= 0 || basis.frontier <= 0) return { trend: ERAS[era].trend, frontier, catchUp: 0, people: 0, capability: 0, income: 1 };
  const income = clamp(e.gdp / n / basis.frontier, 0.001, 1);
  const years = Math.max(0, year - Number(era));
  const literate = literacyNow(basis.literate.get(tag) ?? 50, years, state.society?.[tag]?.shift?.literate ?? 0);
  const regime = country.domestic?.regime ?? regimeOnDate(era, tag);
  const stability = country.domestic?.stability ?? (tag === state.player && state.politics ? 100 - state.politics.unrest : 60);
  const atWar = fighting(state, tag);
  const human = clamp((literate - 30) / 65, 0, 1) ** 1.5;
  const governed = REGIME_CAPABILITY[regime] * (regime === "party" ? byYear(PARTY_ERA, year) / 0.85 : 1);
  const steady = clamp(0.4 + stability / 100, 0.5, 1.2);
  const open = clamp(1 - 0.8 * e.tradeCut, 0.3, 1) * (1 - 0.5 * clamp(ctx.exportCut ?? 0, 0, 1));
  const peace = atWar ? 0.85 * clamp(1 - 3 * (ctx.atHome ?? 0), 0.2, 1) : 1;
  const capability = round(human * governed * steady * open * peace, 2);
  const catchUp = round(clamp(byYear(CATCH_UP, year) * capability * Math.max(0, -Math.log(income) - CLUB), 0, CATCH_UP_MAX), 2);
  const people = round(clamp((basis.growth.get(tag) ?? 0) + (state.society?.[tag]?.drift ?? 0), -2, 4), 2);
  return { trend: round(clamp(frontier + catchUp + people, TREND_BOUNDS[0], TREND_BOUNDS[1]), 2), frontier, catchUp, people, capability, income: round(income, 3) };
}

/**
 * The engine's causes of a country's growth now, for the panel and the game
 * master: the trend, its policies, its industry budget and taxes, the
 * state's upkeep; beside them what holds its output below its level – trade
 * cut off, the war at home, a shortage of electricity, bombing, the strain
 * of a long mobilisation – as they stood after the last turn; and a
 * crisis's cap over them all.
 */
export function growthCauses(
  state: Pick<GameState, "countries" | "regions" | "scenarioId" | "date"> & Partial<Pick<GameState, "player" | "wars" | "politics" | "sanctions" | "society" | "energy">>,
  tag: string,
  map: Record<string, MapRegion> | null,
  accounts?: Accounts,
  exportCut = 0,
): GrowthCauses | null {
  const country = state.countries[tag];
  const e = country?.economy;
  if (!e) return null;
  const { investment, taxes } = budgetGrowth(e, state.scenarioId, policyIndustry(country, state.date));
  // A colony's land is not the metropole's home (engine/colonialLand.ts): a colonial war is fought abroad.
  const share = map && fighting(state, tag) ? (frontsAtHome(state.regions, map, colonialOf(state, map).land).get(tag) ?? 0) : 0;
  const pct = (v: number | undefined) => round((v ?? 0) * 100, 1);
  const limits = crisisLimits(e, accounts, state.scenarioId, state.date);
  return {
    trend: map ? countryTrend(state, tag, trendBasis(state, map), { exportCut, atHome: share }).trend : ERAS[state.scenarioId].trend,
    policies: programmeShift(country, state.date).growth,
    investment,
    taxes: -taxes,
    upkeep: upkeepDrag(e.neglect),
    losses: { trade: pct(e.losses?.trade), war: pct(e.losses?.war), power: pct(e.losses?.power), bombing: pct(e.losses?.bombing), strain: pct(e.strained) },
    ...(limits.growthCap !== undefined && limits.capBy ? { cap: { value: limits.growthCap, by: limits.capBy } } : {}),
  };
}

/**
 * Moves every economy forward by one turn of `years`. The model's changes
 * land first (troops limited by who is left to call up, growth within
 * bounds of the engine's causes); what it leaves alone, the engine moves by
 * cause:
 * - growth drifts back towards the era's trend, more with industry
 *   spending past the era's usual share and less with taxes far past its
 *   usual take or a state run down; a crisis caps it whatever the model says;
 * - standing causes hold output below its level while they last and give it
 *   back as they go (Economy.losses): trade cut off, a shortage of
 *   electricity, a war on the country's own soil, strategic bombing – levels,
 *   not tolls on growth that compound for as long as the cause stands;
 * - men called up from work take their share of output with them, and men
 *   sent home in peace bring it back where there are jobs;
 * - a government abroad at war raises its army budget to a war footing,
 *   and gives the rise back after the peace;
 * - inflation drifts back towards the era's norm, held up by a deficit (its
 *   pull bounded), cut imports and a shortage as deep as it is, and driven up
 *   by a deficit printed as far as it is printed;
 * - unemployment follows growth against the trend and output lost or given
 *   back by the standing causes, and falls as men are called up;
 * - a bigger army costs more: half its budget follows the number of soldiers;
 * - a blockade the model reported fades once the country is at peace, never
 *   below the sanctions in force;
 * - GDP grows with real growth and the dollar, an untouched budget keeps its
 *   share of GDP, and a government abroad with a deficit it cannot carry
 *   trims spending and raises taxes;
 * - the interest on the debt is paid every turn; a deficit with it is met
 *   partly from the reserves while they stand above half the era's normal
 *   holdings, the rest borrowed – or printed, as far as lenders will not lend
 *   (crises.ts crisisLimits: a government without reserves past a tenth of
 *   GDP a year or past one and a half years of GDP in debt, and anyone for
 *   some years after a default); a surplus pays down half of what is owed and
 *   puts the rest by; the trade in strategic resources moves the reserves,
 *   and the rest of the economy pulls them back into a band of half to twice
 *   the era's normal holdings (less so when trade is cut); what the reserves
 *   cannot cover is borrowed; debt past three years of GDP is defaulted on,
 *   the player's as any other's;
 * - goods bought abroad for the people are paid from the reserves
 *   (engine/development.ts goodsLine);
 * - the consumer factories and the mines worked harder move with the
 *   industry line, less what the plants under construction took past their
 *   usual share, the policies that build and the research lead
 *   (engine/development.ts);
 * - a country whose imports are cut lives off its stores, which refill by
 *   the imports that still come.
 * Pure; returns the new economies by country.
 */
export function advanceEconomies(
  state: Pick<GameState, "countries" | "regions" | "scenarioId" | "date"> & Partial<Pick<GameState, "player" | "wars" | "politics" | "research" | "society" | "energy">>,
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
  const fronts = regions ? frontsAtHome(state.regions, regions, colonialOf(state, regions).land) : new Map<string, number>();
  const basis = regions ? trendBasis(state, regions) : null;
  const byCountry = new Map(changes.map((c) => [c.country, c]));
  const strained = { countries: state.countries, wars: state.wars ?? [], date: state.date };
  // Strategic bombing's share of output a year (engine/forces.ts), against each country's people.
  const people = new Map<string, { people: number }>();
  for (const [tag, a] of accounts ?? []) people.set(tag, { people: a.population });
  const bombed = state.wars?.length ? bombing({ countries: state.countries, wars: state.wars, date: state.date }, accounts ? people : undefined) : new Map<string, number>();
  const out: Record<string, Economy> = {};
  for (const [tag, country] of Object.entries(state.countries)) {
    const before = country.economy;
    if (!before) continue;
    const change = byCountry.get(tag) ?? { country: tag };
    const e: Economy = structuredClone(before);
    delete e.shock;
    delete e.war;
    // What is paid outside the budget's lines is counted afresh each turn by those who pay it (payOffBudget).
    delete e.offBudget;
    const a = accounts?.get(tag);
    const atWar = fighting(state, tag);
    const atHome = atWar ? (fronts.get(tag) ?? 0) : 0;
    const gdpBefore = Math.max(0.01, before.gdp);

    // A blockade or war cut the model reported lasts while the country fights, then fades by half a year; sanctions in force stay.
    const carried = change.tradeCut ?? (atWar ? before.tradeCut : before.tradeCut * 0.5 ** years);
    e.tradeCut = Math.max(carried < 0.02 ? 0 : round(carried, 2), cuts.get(tag) ?? 0);

    // What sanctions and cut imports take from the economy: exports lost (half of them sold elsewhere at a discount) and the
    // imports gone without once the stores are empty – a level of output while they last (outputLosses).
    const exportCut = exportCuts.get(tag) ?? 0;
    const lostExports = a ? a.exports * exportCut * 0.5 : 0;

    // Growth drifts towards the country's own trend (countryTrend: the frontier, catching up, its people), moved by the
    // policies at work (engine/programmes.ts) and by the budget: industry spending past the era's usual share builds, taxes
    // far past its usual take hold back, and a state whose administration, police and roads were run down by an "other"
    // line kept low grows less (upkeepDrag). A save from before the losses of level carried the war's toll in its growth
    // (Economy.shock): it is taken out before the drift.
    const shift = programmeShift(country, state.date).growth;
    const budgeted = budgetGrowth(before, state.scenarioId, policyIndustry(country, state.date));
    const steady = before.growth - (before.shock ?? 0);
    const trend = basis ? countryTrend(state, tag, basis, { exportCut, atHome }).trend : era.trend;
    const target = trend + shift + budgeted.investment - budgeted.taxes + upkeepDrag(before.neglect);
    const drifted = steady + (target - steady) * Math.min(1, years) * 0.5;
    // The game master's figure is taken within bounds of the engine's causes – no more than ten points below them or six
    // above: a country losing land has lost that output already (followLand), and a growth of −40% written every week on
    // top of it took it twice. The bounds stand on the causes, not on last turn's figure, so no answer can walk the growth
    // down (or up) turn by turn; a figure already outside them (a date's slump or boom) may be held, but it is pulled in.
    const held = steady + (target - steady) * (1 - Math.exp(-HOLD_PULL * years));
    const low = Math.min(target - GROWTH_BELOW, held);
    const high = Math.max(target + GROWTH_ABOVE, held);
    e.growth = rate(change.growth !== undefined ? clamp(change.growth, low, high) : drifted);

    // Crises bite whatever the game master says: no growth through hyperinflation or a debt crisis, and prices driven up
    // while the deficit is printed. A shortage is a loss of level (the trade cut off), not a cap besides.
    const limits = crisisLimits(before, a, state.scenarioId, state.date);
    if (limits.growthCap !== undefined) e.growth = Math.min(e.growth, limits.growthCap);

    // Prices drift back towards the era's norm, held up by a deficit beyond what lenders fund quietly – a pull that approaches
    // forty points however deep the deficit: hyperinflation comes from printing, not from a formula that follows the deficit
    // to any height – by cut imports, and by a shortage as deep as the share of the needed imports it cuts off.
    if (change.inflation !== undefined) e.inflation = change.inflation;
    else {
      const deficit = ((-balance(before) + interestOf(before, state.scenarioId) + (before.offBudget ?? 0)) / gdpBefore) * 100;
      const pull = deficit > 4 ? DEFICIT_PULL * (1 - Math.exp(-(deficit - 4) / DEFICIT_PULL)) : 0;
      const short = a && a.importNeed > 0 ? clamp(a.goneWithout / a.importNeed, 0, 1) : 0;
      const pressure = pull + e.tradeCut * 15 + SHORTAGE_PULL * short;
      e.inflation = rate(before.inflation + (Math.min(era.inflation, CALM_INFLATION) + pressure - before.inflation) * Math.min(1, years * 0.5));
    }
    // A deficit printed drives prices up as far as it is printed: eight points a year for a tenth of GDP.
    if (limits.printed > 0) e.inflation = Math.max(e.inflation, rate(before.inflation + Math.min(PRINT_MAX_RISE, PRINT_RISE * limits.printed * 100) * years));

    // In dollars, a country's own inflation is offset by its currency falling;
    // what it does to people is the model's to judge (growth, stability).
    const nominal = Math.max(0.05, (1 + e.growth / 100) * (1 + DOLLAR[state.scenarioId] / 100)) ** years;
    const gdp = before.gdp * nominal;
    for (const key of ["revenue", "army", "industry", "social", "other"] as const) {
      e.budget[key] = money(change[key] ?? before.budget[key] * nominal);
    }
    e.gdp = money(gdp);

    // Standing causes hold output below its level while they last (outputLosses): the GDP and the taxes move by the change
    // in the gap, so a cause that stands keeps it and growth returns to the trend, and one that goes gives it back. The trade
    // cut off is measured against the output without the gap, not as a larger share of a smaller economy each turn.
    const losses = outputLosses(before.losses, {
      short: shortOf(state, tag),
      trade: lostExports + (a?.goneWithout ?? 0),
      potential: gdpBefore / (1 - lossOf(before.losses)),
      atHome,
      warYears: yearsAtWar(state, tag, state.date),
      bombed: bombed.get(tag) ?? 0,
      years,
    });
    const levelRatio = (1 - lossOf(losses)) / (1 - lossOf(before.losses));
    if (Math.abs(levelRatio - 1) > 1e-9) {
      e.gdp = money(e.gdp * levelRatio);
      e.budget.revenue = money(e.budget.revenue * levelRatio);
    }
    if (Object.keys(losses).length) e.losses = losses;
    else delete e.losses;

    // Soldiers: no more than are left to call up, a third of them a month at most. A government abroad the model leaves
    // alone calls up its reserves as the enemy comes onto its soil and sends them home after the peace (engine/mobilisation.ts).
    const engineCall = tag !== state.player && change.troops === undefined && a ? warCallUp({ countries: state.countries, wars: state.wars ?? [] }, tag, { atWar, atHome, mobilisable: a.mobilisable, years }) : 0;
    const troopsChange = change.troops ?? (engineCall ? engineCall : undefined);
    if (troopsChange !== undefined) {
      const room = a ? Math.max(0, a.mobilisable - before.troops) : Infinity;
      const pace = a ? a.mobilisable * Math.min(1, years * 4) : Infinity;
      e.troops = Math.max(0, before.troops + Math.min(troopsChange, room, pace));
      // More soldiers cost more: their pay and kit follow their number unless the model set the army's budget itself.
      if (change.army === undefined && before.troops > 0) e.budget.army = money(Math.max(0, e.budget.army * (1 + PAY_SHARE * (e.troops / before.troops - 1))));
      draftOutput(e, before.troops, { population: a?.population ?? 0, unemployment: before.unemployment, normal: era.unemployment, atWar });
    }
    // The count of the reservists called up follows what was called and sent home; no more of them than the army has.
    const called = Math.min(e.troops, (before.called ?? 0) + (engineCall ? e.troops - before.troops : 0));
    if (called >= 0.1) e.called = Math.round(called * 10) / 10;
    else delete e.called;

    // A long mobilisation takes a share of output while it lasts – the soldiers' fatigue, the dead, the families waiting; the
    // labour of the men under arms is the draft's (draftOutput) – and gives it back as it eases (engine/mobilisation.ts): a
    // level, not a toll on growth that compounds for a decade.
    const loss = mobilisationLoss(strainOf(strained, tag, a?.population ?? 0)?.strain ?? 0);
    if (loss !== (before.strained ?? 0)) {
      const ratio = (1 - loss) / (1 - (before.strained ?? 0));
      e.gdp = money(e.gdp * ratio);
      e.budget.revenue = money(e.budget.revenue * ratio);
    }
    if (loss > 0) e.strained = loss;
    else delete e.strained;

    // Jobs follow growth against the trend (a point of unemployment for every two and a half of growth lost), and output
    // lost or given back by the standing causes alike; the called-up leave the workforce.
    if (change.unemployment !== undefined) e.unemployment = change.unemployment;
    else {
      const workforce = (a?.population ?? 0) * WORKFORCE;
      const drafted = workforce > 0 ? (Math.max(0, e.troops - before.troops) / workforce) * 100 : 0;
      // Half of the men sent home in peace look for work a while.
      const returned = workforce > 0 && !atWar ? (Math.max(0, before.troops - e.troops) / workforce) * 50 : 0;
      // Out of a slump, jobs come back slowly towards the era's usual level, rather than staying lost for decades.
      const back = (era.unemployment - before.unemployment) * Math.min(1, UNEMPLOYMENT_RETURN * years);
      const level = (levelRatio - 1) * 100;
      e.unemployment = rate(clamp(before.unemployment - 0.4 * (e.growth - trend) * years - 0.4 * level - drafted + returned + back, 0, 60));
    }

    // A government abroad pays for its war: its army budget rises towards a war footing in about half a year – half as much
    // again as the era's usual share in a war abroad, up to a tenth of GDP or three times the usual share as the front
    // reaches a twentieth of its people – three tenths of the rise in war taxes and the rest borrowed; after the peace it
    // gives the rise back as fast. Without it the United States fought in Korea on its peacetime budget.
    if (tag !== state.player && change.army === undefined) {
      const raised = (before.war ?? 0) * nominal;
      let war = raised;
      if (atWar) {
        const abroad = era.army * WAR_FOOTING_ABROAD_ERA;
        const footing = abroad + Math.max(0, Math.max(WAR_FOOTING_HOME, era.army * WAR_FOOTING_HOME_ERA) - abroad) * Math.min(1, atHome / HOME_WAR_FULL);
        const gap = footing * e.gdp - e.budget.army;
        if (gap > 0) {
          const rise = gap * (1 - Math.exp(-WAR_PACE * years));
          e.budget.army = money(e.budget.army + rise);
          if (change.revenue === undefined) e.budget.revenue = money(Math.min(e.gdp * 0.7, e.budget.revenue + rise * WAR_TAXES));
          war += rise;
        }
      } else if (raised > 0) {
        const cut = Math.min(raised, e.budget.army) * (1 - Math.exp(-WAR_PACE * years));
        e.budget.army = money(e.budget.army - cut);
        if (change.revenue === undefined) e.budget.revenue = money(Math.max(e.gdp * 0.05, e.budget.revenue - cut * WAR_TAXES));
        war -= cut;
      }
      if (war > e.gdp * 0.001) e.war = money(war);
    }

    // A government abroad that the model leaves alone keeps its books like most did: it lets run a deficit that does not raise
    // its debt against GDP (and a small one besides while the debt is moderate), and closes the rest a quarter a year, half by
    // trimming spending and half by taxes; past 90% of GDP it aims a point lower and moves twice as fast. A war is paid for first.
    const untouched = (["revenue", "army", "industry", "social", "other"] as const).every((k) => change[k] === undefined);
    if (tag !== state.player && untouched && !atWar) {
      const ratio = before.debt / gdpBefore;
      const heavy = ratio > 0.9;
      const steady = Math.max(0, ((1 + e.growth / 100) * (1 + DOLLAR[state.scenarioId] / 100) - 1) * ratio);
      const allowed = heavy ? Math.max(0, steady - 0.01) : Math.max(TOLERATED_DEFICIT, steady);
      const excess = -balance(e) + interestOf(before, state.scenarioId) - allowed * e.gdp;
      if (excess > 0) {
        const fix = excess * Math.min(1, years * (heavy ? 0.5 : 0.25));
        e.budget.revenue = money(Math.min(e.gdp * 0.5, e.budget.revenue + fix / 2));
        // Never below the state's usual upkeep at the new taxes (otherNorm): a government that balances its books does not starve its own administration.
        e.budget.other = money(Math.max(e.budget.revenue * OTHER_OF_REVENUE, Math.min(e.budget.other, e.gdp * OTHER_FLOOR(state.scenarioId)), e.budget.other - fix / 2));
      }
      // Nor does it hoard: a surplus past two points of GDP with little debt left goes back in lower taxes and more spending at home.
      const spare = balance(e) - interestOf(before, state.scenarioId) - SURPLUS_KEPT * e.gdp;
      if (spare > 0 && ratio < 0.3) {
        const give = spare * Math.min(1, years * 0.25);
        e.budget.revenue = money(Math.max(e.gdp * 0.05, e.budget.revenue - give / 2));
        e.budget.social = money(e.budget.social + give / 2);
      }
    }

    // Goods the people buy abroad while trade is open and the reserves allow are paid from them (engine/development.ts),
    // read as the provision panel showed them at the start of the turn.
    const lead = tag === state.player && state.research?.tech ? effortOf(state, tag, era.industry).lead : 0;
    const goods = goodsLine({
      army: before.budget.army / gdpBefore,
      inflation: before.inflation,
      cut: clamp(before.tradeCut, 0, 1),
      growth: before.growth,
      metalsLacking: a ? a.shortages.filter((t) => METALS.includes(t)).length : 0,
      broke: before.reserves / gdpBefore < 0.01,
      factories: before.factories ?? 0,
      research: researchGoods(lead),
      reserves: before.reserves / gdpBefore,
      reserveNorm: era.reserves,
      lean: leanOf(before),
    });
    const goodsBill = goods.imported * GOODS_VALUE * gdpBefore * years;

    // The books, every turn whatever the game master says. Loans it reports add to both the debt and the reserves.
    // The period's balance after interest: a deficit is met partly from the reserves above their floor, the rest borrowed –
    // but what lenders will not lend is printed (crisisLimits: `printed`), and printed money is no debt: never both;
    // a surplus pays down half of what is owed and puts the rest by.
    const borrow = change.borrow ?? 0;
    const norm = gdpBefore * era.reserves;
    const gap = balance(e) * years - interestOf(before, state.scenarioId) * years;
    let debt = before.debt + borrow;
    let reserves = before.reserves + borrow - goodsBill;
    if (gap < 0) {
      const drawn = Math.min(-gap * RESERVE_SHARE, Math.max(0, before.reserves - norm * RESERVE_FLOOR));
      reserves -= drawn;
      const owed = -gap - drawn;
      debt += owed - Math.min(owed, limits.printed * gdpBefore * years);
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
    // A government whose debt has outgrown its economy past any hope of paying – most often a state that lost most of its
    // land and kept its debt, or one that borrowed through a long war – defaults, the player's as any other: its creditors
    // write the debt down, and lend it nothing for some years after (crisisLimits), so what its reserves cannot meet is printed.
    if (debt > DEFAULT_DEBT * e.gdp) {
      debt = RESTRUCTURED_DEBT * e.gdp;
      e.defaulted = state.date;
    } else if (e.defaulted && yearsBetween(e.defaulted, state.date) > DEFAULT_YEARS) delete e.defaulted;
    e.debt = money(Math.max(0, debt));
    e.reserves = money(Math.max(0, reserves));
    // The land it held when its books began: its resource appetites go with that land (nationalAccounts).
    if (e.land === undefined && a && a.held > 0) e.land = money(a.held);

    // The factories and the mines move with this turn's industry line – less what the plants took past their usual share –
    // the policies that build and the research lead.
    const invested = { gdp: e.gdp, budget: { ...e.budget, industry: industryInvested(e.budget.industry, state.energy?.[tag]?.spent) } };
    advanceDevelopment(e, before, effortOf(state, tag, era.industry, invested), years);
    // The state's upkeep runs down while the "other" line in force stays below its usual share, and mends once it is restored.
    const neglect = advanceNeglect(before.neglect ?? 0, otherShortfall(e, state.scenarioId, cabinetUpkeep(state, tag)), years);
    if (neglect > 0) e.neglect = neglect;
    else delete e.neglect;

    // Stores, in months of need: the part of the imports cut off eats them, the imports that still come refill them (a cut
    // of a tenth leaves them full; one of a third of a resource bought abroad drains them in a couple of years), and a
    // surplus of its own refills them in full.
    if (a) {
      for (const type of RESOURCE_TYPES) {
        const need = a.need[type] ?? 0;
        if (!need) continue;
        const lack = Math.max(0, need - (a.production[type] ?? 0)) / need;
        const store = e.stocks[type] ?? DEFAULT_STOCK_MONTHS;
        const next = lack > 0 ? store + REFILL * (1 - e.tradeCut) * years - lack * e.tradeCut * years * 12 : store + REFILL * years;
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
    ...(e.shock !== undefined ? { shock: n(e.shock, -100 * HOME_WAR_MAX, 0) } : {}),
    ...(e.war !== undefined ? { war: n(e.war, 0) } : {}),
    ...(e.factories !== undefined ? { factories: n(e.factories, FACTORIES_BOUNDS[0], FACTORIES_BOUNDS[1]) } : {}),
    ...(e.extraction !== undefined ? { extraction: n(e.extraction, 1, EXTRACTION_MAX) } : {}),
    ...(e.neglect !== undefined ? { neglect: n(e.neglect, 0, 1) } : {}),
    ...(e.strained !== undefined ? { strained: n(e.strained, 0, MOBILISATION_LOSS) } : {}),
    ...(e.losses ? { losses: Object.fromEntries(Object.entries(e.losses).map(([k, v]) => [k, n(v ?? 0, 0, LOSSES_MAX)])) } : {}),
    ...(e.land !== undefined ? { land: n(e.land, 0) } : {}),
    ...(e.offBudget !== undefined ? { offBudget: n(e.offBudget, 0) } : {}),
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

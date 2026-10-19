import { yearOf } from "./calendar";
import { peopleIn } from "./population";
import { crisisLimits, interestOf } from "./crises";
import { callUpFactor } from "./laws";
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
  BLR: { "2014": 7900 },
  KAZ: { "2014": 13600 },
  TUR: { "2014": 12500 },
  CHN: { "1914": 25, "1939": 30, "1991": 330 },
  TWN: { "1914": 40, "1939": 70, "1991": 9000 },
  JPN: { "1914": 60, "1939": 160, "1991": 29000 },
  KOR: { "1914": 30, "1939": 50, "1991": 7500 },
  PRK: { "1914": 30, "1939": 50, "1991": 1000 },
  IND: { "1991": 310 },
  PAK: { "1991": 400 },
  BGD: { "1991": 280 },
  IDN: { "1914": 30, "1939": 40, "1991": 600 },
  VNM: { "1914": 25, "1939": 30, "1991": 140 },
  THA: { "1991": 1700 },
  MYS: { "1991": 2700 },
  DEU: { "1914": 230, "1991": 23000 },
  AUT: { "1991": 22000 },
  ITA: { "1991": 21000 },
  BRA: { "1991": 3000, "2014": 12100 },
  RUS: { "1914": 100, "1939": 220, "1991": 3500, "2014": 15500 },
  UKR: { "1914": 70, "1939": 120, "1991": 1500, "2014": 4000 },
  SAU: { "1914": 15, "1939": 20 },
  ARE: { "1914": 15, "1939": 20 },
  QAT: { "1914": 15, "1939": 20 },
  KWT: { "1914": 15, "1939": 20, "1991": 8000 },
  BHR: { "1914": 15, "1939": 25 },
  OMN: { "1914": 15, "1939": 20 },
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

/** Total spending a year. */
export const spending = (e: Economy) => e.budget.army + e.budget.industry + e.budget.social + e.budget.other;
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
  const rich = people > 0 && richness / people >= 20000;
  const revenue = gdp * (seed.revenue ?? e.revenue[rich ? 0 : 1]);
  const army = gdp * (seed.army ?? e.army);
  const social = gdp * e.social[rich ? 0 : 1];
  const industry = gdp * e.industry;
  // The rest of the budget runs a small deficit, as most governments did.
  const other = Math.max(revenue * 0.15, revenue * 1.03 - army - social - industry);
  return {
    gdp: round(gdp, 2),
    growth: seed.growth ?? e.trend,
    inflation: seed.inflation ?? e.inflation,
    unemployment: seed.unemployment ?? e.unemployment,
    budget: { revenue: round(revenue, 2), army: round(army, 2), industry: round(industry, 2), social: round(social, 2), other: round(other, 2) },
    debt: round(gdp * (seed.debt ?? e.debt), 2),
    reserves: round(gdp * e.reserves, 2),
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

/** Who draws on a province's output: its owner in full, or under occupation a part to the owner and a part to the occupier; the rest is lost. */
export function outputShares(r: RegionState): [string, number][] {
  return r.controller === r.owner ? [[r.owner, 1]] : [[r.owner, OWNER_UNDER_OCCUPATION], [r.controller, OCCUPIER_TAKES]];
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
    e.gdp = round(gdp, 2);
    e.budget.revenue = round(e.budget.revenue * ratio, 2);
  }
}

/** What a country produces, needs and trades this year, derived from the map and the economies. */
export interface Accounts {
  /** People in the provinces it owns, thousands. */
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
  "1991": {
    usa: 18000, france: 9000, ussr: 9000, japan: 7000, germany: 3500, uk: 2500, "south-korea": 2500, canada: 1800, sweden: 1500, spain: 1200,
    belgium: 1000, taiwan: 1000, czechoslovakia: 600, bulgaria: 600, switzerland: 500, finland: 500, hungary: 400, "south-africa": 300, india: 200,
    argentina: 150, brazil: 100, netherlands: 100, yugoslavia: 100, mexico: 100,
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
  // Output of the land each country owns, whoever holds it.
  const owned = new Map<string, Partial<Record<ResourceType, number>>>();
  for (const [id, r] of Object.entries(state.regions)) {
    const p = regions[id];
    if (!p) continue;
    get(r.owner).population += peopleIn(r, p);
    for (const { type, output } of activeResources(p, year)) {
      const held = get(r.controller);
      const amount = linearOutput(output);
      held.production[type] = (held.production[type] ?? 0) + amount;
      world[type] = (world[type] ?? 0) + amount;
      const own = owned.get(r.owner) ?? {};
      own[type] = (own[type] ?? 0) + amount;
      owned.set(r.owner, own);
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
    // The player's call-up law widens or narrows the reserve.
    a.mobilisable = Math.round(a.population * era.mobilise * (tag === state.player ? callUpFactor(state.politics?.laws) : 1));
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

/**
 * Moves every economy forward by one turn of `years`: proposed changes land
 * (troops limited by who is left to call up), GDP grows with real growth and
 * prices, an untouched budget keeps its share of GDP, deficits add to debt,
 * trade moves reserves, and a country whose imports are cut lives off its
 * stores. Pure; returns the new economies by country.
 */
export function advanceEconomies(
  state: Pick<GameState, "countries" | "regions" | "scenarioId" | "date">,
  changes: EconomyChange[],
  years: number,
  regions: Record<string, MapRegion> | null,
  /** Imports cut off by sanctions (engine/trade.ts), on top of what the model reports. */
  cuts: Map<string, number> = new Map(),
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

    // Growth drifts back towards the era's trend unless the model says otherwise.
    e.growth = change.growth ?? round(e.growth + (era.trend - e.growth) * Math.min(1, years) * 0.5);
    if (change.inflation !== undefined) e.inflation = change.inflation;
    if (change.unemployment !== undefined) e.unemployment = change.unemployment;
    if (change.tradeCut !== undefined) e.tradeCut = change.tradeCut;
    e.tradeCut = Math.max(e.tradeCut, cuts.get(tag) ?? 0);

    // Crises bite whatever the game master says: no growth through a shortage, hyperinflation or a debt crisis,
    // and prices that cannot fall while the deficit is printed.
    const limits = crisisLimits(before, a, state.scenarioId);
    if (limits.growthCap !== undefined) e.growth = Math.min(e.growth, limits.growthCap);
    if (limits.printing) e.inflation = Math.max(e.inflation, round(before.inflation + 8 * years));

    // In dollars, a country's own inflation is offset by its currency falling;
    // what it does to people is the model's to judge (growth, stability).
    const nominal = Math.max(0.05, (1 + e.growth / 100) * (1 + era.dollar / 100)) ** years;
    const gdp = before.gdp * nominal;
    for (const key of ["revenue", "army", "industry", "social", "other"] as const) {
      e.budget[key] = round(change[key] ?? before.budget[key] * nominal, 2);
    }
    e.gdp = round(gdp, 2);

    // The books: a deficit and the interest on the debt are borrowed, trade and loans move the reserves;
    // what the reserves cannot cover is borrowed too.
    const borrow = change.borrow ?? 0;
    e.debt = round(Math.max(0, before.debt - balance(e) * years + interestOf(before, state.scenarioId) * years + borrow), 2);
    const trade = a ? (a.exports - a.imports) * years * 0.2 : 0;
    const reserves = before.reserves + trade + borrow;
    if (reserves < 0) e.debt = round(e.debt - reserves, 2);
    e.reserves = round(Math.max(0, reserves), 2);

    // Soldiers: no more than are left to call up, a third of them a month at most.
    if (change.troops !== undefined) {
      const room = a ? Math.max(0, a.mobilisable - before.troops) : Infinity;
      const pace = a ? a.mobilisable * Math.min(1, years * 4) : Infinity;
      e.troops = Math.max(0, before.troops + Math.min(change.troops, room, pace));
    }

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
    list.push(p);
    out.set(r.owner, list);
  }
  return out;
}

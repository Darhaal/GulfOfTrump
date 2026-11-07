import { colonialOf } from "./colonialLand";
import { type Accounts, type CapCause, DEFAULT_YEARS, deficitOf } from "./economy";
import { shortOf } from "./energy";
import { provisionOf, worstProvision } from "./provision";
import { governmentSeats, loyaltyOf } from "./politics";
import { ownProtests } from "./unrest";
import { PILLARS } from "./types";
import { peopleIn } from "./population";
import type { Economy, GameState, MapRegion, ScenarioId } from "./types";

/**
 * Crises: the numbers that should hurt. The engine reads them off the state
 * (debt, deficit, prices, jobs, reserves, shortages, the street, plots,
 * sanctions, occupation, the army's call-up), shows them to the player,
 * makes some of them bite by itself (interest on debt, emergency borrowing,
 * money printing, a ceiling on growth, a floor under unrest) and tells the
 * game master that the turn must deal with the rest.
 */

export const CRISIS_KINDS = [
  "debt",
  "default",
  "deficit",
  "inflation",
  "unemployment",
  "recession",
  "reserves",
  "shortage",
  "provision",
  "upkeep",
  "power",
  "manpower",
  "sanctions",
  "occupation",
  "unrest",
  "street",
  "plot",
  "minority",
  "army",
  "police",
  "security",
  "elites",
] as const;
export type CrisisKind = (typeof CRISIS_KINDS)[number];

export interface Crisis {
  kind: CrisisKind;
  level: "warning" | "critical";
  /** The number behind it: % of GDP, % a year, /100… */
  value: number;
  /** Names behind it: the resources short, the protest's stage. */
  detail?: string;
}

const round = (v: number, digits = 1) => Math.round(v * 10 ** digits) / 10 ** digits;

/**
 * Interest a state pays on its debt, % a year: the era's rate and more as the
 * debt passes 90% of GDP. A trusted borrower — big reserves, steady prices —
 * pays far less, as Japan or Switzerland do.
 */
const BASE_RATE: Record<ScenarioId, number> = { "1914": 3.5, "1933": 4, "1939": 3.5, "1950": 3, "1957": 3.5, "1964": 4.5, "1973": 4.5, "1979": 4.5, "1991": 6, "1999": 5.5, "2014": 3, "2022": 2.5 };
export function interestRate(e: Pick<Economy, "debt" | "gdp" | "reserves" | "inflation">, era: ScenarioId): number {
  const gdp = Math.max(0.01, e.gdp);
  const ratio = (e.debt / gdp) * 100;
  const trusted = e.reserves / gdp >= 0.1 && e.inflation < 10;
  const rate = BASE_RATE[era] * (trusted ? 0.4 : 1) + 0.03 * Math.max(0, ratio - 90) * (trusted ? 0.2 : 1);
  return round(Math.min(15, rate), 2);
}

/** Debt service, $bn a year. */
export const interestOf = (e: Pick<Economy, "debt" | "gdp" | "reserves" | "inflation">, era: ScenarioId) => round((e.debt * interestRate(e, era)) / 100, 2);

/** Above the first number a warning, above the second a crisis (below, for the falling ones). */
const LIMITS: Record<Exclude<CrisisKind, "default" | "shortage" | "provision" | "upkeep" | "power" | "street" | "minority" | "army" | "police" | "security" | "elites">, [number, number]> = {
  debt: [90, 150],
  deficit: [6, 12],
  inflation: [15, 50],
  unemployment: [12, 20],
  recession: [3, 8],
  reserves: [2, 0.5],
  manpower: [80, 95],
  sanctions: [20, 50],
  occupation: [10, 30],
  unrest: [50, 70],
  plot: [50, 70],
};

/** How run down the state is, % (neglect), for a warning and a crisis. */
const UPKEEP = [15, 40] as const;
/** The share of the demand for electricity that went unmet, %, for a warning and a crisis (engine/energy.ts). */
const POWER = [5, 15] as const;
/** Resources gone without – imports cut off with the stores empty – as a share of GDP, %: past it a crisis, below it a warning. */
const SHORTAGE_CRISIS = 2;

/** Years from one day to another. */
const yearsBetween = (from: string, to: string) => Math.max(0, (Date.parse(to) - Date.parse(from)) / (365.25 * 86_400_000));

/** Whether a government defaulted within the years lenders remember it (economy.ts DEFAULT_YEARS). */
export const defaultedLately = (e: Pick<Economy, "defaulted">, date: string | undefined) => Boolean(e.defaulted && date && yearsBetween(e.defaulted, date) <= DEFAULT_YEARS);

/**
 * Share of a country's own people living under someone else's control, %: of its own soil, a colony's land left out
 * (a movement holding a colony's provinces is a colonial war, not an occupation of the country: engine/colonialLand.ts).
 */
export function occupiedShare(state: Pick<GameState, "regions"> & Partial<Pick<GameState, "colonies" | "wars">>, tag: string, map: Record<string, MapRegion>): number {
  const colonial = colonialOf(state, map).land;
  let own = 0;
  let held = 0;
  for (const [id, r] of Object.entries(state.regions)) {
    if (r.owner !== tag || colonial.has(id)) continue;
    const n = peopleIn(r, map[id]);
    own += n;
    if (r.controller !== tag) held += r.contested === tag ? (n * (100 - (r.held ?? 30))) / 100 : n;
    else if (r.contested) held += (n * (r.held ?? 30)) / 100;
  }
  return own > 0 ? round((held / own) * 100) : 0;
}

/**
 * A country's crises, the worst first. The economy for every country; the
 * street, plots and parliament for the player, whose politics the game keeps.
 */
export function countryCrises(state: GameState, tag: string, ctx: { accounts?: Accounts; map?: Record<string, MapRegion> | null } = {}): Crisis[] {
  const e = state.countries[tag]?.economy;
  const out: Crisis[] = [];
  if (!e) return out;
  const up = (kind: keyof typeof LIMITS, value: number, detail?: string) => {
    const [warn, crit] = LIMITS[kind];
    if (value >= crit) out.push({ kind, level: "critical", value: round(value), ...(detail ? { detail } : {}) });
    else if (value >= warn) out.push({ kind, level: "warning", value: round(value), ...(detail ? { detail } : {}) });
  };
  const gdp = Math.max(0.01, e.gdp);
  const interest = interestOf(e, state.scenarioId);
  up("debt", (e.debt / gdp) * 100);
  // A default lately: lenders lend nothing, the deficit the reserves cannot meet is printed.
  if (defaultedLately(e, state.date)) out.push({ kind: "default", level: "critical", value: round((e.debt / gdp) * 100), detail: e.defaulted });
  // The deficit with its interest and what was paid outside the budget's lines (economy.ts payOffBudget).
  up("deficit", (deficitOf(e, interest) / gdp) * 100);
  up("inflation", e.inflation);
  up("unemployment", e.unemployment);
  up("recession", -e.growth);
  // Reserves fall: a crisis when they run low while something drains them (a deficit, sanctions), not for a poor state that never had any.
  const reserves = (e.reserves / gdp) * 100;
  const drained = deficitOf(e, interest) / gdp > 0.03 || e.tradeCut > 0;
  if (!drained) {
    // nothing pulls them down
  } else if (reserves <= LIMITS.reserves[1]) out.push({ kind: "reserves", level: "critical", value: round(reserves) });
  else if (reserves <= LIMITS.reserves[0]) out.push({ kind: "reserves", level: "warning", value: round(reserves) });
  // Short of what is cut off with the stores empty: a crisis as deep as the value gone without (gold, a store of value, aside).
  if (ctx.accounts?.shortages.length) {
    const share = (ctx.accounts.goneWithout / gdp) * 100;
    out.push({ kind: "shortage", level: share >= SHORTAGE_CRISIS ? "critical" : "warning", value: round(share), detail: ctx.accounts.shortages.join(", ") });
  }
  // The people going short of food, fuel, goods, homes or medicine (engine/provision.ts).
  if (ctx.map) {
    const supply = provisionOf(state, tag, ctx.map);
    if (supply) {
      const worst = worstProvision(supply);
      const critical = supply.overall < 70 || worst.level < 50;
      if (critical || supply.overall < 85 || worst.level < 70) out.push({ kind: "provision", level: critical ? "critical" : "warning", value: worst.level, detail: worst.kind });
    }
  }
  // The state's administration, police and roads run down by an "other" line kept below its usual share (engine/economy.ts).
  const neglect = (e.neglect ?? 0) * 100;
  if (neglect >= UPKEEP[1]) out.push({ kind: "upkeep", level: "critical", value: round(neglect) });
  else if (neglect >= UPKEEP[0]) out.push({ kind: "upkeep", level: "warning", value: round(neglect) });
  // The plants could not meet the demand for electricity over the last turn (engine/energy.ts).
  const power = shortOf(state, tag) * 100;
  if (power >= POWER[1]) out.push({ kind: "power", level: "critical", value: round(power) });
  else if (power >= POWER[0]) out.push({ kind: "power", level: "warning", value: round(power) });
  if (ctx.accounts && ctx.accounts.mobilisable > 0) up("manpower", (e.troops / ctx.accounts.mobilisable) * 100);
  up("sanctions", e.tradeCut * 100);
  if (ctx.map) up("occupation", occupiedShare(state, tag, ctx.map));

  if (tag === state.player) {
    if (state.politics) {
      up("unrest", state.politics.unrest);
      const plot = Math.max(0, ...state.politics.plots.filter((p) => p.known).map((p) => p.strength));
      up("plot", plot);
      const house = state.politics.parliament;
      if (house && governmentSeats(state.politics) < Math.floor(house.seats / 2) + 1) out.push({ kind: "minority", level: "warning", value: governmentSeats(state.politics) });
      // Pillars that waver: below 40 they may refuse orders, below 25 they defect.
      const loyalty = loyaltyOf(state.politics);
      for (const k of PILLARS) {
        if (loyalty[k] < 25) out.push({ kind: k, level: "critical", value: loyalty[k] });
        else if (loyalty[k] < 40) out.push({ kind: k, level: "warning", value: loyalty[k] });
      }
    }
    const stages = ownProtests(state.protests, state.player).map((p) => p.stage);
    if (stages.includes("uprising")) out.push({ kind: "street", level: "critical", value: stages.length, detail: "uprising" });
    else if (stages.includes("riot")) out.push({ kind: "street", level: "warning", value: stages.length, detail: "riot" });
  }
  return out.sort((a, b) => (a.level === b.level ? 0 : a.level === "critical" ? -1 : 1));
}

/** Of its GDP, what lenders lend a year a government with no reserves to speak of; past this debt, share of GDP, nothing. */
const BROKE_LENDING = 0.1;
export const CREDIT_LIMIT = 1.5;

/**
 * What the crises do by themselves this turn, on top of the game master's
 * figures: growth no higher than a crisis allows (and which crisis), and the
 * share of GDP a year printed – the deficit lenders will not lend. A
 * government with no reserves to speak of is lent a tenth of its GDP a year
 * while its debt is below one and a half years of GDP, nothing past it; one
 * that defaulted lately, nothing at all (economy.ts DEFAULT_YEARS). The
 * player's books and every other government's alike. A shortage caps
 * nothing: it is a loss of level, as deep as what it cuts off (economy.ts).
 */
export function crisisLimits(before: Economy, _accounts: Accounts | undefined, era: ScenarioId, date?: string): { growthCap?: number; capBy?: CapCause; printed: number } {
  const gdp = Math.max(0.01, before.gdp);
  const deficit = deficitOf(before, interestOf(before, era)) / gdp;
  const broke = before.reserves / gdp < 0.01;
  const caps: [number, CapCause][] = [];
  if (before.inflation >= 100) caps.push([-3, "inflation"]);
  else if (before.inflation >= 50) caps.push([0, "inflation"]);
  if (before.debt / gdp >= CREDIT_LIMIT && broke) caps.push([0, "debt"]);
  const cap = caps.sort((a, b) => a[0] - b[0])[0];
  const lent = defaultedLately(before, date) ? 0 : broke ? (before.debt / gdp >= CREDIT_LIMIT ? 0 : BROKE_LENDING) : Infinity;
  const printed = deficit > lent ? round(deficit - lent, 4) : 0;
  return { ...(cap ? { growthCap: cap[0], capBy: cap[1] } : {}), printed };
}

/**
 * Crises that one cause brings on together, counted once at the worst of them: the supply (a shortage of resources, of
 * electricity, and the people's provision that both lower), the slump (a recession and the jobs it takes), the money (the
 * debt, a default and the reserves it drains). The floors of the crises, the strain and the classes are combined by the
 * larger elsewhere (outcome.ts, mobilisation.ts, societyRecord.ts).
 */
const CAUSES: Partial<Record<CrisisKind, string>> = {
  shortage: "supply",
  provision: "supply",
  power: "supply",
  recession: "slump",
  unemployment: "slump",
  debt: "money",
  default: "money",
  reserves: "money",
  inflation: "prices",
  occupation: "war",
  upkeep: "state",
};

/** How restless the people are bound to be with these crises, whatever the game master says: a floor under unrest. */
export function unrestFloor(crises: Crisis[]): number {
  const worst = new Map<string, number>();
  for (const c of crises) {
    const cause = CAUSES[c.kind];
    if (!cause) continue;
    worst.set(cause, Math.max(worst.get(cause) ?? 0, c.level === "critical" ? 12 : 5));
  }
  return Math.min(85, [...worst.values()].reduce((s, v) => s + v, 0));
}

/** A crisis in the game master's words. */
export function describeCrisis(c: Crisis, era: ScenarioId, e?: Economy): string {
  const lvl = c.level === "critical" ? "CRITICAL" : "warning";
  switch (c.kind) {
    case "debt":
      return `${lvl}: debt ${c.value}% of GDP${e ? `, interest ${interestRate(e, era)}% a year ($${interestOf(e, era)}bn) – lenders ask more each turn; past 150% with no reserves they lend nothing and the deficit is printed, past 300% the state defaults` : ""}`;
    case "default":
      return `${lvl}: the state defaulted on its debt on ${c.detail} – written down, now ${c.value}% of GDP; for ${DEFAULT_YEARS} years lenders lend nothing, so a deficit the reserves cannot meet is printed and prices climb`;
    case "deficit":
      return `${lvl}: budget deficit ${c.value}% of GDP a year, interest and spending outside the budget included`;
    case "inflation":
      return `${lvl}: inflation ${c.value}% a year — wages and savings melt`;
    case "unemployment":
      return `${lvl}: unemployment ${c.value}%`;
    case "recession":
      return `${lvl}: the economy shrinks ${c.value}% a year`;
    case "reserves":
      return `${lvl}: reserves down to ${c.value}% of GDP — imports and the currency at risk`;
    case "shortage":
      return `${lvl}: shortage of ${c.detail} – imports cut off and the stores empty, ${c.value}% of GDP a year gone without: industry and the army go without that share, and output and prices suffer with it`;
    case "provision":
      return `${lvl}: the people go short of ${c.detail} (${c.value}% of need) — queues, rationing and anger`;
    case "upkeep":
      return `${lvl}: the state is run down (${c.value}%) – the "other" line, its administration, police, courts and roads, kept below its usual share: offices and police fail, roads and power decay, growth and order suffer until it is restored`;
    case "power":
      return `${lvl}: ${c.value}% of the demand for electricity goes unmet – blackouts and rationed power, factories idle, homes cold and dark: output falls and anger rises until plants are built or their fuel comes back`;
    case "manpower":
      return `${lvl}: ${c.value}% of those who can be called up are already in uniform`;
    case "sanctions":
      return `${lvl}: sanctions and blockade cut ${c.value}% of imports`;
    case "occupation":
      return `${lvl}: ${c.value}% of the country's people live under enemy control`;
    case "unrest":
      return `${lvl}: unrest ${c.value}/100`;
    case "street":
      return `${lvl}: ${c.detail === "uprising" ? "an uprising" : "riots"} in the streets`;
    case "plot":
      return `${lvl}: a known plot at ${c.value}% strength`;
    case "minority":
      return `warning: the government has no majority in parliament (${c.value} seats)`;
    case "army":
    case "police":
    case "security":
    case "elites":
      return `${lvl}: the ${c.kind === "security" ? "security services" : c.kind} wavers, loyalty ${c.value}/100 — ${c.value < 25 ? "it may defect or switch sides" : "orders to use force may be refused"}`;
  }
}

import { type Accounts, balance } from "./economy";
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
  "deficit",
  "inflation",
  "unemployment",
  "recession",
  "reserves",
  "shortage",
  "provision",
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
const BASE_RATE: Record<ScenarioId, number> = { "1914": 3.5, "1939": 3.5, "1950": 3, "1964": 4.5, "1991": 6, "1999": 5.5, "2014": 3, "2022": 2.5 };
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
const LIMITS: Record<Exclude<CrisisKind, "shortage" | "provision" | "street" | "minority" | "army" | "police" | "security" | "elites">, [number, number]> = {
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

/** Share of a country's own people living under someone else's control, %. */
export function occupiedShare(state: Pick<GameState, "regions">, tag: string, map: Record<string, MapRegion>): number {
  let own = 0;
  let held = 0;
  for (const [id, r] of Object.entries(state.regions)) {
    if (r.owner !== tag) continue;
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
  up("deficit", ((-balance(e) + interest) / gdp) * 100);
  up("inflation", e.inflation);
  up("unemployment", e.unemployment);
  up("recession", -e.growth);
  // Reserves fall: a crisis when they run low while something drains them (a deficit, sanctions), not for a poor state that never had any.
  const reserves = (e.reserves / gdp) * 100;
  const drained = (-balance(e) + interest) / gdp > 0.03 || e.tradeCut > 0;
  if (!drained) {
    // nothing pulls them down
  } else if (reserves <= LIMITS.reserves[1]) out.push({ kind: "reserves", level: "critical", value: round(reserves) });
  else if (reserves <= LIMITS.reserves[0]) out.push({ kind: "reserves", level: "warning", value: round(reserves) });
  if (ctx.accounts?.shortages.length) out.push({ kind: "shortage", level: "critical", value: ctx.accounts.shortages.length, detail: ctx.accounts.shortages.join(", ") });
  // The people going short of food, fuel, goods, homes or medicine (engine/provision.ts).
  if (ctx.map) {
    const supply = provisionOf(state, tag, ctx.map);
    if (supply) {
      const worst = worstProvision(supply);
      const critical = supply.overall < 70 || worst.level < 50;
      if (critical || supply.overall < 85 || worst.level < 70) out.push({ kind: "provision", level: critical ? "critical" : "warning", value: worst.level, detail: worst.kind });
    }
  }
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

/**
 * What the crises do by themselves this turn, on top of the game master's
 * figures: growth no higher than a crisis allows, inflation that cannot fall
 * while the deficit is printed.
 */
export function crisisLimits(before: Economy, accounts: Accounts | undefined, era: ScenarioId): { growthCap?: number; printing: boolean } {
  const gdp = Math.max(0.01, before.gdp);
  const deficit = ((-balance(before) + interestOf(before, era)) / gdp) * 100;
  const broke = before.reserves / gdp < 0.01;
  const caps: number[] = [];
  if (accounts?.shortages.length && before.tradeCut > 0) caps.push(-2);
  if (before.inflation >= 100) caps.push(-3);
  else if (before.inflation >= 50) caps.push(0);
  if (before.debt / gdp >= 1.5 && broke) caps.push(0);
  return { ...(caps.length ? { growthCap: Math.min(...caps) } : {}), printing: deficit >= 10 && broke };
}

/** How restless the people are bound to be with these crises, whatever the game master says: a floor under unrest. */
export function unrestFloor(crises: Crisis[]): number {
  const hardship: CrisisKind[] = ["inflation", "unemployment", "recession", "shortage", "provision", "occupation", "debt", "reserves"];
  let floor = 0;
  for (const c of crises) if (hardship.includes(c.kind)) floor += c.level === "critical" ? 12 : 5;
  return Math.min(85, floor);
}

/** A crisis in the game master's words. */
export function describeCrisis(c: Crisis, era: ScenarioId, e?: Economy): string {
  const lvl = c.level === "critical" ? "CRITICAL" : "warning";
  switch (c.kind) {
    case "debt":
      return `${lvl}: debt ${c.value}% of GDP${e ? `, interest ${interestRate(e, era)}% a year ($${interestOf(e, era)}bn) — lenders ask more each turn` : ""}`;
    case "deficit":
      return `${lvl}: budget deficit ${c.value}% of GDP a year, interest included`;
    case "inflation":
      return `${lvl}: inflation ${c.value}% a year — wages and savings melt`;
    case "unemployment":
      return `${lvl}: unemployment ${c.value}%`;
    case "recession":
      return `${lvl}: the economy shrinks ${c.value}% a year`;
    case "reserves":
      return `${lvl}: reserves down to ${c.value}% of GDP — imports and the currency at risk`;
    case "shortage":
      return `${lvl}: shortage of ${c.detail} — industry and the army go without`;
    case "provision":
      return `${lvl}: the people go short of ${c.detail} (${c.value}% of need) — queues, rationing and anger`;
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

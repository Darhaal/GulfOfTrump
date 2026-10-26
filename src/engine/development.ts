import { PROGRAMMES } from "./programmes";
import type { ProvisionCause } from "./provision";
import { aheadOf } from "./researchEffects";
import type { Economy, GameState } from "./types";

/**
 * What a government's effort builds up over months and years, beside the
 * budget's books (engine/economy.ts): consumer factories that hold up the
 * people's everyday goods (engine/provision.ts), and mines, wells and fields
 * worked harder, which raise the output of the land (`nationalAccounts`).
 * Both are optional fields of the economy, moved each turn by
 * `advanceDevelopment`, and both fall back slowly once the effort stops.
 * The army's share of GDP still takes the goods: factories and imports
 * offset part of what it takes, never all of it. Pure.
 */

/** Goods points a doubling of the industry line past the era's usual share builds, and the most; below it, lost per halving and the most lost. */
const FACTORY_GAIN = 0.08;
const FACTORY_MAX = 0.2;
const FACTORY_LOSS = 0.04;
const FACTORY_MAX_LOSS = 0.08;
/** Goods points each industry or infrastructure policy past its lag adds; at most this many count. */
const POLICY_GOODS = 0.02;
const MAX_BUILDERS = 2;
/** Years over which the factories are built (63% of the way), and over which they run down once the money stops. */
const BUILD_YEARS = 0.75;
const DECAY_YEARS = 2;
/** Goods points a year of industry research ahead of history adds (taken away behind it), within these bounds. */
const RESEARCH_GOODS = 0.01;
const RESEARCH_GOODS_BOUNDS = [-0.05, 0.08] as const;
/** Of the goods still short, the share imports cover with trade open and reserves half again above the era's usual. */
const IMPORT_SHARE = 0.15;
/** What the people's everyday goods are worth, as a share of GDP: the bill for the imported share. */
export const GOODS_VALUE = 0.3;
/** The most of what pulls the goods down that everything holding them up can offset: guns still cost butter. */
const SUPPORT_SHARE = 0.6;
/** An army costing more than this share of GDP takes from what people can buy. */
export const PEACE_ARMY = 0.08;

/** Extraction gained a year per doubling of the industry line past the usual share, and the most. */
const EXTRACT_GAIN = 0.02;
const EXTRACT_MAX_RATE = 0.04;
/** Gained a year for each industry or infrastructure policy past its lag. */
const EXTRACT_POLICY = 0.01;
/** Gained a year per year of industry research ahead of history, and the most. */
const EXTRACT_RESEARCH = 0.003;
const EXTRACT_RESEARCH_MAX = 0.01;
/** Years over which what was gained wears off (63% of it) once the effort stops. */
const EXTRACT_DECAY_YEARS = 15;
/** The most a country's mines and wells can be pushed past what its land gives: about a decade's strong effort. */
export const EXTRACTION_MAX = 1.3;
/** The bounds of the factories a save may hold. */
export const FACTORIES_BOUNDS = [-FACTORY_MAX_LOSS - POLICY_GOODS, FACTORY_MAX + POLICY_GOODS * MAX_BUILDERS] as const;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const round = (v: number, digits = 4) => Math.round(v * 10 ** digits) / 10 ** digits;
const yearsBetween = (from: string, to: string) => (Date.parse(to) - Date.parse(from)) / (365.25 * 86_400_000);

/** The share of a country's land's output its mines and wells give: 1 without effort, up to 1.3. */
export const extractionOf = (e: Pick<Economy, "extraction"> | undefined): number => clamp(e?.extraction ?? 1, 1, EXTRACTION_MAX);

/** What a country's effort is, for both: its industry line against the era's usual share, the policies that build, and its industry research lead. */
export interface Effort {
  /** The industry line as a share of GDP, against the era's usual share (1: usual). */
  industry: number;
  /** Industry and infrastructure policies at work past their lag (a year), two at most. */
  builders: number;
  /** Years industry research is ahead of history (the player's only; 0 for the rest). */
  lead: number;
}

type EffortState = Pick<GameState, "countries" | "date"> & Partial<Pick<GameState, "player" | "research">>;

/** A country's effort now, by its economy (or `e`, this turn's); `norm` is the era's usual industry share of GDP. */
export function effortOf(state: EffortState, tag: string, norm: number, e: Pick<Economy, "gdp" | "budget"> | undefined = state.countries[tag]?.economy): Effort {
  const country = state.countries[tag];
  const industry = e && norm > 0 ? Math.max(0, e.budget.industry) / Math.max(0.01, e.gdp) / norm : 1;
  const builders = Math.min(
    MAX_BUILDERS,
    (country?.programmes ?? []).filter((p) => (p.kind === "industry" || p.kind === "infrastructure") && p.until > state.date && yearsBetween(p.since, state.date) >= PROGRAMMES[p.kind].lag).length,
  );
  const lead = tag === state.player && state.research?.tech ? aheadOf({ research: state.research, date: state.date }, "industry") : 0;
  return { industry, builders, lead };
}

/** An industry line within 5% of the usual share counts as the usual: budgets that only drift with the books build nothing and lose nothing. */
const USUAL_BAND = Math.log2(1.05);

/** Doublings of the industry line past the usual share (negative: halvings short of it), past the band of the usual. */
function doublings(industry: number): number {
  const l = Math.log2(Math.max(industry, 1 / 8));
  return Math.abs(l) <= USUAL_BAND ? 0 : l - Math.sign(l) * USUAL_BAND;
}

/** The goods the factories would hold up once built: the industry line past or short of the usual share, and the policies that build. */
export function factoryTarget(effort: Effort): number {
  const d = doublings(effort.industry);
  const line = d >= 0 ? Math.min(FACTORY_MAX, FACTORY_GAIN * d) : Math.max(-FACTORY_MAX_LOSS, FACTORY_LOSS * d);
  return line + POLICY_GOODS * effort.builders;
}

/** Extraction gained a year at this effort, before it wears off. */
export function extractionRate(effort: Effort): number {
  const line = Math.min(EXTRACT_MAX_RATE, EXTRACT_GAIN * Math.max(0, doublings(effort.industry)));
  return line + EXTRACT_POLICY * effort.builders + clamp(EXTRACT_RESEARCH * effort.lead, 0, EXTRACT_RESEARCH_MAX);
}

/**
 * Moves a country's factories and extraction by one turn of `years`: the
 * factories towards what the effort supports (built in about nine months,
 * run down over two years), extraction up by what the effort gains while
 * what was gained wears off over fifteen years, never past 1.3. Changes
 * `e` in place; the fields are left out while they stay at nothing.
 */
export function advanceDevelopment(e: Economy, before: Pick<Economy, "factories" | "extraction">, effort: Effort, years: number): void {
  const built = before.factories ?? 0;
  const target = factoryTarget(effort);
  let factories = target + (built - target) * Math.exp(-years / (target > built ? BUILD_YEARS : DECAY_YEARS));
  // The last crumbs are not kept: what is left within a twentieth of a point of the target is the target.
  if (Math.abs(factories - target) < 0.0005) factories = target;
  factories = round(clamp(factories, FACTORIES_BOUNDS[0], FACTORIES_BOUNDS[1]), 5);
  if (factories) e.factories = factories;
  else delete e.factories;
  const rate = extractionRate(effort);
  let gained = (extractionOf(before) - 1) * Math.exp(-years / EXTRACT_DECAY_YEARS) + rate * years;
  if (!rate && gained < 0.0005) gained = 0;
  const extraction = round(clamp(1 + gained, 1, EXTRACTION_MAX), 6);
  if (extraction > 1) e.extraction = extraction;
  else delete e.extraction;
}

/** Goods points the player's industry research holds up (or, behind history, pulls down). */
export const researchGoods = (lead: number): number => clamp(RESEARCH_GOODS * lead, RESEARCH_GOODS_BOUNDS[0], RESEARCH_GOODS_BOUNDS[1]);

/** What the goods line is read from. */
export interface GoodsInputs {
  /** The army line as a share of GDP. */
  army: number;
  inflation: number;
  /** Share of imports cut off. */
  cut: number;
  /** Real growth, % a year. */
  growth: number;
  /** Metals lacking with their stores empty. */
  metalsLacking: number;
  broke: boolean;
  /** The factories built (`Economy.factories`). */
  factories: number;
  /** Goods points research holds up. */
  research: number;
  /** Reserves as a share of GDP, and the era's usual share. */
  reserves: number;
  reserveNorm: number;
}

export interface GoodsLine {
  /** Share of need, before the 5–100% bounds. */
  level: number;
  /** What pulls it down, the main one first, then what holds it up. */
  causes: ProvisionCause[];
  /** The causes that hold it up. */
  up: ProvisionCause[];
  /** Share of the goods need imported: its bill, at GOODS_VALUE of GDP for the whole need, comes out of the reserves. */
  imported: number;
}

/**
 * The people's everyday goods: what is left once the army has taken its
 * share, prices allow, imports come in and the metals are there – held up
 * by the factories industry spending and policies built, the industry
 * research lead and goods bought abroad while trade is open and the
 * reserves allow, which together offset at most three fifths of what pulls
 * the goods down.
 */
export function goodsLine(g: GoodsInputs): GoodsLine {
  const down: ProvisionCause[] = [];
  let penalty = 0;
  if (g.army > PEACE_ARMY) {
    penalty += (g.army - PEACE_ARMY) * 1.5;
    down.push("warEconomy");
  }
  if (g.inflation > 15) {
    penalty += Math.min(0.3, (g.inflation - 15) * 0.003);
    down.push("inflation");
  }
  if (g.cut > 0.05) {
    penalty += g.cut * 0.3;
    down.push("blockade");
  }
  if (g.growth < 0) {
    penalty += Math.min(0.2, -g.growth * 0.02);
    down.push("recession");
  }
  if (g.metalsLacking) {
    penalty += Math.min(0.2, g.metalsLacking * 0.1);
    down.push("shortage");
  }
  if (g.broke) {
    penalty += 0.1;
    down.push("broke");
  }
  // Factories run down and research left behind pull the goods down like the rest.
  if (g.factories <= -0.005) {
    penalty -= g.factories;
    down.push("industry");
  }
  if (g.research <= -0.005) {
    penalty -= g.research;
    down.push("research");
  }
  const up: ProvisionCause[] = [];
  const room = penalty * SUPPORT_SHARE;
  let held = Math.min(room, Math.max(0, g.factories) + Math.max(0, g.research));
  if (g.factories >= 0.005 && penalty > 0) up.push("industry");
  if (g.research >= 0.005 && penalty > 0) up.push("research");
  // Imports cover a share of what is still short, less as a blockade closes them and as the reserves near their floor.
  const afford = g.broke || g.reserveNorm <= 0 ? 0 : clamp((g.reserves - g.reserveNorm * 0.5) / g.reserveNorm, 0, 1);
  const imported = Math.min(room - held, Math.max(0, penalty - held) * IMPORT_SHARE * afford * (1 - clamp(g.cut, 0, 1)));
  if (imported > 0) held += imported;
  if (imported >= 0.005) up.push("imports");
  return { level: 1 - penalty + held, causes: [...down.sort((x, y) => ORDER(x) - ORDER(y)), ...up], up, imported: Math.max(0, imported) };
}

/** The order the causes that pull the goods down are named in: the war and the blockade before the slower ones. */
const DOWN_ORDER: ProvisionCause[] = ["blockade", "broke", "shortage", "warEconomy", "inflation", "recession", "industry", "research"];
const ORDER = (c: ProvisionCause) => DOWN_ORDER.indexOf(c);

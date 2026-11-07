import { forNew, type AdvisorId } from "./advisors";
import { balance } from "./economy";
import { ministryOf } from "./figures";
import { estimate, estimateRate, spread, type Estimate } from "./fog";
import type { LAWS } from "./laws";
import { regimeNow } from "./role";
import type { Economy, GameState, RegimeKind } from "./types";

/**
 * What the player knows of their own country. The leader sees the true
 * figures. A role that does not govern sees only what it would know: a
 * minister their own ministry's figures exactly and the rest roughly, as the
 * cabinet's papers put them; a general the army exactly and the rest
 * roughly; the opposition only what the government publishes – its official
 * figures, dressed up as far as the kind of rule and the press law let it,
 * and kept secret where it can – and what is whispered, the rumours, as
 * near the truth as the movement's press and friends inside get it. The
 * estimates are fog of war's (engine/fog.ts); the engine and the game
 * master keep the truth.
 */

export const HOME_FIGURES = ["gdp", "growth", "inflation", "unemployment", "debt", "reserves", "balance", "troops", "unrest"] as const;
export type HomeFigure = (typeof HOME_FIGURES)[number];

/** How the player has a figure: the truth (the leader), exactly (their own field), the published figure, an estimate, or not at all. */
export type Sight = "true" | "exact" | "official" | "estimated" | "secret";

export interface Seen {
  sight: Sight;
  /** The figure as the player has it; missing for a secret. */
  value?: number;
  /** The range the truth lies in, for an estimate. */
  low?: number;
  high?: number;
  /** What is whispered, where the government dresses its figures up: the truth lies in its range. */
  rumour?: Estimate;
}

export type HomeView = Record<HomeFigure, Seen>;

type PressLaw = (typeof LAWS)["press"][number];

/** How far each kind of rule dresses up its own figures, 0–1, where the press lets it. */
const REGIME_LIE: Record<RegimeKind, number> = { democracy: 0.2, limited: 0.5, party: 1, autocracy: 0.85, military: 0.8 };
/** How much the press law lets a government get away with, 0–1: a free press checks every figure. */
const PRESS_LIE: Record<PressLaw, number> = { free: 0, restricted: 0.4, censored: 0.8, state: 1 };
/** The press a kind of rule keeps when its laws are not described yet. */
const USUAL_PRESS: Record<RegimeKind, PressLaw> = { democracy: "free", limited: "restricted", party: "state", autocracy: "censored", military: "censored" };

/** From this much dressing up the government keeps its reserves secret; from this, the army's strength. */
export const RESERVES_SECRET = 0.5;
export const TROOPS_SECRET = 0.4;

/** How far the government dresses up the figures it publishes, 0 (the truth, under a free press) to 1 (a one-party state with a state press). */
export function dressing(state: Pick<GameState, "politics" | "scenarioId" | "player" | "defeat">): number {
  const regime = regimeNow(state);
  const press = (state.politics?.laws?.press as PressLaw | undefined) ?? USUAL_PRESS[regime];
  return Math.round(REGIME_LIE[regime] * (PRESS_LIE[press] ?? 0.5) * 100) / 100;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
/** Three significant figures. */
const sig3 = (n: number) => (n === 0 || !Number.isFinite(n) ? 0 : Number(n.toPrecision(3)));

/** The true figures, as the engine keeps them; unrest is missing until the politics are described. */
export function trueFigures(state: Pick<GameState, "countries" | "player" | "politics">): Partial<Record<HomeFigure, number>> {
  const e = state.countries[state.player]?.economy;
  const out: Partial<Record<HomeFigure, number>> = {};
  if (e) Object.assign(out, { gdp: e.gdp, growth: e.growth, inflation: e.inflation, unemployment: e.unemployment, debt: e.debt, reserves: e.reserves, balance: balance(e), troops: e.troops });
  if (state.politics) out.unrest = state.politics.unrest;
  return out;
}

/**
 * A figure as the government publishes it, dressed up by `d`: more output
 * and growth (a slump hidden most), less inflation, joblessness, debt,
 * deficit and unrest; the reserves and the army kept secret where the
 * government can. Missing when it is not published. Under a free press, the truth.
 */
export function officialFigure(key: HomeFigure, truth: number, d: number): number | undefined {
  if (d <= 0) return truth;
  switch (key) {
    case "gdp":
      return sig3(truth * (1 + 0.15 * d));
    case "growth":
      return round1(truth + d * (2 + Math.max(0, -truth) * 0.8));
    case "inflation":
      return round1(truth > 0 ? truth * (1 - 0.6 * d) : truth);
    case "unemployment":
      return round1(truth * (1 - 0.9 * d));
    case "debt":
      return sig3(truth * (1 - 0.35 * d));
    case "reserves":
      return d >= RESERVES_SECRET ? undefined : sig3(truth);
    case "balance":
      return sig3(truth < 0 ? truth * (1 - 0.7 * d) : truth);
    case "troops":
      return d >= TROOPS_SECRET ? undefined : Math.round(truth);
    case "unrest":
      return Math.round(truth * (1 - 0.8 * d));
  }
}

/** A minister's own figures, known exactly: the ministry keeps them. */
const MINISTRY_FIGURES: Record<AdvisorId, readonly HomeFigure[]> = {
  chief: [],
  foreign: [],
  interior: ["unrest"],
  military: ["troops"],
  intelligence: ["unrest"],
  finance: ["gdp", "growth", "inflation", "debt", "reserves", "balance"],
  industry: ["gdp", "growth", "unemployment"],
  science: [],
  space: [],
  ...forNew([] as readonly HomeFigure[]),
};

/** How well a post inside the government knows the figures beyond its own field: the leader's office reads the leader's papers; a general knows little of the economy and the army well. */
const INSIDE_SIGHT = 70;
const CHIEF_SIGHT = 85;
const GENERAL_SIGHT = 55;
const GENERAL_ARMY_SIGHT = 85;

/** How well a minister or a general knows a figure beyond their own field, 0–100. */
export function insideSight(role: GameState["role"], key: HomeFigure): number {
  if (role?.kind === "general") return key === "troops" ? GENERAL_ARMY_SIGHT : GENERAL_SIGHT;
  return role?.kind === "minister" && role.post === "chief" ? CHIEF_SIGHT : INSIDE_SIGHT;
}

/** The figures a role knows exactly. */
export function exactFigures(role: GameState["role"]): readonly HomeFigure[] {
  if (!role || role.kind === "leader") return HOME_FIGURES;
  if (role.kind === "general") return role.command?.scope === "forces" ? ["troops"] : [];
  if (role.kind === "minister") {
    const ministry = role.post ? ministryOf(role.post) : undefined;
    return ministry ? MINISTRY_FIGURES[ministry] : [];
  }
  return [];
}

/** How near the truth the rumours an opposition hears come, 0–100: its press and its friends inside; less from abroad. */
export function rumourScore(state: Pick<GameState, "role">): number {
  const m = state.role?.movement;
  const score = 30 + (m ? m.press / 5 + m.insiders / 3 : 0) - (m?.kind === "exile" ? 5 : 0);
  return Math.round(Math.max(10, Math.min(75, score)));
}

type ViewState = Pick<GameState, "role" | "countries" | "player" | "politics" | "scenarioId" | "defeat" | "seed" | "id" | "turn">;

/** An estimate of a figure around the truth with this knowledge score, as fog of war makes it. */
function guess(key: HomeFigure, truth: number, score: number, state: ViewState, gdp: number, tag: string): Estimate {
  const k = `home:${tag}:${key}`;
  switch (key) {
    case "gdp":
    case "debt":
    case "reserves":
    case "troops":
      return estimate(truth, score, state, k);
    case "growth":
      return estimateRate(truth, score, 6, state, k);
    case "inflation":
      return estimateRate(truth, score, Math.max(6, Math.abs(truth)), state, k);
    case "unemployment":
      return estimateRate(truth, score, 6, state, k, [0, 100]);
    case "unrest":
      return estimateRate(truth, score, 30, state, k, [0, 100]);
    case "balance":
      return estimateRate(truth, score, Math.max(Math.abs(truth), gdp * 0.02, 0.1), state, k);
  }
}

/** Every figure of the player's own country as the role has it. */
export function homeView(state: ViewState): HomeView {
  const truth = trueFigures(state);
  const role = state.role;
  const gdp = truth.gdp ?? 0;
  const view = {} as HomeView;
  const opposition = role?.kind === "opposition";
  const d = opposition ? dressing(state) : 0;
  const exact = exactFigures(role);
  for (const key of HOME_FIGURES) {
    const t = truth[key];
    if (t === undefined) {
      view[key] = { sight: "secret" };
      continue;
    }
    if (!role || role.kind === "leader") view[key] = { sight: "true", value: t };
    else if (opposition) {
      const published = officialFigure(key, t, d);
      // Where the figures are dressed up or kept secret, the street has its own idea of them.
      const rumour = d > 0 ? guess(key, t, rumourScore(state), state, gdp, "rumour") : undefined;
      view[key] = published === undefined ? { sight: "secret", ...(rumour ? { rumour } : {}) } : { sight: "official", value: published, ...(rumour ? { rumour } : {}) };
    } else if (exact.includes(key)) view[key] = { sight: "exact", value: t };
    else {
      const e = guess(key, t, insideSight(role, key), state, gdp, "post");
      view[key] = { sight: "estimated", value: e.value, low: e.low, high: e.high };
    }
  }
  return view;
}

/**
 * The player's economy as the role has it, for the panels that show it: each
 * figure replaced by the one the role knows, a secret one by nothing (0,
 * marked secret), with how each is known and the budget's balance. None for
 * the leader, who sees the truth.
 */
export function seenEconomy(state: ViewState): { economy: Economy; view: HomeView } | null {
  const e = state.countries[state.player]?.economy;
  if (!e || !state.role || state.role.kind === "leader") return null;
  const view = homeView(state);
  const v = (key: HomeFigure) => view[key].value ?? 0;
  return { economy: { ...e, gdp: v("gdp"), growth: v("growth"), inflation: v("inflation"), unemployment: v("unemployment"), debt: v("debt"), reserves: v("reserves"), troops: v("troops") }, view };
}

/** Each figure's name and its value in words, for the prompt. */
const FIGURE_EN: Record<HomeFigure, [string, (n: number) => string]> = {
  gdp: ["GDP", (n) => `$${sig3(n)} bn`],
  growth: ["growth", (n) => `${round1(n)}%`],
  inflation: ["inflation", (n) => `${round1(n)}%`],
  unemployment: ["unemployment", (n) => `${round1(n)}%`],
  debt: ["debt", (n) => `$${sig3(n)} bn`],
  reserves: ["reserves", (n) => `$${sig3(n)} bn`],
  balance: ["budget balance", (n) => `${n < 0 ? "−" : "+"}$${sig3(Math.abs(n))} bn`],
  troops: ["soldiers", (n) => `${Math.round(n)} thousand`],
  unrest: ["unrest", (n) => `${Math.round(n)}/100`],
};
const figureEn = (key: HomeFigure, n: number) => `${FIGURE_EN[key][0]} ${FIGURE_EN[key][1](n)}`;
const rangeEn = (key: HomeFigure, low: number, high: number) => `${FIGURE_EN[key][0]} ${FIGURE_EN[key][1](low)} to ${FIGURE_EN[key][1](high)}`;

/**
 * The prompt's lines on what the player knows of their own country when
 * they do not govern, so the story, the ministers' words and the reports
 * keep to it. Nothing for the leader.
 */
export function describeHomeSight(state: ViewState): string[] {
  const role = state.role;
  if (!role || role.kind === "leader") return [];
  const view = homeView(state);
  const keys = HOME_FIGURES.filter((k) => trueFigures(state)[k] !== undefined);
  if (role.kind === "opposition") {
    const d = dressing(state);
    if (d <= 0) return [`WHAT THE PLAYER KNOWS OF THEIR OWN COUNTRY: what the government publishes and the press reports. The press is free: the published figures are the true ones above.`];
    const published = keys.filter((k) => view[k].sight === "official").map((k) => figureEn(k, view[k].value!));
    const secret = keys.filter((k) => view[k].sight === "secret").map((k) => FIGURE_EN[k][0]);
    const rumours = keys.filter((k) => view[k].rumour).map((k) => rangeEn(k, view[k].rumour!.low, view[k].rumour!.high));
    return [
      `WHAT THE PLAYER KNOWS OF THEIR OWN COUNTRY: only what the government publishes and what is whispered. The government dresses its figures up (the engine's measure: ${Math.round(d * 100)}%, by the kind of rule and the press law). The official figures: ${published.join(", ") || "none"}${secret.length ? `; it publishes nothing on ${secret.join(", ")}` : ""}. The rumours: ${rumours.join("; ")}.`,
      "In the narrative and the reports, give the player the official figures and the rumours, never the true ones above, unless the movement's own press or its friends inside uncover something this period – then say how it was learned.",
    ];
  }
  const exact = keys.filter((k) => view[k].sight === "exact").map((k) => FIGURE_EN[k][0]);
  const from = role.kind === "general" ? "the command" : "the ministry";
  const within = Math.round(spread(insideSight(role, "gdp")) * 100);
  return [
    `WHAT THE PLAYER KNOWS OF THEIR OWN COUNTRY: ${from}'s own figures exactly (${exact.join(", ") || "none of the state's totals"}); the rest only roughly, within about ±${within}% – never more exactly in the story or the reports, unless someone tells the player (say who).`,
  ];
}

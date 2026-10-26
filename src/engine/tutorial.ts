import type { AdvisorId } from "./advisors";
import { OfficialsSetupSchema, startOfficials } from "./government";
import { seedInterests } from "./interests";
import { PoliticsSetupSchema, startPolitics } from "./politics";
import { getScenario, TUTORIAL_START } from "./scenarios";
import {
  FOES,
  FRIENDS,
  LETTER_REPLIES,
  MINISTER_ANSWERS,
  MINISTER_VIEWS,
  ORDER_WORDS,
  SCRIPTED_TURNS,
  TUTORIAL_OFFICIALS,
  TUTORIAL_POLITICS,
  VERDICTS,
  type OrderKind,
} from "./scenarios/tutorial";
import { createGame } from "./setup";
import type { TurnStage } from "./stages";
import { LOCALES, type GameState, type Localized, type Locale, type MapRegion } from "./types";

/**
 * The tutorial (scenarios/2022.ts, `variants.tutorial`): the first morning of
 * the invasion, played as Ukraine, a week a turn, its first turns written in
 * advance so a new player needs no account for them.
 *
 * A written answer is what the model would have sent – a turn's stages, a
 * minister's answer and view, a reply to a letter – in the player's language
 * (scenarios/tutorial.ts). The server streams it in place of the model's
 * (server/llm.ts) and it goes through the same schema and sanitizer, and the
 * client applies it with the same functions: the engine decides what comes of
 * it. Whatever the player orders, each order gets the verdict of its kind
 * (Kyiv, the army, the allies, talks…), and the week's story, news and front
 * are the same: the war does not wait for the player's orders.
 */

/** How many turns are written in advance. */
export const TUTORIAL_TURNS = SCRIPTED_TURNS.length;

/** A game begun on the tutorial start. */
export const isTutorial = (state: Pick<GameState, "variant">): boolean => state.variant === TUTORIAL_START.variant;

/** Whether the game is still within the written turns: the turn about to be played, and what is asked before it, is answered in advance. */
export function scriptedNow(state: Pick<GameState, "variant" | "turn" | "defeat" | "role">): boolean {
  return isTutorial(state) && state.turn <= TUTORIAL_TURNS && !state.defeat && (state.role?.kind ?? "leader") === "leader";
}

/** Whether a turn already played was a written one, so its ministers' views are written too. */
export const scriptedTurn = (state: Pick<GameState, "variant">, turn: number): boolean => isTutorial(state) && turn >= 1 && turn <= TUTORIAL_TURNS;

const isLocalized = (value: unknown): value is Localized =>
  typeof value === "object" && value !== null && !Array.isArray(value) && Object.keys(value).length === LOCALES.length && LOCALES.every((l) => typeof (value as Record<string, unknown>)[l] === "string");

/** Authored data in one language: every three-language text in it, however deep, picked. */
export function localize(value: unknown, locale: Locale): unknown {
  if (isLocalized(value)) return value[locale];
  if (Array.isArray(value)) return value.map((v) => localize(v, locale));
  if (typeof value === "object" && value !== null) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, localize(v, locale)]));
  return value;
}

/** What the tutorial game is called in the list of games. */
const TITLE: Localized = { en: "Tutorial", ru: "Обучение", uk: "Навчання" };

/** The tutorial game as it starts: the date's first morning as Ukraine, with Zelenskyy's cabinet and the Rada already described. */
export function tutorialGame(regions: MapRegion[], now = new Date(), locale: Locale = "en"): GameState {
  const scenario = getScenario(TUTORIAL_START.scenario, TUTORIAL_START.variant);
  const game = createGame(scenario, regions, scenario.player!, now, locale);
  return seedInterests({
    ...game,
    title: TITLE[locale],
    politics: startPolitics(PoliticsSetupSchema.parse(localize(TUTORIAL_POLITICS, locale)), game.date),
    officials: startOfficials(OfficialsSetupSchema.parse(localize(TUTORIAL_OFFICIALS, locale)), game.date),
  });
}

/** What an order is about, from its words. */
export function orderKind(order: string): OrderKind {
  return ORDER_WORDS.find(([, words]) => words.test(order))?.[0] ?? "other";
}

/** The written turn for the turn about to be played (the last one past them). */
const turnOf = (state: Pick<GameState, "turn">) => SCRIPTED_TURNS[Math.min(Math.max(state.turn, 1), TUTORIAL_TURNS) - 1];

/** A verdict on every order, by its kind: the same order gets the same verdict, whoever wrote it. */
function verdicts(state: Pick<GameState, "turn">, orders: string[], locale: Locale) {
  const week = Math.min(Math.max(state.turn, 1), TUTORIAL_TURNS) - 1;
  return orders.map((order, i) => {
    const { result, note } = VERDICTS[orderKind(order)];
    return { n: i + 1, result, note: (Array.isArray(note) ? note[Math.min(week, note.length - 1)] : note)[locale] };
  });
}

/**
 * The written answer to one stage of a turn, as the model would write it: the
 * story and the verdicts; the world's news, the front, the people and the
 * sanctions; the economies. The fronts it names it moves; the engine moves the rest.
 */
export function scriptedStage(state: GameState, stage: TurnStage, orders: string[], locale: Locale): Record<string, unknown> {
  const turn = turnOf(state);
  if (stage === "story") return { headline: turn.headline[locale], narrative: turn.narrative[locale], orders: verdicts(state, orders, locale) };
  if (stage === "world") {
    const scenario = getScenario(TUTORIAL_START.scenario, TUTORIAL_START.variant);
    return {
      events: turn.events.map((e) => ({ title: e.title[locale], body: e.body[locale], kind: e.kind, countries: e.countries.filter((c) => state.countries[c]) })),
      // Russia's share of each province on the fronts, with the towns it holds: those it held at the start and those taken since.
      transfers: turn.fronts
        .filter((f) => state.regions[f.region])
        .map((f) => ({ region: f.region, to: "russia", mode: "contest", share: f.share, towns: [...new Set([...(scenario.provinceTaken?.[f.region] ?? []), ...(f.towns ?? [])])] })),
      population: [{ country: state.player, deaths: turn.people.deaths, refugees: turn.people.refugees, cause: turn.people.cause[locale] }],
      sanctions: turn.sanctions.filter((s) => state.countries[s.by]).map((s) => ({ by: s.by, against: "russia", scope: s.scope })),
    };
  }
  return { economy: turn.economy.filter((e) => state.countries[e.country]) };
}

/** A minister's written answer, to whatever was asked: the view from their portfolio, and the orders they drafted. */
export function scriptedAdvice(advisor: AdvisorId, locale: Locale): Record<string, unknown> {
  const { answer, orders } = MINISTER_ANSWERS[advisor];
  return { answer: answer[locale], ...(orders ? { orders: orders.map((o) => o[locale]) } : {}) };
}

/** A minister's written view of a written turn. */
export function scriptedView(ministry: AdvisorId, locale: Locale): Record<string, unknown> {
  return { report: MINISTER_VIEWS[ministry][locale], stance: "loyal" };
}

/** Who writes back to a letter, and how: Poland, the West, Moscow, its friends, or the rest. */
export function letterSide(state: Pick<GameState, "player" | "wars" | "alliances">, target: string): keyof typeof LETTER_REPLIES {
  if (target === "poland") return "poland";
  if (target === "russia") return "russia";
  const atWar = state.wars.some((w) => (w.attackers.includes(target) && w.defenders.includes(state.player)) || (w.defenders.includes(target) && w.attackers.includes(state.player)));
  if (atWar || FOES.includes(target)) return "foe";
  const western = state.alliances.some((a) => (a.id === "nato" || a.id === "eu") && a.members.includes(target));
  return western || FRIENDS.includes(target) ? "friend" : "neutral";
}

/** The written reply to a letter. */
export function scriptedLetter(state: Pick<GameState, "player" | "wars" | "alliances">, target: string, locale: Locale): Record<string, unknown> {
  const { reply, stance, summary } = LETTER_REPLIES[letterSide(state, target)];
  return { reply: reply[locale], stance, summary };
}

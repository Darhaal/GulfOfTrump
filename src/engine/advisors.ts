import { z } from "zod";
import type { Directive, GameState, Localized, Operation } from "./types";

/**
 * The cabinet: the leader's chief of staff and six ministries the player governs through. Each minister can
 * be questioned between turns (answers in character and advises, but the
 * orders are the player's own; changes nothing), given standing directives — special operations planned
 * in detail among them — and reports on them after every turn, in a request
 * of its own once the turn is played (engine/reports.ts). The turn's game
 * master sees the directives, not the conversations.
 */
export const ADVISORS = ["chief", "military", "finance", "foreign", "interior", "intelligence", "science"] as const;
export type AdvisorId = (typeof ADVISORS)[number];

export const ADVISOR_TITLES: Record<AdvisorId, Localized> = {
  chief: { ru: "Глава администрации", uk: "Глава адміністрації", en: "Chief of Staff" },
  military: { ru: "Начальник генштаба", uk: "Начальник генштабу", en: "Chief of the General Staff" },
  finance: { ru: "Министр экономики и финансов", uk: "Міністр економіки та фінансів", en: "Minister of the Economy and Finance" },
  foreign: { ru: "Министр иностранных дел", uk: "Міністр закордонних справ", en: "Foreign Minister" },
  interior: { ru: "Министр внутренних дел", uk: "Міністр внутрішніх справ", en: "Minister of the Interior" },
  intelligence: { ru: "Глава разведки", uk: "Голова розвідки", en: "Head of Intelligence" },
  science: { ru: "Министр науки", uk: "Міністр науки", en: "Minister of Science" },
};

/** Who each minister is, for the model. */
export const ADVISOR_PERSONAS: Record<AdvisorId, string> = {
  chief:
    "the head of the leader's office, the chief of staff: the closest adviser, who runs the government's agenda and sees everything — politics, people, appointments, the leader's image, the court and its intrigues, and what every minister is really up to. Speaks frankly to the leader alone.",
  military:
    "the chief of the general staff: armies, fronts, terrain, railways, supply, mobilisation and what the enemy can do. Blunt and practical; thinks in divisions, distances and weeks.",
  finance:
    "the minister of the economy and finance: GDP, industry, the budget, taxes, debt, reserves, prices, trade and the strategic resources industry needs. Cautious; counts every dollar and warns about deficits and shortages.",
  foreign:
    "the foreign minister: alliances, rivals, what each government wants and fears, treaties and how others will react. Polished; sees several moves ahead.",
  interior:
    "the minister of the interior: the police and security at home, public order, the parties and the opposition, elections, the press, propaganda and censorship. Watchful; counts protesters, informers and votes.",
  intelligence:
    "the head of intelligence: what other governments are planning in secret, their weak points, unrest, agents and propaganda. Terse; speaks in estimates and probabilities.",
  science:
    "the minister of science and research: the laboratories, the universities and the academy, the research projects under way (RESEARCH below) and what the scientists can deliver and when — new weapons, industry, medicine, harvests. Precise; speaks in years, budgets and what is physically possible, and fights for money for the scientists.",
};

export interface AdviceMessage {
  from: "player" | "advisor";
  text: string;
  date: string;
  turn: number;
  /** A special operation the minister proposes, for the government to approve. */
  operation?: Operation;
}

export const AdviceSchema = z.object({
  answer: z.string().trim().min(1).max(4000),
  // A special operation the minister proposes; it starts only when the government approves it.
  operation: z
    .object({
      name: z.string().trim().min(1).max(120),
      target: z.string().trim().max(200).default(""),
      goal: z.string().trim().max(400).default(""),
      means: z.string().trim().max(400).default(""),
      timing: z.string().trim().max(120).default(""),
      secrecy: z.enum(["open", "covert", "deniable"]).catch("covert").default("covert"),
    })
    .optional()
    .catch(undefined),
});

export type AdviceReply = z.infer<typeof AdviceSchema>;

/** How many earlier messages with a minister the model sees, and how many a save keeps. */
export const ADVISOR_HISTORY = 8;
export const MAX_ADVICE = 40;

export function addAdvice(state: GameState, advisor: AdvisorId, question: string, reply: AdviceReply, now = new Date()): GameState {
  const next = structuredClone(state);
  const thread = next.advice?.[advisor] ?? [];
  const asked: AdviceMessage = { from: "player", text: question, date: state.date, turn: state.turn };
  const answered: AdviceMessage = {
    from: "advisor",
    text: reply.answer,
    date: state.date,
    turn: state.turn,
    ...(reply.operation ? { operation: reply.operation } : {}),
  };
  next.advice = { ...next.advice, [advisor]: [...thread, asked, answered].slice(-MAX_ADVICE) };
  next.updatedAt = now.toISOString();
  return next;
}

/** Ministries that plan special operations in detail. */
export const OPERATION_MINISTRIES: AdvisorId[] = ["military", "intelligence", "interior"];

/** How many directives may stand at once, across the cabinet. */
export const MAX_DIRECTIVES = 12;

/** A ministry's report on one directive. */
export const DIRECTIVE_STATUSES = ["progress", "done", "failed"] as const;

/** A directive in one line for the game master: the task, or the operation in full. */
export function directiveLine(d: Directive): string {
  if (!d.operation) return `${d.id}: ${d.text} (since ${d.since})`;
  const o = d.operation;
  return `${d.id}: SPECIAL OPERATION "${o.name}" — target: ${o.target}; goal: ${o.goal}; means: ${o.means}; timing: ${o.timing}; secrecy: ${o.secrecy} (ordered ${d.since})`;
}

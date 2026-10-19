import { z } from "zod";
import { isHexColor } from "./colors";
import { applyLaws, LAW_IDS, lawsShape, type Laws, startLaws } from "./laws";
import type { AppliedChange, Bill, GameState, Localized, Politics } from "./types";

/**
 * Acts of state drafted in conversation. The leader tells the chief of
 * staff what to proclaim or enact and why; the chief answers in character
 * and drafts each act — a new name for the country or a city (in three
 * languages), a colour on the map, a law or a decree — with the public's
 * expected reaction, judged on the reasons given. A proclamation waits
 * for the end of the turn; a bill or decree goes before the game master,
 * who decides by the votes (or, for a decree, whether it stands). A passed
 * act changes the laws it names, and the reaction moves unrest.
 */

const text = (max: number) => z.string().trim().min(1).max(max);
const localized = z.object({ ru: text(80), uk: text(80), en: text(80) });
const reaction = z
  .object({ unrest: z.number().finite().catch(0).default(0), note: z.string().trim().max(400).default("") })
  .catch({ unrest: 0, note: "" })
  .default({ unrest: 0, note: "" });

export const VOTES = ["majority", "twothirds", "decree"] as const;

/** One act the chief of staff drafts. */
const actShape = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("rename"), target: text(80), names: localized, reaction }),
  z.object({ kind: z.literal("color"), color: z.string().trim(), reaction }),
  z.object({ kind: z.literal("law"), title: text(200), text: z.string().trim().max(1500).default(""), laws: lawsShape, vote: z.enum(VOTES).catch("majority").default("majority"), reaction }),
]);

/** The chief of staff's answer: what they say, and the acts they drafted. */
export const ActReplySchema = z.object({
  answer: text(4000),
  acts: z.array(actShape.catch(null as never)).max(12).catch([]).default([]),
});
export type ActReply = z.infer<typeof ActReplySchema>;
export type ActDraft = ActReply["acts"][number];

/** Reactions within reason: a single act moves unrest by at most this much either way. */
const REACTION = { min: -10, max: 20 };
export const boundReaction = (r: { unrest: number; note: string }) => ({ unrest: Math.round(Math.max(REACTION.min, Math.min(REACTION.max, r.unrest))), note: r.note });

/** How many drafts one answer brings. */
const MAX_DRAFTS = 4;

/** The acts that point at things that exist: the country, a known city, a real colour. */
export function keepActs(reply: ActReply, cities: string[]): ActDraft[] {
  return reply.acts
    .filter(Boolean)
    .filter((a) => (a.kind === "rename" ? a.target === "country" || cities.includes(a.target) : a.kind === "color" ? isHexColor(a.color) : true))
    .slice(0, MAX_DRAFTS)
    .map((a) => ({ ...a, reaction: boundReaction(a.reaction) }));
}

/** How many messages with the chief of staff a save keeps, and the model sees. */
export const MAX_LEGAL = 40;
export const LEGAL_HISTORY = 8;

/** The conversation goes into the save, the drafts with the answer. */
export function addLegal(state: GameState, question: string, reply: { answer: string; acts: ActDraft[] }, now = new Date()): GameState {
  const thread = state.legal ?? [];
  return {
    ...state,
    legal: [
      ...thread,
      { from: "player" as const, text: question, date: state.date, turn: state.turn },
      { from: "advisor" as const, text: reply.answer, date: state.date, turn: state.turn, ...(reply.acts.length ? { drafts: reply.acts } : {}) },
    ].slice(-MAX_LEGAL),
    updatedAt: now.toISOString(),
  };
}

/** A drafted law put before parliament (or signed as a decree): it waits for the game master's verdict. */
export function proposeBill(state: GameState, draft: Extract<ActDraft, { kind: "law" }>, now = new Date()): GameState {
  const id = `bill-${state.turn}-${(state.bills?.length ?? 0) + 1}`;
  const laws = startLaws(draft.laws);
  const bill: Bill = {
    id,
    title: draft.title,
    text: draft.text,
    ...(laws ? { laws } : {}),
    vote: draft.vote,
    status: "proposed",
    turn: state.turn,
    date: state.date,
    reaction: boundReaction(draft.reaction),
  };
  return { ...state, bills: [...(state.bills ?? []), bill], updatedAt: now.toISOString() };
}

/** A bill not yet decided can be withdrawn. */
export function withdrawBill(state: GameState, id: string, now = new Date()): GameState {
  return { ...state, bills: (state.bills ?? []).filter((b) => b.id !== id || b.status !== "proposed"), updatedAt: now.toISOString() };
}

/** The game master's verdicts on the bills. */
export const billsField = z
  .array(z.object({ bill: text(80), status: z.enum(["passed", "failed"]), note: z.string().trim().max(400).default("") }))
  .max(10)
  .default([]);

/** Turns a bill may wait for a vote before it lapses. */
const PATIENCE = 3;

/**
 * A turn for the bills: the verdicts land, a passed bill changes the laws
 * and moves unrest by its reaction; one left too long lapses.
 */
export function applyBills(next: GameState, verdicts: z.infer<typeof billsField>, ctx: { turn: number; to: string }, applied: AppliedChange[]): void {
  if (!next.bills?.length) return;
  next.bills = next.bills.map((b) => {
    if (b.status !== "proposed") return b;
    const verdict = verdicts.find((v) => v.bill === b.id);
    // A bill proposed on turn n has its last chance on turn n + PATIENCE - 1.
    const status = verdict?.status ?? (ctx.turn - b.turn + 1 >= PATIENCE ? "failed" : undefined);
    if (!status) return b;
    applied.push({ kind: "bill", title: b.title, change: status, ...(verdict?.note ? { note: verdict.note } : {}) });
    if (status === "passed" && next.politics) {
      const laws = applyLaws(next.politics.laws, b.laws, applied);
      next.politics = { ...next.politics, ...(laws ? { laws } : {}), unrest: clampUnrest(next.politics, b.reaction?.unrest ?? 0) };
    }
    return { ...b, status, decided: ctx.to, ...(verdict?.note ? { note: verdict.note } : {}) };
  });
}

const clampUnrest = (p: Politics, delta: number) => Math.max(0, Math.min(100, Math.round(p.unrest + delta)));

/** The bills awaiting a verdict, for the game master. */
export function describeBills(state: GameState): string[] {
  const open = (state.bills ?? []).filter((b) => b.status === "proposed");
  if (!open.length) return [];
  const changes = (laws?: Laws) => (laws ? LAW_IDS.filter((id) => laws[id]).map((id) => `${id} → ${laws[id]}`).join(", ") : "");
  return [
    "",
    "BILLS AND DECREES OF THE PLAYER'S GOVERNMENT AWAITING A VERDICT (id | title | needs | changes to the laws | what it says | expected reaction):",
    ...open.map((b) => `- ${b.id} | ${b.title} | ${b.vote === "decree" ? "a decree" : b.vote === "twothirds" ? "two thirds of the seats" : "a majority of the seats"} | ${changes(b.laws) || "-"} | ${b.text || "-"} | ${b.reaction?.note || "-"}`),
  ];
}

/** Turns a reaction into what the game master is told about a proclamation part. */
export const reactionLine = (what: string, r?: { unrest: number; note: string }) => (r ? `${what}: expected unrest ${r.unrest > 0 ? "+" : ""}${r.unrest}${r.note ? ` (${r.note})` : ""}` : what);

export type { Localized };

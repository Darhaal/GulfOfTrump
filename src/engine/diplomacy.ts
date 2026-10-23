import { z } from "zod";
import { clipAnswer } from "./advisors";
import type { DiplomacyMessage, GameState, Stance } from "./types";

export const DiplomacySchema = z.object({
  // A long letter is cut at a whole sentence, never refused.
  reply: z.string().trim().min(1).transform(clipAnswer),
  stance: z.enum(["agree", "refuse", "counter", "neutral"]).catch("neutral"),
  summary: z.string().trim().max(400).default(""),
});

export type DiplomacyReply = z.infer<typeof DiplomacySchema>;

/** How many earlier messages with a country the model sees. */
export const DIPLOMACY_HISTORY = 12;

export function addDiplomacyExchange(
  state: GameState,
  target: string,
  message: string,
  reply: { reply: string; stance: Stance; summary: string },
  now = new Date(),
): GameState {
  const next = structuredClone(state);
  const thread = next.diplomacy[target] ?? [];
  const mine: DiplomacyMessage = { from: "player", text: message, date: state.date, turn: state.turn };
  const theirs: DiplomacyMessage = {
    from: "them",
    text: reply.reply,
    date: state.date,
    turn: state.turn,
    stance: reply.stance,
    ...(reply.summary ? { summary: reply.summary } : {}),
  };
  next.diplomacy[target] = [...thread, mine, theirs];
  next.updatedAt = now.toISOString();
  return next;
}

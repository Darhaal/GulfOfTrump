import { z } from "zod";
import { roll } from "./dice";
import { loyaltyOf } from "./politics";
import { ownProtests } from "./unrest";
import { PROTEST_STAGES, TALK_RESULTS, type GameState, type Loyalty, type Politics, type Protest, type Talk, type TalkLine, type TalkResult } from "./types";

/**
 * Talks the government holds in person: with the leaders of a protest or a
 * strike at home, and with plotters it has found out. Their side answers in
 * character; when the player ends the talks the model says what came of
 * them, and the engine decides and applies it: a deal calms the street or
 * weakens a plot, a concession ends it at a price, a split breaks its
 * ranks, and plotters may string the government along – the stronger the
 * plot, the likelier. The next turn's game master is told.
 */

/** How many talks a save keeps. */
export const KEEP_TALKS = 8;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Who would sit down for a protest: its leader, or its organisers. */
const counterpartOf = (p: Protest) => p.by?.trim() || p.title;

/** The talks under way with a protest or a plot, if any. */
export const talksWith = (politics: Pick<Politics, "talks"> | undefined, target: string) => politics?.talks?.find((t) => t.target === target && t.status === "open");

/**
 * The player opens talks: with a protest against its own government, or a
 * plot it knows of. Returns the state unchanged (and no talk) for anything
 * else; talks already under way are taken up again.
 */
export function openTalks(state: GameState, kind: Talk["with"], target: string, now = new Date()): { state: GameState; talk: Talk | null } {
  const politics = state.politics;
  if (!politics) return { state, talk: null };
  const under = talksWith(politics, target);
  if (under) return { state, talk: under };
  const protest = kind === "protest" ? ownProtests(state.protests, state.player).find((p) => p.id === target) : undefined;
  const plot = kind === "plot" ? politics.plots.find((p) => p.id === target && p.known) : undefined;
  if (!protest && !plot) return { state, talk: null };
  const talk: Talk = {
    id: `talk-${state.turn}-${now.getTime().toString(36)}`,
    with: kind,
    target,
    title: protest?.title ?? plot!.title,
    counterpart: protest ? counterpartOf(protest) : plot!.by || plot!.title,
    transcript: [],
    status: "open",
    date: state.date,
    turn: state.turn,
  };
  return { state: { ...state, politics: { ...politics, talks: [...(politics.talks ?? []), talk].slice(-KEEP_TALKS) }, updatedAt: now.toISOString() }, talk };
}

/** The other side's answer to what the player said. */
export const TalkReplySchema = z.object({
  said: z.string().trim().min(1).max(1500),
  speaker: z.string().trim().max(200).default(""),
});

/** What the model says came of the talks, for the engine to decide. */
export const TalkEndSchema = z.object({
  result: z.enum(TALK_RESULTS).catch("none").default("none"),
  note: z.string().trim().max(400).catch("").default(""),
});

/** Talks never play out without the player: they can end only after the government has said something. */
export const canEndTalks = (talk: Pick<Talk, "status" | "transcript">) => talk.status === "open" && talk.transcript.some((l) => l.player);

/** The player's words and the answer join the record of talks under way. */
export function speakInTalks(state: GameState, id: string, said: string, reply: z.infer<typeof TalkReplySchema>, now = new Date()): GameState {
  const politics = state.politics;
  const talk = politics?.talks?.find((t) => t.id === id && t.status === "open");
  if (!politics || !talk || !said.trim()) return state;
  const lines: TalkLine[] = [
    { speaker: state.countries[state.player]?.leader?.split(";")[0].trim() ?? "", text: said.trim().slice(0, 2000), player: true },
    { speaker: reply.speaker || talk.counterpart, text: reply.said },
  ];
  const next: Talk = { ...talk, transcript: [...talk.transcript, ...lines].slice(-40) };
  return { ...state, politics: { ...politics, talks: politics.talks!.map((t) => (t.id === id ? next : t)) }, updatedAt: now.toISOString() };
}

const rank = (stage: Protest["stage"]) => PROTEST_STAGES.indexOf(stage);
const stepStage = (stage: Protest["stage"], by: number) => PROTEST_STAGES[clamp(rank(stage) + by, 0, PROTEST_STAGES.length - 1)];

/**
 * What the talks really bring, decided by the engine from the model's
 * proposal: talks where nothing was said bring nothing, and plotters may
 * take a deal only to buy time – a chance that grows with the plot's
 * strength.
 */
export function decideTalks(state: GameState, talk: Talk, proposed: TalkResult): TalkResult {
  if (!talk.transcript.some((l) => l.player)) return "none";
  if (talk.with === "plot" && (proposed === "deal" || proposed === "concession")) {
    const plot = state.politics?.plots.find((p) => p.id === talk.target);
    const strength = plot?.strength ?? 0;
    if (roll(state.seed ?? state.id, state.turn, `talks:${talk.id}`) < strength / 250) return "betrayal";
  }
  return proposed;
}

/**
 * The talks end. The engine decides what came of them and applies it at
 * once:
 * - with a protest: a deal halves it and steps it down, a concession ends it
 *   (the elites resent giving in), a split thins it and its organisation, a
 *   betrayal steps it up;
 * - with a plot: a deal weakens it much, a concession ends it at the elites'
 *   cost, a split weakens it, a betrayal strengthens it and shakes the
 *   security services.
 * Talks where the government has said nothing do not end (canEndTalks).
 */
export function settleTalks(state: GameState, id: string, proposal: z.infer<typeof TalkEndSchema>, now = new Date()): GameState {
  const politics = state.politics;
  const talk = politics?.talks?.find((t) => t.id === id && t.status === "open");
  if (!politics || !talk || !canEndTalks(talk)) return state;
  const result = decideTalks(state, talk, proposal.result);
  let protests = state.protests ?? [];
  let plots = politics.plots;
  let unrest = politics.unrest;
  const loyalty: Loyalty = { ...loyaltyOf(politics) };
  if (talk.with === "protest") {
    const p = protests.find((x) => x.id === talk.target);
    if (p) {
      if (result === "deal") protests = protests.map((x) => (x === p ? { ...x, size: Math.round(x.size * 0.5), stage: stepStage(x.stage, -1) } : x));
      if (result === "concession") protests = protests.filter((x) => x !== p);
      if (result === "split") protests = protests.map((x) => (x === p ? { ...x, size: Math.round(x.size * 0.7), organisation: clamp((x.organisation ?? 50) - 20, 0, 100) } : x));
      if (result === "betrayal") protests = protests.map((x) => (x === p ? { ...x, size: Math.round(x.size * 1.2), stage: stepStage(x.stage, 1) } : x));
      unrest += { deal: -4, concession: -6, split: -2, betrayal: 3, none: 0 }[result];
      if (result === "concession") loyalty.elites = clamp(loyalty.elites - 3, 0, 100);
    }
  } else {
    const p = plots.find((x) => x.id === talk.target);
    if (p) {
      const strength = p.strength + { deal: -35, concession: -100, split: -20, betrayal: 10, none: 0 }[result];
      plots = strength <= 5 ? plots.filter((x) => x !== p) : plots.map((x) => (x === p ? { ...x, strength: clamp(strength, 0, 100) } : x));
      if (result === "concession") loyalty.elites = clamp(loyalty.elites - 4, 0, 100);
      if (result === "betrayal") loyalty.security = clamp(loyalty.security - 3, 0, 100);
    }
  }
  // The model's note describes the result it proposed; where the engine decided otherwise, it would mislead.
  const done: Talk = { ...talk, status: "done", result, ...(proposal.note && result === proposal.result ? { note: proposal.note } : {}) };
  return {
    ...state,
    protests,
    politics: { ...politics, plots, unrest: clamp(unrest, 0, 100), loyalty, talks: politics.talks!.map((t) => (t.id === id ? done : t)) },
    updatedAt: now.toISOString(),
  };
}

/** The talks since the last turn, for the game master: what was agreed must hold, a betrayal has its consequences. */
export function describeTalks(politics: Politics | undefined, turn: number): string[] {
  const held = (politics?.talks ?? []).filter((t) => t.turn === turn && t.status === "done" && t.result && t.result !== "none");
  if (!held.length) return [];
  return [
    "",
    "TALKS SINCE THE LAST TURN (the government met them in person; the engine has applied the result – honour the terms, and show what follows):",
    ...held.map((t) => `- with ${t.counterpart} (${t.with} "${t.title}"): ${t.result!.toUpperCase()}${t.note ? ` – ${t.note}` : ""}`),
  ];
}

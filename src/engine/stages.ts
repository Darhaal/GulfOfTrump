import { z } from "zod";
import { addStep } from "./calendar";
import {
  HomeSchema,
  mergeStages,
  sanitizeHome,
  sanitizeStory,
  sanitizeWorld,
  StorySchema,
  WorldSchema,
  type HomePart,
  type Outcome,
  type SanitizeOptions,
  type StoryPart,
  type WorldPart,
} from "./outcome";
import type { ChronicleEntry, GameState, OrderVerdict } from "./types";

/**
 * A turn written in stages, so the first news comes before the whole world
 * is settled. Each stage is a request of its own, with only its sections of
 * the world and its own rules (engine/stagePrompts.ts), its own answer's
 * schema and its own sanitizer (engine/outcome.ts):
 *
 * 1. story – the headline, the narrative of the player's period and a
 *    verdict on every order; the report opens on it at once;
 * 2. world – the map and the fronts, wars and blocs, other governments,
 *    the losses and the world's news;
 * 3. home – the economies, the player's politics, laws and government, the
 *    ministries, money and deals, the street.
 *
 * The world and home both carry out the story and run side by side once it
 * is in. Nothing is applied until all three are: the state stays as it was
 * before the turn, the report shows the stages that have landed, and the
 * three checked parts become one outcome for applyOutcome. The engine's
 * dice are drawn from the state before the turn, so every stage reads the
 * same dice and the turn lands as one consistent change. A turn cancelled
 * or cut off keeps the parts that landed (PendingTurn); asked again for the
 * same state and orders, it requests only what is missing.
 */
export const TURN_STAGES = ["story", "world", "home"] as const;
export type TurnStage = (typeof TURN_STAGES)[number];

/** The checked parts of a turn that have landed. */
export interface StageParts {
  story?: StoryPart;
  world?: WorldPart;
  home?: HomePart;
}

/** What a stage's request returns. */
export type StagePart<S extends TurnStage> = S extends "story" ? StoryPart : S extends "world" ? WorldPart : HomePart;

/** Each stage's answer schema. */
export const STAGE_SCHEMAS = { story: StorySchema, world: WorldSchema, home: HomeSchema } as const;

/** A stage's answer checked by its own sanitizer: only its own fields come through. */
export function sanitizeStage<S extends TurnStage>(stage: S, state: GameState, raw: unknown, options: SanitizeOptions = {}): StagePart<S> {
  if (stage === "story") return sanitizeStory(state, StorySchema.parse(raw), options) as StagePart<S>;
  if (stage === "world") return sanitizeWorld(state, WorldSchema.parse(raw), options) as StagePart<S>;
  return sanitizeHome(state, HomeSchema.parse(raw), options) as StagePart<S>;
}

/** The stages still to write, in order. */
export const missingStages = (parts: StageParts): TurnStage[] => TURN_STAGES.filter((s) => !parts[s]);

/** The whole outcome once every stage has landed; null before. */
export function completeOutcome(parts: StageParts): Outcome | null {
  return parts.story && parts.world && parts.home ? mergeStages(parts.story, parts.world, parts.home) : null;
}

/** The story as the later stages read it. */
export interface StoryCarry {
  headline: string;
  narrative: string;
  verdicts: OrderVerdict[];
}

/** The story a request brings for the world or home stage, checked. */
export const StoryCarrySchema = z.object({
  headline: z.string().trim().min(1).max(400),
  narrative: z.string().trim().min(1).max(8000),
  verdicts: z
    .array(z.object({ n: z.number().int(), result: z.enum(["success", "partial", "failed"]), note: z.string().max(300).default("") }))
    .max(12)
    .default([]),
});

export const storyCarry = (part: StoryPart): StoryCarry => ({ headline: part.headline, narrative: part.narrative, verdicts: part.verdicts });

/**
 * The turn's report before it is applied: the story, and the world's news
 * once they are in. What changed and the economy come with the turn itself.
 */
export function previewEntry(state: Pick<GameState, "turn" | "date" | "step">, orders: string[], parts: StageParts): ChronicleEntry {
  return {
    turn: state.turn,
    from: state.date,
    to: addStep(state.date, state.step),
    orders,
    ...(parts.story?.verdicts.length ? { verdicts: parts.story.verdicts } : {}),
    headline: parts.story?.headline ?? "",
    narrative: parts.story?.narrative ?? "",
    events: parts.world?.events ?? [],
    applied: [],
  };
}

/** A turn under way: the parts that landed, for the state and orders they were written for. */
export interface PendingTurn {
  key: string;
  turn: number;
  parts: StageParts;
}

/**
 * The fingerprint of a turn's request: the state (whatever the order of its
 * keys, without the moment it was saved), the orders and the language. Parts
 * written for one fingerprint are never used for another, so a change made
 * after a cancelled turn starts it afresh.
 */
export function turnKey(state: GameState, orders: string[], locale: string): string {
  let hash = 0x811c9dc5;
  const feed = (text: string) => {
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
  };
  const walk = (value: unknown): void => {
    if (value === null || typeof value !== "object") {
      feed(JSON.stringify(value) ?? "u");
      return;
    }
    if (Array.isArray(value)) {
      feed("[");
      for (const v of value) {
        walk(v);
        feed(",");
      }
      feed("]");
      return;
    }
    feed("{");
    for (const k of Object.keys(value).sort()) {
      const v = (value as Record<string, unknown>)[k];
      if (v === undefined || k === "updatedAt" || k === "draft") continue;
      feed(k);
      feed(":");
      walk(v);
      feed(",");
    }
    feed("}");
  };
  walk(state);
  feed(JSON.stringify(orders));
  feed(locale);
  return `${state.id}:${state.turn}:${(hash >>> 0).toString(36)}`;
}

/** The pending turn for this request, kept if its fingerprint matches, else a fresh one. */
export function pendingFor(pending: PendingTurn | null | undefined, key: string, turn: number): PendingTurn {
  return pending && pending.key === key ? pending : { key, turn, parts: {} };
}

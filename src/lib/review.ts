/**
 * Asking the Store copy's player for a review: after half an hour of play,
 * counted across sessions while a game is on screen, once; "later" asks
 * again after two more hours, a review, a letter or "don't ask" never again.
 * The Store and a private letter are offered side by side, to everyone:
 * nobody is steered away from the Store by what they think of the game.
 * Kept in the player's browser storage, nothing sent anywhere
 * (components/game/ReviewPrompt.tsx).
 */

/** Minutes of play before the first question. */
export const REVIEW_AFTER_MIN = 30;
/** Minutes more of play after "later" before the question comes back. */
export const REVIEW_AGAIN_MIN = 120;

export interface ReviewState {
  /** Seconds of play counted so far. */
  played: number;
  /** The seconds of play at which to ask. */
  next: number;
  /** Answered for good: reviewed, or asked not to be asked. */
  done?: boolean;
}

/** A review in the Store, a letter to the author instead, later, or never. */
export type ReviewAnswer = "review" | "write" | "later" | "never";

const KEY = "got_review";

export const freshReview = (): ReviewState => ({ played: 0, next: REVIEW_AFTER_MIN * 60 });

/** Whether the question is due now. */
export const reviewDue = (s: ReviewState): boolean => !s.done && s.played >= s.next;

/** Seconds of play added; nothing once answered for good. */
export const addPlay = (s: ReviewState, seconds: number): ReviewState => (s.done || seconds <= 0 ? s : { ...s, played: s.played + Math.round(seconds) });

/** The player's answer: asked again later, or never. */
export function answerReview(s: ReviewState, answer: ReviewAnswer): ReviewState {
  if (answer === "later") return { ...s, next: s.played + REVIEW_AGAIN_MIN * 60 };
  return { ...s, done: true };
}

/** What was kept, or a fresh count when there is nothing (a private window, cleared storage). */
export function readReview(): ReviewState {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "null") as Partial<ReviewState> | null;
    if (!raw || typeof raw.played !== "number" || typeof raw.next !== "number") return freshReview();
    return { played: Math.max(0, raw.played), next: Math.max(0, raw.next), ...(raw.done ? { done: true } : {}) };
  } catch {
    return freshReview();
  }
}

export function writeReview(s: ReviewState): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Storage blocked: the count starts again next time, the question at worst comes later.
  }
}

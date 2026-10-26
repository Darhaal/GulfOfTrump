"use client";

import { getScenario, TUTORIAL_START } from "@/engine/scenarios";
import { tutorialGame } from "@/engine/tutorial";
import type { Locale } from "@/engine/types";
import { loadMap } from "./maps";
import { readPreference, setPreference } from "./preferences";
import { listSaves, writeSave } from "./saves";
import { trackGameStart } from "./telemetry/game";

/**
 * The tutorial in the browser (engine/tutorial.ts): a player's first visit
 * opens it instead of the front page, the 2022 card and Settings start it
 * again, and its guide (components/game/Tour.tsx, `Guide`) remembers its
 * step per game.
 *
 * A first visit is one with no "tutorial" preference, no game saved and no
 * first-run tour seen (a browser that played before the tutorial existed).
 * Finishing the tutorial, skipping it or being found to have played before
 * sets the preference; until then the front page does not ask about
 * anonymous statistics (components/Telemetry.tsx).
 */

/** Whether the tutorial is behind this browser: finished, skipped, or not needed. */
export const tutorialDone = (): boolean => readPreference("tutorial") === "done";

/** The tutorial is behind this browser: the front page shows from now on. */
export const finishTutorial = () => setPreference("tutorial", "done");

/** The first-run tour was seen or skipped (components/game/Tour.tsx keeps it under this key): a browser that played before. */
function tourSeen(): boolean {
  try {
    return localStorage.getItem("got_tour") === "done";
  } catch {
    return true;
  }
}

/** Search engines and link previews read the front page as it is. */
const isBot = () => typeof navigator !== "undefined" && /bot|crawl|spider|slurp|lighthouse|facebookexternalhit|embedly|preview/i.test(navigator.userAgent);

let starting: Promise<string> | null = null;

/**
 * Starts a new tutorial game and saves it; its id. One at a time, however
 * often it is asked. Its words are in the player's language as stored now,
 * not as a page rendered before it knew it.
 */
export function startTutorial(locale: Locale = readPreference("locale")): Promise<string> {
  starting ??= (async () => {
    const map = await loadMap(getScenario(TUTORIAL_START.scenario, TUTORIAL_START.variant).map);
    const state = tutorialGame(map.regions, new Date(), locale);
    await writeSave(state);
    trackGameStart(state);
    return state.id;
  })().finally(() => {
    starting = null;
  });
  return starting;
}

/**
 * Whether this visit to the front page is a player's first, so the tutorial
 * opens instead. A browser that has played before is marked so, and never
 * asked again.
 */
export async function isFirstVisit(): Promise<boolean> {
  if (tutorialDone() || isBot()) return false;
  if (tourSeen()) {
    finishTutorial();
    return false;
  }
  const saves = await listSaves().catch(() => []);
  if (saves.length) {
    finishTutorial();
    return false;
  }
  return true;
}

// ---- the guide's place in each tutorial game

const guideKey = (id: string) => `got_guide_${id}`;

/** The guide's step in a tutorial game ("off" once closed there), or null where it has not begun. */
export function readGuide(id: string): string | null {
  try {
    return localStorage.getItem(guideKey(id));
  } catch {
    return null;
  }
}

export function writeGuide(id: string, step: string) {
  try {
    localStorage.setItem(guideKey(id), step);
  } catch {
    // Not remembered: the guide starts again on a reload.
  }
}

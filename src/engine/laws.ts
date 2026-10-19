import { z } from "zod";
import type { AppliedChange } from "./types";

/**
 * The laws a state lives by: a short list every country has an answer to,
 * each with its options from the most open to the most closed. The game
 * master gives them on the start date and changes them when a decree or a
 * vote does; the player proposes changes as bills. The engine checks the
 * options, logs every change, and reads the call-up law: a volunteer army
 * draws on fewer people than universal service, and martial law on more.
 */
export const LAWS = {
  conscription: ["volunteer", "selective", "universal"],
  martial: ["none", "emergency", "martial"],
  press: ["free", "restricted", "censored", "state"],
  assembly: ["free", "permit", "banned"],
  elections: ["free", "managed", "suspended"],
  economy: ["market", "mixed", "planned"],
  language: ["single", "regional", "two"],
  alignment: ["neutral", "nonbloc", "aligned"],
  deathPenalty: ["abolished", "moratorium", "applied"],
  exit: ["open", "permit", "closed"],
} as const;

export type LawId = keyof typeof LAWS;
export const LAW_IDS = Object.keys(LAWS) as LawId[];
export type Laws = { [K in LawId]?: (typeof LAWS)[K][number] };

const option = <K extends LawId>(id: K) => z.enum(LAWS[id]).optional().catch(undefined);

/** Laws as the model writes them: unknown laws and options are dropped. */
export const lawsShape = z
  .object({
    conscription: option("conscription"),
    martial: option("martial"),
    press: option("press"),
    assembly: option("assembly"),
    elections: option("elections"),
    economy: option("economy"),
    language: option("language"),
    alignment: option("alignment"),
    deathPenalty: option("deathPenalty"),
    exit: option("exit"),
  })
  .optional()
  .catch(undefined);

/** Laws as the model first gives them, without the empty ones. */
export function startLaws(raw: z.infer<typeof lawsShape>): Laws | undefined {
  if (!raw) return undefined;
  const out: Laws = {};
  for (const id of LAW_IDS) if (raw[id]) (out as Record<string, string>)[id] = raw[id]!;
  return Object.keys(out).length ? out : undefined;
}

/** New laws over the old ones; every change goes into the chronicle. */
export function applyLaws(current: Laws | undefined, change: z.infer<typeof lawsShape>, applied: AppliedChange[]): Laws | undefined {
  if (!change) return current;
  const next: Laws = { ...(current ?? {}) };
  for (const id of LAW_IDS) {
    const to = change[id];
    if (!to || to === next[id]) continue;
    applied.push({ kind: "law", law: id, ...(next[id] ? { from: next[id] } : {}), to });
    (next as Record<string, string>)[id] = to;
  }
  return Object.keys(next).length ? next : undefined;
}

/** How many people the call-up law reaches, against the era's norm. */
export function callUpFactor(laws: Laws | undefined): number {
  const base = laws?.conscription === "volunteer" ? 0.5 : laws?.conscription === "universal" ? 1.5 : 1;
  return base * (laws?.martial === "martial" ? 1.3 : 1);
}

/** The laws for the game master. */
export function describeLaws(laws: Laws | undefined): string {
  if (!laws || !Object.keys(laws).length) return "Laws in force: not described yet — give politics.laws this turn (conscription, martial, press, assembly, elections, economy, language, alignment, deathPenalty, exit).";
  return `Laws in force: ${LAW_IDS.filter((id) => laws[id]).map((id) => `${id} ${laws[id]}`).join(", ")}`;
}

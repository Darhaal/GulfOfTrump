"use client";

import type { AdviceReply, AdvisorId } from "@/engine/advisors";
import type { Candidate } from "@/engine/government";
import type { DeputyDraft } from "@/engine/deputies";
import type { DiplomacyReply } from "@/engine/diplomacy";
import type { SessionTalk } from "@/engine/parliament";
import type { MinisterReport } from "@/engine/reports";
import type { StagePart, StoryCarry, TurnStage } from "@/engine/stages";
import type { ArmyOrganisation, GameState, Locale, Official, OfficialPost, Politics, SummitLine, TalkResult } from "@/engine/types";
import { DEMO_HEADER } from "@/constants/app";
import { readPreference } from "./preferences";

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable = false,
  ) {
    super(message);
  }
}

export interface AiStatus {
  provider: "chatgpt" | "mock";
  status: "disconnected" | "connecting" | "connected" | "reauth_required";
  sharing: boolean;
  identity?: { name?: string; email?: string };
  error?: { code: string; message: string };
}

async function json<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (body as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(error?.code ?? "network_error", error?.message ?? `HTTP ${response.status}`);
  }
  return body as T;
}

/** Every game request says whether the player chose the offline demo (server/demo.ts). */
const post = (url: string, body: unknown, signal?: AbortSignal) =>
  fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...(readPreference("demo") === "1" ? { [DEMO_HEADER]: "1" } : {}) },
    body: JSON.stringify(body),
    signal,
  });

export const getAiStatus = () => fetch("/api/ai/status", { cache: "no-store" }).then((r) => json<AiStatus>(r));
export const connectAi = () => post("/api/ai/connect", {}).then((r) => json<{ authUrl: string }>(r));
export const disconnectAi = () => post("/api/ai/disconnect", {}).then((r) => json<{ revoked: boolean }>(r));
export const getModels = () =>
  fetch("/api/ai/models", { cache: "no-store" }).then((r) => json<{ models: { slug: string; displayName: string }[] }>(r));

/**
 * Reads a newline-delimited JSON stream: progress lines while the model is
 * writing, then a `done` line with the result or an `error` line.
 */
async function stream<T>(url: string, body: unknown, onProgress: (chars: number) => void, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await post(url, body, signal);
  } catch (error) {
    if (signal?.aborted) throw new ApiError("cancelled", "Cancelled.");
    throw new ApiError("network_error", (error as Error).message, true);
  }
  if (!response.ok || !response.body) await json(response);
  const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let newline: number;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line) continue;
        const event = JSON.parse(line) as { type: string; chars?: number; code?: string; message?: string; retryable?: boolean } & T;
        if (event.type === "progress") onProgress(event.chars ?? 0);
        else if (event.type === "error") throw new ApiError(event.code ?? "error", event.message ?? "Error", event.retryable);
        else if (event.type === "done") return event;
      }
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (signal?.aborted) throw new ApiError("cancelled", "Cancelled.");
    throw new ApiError("network_error", (error as Error).message, true);
  }
  throw new ApiError("network_error", "The game server closed the connection early.", true);
}

/** Only the recent past travels to the server; the prompt uses no more. */
function trimForServer(state: GameState): GameState {
  return {
    ...state,
    chronicle: state.chronicle.slice(-12),
    diplomacy: Object.fromEntries(Object.entries(state.diplomacy).map(([k, v]) => [k, v.slice(-12)])),
    advice: Object.fromEntries(Object.entries(state.advice ?? {}).map(([k, v]) => [k, (v ?? []).slice(-8)])),
  };
}

/** One stage of a turn (engine/stages.ts): the story first, then the world and home with the story that came back. */
export function playTurnStage<S extends TurnStage>(
  state: GameState,
  orders: string[],
  stage: S,
  options: { locale: Locale; model?: string; signal?: AbortSignal; onProgress: (chars: number) => void; story?: StoryCarry },
) {
  return stream<{ stage: S; part: StagePart<S> }>(
    "/api/game/turn",
    { state: trimForServer(state), orders, stage, ...(options.story ? { story: options.story } : {}), locale: options.locale, model: options.model || undefined },
    options.onProgress,
    options.signal,
  );
}

export function sendDiplomacy(
  state: GameState,
  target: string,
  message: string,
  options: { locale: Locale; model?: string; signal?: AbortSignal; onProgress: (chars: number) => void },
) {
  return stream<{ reply: DiplomacyReply }>(
    "/api/game/diplomacy",
    { state: trimForServer(state), target, message, locale: options.locale, model: options.model || undefined },
    options.onProgress,
    options.signal,
  );
}

export function askAdvisor(
  state: GameState,
  advisor: AdvisorId,
  question: string,
  options: { locale: Locale; model?: string; signal?: AbortSignal; onProgress: (chars: number) => void; context?: string; deputy?: string },
) {
  return stream<{ reply: AdviceReply }>(
    "/api/game/advisor",
    { state: trimForServer(state), advisor, question, context: options.context, deputy: options.deputy, locale: options.locale, model: options.model || undefined },
    options.onProgress,
    options.signal,
  );
}

/** A ministry's deputies as the game master names them; the engine deals the rest (startDeputies). */
export function setupDeputies(state: GameState, ministry: AdvisorId, options: { locale: Locale; model?: string; signal?: AbortSignal; onProgress: (chars: number) => void }) {
  return stream<{ deputies: DeputyDraft[] }>(
    "/api/game/deputies",
    { state: trimForServer(state), ministry, locale: options.locale, model: options.model || undefined },
    options.onProgress,
    options.signal,
  );
}

/** A short biography of the leader or a minister, up to the game's start date (engine/bios.ts). */
export function requestBio(state: GameState, name: string, options: { locale: Locale; model?: string; signal?: AbortSignal; onProgress?: (chars: number) => void }) {
  return stream<{ key: string; bio: string }>(
    "/api/game/bio",
    { state: trimForServer(state), name, locale: options.locale, model: options.model || undefined },
    options.onProgress ?? (() => {}),
    options.signal,
  );
}

/** A minister's report on a turn already played; null when the ministry had nothing to report on. */
export function requestReport(state: GameState, ministry: AdvisorId, turn: number, options: { locale: Locale; model?: string; signal?: AbortSignal; onProgress: (chars: number) => void }) {
  return stream<{ report: MinisterReport | null }>(
    "/api/game/report",
    { state: trimForServer(state), ministry, turn, locale: options.locale, model: options.model || undefined },
    options.onProgress,
    options.signal,
  );
}

export function setupPolitics(
  state: GameState,
  parts: ("politics" | "officials")[],
  options: { locale: Locale; model?: string; signal?: AbortSignal; onProgress: (chars: number) => void },
) {
  return stream<{ politics?: Politics; officials?: Official[] }>(
    "/api/game/politics",
    { state: trimForServer(state), parts, locale: options.locale, model: options.model || undefined },
    options.onProgress,
    options.signal,
  );
}

/** The player's army as the game master describes it now, checked by the engine (engine/army.ts). */
export function learnArmy(state: GameState, options: { locale: Locale; model?: string; signal?: AbortSignal; onProgress: (chars: number) => void }) {
  return stream<{ organisation: ArmyOrganisation }>("/api/game/army", { state: trimForServer(state), locale: options.locale, model: options.model || undefined }, options.onProgress, options.signal);
}

export function summitTalk(
  state: GameState,
  summit: string,
  line: string,
  options: { locale: Locale; model?: string; signal?: AbortSignal; onProgress: (chars: number) => void },
) {
  return stream<{ lines: SummitLine[] }>("/api/game/summit", { state: trimForServer(state), summit, line, locale: options.locale, model: options.model || undefined }, options.onProgress, options.signal);
}

export function summitClose(state: GameState, summit: string, options: { locale: Locale; model?: string; signal?: AbortSignal; onProgress: (chars: number) => void }) {
  return stream<{ outcome: string; agreements: string[] }>(
    "/api/game/summit",
    { state: trimForServer(state), summit, finish: true, locale: options.locale, model: options.model || undefined },
    options.onProgress,
    options.signal,
  );
}

/** At the opening of a sitting (no line) or after the government's speech: the house answers, and says how the speech moved the parties. */
export function sessionTalk(
  state: GameState,
  session: string,
  line: string | null,
  options: { locale: Locale; model?: string; signal?: AbortSignal; onProgress: (chars: number) => void },
) {
  return stream<SessionTalk>(
    "/api/game/parliament",
    { state: trimForServer(state), session, ...(line === null ? { open: true } : { line }), locale: options.locale, model: options.model || undefined },
    options.onProgress,
    options.signal,
  );
}

/** The other side's answer to the government's words at talks. */
export function talksSpeak(state: GameState, talk: string, line: string, options: { locale: Locale; model?: string; signal?: AbortSignal; onProgress: (chars: number) => void }) {
  return stream<{ speaker: string; said: string }>("/api/game/talks", { state: trimForServer(state), talk, line, locale: options.locale, model: options.model || undefined }, options.onProgress, options.signal);
}

/** What came of talks, as the model sees it; the engine decides (engine/talks.ts). */
export function talksFinish(state: GameState, talk: string, options: { locale: Locale; model?: string; signal?: AbortSignal; onProgress: (chars: number) => void }) {
  return stream<{ result: TalkResult; note: string }>("/api/game/talks", { state: trimForServer(state), talk, finish: true, locale: options.locale, model: options.model || undefined }, options.onProgress, options.signal);
}

export function findCandidates(
  state: GameState,
  post: OfficialPost,
  wishes: string,
  options: { locale: Locale; model?: string; signal?: AbortSignal; onProgress: (chars: number) => void },
) {
  return stream<{ candidates: Candidate[] }>(
    "/api/game/candidates",
    { state: trimForServer(state), post, wishes, locale: options.locale, model: options.model || undefined },
    options.onProgress,
    options.signal,
  );
}

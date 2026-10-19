"use client";

import type { ActDraft } from "@/engine/acts";
import type { AdviceReply, AdvisorId } from "@/engine/advisors";
import type { Candidate } from "@/engine/government";
import type { DiplomacyReply } from "@/engine/diplomacy";
import type { Outcome } from "@/engine/outcome";
import type { GameState, Locale, Official, OfficialPost, Politics, SummitLine } from "@/engine/types";

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

const post = (url: string, body: unknown, signal?: AbortSignal) =>
  fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal });

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

export function playTurn(
  state: GameState,
  orders: string[],
  options: { locale: Locale; model?: string; signal?: AbortSignal; onProgress: (chars: number) => void },
) {
  return stream<{ outcome: Outcome }>(
    "/api/game/turn",
    { state: trimForServer(state), orders, locale: options.locale, model: options.model || undefined },
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
  options: { locale: Locale; model?: string; signal?: AbortSignal; onProgress: (chars: number) => void; context?: string },
) {
  return stream<{ reply: AdviceReply }>(
    "/api/game/advisor",
    { state: trimForServer(state), advisor, question, context: options.context, locale: options.locale, model: options.model || undefined },
    options.onProgress,
    options.signal,
  );
}

export function askChiefOfActs(
  state: GameState,
  question: string,
  cities: { key: string; name: string }[],
  options: { locale: Locale; model?: string; signal?: AbortSignal; onProgress: (chars: number) => void },
) {
  return stream<{ reply: { answer: string; acts: ActDraft[] } }>(
    "/api/game/acts",
    { state: trimForServer(state), question, cities, locale: options.locale, model: options.model || undefined },
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

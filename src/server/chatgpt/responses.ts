import "server-only";
import { AiError, fromApiError } from "../errors";
import { API_BASE } from "./oauth";

export interface InputMessage {
  role: "user" | "assistant" | "developer";
  content: string;
}

export interface StreamRequest {
  model: string;
  instructions: string;
  input: InputMessage[];
  signal?: AbortSignal;
  onDelta?: (delta: string) => void;
  /** The model and the tokens one answer took, as `response.completed` reports them (counts only, for telemetry). */
  onUsage?: (usage: Usage) => void;
}

/** What one answer cost: the model, and its tokens when the server says. */
export interface Usage {
  model?: string;
  input?: number;
  output?: number;
}

const count = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : undefined);

/** Adds one answer's usage to a running total (a turn's stages, a repaired answer). */
export function addUsage(total: Usage, usage: Usage): Usage {
  const sum = (a?: number, b?: number) => (a === undefined && b === undefined ? undefined : (a ?? 0) + (b ?? 0));
  return { model: usage.model ?? total.model, input: sum(total.input, usage.input), output: sum(total.output, usage.output) };
}

/** The game's dashes are short (–): a long one (—) the model writes is shortened as it streams. */
const shortDashes = (text: string) => text.replaceAll("—", "–");

/** Hard ceiling on one answer, well above any turn the game asks for. */
const MAX_CHARS = 200_000;
const TIMEOUT_MS = 6 * 60_000;

/**
 * One Responses API call on the ChatGPT plan. The plan-usage route requires
 * `store: false` and `stream: true`, rejects sampling parameters such as
 * temperature, and counts an answer as complete only on `response.completed`.
 */
export async function streamText(token: string, request: StreamRequest): Promise<string> {
  const signal = AbortSignal.any([request.signal ?? new AbortController().signal, AbortSignal.timeout(TIMEOUT_MS)]);
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/responses`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        accept: "text/event-stream",
      },
      body: JSON.stringify({
        model: request.model,
        instructions: request.instructions,
        input: request.input.map((m) => ({ role: m.role, content: m.content })),
        store: false,
        stream: true,
      }),
      signal,
      // A redirect could carry the bearer token to another host.
      redirect: "error",
    });
  } catch (error) {
    if (request.signal?.aborted) throw new AiError("cancelled", "The request was cancelled.");
    if (signal.aborted) throw new AiError("timeout", "ChatGPT took too long to answer. Try again.", true);
    throw new AiError("network_error", `Could not reach ChatGPT (${(error as Error).name}).`, true);
  }

  if (!response.ok || !response.body) {
    const body = await response.json().catch(() => null);
    throw fromApiError(body, response.status);
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let text = "";
  let completed = false;
  try {
    while (!completed) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      // Server-sent events are separated by a blank line.
      let boundary: number;
      while ((boundary = buffer.search(/\r?\n\r?\n/)) >= 0) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary).replace(/^\r?\n\r?\n/, "");
        const data = block
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n");
        if (!data || data === "[DONE]") continue;
        let event: { type?: string; delta?: unknown; response?: { error?: unknown; usage?: { input_tokens?: unknown; output_tokens?: unknown } }; error?: unknown };
        try {
          event = JSON.parse(data);
        } catch {
          throw new AiError("invalid_stream", "ChatGPT sent a malformed event. Try again.", true);
        }
        if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
          const delta = shortDashes(event.delta);
          text += delta;
          if (text.length > MAX_CHARS) throw new AiError("response_too_large", "The answer was too long.");
          request.onDelta?.(delta);
        } else if (event.type === "response.failed") {
          throw fromApiError(event.response?.error ?? event.response, response.status);
        } else if (event.type === "error") {
          throw fromApiError(event.error ?? event, response.status);
        } else if (event.type === "response.incomplete") {
          throw new AiError("response_incomplete", "ChatGPT stopped before finishing. Try again.", true);
        } else if (event.type === "response.completed") {
          const usage = event.response?.usage;
          request.onUsage?.({ model: request.model, input: count(usage?.input_tokens), output: count(usage?.output_tokens) });
          completed = true;
          break;
        }
      }
    }
  } catch (error) {
    if (error instanceof AiError) throw error;
    if (request.signal?.aborted) throw new AiError("cancelled", "The request was cancelled.");
    if (signal.aborted) throw new AiError("timeout", "ChatGPT took too long to answer. Try again.", true);
    throw new AiError("stream_interrupted", "The connection to ChatGPT was interrupted. Try again.", true);
  } finally {
    reader.cancel().catch(() => undefined);
  }
  if (!completed) throw new AiError("stream_interrupted", "The answer ended before it was complete. Try again.", true);
  return text;
}

export interface ModelInfo {
  slug: string;
  displayName: string;
}

/** The models this ChatGPT account may use, in the server's order. */
export async function listModels(token: string): Promise<ModelInfo[]> {
  const response = await fetch(`${API_BASE}/models`, {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
    redirect: "error",
  });
  const body = (await response.json().catch(() => null)) as { models?: unknown } | null;
  if (!response.ok) throw fromApiError(body, response.status);
  if (!body || !Array.isArray(body.models)) throw new AiError("invalid_model_catalog", "ChatGPT returned an unexpected model list.", true);
  const models: ModelInfo[] = [];
  for (const m of body.models as Record<string, unknown>[]) {
    if (m?.visibility !== "list" || typeof m.slug !== "string" || !m.slug) continue;
    models.push({ slug: m.slug, displayName: typeof m.display_name === "string" && m.display_name ? m.display_name : m.slug });
  }
  return models;
}

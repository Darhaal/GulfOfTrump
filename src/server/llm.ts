import "server-only";
import type { z } from "zod";
import { extractJson, withoutNulls } from "@/engine/json";
import { accessToken } from "./chatgpt/oauth";
import { listModels, streamText, type InputMessage, type ModelInfo } from "./chatgpt/responses";
import { AiError } from "./errors";
import { isMockEnabled, mockComplete } from "./mock";

export interface CompletionRequest {
  /** A model slug from the account's list; the first listed one when absent. */
  model?: string;
  instructions: string;
  input: InputMessage[];
  signal?: AbortSignal;
  onDelta?: (delta: string) => void;
}

const MODEL_CACHE_MS = 10 * 60_000;
const modelCache = ((globalThis as { __gotModels?: { at: number; models: ModelInfo[] } }).__gotModels ??= { at: 0, models: [] });

export async function availableModels(): Promise<ModelInfo[]> {
  if (isMockEnabled()) return [{ slug: "mock", displayName: "Offline mock" }];
  if (modelCache.models.length && Date.now() - modelCache.at < MODEL_CACHE_MS) return modelCache.models;
  const models = await listModels(await accessToken());
  modelCache.models = models;
  modelCache.at = Date.now();
  return models;
}

export async function complete(request: CompletionRequest): Promise<string> {
  if (isMockEnabled()) return mockComplete(request.instructions, request.input, request.onDelta);
  const token = await accessToken();
  let model = request.model;
  if (!model) {
    const [first] = await availableModels();
    if (!first) throw new AiError("no_models", "This ChatGPT account has no models available to apps.");
    model = first.slug;
  }
  return streamText(token, { ...request, model });
}

/**
 * A completion parsed as JSON and checked against a schema. A first answer
 * that does not parse gets one repair round with the error spelled out —
 * cheaper than failing the whole turn over a stray comma.
 */
export async function completeJson<T>(request: CompletionRequest, schema: z.ZodType<T>): Promise<T> {
  const first = await complete(request);
  const attempt = (text: string) => {
    try {
      const result = schema.safeParse(withoutNulls(extractJson(text)));
      return result.success ? { ok: true as const, data: result.data } : { ok: false as const, error: result.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
    } catch (error) {
      return { ok: false as const, error: (error as Error).message };
    }
  };
  const parsed = attempt(first);
  if (parsed.ok) return parsed.data;

  const repaired = await complete({
    ...request,
    input: [
      ...request.input,
      { role: "assistant", content: first.slice(0, 20_000) },
      {
        role: "developer",
        content: `Your previous answer could not be used: ${parsed.error}. Answer again with only the corrected JSON object, nothing else.`,
      },
    ],
  });
  const second = attempt(repaired);
  if (second.ok) return second.data;
  throw new AiError("invalid_answer", "The model's answer could not be read twice in a row. Try the turn again.", true);
}

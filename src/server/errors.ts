import "server-only";
import { resetFromError } from "./chatgpt/limits";

/** ChatGPT's answer when the plan's allowance for apps is used up. */
export const PLAN_LIMIT_CODE = "subscription_sharing_usage_limit_exceeded";

/**
 * An error safe to show the player: a stable code the UI translates, an
 * English message for logs, and whether trying again can help. Never carries
 * tokens or the text of a prompt. A usage-limit error also says when the plan
 * resets (`resetsAt`, ms since 1970), when ChatGPT told.
 */
export class AiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable = false,
    readonly status?: number,
    readonly resetsAt?: number,
  ) {
    super(message);
    this.name = "AiError";
  }
}

/**
 * Maps an OpenAI error body to an AiError without echoing anything else from
 * it. For the usage limit it reads when the plan resets, from the body or the
 * response's headers (chatgpt/limits.ts).
 */
export function fromApiError(body: unknown, status?: number, headers?: Headers | null, now = Date.now()): AiError {
  const error = (body && typeof body === "object" && "error" in body ? (body as { error: unknown }).error : body) as
    | { code?: unknown; type?: unknown; message?: unknown }
    | string
    | undefined;
  let code = typeof error === "string" ? error : typeof error?.code === "string" ? error.code : typeof error?.type === "string" ? error.type : "api_error";
  // The name Codex's backend gives the same limit.
  if (code === "usage_limit_reached") code = PLAN_LIMIT_CODE;
  if (code === PLAN_LIMIT_CODE) {
    const resetsAt = resetFromError(error, headers, now, body);
    const when = resetsAt === undefined ? "ChatGPT did not say when it resets" : `it resets at ${new Date(resetsAt).toISOString()}`;
    return new AiError(code, `Your ChatGPT plan's usage limit for apps is reached; ${when}. Check ChatGPT settings → Usage.`, false, status, resetsAt);
  }
  const known: Record<string, [string, boolean]> = {
    subscription_sharing_usage_unavailable: ["ChatGPT plan usage is not available for this account or app right now.", true],
    invalid_grant: ["Your ChatGPT connection has expired. Sign in again.", false],
    rate_limit_exceeded: ["Too many requests to ChatGPT. Wait a moment and try again.", true],
    model_not_found: ["That model is not available to this ChatGPT account. Pick another in Settings.", false],
  };
  const [message, retryable] = known[code] ?? [`ChatGPT returned an error (${code}).`, status === undefined || status >= 500];
  return new AiError(code, message, retryable, status);
}

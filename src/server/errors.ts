import "server-only";

/**
 * An error safe to show the player: a stable code the UI translates, an
 * English message for logs, and whether trying again can help. Never carries
 * tokens or the text of a prompt.
 */
export class AiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable = false,
    readonly status?: number,
  ) {
    super(message);
    this.name = "AiError";
  }
}

/** Maps an OpenAI error body to an AiError without echoing anything else from it. */
export function fromApiError(body: unknown, status?: number): AiError {
  const error = (body && typeof body === "object" && "error" in body ? (body as { error: unknown }).error : body) as
    | { code?: unknown; type?: unknown; message?: unknown }
    | string
    | undefined;
  const code = typeof error === "string" ? error : typeof error?.code === "string" ? error.code : typeof error?.type === "string" ? error.type : "api_error";
  const known: Record<string, [string, boolean]> = {
    subscription_sharing_usage_limit_exceeded: ["Your ChatGPT plan's usage limit for apps is reached. Check ChatGPT settings → Usage.", false],
    subscription_sharing_usage_unavailable: ["ChatGPT plan usage is not available for this account or app right now.", true],
    invalid_grant: ["Your ChatGPT connection has expired. Sign in again.", false],
    rate_limit_exceeded: ["Too many requests to ChatGPT. Wait a moment and try again.", true],
    model_not_found: ["That model is not available to this ChatGPT account. Pick another in Settings.", false],
  };
  const [message, retryable] = known[code] ?? [`ChatGPT returned an error (${code}).`, status === undefined || status >= 500];
  return new AiError(code, message, retryable, status);
}

/**
 * Reading what ChatGPT says of the plan's usage limits. Pure: no fetch, no
 * storage, so the tests run it directly and the error mapping can use it.
 *
 * OpenAI's Sign in with ChatGPT documentation names no usage headers, no
 * reset fields and no usage endpoint (developers.openai.com/siwc, "Errors and
 * recovery", checked 29 October 2026), and on 29 October the admission and
 * rejection answers of `POST /v1/responses` and `GET /v1/models` carried
 * none. A successful answer was not checked, since that spends the plan. So
 * the game reads what OpenAI's own Codex CLI reads from the same family of
 * ChatGPT backends (openai/codex, codex-rs/codex-api/src/rate_limits.rs and
 * api_bridge.rs) and is ready for it, while showing "no numbers" when none
 * come:
 *
 * - headers `x-codex-{primary,secondary}-used-percent`, `-window-minutes`,
 *   `-reset-at` (Unix seconds; older builds sent `-reset-after-seconds`),
 *   for the family `x-codex-active-limit` names (`codex` by default);
 * - a `codex.rate_limits` stream event with `rate_limits.{primary,secondary}`
 *   of `used_percent`, `window_minutes`, `reset_at`;
 * - on a usage-limit error, `resets_at` (Unix seconds) or
 *   `resets_in_seconds` in the error body, else `Retry-After`.
 *
 * Only numbers are kept: no token, no account id, no request id.
 */

/** One limit window: on ChatGPT plans the short one is 5 hours, the long one a week. */
export interface UsageWindow {
  kind: "primary" | "secondary";
  /** The share of the window used, 0–100. */
  usedPercent: number;
  /** The window's length, when ChatGPT says. */
  windowMinutes?: number;
  /** When the window starts over (ms since 1970), when ChatGPT says. */
  resetsAt?: number;
}

/** A usage-limit error, kept until the plan resets. */
export interface PlanLimit {
  /** When it came (ms). */
  at: number;
  /** When ChatGPT said the plan resets (ms), if it said. */
  resetsAt?: number;
}

/** What the game knows of the plan: the latest numbers, the last answer, a standing limit. */
export interface PlanUsage {
  /** The windows as last reported; empty when ChatGPT reports none. */
  windows: UsageWindow[];
  /** When the windows were last reported (ms). */
  seenAt?: number;
  /** When ChatGPT last finished an answer, numbers or not (ms). */
  answeredAt?: number;
  limit?: PlanLimit;
}

/** A reset further away than this is not a reset time but a misread. */
const MAX_AHEAD_MS = 31 * 24 * 3600_000;

const number = (value: unknown): number | undefined => {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string" || !value.trim()) return undefined;
  const n = Number(value.trim());
  return Number.isFinite(n) ? n : undefined;
};

/** A point in time from Unix seconds, milliseconds or an ISO date; undefined when it is not a sane future time. */
function moment(value: unknown, now: number): number | undefined {
  const n = number(value);
  const ms = n !== undefined ? (n > 1e12 ? n : n * 1000) : typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isFinite(ms) && ms > now - 60_000 && ms - now < MAX_AHEAD_MS ? Math.round(ms) : undefined;
}

/** A point in time from seconds to go. */
function after(value: unknown, now: number): number | undefined {
  const n = number(value);
  return n !== undefined && n >= 0 && n * 1000 < MAX_AHEAD_MS ? Math.round(now + n * 1000) : undefined;
}

export function windowOf(kind: UsageWindow["kind"], used: unknown, minutes: unknown, resetsAt: number | undefined): UsageWindow | undefined {
  const percent = number(used);
  if (percent === undefined) return undefined;
  const length = number(minutes);
  // Codex reads all zeros as "nothing reported".
  if (percent === 0 && !length && resetsAt === undefined) return undefined;
  return {
    kind,
    usedPercent: Math.min(100, Math.max(0, Math.round(percent * 10) / 10)),
    ...(length && length > 0 ? { windowMinutes: Math.round(length) } : {}),
    ...(resetsAt !== undefined ? { resetsAt } : {}),
  };
}

/** The windows a response's headers report, for the limit family the backend says is active. */
export function usageFromHeaders(headers: Headers, now = Date.now()): UsageWindow[] {
  const active = headers.get("x-codex-active-limit")?.trim().toLowerCase().replaceAll("_", "-");
  const families = [...new Set([active && /^[a-z0-9-]{1,60}$/.test(active) ? `x-${active}` : null, "x-codex"].filter((f): f is string => Boolean(f)))];
  for (const prefix of families) {
    const windows = (["primary", "secondary"] as const).flatMap((kind) => {
      const get = (name: string) => headers.get(`${prefix}-${kind}-${name}`);
      const w = windowOf(kind, get("used-percent"), get("window-minutes"), moment(get("reset-at"), now) ?? after(get("reset-after-seconds"), now));
      return w ? [w] : [];
    });
    if (windows.length) return windows;
  }
  return [];
}

/** The windows of a `codex.rate_limits` stream event, or null for any other event. */
export function usageFromEvent(event: unknown, now = Date.now()): UsageWindow[] | null {
  if (!event || typeof event !== "object" || (event as { type?: unknown }).type !== "codex.rate_limits") return null;
  const limits = (event as { rate_limits?: unknown }).rate_limits as Record<string, unknown> | undefined;
  if (!limits || typeof limits !== "object") return [];
  return (["primary", "secondary"] as const).flatMap((kind) => {
    const w = limits[kind] as Record<string, unknown> | null | undefined;
    if (!w || typeof w !== "object") return [];
    const parsed = windowOf(kind, w.used_percent, w.window_minutes, moment(w.reset_at ?? w.resets_at, now) ?? after(w.reset_after_seconds ?? w.resets_in_seconds, now));
    return parsed ? [parsed] : [];
  });
}

/**
 * When a usage limit resets: `resets_at`, then `resets_in_seconds` from the
 * error (or the body around it), then `Retry-After`, then a reported window
 * that is full. Undefined when nothing says.
 */
export function resetFromError(error: unknown, headers?: Headers | null, now = Date.now(), body?: unknown): number | undefined {
  for (const source of [error, body]) {
    if (!source || typeof source !== "object") continue;
    const s = source as Record<string, unknown>;
    const at = moment(s.resets_at, now) ?? after(s.resets_in_seconds, now);
    if (at !== undefined) return at;
  }
  if (!headers) return undefined;
  const retry = headers.get("retry-after");
  if (retry) {
    const at = /^\s*\d+(\.\d+)?\s*$/.test(retry) ? after(retry, now) : moment(retry, now);
    if (at !== undefined) return at;
  }
  const full = usageFromHeaders(headers, now).filter((w) => w.usedPercent >= 100 && w.resetsAt !== undefined);
  return full.length ? Math.max(...full.map((w) => w.resetsAt!)) : undefined;
}

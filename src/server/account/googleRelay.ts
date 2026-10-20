import "server-only";

/**
 * Google sign-in from the desktop app. The app's window cannot host Google's
 * sign-in page (Google refuses embedded browsers), so it opens in the
 * system browser, and that browser comes back to the game's own server with
 * Supabase's one-time code. This relay hands the code to the app's window,
 * which keeps the PKCE verifier and alone can turn the code into a session.
 *
 * A code is accepted only for a sign-in the window started (its nonce), is
 * handed out once and forgotten after ten minutes. Codes are never logged.
 */

type Entry = { at: number; code?: string; error?: string };

const TTL = 10 * 60_000;
const MAX = 8;
const NONCE = /^[A-Za-z0-9]{32}$/;
const CODE = /^[A-Za-z0-9-]{8,200}$/;
const ERROR = /^[a-z_]{1,64}$/;

/** Module state survives hot reloads in dev by living on globalThis. */
const pending = ((globalThis as { __gotGoogleRelay?: Map<string, Entry> }).__gotGoogleRelay ??= new Map<string, Entry>());

function sweep(now = Date.now()) {
  for (const [nonce, entry] of pending) if (now - entry.at > TTL) pending.delete(nonce);
}

export const isNonce = (nonce: string) => NONCE.test(nonce);

/** The window starts a sign-in. False for a malformed nonce. */
export function beginGoogle(nonce: string): boolean {
  if (!isNonce(nonce)) return false;
  sweep();
  while (pending.size >= MAX) pending.delete(pending.keys().next().value!);
  pending.set(nonce, { at: Date.now() });
  return true;
}

/**
 * The browser comes back with a code or an error. True when the result
 * belongs to a sign-in that is waiting and is now kept for the window.
 */
export function settleGoogle(nonce: string, result: { code?: string | null; error?: string | null }): boolean {
  sweep();
  const entry = pending.get(nonce);
  if (!entry || entry.code || entry.error) return false;
  if (result.code && CODE.test(result.code)) entry.code = result.code;
  else entry.error = result.error && ERROR.test(result.error) ? result.error : "no_code";
  return Boolean(entry.code);
}

/** The window asks how its sign-in went; a finished result is handed out once. */
export function takeGoogle(nonce: string): { status: "waiting" } | { status: "unknown" } | { status: "done"; code?: string; error?: string } {
  sweep();
  const entry = pending.get(nonce);
  if (!entry) return { status: "unknown" };
  if (!entry.code && !entry.error) return { status: "waiting" };
  pending.delete(nonce);
  return entry.code ? { status: "done", code: entry.code } : { status: "done", error: entry.error };
}

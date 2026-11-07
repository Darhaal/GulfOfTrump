import "server-only";
import { isDemo } from "@/constants/app";
import { AiError, fromApiError, PLAN_LIMIT_CODE } from "../errors";
import { windowOf, type PlanUsage, type UsageWindow } from "./limits";
import { clearUsageFile, homeDir, loadUsageFile, saveUsageFile } from "./store";

export type { PlanLimit, PlanUsage, UsageWindow } from "./limits";

/**
 * The latest word on the ChatGPT plan's usage (./limits.ts reads it from
 * each answer): kept in memory and in ~/.gulf-of-trump/plan-usage.json next
 * to the connection, so Settings can show it after a restart. Numbers only.
 */

/** A limit that came without a reset time is forgotten after a day, or at the next answer. */
const UNKNOWN_LIMIT_MS = 24 * 3600_000;

interface UsageGlobals {
  usage: PlanUsage;
  loaded?: Promise<void>;
  saving: Promise<void>;
  /** When the mock's pretend limit resets (GOT_MOCK_PLAN=limit). */
  mockReset?: number;
}
const globals = ((globalThis as { __gotUsage?: UsageGlobals }).__gotUsage ??= { usage: { windows: [] }, saving: Promise.resolve() });

/** The mock and the public demo never touch the player's real file. */
const offline = () => process.env.GOT_MOCK_AI === "1" || isDemo();

const isEmpty = (u: PlanUsage) => !u.windows.length && !u.seenAt && !u.answeredAt && !u.limit;

/** A stored snapshot read defensively: numbers only, anything else dropped. */
export function readUsage(value: unknown, now = Date.now()): PlanUsage {
  const v = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const time = (x: unknown) => (typeof x === "number" && Number.isFinite(x) && x > 0 ? x : undefined);
  const windows = Array.isArray(v.windows)
    ? v.windows.flatMap((w: Record<string, unknown>) =>
        w && (w.kind === "primary" || w.kind === "secondary") ? (windowOf(w.kind, w.usedPercent, w.windowMinutes, time(w.resetsAt)) ?? []) : [],
      )
    : [];
  const limit = v.limit as Record<string, unknown> | undefined;
  const at = time(limit?.at);
  const seenAt = time(v.seenAt);
  const answeredAt = time(v.answeredAt);
  const resetsAt = time(limit?.resetsAt);
  return standing(
    {
      windows,
      ...(seenAt ? { seenAt } : {}),
      ...(answeredAt ? { answeredAt } : {}),
      ...(at ? { limit: { at, ...(resetsAt ? { resetsAt } : {}) } } : {}),
    },
    now,
  );
}

/** The snapshot without a limit that has run out. */
function standing(usage: PlanUsage, now: number): PlanUsage {
  const limit = usage.limit;
  if (!limit) return usage;
  const over = limit.resetsAt !== undefined ? limit.resetsAt <= now : now - limit.at > UNKNOWN_LIMIT_MS;
  if (!over) return usage;
  const rest = { ...usage };
  delete rest.limit;
  return rest;
}

function ensureLoaded(): Promise<void> {
  if (offline()) return Promise.resolve();
  globals.loaded ??= loadUsageFile()
    .then((stored) => {
      // Something recorded while the file was being read is newer.
      if (stored && isEmpty(globals.usage)) globals.usage = readUsage(stored);
    })
    .catch(() => undefined);
  return globals.loaded;
}

function update(change: (usage: PlanUsage) => PlanUsage) {
  globals.usage = change(globals.usage);
  if (offline()) return;
  // Saved in turn, to the folder of the moment it was recorded.
  const snapshot = globals.usage;
  const home = homeDir();
  globals.saving = globals.saving.then(() => ensureLoaded()).then(() => saveUsageFile(snapshot, home)).catch(() => undefined);
}

/** The windows one answer reported; nothing when it reported none. */
export function recordWindows(windows: UsageWindow[], now = Date.now()) {
  if (!windows.length) return;
  update((u) => ({ ...u, windows, seenAt: now }));
}

/** ChatGPT finished an answer: the plan is not blocked any more. */
export function recordAnswer(now = Date.now()) {
  update((u) => {
    const next: PlanUsage = { ...u, answeredAt: now };
    delete next.limit;
    return next;
  });
}

/** A usage-limit error: kept, with its reset time, until the plan resets. */
export function recordLimit(resetsAt: number | undefined, now = Date.now()) {
  update((u) => ({ ...u, limit: { at: now, ...(resetsAt !== undefined ? { resetsAt } : {}) } }));
}

/** Records the error when it is the usage limit, and gives it back to be thrown. */
export function noteLimit(error: AiError): AiError {
  if (error.code === PLAN_LIMIT_CODE) recordLimit(error.resetsAt);
  return error;
}

/** The latest snapshot, for the usage route. */
export async function planUsage(now = Date.now()): Promise<PlanUsage> {
  await ensureLoaded();
  globals.usage = standing(globals.usage, now);
  return globals.usage;
}

/** Signing out or in as someone else: the numbers were that account's. */
export async function forgetUsage() {
  globals.usage = { windows: [] };
  if (offline()) return;
  globals.loaded = Promise.resolve();
  const home = homeDir();
  globals.saving = globals.saving.then(() => clearUsageFile(home)).catch(() => undefined);
  await globals.saving;
}

/**
 * GOT_MOCK_PLAN, for working on these screens with GOT_MOCK_AI=1 and no
 * plan: `usage` makes the mock report two windows with every answer, `limit`
 * makes it fail with the usage limit, resetting 2 h 14 min after the first
 * try. The offline game master the player chose (`demo`) is never limited.
 */
export function mockPlan(demo: boolean | undefined, now = Date.now()) {
  const mode = process.env.GOT_MOCK_PLAN;
  if (process.env.GOT_MOCK_AI !== "1" || isDemo() || demo || (mode !== "usage" && mode !== "limit")) return;
  const hour = 3600_000;
  globals.mockReset ??= now + 2 * hour + 14 * 60_000;
  if (mode === "usage" || now >= globals.mockReset) {
    recordWindows(
      [
        { kind: "primary", usedPercent: 37, windowMinutes: 300, resetsAt: now + 2 * hour + 14 * 60_000 },
        { kind: "secondary", usedPercent: 81, windowMinutes: 7 * 24 * 60, resetsAt: now + 76 * hour },
      ],
      now,
    );
    recordAnswer(now);
    return;
  }
  const resetsIn = Math.max(0, Math.round((globals.mockReset - now) / 1000));
  recordWindows(
    [
      { kind: "primary", usedPercent: 100, windowMinutes: 300, resetsAt: globals.mockReset },
      { kind: "secondary", usedPercent: 93, windowMinutes: 7 * 24 * 60, resetsAt: now + 76 * hour },
    ],
    now,
  );
  throw noteLimit(fromApiError({ error: { code: PLAN_LIMIT_CODE, resets_in_seconds: resetsIn } }, 429, null, now));
}

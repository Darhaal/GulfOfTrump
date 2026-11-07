"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { PlanLimit, PlanUsage } from "@/server/chatgpt/limits";
import { getPlanUsage } from "./api";

/** The error code ChatGPT gives when the plan's allowance for apps is used up. */
export const PLAN_LIMIT_CODE = "subscription_sharing_usage_limit_exceeded";

/**
 * The ChatGPT plan's usage as the game server last heard it (/api/ai/usage),
 * shared by every screen: Settings draws it, the game master steps aside for
 * the offline one while the limit stands, and a usage-limit error met on any
 * screen opens the limit's own dialog (components/PlanLimitDialog.tsx).
 */
interface PlanState {
  usage: PlanUsage | null;
  /** The game server could not be asked. */
  failed: boolean;
  /** A usage-limit error met on this page and not yet closed. */
  alert: PlanLimit | null;
}

const EMPTY: PlanState = { usage: null, failed: false, alert: null };
let state: PlanState = EMPTY;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
function set(next: Partial<PlanState>) {
  state = { ...state, ...next };
  for (const l of listeners) l();
}

let inflight: Promise<void> | null = null;
let fetchedAt = 0;

/** Asks the game server again; screens opening together share one request. */
export function refreshPlanUsage(force = false): Promise<void> {
  if (inflight) return inflight;
  if (!force && state.usage && Date.now() - fetchedAt < 5000) return Promise.resolve();
  inflight = getPlanUsage()
    .then(
      ({ usage }) => set({ usage, failed: false }),
      () => set({ failed: true }),
    )
    .finally(() => {
      inflight = null;
      fetchedAt = Date.now();
    });
  return inflight;
}

/** A request met the usage limit: the dialog opens, and the limit stands until the plan resets. */
export function notePlanLimit(resetsAt?: number) {
  const limit: PlanLimit = { at: Date.now(), ...(resetsAt ? { resetsAt } : {}) };
  set({ alert: limit, usage: { ...(state.usage ?? { windows: [] }), limit } });
  void refreshPlanUsage(true);
}

export const closePlanLimit = () => set({ alert: null });

/** The latest snapshot, asked for on first use and whenever the window regains focus. */
export function usePlanUsage(): PlanState {
  const snapshot = useSyncExternalStore(subscribe, () => state, () => EMPTY);
  useEffect(() => {
    void refreshPlanUsage();
    const onFocus = () => void refreshPlanUsage();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);
  return snapshot;
}

/** The time now, moving every `stepMs` (null: standing still). */
export function useNow(stepMs: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (stepMs === null) return;
    const timer = setInterval(() => setNow(Date.now()), stepMs);
    return () => clearInterval(timer);
  }, [stepMs]);
  return now;
}

/**
 * The usage limit while it stands, and whether the server has been asked yet
 * (`settled`): until then nobody can tell a limited plan from a free one.
 */
export function usePlanLimit(): { limit: PlanLimit | null; settled: boolean } {
  const { usage, failed } = usePlanUsage();
  const [now, setNow] = useState(() => Date.now());
  const resetsAt = usage?.limit?.resetsAt;
  useEffect(() => {
    if (resetsAt === undefined) return;
    // Looked at again just after the reset, so the game master comes back by itself.
    const timer = setTimeout(() => setNow(Date.now()), Math.min(Math.max(0, resetsAt - Date.now()) + 500, 2_000_000_000));
    return () => clearTimeout(timer);
  }, [resetsAt]);
  const limit = usage?.limit && (usage.limit.resetsAt === undefined || usage.limit.resetsAt > now) ? usage.limit : null;
  return { limit, settled: usage !== null || failed };
}

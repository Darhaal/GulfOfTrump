"use client";

import { useSyncExternalStore } from "react";
import { desktopWindow } from "./desktop";

/** What the desktop app's updater reports, one event at a time (desktop/main.cjs). */
export type UpdateEvent =
  | { type: "checking" }
  | { type: "available"; version: string }
  | { type: "progress"; percent: number; bytesPerSecond: number }
  | { type: "downloaded"; version: string }
  | { type: "none"; at: number }
  | { type: "error"; message: string };

export type UpdateStatus = "idle" | "checking" | "downloading" | "ready" | "none" | "error";

/** Where the updates stand. */
export interface UpdateState {
  status: UpdateStatus;
  /** The version being downloaded or ready to install. */
  version: string | null;
  percent: number;
  bytesPerSecond: number;
  error: string | null;
  /** When the last check found nothing new. */
  checkedAt: number | null;
  /** The version this one replaced, on its first start after an update; cleared once the page has said so. */
  updatedFrom: string | null;
}

/** What the page gets when it opens: the state, the version running, and whether the app updates itself at all. */
export interface UpdateSnapshot extends UpdateState {
  current: string;
  /** The Microsoft Store copy: the Store updates it. */
  store: boolean;
  /** False in a copy that cannot check (unpacked, the Store, no updater). */
  enabled: boolean;
}

export const NO_UPDATES: UpdateState = { status: "idle", version: null, percent: 0, bytesPerSecond: 0, error: null, checkedAt: null, updatedFrom: null };

/**
 * One step of the updater. A download that is ready stays ready through a
 * later check or error: the next start installs it all the same.
 */
export function reduceUpdate(state: UpdateState, event: UpdateEvent): UpdateState {
  switch (event.type) {
    case "checking":
      return { ...state, status: state.status === "ready" ? "ready" : "checking", error: null };
    case "available":
      return { ...state, status: "downloading", version: event.version, percent: 0 };
    case "progress":
      return { ...state, status: "downloading", percent: Math.max(0, Math.min(100, event.percent)), bytesPerSecond: event.bytesPerSecond };
    case "downloaded":
      return { ...state, status: "ready", version: event.version, percent: 100 };
    case "none":
      return { ...state, status: "none", checkedAt: event.at };
    case "error":
      return { ...state, status: state.status === "ready" ? "ready" : "error", error: event.message };
  }
}

/** The release notes of a version on GitHub. */
export const releaseUrl = (repo: string, version: string) => `${repo}/releases/tag/v${version}`;

// One store for every screen: the app sends events to the page, not to a component.
let snapshot: UpdateSnapshot | null = null;
const listeners = new Set<() => void>();
let unhook: (() => void) | undefined;

const emit = () => {
  for (const l of listeners) l();
};

function subscribe(listener: () => void) {
  const updates = desktopWindow()?.updates;
  if (!updates) return () => {};
  listeners.add(listener);
  if (!unhook) {
    unhook = updates.onEvent((event) => {
      if (!snapshot) return;
      snapshot = { ...snapshot, ...reduceUpdate(snapshot, event) };
      emit();
    });
    void updates.get().then((s) => {
      if (!s) return;
      snapshot = s;
      emit();
    });
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size) return;
    unhook?.();
    unhook = undefined;
  };
}

/** The desktop app's updates as they happen; null in a browser, or until the app has answered. */
export function useUpdates(): UpdateSnapshot | null {
  return useSyncExternalStore(subscribe, () => snapshot, () => null);
}

/** Ask the app to look for an update now. */
export async function checkForUpdates() {
  const s = await desktopWindow()?.updates?.check();
  if (s) {
    snapshot = { ...s };
    emit();
  }
}

export const restartToUpdate = () => desktopWindow()?.updates?.restart();

/** The page has told the player about the update they got. */
export function updateSeen() {
  if (snapshot) snapshot = { ...snapshot, updatedFrom: null };
  emit();
  void desktopWindow()?.updates?.seen();
}

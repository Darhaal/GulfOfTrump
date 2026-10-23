"use client";

import type { PendingTurn } from "@/engine/stages";

/**
 * The stages of a turn that landed before it was cancelled, cut off or the
 * page was closed (engine/stages.ts), kept per game in this browser so the
 * turn picks up where it stopped: the same story, and only the missing
 * stages asked for again. The save itself never holds half a turn. Nothing
 * here is needed for the game to work: a browser that refuses storage just
 * writes the turn afresh.
 */
const key = (id: string) => `got_turn_pending_${id}`;

export function readPendingTurn(id: string): PendingTurn | null {
  try {
    const raw = localStorage.getItem(key(id));
    const pending = raw ? (JSON.parse(raw) as PendingTurn) : null;
    return pending && typeof pending.key === "string" && pending.parts && typeof pending.parts === "object" ? pending : null;
  } catch {
    return null;
  }
}

export function writePendingTurn(id: string, pending: PendingTurn) {
  try {
    localStorage.setItem(key(id), JSON.stringify(pending));
  } catch {
    // Not kept: a cancelled turn starts afresh.
  }
}

export function clearPendingTurn(id: string) {
  try {
    localStorage.removeItem(key(id));
  } catch {
    // Nothing to clear.
  }
}

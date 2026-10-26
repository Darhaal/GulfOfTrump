"use client";

import { useEffect, useRef } from "react";
import { scenarioOf } from "@/engine/scenarios";
import type { GameState } from "@/engine/types";
import { ApiError, type TurnUsage } from "@/lib/api";
import { getTelemetry, track, trackFeature } from "./index";
import type { TelemetryFeature } from "./events";

export { trackError } from "./index";

/**
 * What the game screens report (docs/telemetry.md), kept out of the
 * components so they need a line each. Only fields from the whitelist
 * (events.ts) get through; the game is named by an anonymous key, never by
 * its save's id, and the country only by a tag from the scenario's own list.
 */

/** The game's date, start, country, mode and role – nothing the player typed. */
function gameFields(state: GameState) {
  // A country founded in the game may carry a name the player gave it; only the scenario's own tags are sent.
  const country = Object.prototype.hasOwnProperty.call(scenarioOf(state).countries, state.player) ? state.player : null;
  return { scenario: state.scenarioId, variant: state.variant ?? null, country, mode: state.mode ?? null, role: state.role?.kind ?? "leader" };
}

/** The game started last, so opening its screen right after is not counted as loading it. */
let justStarted: string | null = null;

async function withKey(state: GameState, fields: Record<string, unknown>) {
  const telemetry = getTelemetry();
  if (telemetry?.snapshot().consent !== "on") return null;
  return { ...fields, game_key: await telemetry.gameKey(state.id) };
}

/** A new game, as it is created. */
export function trackGameStart(state: GameState) {
  justStarted = state.id;
  void withKey(state, gameFields(state)).then((fields) => fields && track("game_start", fields));
}

/** The kinds of request the game screen waits on (its `busy`), as the features they are. */
const REQUESTS: Record<string, TelemetryFeature> = {
  diplomacy: "letter",
  advice: "advice",
  deputies: "deputies",
  deputy: "deputy",
  candidates: "candidates",
  politics: "politics",
  army: "army",
  summit: "summit",
  parliament: "parliament",
  talks: "talks",
};

/**
 * The game screen's events: the game opened, a left panel opened by the
 * player, a request to the game master begun (turns have their own event),
 * the timelapse and a turn as a picture.
 */
export function useGameTelemetry(state: GameState | null, seen: { panel: string | null; request: string | null; timelapse: boolean; picture: boolean }) {
  const id = state?.id ?? null;
  const loaded = useRef<string | null>(null);
  const latest = useRef(state);
  useEffect(() => {
    latest.current = state;
  });
  useEffect(() => {
    const current = latest.current;
    if (!id || !current || loaded.current === id) return;
    loaded.current = id;
    if (justStarted === id) {
      justStarted = null;
      return;
    }
    void withKey(current, { ...gameFields(current), turn: current.turn }).then((fields) => fields && track("game_load", fields));
  }, [id]);

  // The panel the game opens on is not the player's choice; the ones they open after are.
  useChange(seen.panel, (panel) => panel && trackFeature(`panel_${panel}` as TelemetryFeature));
  useChange(seen.request, (request) => request && REQUESTS[request] && trackFeature(REQUESTS[request]));
  useChange(seen.timelapse, (open) => open && trackFeature("timelapse"));
  useChange(seen.picture, (open) => open && trackFeature("picture"));
}

/** Runs when a value changes from what it was, never for the first one (nor for React's second run of a first effect). */
function useChange<T>(value: T, run: (value: T) => void) {
  const last = useRef(value);
  useEffect(() => {
    if (Object.is(last.current, value)) return;
    last.current = value;
    run(value);
  });
}

/**
 * One turn being played: how long it takes, the tokens of its stages as the
 * server counts them, the model, and how it ended. `end()` sends it once.
 */
export function turnTally(state: GameState, chosenModel: string) {
  const startedAt = Date.now();
  let model: string | undefined;
  let tokensIn: number | undefined;
  let tokensOut: number | undefined;
  let ended = false;
  return {
    add(usage: TurnUsage | undefined) {
      if (!usage) return;
      if (usage.model) model = usage.model;
      if (typeof usage.input === "number") tokensIn = (tokensIn ?? 0) + usage.input;
      if (typeof usage.output === "number") tokensOut = (tokensOut ?? 0) + usage.output;
    },
    end(error?: unknown) {
      if (ended) return;
      ended = true;
      const code = error === undefined ? null : error instanceof ApiError ? error.code : "client_error";
      void withKey(state, {
        scenario: state.scenarioId,
        turn: state.turn,
        turn_length: state.step,
        duration_ms: Date.now() - startedAt,
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        model: model ?? (chosenModel || "auto"),
        ok: code === null,
        error_code: code,
      }).then((fields) => fields && track("turn_end", fields));
    },
  };
}

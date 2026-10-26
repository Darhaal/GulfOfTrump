import { parseGameState } from "@/engine/schema";
import type { GameState, Locale, ScenarioId } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { openSave, SAVE_EXTENSION, SaveFileError } from "./saveFile";

/**
 * Played games the site ships: four whole games whose turns were written for
 * them and played through the engine's own path – the ministers of the day
 * with their views and answers, letters, each turn's story and verdicts – in
 * each of the three languages. `npm run played` writes them
 * (scripts/screens/make-saves.ts) into public/played/, sealed as "Export a
 * save" seals them, so they open as an imported save opens: through the
 * schema, then the save's migrations and refreshSave as the game loads, and
 * keep opening as the save format moves on (tests/played.test.ts).
 *
 * The demo's front page offers them as "Open a played game"; the app's, as
 * quieter examples. The Store's screenshots are taken from them too.
 */
export interface PlayedGame {
  /** The files' name without the language: public/played/<file>.<locale>.gotsave. */
  file: string;
  /** The game's id, which is also its seed: the same in every language, and kept by a copy as its seed. */
  id: string;
  scenarioId: ScenarioId;
  /** The country played. */
  player: string;
  /** The day the first turn began. */
  from: string;
  /** The day the game stands at, its last turn written. */
  to: string;
  /** The turn it opens at. */
  turn: number;
  /** One line on what happened (src/i18n/messages.ts). */
  line: MessageKey;
}

/** The played games, by date. */
export const PLAYED_GAMES: readonly PlayedGame[] = [
  { file: "1914-austria", id: "8c1914a7-2b6d-4e8f-a114-0628c0ffee14", scenarioId: "1914", player: "austria-hungary", from: "1914-06-28", to: "1914-08-28", turn: 3, line: "played.line.1914" },
  { file: "1939-poland", id: "6a1939d0-5e1f-4b0c-8f39-0901c0ffee39", scenarioId: "1939", player: "poland", from: "1939-09-01", to: "1939-09-15", turn: 3, line: "played.line.1939" },
  { file: "1964-usa", id: "9d1964b2-4c7a-4f5e-8b64-0802c0ffee64", scenarioId: "1964", player: "usa", from: "1964-08-02", to: "1964-09-02", turn: 2, line: "played.line.1964" },
  { file: "2022-ukraine", id: "7b2022e4-3a8c-4d1e-9b24-0224c0ffee22", scenarioId: "2022", player: "ukraine", from: "2022-02-24", to: "2022-11-24", turn: 6, line: "played.line.2022" },
];

/** Where a played game's file in one language is served. */
export const playedPath = (game: PlayedGame, locale: Locale) => `/played/${game.file}.${locale}${SAVE_EXTENSION}`;

/** The played game with this id, if it is one. */
export const playedById = (id: string): PlayedGame | null => PLAYED_GAMES.find((g) => g.id === id) ?? null;

/** The played game a save began as: the game itself, or a copy of it, which keeps its seed. */
export const playedGameOf = (state: Pick<GameState, "id" | "seed">): PlayedGame | null => playedById(state.seed ?? state.id);

/** A played game in one language, read from the site and checked against the schema as an imported save is. */
export async function openPlayed(game: PlayedGame, locale: Locale): Promise<GameState> {
  const response = await fetch(playedPath(game, locale));
  if (!response.ok) throw new SaveFileError("notSave");
  const state = parseGameState(await openSave(await response.text()));
  if (!state) throw new SaveFileError("notSave");
  return state;
}

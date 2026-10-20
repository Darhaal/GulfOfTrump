import { seedDomestic } from "./abroad";
import { recolor } from "./colors";
import { seedEconomies } from "./economy";
import { ensureWorldBodies, fillBlocKinds, fillTreaties } from "./foreign";
import { settleFronts } from "./outcome";
import { ensurePolitics } from "./politics";
import { migrateToProvinces } from "./provinces";
import { dropFalseDefeat } from "./unrest";
import type { GameState, MapRegion, Scenario } from "./types";

/**
 * Saves are upgraded by numbered steps. A save's `migration` is the number
 * of the last step it has been through (none when it is missing); the steps
 * it has not been through run once, in order, when the game opens. A step
 * that needs the map waits until the map has loaded, and the steps after it
 * wait with it, so the order always holds.
 *
 * A change to what a save holds adds a step at the end. A released step is
 * never edited, renumbered or removed: saves in the wild have been through
 * it as it was.
 */

export interface MigrationContext {
  scenario: Scenario;
  /** The scenario's map, once it has loaded. */
  map?: { regions: MapRegion[]; byId: Record<string, MapRegion> };
}

interface Migration {
  /** The save's `migration` once this step has run. */
  n: number;
  /** What the step does, for whoever reads the list. */
  what: string;
  /** It needs the map. */
  map?: boolean;
  run: (state: GameState, context: Required<MigrationContext>) => GameState;
}

/** Every step, oldest first. */
const MIGRATIONS: Migration[] = [
  { n: 1, what: "Politics at home for a save from before them.", run: (s) => ensurePolitics(s) },
  { n: 2, what: "The scenario's kinds for the blocs a save from before bloc kinds started with.", run: (s, { scenario }) => fillBlocKinds(s, scenario.alliances) },
  {
    n: 3,
    what: "A defeat whose note says nothing happened, from before an overthrow had to be said to happen, is dropped.",
    run: (s) => dropFalseDefeat(s),
  },
  { n: 4, what: "A front past half of a province hands the province to the side holding most of it.", run: (s) => settleFronts(s) },
  { n: 5, what: "Provinces instead of one region per country (schema 2).", map: true, run: (s, { scenario, map }) => migrateToProvinces(s, scenario, map.regions) },
  { n: 6, what: "An economy for every country, for a save from before the economy.", map: true, run: (s, { map }) => seedEconomies(s, map.byId) },
  { n: 7, what: "Politics in brief for every country but the player's, with elections already past moved to their next date.", run: (s, { scenario }) => seedDomestic(s, scenario) },
];

/** The number of the last step: what a new game starts at. */
export const SAVE_MIGRATION = MIGRATIONS[MIGRATIONS.length - 1].n;

/** The steps a save has not been through, run in order as far as they can go: up to the first that needs a map it does not have. */
export function migrateSave(state: GameState, context: MigrationContext): GameState {
  let next = state;
  for (const step of MIGRATIONS) {
    if ((next.migration ?? 0) >= step.n) continue;
    if (step.map && !context.map) break;
    next = { ...step.run(next, context as Required<MigrationContext>), migration: step.n };
  }
  return next;
}

/** Whether a save has been through every step. */
export function isMigrated(state: Pick<GameState, "migration">): boolean {
  return (state.migration ?? 0) >= SAVE_MIGRATION;
}

/**
 * What the game ships as data, picked up on every load rather than once: the
 * palette (a colour the player chose stays), the world bodies, and the terms
 * of treaties and the treaties added to a scenario since the save was made.
 */
export function refreshSave(state: GameState, scenario: Scenario): GameState {
  const seeds = scenario.alliances;
  return fillTreaties(ensureWorldBodies(recolor(state), seeds), seeds);
}

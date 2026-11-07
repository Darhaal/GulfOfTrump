import { classFloor, voicedMood } from "./classes";
import { countryCrises, unrestFloor } from "./crises";
import { type Accounts, nationalAccounts } from "./economy";
import { peopleByCountry, strainOf, strainUnrest } from "./mobilisation";
import { regimeNow } from "./role";
import type { GameState, Loyalty, MapRegion } from "./types";
import { PILLARS } from "./types";
import { weariFloor } from "./warMeans";

/**
 * The floors under the player's unrest, taken together. Four of the engine's
 * readings each say how restless the people are bound to be, whatever the
 * game master writes: the crises' hardship (read from the turn's start), the
 * war's weariness, the classes' anger and the mobilisation's strain. They do
 * not stack – unrest is held at the highest of them – and they are applied
 * in one step at the end of the turn's politics (engine/outcome.ts), after
 * every move of the game master and of the engine, so no minister's calm,
 * medal or parade undoes one of them while another stands. The game master
 * reads them in a line, with why.
 */

export interface Floors {
  crises: number;
  war: number;
  classes: number;
  strain: number;
}

/** The highest of the floors: what unrest is held at, at the least. */
export const floorOf = (f: Floors): number => Math.max(f.crises, f.war, f.classes, f.strain);

/** Unrest no lower than the floors, in place. */
export function holdUnrest(next: Pick<GameState, "politics">, f: Floors): void {
  const floor = floorOf(f);
  if (next.politics && next.politics.unrest < floor) next.politics = { ...next.politics, unrest: floor };
}

/** The crises' floor, from the state as it stands (the turn's start, when the turn applies). */
export function crisesFloor(state: GameState, map: Record<string, MapRegion>, accounts?: Accounts): number {
  return unrestFloor(countryCrises(state, state.player, { accounts: accounts ?? nationalAccounts(state, map).get(state.player), map }));
}

/** The floors as the state stands now, for the game master: those the coming turn will hold unrest to, as far as they read today. */
export function floorsNow(state: GameState, map: Record<string, MapRegion>, accounts?: Accounts): Floors {
  const people = peopleByCountry(state, map).get(state.player) ?? 0;
  const strain = strainOf(state, state.player, people)?.strain ?? 0;
  const classes = state.society?.[state.player]?.classes;
  return {
    crises: crisesFloor(state, map, accounts),
    war: weariFloor(state, map),
    classes: classes ? classFloor(voicedMood(classes)) : 0,
    strain: strainUnrest(strain, regimeNow(state)),
  };
}

/**
 * The floors in a line for the game master, with whose moves are the engine's
 * own: what the repressions, the cabinet and parliament move it has already
 * counted. Nothing when no floor stands.
 */
export function floorLine(state: GameState, map: Record<string, MapRegion>, accounts?: Accounts): string[] {
  if (!state.politics) return [];
  const f = floorsNow(state, map, accounts);
  const floor = floorOf(f);
  const parts = [f.crises ? `the crises' hardship ${f.crises}` : "", f.war ? `war-weariness ${f.war}` : "", f.classes ? `the classes' anger ${f.classes}` : "", f.strain ? `the mobilisation's strain ${f.strain}` : ""].filter(Boolean);
  return [
    ...(floor > 0 ? [`UNREST FLOOR ${floor} (the engine holds unrest no lower, whatever you write; the highest of: ${parts.join(", ")}) – an unrest below it is raised to it.`] : []),
    "THE ENGINE'S OWN MOVES: the unrest and the pillars' loyalty that repressions and crimes, the cabinet's leaks, purges and foiled plots, a postponed election and a lost vote of confidence bring are applied by the engine – give politics.unrest and politics.loyalty for the period's other events only, never again for these.",
  ];
}

/** The most a pillar's loyalty moves in a turn, the game master's moves and the engine's together. */
export const MAX_TURN_SWING = 20;

/** Each pillar held within MAX_TURN_SWING of where the turn began. In place. */
export function capSwing(before: Pick<GameState, "politics">, next: Pick<GameState, "politics">, was: Loyalty | undefined): void {
  if (!next.politics?.loyalty || !before.politics || !was) return;
  const now = next.politics.loyalty;
  const capped = Object.fromEntries(PILLARS.map((k) => [k, Math.max(was[k] - MAX_TURN_SWING, Math.min(was[k] + MAX_TURN_SWING, now[k]))])) as Loyalty;
  if (PILLARS.some((k) => capped[k] !== now[k])) next.politics = { ...next.politics, loyalty: capped };
}

import { enemiesOf, isMilitary } from "./relations";
import { NEUTRAL } from "./scenarios/intentions";
import type { GameState } from "./types";

/**
 * Neutral states (scenarios/intentions.ts NEUTRAL): Switzerland always,
 * Sweden, Ireland, Austria from 1955, Finland in the Cold War and the rest
 * as each date had them. A neutral is offered no bloc and plans none, is
 * called into no war by treaty or opportunity and joins none as a vulture,
 * and plans a war only on an attacker on its soil; it still sanctions and
 * votes at the world body (Switzerland joined the sanctions of 2022).
 * Neutrality ends when the state is drawn into a war or joins a military
 * alliance – by history's plan, or under a grave alarm of its own
 * (engine/intentions.ts). The player's government keeps its own alignment.
 */

/** Whether a government is neutral now. */
export function isNeutral(state: Pick<GameState, "scenarioId" | "date" | "player" | "alliances" | "wars">, tag: string): boolean {
  if (tag === state.player) return false;
  const seed = NEUTRAL[state.scenarioId]?.find((s) => s.tag === tag);
  if (!seed || (seed.from && state.date < seed.from) || (seed.until && state.date >= seed.until)) return false;
  // A neutral at war is a belligerent; one in a military alliance has given its neutrality up.
  if (enemiesOf(state, tag).size > 0) return false;
  return !state.alliances.some((a) => isMilitary(a) && a.members.includes(tag));
}

/** Whether a country holds any of a neutral's land: the only enemy a neutral plans a war on. */
export function onItsSoil(state: Pick<GameState, "regions">, neutral: string, enemy: string): boolean {
  return Object.values(state.regions).some((r) => r.owner === neutral && (r.controller === enemy || r.contested === enemy));
}

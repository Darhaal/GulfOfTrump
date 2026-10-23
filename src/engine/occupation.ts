import type { GameState, RegionState, War } from "./types";

/**
 * Land a war has left behind. A province its owner's enemy took is fought
 * over while the front runs through it or beside it. Once the front has moved
 * on – the province is no longer contested, and no province around it is held
 * or contested by the owner's side of that war – it is the captor's until a
 * peace decides: its people, the most of its output and taxes, and some of its
 * call-up count for the captor, while its owner stays recorded for the peace
 * talks and for the game master. A peace returns it or, by annexation, gives
 * it for good (engine/outcome.ts). Land held without a war between holder and
 * owner – a scenario's standing occupation – stays its owner's, as before.
 *
 * The status is kept on the province (RegionState.behind) at the end of every
 * turn, where the map's neighbours are at hand, so the economy and the people
 * can read it without them.
 */

/** The share of a province's output its captor takes once the front has left it behind (own land yields all of it; a front, less). */
export const BEHIND_TAKES = 0.6;

/** The share of a captured province's people the captor can call up: volunteers and the conscripted few, not a nation. */
export const BEHIND_CALL_UP = 0.25;

/** The sides of a war in which `captor` and `owner` fight each other: the captor's side and the owner's. */
function sidesOf(wars: readonly Pick<War, "attackers" | "defenders">[], captor: string, owner: string): [Set<string>, Set<string>] | null {
  for (const w of wars) {
    if (w.attackers.includes(captor) && w.defenders.includes(owner)) return [new Set(w.attackers), new Set(w.defenders)];
    if (w.defenders.includes(captor) && w.attackers.includes(owner)) return [new Set(w.defenders), new Set(w.attackers)];
  }
  return null;
}

/**
 * Whether the front has left a province behind: held by an enemy of its owner
 * in a war between them, not contested, and with no neighbour held or
 * contested by the owner's side of that war.
 */
export function behindFront(state: Pick<GameState, "regions" | "wars">, neighbors: Record<string, string[]>, id: string): boolean {
  const r = state.regions[id];
  if (!r || r.controller === r.owner || r.contested) return false;
  const sides = sidesOf(state.wars, r.controller, r.owner);
  if (!sides) return false;
  const enemy = sides[1];
  return !(neighbors[id] ?? []).some((n) => {
    const x = state.regions[n];
    return x !== undefined && (enemy.has(x.controller) || (x.contested !== undefined && enemy.has(x.contested)));
  });
}

/**
 * Marks the provinces the front has left behind this turn and clears the mark
 * where the front came back, the war ended or the owner retook the land.
 * Returns the provinces newly left behind, for the turn's report.
 */
export function markBehind(regions: Record<string, RegionState>, wars: readonly War[], neighbors: Record<string, string[]>): string[] {
  const state = { regions, wars: wars as War[] };
  const now = new Set(Object.keys(regions).filter((id) => behindFront(state, neighbors, id)));
  const fresh: string[] = [];
  for (const [id, r] of Object.entries(regions)) {
    if (now.has(id)) {
      if (!r.behind) fresh.push(id);
      r.behind = true;
    } else if (r.behind) delete r.behind;
  }
  return fresh;
}

/** The country a province counts for now: its owner, or the captor holding it behind the front until peace. */
export const countsFor = (r: Pick<RegionState, "owner" | "controller" | "behind" | "contested">): string =>
  r.behind && r.controller !== r.owner && !r.contested ? r.controller : r.owner;

/** Whether a province counts for its captor rather than its owner. */
export const heldBehind = (r: Pick<RegionState, "owner" | "controller" | "behind" | "contested">): boolean => countsFor(r) !== r.owner;

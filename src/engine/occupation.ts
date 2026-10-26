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
 * A front with no war behind it ends: a side still fighting in a province
 * whose holder it is not at war with withdraws. A peace hands a province back
 * to its owner while a third country, at war with the old holder only, still
 * fights in it (the 1939 statistics runs: the Soviet Union went on fighting
 * in Slovakia's Prešov once the German–Polish peace had returned it to
 * Slovakia). Returns the provinces left, with who withdrew.
 */
export function clearOrphanFronts(state: Pick<GameState, "regions" | "wars">): { id: string; by: string; holder: string }[] {
  const out: { id: string; by: string; holder: string }[] = [];
  for (const [id, r] of Object.entries(state.regions)) {
    if (!r.contested) continue;
    const by = r.contested;
    if (state.wars.some((w) => (w.attackers.includes(by) && w.defenders.includes(r.controller)) || (w.defenders.includes(by) && w.attackers.includes(r.controller)))) continue;
    out.push({ id, by, holder: r.controller });
    delete r.contested;
    delete r.held;
    delete r.taken;
  }
  return out;
}

/**
 * An ally's land taken back from the enemy goes back to its ally: a province
 * held by a country fighting on the same side as its owner, in a war the
 * owner wages too, returns to the owner – a liberation. Without it, a
 * country that drove the enemy out of a co-belligerent's province kept it,
 * and held another government's land with no war between them (the 1939
 * statistics runs: the Soviet Union and Germany in Slovakia's Prešov, taken
 * back from Poland). A government in exile or a movement without land takes
 * nothing back, nor an owner that is not at war with the side still fighting
 * in the province. Returns the provinces handed back, with who held them.
 */
export function returnToAllies(state: Pick<GameState, "regions" | "wars" | "countries">): { id: string; from: string }[] {
  const at = (a: string, b: string) => state.wars.some((w) => (w.attackers.includes(a) && w.defenders.includes(b)) || (w.attackers.includes(b) && w.defenders.includes(a)));
  const enemies = (a: string) => new Set(state.wars.flatMap((w) => (w.attackers.includes(a) ? w.defenders : w.defenders.includes(a) ? w.attackers : [])));
  // Co-belligerents: on one side of a war, or at war with the same enemy in wars of their own (France and the Netherlands,
  // each against Germany: France took Dutch Limburg back from Germany and kept it past both peaces).
  const together = (a: string, b: string) => {
    if (state.wars.some((w) => (w.attackers.includes(a) && w.attackers.includes(b)) || (w.defenders.includes(a) && w.defenders.includes(b)))) return true;
    const theirs = enemies(b);
    return [...enemies(a)].some((x) => theirs.has(x));
  };
  const out: { id: string; from: string }[] = [];
  for (const [id, r] of Object.entries(state.regions)) {
    if (r.controller === r.owner) continue;
    const owner = state.countries[r.owner];
    if (!owner || owner.exile || owner.dormant || at(r.controller, r.owner) || !together(r.controller, r.owner)) continue;
    if (r.contested && !at(r.contested, r.owner)) continue;
    out.push({ id, from: r.controller });
    r.controller = r.owner;
    delete r.behind;
  }
  return out;
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

import { fogOn, knowledgeOf, POLITICS_SEEN } from "./fog";
import type { Alliance, GameState, War } from "./types";

/**
 * Who stands with a country and who against it, for the map's diplomatic
 * view (as Hearts of Iron draws it): its allies – a military alliance or a
 * war fought on the same side – its partners in a small bloc or a trade
 * agreement, those bound to it by a pact, those under a truce with it, and
 * its enemies at war. A war outweighs a treaty: a pact partner that attacks
 * is an enemy. A world body binds too many to say anything of one member.
 */
export const SIDES = ["self", "enemy", "truce", "ally", "pact", "partner"] as const;
export type Side = (typeof SIDES)[number];

/** Which wins when two relations meet: the first in SIDES. */
const RANK: Record<Side, number> = Object.fromEntries(SIDES.map((s, i) => [s, SIDES.length - i])) as Record<Side, number>;

/** A bloc of this many members or fewer is a circle of partners; a larger one is a world body and colours nobody. */
export const PARTNER_BLOC = 30;

type World = { wars: Pick<War, "attackers" | "defenders" | "truce">[]; alliances: Pick<Alliance, "members" | "kind">[] };

/** What the fog needs: the player's government and what it knows of others (engine/fog.ts). */
type Viewer = Parameters<typeof knowledgeOf>[0] & Pick<GameState, "fog">;

/**
 * Every country's side towards `tag`, `tag` itself as "self"; a country with
 * no tie is left out. Under the fog of war a pact between two foreign
 * governments shows only if the player's government knows enough of one of
 * them (POLITICS_SEEN); wars and alliances are public.
 */
export function sidesOf(world: World, tag: string, viewer?: { state: Viewer; borders?: Set<string> }): Record<string, Side> {
  const out: Record<string, Side> = { [tag]: "self" };
  const mark = (other: string, side: Side) => {
    if (other === tag) return;
    const was = out[other];
    if (!was || RANK[side] > RANK[was]) out[other] = side;
  };

  for (const w of world.wars) {
    const side = w.attackers.includes(tag) ? w.attackers : w.defenders.includes(tag) ? w.defenders : null;
    if (!side) continue;
    const enemies = side === w.attackers ? w.defenders : w.attackers;
    for (const e of enemies) mark(e, w.truce ? "truce" : "enemy");
    for (const a of side) mark(a, "ally");
  }

  const watcher = viewer && fogOn(viewer.state) && tag !== viewer.state.player ? viewer : null;
  const seesTag = watcher ? knowledgeOf(watcher.state, tag, watcher.borders).score >= POLITICS_SEEN : true;
  const known = (other: string) =>
    !watcher || seesTag || other === watcher.state.player || knowledgeOf(watcher.state, other, watcher.borders).score >= POLITICS_SEEN;

  for (const a of world.alliances) {
    if (!a.members.includes(tag)) continue;
    const kind = a.kind ?? "alliance";
    if ((kind === "organization" || kind === "trade") && a.members.length > PARTNER_BLOC) continue;
    for (const m of a.members) {
      if (kind === "alliance") mark(m, "ally");
      else if (kind === "pact") {
        if (known(m)) mark(m, "pact");
      } else mark(m, "partner");
    }
  }
  return out;
}

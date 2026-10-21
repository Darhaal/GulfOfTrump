import { combatPower } from "./arsenal";
import { roll } from "./dice";
import { STEP_YEARS } from "./economy";
import { railLevel } from "./provinces";
import type { GameState, MapIndex, MapRegion, Terrain, War } from "./types";

/**
 * Fronts the game master leaves alone still move. In a war being fought (no
 * truce), the balance of strength where the front runs sets how it goes this
 * period: the stronger side gains ground in the provinces the front runs
 * through and breaks into new ones next to its own, the weaker yields; in an
 * even fight the defender has the edge, and mountains, forests, marshes,
 * rivers and the lack of railways slow an attacker.
 *
 * Strength is soldiers and heavy weapons (engine/arsenal.ts combatPower),
 * spread along every front a country fights on, so a long front is a thin
 * one; at a province, each side counts the members that hold it, fight in it
 * or hold land next to it, and a quarter of what its members far from any
 * front can send.
 *
 * A war whose front has no fight in it at all sees the side that started it
 * probe the enemy's line now and then, unless it is hopelessly weaker.
 *
 * The engine moves only provinces the turn's answer did not name: where the
 * answer moved a war's front, the rest of it only drifts, and the game
 * master's offensives are its own. The dice are seeded by the game, the turn
 * and the province, so the server and the browser agree.
 */

/** What an attacker needs to gain ground: the defender's edge, in doublings of strength (about 1.3 : 1). */
const DEFENCE = 0.35;
/** The largest edge counted, in doublings (about 6 : 1). */
const MAX_EDGE = 2.5;
/** Points of a province a month at one doubling of strength beyond the defender's edge; the pace grows faster than the edge (CURVE). */
const RATE = 10;
const CURVE = 1.3;
/** The dice's spread on a contested province's share, points a month (at the square root of the months). */
const SPREAD = 3;
/** Most new provinces one side of a war breaks into in a turn. */
const MAX_BREAKS = 3;
/** A contest's share beyond which the province falls, and below which its attacker is driven out (as in engine/outcome.ts). */
const FALLS = 95;
const DRIVEN_OUT = 5;
/** What a side's members far from every front add along it. */
const FAR = 0.25;

/** How hard each terrain is to attack across: plains are open, mountains hold. */
const TERRAIN: Record<Terrain, number> = { plains: 1, desert: 0.9, hills: 0.75, forest: 0.7, tundra: 0.6, wetlands: 0.55, jungle: 0.5, mountains: 0.45 };

/** How much a province slows an attacker: terrain, a major river, and no railway to bring supplies up. */
export function going(p: MapRegion | undefined): number {
  if (!p) return 0.8;
  let k = TERRAIN[p.terrain] ?? 0.8;
  if (p.rv?.length) k *= 0.85;
  if (railLevel(p) === "none") k *= 0.85;
  return k;
}

/** A front move the engine makes: a province's new share for the side in "to", its fall, or its attacker driven out ("occupy" by the holder). */
export interface FrontMove {
  region: string;
  to: string;
  mode: "contest" | "occupy";
  share?: number;
}

/** Wars being fought now. */
const fought = (state: Pick<GameState, "wars">) => state.wars.filter((w) => !w.truce);

/** The provinces of a war's front: those each side holds next to the other's, and those the front runs through. */
export function warFront(state: Pick<GameState, "regions">, index: Pick<MapIndex, "neighbors">, war: Pick<War, "attackers" | "defenders">): string[] {
  const a = new Set(war.attackers);
  const d = new Set(war.defenders);
  const out: string[] = [];
  for (const [id, r] of Object.entries(state.regions)) {
    const enemy = a.has(r.controller) ? d : d.has(r.controller) ? a : null;
    if (!enemy) continue;
    if ((r.contested && enemy.has(r.contested)) || (index.neighbors[id] ?? []).some((n) => state.regions[n] && enemy.has(state.regions[n].controller))) out.push(id);
  }
  return out;
}

/**
 * The strength of the fighting at each front: every country's power spread
 * over the front provinces it holds or fights in, across all its wars.
 */
export function frontStrength(state: Pick<GameState, "countries" | "regions" | "wars" | "date">, index: Pick<MapIndex, "neighbors">) {
  const fronts = new Map<string, string[]>(fought(state).map((w) => [w.id, warFront(state, index, w)]));
  const posts = new Map<string, Set<string>>();
  const post = (tag: string, id: string) => {
    const set = posts.get(tag) ?? new Set<string>();
    set.add(id);
    posts.set(tag, set);
  };
  for (const ids of fronts.values()) {
    for (const id of ids) {
      const r = state.regions[id];
      post(r.controller, id);
      if (r.contested) post(r.contested, id);
    }
  }
  const power = new Map<string, number>();
  const powerOf = (tag: string) => {
    let p = power.get(tag);
    if (p === undefined) power.set(tag, (p = combatPower(state, tag)));
    return p;
  };
  /** A country's strength at one of its front provinces. */
  const density = (tag: string) => powerOf(tag) / Math.max(1, posts.get(tag)?.size ?? 0);
  /** Whether a country fights at a province: it holds it, fights in it, or holds land next to it. */
  const present = (tag: string, id: string) => {
    const r = state.regions[id];
    return r.controller === tag || r.contested === tag || (index.neighbors[id] ?? []).some((n) => state.regions[n]?.controller === tag);
  };
  /** A side's strength at a province of a war's front. */
  const at = (war: Pick<War, "id">, side: string[], id: string) => {
    const front = fronts.get(war.id) ?? [];
    const holding = front.filter((f) => side.includes(state.regions[f].controller)).length;
    const far = side.filter((tag) => !posts.has(tag)).reduce((sum, tag) => sum + powerOf(tag), 0);
    const near = side.filter((tag) => present(tag, id)).reduce((sum, tag) => sum + density(tag), 0);
    return near + (far * FAR) / Math.max(1, holding);
  };
  /** The edge of `side` over `other` at a province, in doublings within ±MAX_EDGE. */
  const edge = (war: Pick<War, "id">, side: string[], other: string[], id: string) =>
    Math.max(-MAX_EDGE, Math.min(MAX_EDGE, Math.log2((at(war, side, id) + 1) / (at(war, other, id) + 1))));
  return { fronts, edge, powerOf };
}

/** Each side's whole strength in a war, for the game master: the members' power, split between the wars each fights. */
export function warStrength(state: Pick<GameState, "countries" | "wars" | "date">, war: Pick<War, "attackers" | "defenders">): { attackers: number; defenders: number } {
  const wars = fought(state);
  const side = (tags: string[]) => tags.reduce((sum, tag) => sum + combatPower(state, tag) / Math.max(1, wars.filter((w) => w.attackers.includes(tag) || w.defenders.includes(tag)).length), 0);
  return { attackers: side(war.attackers), defenders: side(war.defenders) };
}

/**
 * The engine's front moves for this turn, for the wars being fought before
 * it: none in a war the answer ends or pauses, none in provinces the answer named.
 */
export function frontMoves(state: GameState, index: MapIndex, named: ReadonlySet<string>, ending: ReadonlySet<string> = new Set()): FrontMove[] {
  const months = (STEP_YEARS[state.step] ?? 1 / 12) * 12;
  const game = state.seed ?? state.id;
  const dice = (key: string) => roll(game, state.turn, `front:${key}`);
  const { fronts, edge } = frontStrength(state, index);
  const moves: FrontMove[] = [];
  const done = new Set<string>(named);

  for (const war of fought(state)) {
    if (ending.has(war.id)) continue;
    const front = fronts.get(war.id) ?? [];
    if (!front.length) continue;
    const a = new Set(war.attackers);
    const d = new Set(war.defenders);
    const sideOf = (tag: string) => (a.has(tag) ? war.attackers : d.has(tag) ? war.defenders : null);
    // Where the answer moved this war's front, the game master leads it: the rest only drifts, and it opens no new fights.
    const led = front.some((id) => named.has(id));
    const scale = led ? 0.5 : 1;

    // The provinces the front runs through: the side holding part gains or yields by the balance there.
    for (const id of front) {
      if (done.has(id)) continue;
      const r = state.regions[id];
      const attacking = r.contested ? sideOf(r.contested) : null;
      const holding = sideOf(r.controller);
      if (!attacking || !holding || attacking === holding) continue;
      done.add(id);
      const e = edge(war, attacking, holding, id);
      const push = Math.sign(e - DEFENCE) * Math.abs(e - DEFENCE) ** CURVE * RATE * months;
      const gain = (push > 0 ? push * going(index.regions[id]) : push) * scale;
      const noise = (dice(id) - 0.5) * 2 * SPREAD * Math.sqrt(months) * scale;
      let delta = gain + noise;
      // A front in a war being fought never stands entirely still.
      if (Math.abs(delta) < 1) delta = delta < 0 || (delta === 0 && push < 0) ? -1 : 1;
      const share = Math.round((r.held ?? 30) + delta);
      if (share > FALLS) moves.push({ region: id, to: r.contested!, mode: "occupy" });
      else if (share < DRIVEN_OUT) moves.push({ region: id, to: r.controller, mode: "occupy" });
      else moves.push({ region: id, to: r.contested!, mode: "contest", share });
    }
    if (led) continue;

    // Breakthroughs: where a side is stronger, it opens fights in the enemy's provinces next to its own, its strongest sectors first.
    for (const [side, other] of [
      [war.attackers, war.defenders],
      [war.defenders, war.attackers],
    ]) {
      const mine = new Set(side);
      const sectors = front
        .filter((id) => !done.has(id) && !state.regions[id].contested && other.includes(state.regions[id].controller))
        .filter((id) => (index.neighbors[id] ?? []).some((n) => state.regions[n] && mine.has(state.regions[n].controller)))
        .map((id) => ({ id, surplus: edge(war, side, other, id) - DEFENCE - 0.15 }))
        .filter((s) => s.surplus > 0)
        .sort((x, y) => y.surplus - x.surplus);
      let broken = 0;
      for (const s of sectors) {
        if (broken >= MAX_BREAKS) break;
        const chance = Math.min(0.9, s.surplus * 0.5 * months * going(index.regions[s.id]));
        if (dice(`${war.id}:${s.id}:break`) >= chance) continue;
        broken += 1;
        done.add(s.id);
        const opening = (10 + 6 * s.surplus * Math.min(months, 6)) * going(index.regions[s.id]);
        const share = Math.round(Math.max(DRIVEN_OUT + 1, Math.min(60, opening)));
        // The member next to the province carries the attack.
        const by = side.find((tag) => (index.neighbors[s.id] ?? []).some((n) => state.regions[n]?.controller === tag)) ?? side[0];
        moves.push({ region: s.id, to: by, mode: "contest", share });
      }
    }

    // A war with no fighting anywhere along its front: the side that started it probes its best sector now and then.
    if (!front.some((id) => state.regions[id].contested) && !moves.some((m) => front.includes(m.region))) {
      const probe = front
        .filter((id) => !done.has(id) && d.has(state.regions[id].controller) && (index.neighbors[id] ?? []).some((n) => a.has(state.regions[n]?.controller ?? "")))
        .map((id) => ({ id, e: edge(war, war.attackers, war.defenders, id) }))
        .sort((x, y) => y.e - x.e)[0];
      if (probe && probe.e > -1 && dice(`${war.id}:probe`) < Math.min(0.9, 0.4 * months)) {
        done.add(probe.id);
        const by = war.attackers.find((tag) => (index.neighbors[probe.id] ?? []).some((n) => state.regions[n]?.controller === tag)) ?? war.attackers[0];
        moves.push({ region: probe.id, to: by, mode: "contest", share: Math.round(Math.max(DRIVEN_OUT + 1, 8 * going(index.regions[probe.id]))) });
      }
    }
  }
  return moves;
}

import { COLONIES } from "./scenarios/colonies";
import type { Colony, GameState, MapRegion } from "./types";

/**
 * Land a metropole rules as a colony, told apart from its own soil
 * (engine/colonies.ts keeps the colonies). A colonial war – a metropole
 * against its colony's movement – is fought on the colony's land: for the
 * metropole's people it is a war away, not an invasion. Its elections are
 * not put off for it, its classes and parties feel it as any war abroad, its
 * war-weariness and its will to fight do not rally as an invaded people's
 * do, and its economy is not dragged down as by a front at home. A leaf
 * module: the readers of home soil (abroad, war means, classes, crises, the
 * economy) import it without the colonies' own imports.
 */

interface MapLookup {
  byAdm0: Map<string, string[]>;
  /** Provinces by their own id and by the standard map's (`was`). */
  byStd: Map<string, string[]>;
}
const LOOKUPS = new WeakMap<Record<string, MapRegion>, MapLookup>();
function lookup(regions: Record<string, MapRegion>): MapLookup {
  let l = LOOKUPS.get(regions);
  if (l) return l;
  l = { byAdm0: new Map(), byStd: new Map() };
  const add = (map: Map<string, string[]>, key: string, id: string) => {
    const list = map.get(key);
    if (list) list.push(id);
    else map.set(key, [id]);
  };
  for (const r of Object.values(regions)) {
    add(l.byAdm0, r.adm0, r.id);
    add(l.byStd, r.id, r.id);
    if (r.was && r.was !== r.id) add(l.byStd, r.was, r.id);
  }
  LOOKUPS.set(regions, l);
  return l;
}

/** The provinces of one modern country (the map's adm0). */
export const adm0Provinces = (adm0: string, regions: Record<string, MapRegion>): string[] => lookup(regions).byAdm0.get(adm0) ?? [];

/** Provinces by the ids a seed names, on either map. */
export function provincesNamed(ids: string[], regions: Record<string, MapRegion>): string[] {
  const l = lookup(regions);
  return [...new Set(ids.flatMap((id) => l.byStd.get(id) ?? []))];
}

/** Every province a colony covers: its modern countries, with provinces added and left out. */
export function footprint(c: Pick<Colony, "adm0" | "plus" | "minus">, regions: Record<string, MapRegion>): string[] {
  const l = lookup(regions);
  const minus = new Set(provincesNamed(c.minus ?? [], regions));
  const ids = [...c.adm0.flatMap((a) => l.byAdm0.get(a) ?? []), ...provincesNamed(c.plus ?? [], regions)];
  return [...new Set(ids)].filter((id) => !minus.has(id)).sort();
}

/** The movements the calendar has already at war on a date's start (1957's FLN): their wars are colonial before the save keeps its colonies. */
const MOVEMENTS = new Set(COLONIES.flatMap((s) => (s.war?.tag ? [s.war.tag] : [])));

/** What tells a colony's land from a metropole's own soil. */
export interface Colonial {
  /** Provinces of the live colonies, while their metropole still owns them (on the map; none without it). */
  land: Set<string>;
  /** The colonial wars: a metropole against its colony's movement. */
  wars: Set<string>;
}

/**
 * The colonies' land and wars as the state keeps them. Before the save keeps
 * its colonies (a new game's first turn), a war a calendar movement fights is
 * colonial all the same.
 */
export function colonialOf(state: Partial<Pick<GameState, "wars" | "colonies" | "regions">>, map?: Record<string, MapRegion> | null): Colonial {
  const land = new Set<string>();
  const wars = new Set<string>();
  for (const c of state.colonies ?? []) {
    if (c.war) wars.add(c.war);
    if (c.end || !map || !state.regions) continue;
    for (const id of footprint(c, map)) if (state.regions[id]?.owner === c.of) land.add(id);
  }
  if (!state.colonies) for (const w of state.wars ?? []) if ([...w.attackers, ...w.defenders].some((t) => MOVEMENTS.has(t))) wars.add(w.id);
  // The land a colonial war is fought in is colonial land, map or no map: what one side owns and the other holds or fights in.
  if (wars.size && state.regions) {
    const sides = (state.wars ?? []).filter((w) => wars.has(w.id)).map((w) => [new Set(w.attackers), new Set(w.defenders)] as const);
    for (const [id, r] of Object.entries(state.regions)) {
      for (const [a, b] of sides) {
        const by = (side: ReadonlySet<string>) => side.has(r.controller) || (r.contested !== undefined && side.has(r.contested));
        if ((a.has(r.owner) && by(b)) || (b.has(r.owner) && by(a))) land.add(id);
      }
    }
  }
  return { land, wars };
}

/** The enemies a country fights on its own soil: those of its wars outside a truce, the colonial wars left out. */
export function homeEnemies(state: Pick<GameState, "wars" | "date">, tag: string, colonial: Colonial): Set<string> {
  const out = new Set<string>();
  for (const w of state.wars) {
    if (colonial.wars.has(w.id) || (w.truce && w.truce.until > state.date)) continue;
    if (w.attackers.includes(tag)) w.defenders.forEach((t) => out.add(t));
    else if (w.defenders.includes(tag)) w.attackers.forEach((t) => out.add(t));
  }
  return out;
}

/** Whether an enemy of a war that is not a colonial one holds or fights in a province of the country's own soil (not a colony's). */
export function warOnOwnSoil(state: Pick<GameState, "regions" | "wars" | "date"> & Partial<Pick<GameState, "colonies">>, tag: string, map?: Record<string, MapRegion> | null): boolean {
  const colonial = colonialOf(state, map);
  const enemies = homeEnemies(state, tag, colonial);
  if (!enemies.size) return false;
  for (const [id, r] of Object.entries(state.regions)) {
    if (r.owner !== tag || colonial.land.has(id)) continue;
    if (enemies.has(r.controller) || (r.contested !== undefined && enemies.has(r.contested))) return true;
  }
  return false;
}

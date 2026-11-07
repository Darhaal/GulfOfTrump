import { distanceKm } from "./provinces";
import type { ChronicleEntry, GameState, MapRegion, RegionBorder, RegionState } from "./types";

/**
 * A finer map (public/maps/world_<year>_fine.json, built by `npm run maps
 * -- --fine <year>`, the map every era plays) splits the standard map's
 * provinces into parts. Each part records the standard province it lies in (`was`, where
 * its id differs; the part that keeps the standard id is the one holding
 * its biggest town). Saves and scenario data are written for the standard
 * map: this carries them over, part by part.
 *
 * A province passes its owner, holder, people, occupation and resistance to
 * every part. A front through it is laid out again: the side holding part of
 * it takes whole the parts nearest its own land, as many as its share of the
 * people, and the front runs through the part where that share runs out. A
 * side with no land of its own fights in every part.
 */

/** The standard province a province of a finer map lies in. */
export const coarseOf = (region: Pick<MapRegion, "id" | "was">): string => region.was ?? region.id;

/** Whether a map is finer than the standard one: some province lies in a standard province of another id. */
export const isFineMap = (regions: readonly Pick<MapRegion, "was">[]): boolean => regions.some((r) => r.was !== undefined);

/** The parts of each standard province on a finer map. */
export function partsOf(regions: readonly MapRegion[]): Map<string, MapRegion[]> {
  const out = new Map<string, MapRegion[]>();
  for (const r of regions) {
    const key = coarseOf(r);
    const list = out.get(key);
    if (list) list.push(r);
    else out.set(key, [r]);
  }
  return out;
}

/** What a part counts for in a share of its standard province: its people on the map, else its land. */
const weightOf = (r: MapRegion) => (r.pop !== undefined && r.pop > 0 ? r.pop : r.area / 1000);

/** The part a standard province's mention goes to (a chronicle line, a protest): the one keeping its id, else the most populous. */
export function mainPart(parts: readonly MapRegion[], id: string): MapRegion {
  return parts.find((r) => r.id === id) ?? parts.reduce((best, r) => (weightOf(r) > weightOf(best) ? r : best), parts[0]);
}

const FALLS = 95;
const DRIVEN_OUT = 5;

/**
 * A standard province's state shared out among its parts. `near(side)`
 * gives the centres of the land a side holds outside this province, for a
 * front to be laid out from.
 */
export function shareProvince(coarse: RegionState, parts: readonly MapRegion[], near: (side: string) => [number, number][]): Record<string, RegionState> {
  const total = parts.reduce((s, r) => s + weightOf(r), 0);
  const base = (r: MapRegion, controller: string): RegionState => {
    const next: RegionState = { owner: coarse.owner, controller };
    if (coarse.pop !== undefined) next.pop = Math.round((coarse.pop * weightOf(r) * 10) / Math.max(1e-9, total)) / 10;
    if (controller !== coarse.owner) {
      if (coarse.behind) next.behind = true;
      if (coarse.resistance) next.resistance = { ...coarse.resistance };
    }
    return next;
  };
  const out: Record<string, RegionState> = {};
  if (!coarse.contested || parts.length < 2) {
    for (const r of parts) {
      out[r.id] = base(r, coarse.controller);
      if (coarse.contested) {
        out[r.id].contested = coarse.contested;
        if (coarse.held !== undefined) out[r.id].held = coarse.held;
        if (coarse.taken?.length) out[r.id].taken = [...coarse.taken];
      }
    }
    return out;
  }
  // The contesting side takes the parts nearest its own land first; a side with no land of its own (guerrillas, a
  // rising) has no line to advance from and fights in every part alike, the towns it held unknown among them.
  const from = near(coarse.contested);
  if (!from.length) {
    for (const r of parts) out[r.id] = { ...base(r, coarse.controller), contested: coarse.contested, ...(coarse.held !== undefined ? { held: coarse.held } : {}) };
    return out;
  }
  const gap = (r: MapRegion) => (r.at && from.length ? Math.min(...from.map((c) => distanceKm(r.at!, c))) : 0);
  const order = [...parts].sort((a, b) => gap(a) - gap(b) || a.id.localeCompare(b.id));
  let left = ((coarse.held ?? 30) / 100) * total;
  for (const r of order) {
    const w = weightOf(r);
    if (left <= 0) {
      out[r.id] = base(r, coarse.controller);
      continue;
    }
    const share = (left / w) * 100;
    left -= w;
    if (share >= FALLS) out[r.id] = base(r, coarse.contested);
    else if (share <= DRIVEN_OUT) out[r.id] = base(r, coarse.controller);
    else {
      out[r.id] = { ...base(r, coarse.controller), contested: coarse.contested, held: Math.round(share) };
      // The towns the side held stay with the front; those in other parts are not listed there.
      if (coarse.taken?.length) out[r.id].taken = [...coarse.taken];
    }
  }
  return out;
}

/** The standard provinces' states shared out over a finer map's parts; a part of a province the save lacks keeps `fallback`. */
export function refineRegions(regions: Record<string, RegionState>, map: readonly MapRegion[], fallback: (r: MapRegion) => RegionState): Record<string, RegionState> {
  const parts = partsOf(map);
  // Where each side holds land outside a province: the centres of its parts.
  const centres = new Map<string, { key: string; at: [number, number] }[]>();
  for (const r of map) {
    const state = regions[coarseOf(r)];
    if (!state || !r.at) continue;
    const list = centres.get(state.controller) ?? [];
    list.push({ key: coarseOf(r), at: r.at });
    centres.set(state.controller, list);
  }
  const out: Record<string, RegionState> = {};
  for (const [key, list] of parts) {
    const coarse = regions[key];
    if (!coarse) {
      for (const r of list) out[r.id] = fallback(r);
      continue;
    }
    Object.assign(out, shareProvince(coarse, list, (side) => (centres.get(side) ?? []).filter((c) => c.key !== key).map((c) => c.at)));
  }
  return out;
}

/** Whether a save's provinces are not the map's: a save of the standard map opened on a finer one. */
export function needsRefining(state: Pick<GameState, "regions">, map: readonly MapRegion[]): boolean {
  if (!isFineMap(map)) return false;
  const ids = new Set(map.map((r) => r.id));
  return Object.keys(state.regions).some((id) => !ids.has(id)) || map.some((r) => !state.regions[r.id]);
}

/**
 * A save of the standard map carried over to a finer one: its provinces
 * part by part, the chronicle's borders (every part drawn as its province
 * was, so the timelapse still plays) and changes (on the main part), the
 * army's formations (on every part of the provinces they stood in) and the
 * protests (on the main parts). A save already on the map is left alone;
 * a part of a province the save does not have gets `fallback`.
 */
export function refineSave(state: GameState, map: readonly MapRegion[], fallback: (r: MapRegion) => RegionState = (r) => ({ owner: r.owner, controller: r.owner })): GameState {
  if (!needsRefining(state, map)) return state;
  const parts = partsOf(map);
  const ids = new Set(map.map((r) => r.id));
  // A province of the save is its own key on the map, or the key of the parts lying in it.
  const partsFor = (id: string): MapRegion[] => parts.get(id) ?? (ids.has(id) ? map.filter((r) => r.id === id) : []);
  const main = (id: string) => {
    const list = partsFor(id);
    return list.length ? mainPart(list, id).id : id;
  };
  const all = (id: string) => {
    const list = partsFor(id);
    return list.length ? list.map((r) => r.id) : [id];
  };
  const regions = refineRegions(state.regions, map, fallback);
  const chronicle = state.chronicle.map((entry): ChronicleEntry => {
    const next: ChronicleEntry = { ...entry };
    if (entry.borders) {
      const borders: Record<string, RegionBorder> = {};
      for (const [id, border] of Object.entries(entry.borders)) for (const part of all(id)) borders[part] = border;
      next.borders = borders;
    }
    if (entry.applied) next.applied = entry.applied.map((c) => ("region" in c && typeof c.region === "string" ? { ...c, region: main(c.region) } : c));
    return next;
  });
  const countries = Object.fromEntries(
    Object.entries(state.countries).map(([tag, c]) => {
      const formations = c.arsenal?.organisation?.formations;
      if (!formations?.length) return [tag, c];
      const organisation = { ...c.arsenal!.organisation!, formations: formations.map((f) => ({ ...f, provinces: [...new Set(f.provinces.flatMap(all))] })) };
      return [tag, { ...c, arsenal: { ...c.arsenal!, organisation } }];
    }),
  );
  const protests = state.protests?.map((p) => ({ ...p, where: [...new Set(p.where.map(main))] }));
  return { ...state, regions, chronicle, countries, ...(protests ? { protests } : {}) };
}

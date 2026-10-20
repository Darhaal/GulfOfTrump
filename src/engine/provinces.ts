import { neighbors as topoNeighbors } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import { countryColor } from "./colors";
import { peopleIn } from "./population";
import { countryName } from "./names";
import { titleCase } from "./text";
import type { GameState, Locale, MapIndex, MapRegion, RegionState, Scenario } from "./types";

export type ProvinceTopology = Topology<{ regions: GeometryCollection<MapRegion> }>;

/**
 * The owner tag of a province at the scenario's start: the finest correction
 * wins — the province itself, then its modern country, then the historical
 * polygon it lies in, then that polygon's owner as the map names it.
 */
export function startingOwner(scenario: Scenario, region: Pick<MapRegion, "id" | "hist" | "owner" | "adm0">): string {
  return (
    scenario.provinceOwners?.[region.id] ??
    scenario.modernOwners?.[region.adm0] ??
    scenario.owners[region.hist] ??
    scenario.aliases[region.owner] ??
    region.owner
  );
}

/** The province's name in a locale, falling back to its English name. */
export function provinceName(region: Pick<MapRegion, "name" | "ru" | "uk">, locale: Locale): string {
  if (locale === "ru" && region.ru) return region.ru;
  if (locale === "uk" && region.uk) return region.uk;
  return region.name;
}

/** People per km² on the start date. */
export function populationDensity(region: Pick<MapRegion, "pop" | "area"> | undefined): number {
  if (!region?.pop || !region.area) return 0;
  return (region.pop * 1000) / region.area;
}

export const RAIL_LEVELS = ["none", "sparse", "moderate", "dense"] as const;
export type RailLevel = (typeof RAIL_LEVELS)[number];

/** How well a province is served by railways: km of main line per 1,000 km². */
export function railLevel(region: Pick<MapRegion, "rail" | "area"> | undefined): RailLevel {
  if (!region?.rail || !region.area) return "none";
  const density = (region.rail * 1000) / region.area;
  return density >= 40 ? "dense" : density >= 15 ? "moderate" : "sparse";
}

/** People (thousands) in each owner's provinces now. */
export function peopleByOwner(regions: Record<string, RegionState>, index: MapIndex | null | undefined): Map<string, number> {
  const out = new Map<string, number>();
  if (!index) return out;
  for (const [id, r] of Object.entries(regions)) out.set(r.owner, (out.get(r.owner) ?? 0) + peopleIn(r, index.regions[id]));
  return out;
}

/** Great-circle distance in km between two [lon, lat] points. */
export function distanceKm(a: [number, number], b: [number, number]): number {
  const rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad;
  const dLon = (b[0] - a[0]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** How far apart (centre to centre) two provinces may be for an army to cross between them by sea: a strait, not an ocean. */
export const STRAIT_KM = 400;

/**
 * The provinces of `country` an occupation of "all of it" by `occupier` can
 * reach: it spreads from where the occupier already stands (provinces it
 * holds, fights in or borders) through the country's own land and across
 * straits. Overseas possessions — Greenland for Denmark, the Indies for the
 * Netherlands — stay out. With no foothold at all (a landing), it starts from
 * the country's province nearest to the occupier. Returns null when the map
 * has no province centres to measure with.
 */
export function reachableProvinces(state: Pick<GameState, "regions">, index: MapIndex, country: string, occupier: string): string[] | null {
  const own = Object.keys(state.regions).filter((id) => state.regions[id].owner === country);
  const at = (id: string) => index.regions[id]?.at;
  if (!own.length || own.some((id) => !at(id))) return null;
  const mine = new Set(own);
  const heldBy = (id: string) => state.regions[id]?.controller === occupier;
  let seeds = own.filter((id) => heldBy(id) || state.regions[id].contested === occupier || (index.neighbors[id] ?? []).some(heldBy));
  if (!seeds.length) {
    const bases = Object.keys(state.regions).filter((id) => heldBy(id) && at(id));
    if (!bases.length) return null;
    let best = own[0];
    let bestKm = Infinity;
    for (const id of own) {
      for (const base of bases) {
        const km = distanceKm(at(id)!, at(base)!);
        if (km < bestKm) {
          bestKm = km;
          best = id;
        }
      }
    }
    seeds = [best];
  }
  const reached = new Set(seeds);
  const queue = [...seeds];
  while (queue.length) {
    const id = queue.shift()!;
    for (const next of own) {
      if (reached.has(next)) continue;
      const linked = (index.neighbors[id] ?? []).includes(next) || distanceKm(at(id)!, at(next)!) <= STRAIT_KM;
      if (linked && mine.has(next)) {
        reached.add(next);
        queue.push(next);
      }
    }
  }
  return own.filter((id) => reached.has(id));
}

/** "340k", "1.2M", "38M" — thousands of people, short. */
export function formatPopulation(thousands: number): string {
  if (thousands < 1) return "<1k";
  if (thousands < 1000) return `${Math.round(thousands)}k`;
  const millions = thousands / 1000;
  return `${millions < 10 ? Math.round(millions * 10) / 10 : Math.round(millions)}M`;
}

/**
 * A region id in a chronicle entry: a province, or — in a game started before
 * provinces — a whole-country region whose id is usually a country tag.
 */
export function regionLabel(id: string, index: MapIndex | null, locale: Locale): string {
  const province = index?.regions[id];
  if (province) return provinceName(province, locale);
  const country = countryName(id);
  return country ? country[locale] : titleCase(id);
}

/** Provinces by id and who borders whom, from the map's shared arcs. */
export function buildMapIndex(topology: ProvinceTopology): MapIndex {
  const geometries = topology.objects.regions.geometries;
  const ids = geometries.map((g) => (g.properties as MapRegion).id);
  const regions: Record<string, MapRegion> = {};
  geometries.forEach((g) => {
    regions[(g.properties as MapRegion).id] = g.properties as MapRegion;
  });
  const adjacency = topoNeighbors(geometries as never) as number[][];
  const neighbors: Record<string, string[]> = {};
  adjacency.forEach((list, i) => {
    neighbors[ids[i]] = list.map((j) => ids[j]);
  });
  return { regions, neighbors };
}

/**
 * A version-1 save had one region per historical country, keyed by the
 * polygon id that every province now records as `hist`. Each province takes
 * the owner and holder its old region had, so a game keeps its borders.
 */
export function migrateToProvinces(state: GameState, scenario: Scenario, mapRegions: MapRegion[]): GameState {
  const old = state.regions as Record<string, RegionState>;
  if ((state as { schema: number }).schema === 2) return state;
  const regions: Record<string, RegionState> = {};
  for (const province of mapRegions) {
    const previous = old[province.hist];
    const owner = previous?.owner ?? startingOwner(scenario, province);
    regions[province.id] = { owner, controller: previous?.controller ?? owner };
  }
  const next: GameState = { ...state, schema: 2, regions };
  // A country that only existed as a map owner keeps its record; one that
  // newly appears through a province correction gets added like at a start.
  for (const { owner } of Object.values(regions)) {
    if (!next.countries[owner]) {
      next.countries = { ...next.countries, [owner]: { tag: owner, name: countryName(owner) ?? titleCase(owner), color: countryColor(owner) } };
    }
  }
  return next;
}

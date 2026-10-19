import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { buildMapIndex, type ProvinceTopology } from "@/engine/provinces";
import { type CitySource, mergePlaces, type TownSource, townIndex } from "@/engine/towns";
import type { MapId, MapIndex } from "@/engine/types";

// Kept across hot reloads in development; the name changes whenever the index gains a field, so a stale one is not served.
const cache = ((globalThis as { __gotMapsWithTowns?: Map<MapId, Promise<MapIndex>> }).__gotMapsWithTowns ??= new Map());

/**
 * The province index for a map, read from the same file the browser draws.
 * The game state carries only who owns and holds each province; names,
 * terrain and neighbours for the prompt come from here.
 */
export function loadMapIndex(id: MapId): Promise<MapIndex> {
  let promise = cache.get(id);
  if (!promise) {
    const read = (name: string) => readFile(path.join(process.cwd(), "public", "maps", name), "utf8").then((text) => JSON.parse(text) as unknown);
    promise = Promise.all([read(`${id}.json`), read("cities.json"), read("towns.json")]).then(([topology, cities, towns]) => {
      const index = buildMapIndex(topology as ProvinceTopology);
      // Towns inside provinces, for the fronts that run through them; found when first needed.
      return { ...index, towns: townIndex(topology as ProvinceTopology, mergePlaces(cities as CitySource[], (towns as { towns: TownSource[] }).towns)) };
    });
    promise.catch(() => cache.delete(id));
    cache.set(id, promise);
  }
  return promise;
}

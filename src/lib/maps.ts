"use client";

import { useEffect, useState } from "react";
import { buildMapIndex, type ProvinceTopology } from "@/engine/provinces";
import type { MapId, MapIndex, MapRegion } from "@/engine/types";

export type RegionTopology = ProvinceTopology;

export interface LoadedMap {
  topology: RegionTopology;
  regions: MapRegion[];
  index: MapIndex;
}

const cache = new Map<MapId, Promise<LoadedMap>>();

/** The map files are static assets in public/maps, fetched once per session. */
export function loadMap(id: MapId): Promise<LoadedMap> {
  let promise = cache.get(id);
  if (!promise) {
    promise = fetch(`/maps/${id}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`Map ${id}: HTTP ${r.status}`);
        return r.json() as Promise<RegionTopology>;
      })
      .then((topology) => ({
        topology,
        regions: topology.objects.regions.geometries.map((g) => g.properties as MapRegion),
        index: buildMapIndex(topology),
      }));
    promise.catch(() => cache.delete(id));
    cache.set(id, promise);
  }
  return promise;
}

export function useMap(id: MapId | null): { map: LoadedMap | null; error: boolean } {
  const [state, setState] = useState<{ id: MapId | null; map: LoadedMap | null; error: boolean }>({ id: null, map: null, error: false });
  useEffect(() => {
    if (!id) return;
    let alive = true;
    loadMap(id).then(
      (map) => alive && setState({ id, map, error: false }),
      () => alive && setState({ id, map: null, error: true }),
    );
    return () => {
      alive = false;
    };
  }, [id]);
  return state.id === id ? { map: state.map, error: state.error } : { map: null, error: false };
}

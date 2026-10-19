"use client";

import { useEffect, useState } from "react";
import type { GeometryCollection, Topology } from "topojson-specification";
import type { CityRecord, TownRecord } from "@/components/map/cities";

export type WaterTopology = Topology<{
  rivers: GeometryCollection<{ n: string; r: number }>;
  lakes: GeometryCollection<{ n: string; r: number }>;
}>;

/** Railways (scale rank, year built — 0 for before 1914) and ports (name, scale rank). */
export type TransportTopology = Topology<{
  railways: GeometryCollection<{ r: number; s: number }>;
  ports: GeometryCollection<{ n: string; r: number }>;
}>;

const cache = new Map<string, Promise<unknown>>();

function load<T>(url: string): Promise<T> {
  let promise = cache.get(url) as Promise<T> | undefined;
  if (!promise) {
    promise = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
      return r.json() as Promise<T>;
    });
    promise.catch(() => cache.delete(url));
    cache.set(url, promise);
  }
  return promise;
}

/** A static map layer, fetched once per session when first wanted; null until it arrives (or if it fails). */
function useAsset<T>(url: string | null): T | null {
  const [value, setValue] = useState<{ url: string; data: T } | null>(null);
  useEffect(() => {
    if (!url) return;
    let alive = true;
    load<T>(url).then((data) => alive && setValue({ url, data }), () => undefined);
    return () => {
      alive = false;
    };
  }, [url]);
  return value && value.url === url ? value.data : null;
}

/** Rivers and lakes, shared by every era. */
export const useWater = () => useAsset<WaterTopology>("/maps/water.json");
/** Cities with their populations in 1950, 1990 and 2020. */
export const useCities = () => useAsset<CityRecord[]>("/maps/cities.json");
/** A layer fetched the first time it is wanted, and kept after. */
function useLazyAsset<T>(url: string, wanted: boolean): T | null {
  const [asked, setAsked] = useState(wanted);
  if (wanted && !asked) setAsked(true);
  return useAsset<T>(asked ? url : null);
}

/** Railways and ports, loaded the first time a transport layer is on. */
export const useTransport = (wanted: boolean) => useLazyAsset<TransportTopology>("/maps/transport.json", wanted);
/** GeoNames' towns, loaded the first time the map is zoomed in close. */
export const useTowns = (wanted: boolean) => useLazyAsset<{ towns: TownRecord[] }>("/maps/towns.json", wanted)?.towns ?? null;

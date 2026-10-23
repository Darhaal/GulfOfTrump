"use client";

import { useSyncExternalStore } from "react";
import { RESOURCE_TYPES, type ResourceType } from "@/engine/resources";

/**
 * How the map is shown — mode, picked resource, overlays — remembered per
 * browser so a reload or another game opens the map the way it was left.
 * Storage may be missing or throw; the defaults then hold for the session.
 */
export const MAP_MODES = ["political", "diplomacy", "terrain", "fertility", "population", "resources", "transport"] as const;
export type MapMode = (typeof MAP_MODES)[number];

export const MAP_LAYERS = ["fronts", "changes", "rivers", "railways", "ports", "cities", "provinces"] as const;
export type MapLayer = (typeof MAP_LAYERS)[number];

export interface MapSettings {
  mode: MapMode;
  resource: ResourceType | "all";
  layers: Record<MapLayer, boolean>;
}

const KEY = "got_map";

export const DEFAULT_MAP_SETTINGS: MapSettings = {
  mode: "political",
  resource: "all",
  layers: { fronts: true, changes: true, rivers: true, railways: false, ports: false, cities: true, provinces: true },
};

let memory: MapSettings | null = null;
let cached: { raw: string | null; value: MapSettings } | null = null;
const listeners = new Set<() => void>();

function parse(raw: string | null): MapSettings {
  if (!raw) return DEFAULT_MAP_SETTINGS;
  try {
    const value = JSON.parse(raw) as Partial<MapSettings>;
    const layers = { ...DEFAULT_MAP_SETTINGS.layers };
    for (const layer of MAP_LAYERS) if (typeof value.layers?.[layer] === "boolean") layers[layer] = value.layers[layer];
    return {
      mode: MAP_MODES.includes(value.mode as MapMode) ? (value.mode as MapMode) : DEFAULT_MAP_SETTINGS.mode,
      resource: value.resource === "all" || RESOURCE_TYPES.includes(value.resource as ResourceType) ? (value.resource as MapSettings["resource"]) : "all",
      layers,
    };
  } catch {
    return DEFAULT_MAP_SETTINGS;
  }
}

/** The same object for the same stored text, as useSyncExternalStore requires. */
function snapshot(): MapSettings {
  if (memory) return memory;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    // Storage unavailable: defaults.
  }
  if (!cached || cached.raw !== raw) cached = { raw, value: parse(raw) };
  return cached.value;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function save(next: MapSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
    memory = null;
  } catch {
    memory = next;
  }
  listeners.forEach((l) => l());
}

export function useMapSettings(): [MapSettings, (change: Partial<MapSettings>) => void] {
  const settings = useSyncExternalStore(subscribe, snapshot, () => DEFAULT_MAP_SETTINGS);
  return [settings, (change) => save({ ...snapshot(), ...change })];
}

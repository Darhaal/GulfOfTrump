import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { cityNameIn, foundedBy, type CityRecord } from "@/components/map/cities";
import type { CityName } from "@/engine/acts";
import type { GameState, MapIndex, MapRegion } from "@/engine/types";

let cities: Promise<CityRecord[]> | undefined;

/** The cities of the map, read from the same file the browser draws. */
function loadCities(): Promise<CityRecord[]> {
  cities ??= readFile(path.join(process.cwd(), "public", "maps", "cities.json"), "utf8").then((text) => JSON.parse(text) as CityRecord[]);
  cities.catch(() => (cities = undefined));
  return cities;
}

/**
 * The cities an act of the player's government may rename: each city belongs
 * to the nearest province of its modern country, and counts if the player
 * owns that province. Each goes by every name it has now – the map's, the
 * date's, a name given in play – in the three languages.
 */
export async function playerCities(state: GameState, index: MapIndex): Promise<CityName[]> {
  const all = await loadCities();
  const byAdm = new Map<string, MapRegion[]>();
  for (const r of Object.values(index.regions)) if (r.at) byAdm.set(r.adm0, [...(byAdm.get(r.adm0) ?? []), r]);
  const out: CityName[] = [];
  for (const c of all) {
    if (!foundedBy(c, state.scenarioId)) continue;
    let best: MapRegion | undefined;
    let dist = Infinity;
    for (const r of byAdm.get(c.a) ?? []) {
      const d = Math.hypot(r.at![0] - c.x, r.at![1] - c.y);
      if (d < dist) {
        dist = d;
        best = r;
      }
    }
    if (!best || state.regions[best.id]?.owner !== state.player) continue;
    const names = new Set([c.n, c.ru, c.uk, ...(["en", "ru", "uk"] as const).map((l) => cityNameIn(c, state.scenarioId, l, state.placeNames))].filter((n): n is string => Boolean(n)));
    out.push({ key: c.n, names: [...names] });
  }
  return out;
}

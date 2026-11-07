import type { MapId } from "@/engine/types";

/**
 * Every era plays its finer map (docs/map-plan.md, "Finer provinces"):
 * about 6,300 provinces, built by `npm run maps -- --fine <year>` from the
 * standard map beside it, which stays as the source each finer province's
 * `was` is read from. A map keeps its id; a save of the standard map is
 * carried over to the finer one when it opens (engine/refine.ts, save step
 * 35).
 */

/** The file in public/maps a map loads, without its extension: the finer one, or with `fine` false the standard one. */
export function mapFile(id: MapId, fine = true): string {
  return fine ? `${id}_fine` : id;
}

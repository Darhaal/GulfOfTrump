import { z } from "zod";
import type { AppliedChange, GameState, MapRegion, RegionState } from "./types";

/**
 * People move with the game. Every province starts with the map's figure
 * for the start date and grows by its country's natural pace for the era
 * (MapRegion.gr). Fighting inside a province drives people out; the model
 * reports the rest of a period's losses — war dead, famine, epidemics,
 * repression, deportations — and refugees, who leave for another country
 * or the world beyond the map. People are the workforce, the taxpayers and
 * the conscripts: a country's economic base is its people times their
 * income (economy.ts), and its GDP follows that base as land and people
 * change hands.
 */

const tag = z.string().trim().min(1).max(80);

/** A period's losses for one country (merged into OutcomeSchema as `population`). */
export const populationField = z
  .array(
    z.object({
      country: tag,
      /** Thousands dead beyond the normal: soldiers and civilians, famine, epidemics, repression. */
      deaths: z.number().finite().min(0).catch(0).default(0),
      /** Thousands who fled or were deported. */
      refugees: z.number().finite().min(0).catch(0).default(0),
      /** Where the refugees went, if to one country. */
      to: tag.optional(),
      cause: z.string().trim().max(160).default(""),
    }),
  )
  .max(16)
  .default([]);

export type PopulationChange = z.infer<typeof populationField>[number];

/** People in a province now, thousands. */
export const peopleIn = (region: RegionState | undefined, map: Pick<MapRegion, "pop"> | undefined): number => region?.pop ?? map?.pop ?? 0;

/** Fighting inside a province drives out this share of its people a month. */
const FRONT_LOSS_PER_MONTH = 0.005;
/** A turn's losses for one country cannot exceed this share of its people per month, nor a quarter of them in all. */
const MAX_LOSS_PER_MONTH = 0.04;
const MAX_LOSS = 0.25;

const round = (v: number) => (v >= 100 ? Math.round(v) : Math.round(v * 10) / 10);

/**
 * Natural growth over a period, everywhere: each province by its country's
 * pace for the era, plus `bonus` percentage points a year for its owner (the
 * player's medicine, engine/researchEffects.ts). Changes `regions` in place.
 */
export function growPopulation(regions: Record<string, RegionState>, map: Record<string, MapRegion>, years: number, bonus: (owner: string) => number = () => 0): void {
  for (const [id, r] of Object.entries(regions)) {
    const p = map[id];
    if (!p) continue;
    r.pop = round(Math.max(0, peopleIn(r, p) * (1 + ((p.gr ?? 0) + bonus(r.owner)) / 100) ** years));
  }
}

/**
 * A period's losses: people driven out of contested provinces, then the
 * model's dead and refugees, limited to what a country could lose in the
 * period. Changes `regions` in place and logs the losses for the report.
 */
export function losePopulation(
  regions: Record<string, RegionState>,
  map: Record<string, MapRegion>,
  changes: PopulationChange[],
  years: number,
  applied: AppliedChange[],
): void {
  const months = years * 12;
  for (const [id, r] of Object.entries(regions)) {
    if (r.contested && map[id]) r.pop = round(Math.max(0, peopleIn(r, map[id]) * (1 - FRONT_LOSS_PER_MONTH * months)));
  }

  const byOwner = new Map<string, string[]>();
  for (const [id, r] of Object.entries(regions)) {
    if (!map[id]) continue;
    byOwner.set(r.owner, [...(byOwner.get(r.owner) ?? []), id]);
  }
  const now = (id: string) => peopleIn(regions[id], map[id]);
  const total = (ids: string[]) => ids.reduce((s, id) => s + now(id), 0);

  for (const c of changes) {
    const ids = byOwner.get(c.country);
    if (!ids?.length) continue;
    const people = total(ids);
    if (people <= 0) continue;
    const cap = people * Math.min(MAX_LOSS, MAX_LOSS_PER_MONTH * Math.max(months, 0.25));
    const scale = c.deaths + c.refugees > cap ? cap / (c.deaths + c.refugees) : 1;
    const deaths = c.deaths * scale;
    const refugees = c.refugees * scale;
    if (deaths + refugees <= 0) continue;
    // War falls hardest where the fighting is: contested and occupied provinces count three times.
    const weight = (id: string) => now(id) * (regions[id].contested || regions[id].controller !== regions[id].owner ? 3 : 1);
    const weights = ids.reduce((s, id) => s + weight(id), 0);
    for (const id of ids) {
      const share = weights > 0 ? weight(id) / weights : 0;
      regions[id].pop = round(Math.max(0, now(id) - (deaths + refugees) * share));
    }
    const host = c.to && c.to !== c.country ? byOwner.get(c.to) : undefined;
    if (host?.length && refugees > 0) {
      const hostPeople = total(host);
      for (const id of host) {
        const share = hostPeople > 0 ? now(id) / hostPeople : 1 / host.length;
        regions[id].pop = round(now(id) + refugees * share);
      }
    }
    applied.push({
      kind: "population",
      country: c.country,
      deaths: Math.round(deaths),
      refugees: Math.round(refugees),
      ...(host?.length && refugees > 0 ? { to: c.to } : {}),
      cause: c.cause,
    });
  }
}

/** People (thousands) in each owner's provinces now. */
export function peopleOf(state: Pick<GameState, "regions">, map: Record<string, MapRegion> | null | undefined, tag: string): number {
  if (!map) return 0;
  let n = 0;
  for (const [id, r] of Object.entries(state.regions)) if (r.owner === tag) n += peopleIn(r, map[id]);
  return n;
}

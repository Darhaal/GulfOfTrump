import { countryColor } from "./colors";
import { seedEconomies } from "./economy";
import { SAVE_MIGRATION } from "./migrations";
import { startingOwner } from "./provinces";
import { startingPolitics } from "./politics";
import { countryName } from "./names";
import { same, titleCase, tr } from "./text";
import type { CountryState, GameState, Locale, MapRegion, RegionState, Scenario } from "./types";

const roundPeople = (v: number) => (v >= 100 ? Math.round(v) : Math.round(v * 10) / 10);

/**
 * How many times the map's people a province has on the start date, by its
 * modern country: null when the map counts them for the scenario's own date.
 */
function peopleScale(scenario: Scenario, mapRegions: MapRegion[]): ((adm0: string) => number) | null {
  const people = scenario.people;
  if (!people) return null;
  const onMap = new Map<string, number>();
  for (const r of mapRegions) onMap.set(r.adm0, (onMap.get(r.adm0) ?? 0) + (r.pop ?? 0));
  return (adm0) => {
    const target = people.byCountry[adm0];
    const total = onMap.get(adm0) ?? 0;
    return target !== undefined && total > 0 ? target / total : people.others;
  };
}

/** Every region with its owner, and every country that holds land or is seeded. */
export function startingWorld(scenario: Scenario, mapRegions: MapRegion[]) {
  const regions: Record<string, RegionState> = {};
  const scale = peopleScale(scenario, mapRegions);
  for (const region of mapRegions) {
    const owner = startingOwner(scenario, region);
    const contested = scenario.provinceContested?.[region.id];
    const held = scenario.provinceHeld?.[region.id];
    const taken = scenario.provinceTaken?.[region.id];
    regions[region.id] = {
      owner,
      controller: scenario.provinceControllers?.[region.id] ?? owner,
      ...(contested ? { contested, ...(held ? { held } : {}), ...(taken?.length ? { taken } : {}) } : {}),
      ...(scale && region.pop !== undefined ? { pop: roundPeople(region.pop * scale(region.adm0)) } : {}),
    };
  }

  const countries: Record<string, CountryState> = {};
  for (const [tag, seed] of Object.entries(scenario.countries)) {
    countries[tag] = {
      tag,
      name: seed.name,
      color: seed.color,
      leader: seed.leader,
      government: seed.government,
      ...(seed.dormant ? { dormant: true } : {}),
    };
  }
  for (const { owner } of Object.values(regions)) {
    if (countries[owner]) continue;
    // An unseeded owner takes its name from the dictionary, else from its tag.
    countries[owner] = {
      tag: owner,
      name: countryName(owner) ?? same(titleCase(owner)),
      color: countryColor(owner),
    };
  }
  return { regions, countries };
}

/** A UUID v4 — the cloud table's primary key type. */
export function newGameId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function createGame(scenario: Scenario, mapRegions: MapRegion[], player: string, now = new Date(), locale: Locale = "en"): GameState {
  const { regions, countries } = startingWorld(scenario, mapRegions);
  if (!countries[player]) throw new Error(`Unknown country: ${player}`);
  const known = (tags: string[]) => tags.filter((t) => countries[t]);
  const stamp = now.toISOString();
  const byId = Object.fromEntries(mapRegions.map((r) => [r.id, r]));
  return seedEconomies({
    schema: 2,
    // A new game is in today's shape: no migration is for it.
    migration: SAVE_MIGRATION,
    id: newGameId(),
    createdAt: stamp,
    updatedAt: stamp,
    scenarioId: scenario.id,
    player,
    date: scenario.startDate,
    turn: 1,
    step: scenario.defaultStep,
    countries,
    regions,
    wars: scenario.wars.map((w) => ({ ...w, attackers: known(w.attackers), defenders: known(w.defenders) })),
    alliances: scenario.alliances.map(({ allExcept, ...a }) => ({ ...a, members: allExcept ? worldBody(countries, allExcept) : known(a.members) })),
    chronicle: [],
    diplomacy: {},
    draft: [],
    politics: { ...startingPolitics(scenario.countries[player]?.stats?.stability), ...(scenario.loyalty?.[player] ? { loyalty: scenario.loyalty[player] } : {}) },
    ...(scenario.protests?.length
      ? {
          protests: scenario.protests.map((p, i) => ({
            id: `protest-0-${i + 1}`,
            title: tr(p.title, locale),
            stage: p.stage,
            size: p.size,
            where: p.where.filter((id) => regions[id]),
            demands: tr(p.demands, locale),
            ...(p.by ? { by: tr(p.by, locale) } : {}),
            since: scenario.startDate,
            ...(p.country && p.country !== player ? { country: p.country } : {}),
            ...(p.support !== undefined ? { support: p.support } : {}),
            ...(p.organisation !== undefined ? { organisation: p.organisation } : {}),
            ...(p.backer ? { backer: p.backer } : {}),
            ...(p.killed ? { killed: p.killed } : {}),
          })),
        }
      : {}),
  } satisfies GameState, byId);
}

/** The members of a world body: every country in the game but those left out (the scenario lists them, republics without a seat among them). */
export function worldBody(countries: Record<string, CountryState>, except: string[]): string[] {
  return Object.keys(countries).filter((tag) => !except.includes(tag));
}

/** Regions per country, for counts and the prompt. */
export function regionsByOwner(state: Pick<GameState, "regions">): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const [id, region] of Object.entries(state.regions)) {
    const list = result.get(region.owner) ?? [];
    list.push(id);
    result.set(region.owner, list);
  }
  return result;
}

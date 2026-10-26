import { START_VARIANTS, type GameState, type Scenario, type ScenarioId, type StartVariant } from "../types";
import { scenario1914 } from "./1914";
import { scenario1939 } from "./1939";
import { scenario1950 } from "./1950";
import { scenario1964 } from "./1964";
import { scenario1991 } from "./1991";
import { scenario1999 } from "./1999";
import { scenario2014 } from "./2014";
import { scenario2022 } from "./2022";

export const SCENARIOS: Record<ScenarioId, Scenario> = {
  "1914": scenario1914,
  "1939": scenario1939,
  "1950": scenario1950,
  "1964": scenario1964,
  "1991": scenario1991,
  "1999": scenario1999,
  "2014": scenario2014,
  "2022": scenario2022,
};

export const SCENARIO_ORDER: ScenarioId[] = ["1914", "1939", "1950", "1964", "1991", "1999", "2014", "2022"];

export function isScenarioId(value: unknown): value is ScenarioId {
  return typeof value === "string" && value in SCENARIOS;
}

export function isStartVariant(value: unknown): value is StartVariant {
  return typeof value === "string" && (START_VARIANTS as readonly string[]).includes(value);
}

/**
 * A date laid out for one of its other starts: the variant's day, words and
 * world over the date's own. A war or treaty of the date not yet begun on the
 * variant's day is left out, so an eve has none of the wars its date opens with.
 */
function withVariant(base: Scenario, variant: StartVariant): Scenario {
  const v = base.variants?.[variant];
  if (!v) return base;
  const { leaders, ...rest } = v;
  const countries = leaders
    ? Object.fromEntries(Object.entries(base.countries).map(([tag, c]) => [tag, leaders[tag] ? { ...c, leader: leaders[tag] } : c]))
    : base.countries;
  return {
    ...base,
    ...rest,
    variant,
    countries,
    wars: (rest.wars ?? base.wars).filter((w) => w.since <= v.startDate),
    alliances: (rest.alliances ?? base.alliances).filter((a) => a.since <= v.startDate),
  };
}

const laidOut = new Map<string, Scenario>();

/** A date, or one of its other starts: the same object every time, so what is worked out from it can be kept. */
export function getScenario(id: ScenarioId, variant?: StartVariant | null): Scenario {
  const base = SCENARIOS[id];
  if (!variant || !base.variants?.[variant]) return base;
  const key = `${id}:${variant}`;
  let scenario = laidOut.get(key);
  if (!scenario) laidOut.set(key, (scenario = withVariant(base, variant)));
  return scenario;
}

/** The scenario a game was begun on, with the start its player chose. */
export function scenarioOf(state: Pick<GameState, "scenarioId" | "variant">): Scenario {
  return getScenario(state.scenarioId, state.variant);
}

/**
 * The starts a date offers: its days earliest first – the week before, then
 * its own day (null) – and last a start played as one country (the tutorial),
 * which the card names rather than dates.
 */
export function startsOf(id: ScenarioId): (StartVariant | null)[] {
  const base = SCENARIOS[id];
  const offered = START_VARIANTS.filter((v) => base.variants?.[v]);
  const guided = offered.filter((v) => base.variants![v]!.player);
  const dated = offered.filter((v) => !base.variants![v]!.player).sort((a, b) => base.variants![a]!.startDate.localeCompare(base.variants![b]!.startDate));
  return [...dated, null, ...guided];
}

/** The tutorial: the first morning of 2022, played as Ukraine with a guide (engine/tutorial.ts). */
export const TUTORIAL_START = { scenario: "2022", variant: "tutorial" } as const satisfies { scenario: ScenarioId; variant: StartVariant };

/** Where a new game of a date and start is set up: `/new/1939`, or `/new/1939/eve`; `/new/2022/tutorial` starts the tutorial at once. */
export function newGamePath(id: ScenarioId, variant?: StartVariant | null): string {
  return variant ? `/new/${id}/${variant}` : `/new/${id}`;
}

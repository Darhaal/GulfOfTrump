import type { Scenario, ScenarioId } from "../types";
import { scenario1914 } from "./1914";
import { scenario1939 } from "./1939";
import { scenario1991 } from "./1991";
import { scenario2014 } from "./2014";
import { scenario2022 } from "./2022";

export const SCENARIOS: Record<ScenarioId, Scenario> = {
  "1914": scenario1914,
  "1939": scenario1939,
  "1991": scenario1991,
  "2014": scenario2014,
  "2022": scenario2022,
};

export const SCENARIO_ORDER: ScenarioId[] = ["1914", "1939", "1991", "2014", "2022"];

export function isScenarioId(value: unknown): value is ScenarioId {
  return typeof value === "string" && value in SCENARIOS;
}

export function getScenario(id: ScenarioId): Scenario {
  return SCENARIOS[id];
}

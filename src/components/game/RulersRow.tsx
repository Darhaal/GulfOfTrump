"use client";

import { useMemo } from "react";
import { personName, rulersOf } from "@/engine/people";
import { getScenario } from "@/engine/scenarios";
import type { CountryState, ScenarioId } from "@/engine/types";
import { useI18n } from "@/i18n/useI18n";
import Portrait from "./Portrait";

/**
 * The portraits of the people a country's leader line names, the one who
 * leads first. A country fresh from the scenario (the pick screen) has its
 * line read here.
 */
export default function RulersRow({ country, scenario }: { country: CountryState; scenario: ScenarioId }) {
  const { locale } = useI18n();
  const rulers = useMemo(
    () => country.rulers ?? (country.leader ? rulersOf(country.leader, country.tag, Number(getScenario(scenario).startDate.slice(0, 4))) : null),
    [country.rulers, country.leader, country.tag, scenario],
  );
  if (!rulers?.people.length) return null;
  const order = [rulers.people[rulers.lead], ...rulers.people.filter((_, i) => i !== rulers.lead)].filter(Boolean).slice(0, 3);
  return (
    <div className="mt-2 flex flex-wrap items-end gap-3">
      {order.map((p, i) => (
        <figure key={p.id} className={`flex flex-col items-center gap-1 ${i === 0 ? "w-24" : "w-[72px]"}`}>
          <Portrait portrait={p.portrait} gender={p.gender} name={personName(p, locale)} size={i === 0 ? "xl" : "lg"} className={i === 0 ? "ring-1 ring-accent/40 ring-offset-2 ring-offset-page" : ""} />
          <figcaption className="w-full truncate text-center text-2xs font-bold text-muted">{personName(p, locale)}</figcaption>
        </figure>
      ))}
    </div>
  );
}

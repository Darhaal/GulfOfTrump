"use client";

import { Swords, Users } from "lucide-react";
import type { ReactNode } from "react";
import { ui } from "@/components/ui/classes";
import { useI18n } from "@/i18n/useI18n";
import type { Accounts } from "@/engine/economy";
import Flag from "@/components/Flag";
import type { Alliance, CountryState, ScenarioId, War } from "@/engine/types";
import EconomyPanel from "./EconomyPanel";

interface CountryDetailsProps {
  country: CountryState;
  /** For the flag of the date. */
  scenario: ScenarioId;
  regionCount: number;
  /** People in its provinces, thousands. */
  population?: number;
  /** Its resources and trade this year, when the map is loaded. */
  accounts?: Accounts;
  /** Show the whole economy (the player's own country, or the one being picked). */
  detailed?: boolean;
  wars: War[];
  alliances: Alliance[];
  countries: Record<string, CountryState>;
  isPlayer?: boolean;
  footer?: ReactNode;
}

/** Everything the player can know about one country at a glance. */
export default function CountryDetails({ country, scenario, regionCount, population, accounts, detailed, wars, alliances, countries, isPlayer, footer }: CountryDetailsProps) {
  const { t, text, people } = useI18n();
  const name = (tag: string) => text(countries[tag]?.name ?? tag);
  const enemies = [
    ...new Set(
      wars.flatMap((w) => (w.attackers.includes(country.tag) ? w.defenders : w.defenders.includes(country.tag) ? w.attackers : [])),
    ),
  ];
  const memberOf = alliances.filter((a) => a.members.includes(country.tag));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <Flag tag={country.tag} scenario={scenario} color={country.color} size="xl" className="mt-0.5" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-black leading-tight text-ink">{text(country.name)}</h3>
            {isPlayer && <span className="rounded bg-ink px-1.5 py-0.5 text-2xs font-black uppercase tracking-widest text-on-ink">{t("country.you")}</span>}
          </div>
          {country.government && <div className="mt-0.5 text-xs font-medium text-muted">{text(country.government)}</div>}
        </div>
      </div>

      {country.leader && (
        <div className="rounded-xl bg-page p-3">
          <div className={ui.label}>{t("country.leader")}</div>
          <div className="mt-1 text-sm font-bold text-ink">{country.leader}</div>
        </div>
      )}

      {country.economy && <EconomyPanel economy={country.economy} accounts={accounts} detailed={detailed} />}

      <div className="grid grid-cols-1 gap-3 text-sm">
        <div className="flex items-center justify-between rounded-xl bg-page px-3 py-2">
          <span className="text-xs font-bold text-muted">{t("country.regions")}</span>
          <span className="font-black tabular-nums text-ink">{regionCount || (country.dormant ? "—" : 0)}</span>
        </div>
        {population !== undefined && regionCount > 0 && (
          <div className="flex items-center justify-between rounded-xl bg-page px-3 py-2">
            <span className="text-xs font-bold text-muted">{t("country.population")}</span>
            <span className="font-black tabular-nums text-ink">{people(population)}</span>
          </div>
        )}
        {country.dormant && regionCount === 0 && <p className="text-xs font-medium text-muted">{t("pick.noLand")}</p>}
        <div>
          <div className={`${ui.label} mb-1.5 flex items-center gap-1.5`}>
            <Swords className="h-3.5 w-3.5" />
            {t("country.wars")}
          </div>
          {enemies.length ? (
            <div className="flex flex-wrap gap-1.5">
              {enemies.map((tag) => (
                <span key={tag} className="rounded-md bg-red-50 px-2 py-1 text-xs font-bold text-red-700">
                  {name(tag)}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-xs font-medium text-muted">{t("country.none")}</div>
          )}
        </div>
        <div>
          <div className={`${ui.label} mb-1.5 flex items-center gap-1.5`}>
            <Users className="h-3.5 w-3.5" />
            {t("country.alliances")}
          </div>
          {memberOf.length ? (
            <div className="flex flex-wrap gap-1.5">
              {memberOf.map((a) => (
                <span key={a.id} className={ui.chip}>
                  {text(a.name)}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-xs font-medium text-muted">{t("country.none")}</div>
          )}
        </div>
      </div>
      {footer}
    </div>
  );
}

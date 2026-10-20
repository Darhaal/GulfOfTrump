"use client";

import { Building2, Handshake, Landmark, Swords, Users } from "lucide-react";
import type { ReactNode } from "react";
import { ui } from "@/components/ui/classes";
import { leaderName } from "@/i18n/leaders";
import { useI18n } from "@/i18n/useI18n";
import type { Accounts } from "@/engine/economy";
import { formatDate } from "@/engine/calendar";
import type { MessageKey } from "@/i18n/messages";
import Flag from "@/components/Flag";
import type { Alliance, CountryState, Domestic, ScenarioId, War } from "@/engine/types";
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
  /** Only what matters when choosing a country: no trade, resources or organisations. */
  brief?: boolean;
  /** The chance of a coup against its government, % a year (engine/abroad.ts). */
  coupRisk?: number;
  footer?: ReactNode;
}

/** A 0–100 figure as a bar, red when low. */
function Meter({ label, value, unit = "" }: { label: string; value: number; unit?: string }) {
  const tone = value < 30 ? "bg-red-500" : value < 45 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold text-muted">{label}</span>
        <span className="font-black tabular-nums text-ink">
          {Math.round(value)}
          {unit}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-divider">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

/** How another country is governed, as the engine keeps it: support, stability, the next election, the risk of a coup. */
function DomesticBlock({ d, coupRisk }: { d: Domestic; coupRisk?: number }) {
  const { t, locale } = useI18n();
  const level = coupRisk === undefined ? null : coupRisk < 2 ? "low" : coupRisk < 8 ? "elevated" : "high";
  return (
    <div className="flex flex-col gap-2.5 rounded-xl bg-page p-3">
      <div className="flex items-center justify-between gap-2">
        <div className={`${ui.label} flex items-center gap-1.5`}>
          <Landmark className="h-3.5 w-3.5" />
          {t("abroad.title")}
        </div>
        <span className="text-xs font-bold text-muted">{t(`abroad.regime.${d.regime}` as MessageKey)}</span>
      </div>
      <Meter label={t("abroad.support")} value={d.support} unit="%" />
      <Meter label={t("abroad.stability")} value={d.stability} />
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-bold text-muted">{t("abroad.election")}</span>
        <span className="text-right font-black text-ink">{d.nextElection ? formatDate(d.nextElection, locale) : t("abroad.noElection")}</span>
      </div>
      {level && (
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-bold text-muted">{t("abroad.coupRisk")}</span>
          <span className={`font-black ${level === "high" ? "text-red-600" : level === "elevated" ? "text-amber-600" : "text-ink"}`}>
            {t(`abroad.risk.${level}` as MessageKey, { n: coupRisk ?? 0 })}
          </span>
        </div>
      )}
      {d.changed ? (
        <p className="text-xs font-medium text-muted">{t(`abroad.changed.${d.changed.how}` as MessageKey, { date: formatDate(d.changed.date, locale) })}</p>
      ) : (
        d.lastElection && <p className="text-xs font-medium text-muted">{t("abroad.kept", { date: formatDate(d.lastElection.date, locale) })}</p>
      )}
    </div>
  );
}

/** Everything the player can know about one country at a glance. */
export default function CountryDetails({ country, scenario, regionCount, population, accounts, detailed, wars, alliances, countries, isPlayer, brief, coupRisk, footer }: CountryDetailsProps) {
  const { t, text, people, locale } = useI18n();
  const name = (tag: string) => text(countries[tag]?.name ?? tag);
  const enemies = [
    ...new Set(
      wars.flatMap((w) => (w.attackers.includes(country.tag) ? w.defenders : w.defenders.includes(country.tag) ? w.attackers : [])),
    ),
  ];
  const memberOf = alliances.filter((a) => a.members.includes(country.tag));
  const groups = [
    { key: "alliances", icon: Users, label: t("country.alliances"), blocs: memberOf.filter((a) => !a.kind || a.kind === "alliance") },
    { key: "pacts", icon: Handshake, label: t("country.pacts"), blocs: memberOf.filter((a) => a.kind === "pact") },
    ...(brief
      ? []
      : [{ key: "organisations", icon: Building2, label: t("country.organisations"), blocs: memberOf.filter((a) => a.kind === "organization" || a.kind === "trade") }]),
  ];

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
          <div className="mt-1 text-sm font-bold text-ink">{leaderName(country.leader, locale)}</div>
        </div>
      )}

      {country.domestic && !isPlayer && !brief && <DomesticBlock d={country.domestic} coupRisk={coupRisk} />}

      {country.economy && <EconomyPanel economy={country.economy} accounts={accounts} detailed={detailed} trade={!brief} />}

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
        {groups.map(({ key, icon: Icon, label, blocs }) => (
          <div key={key}>
            <div className={`${ui.label} mb-1.5 flex items-center gap-1.5`}>
              <Icon className="h-3.5 w-3.5" />
              {label}
            </div>
            {blocs.length ? (
              <div className="flex flex-wrap gap-1.5">
                {blocs.map((a) => (
                  <span key={a.id} className={ui.chip}>
                    {text(a.name)}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-xs font-medium text-muted">{t("country.none")}</div>
            )}
          </div>
        ))}
      </div>
      {footer}
    </div>
  );
}

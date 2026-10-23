"use client";

import { BookOpen, Building2, Coins, Crosshair, Eye, Handshake, Landmark, MapPin, Swords, Users, type LucideIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { ui } from "@/components/ui/classes";
import { leaderName } from "@/i18n/leaders";
import { useI18n } from "@/i18n/useI18n";
import type { Accounts } from "@/engine/economy";
import { formatDate } from "@/engine/calendar";
import { coupLevel, type Estimate, type ForeignView, type KnowledgeLevel } from "@/engine/fog";
import type { MessageKey } from "@/i18n/messages";
import Flag from "@/components/Flag";
import { LAW_IDS, type Laws } from "@/engine/laws";
import { WEAPON_KINDS, type Alliance, type CountryState, type Domestic, type Plan, type ScenarioId, type War } from "@/engine/types";
import { ARMS_ICONS } from "./armsText";
import CourseBlock from "./CourseBlock";
import EconomyPanel from "./EconomyPanel";
import { shown } from "./estimate";
import RulersRow from "./RulersRow";

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
  /** Other governments' plans, for its foreign course (engine/intentions.ts). */
  plans?: Plan[];
  /** The player's country, for the plans aimed at it. */
  player?: string;
  /** Under fog of war, what the player's government knows of this foreign country (engine/fog.ts); without it the figures are true. */
  view?: ForeignView;
  /** The laws in force: the player's own country's, null while they are not described yet; other countries have none to show. */
  laws?: Laws | null;
  /** The selected province's details, shown as the panel's first section; and its id, to open that section when it changes. */
  province?: ReactNode;
  provinceKey?: string | null;
  footer?: ReactNode;
}

type Section = "province" | "power" | "economy" | "army" | "laws";

const toneOf = (value: number) => (value < 30 ? "bg-red-500" : value < 45 ? "bg-amber-500" : "bg-emerald-500");

/** A 0–100 figure as a bar, red when low; an estimate shows its range as a faint band, an unknown one says so. */
function Meter({ label, value, unit = "", estimate, level, unknown }: { label: string; value: number; unit?: string; estimate?: Estimate; level?: KnowledgeLevel; unknown?: boolean }) {
  const { t } = useI18n();
  const shownValue = estimate?.value ?? value;
  const range = estimate && level && !estimate.exact && level !== "full" && level !== "good";
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold text-muted">{label}</span>
        <span className={`font-black tabular-nums ${unknown ? "text-muted" : "text-ink"}`}>
          {unknown ? t("fog.unknown") : estimate && level ? shown(estimate, level, (n) => `${Math.round(n)}${unit}`) : `${Math.round(value)}${unit}`}
        </span>
      </div>
      <div className="relative mt-1 h-1.5 overflow-hidden rounded-full bg-divider">
        {unknown ? null : range ? (
          <div
            className={`absolute inset-y-0 rounded-full opacity-40 ${toneOf(shownValue)}`}
            style={{ left: `${Math.max(0, estimate.low)}%`, width: `${Math.max(2, Math.min(100, estimate.high) - Math.max(0, estimate.low))}%` }}
          />
        ) : (
          <div className={`h-full rounded-full ${toneOf(shownValue)}`} style={{ width: `${Math.max(2, Math.min(100, shownValue))}%` }} />
        )}
      </div>
    </div>
  );
}

/** How much the player's government knows of the country, and why. */
function KnowledgeNote({ view }: { view: ForeignView }) {
  const { t } = useI18n();
  const { level, reasons } = view.knowledge;
  const tone = level === "poor" ? "text-red-700" : level === "partial" ? "text-amber-700" : "text-emerald-700";
  return (
    <div className="flex items-start gap-2 rounded-xl bg-page px-3 py-2 text-xs">
      <Eye className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${tone}`} />
      <div className="min-w-0">
        <div className={`font-black ${tone}`}>{t(`fog.level.${level}` as MessageKey)}</div>
        <div className="font-medium text-muted">
          {[t("fog.note"), ...reasons.slice(0, 3).map((r) => t(`fog.why.${r}` as MessageKey))].join(" · ")}
        </div>
      </div>
    </div>
  );
}

/** How another country is governed, as the engine keeps it: support, stability, the next election, the risk of a coup. Under fog of war, as far as the player's government knows it. */
function DomesticBlock({ d, coupRisk, view }: { d: Domestic; coupRisk?: number; view?: ForeignView }) {
  const { t, locale } = useI18n();
  // No risk where no coup can happen; under fog of war, the risk as far as it is known.
  const coup = coupRisk === undefined ? null : view ? (view.coup ?? "unknown") : { level: coupLevel(coupRisk), n: coupRisk, rumour: false };
  const knowledge = view?.knowledge.level;
  return (
    <div className="flex flex-col gap-2.5 rounded-xl bg-page p-3">
      <div className="flex items-center justify-between gap-2">
        <div className={`${ui.label} flex items-center gap-1.5`}>
          <Landmark className="h-3.5 w-3.5" />
          {t("abroad.title")}
        </div>
        <span className="text-xs font-bold text-muted">{t(`abroad.regime.${d.regime}` as MessageKey)}</span>
      </div>
      <Meter label={t("abroad.support")} value={d.support} unit="%" estimate={view?.support} level={knowledge} unknown={Boolean(view && !view.support)} />
      <Meter label={t("abroad.stability")} value={d.stability} estimate={view?.stability} level={knowledge} unknown={Boolean(view && !view.stability)} />
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-bold text-muted">{t("abroad.election")}</span>
        <span className="text-right font-black text-ink">{d.nextElection ? formatDate(d.nextElection, locale) : t("abroad.noElection")}</span>
      </div>
      {coup && (
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-bold text-muted">{t("abroad.coupRisk")}</span>
          {coup === "unknown" ? (
            <span className="font-black text-muted">{t("fog.noInfo")}</span>
          ) : (
            <span className={`font-black ${coup.level === "high" ? "text-red-600" : coup.level === "elevated" ? "text-amber-600" : "text-ink"}`}>
              {coup.rumour ? t("fog.rumour", { level: t(`fog.risk.${coup.level}` as MessageKey) }) : t(`abroad.risk.${coup.level}` as MessageKey, { n: coup.n ?? 0 })}
            </span>
          )}
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

/** Everything the player can know about one country at a glance: in the game, in sections the player switches between. */
export default function CountryDetails({ country, scenario, regionCount, population, accounts, detailed, wars, alliances, countries, isPlayer, brief, coupRisk, view, plans, player, laws, province, provinceKey, footer }: CountryDetailsProps) {
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

  // A newly chosen province opens its section; a click on the sea closes it.
  const [section, setSection] = useState<Section>(province ? "province" : "power");
  const [seen, setSeen] = useState(provinceKey ?? null);
  if ((provinceKey ?? null) !== seen) {
    setSeen(provinceKey ?? null);
    setSection(provinceKey ? "province" : "power");
  }
  const sections: { id: Section; label: string; icon: LucideIcon }[] = [
    ...(province ? [{ id: "province" as const, label: t("country.section.province"), icon: MapPin }] : []),
    { id: "power", label: t("country.section.power"), icon: Landmark },
    { id: "economy", label: t("country.section.economy"), icon: Coins },
    { id: "army", label: t("country.section.army"), icon: Crosshair },
    ...(laws !== undefined ? [{ id: "laws" as const, label: t("country.section.laws"), icon: BookOpen }] : []),
  ];
  const current: Section = sections.some((x) => x.id === section) ? section : "power";

  const blocList = ({ key, icon: Icon, label, blocs }: (typeof groups)[number]) => (
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
  );

  const warList = (
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
  );

  const leader = country.leader && (
    <div className="rounded-xl bg-page p-3">
      <div className={ui.label}>{t("country.leader")}</div>
      <RulersRow country={country} scenario={scenario} />
      <div className="mt-1 text-sm font-bold text-ink">{leaderName(country.leader, locale)}</div>
    </div>
  );

  const economy = country.economy && (
    <EconomyPanel
      economy={country.economy}
      accounts={accounts}
      detailed={detailed}
      trade={!brief}
      estimates={view && !isPlayer ? { level: view.knowledge.level, gdp: view.gdp, growth: view.growth, debt: view.debt, troops: view.troops } : undefined}
    />
  );

  const land = (
    <>
      <div className="flex items-center justify-between rounded-xl bg-page px-3 py-2">
        <span className="text-xs font-bold text-muted">{t("country.regions")}</span>
        <span className="font-black tabular-nums text-ink">{regionCount || (country.dormant ? "–" : 0)}</span>
      </div>
      {population !== undefined && regionCount > 0 && (
        <div className="flex items-center justify-between rounded-xl bg-page px-3 py-2">
          <span className="text-xs font-bold text-muted">{t("country.population")}</span>
          <span className="font-black tabular-nums text-ink">{people(population)}</span>
        </div>
      )}
      {country.dormant && regionCount === 0 && <p className="text-xs font-medium text-muted">{t("pick.noLand")}</p>}
    </>
  );

  const header = (
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
  );

  // Choosing a country: everything at once, as before.
  if (brief) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        {leader}
        {economy}
        <div className="grid grid-cols-1 gap-3 text-sm">
          {land}
          {warList}
          {groups.map(blocList)}
        </div>
        {footer}
      </div>
    );
  }

  // Its weapons: the player's own, or another's where nothing hides them.
  const arsenal = country.arsenal && (isPlayer || !view) ? WEAPON_KINDS.filter((k) => (country.arsenal!.stock[k]?.n ?? 0) > 0) : [];
  const troops = country.economy ? (view && !isPlayer && view.troops ? shown(view.troops, view.knowledge.level, (n) => people(n)) : people(country.economy.troops)) : null;

  return (
    <div className="flex flex-col gap-4">
      {header}

      {view && !isPlayer && <KnowledgeNote view={view} />}

      <div className="grid gap-0.5 rounded-xl bg-page p-1" style={{ gridTemplateColumns: `repeat(${sections.length}, minmax(0, 1fr))` }} role="tablist">
        {sections.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            onClick={() => setSection(id)}
            aria-selected={current === id}
            title={label}
            className={`flex min-w-0 flex-col items-center gap-0.5 rounded-lg px-0.5 py-1.5 text-[10px] font-bold tracking-tight transition-all ${current === id ? `${ui.segmentOn} bg-surface shadow-sm` : ui.segmentOff}`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="w-full truncate text-center">{label}</span>
          </button>
        ))}
      </div>

      {current === "province" && province}

      {current === "power" && (
        <div className="flex flex-col gap-4">
          {leader}
          {country.domestic && !isPlayer && <DomesticBlock d={country.domestic} coupRisk={coupRisk} view={view} />}
          {plans && player && <CourseBlock country={country} countries={countries} plans={plans} player={player} />}
          {groups.filter((g) => g.key === "organisations").map(blocList)}
        </div>
      )}

      {current === "economy" && (
        <div className="flex flex-col gap-3 text-sm">
          {economy}
          {land}
        </div>
      )}

      {current === "army" && (
        <div className="flex flex-col gap-3 text-sm">
          {troops && (
            <div className="flex items-center justify-between rounded-xl bg-page px-3 py-2">
              <span className="text-xs font-bold text-muted">{t("economy.troops")}</span>
              <span className="font-black tabular-nums text-ink">{troops}</span>
            </div>
          )}
          {arsenal.length > 0 && (
            <ul className="grid grid-cols-2 gap-1.5">
              {arsenal.map((k) => {
                const Icon = ARMS_ICONS[k];
                return (
                  <li key={k} className="flex items-center justify-between gap-2 rounded-lg bg-page px-2.5 py-1.5">
                    <span className="flex min-w-0 items-center gap-1.5 text-2xs font-bold text-muted">
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{t(`arms.kind.${k}` as MessageKey)}</span>
                    </span>
                    <span className="text-xs font-black tabular-nums text-ink">{country.arsenal!.stock[k]!.n.toLocaleString(locale)}</span>
                  </li>
                );
              })}
            </ul>
          )}
          {warList}
          {groups.filter((g) => g.key !== "organisations").map(blocList)}
        </div>
      )}

      {current === "laws" && (
        <div className="flex flex-col gap-1.5">
          {laws ? (
            <ul className="grid gap-1">
              {LAW_IDS.map((id) => (
                <li key={id} title={t(`law.${id}.about` as MessageKey)} className="flex items-baseline justify-between gap-3 rounded-lg bg-page px-3 py-2">
                  <span className="text-xs font-bold text-muted">{t(`law.${id}` as MessageKey)}</span>
                  <span className="text-right text-xs font-black text-ink">{laws[id] ? t(`law.${id}.${laws[id]}` as MessageKey) : "–"}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs font-medium text-muted">{t("politics.lawsUnknown")}</p>
          )}
        </div>
      )}

      {footer}
    </div>
  );
}

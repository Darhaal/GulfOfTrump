"use client";

import { Compass } from "lucide-react";
import type { ReactNode } from "react";
import { ui } from "@/components/ui/classes";
import { formatDate } from "@/engine/calendar";
import { planLadder, shownStage } from "@/engine/intentions";
import { planKindKey, planStageKey } from "./changes";
import type { CountryState, Plan, Tie } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";

const MONTH_LOCALE = { en: "en-GB", ru: "ru-RU", uk: "uk-UA" } as const;

/** How warm a tie is, from its trust. */
const warmth = (t: Tie) => (t.trust >= 50 ? "close" : t.trust >= 20 ? "friendly" : t.trust <= -50 ? "hostile" : t.trust <= -20 ? "wary" : "neutral");
const WARMTH_TONE: Record<string, string> = { close: "text-emerald-600", friendly: "text-emerald-600", neutral: "text-muted", wary: "text-amber-600", hostile: "text-red-600" };

/**
 * A government's foreign course as the engine keeps it (engine/relations.ts,
 * engine/intentions.ts): its appetite for force, how far it looks abroad,
 * what it wants, the plans it pursues in the open, how it sees the countries
 * that matter to it and what it remembers of them. On the player's own
 * country: the plans aimed at it and how the powers see it. A plan's secret
 * decision is never shown.
 */
export default function CourseBlock({ country, countries, plans, player }: { country: CountryState; countries: Record<string, CountryState>; plans: Plan[]; player: string }) {
  const { t, text, locale } = useI18n();
  const month = (iso: string) => new Intl.DateTimeFormat(MONTH_LOCALE[locale], { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
  const chip = (tag: string) => (
    <span key={tag} className="inline-flex min-w-0 items-center gap-1 rounded-md sheet px-1.5 py-0.5 text-2xs font-bold text-ink">
      <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: countries[tag]?.color }} />
      <span className="truncate">{text(countries[tag]?.name ?? tag)}</span>
    </span>
  );
  const section = (label: string, body: ReactNode) => (
    <div>
      <div className={`${ui.label} mb-1.5`}>{label}</div>
      {body}
    </div>
  );
  const planRow = (p: Plan, who: string) => {
    const stage = shownStage(p)!;
    const ladder = planLadder(p.kind);
    const reached = ladder.indexOf(stage);
    return (
      <li key={p.id} className="grid gap-1">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="font-bold text-ink">{t(planKindKey(p))}</span>
          {chip(who)}
          <span className="font-medium text-muted">{t(planStageKey(p, stage))}</span>
        </div>
        <div className="flex gap-1" aria-hidden>
          {ladder.map((s, i) => (
            <span key={s} className={`h-1 flex-1 rounded-full ${i <= reached ? "bg-accent" : "bg-divider"}`} />
          ))}
        </div>
      </li>
    );
  };
  const live = plans.filter((p) => !p.end && shownStage(p));

  if (country.tag === player) {
    const against = live.filter((p) => p.target === player);
    const seen = Object.values(countries)
      .filter((c) => c.course?.ties[player])
      .sort((a, b) => (b.economy?.gdp ?? 0) - (a.economy?.gdp ?? 0))
      .slice(0, 5);
    if (!against.length && !seen.length) return null;
    return (
      <div className="flex flex-col gap-3 rounded-xl bg-page p-3">
        <div className={`${ui.label} flex items-center gap-1.5`}>
          <Compass className="h-3.5 w-3.5" />
          {t("course.title")}
        </div>
        {section(t("course.against"), against.length ? <ul className="grid gap-2">{against.map((p) => planRow(p, p.by))}</ul> : <p className="text-xs font-medium text-muted">{t("course.none")}</p>)}
        {seen.length > 0 &&
          section(
            t("course.view"),
            <ul className="grid gap-1">
              {seen.map((c) => {
                const tie = c.course!.ties[player];
                const w = warmth(tie);
                return (
                  <li key={c.tag} className="flex items-center justify-between gap-2 text-xs">
                    {chip(c.tag)}
                    <span className={`text-right font-bold ${WARMTH_TONE[w]}`}>
                      {t(`tie.${w}` as MessageKey)}
                      {tie.threat >= 50 ? ` · ${t("course.threat")}` : ""}
                    </span>
                  </li>
                );
              })}
            </ul>,
          )}
      </div>
    );
  }

  const course = country.course;
  if (!course) return null;
  const hawk = course.hawk >= 60 ? "high" : course.hawk <= 40 ? "low" : "mid";
  const reach = course.reach >= 65 ? "high" : course.reach < 30 ? "low" : null;
  const own = live.filter((p) => p.by === country.tag);
  const ties = Object.entries(course.ties)
    .sort((a, b) => b[1].threat + Math.abs(b[1].trust) - (a[1].threat + Math.abs(a[1].trust)))
    .slice(0, 4);
  const deeds = [...course.memory].reverse().slice(0, 3);

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-page p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className={`${ui.label} flex items-center gap-1.5`}>
          <Compass className="h-3.5 w-3.5" />
          {t("course.title")}
        </div>
        <span className="text-right text-xs font-bold text-muted">
          {t(`course.hawk.${hawk}` as MessageKey)}
          {reach ? ` · ${t(`course.reach.${reach}` as MessageKey)}` : ""}
        </span>
      </div>
      {course.set.how !== "start" && <p className="text-xs font-medium text-muted">{t(`course.since.${course.set.how}` as MessageKey, { date: formatDate(course.set.date, locale) })}</p>}
      {course.aims.length > 0 &&
        section(
          t("course.aims"),
          <ul className="grid gap-1">
            {course.aims.map((a) => (
              <li key={`${a.kind}:${a.target ?? ""}`} className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="font-bold text-ink">{t(`aim.${a.kind}` as MessageKey)}</span>
                {a.target && chip(a.target)}
              </li>
            ))}
          </ul>,
        )}
      {own.length > 0 && section(t("course.plans"), <ul className="grid gap-2">{own.map((p) => planRow(p, p.target ?? p.partners?.[0] ?? p.by))}</ul>)}
      {ties.length > 0 &&
        section(
          t("course.ties"),
          <ul className="grid gap-1">
            {ties.map(([tag, tie]) => {
              const w = warmth(tie);
              return (
                <li key={tag} className="flex items-center justify-between gap-2 text-xs">
                  {chip(tag)}
                  <span className={`text-right font-bold ${WARMTH_TONE[w]}`}>
                    {t(`tie.${w}` as MessageKey)}
                    {tie.threat >= 50 ? ` · ${t("course.threat")}` : ""}
                  </span>
                </li>
              );
            })}
          </ul>,
        )}
      {deeds.length > 0 &&
        section(
          t("course.memory"),
          <ul className="grid gap-1">
            {deeds.map((d, i) => (
              <li key={`${i}:${d.by}:${d.what}`} className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className={`font-bold ${d.weight < 0 ? "text-red-600" : "text-emerald-600"}`}>{t(`deed.${d.what}` as MessageKey)}</span>
                {chip(d.by)}
                <span className="font-medium tabular-nums text-muted">{month(d.date)}</span>
              </li>
            ))}
          </ul>,
        )}
    </div>
  );
}

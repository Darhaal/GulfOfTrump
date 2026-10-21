"use client";

import { MessageCircle, Pause, Play } from "lucide-react";
import { ui } from "@/components/ui/classes";
import { yearOf } from "@/engine/calendar";
import { officialAt } from "@/engine/government";
import { availableProjects, funding, MAX_RESEARCH, projectOf, type Project, yearlyCost } from "@/engine/research";
import type { GameState } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import { projectIcon, projectLabel } from "./armsText";

interface SciencePanelProps {
  state: GameState;
  disabled: boolean;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onConsult: () => void;
}

/**
 * The player's research: the money it gets from the army and industry
 * budgets, the projects under way with their progress, the ones that can be
 * started now, and what the country already has ahead of history.
 */
export default function SciencePanel({ state, disabled, onStart, onStop, onConsult }: SciencePanelProps) {
  const { t, text, money, locale } = useI18n();
  const research = state.research ?? { active: [], done: [] };
  const gdp = state.countries[state.player]?.economy?.gdp ?? 0;
  const pools = funding(state);
  const running = research.active.filter((p) => p.on).length;
  const open = availableProjects(state);
  const now = yearOf(state.date);
  const pace = 0.7 + 0.1 * (officialAt(state, "science")?.competence ?? 3);
  const label = (id: string) => projectLabel(id, state, t, text);

  const effect = (p: Project) => {
    if (p.gen) return t("research.effect.gen", { kind: t(`arms.kind.${p.gen.kind}` as MessageKey), level: p.gen.level });
    const parts = [text(p.effect)];
    if (p.growth) parts.push(t("research.effect.growth", { n: p.growth.toLocaleString(locale) }));
    return parts.join(" · ");
  };
  const when = (p: Project) => (p.year > now ? t("research.ahead", { year: Math.floor(p.year), n: Math.max(1, Math.round(p.year - now)) }) : t("research.history", { year: Math.floor(p.year) }));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs font-medium leading-relaxed text-muted">{t("research.intro")}</p>

      <div className="grid gap-1.5 rounded-xl bg-page p-3 text-xs font-medium text-muted">
        {(["military", "civil"] as const).map((field) => (
          <div key={field} className="flex items-baseline justify-between gap-2">
            <span>{t(`research.pool.${field}` as MessageKey, { money: money(pools[field].pool) })}</span>
            <span className={`shrink-0 font-black tabular-nums ${pools[field].share < 1 ? "text-amber-700" : "text-ink"}`}>
              {pools[field].spend > 0 ? t("research.funded", { n: Math.round(pools[field].share * 100) }) : "—"}
            </span>
          </div>
        ))}
      </div>

      <div>
        <span className={`${ui.label} mb-1.5 block`}>{t("research.active", { n: running, max: MAX_RESEARCH })}</span>
        {research.active.length === 0 && <p className="text-xs font-medium text-muted">{t("research.noneActive")}</p>}
        <ul className="flex flex-col gap-2">
          {research.active.map((a) => {
            const p = projectOf(state, a.id);
            if (!p) return null;
            const Icon = projectIcon(a.id);
            const share = pools[p.field].share;
            const left = a.on && share > 0 ? Math.ceil(((1 - a.progress) * p.months) / (share * pace)) : null;
            return (
              <li key={a.id} className={`${ui.card} p-3`}>
                <div className="flex items-start gap-2.5">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-ink">{label(a.id)}</div>
                    <div className="text-2xs font-medium text-muted">{effect(p)}</div>
                  </div>
                  <button
                    type="button"
                    disabled={disabled || (!a.on && running >= MAX_RESEARCH)}
                    onClick={() => (a.on ? onStop(a.id) : onStart(a.id))}
                    title={t(a.on ? "research.stop" : "research.resume")}
                    aria-label={t(a.on ? "research.stop" : "research.resume")}
                    className={`${ui.iconButton} p-1.5`}
                  >
                    {a.on ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-divider">
                  <div className={`h-full ${a.on ? "bg-accent" : "bg-muted"}`} style={{ width: `${Math.round(a.progress * 100)}%` }} />
                </div>
                <div className="mt-1 flex flex-wrap justify-between gap-x-2 text-2xs font-bold tabular-nums text-muted">
                  <span>{Math.round(a.progress * 100)}%</span>
                  <span>{a.on ? (left !== null ? t("research.left", { n: left }) : t("research.unfunded")) : t("research.paused")}</span>
                  <span>{t("research.cost", { money: money(yearlyCost(p, gdp)) })}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <span className={`${ui.label} mb-1.5 block`}>{t("research.open")}</span>
        {open.length === 0 && <p className="text-xs font-medium text-muted">{t("research.nothing")}</p>}
        {(["military", "civil"] as const).map((field) => {
          const list = open.filter((p) => p.field === field);
          if (!list.length) return null;
          return (
            <div key={field} className="mb-3">
              <div className="mb-1 text-2xs font-black text-muted">{t(`research.field.${field}` as MessageKey)}</div>
              <ul className="flex flex-col gap-1.5">
                {list.map((p) => {
                  const Icon = projectIcon(p.id);
                  return (
                    <li key={p.id} className="flex items-start gap-2.5 rounded-xl border border-line bg-surface px-3 py-2">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-ink">{label(p.id)}</div>
                        <div className="text-2xs font-medium text-muted">{effect(p)}</div>
                        <div className="mt-0.5 text-2xs font-bold tabular-nums text-muted">
                          {when(p)} · {t("research.months", { n: p.months })} · {t("research.cost", { money: money(yearlyCost(p, gdp)) })}
                        </div>
                      </div>
                      <button type="button" disabled={disabled || running >= MAX_RESEARCH} onClick={() => onStart(p.id)} className={`${ui.secondary} shrink-0 px-2.5 py-1.5 text-2xs`}>
                        {t("research.start")}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
        {running >= MAX_RESEARCH && <p className="text-2xs font-medium text-muted">{t("research.max", { n: MAX_RESEARCH })}</p>}
      </div>

      {research.done.length > 0 && (
        <div>
          <span className={`${ui.label} mb-1.5 block`}>{t("research.done")}</span>
          <ul className="flex flex-col gap-1 text-xs font-medium text-ink">
            {research.done.map((d) => (
              <li key={d.id} className="flex justify-between gap-2">
                <span className="truncate">{label(d.id)}</span>
                <span className="shrink-0 text-2xs font-bold text-muted">{d.date}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button type="button" onClick={onConsult} className={`${ui.secondary} px-4 py-2.5 text-xs`}>
        <MessageCircle className="h-4 w-4" />
        {t("research.ask")}
      </button>
    </div>
  );
}

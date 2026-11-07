"use client";

import { Minus, Plus, Rocket } from "lucide-react";
import { ui } from "@/components/ui/classes";
import { countryName } from "@/engine/names";
import { MILESTONES, MAX_SHARE, programmeView, setSpaceFocus, setSpaceShare, sitesOf } from "@/engine/space";
import { SPACE_FOCUSES, type GameState, type SpaceFocus, type SpaceMilestone } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";

interface SpacePanelProps {
  state: GameState;
  disabled: boolean;
  onState: (next: GameState) => void;
}

/** Points a click on the stepper moves the programme's share. */
const STEP = 5;
/** Rockets exist from this year: before it a programme with no money is not shown. */
const ROCKETS_FROM = 1944;

/**
 * The player's space programme under the research directions: its share of
 * the research money and what it puts first, the next feats with their work
 * and when they could fly, what it has made (and which were the world's
 * first), the launch sites it can use, and the world's firsts. The head of
 * the programme answers in the advisor strip above, beside the science
 * minister (engine/space.ts).
 */
export default function SpacePanel({ state, disabled, onState }: SpacePanelProps) {
  const { t, text, locale, money } = useI18n();
  const view = programmeView(state, state.player);
  if (!view) return null;
  if (Number(state.date.slice(0, 4)) < ROCKETS_FROM && view.share <= 0 && !view.done.length) return null;
  const feat = (m: SpaceMilestone) => text(MILESTONES[m].name);
  const country = (tag: string) => text(state.countries[tag]?.name ?? countryName(tag) ?? tag);
  const firsts = state.space?.firsts ?? {};
  const coming = sitesOf(state, { coming: true }).filter((s) => s.opens && s.holder === state.player);
  const year = (y: number) => Math.floor(y).toLocaleString(locale, { useGrouping: false });

  return (
    <section className="flex flex-col gap-2">
      <span className={`${ui.label} flex cursor-help items-center gap-1.5`} title={t("space.hint")}>
        <Rocket className="h-3.5 w-3.5" />
        {t("space.title")}
      </span>

      <div className={`${ui.card} flex flex-col gap-2 p-3`}>
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 text-2xs font-bold tabular-nums text-ink">{t("space.share", { n: view.share, value: money(view.money) })}</span>
          <button
            type="button"
            disabled={disabled || view.share <= 0}
            onClick={() => onState(setSpaceShare(state, view.share - STEP))}
            title={t("space.less", { n: STEP })}
            aria-label={t("space.less", { n: STEP })}
            className={`${ui.iconButton} p-1 disabled:opacity-40`}
          >
            <Minus className="h-3 w-3" />
          </button>
          <button
            type="button"
            disabled={disabled || view.share >= MAX_SHARE}
            onClick={() => onState(setSpaceShare(state, view.share + STEP))}
            title={t("space.more", { n: STEP })}
            aria-label={t("space.more", { n: STEP })}
            className={`${ui.iconButton} p-1 disabled:opacity-40`}
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1 rounded-xl bg-page p-1" role="radiogroup" aria-label={t("space.focus")}>
          {SPACE_FOCUSES.map((f: SpaceFocus) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={view.focus === f}
              disabled={disabled}
              onClick={() => onState(setSpaceFocus(state, f))}
              className={`rounded-lg px-1 py-1 text-2xs font-bold transition-all ${view.focus === f ? `${ui.segmentOn} bg-surface shadow-sm` : ui.segmentOff}`}
            >
              {t(`space.focus.${f}` as MessageKey)}
            </button>
          ))}
        </div>

        <p className="text-2xs font-medium tabular-nums text-muted">
          {t("space.level", { year: year(view.level), pace: t("research.pace", { n: view.rate.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) }) })}
        </p>
        {view.share <= 0 && <p className="text-2xs font-bold text-muted">{t("space.off")}</p>}
        {view.rockets && <p className="text-2xs font-bold text-amber-700">{t("space.rockets")}</p>}
        {!view.sites.length && <p className="text-2xs font-bold text-amber-700">{t("space.noSites")}</p>}

        {view.next.length > 0 && (
          <div className="flex flex-col gap-1.5 border-t border-divider pt-2">
            <span className={ui.label}>{t("space.next")}</span>
            {view.next.slice(0, 3).map((f) => (
              <div key={f.id}>
                <div className="flex items-baseline justify-between gap-2 text-2xs font-bold">
                  <span className="min-w-0 flex-1 text-ink" title={text(MILESTONES[f.id].effect)}>
                    {feat(f.id)}
                    {!firsts[f.id] && <span className="font-medium text-accent"> · {t("space.first")}</span>}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted">{f.expected ? t("space.expected", { year: year(f.expected) }) : t("space.stalled")}</span>
                </div>
                <div className="mt-1 flex h-1 overflow-hidden rounded-full bg-divider" title={t("space.work", { n: Math.round(f.work * 100) })}>
                  <div className="h-full bg-accent" style={{ width: `${Math.round(f.work * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-1 border-t border-divider pt-2">
          <span className={ui.label}>{t("space.achieved")}</span>
          {view.done.length === 0 && <p className="text-2xs font-medium text-muted">{t("space.none")}</p>}
          {[...view.done].reverse().map((d) => (
            <div key={d.id} className="flex items-baseline justify-between gap-2 text-2xs font-medium text-ink">
              <span className="min-w-0 flex-1">
                {feat(d.id)}
                {firsts[d.id]?.by === state.player && <span className="font-bold text-accent"> · {t("space.first")}</span>}
              </span>
              <span className="shrink-0 tabular-nums text-muted">{d.date.slice(0, 7)}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-1 border-t border-divider pt-2">
          <span className={ui.label}>{t("space.sites")}</span>
          <p className="text-2xs font-medium text-ink">
            {view.sites.map((s) => (typeof s.name === "string" ? s.name : text(s.name))).join(", ") || "–"}
            {coming.map((s) => (
              <span key={s.id} className="text-muted">
                {" · "}
                {typeof s.name === "string" ? s.name : text(s.name)} ({t("space.coming", { date: s.opens!.slice(0, 7) })})
              </span>
            ))}
          </p>
        </div>

        {Object.keys(firsts).length > 0 && (
          <div className="flex flex-col gap-1 border-t border-divider pt-2">
            <span className={ui.label}>{t("space.firsts")}</span>
            {(Object.entries(firsts) as [SpaceMilestone, { by: string; date: string }][])
              .sort((a, b) => a[1].date.localeCompare(b[1].date))
              .map(([m, f]) => (
                <div key={m} className="flex items-baseline justify-between gap-2 text-2xs font-medium text-ink">
                  <span className="min-w-0 flex-1">{feat(m)}</span>
                  <span className="shrink-0 tabular-nums text-muted">
                    {country(f.by)} · {f.date.slice(0, 4)}
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>
    </section>
  );
}

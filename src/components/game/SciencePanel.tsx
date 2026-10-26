"use client";

import { Minus, Plus } from "lucide-react";
import { ui } from "@/components/ui/classes";
import { BOMB_SHARE, bombStatus, breakthroughOf, directionView, researchMoney, scienceBoost, shiftShares, startingResearch } from "@/engine/research";
import { armsEfficiency, communicationsOutput, harvestBonus, industryOutput, intelligenceBonus, medicineBonus, populationBonus, techYear, yearFraction } from "@/engine/researchEffects";
import { RESEARCH_DIRECTIONS, type GameState, type ResearchDirection } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import { DIRECTION_ICONS, researchLabel, versusText } from "./armsText";

interface SciencePanelProps {
  state: GameState;
  disabled: boolean;
  onShares: (shares: Record<ResearchDirection, number>) => void;
}

/** Points a click on a direction's stepper moves its share. */
const STEP = 5;

/**
 * The player's research: each direction with its share, the year of
 * technology it has reached, the next breakthrough and when it comes against
 * history, and what it gives now; then the breakthroughs this game has made.
 * The science minister speaks in the advisor strip above it, when asked.
 */
export default function SciencePanel({ state, disabled, onShares }: SciencePanelProps) {
  const i18n = useI18n();
  const { t, text, locale } = i18n;
  const view = state.research?.shares ? state : { ...state, research: startingResearch(state) };
  const shares = view.research!.shares;
  const bomb = bombStatus(view);
  const dir = (d: ResearchDirection) => t(`research.dir.${d}` as MessageKey);

  const signed = (n: number, digits = 0, unit = "") => `${n >= 0 ? "+" : "−"}${Math.abs(n).toLocaleString(locale, { maximumFractionDigits: digits, minimumFractionDigits: digits })}${unit}`;
  const pct = (n: number) => signed(Math.round(n * 100), 0, "%");
  const pct1 = (n: number) => signed(Math.round(n * 1000) / 10, 1, "%");

  const effect = (d: ResearchDirection): string => {
    switch (d) {
      case "military":
        return t("research.effect.military", { year: Math.floor(techYear(view, d)) });
      case "industry":
        return t("research.effect.industry", { growth: pct1(industryOutput(view)), arms: pct(armsEfficiency(view) - 1) });
      case "agriculture":
        return t("research.effect.agriculture", { n: pct(harvestBonus(view)) });
      case "medicine":
        return t("research.effect.medicine", { n: pct(medicineBonus(view)), m: signed(populationBonus(view), 2) });
      case "science":
        return t("research.effect.science", { n: pct(scienceBoost(view) - 1) });
      case "communications":
        return t("research.effect.communications", { n: signed(intelligenceBonus(view)), m: pct1(communicationsOutput(view)) });
      case "strategic":
        return t("research.effect.strategic", { year: Math.floor(techYear(view, d)) });
    }
  };

  const done = [...(view.research!.done ?? [])].reverse();
  const funds = researchMoney(view);
  const { money } = i18n;

  return (
    <div className="flex flex-col gap-4">
      {funds.pool > 0 && (
        <p className="cursor-help text-2xs font-bold tabular-nums text-muted" title={t("research.moneyHint")}>
          {t("research.money", { value: money(funds.pool), n: (Math.round((funds.pool / Math.max(0.0001, funds.usual)) * 10) / 10).toLocaleString(locale) })}
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {RESEARCH_DIRECTIONS.map((d) => {
          const v = directionView(view, d);
          const Icon = DIRECTION_ICONS[d];
          const lead = Math.round(Math.abs(v.ahead) * 10) / 10;
          const standing = v.ahead >= 0.5 ? t("research.aheadBy", { n: lead.toLocaleString(locale) }) : v.ahead <= -0.5 ? t("research.behindBy", { n: lead.toLocaleString(locale) }) : t("research.onPace");
          return (
            <li key={d} className={`${ui.card} p-3`}>
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 shrink-0 text-muted" />
                <span className="min-w-0 flex-1 text-xs font-bold leading-tight text-ink">{dir(d)}</span>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    disabled={disabled || shares[d] <= 0}
                    onClick={() => onShares(shiftShares(shares, d, -STEP))}
                    title={t("research.less", { n: STEP })}
                    aria-label={t("research.less", { n: STEP })}
                    className={`${ui.iconButton} p-1 disabled:opacity-40`}
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-9 text-center text-xs font-black tabular-nums text-ink">{shares[d]}%</span>
                  <button
                    type="button"
                    disabled={disabled || shares[d] >= 100}
                    onClick={() => onShares(shiftShares(shares, d, STEP))}
                    title={t("research.more", { n: STEP })}
                    aria-label={t("research.more", { n: STEP })}
                    className={`${ui.iconButton} p-1 disabled:opacity-40`}
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>

              <div className="mt-1.5 flex items-baseline justify-between gap-2 text-2xs font-bold tabular-nums">
                <span className="text-muted">
                  {t("research.reached", { year: Math.floor(v.tech) })} ·{" "}
                  <span className="cursor-help underline decoration-dotted decoration-1 underline-offset-2" title={t("research.paceHint")}>
                    {t("research.pace", { n: (Math.round(v.rate * 10) / 10).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) })}
                  </span>
                </span>
                <span className={v.ahead >= 0.5 ? "text-accent" : v.ahead <= -0.5 ? "text-amber-700" : "text-muted"}>{standing}</span>
              </div>

              {v.next ? (
                <>
                  <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-divider">
                    <div className="h-full bg-accent" style={{ width: `${Math.round(v.progress * 100)}%` }} />
                  </div>
                  <div className="mt-1 text-2xs font-bold text-ink">{t("research.next", { name: text(v.next.name) })}</div>
                  <div className="text-2xs font-medium tabular-nums text-muted">
                    {t("research.expected", { year: Math.round(v.expected!) })} · {t("research.history", { year: v.next.year })} ·{" "}
                    <span className={`font-bold ${v.versus! >= 0.5 ? "text-accent" : v.versus! <= -0.5 ? "text-amber-700" : ""}`}>{versusText(v.versus!, t)}</span>
                  </div>
                </>
              ) : (
                <div className="mt-1 text-2xs font-medium text-muted">{t("research.last")}</div>
              )}

              <div className="mt-1 text-2xs font-medium text-muted">{effect(d)}</div>

              {d === "strategic" && (
                <div className="mt-1.5 border-t border-divider pt-1.5 text-2xs font-bold text-ink">
                  {bomb.has ? (
                    t("research.bomb.has")
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="shrink-0">{t("research.bomb.progress", { n: Math.round(bomb.progress * 100) })}</span>
                        <div className="flex h-1 flex-1 overflow-hidden rounded-full bg-divider">
                          <div className={`h-full ${bomb.running ? "bg-accent" : "bg-muted"}`} style={{ width: `${Math.round(bomb.progress * 100)}%` }} />
                        </div>
                      </div>
                      {bomb.blocked && <div className="mt-0.5 font-medium text-muted">{bomb.blocked === "share" ? t("research.bomb.share", { n: BOMB_SHARE }) : t("research.bomb.fission")}</div>}
                    </>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div>
        <span className={`${ui.label} mb-1.5 block`}>{t("research.done")}</span>
        {done.length === 0 && <p className="text-xs font-medium text-muted">{t("research.noneDone")}</p>}
        <ul className="flex flex-col gap-1 text-xs font-medium text-ink">
          {done.map((d) => {
            const b = breakthroughOf(d.id);
            // When it came against history; a breakthrough is dated by the turn that made it.
            const versus = b ? b.year - yearFraction(d.date) : undefined;
            return (
              <li key={`${d.id}:${d.date}`} className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 flex-1">{researchLabel(d.id, t, text)}</span>
                <span className="shrink-0 text-2xs font-bold tabular-nums text-muted">
                  {d.date.slice(0, 7)}
                  {versus !== undefined && Math.abs(versus) >= 0.5 && <span className={versus > 0 ? "text-accent" : "text-amber-700"}> · {signed(Math.round(versus))}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

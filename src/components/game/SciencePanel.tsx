"use client";

import { MessageCircle, Minus, Plus } from "lucide-react";
import { ui } from "@/components/ui/classes";
import { officialAt } from "@/engine/government";
import { BOMB_SHARE, bombStatus, breakthroughOf, directionView, ministerPace, researchMoney, researchNote, scienceBoost, shiftShares, startingResearch } from "@/engine/research";
import { armsEfficiency, communicationsGrowth, harvestBonus, industryGrowth, intelligenceBonus, medicineBonus, populationBonus, techYear, yearFraction } from "@/engine/researchEffects";
import { RESEARCH_DIRECTIONS, type GameState, type ResearchDirection } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import { DIRECTION_ICONS, researchLabel, versusText } from "./armsText";

interface SciencePanelProps {
  state: GameState;
  disabled: boolean;
  onShares: (shares: Record<ResearchDirection, number>) => void;
  onConsult: () => void;
}

/** Points a click on a direction's stepper moves its share. */
const STEP = 5;

/**
 * The player's research: the money it gets from the army and industry
 * budgets and how fast it goes, the science minister's word on the split,
 * each direction with its share, the year of technology it has reached, the
 * next breakthrough and when it comes against history, and what it gives
 * now; then the breakthroughs this game has made.
 */
export default function SciencePanel({ state, disabled, onShares, onConsult }: SciencePanelProps) {
  const { t, text, money, locale } = useI18n();
  const view = state.research?.shares ? state : { ...state, research: startingResearch(state) };
  const shares = view.research!.shares;
  const funds = researchMoney(view);
  const bomb = bombStatus(view);
  const note = researchNote(view);
  const minister = officialAt(view, "science")?.name ?? t("research.ministry");
  const dir = (d: ResearchDirection) => t(`research.dir.${d}` as MessageKey);

  const signed = (n: number, digits = 0, unit = "") => `${n >= 0 ? "+" : "−"}${Math.abs(n).toLocaleString(locale, { maximumFractionDigits: digits, minimumFractionDigits: digits })}${unit}`;
  const times = (n: number) => n.toLocaleString(locale, { maximumFractionDigits: 2, minimumFractionDigits: 1 });
  const pct = (n: number) => signed(Math.round(n * 100), 0, "%");

  const effect = (d: ResearchDirection): string => {
    switch (d) {
      case "military":
        return t("research.effect.military", { year: Math.floor(techYear(view, d)) });
      case "industry":
        return t("research.effect.industry", { growth: signed(industryGrowth(view), 2), arms: pct(armsEfficiency(view) - 1) });
      case "agriculture":
        return t("research.effect.agriculture", { n: pct(harvestBonus(view)) });
      case "medicine":
        return t("research.effect.medicine", { n: pct(medicineBonus(view)), m: signed(populationBonus(view), 2) });
      case "science":
        return t("research.effect.science", { n: pct(scienceBoost(view) - 1) });
      case "communications":
        return t("research.effect.communications", { n: signed(intelligenceBonus(view)), m: signed(communicationsGrowth(view), 2) });
      case "strategic":
        return t("research.effect.strategic", { year: Math.floor(techYear(view, d)) });
    }
  };

  const noteText = (() => {
    switch (note.kind) {
      case "lopsided":
      case "behind":
        return t(`research.note.${note.kind}`, { name: minister, direction: dir(note.direction), n: note.n });
      case "bomb":
        return t("research.note.bomb", { name: minister, n: note.n });
      default:
        return t(`research.note.${note.kind}`, { name: minister });
    }
  })();

  const done = [...(view.research!.done ?? [])].reverse();

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs font-medium leading-relaxed text-muted">{t("research.intro")}</p>

      <div className="grid gap-1 rounded-xl bg-page p-3 text-xs font-medium text-muted">
        <span className={ui.label}>{t("research.moneyLabel")}</span>
        <span className="text-ink">{t("research.money", { money: money(funds.pool) })}</span>
        <span className="text-2xs font-bold tabular-nums">{t("research.pace", { money: times(Math.cbrt(funds.ratio)), minister: times(ministerPace(view)), science: times(scienceBoost(view)) })}</span>
      </div>

      <div className="flex gap-2.5 rounded-xl border border-line bg-surface p-3">
        <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        <p className="text-xs font-medium leading-relaxed text-ink">{noteText}</p>
      </div>

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
                <span className="text-muted">{t("research.reached", { year: Math.floor(v.tech) })}</span>
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

      <button type="button" onClick={onConsult} className={`${ui.secondary} px-4 py-2.5 text-xs`}>
        <MessageCircle className="h-4 w-4" />
        {t("research.ask")}
      </button>
    </div>
  );
}

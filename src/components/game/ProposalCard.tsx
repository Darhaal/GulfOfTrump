"use client";

import { Check } from "lucide-react";
import { ui } from "@/components/ui/classes";
import { pendingProposal } from "@/engine/advice";
import type { AdviceMessage, AdvisorId } from "@/engine/advisors";
import { BOMB_SHARE, bombStatus } from "@/engine/research";
import { RESEARCH_DIRECTIONS, type GameState } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";

const BUDGET_LINES = ["revenue", "army", "industry", "social", "other"] as const;

/**
 * A change a minister proposes in their answer – the research split, what
 * industry builds first for the army, the budget – as a card with what it
 * changes and "Apply". Nothing changes until the player clicks it; the
 * engine then checks it again against the state (engine/advice.ts). Once
 * applied, or when it is in force already, the card says so.
 */
export default function ProposalCard({ state, advisor, message, disabled, onApply }: { state: GameState; advisor: AdvisorId; message: AdviceMessage; disabled: boolean; onApply: () => void }) {
  const { t, money } = useI18n();
  const pending = pendingProposal(state, advisor, message);
  const research = message.proposal?.research;
  const focus = message.proposal?.focus;
  const budget = message.budget;
  if (!research && !focus && !budget) return null;

  const now = state.research?.shares;
  const changed = research ? RESEARCH_DIRECTIONS.filter((d) => !now || now[d] !== research[d]) : [];
  const bomb = research ? bombStatus(state) : null;
  const stopsBomb = Boolean(research && bomb && !bomb.has && bomb.running && research.strategic < BOMB_SHARE && (now?.strategic ?? 0) >= BOMB_SHARE);
  const economy = state.countries[state.player]?.economy;

  return (
    <div className="mt-2 rounded-xl border border-line bg-surface p-2.5 text-ink">
      {research && (
        <>
          <div className={`${ui.label} mb-1`}>{t("advisor.proposal.research")}</div>
          <ul className="grid gap-0.5 text-2xs font-medium">
            {(changed.length ? changed : RESEARCH_DIRECTIONS).map((d) => (
              <li key={d} className="flex justify-between gap-2">
                <span className="min-w-0 truncate">{t(`research.dir.${d}` as MessageKey)}</span>
                <span className="shrink-0 font-bold tabular-nums">
                  {now && now[d] !== research[d] ? `${now[d]}% → ` : ""}
                  {research[d]}%
                </span>
              </li>
            ))}
          </ul>
          {stopsBomb && <p className="mt-1 text-2xs font-bold text-amber-700">{t("research.bomb.share", { n: BOMB_SHARE })}</p>}
        </>
      )}
      {focus && (
        <>
          <div className={`${ui.label} mb-1`}>{t("advisor.proposal.focus")}</div>
          <p className="text-2xs font-bold">{focus.length ? focus.map((k) => t(`arms.kind.${k}` as MessageKey)).join(", ") : t("advisor.proposal.focusNone")}</p>
        </>
      )}
      {budget && (
        <>
          <div className={`${ui.label} mb-1`}>{t("advisor.proposal.budget")}</div>
          {budget.reason && <p className="mb-1 text-2xs font-medium leading-relaxed">{budget.reason}</p>}
          <dl className="grid gap-0.5 text-2xs">
            {BUDGET_LINES.map((key) => {
              const delta = economy ? budget[key] - economy.budget[key] : 0;
              return (
                <div key={key} className="flex items-baseline justify-between gap-2">
                  <dt className="font-medium text-muted">{t(`econ.line.${key}` as MessageKey)}</dt>
                  <dd className="font-bold tabular-nums">
                    {money(budget[key])}
                    {Math.abs(delta) >= 0.005 && (
                      <span className={`ml-1 ${delta > 0 ? "text-emerald-700" : "text-red-600"}`}>
                        {delta > 0 ? "+" : "−"}
                        {money(Math.abs(delta))}
                      </span>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        </>
      )}
      {pending ? (
        <button type="button" onClick={onApply} disabled={disabled} className={`${ui.primary} mt-2 w-full px-3 py-1.5 text-2xs`}>
          <Check className="h-3.5 w-3.5" />
          {t("advisor.apply")}
        </button>
      ) : (
        <div className={`mt-2 flex items-center gap-1 text-2xs font-black uppercase tracking-wider ${message.applied ? "text-emerald-700" : "text-muted"}`}>
          <Check className="h-3 w-3" />
          {t(message.applied ? "advisor.applied" : "advisor.inForce")}
        </div>
      )}
    </div>
  );
}

"use client";

import { Banknote, Package, Ship, TrendingUp, Users } from "lucide-react";
import { ui } from "@/components/ui/classes";
import { balance, spending, type Accounts } from "@/engine/economy";
import type { Economy } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import ResourceLedger from "./ResourceLedger";

/** Budget lines in the order and colour the bar draws them. */
const LINES = [
  { key: "army", color: "var(--ink)" },
  { key: "industry", color: "var(--accent)" },
  { key: "social", color: "var(--river)" },
  { key: "other", color: "var(--faded)" },
] as const;

/**
 * A country's economy at a glance: GDP and growth, debt, soldiers; for the
 * player (or with `detailed`) also the budget, prices and jobs, trade and
 * every strategic resource it produces against what it needs.
 */
export default function EconomyPanel({ economy, accounts, detailed, columns }: { economy: Economy; accounts?: Accounts; detailed?: boolean; columns?: boolean }) {
  const { t, money, people, locale } = useI18n();
  const pct = (n: number) => `${n > 0 ? "+" : ""}${n.toLocaleString(locale, { maximumFractionDigits: 1 })}%`;
  const total = spending(economy);
  const gap = balance(economy);
  const perCapita = accounts?.population ? (economy.gdp * 1e6) / accounts.population : 0;
  const debtShare = Math.round((economy.debt / Math.max(0.01, economy.gdp)) * 100);
  const row = (label: string, value: React.ReactNode, sub?: React.ReactNode) => (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className="font-bold text-muted">{label}</span>
      <span className="text-right font-black tabular-nums text-ink">
        {value}
        {sub && <span className="ml-1.5 font-bold text-muted">{sub}</span>}
      </span>
    </div>
  );

  return (
    <div className={`grid gap-3 ${columns ? "md:grid-cols-3 md:items-start" : ""}`}>
      <div className="rounded-xl bg-page p-3">
        <div className={`${ui.label} mb-2 flex items-center gap-1.5`}>
          <TrendingUp className="h-3.5 w-3.5" />
          {t("economy.title")}
        </div>
        <div className="grid gap-1.5">
          {row(t("economy.gdp"), money(economy.gdp), <span className={economy.growth < 0 ? "text-red-600" : ""}>{pct(economy.growth)}</span>)}
          {perCapita > 0 && <div className="-mt-1 text-right text-2xs font-bold text-muted">{t("economy.perCapita", { value: `$${Math.round(perCapita).toLocaleString(locale)}` })}</div>}
          {row(t("economy.debt"), money(economy.debt), t("economy.debtShare", { n: debtShare }))}
          {row(t("economy.troops"), t("economy.people", { value: people(economy.troops) }))}
          {detailed && accounts && (
            <div className="-mt-1 text-right text-2xs font-bold text-muted">
              {t("economy.mobilisable", { value: people(Math.max(0, accounts.mobilisable - economy.troops)) })}
            </div>
          )}
          {detailed && (
            <>
              {row(t("economy.inflation"), pct(economy.inflation))}
              {row(t("economy.unemployment"), `${economy.unemployment.toLocaleString(locale, { maximumFractionDigits: 1 })}%`)}
              {row(t("economy.reserves"), money(economy.reserves))}
            </>
          )}
        </div>
      </div>

      {detailed && (
        <div className="rounded-xl bg-page p-3">
          <div className={`${ui.label} mb-2 flex items-center gap-1.5`}>
            <Banknote className="h-3.5 w-3.5" />
            {t("economy.budget")}
          </div>
          <div className="grid gap-1.5">
            {row(t("economy.revenue"), money(economy.budget.revenue))}
            {row(t("economy.spending"), money(total))}
            <div className="flex h-2 overflow-hidden rounded-full bg-divider">
              {LINES.map(({ key, color }) => (
                <span key={key} style={{ width: `${(economy.budget[key] / Math.max(0.0001, total)) * 100}%`, background: color }} />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-2xs font-bold text-muted">
              {LINES.map(({ key, color }) => (
                <span key={key} className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-sm" style={{ background: color }} />
                  {t(`economy.${key}` as MessageKey)} {money(economy.budget[key])}
                </span>
              ))}
            </div>
            <div className={`text-right text-xs font-black ${gap < 0 ? "text-red-600" : "text-emerald-700"}`}>
              {gap < 0 ? t("economy.deficit", { value: money(-gap) }) : t("economy.surplus", { value: money(gap) })}
            </div>
          </div>
        </div>
      )}

      {detailed && accounts && (
        <div className="rounded-xl bg-page p-3">
          <div className={`${ui.label} mb-2 flex items-center gap-1.5`}>
            <Ship className="h-3.5 w-3.5" />
            {t("economy.trade")}
          </div>
          <div className="grid gap-1.5">
            {row(t("economy.exports"), money(accounts.exports))}
            {row(t("economy.imports"), money(accounts.imports))}
            {economy.tradeCut > 0 && <div className="text-xs font-bold text-red-600">{t("economy.tradeCut", { n: Math.round(economy.tradeCut * 100) })}</div>}
          </div>
          {Object.keys(accounts.need).length > 0 && (
            <>
              <div className={`${ui.label} mb-1.5 mt-3 flex items-center gap-1.5`}>
                <Package className="h-3.5 w-3.5" />
                {t("economy.resources")}
              </div>
              <ResourceLedger accounts={accounts} economy={economy} />
            </>
          )}
        </div>
      )}
      {!detailed && accounts && accounts.population > 0 && (
        <div className="flex items-center justify-end gap-1.5 text-2xs font-bold text-muted">
          <Users className="h-3 w-3" />
          {people(accounts.population)}
        </div>
      )}
    </div>
  );
}

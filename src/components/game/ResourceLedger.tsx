"use client";

import { RESOURCE_COLORS } from "@/components/map/colors";
import { extractionOf } from "@/engine/development";
import { DEFAULT_STOCK_MONTHS, MAX_STOCK_MONTHS, type Accounts } from "@/engine/economy";
import type { ResourceType } from "@/engine/resources";
import type { Economy } from "@/engine/types";
import { MEASURE, roundAmount, scaleAmount } from "@/engine/units";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";

export type ResourceState = "own" | "import" | "short";

/** Below this need, in points on the straight scale, a resource the country does not dig is left off. */
const MIN_NEED = 0.02;

/** The resources a country makes or needs, the biggest need first. */
export function ledgerTypes(accounts: Accounts): ResourceType[] {
  return (Object.keys(accounts.need) as ResourceType[])
    .filter((r) => (accounts.need[r] ?? 0) >= MIN_NEED || (accounts.production[r] ?? 0) > 0)
    .sort((a, b) => (accounts.need[b] ?? 0) - (accounts.need[a] ?? 0));
}

/** Enough of its own, imported, or short because imports are cut and the store is empty. */
export function resourceState(accounts: Accounts, type: ResourceType): ResourceState {
  if (accounts.shortages.includes(type)) return "short";
  return (accounts.production[type] ?? 0) >= (accounts.need[type] ?? 0) ? "own" : "import";
}

export const STATE_TONE: Record<ResourceState, string> = { own: "text-emerald-700", import: "text-amber-700", short: "text-red-600" };

/** "535 million t", "18 billion m³" in the interface language. */
export function useAmount() {
  const { t, locale } = useI18n();
  return (value: number, type: ResourceType) => {
    const { n, unit } = scaleAmount(value, MEASURE[type]);
    return t(`amount.${unit}` as MessageKey, { n: roundAmount(n).toLocaleString(locale) });
  };
}

/**
 * A country's strategic resources in real amounts a year: what it digs,
 * what it uses, what it sells or buys abroad and for how much, and what
 * lies in store against the size of its stores — with how long the store
 * lasts when imports are cut off.
 */
export default function ResourceLedger({ accounts, economy }: { accounts: Accounts; economy: Economy }) {
  const { t, money } = useI18n();
  const amount = useAmount();
  const types = ledgerTypes(accounts);
  const cut = economy.tradeCut;
  // What industry spending and policies have added to the output of the mines and wells (engine/development.ts).
  const extra = Math.round((extractionOf(economy) - 1) * 100);

  return (
    <ul className="flex flex-col gap-3">
      {extra >= 1 && <li className="text-2xs font-bold text-emerald-700">{t("ledger.extraction", { n: extra })}</li>}
      {types.map((type) => {
        const made = accounts.production[type] ?? 0;
        const need = accounts.need[type] ?? 0;
        const per = accounts.world?.perPoint[type];
        const real = (points: number) => (per ? amount(points * per, type) : "–");
        const s = resourceState(accounts, type);
        const scale = Math.max(made, need, 0.01);
        const surplus = made - need;
        const value = Math.abs(accounts.trade[type] ?? 0);
        const months = economy.stocks[type] ?? DEFAULT_STOCK_MONTHS;
        // The store, in months of use, against the most it can hold.
        const stored = (months / 12) * need;
        const room = (MAX_STOCK_MONTHS / 12) * need;
        const lack = need > 0 ? Math.max(0, -surplus) / need : 0;
        const draw = lack * cut;
        const row = (label: string, text: string, tone = "text-ink", hint?: string) => (
          <>
            <dt className={`font-bold text-muted ${hint ? "cursor-help underline decoration-dotted decoration-1 underline-offset-2" : ""}`} title={hint}>
              {label}
            </dt>
            <dd className={`text-right font-black tabular-nums ${tone}`}>{text}</dd>
          </>
        );
        return (
          <li key={type}>
            <div className="flex items-center gap-2 text-xs">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: RESOURCE_COLORS[type] }} />
              <span className="min-w-0 flex-1 truncate font-black text-ink">{t(`resource.${type}` as MessageKey)}</span>
              <span className={`text-2xs font-black uppercase tracking-wider ${STATE_TONE[s]}`}>{t(`bar.res.${s}` as MessageKey)}</span>
            </div>
            <div className="relative ml-5 mt-1 h-1.5 rounded-full bg-divider">
              <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(made / scale) * 100}%`, background: RESOURCE_COLORS[type] }} />
              <span className="absolute -inset-y-0.5 w-0.5 rounded bg-ink" style={{ left: `${(need / scale) * 100}%` }} />
            </div>
            <dl className="ml-5 mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-2xs">
              {row(t("ledger.output"), real(made))}
              {row(t("ledger.use"), real(need))}
              {surplus > 0.005 && row(t("ledger.sell"), `${real(surplus)} · ${money(value)}`, "text-emerald-700")}
              {surplus < -0.005 &&
                row(t("ledger.buy"), `${real(-surplus * (1 - cut))} · ${money(value * (1 - cut))}${cut > 0 ? ` · ${t("ledger.cut", { n: Math.round(cut * 100) })}` : ""}`, cut > 0 ? "text-red-600" : "text-amber-700")}
              {need > 0 && row(t("ledger.store"), t("ledger.storeOf", { have: real(stored), cap: real(room), n: Math.round(months * 10) / 10 }), "text-ink", t("ledger.storeHint"))}
            </dl>
            {need > 0 && (
              <div className="ml-5 mt-1 h-1 overflow-hidden rounded-full bg-divider">
                <span className={`block h-full rounded-full ${months < 1 ? "bg-red-600" : months < 3 ? "bg-amber-500" : "bg-muted"}`} style={{ width: `${(months / MAX_STOCK_MONTHS) * 100}%` }} />
              </div>
            )}
            {draw > 0 && <p className="ml-5 mt-1 text-2xs font-bold text-red-600">{months > 0 ? t("ledger.lasts", { n: Math.max(0.1, Math.round((months / draw) * 10) / 10) }) : t("ledger.empty")}</p>}
          </li>
        );
      })}
    </ul>
  );
}

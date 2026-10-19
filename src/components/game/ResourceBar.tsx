"use client";

import { Banknote, ChevronDown, ChevronUp, Gem, Percent, PiggyBank, Scale, Shield, TrendingUp, TriangleAlert, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { RESOURCE_COLORS } from "@/components/map/colors";
import { type Crisis, interestRate } from "@/engine/crises";
import { balance, type Accounts } from "@/engine/economy";
import type { Economy, ScenarioId } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import EconomyPanel from "./EconomyPanel";
import ResourceLedger, { ledgerTypes, resourceState, STATE_TONE } from "./ResourceLedger";

/**
 * The player's state of the nation along the top of the game screen: GDP,
 * the budget, debt, reserves, prices and the army in one row (the mouse
 * wheel scrolls it when the screen is narrow), then the strategic resources
 * folded into one chip — how many the country has enough of, imports or
 * lacks — that drops down into the list. "More" unfolds the full accounts.
 */
/** The country's crises behind one chip: how many, the worst in red, and what each leads to. */
function CrisisChip({ crises, economy, era }: { crises: Crisis[]; economy: Economy; era: ScenarioId }) {
  const { t, locale } = useI18n();
  const num = (n: number) => n.toLocaleString(locale, { maximumFractionDigits: 1 });
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  if (!crises.length) return null;
  const critical = crises.some((c) => c.level === "critical");
  const value = (c: Crisis) =>
    c.kind === "shortage"
      ? (c.detail ?? "").split(", ").map((r) => t(`resource.${r}` as MessageKey)).join(", ")
      : c.kind === "street"
        ? t(`politics.protest.${c.detail ?? "riot"}` as MessageKey)
        : num(c.value);
  return (
    <div ref={box} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-2xs font-black transition-colors ${critical ? "bg-red-600 text-white hover:bg-red-700" : "bg-amber-50 text-amber-700 hover:bg-amber-100"}`}
      >
        <TriangleAlert className="h-3.5 w-3.5" />
        <span className="max-sm:hidden">{t("crisis.title")}</span>
        <span className="tabular-nums">{crises.length}</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-1.5 max-h-[min(72vh,640px)] w-[min(400px,calc(100vw-24px))] overflow-y-auto overscroll-contain rounded-xl border border-line bg-surface p-3 shadow-lg shadow-shade/10">
          <div className="mb-2 text-2xs font-black uppercase tracking-widest text-muted">{t("crisis.title")}</div>
          <ul className="flex flex-col gap-2.5">
            {crises.map((c) => (
              <li key={c.kind} className="flex gap-2.5">
                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${c.level === "critical" ? "bg-red-600" : "bg-amber-500"}`} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2 text-xs font-black text-ink">
                    {t(`crisis.${c.kind}` as MessageKey, { value: value(c) })}
                    <span className={`text-2xs font-black uppercase tracking-wider ${c.level === "critical" ? "text-red-600" : "text-amber-700"}`}>{t(`crisis.${c.level}` as MessageKey)}</span>
                  </div>
                  <p className="mt-0.5 text-xs font-medium leading-snug text-muted">
                    {c.kind === "debt" ? t("crisis.debt.effect", { rate: num(interestRate(economy, era)) }) : t(`crisis.${c.kind}.effect` as MessageKey)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function ResourceBar({
  economy,
  accounts,
  crises = [],
  era,
  open,
  onToggle,
}: {
  economy: Economy;
  accounts?: Accounts;
  crises?: Crisis[];
  era: ScenarioId;
  open: boolean;
  onToggle: () => void;
}) {
  const { t, money, people, locale } = useI18n();
  const [shelf, setShelf] = useState(false);
  const row = useRef<HTMLDivElement>(null);
  const chip = useRef<HTMLDivElement>(null);
  const gap = balance(economy);
  const pct = (n: number) => `${n > 0 ? "+" : ""}${n.toLocaleString(locale, { maximumFractionDigits: 1 })}%`;
  const resources = accounts ? ledgerTypes(accounts) : [];
  const counts = { own: 0, import: 0, short: 0 };
  for (const type of resources) counts[resourceState(accounts!, type)]++;

  // A vertical wheel scrolls the row sideways.
  useEffect(() => {
    const el = row.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, []);

  // The shelf closes on a click elsewhere or Escape.
  useEffect(() => {
    if (!shelf) return;
    const away = (e: MouseEvent) => {
      if (!chip.current?.contains(e.target as Node)) setShelf(false);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setShelf(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", key);
    };
  }, [shelf]);

  const item = (Icon: LucideIcon, label: string, value: string, sub?: string, tone = "", minor = false) => (
    <span className="flex shrink-0 items-center gap-1.5" title={label}>
      <Icon className="h-3.5 w-3.5 text-muted" />
      <span className="text-2xs font-bold text-muted max-xl:hidden">{label}</span>
      <span className={`text-xs font-black tabular-nums ${tone || "text-ink"}`}>{value}</span>
      {sub && <span className={`text-2xs font-bold tabular-nums text-muted ${minor ? "max-2xl:hidden" : ""}`}>{sub}</span>}
    </span>
  );
  const TONE = STATE_TONE;

  return (
    <div className="relative z-30 border-b border-line bg-surface">
      <div className="flex items-center gap-2 px-3 py-1.5">
        <div ref={row} className="flex min-w-0 flex-1 items-center gap-4 overflow-x-auto [scrollbar-width:none]">
          {item(TrendingUp, t("economy.gdp"), money(economy.gdp), pct(economy.growth), economy.growth < 0 ? "text-red-600" : "")}
          {item(Banknote, t("economy.budget"), `${gap < 0 ? "−" : "+"}${money(Math.abs(gap))}`, undefined, gap < 0 ? "text-red-600" : "text-emerald-700")}
          {item(Scale, t("economy.debt"), money(economy.debt), t("economy.debtShare", { n: Math.round((economy.debt / Math.max(0.01, economy.gdp)) * 100) }), "", true)}
          {item(PiggyBank, t("economy.reserves"), money(economy.reserves))}
          {item(Percent, t("economy.inflation"), pct(economy.inflation))}
          {item(Shield, t("economy.troops"), people(economy.troops), accounts ? `/ ${people(Math.max(0, accounts.mobilisable - economy.troops))}` : undefined, "", true)}
        </div>

        <CrisisChip crises={crises} economy={economy} era={era} />

        {resources.length > 0 && (
          <div ref={chip} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setShelf((v) => !v)}
              aria-expanded={shelf}
              className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 transition-colors ${shelf ? "border-accent/40 bg-page" : "border-line hover:bg-page"}`}
            >
              <Gem className="h-3.5 w-3.5 text-muted" />
              <span className="flex -space-x-1">
                {resources.slice(0, 5).map((type) => (
                  <span key={type} className="h-2.5 w-2.5 rounded-full ring-1 ring-surface" style={{ background: RESOURCE_COLORS[type] }} />
                ))}
              </span>
              <span className="text-2xs font-bold text-muted max-sm:hidden">{t("bar.resources")}</span>
              <span className="flex items-center gap-1 text-2xs font-black tabular-nums">
                <span className={TONE.own}>{counts.own}</span>
                {counts.import > 0 && <span className={TONE.import}>· {counts.import}</span>}
                {counts.short > 0 && <span className={TONE.short}>· {counts.short}</span>}
              </span>
              <ChevronDown className={`h-3 w-3 text-muted transition-transform ${shelf ? "rotate-180" : ""}`} />
            </button>
            {shelf && (
              <div className="absolute right-0 top-full z-40 mt-1.5 w-[min(380px,calc(100vw-24px))] rounded-xl border border-line bg-surface p-3 shadow-lg shadow-shade/10">
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-2xs font-black uppercase tracking-widest text-muted">{t("bar.resources")}</span>
                  <span className="text-2xs font-bold text-muted">{t("bar.res.made")}</span>
                </div>
                <ResourceLedger accounts={accounts!} economy={economy} />
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-2xs font-black uppercase tracking-wider text-muted transition-colors hover:bg-page hover:text-ink"
        >
          <span className="max-sm:hidden">{t(open ? "bar.less" : "bar.more")}</span>
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>
      {open && (
        <div className="absolute inset-x-0 top-full max-h-[70vh] overflow-y-auto border-b border-line bg-surface/95 p-3 shadow-lg shadow-shade/10 backdrop-blur">
          <EconomyPanel economy={economy} accounts={accounts} detailed columns />
        </div>
      )}
    </div>
  );
}

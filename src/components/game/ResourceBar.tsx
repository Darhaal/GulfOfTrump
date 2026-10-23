"use client";

import { Activity, Banknote, ChevronDown, Gem, Percent, PiggyBank, Scale, Shield, TrendingUp, TriangleAlert, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type FocusEvent, type MouseEvent as ReactMouseEvent } from "react";
import { RESOURCE_COLORS } from "@/components/map/colors";
import { type Crisis, interestRate } from "@/engine/crises";
import { balance, type Accounts } from "@/engine/economy";
import type { Economy, ScenarioId } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import ResourceLedger, { ledgerTypes, resourceState, STATE_TONE } from "./ResourceLedger";

/**
 * The player's state of the nation along the top of the game screen: GDP,
 * the budget, debt, reserves, prices and the army in one row (the mouse
 * wheel scrolls it when the screen is narrow), then the country's tension
 * (unrest, 0–100) and its crises, then the strategic resources
 * folded into one chip — how many the country has enough of, imports or
 * lacks — that drops down into the list. The full accounts are on the
 * player's own country card. Each figure explains itself on hover, focus or
 * a tap: what it is and what moves it.
 */

/** The hint under a figure: drawn fixed, since the row scrolls sideways and would clip it. */
interface Hint {
  id: string;
  label: string;
  text: string;
  x: number;
  y: number;
}

type HintEvent = ReactMouseEvent<HTMLElement> | FocusEvent<HTMLElement>;
/** The country's crises behind one chip: how many, the worst in red, and what each leads to. */
function CrisisChip({ crises, economy, era, onHint }: { crises: Crisis[]; economy: Economy; era: ScenarioId; onHint: (e: HintEvent | null) => void }) {
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
        : c.kind === "provision"
          ? `${t(`supply.${c.detail ?? "food"}` as MessageKey).toLowerCase()} ${num(c.value)}%`
          : num(c.value);
  return (
    <div ref={box} className="relative shrink-0">
      <button
        type="button"
        onClick={() => {
          onHint(null);
          setOpen((v) => !v);
        }}
        onMouseEnter={(e) => !open && onHint(e)}
        onMouseLeave={() => onHint(null)}
        aria-expanded={open}
        className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-2xs font-black transition-colors ${critical ? "bg-red-600 text-white hover:bg-red-700" : "bg-amber-50 text-amber-700 hover:bg-amber-100"}`}
      >
        <TriangleAlert className="h-3.5 w-3.5" />
        <span className="max-sm:hidden">{t("crisis.title")}</span>
        <span className="tabular-nums">{crises.length}</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-1.5 max-h-[min(72vh,640px)] w-[min(400px,calc(100vw-24px))] overflow-y-auto overscroll-contain rounded-xl border border-line sheet p-3 shadow-lg shadow-shade/10">
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
  unrest,
}: {
  economy: Economy;
  accounts?: Accounts;
  crises?: Crisis[];
  era: ScenarioId;
  /** The country's tension, 0–100 (its politics' unrest); missing until the politics are described. */
  unrest?: number;
}) {
  const { t, money, people, locale } = useI18n();
  const [shelf, setShelf] = useState(false);
  const [hint, setHint] = useState<Hint | null>(null);
  const row = useRef<HTMLDivElement>(null);
  const chip = useRef<HTMLDivElement>(null);
  const gap = balance(economy);
  const pct = (n: number) => `${n > 0 ? "+" : ""}${n.toLocaleString(locale, { maximumFractionDigits: 1 })}%`;
  const resources = accounts ? ledgerTypes(accounts) : [];
  const counts = { own: 0, import: 0, short: 0 };
  for (const type of resources) counts[resourceState(accounts!, type)]++;

  // The figures' names as room allows: in full, then short ("GDP", "Army"), then none (the hints still give them),
  // so no figure is ever cut at the edge. `needed` keeps the width each step took when it stopped fitting.
  const [names, setNames] = useState<0 | 1 | 2>(0);
  const needed = useRef<number[]>([]);
  useEffect(() => {
    const el = row.current;
    if (!el) return;
    const fit = () => {
      if (names < 2 && el.scrollWidth > el.clientWidth + 1) {
        needed.current[names] = el.scrollWidth;
        setNames((names + 1) as 1 | 2);
      } else if (names > 0 && el.clientWidth >= (needed.current[names - 1] ?? Infinity)) setNames((names - 1) as 0 | 1);
    };
    const watch = new ResizeObserver(fit);
    watch.observe(el);
    fit();
    return () => watch.disconnect();
  }, [names, economy, locale]);

  // A vertical wheel scrolls the row sideways.
  useEffect(() => {
    const el = row.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    };
    // A hint is drawn where its figure was; once the row moves, it goes.
    const scrolled = () => setHint(null);
    el.addEventListener("wheel", wheel, { passive: false });
    el.addEventListener("scroll", scrolled);
    return () => {
      el.removeEventListener("wheel", wheel);
      el.removeEventListener("scroll", scrolled);
    };
  }, []);

  /** Shows a figure's hint under it, or hides it (null). */
  const hintFor = (id: string, label: string) => (e: HintEvent | null) => {
    if (!e) return setHint(null);
    const r = e.currentTarget.getBoundingClientRect();
    setHint({ id, label, text: t(`bar.hint.${id}` as MessageKey), x: Math.max(12, Math.min(r.left, window.innerWidth - 312)), y: r.bottom + 8 });
  };

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

  const item = (id: string, Icon: LucideIcon, label: string, short: string, value: string, sub?: string, tone = "", minor = false) => {
    const show = hintFor(id, label);
    return (
      <button
        key={id}
        type="button"
        onMouseEnter={show}
        onMouseLeave={() => show(null)}
        onFocus={show}
        onBlur={() => show(null)}
        // A tap on a touch screen shows it too, and a second tap hides it.
        onClick={(e) => (hint?.id === id ? show(null) : show(e))}
        aria-describedby={hint?.id === id ? "bar-hint" : undefined}
        aria-label={label}
        className="flex shrink-0 cursor-help items-center gap-1.5 rounded-md px-0.5 outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
      >
        <Icon className="h-3.5 w-3.5 text-muted" />
        {names < 2 && <span className="text-2xs font-bold text-muted">{names === 0 ? label : short}</span>}
        <span className={`text-xs font-black tabular-nums ${tone || "text-ink"}`}>{value}</span>
        {sub && <span className={`text-2xs font-bold tabular-nums text-muted ${minor ? "max-2xl:hidden" : ""}`}>{sub}</span>}
      </button>
    );
  };
  const TONE = STATE_TONE;

  return (
    <div className="relative z-30 border-b border-line sheet">
      <div className="flex items-center gap-2 px-3 py-1.5">
        <div ref={row} className="flex min-w-0 flex-1 items-center gap-4 overflow-x-auto [scrollbar-width:none]">
          {item("gdp", TrendingUp, t("economy.gdp"), t("economy.gdp.short"), money(economy.gdp), pct(economy.growth), economy.growth < 0 ? "text-red-600" : "")}
          {item("budget", Banknote, t("economy.budget"), t("economy.budget.short"), `${gap < 0 ? "−" : "+"}${money(Math.abs(gap))}`, undefined, gap < 0 ? "text-red-600" : "text-emerald-700")}
          {item("debt", Scale, t("economy.debt"), t("economy.debt.short"), money(economy.debt), t("economy.debtShare", { n: Math.round((economy.debt / Math.max(0.01, economy.gdp)) * 100) }), "", true)}
          {item("reserves", PiggyBank, t("economy.reserves"), t("economy.reserves"), money(economy.reserves))}
          {item("inflation", Percent, t("economy.inflation"), t("economy.inflation"), pct(economy.inflation))}
          {item("troops", Shield, t("economy.troops"), t("economy.troops.short"), people(economy.troops), accounts ? `/ ${people(Math.max(0, accounts.mobilisable - economy.troops))}` : undefined, "", true)}
        </div>

        {unrest !== undefined &&
          (() => {
            const show = hintFor("unrest", t("politics.unrest"));
            const level = unrest >= 70 ? "high" : unrest >= 40 ? "raised" : "calm";
            return (
              <button
                type="button"
                onMouseEnter={show}
                onMouseLeave={() => show(null)}
                onFocus={show}
                onBlur={() => show(null)}
                onClick={(e) => (hint?.id === "unrest" ? show(null) : show(e))}
                aria-describedby={hint?.id === "unrest" ? "bar-hint" : undefined}
                aria-label={t("politics.unrest")}
                className="flex shrink-0 cursor-help items-center gap-1.5 rounded-md px-0.5 outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
              >
                <Activity className="h-3.5 w-3.5 text-muted" />
                <span className="text-2xs font-bold text-muted max-xl:hidden">{t("politics.unrest")}</span>
                <span className={`text-xs font-black tabular-nums ${level === "high" ? "text-red-600" : level === "raised" ? "text-amber-700" : "text-ink"}`}>{unrest}</span>
                <span className="h-1 w-10 overflow-hidden rounded-full bg-divider max-sm:hidden">
                  <span
                    className={`block h-full rounded-full ${level === "high" ? "bg-red-600" : level === "raised" ? "bg-amber-500" : "bg-emerald-600"}`}
                    style={{ width: `${Math.max(0, Math.min(100, unrest))}%` }}
                  />
                </span>
              </button>
            );
          })()}

        <CrisisChip crises={crises} economy={economy} era={era} onHint={hintFor("crises", t("crisis.title"))} />

        {resources.length > 0 && (
          <div ref={chip} className="relative shrink-0">
            <button
              type="button"
              onClick={() => {
                setHint(null);
                setShelf((v) => !v);
              }}
              onMouseEnter={(e) => !shelf && hintFor("resources", t("bar.resources"))(e)}
              onMouseLeave={() => setHint(null)}
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
              <div className="absolute right-0 top-full z-40 mt-1.5 max-h-[min(72vh,640px)] w-[min(380px,calc(100vw-24px))] overflow-y-auto overscroll-contain rounded-xl border border-line sheet p-3 shadow-lg shadow-shade/10">
                <div className="mb-3">
                  <div className="text-2xs font-black uppercase tracking-widest text-muted">{t("bar.resources")}</div>
                  <div className="mt-0.5 text-2xs font-bold leading-snug text-muted">{t("bar.res.made")}</div>
                </div>
                <ResourceLedger accounts={accounts!} economy={economy} />
              </div>
            )}
          </div>
        )}
      </div>
      {hint && (
        <div
          id="bar-hint"
          role="tooltip"
          className="pointer-events-none fixed z-50 w-[300px] max-w-[calc(100vw-24px)] rounded-xl border border-line sheet p-3 shadow-lg shadow-shade/10 animate-in fade-in duration-150"
          style={{ left: hint.x, top: hint.y }}
        >
          <div className="text-2xs font-black uppercase tracking-widest text-muted">{hint.label}</div>
          <p className="mt-1 text-xs font-medium leading-snug text-ink">{hint.text}</p>
        </div>
      )}
    </div>
  );
}

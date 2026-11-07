"use client";

import { Activity, Banknote, ChevronDown, Gem, Percent, PiggyBank, Scale, Shield, TrendingUp, TriangleAlert, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { RESOURCE_COLORS } from "@/components/map/colors";
import { GlossaryText, Term, TextTip } from "@/components/ui/Term";
import { type Crisis, interestRate } from "@/engine/crises";
import { balance, type Accounts } from "@/engine/economy";
import type { HomeFigure, HomeView } from "@/engine/official";
import type { Economy, EconomyFigures, ScenarioId } from "@/engine/types";
import type { TermId } from "@/i18n/glossary";
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
 * a tap (components/ui/Tip.tsx): what it is and what moves it, with the
 * glossary's terms inside opening hints of their own.
 *
 * A player who does not govern sees the figures their role knows
 * (engine/official.ts): an estimate marked "≈", a secret as "?", and the
 * row says whether these are the official figures or the post's estimates.
 */

/** A figure's look: a button with an icon, a name and a value. */
const FIGURE = "flex shrink-0 cursor-help items-center gap-1.5 rounded-md px-0.5 outline-none focus-visible:ring-2 focus-visible:ring-accent/50";

/** What a figure's hint says: a glossary term, with the bar's own words on what stands beside the figure; or a sentence of its own. */
type FigureTip = { term: TermId; extra?: MessageKey } | { text: MessageKey };

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
        : c.kind === "provision"
          ? `${t(`supply.${c.detail ?? "food"}` as MessageKey).toLowerCase()} ${num(c.value)}%`
          : num(c.value);
  return (
    <div ref={box} className="relative shrink-0">
      <TextTip
        as="button"
        label={t("crisis.title")}
        text={t("bar.hint.crises")}
        pinnable={false}
        silent={open}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-2xs font-black transition-colors ${critical ? "bg-red-600 text-white hover:bg-red-700" : "bg-amber-50 text-amber-700 hover:bg-amber-100"}`}
      >
        <TriangleAlert className="h-3.5 w-3.5" />
        <span className="max-sm:hidden">{t("crisis.title")}</span>
        <span className="tabular-nums">{crises.length}</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </TextTip>
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
  before,
  seen,
}: {
  economy: Economy;
  accounts?: Accounts;
  crises?: Crisis[];
  era: ScenarioId;
  /** The country's tension, 0–100 (its politics' unrest); missing until the politics are described. */
  unrest?: number;
  /** The books at the start of the last turn (its chronicle entry), for what the turn changed. */
  before?: EconomyFigures;
  /** How a role that does not govern knows each figure; `economy` then holds the figures it knows. */
  seen?: HomeView;
}) {
  const { t, money, moneyFine, moneyMoved, people, locale } = useI18n();
  const [shelf, setShelf] = useState(false);
  const row = useRef<HTMLDivElement>(null);
  const chip = useRef<HTMLDivElement>(null);
  const gap = seen ? (seen.balance.value ?? 0) : balance(economy);
  /** A figure as the role knows it: "≈" before an estimate, "?" for a secret. */
  const shown = (key: HomeFigure, value: string) => (seen?.[key].sight === "secret" ? "?" : seen?.[key].sight === "estimated" ? `≈ ${value}` : value);
  const known = (key: HomeFigure) => seen?.[key].sight !== "secret";
  const official = seen && Object.values(seen).some((v) => v.sight === "official");
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

  /** What the last turn did to a figure, if it moved: "▲+$370 M", green when it went the good way. */
  const turned = (now: number, then: number | undefined, good: "up" | "down", text: (from: number, to: number) => string) =>
    then === undefined || Math.abs(now - then) < 1e-6 ? undefined : { text: `${now > then ? "▲" : "▼"}${text(then, now)}`, good: now > then === (good === "up") };
  const moneyTurned = (now: number, then: number | undefined, good: "up" | "down") => turned(now, then, good, (from, to) => moneyMoved(from, to).delta);
  /** A figure with its hint on hover, focus or a tap; a second tap hides it. */
  const figure = (tip: FigureTip, label: string, body: ReactNode) =>
    "term" in tip ? (
      <Term key={label} id={tip.term} as="button" label={label} aria-label={label} extra={tip.extra && <GlossaryText text={t(tip.extra)} />} className={FIGURE}>
        {body}
      </Term>
    ) : (
      <TextTip key={label} as="button" label={label} aria-label={label} text={t(tip.text)} className={FIGURE}>
        {body}
      </TextTip>
    );
  const item = (tip: FigureTip, Icon: LucideIcon, label: string, short: string, value: string, sub?: string, tone = "", minor = false, change?: { text: string; good: boolean }) =>
    figure(
      tip,
      label,
      <>
        <Icon className="h-3.5 w-3.5 text-muted" />
        {names < 2 && <span className="text-2xs font-bold text-muted">{names === 0 ? label : short}</span>}
        <span className={`text-xs font-black tabular-nums ${tone || "text-ink"}`}>{value}</span>
        {sub && <span className={`text-2xs font-bold tabular-nums text-muted ${minor ? "max-2xl:hidden" : ""}`}>{sub}</span>}
        {change && (
          <span className={`text-2xs font-bold tabular-nums max-md:hidden ${change.good ? "text-emerald-700" : "text-red-600"}`} title={t("econ.sinceTurn")}>
            {change.text}
          </span>
        )}
      </>,
    );
  const TONE = STATE_TONE;
  // GDP carries two figures: its real growth, a yearly rate, and what the last turn added in dollars – each says which it is.
  const gdpTurned = moneyTurned(economy.gdp, before?.gdp, "up");

  return (
    <div className="relative z-30 border-b border-line sheet">
      <div className="flex items-center gap-2 px-3 py-1.5">
        {seen && (
          <TextTip
            as="span"
            label={t(official ? "sight.bar.official" : "sight.bar.estimates")}
            text={t(official ? "sight.bar.officialHint" : "sight.bar.estimatesHint")}
            className="shrink-0 cursor-help rounded-md bg-page px-1.5 py-0.5 text-2xs font-black uppercase tracking-wider text-muted"
          >
            {t(official ? "sight.bar.official" : "sight.bar.estimates")}
          </TextTip>
        )}
        <div ref={row} className="flex min-w-0 flex-1 items-center gap-4 overflow-x-auto [scrollbar-width:none]">
          {item(
            { term: "gdp", extra: "bar.hint.gdp" },
            TrendingUp,
            t("economy.gdp"),
            t("economy.gdp.short"),
            shown("gdp", moneyFine(economy.gdp)),
            known("growth") ? t("economy.perYear", { n: shown("growth", pct(economy.growth)) }) : undefined,
            economy.growth < 0 ? "text-red-600" : "",
            false,
            gdpTurned && { ...gdpTurned, text: t("economy.perTurn", { n: gdpTurned.text }) },
          )}
          {item({ term: "budget" }, Banknote, t("economy.budget"), t("economy.budget.short"), shown("balance", `${gap < 0 ? "−" : "+"}${money(Math.abs(gap))}`), undefined, !known("balance") ? "" : gap < 0 ? "text-red-600" : "text-emerald-700")}
          {item(
            { term: "debt" },
            Scale,
            t("economy.debt"),
            t("economy.debt.short"),
            shown("debt", moneyFine(economy.debt)),
            known("debt") && known("gdp") ? t("economy.debtShare", { n: Math.round((economy.debt / Math.max(0.01, economy.gdp)) * 100) }) : undefined,
            "",
            true,
            moneyTurned(economy.debt, before?.debt, "down"),
          )}
          {item({ term: "reserves" }, PiggyBank, t("economy.reserves"), t("economy.reserves"), shown("reserves", moneyFine(economy.reserves)), undefined, "", false, moneyTurned(economy.reserves, before?.reserves, "up"))}
          {item({ term: "inflation" }, Percent, t("economy.inflation"), t("economy.inflation"), shown("inflation", pct(economy.inflation)))}
          {item(
            { text: "bar.hint.troops" },
            Shield,
            t("economy.troops"),
            t("economy.troops.short"),
            shown("troops", people(economy.troops)),
            accounts ? `/ ${people(Math.max(0, accounts.mobilisable - economy.troops))}` : undefined,
            "",
            true,
            turned(economy.troops, before?.troops, "up", (from, to) => `${to >= from ? "+" : "−"}${people(Math.abs(to - from))}`),
          )}
        </div>

        {unrest !== undefined &&
          (() => {
            const level = unrest >= 70 ? "high" : unrest >= 40 ? "raised" : "calm";
            return figure(
              { term: "unrest" },
              t("politics.unrest"),
              <>
                <Activity className="h-3.5 w-3.5 text-muted" />
                <span className="text-2xs font-bold text-muted max-xl:hidden">{t("politics.unrest")}</span>
                <span className={`text-xs font-black tabular-nums ${level === "high" ? "text-red-600" : level === "raised" ? "text-amber-700" : "text-ink"}`}>{shown("unrest", String(unrest))}</span>
                <span className="h-1 w-10 overflow-hidden rounded-full bg-divider max-sm:hidden">
                  <span
                    className={`block h-full rounded-full ${level === "high" ? "bg-red-600" : level === "raised" ? "bg-amber-500" : "bg-emerald-600"}`}
                    style={{ width: `${Math.max(0, Math.min(100, unrest))}%` }}
                  />
                </span>
              </>,
            );
          })()}

        <CrisisChip crises={crises} economy={economy} era={era} />

        {resources.length > 0 && (
          <div ref={chip} className="relative shrink-0">
            <TextTip
              as="button"
              label={t("bar.resources")}
              text={t("bar.hint.resources")}
              pinnable={false}
              silent={shelf}
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
            </TextTip>
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
    </div>
  );
}

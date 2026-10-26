"use client";

import { ChevronDown, UsersRound } from "lucide-react";
import { useState } from "react";
import { ui } from "@/components/ui/classes";
import type { Estimate, KnowledgeLevel } from "@/engine/fog";
import type { Society, SocietyFigure } from "@/engine/society";
import type { SocietyFigures } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import { shown } from "./estimate";

/** A share of a bar: its figure, the words for it and its colour (a theme token). */
interface Slice {
  key: SocietyFigure | "rural";
  label: MessageKey;
  color: string;
}

const INCOME: Slice[] = [
  { key: "poor", label: "society.poor", color: "var(--war)" },
  { key: "middle", label: "society.middle", color: "var(--faded)" },
  { key: "rich", label: "society.rich", color: "var(--ink)" },
];
const TOWN: Slice[] = [
  { key: "urban", label: "society.urban", color: "var(--muted)" },
  { key: "rural", label: "society.rural", color: "var(--map-ally)" },
];
const WORK: Slice[] = [
  { key: "farm", label: "society.farm", color: "var(--map-ally)" },
  { key: "industry", label: "society.industry", color: "var(--accent)" },
  { key: "services", label: "society.services", color: "var(--river)" },
];

/** Whether a rise is good news, bad news or neither, for the trend's colour. */
const RISE_IS: Partial<Record<keyof SocietyFigures, "good" | "bad">> = { poor: "bad", rich: "good", literate: "good" };

/**
 * A country's people in a few small charts (engine/society.ts): an age
 * pyramid, the poor, middle and rich, town and country, work and schooling,
 * each with its change since the start for the player's own country. Folded
 * by default; another country's figures under fog of war are estimates.
 */
export default function SocietyPanel({ society, estimates, level }: { society: Society; estimates?: Record<SocietyFigure, Estimate>; level?: KnowledgeLevel }) {
  const { t, people, locale } = useI18n();
  const [open, setOpen] = useState(false);
  // Under fog of war the charts draw the estimates, not the truth.
  const value = (key: SocietyFigure | "rural"): number => (key === "rural" ? 100 - value("urban") : (estimates?.[key]?.value ?? society[key]));
  const pct = (n: number) => `${Math.round(n).toLocaleString(locale)}%`;
  const figure = (key: SocietyFigure | "rural") => {
    if (key === "rural") return pct(value(key));
    const e = estimates?.[key];
    return e && level ? shown(e, level, pct) : pct(value(key));
  };
  const start = estimates ? undefined : society.start;

  /** The change since the start, in points: an arrow and a figure, nothing when it is under a point. */
  const trend = (key: keyof SocietyFigures, now: number) => {
    const was = start?.[key];
    if (was === undefined) return null;
    const d = key === "men" ? (was > 0 ? ((now - was) / was) * 100 : 0) : now - was;
    if (Math.abs(d) < 1) return null;
    const meaning = key === "men" ? (d < 0 ? "bad" : undefined) : d > 0 ? RISE_IS[key] : RISE_IS[key] === "good" ? "bad" : RISE_IS[key] === "bad" ? "good" : undefined;
    const tone = meaning === "bad" ? "text-war" : meaning === "good" ? "text-emerald-700" : "text-muted";
    return (
      <span className={`ml-1 text-2xs font-black tabular-nums ${tone}`} title={t("society.since")}>
        {d > 0 ? "▲" : "▼"}
        {Math.abs(Math.round(d))}
        {key === "men" ? "%" : ""}
      </span>
    );
  };

  const bar = (slices: Slice[], height = "h-2") => {
    // Estimates guessed one by one need not add up: the bar is drawn to their sum.
    const total = slices.reduce((sum, s) => sum + Math.max(0, value(s.key)), 0) || 1;
    return (
      <div className={`flex ${height} overflow-hidden rounded-full bg-divider`}>
        {slices.map((s) => (
          <span key={s.key} style={{ width: `${(Math.max(0, value(s.key)) / total) * 100}%`, background: s.color }} />
        ))}
      </div>
    );
  };

  const stack = (title: MessageKey, slices: Slice[]) => (
    <div className="grid gap-1">
      <div className="text-2xs font-black uppercase tracking-widest text-muted">{t(title)}</div>
      {bar(slices)}
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-2xs font-bold text-muted">
        {slices.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
            {t(s.label)} <span className="text-ink">{figure(s.key)}</span>
            {s.key !== "rural" && s.key !== "middle" && s.key !== "services" && trend(s.key as keyof SocietyFigures, value(s.key))}
          </span>
        ))}
      </div>
    </div>
  );

  const row = (label: MessageKey, key: SocietyFigure, trendKey?: keyof SocietyFigures) => (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className="font-bold text-muted">{t(label)}</span>
      <span className="text-right font-black tabular-nums text-ink">
        {figure(key)}
        {trendKey && trend(trendKey, value(key))}
      </span>
    </div>
  );

  return (
    <div className="rounded-xl bg-page p-3">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 text-left">
        <span className={`${ui.label} flex min-w-0 items-center gap-1.5`}>
          <UsersRound className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {t("society.title")}
            {open && estimates && level !== "full" ? ` · ${t("society.estimate")}` : ""}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {!open && (
            <>
              <span className="text-2xs font-bold text-muted">
                {t("society.poor")} <span className="text-ink">{figure("poor")}</span>
              </span>
              <span className="w-14">{bar(INCOME, "h-1.5")}</span>
            </>
          )}
          <ChevronDown className={`h-4 w-4 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {open && (
        <div className="mt-3 grid gap-3">
          <Pyramid society={society} />
          {stack("society.income", INCOME)}
          {stack("society.town", TOWN)}
          {stack("society.work", WORK)}
          <div className="grid gap-1.5">
            {row("society.literate", "literate", "literate")}
            {row("society.jobless", "jobless")}
            {row("society.young", "young", "young")}
            {row("society.old", "old")}
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="font-bold text-muted">{t("society.menYoung")}</span>
              <span className="text-right font-black tabular-nums text-ink">
                {estimates ? "–" : people(society.men)}
                {trend("men", society.men)}
              </span>
            </div>
          </div>
          <p className="text-2xs font-medium leading-relaxed text-muted">{t(start ? "society.aboutTrends" : "society.about")}</p>
        </div>
      )}
    </div>
  );
}

/** The age pyramid: men to the left, women to the right, five-year bands from the youngest at the bottom. */
function Pyramid({ society }: { society: Society }) {
  const { t, locale } = useI18n();
  const rows = society.bands.length;
  const step = 7;
  const width = 300;
  const mid = width / 2;
  const gutter = 16;
  const most = Math.max(...society.bands.map((b) => Math.max(b.m, b.f)), 1);
  const scale = (n: number) => (n / most) * (mid - gutter - 2);
  const men = society.bands.reduce((s, b) => s + b.m, 0);
  const share = (n: number) => `${Math.round((n / Math.max(1, society.people)) * 100).toLocaleString(locale)}%`;
  return (
    <figure className="grid gap-1">
      <figcaption className="flex items-center justify-between text-2xs font-black uppercase tracking-widest text-muted">
        <span>{t("society.age")}</span>
      </figcaption>
      <svg viewBox={`0 0 ${width} ${rows * step + 2}`} className="h-auto w-full" role="img" aria-label={t("society.age")}>
        {society.bands.map((b, i) => {
          const y = (rows - 1 - i) * step + 1;
          return (
            <g key={i}>
              <rect x={mid - gutter - scale(b.m)} y={y} width={scale(b.m)} height={step - 1.5} rx={1} fill="var(--river)" />
              <rect x={mid + gutter} y={y} width={scale(b.f)} height={step - 1.5} rx={1} fill="var(--accent)" opacity={0.85} />
              {i % 4 === 0 && (
                <text x={mid} y={y + step - 2} textAnchor="middle" fontSize={6.5} fontWeight={700} fill="var(--muted)">
                  {i === rows - 1 ? "80+" : i * 5}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="flex justify-between text-2xs font-bold text-muted">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm" style={{ background: "var(--river)" }} />
          {t("society.men")} {share(men)}
        </span>
        <span className="inline-flex items-center gap-1">
          {t("society.women")} {share(society.people - men)}
          <span className="h-2 w-2 rounded-sm" style={{ background: "var(--accent)" }} />
        </span>
      </div>
    </figure>
  );
}

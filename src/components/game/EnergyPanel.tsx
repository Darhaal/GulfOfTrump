"use client";

import { Hammer, TriangleAlert, Zap } from "lucide-react";
import { useMemo } from "react";
import { ui } from "@/components/ui/classes";
import { TextTip } from "@/components/ui/Term";
import type { Accounts } from "@/engine/economy";
import { energyView } from "@/engine/energy";
import type { EnergySource, GameState, MapRegion } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";

/** Each kind of plant's colour on the bar: a fixed palette, the same in both themes, as the country colours are. */
const TONE: Record<EnergySource, string> = {
  coal: "bg-zinc-600",
  oil: "bg-stone-500",
  gas: "bg-sky-500",
  hydro: "bg-blue-700",
  nuclear: "bg-lime-500",
  wind: "bg-teal-400",
  solar: "bg-amber-400",
};

/**
 * The country's electricity in the economy panel: demand against what the
 * plants deliver, the mix as one bar, the plants in service by kind with the
 * fuel each has left, the plants under construction and what they take of
 * the industry line, and a shortage when there is one (engine/energy.ts).
 */
export default function EnergyPanel({ state, accounts, regions }: { state: GameState; accounts?: Accounts; regions: Record<string, MapRegion> | null }) {
  const { t, locale } = useI18n();
  const view = useMemo(() => energyView(state, state.player, accounts ? new Map([[state.player, accounts]]) : null, regions), [state, accounts, regions]);
  if (!view) return null;
  const num = (n: number, digits = 1) => n.toLocaleString(locale, { maximumFractionDigits: digits });
  const pct = (n: number) => Math.round(n * 100);
  const source = (s: EnergySource) => t(`energy.source.${s}` as MessageKey);
  const fuel = view.mix.filter((m) => m.fuel !== undefined && m.fuel < 0.95);

  return (
    <section className="grid gap-3">
      <TextTip text={t("energy.hint")} label={t("energy.title")} className={`${ui.label} flex cursor-help items-center gap-1.5`}>
        <Zap className="h-3.5 w-3.5" />
        {t("energy.title")}
      </TextTip>

      <div className="rounded-xl bg-page p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-xs">
          <span className="font-black tabular-nums text-ink">{t("energy.demand", { n: num(view.demand) })}</span>
          <span className="font-bold tabular-nums text-muted">{t("energy.supply", { n: num(view.supply) })}</span>
        </div>
        {view.short >= 0.01 ? (
          <p className="mt-1 flex items-center gap-1 text-2xs font-bold text-red-600">
            <TriangleAlert className="h-3 w-3 shrink-0" />
            {t("energy.short", { n: pct(view.short) })}
          </p>
        ) : (
          <p className="mt-1 text-2xs font-bold text-emerald-700">{t("energy.ok")}</p>
        )}
        {view.lost >= 0.02 && <p className="mt-0.5 text-2xs font-bold text-amber-700">{t("energy.lost", { n: pct(view.lost) })}</p>}
        {fuel.length > 0 && <p className="mt-0.5 text-2xs font-bold text-amber-700">{t("energy.fuel", { list: fuel.map((m) => `${source(m.source).toLowerCase()} ${pct(m.fuel!)}%`).join(", ") })}</p>}
      </div>

      <div className="grid gap-1.5">
        <span className={ui.label}>{t("energy.mix")}</span>
        <div className="flex h-3 overflow-hidden rounded-full bg-divider" role="img" aria-label={view.mix.map((m) => `${source(m.source)} ${pct(m.share)}%`).join(", ")}>
          {view.mix
            .filter((m) => m.share > 0)
            .map((m) => (
              <div key={m.source} className={`h-full ${TONE[m.source]}`} style={{ width: `${m.share * 100}%` }} title={`${source(m.source)} ${pct(m.share)}%`} />
            ))}
        </div>
        <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-2xs">
          {view.mix.map((m) => (
            <li key={m.source} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 shrink-0 rounded-full ${TONE[m.source]}`} />
              <span className="min-w-0 flex-1 truncate font-bold text-ink">{source(m.source)}</span>
              <span className="font-black tabular-nums text-ink">{pct(m.share)}%</span>
              <span className="w-14 text-right font-bold tabular-nums text-muted">{t("energy.gw", { n: num(m.gw) })}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-1.5">
        <span className={`${ui.label} flex items-center gap-1.5`}>
          <Hammer className="h-3.5 w-3.5" />
          {t("energy.building")}
        </span>
        {view.building.length === 0 && <p className="text-2xs font-medium leading-snug text-muted">{t("energy.noBuilding")}</p>}
        {view.building.map((b, i) => (
          <div key={`${b.source}-${i}`} className="grid gap-1">
            <div className="flex items-baseline justify-between gap-2 text-2xs font-bold">
              <span className="min-w-0 flex-1 truncate text-ink">
                {source(b.source)} · <span className="text-muted">{t(`energy.by.${b.by}` as MessageKey)}</span>
              </span>
              <span className="shrink-0 tabular-nums text-muted">
                {t("energy.plant", { gw: num(b.gw, 2), n: pct(b.progress) })} · {b.ready ? t("energy.ready", { year: Math.floor(b.ready).toLocaleString(locale, { useGrouping: false }) }) : t("energy.stalled")}
              </span>
            </div>
            <div className="flex h-1 overflow-hidden rounded-full bg-divider">
              <div className={`h-full ${TONE[b.source]}`} style={{ width: `${pct(b.progress)}%` }} />
            </div>
          </div>
        ))}
        {view.spend > 0 && <p className="text-2xs font-medium text-muted">{t("energy.spend", { n: pct(view.spend) })}</p>}
      </div>
    </section>
  );
}

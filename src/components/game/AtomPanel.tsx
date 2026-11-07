"use client";

import { Atom } from "lucide-react";
import { ui } from "@/components/ui/classes";
import { atomicPowers, atomView, BOMB_SHARE } from "@/engine/atom";
import { countryName } from "@/engine/names";
import { playerAtomRate } from "@/engine/research";
import { ATOM_STAGES, type AtomStage, type GameState } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";

/** Fission is known, and a programme can begin, from this year at the latest. */
const FISSION = 1938;

/**
 * The player's atomic programme beside the space programme: its stages, the
 * one under way with its work and when it could be reached at this pace, the
 * stockpile once there is one; then the world's declared atomic powers and
 * the nuclear strikes made (engine/atom.ts). The programme runs on the
 * strategic direction above.
 */
export default function AtomPanel({ state }: { state: GameState }) {
  const { t, text, locale } = useI18n();
  const view = atomView(state, playerAtomRate(state));
  if (!view || Number(state.date.slice(0, 4)) < FISSION) return null;
  const stage = (s: AtomStage) => t(`atom.stage.${s}` as MessageKey);
  const country = (tag: string) => text(state.countries[tag]?.name ?? countryName(tag) ?? tag);
  const year = (y: number) => Math.floor(y).toLocaleString(locale, { useGrouping: false });
  const powers = atomicPowers(state);
  const strikes = state.atom?.strikes ?? [];

  return (
    <section className="flex flex-col gap-2">
      <span className={`${ui.label} flex cursor-help items-center gap-1.5`} title={t("atom.hint", { n: BOMB_SHARE })}>
        <Atom className="h-3.5 w-3.5" />
        {t("atom.title")}
      </span>

      <div className={`${ui.card} flex flex-col gap-2 p-3`}>
        <ol className="grid gap-1">
          {ATOM_STAGES.map((s) => {
            const done = view.done.find((d) => d.id === s);
            const current = view.next?.stage === s;
            return (
              <li key={s} className={`flex items-baseline justify-between gap-2 text-2xs ${done ? "font-bold text-ink" : current ? "font-bold text-accent" : "font-medium text-muted"}`}>
                <span className="min-w-0 flex-1">{stage(s)}</span>
                <span className="shrink-0 tabular-nums">{done ? done.date.slice(0, 7) : current ? (view.next!.expected ? t("atom.expected", { year: year(view.next!.expected) }) : t("atom.stalled")) : "–"}</span>
              </li>
            );
          })}
        </ol>
        {view.next && (
          <div className="flex h-1 overflow-hidden rounded-full bg-divider" title={t("atom.next", { stage: stage(view.next.stage) })}>
            <div className={`h-full ${view.next.expected ? "bg-accent" : "bg-muted"}`} style={{ width: `${Math.round(view.next.work * 100)}%` }} />
          </div>
        )}
        {view.has && (
          <p className="text-2xs font-black tabular-nums text-ink">
            {t("atom.stock", { n: view.stock.toLocaleString(locale) })}
            {view.goal !== undefined && <span className="font-bold text-muted"> · {t("atom.goal", { n: view.goal.toLocaleString(locale) })}</span>}
          </p>
        )}

        <div className="flex flex-col gap-1 border-t border-divider pt-2">
          <span className={ui.label}>{t("atom.powers")}</span>
          {powers.length === 0 && <p className="text-2xs font-medium text-muted">{t("atom.noPowers")}</p>}
          {powers.map((p) => (
            <div key={p.tag} className="flex items-baseline justify-between gap-2 text-2xs font-medium text-ink">
              <span className="min-w-0 flex-1 truncate">
                {country(p.tag)}
                {p.hydrogen && <span className="text-muted"> · {t("atom.hydrogen")}</span>}
              </span>
              <span className="shrink-0 font-bold tabular-nums">{p.stock.toLocaleString(locale)}</span>
            </div>
          ))}
        </div>

        {strikes.length > 0 && (
          <div className="flex flex-col gap-1 border-t border-divider pt-2">
            <span className={`${ui.label} text-red-600`}>{t("atom.strikes")}</span>
            {strikes.map((s, i) => (
              <p key={i} className="text-2xs font-bold text-red-600">
                {t("atom.strike", { by: country(s.by), against: country(s.against), place: s.region.split("-").slice(1).join(" ") || s.region, n: s.n, date: s.date.slice(0, 7) })}
              </p>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

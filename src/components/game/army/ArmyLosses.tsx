"use client";

import { ui } from "@/components/ui/classes";
import { formatDate } from "@/engine/calendar";
import { civiliansView } from "@/engine/civilians";
import type { Estimate } from "@/engine/fog";
import { strainOf } from "@/engine/mobilisation";
import { peopleOf } from "@/engine/population";
import type { GameState, MapRegion, War, WeaponKind } from "@/engine/types";
import { CIVIL_CAUSES, WEAPON_KINDS } from "@/engine/types";
import { lastLosses, lossesView, turnLossesView, type LossesView } from "@/engine/warLosses";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import { ARMS_ICONS } from "../armsText";
import { CountryFlag, playerWars, sidesOf, useArmyWords } from "./common";

type Column = keyof LossesView;

/**
 * What each of the army's wars has cost, side by side: soldiers killed,
 * wounded and taken prisoner and equipment lost, since the war began and,
 * under each figure, in the last turn (engine/warLosses.ts); then what it has
 * cost the people of each side – the dead by cause and those who fled
 * (engine/civilians.ts). The player's own side exactly, with its equipment by
 * kind; the others as the intelligence estimates them under the fog of war.
 * Above them, the strain of the player's mobilisation (engine/mobilisation.ts).
 */
export default function ArmyLosses({ state, regions }: { state: GameState; regions?: Record<string, MapRegion> }) {
  const { t, text, locale, people } = useI18n();
  const { num, country, soldiers } = useArmyWords(state);
  const wars = playerWars(state);
  const strain = regions ? strainOf(state, state.player, peopleOf(state, regions, state.player)) : null;
  const mobilised = strain && (strain.months > 0 || strain.strain > 0) ? <Mobilisation strain={strain} /> : null;
  if (!wars.length) return mobilised ?? <p className="text-xs font-medium text-muted">{t("fronts.peace")}</p>;

  const show = (column: Column) => (n: number) => (column === "heavy" ? num(Math.round(n)) : soldiers(n));
  const cell = (e: Estimate | undefined, column: Column, turn: boolean) => {
    if (!e) return <span className="block text-2xs font-bold text-muted">{turn ? "–" : "0"}</span>;
    const fmt = show(column);
    const value = e.value > 0 ? fmt(e.value) : "0";
    return (
      <span className={turn ? "block whitespace-nowrap text-2xs font-bold text-muted" : "block whitespace-nowrap font-bold text-ink"} title={e.exact ? undefined : t("foreign.estimate", { low: fmt(e.low), high: fmt(e.high) })}>
        {e.exact ? "" : "≈ "}
        {turn && e.value > 0 ? "+" : ""}
        {value}
      </span>
    );
  };
  const armsText = (kind: WeaponKind, n: number) => (kind === "rifles" ? people(n) : num(Math.round(n)));

  return (
    <div className="flex flex-col gap-4">
      {mobilised}
      {wars.map((w: War) => {
        const { mine, theirs } = sidesOf(state, w);
        const rows = [...mine, ...theirs].map((c) => ({ c, total: lossesView(state, w, c), turn: turnLossesView(state, w, c) })).filter((r) => r.total);
        // Prisoners get a column once an army in rout has given them up.
        const taken = rows.some((r) => (w.losses?.[r.c]?.captured ?? 0) >= 0.5);
        const columns: Column[] = ["killed", "wounded", ...(taken ? (["captured"] as const) : []), "heavy"];
        const kept = Object.values(w.losses ?? {}).some((l) => l.last);
        const header: Record<Column, MessageKey> = { killed: "foreign.killed", wounded: "foreign.wounded", captured: "foreign.captured", heavy: "losses.heavy" };
        // Equipment by kind where it is known exactly: the player's own, and everyone's without the fog.
        const known = rows.filter((r) => r.total?.heavy.exact && Object.values(w.losses?.[r.c]?.arms ?? {}).some((n) => (n ?? 0) >= 0.5));
        return (
          <section key={w.id} className="grid grid-cols-1 gap-2 rounded-xl bg-page p-3">
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0 text-sm font-black text-ink">{text(w.name)}</span>
              {w.truce && (
                <span className="shrink-0 rounded-md bg-amber-50 px-2 py-0.5 text-2xs font-black uppercase tracking-wider text-amber-700">{t("foreign.truceUntil", { date: formatDate(w.truce.until, locale) })}</span>
              )}
            </div>
            {rows.length ? (
              <>
                <p className="text-2xs font-medium text-muted">{t("losses.legend")}</p>
                <table className="w-full table-fixed text-xs">
                  <thead>
                    <tr className="text-left text-2xs font-bold text-muted">
                      <th className="w-[26%] pb-1" />
                      {columns.map((k) => (
                        <th key={k} className="truncate pb-1 pl-1 text-right font-bold" title={t(header[k])}>
                          {t(header[k])}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ c, total, turn }) => (
                      <tr key={c} className="border-t border-divider align-top">
                        <td className="py-1">
                          <span className="flex min-w-0 items-center gap-1.5">
                            <CountryFlag state={state} tag={c} />
                            <span className="min-w-0 truncate font-bold text-ink">{country(c)}</span>
                          </span>
                        </td>
                        {columns.map((k) => (
                          <td key={k} className="py-1 text-right tabular-nums">
                            {cell(total?.[k], k, false)}
                            {kept && cell(turn?.[k] ?? (w.truce ? undefined : { value: 0, low: 0, high: 0, exact: true }), k, true)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!kept && !w.truce && <p className="text-2xs font-medium text-muted">{t("losses.noTurn")}</p>}
                {known.map(({ c }) => {
                  const all = w.losses?.[c]?.arms ?? {};
                  const last = lastLosses(state, w, c)?.arms ?? {};
                  const kinds = WEAPON_KINDS.filter((k) => (all[k] ?? 0) >= 0.5);
                  return (
                    <div key={c} className="border-t border-divider pt-2">
                      <div className={`${ui.label} mb-1 flex items-center gap-1.5`}>
                        <CountryFlag state={state} tag={c} />
                        {t("losses.arms")}
                      </div>
                      <ul className="flex flex-wrap gap-1">
                        {kinds.map((k) => {
                          const Icon = ARMS_ICONS[k];
                          return (
                            <li key={k} className="inline-flex items-center gap-1 rounded-md border border-line sheet px-1.5 py-0.5 text-2xs font-bold text-muted">
                              <Icon className="h-3 w-3 shrink-0" />
                              <span>{t(`arms.kind.${k}` as MessageKey)}</span>
                              <span className="tabular-nums text-ink">{armsText(k, all[k]!)}</span>
                              {(last[k] ?? 0) >= 0.5 && <span className="tabular-nums text-red-600">+{armsText(k, last[k]!)}</span>}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </>
            ) : (
              <p className="text-xs font-medium text-muted">{t("foreign.noLosses")}</p>
            )}
            <Civilians state={state} war={w} sides={[...mine, ...theirs]} />
          </section>
        );
      })}
    </div>
  );
}

/** A figure with, under it, the last turn's part: the same estimate the soldiers' table shows. */
function Figure({ e, turn, fmt }: { e: Estimate; turn?: Estimate; fmt: (n: number) => string }) {
  const { t } = useI18n();
  return (
    <>
      <span className="block whitespace-nowrap font-bold text-ink" title={e.exact ? undefined : t("foreign.estimate", { low: fmt(e.low), high: fmt(e.high) })}>
        {e.exact ? "" : "≈ "}
        {e.value > 0 ? fmt(e.value) : "0"}
      </span>
      <span className="block whitespace-nowrap text-2xs font-bold text-muted">{turn && turn.value > 0 ? `+${fmt(turn.value)}` : "–"}</span>
    </>
  );
}

/** What a war has cost the people of each side: the dead with their main causes, and those who fled the fighting (engine/civilians.ts). */
function Civilians({ state, war, sides }: { state: GameState; war: War; sides: string[] }) {
  const { t } = useI18n();
  const { country, soldiers } = useArmyWords(state);
  const rows = sides.map((c) => ({ c, v: civiliansView(state, war, c) })).filter((r) => r.v);
  if (!rows.length) return null;
  const fmt = soldiers;
  return (
    <div className="border-t border-divider pt-2">
      <div className={`${ui.label} mb-1`}>{t("losses.civilians")}</div>
      <p className="mb-1 text-2xs font-medium text-muted">{t("losses.civilLegend")}</p>
      <table className="w-full table-fixed text-xs">
        <thead>
          <tr className="text-left text-2xs font-bold text-muted">
            <th className="w-[40%] pb-1" />
            <th className="pb-1 pl-1 text-right font-bold">{t("losses.civilDead")}</th>
            <th className="pb-1 pl-1 text-right font-bold">{t("losses.civilFled")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ c, v }) => {
            const by = war.civilians?.[c]?.by ?? {};
            // The causes only where they are known exactly: the player's own, and everyone's without the fog.
            const causes = v!.dead.exact ? CIVIL_CAUSES.filter((k) => (by[k] ?? 0) >= 0.05) : [];
            return (
              <tr key={c} className="border-t border-divider align-top">
                <td className="py-1">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <CountryFlag state={state} tag={c} />
                    <span className="min-w-0 truncate font-bold text-ink">{country(c)}</span>
                  </span>
                  {causes.length > 0 && <span className="mt-0.5 block text-2xs font-medium text-muted">{causes.map((k) => `${t(`losses.cause.${k}` as MessageKey)} ${fmt(by[k]!)}`).join(" · ")}</span>}
                </td>
                <td className="py-1 text-right tabular-nums">
                  <Figure e={v!.dead} turn={v!.turn?.dead} fmt={fmt} />
                </td>
                <td className="py-1 text-right tabular-nums">
                  <Figure e={v!.fled} turn={v!.turn?.fled} fmt={fmt} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** The strain of the player's mobilisation: how many are under arms and for how long, what the wars took, and the strain itself (engine/mobilisation.ts). */
function Mobilisation({ strain }: { strain: NonNullable<ReturnType<typeof strainOf>> }) {
  const { t } = useI18n();
  const pct = (v: number) => Math.round(v * 1000) / 10;
  const tone = strain.strain >= 60 ? "bg-red-600" : strain.strain >= 35 ? "bg-amber-500" : "bg-accent";
  return (
    <section className="grid grid-cols-1 gap-1.5 rounded-xl bg-page p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-black text-ink">{t("mobilisation.title")}</span>
        <span className="shrink-0 text-2xs font-black tabular-nums text-muted">{t("mobilisation.strain", { n: strain.strain })}</span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-divider">
        <div className={`h-full ${tone}`} style={{ width: `${strain.strain}%` }} />
      </div>
      <div className="grid grid-cols-1 gap-0.5 text-2xs font-bold tabular-nums text-muted">
        <span>{t("mobilisation.share", { n: pct(strain.share), m: pct(strain.norm) })}</span>
        <span>{t("mobilisation.months", { n: Math.round(strain.months) })}</span>
        {strain.lost > 0 && <span>{t("mobilisation.lost", { n: Math.round(strain.lost * 10000) / 100 })}</span>}
      </div>
      <p className="text-2xs font-medium text-muted">{t("mobilisation.hint")}</p>
    </section>
  );
}

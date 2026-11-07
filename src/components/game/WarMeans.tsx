"use client";

import { useMemo, type ReactNode } from "react";
import { ui } from "@/components/ui/classes";
import { Term, TextTip } from "@/components/ui/Term";
import { fogOn } from "@/engine/fog";
import { provinceDays, warFront, warPace, type PaceReason } from "@/engine/fronts";
import type { GameState, MapIndex, War } from "@/engine/types";
import { warMeans, type SideMeans } from "@/engine/warMeans";
import type { TermId } from "@/i18n/glossary";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";

/** The figures shown for each side, with the glossary term that explains each. */
const ROWS: { key: keyof Pick<SideMeans, "ready" | "reach" | "will" | "weary" | "rear">; label: MessageKey; term: TermId; unit: string }[] = [
  { key: "ready", label: "means.ready", term: "readiness", unit: "%" },
  { key: "reach", label: "means.reach", term: "reach", unit: "%" },
  { key: "will", label: "means.will", term: "will", unit: "" },
  { key: "weary", label: "means.weary", term: "weariness", unit: "" },
  { key: "rear", label: "means.rear", term: "resistance", unit: "%" },
];

interface WarMeansProps {
  state: GameState;
  war: War;
  /** The map, for each side's reach from home; without it reach reads as full. */
  index: MapIndex | null;
  /** How each side is labelled, attackers first: flags, or "ours" and "theirs". */
  labels: [ReactNode, ReactNode];
  /** Put the player's side first (the army's view); the attackers come first otherwise. */
  oursFirst?: boolean;
}

/**
 * Each side's means in a war, briefly (engine/warMeans.ts): readiness, reach
 * from home, the will to fight, war-weariness and the troops partisans tie
 * down, one line each with its glossary term's hint. The player's own side is exact;
 * with the fog of war on, the others' figures are the intelligence's
 * estimate, to the nearest ten. Under them, the pace of the front in plain
 * words: stalemate, attrition, breakthrough or pursuit, the side advancing,
 * and why (engine/fronts.ts warPace).
 */
export default function WarMeans({ state, war, index, labels, oursFirst = false }: WarMeansProps) {
  const { t } = useI18n();
  const means = useMemo(() => warMeans(state, war, index, index ? warFront(state, index, war) : []), [state, war, index]);
  const pace = useMemo(() => (index && !war.truce ? warPace(state, index, war) : null), [state, war, index]);
  const sides: [SideMeans, ReactNode, boolean][] = [
    [means.attackers, labels[0], war.attackers.includes(state.player)],
    [means.defenders, labels[1], war.defenders.includes(state.player)],
  ];
  if (oursFirst && war.defenders.includes(state.player)) sides.reverse();
  const fog = fogOn(state);
  return (
    <div>
      <div className={`${ui.label} mb-1`}>{t("means.title")}</div>
      <table className="w-full table-fixed text-xs">
        <thead>
          <tr className="text-2xs font-black uppercase tracking-wider text-muted">
            <th className="w-[44%] pb-1" />
            {sides.map(([, label], i) => (
              <th key={i} className="pb-1 text-right align-bottom font-black">
                <span className="inline-flex justify-end">{label}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.key} className="border-t border-divider">
              <td className="truncate py-0.5 font-medium text-muted">
                <Term id={row.term}>{t(row.label)}</Term>
              </td>
              {sides.map(([side, , mine], i) => {
                const rough = fog && !mine;
                const v = rough ? Math.round(side[row.key] / 10) * 10 : side[row.key];
                return (
                  <td key={i} className="py-0.5 text-right font-bold tabular-nums text-ink" title={rough ? t("means.estimate") : undefined}>
                    {rough ? "≈ " : ""}
                    {v}
                    {row.unit}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {means.attackers.limited && (
        <p className="mt-1 text-2xs font-bold text-muted">
          <TextTip text={t("means.limitedHint")} className="cursor-help underline decoration-dotted decoration-1 underline-offset-2">
            {t("means.limited")}
          </TextTip>
        </p>
      )}
      {pace && (
        <div className="mt-2 border-t border-divider pt-1.5 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
            <TextTip text={t("pace.hint")} label={t("pace.title")} className="cursor-help font-black text-ink underline decoration-dotted decoration-1 underline-offset-2">
              {t("pace.title")}: {t(`pace.${pace.phase}`)}
            </TextTip>
            {pace.side && (
              <span className="inline-flex items-center gap-1 text-2xs font-bold text-muted">
                {t("pace.advancing")} {pace.side === "attackers" ? labels[0] : labels[1]}
              </span>
            )}
          </div>
          <p className="mt-0.5 font-medium text-muted">{t(`pace.${pace.phase}Note`)}</p>
          {pace.reasons.length > 0 && <p className="mt-0.5 font-medium text-muted">{t("pace.why", { reasons: pace.reasons.map((r: PaceReason) => t(`pace.reason.${r}`)).join(", ") })}</p>}
          {pace.side && (
            <p className="mt-0.5 text-2xs font-bold tabular-nums text-muted">{pace.rate >= 100 ? t("pace.days", { n: provinceDays(pace.rate) }) : t("pace.rate", { n: pace.rate })}</p>
          )}
        </div>
      )}
    </div>
  );
}

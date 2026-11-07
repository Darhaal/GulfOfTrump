"use client";

import { useMemo } from "react";
import { ui } from "@/components/ui/classes";
import { TextTip } from "@/components/ui/Term";
import { ladderView, rungs, type RedState } from "@/engine/nuclear";
import type { GameState, MapIndex, War } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import { CountryFlag } from "./common";

/** How a red line is drawn: far plain, near in the accent, crossed in the war's red. */
const TONE: Record<RedState, string> = {
  far: "bg-divider text-muted",
  near: "bg-accent/15 text-accent",
  crossed: "bg-war/15 text-war",
};

interface NuclearLinesProps {
  state: GameState;
  war: War;
  index: MapIndex | null;
}

/**
 * The atomic powers in one of the player's wars, other than its own
 * government (engine/nuclear.ts): the rungs each has climbed – "Russia:
 * threats – alert raised" – its doctrine, and its red lines, each far, near
 * or crossed. Nothing when no atomic power the computer governs fights in it.
 */
export default function NuclearLines({ state, war, index }: NuclearLinesProps) {
  const { t, text } = useI18n();
  const views = useMemo(() => ladderView(state, war, index), [state, war, index]);
  if (!views.length) return null;
  const name = (tag: string) => text(state.countries[tag]?.name ?? tag);
  const steps = (step: number) => rungs(step).map((s) => t(`nuclear.step.${s}` as MessageKey));

  return (
    <div>
      <div className={`${ui.label} mb-1`}>
        <TextTip text={t("nuclear.hint")} label={t("nuclear.title")} className="cursor-help">
          {t("nuclear.title")}
        </TextTip>
      </div>
      <ul className="grid grid-cols-1 gap-1.5">
        {views.map((v) => (
          <li key={v.tag} className="rounded-lg border border-line sheet px-2.5 py-2">
            <div className="flex items-start gap-1.5">
              <span className="mt-0.5 shrink-0">
                <CountryFlag state={state} tag={v.tag} />
              </span>
              <span className={`min-w-0 text-xs font-black ${v.step >= 4 ? "text-war" : v.step > 0 ? "text-accent" : "text-ink"}`}>
                {name(v.tag)}: {v.step > 0 ? steps(v.step).join(" – ") : t("nuclear.calm")}
              </span>
            </div>
            <div className="mt-0.5 text-2xs font-bold text-muted">
              {t(`nuclear.doctrine.${v.doctrine}` as MessageKey)}
              {v.top > v.step && <> · {t("nuclear.top", { step: steps(v.top).at(-1) ?? "" })}</>}
            </div>
            {v.noFirstUse && <div className="text-2xs font-medium text-muted">{t("nuclear.nfu")}</div>}
            {v.red.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {v.red.map((r) => (
                  <span key={r.line} title={t(`nuclear.state.${r.state}` as MessageKey)} className={`rounded-md px-1.5 py-0.5 text-2xs font-black ${TONE[r.state]}`}>
                    {t(`nuclear.line.${r.line}` as MessageKey)}
                  </span>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

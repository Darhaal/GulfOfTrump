"use client";

import { TIME_STEPS } from "@/engine/calendar";
import type { TimeStep } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";

/**
 * How long the coming turn lasts, as five small squares in the map's column
 * of controls, under the zoom buttons (WorldMap's `controls`).
 */
export default function TurnLength({ step, disabled, onStep }: { step: TimeStep; disabled: boolean; onStep: (step: TimeStep) => void }) {
  const { t, locale } = useI18n();
  return (
    <div data-tour="turn-length" role="radiogroup" aria-label={t("game.step")} className="flex items-center gap-1.5">
      {/* Five small squares the size of the map's zoom buttons; the full length shows on hover, right-aligned so it never leaves the map. */}
      {TIME_STEPS.map((s) => {
        const hint = t("game.step.hint", { step: t(`game.step.${s}` as MessageKey).toLocaleLowerCase(locale) });
        return (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={s === step}
            aria-label={hint}
            disabled={disabled}
            onClick={() => onStep(s)}
            className={`group relative grid h-9 w-9 place-items-center rounded-xl border text-2xs font-black tabular-nums shadow-sm transition-all disabled:opacity-60 ${s === step ? "border-ink bg-ink text-on-ink" : "border-line sheet text-muted hover:border-accent/30 hover:text-accent"}`}
          >
            {t(`game.step.short.${s}` as MessageKey)}
            <span className="pointer-events-none absolute bottom-full right-0 mb-1.5 hidden whitespace-nowrap rounded-lg border border-line sheet px-2 py-1 text-2xs font-bold text-ink shadow-sm group-hover:block group-focus-visible:block">
              {hint}
            </span>
          </button>
        );
      })}
    </div>
  );
}

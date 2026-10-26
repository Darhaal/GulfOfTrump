"use client";

import { GraduationCap } from "lucide-react";
import { formatDayMonth } from "@/engine/calendar";
import { getScenario, startsOf } from "@/engine/scenarios";
import type { ScenarioId, StartVariant } from "@/engine/types";
import { useI18n } from "@/i18n/useI18n";

/**
 * The starts of one date over its scene: the week before and the day itself,
 * each by its day and month, and on 2022 the tutorial by its name, the chosen
 * one lit in the brand's orange on a dark glass track. Nothing shows for a
 * date with one start.
 */
export default function StartPills({
  id,
  value,
  onChange,
  className = "",
}: {
  id: ScenarioId;
  value: StartVariant | null;
  onChange: (variant: StartVariant | null) => void;
  className?: string;
}) {
  const { t, locale } = useI18n();
  const starts = startsOf(id);
  if (starts.length < 2) return null;
  return (
    <div role="radiogroup" aria-label={t("start.label")} className={`inline-flex flex-wrap items-center gap-0.5 rounded-full bg-night/55 p-0.5 ring-1 ring-white/15 backdrop-blur-sm ${className}`}>
      {starts.map((variant) => {
        const on = variant === value;
        // A start played as one country is named, not dated: it is the same day as the date's own.
        const guided = variant !== null && Boolean(getScenario(id, variant).player);
        return (
          <button
            key={variant ?? "day"}
            type="button"
            role="radio"
            aria-checked={on}
            data-start={variant ?? "day"}
            title={t(guided ? "start.tutorial.hint" : variant ? "start.eve" : "start.day")}
            onClick={(e) => {
              // The pills sit on the card's link: choosing a start is not following it.
              e.preventDefault();
              e.stopPropagation();
              onChange(variant);
            }}
            className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-2xs font-black uppercase tracking-wider tabular-nums transition-all duration-200 ${
              on ? "bg-accent text-on-ink shadow-sm shadow-night/40" : "text-white/70 hover:bg-white/10 hover:text-white"
            }`}
          >
            {guided && <GraduationCap className="h-3 w-3" aria-hidden />}
            {guided ? t("start.tutorial") : formatDayMonth(getScenario(id, variant).startDate, locale)}
          </button>
        );
      })}
    </div>
  );
}

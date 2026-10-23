"use client";

import { Loader2, Sparkles } from "lucide-react";
import { ui } from "@/components/ui/classes";
import { formatDate } from "@/engine/calendar";
import { useI18n } from "@/i18n/useI18n";

/**
 * "Refine with the game master": a panel asks the game master to describe
 * what it shows now, and keeps the answer with its date. Any panel can use
 * it: give the label, whether the request is running, when the panel's data
 * was last described, and what to do on a click (a request through its own
 * route, like /api/game/army, kept in the save).
 */
export default function RefineButton({ label, busy, disabled, asOf, onClick }: { label: string; busy: boolean; disabled?: boolean; asOf?: string; onClick: () => void }) {
  const { t, locale } = useI18n();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={onClick} disabled={disabled || busy} className={`${ui.secondary} px-3 py-2 text-xs`}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        {busy ? t("refine.busy") : label}
      </button>
      {asOf && !busy && <span className="text-2xs font-bold text-muted">{t("refine.asOf", { date: formatDate(asOf, locale) })}</span>}
    </div>
  );
}

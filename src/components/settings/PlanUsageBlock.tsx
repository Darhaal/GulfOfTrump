"use client";

import { Hourglass } from "lucide-react";
import { ui } from "@/components/ui/classes";
import type { Locale } from "@/engine/types";
import { clockText, untilText } from "@/i18n/countdown";
import { useI18n } from "@/i18n/useI18n";
import { useNow, usePlanUsage } from "@/lib/planUsage";
import type { UsageWindow } from "@/server/chatgpt/limits";

/** A window's name from its length: "5-hour limit", "Weekly limit"; short or long when ChatGPT gives no length. */
function windowName(t: ReturnType<typeof useI18n>["t"], locale: Locale, w: UsageWindow): string {
  const minutes = w.windowMinutes;
  if (!minutes) return t(w.kind === "primary" ? "usage.window.primary" : "usage.window.secondary");
  if (minutes === 7 * 24 * 60) return t("usage.window.week");
  if (minutes >= 24 * 60 && minutes % (24 * 60) === 0) return t("usage.window.days", { n: minutes / (24 * 60) });
  return t("usage.window.hours", { n: (Math.round((minutes / 60) * 10) / 10).toLocaleString(locale) });
}

/**
 * Settings' "ChatGPT plan": how much of each limit window is used, when it
 * resets, and when the numbers were last heard (lib/planUsage.ts). When
 * ChatGPT sends none, it says so instead of drawing empty bars. `offline`:
 * the offline game master stands in while the limit lasts.
 */
export default function PlanUsageBlock({ mock = false, offline = false }: { mock?: boolean; offline?: boolean }) {
  const { t, locale } = useI18n();
  const { usage, failed } = usePlanUsage();
  const now = useNow(1000);
  const limit = usage?.limit && (usage.limit.resetsAt === undefined || usage.limit.resetsAt > now) ? usage.limit : null;
  // The mock game master has no plan; it shows one only when GOT_MOCK_PLAN pretends.
  if (mock && !usage?.windows.length && !limit) return null;

  return (
    <div className="grid gap-3 rounded-xl border border-line bg-page p-3">
      <div className={ui.label}>{t("usage.title")}</div>

      {limit && (
        <p className="flex items-start gap-2 rounded-lg border border-war/40 bg-war/10 p-2.5 text-xs font-bold text-war">
          <Hourglass className="mt-px h-3.5 w-3.5 shrink-0" />
          {limit.resetsAt !== undefined
            ? t("usage.limit", { time: untilText(locale, limit.resetsAt - now), at: clockText(locale, limit.resetsAt, now) })
            : t("usage.limitUnknown")}
        </p>
      )}
      {offline && <p className="text-xs font-bold text-ink">{t("usage.offline")}</p>}

      {usage?.windows.map((w) => {
        const over = w.resetsAt !== undefined && w.resetsAt <= now;
        const used = over ? 0 : w.usedPercent;
        const near = used >= 90;
        const name = windowName(t, locale, w);
        return (
          <div key={w.kind}>
            <div className="flex items-baseline justify-between gap-3 text-xs font-bold text-ink">
              <span>{name}</span>
              <span className={`tabular-nums ${near ? "text-war" : "text-muted"}`}>{t("usage.used", { n: Math.floor(used) })}</span>
            </div>
            <div
              role="progressbar"
              aria-label={name}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.floor(used)}
              className="mt-1.5 h-2 overflow-hidden rounded-full bg-divider"
            >
              <div className={`h-full rounded-full transition-all ${near ? "bg-war" : used >= 75 ? "bg-accent" : "bg-ink"}`} style={{ width: `${used}%` }} />
            </div>
            {w.resetsAt !== undefined && (
              <div className="mt-1 text-2xs font-medium text-muted">
                {over
                  ? t("usage.reset", { at: clockText(locale, w.resetsAt, now) })
                  : t("usage.resetsIn", { time: untilText(locale, w.resetsAt - now, true), at: clockText(locale, w.resetsAt, now) })}
              </div>
            )}
          </div>
        );
      })}

      <p className="text-xs font-medium leading-relaxed text-muted">
        {usage === null
          ? failed
            ? t("usage.failed")
            : "…"
          : usage.windows.length && usage.seenAt
            ? t("usage.seen", { at: clockText(locale, usage.seenAt, now) })
            : usage.answeredAt
              ? t("usage.none", { at: clockText(locale, usage.answeredAt, now) })
              : t("usage.notYet")}
      </p>
    </div>
  );
}

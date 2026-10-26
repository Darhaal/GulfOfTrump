"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { useEffect } from "react";
import { ui } from "@/components/ui/classes";
import { useI18n } from "@/i18n/useI18n";
import { getTelemetry, useTelemetry } from "@/lib/telemetry";

/**
 * Settings → anonymous statistics (lib/telemetry): on or off at any time,
 * off until the player says yes. A copy that cannot send – no Supabase in
 * its build, switched off, the mock game master – says so instead.
 */
export default function TelemetrySection() {
  const { t } = useI18n();
  const { consent, availability, installId, setConsent } = useTelemetry();
  useEffect(() => {
    void getTelemetry()?.check();
  }, []);
  const usable = availability === "checking" || availability === "ready";
  const on = usable && consent === "on";

  return (
    <section className={`${ui.card} p-5 md:p-6`}>
      <h2 className={`${ui.label} mb-4`}>{t("telemetry.title")}</h2>
      <div className="flex flex-wrap gap-1 rounded-xl bg-page p-1" role="radiogroup" aria-label={t("telemetry.title")}>
        {[true, false].map((value) => (
          <button
            key={String(value)}
            type="button"
            role="radio"
            aria-checked={on === value}
            disabled={!usable}
            onClick={() => setConsent(value)}
            className={`${ui.segment} flex-1 disabled:pointer-events-none disabled:opacity-50 ${on === value ? `${ui.segmentOn} bg-surface shadow-sm` : ui.segmentOff}`}
          >
            {t(value ? "telemetry.on" : "telemetry.off")}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs font-medium leading-relaxed text-muted">{usable ? t("telemetry.body") : t("telemetry.unavailable")}</p>
      {on && installId && <p className="mt-1 wrap-anywhere text-xs font-medium text-muted">{t("telemetry.id", { id: installId })}</p>}
      <Link href="/privacy" className="mt-2 inline-flex w-fit items-center gap-1 text-xs font-bold text-ink hover:text-accent">
        <ShieldCheck className="h-3.5 w-3.5" />
        {t("telemetry.privacy")}
      </Link>
    </section>
  );
}

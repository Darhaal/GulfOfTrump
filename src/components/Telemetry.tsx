"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { useEffect } from "react";
import Dialog from "@/components/ui/Dialog";
import { ui } from "@/components/ui/classes";
import { useI18n } from "@/i18n/useI18n";
import { usePreference } from "@/lib/preferences";
import { getTelemetry, track, useTelemetry } from "@/lib/telemetry";

/** Set for the session once its start is counted, so a reload is not another start. */
const STARTED = "got_telemetry_started";

function countStart() {
  try {
    if (sessionStorage.getItem(STARTED)) return;
    sessionStorage.setItem(STARTED, "1");
  } catch {
    // No session storage: a reload may count again.
  }
  track("app_start");
}

/**
 * Anonymous statistics for the whole app (lib/telemetry): counts the start
 * once the player has said yes, sends what waits when the page is left, and
 * on the front page asks once, after the tutorial – only in a copy that can send at all, so runs
 * with GOT_MOCK_AI=1, tests, CI and builds without Supabase never ask. Saying
 * no is as easy as yes, and closing the question is a no.
 */
export default function Telemetry() {
  const { t } = useI18n();
  const pathname = usePathname();
  const { consent, availability, setConsent } = useTelemetry();
  const [tutorial] = usePreference("tutorial");

  // Whether this copy can send is checked only when the answer matters: to ask, or to send.
  useEffect(() => {
    if (consent !== "off" && availability === "checking") void getTelemetry()?.check();
  }, [consent, availability]);

  useEffect(() => {
    if (consent === "on" && (availability === "checking" || availability === "ready")) countStart();
  }, [consent, availability]);

  useEffect(() => {
    const leave = () => void getTelemetry()?.flush(true);
    const hidden = () => document.visibilityState === "hidden" && leave();
    window.addEventListener("pagehide", leave);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("pagehide", leave);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, []);

  // Never over the tutorial: a first visit goes into it from the front page, which asks once the tutorial is behind the player (lib/tutorial.ts).
  const asking = availability === "ready" && consent === "unasked" && pathname === "/" && tutorial === "done";
  return (
    <Dialog
      open={asking}
      onClose={() => setConsent(false)}
      title={t("telemetry.ask.title")}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setConsent(false)} className={`${ui.secondary} px-4 py-2.5 text-sm`}>
            {t("telemetry.no")}
          </button>
          <button type="button" onClick={() => setConsent(true)} className={`${ui.secondary} px-4 py-2.5 text-sm`}>
            {t("telemetry.yes")}
          </button>
        </div>
      }
    >
      <div className="grid gap-3 text-sm font-medium leading-relaxed text-ink">
        <p>{t("telemetry.body")}</p>
        <p className="text-muted">{t("telemetry.ask.later")}</p>
        <Link href="/privacy" className="inline-flex w-fit items-center gap-1 text-xs font-bold text-ink hover:text-accent">
          <ShieldCheck className="h-3.5 w-3.5" />
          {t("telemetry.privacy")}
        </Link>
      </div>
    </Dialog>
  );
}

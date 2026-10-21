"use client";

import { ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { ui } from "@/components/ui/classes";
import { REPO_URL } from "@/constants/app";
import { useI18n } from "@/i18n/useI18n";
import { checkForUpdates, releaseUrl, restartToUpdate, useUpdates } from "@/lib/updates";

/** Settings → the desktop app's version and its updates: check now, see the download, restart into it. */
export default function UpdatesSection() {
  const { t } = useI18n();
  const u = useUpdates();
  if (!u) return null;
  const busy = u.status === "checking" || u.status === "downloading";
  const mb = (u.bytesPerSecond / 1_000_000).toFixed(1);

  return (
    <section className={`${ui.card} p-5 md:p-6`}>
      <h2 className={`${ui.label} mb-4`}>{t("updates.title")}</h2>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-black text-ink tabular-nums">{t("updates.version", { v: u.current })}</div>
        <a href={releaseUrl(REPO_URL, u.current)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-muted hover:text-accent">
          {t("updates.notes")}
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {u.store ? (
        <p className="mt-2 text-xs font-medium text-muted">{t("updates.store")}</p>
      ) : (
        <div className="mt-3 grid gap-3">
          {u.status === "checking" && <p className="flex items-center gap-2 text-xs font-medium text-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" />{t("updates.checking")}</p>}
          {u.status === "none" && <p className="text-xs font-medium text-emerald-700">{t("updates.none")}</p>}
          {u.status === "error" && <p className="text-xs font-medium text-red-600">{t("updates.error")}{u.error ? ` (${u.error})` : ""}</p>}
          {u.status === "downloading" && u.version && (
            <div>
              <div className="flex justify-between gap-3 text-xs font-bold text-ink tabular-nums">
                <span>{t("updates.downloading", { v: u.version, n: Math.round(u.percent) })}</span>
                {u.bytesPerSecond > 0 && <span className="text-muted">{t("updates.speed", { n: mb })}</span>}
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${Math.max(2, u.percent)}%` }} />
              </div>
            </div>
          )}
          {u.status === "ready" && u.version ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-bold text-ink">{t("updates.ready", { v: u.version })}</span>
              <button type="button" onClick={() => void restartToUpdate()} className={`${ui.primary} px-3 py-2 text-xs`}>
                {t("updates.restart")}
              </button>
              <span className="text-2xs font-medium text-muted">{t("updates.laterNote")}</span>
            </div>
          ) : (
            u.enabled && (
              <button type="button" disabled={busy} onClick={() => void checkForUpdates()} className={`${ui.secondary} w-fit px-4 py-2.5 text-xs disabled:opacity-50`}>
                <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
                {u.status === "error" ? t("updates.retry") : t("updates.check")}
              </button>
            )
          )}
        </div>
      )}
    </section>
  );
}

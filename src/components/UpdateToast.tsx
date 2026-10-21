"use client";

import { Download, ExternalLink, RotateCw, Sparkles, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { REPO_URL } from "@/constants/app";
import { useI18n } from "@/i18n/useI18n";
import { releaseUrl, restartToUpdate, updateSeen, useUpdates } from "@/lib/updates";
import { ui } from "./ui/classes";

/**
 * The desktop app's update, where the player sees it: the download with its
 * percent, then "ready — restart now or later", and on the first start of a
 * new version what it came from and a link to what's new. Nothing in a
 * browser; checks and errors live in Settings.
 */
export default function UpdateToast() {
  const { t } = useI18n();
  const u = useUpdates();
  const [later, setLater] = useState<string | null>(null);
  if (!u || u.store) return null;

  if (u.updatedFrom) {
    return (
      <Toast>
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-black text-ink">{t("updates.updated", { v: u.current })}</div>
          <div className="text-xs font-medium text-muted">{t("updates.from", { v: u.updatedFrom })}</div>
          <a href={releaseUrl(REPO_URL, u.current)} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-accent hover:underline">
            {t("updates.notes")}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <button type="button" onClick={updateSeen} aria-label={t("updates.later")} className="-m-1 rounded-lg p-1 text-muted hover:bg-warm hover:text-ink">
          <X className="h-4 w-4" />
        </button>
      </Toast>
    );
  }

  if (u.status === "downloading" && u.version) {
    return (
      <Toast>
        <Download className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold text-ink tabular-nums">{t("updates.downloading", { v: u.version, n: Math.round(u.percent) })}</div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${Math.max(2, u.percent)}%` }} />
          </div>
        </div>
      </Toast>
    );
  }

  if (u.status === "ready" && u.version && later !== u.version) {
    return (
      <Toast>
        <RotateCw className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-black text-ink">{t("updates.ready", { v: u.version })}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => void restartToUpdate()} className={`${ui.primary} px-3 py-2 text-xs`}>
              {t("updates.restart")}
            </button>
            <button type="button" onClick={() => setLater(u.version)} className={`${ui.secondary} px-3 py-2 text-xs`} title={t("updates.laterNote")}>
              {t("updates.later")}
            </button>
          </div>
          <div className="mt-2 text-2xs font-medium text-muted">{t("updates.laterNote")}</div>
        </div>
      </Toast>
    );
  }
  return null;
}

/** In the page's body: the header's backdrop blur would otherwise pin it to the header. */
function Toast({ children }: { children: ReactNode }) {
  return createPortal(
    <div role="status" className={`${ui.card} fixed bottom-4 right-4 z-50 flex w-[min(22rem,calc(100vw-2rem))] items-start gap-3 p-4 shadow-2xl animate-in fade-in slide-in-from-bottom-2`}>
      {children}
    </div>,
    document.body,
  );
}

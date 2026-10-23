"use client";

import { Download, Store } from "lucide-react";
import { DOWNLOAD_URL, isDemo, STORE_URL } from "@/constants/app";
import { useI18n } from "@/i18n/useI18n";
import { ui } from "./ui/classes";

/**
 * The public demo's way to the real game: the Windows installer of the
 * latest release, and beside it the same app in the Microsoft Store.
 * "primary" is the one prominent button of a screen, "quiet" a smaller one
 * beside other controls, "link" a line of text. Nothing is shown outside the
 * demo: the app is already the real game.
 */
export default function DownloadButton({ variant = "quiet", why = false, className = "" }: { variant?: "primary" | "quiet" | "link"; why?: boolean; className?: string }) {
  const { t } = useI18n();
  if (!isDemo()) return null;
  const look =
    variant === "primary"
      ? `${ui.primary} bg-accent! px-5 py-3 text-sm hover:bg-ink!`
      : variant === "quiet"
        ? `${ui.secondary} border-accent/40! px-3 py-2 text-xs text-accent! hover:border-accent!`
        : "inline-flex items-center gap-1.5 font-bold text-accent underline-offset-2 hover:underline";
  const storeLook = variant === "primary" ? `${ui.secondary} px-5 py-3 text-sm` : look;
  const icon = variant === "primary" ? "h-4 w-4" : "h-3.5 w-3.5";
  return (
    <span className={`inline-flex flex-col items-start gap-1.5 ${className}`}>
      <span className={`flex flex-wrap items-center ${variant === "link" ? "gap-x-3 gap-y-1" : "gap-2"}`}>
        <a href={DOWNLOAD_URL} target="_blank" rel="noreferrer" className={look}>
          <Download className={icon} />
          {variant === "quiet" ? <span>{t("download.short")}</span> : t("download.windows")}
        </a>
        <a href={STORE_URL} target="_blank" rel="noreferrer" className={storeLook}>
          <Store className={icon} />
          {variant === "quiet" ? <span>{t("download.storeShort")}</span> : t("download.store")}
        </a>
      </span>
      {why && <span className="max-w-sm text-xs font-medium leading-snug text-muted">{t("download.why")}</span>}
    </span>
  );
}

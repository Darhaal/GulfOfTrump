"use client";

import Link from "next/link";
import { ArrowLeft, Info, Settings } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "@/i18n/useI18n";
import { DOWNLOAD_URL, isDemo } from "@/constants/app";
import { usePreference } from "@/lib/preferences";
import AiStatusChip from "./AiStatusChip";
import AppDialogs, { openAppDialog } from "./AppDialogs";
import DownloadButton from "./DownloadButton";
import QuitButton from "./QuitButton";
import UpdateToast from "./UpdateToast";
import { ui } from "./ui/classes";

interface AppHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: string;
  actions?: ReactNode;
  /** Buttons at the right end, after settings: the game's flag for reporting the game master's text. */
  trailing?: ReactNode;
  /** The demo strip's words on this screen instead of the general ones: a played game says which turns were written for it (lib/played.ts). */
  demoNote?: string;
}

/** The sticky header of every screen: back button, title, actions, AI status, about and settings (as popups). */
export default function AppHeader({ title, subtitle, back, actions, trailing, demoNote }: AppHeaderProps) {
  const { t } = useI18n();
  const [demoChosen] = usePreference("demo");
  return (
    <header className="sticky top-0 z-30 w-full sheet border-b border-line shadow-sm">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-3 px-4">
        {back && (
          <Link href={back} className={ui.iconButton} aria-label={t("nav.back")} title={t("nav.back")}>
            <ArrowLeft className="h-5 w-5 text-muted group-hover:text-accent" />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-lg md:text-xl font-bold text-ink tracking-tight leading-none">{title}</div>
          {subtitle && <div className="mt-1 truncate text-xs text-muted font-medium">{subtitle}</div>}
        </div>
        {actions}
        <DownloadButton className="max-sm:hidden" />
        <AiStatusChip />
        <button type="button" onClick={() => openAppDialog("about")} className={ui.iconButton} aria-label={t("nav.about")} title={t("nav.about")}>
          <Info className="h-5 w-5 text-muted group-hover:text-accent" />
        </button>
        <button type="button" onClick={() => openAppDialog("settings")} className={ui.iconButton} aria-label={t("nav.settings")} title={t("nav.settings")}>
          <Settings className="h-5 w-5 text-muted group-hover:text-accent" />
        </button>
        {trailing}
        <QuitButton />
      </div>
      <UpdateToast />
      {isDemo() && (
        <div className="border-t border-line bg-accent/10 px-4 py-1.5 text-center text-2xs font-bold text-ink">
          {demoNote ?? t("demo.banner")}{" "}
          <a href={DOWNLOAD_URL} target="_blank" rel="noreferrer" className="whitespace-nowrap text-accent underline-offset-2 hover:underline">
            {t("download.windows")}
          </a>
        </div>
      )}
      {/* The player chose the offline demo in this app (lib/gameMaster.ts). */}
      {!isDemo() && demoChosen === "1" && (
        <div className="border-t border-line bg-accent/10 px-4 py-1.5 text-center text-2xs font-bold text-ink">
          {demoNote ?? t("demo.local")}{" "}
          <button type="button" onClick={() => openAppDialog("settings")} className="whitespace-nowrap text-accent underline-offset-2 hover:underline">
            {t("demo.signIn")}
          </button>
        </div>
      )}
      <AppDialogs />
    </header>
  );
}

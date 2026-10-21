"use client";

import Link from "next/link";
import { ArrowLeft, Info, Settings } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "@/i18n/useI18n";
import { isDemo } from "@/constants/app";
import { usePreference } from "@/lib/preferences";
import AiStatusChip from "./AiStatusChip";
import QuitButton from "./QuitButton";
import { ui } from "./ui/classes";

interface AppHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: string;
  actions?: ReactNode;
}

/** The sticky header of every screen: back button, title, actions, AI status, settings. */
export default function AppHeader({ title, subtitle, back, actions }: AppHeaderProps) {
  const { t } = useI18n();
  const [demoChosen] = usePreference("demo");
  return (
    <header className="sticky top-0 z-30 w-full bg-page/90 backdrop-blur-xl border-b border-line shadow-sm">
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
        <AiStatusChip />
        <Link href="/about" className={ui.iconButton} aria-label={t("nav.about")} title={t("nav.about")}>
          <Info className="h-5 w-5 text-muted group-hover:text-accent" />
        </Link>
        <Link href="/settings" className={ui.iconButton} aria-label={t("nav.settings")} title={t("nav.settings")}>
          <Settings className="h-5 w-5 text-muted group-hover:text-accent" />
        </Link>
        <QuitButton />
      </div>
      {isDemo() && (
        <div className="border-t border-line bg-accent/10 px-4 py-1.5 text-center text-2xs font-bold text-ink">
          {t("demo.banner")}{" "}
          <Link href="/#real" className="whitespace-nowrap text-accent underline-offset-2 hover:underline">
            {t("demo.how")}
          </Link>
        </div>
      )}
      {/* The player chose the offline demo in this app (lib/gameMaster.ts). */}
      {!isDemo() && demoChosen === "1" && (
        <div className="border-t border-line bg-accent/10 px-4 py-1.5 text-center text-2xs font-bold text-ink">
          {t("demo.local")}{" "}
          <Link href="/settings" className="whitespace-nowrap text-accent underline-offset-2 hover:underline">
            {t("demo.signIn")}
          </Link>
        </div>
      )}
    </header>
  );
}

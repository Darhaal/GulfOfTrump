"use client";

import { Power } from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/i18n/useI18n";
import { useDesktopWindow } from "@/lib/desktop";
import Dialog from "./ui/Dialog";
import { ui } from "./ui/classes";

/** Quitting the desktop app: a full-screen window has no close button of its own. Nothing in a browser. */
export default function QuitButton() {
  const { t } = useI18n();
  const { desktop } = useDesktopWindow();
  const [asking, setAsking] = useState(false);
  if (!desktop) return null;
  return (
    <>
      <button type="button" onClick={() => setAsking(true)} className={ui.iconButton} aria-label={t("nav.quit")} title={t("nav.quit")}>
        <Power className="h-5 w-5 text-muted group-hover:text-accent" />
      </button>
      <Dialog
        open={asking}
        onClose={() => setAsking(false)}
        title={t("quit.title")}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAsking(false)} className={`${ui.secondary} px-4 py-2.5 text-sm`}>
              {t("quit.cancel")}
            </button>
            <button type="button" onClick={() => void desktop.quit()} className={`${ui.primary} px-4 py-2.5 text-sm`}>
              {t("quit.confirm")}
            </button>
          </div>
        }
      >
        <p className="text-sm font-medium text-muted">{t("quit.body")}</p>
      </Dialog>
    </>
  );
}

"use client";

import { LogOut, Undo2 } from "lucide-react";
import { useState } from "react";
import Dialog from "@/components/ui/Dialog";
import { ui } from "@/components/ui/classes";
import { useI18n } from "@/i18n/useI18n";

/**
 * Stepping down, for any role (engine/fate.ts): asked once in the app's own
 * dialog, then waiting for the next turn, when it happens, and undone until
 * then.
 */
export default function ResignButton({ resigning, disabled, label, body, onResign, onStay }: { resigning: boolean; disabled: boolean; label: string; body: string; onResign: () => void; onStay: () => void }) {
  const { t } = useI18n();
  const [asking, setAsking] = useState(false);
  if (resigning) {
    return (
      <section className="flex items-center justify-between gap-2 rounded-2xl bg-page p-3">
        <span className="text-xs font-bold text-ink">{t("figure.resigning")}</span>
        <button type="button" disabled={disabled} onClick={onStay} className={`${ui.secondary} shrink-0 px-3 py-2 text-xs`}>
          <Undo2 className="h-3.5 w-3.5" />
          {t("figure.stay")}
        </button>
      </section>
    );
  }
  return (
    <>
      <button type="button" disabled={disabled} onClick={() => setAsking(true)} className={`${ui.destructive} w-full px-3 py-2.5 text-xs font-bold`}>
        <LogOut className="h-3.5 w-3.5" />
        {label}
      </button>
      <Dialog
        open={asking}
        onClose={() => setAsking(false)}
        title={t("figure.resign.title")}
        footer={
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={() => setAsking(false)} className={`${ui.secondary} w-full py-3 text-sm`}>
              {t("game.cancel")}
            </button>
            <button
              type="button"
              onClick={() => {
                setAsking(false);
                onResign();
              }}
              className={`${ui.primary} w-full py-3 text-sm`}
            >
              <LogOut className="h-4 w-4" />
              {label}
            </button>
          </div>
        }
      >
        <p className="text-sm font-medium leading-relaxed text-ink">{body}</p>
      </Dialog>
    </>
  );
}

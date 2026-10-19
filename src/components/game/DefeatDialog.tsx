"use client";

import Link from "next/link";
import { Crown, Home } from "lucide-react";
import Dialog from "@/components/ui/Dialog";
import { ui } from "@/components/ui/classes";
import { formatDate } from "@/engine/calendar";
import type { GameState } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";

/**
 * The end of the player's government: how it fell, to whom, and how long it
 * lasted. The game is lost; the player may still play on as the new rulers.
 */
export default function DefeatDialog({ state, onContinue }: { state: GameState; onContinue: () => void }) {
  const { t, text, locale } = useI18n();
  const defeat = state.defeat;
  const open = Boolean(defeat && !defeat.continued);
  const player = state.countries[state.player];
  return (
    <Dialog
      open={open}
      onClose={() => undefined}
      title={t("defeat.title")}
      footer={
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link href="/" className={`${ui.secondary} w-full py-3 text-sm`}>
            <Home className="h-4 w-4" />
            {t("defeat.home")}
          </Link>
          <button type="button" onClick={onContinue} className={`${ui.primary} w-full py-3 text-sm`}>
            <Crown className="h-4 w-4" />
            {t("defeat.continue")}
          </button>
        </div>
      }
    >
      {defeat && (
        <div className="flex flex-col gap-3">
          <div className="rounded-xl bg-red-50 p-3">
            <div className="text-sm font-black text-red-700">{t(`change.overthrown.${defeat.how}` as MessageKey, { by: defeat.by })}</div>
            <div className="mt-1 text-xs font-bold tabular-nums text-red-700/80">
              {text(player?.name)} · {formatDate(defeat.date, locale)}
            </div>
          </div>
          {defeat.note && <p className="whitespace-pre-line text-sm font-medium leading-relaxed text-ink">{defeat.note}</p>}
          <p className="text-xs font-medium text-muted">{t("defeat.summary", { turns: defeat.turn, date: formatDate(state.chronicle[0]?.from ?? state.date, locale) })}</p>
          <p className="text-xs font-medium text-muted">{t("defeat.note")}</p>
        </div>
      )}
    </Dialog>
  );
}

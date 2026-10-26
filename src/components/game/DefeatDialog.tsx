"use client";

import Link from "next/link";
import { Crown, Home, Megaphone, Plane } from "lucide-react";
import Dialog from "@/components/ui/Dialog";
import { ui } from "@/components/ui/classes";
import { formatDate } from "@/engine/calendar";
import { chooseHost } from "@/engine/exile";
import { defeatChoices } from "@/engine/fate";
import { personName } from "@/engine/people";
import type { GameState } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import Portrait from "./Portrait";

/**
 * The end of the player's government: how it fell, to whom, and how long it
 * lasted. The player plays on either way: with the country, as its next
 * government, or with the leader who fell, in opposition or in exile with
 * whoever would shelter them (engine/role.ts, engine/exile.ts). A leader who
 * died leaves only the country; one who stepped down leaves both (engine/fate.ts).
 */
export default function DefeatDialog({ state, onContinue, onOpposition, onExile }: { state: GameState; onContinue: () => void; onOpposition: () => void; onExile: () => void }) {
  const { t, text, locale } = useI18n();
  const defeat = state.defeat;
  const open = Boolean(defeat && !defeat.continued);
  const player = state.countries[state.player];
  const fallen = defeat?.fallen;
  const fallenName = fallen ? personName(fallen, locale) : t("defeat.fallenLeader");
  // After a lost vote the old party goes into opposition; after a coup or a revolution, underground.
  const lawful = defeat?.how === "election" || defeat?.how === "deposed" || defeat?.how === "resigned";
  const choices = open ? defeatChoices(state) : [];
  const host = choices.includes("exile") ? chooseHost(state) : undefined;
  const titleKey: MessageKey = defeat?.how === "election" ? "defeat.title.election" : defeat?.how === "resigned" ? "defeat.title.resigned" : defeat?.how === "died" ? "defeat.title.died" : "defeat.title";
  // After a resignation or a death the successor may not be named yet.
  const by = defeat?.by || ((defeat?.how === "resigned" || defeat?.how === "died") ? t("defeat.successorUnknown") : "");
  return (
    <Dialog
      open={open}
      onClose={() => undefined}
      title={t(titleKey)}
      footer={
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={onContinue} className={`${ui.primary} w-full py-3 text-sm`}>
              <Crown className="h-4 w-4" />
              {t("defeat.continue")}
            </button>
            {choices.some((c) => c === "opposition" || c === "underground") && (
              <button type="button" onClick={onOpposition} className={`${ui.secondary} w-full py-3 text-sm`}>
                <Megaphone className="h-4 w-4" />
                {t(lawful ? "defeat.opposition" : "defeat.underground")}
              </button>
            )}
          </div>
          {host && (
            <button type="button" onClick={onExile} className={`${ui.secondary} w-full py-3 text-sm`}>
              <Plane className="h-4 w-4" />
              {t("defeat.exile", { host: text(state.countries[host]?.name) })}
            </button>
          )}
          <Link href="/" className="text-center text-xs font-bold text-muted hover:text-accent">
            <Home className="mr-1 inline h-3.5 w-3.5" />
            {t("defeat.home")}
          </Link>
        </div>
      }
    >
      {defeat && (
        <div className="flex flex-col gap-3">
          <div className="rounded-xl bg-red-50 p-3">
            <div className="text-sm font-black text-red-700">{t(`change.overthrown.${defeat.how}` as MessageKey, { by })}</div>
            <div className="mt-1 text-xs font-bold tabular-nums text-red-700/80">
              {text(player?.name)} · {formatDate(defeat.date, locale)}
            </div>
          </div>
          {defeat.note && <p className="whitespace-pre-line text-sm font-medium leading-relaxed text-ink">{defeat.note}</p>}
          <p className="text-xs font-medium text-muted">{t("defeat.summary", { turns: defeat.turn, date: formatDate(state.chronicle[0]?.from ?? state.date, locale) })}</p>
          <div className="flex items-center gap-3 rounded-xl bg-page p-3">
            <Portrait portrait={fallen?.portrait} gender={fallen?.gender} name={fallenName} size="lg" />
            <p className="text-xs font-medium leading-snug text-ink">{t(defeat.how === "died" ? "defeat.choice.died" : "defeat.choice", { name: fallenName })}</p>
          </div>
        </div>
      )}
    </Dialog>
  );
}

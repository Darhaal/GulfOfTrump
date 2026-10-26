"use client";

import Link from "next/link";
import { Crown, Home, Megaphone, Plane, UserRound } from "lucide-react";
import Dialog from "@/components/ui/Dialog";
import { ui } from "@/components/ui/classes";
import { formatDate } from "@/engine/calendar";
import { chooseHost } from "@/engine/exile";
import { fallChoices, type FallChoice } from "@/engine/fate";
import { personName } from "@/engine/people";
import type { GameState } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import Portrait from "./Portrait";

const ICONS: Record<FallChoice, typeof Crown> = { country: Crown, successor: UserRound, opposition: Megaphone, underground: Megaphone, exile: Plane };

/**
 * The end of the player's person in a role that does not govern — a
 * resignation, a dismissal, a death, an arrest after a failed coup — and the
 * choice it leaves (engine/fate.ts): play the country's government, go on as
 * whoever takes over, or stay with the person, at home or abroad.
 */
export default function FallDialog({ state, onChoose }: { state: GameState; onChoose: (choice: FallChoice) => void }) {
  const { t, text, locale } = useI18n();
  const role = state.role;
  const fall = role?.fall;
  const person = role?.person;
  const name = person ? personName(person, locale) : t(`change.fate.who.${fall?.from ?? "minister"}` as MessageKey);
  const choices = fall ? fallChoices(state) : [];
  const host = choices.includes("exile") ? chooseHost(state) : undefined;
  const label = (choice: FallChoice): string => {
    if (choice === "successor") return fall?.successor ? t("fall.choice.successorNamed", { name: fall.successor }) : t("fall.choice.successor");
    if (choice === "exile") return t("fall.choice.exile", { host: host ? text(state.countries[host]?.name) : "" });
    return t(`fall.choice.${choice}` as MessageKey);
  };
  return (
    <Dialog
      open={Boolean(fall)}
      onClose={() => undefined}
      title={fall ? t(`fall.title.${fall.how}` as MessageKey, { name }) : ""}
      footer={
        <div className="flex flex-col gap-2">
          {choices.map((choice, i) => {
            const Icon = ICONS[choice];
            return (
              <button key={choice} type="button" onClick={() => onChoose(choice)} className={`${i === 0 ? ui.primary : ui.secondary} w-full py-3 text-sm`}>
                <Icon className="h-4 w-4" />
                {label(choice)}
              </button>
            );
          })}
          <Link href="/" className="text-center text-xs font-bold text-muted hover:text-accent">
            <Home className="mr-1 inline h-3.5 w-3.5" />
            {t("defeat.home")}
          </Link>
        </div>
      }
    >
      {fall && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 rounded-xl bg-red-50 p-3">
            {/* A portrait only of the person themselves; someone without one has none. */}
            {person?.portrait && <Portrait portrait={person.portrait} gender={person.gender} name={name} size="lg" />}
            <div className="min-w-0">
              <div className="text-sm font-black text-red-700">{fall.how === "died" ? t(`fall.note.died.${fall.cause ?? "illness"}` as MessageKey, { name }) : t(`fall.note.${fall.how}` as MessageKey, { name })}</div>
              <div className="mt-1 text-xs font-bold tabular-nums text-red-700/80">
                {text(state.countries[state.player]?.name)} · {formatDate(fall.date, locale)}
              </div>
            </div>
          </div>
          {fall.successor && <p className="text-xs font-bold text-ink">{t("fall.successor", { name: fall.successor })}</p>}
          <p className="text-xs font-medium leading-snug text-ink">{t("fall.choice")}</p>
        </div>
      )}
    </Dialog>
  );
}

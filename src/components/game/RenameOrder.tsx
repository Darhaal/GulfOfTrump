"use client";

import { ClipboardList, Pencil } from "lucide-react";
import { useState } from "react";
import Dialog from "@/components/ui/Dialog";
import { ui } from "@/components/ui/classes";
import type { SuggestWhat } from "@/engine/suggest";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import Dictation from "@/components/voice/Dictation";
import { SuggestButton, SuggestChips, useSuggestions, type Suggest } from "./Suggestions";

interface RenameOrderProps {
  what: SuggestWhat;
  /** The name it goes by now, as the panel shows it. */
  current: string;
  /** Puts the order into the turn's orders (GameClient's addOrder). */
  onOrder: (order: string) => void;
  /** Names from the game master; without one the player writes the name alone. */
  onSuggest?: Suggest;
  disabled?: boolean;
  /** The turn has no room for another order. */
  full?: boolean;
}

/**
 * A small pencil by a name the government may change: a post, a ministry,
 * the ruling party, the movement, a war, a formation. It opens a pop-up and
 * changes nothing by itself – it writes an order ("Rename the Ministry of
 * Propaganda to the Ministry of Information"), which the turn's game master
 * answers and the engine checks (engine/acts.ts, officials "retitled" for a
 * post). Names from the game master come only when asked, by the spark.
 */
export default function RenameOrder({ what, current, onOrder, onSuggest, disabled, full }: RenameOrderProps) {
  const { t } = useI18n();
  const [name, setName] = useState<string | null>(null);
  const s = useSuggestions(onSuggest);
  const close = () => {
    setName(null);
    s.clear();
  };
  const next = (name ?? "").trim();
  const ready = Boolean(next) && next !== current.trim() && !disabled && !full;
  const submit = () => {
    if (!ready) return;
    onOrder(t(`rename.order.${what}` as MessageKey, { from: current, to: next }));
    close();
  };

  return (
    <>
      <button
        type="button"
        disabled={disabled || full}
        onClick={() => setName(current)}
        className="shrink-0 rounded-md p-1 text-muted transition-colors hover:bg-page hover:text-ink disabled:opacity-50"
        title={full ? t("rename.full") : t(`rename.hint.${what}` as MessageKey)}
        aria-label={t(`rename.hint.${what}` as MessageKey)}
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <Dialog
        open={name !== null}
        onClose={close}
        title={t(`rename.title.${what}` as MessageKey)}
        footer={
          <div className="flex gap-2">
            <button type="button" onClick={close} className={`${ui.secondary} flex-1 py-2.5 text-sm`}>
              {t("rename.cancel")}
            </button>
            <button type="button" onClick={submit} disabled={!ready} className={`${ui.primary} flex-1 py-2.5 text-sm`} title={t("rename.toOrders.hint")}>
              <ClipboardList className="h-4 w-4" />
              {t("rename.toOrders")}
            </button>
          </div>
        }
      >
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <p className="text-xs font-medium text-muted">{t("rename.now", { name: current })}</p>
          <Dictation
            id={`rename-${what}`}
            inline
            max={80}
            set={(next) => setName((was) => (typeof next === "function" ? next(was ?? "") : next))}
            spark={onSuggest && <SuggestButton hint={t("rename.variants.hint")} asking={s.asking} disabled={disabled} onClick={() => void s.ask({ kind: "rename", what, current })} />}
          >
            <input autoFocus value={name ?? ""} maxLength={80} onChange={(e) => setName(e.target.value)} aria-label={t(`rename.hint.${what}` as MessageKey)} className={`${ui.input} text-sm font-bold`} />
          </Dictation>
          <SuggestChips options={s.options} failed={s.failed} onPick={setName} />
          <p className="text-2xs font-medium leading-snug text-muted">{t("rename.toOrders.hint")}</p>
        </form>
      </Dialog>
    </>
  );
}

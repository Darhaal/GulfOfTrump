"use client";

import { Hourglass, Pin, PinOff, Plus, Repeat, X } from "lucide-react";
import { useState } from "react";
import { ui } from "@/components/ui/classes";
import Dictation from "@/components/voice/Dictation";
import { MAX_ORDERS } from "@/constants/app";
import { TIME_STEPS } from "@/engine/calendar";
import type { TimeStep } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";

interface OrdersPanelProps {
  orders: string[];
  /** Orders in force every turn until removed. */
  standing: string[];
  /** Last turn's orders, offered to repeat when nothing is written yet. */
  previous: string[];
  step: TimeStep;
  disabled: boolean;
  onChange: (orders: string[]) => void;
  onStanding: (standing: string[]) => void;
  onStep: (step: TimeStep) => void;
}

/**
 * The player's orders for the coming turn, written in plain language. An
 * order can be pinned as standing policy ("keep asking the allies for aid")
 * and then goes into every turn until it is unpinned.
 */
export default function OrdersPanel({ orders, standing, previous, step, disabled, onChange, onStanding, onStep }: OrdersPanelProps) {
  const { t } = useI18n();
  const [draft, setDraft] = useState("");
  const full = orders.length + standing.length >= MAX_ORDERS;
  // Last turn's orders that are not standing already, to write again in one click.
  const repeatable = previous.filter((o) => !standing.includes(o) && !orders.includes(o));

  const add = () => {
    const text = draft.trim();
    if (!text || full) return;
    onChange([...orders, text.slice(0, 1000)]);
    setDraft("");
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className={`${ui.label} mb-2 flex items-center gap-1.5`}>
          <Hourglass className="h-3.5 w-3.5" />
          {t("game.step")}
        </div>
        <div className="grid grid-cols-5 gap-1 rounded-xl bg-page p-1">
          {TIME_STEPS.map((s) => (
            <button
              key={s}
              type="button"
              disabled={disabled}
              onClick={() => onStep(s)}
              className={`truncate rounded-lg px-1 py-2 text-2xs font-bold transition-all ${s === step ? `${ui.segmentOn} bg-surface shadow-sm` : ui.segmentOff}`}
            >
              {t(`game.step.${s}` as MessageKey)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Dictation id="orders" set={setDraft} max={1000} disabled={disabled || full}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                add();
              }
            }}
            rows={3}
            maxLength={1000}
            disabled={disabled || full}
            placeholder={t("game.orders.placeholder")}
            className={`${ui.input} resize-none`}
          />
        </Dictation>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-2xs font-medium text-muted">{full ? t("game.orders.limit", { n: MAX_ORDERS }) : t("game.orders.hint")}</span>
          <button type="button" onClick={add} disabled={disabled || full || !draft.trim()} className={`${ui.secondary} shrink-0 px-3 py-2 text-xs`}>
            <Plus className="h-4 w-4" />
            {t("game.orders.add")}
          </button>
        </div>
      </div>

      {standing.length > 0 && (
        <section>
          <div className={`${ui.label} mb-1.5 flex items-center gap-1.5`}>
            <Pin className="h-3.5 w-3.5" />
            {t("orders.standing")}
          </div>
          <ul className="grid gap-1.5">
            {standing.map((order) => (
              <li key={order} className="flex items-start gap-2.5 rounded-xl bg-page px-3 py-2">
                <Pin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-xs font-medium text-ink">{order}</p>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onStanding(standing.filter((o) => o !== order))}
                  className="-m-1 rounded-lg p-1 text-muted hover:bg-divider hover:text-ink"
                  aria-label={t("orders.unpin")}
                  title={t("orders.unpin")}
                >
                  <PinOff className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-2xs font-medium text-muted">{t("orders.standingNote")}</p>
        </section>
      )}

      {orders.length === 0 && repeatable.length > 0 && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(repeatable.slice(0, Math.max(0, MAX_ORDERS - standing.length)))}
          className={`${ui.secondary} w-full px-3 py-2.5 text-xs`}
        >
          <Repeat className="h-4 w-4" />
          {t("orders.repeat", { n: repeatable.length })}
        </button>
      )}

      {orders.length === 0 ? (
        standing.length === 0 && <p className="rounded-xl border-2 border-dashed border-line px-4 py-6 text-center text-xs font-medium text-muted">{t("game.orders.empty")}</p>
      ) : (
        <ol className="grid gap-2">
          {orders.map((order, i) => (
            <li key={i} className="group flex items-start gap-3 rounded-xl border border-line bg-surface p-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-ink text-2xs font-black text-on-ink tabular-nums">{i + 1}</span>
              <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm font-medium text-ink">{order}</p>
              <button
                type="button"
                disabled={disabled || standing.includes(order)}
                onClick={() => {
                  onStanding([...standing, order]);
                  onChange(orders.filter((_, j) => j !== i));
                }}
                className="-m-1 rounded-lg p-1 text-muted hover:bg-divider hover:text-accent"
                aria-label={t("orders.pin")}
                title={t("orders.pin")}
              >
                <Pin className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(orders.filter((_, j) => j !== i))}
                className="-m-1 rounded-lg p-1 text-muted hover:bg-red-50 hover:text-red-600"
                aria-label={t("game.orders.remove")}
                title={t("game.orders.remove")}
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

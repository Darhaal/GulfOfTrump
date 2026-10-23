"use client";

import { ChevronDown, Crosshair, History, Pencil, Pin, PinOff, Plus, Repeat, ScrollText, X } from "lucide-react";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { ui } from "@/components/ui/classes";
import Dictation from "@/components/voice/Dictation";
import { MAX_ORDERS } from "@/constants/app";
import { useI18n } from "@/i18n/useI18n";
import { isSendShortcut, sendModifier } from "@/lib/keys";
import { editOrder, ORDER_CHARS, takeBack } from "@/lib/orders";

interface OrdersPanelProps {
  orders: string[];
  /** Orders in force every turn until removed. */
  standing: string[];
  /** Last turn's orders, offered to repeat when nothing is written yet. */
  previous: string[];
  disabled: boolean;
  onChange: (orders: string[]) => void;
  onStanding: (standing: string[]) => void;
  /** The special operations beside the orders (OperationsPanel), and how many run; none for the opposition. */
  operations?: ReactNode;
  operationsCount?: number;
}

/** The platform never changes while the page is open. */
const never = () => () => {};

/** An order opened for editing in place: Enter (or Ctrl+Enter) saves, Shift+Enter starts a line, Escape cancels. */
function OrderEditor({ value, onSave, onCancel }: { value: string; onSave: (text: string) => void; onCancel: () => void }) {
  const { t } = useI18n();
  const [text, setText] = useState(value);
  return (
    <div className="min-w-0 flex-1">
      <textarea
        autoFocus
        value={text}
        maxLength={ORDER_CHARS}
        // About thirty characters a line in the panel's width; never fewer than two lines, nor more than six.
        rows={Math.min(6, Math.max(2, Math.ceil((text.length + 1) / 30)))}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            onCancel();
          } else if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSave(text);
          }
        }}
        aria-label={t("orders.edit")}
        className={`${ui.input} resize-none py-2 text-sm`}
      />
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <span className="text-2xs font-medium text-muted">{t("orders.editHint")}</span>
        <div className="ml-auto flex shrink-0 gap-1">
          <button type="button" onClick={onCancel} className="rounded-lg px-2 py-1 text-2xs font-bold text-muted hover:bg-page hover:text-ink">
            {t("orders.cancel")}
          </button>
          <button type="button" onClick={() => onSave(text)} className={`${ui.primary} px-3 py-1 text-2xs`}>
            {t("orders.save")}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * The player's orders for the coming turn, written in plain language. An
 * order can be pinned as standing policy ("keep asking the allies for aid")
 * and then goes into every turn until it is unpinned. Ctrl+Enter (Cmd+Enter
 * on a Mac) adds what is written; the turn's length is set over the map
 * (TurnLength). The government's special operations are a tab beside them.
 */
export default function OrdersPanel({ orders, standing, previous, disabled, onChange, onStanding, operations, operationsCount = 0 }: OrdersPanelProps) {
  const { t } = useI18n();
  const [tab, setTab] = useState<"orders" | "operations">("orders");
  // The server knows no platform; the hint names Ctrl until the browser says otherwise.
  const modifier = useSyncExternalStore(never, () => sendModifier(navigator.platform), () => "Ctrl");
  const [draft, setDraft] = useState("");
  // The order open for editing, in the turn's draft or among the standing ones.
  const [editing, setEditing] = useState<{ list: "draft" | "standing"; index: number } | null>(null);
  const [showLast, setShowLast] = useState(false);
  const full = orders.length + standing.length >= MAX_ORDERS;
  // Last turn's orders that are not standing already, to write again in one click.
  const repeatable = previous.filter((o) => !standing.includes(o) && !orders.includes(o));

  const add = () => {
    const text = draft.trim();
    if (!text || full) return;
    onChange([...orders, text.slice(0, ORDER_CHARS)]);
    setDraft("");
  };
  const save = (list: "draft" | "standing", index: number, text: string) => {
    const next = editOrder(list === "draft" ? orders : standing, index, text);
    if (next) (list === "draft" ? onChange : onStanding)(next);
    setEditing(null);
  };
  const isEditing = (list: "draft" | "standing", index: number) => editing?.list === list && editing.index === index;
  const editButton = (list: "draft" | "standing", index: number, size: string) => (
    <button
      type="button"
      disabled={disabled}
      onClick={() => setEditing({ list, index })}
      className="-m-1 rounded-lg p-1 text-muted hover:bg-divider hover:text-ink"
      aria-label={t("orders.edit")}
      title={t("orders.edit")}
    >
      <Pencil className={size} />
    </button>
  );

  const tabs = operations ? (
    <div className="grid grid-cols-2 gap-1 rounded-xl bg-page p-1" role="tablist">
      {(
        [
          { id: "orders", icon: ScrollText, label: t("orders.tab.orders") },
          { id: "operations", icon: Crosshair, label: `${t("orders.tab.operations")}${operationsCount ? ` · ${operationsCount}` : ""}` },
        ] as const
      ).map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={tab === id}
          onClick={() => setTab(id)}
          className={`${ui.segment} flex min-w-0 items-center justify-center gap-1.5 ${tab === id ? `${ui.segmentOn} bg-surface shadow-sm` : ui.segmentOff}`}
        >
          <Icon className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{label}</span>
        </button>
      ))}
    </div>
  ) : null;

  if (operations && tab === "operations")
    return (
      <div className="flex flex-col gap-4">
        {tabs}
        {operations}
      </div>
    );

  return (
    <div className="flex flex-col gap-4">
      {tabs}
      <div>
        <Dictation id="orders" set={setDraft} max={1000} disabled={disabled || full}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (!isSendShortcut({ key: e.key, ctrlKey: e.ctrlKey, metaKey: e.metaKey, isComposing: e.nativeEvent.isComposing })) return;
              e.preventDefault();
              add();
            }}
            rows={3}
            maxLength={1000}
            disabled={disabled || full}
            placeholder={t("game.orders.placeholder")}
            className={`${ui.input} resize-none`}
          />
        </Dictation>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-2xs font-medium leading-snug text-muted">
            {full ? (
              t("game.orders.limit", { n: MAX_ORDERS })
            ) : (
              <>
                {t("game.orders.hint")}{" "}
                <kbd className="whitespace-nowrap rounded border border-line sheet px-1 py-px font-sans text-2xs font-bold text-ink">{modifier}+Enter</kbd>
              </>
            )}
          </span>
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
            {standing.map((order, i) => (
              <li key={order} className="flex items-start gap-2.5 rounded-xl bg-page px-3 py-2">
                <Pin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                {isEditing("standing", i) ? (
                  <OrderEditor value={order} onSave={(text) => save("standing", i, text)} onCancel={() => setEditing(null)} />
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => setEditing({ list: "standing", index: i })}
                      title={t("orders.edit")}
                      className="min-w-0 flex-1 whitespace-pre-wrap break-words text-left text-xs font-medium text-ink"
                    >
                      {order}
                    </button>
                    {editButton("standing", i, "h-3.5 w-3.5")}
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
                  </>
                )}
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
            <li key={i} className="group flex items-start gap-3 rounded-xl border border-line sheet p-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-ink text-2xs font-black text-on-ink tabular-nums">{i + 1}</span>
              {isEditing("draft", i) ? (
                <OrderEditor value={order} onSave={(text) => save("draft", i, text)} onCancel={() => setEditing(null)} />
              ) : (
                <>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setEditing({ list: "draft", index: i })}
                    title={t("orders.edit")}
                    className="min-w-0 flex-1 whitespace-pre-wrap break-words text-left text-sm font-medium text-ink"
                  >
                    {order}
                  </button>
                  {editButton("draft", i, "h-4 w-4")}
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
                </>
              )}
            </li>
          ))}
        </ol>
      )}

      {previous.length > 0 && (
        <section>
          <button type="button" onClick={() => setShowLast((v) => !v)} aria-expanded={showLast} className={`${ui.label} flex w-full items-center justify-between gap-2 hover:text-ink`}>
            <span className="flex items-center gap-1.5">
              <History className="h-3.5 w-3.5" />
              {t("orders.lastTurn", { n: previous.length })}
            </span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showLast ? "rotate-180" : ""}`} />
          </button>
          {showLast && (
            <ul className="mt-1.5 grid gap-1.5">
              {previous.map((order) => {
                const back = takeBack(orders, standing, order, MAX_ORDERS);
                return (
                  <li key={order} className="rounded-xl bg-page px-3 py-2">
                    <p className="whitespace-pre-wrap break-words text-xs font-medium text-ink">{order}</p>
                    <button
                      type="button"
                      disabled={disabled || !back}
                      onClick={() => {
                        if (!back) return;
                        if (back.draft !== orders) onChange(back.draft);
                        setEditing({ list: "draft", index: back.index });
                      }}
                      className="mt-1 inline-flex items-center gap-1 text-2xs font-bold text-muted hover:text-ink disabled:opacity-50"
                    >
                      <Pencil className="h-3 w-3" />
                      {t("orders.reuse")}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

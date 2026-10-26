"use client";

import { Check, type LucideIcon } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { ui } from "./classes";

/** How long a one-shot action says it went through when nothing in the game keeps saying so. */
const FLASH_MS = 2400;

/**
 * A moment of "done" after a one-shot action: `flash()` once it has gone
 * through, and `shown` stays true for a couple of seconds, so its control can
 * say so and refuse a second click meanwhile.
 */
export function useDone(ms = FLASH_MS): [shown: boolean, flash: () => void] {
  const [shown, setShown] = useState(false);
  // Counts the flashes, so a second one in a row starts the moment over.
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!shown) return;
    const timer = setTimeout(() => setShown(false), ms);
    return () => clearTimeout(timer);
  }, [shown, n, ms]);
  return [
    shown,
    () => {
      setShown(true);
      setN((k) => k + 1);
    },
  ];
}

/**
 * The styled hint of a small control, as the turn-length squares have it:
 * shown on hover and keyboard focus of the control (a `group`), above its
 * nearest positioned ancestor – the row of controls, made `relative`, or
 * the control itself – flush with that box's start or end, so in a narrow
 * panel it never runs off the edge.
 */
export function Hint({ label, text, align = "end" }: { label: string; text?: ReactNode; align?: "start" | "end" }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute bottom-full z-20 mb-1.5 hidden w-max max-w-[15rem] rounded-lg border border-line sheet px-2 py-1 text-left normal-case tracking-normal shadow-sm group-hover:block group-focus-visible:block ${align === "start" ? "left-0" : "right-0"}`}
    >
      <span className="block text-2xs font-bold text-ink">{label}</span>
      {text && <span className="mt-0.5 block text-2xs font-medium leading-snug text-muted">{text}</span>}
    </span>
  );
}

interface DoneButtonProps {
  /** What the button does: its text, or with `compact` the head of its hint. */
  label: string;
  /** Its icon before it is done; a compact button needs one. */
  icon?: LucideIcon;
  /** The short word it shows once done: "In orders", "Started". */
  doneLabel: string;
  /**
   * Done for as long as the game says so – an order already in the turn's
   * orders; it then comes back by itself when the order is removed. Without
   * it the button says so for a moment after a click.
   */
  done?: boolean;
  /** Does it; false when it did not go through. */
  onAct: () => boolean | void;
  disabled?: boolean;
  /** An icon alone, with its label in a hint on hover and focus; once done, the tick and the word. */
  compact?: boolean;
  /** More words for the hint: the order it adds, why it is off. */
  hint?: ReactNode;
  /** The hint sits above the nearest positioned ancestor (see Hint), flush with its start or end. */
  align?: "start" | "end";
  /** Once done, the label stays and the word follows it (a list of actions). */
  keepLabel?: boolean;
  /** The look before it is done. */
  className: string;
  /** The look once done: a green tick and word, small by default. */
  doneClassName?: string;
}

/**
 * A one-shot action – an order, a directive, a budget, an invitation – that
 * answers when it has gone through: a tick and a short word in place of its
 * label, and no second click until the thing is undone where it lives.
 */
export default function DoneButton({ label, icon, doneLabel, done, onAct, disabled, compact, hint, align, keepLabel, className, doneClassName }: DoneButtonProps) {
  const [flashed, flash] = useDone();
  const isDone = Boolean(done) || flashed;
  const Icon = isDone ? Check : icon;
  const tip = compact || hint;
  return (
    <button
      type="button"
      disabled={disabled || isDone}
      onClick={() => {
        if (onAct() !== false && done === undefined) flash();
      }}
      aria-label={compact ? (isDone ? `${label} – ${doneLabel}` : label) : undefined}
      className={`group ${isDone ? (doneClassName ?? `${ui.done} justify-center gap-1 rounded-lg px-2 text-2xs uppercase tracking-wider ${compact ? "h-7 shrink-0" : "py-1"}`) : className}`}
    >
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
      {!compact && (!isDone || keepLabel) && <span className={keepLabel ? "min-w-0 flex-1 text-left" : undefined}>{label}</span>}
      {isDone && <span className={keepLabel ? "shrink-0 text-2xs font-black uppercase tracking-wider" : undefined}>{doneLabel}</span>}
      {tip && <Hint label={label} text={hint} align={align} />}
    </button>
  );
}

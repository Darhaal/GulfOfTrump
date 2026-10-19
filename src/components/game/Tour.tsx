"use client";

import { Check, Lightbulb, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { ui } from "@/components/ui/classes";
import type { ScenarioId } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";

const SEEN = "got_tour";

/** Whether this browser has seen the tour (or skipped it). */
export function tourSeen(): boolean {
  try {
    return localStorage.getItem(SEEN) === "done";
  } catch {
    return true;
  }
}

function markSeen() {
  try {
    localStorage.setItem(SEEN, "done");
  } catch {
    // Not remembered; the tour may show again next time.
  }
}

/** Lets the tour show again on the next game opened. */
export function replayTour() {
  try {
    localStorage.removeItem(SEEN);
  } catch {
    // Nothing stored, nothing to clear.
  }
}

/** Each step points at an element marked `data-tour`; a step whose element is hidden (on a phone) shows in the middle. */
const STEPS = [
  { id: "map", target: "map" },
  { id: "orders", target: "tab-orders" },
  { id: "end", target: "end-turn" },
  { id: "cabinet", target: "tab-cabinet" },
  { id: "state", target: "tab-state" },
  { id: "diplomacy", target: "tab-diplomacy" },
  { id: "ideas", target: null },
] as const;

const CARD = 320;
const GAP = 12;

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** The first visible element for a step, if any. */
function find(target: string | null): Box | null {
  if (!target) return null;
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return { top: r.top, left: r.left, width: r.width, height: r.height };
  }
  return null;
}

/** Where the card goes: beside the element if there is room, else below or above it, always on screen. */
function place(box: Box | null, height: number): { top: number; left: number } {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const card = Math.min(CARD, w - 2 * GAP);
  if (!box) return { top: Math.max(GAP, (h - height) / 2), left: (w - card) / 2 };
  const clampTop = (t: number) => Math.min(Math.max(GAP, t), h - height - GAP);
  const clampLeft = (l: number) => Math.min(Math.max(GAP, l), w - card - GAP);
  // A big element (the map) gets the card inside it, near its top left.
  if (box.width > w * 0.5 && box.height > h * 0.4) return { top: clampTop(box.top + 24), left: clampLeft(box.left + 24) };
  if (box.left + box.width + GAP + card < w) return { top: clampTop(box.top), left: box.left + box.width + GAP };
  if (box.left - GAP - card > 0) return { top: clampTop(box.top), left: box.left - GAP - card };
  if (box.top + box.height + GAP + height < h) return { top: box.top + box.height + GAP, left: clampLeft(box.left) };
  return { top: clampTop(box.top - GAP - height), left: clampLeft(box.left) };
}

/**
 * A short tour on the first game: what the map, the orders, the turn, the
 * cabinet, the state and diplomacy are for, then three ideas for a first
 * turn on this date, one click each into the orders. Skipping it or
 * finishing it marks it seen; Settings can show it again.
 */
export default function Tour({
  scenario,
  country,
  orders,
  onAddOrder,
  onClose,
}: {
  scenario: ScenarioId;
  country: string;
  orders: string[];
  onAddOrder: (order: string) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [card, setCard] = useState<HTMLDivElement | null>(null);
  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  // Follow the element as the layout settles and the window changes (a
  // timer rather than animation frames, which stop in a hidden tab).
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const same = (a: Box | null, b: Box | null) => a === b || (!!a && !!b && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height);
    const measure = () => {
      const next = find(current.target);
      setBox((prev) => (same(prev, next) ? prev : next));
      setReady(true);
    };
    const first = setTimeout(measure, 0);
    const every = setInterval(measure, 200);
    window.addEventListener("resize", measure);
    return () => {
      clearTimeout(first);
      clearInterval(every);
      window.removeEventListener("resize", measure);
    };
  }, [current.target]);

  const finish = () => {
    markSeen();
    onClose();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const at = typeof window === "undefined" ? { top: 0, left: 0 } : place(box, card?.offsetHeight ?? 220);
  const ideas = [1, 2, 3].map((n) => t(`tour.idea.${scenario}.${n}` as MessageKey));

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={t(`tour.${current.id}.title` as MessageKey, { country })}>
      {box ? (
        <div
          className="pointer-events-none absolute rounded-xl ring-2 ring-accent transition-all duration-200"
          style={{ top: box.top - 4, left: box.left - 4, width: box.width + 8, height: box.height + 8, boxShadow: "0 0 0 9999px color-mix(in srgb, var(--scrim) 55%, transparent)" }}
        />
      ) : (
        <div className="absolute inset-0 bg-scrim/55" />
      )}
      <div
        ref={setCard}
        className="absolute rounded-2xl border border-line bg-surface p-4 shadow-2xl shadow-shade/20 transition-[top,left,opacity] duration-200"
        style={{ top: at.top, left: at.left, width: `min(${CARD}px, calc(100vw - ${2 * GAP}px))`, opacity: ready ? 1 : 0 }}
      >
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className={ui.label}>{t("tour.step", { n: step + 1, total: STEPS.length })}</span>
          <button type="button" onClick={finish} title={t("tour.skip")} aria-label={t("tour.skip")} className="-m-1 rounded-lg p-1 text-muted hover:bg-page hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>
        <h2 className="flex items-center gap-1.5 text-base font-black text-ink">
          {last && <Lightbulb className="h-4 w-4 text-accent" />}
          {t(`tour.${current.id}.title` as MessageKey, { country })}
        </h2>
        <p className="mt-1 text-sm font-medium leading-relaxed text-muted">{t(`tour.${current.id}.body` as MessageKey)}</p>

        {last && (
          <ul className="mt-3 grid gap-1.5">
            {ideas.map((idea) => {
              const added = orders.includes(idea);
              return (
                <li key={idea} className="flex items-start gap-2 rounded-xl bg-page px-3 py-2">
                  <span className="min-w-0 flex-1 text-xs font-semibold leading-snug text-ink">{idea}</span>
                  <button
                    type="button"
                    disabled={added}
                    onClick={() => onAddOrder(idea)}
                    title={added ? t("tour.added") : t("tour.add")}
                    aria-label={added ? t("tour.added") : t("tour.add")}
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-line bg-surface text-muted transition-colors hover:text-accent disabled:opacity-60"
                  >
                    {added ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Plus className="h-3.5 w-3.5" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-4 flex items-center justify-between gap-2">
          <button type="button" onClick={finish} className="text-2xs font-black uppercase tracking-wider text-muted hover:text-ink">
            {t("tour.skip")}
          </button>
          <div className="flex gap-1.5">
            {step > 0 && (
              <button type="button" onClick={() => setStep(step - 1)} className={`${ui.secondary} px-3 py-2 text-xs`}>
                {t("tour.back")}
              </button>
            )}
            <button type="button" onClick={() => (last ? finish() : setStep(step + 1))} className={`${ui.primary} px-4 py-2 text-xs`}>
              {last ? t("tour.start") : t("tour.next")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

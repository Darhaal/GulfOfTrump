"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { ui } from "@/components/ui/classes";
import type { ScenarioId } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import { CARD, highlight, MARGIN, placeCard, type Box, type Placement } from "./tourPlace";

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
  { id: "length", target: "turn-length" },
  { id: "end", target: "end-turn" },
  { id: "cabinet", target: "tab-cabinet" },
  { id: "state", target: "tab-state" },
  { id: "diplomacy", target: "tab-foreign" },
  { id: "ideas", target: null },
] as const;

/** The first visible element for a step, with the radius of its corners. */
function find(target: string | null): (Box & { radius: number }) | null {
  if (!target) return null;
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return { top: r.top, left: r.left, width: r.width, height: r.height, radius: parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0 };
  }
  return null;
}

const same = (a: Box | null, b: Box | null) => a === b || (!!a && !!b && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height);

/** The little arrow on the card's edge, pointing at the target. */
function Arrow({ at }: { at: Placement }) {
  if (at.arrow === null) return null;
  const edge = "absolute h-3 w-3 rotate-45 border-line sheet";
  if (at.side === "right") return <span aria-hidden className={`${edge} -left-1.5 -mt-1.5 border-b border-l`} style={{ top: at.arrow }} />;
  if (at.side === "left") return <span aria-hidden className={`${edge} -right-1.5 -mt-1.5 border-r border-t`} style={{ top: at.arrow }} />;
  if (at.side === "below") return <span aria-hidden className={`${edge} -top-1.5 -ml-1.5 border-l border-t`} style={{ left: at.arrow }} />;
  return <span aria-hidden className={`${edge} -bottom-1.5 -ml-1.5 border-b border-r`} style={{ left: at.arrow }} />;
}

/**
 * A short tour on the first game: the map, the orders, the turn's length,
 * ending the turn, the cabinet, the state and foreign policy, then three
 * examples of a first turn's orders on this date to start from. Closing it or
 * finishing it marks it seen; Settings can show it again.
 */
export default function Tour({
  scenario,
  country,
  onClose,
  opposition = false,
}: {
  scenario: ScenarioId;
  country: string;
  /** The player leads the opposition: no cabinet, acts of state or letters to show (engine/role.ts). */
  opposition?: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const [box, setBox] = useState<(Box & { radius: number }) | null>(null);
  const [card, setCard] = useState<HTMLDivElement | null>(null);
  const [view, setView] = useState({ width: 0, height: 0 });
  const steps = opposition ? STEPS.filter((s) => s.id !== "cabinet" && s.id !== "state" && s.id !== "diplomacy") : STEPS;
  const current = steps[step];
  const last = step === steps.length - 1;

  // Follow the element as the layout settles and the window changes (a
  // timer rather than animation frames, which stop in a hidden tab).
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const measure = () => {
      const next = find(current.target);
      setBox((prev) => (same(prev, next) && prev?.radius === next?.radius ? prev : next));
      setView((prev) => (prev.width === window.innerWidth && prev.height === window.innerHeight ? prev : { width: window.innerWidth, height: window.innerHeight }));
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

  const at = placeCard(box, { width: card?.offsetWidth ?? CARD, height: card?.offsetHeight ?? 200 }, view);
  const ring = box ? highlight(box, box.radius, view) : null;
  const examples = [1, 2, 3].map((n) => t(`tour.idea.${scenario}.${n}` as MessageKey));
  const title = t(`tour.${current.id}.title` as MessageKey, { country });

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      {ring ? (
        <div
          className="pointer-events-none absolute border-2 border-accent transition-all duration-200"
          style={{ top: ring.top, left: ring.left, width: ring.width, height: ring.height, borderRadius: ring.radius, boxShadow: "0 0 0 9999px color-mix(in srgb, var(--scrim) 55%, transparent)" }}
        />
      ) : (
        <div className="absolute inset-0 bg-scrim/55" />
      )}
      <div
        ref={setCard}
        className="absolute rounded-2xl border border-line sheet p-5 shadow-2xl shadow-shade/20 transition-[top,left,opacity] duration-200"
        style={{ top: at.top, left: at.left, width: `min(${CARD}px, calc(100vw - ${2 * MARGIN}px))`, opacity: ready ? 1 : 0 }}
      >
        <Arrow at={at} />
        <div className="flex items-center justify-between gap-2">
          <span className={ui.label}>{t("tour.step", { n: step + 1, total: steps.length })}</span>
          <button type="button" onClick={finish} title={t("tour.skip")} aria-label={t("tour.skip")} className="-m-1.5 rounded-lg p-1.5 text-muted hover:bg-page hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>
        <h2 className="mt-1.5 text-base font-black leading-snug text-ink">{title}</h2>
        <p className="mt-1.5 text-sm font-medium leading-relaxed text-muted">{t(`tour.${current.id}.body` as MessageKey)}</p>

        {last && (
          <ul className="mt-3 grid gap-1.5">
            {examples.map((example) => (
              <li key={example} className="rounded-xl bg-page px-3 py-2 text-xs font-semibold leading-snug text-ink">
                {example}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 flex items-center justify-between gap-2">
          {step > 0 ? (
            <button type="button" onClick={() => setStep(step - 1)} className="rounded-lg px-2 py-2 text-xs font-bold text-muted hover:bg-page hover:text-ink">
              {t("tour.back")}
            </button>
          ) : (
            <span />
          )}
          <button type="button" onClick={() => (last ? finish() : setStep(step + 1))} className={`${ui.primary} whitespace-nowrap px-5 py-2.5 text-xs`}>
            {last ? t("tour.start") : t("tour.next")}
          </button>
        </div>
      </div>
    </div>
  );
}

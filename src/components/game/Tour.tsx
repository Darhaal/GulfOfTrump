"use client";

import { Gamepad2, Sparkles, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useAppDialog } from "@/components/AppDialogs";
import { ui } from "@/components/ui/classes";
import { TUTORIAL_TURNS } from "@/engine/tutorial";
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

/** The tour is behind this browser: after it, or after the tutorial that teaches the same and more. */
export function markTourSeen() {
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
  { id: "politics", target: "tab-politics" },
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
 * A card beside the element a step points at, with a ring round it and the
 * rest of the window dimmed: what the tour and the tutorial's guide are both
 * drawn with. It follows the element as the layout settles and the window
 * changes (a timer rather than animation frames, which stop in a hidden tab).
 * `modal`: the card holds the page until it is answered (the tour); else the
 * page stays usable round it and only the card takes clicks (the guide, whose
 * steps wait for the player to do something there). `ring`: whether the
 * element is ringed and the rest dimmed, and how much.
 */
function Spotlight({ target, label, modal, dim = 55, ring = true, layer = "z-50", children }: { target: string | null; label: string; modal: boolean; dim?: number; ring?: boolean; layer?: string; children: ReactNode }) {
  const [box, setBox] = useState<(Box & { radius: number }) | null>(null);
  const [card, setCard] = useState<HTMLDivElement | null>(null);
  const [view, setView] = useState({ width: 0, height: 0 });
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const measure = () => {
      const next = find(target);
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
  }, [target]);

  const at = placeCard(box, { width: card?.offsetWidth ?? CARD, height: card?.offsetHeight ?? 200 }, view);
  const lit = box && ring ? highlight(box, box.radius, view) : null;
  const shade = `color-mix(in srgb, var(--scrim) ${dim}%, transparent)`;

  return (
    <div className={`fixed inset-0 ${layer} ${modal ? "" : "pointer-events-none"}`} role="dialog" aria-modal={modal} aria-label={label}>
      {lit ? (
        <div
          className="pointer-events-none absolute border-2 border-accent transition-all duration-200"
          style={{ top: lit.top, left: lit.left, width: lit.width, height: lit.height, borderRadius: lit.radius, boxShadow: dim ? `0 0 0 9999px ${shade}` : undefined }}
        />
      ) : (
        ring && dim > 0 && <div className={`absolute inset-0 ${modal ? "" : "pointer-events-auto"}`} style={{ background: shade }} />
      )}
      <div
        ref={setCard}
        className="pointer-events-auto absolute rounded-2xl border border-line sheet p-5 shadow-2xl shadow-shade/20 transition-[top,left,opacity] duration-200"
        style={{ top: at.top, left: at.left, width: `min(${CARD}px, calc(100vw - ${2 * MARGIN}px))`, opacity: ready ? 1 : 0 }}
      >
        {ring && <Arrow at={at} />}
        {children}
      </div>
    </div>
  );
}

/**
 * A short tour on the first game: the map, the orders, the turn's length,
 * ending the turn, the cabinet, domestic politics and foreign policy, then three
 * examples of a first turn's orders on this date to start from. Closing it or
 * finishing it marks it seen; Settings can show it again. The tutorial's game
 * has the guide instead (`Guide`, below).
 */
export default function Tour({
  scenario,
  country,
  onClose,
  opposition = false,
}: {
  scenario: ScenarioId;
  country: string;
  /** The player leads the opposition: no cabinet, parliament of its own or letters to show (engine/role.ts). */
  opposition?: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const steps = opposition ? STEPS.filter((s) => s.id !== "cabinet" && s.id !== "politics" && s.id !== "diplomacy") : STEPS;
  const current = steps[step];
  const last = step === steps.length - 1;

  const finish = () => {
    markTourSeen();
    onClose();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const examples = [1, 2, 3].map((n) => t(`tour.idea.${scenario}.${n}` as MessageKey));
  const title = t(`tour.${current.id}.title` as MessageKey, { country });

  return (
    <Spotlight target={current.target} label={title} modal>
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
    </Spotlight>
  );
}

// ---- the tutorial's guide

/** What the guide watches to know a step is done: the game and the screen as they stand. */
export interface GuideProgress {
  /** Orders written for the coming turn. */
  draft: number;
  /** Turns played. */
  played: number;
  /** A turn is being written. */
  turnBusy: boolean;
  /** The turn's report is open. */
  reportOpen: boolean;
  /** The left panel open. */
  left: string | null;
  /** Questions put to the ministers. */
  advice: number;
  /** Letters written to governments. */
  letters: number;
  /** A game master answers past the written turns: ChatGPT, or the offline one chosen. */
  ready: boolean;
}

export const GUIDE_STEPS = ["welcome", "map", "order", "end", "report", "front", "cabinet", "ask", "army", "economy", "letter", "free", "play", "choose", "done"] as const;
export type GuideStep = (typeof GUIDE_STEPS)[number];

/** What a step's card offers to put in for the player: an order, a question, a letter, orders to try, the game master to choose. */
type GuideOffer = "order" | "question" | "letter" | "ideas" | "choose";

interface GuideStepDef {
  id: GuideStep;
  /** The element pointed at, by its `data-tour`: on a panel's tab until the panel is open, then on its box. */
  target: (p: GuideProgress) => string | null;
  /** Done when this holds: the guide moves on by itself. Without it, the player moves on with a button. */
  until?: (p: GuideProgress) => boolean;
  /** Back a step when this holds: a turn that failed before it was played. */
  back?: (p: GuideProgress) => boolean;
  /** Not shown while this holds: the waiting screen of a turn, the free turn played without a card. */
  hidden?: (p: GuideProgress) => boolean;
  offer?: GuideOffer;
  /** The button's words, for a step moved on by hand. */
  go?: MessageKey;
  /** The page round the card dimmed, %; 0 for none (the report dims its own). */
  dim?: number;
}

const none = () => null;

/**
 * The guided first game, step by step. Each step asks the player to do one
 * thing and waits for it: read the briefing and the map, write a first order
 * (one offered to use or edit), end the turn and read the report, see the
 * front move, ask a minister, look at the army and the economy, write to a
 * government; then a free turn of the written ones, and the choice of who
 * plays the world after them.
 */
const GUIDE: GuideStepDef[] = [
  { id: "welcome", target: none, go: "guide.welcome.go" },
  { id: "map", target: () => "map", dim: 35 },
  { id: "order", target: (p) => (p.left === "orders" ? "orders-input" : "tab-orders"), until: (p) => p.draft > 0 || p.played > 0, offer: "order", dim: 25 },
  { id: "end", target: () => "end-turn", until: (p) => p.turnBusy || p.played > 0, dim: 25 },
  { id: "report", target: () => "report", until: (p) => p.played > 0 && !p.reportOpen && !p.turnBusy, back: (p) => !p.turnBusy && p.played === 0 && !p.reportOpen, hidden: (p) => !p.reportOpen, dim: 0 },
  { id: "front", target: () => "map", dim: 35 },
  { id: "cabinet", target: () => "tab-cabinet", until: (p) => p.left === "cabinet" || p.advice > 0, dim: 25 },
  { id: "ask", target: (p) => (p.left === "cabinet" ? "cabinet-ask" : "tab-cabinet"), until: (p) => p.advice > 0, offer: "question", dim: 25 },
  { id: "army", target: () => "tab-army", until: (p) => p.left === "army", dim: 25 },
  { id: "economy", target: () => "tab-economy", until: (p) => p.left === "economy", dim: 25 },
  { id: "letter", target: (p) => (p.left === "foreign" ? "letter-input" : "tab-foreign"), until: (p) => p.letters > 0, offer: "letter", dim: 25 },
  { id: "free", target: none, offer: "ideas", go: "guide.free.go" },
  { id: "play", target: none, until: (p) => p.played >= TUTORIAL_TURNS && !p.reportOpen && !p.turnBusy, hidden: () => true },
  { id: "choose", target: none, until: (p) => p.ready, offer: "choose" },
  { id: "done", target: none, go: "guide.finish" },
];

/** The steps the player sees numbered: all but the free turn and the last word. */
const COUNTED = GUIDE.filter((s) => s.id !== "play" && s.id !== "done").map((s) => s.id);

/** The next step after one, or the one before it. */
export const stepAfter = (step: GuideStep, by = 1): GuideStep => GUIDE[Math.min(Math.max(GUIDE.findIndex((s) => s.id === step) + by, 0), GUIDE.length - 1)].id;

/** What the guide offers the player to put in, in the player's language. */
export interface GuideSuggestions {
  order: string;
  question: string;
  letter: string;
  ideas: string[];
}

/**
 * The tutorial's guide, drawn as the tour is but beside a page that stays
 * usable: each step's card points at the place to act, and moves on by
 * itself once the player has done what it asks. Skipping it goes to the
 * front page; its last step finishes the tutorial.
 */
export function Guide({
  step,
  progress,
  briefing,
  country,
  chatgpt,
  suggestions,
  onStep,
  onUse,
  onSkip,
  onFinish,
}: {
  step: GuideStep;
  progress: GuideProgress;
  /** The tutorial's briefing, read on the first card. */
  briefing: string;
  country: string;
  /** Signed in with ChatGPT, for the last word. */
  chatgpt: boolean;
  suggestions: GuideSuggestions;
  onStep: (step: GuideStep) => void;
  /** Puts a suggestion in (an order, a question, a letter, one of the ideas) or takes a way on (sign in, play offline). */
  onUse: (what: "order" | "question" | "letter" | "signIn" | "demo", text?: string) => void;
  onSkip: () => void;
  onFinish: () => void;
}) {
  const { t } = useI18n();
  const popup = useAppDialog();
  const def = GUIDE.find((s) => s.id === step) ?? GUIDE[0];

  // The step done (or undone) moves the guide on (or back), one step at a time as the game catches up.
  useEffect(() => {
    if (def.back?.(progress)) onStep(stepAfter(def.id, -1));
    else if (def.until?.(progress)) onStep(stepAfter(def.id));
  }, [def, progress, onStep]);

  // Out of the way of Settings opened to sign in, and of a turn's waiting screen.
  if (popup || def.hidden?.(progress) || (progress.turnBusy && !progress.reportOpen)) return null;

  const counted = COUNTED.indexOf(def.id);
  const title = t(`guide.${def.id}.title` as MessageKey, { country });
  const suggestion = (text: string, what: "order" | "question" | "letter") => (
    <div className="mt-3 flex items-start gap-2 rounded-xl bg-page px-3 py-2">
      <p className="min-w-0 flex-1 text-xs font-semibold leading-snug text-ink">{text}</p>
      <button type="button" onClick={() => onUse(what, text)} className={`${ui.secondary} shrink-0 px-2.5 py-1.5 text-2xs`}>
        {t("guide.use")}
      </button>
    </div>
  );

  return (
    <Spotlight target={def.target(progress)} label={title} modal={false} dim={def.dim ?? 55} ring={def.dim !== 0} layer="z-[60]">
      <div className="flex items-center justify-between gap-2">
        <span className={ui.label}>{counted >= 0 ? t("tour.step", { n: counted + 1, total: COUNTED.length }) : t("start.tutorial")}</span>
        {def.id !== "done" && (
          <button type="button" onClick={onSkip} className="-m-1.5 inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-2xs font-bold text-muted hover:bg-page hover:text-ink">
            {t("guide.skip")}
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <h2 className="mt-1.5 text-base font-black leading-snug text-ink">{title}</h2>
      {def.id === "welcome" && <p className="mt-1.5 text-sm font-medium leading-relaxed text-ink">{briefing}</p>}
      <p className="mt-1.5 text-sm font-medium leading-relaxed text-muted">
        {def.id === "done" ? t(chatgpt ? "guide.done.chatgpt" : "guide.done.demo") : t(`guide.${def.id}.body` as MessageKey)}
      </p>

      {def.offer === "order" && suggestion(suggestions.order, "order")}
      {def.offer === "question" && suggestion(suggestions.question, "question")}
      {def.offer === "letter" && suggestion(suggestions.letter, "letter")}
      {def.offer === "ideas" && <div className="grid">{suggestions.ideas.map((idea) => <div key={idea}>{suggestion(idea, "order")}</div>)}</div>}
      {def.offer === "choose" && (
        <div className="mt-4 grid gap-2">
          <button type="button" onClick={() => onUse("signIn")} className={`${ui.primary} px-4 py-2.5 text-xs`}>
            <Sparkles className="h-4 w-4" />
            {t("ai.signIn")}
          </button>
          <button type="button" onClick={() => onUse("demo")} className={`${ui.secondary} px-4 py-2.5 text-xs`}>
            <Gamepad2 className="h-4 w-4" />
            {t("guide.choose.demo")}
          </button>
          <p className="text-2xs font-medium leading-snug text-muted">{t("guide.choose.demoNote")}</p>
        </div>
      )}

      {def.until ? (
        def.offer !== "choose" && <p className="mt-3 text-2xs font-bold uppercase tracking-wider text-accent">{t("guide.doIt")}</p>
      ) : (
        <div className="mt-5 flex justify-end">
          <button type="button" onClick={() => (def.id === "done" ? onFinish() : onStep(stepAfter(def.id)))} className={`${ui.primary} whitespace-nowrap px-5 py-2.5 text-xs`}>
            {t(def.go ?? "tour.next")}
          </button>
        </div>
      )}
    </Spotlight>
  );
}

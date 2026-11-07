"use client";

import { Pin } from "lucide-react";
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ui } from "./classes";

/**
 * The game's hints, as Crusader Kings has them: a hint opens on hover,
 * keyboard focus or a tap, and a highlighted word inside it opens a hint of
 * its own, so a chain of them can be followed down to what a word means.
 *
 * - The chain stays open while the pointer or the focus is inside any hint
 *   of it (or on the word that opened it); once it leaves, the hints close
 *   after a short grace, the innermost first.
 * - A click (a tap on a touch screen) pins a hint: it stays until a second
 *   click, a click outside the chain, or Escape.
 * - Escape closes the innermost open hint and gives the focus back to its word.
 * - Chains go no deeper than MAX_DEPTH; a word already explained further up
 *   the chain opens nothing again, so a loop of terms cannot open forever.
 *
 * A hint is drawn fixed, in a portal, so a panel that scrolls or clips does
 * not cut it, and placed below its word – above when there is no room –
 * within the screen.
 */

/** How deep a chain of hints goes: a word inside the third hint is highlighted but opens nothing. */
export const MAX_DEPTH = 3;
/** Hover a moment before a hint opens, so a pointer passing over a row does not flash them all. */
const OPEN_MS = 150;
/** The grace after the pointer leaves a chain before its hints close. */
const CLOSE_MS = 300;
/** The room kept between a hint and the screen's edge or its word. */
const EDGE = 8;
const GAP = 6;

interface Chain {
  /** How many hints this element sits inside: 0 outside any. */
  depth: number;
  /** The ids of the hints it sits inside, the outermost first. */
  path: string[];
  /** The glossary terms those hints explain, so a term does not open itself again. */
  terms: string[];
  /** A hint opened inside another tells it so, and the outer one stays while it is open. */
  hold: (on: boolean) => void;
}

const ChainContext = createContext<Chain>({ depth: 0, path: [], terms: [], hold: () => {} });

/** Where an element sits among the hints: its depth and the terms already explained above it. */
export const useTipChain = () => useContext(ChainContext);

/** The open hints, innermost last: Escape closes only the top one. */
const openStack: string[] = [];

type Tag = "span" | "button" | "div" | "li" | "td" | "dt" | "dd" | "p";

export interface TipProps extends Omit<HTMLAttributes<HTMLElement>, "content"> {
  /** What the hint says; a function is called only when it opens. */
  content: ReactNode | (() => ReactNode);
  /** The hint's heading, in small capitals. */
  label?: ReactNode;
  /** The glossary term the hint explains, so the chain does not open it again inside itself. */
  term?: string;
  /** The element the word is drawn as; a span by default, made focusable. */
  as?: Tag;
  /** A click pins the hint (the default); off for a control whose click does something else – it then just hides the hint. */
  pinnable?: boolean;
  /** No hint for now (a dropdown of the same control is open). */
  silent?: boolean;
  /** A button's own type and disabled state, passed through. */
  type?: "button" | "submit";
  disabled?: boolean;
  children: ReactNode;
}

export default function Tip({ content, label, term, as = "span", pinnable = true, silent = false, children, className, ...rest }: TipProps) {
  const chain = useContext(ChainContext);
  const id = useId();
  const tipId = `tip-${id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [open, setOpen] = useState(false);
  // A silenced hint (its control's dropdown is open) is not drawn.
  const visible = open && !silent;
  const [pinned, setPinnedState] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const popup = useRef<HTMLDivElement | null>(null);
  // What keeps the hint open besides a pin: the pointer on the word or in the hint, the focus in either, hints opened inside it.
  const sources = useRef({ trigger: false, popup: false, focus: false, children: 0 });
  const timers = useRef<{ open?: ReturnType<typeof setTimeout>; close?: ReturnType<typeof setTimeout> }>({});
  // A click on a control whose click does something else hides the hint until the pointer leaves it.
  const muted = useRef(false);
  // The pin, read by timers and handlers between renders.
  const pinnedRef = useRef(false);
  const setPinned = useCallback((on: boolean) => {
    pinnedRef.current = on;
    setPinnedState(on);
  }, []);

  const clear = (which: "open" | "close") => {
    const timer = timers.current[which];
    if (timer) clearTimeout(timer);
    timers.current[which] = undefined;
  };
  const active = () => {
    const s = sources.current;
    return s.trigger || s.popup || s.focus || s.children > 0;
  };
  const close = useCallback(() => {
    clear("open");
    clear("close");
    sources.current = { trigger: false, popup: false, focus: false, children: 0 };
    setPinned(false);
    setOpen(false);
  }, [setPinned]);
  /** Opens or closes the hint by what holds it now: `now` closes at once instead of after the grace. */
  const sync = useCallback((now = false) => {
    if (pinnedRef.current || active()) {
      clear("close");
      return;
    }
    clear("open");
    if (now) {
      setOpen(false);
      return;
    }
    if (!timers.current.close) {
      timers.current.close = setTimeout(() => {
        timers.current.close = undefined;
        if (!pinnedRef.current && !active()) setOpen(false);
      }, CLOSE_MS);
    }
  }, []);
  const show = (delay: number) => {
    if (silent || muted.current) return;
    clear("close");
    if (delay <= 0) {
      clear("open");
      setOpen(true);
    } else if (!timers.current.open) {
      timers.current.open = setTimeout(() => {
        timers.current.open = undefined;
        if (active()) setOpen(true);
      }, delay);
    }
  };

  // The hint above this one stays while this one is open; when this one closes on its own, the one above closes with it unless held.
  const parentHold = chain.hold;
  useEffect(() => {
    if (!open) return;
    parentHold(true);
    openStack.push(tipId);
    return () => {
      const at = openStack.lastIndexOf(tipId);
      if (at >= 0) openStack.splice(at, 1);
      parentHold(false);
    };
  }, [open, parentHold, tipId]);

  // Timers do not outlive the word.
  useEffect(
    () => () => {
      clear("open");
      clear("close");
    },
    [],
  );

  // Escape closes the innermost hint; a press or a tap outside the chain closes this one.
  useEffect(() => {
    if (!open) return;
    const key = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape" || openStack.at(-1) !== tipId) return;
      const focusInside = popup.current?.contains(document.activeElement);
      close();
      if (focusInside) trigger.current?.focus();
    };
    const away = (e: globalThis.PointerEvent) => {
      const target = e.target as Element | null;
      if (!target || trigger.current?.contains(target)) return;
      const layer = target.closest?.("[data-tip-path]");
      if (layer && layer.getAttribute("data-tip-path")!.split(" ").includes(tipId)) return;
      close();
    };
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", away);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("pointerdown", away);
    };
  }, [open, tipId, close]);

  // Below the word, or above it when there is no room below; never past the screen's edges. Follows the word as the page scrolls.
  const place = useCallback(() => {
    const t = trigger.current?.getBoundingClientRect();
    const p = popup.current;
    if (!t || !p) return;
    const w = p.offsetWidth;
    const h = p.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const below = t.bottom + GAP;
    const above = t.top - GAP - h;
    const top = below + h <= vh - EDGE || above < EDGE ? Math.max(EDGE, Math.min(below, vh - EDGE - h)) : above;
    const left = Math.max(EDGE, Math.min(t.left, vw - EDGE - w));
    setPos((old) => (old && old.left === left && old.top === top ? old : { left, top }));
  }, []);
  useLayoutEffect(() => {
    if (!visible) return;
    place();
    const again = () => place();
    window.addEventListener("resize", again);
    window.addEventListener("scroll", again, true);
    return () => {
      window.removeEventListener("resize", again);
      window.removeEventListener("scroll", again, true);
    };
  }, [visible, place]);

  // What hints inside this one tell it.
  const hold = useCallback(
    (on: boolean) => {
      sources.current.children = Math.max(0, sources.current.children + (on ? 1 : -1));
      // A hint inside that closed on its own took the grace already: this one goes at once if nothing else holds it.
      sync(!on);
    },
    [sync],
  );
  const inner = useMemo<Chain>(
    () => ({ depth: chain.depth + 1, path: [...chain.path, tipId], terms: term ? [...chain.terms, term] : chain.terms, hold }),
    [chain.depth, chain.path, chain.terms, tipId, term, hold],
  );

  const mouse = (e: PointerEvent) => e.pointerType !== "touch";
  const focusInside = () => requestAnimationFrame(() => popup.current?.querySelector<HTMLElement>("[tabindex]")?.focus());
  const within = (node: EventTarget | null, ...roots: (Element | null)[]) => node instanceof Node && roots.some((r) => r?.contains(node));

  const triggerProps = {
    ...rest,
    ref: (el: HTMLElement | null) => {
      trigger.current = el;
    },
    className,
    tabIndex: as === "button" ? rest.tabIndex : (rest.tabIndex ?? 0),
    type: as === "button" ? (rest.type ?? "button") : undefined,
    "aria-describedby": visible ? tipId : rest["aria-describedby"],
    onPointerEnter: (e: PointerEvent<HTMLElement>) => {
      rest.onPointerEnter?.(e);
      if (!mouse(e)) return;
      sources.current.trigger = true;
      show(chain.depth > 0 ? OPEN_MS / 2 : OPEN_MS);
    },
    onPointerLeave: (e: PointerEvent<HTMLElement>) => {
      rest.onPointerLeave?.(e);
      muted.current = false;
      if (!mouse(e)) return;
      sources.current.trigger = false;
      sync();
    },
    onFocus: (e: FocusEvent<HTMLElement>) => {
      rest.onFocus?.(e);
      sources.current.focus = true;
      show(0);
    },
    onBlur: (e: FocusEvent<HTMLElement>) => {
      rest.onBlur?.(e);
      if (within(e.relatedTarget, popup.current)) return;
      sources.current.focus = false;
      sync();
    },
    onClick: (e: MouseEvent<HTMLElement>) => {
      rest.onClick?.(e);
      if (silent) return;
      if (!pinnable) {
        muted.current = true;
        close();
        return;
      }
      if (pinnedRef.current) close();
      else {
        setPinned(true);
        setOpen(true);
        // A press of Enter or Space on a button takes the focus into the hint, to its first highlighted word.
        if (e.detail === 0) focusInside();
      }
    },
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      rest.onKeyDown?.(e);
      if (e.defaultPrevented || silent || !pinnable) return;
      // Enter or Space on a word that is not a button pins its hint and takes the focus into it, to its first highlighted word.
      if (as !== "button" && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        setPinned(true);
        setOpen(true);
        focusInside();
      }
    },
  };

  const body = typeof content === "function" ? (visible ? content() : null) : content;
  const layer =
    visible && typeof document !== "undefined"
      ? createPortal(
          <ChainContext.Provider value={inner}>
            <div
              ref={popup}
              id={tipId}
              role="tooltip"
              data-tip-path={inner.path.join(" ")}
              data-tip-depth={inner.depth}
              onPointerEnter={(e) => {
                if (!mouse(e)) return;
                sources.current.popup = true;
                sync();
              }}
              onPointerLeave={(e) => {
                if (!mouse(e)) return;
                sources.current.popup = false;
                sync();
              }}
              onFocus={() => {
                sources.current.focus = true;
                sync();
              }}
              onBlur={(e) => {
                if (within(e.relatedTarget, popup.current, trigger.current)) return;
                sources.current.focus = false;
                sync();
              }}
              className={`fixed z-[70] w-max max-w-[min(20rem,calc(100vw-16px))] rounded-xl border sheet p-3 text-left normal-case tracking-normal shadow-lg shadow-shade/15 ${pinned ? "border-accent/50" : "border-line"}`}
              style={pos ? { left: pos.left, top: pos.top } : { left: 0, top: 0, visibility: "hidden" }}
            >
              {(label || pinned) && (
                <div className="mb-1 flex items-start justify-between gap-3">
                  {label && <div className={ui.label}>{label}</div>}
                  {pinned && <Pin aria-hidden className="ml-auto h-3 w-3 shrink-0 text-accent" />}
                </div>
              )}
              <div className="text-xs font-medium leading-snug text-ink">{body}</div>
            </div>
          </ChainContext.Provider>,
          document.body,
        )
      : null;

  return (
    <>
      {createElement(as, triggerProps, children)}
      {layer}
    </>
  );
}

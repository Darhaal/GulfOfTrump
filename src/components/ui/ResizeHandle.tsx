"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

interface ResizeHandleProps {
  /** What the handle resizes, for screen readers; `hint` shows on hover. */
  label: string;
  hint?: string;
  min: number;
  /** The widest the panel may be now, read when a drag or a key press starts. */
  max: () => number;
  /** The width while it moves, many times a drag: set it on the panel directly, without a render. */
  onResize: (width: number) => void;
  /** The width once the drag or the key press is over, to keep. */
  onCommit: (width: number) => void;
  /** A double-click: back to the usual width. */
  onReset: () => void;
}

/** Pixels an arrow key moves the edge; with Shift, four times as far. */
const STEP = 16;

/**
 * A thin handle on a panel's right edge (the panel is its positioned parent):
 * dragged with a mouse, pen or finger, moved by the arrow keys when focused
 * (Home and End for the narrowest and the widest), reset by a double-click.
 * Hidden where the panels stack.
 */
export default function ResizeHandle({ label, hint, min, max, onResize, onCommit, onReset }: ResizeHandleProps) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; from: number; max: number; width: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [width, setWidth] = useState<number>();
  // The widest it may go, as of the last focus or drag: the map's room changes with the window.
  const [widest, setWidest] = useState<number>();

  // The panel's width as it is, for screen readers and as the start of a drag.
  useEffect(() => {
    const panel = ref.current?.parentElement;
    if (!panel) return;
    const observer = new ResizeObserver(() => setWidth(Math.round(panel.getBoundingClientRect().width)));
    observer.observe(panel);
    return () => observer.disconnect();
  }, []);

  const measure = () => Math.round(ref.current?.parentElement?.getBoundingClientRect().width ?? min);
  const clamp = (w: number, most: number) => Math.round(Math.min(Math.max(w, min), Math.max(min, most)));

  const end = () => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    setDragging(false);
    document.body.style.removeProperty("cursor");
    document.body.style.removeProperty("user-select");
    // A click that did not move the edge keeps no width: the usual one stays the breakpoint's.
    if (d.width !== d.from) onCommit(d.width);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const from = measure();
    const most = clamp(Infinity, max());
    drag.current = { x: e.clientX, from, max: most, width: from };
    setWidest(most);
    setDragging(true);
    // The cursor and no text selection hold over the whole page while the edge moves.
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const next = clamp(d.from + e.clientX - d.x, d.max);
    if (next === d.width) return;
    d.width = next;
    onResize(next);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const now = measure();
    const step = e.shiftKey ? STEP * 4 : STEP;
    const target = e.key === "ArrowLeft" ? now - step : e.key === "ArrowRight" ? now + step : e.key === "Home" ? min : e.key === "End" ? Infinity : null;
    if (target === null) return;
    e.preventDefault();
    const most = clamp(Infinity, max());
    const next = clamp(target, most);
    setWidest(most);
    if (next === now) return;
    onResize(next);
    onCommit(next);
  };

  return (
    <div
      ref={ref}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={widest}
      aria-valuenow={width}
      tabIndex={0}
      title={hint}
      onFocus={() => setWidest(clamp(Infinity, max()))}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
      onKeyDown={onKeyDown}
      onDoubleClick={onReset}
      className="group absolute inset-y-0 -right-1.5 z-30 hidden w-3 cursor-col-resize touch-none outline-none lg:block"
    >
      {/* A hairline over the panel's border that lights up, and a small grip in the middle to find it by. */}
      <span className={`absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 transition-colors ${dragging ? "bg-accent" : "bg-transparent group-hover:bg-accent/50 group-focus-visible:bg-accent"}`} />
      <span className={`absolute top-1/2 left-1/2 h-10 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border transition-colors ${dragging ? "border-accent bg-accent" : "border-line sheet group-hover:border-accent group-hover:bg-accent group-focus-visible:border-accent group-focus-visible:bg-accent"}`} />
    </div>
  );
}

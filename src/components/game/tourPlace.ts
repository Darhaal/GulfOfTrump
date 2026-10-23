/** Where the tour's card and highlight go, for a target and a window of a given size. Pure, so it can be tested. */

export interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Which side of the target the card is on; "inside" a big target (the map), "center" without one. */
export type Side = "right" | "left" | "below" | "above" | "inside" | "center";

export interface Placement {
  top: number;
  left: number;
  side: Side;
  /** Where the card's arrow points along its edge facing the target (from the card's top for left/right, its left for above/below). */
  arrow: number | null;
}

/** The card's widest, the room between it and the target, and the window's edge it keeps off. */
export const CARD = 340;
export const GAP = 14;
export const MARGIN = 12;
/** How far the arrow keeps from the card's corners. */
const ARROW_INSET = 20;
/** The highlight's room around its target, and how far it keeps inside the window. */
const PAD = 6;
const EDGE = 3;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

/**
 * The card beside its target, centred on it, on the first side with room:
 * right, left, below, above. A big target (the map) gets the card inside it,
 * near its top left; no target, the middle of the window. Always inside the
 * window, the arrow pointing at the target's middle.
 */
export function placeCard(box: Box | null, card: { width: number; height: number }, view: { width: number; height: number }): Placement {
  const { width, height } = card;
  const top = (t: number) => clamp(t, MARGIN, view.height - height - MARGIN);
  const left = (l: number) => clamp(l, MARGIN, view.width - width - MARGIN);
  if (!box) return { top: top((view.height - height) / 2), left: left((view.width - width) / 2), side: "center", arrow: null };
  if (box.width > view.width * 0.5 && box.height > view.height * 0.4) return { top: top(box.top + 24), left: left(box.left + 24), side: "inside", arrow: null };

  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;
  const beside = (l: number, side: Side): Placement => {
    const t = top(cy - height / 2);
    return { top: t, left: l, side, arrow: clamp(cy - t, ARROW_INSET, height - ARROW_INSET) };
  };
  const over = (t: number, side: Side): Placement => {
    const l = left(cx - width / 2);
    return { top: t, left: l, side, arrow: clamp(cx - l, ARROW_INSET, width - ARROW_INSET) };
  };
  if (box.left + box.width + GAP + width <= view.width - MARGIN) return beside(box.left + box.width + GAP, "right");
  if (box.left - GAP - width >= MARGIN) return beside(box.left - GAP - width, "left");
  if (box.top + box.height + GAP + height <= view.height - MARGIN) return over(box.top + box.height + GAP, "below");
  return over(top(box.top - GAP - height), "above");
}

/** The highlight around a target: a little room all round, kept inside the window, its corners following the target's. */
export function highlight(box: Box, radius: number, view: { width: number; height: number }): Box & { radius: number } {
  const l = Math.max(EDGE, box.left - PAD);
  const t = Math.max(EDGE, box.top - PAD);
  const r = Math.min(view.width - EDGE, box.left + box.width + PAD);
  const b = Math.min(view.height - EDGE, box.top + box.height + PAD);
  const w = Math.max(0, r - l);
  const h = Math.max(0, b - t);
  return { top: t, left: l, width: w, height: h, radius: Math.min(radius + PAD, w / 2, h / 2) };
}

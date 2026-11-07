import type { Party } from "@/engine/types";

/** Inner radius of the hemicycle, the outer one being 1. */
export const INNER = 0.42;

/**
 * Seats of a parliament drawn as the press draws them: rows of dots on a
 * half ring, each row holding seats in proportion to its length, numbered
 * from the far left to the far right so that each faction gets a wedge.
 * Coordinates are on a unit half circle, y up; `r` is the dot radius.
 */
export function hemicycle(total: number): { x: number; y: number; r: number }[] {
  if (total <= 0) return [];
  let rows = 1;
  const radii = (n: number) => Array.from({ length: n }, (_, i) => INNER + ((1 - INNER) * (i + 0.5)) / n);
  const capacity = (n: number) => radii(n).reduce((s, R) => s + Math.max(1, Math.floor((Math.PI * R) / ((1 - INNER) / n))), 0);
  while (capacity(rows) < total && rows < 60) rows++;
  const R = radii(rows);
  const step = (1 - INNER) / rows;
  const caps = R.map((r) => Math.max(1, Math.floor((Math.PI * r) / step)));
  // Seats per row in proportion to its length, by largest remainder, within capacity.
  const length = R.reduce((s, r) => s + r, 0);
  const exact = R.map((r) => (total * r) / length);
  const counts = exact.map((e, i) => Math.min(caps[i], Math.floor(e)));
  let left = total - counts.reduce((s, c) => s + c, 0);
  const order = exact.map((e, i) => ({ i, rest: e - Math.floor(e) })).sort((a, b) => b.rest - a.rest);
  while (left > 0) {
    let placed = false;
    for (const { i } of order) {
      if (left === 0) break;
      if (counts[i] < caps[i]) {
        counts[i]++;
        left--;
        placed = true;
      }
    }
    if (!placed) break;
  }
  const dot = step * 0.38;
  const seats: { x: number; y: number; r: number; angle: number; row: number }[] = [];
  R.forEach((radius, row) => {
    const k = counts[row];
    for (let j = 0; j < k; j++) {
      const angle = k === 1 ? Math.PI / 2 : Math.PI * (1 - j / (k - 1));
      seats.push({ x: radius * Math.cos(angle), y: radius * Math.sin(angle), r: dot, angle, row });
    }
  });
  // Left to right; on a tie the inner row first.
  seats.sort((a, b) => b.angle - a.angle || a.row - b.row);
  return seats.map(({ x, y, r }) => ({ x, y, r }));
}

/** Parties from the left of the house to the right: by their economic ideas, then by freedom. */
export function seatingOrder(parties: Party[]): Party[] {
  return [...parties].sort((a, b) => a.stance.economy - b.stance.economy || a.stance.freedom - b.stance.freedom || a.name.localeCompare(b.name));
}

/** Distinct colours for parties the game master gave none, in the order they are listed. */
const PALETTE = ["#2f6fd0", "#d2423a", "#2e9a5a", "#e0a020", "#7b4fc2", "#1aa3a3", "#e0662c", "#c2407f", "#6b7a2a", "#5a6b80"];

/** Each party's colour: the one the press uses, or a distinct one from the palette – toned as a painter's pigment (paintTone). */
export function partyColors(parties: Party[]): Map<string, string> {
  const used = new Set(parties.map((p) => p.color?.toLowerCase()).filter(Boolean));
  const free = PALETTE.filter((c) => !used.has(c));
  let next = 0;
  return new Map(parties.map((p) => [p.id, paintTone(p.color ?? free[next++ % free.length] ?? PALETTE[0])]));
}

export const channels = (hex: string): [number, number, number] | null => {
  const n = parseInt(hex.replace("#", "").slice(0, 6), 16);
  return Number.isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : null;
};
const toHex = (r: number, g: number, b: number) => `#${((1 << 24) | (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)).toString(16).slice(1)}`;

/** A colour moved toward white (t > 0) or black (t < 0), as #rrggbb. */
export function shade(hex: string, t: number): string {
  const c = channels(hex);
  if (!c) return hex;
  const target = t > 0 ? 255 : 0;
  const k = Math.min(1, Math.abs(t));
  const [r, g, b] = c.map((v) => v + (target - v) * k);
  return toHex(r, g, b);
}

/** The warm brown a painter's colours lean to under old varnish. */
const UMBER: [number, number, number] = [122, 92, 58];

/**
 * A press colour as a pigment: a third of its saturation gone, kept from the
 * glaring and the inky, and a little umber mixed in – so a party's acid green
 * reads as a painted green, not a highlighter.
 */
export function paintTone(hex: string): string {
  const c = channels(hex);
  if (!c) return hex;
  const [r, g, b] = c.map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let l = (max + min) / 2;
  const d = max - min;
  let s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  s *= 0.68;
  l = Math.min(0.6, Math.max(0.3, l));
  const k = (1 - Math.abs(2 * l - 1)) * s;
  const x = k * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - k / 2;
  const [r1, g1, b1] = h < 60 ? [k, x, 0] : h < 120 ? [x, k, 0] : h < 180 ? [0, k, x] : h < 240 ? [0, x, k] : h < 300 ? [x, 0, k] : [k, 0, x];
  const mix = 0.14;
  return toHex(...([r1, g1, b1].map((v, i) => ((v + m) * 255) * (1 - mix) + UMBER[i] * mix) as [number, number, number]));
}


/** Dark text on a light colour, white on a dark one. */
export function inkOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 165 ? "#111418" : "#ffffff";
}

/** The press abbreviation, or one made of the name: "Слуга народа" → "СН". */
export function abbreviation(p: Pick<Party, "name" | "short">): string {
  if (p.short) return p.short;
  const words = p.name
    .replace(/\[[^\]]*\]\s*/g, "")
    .replace(/[«»"„“”()]/g, "")
    .split(/[\s—–-]+/)
    .filter((w) => w.length > 2 || /^[A-ZА-ЯІЇЄҐ]/.test(w));
  const letters = (words.length ? words : [p.name]).map((w) => w[0]!.toUpperCase()).join("");
  return letters.slice(0, 4) || p.name.slice(0, 3);
}

/**
 * Circles nudged apart until none covers another, each pulled back towards
 * its true place, inside the box. Returns the drawn centres.
 */
export function spread(points: { x: number; y: number; r: number }[], box: { min: number; max: number }, gap = 2): { x: number; y: number }[] {
  const out = points.map((p) => ({ x: p.x, y: p.y }));
  for (let pass = 0; pass < 60; pass++) {
    let moved = false;
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const need = points[i].r + points[j].r + gap;
        let dx = out[j].x - out[i].x;
        let dy = out[j].y - out[i].y;
        let d = Math.hypot(dx, dy);
        if (d >= need) continue;
        if (d < 0.01) {
          // Same spot: part them along a fixed direction per pair.
          const a = (i * 7 + j * 13) % 360;
          dx = Math.cos((a * Math.PI) / 180);
          dy = Math.sin((a * Math.PI) / 180);
          d = 1;
        }
        const push = (need - d) / 2;
        out[i].x -= (dx / d) * push;
        out[i].y -= (dy / d) * push;
        out[j].x += (dx / d) * push;
        out[j].y += (dy / d) * push;
        moved = true;
      }
    }
    for (let i = 0; i < out.length; i++) {
      out[i].x += (points[i].x - out[i].x) * 0.04;
      out[i].y += (points[i].y - out[i].y) * 0.04;
      out[i].x = Math.min(box.max - points[i].r, Math.max(box.min + points[i].r, out[i].x));
      out[i].y = Math.min(box.max - points[i].r, Math.max(box.min + points[i].r, out[i].y));
    }
    if (!moved) break;
  }
  return out;
}

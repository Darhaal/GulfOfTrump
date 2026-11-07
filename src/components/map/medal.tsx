import type { LucideIcon } from "lucide-react";

/**
 * The map's markers in the format of its corner buttons (WorldMap's dock), but
 * round: a small disc of the sheet's colour with a fine line round it and a
 * soft shadow, its sign in ink – the one marked dark as a chosen button is
 * (the player's own headquarters), a violent protest in the war's red. Plain
 * shapes in the theme's tokens: the map pans and zooms with hundreds of them.
 */

/** How a marker is drawn: plain, the war's (a riot), the player's own, the sea's (a port). */
export type MedalTone = "ivory" | "war" | "accent" | "sea";

const FILL: Record<MedalTone, string> = { ivory: "var(--surface)", war: "var(--war)", accent: "var(--ink)", sea: "var(--surface)" };
const SIGN: Record<MedalTone, string> = { ivory: "var(--ink)", war: "var(--on-ink)", accent: "var(--on-ink)", sea: "var(--river)" };

/**
 * One marker of half-width `r` round the origin, with its sign. `ring` adds a
 * faint ring of the war's colour round it (a protest's spread).
 */
export function Medal({ r, tone, icon: Icon, sign = 0.72, stroke = 2.2, ring = false }: { r: number; tone: MedalTone; icon: LucideIcon; sign?: number; stroke?: number; ring?: boolean }) {
  const s = r * sign;
  return (
    <>
      {ring && <circle r={r * 1.32} fill="var(--war)" fillOpacity={0.16} stroke="var(--war)" strokeOpacity={0.45} strokeWidth={1} />}
      <circle cy={r * 0.12} r={r} fill="var(--shade)" fillOpacity={0.14} />
      <circle r={r} fill={FILL[tone]} stroke="var(--line)" strokeWidth={1} />
      <Icon x={-s} y={-s} size={2 * s} color={SIGN[tone]} strokeWidth={stroke} />
    </>
  );
}

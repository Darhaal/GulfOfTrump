/**
 * Party dots painted rather than printed, in the spirit of the game's oil
 * portraits: each colour gets a little volume (lit from the upper left,
 * darker at the rim), and the group of dots one filter that breaks their
 * edges like a brush and lays a faint grain over them. One filter for the
 * whole group keeps a house of hundreds of seats quick to draw.
 */

/** A colour moved toward white (t > 0) or black (t < 0), as #rrggbb. */
export function shade(hex: string, t: number): string {
  const n = parseInt(hex.replace("#", "").slice(0, 6), 16);
  if (!Number.isFinite(n)) return hex;
  const target = t > 0 ? 255 : 0;
  const k = Math.min(1, Math.abs(t));
  const ch = (v: number) => Math.round(v + (target - v) * k);
  const [r, g, b] = [ch((n >> 16) & 255), ch((n >> 8) & 255), ch(n & 255)];
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** Each party's painted fill: its gradient, by its place among the colours (party ids may hold any letters). */
export const oilFills = (id: string, colors: Map<string, string>) => new Map([...colors.keys()].map((party, i) => [party, `url(#${id}-${i})`]));

/** The filter of a painted group of dots. */
export const oilFilter = (id: string) => `url(#${id}-oil)`;

/** The gradients and the brush filter, once per drawing; `id` keeps two drawings apart. */
export function OilDefs({ id, colors }: { id: string; colors: Map<string, string> }) {
  return (
    <defs>
      <filter id={`${id}-oil`} x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="2" seed="11" result="grain" />
        <feDisplacementMap in="SourceGraphic" in2="grain" scale="1.2" xChannelSelector="R" yChannelSelector="G" result="brushed" />
        <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.55 0 0 0 -0.2" result="speck" />
        <feComposite in="speck" in2="brushed" operator="in" result="speckled" />
        <feMerge>
          <feMergeNode in="brushed" />
          <feMergeNode in="speckled" />
        </feMerge>
      </filter>
      {[...colors].map(([party, color], i) => (
        <radialGradient key={party} id={`${id}-${i}`} cx="36%" cy="30%" r="75%">
          <stop offset="0%" stopColor={shade(color, 0.38)} />
          <stop offset="55%" stopColor={color} />
          <stop offset="100%" stopColor={shade(color, -0.32)} />
        </radialGradient>
      ))}
    </defs>
  );
}

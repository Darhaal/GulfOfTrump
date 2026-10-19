/* eslint-disable @next/next/no-img-element -- tiny static SVGs; next/image would add nothing */
import type { ReactNode } from "react";
import { flagOf, type DrawnFlag } from "@/engine/flags";
import type { ScenarioId } from "@/engine/types";

const stripes = (colours: string[]) =>
  colours.map((c, i) => <rect key={i} x="0" y={(9 / colours.length) * i} width="12" height={9 / colours.length + 0.02} fill={c} />);

const star = (cx: number, cy: number, r: number, fill: string) => {
  const points = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.42 : r;
    return `${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`;
  });
  return <polygon points={points.join(" ")} fill={fill} />;
};

const crescent = (cx: number, cy: number, r: number, bg: string, fg = "#fff") => (
  <>
    <circle cx={cx} cy={cy} r={r} fill={fg} />
    <circle cx={cx + r * 0.28} cy={cy} r={r * 0.82} fill={bg} />
  </>
);

/** Flags of states that no longer exist, or flags that changed since, drawn simply on a 12×9 field. */
const DRAWN: Record<DrawnFlag, ReactNode> = {
  ussr: (
    <>
      <rect width="12" height="9" fill="#cc0000" />
      {star(2.1, 1.5, 0.7, "#ffd700")}
    </>
  ),
  "german-tricolour": stripes(["#000", "#fff", "#dd0000"]),
  "austria-hungary": (
    <>
      <rect width="6" height="3" fill="#c8102e" />
      <rect y="3" width="6" height="3" fill="#fff" />
      <rect y="6" width="6" height="3" fill="#c8102e" />
      <rect x="6" width="6" height="3" fill="#c8102e" />
      <rect x="6" y="3" width="6" height="3" fill="#fff" />
      <rect x="6" y="6" width="6" height="3" fill="#477050" />
    </>
  ),
  ottoman: (
    <>
      <rect width="12" height="9" fill="#e30a17" />
      {crescent(5, 4.5, 2.2, "#e30a17")}
      {star(7.6, 4.5, 0.9, "#fff")}
    </>
  ),
  "china-1912": stripes(["#e03c31", "#f6d220", "#4d77b8", "#fff", "#1f1f1f"]),
  persia: stripes(["#239f40", "#fff", "#da0000"]),
  siam: <rect width="12" height="9" fill="#d0021b" />,
  "yugoslavia-kingdom": stripes(["#003893", "#fff", "#de0000"]),
  yugoslavia: (
    <>
      {stripes(["#003893", "#fff", "#de0000"])}
      {star(6, 4.5, 2, "#fcd116")}
      {star(6, 4.5, 1.7, "#de0000")}
    </>
  ),
  "belarus-1991": stripes(["#fff", "#c8313e", "#fff"]),
  "ethiopia-empire": stripes(["#078930", "#fcdd09", "#da121a"]),
  "south-africa-1928": stripes(["#ff7f00", "#fff", "#00247d"]),
  "red-ensign": (
    <>
      <rect width="12" height="9" fill="#c8102e" />
      <rect width="6" height="4.5" fill="#012169" />
      <path d="M0,0 L6,4.5 M6,0 L0,4.5" stroke="#fff" strokeWidth="0.9" />
      <path d="M3,0 V4.5 M0,2.25 H6" stroke="#fff" strokeWidth="1.4" />
      <path d="M3,0 V4.5 M0,2.25 H6" stroke="#c8102e" strokeWidth="0.8" />
    </>
  ),
  "egypt-kingdom": (
    <>
      <rect width="12" height="9" fill="#00843d" />
      {crescent(5.4, 4.5, 2.4, "#00843d")}
      {star(7.4, 3.4, 0.55, "#fff")}
      {star(7.9, 4.5, 0.55, "#fff")}
      {star(7.4, 5.6, 0.55, "#fff")}
    </>
  ),
  "northern-cyprus": (
    <>
      <rect width="12" height="9" fill="#fff" />
      <rect y="0.9" width="12" height="0.8" fill="#e30a17" />
      <rect y="7.3" width="12" height="0.8" fill="#e30a17" />
      {crescent(5.3, 4.5, 1.6, "#fff", "#e30a17")}
      {star(7, 4.5, 0.7, "#e30a17")}
    </>
  ),
};

const SIZES = { sm: "h-3 w-4", md: "h-3.5 w-[1.17rem]", lg: "h-6 w-8", xl: "h-8 w-[2.67rem]" } as const;

/**
 * A country's flag on the scenario's date, 4:3, with a thin border; the
 * country's map colour when no flag is known.
 */
export default function Flag({ tag, scenario, color, size = "md", className = "" }: { tag: string; scenario: ScenarioId; color?: string; size?: keyof typeof SIZES; className?: string }) {
  const flag = flagOf(tag, scenario);
  const box = `${SIZES[size]} shrink-0 overflow-hidden rounded-[3px] border border-line shadow-sm ${className}`;
  if (!flag) return <span className={`inline-block ${box}`} style={{ background: color }} aria-hidden />;
  if (flag.kind === "iso") return <img src={`/flags/${flag.code}.svg`} alt="" className={`inline-block object-cover ${box}`} />;
  return (
    <svg viewBox="0 0 12 9" preserveAspectRatio="none" className={`inline-block ${box}`} aria-hidden>
      {DRAWN[flag.id]}
    </svg>
  );
}

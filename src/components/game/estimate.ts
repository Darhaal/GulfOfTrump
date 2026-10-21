import type { Estimate, KnowledgeLevel } from "@/engine/fog";

/**
 * An estimate as the player reads it (engine/fog.ts): the figure itself when
 * it is known, "≈ figure" when the government knows the country well, else
 * the range the truth lies in.
 */
export function shown(e: Estimate, level: KnowledgeLevel, format: (n: number) => string): string {
  if (e.exact) return format(e.value);
  if (level === "full" || level === "good") return `≈ ${format(e.value)}`;
  return e.low === e.high ? `≈ ${format(e.value)}` : `${format(e.low)}–${format(e.high)}`;
}

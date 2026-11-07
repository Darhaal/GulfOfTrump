import type { Locale } from "@/engine/types";
import { translate } from "./useI18n";

/**
 * The time left until a moment, in the locale's words: "3 d 4 h",
 * "2 h 14 min", "14 min 05 s", "45 s". `coarse` stops at minutes, for
 * figures that do not tick every second.
 */
export function untilText(locale: Locale, ms: number, coarse = false): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const d = Math.floor(total / 86_400);
  const h = Math.floor((total % 86_400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (d) return translate(locale, "time.dh", { d, h });
  if (h) return translate(locale, "time.hm", { h, m });
  if (coarse) return translate(locale, "time.m", { m: Math.max(1, m + (s ? 1 : 0)) });
  if (m) return translate(locale, "time.ms", { m, s: String(s).padStart(2, "0") });
  return translate(locale, "time.s", { s });
}

/** A clock time, with the day when it is not today: "20:31", "Sat, 31 Oct, 14:00". */
export function clockText(locale: Locale, at: number, now: number): string {
  const date = new Date(at);
  const today = new Date(now).toDateString() === date.toDateString();
  const time = { hour: "2-digit", minute: "2-digit" } as const;
  return new Intl.DateTimeFormat(locale, today ? time : { weekday: "short", day: "numeric", month: "short", ...time }).format(date);
}

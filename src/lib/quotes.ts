import type { Locale } from "@/engine/types";

/**
 * A line of the game's eras or of the ages before them, as the loading
 * screen of the desktop app and the wait for a turn show it. public/quotes.json
 * holds them all in three languages; the game fetches only its own language,
 * public/quotes/<locale>.json, which `npm run quotes` writes (desktop/
 * splash-logic.cjs picks them the same way for the app's start).
 */
export interface Quote {
  id: string;
  /** The speaker: one of the game's people (people.json) or the quoted (quoted.json). */
  person: string | null;
  /** The year, negative before Christ. */
  year: number;
  /** When it was said or written: YYYY-MM-DD, YYYY-MM or YYYY ("-0500" before Christ). A game before that date never shows it. */
  date: string;
  /** The date is a guess: "c. 1600". */
  circa?: boolean;
  name: Partial<Record<Locale, string>> & { en: string };
  text: Partial<Record<Locale, string>> & { en: string };
  /** Where and when it was said or written. */
  source: string;
  /** The Wikiquote page it was taken from ("en:Mark Twain"), credited on the about page. */
  wikiquote?: string;
  /** The page's own words, where the line shown is shortened or translated. */
  original?: string;
}

/** A small thing a player may miss, from the game's author (public/tips.json). */
export interface Tip {
  id: string;
  text: Partial<Record<Locale, string>> & { en: string };
}

/** A quote in one language, ready to show. */
export interface QuoteLine {
  id: string;
  /** The first day a game may show it (YYYY-MM-DD; a year alone counts from its last day). */
  from: string;
  /** The year as the caption shows it: "1894", "c. 1600", "500 BC". */
  when: string;
  name: string;
  text: string;
  /** The speaker's oil portrait, or a shadow of their era. */
  portrait: string;
}

/** An author's tip in one language. */
export interface TipLine {
  id: string;
  text: string;
}

/** One language's quotes and tips: public/quotes/<locale>.json. */
export interface Lines {
  quotes: QuoteLine[];
  tips: TipLine[];
}

/** The author's portrait, beside his tips. */
export const AUTHOR_PORTRAIT = "/about/artem-okhten-oil.webp";

/**
 * How long a line stays: ten seconds and half a second a word, so a long
 * quote is read in comfort, at most forty (desktop/splash-logic.cjs times
 * the loading screen's lines alike).
 */
export function readMs(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.min(40_000, 10_000 + words * 500);
}

/** The quotes a game on this date may show: none said after it. Without a date (no game open), all. */
export const quotesUpTo = <T extends { from: string }>(quotes: T[], date?: string): T[] => (date ? quotes.filter((q) => q.from <= date.slice(0, 10)) : quotes);

/**
 * The next quote: a random one not yet seen; once all have been seen, a new
 * round begins (never with the one just shown). Returns it and the new list
 * of those seen.
 */
export function nextQuote(ids: string[], seen: string[], random: () => number = Math.random): { id: string | null; seen: string[] } {
  if (!ids.length) return { id: null, seen: [] };
  const known = new Set(ids);
  let seenNow = seen.filter((id) => known.has(id));
  let fresh = ids.filter((id) => !seenNow.includes(id));
  if (!fresh.length) {
    const last = seenNow.at(-1);
    seenNow = [];
    fresh = ids.length > 1 ? ids.filter((id) => id !== last) : ids;
  }
  const id = fresh[Math.min(fresh.length - 1, Math.floor(random() * fresh.length))];
  return { id, seen: [...seenNow, id] };
}

export type ShownKind = "quote" | "tip";

/**
 * What the wait shows next: a quote and an author's tip by turns, each
 * picked as nextQuote picks (none repeated until all have been shown). A
 * kind with nothing to show gives way to the other. Returns the kind, its id
 * and both updated lists of those seen.
 */
export function nextItem(
  ids: { quotes: string[]; tips: string[] },
  seen: { quotes: string[]; tips: string[] },
  last: ShownKind | null,
  random: () => number = Math.random,
): { kind: ShownKind; id: string; seen: { quotes: string[]; tips: string[] } } | null {
  const want: ShownKind = last === "quote" ? "tip" : last === "tip" ? "quote" : random() < 0.5 ? "quote" : "tip";
  const order: ShownKind[] = want === "quote" ? ["quote", "tip"] : ["tip", "quote"];
  for (const kind of order) {
    const list = kind === "quote" ? ids.quotes : ids.tips;
    if (!list.length) continue;
    const next = nextQuote(list, kind === "quote" ? seen.quotes : seen.tips, random);
    if (!next.id) continue;
    return { kind, id: next.id, seen: kind === "quote" ? { quotes: next.seen, tips: seen.tips } : { quotes: seen.quotes, tips: next.seen } };
  }
  return null;
}

const loaded = new Map<Locale, Promise<Lines>>();

/** One language's quotes and tips, fetched once per page when the first wait begins; a failed fetch is tried again next time. */
export function loadLines(locale: Locale): Promise<Lines> {
  let lines = loaded.get(locale);
  if (!lines) {
    lines = fetch(`/quotes/${locale}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<Lines>;
      })
      .catch(() => {
        loaded.delete(locale);
        return { quotes: [], tips: [] };
      });
    loaded.set(locale, lines);
  }
  return lines;
}

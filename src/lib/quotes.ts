import type { Locale } from "@/engine/types";

/**
 * A line of the game's eras, as the loading screen of the desktop app and
 * the wait for a turn show it (public/quotes.json; desktop/splash-logic.cjs
 * picks them the same way for the app's start).
 */
export interface Quote {
  id: string;
  /** The speaker's portrait in public/portraits, when there is one. */
  person: string | null;
  year: number;
  name: Partial<Record<Locale, string>> & { en: string };
  text: Partial<Record<Locale, string>> & { en: string };
  /** Where and when it was said or written. */
  source: string;
}

/** A quote in a language, English where a line is missing. */
export const quoteIn = (quote: Quote, locale: Locale) => ({ text: quote.text[locale] || quote.text.en, name: quote.name[locale] || quote.name.en, year: quote.year });

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

let loaded: Promise<Quote[]> | null = null;

/** The quotes, fetched once per page. */
export function loadQuotes(): Promise<Quote[]> {
  loaded ??= fetch("/quotes.json")
    .then((r) => (r.ok ? (r.json() as Promise<Quote[]>) : []))
    .catch(() => []);
  return loaded;
}

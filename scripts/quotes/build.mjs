/**
 * What scripts/quotes.mjs writes, apart from the files so the tests can check
 * it: each language's lines (public/quotes/<locale>.json) and the Wikiquote
 * credits (public/quotes/credits.json).
 */
import { SHADOW_ERAS } from "../portraits/shadows.mjs";
import { pageRef, pageUrl } from "./wikiquote.mjs";

export const LOCALES = ["en", "ru", "uk"];

/**
 * The year as the caption shows it: 1894; "c. 1600"; AD 65 and 500 BC with
 * their era, since a bare small number reads as nothing.
 */
export function whenOf(quote, locale) {
  const y = quote.year;
  const circa = quote.circa ? { en: "c. ", ru: "ок. ", uk: "бл. " }[locale] : "";
  if (y < 0) return `${circa}${-y} ${{ en: "BC", ru: "до н. э.", uk: "до н. е." }[locale]}`;
  if (y < 1000) return locale === "en" ? `${circa}AD ${y}` : `${circa}${y} ${{ ru: "н. э.", uk: "н. е." }[locale]}`;
  return `${circa}${y}`;
}

/** A small stable hash of a string, 0–1. */
function fixed(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

/** The shadows' eras by the year a person was in their prime; the oldest wear 1914's. */
function shadowEra(year) {
  return year < 1930 ? 1910 : year < 1950 ? 1940 : year < 1980 ? 1960 : year < 2005 ? 1990 : 2020;
}

/**
 * The portrait beside a quote: the speaker's oil portrait where one is
 * painted, else a shadow of their era and sex, the same one every time.
 */
export function portraitOf(quote, { people, painted }) {
  if (quote.person && painted(quote.person)) return `/portraits/${quote.person}.webp`;
  const p = quote.person ? people.get(quote.person) : undefined;
  const sex = p?.gender === "female" ? "female" : "male";
  const era = shadowEra(p?.born ? p.born + 40 : quote.year);
  const looks = SHADOW_ERAS[era][sex].length;
  return `/portraits/_shadow-${era}-${sex}-${Math.floor(fixed(`quote:${quote.person ?? quote.id}`) * looks)}.webp`;
}

/**
 * One language's lines for the game: every quote with the day a game may
 * show it from (to hold back those said after the game's day), the year as
 * shown, the speaker, the text and the portrait; every tip's text. English
 * stands in for a missing line.
 */
export function buildLocale(quotes, tips, locale, portraits) {
  return {
    quotes: quotes.map((q) => ({
      id: q.id,
      from: shownFrom(q.date),
      when: whenOf(q, locale),
      name: q.name[locale] || q.name.en,
      text: q.text[locale] || q.text.en,
      portrait: portraitOf(q, portraits),
    })),
    tips: tips.map((t) => ({ id: t.id, text: t.text[locale] || t.text.en })),
  };
}

/** The Wikiquote pages the quotes come from, each credited once (CC BY-SA 4.0), by the speaker's name. */
export function buildCredits(quotes) {
  const out = {};
  for (const q of quotes) {
    if (!q.wikiquote || out[q.wikiquote]) continue;
    const { lang, title } = pageRef(q.wikiquote);
    out[q.wikiquote] = {
      name: q.name.en,
      source: pageUrl(q.wikiquote),
      file: `${title} – ${lang}.wikiquote.org`,
      author: "Wikiquote contributors",
      licence: "CC BY-SA",
      licenceName: "CC BY-SA 4.0",
      licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
      changes: "chosen lines, translated into Russian, Ukrainian and English",
    };
  }
  return Object.fromEntries(Object.entries(out).sort(([, a], [, b]) => a.name.localeCompare(b.name)));
}

/** The date a game compares with: a year alone counts from its last day, a month from its last day, so nothing shows before it was said. */
export const shownFrom = (date) => (/^\d{4}$/.test(date) ? `${date}-12-31` : /^\d{4}-\d{2}$/.test(date) ? `${date}-31` : date);

import { formatDate } from "@/engine/calendar";
import { getScenario, SCENARIO_ORDER } from "@/engine/scenarios";
import type { Locale } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { translate } from "@/i18n/translate";

/**
 * The questions on the demo's front page, in their order. The page shows
 * them and its structured data (lib/seo.ts faqJsonLd) repeats the same words,
 * as search engines require of an FAQ.
 */
export const FAQ = ["what", "dates", "free", "browser", "languages", "goal"] as const;

/** A day as the dates list writes it: "1 September 1939", "1 сентября 1939", without the year's "г." or "р.". */
export const plainDate = (date: string, locale: Locale) => formatDate(date, locale).replace(/\s(?:г|р)\.$/, "");

/** The questions and answers in a language; the dates answer lists the dates from the scenarios themselves. */
export function faqEntries(locale: Locale): { id: (typeof FAQ)[number]; question: string; answer: string }[] {
  const dates = SCENARIO_ORDER.map((id) => {
    const s = getScenario(id);
    return `${plainDate(s.startDate, locale)} (${s.title[locale]})`;
  }).join(", ");
  return FAQ.map((id) => ({
    id,
    question: translate(locale, `home.faq.${id}.q` as MessageKey),
    answer: translate(locale, `home.faq.${id}.a` as MessageKey, { dates }),
  }));
}

import type { Locale, TimeStep } from "./types";

export const TIME_STEPS: TimeStep[] = ["week", "month", "quarter", "half", "year"];

/** English, for the model's prompt. */
export const STEP_LABEL_EN: Record<TimeStep, string> = {
  week: "one week",
  month: "one month",
  quarter: "three months",
  half: "six months",
  year: "one year",
};

function parse(date: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error(`Invalid date: ${date}`);
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function format(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * The date one step later. Months are calendar months, clamped to the last
 * day: 31 January plus a month is 28/29 February, not 3 March.
 */
export function addStep(date: string, step: TimeStep): string {
  const d = parse(date);
  if (step === "week") {
    d.setUTCDate(d.getUTCDate() + 7);
    return format(d);
  }
  const months = { month: 1, quarter: 3, half: 6, year: 12 }[step];
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return format(d);
}

const INTL_LOCALE: Record<Locale, string> = { ru: "ru-RU", uk: "uk-UA", en: "en-GB" };

/** "28 июня 1914 г." / "28 June 1914". */
export function formatDate(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(parse(date));
}

export function formatShortDate(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(parse(date));
}

/** The month and year, "May 2024" / "май 2024 г.": when an incident a crisis grew from began. Takes "2024-05" or a whole date. */
export function formatMonth(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { month: "long", year: "numeric", timeZone: "UTC" }).format(parse(date.length === 7 ? `${date}-01` : date));
}

/** The day and month alone, "25 August": two starts of one year side by side. */
export function formatDayMonth(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { day: "numeric", month: "long", timeZone: "UTC" }).format(parse(date));
}

export function yearOf(date: string): number {
  return parse(date).getUTCFullYear();
}

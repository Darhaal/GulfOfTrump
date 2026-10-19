import type { Locale, Localized, Text } from "./types";

/** The string for a locale, whether the text was authored in three or written in one. */
export function tr(text: Text | undefined, locale: Locale): string {
  if (text === undefined) return "";
  return typeof text === "string" ? text : text[locale] || text.en;
}

/** English, for the model. */
export function en(text: Text | undefined): string {
  return tr(text, "en");
}

/** The same string in every locale — for names that are not translated. */
export function same(value: string): Localized {
  return { ru: value, uk: value, en: value };
}

/** "united-states-virgin-islands" -> "United States Virgin Islands". */
export function titleCase(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

/** Lowercase ASCII words joined by dashes, as region ids and country tags are. */
export function slug(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

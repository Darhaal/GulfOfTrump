import { notFound } from "next/navigation";
import { LOCALES, type Locale } from "@/engine/types";

/** The language of a page's [lang] segment; anything else is not a page. */
export function pageLocale(lang: string): Locale {
  if (!(LOCALES as readonly string[]).includes(lang)) notFound();
  return lang as Locale;
}

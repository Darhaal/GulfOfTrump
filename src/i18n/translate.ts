import type { Locale } from "@/engine/types";
import { MESSAGES, type MessageKey } from "./messages";

/**
 * An interface string in a language, its `{name}` placeholders filled. Kept
 * apart from useI18n (a client module) so the server can use it too: page
 * titles and descriptions, the structured data of a page.
 */
export function translate(locale: Locale, key: MessageKey, vars?: Record<string, string | number>): string {
  let text: string = MESSAGES[locale][key] ?? MESSAGES.en[key];
  if (vars) for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{${k}}`, String(v));
  return text;
}

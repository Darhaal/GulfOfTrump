"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Locale } from "@/engine/types";
import { useI18n } from "@/i18n/useI18n";
import { localePath, splitLocale } from "@/lib/localePath";
import { setPreference } from "@/lib/preferences";

/** Each language by its own name, as Settings shows them. */
const NAMES: [Locale, string][] = [
  ["en", "English"],
  ["ru", "Русский"],
  ["uk", "Українська"],
];

/**
 * The page in the other languages, as plain links: search engines follow
 * them to each language's address, and a click also makes it the player's
 * language, so the bare English address opens in English.
 */
export default function LanguageLinks({ className = "" }: { className?: string }) {
  const { t, locale } = useI18n();
  const { path } = splitLocale(usePathname() ?? "/");
  return (
    <nav aria-label={t("home.languages")} className={`flex flex-wrap items-center gap-3 ${className}`}>
      {NAMES.map(([l, name]) => (
        <Link
          key={l}
          href={localePath(l, path)}
          hrefLang={l}
          lang={l}
          aria-current={l === locale ? "true" : undefined}
          onClick={() => setPreference("locale", l)}
          className={l === locale ? "font-bold text-ink" : "hover:text-accent"}
        >
          {name}
        </Link>
      ))}
    </nav>
  );
}

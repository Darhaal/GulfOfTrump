"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from "react";
import type { Locale } from "@/engine/types";
import { localePath, splitLocale } from "@/lib/localePath";
import { setPreference, usePreference } from "@/lib/preferences";

/**
 * The language of the page's address: Russian under /ru, Ukrainian under
 * /uk, null on a bare address, where the player's own choice rules
 * (lib/localePath.ts). useI18n reads it first, so the server renders a /ru
 * page in Russian.
 */
export const RouteLocaleContext = createContext<Locale | null>(null);

/**
 * Keeps the address and the player's language in step: opening /ru sets
 * Russian for the whole app (a game begun from there is in Russian too), and
 * picking another language in Settings opens the same page at that
 * language's address.
 */
function Sync({ locale }: { locale: Locale }) {
  const [preferred] = usePreference("locale");
  const router = useRouter();
  // Until the language set on opening reads back, a different value is the old one, not a choice.
  const settled = useRef(false);
  useEffect(() => {
    if (!settled.current) {
      if (preferred === locale) settled.current = true;
      else setPreference("locale", locale);
      return;
    }
    if (preferred === locale) return;
    const { path } = splitLocale(window.location.pathname);
    router.replace(localePath(preferred, path) + window.location.search + window.location.hash);
  }, [preferred, locale, router]);
  return null;
}

export function RouteLocaleProvider({ locale, children }: { locale: Locale | null; children: ReactNode }) {
  return (
    <RouteLocaleContext value={locale}>
      {locale && <Sync key={locale} locale={locale} />}
      {children}
    </RouteLocaleContext>
  );
}

/** A page's address in the language of the page it is linked from: "/about" on /ru is "/ru/about". */
export function useLocalePath() {
  const route = useContext(RouteLocaleContext);
  return useCallback((path: string) => (route ? localePath(route, path) : path), [route]);
}

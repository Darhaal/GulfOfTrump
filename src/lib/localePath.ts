import type { Locale } from "@/engine/types";

/**
 * The languages of the site's addresses. English pages live at the bare
 * address (/, /new/1939, /about), Russian and Ukrainian under /ru and /uk
 * (/ru, /uk/new/1939/eve), so each language has pages of its own that a
 * search engine finds in that language. Inside the app the pages are
 * app/[lang]/…: src/proxy.ts serves a bare address from /en and sends /en/…
 * back to the bare one, so English has one address per page.
 *
 * The bare pages follow the player's own language once they open (Settings,
 * the browser's language), as they always have; a page under /ru or /uk is
 * in that language, and opening it sets it (i18n/routeLocale.tsx).
 */
export const ROUTE_LOCALES = ["ru", "uk"] as const satisfies readonly Locale[];
export type RouteLocale = (typeof ROUTE_LOCALES)[number];

export const isRouteLocale = (value: unknown): value is RouteLocale => (ROUTE_LOCALES as readonly unknown[]).includes(value);

/** A page's address in a language: localePath("ru", "/new/1939") is "/ru/new/1939", localePath("en", "/") is "/". */
export function localePath(locale: Locale, path: string): string {
  if (locale === "en") return path;
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

/** An address split into its language prefix and the page: "/ru/new/1939" is ru and "/new/1939", "/about" has no prefix. */
export function splitLocale(pathname: string): { locale: Locale | null; path: string } {
  const match = /^\/(en|ru|uk)(?=\/|$)(.*)$/.exec(pathname);
  if (!match) return { locale: null, path: pathname };
  return { locale: match[1] as Locale, path: match[2] || "/" };
}

/** The pages with an address in every language: the front page, each date and start, about and privacy. */
export function isLocalizedPage(path: string): boolean {
  return path === "/" || path === "/about" || path === "/privacy" || /^\/new\/[^/]+(?:\/[^/]+)?$/.test(path);
}

/** Pages with one address whatever the language (a game, the settings, sign-in): /ru/play/… goes to /play/…. */
const SINGLE = /^\/(?:play|settings|auth)(?:\/|$)/;

/**
 * What src/proxy.ts does with a request for a page: a bare address is served
 * from /en (rewrite), /en/… is sent to the bare address and /ru/settings to
 * /settings (redirect), and the rest of /ru and /uk is served as it is (null).
 */
export function localeRoute(pathname: string): { redirect: string } | { rewrite: string } | null {
  const { locale, path } = splitLocale(pathname);
  if (locale === "en") return { redirect: path };
  if (locale) return SINGLE.test(path) ? { redirect: path } : null;
  return { rewrite: pathname === "/" ? "/en" : `/en${pathname}` };
}

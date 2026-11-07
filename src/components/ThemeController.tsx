"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePreference } from "@/lib/preferences";
import { useI18n } from "@/i18n/useI18n";

const BAR = { light: "#F5F0E6", dark: "#12100D" } as const;

const noSubscription = () => () => {};

/**
 * THEME_SCRIPT in the page's <head> as the server sends it. When the browser
 * builds the root anew – moving between /ru, /uk and a bare address – the
 * theme is already set, and a script React made would never run, so there is none.
 */
export function ThemeScript() {
  const fromServer = useSyncExternalStore(noSubscription, () => false, () => true);
  return fromServer ? <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} /> : null;
}

/**
 * Runs in <head> before the first paint, so a dark-theme player never sees a light flash. The player's
 * language goes on <html lang> only on a bare (English) address: a /ru or /uk page is in its own language.
 */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('got_theme');var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);var l=localStorage.getItem('got_locale');if(l&&document.documentElement.lang==='en')document.documentElement.lang=l;}catch(e){}})();`;

/** Keeps <html class="dark"> and <html lang> in step with the settings. */
export default function ThemeController() {
  const [theme] = usePreference("theme");
  const { locale } = useI18n();

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && media.matches);
      document.documentElement.classList.toggle("dark", dark);
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", BAR[dark ? "dark" : "light"]);
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return null;
}

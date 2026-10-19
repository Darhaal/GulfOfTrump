"use client";

import { useEffect } from "react";
import { usePreference } from "@/lib/preferences";
import { useI18n } from "@/i18n/useI18n";

const BAR = { light: "#F8FAFC", dark: "#0E1116" } as const;

/** Runs in <head> before the first paint, so a dark-theme player never sees a light flash. */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('got_theme');var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);var l=localStorage.getItem('got_locale');if(l)document.documentElement.lang=l;}catch(e){}})();`;

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

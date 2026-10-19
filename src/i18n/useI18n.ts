"use client";

import { useCallback } from "react";
import { usePreference } from "@/lib/preferences";
import { tr } from "@/engine/text";
import type { Locale, Text } from "@/engine/types";
import { MESSAGES, type MessageKey } from "./messages";

export function translate(locale: Locale, key: MessageKey, vars?: Record<string, string | number>): string {
  let text: string = MESSAGES[locale][key] ?? MESSAGES.en[key];
  if (vars) for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{${k}}`, String(v));
  return text;
}

/** The interface language and helpers bound to it. */
export function useI18n() {
  const [locale, setLocale] = usePreference("locale");
  const t = useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) => translate(locale, key, vars),
    [locale],
  );
  const text = useCallback((value: Text | undefined) => tr(value, locale), [locale]);
  /** Thousands of people, short: "340 тыс.", "1,2 млн", "38M". */
  const people = useCallback(
    (thousands: number) => {
      const n = (v: number, digits: number) => v.toLocaleString(locale, { maximumFractionDigits: digits });
      if (thousands < 1000) return translate(locale, "unit.thousand", { n: n(Math.max(1, Math.round(thousands)), 0) });
      const millions = thousands / 1000;
      return translate(locale, "unit.million", { n: n(millions, millions < 10 ? 1 : 0) });
    },
    [locale],
  );
  /** Billions of dollars, short: "$39 млрд", "$1,2 трлн", "$450 M". */
  const money = useCallback(
    (billions: number) => {
      const abs = Math.abs(billions);
      const sign = billions < 0 ? "−" : "";
      const n = (v: number) => v.toLocaleString(locale, { maximumFractionDigits: v >= 100 ? 0 : 1 });
      if (abs >= 1000) return sign + translate(locale, "unit.money.trillion", { n: n(abs / 1000) });
      if (abs >= 1) return sign + translate(locale, "unit.money.billion", { n: n(abs) });
      return sign + translate(locale, "unit.money.million", { n: n(Math.round(abs * 1000)) });
    },
    [locale],
  );
  return { locale, setLocale, t, text, people, money };
}

/** A translated error message for a server error code, falling back to its English text. */
export function errorKey(code: string): MessageKey | null {
  const key = `error.${code}` as MessageKey;
  return key in MESSAGES.en ? key : null;
}

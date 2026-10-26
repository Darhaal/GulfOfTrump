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

/**
 * Billions of dollars in words of the locale, with `extra` more decimals than the short form: "$117 млрд" at 0,
 * "$117,2 млрд" at 1. A weekly turn moves a large economy by a fraction of a billion, which the short form hides.
 */
export function moneyText(locale: Locale, billions: number, extra = 0): string {
  const abs = Math.abs(billions);
  const sign = billions < 0 ? "−" : "";
  const n = (v: number, base: number) => v.toLocaleString(locale, { minimumFractionDigits: extra > 0 ? Math.min(3, base + extra) : 0, maximumFractionDigits: Math.min(3, base + extra) });
  if (abs >= 1000) return sign + translate(locale, "unit.money.trillion", { n: n(abs / 1000, 1) });
  if (abs >= 1) return sign + translate(locale, "unit.money.billion", { n: n(abs, abs >= 100 ? 0 : 1) });
  return sign + translate(locale, "unit.money.million", { n: n(Math.round(abs * 1000 * 10 ** Math.min(1, extra)) / 10 ** Math.min(1, extra), 0) });
}

/**
 * Two amounts with just enough decimals to tell them apart, and the change between them, signed:
 * {from: "$117,24 млрд", to: "$117,61 млрд", delta: "+$370 M"}. Equal amounts keep the short form.
 */
export function moneyChange(locale: Locale, from: number, to: number): { from: string; to: string; delta: string } {
  let extra = 0;
  while (extra < 3 && Math.abs(to - from) > 1e-9 && moneyText(locale, from, extra) === moneyText(locale, to, extra)) extra++;
  const d = to - from;
  return { from: moneyText(locale, from, extra), to: moneyText(locale, to, extra), delta: `${d >= 0 ? "+" : "−"}${moneyText(locale, Math.abs(d), Math.abs(d) >= 1 ? 1 : 0).replace(/^−/, "")}` };
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
  /** Money with one more decimal, for figures a weekly turn moves by fractions: "$117,2 млрд", "$1,23 трлн". */
  const moneyFine = useCallback((billions: number) => moneyText(locale, billions, 1), [locale]);
  /** Two amounts told apart and the change between them (moneyChange). */
  const moneyMoved = useCallback((from: number, to: number) => moneyChange(locale, from, to), [locale]);
  return { locale, setLocale, t, text, people, money, moneyFine, moneyMoved };
}

/** A translated error message for a server error code, falling back to its English text. */
export function errorKey(code: string): MessageKey | null {
  const key = `error.${code}` as MessageKey;
  return key in MESSAGES.en ? key : null;
}

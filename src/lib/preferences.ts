"use client";

import { useSyncExternalStore } from "react";
import { LOCALES, type Locale } from "@/engine/types";

/**
 * Per-browser preferences in localStorage, shared between components through
 * useSyncExternalStore so a change in Settings reaches every open screen.
 * Storage can be missing or throw (private windows, blocked site data); the
 * defaults then apply and nothing breaks.
 */
export type Theme = "system" | "light" | "dark";

interface Preferences {
  locale: Locale;
  theme: Theme;
  model: string;
}

const KEYS: Record<keyof Preferences, string> = {
  locale: "got_locale",
  theme: "got_theme",
  model: "got_model",
};

function browserLocale(): Locale {
  if (typeof navigator === "undefined") return "en";
  for (const lang of navigator.languages ?? [navigator.language]) {
    const code = lang.slice(0, 2).toLowerCase();
    if (code === "uk") return "uk";
    if (code === "ru" || code === "be" || code === "kk") return "ru";
    if (code === "en") return "en";
  }
  return "en";
}

const DEFAULTS = (): Preferences => ({ locale: browserLocale(), theme: "system", model: "" });

function read<K extends keyof Preferences>(key: K): Preferences[K] {
  try {
    const value = localStorage.getItem(KEYS[key]);
    if (value === null) return DEFAULTS()[key];
    if (key === "locale" && !LOCALES.includes(value as Locale)) return DEFAULTS()[key];
    if (key === "theme" && !["system", "light", "dark"].includes(value)) return DEFAULTS()[key];
    return value as Preferences[K];
  } catch {
    return DEFAULTS()[key];
  }
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key && Object.values(KEYS).includes(e.key)) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function setPreference<K extends keyof Preferences>(key: K, value: Preferences[K]) {
  try {
    localStorage.setItem(KEYS[key], value);
    delete memory[key];
  } catch {
    // Not persisted; the in-memory fallback still updates the screen.
    memory[key] = value;
  }
  listeners.forEach((l) => l());
}

/** Values set while storage is unavailable, so the choice holds for the session. */
const memory: Partial<Preferences> = {};

export function usePreference<K extends keyof Preferences>(key: K): [Preferences[K], (value: Preferences[K]) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => (memory[key] as Preferences[K] | undefined) ?? read(key),
    // The server renders English and the system theme; the client corrects after hydration.
    () => (key === "locale" ? "en" : key === "theme" ? "system" : "") as Preferences[K],
  );
  return [value, (v) => setPreference(key, v)];
}

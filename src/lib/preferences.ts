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
  /** Reading aloud: "off" hides the speaker buttons. */
  speech: string;
  /** The voice picked in Settings (its voiceURI), or "" for the best one. */
  voice: string;
  /** Speaking rate, "" for normal. */
  rate: string;
  /** "on" reads each new turn aloud as it arrives. */
  readTurns: string;
  /** Voice input: "off" hides the microphone buttons. */
  mic: string;
  /** The microphone picked in Settings (its deviceId), or "" for the system's. */
  micDevice: string;
  /** How loud the voice reads, 0–100; "" for full. */
  volume: string;
  /** "1" when the player chose the offline demo game master (lib/gameMaster.ts). */
  demo: string;
  /** The game's left panel width in pixels, dragged by its edge; "" for the default. */
  leftWidth: string;
  /** "done" once the tutorial was finished or skipped, or this browser was found to have played before (lib/tutorial.ts). */
  tutorial: string;
  /** How many ministers report after a turn on their own, "0"–"5"; "" for the default (engine/reports.ts voicesFrom). */
  reports: string;
}

const KEYS: Record<keyof Preferences, string> = {
  locale: "got_locale",
  theme: "got_theme",
  model: "got_model",
  speech: "got_speech",
  voice: "got_voice",
  rate: "got_rate",
  readTurns: "got_read_turns",
  mic: "got_mic",
  micDevice: "got_mic_device",
  volume: "got_volume",
  demo: "got_demo",
  leftWidth: "got_left_width",
  tutorial: "got_tutorial",
  reports: "got_reports",
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

const DEFAULTS = (): Preferences => ({ locale: browserLocale(), theme: "system", model: "", speech: "", voice: "", rate: "", readTurns: "", mic: "", micDevice: "", volume: "", demo: "", leftWidth: "", tutorial: "", reports: "" });

function read<K extends keyof Preferences>(key: K): Preferences[K] {
  try {
    const value = localStorage.getItem(KEYS[key]);
    if (value === null) return DEFAULTS()[key];
    if (key === "locale" && !LOCALES.includes(value as Locale)) return DEFAULTS()[key];
    if (key === "theme" && !["system", "light", "dark"].includes(value)) return DEFAULTS()[key];
    if (key === "demo" && value !== "1") return DEFAULTS()[key];
    if (key === "leftWidth" && !/^\d{3,4}$/.test(value)) return DEFAULTS()[key];
    if (key === "tutorial" && value !== "done") return DEFAULTS()[key];
    if (key === "reports" && !/^[0-5]$/.test(value)) return DEFAULTS()[key];
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

/** A preference outside React, for code that runs on an event (a turn arriving). */
export function getPreference<K extends keyof Preferences>(key: K): Preferences[K] {
  return (memory[key] as Preferences[K] | undefined) ?? read(key);
}

/** The current value outside React, for code that runs on a click or a request. */
export const readPreference = <K extends keyof Preferences>(key: K): Preferences[K] => (memory[key] as Preferences[K] | undefined) ?? read(key);

export function usePreference<K extends keyof Preferences>(key: K): [Preferences[K], (value: Preferences[K]) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => (memory[key] as Preferences[K] | undefined) ?? read(key),
    // The server renders English and the system theme; the client corrects after hydration.
    () => (key === "locale" ? "en" : key === "theme" ? "system" : "") as Preferences[K],
  );
  return [value, (v) => setPreference(key, v)];
}

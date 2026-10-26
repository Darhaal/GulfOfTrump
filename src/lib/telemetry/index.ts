"use client";

import { useSyncExternalStore } from "react";
import { APP_VERSION, isDemo, isDesktopApp } from "@/constants/app";
import { getAiStatus } from "@/lib/api";
import { desktopWindow } from "@/lib/desktop";
import { readPreference } from "@/lib/preferences";
import { createTelemetry, type Telemetry, type TelemetrySnapshot } from "./core";
import { telemetryConfig, type TelemetryFeature, type TelemetryPlatform } from "./events";

/**
 * The browser's telemetry (core.ts), sent to the game's own Supabase project
 * with a plain fetch to PostgREST – supabase-js stays unloaded unless cloud
 * saves are on. Off until the player says yes (components/Telemetry.tsx asks
 * once; Settings switches it). Unavailable without Supabase, with
 * NEXT_PUBLIC_GOT_TELEMETRY=off, under tests, and while the mock game master
 * of GOT_MOCK_AI=1 runs (the demo site's stand-in is fine).
 */

// Next.js inlines these at build time only when they are written out by name.
const CONFIG = telemetryConfig({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_GOT_TELEMETRY: process.env.NEXT_PUBLIC_GOT_TELEMETRY,
  NODE_ENV: process.env.NODE_ENV,
  VITEST: process.env.VITEST,
});

/** Where this copy runs; the Store copy is told apart by the desktop app (process.windowsStore in desktop/main.cjs). */
async function detectPlatform(): Promise<TelemetryPlatform> {
  if (process.env.NODE_ENV !== "production") return "dev";
  if (isDemo()) return "demo";
  if (!isDesktopApp()) return "web";
  const snapshot = await desktopWindow()?.updates?.get().catch(() => null);
  return snapshot?.store ? "store" : "desktop";
}

function localStore() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function randomId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

let instance: Telemetry | null = null;

/** The one telemetry of this page; null on the server. */
export function getTelemetry(): Telemetry | null {
  if (typeof window === "undefined") return null;
  instance ??= createTelemetry({
    config: CONFIG,
    storage: localStore(),
    fetch: (input, init) => window.fetch(input, init),
    appVersion: APP_VERSION,
    platform: detectPlatform,
    locale: () => readPreference("locale"),
    // The mock game master of GOT_MOCK_AI=1 is a developer's run: it never sends. The demo site's is the real thing.
    gate: () => getAiStatus().then((status) => status.provider !== "mock" || isDemo()),
    randomId,
    sha256,
    setTimer: (run, ms) => window.setTimeout(run, ms),
    clearTimer: (timer) => window.clearTimeout(timer as number),
  });
  return instance;
}

/** Queues an event when the player said yes; does nothing otherwise. */
export function track(event: "app_start" | "game_start" | "game_load" | "turn_end" | "error" | "feature", fields?: Record<string, unknown>) {
  getTelemetry()?.track(event, fields);
}

export function trackFeature(feature: TelemetryFeature) {
  track("feature", { feature });
}

/** An error the player was shown, by its code alone. */
export function trackError(code: string) {
  if (code && code !== "cancelled") track("error", { error_code: code });
}

const SERVER: TelemetrySnapshot = { consent: "unasked", availability: "off", installId: null };
const noop = () => () => {};

/** The player's answer and whether this copy can send, for the consent dialog and Settings. */
export function useTelemetry(): TelemetrySnapshot & { setConsent: (on: boolean) => void } {
  const telemetry = typeof window === "undefined" ? null : getTelemetry();
  const snapshot = useSyncExternalStore(telemetry?.subscribe ?? noop, telemetry?.snapshot ?? (() => SERVER), () => SERVER);
  return { ...snapshot, setConsent: (on) => getTelemetry()?.setConsent(on) };
}

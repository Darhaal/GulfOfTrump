"use client";

import { useSyncExternalStore } from "react";
import type { ChronicleEntry, Locale } from "@/engine/types";
import { getPreference } from "@/lib/preferences";
import { isBuiltinLang, parseBuiltinChoice } from "./builtin";
import { builtinReady, readBuiltin, stopBuiltin } from "./builtinVoice";
import { cleanForSpeech, readerFor, SPEECH_LANG, splitForSpeech, turnSpeech } from "./text";

/**
 * Reading the game's text aloud with the voices of the system or the browser
 * (speechSynthesis), or with the game's own voice once downloaded
 * (builtinVoice.ts) where the system has none for the language or the player
 * picked it. Nothing reads by itself unless the player asks for each new turn
 * to be read. One text at a time; its id lets the button that started it show
 * a stop instead.
 */

interface SpeakerState {
  /** The id of the text being read, or null. */
  speaking: string | null;
  /** Set once a session, the first time a stand-in voice reads a language that has none of its own. */
  standIn: Locale | null;
  /** Set when a text was not read because no voice on this computer reads its language. */
  missing: Locale | null;
}

let state: SpeakerState = { speaking: null, standIn: null, missing: null };
let warned = false;
const listeners = new Set<() => void>();
const set = (next: Partial<SpeakerState>) => {
  state = { ...state, ...next };
  for (const l of listeners) l();
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";

/** Speaking rates offered in Settings: "normal" is the brisk pace of a person reading aloud, which the engines' own 1 is slower than. */
export const RATES = { slow: 0.9, normal: 1.15, fast: 1.45 } as const;
export type Rate = keyof typeof RATES;
export const rateOf = (value: string): Rate => (value === "slow" || value === "fast" ? value : "normal");

/** The reading volume, 0–1, from the Settings value: "" (never set) or anything unreadable is full. */
export function volumeOf(value: string): number {
  const n = Number(value);
  return value.trim() === "" || !Number.isFinite(n) ? 1 : Math.min(1, Math.max(0, n / 100));
}

/** The voices the system has; they arrive late in Chrome, hence the event. */
let voices: SpeechSynthesisVoice[] = [];
const subscribeVoices = (listener: () => void) => {
  if (!canSpeak()) return () => {};
  const update = () => {
    voices = speechSynthesis.getVoices();
    listener();
  };
  speechSynthesis.addEventListener("voiceschanged", update);
  update();
  return () => speechSynthesis.removeEventListener("voiceschanged", update);
};
const noVoices: SpeechSynthesisVoice[] = [];

export function useVoices(): SpeechSynthesisVoice[] {
  return useSyncExternalStore(subscribeVoices, () => voices, () => noVoices);
}

/** Which text is being read, and the one-time stand-in notice. */
export function useSpeaker(): SpeakerState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

export function stopSpeaking() {
  if (canSpeak()) speechSynthesis.cancel();
  stopBuiltin();
  set({ speaking: null });
}

/**
 * Reads a text aloud in the interface language, stopping whatever was being
 * read. The game's own voice reads when the player picked it, or where the
 * system has no voice of the language's own (none at all, or Ukrainian read
 * by a Russian voice), once it is downloaded. Where no voice reads the
 * language it reads nothing and says why (`missing`) rather than let a voice
 * of another script read the digits.
 */
export function speak(id: string, text: string, locale: Locale) {
  const own = isBuiltinLang(locale) && builtinReady(locale) ? locale : null;
  if (!canSpeak() && !own) return;
  if (canSpeak()) speechSynthesis.cancel();
  stopBuiltin();
  const pieces = splitForSpeech(cleanForSpeech(text));
  if (!pieces.length) return set({ speaking: null });
  const wanted = getPreference("voice") || undefined;
  const rate = RATES[rateOf(getPreference("rate"))];
  const volume = volumeOf(getPreference("volume"));
  const { voice, standIn, missing } = canSpeak() ? readerFor(speechSynthesis.getVoices(), locale, wanted) : { voice: null, standIn: false, missing: true };
  const picked = wanted ? parseBuiltinChoice(wanted) : null;
  if (own && (picked?.lang === own || missing || standIn)) {
    readBuiltin(pieces, own, picked?.lang === own ? picked.speaker : 0, { rate, volume }, () => state.speaking === id && set({ speaking: null }));
    return set({ speaking: id, missing: null });
  }
  if (missing) return set({ speaking: null, missing: locale });
  pieces.forEach((piece, i) => {
    const u = new SpeechSynthesisUtterance(piece);
    u.lang = voice?.lang ?? SPEECH_LANG[locale];
    if (voice) u.voice = voice;
    u.rate = rate;
    u.volume = volume;
    // The last piece, or any failure, ends the reading; a cancelled one belongs to the next reading.
    if (i === pieces.length - 1) u.onend = () => state.speaking === id && set({ speaking: null });
    u.onerror = (e) => e.error !== "interrupted" && e.error !== "canceled" && state.speaking === id && set({ speaking: null });
    speechSynthesis.speak(u);
  });
  set({ speaking: id, ...(standIn && !warned ? { standIn: locale } : {}) });
  if (standIn) warned = true;
}

export const dismissStandIn = () => set({ standIn: null });
export const dismissMissing = () => set({ missing: null });

/** Reading is on unless the player turned it off. */
export const speechOn = () => canSpeak() && getPreference("speech") !== "off";

/** The id a turn is read under, so its report's speaker shows a stop while it reads. */
export const turnSpeechId = (turn: number) => `turn-${turn}`;

/** Reads a turn that has just arrived, when the player asked for every turn to be read. */
export function readNewTurn(entry: Pick<ChronicleEntry, "turn" | "headline" | "narrative" | "events">, locale: Locale) {
  if (getPreference("readTurns") === "on" && speechOn()) speak(turnSpeechId(entry.turn), turnSpeech(entry), locale);
}

"use client";

import { useSyncExternalStore } from "react";
import type { ChronicleEntry, Locale } from "@/engine/types";
import { getPreference } from "@/lib/preferences";
import { cleanForSpeech, pickVoice, SPEECH_LANG, splitForSpeech, turnSpeech } from "./text";

/**
 * Reading the game's text aloud with the voices of the system or the browser
 * (speechSynthesis): nothing is downloaded and nothing reads by itself unless
 * the player asks for each new turn to be read. One text at a time; its id
 * lets the button that started it show a stop instead.
 */

interface SpeakerState {
  /** The id of the text being read, or null. */
  speaking: string | null;
  /** Set once a session, the first time a stand-in voice reads a language that has none of its own. */
  standIn: Locale | null;
}

let state: SpeakerState = { speaking: null, standIn: null };
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

/** Speaking rates offered in Settings. */
export const RATES = { slow: 0.85, normal: 1, fast: 1.25 } as const;
export type Rate = keyof typeof RATES;
export const rateOf = (value: string): Rate => (value === "slow" || value === "fast" ? value : "normal");

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
  set({ speaking: null });
}

/** Reads a text aloud in the interface language, stopping whatever was being read. */
export function speak(id: string, text: string, locale: Locale) {
  if (!canSpeak()) return;
  speechSynthesis.cancel();
  const pieces = splitForSpeech(cleanForSpeech(text));
  if (!pieces.length) return set({ speaking: null });
  const { voice, standIn } = pickVoice(speechSynthesis.getVoices(), locale, getPreference("voice") || undefined);
  const rate = RATES[rateOf(getPreference("rate"))];
  pieces.forEach((piece, i) => {
    const u = new SpeechSynthesisUtterance(piece);
    u.lang = voice?.lang ?? SPEECH_LANG[locale];
    if (voice) u.voice = voice;
    u.rate = rate;
    // The last piece, or any failure, ends the reading; a cancelled one belongs to the next reading.
    if (i === pieces.length - 1) u.onend = () => state.speaking === id && set({ speaking: null });
    u.onerror = (e) => e.error !== "interrupted" && e.error !== "canceled" && state.speaking === id && set({ speaking: null });
    speechSynthesis.speak(u);
  });
  set({ speaking: id, ...(standIn && !warned ? { standIn: locale } : {}) });
  if (standIn) warned = true;
}

export const dismissStandIn = () => set({ standIn: null });

/** Reading is on unless the player turned it off. */
export const speechOn = () => canSpeak() && getPreference("speech") !== "off";

/** The id a turn is read under, so its report's speaker shows a stop while it reads. */
export const turnSpeechId = (turn: number) => `turn-${turn}`;

/** Reads a turn that has just arrived, when the player asked for every turn to be read. */
export function readNewTurn(entry: Pick<ChronicleEntry, "turn" | "headline" | "narrative" | "events">, locale: Locale) {
  if (getPreference("readTurns") === "on" && speechOn()) speak(turnSpeechId(entry.turn), turnSpeech(entry), locale);
}

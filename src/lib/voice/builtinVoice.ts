"use client";

import { useSyncExternalStore } from "react";
import { BUILTIN_VOICES, hasSpeech, voiceIds, type BuiltinLang } from "./builtin";

/**
 * The game's own voices in the page: downloading and deleting them, and
 * reading a text with one (public/voice/tts-worker.js makes the sound). A
 * reading goes sentence by sentence, the next one made while the last plays.
 * Piper is sped up by its own pace; the other voice by the audio element,
 * which keeps its pitch.
 */

interface BuiltinState {
  /** Downloaded and loaded once in this browser. */
  ready: Record<BuiltinLang, boolean>;
  /** The voice being downloaded, and how far, 0–1. */
  loading: BuiltinLang | null;
  progress: number;
  /** The last download of this voice failed. */
  failed: BuiltinLang | null;
}

const FLAG = (lang: BuiltinLang) => `got_speech_${lang}`;
const CACHES = { runtime: "gulf-speech-runtime", model: "gulf-speech-model" };
/** A breath between sentences, in seconds. */
const PAUSE = 0.12;

const readFlag = (lang: BuiltinLang) => {
  try {
    return localStorage.getItem(FLAG(lang)) === "ready";
  } catch {
    return false;
  }
};
const writeFlag = (lang: BuiltinLang, ready: boolean) => {
  try {
    if (ready) localStorage.setItem(FLAG(lang), "ready");
    else localStorage.removeItem(FLAG(lang));
  } catch {
    // Asked again next time; the files stay cached either way.
  }
};

let state: BuiltinState = { ready: { ru: false, uk: false }, loading: null, progress: 0, failed: null };
let started = false;
const listeners = new Set<() => void>();
const set = (next: Partial<BuiltinState>) => {
  state = { ...state, ...next };
  for (const l of listeners) l();
};
const begin = () => {
  if (started || typeof window === "undefined") return;
  started = true;
  state = { ...state, ready: { ru: readFlag("ru"), uk: readFlag("uk") } };
};
const subscribe = (listener: () => void) => {
  begin();
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const serverState = state;

export function useBuiltin(): BuiltinState {
  return useSyncExternalStore(subscribe, () => state, () => serverState);
}

/** Whether this browser can run a built-in voice at all. */
export const canRunBuiltin = () =>
  typeof window !== "undefined" && typeof Worker !== "undefined" && typeof WebAssembly !== "undefined" && typeof caches !== "undefined" && typeof Audio !== "undefined";

export function builtinReady(lang: BuiltinLang): boolean {
  begin();
  return state.ready[lang];
}

// ——— The worker ———

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (clip: { samples: Float32Array; sampleRate: number }) => void; reject: (e: Error) => void }>();
const loads = new Map<BuiltinLang, { resolve: () => void; reject: (e: Error) => void }[]>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker("/voice/tts-worker.js", { type: "module" });
  worker.onmessage = ({ data }) => {
    if (data?.type === "progress" && data.lang === state.loading) set({ progress: data.total ? data.loaded / data.total : 0 });
    if (data?.type === "ready" || (data?.type === "error" && data.lang)) {
      for (const waiter of loads.get(data.lang) ?? []) {
        if (data.type === "ready") waiter.resolve();
        else waiter.reject(new Error(String(data.message)));
      }
      loads.delete(data.lang);
    }
    if (data?.type === "audio") pending.get(data.id)?.resolve({ samples: data.samples, sampleRate: data.sampleRate });
    if (data?.type === "error" && data.id) pending.get(data.id)?.reject(new Error(String(data.message)));
    if (data?.type === "audio" || (data?.type === "error" && data.id)) pending.delete(data.id);
  };
  return worker;
}

const voiceFor = (lang: BuiltinLang) => {
  const { kind, url, sha256, bytes, sampleRate } = BUILTIN_VOICES[lang];
  return { lang, kind, url, sha256, bytes, sampleRate };
};

function load(lang: BuiltinLang): Promise<void> {
  return new Promise((resolve, reject) => {
    const waiting = loads.get(lang) ?? [];
    waiting.push({ resolve, reject });
    loads.set(lang, waiting);
    if (waiting.length === 1) getWorker().postMessage({ type: "load", voice: voiceFor(lang) });
  });
}

/** Downloads (the first time) and starts a voice, with its progress in the state. */
export async function downloadBuiltin(lang: BuiltinLang): Promise<boolean> {
  set({ loading: lang, progress: 0, failed: null });
  try {
    await load(lang);
    writeFlag(lang, true);
    set({ loading: null, progress: 1, ready: { ...state.ready, [lang]: true } });
    return true;
  } catch {
    set({ loading: null, failed: lang });
    return false;
  }
}

/** Removes a voice from this browser's storage, and the runtime with the last one. */
export async function deleteBuiltin(lang: BuiltinLang) {
  stopBuiltin();
  worker?.terminate();
  worker = null;
  writeFlag(lang, false);
  const ready = { ...state.ready, [lang]: false };
  set({ ready });
  try {
    const models = await caches.open(CACHES.model);
    await models.delete(BUILTIN_VOICES[lang].url);
    if (!ready.ru && !ready.uk) await caches.delete(CACHES.runtime);
  } catch {
    // Nothing stored.
  }
}

/** `lengthScale` is Piper's own pace (below 1 faster); the other voice ignores it. */
function synthesize(lang: BuiltinLang, ids: number[], speaker: number, lengthScale: number): Promise<{ samples: Float32Array; sampleRate: number }> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ type: "speak", id, voice: voiceFor(lang), ids, speaker, lengthScale });
  });
}

/** 16-bit PCM WAV of the samples with a short pause after them, for an audio element. */
export function wavOf(samples: Float32Array, sampleRate: number, pause = PAUSE): Blob {
  const total = samples.length + Math.round(pause * sampleRate);
  const buffer = new ArrayBuffer(44 + total * 2);
  const view = new DataView(buffer);
  const text = (at: number, s: string) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + total * 2, true);
  text(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, total * 2, true);
  for (let i = 0; i < samples.length; i++) view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i]!)) * 0x7fff, true);
  return new Blob([buffer], { type: "audio/wav" });
}

// ——— Reading ———

let stopCurrent: (() => void) | null = null;

export function stopBuiltin() {
  stopCurrent?.();
  stopCurrent = null;
}

/**
 * Reads pieces of text with a built-in voice, one after another, making the
 * next while the last plays. `onEnd` is called once: true when all was read,
 * false when it failed or was stopped.
 */
export function readBuiltin(pieces: string[], lang: BuiltinLang, speaker: number, options: { rate: number; volume: number }, onEnd: (done: boolean) => void) {
  stopBuiltin();
  // One sentence at a time, so the first is heard soon and the next is made while it plays.
  const sentences = pieces.flatMap((p) => p.split(/(?<=[.!?…])\s+/));
  const parts = sentences.map((p) => voiceIds(p, lang)).filter((ids) => hasSpeech(ids, lang));
  let stopped = false;
  let audio: HTMLAudioElement | null = null;
  let url: string | null = null;
  const finish = (done: boolean) => {
    if (stopped) return;
    stopped = true;
    audio?.pause();
    if (url) URL.revokeObjectURL(url);
    if (stopCurrent === stop) stopCurrent = null;
    onEnd(done);
  };
  const stop = () => finish(false);
  stopCurrent = stop;

  // Piper speaks faster by its own pace, which sounds natural; the other voice is sped up in playback, keeping its pitch.
  const piper = BUILTIN_VOICES[lang].kind === "piper";
  const make = (i: number) => (i < parts.length ? synthesize(lang, parts[i]!, speaker, piper ? 1 / options.rate : 1) : null);
  const play = async (i: number, clip: ReturnType<typeof make>) => {
    if (stopped) return;
    if (!clip) return finish(true);
    let made: { samples: Float32Array; sampleRate: number };
    try {
      made = await clip;
    } catch {
      return finish(false);
    }
    if (stopped) return;
    // The next sentence is made while this one plays.
    const next = make(i + 1);
    if (url) URL.revokeObjectURL(url);
    url = URL.createObjectURL(wavOf(made.samples, made.sampleRate));
    audio = new Audio(url);
    audio.preservesPitch = true;
    audio.playbackRate = piper ? 1 : options.rate;
    audio.volume = options.volume;
    audio.onended = () => void play(i + 1, next);
    audio.onerror = () => finish(false);
    audio.play().catch(() => finish(false));
  };
  void play(0, make(0));
}

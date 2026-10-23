"use client";

import { useSyncExternalStore } from "react";
import { isDesktopApp } from "@/constants/app";
import type { Locale } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { getPreference } from "@/lib/preferences";
import { cleanTranscript, isSilent, SPEECH_LANG } from "./text";

/**
 * Voice input, by one of two engines:
 *
 * - "browser": the Web Speech API of Chrome, Edge and Safari, which sends the
 *   audio to the browser maker's speech service and needs nothing installed.
 * - "local": Whisper on this computer (public/voice/whisper-worker.js), after
 *   a one-time download of about 100 MB. The desktop app always uses it: its
 *   browser engine has the API but no service behind it (the requests fail
 *   with "network"). A browser whose service fails is moved to it too.
 *
 * One microphone at a time; `owner` is the button that holds it. Its limits
 * are shown as they bite: the time spoken against the local engine's minute
 * while listening, and a notice when the minute ran out or the words did not
 * fit the field.
 */

export type VoiceEngine = "browser" | "local";
export type Phase = "idle" | "listening" | "working" | "loading";

interface ListenerState {
  owner: string | null;
  phase: Phase;
  /** Download progress of the local model, 0–1. */
  progress: number;
  error: MessageKey | null;
  /** The local model is in this browser's storage and has loaded once. */
  modelReady: boolean;
  /** The browser's speech service failed this session; the local engine stands in. */
  browserFailed: boolean;
  /** When the current listening began (ms), for the time shown while it lasts. */
  since: number;
  /** Seconds a recording may last, where the engine stops it by itself. */
  limit: number | null;
  /** A note after the words were written in: the recording ran out of time, or the field out of room. */
  notice: VoiceNotice | null;
}

export type VoiceNotice = { key: "voice.capped" } | { key: "voice.cut"; n: number };

const MODEL_FLAG = "got_voice_model";
const CACHES = ["gulf-voice-runtime", "gulf-voice-model"];
/** About what the first use downloads: the runtime and Whisper base. */
export const MODEL_MB = 100;
/** Longest recording for the local engine (voice.capped says "a minute"). */
export const MAX_SECONDS = 60;

const readFlag = () => {
  try {
    return localStorage.getItem(MODEL_FLAG) === "ready";
  } catch {
    return false;
  }
};

let state: ListenerState = { owner: null, phase: "idle", progress: 0, error: null, modelReady: false, browserFailed: false, since: 0, limit: null, notice: null };
let started = false;
const listeners = new Set<() => void>();
const set = (next: Partial<ListenerState>) => {
  state = { ...state, ...next };
  for (const l of listeners) l();
};
const subscribe = (listener: () => void) => {
  if (!started) {
    started = true;
    state = { ...state, modelReady: readFlag() };
  }
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const serverState = state;

export function useListener(): ListenerState {
  return useSyncExternalStore(subscribe, () => state, () => serverState);
}

/** The engine for this page once it has mounted (none in the server's HTML). */
export function useVoiceEngine(): VoiceEngine | null {
  return useSyncExternalStore(subscribe, () => voiceEngine(), () => null);
}

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type RecognitionClass = new () => Recognition;

const recognitionClass = (): RecognitionClass | undefined => {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: RecognitionClass; webkitSpeechRecognition?: RecognitionClass };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

const canRecord = () => typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== "undefined";
const canRunLocal = () => canRecord() && typeof Worker !== "undefined" && typeof WebAssembly !== "undefined" && typeof caches !== "undefined" && typeof AudioContext !== "undefined";

/** The engine voice input uses here, or null where neither works (the microphone buttons then stay hidden). */
export function voiceEngine(failed = state.browserFailed): VoiceEngine | null {
  if (typeof window === "undefined") return null;
  if (recognitionClass() && !isDesktopApp() && !failed) return "browser";
  return canRunLocal() ? "local" : null;
}

// ——— The local engine's worker ———

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (text: string) => void; reject: (e: Error) => void }>();
let loading: Promise<void> | null = null;

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker("/voice/whisper-worker.js", { type: "module" });
  worker.onmessage = ({ data }) => {
    // Also while transcribing: a model the browser evicted from its storage comes down again.
    if (data?.type === "progress") set({ progress: data.total ? data.loaded / data.total : 0 });
    if (data?.type === "ready") set({ progress: 1 });
    if (data?.type === "text") pending.get(data.id)?.resolve(String(data.text ?? ""));
    if (data?.type === "error" && data.id) pending.get(data.id)?.reject(new Error(String(data.message)));
    if (data?.type === "text" || (data?.type === "error" && data.id)) pending.delete(data.id);
  };
  return worker;
}

/** Downloads (the first time) and starts the local model. */
export function prepareLocal(): Promise<void> {
  loading ??= new Promise<void>((resolve, reject) => {
    const w = getWorker();
    const onMessage = ({ data }: MessageEvent) => {
      if (data?.type === "ready") {
        w.removeEventListener("message", onMessage);
        try {
          localStorage.setItem(MODEL_FLAG, "ready");
        } catch {
          // Asked again next time; the files stay cached either way.
        }
        set({ modelReady: true });
        resolve();
      } else if (data?.type === "error" && !data.id) {
        w.removeEventListener("message", onMessage);
        loading = null;
        reject(new Error(String(data.message)));
      }
    };
    w.addEventListener("message", onMessage);
    w.postMessage({ type: "load" });
  });
  return loading;
}

/** Downloads the model with progress shown on the button that asked. */
export async function downloadModel(owner: string): Promise<boolean> {
  set({ owner, phase: "loading", progress: 0, error: null });
  try {
    await prepareLocal();
    set({ owner: null, phase: "idle", progress: 1 });
    return true;
  } catch {
    set({ owner, phase: "idle", error: "voice.downloadFailed" });
    return false;
  }
}

/** Removes the downloaded model and its runtime from this browser's storage. */
export async function deleteModel() {
  worker?.terminate();
  worker = null;
  loading = null;
  try {
    localStorage.removeItem(MODEL_FLAG);
  } catch {
    // Nothing stored.
  }
  await Promise.all(CACHES.map((name) => caches.delete(name).catch(() => false)));
  set({ modelReady: false, progress: 0 });
}

function transcribe(audio: Float32Array, language: string): Promise<string> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ type: "transcribe", id, audio, language }, [audio.buffer]);
  });
}

/** Recorded audio as 16 kHz mono samples, the way Whisper hears. */
async function samplesOf(blob: Blob): Promise<Float32Array> {
  const context = new AudioContext({ sampleRate: 16000 });
  try {
    const audio = await context.decodeAudioData(await blob.arrayBuffer());
    if (audio.numberOfChannels === 1) return audio.getChannelData(0).slice();
    const mono = new Float32Array(audio.length);
    for (let c = 0; c < audio.numberOfChannels; c++) audio.getChannelData(c).forEach((v, i) => (mono[i] += v / audio.numberOfChannels));
    return mono;
  } finally {
    void context.close();
  }
}

// ——— Listening ———

let stop: (() => void) | null = null;

const micError = (error: unknown): MessageKey => {
  const name = (error as { name?: string })?.name;
  if (name === "NotAllowedError" || name === "SecurityError") return "voice.denied";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "voice.noMic";
  return "voice.failed";
};

function listenInBrowser(owner: string, locale: Locale, onText: (text: string) => void) {
  const Recognition = recognitionClass()!;
  const rec = new Recognition();
  rec.lang = SPEECH_LANG[locale];
  rec.continuous = true;
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  let error: MessageKey | null = null;
  rec.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const result = e.results[i]!;
      if (result.isFinal) onText(result[0].transcript);
    }
  };
  rec.onerror = (e) => {
    if (e.error === "network" || e.error === "service-not-allowed" || e.error === "language-not-supported") {
      // The browser has the API but no working service behind it: the local engine takes over, if it can.
      error = voiceEngine(true) === "local" ? "voice.browserFailed" : "voice.unavailable";
      set({ browserFailed: true });
    } else if (e.error === "not-allowed") error = "voice.denied";
    else if (e.error === "audio-capture") error = "voice.noMic";
    else if (e.error === "no-speech") error = "voice.noSpeech";
    else if (e.error !== "aborted") error = "voice.failed";
  };
  rec.onend = () => {
    stop = null;
    // The button keeps the microphone's note in view: a problem, or words that did not fit.
    if (state.owner === owner) set({ phase: "idle", error, owner: error || state.notice ? owner : null });
  };
  stop = () => rec.stop();
  set({ owner, phase: "listening", error: null, notice: null, since: Date.now(), limit: null });
  try {
    rec.start();
  } catch {
    stop = null;
    set({ owner, phase: "idle", error: "voice.failed" });
  }
}

async function listenLocally(owner: string, locale: Locale, onText: (text: string) => void) {
  set({ owner, phase: "listening", error: null, notice: null, since: Date.now(), limit: MAX_SECONDS });
  let stream: MediaStream;
  const audio: MediaTrackConstraints = { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true };
  const device = getPreference("micDevice");
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: device ? { ...audio, deviceId: { exact: device } } : audio });
  } catch (error) {
    // The microphone picked in Settings is gone: the system's own instead.
    const gone = device && error instanceof DOMException && (error.name === "OverconstrainedError" || error.name === "NotFoundError");
    try {
      if (!gone) throw error;
      stream = await navigator.mediaDevices.getUserMedia({ audio });
    } catch (again) {
      return set({ owner, phase: "idle", error: micError(again) });
    }
  }
  // Warm the model while the player speaks.
  void prepareLocal().catch(() => undefined);
  const recorder = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  let capped = false;
  const limit = setTimeout(() => {
    if (recorder.state !== "recording") return;
    capped = true;
    recorder.stop();
  }, MAX_SECONDS * 1000);
  recorder.onstop = async () => {
    clearTimeout(limit);
    stop = null;
    for (const track of stream.getTracks()) track.stop();
    set({ phase: "working" });
    try {
      const audio = await samplesOf(new Blob(chunks, { type: recorder.mimeType }));
      if (isSilent(audio)) return set({ owner, phase: "idle", error: "voice.noSpeech" });
      const text = cleanTranscript(await transcribe(audio, locale));
      if (!text) return set({ owner, phase: "idle", error: "voice.noSpeech" });
      set(capped ? { owner, phase: "idle", notice: { key: "voice.capped" } } : { owner: null, phase: "idle" });
      onText(text);
    } catch {
      set({ owner, phase: "idle", error: "voice.failed" });
    }
  };
  stop = () => recorder.state === "recording" && recorder.stop();
  recorder.start();
  // The minute counts from when the recording starts, not from asking for the microphone.
  set({ since: Date.now() });
}

/** Starts listening for a field; the words arrive through onText. Another field's listening stops first. */
export function startListening(owner: string, locale: Locale, onText: (text: string) => void) {
  stop?.();
  const engine = voiceEngine();
  if (engine === "browser") listenInBrowser(owner, locale, onText);
  else if (engine === "local") void listenLocally(owner, locale, onText);
}

/** Stops listening; what was said is still written in. */
export function stopListening() {
  stop?.();
}

export const clearVoiceError = (owner: string) => state.owner === owner && state.phase === "idle" && set({ owner: null, error: null, notice: null });

/** A note on a field's button after its words were written in (a recording cut at the minute, words that did not fit). */
export function showVoiceNotice(owner: string, notice: VoiceNotice) {
  if (state.owner !== null && state.owner !== owner) return;
  set({ owner, notice });
}

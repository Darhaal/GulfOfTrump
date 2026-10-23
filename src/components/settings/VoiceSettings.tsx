"use client";

import { Mic, Settings2, Speaker, Square, Trash2, Volume2 } from "lucide-react";
import { useSyncExternalStore, type ReactNode } from "react";
import { ui } from "@/components/ui/classes";
import BuiltinDownload from "@/components/voice/BuiltinDownload";
import { isDesktopApp } from "@/constants/app";
import { desktopWindow } from "@/lib/desktop";
import { useI18n } from "@/i18n/useI18n";
import { usePreference } from "@/lib/preferences";
import { revealMicrophones, useMicrophones } from "@/lib/voice/devices";
import { deleteModel, MODEL_MB, useListener, useVoiceEngine } from "@/lib/voice/listener";
import { canSpeak, RATES, rateOf, speak, stopSpeaking, useSpeaker, useVoices, volumeOf, type Rate } from "@/lib/voice/speaker";
import { BUILTIN_VOICES, builtinChoice, isBuiltinLang, parseBuiltinChoice } from "@/lib/voice/builtin";
import { canRunBuiltin, useBuiltin } from "@/lib/voice/builtinVoice";
import { readerFor, voicesFor } from "@/lib/voice/text";
import { ORDER_CHARS } from "@/lib/orders";

const none = () => () => {};
const SAMPLE = "settings-sample";

function Segments<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (value: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl bg-page p-1">
      {options.map(([v, label]) => (
        <button key={v} type="button" onClick={() => onChange(v)} className={`${ui.segment} flex-1 ${v === value ? `${ui.segmentOn} bg-surface shadow-sm` : ui.segmentOff}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <span className={ui.label}>{label}</span>
      {children}
    </div>
  );
}

/**
 * Reading aloud (voice, speed, volume, the speaker, every new turn) and voice
 * input (on or off, the microphone, how it works and its limits, the local
 * model). For Russian and Ukrainian, the game's own voice: its download, and
 * its speakers in the list once downloaded. Where no voice reads the language,
 * how to add one instead of a list.
 */
export default function VoiceSettings() {
  const { t, locale } = useI18n();
  const [speech, setSpeech] = usePreference("speech");
  const [voice, setVoice] = usePreference("voice");
  const [rate, setRate] = usePreference("rate");
  const [readTurns, setReadTurns] = usePreference("readTurns");
  const [mic, setMic] = usePreference("mic");
  const [micDevice, setMicDevice] = usePreference("micDevice");
  const [volume, setVolume] = usePreference("volume");
  const { microphones, named } = useMicrophones();
  const soundSettings = useSyncExternalStore(none, () => Boolean(desktopWindow()?.openSoundSettings), () => false);
  const speechSettings = useSyncExternalStore(none, () => Boolean(desktopWindow()?.openSpeechSettings), () => false);
  const able = useSyncExternalStore(none, canSpeak, () => false);
  const desktop = useSyncExternalStore(none, isDesktopApp, () => false);
  const voices = useVoices();
  const { speaking } = useSpeaker();
  const engine = useVoiceEngine();
  const listener = useListener();
  const offered = voicesFor(voices, locale);
  const picked = readerFor(voices, locale, voice || undefined);
  const builtin = useBuiltin();
  const runsBuiltin = useSyncExternalStore(none, canRunBuiltin, () => false);
  const own = isBuiltinLang(locale) && runsBuiltin ? locale : null;
  // Downloaded, the game's voice reads where the system has none, so nothing is missing.
  const ownReady = own ? builtin.ready[own] : false;
  const chosenOwn = own && parseBuiltinChoice(voice)?.lang === own;
  const missing = picked.missing && !ownReady;
  const onOff = (on: boolean) => (on ? "on" : "off");

  return (
    <div className="grid gap-4">
      {able && (
        <>
          <Row label={t("voice.settings.read")}>
            <Segments value={onOff(speech !== "off")} options={[["on", t("voice.settings.on")], ["off", t("voice.settings.off")]]} onChange={(v) => setSpeech(v === "off" ? "off" : "")} />
          </Row>
          {speech !== "off" && (
            <>
              <Row label={t("voice.settings.voice")}>
                {voices.length === 0 && !ownReady ? (
                  <p className="text-xs font-medium text-muted">{t("voice.settings.noVoices")}</p>
                ) : missing ? (
                  <div className="grid gap-2">
                    <p className="text-xs font-medium leading-relaxed text-ink">
                      {t("voice.missing")}
                      {!desktop && ` ${t("voice.missingBrowser")}`}
                    </p>
                    {speechSettings && (
                      <button type="button" onClick={() => void desktopWindow()?.openSpeechSettings?.()} className={`${ui.secondary} w-fit px-3 py-2 text-xs`}>
                        <Settings2 className="h-3.5 w-3.5" />
                        {t("voice.speechSettings")}
                      </button>
                    )}
                  </div>
                ) : (
                  <select
                    value={chosenOwn || (picked.voice && voice === picked.voice.voiceURI) ? voice : ""}
                    onChange={(e) => setVoice(e.target.value)}
                    className={`${ui.input} appearance-none py-2.5`}
                  >
                    <option value="">{t("voice.settings.auto")}</option>
                    {offered.map((v) => (
                      <option key={v.voiceURI} value={v.voiceURI}>
                        {v.name} · {v.lang}
                      </option>
                    ))}
                    {own &&
                      ownReady &&
                      BUILTIN_VOICES[own].speakers.map((s) => (
                        <option key={s.id} value={builtinChoice(own, s.id)}>
                          {s.name[locale]} · {t("voice.builtin.tag")}
                        </option>
                      ))}
                  </select>
                )}
                {voices.length > 0 && picked.standIn && !picked.missing && !ownReady && <p className="text-xs font-medium text-muted">{t("voice.standIn")}</p>}
                {own && <BuiltinDownload lang={own} />}
              </Row>
              <Row label={t("voice.settings.rate")}>
                <Segments<Rate>
                  value={rateOf(rate)}
                  options={(Object.keys(RATES) as Rate[]).map((r) => [r, t(`voice.settings.rate.${r}`)])}
                  onChange={(r) => setRate(r === "normal" ? "" : r)}
                />
              </Row>
              <Row label={t("voice.settings.volume")}>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={Math.round(volumeOf(volume) * 100)}
                    onChange={(e) => setVolume(e.target.value === "100" ? "" : e.target.value)}
                    aria-label={t("voice.settings.volume")}
                    className="h-2 flex-1 cursor-pointer accent-accent"
                  />
                  <span className="w-10 text-right text-xs font-black tabular-nums text-ink">{Math.round(volumeOf(volume) * 100)}%</span>
                </div>
              </Row>
              <Row label={t("voice.settings.speaker")}>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="min-w-0 flex-1 text-xs font-medium leading-relaxed text-muted">{t("voice.settings.speakerNote")}</p>
                  {soundSettings && (
                    <button type="button" onClick={() => void desktopWindow()?.openSoundSettings?.()} className={`${ui.secondary} px-3 py-2 text-xs`}>
                      <Speaker className="h-3.5 w-3.5" />
                      {t("voice.settings.speakerOpen")}
                    </button>
                  )}
                </div>
              </Row>
              <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-ink">
                <input type="checkbox" checked={readTurns === "on"} onChange={(e) => setReadTurns(e.target.checked ? "on" : "")} className="h-4 w-4 accent-current" />
                {t("voice.settings.readTurns")}
              </label>
              {!missing && (
                <button
                  type="button"
                  onClick={() => (speaking === SAMPLE ? stopSpeaking() : speak(SAMPLE, t("voice.settings.sample"), locale))}
                  className={`${ui.secondary} w-fit px-4 py-2.5 text-xs`}
                >
                  {speaking === SAMPLE ? <Square className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  {t(speaking === SAMPLE ? "voice.stop" : "voice.settings.test")}
                </button>
              )}
            </>
          )}
        </>
      )}

      <Row label={t("voice.settings.input")}>
        {engine && <Segments value={onOff(mic !== "off")} options={[["on", t("voice.settings.on")], ["off", t("voice.settings.off")]]} onChange={(v) => setMic(v === "off" ? "off" : "")} />}
        {engine && mic !== "off" && (
          <div className="grid gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={microphones.some((m) => m.deviceId === micDevice) ? micDevice : ""}
                onChange={(e) => setMicDevice(e.target.value)}
                aria-label={t("voice.settings.micDevice")}
                className={`${ui.input} min-w-0 flex-1 appearance-none py-2.5`}
              >
                <option value="">{t("voice.settings.micDefault")}</option>
                {microphones.map((m, i) => (
                  <option key={m.deviceId} value={m.deviceId}>
                    {m.label || t("voice.settings.micN", { n: i + 1 })}
                  </option>
                ))}
              </select>
              {microphones.length > 0 && !named && (
                <button type="button" onClick={() => void revealMicrophones()} className={`${ui.secondary} px-3 py-2 text-xs`}>
                  <Mic className="h-3.5 w-3.5" />
                  {t("voice.settings.micNames")}
                </button>
              )}
            </div>
          </div>
        )}
        <p className="text-xs font-medium leading-relaxed text-muted">
          {engine === "browser"
            ? t("voice.settings.engine.browser", { n: ORDER_CHARS })
            : engine === "local"
              ? t("voice.settings.engine.local", { mb: MODEL_MB, n: ORDER_CHARS })
              : t("voice.settings.engine.none")}
        </p>
        {engine === "local" && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-ink">{t(listener.modelReady ? "voice.settings.model.ready" : "voice.settings.model.none")}</span>
            {listener.modelReady && (
              <button type="button" onClick={() => void deleteModel()} className={`${ui.destructive} px-3 py-2 text-xs`}>
                <Trash2 className="h-3.5 w-3.5" />
                {t("voice.settings.model.delete")}
              </button>
            )}
          </div>
        )}
        {desktop && engine !== null && <p className="text-xs font-medium text-muted">{t("voice.settings.winH")}</p>}
      </Row>
    </div>
  );
}

"use client";

import { Square, Trash2, Volume2 } from "lucide-react";
import { useSyncExternalStore, type ReactNode } from "react";
import { ui } from "@/components/ui/classes";
import { isDesktopApp } from "@/constants/app";
import { useI18n } from "@/i18n/useI18n";
import { usePreference } from "@/lib/preferences";
import { deleteModel, MODEL_MB, useListener, useVoiceEngine } from "@/lib/voice/listener";
import { canSpeak, RATES, rateOf, speak, stopSpeaking, useSpeaker, useVoices, type Rate } from "@/lib/voice/speaker";
import { pickVoice, voicesFor } from "@/lib/voice/text";

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

/** Reading aloud (voice, speed, every new turn) and voice input (on or off, where speech is recognised, the local model). */
export default function VoiceSettings() {
  const { t, locale } = useI18n();
  const [speech, setSpeech] = usePreference("speech");
  const [voice, setVoice] = usePreference("voice");
  const [rate, setRate] = usePreference("rate");
  const [readTurns, setReadTurns] = usePreference("readTurns");
  const [mic, setMic] = usePreference("mic");
  const able = useSyncExternalStore(none, canSpeak, () => false);
  const desktop = useSyncExternalStore(none, isDesktopApp, () => false);
  const voices = useVoices();
  const { speaking } = useSpeaker();
  const engine = useVoiceEngine();
  const listener = useListener();
  const offered = voicesFor(voices, locale);
  const picked = pickVoice(voices, locale, voice || undefined);
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
                {voices.length === 0 ? (
                  <p className="text-xs font-medium text-muted">{t("voice.settings.noVoices")}</p>
                ) : (
                  <select value={picked.voice && voice === picked.voice.voiceURI ? voice : ""} onChange={(e) => setVoice(e.target.value)} className={`${ui.input} appearance-none py-2.5`}>
                    <option value="">{t("voice.settings.auto")}</option>
                    {offered.map((v) => (
                      <option key={v.voiceURI} value={v.voiceURI}>
                        {v.name} · {v.lang}
                      </option>
                    ))}
                  </select>
                )}
                {voices.length > 0 && picked.standIn && <p className="text-xs font-medium text-muted">{t("voice.standIn")}</p>}
              </Row>
              <Row label={t("voice.settings.rate")}>
                <Segments<Rate>
                  value={rateOf(rate)}
                  options={(Object.keys(RATES) as Rate[]).map((r) => [r, t(`voice.settings.rate.${r}`)])}
                  onChange={(r) => setRate(r === "normal" ? "" : r)}
                />
              </Row>
              <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-ink">
                <input type="checkbox" checked={readTurns === "on"} onChange={(e) => setReadTurns(e.target.checked ? "on" : "")} className="h-4 w-4 accent-current" />
                {t("voice.settings.readTurns")}
              </label>
              <button
                type="button"
                onClick={() => (speaking === SAMPLE ? stopSpeaking() : speak(SAMPLE, t("voice.settings.sample"), locale))}
                className={`${ui.secondary} w-fit px-4 py-2.5 text-xs`}
              >
                {speaking === SAMPLE ? <Square className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                {t(speaking === SAMPLE ? "voice.stop" : "voice.settings.test")}
              </button>
            </>
          )}
        </>
      )}

      <Row label={t("voice.settings.input")}>
        {engine && <Segments value={onOff(mic !== "off")} options={[["on", t("voice.settings.on")], ["off", t("voice.settings.off")]]} onChange={(v) => setMic(v === "off" ? "off" : "")} />}
        <p className="text-xs font-medium leading-relaxed text-muted">
          {engine === "browser" ? t("voice.settings.engine.browser") : engine === "local" ? t("voice.settings.engine.local", { mb: MODEL_MB }) : t("voice.settings.engine.none")}
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

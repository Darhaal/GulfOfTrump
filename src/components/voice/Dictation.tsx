"use client";

import { Download, Loader2, Mic } from "lucide-react";
import { useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import Dialog from "@/components/ui/Dialog";
import { ui } from "@/components/ui/classes";
import { useI18n } from "@/i18n/useI18n";
import { usePreference } from "@/lib/preferences";
import { clearVoiceError, downloadModel, MODEL_MB, startListening, stopListening, useListener, useVoiceEngine } from "@/lib/voice/listener";
import { appendDictation } from "@/lib/voice/text";

/**
 * A text field with a microphone in its corner: what the player says is
 * written in after what is typed. Only the field itself where voice input
 * does not work here or is off.
 */
export default function Dictation({ id, set, max, disabled, children }: { id: string; set: Dispatch<SetStateAction<string>>; max?: number; disabled?: boolean; children: ReactNode }) {
  const engine = useVoiceEngine();
  const [mic] = usePreference("mic");
  const shown = engine !== null && mic !== "off";
  return (
    <div className={`relative ${shown ? "[&>textarea]:pr-11" : ""}`}>
      {children}
      {shown && <MicButton id={id} disabled={disabled} onText={(words) => set((value) => appendDictation(value, words, max))} />}
    </div>
  );
}

function MicButton({ id, disabled, onText }: { id: string; disabled?: boolean; onText: (words: string) => void }) {
  const { t, locale } = useI18n();
  const voice = useListener();
  const engine = useVoiceEngine();
  const [asking, setAsking] = useState(false);
  const mine = voice.owner === id;
  const phase = mine ? voice.phase : "idle";
  const pct = Math.min(99, Math.round(voice.progress * 100));
  const error = mine && phase === "idle" ? voice.error : null;

  // A problem stays in view a few seconds, then goes.
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => clearVoiceError(id), 7000);
    return () => clearTimeout(timer);
  }, [error, id]);

  const click = () => {
    if (phase === "listening") return stopListening();
    if (phase !== "idle") return;
    if (engine === "local" && !voice.modelReady) return setAsking(true);
    startListening(id, locale, onText);
  };

  const status =
    phase === "listening"
      ? t("voice.listening")
      : phase === "loading" || (phase === "working" && voice.progress < 1)
        ? t("voice.loading", { pct })
        : phase === "working"
          ? t("voice.working")
          : error
            ? t(error)
            : null;
  const label = t(phase === "listening" ? "voice.micStop" : "voice.mic");

  return (
    <>
      <button
        type="button"
        disabled={disabled || (!mine && voice.phase !== "idle")}
        onClick={click}
        aria-pressed={phase === "listening"}
        aria-label={label}
        title={label}
        className={`absolute bottom-2 right-2 grid h-8 w-8 place-items-center rounded-lg transition-colors disabled:opacity-40 ${
          phase === "listening" ? "animate-pulse bg-war/15 text-war ring-1 ring-war/40" : "text-muted hover:bg-divider hover:text-accent"
        }`}
      >
        {phase === "working" || phase === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
      </button>
      {status && (
        <span role="status" className="pointer-events-none absolute bottom-full right-0 z-10 mb-1.5 w-max max-w-[18rem] rounded-lg bg-ink px-2.5 py-1.5 text-2xs font-bold leading-snug text-on-ink shadow-lg">
          {status}
        </span>
      )}
      {asking && <DownloadDialog id={id} onClose={() => setAsking(false)} />}
    </>
  );
}

/** The one-time download of the local model, asked before anything comes down. */
function DownloadDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useI18n();
  const voice = useListener();
  const loading = voice.owner === id && voice.phase === "loading";
  const failed = voice.owner === id && voice.error === "voice.downloadFailed";
  const pct = Math.min(99, Math.round(voice.progress * 100));

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("voice.download.title")}
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={`${ui.secondary} px-4 py-2.5 text-sm`}>
            {t("voice.download.cancel")}
          </button>
          {!voice.modelReady && (
            <button type="button" disabled={loading} onClick={() => void downloadModel(id)} className={`${ui.primary} px-4 py-2.5 text-sm`}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {t("voice.download.go")}
            </button>
          )}
        </div>
      }
    >
      <p className="text-sm font-medium leading-relaxed text-ink">{t("voice.download.body", { mb: MODEL_MB })}</p>
      {loading && (
        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-page">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1.5 text-xs font-bold tabular-nums text-muted">{t("voice.download.progress", { pct })}</p>
        </div>
      )}
      {voice.modelReady && <p className="mt-4 text-sm font-bold text-ink">{t("voice.download.ready")}</p>}
      {failed && <p className="mt-4 text-sm font-bold text-war">{t("voice.downloadFailed")}</p>}
    </Dialog>
  );
}

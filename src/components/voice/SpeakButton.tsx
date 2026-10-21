"use client";

import { Square, Volume2 } from "lucide-react";
import { useSyncExternalStore } from "react";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import { usePreference } from "@/lib/preferences";
import { canSpeak, speak, stopSpeaking, useSpeaker } from "@/lib/voice/speaker";

const none = () => () => {};

/**
 * A speaker beside a text: reads it aloud, or stops it when it is the one
 * being read. Nothing where the system cannot speak or reading is off.
 */
export default function SpeakButton({ id, text, label = "voice.read", className = "" }: { id: string; text: string | (() => string); label?: MessageKey; className?: string }) {
  const { t, locale } = useI18n();
  const [speech] = usePreference("speech");
  const able = useSyncExternalStore(none, canSpeak, () => false);
  const { speaking } = useSpeaker();
  if (!able || speech === "off") return null;
  const on = speaking === id;
  return (
    <button
      type="button"
      onClick={(e) => {
        // Inside a <summary> or a clickable row, the speaker does not fold or open anything.
        e.preventDefault();
        e.stopPropagation();
        if (on) stopSpeaking();
        else speak(id, typeof text === "function" ? text() : text, locale);
      }}
      aria-pressed={on}
      aria-label={t(on ? "voice.stop" : label)}
      title={t(on ? "voice.stop" : label)}
      className={`inline-grid shrink-0 place-items-center rounded-lg p-1 transition-colors hover:bg-divider ${on ? "text-accent" : "text-muted hover:text-accent"} ${className}`}
    >
      {on ? <Square className="h-3.5 w-3.5 fill-current" /> : <Volume2 className="h-3.5 w-3.5" />}
    </button>
  );
}

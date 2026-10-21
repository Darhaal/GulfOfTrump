"use client";

import { Volume2, X } from "lucide-react";
import { useEffect } from "react";
import { useI18n } from "@/i18n/useI18n";
import { stopListening } from "@/lib/voice/listener";
import { dismissStandIn, stopSpeaking, useSpeaker } from "@/lib/voice/speaker";

/**
 * Voice on the game screen: the one-time note when a language has no voice
 * of its own, and silence when the player leaves the game.
 */
export default function VoiceLayer() {
  const { t } = useI18n();
  const { standIn } = useSpeaker();

  useEffect(
    () => () => {
      stopSpeaking();
      stopListening();
    },
    [],
  );

  useEffect(() => {
    if (!standIn) return;
    const timer = setTimeout(dismissStandIn, 12000);
    return () => clearTimeout(timer);
  }, [standIn]);

  if (!standIn) return null;
  return (
    <div role="status" className="fixed bottom-4 left-1/2 z-50 flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 items-start gap-2.5 rounded-xl border border-line bg-surface p-3 shadow-lg">
      <Volume2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
      <p className="min-w-0 flex-1 text-xs font-medium leading-relaxed text-ink">{t("voice.standIn")}</p>
      <button type="button" onClick={dismissStandIn} aria-label={t("voice.dismiss")} title={t("voice.dismiss")} className="-m-1 rounded-lg p-1 text-muted hover:bg-divider hover:text-ink">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

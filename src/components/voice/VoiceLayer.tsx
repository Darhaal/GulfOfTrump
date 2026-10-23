"use client";

import { Settings2, Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ui } from "@/components/ui/classes";
import { isDesktopApp } from "@/constants/app";
import { useI18n } from "@/i18n/useI18n";
import { desktopWindow } from "@/lib/desktop";
import { isBuiltinLang } from "@/lib/voice/builtin";
import BuiltinDownload from "./BuiltinDownload";
import { stopListening } from "@/lib/voice/listener";
import { dismissMissing, dismissStandIn, stopSpeaking, useSpeaker } from "@/lib/voice/speaker";

const none = () => () => {};

/** Over everything, the turn's report and other dialogs included (the button that read is often in one), at the top, out of the way of their buttons. */
const onTop = (note: ReactNode) => createPortal(note, document.body);

/**
 * Voice on the game screen: why nothing was read when no voice reads the
 * language (and how to add one, or the game's own voice for Russian and
 * Ukrainian to download right there), the one-time note when another language's
 * voice stands in, and silence when the player leaves the game.
 */
export default function VoiceLayer() {
  const { t } = useI18n();
  const { standIn, missing } = useSpeaker();
  const desktop = useSyncExternalStore(none, isDesktopApp, () => false);
  const speechSettings = useSyncExternalStore(none, () => Boolean(desktopWindow()?.openSpeechSettings), () => false);

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

  if (missing)
    return onTop(
      <div role="alert" className="fixed left-1/2 top-4 z-[60] flex w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 items-start gap-2.5 rounded-xl border border-line sheet p-3 shadow-lg">
        <VolumeX className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        <div className="grid min-w-0 flex-1 gap-2">
          <p className="text-xs font-medium leading-relaxed text-ink">
            {t("voice.missing")}
            {!desktop && ` ${t("voice.missingBrowser")}`}
          </p>
          <div className="flex flex-wrap items-start gap-2">
            {isBuiltinLang(missing) && <BuiltinDownload lang={missing} compact />}
            {speechSettings && (
              <button type="button" onClick={() => void desktopWindow()?.openSpeechSettings?.()} className={`${ui.secondary} w-fit px-3 py-2 text-xs`}>
                <Settings2 className="h-3.5 w-3.5" />
                {t("voice.speechSettings")}
              </button>
            )}
          </div>
        </div>
        <button type="button" onClick={dismissMissing} aria-label={t("voice.dismiss")} title={t("voice.dismiss")} className="-m-1 rounded-lg p-1 text-muted hover:bg-divider hover:text-ink">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>,
    );
  if (!standIn) return null;
  return onTop(
    <div role="status" className="fixed left-1/2 top-4 z-[60] flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 items-start gap-2.5 rounded-xl border border-line sheet p-3 shadow-lg">
      <Volume2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
      <p className="min-w-0 flex-1 text-xs font-medium leading-relaxed text-ink">{t("voice.standIn")}</p>
      <button type="button" onClick={dismissStandIn} aria-label={t("voice.dismiss")} title={t("voice.dismiss")} className="-m-1 rounded-lg p-1 text-muted hover:bg-divider hover:text-ink">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>,
  );
}

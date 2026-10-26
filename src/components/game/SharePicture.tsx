"use client";

import { Check, Copy, Download, Loader2, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Dialog from "@/components/ui/Dialog";
import { ui } from "@/components/ui/classes";
import { changedRegions } from "@/components/map/overlays";
import { canvasPng, drawTurnPicture, homeLand, pageFont, preparedMap } from "@/components/map/picture";
import { APP_NAME } from "@/constants/app";
import { formatDate } from "@/engine/calendar";
import { regionsAfter } from "@/engine/history";
import { scenarioOf } from "@/engine/scenarios";
import type { ChronicleEntry, GameState } from "@/engine/types";
import { useI18n } from "@/i18n/useI18n";
import { downloadBlob } from "@/lib/exports";
import type { RegionTopology } from "@/lib/maps";

const canCopy = () => typeof ClipboardItem !== "undefined" && Boolean(navigator.clipboard?.write);

/**
 * A turn as a picture to share: the map as the turn left it, centred on
 * what changed, with the headline under it. Drawn in the browser; saved,
 * copied or handed to the system's share sheet from here.
 */
export default function SharePicture({ state, entry, topology, onClose }: { state: GameState; entry: ChronicleEntry; topology: RegionTopology; onClose: () => void }) {
  const { t, text, locale } = useI18n();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [png, setPng] = useState<{ blob: Blob; file: File; shareable: boolean } | null>(null);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileName = `gulf-of-trump-${state.scenarioId}-${state.player}-turn-${entry.turn}.png`;

  useEffect(() => {
    let alive = true;
    (async () => {
      // Let the dialog appear before the map is projected, and the page's font load before text is drawn on it.
      await new Promise((resolve) => setTimeout(resolve, 30));
      await document.fonts?.ready;
      const el = canvas.current;
      if (!alive || !el) return;
      const map = preparedMap(topology);
      const regions = regionsAfter(state, entry.turn);
      const changed = changedRegions(entry.applied).filter((id) => regions[id]);
      const scenario = scenarioOf(state);
      drawTurnPicture(el, map, {
        regions,
        color: (tag) => state.countries[tag]?.color,
        name: (tag) => text(state.countries[tag]?.name ?? tag),
        player: state.player,
        changes: entry.applied,
        focus: changed.length ? changed : homeLand(map, regions, state.player),
        font: pageFont(),
        caption: {
          kicker: `${t("game.turn", { n: entry.turn })} · ${t("game.period", { from: formatDate(entry.from, locale), to: formatDate(entry.to, locale) })}`,
          headline: entry.headline,
          footer: `${text(state.countries[state.player]?.name ?? state.player)} · ${text(scenario.title)}`,
          brand: APP_NAME,
        },
      });
      const blob = await canvasPng(el);
      const file = new File([blob], fileName, { type: "image/png" });
      const shareable = typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
      if (alive) setPng({ blob, file, shareable });
    })().catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [state, entry, topology, t, text, locale, fileName]);

  const copy = async () => {
    if (!png) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": png.blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setFailed(true);
    }
  };

  const share = async () => {
    if (!png) return;
    try {
      await navigator.share({ files: [png.file], title: entry.headline });
    } catch {
      // The sheet was closed, or the system refused: the picture can still be saved.
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      wide
      title={t("share.title")}
      footer={
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" disabled={!png} onClick={() => png && downloadBlob(fileName, png.blob)} className={`${ui.primary} w-full py-3 text-sm`}>
            <Download className="h-4 w-4" />
            {t("share.download")}
          </button>
          {canCopy() && (
            <button type="button" disabled={!png} onClick={copy} className={`${ui.secondary} w-full py-3 text-sm`}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? t("share.copied") : t("share.copy")}
            </button>
          )}
          {png?.shareable && (
            <button type="button" onClick={share} className={`${ui.secondary} w-full py-3 text-sm`}>
              <Share2 className="h-4 w-4" />
              {t("share.send")}
            </button>
          )}
        </div>
      }
    >
      <div className="relative">
        <canvas ref={canvas} width={1600} height={900} className="block aspect-video h-auto w-full rounded-xl border border-line bg-sea" />
        {!png && !failed && (
          <div className="absolute inset-0 grid place-items-center">
            <span className="inline-flex items-center gap-2 rounded-xl bg-surface/90 px-3 py-2 text-xs font-bold text-muted">
              <Loader2 className="h-4 w-4 animate-spin text-accent" />
              {t("share.making")}
            </span>
          </div>
        )}
      </div>
      {failed ? <p className="mt-3 text-xs font-bold text-red-600">{t("share.failed")}</p> : <p className="mt-3 text-xs font-medium text-muted">{t("share.note")}</p>}
    </Dialog>
  );
}

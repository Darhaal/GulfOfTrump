"use client";

import { Download, Loader2, Pause, Play, Square } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import Dialog from "@/components/ui/Dialog";
import { ui } from "@/components/ui/classes";
import { changedRegions } from "@/components/map/overlays";
import { drawFrame, focusView, homeLand, pageFont, preparedMap, type PreparedMap, type View } from "@/components/map/picture";
import { APP_NAME } from "@/constants/app";
import { formatDate } from "@/engine/calendar";
import { mapFrames } from "@/engine/history";
import { scenarioOf } from "@/engine/scenarios";
import type { GameState } from "@/engine/types";
import { useI18n } from "@/i18n/useI18n";
import { downloadBlob } from "@/lib/exports";
import type { RegionTopology } from "@/lib/maps";
import { playFrames, recordCanvas, videoType } from "@/lib/video";

type Speed = "slow" | "normal" | "fast";
/** How long each turn stays on screen, ms. */
const HOLD: Record<Speed, number> = { slow: 2200, normal: 1300, fast: 650 };

/**
 * The whole game on one map, turn after turn: who held what at the start and
 * after every turn, each turn's moves and headline. Watched here, or saved
 * as a video the browser records.
 */
export default function Timelapse({ state, topology, onClose }: { state: GameState; topology: RegionTopology; onClose: () => void }) {
  const { t, text, locale } = useI18n();
  const canvas = useRef<HTMLCanvasElement>(null);
  const frames = useMemo(() => mapFrames(state), [state]);
  const [setup, setSetup] = useState<{ map: PreparedMap; view: View; font: string } | null>(null);
  const [index, setIndex] = useState(0);
  const [speed, setSpeed] = useState<Speed>("normal");
  const [running, setRunning] = useState<{ kind: "play" | "record"; controller: AbortController } | null>(null);
  const [failed, setFailed] = useState(false);
  const video = useMemo(() => videoType(), []);
  const scenario = scenarioOf(state);
  // Turns from before borders were kept are drawn from their list of changes.
  const approximate = state.chronicle.some((e) => !e.borders && changedRegions(e.applied).length > 0);

  // The map is projected once, and the camera set on everything that changed hands in the game.
  useEffect(() => {
    let alive = true;
    (async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      await document.fonts?.ready;
      if (!alive) return;
      const map = preparedMap(topology);
      const moved = new Set(frames.flatMap((f) => (f.entry ? changedRegions(f.entry.applied) : [])));
      for (const id of homeLand(map, frames[0].regions, state.player)) moved.add(id);
      setSetup({ map, view: focusView(map, moved, { x: 0, y: 0, w: map.width, h: map.height }, 6), font: pageFont() });
    })();
    return () => {
      alive = false;
    };
  }, [topology, frames, state.player]);

  const render = (i: number, into: HTMLCanvasElement) => {
    if (!setup) return;
    const { map, view, font } = setup;
    into.width = map.width;
    into.height = map.height;
    const ctx = into.getContext("2d");
    if (!ctx) return;
    const f = frames[i];
    drawFrame(
      ctx,
      map,
      {
        regions: f.regions,
        color: (tag) => state.countries[tag]?.color,
        name: (tag) => text(state.countries[tag]?.name ?? tag),
        view,
        player: state.player,
        changes: f.entry?.applied,
        font,
      },
      {
        date: formatDate(f.date, locale),
        kicker: f.turn ? t("game.turn", { n: f.turn }) : t("timelapse.start"),
        headline: f.headline ?? text(scenario.title),
        brand: APP_NAME,
        progress: frames.length > 1 ? i / (frames.length - 1) : 1,
      },
    );
  };

  // Still frames: drawn whenever the picked turn changes and nothing is playing.
  useEffect(() => {
    if (!setup || running || !canvas.current) return;
    render(index, canvas.current);
    // render reads the current setup and frames; these are what change the picture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup, index, running, frames, locale]);

  // Stop whatever runs when the dialog closes.
  useEffect(() => () => running?.controller.abort(), [running]);

  const play = async () => {
    if (!setup || !canvas.current || running) return;
    const controller = new AbortController();
    const start = index >= frames.length - 1 ? 0 : index;
    setRunning({ kind: "play", controller });
    await playFrames(canvas.current, start, { count: frames.length, render, hold: HOLD[speed], first: 350, signal: controller.signal, onFrame: setIndex });
    setRunning(null);
  };

  const record = async () => {
    if (!setup || !canvas.current || running || !video) return;
    const controller = new AbortController();
    const el = canvas.current;
    setRunning({ kind: "record", controller });
    setFailed(false);
    const blob = await recordCanvas(
      el,
      video,
      () => playFrames(el, 0, { count: frames.length, render, hold: HOLD[speed], last: HOLD[speed] * 2.5, signal: controller.signal, onFrame: setIndex }),
      controller.signal,
    ).catch(() => undefined);
    setRunning(null);
    // Null is a stop asked for; undefined, a browser that would not record after all.
    if (blob === undefined) setFailed(true);
    else if (blob) downloadBlob(`gulf-of-trump-${state.scenarioId}-${state.player}-timelapse.${video.ext}`, blob);
  };

  const stop = () => running?.controller.abort();
  const speeds: Speed[] = ["slow", "normal", "fast"];

  return (
    <Dialog
      open
      onClose={() => {
        stop();
        onClose();
      }}
      huge
      title={t("timelapse.title")}
      footer={
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={!setup || running?.kind === "record"}
              onClick={running?.kind === "play" ? stop : play}
              className={`${ui.iconButton} shrink-0`}
              aria-label={running?.kind === "play" ? t("timelapse.pause") : t("timelapse.play")}
              title={running?.kind === "play" ? t("timelapse.pause") : t("timelapse.play")}
            >
              {running?.kind === "play" ? <Pause className="h-4 w-4 text-ink" /> : <Play className="h-4 w-4 text-ink" />}
            </button>
            <input
              type="range"
              min={0}
              max={frames.length - 1}
              value={index}
              disabled={!setup || Boolean(running)}
              onChange={(e) => setIndex(Number(e.target.value))}
              className="w-full accent-accent"
              aria-label={t("timelapse.title")}
            />
            <span className="shrink-0 text-xs font-bold tabular-nums text-muted">
              {index}/{frames.length - 1}
            </span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex gap-1 rounded-xl border border-line p-1">
              {speeds.map((s) => (
                <button key={s} type="button" disabled={Boolean(running)} onClick={() => setSpeed(s)} className={`${ui.segment} ${speed === s ? ui.segmentOn : ui.segmentOff}`}>
                  {t(`timelapse.speed.${s}`)}
                </button>
              ))}
            </div>
            <div className="flex-1" />
            {video &&
              (running?.kind === "record" ? (
                <button type="button" onClick={stop} className={`${ui.secondary} px-4 py-3 text-sm`}>
                  <Square className="h-4 w-4" />
                  {t("timelapse.stop")}
                </button>
              ) : (
                <button type="button" disabled={!setup || Boolean(running)} onClick={record} className={`${ui.primary} px-4 py-3 text-sm`}>
                  <Download className="h-4 w-4" />
                  {t("timelapse.record")}
                </button>
              ))}
          </div>
        </div>
      }
    >
      <div className="relative">
        <canvas ref={canvas} width={1600} height={900} className="block aspect-video h-auto w-full rounded-xl border border-line bg-sea" />
        {!setup && (
          <div className="absolute inset-0 grid place-items-center">
            <Loader2 className="h-6 w-6 animate-spin text-accent" />
          </div>
        )}
      </div>
      <div className="mt-3 grid gap-1 text-xs font-medium text-muted">
        {running?.kind === "record" && <p className="font-bold text-accent">{t("timelapse.recording", { n: index + 1, total: frames.length })}</p>}
        {failed && <p className="font-bold text-red-600">{t("timelapse.failed")}</p>}
        {!video && <p>{t("timelapse.noVideo")}</p>}
        {approximate && <p>{t("timelapse.approx")}</p>}
      </div>
    </Dialog>
  );
}

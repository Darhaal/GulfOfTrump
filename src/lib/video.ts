"use client";

/**
 * Frames played on a canvas, one turn after another with a short fade, and
 * the same recorded to a video file by the browser itself (MediaRecorder):
 * nothing is uploaded and no encoder is bundled. Recording runs in real
 * time, so a tab sent to the background slows it down.
 */

/**
 * What the browser can record, best for sharing first: H.264 in MP4 plays
 * everywhere; then WebM; then whatever MP4 is offered (Safari records only
 * MP4, and a Chromium without H.264 would put VP9 in it).
 */
export function videoType(): { mime: string; ext: "mp4" | "webm" } | null {
  if (typeof MediaRecorder === "undefined" || typeof HTMLCanvasElement === "undefined" || !("captureStream" in HTMLCanvasElement.prototype)) return null;
  for (const mime of ["video/mp4;codecs=avc1.42E01F", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"]) {
    if (MediaRecorder.isTypeSupported(mime)) return { mime, ext: mime.startsWith("video/mp4") ? "mp4" : "webm" };
  }
  return null;
}

export interface Playback {
  /** How many frames there are. */
  count: number;
  /** Draws frame i on a canvas of its own. */
  render: (i: number, into: HTMLCanvasElement) => void;
  /** How long each frame stays, fade included, ms. */
  hold: number;
  /** How long the first frame stays before the next fades in, ms; the same as the others when missing. */
  first?: number;
  /** How long the last frame stays, ms; the same as the others when missing. */
  last?: number;
  signal: AbortSignal;
  /** Called as each frame becomes the one on screen. */
  onFrame?: (i: number) => void;
}

/**
 * Plays frames from `start` to the end on the canvas, each fading in over
 * the one before. The canvas is repainted on every animation frame, holds
 * included, so a recording keeps receiving frames. Resolves at the end or
 * when the signal aborts.
 */
export async function playFrames(canvas: HTMLCanvasElement, start: number, p: Playback): Promise<void> {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  let shown = document.createElement("canvas");
  let next = document.createElement("canvas");
  p.render(start, shown);
  ctx.drawImage(shown, 0, 0);
  p.onFrame?.(start);
  const hold = (ms: number, paint: (elapsed: number) => void) =>
    new Promise<void>((resolve) => {
      const t0 = performance.now();
      const tick = () => {
        const elapsed = performance.now() - t0;
        paint(elapsed);
        if (p.signal.aborted || elapsed >= ms) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  await hold(p.first ?? p.hold, () => ctx.drawImage(shown, 0, 0));
  for (let i = start + 1; i < p.count && !p.signal.aborted; i += 1) {
    p.render(i, next);
    const fade = Math.min(450, p.hold * 0.35);
    const from = shown;
    const to = next;
    p.onFrame?.(i);
    await hold(i === p.count - 1 ? (p.last ?? p.hold) : p.hold, (elapsed) => {
      ctx.globalAlpha = 1;
      ctx.drawImage(from, 0, 0);
      ctx.globalAlpha = Math.min(1, elapsed / fade);
      ctx.drawImage(to, 0, 0);
      ctx.globalAlpha = 1;
    });
    [shown, next] = [next, shown];
  }
}

/** Records whatever `run` plays on the canvas; resolves to the video, or null when the signal aborted. Throws when the browser records nothing. */
export async function recordCanvas(canvas: HTMLCanvasElement, type: { mime: string }, run: () => Promise<void>, signal: AbortSignal): Promise<Blob | null> {
  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, { mimeType: type.mime, videoBitsPerSecond: 8_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });
  recorder.start(1000);
  try {
    await run();
  } finally {
    recorder.stop();
    await stopped;
    for (const track of stream.getTracks()) track.stop();
  }
  if (signal.aborted) return null;
  if (!chunks.length) throw new Error("The browser recorded nothing.");
  return new Blob(chunks, { type: type.mime.split(";")[0] });
}

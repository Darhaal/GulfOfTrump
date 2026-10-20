import { geoNaturalEarth1, geoPath, type GeoPath } from "d3-geo";
import { feature, mesh, neighbors as topoNeighbors } from "topojson-client";
import type { FeatureCollection, MultiLineString, MultiPolygon, Polygon } from "geojson";
import type { GeometryObject } from "topojson-specification";
import type { AppliedChange, MapRegion, RegionState } from "@/engine/types";
import type { RegionTopology } from "@/lib/maps";
import { softened } from "./colors";
import { arrowPath, countryLabels, turnMoves } from "./overlays";

/**
 * The map drawn on a canvas, for pictures and videos a player shares: the
 * political map of one moment with a turn's changes and arrows, the same
 * way the game draws them. It always uses the light theme's colours, so a
 * picture looks the same whoever made it.
 */

type Point = [number, number];

/** Picture size in pixels: 16:9, sharp in a feed and on a laptop screen. */
export const PICTURE_W = 1600;
export const PICTURE_H = 900;

const SEA = "#DCE6EC";
const NO_LAND = "#E6E1DC";
const MAP_LINE = "#2B2F36";
const MAP_TEXT = "#3d434c";
const INK = "#1A1F26";
const MUTED = "#6b717a";
const ACCENT = "#9e1316";
const PAPER = "#FFFFFF";
const HALO = "rgba(255, 255, 255, 0.85)";
const GLOW = "rgba(255, 255, 255, 0.6)";

/** Province borders appear from this zoom, as on the game's map. */
const PROVINCES_FROM = 2.6;
const MAX_ZOOM = 8;

export interface View {
  k: number;
  x: number;
  y: number;
}

/** A map ready to draw: every province as a canvas path, in a box of the picture's size. */
export interface PreparedMap {
  topology: RegionTopology;
  width: number;
  height: number;
  path: GeoPath;
  shapes: Map<string, Path2D>;
  bounds: Map<string, [Point, Point]>;
  centres: Map<string, Point>;
  adjacency: { list: number[][]; byId: Map<string, string[]> };
}

const idOf = (g: GeometryObject) => ((g as GeometryObject<MapRegion>).properties as MapRegion).id;

const prepared = new WeakMap<RegionTopology, PreparedMap>();

/** A map prepared once per page, at the picture's size. */
export function preparedMap(topology: RegionTopology): PreparedMap {
  let map = prepared.get(topology);
  if (!map) prepared.set(topology, (map = prepareMap(topology)));
  return map;
}

/** Projects the provinces once; every frame then only fills them. */
export function prepareMap(topology: RegionTopology, width = PICTURE_W, height = PICTURE_H): PreparedMap {
  const collection = feature(topology, topology.objects.regions) as unknown as FeatureCollection<Polygon | MultiPolygon, MapRegion>;
  const projection = geoNaturalEarth1().fitExtent(
    [
      [8, 8],
      [width - 8, height - 8],
    ],
    collection,
  );
  const path = geoPath(projection);
  const shapes = new Map<string, Path2D>();
  const bounds = new Map<string, [Point, Point]>();
  const centres = new Map<string, Point>();
  for (const f of collection.features) {
    const d = path(f);
    if (!d) continue;
    shapes.set(f.properties.id, new Path2D(d));
    bounds.set(f.properties.id, path.bounds(f) as [Point, Point]);
    centres.set(f.properties.id, path.centroid(f) as Point);
  }
  const geoms = topology.objects.regions.geometries as GeometryObject[];
  const list = topoNeighbors(geoms as never) as number[][];
  const byId = new Map<string, string[]>();
  list.forEach((ns, i) => byId.set(idOf(geoms[i]), ns.map((j) => idOf(geoms[j]))));
  return { topology, width, height, path, shapes, bounds, centres, adjacency: { list, byId } };
}

/** Keeps the world filling the picture: no empty margin past its edges. */
function clampView(map: PreparedMap, { k, x, y }: View): View {
  const kk = Math.min(MAX_ZOOM, Math.max(1, k));
  return { k: kk, x: Math.min(0, Math.max(map.width * (1 - kk), x)), y: Math.min(0, Math.max(map.height * (1 - kk), y)) };
}

/**
 * A view that brings these provinces into the box (the part of the picture
 * left free of text), with room around them. A province across the date
 * line spans the whole map and is left out, as on the game's map.
 */
export function focusView(map: PreparedMap, ids: Iterable<string>, box: { x: number; y: number; w: number; h: number }, maxZoom = MAX_ZOOM): View {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const id of ids) {
    const b = map.bounds.get(id);
    if (!b) continue;
    const [[a, c], [e, f]] = b;
    if (e - a > map.width / 2) continue;
    [x0, y0, x1, y1] = [Math.min(x0, a), Math.min(y0, c), Math.max(x1, e), Math.max(y1, f)];
  }
  if (!Number.isFinite(x0)) return { k: 1, x: 0, y: 0 };
  const k = Math.min(maxZoom, Math.max(1, Math.min(box.w / ((x1 - x0) * 1.5 || 1), box.h / ((y1 - y0) * 1.5 || 1))));
  return clampView(map, { k, x: box.x + box.w / 2 - ((x0 + x1) / 2) * k, y: box.y + box.h / 2 - ((y0 + y1) / 2) * k });
}

/** The land of a country the game would centre on: its biggest stretch, not its far islands. */
export function homeLand(map: PreparedMap, regions: Record<string, RegionState>, tag: string): string[] {
  return countryLabels(map.topology, map.adjacency.list, regions, map.path).find((l) => l.tag === tag)?.core ?? [];
}

export interface MapDrawing {
  regions: Record<string, RegionState>;
  /** A country's colour on the map, if it has one. */
  color: (tag: string) => string | undefined;
  /** A country's name in the picture's language. */
  name: (tag: string) => string;
  view: View;
  player?: string;
  /** A turn's changes, highlighted with their arrows. */
  changes?: AppliedChange[];
  /** The page's font stack. */
  font: string;
  /** Screen boxes the country names keep out of: where text is laid over the map. */
  avoid?: Box[];
}

type Box = [number, number, number, number];
const overlaps = (a: Box, b: Box) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];

/** Stripes for a fill, kept thin on screen at any zoom. */
function stripes(ctx: CanvasRenderingContext2D, color: string, width: number, angle: number, k: number): CanvasPattern | null {
  const tile = document.createElement("canvas");
  tile.width = 6;
  tile.height = 6;
  const t = tile.getContext("2d");
  if (!t) return null;
  t.strokeStyle = color;
  t.lineWidth = width;
  t.beginPath();
  t.moveTo(3, 0);
  t.lineTo(3, 6);
  t.stroke();
  const pattern = ctx.createPattern(tile, "repeat");
  pattern?.setTransform(new DOMMatrix().rotate(angle).scale(1 / k));
  return pattern;
}

/** Letter spacing on a canvas, where the browser has it; plain text elsewhere. */
function spacing(ctx: CanvasRenderingContext2D, px: number) {
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${px}px`;
}

/** Paths that share a style joined into one, so a frame fills a few dozen paths rather than thousands. */
function grouped(map: PreparedMap, ids: [string, string][]): Map<string, Path2D> {
  const out = new Map<string, Path2D>();
  for (const [id, key] of ids) {
    const shape = map.shapes.get(id);
    if (!shape) continue;
    let p = out.get(key);
    if (!p) out.set(key, (p = new Path2D()));
    p.addPath(shape);
  }
  return out;
}

/** The political map of a moment: holders' colours, occupation hatched, fronts striped, borders, names and a turn's moves. */
export function drawMap(ctx: CanvasRenderingContext2D, map: PreparedMap, d: MapDrawing) {
  const { regions, view } = d;
  const { k, x, y } = view;
  ctx.save();
  ctx.fillStyle = SEA;
  ctx.fillRect(0, 0, map.width, map.height);
  ctx.setTransform(k, 0, 0, k, x, y);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  const fill = (id: string): string => {
    const holder = regions[id]?.controller;
    const color = holder ? d.color(holder) : undefined;
    return color ? softened(color) : NO_LAND;
  };
  const ids = [...map.shapes.keys()];
  for (const [color, p] of grouped(map, ids.map((id) => [id, fill(id)]))) {
    ctx.fillStyle = color;
    ctx.fill(p);
    // The same colour around the edge closes the hairline gaps between neighbours.
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.6 / k;
    ctx.stroke(p);
  }

  // Occupied land is hatched; a front through a province is striped in the colour of the side holding part of it.
  const occupied = ids.filter((id) => regions[id] && regions[id].controller !== regions[id].owner);
  const hatch = stripes(ctx, "rgba(20,20,20,0.22)", 0.9, 45, k);
  if (hatch && occupied.length) {
    ctx.fillStyle = hatch;
    for (const p of grouped(map, occupied.map((id) => [id, ""])).values()) ctx.fill(p);
  }
  const contested = ids.filter((id) => regions[id]?.contested).map((id): [string, string] => [id, `${regions[id].contested}|${Math.min(4, Math.max(1, Math.round((regions[id].held ?? 30) / 25)))}`]);
  for (const [key, p] of grouped(map, contested)) {
    const [tag, band] = key.split("|");
    const pattern = stripes(ctx, d.color(tag) ?? "rgba(20,20,20,0.5)", (Number(band) / 4) * 5.4, -45, k);
    if (!pattern) continue;
    ctx.fillStyle = pattern;
    ctx.fill(p);
  }

  const obj = map.topology.objects.regions;
  const holder = (g: GeometryObject) => regions[idOf(g)]?.controller;
  if (k >= PROVINCES_FROM) {
    ctx.strokeStyle = MAP_LINE;
    ctx.globalAlpha = k > 4 ? 0.3 : 0.16;
    ctx.lineWidth = 0.5 / k;
    ctx.stroke(new Path2D(map.path(mesh(map.topology, obj, (a, b) => a !== b && holder(a) === holder(b)) as MultiLineString) ?? ""));
    ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = MAP_LINE;
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 1 / k;
  ctx.stroke(new Path2D(map.path(mesh(map.topology, obj, (a, b) => a === b || holder(a) !== holder(b)) as MultiLineString) ?? ""));
  ctx.globalAlpha = 1;

  // The turn's changes: a light then a dark outline, so they show on land of any colour; then the arrows.
  if (d.changes?.length) {
    const { changed, moves } = turnMoves(d.changes, regions, (id) => map.centres.get(id), (id) => map.adjacency.byId.get(id) ?? []);
    for (const [id, c] of changed) {
      const shape = map.shapes.get(id);
      if (!shape) continue;
      const soft = c.kind === "push" || c.kind === "hold";
      ctx.fillStyle = d.color(c.by) ?? INK;
      ctx.globalAlpha = soft ? 0.18 : 0.32;
      ctx.fill(shape);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = GLOW;
      ctx.lineWidth = 4 / k;
      ctx.setLineDash([]);
      ctx.stroke(shape);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.8 / k;
      ctx.setLineDash(soft ? [5 / k, 3 / k] : []);
      ctx.stroke(shape);
    }
    ctx.setLineDash([]);
    for (const m of moves) {
      const head = (10 + Math.min(m.count, 6)) * 1.4 / k;
      const { line, tip } = arrowPath(m.to, m.from, head);
      const color = d.color(m.by) ?? INK;
      const width = (3 + Math.min(m.count, 6) * 0.4) * 1.4;
      const curve = new Path2D(line);
      ctx.strokeStyle = INK;
      ctx.globalAlpha = 0.75;
      ctx.lineWidth = (width + 2.4) / k;
      ctx.stroke(curve);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = color;
      ctx.lineWidth = width / k;
      ctx.setLineDash(m.kind === "push" || m.sea ? [7 / k, 4 / k] : []);
      ctx.stroke(curve);
      ctx.setLineDash([]);
      const head2 = new Path2D(tip);
      ctx.fillStyle = color;
      ctx.fill(head2);
      ctx.strokeStyle = INK;
      ctx.globalAlpha = 0.75;
      ctx.lineWidth = 1.4 / k;
      ctx.stroke(head2);
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();

  drawNames(ctx, map, d);
}

/** One name per holder on its home land, largest first, where it fits and does not cover another. */
function drawNames(ctx: CanvasRenderingContext2D, map: PreparedMap, d: MapDrawing) {
  const { k, x, y } = d.view;
  // The game's map is 1000 units wide; names follow its sizes, scaled to the picture.
  const unit = map.width / 1000;
  const labels = countryLabels(map.topology, map.adjacency.list, d.regions, map.path).sort((a, b) => b.size - a.size);
  const taken: Box[] = [...(d.avoid ?? [])];
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  for (const l of labels) {
    if ((l.size / unit) * k < 34) continue;
    const px = Math.min(15, Math.max(4, l.size / unit / 7)) * Math.sqrt(k) * unit;
    const sx = l.x * k + x;
    const sy = l.y * k + y;
    if (sx < 0 || sx > map.width || sy < 0 || sy > map.height) continue;
    const name = d.name(l.tag).toUpperCase();
    ctx.font = `600 ${px}px ${d.font}`;
    spacing(ctx, px / 10);
    const half = ctx.measureText(name).width / 2;
    const box: Box = [sx - half, sy - px * 0.6, sx + half, sy + px * 0.6];
    // A name cut by the edge of the picture reads worse than none.
    if (box[0] < 0 || box[2] > map.width || box[1] < 0 || box[3] > map.height) continue;
    if (taken.some((b) => overlaps(b, box))) continue;
    taken.push(box);
    ctx.strokeStyle = HALO;
    ctx.lineWidth = px / 4;
    ctx.strokeText(name, sx, sy);
    ctx.fillStyle = MAP_TEXT;
    ctx.globalAlpha = l.tag === d.player ? 0.9 : 0.7;
    ctx.fillText(name, sx, sy);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/** Text broken into lines that fit a width. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > width) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** Lines cut to a count, the last one ending in an ellipsis when text was cut. */
function clampLines(ctx: CanvasRenderingContext2D, lines: string[], max: number, width: number): string[] {
  if (lines.length <= max) return lines;
  const kept = lines.slice(0, max);
  let last = kept[max - 1];
  while (last && ctx.measureText(`${last}…`).width > width) last = last.replace(/\s*\S+$/, "");
  kept[max - 1] = `${last}…`;
  return kept;
}

export interface Caption {
  /** Small capitals over the headline: the turn and its dates. */
  kicker: string;
  headline: string;
  /** The line under it: the country played. */
  footer: string;
  /** The game's name, in the corner. */
  brand: string;
}

/** The text band under a picture: how tall it will be, then drawn. */
function captionBand(ctx: CanvasRenderingContext2D, caption: Caption, font: string, width: number) {
  const pad = 56;
  const inner = width - pad * 2;
  let size = 58;
  let lines: string[] = [];
  for (; size >= 34; size -= 4) {
    ctx.font = `900 ${size}px ${font}`;
    lines = wrap(ctx, caption.headline, inner);
    if (lines.length <= 3) break;
  }
  ctx.font = `900 ${size}px ${font}`;
  lines = clampLines(ctx, lines, 3, inner);
  const lead = size * 1.12;
  const height = pad * 0.8 + 26 + 16 + lines.length * lead + 18 + 26 + pad * 0.7;
  return { pad, size, lines, lead, height };
}

function drawCaption(ctx: CanvasRenderingContext2D, caption: Caption, font: string, width: number, height: number) {
  const band = captionBand(ctx, caption, font, width);
  const top = height - band.height;
  ctx.save();
  ctx.fillStyle = PAPER;
  ctx.globalAlpha = 0.95;
  ctx.fillRect(0, top, width, band.height);
  ctx.globalAlpha = 1;
  ctx.fillStyle = ACCENT;
  ctx.fillRect(0, top, width, 6);
  ctx.textBaseline = "top";
  let at = top + band.pad * 0.8;
  ctx.fillStyle = MUTED;
  ctx.font = `900 22px ${font}`;
  spacing(ctx, 3);
  ctx.fillText(caption.kicker.toUpperCase(), band.pad, at);
  spacing(ctx, 0);
  at += 26 + 16;
  ctx.fillStyle = INK;
  ctx.font = `900 ${band.size}px ${font}`;
  for (const line of band.lines) {
    ctx.fillText(line, band.pad, at);
    at += band.lead;
  }
  at += 18;
  ctx.font = `700 24px ${font}`;
  ctx.fillStyle = INK;
  ctx.fillText(caption.footer, band.pad, at);
  ctx.textAlign = "right";
  ctx.fillStyle = ACCENT;
  ctx.font = `900 24px ${font}`;
  spacing(ctx, 2);
  ctx.fillText(caption.brand.toUpperCase(), width - band.pad, at);
  ctx.restore();
  return band.height;
}

export interface TurnPicture extends Omit<MapDrawing, "view"> {
  caption: Caption;
  /** Provinces to bring into view: the turn's changes, or the player's land. */
  focus: string[];
}

/** A turn as a picture: the map of its end around what changed, and its headline below. */
export function drawTurnPicture(canvas: HTMLCanvasElement, map: PreparedMap, p: TurnPicture) {
  canvas.width = map.width;
  canvas.height = map.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const band = captionBand(ctx, p.caption, p.font, map.width).height;
  const view = focusView(map, p.focus, { x: 0, y: 0, w: map.width, h: map.height - band });
  drawMap(ctx, map, { ...p, view, avoid: [[0, map.height - band, map.width, map.height]] });
  drawCaption(ctx, p.caption, p.font, map.width, map.height);
}

export interface TimelapseCard {
  /** The date, large. */
  date: string;
  /** The turn, small, over it. */
  kicker: string;
  headline?: string;
  brand: string;
  /** How far through the game, 0–1. */
  progress: number;
}

/** Where a timelapse card sits and the headline's lines in it. */
function cardLayout(ctx: CanvasRenderingContext2D, card: TimelapseCard, font: string, width: number) {
  const pad = 28;
  const w = Math.min(620, width * 0.42);
  ctx.save();
  ctx.font = `800 26px ${font}`;
  const lines = card.headline ? clampLines(ctx, wrap(ctx, card.headline, w - pad * 2), 3, w - pad * 2) : [];
  ctx.restore();
  const h = pad + 22 + 8 + 54 + (lines.length ? 14 + lines.length * 32 : 0) + pad;
  return { pad, w, h, lines };
}

/** A timelapse frame: the map of a moment with its card, the names kept clear of it. */
export function drawFrame(ctx: CanvasRenderingContext2D, map: PreparedMap, d: MapDrawing, card: TimelapseCard) {
  const { w, h } = cardLayout(ctx, card, d.font, map.width);
  drawMap(ctx, map, { ...d, avoid: [[32, 32, 32 + w, 32 + h], [map.width - 360, map.height - 70, map.width, map.height]] });
  drawCard(ctx, card, d.font, map.width, map.height);
}

/** A timelapse frame's card: the date and the headline in a corner, the game's progress along the bottom. */
function drawCard(ctx: CanvasRenderingContext2D, card: TimelapseCard, font: string, width: number, height: number) {
  const { pad, w, h, lines } = cardLayout(ctx, card, font, width);
  ctx.save();
  ctx.fillStyle = PAPER;
  ctx.globalAlpha = 0.93;
  ctx.fillRect(32, 32, w, h);
  ctx.globalAlpha = 1;
  ctx.fillStyle = ACCENT;
  ctx.fillRect(32, 32, 6, h);
  ctx.textBaseline = "top";
  let at = 32 + pad;
  ctx.fillStyle = MUTED;
  ctx.font = `900 20px ${font}`;
  spacing(ctx, 3);
  ctx.fillText(card.kicker.toUpperCase(), 32 + pad, at);
  spacing(ctx, 0);
  at += 22 + 8;
  ctx.fillStyle = INK;
  ctx.font = `900 48px ${font}`;
  ctx.fillText(card.date, 32 + pad, at);
  at += 54;
  if (lines.length) {
    at += 14;
    ctx.font = `800 26px ${font}`;
    for (const line of lines) {
      ctx.fillText(line, 32 + pad, at);
      at += 32;
    }
  }
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillRect(0, height - 10, width, 10);
  ctx.fillStyle = ACCENT;
  ctx.fillRect(0, height - 10, width * Math.min(1, Math.max(0, card.progress)), 10);
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.font = `900 22px ${font}`;
  spacing(ctx, 2);
  ctx.strokeStyle = HALO;
  ctx.lineWidth = 6;
  ctx.strokeText(card.brand.toUpperCase(), width - 28, height - 26);
  ctx.fillText(card.brand.toUpperCase(), width - 28, height - 26);
  ctx.restore();
}

/** The font stack the page uses, for text drawn on a canvas. */
export function pageFont(): string {
  return getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
}

/** A canvas as a PNG file. */
export function canvasPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("The picture could not be made."))), "image/png"));
}

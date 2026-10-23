/**
 * Paints the scene of each start date in oil (public/scenes/<date>.webp),
 * from a free picture of that moment on Wikimedia Commons, and the worn
 * paper the pages lie on (public/paper/light.webp, dark.webp).
 *
 *   npm run scenes             the eight scenes and the paper
 *   npm run scenes -- --paper  only the paper
 *
 * A scene keeps its picture only if Commons gives it a free licence (the
 * portraits' rule, scripts/portraits/oil.mjs); public/scenes/credits.json
 * says who made each picture, its licence and what was changed, and the
 * About page lists them. The pictures are cached in scripts/.cache/scenes.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { autocontrast, commons, fetchFile, freeLicence, OIL, paint, sharp } from "./portraits/oil.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const CACHE = path.join(ROOT, "scripts/.cache/scenes");
const OUT = path.join(ROOT, "public/scenes");
const PAPER = path.join(ROOT, "public/paper");

/** The canvas a scene is painted on (5:3, the cards' picture), and the size it is saved at. */
const W = 1000;
const H = 600;
const SIZE = { width: 720, height: 432, quality: 66, radius: 4 };

/**
 * The moment of each date. `crop` is x, y, width and height as shares of the
 * picture, where it must keep part of it (a missile at the top, a logo to
 * leave out); otherwise the 5:3 window sharp finds the most detail in.
 */
const SCENES = [
  { id: "1914", file: "File:Ferdinand Behr arrested in Sarajevo 1914.jpg", what: "An arrest in Sarajevo after the shots, 28 June 1914" },
  { id: "1939", file: "File:Bundesarchiv Bild 183-51909-0003, Polen, Schlagbaum, deutsche Soldaten.jpg", what: "German soldiers remove the barrier on the Polish border, September 1939" },
  { id: "1950", file: "File:Refugees in Korea.jpg", what: "Refugees on a road leading south, Korea, 1950" },
  { id: "1964", file: "File:USS Maddox (DD-731) underway at sea, circa the early 1960s (NH 97900).jpg", what: "The destroyer USS Maddox at sea, early 1960s" },
  { id: "1991", file: "File:T-72 tank in Moscow, August 1991.jpg", what: "A tank with flowers in Moscow, 19 August 1991" },
  { id: "1999", file: "File:Defense.gov News Photo 990324-N-1556A-004.jpg", what: "A Tomahawk cruise missile leaves USS Philippine Sea, 24 March 1999", crop: [0, 0, 1, 0.8] },
  { id: "2014", file: "File:Independence Square (12642536274).jpg", what: "Independence Square in Kyiv during the Maidan, February 2014" },
  { id: "2022", file: "File:Wreckage in Eastern Ukraine, February 2022.png", what: "Wreckage in eastern Ukraine, 24 February 2022", crop: [0, 0, 0.84, 0.9] },
];

/** A picture as greys on the 5:3 canvas: its crop, or the window with most detail. */
async function greyWide(buf, crop) {
  let img = sharp(buf).rotate().flatten({ background: "#ffffff" });
  if (crop) {
    const meta = await sharp(buf).rotate().metadata();
    const w = meta.autoOrient?.width ?? meta.width;
    const h = meta.autoOrient?.height ?? meta.height;
    const box = { left: Math.round(crop[0] * w), top: Math.round(crop[1] * h), width: Math.round(crop[2] * w), height: Math.round(crop[3] * h) };
    img = sharp(await img.extract(box).toBuffer());
  }
  const data = await img.resize(W, H, { fit: "cover", position: sharp.strategy.attention, kernel: "lanczos3" }).grayscale().raw().toBuffer();
  return autocontrast(Float32Array.from(data, (v) => v / 255));
}

/** Light over the middle of the scene, the corners sinking into shadow. */
function glow() {
  const m = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const r = Math.hypot((x / W - 0.5) / 0.5, (y / H - 0.45) / 0.55);
      m[y * W + x] = Math.min(1, Math.max(0, 1.25 - r)) ** 1.5;
    }
  }
  return m;
}

async function paintScenes() {
  mkdirSync(CACHE, { recursive: true });
  mkdirSync(OUT, { recursive: true });
  const info = await commons(SCENES.map((s) => s.file), 1600);
  const light = glow();
  const credits = {};
  for (const scene of SCENES) {
    const meta = info.get(scene.file);
    const licence = meta ? freeLicence(meta) : null;
    if (!meta || !licence) throw new Error(`${scene.id}: ${scene.file} is missing or not under a free licence (${meta?.licence ?? "none"})`);
    const ext = (meta.url.match(/\.(jpe?g|png|webp|tiff?|gif)(?:$|\?)/i)?.[1] ?? "jpg").toLowerCase();
    const buf = await fetchFile(meta.url, path.join(CACHE, `${scene.id}.${ext}`));
    const out = await paint(await greyWide(buf, scene.crop), light, W, H, SIZE);
    writeFileSync(path.join(OUT, `${scene.id}.webp`), out);
    credits[scene.id] = {
      name: scene.what,
      source: meta.page,
      file: meta.file,
      author: meta.author,
      licence,
      licenceName: meta.licence,
      licenceUrl: meta.licenceUrl,
      changes: scene.crop ? "cropped to 5:3 (leaving out a part), toned and painted in oil" : "cropped to 5:3, toned and painted in oil",
    };
    console.log(`${scene.id}: ${Math.round(out.length / 1024)} KB, ${licence}`);
  }
  writeFileSync(path.join(OUT, "credits.json"), JSON.stringify(credits, null, 1) + "\n");
}

// --- the paper ---

/** The paper's tile: it repeats seamlessly, so every pattern on it wraps round its edges. */
const T = 512;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth noise of `cells` cells across the tile, wrapping at the edges. */
function periodic(cells, rand) {
  const grid = Float32Array.from({ length: cells * cells }, () => rand());
  const at = (i, j) => grid[((j + cells) % cells) * cells + ((i + cells) % cells)];
  const ease = (t) => t * t * (3 - 2 * t);
  const out = new Float32Array(T * T);
  for (let y = 0; y < T; y++) {
    const gy = (y / T) * cells;
    const j = Math.floor(gy);
    const fy = ease(gy - j);
    for (let x = 0; x < T; x++) {
      const gx = (x / T) * cells;
      const i = Math.floor(gx);
      const fx = ease(gx - i);
      const top = at(i, j) * (1 - fx) + at(i + 1, j) * fx;
      const bottom = at(i, j + 1) * (1 - fx) + at(i + 1, j + 1) * fx;
      out[y * T + x] = top * (1 - fy) + bottom * fy;
    }
  }
  return out;
}

/** Thin fibres and a few scratches, drawn round the tile's edges. */
function fibres(rand, count, length, strength) {
  const out = new Float32Array(T * T);
  for (let n = 0; n < count; n++) {
    let x = rand() * T;
    let y = rand() * T;
    let a = rand() * Math.PI * 2;
    const len = length * (0.4 + rand());
    const s = strength * (0.5 + rand() * 0.5);
    for (let k = 0; k < len; k++) {
      a += (rand() - 0.5) * 0.18;
      x += Math.cos(a);
      y += Math.sin(a);
      const i = ((Math.round(y) % T) + T) % T;
      const j = ((Math.round(x) % T) + T) % T;
      out[i * T + j] = Math.max(out[i * T + j], s);
    }
  }
  return out;
}

/**
 * How worn each point of the paper is (0 clean, 1 most): broad stains of
 * oil and age, mottling, fibres and a few specks.
 */
function wear(seed) {
  const rand = rng(seed);
  const stains = [periodic(3, rand), periodic(6, rand), periodic(12, rand)];
  const mottle = [periodic(32, rand), periodic(64, rand)];
  const lines = fibres(rand, 420, 20, 1);
  const out = new Float32Array(T * T);
  for (let i = 0; i < out.length; i++) {
    const stain = Math.max(0, stains[0][i] * 0.55 + stains[1][i] * 0.3 + stains[2][i] * 0.15 - 0.45) * 1.8;
    const grain = mottle[0][i] * 0.6 + mottle[1][i] * 0.4;
    const speck = rand() < 0.0015 ? 0.6 + rand() * 0.4 : 0;
    out[i] = Math.min(1, stain * 0.8 + grain * 0.24 + lines[i] * 0.16 + speck * 0.45);
  }
  return out;
}

/** One tile of paper: the oil ramp's `tone` laid over the page's own colour, as strong as the wear and `alpha`. */
async function paperTile(file, tone, alpha, seed) {
  const w = wear(seed);
  const rgba = Buffer.alloc(T * T * 4);
  for (let i = 0; i < T * T; i++) {
    rgba[i * 4] = tone[0];
    rgba[i * 4 + 1] = tone[1];
    rgba[i * 4 + 2] = tone[2];
    rgba[i * 4 + 3] = Math.round(255 * Math.min(1, w[i] * alpha));
  }
  const out = await sharp(rgba, { raw: { width: T, height: T, channels: 4 } }).webp({ quality: 70, alphaQuality: 60, effort: 6 }).toBuffer();
  writeFileSync(file, out);
  console.log(`${path.relative(ROOT, file)}: ${Math.round(out.length / 1024)} KB`);
}

async function paintPaper() {
  mkdirSync(PAPER, { recursive: true });
  // Umber stains on the light page; on the dark one, faint ivory wear.
  await paperTile(path.join(PAPER, "light.webp"), OIL[2][1], 0.2, 11);
  await paperTile(path.join(PAPER, "dark.webp"), OIL[3][1], 0.1, 11);
}

const args = process.argv.slice(2);
if (!args.includes("--paper")) await paintScenes();
await paintPaper();

/**
 * Paints the portraits of the game's people in oil (public/portraits).
 *
 *   npm run portraits              all people in scripts/portraits/people.json
 *   npm run portraits -- molotov   only these ids (and the shadows)
 *   npm run portraits -- --index   only the engine's index, after editing names in people.json
 *
 * For each person with a Wikidata id it reads the picture (P18) and sex
 * (P21), keeps the picture only if Commons gives it a free licence (public
 * domain, CC0, CC BY, CC BY-SA, OGL — never NC, ND or GFDL alone), downloads
 * it into scripts/.cache/portraits, crops head and shoulders 4:5 (a `crop`
 * in people.json overrides the guess), paints it and writes
 * public/portraits/<id>.webp. People without a usable picture get the
 * shadow of their sex, painted from Wikimedia's public-domain placeholder
 * busts. It also writes public/portraits/credits.json (who made each source
 * picture, its licence, what was changed) and src/engine/people.data.ts, the
 * index the engine matches names against.
 *
 * The painting: grey, smoothed like flat paint (Kuwahara), light on the face
 * and the room sinking into shadow, a few brush strokes, a warm ramp from
 * umber to ivory, a glaze and the weave of the canvas.
 *
 * sharp comes with Next.js; if it is missing: npm i --no-save sharp.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

let sharp;
try {
  sharp = (await import("sharp")).default;
} catch {
  console.error("sharp is not installed: npm i --no-save sharp");
  process.exit(1);
}

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const PEOPLE = path.join(ROOT, "scripts/portraits/people.json");
const CACHE = path.join(ROOT, "scripts/.cache/portraits");
const OUT = path.join(ROOT, "public/portraits");
const INDEX = path.join(ROOT, "src/engine/people.data.ts");
const UA = "GulfOfTrump-portraits/1.0 (https://github.com/Darhaal/GulfOfTrump; artem@okhtengroup.com)";

const W = 480;
const H = 600;
const OUT_W = 256;
const OUT_H = 320;

/** The placeholder busts the shadows are painted from (Wikimedia Commons, public domain). */
const SHADOWS = {
  male: "File:Black - replace this image male.svg",
  female: "File:Black - replace this image female.svg",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url) {
  for (let i = 0; i < 5; i++) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.ok) return res.json();
    await sleep(2000 * (i + 1));
  }
  throw new Error(`could not fetch ${url}`);
}

async function fetchFile(url, file) {
  if (existsSync(file)) return readFileSync(file);
  for (let i = 0; i < 5; i++) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      writeFileSync(file, buf);
      await sleep(400);
      return buf;
    }
    await sleep(3000 * (i + 1));
  }
  throw new Error(`could not download ${url}`);
}

// --- Wikidata and Commons ---

async function wikidata(qids) {
  const out = new Map();
  for (let i = 0; i < qids.length; i += 50) {
    const chunk = qids.slice(i, i + 50);
    const j = await fetchJson(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims&ids=${chunk.join("|")}`);
    for (const [id, e] of Object.entries(j.entities ?? {})) {
      const claim = (p) => e.claims?.[p]?.find((c) => c.rank === "preferred") ?? e.claims?.[p]?.[0];
      const sex = claim("P21")?.mainsnak?.datavalue?.value?.id;
      out.set(id, {
        image: claim("P18")?.mainsnak?.datavalue?.value,
        gender: sex === "Q6581072" ? "female" : sex === "Q6581097" ? "male" : undefined,
      });
    }
    await sleep(300);
  }
  return out;
}

const stripHtml = (s) =>
  String(s ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

async function commons(titles) {
  const out = new Map();
  for (let i = 0; i < titles.length; i += 40) {
    const chunk = titles.slice(i, i + 40);
    const j = await fetchJson(
      `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=900&titles=${chunk.map(encodeURIComponent).join("|")}`,
    );
    const norm = new Map((j.query?.normalized ?? []).map((n) => [n.to, n.from]));
    for (const p of Object.values(j.query?.pages ?? {})) {
      const ii = p.imageinfo?.[0];
      if (!ii) continue;
      const m = ii.extmetadata ?? {};
      const v = (k) => m[k]?.value;
      const info = {
        file: p.title,
        page: ii.descriptionurl,
        url: ii.thumburl ?? ii.url,
        author: stripHtml(v("Artist")) || stripHtml(v("Credit")) || "unknown",
        licence: stripHtml(v("LicenseShortName")) || stripHtml(v("License")),
        licenceUrl: v("LicenseUrl"),
        code: String(v("License") ?? "").toLowerCase(),
      };
      out.set(p.title, info);
      if (norm.has(p.title)) out.set(norm.get(p.title), info);
    }
    await sleep(300);
  }
  return out;
}

/** Free enough to paint and publish: public domain, CC0, CC BY, CC BY-SA, OGL. */
export function freeLicence({ licence, code }) {
  const s = `${licence} ${code}`.toLowerCase();
  if (/\bnc\b|-nc|noncommercial|\bnd\b|-nd|noderiv|fair use|non-free/.test(s)) return null;
  if (/public domain|^pd|\bpd-|\bpd\b|cc0|cc-zero/.test(s)) return "public domain";
  if (/cc[ -]by[ -]sa|cc-by-sa|share ?alike/.test(s)) return "CC BY-SA";
  if (/cc[ -]by\b|cc-by-\d|attribution/.test(s)) return "CC BY";
  if (/\bogl\b|open government licence/.test(s)) return "OGL";
  return null;
}

// --- painting (a port of the tested Python reference) ---

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand) {
  const u = Math.max(1e-12, rand());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

/** Stretch the greys so 1% are black and 1% white. */
function autocontrast(g) {
  const hist = new Uint32Array(256);
  for (const v of g) hist[Math.round(v * 255)]++;
  const cut = g.length * 0.01;
  let lo = 0;
  let hi = 255;
  for (let acc = 0; lo < 255 && acc + hist[lo] <= cut; lo++) acc += hist[lo];
  for (let acc = 0; hi > 0 && acc + hist[hi] <= cut; hi--) acc += hist[hi];
  if (hi <= lo) return g;
  const out = new Float32Array(g.length);
  for (let i = 0; i < g.length; i++) out[i] = Math.min(1, Math.max(0, (g[i] * 255 - lo) / (hi - lo)));
  return out;
}

/** Edge-keeping smoothing: each pixel takes the mean of its calmest quadrant. */
function kuwahara(img, r) {
  const pw = W + 2 * r;
  const ph = H + 2 * r;
  const at = (x, y) => {
    const cx = x < 0 ? -x : x >= W ? 2 * W - x - 2 : x;
    const cy = y < 0 ? -y : y >= H ? 2 * H - y - 2 : y;
    return img[cy * W + cx];
  };
  // Integral images of the padded picture, one row and column of zeros in front.
  const s = new Float64Array((pw + 1) * (ph + 1));
  const s2 = new Float64Array((pw + 1) * (ph + 1));
  for (let y = 0; y < ph; y++) {
    let row = 0;
    let row2 = 0;
    for (let x = 0; x < pw; x++) {
      const v = at(x - r, y - r);
      row += v;
      row2 += v * v;
      const i = (y + 1) * (pw + 1) + (x + 1);
      s[i] = s[i - (pw + 1)] + row;
      s2[i] = s2[i - (pw + 1)] + row2;
    }
  }
  const box = (arr, x0, y0, x1, y1) => arr[y1 * (pw + 1) + x1] - arr[y0 * (pw + 1) + x1] - arr[y1 * (pw + 1) + x0] + arr[y0 * (pw + 1) + x0];
  const n = (r + 1) * (r + 1);
  const out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let best = Infinity;
      let mean = 0;
      for (const dy of [0, r]) {
        for (const dx of [0, r]) {
          const x0 = x + dx;
          const y0 = y + dy;
          const a = box(s, x0, y0, x0 + r + 1, y0 + r + 1);
          const b = box(s2, x0, y0, x0 + r + 1, y0 + r + 1);
          const m = a / n;
          const v = b / n - m * m;
          if (v < best) {
            best = v;
            mean = m;
          }
        }
      }
      out[y * W + x] = mean;
    }
  }
  return out;
}

/** Brush texture: noise smeared along one direction. */
function strokes(seed, angle, length, amount) {
  const rand = mulberry32(seed);
  const noise = new Float32Array(W * H);
  for (let i = 0; i < noise.length; i++) noise[i] = gaussian(rand);
  const acc = new Float32Array(W * H);
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  for (let k = -length; k <= length; k++) {
    const ox = Math.round(k * dx);
    const oy = Math.round(k * dy);
    for (let y = 0; y < H; y++) {
      const sy = (((y - oy) % H) + H) % H;
      for (let x = 0; x < W; x++) {
        const sx = (((x - ox) % W) + W) % W;
        acc[y * W + x] += noise[sy * W + sx];
      }
    }
  }
  let sum = 0;
  let sum2 = 0;
  for (const v of acc) {
    sum += v;
    sum2 += v * v;
  }
  const mean = sum / acc.length;
  const std = Math.sqrt(sum2 / acc.length - mean * mean) + 1e-6;
  for (let i = 0; i < acc.length; i++) acc[i] = (acc[i] / std) * amount;
  return acc;
}

const OIL = [
  [0, [16, 11, 10]],
  [0.28, [52, 32, 24]],
  [0.52, [120, 76, 48]],
  [0.76, [196, 146, 100]],
  [1, [244, 224, 188]],
];

function ramp(v) {
  for (let i = 1; i < OIL.length; i++) {
    if (v <= OIL[i][0]) {
      const [t0, c0] = OIL[i - 1];
      const [t1, c1] = OIL[i];
      const f = (v - t0) / (t1 - t0);
      return [c0[0] + (c1[0] - c0[0]) * f, c0[1] + (c1[1] - c0[1]) * f, c0[2] + (c1[2] - c0[2]) * f];
    }
  }
  return OIL[OIL.length - 1][1];
}

/** Light that falls on the face: 1 at its centre, fading out by an ellipse. */
function faceMask(cx, cy, rx = 0.2, ry = 0.19, soft = 0.9) {
  const m = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const r = Math.hypot((x / W - cx) / rx, (y / H - cy) / ry);
      m[y * W + x] = Math.min(1, Math.max(0, (1 + soft - r) / soft)) ** 2;
    }
  }
  return m;
}

/** Paints a grey picture (W×H, 0–1) in oil; returns the webp. */
async function paint(g, face) {
  const lum = kuwahara(g, 3);
  const brush = strokes(7, 0.4, 6, 0.025);
  const rgb = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const r = Math.min(1, Math.hypot((x / W - 0.5) / 0.6, (y / H - 0.42) / 0.7));
      const vignette = 1 - 0.55 * r * r;
      let v = lum[i] * (0.55 + 0.45 * vignette) * (0.78 + 0.32 * face[i]);
      v = Math.min(1, Math.max(0, v + brush[i])) ** 1.1;
      const c = ramp(v);
      rgb[i * 3] = c[0];
      rgb[i * 3 + 1] = c[1];
      rgb[i * 3 + 2] = c[2];
    }
  }
  const raw = { raw: { width: W, height: H, channels: 3 } };
  const glaze = await sharp(rgb, raw).blur(3).raw().toBuffer();
  const out = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const weave = Math.sin((x * Math.PI) / 1.6) * Math.sin((y * Math.PI) / 1.6) * 4;
      for (let c = 0; c < 3; c++) {
        const i = (y * W + x) * 3 + c;
        out[i] = Math.max(0, Math.min(255, rgb[i] * 0.7 + glaze[i] * 0.3 + weave));
      }
    }
  }
  return sharp(out, raw).sharpen({ sigma: 1.2 }).resize(OUT_W, OUT_H, { kernel: "lanczos3" }).webp({ quality: 68, effort: 6 }).toBuffer();
}

/**
 * Where to look for head and shoulders, unless people.json gives a crop: the
 * upper 4:5 of an upright picture at its full width (where an official
 * portrait has the head), or, for a square or wide one, the 4:5 window sharp
 * finds the most detail and skin in (its "attention" strategy). Full-length
 * pictures need a crop in people.json.
 */
function guessCrop(w, h) {
  if (h / w >= 1.25) {
    const ch = Math.round(w * 1.25);
    return { box: { left: 0, top: Math.min(Math.round(h * 0.03), h - ch), width: w, height: ch }, attention: false };
  }
  return { box: { left: 0, top: 0, width: w, height: h }, attention: true };
}

async function greyFrom(buf, crop) {
  const meta = await sharp(buf).rotate().metadata();
  const w = meta.autoOrient?.width ?? meta.width;
  const h = meta.autoOrient?.height ?? meta.height;
  const guess = crop ? null : guessCrop(w, h);
  // A crop of three numbers is x, y and width as shares of the picture; the height follows for 4:5.
  const box = crop
    ? (() => {
        const width = Math.round(crop[2] * w);
        const height = Math.min(h - Math.round(crop[1] * h), crop[3] !== undefined ? Math.round(crop[3] * h) : Math.round(width * 1.25));
        return { left: Math.round(crop[0] * w), top: Math.round(crop[1] * h), width: Math.min(width, w - Math.round(crop[0] * w)), height };
      })()
    : guess.box;
  const data = await sharp(buf).rotate().flatten({ background: "#ffffff" }).extract(box).resize(W, H, guess?.attention ? { fit: "cover", position: sharp.strategy.attention, kernel: "lanczos3" } : { fit: "fill", kernel: "lanczos3" }).grayscale().raw().toBuffer();
  const g = new Float32Array(W * H);
  for (let i = 0; i < g.length; i++) g[i] = data[i] / 255;
  return autocontrast(g);
}

/** A grey picture (W×H, 0–1) blurred by sharp; one channel back, whatever sharp would make of it. */
async function blurGrey(grey, sigma) {
  const out = await sharp(Buffer.from(grey.map((v) => Math.round(v * 255))), { raw: { width: W, height: H, channels: 1 } })
    .blur(sigma)
    .extractChannel(0)
    .raw()
    .toBuffer();
  return Float32Array.from(out, (v) => v / 255);
}

/** A placeholder bust as a dark figure against a lit wall, its edge caught by the light. */
async function shadowGrey(buf) {
  const bw = Math.round(W * 0.92);
  const img = sharp(buf).ensureAlpha();
  const meta = await img.metadata();
  const bh = Math.round((bw * meta.height) / meta.width);
  const alpha = await sharp(buf).ensureAlpha().resize(bw, bh).extractChannel("alpha").raw().toBuffer();
  let m = new Float32Array(W * H);
  const ox = Math.round((W - bw) / 2);
  const oy = H - bh;
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) if (y + oy >= 0) m[(y + oy) * W + x + ox] = alpha[y * bw + x] / 255;
  m = await blurGrey(m, 1.5);
  const g = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const wall = 0.82 - (y / H) * 0.1 - Math.abs(x / W - 0.45) * 0.15;
      const body = 0.13 + (1 - x / W) * 0.05;
      const sy = y - 5;
      const sx = x - 6;
      const shifted = sy >= 0 && sx >= 0 ? m[sy * W + sx] : 0;
      const rim = Math.max(0, m[i] - shifted);
      g[i] = Math.min(1, Math.max(0, wall * (1 - m[i]) + body * m[i] + rim * 0.35));
    }
  }
  const soft = await blurGrey(g, 1);
  const face = faceMask(0.5, 0.36, 0.22, 0.22);
  for (let i = 0; i < face.length; i++) face[i] *= 1 - m[i];
  return { g: soft, face };
}

// --- the run ---

async function main() {
  const args = process.argv.slice(2);
  const people = JSON.parse(readFileSync(PEOPLE, "utf8"));
  if (args.includes("--index")) {
    // Only the engine's index and the credits, from people.json and what is painted: after an edit to names or aliases.
    const credits = prune(JSON.parse(readFileSync(path.join(OUT, "credits.json"), "utf8")), people);
    writeFileSync(path.join(OUT, "credits.json"), JSON.stringify(credits, null, 1) + "\n");
    writeIndex(people, credits);
    return;
  }
  const only = new Set(args);
  mkdirSync(CACHE, { recursive: true });
  mkdirSync(OUT, { recursive: true });
  const creditsFile = path.join(OUT, "credits.json");
  const credits = existsSync(creditsFile) ? JSON.parse(readFileSync(creditsFile, "utf8")) : {};

  // The two shadows, always.
  const shadowInfo = await commons(Object.values(SHADOWS));
  for (const [gender, title] of Object.entries(SHADOWS)) {
    const info = shadowInfo.get(title);
    const buf = await fetchFile(info.url, path.join(CACHE, `_shadow-${gender}.png`));
    const { g, face } = await shadowGrey(buf);
    writeFileSync(path.join(OUT, `_shadow-${gender}.webp`), await paint(g, face));
    credits[`_shadow-${gender}`] = { name: `Shadow (${gender})`, source: info.page, file: info.file, author: info.author, licence: freeLicence(info) ?? info.licence, licenceUrl: info.licenceUrl, changes: "placed against a lit wall and painted in oil" };
  }

  const todo = people.filter((p) => p.qid && (!only.size || only.has(p.id)));
  const wd = await wikidata(todo.map((p) => p.qid));
  const files = [...new Set(todo.map((p) => wd.get(p.qid)?.image ?? p.image).filter(Boolean).map((f) => `File:${f}`))];
  const info = await commons(files);

  let painted = 0;
  let shadowed = 0;
  for (const p of todo) {
    const fromWd = wd.get(p.qid) ?? {};
    if (!p.gender && fromWd.gender) p.gender = fromWd.gender;
    // Wikidata's picture now, or the one people.json noted when the person was added.
    const image = fromWd.image ?? p.image;
    const meta = image ? info.get(`File:${image}`) : undefined;
    const licence = meta ? freeLicence(meta) : null;
    const target = path.join(OUT, `${p.id}.webp`);
    // noPortrait in people.json: the picture is of something else (a bust, a wall) or too small to paint.
    if (!meta || !licence || p.noPortrait) {
      delete credits[p.id];
      p.portrait = false;
      shadowed++;
      continue;
    }
    try {
      const ext = (meta.url.match(/\.(jpe?g|png|webp|tiff?|gif)(?:$|\?)/i)?.[1] ?? "jpg").toLowerCase();
      const buf = await fetchFile(meta.url, path.join(CACHE, `${p.qid}.${ext}`));
      const g = await greyFrom(buf, p.crop);
      const [fx, fy] = p.face ?? [0.5, 0.36];
      writeFileSync(target, await paint(g, faceMask(fx, fy)));
      credits[p.id] = {
        name: p.name.en,
        source: meta.page,
        file: meta.file,
        author: meta.author,
        licence,
        licenceName: meta.licence,
        licenceUrl: meta.licenceUrl,
        changes: "cropped to head and shoulders, toned and painted in oil",
      };
      p.portrait = true;
      painted++;
      if (painted % 25 === 0) console.log(`${painted} painted…`);
    } catch (error) {
      console.warn(`${p.id}: ${error.message}`);
      delete credits[p.id];
      p.portrait = false;
      shadowed++;
    }
  }

  const sorted = only.size ? Object.fromEntries(Object.entries(credits).sort(([a], [b]) => a.localeCompare(b))) : prune(credits, people);
  writeFileSync(creditsFile, JSON.stringify(sorted, null, 1) + "\n");
  if (!only.size) writeIndex(people, sorted);
  console.log(`painted ${painted}, shadows ${shadowed}`);
}

/**
 * Credits and files kept in step: someone renamed or dropped from people.json,
 * or marked noPortrait, loses their file and credit, and a file nobody credits
 * goes. Returns the credits, sorted.
 */
function prune(credits, people) {
  const keep = new Set(people.filter((p) => !p.noPortrait).map((p) => p.id));
  const out = {};
  for (const [id, c] of Object.entries(credits).sort(([a], [b]) => a.localeCompare(b))) {
    if ((id.startsWith("_shadow-") || keep.has(id)) && existsSync(path.join(OUT, `${id}.webp`))) out[id] = c;
  }
  for (const file of readdirSync(OUT).filter((f) => f.endsWith(".webp"))) if (!out[file.slice(0, -5)]) unlinkSync(path.join(OUT, file));
  return out;
}

/** The engine's index: every name a person goes by, their sex and whether a portrait exists. */
function writeIndex(people, credits) {
  const rows = people.map((p) => {
      const name = { en: p.name.en, ...(p.name.ru ? { ru: p.name.ru } : {}), ...(p.name.uk ? { uk: p.name.uk } : {}) };
      const names = [...new Set([p.name.en, p.name.ru, p.name.uk, ...(p.aliases ?? [])].filter(Boolean))];
      return { id: p.id, name, names, gender: p.gender ?? "male", ...(credits[p.id] ? { portrait: true } : {}) };
    });
  const lines = rows.map((r) => `  ${JSON.stringify(r)},`).join("\n");
  writeFileSync(INDEX, `// Generated by scripts/portraits.mjs from scripts/portraits/people.json — do not edit by hand.\nimport type { KnownPerson } from "./people";\n\nexport const KNOWN_PEOPLE: KnownPerson[] = [\n${lines}\n];\n`);
  console.log(`index: ${rows.length} people`);
}

await main();

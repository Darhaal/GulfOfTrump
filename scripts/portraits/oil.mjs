/**
 * What the portraits, the shadows and the scenes share: Commons and its
 * licences, and the painting in oil (a port of the tested Python reference),
 * for a canvas of any size.
 *
 * sharp comes with Next.js; if it is missing: npm i --no-save sharp.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";

export let sharp;
try {
  sharp = (await import("sharp")).default;
} catch {
  console.error("sharp is not installed: npm i --no-save sharp");
  process.exit(1);
}

export const UA = "GulfOfTrump-portraits/1.0 (https://github.com/Darhaal/GulfOfTrump; artem@okhtengroup.com)";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function fetchJson(url) {
  for (let i = 0; i < 5; i++) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.ok) return res.json();
    await sleep(2000 * (i + 1));
  }
  throw new Error(`could not fetch ${url}`);
}

export async function fetchFile(url, file) {
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

// --- Commons ---

const stripHtml = (s) =>
  String(s ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Commons file pages: their picture's URL (a thumbnail `width` wide), author and licence. */
export async function commons(titles, width = 900) {
  const out = new Map();
  for (let i = 0; i < titles.length; i += 40) {
    const chunk = titles.slice(i, i + 40);
    const j = await fetchJson(
      `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=${width}&titles=${chunk.map(encodeURIComponent).join("|")}`,
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

/** Free enough to paint and publish: public domain, CC0, CC BY, CC BY-SA, OGL, GODL-India, KOGL Type 1, FAL, the European Parliament's, no known restrictions. */
export function freeLicence({ licence, code }) {
  const s = `${licence} ${code}`.toLowerCase();
  if (/\bnc\b|-nc|noncommercial|\bnd\b|-nd|noderiv|fair use|non-free/.test(s)) return null;
  if (/public domain|^pd|\bpd-|\bpd\b|cc0|cc-zero/.test(s)) return "public domain";
  if (/cc[ -]by[ -]sa|cc-by-sa|share ?alike/.test(s)) return "CC BY-SA";
  if (/cc[ -]by\b|cc-by-\d|attribution/.test(s)) return "CC BY";
  if (/\bogl\b|open government licence/.test(s)) return "OGL";
  // India's Government Open Data Licence: free to use and adapt, with the source named.
  if (/godl|government open data licen[cs]e/.test(s)) return "GODL-India";
  // Korea's open government licence, type 1 only: types 2-4 bar commercial use or changes.
  if (/kogl type 1|korea open government licen[cs]e type 1/.test(s)) return "KOGL Type 1";
  // The Free Art License: free to use and change, the result under the same licence.
  if (/\bfal\b|free art licen[cs]e|licence art libre/.test(s)) return "FAL";
  // The European Parliament's photographs: free to reuse with the source named.
  if (/european parliament/.test(s)) return "European Parliament";
  // Flickr Commons and archives that know of no copyright on the picture.
  if (/no (known )?(copyright )?restrictions/.test(s)) return "no known restrictions";
  return null;
}

// --- painting ---

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gaussian(rand) {
  const u = Math.max(1e-12, rand());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

/** Stretch the greys so 1% are black and 1% white. */
export function autocontrast(g) {
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
export function kuwahara(img, r, W, H) {
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
export function strokes(seed, angle, length, amount, W, H) {
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

export const OIL = [
  [0, [16, 11, 10]],
  [0.28, [52, 32, 24]],
  [0.52, [120, 76, 48]],
  [0.76, [196, 146, 100]],
  [1, [244, 224, 188]],
];

export function ramp(v) {
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

/**
 * Paints a grey picture (W×H, 0–1) in oil and returns the webp at `size`:
 * smoothed like flat paint, lit where `light` is 1 and sinking into shadow
 * at the edges, a few brush strokes, the umber–ivory ramp, a glaze and the
 * weave of a canvas.
 */
export async function paint(g, light, W, H, size) {
  const lum = kuwahara(g, size.radius ?? 3, W, H);
  const brush = strokes(7, 0.4, 6, 0.025, W, H);
  const rgb = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const r = Math.min(1, Math.hypot((x / W - 0.5) / 0.6, (y / H - 0.42) / 0.7));
      const vignette = 1 - 0.55 * r * r;
      let v = lum[i] * (0.55 + 0.45 * vignette) * (0.78 + 0.32 * light[i]);
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
  return sharp(out, raw).sharpen({ sigma: 1.2 }).resize(size.width, size.height, { kernel: "lanczos3" }).webp({ quality: size.quality ?? 68, effort: 6 }).toBuffer();
}

/** A grey picture (W×H, 0–1) blurred by sharp; one channel back, whatever sharp would make of it. */
export async function blurGrey(grey, sigma, W, H) {
  const out = await sharp(Buffer.from(grey.map((v) => Math.round(v * 255))), { raw: { width: W, height: H, channels: 1 } })
    .blur(sigma)
    .extractChannel(0)
    .raw()
    .toBuffer();
  return Float32Array.from(out, (v) => v / 255);
}

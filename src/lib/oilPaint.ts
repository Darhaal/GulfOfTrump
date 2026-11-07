/**
 * A picture the player brings – a photograph for their party – painted in oil
 * the way the game's portraits are (scripts/portraits/oil.mjs): the greys
 * stretched, smoothed like flat paint, sinking into shadow at the edges, a
 * few brush strokes, the umber–ivory ramp, a glaze and the weave of a canvas.
 * The pixels are pure arithmetic here; components/game/politics/paintPhoto.ts
 * reads the file and writes the picture with a canvas.
 */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand: () => number) {
  const u = Math.max(1e-12, rand());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

/** Stretch the greys so 1% are black and 1% white. */
export function autocontrast(g: Float32Array): Float32Array {
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
export function kuwahara(img: Float32Array, r: number, W: number, H: number): Float32Array {
  const pw = W + 2 * r;
  const ph = H + 2 * r;
  const at = (x: number, y: number) => {
    const cx = x < 0 ? -x : x >= W ? 2 * W - x - 2 : x;
    const cy = y < 0 ? -y : y >= H ? 2 * H - y - 2 : y;
    return img[cy * W + cx];
  };
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
  const box = (arr: Float64Array, x0: number, y0: number, x1: number, y1: number) => arr[y1 * (pw + 1) + x1] - arr[y0 * (pw + 1) + x1] - arr[y1 * (pw + 1) + x0] + arr[y0 * (pw + 1) + x0];
  const n = (r + 1) * (r + 1);
  const out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let best = Infinity;
      let mean = 0;
      for (const dy of [0, r]) {
        for (const dx of [0, r]) {
          const a = box(s, x + dx, y + dy, x + dx + r + 1, y + dy + r + 1);
          const b = box(s2, x + dx, y + dy, x + dx + r + 1, y + dy + r + 1);
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
export function strokes(seed: number, angle: number, length: number, amount: number, W: number, H: number): Float32Array {
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

/** The portraits' ramp, from umber shadow to ivory light. */
const OIL: [number, [number, number, number]][] = [
  [0, [16, 11, 10]],
  [0.28, [52, 32, 24]],
  [0.52, [120, 76, 48]],
  [0.76, [196, 146, 100]],
  [1, [244, 224, 188]],
];

function ramp(v: number): [number, number, number] {
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

/** A small box blur of an RGB picture, for the glaze. */
function blurRgb(rgb: Uint8ClampedArray, W: number, H: number, r: number): Float32Array {
  const tmp = new Float32Array(W * H * 3);
  const out = new Float32Array(W * H * 3);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        let n = 0;
        for (let k = -r; k <= r; k++) {
          const sx = Math.min(W - 1, Math.max(0, x + k));
          sum += rgb[(y * W + sx) * 4 + c];
          n++;
        }
        tmp[(y * W + x) * 3 + c] = sum / n;
      }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        let n = 0;
        for (let k = -r; k <= r; k++) {
          const sy = Math.min(H - 1, Math.max(0, y + k));
          sum += tmp[(sy * W + x) * 3 + c];
          n++;
        }
        out[(y * W + x) * 3 + c] = sum / n;
      }
  return out;
}

/**
 * Paints an RGBA picture (W×H, as a canvas gives it) in oil, in place: the
 * same steps as the portraits, with the light from above the middle, where a
 * face or an emblem usually is.
 */
export function paintPixels(rgba: Uint8ClampedArray, W: number, H: number, radius = 3): Uint8ClampedArray {
  const grey = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) grey[i] = (0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]) / 255;
  const lum = kuwahara(autocontrast(grey), radius, W, H);
  const brush = strokes(7, 0.4, 6, 0.025, W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const r = Math.min(1, Math.hypot((x / W - 0.5) / 0.6, (y / H - 0.42) / 0.7));
      const vignette = 1 - 0.55 * r * r;
      const light = 1 - 0.6 * r * r;
      let v = lum[i] * (0.55 + 0.45 * vignette) * (0.78 + 0.32 * light);
      v = Math.min(1, Math.max(0, v + brush[i])) ** 1.1;
      const c = ramp(v);
      rgba[i * 4] = c[0];
      rgba[i * 4 + 1] = c[1];
      rgba[i * 4 + 2] = c[2];
      rgba[i * 4 + 3] = 255;
    }
  }
  const glaze = blurRgb(rgba, W, H, 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const weave = Math.sin((x * Math.PI) / 1.6) * Math.sin((y * Math.PI) / 1.6) * 4;
      for (let c = 0; c < 3; c++) {
        const i = (y * W + x) * 4 + c;
        rgba[i] = Math.max(0, Math.min(255, rgba[i] * 0.7 + glaze[(y * W + x) * 3 + c] * 0.3 + weave));
      }
    }
  }
  return rgba;
}

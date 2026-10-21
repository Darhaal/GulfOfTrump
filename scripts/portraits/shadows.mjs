/**
 * The shadows: dark busts for people without a photograph, drawn for the game
 * on a 480×600 canvas and painted in oil like the portraits. Each era has its
 * own heads, hair, hats, collars and shoulders, so a minister of 1914 does not
 * stand in for one of 2022, and a cabinet of strangers is not one face.
 *
 * Every look is a list of black shapes; their union is the figure. Most are
 * drawn as their right half and mirrored about the middle (`both`).
 */

const CX = 240;

/** A path from steps: ["M", x, y], ["L", x, y], ["Q", ...4], ["C", ...6], ["Z"]. */
const d = (...steps) => steps.map(([op, ...n]) => op + n.map((v) => Math.round(v * 10) / 10).join(" ")).join(" ");
const path = (p) => `<path d="${p}"/>`;
const mirror = (svg) => `<g transform="matrix(-1 0 0 1 ${2 * CX} 0)">${svg}</g>`;
/** A right half and its mirror. */
const both = (p) => path(p) + mirror(path(p));
const ellipse = (cx, cy, rx, ry, rot = 0) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"${rot ? ` transform="rotate(${rot} ${cx} ${cy})"` : ""}/>`;
/** The whole figure set lower, for a look whose hair or hat would leave the frame. */
const lower = (svg, dy) => `<g transform="translate(0 ${dy})">${svg}</g>`;
const circle = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`;
/** Hair and beards: their edge broken a little, as hair is. */
const rough = (svg) => `<g filter="url(#hair)">${svg}</g>`;

// --- the body ---

/** A head without hair: crown, temples, cheeks, jaw and chin. */
const face = ({ top, hw, cheekY, jawW, jawY, chinY, chinW }) =>
  both(d(["M", CX, top], ["C", CX + hw * 0.58, top, CX + hw, top + hw * 0.45, CX + hw, top + hw * 0.95], ["C", CX + hw + 1, cheekY - 8, CX + jawW + 16, jawY - 22, CX + jawW, jawY], ["C", CX + jawW - 10, jawY + 22, CX + chinW + 12, chinY, CX, chinY], ["Z"]));

const ears = (h) => ellipse(CX - h.hw - 3, h.cheekY - 10, 10, 23, 6) + ellipse(CX + h.hw + 3, h.cheekY - 10, 10, 23, -6);

/**
 * Neck, shoulders and chest. `sw` is half the shoulders' width, `drop` how far
 * they fall below the neck, `square` (0–1) how padded and square they are.
 */
function torso(h, { sw, drop = 44, square = 0 }) {
  const n = h.neck;
  const nb = h.chinY + 16;
  const tip = nb + drop;
  const k = square;
  return both(
    d(
      ["M", CX, h.jawY - 10],
      ["L", CX + n, h.jawY - 10],
      ["L", CX + n + 1, nb - 34],
      ["C", CX + n + 4, nb - 8, CX + n + 30, nb + 6, CX + n + 60, nb + 12],
      ["C", CX + sw * 0.58, nb + 16 + drop * (0.3 - 0.2 * k), CX + sw * (0.78 + 0.08 * k), tip - 8 - 4 * k, CX + sw * (0.9 + 0.04 * k), tip - 2 * k],
      ["C", CX + sw * (0.97 + 0.02 * k), tip + 2, CX + sw, tip + 18 - 10 * k, CX + sw + 1, tip + 46 - 18 * k],
      ["L", CX + sw + 6, 600],
      ["L", CX, 600],
      ["Z"],
    ),
  );
}

/** A collar standing round the neck: the stiff wing collars of 1914, a tunic's stand collar. */
const highCollar = (h, rise = h.chinY - 8, extra = 6) => both(d(["M", CX, rise + 4], ["Q", CX + h.neck * 0.6, rise - 2, CX + h.neck + extra, rise], ["L", CX + h.neck + extra + 2, h.chinY + 30], ["L", CX, h.chinY + 30], ["Z"]));

/** Puffed sleeves at the shoulders (1910s blouses). */
const puffs = (sw, y = 368) => ellipse(CX - sw * 0.8, y, 44, 32, -22) + ellipse(CX + sw * 0.8, y, 44, 32, 22);

/** Epaulettes at the ends of the shoulders; fringed ones hang a row of bullion. */
function epaulettes(h, sw, { fringe = false, drop = 40 } = {}) {
  const y = h.chinY + 16 + drop - 4;
  const one = (s) => {
    const x = CX + s * sw * 0.84;
    let out = ellipse(x, y, 38, 13, s * 12);
    if (fringe) for (let i = -3; i <= 3; i++) out += `<rect x="${x + i * 9.5 - 3}" y="${y + 2}" width="7" height="${22 - Math.abs(i) * 2}" rx="3" transform="rotate(${s * 12} ${x} ${y})"/>`;
    return out;
  };
  return one(-1) + one(1);
}

// --- hair, beards, hats ---

/**
 * Hair over the crown, following the skull: `lift` above it, `ex` out at the
 * temples, down to `side`. `liftL`/`exL` give a side parting its fuller side;
 * `part` dents the middle for a centre parting.
 */
function bareHair(h, { lift = 14, ex = 3, side, liftL = lift, exL = ex, part = 0 }) {
  const s = side ?? h.top + h.hw * 0.95;
  // The sides come back into the temple, so the hair has no rim like a helmet's.
  const half = (L, e) =>
    d(["M", CX, h.top - L + part], ["C", CX + 16, h.top - L - 1, CX + h.hw * 0.62 + e, h.top - L, CX + h.hw + e, h.top + h.hw * 0.42 - L * 0.4], ["C", CX + h.hw + e + 1, h.top + h.hw * 0.7, CX + h.hw + e * 0.5, s - 12, CX + h.hw - 2, s + 8], ["L", CX, s + 8], ["Z"]);
  return path(half(lift, ex)) + mirror(path(half(liftL, exL)));
}
const hair = (h, o) => rough(bareHair(h, o));

/** A short flat top. */
const flatTop = (h, { lift = 14, ex = 2 } = {}) =>
  rough(both(d(["M", CX, h.top - lift], ["L", CX + h.hw - 48, h.top - lift], ["C", CX + h.hw - 10, h.top - lift, CX + h.hw + ex, h.top - lift + 10, CX + h.hw + ex, h.top + 40 - lift * 0.5], ["L", CX + h.hw + ex - 1, h.top + h.hw * 0.95], ["L", CX, h.top + h.hw * 0.95], ["Z"])));

/** What is left above the ears of a bald head. */
const tufts = (h, size = 1) => rough(ellipse(CX - h.hw - 2, h.top + h.hw * 0.9, 8 * size, 24 * size, 10) + ellipse(CX + h.hw + 2, h.top + h.hw * 0.9, 8 * size, 24 * size, -10));

/** Curls round the crown. */
function bareCurls(h, { lift = 20, r = 16, n = 9 } = {}) {
  let out = bareHair(h, { lift: lift - r * 0.6, ex: 4 });
  for (let i = 0; i < n; i++) {
    const a = Math.PI * (1.06 + (0.88 * i) / (n - 1));
    out += circle((CX + Math.cos(a) * (h.hw - 4)).toFixed(1), (h.top + h.hw * 0.62 + Math.sin(a) * (h.hw * 0.62 + lift - r)).toFixed(1), r);
  }
  return out;
}
const curls = (h, o) => rough(bareCurls(h, o));

/** Beards: full and round, pointed, short and trimmed, or side whiskers with the chin shaved. */
const beard = (h, kind) => rough(bareBeard(h, kind));
function bareBeard(h, kind) {
  const { hw, cheekY, jawW, jawY, chinY } = h;
  if (kind === "full") return both(d(["M", CX, cheekY + 10], ["L", CX + hw - 1, cheekY - 6], ["C", CX + hw + 4, jawY + 4, CX + jawW + 8, chinY + 14, CX, chinY + 36], ["Z"]));
  if (kind === "pointed") return both(d(["M", CX, jawY], ["L", CX + jawW - 2, jawY - 8], ["C", CX + jawW + 2, chinY - 4, CX + 18, chinY + 24, CX, chinY + 46], ["Z"]));
  if (kind === "short") return both(d(["M", CX, cheekY + 16], ["L", CX + hw - 2, cheekY + 4], ["C", CX + hw + 2, jawY + 2, CX + jawW + 4, chinY + 6, CX, chinY + 14], ["Z"]));
  // A great spreading beard, as the old men of 1914 wore.
  return both(d(["M", CX, cheekY], ["L", CX + hw + 1, cheekY - 12], ["C", CX + hw + 16, jawY - 6, CX + jawW + 34, chinY + 30, CX, chinY + 58], ["Z"]));
}

/** A homburg: a creased crown and a brim turned up at the sides. */
function homburg(h, { brim = 44, crown = 64 } = {}) {
  const b = h.top + 30;
  return both(
    d(
      ["M", CX, b - crown + 10],
      ["Q", CX + 14, b - crown, CX + 34, b - crown],
      ["C", CX + h.hw - 18, b - crown, CX + h.hw - 2, b - crown + 12, CX + h.hw + 2, b - 6],
      ["C", CX + h.hw + brim * 0.6, b - 4, CX + h.hw + brim - 4, b - 10, CX + h.hw + brim, b - 18],
      ["C", CX + h.hw + brim + 2, b - 4, CX + h.hw + brim * 0.6, b + 10, CX + h.hw - 6, b + 12],
      ["Q", CX + 40, b + 16, CX, b + 16],
      ["Z"],
    ),
  );
}

/** A peaked military cap: a crown wider than the head, a band and a visor. */
function peakedCap(h, { wide = 30, high = 52 } = {}) {
  const band = h.top + 46;
  return both(
    d(
      ["M", CX, band - high - 14],
      ["C", CX + h.hw * 0.5, band - high - 14, CX + h.hw + wide - 14, band - high - 4, CX + h.hw + wide, band - high + 6],
      ["C", CX + h.hw + wide + 4, band - high + 16, CX + h.hw + 10, band - 16, CX + h.hw - 2, band - 8],
      ["L", CX + h.hw - 4, band + 10],
      ["C", CX + h.hw * 0.7, band + 26, CX + 30, band + 30, CX, band + 30],
      ["Z"],
    ),
  );
}

/** A woman's hair, by its style. */
const womanHair = (h, style) => rough(bareWomanHair(h, style));
function bareWomanHair(h, style) {
  const { top, hw, cheekY, jawY } = h;
  const t = top;
  switch (style) {
    case "gibson":
      // Swept up all round into a soft cloud, a knot on top.
      return both(d(["M", CX, t - 46], ["C", CX + 40, t - 50, CX + hw + 30, t - 30, CX + hw + 26, t + 40], ["C", CX + hw + 22, t + 80, CX + hw + 4, cheekY - 28, CX + hw - 2, cheekY - 10], ["L", CX, cheekY - 10], ["Z"])) + circle(CX, t - 56, 28);
    case "rolls":
      // The forties: rolled curls to the collar, flaring at the ends.
      return both(d(["M", CX, t - 22], ["C", CX + 50, t - 26, CX + hw + 22, t, CX + hw + 22, t + 70], ["C", CX + hw + 24, cheekY + 10, CX + hw + 30, jawY, CX + hw + 22, jawY + 30], ["L", CX, jawY + 30], ["Z"])) + circle(CX - hw - 14, jawY + 26, 22) + circle(CX + hw + 14, jawY + 26, 22) + circle(CX - hw + 10, jawY + 40, 18) + circle(CX + hw - 10, jawY + 40, 18);
    case "victory":
      // Two rolls high on the head, the rest pinned close.
      return bareHair(h, { lift: 10, ex: 6, side: cheekY + 10 }) + circle(CX - 26, t - 4, 28) + circle(CX + 26, t - 4, 28);
    case "bouffant":
      // The sixties: a round crown of backcombed hair, the ends flipped out.
      return both(d(["M", CX, t - 58], ["C", CX + 60, t - 58, CX + hw + 34, t - 20, CX + hw + 30, t + 70], ["C", CX + hw + 28, cheekY + 20, CX + hw + 22, jawY - 18, CX + hw + 40, jawY - 12], ["C", CX + hw + 24, jawY + 4, CX + hw + 6, jawY - 2, CX + hw, jawY - 10], ["L", CX, jawY - 10], ["Z"]));
    case "beehive":
      return both(d(["M", CX, t - 76], ["C", CX + 46, t - 76, CX + hw + 14, t - 30, CX + hw + 12, t + 40], ["C", CX + hw + 10, t + 80, CX + hw + 4, cheekY - 20, CX + hw, cheekY], ["L", CX, cheekY], ["Z"]));
    case "short-curls":
      return bareCurls(h, { lift: 22, r: 17, n: 9 }) + bareHair(h, { lift: 10, ex: 8, side: cheekY + 8 });
    case "bob":
      // Straight to the chin, cut level.
      return both(d(["M", CX, t - 20], ["C", CX + hw * 0.6, t - 22, CX + hw + 16, t + 14, CX + hw + 16, t + 76], ["C", CX + hw + 16, cheekY + 24, CX + hw + 24, jawY, CX + hw + 30, jawY + 22], ["Q", CX + hw + 8, jawY + 28, CX + hw - 8, jawY + 16], ["L", CX, jawY], ["Z"]));
    case "long":
      // Long and straight: close round the face, then falling over the shoulders.
      return both(d(["M", CX, t - 16], ["C", CX + hw * 0.6, t - 18, CX + hw + 12, t + 18, CX + hw + 14, t + 80], ["C", CX + hw + 16, cheekY + 30, CX + hw + 8, jawY, CX + hw + 14, jawY + 34], ["C", CX + hw + 22, 360, CX + hw + 40, 400, CX + hw + 36, 462], ["L", CX + hw + 6, 470], ["L", CX, 420], ["Z"]));
    case "pixie":
      return bareHair(h, { lift: 10, liftL: 26, exL: 10, ex: 4, side: cheekY - 20 });
    case "bun":
      return bareHair(h, { lift: 8, ex: 4, side: cheekY - 16 }) + circle(CX, t - 22, 26);
    default:
      return bareHair(h, { lift: 14 });
  }
}

/** An Edwardian picture hat: a wide brim tilted on the hair, a plume curling over it. */
function pictureHat(h) {
  const y = h.top - 24;
  return (
    ellipse(CX + 10, y, h.hw + 96, 20, -6) +
    path(d(["M", CX - h.hw - 6, y + 8], ["C", CX - h.hw - 4, y - 60, CX + h.hw + 4, y - 72, CX + h.hw + 10, y - 2], ["Z"])) +
    path(d(["M", CX + 20, y - 40], ["C", CX + 74, y - 92, CX + 172, y - 84, CX + 192, y - 24], ["C", CX + 170, y - 60, CX + 102, y - 66, CX + 36, y - 26], ["Z"]))
  );
}

/** A small hat of the forties, tilted over one brow. */
const tiltedHat = (h) => ellipse(CX + 32, h.top - 18, 68, 16, -14) + ellipse(CX + 26, h.top - 34, 36, 22, -14);

// --- heads ---

const MAN = { top: 86, hw: 84, cheekY: 210, jawW: 64, jawY: 272, chinY: 312, chinW: 26, neck: 52 };
const BROAD = { ...MAN, hw: 90, jawW: 74, jawY: 278, chinY: 316, chinW: 32, neck: 58 };
const LEAN = { ...MAN, hw: 78, jawW: 56, jawY: 270, chinY: 312, chinW: 22, neck: 47 };
const WOMAN = { top: 96, hw: 74, cheekY: 210, jawW: 52, jawY: 266, chinY: 302, chinW: 22, neck: 40 };

const man = (h, parts) => [face(h), ears(h), ...parts].join("");
const woman = (h, parts) => [face(h), ...parts].join("");

/** The looks of each era, men's and women's. Their order is their file names (_shadow-1910-male-0 …): add at the end. */
export const SHADOW_ERAS = {
  // 1914: stiff collars, beards and whiskers, plumed hats, the Kaiser's officers.
  1910: {
    male: [
      man(MAN, [hair(MAN, { lift: 14, part: 9 }), beard(MAN, "full"), torso(MAN, { sw: 200, drop: 50 }), highCollar(MAN)]),
      man(LEAN, [hair(LEAN, { lift: 10, liftL: 20, exL: 6 }), torso(LEAN, { sw: 196, drop: 52 }), highCollar(LEAN)]),
      man(BROAD, [tufts(BROAD, 1.1), beard(BROAD, "whiskers"), torso(BROAD, { sw: 210, drop: 48 }), highCollar(BROAD)]),
      man(MAN, [peakedCap(MAN, { wide: 16, high: 40 }), torso(MAN, { sw: 206, drop: 44, square: 0.5 }), highCollar(MAN, 300, 8), epaulettes(MAN, 206, { fringe: true, drop: 44 })]),
      man(LEAN, [hair(LEAN, { lift: 10, part: 7 }), beard(LEAN, "pointed"), torso(LEAN, { sw: 196, drop: 50 }), highCollar(LEAN)]),
      man(BROAD, [hair(BROAD, { lift: 22, ex: 7 }), beard(BROAD, "full"), torso(BROAD, { sw: 210, drop: 46 }), highCollar(BROAD)]),
    ],
    female: [
      woman(WOMAN, [womanHair(WOMAN, "gibson"), torso(WOMAN, { sw: 178, drop: 50 }), highCollar(WOMAN, 286, 4), puffs(178)]),
      lower(woman(WOMAN, [womanHair(WOMAN, "rolls"), pictureHat(WOMAN), torso(WOMAN, { sw: 178, drop: 50 }), highCollar(WOMAN, 286, 4)]), 26),
      woman(WOMAN, [womanHair(WOMAN, "bun"), torso(WOMAN, { sw: 176, drop: 52 }), highCollar(WOMAN, 284, 4), puffs(176)]),
    ],
  },
  // 1939: padded shoulders, brilliantine, homburgs and peaked caps.
  1940: {
    male: [
      man(MAN, [hair(MAN, { lift: 7, ex: 2 }), torso(MAN, { sw: 226, drop: 34, square: 1 })]),
      man(BROAD, [tufts(BROAD), torso(BROAD, { sw: 230, drop: 34, square: 1 })]),
      man(MAN, [homburg(MAN), torso(MAN, { sw: 226, drop: 36, square: 1 })]),
      man(MAN, [peakedCap(MAN, { wide: 28, high: 52 }), torso(MAN, { sw: 224, drop: 34, square: 1 }), highCollar(MAN, 304, 8), epaulettes(MAN, 224, { drop: 34 })]),
      man(LEAN, [hair(LEAN, { lift: 12, liftL: 20, exL: 5 }), torso(LEAN, { sw: 220, drop: 36, square: 1 })]),
      man(BROAD, [hair(BROAD, { lift: 9, ex: 2 }), torso(BROAD, { sw: 230, drop: 32, square: 1 })]),
    ],
    female: [
      woman(WOMAN, [womanHair(WOMAN, "rolls"), torso(WOMAN, { sw: 194, drop: 36, square: 1 })]),
      woman(WOMAN, [womanHair(WOMAN, "victory"), torso(WOMAN, { sw: 194, drop: 36, square: 1 })]),
      woman(WOMAN, [womanHair(WOMAN, "rolls"), tiltedHat(WOMAN), torso(WOMAN, { sw: 192, drop: 36, square: 1 })]),
    ],
  },
  // 1950 and 1964: crew cuts, side partings, the marshals' big caps.
  1960: {
    male: [
      man(MAN, [flatTop(MAN, { lift: 14 }), torso(MAN, { sw: 214, drop: 42 })]),
      man(MAN, [hair(MAN, { lift: 10, liftL: 18, exL: 5 }), torso(MAN, { sw: 214, drop: 42 })]),
      man(BROAD, [hair(BROAD, { lift: 6, ex: 1 }), torso(BROAD, { sw: 222, drop: 40 })]),
      man(BROAD, [peakedCap(BROAD, { wide: 40, high: 58 }), torso(BROAD, { sw: 224, drop: 38, square: 0.6 }), highCollar(BROAD, 308, 8), epaulettes(BROAD, 224, { drop: 38 })]),
      man(LEAN, [tufts(LEAN, 0.9), torso(LEAN, { sw: 208, drop: 44 })]),
      man(MAN, [hair(MAN, { lift: 20, ex: 5 }), torso(MAN, { sw: 214, drop: 42 })]),
    ],
    female: [
      woman(WOMAN, [womanHair(WOMAN, "bouffant"), torso(WOMAN, { sw: 184, drop: 46 })]),
      lower(woman(WOMAN, [womanHair(WOMAN, "beehive"), torso(WOMAN, { sw: 182, drop: 46 })]), 16),
      woman(WOMAN, [womanHair(WOMAN, "short-curls"), torso(WOMAN, { sw: 186, drop: 44 })]),
    ],
  },
  // 1991 and 1999: boxy suits, full grey heads of hair, shoulder pads.
  1990: {
    male: [
      man(MAN, [hair(MAN, { lift: 28, ex: 9 }), torso(MAN, { sw: 226, drop: 38, square: 0.6 })]),
      man(BROAD, [tufts(BROAD), torso(BROAD, { sw: 228, drop: 38, square: 0.6 })]),
      man(MAN, [hair(MAN, { lift: 12, liftL: 22, exL: 6, ex: 3 }), torso(MAN, { sw: 224, drop: 38, square: 0.6 })]),
      man(LEAN, [hair(LEAN, { lift: 12, ex: 3 }), beard(LEAN, "short"), torso(LEAN, { sw: 218, drop: 40, square: 0.4 })]),
      man(BROAD, [hair(BROAD, { lift: 10, ex: 3 }), torso(BROAD, { sw: 230, drop: 36, square: 0.6 })]),
      man(MAN, [curls(MAN, { lift: 22, r: 15, n: 9 }), torso(MAN, { sw: 222, drop: 40, square: 0.4 })]),
    ],
    female: [
      woman(WOMAN, [womanHair(WOMAN, "bob"), torso(WOMAN, { sw: 194, drop: 38, square: 0.8 })]),
      woman(WOMAN, [womanHair(WOMAN, "short-curls"), torso(WOMAN, { sw: 194, drop: 38, square: 0.8 })]),
      woman(WOMAN, [womanHair(WOMAN, "bouffant"), torso(WOMAN, { sw: 192, drop: 40, square: 0.6 })]),
    ],
  },
  // 2014 and 2022: short modern cuts, trimmed beards, long hair.
  2020: {
    male: [
      man(MAN, [hair(MAN, { lift: 16, liftL: 24, exL: 5, ex: 3 }), torso(MAN, { sw: 214, drop: 44 })]),
      man(BROAD, [torso(BROAD, { sw: 220, drop: 42 })]),
      man(LEAN, [flatTop(LEAN, { lift: 8, ex: 2 }), beard(LEAN, "short"), torso(LEAN, { sw: 208, drop: 44 })]),
      man(MAN, [hair(MAN, { lift: 6, ex: 2 }), torso(MAN, { sw: 216, drop: 44 })]),
      man(BROAD, [hair(BROAD, { lift: 10, ex: 3 }), beard(BROAD, "short"), torso(BROAD, { sw: 220, drop: 42 })]),
      man(LEAN, [hair(LEAN, { lift: 22, ex: 6, liftL: 30, exL: 8 }), torso(LEAN, { sw: 208, drop: 46 })]),
    ],
    female: [
      woman(WOMAN, [torso(WOMAN, { sw: 184, drop: 46 }), womanHair(WOMAN, "long")]),
      woman(WOMAN, [womanHair(WOMAN, "bob"), torso(WOMAN, { sw: 184, drop: 46 })]),
      woman(WOMAN, [womanHair(WOMAN, "pixie"), torso(WOMAN, { sw: 184, drop: 46 })]),
      woman(WOMAN, [womanHair(WOMAN, "bun"), torso(WOMAN, { sw: 184, drop: 46 })]),
    ],
  },
};

/** One look as an SVG of the canvas, black on nothing. */
export const shadowSvg = (body, w = 480, h = 600, seed = 3) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 480 600"><defs><filter id="hair" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="${seed}"/><feDisplacementMap in="SourceGraphic" scale="7" xChannelSelector="R" yChannelSelector="G"/></filter></defs><g fill="black">${body}</g></svg>`;

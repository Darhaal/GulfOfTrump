/**
 * The demo site's link-preview cards (Open Graph and Twitter, 1200×630):
 * public/og/home.jpg for the front page, a mosaic of the twelve dates around
 * the emblem, and public/og/<date>.jpg for each date, its scene in oil
 * (public/scenes, npm run scenes) under the year and the emblem.
 *
 *   npm run og
 *
 * The cards carry no words but the game's name and the years, so one card
 * serves all three languages: the page's own title and description travel
 * beside it in every preview. The text is set in the system's sans-serif
 * (librsvg through sharp); the files are kept in the repository, so a
 * rebuild elsewhere only changes them if the scenes or the emblem change.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { sharp } from "./portraits/oil.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const OUT = path.join(ROOT, "public/og");
const W = 1200;
const H = 630;
/** The brand's colours (src/app/globals.css): the night, the paper, the orange of the dark theme. */
const NIGHT = "#12100D";
const PAPER = "#FFFDF8";
const ORANGE = "#F97316";
const FONT = "'Segoe UI', 'Helvetica Neue', Arial, 'Liberation Sans', sans-serif";
const DATES = ["1914", "1933", "1939", "1950", "1957", "1964", "1973", "1979", "1991", "1999", "2014", "2022"];
/** The front page's mosaic: every date, three rows of four. */
const MOSAIC = DATES;
const QUALITY = 82;

const scene = (id) => path.join(ROOT, "public/scenes", `${id}.webp`);
const emblem = (size) => sharp(path.join(ROOT, "public/brand/emblem.webp")).resize(size, size).png().toBuffer();
const svg = (body) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${body}</svg>`);

/** The emblem and the name, top left, as on the site's header. */
const wordmark = (x, y, size) =>
  `<text x="${x + size + 22}" y="${y + size / 2 + 13}" font-family="${FONT}" font-weight="800" font-size="36" letter-spacing="1" fill="${PAPER}">Gulf of Trump<tspan fill="${ORANGE}">.</tspan></text>`;

async function dateCard(id) {
  const size = 84;
  const overlay = svg(`
    <defs>
      <linearGradient id="shade" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="${NIGHT}" stop-opacity="0.92"/>
        <stop offset="0.55" stop-color="${NIGHT}" stop-opacity="0.55"/>
        <stop offset="1" stop-color="${NIGHT}" stop-opacity="0.1"/>
      </linearGradient>
      <linearGradient id="foot" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0.55" stop-color="${NIGHT}" stop-opacity="0"/>
        <stop offset="1" stop-color="${NIGHT}" stop-opacity="0.7"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#shade)"/>
    <rect width="${W}" height="${H}" fill="url(#foot)"/>
    ${wordmark(64, 56, size)}
    <text x="58" y="520" font-family="${FONT}" font-weight="900" font-size="230" letter-spacing="-8" fill="${PAPER}">${id}</text>
    <rect x="70" y="552" width="120" height="10" rx="5" fill="${ORANGE}"/>`);
  await sharp(scene(id))
    .resize(W, H, { fit: "cover", position: "centre", kernel: "lanczos3" })
    .composite([{ input: overlay }, { input: await emblem(size), left: 64, top: 56 }])
    .jpeg({ quality: QUALITY, mozjpeg: true })
    .toFile(path.join(OUT, `${id}.jpg`));
}

/** Twelve scenes in three rows of four, each with its year, and the emblem and the name on a dark band across the middle. */
async function homeCard() {
  const tw = W / 4;
  const th = H / 3;
  const tiles = await Promise.all(
    MOSAIC.map(async (id, i) => ({
      input: await sharp(scene(id)).resize(Math.ceil(tw), Math.ceil(th), { fit: "cover", position: "centre" }).modulate({ brightness: 0.8 }).toBuffer(),
      left: Math.round((i % 4) * tw),
      top: Math.round(Math.floor(i / 4) * th),
    })),
  );
  const years = MOSAIC.map((id, i) => {
    const x = Math.round((i % 4) * tw) + 24;
    // The top row by its top edge, the bottom row by its bottom edge, the middle row just above the band.
    const y = i < 4 ? 56 : i < 8 ? Math.round(th) + 40 : H - 22;
    return `<text x="${x}" y="${y}" font-family="${FONT}" font-weight="900" font-size="40" letter-spacing="-1" fill="${PAPER}" fill-opacity="0.92">${id}</text>`;
  }).join("");
  const size = 96;
  const band = 120;
  const overlay = svg(`
    <rect width="${W}" height="${H}" fill="${NIGHT}" fill-opacity="0.25"/>
    <rect y="${(H - band) / 2}" width="${W}" height="${band}" fill="${NIGHT}" fill-opacity="0.88"/>
    <rect y="${(H + band) / 2 - 8}" width="${W}" height="8" fill="${ORANGE}"/>
    ${years}
    <text x="${W / 2 - 300 + size + 24}" y="${H / 2 + 22}" font-family="${FONT}" font-weight="900" font-size="64" letter-spacing="-2" fill="${PAPER}">Gulf of Trump<tspan fill="${ORANGE}">.</tspan></text>`);
  await sharp({ create: { width: W, height: H, channels: 3, background: NIGHT } })
    .composite([...tiles, { input: overlay, left: 0, top: 0 }, { input: await emblem(size), left: W / 2 - 300, top: (H - size) / 2 }])
    .jpeg({ quality: QUALITY, mozjpeg: true })
    .toFile(path.join(OUT, "home.jpg"));
}

mkdirSync(OUT, { recursive: true });
await homeCard();
for (const id of DATES) await dateCard(id);
console.log(`${DATES.length + 1} cards in ${path.relative(ROOT, OUT)}`);

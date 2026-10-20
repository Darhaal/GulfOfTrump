#!/usr/bin/env node
/**
 * Builds the desktop app: the game's standalone server, then the Windows
 * installer around it.
 *
 *   npm run desktop            # build the installer into desktop/dist
 *   npm run desktop -- --dir   # only the unpacked app, for a quick try
 *   npm run desktop -- --store # the Microsoft Store package (MSIX)
 *   npm run desktop -- --store --test-identity
 *                              # the same with a stand-in identity, to check
 *                              # the packaging before Partner Center has one
 *
 * Steps:
 *   1. `next build` with GOT_DESKTOP=1 (standalone output);
 *   2. the server, its static files and public/ copied into desktop/server;
 *   3. the app's version taken from the game's package.json, the installer's
 *      licence and pictures (and for the Store, the tiles) from the emblem;
 *   4. electron-builder.
 */
import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const desktop = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(desktop, "..");
const run = (command, cwd, env = {}) => execSync(command, { cwd, stdio: "inherit", env: { ...process.env, ...env } });
const args = process.argv.slice(2);
const store = args.includes("--store");
const extra = args.filter((a) => a !== "--store" && a !== "--test-identity");

// 0. A Store package needs its identity from Partner Center before anything is built.
const identity = store ? storeIdentity(args.includes("--test-identity")) : null;

// 1. The game, built as a standalone server. The demo flag stays off: the app
// plays for real. Supabase comes from the environment (.env.local here, the
// repository's variables in the release workflow) and turns on Google
// sign-in and cloud saves; its anon key is public by design, row-level
// security guards the data. Without it the app keeps saves on this computer.
run("npx next build", root, { GOT_DESKTOP: "1", NEXT_PUBLIC_GOT_DEMO: "" });

// 2. The server and what it serves.
const server = path.join(desktop, "server");
rmSync(server, { recursive: true, force: true });
cpSync(path.join(root, ".next", "standalone"), server, { recursive: true });
cpSync(path.join(root, ".next", "static"), path.join(server, ".next", "static"), { recursive: true });
cpSync(path.join(root, "public"), path.join(server, "public"), { recursive: true });
// Nothing from the developer's machine travels with the app: no env files, no stray sources.
for (const entry of readdirSync(server)) {
  if (entry.startsWith(".env")) rmSync(path.join(server, entry), { force: true });
}
for (const stray of ["desktop", "tests", "docs", ".claude"]) rmSync(path.join(server, stray), { recursive: true, force: true });

// 3. One version for the game and the app; the icon from the emblem.
const pkgPath = path.join(desktop, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
pkg.version = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).version;
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
cpSync(path.join(root, "public", "icon-512.png"), path.join(desktop, "build", "icon.png"));
// The installer's licence page and its pictures.
cpSync(path.join(root, "LICENSE"), path.join(desktop, "build", "license.txt"));
await drawInstallerArt();
if (store) await drawTiles();

// 4. The installer.
if (!existsSync(path.join(desktop, "node_modules", "electron"))) run("npm ci --no-audit --no-fund", desktop);
const target = identity
  ? ["appx", ...Object.entries(identity).map(([key, value]) => `-c.appx.${key}=${JSON.stringify(value)}`)]
  : [];
run(`npx electron-builder --win ${target.join(" ")} --publish never ${extra.join(" ")}`.replace(/ +/g, " ").trim(), desktop);

const dist = path.join(desktop, "dist");
for (const file of readdirSync(dist)) {
  const full = path.join(dist, file);
  if (statSync(full).isFile()) console.log(`${file}  ${(statSync(full).size / 1e6).toFixed(1)} MB`);
}

/** The Store identity from store.json, or a stand-in that only proves the packaging works. */
function storeIdentity(test) {
  if (test) return { identityName: "Test.GulfOfTrump", publisher: "CN=GulfOfTrumpTest", publisherDisplayName: "Test" };
  const { identityName, publisher, publisherDisplayName } = JSON.parse(readFileSync(path.join(desktop, "store.json"), "utf8"));
  const found = { identityName, publisher, publisherDisplayName };
  const missing = Object.keys(found).filter((key) => !found[key]);
  if (missing.length > 0) {
    console.error(`desktop/store.json has no ${missing.join(", ")}. Copy them from Partner Center → the app → Product management → Product identity, or check the packaging with --test-identity.`);
    process.exit(1);
  }
  return found;
}

/**
 * The Store's tiles and logos, drawn from the emblem on a transparent ground.
 * Each size also comes at twice the scale, and the small logo at the exact
 * sizes the taskbar and Start use, so Windows never stretches a picture.
 */
async function drawTiles() {
  const sharp = createRequire(path.join(root, "package.json"))("sharp");
  const source = path.join(root, "public", "icon-512.png");
  const out = path.join(desktop, "build", "appx");
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  // [name, width, height, share of the shorter side the emblem fills]
  const base = [
    ["StoreLogo", 50, 50, 1],
    ["Square44x44Logo", 44, 44, 1],
    ["Square150x150Logo", 150, 150, 0.7],
    ["Wide310x150Logo", 310, 150, 0.8],
  ];
  const tiles = base.flatMap(([name, w, h, share]) => [
    [`${name}.png`, w, h, share],
    [`${name}.scale-200.png`, w * 2, h * 2, share],
  ]);
  for (const n of [16, 24, 32, 48, 256]) tiles.push([`Square44x44Logo.targetsize-${n}_altform-unplated.png`, n, n, 1]);
  const clear = { r: 0, g: 0, b: 0, alpha: 0 };
  for (const [file, width, height, share] of tiles) {
    const side = Math.round(Math.min(width, height) * share);
    const emblem = await sharp(source).resize(side, side, { fit: "contain", background: clear }).png().toBuffer();
    await sharp({ create: { width, height, channels: 4, background: clear } })
      .composite([{ input: emblem, gravity: "center" }])
      .png()
      .toFile(path.join(out, file));
  }
}

/**
 * The installer's pictures, in the brand's black and orange: the sidebar of
 * the welcome and finish pages (164×314) and the header of the pages between
 * (150×57). NSIS reads only uncompressed 24-bit BMP, so they are written here.
 */
async function drawInstallerArt() {
  const sharp = createRequire(path.join(root, "package.json"))("sharp");
  const source = path.join(root, "public", "icon-512.png");
  const out = path.join(desktop, "build");
  const ink = { r: 17, g: 17, b: 19 };
  const orange = { r: 249, g: 115, b: 22 };
  const white = { r: 255, g: 255, b: 255 };

  // Sidebar: the emblem on black, an orange rule under it.
  const sideEmblem = await sharp(source).resize(116, 116).png().toBuffer();
  const rule = await sharp({ create: { width: 56, height: 3, channels: 3, background: orange } }).png().toBuffer();
  const sidebar = await sharp({ create: { width: 164, height: 314, channels: 3, background: ink } })
    .composite([
      { input: sideEmblem, top: 64, left: 24 },
      { input: rule, top: 200, left: 54 },
    ])
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  writeBmp(path.join(out, "installerSidebar.bmp"), sidebar);

  // Header: the emblem on the white of the page's top band.
  const headEmblem = await sharp(source).resize(47, 47).png().toBuffer();
  const header = await sharp({ create: { width: 150, height: 57, channels: 3, background: white } })
    .composite([{ input: headEmblem, top: 5, left: 97 }])
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  writeBmp(path.join(out, "installerHeader.bmp"), header);
}

/** An uncompressed 24-bit BMP from raw RGB pixels: rows bottom-up, BGR, padded to four bytes. */
function writeBmp(file, { data, info }) {
  const { width, height, channels } = info;
  const stride = Math.ceil((width * 3) / 4) * 4;
  const size = 54 + stride * height;
  const bmp = Buffer.alloc(size);
  bmp.write("BM", 0, "ascii");
  bmp.writeUInt32LE(size, 2);
  bmp.writeUInt32LE(54, 10);
  bmp.writeUInt32LE(40, 14);
  bmp.writeInt32LE(width, 18);
  bmp.writeInt32LE(height, 22);
  bmp.writeUInt16LE(1, 26);
  bmp.writeUInt16LE(24, 28);
  bmp.writeUInt32LE(stride * height, 34);
  bmp.writeInt32LE(2835, 38);
  bmp.writeInt32LE(2835, 42);
  for (let y = 0; y < height; y++) {
    const row = 54 + (height - 1 - y) * stride;
    for (let x = 0; x < width; x++) {
      const p = (y * width + x) * channels;
      bmp[row + x * 3] = data[p + 2];
      bmp[row + x * 3 + 1] = data[p + 1];
      bmp[row + x * 3 + 2] = data[p];
    }
  }
  writeFileSync(file, bmp);
}

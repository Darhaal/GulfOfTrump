// The screenshots of the game on the demo's front page, in the README and in
// the Microsoft Store listing: one 1950 game as the United States, two turns
// into the Korean War (scripts/screens/1950-usa.json), in English and the
// light theme.
//
// Runs against a production build with the offline game master, so it costs
// no plan; the status chip is shown as ChatGPT, as a player sees it:
//
//   npm run build && GOT_MOCK_AI=1 npm start
//   node scripts/screens.mjs                  (SCREENS_URL, default http://127.0.0.1:3000)
//
// It writes public/screens/1950/*.jpg, and with SCREENS_STORE=<folder> the
// Store's PNGs, 1600×1000, into that folder. The window is 1440×900 drawn at
// 1600×1000, so one side panel shows beside the map as on most screens;
// panels are cut to the panel at twice the pixels, so they stay sharp on
// phones and retina screens. On failure it leaves the window in
// screens-failure.png.
//
// The save is written by scripts/screens/make-save.ts through the engine:
// run `npx vitest run --config scripts/screens/vitest.config.mts` again when
// the game's state changes shape. Needs Playwright with Chromium, which the
// project does not depend on, as scripts/smoke.mjs does:
// `npm i --no-save playwright && npx playwright install chromium`
// (SCREENS_CHROMIUM points it at another Chromium, such as an installed Chrome).

import { mkdirSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const BASE = (process.env.SCREENS_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const ROOT = path.resolve(import.meta.dirname, "..");
const SAVE = path.join(ROOT, "scripts", "screens", "1950-usa.json");
const OUT = path.join(ROOT, "public", "screens", "1950");
const STORE = process.env.SCREENS_STORE;
const VIEWPORT = { width: 1440, height: 900 };
const BIG = 1600 / VIEWPORT.width;
/** JPEG quality: each picture stays well under 250 KB. */
const QUALITY = 80;
/** A panel picture: 380 CSS pixels wide (the panel) by this, at twice the pixels. */
const PANEL = { width: 380, height: 475 };
/** One map of the four in modes.jpg, in pixels. */
const TILE = { width: 450, height: 562 };

const errors = [];
const browser = await chromium.launch({
  ...(process.env.SCREENS_CHROMIUM ? { executablePath: process.env.SCREENS_CHROMIUM } : {}),
  // Number fields follow the browser's own language, not the page's.
  args: ["--lang=en-US"],
});
mkdirSync(OUT, { recursive: true });
if (STORE) mkdirSync(STORE, { recursive: true });

/** A window with the game open from the save, at the given pixel ratio. */
async function openGame(deviceScaleFactor) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor, colorScheme: "light", locale: "en-US", acceptDownloads: true });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(`page error: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
  page.setDefaultTimeout(30_000);
  // The player's view: signed in with ChatGPT, not the offline game master the pictures are made with.
  await page.route("**/api/ai/status", (route) => route.fulfill({ json: { provider: "chatgpt", status: "connected", sharing: true, identity: { name: "Player" } } }));
  await page.goto(`${BASE}/`);
  await page.evaluate(() => {
    localStorage.setItem("got_locale", "en");
    localStorage.setItem("got_theme", "light");
    localStorage.setItem("got_tour", "done");
  });
  await page.reload();
  await page.locator("input[type=file]").setInputFiles(SAVE);
  await page.waitForURL(/\/play\//);
  await page.waitForFunction(() => document.querySelectorAll("svg[aria-label='World map'] path[data-region]").length > 1000, null, { timeout: 60_000 });
  return page;
}

// Pictures of the whole window: 1440×900 drawn at 1600×1000.
const big = await openGame(BIG);
// Pictures of a panel: twice the pixels.
const sharp = await openGame(2);
// Pictures put together from others.
const desk = await browser.newPage({ deviceScaleFactor: 1 });
let current = big;

async function step(name, run) {
  const started = Date.now();
  try {
    await run();
  } catch (error) {
    await current.screenshot({ path: "screens-failure.png" }).catch(() => undefined);
    throw new Error(`${name}: ${error.message}`);
  }
  if (errors.length) throw new Error(`${name}:\n${errors.join("\n")}`);
  console.log(`ok  ${name} (${Date.now() - started} ms)`);
}

const leftPanel = (p) => p.locator("main > aside").first();
const dialog = (p) => p.locator("[role=dialog]");

/** The whole big window, for the site. */
const whole = (name) => big.screenshot({ path: path.join(OUT, `${name}.jpg`), type: "jpeg", quality: QUALITY });
/** The whole big window, for the Store, as a PNG. */
const store = async (name) => {
  if (STORE) await big.screenshot({ path: path.join(STORE, `${name}.png`), type: "png" });
};

/** A panel picture from an aside of the sharp window, from an element in it down (or from the top of its content). */
async function panel(name, aside, from) {
  const box = await aside.boundingBox();
  const content = await aside.locator(":scope > div").last().boundingBox();
  if (from) {
    await from.evaluate((el) => el.scrollIntoView({ block: "start" }));
    await sharp.waitForTimeout(250);
  }
  const top = from ? Math.max(content.y, (await from.boundingBox()).y - 18) : content.y;
  const clip = { x: box.x + Math.max(0, (box.width - PANEL.width) / 2), y: top, width: Math.min(PANEL.width, box.width), height: Math.min(PANEL.height, box.y + box.height - top) };
  await sharp.screenshot({ path: path.join(OUT, `${name}.jpg`), type: "jpeg", quality: QUALITY, clip });
}

/** Pictures laid out on a blank page and taken as one JPEG of the given size. */
async function compose(name, size, html) {
  await desk.setViewportSize(size);
  await desk.setContent(`<!doctype html><style>*{margin:0}body{width:${size.width}px;height:${size.height}px;overflow:hidden;background:#fff}img{display:block}</style>${html}`);
  await desk.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0));
  await desk.screenshot({ path: path.join(OUT, `${name}.jpg`), type: "jpeg", quality: QUALITY });
}
const dataUrl = (buffer, type = "image/png") => `data:${type};base64,${buffer.toString("base64")}`;

/** Opens a left panel in both windows. */
async function openLeft(id) {
  for (const p of [big, sharp]) {
    const tab = p.locator(`[data-tour="tab-${id}"]`);
    if ((await tab.getAttribute("aria-pressed")) !== "true") await tab.click();
  }
  await big.waitForTimeout(700);
}
async function closeLeft(p) {
  const open = p.locator('[data-tour^="tab-"][aria-pressed="true"]');
  if (await open.count()) await open.click();
  await p.waitForTimeout(500);
}

/** The last turn's changes, Korea, in the middle of the map, and a step closer than the turn's own framing. */
async function korea(p, closer = true) {
  await p.locator("button:visible", { hasText: /Turn 2: what changed/ }).click();
  await p.waitForTimeout(900);
  if (!closer) return;
  await p.locator('button[aria-label="Zoom in"]').click();
  // Nothing under the mouse or in focus: no tooltip, no lit button.
  await p.mouse.move(8, VIEWPORT.height - 8);
  await p.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
  await p.waitForTimeout(900);
}

/** A point of the window where a click lands on the province, as near its middle as can be. */
async function pointIn(p, id) {
  const point = await p.evaluate((id) => {
    const el = document.querySelector(`svg[aria-label="World map"] path[data-region="${id}"]`);
    if (!el) return null;
    const b = el.getBoundingClientRect();
    const hits = [];
    for (let i = 1; i < 16; i += 1)
      for (let j = 1; j < 16; j += 1) {
        const x = b.left + (b.width * i) / 16;
        const y = b.top + (b.height * j) / 16;
        if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
        if (document.elementFromPoint(x, y)?.closest("[data-region]")?.getAttribute("data-region") === id) hits.push({ x, y, d: Math.hypot(i - 8, j - 8) });
      }
    return hits.sort((a, b) => a.d - b.d)[0] ?? null;
  }, id);
  if (!point) throw new Error(`no visible point in ${id}`);
  return point;
}

/** Where South Korea's provinces are on the screen. */
const koreaBox = (p) =>
  p.evaluate(() => {
    const boxes = [...document.querySelectorAll('svg[aria-label="World map"] path[data-region^="kr-"]')].map((el) => el.getBoundingClientRect()).filter((b) => b.width > 0);
    return { x0: Math.min(...boxes.map((b) => b.left)), y0: Math.min(...boxes.map((b) => b.top)), x1: Math.max(...boxes.map((b) => b.right)), y1: Math.max(...boxes.map((b) => b.bottom)) };
  });

try {
  await step("orders", async () => {
    await openLeft("orders");
    await korea(big);
    await whole("orders");
    await store("01-orders");
  });

  await step("the turn's chronicle", async () => {
    await openLeft("chronicle");
    await whole("turn");
    await store("02-turn");
  });

  await step("the turn as a picture", async () => {
    await leftPanel(big).locator("button:visible", { hasText: /^Picture$/ }).first().click();
    const save = dialog(big).locator("button", { hasText: "Save PNG" });
    await save.waitFor();
    await big.waitForFunction(() => !document.querySelector("[role=dialog] button:disabled"), null, { timeout: 60_000 });
    await big.waitForTimeout(500);
    await store("03-picture");
    const [download] = await Promise.all([big.waitForEvent("download"), save.click()]);
    const file = path.join(os.tmpdir(), `gulf-of-trump-screens-${Date.now()}.png`);
    await download.saveAs(file);
    const png = readFileSync(file);
    rmSync(file);
    await compose("picture", { width: 1600, height: 900 }, `<img src="${dataUrl(png)}" width="1600" height="900">`);
    await big.keyboard.press("Escape");
    await big.waitForTimeout(400);
  });

  await step("the game as a timelapse", async () => {
    await leftPanel(big).locator("button:visible", { hasText: /^Timelapse$/ }).first().click();
    const slider = dialog(big).locator('input[type="range"]');
    await slider.waitFor();
    await big.waitForFunction(() => !document.querySelector('[role=dialog] input[type="range"]')?.disabled, null, { timeout: 60_000 });
    await slider.focus();
    await big.keyboard.press("End");
    await big.waitForTimeout(1200);
    await store("04-timelapse");
    // The film and its controls, without the dialog's title.
    const box = await dialog(big).boundingBox();
    const head = await dialog(big).locator(":scope > div").first().boundingBox();
    await big.screenshot({ path: path.join(OUT, "timelapse.jpg"), type: "jpeg", quality: QUALITY, clip: { x: box.x, y: head.y + head.height, width: box.width, height: box.y + box.height - head.y - head.height } });
    await big.keyboard.press("Escape");
    await big.waitForTimeout(400);
  });

  await step("a minister and his report", async () => {
    await openLeft("cabinet");
    for (const p of [big, sharp]) await leftPanel(p).locator("button:visible", { hasText: /Johnson/ }).first().click();
    await big.waitForTimeout(700);
    current = sharp;
    await panel("cabinet", leftPanel(sharp), leftPanel(sharp).locator("button:visible", { hasText: /Johnson/ }).first());
    current = big;
    await store("06-cabinet");
  });

  await step("parliament", async () => {
    await openLeft("politics");
    await panel("parliament", leftPanel(sharp));
    await store("08-parliament");
  });

  await step("the economy", async () => {
    await openLeft("economy");
    await panel("economy", leftPanel(sharp));
    await store("07-economy");
  });

  await step("acts of state", async () => {
    await openLeft("state");
    await leftPanel(sharp).locator("button:visible", { hasText: /^Acts/ }).first().click();
    await sharp.waitForTimeout(500);
    await panel("state", leftPanel(sharp));
  });

  await step("the maps", async () => {
    await closeLeft(big);
    await korea(big, false);
    await big.locator('button[aria-label="Resources"]').click();
    await big.waitForTimeout(1200);
    await store("05-modes");
    // Korea beside each map's legend, in the map's lower left corner.
    const map = await big.locator("svg[aria-label='World map']").boundingBox();
    const tile = { x: map.x, y: map.y + map.height - TILE.height / BIG, width: TILE.width / BIG, height: TILE.height / BIG };
    const k = await koreaBox(big);
    const from = { x: (k.x0 + k.x1) / 2, y: (k.y0 + k.y1) / 2 };
    const to = { x: tile.x + tile.width * 0.6, y: tile.y + tile.height * 0.42 };
    await big.mouse.move(from.x, from.y);
    await big.mouse.down();
    await big.mouse.move(to.x, to.y, { steps: 12 });
    await big.mouse.up();
    await big.waitForTimeout(900);
    const tiles = [];
    for (const mode of ["Resources", "Transport", "Population", "Terrain"]) {
      await big.locator(`button[aria-label="${mode}"]`).click();
      await big.waitForTimeout(1200);
      tiles.push(await big.screenshot({ type: "png", clip: tile }));
    }
    const img = (b) => `<img src="${dataUrl(b)}" width="${TILE.width}" height="${TILE.height}">`;
    await compose("modes", { width: TILE.width * 2, height: TILE.height * 2 }, `<div style="display:grid;grid-template-columns:repeat(2,${TILE.width}px)">${tiles.map(img).join("")}</div>`);
    await big.locator('button[aria-label="Political"]').click();
  });

  await step("a foreign country under fog of war", async () => {
    current = sharp;
    await closeLeft(sharp);
    await korea(sharp);
    const spot = await pointIn(sharp, "cn-liaoning");
    await sharp.mouse.click(spot.x, spot.y);
    await sharp.waitForTimeout(900);
    // China's card in two pieces on the panel's own background: its name, then what Washington knows, down to its GDP.
    const aside = sharp.locator("main > aside").last();
    const name = aside.getByRole("heading", { name: "People's Republic of China", exact: true });
    await name.evaluate((el) => el.scrollIntoView({ block: "start" }));
    await sharp.waitForTimeout(300);
    const box = await aside.boundingBox();
    const x = box.x + (box.width - PANEL.width) / 2;
    const head = await name.locator("xpath=../../..").boundingBox();
    const known = await aside.getByText("Little known", { exact: true }).boundingBox();
    const debt = await aside.getByText("Public debt", { exact: true }).first().boundingBox();
    // The card above ends just over the name, so the margin is drawn rather than cut.
    const margin = 18;
    const top = { x, y: head.y, width: PANEL.width, height: head.height + 8 };
    const rest = { x, y: known.y - 14, width: PANEL.width, height: Math.min(PANEL.height - margin - top.height, debt.y - 8 - (known.y - 14)) };
    const background = await aside.evaluate((el) => getComputedStyle(el).backgroundColor);
    const [a, b] = [await sharp.screenshot({ type: "png", clip: top }), await sharp.screenshot({ type: "png", clip: rest })];
    const size = { width: PANEL.width * 2, height: PANEL.height * 2 };
    await compose(
      "foreign",
      size,
      `<div style="width:${size.width}px;height:${size.height}px;padding-top:${margin * 2}px;box-sizing:border-box;background:${background}"><img src="${dataUrl(a)}" width="${size.width}" height="${Math.round(top.height * 2)}"><img src="${dataUrl(b)}" width="${size.width}" height="${Math.round(rest.height * 2)}"></div>`,
    );
  });

  console.log(`\nWritten to ${path.relative(ROOT, OUT)}${STORE ? ` and ${STORE}` : ""}.`);
} finally {
  await browser.close();
}

// The screenshots of the game on the demo's front page, in the README and in
// the Microsoft Store listing: one 1950 game as the United States, two turns
// into the Korean War (scripts/screens/1950-usa.gotsave), in English and the
// light theme.
//
// Runs against a production build with the offline game master, so it costs
// no plan; the status chip is shown as ChatGPT, as a player sees it:
//
//   npm run build && GOT_MOCK_AI=1 npm start
//   node scripts/screens.mjs                  (SCREENS_URL, default http://127.0.0.1:3000)
//
// It writes public/screens/1950/*.jpg, and with SCREENS_STORE=<folder> the
// Store's PNGs, 1600×1000, into that folder (desktop/store-screens/, kept out
// of git). The window is 1440×900 drawn at 1600×1000, so one side panel shows
// beside the map as on most screens; panels are cut to the panel at twice the
// pixels, so they stay sharp on phones and retina screens. On failure it
// leaves the window in screens-failure.png.
//
// The save is written and sealed by scripts/screens/make-save.ts through the
// engine: run `npx vitest run --config scripts/screens/vitest.config.mts`
// again when the game's state changes shape. It is imported through the home
// page as a player imports one, so it must be a sealed .gotsave. Needs
// Playwright with Chromium, which the project does not depend on, as
// scripts/smoke.mjs does: `npm i --no-save playwright && npx playwright
// install chromium` (SCREENS_CHROMIUM points it at another Chromium, such as
// chrome-headless-shell).

import { mkdirSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const BASE = (process.env.SCREENS_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const ROOT = path.resolve(import.meta.dirname, "..");
const SAVE = path.join(ROOT, "scripts", "screens", "1950-usa.gotsave");
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
const rightPanel = (p) => p.locator("main > aside").last();
const dialog = (p) => p.locator("[role=dialog]");

/** Nothing under the mouse or in focus: no tooltip, no lit button. */
async function still(p) {
  await p.mouse.move(8, VIEWPORT.height - 8);
  await p.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
  await p.waitForTimeout(500);
}

/** The whole big window, for the site. */
const whole = (name) => big.screenshot({ path: path.join(OUT, `${name}.jpg`), type: "jpeg", quality: QUALITY });
/** The whole big window, for the Store, as a PNG. */
const store = async (name) => {
  if (STORE) await big.screenshot({ path: path.join(STORE, `${name}.png`), type: "png" });
};

/**
 * A panel picture from an aside of the sharp window, from an element in it
 * down with a margin above it (or from the top of its content). The panels
 * share one scroller, so a panel opened after another starts where that one
 * was left unless it is scrolled.
 */
async function panel(name, aside, from, margin = 18) {
  const box = await aside.boundingBox();
  const scroller = aside.locator(":scope > div").last();
  const content = await scroller.boundingBox();
  if (from) {
    await from.evaluate((el) => el.scrollIntoView({ block: "start" }));
    await scroller.evaluate((el, by) => el.scrollBy(0, -by), margin);
  } else await scroller.evaluate((el) => el.scrollTo(0, 0));
  await sharp.waitForTimeout(250);
  const top = from ? Math.max(content.y, (await from.boundingBox()).y - margin) : content.y;
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
  const open = p.locator('nav [data-tour^="tab-"][aria-pressed="true"]');
  if (await open.count()) await open.click();
  await p.waitForTimeout(500);
}

/** The last turn's changes, Korea, in the middle of the map, and a step closer than the turn's own framing. */
async function korea(p, closer = true) {
  await p.locator("button:visible", { hasText: /Turn 2: what changed/ }).click();
  await p.waitForTimeout(900);
  if (!closer) return;
  await p.locator('button[aria-label="Zoom in"]').click();
  await still(p);
  await p.waitForTimeout(400);
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
    await still(big);
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

  await step("the cabinet and a minister's report", async () => {
    await openLeft("cabinet");
    // The eight ministries, the Secretary of Defense picked: his portrait ringed, his view of the last turn below.
    const tile = (p) => leftPanel(p).locator('button[title^="Louis A. Johnson"]');
    for (const p of [big, sharp]) {
      await tile(p).click();
      await still(p);
    }
    const grid = (p) => tile(p).locator("xpath=..");
    current = sharp;
    // A margin narrower than the gap below the leader's card.
    await panel("cabinet", leftPanel(sharp), grid(sharp), 14);
    current = big;
    await grid(big).evaluate((el) => {
      el.scrollIntoView({ block: "start" });
      el.closest(".overflow-y-auto")?.scrollBy(0, -14);
    });
    await big.waitForTimeout(300);
    await store("06-cabinet");
  });

  await step("a sitting of the House", async () => {
    await openLeft("politics");
    // The whole window, for the Store: the sitting over the game.
    await leftPanel(big).getByRole("button", { name: "Back to the sitting" }).click();
    await dialog(big).waitFor();
    await still(big);
    await store("08-parliament");
    await big.keyboard.press("Escape");
    // For the site, the sitting as on a phone, one panel wide: the motion, the government's speech and the answers to it.
    current = sharp;
    await leftPanel(sharp).getByRole("button", { name: "Back to the sitting" }).click();
    await dialog(sharp).waitFor();
    await sharp.setViewportSize({ width: PANEL.width, height: 1000 });
    // Square corners, so the sheet's top is cut like a panel's rather than showing the dimmed game in its corners.
    const square = await sharp.addStyleTag({ content: "[role=dialog]{border-radius:0!important}" });
    await sharp.waitForTimeout(900);
    await dialog(sharp)
      .locator("[class*='max-h-[48vh]']")
      .evaluate((el) => {
        const mine = [...el.children].find((row) => row.querySelector("[class*='bg-ink']"));
        el.scrollTop += mine ? mine.getBoundingClientRect().top - el.getBoundingClientRect().top - 8 : el.scrollHeight;
      });
    await still(sharp);
    const box = await dialog(sharp).boundingBox();
    await sharp.screenshot({ path: path.join(OUT, "parliament.jpg"), type: "jpeg", quality: QUALITY, clip: { x: box.x, y: box.y, width: PANEL.width, height: PANEL.height } });
    await square.evaluate((el) => el.remove());
    await sharp.keyboard.press("Escape");
    await sharp.setViewportSize(VIEWPORT);
    await sharp.waitForTimeout(900);
    current = big;
  });

  await step("the budget", async () => {
    await openLeft("economy");
    const debt = (p) => leftPanel(p).locator("section", { hasText: "Debt and reserves" }).first();
    current = sharp;
    // A margin narrower than the gap above the section, so the card above is not cut into the picture.
    await panel("economy", leftPanel(sharp), debt(sharp), 12);
    current = big;
    await debt(big).evaluate((el) => el.scrollIntoView({ block: "center" }));
    await still(big);
    await store("07-economy");
  });

  await step("the army", async () => {
    await openLeft("army");
    await still(sharp);
    await panel("army", leftPanel(sharp));
    await leftPanel(big).locator(":scope > div").last().evaluate((el) => el.scrollTo(0, 0));
    await still(big);
    await store("10-army");
  });

  await step("science", async () => {
    await openLeft("science");
    await still(sharp);
    await panel("science", leftPanel(sharp));
  });

  await step("the maps", async () => {
    await closeLeft(big);
    await korea(big, false);
    await big.locator('button[aria-label="Resources"]').click();
    await big.waitForTimeout(1200);
    await still(big);
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
      await still(big);
      tiles.push(await big.screenshot({ type: "png", clip: tile }));
    }
    const img = (b) => `<img src="${dataUrl(b)}" width="${TILE.width}" height="${TILE.height}">`;
    await compose("modes", { width: TILE.width * 2, height: TILE.height * 2 }, `<div style="display:grid;grid-template-columns:repeat(2,${TILE.width}px)">${tiles.map(img).join("")}</div>`);
    await big.locator('button[aria-label="Political"]').click();
  });

  await step("the world as Britain sees it", async () => {
    // The diplomatic map for a country picked on it: the United Kingdom, its empire, its allies and its foes, with its government beside.
    await big.locator('button[aria-label="Show the whole world"]').click();
    await big.waitForTimeout(900);
    const spot = await pointIn(big, "gb-greater-london");
    await big.mouse.click(spot.x, spot.y);
    await big.waitForTimeout(700);
    await rightPanel(big).getByRole("tab", { name: "Government", exact: true }).click();
    await big.locator('button[aria-label="Diplomacy"]').click();
    await big.waitForTimeout(1200);
    await still(big);
    await whole("diplomacy");
    await store("09-diplomacy");
    await big.locator('button[aria-label="Political"]').click();
  });

  await step("a foreign country under fog of war", async () => {
    current = sharp;
    await closeLeft(sharp);
    await korea(sharp);
    const spot = await pointIn(sharp, "cn-liaoning");
    await sharp.mouse.click(spot.x, spot.y);
    await sharp.waitForTimeout(900);
    // China's card as Washington knows it: little known, and its economy and army as ranges of estimates.
    const aside = rightPanel(sharp);
    await aside.getByRole("tab", { name: "Economy", exact: true }).click();
    await still(sharp);
    const name = aside.getByRole("heading", { name: "People's Republic of China", exact: true });
    await panel("foreign", aside, name.locator("xpath=../../.."));
  });

  console.log(`\nWritten to ${path.relative(ROOT, OUT)}${STORE ? ` and ${STORE}` : ""}.`);
} finally {
  await browser.close();
}

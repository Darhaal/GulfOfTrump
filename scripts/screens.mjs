// The screenshots of the game in the Microsoft Store listing, on the demo's
// front page and in the README: four games, each played through the engine
// by scripts/screens/make-saves.ts and saved in every language as the played
// games the site ships (public/played/<game>.<locale>.gotsave), so no
// picture shows the same war twice:
//
//   1939 Poland, two weeks into the war    the orders; the army
//   2022 Ukraine, February to November     the turn's report; the Rada; the timelapse
//   1914 Austria-Hungary, the July crisis  the budget; a turn as a picture
//   1964 United States, the Gulf of Tonkin the diplomatic map; the cabinet; the maps
//
// Runs against a production build with the offline game master, so it costs
// no plan; the status chip is shown as ChatGPT, as a player sees it:
//
//   npm run build && GOT_MOCK_AI=1 npm start
//   node scripts/screens.mjs                  (SCREENS_URL, default http://127.0.0.1:3000)
//
// With SCREENS_STORE=<folder> it writes the Store's ten PNGs per language,
// 1600×1000, into <folder>/<locale>/ (desktop/store-screens/, kept out of
// git), the interface and every word of the games in that language. The
// English run also writes the site's pictures, public/screens/*.jpg, unless
// SCREENS_SITE=0. SCREENS_LOCALES=en,ru picks the languages and
// SCREENS_ONLY=orders,army the shots. The window is 1440×900 drawn at
// 1600×1000, so one side panel shows beside the map as on most screens;
// panels for the site are cut to the panel at twice the pixels, so they stay
// sharp on phones and retina screens. On failure it leaves the window in
// screens-failure.png.
//
// Run `npm run played` again when the game's state changes shape. The saves
// are imported through the home page as a player imports one, so they must
// be sealed. Needs Playwright with
// Chromium, which the project does not depend on, as scripts/smoke.mjs does:
// `npm i --no-save playwright && npx playwright install chromium`
// (SCREENS_PLAYWRIGHT points at a Playwright installed elsewhere,
// SCREENS_CHROMIUM at another Chromium, such as chrome-headless-shell).

import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const require = createRequire(process.env.SCREENS_PLAYWRIGHT ? path.join(path.resolve(process.env.SCREENS_PLAYWRIGHT), "..", "index.js") : import.meta.url);
const { chromium } = require("playwright");

const BASE = (process.env.SCREENS_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const SAVES = path.join(ROOT, "public", "played");
const SITE = path.join(ROOT, "public", "screens");
const STORE = process.env.SCREENS_STORE ? path.resolve(process.env.SCREENS_STORE) : null;
const LOCALES = (process.env.SCREENS_LOCALES ?? "en,ru,uk").split(",").filter(Boolean);
const ONLY = process.env.SCREENS_ONLY?.split(",").filter(Boolean);
const BCP47 = { en: "en-US", ru: "ru-RU", uk: "uk-UA" };
const VIEWPORT = { width: 1440, height: 900 };
const BIG = 1600 / VIEWPORT.width;
/** JPEG quality: each picture stays well under 250 KB. */
const QUALITY = 80;
/** A panel picture: 380 CSS pixels wide (the panel) by this, at twice the pixels. */
const PANEL = { width: 380, height: 475 };
/** One map of the four in modes.jpg, in pixels. */
const TILE = { width: 450, height: 562 };

/** The interface's words in each language, read from src/i18n/messages.ts, for finding buttons by what they say. */
const MESSAGES = (() => {
  const source = readFileSync(path.join(ROOT, "src", "i18n", "messages.ts"), "utf8");
  const block = (start) => source.slice(source.indexOf(start), source.indexOf("\n}", source.indexOf(start)));
  const read = (start) => Object.fromEntries([...block(start).matchAll(/^\s*"([^"]+)":\s*("(?:[^"\\]|\\.)*"),?$/gm)].map((m) => [m[1], JSON.parse(m[2])]));
  return { en: read("const en = {"), ru: read("const ru: Messages = {"), uk: read("const uk: Messages = {") };
})();

const shoot = (name) => !ONLY || ONLY.includes(name);
const site = (locale) => locale === "en" && process.env.SCREENS_SITE !== "0";

mkdirSync(SITE, { recursive: true });

for (const locale of LOCALES) {
  /** An interface string of this run's language, with its {placeholders} filled. */
  const t = (key, vars = {}) => {
    const text = MESSAGES[locale][key];
    if (!text) throw new Error(`no message ${key} in ${locale}`);
    return text.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
  };
  const store = STORE ? path.join(STORE, locale) : null;
  if (store) mkdirSync(store, { recursive: true });
  const errors = [];
  const browser = await chromium.launch({
    ...(process.env.SCREENS_CHROMIUM ? { executablePath: process.env.SCREENS_CHROMIUM } : {}),
    // Number fields follow the browser's own language, not the page's.
    args: [`--lang=${BCP47[locale]}`],
  });

  /** A window at the given pixel ratio, in this run's language, signed in as a player sees it. */
  async function windowAt(deviceScaleFactor) {
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor, colorScheme: "light", locale: BCP47[locale], acceptDownloads: true });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(`page error: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(`console: ${m.text()}`);
    });
    page.setDefaultTimeout(30_000);
    // Not a first visit: the front page never turns into the tutorial (src/lib/tutorial.ts) under the pictures.
    await context.addInitScript(() => {
      try {
        localStorage.setItem("got_tutorial", "done");
      } catch {
        // No storage, no tutorial either.
      }
    });
    // The player's view: signed in with ChatGPT, not the offline game master the pictures are made with.
    await page.route("**/api/ai/status", (route) => route.fulfill({ json: { provider: "chatgpt", status: "connected", sharing: true, identity: { name: "Player" } } }));
    await page.goto(`${BASE}/`);
    await page.evaluate((l) => {
      localStorage.setItem("got_locale", l);
      localStorage.setItem("got_theme", "light");
      localStorage.setItem("got_tour", "done");
      // No question about anonymous statistics over the pictures, and nothing sent from them.
      localStorage.setItem("got_telemetry", "off");
    }, locale);
    return page;
  }

  /** A game opened from its save, as "Import a save" opens one. */
  async function openGame(page, game) {
    await page.goto(`${BASE}/`);
    await page.locator("input[type=file]").setInputFiles(path.join(SAVES, `${game}.${locale}.gotsave`));
    await page.waitForURL(/\/play\//);
    await page.waitForFunction(() => document.querySelectorAll("svg[aria-label='World map'] path[data-region]").length > 1000, null, { timeout: 60_000 });
    await page.waitForTimeout(800);
  }

  // Pictures of the whole window: 1440×900 drawn at 1600×1000.
  const big = await windowAt(BIG);
  // Pictures of a panel for the site: twice the pixels.
  const sharp = site(locale) ? await windowAt(2) : null;
  // Pictures put together from others.
  const desk = await browser.newPage({ deviceScaleFactor: 1 });
  let current = big;

  async function step(name, run) {
    if (!shoot(name)) return;
    const started = Date.now();
    try {
      await run();
    } catch (error) {
      await current.screenshot({ path: "screens-failure.png" }).catch(() => undefined);
      throw new Error(`${locale} ${name}: ${error.message}`);
    }
    if (errors.length) throw new Error(`${locale} ${name}:\n${errors.join("\n")}`);
    console.log(`ok  ${locale} ${name} (${Date.now() - started} ms)`);
  }

  const leftPanel = (p) => p.locator("main > aside").first();
  const rightPanel = (p) => p.locator("main > aside").last();
  const dialog = (p) => p.locator("[role=dialog]");
  const windows = () => [big, ...(sharp ? [sharp] : [])];

  /** Nothing under the mouse or in focus: no tooltip, no lit button. */
  async function still(p) {
    await p.mouse.move(8, VIEWPORT.height - 8);
    await p.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
    await p.waitForTimeout(500);
  }

  /** The whole big window, for the site. */
  const whole = async (name) => {
    if (site(locale)) await big.screenshot({ path: path.join(SITE, `${name}.jpg`), type: "jpeg", quality: QUALITY });
  };
  /** The whole big window, for the Store, as a PNG. */
  const toStore = async (name) => {
    if (store) await big.screenshot({ path: path.join(store, `${name}.png`), type: "png" });
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
    await sharp.screenshot({ path: path.join(SITE, `${name}.jpg`), type: "jpeg", quality: QUALITY, clip });
  }

  /** Pictures laid out on a blank page and taken as one JPEG of the given size. */
  async function compose(name, size, html) {
    await desk.setViewportSize(size);
    await desk.setContent(`<!doctype html><style>*{margin:0}body{width:${size.width}px;height:${size.height}px;overflow:hidden;background:#fff}img{display:block}</style>${html}`);
    await desk.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0));
    await desk.screenshot({ path: path.join(SITE, `${name}.jpg`), type: "jpeg", quality: QUALITY });
  }
  const dataUrl = (buffer, type = "image/png") => `data:${type};base64,${buffer.toString("base64")}`;

  /** Opens a left panel in the given windows. */
  async function openLeft(id, pages = windows()) {
    for (const p of pages) {
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

  /** The map `steps` closer around its middle. */
  async function zoom(p, steps) {
    for (let i = 0; i < steps; i += 1) {
      await p.locator(`button[aria-label="${t("map.zoomIn")}"]`).click();
      await p.waitForTimeout(450);
    }
    await still(p);
  }

  /** The last turn's changes in the middle of the map, `closer` steps closer than the turn's own framing. */
  async function lastTurn(p, turn, closer = 0) {
    await p.locator("button:visible", { hasText: t("map.legend.turn", { n: turn }) }).click();
    await p.waitForTimeout(900);
    await zoom(p, closer);
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

  /** Where the provinces whose ids start with one of the prefixes are on the screen. */
  const boxOf = (p, prefixes) =>
    p.evaluate((prefixes) => {
      const boxes = [...document.querySelectorAll('svg[aria-label="World map"] path[data-region]')]
        .filter((el) => prefixes.some((x) => el.getAttribute("data-region").startsWith(x)))
        .map((el) => el.getBoundingClientRect())
        .filter((b) => b.width > 0);
      return { x0: Math.min(...boxes.map((b) => b.left)), y0: Math.min(...boxes.map((b) => b.top)), x1: Math.max(...boxes.map((b) => b.right)), y1: Math.max(...boxes.map((b) => b.bottom)) };
    }, prefixes);

  /** Drags the map so a point of it comes to another point of the window. */
  async function drag(p, from, to) {
    await p.mouse.move(from.x, from.y);
    await p.mouse.down();
    await p.mouse.move(to.x, to.y, { steps: 12 });
    await p.mouse.up();
    await p.waitForTimeout(900);
  }

  /** The whole world, then `steps` closer, with the provinces of the prefixes dragged into the middle of the map (`at`: where, as shares of the map). */
  async function frame(p, prefixes, steps, at = { x: 0.5, y: 0.5 }) {
    await p.locator(`button[aria-label="${t("map.reset")}"]`).click();
    await p.waitForTimeout(900);
    await zoom(p, steps);
    const map = await p.locator("svg[aria-label='World map']").boundingBox();
    const target = { x: map.x + map.width * at.x, y: map.y + map.height * at.y };
    // In short drags from the middle, so every drag starts and ends on the map.
    for (let i = 0; i < 8; i += 1) {
      const b = await boxOf(p, prefixes);
      const dx = target.x - (b.x0 + b.x1) / 2;
      const dy = target.y - (b.y0 + b.y1) / 2;
      if (Math.hypot(dx, dy) < 12) break;
      const k = Math.min(1, 300 / Math.hypot(dx, dy));
      const from = { x: map.x + map.width / 2, y: map.y + map.height / 2 };
      await drag(p, from, { x: from.x + dx * k, y: from.y + dy * k });
    }
    await still(p);
  }

  try {
    // 1939, Poland: the orders for the third week of the war over the front, and the army in the field.
    if (shoot("orders") || shoot("army")) {
      for (const p of windows()) await openGame(p, "1939-poland");
    }
    await step("orders", async () => {
      await openLeft("orders", [big]);
      await lastTurn(big, 2, 1);
      await whole("orders");
      await toStore("01-orders");
    });
    await step("army", async () => {
      await openLeft("army");
      for (const p of windows()) {
        await leftPanel(p).locator(":scope > div").last().evaluate((el) => el.scrollTo(0, 0));
        await still(p);
      }
      if (sharp) {
        current = sharp;
        await panel("army", leftPanel(sharp));
        current = big;
      }
      // For the Store, the armies in the field and the fronts, as the Marshal reports them.
      const formations = leftPanel(big).locator("section", { hasText: t("army.formations") }).first();
      await formations.evaluate((el) => {
        el.scrollIntoView({ block: "start" });
        el.closest(".overflow-y-auto")?.scrollBy(0, -12);
      });
      await still(big);
      await toStore("06-army");
    });

    // 2022, Ukraine: the report of the turn Kherson was freed beside the front, the Rada on the budget, the year as a timelapse.
    if (shoot("turn") || shoot("parliament") || shoot("timelapse")) {
      for (const p of windows()) await openGame(p, "2022-ukraine");
    }
    await step("turn", async () => {
      await openLeft("chronicle", [big]);
      // The game opens on the player's country; a step closer, the front from Kharkiv to Kherson.
      await zoom(big, 1);
      await whole("turn");
      await toStore("02-turn");
    });
    await step("parliament", async () => {
      await openLeft("politics");
      // The whole window, for the Store: the sitting over the game.
      await leftPanel(big).getByRole("button", { name: t("politics.session.resume") }).click();
      await dialog(big).waitFor();
      await still(big);
      await toStore("05-parliament");
      await big.keyboard.press("Escape");
      await big.waitForTimeout(400);
      if (!sharp) return;
      // For the site, the sitting as on a phone, one panel wide: the motion, the government's speech and the answers to it.
      current = sharp;
      await leftPanel(sharp).getByRole("button", { name: t("politics.session.resume") }).click();
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
      await sharp.screenshot({ path: path.join(SITE, "parliament.jpg"), type: "jpeg", quality: QUALITY, clip: { x: box.x, y: box.y, width: PANEL.width, height: PANEL.height } });
      await square.evaluate((el) => el.remove());
      await sharp.keyboard.press("Escape");
      await sharp.setViewportSize(VIEWPORT);
      await sharp.waitForTimeout(900);
      current = big;
    });
    await step("timelapse", async () => {
      await openLeft("chronicle", [big]);
      await leftPanel(big).locator("button:visible", { hasText: t("timelapse.open") }).first().click();
      const slider = dialog(big).locator('input[type="range"]');
      await slider.waitFor();
      await big.waitForFunction(() => !document.querySelector('[role=dialog] input[type="range"]')?.disabled, null, { timeout: 60_000 });
      await slider.focus();
      await big.keyboard.press("End");
      await big.waitForTimeout(1200);
      await still(big);
      await toStore("10-timelapse");
      if (site(locale)) {
        // The film and its controls, without the dialog's title.
        const box = await dialog(big).boundingBox();
        const head = await dialog(big).locator(":scope > div").first().boundingBox();
        await big.screenshot({ path: path.join(SITE, "timelapse.jpg"), type: "jpeg", quality: QUALITY, clip: { x: box.x, y: head.y + head.height, width: box.width, height: box.y + box.height - head.y - head.height } });
      }
      await big.keyboard.press("Escape");
      await big.waitForTimeout(400);
    });

    // 1914, Austria-Hungary: the war budget, and the August of 1914 as a picture to share.
    if (shoot("economy") || shoot("picture")) {
      for (const p of windows()) await openGame(p, "1914-austria");
    }
    await step("economy", async () => {
      await openLeft("economy");
      const debt = (p) => leftPanel(p).locator("section", { hasText: t("econ.overview") }).first();
      if (sharp) {
        current = sharp;
        // A margin narrower than the gap above the section, so the card above is not cut into the picture.
        await panel("economy", leftPanel(sharp), debt(sharp), 12);
        current = big;
      }
      await lastTurn(big, 2, 1);
      await debt(big).evaluate((el) => el.scrollIntoView({ block: "center" }));
      await still(big);
      await toStore("07-economy");
    });
    await step("picture", async () => {
      await openLeft("chronicle", [big]);
      await leftPanel(big).locator("button:visible", { hasText: new RegExp(`^${t("share.turn")}$`) }).first().click();
      const save = dialog(big).locator("button", { hasText: t("share.download") });
      await save.waitFor();
      await big.waitForFunction(() => !document.querySelector("[role=dialog] button:disabled"), null, { timeout: 60_000 });
      await big.waitForTimeout(500);
      await still(big);
      await toStore("09-picture");
      if (site(locale)) {
        const [download] = await Promise.all([big.waitForEvent("download"), save.click()]);
        const file = path.join(os.tmpdir(), `gulf-of-trump-screens-${Date.now()}.png`);
        await download.saveAs(file);
        const png = readFileSync(file);
        rmSync(file);
        await compose("picture", { width: 1600, height: 900 }, `<img src="${dataUrl(png)}" width="1600" height="900">`);
      }
      await big.keyboard.press("Escape");
      await big.waitForTimeout(400);
    });

    // 1964, the United States: Johnson's cabinet, the maps over the Middle East, the world as Washington sees it.
    const USA = ["cabinet", "science", "modes", "diplomacy", "foreign"];
    if (USA.some(shoot)) {
      for (const p of windows()) await openGame(p, "1964-usa");
    }
    await step("cabinet", async () => {
      await openLeft("cabinet");
      // The eight departments, the Secretary of Defense picked: his portrait ringed, his view of the last turn below.
      const name = { en: "Robert McNamara", ru: "Роберт Макнамара", uk: "Роберт Макнамара" }[locale];
      const tile = (p) => leftPanel(p).locator(`button[title^="${name}"]`);
      for (const p of windows()) {
        await tile(p).click();
        await still(p);
      }
      const grid = (p) => tile(p).locator("xpath=..");
      if (sharp) {
        current = sharp;
        // A margin narrower than the gap below the leader's card.
        await panel("cabinet", leftPanel(sharp), grid(sharp), 14);
        current = big;
      }
      await grid(big).evaluate((el) => {
        el.scrollIntoView({ block: "start" });
        el.closest(".overflow-y-auto")?.scrollBy(0, -14);
      });
      // Behind the cabinet, the war it is deciding on: Indochina.
      await frame(big, ["vn-", "la-", "kh-"], 4);
      await toStore("04-cabinet");
    });
    await step("science", async () => {
      if (!sharp) return;
      current = sharp;
      await openLeft("science", [sharp]);
      await still(sharp);
      await panel("science", leftPanel(sharp));
      current = big;
    });
    await step("modes", async () => {
      // The Persian Gulf and its oil on the map, the country's resources in the ledger beside it.
      await openLeft("economy", [big]);
      await leftPanel(big).locator(`button[title="${t("econ.tab.resources")}"]`).click();
      await leftPanel(big).locator(":scope > div").last().evaluate((el) => el.scrollTo(0, 0));
      await big.waitForTimeout(500);
      await frame(big, ["iq-", "kw", "qa", "bh", "ae-"], 3);
      await big.locator(`button[aria-label="${t("map.mode.resources")}"]`).click();
      await big.waitForTimeout(1200);
      await still(big);
      await toStore("08-modes");
      if (site(locale)) {
        // The Gulf beside each map's legend, in the map's lower left corner, the map alone.
        await closeLeft(big);
        const map = await big.locator("svg[aria-label='World map']").boundingBox();
        const tile = { x: map.x, y: map.y + map.height - TILE.height / BIG, width: TILE.width / BIG, height: TILE.height / BIG };
        await frame(big, ["kw", "qa", "bh"], 3, { x: (tile.x - map.x + tile.width * 0.55) / map.width, y: (tile.y - map.y + tile.height * 0.4) / map.height });
        const tiles = [];
        for (const mode of ["resources", "transport", "population", "terrain"]) {
          await big.locator(`button[aria-label="${t(`map.mode.${mode}`)}"]`).click();
          await big.waitForTimeout(1200);
          await still(big);
          tiles.push(await big.screenshot({ type: "png", clip: tile }));
        }
        const img = (b) => `<img src="${dataUrl(b)}" width="${TILE.width}" height="${TILE.height}">`;
        await compose("modes", { width: TILE.width * 2, height: TILE.height * 2 }, `<div style="display:grid;grid-template-columns:repeat(2,${TILE.width}px)">${tiles.map(img).join("")}</div>`);
      }
      await big.locator(`button[aria-label="${t("map.mode.political")}"]`).click();
    });
    await step("diplomacy", async () => {
      // The diplomatic map for the United States, its government beside: allies on every continent, enemies in Vietnam.
      await closeLeft(big);
      await big.locator(`button[aria-label="${t("map.reset")}"]`).click();
      await big.waitForTimeout(900);
      const spot = await pointIn(big, "us-kansas");
      await big.mouse.click(spot.x, spot.y);
      await big.waitForTimeout(700);
      await rightPanel(big).getByRole("tab", { name: t("country.section.power"), exact: true }).click();
      await big.locator(`button[aria-label="${t("map.mode.diplomacy")}"]`).click();
      await big.waitForTimeout(1200);
      await still(big);
      await whole("diplomacy");
      await toStore("03-diplomacy");
      await big.locator(`button[aria-label="${t("map.mode.political")}"]`).click();
    });
    await step("foreign", async () => {
      if (!sharp) return;
      // North Vietnam as Washington knows it: little known, its economy and army as ranges of estimates.
      current = sharp;
      await closeLeft(sharp);
      await frame(sharp, ["vn-"], 3);
      const spot = await pointIn(sharp, "vn-ong-bang-song-hong");
      await sharp.mouse.click(spot.x, spot.y);
      await sharp.waitForTimeout(900);
      const aside = rightPanel(sharp);
      await aside.getByRole("tab", { name: t("country.section.economy"), exact: true }).click();
      await still(sharp);
      const heading = aside.getByRole("heading").first();
      await panel("foreign", aside, heading.locator("xpath=../../.."));
      current = big;
    });

    console.log(`\nWritten${store ? ` to ${store}` : ""}${site(locale) ? ` and ${path.relative(ROOT, SITE)}` : ""}.`);
  } finally {
    await browser.close();
  }
}

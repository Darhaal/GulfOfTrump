// An interface smoke test: the pages open, a game starts, a turn plays, the
// panels and dialogs open — with no error on the page or in its console.
//
// Runs against a server that is already up with the offline game master,
// so it costs no plan:
//
//   npm run build && GOT_MOCK_AI=1 npm start
//   node scripts/smoke.mjs                 (SMOKE_URL, default http://127.0.0.1:3000)
//
// Needs Playwright with Chromium, which the project does not depend on:
// `npm i --no-save playwright && npx playwright install chromium` (CI does
// this in .github/workflows/smoke.yml). On failure it leaves a screenshot of
// the page in smoke-failure.png.

import { chromium } from "playwright";

const BASE = (process.env.SMOKE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const SCENARIO = "2022";
const COUNTRY = "Ukraine";

const errors = [];
const browser = await chromium.launch(process.env.SMOKE_CHROMIUM ? { executablePath: process.env.SMOKE_CHROMIUM } : {});
// Wide enough (2xl) for the left panels and the right column to show together.
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on("pageerror", (e) => errors.push(`page error: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text()}`);
});
page.setDefaultTimeout(30_000);

async function step(name, run) {
  const started = Date.now();
  try {
    await run();
  } catch (error) {
    await page.screenshot({ path: "smoke-failure.png" }).catch(() => undefined);
    throw new Error(`${name}: ${error.message}`);
  }
  if (errors.length) {
    await page.screenshot({ path: "smoke-failure.png" }).catch(() => undefined);
    throw new Error(`${name}:\n${errors.join("\n")}`);
  }
  console.log(`ok  ${name} (${Date.now() - started} ms)`);
}

const button = (text) => page.locator("button:visible", { hasText: text });
const dialog = () => page.locator("[role=dialog]");
const mapDrawn = () => page.waitForFunction(() => document.querySelectorAll("svg[aria-label='World map'] path[data-region]").length > 1000, null, { timeout: 60_000 });

try {
  await step("the front page opens in English", async () => {
    await page.goto(`${BASE}/`);
    await page.evaluate(() => localStorage.setItem("got_locale", "en"));
    await page.reload();
    await page.locator("a[href^='/new/']").first().waitFor();
  });

  await step(`a new game as ${COUNTRY} in ${SCENARIO}`, async () => {
    await page.goto(`${BASE}/new/${SCENARIO}`);
    await mapDrawn();
    await button(new RegExp(`^${COUNTRY}`)).first().click();
    await button(`Start as ${COUNTRY}`).click();
    await page.waitForURL(/\/play\//);
    await mapDrawn();
  });

  await step("the first-run tour shows and can be skipped", async () => {
    await button("Skip the tour").click();
    await page.getByText("Skip the tour").waitFor({ state: "detached" });
  });

  await step("an order is written and the turn plays", async () => {
    await page.locator("textarea").first().fill("Hold the line and ask the allies for air defence");
    await button("Add order").click();
    await button(/^End turn$/).first().click();
    await dialog().getByText("Turn report").waitFor();
    await dialog().getByText("[mock]").first().waitFor();
    await dialog().locator("button", { hasText: "Back to the map" }).click();
  });

  for (const tab of ["Chronicle", "Cabinet", "Politics", "State", "Foreign policy", "Economy", "Orders", "Diplomacy", "Country"]) {
    await step(`the ${tab} panel opens`, async () => {
      await button(new RegExp(`^${tab}$`)).first().click();
      await page.waitForTimeout(300);
    });
  }

  await step("a turn becomes a picture", async () => {
    await button(/^Chronicle$/).first().click();
    await button(/^Picture$/).first().click();
    await dialog().locator("button", { hasText: "Save PNG" }).and(page.locator(":enabled")).waitFor();
    await page.keyboard.press("Escape");
  });

  await step("the timelapse plays", async () => {
    await button(/^Timelapse$/).first().click();
    await dialog().locator("input[type=range]:enabled").waitFor();
    await dialog().locator("button[aria-label='Play']").click();
    // Playing, then back to the play button once the last turn is reached.
    await dialog().locator("button[aria-label='Pause']").waitFor();
    await dialog().locator("button[aria-label='Play']").waitFor();
    await page.keyboard.press("Escape");
  });

  // Every date starts with its first featured country and plays a turn.
  for (const date of ["1914", "1939", "1950", "1964", "1991", "1999", "2014", "2022"]) {
    await step(`a turn is played on ${date}`, async () => {
      await page.goto(`${BASE}/new/${date}`);
      await mapDrawn();
      await button(/^Start as /).first().click();
      await page.waitForURL(/\/play\//);
      await mapDrawn();
      await button(/^End turn$/).first().click();
      await dialog().getByText("Turn report").waitFor();
      await dialog().locator("button", { hasText: "Back to the map" }).click();
    });
  }

  await step("the game opens on a phone", async () => {
    const game = page.url();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(game);
    await mapDrawn();
    await button(/^End turn$/).first().waitFor();
    await page.setViewportSize({ width: 1600, height: 900 });
  });

  await step("the settings and about pages open", async () => {
    await page.goto(`${BASE}/settings`);
    await page.getByText("Sign in with ChatGPT").or(page.getByText("Offline mock")).first().waitFor();
    await page.goto(`${BASE}/about`);
    await page.locator("main").first().waitFor();
  });

  console.log("smoke test passed");
} catch (error) {
  console.error(`FAILED ${error.message}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}

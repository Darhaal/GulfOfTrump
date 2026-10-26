// An interface smoke test: a first visit opens the tutorial, its written turn
// plays and it can be skipped and started again; the pages open, a game starts, a turn plays, the
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
// The smoke test never sends anonymous statistics (src/lib/telemetry).
page.on("request", (r) => {
  if (r.url().includes("/rest/v1/telemetry_events")) errors.push(`telemetry sent: ${r.url()}`);
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

// English from the first page on, and anonymous statistics declined, so their question never
// covers the page (a build without Supabase, as in CI, does not ask at all). Nothing else is
// stored before the first visit: it is a new player's.
await page.addInitScript(() => {
  localStorage.setItem("got_locale", "en");
  localStorage.setItem("got_telemetry", "off");
});
const guide = (title) => page.locator("[role=dialog]", { hasText: title });

try {
  await step("a first visit opens the tutorial as Ukraine, its guide on the briefing", async () => {
    await page.goto(`${BASE}/`);
    await page.waitForURL(/\/play\//);
    await mapDrawn();
    await guide("You lead Ukraine").waitFor();
    await button(/^Begin$/).click();
    await guide("The map").waitFor();
    await button(/^Next$/).click();
  });

  await step("the tutorial's first order is offered, added, and its written turn plays", async () => {
    await guide("Your first order").waitFor();
    await button(/^Use this$/).click();
    await page.locator("[data-tour='orders-input'] textarea").first().waitFor();
    await button("Add order").click();
    await guide("End the turn").waitFor();
    await button(/^End turn$/).first().click();
    await dialog().getByText("Turn report").waitFor();
    // Written in advance: no game master was asked.
    await dialog().getByText("Kyiv holds the first week").first().waitFor();
    await guide("The report").waitFor();
    await dialog().locator("button", { hasText: "Back to the game" }).click();
    await guide("The front moved").waitFor();
  });

  await step("the tutorial is skipped to the front page, which then stays", async () => {
    await button(/^Skip tutorial$/).click();
    await page.waitForURL(`${BASE}/`);
    await page.locator("a[href^='/new/']").first().waitFor();
    await page.reload();
    await page.locator("a[href^='/new/']").first().waitFor();
    await page.waitForTimeout(1500);
    if (new URL(page.url()).pathname !== "/") throw new Error(`the front page went to ${page.url()}`);
  });

  await step("the tutorial starts again from the 2022 card", async () => {
    await page.locator("button[data-start='tutorial']").click();
    await page.locator("a[href='/new/2022/tutorial']").last().click();
    await page.waitForURL(/\/play\//);
    await mapDrawn();
    await guide("You lead Ukraine").waitFor();
    await button(/^Skip tutorial$/).click();
    await page.waitForURL(`${BASE}/`);
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
    // The tour's close button is an icon, named by its label.
    const skip = page.getByRole("button", { name: "Skip the tour" });
    await skip.click();
    await skip.waitFor({ state: "detached" });
  });

  await step("an order is written and the turn plays", async () => {
    await page.locator("textarea").first().fill("Hold the line and ask the allies for air defence");
    await button("Add order").click();
    await button(/^End turn$/).first().click();
    await dialog().getByText("Turn report").waitFor();
    await dialog().getByText("This is the demo", { exact: false }).first().waitFor();
    await dialog().locator("button", { hasText: "Back to the game" }).click();
  });

  // The rail's tabs, by their tour ids: the names wrap ("Domestic politics") and change with the language.
  for (const tab of ["chronicle", "cabinet", "politics", "foreign", "economy", "army", "science", "orders"]) {
    await step(`the ${tab} panel opens`, async () => {
      const button = page.locator(`[data-tour="tab-${tab}"]`).first();
      await button.click();
      await page.waitForFunction((id) => document.querySelector(`[data-tour="tab-${id}"]`)?.getAttribute("aria-pressed") === "true", tab);
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

  await step("the world news opens, and an item opens on its story", async () => {
    await button(/^The world$/).first().click();
    // The offline game master reports one event abroad each turn, so there is always an item to open.
    await page.locator("li button[aria-expanded]").first().click();
    await page.locator("li ol li").first().waitFor();
    await button(/^Our chronicle$/).first().click();
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
      await dialog().locator("button", { hasText: "Back to the game" }).click();
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

  await step("a played game opens from the front page and plays on", async () => {
    await page.goto(`${BASE}/`);
    await button(/^Ukraine · 2022$/).click();
    await page.waitForURL(/\/play\//);
    await mapDrawn();
    await page.locator("header").getByText("Unbroken").first().waitFor();
    await button(/^End turn$/).first().click();
    await dialog().getByText("Turn report").waitFor();
    await dialog().locator("button", { hasText: "Back to the game" }).click();
  });

  await step("the settings and about pages open", async () => {
    await page.goto(`${BASE}/settings`);
    await page.getByText("Sign in with ChatGPT").or(page.getByText("Offline mock")).first().waitFor();
    await page.getByText("Anonymous statistics").first().waitFor();
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

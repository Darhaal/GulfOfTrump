export const APP_NAME = "Gulf of Trump";
export const APP_VERSION = "1.0.7";
export const APP_STAGE = "beta";
export const REPO_URL = "https://github.com/Darhaal/GulfOfTrump";
/** The public demo site, the address its sitemap and robots.txt give search engines. */
export const SITE_URL = "https://gulfoftrump.vercel.app";
export const ISSUES_URL = `${REPO_URL}/issues/new/choose`;
/** Reporting the game master's text (Microsoft Store policy 11.16). */
export const CONTENT_REPORT_URL = `${REPO_URL}/issues/new?template=content.yml`;
/**
 * The public demo: the offline game master only, ChatGPT sign-in switched
 * off, and the routes open to any host since they spend nobody's plan. On
 * with NEXT_PUBLIC_GOT_DEMO=1, and always on Vercel (VERCEL on the server,
 * NEXT_PUBLIC_VERCEL_ENV in the browser), since OpenAI's terms rule out
 * hosted play. Read at call time so the server sees the environment it runs
 * in; the browser gets it inlined at build.
 */
export const isDemo = () => process.env.NEXT_PUBLIC_GOT_DEMO === "1" || process.env.VERCEL === "1" || Boolean(process.env.NEXT_PUBLIC_VERCEL_ENV);

/**
 * The header a browser sends when its player chose the offline demo
 * (Settings → Game master): the server answers that request from the
 * stand-in game master and never touches the ChatGPT sign-in.
 */
export const DEMO_HEADER = "x-got-demo";

/** The desktop app (Electron) shows the game in its own window; sign-in then opens the system browser. */
export const isDesktopApp = () => typeof navigator !== "undefined" && /\bElectron\//.test(navigator.userAgent);

export const DOWNLOAD_URL = `${REPO_URL}/releases/latest`;
/** The game's page in the Microsoft Store: the same app, signed by Microsoft and updated by the Store. */
export const STORE_URL = "https://apps.microsoft.com/detail/9n07jx2chmw0";
/** The game's page on itch.io, with the same Windows installer. */
export const ITCH_URL = "https://darhaal.itch.io/gulf-of-trump";
/** The code's licence, for the site's structured data. */
export const LICENSE_URL = "https://www.gnu.org/licenses/agpl-3.0.html";
/**
 * Search engines' proof that the demo site is ours, from their webmaster
 * tools: Google's is fixed, Yandex's and Bing's are set on the host
 * (NEXT_PUBLIC_YANDEX_VERIFICATION, NEXT_PUBLIC_BING_VERIFICATION) and read at
 * build. An empty one adds no tag. docs/seo.md says where each comes from.
 */
export const SITE_VERIFICATION = {
  google: "Uf2dB5O6FWcwR6d-kSoT59ECv9t65HY8yGvp3sji8ZE",
  yandex: () => process.env.NEXT_PUBLIC_YANDEX_VERIFICATION?.trim() ?? "",
  bing: () => process.env.NEXT_PUBLIC_BING_VERIFICATION?.trim() ?? "",
};
export const CHATGPT_USAGE_URL = "https://chatgpt.com/settings/usage";
/** Orders the player may give in one turn; the server enforces the same cap (server/requests.ts). Raised from 12 (Artem, 5 November). */
export const MAX_ORDERS = 20;
/** Past this many orders the panel says that each more makes the turn longer to write: the game master answers every one. */
export const LONG_ORDERS = 12;

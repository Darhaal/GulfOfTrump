export const APP_NAME = "Gulf of Trump";
export const APP_VERSION = "1.0.1";
export const APP_STAGE = "beta";
export const REPO_URL = "https://github.com/Darhaal/GulfOfTrump";
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

/** The desktop app (Electron) shows the game in its own window; sign-in then opens the system browser. */
export const isDesktopApp = () => typeof navigator !== "undefined" && /\bElectron\//.test(navigator.userAgent);

export const DOWNLOAD_URL = `${REPO_URL}/releases/latest`;
export const CHATGPT_USAGE_URL = "https://chatgpt.com/settings/usage";
/** Orders the player may give in one turn; the server enforces the same cap. */
export const MAX_ORDERS = 12;

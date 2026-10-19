export const APP_NAME = "Gulf of Trump";
export const APP_VERSION = "1.0.0";
export const APP_STAGE = "beta";
export const REPO_URL = "https://github.com/Darhaal/GulfOfTrump";
export const ISSUES_URL = `${REPO_URL}/issues/new/choose`;
/**
 * The public demo (NEXT_PUBLIC_GOT_DEMO=1, as on the Vercel site): the
 * offline game master only, ChatGPT sign-in switched off, and the routes open
 * to any host since they spend nobody's plan. Read at call time so the server
 * sees the environment it runs in; the browser gets it inlined at build.
 */
export const isDemo = () => process.env.NEXT_PUBLIC_GOT_DEMO === "1";
export const CHATGPT_USAGE_URL = "https://chatgpt.com/settings/usage";
/** Orders the player may give in one turn; the server enforces the same cap. */
export const MAX_ORDERS = 12;

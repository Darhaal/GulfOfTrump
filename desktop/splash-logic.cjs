// What the loading screen works out, apart from Electron so the tests can
// reach it (tests/splash.test.ts): how far the start has come, how long the
// next one will take, and which quotes to show without repeating any until
// all have been seen.

const path = require("node:path");

/** Until a start has been timed, the server is expected to answer in this long. */
const FIRST_GUESS_MS = 8000;

/** The bar's share at the end of each quick phase; the wait for the server fills the rest up to WAIT_END. */
const PORT_END = 0.04;
const SERVER_END = 0.12;
const WAIT_END = 0.94;

/**
 * The bar's share, 0–1, for a phase of the start. While the server gets
 * ready, the bar runs at an even pace to 90% of its stretch by the time the
 * last start took, then creeps on and never quite stops, so a slower start
 * still shows movement. Opening the game takes it to the end.
 */
function startupProgress(phase, elapsedMs, expectedMs) {
  if (phase === "port") return PORT_END / 2;
  if (phase === "server") return PORT_END + (SERVER_END - PORT_END) * Math.min(1, Math.max(0, elapsedMs) / 1500);
  if (phase === "opening") return WAIT_END + (1 - WAIT_END) * Math.min(0.9, Math.max(0, elapsedMs) / 2000);
  if (phase === "done") return 1;
  const t = Math.max(0, elapsedMs) / Math.max(1000, expectedMs || FIRST_GUESS_MS);
  const share = t < 1 ? 0.9 * t : 0.9 + 0.1 * (1 - Math.exp(-(t - 1) * 1.5));
  return SERVER_END + (WAIT_END - SERVER_END) * share;
}

/** How long the next start's wait is expected to take: the past weighs more than one start, so a single slow one does not swing it. */
function nextEstimate(previousMs, actualMs) {
  const actual = Math.min(120_000, Math.max(500, actualMs));
  const next = previousMs > 0 ? previousMs * 0.6 + actual * 0.4 : actual;
  return Math.round(next);
}

/**
 * The next `count` quotes to show and the updated list of those already
 * seen: a random one of the unseen each time; once every quote has been
 * seen, the round starts again.
 */
function pickQuotes(ids, seen, count, random = Math.random) {
  const known = new Set(ids);
  let seenNow = (seen ?? []).filter((id) => known.has(id));
  const picked = [];
  while (picked.length < Math.min(count, ids.length)) {
    let fresh = ids.filter((id) => !seenNow.includes(id) && !picked.includes(id));
    if (!fresh.length) {
      seenNow = [];
      fresh = ids.filter((id) => !picked.includes(id));
    }
    const id = fresh[Math.min(fresh.length - 1, Math.floor(random() * fresh.length))];
    picked.push(id);
    seenNow.push(id);
  }
  return { picked, seen: seenNow };
}

/** The interface language for the system's: Ukrainian, Russian (and Belarusian), else English. */
function localeOf(systemLocale) {
  const lang = String(systemLocale ?? "").slice(0, 2).toLowerCase();
  return lang === "uk" ? "uk" : lang === "ru" || lang === "be" ? "ru" : "en";
}

/** A language's quotes and tips, as `npm run quotes` writes them for the game: public/quotes/<locale>.json. */
function linesFile(publicDir, locale) {
  return path.join(publicDir, "quotes", `${locale}.json`);
}

/** A file of the public folder by the path the page would load it by ("/portraits/x.webp"); never one outside it. */
function publicFile(publicDir, webPath) {
  const parts = String(webPath ?? "").split("/").filter((part) => part && part !== "." && part !== "..");
  return parts.length ? path.join(publicDir, ...parts) : null;
}

/** How long a line stays: ten seconds and half a second a word, at most forty (src/lib/quotes.ts readMs, the same). */
function readMs(text) {
  const words = String(text ?? "").trim().split(/\s+/).filter(Boolean).length;
  return Math.min(40_000, 10_000 + words * 500);
}

/** Two lists by turns, a first, then b, then a…; whichever is longer runs on at the end. */
function interleave(a, b) {
  const out = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (i < a.length) out.push(a[i]);
    if (i < b.length) out.push(b[i]);
  }
  return out;
}

module.exports = { FIRST_GUESS_MS, startupProgress, nextEstimate, pickQuotes, localeOf, linesFile, publicFile, interleave, readMs };

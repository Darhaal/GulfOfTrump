/**
 * The quotes and tips of the waiting screens.
 *
 *   npm run quotes                       the per-language files the game loads and the credits
 *   npm run quotes -- --check            every quote taken from Wikiquote found again on its page
 *   npm run quotes -- --candidates en:"Mark Twain" ru:"Антон Павлович Чехов"
 *                                        a page's short sourced quotes, to choose new ones from
 *
 * public/quotes.json holds every quote in Russian, Ukrainian and English with
 * its speaker, source and date; public/tips.json the author's tips. The game
 * fetches only its language: public/quotes/<locale>.json, written here, holds
 * that language's lines, the year as the caption shows it and the portrait
 * (the speaker's oil portrait, or a shadow of their era where no free picture
 * exists). public/quotes/credits.json names the Wikiquote page (CC BY-SA)
 * each quote was taken from; the About page lists them.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildCredits, buildLocale, LOCALES } from "./quotes/build.mjs";
import { fetchPage, findOnPage, loose, quotesOf } from "./quotes/wikiquote.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const CACHE = path.join(ROOT, "scripts/.cache/wikiquote");
const read = (file) => JSON.parse(readFileSync(path.join(ROOT, file), "utf8"));

/** Who speaks: the game's people and the quoted writers and thinkers, by id. */
function speakers() {
  const out = new Map();
  for (const p of read("scripts/portraits/people.json")) out.set(p.id, p);
  for (const p of read("scripts/portraits/quoted.json")) out.set(p.id, p);
  return out;
}

const KEYWORDS =
  /war|peace|power|state|king|govern|politic|law|nation|people|history|freedom|liberty|truth|lie|fool|wise|money|army|soldier|enemy|victory|defeat|revolution|tyrant|rule|vote|parliament|minister|crowd|courage|fear|justice|vlast|войн|мир[ауео ]|власт|государ|царь|закон|народ|истори|свобод|правд|ложь|дурак|глуп|умн|деньг|арми|солдат|враг|побед|револю|тиран|страх|справедлив|вій|влад|держав|цар|закон|народ|істор|свобод|правд|брех|дурн|розум|гроші|військ|ворог|перемог|страх/i;

async function candidates(refs) {
  for (const ref of refs) {
    const page = await fetchPage(ref, CACHE);
    if (page.missing) {
      console.log(`## ${ref}: missing`);
      continue;
    }
    const all = quotesOf(page, { surname: page.title.split(/[ ,]/).filter(Boolean).at(-1) });
    const short = all.filter((q) => q.text.length >= 15 && q.text.length <= 240);
    short.sort((a, b) => Number(KEYWORDS.test(b.text)) - Number(KEYWORDS.test(a.text)) || a.text.length - b.text.length);
    console.log(`## ${ref} → ${page.title}: ${all.length} quotes, ${short.length} short`);
    for (const [i, q] of short.slice(0, Number(process.env.LIMIT ?? 40)).entries()) {
      const sub = q.sub.slice(0, 2).map((s) => s.slice(0, 160)).join(" || ");
      const src = [q.source, q.note].filter(Boolean).join(" / ").slice(0, 140);
      console.log(`${i + 1}. [${q.section.slice(0, 50)}] ${q.text}${q.original ? ` {orig: ${q.original.slice(0, 120)}}` : ""}${src || sub ? `\n   = ${src}${sub ? ` || ${sub}` : ""}` : ""}`);
    }
  }
}

/** Every quote that names a Wikiquote page is found again there, in a sourced section, in the page's language. */
async function check() {
  const quotes = read("public/quotes.json");
  let missing = 0;
  for (const q of quotes.filter((x) => x.wikiquote)) {
    const page = await fetchPage(q.wikiquote, CACHE);
    const lang = q.wikiquote.slice(0, 2);
    const text = q.original ?? q.text[lang];
    const found = page.missing ? null : findOnPage(quotesOf(page, { surname: page.title.split(/[ ,]/).filter(Boolean).at(-1) }), text);
    if (!found) {
      missing++;
      console.log(`not found: ${q.id} (${q.wikiquote}): ${loose(text).slice(0, 90)}`);
    }
  }
  console.log(`checked ${quotes.filter((x) => x.wikiquote).length}, not found ${missing}`);
  if (missing) process.exitCode = 1;
}

function build() {
  const quotes = read("public/quotes.json");
  const tips = read("public/tips.json");
  const people = speakers();
  const painted = (id) => existsSync(path.join(ROOT, "public/portraits", `${id}.webp`));
  mkdirSync(path.join(ROOT, "public/quotes"), { recursive: true });
  for (const locale of LOCALES) {
    const lines = buildLocale(quotes, tips, locale, { people, painted });
    writeFileSync(path.join(ROOT, "public/quotes", `${locale}.json`), JSON.stringify(lines) + "\n");
  }
  writeFileSync(path.join(ROOT, "public/quotes/credits.json"), JSON.stringify(buildCredits(quotes), null, 1) + "\n");
  console.log(`quotes ${quotes.length}, tips ${tips.length}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args[0] === "--candidates") await candidates(args.slice(1));
  else if (args[0] === "--check") await check();
  else build();
}

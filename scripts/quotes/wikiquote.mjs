/**
 * Wikiquote pages for the quotes of the waiting screens: fetched through the
 * MediaWiki API (cached in scripts/.cache/wikiquote), cut into sections and
 * quotes, with the sections that are not the author's sourced words left out
 * (disputed, misattributed, attributed, quotes about the author, and the
 * like). Wikiquote's text is CC BY-SA; public/quotes/credits.json names each
 * page a quote was taken from.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const UA = "GulfOfTrump-quotes/1.0 (https://github.com/Darhaal/GulfOfTrump; artem@okhtengroup.com)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** "en:Mark Twain" → { lang: "en", title: "Mark Twain" }. */
export function pageRef(ref) {
  const m = /^(en|ru|uk):(.+)$/.exec(ref);
  if (!m) throw new Error(`not a Wikiquote page: ${ref}`);
  return { lang: m[1], title: m[2] };
}

/** The page's address on Wikiquote. */
export const pageUrl = (ref) => {
  const { lang, title } = pageRef(ref);
  return `https://${lang}.wikiquote.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
};

/** A page's wikitext and its title after redirects, from the cache or the API (one request a second at most). */
export async function fetchPage(ref, cacheDir) {
  const { lang, title } = pageRef(ref);
  const dir = path.join(cacheDir, lang);
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${title.replace(/[\\/:*?"<>|]/g, "_")}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
  const url = `https://${lang}.wikiquote.org/w/api.php?action=query&prop=revisions&rvprop=content|ids&rvslots=main&format=json&formatversion=2&redirects=1&titles=${encodeURIComponent(title)}`;
  for (let i = 0; i < 4; i++) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.ok) {
      const j = await res.json();
      const page = j.query?.pages?.[0];
      const out = page?.missing || !page?.revisions ? { ref, title, missing: true } : { ref, title: page.title, revid: page.revisions[0].revid, text: page.revisions[0].slots.main.content };
      writeFileSync(file, JSON.stringify(out));
      await sleep(1000);
      return out;
    }
    await sleep(3000 * (i + 1));
  }
  throw new Error(`could not fetch ${ref}`);
}

// --- wikitext ---

/** The template calls at the top level of a text, with their name and fields (positional ones by number from 1). */
function templates(text) {
  const out = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "{" || text[i + 1] !== "{") continue;
    let depth = 0;
    let j = i;
    for (; j < text.length - 1; j++) {
      if (text[j] === "{" && text[j + 1] === "{") {
        depth++;
        j++;
      } else if (text[j] === "}" && text[j + 1] === "}") {
        depth--;
        j++;
        if (depth === 0) break;
      }
    }
    const body = text.slice(i + 2, j - 1);
    out.push({ start: i, end: j + 1, ...splitTemplate(body) });
    i = j;
  }
  return out;
}

function splitTemplate(body) {
  const parts = [];
  let depth = 0;
  let link = 0;
  let cur = "";
  for (let i = 0; i < body.length; i++) {
    const two = body.slice(i, i + 2);
    if (two === "{{") depth++;
    if (two === "}}") depth--;
    if (two === "[[") link++;
    if (two === "]]") link--;
    if (body[i] === "|" && depth === 0 && link === 0) {
      parts.push(cur);
      cur = "";
      continue;
    }
    cur += body[i];
  }
  parts.push(cur);
  const name = parts.shift().trim();
  const fields = {};
  let n = 1;
  for (const p of parts) {
    const m = /^\s*([^=\s][^=]*?)\s*=([\s\S]*)$/.exec(p);
    if (m && !/^\d+$/.test(m[1]) && m[1].length < 30) fields[m[1].toLowerCase()] = m[2].trim();
    else if (m && /^\d+$/.test(m[1])) fields[m[1]] = m[2].trim();
    else fields[String(n++)] = p.trim();
  }
  return { name, fields };
}

/** Wikitext as plain text: links, bold and italics, templates, refs and tags gone. */
export function plain(s) {
  let t = String(s ?? "");
  t = t.replace(/<ref[^>]*\/>/g, "").replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, "");
  t = t.replace(/<!--[\s\S]*?-->/g, "");
  t = t.replace(/<br\s*\/?>/gi, " ");
  // Simple templates that wrap words: {{w|X}}, {{lang|fr|X}}, {{нп|X}}…
  for (let k = 0; k < 4; k++) {
    t = t.replace(/\{\{\s*(?:w|wp|lang|lang-\w+|nowrap|нп\d?|начало цитаты|конец цитаты|comment|sic)\s*\|([^{}]*)\}\}/gi, (_, inner) => {
      const parts = inner.split("|");
      return parts.length > 1 && /^[a-z]{2,3}$/.test(parts[0]) ? parts[1] : parts[0];
    });
    t = t.replace(/\{\{[^{}]*\}\}/g, "");
  }
  t = t.replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1");
  t = t.replace(/\[https?:\/\/[^\s\]]+\s*([^\]]*)\]/g, "$1");
  t = t.replace(/'''''|'''|''/g, "");
  t = t.replace(/<[^>]+>/g, "");
  t = t.replace(/&nbsp;/g, " ").replace(/&mdash;/g, "—").replace(/&ndash;/g, "–").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&hellip;/g, "…");
  return t.replace(/\s+/g, " ").trim();
}

/** The sources inside <ref> tags of a line, as plain text. */
const refsOf = (s) => [...String(s).matchAll(/<ref[^>/]*>([\s\S]*?)<\/ref>/g)].map((m) => plain(m[1])).filter(Boolean);

/**
 * Sections that hold no sourced words of the page's author: disputed,
 * misattributed, attributed or unsourced lines, words about them, and the
 * page's apparatus.
 */
const SKIP = [
  /disputed|misattribut|attributed|attribution|unsourced|unverified|doubtful|apocryph/i,
  /quot(e|es|ation|ations) (about|on|regarding)\b|about (him|her)|sayings about|^about\b|criticism|tributes|obituar/i,
  /see also|external links|references|sources|notes|further reading|bibliography|category/i,
  /приписыва|сомнительн|ошибочно|неподтвержд|спорн|непроверен/i,
  /^(цитаты|высказывания|статьи|отзывы|афоризмы|стихи)\s+(о|об|про)\s|о нём|о ней|^об авторе|^отзывы|^критика/i,
  /см\.? также|^ссылки|^примечания|^литература|^источники/i,
  /приписув|сумнівн|помилково|непідтвердж|неперевірен/i,
  /^(цитати|висловлювання|вислови|статті|відгуки)\s+(про|о)\s|про нього|про неї|^відгуки|^про автора/i,
  /див\.? також|^посилання|^примітки|^література|^джерела/i,
];

/** A heading about the author by name: "О Толстом", "Про Шевченка", "Quotes about Twain". */
function aboutAuthor(heading, surname) {
  if (!surname) return false;
  const stem = surname.toLowerCase().slice(0, Math.max(4, surname.length - 2));
  return /^(о|об|про|about)\s/i.test(heading) && heading.toLowerCase().includes(stem);
}

/**
 * The page's quotes in its sourced sections: each with the path of headings
 * it stands under, its text, and what the page says of its source (the lines
 * under it, a ref, a template's source field).
 */
export function quotesOf(page, { surname } = {}) {
  if (!page?.text) return [];
  const out = [];
  const heads = [];
  let skipping = false;
  let skipLevel = 0;
  const lines = page.text.split("\n");
  let current = null;
  const push = () => {
    if (current && current.text.length >= 8) out.push(current);
    current = null;
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const h = /^(={2,6})\s*(.*?)\s*\1\s*$/.exec(line);
    if (h) {
      push();
      const level = h[1].length;
      const heading = plain(h[2]);
      while (heads.length && heads[heads.length - 1].level >= level) heads.pop();
      heads.push({ level, heading });
      if (skipping && level <= skipLevel) skipping = false;
      if (!skipping && (SKIP.some((re) => re.test(heading)) || aboutAuthor(heading, surname))) {
        skipping = true;
        skipLevel = level;
      }
      continue;
    }
    if (skipping) continue;
    // {{Q|text|Автор=…|Комментарий=…|Источник=…}} (ru, uk) on a line of its own or after a bullet.
    if (/^\s*[*#:]?\s*\{\{\s*(Q|Цитата|quote)\s*\|/i.test(line)) {
      push();
      // The template may run over several lines.
      let block = line;
      let j = i;
      const balanced = (s) => (s.match(/\{\{/g) ?? []).length <= (s.match(/\}\}/g) ?? []).length;
      while (!balanced(block) && j + 1 < lines.length) block += "\n" + lines[++j];
      i = j;
      const t = templates(block).find((x) => /^(q|цитата|quote)$/i.test(x.name));
      if (t) {
        const f = t.fields;
        const text = plain(f["1"] ?? f["цитата"] ?? f["текст"] ?? "");
        const source = plain(f["источник"] ?? f["джерело"] ?? f["source"] ?? f["3"] ?? "") || refsOf(block).join("; ");
        const author = plain(f["автор"] ?? f["2"] ?? "");
        const note = plain(f["комментарий"] ?? f["коментар"] ?? "");
        const original = plain(f["оригинал"] ?? f["оригінал"] ?? f["original"] ?? "");
        current = { section: heads.map((x) => x.heading).join(" / "), text, source, author, note, original, sub: [] };
        push();
      }
      continue;
    }
    const b = /^([*#]+)(:*)\s*(.*)$/.exec(line);
    if (b) {
      const level = b[1].length + b[2].length;
      if (level === 1 && !b[2]) {
        push();
        current = { section: heads.map((x) => x.heading).join(" / "), text: plain(b[3]), source: refsOf(b[3]).join("; "), sub: [] };
      } else if (current) {
        const sub = plain(b[3]);
        if (sub) current.sub.push(sub);
        const refs = refsOf(b[3]);
        if (refs.length && !current.source) current.source = refs.join("; ");
      }
      continue;
    }
    if (/^:+/.test(line) && current) {
      const sub = plain(line.replace(/^:+/, ""));
      if (sub) current.sub.push(sub);
      continue;
    }
    if (!line.trim()) push();
  }
  push();
  return out;
}

/** Text compared loosely: letters and digits only, lower case, ё as е, apostrophes dropped. */
export const loose = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[’'ʼ`]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/**
 * Whether a line stands on the page in a sourced section: its words, in
 * order, inside one quote there (its text, translation or source lines). A
 * line cut short with "…" counts if each of its pieces does.
 */
export function findOnPage(quotes, text) {
  const pieces = String(text)
    .split(/…|\.\.\.|\[…\]/)
    .map(loose)
    .filter((p) => p.split(" ").length >= 2);
  if (!pieces.length) return null;
  for (const q of quotes) {
    const hay = loose([q.text, q.original ?? "", ...(q.sub ?? [])].join(" | "));
    if (pieces.every((p) => hay.includes(p))) return q;
  }
  return null;
}

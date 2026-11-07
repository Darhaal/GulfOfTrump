// Towns for the close-in map: GeoNames' places of 15,000 people and more
// (cities15000, CC BY 4.0, https://www.geonames.org/), minus the ones
// cities.json already holds. GeoNames lists every known name of a place
// without saying which language it is; its per-country alternate names,
// tagged by language, give the Russian and Ukrainian ones exactly – they are
// downloaded for every country the towns lie in. Where a town has no tagged
// name, Wikidata's Russian and Ukrainian labels of the item carrying its
// GeoNames id are taken (CC0); failing those, one is picked from its Cyrillic
// names by how close it sounds to the English one and by the letters each
// alphabet has.

/** The countries (ISO 3166 alpha-2) the towns of cities15000.txt lie in, each a file of tagged alternate names. */
export function townCountries(text) {
  const out = new Set();
  for (const line of text.split("\n")) {
    const f = line.split("\t");
    if (f.length >= 15 && /^[A-Z]{2}$/.test(f[8])) out.add(f[8]);
  }
  return [...out].sort();
}

/** The GeoNames ids of cities15000.txt's places: the only ones whose names are kept. */
export function townIds(text) {
  return new Set(text.split("\n").map((line) => line.split("\t")[0]).filter(Boolean));
}

import { inflateRawSync } from "node:zlib";

/** A file inside a zip, as text: the one named, else the first. */
export function unzip(buffer, name) {
  const eocd = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error("not a zip file");
  const count = buffer.readUInt16LE(eocd + 10);
  let at = buffer.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i += 1) {
    const method = buffer.readUInt16LE(at + 10);
    const size = buffer.readUInt32LE(at + 20);
    const nameLength = buffer.readUInt16LE(at + 28);
    const entry = buffer.subarray(at + 46, at + 46 + nameLength).toString("utf8");
    const local = buffer.readUInt32LE(at + 42);
    if (!name || entry === name) {
      const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
      const data = buffer.subarray(start, start + size);
      return (method === 8 ? inflateRawSync(data) : data).toString("utf8");
    }
    at += 46 + nameLength + buffer.readUInt16LE(at + 30) + buffer.readUInt16LE(at + 32);
  }
  throw new Error(`${name} not in the zip`);
}

/**
 * Russian and Ukrainian names by GeoNames id, from an alternateNamesV2 file:
 * preferred names first, short, colloquial and historic ones left out; with
 * `ids`, only for those places.
 */
export function taggedNames(text, into = new Map(), ids = null) {
  for (const line of text.split("\n")) {
    const f = line.split("\t");
    const lang = f[2];
    if ((lang !== "ru" && lang !== "uk") || f[5] === "1" || f[6] === "1" || f[7] === "1") continue;
    if (ids && !ids.has(f[1])) continue;
    const entry = into.get(f[1]) ?? {};
    if (!entry[lang] || f[4] === "1") entry[lang] = f[3];
    into.set(f[1], entry);
  }
  return into;
}

const CYRILLIC = /[Ѐ-ӿ]/;
const LATIN = /[A-Za-z]/;
/** Letters Russian does not use, and letters Ukrainian does not use. */
const NOT_RUSSIAN = /[іїєґўјћђљњџѓќѕ]/i;
const NOT_UKRAINIAN = /[ыэъёўјћђљњџѓќѕ]/i;
const UKRAINIAN = /[іїєґ]/i;

const TO_LATIN = {
  а: "a", б: "b", в: "v", г: "g", ґ: "g", д: "d", е: "e", ё: "e", є: "e", ж: "zh", з: "z", и: "i", і: "i", ї: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch",
  ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};
const latin = (s) => [...s.toLowerCase()].map((c) => TO_LATIN[c] ?? c).join("").replace(/[^a-z]/g, "");
const plain = (s) => s.normalize("NFKD").toLowerCase().replace(/[^a-z]/g, "");

/** Dice similarity of letter pairs. */
function similarity(a, b) {
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
  const pairs = new Map();
  for (let i = 0; i < a.length - 1; i += 1) pairs.set(a.slice(i, i + 2), (pairs.get(a.slice(i, i + 2)) ?? 0) + 1);
  let shared = 0;
  for (let i = 0; i < b.length - 1; i += 1) {
    const n = pairs.get(b.slice(i, i + 2));
    if (n) {
      shared += 1;
      pairs.set(b.slice(i, i + 2), n - 1);
    }
  }
  return (2 * shared) / (a.length + b.length - 2);
}

/** The Russian and Ukrainian names among a place's alternates, if any sound like it. */
export function cyrillicNames(english, alternates) {
  const words = english.split(/\s+/).length;
  const target = plain(english);
  const scored = alternates
    .filter((n) => CYRILLIC.test(n) && !LATIN.test(n) && n.split(/\s+/).length <= words)
    .map((n) => ({ n, score: similarity(latin(n), target) }))
    .filter((c) => c.score >= 0.4)
    .sort((a, b) => b.score - a.score);
  const ru = scored.find((c) => !NOT_RUSSIAN.test(c.n))?.n;
  const uk = scored.find((c) => UKRAINIAN.test(c.n) && !NOT_UKRAINIAN.test(c.n))?.n ?? (ru && !NOT_UKRAINIAN.test(ru) ? ru : undefined);
  return { ru, uk };
}

/**
 * Russian and Ukrainian names of places by GeoNames id from Wikidata's labels
 * (the items that carry the GeoNames id, P1566; CC0): asked in batches,
 * answered as SPARQL JSON. `ask` fetches one batch's answer.
 */
export async function wikidataLabels(ids, ask) {
  const out = new Map();
  const list = [...ids];
  for (let i = 0; i < list.length; i += 400) {
    const values = list.slice(i, i + 400).map((id) => `"${id}"`).join(" ");
    const query = `SELECT ?gn ?ru ?uk WHERE { VALUES ?gn { ${values} } ?item wdt:P1566 ?gn . OPTIONAL { ?item rdfs:label ?ru FILTER(LANG(?ru) = "ru") } OPTIONAL { ?item rdfs:label ?uk FILTER(LANG(?uk) = "uk") } }`;
    const answer = await ask(query, i / 400);
    // A label may carry what tells it apart ("Бинга (город)") or a second name after a comma: the name alone.
    const clean = (s) => s?.replace(/\s*\([^)]*\)/g, "").split(",")[0].trim();
    for (const b of answer.results.bindings) {
      const id = b.gn.value;
      const entry = out.get(id) ?? {};
      const ru = clean(b.ru?.value);
      const uk = clean(b.uk?.value);
      if (ru && CYRILLIC.test(ru) && !LATIN.test(ru)) entry.ru ??= ru;
      if (uk && CYRILLIC.test(uk) && !LATIN.test(uk)) entry.uk ??= uk;
      if (entry.ru || entry.uk) out.set(id, entry);
    }
  }
  return out;
}

/** Feature codes that are not towns of their own: parts of cities, abandoned or historical places. */
const SKIP = new Set(["PPLX", "PPLH", "PPLQ", "PPLW", "PPLCH", "STLMT"]);

/**
 * Towns from cities15000.txt that cities.json does not have (none of its
 * places within 0.1°): [name, x, y, population in thousands, seat (1 for a
 * provincial or district seat), Russian name, Ukrainian name] — the names
 * left out when they match the English one. `min` and `max` bound the
 * people: the villages of cities1000 that name the finer map's emptiest
 * parts are the places of 1,000 to 15,000.
 */
export function parseTowns(text, cities, tagged = new Map(), labels = new Map(), { min = 15000, max = Infinity } = {}) {
  const grid = new Map();
  const key = (x, y) => `${Math.floor(x * 5)},${Math.floor(y * 5)}`;
  for (const c of cities) grid.set(key(c.x, c.y), [...(grid.get(key(c.x, c.y)) ?? []), c]);
  const taken = (x, y) => {
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        for (const c of grid.get(key(x + dx * 0.2, y + dy * 0.2)) ?? []) if (Math.abs(c.x - x) < 0.1 && Math.abs(c.y - y) < 0.1) return true;
      }
    }
    return false;
  };
  const towns = [];
  for (const line of text.split("\n")) {
    const f = line.split("\t");
    if (f.length < 15 || SKIP.has(f[7])) continue;
    const pop = Number(f[14]);
    if (!(pop >= min) || pop >= max) continue;
    const x = Math.round(Number(f[5]) * 100) / 100;
    const y = Math.round(Number(f[4]) * 100) / 100;
    if (taken(x, y)) continue;
    const name = f[1];
    // GeoNames' own tagged names first, then Wikidata's labels of the same place, then a guess among the Cyrillic alternates;
    // without a Ukrainian one, a Ukrainian-looking alternate, else the Russian name.
    const known = tagged.get(f[0]) ?? {};
    const label = labels.get(f[0]) ?? {};
    const sure = known.ru ?? label.ru;
    const guess = !sure || !(known.uk ?? label.uk) ? cyrillicNames(name, f[3] ? f[3].split(",") : []) : {};
    const ru = sure ?? guess.ru;
    const uk = known.uk ?? label.uk ?? (guess.uk && UKRAINIAN.test(guess.uk) ? guess.uk : undefined) ?? sure ?? guess.uk;
    const seat = /^PPLA[12]?$/.test(f[7]) ? 1 : 0;
    const row = [name, x, y, Math.round(pop / 1000), seat];
    if (ru || uk) row.push(ru ?? 0, uk ?? 0);
    towns.push(row);
  }
  return towns.sort((a, b) => b[3] - a[3]);
}

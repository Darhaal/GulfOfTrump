// Flags for the countries of every scenario.
//
// Writes src/engine/flagCodes.ts — each country tag that exists today with
// its ISO 3166 code, matched by name against Natural Earth's countries — and
// copies those flags (flag-icons, MIT; the flags themselves are public
// domain) to public/flags/. States that no longer exist, and flags that
// changed, are drawn in src/components/Flag.tsx (see src/engine/flags.ts).
//
//   npm run flags   (after npm run maps, which caches Natural Earth)

import { copyFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SOURCE = path.join(ROOT, "node_modules", "flag-icons", "flags", "4x3");
const OUT = path.join(ROOT, "public", "flags");
const CODES = path.join(ROOT, "src", "engine", "flagCodes.ts");

const slug = (s) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Tags whose names do not match today's country names. */
const BY_HAND = { uk: "gb", usa: "us", czechoslovakia: "cz", macedonia: "mk", swaziland: "sz", "dr-congo": "cd", zaire: "cd", nejd: "sa", byelarus: "by", persia: "ir", siam: "th" };

// Every tag in the scenarios: the keys of their country tables and province owners (islands.ts holds the owners they share).
const tags = new Set();
for (const file of await readdir(path.join(ROOT, "src", "engine", "scenarios"))) {
  if (!/^(\d{4}|islands)\.ts$/.test(file)) continue;
  const text = await readFile(path.join(ROOT, "src", "engine", "scenarios", file), "utf8");
  for (const m of text.matchAll(/^\s{4}"?([a-z][a-z0-9-]*)"?: \{\s*$/gm)) tags.add(m[1]);
  for (const m of text.matchAll(/"([a-z][a-z0-9-]+)"/g)) tags.add(m[1]);
}
// …and the owners of the provinces on every map, which become tags as they are.
for (const file of await readdir(path.join(ROOT, "public", "maps"))) {
  if (!/^world_\d{4}\.json$/.test(file)) continue;
  const map = JSON.parse(await readFile(path.join(ROOT, "public", "maps", file), "utf8"));
  for (const g of map.objects.regions.geometries) if (g.properties.owner) tags.add(g.properties.owner);
}
const countries = JSON.parse(await readFile(path.join(ROOT, "scripts", ".cache", "ne_50m_admin_0_countries.geojson"), "utf8"));
const byName = new Map();
for (const f of countries.features) {
  const p = f.properties;
  const iso = (p.ISO_A2_EH && p.ISO_A2_EH !== "-99" ? p.ISO_A2_EH : p.ISO_A2 ?? "").toLowerCase();
  if (!/^[a-z]{2}$/.test(iso)) continue;
  for (const name of [p.NAME, p.NAME_LONG, p.ADMIN, p.NAME_EN, p.GEOUNIT]) if (name) byName.set(slug(name), iso);
}
const available = new Set((await readdir(SOURCE)).map((f) => f.replace(/\.svg$/, "")));
const codes = {};
for (const tag of [...tags].sort()) {
  const iso = BY_HAND[tag] ?? byName.get(tag);
  if (iso && available.has(iso)) codes[tag] = iso;
}

// Old flags go; the README stays.
await mkdir(OUT, { recursive: true });
for (const file of await readdir(OUT)) if (file.endsWith(".svg")) await rm(path.join(OUT, file));
for (const iso of new Set(Object.values(codes))) await copyFile(path.join(SOURCE, `${iso}.svg`), path.join(OUT, `${iso}.svg`));
await writeFile(
  CODES,
  `// Written by scripts/flags.mjs — do not edit by hand.\n\n/** Country tag -> ISO 3166 code of today's flag (public/flags/<code>.svg). */\nexport const FLAG_CODES: Record<string, string> = ${JSON.stringify(codes, null, 2)};\n`,
);
console.log(`${Object.keys(codes).length} tags, ${new Set(Object.values(codes)).size} flags in public/flags`);

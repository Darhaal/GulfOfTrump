/**
 * Paints the portraits of the game's people in oil (public/portraits).
 *
 *   npm run portraits              all people in scripts/portraits/people.json
 *   npm run portraits -- molotov   only these ids (and the shadows; --no-shadows leaves them, for runs side by side)
 *   npm run portraits -- --index   only the engine's index, after editing names in people.json
 *   npm run portraits -- --figures only the figures of each date (src/engine/figures.data.ts)
 *   npm run portraits -- --author  the developer's own photograph (public/about), for the about page
 *   npm run portraits -- --shadows only the shadows
 *   npm run portraits -- --quoted  the writers and thinkers quoted on the waiting screens
 *                                  (scripts/portraits/quoted.json), or only the ids after it
 *
 * For each person with a Wikidata id it reads the picture (P18) and sex
 * (P21), keeps the picture only if Commons gives it a free licence (public
 * domain, CC0, CC BY, CC BY-SA, OGL, GODL-India, KOGL Type 1, FAL, the European
 * Parliament's, or "no known restrictions"
 * — never NC, ND or GFDL alone), downloads
 * it into scripts/.cache/portraits, crops head and shoulders 4:5 (a `crop`
 * in people.json overrides the guess; `group` marks a cut from a group photo), paints it and writes
 * public/portraits/<id>.webp. People without a usable picture get a shadow:
 * a dark bust of their era and sex drawn for the game (scripts/portraits/
 * shadows.mjs), several to each, so strangers do not share one face. It also
 * writes public/portraits/credits.json (who made each source
 * picture, its licence, what was changed) and src/engine/people.data.ts, the
 * index the engine matches names against. The quoted are painted the same
 * way into public/portraits and credited in credits.json, but they are not
 * the game's people: they stay out of people.json and the engine's index.
 *
 * The painting: grey, smoothed like flat paint (Kuwahara), light on the face
 * and the room sinking into shadow, a few brush strokes, a warm ramp from
 * umber to ivory, a glaze and the weave of the canvas.
 *
 * sharp comes with Next.js; if it is missing: npm i --no-save sharp.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { autocontrast, blurGrey as blurAt, commons, fetchFile, fetchJson, freeLicence, paint as paintAt, sharp, sleep } from "./portraits/oil.mjs";
import { SHADOW_ERAS, shadowSvg } from "./portraits/shadows.mjs";

export { freeLicence };

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const PEOPLE = path.join(ROOT, "scripts/portraits/people.json");
const QUOTED = path.join(ROOT, "scripts/portraits/quoted.json");
const CACHE = path.join(ROOT, "scripts/.cache/portraits");
const OUT = path.join(ROOT, "public/portraits");
const INDEX = path.join(ROOT, "src/engine/people.data.ts");
const FIGURES = path.join(ROOT, "src/engine/figures.data.ts");

const W = 480;
const H = 600;
const OUT_W = 256;
const OUT_H = 320;

/** Paints a grey picture (W×H, 0–1) in oil; returns the webp, at the portraits' size unless told otherwise. */
const paint = (g, face, size = { width: OUT_W, height: OUT_H, quality: 68 }) => paintAt(g, face, W, H, size);

/** A grey picture (W×H, 0–1) blurred by sharp. */
const blurGrey = (grey, sigma) => blurAt(grey, sigma, W, H);

// --- Wikidata and Commons ---

async function wikidata(qids) {
  const out = new Map();
  for (let i = 0; i < qids.length; i += 50) {
    const chunk = qids.slice(i, i + 50);
    const j = await fetchJson(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims&ids=${chunk.join("|")}`);
    for (const [id, e] of Object.entries(j.entities ?? {})) {
      const claim = (p) => e.claims?.[p]?.find((c) => c.rank === "preferred") ?? e.claims?.[p]?.[0];
      const sex = claim("P21")?.mainsnak?.datavalue?.value?.id;
      out.set(id, {
        image: claim("P18")?.mainsnak?.datavalue?.value,
        gender: sex === "Q6581072" ? "female" : sex === "Q6581097" ? "male" : undefined,
      });
    }
    await sleep(300);
  }
  return out;
}

// --- painting: scripts/portraits/oil.mjs, at the portraits' size ---

/** Light that falls on the face: 1 at its centre, fading out by an ellipse. */
function faceMask(cx, cy, rx = 0.2, ry = 0.19, soft = 0.9) {
  const m = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const r = Math.hypot((x / W - cx) / rx, (y / H - cy) / ry);
      m[y * W + x] = Math.min(1, Math.max(0, (1 + soft - r) / soft)) ** 2;
    }
  }
  return m;
}

/**
 * Where to look for head and shoulders, unless people.json gives a crop: the
 * upper 4:5 of an upright picture at its full width (where an official
 * portrait has the head), or, for a square or wide one, the 4:5 window sharp
 * finds the most detail and skin in (its "attention" strategy). Full-length
 * pictures need a crop in people.json.
 */
function guessCrop(w, h) {
  if (h / w >= 1.25) {
    const ch = Math.round(w * 1.25);
    return { box: { left: 0, top: Math.min(Math.round(h * 0.03), h - ch), width: w, height: ch }, attention: false };
  }
  return { box: { left: 0, top: 0, width: w, height: h }, attention: true };
}

async function greyFrom(buf, crop) {
  const meta = await sharp(buf).rotate().metadata();
  const w = meta.autoOrient?.width ?? meta.width;
  const h = meta.autoOrient?.height ?? meta.height;
  const guess = crop ? null : guessCrop(w, h);
  // A crop of three numbers is x, y and width as shares of the picture; the height follows for 4:5.
  const box = crop
    ? (() => {
        const width = Math.round(crop[2] * w);
        const height = Math.min(h - Math.round(crop[1] * h), crop[3] !== undefined ? Math.round(crop[3] * h) : Math.round(width * 1.25));
        return { left: Math.round(crop[0] * w), top: Math.round(crop[1] * h), width: Math.min(width, w - Math.round(crop[0] * w)), height };
      })()
    : guess.box;
  const data = await sharp(buf).rotate().flatten({ background: "#ffffff" }).extract(box).resize(W, H, guess?.attention ? { fit: "cover", position: sharp.strategy.attention, kernel: "lanczos3" } : { fit: "fill", kernel: "lanczos3" }).grayscale().raw().toBuffer();
  const g = new Float32Array(W * H);
  for (let i = 0; i < g.length; i++) g[i] = data[i] / 255;
  return autocontrast(g);
}

/** A drawn bust (an SVG of the W×H canvas) as a dark figure against a lit wall, its edge caught by the light. */
async function shadowGrey(svg) {
  const alpha = await sharp(Buffer.from(svg)).ensureAlpha().extractChannel("alpha").raw().toBuffer();
  const m = await blurGrey(Float32Array.from(alpha, (v) => v / 255), 1.2);
  const g = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const wall = 0.82 - (y / H) * 0.1 - Math.abs(x / W - 0.45) * 0.15;
      const body = 0.13 + (1 - x / W) * 0.05;
      const sy = y - 5;
      const sx = x - 6;
      const shifted = sy >= 0 && sx >= 0 ? m[sy * W + sx] : 0;
      const rim = Math.max(0, m[i] - shifted);
      g[i] = Math.min(1, Math.max(0, wall * (1 - m[i]) + body * m[i] + rim * 0.35));
    }
  }
  const soft = await blurGrey(g, 1);
  const face = faceMask(0.5, 0.3, 0.24, 0.24);
  for (let i = 0; i < face.length; i++) face[i] *= 1 - m[i];
  return { g: soft, face };
}

/** Every era's shadows: public/portraits/_shadow-<era>-<sex>-<n>.webp. */
async function paintShadows() {
  let n = 0;
  for (const [era, sexes] of Object.entries(SHADOW_ERAS)) {
    for (const [sex, looks] of Object.entries(sexes)) {
      for (const [i, body] of looks.entries()) {
        const { g, face } = await shadowGrey(shadowSvg(body, W, H, n + 3));
        writeFileSync(path.join(OUT, `_shadow-${era}-${sex}-${i}.webp`), await paint(g, face));
        n++;
      }
    }
  }
  console.log(`shadows: ${n}`);
}

// --- the run ---

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--author")) {
    // The developer, painted like the game's people: the about page, the app's loading screen, the site's footer.
    const source = path.join(ROOT, "public/about/artem-okhten.webp");
    const g = await greyFrom(readFileSync(source), [0.1, 0, 0.8]);
    writeFileSync(path.join(ROOT, "public/about/artem-okhten-oil.webp"), await paint(g, faceMask(0.5, 0.46, 0.24, 0.22), { width: 384, height: 480, quality: 74 }));
    console.log("painted public/about/artem-okhten-oil.webp");
    return;
  }
  if (args.includes("--shadows")) {
    mkdirSync(OUT, { recursive: true });
    await paintShadows();
    return;
  }
  const people = JSON.parse(readFileSync(PEOPLE, "utf8"));
  const quoted = JSON.parse(readFileSync(QUOTED, "utf8"));
  if (args.includes("--figures")) {
    writeFigures(people);
    return;
  }
  if (args.includes("--index")) {
    // Only the engine's index and the credits, from people.json and what is painted: after an edit to names or aliases.
    const credits = prune(JSON.parse(readFileSync(path.join(OUT, "credits.json"), "utf8")), [...people, ...quoted]);
    writeFileSync(path.join(OUT, "credits.json"), JSON.stringify(credits, null, 1) + "\n");
    writeIndex(people, credits);
    writeFigures(people);
    return;
  }
  const only = new Set(args.filter((a) => !a.startsWith("--")));
  mkdirSync(CACHE, { recursive: true });
  mkdirSync(OUT, { recursive: true });
  const creditsFile = path.join(OUT, "credits.json");
  const credits = existsSync(creditsFile) ? JSON.parse(readFileSync(creditsFile, "utf8")) : {};
  const save = () => {
    // A run for some ids changes only their credits: read the file again, so runs side by side keep each other's.
    if (only.size && existsSync(creditsFile)) {
      const onDisk = JSON.parse(readFileSync(creditsFile, "utf8"));
      for (const id of only) {
        if (credits[id]) onDisk[id] = credits[id];
        else delete onDisk[id];
      }
      Object.keys(credits).forEach((id) => delete credits[id]);
      Object.assign(credits, onDisk);
    }
    const sorted = only.size ? Object.fromEntries(Object.entries(credits).sort(([a], [b]) => a.localeCompare(b))) : prune(credits, [...people, ...quoted]);
    writeFileSync(creditsFile, JSON.stringify(sorted, null, 1) + "\n");
    return sorted;
  };

  if (args.includes("--quoted")) {
    // The quoted: painted and credited like the game's people, never in the engine's index.
    const { painted, shadowed } = await paintPeople(quoted.filter((p) => p.qid && (!only.size || only.has(p.id))), credits);
    save();
    console.log(`quoted: painted ${painted}, shadows ${shadowed}`);
    return;
  }

  // The shadows, always (unless --no-shadows, for runs side by side): drawn here, so they have no source to credit.
  if (!args.includes("--no-shadows")) await paintShadows();

  const { painted, shadowed } = await paintPeople(people.filter((p) => p.qid && (!only.size || only.has(p.id))), credits);
  const sorted = save();
  if (!only.size) {
    writeIndex(people, sorted);
    writeFigures(people);
  }
  console.log(`painted ${painted}, shadows ${shadowed}`);
}

/** Paints everyone in `todo` whose picture is free and fills in their credits; the rest get a shadow. */
async function paintPeople(todo, credits) {
  const wd = await wikidata(todo.map((p) => p.qid));
  const files = [...new Set(todo.map((p) => p.photo ?? wd.get(p.qid)?.image ?? p.image).filter(Boolean).map((f) => `File:${f}`))];
  const info = await commons(files);

  let painted = 0;
  let shadowed = 0;
  for (const p of todo) {
    const fromWd = wd.get(p.qid) ?? {};
    if (!p.gender && fromWd.gender) p.gender = fromWd.gender;
    // A picture chosen by hand (photo: the right year, say), else Wikidata's now, else the one noted when the person was added.
    const image = p.photo ?? fromWd.image ?? p.image;
    const meta = image ? info.get(`File:${image}`) : undefined;
    const licence = meta ? freeLicence(meta) : null;
    const target = path.join(OUT, `${p.id}.webp`);
    // noPortrait in people.json: the picture is of something else (a bust, a wall) or too small to paint.
    if (!meta || !licence || p.noPortrait) {
      delete credits[p.id];
      p.portrait = false;
      shadowed++;
      continue;
    }
    try {
      const ext = (meta.url.match(/\.(jpe?g|png|webp|tiff?|gif)(?:$|\?)/i)?.[1] ?? "jpg").toLowerCase();
      const buf = await fetchFile(meta.url, path.join(CACHE, `${p.qid}.${ext}`));
      const g = await greyFrom(buf, p.crop);
      const [fx, fy] = p.face ?? [0.5, 0.36];
      writeFileSync(target, await paint(g, faceMask(fx, fy)));
      credits[p.id] = {
        name: p.name.en,
        source: meta.page,
        file: meta.file,
        author: meta.author,
        licence,
        licenceName: meta.licence,
        licenceUrl: meta.licenceUrl,
        // group: the only free picture shows others too; the portrait is cut to this person alone.
        changes: p.group ? "cut from a group photograph to this person's head and shoulders, toned and painted in oil" : "cropped to head and shoulders, toned and painted in oil",
      };
      p.portrait = true;
      painted++;
      if (painted % 25 === 0) console.log(`${painted} painted…`);
    } catch (error) {
      console.warn(`${p.id}: ${error.message}`);
      delete credits[p.id];
      p.portrait = false;
      shadowed++;
    }
  }
  return { painted, shadowed };
}

/**
 * Credits and files kept in step: someone renamed or dropped from people.json
 * and quoted.json, or marked noPortrait, loses their file and credit, and a file nobody credits
 * goes, unless it is one of today's shadows. Returns the credits, sorted.
 */
function prune(credits, people) {
  const keep = new Set(people.filter((p) => !p.noPortrait).map((p) => p.id));
  const out = {};
  for (const [id, c] of Object.entries(credits).sort(([a], [b]) => a.localeCompare(b))) {
    if (keep.has(id) && existsSync(path.join(OUT, `${id}.webp`))) out[id] = c;
  }
  const shadows = new Set(Object.entries(SHADOW_ERAS).flatMap(([era, sexes]) => Object.entries(sexes).flatMap(([sex, looks]) => looks.map((_, i) => `_shadow-${era}-${sex}-${i}`))));
  for (const file of readdirSync(OUT).filter((f) => f.endsWith(".webp"))) if (!out[file.slice(0, -5)] && !shadows.has(file.slice(0, -5))) unlinkSync(path.join(OUT, file));
  return out;
}

/**
 * A name's words as the engine reads them (nameTokens in src/engine/people.ts),
 * in any order: the engine matches a name by its words, so "Серов, Иван" and
 * "Иван Серов" are one name.
 */
const nameKey = (s) =>
  [
    ...new Set(
      s
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/ё/g, "е")
        .split(/[^\p{L}\p{N}]+/u)
        .filter(Boolean),
    ),
  ]
    .sort()
    .join(" ");

/**
 * The engine's index: the person's names in the three languages and every
 * other name they go by (one of each spelling the engine reads alike:
 * "Молотов, Вячеслав" and "Молотов Вячеслав" are one), their sex, the years of
 * their life (namesakes of different eras) and whether a portrait exists.
 */
function writeIndex(people, credits) {
  const rows = people.map((p) => {
      const name = { en: p.name.en, ...(p.name.ru ? { ru: p.name.ru } : {}), ...(p.name.uk ? { uk: p.name.uk } : {}) };
      const seen = new Set(Object.values(name).map(nameKey));
      const names = (p.aliases ?? []).filter((n) => n && !seen.has(nameKey(n)) && seen.add(nameKey(n)));
      return { id: p.id, name, names, gender: p.gender ?? "male", ...(credits[p.id] ? { portrait: true } : {}), ...(p.born ? { born: p.born } : {}), ...(p.died ? { died: p.died } : {}) };
    });
  const lines = rows.map((r) => `  ${JSON.stringify(r)},`).join("\n");
  writeFileSync(INDEX, `// Generated by scripts/portraits.mjs from scripts/portraits/people.json — do not edit by hand.\nimport type { KnownPerson } from "./people";\n\nexport const KNOWN_PEOPLE: KnownPerson[] = [\n${lines}\n];\n`);
  console.log(`index: ${rows.length} people`);
}

/** The posts a player can hold at the start besides the leader's (engine/figures.ts): the eight ministries; "military" also gives the generals. */
const FIGURE_POSTS = ["chief", "foreign", "interior", "military", "intelligence", "finance", "industry", "science"];

/**
 * Who held each post on each start date, by date, country and post, for the
 * player who starts as a minister or a general. Someone with several dates
 * and several posts is left out: the data does not say which post went with
 * which date. Deputies hold no post of their own here.
 */
function writeFigures(people) {
  const out = {};
  let n = 0;
  for (const p of people) {
    const dates = p.dates ?? [];
    const posts = (p.posts ?? []).filter((x) => FIGURE_POSTS.includes(x));
    // The country's rulers are the leader's role, not a minister's or a general's.
    const rules = (p.posts ?? []).some((x) => x === "leader" || x === "head" || x === "government");
    if (!posts.length || rules || p.deputyOf || (dates.length > 1 && (p.posts ?? []).length > 1)) continue;
    for (const date of dates) {
      for (const country of p.countries ?? []) {
        for (const post of posts) {
          ((out[date] ??= {})[country] ??= {})[post] ??= [];
          out[date][country][post].push(p.id);
          n += 1;
        }
      }
    }
  }
  const sorted = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
  const rows = Object.entries(sorted(out)).map(([date, countries]) =>
    [`  "${date}": {`, ...Object.entries(sorted(countries)).map(([country, posts]) => `    ${JSON.stringify(country)}: ${JSON.stringify(sorted(posts))},`), "  },"].join("\n"),
  );
  const head = "// Generated by scripts/portraits.mjs from scripts/portraits/people.json — do not edit by hand.";
  const doc = "/** Who held each post on each start date: date → country → post → ids in KNOWN_PEOPLE (engine/figures.ts). */";
  writeFileSync(FIGURES, [head, "", doc, "export const FIGURES: Record<string, Record<string, Partial<Record<string, string[]>>>> = {", ...rows, "};", ""].join("\n"));
  console.log(`figures: ${n}`);
}

await main();

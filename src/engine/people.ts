import { fixed } from "./dice";
import { KNOWN_PEOPLE } from "./people.data";
import type { CountryState, GameState, Gender, Locale, Official, Person, Rulers } from "./types";

/**
 * The people of the game as people: who a leader line names, their sex and
 * their portrait. A name the portrait data knows (scripts/portraits/
 * people.json, in English, Russian and Ukrainian) gets that person's
 * portrait; anyone else gets the shadow of their sex. Anyone can lead: a
 * leader line the game master writes is read again, and a minister named to
 * the top post takes their own portrait with them.
 */

/** Someone the portrait data knows (generated into people.data.ts). */
export interface KnownPerson {
  id: string;
  name: { en: string; ru?: string; uk?: string };
  /** Every name the person goes by, in any of the three languages. */
  names: string[];
  gender: Gender;
  /** A painted portrait exists in public/portraits. */
  portrait?: true;
}

/** Lowercase words of a name, without accents, so "Мосцицкий" and "Mościcki" each match themselves however written. */
export function nameTokens(text: string): string[] {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

interface Variant {
  person: KnownPerson;
  tokens: string[];
}

let index: Map<string, Variant[]> | null = null;

/** A Russian or Ukrainian patronymic, as the last word of "Surname Name Patronymic". */
const PATRONYMIC = /(вич|вна|ична|івна|ївна)$/;

/** The id of someone the data does not know starts with a sign no portrait id has. */
export const NEW_PERSON = "~";

/** Names by their longest word; a one-word name counts only when it is long enough to be someone's (Sukarno, Hirohito). */
function variants(): Map<string, Variant[]> {
  if (index) return index;
  index = new Map();
  const add = (person: KnownPerson, tokens: string[]) => {
    const key = tokens.reduce((a, b) => (b.length > a.length ? b : a));
    index!.set(key, [...(index!.get(key) ?? []), { person, tokens }]);
  };
  for (const person of KNOWN_PEOPLE) {
    for (const name of person.names) {
      const tokens = [...new Set(nameTokens(name))];
      if (tokens.length < 2 && (tokens[0]?.length ?? 0) < 5) continue;
      add(person, tokens);
      // "Олексій Юрійович Резніков" and "Резніков Олексій Юрійович" are also "Олексій Резніков": the given name and the
      // surname, without the patronymic or middle names. Only for three words or more apart, so "Kim Jong-il" stays
      // whole; never for a monarch's number.
      const last = tokens.at(-1)!;
      if (name.trim().split(/\s+/).length >= 3 && !/\d|^(i|ii|iii|iv|v|vi|vii|viii)$/.test(last)) {
        add(person, PATRONYMIC.test(last) ? [tokens[1], tokens[0]] : [tokens[0], last]);
      }
    }
  }
  return index;
}

/** Everyone the text names, the fullest names first; a name inside a fuller one ("George W. Bush" in "George H. W. Bush") is not counted. */
export function findAllKnown(text: string): KnownPerson[] {
  const words = new Set(nameTokens(text));
  const found = new Map<string, Variant>();
  for (const word of words) {
    for (const v of variants().get(word) ?? []) {
      if (!v.tokens.every((t) => words.has(t))) continue;
      const before = found.get(v.person.id);
      if (!before || v.tokens.length > before.tokens.length) found.set(v.person.id, v);
    }
  }
  const all = [...found.values()];
  const kept = all.filter((v) => !all.some((o) => o !== v && o.tokens.length > v.tokens.length && v.tokens.every((t) => o.tokens.includes(t))));
  // In the order the text names them.
  const at = (v: Variant) => Math.min(...v.tokens.map((t) => [...words].indexOf(t)));
  return kept.sort((a, b) => at(a) - at(b)).map((v) => v.person);
}

export const findKnown = (text: string): KnownPerson | undefined => findAllKnown(text)[0];

const byId = new Map<string, KnownPerson>();
export function knownById(id: string): KnownPerson | undefined {
  if (!byId.size) for (const p of KNOWN_PEOPLE) byId.set(p.id, p);
  return byId.get(id);
}

/** The share of women among the people in power, by year: few before the 1970s. */
export function womenShare(year: number): number {
  if (year < 1920) return 0.01;
  if (year < 1960) return 0.02;
  if (year < 1980) return 0.04;
  if (year < 2000) return 0.1;
  if (year < 2015) return 0.2;
  return 0.25;
}

/** The sex of someone nobody has described, by a roll fixed for the name, so it never changes. */
export function guessGender(name: string, year: number): Gender {
  return fixed(`gender:${nameTokens(name).join(" ")}`) < womenShare(year) ? "female" : "male";
}

const TITLE_WORDS = new Set(
  `president pm premier prime minister king queen emperor kaiser tsar sultan shah emir chancellor chairman general secretary first party leader supreme paramount field marshal generalissimo führer duce caudillo regent prince crown chief of state the high representative transitional vice-president acting head commander army sir mullah
  президент премьер-министр премьер прем'єр-міністр прем'єр король королева император імператор кайзер царь цар султан шах канцлер канцлерка председатель голова генерал генеральный генеральний секретарь секретар первый перший лидер лідер партии партії верховный верховний руководитель керівник маршал фюрер дуче регент принц министр міністр глава государства держави временный тимчасовий командующий командувач сэр сер фельдмаршал и.о. в.о.`
    .split(/\s+/)
    .filter(Boolean),
);

/** A name without the titles in front of it and the clauses after it: "PM Shigeru Yoshida, under …" → "Shigeru Yoshida". */
export function bareName(part: string): string {
  const head = part.replace(/\([^)]*\)/g, " ").split(/,| under | при | під /)[0];
  const words = head.trim().split(/\s+/);
  let i = 0;
  while (i < words.length - 1 && TITLE_WORDS.has(words[i].toLowerCase())) i += 1;
  return words.slice(i).join(" ").trim();
}

/** Lines of a scenario that name nobody in power. */
const NOBODY = new Set(["directed from Hanoi", "Georges Bidault's government fell on 24 June"]);

const asPerson = (k: KnownPerson): Person => ({ id: k.id, name: k.name.en, gender: k.gender, ...(k.portrait ? { portrait: k.id } : {}) });

/** Someone by name: the known person if the data has them, otherwise a new one with the shadow of their sex. */
export function personFor(name: string, year: number, gender?: Gender): Person {
  const known = findKnown(name);
  if (known) return asPerson(known);
  const bare = bareName(name) || name.trim();
  return { id: `${NEW_PERSON}${nameTokens(bare).join("-").slice(0, 60) || "unknown"}`, name: bare, gender: gender ?? guessGender(bare, year) };
}

const MONARCH = /^(king|queen|emperor|kaiser|tsar|sultan|shah|prince regent|regent|grand duke|король|королева|император|імператор|кайзер|царь|цар|султан|шах|регент|принц-регент)\b/i;
/** Where the crown still ruled in 1914 rather than reigned. */
const RULING_CROWNS_1914 = new Set(["germany", "russia", "austria-hungary", "ottoman", "bulgaria", "montenegro", "japan"]);

/** The people of a leader line, in its order, and which of them leads. */
export function rulersOf(line: string, tag: string, year: number, gender?: Gender): Rulers {
  const parts = line
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean);
  const people: Person[] = [];
  const firstOf: number[] = [];
  for (const part of parts) {
    firstOf.push(people.length);
    if (NOBODY.has(part)) continue;
    const known = findAllKnown(part);
    if (known.length) {
      for (const k of known) if (!people.some((p) => p.id === k.id)) people.push(asPerson(k));
    } else {
      people.push(personFor(part, year, gender));
    }
  }
  // Under a king who reigns, the head of government leads.
  const crowned = parts.length > 1 && MONARCH.test(parts[0]) && !(year < 1918 && RULING_CROWNS_1914.has(tag));
  const leadPart = crowned ? 1 : 0;
  const lead = Math.min(firstOf[leadPart] ?? 0, Math.max(0, people.length - 1));
  return { line, people, lead };
}

const yearOf = (date: string) => Number(date.slice(0, 4));

/**
 * Reads every leader line that changed since its people were read (or never
 * were, or every line when `all`), in place. `genders` carries the sex the
 * game master gave a new leader, by country. Someone new keeps the record
 * they had — the sex the game master gave them; someone the data knows is
 * read afresh, so a portrait added in a later version reaches an old save.
 */
export function syncRulers(state: Pick<GameState, "countries" | "date">, genders?: Map<string, Gender>, all = false): void {
  const year = yearOf(state.date);
  for (const country of Object.values(state.countries)) {
    if (!country.leader) {
      delete country.rulers;
      continue;
    }
    if (!all && country.rulers?.line === country.leader) continue;
    const before = new Map((country.rulers?.people ?? []).map((p) => [p.id, p]));
    const next = rulersOf(country.leader, country.tag, year, genders?.get(country.tag));
    next.people = next.people.map((p) => (p.id.startsWith(NEW_PERSON) ? (before.get(p.id) ?? p) : p));
    country.rulers = next;
  }
}

/** A copy of the state with every leader line read again. */
export function withRulers<T extends Pick<GameState, "countries" | "date">>(state: T): T {
  const countries = Object.fromEntries(Object.entries(state.countries).map(([tag, c]) => [tag, { ...c }])) as Record<string, CountryState>;
  const next = { ...state, countries };
  syncRulers(next, undefined, true);
  return next;
}

/** An official with their sex and portrait: the data's if it knows the name, else what the game master said, else a fixed guess. */
export function dressOfficial(o: Official, year: number): Official {
  const known = findKnown(o.name);
  if (known) {
    const dressed: Official = { ...o, gender: known.gender };
    if (known.portrait) dressed.portrait = known.id;
    else delete dressed.portrait;
    return dressed;
  }
  return o.gender ? o : { ...o, gender: guessGender(o.name, year) };
}

/** A copy of the state with its leader lines read and its ministers and their deputies given their sex and portraits; safe to run on every load. */
export function withPeople(state: GameState): GameState {
  const year = yearOf(state.date);
  const next = withRulers(state);
  return {
    ...next,
    ...(state.officials?.length ? { officials: state.officials.map((o) => dressOfficial(o, year)) } : {}),
    ...(state.deputies?.length ? { deputies: state.deputies.map((d) => ({ ...d, ...dressOfficial(d, year) })) } : {}),
  };
}

/** Whether two names are the same person: the same known person, or the same words. */
export function samePerson(a: string, b: string): boolean {
  const ka = findKnown(a);
  const kb = findKnown(b);
  if (ka || kb) return ka?.id === kb?.id;
  return nameTokens(bareName(a)).join(" ") === nameTokens(bareName(b)).join(" ");
}

/**
 * Who leads a country now, as a person. For the player's government the
 * cabinet's head of state, or its head of government under a reigning king;
 * for anyone else the one the leader line puts in charge.
 */
export function leaderOf(state: Pick<GameState, "countries" | "player" | "officials" | "date">, tag: string): (Person & { title?: string }) | undefined {
  const rulers = state.countries[tag]?.rulers;
  if (tag === state.player && state.officials?.length) {
    const head = state.officials.find((o) => o.post === "head");
    const government = state.officials.find((o) => o.post === "government");
    // A king "who reigns but does not rule": the head of government, or, with none named, whom the leader line puts in charge.
    const crowned = head && (MONARCH.test(head.title) || MONARCH.test(head.name));
    const lead = rulers?.people[rulers.lead];
    if (crowned && !government && lead && !samePerson(lead.name, head.name)) return lead;
    const chosen = crowned && government ? government : (head ?? government);
    if (chosen) {
      const dressed = dressOfficial(chosen, yearOf(state.date));
      const known = findKnown(dressed.name);
      return { id: known?.id ?? `${NEW_PERSON}${nameTokens(dressed.name).join("-")}`, name: dressed.name, gender: dressed.gender ?? "male", ...(dressed.portrait ? { portrait: dressed.portrait } : {}), title: dressed.title };
    }
  }
  return rulers?.people[rulers.lead];
}

/** A person's name in the interface language, when the data knows it. */
export function personName(p: Pick<Person, "id" | "name">, locale: Locale): string {
  const known = knownById(p.id);
  return known ? (known.name[locale] ?? known.name.en) : p.name;
}

/** The picture to show: the person's portrait, or the shadow of their sex. */
export function portraitSrc(p: { portrait?: string; gender?: Gender }): string {
  return p.portrait ? `/portraits/${p.portrait}.webp` : `/portraits/_shadow-${p.gender ?? "male"}.webp`;
}

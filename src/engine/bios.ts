import { z } from "zod";
import { findKnown, personFor, samePerson } from "./people";
import { en } from "./text";
import type { GameState, Locale, Official } from "./types";

/**
 * Short biographies of the leader and the ministers: two or three sentences
 * the model writes once per person, in the player's language, about their
 * life up to the game's start date and nothing after it. A person known to
 * history follows their real life; an invented one follows what the game
 * knows of them. Asked for lazily – the leader's when the cabinet opens, a
 * minister's when their tab does – and kept in the save, by person.
 */

/** A biography as the model writes it. */
export const BioSchema = z.object({ bio: z.string().trim().min(1) });

/** The longest biography kept: three short sentences. */
export const BIO_CHARS = 420;

/** Who a biography is about: a person known to the portrait data by their id, anyone else by their name. */
export const bioKey = (state: Pick<GameState, "date">, name: string): string => personFor(name, Number(state.date.slice(0, 4))).id;

/** The biography of a person in a language, if it has been written. */
export const bioOf = (state: Pick<GameState, "bios" | "date">, name: string, locale: Locale): string | undefined => state.bios?.[bioKey(state, name)]?.[locale];

/**
 * A biography cut to one paragraph of three sentences at most and BIO_CHARS
 * at most, at the last whole sentence that fits.
 */
export function clipBio(text: string): string {
  const one = text.replace(/\s*\n+\s*/g, " ").replaceAll("—", "–").trim();
  const sentences = one.match(/[^.!?…]+[.!?…]+["»”]?(\s+|$)/g) ?? [one];
  let out = "";
  for (const s of sentences.slice(0, 3)) {
    if ((out + s).trim().length > BIO_CHARS) break;
    out += s;
  }
  out = out.trim();
  if (out) return out;
  return `${one.slice(0, one.lastIndexOf(" ", BIO_CHARS - 1)).trim()}…`;
}

/** The game with a person's biography in a language; written once, so a second answer changes nothing. */
export function addBio<T extends Pick<GameState, "bios" | "date">>(state: T, name: string, locale: Locale, text: string): T {
  const key = bioKey(state, name);
  const bio = clipBio(text);
  if (!bio || state.bios?.[key]?.[locale]) return state;
  return { ...state, bios: { ...state.bios, [key]: { ...state.bios?.[key], [locale]: bio } } };
}

const LANGUAGE: Record<Locale, string> = { ru: "Russian", uk: "Ukrainian", en: "English" };

export const BIO_INSTRUCTIONS = (locale: Locale, startDate: string) => `You write a short biography of one person for Gulf of Trump, an alternate-history grand strategy game whose story begins on ${startDate}.
- Two or three short sentences in ${LANGUAGE[locale]}, plain and factual: where they come from, how they rose, what they are known for so far.
- Their life only up to ${startDate}. Never mention anything after that date: no later offices, deeds, trials, death or how history came to judge them.
- A person known to history: their real life up to that date, with real names, places and years. An invented person: a plausible life that fits the traits, party and career given; invent no famous deeds and no real events they took part in.
- No praise, no judgement, no titles of honour, no lists. Use the short dash (–), never the long one.
Answer with ONE JSON object and nothing else:
{ "bio": "string" }`;

/** Who the biography is about, from what the game knows of them: the leader line, the cabinet and its deputies. */
export function buildBioPrompt(state: GameState, name: string, startDate: string): string {
  const country = state.countries[state.player];
  const known = findKnown(name);
  const official: Official | undefined = [...(state.officials ?? []), ...(state.deputies ?? [])].find((o) => samePerson(o.name, name));
  const lead = country?.rulers?.people.find((p) => samePerson(p.name, name));
  const lines = [
    `COUNTRY: ${country ? en(country.name) : state.player}`,
    `THE GAME BEGINS ON: ${startDate}`,
    `THE PERSON: ${name}${official ? `, ${official.title}` : lead ? `, who leads the country (${country?.leader})` : ""}`,
    known ? `A real person of history, known as ${known.name.en}.` : "Not a figure the record knows: an invented person of this government.",
  ];
  if (official) {
    lines.push(`Traits: ${official.traits.join(", ") || "reserved"}; manner: ${official.manner || "plain"}; competence ${official.competence}/5, loyalty to the leader ${official.loyalty}/5.`);
    if (official.faction) lines.push(`Faction: ${official.faction}.`);
    if (official.interests?.party) lines.push(`Owes the post to: ${official.interests.party}.`);
    if (official.bio) lines.push(`What the game has said of them: ${official.bio}`);
  }
  lines.push("", `Write the biography of ${name}, up to ${startDate}.`);
  return lines.join("\n");
}

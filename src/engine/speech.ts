import { z } from "zod";
import { bioKey } from "./bios";
import { findKnown, leaderOf, samePerson } from "./people";
import { en } from "./text";
import { LOCALES, type GameState, type Locale, type Official, type Session, type SpeechProfile, type Summit, type Talk } from "./types";

/**
 * Each person's own way of speaking: their register, a few turns of phrase,
 * how they argue and lead a talk, what they avoid and their habits of
 * speech. The model writes it once per person and language – from the record
 * for a figure of history, from the traits and manner the game gave an
 * invented one – and the save keeps it by person, like the biographies
 * (engine/bios.ts). Every prompt that has the person speak gets it in a few
 * lines: the ministers' chat and their views of a turn, the deputies, the
 * talks, the meetings, the letters of other governments and the sittings of
 * parliament. It is asked for lazily, only for people about to speak, at
 * most SPEECH_PER_TURN a turn, and never holds a turn up.
 */

/** A way of speaking as the model writes it; only the register is required, the rest may come empty. */
export const SpeechSchema = z.object({
  register: z.string().trim().min(1),
  phrases: z.array(z.string()).catch([]),
  argues: z.string().catch(""),
  avoids: z.string().catch(""),
  tics: z.string().catch(""),
});
export type SpeechReply = z.infer<typeof SpeechSchema>;

/** The longest each part is kept: about a thousand characters for the whole profile. */
export const SPEECH_LIMITS = { register: 200, argues: 240, avoids: 160, tics: 160, phrase: 60 } as const;
/** Turns of phrase kept per person. */
export const MAX_PHRASES = 4;
/** New profiles asked for in one turn: the rest wait for the next. */
export const SPEECH_PER_TURN = 4;
/** People whose way of speaking the save keeps; the earliest written goes first beyond it. */
export const MAX_SPEECH_PEOPLE = 60;
/** Voices given in one prompt with several speakers (a meeting, a sitting). */
const SECTION_PEOPLE = 6;

/** Who a profile is about: the same key as their biography – a known person by their id, anyone else by their name. */
export const speechKey = bioKey;

/** A person's way of speaking: in the language asked for when there is one, else in any language it was written in. */
export function speechOf(state: Pick<GameState, "speechProfiles" | "date">, name: string, locale?: Locale): SpeechProfile | undefined {
  const all = state.speechProfiles?.[speechKey(state, name)];
  if (!all) return undefined;
  return (locale && all[locale]) || LOCALES.map((l) => all[l]).find(Boolean);
}

/** Whether a person's way of speaking has been written in this language. */
export const hasSpeech = (state: Pick<GameState, "speechProfiles" | "date">, name: string, locale: Locale): boolean => Boolean(state.speechProfiles?.[speechKey(state, name)]?.[locale]);

/** One line of the model's text, on one line, with short dashes, cut at a word to `max` characters. */
function clip(text: string, max: number): string {
  const one = text.replace(/\s+/g, " ").replaceAll("—", "–").trim();
  if (one.length <= max) return one;
  const cut = one.slice(0, max - 1);
  const at = cut.lastIndexOf(" ");
  return `${(at > max / 2 ? cut.slice(0, at) : cut).replace(/[\s,;:–-]+$/, "")}…`;
}

/** A turn of phrase without its quotation marks. */
const unquote = (phrase: string) => phrase.trim().replace(/^["«»“”„'‘’]+|["«»“”„'‘’]+$/g, "").trim();

/**
 * The model's answer as the save keeps it: every part on one line, with
 * short dashes, cut to its limit; at most MAX_PHRASES turns of phrase, each
 * once. Nothing usable without a register.
 */
export function cleanSpeech(reply: Partial<SpeechReply> | null | undefined): SpeechProfile | null {
  if (!reply || typeof reply !== "object") return null;
  const text = (value: unknown, max: number) => (typeof value === "string" ? clip(value, max) : "");
  const register = text(reply.register, SPEECH_LIMITS.register);
  if (!register) return null;
  const phrases: string[] = [];
  for (const raw of Array.isArray(reply.phrases) ? reply.phrases : []) {
    const phrase = typeof raw === "string" ? clip(unquote(raw), SPEECH_LIMITS.phrase) : "";
    if (phrase && !phrases.some((p) => p.toLowerCase() === phrase.toLowerCase())) phrases.push(phrase);
    if (phrases.length >= MAX_PHRASES) break;
  }
  return { register, phrases, argues: text(reply.argues, SPEECH_LIMITS.argues), avoids: text(reply.avoids, SPEECH_LIMITS.avoids), tics: text(reply.tics, SPEECH_LIMITS.tics) };
}

/**
 * The game with a person's way of speaking in a language; written once, so a
 * second answer changes nothing. Beyond MAX_SPEECH_PEOPLE the earliest
 * person written goes.
 */
export function addSpeech<T extends Pick<GameState, "speechProfiles" | "date">>(state: T, name: string, locale: Locale, reply: Partial<SpeechReply> | SpeechProfile): T {
  const key = speechKey(state, name);
  const profile = cleanSpeech(reply);
  if (!profile || state.speechProfiles?.[key]?.[locale]) return state;
  const kept = Object.entries(state.speechProfiles ?? {}).filter(([k]) => k !== key);
  const room = kept.slice(Math.max(0, kept.length - (MAX_SPEECH_PEOPLE - 1)));
  return { ...state, speechProfiles: { ...Object.fromEntries(room), [key]: { ...state.speechProfiles?.[key], [locale]: profile } } };
}

const LANGUAGE: Record<Locale, string> = { ru: "Russian", uk: "Ukrainian", en: "English" };

export const SPEECH_INSTRUCTIONS = (locale: Locale, date: string) => `You describe how one person speaks, for Gulf of Trump, an alternate-history grand strategy game; the story is now at ${date}. The game master uses it to give this person a voice of their own wherever they speak: in the cabinet, at talks and meetings, in letters, in parliament.
- A person known to history: their documented manner of speech up to ${date} – as their speeches, transcripts, letters and the memoirs of those who worked with them show it. Turns of phrase they really used, or close to them; nothing said only after ${date}, and no later events.
- An invented person: a manner that follows from the traits, the manner, the party and the career given; invent no famous sayings.
- Describe manner, never identity: no accent or broken grammar spelled out, no ethnic, national, religious, class or gender stereotypes, no slurs, insults or obscenities even where the person used them (write "swears freely" instead), no mockery and no caricature. Describe a figure of history in a sober voice, as a careful biographer would, whatever history thinks of them.
- Write in ${LANGUAGE[locale]}, briefly:
  "register": one sentence – how formal or plain, how long their sentences, how they address superiors, equals and opponents, their temper;
  "phrases": two to four short turns of phrase they would use, a few words each, as they would say them in ${LANGUAGE[locale]};
  "argues": one or two sentences – how they argue and lead a talk: questions or statements, figures or pressure, flattery, threats, jokes or silence, how they close a conversation;
  "avoids": one sentence – what they never say or do in talk;
  "tics": one sentence – habits of speech: a word they repeat, how they open or close, proverbs, figures, sarcasm; empty if none.
- Use the short dash (–), never the long one.
Answer with ONE JSON object and nothing else:
{ "register": "string", "phrases": ["string"], "argues": "string", "avoids": "string", "tics": "string" }`;

/** Who a person is in the game: a post in the government, a country they lead, a party, the other side of talks. */
function whoIs(state: GameState, name: string): { role?: string; official?: Official } {
  const official = [...(state.officials ?? []), ...(state.deputies ?? [])].find((o) => samePerson(o.name, name));
  const player = state.countries[state.player];
  if (official) return { role: `${official.title} in the government of ${player ? en(player.name) : state.player}`, official };
  const id = speechKey(state, name);
  const led = Object.keys(state.countries).find((tag) => leaderOf(state, tag)?.id === id);
  if (led) return { role: `who leads ${en(state.countries[led].name)}` };
  const party = state.politics?.parties.find((p) => p.leader && samePerson(p.leader, name));
  if (party) return { role: `leader of ${party.name} (${party.ideology}; ${party.status}) in ${player ? en(player.name) : state.player}` };
  const talk = state.politics?.talks?.find((t) => samePerson(t.counterpart, name));
  if (talk) return { role: `who speaks for "${talk.title}" (a ${talk.with}) in talks with the government of ${player ? en(player.name) : state.player}` };
  const line = (state.summits ?? []).flatMap((s) => s.transcript ?? []).find((l) => l.speaker && samePerson(l.speaker, name));
  if (line) return { role: `who speaks for ${en(state.countries[line.country]?.name ?? line.country)}` };
  return {};
}

/** Who the profile is about, from what the game knows of them. */
export function buildSpeechPrompt(state: GameState, name: string, startDate: string): string {
  const known = findKnown(name);
  const { role, official } = whoIs(state, name);
  const bio = state.bios?.[speechKey(state, name)];
  const lines = [
    `THE DATE: ${state.date} (the game began on ${startDate})`,
    `THE PERSON: ${name}${role ? `, ${role}` : ""}`,
    known ? `A real person of history, known as ${known.name.en}.` : "Not a figure the record knows: an invented person of this game.",
  ];
  if (official) {
    lines.push(`Traits: ${official.traits.join(", ") || "reserved"}; manner: ${official.manner || "plain"}.`);
    if (official.faction) lines.push(`Faction: ${official.faction}.`);
    if (official.bio) lines.push(`What the game has said of them: ${official.bio}`);
  }
  const life = bio && LOCALES.map((l) => bio[l]).find(Boolean);
  if (life) lines.push(`Their life so far: ${life}`);
  lines.push("", `Describe how ${name} speaks, as of ${state.date}.`);
  return lines.join("\n");
}

/** A profile in a few sentences, for a prompt. */
export function speechLine(p: SpeechProfile): string {
  const end = (s: string) => (/[.!?…»"]$/.test(s) ? s : `${s}.`);
  const parts = [end(p.register)];
  if (p.argues) parts.push(`In argument and talk: ${end(p.argues)}`);
  if (p.avoids) parts.push(`Avoids: ${end(p.avoids)}`);
  if (p.tics) parts.push(`Habits: ${end(p.tics)}`);
  if (p.phrases.length) parts.push(`Turns of phrase: ${p.phrases.map((x) => `«${x}»`).join(", ")}.`);
  return parts.join(" ");
}

/** The way of speaking of a person who speaks as "you" (a minister, a deputy), or nothing before it is written. */
export function speechPersona(state: GameState, name: string, locale?: Locale): string {
  const p = speechOf(state, name, locale);
  return p ? ` YOUR OWN WAY OF SPEAKING (keep it in every answer; a turn of phrase of yours now and then, never in every answer and never as a caricature): ${speechLine(p)}` : "";
}

/** The ways of speaking of the people of a scene who have one, as a section of its prompt; nothing when none has. */
export function speechSection(state: GameState, names: (string | undefined)[], locale?: Locale): string[] {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const name of names) {
    if (!name?.trim() || lines.length >= SECTION_PEOPLE) continue;
    const key = speechKey(state, name);
    if (seen.has(key)) continue;
    seen.add(key);
    const p = speechOf(state, name, locale);
    if (p) lines.push(`- ${name}: ${speechLine(p)}`);
  }
  return lines.length ? ["", "HOW THEY SPEAK (keep each voice – register, argument, what they avoid; a turn of phrase now and then, never in every line and never as a caricature):", ...lines] : [];
}

/** The leaders of a meeting's other participants, the largest first, as many as `count`. */
export function summitSpeakers(state: GameState, summit: Pick<Summit, "participants" | "transcript">, count = 3): string[] {
  const gdp = (tag: string) => state.countries[tag]?.economy?.gdp ?? 0;
  const leaders = summit.participants
    .filter((t) => t !== state.player && state.countries[t])
    .sort((a, b) => gdp(b) - gdp(a))
    .slice(0, count)
    .map((t) => leaderOf(state, t)?.name);
  const said = (summit.transcript ?? []).filter((l) => l.country !== state.player).map((l) => l.speaker);
  return [...leaders, ...said].filter((n): n is string => Boolean(n?.trim()));
}

/** The leaders of the parties in the house, the largest first, as many as `count`. */
export function sessionSpeakers(state: GameState, session: Pick<Session, "transcript">, count = 3): string[] {
  const parties = [...(state.politics?.parties ?? [])].filter((p) => (p.seats ?? 0) > 0).sort((a, b) => (b.seats ?? 0) - (a.seats ?? 0));
  const leaders = parties.slice(0, count).map((p) => p.leader);
  const said = session.transcript.filter((l) => !l.player).map((l) => l.speaker);
  return [...leaders, ...said].filter((n): n is string => Boolean(n?.trim()) && n !== "-");
}

/** Who speaks for the other side of talks. */
export const talkSpeakers = (talk: Pick<Talk, "counterpart" | "transcript">): string[] => [talk.counterpart, ...talk.transcript.filter((l) => !l.player).map((l) => l.speaker)].filter((n) => Boolean(n?.trim()));

/**
 * The people of a scene whose way of speaking is still to be asked for in a
 * language: each once, none already asked for (`asked`, by `<key>:<locale>`),
 * at most `budget` of them.
 */
export function speechWanted(state: Pick<GameState, "speechProfiles" | "date">, names: (string | undefined)[], locale: Locale, asked: ReadonlySet<string>, budget: number): string[] {
  const out: string[] = [];
  const keys = new Set<string>();
  for (const name of names) {
    if (out.length >= budget) break;
    const clean = name?.trim();
    if (!clean || clean.length > 120) continue;
    const key = `${speechKey(state, clean)}:${locale}`;
    if (keys.has(key) || asked.has(key) || hasSpeech(state, clean, locale)) continue;
    keys.add(key);
    out.push(clean);
  }
  return out;
}

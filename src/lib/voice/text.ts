import type { ChronicleEntry, Locale } from "@/engine/types";

/**
 * The plain parts of voice: which voice reads a language, what the text
 * sounds like with its markup taken out, how dictated words join what is
 * already typed. No browser APIs here, so the tests run them directly.
 */

/** Language tags the speech engines expect for the game's languages. */
export const SPEECH_LANG: Record<Locale, string> = { en: "en-US", ru: "ru-RU", uk: "uk-UA" };

/** The languages whose voices may read a locale, best first: a Russian voice reads Ukrainian far better than an English one. */
export const VOICE_LANGS: Record<Locale, string[]> = { en: ["en"], ru: ["ru", "uk"], uk: ["uk", "ru"] };

/** What the game needs of a speechSynthesis voice. */
export interface VoiceLike {
  name: string;
  lang: string;
  voiceURI: string;
  localService: boolean;
}

/** "ru-RU", "ru_RU", "RU" → "ru". */
export const baseLang = (lang: string) => lang.toLowerCase().split(/[-_]/)[0] ?? "";

/** How good a voice tends to sound: the neural ones of Edge and Windows, then Google's, then the rest. */
function quality(v: VoiceLike): number {
  if (/natural|neural/i.test(v.name)) return 3;
  if (/google/i.test(v.name)) return 2;
  if (/online/i.test(v.name)) return 1;
  return 0;
}

/**
 * The voice for a locale: the one picked in Settings when it reads this
 * language, else the best voice of the language, else the best stand-in
 * (`standIn`), else none — the engine then picks by the language tag.
 */
export function pickVoice<V extends VoiceLike>(voices: readonly V[], locale: Locale, wanted?: string): { voice: V | null; standIn: boolean } {
  const langs = VOICE_LANGS[locale];
  const chosen = wanted ? voices.find((v) => v.voiceURI === wanted && langs.includes(baseLang(v.lang))) : undefined;
  if (chosen) return { voice: chosen, standIn: false };
  for (const [i, lang] of langs.entries()) {
    const best = voices.filter((v) => baseLang(v.lang) === lang).sort((a, b) => quality(b) - quality(a))[0];
    if (best) return { voice: best, standIn: i > 0 };
  }
  return { voice: null, standIn: true };
}

/** The voices worth offering for a locale in Settings, its own language first. */
export function voicesFor<V extends VoiceLike>(voices: readonly V[], locale: Locale): V[] {
  const langs = VOICE_LANGS[locale];
  return voices
    .filter((v) => langs.includes(baseLang(v.lang)))
    .sort((a, b) => langs.indexOf(baseLang(a.lang)) - langs.indexOf(baseLang(b.lang)) || quality(b) - quality(a) || a.name.localeCompare(b.name));
}

const PICTOGRAPHS = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}‍︎️]/gu;

/** The text as it should sound: no markdown, links, emoji or arrows read out loud, lines ending as sentences. */
export function cleanForSpeech(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/`+/g, "")
    .replace(/(\*\*|__|\*|~~)(?=\S)([\s\S]*?\S)\1/g, "$2")
    .replace(/^\s{0,3}(?:#{1,6}|>|[-*•·]|\d+[.)])\s+/gm, "")
    .replace(PICTOGRAPHS, "")
    .replace(/\s*[→⇒➝]\s*/g, ", ")
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .map((line) => (/[.!?…:;]$/.test(line) ? line : `${line}.`))
    .join(" ");
}

/**
 * Pieces short enough for every engine, cut at sentence ends (Chrome's
 * online voices stop after about fifteen seconds of one utterance).
 */
export function splitForSpeech(text: string, max = 220): string[] {
  const pieces: string[] = [];
  let current = "";
  const push = (part: string) => {
    if (!current) current = part;
    else if (current.length + 1 + part.length <= max) current += ` ${part}`;
    else {
      pieces.push(current);
      current = part;
    }
  };
  for (const sentence of text.split(/(?<=[.!?…])\s+/)) {
    if (sentence.length <= max) {
      push(sentence);
      continue;
    }
    // A sentence too long for one piece breaks at its commas, then at its spaces.
    for (const clause of sentence.split(/(?<=[,;:])\s+/)) {
      if (clause.length <= max) push(clause);
      else for (const word of clause.split(/\s+/)) push(word);
    }
  }
  if (current) pieces.push(current);
  return pieces;
}

/** What "read aloud" says for a turn: the headline, the story and the world's events. */
export function turnSpeech(entry: Pick<ChronicleEntry, "headline" | "narrative" | "events">): string {
  return [entry.headline, entry.narrative, ...entry.events.flatMap((e) => [e.title, e.body ?? ""])].filter(Boolean).join("\n");
}

/** Dictated words added to what is typed: a space between, a capital after a full stop, no more than `max`. */
export function appendDictation(current: string, words: string, max = Infinity): string {
  let added = words.replace(/\s+/g, " ").trim();
  if (!added) return current;
  const before = current.replace(/[ \t]+$/, "");
  if (!before.trim() || /[.!?…]\s*$/.test(before)) added = added[0]!.toLocaleUpperCase() + added.slice(1);
  const glue = !before || before.endsWith("\n") || /^[,.!?;:…]/.test(added) ? "" : " ";
  return `${before}${glue}${added}`.slice(0, max);
}

/** What Whisper writes over silence and noise, learned from film subtitles: credits, thanks, sound labels. */
const INVENTED = [
  /субтитры (?:сделал|создавал|подготовил|делал)[^.!?\n]*[.!?]?/giu,
  /редактор субтитров[^.!?\n]*[.!?]?/giu,
  /корректор [А-ЯЁA-Z]\.\s?[^.!?\n]*[.!?]?/gu,
  /dimatorzok/giu,
  /продолжение следует\.*/giu,
  /спасибо за просмотр[!.]*/giu,
  /дякую за перегляд[!.]*/giu,
  /thanks? (?:you )?for watching[!.]*/giu,
  /[[(](?:музыка|музика|music|аплодисменты|оплески|applause|смех|сміх|laughter|тишина|silence)[\])]/giu,
];

/** A transcript without Whisper's inventions and stray spaces. */
export function cleanTranscript(text: string): string {
  let out = text;
  for (const pattern of INVENTED) out = out.replace(pattern, " ");
  return out.replace(/\s+/g, " ").replace(/\s+([,.!?;:])/g, "$1").trim();
}

/** Too quiet to hold speech: the root mean square of the samples below the threshold. */
export function isSilent(samples: Float32Array, threshold = 0.006): boolean {
  if (!samples.length) return true;
  let sum = 0;
  for (const s of samples) sum += s * s;
  return Math.sqrt(sum / samples.length) < threshold;
}

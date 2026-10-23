/**
 * The game's own voices, for computers whose system has none for the
 * language (docs/built-in-voice.md): Ukrainian (Piper `ukrainian_tts`, data
 * CC0) and Russian (UtrobinTTS, Apache-2.0). Both read plain letters, so the
 * text only has to be spelt out the way it sounds – numbers in words, Latin
 * in Cyrillic – and turned into the model's ids. No browser APIs here; the
 * worker (public/voice/tts-worker.js) runs the models.
 */

export type BuiltinLang = "ru" | "uk";

export interface BuiltinVoice {
  lang: BuiltinLang;
  /** How the worker feeds the model. */
  kind: "piper" | "vits";
  /** The model file, from a fixed revision, checked against its SHA-256. */
  url: string;
  sha256: string;
  bytes: number;
  sampleRate: number;
  /** The model's speakers, by id, with their names in the interface. */
  speakers: { id: number; name: Record<"ru" | "uk" | "en", string> }[];
  /** Where it came from and under what licence, for About. */
  credit: { name: string; url: string; licence: string };
}

export const BUILTIN_VOICES: Record<BuiltinLang, BuiltinVoice> = {
  uk: {
    lang: "uk",
    kind: "piper",
    url: "https://huggingface.co/rhasspy/piper-voices/resolve/5041a7a49ae5b3a0f30e6837769eb03fdbb231bd/uk/uk_UA/ukrainian_tts/medium/uk_UA-ukrainian_tts-medium.onnx",
    sha256: "7920419ac5f6fd8b6450520f24b52ed5a319cb53dd018fbcd71c9e079cbac84f",
    bytes: 76_735_663,
    sampleRate: 22050,
    speakers: [
      { id: 0, name: { ru: "Лада", uk: "Лада", en: "Lada" } },
      { id: 1, name: { ru: "Микита", uk: "Микита", en: "Mykyta" } },
      { id: 2, name: { ru: "Тетяна", uk: "Тетяна", en: "Tetiana" } },
    ],
    credit: { name: "Piper · ukrainian_tts (medium)", url: "https://huggingface.co/rhasspy/piper-voices/tree/main/uk/uk_UA/ukrainian_tts/medium", licence: "MIT; data CC0" },
  },
  ru: {
    lang: "ru",
    kind: "vits",
    url: "https://huggingface.co/utrobinmv/tts_ru_free_hf_vits_low_multispeaker/resolve/0e9a39581aac24f21487004f7e4f6c4c8c441de2/model.onnx",
    sha256: "03ee7618a7c7930dde43489153a6e21f6619eec6a5497aed551ddd29b10eb15c",
    bytes: 50_849_741,
    sampleRate: 16000,
    speakers: [
      { id: 0, name: { ru: "женский", uk: "жіночий", en: "female" } },
      { id: 1, name: { ru: "мужской", uk: "чоловічий", en: "male" } },
    ],
    credit: { name: "UtrobinTTS · tts_ru_free_hf_vits_low_multispeaker", url: "https://huggingface.co/utrobinmv/tts_ru_free_hf_vits_low_multispeaker", licence: "Apache-2.0" },
  },
};

/** The runtime both voices share (onnxruntime-web), in bytes, for the download's size. */
export const RUNTIME_BYTES = 11_279_369;

/** About what the first use of a voice downloads, in MB: its model and the runtime. */
export const downloadMb = (lang: BuiltinLang) => Math.round((BUILTIN_VOICES[lang].bytes + RUNTIME_BYTES) / 1_000_000 / 5) * 5;

export const isBuiltinLang = (lang: string): lang is BuiltinLang => lang === "ru" || lang === "uk";

/** The Settings value of a built-in voice ("builtin:uk:1"), and back. */
export const builtinChoice = (lang: BuiltinLang, speaker: number) => `builtin:${lang}:${speaker}`;
export function parseBuiltinChoice(value: string): { lang: BuiltinLang; speaker: number } | null {
  const m = /^builtin:(ru|uk):(\d+)$/.exec(value);
  if (!m) return null;
  const lang = m[1] as BuiltinLang;
  const speaker = Number(m[2]);
  return BUILTIN_VOICES[lang].speakers.some((s) => s.id === speaker) ? { lang, speaker } : null;
}

// ——— Numbers in words ———

/** one, few, many, and the form after a fraction ("2,5 мільйона"). */
type Forms = [string, string, string, string];

interface Words {
  zero: string;
  ones: string[];
  onesF: [string, string];
  teens: string[];
  tens: string[];
  hundreds: string[];
  /** Thousand (feminine), million, billion, trillion. */
  scales: Forms[];
  minus: string;
  /** "целая/целых", "десятая/десятых", "сотая/сотых". */
  whole: [string, string];
  tenth: [string, string];
  hundredth: [string, string];
  point: string;
  units: Record<string, Forms>;
}

const RU: Words = {
  zero: "ноль",
  ones: ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"],
  onesF: ["одна", "две"],
  teens: ["десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"],
  tens: ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"],
  hundreds: ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"],
  scales: [
    ["тысяча", "тысячи", "тысяч", "тысячи"],
    ["миллион", "миллиона", "миллионов", "миллиона"],
    ["миллиард", "миллиарда", "миллиардов", "миллиарда"],
    ["триллион", "триллиона", "триллионов", "триллиона"],
  ],
  minus: "минус",
  whole: ["целая", "целых"],
  tenth: ["десятая", "десятых"],
  hundredth: ["сотая", "сотых"],
  point: "запятая",
  units: {
    "%": ["процент", "процента", "процентов", "процента"],
    $: ["доллар", "доллара", "долларов", "доллара"],
    "€": ["евро", "евро", "евро", "евро"],
    "₽": ["рубль", "рубля", "рублей", "рубля"],
    "₴": ["гривна", "гривны", "гривен", "гривны"],
    км: ["километр", "километра", "километров", "километра"],
  },
};

const UK: Words = {
  zero: "нуль",
  ones: ["", "один", "два", "три", "чотири", "п'ять", "шість", "сім", "вісім", "дев'ять"],
  onesF: ["одна", "дві"],
  teens: ["десять", "одинадцять", "дванадцять", "тринадцять", "чотирнадцять", "п'ятнадцять", "шістнадцять", "сімнадцять", "вісімнадцять", "дев'ятнадцять"],
  tens: ["", "", "двадцять", "тридцять", "сорок", "п'ятдесят", "шістдесят", "сімдесят", "вісімдесят", "дев'яносто"],
  hundreds: ["", "сто", "двісті", "триста", "чотириста", "п'ятсот", "шістсот", "сімсот", "вісімсот", "дев'ятсот"],
  scales: [
    ["тисяча", "тисячі", "тисяч", "тисячі"],
    ["мільйон", "мільйони", "мільйонів", "мільйона"],
    ["мільярд", "мільярди", "мільярдів", "мільярда"],
    ["трильйон", "трильйони", "трильйонів", "трильйона"],
  ],
  minus: "мінус",
  whole: ["ціла", "цілих"],
  tenth: ["десята", "десятих"],
  hundredth: ["сота", "сотих"],
  point: "кома",
  units: {
    "%": ["відсоток", "відсотки", "відсотків", "відсотка"],
    $: ["долар", "долари", "доларів", "долара"],
    "€": ["євро", "євро", "євро", "євро"],
    "₽": ["рубль", "рублі", "рублів", "рубля"],
    "₴": ["гривня", "гривні", "гривень", "гривні"],
    км: ["кілометр", "кілометри", "кілометрів", "кілометра"],
  },
};

const WORDS: Record<BuiltinLang, Words> = { ru: RU, uk: UK };

/** Which of one/few/many a whole number takes. */
export function pluralIndex(n: number): 0 | 1 | 2 {
  const h = n % 100;
  if (h >= 11 && h <= 14) return 2;
  const d = n % 10;
  if (d === 1) return 0;
  if (d >= 2 && d <= 4) return 1;
  return 2;
}

/** 0–999 in words; `feminine` for thousands and fractions ("одна", "две"). */
function hundredsInWords(n: number, w: Words, feminine: boolean): string[] {
  const out: string[] = [];
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h) out.push(w.hundreds[h]!);
  if (rest >= 10 && rest < 20) out.push(w.teens[rest - 10]!);
  else {
    const t = Math.floor(rest / 10);
    const o = rest % 10;
    if (t) out.push(w.tens[t]!);
    if (o) out.push(feminine && o <= 2 ? w.onesF[o - 1]! : w.ones[o]!);
  }
  return out;
}

/** A whole number in words, up to the trillions. */
export function numberInWords(n: number, lang: BuiltinLang, feminine = false): string {
  const w = WORDS[lang];
  if (!Number.isFinite(n)) return "";
  if (n < 0) return `${w.minus} ${numberInWords(-n, lang, feminine)}`;
  n = Math.floor(n);
  if (n === 0) return w.zero;
  if (n >= 1e15) return String(n).split("").map((d) => (d === "0" ? w.zero : w.ones[Number(d)])).join(" ");
  const parts: string[] = [];
  const groups: number[] = [];
  for (let rest = n; rest > 0; rest = Math.floor(rest / 1000)) groups.push(rest % 1000);
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i]!;
    if (!g) continue;
    // Thousands are feminine; the units group follows what is counted.
    parts.push(...hundredsInWords(g, w, i === 1 || (i === 0 && feminine)));
    if (i > 0) parts.push(w.scales[i - 1]![pluralIndex(g)]!);
  }
  return parts.join(" ");
}

/** "42,8" → "сорок две целых восемь десятых"; longer fractions digit by digit after "запятая". */
export function decimalInWords(whole: number, fraction: string, lang: BuiltinLang): string {
  const w = WORDS[lang];
  if (fraction.length > 2) {
    const digits = fraction.split("").map((d) => (d === "0" ? w.zero : w.ones[Number(d)])).join(" ");
    return `${numberInWords(whole, lang)} ${w.point} ${digits}`;
  }
  const num = Number(fraction);
  const [one, many] = fraction.length === 1 ? w.tenth : w.hundredth;
  const wholePart = `${numberInWords(whole, lang, true)} ${pluralIndex(whole) === 0 ? w.whole[0] : w.whole[1]}`;
  return `${wholePart} ${numberInWords(num, lang, true)} ${pluralIndex(num) === 0 ? one : many}`;
}

// ——— Text as it sounds ———

/** Latin as Cyrillic, roughly, for names and abbreviations a Cyrillic voice cannot read. */
const LATIN_PAIRS: [RegExp, Record<BuiltinLang, string>][] = [
  [/sh/g, { ru: "ш", uk: "ш" }],
  [/ch/g, { ru: "ч", uk: "ч" }],
  [/zh/g, { ru: "ж", uk: "ж" }],
  [/kh/g, { ru: "х", uk: "х" }],
  [/ts/g, { ru: "ц", uk: "ц" }],
  [/ya/g, { ru: "я", uk: "я" }],
  [/yu/g, { ru: "ю", uk: "ю" }],
  [/oo/g, { ru: "у", uk: "у" }],
  [/ee/g, { ru: "и", uk: "і" }],
  [/th/g, { ru: "т", uk: "т" }],
  [/ph/g, { ru: "ф", uk: "ф" }],
];
const LATIN: Record<BuiltinLang, Record<string, string>> = {
  ru: { a: "а", b: "б", c: "к", d: "д", e: "е", f: "ф", g: "г", h: "х", i: "и", j: "дж", k: "к", l: "л", m: "м", n: "н", o: "о", p: "п", q: "к", r: "р", s: "с", t: "т", u: "у", v: "в", w: "в", x: "кс", y: "и", z: "з" },
  uk: { a: "а", b: "б", c: "к", d: "д", e: "е", f: "ф", g: "ґ", h: "г", i: "і", j: "дж", k: "к", l: "л", m: "м", n: "н", o: "о", p: "п", q: "к", r: "р", s: "с", t: "т", u: "у", v: "в", w: "в", x: "кс", y: "і", z: "з" },
};

function latinToCyrillic(word: string, lang: BuiltinLang): string {
  let s = word.toLowerCase();
  for (const [pattern, to] of LATIN_PAIRS) s = s.replace(pattern, to[lang]);
  return s.replace(/[a-z]/g, (c) => LATIN[lang][c] ?? "");
}

const SCALE_ABBR: Record<string, number> = { тыс: 0, тис: 0, млн: 1, млрд: 2, трлн: 3 };

/** Letter names, for abbreviations said letter by letter ("СССР", "США"). */
const LETTERS: Record<BuiltinLang, Record<string, string>> = {
  ru: { а: "а", б: "бэ", в: "вэ", г: "гэ", д: "дэ", е: "е", ё: "ё", ж: "жэ", з: "зэ", и: "и", й: "и краткое", к: "ка", л: "эль", м: "эм", н: "эн", о: "о", п: "пэ", р: "эр", с: "эс", т: "тэ", у: "у", ф: "эф", х: "ха", ц: "цэ", ч: "че", ш: "ша", щ: "ща", ы: "ы", э: "э", ю: "ю", я: "я" },
  uk: { а: "а", б: "бе", в: "ве", г: "ге", ґ: "ґе", д: "де", е: "е", є: "є", ж: "же", з: "зе", и: "и", і: "і", ї: "ї", й: "й", к: "ка", л: "ел", м: "ем", н: "ен", о: "о", п: "пе", р: "ер", с: "ес", т: "те", у: "у", ф: "еф", х: "ха", ц: "це", ч: "че", ш: "ша", щ: "ща", ю: "ю", я: "я" },
};
const VOWELS: Record<BuiltinLang, RegExp> = { ru: /[аеёиоуыэюя]/g, uk: /[аеєиіїоуюя]/g };
/** Read as words although they have one vowel. */
const AS_WORDS = new Set(["мид", "вуз", "ес"]);
/** Said otherwise than by their letters' names. */
const SAID: Record<BuiltinLang, Record<string, string>> = { ru: { сша: "сэ шэ а" }, uk: { сша: "ес ше а" } };

/** An abbreviation in capitals with at most one vowel ("СССР", "ВВП", "США") is said letter by letter; "НАТО" and "ООН" as words. */
function spellAbbreviation(word: string, lang: BuiltinLang): string {
  const lower = word.toLowerCase();
  if (SAID[lang][lower]) return SAID[lang][lower]!;
  if (AS_WORDS.has(lower) || (lower.match(VOWELS[lang])?.length ?? 0) > 1) return word;
  return lower
    .split("")
    .map((c) => LETTERS[lang][c] ?? c)
    .join(" ");
}

/**
 * A text as the built-in voice should say it: numbers (with their thousands
 * spaces, decimals, signs, %, currencies and "млн") in words that agree with
 * them, Latin spelt in Cyrillic, dashes as pauses.
 */
export function spokenText(text: string, lang: BuiltinLang): string {
  const w = WORDS[lang];
  let s = text
    .replace(/[   ]/g, " ")
    .replace(/[’ʼ`´]/g, "'")
    .replace(/…/g, ".")
    .replace(/№\s*/g, "номер ")
    // The year's "г." / "р." after its number is not said.
    .replace(/(\d)\s?(?:гг?|рр?)\.(?=\s|$|[,;:])/g, "$1")
    .replace(/\+(?=\s?\d)/g, "плюс ")
    .replace(/\+/g, " ");
  // Thousands written apart: "14 003 203" → "14003203".
  s = s.replace(/\d{1,3}(?: \d{3})+(?!\d)/g, (m) => m.replace(/ /g, ""));
  // A currency sign before its number goes after it and its scale: "$42,8 млрд" → "42,8 млрд $".
  s = s.replace(/([$€₽₴])\s?(\d+(?:[.,]\d+)?)(\s?(?:тыс|тис|млн|млрд|трлн)\.?)?/g, (_m, sign: string, num: string, scale = "") => `${num}${scale} ${sign}`);
  // A number with what it counts.
  s = s.replace(
    /(^|[^\p{L}\d])([−-])?(\d+)(?:[.,](\d+))?(\s?(?:тыс|тис|млн|млрд|трлн)\.?)?(\s?(?:%|[$€₽₴]|км\b))?/gu,
    (_m, before: string, sign: string | undefined, int: string, frac: string | undefined, scale: string | undefined, unit: string | undefined) => {
      const whole = Number(int);
      const words: string[] = [];
      if (sign) words.push(w.minus);
      const fraction = frac !== undefined;
      // Thousands and the hryvnia are feminine: "две тысячи", "дві гривні".
      const feminine = /^(?:тыс|тис)/.test(scale?.trim() ?? "") || (!scale && unit?.trim() === "₴");
      words.push(fraction ? decimalInWords(whole, frac!, lang) : numberInWords(whole, lang, feminine));
      // The form the next word takes: after a fraction its own; otherwise by the whole number.
      const formOf = (forms: Forms) => (fraction ? forms[3] : forms[pluralIndex(whole)]);
      let afterScale = false;
      if (scale) {
        const key = scale.trim().replace(/\.$/, "");
        const forms = w.scales[SCALE_ABBR[key] ?? 0]!;
        words.push(formOf(forms));
        afterScale = true;
      }
      if (unit) {
        const forms = w.units[unit.trim()];
        // After "млн" and the like whatever is counted is in the genitive plural.
        if (forms) words.push(afterScale ? forms[2] : formOf(forms));
      }
      return `${before}${words.join(" ")}`;
    },
  );
  // Abbreviations in capitals, then Latin words.
  s = s.replace(/(?<![\p{L}])[А-ЯЁЄІЇҐ]{2,5}(?![\p{L}])/gu, (m) => spellAbbreviation(m, lang));
  s = s.replace(/[A-Za-z]+/g, (m) => latinToCyrillic(m, lang));
  return s
    .replace(/\s*[–—]\s*/g, ", ")
    .replace(/[()«»"„“”]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ——— Ids for the models ———

/** Piper `ukrainian_tts`: its letters, punctuation and combining marks. */
const UK_IDS: Record<string, number> = {
  _: 0, "^": 1, $: 2, " ": 3, "!": 4, "'": 5, ",": 6, "-": 7, ".": 8, ":": 9, ";": 10, "?": 11,
  а: 12, б: 13, в: 14, г: 15, ґ: 16, д: 17, е: 18, є: 19, ж: 20, з: 21, и: 22, і: 23, ї: 24, й: 25, к: 26, л: 27, м: 28, н: 29, о: 30,
  п: 31, р: 32, с: 33, т: 34, у: 35, ф: 36, х: 37, ц: 38, ч: 39, ш: 40, щ: 41, ь: 42, ю: 43, я: 44, "́": 45, "̆": 46, "̈": 47, "—": 48,
};

/** UtrobinTTS: Russian letters, a little punctuation, "+" before a stressed vowel. */
const RU_IDS: Record<string, number> = {
  " ": 0, _: 1, ":": 2, а: 3, б: 4, в: 5, г: 6, д: 7, е: 8, ё: 9, ж: 10, з: 11, и: 12, й: 13, к: 14, л: 15, м: 16, н: 17, о: 18, п: 19, р: 20,
  с: 21, т: 22, у: 23, ф: 24, х: 25, ц: 26, ч: 27, ш: 28, щ: 29, ъ: 30, ы: 31, ь: 32, э: 33, ю: 34, я: 35, ".": 36, "!": 37, "?": 38, ",": 39, "+": 40,
};

/**
 * The ids a voice reads a text by.
 * - Piper: lower case, decomposed the way Piper decomposes letters (й → и +
 *   breve), each symbol followed by the pad, between the start and end marks.
 * - VITS: lower case, each letter between blanks (id 0), as its tokenizer
 *   adds them.
 * What a voice has no symbol for is left out.
 */
export function voiceIds(text: string, lang: BuiltinLang): number[] {
  const spoken = spokenText(text, lang).toLowerCase();
  if (lang === "uk") {
    const ids = [UK_IDS["^"]!, UK_IDS._!];
    for (const ch of spoken.normalize("NFD")) {
      const id = UK_IDS[ch];
      if (id !== undefined && ch !== "_" && ch !== "^" && ch !== "$") ids.push(id, UK_IDS._!);
    }
    ids.push(UK_IDS.$!);
    return ids;
  }
  const ids = [0];
  const ru = spoken.replace(/[;]/g, ",").replace(/-/g, " ").replace(/'/g, "");
  for (const ch of ru) {
    const id = RU_IDS[ch];
    if (id !== undefined && ch !== "_") ids.push(id, 0);
  }
  return ids;
}

/** Whether a piece has anything a voice would say (not only blanks and marks). */
export const hasSpeech = (ids: number[], lang: BuiltinLang) => ids.some((id) => (lang === "uk" ? id >= 12 && id <= 44 : id >= 3 && id <= 35));

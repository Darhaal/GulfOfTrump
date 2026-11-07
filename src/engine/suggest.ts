import { z } from "zod";
import { IN_CHARACTER, LANGUAGE } from "./prompts";
import { en } from "./text";
import type { GameState, Locale, Renamable } from "./types";

/**
 * Small help from the game master between turns: names to choose from when
 * the player renames something by order (a post, a ministry, the ruling
 * party, the movement, a war, a formation), and an order of the player's
 * drafted in the style of a decree – the same meaning, tidier and shorter;
 * and the remit of a ministry the government is creating, from its name and
 * the player's own words, corrected. Nothing here changes the game: the player picks a line, and it goes into
 * the orders like any other.
 */

/** What a rename may be suggested for: the post's title (engine/government.ts) beside what acts rename (engine/acts.ts). */
export type SuggestWhat = Renamable | "post";
export const SUGGEST_WHATS: readonly SuggestWhat[] = ["post", "ministry", "party", "movement", "war", "formation"];

export type SuggestRequest = { kind: "rename"; what: SuggestWhat; current: string } | { kind: "order"; text: string } | { kind: "portfolio"; name: string; text: string; tasks?: string[] };

/** A name is short; an order keeps the orders' own limit (server/requests.ts). */
export const SUGGEST_NAME_CHARS = 80;
export const SUGGEST_ORDER_CHARS = 1000;
/** A new ministry's remit, as engine/ministries.ts PORTFOLIO_CHARS keeps it. */
export const SUGGEST_PORTFOLIO_CHARS = 300;

export const SuggestSchema = z.object({ options: z.array(z.string()).max(8).catch([]).default([]) });

const WHAT: Record<SuggestWhat, string> = {
  post: "the title of a post in the government (what the office and its holder are called)",
  ministry: "a ministry of the government",
  party: "the ruling party",
  movement: "the player's opposition movement",
  war: "a war the country is fighting (the name the government gives it in its own words)",
  formation: "one of the country's army formations",
};

const PORTFOLIO_INSTRUCTIONS = (locale: Locale) =>
  `You correct the description of a ministry the player's government is creating in an alternate-history grand strategy game, as its own office would write it in that country on that date: the same meaning and every area and task the player named, nothing added, nothing dropped – only clearer, tighter and in good language, one or two sentences, under ${SUGGEST_PORTFOLIO_CHARS} characters. No preamble, no comment, no quotation marks. One version. In ${LANGUAGE[locale]}, with short dashes (–) only.
${IN_CHARACTER}
Answer ONLY with JSON: { "options": ["string"] }`;

export const SUGGEST_INSTRUCTIONS = (request: SuggestRequest, locale: Locale) =>
  request.kind === "portfolio"
    ? PORTFOLIO_INSTRUCTIONS(locale)
    : request.kind === "rename"
    ? `You help the player's government of an alternate-history grand strategy game choose a new name for ${WHAT[request.what]}. Suggest four names it could really take on that date in that country – in the style of its era, its regime and its language, from the plain to the bold – each different from the others and from the current one. Short: a name, never a sentence, never a comment. In ${LANGUAGE[locale]}, with short dashes (–) only.
${IN_CHARACTER}
Answer ONLY with JSON: { "options": ["string"] }`
    : `You draft an order of the player's government in an alternate-history grand strategy game in the style of a government's order or decree: the same meaning, every concrete detail kept – names, places, numbers, dates, who and by when – nothing added and nothing dropped, no preamble, no explanation, no quotation marks, no headings. Imperative, concise: one or two short sentences, fewer words than the draft where it can. Give two versions: the most concise one, then one a little more formal. In ${LANGUAGE[locale]}, with short dashes (–) only.
${IN_CHARACTER}
Answer ONLY with JSON: { "options": ["string"] }`;

/** What the game master is told: the country, its date and regime, and the thing or the order. */
export function buildSuggestPrompt(state: GameState, request: SuggestRequest): string {
  const country = state.countries[state.player];
  const ruling = state.politics?.parties.find((p) => p.status === "ruling");
  const lines = [
    `THE COUNTRY: ${en(country?.name)}, ${state.date}.`,
    state.politics ? `ITS REGIME: ${state.politics.regime}.` : "",
    ruling ? `THE RULING PARTY: ${ruling.name} (${ruling.ideology}).` : "",
    state.role && state.role.kind !== "leader" ? `THE PLAYER PLAYS: ${state.role.kind}.` : "",
  ];
  if (request.kind === "rename") lines.push("", `WHAT IS RENAMED: ${WHAT[request.what]}, now called "${request.current}".`);
  else if (request.kind === "portfolio") lines.push("", request.name ? `THE NEW MINISTRY: "${request.name}".` : "THE NEW MINISTRY: not named yet.", `THE PLAYER'S DESCRIPTION: ${request.text}`, ...(request.tasks?.length ? [`ITS TASKS: ${request.tasks.join("; ")}`] : []));
  else lines.push("", "THE DRAFT ORDER:", request.text);
  return lines.filter((l, i) => l || i > 0).join("\n");
}

/**
 * The answer's lines as the player may pick them: trimmed, unquoted, short dashes, no repeats, none equal to what
 * stands. A ministry's description comes back as one line, corrected.
 */
export function cleanSuggestions(options: string[], request: SuggestRequest): string[] {
  if (request.kind === "portfolio") {
    const line = (options[0] ?? "").replace(/[—―]/g, "–").replace(/^[\s"«»„“”'`]+|[\s"«»„“”'`]+$/g, "").replace(/\s+/g, " ").trim();
    return line ? [line.slice(0, SUGGEST_PORTFOLIO_CHARS)] : [];
  }
  const max = request.kind === "rename" ? SUGGEST_NAME_CHARS : SUGGEST_ORDER_CHARS;
  const current = (request.kind === "rename" ? request.current : request.text).trim().toLowerCase();
  const seen = new Set<string>();
  const out: string[] = [];
  for (const o of options) {
    const line = o
      .replace(/[—―]/g, "–")
      .replace(/^[\s"«»„“”'`]+|[\s"«»„“”'`]+$/g, "")
      .replace(/\s+/g, " ")
      .trim();
    const key = line.toLowerCase();
    if (!line || line.length > max || key === current || seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return out.slice(0, request.kind === "rename" ? 5 : 2);
}

/** A request from the page, checked: a known kind and what, within the limits. */
export function readSuggestRequest(body: Record<string, unknown>): SuggestRequest | null {
  if (body.kind === "rename") {
    const what = body.what as SuggestWhat;
    const current = typeof body.current === "string" ? body.current.trim() : "";
    return SUGGEST_WHATS.includes(what) && current && current.length <= 200 ? { kind: "rename", what, current } : null;
  }
  if (body.kind === "portfolio") {
    // The edits answer the player's own words: no remit written, nothing to edit.
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const tasks = Array.isArray(body.tasks) ? body.tasks.filter((x): x is string => typeof x === "string").map((x) => x.trim().slice(0, 140)).filter(Boolean).slice(0, 8) : [];
    return text && name.length <= 200 && text.length <= SUGGEST_PORTFOLIO_CHARS ? { kind: "portfolio", name, text, ...(tasks.length ? { tasks } : {}) } : null;
  }
  if (body.kind === "order") {
    const text = typeof body.text === "string" ? body.text.trim() : "";
    return text && text.length <= SUGGEST_ORDER_CHARS ? { kind: "order", text } : null;
  }
  return null;
}

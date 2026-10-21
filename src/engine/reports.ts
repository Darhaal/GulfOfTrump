import { z } from "zod";
import { ADVISORS, DIRECTIVE_STATUSES, type AdvisorId } from "./advisors";
import { ADVISOR_POST } from "./government";
import { MINISTER_STANCES, type ChronicleEntry, type GameState, type MinisterStance, type MinistryBrief, type MinistryReport } from "./types";

/**
 * The ministers' word follows the turn instead of riding in it. The turn's
 * game master only says, in a few words, what each ministry has to report on
 * and what became of its directives (`ministries`); the engine closes the
 * directives and keeps a brief per ministry in the chronicle. Once the turn
 * is applied, the few ministers with most to say each give their view — one
 * paragraph in their own voice — in a request of their own, from the settled
 * turn, their portfolio and their interests; the rest keep theirs unless the
 * government asks. A view changes only what its sanitizer lets through: the
 * text and the minister's mood. What to order is the player's to decide.
 */

/** The turn's word on each ministry (merged into OutcomeSchema as `ministries`). */
export const ministriesField = z
  .array(
    z.object({
      ministry: z.enum(ADVISORS),
      matter: z.string().trim().max(300).catch("").default(""),
      directives: z
        .array(z.object({ id: z.string().trim().min(1), status: z.enum(DIRECTIVE_STATUSES).catch("progress"), note: z.string().trim().max(300).catch("").default("") }))
        .max(12)
        .catch([])
        .default([]),
    }),
  )
  .max(6)
  .default([]);

export type MinistriesWord = z.infer<typeof ministriesField>;

/** How many ministers give their view after a turn on their own; the others wait to be asked. */
export const VOICES_PER_TURN = 3;

/** The longest view kept: one paragraph. */
export const VIEW_CHARS = 700;

/**
 * A view cut to one paragraph of at most VIEW_CHARS: at the last sentence
 * that fits, or at a word with an ellipsis. A model that runs long costs a
 * cut, not a second request.
 */
export function clipView(text: string): string {
  const one = text.replace(/\s*\n+\s*/g, " ").trim();
  if (one.length <= VIEW_CHARS) return one;
  const head = one.slice(0, VIEW_CHARS + 1);
  // Where the last whole sentence ends, its closing quote kept.
  const end = Math.max(...[". ", "! ", "? ", "… ", ".» ", ".\" ", "!» ", "?» "].map((m) => (head.lastIndexOf(m) < 0 ? -1 : head.lastIndexOf(m) + m.length - 1)));
  if (end >= VIEW_CHARS * 0.4) return head.slice(0, end).trim();
  return `${head.slice(0, head.lastIndexOf(" ", VIEW_CHARS - 1)).trim()}…`;
}

/** A minister's view, as the model writes it. */
export const MinisterReportSchema = z.object({
  report: z.string().trim().min(1).transform(clipView),
  stance: z.enum(MINISTER_STANCES).catch("loyal").default("loyal"),
  grievance: z.string().trim().max(300).catch("").default(""),
});

export type MinisterReportReply = z.infer<typeof MinisterReportSchema>;

/** A report checked against the state, ready to apply. */
export interface MinisterReport {
  ministry: AdvisorId;
  turn: number;
  text: string;
  stance: MinisterStance;
  grievance?: string;
}

/** One word per ministry, about directives of that ministry that exist. */
export function sanitizeMinistries(state: Pick<GameState, "directives">, word: MinistriesWord): MinistriesWord {
  const directives = state.directives ?? [];
  return word
    .filter((m, i, list) => list.findIndex((o) => o.ministry === m.ministry) === i)
    .map((m) => ({ ...m, directives: m.directives.filter((d, i, list) => list.findIndex((o) => o.id === d.id) === i && directives.some((x) => x.id === d.id && x.ministry === m.ministry)) }));
}

/**
 * How much a ministry has to say after a turn: a question the government put
 * to it, then a directive done or failed, then news, then work under way.
 */
const urgency = (b: MinistryBrief) => (b.asked ? 8 : 0) + (b.directives.some((d) => d.status !== "progress") ? 4 : 0) + (b.matter ? 2 : 0) + (b.directives.length ? 1 : 0);

/**
 * Who has something to say after the turn, and on what: every ministry with
 * directives, every ministry the government questioned during the turn, and
 * every one the game master says has news. A directive the game master
 * passed over is still under way. Only the VOICES_PER_TURN with most to say
 * speak on their own; the rest are quiet, their directives shown without a
 * word, until the government asks them.
 */
export function briefsFor(state: Pick<GameState, "directives" | "advice" | "turn">, word: MinistriesWord): MinistryBrief[] {
  const all = allBriefs(state, word);
  const speak = new Set(
    [...all]
      .sort((a, b) => urgency(b) - urgency(a) || ADVISORS.indexOf(a.ministry) - ADVISORS.indexOf(b.ministry))
      .slice(0, VOICES_PER_TURN)
      .map((b) => b.ministry),
  );
  return all.map((b) => (speak.has(b.ministry) ? b : { ...b, quiet: true }));
}

function allBriefs(state: Pick<GameState, "directives" | "advice" | "turn">, word: MinistriesWord): MinistryBrief[] {
  const directives = state.directives ?? [];
  return ADVISORS.flatMap((ministry) => {
    const said = word.find((m) => m.ministry === ministry);
    const mine = directives.filter((d) => d.ministry === ministry);
    const asked = (state.advice?.[ministry] ?? []).some((m) => m.from === "player" && m.turn === state.turn);
    if (!said?.matter && !mine.length && !asked) return [];
    const brief: MinistryBrief = {
      ministry,
      matter: said?.matter ?? "",
      directives: mine.map((d) => {
        const status = said?.directives.find((x) => x.id === d.id);
        return { id: d.id, status: status?.status ?? "progress", note: status?.note ?? "", text: d.text };
      }),
      ...(asked ? { asked: true } : {}),
    };
    return [brief];
  });
}

/** The ministries of a turn still owing their view; the quiet ones owe none until asked. */
export function reportsDue(entry: Pick<ChronicleEntry, "briefs" | "reports"> | undefined): AdvisorId[] {
  if (!entry) return [];
  const done = new Set((entry.reports ?? []).map((r) => r.ministry));
  return (entry.briefs ?? []).filter((b) => !b.quiet && !done.has(b.ministry)).map((b) => b.ministry);
}

/**
 * A minister's view checked against the state: there must be a brief for it
 * (a quiet minister speaks when asked), a minister devoted to the leader
 * (loyalty 4 or more) objects at most — they do not threaten to go — and a
 * grievance stays only with an objection.
 */
export function sanitizeMinisterReport(state: Pick<GameState, "chronicle" | "officials">, turn: number, ministry: AdvisorId, reply: MinisterReportReply): MinisterReport | null {
  const entry = state.chronicle.find((e) => e.turn === turn);
  if (!entry?.briefs?.some((b) => b.ministry === ministry)) return null;
  const person = state.officials?.find((o) => o.post === ADVISOR_POST[ministry]);
  const stance: MinisterStance = reply.stance === "resigning" && person && person.loyalty >= 4 ? "opposed" : reply.stance;
  const grievance = stance === "opposed" || stance === "resigning" ? reply.grievance : "";
  return {
    ministry,
    turn,
    text: reply.report,
    stance,
    ...(grievance ? { grievance } : {}),
  };
}

/**
 * The report joins its turn in the chronicle, and the minister's mood
 * follows it unless a later report has already set it. A report that has
 * already arrived changes nothing, so applying one twice is harmless.
 */
export function applyMinisterReport(state: GameState, report: MinisterReport, now = new Date()): GameState {
  const at = state.chronicle.findIndex((e) => e.turn === report.turn);
  const entry = state.chronicle[at];
  const brief = entry?.briefs?.find((b) => b.ministry === report.ministry);
  if (!entry || !brief || entry.reports?.some((r) => r.ministry === report.ministry)) return state;
  const by = state.officials?.find((o) => o.post === ADVISOR_POST[report.ministry])?.name;
  const written: MinistryReport = {
    ministry: report.ministry,
    text: report.text,
    ...(by ? { by } : {}),
    directives: brief.directives,
    stance: report.stance,
  };
  const reports = [...(entry.reports ?? []), written].sort((a, b) => ADVISORS.indexOf(a.ministry) - ADVISORS.indexOf(b.ministry));
  const chronicle = state.chronicle.map((e, i) => (i === at ? { ...e, reports } : e));
  const post = ADVISOR_POST[report.ministry];
  const officials = state.officials?.map((o) =>
    o.post === post && (o.mood?.turn ?? -1) <= report.turn ? { ...o, mood: { stance: report.stance, ...(report.grievance ? { grievance: report.grievance } : {}), turn: report.turn } } : o,
  );
  return { ...state, chronicle, ...(officials ? { officials } : {}), updatedAt: now.toISOString() };
}

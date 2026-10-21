import { z } from "zod";
import { ADVISORS, DIRECTIVE_STATUSES, type AdvisorId } from "./advisors";
import { ADVISOR_POST } from "./government";
import { MINISTER_STANCES, type ChronicleEntry, type GameState, type MinisterStance, type MinistryBrief, type MinistryReport } from "./types";

/**
 * The ministers' reports follow the turn instead of riding in it. The turn's
 * game master only says, in a few words, what each ministry has to report on
 * and what became of its directives (`ministries`); the engine closes the
 * directives and keeps a brief per ministry in the chronicle. Once the turn
 * is applied, each minister with a brief writes their report in a request of
 * their own, from the settled turn, their portfolio and their interests. A
 * report changes only what its sanitizer lets through: the text, the
 * minister's mood and the orders they suggest.
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

/** A minister's report, as the model writes it. */
export const MinisterReportSchema = z.object({
  report: z.string().trim().min(1).max(3000),
  stance: z.enum(MINISTER_STANCES).catch("loyal").default("loyal"),
  grievance: z.string().trim().max(300).catch("").default(""),
  orders: z.array(z.string().trim().min(1).max(300)).max(3).catch([]).default([]),
});

export type MinisterReportReply = z.infer<typeof MinisterReportSchema>;

/** A report checked against the state, ready to apply. */
export interface MinisterReport {
  ministry: AdvisorId;
  turn: number;
  text: string;
  stance: MinisterStance;
  grievance?: string;
  orders: string[];
}

/** One word per ministry, about directives of that ministry that exist. */
export function sanitizeMinistries(state: Pick<GameState, "directives">, word: MinistriesWord): MinistriesWord {
  const directives = state.directives ?? [];
  return word
    .filter((m, i, list) => list.findIndex((o) => o.ministry === m.ministry) === i)
    .map((m) => ({ ...m, directives: m.directives.filter((d, i, list) => list.findIndex((o) => o.id === d.id) === i && directives.some((x) => x.id === d.id && x.ministry === m.ministry)) }));
}

/**
 * Who reports after the turn, and on what: every ministry with directives,
 * every ministry the government questioned during the turn, and every one
 * the game master says has news. A directive the game master passed over is
 * still under way.
 */
export function briefsFor(state: Pick<GameState, "directives" | "advice" | "turn">, word: MinistriesWord): MinistryBrief[] {
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

/** The ministries of a turn still owing their report. */
export function reportsDue(entry: Pick<ChronicleEntry, "briefs" | "reports"> | undefined): AdvisorId[] {
  if (!entry) return [];
  const done = new Set((entry.reports ?? []).map((r) => r.ministry));
  return (entry.briefs ?? []).map((b) => b.ministry).filter((m) => !done.has(m));
}

/**
 * A minister's report checked against the state: there must be a brief for
 * it, and a minister devoted to the leader (loyalty 4 or more) objects at
 * most — they do not threaten to go. A grievance stays only with an objection.
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
    orders: [...new Set(reply.orders)],
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
  const written: MinistryReport = {
    ministry: report.ministry,
    text: report.text,
    directives: brief.directives,
    stance: report.stance,
    ...(report.orders.length ? { orders: report.orders } : {}),
  };
  const reports = [...(entry.reports ?? []), written].sort((a, b) => ADVISORS.indexOf(a.ministry) - ADVISORS.indexOf(b.ministry));
  const chronicle = state.chronicle.map((e, i) => (i === at ? { ...e, reports } : e));
  const post = ADVISOR_POST[report.ministry];
  const officials = state.officials?.map((o) =>
    o.post === post && (o.mood?.turn ?? -1) <= report.turn ? { ...o, mood: { stance: report.stance, ...(report.grievance ? { grievance: report.grievance } : {}), turn: report.turn } } : o,
  );
  return { ...state, chronicle, ...(officials ? { officials } : {}), updatedAt: now.toISOString() };
}

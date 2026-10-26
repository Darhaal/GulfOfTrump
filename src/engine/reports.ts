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
        return { id: d.id, status: status?.status ?? "progress", note: status?.note ?? "", text: d.text, ...(d.operation ? { operation: true } : {}) };
      }),
      ...(asked ? { asked: true } : {}),
    };
    return [brief];
  });
}

/** The most ministers the player may have report after a turn on their own (Settings); the default is VOICES_PER_TURN. */
export const MAX_VOICES = 5;

/** How many ministers report after a turn, from the player's setting: "" (not chosen) for the default, else 0 to MAX_VOICES. */
export function voicesFrom(setting: string): number {
  return /^\d$/.test(setting) && Number(setting) <= MAX_VOICES ? Number(setting) : VOICES_PER_TURN;
}

/** A touch at least this strong gives a ministry something to report even when the game master named nothing for it. */
const STRONG = 3;

/** What a ministry reports on when only the turn's touch, not the game master, gives it something to say. */
const TOUCHED_MATTER: Record<AdvisorId, string> = {
  chief: "The government's people, laws and standing at home this period.",
  foreign: "The country's foreign relations this period.",
  interior: "The protests and the mood in the country this period.",
  military: "The war and the fronts this period.",
  intelligence: "What other governments plotted against the country this period.",
  finance: "The swing of the economy this period.",
  industry: "Production, supply and trade this period.",
  science: "The laboratories' work this period.",
};

/** A little of each ministry's weight when nothing else tells them apart: the closest adviser first, then the money, then the army. */
const STANDING: Record<AdvisorId, number> = { chief: 0.3, finance: 0.25, military: 0.2, foreign: 0.15, interior: 0.1, industry: 0.05, intelligence: 0.04, science: 0.03 };

type TouchState = Pick<GameState, "player" | "wars" | "diplomacy"> & Partial<Pick<GameState, "protests" | "politics" | "plans">>;

/**
 * How much a played turn touched each ministry, from what it changed, its
 * events and the country after it: a war and its fronts the general staff,
 * a swing of the economy, the budget and money the economy, treaties, blocs,
 * talks, sanctions and incidents the foreign ministry, protests and the mood
 * at home the interior, the cabinet and the laws the chief of staff, plots
 * the intelligence service, deals industry, breakthroughs science.
 */
export function turnTouches(state: TouchState, entry: Pick<ChronicleEntry, "turn" | "applied" | "events" | "economy">): Record<AdvisorId, number> {
  const t: Record<AdvisorId, number> = { chief: 0, foreign: 0, interior: 0, military: 0, intelligence: 0, finance: 0, industry: 0, science: 0 };
  const me = state.player;
  const add = (points: Partial<Record<AdvisorId, number>>) => {
    for (const [m, n] of Object.entries(points)) t[m as AdvisorId] += n;
  };
  if (state.wars.some((w) => w.attackers.includes(me) || w.defenders.includes(me))) add({ military: 3 });
  let front = false;
  for (const a of entry.applied) {
    switch (a.kind) {
      case "war":
      case "peace":
        if (a.sides?.includes(me)) add({ military: 3, foreign: 1 });
        break;
      case "enter":
        if (a.country === me) add({ military: 2, foreign: 1 });
        break;
      case "truce":
      case "truce-ended":
        add({ military: 1, foreign: 1 });
        break;
      case "occupy":
      case "liberate":
      case "annex":
      case "behind":
        if (!front && (a.from === me || a.to === me)) {
          add({ military: 2 });
          front = true;
        }
        break;
      case "contest":
      case "repel":
        if (!front && (a.by === me || a.holder === me)) {
          add({ military: 2 });
          front = true;
        }
        break;
      case "alliance":
      case "alliance-ended":
        if (a.members?.includes(me)) add({ foreign: 2 });
        break;
      case "accession":
      case "leave":
      case "invitation":
        if (a.country === me) add({ foreign: 2 });
        break;
      case "accord":
        if (a.by === me || a.with === me) add({ foreign: 2 });
        break;
      case "summit-planned":
        add({ foreign: 1 });
        break;
      case "incident":
        if (a.by === me || a.target === me) add({ foreign: 1, intelligence: 1 });
        break;
      case "sanction":
        if (a.by === me || a.against === me) add({ foreign: 2, finance: 1, industry: 1 });
        break;
      case "budget":
        add({ finance: 2 });
        break;
      case "funds":
        if (a.from === me || a.to === me) add({ finance: 2 });
        break;
      case "deal":
        add({ industry: 2 });
        break;
      case "protest":
      case "election":
      case "party":
      case "repression":
      case "movement":
        add({ interior: 2 });
        break;
      case "vote":
      case "coup":
        if (a.country === me) add({ interior: 2 });
        break;
      case "plot":
        add({ interior: 1, intelligence: 2, ...(a.cabinet ? { chief: 1 } : {}) });
        break;
      case "official":
      case "cabinet":
      case "intrigue":
        add({ chief: 2 });
        break;
      case "law":
      case "bill":
      case "identity":
        add({ chief: 1, interior: 1 });
        break;
      case "research":
        if (a.change === "done" || a.change === "setback") add({ science: 2 });
        break;
      case "captured":
        if (a.by === me || a.from === me) add({ military: 1 });
        break;
      case "population":
        if (a.country === me) add({ interior: 1 });
        break;
    }
  }
  for (const e of entry.events) {
    if (!e.countries.includes(me)) continue;
    if (e.kind === "war" || e.kind === "military") add({ military: 1 });
    else if (e.kind === "economy") add({ finance: 1 });
    else if (e.kind === "diplomacy") add({ foreign: 1 });
    else if (e.kind === "politics") add({ interior: 1 });
  }
  if (entry.economy) {
    const { before, after } = entry.economy;
    const swing = Math.abs(after.gdp - before.gdp) / Math.max(0.01, before.gdp);
    if (swing > 0.05) add({ finance: 3 });
    else if (swing > 0.02) add({ finance: 2 });
    if (after.reserves < before.reserves * 0.8) add({ finance: 1 });
  }
  if (state.protests?.length) add({ interior: 3 });
  if ((state.politics?.unrest ?? 0) >= 50) add({ interior: 1 });
  if (Object.values(state.diplomacy).some((thread) => thread.some((m) => m.turn === entry.turn))) add({ foreign: 2 });
  if ((state.plans ?? []).some((p) => !p.end && p.kind === "war" && p.target === me && p.stage !== "incident")) add({ intelligence: 1, foreign: 1 });
  return t;
}

/**
 * Who reports after a turn, as many as the player chose (0–MAX_VOICES): the
 * ministries ranked by what the turn touched and by what they have to say
 * (a question the government put, a directive closed, the game master's
 * word). A ministry the game master named nothing for speaks only when the
 * turn touched it strongly – a war for the general staff, protests for the
 * interior, a swing of the economy for its minister – and then on that.
 * With none, nobody reports on their own: every brief is kept quiet and any
 * minister can still be asked. Reports already given stay.
 */
export function chooseVoices(state: GameState, turn: number, count: number): GameState {
  const at = state.chronicle.findIndex((e) => e.turn === turn);
  const entry = state.chronicle[at];
  if (!entry) return state;
  const n = Math.max(0, Math.min(MAX_VOICES, Math.round(count)));
  const briefs = entry.briefs ?? [];
  const touches = turnTouches(state, entry);
  const score = (m: AdvisorId) => {
    const brief = briefs.find((b) => b.ministry === m);
    return (brief ? urgency(brief) : 0) + touches[m] + STANDING[m];
  };
  const eligible = ADVISORS.filter((m) => briefs.some((b) => b.ministry === m) || touches[m] >= STRONG);
  const speak = new Set([...eligible].sort((a, b) => score(b) - score(a) || ADVISORS.indexOf(a) - ADVISORS.indexOf(b)).slice(0, n));
  const next: MinistryBrief[] = ADVISORS.flatMap((ministry): MinistryBrief[] => {
    const brief = briefs.find((b) => b.ministry === ministry);
    if (!brief) return speak.has(ministry) ? [{ ministry, matter: TOUCHED_MATTER[ministry], directives: [] }] : [];
    const open: MinistryBrief = { ...brief };
    delete open.quiet;
    return [speak.has(ministry) ? open : { ...open, quiet: true }];
  });
  if (!next.length) return state;
  const chronicle = state.chronicle.map((e, i) => (i === at ? { ...e, briefs: next } : e));
  return { ...state, chronicle };
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

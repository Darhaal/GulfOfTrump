import { z } from "zod";
import type { Alliance, AllianceSeed, AppliedChange, GameState, Summit, SummitLine, Text, War } from "./types";

/**
 * Foreign policy beyond war and peace: truces with an end date, blocs of
 * three kinds (military alliances, pacts, organisations) with terms and a
 * term, the player's invitations to found one, and summits — planned ahead,
 * then held, with a record of what each leader said. A session of a bloc the
 * player belongs to is called by an order: the turn's game master names it
 * in `sessions`, and the engine schedules it for the player to attend at the
 * start of the next period. A summit or session the player's country takes
 * part in is never held without the player: it opens for the player to
 * attend and speak, the others answering in turn; one among other
 * governments only is reported by its outcome, without a transcript.
 */

export const BLOC_KINDS = ["alliance", "pact", "organization", "trade"] as const;
export type BlocKind = (typeof BLOC_KINDS)[number];

const tag = z.string().trim().min(1).max(80);
const shortText = z.string().trim().max(300);
const date = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/);

/** The parts of a turn's answer about foreign policy (merged into OutcomeSchema). */
export const foreignFields = {
  truces: z.array(z.object({ war: shortText.min(1), until: date, terms: shortText.optional() })).max(8).default([]),
  trucesEnded: z.array(z.object({ war: shortText.min(1) })).max(8).default([]),
  invitations: z
    .array(z.object({ proposal: shortText.min(1), country: tag, answer: z.enum(["accept", "decline"]).catch("decline"), note: shortText.default("") }))
    .max(24)
    .default([]),
  summits: z
    .array(
      z.object({
        title: shortText.min(1),
        place: shortText.default(""),
        date,
        participants: z.array(tag).default([]),
        agenda: shortText.default(""),
      }),
    )
    .max(4)
    .default([]),
  summitsHeld: z
    .array(
      z.object({
        summit: shortText.min(1),
        outcome: z.string().trim().max(2000).default(""),
        transcript: z
          .array(z.object({ country: tag, speaker: shortText.default(""), text: z.string().trim().min(1).max(1200) }))
          .max(20)
          .default([]),
      }),
    )
    .max(4)
    .default([]),
  // Sessions of blocs the player belongs to that the player's orders called this period.
  // Kept to the first MAX_SESSIONS when sanitized.
  sessions: z
    .array(z.object({ bloc: shortText.min(1), agenda: shortText.default("") }))
    .catch([])
    .default([]),
};

/** At most this many sessions an answer may call. */
export const MAX_SESSIONS = 2;

type ForeignRaw = { [K in keyof typeof foreignFields]: z.infer<(typeof foreignFields)[K]> };

/** A summit by id, or by its title in any language. */
export function findSummit(summits: Summit[] | undefined, key: string): Summit | undefined {
  const needle = key.trim().toLowerCase();
  return (summits ?? []).find((s) => s.id.toLowerCase() === needle || s.title.trim().toLowerCase() === needle);
}

/** A bloc by id, or by its name in any language; a shortened name only when it fits one bloc alone. */
export function findBloc(alliances: Alliance[], key: string): Alliance | undefined {
  const needle = key.trim().toLowerCase();
  const names = (a: Alliance) => (typeof a.name === "string" ? [a.name] : Object.values(a.name)).map((n) => n.toLowerCase());
  const exact = alliances.find((a) => a.id.toLowerCase() === needle) ?? alliances.find((a) => names(a).includes(needle));
  if (exact || needle.length < 3) return exact;
  const loose = alliances.filter((a) => names(a).some((n) => n.includes(needle) || needle.includes(n)));
  return loose.length === 1 ? loose[0] : undefined;
}

/** Keeps what refers to wars, proposals, countries and summits that exist; a session only of a bloc the player belongs to, once each. */
export function sanitizeForeign(
  state: GameState,
  raw: ForeignRaw,
  findWar: (key: string) => boolean,
  exists: (tag: string) => boolean,
): { result: ForeignRaw; dropped: number } {
  let dropped = 0;
  const keep = <T>(items: T[], ok: (item: T) => boolean) =>
    items.filter((item) => {
      const pass = ok(item);
      if (!pass) dropped += 1;
      return pass;
    });
  const proposal = (id: string) => (state.proposals ?? []).find((p) => p.id === id);
  return {
    result: {
      truces: keep(raw.truces, (t) => findWar(t.war) && t.until > state.date),
      trucesEnded: keep(raw.trucesEnded, (t) => findWar(t.war)),
      invitations: keep(raw.invitations, (i) => Boolean(proposal(i.proposal)?.invited.includes(i.country))),
      summits: keep(
        raw.summits.map((s) => ({ ...s, participants: [...new Set(s.participants.filter(exists))] })),
        (s) => s.participants.length >= 2 && s.date >= state.date,
      ),
      // Only summits among other governments, by their outcome: one the player is in waits for the player.
      summitsHeld: keep(
        raw.summitsHeld.map((h) => ({ ...h, transcript: [] })),
        (h) => {
          const s = findSummit(state.summits, h.summit);
          return s?.status === "planned" && !s.participants.includes(state.player);
        },
      ),
      sessions: keep(
        raw.sessions.map((s) => ({ ...s, bloc: findBloc(state.alliances, s.bloc)?.id ?? "" })),
        (s) => Boolean(state.alliances.find((a) => a.id === s.bloc)?.members.includes(state.player)),
      )
        .filter((s, i, list) => list.findIndex((o) => o.bloc === s.bloc) === i)
        .slice(0, MAX_SESSIONS),
    },
    dropped,
  };
}

/**
 * Applies truces, invitations and summits, then lets time run out: truces and
 * blocs whose term ends in this period expire, and a planned summit whose
 * date passed without it being held is marked missed. Returns the summits
 * held this turn, for the report.
 */
export function applyForeign(
  next: GameState,
  foreign: ForeignRaw,
  ctx: { from: string; to: string; turn: number; findWar: (key: string) => GameState["wars"][number] | undefined },
  applied: AppliedChange[],
): string[] {
  for (const t of foreign.truces) {
    const war = ctx.findWar(t.war);
    if (!war) continue;
    war.truce = { until: t.until, ...(t.terms ? { terms: t.terms } : {}) };
    applied.push({ kind: "truce", war: war.id, name: war.name, until: t.until });
  }
  for (const t of foreign.trucesEnded) {
    const war = ctx.findWar(t.war);
    if (!war?.truce) continue;
    delete war.truce;
    applied.push({ kind: "truce-ended", war: war.id, name: war.name });
  }

  // Invitations: a bloc is founded with everyone who accepted.
  const answers = new Map<string, { accept: string[]; decline: string[] }>();
  for (const i of foreign.invitations) {
    const entry = answers.get(i.proposal) ?? { accept: [], decline: [] };
    (i.answer === "accept" ? entry.accept : entry.decline).push(i.country);
    answers.set(i.proposal, entry);
  }
  for (const [id, { accept, decline }] of answers) {
    const proposal = (next.proposals ?? []).find((p) => p.id === id);
    if (!proposal) continue;
    for (const country of accept) applied.push({ kind: "invitation", name: proposal.name, country, answer: "accept" });
    for (const country of decline) applied.push({ kind: "invitation", name: proposal.name, country, answer: "decline" });
    if (accept.length) {
      const blocId = `b${ctx.turn}-${id}`;
      next.alliances.push({
        id: blocId,
        name: proposal.name,
        members: [next.player, ...accept],
        since: ctx.from,
        kind: proposal.kind,
        ...(proposal.terms ? { terms: proposal.terms } : {}),
        founder: next.player,
      });
      applied.push({ kind: "alliance", alliance: blocId, name: proposal.name });
    }
    // Answered by everyone invited: the proposal is settled.
    if (proposal.invited.every((c) => accept.includes(c) || decline.includes(c)) || accept.length) {
      next.proposals = (next.proposals ?? []).filter((p) => p.id !== id);
    }
  }

  foreign.summits.forEach((s, i) => {
    // A meeting the player is in, dated inside the period just played, moves to the next one's first day: the player never had the chance to attend.
    const date = s.participants.includes(next.player) && s.date < ctx.to ? ctx.to : s.date;
    const summit: Summit = { id: `s${ctx.turn}-${i + 1}`, title: s.title, place: s.place, date, participants: s.participants, agenda: s.agenda, by: "world", status: "planned" };
    next.summits = [...(next.summits ?? []), summit];
    applied.push({ kind: "summit-planned", summit: summit.id, title: summit.title, date: summit.date });
  });

  // Sessions the player's orders called: on the next period's first day, for the player to attend.
  foreign.sessions.forEach((s, i) => {
    const bloc = next.alliances.find((a) => a.id === s.bloc);
    if (!bloc?.members.includes(next.player)) return;
    const title = typeof bloc.name === "string" ? bloc.name : bloc.name.en;
    const summit: Summit = {
      id: `s${ctx.turn}-c${i + 1}`,
      title,
      place: "",
      date: ctx.to,
      participants: bloc.members.filter((m) => next.countries[m]),
      ...(s.agenda ? { agenda: s.agenda } : {}),
      by: "player",
      status: "planned",
      live: true,
      bloc: bloc.id,
    };
    next.summits = [...(next.summits ?? []), summit];
    applied.push({ kind: "summit-planned", summit: summit.id, title: summit.title, date: summit.date });
  });

  const held: string[] = [];
  for (const h of foreign.summitsHeld) {
    const summit = findSummit(next.summits, h.summit);
    if (!summit || summit.status !== "planned" || summit.participants.includes(next.player)) continue;
    summit.status = "held";
    summit.outcome = h.outcome;
    held.push(summit.id);
  }

  // Time runs out.
  for (const war of next.wars) {
    if (war.truce && war.truce.until < ctx.to) {
      delete war.truce;
      applied.push({ kind: "truce-ended", war: war.id, name: war.name });
    }
  }
  const expired = next.alliances.filter((a) => a.until && a.until < ctx.to);
  for (const a of expired) applied.push({ kind: "alliance-ended", alliance: a.id, name: a.name, members: [...a.members] });
  next.alliances = next.alliances.filter((a) => !(a.until && a.until < ctx.to));
  for (const s of next.summits ?? []) if (s.status === "planned" && s.date < ctx.to && !held.includes(s.id)) s.status = "missed";
  return held;
}

/**
 * A war ends: it leaves the list, and occupied land and contested provinces
 * between its sides go back to their owners unless the treaty annexed them,
 * which the turn reports as annex transfers.
 */
export function endWar(next: GameState, war: War, applied: AppliedChange[]): void {
  next.wars = next.wars.filter((w) => w.id !== war.id);
  applied.push({ kind: "peace", war: war.id, name: war.name, sides: [...war.attackers, ...war.defenders] });
  const sides = new Set([...war.attackers, ...war.defenders]);
  for (const region of Object.values(next.regions)) {
    if (region.controller !== region.owner && sides.has(region.controller) && sides.has(region.owner)) region.controller = region.owner;
    if (region.contested && sides.has(region.contested) && sides.has(region.controller)) {
      delete region.contested;
      delete region.held;
      delete region.taken;
    }
  }
}

/** How a war's truce, a bloc and a summit read in the prompt. */
export const truceLine = (truce: { until: string; terms?: Text } | undefined) =>
  truce ? ` | TRUCE until ${truce.until}${truce.terms ? ` (${typeof truce.terms === "string" ? truce.terms : truce.terms.en})` : ""}` : "";

/** The other participants' words after the player has spoken at a meeting held in person. */
export const SummitTalkSchema = z.object({
  lines: z
    .array(z.object({ country: tag, speaker: shortText.default(""), text: z.string().trim().min(1).max(1500) }))
    .min(1)
    .max(5),
});

/** How a meeting held in person ended. */
export const SummitCloseSchema = z.object({
  outcome: z.string().trim().min(1).max(2000),
  agreements: z.array(shortText.min(1)).max(8).catch([]).default([]),
});

/** A meeting the player calls now: of a bloc it belongs to, or with any governments. */
export function conveneSummit(state: GameState, s: { title: string; place: string; participants: string[]; agenda: string }, now = new Date()): { state: GameState; summit: Summit } {
  const participants = [...new Set([state.player, ...s.participants.filter((t) => state.countries[t])])];
  const summit: Summit = {
    id: `s${state.turn}-p${Date.now().toString(36)}`,
    title: s.title,
    place: s.place,
    date: state.date,
    participants,
    agenda: s.agenda,
    by: "player",
    status: "planned",
    live: true,
  };
  return { state: { ...state, summits: [...(state.summits ?? []), summit], updatedAt: now.toISOString() }, summit };
}

/** Whether the player can hold a planned meeting in person now: it takes part, and the date falls before the end of this turn. */
export function canHoldNow(state: GameState, summit: Summit, periodEnd: string): boolean {
  return summit.status === "planned" && summit.participants.includes(state.player) && summit.date < periodEnd;
}

/** Whether the player's delegation has spoken at a meeting: until it has, nothing can be settled there. */
export const playerHasSpoken = (summit: Pick<Summit, "transcript">, player: string): boolean => (summit.transcript ?? []).some((line) => line.country === player);

/** Meetings the player's country is due at this period and has not yet spoken at: they open for the player to attend. */
export function dueSessions(state: GameState, periodEnd: string): Summit[] {
  return (state.summits ?? []).filter((s) => canHoldNow(state, s, periodEnd) && !playerHasSpoken(s, state.player)).sort((a, b) => a.date.localeCompare(b.date));
}

/** The player's words and the others' answers, added to the record of a meeting held in person. */
export function speakAtSummit(state: GameState, id: string, said: SummitLine, replies: SummitLine[], now = new Date()): GameState {
  const known = (line: SummitLine) => Boolean(state.countries[line.country]);
  return {
    ...state,
    summits: (state.summits ?? []).map((s) => (s.id === id ? { ...s, live: true, transcript: [...(s.transcript ?? []), said, ...replies.filter(known)] } : s)),
    updatedAt: now.toISOString(),
  };
}

/** A meeting held in person ends: what came of it waits for the turn's game master, who must honour the agreements. Not before the player has spoken. */
export function closeSummit(state: GameState, id: string, outcome: string, agreements: string[], now = new Date()): GameState {
  const summit = (state.summits ?? []).find((s) => s.id === id);
  if (!summit || !playerHasSpoken(summit, state.player)) return state;
  return {
    ...state,
    summits: (state.summits ?? []).map((s) => (s.id === id ? { ...s, status: "held" as const, live: true, outcome, agreements, heldTurn: state.turn } : s)),
    updatedAt: now.toISOString(),
  };
}

/** A save from before world bodies gets the scenario's United Nations or League of Nations. */
export function ensureWorldBodies<T extends Pick<GameState, "alliances" | "countries">>(state: T, seeds: { id: string; allExcept?: string[]; name: Text; since: string; kind?: BlocKind }[]): T {
  const missing = seeds.filter((s) => s.allExcept && !state.alliances.some((a) => a.id === s.id));
  if (!missing.length) return state;
  const members = (except: string[]) => Object.keys(state.countries).filter((tag) => !except.includes(tag));
  return {
    ...state,
    alliances: [...state.alliances, ...missing.map((s) => ({ id: s.id, name: s.name, members: members(s.allExcept!), since: s.since, kind: s.kind ?? ("organization" as const) }))],
  };
}

/**
 * A save gets the scenario's terms for the blocs it started with; one not
 * yet played also gets the treaties added to its scenario since it was made.
 */
export function fillTreaties<T extends Pick<GameState, "alliances" | "countries" | "chronicle">>(state: T, seeds: AllianceSeed[]): T {
  const byId = new Map(seeds.map((s) => [s.id, s]));
  let changed = false;
  const alliances = state.alliances.map((a) => {
    const seed = byId.get(a.id);
    if (!seed?.terms || a.terms) return a;
    changed = true;
    return { ...a, terms: seed.terms, ...(seed.until && !a.until ? { until: seed.until } : {}) };
  });
  if (!state.chronicle.length) {
    for (const seed of seeds) {
      if (seed.allExcept || alliances.some((a) => a.id === seed.id)) continue;
      const members = seed.members.filter((m) => state.countries[m]);
      if (members.length < 2) continue;
      alliances.push({ id: seed.id, name: seed.name, members, since: seed.since, ...(seed.kind ? { kind: seed.kind } : {}), ...(seed.terms ? { terms: seed.terms } : {}), ...(seed.until ? { until: seed.until } : {}) });
      changed = true;
    }
  }
  return changed ? { ...state, alliances } : state;
}

/** A save from before bloc kinds gets the scenario's kinds for the blocs it started with. */
export function fillBlocKinds<T extends Pick<GameState, "alliances">>(state: T, seeds: { id: string; kind?: BlocKind }[]): T {
  const kinds = new Map(seeds.filter((s) => s.kind).map((s) => [s.id, s.kind!]));
  if (!state.alliances.some((a) => !a.kind && kinds.has(a.id))) return state;
  return { ...state, alliances: state.alliances.map((a) => (!a.kind && kinds.has(a.id) ? { ...a, kind: kinds.get(a.id) } : a)) };
}

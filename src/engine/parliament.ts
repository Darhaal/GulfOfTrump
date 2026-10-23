import { z } from "zod";
import { regimeAtStart, regimeFromText } from "./abroad";
import { roll } from "./dice";
import { LAW_IDS, LAWS, type LawId, type Laws } from "./laws";
import type { GameState, Motion, MotionKind, Party, Politics, RegimeKind, Session, SessionLine, SessionVote } from "./types";

/**
 * Parliament sitting on a motion the player brings: a change of one law, a
 * bill or a constitutional amendment in the player's words, a vote of
 * confidence, an early election, putting an election off, or a state of
 * emergency. Members of the parties speak in character and the player
 * answers them; the model proposes how each speech moved the parties, and
 * the engine decides: where each party starts from its place in the
 * government and its ideas, how far speeches can move it, and the vote,
 * seat by seat, with seeded dice for the waverers. What a passed motion
 * changes takes effect at once; the next turn's game master is told.
 */

/** The most one reply can move a party, and all the speeches of a sitting together. */
export const SWAY_STEP = 0.15;
export const SWAY_LIMIT = 0.35;

/** A party whose lean is beyond this votes as one; nearer the middle its members split. */
export const WHIP = 0.25;

/** How many sittings a save keeps. */
export const KEEP_SESSIONS = 8;

/** The motions that need two thirds of the seats; the rest a simple majority. */
const TWO_THIRDS: MotionKind[] = ["constitution", "postpone"];

export const seatsNeeded = (kind: MotionKind, total: number) => (TWO_THIRDS.includes(kind) ? Math.ceil((total * 2) / 3) : Math.floor(total / 2) + 1);

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** How the player's state is governed: read from the regime the game master described, else the date's table. */
export function regimeKindOf(state: Pick<GameState, "politics" | "scenarioId" | "player">): RegimeKind {
  return state.politics?.regime ? regimeFromText(state.politics.regime) : regimeAtStart(state.scenarioId, state.player);
}

/**
 * Whether the player's state holds elections a government can lose or
 * stage: not under one party, a junta or a dictator, nor with elections
 * suspended by law.
 */
export function holdsElections(state: Pick<GameState, "politics" | "scenarioId" | "player">): boolean {
  if (state.politics?.laws?.elections === "suspended") return false;
  const kind = regimeKindOf(state);
  return kind === "democracy" || kind === "limited";
}

/** The motions the player can bring now: none without a parliament that sits, no elections where there are none. */
export function availableMotions(state: Pick<GameState, "politics" | "scenarioId" | "player">): MotionKind[] {
  if (!state.politics?.parliament) return [];
  const elections = holdsElections(state);
  return (["law", "bill", "constitution", "confidence", "election", "postpone", "emergency"] as const).filter((k) => (k === "election" || k === "postpone" ? elections : true));
}

/** Which way a law's change leans on the parties' three axes: +1 toward the closed end of its options. */
const LAW_AXIS: Partial<Record<LawId, { axis: "economy" | "freedom" | "nation"; closed: 1 | -1 }>> = {
  // Closing the press, the streets, the vote, the borders or rule itself is what authoritarians want.
  press: { axis: "freedom", closed: -1 },
  assembly: { axis: "freedom", closed: -1 },
  elections: { axis: "freedom", closed: -1 },
  exit: { axis: "freedom", closed: -1 },
  martial: { axis: "freedom", closed: -1 },
  deathPenalty: { axis: "freedom", closed: -1 },
  // A planned economy is what the left wants.
  economy: { axis: "economy", closed: -1 },
  // Universal service and one state language are what nationalists want.
  conscription: { axis: "nation", closed: 1 },
  language: { axis: "nation", closed: -1 },
};

/** Whether a motion moves a law toward the closed end of its options (+1), the open end (-1), or neither. */
function lawDirection(motion: Motion, laws: Laws | undefined): { axis: "economy" | "freedom" | "nation"; sign: number } | null {
  const law = (motion.kind === "emergency" ? "martial" : motion.law) as LawId | undefined;
  const option = motion.kind === "emergency" ? "emergency" : motion.option;
  if (!law || !option || !LAW_AXIS[law]) return null;
  const options = LAWS[law] as readonly string[];
  const from = options.indexOf((laws?.[law] as string | undefined) ?? options[0]);
  const to = options.indexOf(option);
  if (to < 0 || to === from) return null;
  const { axis, closed } = LAW_AXIS[law]!;
  return { axis, sign: Math.sign(to - from) * closed };
}

/**
 * Where a party starts on a motion, -1 (against) to 1 (for): the
 * government's parties back the government, the opposition opposes it, and
 * a party's ideas pull it toward a law that goes their way. Calling an
 * election early is what an opposition wants; putting one off is what it
 * fights.
 */
export function baseLean(party: Party, motion: Motion, laws: Laws | undefined): number {
  const side = party.status === "ruling" ? 0.7 : party.status === "coalition" ? 0.4 : -0.35;
  let lean = side;
  if (motion.kind === "confidence") lean = party.status === "ruling" ? 0.9 : party.status === "coalition" ? 0.5 : -0.6;
  if (motion.kind === "election") lean = party.status === "ruling" ? 0.4 : party.status === "coalition" ? 0.1 : 0.5;
  if (motion.kind === "postpone") lean = party.status === "ruling" ? 0.6 : party.status === "coalition" ? 0.1 : -0.8;
  const direction = lawDirection(motion, laws);
  if (direction) lean += (direction.sign * party.stance[direction.axis]) / 10 * 0.5;
  return clamp(lean, -1, 1);
}

/** A party's lean now: where it started and how far the speeches moved it. */
export const leanOf = (party: Party, session: Pick<Session, "motion" | "sway">, laws: Laws | undefined) => clamp(baseLean(party, session.motion, laws) + (session.sway[party.id] ?? 0), -1, 1);

/** The share of a party's members who vote for, against and abstain, by its lean: whole parties beyond the whip, a split between. */
function split(lean: number): { for: number; against: number; abstain: number } {
  if (lean >= WHIP) return { for: 1, against: 0, abstain: 0 };
  if (lean <= -WHIP) return { for: 0, against: 1, abstain: 0 };
  const abstain = 0.15 * (1 - Math.abs(lean) / WHIP);
  const forShare = ((lean + WHIP) / (2 * WHIP)) * (1 - abstain);
  return { for: forShare, against: 1 - abstain - forShare, abstain };
}

/** What the house would vote if it voted now, without the dice: for the panel's forecast. */
export function forecast(politics: Pick<Politics, "parties" | "parliament" | "laws">, session: Pick<Session, "motion" | "sway">): SessionVote | null {
  const house = politics.parliament;
  if (!house) return null;
  const parties = politics.parties
    .filter((p) => (p.seats ?? 0) > 0)
    .map((p) => {
      const s = split(leanOf(p, session, politics.laws));
      const seats = p.seats ?? 0;
      const yes = Math.round(seats * s.for);
      const no = Math.round(seats * s.against);
      return { party: p.id, for: yes, against: no, abstain: seats - yes - no };
    });
  const counted = parties.reduce((n, p) => n + p.for + p.against + p.abstain, 0);
  return {
    for: parties.reduce((n, p) => n + p.for, 0),
    against: parties.reduce((n, p) => n + p.against, 0),
    abstain: parties.reduce((n, p) => n + p.abstain, 0) + Math.max(0, house.seats - counted),
    need: seatsNeeded(session.motion.kind, house.seats),
    parties,
  };
}

/** A motion as the player brings it, checked: its kind allowed, its law and option real and a change, its words short. */
export function checkMotion(state: Pick<GameState, "politics" | "scenarioId" | "player">, motion: Motion): Motion | null {
  if (!availableMotions(state).includes(motion.kind)) return null;
  const text = motion.text.trim().slice(0, 600);
  if (motion.kind === "law") {
    if (!motion.law || !LAW_IDS.includes(motion.law as LawId)) return null;
    const options = LAWS[motion.law as LawId] as readonly string[];
    if (!motion.option || !options.includes(motion.option)) return null;
    if (state.politics?.laws?.[motion.law as LawId] === motion.option) return null;
    return { kind: "law", text, law: motion.law, option: motion.option };
  }
  if ((motion.kind === "bill" || motion.kind === "constitution") && text.length < 3) return null;
  if (motion.kind === "emergency" && (state.politics?.laws?.martial === "emergency" || state.politics?.laws?.martial === "martial")) return null;
  return { kind: motion.kind, text };
}

/** The sitting under way, if there is one: a parliament sits on one motion at a time. */
export const openSession = (politics: Pick<Politics, "sessions"> | undefined) => politics?.sessions?.find((s) => s.status === "open");

/** The player opens a sitting on a motion. Returns the state unchanged when the motion cannot be brought or a sitting is under way. */
export function convene(state: GameState, motion: Motion, now = new Date()): { state: GameState; session: Session | null } {
  const politics = state.politics;
  const checked = politics && !openSession(politics) ? checkMotion(state, motion) : null;
  if (!politics || !checked) return { state, session: null };
  const session: Session = { id: `sess-${state.turn}-${(politics.sessions?.length ?? 0) + 1}-${now.getTime().toString(36)}`, motion: checked, transcript: [], sway: {}, status: "open", date: state.date, turn: state.turn };
  return { state: { ...state, politics: { ...politics, sessions: [...(politics.sessions ?? []), session].slice(-KEEP_SESSIONS) }, updatedAt: now.toISOString() }, session };
}

const shortText = z.string().trim().max(200);

/** The house's answer to a speech (or its opening): who spoke for which party, and how the player's words moved the parties. */
export const SessionTalkSchema = z.object({
  speeches: z
    .array(z.object({ party: shortText.default(""), speaker: shortText.default(""), text: z.string().trim().min(1).max(1500) }))
    .min(1)
    .max(4),
  sway: z
    .array(z.object({ party: shortText.min(1), shift: z.number().finite() }))
    .max(12)
    .catch([])
    .default([]),
});

export type SessionTalk = z.infer<typeof SessionTalkSchema>;

const findParty = (parties: Party[], key: string) => {
  const needle = key.trim().toLowerCase();
  return needle ? parties.find((p) => p.id === needle || p.name.trim().toLowerCase() === needle || p.short?.trim().toLowerCase() === needle) : undefined;
};

/**
 * The player's speech (none at the opening) and the house's answer join the
 * record. A speech moves a party at most SWAY_STEP, and all the speeches of
 * a sitting at most SWAY_LIMIT; only the player's words move anyone, and
 * only parties with seats.
 */
export function speakInSession(state: GameState, id: string, said: string | null, answer: SessionTalk, now = new Date()): GameState {
  const politics = state.politics;
  const session = politics?.sessions?.find((s) => s.id === id && s.status === "open");
  if (!politics || !session) return state;
  const lines: SessionLine[] = [];
  if (said?.trim()) lines.push({ speaker: state.countries[state.player]?.leader?.split(";")[0].trim() ?? "", text: said.trim().slice(0, 2000), player: true });
  for (const s of answer.speeches) {
    const party = findParty(politics.parties, s.party);
    lines.push({ speaker: s.speaker, ...(party ? { party: party.id } : {}), text: s.text });
  }
  const sway = { ...session.sway };
  if (said?.trim()) {
    for (const s of answer.sway) {
      const party = findParty(politics.parties, s.party);
      if (!party || !(party.seats ?? 0)) continue;
      const step = clamp(s.shift, -1, 1) * SWAY_STEP;
      sway[party.id] = Math.round(clamp((sway[party.id] ?? 0) + step, -SWAY_LIMIT, SWAY_LIMIT) * 1000) / 1000;
    }
  }
  const next: Session = { ...session, transcript: [...session.transcript, ...lines].slice(-60), sway };
  return { ...state, politics: { ...politics, sessions: politics.sessions!.map((s) => (s.id === id ? next : s)) }, updatedAt: now.toISOString() };
}

/** A sitting never plays out without the player: the house votes only after the government has spoken in it. */
export const canVote = (session: Pick<Session, "status" | "transcript">) => session.status === "open" && session.transcript.some((l) => l.player);

/** A day so many days after another. */
function daysAfter(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * The house votes. Each party's members vote by its lean: as one beyond the
 * whip, split nearer the middle, where seeded dice move a few of the
 * waverers. The seats of no party abstain. A passed motion takes effect at
 * once: a law changes, an election is called or put off, emergency rule
 * begins; a lost vote of confidence stirs the country. The rest (a bill, an
 * amendment) the next turn's game master carries out. Until the government
 * has spoken in the sitting there is no vote (canVote).
 */
export function takeVote(state: GameState, id: string, now = new Date()): GameState {
  const politics = state.politics;
  const session = politics?.sessions?.find((s) => s.id === id && s.status === "open");
  const house = politics?.parliament;
  if (!politics || !session || !house || !canVote(session)) return state;
  const seed = state.seed ?? state.id;
  const parties = politics.parties
    .filter((p) => (p.seats ?? 0) > 0)
    .map((p) => {
      const seats = p.seats ?? 0;
      const lean = leanOf(p, session, politics.laws);
      const s = split(lean);
      // The dice move up to a tenth of a split party's members either way.
      const wobble = Math.abs(lean) < WHIP ? (roll(seed, state.turn, `vote:${session.id}:${p.id}`) - 0.5) * 0.2 : 0;
      const yes = clamp(Math.round(seats * (s.for + wobble)), 0, seats);
      const abstain = clamp(Math.round(seats * s.abstain), 0, seats - yes);
      return { party: p.id, for: yes, against: seats - yes - abstain, abstain };
    });
  const counted = parties.reduce((n, p) => n + p.for + p.against + p.abstain, 0);
  const vote: SessionVote = {
    for: parties.reduce((n, p) => n + p.for, 0),
    against: parties.reduce((n, p) => n + p.against, 0),
    abstain: parties.reduce((n, p) => n + p.abstain, 0) + Math.max(0, house.seats - counted),
    need: seatsNeeded(session.motion.kind, house.seats),
    parties,
  };
  const passed = vote.for >= vote.need;
  let next: Politics = { ...politics, sessions: politics.sessions!.map((s) => (s.id === id ? { ...s, status: passed ? ("passed" as const) : ("failed" as const), vote } : s)) };
  const m = session.motion;
  if (passed && m.kind === "law" && m.law && m.option) next = { ...next, laws: { ...(next.laws ?? {}), [m.law]: m.option } };
  if (passed && m.kind === "emergency") next = { ...next, laws: { ...(next.laws ?? {}), martial: "emergency" } };
  if (passed && m.kind === "election") next = { ...next, nextElection: daysAfter(state.date, 60) };
  if (passed && m.kind === "postpone") next = { ...next, nextElection: daysAfter(next.nextElection && next.nextElection > state.date ? next.nextElection : state.date, 365), unrest: clamp(next.unrest + 4, 0, 100) };
  if (m.kind === "confidence") next = { ...next, unrest: clamp(next.unrest + (passed ? -2 : 6), 0, 100) };
  return { ...state, politics: next, updatedAt: now.toISOString() };
}

/** A motion in a line, for the game master. */
function motionLine(m: Motion): string {
  if (m.kind === "law") return `change the ${m.law} law to "${m.option}"${m.text ? ` (${m.text})` : ""}`;
  if (m.kind === "bill") return `bill: ${m.text}`;
  if (m.kind === "constitution") return `constitutional amendment: ${m.text}`;
  if (m.kind === "confidence") return "a vote of confidence in the government";
  if (m.kind === "election") return "an early national election";
  if (m.kind === "postpone") return "putting the national election off";
  return "a state of emergency";
}

/**
 * The sittings since the last turn, for the game master: what passed must
 * be carried out, what failed stands defeated; a lost vote of confidence is
 * the government's crisis to answer.
 */
export function describeSessions(politics: Politics | undefined, turn: number): string[] {
  const held = (politics?.sessions ?? []).filter((s) => s.turn === turn && s.status !== "open");
  if (!held.length) return [];
  return [
    "",
    "PARLIAMENT SINCE THE LAST TURN (sittings the government held; the votes are the engine's and final – carry out what passed, a passed law is already in force; a bill or amendment that passed must now be put into effect):",
    ...held.map((s) => `- ${motionLine(s.motion)}: ${s.status.toUpperCase()} ${s.vote?.for ?? 0}–${s.vote?.against ?? 0} (abstained ${s.vote?.abstain ?? 0}, needed ${s.vote?.need ?? 0})${s.motion.kind === "confidence" && s.status === "failed" ? " – the government LOST the confidence of parliament" : ""}`),
  ];
}

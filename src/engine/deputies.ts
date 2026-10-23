import { z } from "zod";
import { type AdviceMessage, type AdviceReply, type AdvisorId, MAX_ADVICE, swayOf } from "./advisors";
import { roll } from "./dice";
import { STEP_YEARS } from "./economy";
import { officialAt } from "./government";
import { agendaOf, dealInterests, MINISTRY_OF } from "./interests";
import { dressOfficial } from "./people";
import type { AppliedChange, Deputy, GameState, Intrigue, IntrigueEvent, IntrigueGoal, IntriguePrice, Official, OfficialPost } from "./types";
import { OFFICIAL_POSTS } from "./types";

/**
 * The ministries are bigger than their ministers. Each has one to three
 * deputies — first deputies, state secretaries, deputy chiefs — named by the
 * game master the first time the player asks after a ministry's people, with
 * what the model cannot be trusted to deal fairly (their ambition, their
 * loyalty to their own chief, their causes) dealt by the game's dice.
 *
 * The player can talk to a deputy in private, and sound one out to work
 * against their chief: push the minister out, take the post, gather
 * evidence, or undermine a directive. Whether the deputy joins, names a
 * price, refuses or runs to their chief is the dice's, weighted by who the
 * deputy is. A plot then grows turn by turn and may leak; when it comes off
 * or is exposed the engine settles it, the game master is told before
 * writing the turn, and the minister knows only what has leaked.
 */

/** The most deputies a ministry has. */
export const MAX_DEPUTIES = 3;

const shortText = z.string().trim().max(300);
const score = z.number().finite().catch(3).default(3);

/** A ministry's deputies as the game master names them. */
export const DeputiesSetupSchema = z.object({
  deputies: z
    .array(
      z.object({
        name: shortText.min(1),
        title: shortText.min(1),
        traits: z.array(z.string().trim().min(1).max(60)).max(5).catch([]).default([]),
        manner: shortText.default(""),
        competence: score,
        loyalty: score,
        faction: shortText.optional(),
        bio: z.string().trim().max(500).optional(),
      }),
    )
    .min(1)
    .max(MAX_DEPUTIES),
});

export type DeputyDraft = z.infer<typeof DeputiesSetupSchema>["deputies"][number];

const game = (state: Pick<GameState, "seed" | "id">) => state.seed ?? state.id;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const score5 = (v: number) => clamp(Math.round(v), 1, 5);

export const deputiesOf = (state: Pick<GameState, "deputies">, post: OfficialPost) => (state.deputies ?? []).filter((d) => d.deputyOf === post);
export const deputyById = (state: Pick<GameState, "deputies">, id: string) => state.deputies?.find((d) => d.id === id);

/** The dice's view of how a deputy stands with their chief, 1–5: most get on with them, a few resent them. */
function dealChiefLoyalty(state: Pick<GameState, "seed" | "id">, post: OfficialPost, name: string, chief: string): number {
  const r = roll(game(state), 0, `deputy:${post}:${name}:chief:${chief}`);
  return r < 0.15 ? 1 : r < 0.35 ? 2 : r < 0.7 ? 3 : r < 0.9 ? 4 : 5;
}

/** A ministry's deputies as named; a ministry that already has deputies keeps them. */
export function startDeputies<T extends GameState>(state: T, post: OfficialPost, raw: z.infer<typeof DeputiesSetupSchema>): T {
  if (deputiesOf(state, post).length) return state;
  const chief = officialAt(state, post)?.name ?? "";
  const seen = new Set<string>();
  const deputies: Deputy[] = [];
  for (const d of raw.deputies.slice(0, MAX_DEPUTIES)) {
    if (seen.has(d.name)) continue;
    seen.add(d.name);
    const person: Deputy = {
      id: `${post}-${deputies.length + 1}`,
      post,
      deputyOf: post,
      title: d.title,
      name: d.name,
      traits: d.traits.slice(0, 4),
      manner: d.manner,
      competence: score5(d.competence),
      loyalty: score5(d.loyalty),
      chiefLoyalty: dealChiefLoyalty(state, post, d.name, chief),
      ...(d.faction ? { faction: d.faction } : {}),
      ...(d.bio ? { bio: d.bio } : {}),
      since: state.date,
    };
    const interests = dealInterests(state, person);
    if (interests) person.interests = interests;
    // Their sex and portrait, as for any official (engine/people.ts).
    deputies.push({ ...person, ...dressOfficial(person, Number(state.date.slice(0, 4))) });
  }
  return { ...state, deputies: [...(state.deputies ?? []), ...deputies] };
}

export type ApproachAnswer = "joins" | "asks" | "refuses" | "reports";

/** Whether two people of a ministry push for none of the same causes. */
const clash = (a: Pick<Official, "post" | "interests">, b: Pick<Official, "post" | "interests"> | undefined) => {
  if (!b) return false;
  const mine = new Set(agendaOf(a).map((x) => x.en));
  const theirs = agendaOf(b);
  return mine.size > 0 && theirs.length > 0 && !theirs.some((x) => mine.has(x.en));
};

/**
 * How a deputy is likely to take being sounded out against their chief:
 * ambition and a grudge against the chief make them willing, loyalty to the
 * leader makes them serve the leader's wishes, and loyalty to the chief
 * makes them report it.
 */
export function approachOdds(deputy: Deputy, chief: Official | undefined): { willing: number; report: number } {
  const ambition = deputy.interests?.ambition ?? 3;
  const willing = clamp(0.1 + 0.1 * (ambition - 1) + 0.1 * (5 - deputy.chiefLoyalty) + 0.05 * (deputy.loyalty - 3) + (clash(deputy, chief) ? 0.1 : 0), 0.03, 0.9);
  const report = clamp(0.04 + 0.07 * (deputy.chiefLoyalty - 1) - 0.04 * (deputy.loyalty - 3), 0.02, 0.5);
  return { willing, report };
}

/** What the deputy asks in return: the post itself, money, or protection. */
export function priceOf(deputy: Deputy, goal: IntrigueGoal): IntriguePrice {
  if (goal === "replace" || (deputy.interests?.ambition ?? 3) >= 4) return "post";
  return deputy.loyalty <= 2 ? "money" : "protection";
}

/** % a month that a plot leaks: a clumsy deputy and an able chief give it away. */
export function intrigueRisk(deputy: Deputy, chief: Official | undefined, goal: IntrigueGoal): number {
  const base = 6 + 3 * (5 - deputy.competence) + 2 * ((chief?.competence ?? 3) - 1);
  return Math.round(clamp(base + (goal === "sabotage" ? 4 : goal === "evidence" ? -2 : 0), 3, 35));
}

/** Strength a plot gains in a month before the dice: an able, ambitious deputy with a promise moves fast. */
export function intrigueGain(deputy: Deputy, chief: Official | undefined, goal: IntrigueGoal, promised: boolean): number {
  const base = 8 + 4 * deputy.competence + 3 * (deputy.interests?.ambition ?? 3) - 3 * (chief?.competence ?? 3) + (promised ? 6 : 0);
  return Math.max(2, base) * { oust: 1, replace: 0.8, evidence: 1.3, sabotage: 1.5 }[goal];
}

function newIntrigue(state: GameState, deputy: Deputy, goal: IntrigueGoal, directive: string | undefined, price: IntriguePrice | undefined, event: IntrigueEvent, stage: Intrigue["stage"]): Intrigue {
  const chief = officialAt(state, deputy.deputyOf);
  return {
    id: `i${state.turn}-${deputy.id}-${(state.intrigues ?? []).length + 1}`,
    deputy: deputy.id,
    deputyName: deputy.name,
    post: deputy.deputyOf,
    target: chief?.name ?? "",
    goal,
    ...(goal === "sabotage" && directive ? { directive } : {}),
    strength: price ? 15 : 10,
    risk: intrigueRisk(deputy, chief, goal),
    stage,
    ...(price ? { price } : {}),
    since: state.date,
    last: { turn: state.turn, event },
  };
}

/** A plot of this deputy still going. */
export const activeIntrigue = (state: Pick<GameState, "intrigues">, deputyId: string) => state.intrigues?.find((i) => i.deputy === deputyId && i.stage === "active");

/** Why the government cannot sound this deputy out now, if it cannot. */
export function cannotApproach(state: GameState, deputyId: string, goal: IntrigueGoal, directive?: string): "unknown" | "no-chief" | "already" | "this-turn" | "no-directive" | null {
  const deputy = deputyById(state, deputyId);
  if (!deputy) return "unknown";
  if (!officialAt(state, deputy.deputyOf)) return "no-chief";
  if (activeIntrigue(state, deputyId)) return "already";
  if (deputy.approached === state.turn) return "this-turn";
  if (goal === "sabotage" && !(state.directives ?? []).some((d) => d.id === directive && MINISTRY_OF[deputy.deputyOf] === d.ministry)) return "no-directive";
  return null;
}

/**
 * The government sounds a deputy out against their chief, once a turn. The
 * dice answer for the deputy: they join (the plot starts), name a price (the
 * government may agree with `agreePrice`), refuse, or tell their chief — who
 * then knows the government tried to turn their deputy against them.
 */
export function approachDeputy(state: GameState, deputyId: string, goal: IntrigueGoal, directive?: string, now = new Date()): { state: GameState; answer: ApproachAnswer; price?: IntriguePrice } {
  if (cannotApproach(state, deputyId, goal, directive)) return { state, answer: "refuses" };
  const deputy = deputyById(state, deputyId)!;
  const chief = officialAt(state, deputy.deputyOf);
  const { willing, report } = approachOdds(deputy, chief);
  const r = roll(game(state), state.turn, `approach:${deputy.id}:${goal}`);
  const answer: ApproachAnswer = r < willing * 0.55 ? "joins" : r < willing ? "asks" : r > 1 - report ? "reports" : "refuses";
  const deputies = (state.deputies ?? []).map((d) => (d.id === deputy.id ? { ...d, approached: state.turn } : d));
  let next: GameState = { ...state, deputies, updatedAt: now.toISOString() };
  if (answer === "joins") next = { ...next, intrigues: [...(state.intrigues ?? []), newIntrigue(state, deputy, goal, directive, undefined, "begun", "active")] };
  if (answer === "reports") {
    next = {
      ...next,
      intrigues: [...(state.intrigues ?? []), newIntrigue(state, deputy, goal, directive, undefined, "reported", "exposed")],
      officials: (state.officials ?? []).map((o) => (o.post === deputy.deputyOf ? betrayed(o, state.turn, "learnt from their deputy that the government tried to turn the deputy against them") : o)),
    };
  }
  return { state: next, answer, ...(answer === "asks" ? { price: priceOf(deputy, goal) } : {}) };
}

/** The government agrees to what a deputy asked: the plot starts, a little stronger for the promise. */
export function agreePrice(state: GameState, deputyId: string, goal: IntrigueGoal, price: IntriguePrice, directive?: string, now = new Date()): GameState {
  const deputy = deputyById(state, deputyId);
  if (!deputy || activeIntrigue(state, deputyId) || !officialAt(state, deputy.deputyOf)) return state;
  return { ...state, intrigues: [...(state.intrigues ?? []), newIntrigue(state, deputy, goal, directive, price, "begun", "active")], updatedAt: now.toISOString() };
}

/** The government calls a plot off; what was done stays done, and the deputy remembers. */
export function dropIntrigue(state: GameState, id: string, now = new Date()): GameState {
  if (!state.intrigues?.some((i) => i.id === id && i.stage === "active")) return state;
  return { ...state, intrigues: state.intrigues.map((i) => (i.id === id ? { ...i, stage: "dropped", last: { turn: state.turn, event: "dropped" } } : i)), updatedAt: now.toISOString() };
}

/** A minister who has found out about a plot against them: less loyal, and angry. */
function betrayed(o: Official, turn: number, grievance: string): Official {
  const loyalty = score5(o.loyalty - 1);
  return { ...o, loyalty, mood: { stance: loyalty <= 2 ? "resigning" : "opposed", grievance, turn } };
}

export interface IntrigueRoll {
  id: string;
  event: Extract<IntrigueEvent, "progress" | "done" | "exposed" | "moot">;
  /** Strength after the period. */
  strength: number;
}

/**
 * What the period does to each plot still going, decided by the dice before
 * the turn is written, so the game master can tell it and replaying the turn
 * ends the same. A plot whose chief has left the post is moot.
 */
export function castIntrigues(state: GameState): IntrigueRoll[] {
  const months = clamp(STEP_YEARS[state.step] * 12, 0.25, 3);
  const out: IntrigueRoll[] = [];
  for (const i of state.intrigues ?? []) {
    if (i.stage !== "active") continue;
    const deputy = deputyById(state, i.deputy);
    const chief = officialAt(state, i.post);
    if (!deputy || !chief || chief.name !== i.target) {
      out.push({ id: i.id, event: "moot", strength: i.strength });
      continue;
    }
    const leak = 1 - (1 - i.risk / 100) ** months;
    if (roll(game(state), state.turn, `intrigue:${i.id}:leak`) < leak) {
      out.push({ id: i.id, event: "exposed", strength: i.strength });
      continue;
    }
    const gain = intrigueGain(deputy, chief, i.goal, Boolean(i.price)) * months * (0.6 + 0.8 * roll(game(state), state.turn, `intrigue:${i.id}:gain`));
    const strength = Math.min(100, Math.round(i.strength + gain));
    out.push({ id: i.id, event: strength >= 100 ? "done" : "progress", strength });
  }
  return out;
}

/** A deputy takes their chief's post: they leave the deputies and keep who they are. */
function promote(next: GameState, deputy: Deputy, title: string, to: string, applied: AppliedChange[]): void {
  const official: Official = {
    post: deputy.deputyOf,
    title,
    name: deputy.name,
    traits: deputy.traits,
    manner: deputy.manner,
    competence: deputy.competence,
    loyalty: deputy.loyalty,
    ...(deputy.faction ? { faction: deputy.faction } : {}),
    ...(deputy.bio ? { bio: deputy.bio } : {}),
    ...(deputy.interests ? { interests: deputy.interests } : {}),
    ...(deputy.gender ? { gender: deputy.gender } : {}),
    ...(deputy.portrait ? { portrait: deputy.portrait } : {}),
    since: to,
  };
  next.officials = [...(next.officials ?? []).filter((o) => o.post !== deputy.deputyOf), official].sort((a, b) => OFFICIAL_POSTS.indexOf(a.post) - OFFICIAL_POSTS.indexOf(b.post));
  next.deputies = (next.deputies ?? []).filter((d) => d.id !== deputy.id);
  applied.push({ kind: "official", post: deputy.deputyOf, title, name: deputy.name, change: "appointed" });
}

/**
 * The plots as the dice settled them, once the turn's own changes to the
 * government have landed. A plot that comes off:
 * - oust: the chief is dismissed (and the deputy takes the post if it was promised);
 * - replace: the chief is dismissed and the deputy takes the post;
 * - evidence: the chief, knowing what the government holds, falls into line;
 * - sabotage: the directive fails.
 * One exposed costs the chief's loyalty and may cost the deputy their job.
 * Deputies whose chief changed this turn size up the new one.
 */
export function applyIntrigues(next: GameState, rolls: IntrigueRoll[], ctx: { turn: number; to: string; seed: string }, applied: AppliedChange[]): void {
  for (const r of rolls) {
    const i = next.intrigues?.find((x) => x.id === r.id);
    if (!i || i.stage !== "active") continue;
    const deputy = deputyById(next, i.deputy);
    const chief = officialAt(next, i.post);
    // The turn itself may have removed the chief or the deputy since the dice were cast.
    const moot = r.event === "moot" || !deputy || !chief || chief.name !== i.target;
    const event: IntrigueEvent = moot ? "moot" : r.event;
    const stage: Intrigue["stage"] = event === "done" ? "done" : event === "exposed" ? "exposed" : event === "moot" ? "dropped" : "active";
    next.intrigues = next.intrigues!.map((x) => (x.id === i.id ? { ...x, strength: r.strength, stage, last: { turn: ctx.turn, event } } : x));
    if (moot || !deputy || !chief) continue;
    if (event === "exposed") {
      next.officials = (next.officials ?? []).map((o) => (o.post === i.post ? betrayed(o, ctx.turn, `caught their deputy ${deputy.name} plotting with the government against them`) : o));
      // The chief throws the deputy out about half the time; otherwise the two are enemies.
      if (roll(ctx.seed, ctx.turn, `intrigue:${i.id}:fired`) < 0.5) next.deputies = (next.deputies ?? []).filter((d) => d.id !== deputy.id);
      else next.deputies = (next.deputies ?? []).map((d) => (d.id === deputy.id ? { ...d, chiefLoyalty: 1 } : d));
      applied.push({ kind: "intrigue", post: i.post, deputy: deputy.name, target: chief.name, goal: i.goal, event: "exposed" });
      continue;
    }
    if (event !== "done") continue;
    applied.push({ kind: "intrigue", post: i.post, deputy: deputy.name, target: chief.name, goal: i.goal, event: "done" });
    if (i.goal === "oust" || i.goal === "replace") {
      next.officials = (next.officials ?? []).filter((o) => o.post !== i.post);
      applied.push({ kind: "official", post: i.post, title: chief.title, name: chief.name, change: "dismissed" });
      if (i.goal === "replace" || i.price === "post") promote(next, deputy, chief.title, ctx.to, applied);
    } else if (i.goal === "evidence") {
      next.officials = (next.officials ?? []).map((o) =>
        o.post === i.post ? { ...o, loyalty: Math.max(o.loyalty, 4), mood: { stance: "uneasy", grievance: "knows the government holds evidence against them", turn: ctx.turn } } : o,
      );
    } else if (i.goal === "sabotage" && i.directive) {
      next.directives = (next.directives ?? []).filter((d) => d.id !== i.directive);
    }
  }
  refreshChiefLoyalty(next, ctx.seed, ctx.to);
}

/** Deputies whose chief is new size them up afresh. */
function refreshChiefLoyalty(next: GameState, seed: string, to: string): void {
  if (!next.deputies?.length) return;
  // A deputy the turn named to their chief's post is a minister now.
  next.deputies = next.deputies.filter((d) => officialAt(next, d.deputyOf)?.name !== d.name);
  next.deputies = next.deputies.map((d) => {
    const chief = officialAt(next, d.deputyOf);
    if (!chief || chief.since !== to) return d;
    return { ...d, chiefLoyalty: dealChiefLoyalty({ id: seed }, d.deputyOf, d.name, chief.name) };
  });
}

const GOAL_EN: Record<IntrigueGoal, string> = {
  oust: "to push their chief out of the post",
  replace: "to take their chief's post",
  evidence: "to gather evidence against their chief",
  sabotage: "to undermine one of their chief's directives",
};
const PRICE_EN: Record<IntriguePrice, string> = { post: "the post", money: "money", protection: "the leader's protection" };
const EVENT_EN: Record<IntrigueRoll["event"], string> = {
  progress: "it gained ground and is still secret",
  done: "it came off",
  exposed: "it leaked: the chief found out",
  moot: "the chief has left the post: it is over",
};

/**
 * For the turn's game master: the deputies the ministries have, and the
 * government's plots in them with what the dice made of each this period.
 */
export function describeIntrigues(state: GameState): string[] {
  const lines: string[] = [];
  if (state.deputies?.length) {
    lines.push("", "DEPUTIES IN THE MINISTRIES (they can step up when a post falls empty):");
    for (const post of OFFICIAL_POSTS) {
      const ds = deputiesOf(state, post);
      if (ds.length) lines.push(`- ${post}: ${ds.map((d) => `${d.name} (${d.title})`).join("; ")}`);
    }
  }
  const rolls = new Map(castIntrigues(state).map((r) => [r.id, r]));
  const going = (state.intrigues ?? []).filter((i) => rolls.has(i.id));
  if (going.length) {
    lines.push("", "THE GOVERNMENT'S OWN PLOTS INSIDE ITS MINISTRIES (secret; the engine's dice have settled them for this period — tell them as they fell, never contradict them; the engine applies the result):");
    for (const i of going) {
      const r = rolls.get(i.id)!;
      const result = r.event === "done" ? `${EVENT_EN.done}: ${doneEn(i)}` : EVENT_EN[r.event];
      lines.push(`- ${i.deputyName}, deputy in the ${i.post} ministry, works with the government ${GOAL_EN[i.goal]} ${i.target}${i.price ? `, promised ${PRICE_EN[i.price]}` : ""}: ${result}.`);
    }
  }
  return lines;
}

function doneEn(i: Intrigue): string {
  if (i.goal === "oust") return `${i.target} is dismissed${i.price === "post" ? ` and ${i.deputyName} takes the post` : ""}`;
  if (i.goal === "replace") return `${i.target} is dismissed and ${i.deputyName} takes the post`;
  if (i.goal === "evidence") return `the government now holds evidence against ${i.target}, who falls into line`;
  return "the directive fails from inside";
}

/** For a minister's own prompt: their deputies, and what has leaked to them of plots against them. */
export function describeForMinister(state: GameState, post: OfficialPost): string[] {
  const chief = officialAt(state, post);
  const ds = deputiesOf(state, post);
  const leaked = (state.intrigues ?? []).filter((i) => i.post === post && i.stage === "exposed" && chief && i.target === chief.name);
  const lines: string[] = [];
  if (ds.length) lines.push("", "YOUR DEPUTIES:", ...ds.map((d) => `- ${d.name}, ${d.title}; how they stand with you: ${CHIEF_EN[d.chiefLoyalty - 1]}`));
  if (leaked.length) lines.push("", "WHAT YOU HAVE LEARNT OF PLOTS AGAINST YOU:", ...leaked.map((i) => `- the government worked with ${i.deputyName} ${GOAL_EN[i.goal]} you (found out ${i.last.turn === state.turn - 1 ? "last turn" : "earlier"})`));
  return lines;
}

const CHIEF_EN = ["resents you", "cool towards you", "correct", "devoted to you", "your protégé"];

/** A deputy speaks in private: who they are, their view of their chief, and the plot they are in, if any. */
export function deputyPersona(state: GameState, deputy: Deputy, field: string): string {
  const chief = officialAt(state, deputy.deputyOf);
  const intrigue = activeIntrigue(state, deputy.id);
  const ambition = deputy.interests?.ambition ?? 3;
  const loyalty = deputy.loyalty <= 2 ? " Your loyalty to the leader is thin." : deputy.loyalty >= 5 ? " You are devoted to the leader." : "";
  const skill = deputy.competence <= 2 ? " You are not very able, and it shows." : deputy.competence >= 5 ? " You are among the ablest people in the ministry." : "";
  const toChief = chief ? ` Your chief is ${chief.name}, ${chief.title}; you are ${CHIEF_SELF[deputy.chiefLoyalty - 1]}.` : " Your ministry has no chief at the moment.";
  const plot = intrigue
    ? ` In secret you are working with the government ${GOAL_EN[intrigue.goal]}${intrigue.price ? `, for ${PRICE_EN[intrigue.price]}` : ""}; it has come ${intrigue.strength}% of the way. Speak of it only in private, carefully.`
    : " If the government hints at moving against your chief, answer guardedly, as your ambition and loyalties make likely; you commit to nothing in a conversation.";
  return `You are ${deputy.name}, ${deputy.title}: a deputy in ${field}${toChief} Your character: ${deputy.traits.join(", ") || "reserved"}. How you speak: ${deputy.manner || "plainly"}.${deputy.faction ? ` You belong to ${deputy.faction}.` : ""}${skill}${loyalty} Your ambition: ${ambition}/5.${plot} This is a private conversation with the leader, behind your chief's back: you speak more frankly than a minister would about how the ministry really works — its failures, its people, its money and your chief.`;
}

const CHIEF_SELF = ["resentful of your chief", "cool towards your chief", "correct with your chief", "devoted to your chief", "your chief's protégé"];

/** The ministry a deputy serves in. */
export const ministryOfDeputy = (deputy: Pick<Deputy, "deputyOf">): AdvisorId | undefined => MINISTRY_OF[deputy.deputyOf];

/** A private conversation with a deputy, kept like a minister's. */
export function addDeputyAdvice(state: GameState, deputyId: string, question: string, reply: AdviceReply, now = new Date()): GameState {
  const thread = state.deputyAdvice?.[deputyId] ?? [];
  const asked: AdviceMessage = { from: "player", text: question, date: state.date, turn: state.turn };
  const answered: AdviceMessage = { from: "advisor", text: reply.answer, date: state.date, turn: state.turn };
  // A word in private may win the deputy over or put them off, as with a minister.
  const mood = swayOf(state.deputies?.find((d) => d.id === deputyId), reply, state.turn);
  return {
    ...state,
    deputyAdvice: { ...state.deputyAdvice, [deputyId]: [...thread, asked, answered].slice(-MAX_ADVICE) },
    ...(mood && state.deputies ? { deputies: state.deputies.map((d) => (d.id === deputyId ? { ...d, mood } : d)) } : {}),
    updatedAt: now.toISOString(),
  };
}

/** A save from before deputies: empty lists, so a ministry's people can be asked after. */
export function ensureDeputies<T extends Pick<GameState, "deputies" | "intrigues">>(state: T): T {
  if (state.deputies && state.intrigues) return state;
  return { ...state, deputies: state.deputies ?? [], intrigues: state.intrigues ?? [] };
}

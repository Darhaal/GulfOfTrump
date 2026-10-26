import { z } from "zod";
import { ADVISOR_POST, ADVISOR_TITLES, ADVISORS, type AdvisorId } from "./advisors";
import { divisionSize } from "./army";
import { yearOf } from "./calendar";
import { happens } from "./dice";
import { STEP_YEARS } from "./economy";
import { FIGURES } from "./figures.data";
import { dressOfficial, knownById, leaderOf, personFor, samePerson } from "./people";
import { loyaltyOf } from "./politics";
import { maxShift, regimeNow } from "./role";
import { en } from "./text";
import type { AppliedChange, Command, CommandScope, GameState, Gender, Official, OfficialPost, Person, PlayerRole, RegimeKind, ScenarioId, Standing } from "./types";

/**
 * A minister or a general as the player's role. The player holds one post in
 * a government the game master plays: a ministry, with its competence and
 * its budget, or a command, with its troops. Each has a standing of its own —
 * influence with the leader, the post's means, the loyalty of its people to
 * them — and its own way up: the leader names them head of government, the
 * troops follow them in a coup, or their resignation brings the cabinet down.
 * The orders are the post's; which of them the government accepts is cast by
 * the engine's dice before the turn is written, from the standing and the
 * kind of rule. Falls — dismissal, resignation, death — are engine/fate.ts.
 */

const shortText = z.string().trim().max(300);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const round = Math.round;

/** The posts a minister can hold: the eight ministries, by the post their minister holds. */
export const MINISTER_POSTS: OfficialPost[] = ADVISORS.map((a) => ADVISOR_POST[a]);
export const isMinisterPost = (post: string | undefined): post is OfficialPost => MINISTER_POSTS.includes(post as OfficialPost);
/** The ministry of a post. */
export const ministryOf = (post: OfficialPost): AdvisorId | undefined => ADVISORS.find((a) => ADVISOR_POST[a] === post);

export const isFigure = (state: Pick<GameState, "role">): boolean => state.role?.kind === "minister" || state.role?.kind === "general";
/** Whether the player governs: only the leader does; the opposition, a minister and a general act within their means. */
export const governs = (state: Pick<GameState, "role">): boolean => !state.role || state.role.kind === "leader";

const asPerson = (id: string): Person | undefined => {
  const k = knownById(id);
  return k ? { id: k.id, name: k.name.en, gender: k.gender, ...(k.portrait ? { portrait: k.id } : {}) } : undefined;
};

/**
 * Who held a post in a country on a start date, as the portrait data has them
 * (engine/figures.data.ts): the people a player may start as. Each comes with
 * their own portrait or none; those with one first. The generals of a date are
 * the military post's people.
 */
export function figuresOn(date: ScenarioId, country: string, post: OfficialPost): Person[] {
  const people = (FIGURES[date]?.[country]?.[post] ?? []).flatMap((id) => asPerson(id) ?? []);
  return [...people.filter((p) => p.portrait), ...people.filter((p) => !p.portrait)];
}

/** Where a player starts: as influential as the post makes them, with the post's ordinary means. */
export function startingStanding(kind: "minister" | "general", regime: RegimeKind, post?: OfficialPost, scope?: CommandScope): Standing {
  // Where one man rules, a minister counts for less; the leader's own chief of staff, for more.
  const tight = regime === "autocracy" || regime === "party" || regime === "military";
  // A new commander's troops do not yet follow them anywhere the leader would not (COUP_LOYALTY).
  if (kind === "general") return { influence: scope === "forces" ? 55 : 40, means: 55, loyalty: scope === "forces" ? 50 : 55 };
  return { influence: post === "chief" ? 60 : tight ? 40 : 45, means: 50, loyalty: 50 };
}

export interface FigureChoice {
  kind: "minister" | "general";
  /** A person of the date, by id (figuresOn), or a name of the player's own. */
  personId?: string;
  person?: string;
  gender?: Gender;
  post?: string;
  scope?: CommandScope;
  /** The front a general commands, in the player's words. */
  front?: string;
}

/** A minister or a general at the start: the person the player chose, or one the game master names. */
export function startingFigure(regime: RegimeKind, date: string, choice: FigureChoice): PlayerRole {
  const year = yearOf(date);
  const known = choice.personId ? asPerson(choice.personId) : undefined;
  const named = !known && choice.person?.trim() ? personFor(choice.person.trim(), year, choice.gender) : undefined;
  const person = known ?? named;
  if (choice.kind === "general") {
    const scope: CommandScope = choice.scope === "forces" ? "forces" : "front";
    const command: Command = { scope, ...(scope === "front" && choice.front?.trim() ? { name: choice.front.trim().slice(0, 80) } : {}) };
    return { kind: "general", ...(person ? { person } : {}), command, standing: startingStanding("general", regime, undefined, scope), since: date, how: "start" };
  }
  const post = isMinisterPost(choice.post) ? choice.post : "foreign";
  return { kind: "minister", ...(person ? { person } : {}), post, standing: startingStanding("minister", regime, post), since: date, how: "start" };
}

const DEFAULT_STANDING: Standing = { influence: 45, means: 50, loyalty: 50 };
export const standingOf = (role: PlayerRole | undefined): Standing => role?.standing ?? DEFAULT_STANDING;

/** How readily a government takes up what its ministers ask, by the kind of rule. */
const OBEDIENT: Record<RegimeKind, number> = { democracy: 0.6, limited: 0.55, party: 0.45, autocracy: 0.4, military: 0.45 };

/**
 * The chance the government accepts one of the player's orders, 0–1: a
 * minister's by the kind of rule, their influence and the ministry's means; a
 * general's orders to their own troops stand unless the high command
 * overrules them, the less often the more the leader trusts them and the
 * troops follow them.
 */
export function approvalChance(state: Pick<GameState, "role" | "politics" | "scenarioId" | "player" | "defeat">): number {
  const s = standingOf(state.role);
  if (state.role?.kind === "general") return clamp(0.6 + (s.influence - 50) / 250 + (s.loyalty - 50) / 250 + (s.means - 50) / 400, 0.15, 0.95);
  return clamp(OBEDIENT[regimeNow(state)] + (s.influence - 50) / 140 + (s.means - 50) / 500, 0.05, 0.95);
}

/** Which of the turn's orders the government accepts, by the game's dice: the same for the same game, turn and order. */
export function castApprovals(state: GameState, orders: string[]): boolean[] {
  if (!isFigure(state)) return [];
  const chance = approvalChance(state);
  return orders.map((o) => happens(chance, state.seed ?? state.id, state.turn, `approval:${o}`));
}

/** The base danger of dismissal under each kind of rule, % a month. */
const DISMISSAL: Record<RegimeKind, number> = { democracy: 0.8, limited: 1.2, party: 1.6, autocracy: 2, military: 2 };

/**
 * How likely the leader is to dismiss the player this month, %: the kind of
 * rule, how little the leader listens to them, and — where one man rules — how
 * much a following of their own makes him fear them.
 */
export function dismissalRisk(state: Pick<GameState, "role" | "politics" | "scenarioId" | "player" | "defeat">): number {
  if (!isFigure(state)) return 0;
  const s = standingOf(state.role);
  const regime = regimeNow(state);
  let risk = DISMISSAL[regime] + Math.max(0, 45 - s.influence) / 6;
  if (regime !== "democracy" && regime !== "limited") risk += Math.max(0, s.loyalty - 70) / 8;
  return Math.round(clamp(risk, 0, 30) * 10) / 10;
}

/** Whether the leader dismisses the player this turn, by the game's dice. */
export function castDismissal(state: GameState): boolean {
  const months = STEP_YEARS[state.step] * 12;
  const chance = 1 - (1 - dismissalRisk(state) / 100) ** Math.max(0.25, months);
  return happens(chance, state.seed ?? state.id, state.turn, "dismissal");
}

/** A general can try a coup only with troops loyal to them and fit to march. */
export const COUP_LOYALTY = 60;
export const COUP_MEANS = 40;
/** The leader names someone head of government only when they listen to them this much. */
export const APPOINT_INFLUENCE = 70;

export const canCoup = (state: Pick<GameState, "role">): boolean => {
  const s = standingOf(state.role);
  return state.role?.kind === "general" && s.loyalty >= COUP_LOYALTY && s.means >= COUP_MEANS;
};

/** How likely a general's coup is to succeed, 0–1: their troops' loyalty, the army's loyalty to the government, the unrest. */
export function coupChance(state: Pick<GameState, "role" | "politics">): number {
  if (!canCoup(state)) return 0;
  const s = standingOf(state.role);
  const army = state.politics ? loyaltyOf(state.politics).army : 60;
  const unrest = state.politics?.unrest ?? 20;
  return clamp(0.2 + (s.loyalty - COUP_LOYALTY) / 80 + (50 - army) / 100 + unrest / 250 + (state.role?.command?.scope === "forces" ? 0.1 : 0), 0.05, 0.9);
}

/** Whether a coup by the player's troops would succeed this turn, by the game's dice; decided before the turn is written. */
export const castCoup = (state: GameState): boolean => canCoup(state) && happens(coupChance(state), state.seed ?? state.id, state.turn, "figure-coup");

/** How readily a cabinet falls when a minister walks out, by the kind of rule. */
const TOPPLE: Record<RegimeKind, number> = { democracy: 0.25, limited: 0.15, party: 0.06, autocracy: 0.03, military: 0.03 };

/**
 * The chance a minister's resignation brings the cabinet down, 0–1: likeliest
 * where governments answer to a parliament and rest on a coalition, and for a
 * minister the leader listens to and whose people follow them out.
 */
export function toppleChance(state: Pick<GameState, "role" | "politics" | "scenarioId" | "player" | "defeat">): number {
  if (state.role?.kind !== "minister") return 0;
  const s = standingOf(state.role);
  const coalition = Boolean(state.politics?.parties.some((p) => p.status === "coalition"));
  return clamp(TOPPLE[regimeNow(state)] + (s.influence - 50) / 200 + (s.loyalty - 50) / 250 + (state.politics?.unrest ?? 20) / 400 + (coalition ? 0.15 : 0), 0, 0.8);
}

/** The ways up for a minister or a general: named head of government, a coup, or a resignation that topples the cabinet. */
export const FIGURE_RISES = ["appointed", "coup", "cabinet"] as const;
export type FigureRise = (typeof FIGURE_RISES)[number];

/** Whether the player's standing now allows this way up (the coup's own dice and the resignation's are cast apart). */
export function canFigureRise(state: Pick<GameState, "role" | "politics" | "scenarioId" | "player" | "defeat">, how: FigureRise): boolean {
  if (!isFigure(state)) return false;
  if (how === "appointed") return standingOf(state.role).influence >= APPOINT_INFLUENCE;
  if (how === "coup") return canCoup(state);
  return toppleChance(state) > 0.1;
}

/** Soldiers in a front when nothing says how many: about a third of the army. */
const FRONT_SHARE = 0.35;

/** The formation of the army's organisation the player commands, if the game master named them its commander (engine/army.ts). */
export function ownFormation(state: Pick<GameState, "role" | "countries" | "player">) {
  const role = state.role;
  if (role?.kind !== "general") return undefined;
  const formations = state.countries[state.player]?.arsenal?.organisation?.formations ?? [];
  const name = role.command?.name?.trim().toLowerCase();
  return formations.find((f) => (role.person && f.commander && samePerson(f.commander, role.person.name)) || (name && f.name.trim().toLowerCase() === name));
}

/** The soldiers under the player's command, thousands: the formation's divisions, all the army, or a front's share of it. */
export function commandTroops(state: Pick<GameState, "role" | "countries" | "player" | "date">): number {
  const troops = state.countries[state.player]?.economy?.troops ?? 0;
  if (state.role?.kind !== "general") return 0;
  const formation = ownFormation(state);
  if (formation?.divisions) return Math.min(troops, formation.divisions * divisionSize(yearOf(state.date)));
  return round(state.role.command?.scope === "forces" ? troops : troops * FRONT_SHARE);
}

/** What a turn's answer says about a minister's or a general's standing: changes, never totals; names where none were given. */
export const figureField = z
  .object({
    name: shortText.optional(),
    gender: z.enum(["male", "female"]).optional().catch(undefined),
    front: shortText.optional(),
    influence: z.number().finite().optional(),
    means: z.number().finite().optional(),
    loyalty: z.number().finite().optional(),
    // Who takes over when the player's person falls this period: the post, the movement or the country.
    successor: shortText.optional(),
    rise: z
      .object({ how: z.enum(FIGURE_RISES).catch("appointed"), government: shortText.optional(), note: z.string().trim().max(2000).default("") })
      .optional()
      .catch(undefined),
  })
  .optional()
  .catch(undefined);

export type FigureChange = NonNullable<z.infer<typeof figureField>>;

const STANDING_KEYS = ["influence", "means", "loyalty"] as const;

/** The figure's changes, each within a turn's reach; names only where none were given; a successor for any role. */
export function sanitizeFigure(state: GameState, raw: FigureChange | undefined): FigureChange | undefined {
  if (!raw) return undefined;
  const successor = raw.successor ? { successor: raw.successor } : {};
  if (!isFigure(state)) return Object.keys(successor).length ? successor : undefined;
  const role = state.role!;
  const span = maxShift(state.step);
  const within = (v: number | undefined) => (v === undefined ? undefined : round(clamp(v, -span, span)));
  return {
    ...(raw.name && !role.person ? { name: raw.name, ...(raw.gender ? { gender: raw.gender } : {}) } : {}),
    ...(raw.front && role.kind === "general" && role.command?.scope === "front" && !role.command.name ? { front: raw.front } : {}),
    ...Object.fromEntries(STANDING_KEYS.map((k) => [k, within(raw[k])]).filter(([, v]) => v !== undefined)),
    ...successor,
    ...(raw.rise ? { rise: raw.rise } : {}),
  };
}

/** The title of the player's post in English, for the prompts and for someone the game master has not named. */
export function postTitleEn(role: PlayerRole): string {
  if (role.kind === "general") return role.command?.scope === "forces" ? "Commander-in-Chief" : "Front Commander";
  const ministry = role.post ? ministryOf(role.post) : undefined;
  return ministry ? en(ADVISOR_TITLES[ministry]) : "Minister";
}

/** Seats the player's minister in their post in the cabinet the game master described, with the person's own sex and portrait. */
export function seatFigure(officials: Official[], state: Pick<GameState, "role" | "date">): Official[] {
  const role = state.role;
  if (role?.kind !== "minister" || !role.person || !role.post) return officials;
  const person = role.person;
  const at = officials.find((o) => o.post === role.post);
  if (at && samePerson(at.name, person.name)) return officials;
  const seated: Official = dressOfficial(
    {
      ...(at ?? { post: role.post, title: postTitleEn(role), traits: [], manner: "", competence: 3, loyalty: 3 }),
      post: role.post,
      name: person.name,
      gender: person.gender,
      ...(person.portrait ? { portrait: person.portrait } : {}),
      since: at?.since ?? state.date,
    },
    yearOf(state.date),
  );
  return [...officials.filter((o) => o.post !== role.post && !samePerson(o.name, person.name)), seated];
}

/** For the game master who first names the government: the player's minister holds their post, a general their command. */
export function describeFigureSetup(state: Pick<GameState, "role">): string[] {
  const role = state.role;
  if (!role || !isFigure(state)) return [];
  const who = role.person?.name ?? "a person you name";
  if (role.kind === "minister" && role.post) return [`The player is ${who}, who holds the "${role.post}" post (${postTitleEn(role)}): name them in it.`];
  return [`The player is ${who}, a general commanding ${role.command?.scope === "forces" ? "all the armed forces" : (role.command?.name ?? "a front")}.`];
}

/** A turn's changes to the government without the player's own post: what becomes of the player is the engine's to decide (engine/fate.ts). */
export function withoutPlayerPost<T extends { post: OfficialPost }>(state: Pick<GameState, "role">, changes: T[]): T[] {
  const post = state.role?.kind === "minister" ? state.role.post : undefined;
  return post ? changes.filter((c) => c.post !== post) : changes;
}

/** Applies the period to the figure: the engine's dice on the orders and the answer's changes to the standing. In place. */
export function applyFigureStanding(next: GameState, change: FigureChange | undefined, approvals: boolean[], ctx: { to: string }, applied: AppliedChange[]): void {
  if (!isFigure(next)) return;
  const role = (next.role = { ...next.role! });
  if (approvals.length) {
    const accepted = approvals.flatMap((ok, i) => (ok ? [i + 1] : []));
    const refused = approvals.flatMap((ok, i) => (ok ? [] : [i + 1]));
    applied.push({ kind: "approval", accepted, refused });
  }
  const s = { ...standingOf(role) };
  // Accepted orders bring the leader closer, refused ones cost a little.
  const net = approvals.filter(Boolean).length - approvals.filter((ok) => !ok).length;
  s.influence += clamp(net, -3, 3);
  for (const k of STANDING_KEYS) s[k] = round(clamp(s[k] + (change?.[k] ?? 0), 0, 100));
  role.standing = s;
  if (change?.name) {
    role.person = personFor(change.name, yearOf(ctx.to), change.gender);
    if (next.officials?.length) next.officials = seatFigure(next.officials, next);
  }
  if (change?.front && role.command) role.command = { ...role.command, name: change.front };
}

/**
 * The figure in office: the leader names them head of government (the
 * cabinet stays, they take its chair), or a coup or a fallen cabinet makes a
 * new government around them. The player governs again. In place.
 */
export function figureTakesOffice(next: GameState, how: FigureRise, government: string | undefined, to: string, applied: AppliedChange[]): void {
  const role = next.role!;
  const person: Person & { title?: string } = role.person ?? { id: "~player", name: postTitleEn(role), gender: "male" };
  const country = next.countries[next.player];
  const before = leaderOf(next, next.player);
  country.leader = person.name;
  if (government) country.government = government;
  country.rulers = { line: person.name, people: [{ id: person.id, name: person.name, gender: person.gender, ...(person.portrait ? { portrait: person.portrait } : {}) }], lead: 0 };
  if (how === "appointed" && next.officials?.length) {
    // The cabinet stays; the player leaves their post for its chair.
    const chair = next.officials.find((o) => o.post === "government");
    const rest = next.officials.filter((o) => o.post !== "government" && !(role.post && o.post === role.post && samePerson(o.name, person.name)) && !(before && samePerson(o.name, before.name)));
    next.officials = [
      ...rest,
      dressOfficial({ post: "government", title: chair?.title ?? "Head of Government", name: person.name, traits: [], manner: "", competence: 3, loyalty: 5, gender: person.gender, since: to }, yearOf(to)),
    ];
  } else {
    // A new government: its cabinet is named anew, the old one's business ends with it.
    delete next.officials;
    delete next.deputies;
    delete next.deputyAdvice;
    delete next.intrigues;
    delete next.directives;
    if (next.politics) next.politics = { ...next.politics, plots: [] };
  }
  next.role = { kind: "leader", person, since: to, how: "rose" };
  applied.push({ kind: "rise", how: how === "cabinet" ? "cabinet" : how, name: person.name });
}

/** What each ministry may do, for the game master. */
const COMPETENCE: Record<AdvisorId, string> = {
  chief: "the leader's office, the agenda, appointments and the court",
  foreign: "diplomacy and embassies; it negotiates, the leader signs",
  interior: "the police, public order, elections, the press and censorship",
  military: "the general staff: plans, mobilisation and deployments; the leader decides on war",
  intelligence: "spies, agents and covert operations",
  finance: "taxes, the currency, debt and the budget's execution; the budget itself is the government's",
  industry: "factories, resources, production, supply and trade deals",
  science: "laboratories, universities and research",
};

const list = (ns: number[]) => (ns.length ? ns.join(", ") : "none");

/** The prompt's lines on the minister or the general the player is, and the engine's dice on their orders. Nothing for other roles. */
export function describeFigure(state: GameState, orders: string[], approvals: boolean[], coup: boolean): string[] {
  if (!isFigure(state)) return [];
  const role = state.role!;
  const s = standingOf(role);
  const country = en(state.countries[state.player]?.name ?? state.player);
  const leader = leaderOf(state, state.player)?.name ?? state.countries[state.player]?.leader ?? "its leader";
  const who = role.person ? role.person.name : "not named yet (name them in figure.name)";
  const lines: string[] = [];
  if (role.kind === "minister") {
    const ministry = role.post ? ministryOf(role.post) : undefined;
    lines.push(`THE PLAYER IS NOT THE LEADER: the player is ${who}, ${postTitleEn(role)} of ${country} under ${leader}; the ministry's competence: ${ministry ? COMPETENCE[ministry] : "its own field"}. The orders below are the minister's.`);
    lines.push(`THE PLAYER'S STANDING: influence with the leader ${s.influence}/100; the ministry's budget and staff ${s.means}/100; its people's loyalty to the player ${s.loyalty}/100. Dismissal risk ${dismissalRisk(state)}% a month.`);
  } else {
    const front = role.command?.scope === "forces" ? "all its armed forces" : role.command?.name ? `the ${role.command.name}` : "a front (name it in figure.front)";
    lines.push(`THE PLAYER IS NOT THE LEADER: the player is ${who}, a general of ${country} under ${leader}, commanding ${front} – about ${commandTroops(state)} thousand soldiers. The orders below are the general's.`);
    lines.push(`THE PLAYER'S STANDING: influence with the leader ${s.influence}/100; the troops' strength and supply ${s.means}/100; their loyalty to the player ${s.loyalty}/100. Dismissal risk ${dismissalRisk(state)}% a month.`);
  }
  if (orders.length) {
    const yes = approvals.flatMap((ok, i) => (ok ? [i + 1] : []));
    const no = approvals.flatMap((ok, i) => (ok ? [] : [i + 1]));
    lines.push(role.kind === "minister" ? `THE ENGINE'S DICE ON THE ORDERS: the government accepts ${list(yes)}; refuses ${list(no)}.` : `THE ENGINE'S DICE ON THE ORDERS: the high command lets stand ${list(yes)}; overrules ${list(no)}.`);
  }
  if (role.kind === "general") lines.push(`If the player orders a coup this period, it ${coup ? "succeeds" : canCoup(state) ? "fails" : "fails: the troops will not follow"} (the engine's dice).`);
  return lines;
}

/** The rules for a minister or a general (engine/prompts.ts): who the player is and what the orders can do, then what the answer gives. */
export const FIGURE_ROLE = `- THE PLAYER SERVES THE GOVERNMENT, NOT LEADS IT (THE PLAYER IS NOT THE LEADER below). "The player's government" in these rules is the government the player serves, which you play like any other; the orders are the player's own within the post – a minister's within the ministry's competence, a general's for the troops under command. The engine's dice say which of them the government accepts: play an accepted order as the government's; a refused one fails, or is done only as far as the post's own means reach, and the leader may resent it. An order beyond the post (the budget, other ministries, treaties, laws, another command) is refused.`;
export const FIGURE_FIELD = `- In "figure", give what the period did to the player's standing, as changes of a few points: influence (with the leader), means (the post's budget or the troops' strength) and loyalty (of the post's people to the player); "name" (and "front") only while missing. If the player rises this period – the leader names them head of government, or their coup succeeds – say so in "figure.rise" (how: appointed|coup; note). The engine decides whether their standing allows it.`;
export const FIGURE_SHAPE = `"figure": { "name": "string", "gender": "male|female", "front": "string", "influence": 0, "means": 0, "loyalty": 0, "successor": "string", "rise": { "how": "appointed|coup", "government": "string", "note": "string" } } (only what changed; leave "rise" out unless the player rose)`;

/** The ministry's people and the troops a role brings with it into opposition: insiders for a minister, officers for a general. */
export function followingOf(role: PlayerRole): { insiders: number; army: number } {
  const s = standingOf(role);
  if (role.kind === "general") return { insiders: 5, army: round(10 + s.loyalty / 4) };
  if (role.kind === "minister") return { insiders: round(10 + s.influence / 5 + s.loyalty / 10), army: role.post === "military" ? 15 : 0 };
  return { insiders: 0, army: 0 };
}

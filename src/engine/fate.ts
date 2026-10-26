import { yearOf } from "./calendar";
import { happens, roll } from "./dice";
import { STEP_YEARS } from "./economy";
import { chooseHost } from "./exile";
import {
  applyFigureStanding,
  canFigureRise,
  castApprovals,
  castCoup,
  castDismissal,
  describeFigure,
  figureTakesOffice,
  followingOf,
  isFigure,
  startingStanding,
  toppleChance,
  type FigureChange,
} from "./figures";
import { dressOfficial, knownById, leaderOf, personFor, samePerson } from "./people";
import { castRepression, describeRole, goAbroad, openRegime, regimeNow, roleOf, startingMovement } from "./role";
import { FALL_UNREST } from "./unrest";
import type { AppliedChange, DeathCause, Fall, FallHow, GameState, Movement, Person, PlayerRole } from "./types";

/**
 * The person's own fate: resignation, dismissal and death as falls. The
 * player may resign any role between turns, and it happens as the next turn
 * is played; a minister or a general may be dismissed by the leader; anyone
 * may die — of age, of an illness, or by an assassin's hand, rarely, and
 * more likely in danger: a general at the front of a war, an opposition
 * underground, a country in turmoil. All of it is cast by the game's dice
 * before the turn is written, so the story tells what the engine decided.
 * Each fall ends the role with a choice, as a fallen government does: go on
 * with the country's government, or stay with the person — into opposition,
 * the underground or exile — or with a successor where that makes sense.
 */

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** What the game's dice decided for the player's person this turn, before it is written. */
export interface Fate {
  /** A minister's or a general's orders: which the government accepts. */
  approvals: boolean[];
  death?: DeathCause;
  /** The player resigns this turn, as they asked. */
  resigned: boolean;
  /** The resigning minister's cabinet falls with them. */
  topple: boolean;
  dismissed: boolean;
  /** A general's coup would succeed. */
  coup: boolean;
}

const NO_FATE: Fate = { approvals: [], resigned: false, topple: false, dismissed: false, coup: false };

/** The person a role is about: the player's own, or for a leader the one who leads the country now. */
export function playerPerson(state: GameState): (Person & { title?: string }) | undefined {
  const role = roleOf(state);
  return role.kind === "leader" ? (role.person ?? leaderOf(state, state.player)) : role.person;
}

/** A known person's age in a year; unknown for someone the data does not have. */
export function ageOf(person: Pick<Person, "id"> | undefined, year: number): number | undefined {
  const born = person ? knownById(person.id)?.born : undefined;
  return born ? year - born : undefined;
}

/** How old someone the data does not know is taken to be. */
const UNKNOWN_AGE = 55;

/** Deaths by age and illness, % a year, from the person's age: a fortieth of a per cent at 30, about 1% at 70, 6% at 90. */
const ageRisk = (age: number) => 0.04 * Math.exp(0.085 * (age - 30));

/** Assassinations, % a year, where nothing makes them likelier. */
const ASSASSINATION = 0.05;

/** The parts of the person's danger of death this turn, % a year: by age and illness, and by an assassin. */
export function deathRisks(state: GameState): { health: number; assassination: number } {
  const role = roleOf(state);
  const person = playerPerson(state);
  if (!person) return { health: 0, assassination: 0 };
  const year = yearOf(state.date);
  const known = knownById(person.id);
  const age = ageOf(person, year) ?? UNKNOWN_AGE;
  let health = ageRisk(age) * (year < 1950 ? 1.6 : year < 1980 ? 1.2 : 1);
  // History does not kill its people before their time; past it, they live on borrowed years.
  if (known?.died) health *= year >= known.died ? 3 : 0.25;
  let danger = 1;
  const atWar = state.wars.some((w) => w.attackers.includes(state.player) || w.defenders.includes(state.player));
  const unrest = state.politics?.unrest ?? 0;
  if (unrest >= FALL_UNREST) danger *= 2;
  if (role.kind === "leader") danger *= 1 + unrest / 50 + (atWar ? 1 : 0);
  else if (role.kind === "general") danger *= atWar ? (role.command?.scope === "front" ? 6 : 2) : 1;
  else if (role.kind === "minister") danger *= role.post === "interior" || role.post === "intelligence" ? 2 : 1;
  else if (role.kind === "opposition") {
    const m = role.movement;
    const regime = regimeNow(state);
    danger *= m?.kind === "underground" ? 4 : m?.kind === "exile" ? 2 : 1;
    if (m?.status === "banned" || m?.status === "arrested") danger *= 1.5;
    if (!openRegime(regime)) danger *= 2;
  }
  return { health, assassination: ASSASSINATION * danger };
}

/** The person's danger of death, % a year. */
export const deathRisk = (state: GameState): number => {
  const r = deathRisks(state);
  return Math.round(clamp(r.health + r.assassination, 0, 30) * 100) / 100;
};

/** Whether the player's person is waiting on a choice: a fallen government or a fallen person. */
export const awaitingChoice = (state: Pick<GameState, "defeat" | "role">): boolean => Boolean((state.defeat && !state.defeat.continued) || state.role?.fall);

/** Whether the person dies this turn, and of what, by the game's dice. */
function castDeath(state: GameState): DeathCause | undefined {
  const { health, assassination } = deathRisks(state);
  const total = clamp(health + assassination, 0, 30);
  if (total <= 0) return undefined;
  const years = STEP_YEARS[state.step];
  const seed = state.seed ?? state.id;
  if (!happens(1 - (1 - total / 100) ** years, seed, state.turn, "fate:death")) return undefined;
  if (roll(seed, state.turn, "fate:cause") < assassination / total) return "assassination";
  return (ageOf(playerPerson(state), yearOf(state.date)) ?? UNKNOWN_AGE) >= 75 ? "age" : "illness";
}

/**
 * The turn's dice for the player's person, cast before it is written: the
 * government's word on a minister's or a general's orders, a death, the
 * resignation the player asked for and whether it brings the cabinet down,
 * a dismissal, and whether a general's coup would succeed. Nothing while a
 * fall waits on the player's choice.
 */
export function castFate(state: GameState, orders: string[]): Fate {
  if (awaitingChoice(state)) return NO_FATE;
  const role = roleOf(state);
  const figure = isFigure(state);
  const death = castDeath(state);
  const resigned = !death && Boolean(role.resigning);
  return {
    approvals: castApprovals(state, orders),
    ...(death ? { death } : {}),
    resigned,
    topple: resigned && role.kind === "minister" && happens(toppleChance(state), state.seed ?? state.id, state.turn, "topple"),
    dismissed: figure && !death && !resigned && castDismissal(state),
    coup: castCoup(state),
  };
}

/** Whether the turn's answer needs the "figure" field: the player is a minister or a general, or their person falls and someone takes over. */
export const needsFigure = (state: GameState, fate: Fate): boolean => isFigure(state) || Boolean(fate.death || fate.resigned);

const DEATH_LINE: Record<DeathCause, string> = { age: "of old age", illness: "of an illness", assassination: "at an assassin's hand" };

/** The prompt's lines on what the dice decided for the player's person this turn. */
export function describeFate(state: GameState, fate: Fate): string[] {
  const role = roleOf(state);
  const person = playerPerson(state);
  const name = person?.name ?? "the player";
  const successor = "name the successor in figure.successor";
  if (fate.death) {
    const who = role.kind === "leader" ? `the player's leader, ${name},` : role.kind === "opposition" ? `the movement's leader, ${name},` : `the player, ${name},`;
    return [`THE ENGINE'S DICE THIS PERIOD: ${who} dies ${DEATH_LINE[fate.death]} – show it, and ${successor}.`];
  }
  if (fate.resigned) {
    if (role.kind === "leader") return [`THE PLAYER'S LEADER, ${name}, RESIGNS THIS PERIOD, by the player's own decision: show the handover, and ${successor} (and in "leaders").`];
    if (role.kind === "opposition") return [`THE PLAYER, ${name}, STEPS DOWN AS THE MOVEMENT'S LEADER THIS PERIOD: show it, and ${successor}.`];
    if (role.kind === "minister") {
      return [`THE PLAYER, ${name}, RESIGNS THIS PERIOD, by their own decision; by the engine's dice the cabinet ${fate.topple ? "falls with them, and the player is called to form the next government" : `survives without them – ${successor}`}. Show it.`];
    }
    return [`THE PLAYER, ${name}, RESIGNS THE COMMAND THIS PERIOD: show it, and ${successor}.`];
  }
  if (fate.dismissed) return [`THE ENGINE'S DICE THIS PERIOD: the leader dismisses the player, ${name}, from the post – show why, and ${successor}.`];
  return [];
}

/** The prompt's lines on who the player is when they do not govern, and what the dice decided for them and their movement. */
export function describePerson(state: GameState, orders: string[]): string[] {
  const fate = castFate(state, orders);
  const lines = [...describeRole(state, castRepression(state)).filter(Boolean), ...describeFigure(state, orders, fate.approvals, fate.coup), ...describeFate(state, fate)];
  return lines.length ? [...lines, ""] : [];
}

/** The player's minister leaves the cabinet: the post goes to the successor the game master named, or stays empty. In place. */
function vacatePost(next: GameState, role: PlayerRole, successor: string | undefined, to: string): void {
  if (role.kind !== "minister" || !role.post || !next.officials?.length) return;
  const at = next.officials.find((o) => o.post === role.post);
  if (!at || (role.person && !samePerson(at.name, role.person.name))) return;
  const rest = next.officials.filter((o) => o !== at);
  next.officials = successor
    ? [...rest, dressOfficial({ post: at.post, title: at.title, name: successor, traits: [], manner: "", competence: 3, loyalty: 3, since: to }, yearOf(to))]
    : rest;
}

/** The person falls from a role that does not govern: the role waits on the player's choice. In place. */
function fallFrom(next: GameState, how: FallHow, cause: DeathCause | undefined, successor: string | undefined, ctx: { turn: number; to: string }, applied: AppliedChange[]): void {
  const role = next.role!;
  vacatePost(next, role, successor, ctx.to);
  const fall: Fall = { how, from: role.kind, date: ctx.to, turn: ctx.turn, ...(cause ? { cause } : {}), ...(successor ? { successor } : {}) };
  const kept: PlayerRole = { ...role, fall };
  delete kept.resigning;
  next.role = kept;
  applied.push({ kind: "fate", event: how, role: role.kind, name: role.person?.name ?? "", ...(cause ? { cause } : {}) });
}

/** The leader the player plays steps down or dies: the government falls with them, and the player chooses as after any fall. In place. */
function leaderFalls(state: GameState, next: GameState, how: "resigned" | "died", cause: DeathCause | undefined, successor: string | undefined, ctx: { turn: number; to: string }, applied: AppliedChange[]): void {
  const fallen = leaderOf(state, state.player);
  const party = next.politics?.parties.find((p) => p.status === "ruling")?.name;
  // The successor the game master named (or wrote into the leader line this turn), else whoever holds the other top post of the cabinet.
  const line = next.countries[next.player].leader;
  const named = line && line !== state.countries[state.player]?.leader ? line : undefined;
  const heir = successor ?? named ?? next.officials?.find((o) => (o.post === "government" || o.post === "head") && !(fallen && samePerson(o.name, fallen.name)))?.name;
  next.defeat = { date: ctx.to, turn: ctx.turn, how, by: heir ?? "", note: "", ...(fallen ? { fallen } : {}), ...(party ? { party } : {}) };
  if (heir) next.countries[next.player].leader = heir;
  // The fallen leader's seat at the top of the cabinet is empty now.
  if (fallen && next.officials) next.officials = next.officials.filter((o) => !((o.post === "head" || o.post === "government") && samePerson(o.name, fallen.name)));
  if (next.role) {
    const role = { ...next.role };
    delete role.resigning;
    next.role = role;
  }
  applied.push({ kind: "fate", event: how, role: "leader", name: fallen?.name ?? "", ...(cause ? { cause } : {}) });
}

/** Whether the party that governed when the turn began is out of the government at its end: a lost vote, a coalition broken. */
function rulingPartyFell(state: GameState, next: GameState): boolean {
  const ruling = state.politics?.parties.find((p) => p.status === "ruling");
  if (!ruling || !next.politics) return false;
  const after = next.politics.parties.find((p) => p.id === ruling.id);
  return Boolean(after && after.status !== "ruling" && after.status !== "coalition");
}

/**
 * Applies the turn to the player's person, after the government's own fall
 * and the movement's turn: a minister's or a general's standing and the
 * dice on their orders, then a death, a resignation (and a cabinet it
 * topples), a dismissal, or a way up the engine allows. In place.
 */
export function applyFate(state: GameState, next: GameState, change: FigureChange | undefined, fate: Fate, ctx: { turn: number; to: string }, applied: AppliedChange[]): void {
  const before = roleOf(state).kind;
  // A role that changed this turn — a movement that took power, a government overthrown — is past the person's dice.
  if (!next.role || next.role.kind !== before || awaitingChoice(state)) return;
  const successor = change?.successor;
  if (before === "minister" || before === "general") {
    // The government the player served was overthrown by others, or a minister's party lost the government: its people go with it.
    if (applied.some((c) => c.kind === "overthrown") || (before === "minister" && rulingPartyFell(state, next))) return fallFrom(next, "dismissed", undefined, successor, ctx, applied);
    applyFigureStanding(next, change, fate.approvals, ctx, applied);
    if (fate.death) return fallFrom(next, "died", fate.death, successor, ctx, applied);
    if (fate.resigned) {
      if (fate.topple) return figureTakesOffice(next, "cabinet", undefined, ctx.to, applied);
      return fallFrom(next, "resigned", undefined, successor, ctx, applied);
    }
    if (fate.dismissed) return fallFrom(next, "dismissed", undefined, successor, ctx, applied);
    const rise = change?.rise;
    if (rise?.how === "coup") {
      // A coup the dice decided would fail ends in arrest.
      if (fate.coup) figureTakesOffice(next, "coup", rise.government, ctx.to, applied);
      else fallFrom(next, "arrested", undefined, undefined, ctx, applied);
      return;
    }
    if (rise?.how === "appointed" && canFigureRise(next, "appointed")) figureTakesOffice(next, "appointed", rise.government, ctx.to, applied);
    return;
  }
  if (before === "opposition") {
    if (fate.death) fallFrom(next, "died", fate.death, successor, ctx, applied);
    else if (fate.resigned) fallFrom(next, "resigned", undefined, successor, ctx, applied);
    return;
  }
  // The leader: unless the government already fell this turn.
  if (next.defeat && !next.defeat.continued) return;
  if (fate.death) leaderFalls(state, next, "died", fate.death, successor, ctx, applied);
  else if (fate.resigned) leaderFalls(state, next, "resigned", undefined, successor, ctx, applied);
}

/** The player resigns: it happens as the next turn is played. */
export function resign(state: GameState, now = new Date()): GameState {
  if (awaitingChoice(state)) return state;
  return { ...state, role: { ...roleOf(state), resigning: true }, updatedAt: now.toISOString() };
}

/** The player thinks better of it and stays. */
export function withdrawResignation(state: GameState, now = new Date()): GameState {
  if (!state.role?.resigning) return state;
  const role = { ...state.role };
  delete role.resigning;
  return { ...state, role, updatedAt: now.toISOString() };
}

/** What the player can do after the person's fall: go on with the country, take over as a successor, or stay with the person. */
export const FALL_CHOICES = ["country", "successor", "opposition", "underground", "exile"] as const;
export type FallChoice = (typeof FALL_CHOICES)[number];

/**
 * The choices a fall leaves: after a death, the country or the successor;
 * after an opposition leader steps down, the same; a minister or a general
 * who resigned or was dismissed may also lead an opposition of their own
 * (underground where votes do not count, or after a failed coup) or go
 * abroad, where someone would shelter them.
 */
export function fallChoices(state: GameState): FallChoice[] {
  const fall = state.role?.fall;
  if (!fall) return [];
  if (fall.how === "died" || fall.from === "opposition") return ["country", "successor"];
  const open = openRegime(regimeNow(state));
  const own: FallChoice = fall.how === "arrested" || !open ? "underground" : "opposition";
  return ["country", own, ...(fall.how !== "arrested" && chooseHost(state) ? (["exile"] as const) : [])];
}

/** The choices a fallen government leaves the leader the player played: the country, and — unless they died — the person, at home or abroad. */
export function defeatChoices(state: GameState): FallChoice[] {
  const defeat = state.defeat;
  if (!defeat || defeat.continued) return [];
  if (defeat.how === "died") return ["country"];
  const lawful = defeat.how === "election" || defeat.how === "deposed" || defeat.how === "resigned";
  return ["country", lawful ? "opposition" : "underground", ...(chooseHost(state) ? (["exile"] as const) : [])];
}

/** The player's choice after the person's fall, carried out. */
export function afterFall(state: GameState, choice: FallChoice, now = new Date()): GameState {
  const role = state.role;
  const fall = role?.fall;
  if (!role || !fall || !fallChoices(state).includes(choice)) return state;
  const stamp = now.toISOString();
  const year = yearOf(state.date);
  if (choice === "country") return { ...state, role: { kind: "leader", since: state.date, how: "fell" }, updatedAt: stamp };
  if (choice === "successor") {
    const person = fall.successor ? personFor(fall.successor, year) : undefined;
    const next: PlayerRole = { ...role, since: state.date, how: "succeeded" };
    delete next.fall;
    delete next.resigning;
    if (person) next.person = person;
    else delete next.person;
    // A newcomer to the post starts with less of the leader's ear.
    if (role.kind === "minister" || role.kind === "general") {
      const base = startingStanding(role.kind, regimeNow(state), role.post, role.command?.scope);
      next.standing = { ...base, influence: Math.max(0, base.influence - 10) };
    }
    return { ...state, role: next, updatedAt: stamp };
  }
  // With the person: an opposition of their own, made of the people who follow them.
  const base = startingMovement(regimeNow(state));
  const following = followingOf(role);
  const lawful = choice === "opposition";
  const movement: Movement = {
    ...base,
    kind: lawful ? "party" : "underground",
    status: fall.how === "arrested" ? "arrested" : lawful ? "free" : "harassed",
    support: base.support + 3,
    press: Math.min(100, base.press + 5),
    insiders: Math.max(base.insiders, following.insiders),
    army: Math.max(base.army, following.army),
  };
  const next: GameState = { ...state, role: { kind: "opposition", ...(role.person ? { person: role.person } : {}), movement, since: state.date, how: "fell" }, updatedAt: stamp };
  return choice === "exile" ? goAbroad(next, now) : next;
}

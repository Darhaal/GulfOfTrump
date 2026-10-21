import { addYears, lostShares, yearsBetween } from "./abroad";
import { roll } from "./dice";
import { STEP_YEARS } from "./economy";
import { endWar } from "./foreign";
import { countryName } from "./names";
import {
  actorsOf,
  addTension,
  allied,
  alliesOf,
  easeTies,
  enemiesOf,
  freshCourse,
  incidentsFromEvents,
  isMilitary,
  isPact,
  landHolders,
  learnFromTurn,
  newGovernments,
  occupiedBy,
  powers,
  refreshCourses,
  remember,
  tieOf,
  warBetween,
} from "./relations";
import { INTENTIONS, type IntentionSeeds, type PlanSeed } from "./scenarios/intentions";
import { en, same } from "./text";
import type { Aim, Alliance, AppliedChange, GameEvent, GameMode, GameState, Localized, MapRegion, Plan, PlanEnd, PlanKind, PlanStage, Scenario, ScenarioId, War } from "./types";

/**
 * Countries with intentions. Every government that matters keeps plans that
 * take several turns — a war, entering a war under way, founding or joining a
 * bloc, leaving one, seeking peace — and each grows stage by stage: an
 * incident, tension, a secret decision, preparation, and action. A plan can
 * also fade (a compromise) or fail (allies refuse, protests at home, the
 * government falls). The engine moves them by seeded dice from the state
 * before the turn, so the server that writes the prompt and the browser that
 * applies the answer agree, and a reload rolls nothing again. The game
 * master is told the stages reached and tells them; a war or military bloc
 * among other governments comes only from a plan that reached action, and
 * one the answer leaves out the engine carries out itself.
 */

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Live plans at once, besides allies called by a treaty. */
export const MAX_LIVE = 16;
/** Ended plans stay this many turns, for the panel. */
const KEEP_ENDED = 4;
/** Live war plans at once, by era. */
const WAR_PLANS: Record<ScenarioId, number> = { "1914": 6, "1939": 8, "1950": 4, "1964": 4, "1991": 4, "1999": 4, "2014": 4, "2022": 4 };
/** New war plans a year for a government with a motive, before its appetite, reach and means. */
const ERA_WAR: Record<ScenarioId, number> = { "1914": 0.35, "1939": 0.45, "1950": 0.25, "1964": 0.25, "1991": 0.15, "1999": 0.12, "2014": 0.12, "2022": 0.15 };
/** The shortest mobilisation of each era, years. */
const MOBILISE: Record<ScenarioId, number> = { "1914": 0.04, "1939": 0.08, "1950": 0.08, "1964": 0.08, "1991": 0.16, "1999": 0.16, "2014": 0.16, "2022": 0.16 };

/** The stages each kind of plan climbs. */
const LADDER: Record<PlanKind, PlanStage[]> = {
  war: ["incident", "tension", "decision", "preparation", "action"],
  bloc: ["tension", "decision", "preparation", "action"],
  join: ["tension", "decision", "preparation", "action"],
  leave: ["decision", "action"],
  peace: ["decision", "action"],
};

/** The stages a kind of plan climbs, for the panel's step bar. */
export const planLadder = (kind: PlanKind): PlanStage[] => LADDER[kind];

const nextStage = (p: Pick<Plan, "kind" | "stage">): PlanStage => {
  const ladder = LADDER[p.kind];
  const i = ladder.indexOf(p.stage);
  return ladder[Math.min(ladder.length - 1, i + 1)];
};

/** How an end reads: a compromise or a target gone fades a plan, the rest fail it; a plan overtaken by events is simply done. */
const howFor = (why: PlanEnd): "done" | "failed" | "faded" => (why === "carried-out" || why === "overtaken" ? "done" : why === "compromise" || why === "target-gone" ? "faded" : "failed");

/** The stage the world can see: a decision is secret, so a war or bloc plan still shows as tension and the rest not at all. */
export function shownStage(p: Pick<Plan, "kind" | "stage">): PlanStage | null {
  if (p.stage !== "decision") return p.stage;
  return p.kind === "war" || p.kind === "bloc" ? "tension" : null;
}

/** What one plan does in the coming period. */
export interface PlanMove {
  plan: string;
  /** The stages it reaches, in order, with the day each is reached. */
  passed: { stage: PlanStage; date: string }[];
  /** Where it stands at the end of the period. */
  stage: PlanStage;
  /** It ends this period. */
  end?: { how: "done" | "failed" | "faded"; why: PlanEnd; date: string };
  /** Partners that refused to take part when asked, on entering preparation. */
  refused?: string[];
  /** A peace plan at action: whether the enemy agrees; unknown when the enemy is the player, whose orders decide. */
  accepted?: boolean;
  /** The day it reaches action. */
  acts?: string;
}

interface World {
  state: GameState;
  power: Map<string, number>;
  holders: Set<string>;
}

const strength = (w: World, tag: string) => w.power.get(tag) ?? 0;
const hawkOf = (state: GameState, tag: string) => state.countries[tag]?.course?.hawk ?? 50;
const reachOfCourse = (state: GameState, tag: string) => state.countries[tag]?.course?.reach ?? 50;
const stands = (w: World, tag: string | undefined) => Boolean(tag && (w.holders.has(tag) || w.state.countries[tag]?.dormant));

/** Why a government wants a war with another, 0.3–2: its claims and ambitions, the tension, the threat it sees. */
function motive(state: GameState, p: Pick<Plan, "by" | "target" | "cause">): number {
  if (!p.target) return 1;
  const t = tieOf(state, p.by, p.target);
  let m = Math.max(t.tension / 50, t.threat / 60);
  for (const a of state.countries[p.by]?.course?.aims ?? []) {
    if ((a.kind === "reclaim" || a.kind === "expand") && a.target === p.target) m = Math.max(m, a.weight / 50);
    if (a.kind === "protect" && a.target && warBetween(state, a.target, p.target)) m = Math.max(m, a.weight / 50);
  }
  if (p.cause === "seeded" || p.cause === "incident") m = Math.max(m, 1);
  return clamp(m, 0.3, 2);
}

/** Those who would stand by a country: its military allies and the governments that guard it. */
function backers(state: GameState, tag: string): Set<string> {
  const out = alliesOf(state, tag);
  for (const c of Object.values(state.countries)) if (c.course?.aims.some((a) => a.kind === "protect" && a.target === tag)) out.add(c.tag);
  return out;
}

/** The planner's side against the target's, with the allies and guardians each can count on, where the planner's own strength is cut by distance. */
function balance(w: World, by: string, target: string, partners: string[]): number {
  const { state } = w;
  const near = tieOf(state, by, target).near / 100;
  const mine = strength(w, by) + partners.reduce((s, p) => s + strength(w, p), 0);
  const theirs =
    strength(w, target) +
    0.7 * [...backers(state, target)].filter((x) => x !== by && !partners.includes(x) && !allied(state, x, by)).reduce((s, x) => s + strength(w, x), 0);
  return (mine * Math.max(0.3, near)) / Math.max(0.01, theirs);
}

/** How the date history did it bends the dice: slower long before, much faster around it, faster after. */
function dueFactor(due: string | undefined, at: string): number {
  if (!due) return 1;
  const ahead = yearsBetween(at, due);
  if (ahead > 0.25) return 0.4;
  if (ahead > 2 / 52) return 1;
  if (ahead >= -1 / 12) return 6;
  return 3;
}

/** Whether people at home can stop a government: an unpopular one where votes count. */
function homeFront(state: GameState, tag: string): boolean {
  const d = state.countries[tag]?.domestic;
  return Boolean(d && d.support < 30 && (d.regime === "democracy" || d.regime === "limited"));
}

/** The pace of a plan at its stage: the time it must spend there, how fast it climbs and how fast it fades or fails, a year. */
function rates(w: World, p: Plan, at: string): { min: number; advance: number; fade: number; why: PlanEnd } {
  const { state } = w;
  const hawk = hawkOf(state, p.by);
  const h = hawk / 50;
  const reach = reachOfCourse(state, p.by) / 50;
  const due = dueFactor(p.due, at);
  // History holds a plan to its date: it fades half as fast before it, and slower still around and after it.
  const slow = !p.due ? 1 : due >= 3 ? 0.3 : 0.5;
  const era = state.scenarioId;
  const stay = { min: 0, advance: 0, fade: 0, why: "compromise" as PlanEnd };
  switch (p.kind) {
    case "war": {
      if (!p.target) return stay;
      const t = tieOf(state, p.by, p.target);
      const m = motive(state, p);
      const ratio = balance(w, p.by, p.target, p.partners ?? []);
      const f = clamp(ratio - 0.3, 0.1, 1.5);
      const trade = (t.trade ?? 0) / 100;
      const dove = state.countries[p.by]?.domestic?.regime === "democracy" && hawk < 45 ? 1 : 0;
      switch (p.stage) {
        case "incident":
          return { min: 0, advance: 8 * due, fade: (t.tension < 30 ? 3 : 0.5) * slow, why: "compromise" };
        case "tension":
          return { min: 1 / 12, advance: 2 * h * m * f * due, fade: ((1.5 * (1 + 2 * trade + dove)) / Math.max(0.5, m)) * slow, why: "compromise" };
        case "decision": {
          const compromise = 0.4 + (ratio > 2 && alliesOf(state, p.target).size === 0 ? 0.6 : 0) + 2 * trade;
          // A hawkish government misjudges the odds: it sees itself outmatched later than a cautious one.
          const outmatched = ratio < 0.7 * clamp(1 - (hawk - 50) / 100, 0.5, 1.3) ? 2 : 0;
          return { min: 0, advance: 6 * due, fade: (compromise + outmatched) * slow, why: outmatched > compromise ? "outmatched" : "compromise" };
        }
        case "preparation":
          return { min: MOBILISE[era], advance: 4 * reach * Math.sqrt(h) * due, fade: homeFront(state, p.by) ? 2 * slow : 0, why: "unrest" };
        default:
          return stay;
      }
    }
    case "join": {
      const war = state.wars.find((x) => x.id === p.war);
      if (!war || !p.side) return stay;
      const friends = war[p.side];
      const friend = friends.find((x) => allied(state, p.by, x)) ?? friends[0];
      const enemy = p.target ?? war[p.side === "attackers" ? "defenders" : "attackers"][0];
      const trust = friend ? tieOf(state, p.by, friend).trust : 0;
      const near = enemy ? tieOf(state, p.by, enemy).near / 100 : 0.5;
      const busy = enemiesOf(state, p.by).size > 0 ? 0.35 : 0;
      // A government that guards a country on that side has given its word.
      const word = Math.max(0, ...(state.countries[p.by]?.course?.aims ?? []).filter((a) => a.kind === "protect" && a.target && friends.includes(a.target)).map((a) => a.weight / 200));
      const honour = clamp(0.25 + trust / 100 + hawk / 150 + (p.cause === "treaty" ? 0.25 : 0) + word - busy - (1 - near) * 0.3 + (reachOfCourse(state, p.by) - 50) / 200, 0.05, 0.95);
      switch (p.stage) {
        case "tension":
          return { min: 0, advance: 3 * h * due, fade: 2 * slow, why: "compromise" };
        case "decision":
          return { min: 0, advance: 12 * honour * due, fade: 12 * (1 - honour) * slow, why: "refused" };
        case "preparation":
          return { min: MOBILISE[era] / 2, advance: 8 * reach * due, fade: homeFront(state, p.by) ? 2 * slow : 0, why: "unrest" };
        default:
          return stay;
      }
    }
    case "leave":
      return p.stage === "decision" ? { min: 0, advance: 4 * due, fade: 2 * slow, why: "compromise" } : stay;
    case "peace":
      return p.stage === "decision" ? { min: 0, advance: 8 * (1 - hawk / 100) * due, fade: slow, why: "government" } : stay;
    case "bloc": {
      const threat = p.target ? tieOf(state, p.by, p.target).threat : 50;
      switch (p.stage) {
        case "tension":
          return { min: 1 / 12, advance: ((3 * threat) / 50) * due, fade: (threat < 40 ? 2 : 1) * slow, why: "compromise" };
        case "decision":
          return { min: 0, advance: 4 * due, fade: 0.5 * slow, why: "compromise" };
        case "preparation":
          return { min: 1 / 12, advance: 6 * due, fade: 0, why: "refused" };
        default:
          return stay;
      }
    }
  }
}

/** Whether a partner agrees to take part when the plan is prepared: by its trust in the planner, its appetite and its own quarrel. */
function partnerChance(w: World, p: Plan, partner: string): number {
  const { state } = w;
  const trust = tieOf(state, partner, p.by).trust;
  // A plan of the start date's history comes with the pledges that were given (Berlin's blank cheque to Vienna).
  const pledged = p.cause === "seeded" ? 0.2 : 0;
  if (p.kind === "war") {
    const tension = p.target ? tieOf(state, partner, p.target).tension : 0;
    const bound = p.target && allied(state, partner, p.target) ? 1 : 0;
    return clamp(0.3 + pledged + trust / 100 + (hawkOf(state, partner) - 50) / 100 + tension / 200 - bound, 0.05, 0.95);
  }
  const threat = p.target ? tieOf(state, partner, p.target).threat : 30;
  const bound = p.target && allied(state, partner, p.target) ? 1 : 0;
  return clamp(0.2 + pledged + trust / 100 + threat / 100 - bound + (reachOfCourse(state, partner) - 50) / 200, 0.05, 0.95);
}

/** Whether the enemy agrees to make peace: a dove, a beaten side, an inward-looking government, or one that seeks peace itself. */
function peaceChance(state: GameState, p: Plan, lost: Map<string, number>): number | undefined {
  const enemy = p.target;
  if (!enemy || enemy === state.player) return undefined;
  const own = (state.plans ?? []).some((x) => !x.end && x.kind === "peace" && x.by === enemy && x.war === p.war);
  return clamp(0.25 + (1 - hawkOf(state, enemy) / 100) * 0.4 + (lost.get(enemy) ?? 0) + (reachOfCourse(state, enemy) < 35 ? 0.2 : 0) + (own ? 0.4 : 0), 0.05, 0.95);
}

/** A plan overtaken or made pointless by the state of the world before it moves. */
function settle(w: World, p: Plan): PlanEnd | null {
  const { state } = w;
  if (!stands(w, p.by) || p.by === state.player) return "overtaken";
  switch (p.kind) {
    case "war":
      if (!p.target || !stands(w, p.target)) return "target-gone";
      if (warBetween(state, p.by, p.target)) return "overtaken";
      if (allied(state, p.by, p.target)) return "compromise";
      return null;
    case "join": {
      const war = state.wars.find((x) => x.id === p.war);
      if (!war) return "target-gone";
      if (war.attackers.includes(p.by) || war.defenders.includes(p.by)) return "overtaken";
      return null;
    }
    case "peace": {
      const war = state.wars.find((x) => x.id === p.war);
      return !war || !(war.attackers.includes(p.by) || war.defenders.includes(p.by)) ? "overtaken" : null;
    }
    case "leave": {
      const bloc = state.alliances.find((a) => a.id === p.bloc);
      return !bloc || !bloc.members.includes(p.by) ? "overtaken" : null;
    }
    case "bloc": {
      if (p.bloc) {
        const bloc = state.alliances.find((a) => a.id === p.bloc);
        if (!bloc) return "target-gone";
        return bloc.members.includes(p.by) ? "overtaken" : null;
      }
      const partners = (p.partners ?? []).filter((x) => stands(w, x));
      if (!partners.length) return "target-gone";
      return partners.every((x) => allied(state, p.by, x)) ? "overtaken" : null;
    }
  }
}

/** One plan through the period, in steps of about a week. */
function walk(w: World, plan: Plan, steps: number, dt: number, lost: Map<string, number>): PlanMove {
  const { state } = w;
  const p: Plan = { ...plan, ...(plan.partners ? { partners: [...plan.partners] } : {}) };
  const move: PlanMove = { plan: p.id, passed: [], stage: p.stage };
  const settled = settle(w, p);
  if (settled) return { ...move, end: { how: howFor(settled), why: settled, date: state.date } };
  const reachAction = (date: string) => {
    move.acts = date;
    if (p.kind !== "peace") return;
    const chance = peaceChance(state, p, lost);
    if (chance === undefined) return;
    move.accepted = roll(state.seed ?? state.id, state.turn, `peace:${p.id}`) < chance;
    if (!move.accepted) move.end = { how: "failed", why: "refused", date };
  };
  if (p.stage === "action") reachAction(state.date);
  let moved = p.moved;
  for (let k = 0; k < steps && p.stage !== "action" && !move.end; k++) {
    const start = addYears(state.date, k * dt);
    const end = addYears(state.date, (k + 1) * dt);
    const r = rates(w, p, start);
    if (yearsBetween(moved, end) < r.min) continue;
    const fades = 1 - Math.exp(-Math.max(0, r.fade) * dt);
    const climbs = 1 - Math.exp(-Math.max(0, r.advance) * dt);
    const x = roll(state.seed ?? state.id, state.turn, `plan:${p.id}:${k}`);
    if (x < fades) {
      move.end = { how: howFor(r.why), why: r.why, date: end };
      break;
    }
    if (x >= fades + climbs) continue;
    p.stage = nextStage(p);
    moved = end;
    move.passed.push({ stage: p.stage, date: end });
    // Partners are asked once the plan is prepared: those that refuse drop out, and a plan that needed them fails.
    if (p.stage === "preparation" && (p.kind === "war" || (p.kind === "bloc" && !p.bloc)) && p.partners?.length) {
      const refused = p.partners.filter((x) => x === state.player || roll(state.seed ?? state.id, state.turn, `partner:${p.id}:${x}`) >= partnerChance(w, p, x));
      if (refused.length) {
        move.refused = refused;
        p.partners = p.partners.filter((x) => !refused.includes(x));
        const alone = p.kind === "bloc" ? !p.partners.length : !p.partners.length && p.target !== undefined && balance(w, p.by, p.target, []) < 0.8;
        if (alone) move.end = { how: "failed", why: "refused", date: end };
      }
    }
    if (p.stage === "action") reachAction(end);
  }
  move.stage = p.stage;
  return move;
}

/**
 * The dice for every live plan in the coming period, cast from the state
 * before it. The same state casts the same dice, on the server that writes
 * the prompt and checks the answer and in the browser that applies it.
 */
export function castPlans(state: GameState): PlanMove[] {
  const live = (state.plans ?? []).filter((p) => !p.end);
  if (!live.length) return [];
  const holders = landHolders(state);
  const w: World = { state, power: powers(state, holders), holders };
  const years = STEP_YEARS[state.step];
  const steps = Math.max(1, Math.round(years * 52));
  const lost = lostShares(state);
  return live.map((p) => walk(w, p, steps, years / steps, lost));
}

/** The plans that reach action this period, as they will act: partners that refused left out, a refused peace not among them. */
function acting(state: GameState, moves: PlanMove[]): Plan[] {
  const out: Plan[] = [];
  for (const m of moves) {
    if (m.stage !== "action" || m.end) continue;
    const p = state.plans?.find((x) => x.id === m.plan);
    if (p) out.push({ ...p, stage: "action", partners: (p.partners ?? []).filter((x) => !m.refused?.includes(x)) });
  }
  return out;
}

/** Whether a government agreed with the player this turn: in a diplomatic answer, or at a meeting the player held. */
export function agreedWithPlayer(state: GameState, tag: string): boolean {
  return (
    (state.diplomacy[tag] ?? []).some((m) => m.turn === state.turn && m.from === "them" && m.stance === "agree") ||
    (state.summits ?? []).some((s) => s.live && s.heldTurn === state.turn && s.participants.includes(tag) && (s.agreements?.length ?? 0) > 0)
  );
}

/** What the plans allow in a turn's answer (used by sanitizeOutcome). */
export interface PlanGate {
  /** A war's sides as the plans allow them, or null when nothing prepared it. */
  war(w: { attackers: string[]; defenders: string[] }): { attackers: string[]; defenders: string[] } | null;
  join(country: string, war: War, side: "attackers" | "defenders"): boolean;
  /** A bloc's members as the plans allow them, or null. */
  bloc(members: string[], kind: string): string[] | null;
  accession(country: string, bloc: Alliance): boolean;
}

/**
 * The check on wars and military blocs. The player's government decides its
 * own; a country born this turn or without land (a secession) is free; any
 * other comes only from a plan that reaches action this period, and a
 * government that agreed with the player this turn may join the player.
 */
export function planGate(state: GameState, isNew: (tag: string) => boolean, moves = castPlans(state)): PlanGate {
  const acts = acting(state, moves);
  const player = state.player;
  const free = (tag: string) => isNew(tag) || Boolean(state.countries[tag]?.dormant);
  return {
    war(w) {
      if (w.attackers.includes(player) || [...w.attackers, ...w.defenders].some(free)) return w;
      const plans = acts.filter((p) => p.kind === "war" && p.target && w.attackers.includes(p.by) && w.defenders.includes(p.target));
      if (!plans.length) return null;
      return {
        attackers: w.attackers.filter((a) => plans.some((p) => p.by === a || p.partners?.includes(a))),
        defenders: w.defenders.filter((d) => plans.some((p) => p.target === d)),
      };
    },
    join(country, war, side) {
      if (country === player || free(country)) return true;
      if (acts.some((p) => p.kind === "join" && p.by === country && p.war === war.id && p.side === side)) return true;
      const other = war[side === "attackers" ? "defenders" : "attackers"];
      if (acts.some((p) => p.kind === "war" && p.by === country && p.target && other.includes(p.target))) return true;
      return war[side].includes(player) && agreedWithPlayer(state, country);
    },
    bloc(members, kind) {
      if ((kind !== "alliance" && kind !== "pact") || members.includes(player)) return members;
      const plan = acts.find((p) => p.kind === "bloc" && !p.bloc && members.includes(p.by) && p.partners?.some((x) => members.includes(x)));
      if (!plan) return null;
      const kept = members.filter((m) => m === plan.by || plan.partners?.includes(m));
      return kept.length >= 2 ? kept : null;
    },
    accession(country, bloc) {
      if (!(isMilitary(bloc) || isPact(bloc)) || country === player) return true;
      if (bloc.members.includes(player) && agreedWithPlayer(state, country)) return true;
      return acts.some((p) => p.kind === "bloc" && p.by === country && p.bloc === bloc.id);
    },
  };
}

/** A country's name in each language. */
function names(state: GameState, tag: string): Localized {
  const n = state.countries[tag]?.name;
  if (n && typeof n !== "string") return n;
  return countryName(tag) ?? same(n ?? tag);
}

/**
 * The name the engine gives a war the game master did not name. Russian and
 * Ukrainian take the bare pair, which reads right after "Война:" or "Мир:"
 * and needs no grammatical case.
 */
export function warName(state: GameState, a: string, b: string): Localized {
  const x = names(state, a);
  const y = names(state, b);
  return { en: `${x.en}–${y.en} War`, ru: `${x.ru} — ${y.ru}`, uk: `${x.uk} — ${y.uk}` };
}

/** The name the engine gives a bloc the game master did not name, the same way. */
export function blocName(state: GameState, kind: "alliance" | "pact", members: string[]): Localized {
  const list = members.map((m) => names(state, m));
  const join = (l: keyof Localized, by: string) => list.map((x) => x[l]).join(by);
  return { en: `${join("en", "–")} ${kind === "alliance" ? "Alliance" : "Pact"}`, ru: join("ru", " — "), uk: join("uk", " — ") };
}

const change = (p: Plan, stage: PlanStage): AppliedChange => ({ kind: "plan", plan: p.id, type: p.kind, by: p.by, ...(p.target ? { target: p.target } : {}), stage });

/** A plan ends: kept a few turns for the panel; a failure or a fade is news, and an ally that stood aside is remembered. */
function endPlan(next: GameState, p: Plan, end: { how: "done" | "failed" | "faded"; why: PlanEnd; date: string }, turn: number, applied: AppliedChange[]): void {
  p.end = { date: end.date, turn, how: end.how, why: end.why };
  if (end.how === "done") return;
  applied.push({ kind: "plan-end", plan: p.id, type: p.kind, by: p.by, ...(p.target ? { target: p.target } : {}), how: end.how, why: end.why });
  if (p.kind === "join" && end.why === "refused" && p.cause === "treaty" && p.side) {
    const war = next.wars.find((x) => x.id === p.war);
    for (const m of war?.[p.side] ?? []) if (allied(next, m, p.by) || next.countries[p.by]?.course?.aims.some((a) => a.kind === "protect" && a.target === m)) remember(next, m, p.by, "stood-aside", -25, end.date);
  }
}

/** Carries out one plan at action: what the answer already did counts; what it left out the engine does. Returns why it ended. */
function carryOut(next: GameState, p: Plan, move: PlanMove, ctx: { turn: number; from: string }, made: () => number, applied: AppliedChange[]): PlanEnd {
  const when = move.acts ?? ctx.from;
  const mark = (kind: "war" | "enter" | "alliance" | "accession", key: string, country?: string) => {
    for (const c of applied) {
      if (c.kind === "war" && kind === "war" && c.war === key) c.plan = p.id;
      if (c.kind === "enter" && kind === "enter" && c.war === key && c.country === country) c.plan = p.id;
      if (c.kind === "alliance" && kind === "alliance" && c.alliance === key) c.plan = p.id;
      if (c.kind === "accession" && kind === "accession" && c.alliance === key && c.country === country) c.plan = p.id;
    }
  };
  switch (p.kind) {
    case "war": {
      if (!p.target || !next.countries[p.target]) return "target-gone";
      const war = warBetween(next, p.by, p.target);
      if (war) {
        p.war = war.id;
        mark("war", war.id);
        return "carried-out";
      }
      const attackers = [p.by, ...(p.partners ?? []).filter((x) => next.countries[x] && x !== next.player && x !== p.target && !warBetween(next, x, p.by))];
      const created: War = { id: `w${ctx.turn}-p${made()}`, name: warName(next, p.by, p.target), attackers, defenders: [p.target], since: when };
      next.wars.push(created);
      p.war = created.id;
      applied.push({ kind: "war", war: created.id, name: created.name, sides: [...attackers, p.target], plan: p.id });
      return "carried-out";
    }
    case "join": {
      const war = next.wars.find((x) => x.id === p.war);
      if (!war || !p.side) return "target-gone";
      if (war.attackers.includes(p.by) || war.defenders.includes(p.by)) {
        mark("enter", war.id, p.by);
        return "carried-out";
      }
      war[p.side].push(p.by);
      applied.push({ kind: "enter", war: war.id, name: war.name, country: p.by, side: p.side, plan: p.id });
      return "carried-out";
    }
    case "bloc": {
      if (p.bloc) {
        const bloc = next.alliances.find((a) => a.id === p.bloc);
        if (!bloc) return "target-gone";
        if (!bloc.members.includes(p.by)) {
          bloc.members.push(p.by);
          applied.push({ kind: "accession", alliance: bloc.id, name: bloc.name, country: p.by, plan: p.id });
        } else mark("accession", bloc.id, p.by);
        return "carried-out";
      }
      const formed = next.alliances.find((a) => a.id.startsWith(`a${ctx.turn}-`) && a.members.includes(p.by) && p.partners?.some((x) => a.members.includes(x)));
      if (formed) {
        p.bloc = formed.id;
        mark("alliance", formed.id);
        return "carried-out";
      }
      const members = [p.by, ...(p.partners ?? []).filter((x) => next.countries[x] && x !== next.player)];
      if (members.length < 2) return "refused";
      const kind = p.blocKind ?? "alliance";
      const bloc: Alliance = { id: `a${ctx.turn}-p${made()}`, name: blocName(next, kind, members), members, since: when, ...(kind !== "alliance" ? { kind } : {}), founder: p.by };
      next.alliances.push(bloc);
      p.bloc = bloc.id;
      applied.push({ kind: "alliance", alliance: bloc.id, name: bloc.name, members: [...members], plan: p.id });
      return "carried-out";
    }
    case "leave": {
      const bloc = next.alliances.find((a) => a.id === p.bloc);
      if (!bloc || !bloc.members.includes(p.by)) return "carried-out";
      const before = [...bloc.members];
      bloc.members = bloc.members.filter((m) => m !== p.by);
      applied.push({ kind: "leave", alliance: bloc.id, name: bloc.name, country: p.by });
      if (bloc.members.length < 2) {
        applied.push({ kind: "alliance-ended", alliance: bloc.id, name: bloc.name, members: before });
        next.alliances = next.alliances.filter((a) => a.id !== bloc.id);
      }
      return "carried-out";
    }
    case "peace": {
      const war = next.wars.find((x) => x.id === p.war);
      if (!war) return "carried-out";
      // Peace with the player's government is the player's to make.
      if (move.accepted !== true) return "refused";
      endWar(next, war, applied);
      return "carried-out";
    }
  }
}

/**
 * The plans move as the dice decided before the turn: stages reached (a
 * rival's mobilisation alarms its target), plans that fade or fail, and
 * those at action carried out — matched with what the answer did, or done
 * by the engine where the answer left them out. Runs after the answer's
 * wars and blocs.
 */
export function carryOutPlans(next: GameState, moves: PlanMove[], ctx: { turn: number; from: string }, applied: AppliedChange[]): void {
  const plans = next.plans ?? [];
  let made = 0;
  for (const move of moves) {
    const p = plans.find((x) => x.id === move.plan);
    if (!p || p.end) continue;
    for (const s of move.passed) {
      p.stage = s.stage;
      p.moved = s.date;
      if (s.stage === "preparation" && p.target) addTension(next, p.target, p.by, 25);
      if (s.stage !== "action" && shownStage(p) === s.stage && s.stage !== "incident") applied.push(change(p, s.stage));
    }
    if (move.refused?.length) {
      for (const x of move.refused) if (allied(next, p.by, x)) remember(next, p.by, x, "stood-aside", -15, move.passed.at(-1)?.date ?? ctx.from);
      p.partners = (p.partners ?? []).filter((x) => !move.refused!.includes(x));
    }
    if (move.end) {
      endPlan(next, p, move.end, ctx.turn, applied);
      continue;
    }
    if (p.stage !== "action") continue;
    const why = carryOut(next, p, move, ctx, () => (made += 1), applied);
    endPlan(next, p, { how: howFor(why), why, date: move.acts ?? ctx.from }, ctx.turn, applied);
  }
}

/** The seeded aims and appetite of a country on its date. */
function seededFor(state: GameState, seeds: IntentionSeeds, tag: string): { aims: Aim[]; hawk?: number; trust?: [string, number][] } {
  const aims = (seeds.aims[tag] ?? []).filter(([, target]) => target !== tag && state.countries[target]).map(([kind, target, weight]) => ({ kind, target, weight, seeded: true }));
  return { aims, ...(seeds.hawk?.[tag] !== undefined ? { hawk: seeds.hawk[tag] } : {}), ...(seeds.trust?.[tag] ? { trust: seeds.trust[tag] } : {}) };
}

/** A seeded plan as it enters play, if its countries still stand and it still makes sense; never one of the player's. */
function fromSeed(state: GameState, seed: PlanSeed, date: string, holders: Set<string>): Plan | null {
  const up = (tag: string | undefined) => Boolean(tag && state.countries[tag] && (holders.has(tag) || state.countries[tag].dormant));
  if (!up(seed.by) || seed.by === state.player) return null;
  if (seed.target && !up(seed.target)) return null;
  const partners = (seed.partners ?? []).filter((x) => up(x) && x !== state.player && x !== seed.by);
  switch (seed.kind) {
    case "war":
      if (!seed.target || warBetween(state, seed.by, seed.target) || allied(state, seed.by, seed.target)) return null;
      break;
    case "join": {
      const war = state.wars.find((w) => w.id === seed.war);
      if (!war || !seed.side || war.attackers.includes(seed.by) || war.defenders.includes(seed.by)) return null;
      break;
    }
    case "peace": {
      const war = state.wars.find((w) => w.id === seed.war);
      if (!war || !(war.attackers.includes(seed.by) || war.defenders.includes(seed.by))) return null;
      break;
    }
    case "leave": {
      const bloc = state.alliances.find((a) => a.id === seed.bloc);
      if (!bloc || !bloc.members.includes(seed.by)) return null;
      break;
    }
    case "bloc":
      if (seed.bloc) {
        const bloc = state.alliances.find((a) => a.id === seed.bloc);
        if (!bloc || bloc.members.includes(seed.by)) return null;
      } else if (!partners.length || partners.every((x) => allied(state, seed.by, x))) return null;
      break;
  }
  return {
    id: `seed-${seed.id}`,
    kind: seed.kind,
    by: seed.by,
    ...(seed.target ? { target: seed.target } : {}),
    ...(partners.length ? { partners } : {}),
    ...(seed.war ? { war: seed.war } : {}),
    ...(seed.bloc ? { bloc: seed.bloc } : {}),
    ...(seed.side ? { side: seed.side } : {}),
    ...(seed.blocKind ? { blocKind: seed.blocKind } : {}),
    cause: "seeded",
    stage: seed.stage,
    since: date,
    moved: date,
    ...(seed.due ? { due: seed.due } : {}),
  };
}

/** Courses for the countries that matter and have none yet: a new great power, a country at war, a planner. */
function ensureCourses(state: GameState, power: Map<string, number>): boolean {
  const seeds = INTENTIONS[state.scenarioId];
  let added = false;
  let occupied: ReturnType<typeof occupiedBy> | undefined;
  for (const tag of [...actorsOf(state, power)].sort()) {
    const c = state.countries[tag];
    if (!c || c.course || tag === state.player) continue;
    c.course = freshCourse(state, tag, seededFor(state, seeds, tag), state.date, (occupied ??= occupiedBy(state)));
    added = true;
  }
  return added;
}

/**
 * Foreign courses for the countries that matter, and the date's plans under
 * way, for a new game or a save from before them. Plans come only to a save
 * that has none, and a played save gets only those whose date is still to
 * come. With the map, each course looks at the world at once.
 */
export function seedIntentions<T extends GameState>(state: T, scenario: Pick<Scenario, "id">, opts: { map?: Record<string, MapRegion> | null; mode?: GameMode } = {}): T {
  const needsPlans = state.plans === undefined;
  const holders = landHolders(state);
  const power = powers(state, holders);
  const missing = [...actorsOf(state, power)].some((tag) => tag !== state.player && state.countries[tag] && !state.countries[tag].course);
  if (!needsPlans && !missing && !opts.map && (!opts.mode || state.mode === opts.mode)) return state;
  const next = structuredClone(state);
  if (opts.mode) next.mode = opts.mode;
  if (needsPlans) {
    const seeds = INTENTIONS[scenario.id];
    next.plans = seeds.live
      .filter((s) => !(next.chronicle.length && s.due && s.due <= next.date))
      .map((s) => fromSeed(next, s, next.date, holders))
      .filter((p): p is Plan => Boolean(p));
  }
  const added = ensureCourses(next, power);
  if (added || opts.map) refreshCourses(next, opts.map ?? null, power);
  return next;
}

interface OpenContext {
  turn: number;
  from: string;
  to: string;
  years: number;
  power: Map<string, number>;
  holders: Set<string>;
  /** Pairs of countries the game master's events set against each other: "a|b" → tension raised. */
  raised: Map<string, number>;
  /** Countries with a new government this turn. */
  changed: string[];
  /** Each country's share of its people under others' rule, 0–1. */
  lost: Map<string, number>;
}

/**
 * New plans at the end of a turn, and old ones judged again: a new
 * government drops plans it has no appetite for and may seek peace or leave
 * a bloc; allies are called to a war by their treaties; history's dated
 * plans enter in the historical mode; a country the player provoked can
 * strike back next turn; and governments with a motive and the means open
 * plans of war, peace, leaving and alliance by the dice.
 */
function openPlans(before: GameState, next: GameState, ctx: OpenContext, applied: AppliedChange[]): void {
  const plans = (next.plans ??= []);
  const era = next.scenarioId;
  const player = next.player;
  const mode = next.mode === "historical" ? 0.5 : 1;
  const chance = (rate: number) => 1 - Math.exp(-Math.max(0, rate) * ctx.years);
  // A copy of a game keeps the game's dice (lib/saves.ts duplicateSave).
  const dice = (key: string) => roll(next.seed ?? next.id, ctx.turn, key);
  const live = () => plans.filter((p) => !p.end);
  const busy = (by: string, kind: PlanKind) => live().some((p) => p.by === by && p.kind === kind);
  const room = () => live().filter((p) => p.cause !== "treaty").length < MAX_LIVE;
  const course = (tag: string) => (tag === player ? undefined : next.countries[tag]?.course);
  const open = (fields: Omit<Plan, "id" | "since" | "moved">, id?: string): Plan => {
    const plan: Plan = { id: id ?? `p${ctx.turn}-${plans.filter((p) => p.id.startsWith(`p${ctx.turn}-`)).length + 1}`, ...fields, since: ctx.to, moved: ctx.to };
    plans.push(plan);
    const shown = shownStage(plan);
    if (shown && shown !== "action") applied.push(change(plan, shown));
    return plan;
  };
  const lost = ctx.lost;
  const actors = [...actorsOf(next, ctx.power)].filter((t) => course(t)).sort();
  /** A side's principal: its strongest member, whose peace ends the war. */
  const principal = (side: string[]) => [...side].sort((a, b) => (ctx.power.get(b) ?? 0) - (ctx.power.get(a) ?? 0) || a.localeCompare(b))[0];

  // A new government judges the plans it inherited.
  for (const tag of ctx.changed) {
    const c = course(tag);
    if (!c) continue;
    for (const p of live().filter((x) => x.by === tag)) {
      const keep = p.kind === "war" ? c.hawk / 100 : p.kind === "join" ? 0.3 + (c.hawk / 100) * 0.6 : 0.6;
      if (dice(`rejudge:${p.id}`) >= keep) endPlan(next, p, { how: "failed", why: "government", date: ctx.to }, ctx.turn, applied);
    }
    const war = next.wars.find((w) => principal(w.attackers) === tag || principal(w.defenders) === tag);
    if (war && c.hawk < 40 && !busy(tag, "peace")) {
      const enemy = principal(war.attackers) === tag ? principal(war.defenders) : principal(war.attackers);
      if (enemy) open({ kind: "peace", by: tag, target: enemy, war: war.id, cause: "new-government", stage: "decision" });
    }
    for (const bloc of next.alliances.filter((a) => isMilitary(a) && a.members.includes(tag))) {
      const lead = bloc.members.filter((m) => m !== tag).sort((a, b) => (ctx.power.get(b) ?? 0) - (ctx.power.get(a) ?? 0))[0];
      if (lead && tieOf(next, tag, lead).trust < -20 && !busy(tag, "leave")) open({ kind: "leave", by: tag, bloc: bloc.id, cause: "new-government", stage: "decision" });
    }
  }

  // Allies are called to a war by their treaties: those of a country attacked, of one that enters it, and of
  // every country that now faces a new enemy; the attacker's allies only by opportunity.
  for (const c of applied.slice()) {
    if (c.kind !== "war" && c.kind !== "enter") continue;
    const war = next.wars.find((w) => w.id === c.war);
    if (!war) continue;
    const inWar = (t: string) => war.attackers.includes(t) || war.defenders.includes(t);
    const call = (g: string, side: "attackers" | "defenders", cause: "treaty" | "opportunity") => {
      // Asked once: a government already weighing this war, or that lately refused it, is not asked again.
      if (!course(g) || inWar(g) || plans.some((p) => p.kind === "join" && p.by === g && p.war === war.id)) return;
      if (war[side === "attackers" ? "defenders" : "attackers"].some((e) => allied(next, g, e))) return;
      const enemy = principal(war[side === "attackers" ? "defenders" : "attackers"]);
      open({ kind: "join", by: g, war: war.id, side, ...(enemy ? { target: enemy } : {}), cause, stage: cause === "treaty" ? "decision" : "tension" });
    };
    const guardians = (m: string) => {
      const out = new Set(alliesOf(next, m));
      for (const x of Object.values(next.countries)) if (x.course?.aims.some((a) => a.kind === "protect" && a.target === m)) out.add(x.tag);
      return [...out].sort();
    };
    if (c.kind === "enter") {
      const other = c.side === "attackers" ? "defenders" : "attackers";
      for (const g of [...alliesOf(next, c.country)].sort()) call(g, c.side, "treaty");
      for (const m of war[other]) for (const g of guardians(m)) call(g, other, "treaty");
      continue;
    }
    for (const m of war.defenders) for (const g of guardians(m)) call(g, "defenders", "treaty");
    for (const a of war.attackers) {
      for (const g of [...alliesOf(next, a)].sort()) {
        const gc = course(g);
        if (!gc || gc.hawk < 55 || tieOf(next, g, war.defenders[0]).tension < 40) continue;
        if (room() && dice(`open:join:${g}:${war.id}`) < 0.5) call(g, "attackers", "opportunity");
      }
    }
  }

  // History's dated plans, in the historical mode.
  if (next.mode === "historical") {
    for (const seed of INTENTIONS[era].dated) {
      if (!seed.opens || seed.opens <= ctx.from || seed.opens > ctx.to || plans.some((p) => p.id === `seed-${seed.id}`)) continue;
      const plan = fromSeed(next, seed, ctx.to, ctx.holders);
      if (plan) {
        plans.push(plan);
        const shown = shownStage(plan);
        if (shown && shown !== "action") applied.push(change(plan, shown));
      }
    }
  }

  // The player's provocations: a country can answer them with a war decided now and fought next turn at the earliest.
  const provoked = new Map<string, number>();
  const add = (tag: string, n: number) => provoked.set(tag, (provoked.get(tag) ?? 0) + n);
  for (const c of applied) {
    if ((c.kind === "occupy" || c.kind === "annex") && c.to === player && c.from !== player && !warBetween(before, c.from, player) && !warBetween(next, c.from, player)) add(c.from, 40);
    if (c.kind === "sanction" && c.by === player && c.change !== "lifted") add(c.against, c.change === "full" ? 25 : 15);
  }
  for (const [key, n] of ctx.raised) {
    const [a, b] = key.split("|");
    if (a === player) add(b, n);
    if (b === player) add(a, n);
  }
  for (const [tag, sum] of [...provoked].sort((a, b) => a[0].localeCompare(b[0]))) {
    const c = course(tag);
    if (!c || sum < 25 || warBetween(next, tag, player) || live().some((p) => p.kind === "war" && p.by === tag && p.target === player)) continue;
    const w: World = { state: next, power: ctx.power, holders: ctx.holders };
    if (balance(w, tag, player, []) < 0.3) continue;
    if (dice(`provoked:${tag}`) < clamp((sum / 50) * (c.hawk / 50), 0, 0.9)) open({ kind: "war", by: tag, target: player, cause: "incident", stage: "decision" });
  }

  // War-weary principals seek peace.
  for (const war of next.wars) {
    for (const [tag, enemy] of [
      [principal(war.attackers), principal(war.defenders)],
      [principal(war.defenders), principal(war.attackers)],
    ]) {
      const c = tag ? course(tag) : undefined;
      if (!c || !enemy || busy(tag, "peace") || yearsBetween(war.since, ctx.to) < 0.5) continue;
      const years = yearsBetween(war.since, ctx.to);
      // Any government tires of a war that drags on past four years.
      const weary = c.reach < 30 || (lost.get(tag) ?? 0) >= 0.25 || (years >= 3 && c.hawk < 50) || years >= 4;
      if (weary && dice(`open:peace:${tag}:${war.id}`) < chance(years >= 4 && c.reach >= 30 ? 1 : 2)) open({ kind: "peace", by: tag, target: enemy, war: war.id, cause: "weariness", stage: "decision" });
    }
  }

  // A government betrayed by its bloc's leader thinks of leaving it.
  for (const tag of actors) {
    if (busy(tag, "leave")) continue;
    for (const bloc of next.alliances.filter((a) => (isMilitary(a) || isPact(a)) && a.members.includes(tag))) {
      const lead = bloc.members.filter((m) => m !== tag).sort((a, b) => (ctx.power.get(b) ?? 0) - (ctx.power.get(a) ?? 0))[0];
      if (!lead || tieOf(next, tag, lead).trust > -50) continue;
      if (dice(`open:leave:${tag}:${bloc.id}`) < chance(1)) {
        open({ kind: "leave", by: tag, bloc: bloc.id, cause: "incident", stage: "decision" });
        break;
      }
    }
  }

  // Wars: a claim, an ambition, or tension past bearing, weighed by appetite, reach and means.
  const w: World = { state: next, power: ctx.power, holders: ctx.holders };
  for (const tag of actors) {
    const c = course(tag)!;
    const wars = live().filter((p) => p.kind === "war").length;
    if (wars >= WAR_PLANS[era] || !room()) break;
    if (busy(tag, "war") || c.reach < 20 || next.wars.filter((x) => x.attackers.includes(tag) || x.defenders.includes(tag)).length >= 2) continue;
    const targets = new Map<string, { cause: Plan["cause"]; m: number }>();
    for (const a of c.aims) {
      if ((a.kind === "reclaim" || a.kind === "expand") && a.target) targets.set(a.target, { cause: a.kind === "reclaim" ? "claim" : "ambition", m: a.weight / 50 });
    }
    for (const [other, t] of Object.entries(c.ties)) if (t.tension >= 60 && t.trust <= -30 && !targets.has(other)) targets.set(other, { cause: "incident", m: t.tension / 50 });
    let best: { target: string; cause: Plan["cause"]; rate: number } | null = null;
    for (const [target, { cause, m }] of [...targets].sort((a, b) => a[0].localeCompare(b[0]))) {
      if (target === tag || !stands(w, target) || allied(next, tag, target) || warBetween(next, tag, target)) continue;
      const f = clamp(balance(w, tag, target, []) - 0.3, 0.1, 1.5);
      const rate = ERA_WAR[era] * mode * clamp(Math.max(m, motive(next, { by: tag, target, cause })), 0.3, 2) * (c.hawk / 50) * (c.reach / 50) * f;
      if (!best || rate > best.rate) best = { target, cause, rate };
    }
    if (!best || dice(`open:war:${tag}:${best.target}`) >= chance(best.rate)) continue;
    const partners = [...alliesOf(next, tag)]
      .filter((x) => x !== player && course(x) && (tieOf(next, x, best.target).tension >= 30 || tieOf(next, x, best.target).trust <= -20))
      .sort((a, b) => (ctx.power.get(b) ?? 0) - (ctx.power.get(a) ?? 0))
      .slice(0, 2);
    open({ kind: "war", by: tag, target: best.target, ...(partners.length ? { partners } : {}), cause: best.cause, stage: best.cause === "incident" ? "incident" : "tension" });
  }

  // Blocs: against the threat a government fears most, with others who fear it too, or by joining a bloc that already stands against it.
  for (const tag of actors) {
    if (!room()) break;
    const c = course(tag)!;
    if (busy(tag, "bloc")) continue;
    const [threat, t] = Object.entries(c.ties).sort((a, b) => b[1].threat - a[1].threat || a[0].localeCompare(b[0]))[0] ?? [];
    if (!threat || !t || t.threat < 50 || allied(next, tag, threat)) continue;
    const covered = [...alliesOf(next, tag)].some((x) => tieOf(next, x, threat).threat >= 35);
    if (covered) continue;
    if (dice(`open:bloc:${tag}:${threat}`) >= chance(0.5 * (t.threat / 50) * mode)) continue;
    const existing = next.alliances
      .filter((a) => isMilitary(a) && !a.members.includes(tag) && !a.members.includes(threat) && a.members.some((m) => tieOf(next, m, threat).threat >= 50))
      .find((a) => {
        const lead = [...a.members].sort((x, y) => (ctx.power.get(y) ?? 0) - (ctx.power.get(x) ?? 0))[0];
        return tieOf(next, tag, lead).trust >= 10;
      });
    if (existing) {
      open({ kind: "bloc", by: tag, target: threat, bloc: existing.id, cause: "threat", stage: "tension" });
      continue;
    }
    const partners = actors
      .filter((x) => x !== tag && x !== threat && !allied(next, x, threat) && !warBetween(next, tag, x) && tieOf(next, tag, x).trust >= 0 && tieOf(next, x, threat).threat >= 35)
      .sort((a, b) => tieOf(next, b, threat).threat * (ctx.power.get(b) ?? 0) - tieOf(next, a, threat).threat * (ctx.power.get(a) ?? 0))
      .slice(0, 2);
    if (!partners.length) continue;
    open({ kind: "bloc", by: tag, target: threat, partners, blocKind: t.threat >= 65 ? "alliance" : "pact", cause: "threat", stage: "tension" });
  }

  // Vultures: a claim on a country that is losing its war is a reason to enter it.
  for (const war of next.wars) {
    for (const side of ["attackers", "defenders"] as const) {
      for (const x of war[side]) {
        if ((lost.get(x) ?? 0) < 0.15) continue;
        for (const tag of actors) {
          const c = course(tag)!;
          if (!room() || war.attackers.includes(tag) || war.defenders.includes(tag) || allied(next, tag, x) || busy(tag, "join")) continue;
          if (!c.aims.some((a) => (a.kind === "reclaim" || a.kind === "expand") && a.target === x)) continue;
          if (dice(`open:vulture:${tag}:${war.id}`) < chance(c.hawk / 50)) {
            open({ kind: "join", by: tag, war: war.id, side: side === "attackers" ? "defenders" : "attackers", target: x, cause: "opportunity", stage: "tension" });
          }
        }
      }
    }
  }
}

/**
 * The world's plans after a turn: time eases the ties, the turn's deeds are
 * remembered, the game master's incidents raise tension, new governments set
 * their course, every course looks at the world again, and new plans open.
 * Ended plans leave after a few turns.
 */
export function advanceIntentions(
  before: GameState,
  next: GameState,
  ctx: { turn: number; from: string; to: string; years: number; regions: Record<string, MapRegion> | null; events: GameEvent[] },
  applied: AppliedChange[],
): void {
  if (!next.plans) return;
  easeTies(next, ctx.years);
  learnFromTurn(before, next, applied, ctx.to);
  const raised = incidentsFromEvents(next, ctx.events);
  const holders = landHolders(next);
  const power = powers(next, holders);
  // Courses are judged at the end of the period.
  const at = next.date;
  next.date = ctx.to;
  ensureCourses(next, power);
  const changed = newGovernments(next, ctx.from);
  refreshCourses(next, ctx.regions, power);
  openPlans(before, next, { turn: ctx.turn, from: ctx.from, to: ctx.to, years: ctx.years, power, holders, raised, changed, lost: lostShares(next, ctx.regions) }, applied);
  next.date = at;
  next.plans = next.plans.filter((p) => !p.end || ctx.turn - p.end.turn < KEEP_ENDED);
}

const STAGE_TEXT: Record<PlanKind, Partial<Record<PlanStage, string>>> = {
  war: {
    incident: "an INCIDENT this period: show one (a border clash, an insult, a spy scandal)",
    tension: "TENSION: protests, demands and threats in public, no shots",
    decision: "DECISION, secret: the government weighs war; show only rumours and hard words",
    preparation: "PREPARATION: mobilisation, troops to the border, allies asked",
  },
  join: {
    tension: "weighs entering the war; show it in hard words",
    decision: "DECISION, secret: the government weighs entering the war",
    preparation: "PREPARATION: it mobilises to enter the war",
  },
  bloc: {
    tension: "TALKS: envoys sound out partners",
    decision: "DECISION: the governments negotiate a treaty",
    preparation: "PREPARATION: the treaty is drafted",
  },
  leave: { decision: "DECISION, secret: the government weighs leaving" },
  peace: { decision: "DECISION, secret: the government weighs asking for terms" },
};

const CAUSE_TEXT: Record<Plan["cause"], string> = {
  claim: "a claim on land it lost",
  ambition: "an old ambition",
  treaty: "a treaty",
  threat: "a common threat",
  incident: "incidents and provocations",
  weariness: "war-weariness",
  "new-government": "a new government",
  opportunity: "opportunity",
  seeded: "where things stood on the start date",
};

const END_TEXT: Record<PlanEnd, string> = {
  "carried-out": "carried out",
  compromise: "a compromise or cooler heads",
  refused: "refused by those it needed",
  outmatched: "the other side proved too strong",
  unrest: "protests at home",
  government: "the government changed its mind",
  "target-gone": "the other side is gone",
  overtaken: "overtaken by events",
};

/**
 * The plans that matter this period, for the turn's game master: what
 * reaches action or ends first, then what touches the player, then the
 * rest by how far along it is; and the sharpest tensions between
 * governments, and those turning inward from the wars of their friends.
 */
export function describeIntentions(state: GameState, name: (tag: string) => string): string[] {
  if (!state.plans) return [];
  const live = state.plans.filter((p) => !p.end);
  const moves = new Map(castPlans(state).map((m) => [m.plan, m]));
  const who = (tag: string) => `${name(tag)} [${tag}]`;
  const warLabel = (id: string | undefined) => {
    const war = state.wars.find((w) => w.id === id);
    return war ? `${en(war.name)} [${war.id}]` : (id ?? "the war");
  };
  const blocLabel = (id: string | undefined) => {
    const bloc = state.alliances.find((a) => a.id === id);
    return bloc ? `${en(bloc.name)} [${bloc.id}]` : (id ?? "the bloc");
  };
  const rank = (p: Plan) => {
    const m = moves.get(p.id);
    if (m?.end && m.end.how !== "done") return 1;
    if (m?.stage === "action") return 0;
    if (p.by === state.player || p.target === state.player || p.partners?.includes(state.player)) return 2;
    return 3 + (4 - LADDER.war.indexOf(m?.stage ?? p.stage));
  };
  const power = powers(state);
  const shown = live
    .filter((p) => !(moves.get(p.id)?.end?.how === "done"))
    .sort((a, b) => rank(a) - rank(b) || (power.get(b.by) ?? 0) - (power.get(a.by) ?? 0))
    .slice(0, 8);
  const lines: string[] = [];
  for (const p of shown) {
    const m = moves.get(p.id);
    const stage = m?.stage ?? p.stage;
    let what: string;
    switch (p.kind) {
      case "war":
        what = `→ ${who(p.target ?? "?")}, war${p.partners?.length ? ` (counting on ${p.partners.map(who).join(", ")})` : ""}`;
        break;
      case "join":
        what = `enters ${warLabel(p.war)} on the side of the ${p.side}`;
        break;
      case "bloc":
        what = p.bloc ? `joins ${blocLabel(p.bloc)}` : `${p.blocKind ?? "alliance"} with ${(p.partners ?? []).map(who).join(", ")}${p.target ? ` against ${who(p.target)}` : ""}`;
        break;
      case "leave":
        what = `leaves ${blocLabel(p.bloc)}`;
        break;
      case "peace":
        what = `seeks peace with ${who(p.target ?? "?")} in ${warLabel(p.war)}`;
        break;
    }
    let now: string;
    if (m?.end) now = m.end.how === "failed" ? `FAILS this period (${END_TEXT[m.end.why]}) — tell why` : `FADES this period (${END_TEXT[m.end.why]}) — tell how tension eased`;
    else if (stage === "action") {
      const on = m?.acts ? ` on ${m.acts}` : "";
      const allies = (p.partners ?? []).filter((x) => !m?.refused?.includes(x));
      switch (p.kind) {
        case "war":
          now = `ACTION${on}: the war begins — put it in warsStarted with attackers ${[p.by, ...allies].join(", ")} and defenders ${p.target}`;
          break;
        case "join":
          now = `ACTION${on}: it enters the war — put it in warsJoined (war ${p.war}, side ${p.side})`;
          break;
        case "bloc":
          now = p.bloc ? `ACTION${on}: it joins — put it in alliancesJoined` : `ACTION${on}: the treaty is signed — put it in alliancesFormed (kind ${p.blocKind ?? "alliance"}, members ${[p.by, ...allies].join(", ")})`;
          break;
        case "leave":
          now = `ACTION${on}: it leaves — put it in alliancesLeft`;
          break;
        case "peace":
          now = m?.accepted === undefined ? `ACTION${on}: it asks the player's government for terms; the player's orders decide` : `ACTION${on}: both sides agree to make peace — end the war in warsEnded (or a truce), with what the terms annex`;
          break;
      }
    } else now = STAGE_TEXT[p.kind][stage] ?? stage.toUpperCase();
    const refused = m?.refused?.length ? `; ${m.refused.map(who).join(", ")} refuse${m.refused.length === 1 ? "s" : ""} to take part` : "";
    lines.push(`- ${who(p.by)} ${what} (${CAUSE_TEXT[p.cause]}): ${now}${refused}`);
  }
  const pairs: { a: string; b: string; tension: number; trust: number }[] = [];
  for (const c of Object.values(state.countries)) {
    for (const [other, t] of Object.entries(c.course?.ties ?? {})) {
      if (t.tension >= 40 && !warBetween(state, c.tag, other)) pairs.push({ a: c.tag, b: other, tension: t.tension, trust: t.trust });
    }
  }
  const tensions = pairs.sort((x, y) => y.tension - x.tension || x.a.localeCompare(y.a)).slice(0, 5);
  const belligerents = new Set(state.wars.flatMap((w) => [...w.attackers, ...w.defenders]));
  const inward = Object.values(state.countries)
    .filter((c) => c.course && c.course.reach < 30 && !belligerents.has(c.tag) && [...belligerents].some((b) => allied(state, c.tag, b) || (c.course!.ties[b]?.trust ?? 0) >= 30))
    .sort((a, b) => (power.get(b.tag) ?? 0) - (power.get(a.tag) ?? 0))
    .slice(0, 4);
  if (!lines.length && !tensions.length && !inward.length) return [];
  const out = ["", "INTENTIONS ABROAD (the engine's plans and the stage each reaches this period, already decided — tell them in the story; wars, war entries and military alliances or pacts among other governments come only from here, any other is dropped):"];
  out.push(...(lines.length ? lines : ["- no plan is under way"]));
  if (tensions.length) out.push(`SHARPEST TENSIONS (tension, trust): ${tensions.map((x) => `${x.a} → ${x.b} ${x.tension}, ${x.trust}`).join("; ")}`);
  if (inward.length) out.push(`TURNED INWARD (crisis or weariness: they help their friends at war less): ${inward.map((c) => `${who(c.tag)} reach ${c.course!.reach}`).join("; ")}`);
  return out;
}

/** What other governments do in the open, for the ministers who watch abroad: plans past the secret decision, those touching the player first. */
export function describeVisiblePlans(state: GameState, name: (tag: string) => string): string[] {
  const visible = (state.plans ?? []).filter((p) => !p.end && shownStage(p));
  if (!visible.length) return [];
  const mine = (p: Plan) => p.target === state.player || p.partners?.includes(state.player);
  const lines = visible
    .sort((a, b) => Number(mine(b)) - Number(mine(a)))
    .slice(0, 8)
    .map((p) => `- ${name(p.by)} [${p.by}]: ${p.kind}${p.target ? ` → ${name(p.target)} [${p.target}]` : ""}, ${shownStage(p)} since ${p.moved}`);
  return ["", "OTHER GOVERNMENTS' VISIBLE MOVES (what anyone can see; secret decisions are not here):", ...lines];
}

/** A government's own course, for the model that speaks for it in diplomacy: what it wants and plans, and what it thinks of the player. Secret. */
export function describeCourse(state: GameState, tag: string, name: (tag: string) => string): string[] {
  const c = state.countries[tag]?.course;
  if (!c) return [];
  const lines = ["", "YOUR GOVERNMENT'S COURSE (secret; what you say in public may differ):"];
  lines.push(`- appetite for force ${c.hawk}/100; how far you look abroad ${c.reach}/100; this course since ${c.set.date} (${c.set.how === "start" ? "in office on the start date" : `a new government: ${c.set.how}`})`);
  if (c.aims.length) lines.push(`- aims: ${c.aims.map((a) => `${a.kind}${a.target ? ` ${name(a.target)}` : ""} (${a.weight})`).join("; ")}`);
  const t = c.ties[state.player];
  if (t) lines.push(`- toward the player's government: trust ${t.trust} (-100 to 100), tension ${t.tension}, threat you see ${t.threat}`);
  const deeds = c.memory.filter((m) => m.by === state.player);
  if (deeds.length) lines.push(`- you remember of the player's government: ${deeds.map((d) => `${d.what} (${d.date})`).join("; ")}`);
  const own = (state.plans ?? []).filter((p) => !p.end && p.by === tag);
  if (own.length) lines.push(`- your plans: ${own.map((p) => `${p.kind}${p.target ? ` against ${name(p.target)}` : ""}${p.partners?.length ? ` with ${p.partners.map(name).join(", ")}` : ""}, ${p.stage}`).join("; ")}`);
  return lines;
}

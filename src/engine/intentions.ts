import { addYears, lostShares, yearsBetween } from "./abroad";
import { alarmOf, answerAggression, calledToArms, describeAggression, growWorldBody, noteAggression, type Fresh } from "./aggression";
import { hasBomb, nuclearShield } from "./atom";
import { addStep } from "./calendar";
import { roll } from "./dice";
import { STEP_YEARS } from "./economy";
import { relationsOf } from "./envoys";
import { byEra } from "./era";
import { endWar } from "./foreign";
import { applyIncidents, castIncidents, describeIncidents, incidentParties, WAR_PLANS, type Incident, type Relevance } from "./incidents";
import { countryName } from "./names";
import { isNeutral, onItsSoil } from "./neutrality";
import { acceptChance, enactPeaceful, endProgrammes, isPeaceful, openPeaceful, PEACEFUL_ACTION, PEACEFUL_LADDER, peacefulRates, peacefulWhat, settlePeaceful } from "./policies";
import {
  actorsOf,
  addTension,
  allied,
  alliesOf,
  areaOf,
  closeAllies,
  easeTies,
  enemiesOf,
  freshCourse,
  goodwillOf,
  greatPowers,
  incidentsFromEvents,
  isMilitary,
  isClientBond,
  isOpen,
  isPact,
  landHolders,
  landNeighbours,
  learnFromTurn,
  newGovernments,
  occupiedBy,
  pacted,
  powers,
  refreshCourses,
  remember,
  sharedBlocs,
  tieOf,
  warBetween,
} from "./relations";
import { declareIndependence } from "./provisional";
import { intentionsOf, type IntentionSeeds, type PlanSeed } from "./scenarios/intentions";
import { AREAS } from "./scenarios/treaties";
import { SCENARIOS } from "./scenarios";
import { backingOf, becauseEn, brakesOf, deterrence, ERA_BRINK, growthBecause, guarantee, homeBecause, homeEnd, homeIn, lensOf, mediatorOf, originOf, pickFade, spursOf, standoffOf, type Lens, type Standoff } from "./standoffs";
import { en, same } from "./text";
import { countryCentres, distanceKm } from "./trade";
import { STRATEGIC_KINDS } from "./types";
import type { Aim, Alliance, AppliedChange, Because, GameEvent, GameMode, GameState, Localized, MapIndex, MapRegion, Plan, PlanEnd, PlanKind, PlanStage, RegimeKind, Scenario, ScenarioId, TreatyArea, War } from "./types";
import { attackMeans, LIMITED, regimeOf } from "./warMeans";

/**
 * Countries with intentions. Every government that matters keeps plans that
 * take several turns — a war, entering a war under way, founding or joining a
 * bloc, leaving one, seeking peace — and each grows stage by stage. A war
 * plan is a crisis between two states (engine/standoffs.ts): an incident,
 * escalation, preparation, a decision at the brink, and the outcome. A plan
 * can also fade (a compromise, a mediator, a deterrent ally) or fail (allies
 * refuse, protests at home, the government falls). The engine moves them by
 * seeded dice from the state before the turn, so the server that writes the
 * prompt and the browser that applies the answer agree, and a reload rolls
 * nothing again. The game master is told the stages reached and tells them;
 * a war or military bloc among other governments comes only from a plan that reached action, and
 * one the answer leaves out the engine carries out itself.
 */

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Live strategic plans at once, besides allies called by a treaty; peaceful plans are capped by country (engine/policies.ts). */
export const MAX_LIVE = 16;
/** Ended plans stay this many turns, for the panel. */
const KEEP_ENDED = 4;
/** A strategic plan: war, a war entered, a bloc, leaving one, peace. */
export const isStrategic = (p: Pick<Plan, "kind">) => STRATEGIC_KINDS.includes(p.kind);
/** New war plans a year for a government with a motive, before its appetite, reach and means. */
const ERA_WAR: Record<ScenarioId, number> = { "1914": 0.35, "1933": 0.4, "1939": 0.45, "1950": 0.25, "1957": 0.25, "1964": 0.25, "1973": 0.22, "1979": 0.22, "1991": 0.15, "1999": 0.12, "2014": 0.12, "2022": 0.15 };
/** The shortest mobilisation of each era, years. */
const MOBILISE: Record<ScenarioId, number> = { "1914": 0.04, "1933": 0.06, "1939": 0.08, "1950": 0.08, "1957": 0.08, "1964": 0.08, "1973": 0.1, "1979": 0.12, "1991": 0.16, "1999": 0.16, "2014": 0.16, "2022": 0.16 };

/** The stages each kind of plan climbs. A war plan is a crisis: incident, escalation (tension), mobilisation, the decision at the brink, war. */
const LADDER: Record<PlanKind, PlanStage[]> = {
  war: ["incident", "tension", "preparation", "decision", "action"],
  bloc: ["tension", "decision", "preparation", "action"],
  join: ["tension", "decision", "preparation", "action"],
  leave: ["decision", "action"],
  peace: ["decision", "action"],
  ...PEACEFUL_LADDER,
};

/** The stages a kind of plan climbs, for the panel's step bar. */
export const planLadder = (kind: PlanKind): PlanStage[] => LADDER[kind];

const nextStage = (p: Pick<Plan, "kind" | "stage">): PlanStage => {
  const ladder = LADDER[p.kind];
  const i = ladder.indexOf(p.stage);
  return ladder[Math.min(ladder.length - 1, i + 1)];
};

/** How an end reads: a compromise, a mediator's way back, a deterrent ally or a target gone fades a plan, the rest fail it; a plan overtaken by events is simply done. */
const howFor = (why: PlanEnd): "done" | "failed" | "faded" =>
  why === "carried-out" || why === "overtaken" ? "done" : why === "compromise" || why === "target-gone" || why === "mediation" || why === "deterred" ? "faded" : "failed";

/**
 * The stage the world can see. A crisis is in the open at every step – the
 * decision at the brink comes after the troops have massed, with an
 * ultimatum; any other plan's decision is secret, so a bloc plan still shows
 * as tension and the rest not at all.
 */
export function shownStage(p: Pick<Plan, "kind" | "stage">): PlanStage | null {
  if (p.stage !== "decision" || p.kind === "war") return p.stage;
  return p.kind === "bloc" ? "tension" : null;
}

/** What one plan does in the coming period. */
export interface PlanMove {
  plan: string;
  /** The stages it reaches, in order, with the day each is reached and, for a crisis, what drove it there. */
  passed: { stage: PlanStage; date: string; because?: Because }[];
  /** Where it stands at the end of the period. */
  stage: PlanStage;
  /** It ends this period, and the reason the news gives. */
  end?: { how: "done" | "failed" | "faded"; why: PlanEnd; date: string; because?: Because };
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
  /** What crises read off the world, indexed once (engine/standoffs.ts). */
  lens?: Lens;
}

const strength = (w: World, tag: string) => w.power.get(tag) ?? 0;

/**
 * The anti-communist halves of divided nations, whom the ruling parties of the other camp do not recognise nor they
 * them: the government of the other China in a Soviet treaty, or a communist Vietnam allied to Taipei, make no sense.
 */
const DIVIDED: Record<string, string> = { taiwan: "china", "south-korea": "north-korea", "west-germany": "east-germany", "south-vietnam": "north-vietnam" };

/** Two governments that will be partners in no bloc: rival claimants of one nation, or a ruling party and the other camp's half of a divided nation. */
export function estranged(state: Pick<GameState, "countries">, a: string, b: string): boolean {
  if (DIVIDED[a] === b || DIVIDED[b] === a) return true;
  const party = (t: string) => state.countries[t]?.domestic?.regime === "party" && !(t in DIVIDED);
  return (a in DIVIDED && party(b)) || (b in DIVIDED && party(a));
}

/** Whether a province's centre lies in a treaty's area. */
export function inArea(area: TreatyArea, at: [number, number]): boolean {
  return AREAS[area].some(([w, s, e, n]) => at[0] >= w && at[0] <= e && at[1] >= s && at[1] <= n);
}

/** How far from a country's home its land is still home to a treaty without an area: farther lies an overseas possession (the Falklands, Goa). */
const HOME_KM = 4500;
/** How far a guardian's army goes over land to a war: about a closeness of 45 (engine/relations.ts), beyond it only ships take it. */
const REACH_KM = 2250;
const lensIn = (w: World): Lens => (w.lens ??= lensOf(w.state, w.power));
const standoff = (w: World, p: Pick<Plan, "by" | "target" | "partners">): Standoff => standoffOf(lensIn(w), p);
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

/** How readily a patron fights a client that has declared itself independent, by the patron's regime (before its appetite and strength). */
const KEEP_CLIENT: Record<RegimeKind, number> = { democracy: 0.2, limited: 0.4, party: 0.7, autocracy: 0.7, military: 0.8 };

/** Open enemies: one distrusts the other at -50 or worse, or the tension between them is 60 or more. No bloc holds two. */
function openEnemies(state: GameState, a: string, b: string): boolean {
  const x = tieOf(state, a, b);
  const y = tieOf(state, b, a);
  return x.trust <= -50 || y.trust <= -50 || x.tension >= 60 || y.tension >= 60;
}

/**
 * Whether a military bloc's members would refuse a country: an open enemy
 * of one of them, one at war with an enemy none of them fights already
 * (Turkey joined NATO in 1952 while its brigade fought in Korea beside the
 * Americans), or one with a claim it means (weight 50 or more) on a strong
 * state outside the bloc – a member that would drag them into its own war.
 */
function unwelcome(w: World, tag: string, bloc: Alliance): boolean {
  if (!isMilitary(bloc)) return false;
  if (bloc.members.some((m) => openEnemies(w.state, tag, m))) return true;
  const theirs = new Set(bloc.members.flatMap((m) => [...enemiesOf(w.state, m)]));
  if ([...enemiesOf(w.state, tag)].some((e) => !theirs.has(e))) return true;
  return (w.state.countries[tag]?.course?.aims ?? []).some((a) => (a.kind === "reclaim" || a.kind === "expand") && a.weight >= 50 && a.target && !bloc.members.includes(a.target) && strength(w, a.target) >= 0.1);
}

/**
 * The planner's side against the target's, where the planner's own strength
 * is cut by distance: the partners it counts on and the patrons who back it,
 * against everyone who would stand by the target, each weighed by its
 * commitment and its will (engine/standoffs.ts).
 */
function balance(w: World, by: string, target: string, partners: string[]): number {
  return standoff(w, { by, target, partners }).ratio;
}

/** A fortnight, years: an eve's war does not fade before its day and this long after it. */
const FORTNIGHT = 14 / 365.25;

/** How the date history did it bends the dice: slower long before, much faster around it, faster after. */
function dueFactor(due: string | undefined, at: string): number {
  if (!due) return 1;
  const ahead = yearsBetween(at, due);
  if (ahead > 0.25) return 0.4;
  if (ahead > 2 / 52) return 1;
  if (ahead >= -1 / 12) return 6;
  return 3;
}

/** The pace of a plan at its stage: the time it must spend there, how fast it climbs and how fast it fades or fails, a year, why, and the reason the news gives. */
interface Pace {
  min: number;
  advance: number;
  fade: number;
  why: PlanEnd;
  because?: Because;
}

/**
 * Whether a country is fighting off another enemy than `target` now (not under a truce): with that enemy on its own
 * soil, or attacked by a side whose strength free for that war is at least what its own side has free for it –
 * not a border war a great power fights with a corner of its army (the Soviet Union at Khalkhin Gol in 1939 still went
 * to war with Finland).
 */
function defendingElsewhere(w: World, tag: string, target: string): boolean {
  const { state, power } = w;
  const wars = state.wars.filter((x) => !x.truce && !x.attackers.includes(target) && !x.defenders.includes(target));
  const free = (t: string) => (power.get(t) ?? 0) / Math.max(1, wars.filter((x) => x.attackers.includes(t) || x.defenders.includes(t)).length);
  for (const x of wars) {
    if (!x.defenders.includes(tag)) continue;
    const theirs = x.attackers.reduce((s, t) => s + free(t), 0);
    const mine = x.defenders.reduce((s, t) => s + free(t), 0);
    if (theirs >= mine) return true;
  }
  const foes = enemiesOf({ wars }, tag);
  if (!foes.size) return false;
  return Object.values(state.regions).some((r) => r.owner === tag && (foes.has(r.controller) || (r.contested !== undefined && foes.has(r.contested))));
}

/** The pace of a plan at its stage. */
function rates(w: World, p: Plan, at: string): Pace {
  const { state } = w;
  const hawk = hawkOf(state, p.by);
  const h = hawk / 50;
  const reach = reachOfCourse(state, p.by) / 50;
  const due = dueFactor(p.due, at);
  // History holds a plan to its date: it fades half as fast before it, and slower still around and after it.
  const slow = !p.due ? 1 : due >= 3 ? 0.3 : 0.5;
  const stay = { min: 0, advance: 0, fade: 0, why: "compromise" as PlanEnd };
  switch (p.kind) {
    case "war": {
      // A country fighting off another enemy – on its soil, or one its match – begins no new war: the plan waits and
      // fades, history's own too (Israel, attacked by Egypt in a 1964 game, opened its 1967 front against Syria as well and
      // lost the Negev for it).
      if (p.target && defendingElsewhere(w, p.by, p.target)) return { min: 0, advance: 0, fade: 2, why: "outmatched" };
      const pace = crisisRates(w, p, { h, hawk, reach, due, slow, at });
      // The war an eve opens with is history's decision already taken: it does not fade before its day and a fortnight
      // after, and at the brink it strikes within the week of its day; a deterrent may still stop it once that is past.
      if (!p.begins || !p.due || yearsBetween(p.due, at) >= FORTNIGHT) return pace;
      const strike = p.stage === "decision" && yearsBetween(at, p.due) < 8 / 365.25;
      return { ...pace, fade: 0, ...(strike ? { advance: Math.max(pace.advance, 300) } : {}) };
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
      // Going to a friend's war costs a government in trouble at home most where votes count.
      const home = homeIn(lensIn(w), p.by);
      const homeCost = (home.votes ? 0.4 : 0.2) * home.trouble;
      // The enemy's bombs weigh against going, less under a treaty and less for a government with the bomb of its own or a nuclear ally (engine/atom.ts).
      const shield = enemy ? nuclearShield(state, enemy) : 0;
      const ownBomb = Boolean(state.countries[p.by]?.arsenal?.nuclear) || [...alliesOf(state, p.by)].some((x) => state.countries[x]?.arsenal?.nuclear);
      const bombs = (p.cause === "treaty" ? 0.3 : 0.6) * shield * (ownBomb ? 0.5 : 1);
      // A standing call of the world body for collective action on that side adds to the honour of going (engine/aggression.ts).
      const honour = clamp(0.25 + trust / 100 + hawk / 150 + (p.cause === "treaty" ? 0.25 : 0) + word + calledToArms(state, p) - busy - homeCost - bombs - (1 - near) * 0.3 + (reachOfCourse(state, p.by) - 50) / 200, 0.05, 0.95);
      switch (p.stage) {
        case "tension":
          return { min: 0, advance: 3 * h * due, fade: 2 * slow, why: "compromise" };
        case "decision":
          return { min: 0, advance: 12 * honour * due, fade: 12 * (1 - honour) * slow, why: "refused", ...(homeCost >= 0.1 && homeBecause(home) ? { because: homeBecause(home) } : {}) };
        case "preparation": {
          const f = pickFade([[homeEnd(home), (home.votes ? 2.5 : 0.5) * home.trouble, homeBecause(home)]]);
          return { min: byEra(MOBILISE, at) / 2, advance: 8 * reach * due, fade: f.fade * slow, why: f.why, ...(f.because ? { because: f.because } : {}) };
        }
        default:
          return stay;
      }
    }
    case "leave":
      return p.stage === "decision" ? { min: 0, advance: 4 * due, fade: 2 * slow, why: "compromise" } : stay;
    case "peace":
      return p.stage === "decision" ? { min: 0, advance: 8 * (1 - hawk / 100) * due, fade: slow, why: "government" } : stay;
    case "policy":
    case "sanction":
    case "deal":
    case "talks":
      return peacefulRates(state, p);
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

/**
 * The pace of a crisis (a war plan) at each step, from what it stands on
 * (engine/standoffs.ts). Up: motive, appetite, the balance with everyone's
 * backers, a patron, an autocracy's diversion from trouble at home, a target
 * in turmoil, the era. Down: a compromise (trade at stake, a dove), talks, a
 * mediator, trouble at home where votes count, economic pain, and at the
 * brink being outmatched or deterred by the target's friends.
 */
function crisisRates(w: World, p: Plan, k: { h: number; hawk: number; reach: number; due: number; slow: number; at: string }): Pace {
  const { state } = w;
  const { h, hawk, reach, due, slow, at } = k;
  if (!p.target) return { min: 0, advance: 0, fade: 0, why: "compromise" };
  const t = tieOf(state, p.by, p.target);
  // Members of one bloc are held back by the others from a war between them: braked hard, never barred (history's own less).
  const bloc = sharedBlocs(state, p.by, p.target).length ? (p.cause === "seeded" ? 0.3 : 1) : 0;
  const m = motive(state, p);
  const s = standoff(w, p);
  const f = clamp(s.ratio - 0.3, 0.1, 1.5);
  const dove = state.countries[p.by]?.domestic?.regime === "democracy" && hawk < 45 ? 1 : 0;
  // Goodwill between the two makes a way back easier to find; distrust adds nothing the tension does not already say.
  const goodwill = goodwillOf(state, p.by, p.target);
  const home = s.home;
  // Where votes count, trouble at home holds a government back; an autocracy in trouble is tempted to look for a quarrel abroad.
  const appetite = home.votes ? 1 - 0.6 * home.trouble : 1 + 0.5 * home.trouble;
  const brake = home.votes ? home.trouble : 0;
  const mediation = s.mediator?.strength ?? 0;
  const mediated: Because | undefined = s.mediator ? { kind: "mediation", country: s.mediator.tag } : undefined;
  const trade: Because | undefined = s.trade >= 0.12 ? { kind: "trade" } : undefined;
  const pain: Because | undefined = home.why === "slump" || home.why === "inflation" || home.why === "sanctions" ? { kind: home.why } : undefined;
  // A great power's guarantee behind the target, since the bomb: few dare a war that could draw it in.
  const g = guarantee(lensIn(w), s, p.by);
  const guaranteed = (rate: number): Parameters<typeof pickFade>[0][number] => ["deterred", rate * g.weight, g.by ? { kind: "deterrent", country: g.by } : undefined];
  // The target's own bomb: few governments dare a war with a nuclear power, and the more warheads it has the fewer (engine/atom.ts).
  const shield = nuclearShield(state, p.target);
  const bombed = (rate: number): Parameters<typeof pickFade>[0][number] => ["deterred", (rate * shield) / Math.max(0.05, 1 - shield), { kind: "deterrent", country: p.target! }];
  const pace = (min: number, advance: number, parts: Parameters<typeof pickFade>[0]): Pace => {
    const x = pickFade(parts);
    return { min, advance, fade: x.fade * slow, why: x.why, ...(x.because ? { because: x.because } : {}) };
  };
  switch (p.stage) {
    case "incident":
      return { min: 0, advance: 8 * due, fade: (t.tension < 30 ? 3 : 0.5) * slow, why: "compromise" };
    case "tension":
      // Escalation: threats and demands in public.
      return pace(1 / 12, 2 * h * m * f * due * appetite * (1 + 0.3 * s.turmoil), [
        ["compromise", (1.5 * (1 + 2 * s.trade + dove) * goodwill) / Math.max(0.5, m), trade],
        ["compromise", s.talks ? 1 : 0, { kind: "talks" }],
        ["mediation", 1.2 * mediation, mediated],
        [homeEnd(home), 1.2 * brake, homeBecause(home)],
      ]);
    case "preparation":
      // Mobilisation: troops to the border, partners asked. A hopeless cause and a home that will not follow show here first.
      return pace(byEra(MOBILISE, at), 4 * reach * Math.sqrt(h) * due, [
        [homeEnd(home), (home.votes ? 2.5 : 0.5) * home.trouble, homeBecause(home)],
        ["compromise", 3 * bloc, undefined],
        ["economy", 1.2 * home.pain, pain],
        ["mediation", 0.8 * mediation, mediated],
        ["compromise", s.talks ? 0.8 : 0, { kind: "talks" }],
        deterrence(s, s.ratio < 0.5 ? (0.5 - s.ratio) * 3 : 0),
        guaranteed(1),
        bombed(2),
      ]);
    case "decision": {
      // At the brink: the order to strike, or a way back.
      const brink = byEra(ERA_BRINK, at);
      const compromise = ((0.4 + (s.ratio > 2 && !s.backers.length ? 0.6 : 0) + 2 * s.trade) * goodwill) / brink;
      // A hawkish government misjudges the odds: it sees itself outmatched later than a cautious one.
      // Hopelessly outmatched (a great alliance behind the target), even a hawk backs down.
      // Without the means – ships for a distant target, a trained army, the will at home – the odds are worse (engine/warMeans.ts).
      // Friends behind it do not carry its own army there: a planner short of the means hesitates at the brink whatever the balance.
      const means = attackMeans(state, p.by, p.target);
      const odds = s.ratio * means.factor;
      const short = Math.max(0, LIMITED - means.factor) / LIMITED;
      const outmatched = (odds < 0.35 ? 10 : odds < 0.7 * clamp(1 - (hawk - 50) / 100, 0.5, 1.3) ? 2 : 0) + 3 * short;
      return pace(0, 6 * due * brink, [
        ["compromise", compromise, trade],
        ["compromise", 6 * bloc, undefined],
        deterrence(s, outmatched),
        guaranteed(3),
        bombed(6),
        ["mediation", 1.5 * mediation, mediated],
        ["compromise", s.talks ? 1 : 0, { kind: "talks" }],
        ["economy", home.pain, pain],
        [homeEnd(home), 1.5 * brake, homeBecause(home)],
      ]);
    }
    default:
      return { min: 0, advance: 0, fade: 0, why: "compromise" };
  }
}

/** Whether a partner agrees to take part when the plan is prepared: by its trust in the planner, its appetite and its own quarrel. */
function partnerChance(w: World, p: Plan, partner: string): number {
  const { state } = w;
  // A neutral takes part in no one's war or bloc.
  if (isNeutral(state, partner) && p.cause !== "seeded") return 0;
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
/** What each rung of an atomic power's escalation ladder adds to the chance its enemy grants it the peace it asks for. */
const LADDER_PEACE = 0.08;

function peaceChance(state: GameState, p: Plan, lost: Map<string, number>): number | undefined {
  const enemy = p.target;
  if (!enemy || enemy === state.player) return undefined;
  const own = (state.plans ?? []).some((x) => !x.end && x.kind === "peace" && x.by === enemy && x.war === p.war);
  // An atomic power that asks for peace from high on its escalation ladder in this war is heard: its threats, alert or strikes weigh (engine/nuclear.ts).
  const rung = state.atom?.ladder?.[p.by];
  const brink = rung && rung.war === p.war && rung.against === enemy ? LADDER_PEACE * rung.step : 0;
  return clamp(0.25 + (1 - hawkOf(state, enemy) / 100) * 0.4 + (lost.get(enemy) ?? 0) + (reachOfCourse(state, enemy) < 35 ? 0.2 : 0) + (own ? 0.4 : 0) + brink, 0.05, 0.95);
}

/** A plan overtaken or made pointless by the state of the world before it moves. */
function settle(w: World, p: Plan): PlanEnd | null {
  const { state } = w;
  if (!stands(w, p.by) || p.by === state.player) return "overtaken";
  switch (p.kind) {
    case "war":
      if (!p.target || !stands(w, p.target)) return "target-gone";
      if (warBetween(state, p.by, p.target)) return "overtaken";
      // A bilateral ally is never attacked; members of a larger bloc are braked at the brink (crisisRates).
      if (closeAllies(state, p.by, p.target)) return "compromise";
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
        if (bloc.members.includes(p.by)) return "overtaken";
        // A bilateral treaty takes no third party, and no treaty is signed with a government relations are broken with.
        if (p.cause !== "seeded" && (!isOpen(bloc) || bloc.members.some((m) => relationsOf(state, p.by, m) === "broken"))) return "refused";
        return unwelcome(w, p.by, bloc) ? "refused" : null;
      }
      const partners = (p.partners ?? []).filter((x) => stands(w, x));
      if (!partners.length) return "target-gone";
      // Done when every partner already shares a bloc of this kind or a stronger one with the planner.
      if (partners.every((x) => allied(state, p.by, x) || (p.blocKind === "pact" && pacted(state, p.by, x)))) return "overtaken";
      return partners.every((x) => relationsOf(state, p.by, x) === "broken") ? "refused" : null;
    }
    default:
      return settlePeaceful(state, p, (tag) => stands(w, tag));
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
    if (p.kind !== "peace" && p.kind !== "deal" && p.kind !== "talks") return;
    // The other side's yes: to peace, to a trade agreement, to talks.
    const chance = p.kind === "peace" ? peaceChance(state, p, lost) : acceptChance(state, p);
    if (chance === undefined) return;
    move.accepted = roll(state.seed ?? state.id, state.turn, `${p.kind === "peace" ? "peace" : "accept"}:${p.id}`) < chance;
    if (!move.accepted) move.end = { how: "failed", why: "refused", date };
  };
  if (p.stage === "action") reachAction(state.date);
  let moved = p.moved;
  // The steps' days stay inside the period: a twelfth of a year runs past the end of February.
  const to = addStep(state.date, state.step);
  const within = (date: string) => (date > to ? to : date);
  for (let k = 0; k < steps && p.stage !== "action" && !move.end; k++) {
    const start = within(addYears(state.date, k * dt));
    const end = within(addYears(state.date, (k + 1) * dt));
    const r = rates(w, p, start);
    if (yearsBetween(moved, end) < r.min) continue;
    const fades = 1 - Math.exp(-Math.max(0, r.fade) * dt);
    const climbs = 1 - Math.exp(-Math.max(0, r.advance) * dt);
    const x = roll(state.seed ?? state.id, state.turn, `plan:${p.id}:${k}`);
    if (x < fades) {
      move.end = { how: howFor(r.why), why: r.why, date: end, ...(r.because ? { because: r.because } : {}) };
      break;
    }
    if (x >= fades + climbs) continue;
    p.stage = nextStage(p);
    // An eve's war strikes on history's day when that day falls within the step.
    const day = p.stage === "action" && p.begins && p.due && p.due >= start && p.due <= end ? p.due : end;
    moved = day;
    // A crisis tells what drove it on: the incident it grew from, a patron's backing, a diversion from trouble at home.
    const because = p.kind === "war" && p.target ? growthBecause(state, standoff(w, p), p, p.stage) : undefined;
    move.passed.push({ stage: p.stage, date: day, ...(because ? { because } : {}) });
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
    if (p.stage === "action") reachAction(day);
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
  return settleByTalks(
    state,
    live.map((p) => walk(w, p, steps, years / steps, lost)),
  );
}

/**
 * Talks that reach an accord this period defuse the crisis between the two:
 * a war plan between them that has not struck by the day of the accord
 * fades with it, as a compromise (or the mediator's, when one worked for it).
 */
function settleByTalks(state: GameState, moves: PlanMove[]): PlanMove[] {
  const plans = new Map((state.plans ?? []).map((p) => [p.id, p]));
  const accords = moves.flatMap((m) => {
    const p = plans.get(m.plan);
    return p?.kind === "talks" && p.target && m.stage === "action" && !m.end && m.accepted !== false ? [{ a: p.by, b: p.target, date: m.acts ?? state.date, crisis: p.origin }] : [];
  });
  if (!accords.length) return moves;
  let lens: Lens | undefined;
  return moves.map((m) => {
    const p = plans.get(m.plan);
    if (p?.kind !== "war" || !p.target) return m;
    const accord = accords.find((x) => (x.a === p.by && x.b === p.target) || (x.a === p.target && x.b === p.by));
    // A crisis that ended, or struck, before the accord keeps its own end.
    if (!accord || (m.end && m.end.date <= accord.date) || (m.stage === "action" && !m.end && (m.acts ?? state.date) <= accord.date)) return m;
    const mediator = mediatorOf((lens ??= lensOf(state)), p.by, p.target);
    const passed = m.passed.filter((s) => s.date <= accord.date);
    const end = mediator && accord.crisis === p.id ? { why: "mediation" as const, because: { kind: "mediation" as const, country: mediator.tag } } : { why: "compromise" as const, because: { kind: "talks" as const } };
    return { plan: m.plan, passed, stage: passed.at(-1)?.stage ?? p.stage, ...(m.refused ? { refused: m.refused } : {}), end: { how: "faded" as const, date: accord.date, ...end } };
  });
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
  /** Whether a war may end as the answer says: the player's own, one a peace plan of it brings to an end this period, or one with a side left without land. */
  peace(war: War): boolean;
}

/**
 * The check on wars and military blocs. The player's government decides its
 * own; a country born this turn or without land (a secession) is free; any
 * other comes only from a plan that reaches action this period, and a
 * government that agreed with the player this turn may join the player. A war
 * among other governments ends only by a peace plan that reaches action, or
 * when a side has no land left to fight from.
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
      // No treaty while relations are broken (engine/envoys.ts).
      if (bloc.members.some((m) => relationsOf(state, country, m) === "broken")) return false;
      if (bloc.members.includes(player) && agreedWithPlayer(state, country)) return true;
      return acts.some((p) => p.kind === "bloc" && p.by === country && p.bloc === bloc.id);
    },
    peace(war) {
      if (war.attackers.includes(player) || war.defenders.includes(player)) return true;
      if (acts.some((p) => p.kind === "peace" && p.war === war.id)) return true;
      // A side whose every member holds and fights in no province has nothing left to fight from.
      const holding = new Set<string>();
      for (const r of Object.values(state.regions)) {
        holding.add(r.controller);
        if (r.contested) holding.add(r.contested);
      }
      return !war.attackers.some((t) => holding.has(t)) || !war.defenders.some((t) => holding.has(t));
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
  return { en: `${x.en}–${y.en} War`, ru: `${x.ru} – ${y.ru}`, uk: `${x.uk} – ${y.uk}` };
}

/** The name the engine gives a bloc the game master did not name, the same way. */
export function blocName(state: GameState, kind: "alliance" | "pact", members: string[]): Localized {
  const list = members.map((m) => names(state, m));
  const join = (l: keyof Localized, by: string) => list.map((x) => x[l]).join(by);
  return { en: `${join("en", "–")} ${kind === "alliance" ? "Alliance" : "Pact"}`, ru: join("ru", " – "), uk: join("uk", " – ") };
}

/** The crisis a plan belongs to: the war plan that talks were opened to defuse. */
const crisisOfPlan = (p: Pick<Plan, "kind" | "origin">): string | undefined => (p.kind !== "war" && p.origin && !/^[ig]\d/.test(p.origin) ? p.origin : undefined);

const change = (p: Plan, stage: PlanStage, because?: Because): AppliedChange => {
  const crisis = crisisOfPlan(p);
  return { kind: "plan", plan: p.id, type: p.kind, by: p.by, ...(p.target ? { target: p.target } : {}), stage, ...(p.policy ? { policy: p.policy } : {}), ...(p.lift ? { lift: true } : {}), ...(because ? { because } : {}), ...(crisis ? { crisis } : {}) };
};

/** Whether a plan's stages and failures are news: every strategic plan, a peaceful one of a government that matters or aimed at the player; the light tier's are told only when they act. */
const told = (state: GameState, p: Plan) => isStrategic(p) || Boolean(state.countries[p.by]?.course) || p.target === state.player;

/** A plan ends: kept a few turns for the panel; a failure or a fade is news, and an ally that stood aside is remembered. */
function endPlan(next: GameState, p: Plan, end: { how: "done" | "failed" | "faded"; why: PlanEnd; date: string; because?: Because }, turn: number, applied: AppliedChange[]): void {
  p.end = { date: end.date, turn, how: end.how, why: end.why };
  if (end.how === "done" || !told(next, p)) return;
  const crisis = crisisOfPlan(p);
  applied.push({
    kind: "plan-end",
    plan: p.id,
    type: p.kind,
    by: p.by,
    ...(p.target ? { target: p.target } : {}),
    how: end.how,
    why: end.why,
    ...(p.policy ? { policy: p.policy } : {}),
    ...(p.lift ? { lift: true } : {}),
    ...(end.because ? { because: end.because } : {}),
    ...(crisis ? { crisis } : {}),
  });
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
      // The war of the date an eve's plan begins comes with the date's id and name.
      const dated = p.begins && !next.wars.some((w) => w.id === p.begins) ? SCENARIOS[next.scenarioId].wars.find((w) => w.id === p.begins) : undefined;
      const created: War = { id: dated?.id ?? `w${ctx.turn}-p${made()}`, name: dated?.name ?? warName(next, p.by, p.target), attackers, defenders: [p.target], since: when };
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
      // Partners fallen out with the founder or with each other since the plan was made stay out (Poland and Slovakia in 1941).
      const members = [p.by];
      for (const x of p.partners ?? []) if (next.countries[x] && x !== next.player && !members.some((m) => openEnemies(next, m, x))) members.push(x);
      if (members.length < 2) return "refused";
      const kind = p.blocKind ?? "alliance";
      // A treaty of its time runs ten to twenty years (renewed by a new plan if the threat stands), and is kept against the threat it answers.
      const term = 10 + Math.floor(roll(next.seed ?? next.id, ctx.turn, `term:${p.id}`) * 11);
      const bloc: Alliance = {
        id: `a${ctx.turn}-p${made()}`,
        name: blocName(next, kind, members),
        members,
        since: when,
        ...(kind !== "alliance" ? { kind } : {}),
        founder: p.by,
        until: addYears(when, term),
        ...(p.target ? { against: p.target } : {}),
      };
      next.alliances.push(bloc);
      p.bloc = bloc.id;
      applied.push({ kind: "alliance", alliance: bloc.id, name: bloc.name, members: [...members], plan: p.id });
      // An alliance between partners of a pact founded in play takes its place.
      if (kind === "alliance") {
        for (const old of next.alliances.filter((a) => a !== bloc && a.founder && a.kind === "pact" && a.members.every((m) => members.includes(m)))) {
          applied.push({ kind: "alliance-ended", alliance: old.id, name: old.name, members: [...old.members] });
          next.alliances = next.alliances.filter((a) => a !== old);
        }
      }
      return "carried-out";
    }
    case "leave": {
      const bloc = next.alliances.find((a) => a.id === p.bloc);
      if (!bloc || !bloc.members.includes(p.by)) return "carried-out";
      // A client's treaty with its patron ends only with its independence.
      if (isClientBond(next, bloc)) return "refused";
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
      // The side that asked for terms pays for them: what the other side holds of its land, the other keeps. The game
      // master's own peace (warsEnded with its annexations) is not touched; this is the peace the answer left out.
      const asking = war.attackers.includes(p.by) ? war.attackers : war.defenders;
      const granting = asking === war.attackers ? war.defenders : war.attackers;
      for (const [id, r] of Object.entries(next.regions).sort((a, b) => a[0].localeCompare(b[0]))) {
        if (!asking.includes(r.owner) || !granting.includes(r.controller)) continue;
        applied.push({ kind: "annex", region: id, from: r.owner, to: r.controller });
        r.owner = r.controller;
        delete r.behind;
        // An insurgency granted land at the peace is a state from now on, not a movement.
        if (next.countries[r.controller]?.dormant) delete next.countries[r.controller].dormant;
      }
      endWar(next, war, applied);
      return "carried-out";
    }
    default:
      return enactPeaceful(next, p, { turn: ctx.turn, when, accepted: move.accepted }, made, applied);
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
      if (s.stage !== "action" && shownStage(p) === s.stage && s.stage !== "incident" && told(next, p)) applied.push(change(p, s.stage, s.because));
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

/**
 * The war a seed names: the date's war by its id, or the war a seeded plan
 * began in its place – an eve's war, opened in play, perhaps by the game
 * master under an id of its own.
 */
export function seededWar(state: Pick<GameState, "wars" | "plans">, id: string | undefined): War | undefined {
  if (!id) return undefined;
  return state.wars.find((w) => w.id === id) ?? state.wars.find((w) => (state.plans ?? []).some((p) => p.begins === id && p.war === w.id));
}

/** A seeded plan as it enters play, if its countries still stand and it still makes sense; never one of the player's. */
function fromSeed(state: GameState, seed: PlanSeed, date: string, holders: Set<string>): Plan | null {
  const up = (tag: string | undefined) => Boolean(tag && state.countries[tag] && (holders.has(tag) || state.countries[tag].dormant));
  if (!up(seed.by) || seed.by === state.player) return null;
  if (seed.target && !up(seed.target)) return null;
  const partners = (seed.partners ?? []).filter((x) => up(x) && x !== state.player && x !== seed.by);
  let war: string | undefined = seed.war;
  switch (seed.kind) {
    case "war":
      // History's war between members of a large bloc comes, braked (the Rio Pact's America in Panama); a bilateral ally is never attacked.
      if (!seed.target || warBetween(state, seed.by, seed.target) || closeAllies(state, seed.by, seed.target)) return null;
      break;
    case "join": {
      const found = seededWar(state, seed.war);
      if (!found || !seed.side || found.attackers.includes(seed.by) || found.defenders.includes(seed.by)) return null;
      war = found.id;
      break;
    }
    case "peace": {
      const found = seededWar(state, seed.war);
      if (!found || !(found.attackers.includes(seed.by) || found.defenders.includes(seed.by))) return null;
      war = found.id;
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
    ...(war ? { war } : {}),
    ...(seed.begins ? { begins: seed.begins } : {}),
    ...(seed.bloc ? { bloc: seed.bloc } : {}),
    ...(seed.side ? { side: seed.side } : {}),
    ...(seed.blocKind ? { blocKind: seed.blocKind } : {}),
    cause: "seeded",
    stage: seed.stage,
    since: date,
    moved: seed.moved && seed.moved < date ? seed.moved : date,
    ...(seed.due ? { due: seed.due } : {}),
  };
}

/** Courses for the countries that matter and have none yet: a new great power, a country at war, a planner. */
/** The countries that keep a course: those that matter (relations.ts actorsOf), and those the date gives a quarrel or an aim of their own, however small. */
function courseHolders(state: GameState, power: Map<string, number>): string[] {
  const seeds = intentionsOf(state.scenarioId, state.variant);
  const seeded = [...Object.keys(seeds.aims), ...Object.keys(seeds.trust ?? {})].filter((tag) => power.has(tag) && tag !== state.player && !state.countries[tag]?.exile);
  return [...new Set([...actorsOf(state, power), ...seeded])].sort();
}

function ensureCourses(state: GameState, power: Map<string, number>): boolean {
  const seeds = intentionsOf(state.scenarioId, state.variant);
  let added = false;
  let occupied: ReturnType<typeof occupiedBy> | undefined;
  for (const tag of courseHolders(state, power)) {
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
  const missing = courseHolders(state, power).some((tag) => state.countries[tag] && !state.countries[tag].course);
  if (!needsPlans && !missing && !opts.map && (!opts.mode || state.mode === opts.mode)) return state;
  const next = structuredClone(state);
  if (opts.mode) next.mode = opts.mode;
  if (needsPlans) {
    const seeds = intentionsOf(scenario.id, state.variant);
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
  /** The period's incidents, cast before it (engine/incidents.ts). */
  incidents: Incident[];
  /** The acts of aggression this turn, judged (engine/aggression.ts). */
  fresh: Fresh[];
  /** Attackers put out of a bloc they shared with their victim this turn: the war, the attacker, the bloc's members left (suspendAttackers). */
  suspended: Suspension[];
  /** The map's provinces, for the light tier's neighbours. */
  map: Record<string, MapRegion> | null;
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
  const room = () => live().filter((p) => p.cause !== "treaty" && isStrategic(p)).length < MAX_LIVE;
  const course = (tag: string) => (tag === player ? undefined : next.countries[tag]?.course);
  // A crisis that opens says what it grew from: the period's incident, a claim, an ambition.
  const opening = (p: Plan): Because | undefined => {
    // The answer to an act of aggression says so: alarm at the attacker, or the world body's call over its war on the victim.
    const answered = p.origin?.startsWith("g") ? next.aggressions?.find((a) => a.id === p.origin) : undefined;
    if (answered) return p.cause === "treaty" ? { kind: answered.body === "un" ? "un-call" : "league-call", country: answered.against } : { kind: "aggression", country: answered.by };
    if (p.kind !== "war") return undefined;
    if (p.cause === "independence" && p.target) return { kind: "breakaway", country: p.target };
    const i = ctx.incidents.find((x) => x.id === p.origin);
    return i ? { kind: "incident", incident: i.what, date: ctx.from.slice(0, 7) } : originOf(next, p);
  };
  const open = (fields: Omit<Plan, "id" | "since" | "moved">, id?: string): Plan => {
    const plan: Plan = { id: id ?? `p${ctx.turn}-${plans.filter((p) => p.id.startsWith(`p${ctx.turn}-`)).length + 1}`, ...fields, since: ctx.to, moved: ctx.to };
    plans.push(plan);
    const shown = shownStage(plan);
    if (shown && shown !== "action") applied.push(change(plan, shown, opening(plan)));
    return plan;
  };
  // What the crises read off the world once a turn (engine/standoffs.ts).
  const world: World = { state: next, power: ctx.power, holders: ctx.holders };
  const lost = ctx.lost;
  const actors = [...actorsOf(next, ctx.power)].filter((t) => course(t)).sort();
  /** A side's principal: its strongest member, whose peace ends the war. */
  const principal = (side: string[]) => [...side].sort((a, b) => (ctx.power.get(b) ?? 0) - (ctx.power.get(a) ?? 0) || a.localeCompare(b))[0];
  /** Where each country's people live, from the map once it is asked for. */
  let centres: Map<string, [number, number]> | null | undefined;

  // The period's incidents land first: tension, memory, and the plan each answer opens (a war plan only while there is room for one).
  applyIncidents(
    next,
    ctx.incidents,
    {
      date: ctx.to,
      open: (fields) => {
        if (fields.by === player || !next.countries[fields.by] || (fields.target && !next.countries[fields.target])) return null;
        if (fields.kind === "war" && (!room() || busy(fields.by, "war") || live().filter((p) => p.kind === "war").length >= WAR_PLANS[era] || closeAllies(next, fields.by, fields.target!))) return null;
        // A neutral answers an incident with a war only on an attacker on its soil.
        if (fields.kind === "war" && isNeutral(next, fields.by) && !onItsSoil(next, fields.by, fields.target!)) return null;
        if (fields.kind !== "war" && live().some((p) => p.by === fields.by && p.kind === fields.kind && p.target === fields.target)) return null;
        return open(fields);
      },
    },
    applied,
  );

  // A new government judges the plans it inherited, and the news says what brought it.
  for (const tag of ctx.changed) {
    const c = course(tag);
    if (!c) continue;
    const how = next.countries[tag]?.domestic?.changed?.how;
    const because: Because = { kind: how === "election" ? "election-lost" : how === "coup" ? "coup" : "new-government" };
    for (const p of live().filter((x) => x.by === tag)) {
      const keep = p.kind === "war" ? c.hawk / 100 : p.kind === "join" ? 0.3 + (c.hawk / 100) * 0.6 : 0.6;
      if (dice(`rejudge:${p.id}`) >= keep) endPlan(next, p, { how: "failed", why: "government", date: ctx.to, because }, ctx.turn, applied);
    }
    const war = next.wars.find((w) => principal(w.attackers) === tag || principal(w.defenders) === tag);
    if (war && c.hawk < 40 && !busy(tag, "peace")) {
      const enemy = principal(war.attackers) === tag ? principal(war.defenders) : principal(war.attackers);
      if (enemy) open({ kind: "peace", by: tag, target: enemy, war: war.id, cause: "new-government", stage: "decision" });
    }
    for (const bloc of next.alliances.filter((a) => isMilitary(a) && a.members.includes(tag) && !isClientBond(next, a))) {
      const lead = bloc.members.filter((m) => m !== tag).sort((a, b) => (ctx.power.get(b) ?? 0) - (ctx.power.get(a) ?? 0))[0];
      if (lead && tieOf(next, tag, lead).trust < -20 && !busy(tag, "leave")) open({ kind: "leave", by: tag, bloc: bloc.id, cause: "new-government", stage: "decision" });
    }
  }

  // A client government fights its patron only in a war of independence or a civil war of its own (Artem, 5 November
  // 2026). One turned against its patron – its trust in it at −50 or worse, or a new government there hostile to it –
  // declares itself independent and the treaty that bound them ends; the patron lets it go or fights to keep it, as its
  // regime, its appetite and its strength decide.
  for (const tag of Object.keys(next.countries).sort()) {
    const client = next.countries[tag].client;
    // A client with no foreign course of its own reads its patron as an ally (relations.ts tieOf) and stays one.
    if (!client || tag === player || next.countries[tag].dormant) continue;
    const patron = client.patron;
    const trust = tieOf(next, tag, patron).trust;
    const fresh = ctx.changed.includes(tag);
    if (trust > -50 && !(fresh && trust <= -20)) continue;
    const how = next.countries[tag].domestic?.changed?.how;
    const because: Because = trust <= -50 ? { kind: "patron", country: patron } : { kind: how === "coup" ? "coup" : how === "election" ? "election-lost" : "new-government" };
    declareIndependence(next, tag, because, applied);
    const pc = course(patron);
    if (!pc || !stands(world, patron) || warBetween(next, patron, tag)) continue;
    const keep = Math.min(0.95, KEEP_CLIENT[regimeOf(next, patron)] * clamp(pc.hawk / 50, 0.2, 2) * clamp(balance(world, patron, tag, []) - 0.5, 0, 1.5));
    if (dice(`open:breakaway:${tag}`) < keep) open({ kind: "war", by: patron, target: tag, cause: "independence", stage: "decision" });
  }

  // The date's plans that wait for a war a seeded plan began (an eve's allies), in both modes, before the treaties call anyone to it.
  for (const seed of intentionsOf(era, next.variant).follow ?? []) {
    if (plans.some((p) => p.id === `seed-${seed.id}`) || !seededWar(next, seed.after ?? seed.war)) continue;
    const plan = fromSeed(next, seed, ctx.to, ctx.holders);
    if (!plan) continue;
    plans.push(plan);
    const shown = shownStage(plan);
    if (shown && shown !== "action") applied.push(change(plan, shown));
  }

  // Allies are called to a war by their treaties to defend the attacked: those of a country attacked, and of every
  // defender that now faces a new enemy – unless it joined the war far from that enemy of its own will. A government
  // that enters a war does not bind its allies to it, nor does an aggressor when others come to its victim's aid;
  // their allies may follow them, as the attacker's allies may, by opportunity.
  for (const c of applied.slice()) {
    if (c.kind !== "war" && c.kind !== "enter") continue;
    const war = next.wars.find((w) => w.id === c.war);
    // A colonial war is the metropole's alone: no treaty calls its allies against its colony's rising (engine/colonies.ts).
    // Nor is a civil war anyone's treaty case: its own recognition, volunteers and interventions decide who comes (engine/civilWar.ts).
    if (!war || (next.colonies ?? []).some((x) => !x.end && x.war === war.id) || civilWarOf(next, war.id)) continue;
    const inWar = (t: string) => war.attackers.includes(t) || war.defenders.includes(t);
    const call = (g: string, side: "attackers" | "defenders", cause: "treaty" | "opportunity") => {
      // Asked once: a government already weighing this war, or that lately refused it, is not asked again. A neutral is not asked.
      if (!course(g) || inWar(g) || isNeutral(next, g) || plans.some((p) => p.kind === "join" && p.by === g && p.war === war.id)) return;
      if (war[side === "attackers" ? "defenders" : "attackers"].some((e) => allied(next, g, e))) return;
      const enemy = principal(war[side === "attackers" ? "defenders" : "attackers"]);
      // A treaty's call against an atomic power is weighed against its bomb: by the dice at its deterrence, half as often by a guardian with bombs of its own.
      if (cause === "treaty" && enemy && dice(`treaty:atom:${g}:${war.id}`) < nuclearShield(next, enemy) * (hasBomb(next, g) ? 0.5 : 1)) return;
      open({ kind: "join", by: g, war: war.id, side, ...(enemy ? { target: enemy } : {}), cause, stage: cause === "treaty" ? "decision" : "tension" });
    };
    // Where the blow falls on a defender: what its enemies hold or fight in of its land, else its province nearest them.
    const land = new Map<string, string[]>();
    const landOf = (m: string) => {
      let ids = land.get(m);
      if (!ids) land.set(m, (ids = warLand(next, war, m, ctx.map, () => (centres ??= ctx.map ? countryCentres(next, ctx.map) : null))));
      return ids;
    };
    // Whether a guardian's bond to a defender binds it here: a treaty in its area, any other bond on the defender's home land only.
    const binds = (g: string, m: string) => {
      if (!ctx.map) return true;
      const ids = landOf(m);
      if (!ids.length) return true;
      const blocs = next.alliances.filter((a) => isMilitary(a) && a.members.includes(g) && a.members.includes(m));
      const areas = blocs.map(areaOf);
      const home = (centres ??= countryCentres(next, ctx.map)).get(m);
      return ids.some((id) => {
        const at = ctx.map![id]?.at;
        if (!at) return true;
        if (areas.some((a) => a && inArea(a, at))) return true;
        // A bond with no area of its own – a bilateral treaty, a pledge – covers the defender's home, not an overseas possession.
        return (areas.some((a) => !a) || !blocs.length) && (!home || distanceKm(home, at) <= HOME_KM);
      });
    };
    // A defender's guardians: its allies and those who gave their word to protect it – but not one already fighting
    // another war at its side, which is not dragged into a second over the same country (Britain and France, at war
    // with Germany over Poland, declared none on the Soviet Union when it invaded too).
    const guardians = (m: string) => {
      const out = new Set(alliesOf(next, m));
      for (const x of Object.values(next.countries)) if (x.course?.aims.some((a) => a.kind === "protect" && a.target === m)) out.add(x.tag);
      // Fighting, or already on its way to fight there: a live plan to enter another war on the country's side.
      const side = (w: War, x: string) => (w.defenders.includes(x) ? "defenders" : w.attackers.includes(x) ? "attackers" : null);
      const fighting = (g: string) =>
        next.wars.some((w) => w.id !== war.id && side(w, m) !== null && side(w, m) === side(w, g)) ||
        live().some((p) => p.kind === "join" && p.by === g && p.war !== war.id && p.side !== undefined && next.wars.some((w) => w.id === p.war && side(w, m) === p.side));
      return [...out].filter((g) => !fighting(g)).sort();
    };
    const follow = (g: string, side: "attackers" | "defenders", enemy: string) => {
      const gc = course(g);
      if (!gc || gc.hawk < 55 || tieOf(next, g, enemy).tension < 40) return;
      // Nobody joins a war against a nuclear power for the opportunity, unless it has the bomb itself (engine/atom.ts).
      if (nuclearShield(next, enemy) >= 0.2 && !next.countries[g]?.arsenal?.nuclear) return;
      if (room() && dice(`open:join:${g}:${war.id}`) < 0.5) call(g, side, "opportunity");
    };
    // Whether a guardian can bring its forces to the war: over land to where the blow falls (or to a defender close by,
    // without the map), or with the ships to reach the enemy (engine/warMeans.ts).
    const reaches = (g: string, m: string, enemy: string) => {
      if (attackMeans(next, g, enemy).reach >= LIMITED) return true;
      if (!ctx.map) return tieOf(next, g, m).near >= 45 || Boolean(tieOf(next, g, m).land);
      const home = (centres ??= countryCentres(next, ctx.map)).get(g);
      return !home || landOf(m).some((id) => {
        const at = ctx.map![id]?.at;
        return !at || distanceKm(home, at) <= REACH_KM;
      });
    };
    // A guardian bound here is called by treaty – unless it cannot reach the war at all (the Falklands from Brussels): it
    // declares itself at most. One whose treaty does not reach this land may still follow by opportunity.
    // A bloc holds a member that attacked another to account only where the rest of it outweighs the attacker: no Latin
    // American state fought the United States over Panama, nor a Warsaw Pact state the Soviet Union over Prague.
    const overawed = (g: string, m: string) => {
      const out = ctx.suspended.filter((s) => s.war === war.id && s.members.includes(g) && s.members.includes(m));
      // Bound to the victim by another bloc or its own word, a guardian is called as ever.
      if (!out.length || sharedBlocs(next, g, m).some((b) => !out.some((s) => s.bloc === b.id)) || next.countries[g]?.course?.aims.some((a) => a.kind === "protect" && a.target === m)) return false;
      return out.every((s) => s.members.reduce((sum, x) => sum + (ctx.power.get(x) ?? 0), 0) <= (ctx.power.get(s.by) ?? 0));
    };
    const guard = (g: string, m: string, enemy: string) => {
      if (!binds(g, m) || overawed(g, m)) follow(g, "defenders", enemy);
      else if (reaches(g, m, enemy)) call(g, "defenders", "treaty");
    };
    if (c.kind === "enter") {
      const other = c.side === "attackers" ? "defenders" : "attackers";
      // Those who joined this war of their own will, earlier or this turn.
      const joiners = new Set([...next.chronicle.flatMap((e) => e.applied), ...applied].flatMap((x) => (x.kind === "enter" && x.war === war.id && x.country !== c.country ? [x.country] : [])));
      // A country that enters a war was not attacked: its allies are not bound to follow it, even into a war at its door
      // (Turkey defending Azerbaijan called all of NATO against Armenia); they may follow it by opportunity.
      for (const g of [...alliesOf(next, c.country)].sort()) follow(g, c.side, war[other][0]);
      // A treaty defends the attacked: the guardians of a defender facing a new enemy are bound to it; an aggressor's
      // allies are not bound to the war it chose when others come to its victim's aid – they may follow it by opportunity.
      for (const m of war[other]) {
        if (joiners.has(m) && tieOf(next, c.country, m).near < 60) continue;
        for (const g of guardians(m)) {
          if (other === "defenders") guard(g, m, c.country);
          else follow(g, other, c.country);
        }
      }
      continue;
    }
    for (const m of war.defenders) for (const g of guardians(m)) guard(g, m, principal(war.attackers));
    for (const a of war.attackers) for (const g of [...alliesOf(next, a)].sort()) follow(g, "attackers", war.defenders[0]);
  }

  // History's dated plans, in the historical mode.
  if (next.mode === "historical") {
    for (const seed of intentionsOf(era, next.variant).dated) {
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
    if (isNeutral(next, tag) && !onItsSoil(next, tag, player)) continue;
    if (balance(world, tag, player, []) < 0.3) continue;
    // A player with the bomb is provoked far less safely (engine/atom.ts).
    if (dice(`provoked:${tag}`) < clamp((sum / 50) * (c.hawk / 50), 0, 0.9) * (1 - nuclearShield(next, player))) open({ kind: "war", by: tag, target: player, cause: "incident", stage: "decision" });
  }

  // War-weary principals seek peace: sooner when their friends turn away from them or trouble grows at home, later while the world stands by them.
  for (const war of next.wars) {
    // A colonial war ends as the colony's way does: the metropole gives in, crushes the rising or lets it go (engine/colonies.ts);
    // a civil war as its own engine ends it (engine/civilWar.ts).
    if ((next.colonies ?? []).some((x) => !x.end && x.war === war.id) || civilWarOf(next, war.id)) continue;
    for (const [tag, enemy] of [
      [principal(war.attackers), principal(war.defenders)],
      [principal(war.defenders), principal(war.attackers)],
    ]) {
      const c = tag ? course(tag) : undefined;
      if (!c || !enemy || busy(tag, "peace") || yearsBetween(war.since, ctx.to) < 0.5) continue;
      const years = yearsBetween(war.since, ctx.to);
      const home = homeIn(lensIn(world), tag);
      // Any government tires of a war that drags on past four years.
      const weary = c.reach < 30 || (lost.get(tag) ?? 0) >= 0.25 || (years >= 3 && c.hawk < 50) || years >= 4 || (home.trouble >= 0.5 && years >= 1);
      if (!weary) continue;
      const side = war.attackers.includes(tag) ? war.attackers : war.defenders;
      const other = side === war.attackers ? war.defenders : war.attackers;
      const sum = (tags: string[]) => tags.reduce((s, x) => s + (ctx.power.get(x) ?? 0), 0);
      const fighting = [...war.attackers, ...war.defenders];
      // Its side with half the weight of everyone who stands by it from outside the war, against the other side with its friends;
      // a country that has lost half its people sues whatever its friends say.
      const stand = (sum(side) + 0.5 * backingOf(lensIn(world), tag, enemy, fighting)) / Math.max(0.01, sum(other) + 0.5 * backingOf(lensIn(world), enemy, tag, fighting));
      const held = ((lost.get(tag) ?? 0) >= 0.5 ? 1.5 : clamp(1.4 - 0.4 * stand, 0.5, 1.5)) * (1 + 0.5 * home.trouble);
      if (dice(`open:peace:${tag}:${war.id}`) < chance((years >= 4 && c.reach >= 30 ? 1 : 2) * held)) open({ kind: "peace", by: tag, target: enemy, war: war.id, cause: "weariness", stage: "decision" });
    }
  }

  // A bloc founded against a threat ends with it: at once when the threat is gone, and a member leaves when none of them
  // fears it any more – about two years after (a treaty past its term lapses, engine/foreign.ts).
  for (const bloc of next.alliances.filter((a) => a.against && (isMilitary(a) || isPact(a)) && !isClientBond(next, a))) {
    const target = bloc.against!;
    if (!stands(world, target)) {
      applied.push({ kind: "alliance-ended", alliance: bloc.id, name: bloc.name, members: [...bloc.members] });
      next.alliances = next.alliances.filter((a) => a !== bloc);
      continue;
    }
    if (bloc.members.some((m) => tieOf(next, m, target).threat >= 30)) continue;
    const by = bloc.members.filter((m) => course(m) && !busy(m, "leave")).sort((a, b) => (ctx.power.get(a) ?? 0) - (ctx.power.get(b) ?? 0) || a.localeCompare(b))[0];
    if (by && dice(`open:dissolve:${bloc.id}`) < chance(0.5)) open({ kind: "leave", by, bloc: bloc.id, cause: "threat", stage: "decision" });
  }

  // A government betrayed by its bloc's leader thinks of leaving it.
  for (const tag of actors) {
    if (busy(tag, "leave")) continue;
    for (const bloc of next.alliances.filter((a) => (isMilitary(a) || isPact(a)) && a.members.includes(tag) && !isClientBond(next, a))) {
      const lead = bloc.members.filter((m) => m !== tag).sort((a, b) => (ctx.power.get(b) ?? 0) - (ctx.power.get(a) ?? 0))[0];
      if (!lead || tieOf(next, tag, lead).trust > -50) continue;
      if (dice(`open:leave:${tag}:${bloc.id}`) < chance(1)) {
        open({ kind: "leave", by: tag, bloc: bloc.id, cause: "incident", stage: "decision" });
        break;
      }
    }
  }

  // Wars: a claim, an ambition, or tension past bearing, weighed by appetite, reach and means – and politics at home:
  // where votes count a government in trouble has no stomach for a war; an autocracy in trouble looks for one.
  const w = world;
  for (const tag of actors) {
    const c = course(tag)!;
    const wars = live().filter((p) => p.kind === "war").length;
    if (wars >= WAR_PLANS[era] || !room()) break;
    if (busy(tag, "war") || c.reach < 20 || next.wars.filter((x) => x.attackers.includes(tag) || x.defenders.includes(tag)).length >= 2) continue;
    const neutral = isNeutral(next, tag);
    const targets = new Map<string, { cause: Plan["cause"]; m: number }>();
    for (const a of c.aims) {
      if ((a.kind === "reclaim" || a.kind === "expand") && a.target) targets.set(a.target, { cause: a.kind === "reclaim" ? "claim" : "ambition", m: a.weight / 50 });
    }
    for (const [other, t] of Object.entries(c.ties)) if (t.tension >= 60 && t.trust <= -30 && !targets.has(other)) targets.set(other, { cause: "incident", m: t.tension / 50 });
    const home = homeIn(lensIn(w), tag);
    const appetite = home.votes ? 1 - 0.6 * home.trouble : 1 + 0.5 * home.trouble;
    let best: { target: string; cause: Plan["cause"]; rate: number } | null = null;
    for (const [target, { cause, m }] of [...targets].sort((a, b) => a[0].localeCompare(b[0]))) {
      if (target === tag || !stands(w, target) || closeAllies(next, tag, target) || warBetween(next, tag, target) || balance(w, tag, target, []) < 0.35) continue;
      // A neutral plans a war only on an attacker on its soil.
      if (neutral && !onItsSoil(next, tag, target)) continue;
      const f = clamp(balance(w, tag, target, []) - 0.3, 0.1, 1.5);
      // Goodwill between the two holds a claim back: détente made no difference to China's crises over Taiwan before.
      // A nuclear power is far less likely to be attacked: its bombs weigh on every plan against it (engine/atom.ts).
      // Members of one bloc seldom come to a quarrel worth a war (the crisis is braked at every step too).
      const rate =
        ((byEra(ERA_WAR, ctx.to) * mode * clamp(Math.max(m, motive(next, { by: tag, target, cause })), 0.3, 2) * (c.hawk / 50) * (c.reach / 50) * f * appetite) / goodwillOf(next, tag, target)) *
        (1 - nuclearShield(next, target)) *
        (allied(next, tag, target) ? 0.3 : 1);
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
  // How close two countries are, 0–100, from where their people live (the map), else as a course's tie says.
  const nearOf = (a: string, b: string) => {
    centres ??= ctx.map ? countryCentres(next, ctx.map) : null;
    const pa = centres?.get(a);
    const pb = centres?.get(b);
    return pa && pb ? Math.round(100 * clamp(1 - (distanceKm(pa, pb) - 600) / 3000, 0.1, 1)) : tieOf(next, a, b).near;
  };
  for (const tag of actors) {
    if (!room()) break;
    const c = course(tag)!;
    if (busy(tag, "bloc")) continue;
    const [threat, t] = Object.entries(c.ties).sort((a, b) => b[1].threat - a[1].threat || a[0].localeCompare(b[0]))[0] ?? [];
    // A country alarmed by the threat's attacks of the past year looks for allies sooner (engine/aggression.ts).
    const alarm = threat ? alarmOf(next, tag, threat) : 0;
    if (!threat || !t || t.threat < (alarm >= 0.5 ? 40 : 50) || allied(next, tag, threat)) continue;
    // A neutral seeks no allies – unless a grave attack next door makes it give its neutrality up for an open alliance
    // (Finland and Sweden in 2022); it founds no bloc of its own.
    const neutral = isNeutral(next, tag);
    if (neutral && (alarm < 1 || t.threat < 60)) continue;
    const covered = [...alliesOf(next, tag)].some((x) => tieOf(next, x, threat).threat >= 35);
    if (covered) continue;
    if (dice(`open:bloc:${tag}:${threat}`) >= chance(0.5 * (t.threat / 50) * mode * (1 + alarm))) continue;
    // A bloc is joined in its own part of the world: near at least one member (their people within ~2,250 km), or not at
    // all (Japan and South Korea joined NATO against China in the statistics runs); far away, a government founds its own.
    // Only an open bloc takes members – no one joins a bilateral treaty – and none where relations with a member are broken
    // or a member is the other half of a divided nation.
    const existing = next.alliances
      .filter(
        (a) =>
          isMilitary(a) &&
          isOpen(a) &&
          !a.members.includes(tag) &&
          !a.members.includes(threat) &&
          a.members.some((m) => tieOf(next, m, threat).threat >= 50) &&
          a.members.some((m) => nearOf(tag, m) >= 45) &&
          !a.members.some((m) => estranged(next, tag, m) || relationsOf(next, tag, m) === "broken"),
      )
      .find((a) => {
        const lead = [...a.members].sort((x, y) => (ctx.power.get(y) ?? 0) - (ctx.power.get(x) ?? 0))[0];
        return tieOf(next, tag, lead).trust >= 10;
      });
    if (existing) {
      if (!unwelcome(w, tag, existing)) open({ kind: "bloc", by: tag, target: threat, bloc: existing.id, cause: "threat", stage: "tension" });
      continue;
    }
    if (neutral) continue;
    // Its partners too come from its own part of the world (Egypt founded a pact with Poland and Romania in 1940): no
    // neutral, none it has broken relations with, none already bound to it by a bloc as strong, and none already planning
    // a bloc with it (one plan for a pair). Two at most, and never two open enemies of each other.
    const blocKind = t.threat >= 65 ? "alliance" : "pact";
    const partners: string[] = [];
    for (const x of actors
      .filter(
        (x) =>
          x !== tag &&
          x !== threat &&
          !allied(next, x, threat) &&
          !warBetween(next, tag, x) &&
          tieOf(next, tag, x).trust >= 0 &&
          tieOf(next, x, threat).threat >= 35 &&
          nearOf(tag, x) >= 45 &&
          !isNeutral(next, x) &&
          !estranged(next, tag, x) &&
          relationsOf(next, tag, x) !== "broken" &&
          !allied(next, tag, x) &&
          !(blocKind === "pact" && pacted(next, tag, x)) &&
          !live().some((q) => q.kind === "bloc" && !q.bloc && q.by === x && q.partners?.includes(tag)),
      )
      .sort((a, b) => tieOf(next, b, threat).threat * (ctx.power.get(b) ?? 0) - tieOf(next, a, threat).threat * (ctx.power.get(a) ?? 0))) {
      if (partners.length >= 2) break;
      if (![tag, ...partners].some((p) => openEnemies(next, p, x))) partners.push(x);
    }
    if (!partners.length) continue;
    open({ kind: "bloc", by: tag, target: threat, partners, blocKind, cause: "threat", stage: "tension" });
  }

  // Vultures: a claim on a country that is losing its war is a reason to enter it.
  for (const war of next.wars) {
    for (const side of ["attackers", "defenders"] as const) {
      for (const x of war[side]) {
        if ((lost.get(x) ?? 0) < 0.15) continue;
        for (const tag of actors) {
          const c = course(tag)!;
          if (!room() || war.attackers.includes(tag) || war.defenders.includes(tag) || allied(next, tag, x) || busy(tag, "join") || isNeutral(next, tag)) continue;
          if (!c.aims.some((a) => (a.kind === "reclaim" || a.kind === "expand") && a.target === x)) continue;
          if (dice(`open:vulture:${tag}:${war.id}`) < chance(c.hawk / 50) * (1 - nuclearShield(next, x))) {
            open({ kind: "join", by: tag, war: war.id, side: side === "attackers" ? "defenders" : "attackers", target: x, cause: "opportunity", stage: "tension" });
          }
        }
      }
    }
  }

  // Crises are talked down as well as up: the side under threat seeks talks, a planner in trouble at home looks for a
  // way out, a mediator presses both. The talks belong to the crisis (their origin), and an accord ends it (settleByTalks).
  for (const p of live().filter((x) => x.kind === "war" && x.target && x.stage !== "incident" && x.stage !== "action")) {
    const target = p.target!;
    if (p.by === player || target === player || !stands(world, target)) continue;
    if (live().some((x) => x.kind === "talks" && ((x.by === p.by && x.target === target) || (x.by === target && x.target === p.by)))) continue;
    const s = standoff(world, p);
    const opener = s.home.votes && s.home.trouble >= 0.4 ? p.by : target;
    const rate = (hawkOf(next, target) < 50 ? 0.6 : 0.25) + 0.8 * (s.mediator?.strength ?? 0) + (s.home.votes ? 0.8 * s.home.trouble : 0) + 2 * s.trade;
    if (dice(`open:crisis-talks:${p.id}`) < chance(rate)) open({ kind: "talks", by: opener, target: opener === p.by ? target : p.by, cause: "tension", origin: p.id, stage: "preparation" });
  }

  // Peaceful decisions, for every government with land: policies at home, sanctions, trade agreements, talks (engine/policies.ts).
  // The world's answer to aggression: sanctions and armament after each new act, the world body's resolutions and what they call for (engine/aggression.ts).
  answerAggression(next, { turn: ctx.turn, from: ctx.from, to: ctx.to, power: ctx.power, holders: ctx.holders, map: ctx.map, dice, open, fresh: ctx.fresh }, applied);
  // The world body takes in the states that came free, and China's seat passes to Beijing on its day.
  growWorldBody(next, { turn: ctx.turn, to: ctx.to, years: ctx.years, holders: ctx.holders }, applied);

  openPeaceful(next, { turn: ctx.turn, to: ctx.to, years: ctx.years, power: ctx.power, holders: ctx.holders, map: ctx.map, changed: ctx.changed, dice, open });
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
  ctx: { turn: number; from: string; to: string; years: number; regions: Record<string, MapRegion> | null; neighbors?: Record<string, string[]> | null; events: GameEvent[]; incidents?: Incident[] },
  applied: AppliedChange[],
): void {
  if (!next.plans) return;
  easeTies(next, ctx.years);
  const holders = landHolders(next);
  const power = powers(next, holders);
  // Courses are judged at the end of the period.
  const at = next.date;
  next.date = ctx.to;
  // Programmes that ran out end before new ones are weighed.
  endProgrammes(next, ctx.to);
  // A state that only now matters – a small one attacked this turn – has a course before the turn's deeds are remembered.
  ensureCourses(next, power);
  learnFromTurn(before, next, applied, ctx.to);
  // An attacker that struck an ally is put out of the blocs it shared with its victim, so the rest are called to the victim's side.
  const suspended = suspendAttackers(next, applied);
  const incidents = ctx.incidents ?? [];
  // The engine's own incidents of the period are told by the game master; its story of them raises no tension twice.
  const told = new Set(incidents.map(incidentParties).filter((x) => x.length === 2).map(([a, b]) => (a < b ? `${a}|${b}` : `${b}|${a}`)));
  const raised = incidentsFromEvents(next, ctx.events, told);
  // A state an incident draws into a war plan or talks keeps a course from now on, as any state in a plan does.
  const seeds = intentionsOf(next.scenarioId, next.variant);
  let occupied: ReturnType<typeof occupiedBy> | undefined;
  for (const tag of [...new Set(incidents.flatMap(incidentParties))].sort()) {
    const c = next.countries[tag];
    if (!c || c.course || tag === next.player || !holders.has(tag)) continue;
    c.course = freshCourse(next, tag, seededFor(next, seeds, tag), ctx.to, (occupied ??= occupiedBy(next)));
  }
  const changed = newGovernments(next, ctx.from);
  // The turn's acts of aggression are judged before the courses look at the world again: condemnation, arms, pledges (engine/aggression.ts).
  const fresh = noteAggression(before, next, applied, { turn: ctx.turn, from: ctx.from, to: ctx.to, power, map: ctx.regions });
  refreshCourses(next, ctx.regions, power, ctx.neighbors);
  openPlans(before, next, { turn: ctx.turn, from: ctx.from, to: ctx.to, years: ctx.years, power, holders, raised, changed, lost: lostShares(next, ctx.regions), incidents, map: ctx.regions, fresh, suspended }, applied);
  next.date = at;
  next.plans = next.plans.filter((p) => !p.end || ctx.turn - p.end.turn < KEEP_ENDED);
}

/** The civil war a war is, if it is one (engine/civilWar.ts). */
const civilWarOf = (state: Pick<GameState, "civilWars">, war: string) => (state.civilWars ?? []).some((cw) => !cw.end && cw.war === war);

/**
 * The land a war on a defender is about: what its enemies hold or fight in of its land, else – nothing taken yet – its
 * province nearest its enemies' home, where the blow falls (the Falklands, not London).
 */
function warLand(state: GameState, war: War, defender: string, map: Record<string, MapRegion> | null, centres: () => Map<string, [number, number]> | null): string[] {
  const enemy = war.attackers.includes(defender) ? war.defenders : war.attackers;
  const held = Object.entries(state.regions)
    .filter(([, r]) => r.owner === defender && (enemy.includes(r.controller) || (r.contested !== undefined && enemy.includes(r.contested))))
    .map(([id]) => id);
  if (held.length || !map) return held;
  const homes = enemy.map((e) => centres()?.get(e)).filter((x): x is [number, number] => Boolean(x));
  if (!homes.length) return [];
  let best: string | undefined;
  let bestKm = Infinity;
  for (const [id, r] of Object.entries(state.regions)) {
    const at = r.owner === defender ? map[id]?.at : undefined;
    if (!at) continue;
    const km = Math.min(...homes.map((h) => distanceKm(h, at)));
    if (km < bestKm || (km === bestKm && best !== undefined && id < best)) {
      best = id;
      bestKm = km;
    }
  }
  return best ? [best] : [];
}

/**
 * An attack on an ally: the attacker is put out of every military bloc it shared with its victim (a bilateral treaty so
 * broken ends), so the bloc's other members are no longer bound to it and are called to the victim's side. The victim
 * remembers the broken bond (engine/relations.ts learnFromTurn).
 */
interface Suspension {
  war: string;
  by: string;
  bloc: string;
  members: string[];
}

function suspendAttackers(next: GameState, applied: AppliedChange[]): Suspension[] {
  const out: Suspension[] = [];
  for (const c of applied.slice()) {
    if (c.kind !== "war") continue;
    const war = next.wars.find((w) => w.id === c.war);
    if (!war || civilWarOf(next, war.id)) continue;
    for (const a of war.attackers) {
      for (const bloc of next.alliances.filter((x) => isMilitary(x) && x.members.includes(a) && war.defenders.some((d) => x.members.includes(d)))) {
        if (bloc.members.length <= 2) {
          applied.push({ kind: "alliance-ended", alliance: bloc.id, name: bloc.name, members: [...bloc.members] });
          next.alliances = next.alliances.filter((x) => x !== bloc);
          continue;
        }
        bloc.members = bloc.members.filter((m) => m !== a);
        applied.push({ kind: "leave", alliance: bloc.id, name: bloc.name, country: a });
        out.push({ war: war.id, by: a, bloc: bloc.id, members: [...bloc.members] });
      }
    }
  }
  return out;
}

const STAGE_TEXT: Record<PlanKind, Partial<Record<PlanStage, string>>> = {
  war: {
    incident: "an INCIDENT this period: show one (a border clash, an insult, a spy scandal)",
    tension: "ESCALATION: demands and threats in public, no shots",
    preparation: "PREPARATION: mobilisation, troops to the border, allies asked",
    decision: "DECISION at the brink: an ultimatum; the order to strike is weighed",
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
  policy: { decision: "weighed in secret", preparation: "drafted and debated in the open" },
  sanction: { tension: "threatened" },
  deal: { preparation: "negotiated" },
  talks: { preparation: "talks under way" },
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
  economy: "the state of its economy",
  politics: "politics at home",
  trade: "trade",
  tension: "tension between them",
  aggression: "an answer to another's aggression",
  independence: "a client government breaking away",
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
  mediation: "a mediator brokered a way back",
  deterred: "the target's backers deterred it",
  economy: "the economy could not bear it",
};

/**
 * The plans that matter this period, for the turn's game master: what
 * reaches action or ends first, then what touches the player, then the
 * rest by how far along it is; and the sharpest tensions between
 * governments, and those turning inward from the wars of their friends.
 */
export function describeIntentions(state: GameState, name: (tag: string) => string, map?: Pick<MapIndex, "regions" | "neighbors"> | null): string[] {
  if (!state.plans) return [];
  const live = state.plans.filter((p) => !p.end && isStrategic(p));
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
  const lens = lensOf(state, power);
  // Every live crisis gets its line; the other plans share what is left of eight.
  const ranked = live.filter((p) => !(moves.get(p.id)?.end?.how === "done")).sort((a, b) => rank(a) - rank(b) || (power.get(b.by) ?? 0) - (power.get(a.by) ?? 0));
  const crises = ranked.filter((p) => p.kind === "war");
  const shown = [...crises, ...ranked.filter((p) => p.kind !== "war").slice(0, Math.max(0, 8 - crises.length))];
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
      default:
        what = peacefulWhat(p, who);
    }
    let now: string;
    const reason = m?.end ? `${END_TEXT[m.end.why]}${m.end.because ? `: ${becauseEn(m.end.because, name)}` : ""}` : "";
    if (m?.end) now = m.end.how === "failed" ? `FAILS this period (${reason}) – tell why` : `FADES this period (${reason}) – tell how tension eased`;
    else if (stage === "action") {
      const on = m?.acts ? ` on ${m.acts}` : "";
      const allies = (p.partners ?? []).filter((x) => !m?.refused?.includes(x));
      switch (p.kind) {
        case "war":
          now = `ACTION${on}: the war begins – put it in warsStarted with attackers ${[p.by, ...allies].join(", ")} and defenders ${p.target}`;
          break;
        case "join":
          now = `ACTION${on}: it enters the war – put it in warsJoined (war ${p.war}, side ${p.side})`;
          break;
        case "bloc":
          now = p.bloc ? `ACTION${on}: it joins – put it in alliancesJoined` : `ACTION${on}: the treaty is signed – put it in alliancesFormed (kind ${p.blocKind ?? "alliance"}, members ${[p.by, ...allies].join(", ")})`;
          break;
        case "leave":
          now = `ACTION${on}: it leaves – put it in alliancesLeft`;
          break;
        case "peace":
          now = m?.accepted === undefined ? `ACTION${on}: it asks the player's government for terms; the player's orders decide` : `ACTION${on}: both sides agree to make peace – end the war in warsEnded (or a truce), with what the terms annex`;
          break;
        default:
          now = `ACTION${on}`;
      }
    } else now = STAGE_TEXT[p.kind][stage] ?? stage.toUpperCase();
    const refused = m?.refused?.length ? `; ${m.refused.map(who).join(", ")} refuse${m.refused.length === 1 ? "s" : ""} to take part` : "";
    // A crisis says what it grew from, and what spurs it on or holds it back (engine/standoffs.ts).
    const origin = p.kind === "war" ? originOf(state, p) : undefined;
    let note = "";
    if (p.kind === "war" && p.target && !m?.end && stage !== "action") {
      const s = standoffOf(lens, p);
      const spurs = spursOf(s).map((b) => becauseEn(b, name));
      const brakes = brakesOf(s, guarantee(lens, s, p.by)).map((b) => becauseEn(b, name));
      note = `${spurs.length ? `; for: ${spurs.join(", ")}` : ""}${brakes.length ? `; against: ${brakes.join(", ")}` : ""}`;
    }
    lines.push(`- ${who(p.by)} ${what} (${origin ? becauseEn(origin, name) : CAUSE_TEXT[p.cause]}): ${now}${refused}${note}`);
  }
  // The sharpest tensions besides the crises already told, each pair once, from the side that feels it most.
  const crisisPairs = new Set(crises.flatMap((p) => [`${p.by}|${p.target}`, `${p.target}|${p.by}`]));
  const byPair = new Map<string, { a: string; b: string; tension: number; trust: number }>();
  for (const c of Object.values(state.countries)) {
    for (const [other, t] of Object.entries(c.course?.ties ?? {})) {
      if (t.tension < 40 || warBetween(state, c.tag, other) || crisisPairs.has(`${c.tag}|${other}`)) continue;
      const key = c.tag < other ? `${c.tag}|${other}` : `${other}|${c.tag}`;
      const had = byPair.get(key);
      if (!had || t.tension > had.tension || (t.tension === had.tension && c.tag < had.a)) byPair.set(key, { a: c.tag, b: other, tension: t.tension, trust: t.trust });
    }
  }
  const tensions = [...byPair.values()].sort((x, y) => y.tension - x.tension || x.a.localeCompare(y.a)).slice(0, 5);
  const belligerents = new Set(state.wars.flatMap((w) => [...w.attackers, ...w.defenders]));
  const inward = Object.values(state.countries)
    .filter((c) => c.course && c.course.reach < 30 && !belligerents.has(c.tag) && [...belligerents].some((b) => allied(state, c.tag, b) || (c.course!.ties[b]?.trust ?? 0) >= 30))
    .sort((a, b) => (power.get(b.tag) ?? 0) - (power.get(a.tag) ?? 0))
    .slice(0, 4);
  const rel = relevanceOf(state, power, map?.neighbors);
  const peaceful = describePeaceful(state, moves, power, who, rel);
  const incidents = describeIncidents(castIncidents(state, map?.regions, map?.neighbors), name, rel);
  const answer = describeAggression(state, name);
  if (!lines.length && !tensions.length && !inward.length && !peaceful.length && !incidents.length && !answer.length) return [];
  const out = ["", "INTENTIONS ABROAD (the engine's plans and the stage each reaches this period, already decided – tell them in the story; wars, war entries and military alliances or pacts among other governments come only from here, any other is dropped; a war plan is a crisis, with what spurs it on and holds it back):"];
  out.push(...(lines.length ? lines : ["- no plan is under way"]));
  out.push(...incidents, ...peaceful, ...answer);
  if (tensions.length) out.push(`SHARPEST TENSIONS (tension, trust): ${tensions.map((x) => `${x.a} → ${x.b} ${x.tension}, ${x.trust}`).join("; ")}`);
  if (inward.length) out.push(`TURNED INWARD (crisis or weariness: they help their friends at war less): ${inward.map((c) => `${who(c.tag)} reach ${c.course!.reach}`).join("; ")}`);
  return out;
}

/**
 * Who the game master's lines matter to: the player, its neighbours (who
 * own land next to its own; without the map, those whose course sees it
 * close) and the great powers.
 */
function relevanceOf(state: GameState, power: Map<string, number>, neighbors?: Record<string, string[]> | null): Relevance {
  const near = neighbors ? landNeighbours(state, neighbors, state.player) : new Set(Object.values(state.countries).filter((c) => (c.course?.ties[state.player]?.near ?? 0) >= 70).map((c) => c.tag));
  return { player: state.player, near, great: greatPowers(power) };
}

/**
 * The period's peaceful moves that matter, in one line: what is adopted,
 * imposed, signed or agreed, what comes into the open, what fails – those
 * touching the player first, then its neighbours' and the great powers',
 * then by the strength of who moves; at most eight.
 */
function describePeaceful(state: GameState, moves: Map<string, PlanMove>, power: Map<string, number>, who: (tag: string) => string, rel: Relevance): string[] {
  const items: { p: Plan; m: PlanMove; rank: number }[] = [];
  for (const p of state.plans ?? []) {
    const m = moves.get(p.id);
    if (p.end || !m || isStrategic(p)) continue;
    const acts = m.stage === "action" && !m.end;
    const fails = m.end && m.end.how !== "done" && told(state, p);
    const opens = !m.end && m.passed.some((s) => shownStage(p) === s.stage && s.stage !== "action") && Boolean(state.countries[p.by]?.course);
    if (!acts && !fails && !opens) continue;
    const mine = p.target === state.player || p.by === state.player;
    const close = [p.by, p.target].some((t) => t !== undefined && rel.near.has(t));
    const great = [p.by, p.target].some((t) => t !== undefined && rel.great.has(t));
    items.push({ p, m, rank: (mine ? 0 : close ? 1.5 : great ? 2 : 3) + (acts ? 0 : fails ? 1 : 2) - (power.get(p.by) ?? 0) });
  }
  if (!items.length) return [];
  const shown = items.sort((a, b) => a.rank - b.rank || a.p.id.localeCompare(b.p.id)).slice(0, 8);
  const text = shown.map(({ p, m }) => {
    const kind = p.kind as keyof typeof PEACEFUL_ACTION;
    const action = p.kind === "sanction" && p.lift ? "LIFTED" : PEACEFUL_ACTION[kind];
    const what = p.kind === "sanction" ? `sanctions on ${who(p.target ?? "?")}` : peacefulWhat(p, who);
    const now = m.stage === "action" && !m.end ? `${action}${m.acts ? ` ${m.acts}` : ""}` : m.end ? `fails (${END_TEXT[m.end.why]})` : (STAGE_TEXT[p.kind][m.stage] ?? m.stage);
    return `${who(p.by)}: ${what} ${now}${p.origin?.startsWith("i") ? " (after the incident)" : ""}`;
  });
  return [`PEACEFUL MOVES (also the engine's and decided; it applies their effects to budgets, growth, regimes, sanctions and trade agreements – tell the notable ones in a phrase and put none of them in your answer): ${text.join("; ")}`];
}

/** What other governments do in the open, for the ministers who watch abroad: plans past the secret decision, those touching the player first, then strategic ones, then the strongest governments' peaceful ones. */
export function describeVisiblePlans(state: GameState, name: (tag: string) => string): string[] {
  const visible = (state.plans ?? []).filter((p) => !p.end && shownStage(p) && told(state, p));
  if (!visible.length) return [];
  const mine = (p: Plan) => p.target === state.player || p.partners?.includes(state.player);
  const power = powers(state);
  const who = (tag: string) => `${name(tag)} [${tag}]`;
  const lines = visible
    .sort((a, b) => Number(mine(b)) - Number(mine(a)) || Number(isStrategic(b)) - Number(isStrategic(a)) || (power.get(b.by) ?? 0) - (power.get(a.by) ?? 0) || a.id.localeCompare(b.id))
    .slice(0, 8)
    .map((p) => (isPeaceful(p.kind) ? `- ${who(p.by)}: ${peacefulWhat(p, who)}, ${STAGE_TEXT[p.kind][shownStage(p)!] ?? shownStage(p)} since ${p.moved}` : `- ${who(p.by)}: ${p.kind}${p.target ? ` → ${who(p.target)}` : ""}, ${shownStage(p)} since ${p.moved}`));
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
  if (own.length) lines.push(`- your plans: ${own.map((p) => (isPeaceful(p.kind) ? `${peacefulWhat(p, name)}, ${p.stage}` : `${p.kind}${p.target ? ` against ${name(p.target)}` : ""}${p.partners?.length ? ` with ${p.partners.map(name).join(", ")}` : ""}, ${p.stage}`)).join("; ")}`);
  return lines;
}

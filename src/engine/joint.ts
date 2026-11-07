import { roll } from "./dice";
import { addStep, yearOf } from "./calendar";
import { byYear, POSTURE_RANK } from "./doctrine";
import { distanceKm } from "./provinces";
import { debtNorm, payOffBudget, STEP_YEARS } from "./economy";
import { governs } from "./figures";
import { atomRate, hasBomb, nextStage, STAGE_WORK } from "./atom";
import { relationsOf } from "./envoys";
import { addTension, alliesOf, allied, isMilitary, pacted, powers, raiseAlarm, remember, tieOf, warBetween } from "./relations";
import { accessTo } from "./remit";
import { breakthroughsOf, playerAtomRate, researchMoney, researchRate } from "./research";
import { techYear, yearFraction } from "./researchEffects";
import { MILESTONES, needYear, researchPool, spaceMoney, spaceRate } from "./space";
import { JOINT_HISTORY, type JointHistory } from "./scenarios/joint";
import { en } from "./text";
import { SPACE_MILESTONES } from "./types";
import type { AppliedChange, DelegationVote, GameState, JointAction, JointKind, JointReason, MapIndex, MapRegion, Plan, ProjectKind, ResearchDirection, War } from "./types";
import type { PlannedUnit } from "./formations";

/**
 * Joint actions with allies. The player's government proposes to an ally,
 * or to the members of a bloc, an action of one of ten kinds:
 *
 * - a joint offensive: both formations on neighbouring sectors of a war's
 *   front attack at once where the lines meet, each the stronger for it
 *   (JOINT_EDGE), the enemy unable to shift its reserves from one to the
 *   other; for the turn it is due, the edge counted over the weeks such a
 *   push lasts;
 * - a joint operation: air and naval forces flown for an ally's war, its
 *   formations there the stronger for it while the operation runs, the
 *   supporter's aircraft worn down and the enemy's anger earned;
 * - joint manoeuvres that warn a rival: trust among the members, threat felt
 *   by the rival, its war plans against them sometimes given up;
 * - joint research in one direction, a joint space or atomic programme: each
 *   member's money counts for the others, less a quarter lost to
 *   coordination (LOSS); the player's direction or programme goes at the
 *   pace the pooled money buys, the partner gains what is learnt; a feat in
 *   space is the pride of every member; an atomic programme shares the
 *   bomb's design with every member, or leaves it with the lead;
 * - a joint economic project – a pipeline, a canal, a plant, an airliner, a
 *   railway, a tunnel – built over years, every member paying its share of
 *   its economy, every member's economy the larger once it is built;
 * - a joint note to a government, which yields or rejects it by the dice
 *   and the members' weight; sanctions imposed together, which bite harder
 *   than one government's (engine/trade.ts); one line at the world body on
 *   an aggressor, the partner's delegation voting with the player's
 *   (engine/aggression.ts).
 *
 * The ally answers at once by the engine's dice, from its ties to the
 * player, its interests, its means and its course (appraiseJoint, in the
 * style of engine/negotiation.ts); the same reckoning without the dice tells
 * the player the likely answer. Agreed actions are carried out by the
 * engine. Other governments run joint actions among themselves now and then
 * – a joint offensive of allies in a war, a bloc's manoeuvres, a project of
 * an economic community, a space programme, sanctions an ally joins – and
 * offer some to the player; in the historical mode history's own open on
 * their days (scenarios/joint.ts). What the period holds is cast before the
 * turn (castJoint) and told to the game master; it lands after the turn
 * (advanceJoint). Kept in GameState.joint (save step 52).
 */

/** Doublings of strength a joint offensive adds to each formation in it, and the months such a push lasts within a turn. */
export const JOINT_EDGE = 0.2;
const OFFENSIVE_MONTHS = 2;
/** The most an operation's air and sea cover adds to the supported formations' attacks. */
const OPERATION_EDGE = 0.15;
/** Of pooled money, the share lost to coordination: committees, two languages, work done twice. */
export const LOSS = 0.25;
/** Of a supporter's aircraft, the share lost a month while its operation runs. */
const AIR_ATTRITION = 0.01;
/** Years an ended action stays for the panel, and at most how many are kept. */
const KEEP_YEARS = 2;
const MAX_KEPT = 30;
/**
 * Years a pair is not asked again after an offer it let lapse or turned down, or a project it built: projects, pooled
 * research and programmes three and a half, an offensive one (the world audit's finding 17); the player's offers that
 * ended so are kept that long for it.
 */
const PAUSE_YEARS: Record<JointKind, number> = { offensive: 1, operation: 1, exercise: 1, research: 3.5, space: 3.5, atom: 3.5, project: 3.5, note: 1, sanctions: 1, line: 1 };
/** The player is offered a community's project at most once in this many years. */
const PLAYER_PROJECT_YEARS = 3;
/** Closeness (engine/relations.ts) from which two countries with no land between them count as neighbours across a sea: about 1,200 km. */
const NEIGHBOUR_NEAR = 80;

/** Who can pay for a project now: not at war on its own soil, its debt within twice the era's norm. */
function meansFor(state: GameState): (tag: string) => boolean {
  const atHome = new Set<string>();
  const fighting = new Set(state.wars.filter((w) => !w.truce).flatMap((w) => [...w.attackers, ...w.defenders]));
  for (const r of Object.values(state.regions)) if (fighting.has(r.owner) && (r.contested || r.controller !== r.owner)) atHome.add(r.owner);
  const norm = debtNorm(state.scenarioId);
  return (tag) => {
    const e = state.countries[tag]?.economy;
    return !atHome.has(tag) && (!e || e.debt <= 2 * norm * Math.max(0.01, e.gdp));
  };
}
/** The term of each kind, years, when the proposal names none (none for one held once, or built until done). */
export const TERM_YEARS: Record<JointKind, number> = { offensive: 0, operation: 0.5, exercise: 0, research: 5, space: 5, atom: 5, project: 0, note: 0, sanctions: 2, line: 2 };
/** What each project takes to build, what each member pays a year as a share of its economy, and what it adds to its economy once built. */
export const PROJECTS: Record<ProjectKind, { years: number; cost: number; gain: number; prestige?: number }> = {
  pipeline: { years: 4, cost: 0.0015, gain: 0.004 },
  canal: { years: 8, cost: 0.002, gain: 0.005 },
  plant: { years: 5, cost: 0.001, gain: 0.003 },
  aircraft: { years: 12, cost: 0.0013, gain: 0.001, prestige: 6 },
  railway: { years: 6, cost: 0.0015, gain: 0.004 },
  tunnel: { years: 8, cost: 0.0012, gain: 0.003 },
};
/** The kinds fought in a war, held once, pooled in research, and aimed at a government. */
const WAR_KINDS: ReadonlySet<JointKind> = new Set(["offensive", "operation"]);
const ONCE: ReadonlySet<JointKind> = new Set(["offensive", "exercise", "note"]);
const AIMED: ReadonlySet<JointKind> = new Set(["operation", "exercise", "note", "sanctions", "line"]);
const MILITARY_KINDS: ReadonlySet<JointKind> = new Set(["offensive", "operation", "exercise"]);

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round2 = (v: number) => Math.round(v * 100) / 100;
const round3 = (v: number) => Math.round(v * 1000) / 1000;
const round4 = (v: number) => Math.round(v * 10000) / 10000;
const gameOf = (state: Pick<GameState, "seed" | "id">) => state.seed ?? state.id;
const DAY = 86_400_000;
const yearsBetween = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / (365.25 * DAY);
/** A date some years after another (before it, when negative), to the month, on the same day or the month's last. */
export function yearsAfter(date: string, years: number): string {
  const d = new Date(Date.parse(date));
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + Math.round(years * 12));
  d.setUTCDate(Math.min(day, new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()));
  return d.toISOString().slice(0, 10);
}
/** The first of the month a fractional year falls in. */
function monthOf(year: number): string {
  const y = Math.floor(year);
  const m = Math.min(12, Math.floor((year - y) * 12 + 1e-6) + 1);
  return `${y}-${String(m).padStart(2, "0")}-01`;
}

const stands = (state: Pick<GameState, "countries">, tag: string) => {
  const c = state.countries[tag];
  return Boolean(c && !c.dormant && c.economy);
};

/** The side of a war a country fights on, or null. */
function sideOf(war: Pick<War, "attackers" | "defenders">, tag: string): string[] | null {
  return war.attackers.includes(tag) ? war.attackers : war.defenders.includes(tag) ? war.defenders : null;
}
const enemySide = (war: Pick<War, "attackers" | "defenders">, tag: string) => (war.attackers.includes(tag) ? war.defenders : war.defenders.includes(tag) ? war.attackers : null);

/** Whether an action is under way now: agreed, and begun by this date. */
export const isLive = (j: Pick<JointAction, "status" | "from">, date: string) => j.status === "active" && (!j.from || j.from <= date);

// ——— Where two lines meet ———

/**
 * Where two allies' lines meet in a war: the enemy's provinces next to land
 * both hold or fight in, or, where their lines only touch each other, next to
 * either's land beside the other's. Nearest the joint first, at most `limit`.
 */
export function meetingPoints(state: Pick<GameState, "regions">, index: Pick<MapIndex, "neighbors">, war: Pick<War, "attackers" | "defenders">, a: string, b: string, limit = 8): string[] {
  const enemy = enemySide(war, a);
  if (!enemy || !sideOf(war, b) || sideOf(war, b) !== sideOf(war, a)) return [];
  const held = (tag: string, id: string) => {
    const r = state.regions[id];
    return Boolean(r && (r.controller === tag || r.contested === tag));
  };
  const hostile = (id: string) => {
    const r = state.regions[id];
    return Boolean(r && (enemy.includes(r.controller) || (r.contested !== undefined && enemy.includes(r.contested))));
  };
  const near = (tag: string, id: string) => held(tag, id) || (index.neighbors[id] ?? []).some((n) => held(tag, n));
  const both: string[] = [];
  const touching: string[] = [];
  for (const id of Object.keys(state.regions)) {
    if (!hostile(id)) continue;
    const na = near(a, id);
    const nb = near(b, id);
    if (na && nb) both.push(id);
    else if (na || nb) {
      // Next to one ally's land that itself touches the other's.
      const own = na ? a : b;
      const other = na ? b : a;
      if ((index.neighbors[id] ?? []).some((n) => held(own, n) && (index.neighbors[n] ?? []).some((m) => held(other, m)))) touching.push(id);
    }
  }
  return [...both.sort(), ...touching.sort()].slice(0, limit);
}

/** The wars in which two governments fight side by side. */
export function sharedWars(state: Pick<GameState, "wars">, a: string, b: string): War[] {
  return state.wars.filter((w) => !w.truce && sideOf(w, a) && sideOf(w, a) === sideOf(w, b));
}

// ——— The ally's view ———

export type JointStance = "eager" | "cool" | "reluctant";

export interface JointAppraisal {
  stance: JointStance;
  /** What weighs most in its stance. */
  why: JointReason;
  /** The chance it agrees, 0–1. */
  chance: number;
  likely: "agree" | "refuse";
  /** It will not take part at all, and why. */
  blocked?: JointReason;
}

/** What the player proposes: the kind, to whom, and what it is about. */
export interface JointDraft {
  kind: JointKind;
  /** The ally, or a bloc's members. */
  partners: string[];
  target?: string;
  war?: string;
  at?: string;
  direction?: ResearchDirection;
  project?: ProjectKind;
  scope?: "partial" | "full";
  vote?: DelegationVote;
  share?: "equal" | "lead";
  /** Its term, years; an offensive put off to the turn after next with `later`. */
  years?: number;
  later?: boolean;
}

/** Joint actions the player walked out of in the last three years: its name as a partner. */
function walkedOut(state: Pick<GameState, "joint" | "date" | "player">): number {
  const since = yearsAfter(state.date, -3);
  return (state.joint ?? []).filter((j) => j.status === "ended" && j.reason === "withdrawn" && j.members.includes(state.player) && (j.ended ?? j.since) >= since).length;
}

/** Whether two governments share a bloc of any kind but the world bodies. */
const coMembers = (state: Pick<GameState, "alliances">, a: string, b: string) => state.alliances.some((x) => x.members.length < 40 && x.members.includes(a) && x.members.includes(b));

/** One government is the other's rival: allied to its enemy, or deeply distrustful. */
function rivalOf(state: GameState, a: string, b: string): boolean {
  const enemies = new Set(state.wars.flatMap((w) => enemySide(w, b) ?? []));
  if ([...alliesOf(state, a)].some((x) => enemies.has(x))) return true;
  return tieOf(state, a, b).trust <= -30;
}

const regimeOf = (state: GameState, tag: string) => (tag === state.player ? undefined : state.countries[tag]?.domestic?.regime);

/**
 * What a government makes of a joint action proposed to it: its stance and
 * why, the chance it agrees, its likely answer; or that it will not take part
 * at all. `by` is the proposer, the player when missing.
 */
export function appraiseJoint(state: GameState, draft: JointDraft, partner: string, index?: Pick<MapIndex, "neighbors"> | null, by = state.player): JointAppraisal {
  const no = (blocked: JointReason): JointAppraisal => ({ stance: "reluctant", why: blocked, chance: 0, likely: "refuse", blocked });
  const c = state.countries[partner];
  if (partner === by || !c || !stands(state, partner)) return no("member");
  if (warBetween(state, partner, by)) return no("war");
  // Nothing done together while relations are broken; with the ambassadors recalled a government is cold (engine/envoys.ts).
  const relations = relationsOf(state, partner, by);
  if (relations === "broken") return no("relations");
  if (draft.target && (draft.target === partner || !state.countries[draft.target])) return no("target");
  const tie = tieOf(state, partner, by);
  const trust = tie.trust / 100;
  // Allies, or co-belligerents against the same enemy, as Britain and America were at Quebec.
  const bound = allied(state, partner, by) || sharedWars(state, partner, by).length > 0;
  const bond = bound ? 0.2 : pacted(state, partner, by) ? 0.1 : coMembers(state, partner, by) ? 0.05 : 0;
  const hawk = c.course?.hawk ?? 50;
  const reach = c.course?.reach ?? 50;
  const parts: [JointReason, number][] = [
    [trust + bond >= 0 ? "ties" : "distrust", 0.45 * trust + bond],
    ["tension", -0.3 * (tie.tension / 100)],
    ["reputation", -0.08 * Math.min(5, by === state.player ? walkedOut(state) : 0)],
  ];
  if (relations === "recalled") parts.push(["relations", -0.15]);
  const add = (why: JointReason, v: number) => {
    if (v) parts.push([why, v]);
  };
  const toward = (x: string) => tieOf(state, partner, x);
  const aimed = (target: string) => {
    // What a government feels about the target of a note, sanctions or manoeuvres: danger and anger for, trust and trade against.
    const t = toward(target);
    add(t.threat + t.tension >= 30 - t.trust ? "interest" : "noInterest", 0.004 * t.threat + 0.003 * t.tension - 0.003 * t.trust - 0.1);
    add("trade", -((t.trade ?? 0) / 100) * (draft.kind === "sanctions" ? 2.5 : 0.8));
    // A target that attacks the partner's ally or a country it protects, or stands accused of aggression, makes the case.
    const friends = new Set([...alliesOf(state, partner), ...(c.course?.aims ?? []).filter((a) => a.kind === "protect" && a.target).map((a) => a.target!)]);
    const fights = state.wars.some((w) => !w.truce && (enemySide(w, target) ?? []).some((x) => friends.has(x)));
    const accused = (state.aggressions ?? []).some((g) => g.by === target && !g.closed);
    if (fights || accused) add("interest", 0.2);
  };
  if (MILITARY_KINDS.has(draft.kind)) {
    add(hawk >= 50 ? "hawk" : "dove", (hawk - 50) / 200);
    if (reach < 35) add("inward", -0.15);
  }

  switch (draft.kind) {
    case "offensive": {
      const war = state.wars.find((w) => w.id === draft.war);
      if (!war || war.truce || !sideOf(war, partner) || sideOf(war, partner) !== sideOf(war, by)) return no("notAtWar");
      if (index) {
        const points = meetingPoints(state, index, war, by, partner);
        if (!points.length || (draft.at && !points.includes(draft.at))) return no("noFront");
      }
      add("interest", 0.2);
      // A government whose people are tired of the war, or that holds back, goes in less readily.
      if (reach < 30) add("weary", -0.15);
      break;
    }
    case "operation": {
      const war = state.wars.find((w) => w.id === draft.war);
      if (!war || war.truce) return no("notAtWar");
      const ours = sideOf(war, by) ?? sideOf(war, partner);
      if (!ours) return no("notAtWar");
      const theirs = ours === war.attackers ? war.defenders : war.attackers;
      if (theirs.includes(partner) || theirs.includes(by)) return no("friend");
      if (theirs.some((t) => allied(state, partner, t))) return no("friend");
      const fights = ours.includes(partner);
      if (fights) add("interest", 0.35);
      else {
        // Its own aircraft and ships over another's war: a risk of being drawn in, worth it against an enemy it fears.
        const air = (c.arsenal?.stock?.aircraft?.n ?? 0) + (c.arsenal?.stock?.ships?.n ?? 0);
        if (air < 20) return no("cost");
        const worst = Math.max(0, ...theirs.map((t) => toward(t).threat + toward(t).tension - toward(t).trust));
        add(worst >= 40 ? "interest" : "noInterest", worst / 300 - 0.2);
      }
      break;
    }
    case "exercise": {
      if (!draft.target) return no("target");
      if (allied(state, partner, draft.target)) return no("friend");
      aimed(draft.target);
      if (!bound) add("noInterest", -0.15);
      break;
    }
    case "note": {
      if (!draft.target) return no("target");
      if (allied(state, partner, draft.target)) return no("friend");
      aimed(draft.target);
      break;
    }
    case "sanctions": {
      if (!draft.target) return no("target");
      if (allied(state, partner, draft.target)) return no("friend");
      // A pact with the target – friendship, or a treaty on arms – weighs against, but binds no one to its trade.
      if (pacted(state, partner, draft.target)) add("friend", -0.15);
      aimed(draft.target);
      if ((state.sanctions ?? []).some((s) => s.by === partner && s.against === draft.target)) add("interest", 0.3);
      if (regimeOf(state, partner) === "democracy") add("interest", 0.08);
      if (draft.scope === "full") add("cost", -0.1);
      break;
    }
    case "line": {
      if (!draft.target) return no("target");
      const friend = allied(state, partner, draft.target) || toward(draft.target).trust >= 40;
      if (draft.vote === "condemn" && friend) return no("friend");
      if (draft.vote === "condemn" && pacted(state, partner, draft.target)) add("friend", -0.15);
      if (draft.vote === "oppose") add(friend ? "interest" : "noInterest", friend ? 0.2 : -0.003 * Math.max(0, toward(draft.target).tension - toward(draft.target).trust) - 0.15);
      else if (draft.vote === "condemn") aimed(draft.target);
      break;
    }
    case "research":
    case "space":
    case "atom": {
      if (rivalOf(state, partner, by)) return no("distrust");
      const theirs = draft.kind === "space" ? spaceMoney(state, partner) || researchPool(state, partner) * 0.02 : researchPool(state, partner);
      const ours = draft.kind === "space" ? spaceMoney(state, by) || researchPool(state, by) * 0.02 : researchPool(state, by);
      const giving = theirs + ours > 0 ? (theirs - ours) / (theirs + ours) : 0;
      // A government that would put in more than it gets weighs what it gives away; a smaller one is glad of the larger's work.
      if (giving > 0) add("giving", -0.35 * giving);
      else add("interest", 0.2 * -giving);
      const secret = draft.kind === "atom" || draft.direction === "military" || draft.direction === "strategic";
      if (secret) add("secrecy", bound ? -0.05 : -0.25);
      const ra = regimeOf(state, partner);
      const rb = regimeOf(state, by) ?? state.countries[by]?.domestic?.regime;
      if (ra && rb && (ra === "democracy") !== (rb === "democracy")) add("secrecy", -0.1);
      if (draft.kind === "space") add("interest", state.space?.programmes[partner]?.share ? 0.1 : 0.05);
      if (draft.kind === "atom") {
        const theyHave = hasBomb(state, partner);
        const weHave = hasBomb(state, by);
        if (theyHave && !weHave) {
          // Handing the bomb to another: before the treaty a great power did it only for a close ally, after it never.
          if (state.date >= "1968-07-01") return no("proliferation");
          add("proliferation", draft.share === "lead" ? -0.15 : -0.35);
        } else if (theyHave && weHave) add("interest", 0.1);
        if (!bound) add("secrecy", -0.2);
      }
      break;
    }
    case "project": {
      const kind = draft.project ?? "pipeline";
      add("interest", 0.12 + 0.25 * (tie.near / 100) + Math.min(0.2, (tie.trade ?? 0) / 100));
      const e = c.economy!;
      const due = PROJECTS[kind].cost * e.gdp * PROJECTS[kind].years;
      if (e.debt > 0.9 * e.gdp) add("cost", -0.2);
      if (e.reserves < due * 0.5) add("cost", -0.1);
      break;
    }
  }
  const sum = parts.reduce((s, [, v]) => s + v, 0);
  const stance: JointStance = sum >= 0.25 ? "eager" : sum <= -0.1 ? "reluctant" : "cool";
  const ranked = [...parts].sort((a, b) => (stance === "eager" ? b[1] - a[1] : a[1] - b[1]));
  const why: JointReason = stance === "eager" || ranked[0][1] < -0.02 ? ranked[0][0] : "fair";
  const chance = round2(clamp(0.5 + sum, 0.03, 0.97));
  return { stance, why, chance, likely: chance >= 0.5 ? "agree" : "refuse" };
}

// ——— The player's proposals ———

/** Whether the player's government may propose joint actions: it governs, and governs foreign affairs. */
export function mayPropose(state: GameState): boolean {
  return governs(state) && accessTo(state, "foreign") === "govern" && !state.defeat;
}

/** The same action already under way or waiting, or turned down by these partners this turn. */
function duplicate(state: GameState, d: JointDraft): boolean {
  return (state.joint ?? []).some(
    (j) =>
      j.kind === d.kind &&
      j.members.includes(state.player) &&
      (j.status === "active" || j.status === "proposed" || (j.status === "refused" && j.turn === state.turn && d.partners.some((p) => j.members.includes(p) || j.declined?.includes(p)))) &&
      (j.target ?? "") === (d.target ?? "") &&
      (j.war ?? "") === (d.war ?? "") &&
      (j.direction ?? "") === (d.direction ?? "") &&
      (j.kind !== "project" || j.project === d.project) &&
      (j.kind !== "offensive" || j.at === d.at),
  );
}

/** A proposal cleaned up: partners that exist, what it is about known; null when there is nothing to propose. */
export function sanitizeDraft(state: GameState, d: JointDraft, index?: Pick<MapIndex, "neighbors"> | null): JointDraft | null {
  const partners = [...new Set(d.partners)].filter((p) => p !== state.player && stands(state, p)).slice(0, 12);
  if (!partners.length) return null;
  const out: JointDraft = { kind: d.kind, partners };
  if (AIMED.has(d.kind) && d.kind !== "operation") {
    if (!d.target || !state.countries[d.target] || d.target === state.player) return null;
    out.target = d.target;
  }
  if (WAR_KINDS.has(d.kind)) {
    const war = state.wars.find((w) => w.id === d.war && !w.truce);
    if (!war) return null;
    out.war = war.id;
    if (d.kind === "offensive") {
      if (!sideOf(war, state.player)) return null;
      const points = index ? partners.flatMap((p) => meetingPoints(state, index, war, state.player, p)) : [];
      const at = d.at && (!index || points.includes(d.at)) ? d.at : points[0];
      if (at) out.at = at;
      if (d.later) out.later = true;
      out.target = enemySide(war, state.player)![0];
    } else {
      const ours = sideOf(war, state.player) ?? partners.map((p) => sideOf(war, p)).find(Boolean);
      if (!ours) return null;
      out.target = (ours === war.attackers ? war.defenders : war.attackers)[0];
    }
  }
  if (d.kind === "research") out.direction = d.direction ?? "science";
  if (d.kind === "project") out.project = d.project ?? "pipeline";
  if (d.kind === "sanctions") out.scope = d.scope === "full" ? "full" : "partial";
  if (d.kind === "line") out.vote = d.vote ?? "condemn";
  if (d.kind === "atom") out.share = d.share === "equal" ? "equal" : "lead";
  if (!ONCE.has(d.kind) && d.kind !== "project") out.years = clamp(Math.round((d.years ?? TERM_YEARS[d.kind]) * 4) / 4, 0.25, 10);
  return out;
}

/** The next free id for an action begun this turn. */
function nextId(state: Pick<GameState, "joint" | "turn">, prefix = "j"): string {
  const taken = new Set((state.joint ?? []).map((j) => j.id));
  let n = 1;
  while (taken.has(`${prefix}${state.turn}-${n}`)) n++;
  return `${prefix}${state.turn}-${n}`;
}

/** An action as agreed: its term, its cost, from when. */
function agreed(state: GameState, j: JointAction, terms: { years?: number; later?: boolean } = {}): JointAction {
  const out: JointAction = { ...j, status: "active" };
  if (j.kind === "offensive" && j.from === undefined && terms.later) out.from = addStep(state.date, state.step);
  if (!ONCE.has(j.kind) && j.kind !== "project" && !out.until) out.until = yearsAfter(out.from ?? state.date, terms.years && terms.years > 0 ? terms.years : TERM_YEARS[j.kind]);
  if (j.kind === "project") {
    out.progress = out.progress ?? 0;
    out.cost = PROJECTS[j.project ?? "pipeline"].cost;
    out.paid = out.paid ?? 0;
  }
  if (j.kind === "research" || j.kind === "space" || j.kind === "atom") out.progress = out.progress ?? 0;
  return out;
}

/** How far through its term an action is by a date: history's by its calendar, the rest from when it began to when it runs out. */
export function termShare(j: Pick<JointAction, "history" | "since" | "from" | "until">, date: string): number {
  const h = j.history ? JOINT_HISTORY.find((x) => x.id === j.history) : undefined;
  const start = h?.from ?? j.from ?? j.since;
  const end = h?.to ?? j.until;
  if (!end) return 0;
  return round3(clamp(yearsBetween(start, date) / Math.max(0.05, yearsBetween(start, end)), 0, 1));
}

/**
 * What an agreed action does at once, before the turn: sanctions imposed by
 * every member, the player's delegation's line set, programmes opened for
 * members without one. Changes `state` in place (a copy).
 */
function startNow(state: GameState, j: JointAction): void {
  if (j.kind === "sanctions" && j.target) {
    const scope = j.scope ?? "partial";
    const rest = (state.sanctions ?? []).filter((s) => !(j.members.includes(s.by) && s.against === j.target));
    const kept = (state.sanctions ?? []).filter((s) => j.members.includes(s.by) && s.against === j.target);
    state.sanctions = [...rest, ...j.members.map((by) => ({ by, against: j.target!, scope: kept.find((s) => s.by === by)?.scope === "full" ? ("full" as const) : scope, since: kept.find((s) => s.by === by)?.since ?? state.date, joint: j.id }))];
  }
  if (j.kind === "line" && j.target && j.vote && j.members.includes(state.player)) state.delegation = { ...(state.delegation ?? {}), [j.target]: j.vote };
  if (j.kind === "space" && state.space) {
    // A member without a rocket programme puts a little of its research money into the joint one.
    const programmes = { ...state.space.programmes };
    for (const m of j.members) if (!programmes[m]?.share) programmes[m] = { ...(programmes[m] ?? { level: Math.max(1940, yearFraction(state.date) - 15), work: {}, done: [] }), share: Math.max(2, programmes[m]?.share ?? 0) };
    state.space = { ...state.space, programmes };
  }
  // A member without an atomic programme opens one with a little of its research money; in the historical mode the
  // other governments keep history's programmes (engine/atom.ts), so none is opened for them.
  if (j.kind === "atom" && state.atom && state.mode !== "historical") {
    const programmes = { ...state.atom.programmes };
    for (const m of j.members) if (m !== state.player && !programmes[m]?.share && !programmes[m]?.ended) programmes[m] = { ...(programmes[m] ?? { done: [], work: {}, stock: 0 }), share: Math.max(3, programmes[m]?.share ?? 0) };
    state.atom = { ...state.atom, programmes };
  }
}

/**
 * The player proposes a joint action to an ally, or to a bloc's members; each
 * answers at once by the engine's dice. Those who agree take part, the rest
 * are named as having declined; with none it is turned down.
 */
export function proposeJoint(state: GameState, draft: JointDraft, index?: Pick<MapIndex, "neighbors"> | null, now = new Date()): GameState {
  if (!mayPropose(state)) return state;
  const d = sanitizeDraft(state, draft, index);
  if (!d || duplicate(state, d)) return state;
  const id = nextId(state);
  const game = gameOf(state);
  const answers = d.partners.map((p) => {
    const a = appraiseJoint(state, d, p, index);
    return { p, a, yes: !a.blocked && roll(game, state.turn, `joint:${id}:${p}`) < a.chance };
  });
  const yes = answers.filter((x) => x.yes);
  const no = answers.filter((x) => !x.yes);
  const base: JointAction = {
    id,
    kind: d.kind,
    by: state.player,
    members: [state.player, ...yes.map((x) => x.p)],
    ...(no.length && yes.length ? { declined: no.map((x) => x.p) } : {}),
    ...(d.target ? { target: d.target } : {}),
    ...(d.war ? { war: d.war } : {}),
    ...(d.at ? { at: d.at } : {}),
    ...(d.direction ? { direction: d.direction } : {}),
    ...(d.project ? { project: d.project } : {}),
    ...(d.scope ? { scope: d.scope } : {}),
    ...(d.vote ? { vote: d.vote } : {}),
    ...(d.share ? { share: d.share } : {}),
    status: "refused",
    since: state.date,
    turn: state.turn,
  };
  let action: JointAction;
  if (yes.length) {
    action = agreed(state, { ...base, reason: yes[0].a.why }, { years: d.years, later: d.later });
  } else {
    // The refusal that weighs most: a government that will not take part at all, else the most reluctant.
    const worst = [...no].sort((x, y) => Number(Boolean(y.a.blocked)) - Number(Boolean(x.a.blocked)) || x.a.chance - y.a.chance)[0];
    action = { ...base, members: [state.player, ...no.map((x) => x.p)], reason: worst.a.blocked ?? worst.a.why, ended: state.date };
  }
  const next: GameState = { ...state, joint: [...(state.joint ?? []), action], updatedAt: now.toISOString() };
  if (action.status === "active") startNow(next, action);
  return next;
}

/** Whether a government lifted its sanctions on another this turn or within the year before it (the chronicle's record). */
function liftedLately(before: Pick<GameState, "chronicle">, applied: AppliedChange[], by: string, against: string, to: string): boolean {
  const lift = (c: AppliedChange) => c.kind === "sanction" && c.by === by && c.against === against && c.change === "lifted";
  if (applied.some(lift)) return true;
  const since = yearsAfter(to, -1);
  for (let i = before.chronicle.length - 1; i >= 0 && before.chronicle[i].from >= since; i--) if (before.chronicle[i].applied.some(lift)) return true;
  return false;
}

/** History's action the player's government turned down or let lapse, carried on by the rest of its members when two or more are left. */
function withoutPlayer(state: Pick<GameState, "player" | "turn">, j: JointAction): JointAction | null {
  const rest = j.members.filter((m) => m !== state.player);
  if (!j.history || rest.length < 2) return null;
  const out: JointAction = { ...j, id: `${j.id}-r`, by: rest[0], members: rest, status: "active", turn: state.turn };
  delete out.declined;
  delete out.reason;
  delete out.ended;
  return out;
}

/** The player's answer to a joint action another government offers: agreed, it begins as offered; refused, the offer is off (history's goes on without the player). */
export function answerJointOffer(state: GameState, id: string, yes: boolean, now = new Date()): GameState {
  const j = (state.joint ?? []).find((x) => x.id === id);
  if (!j || j.status !== "proposed" || !j.members.includes(state.player) || !mayPropose(state)) return state;
  const action: JointAction = yes ? agreed(state, { ...j, turn: state.turn, reason: "fair" }) : { ...j, status: "refused", turn: state.turn, reason: "fair", ended: state.date };
  const rest = yes ? null : withoutPlayer(state, j);
  const countries = state.countries[j.by] ? { ...state.countries, [j.by]: structuredClone(state.countries[j.by]) } : state.countries;
  const next: GameState = { ...state, countries, joint: [...(state.joint ?? []).map((x) => (x.id === id ? action : x)), ...(rest ? [rest] : [])], updatedAt: now.toISOString() };
  if (yes) startNow(next, action);
  else {
    // An offer turned down is a small slight.
    remember(next, j.by, state.player, "left-joint", -2, state.date, false);
    if (rest) startNow(next, rest);
  }
  return next;
}

/** The player walks out of an action under way: the partners remember it, and joint sanctions stand as each member's own. */
export function withdrawJoint(state: GameState, id: string, now = new Date()): GameState {
  const j = (state.joint ?? []).find((x) => x.id === id);
  if (!j || j.status !== "active" || !j.members.includes(state.player)) return state;
  const countries = { ...state.countries };
  for (const m of j.members) if (m !== state.player && countries[m]) countries[m] = structuredClone(countries[m]);
  const next: GameState = {
    ...state,
    countries,
    joint: (state.joint ?? []).map((x) => (x.id === id ? { ...x, status: "ended" as const, reason: "withdrawn" as const, ended: state.date } : x)),
    updatedAt: now.toISOString(),
  };
  if (next.sanctions) next.sanctions = next.sanctions.map((s) => (s.joint === id ? { by: s.by, against: s.against, scope: s.scope, since: s.since } : s));
  for (const m of j.members) if (m !== state.player) remember(next, m, state.player, "left-joint", -10, state.date);
  return next;
}

// ——— On the fronts ———

/** Its formation at a province: one whose sector holds it or touches it, else the nearest to it of its own. */
function unitAt(units: PlannedUnit[], at: string | undefined, index: Pick<MapIndex, "neighbors" | "regions">): PlannedUnit | undefined {
  if (!units.length) return undefined;
  if (!at) return units[0];
  const touches = (u: PlannedUnit) => u.sector.includes(at) || u.sector.some((id) => (index.neighbors[id] ?? []).includes(at));
  const hit = units.find(touches);
  if (hit) return hit;
  const p = index.regions[at]?.at;
  if (!p) return undefined;
  let best: PlannedUnit | undefined;
  let d = Infinity;
  for (const u of units) {
    for (const id of u.sector) {
      const q = index.regions[id]?.at;
      if (!q) continue;
      const x = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2;
      if (x < d) {
        d = x;
        best = u;
      }
    }
  }
  // Within about four degrees: a formation farther off fights another battle.
  return d <= 16 ? best : undefined;
}

/** Kilometres from its own land within which a supporter's aircraft fly over a front, by year; beyond, what it can fly in to its allies' fields or bring on its carriers (OPERATION_FAR). */
const OPERATION_KM: [number, number][] = [
  [1914, 300],
  [1939, 1000],
  [1960, 2000],
  [1990, 3000],
];
const OPERATION_FAR = 0.3;

/**
 * How much an operation's air and sea cover adds: the supporters' aircraft against the enemy's, at most OPERATION_EDGE –
 * each supporter's by what reaches the front (its own land within range of it, else a part flown in or carried). Members
 * already at war add nothing more: their aircraft fight in the air edge of the fronts already (engine/fronts.ts).
 */
function operationEdge(state: GameState, j: JointAction, war: War, index: Pick<MapIndex, "regions">): number {
  const fighter = j.members.find((m) => sideOf(war, m));
  const theirs = fighter ? (enemySide(war, fighter) ?? []) : [];
  const air = (t: string) => state.countries[t]?.arsenal?.stock?.aircraft?.n ?? 0;
  const supporters = j.members.filter((m) => !sideOf(war, m));
  if (!supporters.length) return 0;
  const at = j.at ? index.regions[j.at]?.at : undefined;
  const range = byYear(OPERATION_KM, yearOf(state.date));
  const reaches = (t: string) => {
    if (!at) return 1;
    for (const [id, r] of Object.entries(state.regions)) {
      const p = r.controller === t ? index.regions[id]?.at : undefined;
      if (p && Math.abs(p[1] - at[1]) * 111 <= range && distanceKm(p, at) <= range) return 1;
    }
    return OPERATION_FAR;
  };
  const committed = supporters.reduce((s, t) => s + air(t) * 0.25 * reaches(t), 0);
  if (committed <= 0) return 0;
  return round2(clamp(OPERATION_EDGE * Math.sqrt(committed / Math.max(1, theirs.reduce((s, t) => s + air(t), 0) * 0.3)), 0.03, OPERATION_EDGE));
}

/**
 * The joint offensives and operations of a war this turn, laid on its
 * formations (engine/formations.ts planTurn): each member's formation where
 * the lines meet takes the offensive, unless its supply has run out or the
 * player's own order holds it, and every formation in a joint action fights
 * with its edge. The player's agreed actions and those other governments
 * begin this period (castJoint). Mutates `planned`.
 */
export function jointPlan(state: GameState, war: War, planned: PlannedUnit[], index: Pick<MapIndex, "neighbors" | "regions">, cast: JointCast = castJoint(state, index)): void {
  const live = [...(state.joint ?? []).filter((j) => isLive(j, state.date) && j.war === war.id && WAR_KINDS.has(j.kind)), ...cast.begun.filter((j) => j.war === war.id && WAR_KINDS.has(j.kind))];
  if (!live.length) return;
  const months = (STEP_YEARS[state.step] ?? 1 / 12) * 12;
  for (const j of live) {
    if (j.kind === "offensive") {
      const edge = round2(JOINT_EDGE * Math.min(1, OFFENSIVE_MONTHS / months));
      for (const tag of j.members) {
        if (!sideOf(war, tag)) continue;
        const u = unitAt(planned.filter((x) => x.tag === tag), j.at, index);
        if (!u) continue;
        const held = u.order && (u.order.kind === "hold" || u.order.kind === "withdraw");
        if (!held) {
          u.task = "attack";
          if (POSTURE_RANK[u.posture] < POSTURE_RANK.offensive) u.posture = u.supply < 0.4 ? "probe" : "offensive";
          if (j.at && (u.sector.includes(j.at) || u.sector.some((id) => (index.neighbors[id] ?? []).includes(j.at!)))) u.target = j.at;
        }
        u.joint = Math.max(u.joint ?? 0, edge);
        u.jointId = j.id;
      }
    } else {
      // Every formation of the members fighting the war, under the cover.
      const edge = operationEdge(state, j, war, index);
      if (edge <= 0) continue;
      for (const u of planned) {
        if (!j.members.includes(u.tag) || !sideOf(war, u.tag)) continue;
        u.joint = Math.max(u.joint ?? 0, edge);
        u.jointId ??= j.id;
      }
    }
  }
}

// ——— The period cast before the turn ———

export interface JointCast {
  /** Notes and manoeuvres of the period: whether the government they are aimed at yields. */
  answers: Record<string, boolean>;
  /** What other governments begin among themselves this period. */
  begun: JointAction[];
  /** What other governments offer the player's this period, for its answer after the turn. */
  offers: JointAction[];
}

/** A supporter's aircraft lost over a war's front, on the war's record under its name. Mutates `war`. */
function bookAircraft(next: GameState, war: War, tag: string, n: number): void {
  const had = war.losses?.[tag] ?? { killed: 0, wounded: 0 };
  const last = had.last?.turn === next.turn ? had.last : { turn: next.turn, killed: 0, wounded: 0 };
  const r = (v: number) => Math.round(v * 100) / 100;
  war.losses = {
    ...war.losses,
    [tag]: { ...had, arms: { ...had.arms, aircraft: r((had.arms?.aircraft ?? 0) + n) }, last: { ...last, arms: { ...last.arms, aircraft: r((last.arms?.aircraft ?? 0) + n) } } },
  };
}

/** The governments that matter: those the engine keeps a course for. */
const actors = (state: GameState) => Object.values(state.countries).filter((c) => c.course && stands(state, c.tag) && c.tag !== state.player);

/** History's actions whose day has come within the period and that the game does not have yet. */
function dueHistory(state: GameState, end: string): JointHistory[] {
  if (state.mode !== "historical") return [];
  const had = new Set((state.joint ?? []).map((j) => j.history ?? j.id));
  return JOINT_HISTORY.filter((h) => h.from <= end && h.to > state.date && !had.has(h.id));
}

/** The chance something with a yearly rate happens within a period of `years`. */
const within = (rate: number, years: number) => 1 - Math.exp(-rate * years);

/** Whether a note or manoeuvres make the government they are aimed at yield: the members' weight against its own, its appetite. */
export function yieldChance(state: GameState, members: string[], target: string, power = powers(state)): number {
  const ours = members.reduce((s, m) => s + (power.get(m) ?? 0), 0);
  const theirs = Math.max(0.005, power.get(target) ?? 0.005);
  const hawk = state.countries[target]?.course?.hawk ?? 50;
  return round2(clamp(0.15 + 0.2 * Math.log2(Math.max(0.25, ours / theirs)) - (hawk - 50) / 250, 0.05, 0.8));
}

/**
 * What the period holds for joint actions, cast before the turn from the
 * state before it, so the game master is told it and the server and the
 * browser agree: whether each note and each manoeuvre makes its target
 * yield; what other governments begin among themselves – history's on its
 * day in the historical mode, a joint offensive of allies whose lines meet,
 * a bloc's manoeuvres, a community's project, a space programme of two
 * friendly powers; and what they offer the player's government.
 */
export function castJoint(state: GameState, index?: Pick<MapIndex, "neighbors"> | null): JointCast {
  const out: JointCast = { answers: {}, begun: [], offers: [] };
  const years = STEP_YEARS[state.step] ?? 1 / 12;
  const end = addStep(state.date, state.step);
  const game = gameOf(state);
  const dice = (key: string) => roll(game, state.turn, `joint:cast:${key}`);
  const power = powers(state);
  const make = (fields: Omit<JointAction, "id" | "status" | "since" | "turn">, offer: boolean): JointAction => {
    const id = `${offer ? "o" : "x"}${state.turn}-${out.begun.length + out.offers.length + 1}`;
    return { ...fields, id, status: offer ? "proposed" : "active", since: state.date, turn: state.turn + (offer ? 1 : 0) };
  };
  const key = (kind: JointKind, members: string[], target?: string) => `${kind}|${[...members].sort().join("+")}|${target ?? ""}`;
  const busy = new Set((state.joint ?? []).filter((j) => j.status === "active" || j.status === "proposed").map((j) => key(j.kind, j.members, j.target)));
  // A pair that let an offer lapse or turned it down, or built a project together, is not asked the same again for a while.
  const resting = new Set(
    (state.joint ?? [])
      .filter((j) => (j.status === "refused" || (j.status === "ended" && j.reason === "lapsed") || (j.status === "done" && j.kind === "project")) && yearsBetween(j.ended ?? j.since, state.date) < PAUSE_YEARS[j.kind])
      .map((j) => key(j.kind, j.members, j.target)),
  );
  const free = (kind: JointKind, members: string[], target?: string) => !busy.has(key(kind, members, target)) && !resting.has(key(kind, members, target));

  for (const j of state.joint ?? []) if (isLive(j, state.date) && (j.kind === "note" || j.kind === "exercise") && j.target) out.answers[j.id] = dice(`answer:${j.id}`) < yieldChance(state, j.members, j.target, power);

  // History's own, on their days: among those of their members the game still has; a member the player plays is asked.
  for (const h of dueHistory(state, end)) {
    const members = h.members.filter((m) => stands(state, m));
    if (members.length < 2) continue;
    if (h.war && !state.wars.some((w) => w.id === h.war && !w.truce && members.some((m) => sideOf(w, m)))) continue;
    const progress = h.kind === "project" || h.kind === "space" || h.kind === "atom" ? Math.min(0.95, termShare({ history: h.id, since: h.from, until: h.to }, state.date)) : undefined;
    const fields: Omit<JointAction, "id" | "status" | "since" | "turn"> = {
      kind: h.kind,
      by: members.find((m) => m !== state.player) ?? members[0],
      members,
      name: h.name,
      history: h.id,
      until: h.to,
      ...(h.project ? { project: h.project } : {}),
      ...(h.war ? { war: h.war } : {}),
      ...(h.target ? { target: h.target } : {}),
      ...(h.share ? { share: h.share } : {}),
      ...(progress !== undefined ? { progress } : {}),
    };
    // A government the player does not lead (a minister, a general, the opposition) agrees on its own.
    if (members.includes(state.player) && mayPropose(state)) out.offers.push(make(fields, true));
    else out.begun.push(make(fields, false));
  }

  const others = actors(state);
  const cap = 3;
  // A joint offensive of allies in a war whose lines meet: about one a year for each such pair.
  if (index) {
    for (const war of state.wars.filter((w) => !w.truce)) {
      if (out.begun.length >= cap) break;
      for (const side of [war.attackers, war.defenders]) {
        const fighting = side.filter((t) => stands(state, t) && (war.units ?? []).some((u) => u.tag === t));
        let done = false;
        for (let i = 0; i < fighting.length && !done; i++) {
          for (let k = i + 1; k < fighting.length && !done; k++) {
            const [a, b] = [fighting[i], fighting[k]];
            if (tieOf(state, a, b).trust < 0 || tieOf(state, b, a).trust < 0) continue;
            const withPlayer = a === state.player || b === state.player;
            const rate = withPlayer ? 0.6 : 1;
            if (dice(`offensive:${war.id}:${a}:${b}`) >= within(rate, years)) continue;
            const points = meetingPoints(state, index, war, a, b, 3);
            if (!points.length) continue;
            const ally = a === state.player ? b : a;
            const target = enemySide(war, a)![0];
            if (withPlayer) {
              if (out.offers.length || !free("offensive", [a, b], target)) continue;
              out.offers.push(make({ kind: "offensive", by: ally, members: [ally, state.player], war: war.id, at: points[0], target, from: end }, true));
            } else if (free("offensive", [a, b], target)) out.begun.push(make({ kind: "offensive", by: a, members: [a, b], war: war.id, at: points[0], target }, false));
            done = true;
          }
        }
      }
    }
  }

  // A military bloc's manoeuvres, about one a year, warning the rival its strongest member fears most.
  for (const bloc of state.alliances.filter((a) => isMilitary(a) && a.members.length >= 3)) {
    if (out.begun.length >= cap) break;
    const members = bloc.members.filter((m) => stands(state, m) && m !== state.player && !state.wars.some((w) => !w.truce && sideOf(w, m))).sort((x, y) => (power.get(y) ?? 0) - (power.get(x) ?? 0) || x.localeCompare(y)).slice(0, 4);
    if (members.length < 2 || dice(`exercise:${bloc.id}`) >= within(1, years)) continue;
    const lead = state.countries[members[0]]?.course;
    if (!lead) continue;
    const rival = Object.entries(lead.ties)
      .filter(([t, tie]) => t !== members[0] && !bloc.members.includes(t) && stands(state, t) && tie.threat >= 25)
      .sort((x, y) => y[1].threat - x[1].threat || x[0].localeCompare(y[0]))[0]?.[0];
    if (!rival || !free("exercise", members, rival)) continue;
    const j = make({ kind: "exercise", by: members[0], members, target: rival }, false);
    out.answers[j.id] = dice(`answer:${j.id}`) < yieldChance(state, members, rival, power);
    out.begun.push(j);
  }

  // An economic community's project, about one in six years: its largest economy and the nearest of the rest that can pay
  // for it – not a member at war on its own soil, nor one whose debt is past twice the era's norm. A pipeline, railway or
  // canal joins neighbours, by land or across a sea close by; a plant may be built with any partner. The player is offered
  // one at most every three years, whatever the number of its communities.
  const offeredLately = (state.joint ?? []).some((j) => j.kind === "project" && j.members.includes(state.player) && yearsBetween(j.since, state.date) < PLAYER_PROJECT_YEARS);
  const means = meansFor(state);
  for (const bloc of state.alliances.filter((a) => (a.kind === "trade" || a.kind === "organization") && a.members.length >= 3 && a.members.length < 40)) {
    if (out.begun.length + out.offers.length >= cap + 1) break;
    if (dice(`project:${bloc.id}`) >= within(1 / 6, years)) continue;
    const members = bloc.members.filter((m) => stands(state, m) && means(m)).sort((x, y) => (state.countries[y]?.economy?.gdp ?? 0) - (state.countries[x]?.economy?.gdp ?? 0) || x.localeCompare(y));
    const lead = members[0];
    if (!lead) continue;
    const partner = members.slice(1).sort((x, y) => tieOf(state, lead, y).near - tieOf(state, lead, x).near || x.localeCompare(y))[0];
    if (!partner) continue;
    const tie = tieOf(state, lead, partner);
    const kinds: ProjectKind[] = tie.land || tie.near >= NEIGHBOUR_NEAR ? ["pipeline", "railway", "plant", "canal"] : ["plant"];
    const project = kinds[Math.floor(dice(`project:${bloc.id}:kind`) * kinds.length)];
    const pair = [lead, partner];
    if (!free("project", pair)) continue;
    if (pair.includes(state.player)) {
      if (!out.offers.length && !offeredLately && mayPropose(state)) {
        const ally = pair.find((m) => m !== state.player)!;
        out.offers.push(make({ kind: "project", by: ally, members: [ally, state.player], project }, true));
      }
    } else out.begun.push(make({ kind: "project", by: lead, members: pair, project }, false));
  }

  // Two friendly powers with rockets pool their space programmes, now and then.
  if (yearFraction(state.date) >= 1957 && state.space) {
    const rocketeers = others.filter((c) => (state.space!.programmes[c.tag]?.share ?? 0) > 0).sort((x, y) => (power.get(y.tag) ?? 0) - (power.get(x.tag) ?? 0) || x.tag.localeCompare(y.tag)).slice(0, 8);
    for (let i = 0; i < rocketeers.length && out.begun.length < cap; i++) {
      for (let k = i + 1; k < rocketeers.length; k++) {
        const [a, b] = [rocketeers[i].tag, rocketeers[k].tag];
        if (!allied(state, a, b) || !free("space", [a, b])) continue;
        if (dice(`space:${a}:${b}`) >= within(0.05, years)) continue;
        out.begun.push(make({ kind: "space", by: a, members: [a, b], until: yearsAfter(state.date, TERM_YEARS.space), progress: 0 }, false));
        break;
      }
    }
  }
  return out;
}

// ——— After the turn ———

interface AdvanceContext {
  turn: number;
  to: string;
  years: number;
  map: Record<string, MapRegion> | null;
  /** The turn's formations, and the ground each gained (engine/formations.ts, engine/warLosses.ts). */
  plan?: { units: Record<string, PlannedUnit[]> };
  exchange?: { units: Map<string, Map<string, { km: number }>> };
}

/** A note or manoeuvres heeded: the target's war plans against the members, or their allies, short of action, are given up. */
function deter(next: GameState, j: JointAction, ctx: AdvanceContext, applied: AppliedChange[]): number {
  if (!j.target) return 0;
  const shielded = new Set(j.members.flatMap((m) => [m, ...alliesOf(next, m)]));
  let n = 0;
  for (const p of next.plans ?? []) {
    if (p.end || p.by !== j.target || (p.kind !== "war" && p.kind !== "join") || !p.target || !shielded.has(p.target) || p.stage === "action") continue;
    endDeterred(next, p, j.members[0], ctx, applied);
    n++;
  }
  return n;
}

function endDeterred(next: GameState, p: Plan, by: string, ctx: AdvanceContext, applied: AppliedChange[]): void {
  p.end = { date: ctx.to, turn: ctx.turn, how: "faded", why: "deterred" };
  applied.push({ kind: "plan-end", plan: p.id, type: p.kind, by: p.by, ...(p.target ? { target: p.target } : {}), how: "faded", why: "deterred", because: { kind: "deterrent", country: by } });
}

/** The news of an action: one line of the chronicle. */
function told(j: JointAction, change: Extract<AppliedChange, { kind: "joint" }>["change"], extra: Partial<Extract<AppliedChange, { kind: "joint" }>> = {}): AppliedChange {
  return {
    kind: "joint",
    id: j.id,
    type: j.kind,
    by: j.by,
    members: [...j.members],
    change,
    ...(j.target ? { target: j.target } : {}),
    ...(j.project ? { project: j.project } : {}),
    ...(j.direction ? { direction: j.direction } : {}),
    ...(j.name ? { name: j.name } : {}),
    ...extra,
  };
}

/** Members trust each other the more for an action carried out together. */
function together(next: GameState, j: JointAction, weight: number): void {
  for (const a of j.members) for (const b of j.members) if (a !== b) remember(next, a, b, "joint", weight, next.date, false);
}

/** A member's economy pays over a turn of `years`: outside its budget, from its reserves, the rest borrowed (economy.ts payOffBudget). Returns what it paid, $bn. */
function pay(next: GameState, tag: string, amount: number, years: number): number {
  const e = next.countries[tag]?.economy;
  if (!e || amount <= 0) return 0;
  payOffBudget(e, amount, years);
  return amount;
}

/** A level rise of a member's economy, its taxes with it. */
function grow(next: GameState, tag: string, share: number): void {
  const e = next.countries[tag]?.economy;
  if (!e || share <= 0) return;
  const k = 1 + share;
  e.gdp = round2(e.gdp * k);
  e.budget = { ...e.budget, revenue: round2(e.budget.revenue * k) };
}

/** Pooled money: each member's own, and the others' less what coordination loses. */
function pooled(own: number[]): number[] {
  const sum = own.reduce((s, x) => s + x, 0);
  return own.map((x) => x + (1 - LOSS) * (sum - x));
}

/** What the pooled money adds to a pace that its own money buys: the root of the ratio, at most doubled. */
const lift = (own: number, pool: number) => (own > 0 ? Math.min(1, Math.sqrt(pool / own) - 1) : pool > 0 ? 1 : 0);

/** Joint research: the player's direction gains at the pace the pooled money buys; the partners gain what is learnt. */
function researchTurn(before: GameState, next: GameState, j: JointAction, ctx: AdvanceContext, applied: AppliedChange[]): void {
  const d = j.direction ?? "science";
  const research = next.research;
  if (!j.members.includes(next.player) || !research?.shares || !research.tech) return;
  const share = (research.shares[d] ?? 0) / 100;
  const own = researchMoney(before).pool * share;
  const others = j.members.filter((m) => m !== next.player);
  const theirs = others.reduce((s, m) => s + researchPool(before, m) * share, 0);
  const k = lift(own, own + (1 - LOSS) * theirs);
  const rate = researchRate(next, d);
  const was = techYear(next, d);
  const reached = round4(was + rate * k * ctx.years);
  if (reached <= was) return;
  next.research = { ...research, tech: { ...research.tech, [d]: reached } };
  // Breakthroughs the pooled work reaches are made as the research of the player's own makes them.
  const made = new Set(research.done.map((x) => x.id));
  const done = [...research.done];
  for (const b of breakthroughsOf(d)) {
    if (b.year <= was || b.year > reached || made.has(b.id)) continue;
    done.push({ id: b.id, date: monthOf(yearFraction(ctx.to) - ctx.years / 2) });
    applied.push({ kind: "research", project: b.id, change: "done", ahead: round2(b.year - yearFraction(ctx.to)) });
  }
  if (done.length !== research.done.length) next.research = { ...next.research, done };
  // The partners learn what the player's laboratories find with them: a little more output a year for every year of it.
  for (const m of others) {
    const gdp = next.countries[m]?.economy?.gdp ?? 0;
    if (gdp > 0) grow(next, m, Math.min(0.002, ((1 - LOSS) * own * ctx.years * 0.5) / gdp));
  }
}

/** A joint space programme: every member's programme goes at the pace the pooled money buys; a feat is the pride of all. */
function spaceTurn(before: GameState, next: GameState, j: JointAction, ctx: AdvanceContext, applied: AppliedChange[]): void {
  const space = next.space;
  if (!space) return;
  const members = j.members.filter((m) => space.programmes[m]);
  if (members.length < 2) return;
  const own = members.map((m) => spaceMoney(before, m));
  const pool = pooled(own);
  members.forEach((m, i) => {
    const p = space.programmes[m];
    const extra = spaceRate({ ...before, space: before.space }, m) * lift(own[i], pool[i]) * ctx.years;
    if (extra <= 0) return;
    p.level = round4(p.level + extra);
    for (const f of SPACE_MILESTONES) {
      const info = MILESTONES[f];
      if (p.done.some((x) => x.id === f) || !info.needs.every((n) => p.done.some((x) => x.id === n)) || p.level < needYear(f) - info.cost) continue;
      p.work[f] = round2(Math.min(info.cost, (p.work[f] ?? 0) + extra));
    }
  });
  // A feat of one member is the others' pride too, a third of it.
  for (const c of applied) {
    if (c.kind !== "space" || c.change !== "done" || !c.milestone || !members.includes(c.country)) continue;
    const weight = MILESTONES[c.milestone].prestige * (c.first ? 1 : 1 / 3) / 3;
    for (const m of members) {
      if (m === c.country || weight <= 0) continue;
      if (m === next.player && next.politics) next.politics = { ...next.politics, unrest: Math.max(0, Math.round(next.politics.unrest - weight * 0.4)) };
      const dom = next.countries[m]?.domestic;
      // Two decimals, as politics abroad keeps support (engine/abroad.ts).
      if (m !== next.player && dom) next.countries[m].domestic = { ...dom, support: clamp(Math.round((dom.support + weight * 0.5) * 100) / 100, 0, 100) };
    }
  }
}

/** A joint atomic programme: each member's work at the pace the pooled money buys; at the lead's test, the design to every member if the terms say so. */
function atomTurn(before: GameState, next: GameState, j: JointAction, ctx: AdvanceContext, applied: AppliedChange[]): void {
  const atom = next.atom;
  if (!atom) return;
  const members = j.members.filter((m) => atom.programmes[m] && !atom.programmes[m].ended);
  const historical = next.mode === "historical";
  const money = (tag: string) => {
    if (tag === before.player) return researchMoney(before).pool * ((before.research?.shares?.strategic ?? 0) / 100);
    return (researchPool(before, tag) * clamp(before.atom?.programmes[tag]?.share ?? 0, 0, 50)) / 100;
  };
  const own = members.map(money);
  const pool = pooled(own);
  members.forEach((m, i) => {
    const p = atom.programmes[m];
    // History keeps its own days for the governments the player does not lead.
    if (historical && m !== next.player) return;
    const rate = m === before.player ? playerAtomRate(before) : atomRate(before, m);
    const s = nextStage(p);
    if (!s || rate <= 0) return;
    const extra = rate * lift(own[i], pool[i]) * ctx.years;
    p.work[s] = round3(Math.min(STAGE_WORK[s], (p.work[s] ?? 0) + extra));
  });
  // The lead's first test: on equal terms, every member has the design and builds its own bomb from its own material.
  if (j.share === "equal") {
    for (const c of applied) {
      if (c.kind !== "atom" || c.change !== "stage" || c.stage !== "test" || !members.includes(c.country)) continue;
      for (const m of members) {
        const p = atom.programmes[m];
        if (m === c.country || p.done.some((x) => x.id === "test")) continue;
        for (const s of ["reactor", "material", "device"] as const) if (!p.done.some((x) => x.id === s)) p.work[s] = round3(Math.max(p.work[s] ?? 0, 0.8 * STAGE_WORK[s]));
      }
    }
  }
}

/** A project: every member pays its share of its economy; the work goes on as far as they pay; built, each economy is the larger. */
function projectTurn(next: GameState, j: JointAction, ctx: AdvanceContext, applied: AppliedChange[]): void {
  const spec = PROJECTS[j.project ?? "pipeline"];
  let paid = 0;
  for (const m of j.members) paid += pay(next, m, round2((j.cost ?? spec.cost) * (next.countries[m]?.economy?.gdp ?? 0) * ctx.years), ctx.years);
  j.paid = round2((j.paid ?? 0) + paid);
  // History's own is built on history's day; any other as the years pass.
  j.progress = j.history ? termShare(j, ctx.to) : round3(clamp((j.progress ?? 0) + ctx.years / spec.years, 0, 1));
  if (j.progress < 1) return;
  for (const m of j.members) grow(next, m, spec.gain);
  if (spec.prestige) {
    for (const m of j.members) {
      if (m === next.player && next.politics) next.politics = { ...next.politics, unrest: Math.max(0, next.politics.unrest - Math.round(spec.prestige * 0.3)) };
      const dom = next.countries[m]?.domestic;
      if (m !== next.player && dom) next.countries[m].domestic = { ...dom, support: clamp(Math.round((dom.support + spec.prestige * 0.4) * 100) / 100, 0, 100) };
    }
  }
  j.status = "done";
  j.ended = ctx.to;
  j.result = { gdp: round3(spec.gain * 100) };
  together(next, j, 5);
  applied.push(told(j, "built", { gdp: j.result.gdp }));
}

/** Whether the members of an action still stand together: there, and not at war with each other. */
function fallsApart(next: GameState, j: JointAction): JointReason | null {
  const members = j.members.filter((m) => stands(next, m));
  if (members.length < 2) return "member";
  for (const a of members) for (const b of members) if (a < b && warBetween(next, a, b)) return "war";
  if (j.target && AIMED.has(j.kind) && !stands(next, j.target)) return "target";
  if (WAR_KINDS.has(j.kind) && !next.wars.some((w) => w.id === j.war)) return "target";
  return null;
}

/**
 * The joint actions after the turn: offers the player let lapse are off;
 * actions whose members fell out or whose aim is gone end; the period's
 * offensives are fought (the ground they gained told), operations wear the
 * supporters' aircraft down, notes and manoeuvres are answered as cast,
 * pooled research and programmes go on, projects are paid for and built,
 * terms run out; then what other governments began this period and what they
 * offer the player are added, and allies join sanctions one of them imposed.
 * `before` is the state the turn began from. Mutates `next`.
 */
export function advanceJoint(before: GameState, next: GameState, cast: JointCast, ctx: AdvanceContext, applied: AppliedChange[]): void {
  const list = next.joint ?? [];
  const months = ctx.years * 12;
  const game = gameOf(before);
  const kmOf = (id: string) => {
    let km = 0;
    for (const [war, units] of Object.entries(ctx.plan?.units ?? {})) for (const u of units) if (u.jointId === id) km += ctx.exchange?.units.get(war)?.get(u.id)?.km ?? 0;
    return round2(km);
  };
  const close = (j: JointAction, status: "done" | "ended", reason?: JointReason) => {
    j.status = status;
    j.ended = ctx.to;
    if (reason) j.reason = reason;
    if (j.kind === "sanctions" && next.sanctions) next.sanctions = next.sanctions.map((s) => (s.joint === j.id ? { by: s.by, against: s.against, scope: s.scope, since: s.since } : s));
  };

  const carried: JointAction[] = [];
  for (const j of list) {
    if (j.status === "proposed") {
      // An offer the player left unanswered for a whole turn is off; history's goes on without the player.
      if (j.turn <= before.turn) {
        close(j, "ended", "lapsed");
        const rest = withoutPlayer(before, j);
        if (rest) carried.push({ ...rest, turn: before.turn });
      }
      continue;
    }
    if (j.status !== "active") continue;
    const apart = fallsApart(next, j);
    if (apart) {
      close(j, "ended", apart);
      applied.push(told(j, "ended", { reason: apart }));
      continue;
    }
    if (j.from && j.from > before.date) continue;
    // Sanctions a member imposed on agreeing, since the last turn, are the period's news, and the target's to remember.
    if (j.kind === "sanctions" && j.turn === before.turn) {
      for (const m of j.members) if (next.sanctions?.some((s) => s.by === m && s.against === j.target && s.joint === j.id && s.since === j.since)) applied.push({ kind: "sanction", by: m, against: j.target!, change: j.scope ?? "partial" });
    }
    switch (j.kind) {
      case "offensive": {
        const km = kmOf(j.id);
        close(j, "done");
        j.result = { km };
        together(next, j, 3);
        applied.push(told(j, "done", { km }));
        continue;
      }
      case "operation": {
        const war = next.wars.find((w) => w.id === j.war);
        for (const m of j.members.filter((t) => war && !sideOf(war, t))) {
          const stock = next.countries[m]?.arsenal?.stock?.aircraft;
          if (stock?.n) {
            const left = Math.max(0, Math.round(stock.n * (1 - AIR_ATTRITION * months)));
            // The aircraft it lost over the front go into the war's record, as a supporter's: it fought there.
            if (war && stock.n - left >= 0.5) bookAircraft(next, war, m, stock.n - left);
            stock.n = left;
          }
          for (const e of war ? (enemySide(war, j.members.find((t) => sideOf(war, t)) ?? "") ?? []) : []) addTension(next, e, m, Math.min(15, 3 * months));
        }
        break;
      }
      case "exercise":
      case "note": {
        const yielded = Boolean(cast.answers[j.id]);
        if (j.target) {
          for (const m of j.members) {
            addTension(next, j.target, m, j.kind === "exercise" ? 5 : yielded ? 2 : 8);
            // The alarm lasts beyond the turn: the courses' threat keeps it, halving in a year (engine/relations.ts).
            if (next.countries[j.target]?.course?.ties[m]) raiseAlarm(next, j.target, m, j.kind === "exercise" ? 6 : 3);
            if (!yielded) remember(next, j.target, m, "provoked", -4, ctx.to, false);
          }
          if (yielded) deter(next, j, ctx, applied);
        }
        close(j, "done");
        j.result = { yielded };
        together(next, j, 2);
        applied.push(told(j, "done", { yielded }));
        continue;
      }
      case "research":
        researchTurn(before, next, j, ctx, applied);
        break;
      case "space":
        spaceTurn(before, next, j, ctx, applied);
        break;
      case "atom":
        atomTurn(before, next, j, ctx, applied);
        break;
      case "project":
        projectTurn(next, j, ctx, applied);
        if (j.status !== "active") continue;
        break;
      case "sanctions":
      case "line":
        break;
    }
    if (j.kind !== "project" && j.until) j.progress = termShare(j, ctx.to);
    if (j.until && j.until <= ctx.to) {
      close(j, "done", j.history ? undefined : "term");
      together(next, j, 4);
      applied.push(told(j, "done"));
    }
  }

  // What other governments began among themselves this period, and what they offer the player.
  const added: JointAction[] = [];
  for (const j of carried) {
    added.push(j);
    applied.push(told(j, "begun"));
    startNow(next, j);
  }
  for (const b of cast.begun) {
    const j: JointAction = structuredClone(b);
    if (j.kind === "project") Object.assign(j, { cost: PROJECTS[j.project ?? "pipeline"].cost, paid: 0, progress: j.progress ?? 0 });
    added.push(j);
    if (j.kind === "offensive" || j.kind === "exercise") {
      // Held within the period: fought or watched now, and told as done.
      if (j.kind === "offensive") j.result = { km: kmOf(j.id) };
      else {
        const yielded = Boolean(cast.answers[j.id]);
        j.result = { yielded };
        for (const m of j.members) {
          addTension(next, j.target!, m, 5);
          if (next.countries[j.target!]?.course?.ties[m]) raiseAlarm(next, j.target!, m, 6);
        }
        if (yielded) deter(next, j, ctx, applied);
      }
      j.status = "done";
      j.ended = ctx.to;
      together(next, j, 2);
      applied.push(told(j, "done", j.result));
      continue;
    }
    applied.push(told(j, "begun"));
    startNow(next, j);
  }
  for (const o of cast.offers) {
    if (!mayPropose(before)) break;
    added.push(structuredClone(o));
    applied.push(told(o, "offered"));
  }

  // Allies join the sanctions one of them imposed this period by its own plan, now and then, unless they trade too much
  // with the target or lifted their own on it within the year (those the game master wrote come with their own story);
  // the target remembers them with the period's other sanctions (engine/relations.ts learnFromTurn). The ally follows
  // the plan it joins, and its sanctions carry that plan as their reason.
  let joined = 0;
  for (const c of [...applied]) {
    if (joined >= 2 || c.kind !== "sanction" || !c.plan || c.change === "lifted" || c.by === next.player || !next.countries[c.by]?.course) continue;
    for (const ally of [...alliesOf(next, c.by)].sort()) {
      if (ally === next.player || ally === c.against || !next.countries[ally]?.course || (next.sanctions ?? []).some((s) => s.by === ally && s.against === c.against)) continue;
      if (liftedLately(before, applied, ally, c.against, ctx.to)) continue;
      const t = tieOf(next, ally, c.against);
      if (t.trust > 10 || (t.trade ?? 0) > 15 || roll(game, before.turn, `joint:sanction:${c.by}:${ally}:${c.against}`) >= 0.35) continue;
      const id = `x${before.turn}-s${joined + 1}`;
      const j: JointAction = { id, kind: "sanctions", by: c.by, members: [c.by, ally], target: c.against, scope: c.change, status: "active", since: ctx.to, turn: before.turn, until: yearsAfter(ctx.to, TERM_YEARS.sanctions) };
      startNow(next, j);
      added.push(j);
      applied.push(told(j, "begun"));
      applied.push({ kind: "sanction", by: ally, against: c.against, change: c.change, plan: c.plan, ...(c.because ? { because: c.because } : {}) });
      joined++;
      break;
    }
  }

  // Ended actions stay a while for the panel; the player's offers it let lapse or refused, and the projects it built, as long
  // as they keep the pair from being asked again (PAUSE_YEARS).
  const since = yearsAfter(ctx.to, -KEEP_YEARS);
  const all = [...list, ...added];
  const live = all.filter((j) => j.status === "active" || j.status === "proposed");
  const past = all.filter((j) => j.status !== "active" && j.status !== "proposed" && (j.ended ?? j.since) >= since).slice(-Math.max(0, MAX_KEPT - live.length));
  const resting = all.filter((j) => !live.includes(j) && !past.includes(j) && j.members.includes(next.player) && (j.status === "refused" || j.reason === "lapsed" || (j.status === "done" && j.kind === "project")) && yearsBetween(j.ended ?? j.since, ctx.to) < PAUSE_YEARS[j.kind]);
  const kept = all.filter((j) => live.includes(j) || past.includes(j) || resting.includes(j));
  if (kept.length) next.joint = kept;
  else delete next.joint;
}

// ——— For the world body ———

/** The line a government agreed with others on an aggressor at the world body, if any: it votes so. */
export function jointLine(state: Pick<GameState, "joint">, member: string, aggressor: string): DelegationVote | undefined {
  return (state.joint ?? []).find((j) => j.kind === "line" && j.status === "active" && j.target === aggressor && j.members.includes(member))?.vote;
}

// ——— For the game master ———

const KIND_EN: Record<JointKind, string> = {
  offensive: "joint offensive",
  operation: "joint air and naval operation",
  exercise: "joint manoeuvres",
  research: "joint research",
  space: "joint space programme",
  atom: "joint atomic programme",
  project: "joint project",
  note: "joint note",
  sanctions: "joint sanctions",
  line: "one line at the world body",
};

/** One action in a line for the game master. */
function jointLineEn(state: GameState, j: JointAction, name: (tag: string) => string, place: (id: string) => string, cast: JointCast): string {
  const who = j.members.map(name).join(" + ");
  const title = j.name ? `${en(j.name)} (${KIND_EN[j.kind]})` : KIND_EN[j.kind];
  const war = j.war ? ` in ${en(state.wars.find((w) => w.id === j.war)?.name ?? j.war)}` : "";
  const parts: string[] = [`${j.id} | ${title} | ${who}`];
  switch (j.kind) {
    case "offensive":
      parts.push(`${war.trim()}${j.at ? ` where their lines meet at ${place(j.at)}` : ""}: both formations attack together this period, each the stronger for it`);
      break;
    case "operation":
      parts.push(`${war.trim()}, against ${name(j.target ?? "")}: air and naval cover for the formations there${j.until ? ` until ${j.until}` : ""}`);
      break;
    case "exercise":
      parts.push(`manoeuvres warning ${name(j.target ?? "")}: ${cast.answers[j.id] ? "it backs down" : "it is not cowed and its anger grows"}`);
      break;
    case "note":
      parts.push(`a joint note to ${name(j.target ?? "")}: ${cast.answers[j.id] ? "it yields" : "it rejects the note"}`);
      break;
    case "sanctions":
      parts.push(`${j.scope ?? "partial"} sanctions on ${name(j.target ?? "")}, imposed together (harder to get round)`);
      break;
    case "line":
      parts.push(`they vote together at the world body on ${name(j.target ?? "")}: ${j.vote ?? "condemn"}`);
      break;
    case "research":
      parts.push(`in ${j.direction ?? "science"}, the money pooled less a quarter lost to coordination${j.until ? `, until ${j.until}` : ""}`);
      break;
    case "space":
    case "atom":
      parts.push(`the money pooled, ${Math.round((j.progress ?? 0) * 100)}% of its term${j.kind === "atom" ? `; the bomb's design ${j.share === "equal" ? "shared with every member" : "kept by the lead"}` : ""}`);
      break;
    case "project":
      parts.push(`${j.project ?? "pipeline"}, ${Math.round((j.progress ?? 0) * 100)}% built, every member paying its share`);
      break;
  }
  return `- ${parts.join(" | ")}`;
}

/**
 * The joint actions for the game master: those under way and what the
 * engine decided for this period, the player's proposals answered this turn,
 * offers waiting for the player, and what other governments begin among
 * themselves. Nothing when there are none.
 */
export function describeJoint(state: GameState, index?: Pick<MapIndex, "neighbors" | "regions"> | null, opts: { mine?: boolean } = {}): string[] {
  const name = (tag: string) => en(state.countries[tag]?.name ?? tag);
  const place = (id: string) => index?.regions[id]?.name ?? id;
  const cast = castJoint(state, index);
  // The story tells the period from the player's country: its own joint actions and offers, not every government's.
  const list = (state.joint ?? []).filter((j) => !opts.mine || j.members.includes(state.player) || j.by === state.player);
  const live = list.filter((j) => isLive(j, state.date));
  const lines: string[] = [];
  for (const j of live) lines.push(jointLineEn(state, j, name, place, cast));
  for (const j of list.filter((x) => x.status === "active" && x.from && x.from > state.date)) lines.push(`- ${j.id} | ${KIND_EN[j.kind]} of ${j.members.map(name).join(" + ")}${j.at ? ` at ${place(j.at)}` : ""}: agreed for the next period, not this one`);
  for (const j of list.filter((x) => x.turn === state.turn && x.by === state.player && x.status === "refused")) lines.push(`- the player's proposal of a ${KIND_EN[j.kind]} to ${j.members.filter((m) => m !== state.player).map(name).join(", ")}: turned down (${j.reason ?? "fair"})`);
  for (const j of list.filter((x) => x.status === "proposed" && x.members.includes(state.player))) lines.push(`- ${name(j.by)} proposes to the player a ${KIND_EN[j.kind]}${j.name ? ` (${en(j.name)})` : ""}: waiting for the player's answer`);
  for (const j of cast.begun.filter((x) => !opts.mine || x.members.includes(state.player))) lines.push(`${jointLineEn(state, j, name, place, cast)} | begun this period by the engine`);
  for (const j of cast.offers) lines.push(`- this period ${name(j.by)} will propose to the player a ${KIND_EN[j.kind]}${j.name ? ` (${en(j.name)})` : ""}`);
  if (!lines.length) return [];
  return ["", "JOINT ACTIONS WITH ALLIES (agreed through the engine and carried out by it; tell them as they are – never another answer, result or member):", ...lines];
}

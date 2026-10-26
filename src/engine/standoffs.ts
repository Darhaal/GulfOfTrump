import { homeFront, type HomeFront } from "./politics";
import { bondsOf, greatPowers, isMilitary, isPact, powers, tieOf, type Bonds } from "./relations";
import type { Because, GameState, Plan, PlanEnd, PlanStage, ScenarioId } from "./types";

/**
 * Crises between states (standoffs): one explicit chain from an incident to
 * an outcome. A crisis is a war plan (engine/intentions.ts) and climbs its
 * ladder – an incident, escalation (threats and demands), preparation
 * (mobilisation), a decision at the brink, and the outcome: war, or a crisis
 * that fades. Nothing is kept beside the plan: this module reads what each
 * step stands on off the state of the world.
 *
 * - The balance: the planner and the partners it counts on, and the patrons
 *   who back it, against the target and everyone who would stand by it –
 *   its allies, its guardians, those who sanction the planner, its close
 *   friends – each weighed by its strength, its commitment and its will (how
 *   far it looks abroad, its trouble at home).
 * - The brakes: a deterrent ally, a mediator (a great power or a bloc's
 *   leader both sides trust), talks under way, the planner's trade at stake,
 *   its trouble at home (engine/politics.ts homeFront), economic pain.
 * - The spurs: a patron's backing, an autocracy's temptation to look for a
 *   quarrel abroad when things go badly at home, a target in turmoil.
 *
 * The same reading gives the odds of each step (engine/intentions.ts), the
 * reasons the news gives (`Because`), the game master's line and the panel.
 */

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** How readily governments crossed the brink in each era, once mobilised: the decision to strike. */
export const ERA_BRINK: Record<ScenarioId, number> = { "1914": 1.3, "1939": 1.4, "1950": 1, "1964": 0.9, "1991": 0.9, "1999": 0.85, "2014": 0.85, "2022": 0.85 };

/** Blocs this big (the OSCE, the Council of Europe) are too loose for their strongest member to speak for them. */
const CLOSE_BLOC = 32;
/** Trust each side needs to have in a mediator, as the mediator's own ties put it (a bloc's leader counts its bloc). */
const MEDIATOR_TRUST = 10;

/** What the world looks like to a crisis, indexed once for a pass over many plans. */
export interface Lens {
  state: GameState;
  power: Map<string, number>;
  bonds: Bonds;
  great: Set<string>;
  /** Guardians of each country: guardian → the weight of its word. */
  guards: Map<string, Map<string, number>>;
  /** Who sanctions each country. */
  sanctioners: Map<string, Set<string>>;
  /** Close friends of each country: friend → trust (40 or more). */
  friends: Map<string, Map<string, number>>;
  homes: Map<string, HomeFront>;
  wills: Map<string, number>;
  standoffs: Map<string, Standoff>;
}

export function lensOf(state: GameState, power: Map<string, number> = powers(state)): Lens {
  const guards = new Map<string, Map<string, number>>();
  const friends = new Map<string, Map<string, number>>();
  const put = (map: Map<string, Map<string, number>>, key: string, who: string, v: number) => {
    let row = map.get(key);
    if (!row) map.set(key, (row = new Map()));
    row.set(who, Math.max(v, row.get(who) ?? 0));
  };
  for (const c of Object.values(state.countries)) {
    for (const a of c.course?.aims ?? []) if (a.kind === "protect" && a.target) put(guards, a.target, c.tag, a.weight);
    for (const [other, t] of Object.entries(c.course?.ties ?? {})) if (t.trust >= 40) put(friends, other, c.tag, t.trust);
  }
  const sanctioners = new Map<string, Set<string>>();
  for (const s of state.sanctions ?? []) {
    let set = sanctioners.get(s.against);
    if (!set) sanctioners.set(s.against, (set = new Set()));
    set.add(s.by);
  }
  return { state, power, bonds: bondsOf(state), great: greatPowers(power), guards, sanctioners, friends, homes: new Map(), wills: new Map(), standoffs: new Map() };
}

const NONE = new Set<string>();
const alliesIn = (lens: Lens, tag: string) => lens.bonds.allies.get(tag) ?? NONE;
const enemiesIn = (lens: Lens, tag: string) => lens.bonds.enemies.get(tag) ?? NONE;

/** A government's trouble at home, read once. */
export function homeIn(lens: Lens, tag: string): HomeFront {
  let h = lens.homes.get(tag);
  if (!h) lens.homes.set(tag, (h = homeFront(lens.state, tag)));
  return h;
}

/**
 * A government's will to stand by others abroad, 0.2–1: how far it looks
 * abroad (support, stability, crises and war-weariness, engine/relations.ts
 * reachOf) and its trouble at home. The player's government is the player's
 * to steer.
 */
export function willIn(lens: Lens, tag: string): number {
  let w = lens.wills.get(tag);
  if (w === undefined) {
    const c = lens.state.countries[tag];
    if (!c) w = 0;
    else if (tag === lens.state.player) w = 1;
    else w = clamp((c.course ? clamp(c.course.reach / 50, 0.2, 1) : 1) * (1 - 0.5 * homeIn(lens, tag).trouble), 0.2, 1);
    lens.wills.set(tag, w);
  }
  return w;
}

/** One government that would stand by a country: its weight is its strength × commitment × will. */
export interface Supporter {
  tag: string;
  commit: number;
  weight: number;
}

/**
 * Those who would stand by a country against an enemy, the firmest first:
 * its military allies (fully), its guardians (by the weight of their word),
 * those who sanction the enemy and its close friends (a little). A
 * government allied to the enemy stays out; one bound to it by a pact counts
 * half.
 */
export function supportersOf(lens: Lens, tag: string, enemy: string, skip: readonly string[] = []): Supporter[] {
  const { state, power } = lens;
  const candidates = new Set<string>([...alliesIn(lens, tag), ...(lens.guards.get(tag)?.keys() ?? []), ...(lens.sanctioners.get(enemy) ?? []), ...(lens.friends.get(tag)?.keys() ?? [])]);
  const out: Supporter[] = [];
  for (const g of [...candidates].sort()) {
    if (g === tag || g === enemy || skip.includes(g) || !power.has(g) || !state.countries[g]) continue;
    if (alliesIn(lens, g).has(enemy) || enemiesIn(lens, g).has(tag)) continue;
    let commit = alliesIn(lens, tag).has(g) ? 1 : 0;
    // A guardian has given its word: as binding as a treaty once it weighs 40 or more.
    const word = lens.guards.get(tag)?.get(g) ?? 0;
    if (word > 0) commit = Math.max(commit, clamp(0.6 + word / 100, 0, 1));
    if (lens.sanctioners.get(enemy)?.has(g)) commit = Math.max(commit, 0.3);
    if (lens.friends.get(tag)?.has(g)) commit = Math.max(commit, 0.2);
    if (commit <= 0) continue;
    if (lens.bonds.pacts.get(g)?.has(enemy)) commit *= 0.5;
    out.push({ tag: g, commit, weight: (power.get(g) ?? 0) * commit * willIn(lens, g) });
  }
  return out.sort((a, b) => b.weight - a.weight || a.tag.localeCompare(b.tag));
}

/** The weight of everyone who stands by a country against an enemy. */
export const backingOf = (lens: Lens, tag: string, enemy: string, skip: readonly string[] = []) => supportersOf(lens, tag, enemy, skip).reduce((s, x) => s + x.weight, 0);

/**
 * The government best placed to mediate between two others, if any: a great
 * power, or the leader of a bloc both belong to, that both sides trust as far
 * as its own ties say, that stands by neither of them, fights neither and
 * plans against neither. Its strength grows with its weight against theirs,
 * the goodwill and its will. Never the player's government, whose mediation
 * is its own orders.
 */
export function mediatorOf(lens: Lens, a: string, b: string): { tag: string; strength: number } | null {
  const { state, power } = lens;
  const leaders = new Set<string>();
  for (const bloc of state.alliances) {
    if (bloc.members.length > CLOSE_BLOC || !bloc.members.includes(a) || !bloc.members.includes(b)) continue;
    if (!(isMilitary(bloc) || isPact(bloc) || bloc.kind === "organization")) continue;
    const lead = bloc.members.filter((m) => power.has(m)).sort((x, y) => (power.get(y) ?? 0) - (power.get(x) ?? 0) || x.localeCompare(y))[0];
    if (lead) leaders.add(lead);
  }
  let best: { tag: string; strength: number } | null = null;
  for (const m of [...new Set([...lens.great, ...leaders])].sort()) {
    if (m === a || m === b || m === state.player || !state.countries[m]) continue;
    const enemies = enemiesIn(lens, m);
    if (enemies.has(a) || enemies.has(b)) continue;
    const allies = alliesIn(lens, m);
    const leader = leaders.has(m);
    // A power allied to one side only, or guarding it, is that side's backer, not a broker.
    if (allies.has(a) !== allies.has(b) || lens.guards.get(a)?.has(m) || lens.guards.get(b)?.has(m)) continue;
    if ((state.plans ?? []).some((p) => !p.end && p.kind === "war" && p.by === m && (p.target === a || p.target === b))) continue;
    if ((state.countries[m].course?.hawk ?? 50) >= 70) continue;
    const goodwill = Math.min(tieOf(state, m, a).trust, tieOf(state, m, b).trust) + (leader ? 25 : 0);
    if (goodwill < MEDIATOR_TRUST) continue;
    const weight = clamp(((power.get(m) ?? 0) / Math.max(0.01, power.get(a) ?? 0, power.get(b) ?? 0)) * 0.5, 0.2, 1);
    const strength = Math.round(clamp(weight * clamp((goodwill + 20) / 60, 0, 1.2) * willIn(lens, m), 0, 1) * 100) / 100;
    if (strength >= 0.1 && (!best || strength > best.strength)) best = { tag: m, strength };
  }
  return best;
}

/** What a crisis stands on, read off the world. */
export interface Standoff {
  /** The planner's side (with its partners and patrons, its strength cut by distance) against the target's (with its backers). */
  ratio: number;
  /** The same without anyone's backers or patrons: above 0.7 the target alone could not hold, and what stops the planner is the target's friends. */
  alone: number;
  /** Those who would stand by the target, the firmest first. */
  backers: Supporter[];
  /** Those who would stand by the planner, beyond the partners it counts on. */
  patrons: Supporter[];
  mediator: { tag: string; strength: number } | null;
  /** The planner's exports at stake, 0–1: to the target and its firmest backers. */
  trade: number;
  /** The planner's standing at home. */
  home: HomeFront;
  /** The target's trouble at home, 0–1: a state in turmoil tempts. */
  turmoil: number;
  /** Talks between the two are under way. */
  talks: boolean;
}

/** What a war plan's crisis stands on; read once per plan and partners within a lens. */
export function standoffOf(lens: Lens, p: Pick<Plan, "by" | "target" | "partners">): Standoff {
  const target = p.target ?? "";
  const partners = p.partners ?? [];
  const key = `${p.by}|${target}|${partners.join(",")}`;
  const cached = lens.standoffs.get(key);
  if (cached) return cached;
  const { state, power } = lens;
  const strength = (tag: string) => power.get(tag) ?? 0;
  const near = Math.max(0.3, tieOf(state, p.by, target).near / 100);
  const backers = supportersOf(lens, target, p.by, partners);
  // A patron emboldens an attack only on a country it has a quarrel with itself (it sanctions it, the tension runs high
  // or the trust low, as for the partners a plan counts on): an ally's word to defend is no promise to back aggression –
  // Russia's place in the CSTO made Armenia, a tenth of Azerbaijan's strength with Turkey behind it, the stronger side.
  const quarrel = (g: string) => lens.sanctioners.get(target)?.has(g) || tieOf(state, g, target).tension >= 30 || tieOf(state, g, target).trust <= -20;
  const patrons = supportersOf(lens, p.by, target, [...partners, ...backers.map((x) => x.tag)]).filter((x) => quarrel(x.tag));
  const own = strength(p.by) + partners.reduce((s, x) => s + strength(x), 0);
  const mine = own + 0.3 * patrons.reduce((s, x) => s + x.weight, 0);
  const theirs = strength(target) + 0.7 * backers.reduce((s, x) => s + x.weight, 0);
  const trade = Math.min(1, ((tieOf(state, p.by, target).trade ?? 0) + backers.slice(0, 3).reduce((s, x) => s + (tieOf(state, p.by, x.tag).trade ?? 0) * x.commit, 0)) / 100);
  const talks = (state.plans ?? []).some((x) => !x.end && x.kind === "talks" && ((x.by === p.by && x.target === target) || (x.by === target && x.target === p.by)));
  const out: Standoff = {
    ratio: (mine * near) / Math.max(0.01, theirs),
    alone: (own * near) / Math.max(0.01, strength(target)),
    backers,
    patrons,
    mediator: mediatorOf(lens, p.by, target),
    trade,
    home: homeIn(lens, p.by),
    turmoil: target ? homeIn(lens, target).trouble : 0,
    talks,
  };
  lens.standoffs.set(key, out);
  return out;
}

/** One way a plan can end at its stage: why, at what rate a year, and the reason the news gives. */
export type FadePart = [PlanEnd, number, Because?];

/** All the ways a plan can end at its stage, summed: the strongest names why it ends when it does. */
export function pickFade(parts: FadePart[]): { fade: number; why: PlanEnd; because?: Because } {
  let fade = 0;
  let best: FadePart | null = null;
  for (const part of parts) {
    if (!(part[1] > 0)) continue;
    fade += part[1];
    if (!best || part[1] > best[1]) best = part;
  }
  return { fade, why: best?.[0] ?? "compromise", ...(best?.[2] ? { because: best[2] } : {}) };
}

/** Trouble at home as the news tells it. */
export const homeBecause = (home: HomeFront): Because | undefined => (home.why ? { kind: home.why } : undefined);

/** How trouble at home ends a plan: the economy's sake, or protests and an unpopular government. */
export const homeEnd = (home: HomeFront): PlanEnd => (home.why === "slump" || home.why === "inflation" || home.why === "sanctions" ? "economy" : "unrest");

/** How much a great power's guarantee weighs in each era: since the bomb, few dare a war that could draw one in. */
const GUARANTEE: Record<ScenarioId, number> = { "1914": 0, "1939": 0, "1950": 0.6, "1964": 1, "1991": 1, "1999": 1, "2014": 1, "2022": 1 };

/**
 * The weight of a great power's guarantee behind the target, 0–2: a great
 * power standing firmly by it (an ally, or a guardian whose word weighs),
 * against the planner's own strength, in the era's measure. Nothing when the
 * planner has a patron of its own that could face the guarantor (half its
 * weight or more): then they deter each other and the balance decides.
 */
export function guarantee(lens: Lens, s: Standoff, by: string): { weight: number; by?: string } {
  const era = GUARANTEE[lens.state.scenarioId];
  const guard = s.backers.find((b) => lens.great.has(b.tag) && b.commit >= 0.8);
  if (!era || !guard) return { weight: 0 };
  const firm = (tag: string) => (lens.power.get(tag) ?? 0) * willIn(lens, tag);
  const theirs = firm(guard.tag);
  if (s.patrons.some((p) => p.commit >= 0.8 && firm(p.tag) >= 0.5 * theirs)) return { weight: 0 };
  return { weight: era * clamp(theirs / Math.max(0.01, lens.power.get(by) ?? 0), 0, 2), by: guard.tag };
}

/** Being outmatched, told apart from being deterred: when the target alone could not hold, it is its backers that stop the planner. */
export function deterrence(s: Standoff, rate: number): FadePart {
  if (s.alone >= 0.7 && s.backers.length) return ["deterred", rate, { kind: "deterrent", country: s.backers[0].tag }];
  return ["outmatched", rate];
}

/** How a crisis began: the incident it grew from (its kind and month), a claim on land, an old ambition. */
export function originOf(state: Pick<GameState, "chronicle">, p: Pick<Plan, "origin" | "cause">): Because | undefined {
  const m = p.origin?.match(/^i(\d+)-/);
  if (m) {
    const entry = state.chronicle.find((e) => e.turn === Number(m[1]));
    const incident = entry?.applied.find((c) => c.kind === "incident" && c.id === p.origin);
    if (entry && incident?.kind === "incident") return { kind: "incident", incident: incident.what, date: entry.from.slice(0, 7) };
  }
  if (p.cause === "claim") return { kind: "claim" };
  if (p.cause === "ambition") return { kind: "ambition" };
  return undefined;
}

/** What drives a crisis on, the strongest first: a patron's backing, an autocracy's diversion, a target in turmoil's temptation (told as its origin). */
export function spursOf(s: Standoff): Because[] {
  const out: Because[] = [];
  if (s.patrons[0] && s.patrons[0].weight >= 0.02) out.push({ kind: "backing", country: s.patrons[0].tag });
  if (!s.home.votes && s.home.trouble >= 0.3) out.push({ kind: "diversion" });
  return out;
}

/** What holds a crisis back, the strongest first: a deterrent ally (or a great power's guarantee), a mediator, talks, trade at stake, trouble at home. */
export function brakesOf(s: Standoff, guard: { weight: number; by?: string } = { weight: 0 }): Because[] {
  const out: Because[] = [];
  if (s.backers[0] && s.alone >= 0.7 && s.ratio < 1) out.push({ kind: "deterrent", country: s.backers[0].tag });
  else if (guard.by && guard.weight >= 0.3) out.push({ kind: "deterrent", country: guard.by });
  if (s.mediator) out.push({ kind: "mediation", country: s.mediator.tag });
  if (s.talks) out.push({ kind: "talks" });
  if (s.trade >= 0.12) out.push({ kind: "trade" });
  if (s.home.why && (s.home.votes ? s.home.trouble >= 0.25 : s.home.pain >= 0.3)) out.push({ kind: s.home.why });
  return out;
}

/** What a crisis grows on when it reaches a stage, for the news: its origin at escalation; a patron, a diversion or its origin later. */
export function growthBecause(state: GameState, s: Standoff, p: Pick<Plan, "origin" | "cause">, stage: PlanStage): Because | undefined {
  if (stage === "tension" || stage === "incident") return originOf(state, p);
  return spursOf(s)[0] ?? originOf(state, p);
}

/** A live crisis as the player and the game master see it. */
export interface CrisisView {
  plan: Plan;
  stage: PlanStage;
  origin?: Because;
  spurs: Because[];
  brakes: Because[];
  /** It touches the player's country or a great power. */
  concerns: boolean;
}

/** One crisis, read. */
export function crisisView(lens: Lens, p: Plan): CrisisView {
  const s = standoffOf(lens, p);
  const sides = [p.by, ...(p.target ? [p.target] : []), ...(p.partners ?? [])];
  const concerns = sides.some((t) => t === lens.state.player || lens.great.has(t)) || s.backers.some((b) => b.tag === lens.state.player);
  const origin = originOf(lens.state, p);
  return { plan: p, stage: p.stage, ...(origin ? { origin } : {}), spurs: spursOf(s), brakes: brakesOf(s, guarantee(lens, s, p.by)), concerns };
}

/** The live crises – every war plan under way – those touching the player or a great power first, then the furthest along. */
export function liveCrises(state: GameState, lens: Lens = lensOf(state)): CrisisView[] {
  const order: PlanStage[] = ["incident", "tension", "preparation", "decision", "action"];
  return (state.plans ?? [])
    .filter((p) => !p.end && p.kind === "war" && p.target)
    .map((p) => crisisView(lens, p))
    .sort((a, b) => Number(b.concerns) - Number(a.concerns) || order.indexOf(b.stage) - order.indexOf(a.stage) || (lens.power.get(b.plan.by) ?? 0) - (lens.power.get(a.plan.by) ?? 0) || a.plan.id.localeCompare(b.plan.id));
}

/** A reason in a few English words, for the game master. */
export function becauseEn(b: Because, name: (tag: string) => string): string {
  switch (b.kind) {
    case "incident":
      return `after a ${b.incident ?? "border"} incident${b.date ? ` (${b.date})` : ""}`;
    case "claim":
      return "a claim on land";
    case "ambition":
      return "old ambitions";
    case "backing":
      return `${name(b.country ?? "?")} backs it`;
    case "diversion":
      return "a diversion from trouble at home";
    case "deterrent":
      return `${name(b.country ?? "?")} stands by the target`;
    case "mediation":
      return `${name(b.country ?? "?")} mediates`;
    case "talks":
      return "talks under way";
    case "trade":
      return "trade at stake";
    case "weak":
      return "an unpopular government";
    case "unrest":
      return "unrest at home";
    case "election":
      return "an election near";
    case "slump":
      return "a slump";
    case "inflation":
      return "soaring prices";
    case "sanctions":
      return "sanctions biting";
    case "election-lost":
      return "a lost election";
    case "coup":
      return "a coup";
    case "new-government":
      return "a new government";
    case "war":
      return "a war dragging on";
    case "war-on":
      return `its war on ${name(b.country ?? "?")}`;
    case "defeat":
      return "defeats in war";
    case "tenure":
      return "long years in power";
  }
}

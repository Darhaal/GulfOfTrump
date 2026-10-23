import { lostShares, yearsBetween } from "./abroad";
import { countryCrises } from "./crises";
import { fixed, roll } from "./dice";
import { countryCentres, distanceKm, exportShares } from "./trade";
import { STRATEGIC_KINDS } from "./types";
import type { Aim, Alliance, AppliedChange, Course, DeedKind, GameState, MapRegion, RegimeKind, ScenarioId, Tie, War } from "./types";

/**
 * How the governments that matter see the world, kept by the engine with no
 * model call: each one's course (its appetite for force, how far it looks
 * abroad, what it wants), its ties to the countries that matter to it (trust,
 * tension, the threat it sees, how close and how much trade), and its memory
 * of who helped and who betrayed it. A new government brings a new course.
 * The plans these feed are in engine/intentions.ts.
 */

/** The countries that keep a course: the strongest in arms and money, the largest economies, and any at war or in a plan. */
export const ACTORS = 32;
const ECONOMIES = 24;
const MAX_TIES = 10;
/** Ties a government keeps whatever their salience: its enemies and those in its plans. */
const MAX_TIES_KEPT = 14;
const MAX_MEMORY = 8;
export const MAX_AIMS = 3;
/** Blocs this big are world bodies, not alliances anyone counts on (NATO has 30 members in 2022, the UN 60 in 1950). */
const WORLD_BODY = 60;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const int = (value: number) => Math.round(value);

/** Appetite for force by the kind of government, before its era and how it came to power. */
const HAWK_BASE: Record<RegimeKind, number> = { democracy: 35, limited: 45, party: 50, autocracy: 55, military: 65 };
/** How readily states reached for force in each era. */
const ERA_HAWK: Record<ScenarioId, number> = { "1914": 10, "1939": 10, "1950": 5, "1964": 5, "1991": 0, "1999": 0, "2014": 0, "2022": 0 };

/** Every country that holds land. */
export function landHolders(state: Pick<GameState, "regions">): Set<string> {
  return new Set(Object.values(state.regions).map((r) => r.owner));
}

/** Each country's strength, 0–1: three parts its share of the largest economy, two parts of the largest army. */
export function powers(state: Pick<GameState, "countries" | "regions">, holders = landHolders(state)): Map<string, number> {
  let gdp = 0;
  let troops = 0;
  for (const c of Object.values(state.countries)) {
    if (!c.economy || !holders.has(c.tag)) continue;
    gdp = Math.max(gdp, c.economy.gdp);
    troops = Math.max(troops, c.economy.troops);
  }
  const out = new Map<string, number>();
  for (const c of Object.values(state.countries)) {
    if (!c.economy || !holders.has(c.tag)) continue;
    out.set(c.tag, 0.6 * (gdp > 0 ? c.economy.gdp / gdp : 0) + 0.4 * (troops > 0 ? c.economy.troops / troops : 0));
  }
  return out;
}

/** A bloc that binds its members to fight for each other, not a world body. */
export const isMilitary = (a: Alliance) => (!a.kind || a.kind === "alliance") && a.members.length < WORLD_BODY;
export const isPact = (a: Alliance) => a.kind === "pact" && a.members.length < WORLD_BODY;

/** Whether two countries share a military alliance. */
export const allied = (state: Pick<GameState, "alliances">, a: string, b: string) => state.alliances.some((x) => isMilitary(x) && x.members.includes(a) && x.members.includes(b));
/** Whether two countries share a pact (non-aggression, friendship). */
export const pacted = (state: Pick<GameState, "alliances">, a: string, b: string) => state.alliances.some((x) => isPact(x) && x.members.includes(a) && x.members.includes(b));

/** The war two countries fight on opposite sides, if any (a truce does not end it). */
export function warBetween(state: Pick<GameState, "wars">, a: string, b: string): War | undefined {
  return state.wars.find((w) => (w.attackers.includes(a) && w.defenders.includes(b)) || (w.attackers.includes(b) && w.defenders.includes(a)));
}

/** Everyone a country fights. */
export function enemiesOf(state: Pick<GameState, "wars">, tag: string): Set<string> {
  const out = new Set<string>();
  for (const w of state.wars) {
    if (w.attackers.includes(tag)) w.defenders.forEach((t) => out.add(t));
    if (w.defenders.includes(tag)) w.attackers.forEach((t) => out.add(t));
  }
  return out;
}

/** Its military allies. */
export function alliesOf(state: Pick<GameState, "alliances">, tag: string): Set<string> {
  const out = new Set<string>();
  for (const a of state.alliances) if (isMilitary(a) && a.members.includes(tag)) a.members.forEach((m) => m !== tag && out.add(m));
  return out;
}

/** Where trust settles between two countries, by their treaties and wars. */
export function trustBase(state: Pick<GameState, "alliances" | "wars">, a: string, b: string): number {
  if (warBetween(state, a, b)) return -60;
  if (allied(state, a, b)) return 30;
  if (pacted(state, a, b)) return 15;
  return 0;
}

/** Who is bound to whom — military allies, pact partners, enemies — indexed once for a pass over many pairs. */
export interface Bonds {
  allies: Map<string, Set<string>>;
  pacts: Map<string, Set<string>>;
  enemies: Map<string, Set<string>>;
}

const NONE = new Set<string>();

export function bondsOf(state: Pick<GameState, "alliances" | "wars">): Bonds {
  const bonds: Bonds = { allies: new Map(), pacts: new Map(), enemies: new Map() };
  const add = (map: Map<string, Set<string>>, a: string, b: string) => {
    let set = map.get(a);
    if (!set) map.set(a, (set = new Set()));
    set.add(b);
  };
  for (const a of state.alliances) {
    const map = isMilitary(a) ? bonds.allies : isPact(a) ? bonds.pacts : null;
    if (map) for (const x of a.members) for (const y of a.members) if (x !== y) add(map, x, y);
  }
  for (const w of state.wars) {
    for (const x of w.attackers) {
      for (const y of w.defenders) {
        add(bonds.enemies, x, y);
        add(bonds.enemies, y, x);
      }
    }
  }
  return bonds;
}

const bound = (map: Map<string, Set<string>>, a: string) => map.get(a) ?? NONE;

/** Where trust settles, read from the bonds. */
const baseOf = (b: Bonds, a: string, x: string) => (bound(b.enemies, a).has(x) ? -60 : bound(b.allies, a).has(x) ? 30 : bound(b.pacts, a).has(x) ? 15 : 0);

/** How one government sees another: its tie, or where their treaties put it. */
export function tieOf(state: Pick<GameState, "countries" | "alliances" | "wars">, a: string, b: string): Tie {
  return state.countries[a]?.course?.ties[b] ?? { trust: trustBase(state, a, b), tension: warBetween(state, a, b) ? 80 : 0, threat: 0, near: 50 };
}

/** The tie of a course to a country, made when missing. */
function tie(state: Pick<GameState, "alliances" | "wars">, course: Course, a: string, b: string): Tie {
  return (course.ties[b] ??= { trust: trustBase(state, a, b), tension: warBetween(state, a, b) ? 80 : 0, threat: 0, near: 50 });
}

/** How close two countries are, 0–100, from where their people live. */
const closeness = (at: Map<string, [number, number]>, a: string, b: string): number | undefined => {
  const pa = at.get(a);
  const pb = at.get(b);
  if (!pa || !pb) return undefined;
  return int(100 * clamp(1 - (distanceKm(pa, pb) - 600) / 3000, 0.1, 1));
};

/** A government's appetite for force when it takes office. */
export function hawkFor(regime: RegimeKind, era: ScenarioId, how: Course["set"]["how"], before: number | undefined, noise: number): number {
  const base = HAWK_BASE[regime] + ERA_HAWK[era];
  let hawk = base;
  if (how === "coup") hawk = base + 10;
  // Voters who threw out a government chose its opposite as often as not.
  else if (how === "election" && before !== undefined) hawk = 0.5 * base + 0.5 * (100 - before);
  else if (how === "leader" && before !== undefined) hawk = 0.7 * before + 0.3 * base;
  return int(clamp(hawk + noise, 5, 95));
}

/** A spread of ±12 from a roll in [0, 1). */
const spread = (r: number) => (r - 0.5) * 24;

/** How far a government looks abroad: support and stability let it, crises, lost land and a long war turn it inward. */
export function reachOf(state: GameState, tag: string, lost: number, great: boolean): number {
  const c = state.countries[tag];
  const d = c?.domestic;
  if (!d) return 50;
  const critical = countryCrises(state, tag).filter((x) => x.level === "critical").length;
  const wars = state.wars.filter((w) => w.attackers.includes(tag) || w.defenders.includes(tag));
  const long = wars.some((w) => yearsBetween(w.since, state.date) > 2);
  return int(clamp(50 + 0.5 * (d.support - 50) + 0.3 * (d.stability - 50) - 12 * critical - 60 * lost - (long ? 10 : 0) + (great ? 10 : 0), 5, 95));
}

/** The countries that keep a course: the strongest that hold land, the largest economies, and any at war or planning. */
export function actorsOf(state: Pick<GameState, "countries" | "regions" | "wars" | "player" | "plans">, power = powers(state)): Set<string> {
  const candidates = [...power.keys()].filter((tag) => tag !== state.player && !state.countries[tag]?.exile);
  const top = (score: (tag: string) => number, n: number) => [...candidates].sort((a, b) => score(b) - score(a) || a.localeCompare(b)).slice(0, n);
  const out = new Set([...top((tag) => power.get(tag) ?? 0, ACTORS), ...top((tag) => state.countries[tag]?.economy?.gdp ?? 0, ECONOMIES)]);
  for (const w of state.wars) for (const tag of [...w.attackers, ...w.defenders]) if (power.has(tag) && tag !== state.player) out.add(tag);
  // Only a strategic plan makes a government one that matters; a peaceful plan is any state's (engine/policies.ts).
  for (const p of state.plans ?? []) if (!p.end && STRATEGIC_KINDS.includes(p.kind)) for (const tag of [p.by, ...(p.partners ?? [])]) if (power.has(tag) && tag !== state.player) out.add(tag);
  return out;
}

/** The great powers: the six strongest. */
export function greatPowers(power: Map<string, number>): Set<string> {
  return new Set([...power].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([tag]) => tag));
}

/** A new course for a country: its government's appetite for force, its aims (the scenario's and what it lost), its ties by treaty. */
export function freshCourse(state: GameState, tag: string, seeded: { aims: Aim[]; hawk?: number; trust?: [string, number][] }, date: string, occupied = occupiedBy(state)): Course {
  const d = state.countries[tag]?.domestic;
  const noise = spread(fixed(`hawk:${state.scenarioId}:${tag}`));
  const hawk = seeded.hawk ?? hawkFor(d?.regime ?? "autocracy", state.scenarioId, "start", undefined, noise);
  const course: Course = { hawk, reach: 50, aims: [...seeded.aims].slice(0, MAX_AIMS), ties: {}, memory: [], set: { date, how: "start" } };
  for (const e of enemiesOf(state, tag)) tie(state, course, tag, e);
  for (const a of alliesOf(state, tag)) tie(state, course, tag, a);
  for (const aim of course.aims) if (aim.target && state.countries[aim.target]) tie(state, course, tag, aim.target);
  for (const [other, trust] of seeded.trust ?? []) if (state.countries[other] && other !== tag) tie(state, course, tag, other).trust = trust;
  addClaims(tag, course, occupied);
  return course;
}

/** Provinces each country owns that others hold: owner → holder → how many. */
export function occupiedBy(state: Pick<GameState, "regions">): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  for (const r of Object.values(state.regions)) {
    if (r.owner === r.controller) continue;
    let row = out.get(r.owner);
    if (!row) out.set(r.owner, (row = new Map()));
    row.set(r.controller, (row.get(r.controller) ?? 0) + 1);
  }
  return out;
}

/** Land a country owns that another holds: a claim to win back, the strongest holder first. */
function addClaims(tag: string, course: Course, occupied: Map<string, Map<string, number>>): void {
  const held = occupied.get(tag);
  if (!held) return;
  for (const [by, n] of [...held].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
    if (course.aims.some((a) => a.kind === "reclaim" && a.target === by)) continue;
    if (course.aims.length >= MAX_AIMS) break;
    course.aims.push({ kind: "reclaim", target: by, weight: int(clamp(40 + 5 * n, 40, 90)) });
  }
}

/** Something another country did, remembered: trust moves by its weight and the deed joins the memory. */
export function remember(state: GameState, who: string, by: string, what: DeedKind, weight: number, date: string, keep = true): void {
  const course = state.countries[who]?.course;
  if (!course || who === by || !state.countries[by]) return;
  const t = tie(state, course, who, by);
  t.trust = int(clamp(t.trust + weight, -100, 100));
  if (!keep) return;
  course.memory.push({ by, what, date, weight: int(weight) });
  // The three newest stay; of the rest, the deed that weighs least is forgotten first.
  while (course.memory.length > MAX_MEMORY) {
    const old = course.memory.slice(0, -3);
    let drop = 0;
    old.forEach((m, i) => {
      if (Math.abs(m.weight) < Math.abs(old[drop].weight)) drop = i;
    });
    course.memory.splice(drop, 1);
  }
}

/** Tension one government feels toward another rises. */
export function addTension(state: GameState, who: string, toward: string, amount: number): void {
  const course = state.countries[who]?.course;
  if (!course || who === toward || !state.countries[toward]) return;
  const t = tie(state, course, who, toward);
  t.tension = int(clamp(t.tension + amount, 0, 100));
}

/** Time softens: tension halves in a year, trust drifts back to where the treaties put it in eight. */
export function easeTies(state: GameState, years: number): void {
  const tension = 0.5 ** years;
  const trust = 0.5 ** (years / 8);
  const bonds = bondsOf(state);
  for (const c of Object.values(state.countries)) {
    if (!c.course) continue;
    for (const [other, t] of Object.entries(c.course.ties)) {
      const base = baseOf(bonds, c.tag, other);
      t.trust = int(base + (t.trust - base) * trust);
      // A war keeps tension high.
      t.tension = int(Math.max(bound(bonds.enemies, c.tag).has(other) ? 70 : 0, t.tension * tension));
    }
  }
}

/**
 * What this turn's changes teach each government about the others: who
 * attacked it, who came to its aid or joined its enemies, who left its bloc,
 * sanctioned or paid it, made peace, or took its land outside a war. The
 * player's deeds are remembered like anyone's.
 */
export function learnFromTurn(before: GameState, next: GameState, applied: AppliedChange[], date: string): void {
  for (const c of applied) {
    if (c.kind === "war") {
      const war = next.wars.find((w) => w.id === c.war);
      if (!war) continue;
      for (const d of war.defenders) {
        for (const a of war.attackers) {
          if (pacted(before, a, d)) remember(next, d, a, "broke-pact", -70, date);
          else remember(next, d, a, "attacked", -50, date);
          addTension(next, a, d, 80);
          addTension(next, d, a, 80);
        }
      }
      continue;
    }
    if (c.kind === "enter") {
      const war = next.wars.find((w) => w.id === c.war);
      if (!war) continue;
      const friends = war[c.side].filter((t) => t !== c.country);
      const foes = war[c.side === "attackers" ? "defenders" : "attackers"];
      for (const f of friends) remember(next, f, c.country, "came-to-aid", 30, date, friends.length <= 4);
      for (const e of foes) {
        remember(next, e, c.country, "joined-enemy", -35, date, foes.length <= 4);
        addTension(next, e, c.country, 70);
        addTension(next, c.country, e, 70);
      }
      continue;
    }
    if (c.kind === "leave") {
      const bloc = before.alliances.find((a) => a.id === c.alliance);
      if (!bloc || !(isMilitary(bloc) || isPact(bloc))) continue;
      for (const m of bloc.members) if (m !== c.country) remember(next, m, c.country, "left-bloc", -20, date, bloc.members.length <= 6);
      continue;
    }
    if (c.kind === "alliance") {
      const bloc = next.alliances.find((a) => a.id === c.alliance);
      if (!bloc || !(isMilitary(bloc) || isPact(bloc))) continue;
      for (const a of bloc.members) for (const b of bloc.members) if (a !== b) remember(next, a, b, "allied", 15, date, bloc.members.length <= 3);
      continue;
    }
    if (c.kind === "sanction") {
      if (c.change === "lifted") remember(next, c.against, c.by, "sanctioned", 5, date, false);
      else {
        remember(next, c.against, c.by, "sanctioned", c.change === "full" ? -25 : -15, date);
        addTension(next, c.against, c.by, 15);
      }
      continue;
    }
    if (c.kind === "funds") {
      if (!["grant", "aid", "arms"].includes(c.type) || !next.countries[c.from]) continue;
      const gdp = Math.max(0.01, next.countries[c.to]?.economy?.gdp ?? 1);
      remember(next, c.to, c.from, "aided", clamp((c.amount / gdp) * 200, 3, 20), date);
      continue;
    }
    if (c.kind === "peace" && c.sides) {
      const war = before.wars.find((w) => w.id === c.war);
      if (!war) continue;
      const small = war.attackers.length <= 3 && war.defenders.length <= 3;
      for (const a of war.attackers) {
        for (const d of war.defenders) {
          remember(next, a, d, "made-peace", 10, date, small);
          remember(next, d, a, "made-peace", 10, date, small);
          const ta = next.countries[a]?.course?.ties[d];
          const td = next.countries[d]?.course?.ties[a];
          if (ta) ta.tension = int(ta.tension * 0.5);
          if (td) td.tension = int(td.tension * 0.5);
        }
      }
      continue;
    }
  }
  // Land taken outside a war between the two: an occupation, and an outrage.
  const taken = new Map<string, Set<string>>();
  for (const c of applied) {
    if ((c.kind === "occupy" || c.kind === "annex") && c.from !== c.to && next.countries[c.from] && !warBetween(before, c.from, c.to) && !warBetween(next, c.from, c.to)) {
      const set = taken.get(c.from) ?? new Set<string>();
      set.add(c.to);
      taken.set(c.from, set);
    }
  }
  for (const [victim, takers] of taken) {
    for (const by of takers) {
      remember(next, victim, by, "occupied", -40, date);
      addTension(next, victim, by, 40);
    }
  }
}

/** The incidents the game master told of: an event of war between two countries not at war raises tension both ways, a little. */
export function incidentsFromEvents(next: GameState, events: { kind: string; countries: string[] }[]): Map<string, number> {
  const raised = new Map<string, number>();
  for (const e of events) {
    if (e.kind !== "war" && e.kind !== "military") continue;
    const tags = [...new Set(e.countries)].filter((t) => next.countries[t]).slice(0, 4);
    for (const a of tags) {
      for (const b of tags) {
        if (a >= b || warBetween(next, a, b)) continue;
        const key = `${a}|${b}`;
        const now = raised.get(key) ?? 0;
        if (now >= 16) continue;
        raised.set(key, now + 8);
        addTension(next, a, b, 8);
        addTension(next, b, a, 8);
      }
    }
  }
  return raised;
}

/**
 * A government that changed this turn brings its own course: a new appetite
 * for force (an election swings it, a coup hardens it), and its aims judged
 * again. Returns the countries whose course was set anew.
 */
export function newGovernments(next: GameState, from: string): string[] {
  const out: string[] = [];
  for (const c of Object.values(next.countries)) {
    const changed = c.domestic?.changed;
    if (!c.course || !changed || changed.date <= from || changed.date <= c.course.set.date) continue;
    const before = c.course.hawk;
    const noise = spread(roll(next.seed ?? next.id, next.turn, `hawk:${c.tag}`));
    const hawk = hawkFor(c.domestic!.regime, next.scenarioId, changed.how, before, noise);
    c.course.hawk = hawk;
    c.course.set = { date: changed.date, how: changed.how };
    // Old ambitions outlive only a government with the appetite for them; a claim on lost land stays, weighed by it.
    c.course.aims = c.course.aims
      .map((a) => (a.kind === "expand" ? { ...a, weight: hawk >= 50 ? a.weight : int(a.weight / 2) } : a.kind === "reclaim" ? { ...a, weight: int(clamp(a.weight * (0.5 + hawk / 100), 10, 100)) } : a))
      .filter((a) => a.weight >= 15);
    out.push(c.tag);
  }
  return out;
}

/**
 * Every course looks at the world again: how far the government looks
 * abroad, its aims (a claim on land others took), and its ties — the
 * closeness and trade of each country (with the map), the threat it sees,
 * and which countries matter most to it.
 */
export function refreshCourses(next: GameState, map: Record<string, MapRegion> | null, power: Map<string, number>): void {
  const lost = lostShares(next, map);
  const great = greatPowers(power);
  const at = map ? countryCentres(next, map) : null;
  const courses = Object.values(next.countries).filter((c) => c.course);
  const shares = at ? exportShares(next, courses.map((c) => c.tag), at) : null;
  const bonds = bondsOf(next);
  const occupied = occupiedBy(next);
  const candidates = [...power.keys()];
  // Live war plans by planner: a visible plan makes its target afraid.
  const plansAgainst = new Map<string, Set<string>>();
  for (const p of next.plans ?? []) {
    if (p.end || p.kind !== "war" || !p.target || p.stage === "incident" || p.stage === "decision") continue;
    const set = plansAgainst.get(p.target) ?? new Set<string>();
    set.add(p.by);
    plansAgainst.set(p.target, set);
  }
  for (const c of courses) {
    const course = c.course!;
    course.reach = reachOf(next, c.tag, lost.get(c.tag) ?? 0, great.has(c.tag));
    addClaims(c.tag, course, occupied);
    // Aims at countries that are gone go with them.
    course.aims = course.aims.filter((a) => !a.target || power.has(a.target) || next.countries[a.target]?.dormant);

    const pa = power.get(c.tag) ?? 0;
    const enemies = bound(bonds.enemies, c.tag);
    const mine = bound(bonds.allies, c.tag);
    const pacts = bound(bonds.pacts, c.tag);
    const row = shares?.get(c.tag);
    const planned = new Set<string>();
    for (const p of next.plans ?? []) {
      if (p.end) continue;
      if (p.by === c.tag) [p.target, ...(p.partners ?? [])].forEach((x) => x && planned.add(x));
      if (p.target === c.tag) planned.add(p.by);
    }
    const remembered = new Set(course.memory.map((m) => m.by));
    const aimed = new Set(course.aims.map((a) => a.target));
    // Those it stands by: an attack on them is an attack on its own interests.
    const guarded = new Set([...mine, ...course.aims.filter((a) => a.kind === "protect" && a.target).map((a) => a.target!)]);
    const scored: { tag: string; salience: number; kept: boolean; tie: Tie }[] = [];
    for (const other of candidates) {
      if (other === c.tag) continue;
      const existing = course.ties[other];
      const near = (at && closeness(at, c.tag, other)) ?? existing?.near ?? 50;
      const share = row ? (row.get(other) ?? 0) : (existing?.trade ?? 0) / 100;
      const base = baseOf(bonds, c.tag, other);
      const t = existing ?? { trust: base, tension: 0, threat: 0, near };
      const pb = power.get(other) ?? 0;
      const theirs = bound(bonds.allies, other);
      let rival = false;
      for (const x of theirs) if (enemies.has(x) || (course.ties[x]?.trust ?? 0) <= -30) rival = true;
      let fightsFriends = false;
      for (const x of bound(bonds.enemies, other)) if (guarded.has(x)) fightsFriends = true;
      let hostility = 0.25 + t.tension / 100 + Math.max(0, -t.trust) / 100;
      if (rival) hostility += 0.3;
      if (fightsFriends) hostility += 0.5;
      if (plansAgainst.get(c.tag)?.has(other)) hostility += 0.4;
      if (enemies.has(other)) hostility += 1;
      if (mine.has(other)) hostility -= 0.7;
      else if (pacts.has(other)) hostility -= 0.3;
      const reach = pb * (near / 100);
      const threat = int(clamp((100 * reach) / (pa + reach + 0.01) * clamp(hostility, 0, 1.5), 0, 100));
      const kept = enemies.has(other) || aimed.has(other) || remembered.has(other) || planned.has(other);
      const salience = threat + t.tension + Math.abs(t.trust - base) / 2 + 100 * share + (mine.has(other) ? 25 + 40 * pb : 0) + (other === next.player ? 10 : 0);
      const updated: Tie = { trust: t.trust, tension: t.tension, threat, near };
      if (share > 0.005) updated.trade = int(share * 100);
      scored.push({ tag: other, salience, kept, tie: updated });
    }
    scored.sort((a, b) => Number(b.kept) - Number(a.kept) || b.salience - a.salience);
    course.ties = Object.fromEntries(scored.filter((s, i) => (s.kept && i < MAX_TIES_KEPT) || i < MAX_TIES).map((s) => [s.tag, s.tie]));
  }
}

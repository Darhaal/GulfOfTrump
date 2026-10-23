import { roll } from "./dice";
import { STEP_YEARS } from "./economy";
import { bondsOf, landHolders, occupiedBy, powers, remember, addTension, tieOf, warBetween } from "./relations";
import { countryCentres, distanceKm } from "./trade";
import type { AppliedChange, GameState, IncidentAnswer, IncidentCause, IncidentKind, MapRegion, Plan, RegimeKind, ScenarioId } from "./types";

/**
 * Incidents: crises that grow out of the state of the world, between any two
 * states, not out of a calendar. Every turn the engine weighs the friction
 * between pairs of states – claims on land, tension and distrust, rival
 * blocs, sanctions, opposed regimes next door, a war nearby – and casts the
 * period's incidents from it before the turn, so the game master tells them
 * in the same period: a border clash, an airspace violation, a spy
 * scandal… Each raises tension, costs trust, is remembered, and draws an
 * answer by the dice: a war plan, sanctions, talks, or protests alone. The
 * same quarrel can end in war in one game and in talks in another.
 */

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Incidents a year between two states at a friction of 1, close to each other, by era. */
const ERA_RATE: Record<ScenarioId, number> = { "1914": 0.3, "1939": 0.35, "1950": 0.3, "1964": 0.3, "1991": 0.25, "1999": 0.25, "2014": 0.25, "2022": 0.25 };
/** How readily an incident turned into a march towards war in each era. */
const ESCALATE: Record<ScenarioId, number> = { "1914": 0.5, "1939": 0.6, "1950": 0.4, "1964": 0.4, "1991": 0.4, "1999": 0.35, "2014": 0.35, "2022": 0.35 };
/** Live war plans at once, by era (engine/intentions.ts keeps to it too). */
export const WAR_PLANS: Record<ScenarioId, number> = { "1914": 6, "1939": 8, "1950": 4, "1964": 4, "1991": 4, "1999": 4, "2014": 4, "2022": 4 };
/** Pairs of states whose people live this close count as neighbours, km. */
const NEIGHBOURS_KM = 1000;
/** Friction below this is too little for an incident. */
const MIN_FRICTION = 0.4;
/** What an incident adds to the offended side's tension, and takes from its trust. */
const SEVERITY: Record<IncidentKind, [number, number]> = {
  border: [25, 10],
  airspace: [15, 6],
  naval: [18, 7],
  spy: [12, 6],
  expulsion: [10, 5],
  cyber: [14, 6],
  trade: [10, 4],
  minority: [20, 8],
};
const HAWK_BASE: Record<RegimeKind, number> = { democracy: 35, limited: 45, party: 50, autocracy: 55, military: 65 };

export interface Incident {
  id: string;
  /** Who provoked it. */
  by: string;
  target: string;
  what: IncidentKind;
  why: IncidentCause;
  answer: IncidentAnswer;
  /** Who answers with a plan: the planner of the war, the government that sanctions or offers talks. */
  responder?: string;
}

type Point = [number, number];

const hawkOf = (state: GameState, tag: string) => state.countries[tag]?.course?.hawk ?? HAWK_BASE[state.countries[tag]?.domestic?.regime ?? "autocracy"];
const autocratic = (r: RegimeKind | undefined) => r === "autocracy" || r === "party" || r === "military";

/**
 * The period's incidents, cast from the state before it: the same state and
 * map cast the same, on the server that writes the prompt and in the browser
 * that applies the answer. Without the map only the pairs the courses keep
 * ties for are weighed.
 */
export function castIncidents(state: GameState, map?: Record<string, MapRegion> | null, neighbors?: Record<string, string[]> | null): Incident[] {
  const era = state.scenarioId;
  const years = STEP_YEARS[state.step];
  const game = state.seed ?? state.id;
  const dice = (key: string) => roll(game, state.turn, key);
  const holders = landHolders(state);
  const alive = Object.values(state.countries)
    .filter((c) => holders.has(c.tag) && !c.exile && !c.dormant && c.economy)
    .map((c) => c.tag)
    .sort();
  const up = new Set(alive);
  const centres: Map<string, Point> | null = map ? countryCentres(state, map) : null;
  // Who has a coast, for incidents at sea; without the map everyone may.
  const coast = map ? new Set(Object.entries(state.regions).filter(([id]) => map[id]?.coastal).map(([, r]) => r.owner)) : null;
  // Who shares a land border, for clashes on it; without the map's neighbours, states whose people live very close.
  const borders = new Set<string>();
  if (neighbors) {
    for (const [id, r] of Object.entries(state.regions)) {
      for (const n of neighbors[id] ?? []) {
        const o = state.regions[n]?.owner;
        if (o && o !== r.owner) borders.add(r.owner < o ? `${r.owner}|${o}` : `${o}|${r.owner}`);
      }
    }
  }
  const pairs = new Map<string, [string, string]>();
  const add = (a: string, b: string) => {
    if (a === b || !up.has(a) || !up.has(b)) return;
    const [x, y] = a < b ? [a, b] : [b, a];
    pairs.set(`${x}|${y}`, [x, y]);
  };
  for (const tag of alive) for (const other of Object.keys(state.countries[tag].course?.ties ?? {})) add(tag, other);
  for (const key of borders) {
    const [a, b] = key.split("|");
    add(a, b);
  }
  if (centres) {
    for (let i = 0; i < alive.length; i++) {
      const pa = centres.get(alive[i]);
      if (!pa) continue;
      for (let j = i + 1; j < alive.length; j++) {
        const pb = centres.get(alive[j]);
        if (pb && distanceKm(pa, pb) < NEIGHBOURS_KM) add(alive[i], alive[j]);
      }
    }
  }
  if (!pairs.size) return [];
  const bonds = bondsOf(state);
  const none = new Set<string>();
  const occupied = occupiedBy(state);
  const power = powers(state, holders);
  const near = (a: string, b: string) => {
    const pa = centres?.get(a);
    const pb = centres?.get(b);
    if (pa && pb) return Math.round(100 * clamp(1 - (distanceKm(pa, pb) - 600) / 3000, 0.1, 1));
    return state.countries[a]?.course?.ties[b]?.near ?? state.countries[b]?.course?.ties[a]?.near ?? 30;
  };
  const claimOf = (a: string, b: string) =>
    Math.max(
      (occupied.get(a)?.get(b) ?? 0) > 0 ? 60 : 0,
      ...(state.countries[a]?.course?.aims ?? []).filter((x) => (x.kind === "reclaim" || x.kind === "expand") && x.target === b).map((x) => x.weight),
    );
  const sanctioned = (a: string, b: string) => (state.sanctions ?? []).some((s) => (s.by === a && s.against === b) || (s.by === b && s.against === a));
  const tradeBloc = (a: string, b: string) => state.alliances.some((x) => x.kind === "trade" && x.members.length < 60 && x.members.includes(a) && x.members.includes(b));
  const livePlans = (state.plans ?? []).filter((p) => !p.end);
  const warPlans = livePlans.filter((p) => p.kind === "war").length;

  const found: { a: string; b: string; score: number; why: IncidentCause; f: number; n: number; claimA: number; claimB: number }[] = [];
  for (const [key, [a, b]] of [...pairs].sort((x, y) => x[0].localeCompare(y[0]))) {
    if (warBetween(state, a, b)) continue;
    const ta = tieOf(state, a, b);
    const tb = tieOf(state, b, a);
    const n = near(a, b);
    const parts: [IncidentCause, number][] = [];
    const claimA = claimOf(a, b);
    const claimB = claimOf(b, a);
    if (claimA || claimB) parts.push(["claim", 0.6 + Math.max(claimA, claimB) / 100]);
    parts.push(["tension", Math.max(ta.tension, tb.tension) / 50]);
    // Distrust, and the danger each sees in the other (a great power's rival, a small state's big neighbour).
    parts.push(["rivalry", Math.max(0, -Math.min(ta.trust, tb.trust)) / 60 + Math.max(0, Math.max(ta.threat, tb.threat) - 25) / 75]);
    const alliesA = bonds.allies.get(a) ?? none;
    const alliesB = bonds.allies.get(b) ?? none;
    const enemiesA = bonds.enemies.get(a) ?? none;
    const enemiesB = bonds.enemies.get(b) ?? none;
    // Rival blocs grate where they meet.
    if (n >= 60 && ([...alliesA].some((x) => enemiesB.has(x)) || [...alliesB].some((x) => enemiesA.has(x)))) parts.push(["blocs", 0.6 * (n / 100)]);
    if (sanctioned(a, b)) parts.push(["sanctions", 0.4]);
    const ra = state.countries[a]?.domestic?.regime;
    const rb = state.countries[b]?.domestic?.regime;
    if (n >= 60 && ((ra === "democracy" && autocratic(rb)) || (rb === "democracy" && autocratic(ra)))) parts.push(["regimes", 0.25]);
    if (n >= 60 && (enemiesA.size > 0 || enemiesB.size > 0)) parts.push(["war-nearby", 0.2]);
    let f = parts.reduce((s, [, v]) => s + v, 0);
    if (alliesA.has(b)) f *= 0.25;
    else if (bonds.pacts.get(a)?.has(b)) f *= 0.6;
    if (tradeBloc(a, b)) f *= 0.7;
    f *= 1 - Math.min(0.5, Math.max(ta.trade ?? 0, tb.trade ?? 0) / 40);
    if (f < MIN_FRICTION) continue;
    const rate = ERA_RATE[era] * f ** 1.5 * (0.3 + 0.7 * (n / 100));
    const chance = 1 - Math.exp(-rate * years);
    const x = dice(`incident:${key}`);
    if (x >= chance) continue;
    const why = parts.sort((p, q) => q[1] - p[1])[0][0];
    found.push({ a, b, score: x / chance, why, f, n, claimA, claimB });
  }
  const cap = Math.max(1, Math.ceil(5 * years));
  const busy = new Set<string>();
  const out: Incident[] = [];
  let planned = warPlans;
  for (const i of found.sort((p, q) => p.score - q.score || p.a.localeCompare(q.a))) {
    if (out.length >= cap) break;
    if (busy.has(i.a) || busy.has(i.b)) continue;
    busy.add(i.a);
    busy.add(i.b);
    const key = `${i.a}|${i.b}`;
    // The more hawkish side, and the one with a claim, provokes more often.
    const wa = (hawkOf(state, i.a) / 50) * (i.claimA ? 1.5 : 1);
    const wb = (hawkOf(state, i.b) / 50) * (i.claimB ? 1.5 : 1);
    const [by, target] = dice(`incident-by:${key}`) < wa / (wa + wb) ? [i.a, i.b] : [i.b, i.a];
    const sea = !coast || (coast.has(i.a) && coast.has(i.b));
    const land = neighbors ? borders.has(key) : i.n >= 85;
    const what = kindFor(state, dice(`incident-kind:${key}`), i.n, Math.max(i.claimA, i.claimB) > 0, sanctioned(i.a, i.b) || Math.max(tieOf(state, i.a, i.b).trade ?? 0, tieOf(state, i.b, i.a).trade ?? 0) >= 5, sea, land);
    // The answers, weighed.
    const options: { answer: IncidentAnswer; responder?: string; w: number }[] = [{ answer: "none", w: 1 }];
    const severity = SEVERITY[what][0];
    if (planned < WAR_PLANS[era] && !state.alliances.some((x) => (!x.kind || x.kind === "alliance") && x.members.length < 60 && x.members.includes(by) && x.members.includes(target))) {
      let best: { side: string; w: number } | null = null;
      for (const [s, o] of [
        [by, target],
        [target, by],
      ]) {
        const claim = claimOf(s, o);
        if (s === state.player || livePlans.some((p) => p.kind === "war" && p.by === s) || ((bonds.enemies.get(s)?.size ?? 0) > 0 && !claim)) continue;
        const motive = clamp(Math.max(claim / 50, (tieOf(state, s, o).tension + (s === target ? severity : severity * 0.6)) / 50), 0.3, 2);
        const backers = [...(bonds.allies.get(o) ?? none)].filter((x) => x !== s && !(bonds.allies.get(s) ?? none).has(x)).reduce((sum, x) => sum + (power.get(x) ?? 0), 0);
        const ratio = ((power.get(s) ?? 0) * Math.max(0.3, i.n / 100)) / Math.max(0.01, (power.get(o) ?? 0) + 0.7 * backers);
        // Against a target a great alliance stands behind, nobody marches.
        if (ratio < 0.35) continue;
        const w = (hawkOf(state, s) / 50) * motive * clamp(ratio - 0.3, 0.1, 1.5) * ESCALATE[era];
        if (!best || w > best.w) best = { side: s, w };
      }
      if (best) options.push({ answer: "escalate", responder: best.side, w: best.w });
    }
    if (target !== state.player && !(state.sanctions ?? []).some((s) => s.by === target && s.against === by)) {
      const democracy = state.countries[target]?.domestic?.regime === "democracy";
      const weight = (state.countries[target]?.economy?.gdp ?? 0) >= 0.3 * (state.countries[by]?.economy?.gdp ?? 0) ? 1 : 0.3;
      options.push({ answer: "sanction", responder: target, w: (democracy ? 0.5 : 0.2) * weight });
    }
    if (by !== state.player && target !== state.player) {
      const dove = hawkOf(state, by) <= hawkOf(state, target) ? by : target;
      const trade = Math.max(tieOf(state, by, target).trade ?? 0, tieOf(state, target, by).trade ?? 0);
      const pact = bonds.pacts.get(by)?.has(target) ? 0.3 : 0;
      options.push({ answer: "talks", responder: dove, w: 0.45 * clamp(2 - (hawkOf(state, by) + hawkOf(state, target)) / 100, 0.3, 1.6) * (1 + trade / 20) + pact });
    }
    const total = options.reduce((s, o) => s + o.w, 0);
    let x = dice(`incident-answer:${key}`) * total;
    const pick = options.find((o) => (x -= o.w) < 0) ?? options[0];
    if (pick.answer === "escalate") planned += 1;
    out.push({ id: `i${state.turn}-${out.length + 1}`, by, target, what, why: i.why, answer: pick.answer, ...(pick.responder ? { responder: pick.responder } : {}) });
  }
  return out;
}

/** A kind of incident fitting the pair and the era. */
function kindFor(state: GameState, x: number, near: number, claim: boolean, trade: boolean, sea: boolean, land: boolean): IncidentKind {
  const era = state.scenarioId;
  const options: [IncidentKind, number][] = [
    ["border", land ? (claim ? 4 : 2) : 0],
    ["airspace", era !== "1914" && near >= 50 ? 1 : 0],
    ["naval", sea && near >= 35 ? 0.8 : 0],
    ["spy", 1],
    ["expulsion", 0.8],
    ["cyber", era === "2014" || era === "2022" ? 1.2 : era === "1999" ? 0.3 : 0],
    ["trade", trade ? 1 : 0.2],
    ["minority", claim && land ? 1.2 : 0],
  ];
  const live = options.filter(([, w]) => w > 0);
  const total = live.reduce((s, [, w]) => s + w, 0);
  let left = x * total;
  return (live.find(([, w]) => (left -= w) < 0) ?? live[0])[0];
}

/** Who must keep a course to carry an incident's answer: the planner of a war plan and the side it marches on, or both sides of talks. */
export function incidentParties(i: Incident): string[] {
  return i.answer === "escalate" || i.answer === "talks" ? [i.by, i.target] : [];
}

/**
 * The period's incidents land at its end: tension rises both ways (more for
 * the offended), the offended remembers, and the answer the dice chose opens
 * its plan – a war plan at tension, sanctions threatened, talks offered –
 * with the incident as its origin. An answer the turn has overtaken (a war
 * already begun between them) opens nothing.
 */
export function applyIncidents(
  next: GameState,
  incidents: Incident[],
  ctx: { date: string; open: (fields: Omit<Plan, "id" | "since" | "moved">) => Plan | null },
  applied: AppliedChange[],
): void {
  for (const i of incidents) {
    if (!next.countries[i.by] || !next.countries[i.target]) continue;
    const [tension, trust] = SEVERITY[i.what];
    addTension(next, i.target, i.by, tension);
    addTension(next, i.by, i.target, Math.round(tension * 0.6));
    remember(next, i.target, i.by, "provoked", -trust, ctx.date);
    const change: AppliedChange & { kind: "incident" } = { kind: "incident", id: i.id, by: i.by, target: i.target, what: i.what, why: i.why, answer: i.answer };
    applied.push(change);
    if (!i.responder || warBetween(next, i.by, i.target)) continue;
    const other = i.responder === i.by ? i.target : i.by;
    const plan =
      i.answer === "escalate"
        ? ctx.open({ kind: "war", by: i.responder, target: other, cause: "incident", stage: "tension", origin: i.id })
        : i.answer === "sanction"
          ? ctx.open({ kind: "sanction", by: i.responder, target: other, cause: "incident", stage: "tension", origin: i.id })
          : i.answer === "talks"
            ? ctx.open({ kind: "talks", by: i.responder, target: other, cause: "incident", stage: "preparation", origin: i.id })
            : null;
    if (plan) change.plan = plan.id;
  }
}

const KIND_EN: Record<IncidentKind, string> = {
  border: "a border clash",
  airspace: "an airspace violation",
  naval: "a naval incident",
  spy: "a spy scandal",
  expulsion: "diplomats expelled",
  cyber: "a cyber attack",
  trade: "a trade dispute",
  minority: "clashes over a minority",
};

const WHY_EN: Record<IncidentCause, string> = {
  claim: "a claim on land",
  rivalry: "old distrust",
  blocs: "rival blocs",
  sanctions: "sanctions",
  regimes: "opposed regimes",
  "war-nearby": "a war nearby",
  tension: "tension",
};

/** The period's incidents for the turn's game master, in one line. */
export function describeIncidents(incidents: Incident[], name: (tag: string) => string): string[] {
  if (!incidents.length) return [];
  const answer = (i: Incident) => {
    const who = i.responder ? `${name(i.responder)} [${i.responder}]` : "";
    switch (i.answer) {
      case "escalate":
        return `${who} starts down the road to war (threats, troops moved; no shots yet)`;
      case "sanction":
        return `${who} threatens sanctions`;
      case "talks":
        return `${who} offers talks`;
      default:
        return "protests and hard words, nothing more";
    }
  };
  const list = incidents.map((i) => `${name(i.by)} [${i.by}] → ${name(i.target)} [${i.target}]: ${KIND_EN[i.what]} (${WHY_EN[i.why]}); ${answer(i)}`);
  return [`INCIDENTS THIS PERIOD (the engine's dice, already cast – show each in the story with its answer): ${list.join("; ")}`];
}

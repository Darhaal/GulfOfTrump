import { addYears, yearsBetween } from "./abroad";
import { fixed, roll } from "./dice";
import { interestOf } from "./crises";
import { balance, money } from "./economy";
import { countryName } from "./names";
import { peopleIn } from "./population";
import { PROGRAMMES } from "./programmes";
import { addTension, allied, enemiesOf, isMilitary, pacted, tieOf, warBetween } from "./relations";
import { same } from "./text";
import { countryCentres, distanceKm } from "./trade";
import type { Alliance, AppliedChange, GameState, Localized, MapRegion, Plan, PlanEnd, PlanKind, PlanStage, PolicyKind, Programme, RegimeKind, ScenarioId } from "./types";

/**
 * Peaceful decisions of every government but the player's, small states
 * included: policies at home (building, industry, science, reform, austerity,
 * stimulus, arming or cutting the army, opening or tightening the regime),
 * sanctions imposed and lifted, trade agreements, and talks that ease a
 * quarrel. They are plans like a war's (engine/intentions.ts): they climb
 * stages by the game's weekly dice, the game master tells the stages, and
 * at action the engine applies what they do – budgets, growth, support and
 * stability through a programme (engine/programmes.ts), sanctions and trade
 * through engine/trade.ts, regimes, and the ties between governments.
 *
 * Governments with a course choose by their ties as well as their numbers;
 * the light tier – the states without one – by their own numbers, their
 * neighbours (by the distance between where their people live) and their
 * bloc's leader. Everything is seeded: the same state casts the same dice.
 */

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const PEACEFUL_KINDS: readonly PlanKind[] = ["policy", "sanction", "deal", "talks"];
export const isPeaceful = (kind: PlanKind) => PEACEFUL_KINDS.includes(kind);

/** The stages each peaceful plan climbs: a policy is weighed in secret, then drafted in the open, then adopted. */
export const PEACEFUL_LADDER: Record<"policy" | "sanction" | "deal" | "talks", PlanStage[]> = {
  policy: ["decision", "preparation", "action"],
  sanction: ["tension", "action"],
  deal: ["preparation", "action"],
  talks: ["preparation", "action"],
};

/** Programmes at work at once, trade agreements aside: a government that has started three starts no fourth. */
const MAX_PROGRAMMES = 3;
/** Most governments' plans that sanction one target. */
const MAX_SANCTIONERS = 10;
/** Blocs this big are world bodies, whose "leader" leads nobody. */
const WORLD_BODY = 60;
/** A trade agreement's term, years. */
const DEAL_YEARS = 8;

/** Policies a government starts a year, before its size and how much it needs one. */
const POLICY_RATE = 0.22;
/** Trade agreements a government seeks a year, by era. */
const DEAL_RATE: Record<ScenarioId, number> = { "1914": 0.03, "1939": 0.02, "1950": 0.04, "1964": 0.05, "1991": 0.07, "1999": 0.08, "2014": 0.07, "2022": 0.06 };
/** How much each era leaned to a policy, against the rest. */
const INDUSTRY_ERA: Record<ScenarioId, number> = { "1914": 0.7, "1939": 1, "1950": 1, "1964": 0.9, "1991": 0.5, "1999": 0.45, "2014": 0.5, "2022": 0.55 };
const TECH_ERA: Record<ScenarioId, number> = { "1914": 0.3, "1939": 0.5, "1950": 0.8, "1964": 1, "1991": 0.9, "1999": 1, "2014": 1, "2022": 1 };
const MARKET_ERA: Record<ScenarioId, number> = { "1914": 0.4, "1939": 0.3, "1950": 0.5, "1964": 0.6, "1991": 1.4, "1999": 1.1, "2014": 0.9, "2022": 0.8 };
const ARM_ERA: Record<ScenarioId, number> = { "1914": 1.3, "1939": 1.5, "1950": 1.1, "1964": 1, "1991": 0.6, "1999": 0.6, "2014": 0.8, "2022": 1 };
/** Waves of political opening: strong after the Cold War, faint before. */
const WAVE: Record<ScenarioId, number> = { "1914": 0.05, "1939": 0.02, "1950": 0.05, "1964": 0.06, "1991": 0.45, "1999": 0.25, "2014": 0.12, "2022": 0.08 };
/** An army budget this share of GDP or more is heavy for the era. */
const HEAVY_ARMY: Record<ScenarioId, number> = { "1914": 0.05, "1939": 0.08, "1950": 0.07, "1964": 0.06, "1991": 0.04, "1999": 0.035, "2014": 0.03, "2022": 0.03 };
/** Appetite for force by kind of government, for a state without a course (as engine/relations.ts starts one). */
const HAWK_BASE: Record<RegimeKind, number> = { democracy: 35, limited: 45, party: 50, autocracy: 55, military: 65 };

/** One step towards democracy, or towards autocracy; a ruling party or a junta that tightens stays what it is. */
const OPEN: Record<RegimeKind, RegimeKind> = { democracy: "democracy", limited: "democracy", autocracy: "limited", party: "limited", military: "limited" };
const CLOSE: Record<RegimeKind, RegimeKind> = { democracy: "limited", limited: "autocracy", autocracy: "autocracy", party: "party", military: "military" };

const hawkOf = (state: GameState, tag: string) => state.countries[tag]?.course?.hawk ?? HAWK_BASE[state.countries[tag]?.domestic?.regime ?? "autocracy"];
const gdpOf = (state: GameState, tag: string) => state.countries[tag]?.economy?.gdp ?? 0;
const sanctions = (state: GameState) => state.sanctions ?? [];
const sanctioning = (state: GameState, by: string, against: string) => sanctions(state).some((s) => s.by === by && s.against === against);
const sanctionedEither = (state: GameState, a: string, b: string) => sanctions(state).some((s) => (s.by === a && s.against === b) || (s.by === b && s.against === a));
/** Whether two countries already trade under one agreement (a trade bloc that is not a world body). */
const tradeBloc = (state: GameState, a: string, b: string) => state.alliances.some((x) => x.kind === "trade" && x.members.length < WORLD_BODY && x.members.includes(a) && x.members.includes(b));
const running = (state: GameState, tag: string, kind: PolicyKind) => (state.countries[tag]?.programmes ?? []).some((p) => p.kind === kind && p.until > state.date);

/** A country's name in each language. */
function names(state: GameState, tag: string): Localized {
  const n = state.countries[tag]?.name;
  if (n && typeof n !== "string") return n;
  return countryName(tag) ?? same(n ?? tag);
}

/** The name of a trade agreement between two countries. */
export function dealName(state: GameState, a: string, b: string): Localized {
  const x = names(state, a);
  const y = names(state, b);
  return { en: `${x.en}–${y.en} Trade Agreement`, ru: `${x.ru} – ${y.ru}: торговое соглашение`, uk: `${x.uk} – ${y.uk}: торговельна угода` };
}

/** The name of a pact two governments sign after talks. */
function pactName(state: GameState, a: string, b: string): Localized {
  const x = names(state, a);
  const y = names(state, b);
  return { en: `${x.en}–${y.en} Pact`, ru: `${x.ru} – ${y.ru}: пакт`, uk: `${x.uk} – ${y.uk}: пакт` };
}

/** The pace of a peaceful plan at its stage, a year: the time it must spend there, how fast it climbs, how fast it fades and why. */
export function peacefulRates(state: GameState, p: Plan): { min: number; advance: number; fade: number; why: PlanEnd } {
  const stay = { min: 0, advance: 0, fade: 0, why: "compromise" as PlanEnd };
  const d = state.countries[p.by]?.domestic;
  switch (p.kind) {
    case "policy": {
      if (p.stage === "decision") return { min: 0, advance: 3, fade: 0.6, why: "government" };
      if (p.stage !== "preparation") return stay;
      const votes = d && (d.regime === "democracy" || d.regime === "limited");
      // An unpopular government where votes count cannot push a painful reform through; hardliners block an opening; courts and the street resist a democracy's crackdown.
      if (votes && d.support < 35 && (p.policy === "market" || p.policy === "austerity" || p.policy === "crackdown")) return { min: 1 / 12, advance: 2.4, fade: 1.8, why: "unrest" };
      if (p.policy === "liberalise" && hawkOf(state, p.by) >= 65) return { min: 1 / 12, advance: 2, fade: 1.5, why: "government" };
      if (p.policy === "crackdown" && d?.regime === "democracy" && d.stability >= 50) return { min: 1 / 12, advance: 2, fade: 1.5, why: "unrest" };
      return { min: 1 / 12, advance: 2.4, fade: 0.35, why: "government" };
    }
    case "sanction": {
      if (p.stage !== "tension" || !p.target) return stay;
      const t = tieOf(state, p.by, p.target);
      const trade = (t.trade ?? 0) / 100;
      if (p.lift) return { min: 1 / 24, advance: 3, fade: 0.6 + t.tension / 50, why: "government" };
      // A government that sells much to the target thinks twice.
      return { min: 1 / 24, advance: 3 * (1 + t.tension / 100), fade: 0.6 * (1 + 4 * trade), why: "compromise" };
    }
    case "deal": {
      if (p.stage !== "preparation" || !p.target) return stay;
      const trust = tieOf(state, p.target, p.by).trust;
      return { min: 1 / 12, advance: 2, fade: 0.5 + (trust < 0 ? 0.8 : 0), why: "refused" };
    }
    case "talks": {
      if (p.stage !== "preparation" || !p.target) return stay;
      const tension = Math.max(tieOf(state, p.by, p.target).tension, tieOf(state, p.target, p.by).tension);
      return { min: 1 / 24, advance: 3, fade: 0.6 + tension / 100, why: "refused" };
    }
    default:
      return stay;
  }
}

/** Whether the other side agrees when a deal or talks reach action: by its trust, the tension and its appetite. */
export function acceptChance(state: GameState, p: Plan): number | undefined {
  if (!p.target || p.target === state.player) return undefined;
  const t = tieOf(state, p.target, p.by);
  if (p.kind === "deal") return clamp(0.6 + t.trust / 150 - t.tension / 150, 0.1, 0.92);
  if (p.kind === "talks") return clamp(0.45 + (1 - hawkOf(state, p.target) / 100) * 0.4 + t.trust / 200 - t.tension / 300, 0.1, 0.9);
  return undefined;
}

/** A peaceful plan overtaken or made pointless before it moves. */
export function settlePeaceful(state: GameState, p: Plan, stands: (tag: string | undefined) => boolean): PlanEnd | null {
  if (p.kind !== "policy" && (!p.target || !stands(p.target))) return "target-gone";
  switch (p.kind) {
    case "policy": {
      const d = state.countries[p.by]?.domestic;
      if (!p.policy || !d || !state.countries[p.by]?.economy) return "overtaken";
      if (p.policy === "liberalise" && d.regime === "democracy") return "overtaken";
      return running(state, p.by, p.policy) ? "overtaken" : null;
    }
    case "sanction":
      if (warBetween(state, p.by, p.target!)) return "overtaken";
      return Boolean(p.lift) !== sanctioning(state, p.by, p.target!) ? "overtaken" : null;
    case "deal":
      if (warBetween(state, p.by, p.target!) || sanctionedEither(state, p.by, p.target!)) return "refused";
      return tradeBloc(state, p.by, p.target!) ? "overtaken" : null;
    case "talks": {
      if (warBetween(state, p.by, p.target!)) return "overtaken";
      return Math.max(tieOf(state, p.by, p.target!).tension, tieOf(state, p.target!, p.by).tension) < 12 ? "overtaken" : null;
    }
    default:
      return null;
  }
}

/** Moves the trust one government has in another, if it keeps a tie to it. */
function nudge(state: GameState, who: string, toward: string, delta: number): void {
  const t = state.countries[who]?.course?.ties[toward];
  if (t) t.trust = Math.round(clamp(t.trust + delta, -100, 100));
}

/** A new programme on a country, keeping the list short: the oldest that has run out goes first. */
function addProgramme(state: GameState, tag: string, p: Programme): void {
  const c = state.countries[tag];
  if (!c) return;
  c.programmes = [...(c.programmes ?? []).filter((x) => x.until > p.since), p].slice(-6);
}

/** A policy adopted: its budget lines, its once-for-all changes, the regime, the ties, and the programme it starts. */
function adopt(next: GameState, p: Plan, when: string, applied: AppliedChange[]): PlanEnd {
  const c = next.countries[p.by];
  const e = c?.economy;
  const d = c?.domestic;
  if (!c || !e || !d || !p.policy) return "target-gone";
  const effect = PROGRAMMES[p.policy];
  const lines: Programme["lines"] = {};
  for (const [line, share] of Object.entries(effect.lines ?? {}) as ["army" | "industry" | "social" | "other", number][]) {
    e.budget[line] = money(e.budget[line] + share * e.gdp);
    lines[line] = share;
  }
  switch (p.policy) {
    case "austerity":
      e.budget.revenue = money(e.budget.revenue + 0.01 * e.gdp);
      e.budget.other = money(Math.max(e.budget.other * 0.5, e.budget.other - 0.01 * e.gdp));
      break;
    case "armament": {
      // A government already deep in deficit arms only as far as it can pay: a third more at most, within five points of GDP of deficit.
      const room = Math.max(0, 0.05 * e.gdp + balance(e));
      e.budget.army = money(e.budget.army + Math.min(0.35 * e.budget.army, room));
      e.troops = Math.round(e.troops * 1.08);
      // Those who fear it fear it more.
      for (const o of Object.values(next.countries)) if (o.course?.ties[p.by] && o.course.ties[p.by].threat >= 35) addTension(next, o.tag, p.by, 8);
      break;
    }
    case "disarmament": {
      e.budget.army = money(e.budget.army * 0.75);
      e.troops = Math.round(e.troops * 0.9);
      for (const o of Object.values(next.countries)) if (o.course?.ties[p.by] && o.course.ties[p.by].threat >= 35) nudge(next, o.tag, p.by, 5);
      break;
    }
    case "liberalise":
    case "crackdown": {
      const opening = p.policy === "liberalise";
      const regime = (opening ? OPEN : CLOSE)[d.regime];
      const votes = regime === "democracy" || regime === "limited";
      const term = d.term ?? (regime === "democracy" ? 4 : 5);
      c.domestic = {
        ...d,
        regime,
        ...(votes && !d.nextElection ? { term, nextElection: addYears(when, Math.max(1, term * (0.5 + 0.5 * fixed(`${next.scenarioId}:${p.by}:${p.id}`)))) } : {}),
      };
      // A government that closed the vote holds none.
      if (!votes) {
        delete c.domestic.nextElection;
        delete c.domestic.term;
      }
      if (c.course) c.course.hawk = Math.round(clamp(c.course.hawk + (opening ? -6 : 6), 5, 95));
      for (const o of Object.values(next.countries)) if (o.domestic?.regime === "democracy" && o.tag !== p.by) nudge(next, o.tag, p.by, opening ? 6 : -8);
      break;
    }
    default:
      break;
  }
  addProgramme(next, p.by, { id: p.id, kind: p.policy, since: when, until: addYears(when, effect.years), ...(Object.keys(lines).length ? { lines } : {}) });
  applied.push({ kind: "policy", country: p.by, policy: p.policy, plan: p.id });
  return "carried-out";
}

/**
 * Carries out a peaceful plan at action: a policy adopted, sanctions
 * imposed or lifted, a trade agreement signed (or the answer's own taken for
 * it), an accord reached. Returns why it ended.
 */
export function enactPeaceful(next: GameState, p: Plan, ctx: { turn: number; when: string; accepted?: boolean }, made: () => number, applied: AppliedChange[]): PlanEnd {
  const when = ctx.when;
  switch (p.kind) {
    case "policy":
      return adopt(next, p, when, applied);
    case "sanction": {
      if (!p.target || !next.countries[p.target]) return "target-gone";
      const list = next.sanctions ?? [];
      if (p.lift) {
        if (!list.some((s) => s.by === p.by && s.against === p.target)) return "carried-out";
        next.sanctions = list.filter((s) => !(s.by === p.by && s.against === p.target));
        if (!next.sanctions.length) delete next.sanctions;
        applied.push({ kind: "sanction", by: p.by, against: p.target, change: "lifted", plan: p.id });
        return "carried-out";
      }
      if (list.some((s) => s.by === p.by && s.against === p.target)) return "carried-out";
      // An embargo where the quarrel is past bearing; partial sanctions otherwise, an aggressor far away included.
      const t = tieOf(next, p.by, p.target);
      const scope = t.tension >= 65 ? "full" : "partial";
      next.sanctions = [...list, { by: p.by, against: p.target, scope, since: when }];
      applied.push({ kind: "sanction", by: p.by, against: p.target, change: scope, plan: p.id });
      return "carried-out";
    }
    case "deal": {
      if (!p.target || !next.countries[p.target]) return "target-gone";
      if (ctx.accepted === false) return "refused";
      const formed = next.alliances.find((a) => a.id.startsWith(`a${ctx.turn}-`) && a.kind === "trade" && a.members.includes(p.by) && a.members.includes(p.target!));
      let bloc: Alliance;
      if (formed) {
        bloc = formed;
        for (const c of applied) if (c.kind === "alliance" && c.alliance === formed.id) c.plan = p.id;
      } else {
        bloc = { id: `a${ctx.turn}-d${made()}`, name: dealName(next, p.by, p.target), members: [p.by, p.target], since: when, kind: "trade", until: addYears(when, DEAL_YEARS), founder: p.by };
        next.alliances.push(bloc);
        applied.push({ kind: "alliance", alliance: bloc.id, name: bloc.name, members: [...bloc.members], plan: p.id });
      }
      // Each gains by the other's market: much from a big partner, little from a small one.
      const until = bloc.until ?? addYears(when, DEAL_YEARS);
      for (const [a, b] of [
        [p.by, p.target],
        [p.target, p.by],
      ]) {
        const gain = Math.round(PROGRAMMES.trade.growth * clamp(gdpOf(next, b) / Math.max(0.01, gdpOf(next, a)), 0.15, 1) * 100) / 100;
        addProgramme(next, a, { id: bloc.id, kind: "trade", since: when, until, with: b, gain });
        nudge(next, a, b, 8);
      }
      return "carried-out";
    }
    case "talks": {
      if (!p.target || !next.countries[p.target]) return "target-gone";
      if (ctx.accepted === false) return "refused";
      for (const [a, b] of [
        [p.by, p.target],
        [p.target, p.by],
      ]) {
        const t = next.countries[a]?.course?.ties[b];
        if (t) t.tension = Math.round(t.tension * 0.5);
        nudge(next, a, b, 10);
      }
      // Sometimes the accord is written down as a pact.
      let pact: string | undefined;
      const warm = tieOf(next, p.by, p.target).trust >= 5 && tieOf(next, p.target, p.by).trust >= 5;
      if (warm && !pacted(next, p.by, p.target) && !allied(next, p.by, p.target) && p.target !== next.player && roll(next.seed ?? next.id, ctx.turn, `pact:${p.id}`) < 0.35) {
        const bloc: Alliance = { id: `a${ctx.turn}-t${made()}`, name: pactName(next, p.by, p.target), members: [p.by, p.target], since: when, kind: "pact", founder: p.by };
        next.alliances.push(bloc);
        pact = bloc.id;
        applied.push({ kind: "alliance", alliance: bloc.id, name: bloc.name, members: [...bloc.members], plan: p.id });
      }
      applied.push({ kind: "accord", by: p.by, with: p.target, plan: p.id, ...(pact ? { pact } : {}) });
      return "carried-out";
    }
    default:
      return "overtaken";
  }
}

/** Programmes that ran out by `to` end: the budget lines they added are taken back. */
export function endProgrammes(next: GameState, to: string): void {
  for (const c of Object.values(next.countries)) {
    if (!c.programmes?.length) continue;
    const e = c.economy;
    for (const p of c.programmes) {
      if (p.until > to || !e) continue;
      for (const [line, share] of Object.entries(p.lines ?? {}) as ["army" | "industry" | "social" | "other", number][]) {
        e.budget[line] = money(Math.max(e.budget[line] * 0.3, e.budget[line] - share * e.gdp));
      }
    }
    c.programmes = c.programmes.filter((p) => p.until > to);
    if (!c.programmes.length) delete c.programmes;
  }
}

/** What the openers need: the period, the strongest, who holds land, the map, the new governments, the game's dice and the way to open a plan. */
export interface PeacefulContext {
  turn: number;
  to: string;
  years: number;
  power: Map<string, number>;
  holders: Set<string>;
  map: Record<string, MapRegion> | null;
  changed: string[];
  dice: (key: string) => number;
  open: (fields: Omit<Plan, "id" | "since" | "moved">) => Plan;
}

type Point = [number, number];

/** What the openers read of the world once a turn. */
interface View {
  alive: string[];
  /** Income per person against the median state's. */
  income: Map<string, number>;
  medianGdp: number;
  centres: Map<string, Point> | null;
  belligerents: Set<string>;
  /** The attackers of the wars being fought, with their strength, 0–1. */
  attackers: Map<string, number>;
}

function viewOf(state: GameState, ctx: PeacefulContext): View {
  const alive = Object.values(state.countries)
    .filter((c) => c.tag !== state.player && ctx.holders.has(c.tag) && c.economy && c.domestic && !c.exile && !c.dormant)
    .map((c) => c.tag)
    .sort();
  const people = new Map<string, number>();
  for (const [id, r] of Object.entries(state.regions)) people.set(r.owner, (people.get(r.owner) ?? 0) + peopleIn(r, ctx.map?.[id]));
  const perHead = new Map<string, number>();
  for (const tag of alive) {
    const n = people.get(tag) ?? 0;
    if (n > 0) perHead.set(tag, gdpOf(state, tag) / n);
  }
  const sorted = [...perHead.values()].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] || 1;
  const income = new Map([...perHead].map(([t, v]) => [t, v / median] as const));
  const gdps = alive.map((t) => gdpOf(state, t)).sort((a, b) => a - b);
  const fought = state.wars.filter((w) => !w.truce);
  const attackers = new Map(fought.flatMap((w) => w.attackers).map((t) => [t, ctx.power.get(t) ?? 0] as const));
  return { alive, income, medianGdp: gdps[Math.floor(gdps.length / 2)] || 1, centres: ctx.map ? countryCentres(state, ctx.map) : null, belligerents: new Set(fought.flatMap((w) => [...w.attackers, ...w.defenders])), attackers };
}

/** How close two countries are, 0–100, from where their people live (as engine/relations.ts measures it), or what a tie says. */
function nearness(state: GameState, view: Pick<View, "centres">, a: string, b: string): number {
  const pa = view.centres?.get(a);
  const pb = view.centres?.get(b);
  if (pa && pb) return Math.round(100 * clamp(1 - (distanceKm(pa, pb) - 600) / 3000, 0.1, 1));
  return state.countries[a]?.course?.ties[b]?.near ?? 30;
}

/** A war being fought within reach of a country (not its own). */
function warNearby(state: GameState, view: Pick<View, "centres" | "belligerents">, tag: string): boolean {
  for (const b of view.belligerents) if (b !== tag && !warBetween(state, tag, b) && nearness(state, view, tag, b) >= 75) return true;
  return false;
}

/** The danger a strong state waging war within reach puts every government around it in, 0–100, whatever its ties say. */
function feltThreat(state: GameState, view: Pick<View, "centres" | "attackers">, tag: string): number {
  let out = 0;
  for (const [a, power] of view.attackers) {
    if (a === tag || power < 0.08 || allied(state, tag, a)) continue;
    const near = nearness(state, view, tag, a);
    if (near >= 45) out = Math.max(out, (25 + 35 * Math.min(1, power / 0.25)) * (near / 100));
  }
  return out;
}

/** What a government needs at home, weighed: each policy it has no programme for, with how much it is called for. */
export function policyNeeds(state: GameState, tag: string, view: Pick<View, "income" | "belligerents" | "centres" | "attackers">): [PolicyKind, number][] {
  const c = state.countries[tag];
  const e = c?.economy;
  const d = c?.domestic;
  if (!c || !e || !d) return [];
  const era = state.scenarioId;
  const gdp = Math.max(0.01, e.gdp);
  const ratio = e.debt / gdp;
  const deficit = ((-balance(e) + interestOf(e, era)) / gdp) * 100;
  const rel = view.income.get(tag) ?? 1;
  const hawk = hawkOf(state, tag) / 50;
  const atWar = enemiesOf(state, tag).size > 0;
  const nearby = warNearby(state, view, tag);
  const threat = Math.max(c.course ? Math.max(0, ...Object.values(c.course.ties).map((t) => t.threat)) : nearby ? 35 : 0, feltThreat(state, view, tag));
  const tenure = d.changed ? yearsBetween(d.changed.date, state.date) : 3;
  const out: [PolicyKind, number][] = [];
  const add = (k: PolicyKind, n: number) => {
    if (n > 0.02 && !running(state, tag, k)) out.push([k, n]);
  };
  add("infrastructure", (rel < 1.5 ? 0.4 : 0.15) * (d.stability >= 45 ? 1 : 0.4) * (ratio < 0.8 ? 1 : 0.3) * (atWar ? 0.3 : 1));
  add("industry", INDUSTRY_ERA[era] * (rel >= 0.4 && rel <= 3 ? 0.45 : 0.2) * (atWar ? 1.3 : 1));
  add("technology", (rel > 1.5 ? 0.4 : 0.1) * TECH_ERA[era]);
  add("market", ((e.growth < 1 ? 0.35 : 0) + (e.inflation > 15 ? 0.6 : 0) + (e.unemployment > 10 ? 0.4 : 0)) * MARKET_ERA[era] * (d.regime === "party" ? 0.5 : 1) * (atWar ? 0.3 : 1));
  add("austerity", ((ratio > 0.9 ? 0.6 + Math.min(1, ratio - 0.9) : 0) + (deficit > 6 ? 0.5 : 0)) * (e.growth < -2 ? 0.3 : 1) * (atWar ? 0.2 : 1));
  add("stimulus", (e.growth < 0.5 || (e.growth < 1.5 && e.unemployment > 7)) && ratio < 0.9 && !atWar ? 0.4 + Math.min(1, Math.max(0, -e.growth) / 4) : 0);
  add("armament", (threat / 70 + (atWar ? 0.5 : 0) + (nearby ? 0.25 : 0)) * hawk * ARM_ERA[era] * (ratio > 1.2 ? 0.5 : 1));
  const heavy = e.budget.army / gdp >= HEAVY_ARMY[era];
  add("disarmament", !atWar && threat < 25 ? (0.05 + (ratio > 1 ? 0.3 : 0) + (heavy ? 0.5 : 0)) * clamp(2 - hawk, 0.3, 1.5) * 0.6 : 0);
  if (d.regime !== "democracy") {
    const junta = d.regime === "military" ? (tenure >= 2 ? 0.8 : 0.1) : 0;
    add("liberalise", (junta + WAVE[era] + (d.support < 40 ? 0.15 : 0) + (rel > 2 ? 0.1 : 0)) * (d.stability >= 40 ? 1 : 0.5) * clamp(2 - hawk, 0.3, 1.5));
  }
  // An unpopular or shaky government, a managed vote coming, or a regime that tightens its grip as such regimes do.
  const vote = d.regime === "limited" && d.nextElection && yearsBetween(state.date, d.nextElection) < 1 ? 0.25 : 0;
  const habit = d.regime === "autocracy" || d.regime === "party" || d.regime === "military" ? 0.08 : 0;
  const shaky = (d.support < 35 ? 0.35 : 0) + (d.stability < 45 ? 0.35 : 0) + (d.support < 25 ? 0.2 : 0) + vote + habit;
  const tight: Record<RegimeKind, number> = { democracy: d.stability < 35 ? 0.4 : 0, limited: 1, autocracy: 0.8, party: 0.6, military: 0.8 };
  add("crackdown", shaky * tight[d.regime] * hawk * (era === "1939" ? 1.3 : 1));
  return out;
}

const CAUSE_OF: Record<PolicyKind, Plan["cause"]> = {
  infrastructure: "economy",
  industry: "economy",
  technology: "economy",
  market: "economy",
  austerity: "economy",
  stimulus: "economy",
  armament: "threat",
  disarmament: "economy",
  liberalise: "politics",
  crackdown: "politics",
};

/** Rivals that sign no trade agreement: one fears the other or quarrels with it, or one's allies are at war with the other. */
function rivals(state: GameState, a: string, b: string): boolean {
  const ta = tieOf(state, a, b);
  const tb = tieOf(state, b, a);
  if (Math.max(ta.threat, tb.threat) >= 40 || Math.max(ta.tension, tb.tension) >= 30) return true;
  for (const w of state.wars) {
    if (w.truce) continue;
    for (const [side, other] of [
      [w.attackers, w.defenders],
      [w.defenders, w.attackers],
    ]) {
      if (side.includes(b) && other.some((x) => allied(state, a, x))) return true;
      if (side.includes(a) && other.some((x) => allied(state, b, x))) return true;
    }
  }
  return false;
}

/** Blocs bigger than this (the OSCE, the Council of Europe) do not sanction together. */
const COORDINATED = 32;

/** The military alliances and close unions a country belongs to, each with its strongest member and the members a sanction may not touch. */
function leadersOf(state: GameState, tag: string, power: Map<string, number>): { lead: string; members: string[] }[] {
  const out: { lead: string; members: string[] }[] = [];
  for (const a of state.alliances) {
    if (a.members.length > COORDINATED || !a.members.includes(tag) || !(isMilitary(a) || a.kind === "organization")) continue;
    const lead = [...a.members].filter((m) => power.has(m)).sort((x, y) => (power.get(y) ?? 0) - (power.get(x) ?? 0) || x.localeCompare(y))[0];
    if (lead && lead !== tag) out.push({ lead, members: a.members });
  }
  return out;
}

/** Whether `target` fights, as an attacker, a country `tag` is allied to or guards. */
function attacksFriend(state: GameState, tag: string, target: string): boolean {
  const guarded = new Set<string>(state.countries[tag]?.course?.aims.filter((a) => a.kind === "protect" && a.target).map((a) => a.target!) ?? []);
  for (const w of state.wars) {
    if (w.truce || !w.attackers.includes(target)) continue;
    if (w.defenders.some((d) => guarded.has(d) || allied(state, tag, d))) return true;
  }
  return false;
}

/**
 * New peaceful plans at the end of a turn, for every government but the
 * player's: a policy at home when it needs one, and at most one foreign move
 * a turn – sanctions lifted or imposed, a trade agreement sought, talks
 * offered. A government with a course reads its ties; the light tier reads
 * its numbers, its neighbours and its bloc's leader.
 */
export function openPeaceful(next: GameState, ctx: PeacefulContext): void {
  const plans = next.plans ?? [];
  const view = viewOf(next, ctx);
  const chance = (rate: number) => 1 - Math.exp(-Math.max(0, rate) * ctx.years);
  const live = (tag: string, kinds: PlanKind[]) => plans.filter((p) => !p.end && p.by === tag && kinds.includes(p.kind)).length;
  const foreign: PlanKind[] = ["sanction", "deal", "talks"];
  const policyCap = Math.max(3, Math.ceil(30 * ctx.years));
  const foreignCap = Math.max(2, Math.ceil(16 * ctx.years));
  let policies = 0;
  let moves = 0;
  const sanctioners = (target: string) => new Set([...sanctions(next).filter((s) => s.against === target).map((s) => s.by), ...plans.filter((p) => !p.end && p.kind === "sanction" && !p.lift && p.target === target).map((p) => p.by)]).size;
  const planned = (by: string, kind: PlanKind, target: string) => plans.some((p) => !p.end && p.by === by && p.kind === kind && p.target === target);
  const fresh = new Set(ctx.changed);

  for (const tag of view.alive) {
    const c = next.countries[tag];
    const course = c.course;
    const size = course ? 1.3 : gdpOf(next, tag) >= view.medianGdp ? 0.9 : 0.55;

    // A policy at home.
    const programmes = (c.programmes ?? []).filter((p) => p.kind !== "trade" && p.until > ctx.to).length;
    if (policies < policyCap && !live(tag, ["policy"]) && programmes < MAX_PROGRAMMES) {
      const needs = policyNeeds(next, tag, view);
      const top = Math.max(0, ...needs.map(([, n]) => n));
      const rate = POLICY_RATE * size * (0.3 + Math.min(1.5, top)) * (fresh.has(tag) ? 2 : 1);
      if (needs.length && ctx.dice(`open:policy:${tag}`) < chance(rate)) {
        const total = needs.reduce((s, [, n]) => s + n, 0);
        let x = ctx.dice(`pick:policy:${tag}`) * total;
        const [policy] = needs.find(([, n]) => (x -= n) < 0) ?? needs[needs.length - 1];
        ctx.open({ kind: "policy", by: tag, policy, cause: fresh.has(tag) ? "new-government" : CAUSE_OF[policy], stage: "decision" });
        policies += 1;
      }
    }

    // One move abroad at most.
    if (moves >= foreignCap || live(tag, foreign) >= (course ? 2 : 1)) continue;
    const opened = (() => {
      // Sanctions lifted: trust has come back, the quarrel has ebbed, a new government, or years have passed.
      for (const s of sanctions(next).filter((x) => x.by === tag).sort((a, b) => a.against.localeCompare(b.against))) {
        if (planned(tag, "sanction", s.against) || attacksFriend(next, tag, s.against)) continue;
        const t = course?.ties[s.against];
        const age = yearsBetween(s.since, ctx.to);
        const leaderStill = leadersOf(next, tag, ctx.power).some((l) => sanctioning(next, l.lead, s.against));
        const rate = t ? (t.trust >= -15 && t.tension < 25 ? 0.6 : 0) + (fresh.has(tag) && (course?.hawk ?? 50) < 45 ? 0.4 : 0) : age >= 3 ? (leaderStill ? 0.05 : 0.15) : 0;
        if (rate > 0 && ctx.dice(`open:lift:${tag}:${s.against}`) < chance(rate)) {
          ctx.open({ kind: "sanction", by: tag, target: s.against, lift: true, cause: fresh.has(tag) ? "new-government" : "tension", stage: "tension" });
          return true;
        }
      }
      // Sanctions imposed: an aggressor against a friend, a quarrel past bearing, a crackdown next door to democracy, or the bloc's leader's lead.
      const candidates: { target: string; weight: number; cause: Plan["cause"] }[] = [];
      const consider = (target: string, weight: number, cause: Plan["cause"]) => {
        if (target === tag || !ctx.holders.has(target) || allied(next, tag, target) || warBetween(next, tag, target) || sanctioning(next, tag, target) || planned(tag, "sanction", target)) return;
        if (sanctioners(target) >= MAX_SANCTIONERS) return;
        const trade = (course?.ties[target]?.trade ?? 0) / 100;
        if (candidates.some((x) => x.target === target && x.weight >= weight)) return;
        candidates.push({ target, weight: weight * (trade >= 0.15 ? 0.4 : 1), cause });
      };
      if (course) {
        // An aggressor against a country it is allied to or guards, however far away.
        for (const w of next.wars) if (!w.truce) for (const a of [...w.attackers].sort()) if (attacksFriend(next, tag, a)) consider(a, 1.2, "threat");
        for (const [other, t] of Object.entries(course.ties).sort((a, b) => a[0].localeCompare(b[0]))) {
          if (t.trust <= -35 && t.tension >= 35) consider(other, 0.7, "tension");
          else if (c.domestic?.regime === "democracy" && running(next, other, "crackdown") && t.trust <= 0 && (ctx.power.get(tag) ?? 0) >= 0.1) consider(other, 0.4, "politics");
        }
      }
      // The bloc's leader's sanctions on an aggressor, never on a fellow member: a bloc closes ranks against a war, not over its leader's own quarrels.
      const aggressors = new Set(next.wars.filter((w) => !w.truce).flatMap((w) => w.attackers));
      for (const { lead, members } of leadersOf(next, tag, ctx.power)) {
        if (course?.ties[lead] && course.ties[lead].trust < 10) continue;
        for (const s of sanctions(next).filter((x) => x.by === lead && !members.includes(x.against) && aggressors.has(x.against)).sort((a, b) => a.against.localeCompare(b.against))) consider(s.against, course ? 0.6 : 0.35, "treaty");
      }
      const best = candidates.sort((a, b) => b.weight - a.weight || a.target.localeCompare(b.target))[0];
      if (best) {
        const democracy = c.domestic?.regime === "democracy" ? 1.3 : 0.7;
        const weight = gdpOf(next, tag) >= gdpOf(next, best.target) * 0.05 ? 1 : 0.3;
        if (ctx.dice(`open:sanction:${tag}:${best.target}`) < chance(0.9 * best.weight * democracy * weight)) {
          ctx.open({ kind: "sanction", by: tag, target: best.target, cause: best.cause, stage: "tension" });
          return true;
        }
      }
      // Talks: a sharp quarrel neither side wants to fight, or a dovish new government.
      if (course && !live(tag, ["talks"])) {
        const quarrels = Object.entries(course.ties)
          .filter(([other, t]) => t.tension >= 45 && t.trust > -50 && other !== next.player && ctx.holders.has(other) && !warBetween(next, tag, other) && !planned(tag, "talks", other))
          .sort((a, b) => b[1].tension - a[1].tension || a[0].localeCompare(b[0]));
        const [other, t] = quarrels[0] ?? [];
        if (other && t) {
          const doves = course.hawk < 55 && hawkOf(next, other) < 60;
          const rate = (doves ? 0.5 : 0.1) * (1 + (t.trade ?? 0) / 20) + (fresh.has(tag) && course.hawk < 40 ? 0.8 : 0);
          if (ctx.dice(`open:talks:${tag}:${other}`) < chance(rate)) {
            ctx.open({ kind: "talks", by: tag, target: other, cause: fresh.has(tag) ? "new-government" : "tension", stage: "preparation" });
            return true;
          }
        }
      }
      // A trade agreement with a big, near, friendly partner.
      if (live(tag, ["deal"])) return false;
      const rate = DEAL_RATE[next.scenarioId] * (course ? 1 : gdpOf(next, tag) >= view.medianGdp ? 0.6 : 0.3);
      if (ctx.dice(`open:deal:${tag}`) >= chance(rate)) return false;
      const scored: { partner: string; score: number }[] = [];
      for (const other of view.alive) {
        if (other === tag || warBetween(next, tag, other) || sanctionedEither(next, tag, other) || tradeBloc(next, tag, other) || planned(tag, "deal", other) || planned(other, "deal", tag)) continue;
        const trust = tieOf(next, tag, other).trust;
        if (trust < -10 || rivals(next, tag, other)) continue;
        const near = nearness(next, view, tag, other);
        const score = (gdpOf(next, other) ** 0.8 * (near / 100) ** 2 * (1 + trust / 100)) / Math.max(1, (next.countries[other].programmes ?? []).filter((p) => p.kind === "trade").length + 1);
        if (score > 0) scored.push({ partner: other, score });
      }
      const top = scored.sort((a, b) => b.score - a.score || a.partner.localeCompare(b.partner)).slice(0, 6);
      if (!top.length) return false;
      const total = top.reduce((s, x) => s + x.score, 0);
      let x = ctx.dice(`pick:deal:${tag}`) * total;
      const pick = top.find((p) => (x -= p.score) < 0) ?? top[top.length - 1];
      ctx.open({ kind: "deal", by: tag, target: pick.partner, cause: "trade", stage: "preparation" });
      return true;
    })();
    if (opened) moves += 1;
  }
}

const POLICY_EN: Record<PolicyKind, string> = {
  infrastructure: "infrastructure programme (roads, rail, power)",
  industry: "industrial programme",
  technology: "technology drive",
  market: "market reform",
  austerity: "austerity",
  stimulus: "stimulus package",
  armament: "rearmament",
  disarmament: "defence cuts",
  liberalise: "political opening",
  crackdown: "crackdown on the opposition",
};

/** A peaceful plan in a few English words, for the game master and the ministers. */
export function peacefulWhat(p: Plan, who: (tag: string) => string): string {
  switch (p.kind) {
    case "policy":
      return p.policy ? POLICY_EN[p.policy] : "a policy";
    case "sanction":
      return `${p.lift ? "lifting sanctions on" : "sanctions on"} ${who(p.target ?? "?")}`;
    case "deal":
      return `trade agreement with ${who(p.target ?? "?")}`;
    case "talks":
      return `talks with ${who(p.target ?? "?")}`;
    default:
      return p.kind;
  }
}

/** What a peaceful plan does when it reaches action, in a word for the game master. */
export const PEACEFUL_ACTION: Record<"policy" | "sanction" | "deal" | "talks", string> = { policy: "ADOPTED", sanction: "IMPOSED", deal: "SIGNED", talks: "ACCORD" };

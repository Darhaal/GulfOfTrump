import { addStep } from "./calendar";
import { countryCrises } from "./crises";
import { fixed, happens } from "./dice";
import { STEP_YEARS } from "./economy";
import { REGIMES } from "./scenarios/regimes";
import { en } from "./text";
import type { AppliedChange, CountryState, Domestic, Economy, GameState, RegimeKind, Scenario, ScenarioId } from "./types";

/**
 * Politics in every country the player does not play, kept by the engine
 * with no model call: how the country is governed, the government's support
 * and the state's stability, the next election that can change the
 * government, and the risk of a coup. Support and stability follow the
 * economy, the war and the land lost; elections fall on their dates and
 * coups come with their risk, decided by seeded dice (engine/dice.ts) before
 * the turn is written, so the game master tells what the engine decided and
 * names the new leaders. If the player does nothing, the world still moves.
 */

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number) => Math.round(value * 10) / 10;
/** Kept to two decimals, so the small moves of a short turn add up instead of rounding away. */
const fine = (value: number) => Math.round(value * 100) / 100;

/** The date some years later (or earlier), to the day. */
export function addYears(date: string, years: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Math.round(years * 365.25));
  return d.toISOString().slice(0, 10);
}

const yearsBetween = (from: string, to: string) => (Date.parse(to) - Date.parse(from)) / (365.25 * 86400000);

/** Each date's table read once into tag -> kind. */
const KINDS = new Map<ScenarioId, Map<string, RegimeKind>>();
function kindsOn(era: ScenarioId): Map<string, RegimeKind> {
  let kinds = KINDS.get(era);
  if (!kinds) {
    const table = REGIMES[era];
    kinds = new Map();
    for (const kind of ["democracy", "limited", "party", "military"] as const) for (const tag of table[kind].split(/\s+/)) if (tag) kinds.set(tag, kind);
    KINDS.set(era, kinds);
  }
  return kinds;
}

/** How a country that appears in play is governed, read from the words the game master gave it. */
export function regimeFromText(government: string | undefined): RegimeKind {
  const g = (government ?? "").toLowerCase();
  if (/junta|military|martial law|army/.test(g)) return "military";
  if (/one-party|communis|people's|socialist/.test(g)) return "party";
  if (/dictator|totalitarian|absolute|fascis|theocra|emirate|caliphate|sultanate|insurgen|resistance|protectorate|occupation|puppet|satellite/.test(g)) return "autocracy";
  if (/islamic|provisional|transitional|revolutionary|authoritarian|guided|dominant|council/.test(g)) return "limited";
  if (/parliament|democra|federal|presidential|constitutional|republic|commonwealth|dominion/.test(g)) return "democracy";
  return "limited";
}

/** Stability where the scenario gives none. */
const STABILITY: Record<RegimeKind, number> = { democracy: 65, limited: 55, party: 65, autocracy: 60, military: 45 };

/** Years between elections where the table gives none. */
const TERM: Record<RegimeKind, number> = { democracy: 4, limited: 5, party: 5, autocracy: 5, military: 5 };

function fresh(regime: RegimeKind, stability: number, support: number): Domestic {
  return { regime, support: Math.round(support), stability: Math.round(stability) };
}

/** The election calendar of a country: the table's date, or a day somewhere in its term, moved past `after`. */
function schedule(d: Domestic, era: ScenarioId, tag: string, start: string, after: string): Domestic {
  const listed = REGIMES[era].elections[tag];
  if (!listed && d.regime !== "democracy" && d.regime !== "limited") return d;
  const term = listed?.[1] ?? TERM[d.regime];
  let next = listed?.[0] ?? addYears(start, Math.max(0.1, fixed(`${era}:${tag}`) * term));
  while (next <= after) next = addYears(next, term);
  return { ...d, term, nextElection: next };
}

/**
 * A country's politics on the start date: the kind of government from the
 * date's table, stability from the scenario where it gives one, support that
 * goes with it, and the election calendar.
 */
export function startingDomestic(scenario: Pick<Scenario, "id" | "startDate" | "countries">, tag: string, after = scenario.startDate): Domestic {
  const regime = kindsOn(scenario.id).get(tag) ?? "autocracy";
  const seeded = scenario.countries[tag]?.stats?.stability;
  const d = fresh(regime, seeded ?? STABILITY[regime], seeded === undefined ? 50 : 25 + seeded / 2);
  // A date's own election, held on the start date or the day after, is still to come.
  return schedule(d, scenario.id, tag, scenario.startDate, addYears(after, -1 / 365.25));
}

/** A country that appears in play: its kind of government from its description, an election within its term. */
export function newDomestic(country: Pick<CountryState, "tag" | "government">, era: ScenarioId, date: string): Domestic {
  const regime = regimeFromText(en(country.government));
  const d = fresh(regime, 40, 55);
  if (regime !== "democracy" && regime !== "limited") return d;
  return { ...d, term: TERM[regime], nextElection: addYears(date, Math.max(0.5, fixed(`${era}:${country.tag}:new`) * TERM[regime])) };
}

/**
 * Politics for every country but the player's that has none yet: those of
 * the start from the date's table, those born in play from their
 * description. Elections already past in a game under way move to their next
 * date, without being held.
 */
export function seedDomestic<T extends Pick<GameState, "countries" | "player" | "date" | "scenarioId" | "chronicle">>(state: T, scenario: Pick<Scenario, "id" | "startDate" | "countries">): T {
  const born = new Set(state.chronicle.flatMap((e) => e.applied.flatMap((a) => (a.kind === "new-country" ? [a.country] : []))));
  let countries: Record<string, CountryState> | undefined;
  for (const [tag, c] of Object.entries(state.countries)) {
    if (tag === state.player || c.domestic) continue;
    countries ??= { ...state.countries };
    countries[tag] = { ...c, domestic: born.has(tag) ? newDomestic(c, state.scenarioId, state.date) : startingDomestic(scenario, tag, state.date) };
  }
  return countries ? { ...state, countries } : state;
}

/** Coups a year, %, by kind of government, before the state of the country. */
const COUP_BASE: Record<RegimeKind, number> = { democracy: 0.4, limited: 3, party: 0.2, autocracy: 1.5, military: 6 };

/** How often armies moved against governments on each date, against the 1990s. */
const COUP_ERA: Record<ScenarioId, number> = { "1914": 0.8, "1939": 1, "1950": 1.3, "1964": 1.6, "1991": 1, "1999": 0.8, "2014": 0.8, "2022": 0.9 };

/** What the risk of a coup reads from the rest of the state. */
export interface CoupContext {
  era: ScenarioId;
  economy?: Economy;
  atWar: boolean;
  /** Share of the country's own provinces held by others, 0–1. */
  lost: number;
}

/**
 * The chance of a coup against a government, % a year: likelier where the
 * army already rules or elections are managed, much likelier as the state
 * comes apart, in a slump, in runaway inflation, and when land is lost.
 */
export function coupRisk(d: Pick<Domestic, "regime" | "stability" | "support">, ctx: CoupContext): number {
  let risk = COUP_BASE[d.regime] * COUP_ERA[ctx.era];
  // A settled democracy is all but safe; a shaky one is not.
  risk *= d.regime === "democracy" ? Math.max(0.05, (75 - d.stability) / 15) : 1 + Math.max(0, 60 - d.stability) / 14;
  if (d.support < 30) risk *= 1.3;
  if (ctx.economy && ctx.economy.growth <= -3) risk *= 1.5;
  if (ctx.economy && ctx.economy.inflation >= 50) risk *= 1.5;
  if (ctx.lost >= 0.1) risk *= 1.5;
  if (ctx.atWar && ctx.lost >= 0.25) risk *= 1.3;
  // A state with next to no soldiers has next to no one to stage a coup.
  if (ctx.economy && ctx.economy.troops < 2) risk *= 0.1;
  return round(Math.min(35, risk));
}

/** The chance a coup that is tried succeeds. */
const coupSuccess = (d: Domestic) => clamp((d.regime === "democracy" ? 0.35 : 0.55) * (d.stability < 30 ? 1.2 : 1), 0, 0.9);

/** The chance the government keeps power at an election: by its support where the vote is free, almost always where it is not. */
export function keepChance(d: Pick<Domestic, "regime" | "support">): number {
  if (d.regime === "democracy") return 1 / (1 + Math.exp(-(d.support - 48) / 5));
  return d.support >= 25 ? 0.95 : 0.75;
}

/** Share of each country's own provinces held by others, 0–1. */
export function lostShares(state: Pick<GameState, "regions">): Map<string, number> {
  const own = new Map<string, number>();
  const lost = new Map<string, number>();
  for (const r of Object.values(state.regions)) {
    own.set(r.owner, (own.get(r.owner) ?? 0) + 1);
    if (r.controller !== r.owner) lost.set(r.owner, (lost.get(r.owner) ?? 0) + 1);
  }
  const out = new Map<string, number>();
  for (const [tag, n] of own) out.set(tag, (lost.get(tag) ?? 0) / n);
  return out;
}

/** The wars a country fights now, outside any truce. */
const warsOf = (state: Pick<GameState, "wars" | "date">, tag: string) =>
  state.wars.filter((w) => (w.attackers.includes(tag) || w.defenders.includes(tag)) && !(w.truce && w.truce.until > state.date));

/** The coup risk of one country in a state, % a year. */
export function coupRiskIn(state: Pick<GameState, "countries" | "regions" | "wars" | "date" | "scenarioId">, tag: string, lost = lostShares(state)): number {
  const c = state.countries[tag];
  if (!c?.domestic) return 0;
  return coupRisk(c.domestic, { era: state.scenarioId, economy: c.economy, atWar: warsOf(state, tag).length > 0, lost: lost.get(tag) ?? 0 });
}

export type AbroadEvent = { kind: "election"; country: string; date: string; kept: boolean } | { kind: "coup"; country: string; succeeded: boolean };

/**
 * The dice for the coming turn, cast from the state before it: elections
 * that fall in the period, and coups by their risk. The same state casts the
 * same dice, on the server that writes the prompt and in the browser that
 * applies the answer.
 */
export function castAbroad(state: GameState): AbroadEvent[] {
  const to = addStep(state.date, state.step);
  const years = STEP_YEARS[state.step];
  const lost = lostShares(state);
  const owners = new Set(Object.values(state.regions).map((r) => r.owner));
  const out: AbroadEvent[] = [];
  for (const [tag, c] of Object.entries(state.countries)) {
    const d = c.domestic;
    // A country conquered outright holds no vote and has no army to rise; one that never had land (a Soviet republic in 1991) still votes.
    if (!d || tag === state.player || c.exile || (!c.dormant && !owners.has(tag))) continue;
    // A year passes between one attempt on a government and the next, whatever the length of a turn.
    if (!c.dormant && !(d.lastCoup && yearsBetween(d.lastCoup, to) < 1)) {
      const risk = coupRiskIn(state, tag, lost) / 100;
      if (happens(1 - (1 - risk) ** years, state.id, state.turn, `coup:${tag}`)) {
        const succeeded = happens(coupSuccess(d), state.id, state.turn, `coup-success:${tag}`);
        out.push({ kind: "coup", country: tag, succeeded });
        if (succeeded) continue;
      }
    }
    if (d.nextElection && d.nextElection <= to) {
      // An election that fell while the country could not hold it (all its land lost) is held now.
      const date = d.nextElection < state.date ? state.date : d.nextElection;
      out.push({ kind: "election", country: tag, date, kept: happens(keepChance(d), state.id, state.turn, `election:${tag}`) });
    }
  }
  return out;
}

/**
 * Where the government's support heads with the state of the country: growth
 * lifts it, prices and joblessness wear it down, blockade and lost land too;
 * a war rallies people at first and tires them after, and years in office
 * tire them of any government.
 */
function supportTarget(c: CountryState, ctx: { lost: number; warYears: number | null; tenure: number }): number {
  const e = c.economy;
  let t = 50;
  if (e) {
    t += 2.5 * clamp(e.growth, -8, 8);
    t -= 0.4 * clamp(e.inflation - 4, 0, 60);
    t -= 1.2 * clamp(e.unemployment - 6, 0, 25);
    t -= 10 * e.tradeCut;
  }
  t -= 50 * ctx.lost;
  if (ctx.warYears !== null) t += clamp(6 - 5 * ctx.warYears, -15, 6);
  t -= Math.min(12, 2.5 * ctx.tenure);
  return clamp(t, 5, 90);
}

/** Where stability heads: support, the crises the engine sees, land lost, and the kind of state. */
function stabilityTarget(state: GameState, tag: string, d: Domestic, lost: number): number {
  const crises = countryCrises(state, tag);
  const bonus: Record<RegimeKind, number> = { democracy: 10, limited: 0, party: 8, autocracy: 5, military: -5 };
  let t = 60 + bonus[d.regime] + 0.4 * (d.support - 50) - 60 * lost;
  for (const c of crises) t -= c.level === "critical" ? 8 : 3;
  return clamp(t, 5, 95);
}

interface AbroadContext {
  to: string;
  years: number;
  /** Countries whose leader the game master changed this turn. */
  named: Set<string>;
  /** Of those, the ones whose leader was in office: a new government, not a name filled in after a fall. */
  replaced: Set<string>;
}

/**
 * Moves the politics of every other country through the turn, after the
 * economies have: support and stability drift towards where the country
 * stands, then the dice cast before the turn land. A government that falls
 * without the game master naming its successor keeps no leader's name, so
 * the next turn is asked to name one.
 */
export function applyAbroad(next: GameState, events: AbroadEvent[], ctx: AbroadContext, applied: AppliedChange[]): void {
  // Support moves half way to where it heads in half a year; stability, slower, in two years.
  const pace = 1 - 0.5 ** (ctx.years / 0.5);
  const slow = 1 - 0.5 ** (ctx.years / 2);
  const lost = lostShares(next);
  const start = next.chronicle[0]?.from ?? next.date;
  // Countries born this turn get politics from their description; any other without them waits for the date's table on load.
  const born = new Set(applied.flatMap((a) => (a.kind === "new-country" ? [a.country] : [])));
  for (const [tag, c] of Object.entries(next.countries)) {
    if (tag === next.player) continue;
    if (!c.domestic) {
      if (born.has(tag)) c.domestic = newDomestic(c, next.scenarioId, ctx.to);
      continue;
    }
    const d = { ...c.domestic };
    const wars = warsOf(next, tag);
    const warYears = wars.length ? Math.max(0, yearsBetween(wars.map((w) => w.since).sort()[0], ctx.to)) : null;
    const share = lost.get(tag) ?? 0;
    // A government of the start date has been in office some years already.
    const tenure = d.changed ? yearsBetween(d.changed.date, ctx.to) : yearsBetween(start, ctx.to) + fixed(`tenure:${next.scenarioId}:${tag}`) * 4;
    d.support = fine(d.support + (supportTarget(c, { lost: share, warYears, tenure }) - d.support) * pace);
    d.stability = fine(d.stability + (stabilityTarget(next, tag, d, share) - d.stability) * slow);
    // A leader the game master put in office outside an election or a coup: a new government, given a little goodwill.
    if (ctx.replaced.has(tag) && !events.some((e) => e.country === tag)) {
      d.support = fine((d.support + 55) / 2);
      d.changed = { date: ctx.to, how: "leader" };
    }
    c.domestic = d;
  }

  for (const e of events) {
    const c = next.countries[e.country];
    const d = c?.domestic;
    if (!c || !d) continue;
    if (e.kind === "coup") {
      applied.push({ kind: "coup", country: e.country, succeeded: e.succeeded });
      if (e.succeeded) {
        c.domestic = {
          regime: "military",
          support: 45,
          stability: clamp(d.stability - 10, 10, 100),
          changed: { date: ctx.to, how: "coup" },
          lastCoup: ctx.to,
          ...(d.lastElection ? { lastElection: d.lastElection } : {}),
        };
        if (!ctx.named.has(e.country)) delete c.leader;
      } else {
        c.domestic = { ...d, stability: Math.max(5, d.stability - 6), support: Math.min(90, d.support + 4), lastCoup: ctx.to };
      }
      continue;
    }
    applied.push({ kind: "vote", country: e.country, kept: e.kept, date: e.date });
    const term = d.term ?? TERM[d.regime];
    let nextElection = addYears(e.date, term);
    while (nextElection <= ctx.to) nextElection = addYears(nextElection, term);
    // A junta's vote hands power to the civilians it picked.
    const regime = d.regime === "military" ? "limited" : d.regime;
    c.domestic = e.kept
      ? { ...d, regime, term, nextElection, lastElection: { date: e.date, kept: true }, support: Math.min(90, d.support + 4) }
      : { ...d, regime, term, nextElection, lastElection: { date: e.date, kept: false }, support: 58, stability: Math.min(95, d.stability + 3), changed: { date: e.date, how: "election" } };
    if (!e.kept && !ctx.named.has(e.country)) delete c.leader;
  }
}

/** The countries a turn should be told about: what the dice decided, and the shakiest governments that matter. */
export function describeAbroad(state: GameState, name: (tag: string) => string): string[] {
  const events = castAbroad(state);
  const lines: string[] = [];
  if (events.length) {
    const who = (e: AbroadEvent) => `${name(e.country)} [${e.country}]`;
    const coups = events.flatMap((e) => (e.kind === "coup" ? [`${who(e)} ${e.succeeded ? "succeeds" : "fails"}`] : []));
    const votes = (kept: boolean) => events.flatMap((e) => (e.kind === "election" && e.kept === kept ? [`${who(e)} ${e.date}`] : []));
    lines.push("POLITICS ELSEWHERE THIS PERIOD (the engine's dice, already cast: each must happen in the story; name the new leader of every government that falls in leaders):");
    if (coups.length) lines.push(`- coups: ${coups.join("; ")}`);
    if (votes(false).length) lines.push(`- governments that LOSE national elections: ${votes(false).join("; ")}`);
    if (votes(true).length) lines.push(`- governments that keep power at national elections: ${votes(true).join("; ")}`);
  }
  // Governments that fell last turn and still have no named leader.
  const since = state.chronicle.at(-1)?.from ?? state.date;
  const unnamed = Object.values(state.countries).filter((c) => c.tag !== state.player && !c.leader && c.domestic?.changed && c.domestic.changed.date >= since);
  if (unnamed.length) lines.push(`NEW GOVERNMENTS WITHOUT A NAMED LEADER (name them in leaders): ${unnamed.map((c) => `${name(c.tag)} [${c.tag}]`).join(", ")}`);
  const lost = lostShares(state);
  const shaky = Object.values(state.countries)
    .filter((c) => c.tag !== state.player && c.domestic && !c.dormant && c.economy)
    .map((c) => ({ c, risk: coupRiskIn(state, c.tag, lost) }))
    .filter((x) => x.risk >= 10)
    .sort((a, b) => b.c.economy!.gdp - a.c.economy!.gdp)
    .slice(0, 6);
  if (shaky.length) {
    lines.push(`SHAKY GOVERNMENTS (support, stability, coup risk a year): ${shaky.map(({ c, risk }) => `${name(c.tag)} [${c.tag}] ${Math.round(c.domestic!.support)}%, ${Math.round(c.domestic!.stability)}, ${risk}%`).join("; ")}`);
  }
  return lines;
}

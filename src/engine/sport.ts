import { z } from "zod";
import { addStep } from "./calendar";
import { roll } from "./dice";
import { payOffBudget, STEP_YEARS } from "./economy";
import { peopleIn } from "./population";
import { distanceKm } from "./provinces";
import { countsFor } from "./occupation";
import { addTension, alliesOf, greatPowers, powers, remember, tieOf, warBetween } from "./relations";
import { BID_CITIES, EVENTS, FOOTBALL, HISTORY_BANS, HISTORY_BOYCOTTS, HISTORY_GAMES, NO_SYSTEM, SYSTEM_EXTRA, SYSTEM_FROM, SYSTEM_LEGACY, TRADITION, WINTER_HOSTS, WINTER_STRENGTH, type HistoryGames, type Tenure } from "./scenarios/sport";
import { regimeOf } from "./warMeans";
import {
  GAMES_KINDS,
  type AppliedChange,
  type DeedKind,
  type GameState,
  type Games,
  type GamesKind,
  type HostLoss,
  type Localized,
  type MapRegion,
  type MedalRow,
  type SportBan,
  type SportState,
} from "./types";

/**
 * Sport: the Summer and Winter Olympic Games and the football World Cup.
 *
 * The Games keep history's calendar – the Summer Games every four years, the
 * Winter Games with them until 1992 and two years apart after, the World Cup
 * from 1930 – and, in the historical mode, history's hosts, each chosen on the
 * day history chose it (Tokyo and Sapporo giving up their Games of 1940,
 * Denver its of 1976, Colombia its World Cup of 1986, on their days too). In
 * the free mode the International Olympic Committee and FIFA vote about seven
 * years ahead among the countries that bid, the player's government among
 * them by an order or the sport panel's button: wealth, size and the world's
 * goodwill weigh, a recent host weighs less, and the dice decide. Past the
 * calendar history knows, both modes vote.
 *
 * A host that can no longer hold its Games loses them, in the historical mode
 * too: conquered, gone, or at war on its own soil, the Games go to a new vote
 * while there is time, and are cancelled when there is none. A great war –
 * one whose weaker side holds a quarter of the largest economy – cancels the
 * Games that fall in it or in the year after, and the committees hold no
 * vote while it lasts.
 *
 * Medal tables are made by the engine, never replayed: every event is drawn
 * among the countries that come, each weighted by its people, its wealth, a
 * state sport system (the Soviet one, East Germany's above all), the money
 * the player's government gives sport, the host's edge and a little luck of
 * the Games. A World Cup is played as a knockout by football strength, the
 * host's edge and the dice, upsets included. Countries at war with a host
 * stay away; boycotts – history's in the historical mode, a great power's
 * protest at an aggression it condemned, a reprisal for its own Games
 * boycotted, deep hostility – and bans (history's, an aggressor under the
 * world body's sanctions, a ban the player called for and the world voted)
 * are diplomatic acts the governments remember (engine/relations.ts).
 *
 * Hosting costs the host money over the years before the Games and brings it
 * prestige; a medal table led, or beaten beyond hopes, lifts the people's
 * mood, and the money the player's government gives sport builds its form
 * over years and with it a little of the nation's health (engine/society.ts).
 *
 * Everything the period brings is cast before the turn is written
 * (`castSport`), so the game master tells the Games as the engine decided
 * them, and the same cast is applied after (`applySport`).
 */

const DAY = 86_400_000;
const time = (d: string) => Date.parse(`${d}T00:00:00Z`);
const addDays = (d: string, n: number) => new Date(time(d) + Math.round(n) * DAY).toISOString().slice(0, 10);
const addYears = (d: string, y: number) => addDays(d, y * 365.25);
const yearsFrom = (a: string, b: string) => (time(b) - time(a)) / (365.25 * DAY);
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const round2 = (v: number) => Math.round(v * 100) / 100;

/** How long each lasts, days: the medal table or the final comes at the end. */
export const DURATION: Record<GamesKind, number> = { summer: 16, winter: 16, cup: 30 };
/** The committees vote this many years before the Games. */
export const VOTE_YEARS = 7;
/** The calendar is kept this far ahead. */
const HORIZON_YEARS = 12;
/** A host lost with less than this left (years) leaves no time for another: the Games are cancelled. */
const MIN_LEAD = 0.5;
/** A war is a great war when its weaker side holds this share of the largest economy. */
const GREAT_SHARE = 0.25;
/** The Games a great war's aftermath still cancels, years after its end. */
const AFTERMATH = 1;
/** What hosting costs, a share of the largest economy of the day, spread over the years from the vote to the Games. */
const HOSTING_COST: Record<GamesKind, number> = { summer: 0.0008, winter: 0.0003, cup: 0.0004 };
/** The smallest economy that can bid, a share of the largest. */
const MIN_BIDDER: Record<GamesKind, number> = { summer: 0.01, winter: 0.004, cup: 0.004 };
/** How much likelier history's host is at its vote in the historical mode. */
const HISTORY_EDGE = 12;
/** The host's edge: medals weigh more at home, a team plays better (Elo points). */
const HOST_MEDALS: Record<Exclude<GamesKind, "cup">, number> = { summer: 1.5, winter: 1.4 };
const HOST_ELO = 100;
/** The player's money for sport: the most of the social budget, the usual share with and without a state sport system, %. */
export const MAX_SPORT_SHARE = 8;
const NORM_SHARE = 1.5;
const SYSTEM_SHARE = 3;
/**
 * How a country's weight in an Olympic event is made: people (and on snow
 * and ice fewer of them count), wealth – a poor country is held back far
 * more than a rich one is lifted – a state sport system and what it leaves
 * behind, and how sharply the strong pull ahead. Fitted on the medal tables
 * of 1952–2024 against the start dates' economies (tests/sport.test.ts
 * checks the shape, not history's numbers).
 */
export const MEDAL_MODEL = { pop: 0.5, winterPop: 0.3, wealth: 0.4, poor: 0.06, sharp: 1.6, winterSharp: 1.15, system: 1.6, legacy: 0.8, floor: 0.2 };
/** Medal-table rows kept besides the player's. */
const TABLE_ROWS = 10;

export const gamesId = (kind: GamesKind, year: number) => `${kind}-${year}`;
const HISTORY = new Map(HISTORY_GAMES.map((h) => [gamesId(h.kind, h.year), h] as const));

/** Whether a kind of Games falls in a year. */
export function scheduled(kind: GamesKind, year: number): boolean {
  if (kind === "summer") return year >= 1896 && year % 4 === 0;
  if (kind === "winter") return year >= 1924 && (year <= 1992 ? year % 4 === 0 : (year - 1994) % 4 === 0);
  return year >= 1930 && (year - 1930) % 4 === 0;
}

const DEFAULT_DAY: Record<GamesKind, string> = { summer: "07-24", winter: "02-06", cup: "06-12" };
const opensOf = (kind: GamesKind, year: number) => HISTORY.get(gamesId(kind, year))?.opens ?? `${year}-${DEFAULT_DAY[kind]}`;
export const closesOf = (g: Pick<Games, "opens" | "kind">) => addDays(g.opens, DURATION[g.kind]);

/** The host history had on a day, and the tenure it held then. */
function tenureAt(h: HistoryGames, date: string): Tenure | undefined {
  let current: Tenure | undefined;
  for (const t of h.tenures) {
    if (t.awarded > date) break;
    current = t.withdrew && t.withdrew <= date ? undefined : t;
  }
  return current;
}

const sameHosts = (a: string[], b: string[]) => a.length === b.length && a.every((t) => b.includes(t));

type StartState = Pick<GameState, "date" | "wars">;

/** Games of every kind from after `after` up to `upTo`, with history's hosts as of `seed` (the start date) or none. */
function extend(games: Games[], from: string, upTo: string, seed?: string): Games[] {
  const added: Games[] = [];
  for (const kind of GAMES_KINDS) {
    const years = games.filter((g) => g.kind === kind).map((g) => g.year);
    let year = years.length ? Math.max(...years) + 1 : Number(from.slice(0, 4)) - 1;
    for (; ; year++) {
      if (!scheduled(kind, year)) continue;
      const opens = opensOf(kind, year);
      if (opens > upTo) break;
      const g: Games = { id: gamesId(kind, year), kind, year, opens, hosts: [], status: "planned" };
      if (closesOf(g) <= from) continue;
      const h = HISTORY.get(g.id);
      const t = seed && h ? tenureAt(h, seed) : undefined;
      if (t) Object.assign(g, { hosts: [...t.hosts], awarded: t.awarded, ...(t.city ? { city: t.city } : {}) });
      added.push(g);
    }
  }
  return [...games, ...added].sort((a, b) => a.opens.localeCompare(b.opens));
}

/**
 * Sport on a new game's start date: the last Games of each kind held before
 * it, with history's champion, and the Games of the next twelve years with
 * the hosts history had chosen by then.
 */
export function startingSport(state: StartState): SportState {
  const held: Games[] = [];
  for (const kind of GAMES_KINDS) {
    const last = HISTORY_GAMES.filter((h) => h.kind === kind && !h.cancelled && closesOf({ kind, opens: h.opens }) <= state.date).at(-1);
    const t = last?.tenures.at(-1);
    if (!last || !t) continue;
    held.push({ id: gamesId(kind, last.year), kind, year: last.year, opens: last.opens, hosts: [...t.hosts], ...(t.city ? { city: t.city } : {}), awarded: t.awarded, status: "held", ...(last.champion ? { champion: last.champion } : {}) });
  }
  // History's bans in force on the day (a war's only while it is fought).
  const bans: SportBan[] = HISTORY_BANS.filter((h) => h.since <= state.date && (!h.until || h.until > state.date) && (!h.war || warBetween(state, h.war[0], h.war[1]))).map((h) => ({
    tag: h.tag,
    since: h.since,
    by: "history" as const,
    ...(h.until ? { until: h.until } : {}),
  }));
  return { games: extend(held, state.date, addYears(state.date, HORIZON_YEARS), state.date), ...(bans.length ? { bans } : {}) };
}

// ---- who can hold Games, who is at war

/** A country's economy, alive. */
const economyOf = (state: Pick<GameState, "countries">, tag: string) => {
  const c = state.countries[tag];
  return c && !c.dormant && c.economy ? c.economy : undefined;
};

/** The largest economy in the world, $bn. */
function largestEconomy(state: Pick<GameState, "countries">): number {
  let max = 0.01;
  for (const c of Object.values(state.countries)) if (!c.dormant && c.economy) max = Math.max(max, c.economy.gdp);
  return max;
}

/** The first war being fought whose weaker side holds a quarter of the largest economy: a world war, which cancels the Games – an armistice between them does not. */
export function greatWar(state: Pick<GameState, "wars" | "countries">): GameState["wars"][number] | undefined {
  const largest = largestEconomy(state);
  const side = (tags: string[]) => tags.reduce((s, t) => s + (economyOf(state, t)?.gdp ?? 0), 0);
  return state.wars.find((w) => !w.truce && Math.min(side(w.attackers), side(w.defenders)) >= GREAT_SHARE * largest);
}

/** How far from its richest province a country's home reaches: an empire's far colonies send their own teams, or none, and a war there is not war at home. */
const HOME_KM = 4500;

/** Each country's richest province (people by their income): the centre of its home. Without the map, none: all its land is home. */
function homeCores(state: Pick<GameState, "regions">, map?: Record<string, MapRegion> | null): Map<string, [number, number]> {
  const best = new Map<string, { at: [number, number]; weight: number }>();
  if (!map) return new Map();
  for (const [id, r] of Object.entries(state.regions)) {
    const p = map[id];
    if (!p?.at) continue;
    const weight = (peopleIn(r, p) || 1) * (p.inc ?? 1);
    const b = best.get(r.owner);
    if (!b || weight > b.weight) best.set(r.owner, { at: p.at, weight });
  }
  return new Map([...best].map(([tag, b]) => [tag, b.at] as const));
}

const atHome = (cores: Map<string, [number, number]>, map: Record<string, MapRegion> | null | undefined, tag: string, id: string) => {
  const core = cores.get(tag);
  const at = map?.[id]?.at;
  return !core || !at || distanceKm(core, at) <= HOME_KM;
};

/**
 * Why each country could not hold Games now: gone or in exile, half its
 * home in enemy hands, or war on its home soil (a colonial war far away is
 * not); none for a country that could.
 */
export function hostTroubles(state: Pick<GameState, "regions" | "countries" | "wars">, map?: Record<string, MapRegion> | null): Map<string, HostLoss | null> {
  const cores = homeCores(state, map);
  const tally = new Map<string, { own: number; held: number; front: boolean }>();
  for (const [id, r] of Object.entries(state.regions)) {
    if (!atHome(cores, map, r.owner, id)) continue;
    const t = tally.get(r.owner) ?? { own: 0, held: 0, front: false };
    t.own += 1;
    if (r.controller === r.owner && countsFor(r) === r.owner) t.held += 1;
    const enemy = r.controller !== r.owner ? r.controller : r.contested;
    if (enemy && !t.front && warBetween(state, r.owner, enemy)) t.front = true;
    tally.set(r.owner, t);
  }
  const out = new Map<string, HostLoss | null>();
  for (const [tag, c] of Object.entries(state.countries)) {
    const t = tally.get(tag);
    if (c.dormant || c.exile || !t?.own) out.set(tag, "collapsed");
    else if (c.client || t.held / t.own < 0.5) out.set(tag, "conquered");
    else out.set(tag, t.front ? "war" : null);
  }
  return out;
}

// ---- people, wealth and strength

/**
 * People of every country at home, thousands: around its richest province
 * (people by their income), so an empire's colonies do not count – from the
 * map, or the provinces' own counts once the game has moved them.
 */
function peopleByCountry(state: Pick<GameState, "regions">, map?: Record<string, MapRegion> | null): Map<string, number> {
  const cores = homeCores(state, map);
  const home = new Map<string, number>();
  for (const [id, r] of Object.entries(state.regions)) {
    const tag = countsFor(r);
    if (atHome(cores, map, tag, id)) home.set(tag, (home.get(tag) ?? 0) + (peopleIn(r, map?.[id]) || 1000));
  }
  return home;
}

export interface Means {
  /** People at home, thousands. */
  people: Map<string, number>;
  /** GDP per head of each country at home, dollars. */
  perHead: Map<string, number>;
  /** GDP per head of the richest large country, dollars. */
  ref: number;
  largest: number;
}

export function meansOf(state: Pick<GameState, "regions" | "countries">, map?: Record<string, MapRegion> | null): Means {
  const people = peopleByCountry(state, map);
  const perHead = new Map<string, number>();
  let ref = 1;
  for (const c of Object.values(state.countries)) {
    const pop = people.get(c.tag) ?? 0;
    if (c.dormant || !c.economy || pop <= 0) continue;
    const pc = (c.economy.gdp * 1e6) / pop;
    perHead.set(c.tag, pc);
    if (pop >= 20_000) ref = Math.max(ref, pc);
  }
  return { people, perHead, ref, largest: largestEconomy(state) };
}

/** People at home in millions and wealth against the richest large country, for a country alive. */
function sizeOf(state: Pick<GameState, "countries">, means: Means, tag: string): { pop: number; wealth: number } | undefined {
  const e = economyOf(state, tag);
  const pop = means.people.get(tag) ?? 0;
  const pc = means.perHead.get(tag);
  if (!e || pop <= 0 || !pc) return undefined;
  return { pop: pop / 1000, wealth: clamp(pc / means.ref, 0.003, 1.5) };
}

type SportReader = Pick<GameState, "countries" | "player" | "scenarioId" | "date"> & Partial<Pick<GameState, "politics" | "sport">>;

/**
 * A state sport system: one party's rule on the Soviet model from 1948,
 * with East Germany's, Cuba's and the Soviet Union's above the rest; and,
 * once such a regime has gone, the schools, coaches and habits it leaves
 * (Russia, the old Soviet republics and the Eastern bloc from 1990).
 */
export function sportSystem(state: SportReader, tag: string): number {
  const year = Number(state.date.slice(0, 4));
  if (year < 1948 || NO_SYSTEM.has(tag)) return 1;
  if (regimeOf(state, tag) === "party") return MEDAL_MODEL.system * (year >= (SYSTEM_FROM[tag] ?? 0) ? (SYSTEM_EXTRA[tag] ?? 1) : 1);
  const legacy = year >= 1990 ? SYSTEM_LEGACY[tag] : undefined;
  return legacy ? 1 + (legacy - 1) * MEDAL_MODEL.legacy : 1;
}

/** The share of its social budget a government gives sport by habit, %. */
export const normShare = (state: SportReader, tag: string) => (sportSystem(state, tag) > 1 ? SYSTEM_SHARE : NORM_SHARE);
/** The player's share now, %. */
export const sportShare = (state: SportReader) => state.sport?.share ?? normShare(state, state.player);
/** The player's money for sport a year, $bn. */
export const sportMoney = (state: SportReader) => round2(((state.countries[state.player]?.economy?.budget.social ?? 0) * sportShare(state)) / 100);

/** The form the money builds: 1 at the usual share, from 0.6 with nothing to 1.5. */
const formTarget = (share: number, norm: number) => clamp((Math.max(0, share) / norm) ** 0.4, 0.6, 1.5);

/** Years of life sport adds to the player's people, or takes: its form against the usual (engine/society.ts). */
export function sportLife(state: Pick<GameState, "player"> & Partial<Pick<GameState, "sport">>, tag: string): number {
  return tag === state.player && state.sport?.form ? round2((state.sport.form - 1) * 0.8) : 0;
}

/** How a poor country is held back: little below a tenth of the richest's wealth, hardly at all above a third. */
export const poverty = (wealth: number) => 1 / (1 + (MEDAL_MODEL.poor / wealth) ** 2);

/** A country's weight in an Olympic event, before the host's edge and the luck of the Games: people, wealth, its sport system and money, snow for the Winter Games. */
export function medalWeight(state: SportReader, means: Means, tag: string, kind: Exclude<GamesKind, "cup">): number {
  const size = sizeOf(state, means, tag);
  if (!size) return 0;
  const m = MEDAL_MODEL;
  const system = sportSystem(state, tag);
  // A state sport system pays for sport whatever its people earn, up to a point.
  const wealth = system > 1 ? Math.max(size.wealth, Math.min(m.floor, 3 * size.wealth)) : size.wealth;
  let w = size.pop ** (kind === "winter" ? m.winterPop : m.pop) * poverty(wealth) * wealth ** m.wealth * system * (kind === "summer" ? (TRADITION[tag] ?? 1) : 1);
  if (kind === "winter") w *= WINTER_STRENGTH[tag] ?? 0.05;
  if (tag === state.player) w *= state.sport?.form ?? 1;
  return w ** (kind === "winter" ? m.winterSharp : m.sharp);
}

/** Football strength now, Elo-like: the table's, or what people and wealth give a country outside it. */
export function footballRating(state: SportReader, means: Means, tag: string, year: number): number {
  const row = FOOTBALL[tag];
  if (row) {
    const [a, b, c] = row;
    if (year <= 1930) return a;
    if (year <= 1970) return a + ((b - a) * (year - 1930)) / 40;
    if (year <= 2010) return b + ((c - b) * (year - 1970)) / 40;
    return c;
  }
  const size = sizeOf(state, means, tag);
  if (!size) return 1300;
  return Math.min(1700, 1350 + 90 * Math.log10(1 + size.pop) + 150 * Math.min(1, size.wealth));
}

/** Medal events at Games of a kind in a year. */
export function eventsAt(kind: Exclude<GamesKind, "cup">, year: number): number {
  const points = EVENTS[kind];
  if (year <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [y1, v1] = points[i];
    const [y0, v0] = points[i - 1];
    if (year <= y1) return Math.round(v0 + ((v1 - v0) * (year - y0)) / (y1 - y0));
  }
  return points[points.length - 1][1];
}

/**
 * Every country's sporting strength, 0–100, the strongest 100: its weight in
 * the Summer Games' events, people, wealth, system and form, as a share of
 * the strongest's (square-rooted, so the middle is not lost).
 */
export function sportStrength(state: SportReader & Pick<GameState, "regions">, map?: Record<string, MapRegion> | null): Map<string, number> {
  const means = meansOf(state, map);
  const weights = Object.values(state.countries)
    .filter((c) => !c.dormant && c.economy)
    .map((c) => [c.tag, medalWeight(state, means, c.tag, "summer")] as const);
  const top = Math.max(1e-9, ...weights.map(([, w]) => w));
  return new Map(weights.map(([tag, w]) => [tag, Math.round(100 * Math.sqrt(w / top))]));
}

// ---- the cast of a period

/** What the period's sport does beyond the Games themselves, applied to the state after the turn. */
interface Effects {
  /** Points of support for a government abroad; for the player's, points of unrest taken off. */
  support: Map<string, number>;
  /** Trust one government feels for another, moved; with a deed it is remembered. */
  trust: { who: string; toward: string; delta: number; deed?: DeedKind }[];
  tension: { who: string; toward: string; amount: number }[];
  /** Money each country pays this period, $bn (negative: saved). */
  costs: Map<string, number>;
}

export interface SportCast {
  sport: SportState;
  applied: AppliedChange[];
  effects: Effects;
  /** The period's end. */
  to: string;
}

interface Ctx {
  state: GameState;
  from: string;
  to: string;
  game: string;
  troubles: Map<string, HostLoss | null>;
  bans: Set<string>;
  /** Countries fighting in the great war, which bid for nothing. */
  fighting: Set<string>;
  means: Means;
  historical: boolean;
}

const add = (map: Map<string, number>, tag: string, n: number) => map.set(tag, (map.get(tag) ?? 0) + n);
const lead = (g: Pick<Games, "hosts">) => g.hosts[0];

/** Whether a country can bid for a kind of Games now. */
function canBid(ctx: Ctx, tag: string, kind: GamesKind): boolean {
  const e = economyOf(ctx.state, tag);
  if (!e || ctx.troubles.get(tag) !== null || ctx.bans.has(tag) || ctx.fighting.has(tag)) return false;
  if (kind === "winter" && !WINTER_HOSTS.has(tag)) return false;
  return e.gdp >= MIN_BIDDER[kind] * ctx.means.largest;
}

/** How strong a bid is: wealth and size, the world's goodwill for the player's, less for a recent host, football for a World Cup. */
function bidScore(ctx: Ctx, sport: SportState, tag: string, g: Games): number {
  const size = sizeOf(ctx.state, ctx.means, tag);
  const e = economyOf(ctx.state, tag);
  if (!size || !e) return 0;
  let s = (e.gdp / ctx.means.largest) ** 0.4 * Math.min(1, size.wealth) ** 0.6;
  const hosted = sport.games.filter((x) => x.id !== g.id && x.hosts.includes(tag) && x.status !== "cancelled");
  if (hosted.some((x) => x.kind === g.kind && x.year >= g.year - 12)) s *= 0.25;
  else if (hosted.some((x) => Math.abs(x.year - g.year) <= 8)) s *= 0.6;
  if (g.kind === "cup") s *= clamp((footballRating(ctx.state, ctx.means, tag, g.year) - 1300) / 500, 0.1, 2) ** 1.5;
  if (tag === ctx.state.player) {
    const courses = Object.values(ctx.state.countries).filter((c) => c.course && c.tag !== tag && !c.dormant);
    const goodwill = courses.length ? courses.reduce((sum, c) => sum + tieOf(ctx.state, c.tag, tag).trust, 0) / courses.length / 100 : 0;
    s *= 1 + 0.5 * clamp(goodwill, -1, 1);
  }
  return s;
}

/** The history tenure a vote would follow: chosen by now, not yet lost in the game. */
function historyTenure(ctx: Ctx, g: Games): Tenure | undefined {
  const h = HISTORY.get(g.id);
  if (!h) return undefined;
  const lost = g.replaced ?? [];
  return h.tenures.find((t) => !lost.some((r) => sameHosts(r.hosts, t.hosts)));
}

/** Whether a Games' vote falls due by the period's end. */
function voteDue(ctx: Ctx, g: Games): boolean {
  if (ctx.historical) {
    const t = historyTenure(ctx, g);
    if (t) return t.awarded <= ctx.to;
  }
  return yearsFrom(ctx.to, g.opens) <= VOTE_YEARS;
}

/** The committee's vote: history's host in the historical mode while it can hold them, else the best bids, the player's among them, by the dice. */
function vote(ctx: Ctx, sport: SportState, g: Games): { hosts: string[]; city?: Localized; bids: string[]; date: string } | null {
  const t = ctx.historical ? historyTenure(ctx, g) : undefined;
  const date = t && t.awarded > ctx.from && t.awarded <= ctx.to ? t.awarded : ctx.to;
  const candidates: { hosts: string[]; city?: Localized; score: number }[] = [];
  const able = t?.hosts.filter((h) => canBid(ctx, h, g.kind));
  if (t && able?.length) {
    const score = Math.max(...able.map((h) => bidScore(ctx, sport, h, g)), 0.05);
    candidates.push({ hosts: able, ...(t.city ? { city: t.city } : {}), score: score * Math.sqrt(HISTORY_EDGE) });
  } else {
    // The field: the strongest bids, a little shuffled by the dice.
    const field = Object.keys(ctx.state.countries)
      .filter((tag) => tag !== ctx.state.player && canBid(ctx, tag, g.kind))
      .map((tag) => ({ tag, score: bidScore(ctx, sport, tag, g) * (0.7 + 0.6 * roll(ctx.game, ctx.state.turn, `sport:bid:${g.id}:${tag}`)) }))
      .sort((a, b) => b.score - a.score || a.tag.localeCompare(b.tag))
      .slice(0, 4);
    for (const f of field) candidates.push({ hosts: [f.tag], score: f.score });
  }
  const player = ctx.state.player;
  if (sport.bids?.includes(g.id) && !candidates.some((c) => c.hosts.includes(player)) && canBid(ctx, player, g.kind)) candidates.push({ hosts: [player], score: bidScore(ctx, sport, player, g) });
  if (!candidates.length) return null;
  const weights = candidates.map((c) => c.score ** 2);
  const total = weights.reduce((s, w) => s + w, 0);
  let r = roll(ctx.game, ctx.state.turn, `sport:vote:${g.id}`) * total;
  let won = candidates[candidates.length - 1];
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r < 0) {
      won = candidates[i];
      break;
    }
  }
  const city = won.city ?? (g.kind === "cup" ? undefined : BID_CITIES[won.hosts[0]]?.[g.kind]);
  return { hosts: won.hosts, ...(city ? { city } : {}), bids: [...new Set(candidates.flatMap((c) => c.hosts))], date };
}

/** The bans in force by the period's end: history's in the historical mode, aggressors under sanctions while their war lasts, and those the player's call won. */
function bansAt(state: GameState, sport: SportState, to: string, historical: boolean): SportBan[] {
  const out: SportBan[] = [];
  const had = new Map((sport.bans ?? []).map((b) => [b.tag, b] as const));
  const alive = (tag: string) => Boolean(state.countries[tag] && !state.countries[tag].dormant);
  const push = (b: SportBan) => {
    if (alive(b.tag) && !out.some((x) => x.tag === b.tag)) out.push({ ...b, since: had.get(b.tag)?.since ?? b.since });
  };
  for (const b of sport.bans ?? []) if (b.by === "vote" && (!b.until || b.until > to)) push(b);
  // History's: in the historical mode as they come; in the free mode only those in force when the game began, until their end.
  for (const h of HISTORY_BANS) {
    if (historical || had.get(h.tag)?.by === "history") {
      if (h.since > to || (h.until && h.until <= to) || (h.war && !warBetween(state, h.war[0], h.war[1]))) continue;
      push({ tag: h.tag, since: h.since, by: "history", ...(h.until ? { until: h.until } : {}) });
    }
  }
  for (const a of state.aggressions ?? []) {
    if (!state.wars.some((w) => w.id === a.war)) continue;
    if (a.resolutions?.some((r) => r.passed && r.kind !== "condemn")) push({ tag: a.by, since: to, by: "aggression" });
  }
  return out;
}

/** Who stays away from Games in protest: the player by its own word, history's boycotts, and the governments the engine moves. */
function boycottsOf(ctx: Ctx, sport: SportState, g: Games): { tag: string; lead: boolean }[] {
  const { state } = ctx;
  const host = lead(g);
  const out = new Map<string, boolean>();
  const player = state.player;
  if (sport.boycotts?.includes(g.id) && !g.hosts.includes(player)) out.set(player, true);
  const trust = (a: string, b: string) => tieOf(state, a, b).trust;
  const can = (tag: string) => Boolean(economyOf(state, tag)) && !g.hosts.includes(tag) && !warBetween(state, tag, host) && tag !== player;
  // History's boycotts, where the Games are where history held them and the leader still distrusts the host.
  if (ctx.historical) {
    for (const b of HISTORY_BOYCOTTS) {
      if (b.games !== g.id || !g.hosts.includes(b.host)) continue;
      const leads = b.lead === player ? out.has(player) : can(b.lead) && (!state.countries[b.lead].course || trust(b.lead, host) < 30);
      if (!leads) continue;
      if (b.lead !== player) out.set(b.lead, true);
      for (const f of b.follow) if (can(f) && !out.has(f) && trust(f, host) < 30) out.set(f, false);
    }
  }
  // A great power that condemned the host's aggression of the last year stays away, and its allies who trust it come along.
  const great = greatPowers(powers(state));
  const recent = (state.aggressions ?? []).filter((a) => a.by === host && (!a.closed || yearsFrom(a.closed, g.opens) <= 1));
  for (const tag of Object.keys(state.countries).sort()) {
    const c = state.countries[tag];
    if (!c.course || !can(tag) || out.has(tag)) continue;
    const condemned = great.has(tag) && recent.some((a) => a.condemned.includes(tag)) && trust(tag, host) <= 0;
    const reprisal = c.course.memory.some((m) => m.by === host && m.what === "boycott" && yearsFrom(m.date, g.opens) <= 12);
    const hostile = trust(tag, host) <= -60 && (c.course.ties[host]?.tension ?? 0) >= 50;
    if (!condemned && !reprisal && !hostile) continue;
    out.set(tag, true);
    if (hostile && !condemned && !reprisal) continue;
    for (const f of alliesOf(state, tag)) if (can(f) && !out.has(f) && trust(f, tag) >= 30 && trust(f, host) < 20) out.set(f, false);
  }
  return [...out].map(([tag, isLead]) => ({ tag, lead: isLead }));
}

/** Who comes to Games: every country alive but the banned, those that boycott and those at war with a host. */
function participants(ctx: Ctx, g: Games, away: Set<string>): string[] {
  return Object.keys(ctx.state.countries)
    .filter((tag) => economyOf(ctx.state, tag) && !ctx.bans.has(tag) && !away.has(tag) && !g.hosts.some((h) => h !== tag && warBetween(ctx.state, tag, h)))
    .sort();
}

/**
 * The dice of one Games, in a stream: seeded by the game's roll for it, then
 * drawn one after another (mulberry32), so the hundreds of draws of a Games
 * spread evenly – keys that differ only in a number, each hashed and mixed
 * once, can leave gaps a country's share falls into.
 */
function stream(ctx: Ctx, key: string): () => number {
  let a = Math.floor(roll(ctx.game, ctx.state.turn, key) * 4294967296) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The Olympics played: every event drawn among the countries that came, by weight and luck; the full table, best first. */
function playOlympics(ctx: Ctx, g: Games, tags: string[]): { table: MedalRow[]; expected: Map<string, number> } {
  const kind = g.kind as Exclude<GamesKind, "cup">;
  const dice = stream(ctx, `sport:${g.id}`);
  const weights = tags.map((tag) => {
    const luck = Math.exp(0.35 * (dice() - 0.5));
    const host = g.hosts.includes(tag) ? HOST_MEDALS[kind] ** (kind === "winter" ? MEDAL_MODEL.winterSharp : MEDAL_MODEL.sharp) : 1;
    // A country with war on its soil or its land in enemy hands sends fewer and worse-prepared athletes.
    const trouble = ctx.troubles.get(tag);
    const war = trouble === "war" ? 0.6 : trouble === "conquered" ? 0.3 : 1;
    return medalWeight(ctx.state, ctx.means, tag, kind) * host * luck * war;
  });
  const total = weights.reduce((s, w) => s + w, 0);
  const events = eventsAt(kind, g.year);
  const expected = new Map(tags.map((tag, i) => [tag, total > 0 ? (events * weights[i]) / total : 0] as const));
  const rows = tags.map((tag) => ({ tag, gold: 0, silver: 0, bronze: 0 }));
  if (total <= 0) return { table: [], expected };
  const places = ["gold", "silver", "bronze"] as const;
  for (let e = 0; e < events; e++) {
    let left = total;
    const taken: number[] = [];
    for (let p = 0; p < 3; p++) {
      let r = dice() * left;
      let pick = -1;
      for (let i = 0; i < weights.length; i++) {
        if (taken.includes(i) || weights[i] <= 0) continue;
        r -= weights[i];
        pick = i;
        if (r < 0) break;
      }
      if (pick < 0) break;
      rows[pick][places[p]] += 1;
      taken.push(pick);
      left -= weights[pick];
    }
  }
  const table = rows
    .filter((r) => r.gold + r.silver + r.bronze > 0)
    .sort((a, b) => b.gold - a.gold || b.silver - a.silver || b.bronze - a.bronze || a.tag.localeCompare(b.tag));
  return { table, expected };
}

/** A World Cup played as a knockout: the field qualifies by strength and the dice, the host plays at home. */
function playCup(ctx: Ctx, g: Games, tags: string[]): NonNullable<Games["final"]> | undefined {
  const dice = stream(ctx, `sport:${g.id}`);
  const rating = (tag: string) => footballRating(ctx.state, ctx.means, tag, g.year) + (g.hosts.includes(tag) ? HOST_ELO : 0);
  const size = g.year >= 1998 ? 32 : 16;
  const hosts = tags.filter((t) => g.hosts.includes(t));
  const rest = tags
    .filter((t) => !g.hosts.includes(t))
    .map((t) => ({ t, q: rating(t) + 300 * (dice() - 0.5) }))
    .sort((a, b) => b.q - a.q || a.t.localeCompare(b.t))
    .slice(0, Math.max(0, size - hosts.length))
    .map((x) => x.t);
  if (hosts.length + rest.length < 2) return undefined;
  // A knockout needs a field of 2, 4, 8…: when fewer came, the last to qualify drop out; the hosts always play.
  const field = 2 ** Math.floor(Math.log2(hosts.length + rest.length));
  let round = [...hosts, ...rest.slice(0, Math.max(0, field - hosts.length))].slice(0, field).sort((a, b) => rating(b) - rating(a) || a.localeCompare(b));
  // Seeded: the strongest meets the weakest.
  const bracket: string[] = [];
  for (let i = 0; i < round.length / 2; i++) bracket.push(round[i], round[round.length - 1 - i]);
  round = bracket;
  let semis: string[] = [];
  let final: NonNullable<Games["final"]> | undefined;
  for (let stage = 0; round.length > 1; stage++) {
    if (round.length === 4) semis = [...round];
    const next: string[] = [];
    for (let i = 0; i + 1 < round.length; i += 2) {
      const [a, b] = [round[i], round[i + 1]];
      const p = 1 / (1 + 10 ** (-(rating(a) - rating(b)) / 300));
      const r = dice();
      const winner = r < p ? a : b;
      const loser = winner === a ? b : a;
      next.push(winner);
      if (round.length === 2) {
        const s1 = dice();
        const s2 = dice();
        const pen = dice();
        const penalties = Math.abs(p - 0.5) < 0.12 && pen < 0.3;
        const goals = 1 + Math.floor(s1 * 3);
        const score: [number, number] = penalties ? [goals - 1, goals - 1] : [goals, Math.floor(s2 * goals)];
        final = { winner, runnerUp: loser, score, ...(penalties ? { penalties: true } : {}), semis: semis.filter((t) => t !== winner && t !== loser) };
      }
    }
    if (round.length % 2 === 1) next.push(round[round.length - 1]);
    round = next;
  }
  return final;
}

/** The Games of a period the engine resolves: votes, hosts lost, cancellations, boycotts, results; with their prestige, ties and costs. */
export function castSport(state: GameState, map?: Record<string, MapRegion> | null): SportCast {
  const from = state.date;
  const to = addStep(state.date, state.step);
  const years = STEP_YEARS[state.step];
  const effects: Effects = { support: new Map(), trust: [], tension: [], costs: new Map() };
  const applied: { at: string; change: AppliedChange }[] = [];
  if (!state.sport) return { sport: { games: [] }, applied: [], effects, to };
  const sport: SportState = structuredClone(state.sport);
  sport.games = extend(sport.games, from, addYears(to, HORIZON_YEARS));
  const historical = state.mode === "historical";
  const game = state.seed ?? state.id;
  const raging = greatWar(state);
  if (raging && !sport.war) sport.war = from;
  if (!raging && sport.war) {
    sport.peace = from;
    delete sport.war;
  }
  const blocked = (date: string) => Boolean(raging) || Boolean(sport.peace && yearsFrom(sport.peace, date) < AFTERMATH);

  // The bans of the period's end, and those that began or ended.
  const bans = bansAt(state, sport, to, historical);
  const barred = new Set((sport.bans ?? []).map((b) => b.tag));
  for (const b of bans) if (!barred.has(b.tag)) applied.push({ at: from, change: { kind: "sport", change: "ban", countries: [b.tag], why: b.by } });
  for (const b of sport.bans ?? []) if (!bans.some((x) => x.tag === b.tag)) applied.push({ at: from, change: { kind: "sport", change: "unban", countries: [b.tag], why: b.by } });
  if (bans.length) sport.bans = bans;
  else delete sport.bans;

  const ctx: Ctx = {
    state,
    from,
    to,
    game,
    troubles: hostTroubles(state, map),
    bans: new Set(bans.map((b) => b.tag)),
    fighting: new Set(raging ? [...raging.attackers, ...raging.defenders] : []),
    means: meansOf(state, map),
    historical,
  };

  for (const g of sport.games) {
    if (g.status !== "planned") continue;
    const closes = closesOf(g);
    if (closes <= from) continue;
    const before = from < g.opens;
    // History's withdrawals, on their day, in the historical mode.
    if (historical && before && g.hosts.length) {
      const t = HISTORY.get(g.id)?.tenures.find((x) => sameHosts(x.hosts, g.hosts));
      if (t?.withdrew && t.withdrew > from && t.withdrew <= to) {
        g.replaced = [...(g.replaced ?? []), { hosts: g.hosts, ...(g.city ? { city: g.city } : {}), why: "withdrew", date: t.withdrew }];
        applied.push({ at: t.withdrew, change: { kind: "sport", games: g.id, change: "replaced", from: g.hosts, why: "withdrew", ...(g.city ? { city: g.city } : {}) } });
        g.hosts = [];
        delete g.city;
        delete g.awarded;
      }
    }
    // A host that can no longer hold them loses them, while the committees meet at all.
    if (before && g.hosts.length && !raging) {
      const lost = g.hosts.filter((h) => ctx.troubles.get(h) !== null || ctx.bans.has(h));
      if (lost.length) {
        const why: HostLoss = ctx.bans.has(lost[0]) ? "banned" : (ctx.troubles.get(lost[0]) ?? "collapsed");
        const kept = g.hosts.filter((h) => !lost.includes(h));
        if (kept.length) g.hosts = kept;
        else {
          g.replaced = [...(g.replaced ?? []), { hosts: g.hosts, ...(g.city ? { city: g.city } : {}), why, date: from }];
          applied.push({ at: from, change: { kind: "sport", games: g.id, change: "replaced", from: g.hosts, why, ...(g.city ? { city: g.city } : {}) } });
          g.hosts = [];
          delete g.city;
          delete g.awarded;
        }
      }
    }
    // The vote, when it falls due, with time left to build, and no great war.
    if (before && !g.hosts.length && !raging && yearsFrom(to, g.opens) >= MIN_LEAD && voteDue(ctx, g)) {
      const won = vote(ctx, sport, g);
      if (won) {
        g.hosts = won.hosts;
        if (won.city) g.city = won.city;
        g.awarded = won.date;
        g.bids = won.bids;
        applied.push({ at: won.date, change: { kind: "sport", games: g.id, change: "awarded", hosts: won.hosts, bids: won.bids, ...(won.city ? { city: won.city } : {}) } });
      }
    }
    // The Games open: cancelled by a great war or for want of a host, else who stays away.
    if (g.opens > from && g.opens <= to) {
      if (blocked(g.opens) || !g.hosts.length) {
        g.status = "cancelled";
        g.cancelled = blocked(g.opens) ? "war" : "host";
        applied.push({ at: g.opens, change: { kind: "sport", games: g.id, change: "cancelled", why: g.cancelled, ...(g.hosts.length ? { hosts: g.hosts } : {}), ...(g.city ? { city: g.city } : {}) } });
        continue;
      }
      const away = boycottsOf(ctx, sport, g);
      if (away.length) {
        g.boycott = away.map((b) => b.tag);
        applied.push({ at: g.opens, change: { kind: "sport", games: g.id, change: "boycott", countries: g.boycott, hosts: g.hosts, ...(g.city ? { city: g.city } : {}) } });
        for (const b of away) {
          for (const h of g.hosts) {
            effects.trust.push({ who: h, toward: b.tag, delta: b.lead ? -12 : -6, deed: "boycott" });
            effects.tension.push({ who: h, toward: b.tag, amount: b.lead ? 10 : 5 });
            for (const friend of alliesOf(state, h)) if (friend !== b.tag) effects.trust.push({ who: friend, toward: b.tag, delta: -3 });
          }
        }
        if (away.length >= 5) for (const h of g.hosts) add(effects.support, h, -2);
      }
      if (ctx.bans.size) g.banned = [...ctx.bans].sort();
    }
    // The Games end: the medal table or the final, and what they do for the hosts and the winners.
    if (g.status === "planned" && closes > from && closes <= to && g.hosts.length && g.opens <= to) {
      const away = new Set(g.boycott ?? []);
      const tags = participants(ctx, g, away);
      for (const h of g.hosts) add(effects.support, h, 3);
      for (const c of Object.values(state.countries)) {
        if (!c.course || g.hosts.includes(c.tag)) continue;
        for (const h of g.hosts) effects.trust.push({ who: c.tag, toward: h, delta: g.kind === "summer" ? 2 : 1 });
      }
      if (g.kind === "cup") {
        const final = playCup(ctx, g, tags);
        g.status = "held";
        if (final) {
          g.final = final;
          add(effects.support, final.winner, 3);
          applied.push({ at: closes, change: { kind: "sport", games: g.id, change: "final", hosts: g.hosts, winner: final.winner, runnerUp: final.runnerUp, score: final.score, ...(final.penalties ? { penalties: true } : {}) } });
        }
        continue;
      }
      const { table, expected } = playOlympics(ctx, g, tags);
      g.status = "held";
      const player = state.player;
      const index = table.findIndex((r) => r.tag === player);
      g.medals = [...table.slice(0, TABLE_ROWS), ...(index >= TABLE_ROWS ? [table[index]] : [])];
      if (index >= 0) g.rank = index + 1;
      const leader = table[0];
      if (leader) add(effects.support, leader.tag, 2);
      const mine = index >= 0 ? table[index] : undefined;
      const hope = expected.get(player) ?? 0;
      const gold = mine?.gold ?? 0;
      if (tags.includes(player) && gold >= Math.max(1, 1.25 * hope)) add(effects.support, player, 2);
      else if (tags.includes(player) && hope >= 3 && gold <= 0.6 * hope) add(effects.support, player, -1);
      applied.push({
        at: closes,
        change: {
          kind: "sport",
          games: g.id,
          change: "held",
          hosts: g.hosts,
          ...(g.city ? { city: g.city } : {}),
          ...(leader ? { leader: leader.tag, gold: leader.gold } : {}),
          ...(mine ? { rank: index + 1, medals: mine.gold + mine.silver + mine.bronze } : {}),
        },
      });
    }
  }

  // What hosting costs over the years from the vote to the Games.
  for (const g of sport.games) {
    if (g.status === "cancelled" || !g.hosts.length || !g.awarded || g.opens <= from) continue;
    const span = Math.max(2, yearsFrom(g.awarded, g.opens));
    const start = g.awarded > from ? g.awarded : from;
    const end = g.opens < to ? g.opens : to;
    const share = Math.max(0, yearsFrom(start, end)) / span;
    if (share <= 0) continue;
    const total = HOSTING_COST[g.kind] * ctx.means.largest * share;
    const gdps = g.hosts.map((h) => economyOf(state, h)?.gdp ?? 0);
    const sum = gdps.reduce((s, v) => s + v, 0) || 1;
    g.hosts.forEach((h, i) => add(effects.costs, h, (total * gdps[i]) / sum));
  }
  // The player's money for sport beyond the usual share comes on top of the budget. Below it nothing is paid and nothing
  // saved: the usual share is part of the social line, which is not cut by it – a saving would be money from nothing.
  // The form follows the money slowly.
  const social = state.countries[state.player]?.economy?.budget.social ?? 0;
  const norm = normShare(state, state.player);
  const share = sport.share ?? norm;
  if (share > norm) add(effects.costs, state.player, ((share - norm) / 100) * social * years);
  const form = sport.form ?? 1;
  const next = form + (formTarget(share, norm) - form) * (1 - Math.exp(-years / 4));
  if (Math.abs(next - 1) > 0.005 || sport.form !== undefined) sport.form = Math.round(next * 1000) / 1000;

  // Bids for Games already given and boycotts of Games that are over lapse.
  sport.bids = sport.bids?.filter((id) => sport.games.some((g) => g.id === id && g.status === "planned" && !g.hosts.length));
  sport.boycotts = sport.boycotts?.filter((id) => sport.games.some((g) => g.id === id && g.status === "planned"));
  if (!sport.bids?.length) delete sport.bids;
  if (!sport.boycotts?.length) delete sport.boycotts;
  // Keep the last held Games of each kind and those to come.
  const lastHeld = new Set(GAMES_KINDS.map((k) => sport.games.filter((g) => g.kind === k && g.status === "held").at(-1)?.id));
  sport.games = sport.games.filter((g) => g.status === "planned" || lastHeld.has(g.id) || yearsFrom(g.opens, to) < 4);
  applied.sort((a, b) => a.at.localeCompare(b.at));
  return { sport, applied: applied.map((a) => a.change), effects, to };
}

// ---- what the orders say

/** What a turn may change in the player's sport (merged into OutcomeSchema as `sport`). */
export const sportField = z
  .object({
    bid: z.array(z.string().trim().min(1).max(40)).max(3).catch([]).default([]),
    withdraw: z.array(z.string().trim().min(1).max(40)).max(3).catch([]).default([]),
    boycott: z.array(z.string().trim().min(1).max(40)).max(3).catch([]).default([]),
    attend: z.array(z.string().trim().min(1).max(40)).max(3).catch([]).default([]),
    ban: z.array(z.string().trim().min(1).max(60)).max(2).catch([]).default([]),
    share: z.number().finite().optional().catch(undefined),
  })
  .optional()
  .catch(undefined);
export type SportWords = { bid: string[]; withdraw: string[]; boycott: string[]; attend: string[]; ban: string[]; share?: number };

/** The most a turn moves the player's money for sport, points of the social budget. */
const MAX_SHIFT = 3;

const planned = (state: Pick<GameState, "sport">, id: string) => state.sport?.games.find((g) => g.id === id && g.status === "planned");

/** Whether the player's government may bid for Games: planned, without a host, of a kind its land can hold. */
export function canPlayerBid(state: GameState, id: string): boolean {
  const g = planned(state, id);
  if (!g || g.hosts.length || yearsFrom(state.date, g.opens) < 1) return false;
  if (g.kind === "winter" && !WINTER_HOSTS.has(state.player)) return false;
  return !state.sport?.bans?.some((b) => b.tag === state.player);
}

/** Whether it may stay away from Games: planned, with a host other than itself, not yet over. */
export const canBoycott = (state: GameState, id: string): boolean => {
  const g = planned(state, id);
  return Boolean(g && g.hosts.length && !g.hosts.includes(state.player));
};

/** What the game master may change: bids, boycotts and withdrawals on Games that allow them, a ban called on a country that exists, the share within reach. */
export function sanitizeSport(state: GameState, words: z.infer<typeof sportField>): SportWords | undefined {
  if (!words || !state.sport) return undefined;
  const ids = (list: string[], ok: (id: string) => boolean) => [...new Set(list.map((x) => x.trim().toLowerCase()))].filter(ok);
  const out: SportWords = {
    bid: ids(words.bid, (id) => canPlayerBid(state, id)),
    withdraw: ids(words.withdraw, (id) => Boolean(planned(state, id)?.hosts.includes(state.player))),
    boycott: ids(words.boycott, (id) => canBoycott(state, id)),
    attend: ids(words.attend, (id) => Boolean(state.sport?.boycotts?.includes(id))),
    ban: ids(words.ban, (tag) => tag !== state.player && Boolean(economyOf(state, tag)) && !state.sport?.bans?.some((b) => b.tag === tag)),
  };
  if (words.share !== undefined) {
    const now = sportShare(state);
    const share = Math.round(clamp(words.share, Math.max(0, now - MAX_SHIFT), Math.min(MAX_SPORT_SHARE, now + MAX_SHIFT)) * 10) / 10;
    if (share !== now) out.share = share;
  }
  const any = out.bid.length || out.withdraw.length || out.boycott.length || out.attend.length || out.ban.length || out.share !== undefined;
  return any ? out : undefined;
}

/**
 * The period's sport applied to the state after the turn: the cast's
 * calendar, results and bans, the prestige, ties and costs; then what the
 * orders said, for the Games to come – bids, boycotts, a host's withdrawal,
 * a call for a ban the world votes on, the money for sport. Mutates `next`.
 */
export function applySport(state: GameState, next: GameState, cast: SportCast, words: SportWords | undefined, applied: AppliedChange[]): void {
  if (!state.sport) return;
  const { to } = cast;
  next.sport = cast.sport;
  applied.push(...cast.applied);
  const supportOf = (tag: string, points: number) => {
    if (tag === next.player) {
      if (next.politics) next.politics = { ...next.politics, unrest: clamp(Math.round(next.politics.unrest - points), 0, 100) };
      return;
    }
    const d = next.countries[tag]?.domestic;
    // Two decimals, as politics abroad keeps support (engine/abroad.ts): a small pride is not rounded away.
    if (d) next.countries[tag].domestic = { ...d, support: clamp(Math.round((d.support + points) * 100) / 100, 0, 100) };
  };
  for (const [tag, points] of cast.effects.support) supportOf(tag, points);
  for (const t of cast.effects.trust) remember(next, t.who, t.toward, t.deed ?? "boycott", t.delta, state.date, Boolean(t.deed));
  for (const t of cast.effects.tension) addTension(next, t.who, t.toward, t.amount);
  // Paid outside the budget, from the reserves, the rest borrowed (economy.ts payOffBudget): the Games hosted and the player's sport past its usual share.
  for (const [tag, cost] of cast.effects.costs) {
    const e = next.countries[tag]?.economy;
    if (!e || !(cost > 0)) continue;
    payOffBudget(e, cost, STEP_YEARS[state.step] ?? 1 / 12);
  }
  if (!words) return;
  const sport = next.sport;
  const game = state.seed ?? state.id;
  if (words.share !== undefined) sport.share = clamp(words.share, 0, MAX_SPORT_SHARE);
  for (const id of words.bid) if (!sport.bids?.includes(id)) sport.bids = [...(sport.bids ?? []), id];
  for (const id of words.boycott) if (!sport.boycotts?.includes(id)) sport.boycotts = [...(sport.boycotts ?? []), id];
  if (words.attend.length) sport.boycotts = sport.boycotts?.filter((id) => !words.attend.includes(id));
  // Giving up Games the player hosts: a new vote, and a loss of face at home and abroad.
  for (const id of words.withdraw) {
    const g = sport.games.find((x) => x.id === id && x.status === "planned" && x.hosts.includes(next.player));
    if (!g) continue;
    g.replaced = [...(g.replaced ?? []), { hosts: g.hosts, ...(g.city ? { city: g.city } : {}), why: "withdrew", date: to }];
    applied.push({ kind: "sport", games: g.id, change: "replaced", from: g.hosts, why: "withdrew", ...(g.city ? { city: g.city } : {}) });
    g.hosts = [];
    delete g.city;
    delete g.awarded;
    supportOf(next.player, -2);
    for (const c of Object.values(next.countries)) if (c.course) remember(next, c.tag, next.player, "boycott", -2, state.date, false);
  }
  sport.bids = sport.bids?.filter((id) => !words.withdraw.includes(id));
  if (!sport.bids?.length) delete sport.bids;
  if (!sport.boycotts?.length) delete sport.boycotts;
  // A call for a ban: the governments that distrust the target more than they trust the player's back it.
  for (const tag of words.ban) {
    const voters = Object.values(next.countries).filter((c) => c.course && c.tag !== tag && c.tag !== next.player);
    const yes = voters.filter((c) => tieOf(next, c.tag, tag).trust < Math.min(0, tieOf(next, c.tag, next.player).trust)).length;
    const chance = voters.length ? clamp(yes / voters.length + 0.1, 0.05, 0.9) : 0.2;
    const passed = roll(game, state.turn, `sport:ban:${tag}`) < chance;
    remember(next, tag, next.player, "sport-ban", passed ? -15 : -8, state.date);
    if (passed) {
      sport.bans = [...(sport.bans ?? []), { tag, since: to, by: "vote", until: addYears(to, 8) }];
      applied.push({ kind: "sport", change: "ban", countries: [tag], why: "vote" });
    } else applied.push({ kind: "sport", change: "refused", countries: [tag], why: "vote" });
  }
}

// ---- the player sets, the panel reads

/** The player sets the money for sport, % of the social budget. */
export function setSportShare<T extends Pick<GameState, "sport">>(state: T, share: number): T {
  if (!state.sport) return state;
  return { ...state, sport: { ...state.sport, share: clamp(Math.round(share * 10) / 10, 0, MAX_SPORT_SHARE) } };
}

/** The player's bid for Games, put forward or withdrawn. */
export function toggleBid<T extends Pick<GameState, "sport">>(state: T, id: string): T {
  if (!state.sport) return state;
  const bids = state.sport.bids?.includes(id) ? state.sport.bids.filter((x) => x !== id) : [...(state.sport.bids ?? []), id];
  const sport: SportState = { ...state.sport, bids };
  if (!bids.length) delete sport.bids;
  return { ...state, sport };
}

/** The player's boycott of Games, declared or dropped. */
export function toggleBoycott<T extends Pick<GameState, "sport">>(state: T, id: string): T {
  if (!state.sport) return state;
  const boycotts = state.sport.boycotts?.includes(id) ? state.sport.boycotts.filter((x) => x !== id) : [...(state.sport.boycotts ?? []), id];
  const sport: SportState = { ...state.sport, boycotts };
  if (!boycotts.length) delete sport.boycotts;
  return { ...state, sport };
}

/** When a Games' host is chosen: history's day in the historical mode, else seven years before them. */
export function voteDate(state: Pick<GameState, "mode" | "date">, g: Games): string {
  const t = state.mode === "historical" ? HISTORY.get(g.id)?.tenures.find((x) => !(g.replaced ?? []).some((r) => sameHosts(r.hosts, x.hosts))) : undefined;
  const at = t?.awarded ?? addYears(g.opens, -VOTE_YEARS);
  return at < state.date ? state.date : at;
}

// ---- the game master's view

const KIND_EN: Record<GamesKind, string> = { summer: "Summer Olympics", winter: "Winter Olympics", cup: "World Cup" };
const gamesName = (g: Pick<Games, "kind" | "year">) => `${KIND_EN[g.kind]} ${g.year}`;
const where = (g: Pick<Games, "hosts" | "city">) => `${g.city ? `${g.city.en}, ` : ""}${g.hosts.join("+") || "host not chosen"}`;

/** The period's sport as the engine decided it, one line each, for the story and the world's news. */
export function sportNews(state: GameState, cast: SportCast): string[] {
  const name = (id?: string) => {
    const g = cast.sport.games.find((x) => x.id === id) ?? state.sport?.games.find((x) => x.id === id);
    return g ? gamesName(g) : "the Games";
  };
  return cast.applied.flatMap((c): string[] => {
    if (c.kind !== "sport") return [];
    switch (c.change) {
      case "awarded":
        return [`${name(c.games)} awarded to ${c.city ? `${c.city.en} (${c.hosts?.join("+")})` : c.hosts?.join("+")}${c.bids && c.bids.length > 1 ? `; bids: ${c.bids.join(", ")}` : ""}`];
      case "replaced":
        return [`${c.from?.join("+")} lost ${name(c.games)} (${c.why}); a new vote follows`];
      case "cancelled":
        return [`${name(c.games)} cancelled (${c.why === "war" ? "the war" : "no host"})`];
      case "boycott":
        return [`${name(c.games)}: boycotted by ${c.countries?.join(", ")}`];
      case "ban":
        return [`${c.countries?.join(", ")} barred from the Olympic Games and the World Cup (${c.why})`];
      case "unban":
        return [`${c.countries?.join(", ")} readmitted to the Olympic Games and the World Cup`];
      case "held": {
        const g = cast.sport.games.find((x) => x.id === c.games);
        const top = (g?.medals ?? []).slice(0, 5).map((r) => `${r.tag} ${r.gold}-${r.silver}-${r.bronze}`).join(", ");
        return [`${name(c.games)} in ${c.city?.en ?? c.hosts?.join("+")}: medal table (gold-silver-bronze) ${top}${c.rank ? `; the player's country ${c.rank}th with ${c.medals} medals` : "; the player's country won no medal"}`];
      }
      case "final":
        return [`${name(c.games)} final: ${c.winner} beat ${c.runnerUp} ${c.score?.join("–")}${c.penalties ? " on penalties" : ""}`];
      default:
        return [];
    }
  });
}

/**
 * Sport for the game master: the Games to come and their hosts, the votes
 * ahead and the player's bids and boycotts, the bans, the player's money and
 * strength, what the engine decided for this period, and the rule that
 * comes with it.
 */
export function describeSport(state: GameState, map?: Record<string, MapRegion> | null): string[] {
  const sport = state.sport;
  if (!sport) return [];
  const cast = castSport(state, map);
  const lines = ["", "SPORT (kept by the engine; ids in brackets for the \"sport\" field):"];
  const coming = sport.games.filter((g) => g.status === "planned").slice(0, 6);
  if (coming.length) {
    lines.push(
      `- coming: ${coming
        .map((g) => `${gamesName(g)} [${g.id}] ${g.hosts.length ? `in ${where(g)}` : `host chosen about ${voteDate(state, g).slice(0, 4)}`}, opens ${g.opens}${sport.bids?.includes(g.id) ? ", THE PLAYER BIDS" : ""}${sport.boycotts?.includes(g.id) ? ", THE PLAYER BOYCOTTS" : ""}${g.hosts.includes(state.player) ? ", HOSTED BY THE PLAYER" : ""}`)
        .join("; ")}`,
    );
  }
  if (sport.bans?.length) lines.push(`- barred from the Games: ${sport.bans.map((b) => `${b.tag} (${b.by}, since ${b.since.slice(0, 4)})`).join(", ")}`);
  const last = GAMES_KINDS.map((k) => sport.games.filter((g) => g.kind === k && g.status === "held").at(-1)).filter((g): g is Games => Boolean(g));
  if (last.length) {
    lines.push(
      `- last held: ${last
        .map((g) => `${gamesName(g)} in ${where(g)}: ${g.final ? `won by ${g.final.winner}` : g.medals?.length ? `led by ${g.medals[0].tag}${g.rank ? `, the player's country ${g.rank}th` : ""}` : g.champion ? `${g.kind === "cup" ? "won" : "led"} by ${g.champion}` : "–"}`)
        .join("; ")}`,
    );
  }
  const strength = sportStrength(state, map);
  const rank = [...strength.values()].filter((v) => v > (strength.get(state.player) ?? 0)).length + 1;
  lines.push(`- the player's sport: ${sportShare(state)}% of the social budget ($${sportMoney(state)}bn a year), form ${(sport.form ?? 1).toFixed(2)}, ${rank}th strongest sporting nation${sportSystem(state, state.player) > 1 ? ", a state sport system" : ""}`);
  const news = sportNews(state, cast);
  if (news.length) lines.push(`- THIS PERIOD, decided by the engine: ${news.join("; ")}`);
  lines.push(
    "- Tell the period's Games, votes, boycotts and finals exactly as the engine decided them, never another host, result or boycott. National champions and record holders of the player's country (all-Union champions in the Soviet Union) are flavour you may add to the story and the society's news; they change nothing.",
  );
  return lines;
}

import { addStep } from "./calendar";
import { colonialOf, homeEnemies } from "./colonialLand";
import { countryCrises } from "./crises";
import { fixed, happens } from "./dice";
import { STEP_YEARS } from "./economy";
import { peopleIn } from "./population";
import { programmeShift } from "./programmes";
import { peopleByCountry, strainOf } from "./mobilisation";
import { provisionBooks, provisionOf } from "./provision";
import { REGIMES } from "./scenarios/regimes";
import { en } from "./text";
import { distanceKm } from "./trade";
import type { AppliedChange, Because, BecauseKind, CountryState, Domestic, Economy, GameState, MapRegion, RegimeKind, Scenario, ScenarioId } from "./types";

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

export const yearsBetween = (from: string, to: string) => (Date.parse(to) - Date.parse(from)) / (365.25 * 86400000);

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

/** How a country was governed on the start date, by the scenario's table: an autocracy when it lists it nowhere. */
export const regimeAtStart = (era: ScenarioId, tag: string): RegimeKind => kindsOn(era).get(tag) ?? "autocracy";

/**
 * How a country that appears in play is governed, read from the words the
 * game master gave it, in any of the game's languages (it writes them in the
 * player's). Used when its answer names no kind of government.
 */
export function regimeFromText(government: string | undefined): RegimeKind {
  const g = (government ?? "").toLowerCase();
  if (/junta|military|martial law|army|хунт|военн|військов|воєнн/.test(g)) return "military";
  if (/one-party|communis|people's|socialist|однопарти|однопартій|коммунист|комуніст|социалист|соціаліст|народн/.test(g)) return "party";
  if (
    /dictator|totalitarian|absolute|fascis|theocra|emirate|caliphate|sultanate|insurgen|resistance|protectorate|occupation|puppet|satellite|диктат|тоталит|тоталіт|абсолют|фашист|теократ|эмират|емірат|халифат|халіфат|султан|повстан|сопротивл|опір|протекторат|оккупац|окупац|марионет|маріонет|сателлит|сателіт/.test(
      g,
    )
  )
    return "autocracy";
  if (/islamic|provisional|transitional|revolutionary|authoritarian|guided|dominant|council|исламск|ісламськ|временн|тимчасов|переходн|перехідн|революц|авторитар/.test(g)) return "limited";
  if (/parliament|democra|federal|presidential|constitutional|republic|commonwealth|dominion|парламент|демократ|федерат|федерал|президент|конституц|республик|республік|содружеств|співдружн|доминион|домініон/.test(g)) return "democracy";
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

/** A country that appears in play: its kind of government as the game master gave it (or read from its description), an election within its term. */
export function newDomestic(country: Pick<CountryState, "tag" | "government">, era: ScenarioId, date: string, kind?: RegimeKind): Domestic {
  const regime = kind ?? regimeFromText(en(country.government));
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

/**
 * Coups a year, %, by kind of government, before the state of the country. A junta is no longer a magnet by its kind
 * alone (it was 6, and four coups in ten hit a country already couped): it is as coup-prone as a managed regime, and
 * the army's habit of moving is the "coups breed coups" term below, for any government, for some years after a coup.
 * The coups the trap made are moved to first coups (the rest was 0.4, 3, 0.2 and 1.5): the Cold War dates keep their
 * totals, which were already below Powell and Thyne's.
 */
const COUP_BASE: Record<RegimeKind, number> = { democracy: 0.55, limited: 4.2, party: 0.3, autocracy: 2.2, military: 4.2 };

/** How often armies moved against governments on each date, against the 1990s. */
const COUP_ERA: Record<ScenarioId, number> = { "1914": 0.8, "1933": 1.1, "1939": 1, "1950": 1.3, "1957": 1.4, "1964": 1.6, "1973": 1.6, "1979": 1.4, "1991": 1, "1999": 0.8, "2014": 0.8, "2022": 0.9 };

/** Coups breed coups: the risk this many times higher for so many years after one succeeded, whatever the government since (Powell and Thyne). */
const BREED = 1.5;
const BREED_YEARS = 10;
/** A successful coup's shock to the state: stability lost (it was 10, and the junta never recovered). */
const COUP_SHOCK = 3;
/** A junta promises a vote: within these years, seeded. */
const JUNTA_VOTE: [number, number] = [2, 6];
/** The plotters are the government now: years before the next attempt on it, seeded; after a failed attempt, a year. */
const AFTER_COUP: [number, number] = [2, 3];

/** The day of the last coup that succeeded against a government, if any: for a save from before it was kept, a government that came by a coup. */
export const coupedOn = (d: Pick<Domestic, "couped" | "changed">): string | undefined => d.couped ?? (d.changed?.how === "coup" ? d.changed.date : undefined);

/** What the risk of a coup reads from the rest of the state. */
export interface CoupContext {
  era: ScenarioId;
  economy?: Economy;
  atWar: boolean;
  /** Share of the country's own people in provinces held by others, 0–1 (lostShares). */
  lost: number;
  /** Income per person against the median state's (incomes); missing when unknown. */
  income?: number;
  /** The day the risk is read on, for the years since the last coup. */
  date?: string;
}

/**
 * The chance of a coup against a government, % a year: likelier where the
 * army already rules or elections are managed, for some years after a coup,
 * much likelier as the state comes apart, in a slump, in runaway inflation,
 * and when land is lost.
 */
export function coupRisk(d: Pick<Domestic, "regime" | "stability" | "support"> & Partial<Pick<Domestic, "couped" | "changed">>, ctx: CoupContext): number {
  let risk = COUP_BASE[d.regime] * COUP_ERA[ctx.era];
  const couped = coupedOn(d);
  if (couped && ctx.date && yearsBetween(couped, ctx.date) < BREED_YEARS) risk *= BREED;
  // A settled democracy is all but safe; a shaky one is not.
  risk *= d.regime === "democracy" ? Math.max(0.05, (75 - d.stability) / 15) : 1 + Math.max(0, 60 - d.stability) / 14;
  // Coups follow trouble: a steady state whose government is not unpopular and whose economy grows seldom sees the army
  // move (the statistics runs had Malaysia, Tanzania and Angola fall at stability 57 and support 50, 22 coups in a decade).
  if (d.regime !== "democracy" && d.stability >= 55 && d.support >= 45 && (!ctx.economy || ctx.economy.growth > 0)) risk *= 0.4;
  if (d.support < 30) risk *= 1.3;
  if (ctx.economy && ctx.economy.growth <= -3) risk *= 1.5;
  if (ctx.economy && ctx.economy.inflation >= 50) risk *= 1.5;
  if (ctx.lost >= 0.1) risk *= 1.5;
  if (ctx.atWar && ctx.lost >= 0.25) risk *= 1.3;
  // A state with next to no soldiers has next to no one to stage a coup.
  if (ctx.economy && ctx.economy.troops < 2) risk *= 0.1;
  // Armies seldom move in rich states: a coup is a poor country's misfortune.
  if (ctx.income !== undefined) risk *= ctx.income >= 3 ? 0.1 : ctx.income >= 1.8 ? 0.4 : 1;
  return round(Math.min(35, risk));
}

/** The chance a coup that is tried only half succeeds and splits the army and the country: likelier the shakier the state (Spain 1936). */
const coupSplit = (d: Domestic) => clamp(0.04 + 0.12 * (1 - d.stability / 50), 0.04, 0.16);

/** The chance a coup that is tried succeeds. */
const coupSuccess = (d: Domestic) => clamp((d.regime === "democracy" ? 0.35 : 0.55) * (d.stability < 30 ? 1.2 : 1), 0, 0.9);

/**
 * The chance the government keeps power at an election: by its support where the vote is free, almost always where it
 * is not. A free vote is a coin with a slope: a government in an ordinary year (support about 50) keeps power about
 * half the time, one after a slump loses two times in three or more, one in a boom or a rally keeps it two in three
 * (the statistics runs: incumbents in democracies lose 35–50% of national elections, as they do in reality).
 */
export function keepChance(d: Pick<Domestic, "regime" | "support">): number {
  if (d.regime === "democracy") return 1 / (1 + Math.exp(-(d.support - 50) / 7));
  return d.support >= 25 ? 0.95 : 0.75;
}

/** A strong enemy that holds land this near a country's heartland stands at its door, km. */
const DOOR_KM = 700;
/** The heartland: the provinces where a country makes most (its people times their income). */
const HEARTLAND = 10;
/** War on a country's own soil once an enemy holds or fights in land where this share of its people live. */
const SOIL_SHARE = 0.01;

/**
 * Why a national election that falls due now is put off, or nothing: a war fought on the country's own soil (an enemy
 * holds or contests land where a hundredth of its people live: Ukraine in 2024), or – with `door` – a war against a
 * strong enemy (a quarter of its economy or half its soldiers) that holds land within ~700 km of its heartland, the ten
 * provinces that make most (Britain and France against Germany in 1939–40, Finland in 1943). The parliament extends its
 * own term, as Britain's did each year from 1940 to 1945; the government stays.
 */
export function electionPause(state: Pick<GameState, "regions" | "wars" | "date" | "countries"> & Partial<Pick<GameState, "colonies">>, tag: string, map?: Record<string, MapRegion> | null, door = true): Because | undefined {
  // A colonial war is fought on the colony's land, not the metropole's own: it puts no vote off (France voted in 1958 in the Algerian War).
  const colonial = colonialOf(state, map);
  const enemies = homeEnemies(state, tag, colonial);
  if (!enemies.size) return undefined;
  let own = 0;
  let front = 0;
  const onSoil = new Map<string, number>();
  const heart: [number, number, number][] = [];
  for (const [id, r] of Object.entries(state.regions)) {
    if (r.owner !== tag || colonial.land.has(id)) continue;
    const n = map ? peopleIn(r, map[id]) : 1;
    own += n;
    const enemy = enemies.has(r.controller) ? r.controller : r.contested && enemies.has(r.contested) ? r.contested : undefined;
    if (enemy) {
      front += n;
      onSoil.set(enemy, (onSoil.get(enemy) ?? 0) + n);
    }
    // The heartland by output, not people: Britain's is England, not the Raj.
    const at = map?.[id]?.at;
    if (at && r.controller === tag) heart.push([n * (map?.[id]?.inc ?? 1000), at[0], at[1]]);
  }
  const most = (m: Map<string, number>) => [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
  if (own > 0 && front / own >= SOIL_SHARE) return { kind: "war-home", country: most(onSoil) };
  if (!door || !map) return undefined;
  const me = state.countries[tag]?.economy;
  const strong = (t: string) => {
    const e = state.countries[t]?.economy;
    if (!e || !me) return false;
    return e.gdp >= 0.25 * me.gdp || e.troops >= 0.5 * me.troops;
  };
  const threats = [...enemies].filter(strong);
  if (!threats.length) return undefined;
  const core = heart.sort((a, b) => b[0] - a[0]).slice(0, HEARTLAND);
  const near = new Map<string, number>();
  for (const [id, r] of Object.entries(state.regions)) {
    if (!threats.includes(r.controller) || r.owner === tag) continue;
    const at = map[id]?.at;
    if (!at) continue;
    if (core.some(([, x, y]) => distanceKm([x, y], at) <= DOOR_KM)) near.set(r.controller, (near.get(r.controller) ?? 0) + 1);
  }
  return near.size ? { kind: "war-near", country: most(near) } : undefined;
}

/**
 * Share of each country's own people living in its provinces held by others,
 * 0–1: losing the capital weighs more than losing a desert. A country whose
 * provinces have no people on record counts its provinces instead. The map
 * gives a province's people until the game has moved them; the server and
 * the browser pass the same map, so the dice they cast agree.
 */
export function lostShares(state: Pick<GameState, "regions">, map?: Record<string, MapRegion> | null): Map<string, number> {
  const own = new Map<string, { people: number; lostPeople: number; provinces: number; lostProvinces: number }>();
  for (const [id, r] of Object.entries(state.regions)) {
    const tally = own.get(r.owner) ?? { people: 0, lostPeople: 0, provinces: 0, lostProvinces: 0 };
    const people = peopleIn(r, map?.[id]);
    tally.people += people;
    tally.provinces += 1;
    if (r.controller !== r.owner) {
      tally.lostPeople += people;
      tally.lostProvinces += 1;
    }
    own.set(r.owner, tally);
  }
  const out = new Map<string, number>();
  for (const [tag, n] of own) out.set(tag, n.people > 0 ? n.lostPeople / n.people : n.lostProvinces / n.provinces);
  return out;
}

/** The wars a country fights now, outside any truce. */
export const warsOf = (state: Pick<GameState, "wars" | "date">, tag: string) =>
  state.wars.filter((w) => (w.attackers.includes(tag) || w.defenders.includes(tag)) && !(w.truce && w.truce.until > state.date));

/**
 * Each country's income per person against the median state's: its GDP over
 * the people of its provinces (the map's figures until the game moves them).
 */
export function incomes(state: Pick<GameState, "countries" | "regions">, map?: Record<string, MapRegion> | null): Map<string, number> {
  const people = new Map<string, number>();
  for (const [id, r] of Object.entries(state.regions)) people.set(r.owner, (people.get(r.owner) ?? 0) + peopleIn(r, map?.[id]));
  const perHead = new Map<string, number>();
  for (const [tag, n] of people) {
    const gdp = state.countries[tag]?.economy?.gdp;
    if (n > 0 && gdp) perHead.set(tag, gdp / n);
  }
  const sorted = [...perHead.values()].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] || 1;
  return new Map([...perHead].map(([tag, v]) => [tag, v / median] as const));
}

/** The coup risk of one country in a state, % a year; none where no coup can happen (no land, a movement without territory, a government abroad). */
export function coupRiskIn(state: Pick<GameState, "countries" | "regions" | "wars" | "date" | "scenarioId">, tag: string, lost = lostShares(state), income?: Map<string, number>): number {
  const c = state.countries[tag];
  // lostShares has every country that owns a province, and only those.
  if (!c?.domestic || c.dormant || c.exile || !lost.has(tag)) return 0;
  return coupRisk(c.domestic, { era: state.scenarioId, economy: c.economy, atWar: warsOf(state, tag).length > 0, lost: lost.get(tag) ?? 0, income: income?.get(tag), date: state.date });
}

/**
 * The government a coup sets up: a junta that promises a vote in two to six years (seeded), which hands power to the
 * civilians it picked (applyAbroad); the state shaken, not broken; and the army's habit of moving kept (`couped`).
 */
export function newJunta(d: Domestic, game: string, tag: string, to: string, how: "coup" | "revolution" | "rising" = "coup"): Domestic {
  return {
    regime: "military",
    support: 45,
    stability: clamp(d.stability - COUP_SHOCK, 10, 100),
    term: TERM.limited,
    nextElection: addYears(to, JUNTA_VOTE[0] + (JUNTA_VOTE[1] - JUNTA_VOTE[0]) * fixed(`junta-vote:${game}:${tag}:${to}`)),
    changed: { date: to, how },
    lastCoup: to,
    couped: to,
    ...(d.lastElection ? { lastElection: d.lastElection } : {}),
  };
}

/** The day before which no coup is tried against a government: a year after a failed attempt, two to three after a coup that succeeded (seeded). */
export function coupCalm(d: Pick<Domestic, "lastCoup" | "couped" | "changed">, game: string, tag: string): string | undefined {
  if (!d.lastCoup) return undefined;
  if (coupedOn(d) !== d.lastCoup) return addStep(d.lastCoup, "year");
  return addYears(d.lastCoup, AFTER_COUP[0] + (AFTER_COUP[1] - AFTER_COUP[0]) * fixed(`coup-calm:${game}:${tag}:${d.lastCoup}`));
}

/**
 * Why the player's national election, falling due now, is put off: elections suspended by law, martial law, or war
 * on the country's own soil (an enemy at the door alone does not: the player's parliament decides that, through the
 * game master).
 */
export function playerElectionPause(state: Pick<GameState, "regions" | "wars" | "date" | "countries" | "player" | "politics"> & Partial<Pick<GameState, "colonies">>, map?: Record<string, MapRegion> | null): Because | undefined {
  if (state.politics?.laws?.elections === "suspended") return { kind: "suspended" };
  if (state.politics?.laws?.martial === "martial") return { kind: "martial-law" };
  return electionPause(state, state.player, map, false);
}

/**
 * The player's election in the coming period, for the game master: put off (why, and what the engine does), or due –
 * to be held, or the engine holds it.
 */
export function playerPauseNote(state: Pick<GameState, "regions" | "wars" | "date" | "countries" | "player" | "politics" | "step"> & Partial<Pick<GameState, "colonies">>, map?: Record<string, MapRegion> | null): string | undefined {
  const due = state.politics?.nextElection;
  if (!due || due > addStep(state.date, state.step)) return undefined;
  const why = playerElectionPause(state, map);
  if (!why) return "DUE THIS PERIOD – hold it and give the results in politics.election; an election left out is held by the engine, by the parties' support";
  const reason = why.kind === "suspended" ? "elections are suspended by law" : why.kind === "martial-law" ? "martial law is in force" : `war is fought on the country's own soil${why.country ? ` (${why.country})` : ""}`;
  const unless = why.kind === "suspended" ? "the orders lift the suspension" : why.kind === "martial-law" ? "the orders lift martial law" : "the orders hold it all the same";
  return `PUT OFF – ${reason}: hold no vote this period (the engine moves it a year on) unless ${unless} and call it anyway`;
}

/**
 * The player's election that fell due this period and was not held, put off a year while elections are suspended by
 * law, under martial law or with war on the country's soil, with a line in the news. The game master holding it
 * anyway (an order lifted martial law and called the vote) wins: nothing is put off then. Whether it was put off.
 */
export function postponePlayerElection(before: GameState, next: GameState, ctx: { to: string; map?: Record<string, MapRegion> | null; held: boolean }, applied: AppliedChange[]): boolean {
  const due = before.politics?.nextElection;
  if (!next.politics || !due || due > ctx.to || ctx.held) return false;
  // The game master already set a new date.
  if (next.politics.nextElection && next.politics.nextElection > ctx.to) return false;
  // The laws as the turn left them: a suspension or martial law the turn lifted lets the vote be held.
  const why = playerElectionPause({ ...before, politics: next.politics }, ctx.map);
  if (!why) return false;
  let at = addYears(due, 1);
  while (at <= ctx.to) at = addYears(at, 1);
  next.politics = { ...next.politics, nextElection: at };
  applied.push({ kind: "vote", country: before.player, kept: true, date: due, postponed: true, because: why });
  return true;
}

/** An election falls due (`postponed`: put off in wartime, and why), or a coup is tried. */
/** A coup that only half succeeds (`split`) splits the country into a civil war (engine/civilWar.ts). */
export type AbroadEvent = { kind: "election"; country: string; date: string; kept: boolean; postponed?: Because } | { kind: "coup"; country: string; succeeded: boolean; split?: boolean };

/** An election put off in wartime comes this soon after the peace, years (Britain voted two months after the war in Europe). */
const AFTER_PEACE = 0.25;

/**
 * The dice for the coming turn, cast from the state before it: elections
 * that fall in the period, and coups by their risk. The same state and map
 * cast the same dice, on the server that writes the prompt and in the
 * browser that applies the answer.
 */
export function castAbroad(state: GameState, map?: Record<string, MapRegion> | null): AbroadEvent[] {
  // A copy of a game keeps the game's dice (lib/saves.ts duplicateSave).
  const game = state.seed ?? state.id;
  const to = addStep(state.date, state.step);
  const years = STEP_YEARS[state.step];
  const lost = lostShares(state, map);
  const income = incomes(state, map);
  const owners = new Set(Object.values(state.regions).map((r) => r.owner));
  const out: AbroadEvent[] = [];
  for (const [tag, c] of Object.entries(state.countries)) {
    const d = c.domestic;
    // A country conquered outright holds no vote and has no army to rise; one that never had land (a Soviet republic in 1991) still votes.
    if (!d || tag === state.player || c.exile || (!c.dormant && !owners.has(tag))) continue;
    // A calendar year passes between one attempt on a government and the next, whatever the length of a turn; two or three after a coup that succeeded.
    const calm = coupCalm(d, game, tag);
    if (!c.dormant && !(calm && to < calm)) {
      const risk = coupRiskIn(state, tag, lost, income) / 100;
      if (happens(1 - (1 - risk) ** years, game, state.turn, `coup:${tag}`)) {
        // Some coups take the capital or a part of the army and not the rest: the country splits (engine/civilWar.ts).
        if (happens(coupSplit(d), game, state.turn, `coup-split:${tag}`)) {
          out.push({ kind: "coup", country: tag, succeeded: false, split: true });
          continue;
        }
        const succeeded = happens(coupSuccess(d), game, state.turn, `coup-success:${tag}`);
        out.push({ kind: "coup", country: tag, succeeded });
        if (succeeded) continue;
      }
    }
    if (d.nextElection && d.nextElection <= to) {
      // An election that fell while the country could not hold it (all its land lost) is held now.
      const date = d.nextElection < state.date ? state.date : d.nextElection;
      // Where votes count, a war on the country's soil or a strong enemy at its door puts the vote off.
      const pause = d.regime === "democracy" || d.regime === "limited" ? electionPause(state, tag, map) : undefined;
      out.push(pause ? { kind: "election", country: tag, date, kept: true, postponed: pause } : { kind: "election", country: tag, date, kept: happens(keepChance(d), game, state.turn, `election:${tag}`) });
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
function supportTarget(c: CountryState, ctx: { lost: number; warYears: number | null; tenure: number; provision?: number; strain?: number }): number {
  const e = c.economy;
  let t = 50;
  if (e) {
    t += 2.5 * clamp(e.growth, -8, 8);
    t -= 0.4 * clamp(e.inflation - 4, 0, 60);
    t -= 1.2 * clamp(e.unemployment - 6, 0, 25);
    t -= 10 * e.tradeCut;
  }
  // People short of food, fuel or medicine blame the government (engine/provision.ts).
  if (ctx.provision !== undefined) t -= 0.3 * clamp(90 - ctx.provision, 0, 60);
  t -= 50 * ctx.lost;
  if (ctx.warYears !== null) t += clamp(6 - 5 * ctx.warYears, -15, 6);
  // The families of the men kept under arms (engine/mobilisation.ts): openly where people vote, under the surface under a police state. The
  // depth and the months of the call-up only: the war's dead are war-weariness's (engine/warMeans.ts), counted once.
  const regime = c.domestic?.regime;
  t -= (regime === "democracy" || regime === "limited" ? 0.15 : 0.06) * (ctx.strain ?? 0);
  // The cost of ruling: a point and a half a year in office, at most eight (it was two and a half and twelve, and
  // incumbents lost three elections in four).
  t -= Math.min(8, 1.5 * ctx.tenure);
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

/**
 * Why a government fell to a coup or lost an election, for the news and the
 * game master: the worst of a slump, soaring prices, ground lost in a war, a
 * war dragging on, long years in power, an unpopular government or (for a
 * coup) a shaky state. Nothing when nothing stands out.
 */
export function fallBecause(state: GameState, tag: string, d: Domestic, ctx: { lost: number; to: string; start: string; vote: boolean }): Because | undefined {
  const e = state.countries[tag]?.economy;
  const wars = warsOf(state, tag);
  const warYears = wars.length ? Math.max(0, yearsBetween(wars.map((w) => w.since).sort()[0], ctx.to)) : 0;
  const tenure = d.changed ? yearsBetween(d.changed.date, ctx.to) : yearsBetween(ctx.start, ctx.to) + fixed(`tenure:${state.scenarioId}:${tag}`) * 4;
  const parts: [BecauseKind, number][] = [
    ["slump", e ? Math.max(-e.growth / 3, (e.unemployment - 9) / 8) : 0],
    ["inflation", e ? (e.inflation - (ctx.vote ? 10 : 20)) / 25 : 0],
    ["defeat", ctx.lost / 0.1],
    ["war", warYears / 2],
    ["tenure", ctx.vote ? (tenure - 6) / 6 : 0],
    ["weak", (40 - d.support) / 20],
    ["unrest", ctx.vote ? 0 : (45 - d.stability) / 20],
  ];
  const [kind, score] = parts.reduce((best, x) => (x[1] > best[1] ? x : best), parts[0]);
  return score >= 0.5 ? { kind } : undefined;
}

interface AbroadContext {
  to: string;
  years: number;
  /** Countries whose leader the game master changed this turn. */
  named: Set<string>;
  /** Of those, the ones whose leader was in office: a new government, not a name filled in after a fall. */
  replaced: Set<string>;
  /** The map's provinces, for the people in land lost. */
  map?: Record<string, MapRegion> | null;
  /** The kind of government the game master gave the countries it created this turn. */
  regimes?: Map<string, RegimeKind>;
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
  const lost = lostShares(next, ctx.map);
  const books = ctx.map ? provisionBooks(next, ctx.map) : null;
  const people = ctx.map ? peopleByCountry(next, ctx.map) : null;
  const start = next.chronicle[0]?.from ?? next.date;
  // Countries born this turn get politics from their description; any other without them waits for the date's table on load.
  const born = new Set(applied.flatMap((a) => (a.kind === "new-country" ? [a.country] : [])));
  for (const [tag, c] of Object.entries(next.countries)) {
    if (tag === next.player) continue;
    if (!c.domestic) {
      if (born.has(tag)) c.domestic = newDomestic(c, next.scenarioId, ctx.to, ctx.regimes?.get(tag));
      continue;
    }
    const d = { ...c.domestic };
    const wars = warsOf(next, tag);
    const warYears = wars.length ? Math.max(0, yearsBetween(wars.map((w) => w.since).sort()[0], ctx.to)) : null;
    const share = lost.get(tag) ?? 0;
    // A government of the start date has been in office some years already.
    const tenure = d.changed ? yearsBetween(d.changed.date, ctx.to) : yearsBetween(start, ctx.to) + fixed(`tenure:${next.scenarioId}:${tag}`) * 4;
    const provision = ctx.map && books ? provisionOf(next, tag, ctx.map, books)?.overall : undefined;
    // The policies at work move where support and stability head (engine/programmes.ts).
    const shift = programmeShift(c, ctx.to);
    // The strain of the men kept under arms, without the war's dead: those wear support down once, as war-weariness (engine/warMeans.ts).
    const strain = people ? (strainOf(next, tag, people.get(tag) ?? 0, { losses: false })?.strain ?? 0) : 0;
    d.support = fine(d.support + (clamp(supportTarget(c, { lost: share, warYears, tenure, provision, strain }) + shift.support, 5, 90) - d.support) * pace);
    d.stability = fine(d.stability + (clamp(stabilityTarget(next, tag, d, share) + shift.stability, 5, 95) - d.stability) * slow);
    // A leader the game master put in office outside an election or a coup: a new government, given a little goodwill.
    if (ctx.replaced.has(tag) && !events.some((e) => e.country === tag)) {
      d.support = fine((d.support + 55) / 2);
      d.changed = { date: ctx.to, how: "leader" };
    }
    // An election put off in wartime is held soon after the peace.
    if (d.deferred && !wars.length) {
      const soon = addYears(ctx.to, AFTER_PEACE);
      if (!d.nextElection || d.nextElection > soon) d.nextElection = soon;
      delete d.deferred;
    }
    c.domestic = d;
  }

  for (const e of events) {
    // A coup that split the country is a civil war's beginning (engine/civilWar.ts).
    if (e.kind === "coup" && e.split) continue;
    const c = next.countries[e.country];
    const d = c?.domestic;
    if (!c || !d) continue;
    // What brought the government down, or near it, for the news: the slump, prices, the war, years in power.
    const because = e.kind === "coup" || !e.kept ? fallBecause(next, e.country, d, { lost: lost.get(e.country) ?? 0, to: ctx.to, start, vote: e.kind === "election" }) : undefined;
    if (e.kind === "coup") {
      applied.push({ kind: "coup", country: e.country, succeeded: e.succeeded, ...(because ? { because } : {}) });
      if (e.succeeded) {
        c.domestic = newJunta(d, next.seed ?? next.id, e.country, ctx.to);
        if (!ctx.named.has(e.country)) delete c.leader;
      } else {
        c.domestic = { ...d, stability: Math.max(5, d.stability - 6), support: Math.min(90, d.support + 4), lastCoup: ctx.to };
      }
      continue;
    }
    if (e.postponed) {
      // Put off for a year at a time, as Britain's parliament extended its term each year; held soon after the peace.
      let nextElection = addYears(e.date, 1);
      while (nextElection <= ctx.to) nextElection = addYears(nextElection, 1);
      applied.push({ kind: "vote", country: e.country, kept: true, date: e.date, postponed: true, because: e.postponed });
      c.domestic = { ...d, nextElection, deferred: d.deferred ?? e.date };
      continue;
    }
    applied.push({ kind: "vote", country: e.country, kept: e.kept, date: e.date, ...(because ? { because } : {}) });
    const term = d.term ?? TERM[d.regime];
    let nextElection = addYears(e.date, term);
    while (nextElection <= ctx.to) nextElection = addYears(nextElection, term);
    // A junta's vote hands power to the civilians it picked.
    const regime = d.regime === "military" ? "limited" : d.regime;
    const rest = { ...d };
    delete rest.deferred;
    c.domestic = e.kept
      ? { ...rest, regime, term, nextElection, lastElection: { date: e.date, kept: true }, support: Math.min(90, d.support + 4) }
      : { ...rest, regime, term, nextElection, lastElection: { date: e.date, kept: false }, support: 58, stability: Math.min(95, d.stability + 3), changed: { date: e.date, how: "election" } };
    if (!e.kept && !ctx.named.has(e.country)) delete c.leader;
  }
}

/** A fall's reason in a word or two, for the game master. */
const FALL_EN: Partial<Record<BecauseKind, string>> = { slump: "after a slump", inflation: "soaring prices", defeat: "defeats in war", war: "a long war", tenure: "years in power", weak: "unpopular", unrest: "unrest" };

/** The countries a turn should be told about: what the dice decided, and the shakiest governments that matter. */
export function describeAbroad(state: GameState, name: (tag: string) => string, map?: Record<string, MapRegion> | null): string[] {
  const events = castAbroad(state, map);
  const lines: string[] = [];
  const lost = lostShares(state, map);
  if (events.length) {
    const who = (e: AbroadEvent) => `${name(e.country)} [${e.country}]`;
    // What brought each down, in a word, so the story can say why.
    const start = state.chronicle[0]?.from ?? state.date;
    const why = (e: AbroadEvent) => {
      const d = state.countries[e.country]?.domestic;
      const b = d ? fallBecause(state, e.country, d, { lost: lost.get(e.country) ?? 0, to: state.date, start, vote: e.kind === "election" }) : undefined;
      return b && FALL_EN[b.kind] ? ` (${FALL_EN[b.kind]})` : "";
    };
    const coups = events.flatMap((e) => (e.kind === "coup" ? [`${who(e)} ${e.split ? "half succeeds: the army splits and the country falls into civil war (the engine sets up the rebels' government)" : e.succeeded ? "succeeds" : "fails"}${why(e)}`] : []));
    const votes = (kept: boolean) => events.flatMap((e) => (e.kind === "election" && !e.postponed && e.kept === kept ? [`${who(e)} ${e.date}${kept ? "" : why(e)}`] : []));
    const PAUSE_EN: Partial<Record<BecauseKind, string>> = { "war-home": "war on its soil", "war-near": "the enemy at its door", "martial-law": "martial law" };
    const put = events.flatMap((e) => (e.kind === "election" && e.postponed ? [`${who(e)} due ${e.date} (${PAUSE_EN[e.postponed.kind] ?? "the war"}${e.postponed.country ? `: ${name(e.postponed.country)}` : ""})`] : []));
    lines.push("POLITICS ELSEWHERE THIS PERIOD (the engine's dice, already cast: each must happen in the story; name the new leader of every government that falls in leaders):");
    if (coups.length) lines.push(`- coups: ${coups.join("; ")}`);
    if (votes(false).length) lines.push(`- governments that LOSE national elections: ${votes(false).join("; ")}`);
    if (votes(true).length) lines.push(`- governments that keep power at national elections: ${votes(true).join("; ")}`);
    if (put.length) lines.push(`- national elections PUT OFF in wartime (no vote is held; parliament extends its term, the government stays): ${put.join("; ")}`);
  }
  // Governments that fell, or that a patron set up (engine/provisional.ts), and still have no named leader, asked for
  // until they get one, while they still govern somewhere.
  const owners = new Set(Object.values(state.regions).map((r) => r.owner));
  const unnamed = Object.values(state.countries).filter(
    (c) => c.tag !== state.player && !c.leader && (c.client || (c.domestic?.changed && c.domestic.changed.how !== "leader")) && !c.exile && (c.dormant || owners.has(c.tag)),
  );
  if (unnamed.length) lines.push(`NEW GOVERNMENTS WITHOUT A NAMED LEADER (name them in leaders): ${unnamed.map((c) => `${name(c.tag)} [${c.tag}]`).join(", ")}`);
  const income = incomes(state, map);
  const shaky = Object.values(state.countries)
    .filter((c) => c.tag !== state.player && c.domestic && !c.dormant && c.economy)
    .map((c) => ({ c, risk: coupRiskIn(state, c.tag, lost, income) }))
    .filter((x) => x.risk >= 10)
    .sort((a, b) => b.c.economy!.gdp - a.c.economy!.gdp)
    .slice(0, 6);
  if (shaky.length) {
    lines.push(`SHAKY GOVERNMENTS (support, stability, coup risk a year): ${shaky.map(({ c, risk }) => `${name(c.tag)} [${c.tag}] ${Math.round(c.domestic!.support)}%, ${Math.round(c.domestic!.stability)}, ${risk}%`).join("; ")}`);
  }
  return lines;
}

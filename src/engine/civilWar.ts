import { newDomestic, newJunta, type AbroadEvent } from "./abroad";
import { cutTroops, lostForGood } from "./army";
import { leaderOf } from "./people";
import { countryColor } from "./colors";
import { countryName } from "./names";
import { MODERN } from "./scenarios/coldwar";
import { roll } from "./dice";
import { startingEconomy } from "./economy";
import { endWar } from "./foreign";
import { ownFormation } from "./figures";
import { liftShare } from "./forces";
import { loyaltyOf } from "./politics";
import { peopleIn } from "./population";
import { allied, greatPowers, powers, remember, tieOf, warBetween } from "./relations";
import { canRise, regimeNow } from "./role";
import { en } from "./text";
import { canFall } from "./unrest";
import { readState, willToFight } from "./warMeans";
import type {
  AppliedChange,
  ArmsStock,
  Arsenal,
  CivilHow,
  CivilSide,
  CivilWar,
  CountryState,
  GameState,
  GovernmentChange,
  Localized,
  MapRegion,
  Movement,
  Party,
  Plan,
  RegimeKind,
  RiseHow,
  Text,
  War,
  WarSeed,
  WeaponKind,
} from "./types";

/**
 * Civil wars. A country can split: a coup that took the capital or part of
 * the army and not the rest (abroad, a coup's dice: engine/abroad.ts; at
 * home, an overthrow the game master reports that the engine's dice leave
 * half done), a revolution the army does not all follow, a rising, or a part
 * of the country that breaks away. Then:
 *
 * - the rebels set up a government of their own (a new tag) that owns and
 *   holds their side's regions, so the fronts, the formations, the losses and
 *   the people's toll work between the two as in any war (engine/fronts.ts,
 *   engine/formations.ts, engine/warLosses.ts, engine/civilians.ts);
 * - regions choose sides by opinion: from where the rising began, the
 *   provinces most inclined to it – far from the capital for a coup or a
 *   rising, another nation's for a secession – join it until it holds the
 *   share of the people its support gives it; a coup's capital is fought over;
 * - the army chooses by its loyalty: the share of the soldiers and their
 *   weapons that go over follows the army's loyalty to the government (the
 *   player's politics, or a government's stability abroad), and the player's
 *   formations stationed in the rebels' land go with it;
 * - during the war, soldiers and provinces near the front go over to the side
 *   the country takes as the more rightful (legitimacy, 0–100 each: the
 *   people and the capital each side holds, its form of government, the
 *   recognition it has);
 * - governments abroad lean to a side by their ties to the old government and
 *   the kind of regime each side is: those that lean far recognise the
 *   rebels, send volunteers from their own army – as far as they can reach
 *   the country, by land or by their ships, and lent: they come home at the
 *   war's end, less their share of their side's losses – or plan to enter the war
 *   (engine/intentions.ts "join" plans); allies of the old government are
 *   called to defend it by their treaties; once most great powers recognise
 *   the rebels and they are the more legitimate, the world body's seat passes
 *   to them;
 * - it ends in victory (one side holds all but a sliver of the people: the
 *   winner governs the whole country under its tag), in partition (a
 *   secession, or rebels as rightful as the government, at a peace – or a
 *   front that has not moved in years, both sides worn out: each keeps what
 *   it holds) or in a settlement (the country one again, the rebels' party in
 *   the government).
 *
 * A civil war running on a date's first day is the scenario's (WarSeed.civil):
 * it is recorded as one when the game begins (seedCivilWars), and a rump that
 * holds less than LOST of the people at the start loses only below half of
 * what it held (CivilWar.floor).
 *
 * Played from either side: a government whose country splits fights the
 * rebels; the leader of the opposition whose rising half succeeds leads the
 * rebels' government (engine/role.ts): the player becomes its leader, with
 * its politics and its army, until it wins the country, is crushed (back into
 * opposition, underground or abroad), or keeps its land. The dice are the
 * game's own (engine/dice.ts): the server and the browser agree.
 */

/** A split the turn brings: the country, how, and the player's place in it. */
export interface Split {
  country: string;
  how: CivilHow;
  /** The player leads the rebels. */
  player?: boolean;
}

/** The fewest provinces a country splits with. */
const MIN_PROVINCES = 3;
/** Below this share of the country's people a side has lost: the winner takes the rest. */
const LOST = 0.03;
/** A front that moved less than this share of the people stands; standing this long, a war of two worn-out sides may end by agreement. */
const STILL_SHARE = 0.05;
const STILL_YEARS = 1.5;
const STALEMATE_YEARS = 2;
const WORN = 45;
/** The chance a year that a stalemate ends by agreement. */
const AGREE = 0.4;
/** Abroad, in the free mode: a rising where the state is near collapse, a secession where another nation's land is restless, chances a year at the worst. */
const RISING_YEAR = 0.08;
const SECESSION_YEAR = 0.05;
/** A secession needs another nation's land holding at least this share of the people. */
const SECESSION_SHARE = 0.05;
/** A month's chance for a province by the front to go over to the more rightful side, at a gap of 50 in legitimacy; at most this many in a turn. */
const REGION_DEFECT = 0.02;
const MAX_REGION_DEFECTS = 3;
/** A month's share of a side's soldiers that go over at a gap of 50 in legitimacy; half as much again when its will is breaking. */
const TROOP_DEFECT = 0.01;
/** Recognition and volunteers, by how far a government leans to a side (−1 the government, 1 the rebels): the lean, the chance a year. */
const RECOGNISE_LEAN = 0.45;
const RECOGNISE_YEAR = 0.35;
const VOLUNTEER_LEAN = 0.55;
/** Volunteers a year: a share of the sender's army, at most this many thousand. */
const VOLUNTEER_SHARE = 0.02;
const VOLUNTEER_MAX = 30;
const INTERVENE_LEAN = 0.8;
/** How fast legitimacy moves toward where it heads: halfway in half a year. */
const LEGITIMACY_HALF = 0.5;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round1 = (v: number) => Math.round(v * 10) / 10;
const YEAR_MS = 365.25 * 86_400_000;
const yearsBetween = (from: string, to: string) => Math.max(0, (Date.parse(to) - Date.parse(from)) / YEAR_MS);
const game = (state: Pick<GameState, "seed" | "id">) => state.seed ?? state.id;
const localized = (t: Text | undefined, fallback: string): Localized => (t === undefined ? { ru: fallback, uk: fallback, en: fallback } : typeof t === "string" ? { ru: t, uk: t, en: t } : t);

/** The rebels' name, by how they rose: "Spain: the junta". */
function rebelName(of: Localized, how: CivilHow): Localized {
  const words: Record<CivilHow, Localized> = {
    coup: { ru: "хунта", uk: "хунта", en: "the junta" },
    revolution: { ru: "революционное правительство", uk: "революційний уряд", en: "the revolutionary government" },
    rising: { ru: "повстанцы", uk: "повстанці", en: "the insurgents" },
    secession: { ru: "сепаратисты", uk: "сепаратисти", en: "the separatists" },
  };
  return { ru: `${of.ru}: ${words[how].ru}`, uk: `${of.uk}: ${words[how].uk}`, en: `${of.en}: ${words[how].en}` };
}

/** The war's name: "Spain: civil war". */
function civilWarName(of: Localized, how: CivilHow): Localized {
  return how === "secession"
    ? { ru: `${of.ru}: война за отделение`, uk: `${of.uk}: війна за відокремлення`, en: `${of.en}: war of secession` }
    : { ru: `${of.ru}: гражданская война`, uk: `${of.uk}: громадянська війна`, en: `${of.en}: civil war` };
}

/** The rebels' form of government, by how they rose. */
const REBEL_REGIME: Record<CivilHow, RegimeKind> = { coup: "military", revolution: "party", rising: "autocracy", secession: "limited" };
/** How the rebels' government came, for the record of a government's changes (Domestic.changed): a secession is a nation's rising. */
const CHANGE_OF: Record<CivilHow, GovernmentChange> = { coup: "coup", revolution: "revolution", rising: "rising", secession: "rising" };
const REBEL_GOVERNMENT: Record<CivilHow, Localized> = {
  coup: { ru: "Военная хунта", uk: "Військова хунта", en: "Military junta" },
  revolution: { ru: "Революционное правительство", uk: "Революційний уряд", en: "Revolutionary government" },
  rising: { ru: "Повстанческое правительство", uk: "Повстанський уряд", en: "Insurgent government" },
  secession: { ru: "Временное правительство отколовшейся республики", uk: "Тимчасовий уряд республіки, що відкололася", en: "Provisional government of a breakaway republic" },
};

/** A government's kind of state: the player's by its politics, any other's by its own. */
function regimeOf(state: GameState, tag: string): RegimeKind {
  if (tag === state.player) return regimeNow(state);
  return state.countries[tag]?.domestic?.regime ?? "autocracy";
}

/** How loyal a government's army and its police are, 0–100: the player's by its politics, another's by its stability. */
function pillarsOf(state: GameState, tag: string): { army: number; police: number } {
  if (tag === state.player && state.politics) {
    const l = loyaltyOf(state.politics);
    return { army: l.army, police: Math.max(l.police, l.security) };
  }
  const s = state.countries[tag]?.domestic?.stability ?? 50;
  return { army: clamp(20 + 0.7 * s, 0, 100), police: clamp(25 + 0.7 * s, 0, 100) };
}

/** The chance a fall goes only half way and the country splits: likelier where a pillar of the state still stands by the government – the police against a coup, the army against a revolution. */
export function splitChance(state: GameState, tag: string, how: "coup" | "revolution"): number {
  const p = pillarsOf(state, tag);
  const loyal = how === "coup" ? p.police : p.army;
  const open = regimeOf(state, tag);
  return round1((0.1 + 0.5 * clamp((loyal - 30) / 50, 0, 1)) * (open === "democracy" ? 0.6 : 1) * 100) / 100;
}

/**
 * An overthrow of the player's government the game master reports, read by
 * the engine: when the government could fall (engine/unrest.ts canFall) and
 * a pillar of the state still stands by it, the dice may leave the fall half
 * done – the country splits instead.
 */
export function overthrowSplits(state: GameState, next: GameState, how: string): Split | null {
  if (next.role && next.role.kind !== "leader") return null;
  if (!canFall(next)) return null;
  const kind = how === "coup" ? "coup" : how === "deposed" ? null : "revolution";
  if (!kind) return null;
  if (roll(game(state), state.turn, `civil:split:${state.player}`) >= splitChance(next, next.player, kind)) return null;
  return { country: next.player, how: kind };
}

/**
 * The player's movement rising (engine/role.ts): a revolution or a coup the
 * engine allows may still leave the state's loyal pillars fighting it, and
 * one it does not allow may still take a part of the country where the
 * movement has fighters and the street – the country splits and the player
 * leads the rebels.
 */
export function riseSplits(state: GameState, next: GameState, how: RiseHow | undefined, election: boolean): Split | null {
  if (!how || (how !== "revolution" && how !== "coup") || next.role?.kind !== "opposition") return null;
  const m = next.role.movement;
  if (!m || m.kind === "exile") return null;
  const dice = roll(game(state), state.turn, `civil:rise:${state.player}`);
  if (canRise(next, how, { election })) {
    if (dice >= splitChance(next, next.player, how)) return null;
  } else {
    // Short of what it takes the whole country with, a movement with fighters or crowds may still take a part of it.
    const force = m.army >= 25 || (m.street >= 45 && (next.politics?.unrest ?? 0) >= 45);
    if (!force || dice >= 0.5 * clamp((m.army + m.street) / 100, 0, 1)) return null;
  }
  return { country: next.player, how, player: true };
}

/**
 * The splits abroad the turn brings, cast from the state before it: a coup
 * that half succeeded (engine/abroad.ts), and in the free mode a rising
 * where a state is near collapse or a secession where another nation's land
 * is restless.
 */
export function castCivilWars(state: GameState, abroad: AbroadEvent[], map: Record<string, MapRegion> | null): Split[] {
  const out: Split[] = abroad.filter((e) => e.kind === "coup" && e.split).map((e) => ({ country: e.country, how: "coup" as const }));
  if (state.mode === "historical" || !map) return out;
  const years = stepYears(state);
  const busy = new Set((state.civilWars ?? []).filter((c) => !c.end).flatMap((c) => [c.of, c.rebels]));
  const land = landsOf(state, map);
  for (const [tag, c] of Object.entries(state.countries).sort((a, b) => a[0].localeCompare(b[0]))) {
    const d = c.domestic;
    const l = land.get(tag);
    if (tag === state.player || !d || c.dormant || c.exile || busy.has(tag) || out.some((s) => s.country === tag) || !l || l.ids.length < MIN_PROVINCES) continue;
    const rising = RISING_YEAR * clamp((20 - d.stability) / 15, 0, 1) * clamp((35 - d.support) / 25, 0, 1);
    if (rising > 0 && roll(game(state), state.turn, `civil:rising:${tag}`) < 1 - (1 - rising) ** years) {
      out.push({ country: tag, how: d.support < 20 ? "revolution" : "rising" });
      continue;
    }
    // A colony's way out is decolonisation's (engine/colonies.ts), not a secession.
    const colonial = colonialNations(state, tag);
    const other = [...l.by].filter(([code]) => code !== l.core && !colonial.has(code)).reduce((s, [, n]) => s + n, 0) / Math.max(1, l.people);
    const secession = other >= SECESSION_SHARE ? SECESSION_YEAR * clamp((30 - d.stability) / 25, 0, 1) : 0;
    if (secession > 0 && roll(game(state), state.turn, `civil:secession:${tag}`) < 1 - (1 - secession) ** years) out.push({ country: tag, how: "secession" });
  }
  return out;
}

/** The nations a government rules as colonies on their way (engine/colonies.ts): their way out is decolonisation, not a secession. */
function colonialNations(state: Pick<GameState, "colonies">, tag: string): Set<string> {
  return new Set((state.colonies ?? []).filter((c) => !c.end && c.of === tag).flatMap((c) => c.adm0));
}

const STEP: Record<GameState["step"], number> = { week: 7 / 365, month: 1 / 12, quarter: 0.25, half: 0.5, year: 1 };
const stepYears = (state: Pick<GameState, "step">) => STEP[state.step];

/** Each country's own land: the provinces it owns and holds, its people, the nation most of them are (the map's adm0) and the people of other nations. */
function landsOf(state: Pick<GameState, "regions">, map: Record<string, MapRegion>): Map<string, { ids: string[]; people: number; core?: string; foreign: number; by: Map<string, number> }> {
  const out = new Map<string, { ids: string[]; people: number; core?: string; foreign: number; by: Map<string, number> }>();
  for (const [id, r] of Object.entries(state.regions)) {
    const p = map[id];
    if (!p || r.owner !== r.controller || r.contested) continue;
    const l = out.get(r.owner) ?? { ids: [], people: 0, foreign: 0, by: new Map<string, number>() };
    const n = peopleIn(r, p);
    l.ids.push(id);
    l.people += n;
    l.by.set(p.adm0, (l.by.get(p.adm0) ?? 0) + n);
    out.set(r.owner, l);
  }
  for (const l of out.values()) {
    l.core = [...l.by].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
    l.foreign = [...l.by].filter(([code]) => code !== l.core).reduce((s, [, n]) => s + n, 0);
  }
  return out;
}

/** The country's people by who holds them now, of the land of the two sides; and who holds its largest town. */
export function civilHold(state: Pick<GameState, "regions">, cw: Pick<CivilWar, "of" | "rebels">, map: Record<string, MapRegion> | null): { government: number; rebels: number; capital?: CivilSide } {
  let government = 0;
  let rebels = 0;
  let top = -1;
  let capital: CivilSide | undefined;
  for (const [id, r] of Object.entries(state.regions)) {
    if (r.owner !== cw.of && r.owner !== cw.rebels) continue;
    const n = peopleIn(r, map?.[id]) || (map ? 0 : 1);
    const side: CivilSide | null = r.controller === cw.of ? "government" : r.controller === cw.rebels ? "rebels" : null;
    if (!side) continue;
    const other: CivilSide = side === "government" ? "rebels" : "government";
    const theirs = r.contested === (other === "rebels" ? cw.rebels : cw.of) ? (r.held ?? 30) / 100 : 0;
    if (side === "government") {
      government += n * (1 - theirs);
      rebels += n * theirs;
    } else {
      rebels += n * (1 - theirs);
      government += n * theirs;
    }
    if (n > top) {
      top = n;
      capital = side;
    }
  }
  const total = government + rebels;
  return total > 0 ? { government: government / total, rebels: rebels / total, capital } : { government: 0, rebels: 0 };
}

/** Splits a stock of weapons: the share `a` goes over. */
function splitStock(stock: Arsenal["stock"], a: number): { gone: Arsenal["stock"]; kept: Arsenal["stock"] } {
  const gone: Arsenal["stock"] = {};
  const kept: Arsenal["stock"] = {};
  for (const [kind, s] of Object.entries(stock) as [WeaponKind, ArmsStock][]) {
    const part = (x: number) => Math.round(x * a * 100) / 100;
    const types = s.types ? Object.fromEntries(Object.entries(s.types).map(([t, n]) => [t, part(n ?? 0)])) : undefined;
    gone[kind] = { n: part(s.n), level: s.level, ...(types ? { types } : {}) };
    kept[kind] = { n: Math.round((s.n - part(s.n)) * 100) / 100, level: s.level, ...(s.types ? { types: Object.fromEntries(Object.entries(s.types).map(([t, n]) => [t, Math.round(((n ?? 0) - part(n ?? 0)) * 100) / 100])) } : {}) };
  }
  return { gone, kept };
}

/** The province farthest from another, among some, by the map's centres. */
function farthest(ids: string[], from: string, map: Record<string, MapRegion>, weight: (id: string) => number = () => 1): string | undefined {
  const at = map[from]?.at;
  let best: string | undefined;
  let score = -1;
  for (const id of ids) {
    const p = map[id]?.at;
    const d = at && p ? Math.hypot(p[0] - at[0], p[1] - at[1]) : 0;
    const s = d * weight(id);
    if (s > score || (s === score && best !== undefined && id < best)) {
      score = s;
      best = id;
    }
  }
  return best;
}

interface StartContext {
  turn: number;
  to: string;
  map: Record<string, MapRegion>;
  neighbors: Record<string, string[]>;
}

/**
 * The country splits: the rebels' government and its regions, the army and
 * its weapons divided, the war between them, and the record. Returns false
 * where there is too little to split (the coup then simply failed). In place.
 */
export function startCivilWar(next: GameState, split: Split, ctx: StartContext, applied: AppliedChange[]): boolean {
  const of = split.country;
  const c = next.countries[of];
  if (!c?.economy || c.dormant || c.exile) return false;
  if ((next.civilWars ?? []).some((x) => !x.end && (x.of === of || x.rebels === of))) return false;
  const lands = landsOf(next, ctx.map);
  const land = lands.get(of);
  if (!land || land.ids.length < MIN_PROVINCES || land.people <= 0) return false;
  const dice = (key: string) => roll(game(next), ctx.turn, `civil:${of}:${key}`);
  const pop = (id: string) => peopleIn(next.regions[id], ctx.map[id]);
  const capital = [...land.ids].sort((a, b) => pop(b) - pop(a) || a.localeCompare(b))[0];
  const pillars = pillarsOf(next, of);
  const support = of === next.player ? 100 - (next.politics?.unrest ?? 40) : (c.domestic?.support ?? 50);
  const movement = split.player ? next.role?.movement : undefined;

  // How much of the country and of the army the rebels take.
  const jitter = (dice("share") - 0.5) * 0.2;
  let share: number;
  let army: number;
  if (movement) {
    share = clamp(0.1 + (movement.support / 100) * 0.6 + movement.army / 400 + jitter, 0.12, 0.6);
    army = clamp(movement.army / 100 + 0.1, 0.1, 0.7);
  } else if (split.how === "coup") {
    share = clamp(0.2 + 0.4 * (1 - pillars.army / 100) + jitter, 0.15, 0.6);
    army = clamp(0.35 + 0.5 * (1 - pillars.army / 100), 0.3, 0.75);
  } else if (split.how === "revolution") {
    share = clamp(0.2 + 0.35 * (1 - support / 100) + jitter, 0.15, 0.55);
    army = clamp(0.1 + 0.5 * (1 - pillars.army / 100), 0.1, 0.6);
  } else if (split.how === "rising") {
    share = clamp(0.1 + 0.2 * (1 - support / 100) + jitter, 0.08, 0.35);
    army = clamp(0.5 * share, 0.05, 0.3);
  } else {
    share = 0;
    army = 0;
  }

  // The regions: another nation's land for a secession; else grown from where the rising began, by the provinces most inclined to it.
  const rebelIds = new Set<string>();
  const core = land.core;
  let nation: string | undefined;
  if (split.how === "secession" && !movement) {
    // The largest of the other nations breaks away (Croatia from Yugoslavia, not all its republics at once).
    const others = new Map<string, number>();
    const colonial = colonialNations(next, of);
    for (const id of land.ids) if (ctx.map[id].adm0 !== core && !colonial.has(ctx.map[id].adm0)) others.set(ctx.map[id].adm0, (others.get(ctx.map[id].adm0) ?? 0) + pop(id));
    nation = [...others].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
    for (const id of land.ids) if (nation && ctx.map[id].adm0 === nation && id !== capital) rebelIds.add(id);
    const n = [...rebelIds].reduce((s, id) => s + pop(id), 0);
    share = n / land.people;
    army = clamp(0.8 * share, 0.05, 0.4);
  } else {
    const rough = (id: string) => (["mountains", "hills", "forest", "jungle", "wetlands"].includes(ctx.map[id].terrain) ? 1.3 : 1);
    const start = split.how === "revolution" && dice("capital") < 0.5 ? capital : farthest(land.ids.filter((id) => id !== capital), capital, ctx.map, (id) => Math.sqrt(1 + pop(id)) * rough(id));
    if (!start) return false;
    const mine = new Set(land.ids);
    const at = ctx.map[capital]?.at;
    const far = Math.max(1e-6, ...land.ids.map((id) => (at && ctx.map[id].at ? Math.hypot(ctx.map[id].at![0] - at[0], ctx.map[id].at![1] - at[1]) : 0)));
    const lean = (id: string) => {
      const p = ctx.map[id].at;
      const d = at && p ? Math.hypot(p[0] - at[0], p[1] - at[1]) / far : 0;
      return 0.5 * (split.how === "revolution" ? 1 - d : d) + 0.5 * dice(`lean:${id}`) + (ctx.map[id].adm0 !== core ? 0.3 : 0) + (rough(id) > 1 ? 0.1 : 0);
    };
    const leans = new Map(land.ids.map((id) => [id, lean(id)]));
    const goal = share * land.people;
    let held = 0;
    const take = (id: string) => {
      rebelIds.add(id);
      held += pop(id);
    };
    take(start);
    for (let guard = 0; held < goal && guard < land.ids.length; guard++) {
      const frontier = [...rebelIds].flatMap((id) => ctx.neighbors[id] ?? []).filter((id) => mine.has(id) && !rebelIds.has(id) && id !== capital);
      let pick: string | undefined = [...new Set(frontier)].sort((a, b) => leans.get(b)! - leans.get(a)! || a.localeCompare(b))[0];
      // An island or an enclave of its own: a new seed where the land runs out.
      pick ??= farthest(land.ids.filter((id) => !rebelIds.has(id) && id !== capital), capital, ctx.map, (id) => Math.sqrt(1 + pop(id)));
      if (!pick) break;
      take(pick);
    }
    share = held / land.people;
  }
  // The government keeps something: no split leaves the old government nothing but its capital.
  if (!rebelIds.size || rebelIds.size >= land.ids.length) return false;

  // The rebels' government.
  const name = localized(c.name, of);
  const taken = (id: string) => rebelIds.has(id);
  // A breakaway nation that has a government of its own waiting (a republic inside the state, a movement) rises under it.
  const own = nation ? MODERN[nation] : undefined;
  const waiting = own && next.countries[own] && own !== of && (next.countries[own].dormant || !Object.values(next.regions).some((r) => r.controller === own)) ? own : undefined;
  const tag = waiting ?? (next.countries[`${of}-rebels`] ? `${of}-rebels-${ctx.turn}` : `${of}-rebels`);
  const nationName = own ? countryName(own) : undefined;
  const troops = Math.round(c.economy.troops * army);
  const stock = c.arsenal?.stock ? splitStock(c.arsenal.stock, army) : null;
  const men = c.arsenal?.men;
  const leader = split.player ? (next.role?.person?.name ?? movement?.name) : undefined;
  const was = waiting ? next.countries[waiting] : undefined;
  const rebels: CountryState = {
    ...(was ?? {}),
    tag,
    name: was?.name ?? nationName ?? rebelName(name, split.how),
    color: was?.color ?? countryColor(tag),
    ...(leader ? { leader } : was?.leader ? { leader: was.leader } : {}),
    government: REBEL_GOVERNMENT[split.how],
    economy: startingEconomy(
      [...rebelIds].map((id) => ({ ...ctx.map[id], pop: pop(id) })),
      next.scenarioId,
      { troops, army: 0.25, growth: -3 },
    ),
    ...(stock ? { arsenal: { stock: stock.gone, ...(men ? { men: { pro: Math.round(men.pro * army), trained: Math.round(men.trained * army), recruits: Math.round(men.recruits * army) } } : {}) } } : {}),
  };
  rebels.domestic = { ...newDomestic(rebels, next.scenarioId, ctx.to, REBEL_REGIME[split.how]), support: 60, stability: 35, changed: { date: ctx.to, how: CHANGE_OF[split.how] } };
  delete rebels.dormant;
  delete rebels.exile;
  next.countries[tag] = rebels;
  const kept = { ...c.economy };
  cutTroops(kept, kept.troops - troops);
  c.economy = kept;
  if (stock && c.arsenal) c.arsenal = { ...c.arsenal, stock: stock.kept, ...(men ? { men: { pro: men.pro - Math.round(men.pro * army), trained: men.trained - Math.round(men.trained * army), recruits: men.recruits - Math.round(men.recruits * army) } } : {}) };
  // The player's formations stationed in the rebels' land go over with it.
  const org = c.arsenal?.organisation;
  let units = 0;
  // A general's own command goes over only with him: it follows its commander, who stays with the government.
  const command = ownFormation(next);
  if (org) {
    const kept = org.formations.filter((f) => {
      const there = f.provinces.filter(taken).length;
      const gone = f !== command && f.provinces.length > 0 && there * 2 > f.provinces.length;
      if (gone) units += 1;
      return !gone;
    });
    if (units) c.arsenal = { ...c.arsenal!, organisation: { ...org, formations: kept } };
  }
  // The government's formations in other wars whose sectors lie in the rebels' land are lost to it.
  for (const w of next.wars) if (w.units) w.units = w.units.filter((u) => u.tag !== of || !u.sector.some(taken));

  for (const id of rebelIds) {
    const r = next.regions[id];
    r.owner = tag;
    r.controller = tag;
    delete r.contested;
    delete r.held;
    delete r.taken;
    delete r.behind;
    delete r.resistance;
    delete r.dug;
  }
  // A coup's capital, or a revolution's, is fought over: the side that lost it still holds a part.
  if (split.how === "coup" || split.how === "revolution" || movement) {
    const r = next.regions[capital];
    const theirs = rebelIds.has(capital);
    r.contested = theirs ? of : tag;
    r.held = Math.round(20 + dice("capital-held") * 25);
  }

  const id = `w${ctx.turn}-cw${(next.civilWars ?? []).length + 1}`;
  const war: War = { id, name: civilWarName(name, split.how), attackers: [tag], defenders: [of], since: ctx.to };
  next.wars.push(war);
  applied.push({ kind: "war", war: id, name: war.name, sides: [tag, of] });
  applied.push({ kind: "civil", war: id, country: of, rebels: tag, change: "split", how: split.how, n: troops, regions: rebelIds.size });

  const government = of === next.player ? 55 : clamp(30 + (c.domestic?.support ?? 50) * 0.4, 25, 70);
  const record: CivilWar = {
    war: id,
    of,
    rebels: tag,
    how: split.how,
    since: ctx.to,
    legitimacy: { government: Math.round(government), rebels: Math.round(split.how === "secession" ? 40 : 30 + 20 * share) },
    recognised: [],
    hold: Math.round(share * 100),
    still: ctx.to,
    ...(split.player ? { player: "rebels" as const } : of === next.player && next.role?.kind !== "opposition" ? { player: "government" as const } : {}),
  };
  next.civilWars = [...(next.civilWars ?? []), record];
  if (c.domestic) c.domestic = { ...c.domestic, lastCoup: ctx.to, stability: Math.max(5, c.domestic.stability - 10) };
  if (split.player) joinRebels(next, record, ctx.to);
  return true;
}

/**
 * The player's movement becomes the rebels' government: the player leads it,
 * its party rules with its allies, the old government's party is the enemy,
 * and the old government's business is no longer the player's. In place.
 */
function joinRebels(next: GameState, cw: CivilWar, to: string): void {
  const role = next.role;
  const m = role?.movement;
  const person = role?.person;
  // The government left behind is another's now, kept by the engine as every government abroad: its regime, its
  // support (its parties'), its stability (the street's calm), its election (engine/abroad.ts).
  const old = next.countries[cw.of];
  if (old && next.politics) {
    const regime = regimeNow(next);
    const ruling = next.politics.parties.filter((p) => p.status === "ruling" || p.status === "coalition").reduce((s, p) => s + p.support, 0);
    const votes = (regime === "democracy" || regime === "limited") && next.politics.nextElection && next.politics.nextElection > to;
    old.domestic = {
      ...newDomestic(old, next.scenarioId, to, regime),
      support: Math.round(clamp(ruling || 50, 5, 90)),
      stability: Math.round(clamp(100 - next.politics.unrest, 5, 95)),
      ...(votes ? { nextElection: next.politics.nextElection } : {}),
    };
  }
  if (person) next.countries[cw.rebels].leader = person.name;
  next.player = cw.rebels;
  next.role = { kind: "leader", ...(person ? { person } : {}), since: to, how: "rose" };
  if (next.politics) {
    const own = next.politics.parties.find((p) => m?.name && p.name.trim().toLowerCase() === m.name.trim().toLowerCase());
    // The old government's parties are the enemy now: outlawed in the rebels' land, recorded so party life leaves them be while they fight on.
    cw.outlawed = next.politics.parties.flatMap((p) => (p !== own && !m?.allies?.includes(p.id) && (p.status === "ruling" || p.status === "coalition") ? [{ id: p.id, status: p.status }] : []));
    next.politics = {
      ...next.politics,
      unrest: 30,
      loyalty: { army: 70, police: 60, security: 60, elites: 45 },
      parties: next.politics.parties.map((p): Party =>
        p === own ? { ...p, status: "ruling" } : m?.allies?.includes(p.id) ? { ...p, status: "coalition" } : p.status === "ruling" || p.status === "coalition" ? { ...p, status: "banned" } : p,
      ),
      plots: [],
    };
    if (!cw.outlawed.length) delete cw.outlawed;
  }
  // The old government's people, plans and bargains stay with it.
  for (const key of ["officials", "deputies", "deputyAdvice", "intrigues", "directives", "standing", "budgetSet", "proposals", "proclamation", "personnel", "deals", "armyOrders", "cabinet", "bills"] as const) delete next[key];
  next.protests = (next.protests ?? []).filter((p) => p.country);
}

/**
 * The player who led the rebels returns to the country they rose in: as its
 * leader after a victory, as a party in a settlement, or crushed – into the
 * underground, or abroad where someone shelters the movement.
 */
function leaveRebels(next: GameState, cw: CivilWar, how: "victory" | "settlement" | "crushed", to: string): void {
  if (next.player !== cw.rebels) return;
  const person = next.role?.person;
  next.player = cw.of;
  // The country is the player's again: its politics are the player's, not the engine's abroad.
  delete next.countries[cw.of]?.domestic;
  if (how === "victory") {
    if (person) next.countries[cw.of].leader = person.name;
    next.role = { kind: "leader", ...(person ? { person } : {}), since: to, how: "rose" };
    return;
  }
  const ruling = next.politics?.parties.find((p) => p.status === "ruling");
  const movement: Movement = {
    ...(ruling?.name ? { name: ruling.name } : {}),
    kind: how === "settlement" ? "party" : "underground",
    status: how === "settlement" ? "free" : "banned",
    support: clamp(ruling?.support ?? 15, 3, 60),
    members: how === "settlement" ? 150 : 15,
    money: 30,
    press: how === "settlement" ? 40 : 10,
    insiders: how === "settlement" ? 35 : 5,
    army: how === "settlement" ? 20 : 10,
    street: 25,
  };
  if (next.politics && ruling) {
    // The old government's parties are restored as they were before the split, and no others: a party banned long before the war stays banned.
    const restored = new Map((cw.outlawed ?? []).map((o) => [o.id, o.status] as const));
    let parties = next.politics.parties.map((p): Party => (p.id === ruling.id ? { ...p, status: how === "settlement" ? "coalition" : "banned" } : restored.has(p.id) ? { ...p, status: restored.get(p.id)! } : p));
    // Its ruling party ended meanwhile: the largest of the rest it restored governs.
    if (!parties.some((p) => p.status === "ruling")) {
      const heir = parties.filter((p) => restored.has(p.id)).sort((a, b) => b.support - a.support)[0];
      if (heir) parties = parties.map((p) => (p === heir ? { ...p, status: "ruling" } : p));
    }
    next.politics = { ...next.politics, parties };
  }
  next.role = { kind: "opposition", ...(person ? { person } : {}), movement, since: to, how: "fell" };
  for (const key of ["officials", "deputies", "deputyAdvice", "intrigues", "directives", "standing", "budgetSet", "proposals", "proclamation", "personnel", "deals", "armyOrders", "cabinet", "bills"] as const) delete next[key];
}

// ——— The war, turn by turn ———

interface AdvanceContext {
  turn: number;
  to: string;
  years: number;
  map: Record<string, MapRegion>;
  neighbors: Record<string, string[]>;
}

/** How far a government leans to a civil war's side: −1 the old government, 1 the rebels. */
function leanOf(state: GameState, g: string, cw: CivilWar): number {
  const tie = tieOf(state, g, cw.of);
  const mine = state.countries[g]?.domestic?.regime;
  const theirs = state.countries[cw.rebels]?.domestic?.regime;
  const old = state.countries[cw.of]?.domestic?.regime ?? (cw.of === state.player ? regimeNow(state) : undefined);
  let lean = -tie.trust / 100 + (tie.tension / 100) * 0.5;
  if (allied(state, g, cw.of)) lean -= 0.6;
  if (mine && theirs && mine === theirs) lean += 0.3;
  if (mine && old && mine === old) lean -= 0.2;
  lean += (cw.legitimacy.rebels - cw.legitimacy.government) / 100;
  return clamp(lean, -1.5, 1.5);
}

/**
 * How far a government's volunteers reach a country at civil war, 0–1: all of them where it holds land next to the
 * country, else what its ships can carry to a country with a coast (engine/forces.ts liftShare), none to a country
 * with neither.
 */
function volunteerReach(state: GameState, g: string, cw: CivilWar, ctx: Pick<AdvanceContext, "map" | "neighbors">): number {
  let coast = false;
  for (const [id, r] of Object.entries(state.regions)) {
    if (r.owner !== cw.of && r.owner !== cw.rebels && r.controller !== cw.of && r.controller !== cw.rebels) continue;
    if (ctx.map[id]?.coastal) coast = true;
    if ((ctx.neighbors[id] ?? []).some((n) => state.regions[n]?.controller === g)) return 1;
  }
  return coast ? liftShare(state, g) : 0;
}

/** Moves a soldiers' count from one side's army to the other's. */
function moveTroops(next: GameState, from: string, to: string, n: number): number {
  const a = next.countries[from]?.economy;
  const b = next.countries[to]?.economy;
  if (!a || !b || n <= 0) return 0;
  const moved = Math.min(a.troops, Math.round(n));
  cutTroops(a, a.troops - moved);
  b.troops += moved;
  return moved;
}

/**
 * A civil war's turn, once the fronts and the war's end for landless
 * governments have been settled: civil wars the game master began are
 * recorded, then for each live one legitimacy moves, provinces and soldiers
 * go over, governments abroad recognise, send volunteers or plan to enter,
 * and the war ends where it is won, worn out or made peace. In place.
 */
export function advanceCivilWars(before: GameState, next: GameState, ctx: AdvanceContext, applied: AppliedChange[]): void {
  registerCivilWars(before, next, applied);
  const list = next.civilWars;
  if (!list?.some((c) => !c.end)) {
    pruneCivilWars(next, ctx);
    return;
  }
  const power = powers(next);
  const great = greatPowers(power);
  const reading = readState(next, ctx.map);
  for (const cw of list) {
    if (cw.end) continue;
    const war = next.wars.find((w) => w.id === cw.war);
    const gov = next.countries[cw.of];
    const reb = next.countries[cw.rebels];
    const hold = civilHold(next, cw, ctx.map);
    // Ended by the fighting (a side with no land given up, engine/warEnd.ts) or by a peace; a date's rump smaller than LOST at the start by its own floor.
    if (cw.floor === undefined && cw.seeded) cw.floor = Math.min(LOST, hold.rebels / 2, hold.government / 2);
    const lost = cw.floor ?? LOST;
    const govGone = !gov || gov.dormant || hold.government < lost;
    // Rebels that are a movement without land of their own (the Pathet Lao, the mujahideen) stand while they hold some.
    const rebGone = !reb || (reb.dormant && hold.rebels <= 0) || hold.rebels < lost;
    if (rebGone) {
      endCivilWar(next, cw, war, "crushed", ctx, applied);
      continue;
    }
    if (govGone) {
      endCivilWar(next, cw, war, "victory", ctx, applied);
      continue;
    }
    if (!war) {
      // A peace: rebels holding nearly all of it have won; a secession still standing keeps its land however small (Taiwan's 1.4%),
      // a rising the government nearly holds whole is crushed, and else rebels as rightful as the government keep theirs.
      const how = hold.rebels >= 0.9 ? "victory" : cw.how === "secession" ? "partition" : hold.government >= 0.9 ? "crushed" : cw.legitimacy.rebels >= cw.legitimacy.government ? "partition" : "settlement";
      endCivilWar(next, cw, war, how, ctx, applied);
      continue;
    }
    // A truce stills it; the turn it began in, the sides are still taking shape.
    if (war.truce || cw.since === ctx.to) continue;

    // Legitimacy heads where the people, the capital, the form of government and the world's recognition put it.
    const recognisedBy = cw.recognised.filter((t) => next.countries[t] && !next.countries[t].dormant);
    const greatOnRebels = recognisedBy.filter((t) => great.has(t)).length;
    const openGov = ["democracy", "limited"].includes(regimeOf(next, cw.of));
    const targetGov = 25 + 50 * hold.government + (hold.capital === "government" ? 10 : 0) + (openGov ? 10 : 0) - 5 * greatOnRebels;
    const targetReb = 15 + 50 * hold.rebels + (hold.capital === "rebels" ? 10 : 0) + Math.min(20, 3 * recognisedBy.length) + (cw.seat ? 10 : 0) + (cw.how === "secession" ? 10 : 0);
    const pace = 1 - 0.5 ** (ctx.years / LEGITIMACY_HALF);
    cw.legitimacy = {
      government: Math.round(clamp(cw.legitimacy.government + (clamp(targetGov, 5, 95) - cw.legitimacy.government) * pace, 0, 100)),
      rebels: Math.round(clamp(cw.legitimacy.rebels + (clamp(targetReb, 5, 95) - cw.legitimacy.rebels) * pace, 0, 100)),
    };
    const gap = cw.legitimacy.rebels - cw.legitimacy.government;
    const months = ctx.years * 12;

    // Soldiers go over to the more rightful side, more where their own side's will is breaking – across a line where the two
    // meet; a rump across the sea (Taiwan's) sees no army walk over.
    const losing = gap > 0 ? cw.of : cw.rebels;
    const winning = gap > 0 ? cw.rebels : cw.of;
    const will = willToFight(next, losing, ctx.map, reading);
    const meet = Object.entries(next.regions).some(([id, r]) => (r.controller === cw.of || r.controller === cw.rebels) && (r.contested === cw.of || r.contested === cw.rebels || (ctx.neighbors[id] ?? []).some((n) => next.regions[n]?.controller === (r.controller === cw.of ? cw.rebels : cw.of))));
    const rate = meet ? TROOP_DEFECT * clamp(Math.abs(gap) / 50, 0, 1) * (will < 40 ? 1.5 : 1) : 0;
    const troops = moveTroops(next, losing, winning, (next.countries[losing]?.economy?.troops ?? 0) * (1 - (1 - rate) ** months));
    // And provinces by the front, held by the less rightful side, go over to the other.
    let regions = 0;
    if (Math.abs(gap) >= 15) {
      const chance = 1 - (1 - REGION_DEFECT * clamp(Math.abs(gap) / 50, 0, 1)) ** months;
      for (const [id, r] of Object.entries(next.regions).sort((a, b) => a[0].localeCompare(b[0]))) {
        if (regions >= MAX_REGION_DEFECTS) break;
        if (r.controller !== losing || r.contested || (r.owner !== cw.of && r.owner !== cw.rebels)) continue;
        if (!(ctx.neighbors[id] ?? []).some((n) => next.regions[n]?.controller === winning)) continue;
        if (roll(game(next), ctx.turn, `civil:defect:${cw.war}:${id}`) >= chance) continue;
        if (r.owner === losing) r.owner = winning;
        r.controller = winning;
        delete r.behind;
        delete r.resistance;
        delete r.dug;
        regions += 1;
      }
    }
    if (troops >= 1 || regions) {
      const d = cw.defected ?? { rebels: 0, government: 0, regions: 0 };
      cw.defected = { ...d, [winning === cw.rebels ? "rebels" : "government"]: d[winning === cw.rebels ? "rebels" : "government"] + troops, regions: d.regions + regions };
      applied.push({ kind: "civil", war: cw.war, country: cw.of, rebels: cw.rebels, change: "defected", side: winning === cw.rebels ? "rebels" : "government", n: troops, ...(regions ? { regions } : {}) });
    }

    // The world: recognition, volunteers, and plans to enter.
    let planned = false;
    for (const g of Object.keys(next.countries).sort()) {
      const x = next.countries[g];
      if (g === cw.of || g === cw.rebels || !x.course || x.dormant || x.exile || g === next.player || !power.has(g)) continue;
      const lean = leanOf(next, g, cw);
      const dice = (key: string) => roll(game(next), ctx.turn, `civil:${cw.war}:${g}:${key}`);
      if (lean >= RECOGNISE_LEAN && cw.legitimacy.rebels >= 25 && !cw.recognised.includes(g) && dice("recognise") < 1 - (1 - RECOGNISE_YEAR) ** ctx.years) {
        cw.recognised = [...cw.recognised, g].sort();
        applied.push({ kind: "civil", war: cw.war, country: cw.of, rebels: cw.rebels, change: "recognised", by: g });
        // The old government takes it as siding with its enemy; the rebels remember the friend.
        remember(next, cw.of, g, "joined-enemy", -20, ctx.to);
        remember(next, cw.rebels, g, "aided", 15, ctx.to);
      }
      const atWar = next.wars.some((w) => w.attackers.includes(g) || w.defenders.includes(g));
      if (Math.abs(lean) >= VOLUNTEER_LEAN && !atWar && (x.course.hawk >= 40 || great.has(g))) {
        const side: CivilSide = lean > 0 ? "rebels" : "government";
        const own = x.economy?.troops ?? 0;
        // No further than it can reach the country: next to it by land, or across the sea by its ships.
        const men = Math.min(VOLUNTEER_MAX, own * VOLUNTEER_SHARE) * ctx.years * volunteerReach(next, g, cw, ctx);
        const sent = men >= 0.5 ? moveTroops(next, g, side === "rebels" ? cw.rebels : cw.of, men) : 0;
        if (sent > 0) {
          const list = cw.volunteers ?? [];
          const had = list.find((v) => v.from === g && v.side === side);
          if (!had) {
            applied.push({ kind: "civil", war: cw.war, country: cw.of, rebels: cw.rebels, change: "volunteers", by: g, side, n: sent });
            remember(next, side === "rebels" ? cw.rebels : cw.of, g, "came-to-aid", 15, ctx.to);
            remember(next, side === "rebels" ? cw.of : cw.rebels, g, "joined-enemy", -20, ctx.to);
          }
          cw.volunteers = had ? list.map((v) => (v === had ? { ...v, men: v.men + sent } : v)) : [...list, { from: g, side, men: sent }];
        }
      }
      // A government that leans far and is ready to fight plans to enter the war (engine/intentions.ts carries the plan).
      if (!planned && Math.abs(lean) >= INTERVENE_LEAN && x.course.hawk >= 60 && !atWar && !(next.plans ?? []).some((p) => !p.end && p.by === g && p.war === cw.war) && dice("intervene") < 1 - 0.5 ** ctx.years) {
        const side = lean > 0 ? "attackers" : "defenders";
        const plan: Plan = { id: `c${ctx.turn}-${cw.war}-${g}`, kind: "join", by: g, war: cw.war, side, target: side === "attackers" ? cw.of : cw.rebels, cause: "opportunity", stage: "tension", since: ctx.to, moved: ctx.to };
        next.plans = [...(next.plans ?? []), plan];
        applied.push({ kind: "plan", plan: plan.id, type: "join", by: g, target: plan.target, stage: "tension" });
        planned = true;
      }
    }
    // The world body's seat follows most of the great powers to the more rightful rebels.
    if (!cw.seat && great.size && greatOnRebels * 2 > great.size && gap > 0) {
      cw.seat = true;
      applied.push({ kind: "civil", war: cw.war, country: cw.of, rebels: cw.rebels, change: "seat" });
    }

    // The line: where it stands still for years and both sides are worn out, they may agree to end it – unless the player fights it, whose orders decide.
    const now = Math.round(hold.rebels * 100);
    if (cw.hold === undefined || Math.abs(now - cw.hold) >= STILL_SHARE * 100) {
      cw.hold = now;
      cw.still = ctx.to;
    }
    const mine = next.player === cw.of || next.player === cw.rebels;
    if (!mine && yearsBetween(cw.since, ctx.to) >= STALEMATE_YEARS && yearsBetween(cw.still ?? cw.since, ctx.to) >= STILL_YEARS) {
      const worn = willToFight(next, cw.of, ctx.map, reading) < WORN && willToFight(next, cw.rebels, ctx.map, reading) < WORN;
      if (worn && roll(game(next), ctx.turn, `civil:agree:${cw.war}`) < 1 - (1 - AGREE) ** ctx.years) {
        const apart = cw.how === "secession" || (hold.rebels >= 0.15 && cw.legitimacy.rebels >= 40);
        endCivilWar(next, cw, war, apart ? "partition" : "settlement", ctx, applied);
      }
    }
  }
  pruneCivilWars(next, ctx);
}

/** Ended civil wars stay on the record for a few years, for the panel and the game master. */
function pruneCivilWars(next: GameState, ctx: Pick<AdvanceContext, "to">): void {
  if (!next.civilWars) return;
  next.civilWars = next.civilWars.filter((c) => !c.end || yearsBetween(c.end.date, ctx.to) < 3);
  if (!next.civilWars.length) delete next.civilWars;
}

/**
 * A civil war the game master began – a war between a government and a
 * country born this turn or a movement without land of its own, holding land
 * that was the government's – is recorded as one: a secession, or a rising.
 * A colony's war (engine/colonies.ts) is not a civil war.
 */
function registerCivilWars(before: GameState, next: GameState, applied: AppliedChange[]): void {
  const known = new Set((next.civilWars ?? []).map((c) => c.war));
  const colonial = new Set((next.colonies ?? []).flatMap((c) => (c.war ? [c.war] : [])));
  const born = new Set(applied.flatMap((a) => (a.kind === "new-country" ? [a.country] : [])));
  for (const a of applied) {
    if (a.kind !== "war" || known.has(a.war) || colonial.has(a.war) || a.colony) continue;
    const war = next.wars.find((w) => w.id === a.war);
    if (!war || war.attackers.length !== 1 || war.defenders.length !== 1) continue;
    const [x, y] = [war.attackers[0], war.defenders[0]];
    const pair = (rebels: string, of: string) => {
      if (!born.has(rebels) && !next.countries[rebels]?.dormant) return false;
      return Object.entries(next.regions).some(([id, r]) => (r.controller === rebels || r.contested === rebels) && before.regions[id]?.owner === of);
    };
    const [rebels, of] = pair(x, y) ? [x, y] : pair(y, x) ? [y, x] : [null, null];
    if (!rebels || !of) continue;
    const how: CivilHow = next.countries[rebels]?.dormant ? "rising" : "secession";
    next.civilWars = [
      ...(next.civilWars ?? []),
      {
        war: war.id,
        of,
        rebels,
        how,
        since: war.since,
        legitimacy: { government: 50, rebels: how === "secession" ? 40 : 30 },
        recognised: [],
        ...(of === next.player && next.role?.kind !== "opposition" ? { player: "government" as const } : {}),
      },
    ];
    known.add(war.id);
  }
}

/**
 * How a civil war ends. Victory: the rebels govern the whole country under
 * its own name, their army its army; crushed: the rebels' land returns to the
 * government and their government is gone; partition: each keeps what it
 * holds, the rebels a state of their own; settlement: the country is one
 * again, the rebels' soldiers half sent home, their party in the government.
 * The player who led the rebels comes back to the country (leaveRebels); the
 * player whose government lost the country has fallen (a defeat). In place.
 */
function endCivilWar(next: GameState, cw: CivilWar, war: War | undefined, how: NonNullable<CivilWar["end"]>["how"], ctx: AdvanceContext, applied: AppliedChange[]): void {
  const gov = next.countries[cw.of];
  const reb = next.countries[cw.rebels];
  const winner = how === "victory" ? cw.rebels : cw.of;
  // The volunteers were lent: they go home before the armies are settled, less their share of their side's losses.
  for (const v of cw.volunteers ?? []) {
    const side = v.side === "rebels" ? cw.rebels : cw.of;
    if (!next.countries[v.from]?.economy || next.countries[v.from].dormant || v.from === side) continue;
    const left = next.countries[side]?.economy?.troops ?? 0;
    const record = war?.losses?.[side];
    const lost = record ? lostForGood(record) : 0;
    moveTroops(next, side, v.from, v.men * (left + lost > 0 ? left / (left + lost) : 0));
  }
  // Partition: each keeps what it holds; otherwise all of it is the country's again.
  for (const r of Object.values(next.regions)) {
    if (r.owner !== cw.of && r.owner !== cw.rebels) continue;
    if (how === "partition") {
      if ((r.controller === cw.of || r.controller === cw.rebels) && r.controller !== r.owner) {
        r.owner = r.controller;
        // Its own now: no longer land the front left behind.
        delete r.behind;
      }
      if (r.contested === cw.of || r.contested === cw.rebels) {
        delete r.contested;
        delete r.held;
        delete r.taken;
      }
      continue;
    }
    if (r.owner === cw.rebels) r.owner = cw.of;
    if (r.controller === cw.rebels) r.controller = cw.of;
    if (r.contested === cw.rebels || r.contested === cw.of) {
      delete r.contested;
      delete r.held;
      delete r.taken;
    }
    delete r.behind;
    if (r.resistance?.of === cw.rebels || r.resistance?.of === cw.of) delete r.resistance;
  }
  // Whoever fought the rebels, or for them, in this war or a war of their own: taken before the war ends.
  const fought = new Set(next.wars.filter((w) => w.attackers.includes(cw.rebels) || w.defenders.includes(cw.rebels)).flatMap((w) => [...w.attackers, ...w.defenders]));
  fought.delete(cw.of);
  fought.delete(cw.rebels);
  const live = war && next.wars.find((w) => w.id === war.id);
  if (live) {
    // Anyone else in it leaves with it: a civil war's foreign allies have nothing left to fight for.
    endWar(next, live, applied);
  }
  // Nor any land of the country to hold: what a foreign army took in the fighting goes back to the government, unless it
  // is at war with the government itself (Russia on Belarus's junta's provinces the turn the junta was crushed held a
  // country's land it was at no war with).
  if (how !== "partition") {
    for (const [id, r] of Object.entries(next.regions).sort((a, b) => a[0].localeCompare(b[0]))) {
      if (r.owner !== cw.of || r.controller === cw.of || !fought.has(r.controller) || warBetween(next, r.controller, cw.of)) continue;
      applied.push({ kind: "liberate", region: id, from: r.controller, to: cw.of });
      r.controller = cw.of;
      delete r.behind;
    }
  }
  if (how === "victory" && gov && reb) {
    // The leader who falls, taken before the rebels' leader takes the line: the person the player may stay with (engine/role.ts intoOpposition).
    const fallen = next.player === cw.of ? leaderOf(next, cw.of) : undefined;
    // The rebels' government is the country's now: its leader, its form of government, its army and weapons.
    if (reb.leader) gov.leader = reb.leader;
    else delete gov.leader;
    gov.government = reb.government;
    const base = reb.domestic ?? gov.domestic ?? { regime: "autocracy" as const, support: 50, stability: 40 };
    // A coup that won its civil war is a junta like any other: it promises a vote, and the army keeps the habit (engine/abroad.ts newJunta).
    gov.domestic = cw.how === "coup" ? { ...newJunta(base, game(next), cw.of, ctx.to), support: base.support, stability: base.stability } : { ...base, changed: { date: ctx.to, how: CHANGE_OF[cw.how] } };
    delete gov.dormant;
    delete gov.exile;
    if (gov.economy && reb.economy) gov.economy = { ...gov.economy, troops: reb.economy.troops + Math.round(gov.economy.troops * 0.3) };
    if (reb.arsenal) gov.arsenal = { ...(gov.arsenal ?? reb.arsenal), stock: reb.arsenal.stock };
    // The player's government has lost the country: a fall, after which the player chooses (engine/role.ts).
    if (next.player === cw.of && cw.player === "government" && !(next.defeat && !next.defeat.continued)) {
      const party = next.politics?.parties.find((p) => p.status === "ruling")?.name;
      next.defeat = {
        date: ctx.to,
        turn: ctx.turn,
        how: cw.how === "coup" ? "coup" : "revolution",
        by: en(reb.name),
        note: "",
        ...(fallen ? { fallen } : {}),
        ...(party ? { party } : {}),
        ...(next.politics ? { regime: next.politics.regime } : {}),
      };
      next.protests = [];
      applied.push({ kind: "overthrown", how: next.defeat.how, by: en(reb.name) });
    }
  } else if (how === "settlement" && gov?.economy && reb?.economy) {
    gov.economy = { ...gov.economy, troops: gov.economy.troops + Math.round(reb.economy.troops * 0.5) };
  } else if (how === "crushed" && gov?.economy && reb?.economy) {
    // What is left of the rebels' army is taken or goes home.
    gov.economy = { ...gov.economy, troops: gov.economy.troops + Math.round(reb.economy.troops * 0.2) };
  }
  if (how !== "partition" && reb) {
    reb.dormant = true;
    if (reb.economy) reb.economy = { ...reb.economy, troops: 0 };
    delete reb.exile;
    for (const a of next.alliances) a.members = a.members.filter((m) => m !== cw.rebels);
    next.alliances = next.alliances.filter((a) => a.members.length >= 2);
    for (const p of next.plans ?? []) if (!p.end && (p.by === cw.rebels || p.target === cw.rebels)) p.end = { date: ctx.to, turn: ctx.turn, how: "failed", why: "target-gone" };
  }
  if (how === "partition" && reb?.dormant) delete reb.dormant;
  if (next.player === cw.rebels && how !== "partition") leaveRebels(next, cw, how === "victory" ? "victory" : how === "settlement" ? "settlement" : "crushed", ctx.to);
  cw.end = { date: ctx.to, turn: ctx.turn, how };
  applied.push({ kind: "civil", war: cw.war, country: cw.of, rebels: cw.rebels, change: how, ...(how === "victory" ? { side: "rebels" as const } : how === "crushed" ? { side: "government" as const } : {}), by: winner });
}

/**
 * The civil wars a date begins with (WarSeed.civil), recorded as civil wars when the game begins – or when a save from
 * before is opened – while the war goes on and has none yet: China's of 1933 and 1950, Laos's, Cambodia's, Angola's,
 * Afghanistan's. Returns the records to add.
 */
export function seedCivilWars(state: Pick<GameState, "wars" | "countries" | "player" | "date" | "civilWars"> & Partial<Pick<GameState, "role">>, seeds: readonly WarSeed[]): CivilWar[] {
  const known = new Set((state.civilWars ?? []).map((c) => c.war));
  const out: CivilWar[] = [];
  for (const seed of seeds) {
    const c = seed.civil;
    const war = state.wars.find((w) => w.id === seed.id);
    if (!c || !war || known.has(war.id) || !state.countries[c.of] || !state.countries[c.rebels]) continue;
    const inWar = (t: string) => war.attackers.includes(t) || war.defenders.includes(t);
    if (!inWar(c.of) || !inWar(c.rebels)) continue;
    out.push({
      war: war.id,
      of: c.of,
      rebels: c.rebels,
      how: c.how,
      since: war.since,
      legitimacy: c.legitimacy ?? { government: 50, rebels: c.how === "secession" ? 40 : 30 },
      recognised: [],
      still: state.date,
      seeded: true,
      ...(c.of === state.player && state.role?.kind !== "opposition" ? { player: "government" as const } : c.rebels === state.player ? { player: "rebels" as const } : {}),
    });
  }
  return out;
}

/** The civil wars for the game master, under WARS: one line each. */
export function civilWarLine(state: GameState, war: War, map: Record<string, MapRegion> | null): string {
  const cw = (state.civilWars ?? []).find((c) => c.war === war.id && !c.end);
  if (!cw) return "";
  const hold = civilHold(state, cw, map);
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const parts = [
    `civil war: ${cw.rebels} (the rebels: ${cw.how === "coup" ? "a coup that half succeeded" : cw.how === "revolution" ? "a revolution the army did not all follow" : cw.how === "secession" ? "a secession" : "a rising"}, since ${cw.since}) against the government of ${cw.of}`,
    `the rebels hold ${pct(hold.rebels)} of the country's people${hold.capital ? `, the ${hold.capital} its largest town` : ""}`,
    `legitimacy government ${cw.legitimacy.government}, rebels ${cw.legitimacy.rebels}`,
    cw.recognised.length ? `the rebels recognised by ${cw.recognised.join(", ")}${cw.seat ? "; they hold the world body's seat" : ""}` : "no government recognises the rebels",
    ...(cw.volunteers?.length ? [`volunteers: ${cw.volunteers.map((v) => `${v.from} ${Math.round(v.men)}k (${v.side})`).join(", ")}`] : []),
    ...(cw.defected && (cw.defected.rebels || cw.defected.government || cw.defected.regions) ? [`went over: ${Math.round(cw.defected.rebels)}k soldiers to the rebels, ${Math.round(cw.defected.government)}k to the government, ${cw.defected.regions} provinces`] : []),
    ...(cw.player ? [`the player is the ${cw.player === "rebels" ? "rebels' government" : "government"}`] : []),
  ];
  return `    ${parts.join("; ")}`;
}

/** The rule for the game master on civil wars. */
export const CIVIL_WAR_RULE =
  "- Civil wars (WARS: the \"civil war\" lines) are kept by the engine: which regions and soldiers went over, legitimacy, recognition, volunteers and how they end. Tell them – the rebels' government, its leader (name the leader of a rebels' government that has none in \"leaders\"), the defections, the foreign volunteers – and end one in warsEnded only when its two sides really make peace; the engine decides whether that is a partition or a settlement.";

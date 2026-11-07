import { yearOf } from "./calendar";
import { byYear } from "./doctrine";
import { ARMY_SECRECY, estimate, fogOn, knowledgeOf, type Estimate } from "./fog";
import { bombing, countOf } from "./forces";
import { countsFor } from "./occupation";
import { FRONT_LOSS_PER_MONTH, peopleIn } from "./population";
import { distanceKm } from "./provinces";
import { provisionBooks, provisionOf } from "./provision";
import type { AppliedChange, CivilCause, CivilLosses, GameState, MapRegion, War } from "./types";
import { CIVIL_CAUSES } from "./types";

/**
 * What a war costs the people, beside the soldiers. Each period the engine
 * counts the civilians a war kills and drives from their homes, province by
 * province, by the war's means and its era, and keeps them per war and
 * country (War.civilians) beside the soldiers' record (War.losses):
 *
 * - bombing: the enemy's strategic bombers reach the land a country holds
 *   within their range of the enemy's own (BOMB_RANGE: a few hundred
 *   kilometres in 1915–18, a thousand in 1940, the whole world once there are
 *   jet bombers and missiles); the share of its output they take there
 *   (engine/forces.ts bombing, at most 3% a year) kills its people at the
 *   era's lethality – the Zeppelins and Gothas, the area bombing of 1940–45
 *   (the Blitz, Hamburg, Tokyo), Korea and Vietnam, precision weapons since
 *   the 1990s (BOMB_LETHAL) – the towns the most;
 * - a siege: a town of SIEGE_TOWN thousand or more cut off from the main body
 *   of its side's land (a pocket), or whose land neighbours are three
 *   quarters or more the enemy's or fought over by it (a corridor, as
 *   Leningrad's across Lake Ladoga once Shlisselburg fell); the shells
 *   kill from the first day and, once its stores are gone (STORES months of
 *   the line standing), hunger – Leningrad's first winter, Mariupol's
 *   shelling (SIEGE_*); a pocket on the coast is hardly besieged while its
 *   side's fleet holds the sea (the Kerch strait), and is while the enemy's does;
 * - occupation: land an enemy holds behind the front loses people to
 *   reprisals, hunger and forced labour, more where its people resist
 *   (OCCUPATION_*);
 * - the fighting: a province the front runs through loses people to the
 *   fighting in its streets (FIGHTING), and drives a share of them out
 *   (engine/population.ts FRONT_LOSS_PER_MONTH, recorded here as fled);
 * - famine: a country at war whose people's food (engine/provision.ts) falls
 *   below FED loses people to hunger, the more the deeper it falls (FAMINE).
 *
 * The dead leave their provinces here; the game master's own figure for a
 * country's dead (`population`) is read against them, not added on top. They
 * reach the country's cohorts once (engine/society.ts, from the record's
 * growth), and the game master is told the toll. Mass crimes – deportations,
 * massacres, famines made by policy – are not the war's toll but their
 * perpetrators' (engine/repressions.ts), recorded apart and never counted here.
 * Pure, without dice.
 */

/** Share of the people within the bombers' reach killed a year for each unit of the bombing's damage (the share of output it takes a year), by year. */
const BOMB_LETHAL: [number, number][] = [
  [1914, 0.004],
  [1918, 0.012],
  [1936, 0.035],
  [1939, 0.045],
  [1941, 0.065],
  [1943, 0.09],
  [1945, 0.1],
  [1953, 0.07],
  [1972, 0.05],
  [1990, 0.015],
  [2000, 0.008],
  [2025, 0.006],
];
/** How far from the enemy's own land its bombers reach, km, by year. */
const BOMB_RANGE: [number, number][] = [
  [1914, 300],
  [1916, 650],
  [1918, 800],
  [1936, 900],
  [1940, 1100],
  [1944, 2500],
  [1955, 8000],
  [1965, 20000],
];
/** The most of the reached people bombing kills in a month. */
const BOMB_CAP_MONTH = 0.004;

/** A siege's toll a month on a sealed town's people: the shells, and hunger once the stores are eaten. */
const SIEGE_SHELLING: [number, number][] = [
  [1914, 0.001],
  [1940, 0.003],
  [1990, 0.003],
  [2025, 0.002],
];
const SIEGE_HUNGER: [number, number][] = [
  [1914, 0.025],
  [1941, 0.04],
  [1945, 0.035],
  [1955, 0.015],
  [1990, 0.003],
  [2025, 0.0015],
];
/** Months of standing line a besieged town's stores last. */
const STORES = 3;
/** A town in its side's main body is besieged once this share of its land neighbours is the enemy's (or fought over by it): two fifths sealed then, wholly at all of them. */
const CORRIDOR = 0.75;
/** The smallest town besieged, thousands of people. */
const SIEGE_TOWN = 50;
/** What the sea brings a pocket on the coast its side's fleet keeps open: its toll is cut by this much. */
const BY_SEA = 0.85;

/** Occupation's toll a year: reprisals, hunger and forced labour, and on top of it as the people's resistance (0–100) grows. */
const OCCUPATION_BASE: [number, number][] = [
  [1914, 0.002],
  [1939, 0.004],
  [1946, 0.002],
  [1990, 0.0005],
  [2025, 0.0003],
];
const OCCUPATION_RESIST: [number, number][] = [
  [1914, 0.006],
  [1939, 0.02],
  [1946, 0.01],
  [1990, 0.003],
  [2025, 0.0025],
];

/** A month's toll of the fighting on a province the front runs through. */
const FIGHTING: [number, number][] = [
  [1914, 0.0003],
  [1939, 0.0015],
  [1946, 0.001],
  [1990, 0.0004],
  [2025, 0.0003],
];

/** Hunger's toll a year at the worst, by year; food at FED or more costs nothing, at STARVING it costs the worst. */
const FAMINE: [number, number][] = [
  [1914, 0.05],
  [1946, 0.05],
  [1960, 0.03],
  [1990, 0.012],
  [2025, 0.01],
];
const FED = 0.85;
const STARVING = 0.3;

/** The most of a province's people one period's toll takes. */
const MOST = 0.5;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round3 = (v: number) => Math.round(v * 1000) / 1000;
/** A rate a month (or a year) over a period. */
const over = (rate: number, n: number) => 1 - (1 - clamp(rate, 0, 1)) ** Math.max(0, n);

/** One country's toll in one war this period, thousands. */
export interface CivilPart {
  by: Partial<Record<CivilCause, number>>;
  fled: number;
}

/** The period's toll: by war and country, each province's dead, and each country's dead in all its wars. */
export interface CivilToll {
  wars: Map<string, Map<string, CivilPart>>;
  dead: Map<string, number>;
  byCountry: Map<string, number>;
}

/** The wars fought this period: all but one under a truce all through it. */
/** The wars fought this period: the state's after it, and those that ended in it – fought until they ended – but for one under a truce all through. */
const foughtWars = (before: Pick<GameState, "wars">, next: Pick<GameState, "wars">): War[] => {
  const now = new Set(next.wars.map((w) => w.id));
  return [...next.wars.filter((w) => !(w.truce && before.wars.find((x) => x.id === w.id)?.truce)), ...before.wars.filter((w) => !now.has(w.id) && !w.truce)];
};

/**
 * The besieged towns: for each country at war, the parts of the land it holds
 * cut off from its main body that touch the enemy (pockets), and the towns of
 * its main body three quarters or more surrounded by the enemy (corridors), each
 * with how sealed it is (0–1) and the war it is besieged in.
 */
export function sieges(
  state: Pick<GameState, "regions">,
  enemiesOf: Map<string, Map<string, War>>,
  map: Record<string, MapRegion>,
  neighbors: Record<string, string[]>,
  commandsSea: (tag: string, war: War) => boolean = () => false,
): Map<string, { seal: number; war: War }> {
  const out = new Map<string, { seal: number; war: War }>();
  const enemyAt = (enemies: Map<string, War>, id: string): War | undefined => {
    const x = state.regions[id];
    return x ? (enemies.get(x.controller) ?? (x.contested ? enemies.get(x.contested) : undefined)) : undefined;
  };
  const byHolder = new Map<string, string[]>();
  for (const [id, r] of Object.entries(state.regions)) if (map[id] && enemiesOf.has(r.controller)) (byHolder.get(r.controller) ?? byHolder.set(r.controller, []).get(r.controller)!).push(id);
  for (const [tag, enemies] of enemiesOf) {
    const held = byHolder.get(tag) ?? [];
    if (!held.length) continue;
    // The land it holds in pieces joined by land.
    const part = new Map<string, number>();
    const people: number[] = [];
    for (const id of held) {
      if (part.has(id)) continue;
      const n = people.length;
      people.push(0);
      const queue = [id];
      part.set(id, n);
      while (queue.length) {
        const cur = queue.pop()!;
        people[n] += peopleIn(state.regions[cur], map[cur]);
        for (const nb of neighbors[cur] ?? []) if (!part.has(nb) && state.regions[nb]?.controller === tag && map[nb]) {
          part.set(nb, n);
          queue.push(nb);
        }
      }
    }
    const main = people.indexOf(Math.max(...people));
    // A piece is a pocket only where the enemy holds all the land around it: an island, a colony overseas, a piece
    // next to a neutral or an ally is not cut off.
    const ringed = new Map<number, boolean>();
    for (const id of held) {
      const n = part.get(id)!;
      if (n === main || ringed.get(n) === false) continue;
      for (const nb of neighbors[id] ?? []) {
        if (!state.regions[nb] || !map[nb] || part.get(nb) === n) continue;
        const ok = Boolean(enemyAt(enemies, nb));
        ringed.set(n, (ringed.get(n) ?? true) && ok);
        if (!ok) break;
      }
    }
    for (const id of held) {
      if (peopleIn(state.regions[id], map[id]) < SIEGE_TOWN) continue;
      const around = (neighbors[id] ?? []).filter((n) => state.regions[n] && map[n]);
      if (!around.length) continue;
      const hostile = around.map((n) => enemyAt(enemies, n)).filter((w): w is War => Boolean(w));
      if (!hostile.length) continue;
      const ring = hostile.length / around.length;
      // A pocket on the coast its side's fleet keeps open is hardly besieged; one the enemy's fleet closes is.
      if (part.get(id) !== main && ringed.get(part.get(id)!)) out.set(id, { seal: map[id].coastal ? (commandsSea(tag, hostile[0]) ? 1 - BY_SEA : 0.8) : 1, war: hostile[0] });
      else if (ring >= CORRIDOR - 1e-9) out.set(id, { seal: clamp(0.4 + 2.4 * (ring - CORRIDOR), 0.4, 1), war: hostile[0] });
    }
  }
  return out;
}

/**
 * What the period's wars cost the people (see above), read from the state
 * before the turn (the arsenals, how long the lines have stood) and after
 * its borders moved (who holds what). Nothing is changed.
 */
export function civilianToll(before: GameState, next: GameState, map: Record<string, MapRegion>, neighbors: Record<string, string[]> | null, years: number): CivilToll {
  const out: CivilToll = { wars: new Map(), dead: new Map(), byCountry: new Map() };
  const wars = foughtWars(before, next);
  if (!wars.length || years <= 0) return out;
  const months = years * 12;
  const year = yearOf(next.date);
  const enemiesOf = new Map<string, Map<string, War>>();
  for (const w of wars) {
    for (const [mine, theirs] of [
      [w.attackers, w.defenders],
      [w.defenders, w.attackers],
    ]) {
      for (const t of mine) {
        const m = enemiesOf.get(t) ?? new Map<string, War>();
        for (const e of theirs) if (!m.has(e)) m.set(e, w);
        enemiesOf.set(t, m);
      }
    }
  }
  const warOf = (a: string, b: string | undefined) => (b ? enemiesOf.get(a)?.get(b) : undefined);
  const people = (id: string) => Math.max(0, peopleIn(next.regions[id], map[id]) - (out.dead.get(id) ?? 0));
  const book = (war: War, country: string, cause: CivilCause | "fled", id: string | null, n: number) => {
    if (!(n > 0)) return;
    let n2 = n;
    if (id && cause !== "fled") {
      // Never more than most of a province's people in one period.
      const room = peopleIn(next.regions[id], map[id]) * MOST - (out.dead.get(id) ?? 0);
      n2 = Math.max(0, Math.min(n, room));
      if (n2 <= 0) return;
      out.dead.set(id, (out.dead.get(id) ?? 0) + n2);
    }
    const byWar = out.wars.get(war.id) ?? new Map<string, CivilPart>();
    const part = byWar.get(country) ?? { by: {}, fled: 0 };
    if (cause === "fled") part.fled += n2;
    else {
      part.by[cause] = (part.by[cause] ?? 0) + n2;
      out.byCountry.set(country, (out.byCountry.get(country) ?? 0) + n2);
    }
    byWar.set(country, part);
    out.wars.set(war.id, byWar);
  };

  // Whose fleet holds the sea around a pocket: ships weighed by their technology, side against side.
  const fleet = (tag: string) => {
    const s = before.countries[tag]?.arsenal?.stock?.ships;
    return s ? s.n * 2 ** (s.level - 2) : 0;
  };
  const commandsSea = (tag: string, war: War) => {
    const mine = war.attackers.includes(tag) ? war.attackers : war.defenders;
    const theirs = mine === war.attackers ? war.defenders : war.attackers;
    return mine.reduce((s, t) => s + fleet(t), 0) > theirs.reduce((s, t) => s + fleet(t), 0);
  };
  const besieged = neighbors ? sieges(next, enemiesOf, map, neighbors, commandsSea) : new Map<string, { seal: number; war: War }>();
  for (const [id, r] of Object.entries(next.regions)) {
    const p = map[id];
    if (!p) continue;
    const pop = peopleIn(r, p);
    if (pop <= 0) continue;
    // The fighting in the province's streets, and the people it drives out (engine/population.ts takes them).
    const front = warOf(r.controller, r.contested);
    if (front) {
      book(front, r.owner, "fighting", id, pop * over(byYear(FIGHTING, year), months));
      book(front, r.owner, "fled", null, people(id) * Math.min(1, FRONT_LOSS_PER_MONTH * months));
    }
    // A siege: the shells from the first day, hunger once the stores are eaten.
    const siege = besieged.get(id);
    if (siege) {
      const stood = before.regions[id]?.dug ?? 0;
      // The stores run out over the period: hunger for the part of it that comes after them.
      const hungry = clamp((stood + months - STORES) / Math.max(months, 1e-6), 0, 1);
      const monthly = siege.seal * (byYear(SIEGE_SHELLING, year) + byYear(SIEGE_HUNGER, year) * hungry);
      book(siege.war, r.owner, "siege", id, pop * over(monthly, months));
    }
    // Occupation behind the front: reprisals, hunger, forced labour, the more where people resist.
    if (r.controller !== r.owner && !r.contested) {
      const war = warOf(r.controller, r.owner);
      if (war) {
        const rate = byYear(OCCUPATION_BASE, year) + (byYear(OCCUPATION_RESIST, year) * clamp(r.resistance?.level ?? 0, 0, 100)) / 100;
        book(war, r.owner, "occupation", id, people(id) * over(rate, years));
      }
    }
  }

  // A war that ended in the turn was fought on its line until it ended: the peace gave its fronts and occupations back before
  // the period was out, so they are read as the period found them.
  const now = new Set(next.wars.map((w) => w.id));
  const ended = wars.filter((w) => !now.has(w.id));
  if (ended.length) {
    const across = (w: War, a: string, b: string | undefined) => Boolean(b) && ((w.attackers.includes(a) && w.defenders.includes(b!)) || (w.defenders.includes(a) && w.attackers.includes(b!)));
    for (const [id, b] of Object.entries(before.regions)) {
      const p = map[id];
      if (!p || !next.regions[id]) continue;
      const pop = peopleIn(next.regions[id], p);
      if (pop <= 0) continue;
      const front = ended.find((w) => across(w, b.controller, b.contested));
      if (front) book(front, b.owner, "fighting", id, pop * over(byYear(FIGHTING, year), months));
      else if (b.controller !== b.owner && !b.contested) {
        const war = ended.find((w) => across(w, b.controller, b.owner));
        if (war) book(war, b.owner, "occupation", id, people(id) * over(byYear(OCCUPATION_BASE, year) + (byYear(OCCUPATION_RESIST, year) * clamp(b.resistance?.level ?? 0, 0, 100)) / 100, years));
      }
    }
  }

  // Bombing: the land each country holds within its enemies' reach, by its people – the towns the most.
  const range = byYear(BOMB_RANGE, year);
  const at = (id: string) => map[id]?.at;
  const holdersOf = new Map<string, [number, number][]>();
  const heldBy = new Map<string, string[]>();
  for (const [id, r] of Object.entries(next.regions)) {
    const c = at(id);
    if (!c) continue;
    (holdersOf.get(r.controller) ?? holdersOf.set(r.controller, []).get(r.controller)!).push(c);
    if (enemiesOf.has(r.controller)) (heldBy.get(r.controller) ?? heldBy.set(r.controller, []).get(r.controller)!).push(id);
  }
  const reached = new Map<string, { ids: string[]; people: number }>();
  for (const [tag, theirs] of enemiesOf) {
    const points = [...theirs.keys()].flatMap((e) => holdersOf.get(e) ?? []);
    if (!points.length) continue;
    const h = { ids: [] as string[], people: 0 };
    for (const id of heldBy.get(tag) ?? []) {
      const c = at(id)!;
      if (range < 15000 && !points.some((q) => Math.abs(q[1] - c[1]) * 111 <= range && distanceKm(c, q) <= range)) continue;
      h.ids.push(id);
      h.people += people(id);
    }
    if (h.people > 0) reached.set(tag, h);
  }
  const bombed = bombing(before, new Map([...reached].map(([tag, h]) => [tag, { people: h.people }])));
  const bombers = (tag: string) => countOf(before.countries[tag]?.arsenal?.stock, "bomber", year);
  for (const [tag, damage] of bombed) {
    const h = reached.get(tag);
    const theirs = enemiesOf.get(tag);
    if (!h || !theirs) continue;
    const toll = h.people * Math.min(BOMB_CAP_MONTH * months, over(damage * byYear(BOMB_LETHAL, year), years));
    if (toll <= 0) continue;
    // Each war's part by the enemies' bombers in it; the towns take the most of it (people to the power 1.3).
    const weights = new Map<War, number>();
    for (const [e, w] of theirs) weights.set(w, (weights.get(w) ?? 0) + bombers(e));
    const sum = [...weights.values()].reduce((s, v) => s + v, 0);
    const town = (id: string) => people(id) ** 1.3;
    const towns = h.ids.reduce((s, id) => s + town(id), 0);
    if (towns <= 0) continue;
    for (const [w, weight] of weights) {
      const share = sum > 0 ? weight / sum : 1 / weights.size;
      if (share <= 0) continue;
      for (const id of h.ids) {
        const n = town(id);
        if (n > 0) book(w, next.regions[id].owner, "bombing", id, (toll * share * n) / towns);
      }
    }
  }

  // Famine: a country at war whose people's food has fallen short, across the land it holds but the besieged towns – read
  // only where it may be short: its imports cut, or much of its land in the enemy's hands.
  const lostLand = new Map<string, { own: number; held: number }>();
  for (const [id, r] of Object.entries(next.regions)) {
    if (!enemiesOf.has(r.owner) || !map[id]) continue;
    const l = lostLand.get(r.owner) ?? { own: 0, held: 0 };
    const n = peopleIn(r, map[id]);
    l.own += n;
    if (r.controller === r.owner) l.held += n;
    lostLand.set(r.owner, l);
  }
  const atWar = [...enemiesOf.keys()].filter((tag) => {
    const e = next.countries[tag]?.economy;
    const l = lostLand.get(tag);
    return e && !next.countries[tag].dormant && (e.tradeCut >= 0.05 || (l !== undefined && l.held < 0.85 * l.own));
  });
  if (atWar.length) {
    const books = provisionBooks(next, map);
    const lands = new Map<string, string[]>();
    for (const [id, r] of Object.entries(next.regions)) if (map[id] && !besieged.has(id)) (lands.get(countsFor(r)) ?? lands.set(countsFor(r), []).get(countsFor(r))!).push(id);
    for (const tag of atWar) {
      const food = provisionOf(next, tag, map, books)?.lines.find((l) => l.kind === "food")?.level;
      if (food === undefined) continue;
      const short = clamp((FED - food / 100) / (FED - STARVING), 0, 1);
      if (short <= 0) continue;
      const rate = byYear(FAMINE, year) * short * short;
      const war = [...(enemiesOf.get(tag)?.values() ?? [])][0];
      if (!war) continue;
      for (const id of lands.get(tag) ?? []) book(war, tag, "famine", id, people(id) * over(rate, years));
    }
  }
  return out;
}

/**
 * The period's toll lands: the dead leave their provinces, each war keeps
 * what it cost each country's people beside the soldiers, with the turn's
 * part, and the report gets a line per war and country hit. In place.
 */
export function applyCivilians(next: GameState, toll: CivilToll, map: Record<string, MapRegion>, applied: AppliedChange[]): void {
  for (const [id, dead] of toll.dead) {
    const r = next.regions[id];
    if (!r || dead <= 0) continue;
    r.pop = Math.max(0, Math.round((peopleIn(r, map[id]) - dead) * 10) / 10);
  }
  for (const war of next.wars) {
    const parts = toll.wars.get(war.id);
    if (!parts) continue;
    for (const [country, part] of [...parts].sort((a, b) => a[0].localeCompare(b[0]))) {
      const dead = Object.values(part.by).reduce((s, v) => s + (v ?? 0), 0);
      if (dead <= 0 && part.fled <= 0) continue;
      const had: CivilLosses | undefined = war.civilians?.[country];
      const by: Partial<Record<CivilCause, number>> = { ...(had?.by ?? {}) };
      for (const cause of CIVIL_CAUSES) if ((part.by[cause] ?? 0) > 0) by[cause] = round3((by[cause] ?? 0) + part.by[cause]!);
      war.civilians = {
        ...war.civilians,
        [country]: {
          dead: round3((had?.dead ?? 0) + dead),
          fled: round3((had?.fled ?? 0) + part.fled),
          ...(Object.keys(by).length ? { by } : {}),
          last: { turn: next.turn, dead: round3(dead), fled: round3(part.fled) },
        },
      };
      // A line for the report where the turn's toll is worth one: a few hundred dead, or thousands who fled.
      if (dead >= 0.3 || part.fled >= 5) {
        const cause = CIVIL_CAUSES.reduce((best, c) => ((part.by[c] ?? 0) > (part.by[best] ?? 0) ? c : best), "fighting" as CivilCause);
        applied.push({ kind: "civilians", country, war: war.id, dead: Math.round(dead * 10) / 10, fled: Math.round(part.fled), cause });
      }
    }
  }
}

/**
 * A nuclear strike's dead join the war's record of its civilians, under their own cause: the gravest toll of a war is
 * told with the rest (engine/atom.ts, engine/nuclear.ts). Their people have left the province already. Mutates `next`.
 */
export function bookStrike(next: GameState, striker: string, region: string, dead: number): void {
  const r = next.regions[region];
  if (!r || !(dead > 0)) return;
  const country = r.owner;
  const war = next.wars.find((w) => (w.attackers.includes(striker) && (w.defenders.includes(country) || w.defenders.includes(r.controller))) || (w.defenders.includes(striker) && (w.attackers.includes(country) || w.attackers.includes(r.controller))));
  if (!war) return;
  const had: CivilLosses | undefined = war.civilians?.[country];
  const last = had?.last?.turn === next.turn ? had.last : { turn: next.turn, dead: 0, fled: 0 };
  war.civilians = {
    ...war.civilians,
    [country]: {
      dead: round3((had?.dead ?? 0) + dead),
      fled: had?.fled ?? 0,
      by: { ...(had?.by ?? {}), nuclear: round3((had?.by?.nuclear ?? 0) + dead) },
      last: { ...last, dead: round3(last.dead + dead) },
    },
  };
}

/** A side's civilian losses as the player's government knows them: its own exactly, the others' as its intelligence estimates them (engine/fog.ts). */
export interface CiviliansView {
  dead: Estimate;
  fled: Estimate;
  turn?: { dead: Estimate; fled: Estimate };
}

export function civiliansView(state: GameState, war: War, country: string): CiviliansView | null {
  const l = war.civilians?.[country];
  if (!l || (l.dead <= 0 && l.fled <= 0)) return null;
  const exact = (n: number): Estimate => ({ value: n, low: n, high: n, exact: true });
  const last = l.last && l.last.turn === state.chronicle.at(-1)?.turn ? l.last : undefined;
  if (country === state.player || !fogOn(state)) return { dead: exact(l.dead), fled: exact(l.fled), ...(last ? { turn: { dead: exact(last.dead), fled: exact(last.fled) } } : {}) };
  const score = knowledgeOf(state, country).score - ARMY_SECRECY;
  const key = `civilians:${war.id}:${country}`;
  return {
    dead: estimate(l.dead, score, state, `${key}:dead`),
    fled: estimate(l.fled, score, state, `${key}:fled`),
    ...(last ? { turn: { dead: estimate(last.dead, score, state, `${key}:turn:${last.turn}:dead`), fled: estimate(last.fled, score, state, `${key}:turn:${last.turn}:fled`) } } : {}),
  };
}

/** A war's civilian toll for the prompt: " | civilians so far (thousands dead/fled): poland 120/400 (bombing 30, siege 60)". */
export function civiliansLine(war: War): string {
  const entries = Object.entries(war.civilians ?? {}).filter(([, l]) => l.dead >= 0.05 || l.fled >= 0.5);
  if (!entries.length) return "";
  const one = (n: number) => (n >= 10 ? Math.round(n) : Math.round(n * 10) / 10);
  const causes = (l: CivilLosses) =>
    CIVIL_CAUSES.filter((c) => (l.by?.[c] ?? 0) >= 0.05)
      .map((c) => `${c} ${one(l.by![c]!)}`)
      .join(", ");
  return ` | civilians so far (thousands dead/fled): ${entries.map(([c, l]) => `${c} ${one(l.dead)}/${one(l.fled)}${causes(l) ? ` (${causes(l)})` : ""}`).join(", ")}`;
}

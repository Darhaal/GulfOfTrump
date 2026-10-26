import { z } from "zod";
import { combatPower } from "./arsenal";
import { ARMY_SECRECY, estimate, fogOn, knowledgeOf, type Estimate } from "./fog";
import { frontStrength } from "./fronts";
import type { GameState, MapIndex, War, WarLosses, WeaponKind } from "./types";

/**
 * What each war has cost its sides: soldiers killed and wounded, and weapons
 * lost, since it began. The turn's game master reports a period's dead and
 * wounded by war and side (`warLosses`); the engine keeps them within what
 * the armies and the fighting allow and works out the rest itself, as it
 * does for weapons (engine/arsenal.ts), whose losses it splits between a
 * country's wars. It is the war's own record: soldiers and people still
 * follow the economy and population fields, which already count the dead.
 *
 * The engine's own figures follow the fighting, province by province
 * (warExchange): where the front ran this period, each side loses about
 * K × √(its strength × the enemy's) a month – an even fight costs both the
 * same, a strong side meeting a weak one loses a small share of what it sent
 * and the weak side a large share of its own. The side advancing pays more
 * while it grinds and less once the defence breaks; the side giving ground
 * pays little while it holds and far more in a rout, when prisoners outnumber
 * the dead. Each member loses its part of what it brought there – soldiers
 * and weapons in proportion, tanks and drones most exposed – and never more
 * than it had engaged. The game master's figures may exceed the engine's
 * threefold, no more.
 */

const tag = z.string().trim().min(1).max(80);

/** The game master's word on a period's losses (merged into OutcomeSchema as `warLosses`): thousands of soldiers. */
export const warLossesField = z
  .array(
    z.object({
      war: z.string().trim().min(1).max(300),
      country: tag,
      killed: z.number().finite().min(0),
      wounded: z.number().finite().min(0).optional().catch(undefined),
    }),
  )
  .max(24)
  .catch([])
  .default([]);

export type WarLossWord = z.infer<typeof warLossesField>[number];

/** A period's losses checked against the state: the war by its id, within what a period of fighting can take. */
export interface WarLossEntry {
  war: string;
  country: string;
  killed: number;
  wounded?: number;
}

/** Share of a side's soldiers killed in a month of the hardest fighting: the most the game master may report. */
export const MAX_KILLED_MONTH = 0.05;
/** Share killed in a month of the heaviest fighting along a whole front, the engine's own figure: about the great wars' rate. */
const KILLED_MONTH = 0.01;
/** At war with no land front of its own: losses at sea and in the air, a small share of the land fighting's. */
const NO_FRONT = 0.03;
/** Wounded for every soldier killed, when the game master gives no figure; and the most it may give. */
export const WOUNDED_PER_KILLED = 3;
const MAX_WOUNDED_PER_KILLED = 5;
/** Under a truce: the most of a fighting period's losses the game master may still report (skirmishes, mines, snipers). */
const TRUCE_SHARE = 0.1;

/** Thousands to the nearest soldier. */
const round2 = (n: number) => Math.round(n * 1000) / 1000;

/** Losses a month where the front runs, in strength: K × √(mine × theirs), the weaker counted at no less than a sixteenth of the stronger. */
const K = 0.03;
const MAX_RATIO = 16;
/** How the fighting's tempo – the points of a province the advancing side gains a month, against TEMPO – shifts the losses: grinding forward costs the attacker twice the base, holding costs the defender 0.7; in a pursuit the attacker pays 0.4 and the side in rout 2.5, and PRISONERS × tempo² times its losses again in men taken. */
const TEMPO = 60;
const GRIND = { advancing: 2, holding: 0.7 } as const;
const ROUT = { advancing: 0.4, routed: 2.5 } as const;
const PRISONERS = 4;
/** The most of what it engaged a side can lose in a month, prisoners included. */
const MAX_LOST_MONTH = 0.65;
/** Of the soldiers put out of action, the share killed; the rest are wounded. */
const KILLED_SHARE = 1 / (1 + WOUNDED_PER_KILLED);
/** How exposed each kind of weapon is in the fighting, against the soldiers: tanks and drones most, ships hardly at all on land. */
const EXPOSURE: Record<WeaponKind, number> = { rifles: 0.5, artillery: 0.6, tanks: 1.5, aircraft: 0.4, ships: 0.05, airDefence: 0.5, drones: 3 };
/** The weapons left behind in a rout, against the men taken prisoner. */
const ABANDONED = 0.5;
/** How far the game master's figures may exceed the engine's; and what it may report beyond them where the engine saw no fighting, a share of what was engaged a month. */
export const LOSS_SLACK = 3;
const QUIET_SHARE = 0.01;

const sideOf = (war: Pick<War, "attackers" | "defenders">, country: string) => (war.attackers.includes(country) ? war.attackers : war.defenders.includes(country) ? war.defenders : null);
const enemiesIn = (war: Pick<War, "attackers" | "defenders">, country: string) => (war.attackers.includes(country) ? war.defenders : war.defenders.includes(country) ? war.attackers : []);

/** Provinces where a country fights the enemies of one war: contested by it, or held by it and contested by them. */
export function warFrontsOf(state: Pick<GameState, "regions">, war: Pick<War, "attackers" | "defenders">, country: string): number {
  const enemies = new Set(enemiesIn(war, country));
  let n = 0;
  for (const r of Object.values(state.regions)) {
    if (!r.contested) continue;
    if ((r.contested === country && enemies.has(r.controller)) || (r.controller === country && enemies.has(r.contested))) n += 1;
  }
  return n;
}

/** The wars a country fights this period, a truce aside. */
const fighting = (state: Pick<GameState, "wars">, country: string) => state.wars.filter((w) => !w.truce && sideOf(w, country));

/** The share of a country's soldiers that one war takes: by its fronts in each war it fights, evenly where it has none. */
function troopShare(state: Pick<GameState, "wars" | "regions">, war: War, country: string): number {
  const wars = fighting(state, country);
  if (wars.length <= 1) return 1;
  const fronts = wars.map((w) => warFrontsOf(state, w, country));
  const total = fronts.reduce((a, b) => a + b, 0);
  if (!total) return 1 / wars.length;
  const mine = fronts[wars.findIndex((w) => w.id === war.id)] ?? 0;
  return Math.max(0.1, mine / total);
}

/** What the engine expects a war to cost a country this period, thousands of soldiers, before the game master's word. */
export function expectedWarLosses(state: Pick<GameState, "countries" | "regions" | "wars" | "date">, war: War, country: string, years: number): { killed: number; wounded: number } {
  const troops = state.countries[country]?.economy?.troops ?? 0;
  if (war.truce || troops <= 0 || !sideOf(war, country)) return { killed: 0, wounded: 0 };
  const fronts = warFrontsOf(state, war, country);
  const intensity = fronts ? Math.min(1, 0.25 + fronts / 8) : NO_FRONT;
  const mine = Math.max(1, combatPower(state, country));
  const theirs = enemiesIn(war, country).reduce((sum, e) => sum + combatPower(state, e), 0);
  const factor = Math.min(1.6, Math.max(0.6, Math.sqrt(theirs / mine)));
  const killed = troops * troopShare(state, war, country) * KILLED_MONTH * intensity * factor * years * 12;
  return { killed: round2(killed), wounded: round2(killed * WOUNDED_PER_KILLED) };
}

/** At war with no fighting of its own this period: the losses at sea and in the air, a small share of what land fighting costs. */
export function quietWarLosses(state: Pick<GameState, "countries" | "regions" | "wars" | "date">, war: War, country: string, years: number): { killed: number; wounded: number } {
  const troops = state.countries[country]?.economy?.troops ?? 0;
  if (war.truce || troops <= 0 || !sideOf(war, country)) return { killed: 0, wounded: 0 };
  const killed = troops * troopShare(state, war, country) * KILLED_MONTH * NO_FRONT * years * 12;
  return { killed: round2(killed), wounded: round2(killed * WOUNDED_PER_KILLED) };
}

/** What a period's fighting cost one country in one war, thousands of soldiers and weapons in pieces (rifles in thousands); `engaged`, the soldiers it had in the fighting. */
export interface Casualties {
  killed: number;
  wounded: number;
  captured: number;
  arms: Partial<Record<WeaponKind, number>>;
  engaged: number;
}

/** A period's fighting in every war: each country's casualties by war, its weapons lost in all its wars, and the share of its army that fought. */
export interface Exchange {
  wars: Map<string, Map<string, Casualties>>;
  arms: Map<string, Partial<Record<WeaponKind, number>>>;
  engaged: Map<string, number>;
}

/** The wars fought this period: those of the state after it, but for one under a truce all through; new ones count from the start. */
function foughtThisPeriod(before: Pick<GameState, "wars">, next: Pick<GameState, "wars">): War[] {
  return next.wars
    .filter((w) => {
      const was = before.wars.find((x) => x.id === w.id);
      return !(was?.truce && w.truce);
    })
    .map((w) => ({ ...w, truce: undefined }));
}

/**
 * What the period's fighting cost each side, from the provinces the front
 * ran through: those contested at its start or end, and those that changed
 * hands between the war's sides. At each, both sides' strength (engine/fronts.ts,
 * read at the start of the period) and the ground the attacker gained set
 * each side's losses; each member loses its part of what it brought there.
 */
export function warExchange(before: GameState, next: Pick<GameState, "regions" | "wars">, index: Pick<MapIndex, "neighbors"> & Partial<Pick<MapIndex, "regions">>, years: number): Exchange {
  const months = Math.max(0.05, years * 12);
  const wars = foughtThisPeriod(before, next);
  const out: Exchange = { wars: new Map(), arms: new Map(), engaged: new Map() };
  if (!wars.length) return out;
  const strength = frontStrength({ ...before, wars }, index);
  const powers = new Map<string, number>();
  const fullPower = (tag: string) => {
    let p = powers.get(tag);
    if (p === undefined) powers.set(tag, (p = combatPower(before, tag)));
    return p;
  };
  // Each member's presence (the share of its whole weight at a province) and the shares of it lost and taken there, summed over provinces.
  type Tally = { presence: number; lost: number; taken: number };
  const lostMonth = 1 - (1 - MAX_LOST_MONTH) ** months;
  for (const war of wars) {
    const side = (tag: string) => (war.attackers.includes(tag) ? war.attackers : war.defenders.includes(tag) ? war.defenders : null);
    const tallies = new Map<string, Tally>();
    const tally = (tag: string) => {
      let t = tallies.get(tag);
      if (!t) tallies.set(tag, (t = { presence: 0, lost: 0, taken: 0 }));
      return t;
    };
    /** A side's strength at a province, or, where it was not there at the period's start (an advance that ran on), at the strongest of its neighbours. */
    const strongest = (mine: string[], theirs: string[], id: string) => {
      let best = { id, s: strength.at(war, mine, theirs, id) };
      if (best.s < 1) {
        for (const n of index.neighbors[id] ?? []) {
          if (!before.regions[n]) continue;
          const s = strength.at(war, mine, theirs, n);
          if (s > best.s) best = { id: n, s };
        }
      }
      return best;
    };
    for (const [id, b] of Object.entries(before.regions)) {
      const n = next.regions[id];
      if (!n) continue;
      const holder = side(b.controller);
      if (!holder) continue;
      const enemy = holder === war.attackers ? war.defenders : war.attackers;
      const bx = b.contested ? side(b.contested) : null;
      const nc = side(n.controller);
      const nx = n.contested ? side(n.contested) : null;
      if (!(bx === enemy || (nc === holder && nx === enemy) || nc === enemy)) continue;
      // The attacker's share of the province before and after, and the points it gained a month.
      const was = bx === enemy ? (b.held ?? 30) : 0;
      const now = nc === enemy ? (nx === holder ? 100 - (n.held ?? 30) : 100) : nx === enemy ? (n.held ?? 30) : 0;
      const pace = (now - was) / months;
      const tempo = Math.abs(pace) / (Math.abs(pace) + TEMPO);
      const att = strongest(enemy, holder, id);
      const def = strongest(holder, enemy, id);
      const a = Math.max(0.5, att.s);
      const d = Math.max(0.5, def.s);
      const base = (mine: number, theirs: number) => K * months * Math.sqrt(mine * Math.min(theirs, MAX_RATIO * mine));
      // The side advancing pays for it while it grinds; where the holder pushed the attacker back, the holder advanced.
      const attackerAdvances = pace >= 0;
      const adv = GRIND.advancing * (1 - tempo) + ROUT.advancing * tempo;
      const ret = GRIND.holding * (1 - tempo) + ROUT.routed * tempo;
      const lossA = base(a, d) * (attackerAdvances ? adv : ret);
      const lossD = base(d, a) * (attackerAdvances ? ret : adv);
      const takenA = attackerAdvances ? 0 : lossA * PRISONERS * tempo * tempo;
      const takenD = attackerAdvances ? lossD * PRISONERS * tempo * tempo : 0;
      const book = (mine: string[], theirs: string[], at: string, total: number, loss: number, taken: number) => {
        // Never more than a month's worst of what was there.
        const k = Math.min(1, (lostMonth * total) / Math.max(1e-9, loss + taken));
        for (const m of strength.members(war, mine, theirs, at)) {
          const full = fullPower(m.tag);
          if (m.strength <= 0 || full <= 0) continue;
          const t = tally(m.tag);
          const presence = m.strength / full;
          t.presence += presence;
          t.lost += (presence * loss * k) / total;
          t.taken += (presence * taken * k) / total;
        }
      };
      book(enemy, holder, att.id, a, lossA, takenA);
      book(holder, enemy, def.id, d, lossD, takenD);
    }
    const byCountry = new Map<string, Casualties>();
    for (const [tag, t] of tallies) {
      const c = before.countries[tag];
      const troops = c?.economy?.troops ?? 0;
      // A country cannot lose more than it had in the fighting.
      const presence = Math.min(1, t.presence);
      const scale = Math.min(1, presence / Math.max(1e-9, t.lost + t.taken));
      const lost = t.lost * scale;
      const taken = t.taken * scale;
      const casualties = troops * lost;
      const arms: Partial<Record<WeaponKind, number>> = {};
      for (const [kind, stock] of Object.entries(c?.arsenal?.stock ?? {}) as [WeaponKind, { n: number }][]) {
        const n = stock.n * Math.min(presence, lost * EXPOSURE[kind] + taken * ABANDONED);
        if (n >= 0.05) arms[kind] = round2(n);
      }
      byCountry.set(tag, { killed: round2(casualties * KILLED_SHARE), wounded: round2(casualties * (1 - KILLED_SHARE)), captured: round2(troops * taken), arms, engaged: round2(troops * presence) });
      out.engaged.set(tag, Math.min(1, (out.engaged.get(tag) ?? 0) + presence));
      const all = out.arms.get(tag) ?? {};
      for (const [kind, n] of Object.entries(arms) as [WeaponKind, number][]) all[kind] = (all[kind] ?? 0) + n;
      out.arms.set(tag, all);
    }
    out.wars.set(war.id, byCountry);
  }
  return out;
}

/**
 * Keeps the game master's losses for wars that exist and countries that
 * fight them, once per war and country, and no more than a period of the
 * hardest fighting could kill from the soldiers that war takes; a truce
 * allows a tenth of that. Wounded stay within five for every one killed.
 */
export function sanitizeWarLosses(state: GameState, word: WarLossWord[], findWar: (key: string) => War | undefined, years: number): WarLossEntry[] {
  const seen = new Set<string>();
  return word.flatMap((l) => {
    const war = findWar(l.war);
    const troops = state.countries[l.country]?.economy?.troops ?? 0;
    if (!war || !sideOf(war, l.country) || troops <= 0) return [];
    const key = `${war.id}:${l.country}`;
    if (seen.has(key)) return [];
    seen.add(key);
    const most = troops * troopShare(state, war, l.country) * MAX_KILLED_MONTH * Math.max(0.25, years * 12) * (war.truce ? TRUCE_SHARE : 1);
    const killed = round2(Math.min(l.killed, most));
    const wounded = l.wounded === undefined ? undefined : round2(Math.min(l.wounded, Math.max(killed, 0.01) * MAX_WOUNDED_PER_KILLED));
    return [{ war: war.id, country: l.country, killed, ...(wounded !== undefined ? { wounded } : {}) }];
  });
}

/**
 * The period's losses join each war's record: the game master's figures
 * where it gave them, else the engine's; and every country's weapons lost
 * this period, split between the wars it fights by what each cost it in
 * men. `before` is the state the period began with. Mutates `next.wars`.
 */
export function recordWarLosses(next: GameState, before: GameState, word: WarLossEntry[], years: number, armsLost: Map<string, Partial<Record<WeaponKind, number>>>, exchange?: Exchange): void {
  const reported = new Map(word.map((l) => [`${l.war}:${l.country}`, l]));
  // What each war costs each country in men this period, for the record and to split its weapons lost.
  const cost = new Map<string, { killed: number; wounded: number; captured: number }>();
  for (const war of next.wars) {
    const was = before.wars.find((w) => w.id === war.id);
    // A war the answer began fights from this period; one under a truce all period costs nothing unless reported.
    const asWas: War = was ? { ...war, truce: was.truce && war.truce ? was.truce : undefined } : { ...war, truce: undefined };
    for (const country of [...war.attackers, ...war.defenders]) {
      const r = reported.get(`${war.id}:${country}`);
      // The fronts the period's fighting opened count as much as those it began with.
      const wars = was ? before.wars : [...before.wars, asWas];
      const fought = exchange?.wars.get(war.id)?.get(country);
      let expected: { killed: number; wounded: number; captured: number };
      if (exchange) {
        // Where it fought, what the fighting cost it; at war with no fighting of its own, the losses at sea and in the air.
        expected = fought && fought.engaged > 0 ? { killed: fought.killed, wounded: fought.wounded, captured: fought.captured } : { ...quietWarLosses({ ...before, wars }, asWas, country, years), captured: 0 };
      } else {
        const atStart = expectedWarLosses({ ...before, wars }, asWas, country, years);
        const atEnd = expectedWarLosses({ ...before, wars, regions: next.regions }, asWas, country, years);
        expected = { ...(atEnd.killed > atStart.killed ? atEnd : atStart), captured: 0 };
      }
      let killed = r ? r.killed : expected.killed;
      let wounded = r ? (r.wounded ?? round2(r.killed * WOUNDED_PER_KILLED)) : expected.wounded;
      if (r && exchange) {
        // The game master's word within what the fighting allows: up to threefold the engine's figure, a little where it saw none, never more than was engaged.
        const engaged = fought?.engaged ?? 0;
        const troops = before.countries[country]?.economy?.troops ?? 0;
        const most = Math.max(LOSS_SLACK * expected.killed, QUIET_SHARE * years * 12 * Math.max(engaged, 0.05 * troops * troopShare({ ...before, wars }, asWas, country)));
        killed = round2(Math.min(killed, most));
        wounded = round2(Math.min(wounded, MAX_WOUNDED_PER_KILLED * Math.max(killed, 0.01)));
        if (engaged > 0 && killed + wounded + expected.captured > engaged) wounded = round2(Math.max(0, engaged - killed - expected.captured));
      }
      cost.set(`${war.id}:${country}`, { killed, wounded, captured: expected.captured });
    }
  }
  for (const war of next.wars) {
    for (const country of [...war.attackers, ...war.defenders]) {
      const { killed, wounded, captured } = cost.get(`${war.id}:${country}`)!;
      // The weapons the country lost this period, by this war's share of its dead.
      const lost = armsLost.get(country);
      const mine = next.wars.filter((w) => sideOf(w, country)).map((w) => cost.get(`${w.id}:${country}`)?.killed ?? 0);
      const total = mine.reduce((a, b) => a + b, 0);
      const wars = mine.length;
      const share = total > 0 ? killed / total : 1 / Math.max(1, wars);
      const arms: Partial<Record<WeaponKind, number>> = {};
      for (const [kind, n] of Object.entries(lost ?? {}) as [WeaponKind, number][]) {
        const part = round2(n * share);
        if (part >= 0.5) arms[kind] = part;
      }
      if (killed <= 0 && wounded <= 0 && captured <= 0 && !Object.keys(arms).length) continue;
      const had = war.losses?.[country];
      const sum: Partial<Record<WeaponKind, number>> = { ...(had?.arms ?? {}) };
      for (const [kind, n] of Object.entries(arms) as [WeaponKind, number][]) sum[kind] = round2((sum[kind] ?? 0) + n);
      const prisoners = round2((had?.captured ?? 0) + captured);
      const entry: WarLosses = {
        killed: round2((had?.killed ?? 0) + killed),
        wounded: round2((had?.wounded ?? 0) + wounded),
        ...(prisoners > 0 ? { captured: prisoners } : {}),
        ...(Object.keys(sum).length ? { arms: sum } : {}),
      };
      war.losses = { ...war.losses, [country]: entry };
    }
  }
}

/** Heavy weapons lost, in pieces: everything but rifles. */
export const heavyLost = (l: WarLosses | undefined) => Object.entries(l?.arms ?? {}).reduce((sum, [kind, n]) => (kind === "rifles" ? sum : sum + (n ?? 0)), 0);

/** A side's losses as the player's government knows them: its own exactly, the others' as its intelligence estimates them (engine/fog.ts). */
export interface LossesView {
  killed: Estimate;
  wounded: Estimate;
  /** Soldiers taken prisoner. */
  captured: Estimate;
  heavy: Estimate;
}

export function lossesView(state: GameState, war: War, country: string): LossesView | null {
  const l = war.losses?.[country];
  if (!l) return null;
  const heavy = heavyLost(l);
  const exact = (n: number): Estimate => ({ value: n, low: n, high: n, exact: true });
  const captured = l.captured ?? 0;
  if (country === state.player || !fogOn(state)) return { killed: exact(l.killed), wounded: exact(l.wounded), captured: exact(captured), heavy: exact(heavy) };
  const score = knowledgeOf(state, country).score - ARMY_SECRECY;
  const key = `losses:${war.id}:${country}`;
  return {
    killed: estimate(l.killed, score, state, `${key}:killed`),
    wounded: estimate(l.wounded, score, state, `${key}:wounded`),
    captured: estimate(captured, score, state, `${key}:captured`),
    heavy: estimate(heavy, score, state, `${key}:heavy`),
  };
}

/** A war's record for the prompt: "losses so far (thousands killed/wounded): germany 16/48, poland 66/133". */
export function lossesLine(war: War): string {
  const entries = Object.entries(war.losses ?? {}).filter(([, l]) => l.killed > 0 || l.wounded > 0);
  if (!entries.length) return "";
  const one = (n: number) => Math.round(n * 10) / 10;
  const taken = entries.some(([, l]) => (l.captured ?? 0) >= 0.05);
  return ` | losses so far (thousands killed/wounded${taken ? "/taken prisoner" : ""}): ${entries.map(([c, l]) => `${c} ${one(l.killed)}/${one(l.wounded)}${taken ? `/${one(l.captured ?? 0)}` : ""}`).join(", ")}`;
}

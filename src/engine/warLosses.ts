import { z } from "zod";
import { callUp, lostForGood, loseSoldiers } from "./army";
import { combatPower } from "./arsenal";
import { yearOf } from "./calendar";
import { ASSAULT_COST, attacking, BOTCHED_COST, defenceAdvantage, GRIND_ATTACKER, GRIND_DEFENDER, INTENSITY, LATE_SHARE, quietFire, ROUT_ATTACKER, ROUT_DEFENDER } from "./doctrine";
import { ARMY_SECRECY, estimate, fogOn, knowledgeOf, type Estimate } from "./fog";
import { frontStrength, paceScale, unitsAt, type FieldUnit, type TurnUnits } from "./fronts";
import type { GameState, MapIndex, Posture, War, WarLosses, WarLossesPart, WeaponKind } from "./types";

/**
 * What each war has cost its sides: soldiers killed and wounded, and weapons
 * lost, since it began. The turn's game master reports a period's dead and
 * wounded by war and side (`warLosses`); the engine keeps them within what
 * the armies and the fighting allow and works out the rest itself, as it
 * does for weapons (engine/arsenal.ts), whose losses it splits between a
 * country's wars. The record is also what the armies lose: the killed, the
 * taken prisoner and a third of the wounded leave the army for good
 * (takeWarLosses, engine/army.ts), and the killed leave their country's
 * people (engine/population.ts takeDead) – the game master's own troops are
 * mobilisation and demobilisation, and its deaths are read net of these.
 * A war that ends in the turn is fought until it ends: its last period
 * costs as any other.
 *
 * The engine's own figures follow the fighting, province by province
 * (warExchange): where the front ran this period, each fight's base is
 * K × √(the attacker's strength × the defender's) a month – an even fight
 * costs both the same, a strong side meeting a weak one loses a small share of
 * what it sent and the weak side a large share of its own. Who attacks and how
 * hard is the formations' posture (engine/formations.ts): a probe, an
 * offensive, an all-out assault, a holder clearing a lodgement, a withdrawal.
 * An attack that fails costs the attacker 2 × Δ and the defender 0.7 / Δ of
 * the base, where Δ is the defence's advantage (engine/doctrine.ts): the
 * era's, the months the line has stood, the ground and its rivers, less the
 * attacker's guns, gas, tanks and aircraft – a failed assault on the trenches
 * of 1916 costs 12–18 times the defender's loss; as the defence breaks the
 * attacker pays 0.4 and the side in rout 2.5, and prisoners outnumber the
 * dead. A quiet line costs both sides alike (shelling, raids, snipers, the
 * guns of a formation gathering for an attack). Each member loses its part of
 * what it brought there – soldiers and weapons in proportion, tanks and
 * drones most exposed – and never more than it had engaged. The game master's
 * figures may exceed the engine's threefold, no more.
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
/**
 * How the fighting's tempo – the points of a province of PACE_KM2 (engine/fronts.ts) the attacker gains a month, against
 * TEMPO – breaks the defence (engine/doctrine.ts GRIND_* and ROUT_*): at a tempo of t the side in rout loses PRISONERS × t²
 * times its losses again in men taken.
 */
const TEMPO = 60;
const PRISONERS = 4;
/** A quiet line's toll on each side, of the base, at the era's fire (engine/doctrine.ts quietFire); the guns a formation gathers for an attack add up to BOMBARD times as much again on the enemy. */
const QUIET = 0.25;
const BOMBARD = 3;
/** What the guns gathered for an attack add to the defender's loss in it, of the base at full preparation. */
const SHELLS = 0.6;
/** A withdrawal costs the side falling back this much of the base, and the side following a little; one ordered late or botched leaves a rearguard in the enemy's hands. */
const REARGUARD = 0.1;
const STRAGGLERS = 2;

/** What a fight costs each side, in shares of its base: an attack by `posture` that broke the defence by `s` (0 failed – 1 a rout), against the defence's advantage Δ. */
export function fightCost(posture: Posture, s: number, delta: number, u?: Pick<FieldUnit, "late" | "botched" | "commander">): { attacker: number; defender: number; prisoners: number } {
  const i = INTENSITY[posture] * (u?.late ? LATE_SHARE : 1);
  const grind = 1 - s;
  const skill = 1.12 - 0.04 * (u?.commander.skill ?? 3);
  const attacker = i * (GRIND_ATTACKER * delta * grind + ROUT_ATTACKER * s) * (posture === "assault" ? ASSAULT_COST : 1) * (u?.botched ? BOTCHED_COST : 1) * skill;
  const defender = i * ((GRIND_DEFENDER / delta) * grind + ROUT_DEFENDER * s);
  return { attacker, defender, prisoners: defender * PRISONERS * s * s };
}

/** The tempo an advance of `pace` points of a province of PACE_KM2 a month makes, 0–1. */
const tempoOf = (pace: number) => Math.max(0, pace) / (Math.max(0, pace) + TEMPO);
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
  const killed = quietEngaged(state, war, country) * KILLED_MONTH * NO_FRONT * years * 12;
  return { killed: round2(killed), wounded: round2(killed * WOUNDED_PER_KILLED) };
}

/** How much more than its enemies' soldiers a side brings to a fight at sea and in the air, at most. */
const QUIET_MATCH = 1.5;

/**
 * The soldiers a country has in a war fought only at sea and in the air: its share of the army for the war, but no more
 * than half as much again as its enemies bring to it – a great army does not lose more for being great when it meets a
 * small enemy over water, only the forces that meet decide it.
 */
export function quietEngaged(state: Pick<GameState, "countries" | "regions" | "wars">, war: War, country: string): number {
  const own = (state.countries[country]?.economy?.troops ?? 0) * troopShare(state, war, country);
  const theirs = enemiesIn(war, country).reduce((sum, e) => sum + (state.countries[e]?.economy?.troops ?? 0) * troopShare(state, war, e), 0);
  return Math.min(own, QUIET_MATCH * theirs);
}

/** What a period's fighting cost one country in one war, thousands of soldiers and weapons in pieces (rifles in thousands); `engaged`, the soldiers it had in the fighting. */
export interface Casualties {
  killed: number;
  wounded: number;
  captured: number;
  arms: Partial<Record<WeaponKind, number>>;
  engaged: number;
}

/** A period's fighting in every war: each country's casualties by war, its weapons lost in all its wars, and the share of its army that fought; with formations, each one's part. */
export interface Exchange {
  wars: Map<string, Map<string, Casualties>>;
  arms: Map<string, Partial<Record<WeaponKind, number>>>;
  engaged: Map<string, number>;
  /** By war and formation: thousands of its soldiers lost (killed, wounded, taken), of them taken, the enemy's losses against it, prisoners it took, and where it fought hardest with the ground it gained there (km). */
  units: Map<string, Map<string, UnitFight>>;
}

export interface UnitFight {
  lost: number;
  captured: number;
  enemyLost: number;
  taken: number;
  at?: string;
  km: number;
  /** The losses of both sides at `at`, to find it. */
  weight: number;
}

/** The wars of a period: those of the state after it, and those that ended in it (fought until they ended, as they stood at its start). */
export function periodWars(before: Pick<GameState, "wars">, next: Pick<GameState, "wars">): War[] {
  const now = new Set(next.wars.map((w) => w.id));
  return [...next.wars, ...before.wars.filter((w) => !now.has(w.id))];
}

/** The wars that ended in a period, by id. */
export const endedIn = (before: Pick<GameState, "wars">, next: Pick<GameState, "wars">): Set<string> => {
  const now = new Set(next.wars.map((w) => w.id));
  return new Set(before.wars.filter((w) => !now.has(w.id)).map((w) => w.id));
};

/** The wars fought this period: those of the state after it and those that ended in it, but for one under a truce all through; new ones count from the start. */
function foughtThisPeriod(before: Pick<GameState, "wars">, next: Pick<GameState, "wars">): War[] {
  const ended = endedIn(before, next);
  return periodWars(before, next)
    .filter((w) => {
      const was = before.wars.find((x) => x.id === w.id);
      return ended.has(w.id) ? !was?.truce : !(was?.truce && w.truce);
    })
    .map((w) => ({ ...w, truce: undefined }));
}

/**
 * What the period's fighting cost each side, from the provinces the front
 * ran through: those contested at its start or end, and those that changed
 * hands between the war's sides, where who attacked and how hard is the
 * formations' posture (`units`, engine/formations.ts; without them the side
 * that gained ground attacked); a formation that attacked and took nothing
 * fought at its target; the rest of the front was quiet. At each, both sides'
 * strength (engine/fronts.ts, read at the start of the period), the defence's
 * advantage there and the ground the attacker gained set each side's losses;
 * each member loses its part of what it brought there, and each formation
 * is told its part.
 */
export function warExchange(before: GameState, next: Pick<GameState, "regions" | "wars">, index: Pick<MapIndex, "neighbors"> & Partial<Pick<MapIndex, "regions">>, years: number, units?: TurnUnits): Exchange {
  const months = Math.max(0.05, years * 12);
  const wars = foughtThisPeriod(before, next);
  // A war that ended in the turn fought on its line as it stood: the peace, not a battle, gave the land back.
  const ended = endedIn(before, next);
  const out: Exchange = { wars: new Map(), arms: new Map(), engaged: new Map(), units: new Map() };
  if (!wars.length) return out;
  const strength = frontStrength({ ...before, wars }, index);
  // Where the formations massed their tanks and guns, the fighting weighed them there (engine/fronts.ts mass).
  if (units) strength.mass(units);
  const year = yearOf(before.date);
  const unitAt = units ? unitsAt(units, before, index) : null;
  const powers = new Map<string, number>();
  const fullPower = (tag: string) => {
    let p = powers.get(tag);
    if (p === undefined) powers.set(tag, (p = combatPower(before, tag)));
    return p;
  };
  // Each member's presence (the share of its whole weight at the provinces it fought in) and the shares of it lost and taken, summed over provinces.
  type Tally = { presence: number; lost: number; taken: number; at: Set<string> };
  const lostMonth = 1 - (1 - MAX_LOST_MONTH) ** months;
  const base = (mine: number, theirs: number) => K * months * Math.sqrt(mine * Math.min(theirs, MAX_RATIO * mine));
  for (const war of wars) {
    const side = (tag: string) => (war.attackers.includes(tag) ? war.attackers : war.defenders.includes(tag) ? war.defenders : null);
    const tallies = new Map<string, Tally>();
    const tally = (tag: string) => {
      let t = tallies.get(tag);
      if (!t) tallies.set(tag, (t = { presence: 0, lost: 0, taken: 0, at: new Set() }));
      return t;
    };
    /** Each booking at a fight: a member's shares lost and taken there, for its formation's part. */
    type Booking = { tag: string; side: string[]; lost: number; taken: number };
    const fights: { id: string; book: Booking[]; gain: Map<string[], number> }[] = [];
    const unitOf = (mine: readonly string[], id: string) => unitAt?.(war.id, mine, id);
    const manoeuvre = strength.manoeuvreOf(war);
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
    /** Books a side's loss and men taken at a fight among the members there, never more than a month's worst of what was there. */
    const book = (fight: (typeof fights)[number], mine: string[], theirs: string[], at: string, total: number, loss: number, taken: number) => {
      if (loss + taken <= 0) return;
      const k = Math.min(1, (lostMonth * total) / Math.max(1e-9, loss + taken));
      for (const m of strength.members(war, mine, theirs, at)) {
        const full = fullPower(m.tag);
        if (m.strength <= 0 || full <= 0) continue;
        const t = tally(m.tag);
        const presence = m.strength / full;
        // A member's weight at a province counts once, however many fights it saw there.
        if (!t.at.has(at)) {
          t.at.add(at);
          t.presence += presence;
        }
        const lost = (presence * loss * k) / total;
        const men = (presence * taken * k) / total;
        t.lost += lost;
        t.taken += men;
        fight.book.push({ tag: m.tag, side: mine, lost, taken: men });
      }
    };
    /** The defence's advantage at a province against an attack by `att` on `def`, with the attacker's guns. */
    const deltaAt = (id: string, att: string[], def: string[], u: FieldUnit | undefined) => {
      const mob = strength.mobilityAt(war, att, id);
      const theirs = def === war.attackers ? manoeuvre.attackers : manoeuvre.defenders;
      const guns = u && (u.posture === "offensive" || u.posture === "assault") && !u.botched ? u.prep : 0;
      return defenceAdvantage({ year, dug: before.regions[id]?.dug, region: index.regions?.[id], prep: guns, armour: mob.armour, air: mob.air, drones: theirs.drones });
    };
    /** One attack at a province: `att` on `def` by `posture`, breaking the defence by `s`. */
    const attack = (fight: (typeof fights)[number], att: string[], def: string[], id: string, posture: Posture, s: number, u: FieldUnit | undefined) => {
      const a = strongest(att, def, id);
      const d = strongest(def, att, id);
      const sa = Math.max(0.5, a.s);
      const sd = Math.max(0.5, d.s);
      const cost = fightCost(posture, s, deltaAt(id, att, def, u), u);
      book(fight, att, def, a.id, sa, base(sa, sd) * cost.attacker, 0);
      const shells = u && (posture === "offensive" || posture === "assault") && !u.botched ? INTENSITY[posture] * SHELLS * u.prep : 0;
      book(fight, def, att, d.id, sd, base(sd, sa) * (cost.defender + shells), base(sd, sa) * cost.prisoners);
    };
    /** A line falling back: the side leaving pays a rearguard's toll, and leaves stragglers when the order came late or was botched. */
    const withdraw = (fight: (typeof fights)[number], leaving: string[], following: string[], id: string, u: FieldUnit | undefined) => {
      const l = strongest(leaving, following, id);
      const f = strongest(following, leaving, id);
      const sl = Math.max(0.5, l.s);
      const sf = Math.max(0.5, f.s);
      const toll = base(sl, sf) * INTENSITY.withdraw;
      book(fight, leaving, following, l.id, sl, toll, u?.late || u?.botched ? toll * STRAGGLERS : 0);
      book(fight, following, leaving, f.id, sf, base(sf, sl) * REARGUARD, 0);
    };
    /** A quiet line at a province: both sides lose alike, and the side under a formation's gathering guns more. */
    const quiet = (fight: (typeof fights)[number], holder: string[], enemy: string[], id: string) => {
      const h = strength.at(war, holder, enemy, id);
      const e = strength.at(war, enemy, holder, id);
      if (h < 0.5 || e < 0.5) return;
      const fire = QUIET * quietFire(year);
      const guns = (u: FieldUnit | undefined) => (u && (u.posture === "hold" || u.posture === "probe") ? BOMBARD * u.prep : 0);
      book(fight, holder, enemy, id, h, base(h, e) * fire * (1 + guns(unitOf(enemy, id))), 0);
      book(fight, enemy, holder, id, e, base(e, h) * fire * (1 + guns(unitOf(holder, id))), 0);
    };
    const fought = new Set<string>();
    for (const [id, b] of Object.entries(before.regions)) {
      const n = ended.has(war.id) ? b : next.regions[id];
      if (!n) continue;
      const holder = side(b.controller);
      if (!holder) continue;
      const enemy = holder === war.attackers ? war.defenders : war.attackers;
      const bx = b.contested ? side(b.contested) : null;
      const nc = side(n.controller);
      const nx = n.contested ? side(n.contested) : null;
      if (!(bx === enemy || (nc === holder && nx === enemy) || nc === enemy)) continue;
      // The attacker's share of the province before and after, and the points it gained a month – of a province of PACE_KM2, so the tempo is ground covered whatever the province's size.
      const was = bx === enemy ? (b.held ?? 30) : 0;
      const now = nc === enemy ? (nx === holder ? 100 - (n.held ?? 30) : 100) : nx === enemy ? (n.held ?? 30) : 0;
      const pace = (now - was) / months / paceScale(index.regions?.[id]);
      const km = (now - was) / paceScale(index.regions?.[id]);
      const fight = { id, book: [] as Booking[], gain: new Map<string[], number>([
        [enemy, km],
        [holder, -km],
      ]) };
      fights.push(fight);
      fought.add(id);
      const ua = unitOf(enemy, id);
      const ud = unitOf(holder, id);
      // Without formations the side that gained ground attacked, and a holder that threw the attacker back counterattacked.
      const pa: Posture = ua?.posture ?? (pace >= 0 ? "offensive" : "hold");
      const pd: Posture = ud?.posture ?? (pace >= 0 ? "hold" : "offensive");
      if (pa === "withdraw") withdraw(fight, enemy, holder, id, ua);
      else if (pd === "withdraw" && pace >= 0) withdraw(fight, holder, enemy, id, ud);
      else {
        // The attacker's attack, which broke the defence as far as its ground shows; thrown back, it failed.
        if (attacking(pa)) attack(fight, enemy, holder, id, pa, tempoOf(pace), ua);
        // The holder clearing the lodgement: as hard as its posture, as far as the ground it took back shows.
        if (pace < 0) attack(fight, holder, enemy, id, attacking(pd) ? pd : "hold", tempoOf(-pace), ud);
        else if (!attacking(pa)) quiet(fight, holder, enemy, id);
      }
    }
    // A formation that attacked and took nothing fought where it meant to break in, and failed there.
    for (const u of units?.[war.id] ?? []) {
      if (!attacking(u.posture) || !u.target || fought.has(u.target)) continue;
      const mine = side(u.tag);
      if (!mine || u.sector.some((id) => fought.has(id))) continue;
      const theirs = mine === war.attackers ? war.defenders : war.attackers;
      if (!before.regions[u.target] || !theirs.includes(before.regions[u.target].controller)) continue;
      const fight = { id: u.target, book: [] as Booking[], gain: new Map<string[], number>() };
      fights.push(fight);
      fought.add(u.target);
      attack(fight, mine, theirs, u.target, u.posture, 0, u);
    }
    // The rest of the front is quiet: shelling, raids and snipers on both sides, and the guns a formation gathers for its attack.
    // A formation that attacked fought its turn in its attack.
    for (const id of strength.fronts.get(war.id) ?? []) {
      if (fought.has(id)) continue;
      const holder = side(before.regions[id].controller);
      if (!holder) continue;
      const enemy = holder === war.attackers ? war.defenders : war.attackers;
      if (attacking(unitOf(holder, id)?.posture) || attacking(unitOf(enemy, id)?.posture)) continue;
      const fight = { id, book: [] as Booking[], gain: new Map<string[], number>() };
      fights.push(fight);
      quiet(fight, holder, enemy, id);
    }
    const byCountry = new Map<string, Casualties>();
    const scales = new Map<string, number>();
    for (const [tag, t] of tallies) {
      const c = before.countries[tag];
      const troops = c?.economy?.troops ?? 0;
      // A country cannot lose more than it had in the fighting.
      const presence = Math.min(1, t.presence);
      const scale = Math.min(1, presence / Math.max(1e-9, t.lost + t.taken));
      scales.set(tag, scale * troops);
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
    // Each formation's part: its member's losses at its fights, the enemy's there, and where it fought hardest.
    if (unitAt) {
      const parts = new Map<string, UnitFight>();
      for (const f of fights) {
        const men = (b: Booking) => (b.lost + b.taken) * (scales.get(b.tag) ?? 0);
        const sides = new Map<string[], number>();
        for (const b of f.book) sides.set(b.side, (sides.get(b.side) ?? 0) + men(b));
        const all = [...sides.values()].reduce((x, y) => x + y, 0);
        for (const b of f.book) {
          const u = unitOf([b.tag], f.id);
          if (!u) continue;
          const own = men(b);
          const enemyLost = [...sides].filter(([s]) => s !== b.side).reduce((x, [, v]) => x + v, 0) * (own / Math.max(1e-9, sides.get(b.side) ?? 0));
          const taken = f.book.filter((o) => o.side !== b.side).reduce((x, o) => x + o.taken * (scales.get(o.tag) ?? 0), 0) * (own / Math.max(1e-9, sides.get(b.side) ?? 0));
          const p = parts.get(u.id) ?? { lost: 0, captured: 0, enemyLost: 0, taken: 0, km: 0, weight: -1 };
          p.lost += own;
          p.captured += b.taken * (scales.get(b.tag) ?? 0);
          p.enemyLost += enemyLost;
          p.taken += taken;
          if (all > p.weight) {
            p.weight = all;
            p.at = f.id;
            p.km = f.gain.get(b.side) ?? 0;
          }
          parts.set(u.id, p);
        }
      }
      out.units.set(war.id, parts);
    }
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

/** What one war cost one country in men this period, thousands. */
export interface PeriodCost {
  war: string;
  country: string;
  killed: number;
  wounded: number;
  captured: number;
}

/**
 * What each war of the period cost each of its countries in men: the game
 * master's figures within what the fighting allows where it gave them, else
 * the engine's; by `${war}:${country}`. The period's wars are the state's
 * after it and those that ended in it (`list` narrows them). `before` is the
 * state the period began with.
 */
export function periodCosts(next: GameState, before: GameState, word: WarLossEntry[], years: number, exchange?: Exchange, list: War[] = periodWars(before, next)): Map<string, PeriodCost> {
  const reported = new Map(word.map((l) => [`${l.war}:${l.country}`, l]));
  const cost = new Map<string, PeriodCost>();
  for (const war of list) {
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
        // Where it saw no fighting, a little of what the forces that meet at sea and in the air allow – not of the whole army.
        const most = Math.max(LOSS_SLACK * expected.killed, QUIET_SHARE * years * 12 * Math.max(engaged, 0.05 * quietEngaged({ ...before, wars }, asWas, country)));
        killed = round2(Math.min(killed, most));
        wounded = round2(Math.min(wounded, MAX_WOUNDED_PER_KILLED * Math.max(killed, 0.01)));
        if (engaged > 0 && killed + wounded + expected.captured > engaged) wounded = round2(Math.max(0, engaged - killed - expected.captured));
      }
      cost.set(`${war.id}:${country}`, { war: war.id, country, killed, wounded, captured: expected.captured });
    }
  }
  return cost;
}

/**
 * The period's losses join each war's record: the game master's figures
 * where it gave them, else the engine's (`costs`, read once for the whole
 * turn; a war begun after it is read here); and every country's weapons lost
 * this period, split between the wars it fought by what each cost it in men.
 * A war that ended in the turn keeps no record, but what it cost counts.
 * Returns each country's losses in men this period, every war together.
 * `before` is the state the period began with. Mutates `next.wars`.
 */
export function recordWarLosses(
  next: GameState,
  before: GameState,
  word: WarLossEntry[],
  years: number,
  armsLost: Map<string, Partial<Record<WeaponKind, number>>>,
  exchange?: Exchange,
  costs?: Map<string, PeriodCost>,
): Map<string, { killed: number; wounded: number; captured: number }> {
  const cost = new Map(costs ?? []);
  const unread = next.wars.filter((w) => [...w.attackers, ...w.defenders].some((c) => !cost.has(`${w.id}:${c}`)));
  if (!costs) for (const [k, v] of periodCosts(next, before, word, years, exchange)) cost.set(k, v);
  else if (unread.length) for (const [k, v] of periodCosts(next, before, word, years, exchange, unread)) if (!cost.has(k)) cost.set(k, v);
  // Each country's dead in every war of the period, the ended ones too, to split its weapons lost.
  const dead = new Map<string, { total: number; wars: number }>();
  for (const c of cost.values()) {
    const d = dead.get(c.country) ?? { total: 0, wars: 0 };
    d.total += c.killed;
    d.wars += 1;
    dead.set(c.country, d);
  }
  for (const war of next.wars) {
    for (const country of [...war.attackers, ...war.defenders]) {
      const { killed, wounded, captured } = cost.get(`${war.id}:${country}`) ?? { killed: 0, wounded: 0, captured: 0 };
      // The weapons the country lost this period, by this war's share of its dead.
      const lost = armsLost.get(country);
      const { total, wars } = dead.get(country) ?? { total: 0, wars: 1 };
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
      // The period's own part, kept beside the total for the army tab; `next.turn` is still the turn being played (its chronicle entry's).
      const last: WarLossesPart = {
        turn: next.turn,
        killed: round2(killed),
        wounded: round2(wounded),
        ...(captured > 0 ? { captured: round2(captured) } : {}),
        ...(Object.keys(arms).length ? { arms } : {}),
      };
      const entry: WarLosses = {
        killed: round2((had?.killed ?? 0) + killed),
        wounded: round2((had?.wounded ?? 0) + wounded),
        ...(prisoners > 0 ? { captured: prisoners } : {}),
        ...(Object.keys(sum).length ? { arms: sum } : {}),
        last,
      };
      war.losses = { ...war.losses, [country]: entry };
    }
  }
  return costsByCountry(cost);
}

/** Each country's losses in men over every war of a period's costs. */
export function costsByCountry(costs: Map<string, PeriodCost>): Map<string, { killed: number; wounded: number; captured: number }> {
  const out = new Map<string, { killed: number; wounded: number; captured: number }>();
  for (const c of costs.values()) {
    const t = out.get(c.country) ?? { killed: 0, wounded: 0, captured: 0 };
    t.killed += c.killed;
    t.wounded += c.wounded;
    t.captured += c.captured;
    out.set(c.country, t);
  }
  return out;
}

/**
 * The period's losses leave the armies: each country's killed, taken
 * prisoner and badly wounded (engine/army.ts lostForGood), its men by
 * training with them. `drafted` is the turn's change to its soldiers in the
 * economy's answer: a cut there was the game master's word on the same
 * losses (or men sent home), so the larger of the two is taken, not both.
 * A government the engine plays and the answer left alone calls up recruits
 * in their place, as far as `room` – those it has left to call up – allows:
 * its army keeps its numbers while its people last, and loses its training.
 * Mutates `next`; returns the soldiers each country lost, less those called up.
 */
export function takeWarLosses(
  next: GameState,
  losses: Map<string, { killed: number; wounded: number; captured: number }>,
  drafted: ReadonlyMap<string, number> = new Map(),
  room: (tag: string) => number = () => 0,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const [tag, l] of [...losses].sort((a, b) => a[0].localeCompare(b[0]))) {
    const gone = lostForGood(l);
    const cut = Math.min(0, drafted.get(tag) ?? 0);
    const take = Math.max(0, gone + cut);
    const taken = loseSoldiers(next, tag, take);
    const called = taken > 0 && !(drafted.get(tag) ?? 0) && tag !== next.player ? callUp(next, tag, Math.min(taken, room(tag))) : 0;
    if (taken - called > 0) out.set(tag, taken - called);
  }
  return out;
}

/** Heavy weapons lost, in pieces: everything but rifles. */
export const heavyLost = (l: Pick<WarLosses, "arms"> | undefined) => Object.entries(l?.arms ?? {}).reduce((sum, [kind, n]) => (kind === "rifles" ? sum : sum + (n ?? 0)), 0);

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
  return l ? seenLosses(state, l, country, `losses:${war.id}:${country}`) : null;
}

/** The last turn's losses of a side (WarLosses.last) as the government knows them, while that turn is the latest played; null otherwise. */
export function turnLossesView(state: GameState, war: War, country: string): LossesView | null {
  const last = lastLosses(state, war, country);
  return last ? seenLosses(state, last, country, `losses:${war.id}:${country}:turn:${last.turn}`) : null;
}

/** A side's part of the last turn played (WarLosses.last), if it lost anything in it. */
export function lastLosses(state: Pick<GameState, "chronicle">, war: War, country: string): WarLossesPart | null {
  const last = war.losses?.[country]?.last;
  return last && last.turn === state.chronicle.at(-1)?.turn ? last : null;
}

function seenLosses(state: GameState, l: Pick<WarLosses, "killed" | "wounded" | "captured" | "arms">, country: string, key: string): LossesView {
  const heavy = heavyLost(l);
  const exact = (n: number): Estimate => ({ value: n, low: n, high: n, exact: true });
  const captured = l.captured ?? 0;
  if (country === state.player || !fogOn(state)) return { killed: exact(l.killed), wounded: exact(l.wounded), captured: exact(captured), heavy: exact(heavy) };
  const score = knowledgeOf(state, country).score - ARMY_SECRECY;
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

import type { MapRegion, Posture, Terrain } from "./types";

/**
 * How each era fights, for the fronts (engine/fronts.ts), the losses
 * (engine/warLosses.ts) and the formations' commanders (engine/formations.ts):
 * what a posture does to the pace and the edge, how the defence of the day
 * and a line that has stood for months punish an attack, and how much the
 * era's generals lean to the frontal assault.
 *
 * The defence's advantage (`defenceAdvantage`) is the core of the losses: an
 * attack that fails costs the attacker GRIND_ATTACKER × Δ and the defender
 * GRIND_DEFENDER / Δ of the fight's base, so the ratio of their losses is
 * about 2.9 × Δ². Δ is the era's (machine guns and wire in 1915–17, mines
 * and drones since 2015), times the line's entrenchment (the months it has
 * stood), the ground (mountains, forests, marshes, a river), less what the
 * attacker's guns (and gas, in 1915–18), tanks and aircraft take off it. A
 * failed assault on a line dug in for a year and a half in 1916 comes to
 * about 12–18 : 1; a breakthrough turns it round, the side in rout paying
 * in prisoners.
 */

/** Straight lines between the years. */
export function byYear(curve: [number, number][], year: number): number {
  if (year <= curve[0][0]) return curve[0][1];
  for (let i = 1; i < curve.length; i++) {
    const [y, v] = curve[i];
    if (year <= y) {
      const [y0, v0] = curve[i - 1];
      return v0 + ((v - v0) * (year - y0)) / (y - y0);
    }
  }
  return curve[curve.length - 1][1];
}

/** How far each posture carries an attack's pace, in the share of the pace the balance of strength allows. */
export const POSTURE_PACE: Record<Posture, number> = { withdraw: 0, hold: 0, probe: 0.4, offensive: 1, assault: 1.1 };
/** What each posture adds to the edge an attack is made with, in doublings: everything thrown in, or a few battalions feeling the line. */
export const POSTURE_EDGE: Record<Posture, number> = { withdraw: 0, hold: 0, probe: -0.2, offensive: 0, assault: 0.1 };
/** How hard a holder clears an enemy lodgement in its line, by its posture: a line held still counterattacks. */
export const COUNTER_PACE: Record<Posture, number> = { withdraw: 0, hold: 0.9, probe: 0.9, offensive: 1, assault: 1.1 };
/** Doublings of edge the guns gathered for an attack give it at full preparation. */
export const PREP_EDGE = 0.25;
/** How much of a turn's fight each posture puts in, against an offensive: a counterattack of a line held still is a local one. */
export const INTENSITY: Record<Posture, number> = { withdraw: 0.15, hold: 0.5, probe: 0.35, offensive: 1, assault: 1.6 };
/** An all-out assault costs the attacker more again: men thrown in waves, reserves spent. */
export const ASSAULT_COST = 1.25;
/** A botched attack: the guns not ready, the waves sent late, the reserves too far back. */
export const BOTCHED_COST = 1.4;
export const BOTCHED_PACE = 0.6;
/** An order carried out late: half the period fought at it. */
export const LATE_SHARE = 0.5;

/** The postures from weakest to strongest, for a posture one step down. */
export const POSTURE_RANK: Record<Posture, number> = { withdraw: 0, hold: 1, probe: 2, offensive: 3, assault: 4 };
export const attacking = (p: Posture | undefined) => p === "probe" || p === "offensive" || p === "assault";

/** A failed attack's cost to the attacker and to the defender, per unit of Δ; a successful one's once the defence breaks (engine/warLosses.ts). */
export const GRIND_ATTACKER = 2;
export const GRIND_DEFENDER = 0.7;
export const ROUT_ATTACKER = 0.4;
export const ROUT_DEFENDER = 2.5;

/** The era's own defence against an attack on a line not yet dug in: machine guns and wire, then manoeuvre, then mines and drones. */
const ERA_DEFENCE: [number, number][] = [
  [1900, 1.1],
  [1914, 1.2],
  [1915, 1.35],
  [1917.5, 1.35],
  [1918.5, 1.15],
  [1930, 1.1],
  [1939, 1],
  [1946, 1],
  [1950, 1.05],
  [1952, 1.2],
  [1960, 1],
  [2010, 1],
  [2015, 1.1],
];
/** How much a line that has stood for months adds to it at most: trench systems in 1915–17 and in Korea, field works in 1939–45, minefields since 2015. */
const ERA_TRENCH: [number, number][] = [
  [1900, 0.5],
  [1914, 0.6],
  [1915, 0.85],
  [1918, 0.85],
  [1919, 0.6],
  [1939, 0.35],
  [1946, 0.35],
  [1950, 0.5],
  [1952, 0.7],
  [1960, 0.4],
  [2010, 0.4],
  [2015, 0.5],
];
/** Doublings of strength a line that has stood for months adds to what an attack needs to gain ground (engine/fronts.ts), at most. */
const ERA_DIG: [number, number][] = [
  [1900, 0.25],
  [1914.5, 0.4],
  [1915, 0.9],
  [1917.5, 0.9],
  [1918.5, 0.5],
  [1919, 0.3],
  [1939, 0.2],
  [1946, 0.2],
  [1951, 0.35],
  [1953, 0.35],
  [1960, 0.2],
  [2010, 0.2],
  [2015, 0.3],
];
/** Months over which a line digs in, after the first, which goes on foxholes: most of it within a season. */
const DIG_MONTHS = 3;
const DIG_START = 1;
/** The most months a line's age counts. */
export const MAX_DUG = 36;

/** How far a line `dug` months old has dug in, 0–1. */
export const dugIn = (dug: number | undefined) => 1 - Math.exp(-Math.max(0, (dug ?? 0) - DIG_START) / DIG_MONTHS);
/** The doublings a line's age adds to what an attack needs there. */
export const digEdge = (dug: number | undefined, year: number) => byYear(ERA_DIG, year) * dugIn(dug);

/** How the ground covers a defender: open plains least, mountains most. */
const COVER: Record<Terrain, number> = { plains: 1, desert: 0.95, hills: 1.1, forest: 1.1, tundra: 1, wetlands: 1.12, jungle: 1.15, mountains: 1.25 };

/** Gas in the attacker's preparation, 1915–18. */
const gasOf = (year: number) => (year >= 1915.3 && year < 1919 ? 0.1 : 0);

/** What an attack meets at a province: the age of the line, the ground, the attacker's guns, tanks and aircraft, the defender's drones. */
export interface DefenceTerms {
  year: number;
  dug?: number;
  region?: Pick<MapRegion, "terrain" | "rv">;
  /** The attacker's guns gathered, 0–1. */
  prep?: number;
  /** The attacker's edge in armour and in the air over the defender (engine/fronts.ts mobilityEdge), 0–1 each. */
  armour?: number;
  air?: number;
  /** The defender's drones per thousand soldiers (engine/fronts.ts SideManoeuvre). */
  drones?: number;
}

/** The defence's advantage Δ at a fight (0.7–3): what a failed attack's losses are weighed by. */
export function defenceAdvantage(t: DefenceTerms): number {
  const era = byYear(ERA_DEFENCE, t.year);
  const trench = 1 + byYear(ERA_TRENCH, t.year) * dugIn(t.dug);
  const cover = (t.region ? (COVER[t.region.terrain] ?? 1) : 1) * (t.region?.rv?.length ? 1.08 : 1);
  const guns = 1 - Math.min(0.6, (0.35 + gasOf(t.year)) * Math.min(1, Math.max(0, t.prep ?? 0)));
  const tanks = 1 - 0.3 * Math.min(1, Math.max(0, t.armour ?? 0));
  const air = 1 - 0.15 * Math.min(1, Math.max(0, t.air ?? 0));
  const drones = 1 + Math.min(0.25, 0.2 * Math.max(0, t.drones ?? 0));
  return Math.min(3, Math.max(0.7, era * trench * cover * guns * tanks * air * drones));
}

/**
 * The doctrine of the day: how readily its generals throw everything at a
 * line. The offensive à outrance of 1914–17, the human waves of Korea's
 * second year and the assault detachments of 2022–24 lean to the assault; the
 * armies of the Cold War and after to sparing their men.
 */
const ERA_ASSAULT: [number, number][] = [
  [1900, 0.4],
  [1914, 0.5],
  [1917, 0.5],
  [1918.5, 0.2],
  [1939, 0.1],
  [1946, 0.1],
  [1950, 0.25],
  [1953, 0.25],
  [1960, 0],
  [2013, 0],
  [2015, 0.2],
];
export const assaultBias = (year: number) => byYear(ERA_ASSAULT, year);

/**
 * The edge, in doublings, below which the general staff of the day still
 * calls an attack: in 1915–17 even against the odds, in later wars only with
 * the odds in hand. Pressing (`press`) it attacks wherever it is no worse than
 * this; holding, only where the odds are overwhelming.
 */
const ERA_ATTACK_AT: [number, number][] = [
  [1900, -0.5],
  [1915, -0.8],
  [1917.5, -0.8],
  [1918.5, -0.3],
  [1939, -0.2],
  [1946, -0.2],
  [1950, -0.3],
  [1953, -0.3],
  [1960, -0.1],
  [2013, -0.1],
  [2015, -0.25],
];
export const attackThreshold = (year: number, press: boolean) => (press ? byYear(ERA_ATTACK_AT, year) : 0.5);

/** The era's artillery on a quiet line: shelling, raids and snipers, against a line of 1915–17. */
const ERA_QUIET: [number, number][] = [
  [1900, 0.7],
  [1915, 1],
  [1918, 1],
  [1919, 0.7],
  [1939, 0.6],
  [1946, 0.6],
  [1950, 0.8],
  [1953, 0.8],
  [1960, 0.5],
  [2010, 0.5],
  [2015, 0.9],
];
export const quietFire = (year: number) => byYear(ERA_QUIET, year);

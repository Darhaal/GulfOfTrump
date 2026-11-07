import { yearOf } from "./calendar";
import { byYear } from "./doctrine";
import { countsFor } from "./occupation";
import { loyaltyOf } from "./politics";
import { peopleIn } from "./population";
import type { AppliedChange, GameState, MapRegion, Protest, RegimeKind } from "./types";

/**
 * The strain of a long mobilisation. Men kept under arms are missing from
 * the factories and the fields, and their families wait for them; the
 * longer it lasts and the more of them die, the more it costs and the
 * angrier people grow. The engine reads it from what it already keeps – the
 * share of the people in uniform beyond the peace's (the economy's troops),
 * the months they have been kept there (CountryState.mobilised), and the
 * soldiers the wars the country fights have killed and taken (War.losses,
 * fought by the formations of engine/formations.ts) – as a strain of 0–100:
 *
 *   x = 0.6 × (excess / 5% of the people) × (months / 12)^0.8 + (lost / 1% of the people),
 *   strain = 100 × (1 − e^−x).
 *
 * A year of Ukraine's mobilisation from 2022 – some 3% of its people under
 * arms and its dead – comes to about a third; Germany's or Russia's third
 * year of the Great War, a tenth of the people in uniform and millions dead,
 * to all of it. What the strain does:
 *
 * - the factories and the fields make less: up to MOBILISATION_LOSS of the
 *   output while the strain lasts – the soldiers' fatigue, the dead, the
 *   families waiting; the labour of the men under arms is charged once, by
 *   the draft (engine/economy.ts draftOutput) – given back as it eases
 *   (Economy.strained: a level, not a toll on growth that compounds for a
 *   decade), and the people's goods and food go shorter (engine/provision.ts,
 *   "mobilisation");
 * - the families grow angry, differently by the kind of state: where votes
 *   and a free press count, unrest follows the strain closely and the
 *   families come out early – soldiers' mothers and wives demanding the men
 *   back, then strikes, then riots (an engine-made protest, kind
 *   "mobilisation", that climbs the ladder of engine/unrest.ts and goes home
 *   once the men do); under a police state the anger stays under the
 *   surface – a lower floor under unrest – and breaks out, as strikes first,
 *   only when the state's grip slips (police and security services wavering)
 *   or unrest is already high: Petrograd in February 1917;
 * - it feeds a war's discontent with the parties (engine/partyLife.ts) and
 *   wears down the support of governments abroad (engine/abroad.ts).
 *
 * Pure and without dice.
 */

/** Soldiers per person in peacetime, by year: the economy's era table (engine/economy.ts ERAS troops). */
const PEACE: [number, number][] = [
  [1914, 0.007],
  [1939, 0.008],
  [1964, 0.008],
  [1991, 0.006],
  [1999, 0.005],
  [2014, 0.004],
];
/** Under arms beyond this many times the peace's share, a country is mobilised. */
const MOBILISED = 1.5;
/** A mobilisation as deep as this share of the people, held a year, and losses of this share of the people, each count as about a half of the strain's scale. */
const DEEP = 0.05;
const DEPTH = 0.6;
const HEAVY = 0.01;
/**
 * The share of output a full strain takes beyond the labour of the men under arms, which the draft already charged
 * (engine/economy.ts draftOutput): fatigue, the dead, the families waiting. Half of what it took when it counted the men too.
 */
export const MOBILISATION_LOSS = 0.04;
/** The floor a full strain puts under unrest, by the kind of state. */
const UNREST: Record<RegimeKind, number> = { democracy: 0.45, limited: 0.38, party: 0.18, autocracy: 0.2, military: 0.2 };
/** The strain at which the families come out (a rally), strike and riot; where the state's grip holds, a police state's people do not come out at all. */
const STAGES: Record<"open" | "police", [number, number, number]> = { open: [45, 60, 80], police: [101, 75, 90] };
/** Below this the families' protest goes home. */
const EASED = 30;
/** A police state whose police and security services are this loyal, on average, and whose unrest is below GRIP_UNREST, keeps its people off the streets. */
const GRIP_LOYALTY = 50;
const GRIP_UNREST = 50;
/** The provision a full strain takes: goods and food, shares of need. */
export const GOODS_TAKEN = 0.15;
export const FOOD_TAKEN = 0.05;

const YEAR_MS = 365.25 * 86_400_000;

/** A country's mobilisation as it bears on its people. */
export interface Strain {
  /** Share of its people under arms, and the peace's share. */
  share: number;
  norm: number;
  /** Months its people have been kept under arms beyond the peace's share. */
  months: number;
  /** Its soldiers killed and taken prisoner in the wars it fights now, share of its people. */
  lost: number;
  /** 0–100. */
  strain: number;
}

const policeState = (regime: RegimeKind | undefined) => regime === "party" || regime === "autocracy" || regime === "military";

/** Months the longest war a country fights now has gone on (not under a truce). */
function monthsAtWar(state: Pick<GameState, "wars" | "date">, tag: string): number {
  let since = "";
  for (const w of state.wars) if (!w.truce && (w.attackers.includes(tag) || w.defenders.includes(tag)) && (!since || w.since < since)) since = w.since;
  return since ? Math.max(0, (Date.parse(state.date) - Date.parse(since)) / YEAR_MS) * 12 : 0;
}

/** The peace's share of the people under arms in a year. */
export const peaceShare = (date: string) => byYear(PEACE, yearOf(date));

/**
 * A country's strain, given its people (thousands); null for one without an economy or people. `losses: false` reads
 * the depth and the months of the call-up alone, without the war's dead: what support abroad reads, the dead being
 * war-weariness's there (engine/warMeans.ts).
 */
export function strainOf(state: Pick<GameState, "countries" | "wars" | "date">, tag: string, people: number, opts: { losses?: boolean } = {}): Strain | null {
  const c = state.countries[tag];
  const e = c?.economy;
  if (!e || people <= 0 || c.dormant) return null;
  const share = e.troops / people;
  const norm = peaceShare(state.date);
  const excess = Math.max(0, share - MOBILISED * norm);
  // A save from before the record counts the time at war.
  const months = c.mobilised ?? (excess > 0 ? monthsAtWar(state, tag) : 0);
  let dead = 0;
  for (const w of state.wars) {
    const l = w.losses?.[tag];
    if (l) dead += l.killed + (l.captured ?? 0);
  }
  const lost = dead / people;
  const x = DEPTH * (excess / DEEP) * (months / 12) ** 0.8 + (opts.losses === false ? 0 : lost / HEAVY);
  return { share, norm, months: Math.round(months * 10) / 10, lost, strain: Math.round(100 * (1 - Math.exp(-x))) };
}

/** Every country's people, thousands, in one pass over the map: those of the land that counts for it (engine/occupation.ts). */
export function peopleByCountry(state: Pick<GameState, "regions">, map: Record<string, MapRegion>): Map<string, number> {
  const out = new Map<string, number>();
  for (const [id, r] of Object.entries(state.regions)) {
    const tag = countsFor(r);
    out.set(tag, (out.get(tag) ?? 0) + peopleIn(r, map[id]));
  }
  return out;
}

/** The share of output the strain takes from the factories and the fields. */
export function mobilisationLoss(strain: number): number {
  return Math.round(MOBILISATION_LOSS * (strain / 100) * 10000) / 10000;
}

/** The floor the strain puts under the player's unrest. */
export const strainUnrest = (strain: number, regime: RegimeKind) => Math.round(strain * UNREST[regime]);

/**
 * Whether a police state holds its people off the streets: its police and
 * security services loyal enough and unrest not yet high.
 */
function gripHolds(state: Pick<GameState, "politics">): boolean {
  if (!state.politics) return true;
  const l = loyaltyOf(state.politics);
  return (l.police + l.security) / 2 >= GRIP_LOYALTY && state.politics.unrest < GRIP_UNREST;
}

/** The stage the families' protest has reached at a strain, by the kind of state; null while they stay home. */
export function protestStage(strain: number, regime: RegimeKind, state: Pick<GameState, "politics">): Protest["stage"] | null {
  const police = policeState(regime);
  if (police && gripHolds(state)) return null;
  const [rally, strike, riot] = STAGES[police ? "police" : "open"];
  // A limited regime's people come out a little later than a democracy's.
  const late = regime === "limited" ? 5 : 0;
  if (strain >= riot + late) return "riot";
  if (strain >= strike + late) return "strike";
  if (strain >= rally + late) return "rally";
  return null;
}

/** The English title of the families' protest, as the game master reads it; the interface shows its own in each language. */
export const MOBILISATION_TITLE = "Families against the mobilisation";

const RANK = ["rally", "strike", "riot", "uprising"] as const;

/** How long the families stay home after their protest was dispersed or conceded, years, while the men are still kept. */
const QUIET_DISPERSED = 0.5;
const QUIET_CONCEDED = 1;

/** The day the families' protest may rise again once settled: half a year after it was dispersed, a year after it was conceded. */
export const familiesQuietUntil = (to: string, how: "dispersed" | "conceded"): string => {
  const d = new Date(`${to}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Math.round((how === "conceded" ? QUIET_CONCEDED : QUIET_DISPERSED) * 365.25));
  return d.toISOString().slice(0, 10);
};

/**
 * The strain at the end of a turn, for the player's country: the families'
 * protest started, raised a step (never more than one a turn, as every
 * protest) or sent home once the strain eases. One the game master or talks
 * dispersed or conceded stays home a while (`familiesQuiet`) instead of
 * rising again the same turn. Returns the floor the strain puts under unrest,
 * applied with the turn's other floors (engine/outcome.ts). `regime` is the
 * player's kind of state. In place.
 */
export function applyStrain(
  next: GameState,
  ctx: { turn: number; to: string; regime: RegimeKind; people: number; map: Record<string, MapRegion> | null },
  applied: AppliedChange[],
): number {
  const s = strainOf(next, next.player, ctx.people);
  if (!s) return 0;
  const floor = next.politics ? strainUnrest(s.strain, ctx.regime) : 0;
  // Settled this turn by the game master: quiet for a while.
  const settled = applied.find((c): c is Extract<AppliedChange, { kind: "protest" }> => c.kind === "protest" && c.title === MOBILISATION_TITLE && (c.change === "dispersed" || c.change === "conceded"));
  if (settled && next.politics) next.politics = { ...next.politics, familiesQuiet: familiesQuietUntil(ctx.to, settled.change === "conceded" ? "conceded" : "dispersed") };
  const quiet = next.politics?.familiesQuiet;
  if (quiet && (quiet <= ctx.to || s.strain < EASED) && next.politics) {
    const rest = { ...next.politics };
    delete rest.familiesQuiet;
    next.politics = rest;
  }
  const protests = next.protests ?? [];
  const own = protests.find((p) => p.kind === "mobilisation" && !p.country);
  const stage = next.politics?.familiesQuiet ? null : protestStage(s.strain, ctx.regime, next);
  if (own) {
    if (s.strain < EASED) {
      next.protests = protests.filter((p) => p !== own);
      if (!next.protests.length) delete next.protests;
      applied.push({ kind: "protest", title: own.title, change: "faded" });
      applied.push({ kind: "mobilisation", country: next.player, change: "eased", strain: s.strain });
      return floor;
    }
    if (stage && RANK.indexOf(stage) > RANK.indexOf(own.stage)) {
      const up = RANK[RANK.indexOf(own.stage) + 1];
      own.stage = up;
      own.support = Math.max(own.support ?? 0, Math.round(s.strain * 0.6));
      applied.push({ kind: "protest", title: own.title, change: up });
      if (up === "strike") applied.push({ kind: "mobilisation", country: next.player, change: "strikes", strain: s.strain });
    }
    return floor;
  }
  if (!stage) return floor;
  // The families come out where most people live; a police state's first protest is a strike.
  const where = ctx.map
    ? Object.entries(next.regions)
        .filter(([, r]) => r.owner === next.player && r.controller === next.player)
        .sort((a, b) => peopleIn(b[1], ctx.map![b[0]]) - peopleIn(a[1], ctx.map![a[0]]) || a[0].localeCompare(b[0]))
        .slice(0, 3)
        .map(([id]) => id)
    : [];
  const first: Protest["stage"] = stage === "riot" ? "strike" : stage;
  const size = Math.round(ctx.people * 0.002 * (s.strain / 100) * (first === "strike" ? 2 : 1));
  next.protests = [
    ...protests,
    {
      id: `protest-${ctx.turn}-mobilisation`,
      title: MOBILISATION_TITLE,
      stage: first,
      size: Math.max(1, size),
      where,
      demands: "Bring the men home: demobilise those who have served their time, no new call-ups",
      since: ctx.to,
      support: Math.round(s.strain * 0.6),
      organisation: Math.round(15 + s.strain / 4),
      kind: "mobilisation",
    },
  ];
  applied.push({ kind: "protest", title: MOBILISATION_TITLE, change: "new" });
  applied.push({ kind: "mobilisation", country: next.player, change: first === "strike" ? "strikes" : "demands", strain: s.strain });
  return floor;
}

/**
 * The months each country has been kept under arms, moved on by a turn:
 * they grow while it is mobilised at war and wind down twice as fast once it
 * is not, or the war is over. In place on `next`, with every country's people.
 */
export function trackMobilisation(next: GameState, years: number, people: ReadonlyMap<string, number>): void {
  const months = years * 12;
  const norm = peaceShare(next.date);
  for (const [tag, c] of Object.entries(next.countries)) {
    const e = c.economy;
    const n = people.get(tag) ?? 0;
    if (!e || n <= 0 || c.dormant) {
      delete c.mobilised;
      continue;
    }
    const excess = e.troops / n - MOBILISED * norm;
    // A standing army in peacetime is not a mobilisation: the months count while the country is at war.
    const atWar = next.wars.some((w) => w.attackers.includes(tag) || w.defenders.includes(tag));
    const had = c.mobilised ?? (excess > 0 ? monthsAtWar(next, tag) : 0);
    const now = excess > 0 && atWar ? had + months : had - 2 * months;
    if (now > 0) c.mobilised = Math.round(now * 100) / 100;
    else delete c.mobilised;
  }
}

/** How fast a government the engine plays calls up its reserves towards what the war needs, a year: 39% of the way in a month. */
const CALL_PACE = 6;
/** How fast it sends them home after the peace, a year: half of them in about five months. */
const HOME_PACE = 1.5;
/** The share of its people in provinces the enemy holds or fights in at which a country calls up all that the war needs. */
const CALL_FULL = 0.05;

/**
 * The enemy's soldiers a country faces in its wars, beyond its allies' own: each standing army (without the reservists
 * it called up itself, so that two call-ups do not feed each other) split between the wars it fights, and weighed by how
 * near it is (relations' closeness: a tenth for an army from the other side of the world – the Americans in Vietnam).
 */
function enemyBeyondAllies(state: Pick<GameState, "countries" | "wars">, tag: string): number {
  const wars = state.wars.filter((w) => !w.truce);
  const ties = state.countries[tag]?.course?.ties;
  const split = (t: string) => {
    const e = state.countries[t]?.economy;
    const standing = e ? Math.max(0, e.troops - (e.called ?? 0)) : 0;
    const near = (ties?.[t]?.near ?? 50) / 100;
    return (standing * near) / Math.max(1, wars.filter((w) => w.attackers.includes(t) || w.defenders.includes(t)).length);
  };
  let need = 0;
  for (const w of wars) {
    const mine = w.attackers.includes(tag) ? w.attackers : w.defenders.includes(tag) ? w.defenders : null;
    if (!mine) continue;
    const theirs = mine === w.attackers ? w.defenders : w.attackers;
    const enemy = theirs.reduce((s, t) => s + split(t), 0);
    const friends = mine.reduce((s, t) => s + (t === tag ? 0 : split(t)), 0);
    need += Math.max(0, enemy - friends);
  }
  return need;
}

/**
 * The soldiers a government the engine plays calls up (+) or sends home (−) this turn, thousands. With the enemy on its
 * own soil it calls up its reserves towards an army as large as the enemy's beyond its allies', within those it has to
 * call up, the more of it the more of its people the fighting reaches (all of it from a twentieth): Israel's 45 thousand
 * in peacetime became some 260 thousand in 1967. A war fought away from home it fights with the army it has, and
 * readiness is the reservists' only weight there (engine/warMeans.ts). After the peace, or under a truce, those it called
 * up go home over months. Economy.called keeps the count; the economy charges their labour and pay (engine/economy.ts).
 */
export function warCallUp(state: Pick<GameState, "countries" | "wars">, tag: string, ctx: { atWar: boolean; atHome: number; mobilisable: number; years: number }): number {
  const e = state.countries[tag]?.economy;
  if (!e) return 0;
  const called = Math.min(e.called ?? 0, e.troops);
  if (!ctx.atWar) return called > 0 ? -(called < 1 ? called : called * (1 - Math.exp(-HOME_PACE * ctx.years))) : 0;
  if (ctx.atHome <= 0) return 0;
  const base = e.troops - called;
  const target = Math.min(Math.max(0, ctx.mobilisable - base), Math.max(0, enemyBeyondAllies(state, tag) - base)) * Math.min(1, ctx.atHome / CALL_FULL);
  return target > called ? (target - called) * (1 - Math.exp(-CALL_PACE * ctx.years)) : 0;
}

/** The strain for the game master: "mobilisation: 3.1% of the people under arms (peace 0.4%) for 12 months; 0.2% of the people lost; strain 34/100". */
export function strainLine(s: Strain, regime: RegimeKind | undefined): string {
  const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;
  const how = policeState(regime) ? "a police state: anger stays under the surface while the police hold" : "people speak and vote: anger shows";
  return `mobilisation: ${pct(s.share)} of the people under arms (peace ${pct(s.norm)}) for ${Math.round(s.months)} months; ${pct(s.lost)} of the people killed or taken in its wars; strain ${s.strain}/100 (${how}; it takes ${Math.round(mobilisationLoss(s.strain) * 1000) / 10}% of output and some of the people's goods while it lasts)`;
}

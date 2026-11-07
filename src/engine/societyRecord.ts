import { classesOf, classFloor, moveMoods, voicedMood, type ClassView, type TurnToll } from "./classes";
import { ministryOf } from "./figures";
import { estimate, estimateRate } from "./fog";
import { advanceIndustry, industryOf } from "./industry";
import { dressing, insideSight } from "./official";
import { provisionOf, type Provision } from "./provision";
import { lifeExpectancy, societyOf, type Society } from "./society";
import { SOCIAL_CLASSES, type AppliedChange, type GameState, type MapRegion, type SocietyPoint, type SocietyTrack } from "./types";

/**
 * The society tab's record: how the player's people moved, a point a turn,
 * kept in the save (`SocietyTrack.record`). Each point holds the levels at
 * the turn's end – people, births and deaths, life expectancy, schooling,
 * towns, incomes and inequality, the jobless, the people's provision,
 * heavy industry's share, the classes' moods – and what the turn cost:
 * refugees out and in, people deported, soldiers killed, civilians dead and
 * the dead of the state's crimes. The record opens on the first turn played
 * after step 50 with the game as it stood before that turn, and the
 * pyramid of that day is kept beside it. It never holds more than
 * RECORD_MAX points: past that the oldest half is thinned, two points made
 * one that keeps the later levels and the sum of both turns' flows, so a
 * long game keeps its whole course coarsely and its recent turns finely,
 * and no toll is lost.
 *
 * `advancePeople` runs once a turn, after the society (engine/society.ts):
 * every economy's two industries move (engine/industry.ts), the player's
 * classes take their moods (engine/classes.ts) – which may hold unrest up –
 * and the turn goes into the record. A role that does not govern reads the
 * record as it would know it (`seenRecord`): a minister of the interior and
 * the leader's office the state's own statistics, other ministers and
 * generals roughly, the opposition the official figures – dressed up as
 * the kind of rule and the press let the government, the crimes' toll kept
 * secret where it can.
 */

/** The most points a record keeps. */
export const RECORD_MAX = 96;

const round1 = (v: number) => Math.round(v * 10) / 10;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The flows of a point, summed when two are made one. */
const FLOWS = ["out", "in", "dep", "war", "civ", "crime"] as const;
type Flow = (typeof FLOWS)[number];

/** Two points made one: the later levels, the flows of both. */
function merge(a: SocietyPoint, b: SocietyPoint): SocietyPoint {
  const out: SocietyPoint = { ...b };
  for (const k of FLOWS) {
    const v = (a[k] ?? 0) + (b[k] ?? 0);
    if (v > 0) out[k] = round1(v);
    else delete out[k];
  }
  return out;
}

/** A record kept within RECORD_MAX: the first point (the start) as it is, the oldest of the rest merged in pairs. */
export function thinRecord(points: SocietyPoint[]): SocietyPoint[] {
  if (points.length <= RECORD_MAX) return points;
  const [first, ...rest] = points;
  const half = Math.floor(rest.length / 2);
  const old: SocietyPoint[] = [];
  for (let i = 0; i + 1 < half; i += 2) old.push(merge(rest[i], rest[i + 1]));
  if (half % 2) old.push(rest[half - 1]);
  const thinned = [first, ...old, ...rest.slice(half)];
  return thinned.length > RECORD_MAX ? thinRecord(thinned) : thinned;
}

/** What the turn cost the player's people, thousands, read off the turn's changes and the wars' records. */
function tollOf(before: GameState, next: GameState, applied: readonly AppliedChange[]): Pick<SocietyPoint, Flow> & { struck: number } {
  const me = next.player;
  let out = 0;
  let came = 0;
  let civ = 0;
  let crime = 0;
  let dep = 0;
  let struck = 0;
  for (const c of applied) {
    if (c.kind === "population") {
      if (c.country === me) {
        out += c.refugees;
        civ += c.deaths;
      } else if (c.to === me) came += c.refugees;
    } else if (c.kind === "crime" && c.by === me && (c.result === "done" || c.result === "ongoing")) {
      crime += c.toll;
      dep += c.moved ?? 0;
      struck += (c.moved ?? 0) + (c.held ?? 0);
    }
  }
  let war = 0;
  const was = new Map(before.wars.map((w) => [w.id, w.losses?.[me]?.killed ?? 0]));
  for (const w of next.wars) war += Math.max(0, (w.losses?.[me]?.killed ?? 0) - (was.get(w.id) ?? 0));
  const flows: Pick<SocietyPoint, Flow> = {};
  const put = (k: Flow, v: number) => {
    if (v >= 0.05) flows[k] = round1(v);
  };
  put("out", out);
  put("in", came);
  put("dep", dep);
  put("war", war);
  put("civ", civ);
  put("crime", crime);
  return { ...flows, struck };
}

/** A point of the record: the levels of a state, and its flows. */
function pointOf(state: GameState, map: Record<string, MapRegion>, s: Society, provision: Provision | null, vitals: { born: number; died: number } | undefined, moods: number[] | undefined, flows: Pick<SocietyPoint, Flow>): SocietyPoint {
  const e = state.countries[state.player]?.economy;
  const level = (kind: string) => provision?.lines.find((l) => l.kind === kind)?.level ?? 100;
  const industry = industryOf(state, map, state.player);
  return {
    d: state.date,
    p: Math.round(s.people),
    b: vitals?.born ?? 0,
    m: vitals?.died ?? 0,
    e: lifeExpectancy(state, map, state.player) ?? 0,
    lit: s.literate,
    urb: s.urban,
    inc: s.income,
    gini: s.gini,
    poor: s.poor,
    rich: s.rich,
    job: round1(e?.unemployment ?? s.jobless),
    pro: provision?.overall ?? 100,
    med: level("medicine"),
    hv: industry?.heavy ?? 0,
    ...(moods ? { mood: moods } : {}),
    ...flows,
  };
}

/** The pyramid of a society, men and women in each band as % of its people. */
const pyramidOf = (s: Society) => ({ m: s.bands.map((b) => Math.round((b.m / Math.max(1, s.people)) * 1e4) / 100), f: s.bands.map((b) => Math.round((b.f / Math.max(1, s.people)) * 1e4) / 100) });

/** What a turn's people are moved by. */
export interface PeopleContext {
  years: number;
  /** The date the turn ends: its point's. */
  to: string;
  map: Record<string, MapRegion> | null;
  applied: readonly AppliedChange[];
  /** The player's births and deaths over the turn, a year per thousand (engine/society.ts advanceSociety). */
  vitals?: { born: number; died: number };
}

/**
 * The people after a turn, in place on `next`, once the society has moved
 * (engine/society.ts advanceSociety): every economy's two industries, then
 * the player's classes and the turn's point in the record. Returns the floor
 * the classes put under unrest, applied with the turn's other floors
 * (engine/outcome.ts). Without the map only the industries move.
 */
export function advancePeople(before: GameState, next: GameState, { years, to, map, applied, vitals }: PeopleContext): number {
  advanceIndustry(before, next, years);
  if (!map || years <= 0) return 0;
  const me = next.player;
  const s = societyOf(next, map, me);
  if (!s || !next.countries[me]?.economy) return 0;
  const provision = provisionOf(next, me, map);
  const { struck, ...flows } = tollOf(before, next, applied);
  const toll: TurnToll = { killed: flows.war ?? 0, crimes: flows.crime ?? 0, struck, years };
  const track: SocietyTrack = { ...next.society?.[me] };

  // The classes take their moods, most of the way to the times' within the year.
  const views = classesOf(next, s, provision, toll);
  const moods = moveMoods(track.classes, views, years);
  track.classes = moods;
  // Angry classes that count keep the street restless whatever the game master writes.
  const floor = next.politics ? classFloor(voicedMood(moods)) : 0;

  // The record: opened with the game as it stood before this turn, then a point a turn.
  const record = [...(track.record ?? [])];
  if (!record.length) {
    const s0 = societyOf(before, map, me);
    if (s0) {
      const p0 = provisionOf(before, me, map);
      const views0 = classesOf(before, s0, p0);
      record.push(pointOf(before, map, s0, p0, vitals, views0.map((v) => v.target), {}));
      track.first = pyramidOf(s0);
    }
  }
  record.push({ ...pointOf(next, map, s, provision, vitals, SOCIAL_CLASSES.map((id) => moods[id].mood), flows), d: to });
  track.record = thinRecord(record);
  next.society = { ...next.society, [me]: track };
  return floor;
}

// --- what a role knows of it ---------------------------------------------------

/** How the player has their own society's figures: the truth, the state's statistics exactly, an estimate, or the official figures. */
export type SocietySight = "true" | "exact" | "estimated" | "official";

type SightState = Pick<GameState, "role" | "politics" | "scenarioId" | "player" | "defeat" | "seed" | "id">;

/** How the player's role knows the society: the leader the truth; the interior and the leader's office the state's statistics; other ministers and generals roughly; the opposition what is published. */
export function societySight(state: SightState): { sight: SocietySight; dressed: number; score: number } {
  const role = state.role;
  if (!role || role.kind === "leader") return { sight: "true", dressed: 0, score: 100 };
  if (role.kind === "opposition") {
    const d = dressing(state);
    return d > 0 ? { sight: "official", dressed: d, score: 100 } : { sight: "true", dressed: 0, score: 100 };
  }
  const ministry = role.kind === "minister" && role.post ? ministryOf(role.post) : undefined;
  if (ministry === "interior" || ministry === "chief") return { sight: "exact", dressed: 0, score: 100 };
  return { sight: "estimated", dressed: 0, score: insideSight(role, "unrest") };
}

/** How a government dresses each figure up, `d` from 0 (a free press) to 1; undefined: not published. */
const DRESS: Partial<Record<keyof SocietyPoint, (v: number, d: number) => number | undefined>> = {
  poor: (v, d) => v * (1 - 0.5 * d),
  rich: (v, d) => v * (1 - 0.4 * d),
  job: (v, d) => v * (1 - 0.9 * d),
  e: (v, d) => v + 4 * d,
  m: (v, d) => v * (1 - 0.15 * d),
  lit: (v, d) => v + (100 - v) * 0.6 * d,
  inc: (v, d) => v * (1 + 0.15 * d),
  gini: (v, d) => v * (1 - 0.25 * d),
  pro: (v, d) => v + (100 - v) * 0.6 * d,
  med: (v, d) => v + (100 - v) * 0.6 * d,
  out: (v, d) => v * (1 - 0.8 * d),
  war: (v, d) => v * (1 - 0.6 * d),
  civ: (v, d) => v * (1 - 0.8 * d),
  crime: (v, d) => (d >= 0.5 ? undefined : v * (1 - d)),
  dep: (v, d) => (d >= 0.5 ? undefined : v * (1 - d)),
};
/** How far off a guess at each figure may be at the least known, in its own points; the rest are guessed as a share of themselves. */
const WIDTH: Partial<Record<keyof SocietyPoint, number>> = { b: 4, m: 3, e: 4, lit: 6, urb: 6, gini: 6, poor: 10, rich: 4, job: 6, pro: 10, med: 10, hv: 8 };
const RELATIVE: (keyof SocietyPoint)[] = ["p", "inc", "out", "in", "dep", "war", "civ", "crime"];

/** A record as the player's role knows it: the truth, or each figure dressed up or guessed as the role would have it. */
export function seenRecord(state: SightState, points: SocietyPoint[]): SocietyPoint[] {
  const { sight, dressed, score } = societySight(state);
  if (sight === "true" || sight === "exact") return points;
  return points.map((pt, i) => {
    const out: SocietyPoint = { ...pt };
    if (sight === "official") {
      for (const [k, f] of Object.entries(DRESS) as [keyof SocietyPoint, (v: number, d: number) => number | undefined][]) {
        const v = pt[k];
        if (typeof v !== "number") continue;
        const shown = f(v, dressed);
        if (shown === undefined) delete (out as unknown as Record<string, unknown>)[k];
        else (out as unknown as Record<string, number>)[k] = round1(shown);
      }
      // The unity of the people: every class content, as the papers have it.
      if (pt.mood) out.mood = pt.mood.map((m) => Math.round(m + (75 - m) * 0.6 * dressed));
      return out;
    }
    const at = { seed: state.seed, id: state.id, turn: i };
    for (const k of Object.keys(WIDTH) as (keyof SocietyPoint)[]) {
      const v = pt[k];
      if (typeof v === "number") (out as unknown as Record<string, number>)[k] = estimateRate(v, score, WIDTH[k]!, at, `society:${k}`, [0, Infinity]).value;
    }
    for (const k of RELATIVE) {
      const v = pt[k];
      if (typeof v === "number" && v > 0) (out as unknown as Record<string, number>)[k] = estimate(v, score, at, `society:${k}`).value;
    }
    if (pt.mood) out.mood = pt.mood.map((m, j) => Math.round(clamp(estimateRate(m, score, 15, at, `society:mood${j}`).value, 0, 100)));
    return out;
  });
}

/** The classes as the player's role knows them: an opposition reads the papers' content people where the press is not free. */
export function seenClasses(state: SightState, views: ClassView[]): ClassView[] {
  const { sight, dressed, score } = societySight(state);
  if (sight === "true" || sight === "exact") return views;
  if (sight === "official") return views.map((v) => ({ ...v, mood: Math.round(v.mood + (75 - v.mood) * 0.6 * dressed), target: Math.round(v.target + (75 - v.target) * 0.6 * dressed) }));
  return views.map((v) => {
    const mood = Math.round(clamp(estimateRate(v.mood, score, 15, { seed: state.seed, id: state.id, turn: 0 }, `society:class:${v.id}`).value, 0, 100));
    return { ...v, mood, target: mood };
  });
}

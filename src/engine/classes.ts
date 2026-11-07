import { yearOf } from "./calendar";
import { warOnOwnSoil } from "./colonialLand";
import { leanOf } from "./development";
import { budgetNorms } from "./economy";
import { plannedness } from "./industry";
import { provisionOf, type Provision } from "./provision";
import { regimeNow } from "./role";
import { societyOf, type Society } from "./society";
import { CLASS_WANTS, SOCIAL_CLASSES, type ClassMood, type ClassWant, type GameState, type MapRegion, type OpinionCamp, type SocialClass, type SocietyTrack } from "./types";

/**
 * The people widened: five classes – workers, peasants, the middle class,
 * the intelligentsia and the elites, named by the era and the system (the
 * collective farmers, the office workers and the nomenklatura of a planned
 * economy; the nobility and the rich before the Great War) – each with its
 * share of the adults, its mood and what it wants most.
 *
 * The shares are read off the society (engine/society.ts): the elites from
 * the rich (a planned economy's nomenklatura is a thin, fixed layer), the
 * intelligentsia from schooling and the decades (one in a hundred adults in
 * 1914, a tenth by 1950 where all can read, a quarter today), the peasants
 * from the farms, the workers from industry and a third of the services,
 * the middle class the rest.
 *
 * A mood (0 angry, 50 neither, 100 content) moves each turn towards what the
 * times make it – about two thirds of the way in nine months – by what bears
 * on each class: growth or a slump, jobs, prices, the goods in the shops and
 * the bread, the social budget, taxes, the war and its dead, how unfree the
 * country is and what the state did to its people this turn, light industry
 * against heavy, disorder in the streets. Each weighs on the classes it
 * touches: joblessness on the workers, prices on the middle class, taxes on
 * the elites, censorship and terror on the intelligentsia, the war's dead on
 * the peasants who give the soldiers. What hurts a class most is what it
 * wants.
 *
 * The moods feed the rest: unrest has a floor where the classes that count
 * are angry (the more vocal the class, the more it counts), an angry class
 * swells the camps of opinion it leans to (engine/partyLife.ts) – and the
 * game master is told, for the street and the elections. Pure.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

/** A mood moves this share of the way to its target in a year: two thirds in nine months. */
const MOOD_YEARS = 0.75;
/** The mood of a class when nothing bears on it: a little content. */
const BASE_MOOD = 55;
/** The usual joblessness and inflation, %: past them they hurt. */
const USUAL_JOBLESS = 5;
const USUAL_PRICES = 5;

/** What bears on the classes now, each in its own units. */
export interface Pressures {
  /** Real growth, % a year. */
  growth: number;
  /** Jobless past the usual, points; inflation past the usual, points. */
  jobless: number;
  prices: number;
  /** Goods and food short of need, points. */
  goods: number;
  food: number;
  /** The social line against the era's usual share, −1 to 2. */
  welfare: number;
  /** Taxes past the era's usual take, points of GDP. */
  taxes: number;
  /** 0 at peace, 0.4 a war abroad, 1 a war on the land. */
  war: number;
  /** The war's and the state's dead this turn, a year per thousand people. */
  dead: number;
  /** How unfree the country is, 0–1, and what the state did to its people this turn, 0–1. */
  unfree: number;
  terror: number;
  /** Points light industry stands past its usual share (heavy past it: negative). */
  light: number;
  /** Unrest past 30, points. */
  disorder: number;
}

type Term = "econ" | "jobs" | "prices" | "goods" | "food" | "welfare" | "taxes" | "war" | "freedom" | "light" | "order";

/** Each term's points, before a class weighs it. */
function terms(p: Pressures): Record<Term, number> {
  return {
    econ: clamp(2.5 * p.growth, -15, 10),
    jobs: -clamp(1.5 * p.jobless, -5, 25),
    prices: -clamp(0.5 * p.prices, 0, 25),
    goods: -clamp(0.4 * p.goods, 0, 20),
    food: -clamp(0.6 * p.food, 0, 30),
    welfare: clamp(8 * p.welfare, -8, 8),
    taxes: -clamp(0.6 * p.taxes, -5, 15),
    war: -8 * clamp(p.war, 0, 1) - clamp(4 * p.dead, 0, 20),
    freedom: -15 * clamp(p.unfree, 0, 1) - 20 * clamp(p.terror, 0, 1),
    light: clamp(0.25 * p.light, -6, 6),
    order: -clamp(0.3 * p.disorder, 0, 15),
  };
}

/** How much each term weighs on each class. */
const WEIGHTS: Record<SocialClass, Record<Term, number>> = {
  workers: { econ: 1, jobs: 1.2, prices: 1, goods: 1, food: 1.2, welfare: 1, taxes: 0.3, war: 1, freedom: 0.3, light: 1, order: 0.2 },
  peasants: { econ: 0.6, jobs: 0.3, prices: 0.5, goods: 0.5, food: 0.4, welfare: 0.6, taxes: 0.5, war: 1.2, freedom: 0.2, light: 0.4, order: 0.2 },
  middle: { econ: 1, jobs: 0.8, prices: 1.3, goods: 1.2, food: 0.9, welfare: 0.5, taxes: 1, war: 0.9, freedom: 0.6, light: 1, order: 0.6 },
  intelligentsia: { econ: 0.6, jobs: 0.5, prices: 0.9, goods: 0.9, food: 0.9, welfare: 0.8, taxes: 0.4, war: 1, freedom: 1.5, light: 0.6, order: 0.3 },
  elites: { econ: 1.2, jobs: 0.2, prices: 0.4, goods: 0.2, food: 0.2, welfare: -0.3, taxes: 1.5, war: 0.5, freedom: 0.1, light: 0, order: 1.2 },
};

/** What a class wants when a term hurts it most. */
const WANT_OF: Record<Term, ClassWant> = { econ: "growth", jobs: "jobs", prices: "prices", goods: "goods", food: "bread", welfare: "welfare", taxes: "taxes", war: "peace", freedom: "freedom", light: "goods", order: "order" };
/** What a class wants when nothing hurts it. */
const STANDING_WANT: Record<SocialClass, ClassWant> = { workers: "wages", peasants: "land", middle: "stability", intelligentsia: "freedom", elites: "order" };
/** How loud a class is when the street and the parties hear it: the elites and the educated count for more than their numbers. */
const VOICE: Record<SocialClass, number> = { workers: 1, peasants: 0.7, middle: 1.1, intelligentsia: 1.4, elites: 1.6 };

/** The camps of opinion each class leans to when it is angry (engine/partyLife.ts). */
export const CLASS_CAMPS: Record<SocialClass, Partial<Record<OpinionCamp, number>>> = {
  workers: { communist: 1, socialist: 1 },
  peasants: { agrarian: 1.5, religious: 0.5, nationalist: 0.3 },
  middle: { liberal: 0.7, conservative: 0.6, nationalist: 0.4 },
  intelligentsia: { liberal: 1.2, green: 0.6, socialist: 0.4 },
  elites: { conservative: 1, nationalist: 0.6 },
};

/** Each class's share of the adults, %, from a society, the year and how planned the economy is. */
export function classShares(s: Pick<Society, "rich" | "literate" | "farm" | "industry" | "services">, year: number, planned: number): Record<SocialClass, number> {
  const elites = planned >= 0.7 ? clamp(1 + s.rich * 0.3, 1, 3) : clamp(0.5 + s.rich * 0.45, 0.5, 8);
  const intelligentsia = clamp((1 + 0.2 * (year - 1900)) * (s.literate / 100) ** 2, 0.5, 25);
  const base = 100 - elites - intelligentsia;
  const peasants = (base * s.farm) / 100;
  const workers = (base * clamp(s.industry + 0.35 * s.services, 0, 100 - s.farm)) / 100;
  const middle = Math.max(0, base - peasants - workers);
  return { workers: round1(workers), peasants: round1(peasants), middle: round1(middle), intelligentsia: round1(intelligentsia), elites: round1(elites) };
}

/** How unfree a country is, 0–1: its kind of rule and its laws on the press, assembly, elections and leaving. */
export function unfreedom(state: Pick<GameState, "politics" | "scenarioId" | "player"> & Partial<Pick<GameState, "defeat">>): number {
  const regime = regimeNow(state);
  const laws = state.politics?.laws ?? {};
  let u = { democracy: 0, limited: 0.25, party: 0.6, autocracy: 0.5, military: 0.5 }[regime];
  u += laws.press === "state" ? 0.2 : laws.press === "censored" ? 0.15 : laws.press === "restricted" ? 0.05 : 0;
  u += laws.assembly === "banned" ? 0.1 : laws.assembly === "permit" ? 0.03 : 0;
  u += laws.elections === "suspended" ? 0.05 : 0;
  u += laws.exit === "closed" ? 0.05 : 0;
  u += laws.martial === "martial" ? 0.1 : laws.martial === "emergency" ? 0.05 : 0;
  return round1(clamp(u, 0, 1) * 100) / 100;
}

/** A class now: its share, its mood and what it wants, and where the times are taking its mood. */
export interface ClassView extends ClassMood {
  id: SocialClass;
  /** The mood the times make, which the kept one moves towards. */
  target: number;
}

/** The moods the times make, and what each class wants, from the pressures, how planned the economy is and the elites' loyalty. */
export function classTargets(p: Pressures, planned: number, elitesLoyalty?: number): Record<SocialClass, { mood: number; want: ClassWant }> {
  const t = terms(p);
  const out = {} as Record<SocialClass, { mood: number; want: ClassWant }>;
  for (const id of SOCIAL_CLASSES) {
    const w = WEIGHTS[id];
    let mood = BASE_MOOD;
    let worst: Term | undefined;
    let worstValue = -3;
    for (const k of Object.keys(t) as Term[]) {
      const v = t[k] * w[k];
      mood += v;
      if (v < worstValue) {
        worst = k;
        worstValue = v;
      }
    }
    // A planned economy keeps its nomenklatura in privilege and its peasants on the collective farms.
    if (id === "elites") mood += 8 * planned;
    if (id === "peasants") mood -= 6 * planned;
    // The elites are as loyal as the pillar the government's politics keep for them.
    if (id === "elites" && elitesLoyalty !== undefined) mood = 0.6 * mood + 0.4 * elitesLoyalty;
    out[id] = { mood: Math.round(clamp(mood, 0, 100)), want: worst ? WANT_OF[worst] : STANDING_WANT[id] };
  }
  return out;
}

/** What the turn did that bears on the moods, beside the state's figures. */
export interface TurnToll {
  /** Soldiers killed and the dead of the state's crimes this turn, thousands. */
  killed: number;
  crimes: number;
  /** People the state arrested, deported or shot this turn, thousands. */
  struck: number;
  years: number;
}

type ClassState = Pick<GameState, "countries" | "player" | "date" | "scenarioId" | "regions" | "wars"> & Partial<Pick<GameState, "politics" | "society" | "defeat" | "colonies">>;

/** What bears on the player's classes now. */
export function pressuresOf(state: ClassState, s: Pick<Society, "people">, provision: Provision | null, toll?: TurnToll): Pressures {
  const e = state.countries[state.player]?.economy;
  const gdp = Math.max(0.01, e?.gdp ?? 0.01);
  const norms = budgetNorms(state, state.player, null);
  const level = (kind: string) => provision?.lines.find((l) => l.kind === kind)?.level ?? 100;
  const fighting = state.wars.filter((w) => (w.attackers.includes(state.player) || w.defenders.includes(state.player)) && !(w.truce && w.truce.until > state.date));
  // A war on the country's own soil weighs fully; any other – a colonial war on a colony's land among them – as a war away (engine/colonialLand.ts).
  const home = fighting.length > 0 && warOnOwnSoil(state, state.player);
  const years = Math.max(toll?.years ?? 0.25, 1 / 52);
  const perThousand = (n: number) => (n / Math.max(1, s.people)) * 1000 / years;
  return {
    growth: e?.growth ?? 0,
    jobless: (e?.unemployment ?? USUAL_JOBLESS) - USUAL_JOBLESS,
    prices: Math.max(0, (e?.inflation ?? 0) - USUAL_PRICES),
    goods: 100 - level("goods"),
    food: 100 - level("food"),
    welfare: e ? clamp(e.budget.social / gdp / Math.max(0.005, norms.social) - 1, -1, 2) : 0,
    taxes: e ? (e.budget.revenue / gdp - (norms.taxes - 0.05)) * 100 : 0,
    war: home ? 1 : fighting.length ? 0.4 : 0,
    dead: toll ? perThousand(toll.killed + toll.crimes) : 0,
    unfree: unfreedom(state),
    terror: toll ? clamp(perThousand(toll.struck + toll.crimes) / 2, 0, 1) : 0,
    light: -leanOf(e),
    disorder: Math.max(0, (state.politics?.unrest ?? 0) - 30),
  };
}

/** The player's classes now: the shares from the society, the moods as the last turn left them (or the times', before the first). */
export function classesOf(state: ClassState, s: Society, provision: Provision | null, toll?: TurnToll): ClassView[] {
  const planned = plannedness(state, state.player);
  const shares = classShares(s, yearOf(state.date), planned);
  const targets = classTargets(pressuresOf(state, s, provision, toll), planned, state.politics?.loyalty?.elites);
  const kept = state.society?.[state.player]?.classes;
  return SOCIAL_CLASSES.map((id) => {
    const k = kept?.[id];
    return { id, share: shares[id], mood: k?.mood ?? targets[id].mood, want: k?.want ?? targets[id].want, target: targets[id].mood };
  });
}

/** Each class's mood after a turn of `years`: most of the way to the times' within the year. */
export function moveMoods(kept: SocietyTrack["classes"], views: ClassView[], years: number): Record<SocialClass, ClassMood> {
  const k = 1 - Math.exp(-Math.max(0, years) / MOOD_YEARS);
  return Object.fromEntries(
    views.map((v) => {
      const was = kept?.[v.id]?.mood;
      const mood = was === undefined || !Number.isFinite(was) ? v.target : Math.round(clamp(was + (v.target - was) * k, 0, 100));
      return [v.id, { share: v.share, mood, want: CLASS_WANTS.includes(v.want) ? v.want : STANDING_WANT[v.id] }];
    }),
  ) as Record<SocialClass, ClassMood>;
}

/** The classes' mood as the street hears it, 0–100: each by its share and how loud it is. */
export function voicedMood(classes: Partial<Record<SocialClass, Pick<ClassMood, "share" | "mood">>>): number | null {
  let w = 0;
  let sum = 0;
  for (const id of SOCIAL_CLASSES) {
    const c = classes[id];
    if (!c || !(c.share > 0)) continue;
    w += c.share * VOICE[id];
    sum += c.share * VOICE[id] * c.mood;
  }
  return w > 0 ? sum / w : null;
}

/** Below this voiced mood the classes hold unrest up: a point and a half for every point short of it, at most 40. */
const FLOOR_MOOD = 42;
export const classFloor = (voiced: number | null): number => (voiced === null ? 0 : Math.round(clamp((FLOOR_MOOD - voiced) * 1.5, 0, 40)));

/**
 * How much each camp of opinion swells with the classes' anger, a factor for
 * each (engine/partyLife.ts opinionOf): an angry class's share, as far as it
 * is angry, goes to the camps it leans to.
 */
export function campTilt(classes: SocietyTrack["classes"] | undefined): Partial<Record<OpinionCamp, number>> | undefined {
  if (!classes) return undefined;
  const out: Partial<Record<OpinionCamp, number>> = {};
  for (const id of SOCIAL_CLASSES) {
    const c = classes[id];
    if (!c) continue;
    const anger = clamp((50 - c.mood) / 40, 0, 1);
    if (anger <= 0) continue;
    for (const [camp, lean] of Object.entries(CLASS_CAMPS[id]) as [OpinionCamp, number][]) out[camp] = (out[camp] ?? 1) + (c.share / 100) * anger * lean * 2;
  }
  return Object.keys(out).length ? out : undefined;
}

/** A class's name in the prompt, by the system and the era. */
function classEn(id: SocialClass, planned: number, year: number): string {
  if (planned >= 0.7) return { workers: "workers", peasants: "collective farmers", middle: "office workers", intelligentsia: "intelligentsia", elites: "nomenklatura" }[id];
  if (year < 1918 && id === "elites") return "nobility and the rich";
  return { workers: "workers", peasants: "peasants", middle: "middle class", intelligentsia: "intelligentsia", elites: "elites" }[id];
}

/**
 * The player's classes for the game master, in a line: share, mood and
 * want, the camps the angry ones lean to – so the street, the strikes and
 * the vote follow them.
 */
export function classesLine(state: ClassState, views: ClassView[]): string {
  if (!views.length) return "";
  const planned = plannedness(state, state.player);
  const year = yearOf(state.date);
  const each = views.map((v) => `${classEn(v.id, planned, year)} ${Math.round(v.share)}% mood ${v.mood}${v.target !== v.mood ? `→${v.target}` : ""} (wants ${v.want})`);
  const angry = views.filter((v) => v.mood < 40).map((v) => `${classEn(v.id, planned, year)} to ${Object.keys(CLASS_CAMPS[v.id]).join("/")}`);
  return `the people by class (share of adults, mood 0 angry – 100 content, → where the times take it, what it wants most): ${each.join("; ")}${angry.length ? `; the angry swell the camps they lean to: ${angry.join(", ")} – strikes, protests and votes follow them` : "; no class is angry"}`;
}

/** The player's classes for the game master, read off the state as it stands: "" without a society. */
export function describeClasses(state: ClassState & Partial<Pick<GameState, "deals" | "research" | "variant" | "sanctions">>, map: Record<string, MapRegion> | null | undefined): string {
  if (!map) return "";
  const s = societyOf(state, map, state.player);
  if (!s) return "";
  return classesLine(state, classesOf(state, s, provisionOf(state, state.player, map)));
}

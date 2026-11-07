import { yearOf } from "./calendar";
import { provinceIncome, RICH_INCOME, socialNorm } from "./economy";
import { estimateRate, type Estimate } from "./fog";
import { countsFor } from "./occupation";
import { peopleIn } from "./population";
import { DOLLAR } from "./prices";
import { populationBonus } from "./researchEffects";
import { sportLife } from "./sport";
import { scenarioOf } from "./scenarios";
import { ANCHORS, at, literacyNow, profileOf, type Profile, type Row } from "./societyTables";
import type { AppliedChange, GameState, MapRegion, ScenarioId, SocietyFigures, SocietyTrack } from "./types";

export { literacyAtStart, literacyNow, regionOf } from "./societyTables";

/**
 * Society in numbers: how a country's people are spread by age and sex,
 * between the poor, the middle and the rich, town and country, farm,
 * factory and office, and how many can read. Built from the land a country
 * holds (each province by its modern country and that country's part of the
 * world), the date, its economy and its government; it moves with the game
 * as war thins the young men and cuts births, growth widens the middle, and
 * slumps, prices, sanctions and occupation push people into poverty.
 *
 * Sources, as orders of magnitude rather than censuses: the age shares of the
 * UN World Population Prospects (2022) from 1950 on and historical censuses
 * before it (the 1910–1911 and 1939–1940 rounds, the Soviet censuses of 1897
 * and 1939); urban shares from the UN World Urbanization Prospects and
 * Bairoch before 1950; literacy from UNESCO and Our World in Data's
 * historical series; employment by sector from the ILO and the national
 * censuses compiled by Mitchell; inequality (Gini) from the World Inequality
 * Database, Milanovic and the OECD. Eleven regional profiles carry the
 * world; the main countries override what differs. Incomes follow a
 * log-normal spread around the economy's GDP per head: the poor live below
 * the World Bank's societal poverty line ($1.15 plus half the median, and at
 * least $3.65 a day from 1991, $3 before), anchored to the income people had at the start; the
 * rich above three times that median (at least $40 a day).
 *
 * What the figures of today cannot show is stored (`SocietyTrack`): the
 * player's start for the trend arrows; for every country its age cohorts as
 * the game made them – opened from history on the day its record opens, then
 * aged, born and dying by the game's own conditions – and the sectors its
 * programmes have moved. The tables themselves are engine/societyTables.ts.
 */

/** Five-year age bands, 0–4 to 80+. */
export const AGE_BANDS = 17;
/** The band ages start at. */
export const bandStart = (i: number) => i * 5;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Cohorts the history before the start left smaller: births lost to a war,
 * a famine or a slump (both sexes), or men killed in a war. `at`: when it
 * happened, so a game begun before it does not carry it.
 */
interface Scar {
  at: number;
  born: [number, number];
  m: number;
  f: number;
  countries: string;
}
const WWI_EAST = "RUS UKR BLR";
const SCARS: Scar[] = [
  { at: 1919, born: [1915, 1919], m: 0.6, f: 0.6, countries: "FRA DEU AUT HUN CZE SVK SRB POL BEL ROU" },
  { at: 1919, born: [1915, 1919], m: 0.78, f: 0.78, countries: "GBR ITA BGR" },
  { at: 1922, born: [1915, 1922], m: 0.62, f: 0.62, countries: `${WWI_EAST} KAZ` },
  { at: 1918, born: [1880, 1899], m: 0.86, f: 1, countries: "FRA DEU SRB AUT HUN CZE TUR" },
  { at: 1918, born: [1880, 1899], m: 0.91, f: 1, countries: `GBR ITA ROU ${WWI_EAST}` },
  { at: 1934, born: [1932, 1934], m: 0.65, f: 0.65, countries: "UKR KAZ" },
  { at: 1934, born: [1932, 1934], m: 0.82, f: 0.82, countries: "RUS" },
  { at: 1946, born: [1942, 1946], m: 0.58, f: 0.58, countries: `${WWI_EAST} LTU LVA EST` },
  { at: 1946, born: [1942, 1946], m: 0.75, f: 0.75, countries: "POL DEU SRB HRV BIH" },
  { at: 1946, born: [1944, 1946], m: 0.88, f: 0.88, countries: "JPN AUT HUN" },
  { at: 1945, born: [1900, 1927], m: 0.72, f: 0.95, countries: `${WWI_EAST} LTU LVA EST` },
  { at: 1945, born: [1900, 1927], m: 0.8, f: 0.97, countries: "DEU POL SRB HRV BIH AUT" },
  { at: 1945, born: [1900, 1927], m: 0.88, f: 0.98, countries: "JPN HUN ROU" },
  { at: 1945, born: [1900, 1927], m: 0.96, f: 1, countries: "ITA FRA GBR CHN CZE" },
  { at: 1964, born: [1946, 1964], m: 1.15, f: 1.15, countries: "USA CAN AUS NZL" },
  { at: 1953, born: [1915, 1932], m: 0.9, f: 0.97, countries: "KOR PRK" },
  { at: 1961, born: [1959, 1961], m: 0.68, f: 0.68, countries: "CHN" },
  { at: 1975, born: [1930, 1955], m: 0.93, f: 0.98, countries: "VNM" },
  { at: 2001, born: [1992, 2001], m: 0.62, f: 0.62, countries: `${WWI_EAST} MDA GEO ARM LTU LVA EST` },
  { at: 2001, born: [1992, 2001], m: 0.78, f: 0.78, countries: "BGR ROU POL" },
];
const SCARS_OF = new Map<string, Scar[]>();
for (const s of SCARS) for (const c of s.countries.split(" ")) SCARS_OF.set(c, [...(SCARS_OF.get(c) ?? []), s]);

/** Prices of the start date against 2019 (the US CPI), so incomes of different dates compare. */
const PRICES: Record<ScenarioId, number> = { "1914": 0.04, "1933": 0.051, "1939": 0.053, "1950": 0.094, "1957": 0.11, "1964": 0.122, "1973": 0.174, "1979": 0.284, "1991": 0.53, "1999": 0.65, "2014": 0.93, "2022": 1.15 };

const YEAR_MS = 365.25 * 86_400_000;
const yearsBetween = (from: string, to: string) => Math.max(0, (Date.parse(to) - Date.parse(from)) / YEAR_MS);
/** The year as a fraction, for the tables. */
const yearFraction = (date: string) => yearOf(date) + (Date.parse(date) - Date.parse(`${yearOf(date)}-01-01`)) / YEAR_MS;

// --- the age pyramid -------------------------------------------------------

/** Share of people in each band for a smooth population whose births grow at `r` a year and who survive as Weibull(λ, 4). */
function smooth(r: number, lambda: number): number[] {
  const bands = new Array<number>(AGE_BANDS).fill(0);
  for (let a = 0; a < 100; a++) {
    const x = a + 0.5;
    bands[Math.min(AGE_BANDS - 1, Math.floor(a / 5))] += Math.exp(-r * x - (x / lambda) ** 4);
  }
  const total = bands.reduce((s, v) => s + v, 0);
  return bands.map((v) => v / total);
}
const under15 = (b: number[]) => b[0] + b[1] + b[2];
const over65 = (b: number[]) => b.slice(13).reduce((s, v) => s + v, 0);

/** A smooth population: its births' growth a year, its span of life (Weibull scale, years) and its age shares. */
interface Fit {
  r: number;
  lambda: number;
  shares: number[];
}
const fits = new Map<string, Fit>();
/** The smooth age shares with the given shares under 15 and 65 and over, %: births' growth and survival found by bisection. */
export function ageShares(young: number, old: number): number[] {
  return ageFit(young, old).shares;
}

/** The smooth population with the given shares under 15 and 65 and over, %, with the growth and span of life that make it. */
function ageFit(young: number, old: number): Fit {
  const key = `${round1(young)}|${round1(old)}`;
  const known = fits.get(key);
  if (known) return known;
  const y = clamp(young, 8, 50) / 100;
  const o = clamp(old, 1.5, 40) / 100;
  const rateFor = (lambda: number) => {
    let lo = -0.08;
    let hi = 0.1;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (under15(smooth(mid, lambda)) < y) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };
  let lo = 30;
  let hi = 160;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (over65(smooth(rateFor(mid), mid)) < o) lo = mid;
    else hi = mid;
  }
  const lambda = (lo + hi) / 2;
  const r = rateFor(lambda);
  const fit = { r, lambda, shares: smooth(r, lambda) };
  fits.set(key, fit);
  return fit;
}

/**
 * A profile's age shares in a year: fitted on the anchor years around it and
 * mixed between them, so a turn's few days do not ask for a new fit.
 */
function sharesAt(profile: Profile, year: number): number[] {
  const fit = (i: number) => ageShares(profile.u15[i], profile.o65[i]);
  if (year <= ANCHORS[0]) return fit(0);
  for (let i = 1; i < ANCHORS.length; i++) {
    if (year <= ANCHORS[i]) {
      const t = (year - ANCHORS[i - 1]) / (ANCHORS[i] - ANCHORS[i - 1]);
      const a = fit(i - 1);
      const b = fit(i);
      return a.map((v, k) => v + (b[k] - v) * t);
    }
  }
  return fit(ANCHORS.length - 1);
}

/** Men's share of a band: half and a little more at birth, falling with age as men die younger. */
const maleShare = (band: number, excess: number) => clamp(0.512 - excess * (Math.max(0, bandStart(band) + 2.5 - 20) / 65) ** 2, 0.2, 0.53);

/** How much of a cohort a scar left, for the band's birth years in a year. */
function scarFactor(band: number, year: number, s: Scar, male: boolean): number {
  const factor = male ? s.m : s.f;
  if (factor === 1) return 1;
  const ages = band === AGE_BANDS - 1 ? 20 : 5;
  let hit = 0;
  for (let k = 0; k < ages; k++) {
    const born = year - (bandStart(band) + k) - 0.5;
    if (born >= s.born[0] && born <= s.born[1] + 1) hit++;
  }
  return 1 - (hit / ages) * (1 - factor);
}

type Bands = { m: number; f: number }[];
const emptyBands = (): Bands => Array.from({ length: AGE_BANDS }, () => ({ m: 0, f: 0 }));

/**
 * History's pyramid of a land in a year, people in each band: each part's
 * smooth shares, the cohorts history scarred before the start, then the
 * game's recorded gaps (killed in war, never born) for a record kept the old
 * way. Read for any country before its own cohorts are kept, and to start
 * them (the historical initialisation).
 */
function historicalBands(parts: Pick<Part, "adm0" | "at" | "people">[], year: number, startYear: number, people: number, gap?: SocietyTrack["gap"]): Bands {
  const bands = emptyBands();
  const missing = gap ? gap.m.reduce((s, v) => s + v, 0) + gap.f.reduce((s, v) => s + v, 0) : 0;
  const scale = people > 0 ? (people + missing) / people : 1;
  for (const part of parts) {
    const profile = profileOf(part);
    const shares = sharesAt(profile, year);
    const excess = at(profile.excess, year);
    const scars = (SCARS_OF.get(part.adm0) ?? []).filter((s) => s.at <= startYear);
    const own = shares.map((share, b) => {
      const male = maleShare(b, excess);
      return {
        m: share * male * scars.reduce((k, s) => k * scarFactor(b, year, s, true), 1),
        f: share * (1 - male) * scars.reduce((k, s) => k * scarFactor(b, year, s, false), 1),
      };
    });
    const total = own.reduce((s, x) => s + x.m + x.f, 0);
    own.forEach((x, b) => {
      bands[b].m += (x.m / total) * part.people * scale;
      bands[b].f += (x.f / total) * part.people * scale;
    });
  }
  if (gap) {
    // The record read part way to its next band; a cohort cannot lose more than four fifths of itself, whatever was recorded.
    const t = (gap.aged ?? 0) / 5;
    const read = (g: number[], b: number) => (g[b] ?? 0) * (1 - t) + (b > 0 ? (g[b - 1] ?? 0) * t : 0) + (b === AGE_BANDS - 1 ? (g[b] ?? 0) * t : 0);
    bands.forEach((x, b) => {
      x.m = Math.max(x.m * 0.2, x.m - read(gap.m, b));
      x.f = Math.max(x.f * 0.2, x.f - read(gap.f, b));
    });
  }
  return bands;
}

/**
 * The shares under 15 and 65 and over, %, that history gave a country's
 * present land in a year – what an untouched game's pyramid is measured
 * against.
 */
export function historicalAges(state: Pick<GameState, "regions" | "scenarioId">, map: Record<string, MapRegion>, tag: string, year: number): { young: number; old: number } | null {
  const parts = landOf(state, map, tag).get(tag)?.parts ?? [];
  const people = parts.reduce((s, p) => s + p.people, 0);
  if (people <= 0) return null;
  const bands = historicalBands(parts, year, Number(state.scenarioId), people);
  const total = bands.reduce((s, x) => s + x.m + x.f, 0);
  return { young: ((bands[0].m + bands[0].f + bands[1].m + bands[1].f + bands[2].m + bands[2].f) / total) * 100, old: (bands.slice(13).reduce((s, x) => s + x.m + x.f, 0) / total) * 100 };
}

// --- demography that follows the game ----------------------------------------

/**
 * The kept cohorts read as five-year bands now, shares of all people: each
 * cohort stands `aged` years past the band it was put in at the last
 * five-year step, so a band holds part of its own cohort and part of the one
 * below; the youngest band holds those born since.
 */
function readAges(ages: Ages): Bands {
  const t = clamp(ages.aged / 5, 0, 1);
  const out = emptyBands();
  for (let b = 0; b < AGE_BANDS; b++) {
    for (const sex of ["m", "f"] as const) {
      const g = ages[sex];
      const own = b === AGE_BANDS - 1 ? g[b] : g[b] * (1 - t);
      const below = b > 0 ? g[b - 1] * t : ages.born[sex === "m" ? 0 : 1];
      out[b][sex] = (own + below) / 100;
    }
  }
  const total = out.reduce((s, x) => s + x.m + x.f, 0);
  return total > 0 ? out.map((x) => ({ m: x.m / total, f: x.f / total })) : out;
}

type Ages = NonNullable<SocietyTrack["ages"]>;

/** Women of 15–49, share of all people. */
const mothers = (bands: Bands) => bands.slice(3, 10).reduce((s, x) => s + x.f, 0);

/**
 * How readily people have children, 8–50 (a crude birth rate, per thousand,
 * for a land with an average share of mothers): high where few read, few live
 * in towns and incomes are low; it falls as schooling, towns and incomes
 * rise – the transition every country went through.
 */
function fertilityIndex(modern: number): number {
  return 6 + 44 * clamp(1 - modern, 0.05, 1);
}

/** How far a land has come from the traditional family, 0–0.95: schooling, towns and income. The transition does not go back: a slump cuts births, it does not restore the old family. */
function modernity(income: number, urban: number, literate: number): number {
  const rich = clamp(Math.log10(Math.max(1, income) / 1000) / 2, 0, 1);
  return clamp(0.45 * (literate / 100) + 0.25 * (urban / 100) + 0.3 * rich, 0, 0.95);
}

/** Births a year to a woman of 15–49 per point of the fertility index, where a country's habits are its conditions' (mothers are about 22% of an average land). */
const FERT_NORM = 1 / (1000 * 0.22);
/** A country's habit of more children than its conditions call for (a baby boom) fades with this time constant, years. */
const HABIT_YEARS = 30;

/**
 * How long people live, an index in years of life: the Preston curve – life
 * lengthens with income per head, fast while it is low and slowly once it is
 * high – lifted by medicine over the decades (0.15 of a year each year) and
 * by the player's medical research ahead of its time.
 */
function lifeIndex(income: number, year: number, medicine = 0): number {
  return clamp(25 + 60 * (1 - Math.exp(-Math.log(Math.max(250, income) / 250) / 4.5)) + 0.15 * (year - 1950) + medicine, 25, 110);
}

/** Children who die before five, 0–0.4, as life lengthens: most of a poor country's gain in life is theirs. */
const childDeaths = (life: number) => clamp(0.6 * Math.exp(-(life - 25) / 15), 0.003, 0.4);
/** The span of an adult life the life index stands for, once the children's deaths are taken out. */
const adultSpan = (life: number) => life / (1 - childDeaths(life));

/** Survival of a cohort aged `x` over `dt` years, with life span (Weibull scale) `lambda`. */
const survives = (x: number, dt: number, lambda: number) => Math.exp((x / lambda) ** 4 - ((x + dt) / lambda) ** 4);

/** The mid age of a kept cohort `aged` years past its last step: five-year bands, the oldest about 86. */
const cohortAge = (b: number, aged: number) => (b === AGE_BANDS - 1 ? 86 : bandStart(b) + 2.5 + aged);

const share4 = (v: number) => Math.round(v * 1e4) / 1e4;

/** What a country's births and deaths read now: income per head (dollars of 2019), towns and schooling, %. */
interface Vitals {
  income: number;
  urban: number;
  literate: number;
  year: number;
  medicine: number;
}

/** Shares of the people, %, kept to four decimals, from bands that sum to one. */
function keepAges(bands: Bands): Ages {
  return { m: bands.map((x) => share4(x.m * 100)), f: bands.map((x) => share4(x.f * 100)), born: [0, 0], aged: 0 };
}

/**
 * The historical initialisation: a country's cohorts as history had them on
 * the day the record opens (the start date's profile and scars, or an old
 * save's year with its recorded gaps), and the measures its births and
 * deaths are read by – fitted so that, at the conditions of that day, they
 * give the smooth population that profile is drawn from.
 */
function startAges(bands: Bands, v: Vitals): { ages: Ages; vital: NonNullable<SocietyTrack["vital"]> } {
  const total = bands.reduce((s, x) => s + x.m + x.f, 0) || 1;
  const shares = bands.map((x) => ({ m: x.m / total, f: x.f / total }));
  const young = (shares[0].m + shares[0].f + shares[1].m + shares[1].f + shares[2].m + shares[2].f) * 100;
  const old = shares.slice(13).reduce((s, x) => s + x.m + x.f, 0) * 100;
  const fit = ageFit(young, old);
  // The smooth population's births a year per person, and its share of mothers.
  let survivors = 0;
  for (let a = 0; a < 100; a++) survivors += Math.exp(-fit.r * (a + 0.5) - ((a + 0.5) / fit.lambda) ** 4);
  const births = 1 / survivors;
  const smoothMothers = fit.shares.slice(3, 10).reduce((s, x) => s + x, 0) * 0.5;
  const life0 = lifeIndex(v.income, v.year, v.medicine);
  const dev = modernity(v.income, v.urban, v.literate);
  const fert = births / (fertilityIndex(dev) * Math.max(0.05, smoothMothers) * (1 - childDeaths(life0)));
  const life = fit.lambda / adultSpan(life0);
  // Men die younger: their span against women's, from how few of the oldest are men.
  const top = shares[AGE_BANDS - 1];
  const ratio = top.f > 0 ? top.m / top.f / (0.512 / 0.488) : 1;
  const q = (86 / fit.lambda) ** 4;
  const men = clamp(86 / (q - Math.log(clamp(ratio, 0.2, 1))) ** 0.25 / fit.lambda, 0.75, 1);
  const ages = keepAges(shares);
  const vital = { fert: Math.round(fert * 1e7) / 1e7, life: Math.round(life * 1e4) / 1e4, men: Math.round(men * 1e4) / 1e4, ni0: 0, dev: Math.round(dev * 1e4) / 1e4 };
  vital.ni0 = Math.round(stepAges(ages, vital, v, 1, { war: 0, slump: 0, killed: 0 }).increase * 1e5) / 1e5;
  return { ages, vital };
}

/**
 * One period of the dynamic simulation, in place on the kept cohorts: the
 * war's dead leave the young men, every cohort loses its dead (life follows
 * income, the decades' medicine and the player's research), the mothers of
 * 15–49 have their children (fewer where schooling, towns and incomes have
 * risen, in a long war and in a slump), and every five years the cohorts move
 * up a band. Returns the natural increase, share of the people a year.
 */
function stepAges(ages: Ages, vital: NonNullable<SocietyTrack["vital"]>, v: Vitals, dt: number, hard: { war: number; slump: number; killed: number; civil?: number }): { ages: Ages; increase: number; fert: number; dev: number; born: number; died: number } {
  const next: Ages = { m: [...ages.m], f: [...ages.f], born: [...ages.born], aged: ages.aged };
  // The war's dead, % of the people, the young men first (a cohort keeps at least a fifth of itself).
  if (hard.killed > 0) for (const [b, share] of DEAD_BY_BAND) next.m[b] = Math.max(next.m[b] * 0.2, next.m[b] - hard.killed * share);
  // Its civilian dead, % of the people (engine/civilians.ts): every cohort of both sexes, small children and the old the most.
  if (hard.civil && hard.civil > 0) {
    const weight = (b: number) => (b === 0 ? 1.5 : b >= 12 ? 1.6 : 1);
    let w = 0;
    for (let b = 0; b < AGE_BANDS; b++) w += (next.m[b] + next.f[b]) * weight(b);
    const k = w > 0 ? hard.civil / w : 0;
    for (let b = 0; b < AGE_BANDS; b++) {
      next.m[b] = Math.max(next.m[b] * 0.5, next.m[b] * (1 - weight(b) * k));
      next.f[b] = Math.max(next.f[b] * 0.5, next.f[b] * (1 - weight(b) * k));
    }
  }
  const life = lifeIndex(v.income, v.year, v.medicine);
  const lambda = vital.life * adultSpan(life);
  let deaths = 0;
  for (let b = 0; b < AGE_BANDS; b++) {
    const x = cohortAge(b, next.aged);
    const dm = next.m[b] * (1 - survives(x, dt, lambda * (vital.men ?? 1)));
    const df = next.f[b] * (1 - survives(x, dt, lambda));
    next.m[b] -= dm;
    next.f[b] -= df;
    deaths += dm + df;
  }
  const total0 = next.m.reduce((s, x) => s + x, 0) + next.f.reduce((s, x) => s + x, 0) + next.born[0] + next.born[1];
  const w = mothers(readAges(next)) * (total0 / 100);
  // Children born who live past five: fewer die as life lengthens, so a falling birth rate need not mean fewer children.
  const dev = Math.round(Math.max(vital.dev ?? 0, modernity(v.income, v.urban, v.literate)) * 1e4) / 1e4;
  const births = vital.fert * fertilityIndex(dev) * (1 - childDeaths(life)) * w * 100 * dt * (1 - hard.war) * (1 - hard.slump);
  // A baby boom – more children than a country's conditions call for – fades; a habit of fewer stays (it outlasted every policy that tried to undo it).
  const fert = vital.fert > FERT_NORM ? Math.round((vital.fert + (FERT_NORM - vital.fert) * (1 - Math.exp(-dt / HABIT_YEARS))) * 1e7) / 1e7 : vital.fert;
  next.born = [next.born[0] + births * 0.512, next.born[1] + births * 0.488];
  next.aged += dt;
  // Every five years each cohort moves up a band; those born since become the youngest.
  while (next.aged >= 5) {
    next.aged -= 5;
    for (const sex of ["m", "f"] as const) {
      const g = next[sex];
      const top = g[AGE_BANDS - 1] + g[AGE_BANDS - 2];
      for (let b = AGE_BANDS - 2; b > 0; b--) g[b] = g[b - 1];
      g[AGE_BANDS - 1] = top;
      g[0] = next.born[sex === "m" ? 0 : 1];
    }
    next.born = [0, 0];
  }
  const total = next.m.reduce((s, x) => s + x, 0) + next.f.reduce((s, x) => s + x, 0) + next.born[0] + next.born[1];
  const k = total > 0 ? 100 / total : 1;
  const out: Ages = { m: next.m.map((x) => share4(x * k)), f: next.f.map((x) => share4(x * k)), born: [share4(next.born[0] * k), share4(next.born[1] * k)], aged: Math.round(next.aged * 1e4) / 1e4 };
  // Births and deaths a year per thousand, as a census counts them: the children who die before five are born and die.
  const lost = births * (childDeaths(life) / Math.max(0.6, 1 - childDeaths(life)));
  const per = 10 / Math.max(dt, 1e-6) / (total0 > 0 ? total0 / 100 : 1);
  return { ages: out, increase: (births - deaths) / 100 / Math.max(dt, 1e-6), fert, dev, born: (births + lost) * per, died: (deaths + lost) * per };
}

// --- incomes -----------------------------------------------------------------

/** The standard normal distribution. */
function phi(x: number): number {
  // Abramowitz and Stegun 7.1.26.
  const t = 1 / (1 + 0.3275911 * (Math.abs(x) / Math.SQRT2));
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(x * x) / 2);
  return x >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}
/** The spread of log incomes that gives a Gini coefficient: σ = √2·Φ⁻¹((1 + G) / 2). */
function sigmaOf(gini: number): number {
  const p = (1 + clamp(gini, 0.15, 0.75)) / 2;
  let lo = 0;
  let hi = 4;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (phi(mid) < p) lo = mid;
    else hi = mid;
  }
  return Math.SQRT2 * ((lo + hi) / 2);
}
/** Purchasing power: a dollar buys more where incomes are low, the more so the later the date. */
function pppFactor(real: number, era: ScenarioId): number {
  const exponent = era === "1914" || era === "1933" || era === "1939" ? 0.12 : era === "1950" || era === "1964" || era === "1973" || era === "1979" ? 0.2 : 0.3;
  return clamp((65000 / Math.max(100, real)) ** exponent, 1, 3);
}
/** Household spending as a share of GDP. */
const CONSUMPTION = 0.6;
/** The lowest poverty line, $ a day of 2017: the World Bank's line for lower-middle incomes from 1991, a little below it for the earlier, poorer dates. */
const poorFloor = (era: ScenarioId) => (era === "1991" || era === "1999" || era === "2014" || era === "2022" ? 3.65 : 3);
/** The rich live on three times the median, and at least $40 a day. */
const RICH_LINE = 40;
const RICH_TIMES = 3;

/** Whether a government plans its economy as the socialist states did: their wages were flat. */
export function socialist(state: Pick<GameState, "countries">, tag: string): boolean {
  const c = state.countries[tag];
  const words = typeof c?.government === "string" ? c.government : c?.government ? Object.values(c.government).join(" ") : "";
  return /communis|socialist|soviet|people's (republic|democracy)|коммунист|комуніст|социалист|соціаліст|советск|радянськ|народн/i.test(words);
}

// --- the society ---------------------------------------------------------------

/** One modern country's people inside a game country. */
interface Part {
  adm0: string;
  at?: [number, number];
  people: number;
  /** Income per head in dollars of the start date, as the economy values that land. */
  income: number;
}

/** What a country's land holds for its society: its people by modern country, how many of its own people another holds, and whether a front runs through it. */
interface Land {
  parts: Part[];
  /** Its own people, and those of them under someone else's control, thousands (as engine/crises.ts occupiedShare counts them). */
  own: number;
  held: number;
  /** A front or an occupier is on its land. */
  front: boolean;
  /** The map's natural pace of the provinces it owns, % a year, summed by people (divide by `own`). */
  pace: number;
}

/**
 * Every country's land in one pass over the provinces, or one country's
 * when `only` is given: a turn reads many countries, the panel one.
 */
function landOf(state: Pick<GameState, "regions" | "scenarioId">, map: Record<string, MapRegion>, only?: string): Map<string, Land> {
  const lands = new Map<string, Land>();
  const landFor = (tag: string) => {
    let land = lands.get(tag);
    if (!land) lands.set(tag, (land = { parts: [], own: 0, held: 0, front: false, pace: 0 }));
    return land;
  };
  const byAdm = new Map<string, Map<string, Part>>();
  for (const [id, r] of Object.entries(state.regions)) {
    const m = map[id];
    if (!m) continue;
    const n = peopleIn(r, m);
    const tag = countsFor(r);
    if ((!only || tag === only) && n > 0) {
      let parts = byAdm.get(tag);
      if (!parts) byAdm.set(tag, (parts = new Map()));
      const part = parts.get(m.adm0);
      if (part) part.people += n;
      else parts.set(m.adm0, { adm0: m.adm0, at: m.at, people: n, income: provinceIncome(m, state.scenarioId) });
    }
    if (only && r.owner !== only) continue;
    const owner = landFor(r.owner);
    owner.own += n;
    owner.pace += n * (m.gr ?? 0);
    if (r.controller !== r.owner) {
      owner.held += r.contested === r.owner ? (n * (100 - (r.held ?? 30))) / 100 : n;
      owner.front = true;
    } else if (r.contested) {
      owner.held += (n * (r.held ?? 30)) / 100;
      owner.front = true;
    }
  }
  for (const [tag, parts] of byAdm) landFor(tag).parts = [...parts.values()];
  return lands;
}

/** A country's people in numbers. Shares are %, people thousands. */
export interface Society {
  people: number;
  /** Men and women in each five-year band, 0–4 to 80+, thousands. */
  bands: { m: number; f: number }[];
  poor: number;
  middle: number;
  rich: number;
  urban: number;
  literate: number;
  /** Workers in farming, industry and services, % of those employed. */
  farm: number;
  industry: number;
  services: number;
  jobless: number;
  /** Under 15 and 65 and over, %. */
  young: number;
  old: number;
  /** Men aged 20–34, thousands. */
  men: number;
  /** Income inequality, the Gini coefficient, 0–100. */
  gini: number;
  /** Real income per head, dollars of 2019 a year. */
  income: number;
  /** The same figures when the record began: the player's country only. */
  start?: SocietyFigures;
}

/** The day the game began: its date's start, or the start chosen on the date's card. */
const startOf = (state: Pick<GameState, "scenarioId" | "variant">): string => scenarioOf(state).startDate;

type SocietyState = Pick<GameState, "regions" | "countries" | "scenarioId" | "date" | "player" | "wars"> & Partial<Pick<GameState, "society" | "sanctions" | "variant">>;

/**
 * A country's society now, from its land, its economy and what the turns
 * left in its record. Null for a country with no people or no economy.
 */
export function societyOf(state: SocietyState, map: Record<string, MapRegion> | null | undefined, tag: string, lands?: Map<string, Land>): Society | null {
  const country = state.countries[tag];
  if (!map || !country?.economy) return null;
  const land = (lands ?? landOf(state, map, tag)).get(tag);
  const parts = land?.parts ?? [];
  const people = parts.reduce((s, p) => s + p.people, 0);
  if (people <= 0) return null;
  const track = state.society?.[tag];
  const era = state.scenarioId;
  const year = yearFraction(state.date);
  const startYear = Number(era);
  const years = yearsBetween(startOf(state), state.date);

  // The age pyramid: the cohorts as the game made them (dynamic, from the start's history on); before the record has them,
  // each part's smooth shares for this year, the cohorts history scarred before the start, then the game's own gaps.
  const bands = track?.ages ? readAges(track.ages).map((x) => ({ m: x.m * people, f: x.f * people })) : historicalBands(parts, year, startYear, people, track?.gap);
  const counted = bands.reduce((s, x) => s + x.m + x.f, 0);
  const young = ((bands[0].m + bands[0].f + bands[1].m + bands[1].f + bands[2].m + bands[2].f) / counted) * 100;
  const old = (bands.slice(13).reduce((s, x) => s + x.m + x.f, 0) / counted) * 100;
  const men = bands[4].m + bands[5].m + bands[6].m;

  // Income now against the start, in dollars of 2019: the economy's GDP per head, deflated by the era's dollar – the very
  // rate the economy grows nominal GDP by (engine/prices.ts), so a country growing at nothing real reads a flat income.
  const deflator = PRICES[era] * (1 + DOLLAR[era] / 100) ** years;
  const real = (country.economy.gdp * 1e6) / people / deflator;
  const landIncome = parts.reduce((s, p) => s + p.income * p.people, 0) / people;
  const anchor = track?.anchor ?? landIncome / PRICES[era];
  const ratio = clamp(real / Math.max(1, anchor), 0.2, 8);

  // Inequality: the part of the world's, flattened where wages were planned, widened by the hardships of the day.
  const flat = socialist(state, tag) && year <= 1992;
  const e = country.economy;
  const occupied = land && land.own > 0 ? land.held / land.own : 0;
  const sanctioned = (state.sanctions ?? []).filter((s) => s.against === tag).reduce((w, s) => Math.max(w, s.scope === "full" ? 0.04 : 0.02), 0);
  const inflation = Math.max(0, Math.log10(Math.max(1, e.inflation) / 10));
  const atHome = Boolean(land?.front);
  const widen = 0.008 * Math.max(0, e.unemployment - 6) + 0.05 * inflation + sanctioned + 0.15 * occupied + (atHome ? 0.03 : 0);
  const cut = (1 - 0.1 * inflation) * (1 - 0.3 * occupied);
  const spreads = parts.map((p) => {
    const profile = profileOf(p);
    const gini = at(profile.gini, startYear);
    return sigmaOf(flat ? Math.min(gini, 0.27) : gini) + widen;
  });
  const means = parts.map((p) => {
    // A colony's people live far below the metropole's, but within reason of the country's own mean.
    const realPart = real * clamp(p.income / Math.max(1e-9, landIncome), 0.25, 2.5) * cut;
    return (realPart * pppFactor(realPart, era) * CONSUMPTION) / 365;
  });
  const logMedian = parts.reduce((s, p, i) => s + (p.people / people) * (Math.log(means[i]) - spreads[i] ** 2 / 2), 0);
  const anchoredMedian = Math.exp(logMedian) / (ratio * cut);
  const poorLine = Math.max(poorFloor(era), 1.15 + anchoredMedian / 2);
  const richLine = Math.max(RICH_LINE, RICH_TIMES * anchoredMedian);
  let poor = 0;
  let rich = 0;
  parts.forEach((p, i) => {
    const mu = Math.log(means[i]) - spreads[i] ** 2 / 2;
    poor += (p.people / people) * phi((Math.log(poorLine) - mu) / spreads[i]);
    rich += (p.people / people) * (1 - phi((Math.log(richLine) - mu) / spreads[i]));
  });
  poor = clamp(poor * 100, 1, 97);
  rich = clamp(rich * 100, 0.3, 30);
  // The Gini of a log-normal spread is 2Φ(σ/√2) − 1, read by people from each part's.
  const gini = parts.reduce((g, p, i) => g + (p.people / people) * (2 * phi(spreads[i] / Math.SQRT2) - 1), 0);

  // Town and country, work and schooling: the start's figures, moved by income since, the record's shifts and time.
  const weighted = (row: (p: Profile) => Row, when = startYear) => parts.reduce((s, p) => s + (p.people / people) * at(row(profileOf(p)), when), 0);
  const shift = track?.shift ?? {};
  const growth = Math.log(ratio);
  const farm0 = weighted((p) => p.farm);
  const farm = clamp(farm0 * ratio ** -0.5 + (shift.farm ?? 0), 0.5, 92);
  const industry = clamp(weighted((p) => p.industry) + growth * (farm0 > 20 ? 4 : -2) + (shift.industry ?? 0), 3, 60);
  const services = Math.max(5, 100 - farm - industry);
  const urban = clamp(weighted((p) => p.urban) + 9 * growth + (shift.urban ?? 0), 2, 100);
  const literate0 = weighted((p) => p.literate);
  const literate = literacyNow(literate0, years, shift.literate ?? 0);
  const workers = farm + industry + services;

  return {
    people,
    bands,
    poor: round1(poor),
    rich: round1(rich),
    middle: round1(Math.max(0, 100 - poor - rich)),
    urban: round1(urban),
    literate: round1(literate),
    farm: round1((farm / workers) * 100),
    industry: round1((industry / workers) * 100),
    services: round1((services / workers) * 100),
    jobless: round1(e.unemployment),
    young: round1(young),
    old: round1(old),
    men: Math.round(men),
    gini: round1(gini * 100),
    income: Math.round(real),
    ...(track?.start ? { start: track.start } : {}),
  };
}

/** The figures a record keeps of its start. */
const figuresOf = (s: Society): SocietyFigures => ({ poor: s.poor, rich: s.rich, urban: s.urban, literate: s.literate, farm: s.farm, industry: s.industry, young: s.young, men: s.men });

/** Real income per head now, dollars of 2019: what a new record anchors the poverty line to. */
export const incomeOf = (state: SocietyState, map: Record<string, MapRegion>, tag: string): number | null => realIncome(state, map, tag);

function realIncome(state: SocietyState, map: Record<string, MapRegion>, tag: string, lands?: Map<string, Land>): number | null {
  const e = state.countries[tag]?.economy;
  const people = ((lands ?? landOf(state, map, tag)).get(tag)?.parts ?? []).reduce((s, p) => s + p.people, 0);
  if (!e || people <= 0) return null;
  const deflator = PRICES[state.scenarioId] * (1 + DOLLAR[state.scenarioId] / 100) ** yearsBetween(startOf(state), state.date);
  return (e.gdp * 1e6) / people / deflator;
}

/**
 * The player's record opened: its start for the trend arrows and its income
 * as the poverty line's anchor. A new game opens it on the start date; an
 * older save on the day it is first loaded (migration step 31).
 */
export function seedSociety<T extends SocietyState>(state: T, map: Record<string, MapRegion>): T {
  const tag = state.player;
  if (state.society?.[tag]?.start) return state;
  const real = realIncome(state, map, tag);
  if (real === null) return state;
  const opened: T = { ...state, society: { ...state.society, [tag]: { ...state.society?.[tag], anchor: Math.round(real) } } };
  const now = societyOf(opened, map, tag);
  if (!now) return state;
  return { ...opened, society: { ...opened.society, [tag]: { ...opened.society![tag], start: figuresOf(now) } } };
}

/** How the war dead spread over a man's life, by band from 15–19: the young first. */
const DEAD_BY_BAND: [number, number][] = [
  [3, 0.12],
  [4, 0.3],
  [5, 0.24],
  [6, 0.16],
  [7, 0.1],
  [8, 0.05],
  [9, 0.03],
];
/** The most a programme, a budget or a war may move a sector away from its drift, points. */
const MAX_SHIFT = 15;
/** Points a year a programme moves: [farm, industry, urban, literate]. */
const PROGRAMME_SHIFT: Partial<Record<string, [number, number, number, number]>> = {
  industry: [-0.4, 0.6, 0.3, 0],
  infrastructure: [-0.2, 0.3, 0.4, 0],
  technology: [-0.2, -0.1, 0.1, 0.3],
  market: [-0.2, -0.2, 0.2, 0],
  liberalise: [-0.1, -0.1, 0.1, 0.1],
  stimulus: [0, 0.2, 0.1, 0],
  armament: [0, 0.4, 0, 0],
  disarmament: [0, -0.3, 0, 0],
};

const emptyGap = () => ({ m: new Array<number>(AGE_BANDS).fill(0), f: new Array<number>(AGE_BANDS).fill(0) });

/** The most the game's births and deaths move a country's natural growth from the map's pace, points a year. */
const DRIFT_MAX = 3;
/** Dates whose map carries the pace of a later period (the 1994 map: 1991 to 2022): their people grow by their own births and deaths. */
const PACE_OF_LATER_YEARS = new Set<ScenarioId>(["1950", "1957", "1964", "1973", "1979"]);

/** What a country's births and deaths read now, or null without people or an economy. */
function society0Vitals(state: GameState, map: Record<string, MapRegion>, tag: string, lands: Map<string, Land>, year: number): Vitals | null {
  const s = societyOf(state, map, tag, lands);
  const income = realIncome(state, map, tag, lands);
  if (!s || income === null) return null;
  // The player's medical research ahead of its time lengthens life (engine/researchEffects.ts): 0.2 points of growth are five years of life.
  // And so, a little, does the money its government gives sport, or takes from it (engine/sport.ts).
  const medicine = (tag === state.player && state.research ? populationBonus(state) * 25 : 0) + sportLife(state, tag);
  return { income, urban: s.urban, literate: s.literate, year, medicine };
}

/**
 * Who flees, by age and sex: children, women and the old leave first; in a
 * war the men of fighting age (20–59) stay – called up, or kept from leaving
 * – and only a quarter of their share goes; in peace (a famine, a purge)
 * whole families leave. Weights against each band's share, men and women.
 */
const FLEE_CHILD = 1.3;
const FLEE_WOMEN = 1.2;
const FLEE_OLD = 1.05;
const FLEE_MEN_WAR = 0.25;
const FLEE_MEN_PEACE = 0.9;
/** The weight of a band's men or women among those who flee. */
function fleeWeight(band: number, male: boolean, war: boolean): number {
  if (band <= 2) return FLEE_CHILD;
  if (band === 3) return male ? (war ? 0.8 : 1) : FLEE_WOMEN;
  if (band <= 11) return male ? (war ? FLEE_MEN_WAR : FLEE_MEN_PEACE) : FLEE_WOMEN;
  if (band === 12) return male ? 0.9 : 1.1;
  return FLEE_OLD;
}

/** Refugees by age and sex, thousands, from a land with these cohorts: `n` in all. */
export function refugeeMakeUp(ages: Pick<Ages, "m" | "f" | "born">, n: number, war: boolean): { m: number[]; f: number[]; born: [number, number] } {
  const wm = ages.m.map((v, b) => v * fleeWeight(b, true, war));
  const wf = ages.f.map((v, b) => v * fleeWeight(b, false, war));
  const wb: [number, number] = [ages.born[0] * FLEE_CHILD, ages.born[1] * FLEE_CHILD];
  const total = wm.reduce((s, v) => s + v, 0) + wf.reduce((s, v) => s + v, 0) + wb[0] + wb[1];
  const k = total > 0 ? n / total : 0;
  return { m: wm.map((v) => v * k), f: wf.map((v) => v * k), born: [wb[0] * k, wb[1] * k] };
}

/** A land's cohorts once refugees have left (`sign` −1) or come (+1): `before` people then, `after` now, thousands; no cohort loses more than nine tenths of itself. */
function moveRefugees(ages: Ages, before: number, after: number, flow: { m: number[]; f: number[]; born: [number, number] }, sign: 1 | -1): Ages {
  if (before <= 0 || after <= 0) return ages;
  const count = (share: number, moved: number) => Math.max((share / 100) * before * 0.1, (share / 100) * before + sign * moved);
  const m = ages.m.map((v, b) => count(v, flow.m[b]));
  const f = ages.f.map((v, b) => count(v, flow.f[b]));
  const born: [number, number] = [count(ages.born[0], flow.born[0]), count(ages.born[1], flow.born[1])];
  const total = m.reduce((s, v) => s + v, 0) + f.reduce((s, v) => s + v, 0) + born[0] + born[1];
  if (total <= 0) return ages;
  const k = 100 / total;
  return { m: m.map((v) => share4(v * k)), f: f.map((v) => share4(v * k)), born: [share4(born[0] * k), share4(born[1] * k)], aged: ages.aged };
}

/** The cohorts that came under each country this turn with the land: the people moved and their old country's kept cohorts, summed. */
function arrivals(before: GameState, next: GameState, map: Record<string, MapRegion>, society: Record<string, SocietyTrack>): Map<string, { people: number; m: number[]; f: number[]; born: [number, number] }> {
  const out = new Map<string, { people: number; m: number[]; f: number[]; born: [number, number] }>();
  for (const [id, r] of Object.entries(next.regions)) {
    const was = before.regions[id];
    if (!was) continue;
    const from = countsFor(was);
    const to = countsFor(r);
    if (from === to) continue;
    const n = peopleIn(r, map[id]);
    const ages = society[from]?.ages;
    if (n <= 0 || !ages) continue;
    const got = out.get(to) ?? { people: 0, m: new Array<number>(AGE_BANDS).fill(0), f: new Array<number>(AGE_BANDS).fill(0), born: [0, 0] as [number, number] };
    got.people += n;
    for (let b = 0; b < AGE_BANDS; b++) {
      got.m[b] += ages.m[b] * n;
      got.f[b] += ages.f[b] * n;
    }
    got.born = [got.born[0] + ages.born[0] * n, got.born[1] + ages.born[1] * n];
    out.set(to, got);
  }
  return out;
}

/** A country's cohorts with the newcomers' mixed in, by people: `stayed` of its own and the arrivals. */
function blendAges(own: Ages, stayed: number, came: { people: number; m: number[]; f: number[]; born: [number, number] }): Ages {
  const all = stayed + came.people;
  if (all <= 0) return own;
  const mix = (a: number, b: number) => share4((a * stayed + b) / all);
  return { m: own.m.map((v, b) => mix(v, came.m[b])), f: own.f.map((v, b) => mix(v, came.f[b])), born: [mix(own.born[0], came.born[0]), mix(own.born[1], came.born[1])], aged: own.aged };
}

/**
 * Every country's cohorts opened from history as the save stands: an old
 * save's people keep the pyramid of its year, with the gaps its wars left,
 * and follow the game from there. A turn opens any country's that are
 * missing the same way (save step 38 waits for it); this opens all at once.
 */
export function seedDemography<T extends GameState>(state: T, map: Record<string, MapRegion>): T {
  const lands = landOf(state, map);
  const year = yearFraction(state.date);
  const startYear = Number(state.scenarioId);
  const society: Record<string, SocietyTrack> = { ...(state.society ?? {}) };
  for (const [tag, land] of lands) {
    const c = state.countries[tag];
    const track = society[tag];
    if (!c?.economy || track?.ages) continue;
    const people = land.parts.reduce((s, p) => s + p.people, 0);
    if (people <= 0) continue;
    const now = society0Vitals(state, map, tag, lands, year);
    if (!now) continue;
    const opened = startAges(historicalBands(land.parts, year, startYear, people, track?.gap), now);
    const rest: SocietyTrack = { ...track };
    delete rest.gap;
    society[tag] = { ...rest, ages: opened.ages, vital: opened.vital };
  }
  return { ...state, society };
}
const small = (n: number) => Math.round(n * 100) / 100;

/**
 * Society after a turn, in place on `next`: every country's cohorts age, are
 * born and die by its own conditions (opened from history the first time),
 * the war dead leave the young men, a war past its first year and a slump
 * cut births, and the natural increase is kept for the people's growth;
 * the turn's refugees (`applied`) leave their land's cohorts and join their
 * hosts' by age and sex; programmes, the industry and social budgets and a
 * war economy move the sectors and schooling of the countries they touch;
 * the player's poverty line follows incomes over a generation. Read from the
 * wars, economies and programmes as the turn left them; no dice. Returns the
 * player's births and deaths over the turn, a year per thousand.
 */
export function advanceSociety(before: GameState, next: GameState, years: number, map: Record<string, MapRegion>, applied: readonly AppliedChange[] = []): { born: number; died: number } | undefined {
  if (years <= 0) return undefined;
  let vitals: { born: number; died: number } | undefined;
  // A save from before society (step 31) opens the player's record from the game as it stood before this turn.
  const opened = before.society?.[before.player]?.start ? before : seedSociety(before, map);
  const society: Record<string, SocietyTrack> = { ...(next.society ?? {}), ...(opened.society?.[next.player] ? { [next.player]: opened.society[next.player] } : {}) };
  const lands = landOf(next, map);
  const killedBefore = new Map<string, number>();
  const civilBefore = new Map<string, number>();
  for (const w of before.wars) for (const [tag, l] of Object.entries(w.losses ?? {})) killedBefore.set(`${w.id}:${tag}`, l.killed);
  for (const w of before.wars) for (const [tag, l] of Object.entries(w.civilians ?? {})) civilBefore.set(`${w.id}:${tag}`, l.dead);
  const incoming = arrivals(before, next, map, society);
  const year = yearFraction(next.date);
  const startYear = Number(next.scenarioId);
  // The turn's refugees: who left each land, at war or not, and where they went; their make-up is read off the land's cohorts.
  const fled = new Map<string, { n: number; war: boolean; to?: string }[]>();
  for (const c of applied) {
    if (c.kind !== "population" || c.refugees <= 0) continue;
    const war = next.wars.some((w) => !w.truce && (w.attackers.includes(c.country) || w.defenders.includes(c.country)));
    fled.set(c.country, [...(fled.get(c.country) ?? []), { n: c.refugees, war, ...(c.to && c.to !== c.country ? { to: c.to } : {}) }]);
  }
  const sheltered: { to: string; n: number; flow: ReturnType<typeof refugeeMakeUp> }[] = [];

  for (const [tag, c] of Object.entries(next.countries)) {
    const e = c.economy;
    if (!e) continue;
    const wars = next.wars.filter((w) => w.attackers.includes(tag) || w.defenders.includes(tag));
    const programmes = (c.programmes ?? []).filter((p) => p.since <= next.date && p.until > before.date && PROGRAMME_SHIFT[p.kind]);
    const isPlayer = tag === next.player;
    const had = society[tag];
    const parts = lands.get(tag)?.parts ?? [];
    const people = parts.reduce((s, p) => s + p.people, 0);
    if (!had && !isPlayer && !wars.length && !programmes.length && people <= 0) continue;
    const track: SocietyTrack = { ...had, ...(had?.gap ? { gap: { ...had.gap, m: [...had.gap.m], f: [...had.gap.f] } } : {}), ...(had?.shift ? { shift: { ...had.shift } } : {}) };
    const killed = wars.reduce((s, w) => s + Math.max(0, (w.losses?.[tag]?.killed ?? 0) - (killedBefore.get(`${w.id}:${tag}`) ?? 0)), 0);
    // The civilians the wars took this turn, recorded once per war (engine/civilians.ts): a country's people die in wars it may not fight.
    const civil = next.wars.reduce((s, w) => s + Math.max(0, (w.civilians?.[tag]?.dead ?? 0) - (civilBefore.get(`${w.id}:${tag}`) ?? 0)), 0);

    // Demography that follows the game: a country's cohorts are kept from the day its record opens (the historical
    // initialisation – the start date's profile and scars, or an old save's year with its gaps); after that they age,
    // births follow its own income, towns, schooling, wars and slumps, and deaths its income, medicine and wars.
    const now = people > 0 ? society0Vitals(next, map, tag, lands, year) : null;
    if (now) {
      const fresh = !track.ages || !track.vital;
      if (fresh) {
        // Opened as history had it when the period began, then played through it like any other.
        const opened0 = startAges(historicalBands(parts, yearFraction(before.date), startYear, people, track.gap), { ...now, year: yearFraction(before.date) });
        track.ages = opened0.ages;
        track.vital = opened0.vital;
        delete track.gap;
        delete track.drift;
      }
      if (track.ages && track.vital) {
        // People who came under the country this turn bring their cohorts with them.
        const came = fresh ? undefined : incoming.get(tag);
        if (came && came.people > 0) track.ages = blendAges(track.ages, Math.max(0, people - came.people), came);
        const longest = Math.max(...wars.filter((w) => !w.truce).map((w) => yearsBetween(w.since, next.date)), 0);
        const hard = {
          // Births fall once a war has gone on for a year, the deeper the more of the people it has in uniform; and in a slump.
          war: longest >= 1 ? clamp(0.1 + (6 * e.troops) / people, 0.1, 0.4) : 0,
          slump: clamp(-0.02 * e.growth, 0, 0.15),
          killed: (killed / people) * 100,
          civil: (civil / people) * 100,
        };
        const stepped = stepAges(track.ages, track.vital, now, years, hard);
        track.ages = stepped.ages;
        track.vital = { ...track.vital, fert: stepped.fert, dev: stepped.dev };
        if (isPlayer) vitals = { born: Math.round(stepped.born * 10) / 10, died: Math.round(stepped.died * 10) / 10 };
        // Refugees leave by age and sex: the land's people already count them gone (engine/population.ts), its cohorts now do too.
        for (const { n, war, to } of fled.get(tag) ?? []) {
          const flow = refugeeMakeUp(track.ages, n, war);
          track.ages = moveRefugees(track.ages, people + n, people, flow, -1);
          if (to) sheltered.push({ to, n, flow });
        }
        // The map's pace is a later period's where the date's map was drawn for one (the 1994 map's, 1991–2022, for a game
        // begun in 1950 or 1964): there the people grow by their own births and deaths, not by the 1990s' pace.
        const land = lands.get(tag);
        const later = PACE_OF_LATER_YEARS.has(next.scenarioId) && land && land.own > 0 ? track.vital.ni0 * 100 - land.pace / land.own : 0;
        const drift = Math.round(clamp((stepped.increase - track.vital.ni0) * 100 + later, -DRIFT_MAX, DRIFT_MAX) * 100) / 100;
        if (drift) track.drift = drift;
        else delete track.drift;
      }
    }

    // The gaps age with their people: every five years the whole record moves up a band (the oldest thin out), and in between it is read part way.
    if (track.gap) {
      let aged = (track.gap.aged ?? 0) + years;
      while (aged >= 5) {
        aged -= 5;
        for (const sex of ["m", "f"] as const) {
          const g = track.gap[sex];
          track.gap[sex] = g.map((v, b) => (b === 0 ? 0 : b === AGE_BANDS - 1 ? g[b - 1] + v * 0.5 : g[b - 1]));
        }
      }
      track.gap = { ...track.gap, aged };
    }

    // A record kept the old way (no cohorts yet: a country with no people) keeps its gaps.
    if (wars.length && !track.ages) {
      const society0 = societyOf(next, map, tag, lands);
      if (society0) {
        const gap = (track.gap ??= emptyGap());
        for (const [b, share] of DEAD_BY_BAND) gap.m[b] += killed * share;
        // Births fall once a war has gone on for a year, the deeper the more of the people it has in uniform.
        const longest = Math.max(...wars.filter((w) => !w.truce).map((w) => yearsBetween(w.since, next.date)), 0);
        if (longest >= 1) {
          const depth = clamp(0.1 + (6 * e.troops) / society0.people, 0.1, 0.4);
          const births = ((society0.bands[0].m + society0.bands[0].f) / 5) * years * depth;
          gap.m[0] += births * 0.512;
          gap.f[0] += births * 0.488;
        }
      }
    }
    if (track.gap) {
      const aged = Math.round((track.gap.aged ?? 0) * 1000) / 1000;
      track.gap = { m: track.gap.m.map(small), f: track.gap.f.map(small), ...(aged ? { aged } : {}) };
      if (track.gap.m.every((v) => v === 0) && track.gap.f.every((v) => v === 0)) delete track.gap;
    }

    // Sectors and schooling: programmes, the budget's lines against the era's norms, and a war economy.
    const shift = { farm: 0, industry: 0, urban: 0, literate: 0, ...track.shift };
    for (const p of programmes) {
      const [farm, industry, urban, literate] = PROGRAMME_SHIFT[p.kind]!;
      shift.farm += farm * years;
      shift.industry += industry * years;
      shift.urban += urban * years;
      shift.literate += literate * years;
    }
    if (isPlayer || had?.shift || programmes.length) {
      const gdp = Math.max(0.01, e.gdp);
      const industryBudget = clamp(e.budget.industry / gdp / 0.04 - 1, -1, 3);
      shift.industry += 0.25 * industryBudget * years;
      shift.farm -= 0.15 * Math.max(0, industryBudget) * years;
      const rich = (realIncome(next, map, tag, lands) ?? 0) >= RICH_INCOME;
      const social = clamp(e.budget.social / gdp / Math.max(0.005, socialNorm(next.scenarioId, rich)) - 1, -1, 2);
      shift.literate += 0.2 * social * years;
    }
    if (wars.some((w) => !w.truce)) shift.industry += 0.5 * years;
    const kept = Object.fromEntries(Object.entries(shift).map(([k, v]) => [k, Math.round(clamp(v, -MAX_SHIFT, MAX_SHIFT) * 100) / 100]).filter(([, v]) => v !== 0));
    if (Object.keys(kept).length) track.shift = kept;
    else delete track.shift;

    // The player's poverty line follows incomes over a generation.
    if (isPlayer && track.anchor) {
      const real = realIncome(next, map, tag, lands);
      if (real !== null) track.anchor = Math.round(track.anchor + (real - track.anchor) * Math.min(1, years * 0.04));
    }

    if (Object.keys(track).length) society[tag] = track;
    else delete society[tag];
  }
  // And arrive where they went, as they left.
  for (const { to, n, flow } of sheltered) {
    const host = society[to];
    const people = (lands.get(to)?.parts ?? []).reduce((s, p) => s + p.people, 0);
    if (host?.ages) host.ages = moveRefugees(host.ages, Math.max(0, people - n), people, flow, 1);
  }
  // Countries that are gone keep nothing.
  for (const tag of Object.keys(society)) if (!next.countries[tag]) delete society[tag];
  next.society = society;
  return vitals;
}

/**
 * Life expectancy at birth, years: the life index a country's deaths are
 * read by – the Preston curve of its income, the decades' medicine, the
 * player's medical research and the money for sport – which runs close to
 * the UN's and the historical figures (India 36 and the United States 62 in
 * 1950, Germany 77 in 2022).
 */
export function lifeExpectancy(state: GameState, map: Record<string, MapRegion>, tag: string): number | null {
  const v = society0Vitals(state, map, tag, landOf(state, map, tag), yearFraction(state.date));
  return v ? round1(lifeIndex(v.income, v.year, v.medicine)) : null;
}

/** A share with its change since the start, for the prompt: "42% (+3)". */
function withChange(now: number, start: number | undefined): string {
  const d = start === undefined ? 0 : Math.round(now - start);
  return `${Math.round(now)}%${d ? ` (${d > 0 ? "+" : ""}${d})` : ""}`;
}

/**
 * One line on the player's society for the game master and the ministers:
 * "society: poor 42% (+3), middle 51%, rich 7%; urban 39%; farm 30%, industry 28%; literate 85%; jobless 6%; under 15 31%; men 20–34 −8% since the start".
 */
export function societyLine(state: SocietyState, map: Record<string, MapRegion> | null | undefined): string {
  const s = societyOf(state, map, state.player);
  if (!s) return "";
  const st = s.start;
  const men = st && st.men > 0 ? Math.round(((s.men - st.men) / st.men) * 100) : 0;
  return [
    `society: poor ${withChange(s.poor, st?.poor)}, middle ${Math.round(s.middle)}%, rich ${withChange(s.rich, st?.rich)}`,
    `urban ${withChange(s.urban, st?.urban)}`,
    `farm ${withChange(s.farm, st?.farm)}, industry ${withChange(s.industry, st?.industry)}`,
    `literate ${withChange(s.literate, st?.literate)}`,
    `under 15 ${withChange(s.young, st?.young)}`,
    ...(Math.abs(men) >= 2 ? [`men 20–34 ${men > 0 ? "+" : "−"}${Math.abs(men)}% since the start`] : []),
  ].join("; ");
}

/** The figures a foreign society is shown by, as estimates under fog of war. */
export const SOCIETY_FIGURES = ["poor", "middle", "rich", "urban", "literate", "farm", "industry", "services", "jobless", "young", "old"] as const;
export type SocietyFigure = (typeof SOCIETY_FIGURES)[number];

/** How far off a guess may be, in points at the least known: a census is public almost everywhere, incomes and jobs less so. */
const ESTIMATE_WIDTH: Record<SocietyFigure, number> = { poor: 16, middle: 16, rich: 8, jobless: 12, urban: 8, literate: 6, farm: 8, industry: 8, services: 8, young: 5, old: 5 };

/**
 * Another country's society as the player's government knows it
 * (engine/fog.ts): each share an estimate whose error shrinks with what it
 * knows of the country, the same all turn.
 */
export function societyEstimates(state: Pick<GameState, "seed" | "id" | "turn">, tag: string, s: Society, score: number): Record<SocietyFigure, Estimate> {
  return Object.fromEntries(SOCIETY_FIGURES.map((k) => [k, estimateRate(s[k], score, ESTIMATE_WIDTH[k], state, `${tag}:society:${k}`, [0, 100])])) as Record<SocietyFigure, Estimate>;
}

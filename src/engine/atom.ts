import { z } from "zod";
import { bookStrike } from "./civilians";
import { roll } from "./dice";
import { payOffBudget } from "./economy";
import { strikePlants } from "./energy";
import { countsFor } from "./occupation";
import { peopleIn } from "./population";
import { priceRatio } from "./prices";
import { alliesOf, raiseAlarm, remember, warBetween } from "./relations";
import { techYear, yearFraction } from "./researchEffects";
import { deterrenceOf, researchPool } from "./space";
import { ATOM_STAGES, type AppliedChange, type AtomProgramme, type AtomStage, type AtomState, type GameState, type MapRegion, type NuclearStrike, type War } from "./types";

/**
 * The atom. Every country that had an atomic programme in history has one
 * here, with its stages – a first reactor, the material for a bomb, a
 * device, the first test, the hydrogen bomb – and, once it has tested, a
 * stockpile of warheads.
 *
 * In the historical mode every other government's programme keeps
 * history's dates: the United States tests on 16 July 1945, the Soviet Union
 * on 29 August 1949, Britain in 1952, France in 1960, China in 1964, India in
 * 1974, Pakistan in 1998, North Korea in 2006; Israel builds its bombs and
 * never tests them; South Africa gives its own up. In the free mode the
 * dates are the engine's dice and money: a share of the research money
 * against what history's leader spent (engine/space.ts researchPool), each
 * stage years of work at history's pace, cheaper once the world knows how;
 * a test can fizzle. The player's programme always runs on its own research:
 * the strategic direction (engine/research.ts) with at least BOMB_SHARE of
 * the money buys its pace.
 *
 * A stockpile grows as history's did, from the day the country tested; the
 * player can order it built up or cut down, and pays for what is built.
 *
 * Deterrence: a country with the bomb is far less likely to be attacked
 * (engine/intentions.ts reads nuclearShield): the more warheads, the later
 * the era, the missiles to carry them and the hydrogen bomb, the stronger it
 * holds others back. Nuclear use is the gravest act there is. A player's
 * order to use one, given in so many words, at war with the target and with
 * warheads in store, is carried out by the engine alone: a city's people
 * killed, its plants and output destroyed, the whole world turned against
 * the player – trust gone, sanctions, unrest at home – and a nuclear power,
 * or its nuclear ally, answering in kind by the engine's dice. Every other
 * government uses one only as its doctrine and the escalation ladder decide
 * (engine/nuclear.ts), through the same machinery: the toll, the world's
 * outrage, the answer in kind.
 */

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const round2 = (v: number) => Math.round(v * 100) / 100;
const round3 = (v: number) => Math.round(v * 1000) / 1000;

/** The player's atomic programme runs while strategic research gets at least this share (engine/research.ts). */
export const BOMB_SHARE = 15;
/** Years of work each stage takes at history's pace: the Manhattan Project's six from a first reactor to Trinity, and the hydrogen bomb after. */
export const STAGE_WORK: Record<AtomStage, number> = { reactor: 2, material: 2.5, device: 1.2, test: 0.3, hydrogen: 3 };
/** The stages up to the bomb. */
const TO_BOMB: AtomStage[] = ["reactor", "material", "device", "test"];
const BOMB_WORK = TO_BOMB.reduce((s, x) => s + STAGE_WORK[x], 0);
/** The year fission is published to the world, whatever the player's science. */
const FISSION_KNOWN = 1945;

/** "1945-07-16" as a year with its fraction. */
const at = (date: string) => yearFraction(date);

/** The first of the month a fractional year falls in. */
function monthOf(year: number): string {
  const y = Math.floor(year);
  const m = Math.min(12, Math.floor((year - y) * 12 + 1e-6) + 1);
  return `${y}-${String(m).padStart(2, "0")}-01`;
}

/** A table of years read in a year: straight between its years, held beyond them. */
function byYear(table: [number, number][], year: number): number {
  if (year <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    const [y1, v1] = table[i];
    if (year <= y1) {
      const [y0, v0] = table[i - 1];
      return v0 + ((v1 - v0) * (year - y0)) / (y1 - y0);
    }
  }
  return table[table.length - 1][1];
}

interface History {
  /** The day the weapons programme was decided. */
  began: string;
  /** The day each stage was reached. */
  stages: Partial<Record<AtomStage, string>>;
  /** Warheads by year. */
  stock?: [number, number][];
  /** Never tested in the open. */
  undeclared?: boolean;
  /** Given up. */
  ended?: string;
  /** % of the research money a government puts in while it builds the bomb. */
  share: number;
}

const SOVIET_STOCK: [number, number][] = [
  [1949, 1], [1950, 5], [1951, 25], [1952, 50], [1953, 120], [1954, 150], [1955, 200], [1956, 426], [1957, 660], [1958, 869], [1959, 1060], [1960, 1605], [1961, 2471],
  [1962, 3322], [1963, 4238], [1964, 5221], [1965, 6129], [1970, 11643], [1975, 19055], [1980, 30062], [1986, 40159], [1990, 37000], [1991, 35000], [1995, 27000],
  [1999, 22000], [2005, 17000], [2010, 12000], [2014, 8000], [2022, 5977],
];
const SOVIET: History = {
  began: "1942-09-28",
  stages: { reactor: "1946-12-25", material: "1949-02-26", device: "1949-08-10", test: "1949-08-29", hydrogen: "1955-11-22" },
  stock: SOVIET_STOCK,
  share: 35,
};

/** History's programmes: when each stage was reached, the stockpiles (the Bulletin of the Atomic Scientists' estimates). The Russian Federation carries on the Soviet one. */
const HISTORY: Record<string, History> = {
  usa: {
    began: "1939-10-21",
    stages: { reactor: "1942-12-02", material: "1945-02-02", device: "1945-07-12", test: "1945-07-16", hydrogen: "1952-11-01" },
    stock: [
      [1945, 2], [1946, 9], [1947, 13], [1948, 50], [1949, 170], [1950, 299], [1951, 438], [1952, 841], [1953, 1169], [1954, 1703], [1955, 2422], [1956, 3692], [1957, 5543],
      [1958, 7345], [1959, 12298], [1960, 18638], [1961, 22229], [1962, 25540], [1963, 28133], [1964, 29463], [1965, 31139], [1967, 31255], [1970, 26008], [1975, 27519],
      [1980, 24104], [1985, 23135], [1990, 21392], [1991, 19008], [1995, 10904], [1999, 10500], [2005, 8360], [2010, 5066], [2014, 4717], [2020, 3750], [2022, 3708],
    ],
    share: 30,
  },
  ussr: SOVIET,
  russia: SOVIET,
  uk: {
    began: "1941-09-03",
    stages: { reactor: "1947-08-15", material: "1951-03-01", device: "1952-08-01", test: "1952-10-03", hydrogen: "1957-11-08" },
    stock: [[1952, 0], [1953, 1], [1955, 10], [1958, 22], [1960, 30], [1962, 205], [1965, 310], [1970, 280], [1975, 350], [1980, 350], [1991, 300], [1999, 185], [2014, 225], [2022, 225]],
    share: 25,
  },
  france: {
    began: "1954-12-26",
    stages: { reactor: "1948-12-15", material: "1958-07-01", device: "1959-12-01", test: "1960-02-13", hydrogen: "1968-08-24" },
    stock: [[1960, 0], [1964, 4], [1965, 32], [1970, 36], [1975, 188], [1980, 250], [1991, 540], [1999, 450], [2014, 300], [2022, 290]],
    share: 20,
  },
  china: {
    began: "1955-01-15",
    stages: { reactor: "1958-09-27", material: "1964-01-14", device: "1964-09-01", test: "1964-10-16", hydrogen: "1967-06-17" },
    stock: [[1964, 0], [1965, 5], [1970, 75], [1975, 185], [1980, 280], [1991, 435], [1999, 400], [2014, 260], [2022, 350]],
    share: 30,
  },
  israel: {
    began: "1958-01-01",
    stages: { reactor: "1963-12-01", material: "1966-01-01", device: "1967-05-01" },
    stock: [[1967, 2], [1970, 8], [1980, 31], [1991, 53], [1999, 80], [2014, 80], [2022, 90]],
    undeclared: true,
    share: 20,
  },
  india: {
    began: "1972-09-07",
    stages: { reactor: "1956-08-04", material: "1964-01-22", device: "1974-05-01", test: "1974-05-18", hydrogen: "1998-05-11" },
    stock: [[1974, 0], [1989, 10], [1991, 12], [1999, 30], [2014, 110], [2022, 160]],
    share: 15,
  },
  pakistan: {
    began: "1972-01-20",
    stages: { reactor: "1965-12-21", material: "1984-04-01", device: "1984-12-01", test: "1998-05-28" },
    stock: [[1998, 5], [1999, 10], [2014, 120], [2022, 165]],
    share: 25,
  },
  "north-korea": {
    began: "1980-01-01",
    stages: { reactor: "1986-01-01", material: "1990-01-01", device: "2006-09-01", test: "2006-10-09", hydrogen: "2017-09-03" },
    stock: [[2006, 1], [2010, 6], [2014, 10], [2022, 30]],
    share: 30,
  },
  "south-africa": {
    began: "1974-01-01",
    stages: { reactor: "1965-03-18", material: "1978-01-01", device: "1979-11-01" },
    stock: [[1979, 1], [1982, 2], [1989, 6]],
    undeclared: true,
    ended: "1989-11-01",
    share: 10,
  },
  // Programmes history broke off before any bomb: the Uranverein, Ni-Go, Iran's enrichment.
  germany: { began: "1939-04-29", stages: {}, ended: "1945-05-08", share: 4 },
  japan: { began: "1941-04-01", stages: {}, ended: "1945-08-15", share: 3 },
  iran: { began: "2002-08-14", stages: { reactor: "1967-11-01" }, share: 8 },
};

/** A programme history began within this many years of a start date is in the game from the start. */
const HORIZON = 30;

type StartState = Pick<GameState, "countries" | "date" | "player">;

/** The country that carries a history's programme: the Russian Federation only where the Soviet Union is gone. */
const carries = (state: Pick<GameState, "countries">, tag: string) => tag !== "russia" || !state.countries.ussr || Boolean(state.countries.ussr.dormant);

/** A programme as history had it on a day: its stages so far, work on the next, its stockpile. */
function historicalProgramme(h: History, date: string): AtomProgramme {
  const now = at(date);
  const done = ATOM_STAGES.flatMap((s) => (h.stages[s] && h.stages[s]! <= date ? [{ id: s, date: h.stages[s]! }] : []));
  const work: AtomProgramme["work"] = {};
  const next = ATOM_STAGES.find((s) => !done.some((d) => d.id === s) && (s !== "hydrogen" || done.some((d) => d.id === "test")));
  const due = next && h.stages[next];
  if (next && due && date >= h.began) {
    const w = STAGE_WORK[next] - (at(due) - now);
    if (w > 0) work[next] = round2(Math.min(STAGE_WORK[next], w));
  }
  const armed = done.some((d) => d.id === "test") || (h.undeclared && done.some((d) => d.id === "device"));
  const stock = armed && h.stock ? Math.round(byYear(h.stock, now)) : 0;
  const ended = h.ended && h.ended <= date ? h.ended : undefined;
  return {
    done,
    work,
    share: date >= h.began && !ended ? h.share : 0,
    stock: ended ? 0 : stock,
    ...(ended ? { ended } : {}),
    ...(h.undeclared ? { undeclared: true } : {}),
  };
}

/**
 * Every atomic programme on a start date: history's, where the country
 * stands and the programme had begun or would within HORIZON years, and the
 * player's always (idle until its research funds it).
 */
export function startingAtom(state: StartState): AtomState {
  const programmes: Record<string, AtomProgramme> = {};
  const now = at(state.date);
  for (const [tag, h] of Object.entries(HISTORY)) {
    const c = state.countries[tag];
    if (!c || c.dormant || !carries(state, tag)) continue;
    const soon = at(h.began) - now <= HORIZON || Object.values(h.stages).some((d) => d! <= state.date);
    if (!soon || (h.ended && h.ended <= state.date && tag !== state.player)) continue;
    programmes[tag] = historicalProgramme(h, state.date);
  }
  if (state.countries[state.player] && !programmes[state.player]) programmes[state.player] = { done: [], work: {}, share: 0, stock: 0 };
  // A country with the bomb history does not date (a save's own): its stages as done.
  for (const [tag, c] of Object.entries(state.countries)) {
    if (!c.arsenal?.nuclear || programmes[tag]?.done.some((d) => d.id === "test" || d.id === "device")) continue;
    programmes[tag] = { done: TO_BOMB.map((id) => ({ id, date: state.date })), work: {}, share: 0, stock: Math.max(1, programmes[tag]?.stock ?? 1) };
  }
  return { programmes };
}

// ---- what a programme can do

/** Whether a country has the bomb: tested, or built in secret. */
export const hasBomb = (state: Pick<GameState, "countries">, tag: string): boolean => Boolean(state.countries[tag]?.arsenal?.nuclear);

/** Whether a programme has made a stage. */
const made = (p: AtomProgramme | undefined, s: AtomStage) => Boolean(p?.done.some((d) => d.id === s));

/** The stage a programme works on now, if any. */
export function nextStage(p: AtomProgramme): AtomStage | undefined {
  return ATOM_STAGES.find((s) => !made(p, s) && (s !== "hydrogen" || made(p, "test")) && !(p.undeclared && s === "test"));
}

type BombState = Pick<GameState, "countries" | "player" | "date" | "research"> & Partial<Pick<GameState, "atom">>;

/** How the player's atomic programme stands: the country has the bomb, runs a programme, or cannot run one (too little money, or fission not yet known). */
export function bombStatus(state: BombState): { has: true } | { has: false; progress: number; running: boolean; blocked?: "share" | "fission" } {
  if (hasBomb(state, state.player)) return { has: true };
  const p = state.atom?.programmes[state.player];
  const work = p ? TO_BOMB.reduce((s, x) => s + (made(p, x) ? STAGE_WORK[x] : (p.work[x] ?? 0)), 0) : (state.research?.bomb ?? 0) * BOMB_WORK;
  const fission = techYear(state, "science") >= 1938 || at(state.date) >= FISSION_KNOWN;
  const share = state.research?.shares?.strategic ?? 0;
  const blocked = !fission ? "fission" : share < BOMB_SHARE ? "share" : undefined;
  return { has: false, progress: clamp(work / BOMB_WORK, 0, 1), running: !blocked, ...(blocked ? { blocked } : {}) };
}

/** The money that keeps history's pace, as a share of the largest economy: what the Manhattan Project cost, cheaper as the world learned how. */
const REFERENCE: [number, number][] = [[1940, 0.004], [1950, 0.0025], [1965, 0.0012], [1990, 0.0005], [2010, 0.00025]];
/** What the world publishes and spies carry reaches a programme once a bomb has been tested, years of work a year. */
const DIFFUSION = 0.05;
const MAX_RATE = 2.5;

/** The largest economy in the world, $bn. */
function largest(state: Pick<GameState, "countries">): number {
  return Math.max(0.01, ...Object.values(state.countries).flatMap((c) => (c.economy && !c.dormant ? [c.economy.gdp] : [])));
}

/** Years of work a government's programme gains a year: its money against history's leader's, and what the world knows. */
export function atomRate(state: Pick<GameState, "countries" | "date"> & Partial<Pick<GameState, "atom">>, tag: string): number {
  const p = state.atom?.programmes[tag];
  if (!p || p.ended || p.share <= 0) return 0;
  const money = (researchPool(state, tag) * clamp(p.share, 0, 50)) / 100;
  const year = at(state.date);
  const known = Object.values(state.atom?.programmes ?? {}).some((x) => made(x, "test")) ? DIFFUSION : 0;
  return clamp(Math.sqrt(money / (largest(state) * byYear(REFERENCE, year))) + known, 0, MAX_RATE);
}

// ---- the stockpile

/** History's stockpile of a country, `delay` years after history's day (negative: before it). */
function curve(tag: string, year: number, delay: number): number | null {
  const h = HISTORY[tag];
  if (!h?.stock) return null;
  return Math.max(0, Math.round(byYear(h.stock, Math.max(h.stock[0][0], year - delay))));
}

/** What a warhead costs, $bn of the day by the calendar; the game reads it at its own prices (engine/prices.ts priceRatio). */
const WARHEAD_COST: [number, number][] = [[1945, 0.004], [1960, 0.0015], [1980, 0.004], [2000, 0.01], [2022, 0.02]];
/** How fast a stockpile moves towards what its doctrine or the player's goal wants: built, cut, a share of it a year with a floor. */
const BUILD_PACE = 0.6;
const CUT_PACE = 0.15;
const MIN_PACE = 10;

/** The day a programme tested (or built its first device in secret). */
const armedOn = (p: AtomProgramme) => p.done.find((d) => d.id === "test")?.date ?? (p.undeclared ? p.done.find((d) => d.id === "device")?.date : undefined);

/** The stockpile a programme's doctrine wants now: history's, moved by how much earlier or later it got the bomb; a small deterrent where history has none. */
function doctrine(tag: string, p: AtomProgramme, year: number): number {
  const since = armedOn(p);
  if (!since) return 0;
  const h = HISTORY[tag];
  const historyDay = h?.stages.test ?? h?.stages.device;
  const delay = historyDay ? at(since) - at(historyDay) : 0;
  const c = curve(tag, year, delay);
  if (c !== null) return c;
  // A new nuclear power builds a small deterrent: a few a year, up to fifty.
  return Math.min(50, Math.round(1 + 3 * Math.max(0, year - at(since))));
}

// ---- the turn

/** Whether a government stands to run its programme: it exists, holds land and is not in exile. */
function stands(state: GameState, tag: string, holders: Set<string>): boolean {
  const c = state.countries[tag];
  return Boolean(c && !c.dormant && !c.exile && c.economy && holders.has(tag));
}

/** The chance a ready test is held in a year, and that it fizzles. */
const TEST_RATE = 4;
const FIZZLE = 0.1;

/**
 * Moves every programme through a turn of `years` ending on `to`: in the
 * historical mode other governments reach their stages on history's days;
 * in the free mode, and the player's always, by money and the dice. A
 * country that tests has the bomb (its arsenal says so); stockpiles follow
 * doctrine, the player's its goal, paid for. `playerRate` is the player's
 * pace, years of work a year (engine/research.ts atomRate). Mutates `next`.
 */
export function advanceAtom(before: GameState, next: GameState, years: number, applied: AppliedChange[], to: string, playerRate = 0): void {
  const atom = next.atom;
  if (!atom || years <= 0) return;
  const game = next.seed ?? next.id;
  const historical = next.mode === "historical";
  const end = at(to);
  const start = end - years;
  const holders = new Set(Object.values(next.regions).map((r) => countsFor(r)));
  const firstTest = () => !Object.values(atom.programmes).some((x) => made(x, "test"));
  const firstHydrogen = () => !Object.values(atom.programmes).some((x) => made(x, "hydrogen"));
  const reach = (tag: string, s: AtomStage, year: number) => {
    const p = atom.programmes[tag];
    const first = s === "test" ? firstTest() : s === "hydrogen" ? firstHydrogen() : false;
    const date = monthOf(year);
    p.done.push({ id: s, date: s === "test" || s === "hydrogen" ? date : date });
    delete p.work[s];
    const h = HISTORY[tag]?.stages[s];
    applied.push({ kind: "atom", country: tag, change: "stage", stage: s, ...(first ? { first: true } : {}), ...(h ? { ahead: round2(at(h) - year) } : {}) });
    if (s === "test" || (s === "device" && p.undeclared)) {
      const arsenal = next.countries[tag]?.arsenal;
      if (arsenal) arsenal.nuclear = true;
      p.stock = Math.max(p.stock, 1);
      // The bomb in the player's research record (engine/research.ts).
      if (tag === next.player && next.research && !next.research.done.some((d) => d.id === "nuclear")) next.research = { ...next.research, done: [...next.research.done, { id: "nuclear", date }] };
    }
  };

  for (const tag of Object.keys(atom.programmes).sort()) {
    const p = atom.programmes[tag];
    const c = next.countries[tag];
    if (!c) {
      delete atom.programmes[tag];
      continue;
    }
    const player = tag === next.player;
    const h = HISTORY[tag];
    if (p.ended) continue;
    // History's ends, in the historical mode: South Africa dismantles its bombs.
    if (!player && historical && h?.ended && h.ended <= to) {
      p.ended = h.ended;
      p.share = 0;
      p.stock = 0;
      p.work = {};
      if (c.arsenal?.nuclear) delete c.arsenal.nuclear;
      applied.push({ kind: "atom", country: tag, change: "ended" });
      continue;
    }
    // A government that decided on a programme begins it on its day.
    if (!player && h && p.share <= 0 && h.began <= to && !(historical && !Object.keys(h.stages).length)) {
      p.share = h.share;
      if (h.began > before.date) applied.push({ kind: "atom", country: tag, change: "begun" });
    }
    if (!stands(next, tag, holders)) continue;

    if (!player && historical && h) {
      // History's days, while the government stands to keep them.
      for (const s of ATOM_STAGES) {
        const day = h.stages[s];
        if (!day || made(p, s) || day > to) continue;
        if (ATOM_STAGES.slice(0, ATOM_STAGES.indexOf(s)).some((x) => h.stages[x] && !made(p, x))) break;
        reach(tag, s, Math.max(start, at(day)));
      }
      const next_ = nextStage(p);
      const due = next_ && h.stages[next_];
      if (next_ && due) p.work[next_] = round2(clamp(STAGE_WORK[next_] - (at(due) - end), 0, STAGE_WORK[next_]));
    } else {
      // Money and the dice: the player's research, every other government's share of its research money.
      // The work goes better or worse than the money alone would say: the engine's dice.
      const luck = 0.6 + 0.8 * roll(game, next.turn, `atom:${tag}:pace`);
      const rate = (player ? playerRate : atomRate({ ...next, date: before.date }, tag)) * luck;
      let left = rate * years;
      while (left > 1e-6) {
        const s = nextStage(p);
        if (!s) break;
        const need = STAGE_WORK[s] - (p.work[s] ?? 0);
        const step = Math.min(need, left);
        p.work[s] = round3((p.work[s] ?? 0) + step);
        left -= step;
        if ((p.work[s] ?? 0) < STAGE_WORK[s] - 1e-6) break;
        const when = end - left / Math.max(1e-6, rate);
        if (s === "test" || s === "hydrogen") {
          // A test is held within months once ready, and can fizzle.
          const r = roll(game, next.turn, `atom:${tag}:${s}`);
          const held = 1 - Math.exp(-TEST_RATE * years);
          if (r < held * (1 - FIZZLE)) reach(tag, s, clamp(when, start, end));
          else if (r < held) p.work[s] = round3(STAGE_WORK[s] * 0.5);
          break;
        }
        reach(tag, s, clamp(when, start, end));
      }
    }

    // The stockpile: doctrine, or the player's goal, paid for.
    if (!armedOn(p)) continue;
    // Doctrine, or the player's goal, at the pace warheads are built or taken apart.
    const want = player && p.goal !== undefined ? p.goal : Math.max(1, doctrine(tag, p, end));
    const pace = Math.max(MIN_PACE, (want > p.stock ? BUILD_PACE : CUT_PACE) * p.stock) * years;
    p.stock = Math.round(want > p.stock ? Math.min(want, p.stock + pace) : Math.max(want, p.stock - pace));
    const built = p.stock - (before.atom?.programmes[tag]?.stock ?? p.stock);
    const e = c.economy;
    if (player && built > 0 && e) {
      // Warheads are paid for outside the budget, from the reserves, the rest borrowed – in the game's dollar, like its GDP.
      payOffBudget(e, round2(built * byYear(WARHEAD_COST, end) * priceRatio(next.scenarioId, end)), years);
    }
  }
}

// ---- deterrence

/** How far the bomb held others back in each era: little while bombs were few and new, much once there were missiles and thousands. */
const RESTRAINT: [number, number][] = [[1945, 0.25], [1950, 0.45], [1957, 0.65], [1964, 0.8], [1991, 0.85]];

/**
 * How far a country's bombs hold others back from attacking it, 0–0.95:
 * the era's restraint, more with more warheads (a handful counts, thousands
 * count fully), missiles and early warning (engine/space.ts) and the
 * hydrogen bomb. Nothing without the bomb.
 */
export function nuclearShield(state: Pick<GameState, "countries" | "date"> & Partial<Pick<GameState, "atom" | "space">>, tag: string): number {
  if (!hasBomb(state, tag)) return 0;
  const p = state.atom?.programmes[tag];
  const stock = p ? p.stock : 50;
  const size = clamp(Math.log10(stock + 1) / 3, 0.2, 1);
  const hydrogen = made(p, "hydrogen") ? 1.1 : 1;
  return clamp(byYear(RESTRAINT, at(state.date)) * (0.55 + 0.45 * size) * deterrenceOf({ countries: state.countries, space: state.space }, tag) * hydrogen, 0, 0.95);
}

// ---- the gravest act

/** What one warhead kills in a city, thousands, by year: the fission bombs of 1945, the megatons after. */
const TOLL: [number, number][] = [[1945, 70], [1952, 250], [1960, 500], [1990, 450]];
/** The most of a province's people strikes on it can kill. */
const MAX_KILLED = 0.6;
/** Warheads one order may use. */
const MAX_STRIKE = 3;
/** The chance a nuclear power answers a strike on itself in kind, and that its nuclear ally does. */
export const ANSWER = 0.85;
export const ALLY_ANSWER = 0.6;
/** What a strike does to the striker's standing: trust lost abroad (allies half), the threat others see, unrest at home; a computer government's support and stability at home. */
const OUTRAGE = { trust: -60, threat: 50, tension: 40, unrest: 15, support: 10, stability: 5 };
/** A tactical warhead at the front: the most of a province's people one kills, a share and thousands, and the share of its plants and output it destroys against a city strike's. */
const TACTICAL_SHARE = 0.015;
const TACTICAL_MOST = 25;
const TACTICAL_DAMAGE = 0.3;
/** Governments that cut all trade with the striker: the largest economies not allied to it. */
const SANCTIONERS = 12;

/** An order of the turn asks for a nuclear weapon to be used, in so many words. */
const NUCLEAR = /nuclear|atomic|a-bomb|h-bomb|hydrogen bomb|warhead|ядерн|атомн|термоядерн|боеголов|боєголов/i;
const USE = /strike|drop|launch|use|fire|bomb|attack|удар|сбро|скин|примен|застосу|запуст|бомб|атак/i;
/** An order about the programme, its tests or the reactors is no strike. */
const PEACEFUL = /power plant|power station|reactor|programme|program\b|project|research|\btest|электростанц|електростанц|реактор|аэс|аес|программ|програм|проект|исследов|дослідж|испыта|випроб/i;
export const asksStrike = (orders: readonly string[]): boolean => orders.some((o) => NUCLEAR.test(o) && USE.test(o) && !PEACEFUL.test(o));

/** What a turn may change in the player's atomic arsenal (merged into OutcomeSchema as `atom`): a strike the orders asked for, a goal for the stockpile. */
export const atomField = z
  .object({
    use: z
      .array(z.object({ target: z.string().trim().min(1).max(80), region: z.string().trim().max(120).optional().catch(undefined), n: z.number().finite().default(1).catch(1) }))
      .max(3)
      .catch([])
      .default([]),
    goal: z.number().finite().optional().catch(undefined),
  })
  .optional()
  .catch(undefined);
export type AtomWords = { use: { target: string; region: string; n: number }[]; goal?: number };

/** The most populous province a country holds, where a strike falls when the order names none. */
function cityOf(state: Pick<GameState, "regions">, tag: string, map: Record<string, MapRegion> | null | undefined): string | undefined {
  let best: string | undefined;
  let most = -1;
  for (const [id, r] of Object.entries(state.regions)) {
    if (r.controller !== tag) continue;
    const n = peopleIn(r, map?.[id]);
    if (n > most) {
      most = n;
      best = id;
    }
  }
  return best;
}

/**
 * What the engine allows of the game master's word on the arsenal: a goal
 * for the stockpile once there is one; a strike only when the turn's orders
 * ask for one in so many words, against a country the player is at war
 * with, at a province it holds (named, or its most populous), with
 * warheads in store, three at most.
 */
export function sanitizeAtom(
  state: GameState,
  words: z.infer<typeof atomField>,
  opts: { orders?: readonly string[]; map?: Record<string, MapRegion> | null; lookup?: (name: string) => string[] | undefined } = {},
): AtomWords | undefined {
  const p = state.atom?.programmes[state.player];
  if (!words || !p || !hasBomb(state, state.player)) return undefined;
  const out: AtomWords = { use: [] };
  if (words.goal !== undefined) {
    const goal = Math.round(clamp(words.goal, 0, 50000));
    if (goal !== p.stock) out.goal = goal;
  }
  if (asksStrike(opts.orders ?? [])) {
    let left = Math.min(MAX_STRIKE, Math.floor(p.stock));
    for (const w of words.use) {
      if (left <= 0) break;
      const target = w.target.trim().toLowerCase();
      if (!state.countries[target] || target === state.player || !warBetween(state, state.player, target)) continue;
      const named = w.region ? (state.regions[w.region] ? [w.region] : (opts.lookup?.(w.region.trim().toLowerCase()) ?? [])) : [];
      const region = named.find((id) => state.regions[id]?.controller === target) ?? cityOf(state, target, opts.map);
      if (!region) continue;
      const n = clamp(Math.round(w.n), 1, left);
      left -= n;
      out.use.push({ target, region, n });
    }
  }
  return out.use.length || out.goal !== undefined ? out : undefined;
}

/** Who would answer a strike on a country in kind, and with how many: itself if it has warheads, else its strongest nuclear ally; by the engine's dice, cast before the turn. */
export function answerTo(state: GameState, target: string, n: number): { by: string; n: number } | null {
  const game = state.seed ?? state.id;
  const stock = (tag: string) => (hasBomb(state, tag) ? (state.atom?.programmes[tag]?.stock ?? 0) : 0);
  const r = roll(game, state.turn, `atom:answer:${target}`);
  if (stock(target) >= 1) return r < ANSWER ? { by: target, n: Math.min(stock(target), Math.max(1, n)) } : null;
  const ally = [...alliesOf(state, target)].filter((t) => t !== state.player && stock(t) >= 1).sort((a, b) => stock(b) - stock(a) || a.localeCompare(b))[0];
  return ally && r < ALLY_ANSWER ? { by: ally, n: Math.min(stock(ally), Math.max(1, n)) } : null;
}

/**
 * The war an answer in kind is fought in: an answer is an act of war, so a government not at war with the striker
 * answers only by entering the war the strike was made in, at the side of the country struck – or not at all (null).
 * `side` is where it enters; none when it is at war with the striker already.
 */
export function answerWar(state: Pick<GameState, "wars">, by: string, striker: string, struck: string, warId?: string): { war: War; side?: "attackers" | "defenders" } | null {
  const at = warBetween(state, by, striker);
  if (at) return { war: at };
  const against = (w: War) => (w.attackers.includes(striker) && w.defenders.includes(struck)) || (w.defenders.includes(striker) && w.attackers.includes(struck));
  const war = state.wars.find((w) => w.id === warId && against(w)) ?? state.wars.find(against);
  if (!war) return null;
  return { war, side: war.attackers.includes(striker) ? "defenders" : "attackers" };
}

/** The answering government enters the war its answer is fought in, if it is not in it yet; false when there is none to enter. Mutates `next`. */
export function enterToAnswer(next: GameState, by: string, striker: string, struck: string, applied: AppliedChange[], warId?: string): boolean {
  const a = answerWar(next, by, striker, struck, warId);
  if (!a) return false;
  if (a.side && !a.war.attackers.includes(by) && !a.war.defenders.includes(by)) {
    a.war[a.side].push(by);
    applied.push({ kind: "enter", war: a.war.id, name: a.war.name, country: by, side: a.side });
  }
  return true;
}

/** The thousands of a province's people `n` warheads kill: a city strike's share of them, or a tactical strike's few at the front. */
function strikeToll(people: number, n: number, year: number, tactical = false): number {
  const each = clamp(byYear(TOLL, year) / Math.max(1, people), 0.02, 0.35);
  return tactical ? Math.round(Math.min(people * TACTICAL_SHARE * n, TACTICAL_MOST * n)) : Math.round(people * Math.min(MAX_KILLED, 1 - (1 - each) ** n));
}

/**
 * The dead the turn's strikes will take, by the country whose people they
 * are (the province's owner): the player's and the answer in kind the dice
 * cast, as applyStrikes carries them out, and the strikes of the computer
 * governments' ladders (engine/nuclear.ts) – so the game master's deaths are
 * read net of them (engine/population.ts). Pure.
 */
export function strikeDeaths(state: GameState, next: GameState, words: AtomWords | undefined, ctx: { to: string; map: Record<string, MapRegion> | null }, others: readonly { against: string; region: string; n: number; tactical?: boolean }[] = []): Map<string, number> {
  const out = new Map<string, number>();
  if (!next.atom) return out;
  const year = at(ctx.to);
  const add = (region: string, n: number, tactical = false) => {
    const r = next.regions[region];
    if (!r) return;
    out.set(r.owner, (out.get(r.owner) ?? 0) + strikeToll(peopleIn(r, ctx.map?.[region]), n, year, tactical));
  };
  for (const w of words?.use ?? []) add(w.region, w.n);
  for (const target of [...new Set((words?.use ?? []).map((w) => w.target))]) {
    const answer = answerTo(state, target, (words?.use ?? []).filter((w) => w.target === target).reduce((s, w) => s + w.n, 0));
    const region = answer && answerWar(next, answer.by, next.player, target) ? cityOf(next, next.player, ctx.map) : undefined;
    if (answer && region) add(region, answer.n);
  }
  for (const o of others) add(o.region, o.n, o.tactical);
  return out;
}

/**
 * One strike's toll on a province and its country: its people, its plants, its output. A tactical strike falls on a
 * military target at the front: it kills few of the province's people and destroys little, and its toll of soldiers
 * is the front's (engine/nuclear.ts); the output it destroys is that of whoever the province counts for. Returns the
 * thousands of the province's people killed.
 */
export function hit(next: GameState, by: string, against: string, region: string, n: number, map: Record<string, MapRegion> | null, year: number, tactical = false): number {
  const r = next.regions[region];
  if (!r) return 0;
  const people = peopleIn(r, map?.[region]);
  const deaths = strikeToll(people, n, year, tactical);
  const share = people > 0 ? deaths / people : 0;
  r.pop = Math.max(0, Math.round((people - deaths) * 10) / 10);
  // The province's share of its country's output and plants, destroyed with it.
  const country = tactical ? countsFor(r) : against;
  let total = 0;
  for (const [id, x] of Object.entries(next.regions)) if (countsFor(x) === country) total += peopleIn(x, map?.[id]) * (map?.[id]?.inc ?? 3000);
  const value = ((people * (map?.[region]?.inc ?? 3000)) / Math.max(1, total)) * (tactical ? TACTICAL_DAMAGE : 1);
  const lost = clamp(value * share * 1.5, 0, 0.5);
  const e = next.countries[country]?.economy;
  if (e && lost > 0) {
    e.gdp = Math.max(0.05, e.gdp * (1 - lost));
    e.budget.revenue = e.budget.revenue * (1 - lost);
  }
  strikePlants(next, country, value);
  const p = next.atom?.programmes[by];
  if (p) p.stock = Math.max(0, p.stock - n);
  return deaths;
}

/**
 * The world turns against a government that used the bomb first: trust in it gone abroad (its allies lose half as
 * much), the threat every government sees and the tension, an atrocity remembered, the largest economies not allied to
 * it cutting all trade (never the player's: that is the player's own decision), and unrest at home – the player's
 * street, a computer government's support and stability. `scale` weighs it: a tactical strike a little less. Mutates `next`.
 */
export function outrage(next: GameState, by: string, applied: AppliedChange[], to: string, scale = 1): void {
  const allies = alliesOf(next, by);
  for (const c of Object.values(next.countries)) {
    if (c.tag === by || !c.course) continue;
    remember(next, c.tag, by, "atrocity", OUTRAGE.trust * scale * (allies.has(c.tag) ? 0.5 : 1), to);
    const t = c.course.ties[by];
    if (t) {
      // The alarm outlasts the turn: the courses' threat keeps it, halving in a year (engine/relations.ts).
      raiseAlarm(next, c.tag, by, OUTRAGE.threat * scale);
      t.tension = clamp(t.tension + OUTRAGE.tension * scale, 0, 100);
    }
  }
  const sanctions = (next.sanctions ??= []);
  const big = Object.values(next.countries)
    .filter((c) => c.economy && !c.dormant && c.tag !== by && c.tag !== next.player && !allies.has(c.tag))
    .sort((a, b) => b.economy!.gdp - a.economy!.gdp || a.tag.localeCompare(b.tag))
    .slice(0, SANCTIONERS);
  for (const c of big) {
    const s = sanctions.find((x) => x.by === c.tag && x.against === by);
    if (s?.scope === "full") continue;
    if (s) s.scope = "full";
    else sanctions.push({ by: c.tag, against: by, scope: "full", since: to });
    applied.push({ kind: "sanction", by: c.tag, against: by, change: "full" });
  }
  if (by === next.player) {
    if (next.politics) next.politics = { ...next.politics, unrest: clamp(next.politics.unrest + OUTRAGE.unrest * scale, 0, 100) };
    return;
  }
  const d = next.countries[by]?.domestic;
  if (d) {
    d.support = clamp(d.support - OUTRAGE.support * scale, 0, 100);
    d.stability = clamp(d.stability - OUTRAGE.stability * scale, 0, 100);
  }
}

/**
 * The player's strikes, carried out by the engine alone, with all that
 * follows: the toll, the world's outrage (trust in the player gone, the
 * threat every government sees, an atrocity remembered, the largest
 * economies' full sanctions), unrest at home, and the answer in kind the
 * dice cast before the turn. Mutates `next`.
 */
export function applyStrikes(state: GameState, next: GameState, words: AtomWords | undefined, applied: AppliedChange[], ctx: { to: string; map: Record<string, MapRegion> | null }): void {
  if (!words?.use.length || !next.atom) return;
  const me = next.player;
  const year = at(ctx.to);
  const strikes = (next.atom.strikes ??= []);
  const record = (s: NuclearStrike) => {
    strikes.push(s);
    applied.push({ kind: "atom", country: s.by, change: "strike", against: s.against, province: s.region, n: s.n, deaths: s.deaths, ...(s.answer ? { answer: true } : {}) });
  };
  for (const w of words.use) {
    const deaths = hit(next, me, w.target, w.region, w.n, ctx.map, year);
    // The dead are the war's civilians too, under their own cause (engine/civilians.ts).
    bookStrike(next, me, w.region, deaths);
    record({ by: me, against: w.target, region: w.region, n: w.n, date: ctx.to, turn: state.turn, deaths });
  }
  // The world turns against the government that used it.
  outrage(next, me, applied, ctx.to);
  // The answer in kind, as the dice cast it before the turn.
  for (const target of [...new Set(words.use.map((w) => w.target))]) {
    const n = words.use.filter((w) => w.target === target).reduce((s, w) => s + w.n, 0);
    const answer = answerTo(state, target, n);
    if (!answer) continue;
    const region = cityOf(next, me, ctx.map);
    // An ally not at war with the player answers only by entering the war at its partner's side.
    if (!region || !enterToAnswer(next, answer.by, me, target, applied)) continue;
    const deaths = hit(next, answer.by, me, region, answer.n, ctx.map, year);
    bookStrike(next, answer.by, region, deaths);
    record({ by: answer.by, against: me, region, n: answer.n, date: ctx.to, turn: state.turn, deaths, answer: true });
  }
}

/** The player's goal for the stockpile, as the orders set it. Mutates `next`. */
export function applyAtomWords(next: GameState, words: AtomWords | undefined): void {
  const p = next.atom?.programmes[next.player];
  if (p && words?.goal !== undefined) p.goal = words.goal;
}

// ---- what the panel and the game master see

export interface AtomView {
  done: AtomProgramme["done"];
  /** The stage worked on now, its work done 0–1, and when it is reached at this pace (a year with its fraction). */
  next?: { stage: AtomStage; work: number; expected?: number };
  stock: number;
  goal?: number;
  has: boolean;
}

/** The player's programme as the science panel shows it. */
export function atomView(state: GameState, playerRate = 0): AtomView | null {
  const p = state.atom?.programmes[state.player];
  if (!p) return null;
  const s = nextStage(p);
  const now = at(state.date);
  const next = s
    ? {
        stage: s,
        work: clamp((p.work[s] ?? 0) / STAGE_WORK[s], 0, 1),
        ...(playerRate > 0 ? { expected: round2(now + (STAGE_WORK[s] - (p.work[s] ?? 0)) / playerRate) } : {}),
      }
    : undefined;
  return { done: p.done, ...(next ? { next } : {}), stock: p.stock, ...(p.goal !== undefined ? { goal: p.goal } : {}), has: hasBomb(state, state.player) };
}

/** The declared atomic powers and their stockpiles, the largest first; the undeclared (Israel's) only when asked. */
export function atomicPowers(state: Pick<GameState, "countries"> & Partial<Pick<GameState, "atom">>, undeclared = false): { tag: string; stock: number; hydrogen: boolean; undeclared?: boolean }[] {
  return Object.entries(state.atom?.programmes ?? {})
    .filter(([tag, p]) => hasBomb(state, tag) && !p.ended && (undeclared || !p.undeclared || made(p, "test")))
    .map(([tag, p]) => ({ tag, stock: p.stock, hydrogen: made(p, "hydrogen"), ...(p.undeclared && !made(p, "test") ? { undeclared: true } : {}) }))
    .sort((a, b) => b.stock - a.stock || a.tag.localeCompare(b.tag));
}

/**
 * The atom for the game master: the atomic powers and their stockpiles, the
 * programmes under way (the engine's secret knowledge), the player's, the
 * strikes so far, and – when the orders ask for a strike – the answer the
 * dice have cast. Rules the game master must keep come with it.
 */
export function describeAtom(state: GameState, orders: readonly string[] = []): string[] {
  const atom = state.atom;
  if (!atom) return [];
  const powers = atomicPowers(state, true);
  const lines = ["", "ATOMIC POWERS (the engine keeps every programme, test and stockpile; other governments threaten or use nuclear weapons only as their doctrines and the engine's escalation ladder decide (NUCLEAR DOCTRINES AT WAR, when any power is at war), and only the engine carries out a strike):"];
  lines.push(`- ${powers.length ? powers.map((x) => `${x.tag} ${x.stock} warheads${x.hydrogen ? " (hydrogen bomb)" : ""}${x.undeclared ? " (undeclared, never tested)" : ""}`).join("; ") : "none yet: no one has the bomb"}`);
  const working = Object.entries(atom.programmes)
    .filter(([tag, p]) => tag !== state.player && !p.ended && p.share > 0 && !hasBomb(state, tag))
    .map(([tag, p]) => {
      const s = nextStage(p);
      return `${tag}${s ? ` (${s} ${Math.round(((p.work[s] ?? 0) / STAGE_WORK[s]) * 100)}%)` : ""}`;
    });
  if (working.length) lines.push(`- programmes under way, in secret: ${working.join(", ")}`);
  const mine = state.atom?.programmes[state.player];
  if (mine) {
    const s = nextStage(mine);
    const done = mine.done.map((d) => `${d.id} ${d.date.slice(0, 7)}`).join(", ") || "nothing yet";
    lines.push(`- the player's programme: ${done}${s ? `; now ${s} ${Math.round(((mine.work[s] ?? 0) / STAGE_WORK[s]) * 100)}%` : ""}${hasBomb(state, state.player) ? `; ${mine.stock} warheads${mine.goal !== undefined ? `, ordered to ${mine.goal}` : ""}` : ""}`);
  }
  for (const s of (atom.strikes ?? []).slice(-4)) lines.push(`- NUCLEAR STRIKE ${s.date.slice(0, 7)}: ${s.by} on ${s.region} of ${s.against}, ${s.n} ${s.tactical ? "tactical " : ""}warhead${s.n > 1 ? "s" : ""}, about ${s.deaths} thousand dead${s.answer ? " (an answer in kind)" : ""}`);
  if (asksStrike(orders) && hasBomb(state, state.player)) {
    const targets = state.wars.flatMap((w) => (w.attackers.includes(state.player) ? w.defenders : w.defenders.includes(state.player) ? w.attackers : []));
    const answers = [...new Set(targets)].map((t) => {
      const a = answerTo(state, t, 1);
      return `${t}: ${a ? `${a.by} answers in kind on the player's largest city` : "no answer in kind"}`;
    });
    lines.push(
      `- THE ORDERS ASK FOR A NUCLEAR STRIKE. It is the gravest act there is: if the orders really give it, put it in "atom.use" (the enemy's tag, the province, how many warheads); the engine alone carries it out – a city's people dead, the world's outrage, sanctions, unrest at home – and the dice have already cast the answer: ${answers.join("; ") || "no enemy at war to strike"}. Tell it soberly, in proportion to what it is.`,
    );
  }
  return lines;
}

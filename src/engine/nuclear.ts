import { cutTroops } from "./army";
import { ALLY_ANSWER, ANSWER, enterToAnswer, hasBomb, hit, nuclearShield, outrage } from "./atom";
import { bookStrike } from "./civilians";
import { roll } from "./dice";
import { STEP_YEARS } from "./economy";
import { governs } from "./figures";
import type { TurnPlan } from "./formations";
import { stanceOf, type Stances } from "./fronts";
import { peopleIn } from "./population";
import { distanceKm } from "./provinces";
import { alliesOf, isMilitary, warBetween } from "./relations";
import { yearFraction } from "./researchEffects";
import { LADDER_STEPS, type AppliedChange, type GameState, type LadderStep, type MapIndex, type MapRegion, type NuclearLadder, type RegimeKind, type War } from "./types";
import { BROKEN, readState, willToFight, type Reading } from "./warMeans";

/**
 * Nuclear doctrine for the governments the engine plays. Every atomic power
 * has a doctrine of its era – when it would threaten, raise its alert,
 * demonstrate, strike at the front and strike cities – and at war the
 * engine climbs an escalation ladder for it, rung by rung:
 *
 * 1. open threats (the news and the game master's lines),
 * 2. a raised alert,
 * 3. a demonstration: a test, or a warning shot at sea,
 * 4. a tactical strike at the front: a military target in a front province,
 * 5. a strike on the enemy's cities.
 *
 * Each rung is reached when the danger the country sees passes its
 * doctrine's line for it, and climbed by the dice: faster the further past
 * the line, slower for a cautious leader (one stops lower, short of a
 * strike), slower against an enemy that can answer (its stockpile and
 * missiles, its allies' umbrella – lowering the chance, never removing it)
 * and under the era's taboo, strongest after the Cuban crisis and through
 * the arms-control years. The danger is how near defeat it is: the capital
 * held, fought for or approached, the heartland lost, the land, the army
 * breaking (its losses, its will broken), the regime about to fall, the economy
 * strangled, the enemy on its soil at all, and a nuclear strike on it – each
 * weighed by the doctrine. When the danger recedes the ladder is climbed
 * down; when the war ends the forces stand down.
 *
 * The doctrines: the Soviet Union's massive answer (a no-first-use pledge
 * declared from 1982), Russia's "existence of the state" from 1993, lowered
 * in 2000, raised in 2010, spelled out for a conventional attack in 2020 and
 * extended to Belarus and to a critical threat to sovereignty in 2024; the
 * United States' early monopoly, massive retaliation from 1954 and flexible
 * response from 1962, with extended deterrence over its allies (NATO,
 * Japan, South Korea); Britain's; France's "vital interests" and a single
 * warning strike before the cities; China's and India's no first use,
 * answering only a nuclear strike; Israel's last resort; Pakistan's first use
 * against a conventional defeat by India – thresholds of land lost, the army
 * destroyed, the economy strangled, the state destabilised, lower once it
 * had tactical weapons in 2011; North Korea's regime survival and
 * pre-emption, codified in 2022; South Africa's demonstration only. A
 * newcomer of the free mode gets one from its regime, and a lower one when
 * the enemy it faces has the bomb.
 *
 * All of it is cast before the turn by the engine's dice (castLadder), so the
 * game master can tell it, and carried out by the engine alone through
 * engine/atom.ts's machinery – the toll, the world's outrage and sanctions,
 * the answer in kind by its own dice; a tactical strike also breaks the
 * enemy's attack where it falls: its soldiers there are killed and wounded
 * in thousands and its advance in that war stops for the turn.
 */

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const round2 = (v: number) => Math.round(v * 100) / 100;

/** What the danger a country sees is read from (each 0–1): the capital, the heartland, the land, the army, the regime, the economy, the enemy on its soil, a nuclear strike on it, and its allies under its umbrella. */
export const RED_LINES = ["capital", "heart", "land", "army", "regime", "economy", "soil", "struck", "allies"] as const;
export type RedLine = (typeof RED_LINES)[number];

type Lines = [number, number, number, number, number];

export const DOCTRINE_IDS = [
  "soviet",
  "soviet-nfu",
  "russia-1993",
  "russia-2000",
  "russia-2010",
  "russia-2020",
  "russia-2024",
  "usa-early",
  "usa-massive",
  "usa-flexible",
  "uk",
  "france",
  "china",
  "india",
  "israel",
  "pakistan",
  "pakistan-full",
  "north-korea",
  "north-korea-2022",
  "south-africa",
  "new-democracy",
  "new-limited",
  "new-party",
  "new-autocracy",
] as const;
export type DoctrineId = (typeof DOCTRINE_IDS)[number];

export interface Doctrine {
  id: DoctrineId;
  /** The danger at which each rung is reached: threats, alert, demonstration, tactical, cities. */
  lines: Lines;
  /** How much each reading of the danger counts. */
  weights: Partial<Record<RedLine, number>>;
  /** No first use: nothing past the alert until a nuclear strike falls on it. */
  noFirstUse?: boolean;
  /** The highest rung at all. */
  max?: number;
  /** Allies under its umbrella: how much their danger counts as its own, and who they are – the blocs (by id) and the countries it covers. */
  umbrella?: number;
  covers?: string[];
  /** A single warning strike, never repeated, before the cities (France's ultimate warning). */
  warning?: boolean;
  /** How it demonstrates: a test, or a warning shot at sea. */
  demo: "test" | "sea";
  /** The enemy its lines were drawn against; against any other they stand higher. */
  rival?: string;
  /** Its words, for the game master. */
  says: string;
}

const EXISTENTIAL: Doctrine["weights"] = { capital: 1, heart: 0.9, land: 0.6, army: 0.35, regime: 0.35, economy: 0.15, soil: 0.2, struck: 1 };
const WESTERN: Doctrine["weights"] = { capital: 1, heart: 0.9, land: 0.6, army: 0.3, regime: 0.2, soil: 0.2, struck: 1 };
const LAST_RESORT: Doctrine["weights"] = { capital: 1, heart: 1, land: 0.8, army: 0.45, soil: 0.3, struck: 1 };
const KIDWAI: Doctrine["weights"] = { capital: 1, heart: 1, land: 1, army: 0.9, economy: 0.5, regime: 0.5, soil: 0.35, struck: 1 };
const SURVIVAL: Doctrine["weights"] = { capital: 1, heart: 1, land: 0.9, army: 0.6, regime: 0.8, economy: 0.3, soil: 0.5, struck: 1 };

export const DOCTRINES: Record<DoctrineId, Doctrine> = {
  soviet: { id: "soviet", lines: [0.2, 0.35, 0.55, 0.68, 0.88], weights: EXISTENTIAL, umbrella: 0.55, covers: ["warsaw-pact"], demo: "sea", says: "the Soviet Union answers an attack that threatens the state with everything it has; its allies of the Warsaw Pact under its umbrella" },
  "soviet-nfu": { id: "soviet-nfu", lines: [0.25, 0.4, 0.6, 0.75, 0.92], weights: EXISTENTIAL, umbrella: 0.55, covers: ["warsaw-pact"], demo: "sea", says: "the Soviet Union has pledged no first use (1982), but its plans still answer a war that threatens the state's existence" },
  "russia-1993": { id: "russia-1993", lines: [0.2, 0.35, 0.55, 0.7, 0.9], weights: EXISTENTIAL, umbrella: 0.45, covers: ["csto"], demo: "sea", says: "Russia (1993) drops the Soviet no-first-use pledge: the bomb answers aggression that threatens the state's existence" },
  "russia-2000": { id: "russia-2000", lines: [0.15, 0.3, 0.5, 0.62, 0.86], weights: EXISTENTIAL, umbrella: 0.45, covers: ["csto"], demo: "sea", says: "Russia (2000): nuclear use against a conventional attack in situations critical to national security, a limited strike to 'de-escalate'" },
  "russia-2010": { id: "russia-2010", lines: [0.18, 0.32, 0.52, 0.66, 0.88], weights: EXISTENTIAL, umbrella: 0.45, covers: ["csto"], demo: "sea", says: "Russia (2010): nuclear use when the very existence of the state is threatened, by any weapons" },
  "russia-2020": { id: "russia-2020", lines: [0.15, 0.3, 0.48, 0.6, 0.86], weights: EXISTENTIAL, umbrella: 0.45, covers: ["csto"], demo: "sea", says: "Russia's Basic Principles (2020): nuclear use against aggression with conventional weapons that puts the very existence of the state in jeopardy" },
  "russia-2024": { id: "russia-2024", lines: [0.12, 0.25, 0.42, 0.55, 0.82], weights: EXISTENTIAL, umbrella: 0.5, covers: ["csto", "belarus"], demo: "sea", says: "Russia (2024): nuclear use against a critical threat to its sovereignty and territorial integrity, or Belarus's, conventional or not" },
  "usa-early": { id: "usa-early", lines: [0.25, 0.45, 0.62, 0.74, 0.88], weights: WESTERN, umbrella: 0.65, covers: ["nato", "japan", "south-korea"], demo: "test", says: "the United States holds the bomb as the war-winning weapon of last resort; its allies under its protection" },
  "usa-massive": { id: "usa-massive", lines: [0.2, 0.38, 0.55, 0.66, 0.84], weights: WESTERN, umbrella: 0.65, covers: ["nato", "japan", "south-korea"], demo: "test", says: "massive retaliation (1954): an attack on the United States or its allies may be answered with nuclear weapons at places of its choosing" },
  "usa-flexible": { id: "usa-flexible", lines: [0.25, 0.42, 0.6, 0.72, 0.92], weights: WESTERN, umbrella: 0.65, covers: ["nato", "japan", "south-korea"], demo: "sea", says: "flexible response: a graduated answer, nuclear use only in extreme circumstances to defend the vital interests of the United States and its allies – NATO, Japan, South Korea – under its extended deterrence" },
  uk: { id: "uk", lines: [0.3, 0.45, 0.65, 0.78, 0.92], weights: WESTERN, umbrella: 0.4, covers: ["nato"], demo: "sea", says: "Britain keeps a minimum deterrent for extreme circumstances of self-defence, its forces committed to NATO's" },
  france: { id: "france", lines: [0.3, 0.45, 0.6, 0.72, 0.9], weights: WESTERN, umbrella: 0.3, covers: ["nato"], warning: true, demo: "test", says: "France's deterrence guards its 'vital interests': a single ultimate warning strike on a military target, then the cities" },
  china: { id: "china", lines: [0.25, 0.45, 0.6, 0.7, 0.85], weights: WESTERN, noFirstUse: true, demo: "test", says: "China declares no first use at any time and under any circumstances: it answers only a nuclear strike" },
  india: { id: "india", lines: [0.25, 0.45, 0.6, 0.7, 0.85], weights: WESTERN, noFirstUse: true, demo: "test", says: "India's doctrine: no first use, and a massive retaliation to a nuclear strike" },
  israel: { id: "israel", lines: [0.45, 0.6, 0.75, 0.82, 0.93], weights: LAST_RESORT, demo: "test", says: "Israel neither confirms nor denies; its bomb is the last resort, when the survival of the state is at stake" },
  pakistan: { id: "pakistan", lines: [0.12, 0.22, 0.35, 0.52, 0.8], weights: KIDWAI, rival: "india", demo: "test", says: "Pakistan reserves first use against a conventional defeat by India: large parts of its land lost, its army or air force destroyed, its economy strangled, the state destabilised" },
  "pakistan-full": { id: "pakistan-full", lines: [0.1, 0.2, 0.32, 0.48, 0.78], weights: KIDWAI, rival: "india", demo: "test", says: "Pakistan's full-spectrum deterrence (2011): tactical nuclear weapons against India's armoured thrusts, first use against a conventional defeat" },
  "north-korea": { id: "north-korea", lines: [0.05, 0.12, 0.25, 0.45, 0.65], weights: SURVIVAL, demo: "test", says: "North Korea's bomb guards the regime's survival; it threatens readily and tests to warn" },
  "north-korea-2022": { id: "north-korea-2022", lines: [0.04, 0.1, 0.2, 0.4, 0.6], weights: SURVIVAL, demo: "test", says: "North Korea's law of 2022: automatic and pre-emptive nuclear strikes when the leadership or the state is threatened" },
  "south-africa": { id: "south-africa", lines: [0.3, 0.5, 0.65, 1, 1], weights: LAST_RESORT, max: 3, demo: "test", says: "South Africa's strategy goes no further than a demonstration test to bring the West in" },
  "new-democracy": { id: "new-democracy", lines: [0.35, 0.5, 0.7, 0.82, 0.93], weights: LAST_RESORT, demo: "test", says: "a new nuclear power that answers to its voters: the bomb only as a last resort" },
  "new-limited": { id: "new-limited", lines: [0.3, 0.45, 0.65, 0.78, 0.9], weights: WESTERN, demo: "test", says: "a new nuclear power: the bomb against a threat to the state's existence" },
  "new-party": { id: "new-party", lines: [0.2, 0.35, 0.55, 0.68, 0.88], weights: EXISTENTIAL, demo: "test", says: "a new nuclear power ruled by one party: the bomb against an attack that threatens the state" },
  "new-autocracy": { id: "new-autocracy", lines: [0.15, 0.3, 0.45, 0.6, 0.8], weights: SURVIVAL, demo: "test", says: "a new nuclear power ruled by one man or the army: the bomb guards the regime's survival" },
};

/** The doctrine a country's government holds on a day, against an enemy: history's by era, a newcomer's by its regime and the enemy it faces. */
export function doctrineOf(state: Pick<GameState, "countries" | "date"> & Partial<Pick<GameState, "player" | "scenarioId">>, tag: string, against?: string): Doctrine {
  const d = state.date;
  const known = (id: DoctrineId) => DOCTRINES[id];
  switch (tag) {
    case "ussr":
      return known(d >= "1982-06-15" ? "soviet-nfu" : "soviet");
    case "russia":
      return known(d >= "2024-11-19" ? "russia-2024" : d >= "2020-06-02" ? "russia-2020" : d >= "2010-02-05" ? "russia-2010" : d >= "2000-04-21" ? "russia-2000" : "russia-1993");
    case "usa":
      return known(d >= "1962-01-01" ? "usa-flexible" : d >= "1954-01-12" ? "usa-massive" : "usa-early");
    case "uk":
    case "france":
    case "china":
    case "india":
    case "israel":
    case "south-africa":
      return known(tag);
    case "pakistan":
      return known(d >= "2011-04-19" ? "pakistan-full" : "pakistan");
    case "north-korea":
      return known(d >= "2022-09-08" ? "north-korea-2022" : "north-korea");
  }
  const regime: RegimeKind = state.countries[tag]?.domestic?.regime ?? "autocracy";
  const base = known(regime === "democracy" ? "new-democracy" : regime === "limited" ? "new-limited" : regime === "party" ? "new-party" : "new-autocracy");
  // Facing an enemy with the bomb, a newcomer draws its lines lower: the weaker side's deterrence.
  if (against && hasBomb(state, against)) return { ...base, lines: base.lines.map((x) => round2(x * 0.9)) as Lines };
  return base;
}

/** The lines a doctrine holds against an enemy: higher against any other than the rival they were drawn for. */
const linesAgainst = (d: Doctrine, against: string): Lines => (d.rival && against !== d.rival ? (d.lines.map((x) => Math.min(1, round2(x + 0.12))) as Lines) : d.lines);

/** The capitals of the atomic powers, [longitude, latitude]: the province nearest is the capital's; any other country's is the province of most output. */
const CAPITALS: Record<string, [number, number]> = {
  ussr: [37.6, 55.75],
  russia: [37.6, 55.75],
  usa: [-77.0, 38.9],
  uk: [-0.1, 51.5],
  france: [2.35, 48.85],
  china: [116.4, 39.9],
  india: [77.2, 28.6],
  pakistan: [73.05, 33.7],
  israel: [35.2, 31.8],
  "north-korea": [125.75, 39.0],
  "south-africa": [28.2, -25.75],
};
/** The capital's province lies within this distance of its city, km. */
const CAPITAL_KM = 300;
/** The enemy this close to the capital counts as fully at its gates; this far, not at all, km – in a small country, a twentieth and a quarter of the way from the capital to its farthest province. */
const GATES_KM = 100;
const APPROACH_KM = 600;
const GATES_SHARE = 0.05;
const APPROACH_SHARE = 0.25;
const AT_GATES = 0.8;
/** The heartland: the provinces of most output that make this share of a country's. */
const HEARTLAND = 0.5;

/** The leaders history knew for their nerve with the bomb: a temper from −2 (would never) to 2. */
const TEMPERS: [RegExp, number][] = [
  [/putin|путин|путін/i, 1],
  [/kim jong[- ]?un|ким чен ын|кім чен ин/i, 1],
  [/kim jong[- ]?il|ким чен ир|кім чен ір/i, 1],
  [/khrushchev|хрущ/i, 1],
  [/mao zedong|mao tse|мао цзэдун|мао цзедун/i, 1],
  [/eisenhower|эйзенхауэр|ейзенгауер/i, 1],
  [/nixon|никсон|ніксон/i, 1],
  [/trump|трамп/i, 1],
  [/musharraf|мушарраф/i, 1],
  [/brezhnev|брежнев/i, -1],
  [/chernenko|черненко/i, -1],
  [/gorbachev|горбач/i, -2],
  [/kennedy|кеннеди|кеннеді/i, -1],
  [/lyndon|линдон|ліндон/i, -1],
  [/carter|картер/i, -1],
  [/obama|обама/i, -1],
  [/biden|байден/i, -1],
  [/vajpayee|ваджпаи|ваджпаї/i, -1],
  [/nawaz sharif|наваз шариф/i, -1],
];

/** A government's nerve with the bomb: its leader's temper as history knew it, else none. */
export function nuclearTemper(state: Pick<GameState, "countries">, tag: string): number {
  const c = state.countries[tag];
  const names = [c?.leader ?? "", ...(c?.rulers?.people ?? []).map((p) => p.name)].join(" | ");
  for (const [re, t] of TEMPERS) if (re.test(names)) return t;
  return 0;
}

/** How strong the taboo on using the bomb is by year, 0–1: little while it was new, strong after Cuba and through the arms-control years, wearing a little since. */
const TABOO: [number, number][] = [
  [1945, 0.1],
  [1950, 0.25],
  [1957, 0.35],
  [1962, 0.5],
  [1968, 0.6],
  [1987, 0.7],
  [1991, 0.7],
  [2000, 0.65],
  [2014, 0.6],
  [2022, 0.55],
];
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
export const tabooOf = (date: string) => byYear(TABOO, yearFraction(date));

/** The chance a month to climb to each rung once its line is passed, at an ordinary leader and no restraint: threats, alert, demonstration, tactical, cities. */
const CLIMB = [0.9, 0.7, 0.5, 0.45, 0.25];
/** The chance a month of a strike again while the danger holds on a strike's rung: tactical, cities. */
const AGAIN = [0.15, 0.1];
/** The chance a month to climb a rung down once the danger is this far below its line. */
const DOWN = 0.5;
const SLACK = 0.08;
/** The warheads a tactical strike or a strike on cities uses, at most. */
const MOST = 3;
/** A tactical warhead at the front: soldiers of the side it falls on killed, thousands, by year (wounded twice as many); and the most of that side's army one strike kills. */
const FRONT_KILLED: [number, number][] = [
  [1950, 4],
  [1970, 3],
  [2000, 2.5],
];
const FRONT_MOST = 0.08;
/** The chance a tactical strike draws an answer in kind from its target, and from the target's nuclear ally. */
const TACTICAL_ANSWER = 0.6;
const TACTICAL_ALLY = 0.4;

type Index = Pick<MapIndex, "regions"> & Partial<Pick<MapIndex, "neighbors">>;

/** The danger a country sees in a war, 0–1, and what it reads it from. */
export interface Danger {
  total: number;
  parts: Partial<Record<RedLine, number>>;
}

interface Land {
  capital?: string;
  /** Where the capital is, for distances. */
  at?: [number, number];
  /** The provinces of its own land an enemy holds or fights in, with how much of each. */
  lost: Map<string, number>;
}

/** The capital's province: the one nearest the capital's city, else the one of most output. */
function capitalOf(state: Pick<GameState, "regions">, tag: string, map: Record<string, MapRegion> | null | undefined): { id?: string; at?: [number, number] } {
  const city = CAPITALS[tag];
  let best: string | undefined;
  let bestKm = Infinity;
  let top: string | undefined;
  let most = -1;
  for (const [id, r] of Object.entries(state.regions)) {
    if (r.owner !== tag) continue;
    const m = map?.[id];
    const out = peopleIn(r, m) * (m?.inc ?? 3000);
    if (out > most || (out === most && top !== undefined && id < top)) {
      most = out;
      top = id;
    }
    if (city && m?.at) {
      const km = distanceKm(city, m.at);
      if (km < bestKm) {
        bestKm = km;
        best = id;
      }
    }
  }
  const id = best && bestKm <= CAPITAL_KM ? best : top;
  return { id, at: (best && bestKm <= CAPITAL_KM ? city : undefined) ?? (id ? map?.[id]?.at : undefined) };
}

/** The share of a province an enemy holds: all of it, or what its side of the front runs through. */
const heldBy = (r: GameState["regions"][string], enemies: ReadonlySet<string>) => (enemies.has(r.controller) ? 1 : r.contested && enemies.has(r.contested) ? (r.held ?? 30) / 100 : 0);

/**
 * How near defeat a country is against these enemies, read from the state: the capital (held, fought for, the enemy
 * at its approaches), the heartland and the land lost (by output, so a colony's rising is not the homeland's), the
 * army breaking (its losses in these wars, its will gone), the regime about to fall, the economy strangled, the enemy
 * on its soil at all, a nuclear strike from them since the war began.
 */
function readParts(state: GameState, tag: string, enemies: ReadonlySet<string>, wars: War[], map: Record<string, MapRegion> | null | undefined, reading: Reading | undefined): { parts: Record<Exclude<RedLine, "allies">, number>; land: Land } {
  const cap = capitalOf(state, tag, map);
  const own: [number, number][] = [];
  let total = 0;
  let lost = 0;
  let nearest = Infinity;
  let farthest = 0;
  const lostLand = new Map<string, number>();
  for (const [id, r] of Object.entries(state.regions)) {
    if (r.owner !== tag) continue;
    const m = map?.[id];
    const out = map ? peopleIn(r, m) * (m?.inc ?? 3000) : 1;
    const f = heldBy(r, enemies);
    total += out;
    lost += out * f;
    own.push([out, f]);
    const km = cap.at && m?.at ? distanceKm(cap.at, m.at) : undefined;
    if (km !== undefined) farthest = Math.max(farthest, km);
    if (f > 0) {
      lostLand.set(id, f);
      if (km !== undefined) nearest = Math.min(nearest, km);
    }
  }
  const gates = Math.min(GATES_KM, GATES_SHARE * farthest);
  const approach = Math.max(gates + 1, Math.min(APPROACH_KM, APPROACH_SHARE * farthest));
  const share = total > 0 ? lost / total : 0;
  // The capital: held, fought for, or the enemy at its approaches.
  const cr = cap.id ? state.regions[cap.id] : undefined;
  const capital = !cr ? 0 : enemies.has(cr.controller) ? 1 : cr.contested && enemies.has(cr.contested) ? 0.85 + (0.15 * (cr.held ?? 30)) / 100 : nearest <= gates ? AT_GATES : AT_GATES * clamp(1 - (nearest - gates) / (approach - gates), 0, 1) ** 2;
  // The heartland: the provinces of most output that make half the country's.
  own.sort((a, b) => b[0] - a[0]);
  let heartAll = 0;
  let heartLost = 0;
  for (const [out, f] of own) {
    if (heartAll >= HEARTLAND * total && heartAll > 0) break;
    heartAll += out;
    heartLost += out * f;
  }
  // The army: what these wars cost it in killed and taken against what it has; a little more once its will has broken
  // (a side whose will has gone seeks terms rather than the bomb – engine/warMeans.ts).
  let fallen = 0;
  for (const w of wars) {
    const l = w.losses?.[tag];
    if (l) fallen += l.killed + (l.captured ?? 0) + 0.3 * l.wounded;
  }
  const troops = state.countries[tag]?.economy?.troops ?? 0;
  const casualty = fallen > 0 ? fallen / (troops + fallen) : 0;
  const will = reading ? willToFight(state, tag, map, reading) : 50;
  const army = clamp((casualty - 0.1) / 0.4 + (will < BROKEN ? 0.15 : 0), 0, 1);
  // The regime about to fall: the state's hold on the country gone; a government in exile has fallen already.
  const d = state.countries[tag]?.domestic;
  const regime = state.countries[tag]?.exile ? 1 : d ? clamp((25 - d.stability) / 25, 0, 1) : 0;
  // The economy strangled: its trade cut by blockade and sanctions.
  const economy = clamp(((state.countries[tag]?.economy?.tradeCut ?? 0) - 0.35) / 0.5, 0, 1);
  const since = wars.map((w) => w.since).sort()[0] ?? state.date;
  const struck = (state.atom?.strikes ?? []).some((s) => s.against === tag && enemies.has(s.by) && s.date >= since) ? 1 : 0;
  return {
    parts: {
      capital: round2(capital),
      heart: round2(heartAll > 0 ? heartLost / heartAll : 0),
      land: round2(clamp(share / 0.5, 0, 1)),
      army: round2(army),
      regime: round2(regime),
      economy: round2(economy),
      soil: lostLand.size ? round2(clamp(0.3 + share * 5, 0, 1)) : 0,
      struck,
    },
    land: { capital: cap.id, at: cap.at, lost: lostLand },
  };
}

/** The danger from readings, by a doctrine's weights: each reading a chance of its own that the state is lost. */
const totalOf = (parts: Partial<Record<RedLine, number>>, weights: Doctrine["weights"]) => round2(1 - RED_LINES.reduce((p, k) => p * (1 - clamp((weights[k] ?? 0) * (parts[k] ?? 0), 0, 1)), 1));

/** The wars a country fights now, outside a truce. */
const fighting = (state: Pick<GameState, "wars" | "date">, tag: string) => state.wars.filter((w) => (w.attackers.includes(tag) || w.defenders.includes(tag)) && !(w.truce && w.truce.until > state.date));
const otherSide = (w: War, tag: string) => (w.attackers.includes(tag) ? w.defenders : w.attackers);
const ownSide = (w: War, tag: string) => (w.attackers.includes(tag) ? w.attackers : w.defenders);

/** The player's government decides its own nuclear steps – only by its orders – while the player governs; a player who leads the opposition, serves as a minister or commands an army has a government the engine plays. */
const playerDecides = (state: Pick<GameState, "player" | "role">, tag: string) => tag === state.player && governs(state);

/** A country's warheads in store. */
const stockOf = (state: Pick<GameState, "countries"> & Partial<Pick<GameState, "atom">>, tag: string) => (hasBomb(state, tag) ? (state.atom?.programmes[tag]?.stock ?? 50) : 0);

/** The enemy a country faces down in a war: the one that holds most of its land, else the largest economy of the other side. */
function principalEnemy(state: GameState, side: string[], lost: Map<string, number>): string {
  const held = new Map<string, number>();
  for (const [id, f] of lost) {
    const r = state.regions[id];
    const by = side.includes(r.controller) ? r.controller : r.contested ?? r.controller;
    held.set(by, (held.get(by) ?? 0) + f);
  }
  return [...side].sort((a, b) => (held.get(b) ?? 0) - (held.get(a) ?? 0) || (state.countries[b]?.economy?.gdp ?? 0) - (state.countries[a]?.economy?.gdp ?? 0) || a.localeCompare(b))[0];
}

/** The allies a doctrine's umbrella covers: its military allies in the blocs it names, and the countries it names. */
function underUmbrella(state: Pick<GameState, "alliances">, tag: string, d: Doctrine): Set<string> {
  const covers = new Set(d.covers ?? []);
  const out = new Set<string>();
  for (const a of state.alliances) {
    if (!isMilitary(a) || !a.members.includes(tag)) continue;
    for (const m of a.members) if (m !== tag && (covers.has(a.id) || covers.has(m))) out.add(m);
  }
  return out;
}

/** One atomic power's reading of a war: the danger by its doctrine, the enemy it faces, what it holds of its land. */
export interface WarReading {
  war: War;
  against: string;
  doctrine: Doctrine;
  lines: Lines;
  danger: Danger;
  land: Land;
  enemies: Set<string>;
}

/** How an atomic power reads each war it fights, the most dangerous first. */
export function readWars(state: GameState, tag: string, map?: Record<string, MapRegion> | null, reading?: Reading): WarReading[] {
  const wars = fighting(state, tag);
  const out: WarReading[] = [];
  for (const war of wars) {
    const side = otherSide(war, tag);
    const enemies = new Set(side);
    const { parts, land } = readParts(state, tag, enemies, [war], map, reading);
    const against = principalEnemy(state, side, land.lost);
    const doctrine = doctrineOf(state, tag, against);
    const all: Partial<Record<RedLine, number>> = { ...parts };
    // Its allies under its umbrella, fighting beside it against the same enemy: their danger counts as its own.
    if (doctrine.umbrella) {
      let worst = 0;
      for (const ally of underUmbrella(state, tag, doctrine)) {
        if (!ownSide(war, tag).includes(ally)) continue;
        worst = Math.max(worst, totalOf(readParts(state, ally, enemies, [war], map, undefined).parts, WESTERN));
      }
      if (worst > 0) all.allies = worst;
    }
    const weights = { ...doctrine.weights, ...(doctrine.umbrella ? { allies: doctrine.umbrella } : {}) };
    out.push({ war, against, doctrine, lines: linesAgainst(doctrine, against), danger: { total: totalOf(all, weights), parts: all }, land, enemies });
  }
  return out.sort((a, b) => b.danger.total - a.danger.total || a.war.id.localeCompare(b.war.id));
}

/** What the ladder does this turn for one atomic power, cast before the turn. */
export interface LadderAct {
  kind: "test" | "sea" | "tactical" | "cities";
  /** The province struck, and the country whose soldiers or city it falls on. */
  region?: string;
  against: string;
  n: number;
  /** A strike again on a rung already reached. */
  again?: boolean;
  /** Soldiers of `against` a tactical strike kills there, thousands (wounded twice as many). */
  soldiers?: number;
}

/** The answer in kind a strike draws, as the dice cast it before the turn. */
export interface LadderAnswer {
  by: string;
  /** The striker it falls on. */
  against: string;
  region: string;
  n: number;
  tactical: boolean;
  soldiers?: number;
}

export interface LadderMove {
  tag: string;
  war: string;
  against: string;
  doctrine: DoctrineId;
  danger: number;
  parts: Partial<Record<RedLine, number>>;
  /** The rung before the turn and after it (0: none). */
  from: number;
  to: number;
  /** The highest rung it may reach now, by its doctrine, leader and means. */
  cap: number;
  act?: LadderAct;
  answer?: LadderAnswer;
}

/** How far a leader goes: a cautious one (history's, or a government with next to no appetite for force) stops short of a strike, the most cautious at the alert – unless a strike has fallen on them. */
function leaderCap(state: GameState, tag: string, struck: boolean): number {
  if (struck) return 5;
  const hawk = state.countries[tag]?.course?.hawk ?? 50;
  const temper = nuclearTemper(state, tag);
  if (temper <= -2) return 2;
  if (temper <= -1 || hawk < DOVE) return 3;
  return 5;
}
/** A government with less appetite for force than this goes no further than a demonstration. */
const DOVE = 15;

/** A leader's push up the ladder: the government's appetite for force and the leader's nerve. */
function characterOf(state: GameState, tag: string): number {
  const hawk = state.countries[tag]?.course?.hawk ?? 50;
  return (0.6 + (0.8 * hawk) / 100) * (1 + 0.15 * nuclearTemper(state, tag));
}

/** The enemy's means to answer: its own bomb, or the umbrella of its nuclear allies. */
function answerMeans(state: GameState, tag: string, enemies: ReadonlySet<string>): number {
  let s = 0;
  for (const e of enemies) {
    s = Math.max(s, nuclearShield(state, e));
    for (const a of alliesOf(state, e)) if (a !== tag && !enemies.has(a)) s = Math.max(s, 0.7 * nuclearShield(state, a));
  }
  return s;
}

/**
 * The chance a month to climb to rung `k` (1–5): faster the further past its line, by the leader's character; the
 * demonstration and the strikes held back by the era's taboo and the enemy's means to answer – both weigh less the
 * nearer defeat is, never nothing.
 */
export function climbChance(k: number, danger: number, line: number, ctx: { character: number; taboo: number; means: number }): number {
  const urgency = clamp(1 + 3 * (danger - line), 1, 2);
  const soft = clamp(1.2 - danger, 0.2, 1);
  const taboo = k <= 2 ? 1 : k === 3 ? 1 - 0.5 * ctx.taboo * soft : 1 - ctx.taboo * soft;
  const deter = k <= 2 ? 1 : clamp(1 - (k === 3 ? 0.3 : k === 4 ? 0.6 : 0.8) * ctx.means * soft, 0.15, 1);
  return clamp(CLIMB[k - 1] * ctx.character * taboo * deter * urgency, 0, 0.95);
}

const perTurn = (monthly: number, months: number) => 1 - (1 - monthly) ** Math.max(0.25, months);

/** Where a tactical strike falls: the province of its own (or an ally's) land the enemy holds or fights in nearest the capital; else the enemy's front province next to its own lines. */
function tacticalTarget(state: GameState, tag: string, r: WarReading, map: Record<string, MapRegion> | null | undefined, neighbors: Record<string, string[]> | undefined): string | undefined {
  const at = r.land.at;
  const km = (id: string) => (at && map?.[id]?.at ? distanceKm(at, map[id].at!) : 0);
  const pick = (ids: string[]) => ids.sort((a, b) => km(a) - km(b) || a.localeCompare(b))[0];
  const own = [...r.land.lost.keys()];
  if (own.length) return pick(own);
  // An ally's land under its umbrella.
  const allies = new Set([...underUmbrella(state, tag, r.doctrine)].filter((a) => ownSide(r.war, tag).includes(a)));
  const theirs = Object.entries(state.regions)
    .filter(([, x]) => allies.has(x.owner) && heldBy(x, r.enemies) > 0)
    .map(([id]) => id);
  if (theirs.length) return pick(theirs);
  if (!neighbors) return undefined;
  const mine = ownSide(r.war, tag);
  const front = Object.entries(state.regions)
    .filter(([id, x]) => r.enemies.has(x.controller) && (neighbors[id] ?? []).some((n) => state.regions[n] && mine.includes(state.regions[n].controller)))
    .map(([id]) => id);
  return front.length ? pick(front) : undefined;
}

/** A country's largest city of its own, where a strike on its cities falls: the most populous province it owns and holds (never land of another it occupies). */
function cityTarget(state: Pick<GameState, "regions">, tag: string, map: Record<string, MapRegion> | null | undefined): string | undefined {
  let best: string | undefined;
  let most = -1;
  for (const [id, r] of Object.entries(state.regions)) {
    if (r.owner !== tag || r.controller !== tag) continue;
    const n = peopleIn(r, map?.[id]);
    if (n > most) {
      most = n;
      best = id;
    }
  }
  return best;
}

/** The country whose soldiers a strike at a province kills: the enemy holding it, else the one fighting in it. */
const soldiersAt = (state: GameState, region: string, enemies: ReadonlySet<string>, fallback: string) => {
  const x = state.regions[region];
  return x && enemies.has(x.controller) ? x.controller : x?.contested && enemies.has(x.contested) ? x.contested : fallback;
};

/** Soldiers a tactical strike of `n` warheads kills of a country's army, thousands. */
function frontToll(state: GameState, victim: string, n: number): number {
  const troops = state.countries[victim]?.economy?.troops ?? 0;
  return round2(Math.min(n * byYear(FRONT_KILLED, yearFraction(state.date)), troops * FRONT_MOST));
}

/** The answer in kind a strike draws: from its target if it has warheads, else its strongest nuclear ally; never the player's, whose answer is its own orders. */
function answerFor(state: GameState, by: string, victim: string, n: number, tactical: boolean, struck: string, map: Record<string, MapRegion> | null | undefined): LadderAnswer | undefined {
  if (playerDecides(state, victim)) return undefined;
  const game = state.seed ?? state.id;
  const r = roll(game, state.turn, `nuclear:answer:${by}:${victim}`);
  const own = stockOf(state, victim) >= 1;
  const ally = own ? undefined : [...alliesOf(state, victim)].filter((t) => !playerDecides(state, t) && t !== by && stockOf(state, t) >= 1).sort((a, b) => stockOf(state, b) - stockOf(state, a) || a.localeCompare(b))[0];
  const answerer = own ? victim : ally;
  if (!answerer) return undefined;
  const chance = own ? (tactical ? TACTICAL_ANSWER : ANSWER) : tactical ? TACTICAL_ALLY : ALLY_ANSWER;
  if (r >= chance) return undefined;
  let region: string | undefined;
  if (tactical) {
    // On the striker's own forces: the province it holds nearest the one struck.
    const at = map?.[struck]?.at;
    let best = Infinity;
    for (const [id, x] of Object.entries(state.regions)) {
      if (x.controller !== by) continue;
      const km = at && map?.[id]?.at ? distanceKm(at, map[id].at!) : Infinity;
      if (km < best || (km === best && region !== undefined && id < region)) {
        best = km;
        region = id;
      }
    }
  } else region = cityTarget(state, by, map);
  if (!region) return undefined;
  const m = Math.min(stockOf(state, answerer), Math.max(1, n));
  return { by: answerer, against: by, region, n: m, tactical, ...(tactical ? { soldiers: frontToll(state, by, m) } : {}) };
}

/**
 * Every atomic power's ladder for the coming turn, cast by the engine's dice before it: the rung each reaches, the
 * demonstration or strike that comes with it, the answer in kind a strike draws. Only governments the engine plays
 * climb one – the player's own only when the player does not govern it (a leader of the opposition, a minister, a
 * general); a ladder whose war is over is stood down. `index` gives the map's people, output and places (and, with its
 * neighbours, a front to strike when the enemy holds none of the land).
 */
export function castLadder(state: GameState, index?: Index | null): LadderMove[] {
  const atom = state.atom;
  if (!atom) return [];
  const map = index?.regions;
  const game = state.seed ?? state.id;
  const months = (STEP_YEARS[state.step] ?? 1 / 12) * 12;
  const dice = (key: string) => roll(game, state.turn, `nuclear:${key}`);
  const candidates = new Set<string>(Object.keys(atom.ladder ?? {}));
  for (const w of state.wars) {
    if (w.truce && w.truce.until > state.date) continue;
    for (const t of [...w.attackers, ...w.defenders]) if (!playerDecides(state, t) && hasBomb(state, t)) candidates.add(t);
  }
  if (!candidates.size) return [];
  let reading: Reading | undefined;
  const taboo = tabooOf(state.date);
  const moves: LadderMove[] = [];
  for (const tag of [...candidates].sort()) {
    const ladder = atom.ladder?.[tag];
    const c = state.countries[tag];
    const from = ladder?.step ?? 0;
    const able = !playerDecides(state, tag) && c && !c.dormant && !c.exile && hasBomb(state, tag) && stockOf(state, tag) >= 1;
    const wars = able ? fighting(state, tag) : [];
    // A ladder whose war is over (a peace, a truce) is stood down at once, whatever else the country still fights.
    if (!wars.length || (ladder && !wars.some((w) => w.id === ladder.war))) {
      if (ladder) moves.push({ tag, war: ladder.war, against: ladder.against, doctrine: doctrineOf(state, tag, ladder.against).id, danger: 0, parts: {}, from, to: 0, cap: 0 });
      continue;
    }
    reading ??= readState(state, map);
    const r = readWars(state, tag, map, reading)[0];
    const danger = r.danger.total;
    const struck = (r.danger.parts.struck ?? 0) > 0 || (r.danger.parts.allies ?? 0) >= 1;
    let cap = Math.min(r.doctrine.max ?? 5, leaderCap(state, tag, struck));
    if (r.doctrine.noFirstUse && !struck) cap = Math.min(cap, 2);
    const ctx = { character: characterOf(state, tag), taboo, means: answerMeans(state, tag, r.enemies) };
    let target = 0;
    for (let k = 1; k <= cap; k++) if (danger >= r.lines[k - 1]) target = k;
    const move: LadderMove = { tag, war: r.war.id, against: r.against, doctrine: r.doctrine.id, danger, parts: r.danger.parts, from, to: from, cap };
    const strike = (k: number, again: boolean): boolean => {
      const stock = stockOf(state, tag);
      if (k === 4) {
        const region = tacticalTarget(state, tag, r, map, index?.neighbors);
        if (!region) return false;
        const n = Math.min(stock, r.doctrine.warning ? 1 : clamp(1 + Math.floor((danger - r.lines[3]) * 10), 1, MOST));
        const victim = soldiersAt(state, region, r.enemies, r.against);
        move.act = { kind: "tactical", region, against: victim, n, soldiers: frontToll(state, victim, n), ...(again ? { again: true } : {}) };
        const a = answerFor(state, tag, victim, n, true, region, map);
        if (a) move.answer = a;
        return true;
      }
      const region = cityTarget(state, r.against, map);
      if (!region) return false;
      const n = Math.min(stock, clamp(1 + Math.floor((danger - r.lines[4]) * 10), 1, MOST));
      move.act = { kind: "cities", region, against: r.against, n, ...(again ? { again: true } : {}) };
      const a = answerFor(state, tag, r.against, n, false, region, map);
      if (a) move.answer = a;
      return true;
    };
    if (target > from) {
      // Up a rung, by the dice; the words come fast – threats and the alert together, a demonstration on their heels.
      let to = from;
      if (dice(`${tag}:up`) < perTurn(climbChance(from + 1, danger, r.lines[from], ctx), months)) to = from + 1;
      if (to > from && to <= 2 && target > to && dice(`${tag}:up2`) < perTurn(climbChance(to + 1, danger, r.lines[to], ctx), months)) to += 1;
      if (to > from && to >= 4 && !strike(to, false)) to = from;
      if (to === 3 && from < 3) move.act = { kind: r.doctrine.demo, against: r.against, n: 1 };
      move.to = to;
    } else if (from >= 4 && target >= from && !(from === 4 && r.doctrine.warning)) {
      // On a strike's rung with the danger still there: another strike, now and then.
      const p = perTurn(AGAIN[from - 4] * ctx.character * (1 - taboo * clamp(1.2 - danger, 0.2, 1)) * clamp(1 - 0.6 * ctx.means, 0.2, 1), months);
      if (dice(`${tag}:again`) < p) strike(from, true);
    } else if (target < from && (from > cap || danger < r.lines[from - 1] - SLACK)) {
      // The danger has receded: a rung down, two when it has gone well below the next.
      const below = (k: number) => k > target && (k > cap || danger < r.lines[k - 1] - SLACK);
      let to = from;
      if (dice(`${tag}:down`) < perTurn(DOWN, months)) to -= 1;
      if (to < from && below(to) && dice(`${tag}:down2`) < perTurn(DOWN, months)) to -= 1;
      move.to = to;
    }
    moves.push(move);
  }
  return moves;
}

/** The wars where a tactical strike stops the enemy's advance this turn: the side halted, and the province struck. */
function halts(moves: readonly LadderMove[], state: Pick<GameState, "wars">): Map<string, { sides: Set<string>; region: string }> {
  const out = new Map<string, { sides: Set<string>; region: string }>();
  for (const m of moves) {
    if (m.act?.kind !== "tactical" || !m.act.region) continue;
    const war = state.wars.find((w) => w.id === m.war);
    if (war) out.set(war.id, { sides: new Set(otherSide(war, m.tag)), region: m.act.region });
  }
  return out;
}

/** The fronts' stances with the turn's tactical strikes: the struck side's formations fall back where it fell and attack nowhere else in that war. */
export function haltStances(stances: Stances, moves: readonly LadderMove[], state: Pick<GameState, "wars">): Stances {
  const h = halts(moves, state);
  if (!h.size) return stances;
  const back = stanceOf({ posture: "withdraw", prep: 0 });
  const hold = { ...stanceOf({ posture: "hold", prep: 0 }), probes: false };
  return (war, side, id) => {
    const s = stances(war, side, id);
    const x = h.get(war.id);
    if (!x || !side.some((t) => x.sides.has(t))) return s;
    if (id === x.region) return back;
    return s.posture === "withdraw" ? s : hold;
  };
}

/** The turn's plan of the formations with the tactical strikes: the struck side's formations hold, the one struck falls back (its losses are read as such). Mutates `plan`. */
export function haltPlan(plan: TurnPlan | undefined, moves: readonly LadderMove[], state: Pick<GameState, "wars">): void {
  if (!plan) return;
  for (const [war, x] of halts(moves, state)) {
    for (const u of plan.units[war] ?? []) {
      if (!x.sides.has(u.tag)) continue;
      u.posture = u.sector.includes(x.region) ? "withdraw" : u.posture === "withdraw" ? "withdraw" : "hold";
      delete u.target;
    }
  }
}

/** The game master's land moves without the ground a struck side would take this turn in the war its advance stopped in. */
export function haltTransfers<T extends { region: string; to: string }>(state: Pick<GameState, "wars" | "regions">, transfers: T[], moves: readonly LadderMove[]): { kept: T[]; dropped: number } {
  const h = halts(moves, state);
  if (!h.size) return { kept: transfers, dropped: 0 };
  const kept = transfers.filter((t) => {
    for (const [id, x] of h) {
      if (!x.sides.has(t.to)) continue;
      const war = state.wars.find((w) => w.id === id)!;
      const r = state.regions[t.region];
      const theirs = war.attackers.includes(t.to) ? war.defenders : war.attackers;
      if (r && theirs.includes(r.controller)) return false;
    }
    return true;
  });
  return { kept, dropped: transfers.length - kept.length };
}

/**
 * The ladder as cast, carried out: each power's rung, the threats, alerts and demonstrations told, the strikes made by
 * engine/atom.ts's machinery – the toll, the world's outrage (less for a strike that answers one on itself), the answer
 * in kind the dice cast. A ladder whose war is over is stood down. Mutates `next`.
 */
export function applyLadder(state: GameState, next: GameState, moves: readonly LadderMove[], applied: AppliedChange[], ctx: { to: string; map: Record<string, MapRegion> | null }): void {
  if (!moves.length || !next.atom) return;
  const year = yearFraction(ctx.to);
  const ladders: Record<string, NuclearLadder> = { ...(next.atom.ladder ?? {}) };
  for (const m of moves) {
    const was = ladders[m.tag];
    if (m.to <= 0) {
      if (was) {
        delete ladders[m.tag];
        applied.push({ kind: "atom", country: m.tag, change: "ladder", step: 0, down: true, against: m.against, war: m.war });
      }
      continue;
    }
    const same = was?.war === m.war;
    const ladder: NuclearLadder = {
      step: m.to,
      war: m.war,
      against: m.against,
      since: was && m.to === m.from ? was.since : ctx.to,
      top: Math.max(same ? was.top : 0, m.to),
      ...(same && was.strikes ? { strikes: was.strikes } : {}),
    };
    ladders[m.tag] = ladder;
    if (m.to < m.from) applied.push({ kind: "atom", country: m.tag, change: "ladder", step: m.to, down: true, against: m.against, war: m.war });
    for (let k = m.from + 1; k <= Math.min(3, m.to); k++)
      applied.push({ kind: "atom", country: m.tag, change: "ladder", step: k, against: m.against, war: m.war, ...(k === 3 && (m.act?.kind === "test" || m.act?.kind === "sea") ? { demo: m.act.kind } : {}) });
    const act = m.act;
    if (!act || act.kind === "test" || act.kind === "sea" || !act.region) continue;
    const tactical = act.kind === "tactical";
    const civil = hit(next, m.tag, act.against, act.region, act.n, ctx.map, year, tactical);
    // The province's dead are the war's civilians too, under their own cause; the soldiers' are the front's (applyNuclearFront).
    bookStrike(next, m.tag, act.region, civil);
    const deaths = civil + Math.round(tactical ? (act.soldiers ?? 0) : 0);
    (next.atom.strikes ??= []).push({ by: m.tag, against: act.against, region: act.region, n: act.n, date: ctx.to, turn: state.turn, deaths, ...(tactical ? { tactical: true } : {}) });
    applied.push({ kind: "atom", country: m.tag, change: "strike", against: act.against, province: act.region, n: act.n, deaths, step: tactical ? 4 : 5, war: m.war, ...(tactical ? { tactical: true } : {}) });
    ladder.strikes = (ladder.strikes ?? 0) + 1;
    // The world turns on it: a tactical strike a little less, a strike that answers one on itself much less.
    outrage(next, m.tag, applied, ctx.to, ((m.parts.struck ?? 0) > 0 ? 0.5 : 1) * (tactical ? 0.8 : 1));
    const a = m.answer;
    // An answer is an act of war: an ally not at war with the striker enters the war at its partner's side, or does not answer.
    if (!a || !enterToAnswer(next, a.by, a.against, act.against, applied, m.war)) continue;
    const hurt = hit(next, a.by, a.against, a.region, a.n, ctx.map, year, a.tactical);
    bookStrike(next, a.by, a.region, hurt);
    const killed = hurt + Math.round(a.tactical ? (a.soldiers ?? 0) : 0);
    (next.atom.strikes ??= []).push({ by: a.by, against: a.against, region: a.region, n: a.n, date: ctx.to, turn: state.turn, deaths: killed, answer: true, ...(a.tactical ? { tactical: true } : {}) });
    applied.push({ kind: "atom", country: a.by, change: "strike", against: a.against, province: a.region, n: a.n, deaths: killed, answer: true, ...(a.tactical ? { tactical: true } : {}) });
  }
  if (Object.keys(ladders).length) next.atom.ladder = ladders;
  else delete next.atom.ladder;
}

/** The soldiers the turn's tactical strikes killed and wounded, into their wars' records and out of their armies; once the turn's own losses are kept. Mutates `next`. */
export function applyNuclearFront(next: GameState, moves: readonly LadderMove[]): void {
  const blows: { war: string; victim: string; killed: number }[] = [];
  for (const m of moves) {
    if (m.act?.kind === "tactical" && m.act.soldiers) blows.push({ war: m.war, victim: m.act.against, killed: m.act.soldiers });
    // An answer made: its government was at war with the striker, or entered the war to make it (engine/atom.ts enterToAnswer).
    if (m.answer?.tactical && m.answer.soldiers && warBetween(next, m.answer.by, m.answer.against)) blows.push({ war: m.war, victim: m.answer.against, killed: m.answer.soldiers });
  }
  for (const b of blows) {
    const war = next.wars.find((w) => w.id === b.war);
    const e = next.countries[b.victim]?.economy;
    if (!war || !e || !(war.attackers.includes(b.victim) || war.defenders.includes(b.victim))) continue;
    const wounded = round2(2 * b.killed);
    cutTroops(e, Math.max(0, Math.round(e.troops - b.killed - wounded / 2)));
    const losses = (war.losses ??= {});
    const had = losses[b.victim] ?? { killed: 0, wounded: 0 };
    const last = had.last && had.last.turn === next.turn ? had.last : { turn: next.turn, killed: 0, wounded: 0 };
    losses[b.victim] = {
      ...had,
      killed: round2(had.killed + b.killed),
      wounded: round2(had.wounded + wounded),
      last: { ...last, killed: round2(last.killed + b.killed), wounded: round2(last.wounded + wounded) },
    };
  }
}

// ---- what the player and the game master see

export type RedState = "far" | "near" | "crossed";

/** One atomic power in one of the player's wars, as the army tab shows it. */
export interface LadderView {
  tag: string;
  war: string;
  doctrine: DoctrineId;
  /** The rung it stands on (0: none) and the highest it reached in this war. */
  step: number;
  top: number;
  noFirstUse: boolean;
  /** Its red lines, the doctrine's readings that count most first: how near each is to being crossed. */
  red: { line: RedLine; state: RedState }[];
}

/** The rungs climbed so far, by name. */
export const rungs = (step: number): LadderStep[] => LADDER_STEPS.slice(0, clamp(step, 0, LADDER_STEPS.length));

/** The atomic powers in a war, other than a government the player runs: their doctrine, rung and red lines. */
export function ladderView(state: GameState, war: War, index?: Index | null): LadderView[] {
  const out: LadderView[] = [];
  const map = index?.regions;
  let reading: Reading | undefined;
  for (const tag of [...war.attackers, ...war.defenders]) {
    if (playerDecides(state, tag) || !hasBomb(state, tag) || state.countries[tag]?.dormant) continue;
    reading ??= readState(state, map);
    const r = readWars(state, tag, map, reading).find((x) => x.war.id === war.id);
    if (!r) continue;
    const ladder = state.atom?.ladder?.[tag];
    const here = ladder?.war === war.id;
    const weights = { ...r.doctrine.weights, ...(r.doctrine.umbrella ? { allies: r.doctrine.umbrella } : {}) };
    const lines = (Object.entries(weights) as [RedLine, number][]).filter(([k, w]) => w >= 0.3 && (k !== "soil" || w >= 0.5)).sort((a, b) => b[1] - a[1] || RED_LINES.indexOf(a[0]) - RED_LINES.indexOf(b[0]));
    const red = lines
      .filter(([k]) => !r.doctrine.noFirstUse || k === "struck")
      .map(([k, w]) => {
        const v = w * (r.danger.parts[k] ?? 0);
        return { line: k, state: (v >= r.lines[3] ? "crossed" : v >= r.lines[0] ? "near" : "far") as RedState };
      });
    out.push({ tag, war: war.id, doctrine: r.doctrine.id, step: ladder?.step ?? 0, top: here ? ladder!.top : 0, noFirstUse: Boolean(r.doctrine.noFirstUse), red });
  }
  return out;
}

const PART_WORDS: Record<RedLine, string> = {
  capital: "the capital",
  heart: "the heartland",
  land: "its land",
  army: "the army breaking",
  regime: "the regime falling",
  economy: "the economy strangled",
  soil: "the enemy on its soil",
  struck: "a nuclear strike on it",
  allies: "its allies under its umbrella",
};
const pct = (v: number) => `${Math.round(v * 100)}%`;

/**
 * The ladders for the game master: every atomic power at war the engine governs, its doctrine, its rung and the
 * danger it sees, and what the dice decided for this period – a rung climbed or climbed down, a demonstration, a
 * strike and the answer it draws. The game master tells it and adds no nuclear step of its own.
 */
export function describeNuclear(state: GameState, index?: Index | null): string[] {
  const moves = castLadder(state, index);
  if (!moves.length) return [];
  const lines = [
    "",
    "NUCLEAR DOCTRINES AT WAR (the engine climbs each atomic power's escalation ladder – 1 open threats, 2 a raised alert, 3 a demonstration (a test or a warning shot at sea), 4 a tactical strike at the front, 5 a strike on cities – by how near defeat it sees itself, its doctrine, its leader, the enemy's means to answer and the era's taboo, and climbs it down as the danger recedes. Tell what the engine decided below, in proportion to what it is; never add a nuclear threat, alert, test or strike of your own, and never leave out one decided here):",
  ];
  const step = (k: number) => (k > 0 ? `${k} ${LADDER_STEPS[k - 1]}` : "none");
  for (const m of moves) {
    const d = DOCTRINES[m.doctrine];
    const read = (Object.entries(m.parts) as [RedLine, number][])
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([k, v]) => `${PART_WORDS[k]} ${k === "struck" ? "yes" : pct(v)}`)
      .join(", ");
    lines.push(`- ${m.tag} against ${m.against} (doctrine: ${d.says}${d.noFirstUse && m.cap <= 2 ? "; it goes no further than the alert unless struck" : ""}): on rung ${step(m.from)}; how near defeat it sees itself ${pct(m.danger)}${read ? ` (${read})` : ""}.`);
    const act = m.act;
    if (m.to === 0 && m.from > 0) lines.push(`  THIS PERIOD: its war is over – it stands its nuclear forces down; tell it.`);
    else if (m.to < m.from) lines.push(`  THIS PERIOD: the danger has receded – it climbs down to ${step(m.to)}; tell it as a quiet signal.`);
    else if (m.to > m.from && m.to <= 3)
      lines.push(
        `  THIS PERIOD: it climbs to ${step(m.to)}${act?.kind === "test" ? ": a nuclear test as a warning to " + m.against : act?.kind === "sea" ? ": a nuclear warhead detonated at sea as a warning to " + m.against : m.to === 2 ? ": its nuclear forces put on a higher alert, publicly" : ": its leaders threaten the enemy with nuclear weapons in public"}. Tell it: the words, the world's alarm.`,
      );
    if (act && (act.kind === "tactical" || act.kind === "cities")) {
      const what =
        act.kind === "tactical"
          ? `a tactical nuclear strike on ${act.against}'s forces at ${act.region} (${act.n} warhead${act.n > 1 ? "s" : ""}; about ${Math.round(act.soldiers ?? 0)} thousand soldiers killed and twice as many wounded): the engine applies the toll, and ${act.against}'s advance in this war stops this period – its formation there falls back`
          : `a nuclear strike on ${act.against}'s cities at ${act.region} (${act.n} warhead${act.n > 1 ? "s" : ""}): the engine applies the toll`;
      const answer = m.answer ? `${m.answer.by} answers in kind with ${m.answer.n} ${m.answer.tactical ? "tactical " : ""}warhead${m.answer.n > 1 ? "s" : ""} on ${m.answer.region}` : playerDecides(state, act.against) ? "the player's government decides its own answer by its orders" : "no answer in kind";
      lines.push(`  THIS PERIOD: ${act.again ? "again, " : ""}${what}. The world's outrage and sanctions follow; the dice cast the answer: ${answer}. Tell it soberly.`);
    }
  }
  return lines;
}

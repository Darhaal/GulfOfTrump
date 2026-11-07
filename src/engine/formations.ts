import { yearOf } from "./calendar";
import { FIGURES } from "./figures.data";
import { aliveIn, knownById } from "./people";
import { fixed, roll } from "./dice";
import { assaultBias, attacking, attackThreshold, MAX_DUG, POSTURE_RANK, PREP_EDGE } from "./doctrine";
import { STEP_YEARS } from "./economy";
import { ownFormation } from "./figures";
import { frontStrength, MASSED, paceScale, stancesFrom, warFront, type FrontStrength, type Stances } from "./fronts";
import { officialAt } from "./government";
import { loyaltyOf } from "./politics";
import { castJoint, jointPlan } from "./joint";
import { staffLine } from "./ministers";
import { distanceKm } from "./provinces";
import { accessTo } from "./remit";
import type { ArmyOrder, ArmyOrderKind, ArmyUnit, Commander, Formation, GameState, MapIndex, OrderFate, Posture, SectorTurn, UnitForces, UnitTask, War, WeaponKind } from "./types";
import type { Exchange } from "./warLosses";

/**
 * Formations that fight on their own. Each side of a war fights it with
 * formations – armies, corps and fronts – each holding a sector of the
 * front with its strength, supply, commander and task. The player's are
 * those the game master described (the Army tab's organisation) where they
 * stand near the front; the rest the engine makes from the front itself, an
 * army to about every KM_PER_UNIT kilometres of it, at most MAX_UNITS a
 * country in a war. They keep their numbers, commanders and guns from turn
 * to turn while their sectors follow the front.
 *
 * Every turn the general staff sets each formation's task – to attack where
 * the odds are no worse than the era's staffs would attack at, pressing, or
 * only where they are overwhelming, holding (the player's staff by its line,
 * engine/ministers.ts staffLine; abroad, the side that began the war presses)
 * – and each commander picks how he fights it (choosePosture): hold, probe,
 * offensive or all-out assault, by the odds on his sector, his supply, the
 * era's doctrine and his character, with his own dice. A reckless one
 * assaults; a careful one waits for the guns (`prep`), which make his attack
 * cheaper when it comes.
 *
 * The player's orders to a formation come first – a task, an offensive, an
 * all-out assault, a withdrawal, a new commander – but the general staff
 * decides how (fateOf): by its chief's competence and loyalty, the
 * commander's character, the supply and the odds, an order is carried out as
 * given, late, half-heartedly or badly, and the report says which. With no
 * order the staff and the commanders carry on: the war never waits.
 *
 * The plan is cast before the turn is written (planTurn) – pure and seeded,
 * so the game master is told it and the server and the browser agree – and
 * goes with the world's answer to the fronts (engine/fronts.ts) and the
 * losses (engine/warLosses.ts). Once the turn has landed, the formations keep
 * their new sectors and guns, the lines that stood dig in (`dug`, months),
 * and the player's formations' turns go into the chronicle (settleUnits).
 */

/** Kilometres of front an engine-made army holds, and the most formations a country fights one war with (more only for more theatres). */
const KM_PER_UNIT = 100;
const MAX_UNITS = 8;
/** How far from the front a formation the game master described may stand and still take a sector of it, km. */
const GM_REACH_KM = 600;
/** An attack that gains less than this, km, leaves its formation to regroup for REGROUP months (a reckless commander's half that) before it attacks again – a turn of a month or more regroups within itself; one that gains ground keeps its momentum. */
const FAILED_KM = 1;
const REGROUP = 0.5;
/** Kilometres of ground lost or won that start a line over: trenches are dug again. */
const NEW_LINE_KM = 4;

/** A formation as this turn's plan has it: where it fights, how, with what, and what became of the player's order to it. */
export interface PlannedUnit extends ArmyUnit {
  posture: Posture;
  /** Its best chance to gain ground, in doublings past what an attack needs there; and the province it would attack. */
  odds: number;
  target?: string;
  /** Its supply, 0–1, and soldiers, thousands. */
  supply: number;
  men: number;
  /** Its tanks, guns and aircraft. */
  forces?: UnitForces;
  order?: { kind: ArmyOrderKind; fate: OrderFate; text?: string };
  /** Its order came late, or it botched what it was told: a weaker attack, and a dearer one. */
  late?: boolean;
  botched?: boolean;
  /** A new commander who takes over once the turn is over (an order carried out late). */
  successor?: Commander;
  /** Doublings a joint offensive or operation with allies adds to its attacks this turn, and the joint action's id (engine/joint.ts). */
  joint?: number;
  jointId?: string;
}

/** The turn's formations, by war. */
export interface TurnPlan {
  units: Record<string, PlannedUnit[]>;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round1 = (v: number) => Math.round(v * 10) / 10;
const round2 = (v: number) => Math.round(v * 100) / 100;
const gameOf = (state: Pick<GameState, "seed" | "id">) => state.seed ?? state.id;

type Index = Pick<MapIndex, "neighbors" | "regions"> & Partial<Pick<MapIndex, "coasts">>;

// ——— Commanders ———

const RECKLESS = /reckless|impulsive|hot-?headed|\brash\b|безрассуд|авантюр|импульсив|імпульсив|опрометчив|необачн/i;
const BOLD = /bold|decisive|aggressive|daring|energetic|ruthless|решител|рішуч|смел|смілив|агрессив|агресив|дерзк|зухвал|энергичн|енергійн|жёстк|жестк|жорстк/i;
const CAREFUL = /careful|cautious|methodical|prudent|deliberate|осторож|обережн|методичн|осмотрит|розважлив|расчётлив|расчетлив/i;
const TIMID = /timid|indecisive|hesitant|passive|робк|нерешител|нерішуч|пассивн|пасивн/i;

/** A commander's temper from the words that describe him (−2 timid … 2 reckless); none when they say nothing of it. */
export function temperOf(text: string | undefined): number | undefined {
  if (!text) return undefined;
  if (RECKLESS.test(text)) return 2;
  if (TIMID.test(text)) return -2;
  if (BOLD.test(text)) return 1;
  if (CAREFUL.test(text)) return -1;
  return undefined;
}

/** Tempers and skills as an army's generals come: most steady and middling, a few reckless or timid, brilliant or poor. */
const TEMPERS: [number, number][] = [
  [0.1, -2],
  [0.35, -1],
  [0.65, 0],
  [0.9, 1],
  [1, 2],
];
const SKILLS: [number, number][] = [
  [0.1, 1],
  [0.3, 2],
  [0.7, 3],
  [0.9, 4],
  [1, 5],
];
const pickOf = (table: [number, number][], r: number) => table.find(([p]) => r < p)?.[1] ?? table[table.length - 1][1];

/** A commander the engine appoints: his character and skill by the game's dice, fixed by the formation and the turn he came. */
export function seedCommander(game: string, war: string, unit: string, turn: number): Commander {
  const r = (k: string) => roll(game, turn, `commander:${war}:${unit}:${k}`);
  return { temper: pickOf(TEMPERS, r("temper")), skill: pickOf(SKILLS, r("skill")) };
}

/**
 * How loyal a commander is to the government, 0–100: the army's loyalty (engine/politics.ts) and his own leaning
 * either side of it, up to fifteen points – the same in every game for the same name; an unnamed one stands where the
 * army does. A disloyal one carries the government's orders out half-heartedly more often (fateOf).
 */
export function commanderLoyalty(state: Partial<Pick<GameState, "politics">>, name?: string): number {
  const army = state.politics ? loyaltyOf(state.politics).army : 60;
  const lean = name ? Math.round((fixed(`loyalty:${name}`) - 0.5) * 30) : 0;
  return Math.max(0, Math.min(100, Math.round(army + lean)));
}

/** The longest order to a formation in the player's own words. */
export const ARMY_ORDER_CHARS = 400;

/** The words that tell each kind of order, in the three languages, tried in this order: a new commander first, an assault before an offensive before an attack. */
const ORDER_WORDS: [ArmyOrderKind, RegExp][] = [
  ["commander", /(смен|замен|назнач|сня|сместит|змін|замін|признач|зня|replace|relieve|dismiss|appoint|new commander|sack).{0,40}(командующ|командир|командувач|генерал|commander|general)|(командующ|командир|командувач|commander).{0,20}(сменить|заменить|снять|змінити|замінити|зняти|replace|relieve)/i],
  ["withdraw", /отступ|отвест|отвод|отход|оставит|відступ|відвест|відвод|відход|withdraw|retreat|fall back|pull back|evacuat/i],
  ["assault", /штурм|любой ценой|всеми силами|будь-якою ціною|всіма силами|всеми резервами|all-out|assault|at any cost|everything in|storm/i],
  ["offensive", /наступл|наступ|контрнаступ|прорыв|прорвать|прорив|прорвати|offensive|counter-?attack|break through|breakthrough|push/i],
  ["attack", /атак|ударит|удар |занят|захват|взять|освобод|зайнят|захопи|взяти|звільн|attack|strike|take |capture|seize|liberate|advance/i],
  ["hold", /оборон|удерж|держат|окопа|стоять|тримат|утримув|окопат|hold|defen[cd]|dig in|stand fast|entrench/i],
];

/**
 * An order to a formation in the player's own words, read by the engine: the kind of order its words tell, which the
 * staff carries out (obey), and the words themselves for the game master to tell the fighting by. None when the words
 * tell no kind of order – then they are an order of the turn like any other, the game master's to judge.
 */
export function readArmyOrder(war: string, unit: string, words: string): ArmyOrder | null {
  const text = words.replace(/\s+/g, " ").trim().slice(0, ARMY_ORDER_CHARS);
  if (!text) return null;
  const kind = ORDER_WORDS.find(([, re]) => re.test(` ${text} `))?.[0];
  return kind ? { war, unit, kind, text } : null;
}

/** The names already commanding a country's formations, in every war. */
const commandersOf = (state: Pick<GameState, "wars">, tag: string) => new Set(state.wars.flatMap((w) => (w.units ?? []).filter((u) => u.tag === tag).map((u) => u.commander.name).filter((n): n is string => Boolean(n))));

/**
 * A general of the date for a formation the engine makes: the military people of the country on its start date
 * (engine/figures.data.ts), alive in the year and not yet commanding one of its formations, in their order – so the
 * fronts have the date's real commanders with no game master to name them. None once they are all in command.
 */
export function generalFor(state: Pick<GameState, "scenarioId" | "date" | "wars">, tag: string, taken: Set<string> = commandersOf(state, tag)): string | undefined {
  const year = yearOf(state.date);
  for (const id of FIGURES[state.scenarioId]?.[tag]?.military ?? []) {
    const p = knownById(id);
    if (!p || !aliveIn(p, year) || (p.born && year - p.born < 30)) continue;
    if (!taken.has(p.name.en)) return p.name.en;
  }
  return undefined;
}

/** A commander the game master named: his character from its words, else the same in every game for the same name. */
function namedCommander(name: string, character?: string, was?: Commander): Commander {
  if (was && was.name === name) return { ...was, temper: temperOf(character) ?? was.temper };
  return { name, temper: temperOf(character) ?? pickOf(TEMPERS, fixed(`temper:${name}`)), skill: pickOf(SKILLS, fixed(`skill:${name}`)) };
}

// ——— Sectors ———

const centreOf = (ids: readonly string[], index: Index): [number, number] | undefined => {
  let x = 0;
  let y = 0;
  let n = 0;
  for (const id of ids) {
    const at = index.regions[id]?.at;
    if (!at) continue;
    x += at[0];
    y += at[1];
    n += 1;
  }
  return n ? [x / n, y / n] : undefined;
};

/** A front province's breadth, km: what an army's frontage is counted in. */
const breadth = (id: string, index: Index) => Math.sqrt(Math.max(100, index.regions[id]?.area ?? 10_000));

/** Provinces in their order along the front: by the long axis of their centres. */
function alongFront(ids: string[], index: Index): string[] {
  const pts = ids.map((id) => ({ id, at: index.regions[id]?.at }));
  const known = pts.filter((p) => p.at);
  if (known.length < 2) return [...ids].sort();
  const lat0 = known.reduce((s, p) => s + p.at![1], 0) / known.length;
  const k = Math.cos((lat0 * Math.PI) / 180);
  const xy = known.map((p) => [p.at![0] * k, p.at![1]]);
  const mx = xy.reduce((s, p) => s + p[0], 0) / xy.length;
  const my = xy.reduce((s, p) => s + p[1], 0) / xy.length;
  let cxx = 0;
  let cyy = 0;
  let cxy = 0;
  for (const [x, y] of xy) {
    cxx += (x - mx) ** 2;
    cyy += (y - my) ** 2;
    cxy += (x - mx) * (y - my);
  }
  const theta = 0.5 * Math.atan2(2 * cxy, cxx - cyy);
  const proj = new Map(pts.map((p) => [p.id, p.at ? (p.at[0] * k - mx) * Math.cos(theta) + (p.at[1] - my) * Math.sin(theta) : 0]));
  return [...ids].sort((a, b) => proj.get(a)! - proj.get(b)! || a.localeCompare(b));
}

/** A member's front in a war cut into sectors: each theatre its share of the formations, each cut along the front into equal frontages. */
function partition(ids: string[], theatreOf: (id: string) => number, index: Index): string[][] {
  const groups = new Map<number, string[]>();
  for (const id of ids) {
    const t = theatreOf(id);
    groups.set(t, [...(groups.get(t) ?? []), id]);
  }
  const theatres = [...groups.values()].map((g) => ({ ids: g, km: g.reduce((s, id) => s + breadth(id, index), 0) })).sort((a, b) => b.km - a.km || a.ids[0].localeCompare(b.ids[0]));
  const total = theatres.reduce((s, t) => s + t.km, 0);
  const n = clamp(Math.round(total / KM_PER_UNIT), theatres.length, Math.max(MAX_UNITS, theatres.length));
  // Each theatre at least one, the rest by frontage (largest remainder).
  const share = theatres.map((t) => ({ t, k: 1, rest: ((n - theatres.length) * t.km) / Math.max(1, total) }));
  for (const s of share) s.k += Math.floor(s.rest);
  let left = n - share.reduce((x, s) => x + s.k, 0);
  for (const s of [...share].sort((a, b) => (b.rest % 1) - (a.rest % 1))) {
    if (left <= 0) break;
    s.k += 1;
    left -= 1;
  }
  const out: string[][] = [];
  for (const { t, k } of share) {
    const ordered = alongFront(t.ids, index);
    const pieces = Math.min(k, ordered.length);
    const step = t.km / pieces;
    let acc = 0;
    let cut = 1;
    let piece: string[] = [];
    for (const id of ordered) {
      const w = breadth(id, index);
      // A cut where the frontage passes the next equal share.
      if (piece.length && cut < pieces && acc + w / 2 > step * cut) {
        out.push(piece);
        piece = [];
        cut += 1;
      }
      piece.push(id);
      acc += w;
    }
    if (piece.length) out.push(piece);
  }
  return out;
}

/** The formations the game master described for the player that stand near this front: armies and corps, else fronts. */
function describedNear(state: GameState, tag: string, ids: string[], index: Index): Formation[] {
  if (tag !== state.player) return [];
  const all = state.countries[tag]?.arsenal?.organisation?.formations ?? [];
  const land = all.filter((f) => (f.kind === "army" || f.kind === "corps") && f.provinces.length);
  const pool = land.length ? land : all.filter((f) => f.kind === "front" && f.provinces.length);
  const front = ids.map((id) => index.regions[id]?.at).filter((p): p is [number, number] => Boolean(p));
  return pool.filter((f) => {
    const c = centreOf(f.provinces, index);
    return c && front.some((p) => distanceKm(c, p) <= GM_REACH_KM);
  });
}

/** A member's formations in a war this turn: its old ones on their new sectors (matched by name, or by where they stood), new ones where the front grew. */
function seats(state: GameState, index: Index, strength: FrontStrength, war: War, tag: string, ids: string[]): ArmyUnit[] {
  const game = gameOf(state);
  const old = (war.units ?? []).filter((u) => u.tag === tag);
  let next = old.reduce((m, u) => Math.max(m, u.n), 0) + 1;
  const taken = commandersOf(state, tag);
  const fresh = (sector: string[], name?: string, commander?: Commander): ArmyUnit => {
    const n = next++;
    const id = `${tag}-${n}`;
    // With no commander of the game master's, the date's general takes it, his character the same in every game.
    const general = commander ? undefined : generalFor(state, tag, taken);
    if (general) taken.add(general);
    return { id, tag, n, ...(name ? { name } : {}), kind: "army", commander: commander ?? (general ? namedCommander(general) : seedCommander(game, war.id, id, state.turn)), sector, task: "hold", prep: 0 };
  };
  const described = describedNear(state, tag, ids, index);
  if (described.length) {
    // Each front province to the nearest formation the game master described.
    const centres = described.map((f) => centreOf(f.provinces, index)!);
    const groups = described.map(() => [] as string[]);
    for (const id of ids) {
      const at = index.regions[id]?.at;
      let best = 0;
      if (at) {
        let d = Infinity;
        centres.forEach((c, i) => {
          const x = distanceKm(c, at);
          if (x < d) {
            d = x;
            best = i;
          }
        });
      }
      groups[best].push(id);
    }
    const out: ArmyUnit[] = [];
    // The organisation's commanders count when it was described since the last turn; else a formation keeps its own (a new one the player appointed).
    const told = state.countries[tag]?.arsenal?.organisation?.turn === state.turn;
    described.forEach((f, i) => {
      if (!groups[i].length) return;
      const was = old.find((u) => u.name?.toLowerCase() === f.name.toLowerCase());
      const commander = f.commander && (told || !was) ? namedCommander(f.commander, f.character, was?.commander) : was?.commander;
      const kind = f.kind === "corps" || f.kind === "front" ? f.kind : "army";
      out.push(was ? { ...was, name: f.name, kind, commander: commander ?? was.commander, sector: groups[i] } : { ...fresh(groups[i], f.name, commander), kind });
    });
    return out;
  }
  const chunks = partition(ids, (id) => strength.theatreOf(war, id) ?? 0, index);
  // Old formations go to the nearest new sectors, the nearest pairs first.
  const pairs: { c: number; o: number; d: number }[] = [];
  const oldCentres = old.map((u) => centreOf(u.sector, index));
  chunks.forEach((chunk, c) => {
    const at = centreOf(chunk, index);
    old.forEach((_, o) => pairs.push({ c, o, d: at && oldCentres[o] ? distanceKm(at, oldCentres[o]!) : 1e9 + o }));
  });
  pairs.sort((a, b) => a.d - b.d || a.c - b.c || a.o - b.o);
  const seated = new Map<number, ArmyUnit>();
  const used = new Set<number>();
  for (const p of pairs) {
    if (seated.has(p.c) || used.has(p.o)) continue;
    seated.set(p.c, { ...old[p.o], sector: chunks[p.c] });
    used.add(p.o);
  }
  return chunks.map((chunk, c) => seated.get(c) ?? fresh(chunk));
}

// ——— Tasks, postures and orders ———

/** A side's line abroad: the side that began the war presses, the other holds; a side whose will is breaking holds. */
function lineAbroad(war: War, tag: string, strength: FrontStrength): "press" | "hold" {
  if (strength.means.will(tag) < 35) return "hold";
  return war.attackers.includes(tag) ? "press" : "hold";
}

/** The surplus past what an attack needs at which it breaks in (engine/fronts.ts). */
const ATTACK_SURPLUS = 0.15;
/** Odds at which every commander attacks, a careful one or one regrouping too: a breakthrough's (engine/fronts.ts BREAK, and some). */
const PLAIN_ODDS = 0.6;

/**
 * How a commander fights his task this turn: holding, a reckless one still probes; attacking, a careful one waits for
 * the guns until they are gathered or the odds are plain, and the rest go in by the odds and their drive – the era's
 * doctrine, their temper, the staff's line, their supply and their dice.
 */
export function choosePosture(task: UnitTask, odds: number, prep: number, supply: number, temper: number, line: "press" | "hold", year: number, r: number): Posture {
  if (task === "hold") return temper >= 2 && odds > 0.2 ? "probe" : "hold";
  const drive = 0.4 * temper + assaultBias(year) + (r - 0.5) * 0.8 + (line === "press" ? 0.2 : 0) - (supply < 0.6 ? 0.5 : 0);
  const s = odds + PREP_EDGE * prep;
  // A careful commander waits while the guns still to come would make the difference.
  if (temper <= -1 && s < ATTACK_SURPLUS && s + PREP_EDGE * (1 - prep) >= ATTACK_SURPLUS && prep < 0.9 && supply >= 0.5) return "hold";
  if (s >= PLAIN_ODDS) return drive > 0.9 ? "assault" : "offensive";
  if (s > 0) return drive > 0.6 ? "assault" : drive > -0.4 ? "offensive" : "probe";
  if (s > -0.5) return drive > 0.6 ? "assault" : drive > 0 || temper >= 0 ? "probe" : "hold";
  return drive > 1 ? "assault" : "hold";
}

const ATTACK_ORDERS: ReadonlySet<ArmyOrderKind> = new Set(["attack", "offensive", "assault"]);
const HOLD_ORDERS: ReadonlySet<ArmyOrderKind> = new Set(["hold", "withdraw"]);

/**
 * What the general staff makes of an order: carried out as given by a chance that grows with its chief's competence and
 * loyalty and falls when a careful commander is told to attack or a reckless one to hold, when supply is short and when
 * the odds are bad; otherwise late (short supply, a poor staff), half-heartedly (a careful commander, a disloyal staff,
 * hopeless odds) or badly (a reckless commander held back, a poor staff). A general carries out his own command's himself.
 */
export function fateOf(state: GameState, u: Pick<ArmyUnit, "commander"> & Partial<Pick<ArmyUnit, "name">>, kind: ArmyOrderKind, odds: number, supply: number, r: (key: string) => number): OrderFate {
  if (ownCommand(state, { name: u.name, commander: u.commander })) return "done";
  const staff = officialAt(state, "military");
  const c = clamp(Math.round(staff?.competence ?? 3), 1, 5);
  const l = clamp(Math.round(staff?.loyalty ?? 4), 1, 5);
  const t = u.commander.temper;
  const attack = ATTACK_ORDERS.has(kind);
  const hold = HOLD_ORDERS.has(kind);
  let p = 0.4 + 0.1 * c + 0.05 * (l - 3);
  if (attack && t < 0) p -= 0.12 * -t;
  if (hold && t > 0) p -= 0.1 * t;
  if (supply < 0.6) p -= 0.15;
  if (attack && odds < -0.3) p -= 0.1;
  if (r("done") < clamp(p, 0.15, 0.95)) return "done";
  const late = 0.4 + (supply < 0.6 ? 1.5 : 0) + (c <= 2 ? 0.8 : 0);
  const half = 0.3 + (attack && t < 0 ? 1.5 : 0) + (l <= 2 ? 1.2 : 0) + (attack && odds < -0.3 ? 0.8 : 0) + (commanderLoyalty(state, u.commander.name) < 40 ? 0.8 : 0);
  const badly = 0.3 + (hold && t > 0 ? 1.5 : 0) + (c <= 2 ? 1.2 : 0);
  const x = r("how") * (late + half + badly);
  return x < late ? "late" : x < late + half ? "half" : "badly";
}

/** One step down from a posture: an assault becomes an offensive, an offensive a probe. */
const weaker = (p: Posture): Posture => (p === "assault" ? "offensive" : p === "offensive" ? "probe" : p === "probe" ? "hold" : p);

/** Whether the player may order a formation: his country's, while his role commands the army (engine/remit.ts: the leader, a general, the minister of war). */
export function mayOrder(state: GameState, u: Pick<ArmyUnit, "tag">): boolean {
  return u.tag === state.player && accessTo(state, "army") === "govern";
}

/** Whether a formation is the player's own command, as a general: his orders to it are his own to carry out. */
const ownCommand = (state: GameState, u: Pick<ArmyUnit, "name" | "commander">) => {
  if (state.role?.kind !== "general") return false;
  const own = ownFormation(state);
  const me = state.role.person?.name;
  return Boolean((own && u.name && own.name.trim().toLowerCase() === u.name.trim().toLowerCase()) || (me && u.commander.name && me.trim().toLowerCase() === u.commander.name.trim().toLowerCase()));
};

/**
 * The turn's formations and how they fight: each side's members' formations on their sectors, each with its supply,
 * soldiers, best odds and target, the staff's task, the commander's posture, and the player's order as the staff
 * carried it out. Pure and seeded; `strength`, when given, is the reading of the fronts the turn's moves are made with.
 */
export function planTurn(state: GameState, index: Index, orders: readonly string[] = [], given?: FrontStrength): TurnPlan {
  const out: TurnPlan = { units: {} };
  const wars = state.wars.filter((w) => !w.truce);
  if (!wars.length) return out;
  const strength = given ?? frontStrength(state, index);
  const year = yearOf(state.date);
  const months = (STEP_YEARS[state.step] ?? 1 / 12) * 12;
  const game = gameOf(state);
  const staff = staffLine(state, orders);
  // The joint offensives and operations of the period, agreed with allies or begun abroad (engine/joint.ts).
  const joint = castJoint(state, index);
  for (const war of wars) {
    const front = strength.fronts.get(war.id) ?? [];
    if (!front.length) continue;
    const onFront = new Set(front);
    const planned: PlannedUnit[] = [];
    for (const [side, enemy] of [
      [war.attackers, war.defenders],
      [war.defenders, war.attackers],
    ]) {
      for (const tag of side) {
        const ids = front.filter((id) => state.regions[id].controller === tag || state.regions[id].contested === tag);
        if (!ids.length) continue;
        const power = strength.powerOf(tag);
        const per = power > 0 ? (state.countries[tag]?.economy?.troops ?? 0) / power : 0;
        const line = tag === state.player ? (staff ?? lineAbroad(war, tag, strength)) : lineAbroad(war, tag, strength);
        for (const seat of seats(state, index, strength, war, tag, ids)) {
          // Its soldiers and supply along its sector.
          let men = 0;
          let supply = 0;
          for (const id of seat.sector) {
            men += (strength.members(war, side, enemy, id).find((m) => m.tag === tag)?.strength ?? 0) * per;
            supply += strength.supply(side, id) * strength.means.partisans(side, id);
          }
          supply = seat.sector.length ? supply / seat.sector.length : 1;
          // Its best chance to gain ground: pressing its own lodgement, or breaking into the enemy's province next to its line.
          let odds = -Infinity;
          let target: string | undefined;
          const consider = (id: string, s: number) => {
            if (s > odds || (s === odds && target !== undefined && id < target)) {
              odds = s;
              target = id;
            }
          };
          for (const id of seat.sector) {
            const r = state.regions[id];
            if (r.contested === tag) consider(id, strength.advance(war, side, enemy, id, false).surplus);
            else if (r.controller === tag && !r.contested)
              for (const n of index.neighbors[id] ?? []) {
                const x = state.regions[n];
                if (x && onFront.has(n) && !x.contested && enemy.includes(x.controller)) consider(n, strength.advance(war, side, enemy, n, false).surplus);
              }
          }
          if (odds === -Infinity) odds = -1;
          const r = (key: string) => roll(game, state.turn, `unit:${war.id}:${seat.id}:${key}`);
          const task: UnitTask = seat.ordered ? seat.task : odds >= attackThreshold(year, line === "press") ? "attack" : "hold";
          let unit: PlannedUnit = { ...seat, task, posture: "hold", odds: round2(odds), ...(target ? { target } : {}), supply: round2(supply), men: Math.round(men) };
          unit.posture = choosePosture(task, odds, seat.prep, supply, seat.commander.temper, line, year, r("posture"));
          // A formation regrouping after an attack that gained nothing holds, gathering its guns again, unless the odds are plain now.
          if ((seat.rest ?? 0) > months / 2 && attacking(unit.posture) && odds + PREP_EDGE * seat.prep < PLAIN_ODDS) unit.posture = "hold";
          const order = tag === state.player ? (state.armyOrders ?? []).filter((o) => o.war === war.id && o.unit === seat.id).at(-1) : undefined;
          if (order && mayOrder(state, seat)) unit = obey(state, unit, order, line, year, r);
          planned.push(unit);
        }
      }
    }
    // Allies' formations where their lines meet attack together, each the stronger for it (engine/joint.ts).
    jointPlan(state, war, planned, index, joint);
    shareForces(state, planned);
    out.units[war.id] = planned;
  }
  return out;
}

/** The heavy weapons a staff shares out: tanks and guns go where its formations attack, the aircraft over them too. */
const SHARED: Extract<WeaponKind, "tanks" | "artillery" | "aircraft">[] = ["tanks", "artillery", "aircraft"];

/**
 * Each member's tanks, guns and aircraft in a war, shared among its formations there by their soldiers, massed where
 * they attack (engine/fronts.ts MASSED): what each fights with, for the army tab and the game master – and for the fronts,
 * which weigh them where they are (FrontStrength.mass). The part of its army in the war is its soldiers there against
 * its troops. Mutates `planned`.
 */
function shareForces(state: GameState, planned: PlannedUnit[]): void {
  for (const tag of new Set(planned.map((u) => u.tag))) {
    const mine = planned.filter((u) => u.tag === tag);
    const troops = state.countries[tag]?.economy?.troops ?? 0;
    const men = mine.reduce((s, u) => s + u.men, 0);
    const weight = mine.reduce((s, u) => s + u.men * MASSED[u.posture], 0);
    if (troops <= 0 || men <= 0 || weight <= 0) continue;
    const part = Math.min(1, men / troops);
    const stock = state.countries[tag]?.arsenal?.stock ?? {};
    for (const u of mine) {
      const forces: UnitForces = {};
      for (const kind of SHARED) {
        const n = Math.round(((stock[kind]?.n ?? 0) * part * u.men * MASSED[u.posture]) / weight);
        if (n > 0) forces[kind] = n;
      }
      if (Object.keys(forces).length) u.forces = forces;
    }
  }
}

/** A formation under the player's order, as the general staff carries it out. */
function obey(state: GameState, u: PlannedUnit, order: ArmyOrder, line: "press" | "hold", year: number, r: (key: string) => number): PlannedUnit {
  const fate = fateOf(state, u, order.kind, u.odds, u.supply, (k) => r(`order:${k}`));
  const out: PlannedUnit = { ...u, order: { kind: order.kind, fate, ...(order.text ? { text: order.text } : {}) } };
  const chosen = (task: UnitTask, temper = u.commander.temper) => choosePosture(task, u.odds, u.prep, u.supply, temper, line, year, r("posture"));
  const as = (posture: Posture) => {
    if (fate === "late") return { posture, late: true };
    if (fate === "half") return { posture: weaker(posture) };
    if (fate === "badly") return { posture, botched: true };
    return { posture };
  };
  switch (order.kind) {
    case "hold":
      Object.assign(out, { task: "hold", ordered: true });
      // Held back half-heartedly, the local attacks go on; badly, a reckless commander attacks anyway.
      if (fate === "done") out.posture = "hold";
      else if (fate === "late") Object.assign(out, { posture: chosen(u.task), late: true });
      else if (fate === "half") out.posture = "probe";
      else Object.assign(out, { posture: chosen("attack"), botched: true });
      break;
    case "attack":
      Object.assign(out, { task: "attack", ordered: true }, as(chosen("attack")));
      break;
    case "offensive":
      Object.assign(out, { task: "attack", ordered: true }, fate === "half" ? { posture: "probe" } : as("offensive"));
      break;
    case "assault":
      Object.assign(out, { task: "attack", ordered: true }, as("assault"));
      break;
    case "withdraw":
      Object.assign(out, { task: "hold", ordered: true }, fate === "half" ? { posture: "hold" } : as("withdraw"));
      break;
    case "commander": {
      const seeded = seedCommander(gameOf(state), order.war, u.id, state.turn + 1);
      const asked: Commander = { ...(order.name?.trim() ? { name: order.name.trim().slice(0, 80) } : {}), temper: clamp(Math.round(order.temper ?? 0), -2, 2), skill: seeded.skill };
      // Late, he takes over when the turn is over; half-heartedly, the staff sends its own man; badly, a poor one.
      const man = fate === "half" ? { temper: 0, skill: seeded.skill } : fate === "badly" ? { ...asked, skill: Math.min(2, seeded.skill) } : asked;
      if (fate === "late") out.successor = man;
      else {
        out.commander = man;
        out.posture = chosen(u.task, man.temper);
      }
      break;
    }
  }
  return out;
}

/** The turn's stances for the fronts (engine/fronts.ts). */
export function planStances(plan: TurnPlan, state: Pick<GameState, "regions">, index: Pick<MapIndex, "neighbors">): Stances {
  return stancesFrom(plan.units, state, index);
}

// ——— After the turn ———

/** A formation's guns after the turn: spent in an attack, gathered while it waits to attack, run down while it holds. */
function prepAfter(u: PlannedUnit, months: number): number {
  if (u.posture === "offensive" || u.posture === "assault") return round2(u.botched ? 0 : u.prep * 0.3);
  if (u.task === "attack") return round2(Math.min(1, u.prep + Math.min(1, months / 1.5) * u.supply * (0.6 + 0.1 * u.commander.skill)));
  return round2(u.prep * 0.7 ** Math.min(1, months));
}

/** What a formation still needs to regroup after the turn: after an attack that gained next to nothing, REGROUP months; else less by the turn. */
function restAfter(u: PlannedUnit, km: number | undefined, months: number): { rest?: number } {
  const attacked = (u.posture === "offensive" || u.posture === "assault") && (km ?? 0) < FAILED_KM;
  const rest = attacked ? REGROUP * (u.commander.temper >= 2 ? 0.5 : 1) : Math.max(0, (u.rest ?? 0) - months);
  return rest > 0.01 ? { rest: round2(rest) } : {};
}

/**
 * The lines dig in: every province on a front after the turn adds the period to the months its line has stood, or starts
 * again as far as the line moved there (NEW_LINE_KM of ground a new line); off the fronts the mark goes.
 */
export function digIn(before: Pick<GameState, "regions">, next: Pick<GameState, "regions" | "wars">, index: Pick<MapIndex, "neighbors" | "regions">, months: number): void {
  const fronts = new Set<string>();
  for (const w of next.wars) for (const id of warFront(next, index, w)) fronts.add(id);
  for (const [id, r] of Object.entries(next.regions)) {
    if (!fronts.has(id)) {
      if (r.dug !== undefined) delete r.dug;
      continue;
    }
    const b = before.regions[id];
    let moved = 0;
    if (!b || b.controller !== r.controller || b.contested !== r.contested) moved = b?.dug === undefined ? 0 : Infinity;
    else if (r.contested) moved = Math.abs((r.held ?? 30) - (b.held ?? 30)) / paceScale(index.regions[id]);
    r.dug = round1(Math.min(MAX_DUG, ((b?.dug ?? 0) + months) * Math.max(0, 1 - moved / NEW_LINE_KM)));
  }
}

/**
 * Once the turn has landed: each war's formations keep their sectors, tasks and guns, a commander ordered late takes
 * over, the lines dig in, the player's orders are spent, and the player's formations' turns are told – their losses as
 * the war's record counts them (the game master's figures scale the engine's), the enemy's against them, the ground they
 * gained where they fought hardest. Mutates `next`; returns the turns for the chronicle.
 */
export function settleUnits(state: GameState, next: GameState, plan: TurnPlan | undefined, exchange: Exchange | undefined, index: Pick<MapIndex, "neighbors" | "regions"> | null, years: number): SectorTurn[] {
  const months = years * 12;
  if (index) digIn(state, next, index, months);
  delete next.armyOrders;
  if (!plan) return [];
  for (const war of next.wars) {
    const planned = plan.units[war.id];
    if (!planned) continue;
    const members = new Set([...war.attackers, ...war.defenders]);
    war.units = planned
      .filter((u) => members.has(u.tag))
      .map((u) => ({
        id: u.id,
        tag: u.tag,
        n: u.n,
        ...(u.name ? { name: u.name } : {}),
        kind: u.kind,
        commander: u.successor ?? u.commander,
        sector: u.sector,
        task: u.task,
        prep: prepAfter(u, months),
        ...(u.ordered ? { ordered: true } : {}),
        ...restAfter(u, exchange?.units.get(war.id)?.get(u.id)?.km, months),
      }));
  }
  const out: SectorTurn[] = [];
  for (const [warId, list] of Object.entries(plan.units)) {
    const parts = exchange?.units.get(warId);
    const war = next.wars.find((w) => w.id === warId);
    // What the war's record counts against what the engine's fighting gave: the game master's figures scale the formations' too.
    const engine = exchange?.wars.get(warId)?.get(state.player);
    const recorded = war?.losses?.[state.player]?.last;
    const engineTotal = engine ? engine.killed + engine.wounded + engine.captured : 0;
    const recordedTotal = recorded && recorded.turn === state.turn ? recorded.killed + recorded.wounded + (recorded.captured ?? 0) : engineTotal;
    const k = engineTotal > 0 ? clamp(recordedTotal / engineTotal, 1 / 3, 3) : 1;
    for (const u of list) {
      if (u.tag !== state.player) continue;
      const p = parts?.get(u.id);
      const commander = (u.successor ?? u.commander).name;
      out.push({
        war: warId,
        unit: u.id,
        n: u.n,
        ...(u.name ? { name: u.name } : {}),
        kind: u.kind,
        ...(commander ? { commander } : {}),
        posture: u.posture,
        ...(p?.at ? { at: p.at } : {}),
        lost: round1((p?.lost ?? 0) * k),
        enemyLost: round1(p?.enemyLost ?? 0),
        ...(p && p.taken >= 0.05 ? { taken: round1(p.taken) } : {}),
        km: round1(p?.km ?? 0),
        men: u.men,
        supply: u.supply,
        ...(u.forces ? { forces: u.forces } : {}),
        ...(u.order ? { order: u.order } : {}),
      });
    }
  }
  return out;
}

// ——— The player's orders ———

/** The player's order to a formation for the coming turn, in place of any order to it already given. */
export function giveArmyOrder<T extends Pick<GameState, "armyOrders" | "updatedAt">>(state: T, order: ArmyOrder, now = new Date()): T {
  const rest = (state.armyOrders ?? []).filter((o) => !(o.war === order.war && o.unit === order.unit));
  return { ...state, armyOrders: [...rest, order], updatedAt: now.toISOString() };
}

/** Takes back the order to a formation. */
export function withdrawArmyOrder<T extends Pick<GameState, "armyOrders" | "updatedAt">>(state: T, war: string, unit: string, now = new Date()): T {
  const rest = (state.armyOrders ?? []).filter((o) => !(o.war === war && o.unit === unit));
  const out = { ...state, updatedAt: now.toISOString() };
  if (rest.length) out.armyOrders = rest;
  else delete out.armyOrders;
  return out;
}

// ——— For the game master ———

/** "1st", "2nd", "23rd". */
const ordinalEn = (n: number) => {
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${suffix}`;
};

/** A formation's name in English: the game master's, else its number. */
export const unitNameEn = (u: Pick<ArmyUnit, "name" | "n" | "kind">) => u.name ?? `${ordinalEn(u.n)} ${u.kind === "corps" ? "Corps" : u.kind === "front" ? "Front" : "Army"}`;

const TEMPER_EN: Record<number, string> = { [-2]: "timid", [-1]: "careful", 0: "steady", 1: "bold", 2: "reckless" };
const POSTURE_EN: Record<Posture, string> = {
  withdraw: "falls back to a shorter line",
  hold: "holds its line",
  probe: "probes the enemy's line",
  offensive: "attacks",
  assault: "throws everything into an all-out assault",
};
const FATE_EN: Record<OrderFate, string> = {
  done: "carried out as given",
  late: "carried out late – half the period lost",
  half: "carried out half-heartedly",
  badly: "carried out badly",
};
const ORDER_EN: Record<ArmyOrderKind, string> = {
  hold: "hold its line",
  attack: "take ground where it can",
  offensive: "go on the offensive",
  assault: "make an all-out assault",
  withdraw: "fall back",
  commander: "take a new commander",
};

/**
 * The formations of the player's wars this period for the game master: the player's own one a line, with its commander,
 * sector, soldiers, supply, posture and target and what became of the player's order; the enemy's postures in a line a war.
 */
export function describeFormations(state: GameState, index: Index, orders: readonly string[] = []): string[] {
  const mine = state.wars.filter((w) => !w.truce && (w.attackers.includes(state.player) || w.defenders.includes(state.player)));
  if (!mine.length) return [];
  const plan = planTurn(state, index, orders);
  const place = (id: string) => index.regions[id]?.name ?? id;
  const lines: string[] = [];
  for (const war of mine) {
    const units = plan.units[war.id] ?? [];
    if (!units.length) continue;
    const enemy = war.attackers.includes(state.player) ? war.defenders : war.attackers;
    for (const u of units.filter((x) => x.tag === state.player)) {
      const c = u.successor ?? u.commander;
      const who = `${c.name ?? "commander unnamed"} (${TEMPER_EN[c.temper] ?? "steady"}, skill ${c.skill}/5)`;
      const sector = u.sector.slice(0, 3).map(place).join(", ") + (u.sector.length > 3 ? ` +${u.sector.length - 3}` : "");
      const posture = `${POSTURE_EN[u.posture]}${u.target && u.posture !== "hold" && u.posture !== "withdraw" ? ` at ${place(u.target)}` : ""}${u.botched ? " (botched)" : ""}${u.late ? " (late)" : ""}`;
      const order = u.order ? ` | the player ordered it to ${ORDER_EN[u.order.kind]}${u.order.text ? ` in these words: "${u.order.text.replace(/"/g, "'")}"` : ""}: ${FATE_EN[u.order.fate]}` : "";
      const arms = u.forces ? Object.entries(u.forces).map(([k, n]) => `${n} ${k === "artillery" ? "guns" : k}`).join(", ") : "";
      lines.push(`- ${war.id} | ${unitNameEn(u)}, ${who} | sector: ${sector} | about ${u.men}k men${arms ? `, ${arms}` : ""}, supply ${Math.round(u.supply * 100)}% | ${posture}${order}`);
    }
    const theirs = units.filter((x) => enemy.includes(x.tag));
    if (theirs.length) {
      const count = new Map<Posture, number>();
      for (const u of theirs) count.set(u.posture, (count.get(u.posture) ?? 0) + 1);
      const by = [...count].sort((a, b) => POSTURE_RANK[b[0]] - POSTURE_RANK[a[0]]).map(([p, n]) => `${n} ${p === "assault" ? "in all-out assault" : p === "offensive" ? "attacking" : p === "probe" ? "probing" : p === "withdraw" ? "falling back" : "holding"}`);
      lines.push(`- ${war.id} | the enemy's formations facing them: ${theirs.length} (${by.join(", ")})`);
    }
  }
  if (!lines.length) return [];
  return [
    "",
    "THE PLAYER'S FORMATIONS THIS PERIOD (decided by the engine: each holds a sector, its commander fights it as told; tell the fighting to match – never a posture or an order's fate other than this; the engine moves the fronts and counts the losses):",
    ...lines,
  ];
}

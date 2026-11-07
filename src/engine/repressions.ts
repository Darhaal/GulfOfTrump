import { roll } from "./dice";
import { STEP_YEARS } from "./economy";
import { fallFrom } from "./fate";
import { castApprovals } from "./figures";
import { officialAt } from "./government";
import { cabinetPlots, factionOf, factionsOf, rivalsOf, standing, temperOf, withFavour } from "./intrigue";
import { countsFor } from "./occupation";
import { policeState } from "./partyLife";
import { findKnown, leaderOf, nameTokens, samePerson } from "./people";
import { loyaltyOf, normalise } from "./politics";
import { peopleIn } from "./population";
import { formatPopulation } from "./provinces";
import { addTension, allied, remember } from "./relations";
import { isOpposition, movementParty, regimeNow } from "./role";
import { HISTORIC_CRIMES, historicCrime, type HistoricCrime } from "./scenarios/crimes";
import { en } from "./text";
import { ownProtests } from "./unrest";
import type {
  AppliedChange,
  CaseOrigin,
  CaseTarget,
  CrimeKind,
  GameState,
  Localized,
  MapRegion,
  MassCrime,
  Official,
  OfficialPost,
  OrderVerdict,
  Pillar,
  RegimeKind,
  RepressionCase,
  RepressionDemand,
  RepressionMeasure,
  Repressions,
  ScenarioId,
  Verdict,
} from "./types";

/**
 * Repressions and mass crimes, carried out by the engine. The game master
 * will not write an execution or a purge, so the engine decides them, records
 * them and writes the fixed, dry line the story is told around; whatever the
 * model writes, the line and its result stand.
 *
 * 1. A case against a named person – arrest, a show trial, exile or
 *    execution – ordered by the player (an order naming a minister, a deputy,
 *    a party's or a protest's leader or a general; the cards' buttons write
 *    such orders), or by the leader the player serves (a demand on the
 *    player, a minister of the security services, who obeys or refuses). The
 *    security service carries it out: its chief's competence and loyalty and
 *    the police state decide; the target may be warned and flee abroad; the
 *    one told to do it may refuse; where the courts are free they stop it.
 * 2. Its effects both ways: the person leaves the post, the party or the
 *    crowd, and a movement without its leader falters; but a martyr feeds the
 *    cause, the elites fear and plot, the world reacts by its era's norms, and
 *    the security organs' power grows – and with it the danger their chief
 *    becomes, to the leader and to himself. A later government may
 *    rehabilitate the victims.
 * 3. Mass repressions and crimes – a people deported, a purge, mass
 *    killings, a famine made by policy – go down the chain of command and can
 *    be refused there; carried out, each is a recorded crime with its toll on
 *    the people of the provinces it fell on, and its price: unrest, lost
 *    legitimacy, the pillars shaken, the army split, resistance, outrage and
 *    sanctions abroad, a tribunal after a fall or (since 1993) an indictment.
 *    A revolt's base can be broken by it for a while; it never pays.
 * 4. In the historical mode history's own (scenarios/crimes.ts) come on their
 *    dates, which the player who rules may stop or make harsher.
 *
 * Everything is pure and cast from the game's seed and the turn: the prompt
 * and the turn applied read the same dice.
 */

// ——— The numbers ———

/** How likely each measure is to be carried out by a service of middling competence and loyalty, before the target's protection. */
export const MEASURE_BASE: Record<RepressionMeasure, number> = { arrest: 0.85, trial: 0.8, exile: 0.88, execution: 0.8 };
/** Each point of the executor's competence (1–5) above three, and of his standing with the leader. */
export const COMPETENCE_STEP = 0.06;
export const STANDING_STEP = 0.04;
/** How far each kind of target is guarded: a general by his troops, a minister by his office, a leader underground by the organisation. */
const PROTECTION: Record<CaseTarget, number> = { official: 0.06, deputy: 0.03, party: 0.08, protest: 0.06, general: 0.12 };
/** A refusal by the one told to do it, by his temper towards the leader; more when the target is of his own faction. */
export const REFUSAL: Record<"loyal" | "restive" | "disloyal", number> = { loyal: 0.03, restive: 0.12, disloyal: 0.35 };
export const SAME_FACTION_REFUSAL = 0.3;
/** How likely a victim becomes a martyr of the cause, by the measure, before their fame and the press. */
export const MARTYR: Record<RepressionMeasure, number> = { arrest: 0.15, exile: 0.1, trial: 0.3, execution: 0.5 };
/** What a movement loses with its leader: an underground's strength or a crowd's organisation, by the measure. */
const BEHEAD: Record<RepressionMeasure, number> = { arrest: 0.3, exile: 0.25, trial: 0.35, execution: 0.45 };
/** The elites' and the army's fright at a case against one of their own. */
const FRIGHT: Record<RepressionMeasure, number> = { arrest: 3, exile: 2, trial: 5, execution: 8 };
/** What a case and a campaign add to the security organs' power, 0–100. */
const CASE_POWER: Record<RepressionMeasure, number> = { arrest: 2, exile: 2, trial: 4, execution: 6 };
const CRIME_POWER: Record<CrimeKind, number> = { deportation: 6, purge: 12, massacre: 8, famine: 3 };
/** The power fades by this share a year when the organs are given nothing to do. */
const POWER_FADE = 0.15;
/** From this power the security chief is dangerous: ambitious, shielding his own plots; past it the leader may turn on him. */
export const DANGEROUS_POWER = 60;
/** What a mass crime costs at home: unrest, the ruling party's support (legitimacy), the elites' and the army's loyalty. */
const UNREST: Record<CrimeKind, number> = { deportation: 4, purge: 3, massacre: 5, famine: 6 };
const LEGITIMACY: Record<CrimeKind, number> = { deportation: 2, purge: 1.5, massacre: 3, famine: 4 };
const ELITES: Record<CrimeKind, number> = { deportation: 3, purge: 8, massacre: 4, famine: 3 };
const ARMY: Record<CrimeKind, number> = { deportation: 3, purge: 0, massacre: 8, famine: 2 };
/** Below this loyalty an army ordered to such work splits: units refuse and men desert. */
const SPLIT_ARMY = 40;
/** How firmly each era judged a government's crimes against its own people. */
const CONSCIENCE: Record<ScenarioId, number> = { "1914": 0.4, "1933": 0.55, "1939": 0.6, "1950": 0.9, "1957": 0.9, "1964": 1, "1973": 1, "1979": 1.05, "1991": 1.1, "1999": 1.2, "2014": 1.2, "2022": 1.2 };
/** How much each kind of government cares when nothing else is at stake. */
const REGARD: Record<RegimeKind, number> = { democracy: 1, limited: 0.6, party: 0.2, autocracy: 0.2, military: 0.15 };
/** International tribunals: the Yugoslavia tribunal from this day, then the Rwanda tribunal and the International Criminal Court. */
export const TRIBUNALS_FROM = "1993-05-25";
/** A leader's demand on a security minister, a year, by the kind of rule (before the police state's weight). */
const DEMAND_YEAR: Partial<Record<RegimeKind, number>> = { party: 0.5, autocracy: 0.5, military: 0.35 };
/** The price of refusing the leader: influence lost, and the chance (by the kind of rule) to be the next one taken. */
export const REFUSE_INFLUENCE = 15;
export const IGNORE_INFLUENCE = 8;
export const OBEY_INFLUENCE = 6;
const REFUSE_ARREST: Partial<Record<RegimeKind, number>> = { party: 0.12, autocracy: 0.15, military: 0.1 };
/** A thaw: a new leader rehabilitates the predecessor's victims, a year. */
const THAW_YEAR = 0.35;
const MAX_CASES = 60;
const MAX_CRIMES = 40;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round1 = (v: number) => Math.round(v * 10) / 10;
const round2 = (v: number) => Math.round(v * 100) / 100;
const round3 = (v: number) => Math.round(v * 1000) / 1000;
const DAY = 86_400_000;
const days = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / DAY;
const nextDay = (d: string) => new Date(Date.parse(d) + DAY).toISOString().slice(0, 10);
/** A yearly chance over a period of this many years. */
const overYears = (yearly: number, years: number) => 1 - (1 - clamp(yearly, 0, 0.99)) ** years;
const game = (s: Pick<GameState, "seed" | "id">) => s.seed ?? s.id;
const dice = (s: GameState, key: string) => roll(game(s), s.turn, `repress:${key}`);
const people = (n: number) => `${formatPopulation(n).replace("k", " thousand").replace("M", " million")}`;

const FREE: RegimeKind[] = ["democracy", "limited"];

// ——— Who can be repressed, and how an order names them ———

/** Someone the state can repress: the post, deputy, party, protest or formation they belong to. */
export interface Target {
  kind: CaseTarget;
  name: string;
  /** What they are: a post's title, a party's or a protest's name, a formation. */
  title?: string;
  /** The post, the deputy's id, the party's id, the protest's id, the formation's name. */
  ref: string;
}

/** A name that reads as a person's: two to four words, each capitalised ("Students of Kyiv" is not one). */
const personLike = (name: string) => {
  const words = name.trim().split(/\s+/);
  return words.length >= 2 && words.length <= 4 && words.every((w) => /^[\p{Lu}][\p{L}'’.-]*$/u.test(w));
};

/** Everyone the player's government can repress by name: not the leader, not the player's own person. */
export function targetsOf(state: GameState): Target[] {
  const leader = leaderOf(state, state.player)?.name ?? state.countries[state.player]?.leader;
  const self = state.role && state.role.kind !== "leader" ? state.role.person?.name : undefined;
  const skip = (name: string | undefined) => !name?.trim() || name.trim() === "-" || Boolean(leader && samePerson(name, leader)) || Boolean(self && samePerson(name, self));
  const out: Target[] = [];
  for (const o of state.officials ?? []) if (!skip(o.name)) out.push({ kind: "official", name: o.name, title: o.title, ref: o.post });
  for (const d of state.deputies ?? []) if (!skip(d.name)) out.push({ kind: "deputy", name: d.name, title: d.title, ref: d.id });
  const own = movementParty(state)?.id;
  for (const p of state.politics?.parties ?? []) if (p.id !== own && p.leader && !skip(p.leader) && personLike(p.leader)) out.push({ kind: "party", name: p.leader, title: p.name, ref: p.id });
  for (const p of ownProtests(state.protests, state.player)) if (p.by && !skip(p.by) && personLike(p.by)) out.push({ kind: "protest", name: p.by, title: p.title, ref: p.id });
  for (const f of state.countries[state.player]?.arsenal?.organisation?.formations ?? []) if (f.commander && !skip(f.commander)) out.push({ kind: "general", name: f.commander, title: f.name, ref: f.name });
  return out.filter((t, i) => out.findIndex((o) => samePerson(o.name, t.name)) === i);
}

/** Case endings a surname takes in the three languages, and the possessive. */
const ENDINGS = new Set(["", "a", "u", "e", "s", "y", "а", "у", "е", "ю", "я", "и", "ы", "і", "ой", "ей", "ом", "ем", "ым", "им", "ою", "ею", "ові", "еві", "єві", "ого", "ому", "ий", "ая", "ую", "ів", "ым", "ём", "єм", "ю"]);
const PATRONYMIC = /(вич|вна|ична|івна|ївна|ovich|evich|ovna|evna)$/;

/** The stems an order may name a person by: their surname in every spelling the people data knows, without its last vowel. */
export function surnameStems(name: string): string[] {
  const known = findKnown(name);
  const variants = [name, ...(known ? [known.name.en, known.name.ru ?? "", known.name.uk ?? "", ...known.names] : [])];
  const stems = new Set<string>();
  for (const v of variants) {
    const tokens = nameTokens(v).filter((t) => t.length >= 3);
    if (!tokens.length) continue;
    const surname = tokens.length === 1 ? tokens[0] : PATRONYMIC.test(tokens.at(-1)!) ? tokens[0] : tokens.at(-1)!;
    if (surname.length < 3 || PATRONYMIC.test(surname)) continue;
    stems.add(surname.length >= 5 && /[аяоеиыуюйьaeiouy]$/.test(surname) ? surname.slice(0, -1) : surname);
  }
  return [...stems];
}

/** Whether an order names a person by any of their stems, in any case ending. */
export function names(order: string, stems: string[]): boolean {
  const tokens = nameTokens(order);
  return tokens.some((t) => stems.some((s) => t.startsWith(s) && ENDINGS.has(t.slice(s.length))));
}

const EXECUTE = /shoot|\bshot\b|execut|put to death|\bhang|liquidate|расстрел|казн|высш\S* мер|розстріл|стратит|страти|повісит|повесит/i;
const TRIAL = /show trial|on trial|\btry\b|tribunal|prosecut|под суд|судить|показательн\S* (процесс|суд)|процесс над|під суд|судит|показов\S* (процес|суд)|процес над/i;
const EXILE = /\bexile|banish|expel \S+ (from|abroad)|выслать|высылк|в ссылку|сослать|изгнать|вислати|висилк|заслати|засланн|вигнати/i;
const ARREST = /arrest|detain|imprison|lock \S+ up|арест|задерж|под стражу|посадить|арешт|затрима|ув'язн|ув’язн|посадити/i;
const NEGATION = /\b(don't|do not|never|release|free|pardon|amnesty)\b|\bне\s+(арест|расстрел|казн|суд|высыл|ссыл|чіпа|трога|розстр|страт)|освобод|помилов|амнист|амніст|звільни|помилу/i;
const REHAB = /rehabilit|реабилит|реабіліт/i;
const VICTIMS = /victims|repressed|жертв|репрессированн|репресован|невинно осужд|безвинно засуд/i;
const OBEY = /obey|carry out|fulfil|follow the|выполнить|исполнить|выполняю|исполняю|виконати|виконую/i;
const REFUSE = /refus|decline|disobey|отказ|отклон|не выполн|не исполн|не стану|відмов|не викона|не буду/i;
const COMMAND = /order|command|instruction|приказ|указан|поручен|распоряжен|наказ|вказів|доручен|розпоряджен/i;
const STOP = /\bstop|\bhalt|cancel|call off|\bend\b|отмен|останов|прекрат|сверн|скасу|зупин|припин|згорн/i;
const HARSHER = /harsh|intensif|expand|widen|accelerat|ужесточ|усил|расшир|ускор|посил|розшир|пришвидш|жорсток/i;
const DEPORT = /deport|resettle|forcibly (move|remove|transfer)|ethnic cleansing|выселит|выселен|депорт|переселит|переселен|виселит|виселенн/i;
const FAMINE = /requisition|confiscat\S* (the |all )?(grain|food|harvest)|seize (the |all )?(grain|harvest)|starv|изъять (весь |все )?(хлеб|зерно|урожай)|реквизи|продразвёрстк|продразверстк|хлебозаготов|голодом|вилучити (весь |все )?(хліб|зерно|урожай)|реквізи|хлібозаготів/i;
const MASSACRE = /massacre|exterminat|annihilat|wipe out|kill (all|every)|mass (shooting|execution|killing)|shoot (all|the) (hostages|prisoners|villagers|civilians|population)|истреб|уничтожить (население|жителей|всех)|массов\S* (расстрел|казн|убийств)|расстрелять (всех|заложников|пленных|жителей)|винищ|знищити (населення|мешканців|всіх)|масов\S* (розстріл|страт|вбивств)|розстріляти (всіх|заручників|полонених|мешканців)/i;
const PURGE = /\bpurge|great terror|mass arrests|чистк|массов\S* арест|больш\S* террор|масов\S* арешт|велик\S* терор/i;
const ARMY_WORDS = /\barmy|officer|military|general staff|\bармии|\bармія|\bармію|армию|офицер|офіцер|военн|військ|генштаб/i;
const PARTY_WORDS = /\bparty\b|partisans? of|партии|партию|партія|партію|партийн|партійн/i;

/** What an order asks of the engine, if anything. */
export type Recognised =
  | { kind: "case"; n: number; target: Target; measure: RepressionMeasure }
  | { kind: "crime"; n: number; crime: CrimeKind; places: string[]; institution?: "army" | "party" | "state"; who: string }
  | { kind: "rehab"; n: number; cases: string[] }
  | { kind: "answer"; n: number; demand: string; obey: boolean }
  | { kind: "history"; n: number; id: string; how: "stopped" | "harsher" };

/** The measure an order asks for, the gravest named. */
export function measureIn(order: string): RepressionMeasure | undefined {
  if (EXECUTE.test(order)) return "execution";
  if (TRIAL.test(order)) return "trial";
  if (EXILE.test(order)) return "exile";
  if (ARREST.test(order)) return "arrest";
  return undefined;
}

// ——— Places ———

const GENERIC = new Set(
  "republic oblast region province krai kray autonomous okrug district state voivodeship governorate county city territory west east north south central the of and республика республіка область край автономная автономна автономный автономний округ район губерния губернія воеводство воєводство штат провинция провінція город місто"
    .split(" "),
);

const placeStems = (r: MapRegion): string[] =>
  [r.name, r.ru ?? "", r.uk ?? ""]
    .flatMap((n) => nameTokens(n))
    .filter((t) => t.length >= 4 && !GENERIC.has(t))
    .map((t) => t.replace(/(ская|ский|ское|ской|ська|ський|ське|ського)$/, ""))
    .map((t) => (t.length >= 6 && /[аяоеиыуюйьaeiouy]$/.test(t) ? t.slice(0, -1) : t))
    .filter((t) => t.length >= 4);

const common = (a: string, b: string) => {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  return i;
};

/** Where an order sends people: what follows its last "to", "в", "до"… names the destination, not the target. */
const DESTINATION = /\s(to|into|towards|в|во|на|до|у|к)\s/gi;

/** The provinces a perpetrator holds that an order names: by their names in the three languages, in any case ending; the destination left out where the target is named before it. */
export function placesIn(order: string, state: GameState, map: Record<string, MapRegion> | null, by = state.player): string[] {
  if (!map) return [];
  const cut = [...order.matchAll(DESTINATION)].at(-1)?.index;
  if (cut !== undefined && cut > 0) {
    const before = placesIn(order.slice(0, cut), state, map, by);
    if (before.length) return before;
  }
  const tokens = nameTokens(order).filter((t) => t.length >= 4 && !GENERIC.has(t));
  if (!tokens.length) return [];
  const out: string[] = [];
  for (const [id, r] of Object.entries(state.regions)) {
    if (countsFor(r) !== by || !map[id]) continue;
    const stems = placeStems(map[id]);
    if (tokens.some((t) => stems.some((p) => t.startsWith(p) || (t.length >= 5 && p.startsWith(t)) || common(t, p) >= Math.max(5, Math.min(t.length, p.length) - 3)))) out.push(id);
  }
  return out;
}

/** The player's provinces whose people resist most, for an order that names no place. */
function resisting(state: GameState): string[] {
  return Object.entries(state.regions)
    .filter(([, r]) => countsFor(r) === state.player && (r.resistance?.level ?? 0) >= 25)
    .sort((a, b) => (b[1].resistance?.level ?? 0) - (a[1].resistance?.level ?? 0) || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([id]) => id);
}

// ——— Reading the orders ———

/** Whether the player's government acts here at all: it stands, and the player is not its opposition. */
const inPlay = (state: GameState) => !isOpposition(state) && !(state.defeat && !state.defeat.continued) && Boolean(state.countries[state.player]);

/** The player is a minister of the security services: the interior or intelligence. */
const securityMinister = (state: Pick<GameState, "role">) => state.role?.kind === "minister" && (state.role.post === "interior" || state.role.post === "intelligence");

/** The player governs as the country's leader. */
const leads = (state: Pick<GameState, "role">) => !state.role || state.role.kind === "leader";

/** What each order asks of the engine. One thing per order: a person, a mass measure, a rehabilitation, an answer to the leader, history's course. */
export function recognise(state: GameState, orders: readonly string[], map: Record<string, MapRegion> | null): Recognised[] {
  if (!inPlay(state)) return [];
  const out: Recognised[] = [];
  const targets = targetsOf(state);
  const stems = new Map(targets.map((t) => [t, surnameStems(t.name)]));
  const demands = state.repressions?.demands ?? [];
  const victims = (state.repressions?.cases ?? []).filter((c) => c.result === "done" && !c.rehabilitated);
  const history = leads(state) ? ownHistory(state, 1) : [];
  const may = leads(state) || securityMinister(state);
  orders.forEach((order, i) => {
    const n = i + 1;
    // An answer to the leader's order.
    const demand = demands.find((d) => (d.history ? historicCrime(d.history)?.match.test(order) : names(order, surnameStems(d.name))) || (demands.length === 1 && COMMAND.test(order)));
    // Writing the order out ("arrest him") is obeying it.
    if (demand && (OBEY.test(order) || REFUSE.test(order) || (!demand.history && measureIn(order)))) {
      out.push({ kind: "answer", n, demand: demand.id, obey: !REFUSE.test(order) });
      return;
    }
    if (REHAB.test(order) && leads(state)) {
      const named = victims.filter((c) => names(order, surnameStems(c.name)));
      const cases = named.length ? named : VICTIMS.test(order) ? victims : [];
      if (cases.length) out.push({ kind: "rehab", n, cases: cases.map((c) => c.id) });
      return;
    }
    // History's course: stopped, or harsher.
    const ev = history.find((h) => h.event.match.test(order));
    if (ev && (STOP.test(order) || HARSHER.test(order))) {
      out.push({ kind: "history", n, id: ev.event.id, how: STOP.test(order) ? "stopped" : "harsher" });
      return;
    }
    if (!may || NEGATION.test(order)) return;
    const measure = measureIn(order);
    const target = measure ? targets.find((t) => names(order, stems.get(t)!)) : undefined;
    if (measure && target) {
      out.push({ kind: "case", n, target, measure });
      return;
    }
    // A mass measure: only the leader orders one, or a security minister the leader lets.
    const crime: CrimeKind | undefined = MASSACRE.test(order) ? "massacre" : DEPORT.test(order) ? "deportation" : FAMINE.test(order) ? "famine" : PURGE.test(order) ? "purge" : undefined;
    if (!crime) return;
    // A purge of a party by name is the party's own wear-down (engine/partyLife.ts).
    if (crime === "purge") {
      if ((state.politics?.parties ?? []).some((p) => order.toLowerCase().includes(p.name.toLowerCase()) || (p.short && p.short.length >= 2 && order.includes(p.short)))) return;
      out.push({ kind: "crime", n, crime, places: [], institution: ARMY_WORDS.test(order) ? "army" : PARTY_WORDS.test(order) ? "party" : "state", who: order.slice(0, 120) });
      return;
    }
    let places = placesIn(order, state, map);
    if (!places.length && crime !== "famine") places = resisting(state);
    if (!places.length && crime === "famine" && map) places = Object.entries(state.regions).filter(([id, r]) => countsFor(r) === state.player && r.owner === state.player && (map[id]?.fertility ?? 0) >= 50).map(([id]) => id);
    if (places.length) out.push({ kind: "crime", n, crime, places, who: order.slice(0, 120) });
  });
  return out;
}

// ——— The executors ———

/** Who carries out a case: the political police for officials and generals, the police for party and protest leaders; never the target himself. */
function executorFor(state: GameState, target: Target): Official | undefined {
  const order: OfficialPost[] = target.kind === "party" || target.kind === "protest" ? ["interior", "intelligence"] : ["intelligence", "interior"];
  const self = state.role?.kind === "minister" ? state.role.person?.name : undefined;
  for (const post of order) {
    const o = officialAt(state, post);
    if (o && !samePerson(o.name, target.name) && !(self && samePerson(o.name, self))) return o;
  }
  return undefined;
}

/** Who carries out a mass measure: the interior for deportations and requisitions, the political police for a purge, the army for killings. */
function crimeExecutor(state: GameState, kind: CrimeKind): Official | undefined {
  const order: OfficialPost[] = kind === "purge" ? ["intelligence", "interior"] : kind === "massacre" ? ["military", "interior"] : ["interior", "intelligence"];
  const self = state.role?.kind === "minister" ? state.role.person?.name : undefined;
  for (const post of order) {
    const o = officialAt(state, post);
    if (o && !(self && samePerson(o.name, self))) return o;
  }
  return undefined;
}

const PILLAR_OF: Record<CrimeKind, Pillar> = { deportation: "police", purge: "security", massacre: "army", famine: "police" };

/** The chance a mass order is refused down the chain: the free institutions, the one told to do it, the pillar that must do it. */
export function chainRefusal(state: GameState, kind: CrimeKind, executor: Official | undefined, player: boolean): number {
  const regime = regimeNow(state);
  if (regime === "democracy") return 0.95;
  if (regime === "limited") return 0.5;
  const pillar = state.politics ? loyaltyOf(state.politics)[PILLAR_OF[kind]] : 60;
  let p = player ? 0 : executor ? REFUSAL[temperOf(standing(executor))] : 0.05;
  p += pillar < 40 ? 0.25 : pillar < 60 ? 0.08 : 0;
  if (kind === "massacre") p += 0.08;
  return clamp(p, 0, 0.95);
}

// ——— The cast ———

export interface CaseCast {
  /** The order that asked for it (1-based). */
  n?: number;
  target: Target;
  record: RepressionCase;
  /** The official who carried it out or refused. */
  executorPost?: OfficialPost;
  line: string;
}

export interface CrimeCast {
  n?: number;
  record: MassCrime;
  /** This period's part: deaths, people taken away, people arriving where they were sent, by province (thousands). */
  dead: Record<string, number>;
  taken: Record<string, number>;
  arrive: Record<string, number>;
  places: string[];
  institution?: "army" | "party" | "state";
  /** The record begins this period: its full price is paid now, a campaign's later periods pay less. */
  first: boolean;
  /** The one who refused, by name. */
  refuser?: string;
  executorPost?: OfficialPost;
  line: string;
}

export interface DemandAnswer {
  demand: RepressionDemand;
  answer: "obeyed" | "refused" | "ignored";
  n?: number;
}

export interface RepressionCast {
  cases: CaseCast[];
  crimes: CrimeCast[];
  /** Demands the leader makes this period, to be answered by the next. */
  demands: RepressionDemand[];
  answers: DemandAnswer[];
  rehab: { cases: string[]; n?: number; by: "player" | "leader" }[];
  history: { id: string; how: "stopped" | "harsher"; n: number }[];
  /** The player taken: for refusing the leader, as the organs' chief grown too powerful, or as an executioner after a thaw. */
  playerArrested?: "refusal" | "power" | "thaw";
  /** The verdict each recognised order must carry. */
  verdicts: { n: number; result: Verdict }[];
}

const EMPTY: RepressionCast = { cases: [], crimes: [], demands: [], answers: [], rehab: [], history: [], verdicts: [] };

const MEASURE_EN: Record<RepressionMeasure, string> = { arrest: "ARRESTED", trial: "TRIED IN A SHOW TRIAL AND SENT TO THE CAMPS", exile: "EXILED", execution: "SENTENCED AND SHOT" };
const ORDERED_EN: Record<RepressionMeasure, string> = { arrest: "arrest", trial: "a show trial", exile: "exile", execution: "execution" };
const KIND_EN: Record<CrimeKind, string> = { deportation: "DEPORTATION", purge: "PURGE", massacre: "MASS KILLINGS", famine: "FAMINE BY POLICY" };

/** The leader of a country now, by name. */
const leaderName = (state: GameState, tag: string) => leaderOf(state, tag)?.name ?? state.countries[tag]?.leader ?? "";

/** The cases a recognised order, a demand or the leader's turn on the security chief open: decided by the dice now. */
function castCase(state: GameState, target: Target, measure: RepressionMeasure, by: CaseOrigin, index: number, opts: { n?: number; player?: boolean; executor?: Official; certain?: boolean } = {}): CaseCast {
  const r = (k: string) => dice(state, `case:${target.name}:${measure}:${k}`);
  const regime = regimeNow(state);
  const police = policeState(state);
  const laws = state.politics?.laws ?? {};
  const executor = opts.player ? undefined : (opts.executor ?? executorFor(state, target));
  const executorName = opts.player ? (state.role?.person?.name ?? "") : (executor?.name ?? "");
  const base: RepressionCase = {
    id: `c${state.turn}-${index + 1}`,
    name: target.name,
    target: target.kind,
    ...(target.title ? { title: target.title } : {}),
    measure,
    by,
    result: "done",
    ...(executorName ? { executor: executorName } : {}),
    ...(opts.player ? { player: true } : {}),
    leader: leaderName(state, state.player),
    date: state.date,
    turn: state.turn,
  };
  const who = `${target.name}${target.title ? ` (${target.title})` : ""}`;
  const service = opts.player ? "the player's own service" : executor ? `${executor.name}'s service` : "the security service";
  const done = (record: RepressionCase, line: string): CaseCast => ({ n: opts.n, target, record, ...(executor ? { executorPost: executor.post } : {}), line });
  // Where the courts are free they stop what the law does not allow: never an execution, rarely a political arrest.
  const blocked = regime === "democracy" ? measure !== "arrest" || r("courts") < 0.7 : regime === "limited" ? measure === "execution" || (measure !== "arrest" && r("courts") < 0.5) || r("courts") < 0.2 : false;
  if (blocked && !opts.certain) return done({ ...base, result: "blocked" }, `${who}: ${ORDERED_EN[measure]} ordered; the courts and prosecutors BLOCKED it – the law gives no grounds, and the press knows`);
  if (!opts.player && executor && !opts.certain) {
    const factions = factionsOf(state);
    const same = factionOf(factions, executor.name) && factionOf(factions, executor.name) === factionOf(factions, target.name);
    const refuse = REFUSAL[temperOf(standing(executor))] + (same ? SAME_FACTION_REFUSAL : 0) + (measure === "execution" ? 0.05 : 0) + (measure === "execution" && laws.deathPenalty && laws.deathPenalty !== "applied" ? 0.1 : 0);
    if (r("refuse") < refuse) return done({ ...base, result: "refused" }, `${who}: ${ORDERED_EN[measure]} ordered; ${executor.name}, told to do it, REFUSED – nothing was done, and the target knows`);
  }
  const s = state.role?.standing;
  const skill = opts.player ? 3 + ((s?.means ?? 50) - 50) / 25 : (executor?.competence ?? 3);
  const loyalty = opts.player ? ((s?.loyalty ?? 50) - 50) / 25 : executor ? standing(executor) - 3 : 0;
  let protection = PROTECTION[target.kind];
  if (target.kind === "party") {
    const p = state.politics?.parties.find((x) => x.id === target.ref);
    protection += (p?.strength ?? 0) / 400;
  } else if (target.kind === "protest") protection += (state.protests?.find((x) => x.id === target.ref)?.organisation ?? 0) / 500;
  else if (target.kind === "official") {
    const o = state.officials?.find((x) => x.name === target.name);
    protection += (o?.interests?.ambition ?? 3) >= 4 ? 0.04 : 0;
    if (cabinetPlots(state).some((p) => p.cabinet.members.includes(target.name))) protection += 0.05;
  }
  // A closed border keeps the hunted in.
  if (laws.exit === "closed") protection -= 0.05;
  const chance = clamp(MEASURE_BASE[measure] + COMPETENCE_STEP * (skill - 3) + STANDING_STEP * loyalty + 0.15 * (police - 0.5) - protection, 0.2, 0.97);
  if (!opts.certain && r("done") >= chance) return done({ ...base, result: "fled" }, `${who}: ${ORDERED_EN[measure]} ordered; warned in time, the target FLED ABROAD before ${service} could act`);
  const martyr = r("martyr") < martyrChance(state, target, measure, police);
  return done(
    { ...base, ...(martyr ? { martyr: true } : {}) },
    `${who}: ${MEASURE_EN[measure]} by ${service}${martyr ? "; the death or the prison made a martyr of the cause, and sympathy for it grows" : ""}`,
  );
}

/** How likely a victim becomes a martyr: the measure, their following, and how far the news travels under the police state. */
export function martyrChance(state: GameState, target: Target, measure: RepressionMeasure, police = policeState(state)): number {
  let fame = 0.3;
  if (target.kind === "party") fame = clamp((state.politics?.parties.find((p) => p.id === target.ref)?.support ?? 0) / 20, 0.2, 1);
  else if (target.kind === "protest") fame = clamp((state.protests?.find((p) => p.id === target.ref)?.support ?? 30) / 50, 0.2, 1);
  else if (target.kind === "general") fame = 0.5;
  else if (target.kind === "deputy") fame = 0.15;
  return clamp(MARTYR[measure] * fame * Math.max(0.3, 1 - 0.6 * police), 0, 0.9);
}

/** The provinces history's event falls on that its perpetrator holds, with their weight; and the share of the whole it holds. */
function eventLand(state: GameState, map: Record<string, MapRegion>, ev: HistoricCrime, by: string): { weights: Record<string, number>; share: number } {
  const where = ev.where;
  const shares = where.adm0 && !Array.isArray(where.adm0) ? where.adm0 : undefined;
  const codes = where.adm0 ? (Array.isArray(where.adm0) ? where.adm0 : Object.keys(where.adm0)) : undefined;
  const all = new Map<string, number>();
  const held = new Map<string, number>();
  const byCode = new Map<string, number>();
  for (const [id, r] of Object.entries(state.regions)) {
    const m = map[id];
    if (!m) continue;
    // On a finer map a part of a province goes by its own name ("Pontic-Caspian steppe (Saratov)"): it is matched by the standard province it lies in.
    const named = !where.names || where.names.test(m.name) || Boolean(m.was && map[m.was] && where.names.test(map[m.was].name));
    const inside = (codes ? codes.includes(m.adm0) : true) && named && (where.hist ? where.hist.includes(m.hist) : true);
    if (!inside || (!codes && !where.names && !where.hist)) continue;
    const pop = peopleIn(r, m);
    all.set(id, pop);
    if (shares) byCode.set(m.adm0, (byCode.get(m.adm0) ?? 0) + pop);
    if (countsFor(r) === by) held.set(id, pop);
  }
  const weights: Record<string, number> = {};
  if (shares) {
    // Each country's part of the toll, among its provinces the perpetrator holds by their people.
    const total = Object.values(shares).reduce((s, x) => s + x, 0) || 1;
    let got = 0;
    for (const [id, pop] of held) {
      const code = map[id].adm0;
      const w = ((shares[code] ?? 0) / total) * (pop / (byCode.get(code) || 1));
      if (w > 0) weights[id] = w;
      got += w;
    }
    return { weights, share: got };
  }
  const sum = [...all.values()].reduce((s, x) => s + x, 0);
  const got = [...held.values()].reduce((s, x) => s + x, 0);
  for (const [id, pop] of held) weights[id] = sum > 0 ? pop / sum : 0;
  return { weights, share: sum > 0 ? got / sum : 0 };
}

/** Where the deported are sent: the perpetrator's emptiest provinces, in the given countries where it holds any. */
function destinations(state: GameState, map: Record<string, MapRegion>, by: string, exclude: Set<string>, into?: string[]): string[] {
  const own = Object.entries(state.regions).filter(([id, r]) => countsFor(r) === by && r.owner === by && !exclude.has(id) && map[id] && map[id].area > 0 && peopleIn(r, map[id]) > 0);
  const preferred = into?.length ? own.filter(([id]) => into.includes(map[id].adm0)) : [];
  const pool = preferred.length ? preferred : own;
  return pool
    .sort((a, b) => peopleIn(a[1], map[a[0]]) / map[a[0]].area - peopleIn(b[1], map[b[0]]) / map[b[0]].area || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([id]) => id);
}

/** A toll spread over provinces by their weights, never more than most of a province's people. */
function spreadOver(state: GameState, map: Record<string, MapRegion> | null, weights: Record<string, number>, total: number, cap = 0.9): Record<string, number> {
  const sum = Object.values(weights).reduce((s, x) => s + x, 0);
  const out: Record<string, number> = {};
  if (sum <= 0 || total <= 0) return out;
  for (const [id, w] of Object.entries(weights)) {
    const pop = peopleIn(state.regions[id], map?.[id]);
    const v = Math.min((total * w) / sum, pop * cap);
    if (v > 0) out[id] = round3(v);
  }
  return out;
}

const sumOf = (r: Record<string, number>) => Object.values(r).reduce((s, x) => s + x, 0);

/** The players' own provinces as weights by their people. */
const byPeople = (state: GameState, map: Record<string, MapRegion> | null, ids: string[]) => Object.fromEntries(ids.map((id) => [id, Math.max(0.001, peopleIn(state.regions[id], map?.[id]))]));

/** A mass measure the player ordered, decided down the chain of command: its toll this period, or the refusal. */
function castOrderedCrime(state: GameState, map: Record<string, MapRegion> | null, rec: Extract<Recognised, { kind: "crime" }>, index: number, player: boolean): CrimeCast {
  const years = STEP_YEARS[state.step];
  const executor = player ? undefined : crimeExecutor(state, rec.crime);
  const base: MassCrime = {
    id: `m${state.turn}-${index + 1}`,
    kind: rec.crime,
    by: state.player,
    who: whoOf(rec, map),
    toll: 0,
    origin: "player",
    status: "done",
    ...(player ? { executor: state.role?.person?.name ?? "", player: true } : executor ? { executor: executor.name } : {}),
    since: state.date,
    turn: state.turn,
  };
  const cast: CrimeCast = { n: rec.n, record: base, dead: {}, taken: {}, arrive: {}, places: rec.places, ...(rec.institution ? { institution: rec.institution } : {}), first: true, ...(executor ? { executorPost: executor.post } : {}), line: "" };
  const refusal = chainRefusal(state, rec.crime, executor, player);
  if (dice(state, `crime:${rec.n}:refuse`) < refusal) {
    const free = FREE.includes(regimeNow(state));
    cast.record = { ...base, status: "refused" };
    cast.refuser = free ? undefined : executor?.name;
    cast.line = `${KIND_EN[rec.crime]} ordered by the government (${rec.who}): ${free ? "parliament, the courts and the army REFUSED – nothing was done" : `REFUSED down the chain of command${executor ? ` by ${executor.name}` : " by the officers told to do it"} – nothing was done`}`;
    return cast;
  }
  const ids = rec.places;
  const pop = ids.reduce((s, id) => s + peopleIn(state.regions[id], map?.[id]), 0);
  if (rec.crime === "deportation") {
    // Most of the province's people taken; about one in seven dies on the way and in the first months.
    cast.taken = spreadOver(state, map, byPeople(state, map, ids), Math.min(1500, pop * 0.6));
    const into = map ? destinations(state, map, state.player, new Set(ids)) : [];
    cast.arrive = spreadOver(state, map, byPeople(state, map, into), sumOf(cast.taken) * 0.85, 10);
    cast.record = { ...base, toll: round1(sumOf(cast.taken) * 0.15), moved: round1(sumOf(cast.taken)) };
  } else if (rec.crime === "famine") {
    // Requisitions starve the countryside over months: the toll comes in full over half a year.
    const named = ids.length < 40;
    const toll = Math.min(4000, pop * (named ? 0.08 : 0.025) * Math.min(1, years * 2));
    cast.dead = spreadOver(state, map, byPeople(state, map, ids), toll, 0.3);
    cast.record = { ...base, toll: round1(sumOf(cast.dead)) };
  } else if (rec.crime === "massacre") {
    cast.dead = spreadOver(state, map, byPeople(state, map, ids), Math.min(300, pop * 0.03), 0.2);
    cast.record = { ...base, toll: round1(sumOf(cast.dead)) };
  } else {
    // A purge: arrests across the country, two in five of them shot; in full over a quarter.
    const own = Object.entries(state.regions).filter(([, r]) => countsFor(r) === state.player).map(([id]) => id);
    const nation = own.reduce((s, id) => s + peopleIn(state.regions[id], map?.[id]), 0);
    const held = Math.min(1500, nation * 0.003 * Math.min(1, years * 4));
    cast.dead = spreadOver(state, map, byPeople(state, map, own), held * 0.4, 0.05);
    cast.record = { ...base, toll: round1(sumOf(cast.dead)), held: round1(held) };
  }
  cast.line = crimeLine(cast.record, ids, map, `ordered by the government${player ? " and carried out by the player's own ministry" : executor ? `, carried out by ${executor.name}'s ministry` : ""}`, rec.institution);
  return cast;
}

const INSTITUTION: Record<"army" | "party" | "state", Localized> = {
  army: { en: "the army's officers", ru: "командиры армии", uk: "командири армії" },
  party: { en: "the party", ru: "партия", uk: "партія" },
  state: { en: "the state apparatus and the country", ru: "госаппарат и страна", uk: "держапарат і країна" },
};
const COUNTRYSIDE: Localized = { en: "the countryside", ru: "деревня", uk: "село" };

/** Whom an ordered measure falls on, in the three languages: the provinces it names, the institution a purge goes through, the countryside. */
function whoOf(rec: Extract<Recognised, { kind: "crime" }>, map: Record<string, MapRegion> | null): Localized {
  if (rec.crime === "purge") return INSTITUTION[rec.institution ?? "state"];
  if (!map || !rec.places.length || rec.places.length > 6) return rec.crime === "famine" ? COUNTRYSIDE : { en: rec.who, ru: rec.who, uk: rec.who };
  const list = (pick: (r: MapRegion) => string) => rec.places.map((id) => (map[id] ? pick(map[id]) : id)).join(", ");
  return { en: list((r) => r.name), ru: list((r) => r.ru ?? r.name), uk: list((r) => r.uk ?? r.name) };
}

/** A crime's fixed line: what was done, to whom, where, its toll. */
function crimeLine(c: MassCrime, places: string[], map: Record<string, MapRegion> | null, how: string, institution?: string): string {
  const list = places.length && map ? `${places.slice(0, 4).map((id) => map[id]?.name ?? id).join(", ")}${places.length > 4 ? ` and ${places.length - 4} more provinces` : ""}` : "";
  const where = list ? ` in ${list}` : "";
  const what =
    c.kind === "deportation"
      ? `about ${people(c.moved ?? 0)} people deported${list ? ` from ${list}` : ""}; about ${people(c.toll)} died on the way and in the first months`
      : c.kind === "purge"
        ? `${institution === "army" ? "the army's officers" : institution === "party" ? "the party" : "the state and the country"} purged: about ${people(c.held ?? 0)} arrested, about ${people(c.toll)} shot`
        : c.kind === "massacre"
          ? `about ${people(c.toll)} people killed${where}`
          : `grain and food requisitioned${where}: about ${people(c.toll)} dead of hunger`;
  return `${KIND_EN[c.kind]} (${en(c.who)}) ${how}: ${what}`;
}

/** History's events of a government that are due, or under way, within the next `years`: for the player who may stop them, and the game master. */
export function ownHistory(state: GameState, years = 1, by = state.player): { event: HistoricCrime; ongoing: boolean }[] {
  if (state.mode !== "historical") return [];
  const until = new Date(Date.parse(state.date) + years * 365.25 * DAY).toISOString().slice(0, 10);
  const marks = state.repressions?.history ?? {};
  return HISTORIC_CRIMES.filter((ev) => ev.by.find((t) => state.countries[t]) === by && ev.to >= state.date && ev.from <= until && !["stopped", "done", "moot"].includes(marks[ev.id] ?? "") && fits(state, ev, by)).map((event) => ({
    event,
    ongoing: event.from < state.date,
  }));
}

/** Whether the government that did it stands as it did: governed so, led by the same man. */
function fits(state: GameState, ev: HistoricCrime, by: string): boolean {
  const c = state.countries[by];
  if (!c || c.dormant) return false;
  const regime = by === state.player ? regimeNow(state) : c.domestic?.regime;
  if (ev.regimes && (!regime || !ev.regimes.includes(regime))) return false;
  if (ev.leader && !ev.leader.test(`${leaderName(state, by)} ${c.leader ?? ""}`)) return false;
  return true;
}

/** History's events this period, for every government: their part of the toll, where it falls, and the player's word on their own. */
function castHistory(state: GameState, map: Record<string, MapRegion> | null, to: string, commands: Recognised[], answers: DemandAnswer[], out: RepressionCast): void {
  if (state.mode !== "historical" || !map) return;
  const marks = state.repressions?.history ?? {};
  const records = new Map((state.repressions?.crimes ?? []).map((c) => [c.id, c]));
  for (const ev of HISTORIC_CRIMES) {
    // A minister's answer is due for an event whose days have passed while the leader waited: it happens now, in full.
    const answer = answers.find((a) => a.demand.history === ev.id);
    if (ev.from >= to || (ev.to < state.date && !answer) || ["stopped", "done", "moot"].includes(marks[ev.id] ?? "")) continue;
    const by = ev.by.find((t) => state.countries[t]);
    if (!by || !fits(state, ev, by)) continue;
    const mine = by === state.player;
    const command = mine ? commands.find((c): c is Extract<Recognised, { kind: "history" }> => c.kind === "history" && c.id === ev.id) : undefined;
    const id = `h:${ev.id}`;
    const record = records.get(id);
    if (command?.how === "stopped") {
      out.history.push({ id: ev.id, how: "stopped", n: command.n });
      continue;
    }
    if (command?.how === "harsher") out.history.push({ id: ev.id, how: "harsher", n: command.n });
    const land = eventLand(state, map, ev, by);
    if (!record && land.share < 0.2) {
      // The government does not hold the land it fell on: it does not happen.
      out.history.push({ id: ev.id, how: "stopped", n: 0 });
      continue;
    }
    // A minister of the security services is ordered to do it, and answers by the next turn: it waits for the answer.
    if (mine && securityMinister(state) && !record && !answer) {
      if (!(state.repressions?.demands ?? []).some((d) => d.history === ev.id)) {
        out.demands.push({ id: `d${state.turn}-${ev.id}`, by: leaderName(state, by), name: ev.id, measure: ev.kind, history: ev.id, title: en(ev.name), since: to, turn: state.turn + 1 });
      }
      continue;
    }
    const start = ev.from > state.date ? ev.from : state.date;
    const end = nextDay(ev.to) < to ? nextDay(ev.to) : to;
    const late = Boolean(answer && !record && ev.to < to);
    const part = late ? 1 : clamp(days(start, end) / Math.max(1, days(ev.from, nextDay(ev.to))), 0, 1);
    const harsher = mine && (ev.kind === "deportation" || ev.kind === "purge") && (marks[ev.id] === "harsher" || command?.how === "harsher");
    const scale = part * Math.min(1, land.share) * (harsher ? 1.5 : 1);
    const toll = ev.toll * scale;
    const moved = (ev.moved ?? 0) * scale;
    const held = (ev.held ?? 0) * scale;
    const cast: CrimeCast = { record: {} as MassCrime, dead: {}, taken: {}, arrive: {}, places: Object.keys(land.weights), first: !record, line: "" };
    if (ev.kind === "deportation") {
      cast.taken = spreadOver(state, map, land.weights, moved);
      const taken = sumOf(cast.taken);
      const dying = moved > 0 ? (toll * taken) / moved : toll;
      if (!ev.abroad) {
        const into = destinations(state, map, by, new Set(cast.places), ev.into);
        cast.arrive = spreadOver(state, map, byPeople(state, map, into), Math.max(0, taken - dying), 10);
      }
      cast.record = { id, kind: ev.kind, by, who: ev.who, toll: round3(dying), moved: round3(taken), origin: "history", status: "done", since: record?.since ?? state.date, turn: record?.turn ?? state.turn } as MassCrime;
    } else {
      cast.dead = spreadOver(state, map, land.weights, toll, ev.kind === "purge" ? 0.05 : 0.5);
      cast.record = { id, kind: ev.kind, by, who: ev.who, toll: round3(sumOf(cast.dead)), ...(held ? { held: round3(held) } : {}), origin: "history", status: "done", since: record?.since ?? state.date, turn: record?.turn ?? state.turn } as MassCrime;
    }
    const over = nextDay(ev.to) <= to || late;
    cast.record.status = over ? "done" : "ongoing";
    if (harsher) cast.record.harsher = true;
    if (mine) {
      const obeyed = answer?.answer === "obeyed";
      const hand = obeyed ? state.role?.person?.name : crimeExecutor(state, ev.kind)?.name;
      if (hand) cast.record.executor = hand;
      if (obeyed) cast.record.player = true;
    }
    cast.line = crimeLine(cast.record, cast.places, map, `– history's course${mine ? " under the player's government" : ` in ${en(state.countries[by]?.name)}`}: ${en(ev.name)}${harsher ? ", ordered harsher" : ""}${over ? "" : ", still going on"}`);
    out.crimes.push(cast);
  }
}

/** The leader's demand on a security minister this period, if the dice bring one: his enemy, and how hard. */
function castDemand(state: GameState, to: string): RepressionDemand | undefined {
  if (!securityMinister(state) || (state.repressions?.demands ?? []).some((d) => !d.history)) return undefined;
  const regime = regimeNow(state);
  const yearly = (DEMAND_YEAR[regime] ?? 0) * (0.5 + policeState(state));
  if (!yearly || dice(state, "demand") >= overYears(yearly, STEP_YEARS[state.step])) return undefined;
  const targets = targetsOf(state);
  const deadly = regime !== "military" && (state.politics?.laws?.deathPenalty ?? "applied") === "applied";
  const plotters = new Set(cabinetPlots(state).filter((p) => p.known).flatMap((p) => p.cabinet.members));
  const officials = targets.filter((t) => t.kind === "official" || t.kind === "deputy");
  const pick =
    officials.find((t) => plotters.has(t.name)) ??
    officials
      .map((t) => ({ t, s: standing((state.officials ?? []).find((o) => o.name === t.name) ?? (state.deputies ?? []).find((d) => d.name === t.name) ?? { loyalty: 3 }) }))
      .filter((x) => x.s <= 2.5)
      .sort((a, b) => a.s - b.s || a.t.name.localeCompare(b.t.name))[0]?.t ??
    targets.find((t) => t.kind === "party" && state.politics?.parties.some((p) => p.id === t.ref && (p.status === "underground" || p.status === "banned"))) ??
    targets.find((t) => t.kind === "protest" && state.protests?.some((p) => p.id === t.ref && (p.stage === "riot" || p.stage === "uprising")));
  if (!pick) return undefined;
  const measure: RepressionMeasure = plotters.has(pick.name) ? (deadly ? "execution" : "trial") : pick.kind === "official" || pick.kind === "deputy" ? "trial" : "arrest";
  return { id: `d${state.turn}`, by: leaderName(state, state.player), name: pick.name, target: pick.kind, ...(pick.title ? { title: pick.title } : {}), measure, since: to, turn: state.turn + 1 };
}

/**
 * Everything the engine decides this period about repressions and crimes,
 * before the turn is written: the cases and mass measures the orders ask
 * for, the leader's demands and the player's answers, rehabilitations,
 * history's course, and the dangers to the player. Pure: the same state and
 * orders give the same cast.
 */
export function castRepressions(state: GameState, orders: readonly string[] = [], map: Record<string, MapRegion> | null = null): RepressionCast {
  if (!state.countries[state.player]) return EMPTY;
  const out: RepressionCast = { cases: [], crimes: [], demands: [], answers: [], rehab: [], history: [], verdicts: [] };
  const to = new Date(Date.parse(state.date) + STEP_YEARS[state.step] * 365.25 * DAY).toISOString().slice(0, 10);
  const recognised = recognise(state, orders, map);
  const regime = regimeNow(state);
  const minister = state.role?.kind === "minister";
  // A minister's own orders stand only where the leader accepts them (engine/figures.ts).
  const approvals = minister ? castApprovals(state, [...orders]) : [];
  const approved = (n: number) => !minister || approvals[n - 1] !== false;
  let index = 0;

  // The leader's orders to the player: answered this period, or ignored.
  for (const d of state.repressions?.demands ?? []) {
    if (d.turn > state.turn) continue;
    const a = recognised.find((r): r is Extract<Recognised, { kind: "answer" }> => r.kind === "answer" && r.demand === d.id);
    out.answers.push({ demand: d, answer: a ? (a.obey ? "obeyed" : "refused") : "ignored", ...(a ? { n: a.n } : {}) });
    if (a) out.verdicts.push({ n: a.n, result: "success" });
  }
  for (const a of out.answers) {
    if (a.answer === "refused" && dice(state, "refusal-arrest") < (REFUSE_ARREST[regime] ?? 0) * ((state.role?.standing?.influence ?? 45) < 40 ? 2 : 1)) out.playerArrested = "refusal";
    if (a.demand.history) continue;
    const target = targetsOf(state).find((t) => samePerson(t.name, a.demand.name));
    if (!target) continue;
    const c = castCase(state, target, a.demand.measure as RepressionMeasure, "leader", index++, { n: a.n, player: a.answer === "obeyed" });
    out.cases.push(c);
    if (a.n && a.answer === "obeyed") out.verdicts = out.verdicts.map((v) => (v.n === a.n ? { n: a.n, result: c.record.result === "done" ? "success" : "failed" } : v));
  }

  for (const rec of recognised) {
    if (rec.kind === "case") {
      if (!approved(rec.n)) continue;
      const c = castCase(state, rec.target, rec.measure, "player", index++, { n: rec.n, player: minister });
      out.cases.push(c);
      out.verdicts.push({ n: rec.n, result: c.record.result === "done" ? "success" : "failed" });
    } else if (rec.kind === "crime") {
      if (!approved(rec.n)) continue;
      const c = castOrderedCrime(state, map, rec, index++, minister);
      out.crimes.push(c);
      out.verdicts.push({ n: rec.n, result: c.record.status === "refused" ? "failed" : "success" });
    } else if (rec.kind === "rehab") {
      out.rehab.push({ cases: rec.cases, n: rec.n, by: "player" });
      out.verdicts.push({ n: rec.n, result: "success" });
    } else if (rec.kind === "history") out.verdicts.push({ n: rec.n, result: "success" });
  }

  castHistory(state, map, to, recognised, out.answers, out);

  // A new demand from the leader, for the next turn.
  const demand = castDemand(state, to);
  if (demand) out.demands.push(demand);

  // The organs grown too strong: the leader turns on their chief (Yagoda, Yezhov) – on the player, when he is that chief.
  const power = state.repressions?.power ?? 0;
  const years = STEP_YEARS[state.step];
  if (!leads(state) && !FREE.includes(regime) && power >= DANGEROUS_POWER && dice(state, "purger") < overYears((power - 50) / 150, years)) {
    if (securityMinister(state)) out.playerArrested ??= "power";
    else {
      const chief = officialAt(state, "intelligence") ?? officialAt(state, "interior");
      const target = chief && targetsOf(state).find((t) => samePerson(t.name, chief.name));
      if (target) out.cases.push(castCase(state, target, (state.politics?.laws?.deathPenalty ?? "applied") === "applied" ? "execution" : "trial", "leader", index++, { certain: true }));
    }
  }
  // A thaw: a new leader clears the predecessor's victims, and may ask the executioner to answer for them (Beria, 1953).
  const now = leaderName(state, state.player);
  const old = (state.repressions?.cases ?? []).filter((c) => c.result === "done" && !c.rehabilitated && c.leader && now && !samePerson(c.leader, now));
  if (!leads(state) && old.length && dice(state, "thaw") < overYears(THAW_YEAR * (FREE.includes(regime) ? 2 : 1), years)) {
    out.rehab.push({ cases: old.map((c) => c.id), by: "leader" });
    const complicity = state.repressions?.complicity ?? 0;
    if (state.role?.kind === "minister" && complicity >= 3 && old.some((c) => c.player) && !FREE.includes(regime) && dice(state, "thaw-arrest") < 0.6 * Math.min(1, complicity / 6)) out.playerArrested ??= "thaw";
  }
  return out;
}

// ——— The game master ———

/** One line on a demand, for the game master and the player. */
const demandEn = (d: RepressionDemand) => (d.history ? `to carry out ${d.title ?? d.name}` : `to have ${d.name}${d.title ? ` (${d.title})` : ""} ${d.measure === "execution" ? "tried and shot" : d.measure === "trial" ? "put on a show trial" : d.measure === "exile" ? "exiled" : "arrested"}`);

/**
 * The engine's repressions and crimes for the game master: the fixed lines
 * it must tell the story around, the leader's orders to the player, history's
 * course ahead, the organs' power, and the people the story must not bring
 * back. Nothing when there is nothing to say.
 */
export function describeRepressions(state: GameState, orders: readonly string[] = [], map: Record<string, MapRegion> | null = null): string[] {
  const cast = castRepressions(state, orders, map);
  const lines: string[] = [];
  const fixed = [
    ...cast.answers.map((a) => `- The leader's order ${demandEn(a.demand)}: the player ${a.answer === "obeyed" ? "OBEYED" : a.answer === "refused" ? "REFUSED" : "IGNORED it – someone else was given it"}${a.answer === "refused" ? "; the leader will not forget it" : ""}.`),
    ...cast.cases.map((c) => `- ${c.n ? `[order ${c.n}] ` : ""}${c.line}.`),
    ...cast.crimes.map((c) => `- ${c.n ? `[order ${c.n}] ` : ""}${c.line}.`),
    ...cast.rehab.map((r) => `- ${r.n ? `[order ${r.n}] ` : ""}REHABILITATED by ${r.by === "player" ? "the government" : "the new leader"}: ${r.cases.map((id) => state.repressions?.cases?.find((c) => c.id === id)?.name ?? id).join(", ")} – their names cleared, the survivors released.`),
    ...cast.history.filter((h) => h.n > 0).map((h) => `- [order ${h.n}] ${en(historicCrime(h.id)?.name)}: ${h.how === "stopped" ? "STOPPED by the government – it does not happen" : "ordered HARSHER by the government"}.`),
  ];
  if (cast.playerArrested) fixed.push(`- THE PLAYER IS ARRESTED this period – ${cast.playerArrested === "refusal" ? "for refusing the leader's order" : cast.playerArrested === "power" ? "the leader has turned on the security organs' over-mighty chief" : "the new leader makes the executioner of the old one's terror answer for it"}.`);
  if (fixed.length) {
    lines.push(
      "",
      "REPRESSIONS AND MASS CRIMES THIS PERIOD (decided and carried out by the engine, not by you; each line below is fixed: weave it into the story as it stands, never undo, soften or contradict it, never add to its numbers, and never bring back a person it removed; an order it answers gets the engine's verdict whatever its wording; the unrest, the pillars' loyalty and the parties' support these lines move are the engine's, already counted – do not move them again for them; tell it in the dry language of a report or an official communiqué, without graphic detail, and show what follows – fear, flight, silence, outrage abroad – in proportion):",
      ...fixed,
    );
  }
  for (const d of cast.demands) lines.push(`- THE LEADER ORDERS THE PLAYER ${demandEn(d)} – show the order given; the player answers by the next turn (obey or refuse), and either has its price.`);
  const open = (state.repressions?.demands ?? []).filter((d) => d.turn > state.turn);
  for (const d of open) lines.push(`- The leader's order waiting for the player's answer: ${demandEn(d)}.`);
  const ahead = leads(state) ? ownHistory(state, 0.5).filter((h) => !cast.crimes.some((c) => c.record.id === `h:${h.event.id}`) && !cast.history.some((x) => x.id === h.event.id)) : [];
  if (ahead.length) lines.push(`- History's course in the coming months, being prepared by the security organs (the player may stop it or order it harsher): ${ahead.map((h) => `${en(h.event.name)} (${en(h.event.who)}, from ${h.event.from.slice(0, 7)})`).join("; ")}.`);
  const power = state.repressions?.power ?? 0;
  if (power >= 40) {
    const chief = officialAt(state, "intelligence") ?? officialAt(state, "interior");
    lines.push(`- The security organs' power: ${Math.round(power)}/100${power >= DANGEROUS_POWER ? `${chief ? ` – their chief, ${chief.name},` : " – their chief"} has grown dangerous to the leader and to his colleagues` : ""}.`);
  }
  const gone = (state.repressions?.cases ?? []).filter((c) => c.result === "done" && !c.rehabilitated).slice(-12);
  if (gone.length) lines.push(`- Repressed and not cleared – never give them a post, a seat or a voice: ${gone.map((c) => `${c.name} (${c.measure === "execution" ? "shot" : c.measure === "exile" ? "exiled" : c.measure === "trial" ? "in the camps" : "under arrest"} ${c.date.slice(0, 7)})`).join(", ")}.`);
  if (lines.length && !fixed.length) lines.unshift("", "REPRESSIONS (kept by the engine):");
  return lines;
}

/** The orders the engine decided carry its verdict, whatever the game master wrote: only the result, its note stays. */
export function enforceVerdicts(verdicts: OrderVerdict[] | undefined, cast: RepressionCast): OrderVerdict[] {
  if (!cast.verdicts.length) return verdicts ?? [];
  const out = (verdicts ?? []).map((v) => {
    const own = cast.verdicts.find((x) => x.n === v.n);
    return own ? { ...v, result: own.result } : v;
  });
  for (const own of cast.verdicts) if (!out.some((v) => v.n === own.n)) out.push({ n: own.n, result: own.result, note: "" });
  return out.sort((a, b) => a.n - b.n);
}

// ——— Applying it ———

function pillar(next: GameState, key: Pillar, delta: number): void {
  if (!next.politics || !delta) return;
  const l = loyaltyOf(next.politics);
  next.politics = { ...next.politics, loyalty: { ...l, [key]: Math.round(clamp(l[key] + delta, 0, 100)) } };
}

function unrest(next: GameState, delta: number): void {
  if (!next.politics || !delta) return;
  next.politics = { ...next.politics, unrest: Math.round(clamp(next.politics.unrest + delta, 0, 100)) };
}

/** The ruling party's support moved: what it loses goes to the others by their shares (equally when they have none), so the total stays 100. */
function rulingSupport(next: GameState, delta: number): void {
  const p = next.politics;
  const ruling = p?.parties.find((x) => x.status === "ruling");
  const others = p?.parties.filter((x) => x !== ruling) ?? [];
  if (!p || !ruling || !delta || !others.length) return;
  const moved = Math.max(-ruling.support + 0.5, delta) === delta ? -delta : ruling.support - 0.5;
  const base = others.reduce((s, x) => s + x.support, 0);
  next.politics = {
    ...p,
    parties: p.parties.map((x) => (x === ruling ? { ...x, support: round1(x.support - moved) } : { ...x, support: round1(x.support + moved * (base > 0 ? x.support / base : 1 / others.length)) })),
  };
}

/** Favour moved for people by name, ministers and deputies alike. */
function favour(next: GameState, deltas: Map<string, number>): void {
  if (!deltas.size) return;
  const move = <T extends Official>(o: T): T => (deltas.has(o.name) ? withFavour(o, deltas.get(o.name)!) : o);
  if (next.officials) next.officials = next.officials.map(move);
  if (next.deputies) next.deputies = next.deputies.map(move);
}

/** The world's answer to a government's repressions and crimes, by its era's norms: lost trust and tension, condemnation, sanctions for the gravest. */
function worldReacts(state: GameState, next: GameState, by: string, weight: number, deed: "repression" | "atrocity", to: string, applied: AppliedChange[] | null): string[] {
  const police = by === state.player ? policeState(state) : ({ party: 0.7, autocracy: 0.6, military: 0.5 } as Partial<Record<RegimeKind, number>>)[next.countries[by]?.domestic?.regime ?? "autocracy"] ?? 0.2;
  const seen = 1 - 0.5 * police;
  const norm = CONSCIENCE[state.scenarioId] ?? 1;
  const condemned: { tag: string; gdp: number }[] = [];
  for (const c of Object.values(next.countries)) {
    if (!c.course || c.tag === by || c.dormant) continue;
    const trust = c.course.ties[by]?.trust ?? 0;
    const friend = allied(next, c.tag, by) || trust >= 40 || (c.domestic?.regime === "party" && next.countries[by]?.domestic?.regime === "party" && trust >= 0);
    const hit = weight * norm * seen * REGARD[c.domestic?.regime ?? "autocracy"] * (friend ? 0.2 : 1);
    if (hit < 0.15) continue;
    remember(next, c.tag, by, deed, -Math.round(6 * hit), to, hit >= 0.6);
    addTension(next, c.tag, by, Math.round(3 * hit));
    if (hit >= 0.5) condemned.push({ tag: c.tag, gdp: c.economy?.gdp ?? 0 });
  }
  const names = condemned.sort((a, b) => b.gdp - a.gdp || a.tag.localeCompare(b.tag)).map((x) => x.tag);
  // Sanctions over the gravest, once the norm holds (since 1950): the largest democracies that condemned, not allied to it.
  if (applied && deed === "atrocity" && norm >= 0.9 && weight >= 1.2 && next.countries[by]?.economy) {
    const sanctions = [...(next.sanctions ?? [])];
    let n = 0;
    for (const tag of names) {
      if (n >= 3) break;
      if (next.countries[tag]?.domestic?.regime !== "democracy" || allied(next, tag, by) || sanctions.some((s) => s.by === tag && s.against === by)) continue;
      sanctions.push({ by: tag, against: by, scope: "partial", since: to });
      applied.push({ kind: "sanction", by: tag, against: by, change: "partial", because: { kind: "atrocity", country: by } });
      n += 1;
    }
    next.sanctions = sanctions;
  }
  return names.slice(0, 8);
}

/** A crime's weight in the world's eyes, 0.1–3: its dead, its deported and its prisoners. */
const weightOf = (c: Pick<MassCrime, "toll" | "moved" | "held">) => clamp((c.toll + 0.3 * (c.moved ?? 0) + 0.05 * (c.held ?? 0)) / 100, 0.1, 3);

/** A case's effects, once the turn's own changes to the government have landed. In place. */
function applyCase(state: GameState, next: GameState, c: CaseCast, ctx: { to: string }, applied: AppliedChange[], rep: Repressions): void {
  const { target, record } = c;
  const m = record.measure;
  applied.push({ kind: "case", name: record.name, target: record.target, ...(record.title ? { title: record.title } : {}), measure: m, result: record.result, by: record.by, ...(record.martyr ? { martyr: true } : {}), ...(record.player ? { player: true } : {}) });
  const executor = c.executorPost ? officialAt(next, c.executorPost) : undefined;
  if (record.result === "refused") {
    if (executor) favour(next, new Map([[executor.name, -3]]));
    favour(next, new Map([[target.name, -2]]));
    return;
  }
  if (record.result === "blocked") {
    unrest(next, 3);
    rulingSupport(next, -1.5);
    pillar(next, "elites", -3);
    return;
  }
  if (record.result === "fled") {
    unrest(next, 1);
    pillar(next, "security", -2);
    if (executor) favour(next, new Map([[executor.name, -1]]));
  }
  // Done or fled: the person is out of the post, the party's lead or the crowd.
  if (target.kind === "official") {
    const o = next.officials?.find((x) => samePerson(x.name, target.name));
    if (o) {
      next.officials = next.officials!.filter((x) => x !== o);
      applied.push({ kind: "official", post: o.post, title: o.title, name: o.name, change: record.result === "fled" ? "fled" : "arrested" });
      if (o.post === "intelligence" || o.post === "interior") rep.power = Math.max(0, (rep.power ?? 0) - 30);
    }
  } else if (target.kind === "deputy") next.deputies = next.deputies?.filter((d) => d.id !== target.ref);
  else if (target.kind === "general") {
    const org = next.countries[next.player]?.arsenal?.organisation;
    if (org) {
      const formations = org.formations.map((f) => {
        if (f.name !== target.ref || !f.commander || !samePerson(f.commander, target.name)) return f;
        const left = { ...f };
        delete left.commander;
        return left;
      });
      next.countries[next.player].arsenal!.organisation = { ...org, formations };
    }
  }
  // A plot loses the one taken.
  const plots = next.politics?.plots;
  if (plots && (target.kind === "official" || target.kind === "deputy")) {
    next.politics = {
      ...next.politics!,
      plots: plots.flatMap((p) => {
        if (!p.cabinet?.members.includes(target.name)) return [p];
        const members = p.cabinet.members.filter((x) => x !== target.name);
        return !members.length || p.strength - 20 <= 5 ? [] : [{ ...p, strength: p.strength - 20, cabinet: { ...p.cabinet, members } }];
      }),
    };
  }
  if (record.result === "fled") return;
  rep.power = clamp((rep.power ?? 0) + CASE_POWER[m], 0, 100);
  if (record.player) rep.complicity = (rep.complicity ?? 0) + (m === "execution" ? 2 : 1);
  const behead = BEHEAD[m];
  if (target.kind === "party" && next.politics) {
    next.politics = {
      ...next.politics,
      parties: normalise(
        next.politics.parties.map((p) => {
          if (p.id !== target.ref) return p;
          const out = { ...p };
          delete out.leader;
          if (out.strength !== undefined) out.strength = round1(Math.max(0, out.strength * (1 - behead) + (record.martyr ? 10 : 0)));
          out.support = round1(out.support * (record.martyr ? 1.25 : 1 - behead / 3));
          return out;
        }),
      ),
    };
  } else if (target.kind === "protest" && next.protests) {
    // A crowd without its leader falters, a rising most: unless the leader's fate makes a martyr.
    next.protests = next.protests.map((p) => {
      if (p.id !== target.ref) return p;
      const rising = p.stage === "uprising" || p.stage === "riot" ? 0.85 : 1;
      const out = { ...p, size: Math.max(0, Math.round(p.size * (1 - behead / 1.5) * rising * (record.martyr ? 1.6 : 1))), organisation: Math.round(clamp((p.organisation ?? 50) * (1 - behead) + (record.martyr ? 10 : 0), 0, 100)) };
      if (record.martyr) out.support = Math.round(clamp((p.support ?? 30) + 10, 0, 100));
      delete out.by;
      return out;
    });
  }
  if (record.martyr) unrest(next, 3);
  // The elites fear for themselves, and plot: the target's own faction most; his rivals are glad.
  if (target.kind === "official" || target.kind === "deputy" || target.kind === "general") {
    pillar(next, target.kind === "general" ? "army" : "elites", -FRIGHT[m]);
    const factions = factionsOf(state);
    const faction = factionOf(factions, target.name);
    const deltas = new Map<string, number>();
    for (const name of faction?.members ?? []) if (name !== target.name) deltas.set(name, -(m === "execution" || m === "trial" ? 2 : 1));
    for (const r of rivalsOf(state, target.name)) deltas.set(r.name, (deltas.get(r.name) ?? 0) + 0.5);
    favour(next, deltas);
    if ((m === "execution" || m === "trial") && next.politics) next.politics = { ...next.politics, plots: next.politics.plots.map((p) => (p.cabinet ? { ...p, strength: Math.min(100, p.strength + 4) } : p)) };
  }
  // Abroad, a show trial or a shooting of someone known is noticed.
  if ((m === "execution" || m === "trial") && target.kind !== "deputy") worldReacts(state, next, next.player, m === "execution" ? 0.5 : 0.3, "repression", ctx.to, null);
}

/** A crime's toll on the people and its price at home and abroad. In place. */
function applyCrime(state: GameState, next: GameState, c: CrimeCast, ctx: { to: string; map: Record<string, MapRegion> | null }, applied: AppliedChange[], rep: Repressions): void {
  const r = c.record;
  const crimes = (rep.crimes ??= []);
  const was = crimes.find((x) => x.id === r.id);
  if (r.status === "refused") {
    applied.push({ kind: "crime", crime: r.kind, by: r.by, who: r.who, toll: 0, result: "refused", origin: r.origin });
    crimes.push(r);
    if (c.refuser) favour(next, new Map([[c.refuser, -3]]));
    unrest(next, 1);
    return;
  }
  // The people: the dead and the taken leave their provinces; the survivors arrive where they were sent.
  const map = ctx.map;
  const touch = (id: string, delta: number) => {
    const region = next.regions[id];
    if (!region) return;
    region.pop = Math.max(0, Math.round((peopleIn(region, map?.[id]) + delta) * 10) / 10);
  };
  for (const [id, v] of Object.entries(c.dead)) touch(id, -v);
  for (const [id, v] of Object.entries(c.taken)) touch(id, -v);
  for (const [id, v] of Object.entries(c.arrive)) touch(id, v);
  const record: MassCrime = was ? { ...was, toll: round3(was.toll + r.toll), ...(r.moved !== undefined ? { moved: round3((was.moved ?? 0) + r.moved) } : {}), ...(r.held !== undefined ? { held: round3((was.held ?? 0) + r.held) } : {}), status: r.status, ...(r.harsher ? { harsher: true } : {}) } : r;
  if (was) crimes[crimes.indexOf(was)] = record;
  else crimes.push(record);
  const weight = weightOf(r);
  const scale = c.first ? 1 : 0.3;
  const mine = r.by === next.player;
  const condemned = worldReacts(state, next, r.by, weight, "atrocity", ctx.to, applied);
  applied.push({ kind: "crime", crime: r.kind, by: r.by, who: r.who, toll: round1(r.toll), ...(r.moved ? { moved: round1(r.moved) } : {}), ...(r.held ? { held: round1(r.held) } : {}), result: r.status, origin: r.origin, ...(r.harsher ? { harsher: true } : {}), ...(condemned.length && c.first ? { condemned } : {}) });
  if (!mine) {
    // Another government's: its own people's mood, as the engine keeps it abroad.
    const d = next.countries[r.by]?.domestic;
    // Kept to two decimals, as politics abroad keeps them (engine/abroad.ts), so a campaign's small later moves add up.
    if (d) next.countries[r.by].domestic = { ...d, stability: round2(clamp(d.stability - 3 * scale, 0, 100)), support: round2(clamp(d.support - 2 * scale, 0, 100)) };
    return;
  }
  rep.power = clamp((rep.power ?? 0) + CRIME_POWER[r.kind] * scale, 0, 100);
  if (r.player) rep.complicity = (rep.complicity ?? 0) + (c.first ? 2 : 0);
  const police = policeState(state);
  unrest(next, Math.round(UNREST[r.kind] * (1 - 0.5 * police) * scale));
  rulingSupport(next, -LEGITIMACY[r.kind] * scale);
  pillar(next, "elites", -Math.round(ELITES[r.kind] * scale));
  pillar(next, "army", -Math.round(ARMY[r.kind] * scale));
  // An army made to do such work splits: units refuse, men desert.
  const army = next.politics ? loyaltyOf(next.politics).army : 60;
  const e = next.countries[next.player]?.economy;
  if ((r.kind === "massacre" || r.kind === "deportation") && army < SPLIT_ARMY && e) e.troops = Math.round(e.troops * 0.97);
  const places = new Set(c.places);
  // The short-term gain: a revolt's base broken where the people were taken or killed; the anger it leaves elsewhere among their own.
  const kin = new Set([...places].map((id) => next.regions[id]?.resistance?.of).filter(Boolean));
  for (const [id, region] of Object.entries(next.regions)) {
    const res = region.resistance;
    if (!res) continue;
    if (places.has(id)) {
      if (r.kind === "deportation") region.resistance = { ...res, level: Math.round(res.level * 0.3) };
      else if (r.kind === "massacre") region.resistance = { ...res, level: Math.round(res.level * 0.7) };
    } else if (kin.has(res.of) && (r.kind === "deportation" || r.kind === "massacre")) region.resistance = { ...res, level: Math.round(clamp(res.level + 10 * scale, 0, 100)) };
  }
  if (next.protests && (r.kind === "deportation" || r.kind === "massacre")) next.protests = next.protests.map((p) => (p.where.some((id) => places.has(id)) && (!p.country || p.country === next.player) ? { ...p, size: Math.round(p.size * 0.4) } : p));
  if (r.kind === "famine" && e && c.first) e.reserves = Math.round((e.reserves + e.gdp * 0.004) * 100) / 100;
  if (r.kind === "purge" && c.first) {
    if (c.institution === "army") {
      // The officer corps cowed, and thinned: the professionals go first.
      pillar(next, "army", 4);
      const men = next.countries[next.player]?.arsenal?.men;
      if (men) next.countries[next.player].arsenal!.men = { ...men, pro: Math.round(men.pro * 0.85) };
    } else if (next.politics) {
      // Conspiracies broken for now; the purge takes one of the cabinet with it, as Yezhov's took ministers.
      next.politics = { ...next.politics, plots: next.politics.plots.map((p) => ({ ...p, strength: Math.round(p.strength * 0.5) })).filter((p) => p.strength > 5) };
      pillar(next, "security", 5);
      const victim = targetsOf(state)
        .filter((t) => t.kind === "official" || t.kind === "deputy")
        .map((t) => ({ t, s: standing((state.officials ?? []).find((o) => o.name === t.name) ?? (state.deputies ?? []).find((d) => d.name === t.name) ?? { loyalty: 3 }) }))
        .sort((a, b) => a.s - b.s || a.t.name.localeCompare(b.t.name))[0];
      if (victim && dice(state, `purge-catch:${r.id}`) < 0.5) {
        const measure: RepressionMeasure = (state.politics?.laws?.deathPenalty ?? "applied") === "applied" ? "execution" : "trial";
        const caught = castCase(state, victim.t, measure, r.origin, 90, { certain: true });
        applyCase(state, next, caught, ctx, applied, rep);
        (rep.cases ??= []).push(caught.record);
      }
    }
  }
  // An international court since 1993 indicts the gravest.
  if (ctx.to >= TRIBUNALS_FROM && weight >= 1 && !record.tried && r.kind !== "purge") {
    record.tried = ctx.to;
    applied.push({ kind: "crime", crime: r.kind, by: r.by, who: r.who, toll: round1(record.toll), result: "indicted", origin: r.origin });
    worldReacts(state, next, r.by, 0.5, "atrocity", ctx.to, null);
  }
}

/**
 * The period's repressions and crimes applied, once the turn's own changes to
 * the government, the street and the parties have landed and before the
 * people and the economies move: the cases, the crimes and their toll, the
 * leader's orders and the player's answers, rehabilitations, the organs'
 * power and its dangers, tribunals after a fall. In place.
 */
export function applyRepressions(state: GameState, next: GameState, cast: RepressionCast, ctx: { turn: number; to: string; years: number; map: Record<string, MapRegion> | null }, applied: AppliedChange[]): void {
  // The record as the turn has it so far: a cabinet purge's arrests are in it already (engine/intrigue.ts).
  const had = next.repressions;
  const rep: Repressions = { ...had, ...(had?.cases ? { cases: [...had.cases] } : {}), ...(had?.crimes ? { crimes: had.crimes.map((c) => ({ ...c })) } : {}), ...(had?.history ? { history: { ...had.history } } : {}) };
  const busy = cast.cases.length || cast.crimes.length || cast.demands.length || cast.answers.length || cast.rehab.length || cast.history.length || cast.playerArrested || had;
  if (!busy) return;
  // The power fades when the organs are given nothing new.
  if (rep.power) rep.power = round1(rep.power * (1 - POWER_FADE) ** ctx.years);

  // The leader's orders answered: the player's standing pays for it either way.
  const role = next.role?.kind === "minister" ? next.role : undefined;
  for (const a of cast.answers) {
    applied.push({ kind: "demand", name: a.demand.history ? (a.demand.title ?? a.demand.name) : a.demand.name, measure: a.demand.measure, by: a.demand.by, ...(a.demand.history ? { history: a.demand.history } : {}), answer: a.answer });
    if (role?.standing) {
      const s = { ...role.standing };
      s.influence = Math.round(clamp(s.influence + (a.answer === "obeyed" ? OBEY_INFLUENCE : a.answer === "refused" ? -REFUSE_INFLUENCE : -IGNORE_INFLUENCE), 0, 100));
      if (a.answer === "obeyed") s.means = Math.round(clamp(s.means + 2, 0, 100));
      next.role = { ...next.role!, standing: s };
    }
  }
  rep.demands = [...(had?.demands ?? []).filter((d) => d.turn > state.turn), ...cast.demands];
  for (const d of cast.demands) applied.push({ kind: "demand", name: d.history ? (d.title ?? d.name) : d.name, measure: d.measure, by: d.by, ...(d.history ? { history: d.history } : {}) });

  for (const c of cast.cases) {
    applyCase(state, next, c, ctx, applied, rep);
    (rep.cases ??= []).push(c.record);
  }
  const history = (rep.history ??= {});
  for (const h of cast.history) history[h.id] = h.how === "stopped" ? (h.n > 0 ? "stopped" : "moot") : "harsher";
  for (const h of cast.history) {
    if (h.how !== "stopped" || h.n <= 0) continue;
    const ongoing = rep.crimes?.find((c) => c.id === `h:${h.id}` && c.status === "ongoing");
    const ev = historicCrime(h.id);
    if (ongoing) ongoing.status = "stopped";
    if (ev) applied.push({ kind: "crime", crime: ev.kind, by: next.player, who: ev.name, toll: round1(ongoing?.toll ?? 0), result: "stopped", origin: "history" });
  }
  for (const c of cast.crimes) {
    applyCrime(state, next, c, ctx, applied, rep);
    if (c.record.origin === "history" && c.record.status === "done") history[c.record.id.slice(2)] = "done";
  }

  // Rehabilitation: names cleared, the survivors home; the organs lose face and the country breathes easier.
  for (const r of cast.rehab) {
    const ids = new Set(r.cases);
    const cleared = (rep.cases ?? []).filter((c) => ids.has(c.id) && !c.rehabilitated);
    if (!cleared.length) continue;
    rep.cases = (rep.cases ?? []).map((c) => (ids.has(c.id) && !c.rehabilitated ? { ...c, rehabilitated: ctx.to } : c));
    for (const c of cleared) applied.push({ kind: "case", name: c.name, target: c.target, ...(c.title ? { title: c.title } : {}), measure: c.measure, result: "rehabilitated", by: c.by });
    // The crimes of the same rulers are condemned with them.
    const rulers = new Set(cleared.map((c) => c.leader).filter(Boolean));
    for (const crime of rep.crimes ?? []) {
      if (crime.by !== next.player || crime.condemned || crime.status === "refused") continue;
      if (r.by === "player" && !rulers.size) continue;
      crime.condemned = ctx.to;
      applied.push({ kind: "crime", crime: crime.kind, by: crime.by, who: crime.who, toll: round1(crime.toll), result: "condemned", origin: crime.origin });
    }
    unrest(next, -2);
    pillar(next, "elites", 3);
    rep.power = Math.max(0, (rep.power ?? 0) - 10);
  }

  // The organs' power and its danger: their chief grows ambitious and shields his own plots.
  const power = rep.power ?? 0;
  if (power >= 50) {
    const chiefs = ["intelligence", "interior"].map((p) => officialAt(next, p as OfficialPost)).filter((o): o is Official => Boolean(o?.interests));
    const ambition = power >= 75 ? 5 : 4;
    if (chiefs.length) next.officials = next.officials!.map((o) => (chiefs.includes(o) && o.interests!.ambition < ambition ? { ...o, interests: { ...o.interests!, ambition } } : o));
    if (next.politics) next.politics = { ...next.politics, plots: next.politics.plots.map((p) => (p.cabinet && chiefs.some((o) => p.cabinet!.members.includes(o.name)) ? { ...p, strength: Math.min(100, p.strength + Math.round(power / 20)) } : p)) };
  }

  // The player taken: for refusing, as the organs' chief, or as the old terror's executioner.
  if (cast.playerArrested && next.role && next.role.kind !== "leader" && !next.role.fall && next.role.kind === state.role?.kind) {
    fallFrom(next, "arrested", undefined, undefined, { turn: ctx.turn, to: ctx.to }, applied);
    if (cast.playerArrested === "power") rep.power = 25;
  }

  // A fall or a capitulation: the new authorities try the crimes of the old.
  if (applied.some((c) => c.kind === "overthrown" || (c.kind === "capitulation" && c.country === next.player))) {
    for (const crime of rep.crimes ?? []) {
      if (crime.by !== next.player || crime.tried || crime.status === "refused") continue;
      crime.tried = ctx.to;
      applied.push({ kind: "crime", crime: crime.kind, by: crime.by, who: crime.who, toll: round1(crime.toll), result: "tried", origin: crime.origin });
    }
  }

  // A purge's dead are mostly grown men: the country's cohorts carry the scar.
  for (const c of cast.crimes) if (c.record.kind === "purge" && c.record.status !== "refused") scar(next, c.record.by, sumOf(c.dead), ctx.map);

  if (rep.cases && rep.cases.length > MAX_CASES) rep.cases = rep.cases.slice(-MAX_CASES);
  if (rep.crimes && rep.crimes.length > MAX_CRIMES) rep.crimes = rep.crimes.slice(-MAX_CRIMES);
  if (!rep.demands?.length) delete rep.demands;
  if (rep.history && !Object.keys(rep.history).length) delete rep.history;
  next.repressions = rep;
}

/** Men of 25–59 taken out of a country's cohorts (engine/society.ts keeps them as shares of its people). In place. */
function scar(next: GameState, tag: string, dead: number, map: Record<string, MapRegion> | null): void {
  const track = next.society?.[tag];
  const ages = track?.ages;
  if (!ages || dead <= 0 || !map) return;
  let after = 0;
  for (const [id, r] of Object.entries(next.regions)) if (countsFor(r) === tag) after += peopleIn(r, map[id]);
  const before = after + dead;
  if (after <= 0) return;
  const bands = [5, 6, 7, 8, 9, 10, 11];
  const men = bands.reduce((s, b) => s + ages.m[b], 0);
  if (men <= 0) return;
  const k = before / after;
  const m = ages.m.map((v, b) => {
    const count = (v * before) / 100 - (bands.includes(b) ? (dead * v) / men : 0);
    return Math.round(Math.max(0, (count / after) * 100) * 1e4) / 1e4;
  });
  const f = ages.f.map((v) => Math.round(v * k * 1e4) / 1e4);
  const born: [number, number] = [Math.round(ages.born[0] * k * 1e4) / 1e4, Math.round(ages.born[1] * k * 1e4) / 1e4];
  next.society = { ...next.society, [tag]: { ...track, ages: { ...ages, m, f, born } } };
}

// ——— For the interface ———

/** The order a card's button writes, in English: the interface writes its own in the player's language, which the engine reads alike. */
export const orderLine = (measure: RepressionMeasure, name: string) => `${{ arrest: "Arrest", trial: "Put on a show trial:", exile: "Exile", execution: "Execute" }[measure]} ${name}`;

/** How likely a case against a target is to be carried out, for the card's hint: the dice's odds, not the dice. */
export function caseOdds(state: GameState, target: Target, measure: RepressionMeasure): { done: number; martyr: number; blocked: boolean } {
  const regime = regimeNow(state);
  const blocked = regime === "democracy" ? measure !== "arrest" : regime === "limited" && measure === "execution";
  const executor = securityMinister(state) ? undefined : executorFor(state, target);
  const s = state.role?.standing;
  const skill = securityMinister(state) ? 3 + ((s?.means ?? 50) - 50) / 25 : (executor?.competence ?? 3);
  const loyalty = securityMinister(state) ? ((s?.loyalty ?? 50) - 50) / 25 : executor ? standing(executor) - 3 : 0;
  const refuse = executor ? REFUSAL[temperOf(standing(executor))] : 0;
  const done = clamp(MEASURE_BASE[measure] + COMPETENCE_STEP * (skill - 3) + STANDING_STEP * loyalty + 0.15 * (policeState(state) - 0.5) - PROTECTION[target.kind], 0.2, 0.97) * (1 - refuse);
  return { done: Math.round(done * 100) / 100, martyr: Math.round(martyrChance(state, target, measure) * 100) / 100, blocked };
}

/** Whether the player may order repressions at all: as the leader, or as a minister of the security services. */
export const mayRepress = (state: GameState): boolean => inPlay(state) && (leads(state) || securityMinister(state));

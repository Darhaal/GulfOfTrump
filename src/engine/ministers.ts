import { ADVISOR_POST, ADVISOR_TITLES, ADVISORS, forNew, type AdvisorId } from "./advisors";
import { isNewMinistry } from "./ministries";
import { placeOrders, sanitizeOrders } from "./arsenal";
import { addStep } from "./calendar";
import { roll } from "./dice";
import { budgetNorms, debtNorm, deficitOf, formatMoney, limitChange, cabinetUpkeep, otherNorm, STEP_YEARS } from "./economy";
import { interestOf } from "./crises";
import { beginPlants, ministerPlants } from "./energy";
import { MAX_TILT, tiltOf } from "./development";
import { officialAt } from "./government";
import { MINISTRY_OF } from "./interests";
import { cabinetPlots, factionEn, factionOf, factionsOf, leanOf, standing, temperOf, withFavour, type Faction } from "./intrigue";
import { samePerson } from "./people";
import { alliesOf, enemiesOf, isMilitary, tieOf } from "./relations";
import { directionView, shiftShares } from "./research";
import { aheadOf } from "./researchEffects";
import { isOpposition } from "./role";
import { MAX_SHARE, spaceActive, startShareOf } from "./space";
import { ownProtests } from "./unrest";
import type { ResourceType } from "./resources";
import {
  RESEARCH_DIRECTIONS,
  type AppliedChange,
  type ArmsType,
  type Budget,
  type ChronicleEntry,
  type EnergySource,
  type GameState,
  type Official,
  type ResearchDirection,
  type RoutineAct,
  type RoutineHeld,
  type SpaceFocus,
  type SpaceMilestone,
  type WeaponKind,
} from "./types";

/**
 * Ministers who work every turn. Each minister of the cabinet does his
 * ministry's routine on his own, unasked: the economy minister keeps the
 * budget and the debt within the era's norms, the foreign minister tends the
 * country's ties, answers the notes and keeps its treaties, the interior
 * minister keeps order and watches the opposition, the chief of staff sets
 * the agenda and keeps the cabinet together, the general staff runs the
 * fronts and the army's routine, intelligence its networks, the science
 * minister the research split, industry the arms orders, the power plants
 * the demand for electricity calls for and the stores the people's
 * provision draws on, the head of the space programme its share and
 * focus.
 *
 * The engine decides what each may do: a small menu of routine acts per
 * ministry, within its means, one of which it picks by what the turn holds,
 * the minister's causes and character. His competence sets how well it is
 * done and the chance he botches it; a disloyal minister serves his faction
 * rather than the government. As the plans of governments abroad
 * (engine/intentions.ts), the acts are cast before the turn is written –
 * seeded and pure, so the game master can tell what came of them and a turn
 * played again does the same – and applied by the engine with the turn.
 *
 * The government's word comes first: a minister with a standing directive,
 * an order of the turn in his field, or his lever set by the government's own
 * hand since the last turn does nothing of his own; one told to act only on
 * orders never does. When the player holds a post, the engine never acts for it.
 */

/** Each ministry's routine acts, by id: the record's and the interface's words for them. */
export const ROUTINE: Record<AdvisorId, readonly string[]> = {
  chief: ["agenda", "cabinet", "image", "office", "clique"],
  foreign: ["renew", "remind", "notes", "protest", "tend", "ease", "firm", "embassies"],
  interior: ["police", "crackdown", "watch", "calm", "patrol", "lenient"],
  military: ["press", "hold", "alert", "drill"],
  intelligence: ["network", "elites", "files"],
  finance: ["balance", "invest", "steady", "army", "social", "apparatus"],
  industry: ["arms", "stores", "power", "plants", "heavy", "light"],
  science: ["split", "lobby", "steady"],
  space: ["share", "focus", "steady"],
  // A ministry the government created keeps to the portfolio it was given: no routine of its own (engine/ministries.ts).
  ...forNew([] as readonly string[]),
};

/**
 * What an order of the turn is about, by ministry, in the three languages:
 * an order in a minister's field is his to carry out, and he does nothing of
 * his own beside it that turn.
 */
const FIELD: Record<AdvisorId, RegExp> = {
  chief: /cabinet|reshuffl|appoint|chief of staff|кабинет|кабінет|назнач|признач|перестанов|администрац|адміністрац/i,
  foreign: /foreign minist|ambassador|embass|diplomat|treat(y|ies)|\bnote\b|relations with|посол|посольств|дипломат|договор|договір|\bнот[аеуы]\b|отношени|відносин|\bмид\b|\bмзс\b/i,
  interior: /police|protest|strike|riot|opposition|arrest|censor|interior minist|demonstrat|полици|поліці|милици|міліці|протест|забастов|страйк|бунт|оппозиц|опозиц|арест|арешт|цензур|митинг|мітинг|демонстрац|\bмвд\b|\bмвс\b/i,
  military: /\barm(y|ies)\b|front|offensiv|attack|defen[cs]|troops|mobili[sz]|division|general staff|military|арми|армі|фронт|наступ|атак|оборон|войск|військ|мобилиз|мобіліз|дивизи|дивізі|генштаб/i,
  intelligence: /intelligence|\bspy\b|spies|espionage|\bagents?\b|covert|разведк|розвідк|шпион|шпигун|агент/i,
  finance: /budget|\btax|debt|deficit|spending|loan|currency|inflation|financ|бюджет|налог|подат|долг|борг|дефицит|дефіцит|расход|видат|кредит|займ|позик|валют|инфляц|інфляц|финанс|фінанс/i,
  industry: /industr|factor(y|ies)|\bplants?\b|production|arms order|weapons|\btanks?\b|munition|provision|\bfood\b|\bfuel\b|\bgrain\b|промышлен|промисл|завод|фабрик|производств|виробництв|вооружени|озброєнн|танк|боеприпас|боєприпас|продовольств|продовольч|хлеб|хліб|топлив|палив|снабжени|постачанн/i,
  science: /research|science|scientist|laborator|academy|наук|исследова|дослідж|учён|учен|вчен|лаборатор|академи|академі/i,
  space: /\bspace\b|rocket|satellite|launch|cosmodrome|orbit|космос|космич|космічн|ракет|спутник|супутник|запуск|космодром|орбит|орбіт/i,
  ...forNew(/(?!)/),
};

/** Traits that make a minister bold or careful, in the three languages the model writes them in. */
const BOLD = /bold|reckless|decisive|aggressive|impulsive|ruthless|hot-headed|energetic|решител|рішуч|безрассуд|авантюр|импульсив|імпульсив|агрессив|агресив|жёстк|жестк|жорстк|беспощад|нещад|энергичн|енергійн/i;
const CAUTIOUS = /cautious|careful|prudent|wary|timid|conservative|осторож|обережн|осмотрит|розважлив|расчётлив|расчетлив|робк|нерешител|нерішуч|консерватив/i;

/** How well a minister of each competence (1–5) does his work: the share of a full act he achieves. */
const QUALITY = [0.55, 0.7, 0.85, 1, 1.15];
/** The chance a month that a minister of each competence (1–5) botches his routine. */
const BUNGLE_MONTH = [0.1, 0.05, 0.025, 0.012, 0.005];
/** What the chief of staff's agenda adds to the ministry he puts first: quality, and less chance of a botch. */
const AGENDA_QUALITY = 0.15;
const AGENDA_BUNGLE = 0.7;
/** A restive minister (engine/intrigue.ts temperOf) works with less zeal. */
const RESTIVE_QUALITY = 0.1;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round2 = (v: number) => Math.round(v * 100) / 100;
const game = (state: Pick<GameState, "seed" | "id">) => state.seed ?? state.id;
/** A whole number from a fraction, rounded up with the chance of its fraction: right on average whatever the length of the turn. */
const dither = (v: number, r: number) => {
  const sign = v < 0 ? -1 : 1;
  const a = Math.abs(v);
  const f = Math.floor(a);
  return sign * (f + (r < a - f ? 1 : 0));
};
/** The share of a whole act a period of `years` achieves: a full one over a quarter or longer, a share of it over a week or a month. */
const span = (years: number) => clamp(years * 4, 0, 1);
/** The interior minister's watch on an underground: what it adds to the period's blows on it (engine/partyLife.ts repression), half as much again for a hard-liner. */
const WATCH_BLOW = 0.3;

/** The interior minister's watch on the outlawed parties this period, by party, for party life's wear-down. */
export function watchedParties(cast: readonly RoutineCast[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of cast) for (const fx of c.effects) if (fx.kind === "party") out[fx.id] = (out[fx.id] ?? 0) + fx.repression;
  return out;
}

/** What a cast act does to the state, applied with the turn. */
export type RoutineEffect =
  | { kind: "budget"; delta: Partial<Budget> }
  | { kind: "split"; tilt: number }
  | { kind: "tie"; who: string; trust?: number; tension?: number }
  | { kind: "renew"; alliance: string; until: string }
  | { kind: "protest"; id: string; size: number; organisation?: number }
  | { kind: "unrest"; delta: number }
  | { kind: "plot"; id: string }
  /** The interior minister's watch on an outlawed party: what it adds to the period's blows party life weighs (engine/partyLife.ts). */
  | { kind: "party"; id: string; repression: number }
  | { kind: "favour"; name: string; delta: number }
  | { kind: "train"; men: number }
  | { kind: "watch"; tag: string }
  | { kind: "research"; direction: ResearchDirection; shift: number; from?: ResearchDirection }
  | { kind: "arms"; type: ArmsType | WeaponKind; n: number }
  | { kind: "stores"; resource: ResourceType; months: number; cost: number }
  | { kind: "power"; source: EnergySource; gw: number }
  | { kind: "reserves"; delta: number }
  | { kind: "space"; share?: number; focus?: SpaceFocus; setback?: SpaceMilestone; work?: number };

/** One minister's turn as the engine cast it: the record, what it does, and its line for the game master. */
export interface RoutineCast {
  act: RoutineAct;
  effects: RoutineEffect[];
  en: string;
}

/** A minister at work this turn: who he is and how he works. */
interface Hand {
  ministry: AdvisorId;
  person: Official;
  causes: string[];
  /** How much of a full act he achieves. */
  q: number;
  /** He botches it this turn. */
  bungle: boolean;
  /** Disloyal: the faction he serves, by id, and its kind. */
  serves?: string;
  lean?: string;
  bold: boolean;
  cautious: boolean;
  /** A roll of this minister's dice this turn. */
  r: (key: string) => number;
}

/** What a ministry's act comes to before it is recorded. */
interface Pick_ {
  act: string;
  target?: string;
  amount?: number;
  effects: RoutineEffect[];
  en: string;
  /** Set when the act was the faction's, not the government's. */
  faction?: string;
  /** He botched it. */
  bungled?: boolean;
}

const fightingOf = (state: Pick<GameState, "wars" | "date">, tag: string) =>
  state.wars.some((w) => (w.attackers.includes(tag) || w.defenders.includes(tag)) && !(w.truce && w.truce.until > state.date));

const nameEn = (state: Pick<GameState, "countries">, tag: string) => {
  const n = state.countries[tag]?.name;
  return typeof n === "string" ? n : (n?.en ?? tag);
};

/** Whether the ministers work for the player's government this turn: it stands, and the player does not oppose it. */
function inPlay(state: GameState): boolean {
  if (isOpposition(state)) return false;
  if (state.defeat && !state.defeat.continued) return false;
  return Boolean(state.countries[state.player]?.economy);
}

/** The ministry the player holds when playing a minister: the engine never acts for it. */
function playerMinistry(state: GameState): AdvisorId | undefined {
  return state.role?.kind === "minister" && state.role.post ? MINISTRY_OF[state.role.post] : undefined;
}

/**
 * The deficit the economy minister lets run, interest included, share of GDP: three points while the debt is within the
 * era's norm, none past it; his causes and a war move it – a war five points more while the debt is within the norm,
 * three within twice it, one past that: a careful minister cuts or taxes even at war once the debt has run away.
 */
function allowedDeficit(state: GameState, causes: string[]): number {
  const e = state.countries[state.player]?.economy;
  if (!e) return 0;
  const debt = e.debt / Math.max(0.01, e.gdp);
  const norm = debtNorm(state.scenarioId);
  let allowed = debt > norm ? 0 : 0.03;
  // A deficit the government chose with its own budget is one he lets run.
  const chosen = state.ministers?.set?.deficit;
  if (causes.includes("balance")) allowed = Math.min(allowed, 0.01);
  if (causes.includes("prices")) allowed = Math.min(allowed, 0.02);
  if (causes.includes("growth")) allowed += 0.02;
  if (fightingOf(state, state.player)) allowed += debt <= norm ? 0.05 : debt <= 2 * norm ? 0.03 : 0.01;
  return chosen !== undefined ? Math.max(allowed, chosen) : allowed;
}

/** The deficit as the crises and the panel measure it – interest and spending outside the budget included – share of GDP. */
function deficitShare(state: GameState): number {
  const e = state.countries[state.player]?.economy;
  if (!e) return 0;
  return deficitOf(e, interestOf(e, state.scenarioId)) / Math.max(0.01, e.gdp);
}

/** The deficit beyond what a minister lets run, share of GDP; negative when there is room. */
function deficitGap(state: GameState, causes: string[]): number {
  return deficitShare(state) - allowedDeficit(state, causes);
}

/** The ministry the turn presses most on, for the chief of staff's agenda: a war, the street, the books, a threat abroad. */
export function pressingMinistry(state: GameState): AdvisorId | undefined {
  const me = state.player;
  if (fightingOf(state, me)) return "military";
  if (ownProtests(state.protests, me).length || (state.politics?.unrest ?? 0) >= 50) return "interior";
  if (deficitGap(state, []) > 0.01) return "finance";
  if ((state.plans ?? []).some((p) => !p.end && p.kind === "war" && p.target === me && (p.stage === "decision" || p.stage === "preparation" || p.stage === "action"))) return "foreign";
  return undefined;
}

/** Why a minister does nothing of his own this turn, if he does not. */
export function heldBy(state: GameState, ministry: AdvisorId, orders: readonly string[]): RoutineHeld | undefined {
  if (state.ministers?.onOrders?.includes(ministry)) return "toggle";
  if ((state.directives ?? []).some((d) => d.ministry === ministry)) return "directive";
  if (orders.some((o) => FIELD[ministry].test(o))) return "orders";
  if (handOn(state, ministry)) return "hand";
  return undefined;
}

/** Whether the government set a minister's lever with its own hand since the last turn: the budget, the research split, the space programme. */
function handOn(state: GameState, ministry: AdvisorId): boolean {
  if (ministry === "finance") return Boolean(state.budgetSet);
  if (ministry === "science") {
    const shares = state.research?.shares;
    const was = state.ministers?.left?.research ?? state.research?.base;
    return Boolean(shares && was && RESEARCH_DIRECTIONS.some((d) => shares[d] !== was[d]));
  }
  if (ministry === "space") {
    const p = state.space?.programmes[state.player];
    if (!p) return false;
    const was = state.ministers?.left?.space ?? { share: startShareOf(state.scenarioId, state.player) ?? p.share, focus: "balanced" as SpaceFocus };
    return p.share !== was.share || (p.focus ?? "balanced") !== was.focus;
  }
  return false;
}

/** The ministers who act this turn: in post, not the player, the head of the space programme only while there is one. */
function ministersInPost(state: GameState): [AdvisorId, Official][] {
  const mine = playerMinistry(state);
  const self = state.role && state.role.kind !== "leader" ? state.role.person?.name : undefined;
  return ADVISORS.flatMap((m): [AdvisorId, Official][] => {
    if (m === mine) return [];
    if (m === "space" && !spaceActive(state)) return [];
    // A ministry the government created has no routine acts of its own.
    if (isNewMinistry(m)) return [];
    const o = officialAt(state, ADVISOR_POST[m]);
    if (!o || (self && samePerson(self, o.name))) return [];
    return [[m, o]];
  });
}

/** A minister at work: his quality, whether he botches it this turn, and whom he serves. */
function handOf(state: GameState, ministry: AdvisorId, person: Official, factions: Faction[], boosted: boolean): Hand {
  const competence = clamp(Math.round(person.competence), 1, 5);
  const traits = person.traits.join(" ");
  const bold = BOLD.test(traits);
  const cautious = !bold && CAUTIOUS.test(traits);
  const temper = temperOf(standing(person));
  const months = Math.max(0.25, STEP_YEARS[state.step] * 12);
  const perMonth = BUNGLE_MONTH[competence - 1] * (bold ? 1.3 : cautious ? 0.7 : 1) * (boosted ? AGENDA_BUNGLE : 1);
  const r = (key: string) => roll(game(state), state.turn, `routine:${ministry}:${person.name}:${key}`);
  const bungle = r("bungle") < 1 - (1 - clamp(perMonth, 0, 0.95)) ** months;
  const q = (QUALITY[competence - 1] + (boosted ? AGENDA_QUALITY : 0) - (temper === "restive" ? RESTIVE_QUALITY : 0)) * (bold ? 1.15 : cautious ? 0.85 : 1);
  let serves: string | undefined;
  let lean: string | undefined;
  if (temper === "disloyal") {
    const f = factionOf(factions, person.name);
    serves = f?.id ?? leanOf({ name: person.name, post: person.post, ministry, person });
    lean = f?.kind ?? serves;
  }
  return { ministry, person, causes: person.interests?.agenda ?? [], q, bungle, serves, lean, bold, cautious, r };
}

// ——— Each ministry's menu ———

type Menu = (state: GameState, h: Hand) => Pick_;

const has = (h: Hand, ...causes: string[]) => causes.some((c) => h.causes.includes(c));
/** The option a minister takes: the best score, with a little of his own dice between options that score alike. */
const best = (h: Hand, options: (Pick_ & { score: number })[]): Pick_ => options.map((o) => ({ o, s: o.score + 0.3 * h.r(`pick:${o.act}`) })).sort((a, b) => b.s - a.s)[0].o;
const leans = (h: Hand, ...kinds: string[]) => Boolean(h.lean && kinds.includes(h.lean));

/** The economy minister keeps the budget and the debt within the era's norms; a disloyal one moves money to his faction's line. */
const finance: Menu = (state, h) => {
  const e = state.countries[state.player]!.economy!;
  const gdp = Math.max(0.01, e.gdp);
  const years = STEP_YEARS[state.step];
  const atWar = fightingOf(state, state.player);
  const pace = 1 - Math.exp(-years / 0.5);
  if (h.serves) {
    // Money moved to the faction's line, from the lines it cares least for, until the line stands well above its usual share.
    const amount = round2(gdp * 0.004 * pace * h.q * 2);
    const to: keyof Budget = leans(h, "hawks") ? "army" : leans(h, "doves", "party") ? "social" : leans(h, "reformers") ? "industry" : "other";
    const from: (keyof Budget)[] = to === "army" ? ["social", "industry"] : to === "social" ? (atWar ? ["other", "industry"] : ["army", "other"]) : to === "industry" ? ["other", "army"] : ["social", "industry"];
    const norms = budgetNorms(state, state.player, null);
    const cap = { army: 0.1, social: norms.social * 1.5, industry: norms.industry * 1.5, other: norms.other * 1.3, revenue: 1 }[to] * gdp;
    if (amount >= 0.01 && e.budget[to] + amount <= cap && from.every((l) => e.budget[l] >= amount)) {
      const delta: Partial<Budget> = { [to]: amount };
      for (const line of from) delta[line] = -round2(amount / from.length);
      const act = to === "army" ? "army" : to === "social" ? "social" : to === "industry" ? "invest" : "apparatus";
      return { act, amount, effects: [{ kind: "budget", delta }], en: `moved ${formatMoney(amount)} a year into the ${to} line from ${from.join(" and ")}, for ${factionEn(h.serves)}`, faction: h.serves };
    }
  }
  const gap = deficitGap(state, h.causes);
  if (gap > 0.003) {
    const amount = round2(Math.min(gap, gap * pace * h.q) * gdp);
    if (amount >= 0.01) {
      if (h.bungle) {
        // The cut fell on the people: all of it from the social line.
        const cut = round2(Math.min(amount, e.budget.social * 0.5));
        return { act: "balance", amount: cut, effects: [{ kind: "budget", delta: { social: -cut } }], bungled: true, en: `meant to narrow the deficit but botched it: the whole cut of ${formatMoney(cut)} a year fell on the social line – pensions, schools and hospitals` };
      }
      const norms = budgetNorms(state, state.player, null);
      const taxRoom = Math.max(0, norms.taxes * gdp - e.budget.revenue);
      const fromTaxes = round2(Math.min(amount / 2, taxRoom));
      const cut = amount - fromTaxes;
      // The lines he trims, by weight: never the army in a war, nor industry for a minister of growth; the people's line last; a competent one keeps the state's upkeep at its norm.
      const weights: Partial<Record<keyof Budget, number>> = { other: 1, industry: has(h, "growth", "industry") ? 0 : 1, social: 0.5, army: atWar ? 0 : 1 };
      const keepOther = h.q >= 0.85 ? otherNorm(e, state.scenarioId, cabinetUpkeep(state, state.player)) * gdp : 0;
      const room = (line: keyof Budget) => Math.max(0, e.budget[line] - (line === "other" ? keepOther : 0));
      const total = (Object.keys(weights) as (keyof Budget)[]).reduce((s, l) => s + (weights[l] ?? 0) * room(l), 0);
      const delta: Partial<Budget> = {};
      if (fromTaxes > 0) delta.revenue = fromTaxes;
      if (total > 0 && cut > 0) for (const l of Object.keys(weights) as (keyof Budget)[]) {
        const part = round2(Math.min(room(l), (cut * (weights[l] ?? 0) * room(l)) / total));
        if (part > 0) delta[l] = -part;
      }
      return { act: "balance", amount, effects: [{ kind: "budget", delta }], en: `narrowed the deficit by ${formatMoney(amount)} a year${fromTaxes > 0 ? ` (${formatMoney(fromTaxes)} of it in taxes)` : ""} to keep it within the era's norm and the debt in hand` };
    }
  }
  const debt = e.debt / gdp;
  if (gap < -0.02 && debt < debtNorm(state.scenarioId) && has(h, "growth", "industry", "openness")) {
    const amount = round2(Math.min(-gap / 2, 0.004) * gdp * pace * h.q * 2);
    if (amount >= 0.01) {
      if (h.bungle) return { act: "invest", amount: 0, bungled: true, effects: [{ kind: "reserves", delta: -round2(amount / 2) }], en: `meant to put more into industry but the money went astray: ${formatMoney(amount / 2)} of the reserves lost to waste` };
      return { act: "invest", amount, effects: [{ kind: "budget", delta: { industry: amount } }], en: `put ${formatMoney(amount)} a year more into industry, with room in the budget and the debt low` };
    }
  }
  // What he says is what is true: the deficit with its interest and the debt against the era's norm.
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const norm = debtNorm(state.scenarioId);
  const figures = `the deficit ${pct(Math.max(0, deficitShare(state)))} of GDP with its interest, the debt ${pct(debt)} against the era's norm of ${pct(norm)}`;
  if (debt <= norm) return { act: "steady", effects: [], en: `kept the budget as it stands: ${figures} – both within the era's norms` };
  return { act: "steady", effects: [], en: `kept the budget as it stands, the deficit within what he allows${atWar ? " at war" : ""}, but the debt is past the norm: ${figures}${debt > 2 * norm ? " – lenders will soon ask more than the state can pay" : ""}` };
};

/** The foreign minister keeps the treaties, answers the notes and tends the country's ties; a hard-liner holds a firm line. */
const foreign: Menu = (state, h) => {
  const me = state.player;
  const to = addStep(state.date, state.step);
  const years = STEP_YEARS[state.step];
  const yearOn = `${Number(to.slice(0, 4)) + 1}${to.slice(4)}`;
  const enemies = enemiesOf(state, me);
  const courses = Object.values(state.countries).filter((c) => c.course && c.tag !== me && !c.dormant && !c.exile);
  const ally = alliesOf(state, me);
  // Treaties of friendship with one country, not the conventions many sign (Montreux, an occupation regime).
  const pacts = new Set(state.alliances.filter((a) => a.kind === "pact" && a.members.length === 2 && a.members.includes(me)).flatMap((a) => a.members.filter((m) => m !== me)));
  const options: (Pick_ & { score: number })[] = [];

  // A treaty running out within a year: a bilateral pact or trade treaty he renews for its term; a military one, or a bloc's, he puts before the leader.
  for (const a of state.alliances) {
    if (!a.until || !a.members.includes(me) || a.until > yearOn || a.until < state.date) continue;
    const others = a.members.filter((m) => m !== me);
    const friendly = others.every((m) => !enemies.has(m) && tieOf(state, m, me).trust >= -10);
    if (!isMilitary(a) && others.length === 1 && friendly) {
      const term = clamp(Number(a.until.slice(0, 4)) - Number(a.since.slice(0, 4)), 1, 10);
      const until = `${Number(a.until.slice(0, 4)) + term}${a.until.slice(4)}`;
      options.push({ act: "renew", target: others[0], amount: term, effects: [{ kind: "renew", alliance: a.id, until }], en: `renewed the treaty with ${nameEn(state, others[0])} for ${term} more years, to ${until}`, score: 5 });
    } else if (friendly) {
      options.push({ act: "remind", target: others[0], effects: [], en: `put before the leader the ${typeof a.name === "string" ? a.name : a.name.en}, which runs out on ${a.until}: renewing it is the leader's word`, score: 3 });
    }
  }

  // The notes of the period: an incident against the country last turn, a government that threatens it.
  const last = state.chronicle.at(-1);
  const incident = last?.applied.find((c): c is Extract<AppliedChange, { kind: "incident" }> => c.kind === "incident" && c.target === me && !enemies.has(c.by));
  const threat = (state.plans ?? []).find((p) => !p.end && p.target === me && (p.kind === "war" || p.kind === "sanction") && (p.stage === "tension" || p.stage === "decision") && !enemies.has(p.by));
  const noteFrom = incident?.by ?? threat?.by;
  if (noteFrom && state.countries[noteFrom]) {
    if (has(h, "hardline") || h.bold || leans(h, "hawks", "hardliners")) {
      const raise = dither(3 * span(years), h.r("protest"));
      options.push({ act: "protest", target: noteFrom, effects: raise ? [{ kind: "tie", who: noteFrom, tension: raise }] : [], en: `answered ${nameEn(state, noteFrom)}'s note with a firm protest, conceding nothing`, score: 4 });
    } else {
      const ease = dither(6 * h.q * span(years), h.r("notes"));
      options.push({ act: "notes", target: noteFrom, amount: ease, effects: ease ? [{ kind: "tie", who: noteFrom, tension: -ease }] : [], en: `answered ${nameEn(state, noteFrom)}'s note calmly, through the usual channels, and took the heat out of it`, score: 4 + (has(h, "neutral", "trade", "prestige") ? 0.5 : 0) });
    }
  }

  // Ties to tend: the ally or partner that trusts the country least, short of one that has turned hostile.
  const partners = courses.filter((c) => (ally.has(c.tag) || pacts.has(c.tag)) && !enemies.has(c.tag) && tieOf(state, c.tag, me).trust > -20);
  const coolest = [...partners].sort((a, b) => tieOf(state, a.tag, me).trust - tieOf(state, b.tag, me).trust || a.tag.localeCompare(b.tag))[0];
  if (coolest && tieOf(state, coolest.tag, me).trust < 60) {
    const gain = dither(10 * years * h.q, h.r("tend"));
    options.push({ act: "tend", target: coolest.tag, amount: gain, effects: gain ? [{ kind: "tie", who: coolest.tag, trust: gain }] : [], en: `tended the ties with ${nameEn(state, coolest.tag)}: visits, letters and the small courtesies between partners`, score: 2 + (has(h, "allies", "prestige") ? 1 : 0) });
  }
  // A rival to calm, or to face down: the most tense, then the most distrustful.
  const rivals = courses
    .filter((c) => !enemies.has(c.tag) && !ally.has(c.tag) && !pacts.has(c.tag))
    .sort((a, b) => tieOf(state, b.tag, me).tension - tieOf(state, a.tag, me).tension || tieOf(state, a.tag, me).trust - tieOf(state, b.tag, me).trust || a.tag.localeCompare(b.tag));
  const rival = rivals[0];
  const tension = rival ? tieOf(state, rival.tag, me).tension : 0;
  const distrust = rival ? -tieOf(state, rival.tag, me).trust : 0;
  if (rival && tension >= 30 && !has(h, "hardline")) {
    const ease = dither(20 * years * h.q, h.r("ease"));
    options.push({ act: "ease", target: rival.tag, amount: ease, effects: ease ? [{ kind: "tie", who: rival.tag, tension: -ease }] : [], en: `worked quietly to ease the tension with ${nameEn(state, rival.tag)}`, score: 1.5 + tension / 50 + (has(h, "neutral", "trade") ? 1 : 0) - (h.bold ? 0.5 : 0) });
  }
  if (rival && (tension >= 15 || distrust >= 30) && (has(h, "hardline") || leans(h, "hawks", "hardliners"))) {
    const raise = dither(12 * years * h.q, h.r("firm"));
    options.push({ act: "firm", target: rival.tag, amount: raise, effects: raise ? [{ kind: "tie", who: rival.tag, tension: raise }] : [], en: `held a firm line with ${nameEn(state, rival.tag)}: no concessions, sharp words in public`, score: has(h, "hardline") ? 3 : 1 });
  }
  options.push({ act: "embassies", effects: [], en: "kept the embassies at their work: nothing abroad called for more", score: 0 });

  let chosen: Pick_ = best(h, options);
  if (h.serves) {
    // A disloyal minister serves his faction: a firm line for the hawks, easing for the doves.
    const want = leans(h, "hawks", "hardliners", "security") ? ["firm", "protest"] : leans(h, "doves", "reformers") ? ["ease", "notes", "tend"] : ["tend", "notes"];
    const theirs = options.find((o) => want.includes(o.act));
    if (theirs) chosen = { ...theirs, faction: h.serves, en: `${theirs.en}, as ${factionEn(h.serves)} would have it` };
  }
  if (h.bungle) {
    const who = chosen.target && state.countries[chosen.target] ? chosen.target : (coolest?.tag ?? rival?.tag);
    if (who) return { act: chosen.act, target: who, effects: [{ kind: "tie", who, trust: -3, tension: 3 }], bungled: true, en: `botched it: a gaffe in the talks with ${nameEn(state, who)} cost the country some of its trust`, faction: chosen.faction };
  }
  return chosen;
};

/** The interior minister keeps order in the street and watches the opposition; a hard-liner cracks down. */
const interior: Menu = (state, h) => {
  const years = STEP_YEARS[state.step];
  const me = state.player;
  const protests = ownProtests(state.protests, me).filter((p) => p.size > 0).sort((a, b) => b.size - a.size || a.id.localeCompare(b.id));
  const unrest = state.politics?.unrest ?? 0;
  const hard = has(h, "order", "police") || h.bold || leans(h, "security", "hardliners");
  const options: (Pick_ & { score: number })[] = [];
  const top = protests[0];
  if (top) {
    const cut = (hard ? 0.3 : 0.15) * h.q * span(years);
    const effects: RoutineEffect[] = [{ kind: "protest", id: top.id, size: round2(1 - cut), organisation: -Math.round((hard ? 10 : 5) * h.q * span(years)) }];
    if (hard) effects.push({ kind: "unrest", delta: dither(2 * span(years), h.r("hard")) });
    options.push({ act: hard ? "crackdown" : "police", target: top.title, amount: Math.round(cut * 100), effects, en: hard ? `sent the police in hard against "${top.title}": arrests, dispersals, the leaders hunted` : `policed "${top.title}" within the law: the crowds kept apart, the ringleaders charged`, score: 4 + (has(h, "order", "police") ? 1 : 0) });
  }
  // Watching the opposition: a banned party's cells broken up, and a chance to learn of a plot the government does not know of.
  const banned = (state.politics?.parties ?? []).filter((p) => (p.status === "banned" || p.status === "underground") && (p.strength ?? 0) > 0).sort((a, b) => (b.strength ?? 0) - (a.strength ?? 0))[0];
  const hidden = (state.politics?.plots ?? []).filter((p) => !p.known && !p.cabinet && (p.kind === "protest" || p.kind === "strike" || p.kind === "insurgency" || p.kind === "sabotage"));
  const effects: RoutineEffect[] = [];
  let en = "watched the opposition: informers, files, the party offices";
  if (banned) {
    // The police state's own work on the underground: it adds to the period's blows party life weighs (engine/partyLife.ts), not a cut of its own on top.
    const repression = Math.round(clamp(WATCH_BLOW * h.q * (hard ? 1.5 : 1), 0, 0.5) * 100) / 100;
    if (repression > 0) effects.push({ kind: "party", id: banned.id, repression });
    en = `watched the opposition and broke up cells of ${banned.name}`;
  }
  if (hidden.length && h.r("uncover") < 0.35 * h.q * span(years)) {
    effects.push({ kind: "plot", id: hidden[0].id });
    en += `, and uncovered "${hidden[0].title}"`;
  }
  options.push({ act: "watch", target: banned?.name, effects, en, score: 2 + (banned ? 1 : 0) + (has(h, "police", "press") ? 1 : 0) });
  if (unrest >= 35 && !top) {
    const calm = dither(8 * years * h.q, h.r("calm"));
    options.push({ act: "calm", amount: calm, effects: calm ? [{ kind: "unrest", delta: -calm }] : [], en: "kept the country calm: patrols in the towns, a word with the editors, grievances heard", score: 1 + unrest / 25 + (has(h, "votes", "lawful") ? 1 : 0) });
  }
  options.push({ act: "patrol", effects: [], en: "kept the usual order: nothing at home called for more", score: 0.5 });

  let chosen: Pick_ = best(h, options);
  if (h.serves) {
    if (leans(h, "doves", "reformers")) {
      chosen = { act: "lenient", target: top?.title, effects: [], en: `looked away${top ? ` from "${top.title}"` : ""}: the police kept to their barracks, as ${factionEn(h.serves)} would have it`, faction: h.serves };
    } else if (leans(h, "security", "hardliners")) {
      const hardOne = options.find((o) => o.act === "crackdown" || o.act === "watch");
      if (hardOne) chosen = { ...hardOne, faction: h.serves, en: `${hardOne.en}, harder than the government asked, for ${factionEn(h.serves)}` };
    }
  }
  if (h.bungle) {
    if (top) return { act: chosen.act, target: top.title, effects: [{ kind: "protest", id: top.id, size: 1.15 }, { kind: "unrest", delta: 2 }], bungled: true, en: `botched it: a heavy hand at "${top.title}" made the crowds bigger and the country angrier`, faction: chosen.faction };
    return { act: chosen.act, effects: [{ kind: "unrest", delta: 1 }], bungled: true, en: "botched it: a clumsy arrest made the papers and stirred the country up", faction: chosen.faction };
  }
  return chosen;
};

/** The chief of staff sets the agenda and keeps the cabinet together; a disloyal one favours his own clique. */
function chief(state: GameState, h: Hand, pressing: AdvisorId | undefined, ministers: [AdvisorId, Official][], factions: Faction[]): Pick_ {
  const years = STEP_YEARS[state.step];
  const plotters = new Set(cabinetPlots(state).flatMap((p) => p.cabinet.members));
  const others = ministers.filter(([m, o]) => m !== "chief" && !plotters.has(o.name)).map(([, o]) => o);
  const lowest = [...others].sort((a, b) => standing(a) - standing(b) || a.name.localeCompare(b.name))[0];
  const unrest = state.politics?.unrest ?? 0;
  const options: (Pick_ & { score: number })[] = [];
  if (pressing) options.push({ act: "agenda", target: pressing, effects: [], en: `put ${ADVISOR_TITLES[pressing].en.toLowerCase()}'s business first on the leader's agenda`, score: 3 + (has(h, "reform", "apparatus") ? 1 : 0) });
  if (lowest && standing(lowest) < 3) {
    const delta = dither(20 * years * h.q, h.r("cabinet")) / 10;
    options.push({ act: "cabinet", target: lowest.name, amount: delta, effects: delta ? [{ kind: "favour", name: lowest.name, delta }] : [], en: `kept the cabinet together: smoothed things over with ${lowest.name}`, score: 2 + (3 - standing(lowest)) + (has(h, "apparatus", "loyalists", "calm") ? 1 : 0) });
  }
  if (unrest >= 25) {
    const calm = dither(5 * years * h.q, h.r("image"));
    options.push({ act: "image", amount: calm, effects: calm ? [{ kind: "unrest", delta: -calm }] : [], en: "looked after the leader's image: appearances, the newsreels, a good word in the press", score: 1 + unrest / 30 + (has(h, "ratings") ? 2 : 0) });
  }
  options.push({ act: "office", effects: [], en: "ran the leader's office: papers, appointments, the day's business", score: 0.5 });
  let chosen: Pick_ = best(h, options);
  if (h.serves) {
    const mine = ministers.map(([, o]) => o).filter((o) => o.name !== h.person.name && factionOf(factions, o.name)?.id === h.serves).sort((a, b) => standing(a) - standing(b) || a.name.localeCompare(b.name))[0];
    if (mine) {
      const delta = dither(20 * years, h.r("clique")) / 10;
      chosen = { act: "clique", target: mine.name, amount: delta, effects: delta ? [{ kind: "favour", name: mine.name, delta }] : [], en: `favoured his own people: pushed ${mine.name}'s case with the leader, for ${factionEn(h.serves)}`, faction: h.serves };
    }
  }
  if (h.bungle && lowest) return { act: chosen.act, target: lowest.name, effects: [{ kind: "favour", name: lowest.name, delta: -1 }], bungled: true, en: `botched it: a slight in the leader's office offended ${lowest.name}`, faction: chosen.faction };
  return chosen;
}

/**
 * The general staff's line in the player's wars, for its formations (engine/formations.ts): pressing (attack wherever the
 * odds allow) or holding (attack only where they are overwhelming), as the routine below tells it. None when the staff is
 * held to the government's word, no one is in post, or the government does not stand: the formations keep their tasks.
 */
export function staffLine(state: GameState, orders: readonly string[] = []): "press" | "hold" | undefined {
  if (!inPlay(state) || playerMinistry(state) === "military" || heldBy(state, "military", orders)) return undefined;
  const person = officialAt(state, ADVISOR_POST.military);
  if (!person) return undefined;
  const h = handOf(state, "military", person, factionsOf(state), false);
  return pressing(h) ? "press" : "hold";
}

/** Whether a general staff presses rather than holds: its causes, its chief's character, a faction of hawks. */
const pressing = (h: Hand) => {
  const press = has(h, "offensive") || h.bold || leans(h, "hawks");
  const hold = has(h, "caution") || h.cautious || leans(h, "doves");
  return press && !hold;
};

/** The general staff runs the fronts and the army's routine: its line sets the formations' tasks (engine/formations.ts), and drills train the recruits. */
const military: Menu = (state, h) => {
  const me = state.player;
  const years = STEP_YEARS[state.step];
  const men = state.countries[me]?.arsenal?.men;
  const enemies = [...enemiesOf(state, me)].filter((t) => fightingOf(state, t));
  if (fightingOf(state, me) && enemies.length) {
    const enemy = enemies.sort((a, b) => (state.countries[b]?.economy?.troops ?? 0) - (state.countries[a]?.economy?.troops ?? 0) || a.localeCompare(b))[0];
    const act = pressing(h) ? "press" : "hold";
    if (h.bungle) return { act, target: enemy, effects: [], bungled: true, en: `botched the routine of the front against ${nameEn(state, enemy)}: muddled orders, a sector left thin`, faction: h.serves };
    return {
      act,
      target: enemy,
      effects: [],
      en: act === "press" ? `kept the fronts against ${nameEn(state, enemy)} pressing: local attacks wherever the odds are good` : `kept the fronts against ${nameEn(state, enemy)} holding: the line dug in, reserves gathered, no attack without the guns`,
      ...(h.serves ? { faction: h.serves } : {}),
    };
  }
  const threat = (state.plans ?? []).find((p) => !p.end && p.kind === "war" && p.target === me && (p.stage === "preparation" || p.stage === "action"));
  const drilled = men ? Math.round(men.recruits * 0.25 * h.q * span(years)) : 0;
  if (h.bungle) {
    const lost = men ? Math.round(men.trained * 0.005) : 0;
    return { act: threat ? "alert" : "drill", amount: 0, effects: lost ? [{ kind: "train", men: -lost }] : [], bungled: true, en: "botched it: an exercise went wrong, with men hurt and a unit to train again", faction: h.serves };
  }
  if (threat || leans(h, "hawks", "security")) {
    const who = threat?.by;
    return { act: "alert", target: who, amount: drilled, effects: drilled ? [{ kind: "train", men: drilled }] : [], en: `put the army on alert${who ? ` against ${nameEn(state, who)}` : ""} and drilled the recruits hard`, ...(h.serves && !threat ? { faction: h.serves } : {}) };
  }
  return { act: "drill", amount: drilled, effects: drilled ? [{ kind: "train", men: drilled }] : [], en: `kept the army's routine: drills and exercises${drilled ? `, ${drilled} thousand recruits trained` : ""}` };
};

/** Intelligence tends its networks where the danger lies and watches the elites at home; a disloyal chief keeps files for his own. */
const intelligence: Menu = (state, h) => {
  const me = state.player;
  const years = STEP_YEARS[state.step];
  const gdp = (t: string) => state.countries[t]?.economy?.gdp ?? 0;
  const enemies = [...enemiesOf(state, me)].filter((t) => state.countries[t]).sort((a, b) => gdp(b) - gdp(a) || a.localeCompare(b));
  const plan = (state.plans ?? []).find((p) => !p.end && p.target === me && p.kind === "war" && state.countries[p.by]);
  const tense = Object.values(state.countries)
    .filter((c) => c.course && c.tag !== me && !c.dormant)
    .sort((a, b) => tieOf(state, b.tag, me).tension - tieOf(state, a.tag, me).tension || gdp(b.tag) - gdp(a.tag) || a.tag.localeCompare(b.tag))[0];
  const concern = enemies[0] ?? plan?.by ?? (tense && tieOf(state, tense.tag, me).tension > 0 ? tense.tag : undefined);
  if (h.serves && leans(h, "security")) {
    return { act: "files", effects: [], en: `kept files on the cabinet for ${factionEn(h.serves)} rather than on the country's enemies`, faction: h.serves };
  }
  if (h.bungle) {
    const who = concern ?? enemies[0];
    if (who) return { act: "network", target: who, effects: [{ kind: "tie", who, trust: -4, tension: 8 }], bungled: true, en: `botched it: an agent was caught in ${nameEn(state, who)}, and the scandal is theirs to use`, faction: h.serves };
  }
  const elites = has(h, "watch", "influence") || !concern;
  if (elites) {
    const hidden = (state.politics?.plots ?? []).filter((p) => !p.known && !p.cabinet && (p.kind === "coup" || p.kind === "conspiracy"));
    const found = hidden.length > 0 && h.r("uncover") < 0.35 * h.q * span(years);
    return { act: "elites", target: found ? hidden[0].title : undefined, effects: found ? [{ kind: "plot", id: hidden[0].id }] : [], en: `watched the generals and the elites at home${found ? `, and uncovered "${hidden[0].title}"` : ""}`, ...(h.serves ? { faction: h.serves } : {}) };
  }
  return { act: "network", target: concern, effects: [{ kind: "watch", tag: concern! }], en: `worked the networks in ${nameEn(state, concern!)}: agents, informants, intercepts`, ...(h.serves ? { faction: h.serves } : {}) };
};

/** The direction a faction would put the research money into. */
const FACTION_DIRECTION: Record<string, ResearchDirection> = { hawks: "military", doves: "medicine", reformers: "science", hardliners: "industry", security: "communications", party: "agriculture" };

/** The science minister moves the split towards what his causes and the laggards want; a disloyal one towards his faction's. */
const science: Menu = (state, h) => {
  const research = state.research;
  if (!research?.shares) return { act: "steady", effects: [], en: "kept the laboratories at their work" };
  const shares = research.shares;
  const years = STEP_YEARS[state.step];
  // A split the government set by hand is his baseline, and he moves no direction more than two points from it.
  const set = state.ministers?.set?.research;
  const base = set ?? research.base ?? shares;
  const target: Record<ResearchDirection, number> = { ...base };
  if (has(h, "weapons")) {
    target.military += 6;
    target.strategic += 3;
  }
  if (has(h, "pure")) target.science += 8;
  if (has(h, "open")) {
    target.science += 4;
    target.medicine += 4;
  }
  if (has(h, "prestige")) {
    const next = RESEARCH_DIRECTIONS.map((d) => directionView(state, d)).filter((v) => v.next && v.expected !== undefined).sort((a, b) => a.expected! - b.expected!)[0];
    if (next) target[next.direction] += 6;
  }
  // A direction three years or more behind the world gets help from any minister who knows his work.
  for (const d of RESEARCH_DIRECTIONS) if (aheadOf(state, d) <= -3) target[d] += 3;
  // A disloyal minister wants ten points more for his faction's direction than the start gave it.
  const theirs = h.serves ? FACTION_DIRECTION[h.lean ?? ""] : undefined;
  if (theirs) target[theirs] = base[theirs] + 10;
  const sum = RESEARCH_DIRECTIONS.reduce((s, d) => s + target[d], 0);
  const gapOf = (d: ResearchDirection) => (target[d] * 100) / sum - shares[d];
  const direction = theirs ?? [...RESEARCH_DIRECTIONS].sort((a, b) => gapOf(b) - gapOf(a))[0];
  const faction = theirs ? h.serves : undefined;
  const want = Math.min(gapOf(direction), set ? set[direction] + 2 - shares[direction] : Infinity);
  if (want < 2 && !h.bungle) {
    if (has(h, "budget")) return { act: "lobby", effects: [], en: "pressed the government for more money for the laboratories" };
    return { act: "steady", effects: [], en: "kept the research split as it stands: the laboratories are working where he wants them" };
  }
  const step = Math.min(Math.floor(Math.max(want, 1)), 4, dither(16 * years * h.q, h.r("split")));
  if (h.bungle) {
    // The money went to a pet project rather than where it was needed.
    const others = RESEARCH_DIRECTIONS.filter((d) => d !== direction);
    const pet = others[Math.floor(h.r("pet") * others.length)];
    const shift = Math.max(1, step);
    return { act: "split", target: pet, amount: shift, effects: [{ kind: "research", direction: pet, shift }], bungled: true, en: `botched it: ${shift} points of the research money went to a pet project in ${pet} rather than where they were needed`, faction };
  }
  if (step <= 0) return { act: "steady", target: direction, effects: [], en: `kept the split for now, meaning to move money towards ${direction}`, faction };
  // The points come from the direction furthest past what he wants for it, so his moves add up rather than undo each other.
  const from = [...RESEARCH_DIRECTIONS].filter((d) => d !== direction && shares[d] > 0).sort((a, b) => gapOf(a) - gapOf(b))[0];
  return { act: "split", target: direction, amount: step, effects: [{ kind: "research", direction, shift: step, ...(from ? { from } : {}) }], en: `moved ${step} points of the research money to ${direction}${faction ? `, as ${factionEn(faction)} would have it` : ""}`, faction };
};

/** Industry orders arms to make good the army's losses, lays in the stores the people's provision draws on, and splits the industry line between heavy and light industry. */
const industry: Menu = (state, h) => {
  const me = state.player;
  const years = STEP_YEARS[state.step];
  const c = state.countries[me]!;
  const e = c.economy!;
  const arsenal = c.arsenal;
  const atWar = fightingOf(state, me);
  const ordered = new Set((arsenal?.orders ?? []).map((o) => o.type));
  const options: (Pick_ & { score: number })[] = [];
  // The industry line's split (engine/industry.ts): a minister of the plan, of arms or of a hawkish faction leans to heavy
  // industry, one who minds the shops – or whose classes want goods – to light; a split the government set by hand is his
  // baseline, moved three points from it at most; a disloyal one pulls it his faction's way.
  {
    const now = tiltOf(e);
    const set = state.ministers?.set?.tilt;
    const shops = Object.values(state.society?.[me]?.classes ?? {}).some((x) => x && x.want === "goods" && x.mood < 45);
    let want = 0;
    if (atWar || has(h, "war", "output") || leans(h, "hawks", "hardliners")) want += 8;
    if (shops || has(h, "provision") || leans(h, "doves", "reformers")) want -= 8;
    const faction = h.serves && (leans(h, "hawks", "hardliners", "security") || leans(h, "doves", "reformers", "party")) ? h.serves : undefined;
    if (faction) want = leans(h, "hawks", "hardliners", "security") ? 12 : -12;
    const target = set !== undefined && !faction ? clamp(want, set - 3, set + 3) : clamp(want, -MAX_TILT, MAX_TILT);
    const gap = target - now;
    if (Math.abs(gap) >= 2) {
      const step = Math.sign(gap) * Math.min(Math.abs(gap), Math.max(1, Math.round(5 * span(years) * h.q)));
      const heavy = step > 0;
      options.push({
        act: heavy ? "heavy" : "light",
        amount: Math.abs(step),
        effects: [{ kind: "split", tilt: now + step }],
        en: `moved ${Math.abs(step)} points of the industry line to ${heavy ? "heavy industry: steel, machines and arms" : "light industry: the goods in the shops"}${faction ? `, as ${factionEn(faction)} would have it` : ""}`,
        score: 2 + Math.min(2, Math.abs(gap) / 5) + (atWar && heavy ? 1 : 0) + (shops && !heavy ? 1 : 0),
        ...(faction ? { faction } : {}),
      });
    }
  }
  const armsOf = (kind: WeaponKind, n: number, score: number, en: string, faction?: string) => {
    if (ordered.has(kind) || (arsenal?.orders?.length ?? 0) >= 4) return;
    const [order] = sanitizeOrders(state, [{ type: kind, n }]);
    if (order?.n) options.push({ act: "arms", target: kind, amount: order.n, effects: [{ kind: "arms", type: order.type, n: order.n }], en: `${en}: ${order.n} ${kind} ordered from the plants`, score, ...(faction ? { faction } : {}) });
  };
  if (arsenal && atWar) {
    const lost = (Object.entries(arsenal.lost ?? {}) as [WeaponKind, number][]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
    if (lost.length) armsOf(lost[0][0], Math.round(lost[0][1] * h.q), 4, "made good the army's losses");
    else armsOf("artillery", Math.round((arsenal.stock.artillery?.n ?? 0) * 0.05 * h.q), 3, "kept the guns coming for the war");
  }
  if (arsenal && !atWar && (has(h, "war") || leans(h, "hawks"))) armsOf("tanks", Math.round((arsenal.stock.tanks?.n ?? 0) * 0.03 * h.q), has(h, "war") ? 2.5 : 1, "built up the army's stocks", h.serves && leans(h, "hawks") ? h.serves : undefined);
  // The stores the people's fuel and goods draw on, while trade is open and the reserves allow.
  const low = (Object.entries(e.stocks) as [ResourceType, number][]).filter(([, months]) => months < 2).sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))[0];
  if (low && e.tradeCut < 0.5) {
    const months = round2(Math.min(2 - low[1], 6 * years * h.q));
    const cost = round2(0.0008 * e.gdp * months);
    if (months > 0 && e.reserves > cost * 3) options.push({ act: "stores", target: low[0], amount: months, effects: [{ kind: "stores", resource: low[0], months, cost }], en: `laid in ${low[0]} for the people's provision: ${months} months of need, ${formatMoney(cost)} from the reserves`, score: 3 + (has(h, "provision", "resources") ? 1 : 0) });
  }
  // Power plants for the demand he sees coming, of the mix the country builds (engine/energy.ts): sooner while the lights go out.
  const plants = ministerPlants(state, h.q);
  if (plants) {
    const [main] = plants;
    const gw = Math.round(plants.reduce((s, p) => s + p.gw, 0) * 100) / 100;
    const kinds = plants.map((p) => `${p.gw} GW of ${p.source}`).join(" and ");
    options.push({ act: "power", target: main.source, amount: gw, effects: plants.map((p) => ({ kind: "power" as const, source: p.source, gw: p.gw })), en: `began power plants for the demand to come: ${kinds}, paid from the industry line over the years they take`, score: (state.energy?.[me]?.short ?? 0) >= 0.02 ? 4.5 : 3 + (has(h, "industry", "growth") ? 0.5 : 0) });
  }
  options.push({ act: "plants", effects: [], en: "kept the plants to plan: shifts, supplies and deliveries", score: 0.5 });
  const chosen = best(h, options);
  if (h.bungle) {
    const waste = round2(0.001 * e.gdp);
    return { act: chosen.act, target: chosen.target, effects: waste > 0 && e.reserves > waste ? [{ kind: "reserves", delta: -waste }] : [], bungled: true, en: `botched it: muddled orders left plants idle and wasted ${formatMoney(waste)}`, faction: chosen.faction };
  }
  return chosen;
};

/** The head of the space programme pushes its share towards what he wants and sets what it puts first. */
const space: Menu = (state, h) => {
  const p = state.space?.programmes[state.player];
  if (!p) return { act: "steady", effects: [], en: "kept the rocket designers at their work" };
  const years = STEP_YEARS[state.step];
  // A share and focus the government set by hand are his baseline: he moves the share two points from it at most and leaves the focus alone.
  const set = state.ministers?.set?.space;
  const base = set?.share ?? startShareOf(state.scenarioId, state.player) ?? p.share;
  const atWar = fightingOf(state, state.player);
  const wanted = has(h, "safety") ? base : clamp(base + (has(h, "budget") ? 5 : 0) + (has(h, "moon", "crew") ? 3 : 0) + (has(h, "missiles") && atWar ? 3 : 0), 0, MAX_SHARE);
  const target = set ? clamp(wanted, set.share - 2, set.share + 2) : wanted;
  const focus: SpaceFocus | undefined = h.serves
    ? leans(h, "hawks", "security") ? "military" : leans(h, "reformers") ? "prestige" : "balanced"
    : has(h, "missiles") ? "military" : has(h, "moon", "crew") ? "prestige" : undefined;
  const now = p.focus ?? "balanced";
  if (h.bungle) {
    const [m, work] = (Object.entries(p.work) as [SpaceMilestone, number][]).sort((a, b) => b[1] - a[1])[0] ?? [];
    if (m && work) return { act: "steady", target: m, effects: [{ kind: "space", setback: m, work: round2(Math.min(work, 0.1)) }], bungled: true, en: "botched it: a rushed test failed on the pad and set the programme back a little", faction: h.serves };
  }
  if (focus && focus !== now && !set) return { act: "focus", target: focus, effects: [{ kind: "space", focus }], en: `set the programme to put ${focus === "military" ? "the army's missiles and spy satellites" : focus === "prestige" ? "the next first in space" : "everything evenly"} first${h.serves ? `, for ${factionEn(h.serves)}` : ""}`, ...(h.serves ? { faction: h.serves } : {}) };
  const gap = target - p.share;
  if (Math.abs(gap) >= 1) {
    const step = Math.sign(gap) * Math.min(Math.abs(gap), 2, dither(4 * years * h.q, h.r("share")));
    if (step) return { act: "share", target: String(p.share + step), amount: step, effects: [{ kind: "space", share: p.share + step }], en: `${step > 0 ? "won" : "gave back"} ${Math.abs(step)} points of the research money for the rockets, to ${p.share + step}%` };
  }
  return { act: "steady", effects: [], en: "kept the programme to its plan: the next launch, the next rocket" };
};

const MENUS: Record<Exclude<AdvisorId, "chief">, Menu> = { foreign, interior, military, intelligence, finance, industry, science, space, ...forNew<Menu>(() => ({ act: "steady", effects: [], en: "kept to its portfolio" })) };

/**
 * What every minister does on his own this turn, decided before the turn is
 * written: the chief of staff first, whose agenda puts one ministry's work
 * first, then the rest in the cabinet's order. A minister held to the
 * government's word is listed with why; the player's own post is not listed.
 */
export function castMinisters(state: GameState, orders: readonly string[] = []): RoutineCast[] {
  if (!inPlay(state)) return [];
  const ministers = ministersInPost(state);
  if (!ministers.length) return [];
  const factions = factionsOf(state);
  const out: RoutineCast[] = [];
  let boosted: AdvisorId | undefined;
  for (const [ministry, person] of ministers) {
    const held = heldBy(state, ministry, orders);
    if (held) {
      out.push({ act: { ministry, by: person.name, held }, effects: [], en: HELD_EN[held] });
      continue;
    }
    const h = handOf(state, ministry, person, factions, ministry === boosted);
    const pick = ministry === "chief" ? chief(state, h, pressingMinistry(state), ministers, factions) : MENUS[ministry](state, h);
    if (ministry === "chief" && pick.act === "agenda" && !h.bungle) boosted = pick.target as AdvisorId;
    const act: RoutineAct = {
      ministry,
      by: person.name,
      act: pick.act,
      ...(pick.target !== undefined ? { target: pick.target } : {}),
      ...(pick.amount !== undefined ? { amount: pick.amount } : {}),
      ...(pick.bungled ? { bungled: true } : {}),
      ...(pick.faction ? { faction: pick.faction } : {}),
    };
    out.push({ act, effects: pick.effects, en: pick.en });
  }
  return out;
}

const HELD_EN: Record<RoutineHeld, string> = {
  toggle: "acts only on the government's orders: did nothing of his own",
  directive: "worked on the ministry's standing directives and did nothing of his own beside them",
  orders: "carried out the government's orders in his field and did nothing of his own beside them",
  hand: "left alone what the government set with its own hand since the last turn",
};

/**
 * The ministers' work for the game master: what each did on his own, decided
 * by the engine, and who was held to the government's word.
 */
export function describeMinisters(state: GameState, orders: readonly string[] = []): string[] {
  const cast = castMinisters(state, orders);
  if (!cast.length) return [];
  return [
    "",
    "THE MINISTERS' OWN WORK THIS PERIOD (the engine has decided it – the player did not order it; tell what came of the acts that matter, in proportion, never contradicting them or adding to their numbers; the engine applies their effects; a botched act went wrong as told; one serving a faction was done for the faction, not the government):",
    ...cast.map(({ act, en }) => `- ${ADVISOR_TITLES[act.ministry].en}, ${act.by}: ${en}.`),
  ];
}

/** What each act was, in a few English words, for a record read back to the model: what it was about follows. */
const ACT_EN: Record<string, string> = {
  "chief.agenda": "put this ministry first on the leader's agenda",
  "chief.cabinet": "kept the cabinet together, smoothing things over with",
  "chief.image": "looked after the leader's image",
  "chief.office": "ran the leader's office",
  "chief.clique": "favoured his own people in the cabinet:",
  "foreign.renew": "renewed the treaty with",
  "foreign.remind": "put an expiring treaty before the leader:",
  "foreign.notes": "answered a note calmly:",
  "foreign.protest": "answered a note with a firm protest:",
  "foreign.tend": "tended the ties with",
  "foreign.ease": "eased the tension with",
  "foreign.firm": "held a firm line with",
  "foreign.embassies": "kept the embassies at their work",
  "interior.police": "policed a protest within the law:",
  "interior.crackdown": "cracked down on a protest:",
  "interior.watch": "watched the opposition",
  "interior.calm": "kept the country calm",
  "interior.patrol": "kept the usual order",
  "interior.lenient": "let the protests be",
  "military.press": "kept the fronts pressing against",
  "military.hold": "kept the fronts holding against",
  "military.alert": "put the army on alert",
  "military.drill": "drilled the army",
  "intelligence.network": "worked the networks in",
  "intelligence.elites": "watched the elites at home",
  "intelligence.files": "kept files on the cabinet for his faction",
  "finance.balance": "narrowed the deficit by",
  "finance.invest": "put more into industry:",
  "finance.steady": "kept the budget as it stands",
  "finance.army": "moved money into the army:",
  "finance.social": "moved money into the social line:",
  "finance.apparatus": "moved money into the state apparatus:",
  "industry.arms": "ordered arms:",
  "industry.stores": "laid in stores of",
  "industry.power": "began power plants:",
  "industry.plants": "kept the plants to plan",
  "science.split": "moved research money to",
  "science.lobby": "pressed for more money for science",
  "science.steady": "kept the research split",
  "space.share": "moved the space programme's share of the research money to",
  "space.focus": "set the space programme's focus:",
  "space.steady": "kept the space programme to its plan",
  "industry.heavy": "moved the industry line towards heavy industry:",
  "industry.light": "moved the industry line towards light industry:",
};

/** How much, in each act's unit, where it says something. */
const AMOUNT_EN: Record<string, (n: number) => string> = {
  "foreign.renew": (n) => `${n} years`,
  "military.drill": (n) => `${n} thousand recruits trained`,
  "military.alert": (n) => `${n} thousand recruits trained`,
  "finance.balance": (n) => `${formatMoney(n)} a year`,
  "finance.invest": (n) => `${formatMoney(n)} a year`,
  "finance.army": (n) => `${formatMoney(n)} a year`,
  "finance.social": (n) => `${formatMoney(n)} a year`,
  "finance.apparatus": (n) => `${formatMoney(n)} a year`,
  "industry.arms": (n) => `${n} ordered`,
  "industry.stores": (n) => `${n} months`,
  "industry.power": (n) => `${n} GW`,
  "science.split": (n) => `${n} points`,
  "industry.heavy": (n) => `${n} points`,
  "industry.light": (n) => `${n} points`,
};

/** A recorded act in one English line: what the minister did, or why he did nothing of his own. */
export function actEn(a: RoutineAct): string {
  if (a.held) return HELD_EN[a.held];
  const key = `${a.ministry}.${a.act}`;
  const what = ACT_EN[key] ?? a.act ?? "";
  const amount = a.amount === undefined || !a.amount ? "" : (AMOUNT_EN[key]?.(a.amount) ?? "");
  const about = [key === "space.share" ? `${a.target}%` : a.target, amount].filter(Boolean).join(", ");
  return `${what}${about ? ` ${about}` : ""}${a.bungled ? " – and botched it" : ""}${a.faction ? ` (for ${factionEn(a.faction)})` : ""}`;
}

/** For a minister's view after the turn: what he did on his own during it. */
export function describeOwnWork(entry: Pick<ChronicleEntry, "routine"> | undefined, ministry: AdvisorId): string[] {
  const a = entry?.routine?.find((x) => x.ministry === ministry);
  return a ? ["", "WHAT THE MINISTER DID ON HIS OWN DURING THE PERIOD (the engine's record; mention it only as he would):", `- ${actEn(a)}`] : [];
}

/**
 * What the cast acts do, as the turn lands. "treaties": the renewals, before
 * the period's expiries are settled; "rest": everything else, once the turn's
 * own changes to the street, the cabinet and the budget have landed. A thing
 * the turn has already removed (a protest that ended, a minister dismissed,
 * a treaty dissolved) is passed over. Mutates `next`.
 */
export function applyMinisters(state: GameState, next: GameState, cast: RoutineCast[], phase: "treaties" | "rest"): void {
  for (const { effects } of cast) {
    for (const fx of effects) {
      if ((fx.kind === "renew") !== (phase === "treaties")) continue;
      applyEffect(state, next, fx);
    }
  }
}

function applyEffect(state: GameState, next: GameState, fx: RoutineEffect): void {
  const me = next.player;
  const c = next.countries[me];
  const e = c?.economy;
  switch (fx.kind) {
    case "budget": {
      if (!e) return;
      // Only the lines he moved, each held to what any budget change may do (engine/economy.ts limitChange).
      const b = e.budget;
      const wanted: Partial<Budget> = {};
      for (const [line, d] of Object.entries(fx.delta) as [keyof Budget, number][]) if (d) wanted[line] = b[line] + d;
      const limited = limitChange({ country: me, ...wanted }, e);
      e.budget = { ...b };
      for (const line of Object.keys(wanted) as (keyof Budget)[]) e.budget[line] = limited[line] ?? b[line];
      return;
    }
    case "reserves":
      if (e) e.reserves = round2(Math.max(0, e.reserves + fx.delta));
      return;
    case "split":
      // The industry line's split between heavy and light industry (engine/industry.ts).
      if (e) {
        const tilt = Math.round(clamp(fx.tilt, -MAX_TILT, MAX_TILT));
        if (tilt) e.tilt = tilt;
        else delete e.tilt;
      }
      return;
    case "tie": {
      const course = next.countries[fx.who]?.course;
      if (!course) return;
      const t = (course.ties[me] ??= { ...tieOf(next, fx.who, me) });
      if (fx.trust) t.trust = Math.round(clamp(t.trust + fx.trust, -100, 100));
      if (fx.tension) t.tension = Math.round(clamp(t.tension + fx.tension, 0, 100));
      return;
    }
    case "renew": {
      const a = next.alliances.find((x) => x.id === fx.alliance);
      if (a && a.until && a.until < fx.until) a.until = fx.until;
      return;
    }
    case "protest": {
      const p = next.protests?.find((x) => x.id === fx.id);
      if (!p) return;
      p.size = Math.max(0, Math.round(p.size * fx.size));
      if (fx.organisation && p.organisation !== undefined) p.organisation = clamp(p.organisation + fx.organisation, 0, 100);
      return;
    }
    case "unrest":
      if (next.politics) next.politics = { ...next.politics, unrest: clamp(Math.round(next.politics.unrest + fx.delta), 0, 100) };
      return;
    case "plot": {
      const plots = next.politics?.plots;
      if (plots?.some((p) => p.id === fx.id && !p.known)) next.politics = { ...next.politics!, plots: plots.map((p) => (p.id === fx.id ? { ...p, known: true } : p)) };
      return;
    }
    case "party":
      // Read by party life as one of the period's blows (watchedParties), not applied on its own.
      return;
    case "favour":
      if (next.officials?.some((o) => o.name === fx.name)) next.officials = next.officials.map((o) => (o.name === fx.name ? withFavour(o, fx.delta) : o));
      return;
    case "train": {
      const men = c?.arsenal?.men;
      if (!men) return;
      const moved = fx.men > 0 ? Math.min(fx.men, men.recruits) : -Math.min(-fx.men, men.trained);
      c.arsenal!.men = { ...men, recruits: Math.round(men.recruits - moved), trained: Math.round(men.trained + moved) };
      return;
    }
    case "watch":
      if (next.countries[fx.tag]) next.ministers = { ...next.ministers, watch: fx.tag };
      return;
    case "research": {
      const research = next.research;
      if (!research?.shares) return;
      const shares = { ...research.shares };
      const moved = fx.from ? Math.min(fx.shift, shares[fx.from]) : 0;
      if (fx.from && moved > 0) {
        shares[fx.from] -= moved;
        shares[fx.direction] += moved;
        next.research = { ...research, shares };
      } else next.research = { ...research, shares: shiftShares(research.shares, fx.direction, fx.shift) };
      return;
    }
    case "arms":
      placeOrders(state, next, [{ type: fx.type, n: fx.n }], state.date);
      return;
    case "stores":
      if (!e || e.reserves < fx.cost) return;
      e.stocks = { ...e.stocks, [fx.resource]: round2(Math.min(12, (e.stocks[fx.resource] ?? 0) + fx.months)) };
      e.reserves = round2(e.reserves - fx.cost);
      return;
    case "power":
      beginPlants(next, [{ source: fx.source, gw: fx.gw }], "minister", null, next.date);
      return;
    case "space": {
      const p = next.space?.programmes[me];
      if (!p || !next.space) return;
      const programme = { ...p };
      if (fx.share !== undefined) programme.share = clamp(Math.round(fx.share), 0, MAX_SHARE);
      if (fx.focus) programme.focus = fx.focus;
      if (fx.setback && fx.work) programme.work = { ...p.work, [fx.setback]: round2(Math.max(0, (p.work[fx.setback] ?? 0) - fx.work)) };
      next.space = { ...next.space, programmes: { ...next.space.programmes, [me]: programme } };
      return;
    }
  }
}

/**
 * Once the turn is applied: the levers as the turn left them, so a change
 * the government makes by hand before the next turn is known as its own, and
 * the intelligence networks let go when the service has no chief.
 */
export function keepLevers(next: GameState, state: GameState, cast: RoutineCast[]): void {
  const p = next.space?.programmes[next.player];
  const left = {
    ...(next.research?.shares ? { research: { ...next.research.shares } } : {}),
    ...(p ? { space: { share: p.share, focus: p.focus ?? "balanced" } } : {}),
  };
  // What the government set by hand before this turn stays its word: the ministers' baseline from now on.
  const set = { ...next.ministers?.set };
  for (const { act } of cast) {
    if (act.held !== "hand") continue;
    if (act.ministry === "science" && state.research?.shares) set.research = { ...state.research.shares };
    const was = state.space?.programmes[state.player];
    if (act.ministry === "space" && was) set.space = { share: was.share, focus: was.focus ?? "balanced" };
    const e = state.countries[state.player]?.economy;
    // Measured as he measures it: interest and spending outside the budget included.
    if (act.ministry === "finance" && e) set.deficit = round2(Math.max(0, deficitOf(e, interestOf(e, state.scenarioId)) / Math.max(0.01, e.gdp)) * 1000) / 1000;
  }
  const ministers = { ...next.ministers, ...(Object.keys(left).length ? { left } : {}), ...(Object.keys(set).length ? { set } : {}) };
  if (!officialAt(next, "intelligence")) delete ministers.watch;
  if (Object.keys(ministers).length) next.ministers = ministers;
}

/** The government tells a minister to act only on its orders, or lets him work on his own again. */
export function setOnOrders<T extends Pick<GameState, "ministers" | "updatedAt">>(state: T, ministry: AdvisorId, onOrders: boolean, now = new Date()): T {
  const list = (state.ministers?.onOrders ?? []).filter((m) => m !== ministry);
  if (onOrders) list.push(ministry);
  const ministers = { ...state.ministers, onOrders: ADVISORS.filter((m) => list.includes(m)) };
  if (!ministers.onOrders.length) delete (ministers as { onOrders?: AdvisorId[] }).onOrders;
  return { ...state, ministers, updatedAt: now.toISOString() };
}

/** Whether a minister acts only on the government's orders. */
export const actsOnOrders = (state: Pick<GameState, "ministers">, ministry: AdvisorId): boolean => Boolean(state.ministers?.onOrders?.includes(ministry));


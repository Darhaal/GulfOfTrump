import { coupRiskIn, incomes, lostShares } from "./abroad";
import { roll } from "./dice";
import { officialAt } from "./government";
import { intelligenceBonus } from "./researchEffects";
import type { GameState, Localized, MapIndex, MapRegion, OfficialPost, PlayerRole, RegimeKind } from "./types";

/**
 * Fog of war: the player sees other countries as its government would know
 * them. How much it knows of a country is a score, from how open its
 * government is, what ties or divides the two, a shared border and the
 * player's intelligence; true figures become estimates whose error shrinks
 * with the score, and what governments hide (their real support, a coup in
 * the making, an army's exact strength) is a rumour or unknown below a
 * threshold. The engine and the game master keep the truth; this is only
 * what the player is shown, and what the prompt tells the game master the
 * player's government knows.
 */

export type KnowledgeLevel = "full" | "good" | "partial" | "poor";
export type KnowledgeReason = "open" | "closed" | "ally" | "pact" | "bloc" | "enemy" | "sanctions" | "border" | "agents" | "service-good" | "service-weak" | "signals-good" | "signals-weak" | "talks" | "post-good" | "post-weak";

export interface Knowledge {
  /** 0–100: how much of the country's real state the player's government knows. */
  score: number;
  level: KnowledgeLevel;
  /** What raised or lowered it, the weightiest first. */
  reasons: KnowledgeReason[];
}

/** What a government publishes about itself: free elections come with free statistics. */
const OPENNESS: Record<RegimeKind, number> = { democracy: 55, limited: 35, party: 20, autocracy: 25, military: 25 };
/** A country whose politics the engine does not keep (a movement, an exile). */
const UNKNOWN_OPENNESS = 30;
const ALLY = 25;
const PACT = 10;
const BLOC = 5;
/** A world body of a hundred members says nothing about any one of them. */
const BLOC_MEMBERS = 30;
const ENEMY = -15;
const SANCTIONS = -5;
const BORDER = 10;
/** An intelligence directive or operation aimed at the country. */
const AGENTS = 20;
/** Per point of the head of intelligence's competence above or below 3. */
const SERVICE = 5;
const TALKS = 5;
const MIN_SCORE = 5;
const MAX_SCORE = 95;

/**
 * What a player who does not lead sees from their post (engine/figures.ts):
 * the foreign ministry's cables and the intelligence service's reports more,
 * the ministries far from the world less; a general little of politics; an
 * opposition only what the press prints, a little more from abroad.
 */
const POST_SIGHT: Partial<Record<OfficialPost, number>> = { foreign: 10, intelligence: 15, chief: 5, interior: -5, industry: -5, science: -10 };
export function postSight(role: PlayerRole | undefined): number {
  if (!role || role.kind === "leader") return 0;
  if (role.kind === "opposition") return role.movement?.kind === "exile" ? -5 : -15;
  if (role.kind === "general") return -5;
  return role.post ? (POST_SIGHT[role.post] ?? 0) : 0;
}
/** Armies are a soldier's business: a general and the general staff know them better, an opposition worse. */
export function armySight(role: PlayerRole | undefined): number {
  if (role?.kind === "general") return 20;
  if (role?.kind === "minister" && role.post === "military") return 10;
  return role?.kind === "opposition" ? -10 : 0;
}

/** Below this a government's support and stability are unknown. */
export const POLITICS_SEEN = 35;
/** From this the coup risk is known with its figure; between the two thresholds it is a rumour. */
export const COUP_SEEN = 60;
export const COUP_RUMOUR = 35;
/** Armies are kept closer than budgets: their strength is known this much worse. */
export const ARMY_SECRECY = 10;

export function knowledgeLevel(score: number): KnowledgeLevel {
  return score >= 80 ? "full" : score >= 60 ? "good" : score >= 35 ? "partial" : "poor";
}

/** Whether the game hides other countries' true figures. A save from before fog of war has it off (migration step 8). */
export const fogOn = (state: Pick<GameState, "fog">): boolean => state.fog === true;

/** Countries whose land touches the land the player's government holds. */
export function borderingPlayer(state: Pick<GameState, "regions" | "player">, neighbors?: MapIndex["neighbors"] | null): Set<string> {
  const out = new Set<string>();
  if (!neighbors) return out;
  for (const [id, r] of Object.entries(state.regions)) {
    if (r.controller !== state.player) continue;
    for (const n of neighbors[id] ?? []) {
      const other = state.regions[n];
      if (!other) continue;
      if (other.controller !== state.player) out.add(other.controller);
      if (other.owner !== state.player) out.add(other.owner);
    }
  }
  return out;
}

/** The forms a name is written in an order: every language, and the stem that a Russian or Ukrainian ending is added to. */
function nameForms(tag: string, name: string | Localized): string[] {
  const names = typeof name === "string" ? [name] : Object.values(name);
  const forms = new Set<string>([tag.replace(/-/g, " ")]);
  for (const n of names) {
    const lower = n.toLowerCase();
    forms.add(lower);
    if (lower.length >= 6) forms.add(lower.slice(0, -2));
  }
  return [...forms].filter((f) => f.length >= 3);
}

/** Whether a directive of the intelligence service, or an operation of any ministry, is aimed at a country. */
function watched(state: Pick<GameState, "directives" | "countries">, tag: string): boolean {
  const c = state.countries[tag];
  if (!c) return false;
  const forms = nameForms(tag, c.name);
  return (state.directives ?? []).some((d) => {
    const about = [d.ministry === "intelligence" ? d.text : "", d.operation?.target ?? ""].join(" ").toLowerCase();
    return about.trim() !== "" && forms.some((f) => about.includes(f));
  });
}

type KnowledgeState = Pick<GameState, "player" | "countries" | "alliances" | "wars" | "sanctions" | "directives" | "officials" | "diplomacy"> & Partial<Pick<GameState, "research" | "date" | "role">>;

/** How much the player's government knows of one country. `borders` is borderingPlayer's result, when the map has loaded. */
export function knowledgeOf(state: KnowledgeState, tag: string, borders?: Set<string>): Knowledge {
  if (tag === state.player) return { score: 100, level: "full", reasons: [] };
  const country = state.countries[tag];
  const parts: [KnowledgeReason, number][] = [];
  const regime = country?.domestic?.regime;
  const base = regime ? OPENNESS[regime] : UNKNOWN_OPENNESS;
  // Managed elections publish some figures and hide others: neither open nor closed.
  if (regime === "democracy") parts.push(["open", 0]);
  else if (regime && regime !== "limited") parts.push(["closed", 0]);

  const together = state.alliances.filter((a) => a.members.includes(tag) && a.members.includes(state.player));
  if (together.some((a) => !a.kind || a.kind === "alliance")) parts.push(["ally", ALLY]);
  else if (together.some((a) => a.kind === "pact")) parts.push(["pact", PACT]);
  if (together.some((a) => (a.kind === "organization" || a.kind === "trade") && a.members.length <= BLOC_MEMBERS)) parts.push(["bloc", BLOC]);

  const enemy = state.wars.some(
    (w) => (w.attackers.includes(state.player) && w.defenders.includes(tag)) || (w.defenders.includes(state.player) && w.attackers.includes(tag)),
  );
  if (enemy) parts.push(["enemy", ENEMY]);
  if ((state.sanctions ?? []).some((s) => (s.by === state.player && s.against === tag) || (s.by === tag && s.against === state.player))) parts.push(["sanctions", SANCTIONS]);
  if (borders?.has(tag)) parts.push(["border", BORDER]);
  if (watched(state, tag)) parts.push(["agents", AGENTS]);

  const competence = officialAt(state, "intelligence")?.competence;
  if (competence !== undefined && competence !== 3) parts.push([competence > 3 ? "service-good" : "service-weak", (competence - 3) * SERVICE]);
  // Signals, computers and satellites: the player's communications research against the world's (engine/researchEffects.ts).
  const signals = state.research?.tech && state.date ? intelligenceBonus({ research: state.research, date: state.date }) : 0;
  if (signals) parts.push([signals > 0 ? "signals-good" : "signals-weak", signals]);
  if ((state.diplomacy[tag] ?? []).some((m) => m.from === "them")) parts.push(["talks", TALKS]);
  // A player who does not lead sees what their post lets them see.
  const sight = postSight(state.role);
  if (sight) parts.push([sight > 0 ? "post-good" : "post-weak", sight]);

  const score = Math.max(MIN_SCORE, Math.min(MAX_SCORE, base + parts.reduce((sum, [, d]) => sum + d, 0)));
  // The kind of government first, then the rest by how much they weigh.
  const reasons = [...parts].sort((a, b) => (a[1] === 0 ? -1 : b[1] === 0 ? 1 : Math.abs(b[1]) - Math.abs(a[1]))).map(([r]) => r);
  return { score, level: knowledgeLevel(score), reasons };
}

/** An estimate of a figure: the best guess and the range the truth lies in. */
export interface Estimate {
  value: number;
  low: number;
  high: number;
  /** The true figure, known as it is. */
  exact?: boolean;
}

/** The half-width of an estimate as a share of the figure: about ±47% for the least known country, ±5% at 80, none at 100. */
export function spread(score: number): number {
  return 0.6 * Math.max(0, 1 - score / 100) ** 1.5;
}

/** Two significant figures, rounded the given way. */
function sig2(n: number, round: (x: number) => number = Math.round): number {
  if (n === 0 || !Number.isFinite(n)) return 0;
  const step = 10 ** (Math.floor(Math.log10(Math.abs(n))) - 1);
  return round(n / step) * step;
}
/** Two significant figures without float dust (0.30000000000000004). */
const clean = (n: number) => Number(n.toPrecision(12));

/** The dice for an estimate: the same all turn, new with each turn's reports. */
const dice = (state: Pick<GameState, "seed" | "id" | "turn">, key: string) => roll(state.seed ?? state.id, state.turn, `fog:${key}`);

/**
 * An estimate of a positive figure (money, people). The guess is off by up to
 * half the spread and the range is the spread around the guess, so the truth
 * always lies inside it.
 */
export function estimate(truth: number, score: number, state: Pick<GameState, "seed" | "id" | "turn">, key: string): Estimate {
  if (score >= 100 || truth <= 0) return { value: truth, low: truth, high: truth, exact: true };
  const e = spread(score);
  const guess = truth * (1 + (2 * dice(state, key) - 1) * (e / 2));
  return { value: clean(sig2(guess)), low: clean(sig2(guess * (1 - e), Math.floor)), high: clean(sig2(guess * (1 + e), Math.ceil)) };
}

/** An estimate of a rate that can be negative (growth, a share in points): off by up to `width` points times the spread. */
export function estimateRate(truth: number, score: number, width: number, state: Pick<GameState, "seed" | "id" | "turn">, key: string, bounds: [number, number] = [-Infinity, Infinity]): Estimate {
  if (score >= 100) return { value: truth, low: truth, high: truth, exact: true };
  const e = spread(score) * width;
  const guess = truth + (2 * dice(state, key) - 1) * (e / 2);
  const fit = (n: number) => Math.max(bounds[0], Math.min(bounds[1], n));
  return { value: fit(Math.round(guess * 10) / 10), low: fit(Math.floor((guess - e) * 10) / 10), high: fit(Math.ceil((guess + e) * 10) / 10) };
}

export type RiskLevel = "low" | "elevated" | "high";
/** The words for a coup risk, % a year. */
export const coupLevel = (n: number): RiskLevel => (n < 2 ? "low" : n < 8 ? "elevated" : "high");

/** What the player's government sees of a foreign country. A missing figure is unknown. */
export interface ForeignView {
  knowledge: Knowledge;
  gdp?: Estimate;
  /** Real growth, % a year. */
  growth?: Estimate;
  debt?: Estimate;
  /** Soldiers, thousands. */
  troops?: Estimate;
  /** The government's support and the state's stability, 0–100. */
  support?: Estimate;
  stability?: Estimate;
  /** The risk of a coup: known with its figure, rumoured by its level, or unknown (missing). */
  coup?: { level: RiskLevel; n?: number; rumour: boolean };
}

type ViewState = KnowledgeState & Pick<GameState, "seed" | "id" | "turn" | "regions" | "date" | "scenarioId">;

export interface ViewContext {
  borders?: Set<string>;
  map?: Record<string, MapRegion> | null;
  /** lostShares(state, map), when it is already at hand. */
  lost?: Map<string, number>;
}

/** A foreign country as its figures reach the player's government this turn. */
export function foreignView(state: ViewState, tag: string, ctx: ViewContext = {}): ForeignView {
  const knowledge = knowledgeOf(state, tag, ctx.borders);
  const c = state.countries[tag];
  const view: ForeignView = { knowledge };
  const k = knowledge.score;
  if (c?.economy) {
    view.gdp = estimate(c.economy.gdp, k, state, `${tag}:gdp`);
    view.growth = estimateRate(c.economy.growth, k, 8, state, `${tag}:growth`);
    view.debt = estimate(c.economy.debt, k, state, `${tag}:debt`);
    view.troops = estimate(c.economy.troops, k - ARMY_SECRECY + armySight(state.role), state, `${tag}:troops`);
  }
  const d = c?.domestic;
  if (d && k >= POLITICS_SEEN) {
    view.support = estimateRate(d.support, k, 40, state, `${tag}:support`, [0, 100]);
    view.stability = estimateRate(d.stability, k, 40, state, `${tag}:stability`, [0, 100]);
  }
  if (d && k >= COUP_RUMOUR) {
    const risk = coupRiskIn(state, tag, ctx.lost ?? lostShares(state, ctx.map), incomes(state, ctx.map));
    const guess = estimate(risk, k, state, `${tag}:coup`).value;
    view.coup = k >= COUP_SEEN ? { level: coupLevel(guess), n: Math.round(guess * 10) / 10, rumour: false } : { level: coupLevel(guess), rumour: true };
  }
  return view;
}

/** Thousands, for the prompt: "1.2–1.8 million", "250–400 thousand". */
function peopleEn(thousands: number): string {
  return thousands >= 1000 ? `${clean(Math.round(thousands / 100) / 10)} million` : `${Math.round(thousands)} thousand`;
}

/**
 * What the game master is told the player's government knows, when fog of
 * war is on: the countries it knows well and those it knows poorly (the
 * rest, most of the world, in a word), and the enemy armies as its
 * intelligence puts them. The truth stays above, for the game master alone.
 */
export function describeFog(state: GameState, index: Pick<MapIndex, "neighbors" | "regions"> | null): string[] {
  if (!fogOn(state)) return [];
  const borders = borderingPlayer(state, index?.neighbors);
  const lost = lostShares(state, index?.regions);
  const owners = new Set(Object.values(state.regions).map((r) => r.owner));
  const groups: Record<"good" | "partial" | "poor", string[]> = { good: [], partial: [], poor: [] };
  const enemies: string[] = [];
  for (const c of Object.values(state.countries)) {
    if (c.tag === state.player || !owners.has(c.tag)) continue;
    const view = foreignView(state, c.tag, { borders, lost });
    const level = view.knowledge.level === "full" ? "good" : view.knowledge.level;
    groups[level].push(c.tag);
    const atWar = state.wars.some((w) => (w.attackers.includes(state.player) && w.defenders.includes(c.tag)) || (w.defenders.includes(state.player) && w.attackers.includes(c.tag)));
    if (atWar && view.troops) enemies.push(`${c.tag} ${view.troops.exact ? peopleEn(view.troops.value) : `${peopleEn(view.troops.low)}–${peopleEn(view.troops.high)}`} soldiers`);
  }
  const lines = [
    "",
    `FOG OF WAR — what ${state.role && state.role.kind !== "leader" ? "the player knows from their post" : "the player's government knows"} of other countries. The figures above are the truth, for you alone. In the narrative, the events and the ministers' reports, give foreign figures as the player's government would learn them — estimates, published statistics, intelligence, rumours — and never reveal what it cannot know: a closed government's real support and stability, a coup in the making, an army's exact strength. Intelligence work, defectors, a captured document or events this period may uncover them; then say how they were learned.`,
  ];
  if (groups.good.length) lines.push(`- well informed (allies, open neighbours, its intelligence's targets): ${groups.good.join(", ")}`);
  if (groups.poor.length) lines.push(`- poorly informed (closed regimes, enemies): ${groups.poor.join(", ")}`);
  if (groups.partial.length) lines.push("- every other country: partly informed, from published figures and the press");
  if (enemies.length) lines.push(`- enemy armies as the player's intelligence estimates them: ${enemies.join("; ")}`);
  return lines;
}

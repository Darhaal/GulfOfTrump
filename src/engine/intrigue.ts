import { z } from "zod";
import { ADVISORS, type AdvisorId } from "./advisors";
import { roll } from "./dice";
import { STEP_YEARS } from "./economy";
import { fogOn } from "./fog";
import { officialAt } from "./government";
import { dealInterests, MINISTRY_OF } from "./interests";
import { LAWS, type LawId } from "./laws";
import { holdsElections } from "./parliament";
import { leaderOf, samePerson } from "./people";
import { loyaltyOf } from "./politics";
import { isOpposition } from "./role";
import { applyOverthrow } from "./unrest";
import { OFFICIAL_POSTS } from "./types";
import type { AppliedChange, CabinetMove, CabinetResult, Deputy, GameState, Official, OfficialPost, OrderVerdict, Plot } from "./types";

/**
 * A cabinet that intrigues. The ministers and their deputies fall into
 * factions by what they want – hawks and doves, reformers and hardliners, a
 * security clique, the ministers of a partner in the coalition – read from
 * the causes, party and ambition the dice dealt them (engine/interests.ts),
 * so the factions change as people come, go and fall out.
 *
 * Loyalty answers to the player: orders and laws for or against a person's
 * causes, favours, promotions and humiliations fill a measure of favour,
 * and a full measure moves their loyalty a step. A faction whose people have
 * lost faith turns on the government: its ministries drag their feet (the
 * engine marks their orders down and holds their directives up), it leaks
 * to the press, and it plots to replace a minister or the leader himself –
 * a plot among the plots of the player's politics, kept by the engine. What
 * the government learns of a plot is what its intelligence service hears:
 * first a rumour, which may blame the wrong people, and only then the truth.
 *
 * The government's own moves – a favour, a seat at the top table, a
 * reshuffle, a dismissal, an investigation, a purge – are decided at once by
 * the game's dice and told to the next turn's game master. Everything here
 * is pure and seeded: a turn played again rolls the same.
 */

export const FACTION_KINDS = ["hawks", "doves", "reformers", "hardliners", "security", "party"] as const;
export type FactionKind = (typeof FACTION_KINDS)[number];
type Lean = Exclude<FactionKind, "party">;

/** The order factions are listed in. */
const LEANS: Lean[] = ["security", "hawks", "hardliners", "reformers", "doves"];
/** Which wins a tie between a person's leanings: the security clique only on a clear lead. */
const TIES: Lean[] = ["hawks", "doves", "reformers", "hardliners", "security"];

/** Which way each cause leans, by ministry and cause (AGENDAS). */
const CAUSE_LEAN: Record<AdvisorId, Record<string, Partial<Record<Lean, number>>>> = {
  chief: { apparatus: { security: 1, hardliners: 1 }, ratings: { doves: 1 }, reform: { reformers: 2 }, loyalists: { hardliners: 1, security: 1 }, calm: { doves: 2 } },
  military: { budget: { hawks: 2 }, modern: { reformers: 1, hawks: 1 }, caution: { doves: 2 }, offensive: { hawks: 2 }, professional: { reformers: 2 } },
  finance: { balance: { doves: 1, reformers: 1 }, growth: { reformers: 1 }, prices: { doves: 1 }, openness: { reformers: 2, doves: 1 }, industry: { hardliners: 2 } },
  industry: { output: { hardliners: 1 }, war: { hawks: 2 }, exports: { reformers: 1, doves: 1 }, provision: { doves: 2 }, resources: { hawks: 1, hardliners: 1 } },
  foreign: { allies: { hawks: 1 }, neutral: { doves: 2 }, prestige: { reformers: 1 }, trade: { doves: 1, reformers: 1 }, hardline: { hawks: 2, hardliners: 1 } },
  interior: { order: { hardliners: 2 }, press: { hardliners: 1, security: 1 }, lawful: { reformers: 2, doves: 1 }, votes: { reformers: 1 }, police: { security: 2, hardliners: 1 } },
  intelligence: { abroad: { security: 1, hawks: 1 }, watch: { security: 2 }, covert: { security: 1, hawks: 1 }, caution: { doves: 1 }, influence: { security: 2 } },
  science: { budget: { reformers: 1 }, weapons: { hawks: 2 }, pure: { doves: 1, reformers: 1 }, prestige: { reformers: 1 }, open: { reformers: 2, doves: 1 } },
};

/** Causes that cannot both be served: people who push them are rivals. */
const OPPOSED: [string, string][] = [
  ["military.budget", "finance.balance"],
  ["military.offensive", "military.caution"],
  ["military.offensive", "foreign.neutral"],
  ["foreign.hardline", "foreign.trade"],
  ["foreign.hardline", "finance.openness"],
  ["foreign.allies", "foreign.neutral"],
  ["industry.war", "industry.provision"],
  ["finance.openness", "finance.industry"],
  ["finance.growth", "finance.balance"],
  ["interior.order", "interior.lawful"],
  ["interior.press", "interior.lawful"],
  ["chief.reform", "chief.calm"],
  ["chief.reform", "interior.order"],
  ["science.weapons", "science.pure"],
  ["science.open", "intelligence.caution"],
  ["intelligence.covert", "intelligence.caution"],
  ["intelligence.influence", "chief.apparatus"],
];

/** Factions whose causes pull against each other. */
const FACTION_RIVALS: [Lean, Lean][] = [
  ["hawks", "doves"],
  ["reformers", "hardliners"],
];

/** The ministries that hold the levers of force and of access to the leader. */
const POWER: AdvisorId[] = ["chief", "military", "interior", "intelligence"];

/** How senior a cabinet post is: a move up pleases, a move down humiliates. */
const POST_RANK: Record<AdvisorId, number> = { chief: 3, foreign: 3, interior: 3, military: 3, finance: 2, intelligence: 2, industry: 1, science: 1 };

/** Favour that moves loyalty a step. */
export const FAVOUR_STEP = 3;
/** The most a turn's orders, laws and moods move a person's favour, either way. */
export const TURN_SWING = 2;

const MOOD_WEIGHT = { loyal: 0, uneasy: 0.5, opposed: 1, resigning: 1.5 } as const;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round1 = (v: number) => Math.round(v * 10) / 10;
const game = (state: Pick<GameState, "seed" | "id">) => state.seed ?? state.id;
/** The months a period lasts, for the cabinet's pace: as the deputies' plots count them. */
const monthsOf = (state: Pick<GameState, "step">) => clamp(STEP_YEARS[state.step] * 12, 0.25, 3);
/** The chance over a period of something with this chance a month. */
const over = (perMonth: number, months: number) => 1 - (1 - clamp(perMonth, 0, 0.95)) ** months;

/** A person of the cabinet who wants things: a minister of the eight ministries, or one of their deputies. */
export interface Insider {
  name: string;
  post: OfficialPost;
  ministry: AdvisorId;
  /** The deputy's id; missing for a minister. */
  deputy?: string;
  person: Official | Deputy;
}

/**
 * Every minister and deputy with interests, ministers first, in the
 * cabinet's order. A player who is one of them (engine/role.ts) is not
 * among them: they do not scheme against themselves.
 */
export function insidersOf(state: Pick<GameState, "officials" | "deputies" | "role">): Insider[] {
  const self = state.role && state.role.kind !== "leader" ? state.role.person?.name : undefined;
  const mine = (name: string) => Boolean(self && samePerson(self, name));
  const ministers = (state.officials ?? []).flatMap((o): Insider[] => {
    const ministry = MINISTRY_OF[o.post];
    return ministry && o.interests && !mine(o.name) ? [{ name: o.name, post: o.post, ministry, person: o }] : [];
  });
  const deputies = (state.deputies ?? []).flatMap((d): Insider[] => {
    const ministry = MINISTRY_OF[d.deputyOf];
    return ministry && d.interests && !mine(d.name) ? [{ name: d.name, post: d.deputyOf, ministry, deputy: d.id, person: d }] : [];
  });
  const order = (p: Insider) => ADVISORS.indexOf(p.ministry);
  return [...ministers.sort((a, b) => order(a) - order(b)), ...deputies.sort((a, b) => order(a) - order(b))];
}

/** How a person stands with the leader now, 1–5: their loyalty, the favour they have gathered, and their mood. */
export function standing(o: Pick<Official, "loyalty" | "favour" | "mood">): number {
  return clamp(o.loyalty + ((o.favour ?? 0) / FAVOUR_STEP) * 0.9 - (o.mood ? MOOD_WEIGHT[o.mood.stance] : 0), 1, 5);
}

/** A person's causes as "ministry.cause". */
const causesOf = (p: Insider) => (p.person.interests?.agenda ?? []).filter((id) => CAUSE_LEAN[p.ministry][id]).map((id) => `${p.ministry}.${id}`);
const ambitionOf = (p: Insider) => p.person.interests?.ambition ?? 3;

/** Where a person's causes, post and ambition put them. */
export function leanOf(p: Insider): Lean {
  const score: Record<Lean, number> = { hawks: 0, doves: 0, reformers: 0, hardliners: 0, security: 0 };
  for (const id of p.person.interests?.agenda ?? []) for (const [k, v] of Object.entries(CAUSE_LEAN[p.ministry][id] ?? {})) score[k as Lean] += v;
  // The ambitious who hold a lever of force want more of it.
  if (ambitionOf(p) >= 4 && POWER.includes(p.ministry)) score.security += 1;
  return TIES.reduce((best, k) => (score[k] > score[best] ? k : best), TIES[0]);
}

export type Temper = "loyal" | "restive" | "disloyal";

/** A faction of the cabinet: two or more people who want the same, at least one of them a minister. */
export interface Faction {
  /** "hawks", "doves", …, or "party:<name>" for a coalition partner's bloc. */
  id: string;
  kind: FactionKind;
  party?: string;
  /** Names, who speaks for it first, then the ministers, then the deputies. */
  members: string[];
  /** The ministries its ministers head. */
  ministries: AdvisorId[];
  /** Who speaks for it: the most ambitious and able, a minister before a deputy. */
  head: string;
  /** Its people's standing with the leader, on average, 1–5. */
  loyalty: number;
  temper: Temper;
  /** How many of the levers of force and access its ministers hold. */
  power: number;
}

/** A faction's temper by its people's standing: loyal, restive (it talks), disloyal (it acts). */
export const temperOf = (loyalty: number): Temper => (loyalty >= 3 ? "loyal" : loyalty >= 2.25 ? "restive" : "disloyal");

/** The cabinet's factions as its people stand now, in a fixed order. */
export function factionsOf(state: Pick<GameState, "officials" | "deputies" | "role" | "politics">, people = insidersOf(state)): Faction[] {
  const partners = new Set((state.politics?.parties ?? []).filter((p) => p.status === "coalition").map((p) => p.name.trim().toLowerCase()));
  const groups = new Map<string, Insider[]>();
  const join = (id: string, p: Insider) => groups.set(id, [...(groups.get(id) ?? []), p]);
  for (const p of people) {
    const party = p.person.interests?.party?.trim();
    join(party && partners.has(party.toLowerCase()) ? `party:${party}` : leanOf(p), p);
  }
  // A partner's lone minister, or its deputies alone, make no bloc: each goes where their causes lead.
  for (const [id, ps] of [...groups]) {
    if (!id.startsWith("party:") || (ps.length >= 2 && ps.some((p) => !p.deputy))) continue;
    groups.delete(id);
    for (const p of ps) join(leanOf(p), p);
  }
  const rank = (id: string) => (id.startsWith("party:") ? LEANS.length : LEANS.indexOf(id as Lean));
  return [...groups]
    .filter(([, ps]) => ps.length >= 2 && ps.some((p) => !p.deputy))
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([id, ps]) => {
      const loyalty = round1(ps.reduce((s, p) => s + standing(p.person), 0) / ps.length);
      const ministries = [...new Set(ps.filter((p) => !p.deputy).map((p) => p.ministry))];
      const head = [...ps].sort((a, b) => Number(Boolean(a.deputy)) - Number(Boolean(b.deputy)) || ambitionOf(b) * 2 + b.person.competence - (ambitionOf(a) * 2 + a.person.competence))[0].name;
      const party = id.startsWith("party:") ? id.slice(6) : undefined;
      return {
        id,
        kind: party ? ("party" as const) : (id as Lean),
        ...(party ? { party } : {}),
        members: [head, ...ps.map((p) => p.name).filter((n) => n !== head)],
        ministries,
        head,
        loyalty,
        temper: temperOf(loyalty),
        power: ministries.filter((m) => POWER.includes(m)).length,
      };
    });
}

/** The faction a person belongs to, if any. */
export const factionOf = (factions: Faction[], name: string) => factions.find((f) => f.members.includes(name));

export type RivalWhy = "post" | "causes";

/**
 * A person's rivals in the cabinet: two ambitious ministers who both want a
 * higher post, a deputy who resents their chief and wants their chair, and
 * people who push causes that cannot both be served.
 */
export function rivalsOf(state: Pick<GameState, "officials" | "deputies" | "role">, name: string, people = insidersOf(state)): { name: string; why: RivalWhy }[] {
  const me = people.find((p) => p.name === name);
  if (!me) return [];
  const mine = causesOf(me);
  const resents = (a: Insider, b: Insider) => Boolean(a.deputy && !b.deputy && a.post === b.post && (a.person as Deputy).chiefLoyalty <= 2 && ambitionOf(a) >= 4);
  const out: { name: string; why: RivalWhy }[] = [];
  for (const other of people) {
    if (other === me) continue;
    if ((ambitionOf(me) >= 4 && ambitionOf(other) >= 4 && !me.deputy && !other.deputy) || resents(me, other) || resents(other, me)) {
      out.push({ name: other.name, why: "post" });
      continue;
    }
    const theirs = causesOf(other);
    if (OPPOSED.some(([a, b]) => (mine.includes(a) && theirs.includes(b)) || (mine.includes(b) && theirs.includes(a)))) out.push({ name: other.name, why: "causes" });
  }
  return out;
}

/** Whether two factions are at odds: their causes pull apart, or their people are rivals. */
export function factionsAtOdds(a: Faction, b: Faction, state: Pick<GameState, "officials" | "deputies" | "role">, people = insidersOf(state)): boolean {
  if (a.id === b.id) return false;
  if (FACTION_RIVALS.some(([x, y]) => (a.kind === x && b.kind === y) || (a.kind === y && b.kind === x))) return true;
  return a.members.some((m) => rivalsOf(state, m, people).some((r) => b.members.includes(r.name)));
}

type CabinetPlotOf = Plot & { cabinet: NonNullable<Plot["cabinet"]> };

/** The plots inside the cabinet, kept by the engine. */
export const cabinetPlots = (state: Pick<GameState, "politics">): CabinetPlotOf[] => (state.politics?.plots ?? []).filter((p): p is CabinetPlotOf => Boolean(p.cabinet));

/** The cabinet plot a person is in, if any. */
export const plotOf = (state: Pick<GameState, "politics">, name: string) => cabinetPlots(state).find((p) => p.cabinet.members.includes(name));

/** Whether the cabinet's intrigues are the player's concern: they govern, and still stand. */
const inPlay = (state: GameState) => !isOpposition(state) && Boolean(state.politics) && !(state.defeat && !state.defeat.continued);

// ——— Obstruction ———

/**
 * The ministries a disloyal faction holds drag their feet this period, and
 * the dice pick which of their directives they hold up. Decided before the
 * turn is written, so the game master can tell it and replaying ends the same.
 */
export function obstructionOf(state: GameState, factions?: Faction[]): { ministries: AdvisorId[]; heldUp: string[] } {
  if (!inPlay(state)) return { ministries: [], heldUp: [] };
  const ministries = [...new Set((factions ?? factionsOf(state)).filter((f) => f.temper === "disloyal").flatMap((f) => f.ministries))];
  const heldUp = (state.directives ?? []).filter((d) => ministries.includes(d.ministry) && roll(game(state), state.turn, `cabinet:held:${d.id}`) < 0.5).map((d) => d.id);
  return { ministries, heldUp };
}

/**
 * The verdicts as obstructing ministries carry them out: an order the game
 * master says such a ministry carried out comes off at best partly, and is
 * marked so the report can say who dragged their feet. The ministry stays on
 * a verdict only then.
 */
export function markDownVerdicts(state: GameState, verdicts: OrderVerdict[]): OrderVerdict[] {
  const { ministries } = obstructionOf(state);
  return verdicts.map(({ by, ...v }) => (by && ministries.includes(by) ? { ...v, by, result: v.result === "success" ? "partial" : v.result, obstructed: true } : v));
}

/** A ministry's word on its directives with the held-up ones still under way, whatever the game master says. */
export function holdUpDirectives<T extends { directives: { id: string; status: "progress" | "done" | "failed" }[] }>(state: GameState, word: T[]): T[] {
  const { heldUp } = obstructionOf(state);
  if (!heldUp.length) return word;
  return word.map((m) => ({ ...m, directives: m.directives.map((d) => (heldUp.includes(d.id) && d.status === "done" ? { ...d, status: "progress" as const } : d)) }));
}

// ——— What the period brings ———

export interface LeakRoll {
  faction: string;
  by: string;
  /** A covert operation of its ministries that it gave away, by directive id. */
  directive?: string;
}

export interface PlotRoll {
  id: string;
  faction: string;
  event: "begun" | "grows" | "strikes" | "faded" | "moot";
  /** Strength after the period. */
  strength: number;
  /** A plot that begins this period. */
  plot?: Plot;
  /** The intelligence service heard of it this period, and suspects this faction ("" for nobody in particular). */
  rumour?: string;
  /** The service is now sure of it. */
  confirmed?: boolean;
  /** For a plot that strikes: whether it comes off. */
  success?: boolean;
}

export interface CabinetRoll {
  factions: Faction[];
  obstruct: AdvisorId[];
  heldUp: string[];
  leaks: LeakRoll[];
  plots: PlotRoll[];
}

const FACTION_EN: Record<Lean, string> = { hawks: "the hawks", doves: "the doves", reformers: "the reformers", hardliners: "the hardliners", security: "the security clique" };
/** A faction's name for the model, by its id. */
export const factionEn = (id: string) => (id.startsWith("party:") ? `the ${id.slice(6)} ministers` : (FACTION_EN[id as Lean] ?? id));

/** The levers of force and access a set of plotters holds. */
const leversOf = (plotters: Insider[]) => new Set(plotters.filter((p) => !p.deputy && POWER.includes(p.ministry)).map((p) => p.ministry)).size;

/** Strength a plot gains in a month before the dice: more people, more levers, abler and angrier plotters move faster; a loyal, able head of intelligence slows them. */
function plotGain(state: GameState, plotters: Insider[]): number {
  if (!plotters.length) return 0;
  const competence = plotters.reduce((s, p) => s + p.person.competence, 0) / plotters.length;
  const loyalty = plotters.reduce((s, p) => s + standing(p.person), 0) / plotters.length;
  const spy = officialAt(state, "intelligence");
  const watching = spy && standing(spy) >= 3 && !plotters.some((p) => p.name === spy.name) ? 1.5 * (spy.competence - 1) : 0;
  return Math.max(1, 3 + 2.5 * plotters.length + 3 * leversOf(plotters) + 2 * (competence - 3) + 4 * (2.5 - loyalty) - watching);
}

/** Who a faction would strike at: the leader, when it holds the levers or has someone who wants the top job; else the minister most in its way. */
function targetOf(state: GameState, f: Faction, factions: Faction[], people: Insider[]): { target: OfficialPost | "leader"; name: string } | null {
  const plotters = people.filter((p) => f.members.includes(p.name));
  const leader = leaderOf(state, state.player);
  if (leader && (f.power >= 2 || (plotters.some((p) => ambitionOf(p) >= 5) && plotters.length >= 3))) return { target: "leader", name: leader.name };
  const rivals = new Set(rivalsOf(state, f.head, people).map((r) => r.name));
  const odds = factions.filter((g) => factionsAtOdds(f, g, state, people));
  const best = people
    .filter((p) => !p.deputy && !f.members.includes(p.name))
    .map((p) => ({ p, score: (odds.some((g) => g.members.includes(p.name)) ? 2 : 0) + (rivals.has(p.name) ? 2 : 0) + standing(p.person) / 2 + (POWER.includes(p.ministry) ? 1 : 0) }))
    .sort((a, b) => b.score - a.score)[0];
  return best ? { target: best.p.post, name: best.p.name } : null;
}

/** The chance a month that the intelligence service hears of a plot, and how likely it is to blame the right people. */
function hearing(state: GameState, plot: CabinetPlotOf, factions: Faction[], people: Insider[]): { rate: number; accuracy: number } {
  const spy = officialAt(state, "intelligence");
  const inIt = Boolean(spy && plot.cabinet.members.includes(spy.name));
  const own = factions.find((f) => f.id === plot.cabinet.faction);
  // Rival factions with a minister where the court can be watched inform on the plotters.
  const informers = own ? factions.filter((g) => g.temper !== "disloyal" && factionsAtOdds(own, g, state, people) && g.ministries.some((m) => POWER.includes(m))).length : 0;
  const base = !spy ? 0.03 : inIt ? 0 : 0.05 + 0.03 * (spy.competence - 3) + (standing(spy) >= 4 ? 0.03 : 0);
  const fog = fogOn(state);
  const rate = base + 0.04 * informers + 0.03 * (plot.strength / 25) + (fog ? 0 : 0.05);
  const accuracy = clamp(0.45 + 0.12 * ((spy?.competence ?? 2) - 3) + (fog ? 0 : 0.5) - (inIt ? 0.3 : 0), 0.2, 0.95);
  return { rate, accuracy };
}

/** Whom a cabinet plot aims at now, by name: the leader, or whoever holds the post. */
const aimOf = (state: GameState, plot: CabinetPlotOf) => (plot.cabinet.target === "leader" ? leaderOf(state, state.player)?.name : officialAt(state, plot.cabinet.target)?.name);

/**
 * What the period does to the cabinet, decided by the dice before the turn
 * is written: which ministries drag their feet, which factions leak, and
 * how each plot fares – begun, grown, heard of, faded or struck.
 */
export function castCabinet(state: GameState): CabinetRoll {
  if (!inPlay(state)) return { factions: [], obstruct: [], heldUp: [], leaks: [], plots: [] };
  const people = insidersOf(state);
  const factions = factionsOf(state, people);
  const seed = game(state);
  const months = monthsOf(state);
  const { ministries: obstruct, heldUp } = obstructionOf(state, factions);
  const leaks: LeakRoll[] = [];
  for (const f of factions) {
    if (f.temper === "loyal") continue;
    if (roll(seed, state.turn, `cabinet:leak:${f.id}`) >= over(f.temper === "disloyal" ? 0.12 : 0.05, months)) continue;
    const secret = (state.directives ?? []).find((d) => f.ministries.includes(d.ministry) && d.operation && d.operation.secrecy !== "open");
    leaks.push({ faction: f.id, by: f.head, ...(secret ? { directive: secret.id } : {}) });
  }

  const plots: PlotRoll[] = [];
  const pillars = state.politics ? loyaltyOf(state.politics) : null;
  for (const plot of cabinetPlots(state)) {
    const plotters = people.filter((p) => plot.cabinet.members.includes(p.name));
    const aim = aimOf(state, plot);
    // Its target gone or its people gone, the plot is over.
    if (!plotters.length || !aim || !samePerson(aim, plot.cabinet.targetName)) {
      plots.push({ id: plot.id, faction: plot.cabinet.faction, event: "moot", strength: plot.strength });
      continue;
    }
    const loyalty = plotters.reduce((s, p) => s + standing(p.person), 0) / plotters.length;
    // People won back lose the will to go on.
    if (loyalty >= 3.5 && roll(seed, state.turn, `cabinet:fade:${plot.id}`) < 0.5) {
      plots.push({ id: plot.id, faction: plot.cabinet.faction, event: "faded", strength: plot.strength });
      continue;
    }
    const gain = plotGain(state, plotters) * months * (0.6 + 0.8 * roll(seed, state.turn, `cabinet:gain:${plot.id}`));
    const strength = Math.min(100, Math.round(plot.strength + gain));
    const out: PlotRoll = { id: plot.id, faction: plot.cabinet.faction, event: strength >= 100 ? "strikes" : "grows", strength };
    if (!plot.known) {
      const spy = officialAt(state, "intelligence");
      if (!plot.cabinet.rumour) {
        const { rate, accuracy } = hearing(state, plot, factions, people);
        if (roll(seed, state.turn, `cabinet:hear:${plot.id}`) < over(rate, months)) {
          const others = factions.filter((f) => f.id !== plot.cabinet.faction);
          const right = !others.length || roll(seed, state.turn, `cabinet:blame:${plot.id}`) < accuracy;
          out.rumour = right ? plot.cabinet.faction : others[Math.floor(roll(seed, state.turn, `cabinet:wrong:${plot.id}`) * others.length)].id;
        }
      } else if (spy && spy.competence >= 4 && standing(spy) >= 3 && !plot.cabinet.members.includes(spy.name) && roll(seed, state.turn, `cabinet:sure:${plot.id}`) < 0.25) {
        out.confirmed = true;
      }
    }
    if (out.event === "strikes") {
      const levers = leversOf(plotters);
      let chance: number;
      if (plot.cabinet.target === "leader") {
        const army = pillars?.army ?? 60;
        const security = pillars?.security ?? 60;
        const shielded = army >= 70 && (pillars?.police ?? 60) >= 70;
        chance = clamp(0.25 + 0.12 * levers + (security < 50 ? 0.15 : 0) + (army < 50 ? 0.15 : 0) - (shielded ? 0.2 : 0) + ((state.politics?.unrest ?? 0) >= 50 ? 0.1 : 0), 0.1, 0.75);
      } else {
        const target = officialAt(state, plot.cabinet.target);
        chance = clamp(0.45 + 0.1 * (plotters.length - 2) + 0.1 * levers - 0.08 * ((target ? standing(target) : 3) - 3), 0.15, 0.85);
      }
      out.success = roll(seed, state.turn, `cabinet:strike:${plot.id}`) < chance;
    }
    plots.push(out);
  }

  for (const f of factions) {
    if (f.temper !== "disloyal" || cabinetPlots(state).some((p) => p.cabinet.faction === f.id)) continue;
    if (f.members.some((m) => plotOf(state, m))) continue;
    const plotters = people.filter((p) => f.members.includes(p.name));
    const ambition = Math.max(...plotters.map(ambitionOf));
    const rate = 0.04 + 0.03 * (ambition - 3) + 0.08 * (2.25 - f.loyalty) + 0.02 * f.power;
    if (roll(seed, state.turn, `cabinet:plot:${f.id}`) >= over(Math.max(0.02, rate), months)) continue;
    const aim = targetOf(state, f, factions, people);
    if (!aim) continue;
    const strength = Math.round(clamp(5 + plotGain(state, plotters) * months * 0.5, 5, 40));
    const id = `cabinet-${state.turn}-${f.id.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
    const plot: Plot = {
      id,
      title: `${factionEn(f.id).replace(/^the /, "The ")} against ${aim.name}`,
      by: f.members.slice(0, 3).join(", "),
      kind: aim.target === "leader" ? "coup" : "conspiracy",
      strength,
      known: false,
      since: state.date,
      cabinet: { faction: f.id, members: f.members, target: aim.target, targetName: aim.name },
    };
    plots.push({ id, faction: f.id, event: "begun", strength, plot });
  }
  return { factions, obstruct, heldUp, leaks, plots };
}

// ——— The turn ———

/** How the game master says a turn touched people's causes (merged into OutcomeSchema as `cabinet`). */
export const cabinetField = z
  .array(z.object({ name: z.string().trim().min(1).max(200), sway: z.enum(["for", "against"]).catch("for") }))
  .max(8)
  .catch([])
  .default([]);

export type CabinetSway = z.infer<typeof cabinetField>;

/** A name the game master gives, matched to a person of the cabinet: in full, or by a surname only one of them has. */
function findInsider(people: Insider[], name: string): Insider | undefined {
  const exact = people.find((p) => p.name === name.trim()) ?? people.find((p) => samePerson(p.name, name));
  if (exact) return exact;
  const last = (n: string) => n.trim().split(/\s+/).at(-1)?.toLowerCase();
  const by = people.filter((p) => last(p.name) === last(name));
  return by.length === 1 ? by[0] : undefined;
}

/** The game master's word on causes, kept for people of the cabinet, one each, by their own names. */
export function sanitizeSway(state: GameState, sway: CabinetSway): CabinetSway {
  if (!inPlay(state) || !sway.length) return [];
  const people = insidersOf(state);
  const seen = new Set<string>();
  return sway.flatMap((s) => {
    const p = findInsider(people, s.name);
    if (!p || seen.has(p.name)) return [];
    seen.add(p.name);
    return [{ name: p.name, sway: s.sway }];
  });
}

type Signal = [cause: string, weight: number];

/** Which way a law's options run, from the most open to the most closed (LAWS), for the causes it serves. */
const LAW_LEAN: Partial<Record<LawId, Signal[]>> = {
  press: [["interior.press", 1], ["interior.lawful", -1], ["science.open", -0.5]],
  assembly: [["interior.order", 1], ["interior.lawful", -1]],
  martial: [["interior.order", 1], ["interior.lawful", -1], ["chief.calm", -0.5]],
  elections: [["interior.votes", -1], ["chief.reform", -1], ["interior.lawful", -0.5]],
  economy: [["finance.openness", -1], ["finance.industry", 1], ["industry.output", 0.5], ["finance.growth", -0.5]],
  conscription: [["military.professional", -1], ["military.budget", 0.5]],
  alignment: [["foreign.allies", 1], ["foreign.neutral", -1]],
  deathPenalty: [["interior.order", 0.5], ["interior.lawful", -1]],
  exit: [["science.open", -1], ["finance.openness", -0.5]],
};

const WAR_START: Signal[] = [["military.offensive", 1], ["foreign.hardline", 1], ["military.caution", -1], ["foreign.neutral", -1], ["chief.calm", -1]];
const PEACE: Signal[] = [["foreign.neutral", 1], ["military.caution", 0.5], ["chief.calm", 0.5], ["military.offensive", -0.5], ["foreign.hardline", -0.5]];
const BLOC: Signal[] = [["foreign.allies", 1], ["foreign.neutral", -1]];
const SANCTION: Signal[] = [["foreign.hardline", 0.5], ["foreign.trade", -1], ["finance.openness", -0.5], ["industry.exports", -0.5]];

/**
 * What the government did this turn, read from the state and the changes as
 * causes served (above zero) or trampled (below): the budget it set, laws,
 * wars it began and peace it made, blocs it joined, sanctions and deals.
 */
export function causeSignals(state: GameState, next: GameState, applied: AppliedChange[]): Map<string, number> {
  const out = new Map<string, number>();
  const add = (list: Signal[], sign = 1) => {
    if (sign) list.forEach(([k, v]) => out.set(k, (out.get(k) ?? 0) + v * sign));
  };
  const b = state.budgetSet;
  if (b) {
    const moved = (key: "army" | "social" | "industry") => (b.before[key] > 0 ? b.after[key] / b.before[key] - 1 : b.after[key] > 0 ? 1 : 0);
    const step = (v: number) => (v >= 0.1 ? 1 : v <= -0.1 ? -1 : 0);
    add([["military.budget", 1], ["industry.war", 0.5]], step(moved("army")));
    add([["industry.provision", 1], ["chief.ratings", 0.5]], step(moved("social")));
    add([["industry.output", 1], ["finance.growth", 0.5]], step(moved("industry")));
    const gap = (x: typeof b.before) => x.revenue - x.army - x.industry - x.social - x.other;
    const worse = b.before.revenue > 0 ? (gap(b.before) - gap(b.after)) / b.before.revenue : 0;
    add([["finance.balance", 1], ["finance.prices", 0.5]], worse >= 0.05 ? -1 : worse <= -0.05 ? 1 : 0);
  }
  const me = state.player;
  const fights = (war: string) => state.wars.some((w) => w.id === war && (w.attackers.includes(me) || w.defenders.includes(me)));
  for (const c of applied) {
    if (c.kind === "law" && c.from && LAW_LEAN[c.law]) {
      const options = LAWS[c.law] as readonly string[];
      add(LAW_LEAN[c.law]!, Math.sign(options.indexOf(c.to) - options.indexOf(c.from)));
    } else if (c.kind === "war" && next.wars.find((w) => w.id === c.war)?.attackers.includes(me)) add(WAR_START);
    else if (c.kind === "enter" && c.country === me) add(WAR_START, 0.5);
    else if (c.kind === "peace" && (c.sides ? c.sides.includes(me) : fights(c.war))) add(PEACE);
    else if ((c.kind === "accession" && c.country === me) || (c.kind === "alliance" && c.members?.includes(me))) add(BLOC);
    else if (c.kind === "sanction" && c.by === me) add(SANCTION, c.change === "lifted" ? -1 : 1);
    else if (c.kind === "deal" && c.change === "signed") add([["foreign.trade", 0.5], ["finance.openness", 0.5], c.side === "sell" ? ["industry.exports", 1] : ["industry.resources", 0.5]]);
  }
  return out;
}

/** A person with favour added: a full measure moves their loyalty a step, as far as 1–5 allows. */
export function withFavour<T extends Official>(o: T, delta: number): T {
  let favour = (o.favour ?? 0) + delta;
  let loyalty = o.loyalty;
  while (favour >= FAVOUR_STEP && loyalty < 5) {
    favour -= FAVOUR_STEP;
    loyalty += 1;
  }
  while (favour <= -FAVOUR_STEP && loyalty > 1) {
    favour += FAVOUR_STEP;
    loyalty -= 1;
  }
  favour = round1(clamp(favour, -(FAVOUR_STEP - 0.1), FAVOUR_STEP - 0.1));
  const next: T = { ...o, loyalty };
  if (favour) next.favour = favour;
  else delete next.favour;
  return next;
}

/** Favour added to people by name, ministers and deputies alike, in place; each step of loyalty they move is logged when asked. */
function favourPeople(next: GameState, deltas: Map<string, number>, applied?: AppliedChange[]): void {
  if (!deltas.size) return;
  const move = <T extends Official>(o: T): T => {
    const delta = deltas.get(o.name);
    if (!delta) return o;
    const moved = withFavour(o, delta);
    if (moved.loyalty !== o.loyalty) applied?.push({ kind: "cabinet", event: "loyalty", name: o.name, from: o.loyalty, to: moved.loyalty });
    return moved;
  };
  if (next.officials) next.officials = next.officials.map(move);
  if (next.deputies) next.deputies = next.deputies.map(move);
}

/** People's favour moved now, between turns: a new state. */
function favoured(state: GameState, deltas: Map<string, number>): GameState {
  const next = { ...state };
  favourPeople(next, deltas);
  return next;
}

/** A plot changed in place, or removed when the patch gives nothing. */
function setPlot(next: GameState, id: string, patch: (p: Plot) => Plot | null): void {
  if (!next.politics) return;
  next.politics = { ...next.politics, plots: next.politics.plots.flatMap((p) => (p.id === id ? (patch(p) ?? []) : [p])) };
}

/** Ministers of a list out of the government, in place: dismissed where votes count, arrested elsewhere. The ones removed. */
function removeMinisters(next: GameState, names: string[], change: "dismissed" | "arrested", applied: AppliedChange[]): Official[] {
  const out = (next.officials ?? []).filter((o) => MINISTRY_OF[o.post] && names.includes(o.name));
  if (!out.length) return out;
  next.officials = next.officials!.filter((o) => !out.includes(o));
  for (const o of out) applied.push({ kind: "official", post: o.post, title: o.title, name: o.name, change });
  return out;
}

/** A deputy takes the empty chair of their ministry under the post's title: they leave the deputies and keep who they are. */
function seatDeputy(next: GameState, deputy: Deputy, title: string, to: string, applied: AppliedChange[]): void {
  if (officialAt(next, deputy.deputyOf)) return;
  const official: Official = {
    post: deputy.deputyOf,
    title,
    name: deputy.name,
    traits: deputy.traits,
    manner: deputy.manner,
    competence: deputy.competence,
    loyalty: deputy.loyalty,
    ...(deputy.faction ? { faction: deputy.faction } : {}),
    ...(deputy.bio ? { bio: deputy.bio } : {}),
    ...(deputy.interests ? { interests: deputy.interests } : {}),
    ...(deputy.gender ? { gender: deputy.gender } : {}),
    ...(deputy.portrait ? { portrait: deputy.portrait } : {}),
    ...(deputy.favour ? { favour: deputy.favour } : {}),
    since: to,
  };
  next.officials = [...(next.officials ?? []), official].sort((a, b) => OFFICIAL_POSTS.indexOf(a.post) - OFFICIAL_POSTS.indexOf(b.post));
  next.deputies = (next.deputies ?? []).filter((d) => d.id !== deputy.id);
  applied.push({ kind: "official", post: official.post, title, name: official.name, change: "appointed" });
}

/**
 * A turn for the cabinet, once the turn's own changes to the government
 * have landed: the government's moves since the last turn go into the
 * record; plots the turn foiled shame those in them; the dice cast before
 * the turn land – plots begin, grow, are heard of, fade or strike, factions
 * leak; and the period's orders, laws and moods move people's favour.
 */
export function applyCabinet(next: GameState, state: GameState, sway: CabinetSway, ctx: { turn: number; to: string }, applied: AppliedChange[]): void {
  const moves = state.cabinet?.moves ?? [];
  delete next.cabinet;
  if (!inPlay(state)) return;
  for (const m of moves) {
    const change = m.kind === "dismiss" ? "dismissed" : m.kind === "reshuffle" ? "resigned" : holdsElections(state) ? "dismissed" : "arrested";
    for (const o of m.removed ?? []) applied.push({ kind: "official", post: o.post, title: o.title, name: o.name, change });
  }
  // A government that fell this turn has no cabinet left to scheme in.
  if (next.defeat && !next.defeat.continued && next.defeat.turn === ctx.turn) return;

  const free = holdsElections(state);
  const cast = castCabinet(state);
  const deltas = new Map<string, number>();
  const add = (name: string, v: number) => deltas.set(name, (deltas.get(name) ?? 0) + v);

  // Plots the turn itself foiled: those in them are shamed.
  const standingPlots = new Map((next.politics?.plots ?? []).map((p) => [p.id, p]));
  for (const p of cabinetPlots(state)) if (!standingPlots.has(p.id) && !cast.plots.some((r) => r.id === p.id && r.event === "moot")) p.cabinet.members.forEach((m) => add(m, -FAVOUR_STEP));

  for (const r of cast.plots) {
    if (r.event === "begun") {
      if (r.plot && next.politics) next.politics = { ...next.politics, plots: [...next.politics.plots, r.plot] };
      continue;
    }
    const plot = standingPlots.get(r.id);
    if (!plot?.cabinet) continue;
    const { target, targetName } = plot.cabinet;
    const tag = { cabinet: { faction: plot.cabinet.faction, target, targetName } };
    // The turn may have taken the target or the plotters away since the dice were cast.
    const members = plot.cabinet.members.filter((m) => insidersOf(next).some((p) => p.name === m));
    const aim = target === "leader" ? leaderOf(next, next.player)?.name : officialAt(next, target)?.name;
    if (r.event === "moot" || r.event === "faded" || !members.length || !aim || !samePerson(aim, targetName)) {
      setPlot(next, r.id, () => null);
      if (plot.known) applied.push({ kind: "plot", title: plot.title, change: "faded", ...tag });
      continue;
    }
    const cabinet = { ...plot.cabinet, members, ...(r.rumour !== undefined ? { rumour: { faction: r.rumour, turn: ctx.turn } } : {}) };
    setPlot(next, r.id, (p) => ({ ...p, strength: r.strength, known: p.known || Boolean(r.confirmed), cabinet }));
    if (r.confirmed && !plot.known) applied.push({ kind: "plot", title: plot.title, change: "discovered", ...tag });
    if (r.event !== "strikes") continue;
    if (r.success) {
      if (target === "leader") {
        applyOverthrow(next, { happened: true, how: "deposed", by: members[0], leader: members[0], note: "" }, ctx, applied);
        if (next.defeat?.turn === ctx.turn) return;
        // A government the engine will not let fall stands; the attempt is logged as foiled.
        setPlot(next, r.id, () => null);
        continue;
      } else {
        const [gone] = removeMinisters(next, [aim], "dismissed", applied);
        // A plotter serving as a deputy in that ministry takes the chair.
        const heir = next.deputies?.find((d) => d.deputyOf === target && members.includes(d.name));
        if (heir && gone) seatDeputy(next, heir, gone.title, ctx.to, applied);
      }
      setPlot(next, r.id, () => null);
      applied.push({ kind: "plot", title: plot.title, change: "succeeded", ...tag });
    } else {
      setPlot(next, r.id, () => null);
      applied.push({ kind: "plot", title: plot.title, change: "foiled", ...tag });
      removeMinisters(next, members, free ? "dismissed" : "arrested", applied);
      if (next.deputies) next.deputies = next.deputies.filter((d) => !members.includes(d.name));
      if (next.politics) {
        const pillars = loyaltyOf(next.politics);
        next.politics = { ...next.politics, loyalty: { ...pillars, elites: clamp(pillars.elites - 4, 0, 100) } };
      }
    }
  }

  // Leaks: the street hears of the government's quarrels, and a secret operation given away is secret no more.
  for (const leak of cast.leaks) {
    const d = next.directives?.find((x) => x.id === leak.directive && x.operation);
    if (d) next.directives = next.directives!.map((x) => (x === d ? { ...x, operation: { ...x.operation!, secrecy: "open" as const } } : x));
    if (next.politics) next.politics = { ...next.politics, unrest: clamp(next.politics.unrest + 2 + (d ? 1 : 0) + (free ? 1 : 0), 0, 100) };
    applied.push({ kind: "cabinet", event: "leak", faction: leak.faction, by: leak.by, ...(d?.operation ? { operation: d.operation.name } : {}) });
  }

  // The period's orders and laws for and against people's causes, as the engine reads them and the game master says; a fresh grievance festers.
  const signals = causeSignals(state, next, applied);
  for (const p of insidersOf(next)) {
    let v = causesOf(p).reduce((s, k) => s + (signals.get(k) ?? 0), 0);
    const said = sway.find((s) => s.name === p.name);
    if (said) v += said.sway === "for" ? 1 : -1;
    const mood = p.person.mood;
    if (mood && mood.turn >= state.turn - 1) v -= (MOOD_WEIGHT[mood.stance] * 2) / 3;
    v = clamp(v, -TURN_SWING, TURN_SWING);
    if (v) add(p.name, v);
  }
  favourPeople(next, new Map([...deltas].map(([k, v]) => [k, round1(v)])), applied);
}

// ——— The government's moves ———

export type CabinetRefusal = "unknown" | "this-turn" | "once" | "no-service" | "no-faction" | "governs-not";

const movedThisTurn = (state: Pick<GameState, "cabinet" | "turn">, kind: CabinetMove["kind"]) => (state.cabinet?.moves ?? []).some((m) => m.kind === kind && m.turn === state.turn);

/** The move, added to the record of moves since the last turn. */
function logMove(state: GameState, move: Omit<CabinetMove, "turn">, now: Date): GameState {
  return { ...state, cabinet: { moves: [...(state.cabinet?.moves ?? []), { ...move, turn: state.turn }] }, updatedAt: now.toISOString() };
}

const findPerson = (state: GameState, name: string) => insidersOf(state).find((p) => p.name === name);
const ministerNamed = (state: GameState, name: string) => insidersOf(state).find((p) => p.name === name && !p.deputy)?.person as Official | undefined;

/** Why the government cannot make this move now, if it cannot: `who` is a person's name, or a faction's id for an investigation or a purge. */
export function cannotMove(state: GameState, kind: CabinetMove["kind"], who: string): CabinetRefusal | null {
  if (!inPlay(state)) return "governs-not";
  if (kind === "favour" || kind === "post") {
    const p = findPerson(state, who);
    if (!p) return "unknown";
    if (p.person.courted === state.turn) return "this-turn";
    if (kind === "post" && p.person.raised) return "once";
    return null;
  }
  if (kind === "dismiss") return ministerNamed(state, who) ? null : "unknown";
  if (kind === "reshuffle") return movedThisTurn(state, "reshuffle") ? "this-turn" : null;
  if (!factionsOf(state).some((f) => f.id === who)) return "no-faction";
  if (movedThisTurn(state, kind)) return "this-turn";
  if (kind === "investigate" && !officialAt(state, "intelligence")) return "no-service";
  return null;
}

/**
 * The government courts a person: a favour (honours, money, a dacha) or a
 * seat at the top table, once a turn, a seat only once. Most take it; a
 * plotter may pocket it and plot on. A seat that is taken stills the
 * person's ambition and blunts their faction's plot. Favouritism has a cost:
 * the person's rivals resent it.
 */
export function courtPerson(state: GameState, name: string, how: "favour" | "post", now = new Date()): { state: GameState; result?: CabinetResult; why?: CabinetRefusal } {
  const why = cannotMove(state, how, name);
  if (why) return { state, why };
  const people = insidersOf(state);
  const p = people.find((x) => x.name === name)!;
  const plot = plotOf(state, p.name);
  const pocket = plot ? 0.3 + plot.strength / 250 : 0;
  const result: CabinetResult = roll(game(state), state.turn, `cabinet:${how}:${p.name}`) < pocket ? "pocketed" : "took";
  const deltas = new Map<string, number>([[p.name, how === "post" ? (result === "took" ? 3 : 1) : result === "took" ? 2 : 0.5]]);
  for (const r of rivalsOf(state, p.name, people)) {
    const rival = people.find((x) => x.name === r.name)!;
    if (how === "favour") deltas.set(r.name, (deltas.get(r.name) ?? 0) - 0.5);
    else if (ambitionOf(rival) >= 4) deltas.set(r.name, (deltas.get(r.name) ?? 0) - 1);
  }
  const next = favoured(state, deltas);
  const mark = <T extends Official>(o: T): T => {
    if (o.name !== p.name) return o;
    const raised = how === "post" ? { raised: true, ...(result === "took" && o.interests ? { interests: { ...o.interests, ambition: Math.max(1, o.interests.ambition - 1) } } : {}) } : {};
    return { ...o, courted: state.turn, ...raised };
  };
  if (next.officials) next.officials = next.officials.map(mark);
  if (next.deputies) next.deputies = next.deputies.map(mark);
  if (how === "post" && result === "took" && plot) setPlot(next, plot.id, (x) => (x.strength - 25 <= 5 ? null : { ...x, strength: x.strength - 25 }));
  return { state: logMove(next, { kind: how, who: p.name, result }, now), result };
}

/**
 * Two ministers swap posts, once a turn. Each takes the other's post as the
 * country calls it and causes of the new portfolio (their ambition and party
 * stay theirs). A move up pleases, a move down humiliates – and someone
 * already disloyal who is moved down may resign rather than serve. The
 * swap waits in the appointments for the next turn's game master.
 */
export function reshuffle(state: GameState, a: AdvisorId, b: AdvisorId, now = new Date()): { state: GameState; results?: [CabinetResult, CabinetResult]; why?: CabinetRefusal } {
  if (!inPlay(state)) return { state, why: "governs-not" };
  if (movedThisTurn(state, "reshuffle")) return { state, why: "this-turn" };
  const one = officialAt(state, a);
  const two = officialAt(state, b);
  if (a === b || !one || !two || !ministerNamed(state, one.name) || !ministerNamed(state, two.name)) return { state, why: "unknown" };
  const moveTo = (o: Official, post: OfficialPost, title: string): { person: Official; result: CabinetResult; from: Official } => {
    const dealt = dealInterests(state, { post, name: o.name });
    const interests = dealt && o.interests ? { ...dealt, ambition: o.interests.ambition, ...(o.interests.party ? { party: o.interests.party } : {}) } : (dealt ?? o.interests);
    const up = POST_RANK[MINISTRY_OF[post]!] - POST_RANK[MINISTRY_OF[o.post]!];
    const ambitious = (o.interests?.ambition ?? 3) >= 4;
    const delta = up > 0 ? 1.5 + (ambitious ? 0.5 : 0) : up < 0 ? -2 - (ambitious ? 1 : 0) : -0.5;
    let result: CabinetResult = up > 0 ? "pleased" : up < 0 ? "humiliated" : "quiet";
    if (up < 0 && standing(o) <= 2.5 && roll(game(state), state.turn, `cabinet:resign:${o.name}`) < 0.4) result = "resigned";
    const person = withFavour({ ...o, post, title, since: state.date, ...(interests ? { interests } : {}) }, delta);
    delete person.mood;
    return { person, result, from: o };
  };
  const swaps = [moveTo(one, two.post, two.title), moveTo(two, one.post, one.title)];
  const stays = swaps.filter((x) => x.result !== "resigned");
  const officials = [...(state.officials ?? []).filter((o) => o !== one && o !== two), ...stays.map((x) => x.person)].sort((x, y) => OFFICIAL_POSTS.indexOf(x.post) - OFFICIAL_POSTS.indexOf(y.post));
  const personnel = [
    ...(state.personnel ?? []),
    ...stays.map((x) => {
      const before = x.from === one ? two : one;
      return { date: state.date, post: x.person.post, title: x.person.title, from: before.name, to: x.person.name, note: "reshuffle" };
    }),
  ];
  let next: GameState = { ...state, officials, personnel };
  for (const x of swaps) {
    const other = x.from === one ? two : one;
    next = logMove(next, { kind: "reshuffle", who: x.from.name, with: other.name, result: x.result, ...(x.result === "resigned" ? { removed: [{ post: x.from.post, title: x.from.title, name: x.from.name }] } : {}) }, now);
  }
  return { state: next, results: [swaps[0].result, swaps[1].result] };
}

/**
 * The government dismisses a minister. Their faction takes it as an insult
 * and their rivals are pleased; a plot loses one of its people, and someone
 * ambitious and disloyal may leave in anger – to the opposition, the press
 * or worse, as the next game master tells it.
 */
export function dismissMinister(state: GameState, name: string, now = new Date()): { state: GameState; result?: CabinetResult; why?: CabinetRefusal } {
  const why = cannotMove(state, "dismiss", name);
  if (why) return { state, why };
  const o = ministerNamed(state, name)!;
  const people = insidersOf(state);
  const faction = factionOf(factionsOf(state, people), o.name);
  const deltas = new Map<string, number>();
  for (const m of faction?.members ?? []) if (m !== o.name) deltas.set(m, -1.5);
  for (const r of rivalsOf(state, o.name, people)) deltas.set(r.name, (deltas.get(r.name) ?? 0) + 0.5);
  const angry = standing(o) <= 2.5 && (o.interests?.ambition ?? 3) >= 4 && roll(game(state), state.turn, `cabinet:dismiss:${o.name}`) < 0.6;
  const next = favoured({ ...state, officials: (state.officials ?? []).filter((x) => x.name !== o.name) }, deltas);
  const plot = plotOf(state, o.name);
  if (plot) {
    setPlot(next, plot.id, (p) => {
      const members = p.cabinet!.members.filter((m) => m !== o.name);
      return !members.length || p.strength - 20 <= 5 ? null : { ...p, strength: p.strength - 20, cabinet: { ...p.cabinet!, members } };
    });
  }
  if (angry && next.politics) next.politics = { ...next.politics, unrest: clamp(next.politics.unrest + 2, 0, 100) };
  const result: CabinetResult = angry ? "angry" : "quiet";
  return { state: logMove(next, { kind: "dismiss", who: o.name, result, removed: [{ post: o.post, title: o.title, name: o.name }] }, now), result };
}

/**
 * The intelligence service looks into a faction, once a turn. A plot it
 * finds is known for certain; finding nothing proves nothing – a weak or
 * disloyal service misses what is there, and a head of intelligence in the
 * plot covers it up and warns the plotters – move them first. The faction
 * may notice it is watched, and resent it.
 */
export function investigateFaction(state: GameState, factionId: string, now = new Date()): { state: GameState; result?: CabinetResult; noticed?: boolean; why?: CabinetRefusal } {
  const why = cannotMove(state, "investigate", factionId);
  if (why) return { state, why };
  const faction = factionsOf(state).find((f) => f.id === factionId)!;
  const spy = officialAt(state, "intelligence")!;
  const plot = cabinetPlots(state).find((p) => p.cabinet.faction === factionId || p.cabinet.members.some((m) => faction.members.includes(m)));
  const covering = Boolean(plot?.cabinet.members.includes(spy.name));
  const seed = game(state);
  let next: GameState = { ...state };
  let result: CabinetResult = "nothing";
  if (covering) {
    if (plot) setPlot(next, plot.id, (p) => ({ ...p, strength: Math.min(100, p.strength + 8) }));
  } else if (plot) {
    const chance = clamp(0.35 + 0.12 * (spy.competence - 3) + 0.08 * (standing(spy) - 3) + (plot.cabinet.rumour?.faction === factionId ? 0.15 : 0) + (fogOn(state) ? 0 : 0.15), 0.15, 0.9);
    if (roll(seed, state.turn, `cabinet:investigate:${factionId}`) < chance) {
      result = "found";
      setPlot(next, plot.id, (p) => {
        const cabinet = { ...p.cabinet! };
        delete cabinet.rumour;
        return { ...p, known: true, cabinet };
      });
    }
  }
  const noticed = roll(seed, state.turn, `cabinet:noticed:${factionId}`) < clamp(0.25 - 0.05 * (spy.competence - 3), 0.05, 0.45);
  if (noticed) next = favoured(next, new Map(faction.members.map((m) => [m, -1])));
  return { state: logMove(next, { kind: "investigate", who: factionId, result, ...(noticed ? { noticed: true } : {}) }, now), result, noticed };
}

/**
 * The government purges a faction, once a turn: its ministers go –
 * dismissed where votes count, arrested elsewhere – and most of its
 * deputies with them; its plot dies unless those who slip through carry it
 * on. It costs dear: the elites and the security services shaken, the
 * country more restless, a democracy's voters put off, and everyone left in
 * the cabinet afraid they are next – save the purged faction's rivals.
 * Purging the wrong faction leaves the real plot where it was.
 */
export function purgeFaction(state: GameState, factionId: string, now = new Date()): { state: GameState; result?: CabinetResult; names?: string[]; why?: CabinetRefusal } {
  const why = cannotMove(state, "purge", factionId);
  if (why) return { state, why };
  const people = insidersOf(state);
  const factions = factionsOf(state, people);
  const faction = factions.find((f) => f.id === factionId)!;
  const seed = game(state);
  const members = people.filter((p) => faction.members.includes(p.name));
  const caught = members.filter((p) => !p.deputy || roll(seed, state.turn, `cabinet:purge:${p.name}`) < 0.7);
  const escaped = members.filter((p) => !caught.includes(p));
  const gone = new Set(caught.map((p) => p.name));
  const removed = (state.officials ?? []).filter((o) => MINISTRY_OF[o.post] && gone.has(o.name));
  let next: GameState = {
    ...state,
    officials: (state.officials ?? []).filter((o) => !removed.includes(o)),
    ...(state.deputies ? { deputies: state.deputies.filter((d) => !gone.has(d.name)) } : {}),
  };
  // Plots of the purged: over, unless someone in them slipped through.
  for (const plot of cabinetPlots(state)) {
    const rest = plot.cabinet.members.filter((m) => !gone.has(m));
    if (rest.length === plot.cabinet.members.length) continue;
    setPlot(next, plot.id, (p) => (rest.length ? { ...p, strength: Math.round(p.strength / 2), cabinet: { ...p.cabinet!, members: rest } } : null));
  }
  // Everyone left fears they are next; the purged faction's rivals gain, and those who slipped through hate the government for it.
  const rivals = factions.filter((g) => factionsAtOdds(faction, g, state, people));
  const deltas = new Map<string, number>();
  for (const p of people) {
    if (gone.has(p.name)) continue;
    deltas.set(p.name, escaped.includes(p) ? -FAVOUR_STEP : rivals.some((g) => g.members.includes(p.name)) ? 1 : -1);
  }
  next = favoured(next, deltas);
  if (next.politics) {
    const pillars = loyaltyOf(next.politics);
    let parties = next.politics.parties;
    if (holdsElections(state)) {
      // The governing party pays at the polls; the others share what it loses.
      const lost = parties.filter((p) => p.status === "ruling").reduce((s, p) => s + Math.min(3, p.support), 0);
      const others = parties.filter((p) => p.status !== "ruling").reduce((s, p) => s + p.support, 0);
      if (lost > 0 && others > 0) parties = parties.map((p) => (p.status === "ruling" ? { ...p, support: round1(p.support - Math.min(3, p.support)) } : { ...p, support: round1(p.support + (lost * p.support) / others) }));
    }
    next.politics = { ...next.politics, parties, unrest: clamp(next.politics.unrest + 4, 0, 100), loyalty: { ...pillars, elites: clamp(pillars.elites - 8, 0, 100), security: clamp(pillars.security - 3, 0, 100) } };
  }
  const names = caught.map((p) => p.name);
  const result: CabinetResult = escaped.length ? "escaped" : "caught";
  return { state: logMove(next, { kind: "purge", who: factionId, result, names, removed: removed.map((o) => ({ post: o.post, title: o.title, name: o.name })) }, now), result, names };
}

// ——— For the game master ———

const brief = (p: Insider | undefined, name: string) => (p ? `${p.name} (${p.deputy ? `dep. ${p.ministry}` : p.ministry})` : name);
const MOVE_EN: Record<Exclude<CabinetMove["kind"], "reshuffle">, string> = { favour: "a favour to", post: "a seat at the top table to", dismiss: "dismissed", investigate: "investigated", purge: "purged" };

/**
 * The cabinet for the turn's game master, in a few lines: its factions and
 * their temper, what the dice decided for this period – feet dragged, leaks,
 * plots and a strike – and the government's moves since the last turn.
 * `part`: the story stage judges the orders; home moves people and is asked
 * whose causes the orders served; the whole turn does both.
 */
export function describeCabinet(state: GameState, part: "story" | "home" | "full" = "full"): string[] {
  if (!inPlay(state)) return [];
  const people = insidersOf(state);
  if (!people.length) return [];
  const cast = castCabinet(state);
  const lines: string[] = [];
  for (const f of cast.factions) {
    const leak = cast.leaks.find((l) => l.faction === f.id);
    const op = leak && state.directives?.find((d) => d.id === leak.directive)?.operation;
    const leaks = leak ? `; ${leak.by} leaks to the press ${op ? `the secret operation "${op.name}"` : "the cabinet's quarrels"}` : "";
    lines.push(`- ${factionEn(f.id).replace(/^the /, "")} (${f.temper}): ${f.members.map((m) => brief(people.find((p) => p.name === m), m)).join(", ")}${leaks}`);
  }
  if (cast.obstruct.length) {
    const ask = part === "home" ? "" : ` (give its verdict "by": the ministry)`;
    lines.push(`- dragging their feet: ${cast.obstruct.join(", ")} – an order they carry out comes off at best partial${ask}${cast.heldUp.length ? `; directives ${cast.heldUp.join(", ")} held up (still in progress)` : ""}`);
  }
  for (const r of cast.plots) {
    const plot = r.plot ?? cabinetPlots(state).find((p) => p.id === r.id);
    if (!plot?.cabinet) continue;
    const c = plot.cabinet;
    // The plotters are named when they are not simply the faction as it stands.
    const faction = cast.factions.find((f) => f.id === c.faction);
    const who = faction && c.members.length === faction.members.length && c.members.every((m) => faction.members.includes(m)) ? "" : ` (${c.members.join(", ")})`;
    const aim = c.target === "leader" ? "to replace the leader" : `against ${c.targetName}`;
    const suspect = r.rumour ?? c.rumour?.faction;
    const known = plot.known || r.confirmed ? "known to the government" : suspect !== undefined ? `rumoured (intelligence suspects ${suspect ? factionEn(suspect) : "nobody in particular"})` : "secret";
    const strike = r.success ? (c.target === "leader" ? `STRIKES NOW AND SUCCEEDS: report the overthrow (how "deposed", by ${c.members[0]})` : `STRIKES NOW AND SUCCEEDS: ${c.targetName} is forced out`) : "STRIKES NOW AND FAILS: the plotters are caught";
    const fate = r.event === "begun" ? "begins" : r.event === "moot" || r.event === "faded" ? "is over" : r.event === "strikes" ? strike : `${r.strength}/100`;
    lines.push(`- plot of ${factionEn(c.faction)}${who} ${aim}: ${fate}, ${known}`);
  }
  const moves = (state.cabinet?.moves ?? []).map((m) => {
    if (m.kind === "reshuffle") return `${m.who} moved to ${m.with}'s post (${m.result})`;
    const target = m.kind === "investigate" || m.kind === "purge" ? factionEn(m.who) : m.who;
    return `${MOVE_EN[m.kind]} ${target} (${m.result}${m.names?.length ? `: ${m.names.join(", ")}` : ""}${m.noticed ? ", noticed" : ""})`;
  });
  if (moves.length) lines.push(`- the government's moves since the last turn (done; tell what follows): ${moves.join("; ")}`);
  const out = lines.length ? ["", "CABINET (the engine's dice for this period; tell them so, ministers in character):", ...lines] : [];
  if (part !== "story") {
    if (!out.length) out.push("");
    out.push(`In "cabinet", name ministers or deputies whose causes this period's orders clearly served ("for") or went against ("against"), usually none to three; the engine counts the budget, laws, wars and deals itself.`);
  }
  return out;
}

/** A minister's or deputy's own place in the cabinet, for their prompt: their faction, their rivals, their plot. */
export function factionLineFor(state: GameState, name: string): string[] {
  if (!inPlay(state)) return [];
  const people = insidersOf(state);
  if (!people.some((p) => p.name === name)) return [];
  const faction = factionOf(factionsOf(state, people), name);
  const rivals = rivalsOf(state, name, people);
  const plot = plotOf(state, name);
  const bits: string[] = [];
  if (faction) bits.push(`you belong to ${factionEn(faction.id)} with ${faction.members.filter((m) => m !== name).join(", ")}, ${faction.temper} towards the leader`);
  if (rivals.length) bits.push(`your rivals: ${rivals.map((r) => `${r.name} (${r.why === "post" ? "you both want a higher post" : "your causes clash"})`).join(", ")}`);
  if (plot) bits.push(`in secret you plot with ${plot.cabinet.members.filter((m) => m !== name).join(", ") || "your people"} ${plot.cabinet.target === "leader" ? "to replace the leader" : `against ${plot.cabinet.targetName}`} – never admit it to the leader`);
  return bits.length ? ["", `YOUR PLACE IN THE CABINET: ${bits.join("; ")}.`] : [];
}

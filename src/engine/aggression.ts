import { deterrenceOf } from "./space";
import { yearsBetween } from "./abroad";
import type { Delivery } from "./arsenal";
import { roll } from "./dice";
import { byEra } from "./era";
import { jointLine } from "./joint";
import { isNeutral } from "./neutrality";
import { canStartPolicy } from "./policies";
import { addTension, allied, greatPowers, landHolders, MAX_PLEDGES, pacted, powers, remember, tieOf, warBetween } from "./relations";
import { SCENARIOS } from "./scenarios";
import { countryCentres, distanceKm } from "./trade";
import type { Aggression, Alliance, AppliedChange, Forum, GameState, MapRegion, Plan, RegimeKind, Resolution, ResolutionKind, ScenarioId } from "./types";

/**
 * The world's answer to aggression. When a country attacks another, the
 * governments that matter answer through the engine's own machinery, in
 * proportion to the act and by the norms of its era:
 *
 * - the act is weighed (`weight`, 0–3): the era's norm against conquest
 *   (faint in 1914, firm after 1945), the attacker's weight against the
 *   victim's (a great power on a small state counts most), the victim's
 *   place in the world body, and the attacker's other attacks within a year,
 *   which compound;
 * - every government with a course judges it by what it has at stake – the
 *   victim an ally or a protégé, the attacker near and stronger, a rival, a
 *   democracy's regard for the norm – and condemns it, losing trust in the
 *   attacker (`aggression` in its memory); a friend of the attacker does not;
 * - rivals and democracies open sanctions, neighbours who fear the attacker
 *   arm (and seek a bloc, engine/intentions.ts), the strong who stand by the
 *   victim or oppose the attacker send it arms from their stores while the
 *   war lasts, and since the Cold War a great power pledges to defend the
 *   next in line – a protect aim, so an attack on it calls the guardian in by
 *   treaty;
 * - the world body of the day (the United Nations, the League of Nations
 *   before it) meets in emergency session and votes: condemnation, then
 *   sanctions a month on, then a call for collective action, each by its
 *   members' stances – in the Security Council a permanent member's vote
 *   against is a veto, and from November 1950 (Uniting for Peace) the General
 *   Assembly takes up what a veto blocked; the League votes in its Assembly,
 *   expels a member that attacked, and calls no one to arms. Members that
 *   voted for sanctions impose them; a call for collective action opens plans
 *   to enter the war and raises the odds of going.
 *
 * A lone small war far from anyone's interests draws a shrug. Pure and
 * seeded: the dice come from the game's seed, the turn and the case.
 */

/** How firmly each era held to the norm against conquest. */
const NORM: Record<ScenarioId, number> = { "1914": 0.35, "1933": 0.5, "1939": 0.6, "1950": 1, "1957": 1, "1964": 1, "1973": 1, "1979": 1, "1991": 1.1, "1999": 1, "2014": 1, "2022": 1.1 };
/** How long a pledge given after an aggression holds, unless the attacker strikes again: a decade. */
export const PLEDGE_YEARS = 10;
const yearsAfter = (date: string, years: number) => `${Number(date.slice(0, 4)) + years}${date.slice(4)}`;

/** How readily a great power pledged to defend others after an aggression: not before the Cold War. */
const PLEDGE: Record<ScenarioId, number> = { "1914": 0, "1933": 0, "1939": 0, "1950": 1, "1957": 0.9, "1964": 0.8, "1973": 0.75, "1979": 0.75, "1991": 0.7, "1999": 0.5, "2014": 0.5, "2022": 0.6 };
/** How far an atomic arsenal holds others back from war with its owner: little while the bombs are new and few, much once they are many. */
const NUCLEAR_RESTRAINT: Record<ScenarioId, number> = { "1914": 0, "1933": 0, "1939": 0, "1950": 0.3, "1957": 0.55, "1964": 0.8, "1973": 0.8, "1979": 0.8, "1991": 0.8, "1999": 0.8, "2014": 0.85, "2022": 0.85 };
/** How much each kind of government cares for the norm when nothing else is at stake. */
const REGARD: Record<RegimeKind, number> = { democracy: 0.25, limited: 0.15, party: 0.08, autocracy: 0.08, military: 0.05 };

/** The world bodies, the newest first: a scenario has one or none. */
export const WORLD_BODIES = ["un", "league-of-nations"] as const;
/** Uniting for Peace (General Assembly resolution 377): from this day a resolution vetoed in the Security Council goes to the General Assembly. */
export const UNITING_FOR_PEACE = "1950-11-03";
/** The Security Council grew from eleven seats to fifteen; seven votes carried it, then nine. */
const COUNCIL_REFORM = "1966-01-01";
/** The People's Republic took China's seat from the Republic of China. */
const CHINA_SEAT = "1971-10-25";
/** What a resolution needs of a member's judgement to win its vote. */
const NEED: Record<ResolutionKind, number> = { condemn: 0.6, sanctions: 0.95, action: 1.3 };
/** The gravity below which an act draws no session and no pledge, unless a great power stands by the victim: a small war. */
const SESSION_WEIGHT = 0.9;
/** Gravity a world body needs to call for sanctions, and for collective action. */
const SANCTIONS_WEIGHT = 0.8;
const ACTION_WEIGHT = 1.1;
/** Days between a world body's resolutions: sanctions a month after condemnation, collective action a month after sanctions. */
const STEP_DAYS = 28;
/** Cases kept after they close, and in all. */
const KEEP_YEARS = 2;
const MAX_KEPT = 24;
/** Condemning governments named in a case. */
const MAX_NAMED = 12;
/** Governments sending one victim arms. */
const MAX_AID = 3;
/** The share of its GDP a year a government gives in arms to a victim it aids (America gave Ukraine about this much). */
const AID_SHARE = 0.002;
/** At most this share of the victim's own GDP a year arrives as arms. */
const AID_CAP = 0.3;
/** Sanctions on one target: as governments decide on their own (as engine/policies.ts), and at a world body's call. */
const SANCTIONERS = 10;
const CALLED_SANCTIONERS: Record<string, number> = { un: 20, "league-of-nations": 12 };
/** Plans opened in answer to one act: armament, sanctions of their own; entries at a call for collective action. */
const MAX_ARMING = 6;
const MAX_SANCTIONS = 6;
const MAX_CALLED = 6;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round2 = (value: number) => Math.round(value * 100) / 100;

/** The world body of a game, if its date has one. */
export function worldBody(state: Pick<GameState, "alliances">): Alliance | undefined {
  for (const id of WORLD_BODIES) {
    const body = state.alliances.find((a) => a.id === id);
    if (body) return body;
  }
  return undefined;
}

/**
 * The permanent members of the Security Council: the Soviet seat passes to Russia; China's is held by whichever
 * government holds China's place in the United Nations – the Republic of China until the People's Republic takes it
 * (25 October 1971, or by the Assembly's vote in the free mode: seatChina).
 */
export function permanentMembers(state: Pick<GameState, "countries" | "date"> & Partial<Pick<GameState, "alliances">>, holders: Set<string>): string[] {
  const soviet = holders.has("ussr") ? "ussr" : "russia";
  const un = state.alliances?.find((a) => a.id === "un");
  const china = un ? (un.members.includes("china") ? "china" : "taiwan") : state.date < CHINA_SEAT ? "taiwan" : "china";
  return ["usa", "uk", "france", soviet, china].filter((t) => state.countries[t] && holders.has(t));
}

/** How close two countries are, 0–100, from where their people live (as engine/relations.ts measures it), else as a course's tie says. */
type Near = (a: string, b: string) => number;

function nearness(state: GameState, map: Record<string, MapRegion> | null): Near {
  const at = map ? countryCentres(state, map) : null;
  return (a, b) => {
    const pa = at?.get(a);
    const pb = at?.get(b);
    if (pa && pb) return Math.round(100 * clamp(1 - (distanceKm(pa, pb) - 600) / 3000, 0.1, 1));
    return tieOf(state, a, b).near;
  };
}

/**
 * A government on the attacker's side: allied to it, fighting beside it, a close friend, or a ruling party of its kind
 * that has no quarrel with it. A bloc shared with both the attacker and its victim makes no friend of the attacker.
 */
function friendOf(state: GameState, tag: string, by: string, against?: string): boolean {
  const trust = tieOf(state, tag, by).trust;
  if (tag === by || (allied(state, tag, by) && !(against && allied(state, tag, against))) || trust >= 40) return true;
  if (state.countries[tag]?.domestic?.regime === "party" && state.countries[by]?.domestic?.regime === "party" && trust >= 0) return true;
  return state.wars.some((w) => (w.attackers.includes(tag) && w.attackers.includes(by)) || (w.defenders.includes(tag) && w.defenders.includes(by)));
}

/** What a government has at stake in an attack: the victim (an ally, a protégé, a friend), fear of the attacker, rivalry with it, and its regard for the norm. */
export interface Stake {
  interest: number;
  fear: number;
  rival: number;
  norm: number;
  total: number;
  friend: boolean;
}

function stakeOf(state: GameState, power: Map<string, number>, near: Near, o: string, by: string, against: string, great = greatPowers(power)): Stake {
  const friend = friendOf(state, o, by, against);
  const guard = state.countries[o]?.course?.aims.find((a) => a.kind === "protect" && a.target === against);
  const toVictim = tieOf(state, o, against);
  let interest = allied(state, o, against) ? 1 : 0;
  if (guard) interest = Math.max(interest, 0.3 + guard.weight / 100);
  if (pacted(state, o, against) || toVictim.trust >= 30) interest = Math.max(interest, 0.3);
  if ((toVictim.trade ?? 0) >= 5) interest += 0.1;
  // Fear: an attacker near and stronger; the victim's neighbours fear it most.
  const po = power.get(o) ?? 0;
  const pa = power.get(by) ?? 0;
  let fear = 0.8 * (near(o, by) / 100) ** 2 * clamp(pa / (po + 0.02) / 2, 0, 1);
  if (near(o, against) >= 75) fear += 0.15;
  const t = tieOf(state, o, by);
  const theirFoe = state.wars.some((w) => (w.attackers.includes(by) && w.defenders.some((d) => allied(state, o, d))) || (w.defenders.includes(by) && w.attackers.some((a) => allied(state, o, a))));
  const rival = t.trust <= -30 || t.tension >= 40 || theirFoe || (great.has(o) && great.has(by) && t.trust <= -15) ? 0.4 : 0;
  const norm = REGARD[state.countries[o]?.domestic?.regime ?? "autocracy"];
  return { interest, fear: round2(fear), rival, norm, total: round2(clamp(interest + fear + rival + norm, 0, 2)), friend };
}

/** How strongly a government condemns an attack: what it has at stake in the victim, its rivalry with the attacker and its regard for the norm; fear speaks up only where votes count (a frightened neighbour of a giant keeps quiet). */
const voiceOf = (state: GameState, o: string, s: Stake) => s.interest + s.rival + s.norm + (state.countries[o]?.domestic?.regime === "democracy" ? 0.5 * s.fear : 0);

/** A case opened this turn, with what every government had at stake in it before it condemned anything. */
export interface Fresh {
  record: Aggression;
  stakes: Map<string, Stake>;
}

/** An act of aggression this turn: who attacked whom in which war, and whether by joining an attack under way. */
interface Act {
  war: string;
  by: string;
  against: string;
  joined: boolean;
}

/** The acts in a turn's changes: a war begun (its principal attacker against each defender) and a country joining the attacking side. */
function actsIn(before: GameState, next: GameState, applied: AppliedChange[], power: Map<string, number>): Act[] {
  const held = landHolders(before);
  const strongest = (tags: string[]) => [...tags].sort((a, b) => (power.get(b) ?? 0) - (power.get(a) ?? 0) || a.localeCompare(b))[0];
  const out: Act[] = [];
  const add = (act: Act): boolean => {
    // A country born this turn or without land is a movement or a secession, not an aggressor; a victim with no land left is
    // not attacked; a counterstroke is not an aggression. An attacker already on the victim's soil, or already judged for
    // this attack, opens a front, not a new aggression – but one fighting it only in a coalition war far away (Turkey's
    // brigade in Korea) that now invades its homeland commits one.
    if (act.by === act.against || !before.countries[act.by] || !held.has(act.by) || !held.has(act.against)) return false;
    if ((next.aggressions ?? []).some((a) => a.by === act.by && a.against === act.against && !a.closed)) return false;
    const already = warBetween(before, act.by, act.against);
    if (already) {
      const side = already.attackers.includes(act.by) ? already.attackers : already.defenders;
      if (Object.values(before.regions).some((r) => r.owner === act.against && (side.includes(r.controller) || (r.contested !== undefined && side.includes(r.contested))))) return false;
    }
    if ((next.aggressions ?? []).some((a) => a.by === act.against && a.against === act.by && yearsBetween(a.date, next.date) < 1)) return false;
    if (out.some((x) => x.by === act.by && (x.against === act.against || x.war === act.war))) return false;
    out.push(act);
    return true;
  };
  for (const c of applied) {
    if (c.kind === "war") {
      const war = next.wars.find((w) => w.id === c.war);
      if (!war) continue;
      // One war is one act: its defenders are one victim, judged by the weightiest of them that the attack is news for.
      const by = strongest(war.attackers);
      if (by) [...war.defenders].sort((a, b) => (power.get(b) ?? 0) - (power.get(a) ?? 0) || a.localeCompare(b)).some((d) => add({ war: war.id, by, against: d, joined: false }));
    } else if (c.kind === "enter" && c.side === "attackers") {
      const war = next.wars.find((w) => w.id === c.war);
      if (war?.defenders[0]) add({ war: war.id, by: c.country, against: war.defenders[0], joined: true });
    }
  }
  return out;
}

/** How gravely the world judges an act, 0–3. */
function weightOf(state: GameState, power: Map<string, number>, act: Act, repeat: number, body: Alliance | undefined): number {
  const pa = power.get(act.by) ?? 0;
  const pv = power.get(act.against) ?? 0;
  const ranked = [...power].sort((a, b) => b[1] - a[1]);
  const great = new Set(ranked.slice(0, 6).map(([t]) => t));
  const superpower = ranked.slice(0, 2).some(([t]) => t === act.by);
  const asym = clamp((pa - pv) / Math.max(pa, 0.01), 0, 1);
  const stature = 0.6 + 0.6 * asym + (great.has(act.by) ? 0.4 * asym : 0) + (superpower ? 0.2 : 0);
  // A state outside the world body draws a little less: fewer speak for it there.
  const member = !body || body.members.includes(act.against) ? 1 : 0.8;
  const again = Math.min(2.2, 1 + 0.5 * repeat);
  return round2(clamp(byEra(NORM, state.date) * stature * member * again * (act.joined ? 0.6 : 1), 0, 3));
}

/** The attacker's other attacks in the year before this turn: one war of this turn is one act, not a repeat of itself. */
function repeatsOf(state: GameState, by: string, against: string, date: string): number {
  const victims = new Set((state.aggressions ?? []).filter((a) => a.by === by && a.against !== against && a.date < date && yearsBetween(a.date, date) < 1).map((a) => a.against));
  return victims.size;
}

interface NoteContext {
  turn: number;
  from: string;
  to: string;
  power: Map<string, number>;
  map: Record<string, MapRegion> | null;
}

/**
 * Acts of aggression in this turn's changes, judged and recorded, with what
 * governments do about them at once: condemnation (trust and tension), arms
 * for the victim, a great power's pledges. Runs after the turn's deeds are
 * remembered and before the courses look at the world again, so the threat
 * they see includes it and a pledge to the victim calls its guardian in by
 * treaty this turn. Returns the new cases.
 */
export function noteAggression(before: GameState, next: GameState, applied: AppliedChange[], ctx: NoteContext): Fresh[] {
  const { power } = ctx;
  const acts = actsIn(before, next, applied, power);
  if (!acts.length) return [];
  const near = nearness(next, ctx.map);
  const body = worldBody(next);
  const dice = (key: string) => roll(next.seed ?? next.id, ctx.turn, key);
  const great = greatPowers(power);
  const holders = landHolders(next);
  const list = (next.aggressions ??= []);
  const made: Fresh[] = [];
  const everyone = Object.values(next.countries)
    .filter((c) => c.tag !== next.player && holders.has(c.tag))
    .map((c) => c.tag)
    .sort();
  for (const act of acts) {
    const repeat = repeatsOf(next, act.by, act.against, ctx.from);
    const weight = weightOf(next, power, act, repeat, body);
    const id = `g${ctx.turn}-${list.filter((a) => a.id.startsWith(`g${ctx.turn}-`)).length + 1}`;
    const record: Aggression = { id, war: act.war, by: act.by, against: act.against, date: ctx.from, weight, repeat, condemned: [] };
    // What everyone has at stake, read before anyone condemns it: the answers below follow from where things stood. Those who
    // fight the war – on either side, entering it this turn too – judge it as belligerents, not onlookers: their deed is the
    // war's own (attacked, joined the enemy), not an aggression watched.
    const war = next.wars.find((w) => w.id === act.war);
    const fighting = new Set(war ? [...war.attackers, ...war.defenders] : []);
    const stakes = new Map(everyone.filter((o) => o !== act.by && o !== act.against && !fighting.has(o)).map((o) => [o, stakeOf(next, power, near, o, act.by, act.against, great)]));

    // Condemnation: every government with a course and a stake loses trust in the attacker, those it threatens or who stand by the victim most.
    const condemning: string[] = [];
    for (const [o, s] of stakes) {
      const voice = voiceOf(next, o, s);
      if (!next.countries[o].course || s.friend || voice * weight < 0.3) continue;
      const lost = Math.round(clamp(5 + 12 * voice * weight, 5, 30));
      remember(next, o, act.by, "aggression", -lost, ctx.to, voice >= 0.5);
      const raised = Math.round(clamp(15 * (s.interest + s.fear + s.rival) * weight, 0, 20));
      if (raised > 0) addTension(next, o, act.by, raised);
      condemning.push(o);
    }
    condemning.sort((a, b) => (power.get(b) ?? 0) - (power.get(a) ?? 0) || a.localeCompare(b));
    record.condemned = condemning.slice(0, MAX_NAMED);
    if (condemning.length >= 2 || (condemning.length && weight >= SESSION_WEIGHT)) {
      applied.push({ kind: "outcry", by: act.by, against: act.against, war: act.war, case: id, countries: record.condemned.slice(0, 6), n: condemning.length });
    }

    // Arms for the victim from the strong who stand by it or oppose the attacker, while the war lasts.
    const victimPower = power.get(act.against) ?? 0;
    const givers = [...stakes]
      .filter(([o, s]) => next.countries[o].course && !s.friend && (s.interest >= 0.3 || s.rival > 0) && (power.get(o) ?? 0) >= Math.max(0.06, 1.2 * victimPower) && (next.countries[o].course?.reach ?? 50) >= 30 && !warBetween(next, o, act.against))
      .sort((a, b) => (power.get(b[0]) ?? 0) - (power.get(a[0]) ?? 0) || a[0].localeCompare(b[0]))
      .filter(([o, s]) => dice(`aid:${id}:${o}`) < clamp(0.25 + 0.4 * (s.interest + s.rival) * weight, 0, 0.9))
      .slice(0, MAX_AID)
      .map(([o]) => o);
    if (givers.length) {
      record.aid = givers;
      for (const g of givers) {
        remember(next, act.against, g, "aided", 12, ctx.to);
        applied.push({ kind: "aid", by: g, to: act.against, war: act.war, case: id });
      }
    }

    // Since the Cold War, a great power that opposes the attacker pledges to defend the next in line – and the victim
    // itself after the gravest attacks, unless the attacker's bombs hold it back.
    const pledge = byEra(PLEDGE, ctx.to);
    if (pledge > 0 && weight >= 1.1 && great.has(act.by)) {
      // Missiles that reach any enemy and satellites that see a strike coming make the bombs weigh a little more (engine/space.ts).
      const restrained = Boolean(next.countries[act.by]?.arsenal?.nuclear) && byEra(NUCLEAR_RESTRAINT, ctx.to) * deterrenceOf(next, act.by) >= 0.5;
      const patrons = [...stakes]
        .filter(([o, s]) => next.countries[o].course && great.has(o) && !s.friend && s.rival > 0 && (next.countries[o].course?.reach ?? 50) >= 40)
        .sort((a, b) => (power.get(b[0]) ?? 0) - (power.get(a[0]) ?? 0) || a[0].localeCompare(b[0]))
        .slice(0, 2)
        .map(([o]) => o);
      const pledges: { by: string; to: string }[] = [];
      for (const p of patrons) {
        const course = next.countries[p].course!;
        const guarded = (x: string) => course.aims.some((a) => a.kind === "protect" && a.target === x);
        // A word already given to the victim or the next in line holds another decade from this attack.
        for (const a of course.aims) if (a.kind === "protect" && a.until && a.target && (a.target === act.against || near(a.target, act.against) >= 60)) a.until = yearsAfter(ctx.to, PLEDGE_YEARS);
        const room = () => MAX_PLEDGES - course.aims.filter((a) => a.kind === "protect").length;
        const eligible = (x: string) =>
          holders.has(x) && x !== act.by && x !== p && !guarded(x) && !allied(next, x, act.by) && !friendOf(next, x, act.by) && !warBetween(next, p, x) && tieOf(next, p, x).trust >= -10 && (power.get(x) ?? 0) < 0.6 * (power.get(act.by) ?? 0);
        // The next in line: the victim's neighbours within the attacker's reach, those close to both first.
        const inLine = [...holders]
          .filter((x) => x !== act.against && eligible(x) && near(x, act.against) >= 60 && near(x, act.by) >= 30)
          .sort((a, b) => near(b, act.against) + near(b, act.by) - near(a, act.against) - near(a, act.by) || a.localeCompare(b))
          .slice(0, 2);
        const victim = weight >= 1.5 && !restrained && eligible(act.against);
        for (const x of [...(victim ? [act.against] : []), ...inLine]) {
          if (room() <= 0) break;
          // Coming to the victim's side in the war itself takes a graver attack than a word given to the next in line.
          const chance = pledge * (x === act.against ? clamp((weight - 1) / 1.5, 0, 1) : clamp(weight - 0.6, 0, 1));
          if (dice(`pledge:${id}:${p}:${x}`) >= chance) continue;
          course.aims.push({ kind: "protect", target: x, weight: Math.round(clamp(30 + 15 * weight, 30, 70)), until: yearsAfter(ctx.to, PLEDGE_YEARS) });
          pledges.push({ by: p, to: x });
          applied.push({ kind: "pledge", by: p, to: x, against: act.by, case: id });
        }
      }
      if (pledges.length) record.pledges = pledges;
    }

    // The world body takes it up when it is grave enough, or a great power stands by the victim.
    const backed = [...stakes].some(([o, s]) => great.has(o) && s.interest >= 0.5);
    if (body && (body.members.includes(act.against) || body.members.includes(act.by)) && (weight >= SESSION_WEIGHT || backed || record.pledges)) record.body = body.id;
    list.push(record);
    made.push({ record, stakes });
  }
  return made;
}

/** One member's vote on a resolution about a case. */
type Vote = "yes" | "no" | "abstain";

interface VoteContext {
  state: GameState;
  power: Map<string, number>;
  near: Near;
  turn: number;
  great: Set<string>;
  stakes: Map<string, Stake>;
}

/** The strongest member of a country's small military alliance, whose line a state without a course of its own follows. */
function leaderOf(state: GameState, power: Map<string, number>, tag: string): string | undefined {
  let best: string | undefined;
  for (const a of state.alliances) {
    if ((a.kind && a.kind !== "alliance") || a.members.length > 32 || !a.members.includes(tag)) continue;
    for (const m of a.members) if (m !== tag && state.countries[m]?.course && (!best || (power.get(m) ?? 0) > (power.get(best) ?? 0))) best = m;
  }
  return best;
}

/**
 * The leader speaking at a session in person (engine/envoys.ts delegationInPerson): a government that has not made up
 * its mind and is on good terms with the player's (trust 20 and up) votes as the player's delegation does.
 */
const IN_PERSON_TRUST = 20;

function voteOf(ctx: VoteContext, member: string, c: Aggression, kind: ResolutionKind, follow = true): Vote {
  const { state, power, near } = ctx;
  if (member === c.by) return "no";
  if (member === c.against) return "yes";
  if (member === state.player) {
    // The player's delegation votes as the orders told it on this aggressor (engine/envoys.ts); otherwise it follows the
    // government's line where it is plain – against a resolution on a friend, for one on an ally's attacker – and abstains.
    const told = state.delegation?.[c.by];
    if (told) return told === "condemn" ? "yes" : told === "oppose" ? "no" : "abstain";
    if (friendOf(state, member, c.by)) return "no";
    return allied(state, member, c.against) ? "yes" : "abstain";
  }
  // A government that agreed one line on this aggressor with others votes it (engine/joint.ts).
  const line = jointLine(state, member, c.by);
  if (line) return line === "condemn" ? "yes" : line === "oppose" ? "no" : "abstain";
  // A government that pledged its votes to the player in a trade deal in force votes with the player (engine/negotiation.ts).
  if ((c.by === state.player || c.against === state.player) && (state.deals ?? []).some((d) => d.status === "active" && d.partner === member && d.conditions?.some((x) => x.kind === "votes" && x.by === "partner"))) {
    return c.by === state.player ? "no" : "yes";
  }
  // What a government already does says how it votes: one at war with the aggressor, one that gave its word to defend
  // the victim, one sending the victim arms, and – on condemnation and sanctions – one already sanctioning the aggressor.
  if (warBetween(state, member, c.by) || c.aid?.includes(member)) return "yes";
  if (state.countries[member]?.course?.aims.some((a) => a.kind === "protect" && a.target === c.against)) return "yes";
  if (kind !== "action" && (state.sanctions ?? []).some((s) => s.by === member && s.against === c.by)) return "yes";
  if (friendOf(state, member, c.by, c.against)) return "no";
  // A state without a course follows its bloc's leader where the leader takes a side.
  if (follow && !state.countries[member]?.course) {
    const lead = leaderOf(state, power, member);
    if (lead && lead !== c.by && lead !== member) {
      const line = voteOf(ctx, lead, c, kind, false);
      if (line !== "abstain") return line;
    }
  }
  let s = ctx.stakes.get(member);
  if (!s) {
    s = stakeOf(state, power, near, member, c.by, c.against, ctx.great);
    ctx.stakes.set(member, s);
  }
  const regime = state.countries[member]?.domestic?.regime;
  // A government with nothing at stake but the norm condemns readily, sanctions less readily and calls others to arms least.
  const engaged = s.interest >= 0.3 || s.rival > 0;
  const lean = (regime === "democracy" ? 1.15 : 0.9) * (0.4 + s.total) * (kind === "action" && !engaged ? 0.6 : 1);
  const t = tieOf(state, member, c.by);
  // Trade with the attacker weighs against measures that cost it.
  const cost = kind === "condemn" ? 0 : (2 * (t.trade ?? 0)) / 100;
  const noise = (roll(state.seed ?? state.id, ctx.turn, `vote:${c.id}:${kind}:${member}`) - 0.5) * 0.4;
  const score = byEra(NORM, state.date) * c.weight * lean - Math.max(0, t.trust) / 100 - cost + noise;
  const toward = t.trust;
  if (score >= NEED[kind]) return "yes";
  // A friendly or bound government votes against what it will not join; the rest abstain.
  return toward >= 20 || pacted(state, member, c.by) ? "no" : "abstain";
}

/** How a member votes on a resolution about a case, as the world body's session would cast it. */
export function voteOn(state: GameState, member: string, c: Aggression, kind: ResolutionKind, map: Record<string, MapRegion> | null = null): Vote {
  const power = powers(state);
  return voteOf({ state, power, near: nearness(state, map), turn: state.turn, great: greatPowers(power), stakes: new Map() }, member, c, kind);
}

/** A vote: in the Council (permanent members and the strongest of the rest), the General Assembly, or the League's Assembly. */
function hold(ctx: VoteContext, body: Alliance, c: Aggression, kind: ResolutionKind, forum: Forum, holders: Set<string>): { resolution: Resolution; ayes: string[] } {
  const { state, power } = ctx;
  const members = body.members.filter((m) => state.countries[m] && holders.has(m));
  let voters = members;
  const permanent = body.id === "un" && forum === "council" ? permanentMembers(state, holders).filter((m) => members.includes(m)) : [];
  if (permanent.length) {
    const seats = state.date < COUNCIL_REFORM ? 6 : 10;
    const elected = members
      .filter((m) => !permanent.includes(m))
      .sort((a, b) => (power.get(b) ?? 0) - (power.get(a) ?? 0) || a.localeCompare(b))
      .slice(0, seats);
    voters = [...permanent, ...elected];
  }
  const votes = new Map(voters.map((m) => [m, voteOf(ctx, m, c, kind)] as const));
  // The player's leader at the rostrum: the undecided on good terms with the player vote as its delegation does (engine/envoys.ts).
  if (state.delegationInPerson?.includes(c.by) && state.player !== c.by) {
    const line = votes.get(state.player) ?? voteOf(ctx, state.player, c, kind);
    if (line !== "abstain") for (const [m, v] of votes) if (m !== state.player && v === "abstain" && tieOf(state, m, state.player).trust >= IN_PERSON_TRUST) votes.set(m, line);
  }
  const count = (v: Vote) => [...votes.values()].filter((x) => x === v).length;
  const yes = count("yes");
  const no = count("no");
  const abstain = count("abstain");
  const veto = permanent.filter((m) => votes.get(m) === "no");
  // An assembly carries a resolution by two thirds of those voting, and not by a handful while the rest abstain: a third of the members at least.
  const passed = permanent.length ? yes >= (state.date < COUNCIL_REFORM ? 7 : 9) && !veto.length : yes >= (2 / 3) * (yes + no) && yes >= voters.length / 3;
  const ayes = [...votes].filter(([, v]) => v === "yes").map(([m]) => m);
  return { resolution: { kind, forum, date: state.date, yes, no, abstain, passed, ...(veto.length ? { veto } : {}) }, ayes };
}

/** Whether the attacker holds any of the victim's land, or fights in it. */
function holdsLand(state: GameState, by: string, against: string): boolean {
  const side = state.wars.find((w) => w.attackers.includes(by) && w.defenders.includes(against))?.attackers ?? [by];
  return Object.values(state.regions).some((r) => r.owner === against && (side.includes(r.controller) || (r.contested !== undefined && side.includes(r.contested))));
}

interface AnswerContext {
  turn: number;
  from: string;
  to: string;
  power: Map<string, number>;
  holders: Set<string>;
  map: Record<string, MapRegion> | null;
  dice: (key: string) => number;
  open: (fields: Omit<Plan, "id" | "since" | "moved">) => Plan;
  /** The cases opened this turn, with the stakes they were judged by (noteAggression). */
  fresh: Fresh[];
}

/**
 * The plans the world opens in answer, and the world body's votes: after
 * each new act, sanctions by rivals and democracies and armament by those
 * who fear the attacker; on every open case, the next resolution when its
 * time has come, and what a passed one calls for (members' sanctions, plans
 * to enter the war). Cases close when their war ends, when the majority will
 * go no further, or after a year. Runs inside the turn's new plans
 * (engine/intentions.ts), with their `open`, while the state's date is the
 * end of the period.
 */
export function answerAggression(next: GameState, ctx: AnswerContext, applied: AppliedChange[]): void {
  const list = next.aggressions;
  if (!list?.length) return;
  const { power, holders, dice } = ctx;
  const near = nearness(next, ctx.map);
  const great = greatPowers(power);
  const sanctioners = (target: string) =>
    new Set([...(next.sanctions ?? []).filter((s) => s.against === target).map((s) => s.by), ...(next.plans ?? []).filter((p) => !p.end && p.kind === "sanction" && !p.lift && p.target === target).map((p) => p.by)]).size;
  const canSanction = (by: string, target: string) =>
    by !== target &&
    by !== next.player &&
    holders.has(by) &&
    Boolean(next.countries[by]?.economy) &&
    !allied(next, by, target) &&
    !warBetween(next, by, target) &&
    !(next.sanctions ?? []).some((s) => s.by === by && s.against === target) &&
    !(next.plans ?? []).some((p) => !p.end && p.by === by && p.kind === "sanction" && p.target === target);

  for (const { record: c, stakes } of ctx.fresh) {
    // Sanctions of their own: rivals and democracies with something at stake, and the allies of a great power that opposes the
    // attacker or stands by the victim; a government that trades much with the attacker hesitates.
    const leaders = [...stakes].filter(([o, s]) => great.has(o) && !s.friend && (s.rival > 0 || s.interest >= 0.5)).map(([o]) => o);
    const aligned = (o: string) => leaders.some((l) => l !== o && (allied(next, o, l) || tieOf(next, o, l).trust >= 30));
    let opened = 0;
    for (const [o, s] of [...stakes].filter(([o]) => next.countries[o].course).sort((a, b) => (power.get(b[0]) ?? 0) - (power.get(a[0]) ?? 0) || a[0].localeCompare(b[0]))) {
      if (opened >= MAX_SANCTIONS || sanctioners(c.by) >= SANCTIONERS) break;
      if (s.friend || !canSanction(o, c.by)) continue;
      const drive = s.interest + s.rival + 0.5 * s.norm + (aligned(o) ? 0.3 : 0);
      const regime = next.countries[o].domestic?.regime === "democracy" ? 1.3 : 0.7;
      const trade = (tieOf(next, o, c.by).trade ?? 0) / 100;
      const chance = clamp(0.6 * drive * c.weight * regime * (trade >= 0.15 ? 0.4 : 1) - 0.15, 0, 0.85);
      if (dice(`answer:sanction:${c.id}:${o}`) >= chance) continue;
      ctx.open({ kind: "sanction", by: o, target: c.by, cause: "aggression", origin: c.id, stage: "tension" });
      opened += 1;
    }
    // Armament by those who fear the attacker: its neighbours and the victim's, the weaker the more.
    let arming = 0;
    for (const [o, s] of [...stakes, [c.against, stakeOf(next, power, near, c.against, c.by, c.against, great)] as const].sort((a, b) => b[1].fear - a[1].fear || a[0].localeCompare(b[0]))) {
      if (arming >= MAX_ARMING) break;
      if (s.friend || s.fear < 0.15 || !canStartPolicy(next, o, "armament")) continue;
      if (dice(`answer:arm:${c.id}:${o}`) >= clamp(0.9 * s.fear * c.weight, 0, 0.8)) continue;
      ctx.open({ kind: "policy", by: o, policy: "armament", cause: "aggression", origin: c.id, stage: "preparation" });
      arming += 1;
    }
  }

  // The world body: the next resolution on every open case whose time has come.
  const body = worldBody(next);
  const vote: VoteContext = { state: next, power, near, turn: ctx.turn, great, stakes: new Map() };
  for (const c of list) {
    if (c.closed) continue;
    const war = warBetween(next, c.by, c.against);
    if (!war || !holders.has(c.against)) {
      c.closed = ctx.to;
      continue;
    }
    if (!c.body || !body || body.id !== c.body) {
      if (yearsBetween(c.date, ctx.to) >= 1) c.closed = ctx.to;
      continue;
    }
    vote.stakes = new Map();
    const done = c.resolutions ?? [];
    const last = done.at(-1);
    const passedKinds = new Set(done.filter((r) => r.passed).map((r) => r.kind));
    let kind: ResolutionKind | null = null;
    let forum: Forum = body.id === "un" ? "council" : "assembly";
    if (c.blocked) {
      // A veto before Uniting for Peace: the case waits until the General Assembly can take it up.
      if (ctx.to < UNITING_FOR_PEACE) continue;
      kind = c.blocked;
      forum = "assembly";
      delete c.blocked;
    } else if (!done.length) kind = "condemn";
    else if (last && yearsBetween(last.date, ctx.to) * 365.25 >= STEP_DAYS) {
      if (!passedKinds.has("sanctions") && passedKinds.has("condemn") && c.weight >= SANCTIONS_WEIGHT) kind = "sanctions";
      else if (body.id === "un" && passedKinds.has("sanctions") && !passedKinds.has("action") && c.weight >= ACTION_WEIGHT && holdsLand(next, c.by, c.against)) kind = "action";
    }
    if (!kind) {
      if (yearsBetween(c.date, ctx.to) >= 1) c.closed = ctx.to;
      continue;
    }
    if (!done.length) applied.push({ kind: "session", body: body.id, by: c.by, against: c.against, war: c.war, case: c.id });
    let { resolution, ayes } = hold(vote, body, c, kind, forum, holders);
    c.resolutions = [...done, resolution];
    applied.push(resolutionChange(body.id, c, resolution));
    if (resolution.veto && body.id === "un") {
      if (ctx.to < UNITING_FOR_PEACE) {
        c.blocked = kind;
        continue;
      }
      // Uniting for Peace: the General Assembly meets on what the veto blocked.
      ({ resolution, ayes } = hold(vote, body, c, kind, "assembly", holders));
      c.resolutions.push(resolution);
      applied.push(resolutionChange(body.id, c, resolution));
    }
    if (!resolution.passed) {
      // The majority will go no further.
      c.closed = ctx.to;
      continue;
    }
    act(next, ctx, body, c, kind, ayes, applied, { sanctioners, canSanction, near, great });
  }

  // Old cases leave: closed ones after two years, and never more than two dozen.
  next.aggressions = list.filter((c) => !c.closed || yearsBetween(c.closed, ctx.to) < KEEP_YEARS).slice(-MAX_KEPT);
  if (!next.aggressions.length) delete next.aggressions;
}

const resolutionChange = (body: string, c: Aggression, r: Resolution): AppliedChange => ({
  kind: "resolution",
  body,
  by: c.by,
  against: c.against,
  war: c.war,
  case: c.id,
  resolution: r.kind,
  forum: r.forum,
  passed: r.passed,
  yes: r.yes,
  no: r.no,
  abstain: r.abstain,
  ...(r.veto ? { veto: r.veto } : {}),
});

/** What a passed resolution does: the League expels a member that attacked; members follow a call for sanctions; a call for collective action opens plans to go to war. */
function act(
  next: GameState,
  ctx: AnswerContext,
  body: Alliance,
  c: Aggression,
  kind: ResolutionKind,
  ayes: string[],
  applied: AppliedChange[],
  h: { sanctioners: (target: string) => number; canSanction: (by: string, target: string) => boolean; near: Near; great: Set<string> },
): void {
  const { power, dice } = ctx;
  const league = body.id !== "un";
  const strongest = [...ayes].filter((m) => m !== c.against).sort((a, b) => (power.get(b) ?? 0) - (power.get(a) ?? 0) || a.localeCompare(b));
  if (kind === "condemn") {
    // On record against it: those who had not condemned it yet lose a little trust in the attacker too.
    for (const m of strongest) {
      if (c.condemned.includes(m) || !next.countries[m]?.course || m === next.player) continue;
      remember(next, m, c.by, "aggression", -5, ctx.to, false);
      if (c.condemned.length < MAX_NAMED) c.condemned.push(m);
    }
    if (league && body.members.includes(c.by)) {
      // The League expels a member that attacked (the Soviet Union, December 1939).
      body.members = body.members.filter((m) => m !== c.by);
      const last = applied.at(-1);
      if (last?.kind === "resolution" && last.case === c.id) last.expelled = true;
      applied.push({ kind: "leave", alliance: body.id, name: body.name, country: c.by });
    }
    return;
  }
  if (kind === "sanctions") {
    const cap = CALLED_SANCTIONERS[body.id] ?? SANCTIONERS;
    const follow = (m: string) => (next.countries[m]?.course ? 0.85 : 0.6) * (league ? 0.5 : 1);
    for (const m of strongest) {
      if (h.sanctioners(c.by) >= cap) break;
      if (!h.canSanction(m, c.by) || dice(`called:sanction:${c.id}:${m}`) >= follow(m)) continue;
      ctx.open({ kind: "sanction", by: m, target: c.by, cause: "treaty", origin: c.id, stage: "tension" });
    }
    return;
  }
  // A call for collective action: members with the means and a side in the quarrel – the victim's friends, the attacker's
  // rivals and their allies – are asked to the victim's side (sixteen nations fought under the UN flag in Korea; India sent
  // a field hospital); the attacker's bombs hold some back.
  const war = next.wars.find((w) => w.id === c.war);
  if (!war) return;
  const side = war.defenders.includes(c.against) ? "defenders" : war.attackers.includes(c.against) ? "attackers" : null;
  if (!side) return;
  const restraint = next.countries[c.by]?.arsenal?.nuclear ? Math.min(0.95, byEra(NUCLEAR_RESTRAINT, next.date) * deterrenceOf(next, c.by)) : 0;
  const stakes = new Map(strongest.map((m) => [m, stakeOf(next, power, h.near, m, c.by, c.against, h.great)]));
  const leaders = strongest.filter((m) => h.great.has(m) && (stakes.get(m)?.rival ?? 0) > 0);
  const aligned = (m: string) => leaders.some((l) => l !== m && (allied(next, m, l) || tieOf(next, m, l).trust >= 30));
  let called = 0;
  for (const m of strongest) {
    if (called >= MAX_CALLED) break;
    const course = next.countries[m]?.course;
    const s = stakes.get(m)!;
    if (!course || m === next.player || war.attackers.includes(m) || war.defenders.includes(m) || isNeutral(next, m)) continue;
    if ((power.get(m) ?? 0) < 0.04 || course.reach < 30 || s.friend || !(s.interest >= 0.3 || s.rival > 0 || aligned(m))) continue;
    if ((next.plans ?? []).some((p) => !p.end && p.kind === "join" && p.by === m && p.war === war.id)) continue;
    if (dice(`called:join:${c.id}:${m}`) < restraint) continue;
    ctx.open({ kind: "join", by: m, war: war.id, side, target: c.by, cause: "treaty", origin: c.id, stage: s.interest >= 0.5 || s.rival > 0 ? "decision" : "tension" });
    called += 1;
  }
}

/**
 * The world body grows: a state that comes free – a colony, the winner of a secession, a country the story creates – is
 * admitted about a year after, unless a permanent member that distrusts it vetoes (a roll on its trust, kept for the
 * year). States the date's world body left out (the divided nations, the neutrals that stayed out) stay out: their
 * seat is history's or the story's. The People's Republic takes China's seat from Taipei on 25 October 1971 in the
 * historical mode, and by the Assembly's majority from that day in the free mode (seatChina).
 */
export function growWorldBody(next: GameState, ctx: { turn: number; to: string; years: number; holders: Set<string> }, applied: AppliedChange[]): void {
  const body = worldBody(next);
  if (!body || body.id !== "un") return;
  seatChina(next, body, ctx, applied);
  // Every state of the date is a member but those it left out; a movement it left out that comes free is a new state,
  // a state it left out stays out.
  const scenario = SCENARIOS[next.scenarioId];
  const left = scenario.alliances.find((a) => a.id === body.id)?.allExcept ?? [];
  const born = (tag: string) => !left.includes(tag) || Boolean(scenario.countries[tag]?.dormant);
  const permanent = permanentMembers(next, ctx.holders).filter((m) => body.members.includes(m));
  const year = ctx.to.slice(0, 4);
  for (const tag of Object.keys(next.countries).sort()) {
    const c = next.countries[tag];
    if (body.members.includes(tag) || !ctx.holders.has(tag) || c.dormant || c.exile) continue;
    if (!born(tag)) continue;
    // Rebels still fighting for their country are no state yet.
    if ((next.civilWars ?? []).some((cw) => !cw.end && cw.rebels === tag)) continue;
    const freed = (next.colonies ?? []).find((x) => x.tag === tag && x.end && x.end.how !== "union")?.end?.date ?? (next.civilWars ?? []).find((cw) => cw.rebels === tag && cw.end?.how === "partition")?.end?.date;
    if (freed ? yearsBetween(freed, ctx.to) < 1 : roll(next.seed ?? next.id, ctx.turn, `admit:${tag}`) >= 1 - Math.exp(-ctx.years)) continue;
    const vetoed = permanent.some((p) => {
      const trust = tieOf(next, p, tag).trust;
      return trust <= -30 && roll(next.seed ?? next.id, 0, `veto:${tag}:${p}:${year}`) < Math.min(0.9, -trust / 100);
    });
    if (vetoed) continue;
    body.members = [...body.members, tag];
    applied.push({ kind: "accession", alliance: body.id, name: body.name, country: tag });
  }
}

/** China's seat passes from Taipei to Beijing: on its day in the historical mode; in the free mode when the Assembly's majority, as it then stands, would vote it. */
function seatChina(next: GameState, body: Alliance, ctx: { to: string; holders: Set<string> }, applied: AppliedChange[]): void {
  if (ctx.to < CHINA_SEAT || !body.members.includes("taiwan") || body.members.includes("china") || !next.countries.china || !ctx.holders.has("china")) return;
  if (next.mode !== "historical") {
    // Each member as its trust leans: Beijing's friends and those with no quarrel for it, Taipei's protectors against.
    const voters = body.members.filter((m) => m !== "china" && m !== "taiwan" && ctx.holders.has(m));
    const yes = voters.filter((m) => tieOf(next, m, "china").trust + 10 >= tieOf(next, m, "taiwan").trust).length;
    if (yes * 2 <= voters.length) return;
  }
  body.members = [...body.members.filter((m) => m !== "taiwan"), "china"];
  applied.push({ kind: "leave", alliance: body.id, name: body.name, country: "taiwan" });
  applied.push({ kind: "accession", alliance: body.id, name: body.name, country: "china" });
}

/** A standing call of the world body for collective action on the side a plan would join: the honour of going rises. */
export function calledToArms(state: Pick<GameState, "wars" | "aggressions">, p: Pick<Plan, "war" | "side">): number {
  const war = state.wars.find((w) => w.id === p.war);
  if (!war || !p.side) return 0;
  const side = war[p.side];
  return (state.aggressions ?? []).some((a) => a.war === war.id && !a.closed && side.includes(a.against) && a.resolutions?.some((r) => r.kind === "action" && r.passed)) ? 0.2 : 0;
}

/** How alarmed a government is by a country's attacks of the past year, 0–2: their gravity, the nearer the more; nothing for its allies. */
export function alarmOf(state: GameState, tag: string, by: string): number {
  if (tag === by || allied(state, tag, by)) return 0;
  let alarm = 0;
  for (const a of state.aggressions ?? []) {
    if (a.by !== by || yearsBetween(a.date, state.date) >= 1) continue;
    alarm = Math.max(alarm, a.weight * (tieOf(state, tag, by).near / 100));
  }
  return round2(clamp(alarm, 0, 2));
}

/** Arms that go to the victims this turn: each giver's share of its GDP from its own stores, split between the victims it aids, within a share of each victim's GDP. */
export function aidDeliveries(state: GameState, years: number): Delivery[] {
  const open = (state.aggressions ?? []).filter((a) => !a.closed && a.aid?.length && warBetween(state, a.by, a.against));
  if (!open.length) return [];
  const load = new Map<string, number>();
  for (const a of open) for (const g of a.aid!) load.set(g, (load.get(g) ?? 0) + 1);
  const out: Delivery[] = [];
  for (const a of open) {
    const victim = state.countries[a.against]?.economy;
    if (!victim) continue;
    let room = AID_CAP * victim.gdp * years;
    for (const g of a.aid!) {
      const e = state.countries[g]?.economy;
      if (!e || g === a.against || warBetween(state, g, a.against) || room <= 0) continue;
      const money = Math.min(room, (years * AID_SHARE * e.gdp * Math.min(1.5, a.weight)) / (load.get(g) ?? 1));
      if (money < 0.001) continue;
      room -= money;
      out.push({ from: g, to: a.against, money: Math.round(money * 1000) / 1000, fromStock: true });
    }
  }
  return out;
}

/** Who gives a country arms against an enemy: the givers of every open case of the enemy's aggression against it. */
export function aidTo(state: Pick<GameState, "aggressions">, tag: string, enemy: string): string[] {
  return [...new Set((state.aggressions ?? []).filter((a) => !a.closed && a.against === tag && a.by === enemy).flatMap((a) => a.aid ?? []))];
}

/** The open case of a war's aggression against a country, the latest first. */
export function caseOf(state: Pick<GameState, "aggressions">, war: string): Aggression | undefined {
  return [...(state.aggressions ?? [])].reverse().find((a) => a.war === war);
}

const FORUM_EN: Record<string, Record<Forum, string>> = {
  un: { council: "UN Security Council", assembly: "UN General Assembly" },
  "league-of-nations": { council: "League of Nations", assembly: "League of Nations" },
};

/**
 * The world's answer to aggression for the game master, in one line: the
 * latest cases with who condemned, the world body's votes, sanctions, arms,
 * pledges and who may enter the war. Already decided and applied.
 */
export function describeAggression(state: GameState, name: (tag: string) => string): string[] {
  const cases = (state.aggressions ?? [])
    .filter((a) => !a.closed || yearsBetween(a.closed, state.date) < 0.1)
    .sort((x, y) => y.date.localeCompare(x.date) || y.weight - x.weight)
    .slice(0, 3);
  if (!cases.length) return [];
  const who = (tag: string) => `${name(tag)} [${tag}]`;
  const few = (tags: string[], n = 4) => `${tags.slice(0, n).map(name).join(", ")}${tags.length > n ? ` +${tags.length - n}` : ""}`;
  const parts = cases.map((a) => {
    const out: string[] = [`${who(a.by)} → ${who(a.against)} (from ${a.date}; gravity ${a.weight}/3${a.repeat ? `, ${a.repeat + 1} attacks in a year` : ""})`];
    if (a.condemned.length) out.push(`condemned by ${few(a.condemned)}`);
    for (const r of (a.resolutions ?? []).slice(-3)) {
      const where = FORUM_EN[a.body ?? "un"]?.[r.forum] ?? r.forum;
      const result = r.passed ? "passed" : r.veto ? `vetoed by ${r.veto.map(name).join(", ")}` : "failed";
      out.push(`${where}: ${r.kind === "condemn" ? "condemnation" : r.kind === "sanctions" ? "call for sanctions" : "call for collective action"} ${result} ${r.yes}–${r.no}–${r.abstain}`);
    }
    if (a.blocked) out.push(`waits for the General Assembly (Uniting for Peace, from ${UNITING_FOR_PEACE})`);
    const sanctions = [...new Set([...(state.sanctions ?? []).filter((s) => s.against === a.by && s.since >= a.date).map((s) => s.by), ...(state.plans ?? []).filter((p) => !p.end && p.kind === "sanction" && !p.lift && p.target === a.by && p.origin === a.id).map((p) => p.by)])];
    if (sanctions.length) out.push(`sanctions by ${few(sanctions)}`);
    if (a.aid?.length) out.push(`arms from ${few(a.aid)}`);
    if (a.pledges?.length) out.push(`pledges: ${a.pledges.map((p) => `${name(p.by)} to defend ${name(p.to)}`).join(", ")}`);
    const war = state.wars.find((w) => w.id === a.war);
    const side = war?.defenders.includes(a.against) ? "defenders" : "attackers";
    const joining = (state.plans ?? []).filter((p) => !p.end && p.kind === "join" && p.war === a.war && p.side === side).map((p) => p.by);
    if (joining.length) out.push(`may enter the war: ${few(joining)}`);
    if (a.closed) out.push("case closed");
    return out.join("; ");
  });
  return [`THE WORLD'S ANSWER TO AGGRESSION (the engine's, decided and applied – tell it as the world's reaction where it matters; put none of it in your answer): ${parts.join(" | ")}`];
}

import { roll } from "./dice";
import {
  ARMS_SALES,
  balanceOf,
  booksNow,
  canTrade,
  capacity,
  clamp,
  committed,
  dealsLeft,
  foesOf,
  makesArms,
  REACH,
  round,
  smallest,
  STOCKPILE_SHARE,
  TRADE_GOODS,
  tableDeal,
  termsOf,
  type TradeBooksNow,
  tradeOffers,
  yearsFrom,
} from "./deals";
import { relationsOf } from "./envoys";
import { allied, isMilitary, pacted, remember, tieOf } from "./relations";
import { countryCentres, distanceKm } from "./trade";
import { DEAL_CONDITIONS, DEAL_PAYMENTS } from "./types";
import type { DealCondition, DealConditionKind, DealReason, DealRound, DealTerms, GameState, MapRegion, TradeDeal, TradeGood } from "./types";

/**
 * Trade talks. The player changes the terms of a deal the market offers –
 * the volume, the price, the length, how it is paid (money, goods in kind,
 * credit) and what each side grants besides (recognition, votes at the
 * world body, a base, an alliance, technology, exclusivity) – proposes a
 * deal of its own to any government, or reopens a deal in force. The other
 * government answers at once, by the engine's dice: from its need of the
 * good and the alternatives it has, its ties to the player (engine/
 * relations.ts), its claims and bloc, the player's name for keeping deals,
 * and how long the haggling has gone on. It accepts, counters (twice at
 * most) or walks away; an offer that asks far too much, or talks dragged
 * out, cost its trust. Before an offer is sent, the same reckoning without
 * the dice tells the player the likely answer. The game master hears the
 * offers and the answers when the turn is played (engine/deals.ts).
 */

/** The partner's counters in one set of talks; the player's offers are one more. */
export const MAX_COUNTERS = 2;
export const MAX_ROUNDS = MAX_COUNTERS + 1;
/** The dice's spread, in points of the price: ±5. */
const NOISE = 10;
/** How far the terms may ask beyond what the partner would give before it walks away instead of countering. */
const GIVE_UP: Record<Stance, number> = { eager: 30, cool: 18, hostile: 8 };
/** What the partner will not grant at any price. */
const IMPOSSIBLE = 40;
/** The length of contract each good usually runs to, years: gas by pipeline for long, arms a lot at a time. */
const YEARS: Record<TradeGood, number> = { gas: 8, oil: 5, coal: 4, uranium: 5, metals: 4, grain: 3, arms: 2 };
/** Political terms on a deal, at most. */
export const MAX_CONDITIONS = 4;

export type Stance = "eager" | "cool" | "hostile";

/** One government's view of a deal on the table. */
export interface Appraisal {
  stance: Stance;
  /** What weighs most in its stance. */
  why: DealReason;
  /** Points of the price by which the terms ask more of it than it would give; at or below zero it signs. */
  gap: number;
  /** Chance it signs these terms as they stand, 0–1. */
  chance: number;
  /** Its likely answer. */
  likely: "accept" | "counter" | "refuse";
  /** The term that stands most in the way, when the terms ask too much. */
  sticking?: DealReason;
  /** The most it takes or gives of the good, $bn a year. */
  room: number;
  /** Its limit on the price, % to the market: the most it pays when it buys, the least it takes when it sells. */
  limit: number;
  /** The years it would rather sign for. */
  term: number;
  /** Conditions it will not grant, nor accept, at any price. */
  refused: DealConditionKind[];
  /** It will not deal at all, and why. */
  blocked?: DealReason;
}

/** A deal to talk about: whom with, what, which way; and the deal it is, if one is on the table already. */
export interface Talk {
  partner: string;
  good: TradeGood;
  side: "sell" | "buy";
  deal?: string;
}

/** The books talks are judged by, worked out once: every country's accounts and grain, and where its people live. */
export interface Market extends TradeBooksNow {
  at: Map<string, [number, number]>;
}

export function marketOf(state: GameState, map: Record<string, MapRegion>): Market {
  return { ...booksNow(state, map), at: countryCentres(state, map) };
}

/** Two governments in rival military blocs, or one allied to a country at war with the other. */
export function rivals(state: Pick<GameState, "alliances" | "wars">, a: string, b: string): boolean {
  if (allied(state, a, b)) return false;
  const blocs = (tag: string) => state.alliances.filter((x) => isMilitary(x) && x.members.includes(tag));
  const ba = blocs(a);
  const bb = blocs(b);
  const foesA = foesOf(state, a);
  const foesB = foesOf(state, b);
  if (bb.some((x) => x.members.some((m) => foesA.has(m))) || ba.some((x) => x.members.some((m) => foesB.has(m)))) return true;
  // The camps of a cold war: each in a bloc of three or more, and not the same one.
  return ba.some((x) => x.members.length >= 3) && bb.some((x) => x.members.length >= 3);
}

/** Deals the player broke or tore up in the last three years: its name as a partner. */
export function reputationOf(state: Pick<GameState, "chronicle" | "date">): number {
  const since = new Date(Date.parse(state.date) - 3 * 365.25 * 86_400_000).toISOString().slice(0, 10);
  let n = 0;
  for (let i = state.chronicle.length - 1; i >= 0; i--) {
    const e = state.chronicle[i];
    if (e.to < since) break;
    for (const c of e.applied) if (c.kind === "deal" && (c.change === "cancelled" || (c.change === "broken" && c.by === "player"))) n++;
  }
  return n;
}

/** How many others could sell the partner what it buys, or buy what it sells, nearer ones counting more: 0 none, 1 plenty. */
function alternatives(state: GameState, market: Market, talk: Talk, value: number): number {
  const buys = talk.side === "sell";
  const from = market.at.get(talk.partner);
  let sum = 0;
  for (const c of Object.values(state.countries)) {
    if (c.tag === talk.partner || c.tag === state.player || c.dormant || !c.economy || !canTrade(state, talk.partner, c.tag)) continue;
    let fits: boolean;
    if (talk.good === "arms") fits = buys ? makesArms(state, c.tag) && !foesOf(state, talk.partner).has(c.tag) : foesOf(state, c.tag).size > 0;
    else {
      const b = balanceOf(talk.good, market.accounts.get(c.tag), market.grain.get(c.tag) ?? 0);
      fits = (buys ? b : -b) >= value * 0.5;
    }
    if (!fits) continue;
    const there = market.at.get(c.tag);
    sum += from && there ? (1000 / Math.max(1000, distanceKm(from, there))) ** REACH[talk.good] : 0.3;
  }
  return clamp(sum / 3, 0, 1);
}

/** The deal a talk is about, if one is on the table or in force. */
const dealOf = (state: GameState, talk: Talk) => (talk.deal ? state.deals?.find((d) => d.id === talk.deal) : undefined);

/**
 * What the partner makes of the terms: its stance and why, how far the
 * terms are from what it would give, the chance it signs, and its likely
 * answer. `round` is the player's offer number in these talks, `counters`
 * the partner's counters so far.
 */
export function appraise(state: GameState, market: Market, talk: Talk, terms: DealTerms, opts: { round?: number; counters?: number } = {}): Appraisal {
  const { partner, good, side } = talk;
  const player = state.player;
  const round_ = opts.round ?? 1;
  const counters = opts.counters ?? 0;
  const c = state.countries[partner];
  const buys = side === "sell";
  const none = { gap: 99, chance: 0, likely: "refuse" as const, room: 0, limit: 0, term: 1, refused: [] };
  if (!c?.economy || c.dormant || partner === player || !state.countries[player]?.economy) return { ...none, stance: "cool", why: "noNeed", blocked: "noNeed" };
  const war = foesOf(state, player).has(partner);
  if (!canTrade(state, player, partner)) return { ...none, stance: "hostile", why: war ? "war" : "sanctions", blocked: war ? "war" : "sanctions" };
  // At war, the enemy's military allies are no partners.
  const enemies = foesOf(state, player);
  if (enemies.size && state.alliances.some((b) => isMilitary(b) && b.members.includes(partner) && b.members.some((m) => enemies.has(m)))) return { ...none, stance: "hostile", why: "war", blocked: "war" };
  // No new treaty while relations are broken; with the ambassadors recalled a government is cold (engine/envoys.ts).
  const relations = relationsOf(state, player, partner);
  if (relations === "broken") return { ...none, stance: "hostile", why: "relations", blocked: "relations" };

  const gdp = Math.max(0.01, c.economy.gdp);
  const deal = dealOf(state, talk);
  const others = committed(state.deals ?? [], good, side, partner, talk.deal);
  const bal = balanceOf(good, market.accounts.get(partner), market.grain.get(partner) ?? 0);
  const fighting = foesOf(state, partner).size > 0;
  // What it lacks and would buy, or has to spare and would sell, less what it already takes from or gives to the player.
  const need = Math.max(0, (good === "arms" ? (buys ? gdp * (fighting ? 0.02 : 0.003) : makesArms(state, partner) ? gdp * ARMS_SALES : 0) : buys ? -bal : bal) - others);
  // A buyer takes a little more for its stores; arms only as it needs them.
  const room = round(buys && good !== "arms" ? need + gdp * STOCKPILE_SHARE : need);
  if (room < 0.01) return { ...none, stance: "cool", why: buys ? "noNeed" : "nothingSpare", blocked: buys ? "noNeed" : "nothingSpare" };

  const value = Math.max(0.01, terms.value);
  const keen = buys ? (need >= value ? 1 : need > 0 ? need / value : -0.4) : need >= value ? 0.5 + 0.5 * clamp(need / (gdp * 0.02), 0, 1) : need > 0 ? (0.3 * need) / value : -0.4;
  const alt = alternatives(state, market, talk, value);
  const tie = tieOf(state, partner, player);
  const trust = tie.trust / 100;
  const tension = tie.tension / 100;
  const bond = allied(state, partner, player) ? 0.15 : pacted(state, partner, player) ? 0.08 : 0;
  const rival = rivals(state, player, partner);
  // A rival camp sells no arms or uranium to the other, and buys none of them from it.
  if (rival && (good === "arms" || good === "uranium")) return { ...none, stance: "hostile", why: "rival", blocked: "rival" };
  const sanctioned = (state.sanctions ?? []).some((s) => (s.by === partner && s.against === player) || (s.by === player && s.against === partner));
  const claims = (c.course?.aims ?? []).some((a) => a.kind !== "protect" && a.target === player);
  const name = reputationOf(state);
  const parts: [DealReason, number][] = [
    [buys ? (keen > 0 ? "need" : "noNeed") : keen > 0 ? "spare" : "nothingSpare", 0.45 * keen],
    [trust + bond >= 0 ? "ties" : "distrust", 0.35 * trust + bond],
    ["tension", -0.2 * tension],
    ["alternatives", -0.25 * alt],
    // Fuel and ore from a rival camp is a dependence a government weighs harder than bread.
    ["rival", rival ? (good === "grain" ? -0.3 : -0.45) : 0],
    ["sanctions", sanctioned ? -0.25 : 0],
    ["claims", claims ? -0.25 : 0],
    ["reputation", -0.08 * Math.min(5, name)],
    ["relations", relations === "recalled" ? -0.15 : 0],
  ];
  const mood = parts.reduce((s, [, v]) => s + v, 0);
  // Hostility is politics: no need of the good or other suppliers make a government cool, not hostile.
  const politics = parts.slice(1).filter(([r]) => r !== "alternatives").reduce((s, [, v]) => s + v, 0);
  const stance: Stance = politics <= -0.25 || tension >= 0.6 || trust <= -0.4 ? "hostile" : mood >= 0.3 ? "eager" : "cool";
  const ranked = (stance === "hostile" ? parts.slice(1).filter(([r]) => r !== "alternatives") : [...parts]).sort((a, b) => (stance === "eager" ? b[1] - a[1] : a[1] - b[1]));
  const why: DealReason = stance === "eager" || ranked[0][1] < -0.02 ? ranked[0][0] : "fair";

  // Its limit on the price: a keen buyer with nowhere else to go pays over the market, a keen seller gives a discount.
  const pressing = keen >= 0.8 ? 8 * (1 - alt) : 0;
  const limit = Math.round(buys ? clamp(3 + 25 * mood + pressing, -25, 40) : clamp(-3 - 25 * mood - 0.75 * pressing, -40, 25));
  const term = Math.round(clamp(YEARS[good] * (trust >= 0 ? 1 + 0.5 * trust : 1 + trust), 1, 10));
  const strained = Boolean(deal?.status === "active" && deal.strain);

  const items: [DealReason, number][] = [["price", buys ? terms.premium - limit : limit - terms.premium]];
  // A hostile government deals with the player only for something over the odds.
  if (stance === "hostile") items.push([why, 8]);
  if (value > room * 1.02) items.push(["volume", Math.min(30, 4 + 20 * (value / room - 1))]);
  // Less than a deal in force gives it, when it needs it, unless the deal is not delivering anyway.
  if (deal?.status === "active" && value < deal.value && !strained) items.push(["volume", 10 * (1 - value / deal.value) * Math.max(0, keen)]);
  const off = Math.max(0, Math.abs(terms.years - term) - 1);
  if (off) items.push(["length", 2 * off * (terms.years > term && trust < 0 ? 2 : 1)]);
  const payment = paymentCost(state, market, talk, terms, { trust, bond: bond > 0.1 });
  if (payment) items.push(["payment", payment]);
  const great = [...Object.values(state.countries)].filter((x) => (x.economy?.gdp ?? 0) > gdp).length < 6;
  const threat = c.course ? Math.max(0, ...Object.entries(c.course.ties).filter(([t]) => t !== player).map(([, t]) => t.threat)) / 100 : 0;
  const ctx = { rival, trust, hostile: stance === "hostile", allied: allied(state, partner, player), pacted: pacted(state, partner, player), alt, great, threat };
  // Political terms weigh less against a deal that matters more to its economy.
  const size = clamp(value / Math.max(0.005, gdp * 0.004), 0.4, 3);
  const refused: DealConditionKind[] = [];
  let political = 0;
  for (const cond of terms.conditions ?? []) {
    const cost = conditionCost(cond, ctx);
    if (cost >= IMPOSSIBLE) refused.push(cond.kind);
    else political += cost / size;
  }
  if (political) items.push(["conditions", political]);
  if (refused.length) items.push(["impossible", IMPOSSIBLE]);
  if (round_ > 1) items.push(["patience", 3 * (round_ - 1)]);
  // A deal in force is changed only for a reason: the partner holds to what was signed, unless it is not delivering.
  if (deal?.status === "active" && !strained) items.push(["signed", 5]);

  const gap = round(items.reduce((s, [, v]) => s + v, 0), 1);
  const chance = refused.length ? 0 : round(clamp(0.5 - gap / NOISE, 0, 1));
  const worst = [...items].sort((a, b) => b[1] - a[1])[0];
  const sticking = gap > 0 && worst[1] > 0 ? worst[0] : undefined;
  const rest = gap - (refused.length ? IMPOSSIBLE : 0);
  const likely = chance >= 0.5 ? "accept" : counters < MAX_COUNTERS && rest <= GIVE_UP[stance] ? "counter" : "refuse";
  return { stance, why, gap, chance, likely, ...(sticking ? { sticking } : {}), room, limit, term, refused };
}

/** What a way of payment costs the partner in points of the price (a gain below zero); IMPOSSIBLE when it cannot be. */
function paymentCost(state: GameState, market: Market, talk: Talk, terms: DealTerms, ctx: { trust: number; bond: boolean }): number {
  const pay = terms.pay ?? "money";
  if (pay === "money") return 0;
  const buys = talk.side === "sell";
  const economy = (tag: string) => state.countries[tag]?.economy;
  if (pay === "credit") {
    // Paying later is a favour to the buyer: a partner in debt values it the more; selling on credit to the player is a risk by its debts.
    if (buys) {
      const e = economy(talk.partner);
      return -(3 + 8 * clamp((e?.debt ?? 0) / Math.max(0.01, e?.gdp ?? 0), 0, 1));
    }
    const e = economy(state.player);
    return Math.max(2, 5 + 25 * clamp((e?.debt ?? 0) / Math.max(0.01, e?.gdp ?? 0) - 0.3, 0, 1) + (ctx.trust < 0 ? 8 : 0) - (ctx.bond ? 4 : 0));
  }
  // In goods: the buyer pays with a good it has to spare.
  const g = terms.payGood;
  if (!g || g === talk.good) return IMPOSSIBLE;
  const payer = buys ? talk.partner : state.player;
  const spare = g === "arms" ? (makesArms(state, payer) ? Infinity : 0) : balanceOf(g, market.accounts.get(payer), market.grain.get(payer) ?? 0);
  if (spare < terms.value * 0.5) return IMPOSSIBLE;
  if (buys) {
    // Paying in kind saves its hard currency, the more when its reserves are thin.
    const e = economy(talk.partner);
    return -(2 + ((e?.reserves ?? 0) < (e?.gdp ?? 0) * 0.05 ? 3 : 0));
  }
  // Paid in kind, it wants a good it lacks; any other it must sell on.
  const theirs = g === "arms" ? 0 : balanceOf(g, market.accounts.get(talk.partner), market.grain.get(talk.partner) ?? 0);
  return theirs < 0 ? -4 : 8;
}

/** What a political term costs the partner in points (a gain below zero), before the deal's size; IMPOSSIBLE when it will not have it. */
function conditionCost(c: DealCondition, ctx: { rival: boolean; trust: number; hostile: boolean; allied: boolean; pacted: boolean; alt: number; great: boolean; threat: number }): number {
  if (c.by === "partner") {
    switch (c.kind) {
      case "recognition":
        return 6 + (ctx.rival || ctx.hostile ? 14 : 0);
      case "votes":
        return 6 + (ctx.rival ? 14 : 0);
      case "base":
        return ctx.rival || ctx.trust < 0 || ctx.hostile ? IMPOSSIBLE : 22 - (ctx.allied ? 10 : 0);
      case "alliance":
        return ctx.allied ? 0 : ctx.rival || ctx.trust < 0 || ctx.hostile ? IMPOSSIBLE : 30 - (ctx.pacted ? 8 : 0);
      case "technology":
        return 10 + (ctx.rival ? 12 : 0);
      case "exclusivity":
        return 4 + 14 * ctx.alt;
    }
  }
  switch (c.kind) {
    case "recognition":
    case "votes":
      return -4;
    case "base":
      // Leave to station forces on the player's soil is worth most to a power that sends them abroad.
      return ctx.great ? -10 : -2;
    case "alliance":
      return ctx.allied ? 0 : ctx.rival || ctx.trust < 0 || ctx.hostile ? IMPOSSIBLE : -(6 + 10 * ctx.threat);
    case "technology":
      return -8;
    case "exclusivity":
      return -5;
  }
}

/** Terms cleaned up: within what the player can deliver or take, the price and the term in bounds, a payment that exists, one condition of a kind. Null when there is nothing to offer. */
export function sanitizeTerms(state: GameState, market: Market, talk: Talk, terms: DealTerms): DealTerms | null {
  const room = capacity(state, null, talk.good, talk.side, market, talk.deal);
  if (room < 0.01) return null;
  const pay = DEAL_PAYMENTS.includes(terms.pay ?? "money") ? (terms.pay ?? "money") : "money";
  const payGood = pay === "goods" && terms.payGood && TRADE_GOODS.includes(terms.payGood) && terms.payGood !== talk.good ? terms.payGood : undefined;
  const seen = new Set<string>();
  const conditions = (terms.conditions ?? []).filter((c) => {
    if (!DEAL_CONDITIONS.includes(c.kind) || (c.by !== "player" && c.by !== "partner") || seen.has(c.kind)) return false;
    // An alliance between allies says nothing.
    if (c.kind === "alliance" && allied(state, state.player, talk.partner)) return false;
    seen.add(c.kind);
    return true;
  });
  return termsOf({
    value: round(clamp(terms.value, Math.min(room, smallest(state.scenarioId)), room)),
    premium: Math.round(clamp(terms.premium, -40, 50)),
    years: Math.round(clamp(terms.years, 1, 10)),
    pay: pay === "goods" && !payGood ? "money" : pay,
    ...(payGood ? { payGood } : {}),
    conditions: conditions.slice(0, MAX_CONDITIONS).map((c) => ({ kind: c.kind, by: c.by })),
  });
}

/** The offers of the talks under way: since the last terms both sides agreed. */
function currentRounds(d: TradeDeal): DealRound[] {
  const rounds = d.rounds ?? [];
  let start = 0;
  rounds.forEach((r, i) => {
    if (r.answer === "accepted") start = i + 1;
  });
  return rounds.slice(start);
}

/**
 * Where the talks on a deal stand: whether they are open, whether the
 * player may make an offer now (a deal in force may be reopened once a
 * turn), its offer number, the partner's counters so far, and the
 * partner's terms on the table.
 */
export function talksOf(d: TradeDeal, turn: number): { open: boolean; canOffer: boolean; round: number; counters: number; table?: DealTerms } {
  const open = d.status === "proposed" || Boolean(d.talking);
  if (d.status === "active" && !d.talking) {
    // Signed this turn, or reopened this turn already: it stands until the next.
    const reopened = (d.rounds ?? []).some((r) => r.turn === turn && r.by === "player");
    return { open: false, canOffer: d.turn !== turn && !reopened, round: 1, counters: 0 };
  }
  const current = currentRounds(d);
  const last = current.at(-1);
  const round = current.filter((r) => r.by === "player").length + 1;
  const waiting = !last || (last.by === "partner" && !last.answer);
  return {
    open,
    canOffer: open && waiting && round <= MAX_ROUNDS,
    round,
    counters: current.filter((r) => r.by === "player" && r.answer === "countered").length,
    ...(last && last.by === "partner" && !last.answer ? { table: last.terms } : {}),
  };
}

/** The partner's counter: the volume it can take or give, a term nearer its own, no payment or term it will not have, and the price that makes the rest worth it to it – with a margin for itself. */
function counterTerms(state: GameState, market: Market, talk: Talk, terms: DealTerms, a: Appraisal, counters: number): DealTerms | null {
  const buys = talk.side === "sell";
  const t: DealTerms = termsOf(terms);
  t.value = round(Math.min(t.value, a.room));
  if (t.value < 0.01) return null;
  if (Math.abs(t.years - a.term) > 1) t.years = Math.max(1, t.years > a.term ? a.term + 1 : a.term - 1);
  const ties = { trust: tieOf(state, talk.partner, state.player).trust / 100, bond: allied(state, talk.partner, state.player) };
  if (t.pay && paymentCost(state, market, talk, t, ties) > 4) {
    delete t.pay;
    delete t.payGood;
  }
  // Conditions it refuses go; of what it is asked to grant, it keeps only what a keen partner would.
  const allowance = a.stance === "eager" ? 12 : a.stance === "cool" ? 6 : 0;
  let kept = (t.conditions ?? []).filter((c) => !a.refused.includes(c.kind));
  const asked = kept.filter((c) => c.by === "partner");
  if (asked.length) {
    const cost = (c: DealCondition) => appraise(state, market, talk, { ...t, conditions: [c] }).gap - appraise(state, market, talk, { ...t, conditions: [] }).gap;
    let spent = 0;
    const affordable = new Set(
      [...asked]
        .sort((x, y) => cost(x) - cost(y))
        .filter((c) => {
          spent += cost(c);
          return spent <= allowance;
        })
        .map((c) => c.kind),
    );
    kept = kept.filter((c) => c.by === "player" || affordable.has(c.kind));
  }
  if (kept.length) t.conditions = kept;
  else delete t.conditions;
  // The price at which the rest is worth it to it, keeping a margin: more on its first counter.
  const r = appraise(state, market, talk, { ...t, premium: 0 });
  if (r.refused.length || r.blocked) return null;
  const rest = r.gap - (buys ? -r.limit : r.limit);
  const firm = counters === 0 ? 4 : 2;
  let premium = buys ? r.limit - rest - firm : r.limit + rest + firm;
  // Never worse for itself than what the player asked.
  premium = Math.round(buys ? Math.min(premium, terms.premium) : Math.max(premium, terms.premium));
  if (premium < -40 || premium > 50) return null;
  t.premium = premium;
  return t;
}

/** The partner's answer to the player's offer, by the dice: accepted, countered with its own terms, or refused. */
export function answerOffer(state: GameState, market: Market, talk: Talk, terms: DealTerms, round_: number, counters: number): { answer: "accepted" | "countered" | "refused"; reason: DealReason; counter?: DealTerms; appraisal: Appraisal } {
  const a = appraise(state, market, talk, terms, { round: round_, counters });
  if (a.blocked) return { answer: "refused", reason: a.blocked, appraisal: a };
  const noise = (roll(state.seed ?? state.id, state.turn, `deal:${talk.partner}:${talk.good}:${talk.side}:${round_}`) - 0.5) * NOISE;
  if (!a.refused.length && a.gap + noise <= 0) return { answer: "accepted", reason: a.why, appraisal: a };
  const rest = a.gap - (a.refused.length ? IMPOSSIBLE : 0);
  if (counters < MAX_COUNTERS && rest <= GIVE_UP[a.stance]) {
    const counter = counterTerms(state, market, talk, terms, a, counters);
    if (counter) return { answer: "countered", reason: a.refused.length ? "impossible" : (a.sticking ?? a.why), counter, appraisal: a };
  }
  // Asking far too much, a term it will not have, or talks it has no more patience for.
  const reason: DealReason = rest > GIVE_UP[a.stance] ? (a.sticking ?? a.why) : a.refused.length ? "impossible" : counters >= MAX_COUNTERS ? "patience" : (a.sticking ?? a.why);
  return { answer: "refused", reason, appraisal: a };
}

/** A deal with new terms in place of its old, payment and conditions included. */
function withTerms(d: TradeDeal, t: DealTerms): TradeDeal {
  const out: TradeDeal = { ...d };
  delete out.pay;
  delete out.payGood;
  delete out.conditions;
  return { ...out, ...termsOf(t) };
}

/** The state with one deal put in place of its old self (or added), and the partner's country copied so its trust can move. */
function withDeal(state: GameState, deal: TradeDeal, now: Date): GameState {
  const deals = state.deals ?? [];
  const at = deals.findIndex((d) => d.id === deal.id);
  const countries = state.countries[deal.partner] ? { ...state.countries, [deal.partner]: structuredClone(state.countries[deal.partner]) } : state.countries;
  return { ...state, countries, deals: at >= 0 ? deals.map((d, i) => (i === at ? deal : d)) : [...deals, deal], updatedAt: now.toISOString() };
}

/** The player's offer on a deal and the partner's answer to it, with what the haggling cost in trust. */
function bargain(state: GameState, market: Market, deal: TradeDeal, terms: DealTerms, now: Date): GameState {
  const talk: Talk = { partner: deal.partner, good: deal.good, side: deal.side, deal: deal.id };
  const where = talksOf(deal, state.turn);
  if (!where.canOffer) return state;
  const res = answerOffer(state, market, talk, terms, where.round, where.counters);
  const rounds = (deal.rounds ?? []).map((r, i, all) => (i === all.length - 1 && r.by === "partner" && !r.answer ? { ...r, answer: "countered" as const } : r));
  rounds.push({ by: "player", terms: termsOf(terms), answer: res.answer, reason: res.reason, turn: state.turn });
  let next: TradeDeal;
  if (res.answer === "accepted") next = signWith({ ...deal, rounds }, terms, state.date);
  else if (res.answer === "countered") {
    rounds.push({ by: "partner", terms: res.counter!, reason: res.reason, turn: state.turn });
    // On the table, the counter; a deal in force stands as it was while the talks go on.
    next = deal.status === "active" ? { ...deal, rounds, talking: true } : { ...withTerms(deal, res.counter!), rounds };
  } else {
    next = deal.status === "active" ? { ...deal, rounds } : { ...deal, rounds, status: "declined" };
    delete next.talking;
  }
  const out = withDeal(state, next, now);
  // Haggling costs trust: every offer after the first a little, an offer refused for asking far too much more.
  const cost = (where.round - 1) + (res.answer === "refused" && res.appraisal.gap > GIVE_UP[res.appraisal.stance] ? 3 : 0);
  if (cost) remember(out, deal.partner, state.player, "provoked", -cost, state.date, false);
  return out;
}

/** A deal signed on the terms given: in force from today for its term; a deal in force reopened keeps its start and runs its new term from today. */
function signWith(d: TradeDeal, terms: DealTerms, date: string): TradeDeal {
  const signed = withTerms(d, terms);
  delete signed.talking;
  return d.status === "active" ? { ...signed, until: yearsFrom(date, signed.years) } : { ...signed, status: "active", since: date, until: yearsFrom(date, signed.years) };
}

/** The player counters one of the market's offers this turn: the talks open with the partner's offer and the player's terms. */
export function counterOffer(state: GameState, map: Record<string, MapRegion>, offerId: string, terms: DealTerms, now = new Date()): GameState {
  const offer = tradeOffers(state, map).find((o) => o.id === offerId);
  if (!offer) return state;
  const market = marketOf(state, map);
  const t = sanitizeTerms(state, market, offer, terms);
  if (!t) return state;
  const deal: TradeDeal = { ...tableDeal(state, offer, "offer"), rounds: [{ by: "partner", terms: termsOf(offer), turn: state.turn }] };
  return bargain(withDeal(state, deal, now), market, deal, t, now);
}

/** Whether the player can open talks with a government over a good this turn: room for a contract, nothing on the table with it already, and not turned away by it this turn. */
export function canPropose(state: GameState, talk: Talk): boolean {
  if (!dealsLeft(state) || talk.partner === state.player || !state.countries[talk.partner]?.economy) return false;
  return !(state.deals ?? []).some((d) => d.partner === talk.partner && d.good === talk.good && d.side === talk.side && (d.status === "proposed" || (d.status === "declined" && d.turn === state.turn) || (d.status === "active" && d.turn === state.turn)));
}

/** The player proposes a deal of its own to any government; it answers at once. */
export function proposeTerms(state: GameState, map: Record<string, MapRegion>, talk: Omit<Talk, "deal">, terms: DealTerms, now = new Date()): GameState {
  if (!canPropose(state, talk)) return state;
  const market = marketOf(state, map);
  const t = sanitizeTerms(state, market, talk, terms);
  if (!t) return state;
  const deal: TradeDeal = { ...tableDeal(state, { ...talk, ...t }, "player"), rounds: [] };
  if (state.deals?.some((d) => d.id === deal.id)) return state;
  return bargain(withDeal(state, deal, now), market, deal, t, now);
}

/** The player's next offer in talks under way, or new terms for a deal in force (reopening it). */
export function reviseTerms(state: GameState, map: Record<string, MapRegion>, id: string, terms: DealTerms, now = new Date()): GameState {
  const deal = state.deals?.find((d) => d.id === id);
  if (!deal || (deal.status !== "proposed" && deal.status !== "active")) return state;
  const market = marketOf(state, map);
  const t = sanitizeTerms(state, market, { partner: deal.partner, good: deal.good, side: deal.side, deal: deal.id }, terms);
  if (!t) return state;
  return bargain(state, market, deal, t, now);
}

/** The player takes the partner's counter: signed on its terms (a deal in force, changed to them). */
export function acceptTerms(state: GameState, id: string, now = new Date()): GameState {
  const deal = state.deals?.find((d) => d.id === id);
  if (!deal) return state;
  const where = talksOf(deal, state.turn);
  if (!where.open || !where.table) return state;
  const rounds = (deal.rounds ?? []).map((r, i, all) => (i === all.length - 1 ? { ...r, answer: "accepted" as const } : r));
  return withDeal(state, signWith({ ...deal, rounds }, where.table, state.date), now);
}

/** The player leaves the talks: a deal not yet signed is off the table for the turn; a deal in force stands as it was. */
export function leaveTalks(state: GameState, id: string, now = new Date()): GameState {
  const deal = state.deals?.find((d) => d.id === id);
  if (!deal || !talksOf(deal, state.turn).open) return state;
  const rounds = (deal.rounds ?? []).map((r, i, all) => (i === all.length - 1 && r.by === "partner" && !r.answer ? { ...r, answer: "refused" as const } : r));
  const next: TradeDeal = deal.status === "active" ? { ...deal, rounds } : { ...deal, rounds, status: "declined", note: "withdrawn" };
  delete next.talking;
  return withDeal(state, next, now);
}

/**
 * Proposals from a save made before the talks, still waiting for an answer
 * when the turn is played: the engine answers them now, as the partner
 * would have at once – accepted or refused, with no counter left to make.
 * Changes the state in place (the turn's copy).
 */
export function answerProposals(next: GameState, map: Record<string, MapRegion>): void {
  const waiting = (next.deals ?? []).filter((d) => d.status === "proposed" && !d.rounds?.length);
  if (!waiting.length) return;
  const market = marketOf(next, map);
  for (const d of waiting) {
    const terms = termsOf(d);
    const res = answerOffer(next, market, { partner: d.partner, good: d.good, side: d.side, deal: d.id }, terms, 1, MAX_COUNTERS);
    const rounds: DealRound[] = [{ by: "player", terms, answer: res.answer === "accepted" ? "accepted" : "refused", reason: res.reason, turn: next.turn }];
    const at = next.deals!.indexOf(d);
    next.deals![at] = res.answer === "accepted" ? signWith({ ...d, rounds }, terms, next.date) : { ...d, rounds, status: "declined" };
  }
}

import { z } from "zod";
import { addStep } from "./calendar";
import { type Accounts, nationalAccounts, type WorldScale } from "./economy";
import { BARRELS_PER_TONNE } from "./units";
import { peopleIn } from "./population";
import type { ResourceType } from "./resources";
import { countryCentres, distanceKm } from "./trade";
import type { AppliedChange, Economy, GameState, MapRegion, ScenarioId, TradeDeal, TradeGood } from "./types";

/**
 * Trade deals: contracts of the player's government with another to sell or
 * buy a good for a few years at an agreed price. Each turn the market offers
 * some — buyers short of what the country has in surplus (grain from its
 * fields, oil, coal, metals from its mines), sellers of what it lacks, arms
 * dealers when it is at war — which the player signs or turns down at once.
 * The player can also propose a deal of its own; the other government
 * answers in the next turn. A signed deal brings or costs hard currency
 * every turn, refills the stores of a resource bought, shows in the trade
 * books, and the game master hears of it: partners honour deals unless
 * war, sanctions or a blockade give them reason to break them.
 */

export const TRADE_GOODS = ["grain", "oil", "gas", "coal", "metals", "uranium", "arms"] as const;

const METALS: ResourceType[] = ["iron", "copper", "nickel", "tin", "bauxite"];

/** Below this, $bn a year, a surplus or a lack is not worth a contract: less in the far smaller economies of the world wars. */
const MIN_TRADE: Record<ScenarioId, number> = { "1914": 0.02, "1939": 0.03, "1950": 0.03, "1964": 0.04, "1991": 0.08, "1999": 0.08, "2014": 0.08, "2022": 0.08 };
/** The smallest contract offered, $bn a year. */
const smallest = (era: ScenarioId) => Math.max(0.01, round(MIN_TRADE[era] * 0.6));
/** Offers on the market each turn. */
const MAX_OFFERS = 6;
/** New contracts a government can negotiate in one turn: signed offers and its own proposals together. */
export const MAX_NEW_DEALS = 3;
/** Most a country spends on arms from abroad a year, as a share of its GDP. */
const ARMS_SHARE = 0.04;
/** A good the country does not lack can still be bought for stores, up to this share of GDP a year. */
const STOCKPILE_SHARE = 0.01;
/** Share of a deal's yearly value that moves the reserves (the rest is the ordinary flow of trade). */
const RESERVE_SHARE = 0.2;

/** Value of the world's grain harvest as a share of world output, by era. */
const GRAIN_MARKET: Record<ScenarioId, number> = { "1914": 0.05, "1939": 0.035, "1950": 0.03, "1964": 0.022, "1991": 0.012, "1999": 0.01, "2014": 0.011, "2022": 0.01 };
/** How yields and grain eaten per head grow with income. */
const YIELD = 0.3;
const APPETITE = 0.25;
/** How much a km² of each terrain can grow, before fertility. */
const FARMLAND: Record<string, number> = { plains: 1, hills: 0.55, forest: 0.25, wetlands: 0.2, jungle: 0.15, mountains: 0.08, desert: 0.02, tundra: 0 };

/** How much distance puts buyers off, by good: pipelines and coal stay near, grain and uranium go anywhere by sea. */
const REACH: Record<TradeGood, number> = { gas: 1.6, coal: 1.1, oil: 0.9, metals: 0.9, grain: 0.8, uranium: 0.3, arms: 0.3 };

/** The big arms makers of each era, the only ones that sell arms by the contract. */
const ARMOURERS: Record<ScenarioId, string[]> = {
  "1914": ["germany", "uk", "france", "usa", "austria-hungary", "russia", "italy", "japan"],
  "1939": ["usa", "uk", "germany", "france", "ussr", "italy", "japan", "czechoslovakia", "sweden"],
  "1950": ["usa", "ussr", "uk", "france", "czechoslovakia", "sweden", "belgium"],
  "1964": ["usa", "ussr", "uk", "france", "west-germany", "czechoslovakia", "china", "sweden", "italy", "belgium"],
  "1991": ["usa", "ussr", "russia", "france", "uk", "china", "germany", "italy", "israel", "czechoslovakia", "sweden"],
  "1999": ["usa", "russia", "france", "uk", "germany", "china", "israel", "italy", "sweden", "ukraine", "netherlands"],
  "2014": ["usa", "russia", "france", "china", "germany", "italy", "uk", "spain", "israel", "ukraine", "sweden", "czechia"],
  "2022": ["usa", "russia", "france", "china", "germany", "italy", "uk", "spain", "south-korea", "israel", "turkey", "poland", "sweden", "czechia"],
};

/** Prices of the day for the volumes on a contract: $ per tonne (barrel for oil, 1000 m³ for gas, kg for uranium). */
const PRICES: Record<ScenarioId, Partial<Record<TradeGood, number>>> = {
  "1914": { grain: 30, oil: 0.8, coal: 2.5, metals: 3 },
  "1939": { grain: 22, oil: 1.1, gas: 15, coal: 3.5, metals: 4 },
  "1950": { grain: 85, oil: 2.5, gas: 5, coal: 8, metals: 8, uranium: 20 },
  "1964": { grain: 65, oil: 1.8, gas: 10, coal: 9, metals: 10, uranium: 17 },
  "1991": { grain: 110, oil: 20, gas: 90, coal: 40, metals: 30, uranium: 25 },
  "1999": { grain: 110, oil: 17.5, gas: 70, coal: 30, metals: 25, uranium: 26 },
  "2014": { grain: 240, oil: 100, gas: 400, coal: 80, metals: 110, uranium: 75 },
  "2022": { grain: 330, oil: 95, gas: 600, coal: 250, metals: 120, uranium: 110 },
};

/** The unit a good's volume is counted in. */
export const UNITS: Partial<Record<TradeGood, "mt" | "mbbl" | "bcm" | "t">> = { grain: "mt", coal: "mt", metals: "mt", oil: "mbbl", gas: "bcm", uranium: "t" };

/**
 * A good's yearly volume on a contract in its unit (millions of tonnes,
 * millions of barrels, bcm, tonnes). With the world's scale a resource is
 * counted the way the resource ledger counts it, so a contract and the
 * surplus it comes from read in the same tonnes; otherwise at the day's prices.
 */
export function volumeOf(good: TradeGood, value: number, era: ScenarioId, world?: WorldScale): number | null {
  const type = good as ResourceType;
  const perPoint = world?.perPoint[type];
  const pointPrice = world?.price[type];
  let v: number;
  if (perPoint && pointPrice && (good === "oil" || good === "gas" || good === "coal" || good === "uranium")) {
    const units = (value / pointPrice) * perPoint;
    v = good === "oil" ? (units * BARRELS_PER_TONNE) / 1e6 : good === "gas" ? units / 1e9 : good === "uranium" ? units : units / 1e6;
  } else {
    const price = PRICES[era][good];
    if (!price) return null;
    const units = (value * 1e9) / price;
    v = good === "gas" ? units / 1e6 : good === "uranium" ? units / 1000 : units / 1e6;
  }
  return v >= 10 ? Math.round(v) : Math.round(v * 10) / 10;
}

export interface TradeOffer {
  id: string;
  partner: string;
  good: TradeGood;
  /** What the player does: sells to the partner, or buys from it. */
  side: "sell" | "buy";
  /** $bn a year. */
  value: number;
  /** Price against the market, %. */
  premium: number;
  years: number;
  /** The partner's surplus or lack of the good, $bn a year: why it wants the deal. */
  need: number;
}

const round = (v: number, digits = 2) => Math.round(v * 10 ** digits) / 10 ** digits;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** A steady pseudo-random number in [0, 1) for a key, so offers stay put within a turn. */
function hash(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

/** Each country's surplus (+) or lack (−) of grain, $bn a year: harvest against mouths to feed. */
export function grainBalances(state: Pick<GameState, "countries" | "regions" | "scenarioId">, map: Record<string, MapRegion>): Map<string, number> {
  const people = new Map<string, number>();
  for (const [id, r] of Object.entries(state.regions)) {
    const p = map[id];
    if (p) people.set(r.owner, (people.get(r.owner) ?? 0) + peopleIn(r, p));
  }
  // Income per head, $: richer farmers get more from a field, richer people eat (and feed their herds) more grain.
  const income = (tag: string) => {
    const n = people.get(tag) ?? 0;
    return Math.max(300, n > 0 ? ((state.countries[tag]?.economy?.gdp ?? 0) * 1e6) / n : 0);
  };
  const harvest = new Map<string, number>();
  let worldHarvest = 0;
  for (const [id, r] of Object.entries(state.regions)) {
    const p = map[id];
    if (!p) continue;
    const h = p.area * (p.fertility / 100) ** 2 * (FARMLAND[p.terrain] ?? 0.2) * income(r.controller) ** YIELD;
    harvest.set(r.controller, (harvest.get(r.controller) ?? 0) + h);
    worldHarvest += h;
  }
  const appetite = new Map<string, number>();
  let worldAppetite = 0;
  for (const [tag, n] of people) {
    const w = n * income(tag) ** APPETITE;
    appetite.set(tag, w);
    worldAppetite += w;
  }
  let worldGdp = 0;
  for (const c of Object.values(state.countries)) worldGdp += c.economy?.gdp ?? 0;
  const price = worldHarvest > 0 ? (worldGdp * GRAIN_MARKET[state.scenarioId]) / worldHarvest : 0;
  const out = new Map<string, number>();
  for (const tag of Object.keys(state.countries)) {
    const need = worldAppetite > 0 ? (worldHarvest * (appetite.get(tag) ?? 0)) / worldAppetite : 0;
    out.set(tag, round(((harvest.get(tag) ?? 0) - need) * price));
  }
  return out;
}

/** Surplus (+) or lack (−) of one good for a country, $bn a year. Arms are judged separately. */
function balanceOf(good: TradeGood, a: Accounts | undefined, grain: number): number {
  if (good === "grain") return grain;
  if (!a) return 0;
  if (good === "metals") return METALS.reduce((s, t) => s + (a.trade[t] ?? 0), 0);
  if (good === "arms") return 0;
  return a.trade[good as ResourceType] ?? 0;
}

/** Whether two governments can sign anything: not at war, not under full sanctions either way. */
function canTrade(state: Pick<GameState, "wars" | "sanctions">, a: string, b: string): boolean {
  for (const w of state.wars) {
    if (w.truce) continue;
    if ((w.attackers.includes(a) && w.defenders.includes(b)) || (w.attackers.includes(b) && w.defenders.includes(a))) return false;
  }
  return !(state.sanctions ?? []).some((s) => s.scope === "full" && ((s.by === a && s.against === b) || (s.by === b && s.against === a)));
}

/** Countries the player is at war with. */
function enemiesOf(state: Pick<GameState, "wars">, tag: string): Set<string> {
  const out = new Set<string>();
  for (const w of state.wars) {
    if (w.truce) continue;
    if (w.attackers.includes(tag)) w.defenders.forEach((t) => out.add(t));
    if (w.defenders.includes(tag)) w.attackers.forEach((t) => out.add(t));
  }
  return out;
}

const open = (d: TradeDeal) => d.status === "active" || d.status === "proposed";

/** $bn a year already under contract (in force or proposed) for a good, one way; with one partner if named. */
function committed(deals: TradeDeal[], good: TradeGood, side: "sell" | "buy", partner?: string): number {
  return deals.filter((d) => open(d) && d.good === good && d.side === side && (!partner || d.partner === partner)).reduce((s, d) => s + d.value, 0);
}

/** New contracts the player can still make this turn. */
export function dealsLeft(state: Pick<GameState, "deals" | "turn">): number {
  const made = (state.deals ?? []).filter((d) => d.turn === state.turn && ((d.status === "active" && d.origin === "offer") || (d.status === "proposed" && d.origin === "player"))).length;
  return Math.max(0, MAX_NEW_DEALS - made);
}

/**
 * How much more of a good the player can contract, $bn a year: a surplus to
 * sell or a lack to buy, less what is already under contract; arms up to a
 * share of GDP; a good it does not lack, a little for its stores.
 */
export function capacity(state: GameState, map: Record<string, MapRegion>, good: TradeGood, side: "sell" | "buy"): number {
  const gdp = state.countries[state.player]?.economy?.gdp ?? 0;
  const deals = state.deals ?? [];
  if (good === "arms") return side === "buy" ? round(Math.max(0, gdp * ARMS_SHARE - committed(deals, "arms", "buy"))) : 0;
  const balance = balanceOf(good, nationalAccounts(state, map).get(state.player), grainBalances(state, map).get(state.player) ?? 0);
  const room = side === "sell" ? Math.max(0, balance) : Math.max(-balance, gdp * STOCKPILE_SHARE);
  return round(Math.max(0, room - committed(deals, good, side)));
}

/**
 * This turn's offers to the player: buyers of its surpluses, sellers of
 * what it lacks, and arms when it fights. The same within a turn; a deal
 * signed, proposed or turned down takes its offer off the market.
 */
export function tradeOffers(state: GameState, map: Record<string, MapRegion>): TradeOffer[] {
  const player = state.player;
  const mine = state.countries[player]?.economy;
  if (!mine || !Object.values(state.regions).some((r) => r.owner === player) || !dealsLeft(state)) return [];
  const accounts = nationalAccounts(state, map);
  const grain = grainBalances(state, map);
  const at = countryCentres(state, map);
  const deals = state.deals ?? [];
  const min = MIN_TRADE[state.scenarioId];
  const taken = (partner: string, good: TradeGood, side: "sell" | "buy") =>
    deals.some((d) => d.good === good && d.side === side && (d.partner === partner || (d.status === "declined" && d.turn === state.turn && d.partner === partner)) && (open(d) || d.status === "declined"));
  // At war, the enemy and whoever shares a bloc with it are no partners.
  const enemies = enemiesOf(state, player);
  const blocs = state.alliances.filter((b) => b.members.length < 60);
  const sides = new Set(blocs.filter((b) => b.members.some((m) => enemies.has(m))).flatMap((b) => b.members));
  const partners = Object.values(state.countries).filter(
    (c) => c.tag !== player && !c.dormant && (c.economy?.gdp ?? 0) > 0 && at.has(c.tag) && canTrade(state, player, c.tag) && !enemies.has(c.tag) && !sides.has(c.tag),
  );
  const far = (tag: string) => Math.max(500, at.has(player) ? distanceKm(at.get(player)!, at.get(tag)!) : 3000);
  const offers: TradeOffer[] = [];
  const key = (side: string, good: string, tag: string) => `${state.turn}-${side}-${good}-${tag}`;

  // What is left once the contracts already made are counted, on both sides.
  const mineOf = (good: TradeGood) => {
    const b = balanceOf(good, accounts.get(player), grain.get(player) ?? 0);
    return b > 0 ? Math.max(0, b - committed(deals, good, "sell")) : Math.min(0, b + committed(deals, good, "buy"));
  };
  const theirs = (good: TradeGood, tag: string) => {
    const b = balanceOf(good, accounts.get(tag), grain.get(tag) ?? 0);
    return b < 0 ? Math.min(0, b + committed(deals, good, "sell", tag)) : Math.max(0, b - committed(deals, good, "buy", tag));
  };
  const offer = (side: "sell" | "buy", good: TradeGood, have: number) => {
    // The partner who wants it most, nearer and keener first, with a little luck of the turn.
    let best: { tag: string; score: number; need: number } | null = null;
    for (const c of partners) {
      const need = theirs(good, c.tag);
      // Too small a need for a contract worth signing.
      if (Math.abs(need) < Math.max(min, Math.abs(have) * 0.08) || (side === "sell" ? need > 0 : need < 0)) continue;
      if (taken(c.tag, good, side)) continue;
      // A partner already offering something this turn is less likely to offer again.
      const again = offers.some((o) => o.partner === c.tag) ? 0.4 : 1;
      const score = (Math.abs(need) ** 0.5 / far(c.tag) ** REACH[good]) * (0.6 + 0.8 * hash(key(side, good, c.tag))) * again;
      if (!best || score > best.score) best = { tag: c.tag, score, need };
    }
    if (!best) return;
    const value = round(Math.max(smallest(state.scenarioId), Math.min(Math.abs(have) * 0.5, Math.abs(best.need) * 0.45)), 2);
    const luck = hash(key("terms", good, best.tag));
    offers.push({
      id: `offer-${key(side, good, best.tag)}`,
      partner: best.tag,
      good,
      side,
      value,
      // A keen buyer pays over the market, a keen seller gives a discount.
      premium: Math.round((luck - 0.4) * 20) * (side === "sell" ? 1 : -1),
      years: 1 + Math.floor(luck * 3),
      need: round(best.need),
    });
  };

  const goods = TRADE_GOODS.filter((g) => g !== "arms").map((g) => ({ g, have: mineOf(g) }));
  for (const { g, have } of goods.filter((x) => x.have > min).sort((a, b) => b.have - a.have).slice(0, 4)) offer("sell", g, have);
  for (const { g, have } of goods.filter((x) => x.have < -min).sort((a, b) => a.have - b.have).slice(0, 2)) offer("buy", g, have);

  // At war: arms from the big economies that are not on the other side.
  const armsRoom = mine.gdp * ARMS_SHARE - committed(deals, "arms", "buy");
  if (enemies.size && armsRoom > min) {
    const friends = new Set(blocs.filter((b) => b.members.includes(player)).flatMap((b) => b.members));
    const sanctioners = new Set((state.sanctions ?? []).filter((s) => enemies.has(s.against)).map((s) => s.by));
    // Whoever shares a bloc with the enemy will not arm its victim; members of blocs the enemy is not in are its rivals.
    const rivals = new Set(blocs.filter((b) => (b.kind ?? "alliance") === "alliance" && !b.members.some((m) => enemies.has(m))).flatMap((b) => b.members));
    const armourers = new Set(ARMOURERS[state.scenarioId]);
    const sellers = partners
      .filter((c) => armourers.has(c.tag) && !enemies.has(c.tag) && !sides.has(c.tag) && !taken(c.tag, "arms", "buy"))
      .map((c) => ({ c, score: c.economy!.gdp * (friends.has(c.tag) || sanctioners.has(c.tag) ? 4 : rivals.has(c.tag) ? 3 : 1) * (0.6 + 0.8 * hash(key("buy", "arms", c.tag))) }))
      .sort((a, b) => b.score - a.score);
    const seller = sellers[0]?.c;
    if (seller) {
      const luck = hash(key("terms", "arms", seller.tag));
      offers.push({
        id: `offer-${key("buy", "arms", seller.tag)}`,
        partner: seller.tag,
        good: "arms",
        side: "buy",
        value: round(Math.max(smallest(state.scenarioId), Math.min(armsRoom * 0.6, seller.economy!.gdp * 0.002)), 2),
        premium: Math.round(luck * 15),
        years: 1 + Math.floor(luck * 2),
        need: 0,
      });
    }
  }
  return offers.filter((o) => o.value >= min / 2).slice(0, MAX_OFFERS);
}

/** What the player can sell or must buy, $bn a year, biggest first. */
export function tradePosition(state: GameState, map: Record<string, MapRegion>): { good: TradeGood; balance: number; contracted: number }[] {
  const a = nationalAccounts(state, map).get(state.player);
  const grain = grainBalances(state, map).get(state.player) ?? 0;
  const deals = state.deals ?? [];
  return TRADE_GOODS.filter((g) => g !== "arms")
    .map((good) => {
      const balance = round(balanceOf(good, a, grain));
      return { good, balance, contracted: round(committed(deals, good, balance >= 0 ? "sell" : "buy")) };
    })
    .filter((x) => Math.abs(x.balance) >= MIN_TRADE[state.scenarioId])
    .sort((a, b) => b.balance - a.balance);
}

function years(from: string, n: number): string {
  let d = from;
  for (let i = 0; i < n; i++) d = addStep(d, "year");
  return d;
}

/** The player signs an offer the market has now (looked up again, so a stale or repeated click does nothing): in force at once. */
export function signOffer(state: GameState, id: string, map: Record<string, MapRegion>, now = new Date()): GameState {
  const offer = tradeOffers(state, map).find((o) => o.id === id);
  if (!offer) return state;
  const deal: TradeDeal = {
    id: `deal-${state.turn}-${offer.side}-${offer.good}-${offer.partner}`,
    partner: offer.partner,
    good: offer.good,
    side: offer.side,
    value: offer.value,
    premium: offer.premium,
    years: offer.years,
    since: state.date,
    until: years(state.date, offer.years),
    status: "active",
    origin: "offer",
    turn: state.turn,
  };
  return { ...state, deals: [...(state.deals ?? []).filter((d) => d.id !== deal.id), deal], updatedAt: now.toISOString() };
}

/** The player turns an offer down; it leaves the market for this turn. */
export function declineOffer(state: GameState, offer: TradeOffer, now = new Date()): GameState {
  const deal: TradeDeal = { ...offerAsDeal(state, offer), status: "declined" };
  return { ...state, deals: [...(state.deals ?? []), deal], updatedAt: now.toISOString() };
}

const offerAsDeal = (state: GameState, o: TradeOffer): TradeDeal => ({
  id: `deal-${state.turn}-${o.side}-${o.good}-${o.partner}`,
  partner: o.partner,
  good: o.good,
  side: o.side,
  value: o.value,
  premium: o.premium,
  years: o.years,
  since: state.date,
  until: years(state.date, o.years),
  status: "proposed",
  origin: "player",
  turn: state.turn,
});

/** The player proposes a deal of its own; the other government answers next turn. */
export function proposeDeal(state: GameState, terms: Pick<TradeOffer, "partner" | "good" | "side" | "value" | "premium" | "years">, map: Record<string, MapRegion>, now = new Date()): GameState {
  const mine = state.countries[state.player]?.economy;
  if (!mine || !state.countries[terms.partner] || terms.partner === state.player || !dealsLeft(state)) return state;
  const room = capacity(state, map, terms.good, terms.side);
  if (room < 0.01) return state;
  const deal = offerAsDeal(state, {
    ...terms,
    id: "",
    need: 0,
    value: round(clamp(terms.value, 0.01, room)),
    premium: Math.round(clamp(terms.premium, -50, 50)),
    years: Math.round(clamp(terms.years, 1, 10)),
  });
  return { ...state, deals: [...(state.deals ?? []).filter((d) => d.id !== deal.id), deal], updatedAt: now.toISOString() };
}

/** The player withdraws a proposal or tears up a deal in force. */
export function cancelDeal(state: GameState, id: string, now = new Date()): GameState {
  const deals = (state.deals ?? []).flatMap((d) => (d.id !== id ? [d] : d.status === "active" ? [{ ...d, status: "ended" as const, note: "cancelled" }] : []));
  return { ...state, deals, updatedAt: now.toISOString() };
}

/** The model's answers to proposals and news of broken deals. */
export const dealsField = z
  .array(z.object({ deal: z.string().trim().min(1).max(120), status: z.enum(["accepted", "rejected", "broken"]), note: z.string().trim().max(400).default("") }))
  .max(12)
  .default([]);

/**
 * A turn for the deals: proposals answered, deals broken by the partner or
 * made impossible by war and full sanctions, deals run out, turned-down
 * offers forgotten. Every change goes into the chronicle.
 */
export function applyDeals(next: GameState, changes: z.infer<typeof dealsField>, ctx: { turn: number; to: string }, applied: AppliedChange[]): void {
  const list: TradeDeal[] = [];
  for (const d of next.deals ?? []) {
    if (d.status === "declined" || d.status === "ended" || d.status === "broken") continue;
    const answer = changes.find((c) => c.deal === d.id);
    const partnerGone = !next.countries[d.partner] || next.countries[d.partner].dormant || !next.countries[d.partner].economy;
    const record = (change: "signed" | "rejected" | "broken" | "ended", note?: string) =>
      applied.push({ kind: "deal", partner: d.partner, good: d.good, side: d.side, value: d.value, change, ...(note ? { note } : {}) });
    if (d.status === "proposed") {
      if (answer?.status === "accepted" && !partnerGone && canTrade(next, next.player, d.partner)) {
        list.push({ ...d, status: "active", since: ctx.to, until: years(ctx.to, d.years), note: answer.note || undefined });
        record("signed", answer.note);
      } else if (answer?.status === "rejected" || partnerGone || d.turn < ctx.turn) {
        // Unanswered for a whole turn counts as a refusal.
        record("rejected", answer?.note);
      } else list.push(d);
      continue;
    }
    if (partnerGone || !canTrade(next, next.player, d.partner) || answer?.status === "broken") {
      record("broken", answer?.note);
      continue;
    }
    if (d.until <= ctx.to) {
      record("ended");
      continue;
    }
    list.push(d);
  }
  next.deals = list;
  if (!list.length) delete next.deals;
}

/**
 * The money and goods of the deals in force over a turn: the seller's
 * reserves gain what the buyer's lose, and a resource bought refills the
 * buyer's stores in proportion to the lack it covers.
 */
export function settleDeals(state: Pick<GameState, "deals" | "player" | "countries" | "regions" | "scenarioId" | "date">, economies: Record<string, Economy>, span: number, map: Record<string, MapRegion> | null): void {
  const active = (state.deals ?? []).filter((d) => d.status === "active");
  if (!active.length) return;
  const accounts = map ? nationalAccounts(state, map) : null;
  for (const d of active) {
    const seller = d.side === "sell" ? state.player : d.partner;
    const buyer = d.side === "sell" ? d.partner : state.player;
    const money = d.value * (1 + d.premium / 100) * span * RESERVE_SHARE;
    if (economies[seller]) economies[seller].reserves = round(economies[seller].reserves + money);
    if (economies[buyer]) economies[buyer].reserves = round(Math.max(0, economies[buyer].reserves - money));
    const type: ResourceType | null = d.good === "metals" ? "iron" : d.good === "oil" || d.good === "gas" || d.good === "coal" || d.good === "uranium" ? d.good : null;
    const store = economies[buyer];
    const lack = accounts?.get(buyer)?.trade[type ?? "oil"] ?? 0;
    if (type && store && lack < 0) store.stocks[type] = round(clamp((store.stocks[type] ?? 3) + (d.value / -lack) * span * 12, 0, 12), 1);
  }
}

/** The deals and proposals for the game master. */
export function describeDeals(state: GameState, world?: WorldScale): string[] {
  const deals = (state.deals ?? []).filter(open);
  if (!deals.length) return [];
  const line = (d: TradeDeal) => {
    const volume = volumeOf(d.good, d.value, state.scenarioId, world);
    const unit = UNITS[d.good];
    const amount = volume !== null && unit ? ` (about ${volume} ${{ mt: "million tonnes", mbbl: "million barrels", bcm: "bcm", t: "tonnes" }[unit]} a year)` : "";
    return `- ${d.id} | ${d.side === "sell" ? "sells" : "buys"} ${d.good}${amount} | ${d.side === "sell" ? "to" : "from"} ${d.partner} | $${d.value}bn a year | price ${d.premium >= 0 ? "+" : ""}${d.premium}% to the market | ${d.years} years${d.status === "active" ? ` | until ${d.until}` : ""}`;
  };
  const active = deals.filter((d) => d.status === "active");
  const proposed = deals.filter((d) => d.status === "proposed");
  return [
    ...(active.length ? ["", "PLAYER'S TRADE DEALS IN FORCE (id | what | partner | value | price | term):", ...active.map(line)] : []),
    ...(proposed.length ? ["", "PLAYER'S TRADE PROPOSALS awaiting the partner's answer this turn:", ...proposed.map(line)] : []),
  ];
}

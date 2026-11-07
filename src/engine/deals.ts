import { z } from "zod";
import { addStep } from "./calendar";
import { roll } from "./dice";
import { type Accounts, nationalAccounts, type WorldScale } from "./economy";
import { BARRELS_PER_TONNE } from "./units";
import { countryName } from "./names";
import { countsFor } from "./occupation";
import { peopleIn } from "./population";
import { addTension, allied, remember, tieOf } from "./relations";
import type { ResourceType } from "./resources";
import { same } from "./text";
import { countryCentres, distanceKm } from "./trade";
import type { AppliedChange, DealBreach, DealCondition, DealTerms, Economy, GameState, Localized, MapRegion, ScenarioId, TradeDeal, TradeGood } from "./types";

/**
 * Trade deals: contracts of the player's government with another to sell or
 * buy a good for a few years at an agreed price. Each turn the market offers
 * some — buyers short of what the country has in surplus (grain from its
 * fields, oil, coal, metals from its mines), sellers of what it lacks, arms
 * dealers when it is at war — which the player signs, turns down, or
 * bargains over; the player can also propose a deal of its own or reopen one
 * in force (the talks and the other side's answers: engine/negotiation.ts).
 * A signed deal brings or costs hard currency every turn (or adds to what
 * the buyer owes, on credit, or is paid in goods), refills the stores of a
 * resource bought and shows in the trade books. Deliveries fall short under
 * a blockade, sanctions or a shortage at the seller's, and a deal cut below
 * most of its volume two turns running breaks. A deal binds both sides: its
 * partner's trust grows while it runs, and tearing it up costs it. The game
 * master hears of all of it.
 */

export const TRADE_GOODS = ["grain", "oil", "gas", "coal", "metals", "uranium", "arms"] as const;

const METALS: ResourceType[] = ["iron", "copper", "nickel", "tin", "bauxite"];

/** Below this, $bn a year, a surplus or a lack is not worth a contract: less in the far smaller economies of the world wars. */
export const MIN_TRADE: Record<ScenarioId, number> = { "1914": 0.02, "1933": 0.025, "1939": 0.03, "1950": 0.03, "1957": 0.035, "1964": 0.04, "1973": 0.05, "1979": 0.06, "1991": 0.08, "1999": 0.08, "2014": 0.08, "2022": 0.08 };
/** The smallest contract offered, $bn a year. */
export const smallest = (era: ScenarioId) => Math.max(0.01, round(MIN_TRADE[era] * 0.6));
/** Offers on the market each turn. */
const MAX_OFFERS = 6;
/** New contracts a government can negotiate in one turn: signed offers, talks and its own proposals together. */
export const MAX_NEW_DEALS = 3;
/** Most a country spends on arms from abroad a year, as a share of its GDP. */
export const ARMS_SHARE = 0.04;
/** Most of its GDP an arms maker sells by contract a year. */
export const ARMS_SALES = 0.004;
/** A good the country does not lack can still be bought for stores, up to this share of GDP a year. */
export const STOCKPILE_SHARE = 0.01;
/** Delivered below this share of the volume, a deal is cut short; two turns running and it breaks. */
const STRAIN = 0.6;
/** A shortfall this small the stores cover. */
const SLACK = 0.9;
/** Share of a deal's yearly value that moves the reserves (the rest is the ordinary flow of trade). */
const RESERVE_SHARE = 0.2;

/** Value of the world's grain harvest as a share of world output, by era. */
const GRAIN_MARKET: Record<ScenarioId, number> = { "1914": 0.05, "1933": 0.04, "1939": 0.035, "1950": 0.03, "1957": 0.026, "1964": 0.022, "1973": 0.02, "1979": 0.017, "1991": 0.012, "1999": 0.01, "2014": 0.011, "2022": 0.01 };
/** How yields and grain eaten per head grow with income. */
const YIELD = 0.3;
const APPETITE = 0.25;
/** How much a km² of each terrain can grow, before fertility. */
const FARMLAND: Record<string, number> = { plains: 1, hills: 0.55, forest: 0.25, wetlands: 0.2, jungle: 0.15, mountains: 0.08, desert: 0.02, tundra: 0 };

/** How much distance puts buyers off, by good: pipelines and coal stay near, grain and uranium go anywhere by sea. */
export const REACH: Record<TradeGood, number> = { gas: 1.6, coal: 1.1, oil: 0.9, metals: 0.9, grain: 0.8, uranium: 0.3, arms: 0.3 };

/** The big arms makers of each era, the only ones that sell arms by the contract. */
export const ARMOURERS: Record<ScenarioId, string[]> = {
  "1914": ["germany", "uk", "france", "usa", "austria-hungary", "russia", "italy", "japan"],
  // Germany's armourers were barred by Versailles and sold through Dutch and Swedish fronts.
  "1933": ["uk", "france", "usa", "czechoslovakia", "italy", "sweden", "belgium", "japan", "ussr"],
  "1939": ["usa", "uk", "germany", "france", "ussr", "italy", "japan", "czechoslovakia", "sweden"],
  "1950": ["usa", "ussr", "uk", "france", "czechoslovakia", "sweden", "belgium"],
  "1957": ["usa", "ussr", "uk", "france", "czechoslovakia", "sweden", "belgium", "italy"],
  "1964": ["usa", "ussr", "uk", "france", "west-germany", "czechoslovakia", "china", "sweden", "italy", "belgium"],
  "1973": ["usa", "ussr", "france", "uk", "west-germany", "czechoslovakia", "china", "italy", "sweden", "israel", "belgium"],
  "1979": ["usa", "ussr", "france", "uk", "west-germany", "czechoslovakia", "china", "italy", "israel", "sweden", "brazil"],
  "1991": ["usa", "ussr", "russia", "france", "uk", "china", "germany", "italy", "israel", "czechoslovakia", "sweden"],
  "1999": ["usa", "russia", "france", "uk", "germany", "china", "israel", "italy", "sweden", "ukraine", "netherlands"],
  "2014": ["usa", "russia", "france", "china", "germany", "italy", "uk", "spain", "israel", "ukraine", "sweden", "czechia"],
  "2022": ["usa", "russia", "france", "china", "germany", "italy", "uk", "spain", "south-korea", "israel", "turkey", "poland", "sweden", "czechia"],
};

/** Prices of the day for the volumes on a contract: $ per tonne (barrel for oil, 1000 m³ for gas, kg for uranium). */
const PRICES: Record<ScenarioId, Partial<Record<TradeGood, number>>> = {
  "1914": { grain: 30, oil: 0.8, coal: 2.5, metals: 3 },
  // Wheat and copper at the Depression's lowest, oil at under a dollar.
  "1933": { grain: 18, oil: 0.9, gas: 12, coal: 3, metals: 3 },
  "1939": { grain: 22, oil: 1.1, gas: 15, coal: 3.5, metals: 4 },
  "1950": { grain: 85, oil: 2.5, gas: 5, coal: 8, metals: 8, uranium: 20 },
  "1957": { grain: 75, oil: 2.1, gas: 7, coal: 9, metals: 9, uranium: 19 },
  "1964": { grain: 65, oil: 1.8, gas: 10, coal: 9, metals: 10, uranium: 17 },
  // October 1973: the posted price is raised from $3 to $5.12 on the 16th; wheat dear after the Soviet purchases of 1972.
  "1973": { grain: 160, oil: 3.5, gas: 25, coal: 12, metals: 18, uranium: 18 },
  // December 1979: oil above thirty dollars after Iran's revolution, uranium near its peak.
  "1979": { grain: 160, oil: 30, gas: 80, coal: 35, metals: 30, uranium: 110 },
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

export const round = (v: number, digits = 2) => Math.round(v * 10 ** digits) / 10 ** digits;
export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** A steady pseudo-random number in [0, 1) for a key, so offers stay put within a turn. */
function hash(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

/** A country's grain: what its land grows and what its people eat, in the same units, and the world price of a unit in $bn. */
export interface GrainBook {
  harvest: number;
  need: number;
  price: number;
}

/** Each country's surplus (+) or lack (−) of grain, $bn a year: harvest against mouths to feed. */
export function grainBalances(state: Pick<GameState, "countries" | "regions" | "scenarioId">, map: Record<string, MapRegion>): Map<string, number> {
  const out = new Map<string, number>();
  for (const [tag, g] of grainBooks(state, map)) out.set(tag, round((g.harvest - g.need) * g.price));
  return out;
}

/**
 * Every country's harvest and the grain its people eat. A province grows by
 * its area, fertility and terrain, more where farmers are richer, for
 * whoever holds it; people eat by their number, more where they are richer.
 * The world eats what it grows.
 */
export function grainBooks(state: Pick<GameState, "countries" | "regions" | "scenarioId">, map: Record<string, MapRegion>): Map<string, GrainBook> {
  const people = new Map<string, number>();
  for (const [id, r] of Object.entries(state.regions)) {
    const p = map[id];
    const by = countsFor(r);
    if (p) people.set(by, (people.get(by) ?? 0) + peopleIn(r, p));
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
  const out = new Map<string, GrainBook>();
  for (const tag of Object.keys(state.countries)) {
    const need = worldAppetite > 0 ? (worldHarvest * (appetite.get(tag) ?? 0)) / worldAppetite : 0;
    out.set(tag, { harvest: harvest.get(tag) ?? 0, need, price });
  }
  return out;
}

/** Surplus (+) or lack (−) of one good for a country, $bn a year. Arms are judged separately. */
export function balanceOf(good: TradeGood, a: Accounts | undefined, grain: number): number {
  if (good === "grain") return grain;
  if (!a) return 0;
  if (good === "metals") return METALS.reduce((s, t) => s + (a.trade[t] ?? 0), 0);
  if (good === "arms") return 0;
  return a.trade[good as ResourceType] ?? 0;
}

/** Whether two governments can sign anything: not at war, not under full sanctions either way. */
export function canTrade(state: Pick<GameState, "wars" | "sanctions">, a: string, b: string): boolean {
  for (const w of state.wars) {
    if (w.truce) continue;
    if ((w.attackers.includes(a) && w.defenders.includes(b)) || (w.attackers.includes(b) && w.defenders.includes(a))) return false;
  }
  return !(state.sanctions ?? []).some((s) => s.scope === "full" && ((s.by === a && s.against === b) || (s.by === b && s.against === a)));
}

/** Countries a country fights, truces aside. */
export function foesOf(state: Pick<GameState, "wars">, tag: string): Set<string> {
  const out = new Set<string>();
  for (const w of state.wars) {
    if (w.truce) continue;
    if (w.attackers.includes(tag)) w.defenders.forEach((t) => out.add(t));
    if (w.defenders.includes(tag)) w.attackers.forEach((t) => out.add(t));
  }
  return out;
}
const enemiesOf = foesOf;

export const open = (d: TradeDeal) => d.status === "active" || d.status === "proposed";

/** $bn a year already under contract (in force or on the table) for a good, one way; with one partner if named; one deal left out. */
export function committed(deals: TradeDeal[], good: TradeGood, side: "sell" | "buy", partner?: string, except?: string): number {
  return deals.filter((d) => open(d) && d.id !== except && d.good === good && d.side === side && (!partner || d.partner === partner)).reduce((s, d) => s + d.value, 0);
}

/** New contracts the player can still make this turn: deals signed this turn and talks under way count alike. */
export function dealsLeft(state: Pick<GameState, "deals" | "turn">): number {
  const made = (state.deals ?? []).filter((d) => d.turn === state.turn && open(d)).length;
  return Math.max(0, MAX_NEW_DEALS - made);
}

/** A deal in force by which the player sells or buys a good from one partner alone. */
export function exclusiveWith(state: Pick<GameState, "deals">, good: TradeGood, side: "sell" | "buy"): string | undefined {
  return (state.deals ?? []).find((d) => d.status === "active" && d.good === good && d.side === side && d.conditions?.some((c) => c.kind === "exclusivity" && c.by === "player"))?.partner;
}

/** The books a deal is judged by, worked out once: every country's accounts and grain. */
export interface TradeBooksNow {
  accounts: Map<string, Accounts>;
  grain: Map<string, number>;
}

export function booksNow(state: GameState, map: Record<string, MapRegion>): TradeBooksNow {
  return { accounts: nationalAccounts(state, map), grain: grainBalances(state, map) };
}

/** Whether the player's government makes arms to sell by contract. */
export const makesArms = (state: Pick<GameState, "scenarioId">, tag: string) => ARMOURERS[state.scenarioId].includes(tag);

/**
 * How much more of a good the player can contract, $bn a year: a surplus to
 * sell or a lack to buy, less what is already under contract (but the deal
 * named, when its own terms are being changed); arms up to a share of GDP,
 * and sold only by an arms maker; a good it does not lack, a little for its
 * stores. Nothing to anyone else of a good the player has promised one
 * partner alone.
 */
export function capacity(state: GameState, map: Record<string, MapRegion> | null, good: TradeGood, side: "sell" | "buy", books?: TradeBooksNow, except?: string): number {
  const gdp = state.countries[state.player]?.economy?.gdp ?? 0;
  const deals = state.deals ?? [];
  const exclusive = exclusiveWith(state, good, side);
  if (exclusive && exclusive !== deals.find((d) => d.id === except)?.partner) return 0;
  if (good === "arms") return side === "buy" ? round(Math.max(0, gdp * ARMS_SHARE - committed(deals, "arms", "buy", undefined, except))) : makesArms(state, state.player) ? round(Math.max(0, gdp * ARMS_SALES - committed(deals, "arms", "sell", undefined, except))) : 0;
  const b = books ?? (map ? booksNow(state, map) : null);
  if (!b) return 0;
  const balance = balanceOf(good, b.accounts.get(state.player), b.grain.get(state.player) ?? 0);
  const room = side === "sell" ? Math.max(0, balance) : Math.max(-balance, gdp * STOCKPILE_SHARE);
  return round(Math.max(0, room - committed(deals, good, side, undefined, except)));
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
    // A good promised to one partner alone is offered to no one else.
    if (exclusiveWith(state, good, side)) return;
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

/** A date some whole years on. */
export function yearsFrom(from: string, n: number): string {
  let d = from;
  for (let i = 0; i < n; i++) d = addStep(d, "year");
  return d;
}
const years = yearsFrom;

/** The terms alone of a deal or an offer, money and no conditions left out. */
export function termsOf(t: DealTerms): DealTerms {
  return {
    value: t.value,
    premium: t.premium,
    years: t.years,
    ...(t.pay && t.pay !== "money" ? { pay: t.pay } : {}),
    ...(t.pay === "goods" && t.payGood ? { payGood: t.payGood } : {}),
    ...(t.conditions?.length ? { conditions: t.conditions.map((c) => ({ kind: c.kind, by: c.by })) } : {}),
  };
}

/** A deal put on the table this turn, with the terms given. */
export function tableDeal(state: Pick<GameState, "turn" | "date">, o: Pick<TradeOffer, "partner" | "good" | "side"> & DealTerms, origin: TradeDeal["origin"]): TradeDeal {
  return {
    id: `deal-${state.turn}-${o.side}-${o.good}-${o.partner}`,
    partner: o.partner,
    good: o.good,
    side: o.side,
    ...termsOf(o),
    since: state.date,
    until: years(state.date, o.years),
    status: "proposed",
    origin,
    turn: state.turn,
  };
}

/** The player signs an offer the market has now (looked up again, so a stale or repeated click does nothing): in force at once. */
export function signOffer(state: GameState, id: string, map: Record<string, MapRegion>, now = new Date()): GameState {
  const offer = tradeOffers(state, map).find((o) => o.id === id);
  if (!offer) return state;
  const deal: TradeDeal = { ...tableDeal(state, offer, "offer"), status: "active" };
  return { ...state, deals: [...(state.deals ?? []).filter((d) => d.id !== deal.id), deal], updatedAt: now.toISOString() };
}

/** The player turns an offer down; it leaves the market for this turn. */
export function declineOffer(state: GameState, offer: TradeOffer, now = new Date()): GameState {
  const deal: TradeDeal = { ...tableDeal(state, offer, "player"), status: "declined" };
  return { ...state, deals: [...(state.deals ?? []), deal], updatedAt: now.toISOString() };
}

/**
 * A proposal of the player's put on the table as it stands, cut to what the
 * country can deliver, with no answer yet. The talks (engine/negotiation.ts)
 * answer at once; a proposal left like this (a save from before the talks)
 * gets the engine's answer when the turn is played.
 */
export function proposeDeal(state: GameState, terms: Pick<TradeOffer, "partner" | "good" | "side"> & DealTerms, map: Record<string, MapRegion>, now = new Date()): GameState {
  const mine = state.countries[state.player]?.economy;
  if (!mine || !state.countries[terms.partner] || terms.partner === state.player || !dealsLeft(state)) return state;
  const room = capacity(state, map, terms.good, terms.side);
  if (room < 0.01) return state;
  const deal = tableDeal(
    state,
    {
      ...terms,
      value: round(clamp(terms.value, 0.01, room)),
      premium: Math.round(clamp(terms.premium, -50, 50)),
      years: Math.round(clamp(terms.years, 1, 10)),
    },
    "player",
  );
  return { ...state, deals: [...(state.deals ?? []).filter((d) => d.id !== deal.id), deal], updatedAt: now.toISOString() };
}

/** The player withdraws a proposal or tears up a deal in force: the partner remembers it when the turn is played. */
export function cancelDeal(state: GameState, id: string, now = new Date()): GameState {
  const deals = (state.deals ?? []).flatMap((d) => {
    if (d.id !== id) return [d];
    if (d.status !== "active") return [];
    const ended: TradeDeal = { ...d, status: "ended", note: "cancelled" };
    delete ended.talking;
    return [ended];
  });
  return { ...state, deals, updatedAt: now.toISOString() };
}

/** The model's notes on the turn's deals and news of broken ones; its verdicts on proposals count only for a save from before the talks played without the map. */
export const dealsField = z
  .array(z.object({ deal: z.string().trim().min(1).max(120), status: z.enum(["accepted", "rejected", "broken"]), note: z.string().trim().max(400).default("") }))
  .max(12)
  .default([]);

/**
 * How much a deal binds its two sides, 0–100: what it is worth against the
 * partner's economy, for how long, and the political terms it carries. A
 * long gas contract with a small neighbour binds it closely; a year of grain
 * sold to a great power hardly at all.
 */
export function bindingOf(state: Pick<GameState, "countries">, d: Pick<TradeDeal, "partner" | "value" | "years" | "conditions">): number {
  const gdp = Math.max(0.01, state.countries[d.partner]?.economy?.gdp ?? 0);
  const political = (d.conditions ?? []).filter((c) => c.kind !== "exclusivity" && c.kind !== "technology").length;
  return Math.round(clamp((d.value / gdp) * 1500 * clamp(d.years / 5, 0.4, 1.6) + 8 * political, 0, 100));
}

/** The offers the player made in a deal's talks. */
export const playerRounds = (d: Pick<TradeDeal, "rounds">) => (d.rounds ?? []).filter((r) => r.by === "player").length;

/** Whether a partner the game master says broke a deal had a cause the engine sees: deliveries cut, sanctions between them, distrust, a new government, or the land that made the good lost. */
function causeToBreak(next: GameState, d: TradeDeal, books: TradeBooksNow | null): boolean {
  if (d.strain) return true;
  const player = next.player;
  if ((next.sanctions ?? []).some((s) => (s.by === d.partner && s.against === player) || (s.by === player && s.against === d.partner))) return true;
  if (tieOf(next, d.partner, player).trust <= -20) return true;
  const course = next.countries[d.partner]?.course;
  if (course && course.set.how !== "start" && course.set.date > d.since) return true;
  // A partner that sells and has lost what it sold from.
  if (books && d.side === "buy" && d.good !== "arms") {
    const left = balanceOf(d.good, books.accounts.get(d.partner), books.grain.get(d.partner) ?? 0);
    if (left < STRAIN * committed(next.deals ?? [], d.good, "buy", d.partner)) return true;
  }
  return false;
}

/** The name of a treaty of mutual assistance a deal's terms found. */
function treatyName(state: GameState, a: string, b: string): Localized {
  const names = (tag: string): Localized => {
    const n = state.countries[tag]?.name;
    if (n && typeof n !== "string") return n;
    return countryName(tag) ?? same(n ?? tag);
  };
  const x = names(a);
  const y = names(b);
  return { en: `${x.en}–${y.en} Treaty of Mutual Assistance`, ru: `${x.ru} – ${y.ru}: договор о взаимной помощи`, uk: `${x.uk} – ${y.uk}: договір про взаємну допомогу` };
}

/** A deal that ends takes the alliance its terms founded with it. */
function endAlliance(next: GameState, d: TradeDeal, applied: AppliedChange[]): void {
  if (!d.alliance) return;
  const a = next.alliances.find((x) => x.id === d.alliance);
  if (!a) return;
  next.alliances = next.alliances.filter((x) => x !== a);
  applied.push({ kind: "alliance-ended", alliance: a.id, name: a.name, members: [...a.members] });
}

/** What a buyer on credit owes is paid to the seller when the deal ends, or written off when the buyer goes to war with it. */
function settleOwed(next: GameState, d: TradeDeal, repudiated: boolean): void {
  if (!d.owed) return;
  const seller = d.side === "sell" ? next.player : d.partner;
  const buyer = d.side === "sell" ? d.partner : next.player;
  const s = next.countries[seller]?.economy;
  const b = next.countries[buyer]?.economy;
  if (repudiated) {
    if (b) b.debt = round(Math.max(0, b.debt - d.owed));
  } else if (s) s.reserves = round(s.reserves + d.owed);
}

/**
 * A turn for the deals: the talks of the turn told (signed, refused, lapsed,
 * renegotiated), the terms of a deal just signed put in force (a treaty of
 * mutual assistance among them), deals torn up by the player remembered by
 * the partner, deals made impossible by war and full sanctions broken,
 * deals the game master says the partner broke broken if the engine sees a
 * cause, deals run out and their credit repaid. Every change goes into the
 * chronicle. A proposal from before the talks (an old save) that the engine
 * could not answer takes the model's verdict, as it used to.
 */
export function applyDeals(next: GameState, changes: z.infer<typeof dealsField>, ctx: { turn: number; to: string; from?: string; books?: TradeBooksNow | null }, applied: AppliedChange[]): void {
  const list: TradeDeal[] = [];
  const player = next.player;
  for (const d of next.deals ?? []) {
    const answer = changes.find((c) => c.deal === d.id);
    const note = answer?.note || undefined;
    const talked = (d.rounds ?? []).some((r) => r.turn === ctx.turn);
    const rounds = playerRounds(d);
    const record = (change: Extract<AppliedChange, { kind: "deal" }>["change"], extra: Partial<Extract<AppliedChange, { kind: "deal" }>> = {}) =>
      applied.push({ kind: "deal", partner: d.partner, good: d.good, side: d.side, value: d.value, change, ...(note ? { note } : {}), ...extra });
    if (d.status === "broken") continue;
    if (d.status === "ended") {
      if (d.note === "cancelled") {
        record("cancelled");
        remember(next, d.partner, player, "broke-deal", -(5 + bindingOf(next, d) / 3), ctx.to);
        settleOwed(next, d, false);
        endAlliance(next, d, applied);
      }
      continue;
    }
    if (d.status === "declined") {
      // Talks the partner ended are news; an offer passed over, or talks the player left, are not.
      const last = d.rounds?.at(-1);
      if (talked && last?.by === "player" && last.answer === "refused") record("rejected", { reason: last.reason, rounds });
      continue;
    }
    const partnerGone = !next.countries[d.partner] || next.countries[d.partner].dormant || !next.countries[d.partner].economy;
    if (d.status === "proposed") {
      if (d.rounds?.length) {
        // The partner's counter left unanswered lapses with the turn.
        record("lapsed", { rounds });
        continue;
      }
      // A proposal from before the talks: the model's verdict, as it used to be.
      if (answer?.status === "accepted" && !partnerGone && canTrade(next, player, d.partner)) {
        list.push({ ...d, status: "active", since: ctx.to, until: years(ctx.to, d.years), note });
        record("signed");
      } else if (answer?.status === "rejected" || partnerGone || d.turn < ctx.turn) record("rejected");
      else list.push(d);
      continue;
    }
    const war = Boolean(next.wars.some((w) => !w.truce && ((w.attackers.includes(player) && w.defenders.includes(d.partner)) || (w.attackers.includes(d.partner) && w.defenders.includes(player)))));
    if (partnerGone || !canTrade(next, player, d.partner)) {
      record("broken", { by: "partner", ...(war ? { cause: "war" as const } : partnerGone ? {} : { cause: "sanctions" as const }) });
      settleOwed(next, d, war);
      endAlliance(next, d, applied);
      continue;
    }
    if (answer?.status === "broken" && causeToBreak(next, d, ctx.books ?? null)) {
      record("broken", { by: "partner", ...(d.strain ? { cause: d.strain.cause } : {}) });
      settleOwed(next, d, false);
      endAlliance(next, d, applied);
      continue;
    }
    const fresh = ctx.from !== undefined ? d.since === ctx.from : d.turn === ctx.turn;
    const kept: TradeDeal = { ...d };
    delete kept.talking;
    if (fresh) {
      record("signed", rounds ? { rounds } : {});
      // A deal signed brings the governments closer, the more for the political terms it carries; a treaty of mutual assistance among them is founded.
      const political = (d.conditions ?? []).filter((c) => c.kind !== "exclusivity" && c.kind !== "technology").length;
      remember(next, d.partner, player, "aided", 2 + 3 * political, ctx.to, false);
      if (d.conditions?.some((c) => c.kind === "alliance") && !allied(next, player, d.partner)) {
        const id = `a${ctx.turn}-t-${d.partner}`;
        const name = treatyName(next, player, d.partner);
        next.alliances.push({ id, name, members: [player, d.partner], since: ctx.to, kind: "alliance", until: d.until, founder: player });
        applied.push({ kind: "alliance", alliance: id, name, members: [player, d.partner] });
        kept.alliance = id;
      }
    } else if (talked && d.rounds?.at(-1)?.answer === "accepted") record("renegotiated", { rounds });
    if (d.until <= ctx.to) {
      record("ended");
      settleOwed(next, d, false);
      endAlliance(next, kept, applied);
      continue;
    }
    list.push(kept);
  }
  next.deals = list;
  if (!list.length) delete next.deals;
}

/** What the turn's deliveries depend on beyond the books: blockades, the land routes, and where to tell what went short. */
export interface DealSettling {
  /** Share of each country's trade by sea that blockade and raiders cut this period (engine/forces.ts seaCuts). */
  blockade?: Map<string, number>;
  /** Whether two countries trade overland, out of a blockade's reach. */
  overland?: (a: string, b: string) => boolean;
  /** The turn's chronicle: deliveries cut short and deals broken go into it. Without it nothing is recorded or broken. */
  applied?: AppliedChange[];
  seed?: string;
  turn?: number;
  to?: string;
}

/** The share of a deal delivered over the turn, and what held it back most: a blockade of either side's sea trade, sanctions between them, the player's shortage of what it sells. */
export function deliveryOf(
  state: Pick<GameState, "player" | "sanctions">,
  d: TradeDeal,
  ctx: { blockade?: Map<string, number>; overland?: (a: string, b: string) => boolean; shortage?: (seller: string, good: TradeGood) => number },
): { share: number; cause?: DealBreach; by?: "player" | "partner" } {
  const seller = d.side === "sell" ? state.player : d.partner;
  const buyer = d.side === "sell" ? d.partner : state.player;
  const side = (tag: string): "player" | "partner" => (tag === state.player ? "player" : "partner");
  let share = 1;
  let worst = 1;
  let cause: DealBreach | undefined;
  let by: "player" | "partner" | undefined;
  const cut = (factor: number, why: DealBreach, who: string) => {
    if (factor >= 0.999) return;
    share *= factor;
    if (factor < worst) {
      worst = factor;
      cause = why;
      by = side(who);
    }
  };
  if (ctx.blockade && !ctx.overland?.(seller, buyer)) {
    const s = ctx.blockade.get(seller) ?? 0;
    const b = ctx.blockade.get(buyer) ?? 0;
    cut(1 - Math.max(s, b), "blockade", s >= b ? seller : buyer);
  }
  const sanction = (state.sanctions ?? []).find((s) => s.scope !== "full" && ((s.by === seller && s.against === buyer) || (s.by === buyer && s.against === seller)));
  if (sanction) cut(0.5, "sanctions", sanction.by);
  if (ctx.shortage && seller === state.player && d.good !== "arms") cut(ctx.shortage(seller, d.good), "shortage", seller);
  return { share: round(share, 3), ...(cause ? { cause, by } : {}) };
}

/**
 * The money and goods of the deals in force over a turn: the seller's
 * reserves gain what the buyer's lose (on credit the buyer owes it instead,
 * paid when the deal ends; paid in goods, no money moves and the goods
 * refill the seller's stores), a resource bought refills the buyer's
 * stores in proportion to the lack it covers – all of it as far as the
 * goods got through. A strategic resource the national accounts already
 * trade (economy.ts nationalAccounts: the seller's surplus is exported and
 * paid for there, the buyer's lack imported and paid for there) is not paid
 * for twice: within those flows a deal moves only its premium, and the full
 * price only for the volume beyond them (`counted`); grain and arms are
 * outside the accounts and paid in full. A deal delivered below most of its
 * volume is cut short; two turns running, it breaks, and a partner the
 * player failed remembers it. A deal in force draws its partner closer.
 */
export function settleDeals(state: GameState, economies: Record<string, Economy>, span: number, map: Record<string, MapRegion> | null, ctx: DealSettling = {}): void {
  const active = (state.deals ?? []).filter((d) => d.status === "active");
  if (!active.length) return;
  const accounts = map ? nationalAccounts(state, map) : null;
  const grain = map && active.some((d) => d.good === "grain" && d.side === "sell") ? grainBalances(state, map) : null;
  // What the player has to deliver of each good it sells, against what it has.
  const sold = new Map<TradeGood, number>();
  for (const d of active) if (d.side === "sell") sold.set(d.good, (sold.get(d.good) ?? 0) + d.value);
  const shortage = accounts
    ? (seller: string, good: TradeGood) => {
        const total = sold.get(good) ?? 0;
        const have = balanceOf(good, accounts.get(seller), grain?.get(seller) ?? 0);
        return total > 0 && have < total * SLACK ? clamp(Math.max(0, have) / total, 0, 1) : 1;
      }
    : undefined;
  // What the player buys of each good, against its lack.
  const bought = new Map<TradeGood, number>();
  for (const d of active) if (d.side === "buy") bought.set(d.good, (bought.get(d.good) ?? 0) + d.value);
  /** Of a deal's volume, the share the accounts already trade for one side: within its surplus (selling) or its lack (buying). */
  const counted = (tag: string, d: TradeDeal, selling: boolean): number => {
    if (!accounts || d.good === "grain" || d.good === "arms") return 0;
    const flow = balanceOf(d.good, accounts.get(tag), 0) * (selling ? 1 : -1);
    const total = tag === state.player ? ((selling ? sold : bought).get(d.good) ?? d.value) : d.value;
    return total > 0 ? clamp(flow / total, 0, 1) : 0;
  };
  let broke = false;
  for (const d of active) {
    const seller = d.side === "sell" ? state.player : d.partner;
    const buyer = d.side === "sell" ? d.partner : state.player;
    const got = deliveryOf(state, d, { blockade: ctx.blockade, overland: ctx.overland, shortage });
    const base = d.value * span * RESERVE_SHARE * got.share;
    const premium = d.premium / 100;
    const earned = base * (premium + 1 - counted(seller, d, true));
    const owes = base * (premium + 1 - counted(buyer, d, false));
    const pay = d.pay ?? "money";
    if (pay === "money") {
      if (economies[seller]) economies[seller].reserves = round(Math.max(0, economies[seller].reserves + earned));
      // A buyer pays from its reserves and borrows what they cannot cover.
      const payer = economies[buyer];
      if (payer && owes > 0) {
        const paid = Math.min(payer.reserves, owes);
        payer.reserves = round(payer.reserves - paid);
        payer.debt = round(payer.debt + (owes - paid));
      } else if (payer) payer.reserves = round(payer.reserves - owes);
    } else if (pay === "credit") {
      // On credit the buyer owes it and the seller is paid when the deal has run: one sum for both, so the claim and the debt move together.
      if (economies[buyer]) economies[buyer].debt = round(Math.max(0, economies[buyer].debt + owes));
      if (ctx.applied) d.owed = round(Math.max(0, (d.owed ?? 0) + owes), 3);
    } else if (d.payGood) refill(economies[seller], accounts?.get(seller), d.payGood, Math.max(0, earned) / RESERVE_SHARE / Math.max(span, 1e-6), span);
    refill(economies[buyer], accounts?.get(buyer), d.good, d.value * got.share, span);

    if (!ctx.applied) continue;
    const record = (change: "strained" | "broken", extra: Partial<Extract<AppliedChange, { kind: "deal" }>>) =>
      ctx.applied!.push({ kind: "deal", partner: d.partner, good: d.good, side: d.side, value: d.value, change, ...extra });
    if (got.share >= 0.98 || !got.cause) delete d.strain;
    else {
      const low = got.share < STRAIN;
      const turns = low ? (d.strain?.turns ?? 0) + 1 : 0;
      const before = d.strain;
      d.strain = { cause: got.cause, by: got.by!, share: round(got.share), turns };
      if (low && turns >= 2) {
        // Cut short two turns running: the deal breaks. A partner the player failed by its own shortage remembers it.
        d.status = "broken";
        d.note = got.cause;
        broke = true;
        record("broken", { cause: got.cause, by: got.by, share: round(got.share) });
        if (got.by === "player" && got.cause === "shortage") remember(state, d.partner, state.player, "broke-deal", -(3 + bindingOf(state, d) / 5), ctx.to ?? state.date);
        settleOwed(state, d, false);
        endAlliance(state, d, ctx.applied);
        continue;
      }
      if (!before || before.cause !== got.cause || (low && !before.turns)) record("strained", { cause: got.cause, by: got.by, share: round(got.share) });
    }
    // A deal in force draws the partner closer, by how much it binds it.
    if (ctx.seed !== undefined && ctx.turn !== undefined && roll(ctx.seed, ctx.turn, `bind:${d.id}`) < (bindingOf(state, d) / 100) * 6 * span * got.share) {
      remember(state, d.partner, state.player, "aided", 1, ctx.to ?? state.date, false);
      addTension(state, d.partner, state.player, -1);
    }
  }
  if (broke) {
    state.deals = (state.deals ?? []).filter((d) => d.status !== "broken");
    if (!state.deals.length) delete state.deals;
  }
}

/** A resource bought refills the buyer's stores in proportion to the lack it covers: metals every metal, each by its lack. */
function refill(store: Economy | undefined, a: Accounts | undefined, good: TradeGood, value: number, span: number): void {
  const types: ResourceType[] = good === "metals" ? METALS : good === "oil" || good === "gas" || good === "coal" || good === "uranium" ? [good] : [];
  // The lack at the day's price, unrounded: bauxite's is worth less than a cent of a billion, and still empties a store.
  const short = (t: ResourceType) => Math.max(0, (a?.need[t] ?? 0) - (a?.production[t] ?? 0)) * (a?.world?.price[t] ?? 0);
  const lacking = types.filter((t) => short(t) > 0);
  const lack = lacking.reduce((s, t) => s + short(t), 0);
  if (store && lack > 0) for (const t of lacking) store.stocks[t] = round(clamp((store.stocks[t] ?? 3) + (value / lack) * span * 12, 0, 12), 1);
}

/** A political term in words: who grants it to whom. */
const CONDITION_LINE: Record<DealCondition["kind"], (by: string, to: string) => string> = {
  recognition: (by, to) => `${by} recognises ${to}'s government and borders`,
  votes: (by, to) => `${by} votes with ${to} at the world body`,
  base: (by, to) => `${by} lets ${to} station forces on its soil`,
  alliance: (by, to) => `${by} and ${to} sign a treaty of mutual assistance`,
  technology: (by, to) => `${by} shares its technology with ${to}`,
  exclusivity: (by, to) => `${by} deals in this good with ${to} alone`,
};

/** A deal's terms for the game master: value, price, term, payment and conditions. */
export function termsLine(state: Pick<GameState, "player">, d: DealTerms & Pick<TradeDeal, "partner" | "good">): string {
  const pay = d.pay === "credit" ? " | on credit, paid when it ends" : d.pay === "goods" && d.payGood ? ` | paid in ${d.payGood}` : "";
  const conditions = (d.conditions ?? []).map((c) => (c.by === "player" ? CONDITION_LINE[c.kind](state.player, d.partner) : CONDITION_LINE[c.kind](d.partner, state.player)));
  return `$${d.value}bn a year | price ${d.premium >= 0 ? "+" : ""}${d.premium}% to the market | ${d.years} years${pay}${conditions.length ? ` | terms: ${conditions.join("; ")}` : ""}`;
}

/** The deals, the turn's talks and proposals for the game master. */
export function describeDeals(state: GameState, world?: WorldScale): string[] {
  const all = state.deals ?? [];
  const deals = all.filter(open);
  const talks = all.filter((d) => (d.rounds ?? []).some((r) => r.turn === state.turn));
  if (!deals.length && !talks.length) return [];
  const what = (d: TradeDeal) => {
    const volume = volumeOf(d.good, d.value, state.scenarioId, world);
    const unit = UNITS[d.good];
    const amount = volume !== null && unit ? ` (about ${volume} ${{ mt: "million tonnes", mbbl: "million barrels", bcm: "bcm", t: "tonnes" }[unit]} a year)` : "";
    return `${d.side === "sell" ? "sells" : "buys"} ${d.good}${amount} | ${d.side === "sell" ? "to" : "from"} ${d.partner}`;
  };
  const line = (d: TradeDeal) => {
    const binding = bindingOf(state, d);
    const strain = d.strain ? ` | DELIVERED ${Math.round(d.strain.share * 100)}% last period (${d.strain.cause}, at the ${d.strain.by === "player" ? "player's" : "partner's"} end)` : "";
    return `- ${d.id} | ${what(d)} | ${termsLine(state, d)}${d.status === "active" ? ` | until ${d.until}` : ""}${binding >= 25 ? ` | binds them${binding >= 60 ? " closely" : ""}` : ""}${strain}`;
  };
  const offerLine = (d: TradeDeal, r: NonNullable<TradeDeal["rounds"]>[number]) =>
    // The answer to an offer is the other side's: the partner's to the player's offers (with its reason), the player's to the partner's counters.
    `${r.by === "player" ? state.player : d.partner} offered ${termsLine(state, { ...r.terms, partner: d.partner, good: d.good })}${r.answer ? ` -> ${r.by === "player" ? d.partner : state.player} ${r.answer}${r.by === "player" && r.reason ? ` (${r.reason})` : ""}` : ""}`;
  const outcome = (d: TradeDeal) =>
    d.status === "active" ? (d.rounds?.at(-1)?.answer === "accepted" ? (d.turn === state.turn ? "SIGNED" : "RENEGOTIATED, in force on the new terms") : d.talking ? "still talking; the deal stands as it was" : "the deal stands as it was") : d.status === "declined" ? (d.rounds?.at(-1)?.by === "player" && d.rounds.at(-1)?.answer === "refused" ? "REFUSED" : "the player left the talks") : "the partner's counter awaits the player";
  const active = deals.filter((d) => d.status === "active");
  const legacy = deals.filter((d) => d.status === "proposed" && !d.rounds?.length);
  return [
    ...(active.length ? ["", "PLAYER'S TRADE DEALS IN FORCE (id | what | partner | value | price | term | payment and terms):", ...active.map(line)] : []),
    ...(talks.length
      ? [
          "",
          "PLAYER'S TRADE TALKS THIS PERIOD (the engine's dice gave each answer: show them, in the partner's voice where it fits):",
          ...talks.map((d) => `- ${d.id} | ${what(d)} | ${(d.rounds ?? []).filter((r) => r.turn === state.turn).map((r) => offerLine(d, r)).join("; ")} | ${outcome(d)}`),
        ]
      : []),
    ...(legacy.length ? ["", "PLAYER'S TRADE PROPOSALS awaiting the partner's answer this turn (the engine answers them; give the partner's reason in note):", ...legacy.map(line)] : []),
  ];
}

import { z } from "zod";
import { loseSoldiers } from "./army";
import { surrenderArms } from "./arsenal";
import { addStep } from "./calendar";
import { endWar } from "./foreign";
import { allied, landHolders, powers, remember, tieOf } from "./relations";
import { en } from "./text";
import { BROKEN, readState, willToFight, type Reading } from "./warMeans";
import type { AppliedChange, GameState, MapRegion, PeaceOffer, PeaceTerms, Text, War, WeaponKind } from "./types";
import { PEACE_TERMS } from "./types";

/**
 * How wars end. A war ends by terms when a side's will breaks
 * (engine/warMeans.ts seekTerms), by the game master's peace, or here, when
 * a side has nothing left to fight with:
 *
 * - a government that holds no land goes into exile while something keeps
 *   it in the war: allies still fighting for it, a host that shelters it,
 *   soldiers who escaped, resistance at home. Its standing (0–100) rises with
 *   that support and fades without it; at nothing it gives up.
 * - with neither allies nor a host, a government with no land capitulates at
 *   once: it leaves its wars on the winner's terms (what the enemy holds of
 *   its land, the enemy keeps) and dissolves, out of its blocs; the country
 *   can come back as a movement or a provisional government
 *   (engine/provisional.ts).
 * - a war whose side has nobody left is over.
 *
 * An army whose country is overrun is mostly lost with it: when its
 * government goes into exile or gives up, a tenth of its soldiers escape
 * (ESCAPED; its ships and aircraft more), most of the rest are taken
 * prisoner – on the war's record – and the winner takes half of the weapons
 * left behind; a government that is gone keeps no army budget. Land its
 * friends hold – co-belligerents, allies, its host – goes back to it, and
 * the government comes home with it rather than giving up: no friend annexes
 * what it freed.
 *
 * The player's own government is never made to give up: in exile, its orders
 * decide (engine/unrest.ts). When the player's enemy collapses – in exile,
 * its will broken, most of its land lost, or having asked for terms – the
 * player may dictate the peace: annex, set up a government, restore the old
 * one, demilitarise, take reparations; the game master proposes them in
 * `peaceTerms` and the engine applies them.
 *
 * `warOutlook` reads a war for the panel and the game master: each side's
 * state (holding, collapsing, in exile, broken), what would end the war and
 * how close each is. Pure and deterministic.
 */

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const YEAR_MS = 365.25 * 86400000;
const yearsBetween = (from: string, to: string) => Math.max(0, (Date.parse(to) - Date.parse(from)) / YEAR_MS);
const round1 = (v: number) => Math.round(v * 10) / 10;

/** What each kind of support is worth to a government in exile, out of 100. */
export const EXILE_WEIGHTS = { allies: 40, army: 25, host: 20, resistance: 15 } as const;
/** Soldiers abroad, thousands, that make a whole army in the field. */
const ARMY_FULL = 20;
/** Average resistance at home at which it counts in full. */
const RESIST_FULL = 40;
/** Support at which a government in exile holds its standing; above it the standing grows, below it fades this many points a year for each point short. */
export const EXILE_HOLD = 50;
const EXILE_PACE = 8;
/** Standing below which a government in exile at war with the player asks it for terms. */
const OFFER_STANDING = 30;
/** A share of its own land lost from which a side is collapsing. */
const COLLAPSING = 0.6;
/** Will to fight under which a side is collapsing, close to breaking. */
const WEAK_WILL = 30;
/** How long a request for terms stands: a month at least, or one turn of a longer step. */
const OFFER_MONTHS = 1;

const inWar = (w: Pick<War, "attackers" | "defenders">, tag: string) => w.attackers.includes(tag) || w.defenders.includes(tag);
const sideOf = (w: Pick<War, "attackers" | "defenders">, tag: string) => (w.attackers.includes(tag) ? w.attackers : w.defenders.includes(tag) ? w.defenders : null);
const otherSide = (w: Pick<War, "attackers" | "defenders">, tag: string) => (w.attackers.includes(tag) ? w.defenders : w.defenders.includes(tag) ? w.attackers : []);

/** Countries that hold or fight in a province: who controls it, and who contests it. */
export function holdingLand(state: Pick<GameState, "regions">): Set<string> {
  const out = new Set<string>();
  for (const r of Object.values(state.regions)) {
    out.add(r.controller);
    if (r.contested) out.add(r.contested);
  }
  return out;
}

/** Whether a country has held land in play: it still owns some, its people resist, or the record shows land taken from it. */
export function hadLand(state: Pick<GameState, "regions" | "chronicle">, tag: string, applied: AppliedChange[] = []): boolean {
  for (const r of Object.values(state.regions)) if (r.owner === tag || r.resistance?.of === tag) return true;
  const taken = (c: AppliedChange) => (c.kind === "annex" || c.kind === "occupy") && c.from === tag;
  return applied.some(taken) || state.chronicle.some((e) => e.applied.some(taken));
}

/** When a country lost the last of its land, by the record: this turn's changes first, then the chronicle from the latest. */
export function landlessSince(state: Pick<GameState, "chronicle">, tag: string, applied: AppliedChange[], now: string): string {
  const taken = (c: AppliedChange) => (c.kind === "annex" || c.kind === "occupy") && c.from === tag;
  if (applied.some(taken)) return now;
  for (let i = state.chronicle.length - 1; i >= 0; i--) if (state.chronicle[i].applied.some(taken)) return state.chronicle[i].to;
  return now;
}

/** Whether a government has pledged to guard another (a "protect" aim). */
const protects = (state: Pick<GameState, "countries">, guard: string, ward: string) => Boolean(state.countries[guard]?.course?.aims.some((a) => a.kind === "protect" && a.target === ward));

/** What keeps a government without land in the war, each part 0–1, and the total out of 100. */
export interface ExileSupport {
  allies: number;
  army: number;
  host: number;
  resistance: number;
  total: number;
  /** Allies fighting for it: bound to it by a military alliance or a pledge, or fighting the war that was begun over it. */
  allyTags: string[];
  hostTag?: string;
}

type SupportState = Pick<GameState, "countries" | "regions" | "wars" | "alliances">;

/**
 * The government that would shelter a government in exile: one that holds
 * land, fights on its side, is its ally or pledged to guard it – never one at
 * war with it or allied to its enemies. The one it has keeps it while it may.
 */
export function exileHost(state: SupportState, tag: string, holders = holdingLand(state), power = powers(state), current?: string): string | undefined {
  const enemies = new Set(state.wars.flatMap((w) => otherSide(w, tag)));
  const friends = new Set(state.wars.flatMap((w) => sideOf(w, tag) ?? []));
  const eligible = (h: string) => {
    const c = state.countries[h];
    if (!c || h === tag || c.dormant || c.exile || !holders.has(h) || enemies.has(h)) return false;
    if ([...enemies].some((e) => allied(state, h, e))) return false;
    return friends.has(h) || allied(state, h, tag) || protects(state, h, tag);
  };
  if (current && eligible(current)) return current;
  let best: string | undefined;
  let score = -Infinity;
  for (const h of Object.keys(state.countries).sort()) {
    if (!eligible(h)) continue;
    const tie = tieOf(state, h, tag);
    const s = (friends.has(h) ? 30 : 0) + (allied(state, h, tag) ? 30 : 0) + (protects(state, h, tag) ? 20 : 0) + 30 * (power.get(h) ?? 0) + 0.2 * tie.trust + 0.1 * tie.near;
    if (s > score) {
      score = s;
      best = h;
    }
  }
  return best;
}

/** What keeps a government without land fighting: allies at war for it, a host, its soldiers abroad, resistance at home. */
export function exileSupport(state: SupportState, tag: string, holders = holdingLand(state), power = powers(state)): ExileSupport {
  const allyTags = new Set<string>();
  for (const w of state.wars) {
    const side = sideOf(w, tag);
    if (!side || w.truce) continue;
    // The war begun over it: its first member on its side.
    const over = side[0] === tag;
    for (const a of side) {
      if (a === tag || !holders.has(a) || state.countries[a]?.exile || state.countries[a]?.dormant) continue;
      if (over || allied(state, tag, a) || protects(state, a, tag)) allyTags.add(a);
    }
  }
  // Allies fighting for it count in full while one is still standing: what matters is that someone fights on.
  const allies = allyTags.size ? 1 : 0;
  const hostTag = exileHost(state, tag, holders, power, state.countries[tag]?.exile?.host);
  const host = hostTag ? 1 : 0;
  // Soldiers who escaped fight on only where a host or allies give them somewhere to stand.
  const troops = state.countries[tag]?.economy?.troops ?? 0;
  const army = host || allies ? clamp(troops / ARMY_FULL, 0, 1) : 0;
  let levels = 0;
  let n = 0;
  for (const r of Object.values(state.regions)) {
    if (r.resistance?.of !== tag || r.resistance.level < 1 || r.controller === tag) continue;
    levels += r.resistance.level;
    n += 1;
  }
  const resistance = n ? clamp(levels / n / RESIST_FULL, 0, 1) : 0;
  const total = Math.round(EXILE_WEIGHTS.allies * allies + EXILE_WEIGHTS.army * army + EXILE_WEIGHTS.host * host + EXILE_WEIGHTS.resistance * resistance);
  return { allies: round1(allies), army: round1(army), host, resistance: round1(resistance), total, allyTags: [...allyTags].sort(), ...(hostTag ? { hostTag } : {}) };
}

/** How a government in exile's standing moves a year with its support: it holds at EXILE_HOLD, grows above, fades below. */
export const exileTrend = (total: number) => (total - EXILE_HOLD) * EXILE_PACE;
/** Where a government's standing starts when it loses its last province. */
export const exileStart = (total: number) => clamp(50 + total / 2, 0, 100);
/** Months until a fading government in exile gives up, or undefined while it holds. */
export function monthsLeft(standing: number, total: number): number | undefined {
  const trend = exileTrend(total);
  if (trend >= 0) return undefined;
  return Math.max(0, Math.ceil((standing / -trend) * 12));
}

/** The country that takes most of a government's land: the enemy holding most of it, or of its people's land, else its strongest enemy. */
export function mainOccupier(state: Pick<GameState, "regions" | "countries" | "wars" | "chronicle">, tag: string, enemies: Set<string>): string | undefined {
  const count = new Map<string, number>();
  const add = (t: string) => enemies.has(t) && count.set(t, (count.get(t) ?? 0) + 1);
  for (const r of Object.values(state.regions)) if (r.owner === tag && r.controller !== tag) add(r.controller);
  if (!count.size) for (const r of Object.values(state.regions)) if (r.resistance?.of === tag) add(r.controller);
  if (!count.size) {
    for (const e of state.chronicle) for (const c of e.applied) if (c.kind === "annex" && c.from === tag && state.regions[c.region]?.owner === c.to) add(c.to);
  }
  if (count.size) return [...count].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
  const power = powers(state);
  return [...enemies].sort((a, b) => (power.get(b) ?? 0) - (power.get(a) ?? 0) || a.localeCompare(b))[0];
}

/** Of an overrun army, the share of its soldiers that escape abroad with their government; of the rest, the share taken prisoner (the others fell in the last battles or went home). */
export const ESCAPED = 0.1;
const SURRENDERED = 0.7;
/** The share of each kind of weapon that escapes with them: ships sail and aircraft fly to a friendly shore. */
const ESCAPED_ARMS: Partial<Record<WeaponKind, number>> = { ships: 0.6, aircraft: 0.3 };

/**
 * An army whose country is overrun: a tenth of its soldiers escape, most of
 * the rest are taken prisoner – on the beaten country's record in its war
 * with the winner – and the winner takes half of the weapons left behind,
 * the rest destroyed. Mutates `next`.
 */
export function routArmy(next: GameState, tag: string, winner: string | undefined, applied: AppliedChange[]): void {
  const troops = next.countries[tag]?.economy?.troops ?? 0;
  if (troops > 0) {
    const lost = troops * (1 - ESCAPED);
    const war = next.wars.find((w) => inWar(w, tag) && (!winner || otherSide(w, tag).includes(winner))) ?? next.wars.find((w) => inWar(w, tag));
    const prisoners = Math.round(lost * SURRENDERED * 1000) / 1000;
    if (war && prisoners > 0) {
      const had = war.losses?.[tag] ?? { killed: 0, wounded: 0 };
      const last = had.last?.turn === next.turn ? had.last : { turn: next.turn, killed: 0, wounded: 0 };
      const r3 = (n: number) => Math.round(n * 1000) / 1000;
      war.losses = { ...war.losses, [tag]: { ...had, captured: r3((had.captured ?? 0) + prisoners), last: { ...last, captured: r3((last.captured ?? 0) + prisoners) } } };
    }
    loseSoldiers(next, tag, lost);
  }
  surrenderArms(next, tag, winner, (kind) => ESCAPED_ARMS[kind] ?? ESCAPED, applied);
}

/** A government's friends: those fighting at its side in any of its wars, its allies, its host and those pledged to guard it – never one at war with it. */
function friendsOf(state: Pick<GameState, "countries" | "wars" | "alliances">, tag: string): Set<string> {
  const out = new Set<string>(state.wars.flatMap((w) => sideOf(w, tag) ?? []));
  for (const c of Object.values(state.countries)) if (allied(state, c.tag, tag) || protects(state, c.tag, tag)) out.add(c.tag);
  const host = state.countries[tag]?.exile?.host;
  if (host) out.add(host);
  for (const w of state.wars) for (const e of otherSide(w, tag)) out.delete(e);
  out.delete(tag);
  return out;
}

/**
 * A government's land its friends hold goes back to it – a liberation – where
 * no one not at war with it still fights in the province. Returns whether any
 * did: the government holds land again. Mutates `next`.
 */
export function homecoming(next: GameState, tag: string, applied: AppliedChange[]): boolean {
  const friends = friendsOf(next, tag);
  if (!friends.size) return false;
  const enemies = new Set(next.wars.flatMap((w) => otherSide(w, tag)));
  let back = false;
  for (const [id, r] of Object.entries(next.regions).sort((a, b) => a[0].localeCompare(b[0]))) {
    if (r.owner !== tag || r.controller === tag || !friends.has(r.controller)) continue;
    if (r.contested && !enemies.has(r.contested)) continue;
    applied.push({ kind: "liberate", region: id, from: r.controller, to: tag });
    r.controller = tag;
    delete r.behind;
    back = true;
  }
  return back;
}

/** A country leaves one war; a side left with nobody ends it. */
export function leaveWar(next: GameState, war: War, tag: string, applied: AppliedChange[]): void {
  const live = next.wars.find((w) => w.id === war.id);
  if (!live) return;
  live.attackers = live.attackers.filter((t) => t !== tag);
  live.defenders = live.defenders.filter((t) => t !== tag);
  if (live.offers) {
    live.offers = live.offers.filter((o) => o.by !== tag);
    if (!live.offers.length) delete live.offers;
  }
  if (!live.attackers.length || !live.defenders.length) endWar(next, live, applied);
}

/** The land a war's winners hold of a beaten country passes to them for good – to a government a winner set up for that country's people, if it has one. */
export function annexHeld(next: GameState, tag: string, winners: Set<string>, applied: AppliedChange[]): void {
  for (const [id, r] of Object.entries(next.regions).sort((a, b) => a[0].localeCompare(b[0]))) {
    if (r.owner !== tag || r.controller === tag || !winners.has(r.controller)) continue;
    // Never the beaten government itself: a client that fought its own patron and lost (Rwanda, set up by DR Congo, at
    // war with it again) is no government the patron sets up for its land.
    const client = clientFor(next, r.controller, tag);
    const to = client && client !== tag ? client : r.controller;
    applied.push({ kind: "annex", region: id, from: tag, to });
    r.owner = to;
    r.controller = to;
    delete r.behind;
    // An insurgency that fought on the winning side and holds the land (Abkhazia after Georgia's defeat) is a state
    // from now on, as at a peace (intentions.ts): a dormant country owns no land.
    if (next.countries[to]?.dormant) delete next.countries[to].dormant;
  }
}

/** A government a holder set up for a country's people, if it has one (engine/provisional.ts). */
export function clientFor(state: Pick<GameState, "countries">, patron: string, of: string): string | undefined {
  return Object.values(state.countries).find((c) => c.client?.patron === patron && (c.client.of === of || c.tag === of) && !c.dormant)?.tag;
}

/**
 * A government that is gone: no longer at war, out of its blocs, its plans dropped, and owning nothing – whoever
 * holds what was left of its land keeps it (a dormant country owns no land: tests/support/invariants.ts). The country
 * may come back as a movement or a provisional government.
 */
export function dissolve(next: GameState, tag: string, ctx: { turn: number; to: string }, applied: AppliedChange[]): void {
  const c = next.countries[tag];
  if (!c) return;
  c.dormant = true;
  delete c.exile;
  delete c.client;
  // A government that is gone pays for no army.
  if (c.economy) c.economy = { ...c.economy, budget: { ...c.economy.budget, army: 0 } };
  // After it is dormant, so that the land never passes back to it as a government set up for its own people (clientFor).
  annexHeld(next, tag, new Set(Object.values(next.regions).filter((r) => r.owner === tag && r.controller !== tag).map((r) => r.controller)), applied);
  for (const a of next.alliances) {
    if (!a.members.includes(tag)) continue;
    const before = [...a.members];
    a.members = a.members.filter((m) => m !== tag);
    if (a.members.length < 2 && before.length >= 2) applied.push({ kind: "alliance-ended", alliance: a.id, name: a.name, members: before });
  }
  next.alliances = next.alliances.filter((a) => a.members.length >= 2);
  for (const p of next.plans ?? []) if (!p.end && (p.by === tag || p.target === tag)) p.end = { date: ctx.to, turn: ctx.turn, how: "failed", why: "target-gone" };
}

/** Hooks the provisional governments lend the end of a war (engine/provisional.ts), passed in to keep the two apart. */
export interface SettleHooks {
  /** An occupier abroad sets up a government of the beaten country's own instead of annexing it; true when it did. */
  install?: (next: GameState, tag: string, patron: string, ctx: { turn: number; to: string }, applied: AppliedChange[]) => boolean;
}

/**
 * A government gives up: it leaves every war on the winners' terms – what
 * they hold of its land they keep, or a winner abroad sets up a government
 * of its own there – and, unless such a government takes its place, it
 * dissolves.
 */
export function capitulate(next: GameState, tag: string, ctx: { turn: number; to: string; why: "alone" | "faded" | "peace" }, applied: AppliedChange[], hooks: SettleHooks = {}): void {
  const wars = next.wars.filter((w) => inWar(w, tag));
  const enemies = new Set(wars.flatMap((w) => otherSide(w, tag)));
  const winner = mainOccupier(next, tag, enemies);
  applied.push({ kind: "capitulation", country: tag, ...(winner ? { to: winner } : {}), why: ctx.why });
  // Its army lays down its arms – unless it was routed already, when the government went into exile.
  if (!next.countries[tag]?.exile) routArmy(next, tag, winner, applied);
  // A war's other enemies keep what they hold; the main one may put a government of the country's own in its place.
  const installed = Boolean(winner && hooks.install?.(next, tag, winner, ctx, applied));
  annexHeld(next, tag, installed && winner ? new Set([...enemies].filter((e) => e !== winner)) : enemies, applied);
  for (const w of wars) leaveWar(next, w, tag, applied);
  // A government that is gone owns nothing: whoever holds what was left of its land keeps it (dissolve).
  if (!installed) dissolve(next, tag, ctx, applied);
  else delete next.countries[tag].exile;
  // The winners remember the peace it made.
  for (const e of enemies) remember(next, tag, e, "made-peace", 5, ctx.to, false);
}

/** A request for terms to the player's government, standing for a month or a turn, whichever is longer. */
function offer(next: GameState, war: War, by: string, terms: PeaceTerms, to: string): PeaceOffer {
  const month = addStep(to, "month");
  const turn = addStep(to, next.step);
  const until = OFFER_MONTHS && month > turn ? month : turn;
  const o: PeaceOffer = { by, since: to, until, terms };
  war.offers = [...(war.offers ?? []).filter((x) => x.by !== by), o];
  return o;
}

/**
 * The turn's end of wars, once the borders are settled: requests for terms
 * that lapse, those the player's enemies made this turn (a peace plan the
 * player's orders did not answer stands as a request), and every government
 * without land judged – home again with a province, in exile while something
 * keeps it fighting, given up when nothing does or its standing is gone.
 * Mutates `next`.
 */
export function settleWars(next: GameState, ctx: { turn: number; to: string; years: number }, applied: AppliedChange[], hooks: SettleHooks = {}): void {
  // Requests for terms that ran out unanswered.
  for (const w of next.wars) {
    if (!w.offers) continue;
    for (const o of w.offers.filter((x) => x.until <= ctx.to)) applied.push({ kind: "offer", war: w.id, name: w.name, by: o.by, terms: o.terms, change: "lapsed" });
    w.offers = w.offers.filter((x) => x.until > ctx.to && inWar(w, x.by));
    if (!w.offers.length) delete w.offers;
  }
  // A peace the player's enemy asked for this turn, which the plan left refused for the player to decide: it stands as a request.
  for (let i = 0; i < applied.length; i++) {
    const c = applied[i];
    if (c.kind !== "plan-end" || c.type !== "peace" || c.target !== next.player || c.why !== "refused") continue;
    const plan = (next.plans ?? []).find((p) => p.id === c.plan);
    const war = next.wars.find((w) => w.id === plan?.war);
    if (!war || !inWar(war, c.by) || !inWar(war, next.player)) continue;
    offer(next, war, c.by, "annex", ctx.to);
    applied[i] = { kind: "offer", war: war.id, name: war.name, by: c.by, terms: "annex" };
  }

  const holders = holdingLand(next);
  const power = powers(next, landHolders(next));
  for (const tag of Object.keys(next.countries).sort()) {
    if (tag === next.player) continue;
    const c = next.countries[tag];
    if (!c || c.dormant) continue;
    // What its friends hold of its land comes back to it: it is home again, not given up.
    if (!holders.has(tag) && homecoming(next, tag, applied)) holders.add(tag);
    if (holders.has(tag)) {
      if (c.exile) {
        delete c.exile;
        applied.push({ kind: "return", country: tag });
      }
      continue;
    }
    const wars = next.wars.filter((w) => inWar(w, tag));
    if (!wars.length) {
      // A government in exile whose wars are over has nothing left to carry on for.
      if (c.exile) {
        applied.push({ kind: "capitulation", country: tag, why: "peace" });
        dissolve(next, tag, ctx, applied);
      }
      continue;
    }
    if (!c.exile && !hadLand(next, tag, applied)) continue;
    const support = exileSupport(next, tag, holders, power);
    if (!support.allies && !support.host) {
      capitulate(next, tag, { ...ctx, why: "alone" }, applied, hooks);
      continue;
    }
    const trend = exileTrend(support.total);
    const since = c.exile?.since ?? landlessSince(next, tag, applied, ctx.to);
    // A government with no standing on record (just exiled, or from a save before it) is judged for all the time it has been without land.
    const standing = clamp(c.exile?.standing !== undefined ? c.exile.standing + trend * ctx.years : exileStart(support.total) + trend * yearsBetween(since, ctx.to), 0, 100);
    if (standing <= 0) {
      capitulate(next, tag, { ...ctx, why: "faded" }, applied, hooks);
      continue;
    }
    const fresh = !c.exile;
    c.exile = { ...c.exile, since, standing: round1(standing) };
    if (support.hostTag) c.exile.host = support.hostTag;
    else delete c.exile.host;
    if (fresh) {
      applied.push({ kind: "exile", country: tag, ...(support.hostTag ? { host: support.hostTag } : {}) });
      // Its country overrun, its army is mostly lost: what escaped fights on from abroad.
      routArmy(next, tag, mainOccupier(next, tag, new Set(wars.flatMap((w) => otherSide(w, tag)))), applied);
    }
    // Fading and at war with the player, it asks for terms – once.
    const theirs = wars.find((w) => otherSide(w, tag).includes(next.player));
    if (theirs && standing < OFFER_STANDING && trend < 0 && !c.exile.offered && !theirs.offers?.some((o) => o.by === tag)) {
      offer(next, theirs, tag, "annex", ctx.to);
      c.exile.offered = ctx.to;
      applied.push({ kind: "offer", war: theirs.id, name: theirs.name, by: tag, terms: "annex" });
    }
  }
}

// --- The player's peace on terms ---

const shortText = z.string().trim().max(300);
const tag = z.string().trim().min(1).max(80);

/** The peace the player's orders dictated (merged into OutcomeSchema as `peaceTerms`). */
export const peaceTermsField = z
  .array(
    z.object({
      war: shortText.min(1),
      // The enemy that makes peace.
      with: tag,
      terms: z.enum(PEACE_TERMS).catch("annex"),
      // For a government set up: its name and leader.
      name: shortText.optional(),
      leader: shortText.optional(),
    }),
  )
  .max(4)
  .default([]);

export type PeaceTermsEntry = { war: string; with: string; terms: PeaceTerms; name?: string; leader?: string };

/** Why the player may dictate the peace to an enemy, if it may: in exile, its will broken, most of its land lost, or a request for terms standing. */
export type DictateWhy = "exile" | "broken" | "collapsing" | "offer";

export function canDictate(state: GameState, war: War, enemy: string, reading: Reading = readState(state), holders = holdingLand(state)): DictateWhy | null {
  if (!inWar(war, state.player) || !otherSide(war, state.player).includes(enemy) || !state.countries[enemy] || state.countries[enemy].dormant) return null;
  if (war.offers?.some((o) => o.by === enemy)) return "offer";
  if (!holders.has(enemy)) return "exile";
  if ((reading.people.get(enemy)?.lost ?? 0) >= COLLAPSING) return "collapsing";
  if (enemy !== state.player && willToFight(state, enemy, null, reading) < BROKEN) return "broken";
  return null;
}

/** The enemies the player may dictate the peace to now, by war. */
export function dictable(state: GameState): { war: War; enemy: string; why: DictateWhy }[] {
  const reading = readState(state);
  const holders = holdingLand(state);
  const out: { war: War; enemy: string; why: DictateWhy }[] = [];
  for (const w of state.wars) {
    if (!inWar(w, state.player)) continue;
    for (const e of otherSide(w, state.player)) {
      const why = canDictate(state, w, e, reading, holders);
      if (why) out.push({ war: w, enemy: e, why });
    }
  }
  return out;
}

/** The peace terms an answer gave, kept only where the player is at war with that enemy and may dictate to it; one per enemy. */
export function sanitizePeaceTerms(
  state: GameState,
  raw: z.infer<typeof peaceTermsField>,
  findWar: (key: string) => War | undefined,
  // Whether the player may set up a government in a country (engine/provisional.ts), for terms that do.
  canSetUp: (tag: string) => boolean = () => true,
): { terms: PeaceTermsEntry[]; dropped: number } {
  const reading = readState(state);
  const holders = holdingLand(state);
  const out: PeaceTermsEntry[] = [];
  let dropped = 0;
  for (const t of raw) {
    const war = findWar(t.war) ?? state.wars.find((w) => inWar(w, t.with) && otherSide(w, state.player).includes(t.with));
    if (!war || out.some((x) => x.with === t.with) || !canDictate(state, war, t.with, reading, holders) || (t.terms === "government" && !canSetUp(t.with))) {
      dropped += 1;
      continue;
    }
    out.push({ war: war.id, with: t.with, terms: t.terms, ...(t.name ? { name: t.name } : {}), ...(t.leader ? { leader: t.leader } : {}) });
  }
  return { terms: out, dropped };
}

/** Heavy weapons a demilitarised country gives up, a share of each. */
const DEMILITARISE_KEEP = 0.5;
const DEMILITARISE_TROOPS = 0.3;
/** Reparations: a share of the beaten country's yearly output, paid at the peace. */
const REPARATIONS = 0.25;
/** Years a demilitarisation treaty runs. */
const DEMILITARISE_YEARS = 10;

/** Land a war's winners hold of a beaten country goes back to it. */
function giveBack(next: GameState, tag: string, winners: Set<string>, applied: AppliedChange[]): void {
  for (const [id, r] of Object.entries(next.regions).sort((a, b) => a[0].localeCompare(b[0]))) {
    if (r.owner !== tag || r.controller === tag || !winners.has(r.controller)) continue;
    applied.push({ kind: "liberate", region: id, from: r.controller, to: tag });
    r.controller = tag;
    delete r.behind;
    delete r.resistance;
  }
}

/** Hooks for the peace on terms: setting up a government (engine/provisional.ts). */
export interface TermsHooks {
  setUp: (next: GameState, entry: { country: string; by: string; name?: string; leader?: string; land: "now" | "gradual" }, ctx: { turn: number; to: string }, applied: AppliedChange[]) => string | null;
}

/**
 * The player's peace with one enemy on the terms it dictated: the enemy
 * leaves the war (a side with nobody left ends it) and the terms take
 * effect – the land the player's side holds annexed, a government set up in
 * it, or given back, with the enemy disarmed or paying reparations.
 */
export function applyPeaceTerms(next: GameState, t: PeaceTermsEntry, ctx: { turn: number; to: string }, applied: AppliedChange[], hooks: TermsHooks): void {
  const war = next.wars.find((w) => w.id === t.war);
  if (!war || !inWar(war, t.with) || !inWar(war, next.player)) return;
  const winners = new Set(otherSide(war, t.with));
  const enemy = next.countries[t.with];
  applied.push({ kind: "terms", war: war.id, name: war.name, by: next.player, with: t.with, terms: t.terms });
  switch (t.terms) {
    case "annex":
      annexHeld(next, t.with, winners, applied);
      break;
    case "government": {
      // The player's government sets one up in what it holds; its allies keep what they hold.
      hooks.setUp(next, { country: t.with, by: next.player, name: t.name, leader: t.leader, land: "now" }, ctx, applied);
      annexHeld(next, t.with, new Set([...winners].filter((w) => w !== next.player)), applied);
      break;
    }
    case "restore":
      giveBack(next, t.with, winners, applied);
      remember(next, t.with, next.player, "made-peace", 20, ctx.to);
      break;
    case "demilitarise": {
      giveBack(next, t.with, winners, applied);
      if (enemy?.economy) enemy.economy = { ...enemy.economy, troops: Math.round(enemy.economy.troops * DEMILITARISE_TROOPS * 10) / 10 };
      const stock = enemy?.arsenal?.stock;
      if (stock) for (const k of ["artillery", "tanks", "aircraft", "ships", "airDefence", "drones"] as const) if (stock[k]) stock[k] = { ...stock[k]!, n: Math.round(stock[k]!.n * DEMILITARISE_KEEP) };
      const until = new Date(Date.parse(ctx.to) + DEMILITARISE_YEARS * YEAR_MS).toISOString().slice(0, 10);
      next.alliances.push({
        id: `a${ctx.turn}-dm-${t.with}`,
        name: { ru: "Договор о демилитаризации", uk: "Договір про демілітаризацію", en: "Demilitarisation treaty" },
        members: [next.player, t.with],
        since: ctx.to,
        kind: "pact",
        until,
        terms: { ru: "Армия ограничена, тяжёлое вооружение сокращено", uk: "Армію обмежено, важке озброєння скорочено", en: "The army limited, heavy weapons cut" },
        founder: next.player,
      });
      break;
    }
    case "reparations": {
      giveBack(next, t.with, winners, applied);
      const payer = enemy?.economy;
      const payee = next.countries[next.player]?.economy;
      if (payer && payee) {
        const amount = Math.round(payer.gdp * REPARATIONS * 1000) / 1000;
        const fromReserves = Math.min(payer.reserves, amount);
        enemy.economy = { ...payer, reserves: Math.round((payer.reserves - fromReserves) * 1000) / 1000, debt: Math.round((payer.debt + amount - fromReserves) * 1000) / 1000 };
        next.countries[next.player].economy = { ...payee, reserves: Math.round((payee.reserves + amount) * 1000) / 1000 };
        applied.push({ kind: "funds", from: t.with, to: next.player, amount, type: "reparations" });
      }
      break;
    }
  }
  leaveWar(next, war, t.with, applied);
  // Beaten and left with no land, the old government is gone – unless the new one took its place.
  const c = next.countries[t.with];
  if (c && !c.dormant && !c.client && !holdingLand(next).has(t.with) && !next.wars.some((w) => inWar(w, t.with))) dissolve(next, t.with, ctx, applied);
}

// --- What the panel and the game master read ---

export type SideState = "holding" | "collapsing" | "exile" | "broken";

export interface SideOutlook {
  side: "attackers" | "defenders";
  /** Its strongest member, whose peace ends the war. */
  principal: string;
  state: SideState;
  /** The principal's will to fight, 0–100; under BROKEN it seeks terms. */
  will: number;
  /** Provinces of its own land the side still holds, of all it owns. */
  holds: number;
  owns: number;
  /** Share of its own land the enemy holds, 0–1. */
  lost: number;
  /** Members still holding land. */
  standing: number;
  /** The principal's government in exile: its standing, support and months left while it fades. */
  exile?: ExileView;
  /** A member's request for terms to the player stands. */
  offer?: PeaceOffer;
  /** Members other than the principal that are not simply holding: in exile, broken, collapsing. */
  members: { tag: string; state: SideState; exile?: ExileView }[];
}

/** A government in exile as the panel reads it. */
export interface ExileView {
  tag: string;
  standing: number;
  support: ExileSupport;
  /** Months until it gives up, while it fades. */
  months?: number;
}

export type EndKind = "terms" | "exile" | "will" | "land" | "allies" | "none";

/** What would end a war, and how close it is: 0 far off, 1 at hand. */
export interface WarEnd {
  kind: EndKind;
  /** The side that would give in. */
  side: "attackers" | "defenders";
  tag: string;
  near: number;
  /** Will points above the threshold, provinces left, months left, allies at war. */
  value?: number;
}

export interface WarOutlook {
  sides: [SideOutlook, SideOutlook];
  ends: WarEnd[];
  /** The likeliest way it ends; "none" when no end is in sight. */
  likely: WarEnd;
}

/**
 * A war read for the panel and the game master: each side's state, what
 * would end it (its principal's will under the threshold, its last
 * provinces, its allies leaving, its government in exile giving up, a
 * request for terms answered) and how close each is.
 */
export function warOutlook(state: GameState, war: War, map?: Record<string, MapRegion> | null, reading: Reading = readState(state, map)): WarOutlook {
  const holders = holdingLand(state);
  const power = powers(state, landHolders(state));
  const principal = (side: string[]) => [...side].sort((a, b) => (power.get(b) ?? 0) - (power.get(a) ?? 0) || a.localeCompare(b))[0] ?? side[0];
  const owned = new Map<string, { owns: number; holds: number }>();
  for (const r of Object.values(state.regions)) {
    const o = owned.get(r.owner) ?? { owns: 0, holds: 0 };
    o.owns += 1;
    if (r.controller === r.owner) o.holds += 1;
    owned.set(r.owner, o);
  }
  /** One member: its state, and its government in exile if it has one. */
  const member = (t: string): { state: SideState; will: number; exile?: ExileView } => {
    const c = state.countries[t];
    const will = willToFight(state, t, map, reading);
    const landless = !holders.has(t);
    let exile: ExileView | undefined;
    if (landless && t !== state.player && c && !c.dormant) {
      const support = exileSupport(state, t, holders, power);
      const standing = c.exile?.standing ?? exileStart(support.total);
      const months = monthsLeft(standing, support.total);
      exile = { tag: t, standing: Math.round(standing), support, ...(months !== undefined ? { months } : {}) };
    }
    const o = owned.get(t);
    const lost = o?.owns ? 1 - o.holds / o.owns : 0;
    const st: SideState = landless || c?.exile ? "exile" : will < BROKEN ? "broken" : lost >= COLLAPSING || will < WEAK_WILL ? "collapsing" : "holding";
    return { state: st, will, ...(exile ? { exile } : {}) };
  };
  const read = (key: "attackers" | "defenders"): SideOutlook => {
    const side = war[key];
    const lead = principal(side);
    let owns = 0;
    let holds = 0;
    for (const t of side) {
      owns += owned.get(t)?.owns ?? 0;
      holds += owned.get(t)?.holds ?? 0;
    }
    const lost = owns ? 1 - holds / owns : 0;
    const head = member(lead);
    const offer = war.offers?.find((o) => side.includes(o.by));
    const others = side
      .filter((t) => t !== lead)
      .map((t) => ({ tag: t, ...member(t) }))
      .filter((m) => m.state !== "holding")
      .map(({ tag: t, state: st, exile }) => ({ tag: t, state: st, ...(exile ? { exile } : {}) }));
    return {
      side: key,
      principal: lead,
      state: head.state,
      will: head.will,
      holds,
      owns,
      lost: Math.round(lost * 100) / 100,
      standing: side.filter((t) => holders.has(t)).length,
      ...(head.exile ? { exile: head.exile } : {}),
      ...(offer ? { offer } : {}),
      members: others,
    };
  };
  const sides: [SideOutlook, SideOutlook] = [read("attackers"), read("defenders")];
  const ends: WarEnd[] = [];
  for (const s of sides) {
    if (s.offer) ends.push({ kind: "terms", side: s.side, tag: s.offer.by, near: 0.95 });
    if (s.exile) {
      const months = s.exile.months;
      ends.push({ kind: "exile", side: s.side, tag: s.exile.tag, near: months === undefined ? 0.1 : clamp(1 - months / 24, 0.3, 0.98), ...(months !== undefined ? { value: months } : {}) });
    }
    if (s.principal !== state.player && s.state !== "exile") ends.push({ kind: "will", side: s.side, tag: s.principal, near: clamp(1 - (s.will - BROKEN) / 50, 0, 0.97), value: Math.max(0, s.will - BROKEN) });
    if (s.owns && s.holds > 0) ends.push({ kind: "land", side: s.side, tag: s.principal, near: s.holds <= 3 ? clamp(0.75 + 0.05 * (3 - s.holds), 0, 0.9) : clamp(s.lost * 0.8, 0, 0.75), value: s.holds });
    const others = war[s.side].filter((t) => t !== s.principal && holders.has(t)).length;
    if (others > 0) ends.push({ kind: "allies", side: s.side, tag: s.principal, near: 0.15, value: others });
  }
  ends.sort((a, b) => b.near - a.near);
  const likely = ends[0] && ends[0].near >= 0.35 ? ends[0] : { kind: "none" as const, side: sides[0].side, tag: sides[0].principal, near: 0 };
  return { sides, ends, likely };
}

/** A war's outlook in one line for the game master. */
export function outlookLine(o: WarOutlook, name: (tag: string) => string = (t) => t): string {
  const side = (s: SideOutlook) => {
    const lead = name(s.principal);
    if (s.exile) return `${s.side === "attackers" ? "A" : "D"} in exile (${lead}: standing ${s.exile.standing}, support ${s.exile.support.total}${s.exile.months !== undefined ? `, gives up in about ${s.exile.months} months` : ", holding on"})`;
    return `${s.side === "attackers" ? "A" : "D"} ${s.state} (${lead} will ${s.will}, holds ${s.holds} of ${s.owns} own provinces)`;
  };
  const end = (e: WarEnd) => {
    switch (e.kind) {
      case "terms":
        return `${name(e.tag)} has asked for terms`;
      case "exile":
        return `${name(e.tag)}'s government in exile gives up${e.value !== undefined ? ` (about ${e.value} months)` : ""}`;
      case "will":
        return `${name(e.tag)}'s will breaks (${e.value} points above ${BROKEN})`;
      case "land":
        return `${name(e.tag)}'s side loses its last provinces (${e.value} left)`;
      case "allies":
        return `${name(e.tag)}'s allies leave`;
      default:
        return "no end in sight";
    }
  };
  return `outlook: ${o.sides.map(side).join("; ")}; likely to end when ${end(o.likely)}`;
}

/** The player's peace on terms for the game master: the enemies it may dictate to and the requests for terms that stand. */
export function describeSettlement(state: GameState): string[] {
  const list = dictable(state);
  if (!list.length) return [];
  const name = (t: string) => `${en(state.countries[t]?.name ?? t)} [${t}]`;
  const why: Record<DictateWhy, string> = { exile: "its government holds no land", broken: "its will to fight has broken", collapsing: "most of its land is lost", offer: "it has asked for terms" };
  return [
    "",
    `TERMS THE PLAYER MAY DICTATE (if the orders make peace with one of these, give it in "peaceTerms": ${PEACE_TERMS.join("|")}; the engine applies them):`,
    ...list.map((d) => {
      const o = d.war.offers?.find((x) => x.by === d.enemy);
      return `- ${name(d.enemy)} in ${d.war.id}: ${why[d.why]}${o ? ` (since ${o.since}, until ${o.until})` : ""}`;
    }),
  ];
}

/** A country's name as text, for the lines that need one. */
export const nameText = (state: Pick<GameState, "countries">, tag: string): Text => state.countries[tag]?.name ?? tag;

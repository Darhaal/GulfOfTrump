import { z } from "zod";
import { peopleIn } from "./population";
import type { AppliedChange, GameState, MapRegion, Sanction, ScenarioId } from "./types";

/**
 * Trade between countries. Who trades with whom follows a gravity model:
 * big economies close to each other trade most; war stops trade, a truce
 * barely lets it resume, sanctions choke it, and a shared trade bloc,
 * union or alliance makes it easier. Each country sells abroad a share of
 * its GDP that grows with the era. Sanctions cut a country's imports by the
 * share that came from those who impose them — the engine's trade cut,
 * beside the blockades the model reports.
 */

/** Exports as a share of GDP in each era, for an economy of middling size; big ones trade less of their output, small ones more. */
const OPENNESS: Record<ScenarioId, number> = { "1914": 0.14, "1939": 0.08, "1991": 0.18, "2014": 0.3, "2022": 0.28 };

/** How much distance hurts trade: well above 1, so neighbours matter more than distant giants. */
const DISTANCE = 1.3;

/** Blocs this big are world bodies (the UN, the League of Nations), not trading clubs. */
const WORLD_BODY = 60;

export const SANCTION_SCOPES = ["partial", "full"] as const;

const tag = z.string().trim().min(1).max(80);

/** Sanctions imposed or lifted in a turn (merged into OutcomeSchema as `sanctions`). */
export const sanctionsField = z
  .array(z.object({ by: tag, against: tag, scope: z.enum(SANCTION_SCOPES).catch("partial").default("partial"), lifted: z.boolean().catch(false).default(false) }))
  .max(12)
  .default([]);

export interface Partner {
  tag: string;
  /** $bn a year. */
  value: number;
  share: number;
}

export interface TradeBook {
  /** $bn a year sold abroad. */
  exports: number;
  imports: number;
  toward: Partner[];
  from: Partner[];
}

type Point = [number, number];

/** Where each country's people live, on average: its centre for distances. */
export function countryCentres(state: Pick<GameState, "regions">, map: Record<string, MapRegion>): Map<string, Point> {
  const sums = new Map<string, { x: number; y: number; w: number }>();
  for (const [id, r] of Object.entries(state.regions)) {
    const p = map[id];
    if (!p?.at) continue;
    const w = Math.max(1, peopleIn(r, p));
    const s = sums.get(r.owner) ?? { x: 0, y: 0, w: 0 };
    s.x += p.at[0] * w;
    s.y += p.at[1] * w;
    s.w += w;
    sums.set(r.owner, s);
  }
  return new Map([...sums].map(([t, s]) => [t, [s.x / s.w, s.y / s.w] as Point]));
}

export const distanceKm = (a: Point, b: Point) => {
  const rad = Math.PI / 180;
  const h = Math.sin(((b[1] - a[1]) * rad) / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(((b[0] - a[0]) * rad) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
};

/** How freely two countries can trade: 0 at war, a little in a truce or under full sanctions, more in a bloc together. */
function friction(state: Pick<GameState, "wars" | "alliances" | "sanctions">, a: string, b: string): number {
  for (const w of state.wars) {
    const opposed = (w.attackers.includes(a) && w.defenders.includes(b)) || (w.attackers.includes(b) && w.defenders.includes(a));
    if (opposed) return w.truce ? 0.2 : 0;
  }
  let f = 1;
  for (const s of state.sanctions ?? []) {
    if ((s.by === a && s.against === b) || (s.by === b && s.against === a)) f = Math.min(f, s.scope === "full" ? 0.05 : 0.5);
  }
  for (const bloc of state.alliances) {
    if (bloc.members.length >= WORLD_BODY || !bloc.members.includes(a) || !bloc.members.includes(b)) continue;
    f *= bloc.kind === "trade" ? 1.8 : bloc.kind === "organization" ? 1.3 : 1.15;
  }
  return f;
}

/** Every country's trade this year: totals and its main partners each way. */
export function tradeBooks(state: Pick<GameState, "countries" | "regions" | "wars" | "alliances" | "sanctions" | "scenarioId"> & { deals?: GameState["deals"]; player?: string }, map: Record<string, MapRegion>): Map<string, TradeBook> {
  const at = countryCentres(state, map);
  const tags = Object.keys(state.countries).filter((t) => (state.countries[t].economy?.gdp ?? 0) > 0 && at.has(t));
  const gdp = (t: string) => state.countries[t].economy!.gdp;
  const openness = OPENNESS[state.scenarioId];
  const sizes = tags.map(gdp).sort((a, b) => a - b);
  const median = sizes[Math.floor(sizes.length / 2)] || 1;
  // The United States sells about a tenth of its output abroad, a small island nation half.
  const exportShare = (t: string) => openness * Math.min(2.2, Math.max(0.45, (gdp(t) / median) ** -0.12));
  // weight[i][j]: how much of i's exports go to j, before normalising.
  const flows = new Map<string, Map<string, number>>();
  for (const i of tags) {
    const row = new Map<string, number>();
    let total = 0;
    for (const j of tags) {
      if (i === j) continue;
      const w = (gdp(j) ** 0.8 * friction(state, i, j)) / Math.max(300, distanceKm(at.get(i)!, at.get(j)!)) ** DISTANCE;
      if (w <= 0) continue;
      row.set(j, w);
      total += w;
    }
    const exports = gdp(i) * exportShare(i);
    for (const [j, w] of row) row.set(j, total > 0 ? (exports * w) / total : 0);
    flows.set(i, row);
  }
  // Signed deals are trade on top of the ordinary flow.
  for (const d of state.deals ?? []) {
    if (d.status !== "active" || !state.player) continue;
    const [i, j] = d.side === "sell" ? [state.player, d.partner] : [d.partner, state.player];
    const row = flows.get(i);
    if (row && tags.includes(j)) row.set(j, (row.get(j) ?? 0) + d.value * (1 + d.premium / 100));
  }
  const books = new Map<string, TradeBook>();
  for (const i of tags) books.set(i, { exports: 0, imports: 0, toward: [], from: [] });
  for (const [i, row] of flows) {
    for (const [j, value] of row) {
      const seller = books.get(i)!;
      const buyer = books.get(j)!;
      seller.exports += value;
      buyer.imports += value;
      seller.toward.push({ tag: j, value, share: 0 });
      buyer.from.push({ tag: i, value, share: 0 });
    }
  }
  for (const book of books.values()) {
    const top = (list: Partner[], total: number) =>
      list
        .sort((a, b) => b.value - a.value)
        .slice(0, 8)
        .map((p) => ({ ...p, value: Math.round(p.value * 100) / 100, share: total > 0 ? Math.round((p.value / total) * 1000) / 10 : 0 }));
    book.toward = top(book.toward, book.exports);
    book.from = top(book.from, book.imports);
    book.exports = Math.round(book.exports * 100) / 100;
    book.imports = Math.round(book.imports * 100) / 100;
  }
  return books;
}

/**
 * The share of each country's imports cut off by sanctions: what came from
 * those who sanction it, all of it under full sanctions and half under
 * partial ones, judged on trade as it would be without the sanctions.
 */
export function sanctionCuts(state: Pick<GameState, "countries" | "regions" | "wars" | "alliances" | "sanctions" | "scenarioId">, map: Record<string, MapRegion>): Map<string, number> {
  const out = new Map<string, number>();
  const sanctions = state.sanctions ?? [];
  if (!sanctions.length) return out;
  const free = tradeBooks({ ...state, sanctions: [] }, map);
  for (const target of new Set(sanctions.map((s) => s.against))) {
    const book = free.get(target);
    if (!book || book.imports <= 0) continue;
    let cut = 0;
    for (const s of sanctions.filter((x) => x.against === target)) {
      const p = book.from.find((x) => x.tag === s.by);
      if (p) cut += (p.value / book.imports) * (s.scope === "full" ? 1 : 0.5);
    }
    out.set(target, Math.min(0.9, Math.round(cut * 100) / 100));
  }
  return out;
}

/** Sanctions the turn imposes or lifts, between countries that exist. */
export function applySanctions(next: GameState, changes: z.infer<typeof sanctionsField>, ctx: { to: string }, applied: AppliedChange[]): void {
  let list: Sanction[] = [...(next.sanctions ?? [])];
  for (const c of changes) {
    if (c.by === c.against || !next.countries[c.by] || !next.countries[c.against]) continue;
    const existing = list.find((s) => s.by === c.by && s.against === c.against);
    if (c.lifted) {
      if (!existing) continue;
      list = list.filter((s) => s !== existing);
      applied.push({ kind: "sanction", by: c.by, against: c.against, change: "lifted" });
    } else if (!existing || existing.scope !== c.scope) {
      list = [...list.filter((s) => s !== existing), { by: c.by, against: c.against, scope: c.scope, since: ctx.to }];
      applied.push({ kind: "sanction", by: c.by, against: c.against, change: c.scope });
    }
  }
  next.sanctions = list.length ? list : undefined;
  if (!next.sanctions) delete next.sanctions;
}

/** The player imposes, changes or lifts sanctions on a country, at once. */
export function setSanction(state: GameState, against: string, scope: Sanction["scope"] | null, now = new Date()): GameState {
  const rest = (state.sanctions ?? []).filter((s) => !(s.by === state.player && s.against === against));
  const sanctions = scope ? [...rest, { by: state.player, against, scope, since: state.date }] : rest;
  return { ...state, sanctions, updatedAt: now.toISOString() };
}

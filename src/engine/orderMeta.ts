import { ADVISOR_POST, type AdvisorId } from "./advisors";
import { addDays, addStep, daysBetween } from "./calendar";
import { officialAt } from "./government";
import { ministryTitle, openMinistries } from "./ministries";
import { en } from "./text";
import type { AppliedChange, GameState, OrderMeta, OrderPriority, OrderSpan } from "./types";

/**
 * How an order is to be carried out, beside its words (Artem, 5 November):
 * entrusted to one ministry, kept from others, and how long it runs. The
 * orders stay plain text in the draft and the standing list; their marks are
 * kept beside them by text (`GameState.orderMeta`). An order that runs past
 * this turn stands until its date and then lapses; an order kept from a
 * ministry never reaches its minister – a role sees only what it should know.
 */

/** Spans an order may run for, beside the turn: this turn, a calendar span, or until it is cancelled. */
export const ORDER_SPANS: readonly OrderSpan[] = ["turn", "week", "month", "quarter", "half", "year", "always"];
/** Quick lengths for an order set in days: a week, a month, a quarter, half a year, a year. */
export const QUICK_DAYS = [7, 30, 90, 180, 365] as const;
/** The longest an order may be set to run or wait, in days: ten years. */
export const MAX_ORDER_DAYS = 3650;

/** The marks of one order, if it has any. */
export const metaOf = (state: Pick<GameState, "orderMeta">, order: string): OrderMeta | undefined => state.orderMeta?.[order];

/** The date an order set to run for a span from `date` runs to; none for this turn or until cancelled. */
export function spanEnd(date: string, span: OrderSpan, days?: number): string | undefined {
  if (span === "turn" || span === "always") return undefined;
  if (span === "days") return addDays(date, clampDays(days ?? 1));
  return addStep(date, span);
}

const clampDays = (n: number) => Math.max(1, Math.min(MAX_ORDER_DAYS, Math.round(n)));

/** How long an order runs, as the player set it: this turn, a span with its end, or until cancelled. */
export function spanOf(state: Pick<GameState, "orderMeta" | "standing">, order: string): OrderSpan {
  const m = metaOf(state, order);
  if (m?.until) return m.span ?? "month";
  return (state.standing ?? []).includes(order) ? "always" : "turn";
}

/** The days an order runs for as the dialog shows them: set in days, or the length of its older span. */
export function daysOf(state: Pick<GameState, "orderMeta" | "date">, order: string): number {
  const m = metaOf(state, order);
  if (m?.days) return m.days;
  if (m?.until) return Math.max(1, daysBetween(m.from ?? state.date, m.until));
  return 30;
}

/** Whether an order waits for a later turn: it begins on a date this turn does not reach. */
export const waiting = (state: Pick<GameState, "orderMeta" | "date" | "step">, order: string): boolean => {
  const from = metaOf(state, order)?.from;
  return Boolean(from && from >= addStep(state.date, state.step));
};

/** The orders a turn is given: those that have begun – an order set to begin later waits in the list, untold. */
export const startedOrders = (state: Pick<GameState, "orderMeta" | "date" | "step">, orders: string[]): string[] => orders.filter((o) => !waiting(state, o));

/** Turns still to come for an order that runs to `until`, this one included: the turns that begin before it. */
export function turnsLeft(state: Pick<GameState, "date" | "step">, until: string): number {
  let n = 0;
  for (let d = state.date; d < until && n < 1000; d = addStep(d, state.step)) n += 1;
  return n;
}

const clean = (m: OrderMeta): OrderMeta | undefined => {
  const out: OrderMeta = {};
  if (m.to) out.to = m.to;
  if (m.hiddenFrom?.length) out.hiddenFrom = [...new Set(m.hiddenFrom)];
  if (m.until) {
    out.until = m.until;
    if (m.span) out.span = m.span;
    if (m.span === "days" && m.days) out.days = m.days;
  }
  if (m.priority) out.priority = m.priority;
  if (m.secret) out.secret = true;
  if (m.from) out.from = m.from;
  return Object.keys(out).length ? out : undefined;
};

const withMeta = (all: GameState["orderMeta"], order: string, m: OrderMeta | undefined): GameState["orderMeta"] => {
  const next = { ...(all ?? {}) };
  if (m) next[order] = m;
  else delete next[order];
  return Object.keys(next).length ? next : undefined;
};

const put = (state: GameState, orderMeta: GameState["orderMeta"]): GameState => {
  const out = { ...state };
  if (orderMeta) out.orderMeta = orderMeta;
  else delete out.orderMeta;
  return out;
};

/** What the order's settings pop-up hands back (components/game/OrderModifiers.tsx). */
export interface OrderChange {
  to?: AdvisorId | null;
  hiddenFrom?: AdvisorId[];
  span: OrderSpan;
  /** With span "days": how many it runs for. */
  days?: number;
  priority?: OrderPriority | null;
  secret?: boolean;
  /** Days from now it begins in; none or 0 for this turn. */
  startIn?: number;
}

/**
 * Sets how an order is carried out: the ministry entrusted with it (an open one), those it is kept from (open ones,
 * never the one entrusted), how pressing and how secret it is, when it begins and how long it runs. This turn only
 * keeps it in the draft; a later start, a span or "until cancelled" makes it a standing order – from its start to its
 * end date, or for good. The order keeps its place in the limit of orders a turn.
 */
export function modifyOrder(state: GameState, order: string, change: OrderChange, now = new Date()): GameState {
  const inDraft = state.draft.includes(order);
  const inStanding = (state.standing ?? []).includes(order);
  if (!inDraft && !inStanding) return state;
  const open = new Set(openMinistries(state));
  const to = change.to && open.has(change.to) ? change.to : undefined;
  const hiddenFrom = (change.hiddenFrom ?? []).filter((id) => open.has(id) && id !== to);
  const from = change.startIn && change.startIn > 0 ? addDays(state.date, clampDays(change.startIn)) : undefined;
  const start = from ?? state.date;
  // An order that waits for a later turn and runs one turn there stands until the day after its start.
  const span: OrderSpan = from && change.span === "turn" ? "days" : change.span;
  const days = span === "days" ? clampDays(from && change.span === "turn" ? 1 : (change.days ?? 1)) : undefined;
  const until = spanEnd(start, span, days);
  const meta = clean({ to, hiddenFrom, until, span: until ? span : undefined, days, priority: change.priority ?? undefined, secret: change.secret, from });
  const standingNow = span !== "turn";
  const draft = standingNow ? state.draft.filter((o) => o !== order) : inDraft ? state.draft : [...state.draft, order];
  const standing = standingNow ? (inStanding ? (state.standing ?? []) : [...(state.standing ?? []), order]) : (state.standing ?? []).filter((o) => o !== order);
  const out = put({ ...state, draft, updatedAt: now.toISOString() }, withMeta(state.orderMeta, order, meta));
  if (standing.length) out.standing = standing;
  else delete out.standing;
  return out;
}

/**
 * The marks follow the orders as the player edits them: an order rewritten in its place keeps its marks under its new
 * words; an order no longer in the draft or the standing list loses them, and one unpinned from the standing list no
 * longer runs to a date.
 */
export function carryOrderMeta(before: GameState, after: GameState): GameState {
  if (!before.orderMeta) return after;
  let meta: GameState["orderMeta"] = { ...before.orderMeta };
  const rename = (a: string[], b: string[]) => {
    if (a.length !== b.length) return;
    a.forEach((o, i) => {
      if (o !== b[i] && meta?.[o] && !a.includes(b[i])) {
        meta = { ...meta, [b[i]]: meta[o] };
        delete meta[o];
      }
    });
  };
  rename(before.draft, after.draft);
  rename(before.standing ?? [], after.standing ?? []);
  const standing = new Set(after.standing ?? []);
  const live = new Set([...after.draft, ...standing]);
  for (const [order, m] of Object.entries(meta)) {
    if (!live.has(order)) delete meta[order];
    else if (m.until && !standing.has(order)) meta[order] = clean({ ...m, until: undefined, span: undefined })!;
    if (meta[order] === undefined) delete meta[order];
  }
  return put(after, Object.keys(meta).length ? meta : undefined);
}

/** Whether an order is kept from one of these ministries. */
export const keptFrom = (state: Pick<GameState, "orderMeta">, order: string, ministries: readonly AdvisorId[]): boolean => Boolean(metaOf(state, order)?.hiddenFrom?.some((id) => ministries.includes(id)));

/** The orders one or more ministries may know of: those kept from none of them. */
export const visibleOrders = (state: Pick<GameState, "orderMeta">, orders: string[], ministries: readonly AdvisorId[]): string[] => (ministries.length ? orders.filter((o) => !keptFrom(state, o, ministries)) : orders);

/** A ministry's name for the game master, in English. */
const ministryName = (state: GameState, id: AdvisorId) => en(ministryTitle(state, id));

/** An order's marks for the game master, in brackets before its words; nothing for an order without them. */
export function orderMarks(state: GameState, order: string): string {
  const m = metaOf(state, order);
  if (!m) return "";
  const parts: string[] = [];
  if (m.to) {
    const o = officialAt(state, ADVISOR_POST[m.to]);
    parts.push(`entrusted to the ${ministryName(state, m.to)}${o ? ` (${o.name}, competence ${o.competence}/5, loyalty ${o.loyalty}/5)` : " (its post is empty)"}`);
  }
  if (m.hiddenFrom?.length) parts.push(`kept from the ${m.hiddenFrom.map((id) => ministryName(state, id)).join(", the ")}`);
  if (m.priority) parts.push(m.priority === "urgent" ? "URGENT: carried out first, whatever it takes from other business" : "important: given more than ordinary attention and means");
  if (m.secret) parts.push("secret: done quietly, kept from the press, the public and foreign governments – a leak only by a disloyal hand");
  if (m.from) parts.push(`began on ${m.from}`);
  if (m.until) {
    const left = turnsLeft(state, m.until);
    parts.push(`runs until ${m.until}, ${left} turn${left === 1 ? "" : "s"} left`);
  }
  return parts.length ? `[${parts.join("; ")}] ` : "";
}

/**
 * The ministry that carried out each order, as the engine has it: an order entrusted to a ministry was its, whoever
 * the story named – so a ministry that drags its feet marks down what it was entrusted with (engine/intrigue.ts).
 */
export function entrust<T extends { n: number; by?: AdvisorId }>(state: Pick<GameState, "orderMeta">, orders: string[] | undefined, verdicts: T[]): T[] {
  if (!orders || !state.orderMeta) return verdicts;
  return verdicts.map((v) => {
    const to = metaOf(state, orders[v.n - 1] ?? "")?.to;
    return to ? { ...v, by: to } : v;
  });
}

/** What the marks mean, said once under the orders when any order has them. */
export const ORDER_MARKS_NOTE =
  "Marks in brackets: an order entrusted to a ministry is carried out by that ministry – judge how well by its minister's competence and loyalty, and name that ministry as the one that carried it out; an order kept from ministries is unknown to their ministers – they neither report on it nor learn of it in the story; an urgent order comes first and an important one before the ordinary, and what they take shows elsewhere; a secret order is done quietly – the press and other governments learn of it only through a leak, and its results show only where they must; an order that runs until a date stands every turn until then.";

/**
 * At the turn's end, a standing order whose date has come lapses: it leaves the standing list with its marks, and the
 * turn's record says so. Marks of orders no longer given go too. Mutates `next`.
 */
export function lapseOrders(next: GameState, applied: AppliedChange[]): void {
  const meta = next.orderMeta;
  if (!meta) return;
  const ended = (next.standing ?? []).filter((o) => meta[o]?.until && meta[o].until! <= next.date);
  if (ended.length) {
    next.standing = (next.standing ?? []).filter((o) => !ended.includes(o));
    if (!next.standing.length) delete next.standing;
    for (const order of ended) applied.push({ kind: "order-lapsed", order });
  }
  const live = new Set([...next.draft, ...(next.standing ?? [])]);
  const kept = Object.fromEntries(Object.entries(meta).filter(([o]) => live.has(o) && !ended.includes(o)));
  if (Object.keys(kept).length) next.orderMeta = kept;
  else delete next.orderMeta;
}

/** The marks of the orders a turn was given, for its chronicle entry: what was kept from whom stays known. */
export function marksOfTurn(state: Pick<GameState, "orderMeta">, orders: string[]): Record<string, OrderMeta> | undefined {
  const out = Object.fromEntries(orders.flatMap((o) => (state.orderMeta?.[o] ? [[o, state.orderMeta[o]]] : [])));
  return Object.keys(out).length ? out : undefined;
}

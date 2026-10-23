import { addAdvice, type AdviceMessage, type AdviceProposal, type AdviceReply, type AdvisorId } from "./advisors";
import { availableKinds, setFocus } from "./arsenal";
import { type BudgetProposal, sanitizeBudgetProposal } from "./budgetAdvice";
import { setBudget } from "./economy";
import { normalizeShares, setShares, startingResearch } from "./research";
import { RESEARCH_DIRECTIONS, WEAPON_KINDS, type GameState, type ResearchDirection, type WeaponKind } from "./types";

/**
 * Ministers who change something in the game when the leader asks them to:
 * the science minister proposes a split of the research money, the general
 * staff what industry builds first for the army (and the economy minister a
 * budget, engine/budgetAdvice.ts). The model proposes it in the answer, the
 * engine keeps only what that minister may propose and what differs from
 * today, and nothing changes until the leader applies it – when it is
 * checked again against the state as it is then.
 */
export const PROPOSALS: Partial<Record<AdvisorId, keyof AdviceProposal>> = { science: "research", military: "focus" };

/** How many orders a minister drafts at once, and how long one may be. */
export const DRAFTED_ORDERS = 2;
export const DRAFTED_CHARS = 300;

/**
 * Orders a minister drafted because the leader asked: trimmed, each at most
 * DRAFTED_CHARS, without repeats or what the turn's orders already hold, at
 * most DRAFTED_ORDERS. The player adds them to the turn, or not.
 */
export function sanitizeOrders(state: Pick<GameState, "draft">, raw: readonly unknown[] | undefined): string[] {
  if (!raw) return [];
  const seen = new Set(state.draft.map((o) => o.replace(/\s+/g, " ").trim().toLowerCase()));
  const out: string[] = [];
  for (const line of raw) {
    if (typeof line !== "string") continue;
    const order = line.replace(/\s+/g, " ").trim().slice(0, DRAFTED_CHARS).trim();
    const key = order.toLowerCase();
    if (!order || seen.has(key)) continue;
    seen.add(key);
    out.push(order);
    if (out.length === DRAFTED_ORDERS) break;
  }
  return out;
}

const sameKinds = (a: readonly WeaponKind[], b: readonly WeaponKind[]) => a.length === b.length && a.every((k) => b.includes(k));

/** A minister's proposal checked against the state: their own field only, valid, and a change. */
export function sanitizeProposal(state: GameState, advisor: AdvisorId, raw: AdviceReply["proposal"] | AdviceProposal | undefined): AdviceProposal | undefined {
  if (!raw) return undefined;
  const field = PROPOSALS[advisor];
  if (field === "research" && raw.research) {
    const now = state.research?.shares ?? startingResearch(state).shares;
    // A direction the minister leaves out keeps its share; the split is then made whole.
    const named = Object.entries(raw.research).filter(([d, v]) => (RESEARCH_DIRECTIONS as readonly string[]).includes(d) && typeof v === "number" && Number.isFinite(v) && v >= 0);
    if (!named.length) return undefined;
    const shares = normalizeShares({ ...now, ...(Object.fromEntries(named) as Partial<Record<ResearchDirection, number>>) });
    return RESEARCH_DIRECTIONS.every((d) => shares[d] === now[d]) ? undefined : { research: shares };
  }
  if (field === "focus" && raw.focus) {
    const arsenal = state.countries[state.player]?.arsenal;
    if (!arsenal) return undefined;
    const can = new Set(availableKinds(state));
    const named: readonly string[] = raw.focus;
    const focus: WeaponKind[] = [...new Set(named.filter((k): k is WeaponKind => (WEAPON_KINDS as readonly string[]).includes(k) && can.has(k as WeaponKind)))].slice(0, 2);
    return sameKinds(focus, arsenal.focus ?? []) ? undefined : { focus };
  }
  return undefined;
}

/** A question and the minister's answer in the conversation, with the proposal and the drafted orders the engine keeps. */
export function takeAdvice(state: GameState, advisor: AdvisorId, question: string, reply: AdviceReply, now = new Date()): GameState {
  const next = addAdvice(state, advisor, question, reply, now);
  const proposal = sanitizeProposal(state, advisor, reply.proposal);
  const orders = sanitizeOrders(state, reply.orders);
  const thread = next.advice?.[advisor];
  if ((!proposal && !orders.length) || !thread?.length) return next;
  const extra = { ...(proposal ? { proposal } : {}), ...(orders.length ? { orders } : {}) };
  return { ...next, advice: { ...next.advice, [advisor]: thread.map((m, i) => (i === thread.length - 1 ? { ...m, ...extra } : m)) } };
}

/**
 * What a minister's message would still change if applied now: its proposal
 * or budget checked again against the state as it is (the split, what the
 * country can build, the limits of a budget change). Null when nothing is
 * left to apply: none was proposed, it was applied, or it is in force already.
 */
export function pendingProposal(state: GameState, advisor: AdvisorId, message: AdviceMessage | undefined): { proposal?: AdviceProposal; budget?: BudgetProposal } | null {
  if (!message || message.from !== "advisor" || message.applied) return null;
  const proposal = sanitizeProposal(state, advisor, message.proposal);
  const economy = state.countries[state.player]?.economy;
  const budget = advisor === "finance" && message.budget && economy ? sanitizeBudgetProposal(economy, { ...message.budget, reason: message.budget.reason ?? "" }) : null;
  if (!proposal && !budget) return null;
  return { ...(proposal ? { proposal } : {}), ...(budget ? { budget } : {}) };
}

/**
 * The leader applies a minister's proposal, message `at` of their
 * conversation: checked again against the state as it is now, applied
 * through the engine, and marked so it is applied once. Nothing happens
 * when nothing is left to apply.
 */
export function applyProposal(state: GameState, advisor: AdvisorId, at: number, now = new Date()): GameState {
  const thread = state.advice?.[advisor];
  const pending = pendingProposal(state, advisor, thread?.[at]);
  if (!thread || !pending) return state;
  let next = state;
  if (pending.proposal?.research) next = setShares(next, pending.proposal.research);
  if (pending.proposal?.focus) next = setFocus(next, pending.proposal.focus, now);
  if (pending.budget) {
    const { revenue, army, industry, social, other } = pending.budget;
    next = setBudget(next, { revenue, army, industry, social, other }, now);
  }
  return { ...next, advice: { ...next.advice, [advisor]: thread.map((m, i) => (i === at ? { ...m, applied: true } : m)) }, updatedAt: now.toISOString() };
}

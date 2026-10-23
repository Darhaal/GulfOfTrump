import { z } from "zod";
import { limitChange } from "./economy";
import type { Budget, Economy } from "./types";

/**
 * The economy minister's budget proposal. In an answer to the government
 * (engine/advisors.ts) the finance minister may propose new figures for the
 * budget's lines with a reason; the engine bounds them here, the proposal is
 * kept on the conversation, and the player applies it to the budget fields
 * or not – the decision stays theirs.
 */

/** The widest deficit a minister may propose, as a share of GDP, unless the country already runs a wider one. */
export const ADVICE_DEFICIT = 0.06;

const figure = z.number().finite().optional().catch(undefined);

/** A budget as the model proposes it (merged into AdviceSchema as `budget`). */
export const budgetProposalField = z
  .object({ revenue: figure, army: figure, industry: figure, social: figure, other: figure, reason: z.string().trim().max(400).catch("").default("") })
  .optional()
  .catch(undefined);

export type BudgetProposalReply = NonNullable<z.infer<typeof budgetProposalField>>;

/** A proposal the engine has checked: every line of the budget, and why. */
export interface BudgetProposal extends Budget {
  reason?: string;
}

const LINES = ["revenue", "army", "industry", "social", "other"] as const;
const round = (v: number) => Math.round(v * 100) / 100;

/**
 * A proposal held to what the country can do: the engine's limits on a
 * budget change (no line more than triples, taxes below 70% of GDP, nothing
 * below zero), a line left out stays as it is, and a deficit wider than
 * ADVICE_DEFICIT of GDP – or today's, if that is wider – trims every
 * spending line in proportion. Null when it changes nothing.
 */
export function sanitizeBudgetProposal(economy: Economy, proposal: BudgetProposalReply): BudgetProposal | null {
  if (LINES.every((line) => proposal[line] === undefined)) return null;
  const limited = limitChange({ country: "", revenue: proposal.revenue, army: proposal.army, industry: proposal.industry, social: proposal.social, other: proposal.other }, economy);
  const now = economy.budget;
  const out: Budget = {
    revenue: limited.revenue ?? now.revenue,
    army: limited.army ?? now.army,
    industry: limited.industry ?? now.industry,
    social: limited.social ?? now.social,
    other: limited.other ?? now.other,
  };
  const spending = (b: Budget) => b.army + b.industry + b.social + b.other;
  const allowed = Math.max(spending(now) - now.revenue, ADVICE_DEFICIT * economy.gdp);
  const spend = spending(out);
  if (spend > 0 && spend - out.revenue > allowed) {
    const k = Math.max(0, (out.revenue + allowed) / spend);
    for (const line of ["army", "industry", "social", "other"] as const) out[line] *= k;
  }
  for (const line of LINES) out[line] = round(out[line]);
  if (LINES.every((line) => Math.abs(out[line] - now[line]) < 0.005)) return null;
  return { ...out, ...(proposal.reason ? { reason: proposal.reason } : {}) };
}

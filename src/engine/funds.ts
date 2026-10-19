import { z } from "zod";
import type { AppliedChange, GameState } from "./types";

/**
 * Money that changes hands: grants, loans, aid, reparations, bribes, and
 * arms given in kind. When the game master writes that a government or a
 * lender pays, the money arrives: the receiver's reserves grow (and its
 * debt, for a loan), the giver's shrink — borrowed if its reserves cannot
 * cover it. An organisation (the IMF, a bloc) pays from nobody's books.
 */

export const FUND_KINDS = ["grant", "loan", "aid", "arms", "reparations", "bribe"] as const;
export type FundKind = (typeof FUND_KINDS)[number];

/** Lenders that are not countries in the game. */
export const INSTITUTIONS = ["imf", "world-bank", "lenders", "banks"] as const;

const tag = z.string().trim().min(1).max(80);

export const fundsField = z
  .array(
    z.object({
      from: tag,
      to: tag,
      // $bn, paid in this period.
      amount: z.number().finite(),
      kind: z.enum(FUND_KINDS).catch("grant").default("grant"),
      note: z.string().trim().max(300).default(""),
    }),
  )
  .max(16)
  .default([]);

export type RawFund = z.infer<typeof fundsField>[number];

const round = (v: number) => Math.round(v * 100) / 100;

/** The transfers that point at a payer and a receiver the game knows, at a size the two can bear. */
export function keepFunds(state: GameState, raw: RawFund[]): RawFund[] {
  const payer = (from: string) =>
    Boolean(state.countries[from]?.economy) || state.alliances.some((a) => a.id === from) || (INSTITUTIONS as readonly string[]).includes(from);
  return raw
    .filter((f) => f.from !== f.to && payer(f.from) && state.countries[f.to]?.economy && f.amount > 0)
    .map((f) => {
      const to = state.countries[f.to].economy!;
      const from = state.countries[f.from]?.economy;
      // No more than half the receiver's output in one period, nor more than a tenth of the giver's.
      const cap = Math.min(to.gdp * 0.5, from ? from.gdp * 0.1 : to.gdp * 0.5);
      return { ...f, amount: round(Math.min(f.amount, cap)) };
    })
    .filter((f) => f.amount >= 0.01);
}

/** The money moves; every transfer goes into the chronicle. */
export function applyFunds(next: GameState, funds: RawFund[], applied: AppliedChange[]): void {
  for (const f of funds) {
    const to = next.countries[f.to]?.economy;
    if (!to) continue;
    const from = next.countries[f.from]?.economy;
    // Arms in kind come out of the giver's stores and arrive as weapons, not money.
    if (f.kind !== "arms") {
      to.reserves = round(to.reserves + f.amount);
      if (f.kind === "loan") to.debt = round(to.debt + f.amount);
      if (from) {
        const paid = Math.min(from.reserves, f.amount);
        from.reserves = round(from.reserves - paid);
        from.debt = round(from.debt + (f.amount - paid));
      }
    }
    applied.push({ kind: "funds", from: f.from, to: f.to, amount: f.amount, type: f.kind, ...(f.note ? { note: f.note } : {}) });
  }
}

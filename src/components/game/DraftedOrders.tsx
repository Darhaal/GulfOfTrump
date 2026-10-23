"use client";

import { Check, Plus } from "lucide-react";
import { MAX_ORDERS } from "@/constants/app";
import type { GameState } from "@/engine/types";
import { useI18n } from "@/i18n/useI18n";

/** Whether the turn has room for another order: its draft and standing orders count. */
export const ordersFull = (state: Pick<GameState, "draft" | "standing">) => state.draft.length + (state.standing?.length ?? 0) >= MAX_ORDERS;

/**
 * Orders a minister drafted because the leader asked for them, each one
 * click from the turn's orders as it is; there the player can still edit or
 * remove it.
 */
export default function DraftedOrders({ orders, state, disabled, onAdd }: { orders: string[]; state: Pick<GameState, "draft" | "standing">; disabled: boolean; onAdd: (order: string) => void }) {
  const { t } = useI18n();
  const full = ordersFull(state);
  return (
    <div className="mt-2 grid gap-1.5">
      <div className="text-2xs font-black uppercase tracking-widest text-muted">{t("advisor.orders")}</div>
      {orders.map((order) => {
        const added = state.draft.includes(order);
        return (
          <div key={order} className="flex items-start gap-2 rounded-lg border border-line bg-surface px-2.5 py-1.5">
            <span className="min-w-0 flex-1 text-xs font-semibold text-ink">{order}</span>
            <button
              type="button"
              disabled={added || full || disabled}
              onClick={() => onAdd(order)}
              title={t(added ? "advisor.added" : "advisor.addOrder")}
              aria-label={t(added ? "advisor.added" : "advisor.addOrder")}
              className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-line bg-surface text-muted transition-colors hover:text-accent disabled:opacity-60"
            >
              {added ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Plus className="h-3.5 w-3.5" />}
            </button>
          </div>
        );
      })}
    </div>
  );
}

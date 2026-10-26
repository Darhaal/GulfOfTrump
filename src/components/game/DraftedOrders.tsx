"use client";

import { Plus } from "lucide-react";
import { ui } from "@/components/ui/classes";
import DoneButton from "@/components/ui/DoneButton";
import { MAX_ORDERS } from "@/constants/app";
import type { GameState } from "@/engine/types";
import { useI18n } from "@/i18n/useI18n";

/** Whether the turn has room for another order: its draft and standing orders count. */
export const ordersFull = (state: Pick<GameState, "draft" | "standing">) => state.draft.length + (state.standing?.length ?? 0) >= MAX_ORDERS;

/**
 * Orders a minister drafted because the leader asked for them, each one
 * click from the turn's orders as it is ("In orders" once there); there the
 * player can still edit or remove it, and the button comes back.
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
          <div key={order} className="relative flex items-start gap-2 rounded-lg border border-line bg-surface px-2.5 py-1.5">
            <span className="min-w-0 flex-1 text-xs font-semibold text-ink">{order}</span>
            <DoneButton
              compact
              icon={Plus}
              label={t("advisor.addOrder")}
              hint={full && !added ? t("game.orders.limit", { n: MAX_ORDERS }) : undefined}
              doneLabel={t("done.inOrders")}
              done={added}
              disabled={full || disabled}
              onAct={() => onAdd(order)}
              className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-line bg-surface text-muted transition-colors hover:text-accent disabled:cursor-not-allowed disabled:text-faded"
              doneClassName={`${ui.done} h-6 shrink-0 gap-1 rounded-md px-1.5 text-2xs uppercase tracking-wider`}
            />
          </div>
        );
      })}
    </div>
  );
}

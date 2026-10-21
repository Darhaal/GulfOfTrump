"use client";

import { Check, Megaphone, Plus, ShieldAlert } from "lucide-react";
import { personName } from "@/engine/people";
import { canRise, movementRisk } from "@/engine/role";
import { RISE_HOWS, type GameState, type MovementScore } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import { ui } from "@/components/ui/classes";
import Portrait from "./Portrait";

/** The actions the panel offers, each an order the player adds to the turn. */
const ACTIONS = ["rally", "press", "coalition", "insiders", "army", "abroad", "strike", "election"] as const;

const SCORES: MovementScore[] = ["money", "press", "insiders", "army", "street"];

/**
 * The player's opposition: who they are, their party or movement, its
 * strength and the danger it is in, actions to add to the turn, and the ways
 * to power with how close it is to each (engine/role.ts).
 */
export default function OppositionPanel({ state, disabled, onOrder }: { state: GameState; disabled: boolean; onOrder: (order: string) => void }) {
  const { t, locale } = useI18n();
  const role = state.role;
  const m = role?.movement;
  if (!role || !m) return null;
  const name = role.person ? personName(role.person, locale) : t("role.opposition");
  const risk = movementRisk(state);
  const bar = (value: number, tone = "bg-accent") => (
    <div className="h-1.5 overflow-hidden rounded-full bg-divider">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <section className={`${ui.card} flex items-center gap-3 p-3`}>
        <Portrait portrait={role.person?.portrait} gender={role.person?.gender} name={name} size="xl" />
        <div className="min-w-0">
          <div className="truncate text-sm font-black text-ink">{name}</div>
          <div className="truncate text-xs font-bold text-muted">{m.name ?? t("role.movementUnnamed")}</div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            <span className="rounded-md bg-page px-1.5 py-0.5 text-2xs font-black text-ink">{t(`movement.kind.${m.kind}` as MessageKey)}</span>
            <span className={`rounded-md px-1.5 py-0.5 text-2xs font-black ${m.status === "free" ? "bg-page text-ink" : "bg-red-50 text-red-700"}`}>{t(`movement.status.${m.status}` as MessageKey)}</span>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between text-xs">
          <span className="font-bold text-muted">{t("movement.support")}</span>
          <span className="font-black tabular-nums text-ink">{m.support}%</span>
        </div>
        {bar(m.support)}
        <div className="flex items-baseline justify-between text-xs">
          <span className="font-bold text-muted">{t("movement.members")}</span>
          <span className="font-black tabular-nums text-ink">{t("movement.thousands", { n: m.members.toLocaleString(locale) })}</span>
        </div>
        {SCORES.map((k) => (
          <div key={k} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-bold text-muted">{t(`movement.${k}` as MessageKey)}</span>
              <span className="font-black tabular-nums text-ink">{m[k]}</span>
            </div>
            {bar(m[k])}
          </div>
        ))}
      </section>

      <section className="rounded-2xl bg-page p-3">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 font-black text-ink">
            <ShieldAlert className="h-3.5 w-3.5 text-red-600" />
            {t("movement.risk")}
          </span>
          <span className="font-black tabular-nums text-red-600">{risk}%</span>
        </div>
        <p className="mt-1 text-2xs font-medium leading-snug text-muted">{t("movement.riskNote", { n: risk })}</p>
      </section>

      <section>
        <div className={`${ui.label} mb-1`}>{t("movement.actions")}</div>
        <p className="mb-2 text-2xs font-medium text-muted">{t("movement.actionsNote")}</p>
        <div className="flex flex-col gap-1.5">
          {ACTIONS.filter((a) => a !== "election" || m.kind === "party").map((a) => (
            <button key={a} type="button" disabled={disabled} onClick={() => onOrder(t(`movement.action.${a}` as MessageKey))} className={`${ui.secondary} justify-start px-3 py-2 text-left text-xs`}>
              <Plus className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 flex-1">{t(`movement.action.${a}` as MessageKey)}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className={`${ui.label} mb-2 flex items-center gap-1.5`}>
          <Megaphone className="h-3.5 w-3.5" />
          {t("movement.rise")}
        </div>
        <ul className="flex flex-col gap-1.5">
          {RISE_HOWS.map((how) => {
            const near = canRise(state, how, { election: true });
            return (
              <li key={how} className="flex items-start gap-2 text-xs font-medium leading-snug">
                <Check className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${near ? "text-accent" : "text-divider"}`} />
                <span className={near ? "text-ink" : "text-muted"}>{t(`movement.rise.${how}` as MessageKey)}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="text-2xs font-medium leading-snug text-muted">{t("movement.readOnly")}</p>
    </div>
  );
}

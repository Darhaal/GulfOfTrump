"use client";

import { Briefcase, Check, Plus, Shield, ShieldAlert, TrendingUp } from "lucide-react";
import DoneButton from "@/components/ui/DoneButton";
import { ui } from "@/components/ui/classes";
import { MAX_ORDERS } from "@/constants/app";
import { ADVISOR_TITLES } from "@/engine/advisors";
import { deathRisk } from "@/engine/fate";
import { approvalChance, canFigureRise, commandTroops, dismissalRisk, ministryOf, ownFormation, standingOf, toppleChance } from "@/engine/figures";
import { leaderOf, personName } from "@/engine/people";
import type { GameState } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import { ordersFull } from "./DraftedOrders";
import Portrait, { ARCH } from "./Portrait";
import ResignButton from "./ResignButton";

const GENERAL_ACTIONS = ["attack", "hold", "reinforce", "officers", "coup"] as const;

/**
 * The player as a minister or a general (engine/figures.ts), in the manner of
 * the opposition's panel: who they are and whom they serve, their standing,
 * how often the government takes up their orders and how close they are to
 * dismissal, actions to add to the turn, the ways up, and resignation.
 */
export default function FigurePanel({ state, disabled, onOrder, onResign, onStay }: { state: GameState; disabled: boolean; onOrder: (order: string) => void; onResign: () => void; onStay: () => void }) {
  const { t, text, locale } = useI18n();
  const role = state.role;
  if (!role || (role.kind !== "minister" && role.kind !== "general")) return null;
  const general = role.kind === "general";
  const ministry = role.post ? ministryOf(role.post) : undefined;
  const name = role.person ? personName(role.person, locale) : t("figure.unnamed");
  const post = general ? t(`figure.scope.${role.command?.scope ?? "front"}` as MessageKey) : ministry ? text(ADVISOR_TITLES[ministry]) : "";
  const leader = leaderOf(state, state.player);
  const s = standingOf(role);
  const approval = Math.round(approvalChance(state) * 100);
  const dismissal = dismissalRisk(state);
  const death = deathRisk(state);
  const topple = Math.round(toppleChance(state) * 100);
  const formation = ownFormation(state);
  const full = ordersFull(state);
  const actions = general ? GENERAL_ACTIONS.map((a) => `figure.action.${a}`) : [...(ministry ? [`figure.action.${ministry}`] : []), "figure.action.favour", "figure.action.budget"];
  const rises = general ? (["appointed", "coup"] as const) : (["appointed", "cabinet"] as const);
  const bar = (value: number) => (
    <div className="h-1.5 overflow-hidden rounded-full bg-divider">
      <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
    </div>
  );
  const Icon = general ? Shield : Briefcase;

  return (
    <div className="flex flex-col gap-4">
      <section className={`${ui.card} flex items-center gap-3 p-3`}>
        {/* A portrait only of the person themselves; someone without one has none. */}
        {role.person?.portrait ? (
          <Portrait portrait={role.person.portrait} gender={role.person.gender} name={name} size="xl" />
        ) : (
          <div className={`grid h-[120px] w-24 shrink-0 place-items-center border border-line/50 bg-page ${ARCH}`}>
            <Icon className="h-8 w-8 text-muted" />
          </div>
        )}
        <div className="min-w-0">
          <div className="truncate text-sm font-black text-ink">{name}</div>
          <div className="text-xs font-bold leading-snug text-muted">{post}</div>
          {general && role.command?.scope === "front" && <div className="truncate text-xs font-bold text-muted">{role.command.name ?? t("figure.frontUnnamed")}</div>}
          {leader && <div className="mt-1.5 truncate text-2xs font-medium text-muted">{t("figure.under", { name: personName(leader, locale) })}</div>}
        </div>
      </section>

      <section className="flex flex-col gap-2.5">
        {(
          [
            ["influence", "figure.influence"],
            ["means", general ? "figure.means.general" : "figure.means.minister"],
            ["loyalty", general ? "figure.loyalty.general" : "figure.loyalty.minister"],
          ] as const
        ).map(([k, label]) => (
          <div key={k} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-bold text-muted">{t(label)}</span>
              <span className="font-black tabular-nums text-ink">{s[k]}</span>
            </div>
            {bar(s[k])}
          </div>
        ))}
        {general && (
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="font-bold text-muted">{t("figure.troops")}</span>
            <span className="text-right font-black tabular-nums text-ink">
              {t("figure.troopsValue", { n: commandTroops(state).toLocaleString(locale) })}
              {formation && <span className="block text-2xs font-medium text-muted">{t("figure.formation", { name: formation.name, n: formation.divisions })}</span>}
            </span>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2 rounded-2xl bg-page p-3">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 font-black text-ink">
            <Check className="h-3.5 w-3.5 text-accent" />
            {t(general ? "figure.approval.general" : "figure.approval.minister")}
          </span>
          <span className="font-black tabular-nums text-ink">{approval}%</span>
        </div>
        <p className="text-2xs font-medium leading-snug text-muted">{t("figure.approvalNote", { n: approval })}</p>
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 font-black text-ink">
            <ShieldAlert className="h-3.5 w-3.5 text-red-600" />
            {t("figure.dismissal")}
          </span>
          <span className="font-black tabular-nums text-red-600">{dismissal}%</span>
        </div>
        <p className="text-2xs font-medium leading-snug text-muted">{t("figure.dismissalNote", { n: dismissal })}</p>
        <div className="flex items-center justify-between text-xs">
          <span className="font-black text-ink">{t("figure.death")}</span>
          <span className="font-black tabular-nums text-ink">{death}%</span>
        </div>
        <p className="text-2xs font-medium leading-snug text-muted">{t("figure.deathNote", { n: death })}</p>
      </section>

      <section>
        <div className={`${ui.label} mb-1`}>{t("movement.actions")}</div>
        <p className="mb-2 text-2xs font-medium text-muted">{t("movement.actionsNote")}</p>
        <div className="relative flex flex-col gap-1.5">
          {actions.map((key) => {
            const order = t(key as MessageKey);
            const done = state.draft.includes(order);
            return (
              <DoneButton
                key={key}
                keepLabel
                icon={Plus}
                label={order}
                doneLabel={t("done.inOrders")}
                done={done}
                disabled={disabled || full}
                hint={full && !done ? t("game.orders.limit", { n: MAX_ORDERS }) : undefined}
                onAct={() => onOrder(order)}
                className={`${ui.secondary} justify-start px-3 py-2 text-left text-xs`}
                doneClassName={`${ui.done} gap-2 rounded-xl px-3 py-2 text-left text-xs`}
              />
            );
          })}
        </div>
      </section>

      <section>
        <div className={`${ui.label} mb-2 flex items-center gap-1.5`}>
          <TrendingUp className="h-3.5 w-3.5" />
          {t("figure.rise")}
        </div>
        <ul className="flex flex-col gap-1.5">
          {rises.map((how) => {
            const near = canFigureRise(state, how);
            return (
              <li key={how} className="flex items-start gap-2 text-xs font-medium leading-snug">
                <Check className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${near ? "text-accent" : "text-divider"}`} />
                <span className={near ? "text-ink" : "text-muted"}>{t(`figure.rise.${how}` as MessageKey, { n: topple })}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <ResignButton
        resigning={Boolean(role.resigning)}
        disabled={disabled}
        label={t("figure.resign")}
        body={role.kind === "minister" ? t("figure.resign.minister", { n: topple }) : t("figure.resign.other")}
        onResign={onResign}
        onStay={onStay}
      />

      <p className="text-2xs font-medium leading-snug text-muted">{t("figure.readOnly")}</p>
    </div>
  );
}

"use client";

import { Check, Home, Mail, Megaphone, Plane, Plus, ShieldAlert } from "lucide-react";
import { useState } from "react";
import Dialog from "@/components/ui/Dialog";
import DoneButton from "@/components/ui/DoneButton";
import Flag from "@/components/Flag";
import { MAX_ORDERS } from "@/constants/app";
import { chooseHost } from "@/engine/exile";
import { deathRisk } from "@/engine/fate";
import { personName } from "@/engine/people";
import { canRise, movementRisk } from "@/engine/role";
import { RISE_HOWS, type GameState, type MovementScore } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import { ui } from "@/components/ui/classes";
import { ordersFull } from "./DraftedOrders";
import Portrait from "./Portrait";
import ResignButton from "./ResignButton";

/** The actions the panel offers, each an order the player adds to the turn; abroad, the movement's own. */
const ACTIONS = ["rally", "press", "coalition", "insiders", "army", "abroad", "strike", "election"] as const;
const EXILE_ACTIONS = ["lobby", "broadcast", "abroad", "insiders", "army"] as const;

const SCORES: MovementScore[] = ["money", "press", "insiders", "army", "street"];

/**
 * The player's opposition: who they are, their party or movement, its
 * strength and the danger it is in, actions to add to the turn, and the ways
 * to power with how close it is to each (engine/role.ts). Abroad, its host and
 * the way home; anywhere, letters to governments and stepping down
 * (engine/exile.ts, engine/fate.ts).
 */
export default function OppositionPanel({
  state,
  disabled,
  onOrder,
  onAbroad,
  onReturn,
  onLetters,
  onResign,
  onStay,
}: {
  state: GameState;
  disabled: boolean;
  onOrder: (order: string) => void;
  onAbroad: () => void;
  onReturn: () => void;
  onLetters: () => void;
  onResign: () => void;
  onStay: () => void;
}) {
  const { t, text, locale } = useI18n();
  const [asking, setAsking] = useState<"abroad" | "return" | null>(null);
  const role = state.role;
  const m = role?.movement;
  if (!role || !m) return null;
  const exiled = m.kind === "exile";
  const host = exiled ? m.host : chooseHost(state);
  const hostName = host ? text(state.countries[host]?.name) : "";
  const death = deathRisk(state);
  const name = role.person ? personName(role.person, locale) : t("role.opposition");
  const risk = movementRisk(state);
  const full = ordersFull(state);
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
          {exiled && m.host && (
            <div className="mt-1.5 flex items-center gap-1.5 text-2xs font-bold text-muted">
              <Flag tag={m.host} scenario={state.scenarioId} color={state.countries[m.host]?.color} size="sm" />
              <span className="truncate">{t("movement.host", { host: hostName })}</span>
            </div>
          )}
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
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="font-black text-ink">{t("figure.death")}</span>
          <span className="font-black tabular-nums text-ink">{death}%</span>
        </div>
        <p className="mt-1 text-2xs font-medium leading-snug text-muted">{t("figure.deathNote", { n: death })}</p>
      </section>

      <section className="flex flex-col gap-1.5">
        <button type="button" onClick={onLetters} className={`${ui.secondary} justify-start px-3 py-2 text-left text-xs`}>
          <Mail className="h-3.5 w-3.5" />
          {t("movement.letters")}
        </button>
        {exiled ? (
          <button type="button" disabled={disabled} onClick={() => setAsking("return")} className={`${ui.secondary} justify-start px-3 py-2 text-left text-xs`}>
            <Home className="h-3.5 w-3.5" />
            {t("movement.return")}
          </button>
        ) : (
          <button type="button" disabled={disabled || !host} title={host ? undefined : t("movement.abroad.none")} onClick={() => setAsking("abroad")} className={`${ui.secondary} justify-start px-3 py-2 text-left text-xs`}>
            <Plane className="h-3.5 w-3.5" />
            {t("movement.abroad")}
          </button>
        )}
      </section>

      <section>
        <div className={`${ui.label} mb-1`}>{t("movement.actions")}</div>
        <p className="mb-2 text-2xs font-medium text-muted">{t("movement.actionsNote")}</p>
        <div className="relative flex flex-col gap-1.5">
          {(exiled ? EXILE_ACTIONS : ACTIONS).filter((a) => a !== "election" || m.kind === "party").map((a) => {
            const order = t(`movement.action.${a}` as MessageKey);
            const done = state.draft.includes(order);
            return (
              <DoneButton
                key={a}
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

      <ResignButton resigning={Boolean(role.resigning)} disabled={disabled} label={t("movement.resign")} body={t("movement.resign.body")} onResign={onResign} onStay={onStay} />

      <p className="text-2xs font-medium leading-snug text-muted">{t("movement.readOnly")}</p>

      <Dialog
        open={asking !== null}
        onClose={() => setAsking(null)}
        title={asking === "abroad" ? t("movement.abroad.title") : t("movement.return.title")}
        footer={
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={() => setAsking(null)} className={`${ui.secondary} w-full py-3 text-sm`}>
              {t("game.cancel")}
            </button>
            <button
              type="button"
              onClick={() => {
                const act = asking;
                setAsking(null);
                if (act === "abroad") onAbroad();
                else if (act === "return") onReturn();
              }}
              className={`${ui.primary} w-full py-3 text-sm`}
            >
              {asking === "abroad" ? t("movement.abroad") : t("movement.return")}
            </button>
          </div>
        }
      >
        <p className="text-sm font-medium leading-relaxed text-ink">{asking === "abroad" ? t("movement.abroad.body", { host: hostName }) : t("movement.return.body")}</p>
      </Dialog>
    </div>
  );
}

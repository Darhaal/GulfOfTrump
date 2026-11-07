"use client";

import { Gavel, Lock, type LucideIcon, Plane, ShieldOff, Skull, Undo2, UserX } from "lucide-react";
import { useState } from "react";
import { ui } from "@/components/ui/classes";
import DoneButton, { Hint } from "@/components/ui/DoneButton";
import { MAX_ORDERS } from "@/constants/app";
import { formatDate } from "@/engine/calendar";
import { formatPopulation } from "@/engine/provinces";
import { caseOdds, DANGEROUS_POWER, mayRepress, ownHistory, type Target } from "@/engine/repressions";
import { REPRESSION_MEASURES, type GameState, type RepressionMeasure } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import { demandWhat } from "../changes";

/**
 * Repressions on the cards and in the record (engine/repressions.ts). Every
 * control here writes an order in the player's language – the engine reads
 * it in any of the three and carries it out with the turn, so the order sits
 * in the turn's list where it can be taken back. Nothing is decided on a
 * click: the security service's dice fall as the turn is played.
 */

/** The turn's orders as the card sees them: those already given, whether there is room, whether the role may give any. */
export interface OrderRoom {
  orders: Set<string>;
  full: boolean;
  disabled: boolean;
  onOrder: (line: string) => void;
}

const SQUARE = "grid h-7 w-7 shrink-0 place-items-center rounded-lg border sheet transition-colors disabled:cursor-not-allowed disabled:border-line disabled:text-faded";
const ICONS: Record<RepressionMeasure, LucideIcon> = { arrest: Lock, trial: Gavel, exile: Plane, execution: Skull };

/** The room for orders a panel has, from the state. */
export const roomOf = (state: Pick<GameState, "draft" | "standing">, disabled: boolean, onOrder: (line: string) => void): OrderRoom => ({
  orders: new Set([...state.draft, ...(state.standing ?? [])]),
  full: state.draft.length + (state.standing?.length ?? 0) >= MAX_ORDERS,
  disabled,
  onOrder,
});

/**
 * A person's card's way to repress them: a square that opens the four
 * measures, each with its odds in a hint (sits in a positioned row).
 */
export function RepressMenu({ state, target, room, align = "end" }: { state: GameState; target: Target; room: OrderRoom; align?: "start" | "end" }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  if (!mayRepress(state)) return null;
  return (
    <>
      <button
        type="button"
        aria-label={t("repress.act")}
        aria-expanded={open}
        disabled={room.disabled}
        onClick={() => setOpen((v) => !v)}
        className={`group ${SQUARE} ${open ? "border-red-300 text-red-700" : "border-line text-muted hover:border-red-200 hover:text-red-600"}`}
      >
        <UserX className="h-3.5 w-3.5" />
        <Hint label={t("repress.act")} text={t("repress.act.hint")} align={align} />
      </button>
      {open &&
        REPRESSION_MEASURES.map((m) => {
          const line = t(`repress.order.${m}` as MessageKey, { name: target.name });
          const done = room.orders.has(line);
          const odds = caseOdds(state, target, m);
          return (
            <DoneButton
              key={m}
              compact
              icon={ICONS[m]}
              label={line}
              hint={room.full && !done ? t("game.orders.limit", { n: MAX_ORDERS }) : odds.blocked ? t("repress.blocked") : t("repress.odds", { done: Math.round(odds.done * 100), martyr: Math.round(odds.martyr * 100) })}
              doneLabel={t("done.inOrders")}
              done={done}
              disabled={room.disabled || room.full}
              onAct={() => room.onOrder(line)}
              align={align}
              className={`${SQUARE} border-line text-muted hover:border-red-200 hover:text-red-600`}
            />
          );
        })}
    </>
  );
}

/** The leader's orders to the player, a minister of the security services: obey or refuse before the turn ends. */
export function LeaderDemands({ state, room }: { state: GameState; room: OrderRoom }) {
  const { t, text } = useI18n();
  const due = (state.repressions?.demands ?? []).filter((d) => d.turn <= state.turn);
  if (!due.length) return null;
  return (
    <section className="flex flex-col gap-2">
      {due.map((d) => {
        const what = demandWhat(d, t, text);
        const answers = [
          { key: "obey", line: t("repress.order.obey", { what }), label: t("repress.demand.obey"), icon: Gavel },
          { key: "refuse", line: t("repress.order.refuse", { what }), label: t("repress.demand.refuse"), icon: ShieldOff },
        ];
        return (
          <div key={d.id} className="rounded-xl border border-red-200 bg-red-50/60 p-3">
            <div className={ui.label}>{t("repress.demand.title")}</div>
            <div className="mt-1 text-sm font-black leading-snug text-ink">{t("change.demand.raised", { by: d.by, what })}</div>
            <p className="mt-1 text-2xs font-medium leading-snug text-muted">{t("repress.demand.due")}</p>
            <div className="relative mt-2 flex flex-wrap gap-1.5">
              {answers.map((a) => {
                const done = room.orders.has(a.line);
                const other = answers.some((x) => x !== a && room.orders.has(x.line));
                return (
                  <DoneButton
                    key={a.key}
                    keepLabel
                    icon={a.icon}
                    label={a.label}
                    hint={a.line}
                    doneLabel={t("done.inOrders")}
                    done={done}
                    disabled={room.disabled || room.full || other}
                    onAct={() => room.onOrder(a.line)}
                    align="start"
                    className={`${ui.secondary} px-3 py-1.5 text-xs`}
                    doneClassName={`${ui.done} gap-2 rounded-xl px-3 py-1.5 text-xs`}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </section>
  );
}

/**
 * The record the government keeps of its repressions: the security organs'
 * power, history's course ahead (historical mode) with the orders to stop
 * it or make it harsher, the people repressed with the order to clear them,
 * and the mass crimes with their toll and what came of them.
 */
export function RepressionRecord({ state, room }: { state: GameState; room: OrderRoom }) {
  const { t, text, locale } = useI18n();
  const rep = state.repressions;
  const power = Math.round(rep?.power ?? 0);
  const leads = !state.role || state.role.kind === "leader";
  const ahead = leads ? ownHistory(state, 1) : [];
  const cases = [...(rep?.cases ?? [])].reverse().slice(0, 12);
  const crimes = [...(rep?.crimes ?? [])].reverse().slice(0, 8);
  const victims = (rep?.cases ?? []).filter((c) => c.result === "done" && !c.rehabilitated);
  if (!power && !ahead.length && !cases.length && !crimes.length) return null;
  const order = (line: string, label: string, icon: LucideIcon, key: string) => {
    const done = room.orders.has(line);
    return (
      <DoneButton
        key={key}
        compact
        icon={icon}
        label={label}
        hint={room.full && !done ? t("game.orders.limit", { n: MAX_ORDERS }) : line}
        doneLabel={t("done.inOrders")}
        done={done}
        disabled={room.disabled || room.full || !leads}
        onAct={() => room.onOrder(line)}
        className={`${SQUARE} border-line text-muted hover:border-accent/40 hover:text-accent`}
      />
    );
  };
  return (
    <section className="flex flex-col gap-3">
      <div className={`${ui.label} flex items-center gap-1.5`}>
        <Gavel className="h-3.5 w-3.5" />
        {t("repress.title")}
      </div>
      {power > 0 && (
        <div tabIndex={0} className="group relative flex flex-col gap-1 outline-none">
          <div className="flex items-baseline justify-between text-xs">
            <span className="font-bold text-muted">{t("repress.power")}</span>
            <span className={`font-black tabular-nums ${power >= DANGEROUS_POWER ? "text-red-600" : "text-ink"}`}>{power}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-divider">
            <div className={`h-full rounded-full ${power >= DANGEROUS_POWER ? "bg-red-600" : "bg-accent"}`} style={{ width: `${Math.max(2, Math.min(100, power))}%` }} />
          </div>
          <Hint label={t("repress.power")} text={t("repress.power.hint")} align="start" />
        </div>
      )}
      {ahead.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="text-xs font-black text-ink">{t("repress.history.title")}</div>
          <p className="text-2xs font-medium leading-snug text-muted">{t("repress.history.note")}</p>
          <ul className="grid gap-1.5">
            {ahead.map(({ event, ongoing }) => {
              const name = text(event.name);
              return (
                <li key={event.id} className="flex items-start gap-2 rounded-xl border border-line sheet p-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-black leading-snug text-ink">{name}</div>
                    <div className="mt-0.5 text-2xs font-medium leading-snug text-muted">
                      {text(event.who)} · {ongoing ? t("repress.history.ongoing") : t("repress.history.from", { date: formatDate(event.from, locale) })}
                    </div>
                  </div>
                  <span className="relative flex shrink-0 items-center gap-1">
                    {order(t("repress.order.stop", { name }), t("repress.stop"), ShieldOff, "stop")}
                    {(event.kind === "deportation" || event.kind === "purge") && order(t("repress.order.harsher", { name }), t("repress.harsher"), Skull, "harsher")}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {cases.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-black text-ink">{t("repress.cases.title")}</span>
            {leads && victims.length > 1 && <span className="relative">{order(t("repress.order.rehabAll"), t("repress.rehabAll"), Undo2, "all")}</span>}
          </div>
          <ul className="grid gap-1">
            {cases.map((c) => (
              <li key={c.id} className="flex items-center gap-2 rounded-lg bg-page px-2.5 py-1.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-bold text-ink">
                    {c.name}
                    {c.title && <span className="font-medium text-muted"> · {c.title}</span>}
                  </div>
                  <div className="text-2xs font-medium text-muted">
                    {t(`repress.measure.${c.measure}` as MessageKey)} · {c.rehabilitated ? t("repress.rehabilitated") : t(`repress.result.${c.result}` as MessageKey)} · {formatDate(c.date, locale)}
                  </div>
                </div>
                {leads && c.result === "done" && !c.rehabilitated && <span className="relative">{order(t("repress.order.rehab", { name: c.name }), t("repress.rehab"), Undo2, c.id)}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {crimes.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-black text-ink">{t("repress.crimes.title")}</span>
          <ul className="grid gap-1">
            {crimes.map((c) => {
              const figures = [
                c.toll > 0 ? t("repress.toll", { n: formatPopulation(c.toll) }) : "",
                c.moved ? t("repress.moved", { n: formatPopulation(c.moved) }) : "",
                c.held ? t("repress.held", { n: formatPopulation(c.held) }) : "",
              ].filter(Boolean);
              const marks = [t(`repress.status.${c.status}` as MessageKey), ...(c.tried ? [t("repress.tried")] : []), ...(c.condemned ? [t("repress.condemned")] : [])];
              return (
                <li key={c.id} className="rounded-lg bg-red-50/60 px-2.5 py-1.5">
                  <div className="text-xs font-bold leading-snug text-ink">
                    {t(`repress.kind.${c.kind}` as MessageKey)} · {text(c.who)}
                  </div>
                  <div className="text-2xs font-medium text-muted">{[...figures, ...marks, formatDate(c.since, locale)].join(" · ")}</div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

"use client";

import { Cog, TriangleAlert } from "lucide-react";
import { ui } from "@/components/ui/classes";
import { ADVISOR_TITLES, type AdvisorId } from "@/engine/advisors";
import { actsOnOrders, setOnOrders } from "@/engine/ministers";
import type { GameState, Locale, RoutineAct } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import { factionName } from "./changes";

type I18n = ReturnType<typeof useI18n>;

/** What an act was about, in the interface language: a country, a ministry, a research direction, a weapon, a resource or the programme's focus. */
function targetText(a: RoutineAct, state: GameState, { t, text }: I18n): string {
  const target = a.target ?? "";
  if (!target) return "";
  const country = () => text(state.countries[target]?.name ?? target);
  switch (a.ministry) {
    case "chief":
      return a.act === "agenda" && target in ADVISOR_TITLES ? text(ADVISOR_TITLES[target as AdvisorId]) : target;
    case "foreign":
    case "military":
    case "intelligence":
      return state.countries[target] ? country() : target;
    case "science":
      return t(`research.dir.${target}` as MessageKey);
    case "industry":
      return a.act === "stores" ? t(`resource.${target}` as MessageKey) : a.act === "power" ? t(`energy.source.${target}` as MessageKey) : t(`arms.kind.${target}` as MessageKey);
    case "space":
      return a.act === "focus" ? t(`space.focus.${target}` as MessageKey) : target;
    default:
      return target;
  }
}

/** How much, in the act's unit: money for the economy minister, a plain number for the rest. */
function amountText(a: RoutineAct, i18n: I18n, locale: Locale): string {
  if (a.amount === undefined) return "";
  if (a.ministry === "finance") return i18n.money(a.amount);
  return a.amount.toLocaleString(locale, { maximumFractionDigits: 1 });
}

/** One minister's turn in a line of the interface language: what he did, botched or for whom, or why he did nothing of his own. */
export function routineLine(a: RoutineAct, state: GameState, i18n: I18n): string {
  const { t } = i18n;
  if (a.held) return t(`routine.held.${a.held}` as MessageKey);
  const vars = { target: targetText(a, state, i18n), amount: amountText(a, i18n, i18n.locale) };
  const line = a.bungled ? t(`routine.bungle.${a.ministry}` as MessageKey, vars) : t(`routine.${a.ministry}.${a.act}` as MessageKey, vars);
  return a.faction ? `${line} (${t("routine.faction", { faction: factionName(a.faction, t) })})` : line;
}

/**
 * The ministers' own work of a turn, in a stage of the turn report: who did
 * what unasked, a botch marked, a minister who acts only on orders left out
 * (the cabinet shows it).
 */
export function RoutineList({ state, acts }: { state: GameState; acts: RoutineAct[] }) {
  const i18n = useI18n();
  const { t, text } = i18n;
  const shown = acts.filter((a) => a.held !== "toggle");
  if (!shown.length) return null;
  return (
    <div>
      <div className={`${ui.label} mb-1.5 flex items-center gap-1.5`}>
        <Cog className="h-3.5 w-3.5" />
        {t("routine.title")}
      </div>
      <ul className="grid gap-1">
        {shown.map((a) => (
          <li key={a.ministry} className={`rounded-lg px-3 py-1.5 text-xs ${a.held ? "font-medium text-muted" : "bg-page font-bold text-ink"}`}>
            <span className="font-black">{text(ADVISOR_TITLES[a.ministry])}</span>
            <span className="text-muted"> · {a.by}</span>
            <span className="block">
              {a.bungled && <TriangleAlert className="mr-1 inline h-3 w-3 align-[-2px] text-amber-700" aria-hidden />}
              {routineLine(a, state, i18n)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * In the ministry's tasks: whether the minister works on his own or only on
 * the government's orders, and what he did on his own last turn.
 */
export function RoutineToggle({ state, ministry, disabled, onChange }: { state: GameState; ministry: AdvisorId; disabled?: boolean; onChange: (next: GameState) => void }) {
  const i18n = useI18n();
  const { t } = i18n;
  const onOrders = actsOnOrders(state, ministry);
  const last = state.chronicle.at(-1)?.routine?.find((a) => a.ministry === ministry);
  return (
    <section className="grid gap-1.5 rounded-xl border border-line px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={ui.label}>{t("routine.mode")}</span>
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-page p-0.5" role="group" aria-label={t("routine.mode")}>
          {([false, true] as const).map((orders) => (
            <button
              key={String(orders)}
              type="button"
              disabled={disabled}
              aria-pressed={onOrders === orders}
              onClick={() => onOrders !== orders && onChange(setOnOrders(state, ministry, orders))}
              className={`${ui.segment} px-2! py-1! text-2xs! ${onOrders === orders ? `${ui.segmentOn} bg-surface shadow-sm` : ui.segmentOff}`}
            >
              {t(orders ? "routine.mode.orders" : "routine.mode.own")}
            </button>
          ))}
        </div>
      </div>
      <p className="text-2xs font-medium text-muted">{t(onOrders ? "routine.mode.hint.orders" : "routine.mode.hint.own")}</p>
      {last && !last.held && (
        <p className="text-xs font-medium text-ink">
          <span className="font-black text-muted">{t("routine.last")}: </span>
          {routineLine(last, state, i18n)}
        </p>
      )}
    </section>
  );
}

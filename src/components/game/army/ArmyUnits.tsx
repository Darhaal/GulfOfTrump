"use client";

import Dictation from "@/components/voice/Dictation";
import { MapPin, Send, Undo2 } from "lucide-react";
import { useState } from "react";
import { ui } from "@/components/ui/classes";
import { yearOf } from "@/engine/calendar";
import { ARMY_ORDER_CHARS, commanderLoyalty, mayOrder, readArmyOrder } from "@/engine/formations";
import type { ArmyOrder, ArmyUnit, GameState, MapRegion, War } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import { knownName, personFor } from "@/engine/people";
import Portrait from "../Portrait";
import { playerWars, TEMPER_KEY, useArmyWords, useSectorLine, useUnitName } from "./common";

interface ArmyUnitsProps {
  state: GameState;
  regions?: Record<string, MapRegion> | null;
  disabled: boolean;
  onShowRegions: (ids: string[]) => void;
  /** Give a formation an order for the coming turn, or take it back. */
  onArmyOrder?: (order: ArmyOrder) => void;
  onCancelArmyOrder?: (war: string, unit: string) => void;
  /** An order of the turn: the words to a formation that tell no kind of order go there, for the game master to judge. */
  onOrder?: (order: string) => void;
}

/** Soldiers in a division, roughly, for a formation whose divisions nobody counted. */
const MEN_PER_DIVISION = 12;

/** A loyalty's colour: firm, wavering, doubtful. */
export const loyaltyTone = (n: number) => (n >= 60 ? "text-emerald-700" : n >= 40 ? "text-amber-700" : "text-red-600");

/**
 * The formations the engine fights the player's wars with (engine/formations.ts): each one's commander and character,
 * task, sector and guns, how it fought last turn, and where to give it an order – a task, an offensive, an all-out
 * assault, a withdrawal or a new commander – which the general staff then carries out as it can.
 */
export default function ArmyUnits({ state, regions, disabled, onShowRegions, onArmyOrder, onCancelArmyOrder, onOrder }: ArmyUnitsProps) {
  const { t, text } = useI18n();
  const { place, soldiers } = useArmyWords(state, regions);
  const name = useUnitName();
  const line = useSectorLine(state, regions);
  const wars = playerWars(state).filter((w) => (w.units ?? []).some((u) => u.tag === state.player));
  const last = state.chronicle.at(-1);
  return (
    <section className="flex flex-col gap-2">
      <span className={ui.label} title={t("units.hint")}>
        {t("units.title")}
      </span>
      {wars.length ? (
        wars.map((w) => (
          <div key={w.id} className="flex flex-col gap-1.5">
            {wars.length > 1 && <span className="text-2xs font-black text-muted">{text(w.name)}</span>}
            {(w.units ?? [])
              .filter((u) => u.tag === state.player)
              .map((u) => (
                <UnitCard
                  key={u.id}
                  state={state}
                  war={w}
                  unit={u}
                  name={name(u)}
                  turn={last?.sectors?.find((s) => s.war === w.id && s.unit === u.id)}
                  line={line}
                  place={place}
                  soldiers={soldiers}
                  disabled={disabled}
                  onShowRegions={onShowRegions}
                  onArmyOrder={onArmyOrder}
                  onCancelArmyOrder={onCancelArmyOrder}
                  onOrder={onOrder}
                />
              ))}
          </div>
        ))
      ) : (
        <p className="text-xs font-medium text-muted">{t("units.none")}</p>
      )}
    </section>
  );
}

interface UnitCardProps extends Pick<ArmyUnitsProps, "state" | "disabled" | "onShowRegions" | "onArmyOrder" | "onCancelArmyOrder" | "onOrder"> {
  war: War;
  unit: ArmyUnit;
  name: string;
  turn?: NonNullable<GameState["chronicle"][number]["sectors"]>[number];
  line: ReturnType<typeof useSectorLine>;
  place: (id: string) => string;
  soldiers: (thousands: number) => string;
}

function UnitCard({ state, war, unit: u, name, turn, line, place, soldiers, disabled, onShowRegions, onArmyOrder, onCancelArmyOrder, onOrder }: UnitCardProps) {
  const { t, locale } = useI18n();
  const [words, setWords] = useState("");
  const [sent, setSent] = useState<"turn" | null>(null);
  const pending = (state.armyOrders ?? []).find((o) => o.war === war.id && o.unit === u.id);
  const orders = Boolean(onArmyOrder) && mayOrder(state, u);
  const commander = u.commander.name ? personFor(u.commander.name, yearOf(state.date)) : null;
  const loyalty = commanderLoyalty(state, u.commander.name);
  // Its divisions as the organisation counts them; for one the engine made, reckoned from its men.
  const counted = u.name ? state.countries[state.player]?.arsenal?.organisation?.formations.find((f) => f.name === u.name)?.divisions : undefined;
  const divisions = counted ?? (turn ? Math.max(1, Math.round(turn.men / MEN_PER_DIVISION)) : undefined);
  const facts = [
    turn ? t("units.men", { men: soldiers(turn.men) }) : "",
    turn ? t("units.supply", { n: Math.round(turn.supply * 100) }) : "",
    ...(["tanks", "artillery", "aircraft"] as const).map((k) => (turn?.forces?.[k] ? t(`units.arms.${k}`, { n: turn.forces[k]!.toLocaleString(locale) }) : "")),
    u.prep >= 0.05 ? t("units.guns", { n: Math.round(u.prep * 100) }) : "",
  ].filter(Boolean);
  // The order in the player's words: the staff carries out the kind they tell; words that tell none go to the turn's orders.
  const give = () => {
    const text = words.trim();
    if (!text) return;
    const order = readArmyOrder(war.id, u.id, text);
    if (order && onArmyOrder) {
      onArmyOrder(order);
      setSent(null);
    } else if (onOrder) {
      onOrder(`${name}: ${text}`);
      setSent("turn");
    }
    setWords("");
  };
  return (
    <div className="rounded-xl border border-line sheet p-3">
      <div className="flex items-start gap-2.5">
        <Portrait portrait={commander?.portrait} gender={commander?.gender} name={commander?.name ?? t("units.unnamed")} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="min-w-0 truncate text-xs font-black text-ink">{name}</span>
            <span className="shrink-0 text-2xs font-bold uppercase tracking-wider text-muted">{t(`army.kind.${u.kind}` as MessageKey)}</span>
          </div>
          <div className="mt-0.5 flex flex-wrap gap-x-2 text-2xs font-bold text-muted">
            <span className="text-ink">{u.commander.name ? knownName(u.commander.name, locale) : t("units.unnamed")}</span>
            <span>{t(TEMPER_KEY[u.commander.temper] ?? "units.temper.steady")}</span>
            <span>{t("units.skill", { n: u.commander.skill })}</span>
          </div>
          <div className="mt-0.5 flex flex-wrap gap-x-2 text-2xs font-black tabular-nums">
            {divisions !== undefined && <span className="text-ink">{counted === undefined ? "≈" : ""}{t("army.divisions", { n: divisions.toLocaleString(locale) })}</span>}
            <span className={loyaltyTone(loyalty)} title={t("units.loyalty.hint")}>
              {t("units.loyalty", { n: loyalty })}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-1.5 text-2xs font-bold text-muted">
        {t(u.task === "attack" ? "units.task.attack" : "units.task.hold")}
        {u.ordered ? ` · ${t("units.ordered")}` : ""}
        {facts.length ? ` · ${facts.join(" · ")}` : ""}
      </div>
      {turn && <p className="mt-1 text-2xs font-medium leading-snug text-ink">{line(turn)}</p>}
      {u.sector.length > 0 && (
        <button type="button" onClick={() => onShowRegions(u.sector)} className="mt-1 inline-flex max-w-full items-center gap-1 text-left text-2xs font-bold text-accent hover:underline">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">
            {u.sector.slice(0, 3).map(place).join(", ")}
            {u.sector.length > 3 ? ` +${u.sector.length - 3}` : ""}
          </span>
        </button>
      )}
      {orders &&
        (pending ? (
          <div className="mt-2 flex flex-col gap-1.5 border-t border-divider pt-2 text-2xs font-bold">
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0 text-accent">{t("order.pending", { order: pending.text ?? t(`order.kind.${pending.kind}` as MessageKey) })}</span>
              <button type="button" disabled={disabled} onClick={() => onCancelArmyOrder?.(war.id, u.id)} className={`${ui.secondary} shrink-0 px-2 py-1 text-2xs`}>
                <Undo2 className="h-3 w-3" />
                {t("order.cancel")}
              </button>
            </div>
            {pending.text && <span className="text-muted">{t("order.read", { kind: t(`order.kind.${pending.kind}` as MessageKey) })}</span>}
          </div>
        ) : (
          <div className="mt-2 flex flex-col gap-1.5 border-t border-divider pt-2" title={t("order.hint")}>
            <Dictation id={`army-${u.id}`} set={setWords} max={ARMY_ORDER_CHARS} disabled={disabled}>
              <textarea
                value={words}
                disabled={disabled}
                rows={3}
                maxLength={ARMY_ORDER_CHARS}
                onChange={(e) => {
                  setWords(e.target.value);
                  setSent(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) give();
                }}
                placeholder={t("order.write")}
                aria-label={t("order.label")}
                className={`${ui.input} resize-none px-2.5 py-1.5 text-xs`}
              />
            </Dictation>
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 text-2xs font-medium text-muted">{sent === "turn" ? t("order.asTurn") : ""}</span>
              <button type="button" disabled={disabled || !words.trim()} onClick={give} className={`${ui.primary} shrink-0 px-3 py-1.5 text-2xs`}>
                <Send className="h-3 w-3" />
                {t("order.give")}
              </button>
            </div>
          </div>
        ))}
    </div>
  );
}

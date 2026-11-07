"use client";

import { MapPin, Star } from "lucide-react";
import { headquartersAt, headquartersGround } from "@/components/map/overlays";
import { ui } from "@/components/ui/classes";
import { heldGround } from "@/engine/army";
import { commandTroops, ownFormation } from "@/engine/figures";
import type { ArmyOrder, Formation, GameState, MapRegion } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import { ordersFull } from "../DraftedOrders";
import RefineButton from "../RefineButton";
import RenameOrder from "../RenameOrder";
import type { Suggest } from "../Suggestions";
import ArmyUnits, { loyaltyTone } from "./ArmyUnits";
import { yearOf } from "@/engine/calendar";
import { commanderLoyalty } from "@/engine/formations";
import { knownName, personFor } from "@/engine/people";
import Portrait from "../Portrait";
import { PlaceLink, useArmyWords } from "./common";

interface ArmyCommandProps {
  state: GameState;
  regions?: Record<string, MapRegion> | null;
  disabled: boolean;
  /** The game master is describing the army. */
  learning: boolean;
  /** Ask the game master how the army is organised now. */
  onLearn: () => void;
  onShowRegions: (ids: string[]) => void;
  /** Give a formation an order for the coming turn, or take it back (engine/formations.ts). */
  onArmyOrder?: (order: ArmyOrder) => void;
  onCancelArmyOrder?: (war: string, unit: string) => void;
  /** Adds an order to the turn: a formation renamed (engine/acts.ts); missing where the player gives none. */
  onOrder?: (order: string) => void;
  /** Names from the game master for a rename by order (engine/suggest.ts). */
  onSuggest?: Suggest;
}

/**
 * The army's command: the player's own when they are a general, then the
 * armies, fronts, fleets and air forces as the game master last described
 * them – their commanders, divisions and theatres, and the headquarters the
 * map marks with a star, worked out the same way (the provinces each still
 * stands in, the one nearest their middle) – and the request that describes
 * them anew; and first, the formations the engine fights the wars with, where the player orders them (ArmyUnits).
 */
export default function ArmyCommand({ state, regions, disabled, learning, onLearn, onShowRegions, onArmyOrder, onCancelArmyOrder, onOrder, onSuggest }: ArmyCommandProps) {
  const { t, locale } = useI18n();
  const { num, place } = useArmyWords(state, regions);
  const year = yearOf(state.date);
  const organisation = state.countries[state.player]?.arsenal?.organisation;
  const formations = organisation?.formations ?? [];
  // A headquarters stands behind the lines (engine/army.ts heldGround).
  const held = heldGround(state);
  const own = ownFormation(state);
  const role = state.role?.kind === "general" ? state.role : undefined;
  const divisions = formations.reduce((sum, f) => sum + f.divisions, 0);

  /** Where a formation's headquarters stands: fleets and air forces have none on the map. */
  const hqOf = (f: Formation) => {
    if (f.kind === "fleet" || f.kind === "air") return null;
    const centre = (id: string) => regions?.[id]?.at;
    const at = headquartersAt(headquartersGround(f.provinces, held, centre), centre);
    return at?.region ?? null;
  };
  const hqLine = (f: Formation) => {
    const hq = hqOf(f);
    if (!hq) return null;
    return (
      <div className="mt-1 flex min-w-0 items-center gap-1 text-2xs font-bold text-muted" title={t("army.hqHint")}>
        <Star className="h-3 w-3 shrink-0 text-accent" />
        <span className="shrink-0">{t("army.hq")}:</span>
        <PlaceLink name={place(hq)} onClick={() => onShowRegions([hq])} />
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {role && (
        <section className="rounded-xl border border-accent/40 sheet p-3">
          <span className={`${ui.label} mb-1 block`}>{t("army.command")}</span>
          <div className="text-sm font-black text-ink">{t(`figure.scope.${role.command?.scope ?? "front"}` as MessageKey)}</div>
          {role.command?.scope === "front" && <div className="truncate text-xs font-bold text-muted">{role.command.name ?? t("figure.frontUnnamed")}</div>}
          <div className="mt-2 flex items-baseline justify-between gap-2 text-xs">
            <span className="font-bold text-muted">{t("figure.troops")}</span>
            <span className="font-black tabular-nums text-ink">{t("figure.troopsValue", { n: commandTroops(state).toLocaleString(locale) })}</span>
          </div>
          {own && (
            <div className="mt-2 border-t border-divider pt-2">
              <div className="truncate text-xs font-black text-ink">{t("figure.formation", { name: own.name, n: own.divisions })}</div>
              {own.theatre && <div className="truncate text-2xs font-bold text-muted">{own.theatre}</div>}
              {hqLine(own)}
            </div>
          )}
        </section>
      )}

      <ArmyUnits state={state} regions={regions} disabled={disabled} onShowRegions={onShowRegions} onArmyOrder={onArmyOrder} onCancelArmyOrder={onCancelArmyOrder} onOrder={onOrder} />

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className={ui.label}>{t("army.formations")}</span>
          {formations.length > 0 && <span className="text-2xs font-bold tabular-nums text-muted">{t("army.total", { n: formations.length, div: num(divisions) })}</span>}
        </div>
        <div title={t("army.learnHint")}>
          <RefineButton label={t("army.learn")} busy={learning} disabled={disabled} asOf={organisation?.date} onClick={onLearn} />
        </div>
        {formations.length ? (
          <ul className="flex flex-col gap-1.5">
            {formations.map((f) => {
              const mine = f === own;
              return (
                <li key={f.name} className={`rounded-xl border sheet p-3 ${mine ? "border-accent/50" : "border-line"}`}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
                      <span className="min-w-0 truncate text-xs font-black text-ink">{f.name}</span>
                      {onOrder && <RenameOrder key={`formation-${f.name}`} what="formation" current={f.name} onOrder={onOrder} onSuggest={onSuggest} disabled={disabled} full={ordersFull(state)} />}
                      {mine && <span className="shrink-0 rounded-md bg-accent/15 px-1.5 py-0.5 text-2xs font-black uppercase tracking-wider text-accent">{t("army.yours")}</span>}
                    </span>
                    <span className="shrink-0 text-2xs font-bold uppercase tracking-wider text-muted">{t(`army.kind.${f.kind}` as MessageKey)}</span>
                  </div>
                  <div className="mt-1.5 flex items-start gap-2.5">
                    {f.commander && <Portrait portrait={personFor(f.commander, year).portrait} gender={personFor(f.commander, year).gender} name={f.commander} size="sm" />}
                    <div className="min-w-0 flex-1">
                      {f.commander && <div className="truncate text-xs font-bold text-ink">{knownName(f.commander, locale)}</div>}
                      <div className="mt-0.5 flex flex-wrap gap-x-2 text-2xs font-black tabular-nums">
                        {f.divisions > 0 && <span className="text-ink">{t("army.divisions", { n: num(f.divisions) })}</span>}
                        {f.commander && (
                          <span className={loyaltyTone(commanderLoyalty(state, f.commander))} title={t("units.loyalty.hint")}>
                            {t("units.loyalty", { n: commanderLoyalty(state, f.commander) })}
                          </span>
                        )}
                      </div>
                      {f.theatre && <div className="mt-0.5 text-2xs font-bold text-muted">{f.theatre}</div>}
                    </div>
                  </div>
                  {hqLine(f)}
                  {f.provinces.length > 0 && (
                    <button type="button" onClick={() => onShowRegions(f.provinces)} className="mt-1 inline-flex max-w-full items-center gap-1 text-left text-2xs font-bold text-accent hover:underline">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">
                        {f.provinces.slice(0, 3).map(place).join(", ")}
                        {f.provinces.length > 3 ? ` +${f.provinces.length - 3}` : ""}
                      </span>
                    </button>
                  )}
                  {f.note && <p className="mt-1 text-2xs font-medium leading-snug text-muted">{f.note}</p>}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-xs font-medium text-muted">{t("army.formationsEmpty")}</p>
        )}
      </section>
    </div>
  );
}

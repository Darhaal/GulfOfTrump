"use client";

import { useState } from "react";
import { ui } from "@/components/ui/classes";
import type { Accounts } from "@/engine/economy";
import type { ArmyOrder, GameState, MapIndex, MapRegion } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import { usePreference } from "@/lib/preferences";
import ArmyCommand from "./army/ArmyCommand";
import ArmyForces from "./army/ArmyForces";
import ArmyFronts from "./army/ArmyFronts";
import ArmyLosses from "./army/ArmyLosses";
import { ARMY_SECTIONS, playerWars, type ArmySection, type ShowTurn } from "./army/common";
import { isFrontChange } from "./changes";
import type { Suggest } from "./Suggestions";

interface ArmyPanelProps {
  state: GameState;
  accounts?: Accounts;
  /** The map's provinces, for their names. */
  regions?: Record<string, MapRegion>;
  /** The map, for each side's reach in a war (engine/warMeans.ts) and its fronts' theatres. */
  index?: MapIndex | null;
  disabled: boolean;
  /** The game master is describing the army. */
  learning: boolean;
  /** Ask the game master how the army is organised now. */
  onLearn: () => void;
  /** Show these provinces on the map. */
  onShowRegions: (ids: string[]) => void;
  /** Show a turn's changes on the map, as the chronicle does, or some provinces of it. */
  onShowTurn?: ShowTurn;
  /** The turn whose front changes the fronts section shows; null for the latest (the report's link sets it). */
  frontTurn?: number | null;
  onFrontTurn?: (turn: number | null) => void;
  /** Add an order the player wrote to the turn's orders; false when it could not be added. */
  onOrder: (order: string) => boolean;
  /** Names from the game master for a rename by order (engine/suggest.ts); missing without one. */
  onSuggest?: Suggest;
  /** Give a formation an order for the coming turn, or take it back (engine/formations.ts). */
  onArmyOrder?: (order: ArmyOrder) => void;
  onCancelArmyOrder?: (war: string, unit: string) => void;
}

/**
 * The player's army in four sections, chosen at the top and remembered in
 * this browser: its forces (soldiers by training, weapons by kind and type,
 * their technology and what industry was told to build), the fronts and
 * their movements (the turn's changes in full, each war's pace, means,
 * outlook and theatres, each formation's turn, an offensive to order), what
 * each war has cost, and the command (the formations the engine fights with and
 * the orders to them, the organisation and its headquarters, the general's own).
 */
export default function ArmyPanel({ state, accounts, regions, index, disabled, learning, onLearn, onShowRegions, onShowTurn, frontTurn, onFrontTurn, onOrder, onArmyOrder, onCancelArmyOrder, onSuggest }: ArmyPanelProps) {
  const { t } = useI18n();
  const [saved, setSaved] = usePreference("armySection");
  const [ownTurn, setOwnTurn] = useState<number | null>(null);
  const section: ArmySection = (ARMY_SECTIONS as readonly string[]).includes(saved) ? (saved as ArmySection) : "forces";
  const player = state.countries[state.player];
  if (!player?.arsenal || !player.economy) return <p className="text-xs font-medium text-muted">{t("arms.none")}</p>;

  // At war, with the fronts moved last turn: their section carries a dot while another is open.
  const moved = playerWars(state).some((w) => !w.truce) && (state.chronicle.at(-1)?.applied.some(isFrontChange) ?? false);
  const segment = (id: ArmySection) => (
    <button
      key={id}
      type="button"
      role="tab"
      onClick={() => setSaved(id)}
      aria-selected={section === id}
      // The recipe's own padding would cut a section's name short in a narrow panel.
      className={`${ui.segment} relative min-w-0 px-1! ${section === id ? `${ui.segmentOn} bg-surface shadow-sm` : ui.segmentOff}`}
    >
      <span className="block truncate leading-tight">{t(`army.section.${id}` as MessageKey)}</span>
      {id === "fronts" && moved && section !== id && <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />}
    </button>
  );

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label={t("army.sections")} className="grid grid-cols-4 gap-1 rounded-xl bg-page p-1">
        {ARMY_SECTIONS.map(segment)}
      </div>

      {section === "forces" && <ArmyForces state={state} accounts={accounts} />}
      {section === "fronts" && (
        <ArmyFronts
          state={state}
          regions={regions}
          index={index ?? null}
          disabled={disabled}
          frontTurn={onFrontTurn ? (frontTurn ?? null) : ownTurn}
          onFrontTurn={onFrontTurn ?? setOwnTurn}
          onShowTurn={onShowTurn}
          onShowRegions={onShowRegions}
          onOrder={onOrder}
          onSuggest={onSuggest}
        />
      )}
      {section === "losses" && <ArmyLosses state={state} regions={regions} />}
      {section === "command" && (
        <ArmyCommand state={state} regions={regions} disabled={disabled} learning={learning} onLearn={onLearn} onShowRegions={onShowRegions} onArmyOrder={onArmyOrder} onCancelArmyOrder={onCancelArmyOrder} onOrder={onOrder} onSuggest={onSuggest} />
      )}
    </div>
  );
}

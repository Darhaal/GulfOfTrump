"use client";

import type { ChronicleEntry, GameState, MapRegion } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import { PlaceLink, useArmyWords, useSectorLine, useUnitName } from "./common";

interface SectorTurnsProps {
  state: GameState;
  regions?: Record<string, MapRegion> | null;
  entry: ChronicleEntry;
  onShow: (ids: string[]) => void;
}

/**
 * Each of the player's formations' turn as the engine fought it (engine/formations.ts): how it fought and where –
 * "Assault at the Somme: 57 thousand lost, 2 km gained" – the enemy's losses against it as the staff counts them, the
 * prisoners it took, and what the general staff made of the player's order to it.
 */
export default function SectorTurns({ state, regions, entry, onShow }: SectorTurnsProps) {
  const { t } = useI18n();
  const { soldiers, place } = useArmyWords(state, regions);
  const line = useSectorLine(state, regions);
  const name = useUnitName();
  const sectors = entry.sectors ?? [];
  if (!sectors.length) return null;
  return (
    <div className="mt-2">
      <div className="text-2xs font-black uppercase tracking-wider text-muted">{t("sectors.title")}</div>
      <ul className="mt-0.5 grid grid-cols-1 gap-1.5">
        {sectors.map((s) => {
          const rest = [
            s.enemyLost >= 0.05 ? t("sectors.enemy", { n: soldiers(s.enemyLost) }) : "",
            s.taken ? t("sectors.taken", { n: soldiers(s.taken) }) : "",
          ].filter(Boolean);
          return (
            <li key={`${s.war}:${s.unit}`} className="text-xs">
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate font-black text-ink">{name(s)}</span>
                {s.at && <PlaceLink name={place(s.at)} onClick={() => onShow([s.at!])} />}
              </div>
              <div className="font-medium text-ink">{line(s)}</div>
              {rest.length > 0 && <div className="text-2xs font-bold text-muted">{rest.join(" · ")}</div>}
              {s.order && (
                <div className={`text-2xs font-bold ${s.order.fate === "done" ? "text-muted" : "text-accent"}`}>
                  {t("sectors.order", { order: t(`order.kind.${s.order.kind}` as MessageKey), fate: t(`order.fate.${s.order.fate}` as MessageKey) })}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

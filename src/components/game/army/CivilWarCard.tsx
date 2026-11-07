"use client";

import { ui } from "@/components/ui/classes";
import { civilHold } from "@/engine/civilWar";
import type { GameState, MapRegion, War } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import { useArmyWords } from "./common";

/**
 * A civil war's state under its war in the fronts section (engine/civilWar.ts):
 * how it began, the share of the people the rebels hold, each side's
 * legitimacy, who recognises the rebels, the volunteers from abroad, who went
 * over, and which side the player is on.
 */
export default function CivilWarCard({ state, war, regions }: { state: GameState; war: War; regions?: Record<string, MapRegion> }) {
  const { t } = useI18n();
  const { country, soldiers } = useArmyWords(state);
  const cw = (state.civilWars ?? []).find((c) => c.war === war.id && !c.end);
  if (!cw) return null;
  const hold = civilHold(state, cw, regions ?? null);
  const total = Math.max(1, cw.legitimacy.government + cw.legitimacy.rebels);
  const rebels = (cw.legitimacy.rebels / total) * 100;
  const list = (tags: string[]) => tags.map(country).join(", ");
  return (
    <div className="rounded-lg border border-line sheet px-2.5 py-2" title={t("civil.hint")}>
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 text-xs font-black text-ink">
          {t("civil.title")}: {t(`civil.how.${cw.how}` as MessageKey)}
        </span>
        {cw.player && <span className="shrink-0 rounded-md bg-accent/15 px-2 py-0.5 text-2xs font-black uppercase tracking-wider text-accent">{t(`civil.player.${cw.player}` as MessageKey)}</span>}
      </div>
      <div className="mt-1 text-2xs font-bold tabular-nums text-muted">{t("civil.hold", { n: Math.round(hold.rebels * 100) })}</div>
      <div className={`${ui.label} mt-2 mb-1`}>{t("civil.legitimacy")}</div>
      <div className="flex h-2 overflow-hidden rounded-full bg-divider">
        <div className="h-full bg-ink" style={{ width: `${100 - rebels}%` }} />
        <div className="h-full bg-accent" style={{ width: `${rebels}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-2xs font-bold tabular-nums text-muted">
        <span>
          {t("civil.government")} {cw.legitimacy.government}
        </span>
        <span>
          {t("civil.rebels")} {cw.legitimacy.rebels}
        </span>
      </div>
      <ul className="mt-2 grid grid-cols-1 gap-0.5 text-2xs font-medium text-muted">
        <li>{cw.recognised.length ? t("civil.recognised", { list: list(cw.recognised) }) : t("civil.recognisedNone")}</li>
        {cw.seat && <li>{t("civil.seat")}</li>}
        {cw.volunteers?.length ? <li>{t("civil.volunteers", { list: cw.volunteers.map((v) => `${country(v.from)} ${soldiers(v.men)} → ${t(v.side === "rebels" ? "civil.rebels" : "civil.government")}`).join(", ") })}</li> : null}
        {cw.defected && (cw.defected.rebels || cw.defected.government || cw.defected.regions) ? (
          <li>{t("civil.defected", { a: soldiers(cw.defected.rebels), b: soldiers(cw.defected.government), n: cw.defected.regions })}</li>
        ) : null}
      </ul>
    </div>
  );
}

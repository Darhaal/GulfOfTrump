"use client";

import { Apple, Flame, HeartPulse, Home, ShoppingBag, Users, type LucideIcon } from "lucide-react";
import { useMemo } from "react";
import { ui } from "@/components/ui/classes";
import { type ProvisionKind, provisionOf } from "@/engine/provision";
import type { GameState, MapRegion } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";

const ICONS: Record<ProvisionKind, LucideIcon> = { food: Apple, energy: Flame, goods: ShoppingBag, housing: Home, medicine: HeartPulse };

/** Green when people have what they need, amber when they go short, red in a crisis. */
const tone = (level: number) => (level >= 90 ? { bar: "bg-emerald-600", text: "text-emerald-700" } : level >= 70 ? { bar: "bg-amber-500", text: "text-amber-700" } : { bar: "bg-red-600", text: "text-red-600" });

/**
 * How well the player's people are supplied — food, energy, goods, housing,
 * medicine — as the engine reads it off the land, the trade, the budget and
 * the war (engine/provision.ts), with what holds each one up or pulls it down.
 */
export default function ProvisionPanel({ state, regions }: { state: GameState; regions: Record<string, MapRegion> | null }) {
  const { t } = useI18n();
  const supply = useMemo(() => (regions ? provisionOf(state, state.player, regions) : null), [state, regions]);
  if (!supply) return null;
  const overall = tone(supply.overall);
  return (
    <section className="grid gap-3">
      <div className={`${ui.label} flex items-center gap-1.5`}>
        <Users className="h-3.5 w-3.5" />
        {t("supply.title")}
      </div>
      <p className="text-2xs font-medium leading-snug text-muted">{t("supply.lead")}</p>
      <div className="rounded-xl bg-page p-3">
        <div className="flex items-baseline justify-between text-xs">
          <span className="font-black text-ink">{t("supply.overall")}</span>
          <span className={`text-sm font-black tabular-nums ${overall.text}`}>{supply.overall}%</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-divider">
          <div className={`h-full rounded-full ${overall.bar}`} style={{ width: `${supply.overall}%` }} />
        </div>
      </div>
      <ul className="grid gap-2.5">
        {supply.lines.map((l) => {
          const Icon = ICONS[l.kind];
          const c = tone(l.level);
          return (
            <li key={l.kind} className="grid gap-1">
              <div className="flex items-center gap-2 text-xs">
                <Icon className="h-3.5 w-3.5 shrink-0 text-muted" />
                <span className="min-w-0 flex-1 truncate font-bold text-ink">{t(`supply.${l.kind}` as MessageKey)}</span>
                <span className={`font-black tabular-nums ${c.text}`}>{l.level}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-divider">
                <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${l.level}%` }} />
              </div>
              {l.causes.length > 0 && <div className="text-2xs font-medium text-muted">{l.causes.map((x) => t(`supply.cause.${x}` as MessageKey)).join(" · ")}</div>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

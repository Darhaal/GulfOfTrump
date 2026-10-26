"use client";

import { Apple, ArrowDown, ArrowUp, Flame, HeartPulse, Home, ShoppingBag, Users, type LucideIcon } from "lucide-react";
import { useMemo } from "react";
import { ui } from "@/components/ui/classes";
import { type ProvisionCause, type ProvisionKind, provisionOf } from "@/engine/provision";
import type { GameState, MapRegion } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";

const ICONS: Record<ProvisionKind, LucideIcon> = { food: Apple, energy: Flame, goods: ShoppingBag, housing: Home, medicine: HeartPulse };

/** Green when people have what they need, amber when they go short, red in a crisis. */
const tone = (level: number) => (level >= 90 ? { bar: "bg-emerald-600", text: "text-emerald-700" } : level >= 70 ? { bar: "bg-amber-500", text: "text-amber-700" } : { bar: "bg-red-600", text: "text-red-600" });

/** The lines whose name says on hover what would raise them. */
const HINTS: Partial<Record<ProvisionKind, MessageKey>> = { goods: "supply.hint.goods", energy: "supply.hint.energy" };
/** The causes the player's budget and trade set, which say on hover what they do. */
const WHY: Partial<Record<ProvisionCause, MessageKey>> = {
  warEconomy: "supply.why.warEconomy",
  austerity: "supply.why.austerity",
  industry: "supply.why.industry",
  imports: "supply.why.imports",
};

/** What pulls a line down or holds it up, behind an arrow that says which. */
function Causes({ causes, label, Arrow, tone = "" }: { causes: ProvisionCause[]; label: string; Arrow: LucideIcon; tone?: string }) {
  const { t } = useI18n();
  return (
    <span className={`inline-flex items-center gap-1 ${tone}`}>
      <Arrow className="h-3 w-3 shrink-0" aria-label={label} />
      <span>
        {causes.map((x, i) => {
          const why = WHY[x];
          return (
            <span key={x}>
              {i > 0 && " · "}
              {why ? (
                <span className="cursor-help underline decoration-dotted decoration-1 underline-offset-2" title={t(why)}>
                  {t(`supply.cause.${x}` as MessageKey)}
                </span>
              ) : (
                t(`supply.cause.${x}` as MessageKey)
              )}
            </span>
          );
        })}
      </span>
    </span>
  );
}

/**
 * How well the player's people are supplied — food, energy, goods, housing,
 * medicine — as the engine reads it off the land, the trade, the budget and
 * the war (engine/provision.ts), with what pulls each one down and what
 * holds it up.
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
          const hint = HINTS[l.kind];
          const down = l.causes.filter((x) => !l.up.includes(x));
          return (
            <li key={l.kind} className="grid gap-1">
              <div className="flex items-center gap-2 text-xs">
                <Icon className="h-3.5 w-3.5 shrink-0 text-muted" />
                {/* Goods and energy say on hover what would raise them and refill the stores. */}
                <span className={`min-w-0 flex-1 truncate font-bold text-ink ${hint ? "cursor-help" : ""}`} title={hint ? t(hint) : undefined}>
                  {t(`supply.${l.kind}` as MessageKey)}
                </span>
                <span className={`font-black tabular-nums ${c.text}`}>{l.level}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-divider">
                <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${l.level}%` }} />
              </div>
              {(down.length > 0 || l.up.length > 0) && (
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-2xs font-medium text-muted">
                  {down.length > 0 && <Causes causes={down} label={t("supply.pulls")} Arrow={ArrowDown} />}
                  {l.up.length > 0 && <Causes causes={l.up} label={t("supply.holds")} Arrow={ArrowUp} tone="text-emerald-700" />}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

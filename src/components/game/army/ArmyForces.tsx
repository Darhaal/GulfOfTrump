"use client";

import { Atom } from "lucide-react";
import { ui } from "@/components/ui/classes";
import { menOf } from "@/engine/army";
import { availableKinds, buildLevel, maxLevel, needsOf, procurement } from "@/engine/arsenal";
import { yearOf } from "@/engine/calendar";
import type { Accounts } from "@/engine/economy";
import { isTyped, standingOrders, TYPE_KIND, typesOf } from "@/engine/forces";
import { WEAPON_KINDS, type ArmsType, type GameState, type WeaponKind } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import { ARMS_ICONS } from "../armsText";
import { useArmyWords } from "./common";

/** The kinds in the order the army reads them: the air, the sea, the armour, then the guns, air defence, drones and the rifles. */
const ORDER: WeaponKind[] = ["aircraft", "ships", "tanks", "artillery", "airDefence", "drones", "rifles"];

/**
 * The army's forces: the money for new weapons, its soldiers by training,
 * each kind of weapon with its technology level and the turn's gains and
 * losses – aircraft, ships and armour by type, each with what it does on
 * hover (engine/forces.ts) – and what the player's orders told industry to
 * build.
 */
export default function ArmyForces({ state, accounts }: { state: GameState; accounts?: Accounts }) {
  const { t, money } = useI18n();
  const { num, count } = useArmyWords(state);
  const player = state.countries[state.player];
  const arsenal = player?.arsenal;
  if (!arsenal || !player?.economy) return null;
  const year = yearOf(state.date);
  const can = new Set(availableKinds(state));
  const buy = procurement(state);
  const shortages = new Set(accounts?.shortages ?? []);
  const slowed = [...new Set(WEAPON_KINDS.flatMap((k) => needsOf(k).filter((r) => shortages.has(r))))];
  const troops = player.economy.troops;
  const men = menOf(state, player);
  const callable = Math.max(0, (accounts?.mobilisable ?? 0) - troops);
  const orders = standingOrders(arsenal.orders, state.date);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl bg-page p-3 text-xs font-medium text-muted">
        <div>{t("arms.procurement", { money: money(buy.yearly) })}</div>
        {slowed.length > 0 && <div className="mt-1 font-bold text-amber-700">{t("arms.shortage", { list: slowed.map((r) => t(`resource.${r}` as MessageKey)).join(", ") })}</div>}
        {arsenal.nuclear && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-ink px-2 py-1 text-2xs font-black uppercase tracking-wider text-on-ink">
            <Atom className="h-3 w-3" />
            {t("arms.nuclear")}
          </div>
        )}
      </div>

      <section>
        <span className={`${ui.label} mb-1.5 block`}>{t("army.men")}</span>
        <div className="rounded-xl border border-line sheet p-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-bold text-muted">{t("army.underArms")}</span>
            <span className="text-sm font-black tabular-nums text-ink">{count(troops, "troops", "thousands")}</span>
          </div>
          <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-divider" aria-hidden>
            <div className="h-full bg-ink" style={{ width: `${troops ? (men.pro / troops) * 100 : 0}%` }} />
            <div className="h-full bg-accent" style={{ width: `${troops ? (men.trained / troops) * 100 : 0}%` }} />
            <div className="h-full bg-warm" style={{ width: `${troops ? (men.recruits / troops) * 100 : 0}%` }} />
          </div>
          <ul className="mt-2 grid grid-cols-1 gap-1 text-xs">
            {(
              [
                ["pro", "bg-ink", men.pro],
                ["trained", "bg-accent", men.trained],
                ["recruits", "bg-warm", men.recruits],
              ] as const
            ).map(([key, dot, n]) => (
              <li key={key} className="flex items-baseline justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 font-medium text-muted">
                  <span className={`h-2 w-2 rounded-sm ${dot}`} />
                  {t(`army.${key}` as MessageKey)}
                </span>
                <span className="font-bold tabular-nums text-ink">{count(n, `men:${key}`, "thousands")}</span>
              </li>
            ))}
            {callable > 0 && (
              <li className="flex items-baseline justify-between gap-2 border-t border-divider pt-1">
                <span className="font-medium text-muted">{t("army.callable")}</span>
                <span className="font-bold tabular-nums text-muted">{count(callable, "callable", "thousands")}</span>
              </li>
            )}
          </ul>
        </div>
      </section>

      <section>
        <span className={`${ui.label} mb-1.5 block`}>{t("army.weapons")}</span>
        <ul className="flex flex-col gap-1.5">
          {ORDER.map((kind) => {
            const Icon = ARMS_ICONS[kind];
            const s = arsenal.stock[kind];
            const unit = kind === "rifles" ? "thousands" : "pieces";
            const made = arsenal.made?.[kind] ?? 0;
            const gone = arsenal.lost?.[kind] ?? 0;
            const got = arsenal.got?.[kind] ?? 0;
            if (!s && !can.has(kind)) {
              return (
                <li key={kind} className="flex items-center gap-2.5 rounded-xl border border-dashed border-line px-3 py-2 text-xs font-medium text-muted">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="font-bold text-ink">{t(`arms.kind.${kind}` as MessageKey)}</span> · {t("arms.notYet")}
                  </span>
                </li>
              );
            }
            // The level in service, and the level new ones are built at (engine/arsenal.ts buildLevel).
            const max = maxLevel(kind);
            const level = Math.round((s?.level ?? 0) * 10) / 10;
            const builds = buildLevel(state, state.player, kind, year);
            const types = isTyped(kind) ? (Object.entries(typesOf(s, kind, year)) as [ArmsType, number][]).filter(([, n]) => n > 0) : [];
            return (
              <li key={kind} className="rounded-xl border border-line sheet px-3 py-2">
                <div className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4 shrink-0 text-muted" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="truncate text-xs font-bold text-ink">{t(`arms.kind.${kind}` as MessageKey)}</span>
                      {s && s.n > 0 && (
                        <span className="cursor-help text-2xs font-bold tabular-nums text-muted" title={t("arms.levelHint", { max, n: builds })}>
                          {t("arms.level", { n: num(level), max })}
                          {builds > level + 0.05 && <span className="text-accent"> · {t("arms.levelNew", { n: builds })}</span>}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-2 text-2xs font-bold tabular-nums">
                      {made > 0 && <span className="text-emerald-700">{t("arms.made", { n: count(made, `made:${kind}`, unit) })}</span>}
                      {got > 0 && <span className="text-emerald-700">{t("arms.got", { n: count(got, `got:${kind}`, unit) })}</span>}
                      {gone > 0 && <span className="text-red-600">{t("arms.lost", { n: count(gone, `lost:${kind}`, unit) })}</span>}
                    </div>
                  </div>
                  <span className="text-sm font-black tabular-nums text-ink">{count(s?.n ?? 0, `stock:${kind}`, unit)}</span>
                </div>
                {types.length > 0 && (
                  <ul className="mt-1.5 flex flex-wrap gap-1 pl-6.5">
                    {types.map(([type, n]) => (
                      <li key={type} title={t(`arms.hint.${type}` as MessageKey)} className="inline-flex cursor-help items-baseline gap-1 rounded-md bg-page px-1.5 py-0.5 text-2xs font-bold text-muted">
                        <span>{t(`arms.type.${type}` as MessageKey)}</span>
                        <span className="tabular-nums text-ink">{count(n, `type:${type}`)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
        {orders.length > 0 && (
          <div className="mt-2 rounded-xl bg-page p-3" title={t("arms.orderHint")}>
            <span className={`${ui.label} mb-1 block`}>{t("arms.orders")}</span>
            <ul className="grid grid-cols-1 gap-0.5 text-xs">
              {orders.map((o) => (
                <li key={o.type} className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate font-medium text-muted">{t((o.type in TYPE_KIND ? `arms.type.${o.type}` : `arms.kind.${o.type}`) as MessageKey)}</span>
                  <span className="shrink-0 font-bold tabular-nums text-ink">{t("arms.order", { done: num(Math.floor(o.built)), n: num(o.n) })}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

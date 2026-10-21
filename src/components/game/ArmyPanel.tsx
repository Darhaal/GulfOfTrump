"use client";

import { Atom, MessageCircle, Star } from "lucide-react";
import { ui } from "@/components/ui/classes";
import { availableKinds, combatPower, enemiesOf, LEVEL_YEARS, needsOf, procurement } from "@/engine/arsenal";
import type { Accounts } from "@/engine/economy";
import { WEAPON_KINDS, type GameState, type WeaponKind } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import { ARMS_ICONS } from "./armsText";

interface ArmyPanelProps {
  state: GameState;
  accounts?: Accounts;
  disabled: boolean;
  onFocus: (kinds: WeaponKind[]) => void;
  onConsult: () => void;
}

/**
 * The player's weapons: how many of each kind, of what level, what the army
 * budget built and the war cost last turn, what arrived from abroad; which
 * kinds industry builds first; and the strength of each side in the
 * player's wars. New levels come from research (the science panel).
 */
export default function ArmyPanel({ state, accounts, disabled, onFocus, onConsult }: ArmyPanelProps) {
  const { t, text, money, locale } = useI18n();
  const arsenal = state.countries[state.player]?.arsenal;
  const can = new Set(availableKinds(state));
  const focus = arsenal?.focus ?? [];
  const buy = procurement(state);
  const shortages = new Set(accounts?.shortages ?? []);
  const slowed = [...new Set(WEAPON_KINDS.flatMap((k) => needsOf(k).filter((r) => shortages.has(r))))];
  const num = (n: number) => n.toLocaleString(locale);
  const enemies = enemiesOf(state).get(state.player);
  const wars = state.wars.filter((w) => !w.truce && (w.attackers.includes(state.player) || w.defenders.includes(state.player)));

  const toggle = (kind: WeaponKind) => {
    if (focus.includes(kind)) onFocus(focus.filter((k) => k !== kind));
    else onFocus([...focus, kind].slice(-2));
  };

  if (!arsenal) return <p className="text-xs font-medium text-muted">{t("arms.none")}</p>;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs font-medium leading-relaxed text-muted">{t("arms.intro")}</p>

      <div className="rounded-xl bg-page p-3 text-xs font-medium text-muted">
        <div>
          {t(buy.atWar ? "arms.buyingWar" : "arms.buying", { money: money(buy.yearly) })}
        </div>
        {slowed.length > 0 && <div className="mt-1 font-bold text-amber-700">{t("arms.shortage", { list: slowed.map((r) => t(`resource.${r}` as MessageKey)).join(", ") })}</div>}
        {arsenal.nuclear && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-ink px-2 py-1 text-2xs font-black uppercase tracking-wider text-on-ink">
            <Atom className="h-3 w-3" />
            {t("arms.nuclear")}
          </div>
        )}
      </div>

      <div>
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <span className={ui.label}>{t("arms.stock")}</span>
          <span className="text-2xs font-bold text-muted">{t("arms.focusHint")}</span>
        </div>
        <ul className="flex flex-col gap-1.5">
          {WEAPON_KINDS.map((kind) => {
            const Icon = ARMS_ICONS[kind];
            const s = arsenal.stock[kind];
            const made = arsenal.made?.[kind] ?? 0;
            const lost = arsenal.lost?.[kind] ?? 0;
            const got = arsenal.got?.[kind] ?? 0;
            const on = focus.includes(kind);
            if (!s && !can.has(kind)) {
              const first = LEVEL_YEARS[kind][0];
              return (
                <li key={kind} className="flex items-center gap-2.5 rounded-xl border border-dashed border-line px-3 py-2 text-xs font-medium text-muted">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="font-bold text-ink">{t(`arms.kind.${kind}` as MessageKey)}</span> · {t("arms.notYet", { year: first })}
                  </span>
                </li>
              );
            }
            return (
              <li key={kind} className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 ${on ? "border-accent/40 bg-accent/5" : "border-line bg-surface"}`}>
                <Icon className="h-4 w-4 shrink-0 text-muted" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="truncate text-xs font-bold text-ink">{t(`arms.kind.${kind}` as MessageKey)}</span>
                    {s && <span className="text-2xs font-black text-muted" title={t("arms.levelHint")}>{t("arms.level", { n: s.level.toLocaleString(locale) })}</span>}
                  </div>
                  <div className="flex flex-wrap gap-x-2 text-2xs font-bold tabular-nums">
                    {made > 0 && <span className="text-emerald-700">{t("arms.made", { n: num(made) })}</span>}
                    {got > 0 && <span className="text-emerald-700">{t("arms.got", { n: num(got) })}</span>}
                    {lost > 0 && <span className="text-red-600">{t("arms.lost", { n: num(lost) })}</span>}
                  </div>
                </div>
                <span className="text-sm font-black tabular-nums text-ink">{kind === "rifles" ? t("arms.thousands", { n: num(s?.n ?? 0) }) : num(s?.n ?? 0)}</span>
                <button
                  type="button"
                  onClick={() => toggle(kind)}
                  disabled={disabled || !can.has(kind)}
                  aria-pressed={on}
                  title={t("arms.focus")}
                  className="rounded-lg p-1 text-muted transition-colors hover:bg-page hover:text-accent disabled:opacity-40"
                >
                  <Star className={`h-3.5 w-3.5 ${on ? "fill-current text-accent" : ""}`} />
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-1.5 text-2xs font-medium text-muted">{t("arms.levelHint")}</p>
      </div>

      {wars.length > 0 && enemies && (
        <div>
          <span className={`${ui.label} mb-1.5 block`}>{t("arms.balance")}</span>
          <ul className="flex flex-col gap-2">
            {wars.map((w) => {
              const mine = w.attackers.includes(state.player) ? w.attackers : w.defenders;
              const theirs = w.attackers.includes(state.player) ? w.defenders : w.attackers;
              const us = mine.reduce((sum, tag) => sum + combatPower(state, tag), 0);
              const them = theirs.reduce((sum, tag) => sum + combatPower(state, tag), 0);
              const share = us + them > 0 ? (us / (us + them)) * 100 : 50;
              return (
                <li key={w.id} className="rounded-xl bg-page p-3">
                  <div className="truncate text-xs font-bold text-ink">{text(w.name)}</div>
                  <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-divider">
                    <div className="h-full bg-accent" style={{ width: `${share}%` }} />
                  </div>
                  <div className="mt-1 flex justify-between text-2xs font-bold tabular-nums text-muted">
                    <span>{t("arms.us", { n: Math.round(share) })}</span>
                    <span>{t("arms.them", { n: 100 - Math.round(share) })}</span>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-1.5 text-2xs font-medium text-muted">{t("arms.balanceHint")}</p>
        </div>
      )}

      <button type="button" onClick={onConsult} className={`${ui.secondary} px-4 py-2.5 text-xs`}>
        <MessageCircle className="h-4 w-4" />
        {t("arms.ask")}
      </button>
    </div>
  );
}

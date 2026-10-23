"use client";

import { Atom, MapPin, Plus, Star } from "lucide-react";
import { useState } from "react";
import { ui } from "@/components/ui/classes";
import { divisionsOf, menOf, tally } from "@/engine/army";
import { availableKinds, combatPower, enemiesOf, needsOf, procurement } from "@/engine/arsenal";
import { yearOf } from "@/engine/calendar";
import type { Accounts } from "@/engine/economy";
import { fogOn, foreignView } from "@/engine/fog";
import { shownStage } from "@/engine/intentions";
import { planKindKey, planStageKey } from "./changes";
import { provinceName } from "@/engine/provinces";
import { WEAPON_KINDS, type GameState, type MapRegion, type WeaponKind } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import { ARMS_ICONS } from "./armsText";
import RefineButton from "./RefineButton";

interface ArmyPanelProps {
  state: GameState;
  accounts?: Accounts;
  /** The map's provinces, for their names. */
  regions?: Record<string, MapRegion>;
  disabled: boolean;
  /** The game master is describing the army. */
  learning: boolean;
  onFocus: (kinds: WeaponKind[]) => void;
  /** Ask the game master how the army is organised now. */
  onLearn: () => void;
  /** Show these provinces on the map. */
  onShowRegions: (ids: string[]) => void;
  /** Add an order the player wrote to the turn's orders; false when it could not be added. */
  onOrder: (order: string) => boolean;
}

/**
 * The player's army: its soldiers by training, its weapons as the army's
 * books count them, its armies as the game master last described them,
 * and, at war, the fronts, each side's strength, the losses and the plans
 * known — with an offensive the player can order right there.
 */
export default function ArmyPanel({ state, accounts, regions, disabled, learning, onFocus, onLearn, onShowRegions, onOrder }: ArmyPanelProps) {
  const { t, text, money, locale } = useI18n();
  const [target, setTarget] = useState("");
  const [order, setOrder] = useState("");
  const [refused, setRefused] = useState(false);
  const player = state.countries[state.player];
  const arsenal = player?.arsenal;
  const can = new Set(availableKinds(state));
  const focus = arsenal?.focus ?? [];
  const buy = procurement(state);
  const shortages = new Set(accounts?.shortages ?? []);
  const slowed = [...new Set(WEAPON_KINDS.flatMap((k) => needsOf(k).filter((r) => shortages.has(r))))];
  const game = state.seed ?? state.id;
  const num = (n: number) => n.toLocaleString(locale);
  const count = (n: number, key: string, unit: "thousands" | "pieces" = "pieces") => num(tally(n, game, state.turn, `${state.player}:${key}`, unit));
  const country = (tag: string) => text(state.countries[tag]?.name ?? tag);
  const place = (id: string) => (regions?.[id] ? provinceName(regions[id], locale) : id);
  const year = yearOf(state.date);
  const enemies = enemiesOf(state).get(state.player) ?? new Set<string>();
  const wars = state.wars.filter((w) => !w.truce && (w.attackers.includes(state.player) || w.defenders.includes(state.player)));
  const organisation = arsenal?.organisation;

  const toggle = (kind: WeaponKind) => {
    if (focus.includes(kind)) onFocus(focus.filter((k) => k !== kind));
    else onFocus([...focus, kind].slice(-2));
  };

  if (!arsenal || !player?.economy) return <p className="text-xs font-medium text-muted">{t("arms.none")}</p>;

  const troops = player.economy.troops;
  const men = menOf(state, player);
  const callable = Math.max(0, (accounts?.mobilisable ?? 0) - troops);

  /** A side's divisions: the player's own exactly, others as the government knows them. */
  const sideForce = (tags: string[]) => {
    let low = 0;
    let high = 0;
    let exact = true;
    let soldiers = 0;
    for (const tag of tags) {
      const n = state.countries[tag]?.economy?.troops ?? 0;
      const seen = tag !== state.player && fogOn(state) ? foreignView(state, tag).troops : undefined;
      if (seen && !seen.exact) exact = false;
      low += divisionsOf(seen ? seen.low : n, year);
      high += divisionsOf(seen ? seen.high : n, year);
      soldiers += n;
    }
    return exact ? t("army.forceExact", { div: num(low), men: count(soldiers, `side:${tags.join("+")}`, "thousands") }) : t("army.forceEstimate", { low: num(low), high: num(high) });
  };

  const frontOf = (side: Set<string>, other: Set<string>) =>
    Object.entries(state.regions).filter(([, r]) => r.contested && ((side.has(r.controller) && other.has(r.contested)) || (other.has(r.controller) && side.has(r.contested))));

  const plans = (state.plans ?? []).filter((p) => {
    if (p.end || !shownStage(p)) return false;
    if (p.target === state.player) return true;
    if (p.kind === "join" && p.war && wars.some((w) => w.id === p.war)) return true;
    return p.kind === "war" && enemies.has(p.by);
  });

  const lost = Object.entries(arsenal.lost ?? {}).filter(([, n]) => (n ?? 0) > 0) as [WeaponKind, number][];

  const send = () => {
    const words = order.trim();
    if (!words) return;
    const who = organisation?.formations.find((f) => f.name === target);
    const added = onOrder(who ? `${who.name}: ${words}` : words);
    setRefused(!added);
    if (added) setOrder("");
  };

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
          <ul className="mt-2 grid gap-1 text-xs">
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
        <span className={`${ui.label} mb-1.5 block`}>{t("arms.stock")}</span>
        <ul className="flex flex-col gap-1.5">
          {WEAPON_KINDS.map((kind) => {
            const Icon = ARMS_ICONS[kind];
            const s = arsenal.stock[kind];
            const unit = kind === "rifles" ? "thousands" : "pieces";
            const made = arsenal.made?.[kind] ?? 0;
            const gone = arsenal.lost?.[kind] ?? 0;
            const got = arsenal.got?.[kind] ?? 0;
            const on = focus.includes(kind);
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
            return (
              <li key={kind} className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 ${on ? "border-accent/40 bg-accent/5" : "border-line sheet"}`}>
                <Icon className="h-4 w-4 shrink-0 text-muted" />
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold text-ink">{t(`arms.kind.${kind}` as MessageKey)}</span>
                  <div className="flex flex-wrap gap-x-2 text-2xs font-bold tabular-nums">
                    {made > 0 && <span className="text-emerald-700">{t("arms.made", { n: count(made, `made:${kind}`, unit) })}</span>}
                    {got > 0 && <span className="text-emerald-700">{t("arms.got", { n: count(got, `got:${kind}`, unit) })}</span>}
                    {gone > 0 && <span className="text-red-600">{t("arms.lost", { n: count(gone, `lost:${kind}`, unit) })}</span>}
                  </div>
                </div>
                <span className="text-sm font-black tabular-nums text-ink">{count(s?.n ?? 0, `stock:${kind}`, unit)}</span>
                <button
                  type="button"
                  onClick={() => toggle(kind)}
                  disabled={disabled || !can.has(kind)}
                  aria-pressed={on}
                  title={t("arms.focus")}
                  aria-label={t("arms.focus")}
                  className="rounded-lg p-1 text-muted transition-colors hover:bg-page hover:text-accent disabled:opacity-40"
                >
                  <Star className={`h-3.5 w-3.5 ${on ? "fill-current text-accent" : ""}`} />
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <span className={ui.label}>{t("army.formations")}</span>
        <RefineButton label={t("army.learn")} busy={learning} disabled={disabled} asOf={organisation?.date} onClick={onLearn} />
        {organisation?.formations.length ? (
          <ul className="flex flex-col gap-1.5">
            {organisation.formations.map((f) => (
              <li key={f.name} className="rounded-xl border border-line sheet p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate text-xs font-black text-ink">{f.name}</span>
                  <span className="shrink-0 text-2xs font-bold uppercase tracking-wider text-muted">{t(`army.kind.${f.kind}` as MessageKey)}</span>
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-2 text-2xs font-bold text-muted">
                  {f.divisions > 0 && <span className="tabular-nums text-ink">{t("army.divisions", { n: num(f.divisions) })}</span>}
                  {f.theatre && <span>{f.theatre}</span>}
                  {f.commander && <span>{t("army.commander", { name: f.commander })}</span>}
                </div>
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
            ))}
          </ul>
        ) : (
          <p className="text-xs font-medium text-muted">{t("army.formationsEmpty")}</p>
        )}
      </section>

      {wars.length > 0 && (
        <section className="flex flex-col gap-2">
          <span className={ui.label}>{t("army.fronts")}</span>
          {wars.map((w) => {
            const mine = w.attackers.includes(state.player) ? w.attackers : w.defenders;
            const theirs = w.attackers.includes(state.player) ? w.defenders : w.attackers;
            const us = mine.reduce((sum, tag) => sum + combatPower(state, tag), 0);
            const them = theirs.reduce((sum, tag) => sum + combatPower(state, tag), 0);
            const share = us + them > 0 ? (us / (us + them)) * 100 : 50;
            const line = frontOf(new Set(mine), new Set(theirs));
            return (
              <div key={w.id} className="rounded-xl bg-page p-3">
                <div className="truncate text-xs font-black text-ink">{text(w.name)}</div>
                <div className="mt-2 grid gap-0.5 text-2xs font-bold">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted">{t("army.ours")}</span>
                    <span className="tabular-nums text-ink">{sideForce(mine)}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted">{t("army.theirs")}</span>
                    <span className="tabular-nums text-ink">{sideForce(theirs)}</span>
                  </div>
                </div>
                <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-divider">
                  <div className="h-full bg-accent" style={{ width: `${share}%` }} />
                </div>
                <div className="mt-1 flex justify-between text-2xs font-bold tabular-nums text-muted">
                  <span>{t("arms.us", { n: Math.round(share) })}</span>
                  <span>{t("arms.them", { n: 100 - Math.round(share) })}</span>
                </div>
                <div className={`${ui.label} mt-3 mb-1`}>{t("army.frontLine")}</div>
                {line.length ? (
                  <ul className="grid gap-0.5 text-2xs font-medium text-muted">
                    {line.slice(0, 10).map(([id, r]) => (
                      <li key={id}>
                        <button type="button" onClick={() => onShowRegions([id])} className="text-left hover:text-accent">
                          <span className="font-bold text-ink">{place(id)}</span> · {country(r.controller)} · {t("army.holding", { who: country(r.contested!), n: r.held ?? 33 })}
                        </button>
                      </li>
                    ))}
                    {line.length > 10 && <li>+{line.length - 10}</li>}
                  </ul>
                ) : (
                  <p className="text-2xs font-medium text-muted">{t("army.noFront")}</p>
                )}
              </div>
            );
          })}

          {lost.length > 0 && (
            <div className="rounded-xl bg-page p-3 text-2xs font-bold">
              <div className={`${ui.label} mb-1`}>{t("army.lostLast")}</div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-red-600">
                {lost.map(([kind, n]) => (
                  <span key={kind}>
                    {t(`arms.kind.${kind}` as MessageKey)} −{count(n, `lost:${kind}`, kind === "rifles" ? "thousands" : "pieces")}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl bg-page p-3">
            <div className={`${ui.label} mb-1`}>{t("army.plans")}</div>
            {plans.length ? (
              <ul className="grid gap-1 text-2xs font-medium text-muted">
                {plans.map((p) => (
                  <li key={p.id}>
                    <span className="font-bold text-ink">{country(p.by)}</span> · {t(planKindKey(p))} · {t(planStageKey(p, shownStage(p)!))}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-2xs font-medium text-muted">{t("army.plansNone")}</p>
            )}
          </div>

          <div className="rounded-xl border border-line sheet p-3">
            <div className={`${ui.label} mb-2`}>{t("army.order")}</div>
            {organisation?.formations.length ? (
              <label className="mb-2 flex items-center gap-2 text-2xs font-bold text-muted">
                {t("army.orderFor")}
                <select value={target} onChange={(e) => setTarget(e.target.value)} className={`${ui.input} py-1.5 text-xs`}>
                  <option value="">{t("army.orderAll")}</option>
                  {organisation.formations.map((f) => (
                    <option key={f.name} value={f.name}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <textarea
              value={order}
              onChange={(e) => setOrder(e.target.value.slice(0, 900))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={3}
              placeholder={t("army.orderPlaceholder")}
              disabled={disabled}
              className={`${ui.input} resize-none text-xs`}
            />
            <button type="button" onClick={send} disabled={disabled || !order.trim()} className={`${ui.primary} mt-2 w-full px-3 py-2 text-2xs`}>
              <Plus className="h-3.5 w-3.5" />
              {t("army.orderAdd")}
            </button>
            {refused && <p className="mt-1.5 text-2xs font-bold text-amber-700">{t("army.ordersFull")}</p>}
            {state.draft.length > 0 && (
              <div className="mt-3">
                <div className={`${ui.label} mb-1`}>{t("army.pending")}</div>
                <ol className="grid gap-0.5 text-2xs font-medium text-muted">
                  {state.draft.map((o, i) => (
                    <li key={i} className="truncate">
                      {i + 1}. {o}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

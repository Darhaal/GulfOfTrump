"use client";

import Dictation from "@/components/voice/Dictation";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { ui } from "@/components/ui/classes";
import DoneButton from "@/components/ui/DoneButton";
import { divisionsOf } from "@/engine/army";
import { combatPower, enemiesOf } from "@/engine/arsenal";
import { formatDate, yearOf } from "@/engine/calendar";
import { fogOn, foreignView } from "@/engine/fog";
import { frontStrength, islandTargets, warFront, type FrontStrength } from "@/engine/fronts";
import { shownStage } from "@/engine/intentions";
import type { GameState, MapIndex, MapRegion, War } from "@/engine/types";
import { useI18n } from "@/i18n/useI18n";
import { planKindKey, planStageKey } from "../changes";
import WarMeans from "../WarMeans";
import RenameOrder from "../RenameOrder";
import type { Suggest } from "../Suggestions";
import WarOutlook from "../WarOutlook";
import { ordersFull } from "../DraftedOrders";
import CivilWarCard from "./CivilWarCard";
import { CountryFlag, MapButton, monthsBetween, PlaceLink, playerWars, sidesOf, useArmyWords, type ShowTurn } from "./common";
import FrontChanges from "./FrontChanges";
import NuclearLines from "./NuclearLines";

interface ArmyFrontsProps {
  state: GameState;
  regions?: Record<string, MapRegion> | null;
  index: MapIndex | null;
  disabled: boolean;
  /** The turn whose front changes are shown; null for the latest. */
  frontTurn: number | null;
  onFrontTurn: (turn: number | null) => void;
  onShowTurn?: ShowTurn;
  onShowRegions: (ids: string[]) => void;
  onOrder: (order: string) => boolean;
  /** Names from the game master for a war renamed by order (engine/suggest.ts). */
  onSuggest?: Suggest;
}

/** A war's theatre: the part of its front joined by land or a narrow strait (engine/fronts.ts), named after its most populous provinces. */
interface Theatre {
  provinces: string[];
  /** Fought over, the most held by the attacker first. */
  contested: string[];
  /** The countries whose land it runs through, the most first. */
  owners: string[];
  /** Its provinces by their people, the most first: the first two name it. */
  named: string[];
}

function theatresOf(state: GameState, index: MapIndex, war: War, strength: FrontStrength | null): Theatre[] {
  const front = warFront(state, index, war);
  const byTheatre = new Map<number, string[]>();
  for (const id of front) {
    const n = (!war.truce && strength?.theatreOf(war, id)) || 1;
    byTheatre.set(n, [...(byTheatre.get(n) ?? []), id]);
  }
  const a = new Set(war.attackers);
  return [...byTheatre.values()]
    .map((provinces) => {
      const owners = new Map<string, number>();
      for (const id of provinces) owners.set(state.regions[id].owner, (owners.get(state.regions[id].owner) ?? 0) + 1);
      const contested = provinces
        .filter((id) => {
          const r = state.regions[id];
          return r.contested && a.has(r.contested) !== a.has(r.controller) && (war.attackers.includes(r.contested) || war.defenders.includes(r.contested));
        })
        .sort((x, y) => (state.regions[y].held ?? 0) - (state.regions[x].held ?? 0));
      const named = [...provinces].sort((x, y) => (index.regions[y]?.pop ?? 0) - (index.regions[x]?.pop ?? 0));
      return { provinces, contested, owners: [...owners.entries()].sort((x, y) => y[1] - x[1]).map(([tag]) => tag), named };
    })
    .sort((x, y) => y.contested.length - x.contested.length || y.provinces.length - x.provinces.length);
}

/**
 * The army's wars: the turn's front changes in full, then each war with the
 * divisions on each side and their strength, its means and pace (WarMeans),
 * how it may end (WarOutlook), the atomic powers' rungs and red lines
 * (NuclearLines) and its theatres with the provinces fought
 * over; then the enemy's plans known and an offensive to order.
 */
/** Below this many thousand soldiers carried and kept ashore, a landing wants landing ships and transports first. */
const FEW_LIFT = 5;

/**
 * The islands and shores the player's side could land on in a war: about how many soldiers its ships could put ashore
 * and keep supplied there, the odds once ashore, and what is missing – landing ships to order from industry, or the
 * sea and the air, which the enemy holds (Malta while NATO holds the sea; Taiwan with no ships ordered).
 */
function Landings({ state, index, war, strength, mine, theirs, place, onOrder, disabled }: { state: GameState; index: MapIndex; war: War; strength: FrontStrength; mine: string[]; theirs: string[]; place: (id: string) => string; onOrder?: (order: string) => boolean; disabled?: boolean }) {
  const { t } = useI18n();
  const orders = new Set([...state.draft, ...(state.standing ?? [])]);
  // What is missing, given as an order of the turn on one press: the game master turns it into industry's orders or the fleet's task.
  const orderButton = (line: string) =>
    onOrder ? (
      <DoneButton
        compact
        icon={Plus}
        label={t("army.landing.order")}
        doneLabel={t("done.inOrders")}
        done={orders.has(line)}
        disabled={disabled}
        hint={line}
        onAct={() => onOrder(line)}
        className="ml-1 inline-grid h-5 w-5 place-items-center rounded-md border border-line sheet align-middle text-muted hover:border-accent/40 hover:text-accent disabled:opacity-50"
      />
    ) : null;
  const targets = islandTargets(state, index, mine, theirs, strength.means, 3);
  if (!targets.length) return null;
  return (
    <div>
      <div className={`${ui.label} mb-1`}>{t("army.landing.title")}</div>
      <ul className="grid gap-1.5">
        {targets.map((id) => {
          const lift = Math.round(mine.reduce((sum, tag) => sum + Math.min(1e6, strength.means.lift(tag, id, mine, theirs)), 0));
          const odds = Math.round(2 ** strength.landing(war, mine, theirs, id).edge * 10) / 10;
          const strait = lift >= 1e6;
          return (
            <li key={id} className="rounded-lg bg-surface px-2.5 py-2 text-xs font-medium leading-snug text-ink">
              <div>{strait ? t("army.landing.strait", { place: place(id), odds }) : t("army.landing.line", { place: place(id), n: lift, odds })}</div>
              {!strait && lift < FEW_LIFT && (
                <div className="mt-0.5 text-2xs font-bold text-accent">
                  {t("army.landing.ships")}
                  {orderButton(t("army.landing.shipsOrder", { place: place(id) }))}
                </div>
              )}
              {odds < 1 && (
                <div className="mt-0.5 text-2xs font-bold text-muted">
                  {t("army.landing.sea")}
                  {orderButton(t("army.landing.seaOrder", { place: place(id) }))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function ArmyFronts({ state, regions, index, disabled, frontTurn, onFrontTurn, onShowTurn, onShowRegions, onOrder, onSuggest }: ArmyFrontsProps) {
  const { t, text, locale } = useI18n();
  const { num, count, country, place } = useArmyWords(state, regions);
  const [target, setTarget] = useState("");
  const [order, setOrder] = useState("");
  const [refused, setRefused] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const wars = playerWars(state);
  const fighting = wars.filter((w) => !w.truce);
  // One reading of the fronts' strength for every war's theatres.
  const strength = useMemo(() => (index && state.wars.some((w) => !w.truce) ? frontStrength(state, index) : null), [state, index]);
  const year = yearOf(state.date);
  const enemies = enemiesOf(state).get(state.player) ?? new Set<string>();
  const organisation = state.countries[state.player]?.arsenal?.organisation;

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
  const span = (since: string) => {
    const months = monthsBetween(since, state.date);
    if (months < 1) return t("foreign.span.new");
    const years = Math.floor(months / 12);
    return [years ? t("foreign.span.y", { n: years }) : "", months % 12 ? t("foreign.span.m", { n: months % 12 }) : ""].filter(Boolean).join(" ");
  };

  const plans = (state.plans ?? []).filter((p) => {
    if (p.end || !shownStage(p)) return false;
    if (p.target === state.player) return true;
    if (p.kind === "join" && p.war && wars.some((w) => w.id === p.war)) return true;
    return p.kind === "war" && enemies.has(p.by);
  });

  const send = (): boolean => {
    const words = order.trim();
    if (!words) return false;
    const who = organisation?.formations.find((f) => f.name === target);
    const added = onOrder(who ? `${who.name}: ${words}` : words);
    setRefused(!added);
    if (added) setOrder("");
    return added;
  };

  return (
    <div className="flex flex-col gap-4">
      <FrontChanges state={state} regions={regions} turn={frontTurn} onTurn={onFrontTurn} onShowTurn={onShowTurn} onShowRegions={onShowRegions} />

      {wars.length === 0 && <p className="text-xs font-medium text-muted">{t("fronts.peace")}</p>}

      {wars.map((w) => {
        const { mine, theirs } = sidesOf(state, w);
        const us = mine.reduce((sum, tag) => sum + combatPower(state, tag), 0);
        const them = theirs.reduce((sum, tag) => sum + combatPower(state, tag), 0);
        const share = us + them > 0 ? (us / (us + them)) * 100 : 50;
        const labels: [string, string] = w.attackers.includes(state.player) ? [t("army.ours"), t("army.theirs")] : [t("army.theirs"), t("army.ours")];
        const theatres = index ? theatresOf(state, index, w, strength) : [];
        return (
          <section key={w.id} className="grid grid-cols-1 gap-3 rounded-xl bg-page p-3">
            <div>
              <div className="flex items-start justify-between gap-2">
                {/* A war the player fights may be renamed by order (engine/acts.ts). */}
                <span className="flex min-w-0 flex-1 flex-wrap items-start gap-x-1">
                  <span className="min-w-0 text-sm font-black text-ink">{text(w.name)}</span>
                  <RenameOrder key={`war-${w.id}`} what="war" current={text(w.name)} onOrder={onOrder} onSuggest={onSuggest} disabled={disabled} full={ordersFull(state)} />
                </span>
                {w.truce && (
                  <span className="shrink-0 rounded-md bg-amber-50 px-2 py-0.5 text-2xs font-black uppercase tracking-wider text-amber-700">{t("foreign.truceUntil", { date: formatDate(w.truce.until, locale) })}</span>
                )}
              </div>
              <div className="mt-0.5 text-2xs font-bold tabular-nums text-muted">{t("foreign.since", { date: formatDate(w.since, locale), span: span(w.since) })}</div>
              <div className="mt-2 grid grid-cols-1 gap-0.5 text-2xs font-bold">
                <div className="flex justify-between gap-2">
                  <span className="text-muted">{t("army.ours")}</span>
                  <span className="text-right tabular-nums text-ink">{sideForce(mine)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted">{t("army.theirs")}</span>
                  <span className="text-right tabular-nums text-ink">{sideForce(theirs)}</span>
                </div>
              </div>
              <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-divider" title={t("arms.balance")}>
                <div className="h-full bg-accent" style={{ width: `${share}%` }} />
              </div>
              <div className="mt-1 flex justify-between text-2xs font-bold tabular-nums text-muted">
                <span>{t("arms.us", { n: Math.round(share) })}</span>
                <span>{t("arms.them", { n: 100 - Math.round(share) })}</span>
              </div>
            </div>

            <CivilWarCard state={state} war={w} regions={regions ?? undefined} />

            {!w.truce && <WarMeans state={state} war={w} index={index} labels={labels} oursFirst />}

            <WarOutlook state={state} war={w} index={index} labels={labels} />

            {/* The atomic powers in the war: their rungs and red lines (engine/nuclear.ts). */}
            <NuclearLines state={state} war={w} index={index} />

            {/* Where the side could land, what its ships carry and what stands in the way (engine/warMeans.ts lift). */}
            {index && strength && !w.truce && <Landings state={state} index={index} war={w} strength={strength} mine={mine} theirs={theirs} place={place} onOrder={onOrder} disabled={disabled} />}

            {index && (
              <div>
                <div className={`${ui.label} mb-1`}>{t("fronts.theatres")}</div>
                {theatres.length ? (
                  <ul className="grid grid-cols-1 gap-2">
                    {theatres.map((th) => {
                      const key = `${w.id}:${th.provinces[0]}`;
                      const all = open.has(key);
                      const shown = all || th.contested.length <= 8 ? th.contested : th.contested.slice(0, 6);
                      return (
                        <li key={key} className="rounded-lg border border-line sheet px-2.5 py-2">
                          <div className="flex items-start gap-1.5">
                            <span className="mt-0.5 flex shrink-0 gap-1">
                              {th.owners.slice(0, 3).map((tag) => (
                                <CountryFlag key={tag} state={state} tag={tag} />
                              ))}
                            </span>
                            <span className="line-clamp-2 min-w-0 text-xs font-black text-ink">
                              {th.named.slice(0, 2).map(place).join(", ")}
                              {th.named.length > 2 && <span className="font-bold text-muted"> +{th.named.length - 2}</span>}
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-center justify-between gap-2">
                            <span className="min-w-0 truncate text-2xs font-bold tabular-nums text-muted">{t("fronts.theatre", { n: th.provinces.length, m: th.contested.length })}</span>
                            <MapButton label={t("army.onMap")} onClick={() => onShowRegions(th.provinces)} />
                          </div>
                          {shown.length > 0 && (
                            <ul className="mt-1 grid grid-cols-1 gap-0.5">
                              {shown.map((id) => {
                                const r = state.regions[id];
                                return (
                                  <li key={id} className="flex items-baseline justify-between gap-2 text-xs">
                                    <PlaceLink name={place(id)} onClick={() => onShowRegions([id])} />
                                    <span className="shrink-0 text-2xs font-bold tabular-nums text-muted">{t("army.holding", { who: country(r.contested!), n: r.held ?? 33 })}</span>
                                  </li>
                                );
                              })}
                              {shown.length < th.contested.length && (
                                <li>
                                  <button type="button" onClick={() => setOpen((s) => new Set(s).add(key))} className="text-2xs font-black uppercase tracking-wider text-muted hover:text-accent">
                                    {t("fronts.all", { n: th.contested.length })}
                                  </button>
                                </li>
                              )}
                            </ul>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-2xs font-medium text-muted">{t("fronts.noLand")}</p>
                )}
              </div>
            )}
          </section>
        );
      })}

      {fighting.length > 0 && (
        <>
          <div className="rounded-xl bg-page p-3">
            <div className={`${ui.label} mb-1`}>{t("army.plans")}</div>
            {plans.length ? (
              <ul className="grid grid-cols-1 gap-1 text-2xs font-medium text-muted">
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
            <Dictation id="army-front" set={setOrder} max={900}>
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
            </Dictation>
            {/* A moment of "in orders" once it went in, as every action that adds an order says. */}
            <DoneButton
              label={t("army.orderAdd")}
              icon={Plus}
              doneLabel={t("done.inOrders")}
              onAct={send}
              disabled={disabled || !order.trim()}
              className={`${ui.primary} mt-2 w-full px-3 py-2 text-2xs`}
              doneClassName={`${ui.done} mt-2 flex w-full items-center justify-center gap-1 rounded-xl px-3 py-2 text-2xs font-black uppercase tracking-wider`}
            />
            {refused && <p className="mt-1.5 text-2xs font-bold text-amber-700">{t("army.ordersFull")}</p>}
            {state.draft.length > 0 && (
              <div className="mt-3">
                <div className={`${ui.label} mb-1`}>{t("army.pending")}</div>
                <ol className="grid grid-cols-1 gap-0.5 text-2xs font-medium text-muted">
                  {state.draft.map((o, i) => (
                    <li key={i} className="truncate">
                      {i + 1}. {o}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

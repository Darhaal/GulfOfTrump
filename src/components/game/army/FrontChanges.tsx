"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import { ui } from "@/components/ui/classes";
import { formatDate } from "@/engine/calendar";
import type { AppliedChange, GameState, MapRegion, War } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import { frontCounts, isFrontChange } from "../changes";
import { CountryFlag, MapButton, PlaceLink, sidesOf, useArmyWords, type ShowTurn } from "./common";
import SectorTurns from "./SectorTurns";

type FrontChange = Extract<AppliedChange, { kind: "occupy" | "liberate" | "behind" | "contest" | "repel" }>;
type Moved = Extract<FrontChange, { kind: "occupy" | "liberate" | "behind" }>;

/** How many lines a list shows before "All N". */
const FOLD = 8;

/** The two countries a front change is between: the one that moved and the one it moved against. */
const partiesOf = (c: FrontChange): [string, string] => (c.kind === "contest" || c.kind === "repel" ? [c.by, c.holder] : [c.to, c.from]);

interface Group {
  key: string;
  war?: War;
  /** Two countries whose war is over by now: the group is named after them. */
  pair: [string, string];
  occupied: Map<string, string[]>;
  contested: Extract<FrontChange, { kind: "contest" }>[];
  liberated: Map<string, string[]>;
  repelled: Extract<FrontChange, { kind: "repel" }>[];
  behind: Map<string, string[]>;
  regions: Set<string>;
}

/** A turn's front changes by war: the player's wars first, then the rest by how much moved. */
function groupChanges(state: GameState, applied: AppliedChange[]): Group[] {
  const groups = new Map<string, Group>();
  const warOf = (a: string, b: string) => state.wars.find((w) => (w.attackers.includes(a) && w.defenders.includes(b)) || (w.attackers.includes(b) && w.defenders.includes(a)));
  const add = (list: Map<string, string[]>, c: Moved) => list.set(c.to, [...(list.get(c.to) ?? []), c.region]);
  for (const c of applied) {
    if (!isFrontChange(c)) continue;
    const change = c as FrontChange;
    // A province "taken" from its own holder moved nothing (changes.ts frontCounts), nor did a front a peace closed.
    if ((change.kind === "occupy" || change.kind === "liberate") && change.from === change.to) continue;
    if (change.kind === "repel" && change.settled) continue;
    const [a, b] = partiesOf(change);
    const war = warOf(a, b);
    const key = war?.id ?? `pair:${[a, b].sort().join("+")}`;
    let g = groups.get(key);
    if (!g) {
      g = { key, war, pair: [a, b], occupied: new Map(), contested: [], liberated: new Map(), repelled: [], behind: new Map(), regions: new Set() };
      groups.set(key, g);
    }
    g.regions.add(change.region);
    if (change.kind === "occupy") add(g.occupied, change);
    else if (change.kind === "liberate") add(g.liberated, change);
    else if (change.kind === "behind") add(g.behind, change);
    else if (change.kind === "contest") g.contested.push(change);
    else g.repelled.push(change);
  }
  const mine = (g: Group) => Boolean(g.war && (g.war.attackers.includes(state.player) || g.war.defenders.includes(state.player)));
  return [...groups.values()].sort((x, y) => Number(mine(y)) - Number(mine(x)) || y.regions.size - x.regions.size);
}

/** A list folded after a few lines, with "All N" to open it: a line of its own in a list, or the last of a run of words (`inline`). */
function Folded<T>({ items, render, limit = FOLD, inline = false }: { items: T[]; render: (item: T, i: number) => ReactNode; limit?: number; inline?: boolean }) {
  const { t } = useI18n();
  const [all, setAll] = useState(false);
  const shown = all || items.length <= limit + 2 ? items : items.slice(0, limit);
  const more = (
    <button type="button" onClick={() => setAll(true)} className="text-2xs font-black uppercase tracking-wider text-muted hover:text-accent">
      {t("fronts.all", { n: items.length })}
    </button>
  );
  return (
    <>
      {shown.map(render)}
      {shown.length < items.length && (inline ? more : <li>{more}</li>)}
    </>
  );
}

interface FrontChangesProps {
  state: GameState;
  regions?: Record<string, MapRegion> | null;
  /** The turn shown; null for the latest. */
  turn: number | null;
  onTurn: (turn: number | null) => void;
  /** Shows the turn's changes on the map, or some of its provinces; without it a province is only brought into view. */
  onShowTurn?: ShowTurn;
  onShowRegions: (ids: string[]) => void;
}

/**
 * A turn's front changes in full, which the turn report counts in one line:
 * the provinces occupied, fought over (the share held before and after),
 * liberated, pushed back and left behind the front, war by war. Every
 * province leads to the map, which lights the turn's changes as the
 * chronicle's "On the map" does; arrows step to the turns before.
 */
export default function FrontChanges({ state, regions, turn, onTurn, onShowTurn, onShowRegions }: FrontChangesProps) {
  const { t, text, locale } = useI18n();
  const { country, place } = useArmyWords(state, regions);
  const latest = state.chronicle.at(-1);
  if (!latest) return null;
  // The turns worth stepping through: those the fronts moved or the player's formations fought in, and the latest.
  const turns = [...new Set([...state.chronicle.filter((e) => e.applied.some(isFrontChange) || e.sectors?.length).map((e) => e.turn), latest.turn])].sort((a, b) => a - b);
  const shown = turn !== null && turns.includes(turn) ? turn : latest.turn;
  const entry = state.chronicle.find((e) => e.turn === shown) ?? latest;
  const at = turns.indexOf(shown);
  const prev = at > 0 ? turns[at - 1] : undefined;
  const next = at < turns.length - 1 ? turns[at + 1] : undefined;
  const go = (n: number) => onTurn(n === latest.turn ? null : n);
  const groups = groupChanges(state, entry.applied);
  // The report's count, as a sentence of its own.
  const counts = frontCounts(entry.applied);
  const summary = [counts.taken ? t("report.fronts.taken", { n: counts.taken }) : "", counts.moved ? t("report.fronts.moved", { n: counts.moved }) : ""].filter(Boolean).join("; ");
  const show = (ids: string[]) => (onShowTurn ? onShowTurn(entry.turn, ids) : onShowRegions(ids));
  const link = (id: string) => <PlaceLink key={id} name={place(id)} onClick={() => show([id])} />;

  /** Provinces that changed hands, by who has them now. */
  const moved = (label: MessageKey, list: Map<string, string[]>) => {
    if (!list.size) return null;
    const n = [...list.values()].reduce((s, ids) => s + ids.length, 0);
    return (
      <div>
        <div className="text-2xs font-black uppercase tracking-wider text-muted">
          {t(label)} · {n}
        </div>
        <ul className="mt-0.5 grid grid-cols-1 gap-1">
          {[...list.entries()].map(([to, ids]) => (
            <li key={to} className="flex items-start gap-1.5 text-xs">
              <span className="mt-0.5">
                <CountryFlag state={state} tag={to} />
              </span>
              <span className="flex min-w-0 flex-wrap gap-x-2 gap-y-0.5">
                <Folded items={ids} limit={12} inline render={(id) => <span key={id} className="inline-flex min-w-0">{link(id)}</span>} />
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <section className="rounded-xl border border-line sheet p-3">
      <div className="flex items-center justify-between gap-2">
        <span className={ui.label}>{t("fronts.changes")}</span>
        {groups.length > 0 && <MapButton label={t("army.onMap")} onClick={() => (onShowTurn ? onShowTurn(entry.turn) : onShowRegions(groups.flatMap((g) => [...g.regions])))} />}
      </div>
      {/* The turn shown, with arrows to the others the fronts moved in. */}
      <div className="mt-1.5 flex items-center gap-1">
        {turns.length > 1 && (
          <button type="button" onClick={() => prev !== undefined && go(prev)} disabled={prev === undefined} aria-label={t("fronts.prev")} title={t("fronts.prev")} className="rounded-md p-0.5 text-muted hover:bg-page hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent">
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        <span className={`min-w-0 flex-1 truncate text-2xs font-bold tabular-nums text-muted ${turns.length > 1 ? "text-center" : ""}`}>
          <span className="font-black text-ink">{t("game.turn", { n: entry.turn })}</span> · {t("game.period", { from: formatDate(entry.from, locale), to: formatDate(entry.to, locale) })}
        </span>
        {turns.length > 1 && (
          <button type="button" onClick={() => next !== undefined && go(next)} disabled={next === undefined} aria-label={t("fronts.next")} title={t("fronts.next")} className="rounded-md p-0.5 text-muted hover:bg-page hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent">
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
      <SectorTurns state={state} regions={regions} entry={entry} onShow={show} />
      {groups.length ? (
        <>
          {summary && <p className="mt-1.5 text-xs font-bold text-ink">{summary.charAt(0).toLocaleUpperCase(locale) + summary.slice(1)}</p>}
          <div className="mt-2 grid grid-cols-1 gap-3">
            {groups.map((g) => {
              const ours = g.war ? new Set(sidesOf(state, g.war).mine) : null;
              const mine = Boolean(g.war && ours && (g.war.attackers.includes(state.player) || g.war.defenders.includes(state.player)));
              /** A share won or lost, toned for the player: their side gaining reads green, losing red; others' wars plain. */
              const tone = (by: string, delta: number) => (!mine || delta === 0 ? "text-muted" : ours!.has(by) === delta > 0 ? "text-emerald-700" : "text-red-600");
              return (
                <div key={g.key} className="grid grid-cols-1 gap-2 border-t border-divider pt-2 first:border-t-0 first:pt-0">
                  {groups.length > 1 && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-xs font-black text-ink">{g.war ? text(g.war.name) : `${country(g.pair[0])} – ${country(g.pair[1])}`}</span>
                      <MapButton label={t("army.onMap")} onClick={() => show([...g.regions])} />
                    </div>
                  )}
                  {moved("fronts.occupied", g.occupied)}
                  {g.contested.length > 0 && (
                    <div>
                      <div className="text-2xs font-black uppercase tracking-wider text-muted">
                        {t("fronts.contested")} · {g.contested.length}
                      </div>
                      <ul className="mt-0.5 grid grid-cols-1 gap-0.5">
                        <Folded
                          items={[...g.contested].sort((x, y) => Math.abs((y.held ?? 0) - (y.was ?? 0)) - Math.abs((x.held ?? 0) - (x.was ?? 0)))}
                          render={(c) => {
                            const delta = c.held !== undefined && c.was !== undefined ? c.held - c.was : 0;
                            return (
                              <li key={c.region} className="flex items-baseline justify-between gap-2 text-xs">
                                {link(c.region)}
                                <span className="shrink-0 text-2xs font-bold tabular-nums text-muted">
                                  {c.held === undefined
                                    ? country(c.by)
                                    : c.was === undefined
                                      ? t("fronts.shareNew", { who: country(c.by), now: c.held })
                                      : t("fronts.shareMove", { who: country(c.by), was: c.was, now: c.held })}
                                  {delta !== 0 && <span className={`ml-1 font-black ${tone(c.by, delta)}`}>{delta > 0 ? `+${delta}` : `−${-delta}`}</span>}
                                </span>
                              </li>
                            );
                          }}
                        />
                      </ul>
                    </div>
                  )}
                  {moved("fronts.liberated", g.liberated)}
                  {g.repelled.length > 0 && (
                    <div>
                      <div className="text-2xs font-black uppercase tracking-wider text-muted">
                        {t("fronts.repelled")} · {g.repelled.length}
                      </div>
                      <ul className="mt-0.5 grid grid-cols-1 gap-0.5">
                        <Folded
                          items={g.repelled}
                          render={(c) => (
                            <li key={c.region} className="flex flex-wrap items-baseline justify-between gap-x-2 text-xs">
                              {link(c.region)}
                              <span className="ml-auto text-right text-2xs font-bold text-muted">{t("fronts.repel", { by: country(c.by), holder: country(c.holder) })}</span>
                            </li>
                          )}
                        />
                      </ul>
                    </div>
                  )}
                  {moved("fronts.behind", g.behind)}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <p className="mt-1.5 text-xs font-medium text-muted">{t("fronts.none")}</p>
      )}
    </section>
  );
}

"use client";

import { Ban, Check, Medal, Minus, Plus, Trophy } from "lucide-react";
import { type ReactNode, useMemo } from "react";
import { ui } from "@/components/ui/classes";
import Flag from "@/components/Flag";
import { formatDate } from "@/engine/calendar";
import { countryName } from "@/engine/names";
import type { Access } from "@/engine/remit";
import { canBoycott, canPlayerBid, MAX_SPORT_SHARE, normShare, setSportShare, sportMoney, sportShare, sportStrength, sportSystem, toggleBid, toggleBoycott, voteDate } from "@/engine/sport";
import { GAMES_KINDS, type GameState, type Games, type MapRegion } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import { gamesTitle, gamesWhere } from "./sportText";

interface SportPanelProps {
  state: GameState;
  /** The map's provinces, for each country's people and so its sporting strength. */
  regions?: Record<string, MapRegion> | null;
  disabled: boolean;
  /** Only the government bids, boycotts and sets the money; another role reads. */
  mode: Access;
  onState: (next: GameState) => void;
  /** Adds an order to the turn: giving up Games the country hosts is the game master's to tell. */
  onOrder: (order: string) => void;
}

/** Points a click moves the money for sport, of the social budget. */
const STEP = 0.5;
/** The Games shown ahead. */
const COMING = 5;
/** Rows of a medal table shown besides the player's. */
const ROWS = 8;

/**
 * Sport, beside parliament, the parties and the street: the country's
 * sporting strength and its money for sport; the coming Olympic Games and
 * World Cups with their hosts or the year the host is chosen, where the
 * government bids, stays away or gives up its own Games; the countries
 * barred; and the last Games of each kind as they went (engine/sport.ts).
 */
export default function SportPanel({ state, regions, disabled, mode, onState, onOrder }: SportPanelProps) {
  const { t, text, locale, money } = useI18n();
  const sport = state.sport;
  const strength = useMemo(() => (state.sport ? sportStrength(state, regions) : new Map<string, number>()), [state, regions]);
  if (!sport) return null;
  const acts = mode === "govern" && !disabled;
  const country = (tag: string) => text(state.countries[tag]?.name ?? countryName(tag) ?? tag);
  const flag = (tag: string) => <Flag tag={tag} scenario={state.scenarioId} color={state.countries[tag]?.color} size="sm" />;
  const share = sportShare(state);

  const mine = strength.get(state.player) ?? 0;
  const rank = [...strength.values()].filter((v) => v > mine).length + 1;
  const coming = sport.games.filter((g) => g.status === "planned").slice(0, COMING);
  const last = GAMES_KINDS.map((k) => sport.games.filter((g) => g.kind === k && g.status !== "planned").at(-1)).filter((g): g is Games => Boolean(g));
  const year = (date: string) => date.slice(0, 4);

  return (
    <div className="flex flex-col gap-3">
      <section className={`${ui.card} flex flex-col gap-2 p-3`}>
        <span className={`${ui.label} flex cursor-help items-center gap-1.5`} title={t("sport.hint")}>
          <Trophy className="h-3.5 w-3.5" />
          {t("politics.tab.sport")}
        </span>
        <div className="text-sm font-black leading-snug text-ink">{t("sport.rank", { n: rank })}</div>
        <div className="flex flex-wrap items-center gap-1.5 text-2xs font-bold text-muted">
          <span className="tabular-nums">{t("sport.form", { n: (sport.form ?? 1).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) })}</span>
          {sportSystem(state, state.player) > 1 && <span className="rounded-md bg-accent/10 px-1.5 py-0.5 font-black uppercase tracking-wider text-accent">{t("sport.system")}</span>}
        </div>
        <div className="flex items-center gap-2 border-t border-divider pt-2">
          <span className="min-w-0 flex-1 text-2xs font-bold tabular-nums text-ink">{t("sport.share", { n: share.toLocaleString(locale), value: money(sportMoney(state)) })}</span>
          <button
            type="button"
            disabled={!acts || share <= 0}
            onClick={() => onState(setSportShare(state, share - STEP))}
            title={t("sport.less", { n: STEP.toLocaleString(locale) })}
            aria-label={t("sport.less", { n: STEP.toLocaleString(locale) })}
            className={`${ui.iconButton} p-1 disabled:opacity-40`}
          >
            <Minus className="h-3 w-3" />
          </button>
          <button
            type="button"
            disabled={!acts || share >= MAX_SPORT_SHARE}
            onClick={() => onState(setSportShare(state, share + STEP))}
            title={t("sport.more", { n: STEP.toLocaleString(locale) })}
            aria-label={t("sport.more", { n: STEP.toLocaleString(locale) })}
            className={`${ui.iconButton} p-1 disabled:opacity-40`}
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
        <p className="text-2xs font-medium text-muted">{t("sport.usual", { n: normShare(state, state.player).toLocaleString(locale) })}</p>
      </section>

      {coming.length > 0 && (
        <section>
          <div className={`${ui.label} mb-2`}>{t("sport.coming")}</div>
          <ul className="flex flex-col gap-1.5">
            {coming.map((g) => {
              const ours = g.hosts.includes(state.player);
              const bidding = Boolean(sport.bids?.includes(g.id));
              const away = Boolean(sport.boycotts?.includes(g.id));
              const underway = g.opens <= state.date;
              const order = t("sport.order.giveUp", { games: gamesTitle(g, t) });
              return (
                <li key={g.id} className="rounded-xl bg-page px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-black leading-snug text-ink">{gamesTitle(g, t)}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1 text-2xs font-medium text-muted">
                        {g.hosts.map((h) => (
                          <span key={h}>{flag(h)}</span>
                        ))}
                        <span>{g.hosts.length ? gamesWhere(g.hosts, g.city, country, text) : t("sport.vote", { year: year(voteDate(state, g)) })}</span>
                        <span>· {underway ? t("sport.underway") : t("sport.opens", { date: formatDate(g.opens, locale) })}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {ours && <span className="rounded-md bg-accent/10 px-1.5 py-0.5 text-2xs font-black uppercase tracking-wider text-accent">{t("sport.ours")}</span>}
                      {canPlayerBid(state, g.id) && (
                        <button
                          type="button"
                          disabled={!acts}
                          onClick={() => onState(toggleBid(state, g.id))}
                          title={t("sport.bidHint")}
                          aria-pressed={bidding}
                          className={`${bidding ? ui.done : ui.secondary} rounded-lg px-2 py-1 text-2xs`}
                        >
                          {bidding ? <Check className="h-3 w-3" /> : <Medal className="h-3 w-3" />}
                          {t(bidding ? "sport.bidding" : "sport.bid")}
                        </button>
                      )}
                      {!underway && canBoycott(state, g.id) && (
                        <button
                          type="button"
                          disabled={!acts}
                          onClick={() => onState(toggleBoycott(state, g.id))}
                          title={t("sport.boycottHint")}
                          aria-pressed={away}
                          className={`${ui.secondary} rounded-lg px-2 py-1 text-2xs ${away ? "border-accent/40 text-accent" : ""}`}
                        >
                          <Ban className="h-3 w-3" />
                          {t(away ? "sport.boycotting" : "sport.boycott")}
                        </button>
                      )}
                      {ours && !underway && (
                        <button
                          type="button"
                          disabled={!acts || state.draft.includes(order)}
                          onClick={() => onOrder(order)}
                          className={`${ui.secondary} rounded-lg px-2 py-1 text-2xs`}
                        >
                          {t("sport.giveUp")}
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {sport.bans?.length ? <p className="rounded-xl bg-page px-3 py-2 text-2xs font-bold text-ink">{t("sport.banned", { countries: sport.bans.map((b) => country(b.tag)).join(", ") })}</p> : null}

      <section>
        <div className={`${ui.label} mb-2`}>{t("sport.last")}</div>
        {last.length === 0 && <p className="text-xs font-medium text-muted">{t("sport.none")}</p>}
        <div className="flex flex-col gap-2">
          {last.map((g) => (
            <LastGames key={g.id} g={g} state={state} country={country} flag={flag} />
          ))}
        </div>
      </section>
    </div>
  );
}

/** One kind's last Games: the medal table or the final, history's champion before the game began, or that they were cancelled. */
function LastGames({ g, state, country, flag }: { g: Games; state: GameState; country: (tag: string) => string; flag: (tag: string) => ReactNode }) {
  const { t, text } = useI18n();
  const rows = g.medals ?? [];
  const shown = rows.filter((r, i) => i < ROWS || r.tag === state.player);
  return (
    <div className={`${ui.card} p-3`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 text-xs font-black leading-snug text-ink">{gamesTitle(g, t)}</span>
        {g.status === "cancelled" && <span className="shrink-0 text-2xs font-black uppercase tracking-wider text-muted">{t("sport.cancelled")}</span>}
      </div>
      <div className="mt-0.5 text-2xs font-medium text-muted">{gamesWhere(g.hosts, g.city, country, text)}</div>
      {g.final && (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-ink">
          {flag(g.final.winner)}
          {t("sport.final", {
            winner: country(g.final.winner),
            runnerUp: country(g.final.runnerUp),
            score: `${g.final.score.join("–")}${g.final.penalties ? ` (${t("sport.penalties")})` : ""}`,
          })}
        </p>
      )}
      {!g.final && !rows.length && g.champion && (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-ink">
          {flag(g.champion)}
          {t((g.kind === "cup" ? "sport.won" : "sport.led") as MessageKey, { country: country(g.champion) })}
        </p>
      )}
      {rows.length > 0 && (
        <table className="mt-2 w-full text-2xs">
          <thead>
            <tr className="text-muted">
              <th className="pb-1 text-left font-bold" />
              <th className="pb-1 text-right font-bold" colSpan={3} title={t("sport.medals")}>
                {t("sport.medals")}
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const place = rows.indexOf(r) + 1;
              const ours = r.tag === state.player;
              return (
                <tr key={r.tag} className={ours ? "font-black text-accent" : "font-medium text-ink"}>
                  <td className="py-0.5">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="w-4 shrink-0 text-right tabular-nums text-muted">{place}</span>
                      {flag(r.tag)}
                      <span className="truncate">{country(r.tag)}</span>
                    </span>
                  </td>
                  <td className="w-7 text-right tabular-nums">{r.gold}</td>
                  <td className="w-7 text-right tabular-nums">{r.silver}</td>
                  <td className="w-7 text-right tabular-nums">{r.bronze}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

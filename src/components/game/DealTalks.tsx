"use client";

import { ArrowDownLeft, ArrowUpRight, Check, Handshake, LogOut, Send, X } from "lucide-react";
import { useMemo, useState } from "react";
import Flag from "@/components/Flag";
import { ui } from "@/components/ui/classes";
import { balanceOf, canTrade, capacity, TRADE_GOODS, UNITS, volumeOf } from "@/engine/deals";
import type { WorldScale } from "@/engine/economy";
import { appraise, type Market, MAX_CONDITIONS, MAX_ROUNDS, type Talk } from "@/engine/negotiation";
import { DEAL_CONDITIONS, DEAL_PAYMENTS, type DealConditionKind, type DealRound, type DealTerms, type GameState, type TradeGood } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";

/** What the player can do in talks; each answers at once by the engine's dice (engine/negotiation.ts). */
export interface TalkActions {
  /** Counter one of the market's offers. */
  counter: (offerId: string, terms: DealTerms) => void;
  /** Open talks of the player's own. */
  propose: (talk: Talk, terms: DealTerms) => void;
  /** The next offer in talks under way, or new terms for a deal in force. */
  revise: (id: string, terms: DealTerms) => void;
  /** Take the partner's counter. */
  accept: (id: string) => void;
  /** Leave the talks. */
  leave: (id: string) => void;
}

const STANCE_TONE = { eager: "bg-emerald-50 text-emerald-700", cool: "bg-amber-50 text-amber-800", hostile: "bg-red-50 text-red-700" } as const;

/** The terms in one line: value, price, term, payment, conditions. */
export function useTermsText(world?: WorldScale) {
  const { t, money, locale } = useI18n();
  return (terms: DealTerms, good: TradeGood, era: GameState["scenarioId"]) => {
    const v = volumeOf(good, terms.value, era, world);
    const unit = UNITS[good];
    const parts = [
      money(terms.value),
      v !== null && unit ? t(`deals.volume.${unit}` as MessageKey, { n: v.toLocaleString(locale) }) : null,
      t("deals.premium", { n: `${terms.premium > 0 ? "+" : ""}${terms.premium}` }),
      t("deals.years", { n: terms.years }),
      terms.pay === "credit" ? t("deals.pay.credit") : terms.pay === "goods" && terms.payGood ? `${t("deals.pay.with")}: ${t(`goods.gen.${terms.payGood}` as MessageKey)}` : null,
      ...(terms.conditions ?? []).map((c) => `${t(c.by === "player" ? "deals.cond.give" : "deals.cond.ask")}: ${t(`deals.cond.${c.kind}` as MessageKey).toLowerCase()}`),
    ];
    return parts.filter(Boolean).join(" · ");
  };
}

interface NegotiationCardProps {
  state: GameState;
  market: Market | null;
  talk: Talk;
  /** A new proposal: the partner, the good and the way are chosen here. */
  choose?: (talk: Talk) => void;
  /** The terms the fields start from. */
  start: DealTerms;
  /** The offers so far, the market's own offer first when it is one. */
  history: Pick<DealRound, "by" | "terms" | "answer" | "reason">[];
  /** The partner's counter on the table, which the player may take. */
  table?: DealTerms;
  round: number;
  counters: number;
  canOffer: boolean;
  disabled: boolean;
  world?: WorldScale;
  onSend: (terms: DealTerms) => void;
  onAccept?: () => void;
  onLeave?: () => void;
  onClose?: () => void;
}

/**
 * A negotiation over one deal: the terms as fields (volume, price, term,
 * payment, terms besides), the other government's stance and why, the
 * likely answer before the offer goes, the offers so far, and the moves –
 * send, take their counter, walk away.
 */
export function NegotiationCard({ state, market, talk, choose, start, history, table, round, counters, canOffer, disabled, world, onSend, onAccept, onLeave, onClose }: NegotiationCardProps) {
  const { t, text, money } = useI18n();
  const [terms, setTerms] = useState<DealTerms>(start);
  const termsText = useTermsText(world);
  const name = (tag: string) => text(state.countries[tag]?.name ?? tag);
  const room = useMemo(() => (market ? capacity(state, null, talk.good, talk.side, market, talk.deal) : 0), [state, market, talk]);
  const view = useMemo(() => (market && state.countries[talk.partner] ? appraise(state, market, talk, terms, { round, counters }) : null), [state, market, talk, terms, round, counters]);
  const set = (patch: Partial<DealTerms>) => setTerms((x) => ({ ...x, ...patch }));
  const condition = (kind: DealConditionKind) => terms.conditions?.find((c) => c.kind === kind)?.by;
  const setCondition = (kind: DealConditionKind, by: "player" | "partner" | null) => {
    const rest = (terms.conditions ?? []).filter((c) => c.kind !== kind);
    set({ conditions: by ? [...rest, { kind, by }].slice(0, MAX_CONDITIONS) : rest });
  };
  const choosing = Boolean(choose);
  const partners = useMemo(() => {
    if (!choosing || !market) return [];
    // The governments that could deal, those who need the good (or have it) most first.
    return Object.values(state.countries)
      .filter((c) => c.tag !== state.player && !c.dormant && c.economy && canTrade(state, state.player, c.tag))
      .map((c) => ({ tag: c.tag, want: (talk.side === "sell" ? -1 : 1) * balanceOf(talk.good, market.accounts.get(c.tag), market.grain.get(c.tag) ?? 0) }))
      .sort((a, b) => b.want - a.want || a.tag.localeCompare(b.tag));
  }, [choosing, market, state, talk.side, talk.good]);
  const field = `${ui.input} px-2 py-1.5 text-right tabular-nums`;
  const goods = TRADE_GOODS.filter((g) => g !== talk.good);
  const blocked = view?.blocked;

  return (
    <div className="grid gap-2.5 rounded-xl border border-accent/30 sheet p-3">
      <div className="flex items-start gap-2">
        <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg ${talk.side === "sell" ? "bg-emerald-50 text-emerald-700" : "bg-sky-50 text-sky-700"}`}>
          {talk.side === "sell" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-sm font-black text-ink">
            <Flag tag={talk.partner} scenario={state.scenarioId} color={state.countries[talk.partner]?.color} size="sm" />
            <span className="truncate">{name(talk.partner)}</span>
          </div>
          <div className="text-2xs font-bold uppercase tracking-wider text-muted">
            {t(talk.side === "sell" ? "deals.we.sell" : "deals.we.buy")} · {t(`goods.${talk.good}` as MessageKey)}
          </div>
        </div>
        {view && (
          <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-2xs font-black uppercase tracking-wider ${STANCE_TONE[view.stance]}`} title={t(`deals.reason.${view.why}` as MessageKey)}>
            {t(`deals.stance.${view.stance}` as MessageKey)}
          </span>
        )}
        {onClose && (
          <button type="button" onClick={onClose} aria-label={t("deals.close")} className="shrink-0 text-muted hover:text-accent">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {view && <p className="-mt-1 text-2xs font-medium text-muted">{t(`deals.reason.${view.why}` as MessageKey)}</p>}

      {choose && (
        <div className="grid gap-1.5">
          <div className="grid grid-cols-2 gap-0.5 rounded-lg bg-page p-0.5">
            {(["sell", "buy"] as const).map((side) => (
              <button key={side} type="button" aria-pressed={talk.side === side} onClick={() => choose({ ...talk, side })} className={`${ui.segment} ${talk.side === side ? ui.segmentOn : ui.segmentOff} py-1!`}>
                {t(side === "sell" ? "deals.we.sell" : "deals.we.buy")}
              </button>
            ))}
          </div>
          <label className="grid grid-cols-[6rem_1fr] items-center gap-2 text-xs">
            <span className="font-bold text-muted">{t("deals.good")}</span>
            <select value={talk.good} onChange={(e) => choose({ ...talk, good: e.target.value as TradeGood })} className={`${ui.input} px-2 py-1.5`}>
              {TRADE_GOODS.map((g) => (
                <option key={g} value={g}>
                  {t(`goods.${g}` as MessageKey)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid grid-cols-[6rem_1fr] items-center gap-2 text-xs">
            <span className="font-bold text-muted">{t("deals.partner")}</span>
            <select value={talk.partner} onChange={(e) => choose({ ...talk, partner: e.target.value })} className={`${ui.input} px-2 py-1.5`}>
              {partners.map((p) => (
                <option key={p.tag} value={p.tag}>
                  {name(p.tag)}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {history.length > 0 && (
        <div className="grid gap-1">
          <div className="text-2xs font-black uppercase tracking-wider text-muted">{t("deals.history")}</div>
          <ol className="grid gap-1">
            {history.map((r, i) => (
              <li key={i} className="flex gap-1.5 rounded-lg bg-page px-2 py-1 text-2xs">
                <span className={`shrink-0 font-black ${r.by === "player" ? "text-ink" : "text-accent"}`}>{t(r.by === "player" ? "deals.by.player" : "deals.by.partner")}</span>
                <span className="min-w-0 flex-1 font-medium text-muted">
                  {termsText(r.terms, talk.good, state.scenarioId)}
                  {r.answer && (
                    <span className="font-bold text-ink">
                      {" – "}
                      {/* Their answer to our offer, ours to theirs. */}
                      {t(`${r.by === "player" ? "deals.answer" : "deals.ours"}.${r.answer}` as MessageKey)}
                      {r.by === "player" && r.reason && r.answer !== "accepted" ? `: ${t(`deals.reason.${r.reason}` as MessageKey)}` : ""}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {table && <p className="text-xs font-bold text-amber-700">{t("deals.waiting")}</p>}
      {choose && !canOffer && <p className="text-xs font-bold text-amber-700">{t("deals.busy")}</p>}

      {blocked ? (
        <p className="text-xs font-bold text-red-600">{t("deals.blocked", { reason: t(`deals.reason.${blocked}` as MessageKey) })}</p>
      ) : room < 0.01 ? (
        <p className="text-xs font-medium text-muted">{t("deals.noRoom")}</p>
      ) : (
        canOffer && (
          <div className="grid gap-1.5">
            <label className="grid grid-cols-[1fr_6rem] items-center gap-2 text-xs">
              <span className="font-bold text-muted">
                {t("deals.term.value")}
                <span className="block text-2xs font-medium">{t("deals.room", { value: money(Math.min(room, view?.room ?? room)) })}</span>
              </span>
              <input type="number" min={0.01} step={0.01} value={terms.value} onChange={(e) => set({ value: Math.max(0, Number(e.target.value) || 0) })} className={field} />
            </label>
            <label className="grid grid-cols-[1fr_6rem] items-center gap-2 text-xs">
              <span className="font-bold text-muted">{t("deals.term.premium")}</span>
              <input type="number" min={-40} max={50} step={1} value={terms.premium} onChange={(e) => set({ premium: Math.max(-40, Math.min(50, Math.round(Number(e.target.value) || 0))) })} className={field} />
            </label>
            <label className="grid grid-cols-[1fr_6rem] items-center gap-2 text-xs">
              <span className="font-bold text-muted">{t("deals.term.years")}</span>
              <input type="number" min={1} max={10} step={1} value={terms.years} onChange={(e) => set({ years: Math.max(1, Math.min(10, Math.round(Number(e.target.value) || 1))) })} className={field} />
            </label>
            <div className="grid gap-1 text-xs">
              <span className="font-bold text-muted">{t("deals.term.pay")}</span>
              <div className="grid grid-cols-3 gap-0.5 rounded-lg bg-page p-0.5">
                {DEAL_PAYMENTS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={(terms.pay ?? "money") === p}
                    onClick={() => set({ pay: p, payGood: p === "goods" ? (terms.payGood ?? goods[0]) : undefined })}
                    className={`${ui.segment} ${(terms.pay ?? "money") === p ? ui.segmentOn : ui.segmentOff} px-1! py-1!`}
                  >
                    {t(`deals.pay.${p}` as MessageKey)}
                  </button>
                ))}
              </div>
              {terms.pay === "goods" && (
                <label className="grid grid-cols-[1fr_8rem] items-center gap-2">
                  <span className="font-bold text-muted">{t("deals.pay.with")}</span>
                  <select value={terms.payGood ?? goods[0]} onChange={(e) => set({ payGood: e.target.value as TradeGood })} className={`${ui.input} px-2 py-1.5`}>
                    {goods.map((g) => (
                      <option key={g} value={g}>
                        {t(`goods.${g}` as MessageKey)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <details className="group rounded-lg bg-page px-2 py-1.5 text-xs" open={Boolean(terms.conditions?.length)}>
              <summary className="cursor-pointer font-bold text-muted">
                {t("deals.term.conditions")}
                {terms.conditions?.length ? ` · ${terms.conditions.length}` : ""}
              </summary>
              <div className="mt-1.5 grid gap-1">
                {DEAL_CONDITIONS.map((kind) => (
                  <div key={kind} className="grid grid-cols-[1fr_auto] items-center gap-2">
                    <span className="truncate font-medium text-ink">{t(`deals.cond.${kind}` as MessageKey)}</span>
                    <div className="flex gap-0.5 rounded-lg bg-surface p-0.5">
                      {([null, "partner", "player"] as const).map((by) => (
                        <button
                          key={by ?? "none"}
                          type="button"
                          aria-pressed={(condition(kind) ?? null) === by}
                          onClick={() => setCondition(kind, by)}
                          className={`${ui.segment} ${(condition(kind) ?? null) === by ? ui.segmentOn : ui.segmentOff} px-1.5! py-0.5! text-2xs!`}
                        >
                          {by === null ? "–" : t(by === "partner" ? "deals.cond.ask" : "deals.cond.give")}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </details>
            {view && (
              <p className={`text-2xs font-bold ${view.likely === "accept" ? "text-emerald-700" : view.likely === "counter" ? "text-amber-700" : "text-red-600"}`}>
                {t(`deals.likely.${view.likely}` as MessageKey, { n: Math.round(view.chance * 100) })}
                {view.sticking && view.likely !== "accept" ? ` – ${t(`deals.reason.${view.sticking}` as MessageKey)}` : ""}
              </p>
            )}
          </div>
        )
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {canOffer && !blocked && room >= 0.01 && (
          <button type="button" disabled={disabled || terms.value < 0.01} onClick={() => onSend(terms)} className={`${ui.primary} flex-1 px-3 py-2 text-2xs`}>
            <Send className="h-3.5 w-3.5" />
            {t("deals.send")}
          </button>
        )}
        {table && onAccept && (
          <button type="button" disabled={disabled} onClick={onAccept} className={`${ui.secondary} flex-1 px-3 py-2 text-2xs`}>
            <Check className="h-3.5 w-3.5" />
            {t("deals.accept")}
          </button>
        )}
        {onLeave && (
          <button type="button" disabled={disabled} onClick={onLeave} className={`${ui.secondary} px-3 py-2 text-2xs`}>
            <LogOut className="h-3.5 w-3.5" />
            {t("deals.walkAway")}
          </button>
        )}
        {canOffer && <span className="ml-auto text-2xs font-bold text-muted">{t("deals.round", { n: Math.min(round, MAX_ROUNDS), max: MAX_ROUNDS })}</span>}
      </div>
    </div>
  );
}

/** The button that opens talks of the player's own. */
export function ProposeButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  const { t } = useI18n();
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`${ui.secondary} w-full px-3 py-2 text-2xs`}>
      <Handshake className="h-3.5 w-3.5" />
      {t("deals.propose")}
    </button>
  );
}

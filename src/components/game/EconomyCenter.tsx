"use client";

import { ArrowDownLeft, ArrowUpRight, Check, Factory, FileSignature, Gem, Handshake, Landmark, MessagesSquare, Scale, Ship, TrendingDown, TrendingUp, Users, X, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import Flag from "@/components/Flag";
import { ui } from "@/components/ui/classes";
import DoneButton, { useDone } from "@/components/ui/DoneButton";
import { Term, TextTip } from "@/components/ui/Term";
import { formatDate } from "@/engine/calendar";
import { interestOf, interestRate } from "@/engine/crises";
import type { EconomyPart } from "@/engine/remit";
import { balanceOf, bindingOf, canTrade, capacity, dealsLeft, MAX_NEW_DEALS, type TradeOffer, tradeOffers, tradePosition, UNITS, volumeOf } from "@/engine/deals";
import { budgetNorms, growthCauses, type Accounts, type GrowthLosses, type WorldScale } from "@/engine/economy";
import { ADVISOR_POST } from "@/engine/government";
import { canPropose, marketOf, rivals, type Talk, talksOf } from "@/engine/negotiation";
import { MAX_TILT } from "@/engine/development";
import { industryOf, type Industry } from "@/engine/industry";
import { sanctionExportCuts, tradeBooks } from "@/engine/trade";
import type { HomeFigure, HomeView } from "@/engine/official";
import type { Budget, DealTerms, Economy, GameState, MapRegion, TradeDeal, TradeGood } from "@/engine/types";
import type { TermId } from "@/i18n/glossary";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import EnergyPanel from "./EnergyPanel";
import { NegotiationCard, ProposeButton, type TalkActions, useTermsText } from "./DealTalks";
import ProvisionPanel from "./ProvisionPanel";
import ResourceLedger from "./ResourceLedger";

const LINES = ["revenue", "army", "industry", "social", "other"] as const;
/** The causes of growth the overview names, points a year, in this order (engine/economy.ts growthCauses). */
const CAUSES = ["trend", "investment", "taxes", "policies", "upkeep"] as const;
/** The glossary term each cause of growth opens; policies have none of their own. */
const CAUSE_TERM: Record<(typeof CAUSES)[number], TermId | null> = { trend: "growth", investment: "industryBudget", taxes: "revenue", policies: null, upkeep: "otherBudget" };
/** What holds output below its level, % of it, in this order; and the glossary term each opens. */
const LOSSES: (keyof GrowthLosses)[] = ["war", "trade", "power", "bombing", "strain"];
const LOSS_TERM: Record<keyof GrowthLosses, TermId | null> = { war: "front", trade: "sanctions", power: "energy", bombing: null, strain: "mobilisation" };
/** The glossary term each budget line opens. */
const LINE_TERM: Record<(typeof LINES)[number], TermId> = { revenue: "revenue", army: "armyBudget", industry: "industryBudget", social: "socialBudget", other: "otherBudget" };

/** A wide button of the panel once its action has gone through. */
const DONE_WIDE = `${ui.done} flex-1 justify-center gap-2 rounded-xl px-3 py-2 text-xs uppercase tracking-wide`;

interface EconomyCenterProps {
  state: GameState;
  accounts?: Accounts;
  regions: Record<string, MapRegion> | null;
  disabled: boolean;
  onBudget: (budget: Budget) => void;
  onSign: (offer: TradeOffer) => void;
  onDecline: (offer: TradeOffer) => void;
  onCancel: (id: string) => void;
  /** What the player may change here (engine/remit.ts): a finance minister the budget, an industry minister the trade deals and the industry line's split; the leader all. */
  parts?: readonly EconomyPart[];
  onTalks: TalkActions;
  /** Sets the industry line's split between heavy and light industry: points to heavy industry from the usual (engine/industry.ts). */
  onSplit?: (tilt: number) => void;
  /** The figures as a minister knows them (engine/official.ts seenEconomy): the overview shows these, not the true ones. */
  seen?: { economy: Economy; view: HomeView } | null;
}

type Tab = "budget" | "trade" | "deals" | "resources" | "energy" | "supply";

/**
 * The economy in hand, in six tabs: the debt, the interest and the reserves
 * with the budget the government sets itself, and the economy minister's
 * latest proposal for it (asked on the advisor strip above the tab), which
 * the player puts into the fields or not; who the
 * country trades with; the trade deals – the market's offers to sign,
 * counter or decline, talks under way, deals of the player's own and the
 * deals in force; the strategic resources; electricity – the plants, the
 * mix and a shortage (EnergyPanel); and how well the people are supplied.
 * Sanctions and big decisions are the government's orders.
 */
export default function EconomyCenter({ state, accounts, regions, disabled, onBudget, onSign, onDecline, onCancel, onTalks, parts = ["budget", "deals", "split"], onSplit, seen }: EconomyCenterProps) {
  const { t, text, money, locale } = useI18n();
  const [tab, setTab] = useState<Tab>("budget");
  const economy = state.countries[state.player]?.economy;
  const [draft, setDraft] = useState<Budget | null>(null);
  const books = useMemo(() => (regions ? tradeBooks(state, regions) : null), [state, regions]);
  const offers = useMemo(() => (regions ? tradeOffers(state, regions) : []), [state, regions]);
  const position = useMemo(() => (regions ? tradePosition(state, regions) : []), [state, regions]);
  const causes = useMemo(() => growthCauses(state, state.player, regions, accounts, regions ? (sanctionExportCuts(state, regions).get(state.player) ?? 0) : 0), [state, regions, accounts]);
  const norms = useMemo(() => budgetNorms(state, state.player, regions), [state, regions]);
  const industry = useMemo(() => industryOf(state, regions, state.player), [state, regions]);
  if (!economy) return null;

  const budget = draft ?? economy.budget;
  // The overview's figures: the true ones for the leader, a minister's own exactly and the rest as his ministry estimates them.
  const figures = seen?.economy ?? economy;
  const secret = (key: HomeFigure) => seen?.view[key].sight === "secret";
  const about = (key: HomeFigure) => (seen?.view[key].sight === "estimated" ? "≈ " : "");
  const spending = budget.army + budget.industry + budget.social + budget.other;
  const gap = budget.revenue - spending;
  const share = (v: number) => `${(Math.round((v / Math.max(0.01, figures.gdp)) * 1000) / 10).toLocaleString(locale)}%`;
  // What the debt and the reserves did since the last turn, from the turn's own snapshot of the books.
  const last = state.chronicle.at(-1)?.economy?.before;
  const moved = (now: number, then: number | undefined, good: "up" | "down") => {
    // The turn's snapshot is the truth: set against a minister's estimate it would say what he cannot know.
    if (seen || then === undefined || Math.abs(now - then) < 0.005) return null;
    const up = now > then;
    return (
      <span className={`ml-1 text-2xs font-bold ${up === (good === "up") ? "text-emerald-700" : "text-red-600"}`} title={t("econ.sinceTurn")}>
        {t("economy.perTurn", { n: `${up ? "+" : "−"}${money(Math.abs(now - then))}` })}
      </span>
    );
  };
  // What each budget line does (its glossary term), against the share of GDP the engine judges it by.
  const norm = (n: number) => (Math.round(n * 1000) / 10).toLocaleString(locale);
  const normOf = (key: (typeof LINES)[number]) => (key === "revenue" ? norms.taxes : key === "industry" ? norms.industry : key === "social" ? norms.social : null);
  const lineName = (key: (typeof LINES)[number]) => {
    const label = t(`econ.line.${key}` as MessageKey);
    const n = normOf(key);
    // "Other" keeps its own sentence, which says what the line does today.
    if (key === "other") {
      // The cabinet's own ministries raise the usual share, those closed lower it (engine/economy.ts cabinetUpkeep).
      const created = state.cabinetShape?.created?.length ?? 0;
      const closed = state.cabinetShape?.closed?.length ?? 0;
      const cabinet = created || closed ? ` ${t("econ.hint.otherCabinet", { created, closed })}` : "";
      return <TextTip text={t("econ.hint.other", { n: norm(norms.other) }) + cabinet} label={label} className="cursor-help underline decoration-dotted decoration-1 underline-offset-2">{label}</TextTip>;
    }
    return (
      <Term id={LINE_TERM[key]} label={label} extra={n === null ? undefined : t("econ.norm", { n: norm(n) })}>
        {label}
      </Term>
    );
  };
  const book = books?.get(state.player);
  const name = (tag: string) => text(state.countries[tag]?.name ?? tag);
  // The latest budget the economy minister proposed in the cabinet's thread, unless it was applied or is the budget already.
  const latest = [...(state.advice?.finance ?? [])].reverse().find((m) => m.from === "advisor" && m.budget);
  const proposal = latest && !latest.applied ? latest.budget : undefined;
  const shown = proposal && LINES.some((key) => Math.abs(proposal[key] - economy.budget[key]) >= 0.005) ? proposal : null;
  const minister = state.officials?.find((o) => o.post === ADVISOR_POST.finance)?.name;
  const partners = (list: { tag: string; value: number; share: number }[]) => (
    <ul className="grid gap-1">
      {list.slice(0, 5).map((p) => (
        <li key={p.tag} className="flex items-center gap-2 text-xs">
          <Flag tag={p.tag} scenario={state.scenarioId} color={state.countries[p.tag]?.color} size="sm" />
          <span className="min-w-0 flex-1 truncate font-bold text-ink">{name(p.tag)}</span>
          <span className="font-black tabular-nums text-ink">{money(p.value)}</span>
          <span className="w-10 text-right font-bold tabular-nums text-muted">{p.share}%</span>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-6 gap-0.5 rounded-xl bg-page p-1">
        {(
          [
            ["budget", Landmark, 0],
            ["trade", Ship, 0],
            ["deals", Handshake, offers.length],
            ["resources", Gem, 0],
            ["energy", Zap, 0],
            ["supply", Users, 0],
          ] as const
        ).map(([id, Icon, badge]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            aria-pressed={tab === id}
            title={t(`econ.tab.${id}` as MessageKey)}
            // Six tabs in a narrow panel: the recipe's padding and type size give way, so the names fit.
            className={`${ui.segment} ${tab === id ? ui.segmentOn : ui.segmentOff} relative flex min-w-0 flex-col items-center justify-center gap-0.5 px-0.5! text-2xs! tracking-tight`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="max-w-full truncate">{t(`econ.tab.${id}` as MessageKey)}</span>
            {badge ? <span className="absolute right-0.5 top-0.5 min-w-4 rounded-full bg-accent px-1 text-center text-[9px] font-black leading-4 text-on-ink">{badge}</span> : null}
          </button>
        ))}
      </div>

      {tab === "resources" && accounts && (
        <section className="grid gap-2">
          <div className={`${ui.label} flex items-center gap-1.5`}>
            <Gem className="h-3.5 w-3.5" />
            {t("bar.resources")}
          </div>
          <p className="text-2xs font-bold leading-snug text-muted">{t("bar.res.made")}</p>
          <ResourceLedger accounts={accounts} economy={economy} />
        </section>
      )}

      {tab === "energy" && <EnergyPanel state={state} accounts={accounts} regions={regions} />}

      {tab === "supply" && <ProvisionPanel state={state} regions={regions} />}

      {tab === "budget" && (
      <section className="rounded-xl bg-page p-3">
        <div className={`${ui.label} mb-2 flex items-center gap-1.5`}>
          <Scale className="h-3.5 w-3.5" />
          {t("econ.overview")}
        </div>
        <dl className="grid gap-1 text-xs">
          <div className="flex items-baseline justify-between gap-2">
            <dt className="font-bold text-muted">
              <Term id="growth">{t("econ.growthLine")}</Term>
            </dt>
            <dd className={`font-black tabular-nums ${figures.growth < 0 ? "text-red-600" : "text-ink"}`}>
              {secret("growth") ? "–" : `${about("growth")}${t("economy.perYear", { n: `${figures.growth > 0 ? "+" : ""}${figures.growth.toLocaleString(locale, { maximumFractionDigits: 1 })}%` })}`}
            </dd>
          </div>
          {causes && (
            <div className="-mt-0.5 text-right text-2xs font-bold leading-snug text-muted">
              {CAUSES.filter((k) => k === "trend" || Math.abs(causes[k]) >= 0.05).map((k, i) => {
                const cause = t(`econ.cause.${k}` as MessageKey, { n: `${causes[k] > 0 && k !== "trend" ? "+" : ""}${causes[k].toLocaleString(locale, { maximumFractionDigits: 1 })}` });
                const term = CAUSE_TERM[k];
                return (
                  <span key={k}>
                    {i > 0 && " · "}
                    {term ? <Term id={term}>{cause}</Term> : cause}
                  </span>
                );
              })}
              {causes.cap && <span className="text-red-600"> · {t(`econ.cap.${causes.cap.by}` as MessageKey, { n: causes.cap.value.toLocaleString(locale, { maximumFractionDigits: 1 }) })}</span>}
            </div>
          )}
          {causes && LOSSES.some((k) => causes.losses[k] >= 0.1) && (
            <div className="-mt-0.5 text-right text-2xs font-bold leading-snug text-muted">
              {t("econ.lossesLine")}{" "}
              {LOSSES.filter((k) => causes.losses[k] >= 0.1).map((k, i) => {
                const loss = t(`econ.loss.${k}` as MessageKey, { n: `−${causes.losses[k].toLocaleString(locale, { maximumFractionDigits: 1 })}` });
                const term = LOSS_TERM[k];
                return (
                  <span key={k}>
                    {i > 0 && " · "}
                    {term ? <Term id={term}>{loss}</Term> : loss}
                  </span>
                );
              })}
            </div>
          )}
          <div className="flex items-baseline justify-between gap-2">
            <dt className="font-bold text-muted">
              <Term id="debt">{t("econ.debtLine")}</Term>
            </dt>
            <dd className="font-black tabular-nums text-ink">
              {secret("debt") ? "–" : `${about("debt")}${money(figures.debt)} · ${share(figures.debt)}`}
              {moved(economy.debt, last?.debt, "down")}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <dt className="font-bold text-muted">
              <Term id="interest">{t("econ.interest")}</Term>
            </dt>
            <dd className="font-black tabular-nums text-ink">
              {secret("debt") ? "–" : `${about("debt")}${money(interestOf(figures, state.scenarioId))} · ${interestRate(figures, state.scenarioId)}%`}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <dt className="font-bold text-muted">
              <Term id="reserves">{t("econ.reservesLine")}</Term>
            </dt>
            <dd className="font-black tabular-nums text-ink">
              {secret("reserves") ? "–" : `${about("reserves")}${money(figures.reserves)} · ${share(figures.reserves)}`}
              {moved(economy.reserves, last?.reserves, "up")}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <dt className="font-bold text-muted">{t("econ.pricesLine")}</dt>
            <dd className="font-black tabular-nums text-ink">
              {/* "inflation 4% · unemployment 6%": each half opens its own term. */}
              {t("econ.pricesValue", {
                inflation: secret("inflation") ? "–" : `${about("inflation")}${figures.inflation.toLocaleString(locale, { maximumFractionDigits: 1 })}`,
                jobless: secret("unemployment") ? "–" : `${about("unemployment")}${figures.unemployment.toLocaleString(locale, { maximumFractionDigits: 1 })}`,
              })
                .split(" · ")
                .map((part, i) => (
                  <span key={i}>
                    {i > 0 && " · "}
                    <Term id={i === 0 ? "inflation" : "unemployment"}>{part}</Term>
                  </span>
                ))}
            </dd>
          </div>
        </dl>
      </section>
      )}

      {tab === "budget" && (
      <section className="rounded-xl bg-page p-3">
        <div className={`${ui.label} mb-2 flex items-center gap-1.5`}>
          <Landmark className="h-3.5 w-3.5" />
          {t("econ.budget")}
        </div>
        <div className="grid gap-1.5">
          {LINES.map((key) => (
            <div key={key} className="grid grid-cols-[1fr_6.5rem_3rem] items-center gap-2 text-xs">
              <span className="font-bold text-muted">{lineName(key)}</span>
              <input
                aria-label={t(`econ.line.${key}` as MessageKey)}
                type="number"
                min={0}
                step={0.1}
                value={Math.round(budget[key] * 100) / 100}
                disabled={!parts.includes("budget")}
                onChange={(e) => setDraft({ ...budget, [key]: Math.max(0, Number(e.target.value) || 0) })}
                className={`${ui.input} px-2 py-1.5 text-right tabular-nums`}
              />
              <span className="text-right font-bold tabular-nums text-muted">{share(budget[key])}</span>
            </div>
          ))}
        </div>
        <div className={`mt-2 flex items-center justify-between text-xs font-black ${gap < 0 ? "text-red-600" : "text-emerald-700"}`}>
          <span className="flex items-center gap-1">
            {gap < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
            {gap < 0 ? t("econ.deficit") : t("econ.surplus")}
          </span>
          <span className="tabular-nums">
            {money(Math.abs(gap))} · {share(Math.abs(gap))}
          </span>
        </div>
        {(economy.offBudget ?? 0) >= 0.005 && <p className="mt-1 text-2xs font-bold leading-snug text-muted">{t("econ.offBudget", { money: money(economy.offBudget ?? 0) })}</p>}
        {!parts.includes("budget") && <p className="mt-2 text-2xs font-medium leading-snug text-muted">{t("remit.economy.budgetLocked")}</p>}
        {parts.includes("budget") && (
        <div className="mt-2 flex gap-2">
          <DoneButton
            icon={Check}
            label={t("econ.approve")}
            doneLabel={t("done.approved")}
            disabled={disabled || !draft}
            onAct={() => {
              if (!draft) return false;
              onBudget(draft);
              setDraft(null);
            }}
            className={`${ui.primary} flex-1 px-3 py-2 text-xs`}
            doneClassName={DONE_WIDE}
          />
          {draft && (
            <button type="button" onClick={() => setDraft(null)} className={`${ui.secondary} px-3 py-2 text-xs`}>
              {t("econ.reset")}
            </button>
          )}
        </div>
        )}
      </section>
      )}

      {tab === "budget" && industry && <IndustrySplit industry={industry} state={state} locked={!parts.includes("split") || !onSplit} disabled={disabled} onSplit={(tilt) => onSplit?.(tilt)} />}

      {tab === "budget" && shown && parts.includes("budget") && (
        <section className="grid gap-2 rounded-xl border border-line sheet p-3">
          {shown && (
            <div className="grid gap-1.5">
              <div className={`${ui.label} flex items-center justify-between gap-2`}>
                <span>{t("econ.proposal.title")}</span>
                {minister && <span className="truncate normal-case tracking-normal text-muted">{minister}</span>}
              </div>
              {shown.reason && <p className="text-xs font-medium leading-relaxed text-ink">{shown.reason}</p>}
              <dl className="grid gap-0.5 text-xs">
                {LINES.map((key) => {
                  const delta = shown[key] - economy.budget[key];
                  return (
                    <div key={key} className="flex items-baseline justify-between gap-2">
                      <dt className="font-bold text-muted">{t(`econ.line.${key}` as MessageKey)}</dt>
                      <dd className="font-black tabular-nums text-ink">
                        {money(shown[key])}
                        {Math.abs(delta) >= 0.005 && (
                          <span className={`ml-1.5 text-2xs ${delta > 0 ? "text-emerald-700" : "text-red-600"}`}>
                            {delta > 0 ? "+" : "−"}
                            {money(Math.abs(delta))}
                          </span>
                        )}
                      </dd>
                    </div>
                  );
                })}
              </dl>
              {/* "Filled in" while the fields hold it, until the budget is approved (and the proposal goes) or the fields are reset. */}
              <DoneButton
                icon={Check}
                label={t("econ.proposal.apply")}
                doneLabel={t("done.filled")}
                done={draft !== null && LINES.every((key) => Math.abs(draft[key] - shown[key]) < 0.005)}
                disabled={disabled}
                onAct={() => setDraft({ revenue: shown.revenue, army: shown.army, industry: shown.industry, social: shown.social, other: shown.other })}
                className={`${ui.secondary} px-3 py-2 text-xs`}
                doneClassName={DONE_WIDE}
              />
            </div>
          )}
        </section>
      )}

      {tab === "trade" && book && (
        <section className="grid gap-3">
          <div className={`${ui.label} flex items-center gap-1.5`}>
            <Ship className="h-3.5 w-3.5" />
            {t("econ.trade")}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-page p-2.5">
              <div className="font-bold text-muted">{t("econ.exports")}</div>
              <div className="text-sm font-black tabular-nums text-ink">{money(book.exports)}</div>
            </div>
            <div className="rounded-xl bg-page p-2.5">
              <div className="font-bold text-muted">{t("econ.imports")}</div>
              <div className="text-sm font-black tabular-nums text-ink">{money(book.imports)}</div>
              {economy.tradeCut > 0 && <div className="text-2xs font-bold text-red-600">{t("econ.cut", { n: Math.round(economy.tradeCut * 100) })}</div>}
            </div>
          </div>
          <div>
            <div className="mb-1 text-2xs font-black uppercase tracking-wider text-muted">{t("econ.buyers")}</div>
            {partners(book.toward)}
          </div>
          <div>
            <div className="mb-1 text-2xs font-black uppercase tracking-wider text-muted">{t("econ.sellers")}</div>
            {partners(book.from)}
          </div>
          {accounts && accounts.shortages.length > 0 && <p className="text-xs font-bold text-red-600">{t("econ.shortages", { list: accounts.shortages.map((r) => t(`resource.${r}` as MessageKey)).join(", ") })}</p>}
        </section>
      )}

      {tab === "deals" && !parts.includes("deals") && <p className="text-2xs font-medium leading-snug text-muted">{t("remit.economy.dealsLocked")}</p>}
      {tab === "deals" && (
        <Deals
          state={state}
          offers={offers}
          position={position}
          regions={regions}
          disabled={disabled || !parts.includes("deals")}
          onSign={onSign}
          onDecline={onDecline}
          onCancel={onCancel}
          onTalks={onTalks}
          name={name}
          money={money}
          date={(iso) => formatDate(iso, locale)}
          world={accounts?.world}
        />
      )}

    </div>
  );
}

/** "≈ 4.7 million tonnes a year" for a good on a contract, if it has a unit. */
function useVolume(world?: WorldScale) {
  const { t, locale } = useI18n();
  return (good: TradeGood, value: number, era: GameState["scenarioId"]) => {
    const v = volumeOf(good, value, era, world);
    const unit = UNITS[good];
    return v !== null && unit ? t(`deals.volume.${unit}` as MessageKey, { n: v.toLocaleString(locale) }) : null;
  };
}

const GOOD_TONE: Record<TradeGood, string> = {
  grain: "bg-amber-100 text-amber-800",
  oil: "bg-stone-200 text-stone-800",
  gas: "bg-sky-100 text-sky-800",
  coal: "bg-zinc-200 text-zinc-800",
  metals: "bg-slate-200 text-slate-700",
  uranium: "bg-lime-100 text-lime-800",
  arms: "bg-red-100 text-red-800",
};

/** What the player has open in the deals tab: a counter to an offer, a deal's talks, or a proposal of its own. */
type Draft = { offer: string } | { deal: string } | { talk: Talk } | null;

/** The market's offers this turn, the talks under way, a deal of the player's own, and the deals in force. */
function Deals({
  state,
  offers,
  position,
  regions,
  disabled,
  onSign,
  onDecline,
  onCancel,
  onTalks,
  name,
  money,
  date,
  world,
}: {
  state: GameState;
  offers: TradeOffer[];
  position: { good: TradeGood; balance: number; contracted: number }[];
  regions: Record<string, MapRegion> | null;
  disabled: boolean;
  onSign: (offer: TradeOffer) => void;
  onDecline: (offer: TradeOffer) => void;
  onCancel: (id: string) => void;
  onTalks: TalkActions;
  name: (tag: string) => string;
  money: (billions: number) => string;
  date: (iso: string) => string;
  world?: WorldScale;
}) {
  const { t } = useI18n();
  const volume = useVolume(world);
  const termsText = useTermsText(world);
  // A signed offer leaves the list; for a moment its place at the top says it went through.
  const [signedShown, flashSigned] = useDone();
  const [signed, setSigned] = useState("");
  const [draft, setDraft] = useState<Draft>(null);
  const market = useMemo(() => (regions ? marketOf(state, regions) : null), [state, regions]);
  const deals = (state.deals ?? []).filter((d) => d.status === "active" || d.status === "proposed");
  const inForce = deals.filter((d) => d.status === "active" && !d.talking);
  // Talks under way, and those the turn has seen end without a deal.
  const talks = (state.deals ?? []).filter((d) => d.status === "proposed" || d.talking || (d.status === "declined" && (d.rounds ?? []).some((r) => r.turn === state.turn)));
  const left = dealsLeft(state);
  const flag = (tag: string) => <Flag tag={tag} scenario={state.scenarioId} color={state.countries[tag]?.color} size="sm" />;
  const goodChip = (g: TradeGood) => <span className={`rounded-md px-1.5 py-0.5 text-2xs font-black uppercase tracking-wider ${GOOD_TONE[g]}`}>{t(`goods.${g}` as MessageKey)}</span>;
  const terms = (d: Pick<TradeDeal, "good" | "value" | "premium" | "years">) =>
    [volume(d.good, d.value, state.scenarioId), t("deals.premium", { n: `${d.premium > 0 ? "+" : ""}${d.premium}` }), t("deals.years", { n: d.years })].filter(Boolean).join(" · ");
  const opened = (key: Draft) => JSON.stringify(draft) === JSON.stringify(key);
  // The government that lacks a good most (or has most of it to spare), for a proposal that changes its good or way.
  const bestFor = (good: TradeGood, side: "sell" | "buy"): string => {
    // Outside a rival camp first.
    let best = { tag: state.player, want: -Infinity };
    for (const c of Object.values(state.countries)) {
      if (c.tag === state.player || c.dormant || !c.economy || !market || !canTrade(state, state.player, c.tag) || !canPropose(state, { partner: c.tag, good, side })) continue;
      const want = (side === "sell" ? -1 : 1) * balanceOf(good, market.accounts.get(c.tag), market.grain.get(c.tag) ?? 0) - (rivals(state, state.player, c.tag) ? 1e6 : 0);
      if (want > best.want) best = { tag: c.tag, want };
    }
    return best.tag;
  };
  // A proposal of the player's own starts with the first good it has to sell, to whoever lacks it most.
  const newTalk = (): Talk => {
    const good = position.find((p) => p.balance > 0)?.good ?? position[0]?.good ?? "grain";
    const side = (position.find((p) => p.good === good)?.balance ?? 1) >= 0 ? "sell" : "buy";
    return { partner: bestFor(good, side), good, side };
  };
  const startFor = (talk: Talk): DealTerms => {
    const room = market ? capacity(state, null, talk.good, talk.side, market) : 0;
    return { value: Math.max(0.01, Math.round(room * 50) / 100), premium: 0, years: 3 };
  };

  return (
    <div className="flex flex-col gap-4">
      <section className="grid gap-2">
        <div className={`${ui.label} flex items-center gap-1.5`}>
          <FileSignature className="h-3.5 w-3.5" />
          {t("deals.offers")}
        </div>
        <p className={`text-2xs font-bold ${left ? "text-muted" : "text-amber-700"}`}>{left ? t("deals.left", { n: left, max: MAX_NEW_DEALS }) : t("deals.noneLeft")}</p>
        {signedShown && (
          <p role="status" className={`${ui.done} gap-1.5 rounded-xl px-3 py-2 text-xs`}>
            <Check className="h-3.5 w-3.5 shrink-0" />
            {t("done.signed", { deal: signed })}
          </p>
        )}
        {offers.length === 0 && left > 0 && <p className="text-xs font-medium text-muted">{t("deals.noOffers")}</p>}
        {offers.map((o) =>
          opened({ offer: o.id }) ? (
            <NegotiationCard
              key={o.id}
              state={state}
              market={market}
              talk={{ partner: o.partner, good: o.good, side: o.side }}
              start={{ value: o.value, premium: o.premium, years: o.years }}
              history={[{ by: "partner", terms: { value: o.value, premium: o.premium, years: o.years } }]}
              round={1}
              counters={0}
              canOffer
              disabled={disabled}
              world={world}
              onSend={(x) => {
                // The talks go on below, among the talks under way – or the deal is signed.
                onTalks.counter(o.id, x);
                setDraft(null);
              }}
              onClose={() => setDraft(null)}
            />
          ) : (
            <div key={o.id} className="rounded-xl border border-line sheet p-3">
              <div className="flex items-start gap-2">
                <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg ${o.side === "sell" ? "bg-emerald-50 text-emerald-700" : "bg-sky-50 text-sky-700"}`}>
                  {o.side === "sell" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {goodChip(o.good)}
                    <span className="text-2xs font-bold uppercase tracking-wider text-muted">{o.side === "sell" ? t("deals.buyer") : t("deals.seller")}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-sm font-black text-ink">
                    {flag(o.partner)}
                    <span className="truncate">{name(o.partner)}</span>
                  </div>
                  <div className="mt-0.5 text-xs font-medium text-muted">{terms(o)}</div>
                  <div className="mt-0.5 text-2xs font-medium text-muted">
                    {o.good === "arms" ? t("deals.why.arms") : o.side === "sell" ? t("deals.why.sell", { value: money(Math.abs(o.need)) }) : t("deals.why.buy", { value: money(Math.abs(o.need)) })}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-base font-black tabular-nums text-ink">{money(o.value)}</div>
                  <div className="text-2xs font-bold text-muted">{t("deals.perYear", { value: "" }).trim()}</div>
                </div>
              </div>
              <div className="mt-2 flex gap-1.5">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    onSign(o);
                    setSigned(`${t(`goods.${o.good}` as MessageKey)} · ${name(o.partner)}`);
                    flashSigned();
                  }}
                  className={`${ui.primary} flex-1 px-3 py-2 text-2xs`}
                >
                  <Check className="h-3.5 w-3.5" />
                  {t("deals.sign")}
                </button>
                <button type="button" disabled={disabled || !market} onClick={() => setDraft({ offer: o.id })} className={`${ui.secondary} px-3 py-2 text-2xs`}>
                  <MessagesSquare className="h-3.5 w-3.5" />
                  {t("deals.counter")}
                </button>
                <button type="button" disabled={disabled} onClick={() => onDecline(o)} className={`${ui.secondary} px-3 py-2 text-2xs`}>
                  <X className="h-3.5 w-3.5" />
                  {t("deals.decline")}
                </button>
              </div>
            </div>
          ),
        )}
      </section>

      {talks.length > 0 && (
        <section className="grid gap-2">
          <div className={`${ui.label} flex items-center gap-1.5`}>
            <MessagesSquare className="h-3.5 w-3.5" />
            {t("deals.talks")}
          </div>
          {talks.map((d) => {
            const where = talksOf(d, state.turn);
            const last = d.rounds?.at(-1);
            if (d.status === "declined")
              return (
                <div key={d.id} className="flex items-center gap-2 rounded-xl bg-page px-3 py-2 text-2xs font-medium text-muted">
                  {goodChip(d.good)}
                  {flag(d.partner)}
                  <span className="min-w-0 flex-1">
                    {last?.by === "player" && last.answer === "refused" ? t("deals.walkedAway", { partner: name(d.partner), reason: t(`deals.reason.${last.reason ?? "fair"}` as MessageKey) }) : t("deals.leftTalks")}
                  </span>
                </div>
              );
            // Legacy proposals from before the talks wait for the turn; talks under way are cards.
            if (!d.rounds?.length)
              return (
                <div key={d.id} className="flex items-center gap-2 rounded-xl bg-page px-3 py-2 text-2xs font-medium text-muted">
                  {goodChip(d.good)}
                  {flag(d.partner)}
                  <span className="min-w-0 flex-1">
                    {termsText(d, d.good, state.scenarioId)} · <span className="font-bold text-amber-700">{t("deals.pending")}</span>
                  </span>
                  <button type="button" disabled={disabled} onClick={() => onCancel(d.id)} className="font-black uppercase tracking-wider text-muted hover:text-accent">
                    {t("deals.withdraw")}
                  </button>
                </div>
              );
            return (
              <NegotiationCard
                key={`${d.id}-${d.rounds.length}`}
                state={state}
                market={market}
                talk={{ partner: d.partner, good: d.good, side: d.side, deal: d.id }}
                start={where.table ?? d}
                history={d.rounds.filter((r) => r.turn === state.turn)}
                table={where.table}
                round={where.round}
                counters={where.counters}
                canOffer={where.canOffer}
                disabled={disabled}
                world={world}
                onSend={(x) => onTalks.revise(d.id, x)}
                onAccept={() => onTalks.accept(d.id)}
                onLeave={() => onTalks.leave(d.id)}
              />
            );
          })}
        </section>
      )}

      <section className="grid gap-2">
        {draft && "talk" in draft ? (
          <NegotiationCard
            key={`${draft.talk.partner}-${draft.talk.good}-${draft.talk.side}`}
            state={state}
            market={market}
            talk={draft.talk}
            // A new good or way finds its likeliest partner; a new partner is the player's choice.
            choose={(talk) => setDraft({ talk: talk.good !== draft.talk.good || talk.side !== draft.talk.side ? { ...talk, partner: bestFor(talk.good, talk.side) } : talk })}
            start={startFor(draft.talk)}
            history={[]}
            round={1}
            counters={0}
            canOffer={canPropose(state, draft.talk)}
            disabled={disabled}
            world={world}
            onSend={(x) => {
              onTalks.propose(draft.talk, x);
              setDraft(null);
            }}
            onClose={() => setDraft(null)}
          />
        ) : (
          <ProposeButton disabled={disabled || !left || !market} onClick={() => setDraft({ talk: newTalk() })} />
        )}
      </section>

      <section className="grid gap-2">
        <div className={ui.label}>{t("deals.active")}</div>
        {inForce.length === 0 && <p className="text-xs font-medium text-muted">{t("deals.none")}</p>}
        {inForce.map((d) => {
          const reopen = talksOf(d, state.turn).canOffer;
          const binds = bindingOf(state, d) >= 25;
          return opened({ deal: d.id }) ? (
            <NegotiationCard
              key={d.id}
              state={state}
              market={market}
              talk={{ partner: d.partner, good: d.good, side: d.side, deal: d.id }}
              start={d}
              history={[]}
              round={1}
              counters={0}
              canOffer={reopen}
              disabled={disabled}
              world={world}
              onSend={(x) => {
                onTalks.revise(d.id, x);
                setDraft(null);
              }}
              onClose={() => setDraft(null)}
            />
          ) : (
            <div key={d.id} className="flex items-start gap-2 rounded-xl bg-page px-3 py-2">
              <span className={`mt-0.5 shrink-0 ${d.side === "sell" ? "text-emerald-700" : "text-sky-700"}`}>{d.side === "sell" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 text-xs font-black text-ink">
                  {goodChip(d.good)}
                  {flag(d.partner)}
                  <span className="truncate">{name(d.partner)}</span>
                  {binds && <span className="rounded-md bg-surface px-1.5 py-0.5 text-2xs font-bold text-muted">{t("deals.binds")}</span>}
                </div>
                <div className="mt-0.5 text-2xs font-medium text-muted">
                  {termsText(d, d.good, state.scenarioId)} · {t("deals.until", { date: date(d.until) })}
                  {d.owed ? ` · ${t("deals.owed", { value: money(d.owed) })}` : ""}
                </div>
                {d.strain && (
                  <div className="mt-0.5 text-2xs font-bold text-red-600">
                    {t("deals.strain", { n: Math.round(d.strain.share * 100), cause: t(`deals.cause.${d.strain.cause}` as MessageKey), at: t(`deals.at.${d.strain.by}` as MessageKey) })}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
                <div className="text-xs font-black tabular-nums text-ink">{money(d.value)}</div>
                {reopen && (
                  <button type="button" disabled={disabled || !market} onClick={() => setDraft({ deal: d.id })} className="text-2xs font-black uppercase tracking-wider text-muted hover:text-accent">
                    {t("deals.renegotiate")}
                  </button>
                )}
                <button type="button" disabled={disabled} onClick={() => onCancel(d.id)} className="text-2xs font-black uppercase tracking-wider text-muted hover:text-accent">
                  {t("deals.cancel")}
                </button>
              </div>
            </div>
          );
        })}
      </section>

      {position.length > 0 && (
        <section className="grid gap-1.5">
          <div className={ui.label}>{t("deals.position")}</div>
          {position.map((p) => {
            const max = Math.max(...position.map((x) => Math.abs(x.balance)));
            return (
              <div key={p.good} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-2 text-xs">
                <span className="truncate font-bold text-ink">{t(`goods.${p.good}` as MessageKey)}</span>
                <span className="relative h-2 rounded-full bg-divider">
                  <span className={`absolute inset-y-0 rounded-full ${p.balance > 0 ? "left-1/2 bg-emerald-500" : "right-1/2 bg-red-500"}`} style={{ width: `${(Math.abs(p.balance) / max) * 50}%` }} />
                  <span className="absolute inset-y-0 left-1/2 w-px bg-line" />
                </span>
                <span className={`whitespace-nowrap text-right font-black tabular-nums ${p.balance > 0 ? "text-emerald-700" : "text-red-600"}`}>
                  {p.balance > 0 ? "+" : "−"}
                  {money(Math.abs(p.balance))}
                  {p.contracted > 0 && <span className="ml-1.5 text-2xs font-bold text-muted">{t("deals.contracted", { value: money(p.contracted) })}</span>}
                </span>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}

/**
 * The economy's two industries (engine/industry.ts): heavy industry's and
 * light industry's shares of output against the usual for the era, income
 * and system, what each feeds now, how they moved in the society record,
 * and the split of the industry line the government sets – which the
 * structure follows over years.
 */
function IndustrySplit({ industry, state, locked, disabled, onSplit }: { industry: Industry; state: GameState; locked: boolean; disabled: boolean; onSplit: (tilt: number) => void }) {
  const { t, money, locale } = useI18n();
  const [draft, setDraft] = useState<number | null>(null);
  const tilt = draft ?? industry.tilt;
  const split = Math.max(5, Math.min(95, industry.norm + tilt));
  const n = (v: number, digits = 0) => v.toLocaleString(locale, { maximumFractionDigits: digits });
  const signed = (v: number, digits = 0) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${n(Math.abs(v), digits)}`;
  const system = industry.planned >= 0.7 ? "planned" : industry.planned > 0 ? "mixed" : "market";
  const record = state.society?.[state.player]?.record ?? [];
  const heavyThen = record.length >= 2 ? record[0].hv : undefined;
  const bar = (heavy: number) => (
    <div className="flex h-2 overflow-hidden rounded-full bg-divider">
      <span style={{ width: `${heavy}%`, background: "var(--ink)" }} />
      <span style={{ width: `${100 - heavy}%`, background: "var(--accent)" }} />
    </div>
  );
  return (
    <section className="grid gap-2 rounded-xl bg-page p-3">
      <div className={`${ui.label} flex items-center gap-1.5`}>
        <Factory className="h-3.5 w-3.5" />
        {t("industry.title")}
      </div>
      {bar(industry.heavy)}
      <div className="flex flex-wrap justify-between gap-x-3 gap-y-0.5 text-2xs font-bold text-muted">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm" style={{ background: "var(--ink)" }} />
          {t("industry.heavy")} <span className="tabular-nums text-ink">{n(industry.heavy)}%</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm" style={{ background: "var(--accent)" }} />
          {t("industry.light")} <span className="tabular-nums text-ink">{n(industry.light)}%</span>
        </span>
      </div>
      <p className="text-2xs font-bold leading-snug text-muted">
        {t("industry.usual", { system: t(`industry.system.${system}` as MessageKey), n: n(industry.norm) })}
        {heavyThen !== undefined && Math.abs(industry.heavy - heavyThen) >= 0.5 ? ` · ${t("industry.since", { n: signed(industry.heavy - heavyThen, 1) })}` : ""}
      </p>
      <dl className="grid gap-0.5 text-xs">
        <div className="flex items-baseline justify-between gap-2">
          <dt className="font-bold text-muted">{t("industry.feeds.heavy")}</dt>
          <dd className="text-right font-black tabular-nums text-ink">{t("industry.feeds.heavyValue", { arms: signed((industry.arms - 1) * 100), growth: signed(industry.growth, 2) })}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="font-bold text-muted">{t("industry.feeds.light")}</dt>
          <dd className="text-right font-black tabular-nums text-ink">{t("industry.feeds.lightValue", { goods: signed(industry.goods, 1) })}</dd>
        </div>
      </dl>
      <div className="grid gap-1 border-t border-divider pt-2">
        <div className="flex items-baseline justify-between gap-2 text-xs">
          <span className="font-bold text-muted">{t("industry.split")}</span>
          <span className="font-black tabular-nums text-ink">{t("industry.splitValue", { heavy: n(split), light: n(100 - split) })}</span>
        </div>
        <input
          type="range"
          aria-label={t("industry.split")}
          min={-MAX_TILT}
          max={MAX_TILT}
          step={1}
          value={tilt}
          disabled={locked || disabled}
          onChange={(e) => setDraft(Number(e.target.value))}
          className="w-full accent-accent disabled:opacity-50"
        />
        <div className="flex justify-between text-2xs font-bold tabular-nums text-muted">
          <span>
            {t("industry.light")} {money((industry.money * (100 - split)) / 100)}
          </span>
          <span>
            {t("industry.heavy")} {money((industry.money * split) / 100)}
          </span>
        </div>
        {!locked && (
          <DoneButton
            icon={Check}
            label={t("industry.set")}
            doneLabel={t("done.approved")}
            disabled={disabled || draft === null || draft === industry.tilt}
            onAct={() => {
              if (draft === null) return false;
              onSplit(draft);
              setDraft(null);
            }}
            className={`${ui.secondary} px-3 py-2 text-xs`}
            doneClassName={DONE_WIDE}
          />
        )}
      </div>
      <p className="text-2xs font-medium leading-snug text-muted">{t(locked ? "industry.locked" : "industry.about")}</p>
    </section>
  );
}

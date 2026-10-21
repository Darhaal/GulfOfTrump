"use client";

import { ArrowDownLeft, ArrowUpRight, Ban, Check, FileSignature, Gem, Handshake, Landmark, Plus, Scale, Ship, TrendingDown, TrendingUp, Users, X } from "lucide-react";
import { useMemo, useState } from "react";
import Flag from "@/components/Flag";
import { ui } from "@/components/ui/classes";
import { formatDate } from "@/engine/calendar";
import { interestOf, interestRate } from "@/engine/crises";
import { capacity, dealsLeft, MAX_NEW_DEALS, TRADE_GOODS, type TradeOffer, tradeOffers, tradePosition, UNITS, volumeOf } from "@/engine/deals";
import type { Accounts, WorldScale } from "@/engine/economy";
import { sanctionCuts, tradeBooks } from "@/engine/trade";
import type { Budget, GameState, MapRegion, Sanction, TradeDeal, TradeGood } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import ProvisionPanel from "./ProvisionPanel";
import ResourceLedger from "./ResourceLedger";

const LINES = ["revenue", "army", "industry", "social", "other"] as const;
const QUICK = ["war", "nationalise", "invest", "rationing", "bonds", "devalue", "austerity"] as const;

interface EconomyCenterProps {
  state: GameState;
  accounts?: Accounts;
  regions: Record<string, MapRegion> | null;
  disabled: boolean;
  onBudget: (budget: Budget) => void;
  onSanction: (against: string, scope: Sanction["scope"] | null) => void;
  onOrder: (order: string) => void;
  onSign: (offer: TradeOffer) => void;
  onDecline: (offer: TradeOffer) => void;
  onPropose: (terms: Pick<TradeOffer, "partner" | "good" | "side" | "value" | "premium" | "years">) => void;
  onCancel: (id: string) => void;
}

type Tab = "budget" | "trade" | "deals" | "resources" | "supply";

/**
 * The economy in hand, in five tabs: the debt, the interest and the reserves
 * with the budget the government sets itself (it takes effect at once; the
 * next turn judges what it does) and the big economic decisions as orders;
 * who the country trades with and the sanctions it imposes and suffers; the
 * trade deals — the market's offers to sign, the deals in force, the
 * player's own proposals; the strategic resources; and how well the people
 * are supplied.
 */
export default function EconomyCenter({ state, accounts, regions, disabled, onBudget, onSanction, onOrder, onSign, onDecline, onPropose, onCancel }: EconomyCenterProps) {
  const { t, text, money, locale } = useI18n();
  const [tab, setTab] = useState<Tab>("budget");
  const economy = state.countries[state.player]?.economy;
  const [draft, setDraft] = useState<Budget | null>(null);
  const [target, setTarget] = useState("");
  const [scope, setScope] = useState<Sanction["scope"]>("partial");
  const [ordered, setOrdered] = useState<string | null>(null);
  const books = useMemo(() => (regions ? tradeBooks(state, regions) : null), [state, regions]);
  const cuts = useMemo(() => (regions ? sanctionCuts(state, regions) : new Map<string, number>()), [state, regions]);
  const offers = useMemo(() => (regions ? tradeOffers(state, regions) : []), [state, regions]);
  const position = useMemo(() => (regions ? tradePosition(state, regions) : []), [state, regions]);
  if (!economy) return null;

  const budget = draft ?? economy.budget;
  const spending = budget.army + budget.industry + budget.social + budget.other;
  const gap = budget.revenue - spending;
  const share = (v: number) => `${Math.round((v / Math.max(0.01, economy.gdp)) * 1000) / 10}%`;
  const book = books?.get(state.player);
  const name = (tag: string) => text(state.countries[tag]?.name ?? tag);
  const mine = (state.sanctions ?? []).filter((s) => s.by === state.player);
  const against = (state.sanctions ?? []).filter((s) => s.against === state.player);
  const others = Object.values(state.countries)
    .filter((c) => c.tag !== state.player && !c.dormant && c.economy && !mine.some((s) => s.against === c.tag))
    .sort((a, b) => text(a.name).localeCompare(text(b.name)));
  const order = (key: (typeof QUICK)[number]) => {
    const value = t(`econ.order.${key}` as MessageKey);
    onOrder(value);
    setOrdered(value);
  };
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
      {ordered && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">{t("politics.ordered")}: {ordered}</p>}

      <div className="grid grid-cols-5 gap-0.5 rounded-xl bg-page p-1">
        {(
          [
            ["budget", Landmark, 0],
            ["trade", Ship, 0],
            ["deals", Handshake, offers.length],
            ["resources", Gem, 0],
            ["supply", Users, 0],
          ] as const
        ).map(([id, Icon, badge]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            aria-pressed={tab === id}
            title={t(`econ.tab.${id}` as MessageKey)}
            // Five tabs in a narrow panel: the recipe's padding and type size give way, so the names fit.
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

      {tab === "supply" && <ProvisionPanel state={state} regions={regions} />}

      {tab === "budget" && (
      <section className="rounded-xl bg-page p-3">
        <div className={`${ui.label} mb-2 flex items-center gap-1.5`}>
          <Scale className="h-3.5 w-3.5" />
          {t("econ.overview")}
        </div>
        <dl className="grid gap-1 text-xs">
          <div className="flex items-baseline justify-between gap-2">
            <dt className="font-bold text-muted">{t("econ.debtLine")}</dt>
            <dd className="font-black tabular-nums text-ink">
              {money(economy.debt)} · {share(economy.debt)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <dt className="font-bold text-muted">{t("econ.interest")}</dt>
            <dd className="font-black tabular-nums text-ink">
              {money(interestOf(economy, state.scenarioId))} · {interestRate(economy, state.scenarioId)}%
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <dt className="font-bold text-muted">{t("econ.reservesLine")}</dt>
            <dd className="font-black tabular-nums text-ink">
              {money(economy.reserves)} · {share(economy.reserves)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <dt className="font-bold text-muted">{t("econ.pricesLine")}</dt>
            <dd className="font-black tabular-nums text-ink">{t("econ.pricesValue", { inflation: economy.inflation, jobless: economy.unemployment })}</dd>
          </div>
        </dl>
        <p className="mt-1.5 text-2xs font-medium leading-snug text-muted">{t("econ.booksNote")}</p>
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
            <label key={key} className="grid grid-cols-[1fr_6.5rem_3rem] items-center gap-2 text-xs">
              <span className="font-bold text-muted">{t(`econ.line.${key}` as MessageKey)}</span>
              <input
                type="number"
                min={0}
                step={0.1}
                value={Math.round(budget[key] * 100) / 100}
                onChange={(e) => setDraft({ ...budget, [key]: Math.max(0, Number(e.target.value) || 0) })}
                className={`${ui.input} px-2 py-1.5 text-right tabular-nums`}
              />
              <span className="text-right font-bold tabular-nums text-muted">{share(budget[key])}</span>
            </label>
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
        <p className="mt-1 text-2xs font-medium text-muted">{state.budgetSet ? t("econ.changed") : t("econ.note")}</p>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            disabled={disabled || !draft}
            onClick={() => {
              if (draft) onBudget(draft);
              setDraft(null);
            }}
            className={`${ui.primary} flex-1 px-3 py-2 text-xs`}
          >
            <Check className="h-4 w-4" />
            {t("econ.approve")}
          </button>
          {draft && (
            <button type="button" onClick={() => setDraft(null)} className={`${ui.secondary} px-3 py-2 text-xs`}>
              {t("econ.reset")}
            </button>
          )}
        </div>
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

      {tab === "trade" && (
      <section className="grid gap-2">
        <div className={`${ui.label} flex items-center gap-1.5`}>
          <Ban className="h-3.5 w-3.5" />
          {t("econ.sanctions")}
        </div>
        {mine.length === 0 && <p className="text-xs font-medium text-muted">{t("econ.noSanctions")}</p>}
        {mine.map((s) => (
          <div key={s.against} className="flex items-center gap-2 rounded-xl bg-page px-2.5 py-2 text-xs">
            <Flag tag={s.against} scenario={state.scenarioId} color={state.countries[s.against]?.color} size="sm" />
            <span className="min-w-0 flex-1 truncate font-bold text-ink">{name(s.against)}</span>
            <select value={s.scope} disabled={disabled} onChange={(e) => onSanction(s.against, e.target.value as Sanction["scope"])} className="rounded-lg border border-line bg-surface px-1.5 py-1 text-2xs font-bold text-ink">
              <option value="partial">{t("econ.scope.partial")}</option>
              <option value="full">{t("econ.scope.full")}</option>
            </select>
            <button type="button" disabled={disabled} onClick={() => onSanction(s.against, null)} className="text-2xs font-black uppercase tracking-wider text-muted hover:text-accent">
              {t("econ.lift")}
            </button>
          </div>
        ))}
        <div className="flex gap-1.5">
          <select value={target} onChange={(e) => setTarget(e.target.value)} className={`${ui.input} min-w-0 flex-1 py-2 text-xs`}>
            <option value="">{t("econ.pick")}</option>
            {others.map((c) => (
              <option key={c.tag} value={c.tag}>
                {text(c.name)}
              </option>
            ))}
          </select>
          <select value={scope} onChange={(e) => setScope(e.target.value as Sanction["scope"])} className={`${ui.input} w-28 py-2 text-xs`}>
            <option value="partial">{t("econ.scope.partial")}</option>
            <option value="full">{t("econ.scope.full")}</option>
          </select>
          <button
            type="button"
            disabled={disabled || !target}
            onClick={() => {
              onSanction(target, scope);
              setTarget("");
            }}
            className={`${ui.secondary} shrink-0 px-2.5 py-2 text-xs`}
            aria-label={t("econ.impose")}
            title={t("econ.impose")}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        {against.length > 0 && (
          <div className="rounded-xl bg-red-50 p-2.5 text-xs">
            <div className="mb-1 font-black text-red-700">{t("econ.against", { n: Math.round((cuts.get(state.player) ?? 0) * 100) })}</div>
            <div className="flex flex-wrap gap-1.5">
              {against.map((s) => (
                <span key={s.by} className="inline-flex items-center gap-1 font-bold text-red-700">
                  <Flag tag={s.by} scenario={state.scenarioId} color={state.countries[s.by]?.color} size="sm" />
                  {name(s.by)} · {t(`econ.scope.${s.scope}` as MessageKey)}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>
      )}

      {tab === "deals" && (
        <Deals
          state={state}
          regions={regions}
          offers={offers}
          position={position}
          disabled={disabled}
          onSign={onSign}
          onDecline={onDecline}
          onPropose={onPropose}
          onCancel={onCancel}
          name={name}
          money={money}
          date={(iso) => formatDate(iso, locale)}
          world={accounts?.world}
        />
      )}

      {tab === "budget" && (
      <section className="grid gap-2">
        <div className={ui.label}>{t("econ.decisions")}</div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK.map((key) => (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={() => order(key)}
              className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-left text-xs font-semibold text-ink transition-colors hover:border-accent/30 disabled:opacity-50"
            >
              {t(`econ.quick.${key}` as MessageKey)}
            </button>
          ))}
        </div>
      </section>
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

/** The market's offers this turn, the deals in force and the player's own proposals. */
function Deals({
  state,
  regions,
  offers,
  position,
  disabled,
  onSign,
  onDecline,
  onPropose,
  onCancel,
  name,
  money,
  date,
  world,
}: {
  state: GameState;
  regions: Record<string, MapRegion> | null;
  offers: TradeOffer[];
  position: { good: TradeGood; balance: number; contracted: number }[];
  disabled: boolean;
  onSign: (offer: TradeOffer) => void;
  onDecline: (offer: TradeOffer) => void;
  onPropose: EconomyCenterProps["onPropose"];
  onCancel: (id: string) => void;
  name: (tag: string) => string;
  money: (billions: number) => string;
  date: (iso: string) => string;
  world?: WorldScale;
}) {
  const { t, text } = useI18n();
  const volume = useVolume(world);
  const [side, setSide] = useState<"sell" | "buy">("sell");
  const [good, setGood] = useState<TradeGood>(position[0]?.good ?? "grain");
  const [partner, setPartner] = useState("");
  const [value, setValue] = useState(1);
  const [premium, setPremium] = useState(0);
  const [years, setYears] = useState(2);
  const deals = (state.deals ?? []).filter((d) => d.status === "active" || d.status === "proposed");
  const left = dealsLeft(state);
  const room = regions ? capacity(state, regions, good, side) : 0;
  const countries = Object.values(state.countries)
    .filter((c) => c.tag !== state.player && !c.dormant && c.economy)
    .sort((a, b) => text(a.name).localeCompare(text(b.name)));
  const flag = (tag: string) => <Flag tag={tag} scenario={state.scenarioId} color={state.countries[tag]?.color} size="sm" />;
  const goodChip = (g: TradeGood) => <span className={`rounded-md px-1.5 py-0.5 text-2xs font-black uppercase tracking-wider ${GOOD_TONE[g]}`}>{t(`goods.${g}` as MessageKey)}</span>;
  const terms = (d: Pick<TradeDeal, "good" | "value" | "premium" | "years">) =>
    [volume(d.good, d.value, state.scenarioId), t("deals.premium", { n: `${d.premium > 0 ? "+" : ""}${d.premium}` }), t("deals.years", { n: d.years })].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col gap-4">
      <section className="grid gap-2">
        <div className={`${ui.label} flex items-center gap-1.5`}>
          <FileSignature className="h-3.5 w-3.5" />
          {t("deals.offers")}
        </div>
        <p className={`text-2xs font-bold ${left ? "text-muted" : "text-amber-700"}`}>{left ? t("deals.left", { n: left, max: MAX_NEW_DEALS }) : t("deals.noneLeft")}</p>
        {offers.length === 0 && left > 0 && <p className="text-xs font-medium text-muted">{t("deals.noOffers")}</p>}
        {offers.map((o) => (
          <div key={o.id} className="rounded-xl border border-line bg-surface p-3">
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
              <button type="button" disabled={disabled} onClick={() => onSign(o)} className={`${ui.primary} flex-1 px-3 py-2 text-2xs`}>
                <Check className="h-3.5 w-3.5" />
                {t("deals.sign")}
              </button>
              <button type="button" disabled={disabled} onClick={() => onDecline(o)} className={`${ui.secondary} px-3 py-2 text-2xs`}>
                <X className="h-3.5 w-3.5" />
                {t("deals.decline")}
              </button>
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-2">
        <div className={ui.label}>{t("deals.active")}</div>
        {deals.length === 0 && <p className="text-xs font-medium text-muted">{t("deals.none")}</p>}
        {deals.map((d) => (
          <div key={d.id} className="flex items-start gap-2 rounded-xl bg-page px-3 py-2">
            <span className={`mt-0.5 shrink-0 ${d.side === "sell" ? "text-emerald-700" : "text-sky-700"}`}>{d.side === "sell" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 text-xs font-black text-ink">
                {goodChip(d.good)}
                {flag(d.partner)}
                <span className="truncate">{name(d.partner)}</span>
              </div>
              <div className="mt-0.5 text-2xs font-medium text-muted">
                {terms(d)} · {d.status === "proposed" ? <span className="font-bold text-amber-700">{t("deals.pending")}</span> : t("deals.until", { date: date(d.until) })}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-xs font-black tabular-nums text-ink">{money(d.value)}</div>
              <button type="button" disabled={disabled} onClick={() => onCancel(d.id)} className="text-2xs font-black uppercase tracking-wider text-muted hover:text-accent">
                {d.status === "proposed" ? t("deals.withdraw") : t("deals.cancel")}
              </button>
            </div>
          </div>
        ))}
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

      <section className="grid gap-2 rounded-xl bg-page p-3">
        <div className={`${ui.label} flex items-center gap-1.5`}>
          <Handshake className="h-3.5 w-3.5" />
          {t("deals.propose")}
        </div>
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface p-1">
          {(["sell", "buy"] as const).map((v) => (
            <button key={v} type="button" onClick={() => setSide(v)} className={`${ui.segment} ${side === v ? ui.segmentOn : ui.segmentOff}`}>
              {t(v === "sell" ? "deals.sideSell" : "deals.sideBuy")}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <label className="grid gap-1 text-2xs font-bold text-muted">
            {t("deals.good")}
            <select value={good} onChange={(e) => setGood(e.target.value as TradeGood)} className={`${ui.input} py-2 text-xs`}>
              {TRADE_GOODS.map((g) => (
                <option key={g} value={g}>
                  {t(`goods.${g}` as MessageKey)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-2xs font-bold text-muted">
            {t("deals.partner")}
            <select value={partner} onChange={(e) => setPartner(e.target.value)} className={`${ui.input} py-2 text-xs`}>
              <option value="">{t("deals.pickPartner")}</option>
              {countries.map((c) => (
                <option key={c.tag} value={c.tag}>
                  {text(c.name)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <label className="grid gap-1 text-2xs font-bold text-muted">
            {t("deals.value")}
            <input type="number" min={0.01} step={0.1} value={value} onChange={(e) => setValue(Math.max(0, Number(e.target.value) || 0))} className={`${ui.input} px-2 py-2 text-xs tabular-nums`} />
          </label>
          <label className="grid gap-1 text-2xs font-bold text-muted">
            {t("deals.priceLabel")}
            <input type="number" min={-50} max={50} step={1} value={premium} onChange={(e) => setPremium(Number(e.target.value) || 0)} className={`${ui.input} px-2 py-2 text-xs tabular-nums`} />
          </label>
          <label className="grid gap-1 text-2xs font-bold text-muted">
            {t("deals.yearsLabel")}
            <input type="number" min={1} max={10} step={1} value={years} onChange={(e) => setYears(Math.max(1, Number(e.target.value) || 1))} className={`${ui.input} px-2 py-2 text-xs tabular-nums`} />
          </label>
        </div>
        {volume(good, value, state.scenarioId) && <div className="text-2xs font-bold text-muted">{volume(good, value, state.scenarioId)}</div>}
        <div className={`text-2xs font-bold ${room > 0 ? "text-muted" : "text-amber-700"}`}>{t("deals.capacity", { value: money(room) })}</div>
        <button
          type="button"
          disabled={disabled || !partner || value <= 0 || room <= 0 || !left}
          onClick={() => {
            onPropose({ partner, good, side, value, premium, years });
            setPartner("");
          }}
          className={`${ui.primary} px-3 py-2.5 text-xs`}
        >
          <Plus className="h-4 w-4" />
          {t("deals.send")}
        </button>
        <p className="text-2xs font-medium text-muted">{t("deals.sendNote")}</p>
      </section>
    </div>
  );
}

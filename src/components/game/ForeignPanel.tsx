"use client";

import { CalendarPlus, ChevronLeft, Handshake, Mic, MessageSquare, Search, Swords, Users, X } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import Flag from "@/components/Flag";
import { ui } from "@/components/ui/classes";
import Dictation from "@/components/voice/Dictation";
import { addStep, formatDate } from "@/engine/calendar";
import { BLOC_KINDS, canHoldNow, type BlocKind } from "@/engine/foreign";
import { planLadder, shownStage } from "@/engine/intentions";
import { planKindKey, planStageKey } from "./changes";
import type { Alliance, GameState, Plan, Proposal, Summit, Text, War } from "@/engine/types";
import { lossesView, warFrontsOf } from "@/engine/warLosses";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import TalksThread from "./TalksThread";

export type ForeignSection = "wars" | "pacts" | "blocs" | "talks";

interface ForeignPanelProps {
  state: GameState;
  disabled: boolean;
  /** The section open; the game keeps it, so a click on the map can pick whom to write to. */
  section: ForeignSection;
  onSection: (section: ForeignSection) => void;
  /** Province names, once the map has loaded. */
  places?: (id: string) => string;
  /** The government the talks are with: picked in the list or on the map. */
  talkTarget: string | null;
  onTalkTarget: (tag: string | null) => void;
  /** A letter on its way. */
  talking: { chars: number } | null;
  /** Letters can go now: a game master is ready. */
  canTalk: boolean;
  /** Letters speak for the state: none for a player in opposition. */
  talksOff: boolean;
  onSend: (target: string, message: string) => Promise<boolean>;
  onPropose: (proposal: Proposal) => void;
  onWithdraw: (id: string) => void;
  onSchedule: (summit: Summit) => void;
  onOpenSummit: (summit: Summit) => void;
  /** Hold a planned meeting or a called session in person now. */
  onLive: (summit: Summit) => void;
}

/** Full months from one date to another. */
function monthsBetween(from: string, to: string): number {
  const [ya, ma, da] = from.split("-").map(Number);
  const [yb, mb, db] = to.split("-").map(Number);
  return Math.max(0, (yb - ya) * 12 + (mb - ma) - (db < da ? 1 : 0));
}

/** A searchable list of countries to tick, for invitations and summits. */
function CountryPicker({ state, picked, onChange }: { state: GameState; picked: string[]; onChange: (tags: string[]) => void }) {
  const { t, text, locale } = useI18n();
  const [query, setQuery] = useState("");
  const options = useMemo(
    () =>
      Object.values(state.countries)
        .filter((c) => c.tag !== state.player && !c.dormant)
        .sort((a, b) => text(a.name).localeCompare(text(b.name), locale)),
    [state.countries, state.player, text, locale],
  );
  const q = query.trim().toLowerCase();
  const shown = options.filter((c) => !q || text(c.name).toLowerCase().includes(q) || c.tag.includes(q)).slice(0, 40);
  const toggle = (tag: string) => onChange(picked.includes(tag) ? picked.filter((x) => x !== tag) : [...picked, tag]);
  return (
    <div className="grid gap-2">
      {picked.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {picked.map((tag) => (
            <button key={tag} type="button" onClick={() => toggle(tag)} className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-2 py-1 text-xs font-bold text-on-ink">
              <Flag tag={tag} scenario={state.scenarioId} color={state.countries[tag]?.color} size="sm" />
              {text(state.countries[tag]?.name ?? tag)}
              <X className="h-3 w-3" />
            </button>
          ))}
        </div>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("foreign.search")} className={`${ui.input} py-2 pl-9`} />
      </div>
      <div className="grid max-h-40 gap-0.5 overflow-y-auto rounded-xl border border-line sheet p-1">
        {shown.map((c) => (
          <label key={c.tag} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-bold text-ink hover:bg-page">
            <input type="checkbox" checked={picked.includes(c.tag)} onChange={() => toggle(c.tag)} className="h-3.5 w-3.5 accent-current" />
            <Flag tag={c.tag} scenario={state.scenarioId} color={c.color} size="sm" />
            {text(c.name)}
          </label>
        ))}
      </div>
    </div>
  );
}

/** Countries as flags only: each name on hover, a long list folded after a dozen (`still` inside a button: the rest only counted). */
function Flags({ state, tags, still = false }: { state: GameState; tags: string[]; still?: boolean }) {
  const { t, text } = useI18n();
  const [open, setOpen] = useState(false);
  const shown = tags.length > 14 && !open ? tags.slice(0, 12) : tags;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {shown.map((tag) => {
        const name = text(state.countries[tag]?.name ?? tag);
        return (
          <span key={tag} title={name} aria-label={name} role="img" className="inline-flex">
            <Flag tag={tag} scenario={state.scenarioId} color={state.countries[tag]?.color} size="sm" />
          </span>
        );
      })}
      {tags.length > 14 && !open && still && <span className="text-2xs font-black uppercase tracking-wider text-muted">{t("foreign.more", { n: tags.length - 12 })}</span>}
      {tags.length > 14 && !open && !still && (
        <button type="button" onClick={() => setOpen(true)} className="text-2xs font-black uppercase tracking-wider text-muted hover:text-accent">
          {t("foreign.more", { n: tags.length - 12 })}
        </button>
      )}
    </span>
  );
}

/** A card whose description shows on hover, focus or a tap, over the cards below it. */
function HoverCard({ children, note }: { children: ReactNode; note?: ReactNode }) {
  const [open, setOpen] = useState(false);
  if (!note) return <li className="rounded-xl bg-page px-3 py-2">{children}</li>;
  return (
    <li
      tabIndex={0}
      onClick={() => setOpen((v) => !v)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setOpen((v) => !v);
        }
      }}
      onMouseLeave={() => setOpen(false)}
      onBlur={() => setOpen(false)}
      className="group relative cursor-default rounded-xl bg-page px-3 py-2 outline-none transition-colors hover:bg-divider focus-visible:ring-2 focus-visible:ring-accent/40"
    >
      {children}
      <div
        role="tooltip"
        className={`absolute left-0 right-0 top-full z-20 mt-1 rounded-xl border border-line sheet p-3 text-xs font-medium leading-relaxed text-ink shadow-lg ${open ? "block" : "hidden group-hover:block group-focus-visible:block"}`}
      >
        {note}
      </div>
    </li>
  );
}

/**
 * Foreign policy in four parts: the wars (who fights, what it has cost each
 * side as the player's government knows it, the fronts and the plans known
 * abroad); pacts and truces; organisations and alliances with their
 * sessions and summits; and the talks with any government. Members show as
 * flags, descriptions on hover. A bloc's session is called by an order.
 */
export default function ForeignPanel({
  state,
  disabled,
  section,
  onSection,
  places,
  talkTarget,
  onTalkTarget,
  talking,
  canTalk,
  talksOff,
  onSend,
  onPropose,
  onWithdraw,
  onSchedule,
  onOpenSummit,
  onLive,
}: ForeignPanelProps) {
  const { t, text, locale, people } = useI18n();
  const [form, setForm] = useState<"bloc" | "summit" | null>(null);
  const [kind, setKind] = useState<BlocKind>("alliance");
  const [title, setTitle] = useState("");
  const [terms, setTerms] = useState("");
  const [place, setPlace] = useState("");
  const [date, setDate] = useState(() => addStep(state.date, "month"));
  const [picked, setPicked] = useState<string[]>([]);
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [kindShown, setKindShown] = useState<BlocKind | null>(null);
  const [query, setQuery] = useState("");
  const periodEnd = addStep(state.date, state.step);

  const reset = () => {
    setForm(null);
    setTitle("");
    setTerms("");
    setPlace("");
    setPicked([]);
  };
  const mine = (tags: string[]) => tags.includes(state.player);
  const wars = [...state.wars].sort((a, b) => Number(mine([...b.attackers, ...b.defenders])) - Number(mine([...a.attackers, ...a.defenders])));
  const truces = wars.filter((w) => w.truce);
  const blocsOf = (kinds: BlocKind[]) => [...state.alliances].filter((a) => kinds.includes(a.kind ?? "alliance")).sort((a, b) => Number(mine(b.members)) - Number(mine(a.members)));
  const pacts = blocsOf(["pact", "trade"]);
  const orgs = blocsOf(["alliance", "organization"]);
  const scoped = (list: Alliance[]) => {
    const ours = list.filter((a) => mine(a.members));
    return scope === "mine" && ours.length ? ours : list;
  };
  const summits = [...(state.summits ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  const summitTitle = (s: Summit) => {
    const bloc = s.bloc ? state.alliances.find((a) => a.id === s.bloc) : undefined;
    return bloc ? t("live.sessionOf", { name: text(bloc.name) }) : s.title;
  };
  const termsNote = (terms?: Text, until?: string) =>
    terms || until ? (
      <>
        {terms ? text(terms) : ""}
        {terms && until ? " · " : ""}
        {until ? t("foreign.until", { date: formatDate(until, locale) }) : ""}
      </>
    ) : undefined;

  /** Soldiers: under a thousand as they are, more in thousands or millions. */
  const soldiers = (thousands: number) => (thousands < 1 ? Math.round(thousands * 1000).toLocaleString(locale) : people(thousands));
  const span = (since: string) => {
    const months = monthsBetween(since, state.date);
    if (months < 1) return t("foreign.span.new");
    const years = Math.floor(months / 12);
    return [years ? t("foreign.span.y", { n: years }) : "", months % 12 ? t("foreign.span.m", { n: months % 12 }) : ""].filter(Boolean).join(" ");
  };

  const segment = (id: ForeignSection, label: string, n?: number) => (
    <button key={id} type="button" role="tab" onClick={() => onSection(id)} aria-selected={section === id} className={`${ui.segment} min-w-0 px-1.5 ${section === id ? `${ui.segmentOn} bg-surface shadow-sm` : ui.segmentOff}`}>
      <span className="block leading-tight">
        {label}
        {n ? <span className="font-medium text-muted"> · {n}</span> : null}
      </span>
    </button>
  );

  const planRow = (p: Plan) => {
    const stage = shownStage(p)!;
    const ladder = planLadder(p.kind);
    const reached = ladder.indexOf(stage);
    return (
      <li key={p.id} className="grid gap-1">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <Flags state={state} tags={[p.by]} />
          <span className="font-bold text-ink">{t(planKindKey(p))}</span>
          {p.target && <Flags state={state} tags={[p.target]} />}
          <span className="font-medium text-muted">{t(planStageKey(p, stage))}</span>
        </div>
        <div className="flex gap-1" aria-hidden>
          {ladder.map((s, i) => (
            <span key={s} className={`h-1 flex-1 rounded-full ${i <= reached ? "bg-accent" : "bg-divider"}`} />
          ))}
        </div>
      </li>
    );
  };

  const warCard = (w: War) => {
    const sides = [...w.attackers, ...w.defenders];
    const inWar = new Set(sides);
    const contested = Object.entries(state.regions)
      .filter(([, r]) => r.contested && inWar.has(r.contested) && inWar.has(r.controller) && w.attackers.includes(r.contested) !== w.attackers.includes(r.controller))
      .sort(([, a], [, b]) => (b.held ?? 0) - (a.held ?? 0));
    const held = (country: string) => {
      const enemies = new Set(w.attackers.includes(country) ? w.defenders : w.attackers);
      return Object.values(state.regions).filter((r) => r.controller === country && enemies.has(r.owner)).length;
    };
    const plans = (state.plans ?? []).filter(
      (p) => !p.end && shownStage(p) && (p.war === w.id || (p.kind === "war" && p.target !== undefined && inWar.has(p.target) && !inWar.has(p.by))),
    );
    const fighting = sides.filter((c) => lossesView(state, w, c) || warFrontsOf(state, w, c) > 0);
    return (
      <li key={w.id} className="grid gap-3 rounded-xl bg-page p-3">
        <div>
          <div className="flex items-start justify-between gap-2">
            <span className="text-sm font-black text-ink">{text(w.name)}</span>
            {w.truce && (
              <span className="shrink-0 rounded-md bg-amber-50 px-2 py-0.5 text-2xs font-black uppercase tracking-wider text-amber-700">{t("foreign.truceUntil", { date: formatDate(w.truce.until, locale) })}</span>
            )}
          </div>
          <div className="mt-0.5 text-xs font-medium tabular-nums text-muted">{t("foreign.since", { date: formatDate(w.since, locale), span: span(w.since) })}</div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Flags state={state} tags={w.attackers} />
            <span className="text-2xs font-black text-muted">vs</span>
            <Flags state={state} tags={w.defenders} />
          </div>
        </div>

        <div>
          <div className={`${ui.label} mb-1`}>{t("foreign.losses")}</div>
          {fighting.some((c) => lossesView(state, w, c)) ? (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-2xs font-black uppercase tracking-wider text-muted">
                  <th className="pb-1 font-black" />
                  <th className="pb-1 text-right font-black">{t("foreign.killed")}</th>
                  <th className="pb-1 text-right font-black">{t("foreign.wounded")}</th>
                  <th className="pb-1 text-right font-black">{t("foreign.heavy")}</th>
                </tr>
              </thead>
              <tbody>
                {sides.map((c) => {
                  const v = lossesView(state, w, c);
                  if (!v) return null;
                  const cell = (e: (typeof v)["killed"], show: (n: number) => string) => (
                    <td className="py-0.5 text-right font-bold tabular-nums text-ink" title={e.exact ? undefined : t("foreign.estimate", { low: show(e.low), high: show(e.high) })}>
                      {e.exact ? "" : "≈ "}
                      {e.value > 0 ? show(e.value) : "0"}
                    </td>
                  );
                  return (
                    <tr key={c} className="border-t border-divider">
                      <td className="py-0.5">
                        <Flags state={state} tags={[c]} />
                      </td>
                      {cell(v.killed, soldiers)}
                      {cell(v.wounded, soldiers)}
                      {cell(v.heavy, (n) => Math.round(n).toLocaleString(locale))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="text-xs font-medium text-muted">{t("foreign.noLosses")}</p>
          )}
        </div>

        <div>
          <div className={`${ui.label} mb-1`}>{t("foreign.front")}</div>
          {contested.length ? (
            <div className="grid gap-1.5">
              <div className="text-xs font-bold text-ink">{t("foreign.frontCount", { n: contested.length })}</div>
              <ul className="grid gap-1">
                {contested.slice(0, 5).map(([id, r]) => (
                  <li key={id} className="grid gap-0.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate font-medium text-ink">{places?.(id) ?? id}</span>
                      <span className="flex shrink-0 items-center gap-1 font-bold tabular-nums text-muted">
                        <Flags state={state} tags={[r.contested!]} />
                        {r.held ?? 0}%
                      </span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-divider" aria-hidden>
                      <div className="h-full rounded-full bg-war" style={{ width: `${Math.min(100, r.held ?? 0)}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs font-medium text-muted">{t("foreign.frontNone")}</p>
          )}
          {sides.some((c) => held(c) > 0) && (
            <ul className="mt-1.5 grid gap-0.5">
              {sides
                .filter((c) => held(c) > 0)
                .map((c) => (
                  <li key={c} className="flex items-center gap-1.5 text-xs font-medium text-muted">
                    <Flags state={state} tags={[c]} />
                    {t("foreign.heldOf", { n: held(c) })}
                  </li>
                ))}
            </ul>
          )}
        </div>

        {plans.length > 0 && (
          <div>
            <div className={`${ui.label} mb-1`}>{t("foreign.plans")}</div>
            <ul className="grid gap-2">{plans.map(planRow)}</ul>
          </div>
        )}
      </li>
    );
  };

  const blocList = (list: Alliance[], empty: string) =>
    list.length === 0 ? (
      <p className="text-xs font-medium text-muted">{empty}</p>
    ) : (
      <ul className="grid gap-1.5">
        {list.map((a) => (
          <HoverCard key={a.id} note={termsNote(a.terms, a.until)}>
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-black text-ink">{text(a.name)}</span>
              <span className="shrink-0 rounded-md sheet px-1.5 py-0.5 text-2xs font-black uppercase tracking-wider text-muted">{t(`foreign.kind.${a.kind ?? "alliance"}` as MessageKey)}</span>
            </div>
            <div className="mt-1.5">
              <Flags state={state} tags={a.members} />
            </div>
          </HoverCard>
        ))}
      </ul>
    );

  const scopeSwitch = (list: Alliance[]) => {
    const ours = list.filter((a) => mine(a.members));
    if (!list.length || !ours.length || ours.length === list.length) return null;
    return (
      <div className="mb-2 grid grid-cols-2 gap-1 rounded-xl bg-page p-1">
        {(["mine", "all"] as const).map((id) => (
          <button key={id} type="button" onClick={() => setScope(id)} aria-pressed={scope === id} className={`${ui.segment} ${scope === id ? `${ui.segmentOn} bg-surface shadow-sm` : ui.segmentOff}`}>
            {t(`foreign.scope.${id}` as MessageKey, { n: id === "mine" ? ours.length : list.length })}
          </button>
        ))}
      </div>
    );
  };

  // Talks: every government written to, the latest first; any other found by name or picked on the map.
  const threads = Object.entries(state.diplomacy)
    .filter(([tag, letters]) => letters.length > 0 && state.countries[tag])
    .sort(([, a], [, b]) => (b.at(-1)?.turn ?? 0) - (a.at(-1)?.turn ?? 0) || (b.at(-1)?.date ?? "").localeCompare(a.at(-1)?.date ?? ""));
  const q = query.trim().toLowerCase();
  const found = q
    ? Object.values(state.countries)
        .filter((c) => c.tag !== state.player && (text(c.name).toLowerCase().includes(q) || c.tag.includes(q)))
        .sort((a, b) => text(a.name).localeCompare(text(b.name), locale))
        .slice(0, 12)
    : [];
  const countryRow = (tag: string, sub?: string) => (
    <li key={tag}>
      <button type="button" onClick={() => onTalkTarget(tag)} className="flex w-full items-center gap-2.5 rounded-xl bg-page px-3 py-2 text-left transition-colors hover:bg-divider">
        <Flag tag={tag} scenario={state.scenarioId} color={state.countries[tag]?.color} size="md" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-black text-ink">{text(state.countries[tag]?.name ?? tag)}</span>
          {sub && <span className="block truncate text-xs font-medium text-muted">{sub}</span>}
        </span>
      </button>
    </li>
  );

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" className="grid grid-cols-2 gap-1 rounded-xl bg-page p-1">
        {segment("wars", t("foreign.section.wars"), wars.length)}
        {segment("pacts", t("foreign.section.pacts"))}
        {segment("blocs", t("foreign.section.blocs"))}
        {!talksOff && segment("talks", t("foreign.section.talks"))}
      </div>

      {section === "wars" && (
        <section>
          <div className={`${ui.label} mb-2 flex items-center gap-1.5`}>
            <Swords className="h-3.5 w-3.5" />
            {t("foreign.section.wars")}
          </div>
          {wars.length === 0 ? <p className="text-xs font-medium text-muted">{t("foreign.noWars")}</p> : <ul className="grid gap-2">{wars.map(warCard)}</ul>}
        </section>
      )}

      {section === "pacts" && (
        <>
          <section>
            <div className={`${ui.label} mb-2`}>{t("foreign.truces")}</div>
            {truces.length === 0 ? (
              <p className="text-xs font-medium text-muted">{t("foreign.noTruces")}</p>
            ) : (
              <ul className="grid gap-1.5">
                {truces.map((w) => (
                  <HoverCard key={w.id} note={w.truce?.terms ? text(w.truce.terms) : undefined}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-black text-ink">{text(w.name)}</span>
                      <span className="shrink-0 text-2xs font-black uppercase tracking-wider text-amber-700">{t("foreign.truceUntil", { date: formatDate(w.truce!.until, locale) })}</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <Flags state={state} tags={w.attackers} />
                      <span className="text-2xs font-black text-muted">vs</span>
                      <Flags state={state} tags={w.defenders} />
                    </div>
                  </HoverCard>
                ))}
              </ul>
            )}
          </section>
          <section>
            <div className={`${ui.label} mb-2 flex items-center gap-1.5`}>
              <Handshake className="h-3.5 w-3.5" />
              {t("foreign.pacts")}
            </div>
            {scopeSwitch(pacts)}
            {blocList(scoped(pacts), t("foreign.noPacts"))}
          </section>
        </>
      )}

      {section === "blocs" && (
        <>
          <section>
            <div className={`${ui.label} mb-2 flex items-center gap-1.5`}>
              <Handshake className="h-3.5 w-3.5" />
              {t("foreign.section.blocs")}
            </div>
            {scopeSwitch(orgs)}
            {orgs.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1">
                {([null, "alliance", "organization"] as const).map((k) => (
                  <button
                    key={k ?? "any"}
                    type="button"
                    onClick={() => setKindShown(k)}
                    aria-pressed={kindShown === k}
                    className={`rounded-md px-2 py-0.5 text-2xs font-black uppercase tracking-wider transition-colors ${kindShown === k ? "bg-ink text-on-ink" : "bg-page text-muted hover:text-ink"}`}
                  >
                    {k ? t(`foreign.kind.${k}` as MessageKey) : t("foreign.kind.any")}
                  </button>
                ))}
              </div>
            )}
            {blocList(
              scoped(orgs).filter((a) => !kindShown || (a.kind ?? "alliance") === kindShown),
              t("foreign.noBlocs"),
            )}
          </section>

          {(state.proposals ?? []).length > 0 && (
            <section>
              <div className={`${ui.label} mb-2`}>{t("foreign.proposals")}</div>
              <ul className="grid gap-1.5">
                {(state.proposals ?? []).map((p) => (
                  <li key={p.id} className="flex items-start gap-2 rounded-xl border border-dashed border-line px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-black text-ink">
                        {p.name} <span className="text-2xs font-black uppercase tracking-wider text-muted">{t(`foreign.kind.${p.kind}` as MessageKey)}</span>
                      </div>
                      <div className="mt-1">
                        <Flags state={state} tags={p.invited} />
                      </div>
                    </div>
                    <button type="button" disabled={disabled} onClick={() => onWithdraw(p.id)} className="text-2xs font-black uppercase tracking-wider text-muted hover:text-red-600">
                      {t("foreign.withdraw")}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <div className={`${ui.label} mb-2 flex items-center gap-1.5`}>
              <Users className="h-3.5 w-3.5" />
              {t("foreign.summits")}
            </div>
            {summits.length === 0 ? (
              <p className="text-xs font-medium text-muted">{t("foreign.noSummits")}</p>
            ) : (
              <ul className="grid gap-1.5">
                {summits.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      disabled={s.status !== "held"}
                      onClick={() => onOpenSummit(s)}
                      title={s.agenda || undefined}
                      className="block w-full rounded-xl bg-page px-3 py-2 text-left transition-colors enabled:hover:bg-divider"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-black text-ink">{summitTitle(s)}</span>
                        <span className={`shrink-0 text-2xs font-black uppercase tracking-wider ${s.status === "held" ? "text-accent" : s.status === "missed" ? "text-muted" : "text-amber-700"}`}>
                          {t(`foreign.summit.${s.status}` as MessageKey)}
                        </span>
                      </div>
                      <div className="text-xs font-medium tabular-nums text-muted">{[s.place, formatDate(s.date, locale)].filter(Boolean).join(" · ")}</div>
                      <div className="mt-1">
                        <Flags state={state} tags={s.participants} still />
                      </div>
                    </button>
                    {canHoldNow(state, s, periodEnd) && (
                      <button type="button" disabled={disabled} onClick={() => onLive(s)} className={`${ui.primary} mt-1 w-full px-3 py-2 text-2xs`}>
                        <Mic className="h-3.5 w-3.5" />
                        {(s.transcript ?? []).length ? t("foreign.resume") : t("foreign.attend")}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {form === null && (
            <div className="grid gap-2 sm:grid-cols-2">
              <button type="button" disabled={disabled} onClick={() => setForm("bloc")} className={`${ui.secondary} px-3 py-2.5 text-xs`}>
                <Handshake className="h-4 w-4" />
                {t("foreign.found")}
              </button>
              <button type="button" disabled={disabled} onClick={() => setForm("summit")} className={`${ui.secondary} px-3 py-2.5 text-xs`}>
                <CalendarPlus className="h-4 w-4" />
                {t("foreign.propose")}
              </button>
            </div>
          )}

          {form === "bloc" && (
            <section className={`${ui.card} grid gap-3 p-4`}>
              <div className={ui.label}>{t("foreign.found")}</div>
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-page p-1">
                {BLOC_KINDS.map((k) => (
                  <button key={k} type="button" onClick={() => setKind(k)} className={`${ui.segment} ${kind === k ? `${ui.segmentOn} bg-surface shadow-sm` : ui.segmentOff}`}>
                    {t(`foreign.kind.${k}` as MessageKey)}
                  </button>
                ))}
              </div>
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder={t("foreign.blocNamePlaceholder")} aria-label={t("foreign.blocName")} className={`${ui.input} py-2.5`} />
              <div className={ui.label}>{t("foreign.invite")}</div>
              <CountryPicker state={state} picked={picked} onChange={setPicked} />
              <Dictation id="bloc-terms" set={setTerms} max={300}>
                <textarea value={terms} onChange={(e) => setTerms(e.target.value)} maxLength={300} rows={2} placeholder={t("foreign.termsPlaceholder")} aria-label={t("foreign.terms")} className={`${ui.input} resize-none`} />
              </Dictation>
              <p className="text-2xs font-medium text-muted">{t("foreign.sent")}</p>
              <div className="flex gap-2">
                <button type="button" onClick={reset} className={`${ui.secondary} flex-1 px-3 py-2.5 text-xs`}>
                  {t("foreign.cancel")}
                </button>
                <button
                  type="button"
                  disabled={!title.trim() || picked.length === 0}
                  onClick={() => {
                    onPropose({ id: `p${state.turn}-${Date.now().toString(36)}`, kind, name: title.trim(), invited: picked, ...(terms.trim() ? { terms: terms.trim() } : {}), date: state.date });
                    reset();
                  }}
                  className={`${ui.primary} flex-1 px-3 py-2.5 text-xs`}
                >
                  {t("foreign.send")}
                </button>
              </div>
            </section>
          )}

          {form === "summit" && (
            <section className={`${ui.card} grid gap-3 p-4`}>
              <div className={ui.label}>{t("foreign.propose")}</div>
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder={t("foreign.summitTitlePlaceholder")} aria-label={t("foreign.summitTitle")} className={`${ui.input} py-2.5`} />
              <div className="grid grid-cols-2 gap-2">
                <input value={place} onChange={(e) => setPlace(e.target.value)} maxLength={80} placeholder={t("foreign.place")} aria-label={t("foreign.place")} className={`${ui.input} py-2.5`} />
                <input type="date" value={date} min={state.date} max={addStep(state.date, "year")} onChange={(e) => setDate(e.target.value)} aria-label={t("foreign.date")} className={`${ui.input} py-2.5`} />
              </div>
              <div className={ui.label}>{t("foreign.participants")}</div>
              <CountryPicker state={state} picked={picked} onChange={setPicked} />
              <Dictation id="summit-agenda" set={setTerms} max={300}>
                <textarea value={terms} onChange={(e) => setTerms(e.target.value)} maxLength={300} rows={2} placeholder={t("foreign.agenda")} aria-label={t("foreign.agenda")} className={`${ui.input} resize-none`} />
              </Dictation>
              <div className="flex gap-2">
                <button type="button" onClick={reset} className={`${ui.secondary} flex-1 px-3 py-2.5 text-xs`}>
                  {t("foreign.cancel")}
                </button>
                <button
                  type="button"
                  disabled={!title.trim() || picked.length === 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date < state.date}
                  onClick={() => {
                    onSchedule({
                      id: `ps${state.turn}-${Date.now().toString(36)}`,
                      title: title.trim(),
                      place: place.trim(),
                      date,
                      participants: [state.player, ...picked],
                      ...(terms.trim() ? { agenda: terms.trim() } : {}),
                      by: "player",
                      status: "planned",
                    });
                    reset();
                  }}
                  className={`${ui.primary} flex-1 px-3 py-2.5 text-xs`}
                >
                  {t("foreign.schedule")}
                </button>
              </div>
            </section>
          )}
        </>
      )}

      {section === "talks" &&
        !talksOff &&
        (talkTarget && state.countries[talkTarget] && talkTarget !== state.player ? (
          <section className="flex min-w-0 flex-col gap-3">
            <button type="button" onClick={() => onTalkTarget(null)} className="inline-flex items-center gap-1 self-start text-2xs font-black uppercase tracking-wider text-muted hover:text-accent">
              <ChevronLeft className="h-3.5 w-3.5" />
              {t("foreign.talks.back")}
            </button>
            <TalksThread state={state} target={talkTarget} busy={talking} disabled={!canTalk} onSend={onSend} />
          </section>
        ) : (
          <section className="flex min-w-0 flex-col gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("foreign.search")} aria-label={t("foreign.talks.pick")} className={`${ui.input} py-2 pl-9`} />
            </div>
            {found.length > 0 && <ul className="grid gap-1">{found.map((c) => countryRow(c.tag))}</ul>}
            <div>
              <div className={`${ui.label} mb-2 flex items-center gap-1.5`}>
                <MessageSquare className="h-3.5 w-3.5" />
                {t("foreign.talks.threads")}
              </div>
              {threads.length === 0 ? (
                <p className="text-xs font-medium text-muted">{t("foreign.talks.none")}</p>
              ) : (
                <ul className="grid gap-1">
                  {threads.map(([tag, letters]) => {
                    const last = letters.at(-1)!;
                    return countryRow(tag, `${formatDate(last.date, locale)} · ${last.text.replace(/\s+/g, " ").slice(0, 80)}`);
                  })}
                </ul>
              )}
            </div>
          </section>
        ))}
    </div>
  );
}

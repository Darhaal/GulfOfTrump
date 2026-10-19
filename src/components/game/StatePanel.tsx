"use client";

import { BookOpen, Building2, Check, FileSignature, Gavel, Loader2, MessageCircle, Palette, PenLine, ScrollText, Send, Undo2, type LucideIcon } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { cityNameIn, foundedBy, type CityRecord } from "@/components/map/cities";
import ChatScroll from "@/components/ui/ChatScroll";
import { ui } from "@/components/ui/classes";
import type { ActDraft } from "@/engine/acts";
import { ADVISOR_TITLES } from "@/engine/advisors";
import { formatDate } from "@/engine/calendar";
import { officialAt } from "@/engine/government";
import { LAW_IDS, LAWS, type Laws } from "@/engine/laws";
import { governmentSeats } from "@/engine/politics";
import type { Bill, GameState, Localized, MapRegion, Reaction } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import { useCities } from "@/lib/assets";
import { describeChange } from "./changes";
import { needed } from "./politics/actions";

export type ProclaimChange = { name?: Partial<Localized> | null; color?: string | null; place?: { key: string; name: Partial<Localized> | null } };
export type LawDraft = Extract<ActDraft, { kind: "law" }>;
/** A city the chief of staff may rename: its English name on the map and what it is called now. */
export type CityChoice = { key: string; name: string };

interface StatePanelProps {
  state: GameState;
  regions: Record<string, MapRegion> | null;
  /** The chief of staff's answer under way. */
  busy: { chars: number } | null;
  /** No question can be asked: no AI, or another request under way. */
  askDisabled: boolean;
  /** Nothing can be changed: the turn is being played. */
  locked: boolean;
  onAsk: (question: string, cities: CityChoice[]) => Promise<boolean>;
  onProclaim: (change: ProclaimChange, reaction?: Reaction) => void;
  onPropose: (draft: LawDraft) => void;
  onWithdraw: (id: string) => void;
}

type View = "talk" | "laws" | "acts";

/** How many of the country's cities the chief of staff is told about, largest first. */
const MAX_CITIES = 120;

/** How the country is expected to take an act. */
function ReactionChip({ r }: { r?: Reaction }) {
  const { t } = useI18n();
  if (!r) return null;
  const level = r.unrest >= 10 ? "outrage" : r.unrest >= 4 ? "discontent" : r.unrest <= -3 ? "support" : "calm";
  const tone = { outrage: "bg-red-50 text-red-700", discontent: "bg-amber-50 text-amber-700", calm: "bg-page text-muted", support: "bg-emerald-50 text-emerald-700" }[level];
  return (
    <div className="mt-2">
      <span className={`inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-2xs font-black uppercase tracking-wider ${tone}`}>
        {t(`state.reaction.${level}` as MessageKey)}
        <span className="tabular-nums normal-case">{t("state.reaction.unrest", { n: r.unrest > 0 ? `+${r.unrest}` : String(r.unrest) })}</span>
      </span>
      {r.note && <p className="mt-1 text-2xs font-medium leading-snug text-muted">{r.note}</p>}
    </div>
  );
}

/** What a law changes among the laws in force. */
function LawChanges({ laws, now }: { laws?: Laws; now?: Laws }) {
  const { t } = useI18n();
  const ids = LAW_IDS.filter((id) => laws?.[id]);
  if (!ids.length) return null;
  return (
    <ul className="mt-1.5 grid gap-0.5">
      {ids.map((id) => (
        <li key={id} className="text-2xs font-bold text-ink">
          {t(`law.${id}` as MessageKey)}: {now?.[id] && now[id] !== laws![id] && <span className="text-muted">{t(`law.${id}.${now[id]}` as MessageKey)} → </span>}
          {t(`law.${id}.${laws![id]}` as MessageKey)}
        </li>
      ))}
    </ul>
  );
}

function Card({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-page p-2.5">
      <div className="mb-1 flex items-center gap-1.5 text-2xs font-black uppercase tracking-widest text-muted">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      {children}
    </div>
  );
}

function Done({ children }: { children: ReactNode }) {
  return (
    <span className="mt-2 inline-flex items-center gap-1 text-2xs font-black uppercase tracking-wider text-emerald-700">
      <Check className="h-3 w-3" />
      {children}
    </span>
  );
}

const BILL_TONE: Record<Bill["status"], string> = { proposed: "bg-amber-50 text-amber-700", passed: "bg-emerald-50 text-emerald-700", failed: "bg-red-50 text-red-700" };

/**
 * The state: its laws and its symbols, changed in conversation. The leader
 * tells the chief of staff what to rename, recolour or enact and why; the
 * chief drafts each act — the name in three languages, the law with what it
 * changes and the vote it needs — and warns how the country will take it.
 * A draft becomes a proclamation or a bill with one click; the laws in
 * force and every act, pending or decided, can be read here.
 */
export default function StatePanel({ state, regions, busy, askDisabled, locked, onAsk, onProclaim, onPropose, onWithdraw }: StatePanelProps) {
  const { t, text, locale } = useI18n();
  const cities = useCities();
  const [view, setView] = useState<View>("talk");
  const [question, setQuestion] = useState("");
  const thread = state.legal ?? [];
  const chief = officialAt(state, "chief");
  const title = chief?.name ?? text(ADVISOR_TITLES.chief);
  const country = state.countries[state.player];
  const p = state.proclamation;
  const politics = state.politics;
  const laws = politics?.laws;
  const house = politics?.parliament;
  const held = politics ? governmentSeats(politics) : 0;
  const bills = state.bills ?? [];
  const open = bills.filter((b) => b.status === "proposed");
  const decided = bills.filter((b) => b.status !== "proposed").reverse();
  const pendingCount = open.length + (p ? (p.name ? 1 : 0) + (p.color ? 1 : 0) + Object.keys(p.places ?? {}).length : 0);

  /** The country's own cities: each city belongs to the nearest province of its modern country. */
  const own = useMemo(() => {
    if (!cities || !regions) return [] as CityRecord[];
    const byAdm = new Map<string, MapRegion[]>();
    for (const r of Object.values(regions)) if (r.at) byAdm.set(r.adm0, [...(byAdm.get(r.adm0) ?? []), r]);
    return cities
      .filter((c) => {
        if (!foundedBy(c, state.scenarioId)) return false;
        let best: MapRegion | undefined;
        let dist = Infinity;
        for (const r of byAdm.get(c.a) ?? []) {
          const d = Math.hypot(r.at![0] - c.x, r.at![1] - c.y);
          if (d < dist) {
            dist = d;
            best = r;
          }
        }
        return best && state.regions[best.id]?.owner === state.player;
      })
      .sort((a, b) => Math.max(b.p20, b.p90) - Math.max(a.p20, a.p90))
      .slice(0, MAX_CITIES);
  }, [cities, regions, state.regions, state.player, state.scenarioId]);
  const cityLabel = (key: string) => {
    const c = own.find((x) => x.n === key) ?? cities?.find((x) => x.n === key);
    return c ? cityNameIn(c, state.scenarioId, locale, state.placeNames) : key;
  };

  const ask = async (value = question) => {
    const q = value.trim();
    if (!q || busy || askDisabled) return;
    const choices = own.map((c) => ({ key: c.n, name: cityNameIn(c, state.scenarioId, "en", state.placeNames) }));
    if (await onAsk(q, choices)) setQuestion("");
  };
  const discuss = (q: string) => {
    setView("talk");
    setQuestion(q);
  };
  const voteLine = (vote: LawDraft["vote"]) =>
    vote === "decree" ? t("state.vote.decree") : house ? `${t(`state.vote.${vote}` as MessageKey)} · ${t("politics.vote", { need: needed(vote, house.seats), have: held })}` : t(`state.vote.${vote}` as MessageKey);

  const draftCard = (d: ActDraft, key: string) => {
    if (d.kind === "rename") {
      const isCountry = d.target === "country";
      const done = isCountry ? p?.name?.en === d.names.en : p?.places?.[d.target]?.en === d.names.en;
      return (
        <Card key={key} icon={isCountry ? PenLine : Building2} label={isCountry ? t("state.draft.renameCountry") : t("state.draft.renameCity", { city: cityLabel(d.target) })}>
          <div className="text-sm font-black text-ink">{text(d.names)}</div>
          <div className="mt-0.5 text-2xs font-medium text-muted">
            RU {d.names.ru} · UK {d.names.uk} · EN {d.names.en}
          </div>
          <ReactionChip r={d.reaction} />
          {done ? (
            <Done>{t("state.done.proclaimed")}</Done>
          ) : (
            <button type="button" disabled={locked} onClick={() => onProclaim(isCountry ? { name: d.names } : { place: { key: d.target, name: d.names } }, d.reaction)} className={`${ui.secondary} mt-2 px-3 py-1.5 text-2xs`}>
              <PenLine className="h-3.5 w-3.5" />
              {t("politics.proclaim")}
            </button>
          )}
        </Card>
      );
    }
    if (d.kind === "color") {
      const done = p?.color?.toLowerCase() === d.color.toLowerCase();
      return (
        <Card key={key} icon={Palette} label={t("state.draft.color")}>
          <div className="flex items-center gap-2">
            <span className="h-6 w-10 rounded-md border border-line" style={{ background: country?.color }} />
            <span className="text-xs font-black text-muted">→</span>
            <span className="h-6 w-10 rounded-md border border-line" style={{ background: d.color }} />
          </div>
          <ReactionChip r={d.reaction} />
          {done ? (
            <Done>{t("state.done.proclaimed")}</Done>
          ) : (
            <button type="button" disabled={locked} onClick={() => onProclaim({ color: d.color }, d.reaction)} className={`${ui.secondary} mt-2 px-3 py-1.5 text-2xs`}>
              <Palette className="h-3.5 w-3.5" />
              {t("state.declare")}
            </button>
          )}
        </Card>
      );
    }
    const bill = bills.find((b) => b.title === d.title && b.text === d.text);
    return (
      <Card key={key} icon={d.vote === "decree" ? FileSignature : Gavel} label={d.vote === "decree" ? t("state.draft.decree") : t("state.draft.bill")}>
        <div className="text-sm font-black leading-snug text-ink">{d.title}</div>
        {d.text && <p className="mt-0.5 text-xs font-medium leading-snug text-ink">{d.text}</p>}
        <LawChanges laws={d.laws} now={laws} />
        <div className="mt-1 text-2xs font-bold text-muted">{voteLine(d.vote)}</div>
        <ReactionChip r={d.reaction} />
        {bill ? (
          <span className={`mt-2 inline-flex rounded-md px-1.5 py-0.5 text-2xs font-black uppercase tracking-wider ${BILL_TONE[bill.status]}`}>{t(`state.bill.${bill.status}` as MessageKey)}</span>
        ) : (
          <button type="button" disabled={locked} onClick={() => onPropose(d as LawDraft)} className={`${ui.secondary} mt-2 px-3 py-1.5 text-2xs`}>
            {d.vote === "decree" ? <FileSignature className="h-3.5 w-3.5" /> : <Gavel className="h-3.5 w-3.5" />}
            {d.vote === "decree" ? t("state.sign") : t("state.submit")}
          </button>
        )}
      </Card>
    );
  };

  const withdraw = (onClick: () => void) => (
    <button type="button" disabled={locked} onClick={onClick} className="inline-flex shrink-0 items-center gap-1 text-2xs font-black uppercase tracking-wider text-muted hover:text-accent disabled:opacity-50">
      <Undo2 className="h-3 w-3" />
      {t("politics.cancel")}
    </button>
  );

  const identityHistory = [...state.chronicle]
    .reverse()
    .flatMap((e) => e.applied.filter((c) => c.kind === "identity").map((c) => ({ date: e.to, line: describeChange(c, state, t, text, (id) => id) })));

  const views: { id: View; label: string; icon: LucideIcon }[] = [
    { id: "talk", label: t("state.tab.talk"), icon: MessageCircle },
    { id: "laws", label: t("state.tab.laws"), icon: BookOpen },
    { id: "acts", label: `${t("state.tab.acts")}${pendingCount ? ` · ${pendingCount}` : ""}`, icon: ScrollText },
  ];

  if (!country) return null;
  return (
    <div className="flex flex-col gap-4">
      <section className="flex items-center gap-3 rounded-xl bg-page p-3">
        <span className="h-10 w-10 shrink-0 rounded-lg border border-line" style={{ background: p?.color ?? country.color }} />
        <div className="min-w-0">
          <div className="truncate text-sm font-black text-ink">{text(p?.name ?? country.name)}</div>
          <div className="truncate text-xs font-medium text-muted">{politics?.regime || text(country.government)}</div>
          {p && <div className="text-2xs font-bold text-amber-700">{t("politics.pending")}</div>}
        </div>
      </section>

      <div className="grid grid-cols-3 gap-1 rounded-xl bg-page p-1">
        {views.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => setView(id)} aria-pressed={view === id} className={`flex min-w-0 items-center justify-center gap-1 rounded-lg px-1.5 py-2 text-2xs font-bold transition-all ${view === id ? `${ui.segmentOn} bg-surface shadow-sm` : ui.segmentOff}`}>
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>

      {view === "talk" && (
        <>
          <p className="text-xs font-medium text-muted">{t("state.intro", { title })}</p>
          <ChatScroll watch={`${thread.length}-${Boolean(busy)}`}>
            {thread.length === 0 && (
              <div className="flex flex-wrap gap-1.5">
                {[1, 2, 3].map((n) => {
                  const suggestion = t(`state.quick.${n}` as MessageKey);
                  return (
                    <button
                      key={n}
                      type="button"
                      disabled={askDisabled || Boolean(busy)}
                      onClick={() => setQuestion(suggestion)}
                      className="rounded-lg border border-line bg-page px-2.5 py-1.5 text-left text-xs font-semibold text-ink transition-colors hover:border-accent/30 disabled:opacity-50"
                    >
                      {suggestion}
                    </button>
                  );
                })}
              </div>
            )}
            {thread.map((m, i) => (
              <div key={i} className={`max-w-[94%] rounded-2xl px-3.5 py-2.5 text-sm ${m.from === "player" ? "ml-auto rounded-br-md bg-ink text-on-ink" : "rounded-bl-md border border-line bg-surface text-ink"}`}>
                <div className={`mb-1 flex items-center gap-2 text-2xs font-black uppercase tracking-widest ${m.from === "player" ? "text-on-ink/60" : "text-muted"}`}>
                  {m.from === "player" ? t("diplomacy.you") : title}
                  <span className="font-medium normal-case tracking-normal tabular-nums">{m.date}</span>
                </div>
                <p className="whitespace-pre-wrap break-words font-medium leading-relaxed">{m.text}</p>
                {m.drafts && m.drafts.length > 0 && <div className="mt-2.5 grid gap-1.5">{m.drafts.map((d, j) => draftCard(d, `${i}-${j}`))}</div>}
              </div>
            ))}
            {busy && (
              <div className="flex items-center gap-2 text-xs font-medium text-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t("cabinet.thinking", { title })} {busy.chars > 0 && <span className="tabular-nums">· {busy.chars}</span>}
              </div>
            )}
          </ChatScroll>
          <div>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  void ask();
                }
              }}
              rows={3}
              maxLength={2000}
              disabled={askDisabled}
              placeholder={t("state.placeholder")}
              className={`${ui.input} resize-none`}
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-2xs font-medium text-muted">{t("state.note")}</span>
              <button type="button" onClick={() => void ask()} disabled={askDisabled || Boolean(busy) || !question.trim()} className={`${ui.primary} shrink-0 px-4 py-2 text-xs`}>
                <Send className="h-3.5 w-3.5" />
                {t("cabinet.ask")}
              </button>
            </div>
          </div>
        </>
      )}

      {view === "laws" && (
        <section className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted">{laws ? t("state.lawsNote") : t("politics.lawsUnknown")}</p>
          <ul className="grid gap-2">
            {LAW_IDS.map((id) => {
              const now = laws?.[id];
              const coming = open.find((b) => b.laws?.[id]);
              return (
                <li key={id} className="rounded-xl border border-line bg-surface p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-black text-ink">{t(`law.${id}` as MessageKey)}</span>
                    <span className="truncate text-xs font-bold text-muted">{now ? t(`law.${id}.${now}` as MessageKey) : "—"}</span>
                  </div>
                  <p className="mt-1 text-xs font-medium leading-snug text-muted">{t(`law.${id}.about` as MessageKey)}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {LAWS[id].map((o) => (
                      <span key={o} className={`rounded-md px-1.5 py-0.5 text-2xs font-bold ${o === now ? "bg-ink text-on-ink" : coming?.laws?.[id] === o ? "border border-dashed border-amber-500 text-amber-700" : "bg-page text-muted"}`}>
                        {t(`law.${id}.${o}` as MessageKey)}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-2xs font-bold text-amber-700">{coming ? t("state.lawPending", { title: coming.title }) : ""}</span>
                    <button
                      type="button"
                      disabled={askDisabled}
                      onClick={() => discuss(t("state.ask.law", { law: t(`law.${id}` as MessageKey).toLowerCase() }))}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-line px-2 py-1 text-2xs font-black uppercase tracking-wider text-muted transition-colors hover:border-accent/30 hover:text-ink disabled:opacity-50"
                    >
                      <MessageCircle className="h-3 w-3" />
                      {t("state.discuss")}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {view === "acts" && (
        <div className="flex flex-col gap-4">
          {pendingCount === 0 && decided.length === 0 && identityHistory.length === 0 && <p className="text-xs font-medium text-muted">{t("state.acts.empty")}</p>}

          {pendingCount > 0 && (
            <section>
              <div className={`${ui.label} mb-2`}>{t("state.acts.pending")}</div>
              <ul className="grid gap-2">
                {p?.name && (
                  <li className="rounded-xl border border-line bg-surface p-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0 text-xs font-bold text-ink">{t("change.identity.name", { to: text(p.name) })}</span>
                      {withdraw(() => onProclaim({ name: null }))}
                    </div>
                    <ReactionChip r={p.reactions?.name} />
                  </li>
                )}
                {p?.color && (
                  <li className="rounded-xl border border-line bg-surface p-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-ink">
                        <span className="h-3.5 w-3.5 rounded-sm" style={{ background: p.color }} />
                        {t("change.identity.color")}
                      </span>
                      {withdraw(() => onProclaim({ color: null }))}
                    </div>
                    <ReactionChip r={p.reactions?.color} />
                  </li>
                )}
                {Object.entries(p?.places ?? {}).map(([key, n]) => (
                  <li key={key} className="rounded-xl border border-line bg-surface p-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0 text-xs font-bold text-ink">{t("change.identity.place", { from: cityLabel(key), to: text(n) })}</span>
                      {withdraw(() => onProclaim({ place: { key, name: null } }))}
                    </div>
                    <ReactionChip r={p?.reactions?.[`place:${key}`]} />
                  </li>
                ))}
                {open.map((b) => (
                  <li key={b.id} className="rounded-xl border border-line bg-surface p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-black text-ink">{b.title}</div>
                        <div className="text-2xs font-bold text-muted">{voteLine(b.vote)}</div>
                      </div>
                      {withdraw(() => onWithdraw(b.id))}
                    </div>
                    {b.text && <p className="mt-1 text-xs font-medium leading-snug text-ink">{b.text}</p>}
                    <LawChanges laws={b.laws} now={laws} />
                    <ReactionChip r={b.reaction} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {decided.length > 0 && (
            <section>
              <div className={`${ui.label} mb-2`}>{t("state.acts.decided")}</div>
              <ul className="grid gap-2">
                {decided.map((b) => (
                  <li key={b.id} className="rounded-xl border border-line bg-surface p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-black text-ink">{b.title}</div>
                        <div className="text-2xs font-medium tabular-nums text-muted">{formatDate(b.decided ?? b.date, locale)}</div>
                      </div>
                      <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-2xs font-black uppercase tracking-wider ${BILL_TONE[b.status]}`}>{t(`state.bill.${b.status}` as MessageKey)}</span>
                    </div>
                    {b.text && <p className="mt-1 text-xs font-medium leading-snug text-ink">{b.text}</p>}
                    {b.status === "passed" && <LawChanges laws={b.laws} />}
                    {b.note && <p className="mt-1 text-2xs font-medium leading-snug text-muted">{b.note}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {identityHistory.length > 0 && (
            <section>
              <div className={`${ui.label} mb-2`}>{t("state.acts.history")}</div>
              <ul className="grid gap-1">
                {identityHistory.map((h, i) => (
                  <li key={i} className="text-xs font-medium text-ink">
                    <span className="mr-1.5 tabular-nums text-muted">{formatDate(h.date, locale)}</span>
                    {h.line}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

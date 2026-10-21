"use client";

import { Banknote, Check, ClipboardList, Crosshair, Eye, FlaskConical, Globe, Landmark, Loader2, MessageCircle, Plus, RotateCw, Send, Shield, ShieldHalf, UserRound, UserRoundPen, Users, X, type LucideIcon } from "lucide-react";
import { useState } from "react";
import ChatScroll from "@/components/ui/ChatScroll";
import { ui } from "@/components/ui/classes";
import Dictation from "@/components/voice/Dictation";
import SpeakButton from "@/components/voice/SpeakButton";
import { MAX_ORDERS } from "@/constants/app";
import { ADVISOR_TITLES, ADVISORS, MAX_DIRECTIVES, OPERATION_MINISTRIES, type AdvisorId } from "@/engine/advisors";
import { formatDate } from "@/engine/calendar";
import { ADVISOR_POST, officialAt, type Candidate } from "@/engine/government";
import { agendaOf } from "@/engine/interests";
import { reportsDue } from "@/engine/reports";
import AppointmentDialog, { Pips, Traits } from "./AppointmentDialog";
import LeaderCard from "./LeaderCard";
import Portrait from "./Portrait";
import MinistryPeople from "./MinistryPeople";
import { OFFICIAL_POSTS, type Directive, type DirectiveStatus, type GameState, type MinisterStance, type Official, type OfficialPost, type Operation } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";

export const MINISTRY_ICONS: Record<AdvisorId, LucideIcon> = { chief: UserRound, military: Shield, finance: Banknote, foreign: Globe, interior: ShieldHalf, intelligence: Eye, science: FlaskConical };

const surname = (name: string) => name.trim().split(/\s+/).at(-1) ?? name;

/** A deep colour of the person's own, behind their portrait while it loads and behind a ministry's icon. */
function avatarColor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 42% 40%)`;
}

const POST_ICONS: Record<OfficialPost, LucideIcon> = { head: Landmark, government: Landmark, chief: UserRound, military: Shield, finance: Banknote, foreign: Globe, interior: ShieldHalf, intelligence: Eye, science: FlaskConical, bank: Banknote };

/** The minister a post speaks through in the cabinet, if any. */
const ADVISOR_OF: Partial<Record<OfficialPost, AdvisorId>> = Object.fromEntries(ADVISORS.map((a) => [ADVISOR_POST[a], a]));

interface CabinetPanelProps {
  state: GameState;
  busy: { chars: number; advisor: AdvisorId } | null;
  /** Any request under way: the setup of the government, candidates, a minister's answer. */
  anyBusy: { kind: string; chars: number; advisor?: AdvisorId; deputy?: string } | null;
  /** The ministry's deputies (MinistryPeople): naming them, a word in private, the plots' new state. */
  onSetupDeputies: (advisor: AdvisorId) => void;
  onAskDeputy: (advisor: AdvisorId, deputy: string, question: string) => Promise<boolean>;
  onChange: (next: GameState) => void;
  disabled: boolean;
  onAsk: (advisor: AdvisorId, question: string, context?: string) => Promise<boolean>;
  onAddOrder: (order: string) => void;
  onDirectives: (directives: Directive[]) => void;
  /** Ask the game master who the people of the government are. */
  onSetup: () => void;
  onFind: (post: OfficialPost, wishes: string) => Promise<Candidate[] | null>;
  onAppoint: (post: OfficialPost, person: Omit<Official, "post" | "since" | "title">, note: string) => void;
  /** Open on this minister with the question ready to send (from a protest abroad, say). */
  prefill?: { advisor: AdvisorId; question: string };
  /** The ministers' reports on the last turn still being written, or failed. */
  reporting: Partial<Record<AdvisorId, ReportStatus>>;
  /** Ask a minister again for a report on the last turn that has not come; missing when it cannot be asked now. */
  onRequestReport?: (ministry: AdvisorId) => void;
}

/** A minister's report on the last turn while it is being written, or after it failed to come. */
export interface ReportStatus {
  turn: number;
  status: "writing" | "failed";
  chars: number;
}

export const STANCE_TONE: Record<MinisterStance, string> = {
  loyal: "border border-line text-muted",
  uneasy: "bg-amber-50 text-amber-700",
  opposed: "bg-red-50 text-red-700",
  resigning: "bg-red-50 text-red-700 ring-1 ring-red-300",
};

export function StanceChip({ stance }: { stance: MinisterStance }) {
  const { t } = useI18n();
  return <span className={`rounded-md px-1.5 py-0.5 text-2xs font-black uppercase tracking-wider ${STANCE_TONE[stance]}`}>{t(`cabinet.stance.${stance}` as MessageKey)}</span>;
}

/** What became of each directive, as a report or a brief gives it. */
export function DirectiveList({ directives }: { directives: DirectiveStatus[] }) {
  const { t } = useI18n();
  if (!directives.length) return null;
  return (
    <ul className="mt-2 grid gap-1">
      {directives.map((d) => (
        <li key={d.id} className="text-xs font-medium text-muted">
          <span className={`mr-1.5 rounded px-1.5 py-0.5 text-2xs font-black uppercase tracking-wider ${d.status === "done" ? "bg-emerald-50 text-emerald-700" : d.status === "failed" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
            {t(`cabinet.status.${d.status}` as MessageKey)}
          </span>
          {d.text ? `${d.text} — ` : ""}
          {d.note}
        </li>
      ))}
    </ul>
  );
}

/** Orders a minister suggests, each one click from the turn's orders. */
function OrderSuggestions({ orders, draft, full, disabled, onAddOrder }: { orders: string[]; draft: string[]; full: boolean; disabled: boolean; onAddOrder: (order: string) => void }) {
  const { t } = useI18n();
  return (
    <div className="mt-2.5 grid gap-1.5">
      <div className="text-2xs font-black uppercase tracking-widest text-muted">{t("cabinet.suggested")}</div>
      {orders.map((order) => {
        const added = draft.includes(order);
        return (
          <div key={order} className="flex items-start gap-2 rounded-lg bg-page px-2.5 py-1.5">
            <span className="min-w-0 flex-1 text-xs font-semibold text-ink">{order}</span>
            <button
              type="button"
              disabled={added || full || disabled}
              onClick={() => onAddOrder(order)}
              title={added ? t("cabinet.added") : t("cabinet.addOrder")}
              aria-label={added ? t("cabinet.added") : t("cabinet.addOrder")}
              className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-line bg-surface text-muted transition-colors hover:text-accent disabled:opacity-60"
            >
              {added ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Plus className="h-3.5 w-3.5" />}
            </button>
          </div>
        );
      })}
    </div>
  );
}

type View = "talk" | "tasks" | "people";

const SECRECY_TONE: Record<Operation["secrecy"], string> = { open: "bg-page text-muted", covert: "bg-amber-50 text-amber-700", deniable: "bg-red-50 text-red-700" };

/**
 * The cabinet: five ministries. Talk to a minister (answers in character,
 * suggested orders one click away) and give the ministry standing
 * directives. The general staff, the interior ministry and intelligence plan
 * special operations in the conversation — a coup or protests abroad,
 * sabotage, a raid — and the operation they draft starts once approved.
 * After every turn each minister with something to report writes it in
 * their own window, as it comes; each shows their interests and how they
 * took the last turn.
 */
export default function CabinetPanel({ state, busy, anyBusy, disabled, onAsk, onAddOrder, onDirectives, onSetup, onFind, onAppoint, prefill, reporting, onRequestReport, onSetupDeputies, onAskDeputy, onChange }: CabinetPanelProps) {
  const { t, text, locale } = useI18n();
  const [section, setSection] = useState<"ministers" | "people">("ministers");
  const [replacing, setReplacing] = useState<OfficialPost | null>(null);
  const [advisor, setAdvisor] = useState<AdvisorId>(prefill?.advisor ?? "chief");
  const [view, setView] = useState<View>("talk");
  const [question, setQuestion] = useState(prefill?.question ?? "");
  const [task, setTask] = useState("");
  const thread = state.advice?.[advisor] ?? [];
  const personOf = (id: AdvisorId) => officialAt(state, ADVISOR_POST[id]);
  const person = personOf(advisor);
  const title = person?.name ?? text(ADVISOR_TITLES[advisor]);
  const full = state.draft.length >= MAX_ORDERS;
  const directives = state.directives ?? [];
  const mine = directives.filter((d) => d.ministry === advisor);
  const directivesFull = directives.length >= MAX_DIRECTIVES;
  const report = [...state.chronicle].reverse().map((e) => ({ date: e.to, report: (e.reports ?? []).find((r) => r.ministry === advisor) })).find((x) => x.report);
  // The last turn's report this minister still owes, and the brief it will be written from.
  const last = state.chronicle.at(-1);
  const owed = last && reportsDue(last).includes(advisor) ? last.briefs?.find((b) => b.ministry === advisor) : undefined;
  const writing = reporting[advisor]?.status === "writing" ? reporting[advisor] : undefined;
  const canPlan = OPERATION_MINISTRIES.includes(advisor);

  const ask = async (value = question) => {
    const q = value.trim();
    if (!q || busy) return;
    if (await onAsk(advisor, q)) setQuestion("");
  };
  // The first id of this turn that no standing directive has.
  const nextId = () => {
    let n = directives.length + 1;
    while (directives.some((d) => d.id === `d${state.turn}-${n}`)) n++;
    return `d${state.turn}-${n}`;
  };
  const addDirective = (d: Omit<Directive, "id" | "since" | "ministry">) => onDirectives([...directives, { ...d, id: nextId(), ministry: advisor, since: state.date }]);

  const views: { id: View; label: string; icon: LucideIcon }[] = [
    { id: "talk", label: t("cabinet.tab.talk"), icon: MessageCircle },
    { id: "tasks", label: `${t("cabinet.tab.tasks")}${mine.length ? ` · ${mine.length}` : ""}`, icon: ClipboardList },
    { id: "people", label: t("deputies.tab"), icon: Users },
  ];
  const current = view;
  const approved = (o: Operation) => directives.some((d) => d.operation?.name === o.name && d.ministry === advisor);

  const officials = state.officials ?? [];
  const setupBusy = anyBusy?.kind === "politics";

  const people = (
    <div className="flex flex-col gap-3">
      {officials.length === 0 ? (
        <>
          <p className="text-xs font-medium text-muted">{t("gov.intro")}</p>
          <button type="button" onClick={onSetup} disabled={disabled || Boolean(anyBusy)} className={`${ui.primary} px-4 py-3 text-xs`}>
            {setupBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
            {setupBusy ? t("gov.loading") : t("gov.setup")}
            {setupBusy && anyBusy && anyBusy.chars > 0 && <span className="tabular-nums">· {anyBusy.chars}</span>}
          </button>
        </>
      ) : (
        <ul className="grid gap-2">
          {OFFICIAL_POSTS.map((post) => {
            const o = officials.find((x) => x.post === post);
            const Icon = POST_ICONS[post];
            const minister = ADVISOR_OF[post];
            if (!o && (post === "head" || post === "government")) return null;
            return (
              <li key={post} className="grid gap-1.5 rounded-xl border border-line bg-surface p-3">
                <div className="flex items-start gap-2">
                  {o ? <Portrait portrait={o.portrait} gender={o.gender} name={o.name} size="sm" /> : <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted" />}
                  <div className="min-w-0 flex-1">
                    <div className="text-2xs font-black uppercase tracking-wider text-muted">{o?.title ?? t(`post.${post}` as MessageKey)}</div>
                    <div className="text-sm font-black text-ink">{o?.name ?? t("gov.vacant")}</div>
                    {o?.bio && <div className="text-xs font-medium text-muted">{o.bio}</div>}
                  </div>
                </div>
                {o && (
                  <>
                    <Traits traits={o.traits} />
                    <div className="flex flex-wrap items-center gap-3">
                      <Pips value={o.competence} label={t("gov.competence")} />
                      <Pips value={o.loyalty} label={t("gov.loyalty")} />
                      {o.faction && <span className="text-2xs font-bold text-muted">{o.faction}</span>}
                      <span className="text-2xs font-medium tabular-nums text-muted">{t("gov.since", { date: formatDate(o.since, locale) })}</span>
                      {o.mood && <StanceChip stance={o.mood.stance} />}
                    </div>
                    {o.interests && (
                      <div className="text-2xs font-medium text-muted">
                        {t("cabinet.interests")}: {agendaOf(o).map((a) => text(a.label)).join(" · ")}
                      </div>
                    )}
                  </>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {minister && o && (
                    <button
                      type="button"
                      onClick={() => {
                        setAdvisor(minister);
                        setView("talk");
                        setSection("ministers");
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-2xs font-black uppercase tracking-wider text-muted transition-colors hover:border-accent/30 hover:text-ink"
                    >
                      <MessageCircle className="h-3 w-3" />
                      {t("gov.talk")}
                    </button>
                  )}
                  {post !== "head" && (
                    <button
                      type="button"
                      onClick={() => setReplacing(post)}
                      className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-2xs font-black uppercase tracking-wider text-muted transition-colors hover:border-accent/30 hover:text-ink"
                    >
                      <UserRoundPen className="h-3 w-3" />
                      {o ? t("gov.replace") : t("gov.appoint")}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-page p-1">
        {(["ministers", "people"] as const).map((id) => (
          <button key={id} type="button" onClick={() => setSection(id)} className={`rounded-lg px-2 py-2 text-xs font-bold transition-all ${section === id ? `${ui.segmentOn} bg-surface shadow-sm` : ui.segmentOff}`}>
            {t(`cabinet.section.${id}` as MessageKey)}
          </button>
        ))}
      </div>

      <AppointmentDialog state={state} post={replacing} busy={anyBusy} disabled={disabled} onClose={() => setReplacing(null)} onFind={onFind} onAppoint={onAppoint} onAsk={onAsk} />

      {section === "people" ? (
        people
      ) : (
      <>
      <LeaderCard state={state} />
      <p className="text-xs font-medium text-muted">{t("cabinet.intro")}</p>
      {officials.length === 0 && (
        <button type="button" onClick={() => setSection("people")} className="text-left text-xs font-bold text-accent hover:underline">
          {t("gov.nameThem")}
        </button>
      )}

      <div className="grid grid-cols-7 gap-1">
        {ADVISORS.map((id) => {
          const Icon = MINISTRY_ICONS[id];
          const on = id === advisor;
          const p = personOf(id);
          const count = directives.filter((d) => d.ministry === id).length;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setAdvisor(id)}
              aria-pressed={on}
              title={p ? `${p.name} · ${p.title}` : text(ADVISOR_TITLES[id])}
              className="group flex min-w-0 flex-col items-center gap-1"
            >
              <span
                className={`relative grid h-10 w-10 place-items-center rounded-full text-sm font-black text-white transition-all ${on ? "ring-2 ring-ink ring-offset-2 ring-offset-page" : "opacity-75 group-hover:opacity-100"}`}
                style={{ background: avatarColor(p?.name ?? id) }}
              >
                {p ? <Portrait portrait={p.portrait} gender={p.gender} name={p.name} size="avatar" /> : <Icon className="h-4.5 w-4.5" />}
                <span className="absolute -bottom-1 -right-1 grid h-4.5 w-4.5 place-items-center rounded-full border border-line bg-surface text-muted">
                  <Icon className="h-2.5 w-2.5" />
                </span>
                {count > 0 && <span className="absolute -top-1 -right-1 min-w-4 rounded-full bg-accent px-1 text-center text-[9px] font-black leading-4 text-on-ink">{count}</span>}
                {reporting[id]?.status === "writing" && <span className="absolute -top-1 -left-1 h-3 w-3 animate-pulse rounded-full border-2 border-page bg-accent" aria-hidden />}
              </span>
              <span className={`w-full truncate text-center text-[10px] font-bold ${on ? "text-ink" : "text-muted"}`}>{p ? surname(p.name) : t(`post.${ADVISOR_POST[id]}` as MessageKey)}</span>
            </button>
          );
        })}
      </div>

      <div className="rounded-xl bg-page p-3">
        <div className="text-sm font-black text-ink">{person?.name ?? text(ADVISOR_TITLES[advisor])}</div>
        {person && <div className="text-xs font-medium text-muted">{person.title}</div>}
        {person && person.traits.length > 0 && (
          <div className="mt-1.5">
            <Traits traits={person.traits} />
          </div>
        )}
        {person && (
          <div className="mt-1.5 flex flex-wrap gap-3">
            <Pips value={person.competence} label={t("gov.competence")} />
            <Pips value={person.loyalty} label={t("gov.loyalty")} />
            {person.faction && <span className="text-2xs font-bold text-muted">{person.faction}</span>}
          </div>
        )}
        {person?.interests && (
          <div className="mt-2 grid gap-1.5 border-t border-divider pt-2">
            <div className="flex flex-wrap items-center gap-1">
              <span className="mr-0.5 text-2xs font-black uppercase tracking-wider text-muted">{t("cabinet.interests")}</span>
              {agendaOf(person).map((a) => (
                <span key={a.en} className="rounded-md bg-surface px-1.5 py-0.5 text-2xs font-bold text-ink">
                  {text(a.label)}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Pips value={person.interests.ambition} label={t("cabinet.ambition")} />
              {person.interests.party && <span className="text-2xs font-bold text-muted">{t("cabinet.party", { party: person.interests.party })}</span>}
              {person.mood && <StanceChip stance={person.mood.stance} />}
            </div>
          </div>
        )}
      </div>

      {owed ? (
        <section className="rounded-2xl bg-page p-3.5">
          <div className={`${ui.label} mb-1.5`}>{t("cabinet.report", { date: formatDate(last!.to, locale) })}</div>
          {writing ? (
            <p className="flex items-center gap-2 text-xs font-medium text-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t("cabinet.report.writing", { title })}
              {writing.chars > 0 && <span className="tabular-nums">· {writing.chars}</span>}
            </p>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted">{t("cabinet.report.missing")}</p>
              <button type="button" disabled={!onRequestReport} onClick={() => onRequestReport?.(advisor)} className={`${ui.secondary} shrink-0 px-3 py-1.5 text-2xs`}>
                <RotateCw className="h-3.5 w-3.5" />
                {t("cabinet.report.request")}
              </button>
            </div>
          )}
          <DirectiveList directives={owed.directives} />
        </section>
      ) : (
        report?.report && (
          <section className="rounded-2xl bg-page p-3.5">
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <span className={ui.label}>{t("cabinet.report", { date: formatDate(report.date, locale) })}</span>
              <span className="flex items-center gap-2">
                {report.report.stance && <StanceChip stance={report.report.stance} />}
                <SpeakButton id={`cabinet-report-${advisor}-${report.date}`} text={report.report.text} className="-my-1" />
              </span>
            </div>
            <p className="text-sm font-medium leading-relaxed text-ink">{report.report.text}</p>
            <DirectiveList directives={report.report.directives} />
            {report.report.orders && report.report.orders.length > 0 && <OrderSuggestions orders={report.report.orders} draft={state.draft} full={full} disabled={disabled} onAddOrder={onAddOrder} />}
          </section>
        )
      )}

      <div className="grid grid-cols-3 gap-1 rounded-xl bg-page p-1">
        {views.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => setView(id)} className={`flex min-w-0 items-center justify-center gap-1 rounded-lg px-1.5 py-2 text-2xs font-bold transition-all ${current === id ? `${ui.segmentOn} bg-surface shadow-sm` : ui.segmentOff}`}>
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>

      {current === "talk" && (
        <>
          <ChatScroll watch={`${advisor}-${thread.length}-${busy?.advisor === advisor}`}>
            {thread.length === 0 && (
              <div className="flex flex-wrap gap-1.5">
                {[1, 2, 3].map((n) => {
                  const suggestion = t(`cabinet.quick.${advisor}.${n}` as MessageKey);
                  return (
                    <button
                      key={n}
                      type="button"
                      disabled={disabled || Boolean(busy)}
                      onClick={() => void ask(suggestion)}
                      className="rounded-lg border border-line bg-page px-2.5 py-1.5 text-left text-xs font-semibold text-ink transition-colors hover:border-accent/30 disabled:opacity-50"
                    >
                      {suggestion}
                    </button>
                  );
                })}
              </div>
            )}
            {thread.map((m, i) => (
              <div
                key={i}
                className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm ${
                  m.from === "player" ? "ml-auto rounded-br-md bg-ink text-on-ink" : "rounded-bl-md border border-line bg-surface text-ink"
                }`}
              >
                <div className={`mb-1 flex items-center gap-2 text-2xs font-black uppercase tracking-widest ${m.from === "player" ? "text-on-ink/60" : "text-muted"}`}>
                  {m.from === "player" ? t("diplomacy.you") : title}
                  <span className="font-medium normal-case tracking-normal tabular-nums">{m.date}</span>
                  {m.from !== "player" && <SpeakButton id={`cabinet-${advisor}-${i}`} text={m.text} className="-my-1 ml-auto" />}
                </div>
                <p className="whitespace-pre-wrap break-words font-medium leading-relaxed">{m.text}</p>
                {m.orders && m.orders.length > 0 && <OrderSuggestions orders={m.orders} draft={state.draft} full={full} disabled={disabled} onAddOrder={onAddOrder} />}
                {m.operation && (
                  <div className="mt-2.5 rounded-xl border border-line bg-page p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-2xs font-black uppercase tracking-widest text-muted">
                          <Crosshair className="h-3 w-3" />
                          {t("op.proposed")}
                        </div>
                        <div className="mt-0.5 text-sm font-black text-ink">«{m.operation.name}»</div>
                      </div>
                      <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-2xs font-black uppercase tracking-wider ${SECRECY_TONE[m.operation.secrecy]}`}>{t(`op.secrecy.${m.operation.secrecy}` as MessageKey)}</span>
                    </div>
                    <dl className="mt-1.5 grid gap-1 text-xs">
                      {(["target", "goal", "means", "timing"] as const).map((k) =>
                        m.operation![k] ? (
                          <div key={k}>
                            <dt className="inline font-black text-muted">{t(`op.${k}` as MessageKey)}: </dt>
                            <dd className="inline font-medium text-ink">{m.operation![k]}</dd>
                          </div>
                        ) : null,
                      )}
                    </dl>
                    {approved(m.operation) ? (
                      <span className="mt-2 inline-flex items-center gap-1 text-2xs font-black uppercase tracking-wider text-emerald-700">
                        <Check className="h-3 w-3" />
                        {t("op.approved")}
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={disabled || directivesFull}
                        onClick={() => addDirective({ text: t("op.text", { name: m.operation!.name, goal: m.operation!.goal }), operation: m.operation })}
                        className={`${ui.primary} mt-2 px-3 py-2 text-2xs`}
                      >
                        <Crosshair className="h-3.5 w-3.5" />
                        {t("op.approve")}
                      </button>
                    )}
                    {directivesFull && !approved(m.operation) && <p className="mt-1 text-2xs font-medium text-muted">{t("cabinet.tasks.limit", { n: MAX_DIRECTIVES })}</p>}
                  </div>
                )}
              </div>
            ))}
            {busy?.advisor === advisor && (
              <div className="flex items-center gap-2 text-xs font-medium text-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t("cabinet.thinking", { title })} {busy.chars > 0 && <span className="tabular-nums">· {busy.chars}</span>}
              </div>
            )}
          </ChatScroll>
          <div>
            <Dictation id={`cabinet-${advisor}`} set={setQuestion} max={2000} disabled={disabled || Boolean(busy)}>
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
                disabled={disabled || Boolean(busy)}
                placeholder={t("cabinet.placeholder", { title })}
                className={`${ui.input} resize-none`}
              />
            </Dictation>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-2xs font-medium text-muted">{canPlan ? t("cabinet.noteOps") : t("cabinet.note")}</span>
              <button type="button" onClick={() => void ask()} disabled={disabled || Boolean(busy) || !question.trim()} className={`${ui.primary} shrink-0 px-4 py-2 text-xs`}>
                <Send className="h-3.5 w-3.5" />
                {t("cabinet.ask")}
              </button>
            </div>
          </div>
        </>
      )}

      {current === "people" && (
        <MinistryPeople
          key={advisor}
          state={state}
          advisor={advisor}
          disabled={disabled}
          anyBusy={anyBusy}
          onSetup={onSetupDeputies}
          onAsk={onAskDeputy}
          onChange={onChange}
          renderOrders={(orders) => <OrderSuggestions orders={orders} draft={state.draft} full={full} disabled={disabled} onAddOrder={onAddOrder} />}
        />
      )}

      {current === "tasks" && (
        <>
          {mine.length === 0 ? (
            <p className="text-xs font-medium text-muted">{t("cabinet.tasks.empty")}</p>
          ) : (
            <ul className="grid gap-1.5">
              {mine.map((d) => (
                <li key={d.id} className="flex items-start gap-2 rounded-xl border border-line bg-surface px-3 py-2">
                  {d.operation ? <Crosshair className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" /> : <ClipboardList className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-ink">{d.text}</p>
                    {d.operation && (
                      <p className="mt-0.5 text-2xs font-medium text-muted">
                        {[d.operation.target, d.operation.means, d.operation.timing, t(`op.secrecy.${d.operation.secrecy}` as MessageKey)].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    <p className="mt-0.5 text-2xs font-medium tabular-nums text-muted">{formatDate(d.since, locale)}</p>
                  </div>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onDirectives(directives.filter((x) => x.id !== d.id))}
                    title={t("cabinet.tasks.withdraw")}
                    aria-label={t("cabinet.tasks.withdraw")}
                    className="-m-1 rounded-lg p-1 text-muted hover:bg-red-50 hover:text-red-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div>
            <Dictation id={`task-${advisor}`} set={setTask} max={500} disabled={disabled || directivesFull}>
              <textarea value={task} onChange={(e) => setTask(e.target.value)} rows={2} maxLength={500} disabled={disabled || directivesFull} placeholder={t("cabinet.tasks.placeholder")} className={`${ui.input} resize-none`} />
            </Dictation>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-2xs font-medium text-muted">{directivesFull ? t("cabinet.tasks.limit", { n: MAX_DIRECTIVES }) : t("cabinet.tasks.note")}</span>
              <button
                type="button"
                disabled={disabled || directivesFull || !task.trim()}
                onClick={() => {
                  addDirective({ text: task.trim() });
                  setTask("");
                }}
                className={`${ui.secondary} shrink-0 px-3 py-2 text-xs`}
              >
                <Plus className="h-4 w-4" />
                {t("cabinet.tasks.add")}
              </button>
            </div>
          </div>
        </>
      )}

      </>
      )}
    </div>
  );
}

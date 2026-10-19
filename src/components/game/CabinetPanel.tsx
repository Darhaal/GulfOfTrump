"use client";

import { Banknote, Check, ClipboardList, Crosshair, Eye, Globe, Landmark, Loader2, MessageCircle, Plus, Send, Shield, ShieldHalf, UserRound, UserRoundPen, Users, X, type LucideIcon } from "lucide-react";
import { useState } from "react";
import ChatScroll from "@/components/ui/ChatScroll";
import { ui } from "@/components/ui/classes";
import { MAX_ORDERS } from "@/constants/app";
import { ADVISOR_TITLES, ADVISORS, MAX_DIRECTIVES, OPERATION_MINISTRIES, type AdvisorId } from "@/engine/advisors";
import { formatDate } from "@/engine/calendar";
import { ADVISOR_POST, officialAt, type Candidate } from "@/engine/government";
import AppointmentDialog, { Pips, Traits } from "./AppointmentDialog";
import { OFFICIAL_POSTS, type Directive, type GameState, type Official, type OfficialPost, type Operation } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";

export const MINISTRY_ICONS: Record<AdvisorId, LucideIcon> = { chief: UserRound, military: Shield, finance: Banknote, foreign: Globe, interior: ShieldHalf, intelligence: Eye };

/** "Andriy Yermak" → "AY"; "Kim Jong Un" → "KJ". */
const initials = (name: string) =>
  name
    .replace(/\[[^\]]*\]\s*/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
const surname = (name: string) => name.trim().split(/\s+/).at(-1) ?? name;

/** A deep colour of the person's own, dark enough for white initials in both themes. */
function avatarColor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 42% 40%)`;
}

const POST_ICONS: Record<OfficialPost, LucideIcon> = { head: Landmark, government: Landmark, chief: UserRound, military: Shield, finance: Banknote, foreign: Globe, interior: ShieldHalf, intelligence: Eye, bank: Banknote };

/** The minister a post speaks through in the cabinet, if any. */
const ADVISOR_OF: Partial<Record<OfficialPost, AdvisorId>> = Object.fromEntries(ADVISORS.map((a) => [ADVISOR_POST[a], a]));

interface CabinetPanelProps {
  state: GameState;
  busy: { chars: number; advisor: AdvisorId } | null;
  /** Any request under way: the setup of the government, candidates, a minister's answer. */
  anyBusy: { kind: string; chars: number; advisor?: AdvisorId } | null;
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
}

type View = "talk" | "tasks";

const SECRECY_TONE: Record<Operation["secrecy"], string> = { open: "bg-page text-muted", covert: "bg-amber-50 text-amber-700", deniable: "bg-red-50 text-red-700" };

/**
 * The cabinet: five ministries. Talk to a minister (answers in character,
 * suggested orders one click away) and give the ministry standing
 * directives. The general staff, the interior ministry and intelligence plan
 * special operations in the conversation — a coup or protests abroad,
 * sabotage, a raid — and the operation they draft starts once approved.
 * Every turn each ministry reports on its directives; the last report is
 * shown here.
 */
export default function CabinetPanel({ state, busy, anyBusy, disabled, onAsk, onAddOrder, onDirectives, onSetup, onFind, onAppoint, prefill }: CabinetPanelProps) {
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
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
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
                    </div>
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
      <p className="text-xs font-medium text-muted">{t("cabinet.intro")}</p>
      {officials.length === 0 && (
        <button type="button" onClick={() => setSection("people")} className="text-left text-xs font-bold text-accent hover:underline">
          {t("gov.nameThem")}
        </button>
      )}

      <div className="grid grid-cols-6 gap-1">
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
                className={`relative grid h-11 w-11 place-items-center rounded-full text-sm font-black text-white transition-all ${on ? "ring-2 ring-ink ring-offset-2 ring-offset-page" : "opacity-75 group-hover:opacity-100"}`}
                style={{ background: avatarColor(p?.name ?? id) }}
              >
                {p ? initials(p.name) : <Icon className="h-4.5 w-4.5" />}
                <span className="absolute -bottom-1 -right-1 grid h-4.5 w-4.5 place-items-center rounded-full border border-line bg-surface text-muted">
                  <Icon className="h-2.5 w-2.5" />
                </span>
                {count > 0 && <span className="absolute -top-1 -right-1 min-w-4 rounded-full bg-accent px-1 text-center text-[9px] font-black leading-4 text-white">{count}</span>}
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
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-xl bg-page p-1">
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
                </div>
                <p className="whitespace-pre-wrap break-words font-medium leading-relaxed">{m.text}</p>
                {m.orders && m.orders.length > 0 && (
                  <div className="mt-2.5 grid gap-1.5">
                    <div className="text-2xs font-black uppercase tracking-widest text-muted">{t("cabinet.suggested")}</div>
                    {m.orders.map((order) => {
                      const added = state.draft.includes(order);
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
                )}
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
            <textarea value={task} onChange={(e) => setTask(e.target.value)} rows={2} maxLength={500} disabled={disabled || directivesFull} placeholder={t("cabinet.tasks.placeholder")} className={`${ui.input} resize-none`} />
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

      {report?.report && (
        <section className="rounded-2xl bg-page p-3.5">
          <div className={`${ui.label} mb-1.5`}>{t("cabinet.report", { date: formatDate(report.date, locale) })}</div>
          <p className="text-sm font-medium leading-relaxed text-ink">{report.report.text}</p>
          {report.report.directives.length > 0 && (
            <ul className="mt-2 grid gap-1">
              {report.report.directives.map((d) => (
                <li key={d.id} className="text-xs font-medium text-muted">
                  <span className={`mr-1.5 rounded px-1.5 py-0.5 text-2xs font-black uppercase tracking-wider ${d.status === "done" ? "bg-emerald-50 text-emerald-700" : d.status === "failed" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
                    {t(`cabinet.status.${d.status}` as MessageKey)}
                  </span>
                  {d.text ? `${d.text} — ` : ""}
                  {d.note}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      </>
      )}
    </div>
  );
}

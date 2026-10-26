"use client";

import { Loader2, MessageCircle, Minus, Plus, Sparkles, UserPlus } from "lucide-react";
import { useState } from "react";
import ChatScroll from "@/components/ui/ChatScroll";
import Dialog from "@/components/ui/Dialog";
import { ui } from "@/components/ui/classes";
import Dictation from "@/components/voice/Dictation";
import { ADVISOR_TITLES, ADVISORS, type AdvisorId } from "@/engine/advisors";
import { ADVISOR_POST, officialAt, type Candidate } from "@/engine/government";
import type { GameState, Official, OfficialPost } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";

/** Competence or loyalty, 1–5, as filled pips. */
export function Pips({ value, label }: { value: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-2xs font-bold text-muted" title={`${label}: ${value}/5`}>
      {label}
      <span className="inline-flex gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className={`h-1.5 w-1.5 rounded-full ${n <= value ? "bg-ink" : "bg-divider"}`} />
        ))}
      </span>
    </span>
  );
}

/** A person's traits as chips; `onPage` for chips on a card that is itself the page's colour. */
export function Traits({ traits, onPage }: { traits: string[]; onPage?: boolean }) {
  if (!traits.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {traits.map((t) => (
        <span key={t} className={`rounded-md px-1.5 py-0.5 text-2xs font-bold text-ink ${onPage ? "sheet" : "bg-page"}`}>
          {t}
        </span>
      ))}
    </div>
  );
}

interface AppointmentDialogProps {
  state: GameState;
  post: OfficialPost | null;
  busy: { kind: string; chars: number; advisor?: AdvisorId } | null;
  disabled: boolean;
  onClose: () => void;
  onFind: (post: OfficialPost, wishes: string) => Promise<Candidate[] | null>;
  onAppoint: (post: OfficialPost, person: Omit<Official, "post" | "since" | "title">, note: string) => void;
  onAsk: (advisor: AdvisorId, question: string, context?: string) => Promise<boolean>;
}

/**
 * Filling a post: who holds it now, candidates the game master proposes with
 * what speaks for and against each, anyone the government names itself, and
 * a word with a minister about it before deciding. The appointment takes
 * effect at once; the next turn shows what it brings.
 */
export default function AppointmentDialog({ state, post, busy, disabled, onClose, onFind, onAppoint, onAsk }: AppointmentDialogProps) {
  const { t, text } = useI18n();
  const [wishes, setWishes] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [custom, setCustom] = useState("");
  const [note, setNote] = useState("");
  const [question, setQuestion] = useState("");
  const [chosen, setAdvisor] = useState<AdvisorId>("chief");
  // Never the person whose post is being filled: the chief of staff, else the interior minister.
  const advisor: AdvisorId = ADVISOR_POST[chosen] !== post ? chosen : post === "chief" ? "interior" : "chief";
  const current = post ? officialAt(state, post) : undefined;
  const title = current?.title ?? (post ? t(`post.${post}` as MessageKey) : "");
  const thread = (state.advice?.[advisor] ?? []).slice(-6);
  const nameOf = (a: AdvisorId) => officialAt(state, ADVISOR_POST[a])?.name ?? text(ADVISOR_TITLES[a]);
  const finding = busy?.kind === "candidates";
  const asking = busy?.kind === "advice" && busy.advisor === advisor;

  const close = () => {
    setCandidates([]);
    setWishes("");
    setCustom("");
    setNote("");
    setQuestion("");
    onClose();
  };
  const pick = (person: Omit<Official, "post" | "since" | "title">) => {
    if (!post) return;
    onAppoint(post, person, note.trim());
    close();
  };
  const context = () =>
    [
      `The government is choosing who will be ${title}.`,
      current ? `Now: ${current.name} (${current.traits.join(", ")}; competence ${current.competence}/5, loyalty ${current.loyalty}/5).` : "The post is vacant.",
      ...candidates.map((c) => `Candidate: ${c.name} — ${c.background}; for: ${c.pros.join("; ")}; against: ${c.cons.join("; ")}.`),
      custom.trim() ? `The government is also thinking of ${custom.trim()}.` : "",
    ]
      .filter(Boolean)
      .join("\n");

  return (
    <Dialog open={post !== null} onClose={close} wide title={t("appoint.title", { title })}>
      {post && (
        <div className="flex flex-col gap-4">
          <section className="rounded-xl bg-page p-3">
            <div className={ui.label}>{t("appoint.current")}</div>
            {current ? (
              <div className="mt-1 grid gap-1.5">
                <div className="text-sm font-black text-ink">{current.name}</div>
                <Traits traits={current.traits} />
                <div className="flex flex-wrap gap-3">
                  <Pips value={current.competence} label={t("gov.competence")} />
                  <Pips value={current.loyalty} label={t("gov.loyalty")} />
                  {current.faction && <span className="text-2xs font-bold text-muted">{current.faction}</span>}
                </div>
              </div>
            ) : (
              <div className="mt-1 text-sm font-medium text-muted">{t("gov.vacant")}</div>
            )}
          </section>

          <section className="grid gap-2">
            <Dictation id="appoint-wishes" set={setWishes}>
              <textarea value={wishes} onChange={(e) => setWishes(e.target.value)} rows={2} placeholder={t("appoint.wishes")} className={`${ui.input} resize-none py-2`} />
            </Dictation>
            <button
              type="button"
              disabled={disabled || Boolean(busy)}
              onClick={async () => {
                const found = await onFind(post, wishes.trim());
                if (found) setCandidates(found);
              }}
              className={`${ui.secondary} px-3 py-2.5 text-xs`}
            >
              {finding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {finding ? t("appoint.finding") : candidates.length ? t("appoint.more") : t("appoint.find")}
              {finding && busy && busy.chars > 0 && <span className="tabular-nums">· {busy.chars}</span>}
            </button>
          </section>

          {candidates.length > 0 && (
            <section className="grid gap-2">
              <div className={ui.label}>{t("appoint.candidates")}</div>
              {candidates.map((c) => (
                <article key={c.name} className="grid gap-1.5 rounded-xl border border-line sheet p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-black text-ink">{c.name}</div>
                      {c.background && <div className="text-xs font-medium text-muted">{c.background}</div>}
                    </div>
                    <button
                      type="button"
                      onClick={() => pick({ name: c.name, traits: c.traits, manner: c.manner, competence: c.competence, loyalty: c.loyalty, ...(c.faction ? { faction: c.faction } : {}), ...(c.background ? { bio: c.background } : {}) })}
                      className={`${ui.primary} shrink-0 px-3 py-1.5 text-2xs`}
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      {t("appoint.choose")}
                    </button>
                  </div>
                  <Traits traits={c.traits} />
                  <div className="flex flex-wrap gap-3">
                    <Pips value={Math.round(c.competence)} label={t("gov.competence")} />
                    <Pips value={Math.round(c.loyalty)} label={t("gov.loyalty")} />
                    {c.faction && <span className="text-2xs font-bold text-muted">{c.faction}</span>}
                  </div>
                  <ul className="grid gap-0.5 text-xs font-medium">
                    {c.pros.map((p) => (
                      <li key={p} className="flex gap-1.5 text-emerald-700">
                        <Plus className="mt-0.5 h-3 w-3 shrink-0" />
                        {p}
                      </li>
                    ))}
                    {c.cons.map((p) => (
                      <li key={p} className="flex gap-1.5 text-red-600">
                        <Minus className="mt-0.5 h-3 w-3 shrink-0" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </section>
          )}

          <section className="grid gap-2 rounded-xl border border-dashed border-line p-3">
            <div className={ui.label}>{t("appoint.custom")}</div>
            <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder={t("appoint.customName")} className={`${ui.input} py-2`} />
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("appoint.note")} className={`${ui.input} py-2`} />
            <button
              type="button"
              disabled={!custom.trim()}
              onClick={() => pick({ name: custom.trim(), traits: [], manner: "", competence: 3, loyalty: 3 })}
              className={`${ui.primary} px-3 py-2 text-xs`}
            >
              <UserPlus className="h-4 w-4" />
              {t("appoint.choose")}
            </button>
          </section>

          <section className="grid gap-2">
            <div className={`${ui.label} flex items-center gap-1.5`}>
              <MessageCircle className="h-3.5 w-3.5" />
              {t("appoint.discuss")}
            </div>
            <select value={advisor} onChange={(e) => setAdvisor(e.target.value as AdvisorId)} className={`${ui.input} py-2`}>
              {ADVISORS.filter((a) => ADVISOR_POST[a] !== post).map((a) => (
                <option key={a} value={a}>
                  {nameOf(a)} · {officialAt(state, ADVISOR_POST[a])?.title ?? text(ADVISOR_TITLES[a])}
                </option>
              ))}
            </select>
            {thread.length > 0 && (
              <ChatScroll watch={`${advisor}-${thread.length}-${asking}`} className="max-h-60">
                {thread.map((m, i) => (
                  <div key={i} className={`max-w-[92%] rounded-2xl px-3 py-2 text-xs ${m.from === "player" ? "ml-auto rounded-br-md bg-ink text-on-ink" : "rounded-bl-md border border-line sheet text-ink"}`}>
                    <div className={`mb-0.5 text-2xs font-black uppercase tracking-widest ${m.from === "player" ? "text-on-ink/60" : "text-muted"}`}>{m.from === "player" ? t("diplomacy.you") : nameOf(advisor)}</div>
                    <p className="whitespace-pre-wrap font-medium leading-relaxed">{m.text}</p>
                  </div>
                ))}
              </ChatScroll>
            )}
            {asking && (
              <div className="flex items-center gap-2 text-xs font-medium text-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t("cabinet.thinking", { title: nameOf(advisor) })}
              </div>
            )}
            <div className="flex gap-2">
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === "Enter" && question.trim() && !busy) {
                    e.preventDefault();
                    if (await onAsk(advisor, question.trim(), context())) setQuestion("");
                  }
                }}
                placeholder={t("appoint.askPlaceholder")}
                className={`${ui.input} py-2`}
              />
              <button
                type="button"
                disabled={disabled || Boolean(busy) || !question.trim()}
                onClick={async () => {
                  if (await onAsk(advisor, question.trim(), context())) setQuestion("");
                }}
                className={`${ui.secondary} shrink-0 px-3 py-2 text-xs`}
              >
                {t("appoint.ask")}
              </button>
            </div>
          </section>
        </div>
      )}
    </Dialog>
  );
}

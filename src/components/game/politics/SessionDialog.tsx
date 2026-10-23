"use client";

import { CheckCircle2, Gavel, Loader2, Mic, PenLine, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import ChatScroll from "@/components/ui/ChatScroll";
import Dialog from "@/components/ui/Dialog";
import { ui } from "@/components/ui/classes";
import Dictation from "@/components/voice/Dictation";
import SpeakButton from "@/components/voice/SpeakButton";
import { formatDate } from "@/engine/calendar";
import { canVote, forecast, leanOf, WHIP } from "@/engine/parliament";
import type { GameState, Session } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import { partyColors } from "./layout";
import { useMotionLabel } from "./motion";

interface SessionDialogProps {
  state: GameState;
  session: Session | null;
  busy: { kind: string; chars: number } | null;
  disabled: boolean;
  onSpeak: (line: string) => Promise<boolean>;
  onVote: () => void;
  /** A draft of the government's next speech from the interior minister, for the player to edit and give; null when none came. */
  onDraft: () => Promise<string | null>;
  onClose: () => void;
}

/**
 * A sitting of parliament held in person: the motion, the speeches as they
 * come, the government's own speech, and beside them how each party leans
 * now. It never plays out without the player: the vote waits for the
 * government's speech, which the interior minister can draft on request.
 * The vote is the engine's: parties vote by their lean, the waverers split,
 * and a passed motion takes effect at once.
 */
export default function SessionDialog({ state, session, busy, disabled, onSpeak, onVote, onDraft, onClose }: SessionDialogProps) {
  const { t, locale } = useI18n();
  const label = useMotionLabel();
  const [line, setLine] = useState("");
  const politics = state.politics;
  const parties = useMemo(() => (politics?.parties ?? []).filter((p) => (p.seats ?? 0) > 0).sort((a, b) => (b.seats ?? 0) - (a.seats ?? 0)), [politics?.parties]);
  const colors = useMemo(() => partyColors(politics?.parties ?? []), [politics?.parties]);
  const record = session?.transcript ?? [];
  const over = session ? session.status !== "open" : false;
  const talking = busy?.kind === "parliament";
  const tally = politics && session ? (session.vote ?? forecast(politics, session)) : null;
  const partyName = (id: string | undefined) => politics?.parties.find((p) => p.id === id)?.name ?? t("politics.session.chair");
  const speak = async () => {
    const said = line.trim();
    if (!said || busy) return;
    if (await onSpeak(said)) setLine("");
  };
  const draft = async () => {
    if (busy) return;
    const text = await onDraft();
    if (text) setLine(text);
  };
  const drafting = busy?.kind === "advice";
  const m = session?.motion;
  const effect = (() => {
    if (!session || session.status !== "passed" || !m) return session?.status === "failed" && m?.kind === "confidence" ? t("politics.session.effect.confidenceLost") : null;
    if (m.kind === "law" && m.law && m.option) return t("politics.session.effect.law", { law: t(`law.${m.law}` as MessageKey), option: t(`law.${m.law}.${m.option}` as MessageKey) });
    if (m.kind === "emergency") return t("politics.session.effect.emergency");
    if (m.kind === "election" && politics?.nextElection) return t("politics.session.effect.election", { date: formatDate(politics.nextElection, locale) });
    if (m.kind === "postpone" && politics?.nextElection) return t("politics.session.effect.postpone", { date: formatDate(politics.nextElection, locale) });
    if (m.kind === "confidence") return t("politics.session.effect.confidenceWon");
    return t("politics.session.effect.bill");
  })();

  return (
    <Dialog open={session !== null} onClose={onClose} huge title={politics?.parliament?.name ?? t("politics.tab.parliament")}>
      {session && politics && (
        <div className="grid gap-4 md:grid-cols-[1fr_16rem]">
          <div className="flex min-w-0 flex-col gap-3">
            <div>
              {/* The kind above only for a law: a bill's or an amendment's line below already starts with its kind. */}
              {session.motion.kind === "law" && <div className={ui.label}>{t(`politics.motion.${session.motion.kind}` as MessageKey)}</div>}
              <div className="mt-0.5 text-sm font-black leading-snug text-ink">{label(session.motion)}</div>
              {session.motion.kind === "law" && session.motion.text && <p className="mt-0.5 text-xs font-medium text-muted">{session.motion.text}</p>}
            </div>

            <ChatScroll watch={`${record.length}-${talking}-${over}`} className="max-h-[48vh] rounded-xl border border-line bg-page p-2">
              {record.length === 0 && !talking && <p className="p-2 text-xs font-medium text-muted">{t("politics.session.opening")}</p>}
              {record.map((l, i) => {
                const mine = Boolean(l.player);
                const color = l.party ? colors.get(l.party) : undefined;
                return (
                  <div key={i} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                    <span className="mt-2 h-3 w-3 shrink-0 rounded-full border border-line" style={{ background: mine ? "var(--ink)" : (color ?? "var(--divider)") }} />
                    <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${mine ? "rounded-tr-md bg-ink text-on-ink" : "rounded-tl-md border border-line sheet text-ink"}`}>
                      <div className={`mb-0.5 flex items-center gap-2 text-2xs font-black uppercase tracking-widest ${mine ? "text-on-ink/60" : "text-muted"}`}>
                        {mine ? t("diplomacy.you") : [l.speaker, partyName(l.party)].filter(Boolean).join(" · ")}
                        {!mine && <SpeakButton id={`session-${session.id}-${i}`} text={l.text} className="-my-1 ml-auto" />}
                      </div>
                      <p className="whitespace-pre-wrap font-medium leading-relaxed">{l.text}</p>
                    </div>
                  </div>
                );
              })}
              {talking && (
                <div className="flex items-center gap-2 p-2 text-xs font-medium text-muted">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {record.length ? t("politics.session.answering") : t("politics.session.opening")} {busy && busy.chars > 0 && <span className="tabular-nums">· {busy.chars}</span>}
                </div>
              )}
            </ChatScroll>

            {over ? (
              <section className="rounded-xl bg-page p-3">
                <div className={`flex items-center gap-1.5 text-sm font-black ${session.status === "passed" ? "text-emerald-700" : "text-red-700"}`}>
                  {session.status === "passed" ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  {t(session.status === "passed" ? "politics.session.passed" : "politics.session.failed")}
                </div>
                {session.vote && (
                  <p className="mt-1 text-xs font-bold tabular-nums text-ink">
                    {t("politics.session.tally", { for: session.vote.for, against: session.vote.against, abstain: session.vote.abstain })} · {t("politics.session.needs", { n: session.vote.need, total: politics.parliament?.seats ?? 0 })}
                  </p>
                )}
                {effect && <p className="mt-1.5 text-xs font-medium text-muted">{effect}</p>}
              </section>
            ) : (
              <>
                <Dictation id="session" set={setLine} disabled={disabled || Boolean(busy)}>
                  <textarea
                    value={line}
                    onChange={(e) => setLine(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        void speak();
                      }
                    }}
                    rows={3}
                    placeholder={t("politics.session.placeholder")}
                    className={`${ui.input} resize-none`}
                  />
                </Dictation>
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={disabled || Boolean(busy) || !line.trim()} onClick={() => void speak()} className={`${ui.primary} flex-1 px-4 py-2.5 text-xs`}>
                    <Mic className="h-4 w-4" />
                    {t("politics.session.speak")}
                  </button>
                  <button type="button" disabled={disabled || Boolean(busy)} onClick={() => void draft()} title={t("politics.draft.hint")} className={`${ui.secondary} px-4 py-2.5 text-xs`}>
                    {drafting ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />}
                    {t("politics.draft.button")}
                  </button>
                  <button type="button" disabled={Boolean(busy) || !canVote(session)} onClick={onVote} title={canVote(session) ? undefined : t("politics.session.speakFirst")} className={`${ui.secondary} px-4 py-2.5 text-xs`}>
                    <Gavel className="h-4 w-4" />
                    {t("politics.session.vote")}
                  </button>
                </div>
                {!canVote(session) && <p className="text-2xs font-medium text-muted">{t("politics.session.speakFirst")}</p>}
              </>
            )}
          </div>

          <aside className="flex min-w-0 flex-col gap-2 rounded-xl border border-line p-3">
            <div className={ui.label}>{over ? t("politics.session.result") : t("politics.session.forecast")}</div>
            {tally && (
              <div className="text-xs font-bold tabular-nums text-ink">
                {t("politics.session.tally", { for: tally.for, against: tally.against, abstain: tally.abstain })}
                <div className={`mt-0.5 text-2xs ${tally.for >= tally.need ? "text-emerald-700" : "text-amber-700"}`}>{t("politics.session.needs", { n: tally.need, total: politics.parliament?.seats ?? 0 })}</div>
              </div>
            )}
            <ul className="grid gap-1.5">
              {parties.map((p) => {
                const lean = leanOf(p, session, politics.laws);
                const counted = tally?.parties.find((x) => x.party === p.id);
                const seats = p.seats ?? 0;
                const word = lean >= WHIP ? "for" : lean <= -WHIP ? "against" : "waver";
                return (
                  <li key={p.id}>
                    <div className="flex items-baseline justify-between gap-2 text-2xs font-bold">
                      <span className="flex min-w-0 items-center gap-1.5 text-ink">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colors.get(p.id) }} />
                        <span className="truncate">{p.name}</span>
                      </span>
                      <span className={`shrink-0 uppercase tracking-wider ${word === "for" ? "text-emerald-700" : word === "against" ? "text-red-700" : "text-amber-700"}`}>{t(`politics.session.lean.${word}` as MessageKey)}</span>
                    </div>
                    {counted && seats > 0 && (
                      <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-divider">
                        <span className="bg-emerald-500" style={{ width: `${(counted.for / seats) * 100}%` }} />
                        <span className="bg-amber-300" style={{ width: `${(counted.abstain / seats) * 100}%` }} />
                        <span className="bg-red-600" style={{ width: `${(counted.against / seats) * 100}%` }} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </aside>
        </div>
      )}
    </Dialog>
  );
}

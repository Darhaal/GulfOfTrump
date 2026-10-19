"use client";

import { CheckCircle2, Loader2, Mic, Square, Ear } from "lucide-react";
import { useState } from "react";
import Flag from "@/components/Flag";
import ChatScroll from "@/components/ui/ChatScroll";
import Dialog from "@/components/ui/Dialog";
import { ui } from "@/components/ui/classes";
import { ADVISOR_TITLES, ADVISORS, type AdvisorId } from "@/engine/advisors";
import { formatDate } from "@/engine/calendar";
import { ADVISOR_POST, officialAt } from "@/engine/government";
import type { GameState, Summit } from "@/engine/types";
import { useI18n } from "@/i18n/useI18n";

interface LiveSummitDialogProps {
  state: GameState;
  summit: Summit | null;
  busy: { kind: string; chars: number; advisor?: AdvisorId } | null;
  disabled: boolean;
  onSpeak: (line: string) => Promise<boolean>;
  onFinish: () => Promise<boolean>;
  onAsk: (advisor: AdvisorId, question: string, context?: string) => Promise<boolean>;
  onClose: () => void;
}

/**
 * A meeting the player holds in person: the record as it grows, the
 * player's own statement, and beside it a minister to whisper to — the
 * chief of staff by default — who sees the record too. Ending the meeting
 * sums up what was agreed; the next turn has to honour it.
 */
export default function LiveSummitDialog({ state, summit, busy, disabled, onSpeak, onFinish, onAsk, onClose }: LiveSummitDialogProps) {
  const { t, text, locale } = useI18n();
  const [line, setLine] = useState("");
  const [whisper, setWhisper] = useState("");
  const [advisor, setAdvisor] = useState<AdvisorId>("chief");
  const name = (tag: string) => text(state.countries[tag]?.name ?? tag);
  const record = summit?.transcript ?? [];
  const over = summit?.status === "held";
  const talking = busy?.kind === "summit";
  const whispering = busy?.kind === "advice" && busy.advisor === advisor;
  const advisorName = (a: AdvisorId) => officialAt(state, ADVISOR_POST[a])?.name ?? text(ADVISOR_TITLES[a]);
  const thread = (state.advice?.[advisor] ?? []).slice(-8);
  const context = () =>
    summit
      ? [
          `The government is at "${summit.title}"${summit.place ? ` in ${summit.place}` : ""} with ${summit.participants.filter((p) => p !== state.player).slice(0, 20).join(", ")}.`,
          summit.agenda ? `Agenda: ${summit.agenda}` : "",
          "What has been said:",
          ...record.slice(-12).map((l) => `[${l.country}]${l.speaker ? ` ${l.speaker}` : ""}: ${l.text}`),
        ]
          .filter(Boolean)
          .join("\n")
      : "";
  const speak = async () => {
    const said = line.trim();
    if (!said || busy) return;
    if (await onSpeak(said)) setLine("");
  };
  const ask = async () => {
    const q = whisper.trim();
    if (!q || busy) return;
    if (await onAsk(advisor, q, context())) setWhisper("");
  };

  return (
    <Dialog open={summit !== null} onClose={onClose} huge title={summit?.title ?? ""}>
      {summit && (
        <div className="grid gap-4 md:grid-cols-[1fr_16rem]">
          <div className="flex min-w-0 flex-col gap-3">
            <div className="text-xs font-medium tabular-nums text-muted">
              {[summit.place, formatDate(summit.date, locale)].filter(Boolean).join(" · ")}
              {summit.agenda ? ` · ${summit.agenda}` : ""}
            </div>
            <div className="flex flex-wrap gap-1">
              {summit.participants.slice(0, 24).map((tag) => (
                <span key={tag} title={name(tag)} className="inline-flex items-center gap-1 rounded-md bg-page px-1.5 py-0.5 text-2xs font-bold text-ink">
                  <Flag tag={tag} scenario={state.scenarioId} color={state.countries[tag]?.color} size="sm" />
                  {summit.participants.length <= 8 && name(tag)}
                </span>
              ))}
              {summit.participants.length > 24 && <span className="text-2xs font-bold text-muted">+{summit.participants.length - 24}</span>}
            </div>

            <ChatScroll watch={`${record.length}-${talking}-${over}`} className="max-h-[48vh] rounded-xl border border-line bg-page p-2">
              {record.length === 0 && <p className="p-2 text-xs font-medium text-muted">{t("live.empty")}</p>}
              {record.map((l, i) => {
                const mine = l.country === state.player;
                return (
                  <div key={i} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                    <Flag tag={l.country} scenario={state.scenarioId} color={state.countries[l.country]?.color} className="mt-1" />
                    <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${mine ? "rounded-tr-md bg-ink text-on-ink" : "rounded-tl-md border border-line bg-surface text-ink"}`}>
                      <div className={`mb-0.5 text-2xs font-black uppercase tracking-widest ${mine ? "text-on-ink/60" : "text-muted"}`}>
                        {mine ? t("diplomacy.you") : [l.speaker, name(l.country)].filter(Boolean).join(" · ")}
                      </div>
                      <p className="whitespace-pre-wrap font-medium leading-relaxed">{l.text}</p>
                    </div>
                  </div>
                );
              })}
              {talking && (
                <div className="flex items-center gap-2 p-2 text-xs font-medium text-muted">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t("live.answering")} {busy && busy.chars > 0 && <span className="tabular-nums">· {busy.chars}</span>}
                </div>
              )}
            </ChatScroll>

            {over ? (
              <section className="rounded-xl bg-page p-3">
                <div className={`${ui.label} mb-1 flex items-center gap-1.5`}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {t("live.result")}
                </div>
                <p className="text-sm font-medium leading-relaxed text-ink">{summit.outcome}</p>
                {summit.agreements && summit.agreements.length > 0 && (
                  <ul className="mt-2 grid gap-1">
                    {summit.agreements.map((a) => (
                      <li key={a} className="text-xs font-semibold text-ink">
                        · {a}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-xs font-medium text-muted">{t("live.next")}</p>
              </section>
            ) : (
              <>
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
                  placeholder={t("live.placeholder")}
                  className={`${ui.input} resize-none`}
                />
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={disabled || Boolean(busy) || !line.trim()} onClick={() => void speak()} className={`${ui.primary} flex-1 px-4 py-2.5 text-xs`}>
                    <Mic className="h-4 w-4" />
                    {t("live.speak")}
                  </button>
                  <button type="button" disabled={disabled || Boolean(busy) || record.length === 0} onClick={() => void onFinish()} className={`${ui.secondary} px-4 py-2.5 text-xs`}>
                    <Square className="h-4 w-4" />
                    {t("live.finish")}
                  </button>
                </div>
              </>
            )}
          </div>

          <aside className="flex min-w-0 flex-col gap-2 rounded-xl border border-line p-3">
            <div className={`${ui.label} flex items-center gap-1.5`}>
              <Ear className="h-3.5 w-3.5" />
              {t("live.whisper")}
            </div>
            <select value={advisor} onChange={(e) => setAdvisor(e.target.value as AdvisorId)} className={`${ui.input} py-2 text-xs`}>
              {ADVISORS.map((a) => (
                <option key={a} value={a}>
                  {advisorName(a)}
                </option>
              ))}
            </select>
            <ChatScroll watch={`${advisor}-${thread.length}-${whispering}`} className="max-h-[40vh]">
              {thread.map((m, i) => (
                <div key={i} className={`rounded-xl px-2.5 py-1.5 text-xs ${m.from === "player" ? "ml-4 bg-ink text-on-ink" : "mr-4 border border-line bg-surface text-ink"}`}>
                  <p className="whitespace-pre-wrap font-medium leading-relaxed">{m.text}</p>
                </div>
              ))}
              {whispering && (
                <div className="flex items-center gap-1.5 text-2xs font-medium text-muted">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {t("cabinet.thinking", { title: advisorName(advisor) })}
                </div>
              )}
            </ChatScroll>
            <textarea
              value={whisper}
              onChange={(e) => setWhisper(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  void ask();
                }
              }}
              rows={2}
              placeholder={t("live.whisperPlaceholder")}
              className={`${ui.input} resize-none py-2 text-xs`}
            />
            <button type="button" disabled={disabled || Boolean(busy) || !whisper.trim()} onClick={() => void ask()} className={`${ui.secondary} px-3 py-2 text-xs`}>
              {t("live.ask")}
            </button>
          </aside>
        </div>
      )}
    </Dialog>
  );
}

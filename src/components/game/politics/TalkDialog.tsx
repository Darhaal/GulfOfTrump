"use client";

import { CheckCircle2, Loader2, MessagesSquare, PenLine, Square } from "lucide-react";
import { useState } from "react";
import ChatScroll from "@/components/ui/ChatScroll";
import Dialog from "@/components/ui/Dialog";
import { ui } from "@/components/ui/classes";
import Dictation from "@/components/voice/Dictation";
import SpeakButton from "@/components/voice/SpeakButton";
import type { Talk } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";

interface TalkDialogProps {
  talk: Talk | null;
  busy: { kind: string; chars: number } | null;
  disabled: boolean;
  onSay: (line: string) => Promise<boolean>;
  onFinish: () => Promise<boolean>;
  /** A draft of what to say next from the interior minister, for the player to edit and say; null when none came. */
  onDraft: () => Promise<string | null>;
  onClose: () => void;
}

/**
 * Talks in person with a protest's leaders or with plotters: the record,
 * the player's words, and the end of the talks. They never play out without
 * the player: they end only after the government has spoken, and the
 * interior minister can draft its words on request. What came of them is
 * the engine's to decide; the dialog shows it and what it changed.
 */
export default function TalkDialog({ talk, busy, disabled, onSay, onFinish, onDraft, onClose }: TalkDialogProps) {
  const { t } = useI18n();
  const [line, setLine] = useState("");
  const record = talk?.transcript ?? [];
  const over = talk?.status === "done";
  const talking = busy?.kind === "talks";
  const say = async () => {
    const said = line.trim();
    if (!said || busy) return;
    if (await onSay(said)) setLine("");
  };
  const draft = async () => {
    if (busy) return;
    const text = await onDraft();
    if (text) setLine(text);
  };
  const drafting = busy?.kind === "advice";

  return (
    <Dialog open={talk !== null} onClose={onClose} wide title={talk ? t("politics.talk.title", { title: talk.title }) : ""}>
      {talk && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-muted">
            <MessagesSquare className="h-3.5 w-3.5" />
            {t("politics.talk.with", { name: talk.counterpart })}
          </div>

          <ChatScroll watch={`${record.length}-${talking}-${over}`} className="max-h-[48vh] rounded-xl border border-line bg-page p-2">
            {record.length === 0 && !talking && <p className="p-2 text-xs font-medium text-muted">{t("politics.talk.empty")}</p>}
            {record.map((l, i) => {
              const mine = Boolean(l.player);
              return (
                <div key={i} className={`flex ${mine ? "justify-end" : ""}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${mine ? "rounded-tr-md bg-ink text-on-ink" : "rounded-tl-md border border-line sheet text-ink"}`}>
                    <div className={`mb-0.5 flex items-center gap-2 text-2xs font-black uppercase tracking-widest ${mine ? "text-on-ink/60" : "text-muted"}`}>
                      {mine ? t("diplomacy.you") : l.speaker || talk.counterpart}
                      {!mine && <SpeakButton id={`talk-${talk.id}-${i}`} text={l.text} className="-my-1 ml-auto" />}
                    </div>
                    <p className="whitespace-pre-wrap font-medium leading-relaxed">{l.text}</p>
                  </div>
                </div>
              );
            })}
            {talking && (
              <div className="flex items-center gap-2 p-2 text-xs font-medium text-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t("politics.talk.answering", { name: talk.counterpart })} {busy && busy.chars > 0 && <span className="tabular-nums">· {busy.chars}</span>}
              </div>
            )}
          </ChatScroll>

          {over ? (
            <section className="rounded-xl bg-page p-3">
              <div className="flex items-center gap-1.5 text-sm font-black text-ink">
                <CheckCircle2 className="h-4 w-4" />
                {t(`politics.talk.result.${talk.result ?? "none"}` as MessageKey)}
              </div>
              <p className="mt-1 text-xs font-medium text-muted">{t(`politics.talk.effect.${talk.with}.${talk.result ?? "none"}` as MessageKey)}</p>
              {talk.note && <p className="mt-1.5 text-xs font-medium text-ink">{talk.note}</p>}
            </section>
          ) : (
            <>
              <Dictation id="talks" set={setLine} disabled={disabled || Boolean(busy)}>
                <textarea
                  value={line}
                  onChange={(e) => setLine(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      void say();
                    }
                  }}
                  rows={3}
                  placeholder={t("politics.talk.placeholder")}
                  className={`${ui.input} resize-none`}
                />
              </Dictation>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={disabled || Boolean(busy) || !line.trim()} onClick={() => void say()} className={`${ui.primary} flex-1 px-4 py-2.5 text-xs`}>
                  <MessagesSquare className="h-4 w-4" />
                  {t("politics.talk.say")}
                </button>
                <button type="button" disabled={disabled || Boolean(busy)} onClick={() => void draft()} title={t("politics.draft.hint")} className={`${ui.secondary} px-4 py-2.5 text-xs`}>
                  {drafting ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />}
                  {t("politics.draft.button")}
                </button>
                <button type="button" disabled={disabled || Boolean(busy) || !record.some((l) => l.player)} onClick={() => void onFinish()} className={`${ui.secondary} px-4 py-2.5 text-xs`}>
                  <Square className="h-4 w-4" />
                  {t("politics.talk.finish")}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </Dialog>
  );
}

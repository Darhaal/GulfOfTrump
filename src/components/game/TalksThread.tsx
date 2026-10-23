"use client";

import { Loader2, Send } from "lucide-react";
import { useState } from "react";
import Flag from "@/components/Flag";
import ChatScroll from "@/components/ui/ChatScroll";
import { ui } from "@/components/ui/classes";
import Dictation from "@/components/voice/Dictation";
import SpeakButton from "@/components/voice/SpeakButton";
import type { GameState, Stance } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import { leaderName } from "@/i18n/leaders";
import { leaderOf, personName } from "@/engine/people";
import Portrait from "./Portrait";

interface TalksThreadProps {
  state: GameState;
  target: string;
  busy: { chars: number } | null;
  disabled: boolean;
  onSend: (target: string, message: string) => Promise<boolean>;
}

const STANCE_STYLE: Record<Stance, string> = {
  agree: "bg-emerald-50 text-emerald-700",
  refuse: "bg-red-50 text-red-700",
  counter: "bg-amber-50 text-amber-700",
  neutral: "bg-page text-muted",
};

/** Talks with one government: its letters and answers, written in character by the game master, and the next letter to it. */
export default function TalksThread({ state, target, busy, disabled, onSend }: TalksThreadProps) {
  const { t, text, locale } = useI18n();
  const [message, setMessage] = useState("");

  const thread = state.diplomacy[target] ?? [];
  const them = state.countries[target];
  const theirLeader = leaderOf(state, target);

  const send = async () => {
    if (!message.trim()) return;
    if (await onSend(target, message.trim())) setMessage("");
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {them && (
        <>
          <div className="flex items-center gap-2.5">
            <Flag tag={them.tag} scenario={state.scenarioId} color={them.color} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-black text-ink">{text(them.name)}</div>
              {them.leader && <div className="truncate text-xs font-medium text-muted">{leaderName(them.leader, locale)}</div>}
            </div>
            {theirLeader && <Portrait portrait={theirLeader.portrait} gender={theirLeader.gender} name={personName(theirLeader, locale)} size="md" />}
          </div>

          <ChatScroll watch={`${target}-${thread.length}-${Boolean(busy)}`}>
            {thread.length === 0 && <p className="text-xs font-medium text-muted">{t("diplomacy.empty")}</p>}
            {thread.map((m, i) => (
              <div
                key={i}
                className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm ${
                  m.from === "player" ? "ml-auto rounded-br-md bg-ink text-on-ink" : "rounded-bl-md border border-line sheet text-ink"
                }`}
              >
                <div className={`mb-1 flex items-center gap-2 text-2xs font-black uppercase tracking-widest ${m.from === "player" ? "text-on-ink/60" : "text-muted"}`}>
                  {m.from === "player" ? t("diplomacy.you") : text(them.name)}
                  <span className="font-medium normal-case tracking-normal tabular-nums">{m.date}</span>
                  {m.from !== "player" && <SpeakButton id={`letter-${target}-${i}`} text={m.text} className="-my-1 ml-auto" />}
                </div>
                <p className="whitespace-pre-wrap break-words font-medium leading-relaxed">{m.text}</p>
                {m.stance && (
                  <span className={`mt-2 inline-block rounded-md px-2 py-0.5 text-2xs font-black uppercase tracking-wider ${STANCE_STYLE[m.stance]}`}>
                    {t(`diplomacy.stance.${m.stance}` as MessageKey)}
                  </span>
                )}
              </div>
            ))}
            {busy && (
              <div className="flex items-center gap-2 text-xs font-medium text-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t("diplomacy.waiting")} {busy.chars > 0 && <span className="tabular-nums">· {busy.chars}</span>}
              </div>
            )}
          </ChatScroll>

          <div>
            <Dictation id={`letter-${target}`} set={setMessage} max={2000} disabled={disabled || Boolean(busy)}>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    void send();
                  }
                }}
                rows={3}
                maxLength={2000}
                disabled={disabled || Boolean(busy)}
                placeholder={t("diplomacy.placeholder", { country: text(them.name) })}
                className={`${ui.input} resize-none`}
              />
            </Dictation>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-2xs font-medium text-muted">{t("diplomacy.note")}</span>
              <button type="button" onClick={send} disabled={disabled || Boolean(busy) || !message.trim()} className={`${ui.primary} shrink-0 px-4 py-2 text-xs`}>
                <Send className="h-3.5 w-3.5" />
                {t("diplomacy.send")}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

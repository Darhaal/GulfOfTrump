"use client";

import { ChevronUp, Loader2, MessageCircle, Send, UserRoundPen } from "lucide-react";
import { useState } from "react";
import ChatScroll from "@/components/ui/ChatScroll";
import { ui } from "@/components/ui/classes";
import SpeakButton from "@/components/voice/SpeakButton";
import { ADVISOR_TITLES, type AdvisorId } from "@/engine/advisors";
import { ADVISOR_POST, officialAt } from "@/engine/government";
import type { GameState } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import DraftedOrders from "./DraftedOrders";
import Portrait from "./Portrait";
import ProposalCard from "./ProposalCard";

interface AdvisorStripProps {
  state: GameState;
  /** One minister, or two with a switch between them. */
  advisors: AdvisorId[];
  /** A question in flight, and to whom. */
  busy: { advisor: AdvisorId; chars: number } | null;
  /** Asking is off: no game master, or another request under way. */
  askDisabled: boolean;
  /** Applying a proposal or adding an order is off: a request is under way. */
  disabled: boolean;
  /** The government is being named. */
  setupBusy: boolean;
  onAsk: (advisor: AdvisorId, question: string) => Promise<boolean>;
  /** Ask the game master who the people of the government are. */
  onSetup: () => void;
  /** Apply the proposal in message `at` of the minister's conversation. */
  onApply: (advisor: AdvisorId, at: number) => void;
  /** Add an order the minister drafted to the turn's orders. */
  onAddOrder: (order: string) => void;
}

/**
 * The tab's minister at the top of its panel: a portrait, a name and a
 * field to ask or request something. The conversation is the cabinet's own
 * thread with that minister; it opens when used and folds back. The minister
 * says nothing unasked; an order they draft when asked is one click from the
 * turn's orders, and a change they propose (the research split, what
 * industry builds first, the budget) waits for the player to apply it.
 */
export default function AdvisorStrip({ state, advisors, busy, askDisabled, disabled, setupBusy, onAsk, onSetup, onApply, onAddOrder }: AdvisorStripProps) {
  const { t, text } = useI18n();
  const [picked, setPicked] = useState<AdvisorId>(advisors[0]);
  const [question, setQuestion] = useState("");
  const [open, setOpen] = useState(false);
  const advisor = advisors.includes(picked) ? picked : advisors[0];
  const person = officialAt(state, ADVISOR_POST[advisor]);
  const title = person?.title ?? text(ADVISOR_TITLES[advisor]);
  const name = person?.name ?? title;
  const thread = state.advice?.[advisor] ?? [];
  const thinking = busy?.advisor === advisor;
  const answers = thread.filter((m) => m.from === "advisor").length;

  const ask = async () => {
    const value = question.trim();
    if (!value || askDisabled) return;
    setOpen(true);
    if (await onAsk(advisor, value)) setQuestion("");
  };

  return (
    <section className={`${ui.card} mb-4 p-2.5`} aria-label={title}>
      {advisors.length > 1 && (
        <div className="mb-2 grid auto-cols-fr grid-flow-col gap-0.5 rounded-lg bg-page p-0.5" role="group" aria-label={t("advisor.which")}>
          {advisors.map((a) => (
            <button
              key={a}
              type="button"
              aria-pressed={a === advisor}
              onClick={() => setPicked(a)}
              className={`truncate rounded-md px-2 py-1 text-2xs font-bold transition-all ${a === advisor ? `${ui.segmentOn} bg-surface shadow-sm` : ui.segmentOff}`}
            >
              {t(`advisor.short.${a}` as MessageKey)}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2.5">
        {person ? (
          <Portrait portrait={person.portrait} gender={person.gender} name={person.name} size="sm" />
        ) : (
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line bg-page text-muted">
            <UserRoundPen className="h-4 w-4" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-black text-ink">{name}</div>
          {person && <div className="truncate text-2xs font-medium text-muted">{title}</div>}
        </div>
        {thread.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            title={t(open ? "advisor.fold" : "advisor.history", { n: answers })}
            aria-label={t(open ? "advisor.fold" : "advisor.history", { n: answers })}
            className="flex shrink-0 items-center gap-1 rounded-lg px-1.5 py-1 text-2xs font-bold text-muted hover:bg-page hover:text-ink"
          >
            {open ? <ChevronUp className="h-3.5 w-3.5" /> : <MessageCircle className="h-3.5 w-3.5" />}
            <span className="tabular-nums">{answers}</span>
          </button>
        )}
      </div>

      {!person && !state.officials?.length ? (
        <button type="button" onClick={onSetup} disabled={askDisabled} className={`${ui.secondary} mt-2 w-full px-3 py-2 text-xs`}>
          {setupBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserRoundPen className="h-3.5 w-3.5" />}
          {t(setupBusy ? "gov.loading" : "gov.setup")}
        </button>
      ) : (
        <>
          {open && (thread.length > 0 || thinking) && (
            <ChatScroll watch={`${advisor}-${thread.length}-${thinking}`} className="mt-2 max-h-80">
              {thread.map((m, i) => (
                <div key={i} className={`max-w-[94%] rounded-2xl px-3 py-2 text-xs ${m.from === "player" ? "ml-auto rounded-br-md bg-ink text-on-ink" : "rounded-bl-md border border-line bg-page text-ink"}`}>
                  {m.from !== "player" && (
                    <div className="mb-0.5 flex items-center gap-2 text-2xs font-black uppercase tracking-widest text-muted">
                      <span className="truncate">{name}</span>
                      <SpeakButton id={`strip-${advisor}-${i}`} text={m.text} className="-my-1 ml-auto" />
                    </div>
                  )}
                  <p className="whitespace-pre-wrap break-words font-medium leading-relaxed">{m.text}</p>
                  {m.from === "advisor" && m.orders && m.orders.length > 0 && <DraftedOrders orders={m.orders} state={state} disabled={disabled} onAdd={onAddOrder} />}
                  {m.from === "advisor" && (m.proposal || m.budget) && <ProposalCard state={state} advisor={advisor} message={m} disabled={disabled} onApply={() => onApply(advisor, i)} />}
                </div>
              ))}
              {thinking && (
                <div className="flex items-center gap-2 text-2xs font-bold text-muted">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {t("cabinet.thinking", { title: name })} {(busy?.chars ?? 0) > 0 && <span className="tabular-nums">· {busy?.chars}</span>}
                </div>
              )}
            </ChatScroll>
          )}
          <form
            className="mt-2 flex gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              void ask();
            }}
          >
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onFocus={() => thread.length > 0 && setOpen(true)}
              maxLength={2000}
              disabled={askDisabled && !thinking}
              placeholder={t("advisor.placeholder", { name })}
              aria-label={t("advisor.placeholder", { name })}
              className={`${ui.input} min-w-0 py-2 text-xs`}
            />
            <button type="submit" disabled={askDisabled || !question.trim()} title={t("advisor.send")} aria-label={t("advisor.send")} className={`${ui.primary} shrink-0 px-3 py-2`}>
              {thinking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </button>
          </form>
        </>
      )}
    </section>
  );
}

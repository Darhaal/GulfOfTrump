"use client";

import { Handshake, Loader2, Send, Users, X } from "lucide-react";
import { useState } from "react";
import ChatScroll from "@/components/ui/ChatScroll";
import { ui } from "@/components/ui/classes";
import Dictation from "@/components/voice/Dictation";
import SpeakButton from "@/components/voice/SpeakButton";
import type { AdvisorId } from "@/engine/advisors";
import { activeIntrigue, agreePrice, approachDeputy, cannotApproach, deputiesOf, dropIntrigue, type ApproachAnswer } from "@/engine/deputies";
import { ADVISOR_POST, officialAt } from "@/engine/government";
import { agendaOf } from "@/engine/interests";
import { INTRIGUE_GOALS, type GameState, type Intrigue, type IntrigueGoal, type IntriguePrice, type Official } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import { Pips, Traits } from "./AppointmentDialog";
import Portrait from "./Portrait";

interface MinistryPeopleProps {
  state: GameState;
  advisor: AdvisorId;
  /** No game master to ask: naming deputies and talking to them wait; plots, which are the engine's, do not. */
  disabled: boolean;
  anyBusy: { kind: string; chars: number; deputy?: string } | null;
  /** Ask the game master who the ministry's deputies are. */
  onSetup: (advisor: AdvisorId) => void;
  onAsk: (advisor: AdvisorId, deputy: string, question: string) => Promise<boolean>;
  /** A plot sounded out, agreed or called off: the engine's new state, to save. */
  onChange: (next: GameState) => void;
}

/** A person's portrait: their own in oil, or a shadow of their sex and era (engine/people.ts). */
function Avatar({ person, on }: { person: Pick<Official, "name" | "gender" | "portrait">; on?: boolean }) {
  return <Portrait portrait={person.portrait} gender={person.gender} name={person.name} size="md" className={on ? "ring-2 ring-ink ring-offset-2 ring-offset-page" : ""} />;
}

const STAGE_TONE: Record<Intrigue["stage"], string> = { active: "text-accent", done: "text-emerald-700", exposed: "text-red-600", dropped: "text-muted" };

/**
 * A ministry's people beyond the minister: the deputies, a private word with
 * each, and the government's plots with them against their chief
 * (engine/deputies.ts). Talking and naming need the game master; sounding a
 * deputy out, agreeing a price and calling a plot off are the engine's.
 */
export default function MinistryPeople({ state, advisor, disabled, anyBusy, onSetup, onAsk, onChange }: MinistryPeopleProps) {
  const { t, text } = useI18n();
  const post = ADVISOR_POST[advisor];
  const chief = officialAt(state, post);
  const deputies = deputiesOf(state, post);
  const [selected, setSelected] = useState<string | null>(null);
  const deputy = deputies.find((d) => d.id === selected) ?? deputies[0];
  const [tab, setTab] = useState<"private" | "plot">("private");
  const [question, setQuestion] = useState("");
  const [goal, setGoal] = useState<IntrigueGoal>("oust");
  const mine = (state.directives ?? []).filter((d) => d.ministry === advisor);
  const [directive, setDirective] = useState(mine[0]?.id ?? "");
  const [answer, setAnswer] = useState<{ deputy: string; answer: ApproachAnswer; price?: IntriguePrice; goal: IntrigueGoal; directive?: string } | null>(null);
  const busy = Boolean(anyBusy);
  const setupBusy = anyBusy?.kind === "deputies";
  const talking = anyBusy?.kind === "deputy" && anyBusy.deputy === deputy?.id ? anyBusy : null;
  const plots = (state.intrigues ?? []).filter((i) => i.post === post).reverse();

  if (!deputies.length)
    return (
      <div className="flex flex-col gap-3">
        <p className="text-xs font-medium text-muted">{t("deputies.intro")}</p>
        <button type="button" onClick={() => onSetup(advisor)} disabled={disabled || busy} className={`${ui.primary} px-4 py-3 text-xs`}>
          {setupBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
          {setupBusy ? t("deputies.loading") : t("deputies.setup")}
          {setupBusy && anyBusy && anyBusy.chars > 0 && <span className="tabular-nums">· {anyBusy.chars}</span>}
        </button>
      </div>
    );

  const d = deputy!;
  const thread = state.deputyAdvice?.[d.id] ?? [];
  const going = activeIntrigue(state, d.id);
  const why = cannotApproach(state, d.id, goal, goal === "sabotage" ? directive : undefined);
  const name = d.name;

  const ask = async () => {
    const q = question.trim();
    if (!q || busy) return;
    if (await onAsk(advisor, d.id, q)) setQuestion("");
  };
  const sound = () => {
    const r = approachDeputy(state, d.id, goal, goal === "sabotage" ? directive : undefined);
    onChange(r.state);
    setAnswer({ deputy: d.id, answer: r.answer, ...(r.price ? { price: r.price } : {}), goal, ...(goal === "sabotage" ? { directive } : {}) });
  };
  const shown = answer?.deputy === d.id ? answer : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3 overflow-x-auto pb-1">
        {chief && (
          <div className="flex w-16 shrink-0 flex-col items-center gap-1 opacity-70" title={`${chief.name} · ${chief.title}`}>
            <Avatar person={chief} />
            <span className="w-full truncate text-center text-[10px] font-bold text-muted">{t("deputies.minister")}</span>
          </div>
        )}
        {deputies.map((x) => (
          <button key={x.id} type="button" onClick={() => setSelected(x.id)} aria-pressed={x.id === d.id} title={`${x.name} · ${x.title}`} className="group flex w-16 shrink-0 flex-col items-center gap-1">
            <Avatar person={x} on={x.id === d.id} />
            <span className={`w-full truncate text-center text-[10px] font-bold ${x.id === d.id ? "text-ink" : "text-muted group-hover:text-ink"}`}>{x.name.split(/\s+/).at(-1)}</span>
          </button>
        ))}
      </div>

      <div className="rounded-xl bg-page p-3">
        <div className="text-sm font-black text-ink">{d.name}</div>
        <div className="text-xs font-medium text-muted">{d.title}</div>
        {d.bio && <div className="mt-1 text-xs font-medium text-muted">{d.bio}</div>}
        {d.traits.length > 0 && (
          <div className="mt-1.5">
            <Traits traits={d.traits} />
          </div>
        )}
        <div className="mt-1.5 flex flex-wrap gap-3">
          <Pips value={d.competence} label={t("gov.competence")} />
          <Pips value={d.loyalty} label={t("gov.loyalty")} />
          <Pips value={d.chiefLoyalty} label={t("deputies.chiefLoyalty")} />
          {d.interests && <Pips value={d.interests.ambition} label={t("cabinet.ambition")} />}
        </div>
        {d.interests && agendaOf(d).length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-divider pt-2">
            <span className="mr-0.5 text-2xs font-black uppercase tracking-wider text-muted">{t("cabinet.interests")}</span>
            {agendaOf(d).map((a) => (
              <span key={a.en} className="rounded-md bg-surface px-1.5 py-0.5 text-2xs font-bold text-ink">
                {text(a.label)}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-xl bg-page p-1">
        {(["private", "plot"] as const).map((id) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={`rounded-lg px-1.5 py-2 text-2xs font-bold transition-all ${tab === id ? `${ui.segmentOn} bg-surface shadow-sm` : ui.segmentOff}`}>
            {t(`deputies.${id}` as MessageKey)}
            {id === "plot" && going ? " ·" : ""}
          </button>
        ))}
      </div>

      {tab === "private" ? (
        <>
          <ChatScroll watch={`${d.id}-${thread.length}-${Boolean(talking)}`}>
            {thread.map((m, i) => (
              <div key={i} className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm ${m.from === "player" ? "ml-auto rounded-br-md bg-ink text-on-ink" : "rounded-bl-md border border-line bg-surface text-ink"}`}>
                <div className={`mb-1 flex items-center gap-2 text-2xs font-black uppercase tracking-widest ${m.from === "player" ? "text-on-ink/60" : "text-muted"}`}>
                  {m.from === "player" ? t("diplomacy.you") : name}
                  <span className="font-medium normal-case tracking-normal tabular-nums">{m.date}</span>
                  {m.from !== "player" && <SpeakButton id={`deputy-${d.id}-${i}`} text={m.text} className="-my-1 ml-auto" />}
                </div>
                <p className="whitespace-pre-wrap break-words font-medium leading-relaxed">{m.text}</p>
              </div>
            ))}
            {talking && (
              <div className="flex items-center gap-2 text-xs font-medium text-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t("deputies.thinking", { name })} {talking.chars > 0 && <span className="tabular-nums">· {talking.chars}</span>}
              </div>
            )}
          </ChatScroll>
          <div>
            <Dictation id={`deputy-${d.id}`} set={setQuestion} max={2000} disabled={disabled || busy}>
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
                disabled={disabled || busy}
                placeholder={t("deputies.placeholder", { name })}
                className={`${ui.input} resize-none`}
              />
            </Dictation>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-2xs font-medium text-muted">{t("deputies.note")}</span>
              <button type="button" onClick={() => void ask()} disabled={disabled || busy || !question.trim()} className={`${ui.primary} shrink-0 px-4 py-2 text-xs`}>
                <Send className="h-3.5 w-3.5" />
                {t("cabinet.ask")}
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          {going ? (
            <IntrigueCard intrigue={going} onDrop={() => onChange(dropIntrigue(state, going.id))} disabled={busy} />
          ) : (
            <div className="grid gap-2 rounded-xl border border-line bg-surface p-3">
              <div className={ui.label}>{t("deputies.goal")}</div>
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-page p-1">
                {INTRIGUE_GOALS.map((g) => (
                  <button key={g} type="button" onClick={() => setGoal(g)} className={`rounded-lg px-1.5 py-1.5 text-2xs font-bold transition-all ${goal === g ? `${ui.segmentOn} bg-surface shadow-sm` : ui.segmentOff}`}>
                    {t(`deputies.goal.${g}` as MessageKey)}
                  </button>
                ))}
              </div>
              {goal === "sabotage" &&
                (mine.length ? (
                  <label className="grid gap-1">
                    <span className="text-2xs font-black uppercase tracking-wider text-muted">{t("deputies.directive")}</span>
                    <select value={directive} onChange={(e) => setDirective(e.target.value)} className={`${ui.input} py-2 text-xs`}>
                      {mine.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.text}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <p className="text-2xs font-medium text-muted">{t("deputies.noDirectives")}</p>
                ))}
              {why && why !== "unknown" && <p className="text-2xs font-medium text-muted">{t(`deputies.why.${why}` as MessageKey)}</p>}
              <button type="button" onClick={sound} disabled={busy || Boolean(why)} className={`${ui.secondary} justify-self-start px-3 py-2 text-xs`}>
                <Handshake className="h-3.5 w-3.5" />
                {t("deputies.sound")}
              </button>
              {shown && (
                <div className="grid gap-2 rounded-lg bg-page px-3 py-2">
                  <p className={`text-xs font-bold ${shown.answer === "reports" ? "text-red-600" : shown.answer === "joins" ? "text-emerald-700" : "text-ink"}`}>
                    {t(`deputies.answer.${shown.answer}` as MessageKey, { name, price: shown.price ? t(`deputies.price.${shown.price}` as MessageKey) : "" })}
                  </p>
                  {shown.answer === "asks" && shown.price && !going && (
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          onChange(agreePrice(state, d.id, shown.goal, shown.price!, shown.directive));
                          setAnswer(null);
                        }}
                        className={`${ui.primary} px-3 py-1.5 text-2xs`}
                      >
                        {t("deputies.agree")}
                      </button>
                      <button type="button" onClick={() => setAnswer(null)} className={`${ui.secondary} px-3 py-1.5 text-2xs`}>
                        {t("deputies.decline")}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="grid gap-1.5">
            <div className={ui.label}>{t("deputies.plots")}</div>
            {plots.length === 0 ? (
              <p className="text-xs font-medium text-muted">{t("deputies.none")}</p>
            ) : (
              <ul className="grid gap-1.5">
                {plots.map((i) => (
                  <li key={i.id} className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-xs">
                    <span className="min-w-0 flex-1 truncate font-semibold text-ink">
                      {i.deputyName} · {t(`deputies.goal.${i.goal}` as MessageKey)}
                    </span>
                    <span className={`shrink-0 text-2xs font-black uppercase tracking-wider ${STAGE_TONE[i.stage]}`}>
                      {i.last.event === "reported" || i.last.event === "moot" ? t(`deputies.stage.${i.last.event}` as MessageKey) : t(`deputies.stage.${i.stage}` as MessageKey)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-2xs font-medium text-muted">{t("deputies.secret")}</p>
          </div>
        </>
      )}
    </div>
  );
}

/** A plot under way: how far it has come, what it risks, what was promised. */
function IntrigueCard({ intrigue, onDrop, disabled }: { intrigue: Intrigue; onDrop: () => void; disabled: boolean }) {
  const { t } = useI18n();
  return (
    <div className="grid gap-2 rounded-xl border border-accent/30 bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-black text-ink">{t(`deputies.goal.${intrigue.goal}` as MessageKey)}</div>
          <div className="text-2xs font-medium text-muted">{intrigue.target}</div>
        </div>
        <button type="button" onClick={onDrop} disabled={disabled} className={`${ui.secondary} shrink-0 px-2.5 py-1.5 text-2xs`}>
          <X className="h-3.5 w-3.5" />
          {t("deputies.drop")}
        </button>
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between text-2xs font-bold text-muted">
          <span>{t("deputies.strength")}</span>
          <span className="tabular-nums text-ink">{intrigue.strength}/100</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(2, intrigue.strength)}%` }} />
        </div>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-2xs font-medium text-muted">
        <span>{t("deputies.risk", { n: intrigue.risk })}</span>
        {intrigue.price && <span>{t("deputies.promised", { price: t(`deputies.reward.${intrigue.price}` as MessageKey) })}</span>}
      </div>
    </div>
  );
}

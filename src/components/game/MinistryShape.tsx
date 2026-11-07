"use client";

import { Building2, Loader2, MessagesSquare, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useState } from "react";
import { ui } from "@/components/ui/classes";
import Dialog from "@/components/ui/Dialog";
import { ADVISOR_POST, type AdvisorId } from "@/engine/advisors";
import { cleanTasks, closedMinistries, closeMinistry, createMinistry, MAX_MINISTRIES, MAX_MINISTRY_TASKS, MINISTRY_NAME_CHARS, type MinistryIconKey, ministryTitle, openMinistries, PORTFOLIO_CHARS, reopenMinistry, setMinistryColour, setMinistryIcon, TASK_CHARS } from "@/engine/ministries";
import { officialAt } from "@/engine/government";
import { IconPicker, MINISTRY_ICON_SET } from "./ministryIcons";
import Portrait from "./Portrait";
import Dictation from "@/components/voice/Dictation";
import { paintTone, shade } from "./politics/layout";
import { ColourPicker } from "./politics/oil";
import { SuggestButton, type Suggest } from "./Suggestions";

/** How much of the remit the player writes before the game master is asked to edit it. */
const REMIT_FIRST = 12;
import type { GameState } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";

/**
 * The cabinet's shape, under the ministries: close the ministry on screen
 * (not the chief of staff's office, not the player's own), reopen one closed,
 * or create a new one with a name and a portfolio while the cabinet has fewer
 * than twelve – the game master's drafts of the remit on a spark, the icon
 * picked from a list that opens on its button, and a minister of the
 * player's choosing beside it to consult. Each change is the engine's
 * (engine/ministries.ts) and waits for the next game master.
 */
export default function MinistryShape({ state, advisor, disabled, onChange, onPick, onSuggest, onAsk, asking }: {
  state: GameState;
  advisor: AdvisorId;
  disabled: boolean;
  onChange: (next: GameState) => void;
  onPick: (id: AdvisorId) => void;
  /** Drafts of the new ministry's remit from the game master (engine/suggest.ts); missing without one. */
  onSuggest?: Suggest;
  /** Ask a minister, the draft of the new ministry given as the context; missing where the cabinet cannot be asked. */
  onAsk?: (advisor: AdvisorId, question: string, context?: string) => Promise<boolean>;
  /** The minister whose answer is being written, if any. */
  asking?: AdvisorId | null;
}) {
  const { t, text } = useI18n();
  const [closing, setClosing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [icon, setIcon] = useState<MinistryIconKey>("briefcase");
  const [icons, setIcons] = useState(false);
  const [why, setWhy] = useState<string | null>(null);
  // The description corrected by the game master on the spark, in place; the player's own words kept to go back to.
  const [correcting, setCorrecting] = useState(false);
  const [before, setBefore] = useState<string | null>(null);
  const [tasks, setTasks] = useState<string[]>([]);
  const [task, setTask] = useState("");
  const [colour, setColour] = useState<string | null>(null);
  const [colours, setColours] = useState(false);
  // The minister consulted on the new ministry, and where their conversation stood when they were asked.
  const [adviser, setAdviser] = useState<AdvisorId>("chief");
  const [question, setQuestion] = useState("");
  const [askedFrom, setAskedFrom] = useState<number | null>(null);
  const open = openMinistries(state);
  const closed = closedMinistries(state);
  const own = state.role?.kind === "minister" && state.role.post === ADVISOR_POST[advisor];
  const canClose = advisor !== "chief" && !own;
  const full = open.length >= MAX_MINISTRIES;
  const minister = state.officials?.find((o) => o.post === ADVISOR_POST[advisor]);
  const label = (id: AdvisorId) => text(ministryTitle(state, id));

  const close = () => {
    setCreating(false);
    setName("");
    setPortfolio("");
    setIcon("briefcase");
    setIcons(false);
    setWhy(null);
    setBefore(null);
    setTasks([]);
    setTask("");
    setColour(null);
    setQuestion("");
    setAskedFrom(null);
  };
  const Chosen = MINISTRY_ICON_SET[icon];
  // The correction waits for the player's own words.
  const written = portfolio.trim().length >= REMIT_FIRST;
  const correct = async () => {
    if (!onSuggest || correcting) return;
    setCorrecting(true);
    try {
      const [line] = await onSuggest({ kind: "portfolio", name: name.trim(), text: portfolio.trim(), ...(tasks.length ? { tasks } : {}) });
      if (line && line !== portfolio.trim()) {
        setBefore(portfolio);
        setPortfolio(line.slice(0, PORTFOLIO_CHARS));
      }
    } catch {
      // No correction came: the player's words stand.
    } finally {
      setCorrecting(false);
    }
  };
  const addTask = () => {
    const next = cleanTasks([...tasks, task]);
    if (next.length === tasks.length) return;
    setTasks(next);
    setTask("");
  };
  const advisers = open.filter((id) => officialAt(state, ADVISOR_POST[id]));
  const adviserPerson = officialAt(state, ADVISOR_POST[adviser]);
  const answers = askedFrom === null ? [] : (state.advice?.[adviser] ?? []).slice(askedFrom).filter((m) => m.from !== "player");
  const consult = async () => {
    if (!onAsk) return;
    const q = question.trim() || t("ministry.advice.default");
    const context = [
      "The government is thinking of creating a new ministry and asks the minister's advice on it.",
      name.trim() ? `Its name: "${name.trim()}".` : "It has no name yet.",
      portfolio.trim() ? `Its remit in the player's words: ${portfolio.trim()}` : "Its remit is not written yet.",
      `The cabinet now: ${open.map((id) => text(ministryTitle(state, id))).join(", ")}.`,
    ].join("\n");
    const from = state.advice?.[adviser]?.length ?? 0;
    if (await onAsk(adviser, q, context)) {
      setAskedFrom(from);
      setQuestion("");
    }
  };
  const create = () => {
    const result = createMinistry(state, name, portfolio, undefined, tasks);
    if (result.why || !result.id) {
      setWhy(t(`ministry.why.${result.why ?? "full"}` as MessageKey));
      return;
    }
    // The icon chosen with it, the interface's own (engine/ministries.ts setMinistryIcon).
    onChange(setMinistryColour(setMinistryIcon(result.state, result.id, icon), result.id, colour));
    onPick(result.id);
    close();
  };

  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {canClose && (
          <button type="button" disabled={disabled} onClick={() => setClosing(true)} className={`${ui.secondary} px-3 py-1.5 text-2xs`} title={t("ministry.close.hint")}>
            <Trash2 className="h-3.5 w-3.5" />
            {t("ministry.close")}
          </button>
        )}
        <button type="button" disabled={disabled || full} onClick={() => setCreating(true)} className={`${ui.secondary} px-3 py-1.5 text-2xs`} title={full ? t("ministry.why.full") : t("ministry.create.hint")}>
          <Plus className="h-3.5 w-3.5" />
          {t("ministry.create")}
        </button>
        <span className="ml-auto text-2xs font-bold tabular-nums text-muted">{t("ministry.count", { n: open.length, max: MAX_MINISTRIES })}</span>
      </div>
      {closed.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-2xs font-bold text-muted">{t("ministry.closed")}</span>
          {closed.map((id) => (
            <button
              key={id}
              type="button"
              disabled={disabled || full}
              onClick={() => {
                const result = reopenMinistry(state, id);
                if (result.why) return;
                onChange(result.state);
                onPick(id);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-2xs font-bold text-ink transition-colors hover:bg-page disabled:opacity-50"
              title={t("ministry.reopen.hint")}
            >
              <RotateCcw className="h-3 w-3" />
              {t(`post.${id}` as MessageKey)}
            </button>
          ))}
        </div>
      )}

      <Dialog
        open={closing}
        onClose={() => setClosing(false)}
        title={t("ministry.close.title", { name: label(advisor) })}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setClosing(false)} className={`${ui.secondary} px-4 py-2 text-xs`}>
              {t("ministry.cancel")}
            </button>
            <button
              type="button"
              disabled={disabled || !canClose}
              onClick={() => {
                const result = closeMinistry(state, advisor);
                setClosing(false);
                if (result.why) return;
                onChange(result.state);
                onPick("chief");
              }}
              className={`${ui.primary} px-4 py-2 text-xs`}
            >
              <Trash2 className="h-4 w-4" />
              {t("ministry.close")}
            </button>
          </div>
        }
      >
        <p className="text-sm font-medium leading-relaxed text-ink">{t(minister ? "ministry.close.body" : "ministry.close.bodyVacant", { name: minister?.name ?? "" })}</p>
      </Dialog>

      <Dialog
        open={creating}
        onClose={close}
        wide
        title={t("ministry.create.title")}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={close} className={`${ui.secondary} px-4 py-2 text-xs`}>
              {t("ministry.cancel")}
            </button>
            <button type="button" disabled={disabled || !name.trim()} onClick={create} className={`${ui.primary} px-4 py-2 text-xs`}>
              <Building2 className="h-4 w-4" />
              {t("ministry.create")}
            </button>
          </div>
        }
      >
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="new-ministry-name" className={ui.label}>
                {t("ministry.name")}
              </label>
              <div className="flex items-stretch gap-2">
                <div className="min-w-0 flex-1">
                  <Dictation id="ministry-name" inline set={setName} max={MINISTRY_NAME_CHARS}>
                    <input id="new-ministry-name" value={name} maxLength={MINISTRY_NAME_CHARS} onChange={(e) => setName(e.target.value)} placeholder={t("ministry.name.placeholder")} className={`${ui.input} px-3 py-2 text-sm`} />
                  </Dictation>
                </div>
                <button type="button" onClick={() => setIcons(true)} title={t("ministry.icon.pick")} aria-label={t("ministry.icon.pick")} className="grid w-11 shrink-0 place-items-center rounded-xl bg-ink text-on-ink transition-opacity hover:opacity-85" style={colour ? { background: paintTone(colour) } : undefined}>
                  <Chosen className="h-5 w-5" />
                </button>
                {/* The colour: a plain painted disc, as in its picker; the palette's wheel until one is chosen. */}
                <button
                  type="button"
                  onClick={() => setColours(true)}
                  title={t("ministry.colour.pick")}
                  aria-label={t("ministry.colour.pick")}
                  className="h-9 w-9 shrink-0 self-center rounded-full border border-shade/30 shadow-sm transition-transform hover:scale-110"
                  style={{ background: colour ? `radial-gradient(circle at 35% 30%, ${shade(paintTone(colour), 0.25)}, ${paintTone(colour)} 60%, ${shade(paintTone(colour), -0.25)})` : "conic-gradient(#c62828, #e3b505, #2e8b3e, #1aa3a3, #1f4e9b, #6a3d9a, #c62828)" }}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="new-ministry-remit" className={ui.label}>
                {t("ministry.portfolio")}
              </label>
              {/* The game master's edits once the player has said what the ministry is for: something to add, to cut, the same said better. */}
              <Dictation
                id="ministry-remit"
                set={setPortfolio}
                max={PORTFOLIO_CHARS}
                spark={
                  // Nothing to correct in an empty box: the spark comes once the player has written the description.
                  onSuggest && written && <SuggestButton hint={t("ministry.portfolio.suggest")} asking={correcting} onClick={() => void correct()} />
                }
              >
                <textarea id="new-ministry-remit" value={portfolio} maxLength={PORTFOLIO_CHARS} rows={3} onChange={(e) => { setPortfolio(e.target.value); setBefore(null); }} placeholder={t("ministry.portfolio.placeholder")} className={`${ui.input} resize-none px-3 py-2 text-sm`} />
              </Dictation>
              {before !== null && (
                <button type="button" onClick={() => { setPortfolio(before); setBefore(null); }} className="w-fit text-2xs font-bold text-muted underline decoration-dotted underline-offset-2 hover:text-ink">
                  {t("ministry.portfolio.undo")}
                </button>
              )}
            </div>
            {/* The ministry's tasks, the player's own, told to its minister and the game master with the description. */}
            <div className="flex flex-col gap-1.5">
              <span className={ui.label}>{t("ministry.tasks")}</span>
              {tasks.length > 0 && (
                <ol className="flex flex-col gap-1">
                  {tasks.map((line, i) => (
                    <li key={line} className="flex items-start gap-2 rounded-lg bg-page px-2.5 py-1.5">
                      <span className="mt-px w-4 shrink-0 text-2xs font-black tabular-nums text-muted">{i + 1}.</span>
                      <span className="min-w-0 flex-1 text-xs font-medium leading-snug text-ink">{line}</span>
                      <button type="button" onClick={() => setTasks(tasks.filter((x) => x !== line))} title={t("ministry.tasks.remove")} aria-label={t("ministry.tasks.remove")} className="-m-0.5 shrink-0 rounded-md p-0.5 text-muted hover:bg-warm hover:text-ink">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ol>
              )}
              {tasks.length < MAX_MINISTRY_TASKS && (
                <div className="flex items-stretch gap-2">
                  <div className="min-w-0 flex-1">
                    <Dictation id="ministry-task" inline set={setTask} max={TASK_CHARS}>
                      <input
                        value={task}
                        maxLength={TASK_CHARS}
                        onChange={(e) => setTask(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                            e.preventDefault();
                            addTask();
                          }
                        }}
                        placeholder={t("ministry.tasks.placeholder")}
                        className={`${ui.input} px-3 py-2 text-xs`}
                      />
                    </Dictation>
                  </div>
                  <button type="button" disabled={!task.trim()} onClick={addTask} title={t("ministry.tasks.add")} aria-label={t("ministry.tasks.add")} className={`${ui.secondary} w-10 shrink-0`}>
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
            <p className="text-xs font-medium text-muted">{t("ministry.create.body")}</p>
            {why && <p className="text-xs font-bold text-red-600">{why}</p>}
          </div>

          {/* A minister to consult on the new ministry: their portrait, their answer, the question to them. */}
          {onAsk && (
            <aside className="flex min-w-0 flex-col gap-2.5 rounded-2xl bg-page p-3">
              <span className={ui.label}>{t("ministry.advice")}</span>
              <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={t("ministry.advice.who")}>
                {advisers.map((id) => {
                  const o = officialAt(state, ADVISOR_POST[id])!;
                  return (
                    <button key={id} type="button" role="radio" aria-checked={adviser === id} title={`${o.name} · ${label(id)}`} onClick={() => { setAdviser(id); setAskedFrom(null); }} className={`rounded-full transition-shadow ${adviser === id ? "ring-2 ring-accent" : "opacity-70 hover:opacity-100"}`}>
                      <Portrait portrait={o.portrait} gender={o.gender} name={o.name} size="xs" />
                    </button>
                  );
                })}
              </div>
              {adviserPerson && (
                <div className="flex items-center gap-2.5">
                  <Portrait portrait={adviserPerson.portrait} gender={adviserPerson.gender} name={adviserPerson.name} size="md" />
                  <div className="min-w-0">
                    <div className="text-sm font-black leading-tight text-ink">{adviserPerson.name}</div>
                    <div className="mt-0.5 text-2xs font-bold leading-snug text-muted">{label(adviser)}</div>
                  </div>
                </div>
              )}
              {answers.map((m, i) => (
                <p key={i} className="max-h-48 overflow-y-auto rounded-xl border border-line sheet p-2.5 text-xs font-medium leading-relaxed text-ink">
                  {m.text}
                </p>
              ))}
              {asking === adviser && (
                <p className="flex items-center gap-2 text-2xs font-bold text-muted">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
                  {t("ministry.advice.thinking")}
                </p>
              )}
              <Dictation id="ministry-advice" set={setQuestion}>
                <textarea value={question} rows={2} onChange={(e) => setQuestion(e.target.value)} placeholder={t("ministry.advice.placeholder")} className={`${ui.input} resize-none px-2.5 py-2 text-xs`} />
              </Dictation>
              <button type="button" disabled={disabled || Boolean(asking)} onClick={() => void consult()} className={`${ui.secondary} px-3 py-2 text-xs`}>
                <MessagesSquare className="h-4 w-4" />
                {t("ministry.advice.send")}
              </button>
            </aside>
          )}
        </div>
      </Dialog>

      <Dialog open={colours} onClose={() => setColours(false)} title={t("ministry.colour.pick")}>
        <ColourPicker
          chosen={colour ?? undefined}
          labels={{ colour: t("ministry.colour"), palette: t("politics.colour.palette"), usual: t("ministry.colour.none") }}
          onColour={(hex) => {
            setColour(hex);
            setColours(false);
          }}
        />
      </Dialog>

      <Dialog open={icons} onClose={() => setIcons(false)} title={t("ministry.icon.pick")}>
        <IconPicker
          value={icon}
          label={t("ministry.icon")}
          onPick={(next) => {
            setIcon(next);
            setIcons(false);
          }}
        />
      </Dialog>
    </section>
  );
}

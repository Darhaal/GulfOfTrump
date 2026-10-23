"use client";

import { Crosshair, Eye, Shield, Swords, X, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { ui } from "@/components/ui/classes";
import { ADVISOR_TITLES, MAX_DIRECTIVES, OPERATION_MINISTRIES, planOperation, type AdvisorId } from "@/engine/advisors";
import { formatDate } from "@/engine/calendar";
import { ADVISOR_POST, officialAt } from "@/engine/government";
import type { Directive, DirectiveStatus, GameState, Operation } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";

const ICONS: Partial<Record<AdvisorId, LucideIcon>> = { military: Swords, intelligence: Eye, interior: Shield };
const SECRECY: Operation["secrecy"][] = ["open", "covert", "deniable"];
const SECRECY_TONE: Record<Operation["secrecy"], string> = { open: "bg-page text-muted", covert: "bg-amber-50 text-amber-700", deniable: "bg-red-50 text-red-700" };
const STATUS_TONE: Record<DirectiveStatus["status"], string> = { done: "bg-emerald-50 text-emerald-700", failed: "bg-red-50 text-red-700", progress: "bg-amber-50 text-amber-700" };
/** How many finished operations stay in view. */
const FINISHED = 8;

type Draft = Omit<Operation, "secrecy"> & { secrecy: Operation["secrecy"] };
const EMPTY: Draft = { name: "", target: "", goal: "", means: "", timing: "", secrecy: "covert" };

/** A ready outline the player starts from: it fills the form, nothing more. */
interface Outline {
  key: string;
  ministry: AdvisorId;
  label: string;
  draft: Partial<Draft>;
}

/**
 * The government's special operations, beside its orders: those under way
 * and those finished, by the ministry that runs them, and a form to plan a
 * new one – the same fields a minister's proposal has. Approving it starts it
 * as a standing directive (engine/advisors.ts planOperation), carried out by
 * the game master turn by turn until it succeeds or fails. The outlines from
 * the street (stirring up protests abroad, using one, foiling a plot at home)
 * only fill the form; the player decides what goes in it.
 */
export default function OperationsPanel({
  state,
  disabled,
  onDirectives,
  onConsult,
}: {
  state: GameState;
  disabled: boolean;
  onDirectives: (directives: Directive[]) => void;
  /** Opens the cabinet on this minister, to plan it in conversation. */
  onConsult: (advisor: AdvisorId) => void;
}) {
  const { t, text, locale } = useI18n();
  const [ministry, setMinistry] = useState<AdvisorId>("intelligence");
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [problem, setProblem] = useState<string | null>(null);
  const directives = state.directives ?? [];
  const running = directives.filter((d) => d.operation);
  const full = directives.length >= MAX_DIRECTIVES;

  // The last word on each running operation, and the operations the game master closed, newest first.
  const latest = new Map<string, DirectiveStatus>();
  const finished: (DirectiveStatus & { date: string; ministry: AdvisorId })[] = [];
  for (const entry of [...state.chronicle].reverse()) {
    for (const brief of entry.briefs ?? []) {
      for (const d of brief.directives) {
        if (!latest.has(d.id)) latest.set(d.id, d);
        if (d.operation && d.status !== "progress" && finished.length < FINISHED && !finished.some((f) => f.id === d.id)) finished.push({ ...d, date: entry.to, ministry: brief.ministry });
      }
    }
  }

  const country = (tag: string | undefined) => (tag ? text(state.countries[tag]?.name ?? tag) : "");
  const outlines: Outline[] = [
    { key: "incite", ministry: "intelligence", label: t("ops.tpl.incite.name"), draft: { name: t("ops.tpl.incite.name"), goal: t("ops.tpl.incite.goal"), secrecy: "deniable" } },
    // Protests at home are the street's business (Politics); only those abroad can be used.
    ...(state.protests ?? [])
      .filter((p) => p.country && p.country !== state.player)
      .map((p): Outline => ({
        key: `protest-${p.id}`,
        ministry: "intelligence",
        label: t("ops.tpl.protest.name", { title: p.title }),
        draft: { name: t("ops.tpl.protest.name", { title: p.title }), target: country(p.country), goal: t("ops.tpl.protest.goal"), secrecy: "covert" },
      })),
    ...(state.politics?.plots ?? [])
      .filter((p) => p.known)
      .map((p): Outline => ({
        key: `plot-${p.id}`,
        ministry: "interior",
        label: t("ops.tpl.foil.name", { title: p.title }),
        draft: { name: t("ops.tpl.foil.name", { title: p.title }), target: p.title, goal: t("ops.tpl.foil.goal"), secrecy: "covert" },
      })),
  ];

  const start = () => {
    const next = planOperation(state, ministry, draft, (o) => t("op.text", { name: o.name, goal: o.goal }));
    if (!next) {
      setProblem(full ? t("ops.full", { n: MAX_DIRECTIVES }) : draft.name.trim() ? t("ops.duplicate") : t("ops.needName"));
      return;
    }
    onDirectives(next);
    setDraft(EMPTY);
    setProblem(null);
  };
  const field = (key: "target" | "goal" | "means" | "timing", rows = 1) => (
    <label className="grid gap-1">
      <span className="text-2xs font-black uppercase tracking-wider text-muted">{t(`op.${key}` as MessageKey)}</span>
      <textarea
        rows={rows}
        value={draft[key]}
        maxLength={key === "target" ? 200 : key === "timing" ? 120 : 400}
        disabled={disabled}
        onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
        placeholder={t(`ops.placeholder.${key}` as MessageKey)}
        className={`${ui.input} resize-none py-2 text-xs`}
      />
    </label>
  );
  const minister = officialAt(state, ADVISOR_POST[ministry]);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs font-medium leading-relaxed text-muted">{t("ops.intro")}</p>

      <section>
        <div className={`${ui.label} mb-2`}>{t("ops.running")}</div>
        {running.length === 0 ? (
          <p className="rounded-xl border-2 border-dashed border-line px-4 py-4 text-center text-xs font-medium text-muted">{t("ops.none")}</p>
        ) : (
          <ul className="grid gap-2">
            {running.map((d) => {
              const o = d.operation!;
              const word = latest.get(d.id);
              const Icon = ICONS[d.ministry] ?? Crosshair;
              return (
                <li key={d.id} className="rounded-xl border border-line sheet p-3">
                  <div className="flex items-start gap-2">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-black leading-snug text-ink">{o.name}</div>
                      <div className="text-2xs font-bold text-muted">
                        {text(ADVISOR_TITLES[d.ministry])} · {t("ops.since", { date: formatDate(d.since, locale) })}
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-2xs font-black uppercase tracking-wider ${SECRECY_TONE[o.secrecy]}`}>{t(`op.secrecy.${o.secrecy}` as MessageKey)}</span>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => onDirectives(directives.filter((x) => x.id !== d.id))}
                      title={t("ops.withdraw")}
                      aria-label={t("ops.withdraw")}
                      className="-m-1 rounded-lg p-1 text-muted hover:bg-red-50 hover:text-red-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  {(o.target || o.goal) && (
                    <p className="mt-1.5 text-xs font-medium leading-snug text-ink">
                      {o.target && <span className="font-bold">{o.target}: </span>}
                      {o.goal}
                    </p>
                  )}
                  {word?.note && (
                    <p className="mt-1.5 text-xs font-medium text-muted">
                      <span className={`mr-1.5 rounded px-1.5 py-0.5 text-2xs font-black uppercase tracking-wider ${STATUS_TONE[word.status]}`}>{t(`cabinet.status.${word.status}` as MessageKey)}</span>
                      {word.note}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {finished.length > 0 && (
        <section>
          <div className={`${ui.label} mb-2`}>{t("ops.finished")}</div>
          <ul className="grid gap-1.5">
            {finished.map((d) => (
              <li key={d.id} className="rounded-xl bg-page px-3 py-2 text-xs font-medium text-muted">
                <span className={`mr-1.5 rounded px-1.5 py-0.5 text-2xs font-black uppercase tracking-wider ${STATUS_TONE[d.status]}`}>{t(`cabinet.status.${d.status}` as MessageKey)}</span>
                <span className="font-bold text-ink">{d.text}</span>
                {d.note && ` – ${d.note}`}
                <span className="ml-1 whitespace-nowrap text-2xs">({formatDate(d.date, locale)})</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-xl border border-line sheet p-3">
        <div className={`${ui.label} mb-2`}>{t("ops.new")}</div>

        <div className="grid grid-cols-3 gap-1 rounded-xl bg-page p-1" role="radiogroup" aria-label={t("ops.ministry")}>
          {OPERATION_MINISTRIES.map((m) => {
            const Icon = ICONS[m] ?? Crosshair;
            return (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={m === ministry}
                onClick={() => setMinistry(m)}
                title={text(ADVISOR_TITLES[m])}
                className={`${ui.segment} flex min-w-0 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-center text-2xs leading-tight ${m === ministry ? `${ui.segmentOn} bg-surface shadow-sm` : ui.segmentOff}`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="break-words">{t(`post.${ADVISOR_POST[m]}` as MessageKey)}</span>
              </button>
            );
          })}
        </div>

        {outlines.some((o) => o.ministry === ministry) && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {outlines
              .filter((o) => o.ministry === ministry)
              .map((o) => (
                <button
                  key={o.key}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    setDraft({ ...EMPTY, ...o.draft });
                    setProblem(null);
                  }}
                  className="rounded-lg border border-line px-2 py-1 text-2xs font-bold text-muted transition-colors hover:border-accent/30 hover:text-ink"
                >
                  {o.label}
                </button>
              ))}
          </div>
        )}

        <div className="mt-3 grid gap-2.5">
          <label className="grid gap-1">
            <span className="text-2xs font-black uppercase tracking-wider text-muted">{t("ops.name")}</span>
            <input
              value={draft.name}
              maxLength={120}
              disabled={disabled}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder={t("ops.placeholder.name")}
              className={`${ui.input} py-2 text-xs`}
            />
          </label>
          {field("target")}
          {field("goal", 2)}
          {field("means", 2)}
          {field("timing")}
          <div className="grid gap-1">
            <span className="text-2xs font-black uppercase tracking-wider text-muted">{t("op.secrecy")}</span>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-page p-1" role="radiogroup" aria-label={t("op.secrecy")}>
              {SECRECY.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={draft.secrecy === s}
                  onClick={() => setDraft({ ...draft, secrecy: s })}
                  className={`${ui.segment} px-1.5 py-1.5 text-2xs ${draft.secrecy === s ? `${ui.segmentOn} bg-surface shadow-sm` : ui.segmentOff}`}
                >
                  {t(`op.secrecy.${s}` as MessageKey)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {problem && <p className="mt-2 text-xs font-bold text-war">{problem}</p>}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <button type="button" onClick={() => onConsult(ministry)} className="inline-flex items-center gap-1.5 text-2xs font-bold text-muted hover:text-ink">
            {minister ? t("ops.consult.named", { name: minister.name }) : t("ops.consult.minister")}
          </button>
          <button type="button" disabled={disabled || full || !draft.name.trim()} onClick={start} className={`${ui.primary} px-4 py-2 text-xs`}>
            {t("ops.start")}
          </button>
        </div>
        {full && <p className="mt-1.5 text-2xs font-medium text-muted">{t("ops.full", { n: MAX_DIRECTIVES })}</p>}
      </section>
    </div>
  );
}

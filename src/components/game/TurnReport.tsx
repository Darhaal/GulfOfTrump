"use client";

import { Banknote, Check, ChevronDown, CircleDashed, Crosshair, Globe, Handshake, Landmark, Loader2, Newspaper, ScrollText, Shield, Swords, TrendingUp, TriangleAlert, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { ui } from "@/components/ui/classes";
import SpeakButton from "@/components/voice/SpeakButton";
import { formatDate, formatMonth, yearOf } from "@/engine/calendar";
import { turnSpeechId } from "@/lib/voice/speaker";
import { turnSpeech } from "@/lib/voice/text";
import { regionLabel } from "@/engine/provinces";
import type { AppliedChange, ChronicleEntry, EventKind, GameState, MapIndex, MinistryBrief, MinistryReport, Verdict } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import { forNew, type AdvisorId } from "@/engine/advisors";
import { ADVISOR_POST } from "@/engine/government";
import { personFor, samePerson } from "@/engine/people";
import type { TurnStage } from "@/engine/stages";
import { DirectiveList, StanceChip, type ReportStatus } from "./CabinetPanel";
import { MINISTRY_ICON_SET } from "./ministryIcons";
import Portrait from "./Portrait";
import { describeChange, frontCounts, groupTerritory, REPORT_STAGES, reportStage, sortChanges, type ReportStage } from "./changes";
import { RoutineList } from "./MinisterRoutine";
import { useUnitName } from "./army/common";
import { ministryIcon, ministryTitle } from "@/engine/ministries";

const KIND_ICON: Record<EventKind, typeof Newspaper> = {
  war: Swords,
  diplomacy: Handshake,
  politics: Landmark,
  economy: TrendingUp,
  military: Shield,
  disaster: TriangleAlert,
  other: Newspaper,
};

const VERDICT_STYLE: Record<Verdict, { icon: typeof Check; chip: string }> = {
  success: { icon: Check, chip: "bg-emerald-50 text-emerald-700" },
  partial: { icon: CircleDashed, chip: "bg-amber-50 text-amber-700" },
  failed: { icon: X, chip: "bg-red-50 text-red-700" },
};

/** Each stage after the story: its title and icon. */
const STAGE_HEAD: Record<ReportStage, { title: MessageKey; icon: typeof Newspaper }> = {
  politics: { title: "report.stage.politics", icon: Landmark },
  economy: { title: "report.economy", icon: Banknote },
  army: { title: "report.stage.army", icon: Crosshair },
  world: { title: "report.stage.world", icon: Globe },
};

/** The stage each minister's view is told in. */
const MINISTRY_STAGE: Record<AdvisorId, ReportStage> = {
  chief: "politics",
  interior: "politics",
  finance: "economy",
  industry: "economy",
  science: "economy",
  space: "economy",
  military: "army",
  foreign: "world",
  intelligence: "world",
  // The ministries the government created speak with politics at home.
  ...forNew<ReportStage>("politics"),
};

/** Who gave a view: the minister in office if it is still them, else the name the view keeps. */
function speakerOf(state: GameState, entry: ChronicleEntry, ministry: AdvisorId, by?: string) {
  const o = state.officials?.find((x) => x.post === ADVISOR_POST[ministry] && (!by || samePerson(x.name, by)));
  if (o) return { name: o.name, portrait: o.portrait, gender: o.gender };
  if (!by) return undefined;
  const p = personFor(by, yearOf(entry.to));
  return { name: p.name, portrait: p.portrait, gender: p.gender };
}

/** One minister's view of the turn: their portrait, their name and a paragraph in their own words. */
function MinisterView({ state, entry, report, compact }: { state: GameState; entry: ChronicleEntry; report: MinistryReport; compact?: boolean }) {
  const { t, text } = useI18n();
  const Icon = MINISTRY_ICON_SET[ministryIcon(state, report.ministry)];
  const who = speakerOf(state, entry, report.ministry, report.by);
  return (
    <figure className="flex items-start gap-3 rounded-xl bg-page p-3">
      {who ? <Portrait portrait={who.portrait} gender={who.gender} name={who.name} size="md" /> : <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted" />}
      <div className="min-w-0 flex-1">
        <figcaption className="flex items-center gap-2">
          <span className="min-w-0 flex-1 leading-tight">
            {who && <span className="block truncate text-xs font-black text-ink">{who.name}</span>}
            <span className={`block truncate text-2xs font-bold ${who ? "text-muted" : "text-ink"}`}>{text(ministryTitle(state, report.ministry))}</span>
          </span>
          {report.stance && report.stance !== "loyal" && <StanceChip stance={report.stance} />}
          <SpeakButton id={`report-${entry.turn}-${report.ministry}`} text={report.text} who={{ name: who?.name ?? report.by ?? report.ministry, gender: who?.gender }} className="-my-1" />
        </figcaption>
        <blockquote className={`mt-1.5 text-sm font-medium leading-relaxed text-ink/90 ${compact ? "line-clamp-3" : ""}`}>{t("report.quote", { text: report.text })}</blockquote>
        <DirectiveList directives={report.directives} />
      </div>
    </figure>
  );
}

/** A ministry whose view has not come (yet): what became of its directives meanwhile. */
function UnheardMinistry({ state, brief, writing }: { state: GameState; brief: MinistryBrief; writing: boolean }) {
  const { t, text } = useI18n();
  const Icon = MINISTRY_ICON_SET[ministryIcon(state, brief.ministry)];
  if (brief.quiet) {
    return (
      <div className="rounded-xl border border-line px-3 py-2">
        <div className="flex items-center gap-2 text-xs font-black text-muted">
          <Icon className="h-3.5 w-3.5" />
          {text(ministryTitle(state, brief.ministry))}
        </div>
        <DirectiveList directives={brief.directives} />
      </div>
    );
  }
  return (
    <div className="rounded-xl bg-page px-3 py-2">
      <div className="flex items-center gap-2 text-xs font-black text-ink">
        <Icon className="h-3.5 w-3.5 text-muted" />
        {text(ministryTitle(state, brief.ministry))}
      </div>
      <p className="mt-1.5 flex items-center gap-2 text-xs font-medium text-muted">
        {writing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {writing ? t("report.writing") : t("report.missing")}
      </p>
      <DirectiveList directives={brief.directives} />
    </div>
  );
}

/**
 * One stage of the turn: a header that folds it, with a one-line summary
 * while folded, and its content when open. A stage still being written shows
 * a spinner and what it waits for, and does not open.
 */
function Stage({ icon: Icon, title, summary, count, defaultOpen, busy, children }: { icon: typeof Newspaper; title: string; summary: string; count?: number; defaultOpen?: boolean; busy?: boolean; children?: ReactNode }) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  const shown = open && !busy;
  return (
    <section className="rounded-xl border border-line" aria-busy={busy || undefined}>
      <button type="button" onClick={() => setOpen((v) => !v)} disabled={busy} aria-expanded={shown} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-page disabled:cursor-default disabled:hover:bg-transparent">
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted" />
        <span className={`${ui.label} shrink-0`}>{title}</span>
        {/* No width of its own (w-0): a long summary truncates instead of widening a narrow panel. */}
        <span className="w-0 min-w-0 flex-1 truncate text-xs font-medium text-muted">{shown ? "" : summary}</span>
        {!busy && count !== undefined && count > 0 && !shown && <span className="shrink-0 rounded-md bg-page px-1.5 py-0.5 text-2xs font-black tabular-nums text-muted">{count}</span>}
        {busy ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted" /> : <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted transition-transform ${shown ? "rotate-180" : ""}`} />}
      </button>
      {shown && <div className="grid gap-2 border-t border-divider px-3 pb-3 pt-2.5">{children}</div>}
    </section>
  );
}

/** Lines of what changed, with the minor ones (the numbers) folded behind "N more". */
function ChangeList({ lines, folded }: { lines: string[]; folded: string[] }) {
  const { t } = useI18n();
  const [all, setAll] = useState(false);
  if (!lines.length && !folded.length) return null;
  return (
    <div>
      <ul className="grid gap-1">
        {lines.map((line, i) => (
          <li key={`n${i}`} className="rounded-lg bg-page px-3 py-1.5 text-xs font-bold text-ink">
            {line}
          </li>
        ))}
        {all &&
          folded.map((line, i) => (
            <li key={`f${i}`} className="rounded-lg px-3 py-1 text-xs font-medium text-muted">
              {line}
            </li>
          ))}
      </ul>
      {folded.length > 0 && (
        <button type="button" onClick={() => setAll((v) => !v)} className="mt-1.5 px-3 text-2xs font-black uppercase tracking-wider text-muted hover:text-accent">
          {all ? t("game.statsLess") : t("game.statsMore", { n: folded.length })}
        </button>
      )}
    </div>
  );
}

/** How many province names a grouped line spells out before "+N". */
const NAMES_PER_LINE = 6;

/**
 * One turn told in stages, so it reads a step at a time: the story (the
 * narrative and the orders judged), then politics at home, the economy, the
 * army and the world, each folded to a line until opened. What the top bar
 * shows (the economy's figures) is not repeated, and the fronts' changes come
 * as one count, told in full by the army tab and the map.
 */
export default function TurnReport({
  entry,
  state,
  index,
  compact,
  reporting,
  pending,
  onArmy,
}: {
  entry: ChronicleEntry;
  state: GameState;
  index: MapIndex | null;
  compact?: boolean;
  /** The ministers' reports on the last turn still being written. */
  reporting?: Partial<Record<AdvisorId, ReportStatus>>;
  /** A turn not yet applied: the stages still being written (engine/stages.ts); what changed comes with the turn. */
  pending?: TurnStage[];
  /** Opens the army tab, where the fronts are told. */
  onArmy?: () => void;
}) {
  const { t, text, locale } = useI18n();
  const unitName = useUnitName();
  // Views come after the turn; the ministers still owing one, and the quiet ones, show what became of their directives meanwhile.
  const reports = entry.reports ?? [];
  const unheard = (entry.briefs ?? []).filter((b) => !reports.some((r) => r.ministry === b.ministry) && (!b.quiet || b.directives.length > 0));
  const latestTurn = state.chronicle.at(-1)?.turn === entry.turn;
  // In the chronicle the story folds to its first paragraph; the orders stay in view.
  const [fullText, setFullText] = useState(!compact);
  const paragraphs = entry.narrative.split(/\n{1,}/).filter(Boolean);
  const name = (tag: string) => text(state.countries[tag]?.name ?? tag);
  const region = (id: string) => regionLabel(id, index, locale);
  const describe = (c: AppliedChange) => describeChange(c, state, t, text, region, (iso) => formatDate(iso, locale), (iso) => formatMonth(iso, locale));
  const verdictOf = (n: number) => entry.verdicts?.find((v) => v.n === n);

  // What changed, by stage; the numbers (stat swings) fold away, the fronts become one count.
  const atWar = state.wars.some((w) => w.attackers.includes(state.player) || w.defenders.includes(state.player));
  const staged: Record<ReportStage, { lines: string[]; folded: string[] }> = { politics: { lines: [], folded: [] }, economy: { lines: [], folded: [] }, army: { lines: [], folded: [] }, world: { lines: [], folded: [] } };
  const world: AppliedChange[] = [];
  for (const c of sortChanges(entry.applied)) {
    const stage = reportStage(c, state.player, atWar);
    if (!stage) continue;
    if (stage === "world") world.push(c);
    else (c.kind === "stats" ? staged[stage].folded : staged[stage].lines).push(describe(c));
  }
  // Borders redrawn by treaty, grouped by who gave land to whom.
  const { lines: worldLines, groups } = groupTerritory(world);
  for (const g of groups) {
    const names = g.regions.map(region);
    const shown = names.slice(0, NAMES_PER_LINE).join(", ") + (names.length > NAMES_PER_LINE ? ` +${names.length - NAMES_PER_LINE}` : "");
    staged.world.lines.push(t("change.annex", { region: shown, from: name(g.from), to: name(g.to) }));
  }
  for (const c of worldLines) (c.kind === "stats" ? staged.world.folded : staged.world.lines).push(describe(c));
  const fronts = frontCounts(entry.applied);
  const frontLine =
    fronts.taken || fronts.moved
      ? `${t("report.fronts")} – ${[fronts.taken ? t("report.fronts.taken", { n: fronts.taken }) : "", fronts.moved ? t("report.fronts.moved", { n: fronts.moved }) : ""].filter(Boolean).join("; ")}`
      : "";
  // What the general staff made of each order to the armies (engine/formations.ts).
  const armyOrders = (entry.sectors ?? []).flatMap((s) =>
    s.order ? [`${unitName(s)}: ${t("sectors.order", { order: t(`order.kind.${s.order.kind}` as MessageKey), fate: t(`order.fate.${s.order.fate}` as MessageKey) })}`] : [],
  );

  const views = (stage: ReportStage) => reports.filter((r) => MINISTRY_STAGE[r.ministry] === stage);
  // What each minister did on his own, told in his stage (engine/ministers.ts); one who acts only on orders is the cabinet's to show.
  const routineIn = (stage: ReportStage) => (entry.routine ?? []).filter((a) => MINISTRY_STAGE[a.ministry] === stage && a.held !== "toggle");
  const waiting = (stage: ReportStage) => unheard.filter((b) => MINISTRY_STAGE[b.ministry] === stage);

  const ok = entry.verdicts?.filter((v) => v.result === "success").length ?? 0;
  const partial = entry.verdicts?.filter((v) => v.result === "partial").length ?? 0;
  const failed = entry.verdicts?.filter((v) => v.result === "failed").length ?? 0;
  const storySummary = entry.verdicts?.length ? t("report.orders.summary", { ok, partial, failed }) : (paragraphs[0] ?? "");

  /** What a stage is waiting for while the turn is still being written; nothing once it is in. */
  const waitingFor = (stage: ReportStage): string | null => {
    if (!pending) return null;
    if (stage === "world") return pending.includes("world") ? t("report.pending.world") : null;
    if (stage === "army") return t("report.pending.changes");
    return t(pending.includes("home") ? "report.pending.home" : "report.pending.apply");
  };

  return (
    <article className="flex flex-col gap-3">
      <div>
        <div className={`${ui.label} tabular-nums`}>
          {t("game.turn", { n: entry.turn })} · {t("game.period", { from: formatDate(entry.from, locale), to: formatDate(entry.to, locale) })}
        </div>
        <div className="mt-1.5 flex items-start gap-2">
          <h3 className={`min-w-0 flex-1 font-black leading-tight tracking-tight text-ink ${compact ? "text-lg" : "text-2xl"}`}>{entry.headline}</h3>
          <SpeakButton id={turnSpeechId(entry.turn)} text={() => turnSpeech(entry)} label="voice.readTurn" className="mt-0.5" />
        </div>
      </div>

      <Stage icon={Newspaper} title={t("report.stage.story")} summary={storySummary} defaultOpen>
        <div className="space-y-3 text-sm font-medium leading-relaxed text-ink/90">
          {(fullText ? paragraphs : paragraphs.slice(0, 1)).map((p, i) => (
            <p key={i} className={fullText ? "" : "line-clamp-4"}>
              {p}
            </p>
          ))}
          {!fullText && paragraphs.length > 0 && (
            <button type="button" onClick={() => setFullText(true)} className="text-2xs font-black uppercase tracking-wider text-muted hover:text-accent">
              {t("report.readAll")}
            </button>
          )}
        </div>
        {entry.orders.length > 0 && (
          <div className="mt-1">
            <div className={`${ui.label} mb-2 flex items-center gap-1.5`}>
              <ScrollText className="h-3.5 w-3.5" />
              {t("game.yourOrders")}
            </div>
            <ol className="grid gap-1.5">
              {entry.orders.map((o, i) => {
                const v = verdictOf(i + 1);
                const style = v ? VERDICT_STYLE[v.result] : null;
                const Icon = style?.icon;
                return (
                  <li key={i} className="rounded-xl bg-page px-3 py-2">
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 w-4 shrink-0 text-2xs font-black text-muted tabular-nums">{i + 1}.</span>
                      <span className="min-w-0 flex-1 text-xs font-medium text-ink">{o}</span>
                      {v && style && Icon && (
                        <span className={`inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-2xs font-black uppercase tracking-wider ${style.chip}`}>
                          <Icon className="h-3 w-3" />
                          {t(`verdict.${v.result}` as MessageKey)}
                        </span>
                      )}
                    </div>
                    {v?.note && <p className="mt-1 pl-6 text-xs font-medium text-muted">{v.note}</p>}
                    {/* A ministry held by a disloyal faction carried it out half-heartedly (engine/intrigue.ts). */}
                    {v?.obstructed && v.by && <p className="mt-0.5 pl-6 text-2xs font-bold text-amber-700">{t("verdict.obstructed", { title: text(ministryTitle(state, v.by)) })}</p>}
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </Stage>

      {REPORT_STAGES.map((stage) => {
        const head = STAGE_HEAD[stage];
        const note = waitingFor(stage);
        if (note) return <Stage key={stage} icon={head.icon} title={t(head.title)} summary={note} busy />;
        // The world's news is in once its stage has landed, even while the rest of the turn is counted.
        const events = stage === "world" ? entry.events : [];
        const { lines, folded } = staged[stage];
        const said = views(stage);
        const owed = waiting(stage);
        const front = stage === "army" ? frontLine : "";
        const ordered = stage === "army" ? armyOrders : [];
        const routine = routineIn(stage);
        const count = lines.length + folded.length + said.length + events.length + (front ? 1 : 0) + ordered.length + routine.length;
        if (!count && !owed.length) return null;
        const summary = front || ordered[0] || lines[0] || events[0]?.title || (said[0] ? text(ministryTitle(state, said[0].ministry)) : "") || folded[0] || (owed[0] ? text(ministryTitle(state, owed[0].ministry)) : "") || (routine[0] ? t("routine.title") : "");
        return (
          <Stage key={stage} icon={head.icon} title={t(head.title)} summary={summary} count={count}>
            {front && (
              <p className="rounded-lg bg-page px-3 py-1.5 text-xs font-bold text-ink">
                {front} –{" "}
                {onArmy ? (
                  <button type="button" onClick={onArmy} className="font-black text-accent underline decoration-dotted underline-offset-2 hover:decoration-solid">
                    {t("report.fronts.see")}
                  </button>
                ) : (
                  t("report.fronts.see")
                )}
              </p>
            )}
            <ChangeList lines={[...ordered, ...lines]} folded={folded} />
            <RoutineList state={state} acts={routine} />
            {events.length > 0 && (
              <ul className="grid gap-2">
                {events.map((e, i) => {
                  const Icon = KIND_ICON[e.kind] ?? Newspaper;
                  return (
                    <li key={i} className="rounded-xl border border-line p-3">
                      <div className="flex items-start gap-2.5">
                        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                        <div className="min-w-0">
                          <div className="text-sm font-black text-ink">{e.title}</div>
                          {e.body && <p className="mt-1 text-xs font-medium leading-relaxed text-muted">{e.body}</p>}
                          {e.countries.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {e.countries.map((tag) => (
                                <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-page px-1.5 py-0.5 text-2xs font-bold text-ink">
                                  <span className="h-2 w-2 rounded-sm" style={{ background: state.countries[tag]?.color }} />
                                  {name(tag)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {said.map((r) => (
              <MinisterView key={r.ministry} state={state} entry={entry} report={r} compact={compact} />
            ))}
            {owed.map((b) => (
              <UnheardMinistry state={state} key={b.ministry} brief={b} writing={latestTurn && reporting?.[b.ministry]?.status === "writing"} />
            ))}
          </Stage>
        );
      })}
    </article>
  );
}

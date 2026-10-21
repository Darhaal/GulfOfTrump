"use client";

import { Banknote, Check, CircleDashed, Flag, Handshake, Landmark, Loader2, Newspaper, ScrollText, Shield, Swords, TrendingUp, TriangleAlert, X } from "lucide-react";
import { useState } from "react";
import { ui } from "@/components/ui/classes";
import SpeakButton from "@/components/voice/SpeakButton";
import { formatDate, yearOf } from "@/engine/calendar";
import { turnSpeechId } from "@/lib/voice/speaker";
import { turnSpeech } from "@/lib/voice/text";
import { regionLabel } from "@/engine/provinces";
import type { ChronicleEntry, EventKind, GameState, MapIndex, MinistryReport, Verdict } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import { ADVISOR_TITLES, type AdvisorId } from "@/engine/advisors";
import { ADVISOR_POST } from "@/engine/government";
import { personFor, samePerson } from "@/engine/people";
import { DirectiveList, MINISTRY_ICONS, StanceChip, type ReportStatus } from "./CabinetPanel";
import Portrait from "./Portrait";
import { describeChange, groupTerritory, isNotableStats, sortChanges } from "./changes";

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
  const Icon = MINISTRY_ICONS[report.ministry];
  const who = speakerOf(state, entry, report.ministry, report.by);
  return (
    <figure className="flex items-start gap-3 rounded-xl bg-page p-3">
      {who ? <Portrait portrait={who.portrait} gender={who.gender} name={who.name} size="md" /> : <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted" />}
      <div className="min-w-0 flex-1">
        <figcaption className="flex items-center gap-2">
          <span className="min-w-0 flex-1 leading-tight">
            {who && <span className="block truncate text-xs font-black text-ink">{who.name}</span>}
            <span className={`block truncate text-2xs font-bold ${who ? "text-muted" : "text-ink"}`}>{text(ADVISOR_TITLES[report.ministry])}</span>
          </span>
          {report.stance && report.stance !== "loyal" && <StanceChip stance={report.stance} />}
          <SpeakButton id={`report-${entry.turn}-${report.ministry}`} text={report.text} className="-my-1" />
        </figcaption>
        <blockquote className={`mt-1.5 text-sm font-medium leading-relaxed text-ink/90 ${compact ? "line-clamp-3" : ""}`}>{t("report.quote", { text: report.text })}</blockquote>
        <DirectiveList directives={report.directives} />
      </div>
    </figure>
  );
}

/** How many province names a grouped line spells out before "+N". */
const NAMES_PER_LINE = 6;

/** One turn as a newspaper page: headline, narrative, your orders judged, what moved, world events. */
export default function TurnReport({
  entry,
  state,
  index,
  compact,
  reporting,
}: {
  entry: ChronicleEntry;
  state: GameState;
  index: MapIndex | null;
  compact?: boolean;
  /** The ministers' reports on the last turn still being written. */
  reporting?: Partial<Record<AdvisorId, ReportStatus>>;
}) {
  const { t, text, locale, money, people } = useI18n();
  // Views come after the turn; the ministers still owing one, and the quiet ones, show what became of their directives meanwhile.
  const reports = entry.reports ?? [];
  const unheard = (entry.briefs ?? []).filter((b) => !reports.some((r) => r.ministry === b.ministry));
  const owed = unheard.filter((b) => !b.quiet);
  const quiet = unheard.filter((b) => b.quiet && b.directives.length > 0);
  const latestTurn = state.chronicle.at(-1)?.turn === entry.turn;
  const economy = entry.economy;
  const economyLines = economy
    ? [
        economy.before.gdp !== economy.after.gdp && t("report.gdp", { from: money(economy.before.gdp), to: money(economy.after.gdp) }),
        economy.before.debt !== economy.after.debt && t("report.debt", { from: money(economy.before.debt), to: money(economy.after.debt) }),
        economy.before.reserves !== economy.after.reserves && t("report.reserves", { from: money(economy.before.reserves), to: money(economy.after.reserves) }),
        economy.before.troops !== economy.after.troops && t("report.troops", { from: people(economy.before.troops), to: people(economy.after.troops) }),
        economy.before.people !== undefined && economy.after.people !== undefined && Math.abs(economy.after.people - economy.before.people) >= 1 && t("report.people", { from: people(economy.before.people), to: people(economy.after.people), delta: `${economy.after.people > economy.before.people ? "+" : "−"}${people(Math.abs(economy.after.people - economy.before.people))}` }),
      ].filter((line): line is string => Boolean(line))
    : [];
  const [allStats, setAllStats] = useState(false);
  // In the chronicle the story folds to its first paragraph; the orders and changes stay in view.
  const [fullText, setFullText] = useState(!compact);
  const paragraphs = entry.narrative.split(/\n{1,}/).filter(Boolean);
  const name = (tag: string) => text(state.countries[tag]?.name ?? tag);
  const region = (id: string) => regionLabel(id, index, locale);

  const sorted = sortChanges(entry.applied);
  const { lines, groups } = groupTerritory(sorted);
  const notable = lines.filter((c) => isNotableStats(c, state.player));
  const folded = lines.filter((c) => !isNotableStats(c, state.player));
  const territory = groups.map((g) => {
    const names = g.regions.map(region);
    const shown = names.slice(0, NAMES_PER_LINE).join(", ") + (names.length > NAMES_PER_LINE ? ` +${names.length - NAMES_PER_LINE}` : "");
    const key: MessageKey = g.kind === "annex" ? "change.annex" : g.kind === "occupy" ? "change.occupy" : "change.liberate";
    return t(key, { region: shown, from: name(g.from), to: name(g.to) });
  });
  const verdictOf = (n: number) => entry.verdicts?.find((v) => v.n === n);

  return (
    <article className="flex flex-col gap-4">
      <div>
        <div className={`${ui.label} tabular-nums`}>
          {t("game.turn", { n: entry.turn })} · {t("game.period", { from: formatDate(entry.from, locale), to: formatDate(entry.to, locale) })}
        </div>
        <div className="mt-1.5 flex items-start gap-2">
          <h3 className={`min-w-0 flex-1 font-black leading-tight tracking-tight text-ink ${compact ? "text-lg" : "text-2xl"}`}>{entry.headline}</h3>
          <SpeakButton id={turnSpeechId(entry.turn)} text={() => turnSpeech(entry)} label="voice.readTurn" className="mt-0.5" />
        </div>
      </div>

      <div className="space-y-3 text-sm font-medium leading-relaxed text-ink/90">
        {(fullText ? paragraphs : paragraphs.slice(0, 1)).map((p, i) => (
          <p key={i} className={fullText ? "" : "line-clamp-4"}>
            {p}
          </p>
        ))}
        {!fullText && (
          <button type="button" onClick={() => setFullText(true)} className="text-2xs font-black uppercase tracking-wider text-muted hover:text-accent">
            {t("report.readAll")}
          </button>
        )}
      </div>

      {entry.orders.length > 0 && (
        <section>
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
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {(territory.length > 0 || notable.length > 0 || folded.length > 0) && (
        <section>
          <div className={`${ui.label} mb-2 flex items-center gap-1.5`}>
            <Flag className="h-3.5 w-3.5" />
            {t("game.changes")}
          </div>
          <ul className="grid gap-1">
            {territory.map((line, i) => (
              <li key={`t${i}`} className="rounded-lg bg-page px-3 py-1.5 text-xs font-bold text-ink">
                {line}
              </li>
            ))}
            {notable.map((c, i) => (
              <li key={`n${i}`} className="rounded-lg bg-page px-3 py-1.5 text-xs font-bold text-ink">
                {describeChange(c, state, t, text, region, (iso) => formatDate(iso, locale))}
              </li>
            ))}
            {allStats &&
              folded.map((c, i) => (
                <li key={`f${i}`} className="rounded-lg px-3 py-1 text-xs font-medium text-muted">
                  {describeChange(c, state, t, text, region, (iso) => formatDate(iso, locale))}
                </li>
              ))}
          </ul>
          {folded.length > 0 && (
            <button type="button" onClick={() => setAllStats((v) => !v)} className="mt-1.5 px-3 text-2xs font-black uppercase tracking-wider text-muted hover:text-accent">
              {allStats ? t("game.statsLess") : t("game.statsMore", { n: folded.length })}
            </button>
          )}
        </section>
      )}

      {(reports.length > 0 || owed.length > 0 || quiet.length > 0) && (
        <section>
          <div className={`${ui.label} mb-2 flex items-center gap-1.5`}>
            <ScrollText className="h-3.5 w-3.5" />
            {t("report.ministries")}
          </div>
          <div className="grid gap-2">
            {reports.map((r) => (
              <MinisterView key={r.ministry} state={state} entry={entry} report={r} compact={compact} />
            ))}
            {owed.map((b) => {
              const Icon = MINISTRY_ICONS[b.ministry];
              const writing = latestTurn && reporting?.[b.ministry]?.status === "writing";
              return (
                <div key={b.ministry} className="rounded-xl bg-page px-3 py-2">
                  <div className="flex items-center gap-2 text-xs font-black text-ink">
                    <Icon className="h-3.5 w-3.5 text-muted" />
                    {text(ADVISOR_TITLES[b.ministry])}
                  </div>
                  <p className="mt-1.5 flex items-center gap-2 text-xs font-medium text-muted">
                    {writing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {writing ? t("report.writing") : t("report.missing")}
                  </p>
                  <DirectiveList directives={b.directives} />
                </div>
              );
            })}
            {quiet.map((b) => {
              const Icon = MINISTRY_ICONS[b.ministry];
              return (
                <div key={b.ministry} className="rounded-xl border border-line px-3 py-2">
                  <div className="flex items-center gap-2 text-xs font-black text-muted">
                    <Icon className="h-3.5 w-3.5" />
                    {text(ADVISOR_TITLES[b.ministry])}
                  </div>
                  <DirectiveList directives={b.directives} />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {economyLines.length > 0 && (
        <section>
          <div className={`${ui.label} mb-2 flex items-center gap-1.5`}>
            <Banknote className="h-3.5 w-3.5" />
            {t("report.economy")}
          </div>
          <ul className="grid gap-1">
            {economyLines.map((line) => (
              <li key={line} className="rounded-lg bg-page px-3 py-1.5 text-xs font-bold tabular-nums text-ink">
                {line}
              </li>
            ))}
          </ul>
        </section>
      )}

      {entry.events.length > 0 && (
        <section>
          <div className={`${ui.label} mb-2 flex items-center gap-1.5`}>
            <Newspaper className="h-3.5 w-3.5" />
            {t("game.events")}
          </div>
          <ul className="grid gap-2">
            {entry.events.map((e, i) => {
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
        </section>
      )}
    </article>
  );
}

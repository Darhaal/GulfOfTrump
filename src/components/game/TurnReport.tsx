"use client";

import { Banknote, Check, CircleDashed, Flag, Handshake, Landmark, Loader2, Newspaper, ScrollText, Shield, Swords, TrendingUp, TriangleAlert, X } from "lucide-react";
import { useState } from "react";
import { ui } from "@/components/ui/classes";
import SpeakButton from "@/components/voice/SpeakButton";
import { formatDate } from "@/engine/calendar";
import { turnSpeechId } from "@/lib/voice/speaker";
import { turnSpeech } from "@/lib/voice/text";
import { regionLabel } from "@/engine/provinces";
import type { ChronicleEntry, EventKind, GameState, MapIndex, Verdict } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import { ADVISOR_TITLES, type AdvisorId } from "@/engine/advisors";
import { DirectiveList, MINISTRY_ICONS, StanceChip, type ReportStatus } from "./CabinetPanel";
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
  // Reports come after the turn; the ministries still owing one show what became of their directives meanwhile.
  const reports = entry.reports ?? [];
  const owed = (entry.briefs ?? []).filter((b) => !reports.some((r) => r.ministry === b.ministry));
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

      {(reports.length > 0 || owed.length > 0) && (
        <section>
          <div className={`${ui.label} mb-2 flex items-center gap-1.5`}>
            <ScrollText className="h-3.5 w-3.5" />
            {t("report.ministries")}
          </div>
          <div className="grid gap-2">
            {reports.map((r) => {
              const Icon = MINISTRY_ICONS[r.ministry];
              return (
                <details key={r.ministry} open={!compact} className="group rounded-xl bg-page px-3 py-2">
                  <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-black text-ink">
                    <Icon className="h-3.5 w-3.5 text-muted" />
                    <span className="min-w-0 flex-1">{text(ADVISOR_TITLES[r.ministry])}</span>
                    {r.stance && r.stance !== "loyal" && <StanceChip stance={r.stance} />}
                    <SpeakButton id={`report-${entry.turn}-${r.ministry}`} text={r.text} className="-my-1" />
                  </summary>
                  <p className="mt-1.5 text-sm font-medium leading-relaxed text-ink/90">{r.text}</p>
                  <DirectiveList directives={r.directives} />
                </details>
              );
            })}
            {owed.map((b) => {
              const Icon = MINISTRY_ICONS[b.ministry];
              const writing = latestTurn && reporting?.[b.ministry]?.status === "writing";
              return (
                <details key={b.ministry} open={!compact} className="group rounded-xl bg-page px-3 py-2">
                  <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-black text-ink">
                    <Icon className="h-3.5 w-3.5 text-muted" />
                    {text(ADVISOR_TITLES[b.ministry])}
                  </summary>
                  <p className="mt-1.5 flex items-center gap-2 text-xs font-medium text-muted">
                    {writing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {writing ? t("report.writing") : t("report.missing")}
                  </p>
                  <DirectiveList directives={b.directives} />
                </details>
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

"use client";

import { ChevronRight, Handshake, Landmark, Newspaper, Swords, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { ui } from "@/components/ui/classes";
import { formatDate } from "@/engine/calendar";
import { NEWS_SECTIONS, newsThread, worldNews, type NewsItem, type NewsSection } from "@/engine/news";
import { regionLabel } from "@/engine/provinces";
import { getScenario } from "@/engine/scenarios";
import type { GameState, Locale, MapIndex } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import { describeChange } from "./changes";

const SECTION_ICON: Record<NewsSection, typeof Newspaper> = {
  war: Swords,
  politics: Landmark,
  diplomacy: Handshake,
  economy: TrendingUp,
  other: Newspaper,
};

/** Turns shown at first and added by "earlier". */
const TURNS_PAGE = 6;
/** Province names in one line of land that changed hands. */
const NAMES_PER_LINE = 4;
/** Stories offered under an opened item; a bloc's dozens of members are not all listed. */
const STORIES_SHOWN = 12;

const MONTH_LOCALE: Record<Locale, string> = { en: "en-GB", ru: "ru-RU", uk: "uk-UA" };

/** A government that keeps power at an election: news, but routine, folded into one line a turn. */
const routine = (item: NewsItem) => item.type === "change" && item.change.kind === "vote" && item.change.kept;

/**
 * What happened elsewhere, turn by turn (engine/news.ts). An item opens on
 * its thread: everything before and after about the same country, war or
 * bloc, so a coup can be read with the slump and the lost election before it.
 */
export default function WorldNews({ state, index, onCountry }: { state: GameState; index: MapIndex | null; onCountry?: (tag: string) => void }) {
  const { t, text, locale } = useI18n();
  const news = useMemo(() => worldNews(state), [state]);
  const [section, setSection] = useState<NewsSection | "all">("all");
  const [open, setOpen] = useState<string | null>(null);
  const [topic, setTopic] = useState<string | null>(null);
  const [turns, setTurns] = useState(TURNS_PAGE);

  const name = (tag: string) => text(state.countries[tag]?.name ?? tag);
  const date = (iso: string) => formatDate(iso, locale);
  const month = (iso: string) => new Intl.DateTimeFormat(MONTH_LOCALE[locale], { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
  /** When an item happened: an election's own day, else the month its turn began. */
  const when = (item: NewsItem) => (item.type === "change" && item.change.kind === "vote" && item.change.date && item.change.date >= item.from ? date(item.change.date) : month(item.from));
  const region = (id: string) => regionLabel(id, index, locale);
  const scenario = getScenario(state.scenarioId);

  /** The item as one line of text, in the interface language. */
  const lineOf = (item: NewsItem): string => {
    if (item.type === "event") return item.event.title;
    if (item.type === "change") return describeChange(item.change, state, t, text, region, date);
    const names = item.land.regions.map(region);
    const shown = names.slice(0, NAMES_PER_LINE).join(", ") + (names.length > NAMES_PER_LINE ? ` +${names.length - NAMES_PER_LINE}` : "");
    const key: MessageKey = item.land.kind === "annex" ? "change.annex" : item.land.kind === "occupy" ? "change.occupy" : "change.liberate";
    return t(key, { region: shown, from: name(item.land.from), to: name(item.land.to) });
  };

  /** A topic's name: a country, a war or a bloc. */
  const topicName = (key: string): string => {
    const [kind, id] = key.split(":");
    if (kind === "country") return name(id);
    if (kind === "war") {
      const war = state.wars.find((w) => w.id === id) ?? scenario.wars.find((w) => w.id === id);
      if (war) return text(war.name);
    }
    if (kind === "bloc") {
      const bloc = state.alliances.find((a) => a.id === id);
      if (bloc) return text(bloc.name);
    }
    // A war or bloc that is over keeps its name in the changes that told of it.
    for (const item of news) {
      if (item.type !== "change") continue;
      const c = item.change;
      if (kind === "war" && (c.kind === "war" || c.kind === "peace" || c.kind === "truce" || c.kind === "truce-ended") && c.war === id) return text(c.name);
      if (kind === "bloc" && (c.kind === "alliance" || c.kind === "alliance-ended" || c.kind === "leave") && c.alliance === id) return text(c.name);
    }
    return id;
  };

  const filtered = section === "all" ? news : news.filter((n) => n.section === section);
  const byTurn = new Map<number, NewsItem[]>();
  for (const item of filtered) byTurn.set(item.turn, [...(byTurn.get(item.turn) ?? []), item]);
  const turnList = [...byTurn.keys()].slice(0, turns);

  if (!news.length) return <p className="rounded-xl border-2 border-dashed border-line px-4 py-8 text-center text-xs font-medium text-muted">{t("news.empty")}</p>;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-1.5">
        {(["all", ...NEWS_SECTIONS] as const).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={section === s}
            onClick={() => setSection(s)}
            className={`rounded-lg px-2.5 py-1.5 text-2xs font-black uppercase tracking-wider transition-colors ${section === s ? "bg-ink text-on-ink" : "text-muted hover:bg-page hover:text-ink"}`}
          >
            {t(`news.section.${s}` as MessageKey)}
          </button>
        ))}
      </div>

      {turnList.length === 0 && <p className="px-1 py-4 text-xs font-medium text-muted">{t("news.none")}</p>}

      {turnList.map((turn) => {
        const all = byTurn.get(turn)!;
        const items = all.filter((item) => !routine(item));
        const kept = all.filter(routine);
        return (
          <section key={turn} className={`${ui.card} p-3`}>
            <div className={`${ui.label} mb-2 tabular-nums`}>
              {t("game.turn", { n: turn })} · {t("game.period", { from: date(all[0].from), to: date(all[0].to) })}
            </div>
            <ul className="grid gap-1.5">
              {items.map((item) => {
                const Icon = SECTION_ICON[item.section];
                const isOpen = open === item.id;
                const topics = item.topics.filter((k) => k !== `country:${state.player}`);
                const current = isOpen ? (topic && topics.includes(topic) ? topic : topics[0]) : null;
                const thread = current ? newsThread(news, current) : [];
                return (
                  <li key={item.id} className={`rounded-xl border ${isOpen ? "border-accent/30 bg-page/60" : "border-line"} p-2.5`}>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => {
                        setOpen(isOpen ? null : item.id);
                        setTopic(null);
                      }}
                      className="flex w-full items-start gap-2 text-left"
                    >
                      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-bold leading-snug text-ink">{lineOf(item)}</span>
                        {item.type === "event" && item.event.body && (
                          <span className={`mt-0.5 block text-2xs font-medium leading-relaxed text-muted ${isOpen ? "" : "line-clamp-2"}`}>{item.event.body}</span>
                        )}
                      </span>
                      <ChevronRight className={`mt-0.5 h-3.5 w-3.5 shrink-0 text-muted transition-transform ${isOpen ? "rotate-90" : ""}`} />
                    </button>

                    {isOpen && (
                      <div className="mt-2.5 grid gap-2 border-t border-line pt-2.5">
                        {topics.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {topics.slice(0, STORIES_SHOWN).map((k) => (
                              <button
                                key={k}
                                type="button"
                                aria-pressed={k === current}
                                onClick={() => setTopic(k)}
                                className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-2xs font-bold ${k === current ? "bg-ink text-on-ink" : "bg-page text-ink hover:bg-divider"}`}
                              >
                                {k.startsWith("country:") && <span className="h-2 w-2 rounded-sm" style={{ background: state.countries[k.slice(8)]?.color }} />}
                                {topicName(k)}
                              </button>
                            ))}
                            {topics.length > STORIES_SHOWN && <span className="px-1 py-0.5 text-2xs font-bold text-muted">+{topics.length - STORIES_SHOWN}</span>}
                          </div>
                        )}
                        {current && (
                          <div>
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <span className={ui.label}>{t("news.thread", { topic: topicName(current) })}</span>
                              {current.startsWith("country:") && onCountry && state.countries[current.slice(8)] && (
                                <button type="button" onClick={() => onCountry(current.slice(8))} className="text-2xs font-black uppercase tracking-wider text-muted hover:text-accent">
                                  {t("news.country")}
                                </button>
                              )}
                            </div>
                            <ol className="grid gap-1">
                              {thread.map((x) => (
                                <li key={x.id} className={`grid grid-cols-[auto_1fr] gap-2 text-2xs leading-snug ${x.id === item.id ? "font-black text-ink" : "font-medium text-muted"}`}>
                                  <span className="tabular-nums">{when(x)}</span>
                                  <span>{lineOf(x)}</span>
                                </li>
                              ))}
                            </ol>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {kept.length > 0 && (
              <p className={`${items.length ? "mt-2" : ""} flex items-start gap-2 px-1 text-2xs font-medium leading-relaxed text-muted`}>
                <Landmark className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  {kept.length === 1
                    ? t("change.vote.kept", { country: name(kept[0].countries[0]) })
                    : t("news.kept", { list: kept.map((item) => name(item.countries[0])).join(", ") })}
                </span>
              </p>
            )}
          </section>
        );
      })}

      {byTurn.size > turns && (
        <button type="button" onClick={() => setTurns((n) => n + TURNS_PAGE)} className={`${ui.secondary} py-2 text-xs`}>
          {t("news.earlier")}
        </button>
      )}
    </div>
  );
}

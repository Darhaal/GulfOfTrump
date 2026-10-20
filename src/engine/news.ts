import { getScenario } from "./scenarios";
import type { AppliedChange, ChronicleEntry, EventKind, GameEvent, GameState } from "./types";

/**
 * The world's news, read from the chronicle: what the game master reported
 * and what the engine changed, for the countries other than the player's,
 * turn by turn. Nothing new is kept in a save, so older games have their
 * news too. Each item names its countries and, for a war or a bloc, the war
 * or the bloc, so it can open on the thread of what came before and after.
 */

export const NEWS_SECTIONS = ["war", "politics", "diplomacy", "economy", "other"] as const;
export type NewsSection = (typeof NEWS_SECTIONS)[number];

/** Land that changed hands in a turn, one line per side that took it from another. */
export interface LandNews {
  kind: "annex" | "occupy" | "liberate";
  from: string;
  to: string;
  regions: string[];
}

interface NewsBase {
  /** Unique within a game: the turn and the item's place in it. */
  id: string;
  turn: number;
  /** The period the turn covered. */
  from: string;
  to: string;
  section: NewsSection;
  /** The countries it is about. */
  countries: string[];
  /** What it belongs to, for its thread: "country:<tag>", "war:<id>", "bloc:<id>". */
  topics: string[];
}

export type NewsItem =
  | (NewsBase & { type: "event"; event: GameEvent })
  | (NewsBase & { type: "change"; change: AppliedChange })
  | (NewsBase & { type: "land"; land: LandNews });

const EVENT_SECTION: Record<EventKind, NewsSection> = {
  war: "war",
  military: "war",
  diplomacy: "diplomacy",
  politics: "politics",
  economy: "economy",
  disaster: "other",
  other: "other",
};

/** The section of an engine change and the countries it concerns; null for what only concerns the player's own state. */
function placeChange(c: AppliedChange, sides: (war: string) => string[], members: (bloc: string) => string[]): { section: NewsSection; countries: string[]; topics: string[] } | null {
  switch (c.kind) {
    case "vote":
    case "coup":
      return { section: "politics", countries: [c.country], topics: [] };
    case "leader":
      return { section: "politics", countries: [c.country], topics: [] };
    case "new-country":
      return { section: "politics", countries: [c.country], topics: [] };
    case "war":
    case "peace":
    case "truce":
    case "truce-ended":
      return { section: "war", countries: sides(c.war), topics: [`war:${c.war}`] };
    case "contest":
    case "repel":
      return { section: "war", countries: [c.by, c.holder], topics: [] };
    case "alliance":
    case "alliance-ended":
      return { section: "diplomacy", countries: members(c.alliance), topics: [`bloc:${c.alliance}`] };
    case "leave":
      return { section: "diplomacy", countries: [c.country], topics: [`bloc:${c.alliance}`] };
    case "invitation":
      return { section: "diplomacy", countries: [c.country], topics: [] };
    case "sanction":
      return { section: "economy", countries: [c.by, c.against], topics: [] };
    case "funds":
      return { section: "economy", countries: [c.from, c.to], topics: [] };
    case "population":
      return { section: "other", countries: [c.country, ...(c.to ? [c.to] : [])], topics: [] };
    default:
      // Parties, the player's elections, plots, protests, laws, bills, officials, the budget, the player's identity and deals:
      // the player's own politics, already in its chronicle.
      return null;
  }
}

/**
 * Every news item of a game, newest turn first; within a turn, the game
 * master's events first, then the engine's changes. Items about the player's
 * country alone are left out: they are its own chronicle.
 */
export function worldNews(state: Pick<GameState, "chronicle" | "wars" | "alliances" | "scenarioId" | "player">): NewsItem[] {
  const seeds = getScenario(state.scenarioId);
  const sides = (war: string) => {
    const w = state.wars.find((x) => x.id === war) ?? seeds.wars.find((x) => x.id === war);
    return w ? [...w.attackers, ...w.defenders] : [];
  };
  const members = (bloc: string) => state.alliances.find((a) => a.id === bloc)?.members.slice(0, 12) ?? [];
  const elsewhere = (countries: string[]) => countries.some((tag) => tag !== state.player);
  const out: NewsItem[] = [];
  for (const entry of [...state.chronicle].reverse()) out.push(...turnNews(entry, { sides, members, elsewhere }));
  return out;
}

function turnNews(
  entry: ChronicleEntry,
  ctx: { sides: (war: string) => string[]; members: (bloc: string) => string[]; elsewhere: (countries: string[]) => boolean },
): NewsItem[] {
  const base = (n: string, section: NewsSection, countries: string[], topics: string[]) => {
    const unique = [...new Set(countries)];
    return { id: `${entry.turn}-${n}`, turn: entry.turn, from: entry.from, to: entry.to, section, countries: unique, topics: [...unique.map((tag) => `country:${tag}`), ...topics] };
  };
  const items: NewsItem[] = [];
  entry.events.forEach((event, i) => {
    if (event.countries.length && !ctx.elsewhere(event.countries)) return;
    items.push({ ...base(`e${i}`, EVENT_SECTION[event.kind] ?? "other", event.countries, []), type: "event", event });
  });
  // Land is grouped by who took it from whom, as the turn report does.
  const land = new Map<string, LandNews>();
  entry.applied.forEach((change, i) => {
    if (change.kind === "annex" || change.kind === "occupy" || change.kind === "liberate") {
      const key = `${change.kind}|${change.from}|${change.to}`;
      const group = land.get(key) ?? { kind: change.kind, from: change.from, to: change.to, regions: [] };
      group.regions.push(change.region);
      land.set(key, group);
      return;
    }
    const place = placeChange(change, ctx.sides, ctx.members);
    if (!place || (place.countries.length && !ctx.elsewhere(place.countries))) return;
    items.push({ ...base(`c${i}`, place.section, place.countries, place.topics), type: "change", change });
  });
  [...land.values()].forEach((group, i) => {
    if (!ctx.elsewhere([group.from, group.to])) return;
    items.push({ ...base(`l${i}`, "war", [group.from, group.to], []), type: "land", land: group });
  });
  return items;
}

/** The thread of a topic: every item that belongs to it, oldest first. */
export function newsThread(news: NewsItem[], topic: string): NewsItem[] {
  return news.filter((item) => item.topics.includes(topic)).sort((a, b) => a.turn - b.turn);
}

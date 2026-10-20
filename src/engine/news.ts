import { INSTITUTIONS } from "./funds";
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

/** A bloc this large (a world body) is news for its members, but not part of each member's story. */
const STORY_MEMBERS = 30;

interface Lookup {
  /** A war's sides, as recorded when it began or ended, else as it stands or as the scenario began it. */
  sides: (war: string) => string[];
  /** A bloc's members, the same way. */
  members: (bloc: string) => string[];
  /** A summit's participants. */
  participants: (summit: string) => string[];
  isCountry: (tag: string) => boolean;
  elsewhere: (countries: string[]) => boolean;
}

interface Placed {
  section: NewsSection;
  countries: string[];
  /** Stories it belongs to besides its countries'. */
  topics: string[];
  /** Whether it is part of each of its countries' stories (not for a world body's hundred members). */
  stories?: boolean;
}

/** The section of an engine change, the countries it concerns and the stories it belongs to; null for what only concerns the player's own state. */
function placeChange(c: AppliedChange, ctx: Lookup): Placed | null {
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
      return { section: "war", countries: ctx.sides(c.war), topics: [`war:${c.war}`] };
    case "contest":
    case "repel":
      return { section: "war", countries: [c.by, c.holder], topics: [] };
    case "alliance":
    case "alliance-ended": {
      const members = ctx.members(c.alliance);
      return { section: "diplomacy", countries: members, topics: [`bloc:${c.alliance}`], stories: members.length <= STORY_MEMBERS };
    }
    case "leave":
      return { section: "diplomacy", countries: [c.country], topics: [`bloc:${c.alliance}`] };
    case "summit-planned":
      return { section: "diplomacy", countries: ctx.participants(c.summit), topics: [] };
    case "invitation":
      return { section: "diplomacy", countries: [c.country], topics: [] };
    case "sanction":
      return { section: "economy", countries: [c.by, c.against], topics: [] };
    case "funds": {
      // The payer may be a country, a lender (the IMF, banks) or a bloc: only a country is a country, a bloc has its own story.
      const bloc = !ctx.isCountry(c.from) && !(INSTITUTIONS as readonly string[]).includes(c.from);
      return { section: "economy", countries: [c.from, c.to].filter(ctx.isCountry), topics: bloc ? [`bloc:${c.from}`] : [] };
    }
    case "population":
      return { section: "other", countries: [c.country, ...(c.to ? [c.to] : [])], topics: [] };
    default:
      // The player's own affairs, already in its chronicle: parties, its elections, plots, laws, bills, officials, the
      // budget, its name and colours, its deals, its fall and exile. Protests are left out too: their changes do not say
      // whose streets they fill.
      return null;
  }
}

/**
 * Every news item of a game, newest turn first; within a turn, the game
 * master's events first, then the engine's changes. Items about the player's
 * country alone are left out: they are its own chronicle.
 */
export function worldNews(state: Pick<GameState, "chronicle" | "wars" | "alliances" | "summits" | "countries" | "scenarioId" | "player">): NewsItem[] {
  const seeds = getScenario(state.scenarioId);
  // Who fought a war and who belonged to a bloc, as the chronicle recorded it: a war or bloc that is over keeps its countries.
  const recordedSides = new Map<string, Set<string>>();
  const recordedMembers = new Map<string, Set<string>>();
  const add = (map: Map<string, Set<string>>, key: string, tags: string[]) => {
    const set = map.get(key) ?? new Set<string>();
    for (const tag of tags) set.add(tag);
    map.set(key, set);
  };
  for (const entry of state.chronicle) {
    for (const c of entry.applied) {
      if ((c.kind === "war" || c.kind === "peace") && c.sides) add(recordedSides, c.war, c.sides);
      if ((c.kind === "alliance" || c.kind === "alliance-ended") && c.members) add(recordedMembers, c.alliance, c.members);
      if (c.kind === "leave") add(recordedMembers, c.alliance, [c.country]);
    }
  }
  const everyone = Object.keys(state.countries);
  const lookup: Lookup = {
    sides: (war) => {
      const recorded = recordedSides.get(war);
      if (recorded) return [...recorded];
      const w = state.wars.find((x) => x.id === war) ?? seeds.wars.find((x) => x.id === war);
      return w ? [...w.attackers, ...w.defenders] : [];
    },
    members: (bloc) => {
      const recorded = recordedMembers.get(bloc);
      const live = state.alliances.find((a) => a.id === bloc)?.members;
      if (recorded || live) return [...new Set([...(recorded ?? []), ...(live ?? [])])];
      const seed = seeds.alliances.find((a) => a.id === bloc);
      if (!seed) return [];
      return seed.allExcept ? everyone.filter((tag) => !seed.allExcept!.includes(tag)) : seed.members.filter((tag) => state.countries[tag]);
    },
    participants: (summit) => (state.summits ?? []).find((s) => s.id === summit)?.participants ?? [],
    isCountry: (tag) => Boolean(state.countries[tag]),
    elsewhere: (countries) => countries.some((tag) => tag !== state.player),
  };
  const out: NewsItem[] = [];
  for (const entry of [...state.chronicle].reverse()) out.push(...turnNews(entry, lookup));
  return out;
}

function turnNews(entry: ChronicleEntry, ctx: Lookup): NewsItem[] {
  const base = (n: string, section: NewsSection, countries: string[], topics: string[], stories = true) => {
    const unique = [...new Set(countries)];
    return { id: `${entry.turn}-${n}`, turn: entry.turn, from: entry.from, to: entry.to, section, countries: unique, topics: [...topics, ...(stories ? unique.map((tag) => `country:${tag}`) : [])] };
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
    const place = placeChange(change, ctx);
    if (!place || (place.countries.length && !ctx.elsewhere(place.countries))) return;
    items.push({ ...base(`c${i}`, place.section, place.countries, place.topics, place.stories), type: "change", change });
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

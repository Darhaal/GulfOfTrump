import type { GamesKind, Localized } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";

type T = (key: MessageKey, params?: Record<string, string | number>) => string;

/** "Summer Olympics 1952" from a Games' id ("summer-1952") or its kind and year. */
export function gamesTitle(games: string | { kind: GamesKind; year: number }, t: T): string {
  const [kind, year] = typeof games === "string" ? (games.split("-") as [GamesKind, string]) : [games.kind, String(games.year)];
  return t(`sport.games.${kind}` as MessageKey, { year });
}

/** Where Games are held: the city and its country, or the host countries of a World Cup. */
export function gamesWhere(hosts: string[], city: Localized | undefined, country: (tag: string) => string, text: (value: Localized) => string): string {
  const names = hosts.map(country).join(", ");
  return city ? (names ? `${text(city)} (${names})` : text(city)) : names;
}

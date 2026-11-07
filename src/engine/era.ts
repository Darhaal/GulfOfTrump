import type { ScenarioId } from "./types";

/**
 * The era a game is in, by its date rather than the date it began on: a
 * 1939 game in 1955 holds to the norms of the 1950s. The engine's tables of
 * the era (the norm against conquest, the pledges, the bomb's restraint,
 * appetite for force, the pace of war plans) are kept by start date; each is
 * read at the day each date begins and drawn straight between them, the way
 * engine/atom.ts reads its tables by year.
 */

/** Each start date as a year with its fraction: where its column of a table holds exactly. */
const ANCHORS: [ScenarioId, number][] = (
  [
    ["1914", "1914-06-28"],
    ["1933", "1933-01-30"],
    ["1939", "1939-09-01"],
    ["1950", "1950-06-25"],
    ["1957", "1957-10-04"],
    ["1964", "1964-08-02"],
    ["1973", "1973-10-06"],
    ["1979", "1979-12-25"],
    ["1991", "1991-08-19"],
    ["1999", "1999-03-24"],
    ["2014", "2014-01-16"],
    ["2022", "2022-02-24"],
  ] as [ScenarioId, string][]
).map(([id, date]) => [id, yearOf(date)]);

/** A date as a year with its fraction. */
export function yearOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return y + ((m || 1) - 1) / 12 + ((d || 1) - 1) / 365.25;
}

/** A table of the era read on a date: its start date's value on the day, drawn straight to the next date's. */
export function byEra(table: Record<ScenarioId, number>, date: string): number {
  const year = yearOf(date);
  if (year <= ANCHORS[0][1]) return table[ANCHORS[0][0]];
  for (let i = 1; i < ANCHORS.length; i++) {
    const [id1, y1] = ANCHORS[i];
    if (year <= y1) {
      const [id0, y0] = ANCHORS[i - 1];
      return table[id0] + ((table[id1] - table[id0]) * (year - y0)) / (y1 - y0);
    }
  }
  return table[ANCHORS[ANCHORS.length - 1][0]];
}

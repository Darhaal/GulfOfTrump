import type { ScenarioId } from "./types";

/**
 * The game's money. GDP is counted in dollars of the day, grown each year by
 * the era's constant `dollar` (engine/economy.ts), not by the calendar's own
 * inflation – so every cost the engine prices by the calendar year (plants,
 * weapons, warheads) is read at the start date's price and moved by the same
 * dollar, or the same budget line would buy more or less of them year by
 * year than the GDP it is a share of. Pure, no imports beyond types.
 */

/**
 * How fast the dollar loses value in play, % a year, by start date: the
 * twenty years ahead, not the start year's inflation (the seventies' double
 * digits fell back to 3–4% in the 1980s). The economy grows nominal GDP by
 * it, and the society deflates by it (engine/society.ts).
 */
export const DOLLAR: Record<ScenarioId, number> = { "1914": 1, "1933": 1, "1939": 2, "1950": 2.5, "1957": 2.5, "1964": 2, "1973": 4, "1979": 4, "1991": 3, "1999": 2.5, "2014": 1, "2022": 4 };

/** The era's dollar, % a year. */
export const dollarRate = (era: ScenarioId): number => DOLLAR[era];

/** The calendar's prices against dollars of 2020, by year: what history's cost tables in dollars of the day are measured by. */
const CALENDAR: [number, number][] = [[1914, 0.025], [1939, 0.035], [1950, 0.065], [1957, 0.08], [1964, 0.09], [1975, 0.18], [1991, 0.5], [1999, 0.6], [2014, 0.88], [2022, 1.08]];

/** A table of years read in a year: straight between its years, held beyond them. */
function byYear(table: [number, number][], year: number): number {
  if (year <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    const [y1, v1] = table[i];
    if (year <= y1) {
      const [y0, v0] = table[i - 1];
      return v0 + ((v1 - v0) * (year - y0)) / (y1 - y0);
    }
  }
  return table[table.length - 1][1];
}

/** The calendar's price level in a year, against dollars of 2020. */
export const calendarPrices = (year: number): number => byYear(CALENDAR, year);

/**
 * The game's price level in a year, against dollars of 2020: the start
 * date's calendar price, moved since by the era's dollar. A game without a
 * start date (a table read for its own sake) reads the calendar's.
 */
export function gamePrices(era: ScenarioId | undefined, year: number): number {
  if (!era) return calendarPrices(year);
  const start = Number(era);
  return calendarPrices(start) * (1 + DOLLAR[era] / 100) ** (year - start);
}

/**
 * What a cost history priced in dollars of the day in `year` comes to in
 * the game's dollars: the table's real changes (drones and solar panels
 * grown cheap) kept, the calendar's inflation replaced by the era's dollar.
 * 1 on the start date.
 */
export const priceRatio = (era: ScenarioId | undefined, year: number): number => (era ? gamePrices(era, year) / calendarPrices(year) : 1);

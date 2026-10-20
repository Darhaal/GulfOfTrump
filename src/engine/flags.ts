import { FLAG_CODES } from "./flagCodes";
import type { ScenarioId } from "./types";

/**
 * Which flag a country flies on a scenario's date: today's (an ISO code, a
 * file in public/flags) or one drawn in the game for a state that no longer
 * exists or whose flag has changed since (src/components/Flag.tsx). For
 * Germany in 1939 the game shows the black, white and red tricolour, as
 * strategy games usually do.
 */
export const DRAWN_FLAGS = [
  "ussr",
  "german-tricolour",
  "austria-hungary",
  "ottoman",
  "china-1912",
  "persia",
  "siam",
  "yugoslavia-kingdom",
  "yugoslavia",
  "belarus-1991",
  "ethiopia-empire",
  "south-africa-1928",
  "red-ensign",
  "egypt-kingdom",
  "northern-cyprus",
  "south-vietnam",
  "viet-cong",
  "gdr",
  "uar",
  "fry",
  "taliban",
] as const;
export type DrawnFlag = (typeof DRAWN_FLAGS)[number];

export type FlagRef = { kind: "iso"; code: string } | { kind: "drawn"; id: DrawnFlag };

const ERA: Partial<Record<ScenarioId, Record<string, string>>> = {
  "1914": {
    germany: "german-tricolour",
    "austria-hungary": "austria-hungary",
    ottoman: "ottoman",
    china: "china-1912",
    persia: "persia",
    siam: "siam",
    ethiopia: "ethiopia-empire",
    canada: "red-ensign",
    "south-africa": "red-ensign",
  },
  "1939": {
    germany: "german-tricolour",
    ussr: "ussr",
    // The Republic of China's flag is the one Taiwan flies today.
    china: "tw",
    yugoslavia: "yugoslavia-kingdom",
    iran: "persia",
    ethiopia: "ethiopia-empire",
    canada: "red-ensign",
    "south-africa": "south-africa-1928",
    egypt: "egypt-kingdom",
  },
  "1950": {
    ussr: "ussr",
    "west-germany": "de",
    // The GDR flew the plain black, red and gold until 1959.
    "east-germany": "de",
    china: "cn",
    taiwan: "tw",
    yugoslavia: "yugoslavia",
    iran: "persia",
    ethiopia: "ethiopia-empire",
    canada: "red-ensign",
    "south-africa": "south-africa-1928",
    egypt: "egypt-kingdom",
    vietnam: "south-vietnam",
    "viet-minh": "vn",
    ceylon: "lk",
  },
  "1964": {
    ussr: "ussr",
    "west-germany": "de",
    "east-germany": "gdr",
    china: "cn",
    taiwan: "tw",
    yugoslavia: "yugoslavia",
    iran: "persia",
    ethiopia: "ethiopia-empire",
    canada: "red-ensign",
    "south-africa": "south-africa-1928",
    egypt: "uar",
    "south-vietnam": "south-vietnam",
    "north-vietnam": "vn",
    "viet-cong": "viet-cong",
    ceylon: "lk",
  },
  "1991": { ussr: "ussr", yugoslavia: "yugoslavia", byelarus: "belarus-1991", "northern-cyprus": "northern-cyprus" },
  "1999": { yugoslavia: "fry", "northern-cyprus": "northern-cyprus", kosovo: "al", afghanistan: "taliban", "northern-alliance": "af" },
  "2014": { "northern-cyprus": "northern-cyprus" },
  "2022": { "northern-cyprus": "northern-cyprus" },
};

export function flagOf(tag: string, scenario: ScenarioId): FlagRef | null {
  const pick = ERA[scenario]?.[tag];
  if (pick) return (DRAWN_FLAGS as readonly string[]).includes(pick) ? { kind: "drawn", id: pick as DrawnFlag } : { kind: "iso", code: pick };
  const code = FLAG_CODES[tag];
  return code ? { kind: "iso", code } : null;
}

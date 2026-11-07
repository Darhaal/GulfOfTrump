import { z } from "zod";
import { heldDown, type Accounts } from "./economy";
import { countsFor } from "./occupation";
import { peopleIn } from "./population";
import { gamePrices } from "./prices";
import { techYear, yearFraction } from "./researchEffects";
import type { ResourceType } from "./resources";
import { ENERGY_SOURCES, type AppliedChange, type Economy, type EnergySource, type GameState, type MapRegion, type PlantWork, type PowerBook, type RegionState, type ScenarioId } from "./types";

/**
 * Electricity. Every country has power plants of seven kinds – coal, oil,
 * gas, hydro, nuclear, wind and solar – counted in gigawatts, and a demand
 * for electricity in terawatt-hours a year that grows with its economy
 * (faster in the age of electrification, and in a poor country catching up).
 * The start dates are history's: each great power's and featured country's
 * generation and mix on the day, an era's mix leaned by its own coal, oil,
 * gas and rivers for the rest.
 *
 * What the plants deliver is their capacity at each kind's load, less what
 * their fuel allows – coal, oil and gas from the strategic resources the
 * country digs or imports, uranium for the reactors (engine/economy.ts):
 * a blockade or sanctions that cut the imports run down the stores and then
 * the plants – and less the land an enemy holds, whose people are off the
 * grid too. What demand it cannot meet is a shortage: it holds output below
 * its level while it lasts (engine/economy.ts Economy.losses), darkens the
 * people's homes (engine/provision.ts) and feeds unrest (engine/crises.ts).
 * Demand grows with the economy's trend and follows its output lost or
 * given back to the standing causes one to one.
 *
 * Plants are built from the industry line over the years each kind takes,
 * a share of it at most: for the player by its orders and its industry
 * minister's routine (engine/ministers.ts), its planners only keeping the
 * lights on in the country's own mix; for every other government by its
 * planners, ahead of the demand they see coming, in the era's mix leaned by
 * what the country has. Old plants retire abroad. A front destroys the plants it
 * runs through – up to its share of the land, repaired once it has gone – an
 * occupation leaves them to the enemy, and land that passes for good takes
 * its plants and its demand with it. Strategic bombing's toll on the plants
 * is inside its toll on output (engine/economy.ts), not a shortage besides.
 * Plants are priced in the game's dollar (engine/prices.ts).
 */

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const round = (v: number, digits = 2) => Math.round(v * 10 ** digits) / 10 ** digits;

type Mix = Partial<Record<EnergySource, number>>;

/** The share of the year a plant of each kind runs at full power. */
export const LOAD: Record<EnergySource, number> = { coal: 0.6, oil: 0.45, gas: 0.5, hydro: 0.42, nuclear: 0.72, wind: 0.28, solar: 0.15 };
/** TWh a gigawatt gives in a year at full power. */
const HOURS = 8.76;
/** Years a plant of each kind takes to build. */
export const BUILD_YEARS: Record<EnergySource, number> = { coal: 4, oil: 3, gas: 2, hydro: 6, nuclear: 7, wind: 2, solar: 1 };
/** Years a plant serves before it retires. */
const LIFE: Record<EnergySource, number> = { coal: 40, oil: 35, gas: 35, hydro: 70, nuclear: 45, wind: 25, solar: 25 };
/** The strategic resource each kind of plant burns. */
export const FUEL: Partial<Record<EnergySource, ResourceType>> = { coal: "coal", oil: "oil", gas: "gas", nuclear: "uranium" };
/** The first year a plant of a kind can be built at all. */
const OPENS: Partial<Record<EnergySource, number>> = { nuclear: 1954.5, wind: 1985, solar: 2000 };

/** TWh a year from `gw` of a source at its load. */
export const twhOf = (source: EnergySource, gw: number) => gw * LOAD[source] * HOURS;

/**
 * Uranium the reactors of each country burn a year on the start date,
 * tonnes: nuclear power, not income, decides who needs it. A country's need
 * then follows its reactors (uraniumCall).
 */
export const REACTORS: Record<ScenarioId, Record<string, number>> = {
  "1914": {},
  "1933": {},
  "1939": {},
  // The early dates count the bomb programmes too: then, not power, decided who wanted uranium.
  "1950": { usa: 2000, ussr: 1500, uk: 300 },
  "1957": { usa: 7000, ussr: 5000, uk: 1500, france: 400 },
  "1964": { usa: 14000, ussr: 9000, uk: 2500, france: 1500, china: 300, canada: 100 },
  "1973": { usa: 14000, ussr: 8000, uk: 2500, france: 2500, japan: 1200, canada: 800, "west-germany": 800, china: 400, sweden: 200, switzerland: 200, italy: 200, spain: 200, india: 100 },
  "1979": {
    usa: 16000, ussr: 9000, france: 4000, japan: 3500, uk: 2500, "west-germany": 2500, canada: 1200, sweden: 1000, switzerland: 400, belgium: 400, spain: 400,
    china: 400, taiwan: 300, finland: 300, "east-germany": 300, india: 200, italy: 200, "south-korea": 200, bulgaria: 200, czechoslovakia: 100, argentina: 100,
  },
  "1991": {
    usa: 18000, france: 9000, ussr: 9000, japan: 7000, germany: 3500, uk: 2500, "south-korea": 2500, canada: 1800, sweden: 1500, spain: 1200,
    belgium: 1000, taiwan: 1000, czechoslovakia: 600, bulgaria: 600, switzerland: 500, finland: 500, hungary: 400, "south-africa": 300, india: 200,
    argentina: 150, brazil: 100, netherlands: 100, yugoslavia: 100, mexico: 100,
  },
  "1999": {
    usa: 18000, france: 9000, japan: 7500, russia: 5000, germany: 3300, "south-korea": 3000, uk: 2500, ukraine: 2400, canada: 1700,
    sweden: 1500, spain: 1500, taiwan: 1100, belgium: 1000, bulgaria: 600, czechia: 600, china: 500, switzerland: 500, finland: 500,
    hungary: 400, slovakia: 400, lithuania: 400, india: 300, "south-africa": 300, mexico: 200, argentina: 150, slovenia: 150, brazil: 100,
    netherlands: 100, armenia: 80,
  },
  "2014": {
    usa: 19000, france: 9000, china: 6000, russia: 5500, "south-korea": 4000, ukraine: 2400, japan: 2000, germany: 2000, uk: 2000, canada: 1700,
    sweden: 1500, spain: 1300, taiwan: 1100, india: 1000, belgium: 1000, czechia: 600, finland: 500, switzerland: 500, slovakia: 400, hungary: 350,
    bulgaria: 300, "south-africa": 300, brazil: 300, mexico: 250, romania: 200, argentina: 150, pakistan: 150, iran: 150, slovenia: 150, armenia: 100, netherlands: 100,
  },
  "2022": {
    usa: 18000, china: 9900, france: 8000, russia: 5600, "south-korea": 4200, ukraine: 2400, japan: 2000, canada: 1600, uk: 1500, germany: 1500,
    india: 1500, sweden: 1400, spain: 1200, belgium: 1000, taiwan: 900, "united-arab-emirates": 600, czechia: 600, finland: 500, switzerland: 400,
    slovakia: 400, hungary: 400, bulgaria: 300, "south-africa": 300, brazil: 300, pakistan: 300, mexico: 300, argentina: 200, romania: 200, iran: 150,
    slovenia: 150, armenia: 100, belarus: 100, netherlands: 100,
  },
};
/** Tonnes of uranium a gigawatt of reactors burns a year. */
const URANIUM_PER_GW = 190;

/** The world's generation on each start date, TWh a year. */
const WORLD: Record<ScenarioId, number> = { "1914": 50, "1933": 290, "1939": 465, "1950": 960, "1957": 1700, "1964": 3000, "1973": 6100, "1979": 7900, "1991": 12000, "1999": 14500, "2014": 24000, "2022": 29000 };

/** Each start date as a year with its fraction: a save opened later grows into its own date. */
const START: Record<ScenarioId, number> = { "1914": 1914.49, "1933": 1933.08, "1939": 1939.67, "1950": 1950.48, "1957": 1957.76, "1964": 1964.59, "1973": 1973.76, "1979": 1979.98, "1991": 1991.63, "1999": 1999.23, "2014": 2014.04, "2022": 2022.15 };

/**
 * Generation on the start date, TWh a year, and its mix, % by source: the
 * great powers and featured countries as history had them (the year before
 * the date where the date's own is not yet counted); peat, shale and wood
 * counted as coal, the odd geothermal or biomass left to the rest.
 */
const STARTS: Record<ScenarioId, Record<string, string>> = {
  "1914": {
    usa: "25: coal 60 hydro 35 oil 3 gas 2",
    germany: "8: coal 88 hydro 12",
    uk: "4: coal 98 hydro 2",
    france: "1.8: coal 60 hydro 40",
    russia: "2: coal 70 oil 25 hydro 5",
    "austria-hungary": "1.6: coal 70 hydro 30",
    italy: "2.2: hydro 80 coal 20",
    japan: "1.5: hydro 55 coal 45",
    canada: "5: hydro 95 coal 5",
    switzerland: "1.3: hydro 98 coal 2",
    norway: "1.5: hydro 99 coal 1",
    sweden: "1.4: hydro 88 coal 12",
    spain: "0.5: hydro 60 coal 40",
    belgium: "0.6: coal 100",
    ottoman: "0.05: coal 100",
    serbia: "0.02: coal 80 hydro 20",
    china: "0.1: coal 100",
  },
  "1933": {
    usa: "102: coal 55 hydro 36 gas 5 oil 4",
    germany: "26: coal 87 hydro 13",
    ussr: "16: coal 86 oil 9 hydro 5",
    uk: "19: coal 98 hydro 2",
    france: "15: coal 55 hydro 45",
    italy: "12.7: hydro 90 coal 10",
    japan: "19: hydro 75 coal 25",
    china: "2: coal 90 oil 5 hydro 5",
    manchukuo: "1.5: coal 100",
    poland: "2.6: coal 97 hydro 3",
    austria: "2.5: hydro 80 coal 20",
    czechoslovakia: "3: coal 85 hydro 15",
    canada: "17: hydro 98 coal 2",
    sweden: "4.5: hydro 90 coal 10",
    norway: "7: hydro 99 coal 1",
    switzerland: "5: hydro 98 coal 2",
    spain: "3: hydro 80 coal 20",
    belgium: "3.5: coal 100",
    netherlands: "3: coal 100",
  },
  "1939": {
    usa: "161: coal 52 hydro 30 gas 10 oil 8",
    germany: "61: coal 85 hydro 15",
    ussr: "43: coal 82 hydro 10 oil 8",
    uk: "32: coal 97 hydro 3",
    japan: "34: hydro 65 coal 35",
    france: "21: hydro 50 coal 50",
    italy: "18.4: hydro 92 coal 8",
    canada: "30: hydro 98 coal 2",
    poland: "4: coal 97 hydro 3",
    china: "3: coal 90 oil 5 hydro 5",
    finland: "3: hydro 75 coal 25",
    sweden: "8: hydro 85 coal 15",
    norway: "10: hydro 99 coal 1",
    switzerland: "7: hydro 99 coal 1",
    spain: "3: hydro 70 coal 30",
    belgium: "5: coal 100",
    netherlands: "4: coal 100",
    australia: "4.5: coal 90 hydro 10",
    "south-africa": "5: coal 100",
    brazil: "1.5: hydro 85 coal 15",
  },
  "1950": {
    usa: "389: coal 47 hydro 29 gas 14 oil 10",
    ussr: "91: coal 75 hydro 14 oil 8 gas 3",
    uk: "66: coal 97 hydro 2 oil 1",
    france: "33: hydro 50 coal 48 oil 2",
    japan: "46: hydro 80 coal 20",
    china: "4.6: coal 80 hydro 15 oil 5",
    "north-korea": "6: hydro 90 coal 10",
    "south-korea": "0.6: coal 60 hydro 40",
    taiwan: "1.6: hydro 70 coal 30",
    "viet-minh": "0.05: coal 100",
    "west-germany": "44: coal 80 hydro 18 oil 2",
    "east-germany": "19: coal 98 hydro 2",
    canada: "55: hydro 93 coal 6 oil 1",
    italy: "25: hydro 85 coal 8 oil 4 gas 3",
    india: "5.1: coal 60 hydro 38 oil 2",
    poland: "9.4: coal 98 hydro 2",
    czechoslovakia: "9.3: coal 90 hydro 10",
    sweden: "18: hydro 95 coal 5",
    norway: "17.6: hydro 99 oil 1",
    switzerland: "10.6: hydro 98 coal 2",
    spain: "7: hydro 75 coal 25",
    brazil: "8.2: hydro 80 oil 10 coal 10",
    australia: "10: coal 90 hydro 10",
    "south-africa": "10: coal 100",
    mexico: "4.4: hydro 50 oil 40 gas 5 coal 5",
    argentina: "4.4: oil 75 coal 15 hydro 10",
    belgium: "9: coal 100",
    netherlands: "7: coal 95 oil 5",
    austria: "5: hydro 75 coal 25",
  },
  "1957": {
    usa: "716: coal 54 gas 20 hydro 19 oil 7",
    ussr: "210: coal 70 hydro 16 oil 7 gas 7",
    uk: "105: coal 92 oil 5 hydro 2 nuclear 1",
    france: "57: hydro 50 coal 45 oil 5",
    "west-germany": "87: coal 82 hydro 12 oil 4 gas 2",
    "east-germany": "29: coal 98 hydro 2",
    japan: "81: hydro 63 coal 33 oil 4",
    china: "19: coal 72 hydro 25 oil 3",
    india: "11: coal 55 hydro 43 oil 2",
    egypt: "2.5: oil 70 hydro 20 coal 10",
    turkey: "2.6: coal 60 hydro 30 oil 10",
    syria: "0.3: oil 100",
    canada: "87: hydro 92 coal 7 oil 1",
    italy: "42: hydro 75 coal 12 oil 8 gas 5",
    poland: "19: coal 98 hydro 2",
    czechoslovakia: "18: coal 88 hydro 12",
    sweden: "26: hydro 92 coal 4 oil 4",
    norway: "27: hydro 99 oil 1",
    spain: "15: hydro 70 coal 30",
    australia: "20: coal 85 hydro 15",
    brazil: "18: hydro 85 oil 10 coal 5",
    "south-africa": "18: coal 100",
    israel: "1.4: oil 100",
    mexico: "9: hydro 45 oil 45 gas 10",
    argentina: "8: oil 80 hydro 10 coal 10",
  },
  "1964": {
    usa: "1083: coal 54 gas 24 hydro 17 oil 5 nuclear 0.5",
    ussr: "459: coal 60 hydro 17 gas 15 oil 8",
    uk: "178: coal 82 oil 8 nuclear 7 hydro 3",
    france: "93: hydro 45 coal 42 oil 10 gas 2 nuclear 1",
    china: "56: coal 75 hydro 22 oil 3",
    japan: "165: hydro 40 coal 32 oil 28",
    "north-vietnam": "0.8: coal 80 hydro 20",
    "south-vietnam": "0.6: oil 70 hydro 30",
    laos: "0.03: hydro 100",
    indonesia: "2: oil 50 hydro 40 coal 10",
    "west-germany": "154: coal 75 hydro 10 oil 8 gas 5 nuclear 2",
    "east-germany": "50: coal 98 hydro 2",
    italy: "75: hydro 55 oil 20 gas 15 coal 8 nuclear 2",
    canada: "135: hydro 85 coal 12 oil 3",
    india: "35: coal 50 hydro 45 oil 5",
    poland: "37: coal 99 hydro 1",
    czechoslovakia: "32: coal 85 hydro 15",
    sweden: "45: hydro 90 oil 10",
    norway: "47: hydro 100",
    spain: "29: hydro 60 coal 30 oil 10",
    australia: "34: coal 85 hydro 15",
    brazil: "27: hydro 85 oil 10 coal 5",
    "south-africa": "30: coal 100",
    mexico: "17: hydro 45 oil 45 gas 10",
    argentina: "15: oil 75 gas 10 hydro 10 coal 5",
    israel: "3: oil 100",
  },
  "1973": {
    usa: "1960: coal 46 gas 18 oil 17 hydro 14 nuclear 5",
    ussr: "915: coal 45 gas 20 oil 19 hydro 14 nuclear 2",
    japan: "465: oil 72 hydro 17 coal 5 gas 3 nuclear 3",
    "west-germany": "299: coal 65 oil 13 gas 12 hydro 6 nuclear 4",
    "east-germany": "80: coal 90 oil 4 nuclear 4 hydro 2",
    uk: "281: coal 62 oil 25 nuclear 10 hydro 2 gas 1",
    france: "182: oil 40 hydro 26 coal 20 nuclear 8 gas 6",
    italy: "146: oil 60 hydro 26 gas 7 coal 5 nuclear 2",
    china: "167: coal 72 hydro 20 oil 8",
    canada: "270: hydro 74 coal 15 nuclear 6 oil 3 gas 2",
    india: "72: coal 55 hydro 40 nuclear 3 oil 2",
    spain: "76: hydro 38 oil 28 coal 24 nuclear 9 gas 1",
    portugal: "10: hydro 72 oil 25 coal 3",
    poland: "84: coal 97 hydro 2 oil 1",
    czechoslovakia: "55: coal 86 hydro 7 oil 6 nuclear 1",
    sweden: "78: hydro 70 oil 22 coal 5 nuclear 3",
    australia: "63: coal 75 hydro 15 oil 5 gas 5",
    brazil: "65: hydro 90 oil 8 coal 2",
    "south-africa": "70: coal 99 hydro 1",
    mexico: "37: oil 45 hydro 40 gas 12 coal 3",
    argentina: "22: oil 65 gas 17 hydro 15 coal 3",
    chile: "8: hydro 60 oil 25 coal 15",
    egypt: "8: hydro 70 oil 25 gas 5",
    israel: "8: oil 100",
    syria: "1.4: oil 90 hydro 10",
    "saudi-arabia": "2: oil 70 gas 30",
    iran: "12: oil 50 gas 30 hydro 20",
    "north-vietnam": "2.5: coal 70 hydro 30",
    "south-vietnam": "2: oil 80 hydro 20",
  },
  "1979": {
    usa: "2320: coal 48 gas 15 oil 13 hydro 12 nuclear 12",
    ussr: "1238: coal 37 gas 25 oil 20 hydro 13 nuclear 5",
    japan: "590: oil 52 hydro 15 nuclear 13 gas 11 coal 9",
    "west-germany": "372: coal 63 gas 15 nuclear 11 oil 6 hydro 5",
    "east-germany": "96: coal 87 nuclear 10 oil 2 hydro 1",
    uk: "300: coal 73 oil 12 nuclear 12 hydro 2 gas 1",
    france: "241: hydro 28 coal 27 oil 25 nuclear 16 gas 4",
    italy: "181: oil 57 hydro 26 coal 9 gas 7 nuclear 1",
    china: "282: coal 64 oil 18 hydro 18",
    canada: "352: hydro 68 coal 16 nuclear 10 oil 3 gas 3",
    india: "110: coal 55 hydro 42 nuclear 2 oil 1",
    pakistan: "12: hydro 55 gas 35 oil 9 nuclear 1",
    afghanistan: "0.9: hydro 70 gas 20 oil 10",
    iran: "18: gas 40 oil 40 hydro 20",
    iraq: "11: oil 70 gas 15 hydro 15",
    israel: "12: oil 100",
    "saudi-arabia": "11: oil 70 gas 30",
    vietnam: "4: coal 60 hydro 30 oil 10",
    poland: "117: coal 97 hydro 2 oil 1",
    czechoslovakia: "68: coal 82 hydro 6 nuclear 6 oil 6",
    sweden: "89: hydro 64 nuclear 22 oil 12 coal 2",
    spain: "106: hydro 39 coal 30 oil 23 nuclear 7 gas 1",
    australia: "92: coal 76 hydro 14 gas 6 oil 4",
    brazil: "132: hydro 92 oil 6 coal 2",
    "south-africa": "93: coal 99 hydro 1",
    mexico: "59: oil 56 hydro 30 gas 12 coal 2",
    argentina: "34: oil 43 hydro 26 gas 22 nuclear 9",
    "south-korea": "35: oil 73 coal 12 nuclear 9 hydro 6",
    taiwan: "30: oil 70 coal 15 hydro 10 nuclear 5",
  },
  "1991": {
    usa: "3070: coal 54 nuclear 21 gas 12 hydro 9 oil 4",
    ussr: "1680: gas 40 coal 20 oil 15 hydro 13 nuclear 12",
    russia: "1080: gas 42 coal 18 hydro 16 oil 13 nuclear 11",
    ukraine: "296: coal 50 nuclear 25 gas 15 oil 6 hydro 4",
    kazakhstan: "87: coal 75 gas 12 hydro 9 oil 4",
    lithuania: "28: nuclear 60 oil 22 gas 15 hydro 3",
    georgia: "14: hydro 55 gas 45",
    china: "678: coal 80 hydro 19 oil 1",
    germany: "540: coal 58 nuclear 28 gas 7 hydro 4 oil 3",
    japan: "860: oil 28 nuclear 25 gas 20 coal 15 hydro 12",
    france: "455: nuclear 74 hydro 14 coal 9 oil 2 gas 1",
    uk: "320: coal 65 nuclear 21 oil 10 gas 2 hydro 2",
    yugoslavia: "80: coal 65 hydro 30 nuclear 5",
    czechoslovakia: "86: coal 70 nuclear 25 hydro 5",
    poland: "135: coal 97 hydro 2 gas 1",
    india: "300: coal 70 hydro 25 gas 3 nuclear 2",
    iraq: "29: oil 70 gas 15 hydro 15",
    ethiopia: "1.2: hydro 90 oil 10",
    canada: "490: hydro 60 coal 17 nuclear 16 gas 4 oil 3",
    italy: "222: oil 48 gas 19 hydro 18 coal 15",
    brazil: "235: hydro 92 oil 3 coal 2 gas 2 nuclear 1",
    "south-korea": "118: nuclear 50 coal 20 oil 20 hydro 5 gas 5",
    spain: "155: coal 40 nuclear 35 hydro 17 oil 6 gas 2",
    sweden: "145: hydro 50 nuclear 47 oil 3",
    mexico: "125: oil 55 hydro 20 gas 13 coal 8 nuclear 4",
    "south-africa": "165: coal 94 nuclear 5 hydro 1",
    australia: "155: coal 80 hydro 11 gas 9",
    iran: "60: oil 50 gas 40 hydro 10",
    turkey: "57: coal 35 hydro 35 gas 30",
    "saudi-arabia": "70: oil 70 gas 30",
    taiwan: "90: coal 40 nuclear 35 oil 18 hydro 7",
    netherlands: "74: gas 55 coal 38 nuclear 5 oil 2",
    belgium: "70: nuclear 60 coal 28 gas 8 oil 2 hydro 2",
    switzerland: "57: hydro 57 nuclear 40 oil 3",
  },
  "1999": {
    usa: "3840: coal 51 nuclear 20 gas 16 hydro 8 oil 3",
    russia: "846: gas 43 coal 19 hydro 19 nuclear 14 oil 5",
    china: "1240: coal 80 hydro 18 nuclear 1 oil 1",
    germany: "550: coal 52 nuclear 31 gas 10 hydro 4 oil 2 wind 1",
    uk: "368: gas 39 coal 29 nuclear 26 oil 2 hydro 2",
    france: "520: nuclear 77 hydro 14 coal 6 gas 2 oil 1",
    japan: "1050: nuclear 32 gas 25 coal 18 oil 15 hydro 10",
    yugoslavia: "32: coal 65 hydro 33 gas 2",
    montenegro: "2.5: hydro 70 coal 30",
    albania: "5: hydro 97 oil 3",
    macedonia: "6.5: coal 85 hydro 15",
    kosovo: "4.5: coal 98 hydro 2",
    india: "480: coal 75 hydro 18 gas 4 nuclear 3",
    canada: "580: hydro 60 coal 19 nuclear 13 gas 6 oil 2",
    italy: "260: gas 37 oil 33 hydro 19 coal 11",
    brazil: "330: hydro 90 oil 5 gas 2 coal 2 nuclear 1",
    spain: "205: coal 37 nuclear 28 hydro 15 gas 10 oil 10",
    "south-korea": "266: nuclear 39 coal 37 gas 11 oil 11 hydro 2",
    mexico: "190: oil 47 gas 18 hydro 17 coal 10 nuclear 5",
    ukraine: "172: nuclear 44 coal 30 gas 18 hydro 8",
    poland: "142: coal 96 gas 2 hydro 2",
    turkey: "116: gas 32 coal 31 hydro 30 oil 7",
    iran: "115: gas 70 oil 20 hydro 10",
    australia: "200: coal 80 gas 10 hydro 9 oil 1",
    "south-africa": "200: coal 92 nuclear 7 hydro 1",
    taiwan: "160: coal 50 nuclear 21 oil 15 gas 10 hydro 4",
    "saudi-arabia": "120: oil 55 gas 45",
    netherlands: "86: gas 60 coal 30 nuclear 4 oil 4 wind 1",
    belgium: "83: nuclear 58 gas 20 coal 18 oil 2 hydro 2",
    sweden: "155: hydro 47 nuclear 47 oil 3 coal 3",
  },
  "2014": {
    usa: "4300: coal 39 gas 27 nuclear 19 hydro 6 wind 4.5 oil 1 solar 0.5",
    china: "5650: coal 72 hydro 19 wind 3 nuclear 2.5 gas 2 solar 0.5",
    russia: "1060: gas 50 nuclear 17 hydro 17 coal 15 oil 1",
    ukraine: "182: nuclear 48 coal 39 gas 7 hydro 5 solar 1",
    belarus: "34: gas 97 oil 2 hydro 1",
    poland: "159: coal 85 gas 6 wind 5 hydro 2 oil 2",
    germany: "627: coal 46 nuclear 16 gas 12 wind 10 solar 6 hydro 4 oil 1",
    uk: "338: gas 30 coal 30 nuclear 19 wind 9.5 hydro 2 solar 1.5 oil 1",
    france: "562: nuclear 77 hydro 12 wind 3 gas 3 coal 2 solar 1 oil 1",
    lithuania: "4: gas 35 wind 30 hydro 25 oil 8 solar 2",
    turkey: "252: gas 48 coal 30 hydro 16 wind 3 oil 1",
    india: "1290: coal 75 hydro 11 gas 5 wind 3 nuclear 3 oil 2 solar 1",
    japan: "1040: gas 43 coal 33 oil 11 hydro 8 solar 2 wind 0.5",
    italy: "280: gas 33 hydro 21 coal 16 solar 8 wind 5 oil 5",
    iran: "280: gas 72 oil 18 hydro 6 nuclear 2",
    moldova: "1: gas 90 hydro 10",
    georgia: "10.4: hydro 78 gas 22",
    kazakhstan: "94: coal 75 gas 14 hydro 10 oil 1",
    hungary: "29: nuclear 53 coal 20 gas 17 wind 2 hydro 1",
    romania: "65: hydro 29 coal 27 nuclear 18 gas 13 wind 10 solar 3",
    finland: "68: nuclear 35 hydro 20 coal 15 gas 8 wind 2",
    sweden: "154: hydro 42 nuclear 41 wind 7 coal 1",
    "north-korea": "21: hydro 60 coal 40",
    "south-korea": "540: coal 40 nuclear 30 gas 22 oil 4 hydro 1 solar 1",
    taiwan: "260: coal 45 gas 30 nuclear 16 oil 5 hydro 2 wind 1",
    "saudi-arabia": "310: oil 50 gas 50",
    brazil: "590: hydro 65 gas 14 oil 7 coal 3 nuclear 3 wind 2",
    canada: "650: hydro 59 nuclear 16 gas 10 coal 10 wind 4 oil 1",
    australia: "250: coal 63 gas 20 hydro 7 wind 4 solar 2 oil 2",
    mexico: "300: gas 55 oil 13 hydro 13 coal 11 nuclear 3 wind 3",
    spain: "278: nuclear 21 wind 20 coal 16 hydro 15 gas 9 solar 5 oil 5",
    "south-africa": "250: coal 92 nuclear 5 hydro 2 wind 1",
    indonesia: "228: coal 52 gas 24 oil 10 hydro 7",
    israel: "65: gas 50 coal 48 solar 2",
  },
  "2022": {
    usa: "4550: gas 39 coal 20 nuclear 18 wind 10 hydro 6 solar 5 oil 1",
    china: "8530: coal 63 hydro 15 wind 8 nuclear 5 solar 4 gas 3",
    russia: "1150: gas 43 nuclear 19 hydro 18 coal 17 oil 1 wind 0.5",
    ukraine: "156: nuclear 55 coal 23 gas 9 hydro 7 solar 5 wind 2",
    belarus: "40: gas 63 nuclear 33 hydro 1 solar 1 wind 1 oil 1",
    poland: "180: coal 72 wind 11 gas 9 solar 4 hydro 2 oil 2",
    germany: "585: coal 31 wind 20 gas 15 nuclear 12 solar 9 hydro 4 oil 1",
    uk: "320: gas 40 wind 22 nuclear 15 solar 4 hydro 2 coal 2 oil 1",
    france: "520: nuclear 69 hydro 12 wind 7 gas 7 solar 3 coal 1 oil 1",
    turkey: "330: gas 33 coal 31 hydro 17 wind 10 solar 4",
    india: "1700: coal 74 hydro 10 solar 5 wind 4 gas 4 nuclear 3",
    japan: "1030: gas 34 coal 31 solar 9 hydro 8 nuclear 6 oil 4 wind 1",
    italy: "285: gas 50 hydro 16 solar 9 wind 7 coal 5 oil 4",
    iran: "360: gas 82 oil 10 hydro 5 nuclear 2 solar 1",
    israel: "73: gas 69 coal 22 solar 9",
    moldova: "1: gas 85 wind 8 hydro 7",
    georgia: "14: hydro 75 gas 24 wind 1",
    kazakhstan: "114: coal 66 gas 22 hydro 8 wind 3 solar 1",
    finland: "70: nuclear 34 hydro 23 wind 12 coal 7 gas 4",
    sweden: "167: hydro 44 nuclear 31 wind 17 coal 1 solar 1",
    hungary: "36: nuclear 44 gas 26 solar 12 coal 9 wind 2",
    romania: "58: hydro 30 nuclear 20 coal 17 gas 16 wind 12 solar 3",
    lithuania: "4.8: wind 35 gas 25 hydro 20 solar 10 oil 10",
    "north-korea": "26: hydro 60 coal 40",
    "south-korea": "580: coal 35 gas 30 nuclear 27 solar 4 oil 2 hydro 1 wind 1",
    taiwan: "290: coal 45 gas 37 nuclear 10 solar 4 oil 2 hydro 1 wind 1",
    "saudi-arabia": "400: gas 60 oil 40",
    brazil: "660: hydro 56 gas 13 wind 11 coal 4 solar 3 oil 3 nuclear 2",
    canada: "640: hydro 60 nuclear 14 gas 11 wind 6 coal 6 solar 1 oil 1",
    australia: "270: coal 52 gas 18 solar 13 wind 11 hydro 6",
    mexico: "340: gas 60 oil 9 hydro 9 wind 6 coal 5 solar 5 nuclear 4",
    spain: "270: gas 23 wind 23 nuclear 21 hydro 11 solar 10 oil 5 coal 3",
    "south-africa": "235: coal 85 nuclear 5 wind 4 solar 3 hydro 2 oil 1",
    indonesia: "310: coal 63 gas 17 hydro 8 oil 3",
    vietnam: "250: coal 50 hydro 30 solar 10 gas 7 wind 3",
  },
};

/** An era's mix for a country history gives no figures for, before its own coal, oil, gas and rivers lean it. */
const DEFAULT_MIX: Record<ScenarioId, string> = {
  "1914": "coal 70 hydro 28 oil 2",
  "1933": "coal 64 hydro 32 oil 3 gas 1",
  "1939": "coal 62 hydro 32 oil 4 gas 2",
  "1950": "coal 55 hydro 33 oil 8 gas 4",
  "1957": "coal 50 hydro 32 oil 12 gas 6",
  "1964": "coal 45 hydro 30 oil 17 gas 8",
  "1973": "coal 38 oil 27 hydro 25 gas 10",
  "1979": "coal 36 oil 26 hydro 25 gas 13",
  "1991": "coal 35 oil 22 gas 20 hydro 23",
  "1999": "coal 32 oil 18 gas 25 hydro 25",
  "2014": "coal 30 oil 10 gas 33 hydro 23 wind 3 solar 1",
  "2022": "coal 27 oil 8 gas 35 hydro 21 wind 5 solar 4",
};

/** What the world built in each age, from the year given: the era's mix for new plants. */
const BUILD_MIX: [number, string][] = [
  [0, "coal 62 hydro 35 oil 3"],
  [1945, "coal 58 hydro 32 oil 7 gas 3"],
  [1955, "coal 52 hydro 26 oil 12 gas 10"],
  [1965, "coal 42 hydro 22 oil 20 gas 12 nuclear 4"],
  [1973, "coal 38 hydro 18 nuclear 20 oil 12 gas 12"],
  [1985, "coal 40 nuclear 25 hydro 17 gas 13 oil 5"],
  [1995, "gas 40 coal 32 hydro 13 nuclear 10 wind 5"],
  [2005, "coal 35 gas 30 hydro 12 wind 12 solar 6 nuclear 5"],
  [2015, "solar 25 wind 22 coal 22 gas 18 hydro 8 nuclear 5"],
  [2021, "solar 42 wind 24 gas 14 coal 12 hydro 5 nuclear 3"],
];

/** What a gigawatt of each kind costs to build, $bn of 2020, by year: wind and above all solar have grown cheap. Read at the game's prices (engine/prices.ts). */
const COST: Record<EnergySource, [number, number][]> = {
  coal: [[0, 2]],
  oil: [[0, 1.3]],
  gas: [[0, 1]],
  hydro: [[0, 2.6]],
  nuclear: [[1955, 4], [1975, 4.5], [1990, 6], [2022, 6.5]],
  wind: [[1985, 5], [2000, 2.2], [2014, 1.8], [2022, 1.4]],
  solar: [[2000, 10], [2010, 4], [2014, 2.2], [2022, 1]],
};
/** How much faster than the economy the demand for electricity grows, by year: the age of electrification, then less. */
const ELASTIC: [number, number][] = [[1914, 1], [1973, 1], [1990, 0.7], [2005, 0.45], [2022, 0.35]];
/** Electrification on top of growth, a share a year: homes and factories wired, machines driven by the grid. */
const ELECTRIFY: [number, number][] = [[1914, 0.04], [1960, 0.035], [1973, 0.02], [1990, 0.01], [2022, 0.008]];
/** How fast a save opened after its start date grows into it, a share a year. */
const HISTORY_GROWTH: [number, number][] = [[1914, 0.065], [1945, 0.07], [1973, 0.035], [1990, 0.025], [2010, 0.02]];

/** Capacity over demand on the start date: the spare history's grids kept. */
const START_MARGIN = 1.08;
/** What a government's planners aim for, and how far ahead they look, years. */
const MARGIN = 1.1;
const LEAD = 3;
/** The player's country's planners only keep the lights on: a year ahead, a little spare, once the gap passes a share of demand. */
const PLAYER_LEAD = 1;
const PLAYER_MARGIN = 1.03;
const PLAYER_GAP = 0.04;
/** The planners' pipeline comes on line a share of what is left each year: on average after this share of the years its kind takes. */
const PIPELINE = 0.5;
/** The most of the industry line plants under construction take a year: the player's, any other government's. */
export const POWER_SHARE = { player: 0.5, other: 0.45, most: 0.75 };
/** How much more of it a government short of power gives its plants, for each share of demand unmet. */
const SHORT_PUSH = 1.5;
/**
 * A front destroys the plants of the land it runs through, a share of the whole book a year for each share of the land it
 * runs through, and no more than this share of the plants of that land: it does not go on wrecking the land behind it.
 */
const FRONT_DAMAGE = 0.5;
const FRONT_MAX = 0.9;
/** Of the plants a front wrecked, the share repaired a year once it has gone. */
const REPAIRED = 0.25;
/** Of the plants in land that passes for good, the share that still works for its new holder. */
const CAPTURED = 0.6;
/** A shortage this deep is news; one this shallow is over. */
const SHORT_NEWS = 0.1;
const SHORT_OVER = 0.03;

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

/** "coal 47 hydro 29" as a mix, made whole. */
function mixOf(text: string): Mix {
  const parts = text.trim().split(/\s+/);
  const out: Mix = {};
  for (let i = 0; i + 1 < parts.length; i += 2) out[parts[i] as EnergySource] = Number(parts[i + 1]);
  return normalise(out);
}

/** A mix whose shares add up to 1. */
function normalise(m: Mix): Mix {
  const sum = ENERGY_SOURCES.reduce((s, x) => s + Math.max(0, m[x] ?? 0), 0);
  if (sum <= 0) return {};
  const out: Mix = {};
  for (const x of ENERGY_SOURCES) if ((m[x] ?? 0) > 0) out[x] = m[x]! / sum;
  return out;
}

/** "389: coal 47 hydro 29 gas 14 oil 10": generation on the date and its mix. */
function startOf(era: ScenarioId, tag: string): { twh: number; mix: Mix } | null {
  const row = STARTS[era][tag];
  if (!row) return null;
  const [twh, mix] = row.split(":");
  return { twh: Number(twh), mix: mixOf(mix) };
}

/** What a gigawatt of a kind costs to build in a year, $bn of the day: the year's real cost at the game's prices (the start date's, moved by the era's dollar). */
export function costPerGw(source: EnergySource, year: number, era?: ScenarioId): number {
  return byYear(COST[source], year) * gamePrices(era, year);
}

/** A plant's cost, $bn of the day. */
const plantCost = (source: EnergySource, gw: number, year: number, era?: ScenarioId) => round(gw * costPerGw(source, year, era), 4);

/** Capacity a book could deliver at full fuel and land, TWh a year. */
export function capacityOf(book: Pick<PowerBook, "gw">): number {
  return ENERGY_SOURCES.reduce((s, x) => s + twhOf(x, book.gw[x] ?? 0), 0);
}

/** What the plants under construction will add, TWh a year. */
const pipelineOf = (book: PowerBook) => (book.building ?? []).reduce((s, w) => s + twhOf(w.source, w.gw), 0);

/** The value of a province's people: what its plants serve, so what the land takes with it. */
const valueOf = (r: RegionState, p: MapRegion | undefined) => peopleIn(r, p) * (p?.inc ?? 3000);

/** A country's land as its plants see it: what it counts as its own, what it holds of it, what the front runs through, its people and rivers. */
interface Land {
  owned: number;
  held: number;
  front: number;
  occupied: number;
  people: number;
  /** Rivers and mountains for dams: the share of its land that has them, 0–1. */
  rivers: number;
  area: number;
}

/** Every country's land in one pass over the provinces. */
export function landOf(state: Pick<GameState, "regions">, map: Record<string, MapRegion>): Map<string, Land> {
  const out = new Map<string, Land>();
  for (const [id, r] of Object.entries(state.regions)) {
    const p = map[id];
    if (!p) continue;
    const tag = countsFor(r);
    let land = out.get(tag);
    if (!land) out.set(tag, (land = { owned: 0, held: 0, front: 0, occupied: 0, people: 0, rivers: 0, area: 0 }));
    const v = valueOf(r, p);
    land.owned += v;
    land.people += peopleIn(r, p);
    const area = p.area ?? 0;
    land.area += area;
    land.rivers += area * Math.min(1, (p.rv?.length ? 0.25 : 0) + (p.terrain === "mountains" ? 0.75 : p.terrain === "hills" ? 0.35 : 0));
    if (r.controller === tag) {
      const kept = r.contested ? (100 - (r.held ?? 30)) / 100 : 1;
      land.held += v * kept;
      if (r.contested) land.front += v;
    } else {
      land.occupied += v;
      if (r.contested === tag) {
        land.held += (v * (r.held ?? 30)) / 100;
        land.front += v;
      }
    }
  }
  for (const land of out.values()) land.rivers = land.area > 0 ? land.rivers / land.area : 0.3;
  return out;
}

/** The share of its plants a country can use: the land it holds of what it counts as its own. */
const controlOf = (land: Land | undefined) => (land && land.owned > 0 ? clamp(land.held / land.owned, 0, 1) : 1);

/** How much of a fuel's need a country can cover: what it digs, imports while trade is open and paid for, its stores while they last. */
export function fuelCover(a: Accounts | undefined, e: Pick<Economy, "tradeCut" | "reserves" | "gdp" | "stocks">, type: ResourceType): number {
  const need = a?.need[type] ?? 0;
  if (!a || need <= 0) return 1;
  const own = Math.min(1, (a.production[type] ?? 0) / need);
  const rest = 1 - own;
  const cut = clamp(e.tradeCut, 0, 1);
  const broke = e.reserves / Math.max(0.01, e.gdp) < 0.01;
  let covered = own + rest * (1 - cut) * (broke ? 0.6 : 1);
  // Cut off, it lives off its stores while they last.
  if (rest > 0 && cut > 0 && !a.shortages.includes(type) && (e.stocks[type] ?? 3) > 0) covered = 1;
  return clamp(covered, 0, 1);
}

/** What a country's plants deliver now: by source, with their fuel and the land it holds. */
export interface PowerFlow {
  /** TWh a year, by source, before demand caps it. */
  by: Partial<Record<EnergySource, number>>;
  supply: number;
  demand: number;
  short: number;
  /** The fuel each burning kind has, 0–1. */
  fuel: Partial<Record<EnergySource, number>>;
  /** The share of its plants in land it holds. */
  control: number;
}

/**
 * A country's electricity now, from its book, its fuel (the accounts) and its land: the plants in land an enemy holds are
 * off its supply, and the people there off its demand – an occupation alone darkens no one at home.
 */
export function flowOf(book: PowerBook, e: Economy | undefined, a: Accounts | undefined, land: Land | undefined): PowerFlow {
  const control = controlOf(land);
  const by: PowerFlow["by"] = {};
  const fuel: PowerFlow["fuel"] = {};
  let supply = 0;
  for (const s of ENERGY_SOURCES) {
    const gw = book.gw[s] ?? 0;
    if (gw <= 0) continue;
    const type = FUEL[s];
    const f = type && e ? fuelCover(a, e, type) : 1;
    if (type) fuel[s] = round(f, 3);
    const twh = twhOf(s, gw) * f * control;
    by[s] = twh;
    supply += twh;
  }
  const demand = book.demand * control;
  const short = demand > 0 ? clamp(1 - supply / demand, 0, 1) : 0;
  return { by, supply, demand, short, fuel, control };
}

/** The mix a book delivers: shares of what it gives, by source, the largest first. */
export function shares(flow: Pick<PowerFlow, "by">): [EnergySource, number][] {
  const total = ENERGY_SOURCES.reduce((s, x) => s + (flow.by[x] ?? 0), 0);
  if (total <= 0) return [];
  return ENERGY_SOURCES.flatMap((x): [EnergySource, number][] => ((flow.by[x] ?? 0) > 0 ? [[x, (flow.by[x] ?? 0) / total]] : [])).sort((a, b) => b[1] - a[1]);
}

/** The mix of a book's capacity at full fuel and land, by source. */
const capacityMix = (book: Pick<PowerBook, "gw">) => shares({ by: Object.fromEntries(ENERGY_SOURCES.map((x) => [x, twhOf(x, book.gw[x] ?? 0)])) });

/** A country's own coal, oil and gas against its need, 0–2: what it would rather burn. */
function selfOf(a: Accounts | undefined, type: ResourceType): number {
  const need = a?.need[type] ?? 0;
  if (!a || need <= 0) return (a?.production[type] ?? 0) > 0 ? 2 : 0;
  return clamp((a.production[type] ?? 0) / need, 0, 2);
}

/** A mix leaned by what the country has: its own coal, oil and gas, its rivers and mountains for dams. */
function lean(base: Mix, a: Accounts | undefined, land: Land | undefined): Mix {
  if (!a && !land) return base;
  const out: Mix = { ...base };
  if (a) {
    if (out.coal) out.coal *= 0.35 + 0.65 * Math.min(1.5, selfOf(a, "coal"));
    if (out.oil) out.oil *= 0.4 + 0.8 * selfOf(a, "oil");
    if (out.gas) out.gas *= 0.25 + 0.9 * selfOf(a, "gas");
  }
  if (land && out.hydro) out.hydro *= 0.2 + 1.6 * land.rivers;
  return normalise(out);
}

/** Whether a country can build a kind of plant this year: reactors once nuclear power is known (for the player, by its own research), wind and sun once they pay. */
export function canBuild(state: Pick<GameState, "player" | "date"> & Partial<Pick<GameState, "research" | "atom">>, tag: string, source: EnergySource): boolean {
  const year = yearFraction(state.date);
  const opens = OPENS[source];
  if (opens === undefined) return true;
  if (source === "nuclear") {
    if (tag === state.player && state.research?.tech) return techYear({ research: state.research, date: state.date }, "industry") >= opens;
    // Abroad: a government with a reactor of its own once power is known, everyone a decade later.
    const reactor = state.atom?.programmes[tag]?.done.some((d) => d.id === "reactor");
    return year >= (reactor ? opens : opens + 10);
  }
  return year >= opens;
}

/** The mix a country builds now: the era's, leaned by what it has, with a part of its own mix for habit; only what it can build. */
export function buildMix(state: Pick<GameState, "player" | "date" | "energy"> & Partial<Pick<GameState, "research" | "atom">>, tag: string, a: Accounts | undefined, land: Land | undefined): Mix {
  const year = yearFraction(state.date);
  const era = mixOf([...BUILD_MIX].reverse().find(([y]) => year >= y)![1]);
  const leaned = lean(era, a, land);
  const book = state.energy?.[tag];
  const own = book ? Object.fromEntries(capacityMix(book)) : {};
  const out: Mix = {};
  for (const s of ENERGY_SOURCES) {
    if (!canBuild(state, tag, s)) continue;
    let w = 0.6 * (leaned[s] ?? 0) + 0.4 * ((own as Mix)[s] ?? 0);
    // A country with reactors keeps building them; one without starts slowly.
    if (s === "nuclear") w *= (book?.gw.nuclear ?? 0) > 0 ? 1.3 : 0.5;
    if (w > 0) out[s] = w;
  }
  return normalise(out);
}

/** A share a year the demand for electricity grows: the economy's growth stretched by the age, and electrification on top; faster in a poor country. */
function demandRate(e: Pick<Economy, "growth">, year: number, poor: boolean): number {
  return clamp((e.growth / 100) * byYear(ELASTIC, year) * (poor ? 1.1 : 1) + byYear(ELECTRIFY, year) * (poor ? 1.15 : 1), -0.1, 0.12);
}

/** A book opened from history's figures: generation and its mix, grown into the save's date, with the start's spare capacity. */
function openBook(twh: number, mix: Mix, grow: number): PowerBook {
  const demand = twh * grow;
  const gw: PowerBook["gw"] = {};
  for (const s of ENERGY_SOURCES) {
    const share = mix[s] ?? 0;
    if (share > 0) gw[s] = round((demand * share * START_MARGIN) / (LOAD[s] * HOURS), 4);
  }
  return { gw, demand: round(demand, 3), supply: round(demand, 3), short: 0, ...((gw.nuclear ?? 0) > 0 ? { base: gw.nuclear } : {}) };
}

/** How many times a start date's demand a save opened later has grown into. */
function grownSince(era: ScenarioId, date: string): number {
  const years = Math.max(0, yearFraction(date) - START[era]);
  return Math.exp(byYear(HISTORY_GROWTH, START[era]) * years);
}

type SeedState = Pick<GameState, "countries" | "regions" | "scenarioId" | "date">;

/**
 * Every country's power on its start date: history's generation and mix
 * where the game has them, for the rest the era's mix leaned by what the
 * country has and the world's generation left over, shared by the size of
 * each economy and how rich its people are; reactors of the day added. A
 * save opened after its start date grows into its own date.
 */
export function startingEnergy(state: SeedState, map?: Record<string, MapRegion> | null, accounts?: Map<string, Accounts> | null): Record<string, PowerBook> {
  const era = state.scenarioId;
  const grow = grownSince(era, state.date);
  const lands = map ? landOf(state, map) : null;
  const live = Object.values(state.countries).filter((c) => c.economy && !c.dormant);
  let worldGdp = 0;
  let worldPeople = 0;
  for (const c of live) {
    worldGdp += c.economy!.gdp;
    worldPeople += lands?.get(c.tag)?.people ?? 0;
  }
  const perHead = worldPeople > 0 ? worldGdp / worldPeople : 0;
  const weight = (tag: string) => {
    const e = state.countries[tag].economy!;
    const people = lands?.get(tag)?.people ?? 0;
    if (!people || !perHead) return e.gdp;
    return e.gdp * clamp(Math.sqrt(e.gdp / people / perHead), 0.3, 2);
  };
  let listed = 0;
  let listedGdp = 0;
  let others = 0;
  for (const c of live) {
    const s = startOf(era, c.tag);
    if (s) {
      listed += s.twh;
      listedGdp += c.economy!.gdp;
    } else others += weight(c.tag);
  }
  // The world's generation left over, shared among the rest; never less than a fifth of what the listed countries use for their size.
  const intensity = others > 0 ? Math.max((0.2 * listed) / Math.max(0.01, listedGdp), (WORLD[era] - listed) / others) : 0;
  const out: Record<string, PowerBook> = {};
  for (const c of live) {
    const s = startOf(era, c.tag);
    if (s) {
      out[c.tag] = openBook(s.twh, s.mix, grow);
      continue;
    }
    const twh = weight(c.tag) * intensity;
    let mix = lean(mixOf(DEFAULT_MIX[era]), accounts?.get(c.tag), lands?.get(c.tag));
    // The reactors of the day, where history counts them as power (from 1964).
    const tonnes = Number(era) >= 1964 ? (REACTORS[era][c.tag] ?? 0) : 0;
    if (tonnes > 0 && twh > 0) {
      const nuclear = Math.min(0.8, twhOf("nuclear", tonnes / URANIUM_PER_GW) / twh);
      mix = Object.fromEntries(Object.entries(mix).map(([k, v]) => [k, (v as number) * (1 - nuclear)]));
      mix.nuclear = nuclear;
    }
    out[c.tag] = openBook(Math.max(0.001, twh), mix, grow);
  }
  return out;
}

/** A book for a country that has none (a new state, an older save): the world's generation per dollar, the era's mix. */
function newBook(state: GameState, tag: string, a: Accounts | undefined, land: Land | undefined): PowerBook | null {
  const e = state.countries[tag]?.economy;
  if (!e) return null;
  let demand = 0;
  let gdp = 0;
  for (const [t, b] of Object.entries(state.energy ?? {})) {
    const g = state.countries[t]?.economy?.gdp ?? 0;
    if (g <= 0) continue;
    demand += b.demand;
    gdp += g;
  }
  const twh = gdp > 0 ? (e.gdp * demand) / gdp : WORLD[state.scenarioId] / 100;
  return openBook(Math.max(0.001, twh), lean(mixOf(DEFAULT_MIX[state.scenarioId]), a, land), 1);
}

/** Uranium a country's reactors and bombs call for, tonnes a year (engine/economy.ts): the start date's, moved by the reactors built and lost since. */
export function uraniumCall(state: Pick<GameState, "scenarioId"> & Partial<Pick<GameState, "energy">>, tag: string): number {
  const start = REACTORS[state.scenarioId][tag] ?? 0;
  const book = state.energy?.[tag];
  if (!book) return start;
  const gw = book.gw.nuclear ?? 0;
  const base = book.base ?? 0;
  return base > 0 ? start * (gw / base) : start + gw * URANIUM_PER_GW;
}

/** The share of demand a country went without over the last turn, 0–1. */
export const shortOf = (state: Partial<Pick<GameState, "energy">>, tag: string): number => state.energy?.[tag]?.short ?? 0;

// ---- the turn

/** Plants and demand that pass with land: what the old owner loses goes to the new one, a part of the plants wrecked on the way. */
function followPlants(energy: Record<string, PowerBook>, before: Record<string, RegionState>, after: Record<string, RegionState>, map: Record<string, MapRegion>): void {
  const owned = new Map<string, number>();
  for (const [id, r] of Object.entries(before)) {
    const tag = countsFor(r);
    owned.set(tag, (owned.get(tag) ?? 0) + valueOf(r, map[id]));
  }
  const moves = new Map<string, number>();
  for (const [id, r] of Object.entries(after)) {
    const old = before[id];
    if (!old) continue;
    const from = countsFor(old);
    const to = countsFor(r);
    if (from === to) continue;
    const total = owned.get(from) ?? 0;
    if (total <= 0) continue;
    const key = `${from}|${to}`;
    moves.set(key, (moves.get(key) ?? 0) + valueOf(old, map[id]) / total);
  }
  // Each loser's books are read as they stood, so its several losses share one base.
  const was = new Map<string, PowerBook>();
  for (const key of moves.keys()) {
    const from = key.split("|")[0];
    if (energy[from] && !was.has(from)) was.set(from, structuredClone(energy[from]));
  }
  for (const [key, f] of [...moves].sort((a, b) => a[0].localeCompare(b[0]))) {
    const [from, to] = key.split("|");
    const src = was.get(from);
    if (!src) continue;
    const share = clamp(f, 0, 1);
    const loser = energy[from];
    const gainer = (energy[to] ??= { gw: {}, demand: 0 });
    for (const s of ENERGY_SOURCES) {
      const gw = (src.gw[s] ?? 0) * share;
      if (gw <= 0) continue;
      loser.gw[s] = round(Math.max(0, (loser.gw[s] ?? 0) - gw), 4);
      gainer.gw[s] = round((gainer.gw[s] ?? 0) + gw * CAPTURED, 4);
    }
    const demand = src.demand * share;
    loser.demand = round(Math.max(0, loser.demand - demand), 3);
    gainer.demand = round(gainer.demand + demand, 3);
  }
}

/** Plants destroyed: a share of every kind. Returns the GW lost. */
function wreck(book: PowerBook, share: number): number {
  if (share <= 0) return 0;
  let lost = 0;
  for (const s of ENERGY_SOURCES) {
    const gw = book.gw[s] ?? 0;
    if (gw <= 0) continue;
    const gone = gw * clamp(share, 0, 1);
    book.gw[s] = round(gw - gone, 4);
    lost += gone;
  }
  return lost;
}

/** Every plant's capacity times `ratio`: plants a front wrecked, repaired. */
function scale(book: PowerBook, ratio: number): void {
  for (const s of ENERGY_SOURCES) if ((book.gw[s] ?? 0) > 0) book.gw[s] = round(book.gw[s]! * ratio, 4);
}

/**
 * A nuclear strike's toll on a country's plants (engine/atom.ts): the share of its land's value the province held, almost
 * all of it – and the demand of that land with them, for the city's output is charged once, in its GDP (atom.ts), not
 * again as a shortage for years after. Mutates `next`.
 */
export function strikePlants(next: GameState, tag: string, share: number): number {
  const book = next.energy?.[tag];
  if (!book) return 0;
  const gone = clamp(share, 0, 1) * 0.9;
  book.demand = round(Math.max(0.001, book.demand * (1 - gone)), 3);
  return wreck(book, gone);
}

/**
 * A plant's work a year, $bn: the government's own plants (orders, the
 * minister) evenly over the years their kind takes; a government's
 * planners' pipeline (merged by kind, `cost` what is still to pay) a share
 * of what is left each year, so it comes on line gradually, on average
 * after half the years its kind takes.
 */
const paceOf = (w: PlantWork) => (w.by === "state" ? Math.max(0, w.cost - w.paid) / (BUILD_YEARS[w.source] * PIPELINE) : w.cost / BUILD_YEARS[w.source]);

/**
 * What the plants under construction get this turn: each its year's work,
 * all of them cut alike when the part of the industry line they may take
 * is short. The government's own come on line whole once paid; the
 * planners' as the money goes in.
 */
function build(book: PowerBook, e: Economy, years: number, share: number): { done: PlantWork[]; spent: number } {
  const done: PlantWork[] = [];
  const list = book.building ?? [];
  if (!list.length) return { done, spent: 0 };
  const purse = Math.max(0, e.budget.industry) * share * years;
  const want = list.reduce((sum, w) => sum + Math.min(Math.max(0, w.cost - w.paid), paceOf(w) * years), 0);
  const cut = want > 0 ? Math.min(1, purse / want) : 0;
  const kept: PlantWork[] = [];
  let spent = 0;
  for (const w of list) {
    const left = Math.max(0, w.cost - w.paid);
    const spend = Math.min(left, paceOf(w) * years) * cut;
    spent += spend;
    if (w.by !== "state") {
      const paid = round(w.paid + spend, 4);
      if (paid >= w.cost - 1e-6) {
        book.gw[w.source] = round((book.gw[w.source] ?? 0) + w.gw, 4);
        done.push({ ...w, paid });
      } else kept.push({ ...w, paid });
      continue;
    }
    // `gw` is what is still to come, `cost` what is still to pay.
    const online = left > 0 ? w.gw * (spend / left) : w.gw;
    book.gw[w.source] = round((book.gw[w.source] ?? 0) + online, 4);
    const rest = { ...w, gw: round(w.gw - online, 4), cost: round(left - spend, 4), paid: 0 };
    if (rest.gw > 0.0005 && rest.cost > 1e-6) kept.push(rest);
  }
  if (kept.length) book.building = kept;
  else delete book.building;
  return { done, spent };
}

/** The gap a country's planners see coming, TWh a year: demand some years on with a margin, against what it has and is building. */
function gapOf(book: PowerBook, rate: number, lead = LEAD, margin = MARGIN): number {
  return book.demand * (1 + Math.max(0, rate)) ** lead * margin - capacityOf(book) - pipelineOf(book);
}

/** Plants to cover a gap, in a mix, the main kinds only; each sized to what the industry line can carry. */
function plansFor(gap: number, mix: Mix, year: number, room: number, era?: ScenarioId): { source: EnergySource; gw: number; cost: number }[] {
  const kinds = (Object.entries(mix) as [EnergySource, number][]).filter(([, w]) => w >= 0.05).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const sum = kinds.reduce((s, [, w]) => s + w, 0);
  const out: { source: EnergySource; gw: number; cost: number }[] = [];
  for (const [source, w] of kinds) {
    let gw = (gap * (w / sum)) / (LOAD[source] * HOURS);
    // A year's room in the industry line pays a year of each plant's work, so the plants it can carry are its room times their build.
    const most = (room * BUILD_YEARS[source]) / Math.max(1e-6, costPerGw(source, year, era)) / kinds.length;
    gw = Math.min(gw, most);
    if (gw < 0.001) continue;
    out.push({ source, gw: round(gw, 4), cost: plantCost(source, gw, year, era) });
  }
  return out;
}

/** The yearly work of the plants under construction, $bn: what they ask of the industry line. */
const yearlyWork = (book: PowerBook) => (book.building ?? []).reduce((s, w) => s + paceOf(w), 0);

/** Countries large enough for their power to be the world's news. */
const NEWS_COUNTRIES = 15;

/**
 * Moves every country's electricity through a turn of `years` ending on
 * `to`, after the economies: books for new countries, plants and demand
 * that passed with land, the fronts' toll and the repairs once they go,
 * demand grown with the economy's trend and moved with its output lost or
 * given back, the plants under construction paid and brought on line, every
 * other government's planners at work and its old plants retired, then what
 * the plants deliver with their fuel and the land held, and the shortage.
 * `before` is the state the turn began from. Mutates `next`.
 */
export function advanceEnergy(before: GameState, next: GameState, years: number, applied: AppliedChange[], to: string, ctx: { map: Record<string, MapRegion> | null; accounts: Map<string, Accounts> | null }): void {
  if (!next.energy || years <= 0) return;
  const energy = next.energy;
  const map = ctx.map;
  if (map) followPlants(energy, before.regions, next.regions, map);
  const lands = map ? landOf(next, map) : null;
  const year = yearFraction(to);
  // The largest economies' power is the world's news; the player's always.
  const news = new Set(
    Object.values(next.countries)
      .filter((c) => c.economy && !c.dormant)
      .sort((a, b) => b.economy!.gdp - a.economy!.gdp)
      .slice(0, NEWS_COUNTRIES)
      .map((c) => c.tag),
  );
  news.add(next.player);
  let worldGdp = 0;
  let worldPeople = 0;
  for (const c of Object.values(next.countries)) {
    if (!c.economy || c.dormant) continue;
    worldGdp += c.economy.gdp;
    worldPeople += lands?.get(c.tag)?.people ?? 0;
  }
  const perHead = worldPeople > 0 ? worldGdp / worldPeople : 0;
  const plan = { ...next, date: to };
  for (const tag of Object.keys(next.countries).sort()) {
    const country = next.countries[tag];
    const e = country.economy;
    if (!e || country.dormant) continue;
    const a = ctx.accounts?.get(tag);
    const land = lands?.get(tag);
    let book = energy[tag];
    if (!book) {
      const opened = newBook(next, tag, a, land);
      if (!opened) continue;
      book = energy[tag] = opened;
    }
    const player = tag === next.player;
    const capacity = ENERGY_SOURCES.reduce((s, x) => s + (book.gw[x] ?? 0), 0);

    // The war's toll: the front wrecks the plants of the land it runs through, up to most of that land's plants and no
    // further – not, year after year, those of the land behind it – and once it has gone they are repaired, a quarter of
    // the rest a year. Land an enemy holds is off the supply and the demand alike (flowOf): it is not wrecked again.
    const front = land && land.owned > 0 ? land.front / land.owned : 0;
    const wreckedWas = book.wrecked ?? 0;
    const ceiling = FRONT_MAX * front;
    const wrecked = ceiling > wreckedWas ? wreckedWas + Math.min(ceiling - wreckedWas, FRONT_DAMAGE * front * years) : wreckedWas - (wreckedWas - ceiling) * (1 - Math.exp(-REPAIRED * years));
    let lost = 0;
    if (wrecked > wreckedWas) lost = wreck(book, (wrecked - wreckedWas) / Math.max(0.05, 1 - wreckedWas));
    else if (wrecked < wreckedWas) scale(book, (1 - wrecked) / Math.max(0.05, 1 - wreckedWas));
    if (wrecked >= 0.001) book.wrecked = round(wrecked, 4);
    else delete book.wrecked;
    if (lost > 0.0005 && lost >= 0.03 * capacity && (news.has(tag) || front > 0)) applied.push({ kind: "energy", country: tag, change: "lost", gw: round(lost, 2) });

    // Demand grows with the economy's trend, and electrification on top; output the standing causes took or gave back this
    // turn (engine/economy.ts Economy.losses, the mobilisation's strain) takes its demand or brings it back one to one, so a
    // shortage closes as the economy it starves shrinks.
    const poor = perHead > 0 && land && land.people > 0 ? e.gdp / land.people < perHead : false;
    const rate = demandRate(e, year, poor);
    const was0 = before.countries[tag]?.economy;
    const level = was0 ? (1 - heldDown(e)) / (1 - heldDown(was0)) : 1;
    book.demand = round(Math.max(0.001, book.demand * (1 + rate) ** years * level), 3);

    // The plants under construction, paid from the industry line; the player's come on line whole.
    // A government short of power puts more of its industry line into plants.
    const share = player ? POWER_SHARE.player : Math.min(POWER_SHARE.most, POWER_SHARE.other + SHORT_PUSH * (book.short ?? 0));
    const { done, spent } = build(book, e, years, share);
    // What the plants took from the industry line: the economy invests the rest (engine/economy.ts industryInvested).
    if (spent > 0) book.spent = round(spent / years, 4);
    else delete book.spent;
    for (const w of done) applied.push({ kind: "energy", country: tag, change: "built", source: w.source, gw: round(w.gw, 2) });

    // Old plants retire abroad (the player's are kept running), and the planners build ahead of the demand they see coming.
    // For the player's country they only keep the lights on – a year ahead, in the country's own mix – and leave the rest,
    // the new kinds and the building ahead, to its orders and its industry minister.
    if (!player) for (const s of ENERGY_SOURCES) if ((book.gw[s] ?? 0) > 0) book.gw[s] = round(book.gw[s]! * Math.max(0, 1 - years / LIFE[s]), 4);
    {
      const gap = player ? gapOf(book, rate, PLAYER_LEAD, PLAYER_MARGIN) : gapOf(book, rate);
      const room = share * Math.max(0, e.budget.industry) - yearlyWork(book);
      if (gap > (player ? PLAYER_GAP : 0.02) * book.demand && room > 0) {
        const firstNuclear = !player && (book.gw.nuclear ?? 0) <= 0 && !(book.building ?? []).some((w) => w.source === "nuclear");
        const mix = player ? normalise(Object.fromEntries(capacityMix(book).filter(([s]) => canBuild(plan, tag, s)))) : buildMix(plan, tag, a, land);
        for (const p of plansFor(gap, mix, year, room, next.scenarioId)) {
          const same = (book.building ??= []).find((w) => w.source === p.source && w.by === "state");
          if (same) {
            same.gw = round(same.gw + p.gw, 4);
            same.cost = round(same.cost + p.cost, 4);
          } else book.building.push({ source: p.source, gw: p.gw, cost: p.cost, paid: 0, since: to, by: "state" });
          // A country's first reactors are the world's news.
          if (p.source === "nuclear" && firstNuclear) applied.push({ kind: "energy", country: tag, change: "begun", source: "nuclear", gw: round(p.gw, 2) });
        }
      }
    }

    // What the plants deliver, and what goes without.
    const was = book.short ?? 0;
    const flow = flowOf(book, e, a, land);
    book.supply = round(flow.supply, 3);
    book.short = round(flow.short, 4);
    if (!book.short) delete book.short;
    if (news.has(tag)) {
      if (flow.short >= SHORT_NEWS && was < SHORT_NEWS) applied.push({ kind: "energy", country: tag, change: "shortage", share: Math.round(flow.short * 100) });
      else if (was >= SHORT_NEWS && flow.short < SHORT_OVER) applied.push({ kind: "energy", country: tag, change: "restored" });
    }
  }
  // Books of countries that are gone go with them.
  for (const tag of Object.keys(energy)) if (!next.countries[tag]) delete energy[tag];
}

// ---- what the game master proposes, the player orders

/** What a turn may begin in the player's power (merged into OutcomeSchema as `energy`): plants by kind and size. */
export const energyField = z
  .object({
    build: z
      .array(z.object({ source: z.enum(ENERGY_SOURCES), gw: z.number().finite() }))
      .max(3)
      .catch([])
      .default([]),
  })
  .optional()
  .catch(undefined);
export type EnergyWords = { build: { source: EnergySource; gw: number }[] };

/** The largest plant one order begins: what the industry line could pay for in this many years. */
const ORDER_YEARS = 3;

/** The orders' plants as the engine allows them: kinds the country can build, each no larger than three years of the industry line pays for, one of each kind. */
export function sanitizeEnergy(state: GameState, words: z.infer<typeof energyField>): EnergyWords | undefined {
  const e = state.countries[state.player]?.economy;
  if (!words || !e || !state.energy?.[state.player]) return undefined;
  const year = yearFraction(state.date);
  const out: EnergyWords = { build: [] };
  const seen = new Set<EnergySource>();
  for (const b of words.build) {
    if (seen.has(b.source) || !canBuild(state, state.player, b.source)) continue;
    const most = (Math.max(0, e.budget.industry) * ORDER_YEARS) / Math.max(1e-6, costPerGw(b.source, year, state.scenarioId));
    const gw = round(clamp(b.gw, 0, most), 3);
    if (gw < 0.01) continue;
    seen.add(b.source);
    out.build.push({ source: b.source, gw });
  }
  return out.build.length ? out : undefined;
}

/** Begins the plants a turn allowed: the government's orders, or its industry minister's (engine/ministers.ts). Mutates `next`. */
export function beginPlants(next: GameState, list: { source: EnergySource; gw: number }[], by: PlantWork["by"], applied: AppliedChange[] | null, to: string): void {
  const book = next.energy?.[next.player];
  if (!book) return;
  const year = yearFraction(next.date);
  for (const p of list) {
    if (!(p.gw > 0)) continue;
    (book.building ??= []).push({ source: p.source, gw: round(p.gw, 4), cost: plantCost(p.source, p.gw, year, next.scenarioId), paid: 0, since: to, by });
    applied?.push({ kind: "energy", country: next.player, change: "begun", source: p.source, gw: round(p.gw, 2) });
  }
}

/**
 * What the industry minister would begin on his own (engine/ministers.ts):
 * plants of the mix the country builds to cover the gap he sees coming, his
 * competence's share of it, while the industry line has room and nothing he
 * began is less than half a year old. Null when there is no gap.
 */
export function ministerPlants(state: GameState, quality: number, accounts?: Accounts, map?: Record<string, MapRegion> | null): { source: EnergySource; gw: number }[] | null {
  const tag = state.player;
  const book = state.energy?.[tag];
  const e = state.countries[tag]?.economy;
  if (!book || !e) return null;
  const year = yearFraction(state.date);
  if ((book.building ?? []).some((w) => w.by === "minister" && year - yearFraction(w.since) < 0.5)) return null;
  const rate = demandRate(e, year, false);
  const gap = gapOf(book, rate);
  if (gap <= 0.03 * book.demand) return null;
  const room = POWER_SHARE.player * Math.max(0, e.budget.industry) - yearlyWork(book);
  if (room <= 0) return null;
  const land = map ? landOf(state, map).get(tag) : undefined;
  const list = plansFor(gap * clamp(quality, 0.3, 1.2), buildMix(state, tag, accounts, land), year, room).slice(0, 2);
  return list.length ? list.map(({ source, gw }) => ({ source, gw })) : null;
}

// ---- what the panel and the game master see

export interface EnergyView {
  demand: number;
  supply: number;
  short: number;
  /** What each kind gives, its share of supply, and its capacity. */
  mix: { source: EnergySource; share: number; gw: number; fuel?: number }[];
  building: { source: EnergySource; gw: number; progress: number; by: PlantWork["by"]; ready?: number }[];
  /** The share of the industry line the plants under construction take a year. */
  spend: number;
  /** The share of its plants in land an enemy holds or fights over. */
  lost: number;
}

/** A country's electricity as the economy panel shows it: what it asks and gets, the mix, the plants under construction, the fuel. */
export function energyView(state: GameState, tag: string, accounts?: Map<string, Accounts> | null, map?: Record<string, MapRegion> | null): EnergyView | null {
  const book = state.energy?.[tag];
  const e = state.countries[tag]?.economy;
  if (!book || !e) return null;
  const land = map ? landOf(state, map).get(tag) : undefined;
  const flow = flowOf(book, e, accounts?.get(tag), land);
  const total = Object.values(flow.by).reduce((s, v) => s + (v ?? 0), 0);
  const mix = ENERGY_SOURCES.filter((s) => (book.gw[s] ?? 0) > 0.0005)
    .map((s) => ({ source: s, share: total > 0 ? (flow.by[s] ?? 0) / total : 0, gw: round(book.gw[s] ?? 0, 2), ...(flow.fuel[s] !== undefined ? { fuel: flow.fuel[s] } : {}) }))
    .sort((a, b) => b.share - a.share || b.gw - a.gw);
  const year = yearFraction(state.date);
  const purse = POWER_SHARE[tag === state.player ? "player" : "other"] * Math.max(0, e.budget.industry);
  const building = (book.building ?? []).map((w) => {
    const pace = Math.min(paceOf(w), purse > 0 ? purse : 0);
    const left = Math.max(0, w.cost - w.paid);
    return { source: w.source, gw: round(w.gw, 2), progress: w.cost > 0 ? clamp(w.paid / w.cost, 0, 1) : 1, by: w.by, ...(pace > 0 ? { ready: round(year + left / pace, 2) } : {}) };
  });
  return {
    // The demand of the land it holds: the people an enemy holds are off its grid (flowOf).
    demand: round(flow.demand, 1),
    supply: round(flow.supply, 1),
    short: round(flow.short, 3),
    mix,
    building,
    spend: e.budget.industry > 0 ? round(Math.min(yearlyWork(book), purse) / e.budget.industry, 3) : 0,
    lost: round(1 - flow.control, 3),
  };
}

/** "coal 47%, hydro 29%": a mix in a line. */
const mixLine = (pairs: [EnergySource, number][]) => pairs.filter(([, v]) => v >= 0.005).map(([s, v]) => `${s} ${Math.round(v * 100)}%`).join(", ");

/** The electricity worth a line for the world: the largest users, and every country short of it. */
const WORLD_LINES = 8;
const SHORT_LINE = 0.05;

/**
 * Electricity for the game master, in a few lines: the player's demand and
 * supply, mix, plants under construction and the fuel it lacks; the largest
 * users' mixes; every country short of power.
 */
export function describeEnergy(state: GameState, accounts?: Map<string, Accounts> | null, map?: Record<string, MapRegion> | null): string[] {
  if (!state.energy) return [];
  const lines: string[] = ["", "ENERGY (electricity, TWh a year; the engine keeps every country's power plants, builds them for other governments, fuels them from the strategic resources and wears them down in war):"];
  const view = energyView(state, state.player, accounts, map);
  if (view) {
    const building = view.building.map((b) => `${b.source} ${b.gw} GW (${Math.round(b.progress * 100)}% paid${b.ready ? `, about ${Math.floor(b.ready)}` : ""})`).join(", ");
    const fuel = view.mix.filter((m) => m.fuel !== undefined && m.fuel < 0.95).map((m) => `${m.source} ${Math.round(m.fuel! * 100)}%`);
    lines.push(
      `- the player's: demand ${view.demand}, supply ${view.supply}${view.short >= 0.01 ? ` – SHORT ${Math.round(view.short * 100)}% of demand: blackouts, idle factories, cold homes` : ""}; mix ${mixLine(view.mix.map((m) => [m.source, m.share]))}; plants ${view.mix.map((m) => `${m.source} ${m.gw} GW`).join(", ")}${building ? `; building ${building}` : ""}${fuel.length ? `; fuel left for ${fuel.join(", ")}` : ""}${view.lost >= 0.02 ? `; ${Math.round(view.lost * 100)}% of the plants in land the enemy holds or fights over` : ""}`,
    );
  }
  const others = Object.entries(state.energy)
    .filter(([tag]) => tag !== state.player && state.countries[tag]?.economy && !state.countries[tag].dormant)
    .sort((a, b) => b[1].demand - a[1].demand);
  const top = others.slice(0, WORLD_LINES).map(([tag, b]) => `${tag} ${Math.round(b.demand)} (${mixLine(capacityMix(b).slice(0, 4))})${(b.short ?? 0) >= SHORT_LINE ? ` SHORT ${Math.round(b.short! * 100)}%` : ""}`);
  if (top.length) lines.push(`- the largest elsewhere: ${top.join("; ")}`);
  const short = others.slice(WORLD_LINES).filter(([, b]) => (b.short ?? 0) >= SHORT_LINE).map(([tag, b]) => `${tag} ${Math.round(b.short! * 100)}%`);
  if (short.length) lines.push(`- short of power elsewhere: ${short.join(", ")}`);
  return lines;
}

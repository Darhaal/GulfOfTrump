import { yearOf } from "./calendar";
import { provinceIncome, RICH_INCOME, socialNorm } from "./economy";
import { estimateRate, type Estimate } from "./fog";
import { countsFor } from "./occupation";
import { peopleIn } from "./population";
import { scenarioOf } from "./scenarios";
import type { GameState, MapRegion, ScenarioId, SocietyFigures, SocietyTrack } from "./types";

/**
 * Society in numbers: how a country's people are spread by age and sex,
 * between the poor, the middle and the rich, town and country, farm,
 * factory and office, and how many can read. Built from the land a country
 * holds (each province by its modern country and that country's part of the
 * world), the date, its economy and its government; it moves with the game
 * as war thins the young men and cuts births, growth widens the middle, and
 * slumps, prices, sanctions and occupation push people into poverty.
 *
 * Sources, as orders of magnitude rather than censuses: the age shares of the
 * UN World Population Prospects (2022) from 1950 on and historical censuses
 * before it (the 1910–1911 and 1939–1940 rounds, the Soviet censuses of 1897
 * and 1939); urban shares from the UN World Urbanization Prospects and
 * Bairoch before 1950; literacy from UNESCO and Our World in Data's
 * historical series; employment by sector from the ILO and the national
 * censuses compiled by Mitchell; inequality (Gini) from the World Inequality
 * Database, Milanovic and the OECD. Eleven regional profiles carry the
 * world; the main countries override what differs. Incomes follow a
 * log-normal spread around the economy's GDP per head: the poor live below
 * the World Bank's societal poverty line ($1.15 plus half the median, and at
 * least $3.65 a day from 1991, $3 before), anchored to the income people had at the start; the
 * rich above three times that median (at least $40 a day).
 *
 * Nothing here is stored but what the figures of today cannot show
 * (`SocietyTrack`): the player's start for the trend arrows, and for any
 * country the people war has taken from each age and the sectors its
 * programmes have moved.
 */

/** Five-year age bands, 0–4 to 80+. */
export const AGE_BANDS = 17;
/** The band ages start at. */
export const bandStart = (i: number) => i * 5;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

/** The years the tables are given for: the eight start dates and a projection. */
const ANCHORS = [1914, 1939, 1950, 1964, 1991, 1999, 2014, 2022, 2040] as const;
type Row = readonly [number, number, number, number, number, number, number, number, number];

/** What a part of the world looks like on each anchor year. */
interface Profile {
  /** Under 15 and 65 and over, % of all people. */
  u15: Row;
  o65: Row;
  /** People in towns, %. */
  urban: Row;
  /** Adults who can read, %. */
  literate: Row;
  /** Workers in farming and in industry, % of those employed; services are the rest. */
  farm: Row;
  industry: Row;
  /** Income inequality, 0–1. */
  gini: Row;
  /** How far men fall behind women with age: their share at 85 is 0.512 minus this. */
  excess: Row;
}

type Region = "west" | "east" | "soviet" | "nam" | "oce" | "lat" | "eas" | "sas" | "sea" | "mena" | "ssa";

const PROFILES: Record<Region, Profile> = {
  // Western Europe.
  west: {
    u15: [31, 24, 25, 25, 18.5, 17.5, 15.6, 15.3, 14],
    o65: [6, 8.5, 9.5, 11.5, 14.5, 15.8, 19, 21, 26],
    urban: [50, 58, 60, 68, 74, 75, 77, 78, 82],
    literate: [88, 94, 96, 98, 99, 99, 99, 99, 99],
    farm: [35, 28, 25, 14, 5, 4, 3, 2.5, 2],
    industry: [37, 38, 38, 41, 30, 27, 23, 22, 20],
    gini: [0.48, 0.42, 0.36, 0.33, 0.3, 0.3, 0.31, 0.31, 0.31],
    excess: [0.08, 0.1, 0.12, 0.14, 0.14, 0.13, 0.12, 0.12, 0.11],
  },
  // Central and Eastern Europe and the Balkans.
  east: {
    u15: [35, 31, 29, 28, 23, 19, 15, 15, 14],
    o65: [5, 6, 6, 8, 10.5, 12.5, 16, 19, 24],
    urban: [20, 27, 32, 45, 60, 62, 61, 62, 66],
    literate: [55, 72, 88, 95, 98, 98, 99, 99, 99],
    farm: [70, 62, 55, 38, 22, 20, 15, 12, 9],
    industry: [15, 18, 22, 32, 36, 32, 30, 30, 28],
    gini: [0.42, 0.42, 0.3, 0.25, 0.27, 0.31, 0.31, 0.3, 0.3],
    excess: [0.1, 0.12, 0.14, 0.15, 0.18, 0.19, 0.18, 0.17, 0.16],
  },
  // Russia and the European Soviet republics.
  soviet: {
    u15: [38, 37, 30, 30, 23, 19, 16.5, 18, 16],
    o65: [4.5, 4.5, 5, 6.5, 10, 12.5, 13.5, 16, 21],
    urban: [15, 32, 40, 52, 66, 66, 67, 68, 71],
    literate: [35, 81, 95, 98, 99, 99, 99, 99, 99],
    farm: [75, 54, 46, 32, 18, 14, 10, 8, 6],
    industry: [10, 23, 27, 33, 38, 30, 27, 26, 25],
    gini: [0.45, 0.3, 0.28, 0.26, 0.28, 0.4, 0.4, 0.36, 0.36],
    excess: [0.12, 0.18, 0.2, 0.22, 0.24, 0.25, 0.24, 0.23, 0.2],
  },
  // The United States and Canada.
  nam: {
    u15: [32, 25, 27, 31, 21.5, 21, 19.2, 18, 16.5],
    o65: [4.3, 6.8, 8.2, 9.2, 12.5, 12.4, 14.5, 17, 22],
    urban: [46, 56, 64, 71, 75, 79, 81, 83, 87],
    literate: [93, 96, 97, 98, 99, 99, 99, 99, 99],
    farm: [31, 18, 12, 6, 3, 2.5, 1.6, 1.5, 1.3],
    industry: [32, 32, 35, 33, 25, 23, 19, 19, 18],
    gini: [0.48, 0.45, 0.38, 0.36, 0.38, 0.4, 0.41, 0.41, 0.42],
    excess: [0.08, 0.1, 0.12, 0.14, 0.14, 0.13, 0.11, 0.11, 0.1],
  },
  // Australia and New Zealand.
  oce: {
    u15: [32, 26, 27, 30, 22, 21, 19, 18.5, 17],
    o65: [4.5, 7.5, 8.2, 8.5, 11.3, 12.3, 14.7, 16.8, 21],
    urban: [55, 64, 76, 83, 85, 86, 86, 86, 88],
    literate: [92, 96, 98, 99, 99, 99, 99, 99, 99],
    farm: [28, 21, 15, 10, 5.5, 5, 3, 2.5, 2],
    industry: [30, 30, 34, 35, 24, 22, 20, 19, 18],
    gini: [0.4, 0.38, 0.33, 0.32, 0.32, 0.33, 0.34, 0.34, 0.34],
    excess: [0.1, 0.12, 0.13, 0.14, 0.13, 0.12, 0.1, 0.1, 0.09],
  },
  // Latin America and the Caribbean.
  lat: {
    u15: [42, 41, 40, 43, 35, 32, 26, 23, 19],
    o65: [3, 3.3, 3.5, 3.8, 5, 5.5, 7.3, 9.3, 14],
    urban: [22, 30, 41, 52, 71, 75, 80, 81, 85],
    literate: [30, 45, 58, 70, 86, 89, 93, 94, 96],
    farm: [65, 60, 54, 46, 25, 22, 15, 14, 11],
    industry: [15, 17, 19, 20, 23, 22, 21, 20, 19],
    gini: [0.5, 0.5, 0.52, 0.53, 0.53, 0.54, 0.48, 0.47, 0.46],
    excess: [0.04, 0.05, 0.06, 0.07, 0.09, 0.1, 0.1, 0.1, 0.1],
  },
  // China and its neighbours.
  eas: {
    u15: [35, 36, 34, 40, 27, 25, 17, 17, 13],
    o65: [4, 4, 4.5, 4, 6, 7, 10, 13.5, 24],
    urban: [8, 11, 12, 18, 27, 34, 55, 64, 75],
    literate: [15, 25, 30, 55, 78, 85, 96, 97, 99],
    farm: [82, 80, 78, 75, 59, 50, 30, 23, 15],
    industry: [6, 7, 8, 9, 22, 23, 30, 29, 28],
    gini: [0.4, 0.4, 0.3, 0.28, 0.35, 0.39, 0.42, 0.38, 0.38],
    excess: [0.06, 0.06, 0.06, 0.06, 0.06, 0.07, 0.08, 0.09, 0.1],
  },
  // South Asia.
  sas: {
    u15: [39, 38, 38, 41, 38, 35, 29, 26, 22],
    o65: [2.5, 3, 3.5, 3.4, 4, 4.5, 5.5, 6.5, 10],
    urban: [10, 12, 16, 18, 25, 27, 32, 35, 43],
    literate: [7, 12, 18, 28, 45, 55, 69, 75, 85],
    farm: [75, 73, 72, 72, 64, 60, 49, 44, 35],
    industry: [10, 10, 11, 11, 15, 16, 23, 25, 27],
    gini: [0.4, 0.4, 0.38, 0.37, 0.32, 0.33, 0.35, 0.35, 0.35],
    excess: [0, 0, 0, 0, 0.02, 0.03, 0.04, 0.05, 0.06],
  },
  // South-East Asia and the Pacific islands.
  sea: {
    u15: [40, 40, 39, 43, 34, 31, 26, 24, 20],
    o65: [3, 3.3, 4, 3.5, 4.3, 5, 6.3, 7.5, 12],
    urban: [10, 13, 15, 22, 33, 38, 47, 51, 60],
    literate: [15, 25, 40, 60, 85, 89, 94, 95, 97],
    farm: [78, 76, 74, 70, 55, 50, 38, 33, 25],
    industry: [7, 8, 9, 10, 15, 17, 21, 21, 22],
    gini: [0.4, 0.4, 0.4, 0.42, 0.42, 0.42, 0.4, 0.39, 0.39],
    excess: [0.04, 0.04, 0.05, 0.05, 0.06, 0.07, 0.08, 0.09, 0.1],
  },
  // The Middle East and North Africa.
  mena: {
    u15: [40, 40, 40, 44, 40, 36, 31, 29, 25],
    o65: [3.5, 3.5, 4, 3.5, 3.9, 4.2, 5, 5.5, 9],
    urban: [15, 20, 27, 38, 54, 57, 63, 65, 70],
    literate: [8, 15, 20, 35, 60, 68, 80, 83, 89],
    farm: [75, 70, 66, 58, 32, 28, 20, 18, 14],
    industry: [10, 11, 12, 15, 22, 23, 26, 26, 26],
    gini: [0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.38, 0.38, 0.38],
    excess: [0.02, 0.02, 0.03, 0.04, 0.06, 0.07, 0.08, 0.08, 0.08],
  },
  // Africa south of the Sahara.
  ssa: {
    u15: [42, 42, 42, 44, 46, 45, 43, 42, 38],
    o65: [3, 3, 3, 3, 3, 3, 3, 3, 3.6],
    urban: [5, 8, 11, 17, 28, 32, 39, 42, 52],
    literate: [5, 8, 12, 20, 45, 52, 62, 66, 76],
    farm: [88, 86, 85, 80, 68, 65, 57, 53, 45],
    industry: [4, 5, 6, 7, 9, 9, 10, 11, 12],
    gini: [0.45, 0.45, 0.45, 0.46, 0.48, 0.48, 0.45, 0.45, 0.44],
    excess: [0.03, 0.03, 0.04, 0.04, 0.05, 0.05, 0.06, 0.06, 0.06],
  },
};

/** Modern countries by part of the world; the rest are placed by where their provinces lie. */
const REGION_OF: Record<string, Region> = {};
const place = (region: Region, codes: string) => codes.split(" ").forEach((c) => (REGION_OF[c] = region));
place("soviet", "RUS UKR BLR MDA EST LVA LTU GEO ARM AZE KAZ UZB TKM KGZ TJK");
place("east", "POL CZE SVK HUN ROU BGR SRB HRV SVN BIH MNE MKD ALB KOS");
place("west", "GBR IRL FRA DEU NLD BEL LUX CHE AUT ITA ESP PRT GRC DNK NOR SWE FIN ISL MLT CYP AND MCO SMR LIE VAT IMN JEY GGY GIB FRO ALA");
place("nam", "USA CAN GRL BMU SPM");
place("oce", "AUS NZL");
place("eas", "CHN JPN KOR PRK TWN MNG HKG MAC");
place("sas", "IND PAK BGD LKA NPL BTN AFG MDV KAS");
place("sea", "IDN PHL VNM THA MMR MYS KHM LAO SGP BRN TLS PNG FJI SLB VUT NCL PYF WSM TON FSM KIR MHL PLW NRU TUV GUM MNP");
place("mena", "TUR IRN IRQ SYR LBN ISR PSX JOR SAU YEM OMN ARE QAT KWT BHR EGY LBY TUN DZA MAR SAH");
place(
  "lat",
  "MEX GTM BLZ HND SLV NIC CRI PAN CUB HTI DOM JAM PRI TTO BHS BRB COL VEN ECU PER BOL CHL ARG URY PRY BRA GUY SUR FLK ATG DMA GRD KNA LCA VCT ABW CUW CYM TCA VGB VIR AIA MSR BLM MAF SXM",
);

/** A province's part of the world: by its modern country, else by where it lies. */
export function regionOf(p: Pick<MapRegion, "adm0" | "at">): Region {
  const known = REGION_OF[p.adm0];
  if (known) return known;
  const [lon, lat] = p.at ?? [0, 0];
  if (lon < -30) return lat > 24 ? "nam" : "lat";
  if (lon > 110 && lat < -10) return "oce";
  if (lon >= -30 && lon < 60) {
    if (lat >= 36) return lon > 30 ? "soviet" : "west";
    return lat >= 15 ? "mena" : "ssa";
  }
  if (lat >= 35) return lon < 90 ? "soviet" : "eas";
  return lon < 92 ? "sas" : lat > 22 ? "eas" : "sea";
}

/** Where a main country differs from its part of the world. Groups first, then countries; a country's own rows win. */
const OVERRIDES: Record<string, Partial<Profile>> = {
  casia: {
    u15: [40, 40, 38, 42, 38, 36, 29, 30, 26],
    o65: [4, 4, 4.5, 4.5, 5, 5.5, 5, 7.5, 11],
    urban: [10, 18, 28, 38, 42, 42, 46, 48, 54],
    farm: [85, 70, 60, 45, 38, 40, 32, 27, 20],
    industry: [5, 12, 16, 22, 22, 15, 18, 19, 20],
    excess: [0.05, 0.1, 0.15, 0.15, 0.12, 0.12, 0.12, 0.12, 0.12],
  },
  iberia: {
    u15: [34, 30, 26, 27, 20, 15, 15, 13.5, 12],
    o65: [5.5, 6.5, 7.2, 8.5, 13.7, 16.5, 18.5, 21, 28],
    urban: [32, 38, 45, 55, 74, 76, 79, 81, 85],
    literate: [45, 65, 80, 88, 96, 97, 98, 98, 99],
    farm: [65, 55, 48, 36, 11, 7, 4.5, 4, 3],
    industry: [16, 20, 25, 33, 31, 30, 20, 20, 19],
  },
  southcone: {
    u15: [38, 32, 31, 31, 30, 28, 24, 21, 17],
    o65: [3, 4, 4.5, 6, 8.5, 9.5, 10.5, 12, 16],
    urban: [50, 60, 64, 72, 86, 88, 91, 92, 93],
    literate: [60, 80, 87, 91, 96, 97, 98, 99, 99],
    farm: [40, 35, 27, 20, 12, 10, 8, 7, 6],
    industry: [20, 23, 29, 32, 30, 26, 23, 21, 20],
  },
  young: {
    u15: [42, 42, 41, 44, 43, 42, 38, 36, 30],
    literate: [5, 8, 12, 18, 30, 38, 52, 58, 72],
  },
  gulf: {
    urban: [10, 15, 25, 45, 80, 82, 84, 86, 89],
    u15: [40, 40, 41, 44, 36, 33, 23, 21, 17],
    o65: [3, 3, 3.5, 3, 2.5, 2.5, 2, 2.5, 6],
  },
  GBR: {
    u15: [30.5, 21.5, 22.5, 23, 19, 19, 17.6, 17.7, 16],
    o65: [5.2, 9, 10.8, 12, 15.8, 15.8, 17.5, 19, 23],
    urban: [79, 80, 79, 78, 78, 78, 82, 84, 87],
    literate: [95, 98, 99, 99, 99, 99, 99, 99, 99],
    farm: [9, 6, 5, 3.5, 2, 1.5, 1.2, 1, 1],
    industry: [46, 45, 48, 46, 30, 25, 19, 18, 17],
  },
  FRA: {
    u15: [25.5, 25, 22.7, 25.5, 20, 19, 18.5, 17.5, 16],
    o65: [8.4, 10, 11.4, 12, 14, 16, 18.5, 21.5, 26],
    urban: [44, 52, 55, 66, 74, 76, 79, 81, 84],
    farm: [41, 36, 31, 18, 5.5, 4.5, 3, 2.5, 2],
    industry: [33, 33, 35, 39, 29, 25, 21, 20, 19],
  },
  DEU: {
    u15: [34, 23.5, 23.5, 22, 16.3, 15.6, 13.1, 13.8, 13],
    o65: [5, 7.8, 9.7, 12, 15, 16, 21, 22, 28],
    urban: [60, 69, 68, 72, 73, 73, 77, 77, 79],
    farm: [35, 26, 23, 11, 4, 3, 1.5, 1.3, 1],
    industry: [38, 40, 43, 48, 38, 33, 28, 27, 25],
  },
  ITA: {
    u15: [33, 30, 26.5, 24.5, 16, 14.4, 13.8, 12.7, 11],
    o65: [6.5, 7.4, 8.3, 9.8, 15, 17.8, 21.7, 23.8, 31],
    urban: [40, 47, 54, 60, 67, 67, 69, 71, 75],
    literate: [62, 78, 87, 92, 97, 98, 99, 99, 99],
    farm: [55, 48, 42, 25, 8, 5, 3.7, 4, 3],
    industry: [26, 29, 32, 39, 32, 32, 27, 26, 25],
  },
  JPN: {
    u15: [36, 37, 35, 26, 18, 15, 13, 11.6, 10.5],
    o65: [5.3, 4.7, 4.9, 6.2, 12.5, 16.5, 26, 29, 35],
    urban: [18, 38, 53, 67, 77, 78, 92, 92, 93],
    literate: [90, 95, 98, 99, 99, 99, 99, 99, 99],
    farm: [60, 45, 48, 26, 7, 5, 3.7, 3, 2.5],
    industry: [17, 25, 22, 32, 34, 31, 26, 24, 22],
    gini: [0.45, 0.5, 0.35, 0.33, 0.3, 0.32, 0.33, 0.33, 0.33],
    excess: [0.07, 0.08, 0.1, 0.12, 0.13, 0.13, 0.12, 0.12, 0.11],
  },
  KOR: {
    u15: [38, 40, 42, 43, 25, 21, 14, 11.5, 9.5],
    o65: [3, 3, 3, 3.3, 5.3, 7, 12.5, 17.5, 32],
    urban: [4, 11, 21, 30, 75, 80, 82, 81, 83],
    literate: [10, 25, 70, 85, 97, 98, 99, 99, 99],
    farm: [85, 80, 70, 60, 16, 11, 6, 5, 4],
    industry: [5, 8, 10, 14, 36, 28, 25, 24, 22],
  },
  PRK: {
    u15: [38, 40, 42, 42, 28, 26, 21, 19.5, 17],
    o65: [3, 3, 3, 3.3, 4, 6, 9, 12, 18],
    urban: [4, 11, 31, 45, 58, 59, 61, 63, 66],
    literate: [10, 25, 70, 95, 99, 99, 99, 99, 99],
    farm: [85, 80, 70, 45, 35, 36, 30, 28, 25],
    industry: [5, 8, 10, 30, 32, 28, 30, 30, 30],
  },
  TWN: {
    u15: [38, 40, 42, 45, 26, 21, 14, 12.5, 10],
    o65: [3, 3, 2.5, 2.5, 6.5, 8.5, 12, 17, 30],
    urban: [15, 25, 35, 50, 75, 77, 78, 79, 82],
    literate: [10, 30, 55, 75, 93, 95, 98, 99, 99],
    farm: [70, 65, 56, 50, 13, 8, 5, 5, 4],
    industry: [10, 15, 17, 22, 40, 37, 36, 35, 33],
  },
  HKG: { urban: [100, 100, 100, 100, 100, 100, 100, 100, 100], farm: [5, 4, 3, 2, 0.5, 0.3, 0.2, 0.2, 0.2] },
  SGP: { urban: [100, 100, 100, 100, 100, 100, 100, 100, 100], farm: [5, 4, 3, 2, 0.5, 0.3, 0.2, 0.2, 0.2] },
  ISR: {
    u15: [40, 35, 33, 33, 31, 29, 28, 28, 25],
    o65: [4, 4, 4, 5.5, 9.5, 9.8, 11, 12, 15],
    urban: [20, 30, 71, 81, 90, 91, 92, 92, 93],
    literate: [20, 40, 90, 92, 95, 97, 98, 98, 99],
    farm: [70, 40, 17, 12, 4, 2.5, 1, 1, 1],
  },
  ZAF: {
    u15: [40, 39, 38, 41, 37, 33, 30, 28, 24],
    o65: [3, 3.5, 4, 4, 4, 4.5, 5.5, 6, 9],
    urban: [25, 33, 42, 47, 52, 56, 64, 68, 74],
    literate: [20, 35, 45, 60, 80, 85, 94, 95, 97],
    farm: [65, 55, 45, 30, 13, 12, 5, 5, 4],
    industry: [10, 15, 22, 27, 32, 26, 23, 22, 21],
    gini: [0.55, 0.58, 0.6, 0.6, 0.6, 0.6, 0.63, 0.63, 0.62],
  },
  CUB: { urban: [40, 45, 57, 60, 73, 75, 77, 77, 79], literate: [60, 72, 78, 96, 99, 99, 99, 99, 99] },
  UKR: {
    o65: [4.5, 5, 5.5, 7.5, 12.5, 14, 15.5, 18, 22],
    u15: [38, 37, 29, 28, 21.5, 18, 15, 15, 14],
    farm: [78, 58, 50, 36, 20, 22, 17, 14, 11],
    industry: [9, 21, 25, 32, 38, 30, 24, 22, 21],
  },
};
const GROUP_OF: Record<string, string> = {};
const group = (name: string, codes: string) => codes.split(" ").forEach((c) => (GROUP_OF[c] = name));
group("casia", "KAZ UZB TKM KGZ TJK AZE");
group("iberia", "ESP PRT GRC");
group("southcone", "ARG URY CHL");
group("young", "PAK AFG YEM");
group("gulf", "SAU ARE QAT KWT BHR OMN");

/**
 * Cohorts the history before the start left smaller: births lost to a war,
 * a famine or a slump (both sexes), or men killed in a war. `at`: when it
 * happened, so a game begun before it does not carry it.
 */
interface Scar {
  at: number;
  born: [number, number];
  m: number;
  f: number;
  countries: string;
}
const WWI_EAST = "RUS UKR BLR";
const SCARS: Scar[] = [
  { at: 1919, born: [1915, 1919], m: 0.6, f: 0.6, countries: "FRA DEU AUT HUN CZE SVK SRB POL BEL ROU" },
  { at: 1919, born: [1915, 1919], m: 0.78, f: 0.78, countries: "GBR ITA BGR" },
  { at: 1922, born: [1915, 1922], m: 0.62, f: 0.62, countries: `${WWI_EAST} KAZ` },
  { at: 1918, born: [1880, 1899], m: 0.86, f: 1, countries: "FRA DEU SRB AUT HUN CZE TUR" },
  { at: 1918, born: [1880, 1899], m: 0.91, f: 1, countries: `GBR ITA ROU ${WWI_EAST}` },
  { at: 1934, born: [1932, 1934], m: 0.65, f: 0.65, countries: "UKR KAZ" },
  { at: 1934, born: [1932, 1934], m: 0.82, f: 0.82, countries: "RUS" },
  { at: 1946, born: [1942, 1946], m: 0.58, f: 0.58, countries: `${WWI_EAST} LTU LVA EST` },
  { at: 1946, born: [1942, 1946], m: 0.75, f: 0.75, countries: "POL DEU SRB HRV BIH" },
  { at: 1946, born: [1944, 1946], m: 0.88, f: 0.88, countries: "JPN AUT HUN" },
  { at: 1945, born: [1900, 1927], m: 0.72, f: 0.95, countries: `${WWI_EAST} LTU LVA EST` },
  { at: 1945, born: [1900, 1927], m: 0.8, f: 0.97, countries: "DEU POL SRB HRV BIH AUT" },
  { at: 1945, born: [1900, 1927], m: 0.88, f: 0.98, countries: "JPN HUN ROU" },
  { at: 1945, born: [1900, 1927], m: 0.96, f: 1, countries: "ITA FRA GBR CHN CZE" },
  { at: 1964, born: [1946, 1964], m: 1.15, f: 1.15, countries: "USA CAN AUS NZL" },
  { at: 1953, born: [1915, 1932], m: 0.9, f: 0.97, countries: "KOR PRK" },
  { at: 1961, born: [1959, 1961], m: 0.68, f: 0.68, countries: "CHN" },
  { at: 1975, born: [1930, 1955], m: 0.93, f: 0.98, countries: "VNM" },
  { at: 2001, born: [1992, 2001], m: 0.62, f: 0.62, countries: `${WWI_EAST} MDA GEO ARM LTU LVA EST` },
  { at: 2001, born: [1992, 2001], m: 0.78, f: 0.78, countries: "BGR ROU POL" },
];
const SCARS_OF = new Map<string, Scar[]>();
for (const s of SCARS) for (const c of s.countries.split(" ")) SCARS_OF.set(c, [...(SCARS_OF.get(c) ?? []), s]);

/** Prices of the start date against 2019 (the US CPI), so incomes of different dates compare. */
const PRICES: Record<ScenarioId, number> = { "1914": 0.04, "1939": 0.053, "1950": 0.094, "1964": 0.122, "1991": 0.53, "1999": 0.65, "2014": 0.93, "2022": 1.15 };
/** How fast the dollar loses value in play, % a year: the economy's own rate for the era (engine/economy.ts). */
const DOLLAR: Record<ScenarioId, number> = { "1914": 1, "1939": 2, "1950": 2.5, "1964": 2, "1991": 3, "1999": 2.5, "2014": 1, "2022": 4 };

const YEAR_MS = 365.25 * 86_400_000;
const yearsBetween = (from: string, to: string) => Math.max(0, (Date.parse(to) - Date.parse(from)) / YEAR_MS);
/** The year as a fraction, for the tables. */
const yearFraction = (date: string) => yearOf(date) + (Date.parse(date) - Date.parse(`${yearOf(date)}-01-01`)) / YEAR_MS;

/** A table's value in a year: straight between the anchors, held beyond them. */
function at(row: Row, year: number): number {
  if (year <= ANCHORS[0]) return row[0];
  for (let i = 1; i < ANCHORS.length; i++) {
    if (year <= ANCHORS[i]) {
      const t = (year - ANCHORS[i - 1]) / (ANCHORS[i] - ANCHORS[i - 1]);
      return row[i - 1] + (row[i] - row[i - 1]) * t;
    }
  }
  return row[ANCHORS.length - 1];
}

/** The profile of a modern country: its part of the world, its group's rows and its own. */
function profileOf(p: Pick<MapRegion, "adm0" | "at">): Profile {
  const base = PROFILES[regionOf(p)];
  const grouped = GROUP_OF[p.adm0] ? OVERRIDES[GROUP_OF[p.adm0]] : undefined;
  const own = OVERRIDES[p.adm0];
  if (!grouped && !own) return base;
  return { ...base, ...grouped, ...own };
}

// --- the age pyramid -------------------------------------------------------

/** Share of people in each band for a smooth population whose births grow at `r` a year and who survive as Weibull(λ, 4). */
function smooth(r: number, lambda: number): number[] {
  const bands = new Array<number>(AGE_BANDS).fill(0);
  for (let a = 0; a < 100; a++) {
    const x = a + 0.5;
    bands[Math.min(AGE_BANDS - 1, Math.floor(a / 5))] += Math.exp(-r * x - (x / lambda) ** 4);
  }
  const total = bands.reduce((s, v) => s + v, 0);
  return bands.map((v) => v / total);
}
const under15 = (b: number[]) => b[0] + b[1] + b[2];
const over65 = (b: number[]) => b.slice(13).reduce((s, v) => s + v, 0);

const fits = new Map<string, number[]>();
/** The smooth age shares with the given shares under 15 and 65 and over, %: births' growth and survival found by bisection. */
export function ageShares(young: number, old: number): number[] {
  const key = `${round1(young)}|${round1(old)}`;
  const known = fits.get(key);
  if (known) return known;
  const y = clamp(young, 8, 50) / 100;
  const o = clamp(old, 1.5, 40) / 100;
  const rateFor = (lambda: number) => {
    let lo = -0.08;
    let hi = 0.1;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (under15(smooth(mid, lambda)) < y) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };
  let lo = 30;
  let hi = 160;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (over65(smooth(rateFor(mid), mid)) < o) lo = mid;
    else hi = mid;
  }
  const lambda = (lo + hi) / 2;
  const shares = smooth(rateFor(lambda), lambda);
  fits.set(key, shares);
  return shares;
}

/**
 * A profile's age shares in a year: fitted on the anchor years around it and
 * mixed between them, so a turn's few days do not ask for a new fit.
 */
function sharesAt(profile: Profile, year: number): number[] {
  const fit = (i: number) => ageShares(profile.u15[i], profile.o65[i]);
  if (year <= ANCHORS[0]) return fit(0);
  for (let i = 1; i < ANCHORS.length; i++) {
    if (year <= ANCHORS[i]) {
      const t = (year - ANCHORS[i - 1]) / (ANCHORS[i] - ANCHORS[i - 1]);
      const a = fit(i - 1);
      const b = fit(i);
      return a.map((v, k) => v + (b[k] - v) * t);
    }
  }
  return fit(ANCHORS.length - 1);
}

/** Men's share of a band: half and a little more at birth, falling with age as men die younger. */
const maleShare = (band: number, excess: number) => clamp(0.512 - excess * (Math.max(0, bandStart(band) + 2.5 - 20) / 65) ** 2, 0.2, 0.53);

/** How much of a cohort a scar left, for the band's birth years in a year. */
function scarFactor(band: number, year: number, s: Scar, male: boolean): number {
  const factor = male ? s.m : s.f;
  if (factor === 1) return 1;
  const ages = band === AGE_BANDS - 1 ? 20 : 5;
  let hit = 0;
  for (let k = 0; k < ages; k++) {
    const born = year - (bandStart(band) + k) - 0.5;
    if (born >= s.born[0] && born <= s.born[1] + 1) hit++;
  }
  return 1 - (hit / ages) * (1 - factor);
}

// --- incomes -----------------------------------------------------------------

/** The standard normal distribution. */
function phi(x: number): number {
  // Abramowitz and Stegun 7.1.26.
  const t = 1 / (1 + 0.3275911 * (Math.abs(x) / Math.SQRT2));
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(x * x) / 2);
  return x >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}
/** The spread of log incomes that gives a Gini coefficient: σ = √2·Φ⁻¹((1 + G) / 2). */
function sigmaOf(gini: number): number {
  const p = (1 + clamp(gini, 0.15, 0.75)) / 2;
  let lo = 0;
  let hi = 4;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (phi(mid) < p) lo = mid;
    else hi = mid;
  }
  return Math.SQRT2 * ((lo + hi) / 2);
}
/** Purchasing power: a dollar buys more where incomes are low, the more so the later the date. */
function pppFactor(real: number, era: ScenarioId): number {
  const exponent = era === "1914" || era === "1939" ? 0.12 : era === "1950" || era === "1964" ? 0.2 : 0.3;
  return clamp((65000 / Math.max(100, real)) ** exponent, 1, 3);
}
/** Household spending as a share of GDP. */
const CONSUMPTION = 0.6;
/** The lowest poverty line, $ a day of 2017: the World Bank's line for lower-middle incomes from 1991, a little below it for the earlier, poorer dates. */
const poorFloor = (era: ScenarioId) => (era === "1991" || era === "1999" || era === "2014" || era === "2022" ? 3.65 : 3);
/** The rich live on three times the median, and at least $40 a day. */
const RICH_LINE = 40;
const RICH_TIMES = 3;

/** Whether a government plans its economy as the socialist states did: their wages were flat. */
function socialist(state: Pick<GameState, "countries">, tag: string): boolean {
  const c = state.countries[tag];
  const words = typeof c?.government === "string" ? c.government : c?.government ? Object.values(c.government).join(" ") : "";
  return /communis|socialist|soviet|people's (republic|democracy)|коммунист|комуніст|социалист|соціаліст|советск|радянськ|народн/i.test(words);
}

// --- the society ---------------------------------------------------------------

/** One modern country's people inside a game country. */
interface Part {
  adm0: string;
  at?: [number, number];
  people: number;
  /** Income per head in dollars of the start date, as the economy values that land. */
  income: number;
}

/** What a country's land holds for its society: its people by modern country, how many of its own people another holds, and whether a front runs through it. */
interface Land {
  parts: Part[];
  /** Its own people, and those of them under someone else's control, thousands (as engine/crises.ts occupiedShare counts them). */
  own: number;
  held: number;
  /** A front or an occupier is on its land. */
  front: boolean;
}

/**
 * Every country's land in one pass over the provinces, or one country's
 * when `only` is given: a turn reads many countries, the panel one.
 */
function landOf(state: Pick<GameState, "regions" | "scenarioId">, map: Record<string, MapRegion>, only?: string): Map<string, Land> {
  const lands = new Map<string, Land>();
  const landFor = (tag: string) => {
    let land = lands.get(tag);
    if (!land) lands.set(tag, (land = { parts: [], own: 0, held: 0, front: false }));
    return land;
  };
  const byAdm = new Map<string, Map<string, Part>>();
  for (const [id, r] of Object.entries(state.regions)) {
    const m = map[id];
    if (!m) continue;
    const n = peopleIn(r, m);
    const tag = countsFor(r);
    if ((!only || tag === only) && n > 0) {
      let parts = byAdm.get(tag);
      if (!parts) byAdm.set(tag, (parts = new Map()));
      const part = parts.get(m.adm0);
      if (part) part.people += n;
      else parts.set(m.adm0, { adm0: m.adm0, at: m.at, people: n, income: provinceIncome(m, state.scenarioId) });
    }
    if (only && r.owner !== only) continue;
    const owner = landFor(r.owner);
    owner.own += n;
    if (r.controller !== r.owner) {
      owner.held += r.contested === r.owner ? (n * (100 - (r.held ?? 30))) / 100 : n;
      owner.front = true;
    } else if (r.contested) {
      owner.held += (n * (r.held ?? 30)) / 100;
      owner.front = true;
    }
  }
  for (const [tag, parts] of byAdm) landFor(tag).parts = [...parts.values()];
  return lands;
}

/** A country's people in numbers. Shares are %, people thousands. */
export interface Society {
  people: number;
  /** Men and women in each five-year band, 0–4 to 80+, thousands. */
  bands: { m: number; f: number }[];
  poor: number;
  middle: number;
  rich: number;
  urban: number;
  literate: number;
  /** Workers in farming, industry and services, % of those employed. */
  farm: number;
  industry: number;
  services: number;
  jobless: number;
  /** Under 15 and 65 and over, %. */
  young: number;
  old: number;
  /** Men aged 20–34, thousands. */
  men: number;
  /** The same figures when the record began: the player's country only. */
  start?: SocietyFigures;
}

/** The day the game began: its date's start, or the start chosen on the date's card. */
const startOf = (state: Pick<GameState, "scenarioId" | "variant">): string => scenarioOf(state).startDate;

type SocietyState = Pick<GameState, "regions" | "countries" | "scenarioId" | "date" | "player" | "wars"> & Partial<Pick<GameState, "society" | "sanctions" | "variant">>;

/**
 * A country's society now, from its land, its economy and what the turns
 * left in its record. Null for a country with no people or no economy.
 */
export function societyOf(state: SocietyState, map: Record<string, MapRegion> | null | undefined, tag: string, lands?: Map<string, Land>): Society | null {
  const country = state.countries[tag];
  if (!map || !country?.economy) return null;
  const land = (lands ?? landOf(state, map, tag)).get(tag);
  const parts = land?.parts ?? [];
  const people = parts.reduce((s, p) => s + p.people, 0);
  if (people <= 0) return null;
  const track = state.society?.[tag];
  const era = state.scenarioId;
  const year = yearFraction(state.date);
  const startYear = Number(era);
  const years = yearsBetween(startOf(state), state.date);

  // The age pyramid: each part's smooth shares for this year, the cohorts history scarred before the start, then the game's own gaps.
  const bands = Array.from({ length: AGE_BANDS }, () => ({ m: 0, f: 0 }));
  const gap = track?.gap;
  const missing = gap ? gap.m.reduce((s, v) => s + v, 0) + gap.f.reduce((s, v) => s + v, 0) : 0;
  const scale = (people + missing) / people;
  for (const part of parts) {
    const profile = profileOf(part);
    const shares = sharesAt(profile, year);
    const excess = at(profile.excess, year);
    const scars = (SCARS_OF.get(part.adm0) ?? []).filter((s) => s.at <= startYear);
    const own = shares.map((share, b) => {
      const male = maleShare(b, excess);
      return {
        m: share * male * scars.reduce((k, s) => k * scarFactor(b, year, s, true), 1),
        f: share * (1 - male) * scars.reduce((k, s) => k * scarFactor(b, year, s, false), 1),
      };
    });
    const total = own.reduce((s, x) => s + x.m + x.f, 0);
    own.forEach((x, b) => {
      bands[b].m += (x.m / total) * part.people * scale;
      bands[b].f += (x.f / total) * part.people * scale;
    });
  }
  if (gap) {
    // The record read part way to its next band; a cohort cannot lose more than four fifths of itself, whatever was recorded.
    const t = (gap.aged ?? 0) / 5;
    const read = (g: number[], b: number) => (g[b] ?? 0) * (1 - t) + (b > 0 ? (g[b - 1] ?? 0) * t : 0) + (b === AGE_BANDS - 1 ? (g[b] ?? 0) * t : 0);
    bands.forEach((x, b) => {
      x.m = Math.max(x.m * 0.2, x.m - read(gap.m, b));
      x.f = Math.max(x.f * 0.2, x.f - read(gap.f, b));
    });
  }
  const counted = bands.reduce((s, x) => s + x.m + x.f, 0);
  const young = ((bands[0].m + bands[0].f + bands[1].m + bands[1].f + bands[2].m + bands[2].f) / counted) * 100;
  const old = (bands.slice(13).reduce((s, x) => s + x.m + x.f, 0) / counted) * 100;
  const men = bands[4].m + bands[5].m + bands[6].m;

  // Income now against the start, in dollars of 2019: the economy's GDP per head, deflated by the era's dollar.
  const deflator = PRICES[era] * (1 + DOLLAR[era] / 100) ** years;
  const real = (country.economy.gdp * 1e6) / people / deflator;
  const landIncome = parts.reduce((s, p) => s + p.income * p.people, 0) / people;
  const anchor = track?.anchor ?? landIncome / PRICES[era];
  const ratio = clamp(real / Math.max(1, anchor), 0.2, 8);

  // Inequality: the part of the world's, flattened where wages were planned, widened by the hardships of the day.
  const flat = socialist(state, tag) && year <= 1992;
  const e = country.economy;
  const occupied = land && land.own > 0 ? land.held / land.own : 0;
  const sanctioned = (state.sanctions ?? []).filter((s) => s.against === tag).reduce((w, s) => Math.max(w, s.scope === "full" ? 0.04 : 0.02), 0);
  const inflation = Math.max(0, Math.log10(Math.max(1, e.inflation) / 10));
  const atHome = Boolean(land?.front);
  const widen = 0.008 * Math.max(0, e.unemployment - 6) + 0.05 * inflation + sanctioned + 0.15 * occupied + (atHome ? 0.03 : 0);
  const cut = (1 - 0.1 * inflation) * (1 - 0.3 * occupied);
  const spreads = parts.map((p) => {
    const profile = profileOf(p);
    const gini = at(profile.gini, startYear);
    return sigmaOf(flat ? Math.min(gini, 0.27) : gini) + widen;
  });
  const means = parts.map((p) => {
    // A colony's people live far below the metropole's, but within reason of the country's own mean.
    const realPart = real * clamp(p.income / Math.max(1e-9, landIncome), 0.25, 2.5) * cut;
    return (realPart * pppFactor(realPart, era) * CONSUMPTION) / 365;
  });
  const logMedian = parts.reduce((s, p, i) => s + (p.people / people) * (Math.log(means[i]) - spreads[i] ** 2 / 2), 0);
  const anchoredMedian = Math.exp(logMedian) / (ratio * cut);
  const poorLine = Math.max(poorFloor(era), 1.15 + anchoredMedian / 2);
  const richLine = Math.max(RICH_LINE, RICH_TIMES * anchoredMedian);
  let poor = 0;
  let rich = 0;
  parts.forEach((p, i) => {
    const mu = Math.log(means[i]) - spreads[i] ** 2 / 2;
    poor += (p.people / people) * phi((Math.log(poorLine) - mu) / spreads[i]);
    rich += (p.people / people) * (1 - phi((Math.log(richLine) - mu) / spreads[i]));
  });
  poor = clamp(poor * 100, 1, 97);
  rich = clamp(rich * 100, 0.3, 30);

  // Town and country, work and schooling: the start's figures, moved by income since, the record's shifts and time.
  const weighted = (row: (p: Profile) => Row, when = startYear) => parts.reduce((s, p) => s + (p.people / people) * at(row(profileOf(p)), when), 0);
  const shift = track?.shift ?? {};
  const growth = Math.log(ratio);
  const farm0 = weighted((p) => p.farm);
  const farm = clamp(farm0 * ratio ** -0.5 + (shift.farm ?? 0), 0.5, 92);
  const industry = clamp(weighted((p) => p.industry) + growth * (farm0 > 20 ? 4 : -2) + (shift.industry ?? 0), 3, 60);
  const services = Math.max(5, 100 - farm - industry);
  const urban = clamp(weighted((p) => p.urban) + 9 * growth + (shift.urban ?? 0), 2, 100);
  const literate0 = weighted((p) => p.literate);
  const literate = clamp(literate0 + (100 - literate0) * (1 - Math.exp(-0.02 * years)) + (shift.literate ?? 0), 1, 99.5);
  const workers = farm + industry + services;

  return {
    people,
    bands,
    poor: round1(poor),
    rich: round1(rich),
    middle: round1(Math.max(0, 100 - poor - rich)),
    urban: round1(urban),
    literate: round1(literate),
    farm: round1((farm / workers) * 100),
    industry: round1((industry / workers) * 100),
    services: round1((services / workers) * 100),
    jobless: round1(e.unemployment),
    young: round1(young),
    old: round1(old),
    men: Math.round(men),
    ...(track?.start ? { start: track.start } : {}),
  };
}

/** The figures a record keeps of its start. */
const figuresOf = (s: Society): SocietyFigures => ({ poor: s.poor, rich: s.rich, urban: s.urban, literate: s.literate, farm: s.farm, industry: s.industry, young: s.young, men: s.men });

/** Real income per head now, dollars of 2019: what a new record anchors the poverty line to. */
function realIncome(state: SocietyState, map: Record<string, MapRegion>, tag: string, lands?: Map<string, Land>): number | null {
  const e = state.countries[tag]?.economy;
  const people = ((lands ?? landOf(state, map, tag)).get(tag)?.parts ?? []).reduce((s, p) => s + p.people, 0);
  if (!e || people <= 0) return null;
  const deflator = PRICES[state.scenarioId] * (1 + DOLLAR[state.scenarioId] / 100) ** yearsBetween(startOf(state), state.date);
  return (e.gdp * 1e6) / people / deflator;
}

/**
 * The player's record opened: its start for the trend arrows and its income
 * as the poverty line's anchor. A new game opens it on the start date; an
 * older save on the day it is first loaded (migration step 31).
 */
export function seedSociety<T extends SocietyState>(state: T, map: Record<string, MapRegion>): T {
  const tag = state.player;
  if (state.society?.[tag]?.start) return state;
  const real = realIncome(state, map, tag);
  if (real === null) return state;
  const opened: T = { ...state, society: { ...state.society, [tag]: { ...state.society?.[tag], anchor: Math.round(real) } } };
  const now = societyOf(opened, map, tag);
  if (!now) return state;
  return { ...opened, society: { ...opened.society, [tag]: { ...opened.society![tag], start: figuresOf(now) } } };
}

/** How the war dead spread over a man's life, by band from 15–19: the young first. */
const DEAD_BY_BAND: [number, number][] = [
  [3, 0.12],
  [4, 0.3],
  [5, 0.24],
  [6, 0.16],
  [7, 0.1],
  [8, 0.05],
  [9, 0.03],
];
/** The most a programme, a budget or a war may move a sector away from its drift, points. */
const MAX_SHIFT = 15;
/** Points a year a programme moves: [farm, industry, urban, literate]. */
const PROGRAMME_SHIFT: Partial<Record<string, [number, number, number, number]>> = {
  industry: [-0.4, 0.6, 0.3, 0],
  infrastructure: [-0.2, 0.3, 0.4, 0],
  technology: [-0.2, -0.1, 0.1, 0.3],
  market: [-0.2, -0.2, 0.2, 0],
  liberalise: [-0.1, -0.1, 0.1, 0.1],
  stimulus: [0, 0.2, 0.1, 0],
  armament: [0, 0.4, 0, 0],
  disarmament: [0, -0.3, 0, 0],
};

const emptyGap = () => ({ m: new Array<number>(AGE_BANDS).fill(0), f: new Array<number>(AGE_BANDS).fill(0) });
const small = (n: number) => Math.round(n * 100) / 100;

/**
 * Society after a turn, in place on `next`: the war dead leave a gap among
 * the young men, a war past its first year cuts births, every gap ages
 * with its people; programmes, the industry and social budgets and a war
 * economy move the sectors and schooling of the countries they touch; the
 * player's poverty line follows incomes over a generation. Read from the
 * wars, economies and programmes as the turn left them; no dice.
 */
export function advanceSociety(before: GameState, next: GameState, years: number, map: Record<string, MapRegion>): void {
  if (years <= 0) return;
  // A save from before society (step 31) opens the player's record from the game as it stood before this turn.
  const opened = before.society?.[before.player]?.start ? before : seedSociety(before, map);
  const society: Record<string, SocietyTrack> = { ...(next.society ?? {}), ...(opened.society?.[next.player] ? { [next.player]: opened.society[next.player] } : {}) };
  const lands = landOf(next, map);
  const killedBefore = new Map<string, number>();
  for (const w of before.wars) for (const [tag, l] of Object.entries(w.losses ?? {})) killedBefore.set(`${w.id}:${tag}`, l.killed);

  for (const [tag, c] of Object.entries(next.countries)) {
    const e = c.economy;
    if (!e) continue;
    const wars = next.wars.filter((w) => w.attackers.includes(tag) || w.defenders.includes(tag));
    const programmes = (c.programmes ?? []).filter((p) => p.since <= next.date && p.until > before.date && PROGRAMME_SHIFT[p.kind]);
    const isPlayer = tag === next.player;
    const had = society[tag];
    if (!had && !isPlayer && !wars.length && !programmes.length) continue;
    const track: SocietyTrack = { ...had, ...(had?.gap ? { gap: { ...had.gap, m: [...had.gap.m], f: [...had.gap.f] } } : {}), ...(had?.shift ? { shift: { ...had.shift } } : {}) };

    // The gaps age with their people: every five years the whole record moves up a band (the oldest thin out), and in between it is read part way.
    if (track.gap) {
      let aged = (track.gap.aged ?? 0) + years;
      while (aged >= 5) {
        aged -= 5;
        for (const sex of ["m", "f"] as const) {
          const g = track.gap[sex];
          track.gap[sex] = g.map((v, b) => (b === 0 ? 0 : b === AGE_BANDS - 1 ? g[b - 1] + v * 0.5 : g[b - 1]));
        }
      }
      track.gap = { ...track.gap, aged };
    }

    if (wars.length) {
      const killed = wars.reduce((s, w) => s + Math.max(0, (w.losses?.[tag]?.killed ?? 0) - (killedBefore.get(`${w.id}:${tag}`) ?? 0)), 0);
      const society0 = societyOf(next, map, tag, lands);
      if (society0) {
        const gap = (track.gap ??= emptyGap());
        for (const [b, share] of DEAD_BY_BAND) gap.m[b] += killed * share;
        // Births fall once a war has gone on for a year, the deeper the more of the people it has in uniform.
        const longest = Math.max(...wars.filter((w) => !w.truce).map((w) => yearsBetween(w.since, next.date)), 0);
        if (longest >= 1) {
          const depth = clamp(0.1 + (6 * e.troops) / society0.people, 0.1, 0.4);
          const births = ((society0.bands[0].m + society0.bands[0].f) / 5) * years * depth;
          gap.m[0] += births * 0.512;
          gap.f[0] += births * 0.488;
        }
      }
    }
    if (track.gap) {
      const aged = Math.round((track.gap.aged ?? 0) * 1000) / 1000;
      track.gap = { m: track.gap.m.map(small), f: track.gap.f.map(small), ...(aged ? { aged } : {}) };
      if (track.gap.m.every((v) => v === 0) && track.gap.f.every((v) => v === 0)) delete track.gap;
    }

    // Sectors and schooling: programmes, the budget's lines against the era's norms, and a war economy.
    const shift = { farm: 0, industry: 0, urban: 0, literate: 0, ...track.shift };
    for (const p of programmes) {
      const [farm, industry, urban, literate] = PROGRAMME_SHIFT[p.kind]!;
      shift.farm += farm * years;
      shift.industry += industry * years;
      shift.urban += urban * years;
      shift.literate += literate * years;
    }
    if (isPlayer || had?.shift || programmes.length) {
      const gdp = Math.max(0.01, e.gdp);
      const industryBudget = clamp(e.budget.industry / gdp / 0.04 - 1, -1, 3);
      shift.industry += 0.25 * industryBudget * years;
      shift.farm -= 0.15 * Math.max(0, industryBudget) * years;
      const rich = (realIncome(next, map, tag, lands) ?? 0) >= RICH_INCOME;
      const social = clamp(e.budget.social / gdp / Math.max(0.005, socialNorm(next.scenarioId, rich)) - 1, -1, 2);
      shift.literate += 0.2 * social * years;
    }
    if (wars.some((w) => !w.truce)) shift.industry += 0.5 * years;
    const kept = Object.fromEntries(Object.entries(shift).map(([k, v]) => [k, Math.round(clamp(v, -MAX_SHIFT, MAX_SHIFT) * 100) / 100]).filter(([, v]) => v !== 0));
    if (Object.keys(kept).length) track.shift = kept;
    else delete track.shift;

    // The player's poverty line follows incomes over a generation.
    if (isPlayer && track.anchor) {
      const real = realIncome(next, map, tag, lands);
      if (real !== null) track.anchor = Math.round(track.anchor + (real - track.anchor) * Math.min(1, years * 0.04));
    }

    if (Object.keys(track).length) society[tag] = track;
    else delete society[tag];
  }
  // Countries that are gone keep nothing.
  for (const tag of Object.keys(society)) if (!next.countries[tag]) delete society[tag];
  next.society = society;
}

/** A share with its change since the start, for the prompt: "42% (+3)". */
function withChange(now: number, start: number | undefined): string {
  const d = start === undefined ? 0 : Math.round(now - start);
  return `${Math.round(now)}%${d ? ` (${d > 0 ? "+" : ""}${d})` : ""}`;
}

/**
 * One line on the player's society for the game master and the ministers:
 * "society: poor 42% (+3), middle 51%, rich 7%; urban 39%; farm 30%, industry 28%; literate 85%; jobless 6%; under 15 31%; men 20–34 −8% since the start".
 */
export function societyLine(state: SocietyState, map: Record<string, MapRegion> | null | undefined): string {
  const s = societyOf(state, map, state.player);
  if (!s) return "";
  const st = s.start;
  const men = st && st.men > 0 ? Math.round(((s.men - st.men) / st.men) * 100) : 0;
  return [
    `society: poor ${withChange(s.poor, st?.poor)}, middle ${Math.round(s.middle)}%, rich ${withChange(s.rich, st?.rich)}`,
    `urban ${withChange(s.urban, st?.urban)}`,
    `farm ${withChange(s.farm, st?.farm)}, industry ${withChange(s.industry, st?.industry)}`,
    `literate ${withChange(s.literate, st?.literate)}`,
    `under 15 ${withChange(s.young, st?.young)}`,
    ...(Math.abs(men) >= 2 ? [`men 20–34 ${men > 0 ? "+" : "−"}${Math.abs(men)}% since the start`] : []),
  ].join("; ");
}

/** The figures a foreign society is shown by, as estimates under fog of war. */
export const SOCIETY_FIGURES = ["poor", "middle", "rich", "urban", "literate", "farm", "industry", "services", "jobless", "young", "old"] as const;
export type SocietyFigure = (typeof SOCIETY_FIGURES)[number];

/** How far off a guess may be, in points at the least known: a census is public almost everywhere, incomes and jobs less so. */
const ESTIMATE_WIDTH: Record<SocietyFigure, number> = { poor: 16, middle: 16, rich: 8, jobless: 12, urban: 8, literate: 6, farm: 8, industry: 8, services: 8, young: 5, old: 5 };

/**
 * Another country's society as the player's government knows it
 * (engine/fog.ts): each share an estimate whose error shrinks with what it
 * knows of the country, the same all turn.
 */
export function societyEstimates(state: Pick<GameState, "seed" | "id" | "turn">, tag: string, s: Society, score: number): Record<SocietyFigure, Estimate> {
  return Object.fromEntries(SOCIETY_FIGURES.map((k) => [k, estimateRate(s[k], score, ESTIMATE_WIDTH[k], state, `${tag}:society:${k}`, [0, 100])])) as Record<SocietyFigure, Estimate>;
}

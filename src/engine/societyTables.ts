import type { MapRegion, ScenarioId } from "./types";

/**
 * The society's tables (engine/society.ts): what each part of the world, and
 * the main countries where they differ, looked like on the anchor years – the
 * age shares, towns, literacy, work and inequality – and how a year between
 * the anchors is read. Kept apart so the economy can read literacy without
 * the rest of society.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The years the tables are given for: the eight start dates and a projection. */
export const ANCHORS = [1914, 1939, 1950, 1964, 1991, 1999, 2014, 2022, 2040] as const;
export type Row = readonly [number, number, number, number, number, number, number, number, number];

/** What a part of the world looks like on each anchor year. */
export interface Profile {
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

export type Region = "west" | "east" | "soviet" | "nam" | "oce" | "lat" | "eas" | "sas" | "sea" | "mena" | "ssa";

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

/** A table's value in a year: straight between the anchors, held beyond them. */
export function at(row: Row, year: number): number {
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
export function profileOf(p: Pick<MapRegion, "adm0" | "at">): Profile {
  const base = PROFILES[regionOf(p)];
  const grouped = GROUP_OF[p.adm0] ? OVERRIDES[GROUP_OF[p.adm0]] : undefined;
  const own = OVERRIDES[p.adm0];
  if (!grouped && !own) return base;
  return { ...base, ...grouped, ...own };
}

/** Adults who could read on the start date of a game begun in `era`, %, for a province's modern country. */
export function literacyAtStart(p: Pick<MapRegion, "adm0" | "at">, era: ScenarioId): number {
  return at(profileOf(p).literate, Number(era));
}

/** Literacy now, %: the start's figure rising as schooling spreads (2% of the gap a year), moved by what programmes and budgets shifted. */
export const literacyNow = (start: number, years: number, shift = 0) => clamp(start + (100 - start) * (1 - Math.exp(-0.02 * years)) + shift, 1, 99.5);

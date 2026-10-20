import type { CountrySeed, Localized } from "../types";

/**
 * The Cold War dates (1950, 1964) are drawn on the 1994 map, whose
 * historical owners are those of 1994. Every modern country (Natural Earth
 * adm0 code) is given its owner of the day here instead, so the empires,
 * the Soviet Union and the divided states come out right; a scenario then
 * corrects single provinces (the two Germanies, Korea, Vietnam, Aden).
 */

/** Each modern country as itself: the base the dates change. */
export const MODERN: Record<string, string> = {
  AFG: "afghanistan", AGO: "angola", ALB: "albania", AND: "andorra", ARE: "united-arab-emirates", ARG: "argentina", ARM: "armenia",
  ATG: "antigua-and-barbuda", AUS: "australia", AUT: "austria", AZE: "azerbaijan", BDI: "burundi", BEL: "belgium", BEN: "benin",
  BFA: "burkina-faso", BGD: "bangladesh", BGR: "bulgaria", BHR: "bahrain", BHS: "bahamas", BIH: "bosnia-and-herzegovina", BLR: "belarus",
  BLZ: "belize", BOL: "bolivia", BRA: "brazil", BRB: "barbados", BRN: "brunei", BTN: "bhutan", BWA: "botswana",
  CAF: "central-african-republic", CAN: "canada", CHE: "switzerland", CHL: "chile", CHN: "china", CIV: "ivory-coast", CMR: "cameroon",
  COD: "dr-congo", COG: "congo", COL: "colombia", CRI: "costa-rica", CUB: "cuba", CYP: "cyprus", CYN: "cyprus", CZE: "czechia",
  DEU: "germany", DJI: "djibouti", DMA: "dominica", DNK: "denmark", DOM: "dominican-republic", DZA: "algeria", ECU: "ecuador",
  EGY: "egypt", ERI: "eritrea", ESP: "spain", EST: "estonia", ETH: "ethiopia", FIN: "finland", FJI: "fiji", FRA: "france", GAB: "gabon",
  GBR: "uk", GEO: "georgia", GHA: "ghana", GIN: "guinea", GMB: "gambia", GNB: "guinea-bissau", GNQ: "equatorial-guinea", GRC: "greece",
  GRD: "grenada", GTM: "guatemala", GUY: "guyana", HND: "honduras", HRV: "croatia", HTI: "haiti", HUN: "hungary", IDN: "indonesia",
  IND: "india", IRL: "ireland", IRN: "iran", IRQ: "iraq", ISL: "iceland", ISR: "israel", ITA: "italy", JAM: "jamaica", JOR: "jordan",
  JPN: "japan", KAZ: "kazakhstan", KEN: "kenya", KGZ: "kyrgyzstan", KHM: "cambodia", KNA: "saint-kitts-and-nevis", KOR: "south-korea",
  KOS: "kosovo", KWT: "kuwait", LAO: "laos", LBN: "lebanon", LBR: "liberia", LBY: "libya", LCA: "saint-lucia", LIE: "liechtenstein",
  LKA: "sri-lanka", LSO: "lesotho", LTU: "lithuania", LUX: "luxembourg", LVA: "latvia", MAR: "morocco", MDA: "moldova", MDG: "madagascar",
  MEX: "mexico", MKD: "macedonia", MLI: "mali", MLT: "malta", MMR: "myanmar", MNE: "montenegro", MNG: "mongolia", MOZ: "mozambique",
  MRT: "mauritania", MWI: "malawi", MYS: "malaysia", NAM: "namibia", NER: "niger", NGA: "nigeria", NIC: "nicaragua", NLD: "netherlands",
  NOR: "norway", NPL: "nepal", NZL: "new-zealand", OMN: "oman", PAK: "pakistan", PAN: "panama", PER: "peru", PHL: "philippines",
  PNG: "papua-new-guinea", POL: "poland", PRK: "north-korea", PRT: "portugal", PRY: "paraguay", PSX: "palestine", QAT: "qatar",
  ROU: "romania", RUS: "russia", RWA: "rwanda", SAU: "saudi-arabia", SDN: "sudan", SDS: "south-sudan", SEN: "senegal", SGP: "singapore",
  SLB: "solomon-islands", SLE: "sierra-leone", SLV: "el-salvador", SOL: "somalia", SOM: "somalia", SRB: "serbia", SUR: "suriname",
  SVK: "slovakia", SVN: "slovenia", SWE: "sweden", SWZ: "swaziland", SYR: "syria", TCD: "chad", TGO: "togo", THA: "thailand",
  TJK: "tajikistan", TKM: "turkmenistan", TON: "tonga", TTO: "trinidad-and-tobago", TUN: "tunisia", TUR: "turkey", TWN: "taiwan",
  TZA: "tanzania", UGA: "uganda", UKR: "ukraine", URY: "uruguay", USA: "usa", UZB: "uzbekistan", VCT: "saint-vincent-and-the-grenadines",
  VEN: "venezuela", VNM: "vietnam", WSM: "samoa", YEM: "yemen", ZAF: "south-africa", ZMB: "zambia", ZWE: "zimbabwe",
  // Islands, slivers and microstates that stayed with a larger country, or are too small to play.
  ABW: "netherlands", AIA: "uk", ALD: "finland", ASM: "usa", ATC: "australia", ATF: "france", BLM: "france", BMU: "uk", CLP: "france",
  COK: "new-zealand", COM: "france", CPV: "portugal", CUW: "netherlands", CYM: "uk", ESB: "uk", FLK: "uk", FRO: "denmark", FSM: "usa",
  GGY: "uk", GIB: "uk", GRL: "denmark", GUM: "usa", HKG: "uk", HMD: "australia", IMN: "uk", IOA: "australia", IOT: "uk", JEY: "uk",
  KAB: "kazakhstan", KAS: "india", KIR: "uk", MAC: "portugal", MAF: "france", MCO: "france", MDV: "uk", MHL: "usa", MNP: "usa",
  MSR: "uk", MUS: "uk", NCL: "france", NFK: "australia", NIU: "new-zealand", NRU: "australia", PCN: "uk", PGA: "philippines", PLW: "usa",
  PRI: "usa", PYF: "france", SAH: "spain", SGS: "uk", SHN: "uk", SMR: "italy", SPM: "france", STP: "portugal", SXM: "netherlands",
  SYC: "uk", TCA: "uk", TLS: "portugal", TUV: "uk", UMI: "usa", USG: "usa", VGB: "uk", VIR: "usa", VUT: "uk", WLF: "france", WSB: "uk",
};

/** The same owner for a list of modern countries. */
export const all = (owner: string, codes: string[]): Record<string, string> => Object.fromEntries(codes.map((code) => [code, owner]));

/** The Soviet republics, the Yugoslav republics and the Czech and Slovak lands, whole. */
export const SOVIET = ["RUS", "UKR", "BLR", "EST", "LVA", "LTU", "MDA", "GEO", "ARM", "AZE", "KAZ", "KAB", "UZB", "TKM", "KGZ", "TJK"];
export const YUGOSLAV = ["SVN", "HRV", "BIH", "SRB", "KOS", "MNE", "MKD"];
export const CZECHOSLOVAK = ["CZE", "SVK"];

/** The Länder of the German Democratic Republic, Berlin with them (West Berlin is an enclave the map cannot draw). */
export const EAST_GERMAN = ["de-mecklenburg-western-pomerania", "de-brandenburg", "de-saxony-anhalt", "de-saxony", "de-thuringia", "de-berlin"];

/** The British protectorates of the Aden hinterland and the Hadhramaut, south of the Imam's Yemen. */
export const ADEN = ["ye-adan", "ye-lahij", "ye-abyan", "ye-ad-dali", "ye-shabwah", "ye-hadhramaut", "ye-al-mahrah"];

/** Countries both Cold War dates seed alike, under the names of the time. */
export const seed = (name: Localized, color: string, leader: string, government: Localized, stats: CountrySeed["stats"]): CountrySeed => ({ name, color, leader, government, stats });

export const L = (en: string, ru: string, uk: string): Localized => ({ en, ru, uk });

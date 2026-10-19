/**
 * Islands, enclaves and slivers that the 1994 and 2010 historical sources
 * draw with a neighbour, given to their owners of the day. The 1991, 2014
 * and 2022 scenarios start from these; each adds what changed in its own
 * years.
 */

/** Modern countries the sources fold into a neighbour, whole (Natural Earth adm0 code -> owner tag). */
export const COUNTRIES_TODAY: Record<string, string> = {
  NCL: "france",
  SGP: "singapore",
  SLB: "solomon-islands",
};

/** Single provinces the sources give to a neighbour (province id -> owner tag). */
export const ISLANDS_TODAY: Record<string, string> = {
  "fr-reunion": "france",
  "fr-mayotte": "france",
  "es-ceuta": "spain",
  "es-melilla": "spain",
  "pt-madeira": "portugal",
  "pt-azores": "portugal",
  "in-andaman-and-nicobar-islands": "india",
  "gr-north-aegean": "greece",
  "tz-south-pemba": "tanzania",
  "tz-north-pemba": "tanzania",
  "nz-chatham-islands": "new-zealand",
  "nz-kermadec-islands": "new-zealand",
  "au-macquarie-island": "australia",
  "no-bouvet-island": "norway",
  "gq-annobon": "equatorial-guinea",
  "co-archipelago-of-saint-andrews": "colombia",
  "id-riau-islands": "indonesia",
  "my-perlis": "malaysia",
  "bn-temburong": "brunei",
  "kp-rason": "north-korea",
  // Kinmen and Matsu, held by the Republic of China on Taiwan.
  "tw-fujian-province": "taiwan",
  "kw-al-jahra-p2": "kuwait",
};

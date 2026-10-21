import type { AimKind, PlanKind, PlanStage, ScenarioId } from "../types";

/**
 * What each start date's governments intend (engine/intentions.ts):
 *
 * - `aims`: claims, ambitions and protégés on the start date — [kind, target,
 *   weight 0–100];
 * - `hawk`: a government's appetite for force where its kind of regime would
 *   mislead (0–100);
 * - `trust`: where a government's trust in another stands apart from their
 *   treaties — an ally it resents, a rival it has made up with (-100–100);
 * - `live`: plans under way on the start date, at the stage they had reached
 *   and with the date history carried them out (in both modes);
 * - `dated`: later history, for the historical mode only: each plan enters
 *   play when its `opens` date falls in a turn, if its countries still stand.
 *
 * A date is a tendency, never a script: the dice move every plan, and the
 * state of the world can stop it.
 */
export interface PlanSeed {
  id: string;
  kind: PlanKind;
  by: string;
  target?: string;
  partners?: string[];
  /** Join and peace: the scenario's war. */
  war?: string;
  side?: "attackers" | "defenders";
  /** Bloc: what it founds, or the scenario's bloc it joins; leave: the bloc it leaves. */
  blocKind?: "alliance" | "pact";
  bloc?: string;
  stage: PlanStage;
  due?: string;
  /** Dated seeds: the day the plan enters play. */
  opens?: string;
}

export interface IntentionSeeds {
  aims: Record<string, [AimKind, string, number][]>;
  hawk?: Record<string, number>;
  trust?: Record<string, [string, number][]>;
  live: PlanSeed[];
  dated: PlanSeed[];
}

export const INTENTIONS: Record<ScenarioId, IntentionSeeds> = {
  "1914": {
    aims: {
      "austria-hungary": [["expand", "serbia", 75]],
      germany: [["protect", "austria-hungary", 70], ["expand", "france", 30]],
      russia: [["protect", "serbia", 80], ["expand", "ottoman", 30]],
      france: [["reclaim", "germany", 60]],
      uk: [["protect", "belgium", 60], ["protect", "france", 50]],
      italy: [["reclaim", "austria-hungary", 45]],
      serbia: [["expand", "austria-hungary", 40]],
      bulgaria: [["reclaim", "serbia", 55]],
      romania: [["expand", "austria-hungary", 40]],
      greece: [["expand", "ottoman", 35]],
      ottoman: [["reclaim", "russia", 30], ["reclaim", "greece", 30]],
      japan: [["expand", "germany", 30]],
    },
    hawk: { germany: 65, "austria-hungary": 70, russia: 60, france: 55, uk: 45, italy: 40, usa: 25 },
    // Italy's alliance with Vienna was a marriage of convenience.
    trust: { italy: [["austria-hungary", -40], ["germany", 0]], "austria-hungary": [["serbia", -60], ["italy", -10]], serbia: [["austria-hungary", -60], ["russia", 50]], russia: [["serbia", 50]] },
    live: [{ id: "july-crisis", kind: "war", by: "austria-hungary", target: "serbia", partners: ["germany"], stage: "decision", due: "1914-07-28" }],
    dated: [
      { id: "japan-tsingtao", kind: "war", by: "japan", target: "germany", stage: "preparation", opens: "1914-08-10", due: "1914-08-23" },
      { id: "ottoman-war", kind: "war", by: "ottoman", target: "russia", partners: ["germany"], stage: "preparation", opens: "1914-10-01", due: "1914-10-29" },
      { id: "italy-leaves", kind: "leave", by: "italy", bloc: "triple-alliance", stage: "decision", opens: "1915-03-01", due: "1915-05-03" },
      { id: "italy-war", kind: "war", by: "italy", target: "austria-hungary", stage: "preparation", opens: "1915-05-04", due: "1915-05-23" },
      { id: "bulgaria-war", kind: "war", by: "bulgaria", target: "serbia", partners: ["germany", "austria-hungary"], stage: "preparation", opens: "1915-09-01", due: "1915-10-14" },
      { id: "romania-war", kind: "war", by: "romania", target: "austria-hungary", stage: "decision", opens: "1916-06-01", due: "1916-08-27" },
      { id: "usa-war", kind: "war", by: "usa", target: "germany", stage: "tension", opens: "1917-02-01", due: "1917-04-06" },
    ],
  },
  "1939": {
    aims: {
      germany: [["expand", "poland", 90], ["expand", "ussr", 60], ["expand", "france", 40]],
      italy: [["expand", "greece", 40], ["expand", "france", 30], ["expand", "yugoslavia", 30]],
      ussr: [["reclaim", "poland", 70], ["reclaim", "finland", 50], ["reclaim", "romania", 50]],
      japan: [["expand", "china", 80], ["expand", "uk", 30], ["expand", "netherlands", 40]],
      hungary: [["reclaim", "romania", 60], ["reclaim", "yugoslavia", 30]],
      uk: [["protect", "poland", 70], ["protect", "france", 60]],
      france: [["protect", "poland", 70]],
      usa: [["protect", "uk", 40], ["protect", "china", 30]],
      china: [["reclaim", "japan", 80]],
    },
    hawk: { germany: 85, italy: 60, japan: 75, ussr: 65, uk: 45, france: 40, usa: 25, poland: 50 },
    trust: { poland: [["germany", -70]], ussr: [["germany", 10]], germany: [["ussr", 10]] },
    live: [
      { id: "uk-poland", kind: "join", by: "uk", war: "invasion-of-poland", side: "defenders", target: "germany", stage: "decision", due: "1939-09-03" },
      { id: "france-poland", kind: "join", by: "france", war: "invasion-of-poland", side: "defenders", target: "germany", stage: "decision", due: "1939-09-03" },
      { id: "soviet-invasion", kind: "war", by: "ussr", target: "poland", stage: "preparation", due: "1939-09-17" },
      { id: "winter-war", kind: "war", by: "ussr", target: "finland", stage: "tension", due: "1939-11-30" },
      { id: "khalkhin-gol-truce", kind: "peace", by: "japan", target: "ussr", war: "khalkhin-gol", stage: "decision", due: "1939-09-15" },
    ],
    dated: [
      { id: "weserubung", kind: "war", by: "germany", target: "norway", stage: "decision", opens: "1940-02-01", due: "1940-04-09" },
      { id: "fall-gelb-netherlands", kind: "war", by: "germany", target: "netherlands", stage: "decision", opens: "1940-03-01", due: "1940-05-10" },
      { id: "fall-gelb-belgium", kind: "war", by: "germany", target: "belgium", stage: "decision", opens: "1940-03-01", due: "1940-05-10" },
      { id: "italy-enters", kind: "join", by: "italy", war: "invasion-of-poland", side: "attackers", target: "france", stage: "tension", opens: "1940-04-01", due: "1940-06-10" },
      { id: "tripartite", kind: "bloc", by: "germany", partners: ["italy", "japan"], blocKind: "alliance", stage: "decision", opens: "1940-07-01", due: "1940-09-27" },
      { id: "barbarossa", kind: "war", by: "germany", target: "ussr", partners: ["romania", "finland"], stage: "decision", opens: "1940-07-31", due: "1941-06-22" },
      { id: "greco-italian", kind: "war", by: "italy", target: "greece", stage: "decision", opens: "1940-09-01", due: "1940-10-28" },
      { id: "pearl-harbor", kind: "war", by: "japan", target: "usa", stage: "decision", opens: "1941-07-01", due: "1941-12-07" },
      { id: "malaya", kind: "war", by: "japan", target: "uk", stage: "decision", opens: "1941-07-01", due: "1941-12-08" },
      { id: "august-storm", kind: "war", by: "ussr", target: "japan", stage: "tension", opens: "1945-04-05", due: "1945-08-08" },
    ],
  },
  "1950": {
    aims: {
      "north-korea": [["expand", "south-korea", 90]],
      "south-korea": [["reclaim", "north-korea", 60]],
      china: [["reclaim", "taiwan", 80], ["protect", "north-korea", 50]],
      usa: [["protect", "south-korea", 60], ["protect", "taiwan", 50], ["protect", "japan", 50]],
      ussr: [["protect", "north-korea", 50], ["protect", "china", 40]],
      pakistan: [["reclaim", "india", 60]],
      india: [["reclaim", "pakistan", 40]],
      egypt: [["reclaim", "israel", 40]],
    },
    hawk: { "north-korea": 80, china: 70, ussr: 60, usa: 50 },
    live: [
      { id: "usa-korea", kind: "join", by: "usa", war: "korean-war", side: "defenders", target: "north-korea", stage: "decision", due: "1950-06-27" },
      { id: "uk-korea", kind: "join", by: "uk", war: "korean-war", side: "defenders", target: "north-korea", stage: "decision", due: "1950-07-01" },
      { id: "turkey-korea", kind: "join", by: "turkey", war: "korean-war", side: "defenders", target: "north-korea", stage: "tension", due: "1950-07-25" },
      { id: "china-korea", kind: "join", by: "china", war: "korean-war", side: "attackers", target: "south-korea", stage: "tension", due: "1950-10-19" },
    ],
    dated: [
      { id: "suez", kind: "war", by: "israel", target: "egypt", partners: ["uk", "france"], stage: "tension", opens: "1956-08-01", due: "1956-10-29" },
      { id: "sino-indian", kind: "war", by: "china", target: "india", stage: "tension", opens: "1962-08-01", due: "1962-10-20" },
    ],
  },
  "1964": {
    aims: {
      "north-vietnam": [["expand", "south-vietnam", 90]],
      usa: [["protect", "south-vietnam", 70], ["protect", "south-korea", 50]],
      indonesia: [["expand", "malaysia", 60]],
      pakistan: [["reclaim", "india", 70]],
      egypt: [["reclaim", "israel", 40]],
      syria: [["reclaim", "israel", 40]],
      china: [["reclaim", "taiwan", 70]],
      "north-korea": [["expand", "south-korea", 50]],
    },
    hawk: { "north-vietnam": 80, usa: 55, indonesia: 70, pakistan: 60, israel: 60 },
    live: [
      { id: "tonkin", kind: "join", by: "usa", war: "vietnam-war", side: "defenders", target: "north-vietnam", stage: "preparation", due: "1964-08-07" },
      { id: "indo-pakistani-1965", kind: "war", by: "pakistan", target: "india", stage: "tension", due: "1965-08-05" },
    ],
    dated: [
      { id: "six-day-egypt", kind: "war", by: "israel", target: "egypt", stage: "decision", opens: "1967-05-15", due: "1967-06-05" },
      { id: "six-day-syria", kind: "war", by: "israel", target: "syria", stage: "decision", opens: "1967-05-15", due: "1967-06-09" },
      { id: "zhenbao", kind: "war", by: "china", target: "ussr", stage: "tension", opens: "1969-01-01", due: "1969-03-02" },
      { id: "indo-pakistani-1971", kind: "war", by: "india", target: "pakistan", stage: "decision", opens: "1971-09-01", due: "1971-12-03" },
      { id: "yom-kippur", kind: "war", by: "egypt", target: "israel", partners: ["syria"], stage: "decision", opens: "1973-06-01", due: "1973-10-06" },
      { id: "cyprus", kind: "war", by: "turkey", target: "cyprus", stage: "decision", opens: "1974-07-15", due: "1974-07-20" },
    ],
  },
  "1991": {
    aims: {
      iraq: [["reclaim", "kuwait", 50]],
      pakistan: [["reclaim", "india", 60]],
      india: [["reclaim", "pakistan", 40]],
      china: [["reclaim", "taiwan", 60]],
      "north-korea": [["expand", "south-korea", 40]],
      usa: [["protect", "kuwait", 60], ["protect", "south-korea", 60], ["protect", "saudi-arabia", 60]],
    },
    hawk: { iraq: 75, "north-korea": 70 },
    live: [],
    dated: [
      { id: "kargil", kind: "war", by: "pakistan", target: "india", stage: "tension", opens: "1999-01-01", due: "1999-05-03" },
    ],
  },
  "1999": {
    aims: {
      pakistan: [["reclaim", "india", 60]],
      india: [["reclaim", "pakistan", 40]],
      china: [["reclaim", "taiwan", 60]],
      "north-korea": [["expand", "south-korea", 40]],
      russia: [["protect", "yugoslavia", 40]],
      usa: [["protect", "south-korea", 60], ["protect", "taiwan", 40]],
    },
    hawk: { yugoslavia: 70, pakistan: 60, iraq: 70 },
    live: [
      { id: "kargil", kind: "war", by: "pakistan", target: "india", stage: "decision", due: "1999-05-03" },
      { id: "kosovo-terms", kind: "peace", by: "yugoslavia", target: "usa", war: "allied-force", stage: "decision", due: "1999-06-09" },
    ],
    dated: [
      { id: "afghanistan", kind: "war", by: "usa", target: "afghanistan", partners: ["uk"], stage: "preparation", opens: "2001-09-11", due: "2001-10-07" },
      { id: "iraq", kind: "war", by: "usa", target: "iraq", partners: ["uk", "australia", "poland"], stage: "tension", opens: "2002-06-01", due: "2003-03-20" },
      { id: "lebanon", kind: "war", by: "israel", target: "lebanon", stage: "preparation", opens: "2006-07-01", due: "2006-07-12" },
      { id: "georgia", kind: "war", by: "russia", target: "georgia", stage: "tension", opens: "2008-07-01", due: "2008-08-08" },
    ],
  },
  "2014": {
    aims: {
      russia: [["expand", "ukraine", 60], ["protect", "belarus", 50]],
      china: [["reclaim", "taiwan", 60]],
      "north-korea": [["expand", "south-korea", 30]],
      azerbaijan: [["reclaim", "armenia", 60]],
      usa: [["protect", "poland", 60], ["protect", "lithuania", 60], ["protect", "south-korea", 60], ["protect", "taiwan", 40]],
    },
    hawk: { russia: 70, "north-korea": 70 },
    trust: { russia: [["ukraine", -20]], ukraine: [["russia", -10]], poland: [["russia", -30]], lithuania: [["russia", -40]] },
    live: [{ id: "crimea", kind: "war", by: "russia", target: "ukraine", stage: "tension", due: "2014-02-27" }],
    dated: [
      { id: "yemen", kind: "war", by: "saudi-arabia", target: "yemen", stage: "preparation", opens: "2015-03-01", due: "2015-03-26" },
      { id: "karabakh-2020", kind: "war", by: "azerbaijan", target: "armenia", stage: "tension", opens: "2020-07-12", due: "2020-09-27" },
      { id: "invasion-2022", kind: "war", by: "russia", target: "ukraine", partners: ["belarus"], stage: "tension", opens: "2021-03-01", due: "2022-02-24" },
    ],
  },
  "2022": {
    aims: {
      russia: [["expand", "ukraine", 90]],
      ukraine: [["reclaim", "russia", 90]],
      usa: [["protect", "ukraine", 50], ["protect", "taiwan", 40], ["protect", "poland", 60]],
      uk: [["protect", "ukraine", 50]],
      poland: [["protect", "ukraine", 50]],
      china: [["reclaim", "taiwan", 60]],
      "north-korea": [["expand", "south-korea", 30]],
      azerbaijan: [["reclaim", "armenia", 50]],
    },
    hawk: { russia: 75, ukraine: 70, "north-korea": 70 },
    trust: { finland: [["russia", -30]], sweden: [["russia", -20]], poland: [["russia", -50]], lithuania: [["russia", -60]], ukraine: [["russia", -100]] },
    live: [
      { id: "finland-nato", kind: "bloc", by: "finland", target: "russia", bloc: "nato", stage: "tension", due: "2023-04-04" },
      { id: "sweden-nato", kind: "bloc", by: "sweden", target: "russia", bloc: "nato", stage: "tension", due: "2024-03-07" },
    ],
    dated: [
      { id: "karabakh-2022", kind: "war", by: "azerbaijan", target: "armenia", stage: "tension", opens: "2022-08-01", due: "2022-09-13" },
      { id: "twelve-day-war", kind: "war", by: "israel", target: "iran", stage: "tension", opens: "2025-04-01", due: "2025-06-13" },
      { id: "sindoor", kind: "war", by: "india", target: "pakistan", stage: "decision", opens: "2025-04-22", due: "2025-05-07" },
    ],
  },
};

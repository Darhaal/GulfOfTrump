import type { JointKind, Localized, ProjectKind } from "../types";

/**
 * History's joint actions between governments, for the historical mode
 * (engine/joint.ts): each opens on the day it was agreed, among those of its
 * members the game still has, and is carried out on history's day while
 * they stand together. A member the player plays is asked first: the others
 * offer it to the player's government on the day. Joint offensives,
 * exercises and joint sanctions are left to the engine's dice.
 */

const L = (en: string, ru: string, uk: string): Localized => ({ en, ru, uk });

export interface JointHistory {
  id: string;
  kind: JointKind;
  name: Localized;
  /** The lead first: the programme's or the project's main partner, the government whose air force flies an operation. */
  members: string[];
  /** The day it was agreed, and the day it was carried out. */
  from: string;
  to: string;
  project?: ProjectKind;
  /** An operation: the war it is flown in, against whom. */
  war?: string;
  target?: string;
  /** An atomic programme: the bomb's design shared, or kept by the lead. */
  share?: "equal" | "lead";
}

export const JOINT_HISTORY: JointHistory[] = [
  {
    // The Quebec Agreement merged Britain's Tube Alloys into the American project; Canada gave uranium, heavy water and Chalk River. The McMahon Act of 1946 kept the bomb American.
    id: "manhattan",
    kind: "atom",
    name: L("Manhattan Project", "Манхэттенский проект", "Мангеттенський проєкт"),
    members: ["usa", "uk", "canada"],
    from: "1942-08-13",
    to: "1945-07-16",
    share: "lead",
  },
  {
    // The 64th Fighter Aviation Corps flew MiG-15s over the Yalu in Chinese and Korean markings.
    id: "mig-alley",
    kind: "operation",
    name: L("Soviet air cover over Korea", "Советское авиаприкрытие в Корее", "Радянське авіаприкриття в Кореї"),
    members: ["ussr", "china", "north-korea"],
    from: "1950-11-01",
    to: "1953-07-27",
    war: "korean-war",
    target: "south-korea",
  },
  {
    // Comecon's oil pipeline from the Volga to Poland, East Germany, Czechoslovakia and Hungary.
    id: "druzhba",
    kind: "project",
    project: "pipeline",
    name: L("Druzhba pipeline", "Нефтепровод «Дружба»", "Нафтопровід «Дружба»"),
    members: ["ussr", "poland", "east-germany", "czechoslovakia", "hungary"],
    from: "1960-12-18",
    to: "1964-10-15",
  },
  {
    id: "concorde",
    kind: "project",
    project: "aircraft",
    name: L("Concorde", "«Конкорд»", "«Конкорд»"),
    members: ["france", "uk"],
    from: "1962-11-29",
    to: "1976-01-21",
  },
  {
    // The socialist countries' flights and experiments on Soviet rockets.
    id: "interkosmos",
    kind: "space",
    name: L("Interkosmos", "«Интеркосмос»", "«Інтеркосмос»"),
    members: ["ussr", "czechoslovakia", "poland", "east-germany", "hungary", "bulgaria", "romania"],
    from: "1967-04-13",
    to: "1981-05-22",
  },
  {
    id: "airbus",
    kind: "project",
    project: "aircraft",
    name: L("Airbus A300", "Airbus A300", "Airbus A300"),
    members: ["france", "west-germany"],
    from: "1969-05-29",
    to: "1974-05-23",
  },
  {
    id: "apollo-soyuz",
    kind: "space",
    name: L("Apollo–Soyuz", "«Союз – Аполлон»", "«Союз – Аполлон»"),
    members: ["usa", "ussr"],
    from: "1972-05-24",
    to: "1975-07-17",
  },
  {
    id: "ariane",
    kind: "space",
    name: L("Ariane", "«Ариан»", "«Аріан»"),
    members: ["france", "west-germany", "italy"],
    from: "1973-07-31",
    to: "1979-12-24",
  },
  {
    // The gas-for-pipes deal: West German, French and Italian pipe and credit for Siberian gas, against Reagan's embargo.
    id: "urengoy",
    kind: "project",
    project: "pipeline",
    name: L("Urengoy–Pomary–Uzhhorod pipeline", "Газопровод Уренгой – Помары – Ужгород", "Газопровід Уренгой – Помари – Ужгород"),
    members: ["ussr", "west-germany", "france", "italy"],
    from: "1981-11-20",
    to: "1984-01-01",
  },
  {
    id: "channel-tunnel",
    kind: "project",
    project: "tunnel",
    name: L("Channel Tunnel", "Тоннель под Ла-Маншем", "Тунель під Ла-Маншем"),
    members: ["uk", "france"],
    from: "1986-02-12",
    to: "1994-05-06",
  },
  {
    id: "iss",
    kind: "space",
    name: L("International Space Station", "Международная космическая станция", "Міжнародна космічна станція"),
    members: ["usa", "russia", "japan", "canada"],
    from: "1998-01-29",
    to: "2011-07-21",
  },
  {
    id: "nord-stream",
    kind: "project",
    project: "pipeline",
    name: L("Nord Stream", "«Северный поток»", "«Північний потік»"),
    members: ["russia", "germany"],
    from: "2005-09-08",
    to: "2011-11-08",
  },
];

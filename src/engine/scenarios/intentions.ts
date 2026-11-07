import type { AimKind, PlanKind, PlanStage, ScenarioId, StartVariant } from "../types";

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
 *   play when its `opens` date falls in a turn, if its countries still stand;
 * - `follow`: plans that wait for a war of the date a live plan begins (an
 *   earlier start's), entering play in both modes once it has begun.
 *
 * A date is a tendency, never a script: the dice move every plan, and the
 * state of the world can stop it.
 *
 * An earlier start of a date (`EVES`) has its own live and follow plans: the
 * war its date opens with is a plan at its last stage, the allies who joined
 * it wait for it, and the rest of the date's seeds are shared.
 */
export interface PlanSeed {
  id: string;
  kind: PlanKind;
  by: string;
  target?: string;
  partners?: string[];
  /** Join and peace: the scenario's war (one a seeded plan began in play counts as it). */
  war?: string;
  /** War: the date's war it begins, whose id and name it takes when the engine starts it. */
  begins?: string;
  /** Follow seeds: the date's war they wait for, when it is not their `war`. */
  after?: string;
  side?: "attackers" | "defenders";
  /** Bloc: what it founds, or the scenario's bloc it joins; leave: the bloc it leaves. */
  blocKind?: "alliance" | "pact";
  bloc?: string;
  stage: PlanStage;
  /** The day it reached its stage, when that was before it enters play: a mobilisation under way since the summer. */
  moved?: string;
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
  follow?: PlanSeed[];
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
    live: [{ id: "july-crisis", kind: "war", by: "austria-hungary", target: "serbia", partners: ["germany"], stage: "preparation", due: "1914-07-28" }],
    dated: [
      { id: "japan-tsingtao", kind: "war", by: "japan", target: "germany", stage: "preparation", opens: "1914-08-10", due: "1914-08-23" },
      { id: "ottoman-war", kind: "war", by: "ottoman", target: "russia", partners: ["germany"], stage: "preparation", opens: "1914-10-01", due: "1914-10-29" },
      { id: "italy-leaves", kind: "leave", by: "italy", bloc: "triple-alliance", stage: "decision", opens: "1915-03-01", due: "1915-05-03" },
      { id: "italy-war", kind: "war", by: "italy", target: "austria-hungary", stage: "preparation", opens: "1915-05-04", due: "1915-05-23" },
      { id: "bulgaria-war", kind: "war", by: "bulgaria", target: "serbia", partners: ["germany", "austria-hungary"], stage: "preparation", opens: "1915-09-01", due: "1915-10-14" },
      { id: "romania-war", kind: "war", by: "romania", target: "austria-hungary", stage: "preparation", opens: "1916-06-01", due: "1916-08-27" },
      { id: "usa-war", kind: "war", by: "usa", target: "germany", stage: "tension", opens: "1917-02-01", due: "1917-04-06" },
    ],
  },
  // January 1933: Versailles to be undone in Berlin, Manchuria swallowed and Jehol next, the Chaco and Leticia at war, Italy eyeing Abyssinia.
  "1933": {
    aims: {
      germany: [["reclaim", "poland", 60], ["expand", "austria", 55], ["expand", "czechoslovakia", 30], ["reclaim", "lithuania", 25]],
      japan: [["protect", "manchukuo", 80], ["expand", "china", 70], ["expand", "mongolia", 25]],
      china: [["reclaim", "manchukuo", 80], ["reclaim", "japan", 50]],
      italy: [["expand", "ethiopia", 55], ["protect", "austria", 50], ["protect", "albania", 40], ["protect", "hungary", 30]],
      // Stalin's Soviet Union of the first five-year plans seeks security, not land: the Bessarabian claim waits for 1940.
      ussr: [["protect", "mongolia", 55], ["security", "japan", 45]],
      france: [["protect", "czechoslovakia", 60], ["protect", "poland", 55], ["security", "germany", 60]],
      uk: [["protect", "france", 40], ["protect", "iraq", 30], ["protect", "egypt", 30]],
      usa: [["protect", "china", 25]],
      poland: [["security", "germany", 50], ["security", "ussr", 40]],
      hungary: [["reclaim", "czechoslovakia", 55], ["reclaim", "romania", 55], ["reclaim", "yugoslavia", 30]],
      bulgaria: [["reclaim", "romania", 35], ["reclaim", "yugoslavia", 30], ["reclaim", "greece", 25]],
      lithuania: [["reclaim", "poland", 45]],
      austria: [["security", "germany", 50]],
      ethiopia: [["security", "italy", 40]],
      bolivia: [["expand", "paraguay", 70]],
      paraguay: [["security", "bolivia", 70]],
      peru: [["expand", "colombia", 40]],
      colombia: [["reclaim", "peru", 60]],
      "saudi-arabia": [["expand", "yemen", 35]],
      yemen: [["reclaim", "saudi-arabia", 35]],
    },
    hawk: { germany: 60, japan: 75, italy: 55, ussr: 25, poland: 50, hungary: 45, bolivia: 65, paraguay: 55, peru: 50, china: 40, france: 35, uk: 25, usa: 15 },
    // Versailles's quarrels, Vilnius, Trianon, Manchuria, the Chaco and Leticia: they feed incidents from the first turn.
    trust: {
      germany: [["poland", -40], ["france", -40], ["ussr", -10]],
      france: [["germany", -45], ["italy", -15]],
      poland: [["germany", -40], ["ussr", -40], ["lithuania", -20]],
      lithuania: [["poland", -60]],
      ussr: [["japan", -40], ["poland", -20], ["uk", -25]],
      japan: [["china", -50], ["ussr", -35]],
      china: [["japan", -70]],
      italy: [["yugoslavia", -30], ["france", -20]],
      yugoslavia: [["italy", -40], ["hungary", -30], ["bulgaria", -25]],
      hungary: [["czechoslovakia", -40], ["romania", -40], ["yugoslavia", -30]],
      austria: [["germany", -20]],
      bolivia: [["paraguay", -70]],
      paraguay: [["bolivia", -70]],
      peru: [["colombia", -50]],
      colombia: [["peru", -60]],
      usa: [["japan", -25]],
    },
    live: [
      // The Lytton Report goes to the Assembly in February; Matsuoka walks out on 24 February, and Tokyo gives notice on 27 March.
      { id: "japan-leaves-league", kind: "leave", by: "japan", bloc: "league-of-nations", stage: "decision", due: "1933-03-27" },
      // After Jehol and the Great Wall, the Tanggu Truce of 31 May leaves a demilitarised zone south of it.
      { id: "tanggu", kind: "peace", by: "china", target: "japan", war: "manchurian-conflict", stage: "decision", due: "1933-05-31" },
      // Sánchez Cerro's murder on 30 April opens the way to the League's mediation and the peace of 25 May.
      { id: "leticia-peace", kind: "peace", by: "peru", target: "colombia", war: "leticia-war", stage: "decision", due: "1933-05-25" },
    ],
    dated: [
      { id: "germany-leaves-league", kind: "leave", by: "germany", bloc: "league-of-nations", stage: "tension", opens: "1933-06-01", due: "1933-10-14" },
      { id: "german-polish", kind: "bloc", by: "germany", partners: ["poland"], blocKind: "pact", stage: "tension", opens: "1933-11-01", due: "1934-01-26" },
      { id: "balkan-pact", kind: "bloc", by: "yugoslavia", partners: ["greece", "romania", "turkey"], blocKind: "pact", stage: "tension", opens: "1933-10-01", due: "1934-02-09" },
      { id: "saudi-yemeni", kind: "war", by: "saudi-arabia", target: "yemen", stage: "tension", opens: "1934-01-01", due: "1934-03-20" },
      { id: "ussr-league", kind: "bloc", by: "ussr", bloc: "league-of-nations", stage: "tension", opens: "1934-05-01", due: "1934-09-18" },
      { id: "franco-soviet", kind: "bloc", by: "france", partners: ["ussr"], blocKind: "pact", stage: "tension", opens: "1934-11-01", due: "1935-05-02" },
      { id: "chaco-truce", kind: "peace", by: "bolivia", target: "paraguay", war: "chaco-war", stage: "decision", opens: "1935-03-01", due: "1935-06-12" },
      { id: "abyssinia", kind: "war", by: "italy", target: "ethiopia", stage: "preparation", opens: "1935-01-01", due: "1935-10-03" },
      { id: "anti-comintern", kind: "bloc", by: "germany", partners: ["japan"], blocKind: "pact", stage: "tension", opens: "1936-06-01", due: "1936-11-25" },
      { id: "marco-polo-bridge", kind: "war", by: "japan", target: "china", stage: "tension", opens: "1937-01-01", due: "1937-07-07" },
      { id: "anschluss", kind: "war", by: "germany", target: "austria", stage: "tension", opens: "1937-11-05", due: "1938-03-12" },
      { id: "khalkhin-gol", kind: "war", by: "japan", target: "mongolia", stage: "tension", opens: "1939-03-01", due: "1939-05-11" },
      { id: "fall-weiss", kind: "war", by: "germany", target: "poland", stage: "preparation", opens: "1939-04-03", due: "1939-09-01" },
      { id: "winter-war", kind: "war", by: "ussr", target: "finland", stage: "tension", opens: "1939-10-05", due: "1939-11-30" },
      { id: "barbarossa", kind: "war", by: "germany", target: "ussr", partners: ["romania", "finland"], stage: "preparation", opens: "1940-07-31", due: "1941-06-22" },
      { id: "pearl-harbor", kind: "war", by: "japan", target: "usa", stage: "preparation", opens: "1941-07-01", due: "1941-12-07" },
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
      { id: "weserubung", kind: "war", by: "germany", target: "norway", stage: "preparation", opens: "1940-02-01", due: "1940-04-09" },
      { id: "fall-gelb-netherlands", kind: "war", by: "germany", target: "netherlands", stage: "preparation", opens: "1940-03-01", due: "1940-05-10" },
      { id: "fall-gelb-belgium", kind: "war", by: "germany", target: "belgium", stage: "preparation", opens: "1940-03-01", due: "1940-05-10" },
      { id: "italy-enters", kind: "join", by: "italy", war: "invasion-of-poland", side: "attackers", target: "france", stage: "tension", opens: "1940-04-01", due: "1940-06-10" },
      { id: "tripartite", kind: "bloc", by: "germany", partners: ["italy", "japan"], blocKind: "alliance", stage: "decision", opens: "1940-07-01", due: "1940-09-27" },
      { id: "barbarossa", kind: "war", by: "germany", target: "ussr", partners: ["romania", "finland"], stage: "preparation", opens: "1940-07-31", due: "1941-06-22" },
      { id: "greco-italian", kind: "war", by: "italy", target: "greece", stage: "preparation", opens: "1940-09-01", due: "1940-10-28" },
      { id: "pearl-harbor", kind: "war", by: "japan", target: "usa", stage: "preparation", opens: "1941-07-01", due: "1941-12-07" },
      { id: "malaya", kind: "war", by: "japan", target: "uk", stage: "preparation", opens: "1941-07-01", due: "1941-12-08" },
      { id: "august-storm", kind: "war", by: "ussr", target: "japan", stage: "tension", opens: "1945-04-05", due: "1945-08-08" },
    ],
  },
  "1950": {
    aims: {
      "north-korea": [["expand", "south-korea", 90]],
      "south-korea": [["reclaim", "north-korea", 60]],
      china: [["reclaim", "taiwan", 80], ["protect", "north-korea", 50]],
      // The Truman Doctrine (March 1947): Greece and Turkey, two years before NATO took them in.
      usa: [["protect", "south-korea", 60], ["protect", "taiwan", 50], ["protect", "japan", 50], ["protect", "turkey", 45], ["protect", "greece", 45]],
      ussr: [["protect", "north-korea", 50], ["protect", "china", 40]],
      pakistan: [["reclaim", "india", 60]],
      india: [["reclaim", "pakistan", 40]],
      egypt: [["reclaim", "israel", 40]],
    },
    hawk: { "north-korea": 80, china: 70, ussr: 60, usa: 50 },
    // The Cold War at its sharpest: the West and the Soviet Union, Tito's break with Stalin, Moscow's pressure on Turkey, Greece and Iran.
    trust: {
      usa: [["ussr", -40], ["china", -35]],
      uk: [["ussr", -30]],
      france: [["ussr", -20]],
      ussr: [["usa", -40], ["uk", -30], ["yugoslavia", -40]],
      china: [["usa", -35]],
      yugoslavia: [["ussr", -40]],
      turkey: [["ussr", -35]],
      greece: [["ussr", -30], ["bulgaria", -30], ["albania", -35]],
      iran: [["ussr", -25]],
    },
    live: [
      { id: "usa-korea", kind: "join", by: "usa", war: "korean-war", side: "defenders", target: "north-korea", stage: "decision", due: "1950-06-27" },
      { id: "uk-korea", kind: "join", by: "uk", war: "korean-war", side: "defenders", target: "north-korea", stage: "decision", due: "1950-07-01" },
      { id: "turkey-korea", kind: "join", by: "turkey", war: "korean-war", side: "defenders", target: "north-korea", stage: "tension", due: "1950-07-25" },
      { id: "china-korea", kind: "join", by: "china", war: "korean-war", side: "attackers", target: "south-korea", stage: "tension", due: "1950-10-19" },
    ],
    dated: [
      // Greece and Turkey join NATO (February 1952), Turkey while its brigade fights in Korea beside the alliance's members.
      { id: "greece-nato", kind: "bloc", by: "greece", target: "ussr", bloc: "nato", stage: "tension", opens: "1951-09-20", due: "1952-02-18" },
      { id: "turkey-nato", kind: "bloc", by: "turkey", target: "ussr", bloc: "nato", stage: "tension", opens: "1951-09-20", due: "1952-02-18" },
      { id: "suez", kind: "war", by: "israel", target: "egypt", partners: ["uk", "france"], stage: "tension", opens: "1956-08-01", due: "1956-10-29" },
      { id: "sino-indian", kind: "war", by: "china", target: "india", stage: "tension", opens: "1962-08-01", due: "1962-10-20" },
    ],
  },
  // October 1957: Turkey's army on Syria's border, Mao eyeing Kinmen, the Moroccan irregulars gathering at Ifni, Sukarno at West New Guinea.
  "1957": {
    aims: {
      china: [["reclaim", "taiwan", 80]],
      taiwan: [["reclaim", "china", 40]],
      "north-korea": [["expand", "south-korea", 50]],
      "south-korea": [["reclaim", "north-korea", 40]],
      "north-vietnam": [["expand", "south-vietnam", 75]],
      usa: [["protect", "taiwan", 60], ["protect", "south-korea", 55], ["protect", "south-vietnam", 45], ["protect", "west-germany", 50], ["protect", "jordan", 35], ["protect", "lebanon", 35]],
      ussr: [["protect", "east-germany", 60], ["protect", "syria", 50], ["protect", "egypt", 40], ["protect", "north-korea", 40]],
      egypt: [["reclaim", "israel", 40]],
      syria: [["reclaim", "israel", 40]],
      israel: [["security", "egypt", 40]],
      turkey: [["security", "syria", 45]],
      pakistan: [["reclaim", "india", 60]],
      india: [["reclaim", "portugal", 50]],
      indonesia: [["reclaim", "netherlands", 60]],
      morocco: [["reclaim", "spain", 40]],
      uk: [["protect", "jordan", 30], ["protect", "malaysia", 50]],
    },
    hawk: { china: 65, "north-korea": 60, "north-vietnam": 65, turkey: 55, israel: 60, egypt: 55, ussr: 55, usa: 50, france: 55 },
    // After Suez and Budapest: London and Paris against Cairo, Ankara against Damascus, Moscow and Washington at the height of their quarrel, Tito half-reconciled.
    trust: {
      usa: [["ussr", -45], ["china", -50], ["egypt", -15]],
      // Allies still, but Mao has judged Khrushchev's secret speech and the split is coming.
      ussr: [["usa", -45], ["uk", -35], ["yugoslavia", -10], ["turkey", -30], ["china", 10]],
      china: [["usa", -50], ["taiwan", -60], ["ussr", 0]],
      uk: [["egypt", -40], ["ussr", -30]],
      france: [["egypt", -45], ["ussr", -25], ["tunisia", -20], ["morocco", -15]],
      egypt: [["uk", -45], ["france", -50], ["israel", -60]],
      israel: [["egypt", -60], ["syria", -50]],
      syria: [["turkey", -40], ["israel", -55], ["iraq", -20]],
      turkey: [["syria", -40], ["ussr", -35]],
      yugoslavia: [["ussr", -15]],
      poland: [["ussr", -10]],
    },
    live: [
      // Turkey's army masses on the Syrian border since August; Moscow warns Ankara, Washington backs it.
      { id: "syrian-crisis", kind: "war", by: "turkey", target: "syria", stage: "preparation", moved: "1957-09-01" },
      // The Moroccan Army of Liberation's attack on Ifni, launched on 23 November.
      { id: "ifni", kind: "war", by: "morocco", target: "spain", stage: "tension", due: "1957-11-23" },
    ],
    dated: [
      { id: "taiwan-strait", kind: "war", by: "china", target: "taiwan", stage: "tension", opens: "1958-06-01", due: "1958-08-23" },
      { id: "goa", kind: "war", by: "india", target: "portugal", stage: "tension", opens: "1961-09-01", due: "1961-12-18" },
      { id: "west-new-guinea", kind: "war", by: "indonesia", target: "netherlands", stage: "tension", opens: "1961-12-19", due: "1962-01-15" },
      { id: "sino-indian", kind: "war", by: "china", target: "india", stage: "tension", opens: "1962-08-01", due: "1962-10-20" },
      { id: "indo-pakistani-1965", kind: "war", by: "pakistan", target: "india", stage: "tension", opens: "1965-04-01", due: "1965-08-05" },
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
    // The Sino-Soviet split in the open since the letters of 1963: the treaty of 1950 a dead letter, the border disputed.
    trust: { ussr: [["china", -50]], china: [["ussr", -50]] },
    live: [
      { id: "tonkin", kind: "join", by: "usa", war: "vietnam-war", side: "defenders", target: "north-vietnam", stage: "preparation", due: "1964-08-07" },
      { id: "indo-pakistani-1965", kind: "war", by: "pakistan", target: "india", stage: "tension", due: "1965-08-05" },
    ],
    dated: [
      { id: "six-day-egypt", kind: "war", by: "israel", target: "egypt", stage: "preparation", opens: "1967-05-15", due: "1967-06-05" },
      { id: "six-day-syria", kind: "war", by: "israel", target: "syria", stage: "preparation", opens: "1967-05-15", due: "1967-06-09" },
      { id: "zhenbao", kind: "war", by: "china", target: "ussr", stage: "tension", opens: "1969-01-01", due: "1969-03-02" },
      { id: "indo-pakistani-1971", kind: "war", by: "india", target: "pakistan", stage: "preparation", opens: "1971-09-01", due: "1971-12-03" },
      { id: "yom-kippur", kind: "war", by: "egypt", target: "israel", partners: ["syria"], stage: "preparation", opens: "1973-06-01", due: "1973-10-06" },
      { id: "cyprus", kind: "war", by: "turkey", target: "cyprus", stage: "preparation", opens: "1974-07-15", due: "1974-07-20" },
    ],
  },
  // October 1973: the Arabs fighting for the land lost in 1967, détente straining over them, Hanoi waiting to finish the war, Portugal's empire near its end.
  "1973": {
    aims: {
      egypt: [["reclaim", "israel", 85]],
      syria: [["reclaim", "israel", 85]],
      israel: [["security", "egypt", 60], ["security", "syria", 55]],
      usa: [["protect", "israel", 40], ["protect", "south-vietnam", 40], ["protect", "south-korea", 50], ["protect", "west-germany", 50], ["protect", "taiwan", 40]],
      ussr: [["protect", "egypt", 45], ["protect", "syria", 50], ["protect", "north-vietnam", 40], ["protect", "east-germany", 60]],
      "north-vietnam": [["expand", "south-vietnam", 90]],
      "khmer-rouge": [["expand", "cambodia", 85]],
      "pathet-lao": [["expand", "laos", 70]],
      china: [["reclaim", "taiwan", 60]],
      taiwan: [["reclaim", "china", 30]],
      "north-korea": [["expand", "south-korea", 50]],
      iraq: [["reclaim", "kuwait", 30], ["reclaim", "iran", 30]],
      iran: [["security", "iraq", 45], ["protect", "oman", 35]],
      turkey: [["expand", "cyprus", 40], ["security", "greece", 30]],
      morocco: [["reclaim", "spain", 50]],
      somalia: [["reclaim", "ethiopia", 55]],
      pakistan: [["reclaim", "india", 50]],
      india: [["reclaim", "pakistan", 30]],
      "south-africa": [["protect", "rhodesia", 45], ["protect", "portugal", 30]],
      libya: [["expand", "chad", 30]],
      argentina: [["reclaim", "uk", 30]],
      uk: [["protect", "oman", 30]],
    },
    hawk: { israel: 60, egypt: 70, syria: 70, iraq: 60, "north-vietnam": 80, "khmer-rouge": 80, usa: 40, ussr: 50, china: 45, libya: 65, turkey: 55, greece: 55, somalia: 60 },
    // Détente between the superpowers, the Sino-Soviet feud, the Arab–Israeli hatred, the subcontinent's and the Horn's quarrels.
    trust: {
      usa: [["ussr", -20], ["china", -10], ["egypt", -20], ["north-vietnam", -60]],
      ussr: [["usa", -20], ["china", -60], ["israel", -60]],
      china: [["ussr", -60], ["usa", -5]],
      egypt: [["israel", -80], ["usa", -25]],
      syria: [["israel", -85], ["iraq", -20], ["jordan", -25]],
      israel: [["egypt", -70], ["syria", -80], ["jordan", -20], ["ussr", -50]],
      jordan: [["israel", -40], ["syria", -30]],
      iraq: [["iran", -50], ["syria", -20], ["israel", -70]],
      iran: [["iraq", -50]],
      "saudi-arabia": [["israel", -70]],
      libya: [["israel", -80], ["egypt", -10]],
      turkey: [["greece", -30]],
      greece: [["turkey", -30]],
      india: [["pakistan", -45], ["china", -30]],
      pakistan: [["india", -55]],
      bangladesh: [["pakistan", -40]],
      "north-korea": [["south-korea", -60]],
      "south-korea": [["north-korea", -50]],
      "north-vietnam": [["south-vietnam", -80], ["usa", -50]],
      "south-vietnam": [["north-vietnam", -80]],
      somalia: [["ethiopia", -40]],
      ethiopia: [["somalia", -40]],
      morocco: [["algeria", -25]],
      algeria: [["morocco", -25]],
    },
    live: [
      // Iraq sends its armour to Syria from 10 October. (Jordan sent one brigade to Syria and kept its own front with Israel quiet: no plan of war.)
      { id: "iraq-joins", kind: "join", by: "iraq", war: "yom-kippur-war", side: "attackers", target: "israel", stage: "decision", due: "1973-10-10" },
      // The ceasefires: Egypt's from 22–25 October with the Third Army encircled, Syria's disengagement in May 1974.
      { id: "egypt-ceasefire", kind: "peace", by: "egypt", target: "israel", war: "yom-kippur-war", stage: "decision", due: "1973-10-25" },
      { id: "israel-ceasefire", kind: "peace", by: "israel", target: "egypt", war: "yom-kippur-war", stage: "decision", due: "1973-10-24" },
      { id: "syria-ceasefire", kind: "peace", by: "syria", target: "israel", war: "yom-kippur-war", stage: "decision", due: "1974-05-31" },
    ],
    dated: [
      { id: "cyprus", kind: "war", by: "turkey", target: "cyprus", stage: "preparation", opens: "1974-07-15", due: "1974-07-20" },
      { id: "ogaden", kind: "war", by: "somalia", target: "ethiopia", stage: "tension", opens: "1977-03-01", due: "1977-07-13" },
      { id: "uganda-tanzania", kind: "war", by: "uganda", target: "tanzania", stage: "tension", opens: "1978-09-01", due: "1978-10-30" },
      { id: "sino-vietnamese", kind: "war", by: "china", target: "north-vietnam", stage: "tension", opens: "1978-11-01", due: "1979-02-17" },
      { id: "soviet-afghanistan", kind: "war", by: "ussr", target: "afghanistan", stage: "tension", opens: "1979-09-01", due: "1979-12-25" },
      { id: "iran-iraq", kind: "war", by: "iraq", target: "iran", stage: "tension", opens: "1980-04-01", due: "1980-09-22" },
      { id: "falklands", kind: "war", by: "argentina", target: "uk", stage: "tension", opens: "1982-01-01", due: "1982-04-02" },
      { id: "lebanon-1982", kind: "war", by: "israel", target: "lebanon", stage: "preparation", opens: "1982-04-01", due: "1982-06-06" },
    ],
  },
  // December 1979: Moscow committed in Afghanistan, Saddam eyeing a weakened Iran, Vietnam in Cambodia and China against it, Rhodesia's war ending.
  "1979": {
    aims: {
      ussr: [["protect", "afghanistan", 80], ["protect", "vietnam", 50], ["protect", "east-germany", 60], ["protect", "ethiopia", 40], ["protect", "angola", 35]],
      usa: [["protect", "saudi-arabia", 60], ["protect", "israel", 55], ["protect", "pakistan", 45], ["protect", "south-korea", 55], ["protect", "west-germany", 55], ["security", "iran", 40]],
      iraq: [["expand", "iran", 65], ["reclaim", "kuwait", 30]],
      iran: [["security", "iraq", 50], ["expand", "iraq", 25]],
      vietnam: [["protect", "cambodia", 80], ["protect", "laos", 60]],
      china: [["security", "vietnam", 50], ["reclaim", "taiwan", 55]],
      "khmer-rouge": [["reclaim", "cambodia", 80]],
      mujahideen: [["expand", "afghanistan", 80]],
      pakistan: [["reclaim", "india", 45], ["security", "afghanistan", 40]],
      india: [["reclaim", "pakistan", 30]],
      polisario: [["expand", "morocco", 70]],
      unita: [["expand", "angola", 60]],
      israel: [["security", "syria", 50], ["security", "lebanon", 35]],
      syria: [["reclaim", "israel", 60]],
      libya: [["expand", "chad", 45]],
      somalia: [["reclaim", "ethiopia", 45]],
      argentina: [["reclaim", "uk", 45], ["reclaim", "chile", 30]],
      "south-africa": [["protect", "rhodesia", 40], ["security", "angola", 50]],
      "north-korea": [["expand", "south-korea", 45]],
    },
    hawk: { ussr: 60, iraq: 75, iran: 65, vietnam: 70, china: 55, libya: 70, israel: 60, "south-africa": 55, argentina: 55, "north-korea": 65 },
    // Détente's end: the hostages in Tehran, China and Vietnam at daggers drawn, Iraq and Iran, Morocco and Algeria, the Beagle Channel.
    trust: {
      usa: [["iran", -70], ["ussr", -35], ["vietnam", -40]],
      iran: [["usa", -80], ["iraq", -50], ["israel", -80]],
      iraq: [["iran", -55], ["syria", -40]],
      ussr: [["usa", -35], ["china", -60], ["pakistan", -30]],
      china: [["vietnam", -70], ["ussr", -60]],
      vietnam: [["china", -70], ["khmer-rouge", -90]],
      israel: [["syria", -70], ["iraq", -60]],
      syria: [["israel", -80], ["iraq", -40], ["egypt", -40]],
      egypt: [["libya", -50], ["syria", -30]],
      libya: [["egypt", -50]],
      "saudi-arabia": [["iran", -30], ["egypt", -20]],
      india: [["pakistan", -40], ["china", -25]],
      pakistan: [["india", -50], ["afghanistan", -40]],
      afghanistan: [["pakistan", -40]],
      morocco: [["algeria", -50]],
      algeria: [["morocco", -50]],
      ethiopia: [["somalia", -60]],
      somalia: [["ethiopia", -60]],
      "north-korea": [["south-korea", -60]],
      "south-korea": [["north-korea", -55]],
      argentina: [["chile", -40], ["uk", -20]],
      chile: [["argentina", -40]],
    },
    live: [
      // Lancaster House, signed on 21 December: the ceasefire from the 28th.
      { id: "lancaster-ceasefire", kind: "peace", by: "zanu", target: "rhodesia", war: "rhodesian-bush-war", stage: "decision", due: "1979-12-28" },
    ],
    dated: [
      { id: "iran-iraq", kind: "war", by: "iraq", target: "iran", stage: "tension", opens: "1980-04-01", due: "1980-09-22" },
      { id: "chad-libya", kind: "war", by: "libya", target: "chad", stage: "tension", opens: "1980-10-01", due: "1980-12-15" },
      { id: "falklands", kind: "war", by: "argentina", target: "uk", stage: "tension", opens: "1982-01-01", due: "1982-04-02" },
      { id: "lebanon-1982", kind: "war", by: "israel", target: "lebanon", stage: "preparation", opens: "1982-04-01", due: "1982-06-06" },
      { id: "grenada", kind: "war", by: "usa", target: "grenada", stage: "preparation", opens: "1983-10-19", due: "1983-10-25" },
      { id: "geneva-withdrawal", kind: "peace", by: "ussr", target: "mujahideen", war: "afghan-war", stage: "decision", opens: "1988-01-01", due: "1988-05-15" },
      { id: "panama", kind: "war", by: "usa", target: "panama", stage: "tension", opens: "1989-10-01", due: "1989-12-20" },
      { id: "kuwait", kind: "war", by: "iraq", target: "kuwait", stage: "tension", opens: "1990-05-01", due: "1990-08-02" },
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
      { id: "kargil", kind: "war", by: "pakistan", target: "india", stage: "preparation", due: "1999-05-03" },
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
      venezuela: [["expand", "guyana", 35]],
    },
    hawk: { russia: 75, ukraine: 70, "north-korea": 70, iran: 65, israel: 60 },
    // The quarrels of the day, beside the war: they feed incidents (engine/incidents.ts) from the first turn.
    trust: {
      finland: [["russia", -30]],
      sweden: [["russia", -20]],
      poland: [["russia", -50]],
      lithuania: [["russia", -60]],
      ukraine: [["russia", -100]],
      usa: [["russia", -40], ["china", -15], ["iran", -50]],
      uk: [["russia", -40]],
      russia: [["usa", -40], ["uk", -35], ["poland", -30]],
      china: [["usa", -20], ["japan", -20], ["india", -15], ["philippines", -20], ["taiwan", -30]],
      japan: [["china", -20], ["north-korea", -40]],
      india: [["pakistan", -45], ["china", -25]],
      pakistan: [["india", -55], ["afghanistan", -25]],
      afghanistan: [["pakistan", -30]],
      iran: [["israel", -80], ["usa", -50], ["saudi-arabia", -25]],
      israel: [["iran", -80]],
      "saudi-arabia": [["iran", -30]],
      greece: [["turkey", -20]],
      turkey: [["greece", -20]],
      serbia: [["kosovo", -50]],
      kosovo: [["serbia", -50]],
      armenia: [["azerbaijan", -60]],
      azerbaijan: [["armenia", -60]],
      morocco: [["algeria", -35]],
      algeria: [["morocco", -35]],
      ethiopia: [["eritrea", -30]],
      eritrea: [["ethiopia", -30]],
      rwanda: [["dr-congo", -40]],
      "dr-congo": [["rwanda", -50]],
      philippines: [["china", -30]],
      "north-korea": [["south-korea", -60], ["usa", -60]],
      "south-korea": [["north-korea", -50]],
      thailand: [["cambodia", -15]],
      cambodia: [["thailand", -15]],
      guyana: [["venezuela", -30]],
    },
    live: [
      { id: "finland-nato", kind: "bloc", by: "finland", target: "russia", bloc: "nato", stage: "tension", due: "2023-04-04" },
      { id: "sweden-nato", kind: "bloc", by: "sweden", target: "russia", bloc: "nato", stage: "tension", due: "2024-03-07" },
    ],
    dated: [
      { id: "karabakh-2022", kind: "war", by: "azerbaijan", target: "armenia", stage: "tension", opens: "2022-08-01", due: "2022-09-13" },
      { id: "twelve-day-war", kind: "war", by: "israel", target: "iran", stage: "tension", opens: "2025-04-01", due: "2025-06-13" },
      { id: "sindoor", kind: "war", by: "india", target: "pakistan", stage: "preparation", opens: "2025-04-22", due: "2025-05-07" },
    ],
  },
};

/**
 * The plans of each date's earlier start, a week before it, where they differ
 * from the date's own (the rest is shared). The war the date opens with is a
 * plan at its last stage, the decision at the brink, prepared since the day
 * history prepared it, and those who joined it wait for it to begin; a war
 * under way that a country entered on the date is one it has prepared to
 * enter. 1914 has no war yet: before Sarajevo its crisis is still at
 * escalation, a step behind the date's.
 */
export const EVES: Partial<Record<ScenarioId, Partial<IntentionSeeds>>> = {
  // Before Sarajevo Vienna already weighs a reckoning with Belgrade: Conrad has urged war for years, and the Foreign Ministry drafts a memorandum to isolate Serbia.
  "1914": {
    live: [{ id: "july-crisis", kind: "war", by: "austria-hungary", target: "serbia", partners: ["germany"], stage: "tension", due: "1914-07-28" }],
  },
  // Fall Weiss, ordered ready for 1 September by the directive of 3 April 1939, set for the 26th and put off on the evening of the 25th.
  "1939": {
    live: [
      { id: "fall-weiss", kind: "war", by: "germany", target: "poland", partners: ["slovakia"], begins: "invasion-of-poland", stage: "decision", moved: "1939-04-03", due: "1939-09-01" },
      { id: "winter-war", kind: "war", by: "ussr", target: "finland", stage: "tension", due: "1939-11-30" },
      { id: "khalkhin-gol-truce", kind: "peace", by: "japan", target: "ussr", war: "khalkhin-gol", stage: "decision", due: "1939-09-15" },
    ],
    follow: [
      { id: "uk-poland", kind: "join", by: "uk", war: "invasion-of-poland", side: "defenders", target: "germany", stage: "decision", due: "1939-09-03" },
      { id: "france-poland", kind: "join", by: "france", war: "invasion-of-poland", side: "defenders", target: "germany", stage: "decision", due: "1939-09-03" },
      // The secret protocol of 23 August: the Red Army moves once the Wehrmacht has.
      { id: "soviet-invasion", kind: "war", by: "ussr", target: "poland", after: "invasion-of-poland", stage: "preparation", moved: "1939-08-23", due: "1939-09-17" },
    ],
  },
  // Kim Il-sung's attack, approved by Stalin in April and by Mao in mid-May, its divisions moving up to the parallel.
  "1950": {
    live: [{ id: "korea", kind: "war", by: "north-korea", target: "south-korea", begins: "korean-war", stage: "decision", moved: "1950-05-15", due: "1950-06-25" }],
    follow: [
      { id: "usa-korea", kind: "join", by: "usa", war: "korean-war", side: "defenders", target: "north-korea", stage: "decision", due: "1950-06-27" },
      { id: "uk-korea", kind: "join", by: "uk", war: "korean-war", side: "defenders", target: "north-korea", stage: "decision", due: "1950-07-01" },
      { id: "turkey-korea", kind: "join", by: "turkey", war: "korean-war", side: "defenders", target: "north-korea", stage: "tension", due: "1950-07-25" },
      { id: "china-korea", kind: "join", by: "china", war: "korean-war", side: "attackers", target: "south-korea", stage: "tension", due: "1950-10-19" },
    ],
  },
  // Before the Maddox: since the Honolulu conference of 1–2 June the strikes on the North are planned and the resolution drafted, waiting for an occasion.
  "1964": {
    live: [
      { id: "tonkin", kind: "join", by: "usa", war: "vietnam-war", side: "defenders", target: "north-vietnam", stage: "preparation", moved: "1964-06-02", due: "1964-08-07" },
      { id: "indo-pakistani-1965", kind: "war", by: "pakistan", target: "india", stage: "tension", due: "1965-08-05" },
    ],
  },
  // Operation Badr, its date fixed by Sadat and Assad at the end of August, the armies moving up under cover of exercises; Iraq joins only once it has begun.
  "1973": {
    live: [{ id: "badr", kind: "war", by: "egypt", target: "israel", partners: ["syria"], begins: "yom-kippur-war", stage: "decision", moved: "1973-08-28", due: "1973-10-06" }],
    follow: [
      { id: "iraq-joins", kind: "join", by: "iraq", war: "yom-kippur-war", side: "attackers", target: "israel", stage: "decision", due: "1973-10-10" },
      { id: "egypt-ceasefire", kind: "peace", by: "egypt", target: "israel", war: "yom-kippur-war", stage: "decision", due: "1973-10-25" },
      { id: "israel-ceasefire", kind: "peace", by: "israel", target: "egypt", war: "yom-kippur-war", stage: "decision", due: "1973-10-24" },
      { id: "syria-ceasefire", kind: "peace", by: "syria", target: "israel", war: "yom-kippur-war", stage: "decision", due: "1974-05-31" },
    ],
  },
  // The Politburo's decision of 12 December: the 40th Army goes in on the 25th, on the government's side against the mujahideen.
  "1979": {
    live: [
      { id: "storm", kind: "join", by: "ussr", war: "afghan-war", side: "defenders", target: "mujahideen", stage: "decision", moved: "1979-12-12", due: "1979-12-25" },
      { id: "lancaster-ceasefire", kind: "peace", by: "zanu", target: "rhodesia", war: "rhodesian-bush-war", stage: "decision", due: "1979-12-28" },
    ],
  },
  // Allied Force, ready since NATO's activation order of 13 October 1998, waits for the talks in Paris to fail.
  "1999": {
    live: [
      {
        id: "allied-force",
        kind: "war",
        by: "usa",
        target: "yugoslavia",
        partners: ["uk", "france", "germany", "italy", "netherlands", "canada", "belgium", "spain", "denmark", "norway", "portugal", "turkey"],
        begins: "allied-force",
        stage: "decision",
        moved: "1998-10-13",
        due: "1999-03-24",
      },
      { id: "kargil", kind: "war", by: "pakistan", target: "india", stage: "preparation", due: "1999-05-03" },
    ],
    follow: [{ id: "kosovo-terms", kind: "peace", by: "yugoslavia", target: "usa", war: "allied-force", stage: "decision", due: "1999-06-09" }],
  },
  // The invasion, its armies massed since the autumn of 2021; Finland and Sweden look to NATO only once it has begun.
  "2022": {
    live: [{ id: "invasion", kind: "war", by: "russia", target: "ukraine", begins: "russo-ukrainian-war", stage: "decision", moved: "2021-11-01", due: "2022-02-24" }],
    follow: [
      { id: "finland-nato", kind: "bloc", by: "finland", target: "russia", bloc: "nato", after: "russo-ukrainian-war", stage: "tension", due: "2023-04-04" },
      { id: "sweden-nato", kind: "bloc", by: "sweden", target: "russia", bloc: "nato", after: "russo-ukrainian-war", stage: "tension", due: "2024-03-07" },
    ],
  },
};

/** A neutral state of a date: from and until when, where its neutrality began or ended within the game's years. */
export interface NeutralSeed {
  tag: string;
  from?: string;
  until?: string;
}

/**
 * The neutral states of each date (engine/neutrality.ts): they join no bloc
 * and are called into no war by treaty or opportunity, plan a war only on an
 * attacker on their soil, and still sanction and vote at the world body.
 * Neutrality ends when a neutral is attacked or joins a military alliance –
 * by history's plan (Finland and Sweden after 2022's invasion) or under a
 * grave alarm of its own.
 */
export const NEUTRAL: Record<ScenarioId, NeutralSeed[]> = {
  // The Great War's neutrals; Belgium's neutrality, guaranteed in 1839, holds until it is invaded.
  "1914": ["switzerland", "netherlands", "belgium", "luxembourg", "denmark", "norway", "sweden", "spain"].map((tag) => ({ tag })),
  // Brussels returns to neutrality in October 1936; the Irish Free State keeps out of every quarrel of Britain's.
  "1933": [...["switzerland", "netherlands", "luxembourg", "denmark", "norway", "sweden", "ireland"].map((tag) => ({ tag })), { tag: "belgium", from: "1936-10-14" }],
  // Turkey, bound to Britain and France by the treaty of October 1939, stays out until February 1945.
  "1939": [...["switzerland", "netherlands", "belgium", "luxembourg", "denmark", "norway", "sweden", "ireland", "spain"].map((tag) => ({ tag })), { tag: "turkey", until: "1945-02-23" }],
  // Austria's neutrality comes with the State Treaty (26 October 1955); Finland keeps out of the Cold War under its 1948 treaty with Moscow.
  "1950": [...["switzerland", "sweden", "ireland", "finland"].map((tag) => ({ tag })), { tag: "austria", from: "1955-10-26" }],
  "1957": ["switzerland", "sweden", "ireland", "finland", "austria"].map((tag) => ({ tag })),
  "1964": ["switzerland", "sweden", "ireland", "finland", "austria"].map((tag) => ({ tag })),
  "1973": ["switzerland", "sweden", "ireland", "finland", "austria"].map((tag) => ({ tag })),
  // Costa Rica proclaims its permanent neutrality in November 1983.
  "1979": [...["switzerland", "sweden", "ireland", "finland", "austria"].map((tag) => ({ tag })), { tag: "costa-rica", from: "1983-11-17" }],
  // Moldova's constitution of July 1994; Turkmenistan's neutrality recognised by the General Assembly in December 1995.
  "1991": [...["switzerland", "sweden", "ireland", "finland", "austria", "costa-rica"].map((tag) => ({ tag })), { tag: "moldova", from: "1994-07-29" }, { tag: "turkmenistan", from: "1995-12-12" }],
  // Serbia's military neutrality, declared by its parliament in December 2007.
  "1999": [...["switzerland", "sweden", "ireland", "finland", "austria", "costa-rica", "moldova", "turkmenistan"].map((tag) => ({ tag })), { tag: "serbia", from: "2007-12-26" }],
  "2014": ["switzerland", "sweden", "ireland", "finland", "austria", "costa-rica", "moldova", "turkmenistan", "serbia"].map((tag) => ({ tag })),
  // Finland and Sweden until they join NATO: history's accession plans after the invasion end their neutrality.
  "2022": ["switzerland", "sweden", "ireland", "finland", "austria", "costa-rica", "moldova", "turkmenistan", "serbia"].map((tag) => ({ tag })),
};

const variantSeeds = new Map<string, IntentionSeeds>();

/** What a date's governments intend on the start a game was begun on: an eve's own plans over the date's. */
export function intentionsOf(id: ScenarioId, variant?: StartVariant | null): IntentionSeeds {
  const eve = variant === "eve" ? EVES[id] : undefined;
  if (!eve) return INTENTIONS[id];
  const key = `${id}:${variant}`;
  let seeds = variantSeeds.get(key);
  if (!seeds) variantSeeds.set(key, (seeds = { ...INTENTIONS[id], ...eve }));
  return seeds;
}

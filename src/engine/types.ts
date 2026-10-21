import type { AdviceMessage, AdvisorId } from "./advisors";
import type { BlocKind } from "./foreign";
import type { ResourceEntry, ResourceType } from "./resources";
import type { Town } from "./towns";
import type { LawId, Laws } from "./laws";
import type { ActDraft } from "./acts";

/**
 * The game's data model. Everything the model (the LLM) may change lives in
 * GameState as plain JSON, so a save is the state itself and the engine can
 * check every change the model proposes against it.
 */

export const LOCALES = ["ru", "uk", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export type Localized = Record<Locale, string>;
/** Authored text comes in three languages; text the model writes, in one. */
export type Text = string | Localized;

export type ScenarioId = "1914" | "1939" | "1950" | "1964" | "1991" | "1999" | "2014" | "2022";
export type MapId = "world_1914" | "world_1938" | "world_1994" | "world_2010";
export type TimeStep = "week" | "month" | "quarter" | "half" | "year";

/** Abstract 0–100 indices: the model reads them as rough strength, not truth. */
export interface Stats {
  stability: number;
  economy: number;
  military: number;
}

export interface CountrySeed {
  name: Localized;
  /** Map colour, the same in both themes. */
  color: string;
  leader: string;
  government: Localized;
  stats: Stats;
  /**
   * Exists politically but holds no land at the start — a Soviet republic in
   * August 1991. Playable; gains regions when the model grants them.
   */
  dormant?: boolean;
}

export interface WarSeed {
  id: string;
  name: Localized;
  attackers: string[];
  defenders: string[];
  since: string;
}

export interface AllianceSeed {
  id: string;
  name: Localized;
  members: string[];
  since: string;
  /** A military alliance unless said otherwise. */
  kind?: BlocKind;
  /** A world body: every country in the game is a member except these (members is then ignored). */
  allExcept?: string[];
  /** What it binds its members to, in a sentence or two. */
  terms?: Localized;
  /** The date its term ends, if it has one. */
  until?: string;
}

export interface Scenario {
  id: ScenarioId;
  map: MapId;
  startDate: string;
  defaultStep: TimeStep;
  title: Localized;
  tagline: Localized;
  briefing: Localized;
  /** English background for the model: what is happening on the start date. */
  context: string;
  /** Raw owner slug of a historical polygon -> country tag. */
  aliases: Record<string, string>;
  /** Historical polygon id -> owner tag, where the map data is wrong for this date. */
  owners: Record<string, string>;
  /** Modern country code (Natural Earth adm0_a3) -> owner tag, for every province of it. */
  modernOwners?: Record<string, string>;
  /** Province id -> owner tag: the finest correction, applied last. */
  provinceOwners?: Record<string, string>;
  /** Province id -> holder tag, for land occupied on the start date. */
  provinceControllers?: Record<string, string>;
  /** Province id -> tag of the side holding part of it on the start date (a front runs through it). */
  provinceContested?: Record<string, string>;
  /** How much of each contested province the other side holds at the start, %. */
  provinceHeld?: Record<string, number>;
  /** The towns the contesting side holds in those provinces on the start date (English names of the map's towns). */
  provinceTaken?: Record<string, string[]>;
  countries: Record<string, CountrySeed>;
  wars: WarSeed[];
  alliances: AllianceSeed[];
  /** Countries offered first on the pick screen. */
  featured: string[];
  /** Protests under way on the start date. */
  protests?: ProtestSeed[];
  /** How loyal each country's army, police, security services and elites are on the start date. */
  loyalty?: Record<string, Loyalty>;
  /**
   * People on the start date, for a scenario that borrows another date's map:
   * thousands by modern country (Natural Earth adm0), today's borders. The
   * provinces of a country listed share its figure as the map shares the
   * map's; the rest are scaled by `others`.
   */
  people?: { byCountry: Record<string, number>; others: number };
}

/** A protest a scenario starts with; its words in each language. */
export interface ProtestSeed {
  title: Localized;
  stage: (typeof PROTEST_STAGES)[number];
  size: number;
  where: string[];
  demands: Localized;
  by?: Localized;
  country?: string;
  support?: number;
  organisation?: number;
  backer?: string;
  killed?: number;
}

/** $bn a year, dollars of the day. */
export interface Budget {
  revenue: number;
  army: number;
  industry: number;
  social: number;
  /** Administration, debt service and the rest. */
  other: number;
}

/** A country's economy and army (see engine/economy.ts). Money in $bn of the day. */
export interface Economy {
  /** $bn a year. */
  gdp: number;
  /** Real growth, % a year. */
  growth: number;
  /** % a year. */
  inflation: number;
  /** % of the workforce. */
  unemployment: number;
  budget: Budget;
  debt: number;
  /** Gold and foreign currency. */
  reserves: number;
  /** Soldiers, thousands. */
  troops: number;
  /** Share of imports cut off by blockade, sanctions or war, 0–1. */
  tradeCut: number;
  /** Strategic resources in store, months of need. */
  stocks: Partial<Record<ResourceType, number>>;
}

export interface CountryState {
  tag: string;
  name: Text;
  color: string;
  /** The player chose this colour: the palette refresh on load leaves it alone. */
  customColor?: boolean;
  leader?: string;
  government?: Text;
  /** The retired 0–100 ratings, still in older saves; nothing reads them. */
  stats?: Stats;
  dormant?: boolean;
  /** Missing in saves from before the economy; added when the game opens. */
  economy?: Economy;
  /** A government that holds no land and carries on abroad. */
  exile?: { since: string; host?: string };
  /** Its politics in brief, kept by the engine for every country but the player's (engine/abroad.ts). */
  domestic?: Domestic;
  /** The people its leader line names, with their portraits (engine/people.ts); rebuilt when the line changes. */
  rulers?: Rulers;
  /** Its weapons (engine/arsenal.ts); missing in saves from before them until the game opens. */
  arsenal?: Arsenal;
  /** Its foreign course, kept by the engine for the countries that matter (engine/relations.ts). */
  course?: Course;
}

export type Gender = "male" | "female";

/** A person of the game — a leader, or anyone holding a post (engine/people.ts). */
export interface Person {
  /** A known person's id (scripts/portraits/people.json), or one made from the name. */
  id: string;
  name: string;
  gender: Gender;
  /** Their portrait in public/portraits; without one, the shadow of their sex. */
  portrait?: string;
}

/** The people a leader line names, in its order, and the line they were read from. */
export interface Rulers {
  line: string;
  people: Person[];
  /** Which of them leads: the prime minister under a king, say. */
  lead: number;
}

/** How a game treats real history after the start date: its own course, or history as a strong tendency. */
export const GAME_MODES = ["free", "historical"] as const;
export type GameMode = (typeof GAME_MODES)[number];

export const AIM_KINDS = ["reclaim", "expand", "protect", "security", "recover"] as const;
/** Win back land; take a neighbour's; guard a protégé; stand up to a threat; put its own house in order. */
export type AimKind = (typeof AIM_KINDS)[number];

/** What a government wants abroad. */
export interface Aim {
  kind: AimKind;
  target?: string;
  /** How much it matters, 0–100. */
  weight: number;
  /** From the scenario's date, not read off the state. */
  seeded?: boolean;
}

/** How a government sees one other country. */
export interface Tie {
  /** From what the other did, -100 (betrayed) to 100; eases back toward where their treaties put it. */
  trust: number;
  /** Built by incidents, 0–100; halves in about a year. */
  tension: number;
  /** The danger it sees in the other, 0–100: power, closeness, hostility. Recomputed every turn. */
  threat: number;
  /** How close the other is, 0–100, from where their people live. Recomputed every turn with the map. */
  near: number;
  /** Share of its exports that go to the other, %: how much it depends on that market. Recomputed every turn with the map. */
  trade?: number;
}

export const DEED_KINDS = ["attacked", "joined-enemy", "came-to-aid", "stood-aside", "left-bloc", "sanctioned", "aided", "allied", "made-peace", "broke-pact", "occupied"] as const;
export type DeedKind = (typeof DEED_KINDS)[number];

/** Something another country did that a government remembers. */
export interface Deed {
  by: string;
  what: DeedKind;
  date: string;
  /** What it did to trust. */
  weight: number;
}

/** A government's foreign course: set when it takes office, moved by the engine every turn. */
export interface Course {
  /** Appetite for force, 0–100, set by the government that holds office. */
  hawk: number;
  /** How far it looks abroad, 0–100: crisis, war-weariness and a weak government turn it inward. */
  reach: number;
  aims: Aim[];
  /** The countries that matter to it. */
  ties: Record<string, Tie>;
  /** What others did, newest last. */
  memory: Deed[];
  /** When this course was set, and by what. */
  set: { date: string; how: "start" | "election" | "coup" | "leader" };
}

export const PLAN_KINDS = ["war", "join", "bloc", "leave", "peace"] as const;
/** Attack a country; enter a war under way; found or join a bloc; leave one; seek peace. */
export type PlanKind = (typeof PLAN_KINDS)[number];

export const PLAN_STAGES = ["incident", "tension", "decision", "preparation", "action"] as const;
export type PlanStage = (typeof PLAN_STAGES)[number];

export const PLAN_CAUSES = ["claim", "ambition", "treaty", "threat", "incident", "weariness", "new-government", "opportunity", "seeded"] as const;
export type PlanCause = (typeof PLAN_CAUSES)[number];

export const PLAN_ENDS = ["carried-out", "compromise", "refused", "outmatched", "unrest", "government", "target-gone", "overtaken"] as const;
export type PlanEnd = (typeof PLAN_ENDS)[number];

/** A plan of one government that takes several turns: it grows stage by stage, or fades or fails (engine/intentions.ts). */
export interface Plan {
  id: string;
  kind: PlanKind;
  by: string;
  /** War, join and peace: the enemy; bloc: the threat it answers. */
  target?: string;
  /** War: the allies it counts on; bloc: whom it brings in. */
  partners?: string[];
  /** Join and peace: the war; once a war plan is carried out, the war it began. */
  war?: string;
  /** Leave: the bloc; bloc: the one it joins, or the one it founded. */
  bloc?: string;
  /** Join: the side it takes. */
  side?: "attackers" | "defenders";
  /** Bloc: what it founds. */
  blocKind?: "alliance" | "pact";
  cause: PlanCause;
  stage: PlanStage;
  since: string;
  /** When it reached its stage. */
  moved: string;
  /** For a plan a scenario seeds: when history did it. It bends the dice, never forces them. */
  due?: string;
  /** How it ended; an ended plan stays a few turns for the panel. */
  end?: { date: string; turn: number; how: "done" | "failed" | "faded"; why: PlanEnd };
}

/** The kinds of weapons the engine counts: rifles in thousands, the rest in pieces. */
export const WEAPON_KINDS = ["rifles", "artillery", "tanks", "aircraft", "ships", "airDefence", "drones"] as const;
export type WeaponKind = (typeof WEAPON_KINDS)[number];

/** How many of a kind a country has, and their technology level: 1 for the Great War, 6 for today; a fraction while old and new serve side by side. */
export interface ArmsStock {
  n: number;
  level: number;
}

/** A country's weapons (engine/arsenal.ts). */
export interface Arsenal {
  stock: Partial<Record<WeaponKind, ArmsStock>>;
  /** Kinds the player's government builds first (at most two), with twice the money. */
  focus?: WeaponKind[];
  /** The player's: made and lost over the last turn, by kind. */
  made?: Partial<Record<WeaponKind, number>>;
  lost?: Partial<Record<WeaponKind, number>>;
  /** The player's: received from abroad over the last turn, bought or given. */
  got?: Partial<Record<WeaponKind, number>>;
  /** It has atomic weapons. */
  nuclear?: boolean;
}

/** One research project of the player's government (engine/research.ts). */
export interface ResearchProject {
  id: string;
  /** 0–1. */
  progress: number;
  since: string;
  /** Under way, or set aside with its progress kept. */
  on: boolean;
}

/** The player's research: what is under way and what is done. */
export interface Research {
  active: ResearchProject[];
  done: { id: string; date: string }[];
}

export const REGIME_KINDS = ["democracy", "limited", "party", "autocracy", "military"] as const;
/** Elections the government can lose; elections it seldom loses; a ruling party that holds the army too; no contested vote; army rule. */
export type RegimeKind = (typeof REGIME_KINDS)[number];

/** A country's politics as the engine moves them, without a model call. */
export interface Domestic {
  regime: RegimeKind;
  /** The government's support, 0–100. */
  support: number;
  /** How firmly the state holds together, 0–100. */
  stability: number;
  /** The next election that can change the government. */
  nextElection?: string;
  /** Years between such elections. */
  term?: number;
  /** The last such election, and whether the government kept power. */
  lastElection?: { date: string; kept: boolean };
  /** The last time the government changed, and how. */
  changed?: { date: string; how: "election" | "coup" | "leader" };
  /** The last attempt on the government by force, whether it succeeded or not. */
  lastCoup?: string;
}

export const PROTEST_STAGES = ["rally", "strike", "riot", "uprising"] as const;

/** People in the streets against the player's government: rallies grow into strikes, riots, an uprising. */
export interface Protest {
  id: string;
  title: string;
  stage: (typeof PROTEST_STAGES)[number];
  /** Thousands of people taking part. */
  size: number;
  /** Provinces where it is strongest. */
  where: string[];
  demands: string;
  /** Who leads it, if anyone. */
  by?: string;
  since: string;
  /** Whose government it stands against; the player's when missing. */
  country?: string;
  /** How many people sympathise, % of the country. */
  support?: number;
  /** Leadership, money, camps, self-defence: 0–100. */
  organisation?: number;
  /** A foreign government that backs it. */
  backer?: string;
  /** Protesters killed so far. */
  killed?: number;
  /** Change in size over the last turn, thousands. */
  grew?: number;
}

export const OFFICIAL_POSTS = ["head", "government", "chief", "military", "finance", "foreign", "interior", "intelligence", "science", "bank"] as const;
export type OfficialPost = (typeof OFFICIAL_POSTS)[number];

/** A person in the player's government (engine/government.ts). */
export interface Official {
  post: OfficialPost;
  /** What the post is called in that country and time, in the interface language. */
  title: string;
  name: string;
  /** Two to four traits: "cautious", "ambitious", "loyal to the president". */
  traits: string[];
  /** How the person talks. */
  manner: string;
  /** 1–5. */
  competence: number;
  /** 1–5, to the leader. */
  loyalty: number;
  faction?: string;
  bio?: string;
  since: string;
  /** What a cabinet minister wants (engine/interests.ts). */
  interests?: MinisterInterests;
  /** How the minister took the last turn, from their report (engine/reports.ts). */
  mood?: MinisterMood;
  /** Their sex and portrait (engine/people.ts); missing in saves from before portraits. */
  gender?: Gender;
  portrait?: string;
}

export interface MinisterInterests {
  /** Two causes of the portfolio, by id (AGENDAS). */
  agenda: string[];
  /** 1–5. */
  ambition: number;
  /** The party the person owes the post to. */
  party?: string;
}

export const MINISTER_STANCES = ["loyal", "uneasy", "opposed", "resigning"] as const;
export type MinisterStance = (typeof MINISTER_STANCES)[number];

export interface MinisterMood {
  stance: MinisterStance;
  /** What the minister resents or demands, in English, for the next turn's game master. */
  grievance?: string;
  /** The turn the report was about. */
  turn: number;
}

/** A deputy in one of the player's ministries (engine/deputies.ts): the same kind of person as a minister, serving under one. */
export interface Deputy extends Official {
  /** Stable within a game: "<post>-<n>". */
  id: string;
  /** The ministry's post whose chief the deputy serves; `post` is the same. */
  deputyOf: OfficialPost;
  /** 1–5, to their own minister (`loyalty` is to the leader). */
  chiefLoyalty: number;
  /** The turn the government last sounded them out: once a turn. */
  approached?: number;
}

export const INTRIGUE_GOALS = ["oust", "replace", "evidence", "sabotage"] as const;
export type IntrigueGoal = (typeof INTRIGUE_GOALS)[number];
export const INTRIGUE_PRICES = ["post", "money", "protection"] as const;
export type IntriguePrice = (typeof INTRIGUE_PRICES)[number];
export const INTRIGUE_STAGES = ["active", "done", "exposed", "dropped"] as const;
export const INTRIGUE_EVENTS = ["begun", "progress", "done", "exposed", "reported", "moot", "dropped"] as const;
export type IntrigueEvent = (typeof INTRIGUE_EVENTS)[number];

/** The government's own plot inside a ministry: a deputy working against their chief (engine/deputies.ts). */
export interface Intrigue {
  id: string;
  /** The deputy in on it, by id. */
  deputy: string;
  /** The deputy's name, kept for the record when they are gone. */
  deputyName: string;
  /** The ministry whose chief it is aimed at. */
  post: OfficialPost;
  /** The chief's name when it began: it ends when they leave the post. */
  target: string;
  goal: IntrigueGoal;
  /** For sabotage: the ministry's directive the deputy undermines. */
  directive?: string;
  /** 0–100: at 100 it comes off. */
  strength: number;
  /** % a month that it leaks. */
  risk: number;
  stage: (typeof INTRIGUE_STAGES)[number];
  /** What the deputy asked in return and the government promised. */
  price?: IntriguePrice;
  since: string;
  /** What happened to it last, and when. */
  last: { turn: number; event: IntrigueEvent };
}

/** Trade sanctions one government imposes on another (engine/trade.ts). */
export interface Sanction {
  by: string;
  against: string;
  scope: "partial" | "full";
  since: string;
}

/** A budget the player set between turns, for the next turn's game master. */
export interface BudgetDecision {
  date: string;
  before: Budget;
  after: Budget;
}

/** An appointment by the player, waiting for the next turn's game master. */
export interface Appointment {
  date: string;
  post: OfficialPost;
  title: string;
  from?: string;
  to: string;
  note?: string;
}

/** The player's government overthrown: the game is lost, unless the player carries on as the new one. */
export interface Defeat {
  date: string;
  turn: number;
  how: "coup" | "revolution" | "uprising" | "deposed";
  by: string;
  note: string;
  /** The player chose to play on as the new government. */
  continued?: boolean;
}

/**
 * A province in play: only who owns and who holds it. Its name, terrain and
 * neighbours are static map data (MapRegion), not saved with the game.
 */
export interface RegionState {
  /** Sovereign. */
  owner: string;
  /** Who holds it on the ground; differs from owner under occupation. */
  controller: string;
  /** Another side whose troops hold part of it: the front runs through the province. */
  contested?: string;
  /** How much of the province that side holds, % (missing in older saves: about a third). */
  held?: number;
  /** The towns of the province the contesting side holds (English names of the map's towns). */
  taken?: string[];
  /** People now, thousands, once the game has moved them from the map's start figure. */
  pop?: number;
}

/** What the map draws of a province: kept per turn so the past can be drawn again (engine/history.ts). */
export type RegionBorder = Pick<RegionState, "owner" | "controller" | "contested" | "held">;

export interface War {
  id: string;
  name: Text;
  attackers: string[];
  defenders: string[];
  since: string;
  /** A ceasefire in force until a date; the war resumes when it runs out. */
  truce?: { until: string; terms?: Text };
}

export interface Alliance {
  id: string;
  name: Text;
  members: string[];
  since: string;
  /** A military alliance (the default), a pact, or an organisation. */
  kind?: BlocKind;
  /** The date its term ends, if it has one. */
  until?: string;
  terms?: Text;
  /** The country that called it into being. */
  founder?: string;
}

/** A party's place on three axes, each from -10 to 10. */
export interface PartyStance {
  /** Left (-10) to right (10) on the economy. */
  economy: number;
  /** Authoritarian (-10) to liberal (10). */
  freedom: number;
  /** Open (-10) to nationalist (10). */
  nation: number;
}

export interface Party {
  id: string;
  name: string;
  leader?: string;
  ideology: string;
  /** Share of the electorate, %; all parties add up to 100. */
  support: number;
  status: "ruling" | "coalition" | "opposition" | "underground" | "banned";
  stance: PartyStance;
  /** Seats in parliament. */
  seats?: number;
  /** Its colour, as the press draws it. */
  color?: string;
  /** The abbreviation the press uses: "SN", "CDU". */
  short?: string;
  /** Where its ideas stood a turn ago: the drift the panel draws. */
  was?: PartyStance;
  /** Support change in the last turn, points. */
  trend?: number;
}

/** A threat to the government from inside: a coup, a conspiracy, a strike wave. */
export interface Plot {
  id: string;
  title: string;
  by: string;
  kind: "coup" | "conspiracy" | "protest" | "strike" | "insurgency" | "sabotage";
  /** 0–100. */
  strength: number;
  /** Whether the government knows of it; the panel shows only those it does. */
  known: boolean;
  since: string;
}

/** The player's domestic politics (engine/politics.ts). */
/** The national parliament, if the regime has one that sits. */
export interface Parliament {
  name: string;
  seats: number;
  /** % of the vote a party needs for seats. */
  threshold?: number;
}

/** How the public is expected to take an act: a change of unrest and who welcomes or resents it. */
export interface Reaction {
  unrest: number;
  note: string;
}

/** The player's proclamations, taking effect when the turn ends. */
export interface Proclamation {
  name?: Localized;
  color?: string;
  /** City (English map name) -> its new name. */
  places?: Record<string, Localized>;
  /** The expected reaction to each part: "name", "color" or "place:<city>". */
  reactions?: Record<string, Reaction>;
}

/** A law or decree the player's government put forward (engine/acts.ts). */
export interface Bill {
  id: string;
  title: string;
  text: string;
  /** What it changes among the laws in force. */
  laws?: Laws;
  vote: "majority" | "twothirds" | "decree";
  status: "proposed" | "passed" | "failed";
  turn: number;
  date: string;
  decided?: string;
  reaction?: Reaction;
  note?: string;
}

/** A message in the conversation with the chief of staff about acts of state. */
export interface LegalMessage {
  from: "player" | "advisor";
  text: string;
  date: string;
  turn: number;
  /** The acts drafted with an answer. */
  drafts?: ActDraft[];
}

/** The pillars a government stands on, and how loyal each is, 0–100. */
export const PILLARS = ["army", "police", "security", "elites"] as const;
export type Pillar = (typeof PILLARS)[number];
export type Loyalty = Record<Pillar, number>;

export interface Politics {
  regime: string;
  /** How loyal the army, the police, the security services and the elites are; missing in older saves. */
  loyalty?: Loyalty;
  /** The laws the state lives by (engine/laws.ts). */
  laws?: Laws;
  /** The same a turn ago. */
  loyaltyWas?: Loyalty;
  parliament?: Parliament;
  /** 0–100. */
  unrest: number;
  nextElection?: string;
  parties: Party[];
  plots: Plot[];
  lastElection?: { date: string; results: { party: string; share: number; seats?: number }[]; note?: string };
}

/** A special operation planned in a ministry. */
export interface Operation {
  name: string;
  target: string;
  goal: string;
  means: string;
  timing: string;
  secrecy: "open" | "covert" | "deniable";
}

/** A standing task given to a ministry, in force until it is done, fails or is withdrawn. */
export interface Directive {
  id: string;
  ministry: AdvisorId;
  text: string;
  since: string;
  operation?: Operation;
}

/** What became of one directive in a turn. */
export interface DirectiveStatus {
  id: string;
  status: "progress" | "done" | "failed";
  note: string;
  text?: string;
}

/** A ministry's report after a turn, written by its minister once the turn is played. */
export interface MinistryReport {
  ministry: AdvisorId;
  text: string;
  directives: DirectiveStatus[];
  /** How the minister takes the turn; missing in reports from before ministers had interests. */
  stance?: MinisterStance;
  /** Orders the minister suggests for the next turn. */
  orders?: string[];
}

/**
 * What a ministry has to report on after a turn, as the turn's game master
 * settled it: the matter, and what became of each directive. The minister
 * writes the report from it afterwards (engine/reports.ts).
 */
export interface MinistryBrief {
  ministry: AdvisorId;
  /** One English sentence, from the game master; empty when only the directives or a question call for a report. */
  matter: string;
  directives: DirectiveStatus[];
  /** The government asked this minister something during the turn. */
  asked?: boolean;
}

/** The player's invitation to found a bloc, waiting for the invited governments' answers. */
export interface Proposal {
  id: string;
  kind: BlocKind;
  name: string;
  invited: string[];
  terms?: string;
  date: string;
}

export interface SummitLine {
  country: string;
  speaker: string;
  text: string;
}

/** Talks planned for a date: by the player or by the world; held, or missed. */
export interface Summit {
  id: string;
  title: string;
  place: string;
  date: string;
  participants: string[];
  agenda?: string;
  by: "player" | "world";
  status: "planned" | "held" | "missed";
  outcome?: string;
  transcript?: SummitLine[];
  /** Held by the player in person: the transcript has the player's own words. */
  live?: boolean;
  /** What the participants agreed at a meeting the player held. */
  agreements?: string[];
  /** The turn in which the player held it, for that turn's game master. */
  heldTurn?: number;
}

export const EVENT_KINDS = ["war", "diplomacy", "politics", "economy", "military", "disaster", "other"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export interface GameEvent {
  title: string;
  body: string;
  kind: EventKind;
  countries: string[];
}

/** A change the engine actually made, kept for the chronicle. */
export type AppliedChange =
  | { kind: "annex"; region: string; from: string; to: string }
  | { kind: "occupy"; region: string; from: string; to: string }
  | { kind: "liberate"; region: string; from: string; to: string }
  | { kind: "contest"; region: string; by: string; holder: string; held?: number; was?: number }
  | { kind: "repel"; region: string; by: string; holder: string }
  | { kind: "new-country"; country: string }
  | { kind: "war"; war: string; name: Text; sides?: string[]; plan?: string }
  | { kind: "peace"; war: string; name: Text; sides?: string[] }
  | { kind: "alliance"; alliance: string; name: Text; members?: string[]; plan?: string }
  | { kind: "enter"; war: string; name: Text; country: string; side: "attackers" | "defenders"; plan?: string }
  | { kind: "accession"; alliance: string; name: Text; country: string; plan?: string }
  | { kind: "leave"; alliance: string; name: Text; country: string }
  | { kind: "leader"; country: string; leader: string }
  | { kind: "stats"; country: string; delta: Partial<Stats> }
  | { kind: "truce"; war: string; name: Text; until: string }
  | { kind: "truce-ended"; war: string; name: Text }
  | { kind: "alliance-ended"; alliance: string; name: Text; members?: string[] }
  | { kind: "invitation"; name: Text; country: string; answer: "accept" | "decline" }
  | { kind: "summit-planned"; summit: string; title: string; date: string }
  | { kind: "party"; party: string; change: Party["status"] | "new" | "dissolved" }
  | { kind: "election"; winner: string; share: number }
  | { kind: "vote"; country: string; kept: boolean; date?: string }
  | { kind: "coup"; country: string; succeeded: boolean }
  | { kind: "plot"; title: string; change: "discovered" | "foiled" | "succeeded" | "faded" }
  | { kind: "exile"; country: string; host?: string }
  | { kind: "return"; country: string }
  | { kind: "protest"; title: string; change: Protest["stage"] | "new" | "dispersed" | "conceded" | "faded" | "won" }
  | { kind: "overthrown"; how: Defeat["how"]; by: string }
  | { kind: "population"; country: string; deaths: number; refugees: number; to?: string; cause: string }
  | { kind: "sanction"; by: string; against: string; change: "partial" | "full" | "lifted" }
  | { kind: "deal"; partner: string; good: TradeGood; side: "sell" | "buy"; value: number; change: "signed" | "rejected" | "broken" | "ended"; note?: string }
  | { kind: "funds"; from: string; to: string; amount: number; type: "grant" | "loan" | "aid" | "arms" | "reparations" | "bribe"; note?: string }
  | { kind: "law"; law: LawId; from?: string; to: string }
  | { kind: "bill"; title: string; change: "passed" | "failed"; note?: string }
  | { kind: "identity"; what: "name" | "color" | "place"; from?: string; to: Text }
  | { kind: "budget"; country: string }
  | { kind: "plan"; plan: string; type: PlanKind; by: string; target?: string; stage: PlanStage }
  | { kind: "plan-end"; plan: string; type: PlanKind; by: string; target?: string; how: "failed" | "faded"; why: PlanEnd }
  | { kind: "research"; project: string; change: "started" | "stopped" | "done" | "setback" }
  | { kind: "captured"; by: string; from: string; arms: WeaponKind; n: number }
  | { kind: "official"; post: OfficialPost; title: string; name: string; change: "appointed" | "resigned" | "dismissed" | "died" | "arrested" | "fled" }
  | { kind: "intrigue"; post: OfficialPost; deputy: string; target: string; goal: IntrigueGoal; event: "done" | "exposed" };

export type Verdict = "success" | "partial" | "failed";

/** The game master's judgement of one order. */
export interface OrderVerdict {
  /** 1-based position in the turn's orders. */
  n: number;
  result: Verdict;
  note: string;
}

export interface ChronicleEntry {
  turn: number;
  from: string;
  to: string;
  orders: string[];
  verdicts?: OrderVerdict[];
  headline: string;
  narrative: string;
  events: GameEvent[];
  applied: AppliedChange[];
  /** Summits held in this period, shown before the report. */
  summits?: string[];
  /** What each ministry has to report on; the reports follow the turn. */
  briefs?: MinistryBrief[];
  /** Each ministry's report, as it arrives. */
  reports?: MinistryReport[];
  /** The player's economy before and after the turn, for the report. */
  economy?: { before: EconomyFigures; after: EconomyFigures };
  /** The provinces whose holder or front the turn changed, as they stood before it (engine/history.ts). */
  borders?: Record<string, RegionBorder>;
}

/** The figures a turn report compares. */
export interface EconomyFigures {
  gdp: number;
  debt: number;
  reserves: number;
  troops: number;
  balance: number;
  /** People, thousands. */
  people?: number;
}

export type Stance = "agree" | "refuse" | "counter" | "neutral";

export interface DiplomacyMessage {
  from: "player" | "them";
  text: string;
  date: string;
  turn: number;
  stance?: Stance;
  /** One English sentence on what was agreed, for the next turn's prompt. */
  summary?: string;
}

export interface GameState {
  /** 2 = provinces. Version-1 saves (one region per country) are migrated on load. */
  schema: 2;
  /** The last numbered save migration this save has been through (engine/migrations.ts); none when missing. */
  migration?: number;
  id: string;
  /** What the engine's dice are cast from (engine/dice.ts): the id the game began with, kept by its copies. */
  seed?: string;
  /** The name the player gave this game; without one it goes by country and year. */
  title?: string;
  /** Free or historical, chosen when the game was created; free when missing. */
  mode?: GameMode;
  createdAt: string;
  updatedAt: string;
  scenarioId: ScenarioId;
  player: string;
  date: string;
  turn: number;
  step: TimeStep;
  countries: Record<string, CountryState>;
  regions: Record<string, RegionState>;
  wars: War[];
  alliances: Alliance[];
  chronicle: ChronicleEntry[];
  diplomacy: Record<string, DiplomacyMessage[]>;
  /** Conversations with the cabinet's ministers. */
  advice?: Partial<Record<AdvisorId, AdviceMessage[]>>;
  /** Orders written for the coming turn. */
  draft: string[];
  /** Orders in force every turn until the player removes them. */
  standing?: string[];
  /** The player's invitations to found a bloc, waiting for answers. */
  proposals?: Proposal[];
  /** The player's domestic politics, once the game master has described them. */
  politics?: Politics;
  /** Protests, strikes and riots against the player's government. */
  protests?: Protest[];
  /** Set when the player's government has been overthrown. */
  defeat?: Defeat;
  /** The people of the player's government, once the game master has named them. */
  officials?: Official[];
  /** The ministries' deputies, named when the player first asks after a ministry's people (engine/deputies.ts). */
  deputies?: Deputy[];
  /** The government's private conversations with deputies, by deputy id. */
  deputyAdvice?: Record<string, AdviceMessage[]>;
  /** The government's own plots inside its ministries, deputies against their chiefs. */
  intrigues?: Intrigue[];
  /** The player's appointments since the last turn. */
  personnel?: Appointment[];
  /** Sanctions in force between governments. */
  sanctions?: Sanction[];
  /** The player's trade deals: in force, proposed, or turned down this turn. */
  deals?: TradeDeal[];
  /** What the player's government proclaims this turn: a new name, a map colour, renamed cities. */
  proclamation?: Proclamation;
  /** Cities renamed in play, by their English name on the map. */
  placeNames?: Record<string, Localized>;
  /** Laws and decrees the government put forward, decided or not. */
  bills?: Bill[];
  /** The conversation with the chief of staff about acts of state. */
  legal?: LegalMessage[];
  /** The budget the player set since the last turn. */
  budgetSet?: BudgetDecision;
  /** Standing tasks of the ministries. */
  directives?: Directive[];
  summits?: Summit[];
  /** The plans of other governments, live and lately ended (engine/intentions.ts). */
  plans?: Plan[];
  /** Fog of war: other countries are shown as the player's government knows them (engine/fog.ts). On for a new game, off for one begun before it. */
  fog?: boolean;
  /** The player's research projects (engine/research.ts). */
  research?: Research;
}

/** What a save list shows without loading the whole state. */
export interface SaveMeta {
  id: string;
  title?: string;
  scenarioId: ScenarioId;
  player: string;
  playerName: Text;
  date: string;
  turn: number;
  updatedAt: string;
}

export const TERRAINS = ["plains", "forest", "hills", "mountains", "desert", "tundra", "jungle", "wetlands"] as const;
export type Terrain = (typeof TERRAINS)[number];

export type TradeGood = "grain" | "oil" | "gas" | "coal" | "metals" | "uranium" | "arms";

/** A contract of the player's government to sell or buy a good (engine/deals.ts). */
export interface TradeDeal {
  id: string;
  partner: string;
  good: TradeGood;
  /** The player sells to the partner, or buys from it. */
  side: "sell" | "buy";
  /** $bn a year. */
  value: number;
  /** Price against the market, %. */
  premium: number;
  years: number;
  since: string;
  until: string;
  status: "active" | "proposed" | "declined" | "ended" | "broken";
  /** Signed from the market's offers, or proposed by the player. */
  origin: "offer" | "player";
  /** The turn it was signed, proposed or turned down. */
  turn: number;
  note?: string;
}

/** One province as the map file describes it. */
export interface MapRegion {
  id: string;
  /** English (or local, in Latin script) name. */
  name: string;
  ru?: string;
  uk?: string;
  /** The historical polygon of this era the province lies in. */
  hist: string;
  /** Raw owner slug of that polygon, before the scenario's corrections. */
  owner: string;
  /** Modern country code (Natural Earth adm0_a3). */
  adm0: string;
  terrain: Terrain;
  /** 0–100. */
  fertility: number;
  /** km². */
  area: number;
  /** The centre, [longitude, latitude] to a tenth of a degree. */
  at?: [number, number];
  coastal: boolean;
  /** The largest city, in English. */
  city?: string;
  /** Strategic resources with their output over the years (see engine/resources.ts). */
  res?: ResourceEntry[];
  /** Major rivers through the province, most important first, in English. */
  rv?: string[];
  /** People on the scenario's start date, in thousands. */
  pop?: number;
  /** Natural growth of its people in the era, % a year (the country's historical pace). */
  gr?: number;
  /** Kilometres of main railway on the start date (Natural Earth's network: an index, not a census). */
  rail?: number;
  /** GDP per person of the modern country in 2019, US dollars: the base of the starting economy. */
  inc?: number;
}

/** Map data the prompt and the engine look provinces up in. */
export interface MapIndex {
  regions: Record<string, MapRegion>;
  neighbors: Record<string, string[]>;
  /** The towns of a province, biggest first (engine/towns.ts); where the server has loaded them. */
  towns?: (province: string) => Town[];
}

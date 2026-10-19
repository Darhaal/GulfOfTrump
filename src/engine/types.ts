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

export type ScenarioId = "1914" | "1939" | "1991" | "2014" | "2022";
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

export const OFFICIAL_POSTS = ["head", "government", "chief", "military", "finance", "foreign", "interior", "intelligence", "bank"] as const;
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

/** A ministry's report after a turn. */
export interface MinistryReport {
  ministry: AdvisorId;
  text: string;
  directives: { id: string; status: "progress" | "done" | "failed"; note: string; text?: string }[];
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
  | { kind: "war"; war: string; name: Text }
  | { kind: "peace"; war: string; name: Text }
  | { kind: "alliance"; alliance: string; name: Text }
  | { kind: "leave"; alliance: string; name: Text; country: string }
  | { kind: "leader"; country: string; leader: string }
  | { kind: "stats"; country: string; delta: Partial<Stats> }
  | { kind: "truce"; war: string; name: Text; until: string }
  | { kind: "truce-ended"; war: string; name: Text }
  | { kind: "alliance-ended"; alliance: string; name: Text }
  | { kind: "invitation"; name: Text; country: string; answer: "accept" | "decline" }
  | { kind: "summit-planned"; summit: string; title: string; date: string }
  | { kind: "party"; party: string; change: Party["status"] | "new" | "dissolved" }
  | { kind: "election"; winner: string; share: number }
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
  | { kind: "official"; post: OfficialPost; title: string; name: string; change: "appointed" | "resigned" | "dismissed" | "died" | "arrested" | "fled" };

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
  /** Each ministry's report on its directives. */
  reports?: MinistryReport[];
  /** The player's economy before and after the turn, for the report. */
  economy?: { before: EconomyFigures; after: EconomyFigures };
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
  id: string;
  /** The name the player gave this game; without one it goes by country and year. */
  title?: string;
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

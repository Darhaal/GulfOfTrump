import type { AdviceMessage, AdvisorId, NewMinistryId } from "./advisors";
import type { PartyEmblemKey } from "./partyEmblems";
import type { BlocKind } from "./foreign";
import type { ResourceEntry, ResourceType } from "./resources";
import type { Town } from "./towns";
import type { LawId, Laws } from "./laws";

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

export type ScenarioId = "1914" | "1933" | "1939" | "1950" | "1957" | "1964" | "1973" | "1979" | "1991" | "1999" | "2014" | "2022";
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
  /** A civil war under way on the date: the country, its rebels, how they rose and how rightful each side is taken to be (engine/civilWar.ts seedCivilWars). */
  civil?: { of: string; rebels: string; how: CivilHow; legitimacy?: Record<CivilSide, number> };
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
  /**
   * Where an attack on a member binds the others (engine/intentions.ts treaty calls): NATO's North Atlantic, the Rio
   * Pact's Americas, the Pacific of ANZUS and America's treaties. Without one a military alliance binds for its
   * members' home land only, never an overseas possession.
   */
  area?: TreatyArea;
  /** Whether it takes new members: NATO, the Warsaw Pact, the Rio Pact do; a bilateral treaty never. Without it, a bloc of three or more is open. */
  open?: boolean;
  /** False for a treaty that binds no one to anyone – arms control, a convention, a settlement: no trust it settles, no pact broken by a war. */
  binds?: false;
}

/** The parts of the world a treaty's guarantee covers (engine/scenarios/treaties.ts AREAS). */
export const TREATY_AREAS = ["north-atlantic", "americas", "pacific", "southeast-asia", "middle-east", "europe", "east-asia"] as const;
export type TreatyArea = (typeof TREATY_AREAS)[number];

export interface Scenario {
  id: ScenarioId;
  map: MapId;
  startDate: string;
  defaultStep: TimeStep;
  title: Localized;
  /** One sentence under the title on the front page. */
  tagline: Localized;
  /** The world on the start date, in about three paragraphs (blank lines between), behind the front page's "More". */
  story: Localized;
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
  /**
   * Other starts of the same date, chosen on its card: a week before it, say.
   * Everything else of the date (its economy, people, quotes, scene, plans)
   * stays keyed by the scenario's id; `getScenario(id, variant)` lays a
   * variant over the date.
   */
  variants?: Partial<Record<StartVariant, ScenarioVariant>>;
  /** The variant this scenario was laid out for, by `getScenario`; missing for the date itself. */
  variant?: StartVariant;
  /** The one country a start is played as, chosen for the player (the tutorial): no country to pick. */
  player?: string;
}

/**
 * The starts a date may offer besides its own day: the week before it, and
 * on 2022 the tutorial, the first morning of the invasion played as Ukraine
 * with a guide and its first turns written in advance (engine/tutorial.ts).
 */
export const START_VARIANTS = ["eve", "tutorial"] as const;
export type StartVariant = (typeof START_VARIANTS)[number];

/**
 * What a start other than the date's own day changes: its day, its words, and
 * the world as it stood then. A war or treaty of the date that had not begun
 * on that day is left out by itself; what else differs is given here.
 */
export type ScenarioVariant = Pick<Scenario, "startDate" | "tagline" | "story" | "briefing" | "context"> &
  Partial<Pick<Scenario, "defaultStep" | "wars" | "alliances" | "provinceControllers" | "provinceContested" | "provinceHeld" | "provinceTaken" | "protests" | "loyalty" | "featured" | "player">> & {
    /** Leader lines that differ on that day, by country. */
    leaders?: Record<string, string>;
  };

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
  /** Points of this turn's growth that a war on the country's own soil took (engine/economy.ts): taken out again before growth drifts next turn. */
  shock?: number;
  /** $bn a year of the army budget a government abroad added for a war it fights, given back after the peace. */
  war?: number;
  /** Soldiers, thousands, a government abroad called up from its reserves for a war on its own soil (engine/mobilisation.ts warCallUp), sent home after the peace. */
  called?: number;
  /**
   * Share of the people's goods need the consumer factories built by industry spending and policies hold up
   * (engine/development.ts): built over months, run down over years; negative when industry is starved.
   */
  factories?: number;
  /** What the mines and wells it holds give against what the land alone gives: 1 when missing, up to 1.3 (engine/development.ts). */
  extraction?: number;
  /**
   * How run down the state's administration, police, roads and upkeep are, 0–1 (engine/economy.ts upkeepOf): the "other"
   * line kept below its usual share wears them down over months, and restoring it mends them; none when missing.
   */
  neglect?: number;
  /**
   * The government's split of the industry line between heavy and light industry (engine/industry.ts): points moved to
   * heavy (+) or light (−) industry from the usual split for the era, income and system, at most 20; the usual when missing.
   */
  tilt?: number;
  /**
   * The industrial structure (engine/industry.ts): points heavy industry stands above (+) or below (−) its usual share of
   * output for the era, income and system; it follows the split over years, and a system changed overnight leaves its
   * plants as they were. The usual when missing.
   */
  lean?: number;
  /** The share of output a long mobilisation's strain takes now (engine/mobilisation.ts), given back as it eases; none when missing. */
  strained?: number;
  /**
   * Shares of output a standing cause holds the economy below its level by (engine/economy.ts): a power shortage, trade
   * cut off (imports gone without and exports lost), a war on its own soil, strategic bombing. Levels, not tolls on growth:
   * a cause that stands keeps the gap, one that goes gives it back. None when missing.
   */
  losses?: OutputLosses;
  /** The value (people times income) of the land it held when the engine first kept its books: its resource appetites go with that land. */
  land?: number;
  /** The day it last defaulted on its debt (engine/economy.ts): lenders lend it nothing for some years after. */
  defaulted?: string;
  /** $bn a year paid over the last turn outside the budget's lines – joint projects, the Games, warheads, launch sites – from the reserves and loans. */
  offBudget?: number;
}

/** What holds a country's output below its level, shares of it (engine/economy.ts Economy.losses). */
export interface OutputLosses {
  power?: number;
  trade?: number;
  war?: number;
  bombing?: number;
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
  /**
   * A government that holds no land and carries on abroad. For any government
   * but the player's, `standing` (0–100) is how much it still counts: its
   * host, allies at war, troops and resistance at home keep it up; it fades
   * without them, and at nothing it gives up (engine/warEnd.ts).
   */
  exile?: { since: string; host?: string; standing?: number; offered?: string };
  /** A government another country set up in land it took: a provisional or puppet government (engine/provisional.ts). */
  client?: Client;
  /** Its politics in brief, kept by the engine for every country but the player's (engine/abroad.ts). */
  domestic?: Domestic;
  /** The people its leader line names, with their portraits (engine/people.ts); rebuilt when the line changes. */
  rulers?: Rulers;
  /** Its weapons (engine/arsenal.ts); missing in saves from before them until the game opens. */
  arsenal?: Arsenal;
  /** Its foreign course, kept by the engine for the countries that matter (engine/relations.ts). */
  course?: Course;
  /** Policies at work and trade agreements' gains (engine/policies.ts); missing when none. */
  programmes?: Programme[];
  /** Months its people have been kept under arms beyond the peace's share (engine/mobilisation.ts); missing when they are not, and before the record was kept. */
  mobilised?: number;
}

/**
 * A provisional or puppet government an occupier set up: who set it up and
 * when, the land still to pass to it, how far its people accept it, and who
 * abroad recognises it (engine/provisional.ts).
 */
export interface Client {
  /** The government that set it up. */
  patron: string;
  since: string;
  /** The country whose land it governs, when it is a new government beside an old one that fights on. */
  of?: string;
  /** Provinces still to pass to it from its patron, a share a turn; empty once they all have. */
  land: string[];
  /** How far its people take it as their own government, 0–100: low, a puppet; high, accepted. */
  accepted: number;
  /** Governments that recognise it, and those that refuse to; the rest keep silent. */
  recognised: string[];
  refused: string[];
  /** The treaty that ties it to its patron. */
  bloc?: string;
}

/** Terms a war can end on, when one side has collapsed (engine/warEnd.ts). */
export const PEACE_TERMS = ["annex", "government", "restore", "demilitarise", "reparations"] as const;
export type PeaceTerms = (typeof PEACE_TERMS)[number];

/** A request for terms a government made to the player's, standing until it is answered or lapses (engine/warEnd.ts). */
export interface PeaceOffer {
  by: string;
  since: string;
  until: string;
  /** What it offers: by default, what the player holds of its land. */
  terms: PeaceTerms;
}

export type Gender = "male" | "female";

/** A person of the game — a leader, or anyone holding a post (engine/people.ts). */
export interface Person {
  /** A known person's id (scripts/portraits/people.json), or one made from the name. */
  id: string;
  name: string;
  gender: Gender;
  /** Their portrait in public/portraits; without one, a shadow of their sex and era. */
  portrait?: string;
}

/** The people a leader line names, in its order, and the line they were read from. */
export interface Rulers {
  line: string;
  people: Person[];
  /** Which of them leads: the prime minister under a king, say. */
  lead: number;
}

/** How a game treats real history after the start date: history as a strong tendency, or its own course. The first is what a new game offers. */
export const GAME_MODES = ["historical", "free"] as const;
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
  /** A pledge given after an aggression holds until this date, renewed by the next attack (engine/aggression.ts). */
  until?: string;
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
  /** Their land touches (a province each owns or holds side by side): an army needs no fleet to reach the other. Recomputed every turn with the map's neighbours. */
  land?: boolean;
  /**
   * Alarm the other raised by a deed – joint manoeuvres, a first satellite or missile, a nuclear strike – on top of the
   * threat the course computes; it halves in a year (engine/relations.ts raiseAlarm).
   */
  alarm?: number;
}

/**
 * `aggression`: an attack on a third country, condemned by a government that watched it (engine/aggression.ts);
 * `boycott`: it stayed away from the Games this government hosted; `sport-ban`: it called for this country's ban from the Games (engine/sport.ts);
 * `broke-deal`: a trade deal torn up or left undelivered (engine/deals.ts);
 * `joint`: a joint action carried out together; `left-joint`: one it walked out of (engine/joint.ts);
 * `recalled`: it recalled its ambassador; `broke-relations`: it broke off relations (engine/envoys.ts).
 */
export const DEED_KINDS = ["attacked", "joined-enemy", "came-to-aid", "stood-aside", "left-bloc", "sanctioned", "aided", "allied", "made-peace", "broke-pact", "occupied", "provoked", "aggression", "repression", "atrocity", "boycott", "sport-ban", "broke-deal", "joint", "left-joint", "recalled", "broke-relations"] as const;
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
  set: { date: string; how: "start" | GovernmentChange };
}

export const PLAN_KINDS = ["war", "join", "bloc", "leave", "peace", "policy", "sanction", "deal", "talks"] as const;
/**
 * Attack a country; enter a war under way; found or join a bloc; leave one; seek peace (the strategic plans);
 * a policy at home; sanctions on another government or lifting them; a trade agreement; talks to ease a quarrel (the peaceful ones, engine/policies.ts).
 */
export type PlanKind = (typeof PLAN_KINDS)[number];

/** The strategic plans, kept by the governments that matter. */
export const STRATEGIC_KINDS: readonly PlanKind[] = ["war", "join", "bloc", "leave", "peace"];

export const POLICY_KINDS = ["infrastructure", "industry", "technology", "market", "austerity", "stimulus", "armament", "disarmament", "liberalise", "crackdown"] as const;
/** A government's policy at home (engine/policies.ts): programmes of building, industry and science; economic reform, austerity, stimulus; arming or cutting the army; opening the regime or tightening it. */
export type PolicyKind = (typeof POLICY_KINDS)[number];

/** A policy at work after its adoption, or a trade agreement's gains: what the engine applies each turn until it runs out (engine/policies.ts). */
export interface Programme {
  /** The plan that adopted it (or the agreement's bloc). */
  id: string;
  kind: PolicyKind | "trade";
  since: string;
  until: string;
  /** A trade agreement: the partner. */
  with?: string;
  /** A trade agreement: the growth it adds, points a year. */
  gain?: number;
  /** Budget lines it added, as shares of GDP, taken back when it ends. */
  lines?: Partial<Record<"army" | "industry" | "social" | "other", number>>;
}

export const INCIDENT_KINDS = ["border", "airspace", "naval", "spy", "expulsion", "cyber", "trade", "minority"] as const;
/** A border clash, an airspace violation, a naval incident, a spy scandal, diplomats expelled, a cyber attack, a trade dispute, clashes over a minority. */
export type IncidentKind = (typeof INCIDENT_KINDS)[number];

export const INCIDENT_CAUSES = ["claim", "rivalry", "blocs", "sanctions", "regimes", "war-nearby", "tension"] as const;
/** What set two states against each other: a claim on land, distrust and tension, rival blocs, sanctions, opposed regimes next door, a war nearby, tension alone. */
export type IncidentCause = (typeof INCIDENT_CAUSES)[number];

export const INCIDENT_ANSWERS = ["escalate", "sanction", "talks", "none"] as const;
/** The answer an incident drew: a war plan, sanctions, talks, or protests alone. */
export type IncidentAnswer = (typeof INCIDENT_ANSWERS)[number];

export const PLAN_STAGES = ["incident", "tension", "decision", "preparation", "action"] as const;
export type PlanStage = (typeof PLAN_STAGES)[number];

/** `aggression`: the answer to an attack on a third country (engine/aggression.ts), its case in `origin`. */
export const PLAN_CAUSES = ["claim", "ambition", "treaty", "threat", "incident", "weariness", "new-government", "opportunity", "seeded", "economy", "politics", "trade", "tension", "aggression", "independence"] as const;
export type PlanCause = (typeof PLAN_CAUSES)[number];

export const PLAN_ENDS = ["carried-out", "compromise", "refused", "outmatched", "unrest", "government", "target-gone", "overtaken", "mediation", "deterred", "economy"] as const;
/** How a plan ended; a crisis (a war plan) can also be talked down by a mediator, deterred by the target's backers, or dropped for the economy's sake (engine/standoffs.ts). */
export type PlanEnd = (typeof PLAN_ENDS)[number];

export const BECAUSE_KINDS = [
  "incident",
  "claim",
  "ambition",
  "backing",
  "diversion",
  "deterrent",
  "mediation",
  "talks",
  "trade",
  "weak",
  "unrest",
  "election",
  "slump",
  "inflation",
  "sanctions",
  "election-lost",
  "coup",
  "new-government",
  "war",
  "war-on",
  "defeat",
  "tenure",
  // The world's answer to aggression (engine/aggression.ts): alarm at a country's attacks, and a world body's call.
  "aggression",
  "un-call",
  "league-call",
  /** An election put off: war on the country's own soil, a strong enemy at its door, martial law. */
  "war-home",
  "war-near",
  "martial-law",
  /** Elections suspended by law (engine/laws.ts): the player's vote waits until the law is lifted. */
  "suspended",
  /** Sanctions over a government's mass crimes at home (engine/repressions.ts). */
  "atrocity",
  /** A client government turned against its patron declares independence, and the patron's war to keep it (engine/intentions.ts). */
  "patron",
  "breakaway",
] as const;
export type BecauseKind = (typeof BECAUSE_KINDS)[number];

/**
 * Why something happened, for the news and the game master (engine/standoffs.ts):
 * the incident a crisis grew from, the ally that deterred it, the mediator,
 * the slump before a coup, the lost election before a change of course.
 */
export interface Because {
  kind: BecauseKind;
  /** The country behind it: the mediator, the deterrent ally, the backer, the victim of a war. */
  country?: string;
  /** When: the month an incident began in. */
  date?: string;
  /** The kind of incident. */
  incident?: IncidentKind;
}

export const COLONY_HOWS = ["handover", "community", "war", "union"] as const;
/**
 * How a colony comes free (engine/colonies.ts): handed over by agreement; independent inside its metropole's community
 * (the Commonwealth, the French Community); after a colonial war; joined to a state that already exists.
 */
export type ColonyHow = (typeof COLONY_HOWS)[number];

export const COLONY_STAGES = ["rule", "demands", "talks", "autonomy", "war"] as const;
/** Quiet rule; a national movement's demands; talks with a day set; self-government in a federation; a colonial war. */
export type ColonyStage = (typeof COLONY_STAGES)[number];

export const COLONY_COURSES = ["hand-over", "delay", "fight", "federation"] as const;
/** What a metropole does about a colony: hand it over, put it off, fight its movement, offer it self-government in a federation. */
export type ColonyCourse = (typeof COLONY_COURSES)[number];

export const COLONY_CHANGES = ["demands", "talks", "autonomy", "delayed", "refused", "rising", "crushed", "agreement", "independence"] as const;
export type ColonyChange = (typeof COLONY_CHANGES)[number];

/**
 * A colony on its way to independence (engine/colonies.ts). Its land is the
 * modern countries it covers, with provinces added or left out, as long as
 * someone other than the state it becomes rules them; its metropole is
 * whoever rules most of it.
 */
export interface Colony {
  /** The calendar's id (scenarios/colonies.ts), or the metropole's and the state's tags for one the free mode found. */
  id: string;
  /** The state it becomes, or joins. */
  tag: string;
  /** Who rules it now. */
  of: string;
  adm0: string[];
  plus?: string[];
  minus?: string[];
  /** Read from the calendar (scenarios/colonies.ts). */
  seed?: string;
  stage: ColonyStage;
  /** When it reached its stage. */
  since: string;
  /** How hard its people push for independence, 0–100. */
  pressure: number;
  /** The day set for independence: history's in the historical mode, the one agreed in talks. */
  due?: string;
  /** The metropole's course, and the one already acted on. */
  course?: ColonyCourse;
  answered?: ColonyCourse;
  /** Its colonial war, and the movement that fights it. */
  war?: string;
  movement?: string;
  /** The calendar's war is behind it: crushed or settled. */
  fought?: boolean;
  /** Its movement fought the metropole to the table: the state is the movement's. */
  won?: boolean;
  end?: { date: string; turn: number; how: ColonyHow | "gone" };
}

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
  /** War: the scenario's war it begins, a war of the date that an earlier start opens before it (its id and name, when the engine starts it). */
  begins?: string;
  /** Leave: the bloc; bloc: the one it joins, or the one it founded. */
  bloc?: string;
  /** Join: the side it takes. */
  side?: "attackers" | "defenders";
  /** Bloc: what it founds. */
  blocKind?: "alliance" | "pact";
  /** Policy: which. */
  policy?: PolicyKind;
  /** Sanction: lift the sanctions instead of imposing them. */
  lift?: boolean;
  /** What led to it: the incident ("i12-1"), the plan it answers, or the act of aggression ("g12-1", engine/aggression.ts). */
  origin?: string;
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

/**
 * The types within a kind, each with its own job (engine/forces.ts): aircraft
 * are fighters, attack planes and tactical bombers, strategic bombers and
 * transports; ships are capital ships and carriers, escorts, submarines and
 * landing ships with transports; tanks are light, medium, heavy and main
 * battle tanks, with infantry fighting vehicles.
 */
export const ARMS_TYPES = ["fighter", "attack", "bomber", "transport", "capital", "escort", "submarine", "landing", "light", "medium", "heavy", "mbt", "ifv"] as const;
export type ArmsType = (typeof ARMS_TYPES)[number];

/** How many of a kind a country has, and their technology level: 1 for the Great War, 6 for today; a fraction while old and new serve side by side. */
export interface ArmsStock {
  n: number;
  level: number;
  /** For aircraft, ships and tanks: how many of each type, adding up to n (missing in saves from before step 37). */
  types?: Partial<Record<ArmsType, number>>;
}

/** The player's order to build a number of one type (or of a kind), which the arms money serves first until it is filled or lapses (engine/forces.ts). */
export interface ArmsOrder {
  type: ArmsType | WeaponKind;
  /** How many were ordered. */
  n: number;
  /** How many have been built for it so far. */
  built: number;
  /** When it was given. */
  since: string;
}

/** A country's weapons (engine/arsenal.ts). */
export interface Arsenal {
  stock: Partial<Record<WeaponKind, ArmsStock>>;
  /** The player's: made and lost over the last turn, by kind. */
  made?: Partial<Record<WeaponKind, number>>;
  lost?: Partial<Record<WeaponKind, number>>;
  /** The player's: received from abroad over the last turn, bought or given. */
  got?: Partial<Record<WeaponKind, number>>;
  /** It has atomic weapons. */
  nuclear?: boolean;
  /** Its soldiers by training, thousands, adding up to the economy's (engine/army.ts); missing in older saves until step 17. */
  men?: ArmyMen;
  /** The player's: its armies as the game master last described them. */
  organisation?: ArmyOrganisation;
  /** The player's: what its orders told industry to build, until filled or lapsed. */
  orders?: ArmsOrder[];
}

/** Soldiers by training, thousands: career soldiers, conscripts already trained, recruits still in training. */
export interface ArmyMen {
  pro: number;
  trained: number;
  recruits: number;
}

/** One of the player's armies, fleets or air forces, as the game master described it. */
export interface Formation {
  name: string;
  kind: "front" | "army" | "corps" | "fleet" | "air" | "reserve";
  divisions: number;
  commander?: string;
  /** The commander's character in a few words ("bold, impatient"): how he fights his sector (engine/formations.ts). */
  character?: string;
  /** Where it fights or stands, in words. */
  theatre?: string;
  /** The provinces it stands in. */
  provinces: string[];
  note?: string;
}

/** The player's army organisation and when it was described. */
export interface ArmyOrganisation {
  date: string;
  turn: number;
  formations: Formation[];
}

/** How a formation fights a turn (engine/formations.ts): falls back, holds its line, probes, attacks, or throws everything in. */
export const POSTURES = ["withdraw", "hold", "probe", "offensive", "assault"] as const;
export type Posture = (typeof POSTURES)[number];
/** A formation's standing task: keep its line, or take ground where it can. */
export const UNIT_TASKS = ["hold", "attack"] as const;
export type UnitTask = (typeof UNIT_TASKS)[number];
/** What the player may order a formation: its task, an offensive or an all-out assault this turn, a withdrawal, a new commander. */
export const ARMY_ORDER_KINDS = ["hold", "attack", "offensive", "assault", "withdraw", "commander"] as const;
export type ArmyOrderKind = (typeof ARMY_ORDER_KINDS)[number];
/** What the general staff made of an order: carried out as given, late, half-heartedly, or badly. */
export const ORDER_FATES = ["done", "late", "half", "badly"] as const;
export type OrderFate = (typeof ORDER_FATES)[number];

/** A formation's commander: his name where the game master gave one, his character and his skill. */
export interface Commander {
  name?: string;
  /** Reckless 2, bold 1, steady 0, careful −1, timid −2. */
  temper: number;
  /** 1–5. */
  skill: number;
}

/** A formation the engine fights with (engine/formations.ts): an army, corps or front holding a sector of one war's front. */
export interface ArmyUnit {
  /** Stable within its war: "<tag>-<n>". */
  id: string;
  tag: string;
  /** Its number among its country's formations in the war: an engine-made one goes by it. */
  n: number;
  /** The game master's name for it (the player's organisation); none for one the engine made. */
  name?: string;
  kind: "front" | "army" | "corps";
  commander: Commander;
  /** The front provinces it holds or fights in, as the last turn left them. */
  sector: string[];
  task: UnitTask;
  /** Guns and shells gathered for an attack, 0–1: a careful commander waits for them. */
  prep: number;
  /** The task was the player's order: the staff keeps it until another. */
  ordered?: boolean;
  /** Months it still needs to regroup after an attack that gained next to nothing. */
  rest?: number;
}

/** A player's order to one of his formations, for the coming turn. */
export interface ArmyOrder {
  war: string;
  unit: string;
  kind: ArmyOrderKind;
  /** A new commander's character (−2 to 2), and his name if the player gave one. */
  temper?: number;
  name?: string;
  /** The order in the player's own words, when it was written rather than picked (engine/formations.ts readArmyOrder): the game master reads it. */
  text?: string;
}

/** A formation's heavy weapons, in pieces: the kinds a sector's fighting weighs. */
export interface UnitForces {
  tanks?: number;
  artillery?: number;
  aircraft?: number;
}

/** One formation's turn as the engine fought it, for the army tab and the report: thousands of soldiers, ground in km. */
export interface SectorTurn {
  war: string;
  unit: string;
  n: number;
  name?: string;
  kind: ArmyUnit["kind"];
  commander?: string;
  posture: Posture;
  /** The province it fought hardest in. */
  at?: string;
  /** Its soldiers killed, wounded and taken prisoner, and the enemy's in its sector. */
  lost: number;
  enemyLost: number;
  /** Prisoners it took. */
  taken?: number;
  /** Ground gained where it fought hardest (negative: given up), km. */
  km: number;
  /** Its soldiers at the turn's start, thousands, and their supply, 0–1. */
  men: number;
  supply: number;
  /** Its tanks, guns and aircraft, as the general staff shared them out (engine/formations.ts UnitForces). */
  forces?: UnitForces;
  /** The player's order, and what the general staff made of it. */
  order?: { kind: ArmyOrderKind; fate: OrderFate };
}

/** The feats of a space and rocket programme (engine/space.ts), in the order history first made them. */
export const SPACE_MILESTONES = ["icbm", "satellite", "animal", "recon", "human", "spacewalk", "lunar-flyby", "moon", "warning", "station", "reusable", "navigation"] as const;
export type SpaceMilestone = (typeof SPACE_MILESTONES)[number];
/** What a space programme puts first: every feat alike, the ones the world watches, or the ones the army needs. */
export const SPACE_FOCUSES = ["balanced", "prestige", "military"] as const;
export type SpaceFocus = (typeof SPACE_FOCUSES)[number];

/** A country's space and rocket programme (engine/space.ts). */
export interface SpaceProgramme {
  /** The year of space technology reached: the leading programme at history's pace keeps the calendar's. */
  level: number;
  /** Share of the research money it takes, %. */
  share: number;
  focus?: SpaceFocus;
  /** Work done on each feat not yet made, in years at history's pace. */
  work: Partial<Record<SpaceMilestone, number>>;
  /** Feats made, with the month. */
  done: { id: SpaceMilestone; date: string }[];
  /** Launches lost since the last feat. */
  failed?: number;
}

/** A launch site ordered in play (the real ones are the engine's: engine/space.ts). */
export interface SpaceSite {
  id: string;
  name: string;
  province: string;
  /** The day it opens: building takes two years. */
  opens: string;
  by: string;
}

/** The space race: every programme, the first of each feat and who made it, the sites built in play. */
export interface SpaceState {
  programmes: Record<string, SpaceProgramme>;
  firsts: Partial<Record<SpaceMilestone, { by: string; date: string }>>;
  sites?: SpaceSite[];
}

/** The Summer and Winter Olympic Games and the football World Cup (engine/sport.ts). */
export const GAMES_KINDS = ["summer", "winter", "cup"] as const;
export type GamesKind = (typeof GAMES_KINDS)[number];

/** Why a host lost its Games: its land conquered, the state gone, war on its own soil, it withdrew, or it was barred. */
export const HOST_LOSSES = ["conquered", "collapsed", "war", "withdrew", "banned"] as const;
export type HostLoss = (typeof HOST_LOSSES)[number];

/** One country's medals at an Olympic Games. */
export interface MedalRow {
  tag: string;
  gold: number;
  silver: number;
  bronze: number;
}

/** One Olympic Games or World Cup: when, where, who chose it and how it went (engine/sport.ts). */
export interface Games {
  /** "summer-1952", "winter-1952", "cup-1950". */
  id: string;
  kind: GamesKind;
  year: number;
  /** The opening day. */
  opens: string;
  /** The host countries: one for the Olympics, up to three for a World Cup; empty until the vote. */
  hosts: string[];
  /** The host city, by history or the vote; a World Cup has none. */
  city?: Localized;
  /** The day the host was chosen, and the countries that bid. */
  awarded?: string;
  bids?: string[];
  /** Hosts that lost these Games before they were held, and why. */
  replaced?: { hosts: string[]; city?: Localized; why: HostLoss; date: string }[];
  status: "planned" | "held" | "cancelled";
  /** Why they were cancelled: a great war, or no host left in time. */
  cancelled?: "war" | "host";
  /** Countries that stayed away in protest, and those barred. */
  boycott?: string[];
  banned?: string[];
  /** The Olympics' medal table as the engine made it: the leaders, and the player's row wherever it stands. */
  medals?: MedalRow[];
  /** The player's place in the medal table, when it won any. */
  rank?: number;
  /** A World Cup's final as the engine played it, and the other two semi-finalists. */
  final?: { winner: string; runnerUp: string; score: [number, number]; penalties?: boolean; semis?: string[] };
  /** Games held before the game began: who led the medal table, or won the Cup, as history has it. */
  champion?: string;
}

/** A country barred from the Olympic Games and the World Cup: by history's anchor, as an aggressor under the world body's sanctions, or by a vote the player called. */
export interface SportBan {
  tag: string;
  since: string;
  by: "history" | "aggression" | "vote";
  until?: string;
}

/** Sport in the game: the Games of the coming years and those held, the bans, the player's bids and boycotts and its money for sport (engine/sport.ts). */
export interface SportState {
  /** The Games from the last held of each kind to the horizon, oldest first. */
  games: Games[];
  bans?: SportBan[];
  /** Games the player's government bids for, and those it will stay away from. */
  bids?: string[];
  boycotts?: string[];
  /** Share of the social budget the player's government gives to sport, %; the era's usual when missing. */
  share?: number;
  /** How the player's sport stands from the money of the last years, 0.6–1.5: it follows the money slowly. */
  form?: number;
  /** A great war (engine/sport.ts greatWar) raging since this day, or the day the last one ended. */
  war?: string;
  peace?: string;
}

/** What a country's electricity is made from (engine/energy.ts). */
export const ENERGY_SOURCES = ["coal", "oil", "gas", "hydro", "nuclear", "wind", "solar"] as const;
export type EnergySource = (typeof ENERGY_SOURCES)[number];

/** Power plants under construction (engine/energy.ts): paid for from the industry line over the years they take. */
export interface PlantWork {
  source: EnergySource;
  /** Capacity it adds, GW. */
  gw: number;
  /** What it costs in all and what has been paid, $bn of the day it was begun. */
  cost: number;
  paid: number;
  since: string;
  /** Who began it: the government's order, its industry minister, or the state's own planners (any government but the player's). */
  by: "order" | "minister" | "state";
}

/** A country's electricity (engine/energy.ts): its plants, the demand they serve, what they gave over the last turn. */
export interface PowerBook {
  /** Capacity in service, GW, by source. */
  gw: Partial<Record<EnergySource, number>>;
  /** Electricity the country asks for, TWh a year: it grows with the economy. */
  demand: number;
  /** What the plants delivered over the last turn, TWh a year, with their fuel and the land the country holds. */
  supply?: number;
  /** The share of demand that went unmet over the last turn, 0–1. */
  short?: number;
  building?: PlantWork[];
  /** Nuclear capacity when the book was opened, GW: the uranium the start date's reactors burn is measured against it. */
  base?: number;
  /** The share of the plants the fronts have wrecked (engine/energy.ts): up to the fronts' share of the land, repaired once they go. */
  wrecked?: number;
  /** $bn a year its plants under construction took from the industry line over the last turn. */
  spent?: number;
}

/** The steps of an atomic programme (engine/atom.ts): a first reactor, the material for a bomb, a device, the first test, the hydrogen bomb. */
export const ATOM_STAGES = ["reactor", "material", "device", "test", "hydrogen"] as const;
export type AtomStage = (typeof ATOM_STAGES)[number];

/** A country's atomic programme and its arsenal (engine/atom.ts). */
export interface AtomProgramme {
  /** Stages done, with the day. */
  done: { id: AtomStage; date: string }[];
  /** Work on the stages not yet done, in years at history's pace. */
  work: Partial<Record<AtomStage, number>>;
  /** Share of the research money it takes, %: a government other than the player's (the player's runs on the strategic direction of research). */
  share: number;
  /** Warheads. */
  stock: number;
  /** The player's order for the stockpile: built up or cut down to this many. */
  goal?: number;
  /** Given up, on this day (South Africa's, dismantled). */
  ended?: string;
  /** An arsenal never tested in the open (Israel's). */
  undeclared?: boolean;
}

/** A nuclear strike, the gravest act there is, kept for ever (engine/atom.ts). */
export interface NuclearStrike {
  by: string;
  against: string;
  region: string;
  n: number;
  date: string;
  turn: number;
  /** Thousands killed. */
  deaths: number;
  /** An answer in kind to a strike. */
  answer?: boolean;
  /** A tactical strike on a military target at the front, not on a city (engine/nuclear.ts). */
  tactical?: boolean;
}

/**
 * The rungs of the escalation ladder an atomic power the engine governs climbs at war (engine/nuclear.ts): open
 * threats, a raised alert, a demonstration (a test or a warning shot at sea), a tactical strike at the front, a strike
 * on cities. A ladder's `step` counts them from 1.
 */
export const LADDER_STEPS = ["threats", "alert", "demonstration", "tactical", "cities"] as const;
export type LadderStep = (typeof LADDER_STEPS)[number];

/** Where an atomic power the engine governs stands on the escalation ladder of a war (engine/nuclear.ts). */
export interface NuclearLadder {
  /** The rung reached, 1–5 (LADDER_STEPS). */
  step: number;
  war: string;
  /** The enemy it faces down: the principal of the other side. */
  against: string;
  /** The day it reached this rung. */
  since: string;
  /** The highest rung it reached in this war. */
  top: number;
  /** Nuclear strikes it made in this war. */
  strikes?: number;
}

/** Every atomic programme and the strikes made (engine/atom.ts). */
export interface AtomState {
  programmes: Record<string, AtomProgramme>;
  strikes?: NuclearStrike[];
  /** The escalation ladders of the atomic powers at war the engine governs, by country (engine/nuclear.ts); missing while none climbs one. */
  ladder?: Record<string, NuclearLadder>;
}

/** Where the player's government directs its research (engine/research.ts). */
export const RESEARCH_DIRECTIONS =["military", "industry", "agriculture", "medicine", "science", "communications", "strategic"] as const;
export type ResearchDirection = (typeof RESEARCH_DIRECTIONS)[number];

/** A research project of the old kind, kept only to read a save from before research directions (migration step 16). */
export interface ResearchProject {
  id: string;
  /** 0–1. */
  progress: number;
  since: string;
  /** Under way, or set aside with its progress kept. */
  on: boolean;
}

/**
 * The player's research: how its money is split between the directions,
 * the year of technology each has reached (ahead of the calendar, or behind
 * it), the bomb programme of a country without the bomb, and the
 * breakthroughs made in this game.
 */
export interface Research {
  /** % of the research money by direction; they add up to 100. */
  shares: Record<ResearchDirection, number>;
  /** The split that keeps history's pace: the game's own at its start. */
  base?: Record<ResearchDirection, number>;
  /** The year of technology each direction has reached: the calendar's when research keeps pace with history. */
  tech: Record<ResearchDirection, number>;
  /** 0–1: the bomb programme of a country that has no bomb yet. */
  bomb?: number;
  /** Breakthroughs made in this game, with their dates. */
  done: { id: string; date: string }[];
  /** A save from before research directions: the projects it had under way (migration step 16 reads them). */
  active?: ResearchProject[];
}

export const REGIME_KINDS = ["democracy", "limited", "party", "autocracy", "military"] as const;
/** Elections the government can lose; elections it seldom loses; a ruling party that holds the army too; no contested vote; army rule. */
export type RegimeKind = (typeof REGIME_KINDS)[number];

/** A country's politics as the engine moves them, without a model call. */
/** How a government abroad changed: a vote, a coup, a new leader, or a civil war the rebels won (a revolution; a rising or a secession). */
export const GOVERNMENT_CHANGES = ["election", "coup", "leader", "revolution", "rising"] as const;
export type GovernmentChange = (typeof GOVERNMENT_CHANGES)[number];

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
  changed?: { date: string; how: GovernmentChange };
  /** The last attempt on the government by force, whether it succeeded or not. */
  lastCoup?: string;
  /** The last coup that succeeded: coups breed coups for some years after, whatever the government since (engine/abroad.ts). */
  couped?: string;
  /** The date an election was first due before war put it off (engine/abroad.ts electionPause); it is held soon after the peace. */
  deferred?: string;
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
  /** One the engine raised (engine/mobilisation.ts): the families of the men under arms; its title is the interface's, in each language. */
  kind?: "mobilisation";
}

export const OFFICIAL_POSTS = ["head", "government", "chief", "military", "finance", "industry", "foreign", "interior", "intelligence", "science", "bank", "space", "m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "m9", "m10", "m11"] as const;
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
  /** Progress towards the next step of loyalty, up or down (engine/intrigue.ts); none in saves from before it. */
  favour?: number;
  /** The turn the government last courted them with a favour or a post: once a turn. */
  courted?: number;
  /** They were given a seat at the top table once, to win them over: it is not given twice. */
  raised?: boolean;
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

/** A person's own way of speaking (engine/speech.ts), in the language it was written for. */
export interface SpeechProfile {
  /** How formal or plain, how they address people, their temper. */
  register: string;
  /** A few turns of phrase of theirs. */
  phrases: string[];
  /** How they argue and lead a talk. */
  argues: string;
  /** What they never say or do in talk. */
  avoids: string;
  /** Habits of speech; empty when none. */
  tics: string;
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
  /** Imposed together with allies (engine/joint.ts): the joint action's id; such sanctions leave fewer ways round them. */
  joint?: string;
}

/**
 * Joint actions with allies (engine/joint.ts): an offensive of two allies' formations on neighbouring sectors at once,
 * an air and naval operation for an ally's war, manoeuvres to warn a rival, research, space and atomic programmes
 * pooled, an economic project built together, a joint note, sanctions together and one line at the world body.
 */
export const JOINT_KINDS = ["offensive", "operation", "exercise", "research", "space", "atom", "project", "note", "sanctions", "line"] as const;
export type JointKind = (typeof JOINT_KINDS)[number];
/** What two governments build together: a pipeline, a canal, a power plant or works, an airliner, a railway, a tunnel. */
export const PROJECT_KINDS = ["pipeline", "canal", "plant", "aircraft", "railway", "tunnel"] as const;
export type ProjectKind = (typeof PROJECT_KINDS)[number];
/** Proposed and waiting for the player's answer; under way; carried out; turned down; broken off or lapsed. */
export const JOINT_STATUSES = ["proposed", "active", "done", "refused", "ended"] as const;
export type JointStatus = (typeof JOINT_STATUSES)[number];
/** Why a government answers a joint action the way it does, or why one ended (engine/joint.ts). */
export const JOINT_REASONS = [
  "ties",
  "distrust",
  "tension",
  "interest",
  "noInterest",
  "hawk",
  "dove",
  "cost",
  "trade",
  "secrecy",
  "giving",
  "inward",
  "reputation",
  "weary",
  "noFront",
  "notAtWar",
  "war",
  "friend",
  "proliferation",
  "fair",
  "member",
  "target",
  "withdrawn",
  "term",
  "lapsed",
  "relations",
] as const;
export type JointReason = (typeof JOINT_REASONS)[number];

export interface JointAction {
  /** "j<turn>-<n>", or history's id ("manhattan"). */
  id: string;
  kind: JointKind;
  /** The government that proposed it. */
  by: string;
  /** Every government in it, the proposer first; for a project or programme the first leads. */
  members: string[];
  /** Those asked who said no (a proposal to a bloc's members). */
  declined?: string[];
  /** The enemy of an offensive or operation, the rival an exercise warns, the government a note, sanctions or a line are aimed at. */
  target?: string;
  /** The war an offensive or operation is fought in. */
  war?: string;
  /** Where an offensive meets: the enemy's province next to both lines. */
  at?: string;
  direction?: ResearchDirection;
  project?: ProjectKind;
  scope?: Sanction["scope"];
  vote?: DelegationVote;
  /** An atomic programme's terms: the bomb's design shared with every member, or the lead's alone. */
  share?: "equal" | "lead";
  /** History's name for it (the Manhattan Project, Concorde). */
  name?: Localized;
  status: JointStatus;
  /** When it was proposed (and, for an action of the dice abroad, begun). */
  since: string;
  /** When it begins: an offensive a turn later; missing when at once. */
  from?: string;
  /** When its term runs out; a project has none: it runs until built. */
  until?: string;
  /** The turn it was proposed or answered. */
  turn: number;
  /** A project's or a programme's way done, 0–1. */
  progress?: number;
  /** What each member pays a year for a project, as a share of its economy. */
  cost?: number;
  /** $bn paid so far, all members together. */
  paid?: number;
  /** Why it was answered or ended so. */
  reason?: JointReason;
  /** When it was carried out, refused or ended. */
  ended?: string;
  /** What came of it: ground gained in an offensive (km), the note's answer, a project's yield ($bn a year to each member). */
  result?: { km?: number; yielded?: boolean; gdp?: number };
  /** History's own, in the historical mode: its entry in scenarios/joint.ts. */
  history?: string;
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
  /** The post renamed, its holder kept: the title it had before (engine/government.ts, `retitle`). */
  renamed?: string;
}

/** The player's government overthrown: the game is lost, unless the player carries on as the new one. */
export interface Defeat {
  date: string;
  turn: number;
  /** "election": the government's party lost a vote and with it the government; "resigned" and "died": the leader the player played (engine/fate.ts). */
  how: "coup" | "revolution" | "uprising" | "deposed" | "election" | "resigned" | "died";
  by: string;
  note: string;
  /** The leader who fell, the person the player may stay with (into opposition). */
  fallen?: Person & { title?: string };
  /** The party that governed until the fall. */
  party?: string;
  /** The regime as the game master described it at the fall: a coup or a revolution pins the regime (engine/role.ts regimeNow) until the game master names another. */
  regime?: string;
  /** The player chose to play on: as the new government, or as the fallen leader in opposition. */
  continued?: boolean;
}

/** Who the player is: the country's leader, the leader of the opposition, a minister of one of the eight ministries, or a general (engine/figures.ts). */
export const ROLE_KINDS = ["leader", "opposition", "minister", "general"] as const;

/** How an opposition comes to power. */
export const RISE_HOWS = ["election", "revolution", "coup", "appointed"] as const;
export type RiseHow = (typeof RISE_HOWS)[number];

/** What the state's dice do to an opposition in a turn: the next rung of the ladder. */
export type Repression = "harassed" | "banned" | "arrested" | "exiled";
export type RoleKind = (typeof ROLE_KINDS)[number];

/** A legal party; a movement underground at home; or one abroad, in exile. */
export const MOVEMENT_KINDS = ["party", "underground", "exile"] as const;
export type MovementKind = (typeof MOVEMENT_KINDS)[number];

/** Free to act; watched and hounded; banned; its leader under arrest. */
export const MOVEMENT_STATUSES = ["free", "harassed", "banned", "arrested"] as const;
export type MovementStatus = (typeof MOVEMENT_STATUSES)[number];

/** The scores of a movement the engine keeps, 0–100 unless said otherwise. */
export const MOVEMENT_SCORES = ["money", "press", "insiders", "army", "street"] as const;
export type MovementScore = (typeof MOVEMENT_SCORES)[number];

/** The player's opposition party or movement (engine/role.ts). */
export interface Movement {
  /** Its name, once the player or the game master has given one. */
  name?: string;
  kind: MovementKind;
  /** In exile: the government that shelters it (engine/exile.ts). */
  host?: string;
  status: MovementStatus;
  /** Popular support, % of the country. */
  support: number;
  /** Members and activists, thousands. */
  members: number;
  /** Money; reach in the press; friends inside the government; friends in the army; the crowds it can bring out. */
  money: number;
  press: number;
  insiders: number;
  army: number;
  street: number;
  /** Other parties in the movement's coalition, by id (engine/role.ts castCoalitions). */
  allies?: string[];
  /** Parties the movement offered a coalition to, by id, with the chance each takes it up as it stood when offered: answered by the engine's dice as the next turn is played. */
  offers?: { party: string; chance: number }[];
}

/** The parts of the state a role may govern or only read (engine/remit.ts): the panels besides the role's own. */
export const ROLE_AREAS = ["politics", "foreign", "economy", "army", "science"] as const;
export type RoleArea = (typeof ROLE_AREAS)[number];

/** A minister's or a general's proposal to the leader on something beyond their post (engine/remit.ts). */
export interface RoleProposal {
  id: string;
  /** In the player's words. */
  text: string;
  /** The part of the state it is about. */
  area: RoleArea;
  date: string;
}

/** A minister's or a general's standing (engine/figures.ts), each 0–100. */
export interface Standing {
  /** How far the leader listens to them. */
  influence: number;
  /** The post's means: the ministry's budget and staff, or the strength and supply of the troops under command. */
  means: number;
  /** How loyal the ministry's people or the troops are to them in person. */
  loyalty: number;
}

/** A general commands all the country's forces, or one front. */
export const COMMAND_SCOPES = ["forces", "front"] as const;
export type CommandScope = (typeof COMMAND_SCOPES)[number];

/** What a general commands (engine/figures.ts). */
export interface Command {
  scope: CommandScope;
  /** The front or the theatre, in the player's words or the game master's. */
  name?: string;
}

/** How the player's person can fall from a post or a movement (engine/fate.ts). */
export const FALL_HOWS = ["resigned", "dismissed", "died", "arrested"] as const;
export type FallHow = (typeof FALL_HOWS)[number];
export const DEATH_CAUSES = ["age", "illness", "assassination"] as const;
export type DeathCause = (typeof DEATH_CAUSES)[number];

/** The fall of the player's person from a role that does not govern, waiting for the player's choice (engine/fate.ts). */
export interface Fall {
  how: FallHow;
  /** The role they fell from. */
  from: RoleKind;
  date: string;
  turn: number;
  cause?: DeathCause;
  /** Who takes over the post or the movement, when the game master named them. */
  successor?: string;
}

/** The player's place in the game (engine/role.ts). */
export interface PlayerRole {
  kind: RoleKind;
  /** Who the player is. For a leader, missing means whoever leads the country now. */
  person?: Person & { title?: string };
  /** The opposition's movement. */
  movement?: Movement;
  /** The player's own words on who they are, which party or movement they lead and whose side they take; the game master names them from it. */
  about?: string;
  /** A minister's ministry, by the post its minister holds (engine/figures.ts). */
  post?: OfficialPost;
  /** What a general commands. */
  command?: Command;
  /** A minister's or a general's standing. */
  standing?: Standing;
  /** A minister's or a general's proposals to the leader, answered by the engine's dice as the next turn is played (engine/remit.ts). */
  proposals?: RoleProposal[];
  /** The player resigns as the next turn is played (engine/fate.ts). */
  resigning?: boolean;
  /** The person fell from this role; the player chooses what next (engine/fate.ts). */
  fall?: Fall;
  /** Since when the player has held this role. */
  since: string;
  /** Chosen at the start; left with after the fall of their government; won by taking power; or taken over from someone who fell. */
  how?: "start" | "fell" | "rose" | "succeeded";
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
  /** Taken in a war and left behind by the front: it counts as its holder's until a peace (engine/occupation.ts). */
  behind?: boolean;
  /** Its people resist the holder, whose people they are not (engine/warMeans.ts); missing where they do not, and in saves from before step 26. */
  resistance?: Resistance;
  /** Months the front's line here has stood: trenches, wire and mines grow with them (engine/formations.ts); missing off the front. */
  dug?: number;
}

/** A province's people against a holder they do not take as theirs: partisans, insurgents, and in time acceptance. */
export interface Resistance {
  /** The country whose people they are: the owner the province was taken from. */
  of: string;
  /** Organised resistance, 0–100: it ties down troops, kills soldiers and cuts supply. */
  level: number;
  /** The peace that left the province with its holder: acceptance builds from here. */
  peace?: string;
}

/** What the map draws of a province: kept per turn so the past can be drawn again (engine/history.ts). */
export type RegionBorder = Pick<RegionState, "owner" | "controller" | "contested" | "held">;

/** What a war has cost one of its sides since it began (engine/warLosses.ts). */
export interface WarLosses {
  /** Soldiers killed, thousands. */
  killed: number;
  /** Soldiers wounded, thousands. */
  wounded: number;
  /** Soldiers taken prisoner, thousands: an army in rout loses more men this way than killed. */
  captured?: number;
  /** Weapons lost in this war, by kind (rifles in thousands, the rest in pieces). */
  arms?: Partial<Record<WeaponKind, number>>;
  /** The last turn's part of the record, for the army tab: the turn (as its chronicle entry counts it) and what it cost. A record only; nothing reads it back into the world. */
  last?: WarLossesPart;
}

/** One turn's losses in a war (WarLosses.last). */
export interface WarLossesPart {
  turn: number;
  killed: number;
  wounded: number;
  captured?: number;
  arms?: Partial<Record<WeaponKind, number>>;
}

/** What a war does to the people beside the soldiers' toll, as the engine counts it (engine/civilians.ts). */
/** A nuclear strike's dead are booked under "nuclear" (engine/civilians.ts bookStrike), never cast by the toll itself. */
export const CIVIL_CAUSES = ["bombing", "siege", "occupation", "famine", "fighting", "nuclear"] as const;
export type CivilCause = (typeof CIVIL_CAUSES)[number];

/** What a war has cost one country's people since it began (engine/civilians.ts), thousands; a mass crime's toll is its own (engine/repressions.ts). */
export interface CivilLosses {
  /** Civilians killed, or dead of the war's hunger and cold. */
  dead: number;
  /** Driven from their homes by the fighting. */
  fled: number;
  /** The dead by cause. */
  by?: Partial<Record<CivilCause, number>>;
  /** The last turn's part, for the army tab: the turn (as its chronicle entry counts it), its dead and those who fled. */
  last?: { turn: number; dead: number; fled: number };
}

export interface War {
  id: string;
  name: Text;
  attackers: string[];
  defenders: string[];
  since: string;
  /** A ceasefire in force until a date; the war resumes when it runs out. */
  truce?: { until: string; terms?: Text };
  /** What the war has cost each country that fights it; missing in a save from before the record was kept. */
  losses?: Record<string, WarLosses>;
  /** What it has cost each country's people, beside the soldiers (engine/civilians.ts); missing before the first civilian toll. */
  civilians?: Record<string, CivilLosses>;
  /** Requests for terms made to the player's government, waiting for its answer (engine/warEnd.ts). */
  offers?: PeaceOffer[];
  /** The formations each side fights it with, as the last turn left them (engine/formations.ts); missing before the first turn fought with them. */
  units?: ArmyUnit[];
}

/**
 * How a country splits into civil war (engine/civilWar.ts): a coup that half succeeded, a revolution the army did not
 * all follow, a part of the country that broke away, a rising of a movement.
 */
export const CIVIL_HOWS = ["coup", "revolution", "secession", "rising"] as const;
export type CivilHow = (typeof CIVIL_HOWS)[number];
/** How a civil war ends: the rebels take the country; the government crushes them; the rebels keep their land as a state; the two agree and the country is one again, power shared. */
export const CIVIL_ENDS = ["victory", "crushed", "partition", "settlement"] as const;
export type CivilEnd = (typeof CIVIL_ENDS)[number];
/** The two sides of a civil war. */
export type CivilSide = "government" | "rebels";

/** A civil war (engine/civilWar.ts): a war between a country's government and the rebels' own government, which holds their side's regions. */
export interface CivilWar {
  /** The war it is. */
  war: string;
  /** The country that split: its government's tag. */
  of: string;
  /** The rebels' government. */
  rebels: string;
  how: CivilHow;
  since: string;
  /** How far the country and the world take each side as the rightful government, 0–100. */
  legitimacy: Record<CivilSide, number>;
  /** Governments that recognise the rebels. */
  recognised: string[];
  /** The world body's seat passed to the rebels. */
  seat?: boolean;
  /** Volunteers from abroad, thousands, by the country that sent them and the side they fight on. */
  volunteers?: { from: string; side: CivilSide; men: number }[];
  /** Soldiers, thousands, and provinces that went over since it began. */
  defected?: { rebels: number; government: number; regions: number };
  /** The side the player is on, when the player is in it. */
  player?: CivilSide;
  /** The parties the split outlawed when the player's movement rose (the old government's), with the status each had: party life leaves them be while the war lasts, and a crushed rising restores them alone. */
  outlawed?: { id: string; status: "ruling" | "coalition" }[];
  /** The rebels' share of the country's people, %, when the line last moved much, and since when it has stood. */
  hold?: number;
  still?: string;
  end?: { date: string; turn: number; how: CivilEnd };
  /** Under way on the date the game began (WarSeed.civil). */
  seeded?: boolean;
  /** The share of the people below which a side has lost, for a war begun with a rump smaller than the usual threshold. */
  floor?: number;
}

/** Relations that are not normal between two governments (engine/envoys.ts); a war's closed embassies are the war's own. */
export const ENVOY_STATUSES = ["recalled", "broken"] as const;
export type EnvoyStatus = (typeof ENVOY_STATUSES)[number];
/** The line the player's delegation takes on a resolution about an aggressor. */
export const DELEGATION_VOTES = ["condemn", "oppose", "abstain"] as const;
export type DelegationVote = (typeof DELEGATION_VOTES)[number];

export interface Envoy {
  status: EnvoyStatus;
  since: string;
  /** When the ambassadors come back by themselves: a year after a war ends. */
  until?: string;
  /** Who recalled or broke off. */
  by?: string;
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
  /** Where an attack on a member binds the others (AllianceSeed.area). */
  area?: TreatyArea;
  /** Whether it takes new members (AllianceSeed.open). */
  open?: boolean;
  /** False for a treaty that binds no one (AllianceSeed.binds). */
  binds?: false;
  /** A bloc a plan founded: the country it was founded against; it ends when that threat is gone (engine/intentions.ts). */
  against?: string;
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
  /** How strong its organisation is while it is banned or underground, 0–100: cells, fighters, couriers (engine/partyLife.ts). */
  strength?: number;
  /** A foreign government that funds or arms it, by tag. */
  backer?: string;
  /** How it came about in play, when the engine made it (engine/partyLife.ts): the parties of the start have none. */
  origin?: PartyOrigin;
  /** Made by the engine and not yet named by the game master: its name is a placeholder. */
  unnamed?: boolean;
}

/** The camps of opinion a party may speak for, each a point on the three axes (engine/partyLife.ts). */
export const OPINION_CAMPS = ["communist", "socialist", "agrarian", "liberal", "conservative", "nationalist", "religious", "green"] as const;
export type OpinionCamp = (typeof OPINION_CAMPS)[number];

/** What makes people unhappy enough for a new party to rise (engine/partyLife.ts). */
export const DISCONTENTS = ["unrest", "slump", "war", "scandal", "generation"] as const;
export type Discontent = (typeof DISCONTENTS)[number];

/** How a party the engine made came about: it rose from a camp no party spoke for, or split from another. */
export interface PartyOrigin {
  how: "rose" | "split";
  date: string;
  camp: OpinionCamp;
  /** The party it split from, by name. */
  from?: string;
  /** What it rose from, the strongest first. */
  why?: Discontent[];
}

/** How a party ended: broken by the state, withered away, merged into another, or dissolved as the game master wrote it. */
export const PARTY_ENDS = ["crushed", "faded", "merged", "dissolved"] as const;
export type PartyEnd = (typeof PARTY_ENDS)[number];

/** A party that is no more, for the parties panel's short list and the game master. */
export interface GoneParty {
  id: string;
  name: string;
  short?: string;
  color?: string;
  /** Where it stood when it ended. */
  status: Party["status"];
  how: PartyEnd;
  /** The party it merged into, by name. */
  into?: string;
  date: string;
  turn: number;
  /** Made by the engine and ended before the game master named it: it reads by its origin. */
  unnamed?: boolean;
  origin?: PartyOrigin;
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
  /** A plot inside the cabinet, kept by the engine (engine/intrigue.ts): the turn cannot change it. */
  cabinet?: CabinetPlot;
}

/** Who is behind a plot inside the cabinet, against whom, and what the intelligence service suspects. */
export interface CabinetPlot {
  /** The faction behind it (engine/intrigue.ts factionsOf). */
  faction: string;
  /** Those in it, by name. */
  members: string[];
  /** A minister's post, or the leader. */
  target: OfficialPost | "leader";
  /** Whom it was aimed at when it began: it ends when they go. */
  targetName: string;
  /** What the intelligence service suspects while the plot is not known for certain: a faction, or "" for nobody in particular. */
  rumour?: { faction: string; turn: number };
}

/** What the government can do to its own people between turns (engine/intrigue.ts). */
export const CABINET_MOVES = ["favour", "post", "reshuffle", "dismiss", "investigate", "purge"] as const;
export type CabinetMoveKind = (typeof CABINET_MOVES)[number];
/** What the dice made of a move. */
export const CABINET_RESULTS = ["took", "pocketed", "pleased", "humiliated", "resigned", "quiet", "angry", "found", "nothing", "caught", "escaped"] as const;
export type CabinetResult = (typeof CABINET_RESULTS)[number];

export interface CabinetMove {
  kind: CabinetMoveKind;
  /** The person, by name; for an investigation or a purge, the faction's id. */
  who: string;
  /** The minister the person swapped posts with, in a reshuffle. */
  with?: string;
  result: CabinetResult;
  /** Those a purge caught, by name. */
  names?: string[];
  /** The ministers the move put out of the government, with the posts they held, for the turn's record. */
  removed?: { post: OfficialPost; title: string; name: string }[];
  /** The faction found out it was being watched. */
  noticed?: boolean;
  turn: number;
}

/** A ministry the government created in play (engine/ministries.ts). */
export interface NewMinistry {
  id: NewMinistryId;
  /** In the player's words, in the interface language. */
  name: string;
  /** The name in each language, as the next game master gave it. */
  names?: Localized;
  portfolio: string;
  /** The tasks the government set it, in the player's words (engine/ministries.ts). */
  tasks?: string[];
  since: string;
}

/** The cabinet's shape as the government changed it (engine/ministries.ts); missing while it is the standard eight. */
export interface CabinetShape {
  /** Standard ministries closed, with the date. */
  closed?: { id: AdvisorId; since: string }[];
  created?: NewMinistry[];
  /** Standard ministries renamed by order, in each language (engine/identity.ts). */
  renamed?: Partial<Record<AdvisorId, Localized>>;
  /** The icon the player chose for a ministry (engine/ministries.ts MINISTRY_ICON_KEYS); the usual one when missing. */
  icons?: Partial<Record<AdvisorId, string>>;
  /** The colour the player chose for a ministry's icon, #rrggbb (engine/ministries.ts); the ink when missing. */
  colours?: Partial<Record<AdvisorId, string>>;
  /** What changed since the last turn, for the next game master and the turn's record. */
  changes?: { kind: "closed" | "reopened" | "created"; id: AdvisorId; name?: string; date: string; minister?: { post: OfficialPost; title: string; name: string } }[];
}

/** The government's dealings with its own cabinet since the last turn, for the next game master (engine/intrigue.ts). */
export interface CabinetLog {
  moves: CabinetMove[];
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
  /** A ministry, the ruling party, the movement, a war or a formation renamed by order (engine/acts.ts). */
  renames?: Rename[];
  /** The expected reaction to each part: "name", "color" or "place:<city>". */
  reactions?: Record<string, Reaction>;
}

/** How long an order runs: this turn, a calendar span from the turn's date, or until it is cancelled (engine/orderMeta.ts). */
/** How long an order runs: this turn, a calendar span (older saves), a number of days, or until it is cancelled. */
export type OrderSpan = "turn" | TimeStep | "days" | "always";
/** How pressing an order is, past the ordinary. */
export const ORDER_PRIORITIES = ["high", "urgent"] as const;
export type OrderPriority = (typeof ORDER_PRIORITIES)[number];

/** How one order is carried out, beside its words. */
export interface OrderMeta {
  /** The ministry entrusted with it. */
  to?: AdvisorId;
  /** Ministries it is kept from: their ministers never learn of it. */
  hiddenFrom?: AdvisorId[];
  /** The date it stands until, then lapses; with the span it was set from. */
  until?: string;
  span?: OrderSpan;
  /** The days it runs for, when it was set in days (span "days"). */
  days?: number;
  /** More pressing than the ordinary: important, or urgent above all else. */
  priority?: OrderPriority;
  /** Done quietly: kept from the press, the public and foreign governments. */
  secret?: boolean;
  /** The date it begins on: until the turn that reaches it, it waits and no game master is told of it. */
  from?: string;
}

/** What an order may rename beside the country and its cities. */
export const RENAMABLE = ["ministry", "party", "movement", "war", "formation"] as const;
export type Renamable = (typeof RENAMABLE)[number];

/** One thing renamed by order: "ministry:<id>", "party:<id>", "movement", "war:<id>" or "formation:<its name>". */
export interface Rename {
  target: string;
  what: Renamable;
  /** The new name in each language (wars and ministries keep all three). */
  names: Localized;
  /** The new name in the turn's language, for what keeps one name (a party, the movement, a formation). */
  name: string;
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
  /** No national parliament sits: dissolved in play (its name and the date), or none under the regime (the date only); missing while one sits or none was described. */
  parliamentGone?: { date: string; name?: string };
  /** 0–100. */
  unrest: number;
  nextElection?: string;
  parties: Party[];
  plots: Plot[];
  /** Parties that ended in play, the latest last (engine/partyLife.ts). */
  gone?: GoneParty[];
  lastElection?: { date: string; results: { party: string; share: number; seats?: number }[]; note?: string };
  /** Sittings of parliament the player held on a motion, the latest last (engine/parliament.ts). */
  sessions?: Session[];
  /** Talks the player held with protest leaders and plotters, the latest last (engine/talks.ts). */
  talks?: Talk[];
  /** The families' protest against the mobilisation was dispersed or conceded: it is not raised again before this date (engine/mobilisation.ts). */
  familiesQuiet?: string;
}

/** What a sitting of parliament votes on: a change of one law, a bill or amendment in the player's words, or a motion of state. */
export const MOTION_KINDS = ["law", "bill", "constitution", "confidence", "election", "postpone", "emergency"] as const;
export type MotionKind = (typeof MOTION_KINDS)[number];

export interface Motion {
  kind: MotionKind;
  /** The bill or amendment in the player's words; for a law, what it says beyond the change. */
  text: string;
  /** For a change of law: which law and its new option (engine/laws.ts). */
  law?: string;
  option?: string;
  /** Brought by the player's opposition party, not the government (engine/parliament.ts): the house leans the other way, and on "confidence" it is a motion of no confidence. */
  by?: "opposition";
  /** The party that brought an opposition motion, by id. */
  party?: string;
}

export interface SessionLine {
  speaker: string;
  /** The party the speaker speaks for, by id; none for the chair or an independent. */
  party?: string;
  text: string;
  /** The player's own speech. */
  player?: boolean;
}

export interface SessionVote {
  for: number;
  against: number;
  abstain: number;
  /** The seats the motion needed. */
  need: number;
  parties: { party: string; for: number; against: number; abstain: number }[];
}

/** A sitting of parliament on one motion: the speeches, how they swayed the parties, and the vote. */
export interface Session {
  id: string;
  motion: Motion;
  transcript: SessionLine[];
  /** How far the speeches moved each party, by id, -0.35 to 0.35 (engine/parliament.ts). */
  sway: Record<string, number>;
  status: "open" | "passed" | "failed";
  vote?: SessionVote;
  date: string;
  turn: number;
}

export const TALK_RESULTS = ["deal", "concession", "split", "betrayal", "none"] as const;
export type TalkResult = (typeof TALK_RESULTS)[number];

export interface TalkLine {
  speaker: string;
  text: string;
  player?: boolean;
}

/** Talks with the leaders of a protest at home or with plotters the government knows of. */
export interface Talk {
  id: string;
  with: "protest" | "plot";
  /** The protest's or the plot's id. */
  target: string;
  /** What they are about: the protest's or the plot's title. */
  title: string;
  /** Who speaks for the other side. */
  counterpart: string;
  transcript: TalkLine[];
  status: "open" | "done";
  result?: TalkResult;
  /** What was agreed or what went wrong, for the game master. */
  note?: string;
  date: string;
  turn: number;
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
  /** A special operation, not a plain task: the orders panel lists these; missing before it did. */
  operation?: boolean;
}

/** A minister's view of a turn, one paragraph in their own voice, given once the turn is played. */
export interface MinistryReport {
  ministry: AdvisorId;
  text: string;
  /** Who gave it: the minister then in office; missing in reports from before views. */
  by?: string;
  directives: DirectiveStatus[];
  /** How the minister takes the turn; missing in reports from before ministers had interests. */
  stance?: MinisterStance;
}

/**
 * What a ministry has to report on after a turn, as the turn's game master
 * settled it: the matter, and what became of each directive. The minister
 * gives their view from it afterwards (engine/reports.ts).
 */
export interface MinistryBrief {
  ministry: AdvisorId;
  /** One English sentence, from the game master; empty when only the directives or a question call for a report. */
  matter: string;
  directives: DirectiveStatus[];
  /** The government asked this minister something during the turn. */
  asked?: boolean;
  /** Others had more to say: this minister gives no view unless the government asks (engine/reports.ts). */
  quiet?: boolean;
}

/** Why a minister did nothing of his own in a turn: the government's orders or a directive in his field, its own hand on his lever since the last turn, or "only on my orders". */
export const ROUTINE_HELD = ["orders", "directive", "hand", "toggle"] as const;
export type RoutineHeld = (typeof ROUTINE_HELD)[number];

/** What a minister did on his own in a turn, or why he did not (engine/ministers.ts). */
export interface RoutineAct {
  ministry: AdvisorId;
  /** The minister then in office. */
  by: string;
  /** What he did, by id within his ministry (engine/ministers.ts ROUTINE); missing when he was held to the government's word. */
  act?: string;
  held?: RoutineHeld;
  /** What it was about: a country's tag, a research direction, a weapon, a resource, a protest's title, a person or a ministry. */
  target?: string;
  /** How much, in the act's own unit: $bn, points, months or pieces. */
  amount?: number;
  /** He botched it: what came of it is the bungle's, not the act's. */
  bungled?: boolean;
  /** Disloyal, he served his faction (its id, engine/intrigue.ts) rather than the government. */
  faction?: string;
}

/** The ministers' own work (engine/ministers.ts): who acts only on orders, what the intelligence networks watch, the levers as the last turn left them. */
export interface MinistersState {
  /** Ministries told to act only on the government's orders; the rest act on their own. */
  onOrders?: AdvisorId[];
  /** The country the intelligence service's networks work in. */
  watch?: string;
  /** The research split and the space programme as the last turn left them: a change since is the government's own hand. */
  left?: { research?: Record<ResearchDirection, number>; space?: { share: number; focus: SpaceFocus } };
  /** What the government last set by hand: the ministers' baseline from then on (the deficit as a share of GDP, the split of the industry line). */
  set?: { research?: Record<ResearchDirection, number>; space?: { share: number; focus: SpaceFocus }; deficit?: number; tilt?: number };
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
  /** A session of a bloc the player's order called: the bloc's id. */
  bloc?: string;
}

/** What a world body votes on after an act of aggression: condemnation, sanctions, a call for collective action. */
export const RESOLUTION_KINDS = ["condemn", "sanctions", "action"] as const;
export type ResolutionKind = (typeof RESOLUTION_KINDS)[number];
/** Where it is voted: the Security Council (with the permanent members' veto) or the General Assembly; the League of Nations votes in its Assembly. */
export type Forum = "council" | "assembly";

/** One vote of a world body on an act of aggression. */
export interface Resolution {
  kind: ResolutionKind;
  forum: Forum;
  date: string;
  yes: number;
  no: number;
  abstain: number;
  passed: boolean;
  /** Permanent members whose vote against it vetoed it in the Council. */
  veto?: string[];
}

/**
 * An act of aggression and the world's answer to it (engine/aggression.ts):
 * who attacked whom and how gravely the world judged it, who condemned it,
 * who sends the victim arms, who pledged to defend it or its neighbours, and
 * what the world body of the day resolved.
 */
export interface Aggression {
  /** "g<turn>-<n>". */
  id: string;
  war: string;
  by: string;
  against: string;
  /** The first day of the period the attack came in. */
  date: string;
  /** How gravely the world judged it, 0–3: the era's norm against conquest, the attacker's weight against the victim's, its other attacks within a year. */
  weight: number;
  /** The attacker's attacks on other countries in the year before. */
  repeat: number;
  /** Governments that condemned it, the strongest first. */
  condemned: string[];
  /** Governments that send the victim arms while the war lasts. */
  aid?: string[];
  /** Great powers that pledged to defend a country after it: the victim or its neighbours. */
  pledges?: { by: string; to: string }[];
  /** The world body that took the case up (its bloc id) and what it resolved. */
  body?: string;
  resolutions?: Resolution[];
  /** A resolution vetoed in the Council that waits for the General Assembly (before Uniting for Peace, November 1950). */
  blocked?: ResolutionKind;
  /** The day the case closed: the war ended, the world body's majority would go no further, or a year passed. */
  closed?: string;
}

/** What the state does to a named person (engine/repressions.ts): detention, a show trial, banishment, death. */
export const REPRESSION_MEASURES = ["arrest", "trial", "exile", "execution"] as const;
export type RepressionMeasure = (typeof REPRESSION_MEASURES)[number];
/** Whom a case is aimed at: a minister, a deputy, a party's leader, a protest's leader, a general. */
export const CASE_TARGETS = ["official", "deputy", "party", "protest", "general"] as const;
export type CaseTarget = (typeof CASE_TARGETS)[number];
/** What became of a case: carried out; the target warned and gone abroad; the one told to do it refused; the courts stopped it. */
export const CASE_RESULTS = ["done", "fled", "refused", "blocked"] as const;
export type CaseResult = (typeof CASE_RESULTS)[number];
/** Who ordered it: the player's own government, the leader the player serves, or history's course (the historical mode). */
export const CASE_ORIGINS = ["player", "leader", "history"] as const;
export type CaseOrigin = (typeof CASE_ORIGINS)[number];
/** Mass repressions and mass crimes: a people deported, a purge, mass killings, a famine made by policy. */
export const CRIME_KINDS = ["deportation", "purge", "massacre", "famine"] as const;
export type CrimeKind = (typeof CRIME_KINDS)[number];

/** One person repressed by the state, as the engine decided it (engine/repressions.ts). */
export interface RepressionCase {
  /** "c<turn>-<n>". */
  id: string;
  name: string;
  target: CaseTarget;
  /** What they were: the post's title, the party's or the protest's name. */
  title?: string;
  measure: RepressionMeasure;
  by: CaseOrigin;
  result: CaseResult;
  /** Who carried it out, by name ("" for the police without a chief); the player's own person when they did. */
  executor?: string;
  /** The player carried it out. */
  player?: boolean;
  /** The person's death or prison fed their cause. */
  martyr?: boolean;
  /** Who ruled when it was done: a later leader may rehabilitate the victims. */
  leader?: string;
  date: string;
  turn: number;
  /** The day a later government cleared the person's name. */
  rehabilitated?: string;
}

/** A mass repression or crime, ordered or history's (engine/repressions.ts). */
export interface MassCrime {
  /** "m<turn>-<n>", or "h:<id>" for history's event (scenarios/crimes.ts). */
  id: string;
  kind: CrimeKind;
  /** The government that did it. */
  by: string;
  /** Its victims or its target, in the order's words or history's. */
  who: Text;
  /** Thousands dead; thousands deported; thousands arrested (a purge). */
  toll: number;
  moved?: number;
  held?: number;
  origin: CaseOrigin;
  /** Carried out (and over), still going on (a campaign over months), refused down the chain, stopped by the government. */
  status: "done" | "ongoing" | "refused" | "stopped";
  /** The government ordered it harsher than history's. */
  harsher?: boolean;
  /** Who carried it out, by name; the player's own person when they did. */
  executor?: string;
  player?: boolean;
  since: string;
  turn: number;
  /** Put to a tribunal, at home after a fall or abroad (an international court since 1993). */
  tried?: string;
  /** Condemned by a later government of its own country. */
  condemned?: string;
}

/** The leader's order to the player, a minister of the security services: obey or refuse by the next turn. */
export interface RepressionDemand {
  id: string;
  /** The leader who gave it. */
  by: string;
  /** A person, or history's mass operation (its event id). */
  name: string;
  target?: CaseTarget;
  title?: string;
  measure: RepressionMeasure | CrimeKind;
  /** History's event it carries out. */
  history?: string;
  since: string;
  /** The turn it must be answered by: played without an answer, it was ignored. */
  turn: number;
}

/** The state's repressions and crimes (engine/repressions.ts): kept by the engine, told by the game master. */
export interface Repressions {
  cases?: RepressionCase[];
  crimes?: MassCrime[];
  /** The leader's orders waiting for the player's answer. */
  demands?: RepressionDemand[];
  /** History's events the government stopped or ordered harsher, and those carried out, by id. */
  history?: Record<string, "stopped" | "harsher" | "done" | "moot">;
  /** The security organs' power, 0–100: every case and campaign feeds it, and their chief grows dangerous. */
  power?: number;
  /** Cases and campaigns the player carried out with their own hands: a price a later government may ask. */
  complicity?: number;
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
  /** The front moved on from land `to` took from `from`: it counts as `to`'s until a peace. */
  | { kind: "behind"; region: string; from: string; to: string }
  | { kind: "liberate"; region: string; from: string; to: string }
  | { kind: "contest"; region: string; by: string; holder: string; held?: number; was?: number }
  /** A side driven out of a province, or (settled) a fight there closed by a peace, with no one pushed. */
  | { kind: "repel"; region: string; by: string; holder: string; settled?: boolean }
  | { kind: "new-country"; country: string }
  /** A war begun: by a plan carried out (`plan`), by a colony's rising (`colony`, engine/colonies.ts), or by the game master. */
  | { kind: "war"; war: string; name: Text; sides?: string[]; plan?: string; colony?: string }
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
  /**
   * A party's status changed, it appeared or it ended. The engine's own (engine/partyLife.ts): "crushed" and "faded" end
   * it, "rose" and "split" make one (`camp`; `from`: the party it split from), "merged" folds `from` into `party`, and
   * "named" is the game master's name for one the engine made. `unnamed`: one the engine made ended before it was named, and reads by its camp.
   */
  | { kind: "party"; party: string; change: Party["status"] | "new" | "dissolved" | "crushed" | "faded" | "rose" | "split" | "merged" | "named"; camp?: OpinionCamp; from?: string; unnamed?: boolean }
  | { kind: "election"; winner: string; share: number }
  /** A national election abroad, or the player's put off: `postponed` – not held, the government stays (war on its soil, martial law). */
  | { kind: "vote"; country: string; kept: boolean; date?: string; because?: Because; postponed?: boolean }
  | { kind: "coup"; country: string; succeeded: boolean; because?: Because }
  | { kind: "plot"; title: string; change: "discovered" | "foiled" | "succeeded" | "faded"; cabinet?: Pick<CabinetPlot, "faction" | "target" | "targetName"> }
  | { kind: "exile"; country: string; host?: string }
  | { kind: "return"; country: string }
  /** A government with no land and nobody left to fight for it gives up: it leaves its wars and dissolves (engine/warEnd.ts). */
  | { kind: "capitulation"; country: string; to?: string; why: "alone" | "faded" | "peace" }
  /** A war's side made peace on the winner's terms (engine/warEnd.ts). */
  | { kind: "terms"; war: string; name: Text; by: string; with: string; terms: PeaceTerms }
  /** A government asks the player's for terms; `change` when the request lapses unanswered. */
  | { kind: "offer"; war: string; name: Text; by: string; terms: PeaceTerms; change?: "lapsed" }
  /** A provisional government set up in occupied land, and what became of it (engine/provisional.ts). */
  | { kind: "provisional"; country: string; patron: string; of?: string; change: "set-up" | "independent" | "annexed" | "dissolved"; because?: Because }
  | { kind: "envoy"; country: string; partner?: string; status: "war" | EnvoyStatus | "restored" }
  | { kind: "protest"; title: string; change: Protest["stage"] | "new" | "dispersed" | "conceded" | "faded" | "won" | "gone" }
  | { kind: "overthrown"; how: Defeat["how"]; by: string }
  | { kind: "rise"; how: RiseHow | "cabinet"; name: string }
  /** The player's person falls from a post or a movement (engine/fate.ts). */
  | { kind: "fate"; event: FallHow; role: RoleKind; name: string; cause?: DeathCause }
  /** Which of a minister's or a general's orders the government accepted, by the engine's dice (engine/figures.ts). */
  | { kind: "approval"; accepted: number[]; refused: number[] }
  | { kind: "repression"; event: Repression }
  /** "allied" and "refused": a party the movement offered a coalition to took it up or turned it down, by the engine's dice. */
  | { kind: "movement"; change: "named" | "released" | "allied" | "refused"; name: string }
  /** Which of a minister's or a general's proposals the leader took up, by the engine's dice (engine/remit.ts). */
  | { kind: "proposals"; accepted: string[]; refused: string[] }
  | { kind: "population"; country: string; deaths: number; refugees: number; to?: string; cause: string }
  /** A war's toll on a country's people this period (engine/civilians.ts): thousands dead, the main cause, thousands who fled the fighting. */
  | { kind: "civilians"; country: string; war: string; dead: number; fled: number; cause: CivilCause }
  /** A long mobilisation's strain crossed a line (engine/mobilisation.ts): families demand the men back, strikes, or the strain eased. */
  | { kind: "mobilisation"; country: string; change: "demands" | "strikes" | "eased"; strain: number }
  /**
   * A civil war (engine/civilWar.ts): a country split (`how`); soldiers (`n`, thousands) and provinces (`regions`) went
   * over to a side; a government (`by`) recognised the rebels; volunteers came from `by` (`n`, thousands, on `side`);
   * the world body's seat passed to the rebels; or how it ended.
   */
  | { kind: "civil"; war: string; country: string; rebels: string; change: "split" | "defected" | "recognised" | "volunteers" | "seat" | CivilEnd; how?: CivilHow; by?: string; side?: CivilSide; n?: number; regions?: number }
  | { kind: "sanction"; by: string; against: string; change: "partial" | "full" | "lifted"; plan?: string; because?: Because }
  /**
   * A trade deal of the player's (engine/deals.ts, engine/negotiation.ts): signed (`rounds`: the offers it took),
   * refused (`reason`), lapsed with the partner's counter unanswered, renegotiated, delivered short (`cause`, `by` the
   * side that could not deliver, `share` that arrived), broken, torn up by the player, or run its term.
   */
  | {
      kind: "deal";
      partner: string;
      good: TradeGood;
      side: "sell" | "buy";
      value: number;
      change: "signed" | "rejected" | "broken" | "ended" | "lapsed" | "renegotiated" | "strained" | "cancelled";
      note?: string;
      rounds?: number;
      reason?: DealReason;
      cause?: DealBreach;
      by?: "player" | "partner";
      share?: number;
    }
  | { kind: "funds"; from: string; to: string; amount: number; type: "grant" | "loan" | "aid" | "arms" | "reparations" | "bribe"; note?: string }
  | { kind: "law"; law: LawId; from?: string; to: string }
  | { kind: "bill"; title: string; change: "passed" | "failed"; note?: string }
  | { kind: "order-lapsed"; order: string }
  | { kind: "identity"; what: "name" | "color" | "place" | Renamable; from?: string; to: Text }
  | { kind: "budget"; country: string }
  /** A plan reaches a stage; `because`: what drove it there; `crisis`: the war plan whose crisis it belongs to (talks to defuse it). */
  | { kind: "plan"; plan: string; type: PlanKind; by: string; target?: string; stage: PlanStage; policy?: PolicyKind; lift?: boolean; because?: Because; crisis?: string }
  | { kind: "plan-end"; plan: string; type: PlanKind; by: string; target?: string; how: "failed" | "faded"; why: PlanEnd; policy?: PolicyKind; lift?: boolean; because?: Because; crisis?: string }
  /** A government adopts a policy at home (engine/policies.ts). */
  | { kind: "policy"; country: string; policy: PolicyKind; plan?: string }
  /** Talks between two governments end in an accord: tension eases (engine/policies.ts); `crisis`: the war plan the accord defused. */
  | { kind: "accord"; by: string; with: string; plan?: string; pact?: string; crisis?: string }
  /** An incident between two states, and the answer it drew (engine/incidents.ts); `plan`: the plan it led to. */
  | { kind: "incident"; id: string; by: string; target: string; what: IncidentKind; why: IncidentCause; answer: IncidentAnswer; plan?: string }
  /** Governments condemn an attack on a third country, the strongest first (engine/aggression.ts); `n`: how many in all. */
  | { kind: "outcry"; by: string; against: string; war: string; case: string; countries: string[]; n: number }
  /** A world body meets in emergency session over an act of aggression. */
  | { kind: "session"; body: string; by: string; against: string; war: string; case: string }
  /** A world body's vote on it; `expelled`: the League expels the aggressor. */
  | { kind: "resolution"; body: string; by: string; against: string; war: string; case: string; resolution: ResolutionKind; forum: Forum; passed: boolean; yes: number; no: number; abstain: number; veto?: string[]; expelled?: boolean }
  /** A government begins to send arms to the victim of an aggression. */
  | { kind: "aid"; by: string; to: string; war: string; case: string }
  /** A great power pledges to defend a country after an aggression next to it, or against it. */
  | { kind: "pledge"; by: string; to: string; against: string; case: string }
  // A breakthrough ("done", `ahead`: years before history), a direction's setback, lucky turn or share shifted (`shift` points); "started" and "stopped" are old projects in old saves.
  | { kind: "research"; project: string; change: "started" | "stopped" | "done" | "setback" | "lucky" | "focus"; shift?: number; ahead?: number }
  | { kind: "captured"; by: string; from: string; arms: WeaponKind; n: number }
  /**
   * Sport (engine/sport.ts): a host chosen (`hosts`, `city`, `bids`), a host that lost its Games (`from`, `why`),
   * Games cancelled (`why`), countries that boycotted them (`countries`), a ban (`by` in `why`) and its end, a call
   * for a ban the world refused, the Games held (the medal table's leader, the player's place and medals) and a World
   * Cup's final.
   */
  | {
      kind: "sport";
      games?: string;
      change: "awarded" | "replaced" | "cancelled" | "boycott" | "ban" | "unban" | "refused" | "held" | "final";
      hosts?: string[];
      city?: Localized;
      bids?: string[];
      from?: string[];
      why?: HostLoss | "war" | "host" | SportBan["by"];
      countries?: string[];
      leader?: string;
      gold?: number;
      rank?: number;
      medals?: number;
      winner?: string;
      runnerUp?: string;
      score?: [number, number];
      penalties?: boolean;
    }
  /**
   * The space race (engine/space.ts): a feat made (`first`: the first in the world; `ahead`: years before history), a
   * launch lost, a launch site ordered or opened, or one that passed to another holder with its province (`from`).
   */
  | { kind: "space"; country: string; change: "done" | "failed" | "site" | "captured"; milestone?: SpaceMilestone; first?: boolean; ahead?: number; site?: string; from?: string }
  /**
   * A colony on its way (engine/colonies.ts): `country` the state it becomes (or joins), `of` its metropole, `name` the
   * colony's own; `how` for an independence, `war` and `movement` for a rising, `bloc` the community it joined.
   */
  | { kind: "colony"; colony: string; country: string; of: string; name: Localized; change: ColonyChange; how?: ColonyHow; war?: string; movement?: string; bloc?: string; leader?: string; due?: string }
  /**
   * Electricity (engine/energy.ts): plants that came on line or were begun (`gw` of a `source`), plants lost to the war
   * (`gw`), a shortage that began (`share` of demand unmet) or ended.
   */
  | { kind: "energy"; country: string; change: "built" | "begun" | "lost" | "shortage" | "restored"; source?: EnergySource; gw?: number; share?: number }
  /**
   * The atom (engine/atom.ts): a stage of a programme reached (`first`: the first in the world; `ahead`: years before
   * history), a programme begun or given up, and a nuclear strike (`n` warheads on `province` of `against`, `deaths` in
   * thousands; `answer`: in kind, to a strike; `tactical`: on a military target at the front). A computer government's
   * escalation ladder (engine/nuclear.ts): `ladder` a rung reached in `war` against `against` (`step` 1–3: threats, a
   * raised alert, a demonstration – `demo` a test or a warning shot at sea), or `down` a rung climbed down (`step` 0:
   * its forces stood down).
   */
  | {
      kind: "atom";
      country: string;
      change: "stage" | "begun" | "ended" | "strike" | "ladder";
      stage?: AtomStage;
      first?: boolean;
      ahead?: number;
      against?: string;
      province?: string;
      n?: number;
      deaths?: number;
      answer?: boolean;
      tactical?: boolean;
      step?: number;
      war?: string;
      demo?: "test" | "sea";
      down?: boolean;
    }
  | { kind: "parliament"; change: "dissolved" | "convened"; name: string }
  | { kind: "ministry"; change: "closed" | "reopened" | "created"; id: AdvisorId; name?: string }
  | { kind: "official"; post: OfficialPost; title: string; name: string; change: "appointed" | "resigned" | "dismissed" | "died" | "arrested" | "fled" | "retitled"; /** The title the post had before it was renamed. */ from?: string }
  | { kind: "intrigue"; post: OfficialPost; deputy: string; target: string; goal: IntrigueGoal; event: "done" | "exposed" }
  /** A faction of the cabinet leaked to the press, an operation of its ministries with it; or a person's loyalty moved a step (engine/intrigue.ts). */
  | { kind: "cabinet"; event: "leak"; faction: string; by: string; operation?: string }
  | { kind: "cabinet"; event: "loyalty"; name: string; from: number; to: number }
  /** A person repressed by the state, or cleared by a later government (engine/repressions.ts). */
  | { kind: "case"; name: string; target: CaseTarget; title?: string; measure: RepressionMeasure; result: CaseResult | "rehabilitated"; by: CaseOrigin; martyr?: boolean; player?: boolean }
  /** A mass repression or crime and its toll (thousands), or what came of it later: a tribunal, an indictment abroad, a later government's condemnation. */
  | { kind: "crime"; crime: CrimeKind; by: string; who: Text; toll: number; moved?: number; held?: number; result: "done" | "ongoing" | "refused" | "stopped" | "tried" | "indicted" | "condemned"; origin: CaseOrigin; harsher?: boolean; condemned?: string[] }
  /** The leader orders the player, a minister of the security services, to repress someone; or how the player answered. */
  | { kind: "demand"; name: string; measure: RepressionMeasure | CrimeKind; by: string; history?: string; answer?: "obeyed" | "refused" | "ignored" }
  /**
   * A joint action with allies (engine/joint.ts): agreed or begun, offered to the player, turned down, carried out (an
   * offensive fought: `km` gained; a note answered: `yielded`), built (`gdp`: its yield to each member), or broken off.
   */
  | { kind: "joint"; id: string; type: JointKind; by?: string; members: string[]; change: "begun" | "offered" | "refused" | "done" | "built" | "ended"; target?: string; project?: ProjectKind; direction?: ResearchDirection; name?: Localized; reason?: JointReason; km?: number; yielded?: boolean; gdp?: number };

export type Verdict = "success" | "partial" | "failed";

/** The game master's judgement of one order. */
export interface OrderVerdict {
  /** 1-based position in the turn's orders. */
  n: number;
  result: Verdict;
  note: string;
  /** The ministry that carried it out, when the game master named one. */
  by?: AdvisorId;
  /** That ministry dragged its feet (engine/intrigue.ts): the engine marked the order down. */
  obstructed?: boolean;
}

export interface ChronicleEntry {
  turn: number;
  from: string;
  to: string;
  orders: string[];
  /** How the turn's orders were to be carried out, by the order's text: what was kept from whom stays known. */
  orderMeta?: Record<string, OrderMeta>;
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
  /** What each minister did on his own this turn (engine/ministers.ts); missing before ministers worked every turn. */
  routine?: RoutineAct[];
  /** The player's economy before and after the turn, for the report. */
  economy?: { before: EconomyFigures; after: EconomyFigures };
  /** The provinces whose holder or front the turn changed, as they stood before it (engine/history.ts). */
  borders?: Record<string, RegionBorder>;
  /** How each of the player's formations fought the turn, and what became of the orders to them (engine/formations.ts). */
  sectors?: SectorTurn[];
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
  /** The role the player wrote in when not as the government: the movement's contacts abroad, a minister's own letters (engine/exile.ts). */
  as?: RoleKind;
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
  /** The start chosen on the date's card (a week before it); the date's own day when missing, as every game before the choice. */
  variant?: StartVariant;
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
  /** How the drafted and standing orders are carried out, by the order's text (engine/orderMeta.ts). */
  orderMeta?: Record<string, OrderMeta>;
  /** The player's orders to his formations for the coming turn (engine/formations.ts): the general staff decides how they are carried out. */
  armyOrders?: ArmyOrder[];
  /** The player's invitations to found a bloc, waiting for answers. */
  proposals?: Proposal[];
  /** The player's domestic politics, once the game master has described them. */
  politics?: Politics;
  /** Protests, strikes and riots against the player's government. */
  protests?: Protest[];
  /** Relations that are not normal, by pair "a|b" in alphabetical order (engine/envoys.ts); missing when all are. */
  envoys?: Record<string, Envoy>;
  /** How the player's delegation votes on the world body's resolutions about each aggressor, as the orders set it (engine/envoys.ts). */
  delegation?: Record<string, DelegationVote>;
  /** Aggressors on whose case the player's leader attends the world body's session in person this turn (engine/envoys.ts). */
  delegationInPerson?: string[];
  /** Set when the player's government has been overthrown. */
  defeat?: Defeat;
  /** The people of the player's government, once the game master has named them. */
  officials?: Official[];
  /** The ministries' deputies, named when the player first asks after a ministry's people (engine/deputies.ts). */
  deputies?: Deputy[];
  /** The government's private conversations with deputies, by deputy id. */
  deputyAdvice?: Record<string, AdviceMessage[]>;
  /** Short biographies of the leader and ministers, by person (engine/bios.ts) and language. */
  bios?: Record<string, Partial<Record<Locale, string>>>;
  /** How people speak, by person (engine/speech.ts) and language: written once, for those who speak. */
  speechProfiles?: Record<string, Partial<Record<Locale, SpeechProfile>>>;
  /** The government's own plots inside its ministries, deputies against their chiefs. */
  intrigues?: Intrigue[];
  /** The government's moves in its own cabinet since the last turn: favours, reshuffles, purges (engine/intrigue.ts). */
  cabinet?: CabinetLog;
  /** Ministries closed, reopened and created by the government (engine/ministries.ts). */
  cabinetShape?: CabinetShape;
  /** The emblem the player chose for a party, by party id (engine/partyEmblems.ts); the others wear their camp's. */
  partyEmblems?: Record<string, PartyEmblemKey>;
  /** A picture the player brought for a party, painted in oil in the browser, as a small data URL (engine/partyEmblems.ts); it takes the emblem's place. */
  partyImages?: Record<string, string>;
  /** The colour the player chose for a party, #rrggbb, by party id (engine/partyEmblems.ts); the others keep the press's. */
  partyColours?: Record<string, string>;
  /** A photograph the player brought for a person – the leader – painted in oil in the browser, by the person's id and name (engine/partyEmblems.ts). */
  portraitImages?: Record<string, string>;
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
  /** The budget the player set since the last turn. */
  budgetSet?: BudgetDecision;
  /** Standing tasks of the ministries. */
  directives?: Directive[];
  /** The ministers' own work every turn: who acts only on orders, and what they keep track of (engine/ministers.ts); missing until the first turn they work. */
  ministers?: MinistersState;
  summits?: Summit[];
  /** The plans of other governments, live and lately ended (engine/intentions.ts). */
  plans?: Plan[];
  /** Acts of aggression and the world's answer to each, open and lately closed (engine/aggression.ts); missing in saves from before step 33. */
  aggressions?: Aggression[];
  /** The colonies on their way to independence, and those already free (engine/colonies.ts); read from the map on the first turn they are missing (save step 45). */
  colonies?: Colony[];
  /** Fog of war: other countries are shown as the player's government knows them (engine/fog.ts). On for a new game, off for one begun before it. */
  fog?: boolean;
  /** The player's research projects (engine/research.ts). */
  research?: Research;
  /** The space race: every country's programme and the launch sites built in play (engine/space.ts); missing in saves from before step 39. */
  space?: SpaceState;
  /** The Olympic Games and the World Cup: the calendar, hosts and votes, results, bans and boycotts (engine/sport.ts); missing in saves from before step 43. */
  sport?: SportState;
  /** Every country's power plants and the electricity they give (engine/energy.ts); missing in saves from before step 47 until it runs. */
  energy?: Record<string, PowerBook>;
  /** Every atomic programme, the arsenals and the strikes made (engine/atom.ts); missing in saves from before step 47 until it runs. */
  atom?: AtomState;
  /** Who the player is: the country's leader (when missing), the leader of its opposition, a minister or a general (engine/role.ts, engine/figures.ts). */
  role?: PlayerRole;
  /** What the turns did to each country's people that its figures today do not show, by country (engine/society.ts); missing in saves from before step 31. */
  society?: Record<string, SocietyTrack>;
  /** Repressions and mass crimes the engine carried out, the leader's orders to the player, history's course and the security organs' power (engine/repressions.ts); missing until the first. */
  repressions?: Repressions;
  /** Joint actions with allies, the player's and those abroad: proposed, under way and lately ended (engine/joint.ts); missing in saves from before step 52 and until the first. */
  joint?: JointAction[];
  /** Civil wars, live and lately ended (engine/civilWar.ts); missing until the first. */
  civilWars?: CivilWar[];
}

/** A society's headline figures, kept as they were when its record began: shares in %, men aged 20–34 in thousands. */
export interface SocietyFigures {
  poor: number;
  rich: number;
  urban: number;
  literate: number;
  farm: number;
  industry: number;
  /** Under 15, %. */
  young: number;
  men: number;
}

/** What the game left on a country's people that its figures today do not show (engine/society.ts). */
export interface SocietyTrack {
  /** The player's country: its figures when the record began, the trend arrows' base. */
  start?: SocietyFigures;
  /** The player's country: real income per head the poverty line is anchored to, dollars of 2019 a year; it follows incomes over a generation. */
  anchor?: number;
  /** Points of farm and industry workers, townspeople and the literate that programmes, budgets and war moved beyond the drift with income. */
  shift?: Partial<Record<"farm" | "industry" | "urban" | "literate", number>>;
  /** People missing from each five-year age band (0–4 … 80+), thousands, men and women: killed in war or never born; `aged`, years since the bands last moved up one (they move every five). The old record, before a country's cohorts were kept. */
  gap?: { m: number[]; f: number[]; aged?: number };
  /**
   * The country's cohorts as the game made them, % of its people (engine/society.ts): men and women in each five-year
   * cohort as it stood at the last five-year step, `born` those born since, `aged` years since that step.
   */
  ages?: { m: number[]; f: number[]; born: [number, number]; aged: number };
  /**
   * What its births and deaths are read by, fitted on the history its record opened with: births per woman of 15–49 a
   * year per point of the fertility index, the span of life per point of the life index, men's span against women's,
   * the natural increase that history had, a share a year, and how far the land has come from the traditional family
   * (0–0.95, it does not go back).
   */
  vital?: { fert: number; life: number; men: number; ni0: number; dev: number };
  /** Its natural increase now against that history's, points a year: what the game's births and deaths add to the map's pace (engine/population.ts). */
  drift?: number;
  /** The player's country: how its society moved, a point a turn, thinned as it grows (engine/societyRecord.ts); from the first turn after step 50. */
  record?: SocietyPoint[];
  /** The player's country: its age pyramid when the record opened, men and women in each five-year band, % of the people. */
  first?: { m: number[]; f: number[] };
  /** The player's country: each class's share, mood and what it wants most, as the last turn left them (engine/classes.ts). */
  classes?: Partial<Record<SocialClass, ClassMood>>;
}

/** The classes of the people (engine/classes.ts): named by the era and the system, the same five. */
export const SOCIAL_CLASSES = ["workers", "peasants", "middle", "intelligentsia", "elites"] as const;
export type SocialClass = (typeof SOCIAL_CLASSES)[number];

/** What a class wants most: what hurts it most now, or its standing wish when nothing does. */
export const CLASS_WANTS = ["jobs", "wages", "prices", "goods", "bread", "welfare", "taxes", "peace", "freedom", "land", "order", "growth", "stability"] as const;
export type ClassWant = (typeof CLASS_WANTS)[number];

/** A class as the last turn left it: its share of the adults, %, its mood (0 angry – 50 neither – 100 content) and its want. */
export interface ClassMood {
  share: number;
  mood: number;
  want: ClassWant;
}

/**
 * A turn of the player's society, for the society tab's charts (engine/societyRecord.ts): levels at the turn's end and
 * what the turn cost. A point that stands for several turns once the record is thinned keeps the last one's levels and
 * the sum of their flows.
 */
export interface SocietyPoint {
  /** The date the turn ended. */
  d: string;
  /** People, thousands. */
  p: number;
  /** Births and deaths a year per thousand people. */
  b: number;
  m: number;
  /** Life expectancy at birth, years. */
  e: number;
  /** Literate and townspeople, %. */
  lit: number;
  urb: number;
  /** Real income per head, dollars of 2019 a year; inequality (Gini, 0–100); poor and rich, %. */
  inc: number;
  gini: number;
  poor: number;
  rich: number;
  /** Jobless, % of the workforce. */
  job: number;
  /** The people's provision overall and medicine, % of need. */
  pro: number;
  med: number;
  /** Heavy industry's share of industrial output, %. */
  hv: number;
  /** The classes' moods, in SOCIAL_CLASSES order. */
  mood?: number[];
  /** Over the turn, thousands: refugees who left and who came, people deported, soldiers killed, civilians dead, the dead of the state's crimes. */
  out?: number;
  in?: number;
  dep?: number;
  war?: number;
  civ?: number;
  crime?: number;
}

/** What a save list shows without loading the whole state. */
export interface SaveMeta {
  id: string;
  title?: string;
  scenarioId: ScenarioId;
  variant?: StartVariant;
  player: string;
  playerName: Text;
  date: string;
  turn: number;
  updatedAt: string;
}

export const TERRAINS = ["plains", "forest", "hills", "mountains", "desert", "tundra", "jungle", "wetlands"] as const;
export type Terrain = (typeof TERRAINS)[number];

export type TradeGood = "grain" | "oil" | "gas" | "coal" | "metals" | "uranium" | "arms";

/** What one side of a deal grants the other besides the goods and the money (engine/negotiation.ts). */
export const DEAL_CONDITIONS = ["recognition", "votes", "base", "alliance", "technology", "exclusivity"] as const;
export type DealConditionKind = (typeof DEAL_CONDITIONS)[number];
export interface DealCondition {
  kind: DealConditionKind;
  /** Who grants it: the player's government or the partner's. */
  by: "player" | "partner";
}

/** How the buyer pays: in money (the default), in a good of its own, or on credit (all of it once the deal has run). */
export const DEAL_PAYMENTS = ["money", "goods", "credit"] as const;
export type DealPayment = (typeof DEAL_PAYMENTS)[number];

/** Why a government takes a deal the way it does (engine/negotiation.ts). */
export const DEAL_REASONS = ["need", "spare", "ties", "alternatives", "noNeed", "nothingSpare", "distrust", "rival", "sanctions", "war", "tension", "claims", "reputation", "price", "volume", "length", "payment", "conditions", "impossible", "patience", "fair", "signed", "relations"] as const;
export type DealReason = (typeof DEAL_REASONS)[number];

/** What cuts a deal's deliveries short. */
export const DEAL_BREACHES = ["blockade", "sanctions", "war", "shortage"] as const;
export type DealBreach = (typeof DEAL_BREACHES)[number];

/** The terms of a trade deal, agreed or on the table. */
export interface DealTerms {
  /** $bn a year. */
  value: number;
  /** Price against the market, %. */
  premium: number;
  years: number;
  /** Money when missing. */
  pay?: DealPayment;
  /** Paid in goods: the good the buyer pays with. */
  payGood?: TradeGood;
  conditions?: DealCondition[];
}

/** One offer in a negotiation, and how the other side took it. */
export interface DealRound {
  by: "player" | "partner";
  terms: DealTerms;
  /** The partner's answer to the player's offer; the partner's own offers have none. */
  answer?: "accepted" | "countered" | "refused";
  /** Why the partner answered so, or what its counter moved. */
  reason?: DealReason;
  turn: number;
}

/** A contract of the player's government to sell or buy a good (engine/deals.ts); its talks are in engine/negotiation.ts. */
export interface TradeDeal extends DealTerms {
  id: string;
  partner: string;
  good: TradeGood;
  /** The player sells to the partner, or buys from it. */
  side: "sell" | "buy";
  since: string;
  until: string;
  /** "proposed": on the table, the talks still open. */
  status: "active" | "proposed" | "declined" | "ended" | "broken";
  /** Signed from the market's offers, or proposed by the player. */
  origin: "offer" | "player";
  /** The turn it was signed, proposed or turned down. */
  turn: number;
  note?: string;
  /** The offers each side made, oldest first: the talks that made the deal, or the talks under way. */
  rounds?: DealRound[];
  /** A deal in force the player has reopened: the terms on the table are the last round's; the deal stands as it was meanwhile. */
  talking?: boolean;
  /** Delivered short last turn: by what, the side that could not deliver, the share that arrived, and for how many turns running. */
  strain?: { cause: DealBreach; by: "player" | "partner"; share: number; turns: number };
  /** On credit: what the buyer owes the seller so far, $bn, paid when the deal has run its term. */
  owed?: number;
  /** The alliance the deal's terms founded; it ends with the deal. */
  alliance?: string;
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
  /** On a finer map (engine/refine.ts): the standard map's province this one lies in, where its id differs. */
  was?: string;
}

/** Map data the prompt and the engine look provinces up in. */
export interface MapIndex {
  regions: Record<string, MapRegion>;
  neighbors: Record<string, string[]>;
  /** The points of each coastal province's shore (engine/provinces.ts seaGapKm); missing for an index built by hand. */
  coasts?: Record<string, [number, number][]>;
  /** The towns of a province, biggest first (engine/towns.ts); where the server has loaded them. */
  towns?: (province: string) => Town[];
}

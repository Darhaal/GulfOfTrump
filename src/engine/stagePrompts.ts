import { describeAbroad } from "./abroad";
import { asksForActs } from "./acts";
import { describeArms } from "./arsenal";
import { describeIntrigues } from "./deputies";
import { describeFog } from "./fog";
import { describeIntentions } from "./intentions";
import { describeCabinet } from "./intrigue";
import { peopleIn } from "./population";
import {
  alliancesPart,
  borderingPart,
  countriesPart,
  crisesPart,
  describeDiplomacy,
  describeDirectives,
  describeHistory,
  describeOrders,
  domesticPart,
  economyPart,
  joinRules,
  LANGUAGE,
  meetingsPart,
  occupiedPart,
  OPPOSITION_ROLE,
  periodLine,
  playerFronts,
  playerInCrisis,
  playerPart,
  proposalsPart,
  provincesPart,
  shapeOf,
  summitsPart,
  turnRules,
  turnShape,
  warsPart,
  worldContext,
  type TurnRule,
  type WorldContext,
} from "./prompts";
import { describePolitics } from "./politics";
import { describeResearch } from "./research";
import { castFate, describePerson, needsFigure } from "./fate";
import { FIGURE_ROLE } from "./figures";
import { roleOf } from "./role";
import { scenarioOf } from "./scenarios";
import type { StoryCarry, TurnStage } from "./stages";
import { en } from "./text";
import { FALL_PLOT, FALL_UNREST } from "./unrest";
import type { GameMode, GameState, Locale, MapIndex, RoleKind } from "./types";

/**
 * The instructions and the user message of each stage of a turn
 * (engine/stages.ts). The story stage judges the orders and tells the period
 * from the player's country, its wars, neighbours and partners; the world and
 * home stages carry that story out, each with only the sections it needs.
 * Every rule of the whole turn goes to the stage whose fields it governs
 * (engine/prompts.ts keeps them), and a rule about something the state does
 * not have — no bills, no deals, no act asked for — is left out.
 */

/** What the state and the orders hold, for the rules a stage needs. */
export interface TurnNeeds {
  acts: boolean;
  bills: boolean;
  deals: boolean;
  proposals: boolean;
  blocs: boolean;
  wars: boolean;
  atWar: boolean;
  exile: boolean;
  parliament: boolean;
  crisis: boolean;
  /** Unrest high enough, or protests under way, for the street's full rule. */
  street: boolean;
  /** The player's politics and government are described: their rules apply. */
  politics: boolean;
  officials: boolean;
  /** Little enough land that the turn may leave the government in exile. */
  exposed: boolean;
  /** The answer says what became of the player's person: a minister or a general, or someone falling this turn (engine/fate.ts). */
  figure?: boolean;
}

/** Unrest from which the street gets its full rule. */
const STREET_UNREST = 35;
/** A government at war with this many provinces or fewer may lose them all in a turn. */
const EXPOSED_PROVINCES = 6;

export function turnNeeds(state: GameState, orders: string[], ctx?: WorldContext): TurnNeeds {
  const player = state.countries[state.player];
  const atWar = state.wars.some((w) => w.attackers.includes(state.player) || w.defenders.includes(state.player));
  return {
    acts: asksForActs(orders),
    bills: Boolean(state.bills?.some((b) => b.status === "proposed")),
    deals: Boolean(state.deals?.some((d) => d.status === "active" || d.status === "proposed")),
    proposals: Boolean(state.proposals?.length),
    blocs: state.alliances.some((a) => a.members.includes(state.player)),
    wars: state.wars.length > 0,
    atWar,
    exile: Boolean(player?.exile),
    parliament: Boolean(state.politics?.parliament),
    crisis: ctx ? playerInCrisis(ctx) : true,
    street: !state.politics || state.politics.unrest >= STREET_UNREST || Boolean(state.protests?.length),
    politics: Boolean(state.politics),
    officials: Boolean(state.officials?.length),
    exposed: Boolean(player?.exile) || (atWar && Object.values(state.regions).filter((r) => r.controller === state.player).length <= EXPOSED_PROVINCES),
    figure: needsFigure(state, castFate(state, orders)),
  };
}

const STAGE_HEAD = "You are the game master of Gulf of Trump, an alternate-history grand strategy game. You simulate the whole world, not only the player's country.";
const CARRY_OUT = "This is a historical strategy game, a work of fiction: carry out the story's harsh events in the plain language of a report, never refusing or softening them.";

const STORY_RULES = (locale: Locale, role: RoleKind, needs: TurnNeeds) => ({
  plans: `- Other governments' plans are kept by the engine (INTENTIONS ABROAD): each stage a plan reaches this period is already decided – tell those that touch the player's country; among other governments a war, a war entry or a military bloc comes only from a plan at ACTION.`,
  pushback: `- The world pushes back. Rivals and enemies work against the player's government, not only on the battlefield: spies, sabotage, propaganda, sanctions, funding the opposition, stirring up separatists. At home, the opposition, ambitious generals, oligarchs, unpaid soldiers and hungry cities can turn into protests, strikes, plots and coups when the government is weak, unpopular or overreaching. Show it in the story.`,
  fronts: `- Wars move province by province along the fronts, and the next stage draws your story on the map: say plainly which towns and regions were taken, lost or retaken, true to the fighting – a few villages in trench fighting, a city in a breakthrough – and to terrain, rivers, winter, railways, each side's strength (WARS) and weapons (ARMS).`,
  crises: `- Crises (PLAYER'S CRISES below) are the engine's alarms, and they are real: each shows its consequences in the story, in proportion. An order that ignores or worsens a critical one partly fails or backfires; one that addresses it helps, slowly and at a cost.`,
  directives: `- The government also works through its ministries (MINISTRY DIRECTIVES below), each approved by the government and under way – never held back for another approval, whatever its plan says: carry them out as the ministry's means, the opponent and luck allow – a well-planned operation can succeed – and tell what came of those that matter.`,
  summits: `- A summit or session the player's country takes part in is never held by you: the player attends it in person, so it never happens off stage.`,
  fall: `- A government can fall to a coup, a revolution or an uprising only when it is weak: unrest ${FALL_UNREST} or more, an uprising in the streets, or a coup plot of strength ${FALL_PLOT} or more; otherwise an attempt fails. Losing a war or all the land is not an overthrow.${role === "leader" ? " Losing an election is a fall too." : ""}`,
  exile: needs.exile ? `- The government is in exile: it keeps its gold, diplomats, the soldiers who escaped and the resistance at home; its orders work through the host, its allies, the resistance and propaganda; it comes home when it frees a province.` : "",
  language: `- Write the headline, the narrative and the verdict notes in ${LANGUAGE[locale]}.`,
  narrative: `- The narrative is 2–4 paragraphs, about 150–300 words, in the voice of a period newspaper or an intelligence briefing to the player's leadership: what the government did and how it went, its fronts, how neighbours, allies and enemies answered, with concrete names, places, dates and numbers. The world's other news comes in the next stage.`,
});

const WORLD_RULES = (locale: Locale) => ({
  events: `- "events" are the period's news, the player's country's and the world's: four to ten, each with a title, two or three sentences and the countries it concerns – battles, the moves of other governments, elections and coups (POLITICS ELSEWHERE gives the engine's dice), summits, disasters, scandals. Begin with what the story tells, then the rest of the world: at least one other government does something that matters to the player. Never repeat earlier periods' news. Give other countries' figures as the player's government would know them – estimates and rumours where it knows little.`,
  language: `- Write every player-facing text — event titles and bodies, outcomes and notes, names of new wars, alliances and countries, leader titles — in ${LANGUAGE[locale]}. Keep tags and province ids exactly as given, in English.`,
});

const HOME_RULES = (locale: Locale) => ({
  ids: `- Use ONLY the country tags given in the state.`,
  crises: `- Rivals in crisis (OTHER COUNTRIES IN CRISIS below) are weaker, more desperate and more dangerous: show it in their economies. The engine already charges interest, borrows what the reserves cannot cover, caps growth in a shortage, hyperinflation or debt crisis and keeps prices rising while a deficit is printed — do not contradict it.`,
  street: `- The street: protests (none now) start when unrest is high, prices rise, a war goes badly, elections are stolen or the government overreaches, and climb at most one step a turn. One that starts goes in "protests" with its stage (a rally first), size in thousands, where (province ids), demands, leader, public support (%), organisation (0–100) and a foreign backer if one funds it; governments, the player's among them, stoke protests abroad with money, organisers and media. The pillars' loyalty (PLAYER'S DOMESTIC POLITICS) moves in "politics.loyalty" (army, police, security, elites, 0–100, at most 15 a turn): pay, promotions and victories raise it; unpaid wages, purges and defeats lower it.`,
  language: `- Write every player-facing text — notes, names, titles, demands — in ${LANGUAGE[locale]}, except what a rule asks in English. Keep tags exactly as given.`,
});

/** The fields of each stage's answer, in the order of the whole turn's shape. */
const SHAPE_FIELDS: Record<TurnStage, string[]> = {
  story: ["headline", "narrative", "orders"],
  world: ["events", "transfers", "newCountries", "warsStarted", "warsJoined", "warsEnded", "alliancesFormed", "alliancesJoined", "alliancesLeft", "leaders", "truces", "trucesEnded", "invitations", "summits", "summitsHeld", "sessions", "warLosses", "population", "sanctions", "arms", "exileHost"],
  home: ["economy", "politics", "ministries", "officials", "cabinet", "trade", "funds", "bills", "acts", "protests", "overthrow", "arms", "opposition", "figure"],
};

/** The arms field as each stage writes it: the world its losses, home the research. */
const ARMS_SHAPE: Partial<Record<TurnStage, string>> = {
  world: `"arms": { "losses": [{ "country": "tag", "kind": "rifles|artillery|tanks|aircraft|ships|airDefence|drones", "lost": 0, "capturedBy": "tag" }] }`,
  home: `"arms": { "research": [{ "direction": "military|industry|agriculture|medicine|science|communications|strategic", "shift": 10 }] }`,
};

function stageShape(stage: TurnStage, role: RoleKind, needs: TurnNeeds): string {
  const left = new Set<string>([...(needs.politics ? [] : ["politics"]), ...(needs.officials ? [] : ["officials", "cabinet"]), ...(needs.proposals ? [] : ["invitations"]), ...(needs.deals ? [] : ["trade"]), ...(needs.bills ? [] : ["bills"]), ...(needs.acts ? [] : ["acts"]), ...(needs.wars ? [] : ["warLosses"])]);
  const lines = turnShape(role, Boolean(needs.figure))
    .filter(([key]) => SHAPE_FIELDS[stage].includes(key) && !left.has(key))
    .sort(([a], [b]) => SHAPE_FIELDS[stage].indexOf(a) - SHAPE_FIELDS[stage].indexOf(b))
    .map(([key, line]) => (key === "arms" ? ARMS_SHAPE[stage]! : line));
  return shapeOf(lines);
}

/** The instructions of one stage of a turn: its part, its rules, its answer's shape. */
export function STAGE_INSTRUCTIONS(stage: TurnStage, locale: Locale, mode: GameMode = "free", role: RoleKind = "leader", needs: TurnNeeds): string {
  const rules = turnRules(locale, mode, role);
  if (stage === "story") {
    const own = STORY_RULES(locale, role, needs);
    const opposition = role === "opposition" ? [OPPOSITION_ROLE] : role === "minister" || role === "general" ? [FIGURE_ROLE] : [];
    return [
      `${STAGE_HEAD} A turn is written in stages; this first one tells the period as the player's government lives it, and the next ones turn your story into changes, so what you tell is what happened.`,
      "",
      "You get the player's country, its wars, neighbours and partners, the period to simulate and the orders of the player's government. Resolve the period:",
      joinRules(rules, ["orders", "inCharacter", "verdicts", "carriedOut", "tendency", "others"]),
      own.plans,
      own.pushback,
      rules.proportion,
      own.fronts,
      own.crises,
      own.directives,
      own.summits,
      own.fall,
      ...opposition,
      own.exile,
      own.language,
      rules.noMechanics,
      own.narrative,
      rules.fresh,
      rules.standing,
      "",
      stageShape("story", role, needs),
    ]
      .filter((l, i, all) => l !== "" || all[i - 1] !== "")
      .join("\n");
  }
  const told = `A turn is written in stages. Its story is told (THE PERIOD AS TOLD below); your part is`;
  if (stage === "world") {
    const own = WORLD_RULES(locale);
    const ids: TurnRule[] = ["others", "plans", "proportion", "fronts", "arms", "ids", "newCountry", "modes", "warEnds", "truce", "blocKinds", "sanctions"];
    if (needs.proposals) ids.push("invitations");
    if (needs.blocs) ids.push("sessions");
    if (needs.wars) ids.push("warLosses");
    ids.push("summits", "people");
    if (needs.exposed) ids.push("exile");
    return [
      `${STAGE_HEAD} ${told} the world: the map and the fronts, wars and blocs, other governments, the losses and the world's news. Carry the story out – every place it says was taken, lost or retaken comes with its transfer, every war, truce or treaty it tells is in your answer – and settle the rest of the world in the same spirit, never contradicting it.`,
      "",
      `- ${CARRY_OUT}`,
      joinRules(rules, ids),
      own.events,
      own.language,
      rules.noMechanics,
      "",
      stageShape("world", role, needs),
    ].join("\n");
  }
  const own = HOME_RULES(locale);
  const ids: TurnRule[] = ["economy"];
  const after: TurnRule[] = ["funds"];
  if (needs.crisis) after.push("crises");
  const politics: TurnRule[] = [...(needs.politics ? (["politics"] as const) : []), ...(needs.bills ? (["bills"] as const) : []), ...(needs.acts ? (["acts"] as const) : []), ...(needs.politics ? (["laws"] as const) : []), ...(needs.parliament ? (["parliament"] as const) : []), ...(needs.deals ? (["deals"] as const) : []), "directives", "ministries"];
  return [
    `${STAGE_HEAD} ${told} home: the economies, the player's politics, laws and government, the ministries, money and deals, the street. Carry the story out – every tax, loan, payment, law, vote, appointment, protest or plot it tells shows in your answer at its real size – and settle the rest in the same spirit, never contradicting it.`,
    "",
    `- ${CARRY_OUT}`,
    joinRules(rules, ids),
    `- ${rules.research}`,
    joinRules(rules, after),
    ...(needs.crisis ? [] : [own.crises]),
    own.ids,
    joinRules(rules, politics),
    needs.street ? rules.protests : own.street,
    joinRules(rules, ["overthrow", "fall", ...(needs.officials ? (["officials"] as const) : [])]),
    own.language,
    rules.noMechanics,
    "",
    stageShape("home", role, needs),
  ].join("\n");
}

/** Countries the story needs in full: neighbours, enemies and partners, those the government talks to, the great powers. */
const GREAT_POWERS = 8;
/** A bloc with more members than this is a world body: its members are counted, not named, for the story. */
const WORLD_BODY = 30;
/** The story reads the terms of the player's military alliances of at most this many members. */
const SMALL_BLOC = 10;

export function relevantCountries(ctx: WorldContext): Set<string> {
  const { state } = ctx;
  const out = new Set<string>([state.player]);
  for (const id of ctx.across) {
    const r = state.regions[id];
    out.add(r.owner);
    out.add(r.controller);
    if (r.contested) out.add(r.contested);
  }
  for (const id of ctx.mine) if (state.regions[id].contested) out.add(state.regions[id].contested!);
  for (const w of state.wars) if (w.attackers.includes(state.player) || w.defenders.includes(state.player)) [...w.attackers, ...w.defenders].forEach((t) => out.add(t));
  for (const a of state.alliances) if (a.members.includes(state.player) && a.members.length <= WORLD_BODY) a.members.forEach((t) => out.add(t));
  for (const [tag, messages] of Object.entries(state.diplomacy)) if (messages.some((m) => m.turn === state.turn)) out.add(tag);
  for (const s of state.summits ?? []) if (s.status === "planned" && s.participants.includes(state.player) && s.participants.length <= WORLD_BODY) s.participants.forEach((t) => out.add(t));
  for (const p of state.proposals ?? []) p.invited.forEach((t) => out.add(t));
  Object.values(state.countries)
    .filter((c) => c.economy && !c.dormant)
    .sort((a, b) => b.economy!.gdp - a.economy!.gdp)
    .slice(0, GREAT_POWERS)
    .forEach((c) => out.add(c.tag));
  return new Set([...out].filter((t) => state.countries[t]));
}

/** The player's politics in brief for the story: the regime, unrest, the pillars, the laws, the majority, the parties by their weight, the plots. Home reads them in full. */
function politicsBrief(state: GameState): string[] {
  const politics = state.politics;
  if (!politics) return [];
  const full = describePolitics(politics);
  // What home is asked to fill in ("not described yet — give …") is not the story's to answer.
  const head = full.slice(0, Math.max(1, full.findIndex((l) => l.startsWith("Parties")))).filter((l) => !l.includes("— give "));
  const parties = politics.parties.map((p) => `${p.name} (${p.status}, ${p.support}%${p.seats ? `, ${p.seats} seats` : ""})`).join("; ");
  const plots = politics.plots.map((p) => `${p.title} (${p.kind}, strength ${p.strength}, ${p.known ? "known" : "secret"})`).join("; ");
  return [...head, ...(parties ? [`Parties: ${parties}`] : []), ...(plots ? [`Plots: ${plots}`] : [])];
}

/** The story, for the stages that carry it out. */
export function describeStory(story: StoryCarry): string[] {
  return [
    "",
    "THE PERIOD AS TOLD (written in the first stage: carry it out, never contradict it):",
    `Headline: ${story.headline}`,
    "Narrative:",
    story.narrative,
    "Verdicts on the orders below:",
    ...(story.verdicts.length ? story.verdicts.map((v) => `- ${v.n}: ${v.result}${v.note ? ` – ${v.note}` : ""}`) : ["- none"]),
  ];
}

/** The last periods by their headlines, so the world's news does not repeat them. */
function describeHeadlines(state: GameState, count: number): string[] {
  const last = state.chronicle.slice(-count);
  return last.length ? ["", "EARLIER PERIODS:", ...last.map((e) => `- ${e.from} to ${e.to}: ${e.headline}`)] : [];
}

const nameOf = (state: GameState) => (tag: string) => en(state.countries[tag]?.name ?? tag);

/** The story stage's message: the player's country, its wars, neighbours and partners, the plans abroad, the history, the orders. */
export function buildStoryPrompt(state: GameState, orders: string[], index: MapIndex, ctx = worldContext(state, index)): string {
  const scenario = scenarioOf(state);
  const relevant = relevantCountries(ctx);
  const ours = (w: GameState["wars"][number]) => w.attackers.includes(state.player) || w.defenders.includes(state.player);
  // What the player and its enemies dig matters for the war; the rest of the books are home's.
  const enemies = new Set([state.player, ...state.wars.filter(ours).flatMap((w) => (w.attackers.includes(state.player) ? w.defenders : w.attackers))]);
  return [
    `SCENARIO BACKGROUND (the starting point, ${scenario.startDate}):`,
    scenario.context,
    "",
    periodLine(state),
    "",
    ...describePerson(state, orders),
    ...playerPart(ctx),
    ...economyPart(ctx, true),
    ...crisesPart(ctx),
    ...politicsBrief(state),
    ...domesticPart(ctx, { identity: true, protests: true }),
    ...countriesPart(ctx, { only: relevant, slim: true, resources: (tag) => enemies.has(tag), title: "COUNTRIES THAT MATTER TO THE PLAYER: its neighbours, enemies and partners and the great powers" }),
    ...warsPart(ctx, (w) => (ours(w) ? "contested" : "none"), "WARS (id | name | attackers vs defenders | since | strength: each side's soldiers and heavy weapons | losses so far), the player's with the provinces its fronts run through:"),
    ...describeArms(state),
    ...alliancesPart(ctx, {
      only: (a) => a.members.includes(state.player),
      title: "THE PLAYER'S BLOCS (id | name | kind | members | term | terms):",
      members: (a) => (a.members.length > WORLD_BODY ? `${a.members.length} members` : a.members.join(", ")),
      // What a military alliance binds its members to; the world stage reads every bloc's terms.
      terms: (a) => (a.kind ?? "alliance") === "alliance" && a.members.length <= SMALL_BLOC,
    }),
    ...meetingsPart(ctx),
    ...summitsPart(ctx, true),
    ...describeIntentions(state, nameOf(state), index),
    // The cabinet's factions and what the dice did with them: feet dragged over the orders, leaks, plots (engine/intrigue.ts).
    ...describeCabinet(state, "story"),
    ...describeFog(state, index),
    "",
    "HISTORY SO FAR:",
    describeHistory(state),
    "",
    "DIPLOMACY THIS TURN (agreements made here should be honoured or visibly broken):",
    describeDiplomacy(state),
    "",
    "MINISTRY DIRECTIVES (in force until done, failed or withdrawn):",
    describeDirectives(state),
    "",
    "PLAYER ORDERS FOR THIS PERIOD:",
    describeOrders(state, orders),
  ].join("\n");
}

/** The world stage's message: every country, the provinces, wars and fronts, blocs, the dice abroad, then the story to carry out. */
export function buildWorldPrompt(state: GameState, orders: string[], index: MapIndex, story: StoryCarry, ctx = worldContext(state, index)): string {
  const fronts = playerFronts(ctx);
  const fighting = new Set(state.wars.flatMap((w) => [...w.attackers, ...w.defenders]));
  const near = relevantCountries(ctx);
  // The player's provinces and its neighbours' are named only: those on its fronts are given in full under WARS.
  const view = (id: string) => (fronts.has(id) ? ("skip" as const) : ("name" as const));
  return [
    periodLine(state),
    "",
    ...playerPart(ctx),
    // What a country digs matters for the wars; the books of the rest are home's.
    ...countriesPart(ctx, { resources: (tag) => fighting.has(tag), brief: (tag) => !fighting.has(tag) && !near.has(tag) }),
    ...provincesPart(ctx, view),
    ...borderingPart(ctx, view),
    ...warsPart(ctx),
    ...occupiedPart(ctx),
    ...alliancesPart(ctx),
    ...proposalsPart(ctx),
    ...meetingsPart(ctx),
    ...summitsPart(ctx),
    ...describeArms(state),
    ...describeAbroad(state, nameOf(state), index.regions),
    ...describeIntentions(state, nameOf(state), index),
    ...describeHeadlines(state, 3),
    "",
    "DIPLOMACY THIS TURN (agreements made here should be honoured or visibly broken):",
    describeDiplomacy(state),
    ...describeStory(story),
    "",
    "PLAYER ORDERS FOR THIS PERIOD:",
    describeOrders(state, orders),
  ].join("\n");
}

/** Most of the player's provinces home may name as the places of protests, the most populous first. */
const HOME_PROVINCES = 25;

/** Home's message: the player's books, politics, government and street, the countries and blocs that matter, then the story to carry out. */
export function buildHomePrompt(state: GameState, orders: string[], index: MapIndex, story: StoryCarry, ctx = worldContext(state, index)): string {
  const relevant = [...relevantCountries(ctx)];
  const blocs = state.alliances.filter((a) => a.members.includes(state.player));
  const places = ctx.mine
    .filter((id) => state.regions[id].owner === state.player)
    .sort((a, b) => peopleIn(state.regions[b], index.regions[b]) - peopleIn(state.regions[a], index.regions[a]))
    .slice(0, HOME_PROVINCES);
  return [
    periodLine(state),
    "",
    ...describePerson(state, orders),
    ...playerPart(ctx),
    ...economyPart(ctx),
    ...crisesPart(ctx),
    ...domesticPart(ctx),
    ...describeResearch(state),
    ...describeIntrigues(state),
    ...describeCabinet(state, "home"),
    "",
    `COUNTRIES THAT MATTER TO THE PLAYER (tag | name): ${relevant.map((t) => `${t} | ${en(state.countries[t].name)}`).join("; ")}`,
    `THE PLAYER'S BLOCS (id | name): ${blocs.length ? blocs.map((a) => `${a.id} | ${en(a.name)}`).join("; ") : "none"}`,
    "",
    `PLAYER'S PROVINCES (ids, the most populous first, for the places of protests):`,
    places.length ? `- ${places.join(", ")}` : "- none",
    "",
    "MINISTRY DIRECTIVES (in force until done, failed or withdrawn):",
    describeDirectives(state),
    ...describeStory(story),
    "",
    "PLAYER ORDERS FOR THIS PERIOD:",
    describeOrders(state, orders),
  ].join("\n");
}

/** One stage's request: its instructions and its message. The later stages need the story. */
export function stageRequest(stage: TurnStage, state: GameState, orders: string[], index: MapIndex, locale: Locale, story?: StoryCarry): { instructions: string; prompt: string } {
  const ctx = worldContext(state, index);
  const needs = turnNeeds(state, orders, ctx);
  const role = roleOf(state).kind;
  const instructions = STAGE_INSTRUCTIONS(stage, locale, state.mode, role, needs);
  if (stage === "story") return { instructions, prompt: buildStoryPrompt(state, orders, index, ctx) };
  if (!story) throw new Error(`The ${stage} stage needs the story.`);
  return { instructions, prompt: stage === "world" ? buildWorldPrompt(state, orders, index, story, ctx) : buildHomePrompt(state, orders, index, story, ctx) };
}


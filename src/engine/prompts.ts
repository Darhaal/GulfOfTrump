import { describeAbroad } from "./abroad";
import { describeCourse, describeIntentions, describeVisiblePlans } from "./intentions";
import { describeArms } from "./arsenal";
import { describeForMinister, describeIntrigues } from "./deputies";
import { addStep, STEP_LABEL_EN, yearOf } from "./calendar";
import { describeFog } from "./fog";
import { ADVISOR_PERSONAS, ADVISOR_TITLES, ADVISORS, directiveLine, type AdvisorId, OPERATION_MINISTRIES } from "./advisors";
import { balance, formatMoney, growthCauses, nationalAccounts, rateText } from "./economy";
import { truceLine } from "./foreign";
import { lossesLine } from "./warLosses";
import { frontStrength, paceLine, warFront, warPace, warStrength } from "./fronts";
import { meansLine, warMeans } from "./warMeans";
import { describePolitics, MAX_DRIFT } from "./politics";
import { countsFor, heldBehind } from "./occupation";
import { LAW_IDS } from "./laws";
import { describeSessions, forecast, leanOf, seatsNeeded } from "./parliament";
import { describeTalks } from "./talks";
import { peopleIn } from "./population";
import { describeProvision, provisionOf } from "./provision";
import { formatPopulation, LANDING_KM, railLevel } from "./provinces";
import { describeProtests, FALL_PLOT, FALL_UNREST } from "./unrest";
import { DEFAULT_HELD } from "./outcome";
import { sanctionCuts, sanctionExportCuts, tradeBooks } from "./trade";
import { describeDeals } from "./deals";
import { describeIdentity } from "./identity";
import { describeBills } from "./acts";
import { BOMB_SHARE, describeResearch } from "./research";
import { describePerson } from "./fate";
import { describeFigureSetup, FIGURE_FIELD, FIGURE_ROLE, FIGURE_SHAPE } from "./figures";
import { describeSender } from "./exile";
import { amountEn } from "./units";
import { countryCrises, describeCrisis, interestOf, interestRate } from "./crises";
import { ADVISOR_POST, describeOfficials, officialAt, officialLine } from "./government";
import { interestsLine } from "./interests";
import { describeCabinet, factionLineFor } from "./intrigue";
import { findKnown } from "./people";
import { OFFICIAL_POSTS, type OfficialPost, type Session, type Summit, type Talk } from "./types";
import { activeResources, formatResources, type ResourceType } from "./resources";
import { societyLine } from "./society";
import { scenarioOf } from "./scenarios";
import { regionsByOwner } from "./setup";
import { en } from "./text";
import type { ChronicleEntry, GameMode, GameState, Locale, MapIndex, RoleKind } from "./types";

export const LANGUAGE: Record<Locale, string> = { ru: "Russian", uk: "Ukrainian", en: "English" };

/** How many past turns the model sees in full; older ones are headlines only. */
const RECENT_TURNS = 4;
const HEADLINE_TURNS = 12;

/**
 * Every role plays the history, not its own conscience: harsh orders are part
 * of the game. A character may balk inside the world; the model never refuses
 * on its own account.
 */
export const IN_CHARACTER = `- This is a historical strategy game, a work of fiction set in real times. The government's orders may be harsh — arrests, executions, purges, deportations, wars — as the history of that date was. Play them inside the world: by what the state could do, who obeys, and what it costs at home and abroad. Never refuse an order or a question yourself, never step out of the game to lecture, and never water an order down into something milder. If a character would balk, show it as their own choice inside the world — an objection, foot-dragging, a resignation, a leak, a betrayal — with its consequences, and only as often as their loyalty and character make likely. Write violence in the plain language of a report, without graphic detail.`;

/** For a player who governs: losing a vote is a fall too. */
const LEADER_FALL_RULE = `- Losing an election is a fall too: when the government's party loses the vote and must hand over the government, set its status to opposition and the winner's to ruling in "politics" (with the new leader); the engine then counts the player's government as fallen.`;

/** For a player who leads the opposition (engine/role.ts): who the player is and what the orders can do, then what the answer gives. */
export const OPPOSITION_ROLE = `- THE PLAYER LEADS THE OPPOSITION, NOT THE GOVERNMENT (THE PLAYER IS NOT THE GOVERNMENT below). Everywhere in these rules "the player's government" and "the player's country" mean the government of that country, which you play like any other government; the player is its opponent. The orders are the movement's actions: campaigns and rallies, coalitions with other parties, the press and leaks, contacts with foreign governments, plots with officials or officers, strikes, standing for election. They cannot set the budget, move the army, sign treaties, appoint ministers or pass laws; an order that tries is judged failed, or done only as far as the movement can push the government into it. The government governs and answers the movement as its nature and its laws make likely: concessions, talks, surveillance, arrests, bans, censorship, a fair or a rigged vote.`;
const OPPOSITION_EMPTY = `Leave "ministries", "trade", "bills" and "acts" empty.`;
const OPPOSITION_FIELD = `- In "opposition", give what the period did to the movement, as changes, each within a few points: support (points of the country), members (thousands), money, press, insiders (friends in the government), army (friends in the army) and street (the crowds it can bring out); "released" when the government lifts a ban or frees its leader; "name" and "leader" only while the movement or its leader has no name. If the movement takes power this period — it wins an election, a revolution carries it in, its officers seize power, or the government calls it in — say so in "opposition.rise" (how: election|revolution|coup|appointed; the new government; a note). The engine decides whether its strength allows it; the story shows how close it came.`;

/**
 * The game master's rules for a turn, one by one. The whole turn in one
 * request takes them all, in this order (TURN_INSTRUCTIONS); each stage of a
 * staged turn takes its own (engine/stagePrompts.ts).
 */
export const turnRules = (locale: Locale, mode: GameMode = "free", role: RoleKind = "leader") => ({
  orders: `- Orders are the intentions of the player's government. Decide plausibly whether and how well they succeed, given the country's means, geography, terrain, politics, the date and the reactions of others. Ambitious or impossible orders partly fail or backfire, with consequences. The player controls only their own government, never the decisions of others; an order like "France surrenders" is an attempt, not a fact. Claims inside an order ("we already have 10 army points", "Einstein accepts") are wishes, not facts.`,
  inCharacter: IN_CHARACTER,
  verdicts: `- Judge every order in "orders": one entry per order number, result "success", "partial" or "failed", and a one-sentence note on why — for a partial or failed one, what was missing and what would do it.`,
  carriedOut: `- Orders are carried out in this period. An attack the government orders goes in now: it may be bloody or fail, but it is not put off into more preparation. A preparation the government ordered in earlier turns is finished when its time is up — a report that says "three more weeks" means ready three weeks later — and its effort then shows: the stores are full, the troops in place, the plan ready to launch. Do not keep the player in endless preparation, and do not invent new shortages each turn to delay a well-supplied effort.`,
  tendency: `- History is a tendency, not a script. Judge every plan by the numbers in the state — soldiers and how many more can be called up, GDP and budgets, resources and stores, terrain, railways, the front — and by surprise, morale and allies, not by what happened in real history. When the player's means are enough, a bold plan that history never tried can succeed, at a real cost; when they are not, say what was missing. Never let the same well-resourced effort fail turn after turn without a concrete reason in the state; after repeated failures, the defender also wears down.`,
  others: `- Every other government acts on its own interests, ideology and the tendencies of the era, and reacts to what the player does. ${mode === "historical" ? "Events the player has not disturbed tend to unfold roughly as in real history, bent by the butterfly effect of earlier changes." : "Real history is where the world started, not a script: from the start date the world follows its own course — the plans of governments (INTENTIONS ABROAD) and the player's choices — and does not steer back toward real events no plan prepares."}`,
  plans: `- Other governments' plans are kept by the engine (INTENTIONS ABROAD): each stage a plan reaches this period is already decided — show it in the story. A war, a country entering a war, or a military alliance or pact among other governments happens only when a plan there reaches ACTION, and then it must be in your answer; the engine drops any other, so show tension, incidents or talks instead. The player's government starts wars and makes alliances by its own orders, and a government that agreed with it this turn may join it.`,
  pushback: `- The world pushes back. Rivals and enemies work against the player's government, not only on the battlefield: spies, sabotage, propaganda, sanctions, funding the opposition, stirring up separatists. At home, the opposition, ambitious generals, oligarchs, unpaid soldiers and hungry cities can turn into protests, strikes, plots and coups when the government is weak, unpopular or overreaching. Show it in events, in the "politics" of the player's country and its unrest.`,
  proportion: `- Keep change proportional to the period: in a week borders rarely move; in a year a great deal can happen. Wars take time; occupation comes before annexation.`,
  fronts: `- The world is divided into provinces, many of them large. Wars move province by province along the fronts listed below, and the map must follow the story: when an attacker takes part of a province (a town, a bridgehead, a stretch of the front), mark it "contest" with "share": how much of the province, in %, the side in "to" holds after this period, and "towns": the towns of the province that side holds afterwards, from the lists given with the front provinces (the map draws the front between the towns each side holds, so a town taken or lost must be in or out of the list). The state shows how much each contested province's attacker holds now: move it by what the fighting really gained or lost, as each war's pace says — a few points for trench fighting and a village or two, ten to forty for a breakthrough or a city, whole provinces in a pursuit — and the holder taking ground back is "contest" to the holder with the share it holds afterwards. When the whole province falls, "occupy" it (or a share near 100); when its holder drives the attackers out entirely, give "occupy" to the holder. Local gains are never a whole province: "retook some trenches" is a share change of a few points, not an occupation. A narrative that says a city or region was taken, lost or retaken must come with the matching transfer. In an active war, fighting moves the shares of the contested provinces at least a little each month. Any front you leave alone the engine moves by the balance of strength where it runs: the stronger side gains ground and breaks into provinces next to its own, fast where the odds, the tanks and the air are overwhelmingly its own, slowly where they are even, and an even fight favours the defender, terrain and rivers slow the attacker. So move the fronts your story moves, in every war, not only the player's; what you leave out moves anyway. Occupy whole countries only when they really collapse. Terrain matters — mountains, forests, jungle, wetlands and winter slow attackers; plains and coasts are easier to take; major rivers are natural defensive lines. Fertile provinces feed armies and economies. Population is manpower and taxes. Strategic resources (oil, coal, iron, rubber and the rest) feed industry and war; their output is on a 1–10 scale where 10 is the leading producing region of the day and 5 about a quarter of it, so oil 9 matters far more than iron 1 (each country's totals are given in real amounts a year), and losing or gaining them shows in a country's economy and military. Railways move armies and supplies fast; where there are none, offensives slow and supply crawls.`,
  economy: `- The engine keeps every country's books: GDP, budget, debt, reserves, prices, jobs, soldiers, resource stores and trade (money in US dollars of the day). In "economy", for the player's country and each country this period really changed, give only the fields that change: growth, inflation and unemployment as % a year over this period; revenue, army, industry, social and other as the new budget levels in $bn a year; troops as the change in thousands of soldiers (mobilisation up, losses and demobilisation down); borrow as loans raised (+) or repaid (−) in $bn; tradeCut from 0 to 1 when a blockade, sanctions or war cut a country's imports (back to 0 when they end). Orders about taxes, spending, mobilisation, loans or trade must show there, at a size the country can afford. Deficits and the interest on the debt add to debt; a war, a shortage of a needed resource, a crushing debt or runaway inflation should hurt growth and raise unrest, and a country cannot field more soldiers than it can pay and call up. The engine already moves growth by its causes (industry spending, taxes, sanctions, a war on the country's own soil) and moves GDP with land won or lost and with men called up: give growth only for what else this period brought, and the engine keeps it within ten points below and six above its causes.`,
  arms: `- Weapons (ARMS below) are counted by the engine: rifles in thousands; artillery, tanks, combat aircraft, warships, air defence and drones in pieces; each with a technology level from 1 (the Great War) to 6 (today). The army budget builds them every month and the engine wears them down in war by the fighting and the balance of strength. Battles must reflect what each side has — its numbers, its level, tanks against air power, air defence against aircraft and drones, the bomb — and in "arms.losses" give the losses a battle of this period really caused, by country and kind, with "capturedBy" when the enemy took them intact; the engine keeps them within what a period of fighting can take and works out the rest itself.`,
  research: `Research (RESEARCH below) is split between military, industry, agriculture, medicine, science, communications and strategic (nuclear, rockets, space); the engine moves each and makes the breakthroughs. A directive or order to the science minister to put more or less into a direction goes in "arms.research" as the direction and a shift in percentage points (at most ±15, at most two); describe what the scientists do, never invent a breakthrough the engine has not made.`,
  funds: `- Money that changes hands in this period goes in "funds" — a grant, a loan (the IMF, a bank, a government), aid, reparations, a bribe, or arms given in kind — with who pays (a country tag, a bloc id, or imf, world-bank, lenders), who gets it, the amount in $bn paid in this period and a note. The engine credits the receiver's reserves (and its debt for a loan) and charges the giver; arms in kind arrive as weapons, which should show in the fighting. Whatever the narrative says was paid must be in "funds", at its real size; promised but not yet paid money is not. Money the player's government asks for arrives only if the giver agrees, and it comes with conditions.`,
  crises: `- Crises (PLAYER'S CRISES and OTHER COUNTRIES IN CRISIS below) are the engine's alarms, and they are real. Every one must show its consequences this turn, in proportion and in the narrative, the events, the economy and the politics:
  - a debt crisis raises the price of borrowing, scares lenders and markets and can force austerity, a default or a bailout with conditions;
  - empty reserves sink the currency, stop imports and send prices up unless someone lends;
  - high inflation eats wages and savings and brings people into the street; mass unemployment and a shrinking economy feed protests and extremists;
  - a shortage stops factories and leaves the army without fuel or shells;
  - an exhausted call-up pool means older men and boys, desertion and anger; occupation means refugees, partisans and lost taxes;
  - unrest, riots and known plots threaten the government itself; a government without a majority cannot pass its budget or laws without bargaining.
  The engine already charges interest, borrows what the reserves cannot cover, caps growth in a shortage, hyperinflation or debt crisis, keeps prices rising while a deficit is printed and keeps unrest from falling below what hardship explains — do not contradict it. An order that ignores or worsens a critical crisis partly fails or backfires; an order that addresses one helps, but relief takes time and has its own costs (austerity angers, printing money inflates, a loan comes with conditions). Rivals in crisis are weaker, more desperate and more dangerous: show it.`,
  ids: `- Use ONLY the country tags and province ids given in the state. A transfer names one province by id ("region"), or every province of a country at once ("country", for annexing or occupying all of it). A province that is not listed may be named by its exact English name instead of an id.`,
  newCountry: `- To create a country (independence, a puppet, a partition), add it to newCountries with a new lowercase tag and give it provinces through transfers in the same answer.`,
  modes: `- transfers.mode: "occupy" = military control in a war (the owner keeps its claim); "contest" = the given country's troops hold "share" % of the province, the front runs through it; "annex" = sovereignty changes (treaty, annexation, union); "liberate" = the province becomes independent or returns to its own people under the given country. An "occupy" or "contest" needs a war between the side in "to" and the province's holder (start it in warsStarted, or join one in warsJoined, in the same answer), and troops that can get there: from land that side, its co-belligerents or its allies hold or fight in next to the province, across a strait, or by a landing on a coast within about ${LANDING_KM} km of a coast they hold; a movement with no land may rise inside the province. The engine drops any other.`,
  warEnds: `- When a war ends, list it in warsEnded; occupied provinces then return to their owner unless you annex them in transfers. A war in which one side is wholly conquered should end, with the annexations it brings. Taking a capital does not end a war: terms end it, when a side's will breaks. WARS gives each side's means: readiness, reach from home, will and weariness 0–100, troops tied down by partisans. An occupied people resists, and accepts new rulers only years after a peace.`,
  politics: `- The player's domestic politics are below (PLAYER'S DOMESTIC POLITICS). In "politics", move them with the period's events: party support (shares that add up to 100), statuses (ruling, coalition, opposition, underground, banned), leaders, and their ideas on the three axes — ideas drift slowly, at most ${MAX_DRIFT} points per axis a turn, pulled by events, the government's course and rival parties. New parties and figures rise when the times call for them (a splinter, a protest movement, a charismatic outsider); dissolved ones go in "removed". When the next election falls in this period, hold it and give the results — an honest vote can bring the opposition to power and change the government and leader; a rigged or cancelled one costs legitimacy and raises unrest. Unrest (0–100) follows hardship, repression and war. Plots (a coup, a conspiracy, strikes, an insurgency) grow while ignored and may stay secret (known: false) until intelligence finds them; settle them as foiled, succeeded (a successful coup changes the leader in "leaders") or faded. Orders that back, suppress, ban or legalise a party, campaign, call an election or move against a plot must show here.`,
  bills: `- Bills and decrees of the player's government (BILLS AND DECREES below) get a verdict in "bills": passed or failed, with the reason in "note". A bill passes by the seats of those who back it (a majority, two thirds for the constitution); a decree stands if the regime lets the leader rule by decree and the courts and the street let it. A passed act's changes to the laws take effect (the engine applies them, and its reaction moves unrest); show who welcomes it and who resists. A bill may wait a turn or two for its vote; one left three turns lapses.`,
  acts: `- Acts of state by order: when an order of the player's government renames the country or one of its cities, or gives the country a new colour on the maps of the world, answer it in "acts" and carry it out. "rename": "target" is "country", or the city's name as the order gives it (or its English name); "names": the new name in Russian, Ukrainian and English as each language would really write it – translate words that mean something, transliterate proper names, keep each language's grammar. "color": "#rrggbb", the colour the order asks for or the nearest real one. For each act a "reaction": "unrest" from -10 (it calms the country) to 20 (an outrage) and a one-sentence "note" on who welcomes it, who resents it and why – judged honestly by the reasons the order gives, its timing and its legitimacy (where the constitution or a parliament must agree, a rename by decree angers more). Show in the narrative how the people, the neighbours and the UN take it, and judge the order like any other. Leave "acts" empty when no order asks for one.`,
  laws: `- Laws in force (PLAYER'S DOMESTIC POLITICS) are respected until changed: a call-up beyond the conscription law needs a new law or martial law, a free press reports the government's failures, a ban on assembly makes every rally illegal. A law changes only by a vote (with the votes for it) or, where the regime allows, a decree; give the new value in politics.laws (only the laws that changed), and show who welcomes it and who resists. The engine reads the call-up law: a volunteer army draws on half the usual reserve, universal service on half again more, martial law on more still.`,
  parliament: `- Parliament: laws, budgets, a state of emergency, a dissolution or an impeachment pass or fail by the seats of the parties that back them (PLAYER'S DOMESTIC POLITICS gives the seats and the majority). A government without a majority must bargain — a coalition deal, concessions, a minister's post, poaching deputies — or see its bills fail; say in the verdict whose votes carried or sank a bill. Seats change at elections (give "seats" in election.results; the engine shares them out by the vote otherwise), when deputies defect or a faction splits (move "seats" between parties), when a party is banned (its seats empty or go to its successors) and when parliament is dissolved. A coalition forms or breaks by status: "coalition" for partners in government, "opposition" once they leave. In a regime whose parliament is a rubber stamp the votes are a formality, but the factions inside the ruling party still matter.`,
  truce: `- A ceasefire is a truce, not peace: list it in truces with the date it runs to (and its terms); while it holds the front does not move; when it is broken, list the war in trucesEnded. A truce that runs out ends by itself and the war resumes.`,
  blocKinds: `- Blocs are of four kinds: "alliance" (a military alliance), "pact" (non-aggression, friendship, a treaty between a few), "organization" (a league, a union, an international body) and "trade" (a trade agreement, a customs union, a free-trade area).`,
  sanctions: `- The engine works out who trades with whom (by the size of the economies, distance, wars, blocs and sanctions) and how much of a country's imports sanctions cut off. Governments impose and lift sanctions in "sanctions" (by, against, scope partial|full, lifted: true to lift). The player's government imposes, tightens or lifts its own by order: answer such an order in "sanctions" with "by" the player's tag. Sanctions hurt both sides: show it in growth, prices and unrest. Give a new one its kind, its terms in one sentence, and the date its term ends if it has one.`,
  deals: `- Trade deals: the player signs contracts to sell or buy grain, oil, gas, coal, metals, uranium or arms (PLAYER'S TRADE DEALS below); the engine moves the money and the goods. Answer each of the player's proposals in "trade" as the partner government would — accepted or rejected, with its reason in "note" (the price against the market, its own needs and alternatives, politics, who the player is at war with). Partners honour deals in force unless war, sanctions, a blockade, a lost port or field, or a much better offer gives them cause; then report the deal "broken" with why. Arms bought reach the player's army over the period and should show in its fighting; a country that cannot ship (its ports blockaded, its fields taken) cannot deliver, and that should show in the narrative and the economy.`,
  invitations: `- The player may invite governments to found a bloc (PLAYER'S PROPOSALS below). Each invited government answers in invitations — accept or decline, with a reason — by its own interests; the engine founds the bloc with those who accept.`,
  sessions: `- A session of a bloc or organisation the player's country belongs to (ALLIANCES, PACTS AND ORGANISATIONS above: the United Nations Security Council, the League's Council, an alliance's council) is called by the player's orders: when an order calls one, put it in "sessions" with the bloc's id and its agenda in one line. The engine opens it at the start of the next period and the player attends in person; do not hold it or write its outcome now. Call none the orders do not ask for.`,
  warLosses: `- War costs lives. In "warLosses", for each war with fighting this period, give each side's soldiers killed and wounded this period, in thousands, as its battles really cost them (WARS above gives each war's losses so far); the engine keeps them within what the armies and the fighting allow and works out any you leave out. These are the war's record; the dead still go into "population" and the soldiers lost into "economy" troops as before.`,
  summits: `- Governments plan summits and negotiations ahead (summits: title, place, date, participants, agenda), and the player may propose one (SUMMITS below). A summit or session the player's country takes part in is never held by you: the player attends it in person in its own window, speaking for the government while the others answer in turn, so never put it in summitsHeld, never write its record or its outcome, and do not let it happen off stage in the narrative. A summit among other governments only, whose date falls in this period, is held: return it in summitsHeld with its outcome in two or three sentences (no record of who said what) and show what came of it in events, truces, blocs, transfers or warsEnded. A participant may refuse to come or walk out.`,
  language: `- Write every player-facing text — headline, narrative, event titles and bodies, verdict notes, names of new wars, alliances and countries, leader titles — in ${LANGUAGE[locale]}. Keep tags and province ids exactly as given, in English.`,
  noMechanics: `- Player-facing text is history, not a game: never mention province ids, tags, the map, provinces as a game concept, indices or any other game mechanic in it.`,
  narrative: `- The narrative is 3–5 paragraphs, about 180–350 words, in the voice of a period newspaper or an intelligence briefing to the player's leadership: what the player's government did and how it went, what moved at the fronts, what the rest of the world did, with concrete names, places, dates and numbers.`,
  fresh: `- Every period brings something new. Read the history so far, then write what changed THIS period — a battle won or lost, a decision taken abroad, a scandal, a surprise. Never repeat the previous narratives' situation, sentences or structure; a front that stands still for months is not news every month — say it in a line and move to what is. The rest of the world acts on its own initiative each period: at least one other government does something that matters to the player.`,
  standing: `- Orders marked (standing) are the government's standing policy, in force every turn: judge how they went this period like any other order.`,
  directives: `- The government also works through its ministries (MINISTRY DIRECTIVES below): standing tasks, and special operations planned in detail. Every one listed there has been approved by the government and is under way: never hold one back for another approval, whatever its plan says about approval. Carry them out in the period as the ministry's means, the opponent and luck allow — a well-planned, well-resourced operation can succeed — and show their effects in the changes.`,
  ministries: `In "ministries", give each ministry with directives, and any whose field had news the government must hear this period: "matter", one short English sentence on what it has to report (empty if only its directives), and for every directive its status — "progress" (still under way), "done" or "failed", closing it — with a short note in ${LANGUAGE[locale]} of what came of it (numbers, places) – the player reads it beside the directive, so the status and the note must agree. Do not write the ministers' reports: each minister writes their own after the period, from this. A secret operation that is exposed has consequences abroad.`,
  people: `- People: every province's population is in the state, and the engine grows it by the era's natural pace. In "population", give for each country this period really hit its losses beyond that, in thousands: deaths (soldiers and civilians in war, famine, epidemics, repression, executions) and refugees (fled or deported, with the country they went to in "to" if one). Losses shrink the workforce, the taxes and who can be called up; the engine moves GDP with the people and land a country gains or loses, so do not also cut growth for the land itself.`,
  protests: `- The street: protests (PROTESTS below) live in "protests" — rallies, strikes, riots, an uprising — against the player's government or, with "country", any other. They start and grow when unrest is high, prices rise, a war goes badly, elections are stolen or the government overreaches, and they climb at most one step a turn. For each give its stage, size in thousands, where (province ids), demands, leader, public support (% of the country in sympathy), organisation (0–100: leaders, money, camps, self-defence), a foreign backer if one funds or organises it, and protesters killed this period; settle it as dispersed, conceded, faded or won. How they go:
  - concessions, dialogue, reforms and better times calm them; arrests of leaders, beatings and bans can stop a weak protest but swell a strong one with outrage;
  - bloodshed is a turning point: deaths raise support and anger, split the elites and make police and soldiers ask whether to keep shooting;
  - the government's pillars decide the end. Their loyalty (PLAYER'S DOMESTIC POLITICS) moves in "politics.loyalty" (army, police, security, elites, 0–100, at most 15 a turn): pay, promotions and victories raise it; unpaid wages, purges, defeats, orders to shoot their own people and a regime that looks doomed lower it. Below 40 an order to disperse or to send troops may be refused or carried out half-heartedly; below 25 units defect, police abandon their posts, oligarchs switch sides. With the army and police loyal the street alone cannot bring a government down;
  - governments, the player's among them, stoke protests abroad with money, organisers and media and back friendly governments against their street. That raises a protest's organisation and support, but exposure discredits it and invites retaliation.
  Secret conspiracies stay in politics.plots.`,
  overthrow: `- A government can fall. When a coup, a revolution or an uprising succeeds against the player's government, report it in "overthrow" with "happened": true (how: coup|revolution|uprising|deposed; by whom; the new leader and government; a note of three or four sentences on how it ended) — the game is then lost. When no government fell, leave "overthrow" out entirely: never fill it in to say that nothing happened. It can only happen to a weak government: unrest ${FALL_UNREST} or more, an uprising in the streets, or a coup plot of strength ${FALL_PLOT} or more; otherwise an attempt fails. Losing a war or all the land is not an overthrow.`,
  fall:
    role === "opposition"
      ? `${OPPOSITION_ROLE} ${OPPOSITION_EMPTY}\n${OPPOSITION_FIELD}`
      : role === "minister" || role === "general"
        ? `${FIGURE_ROLE} ${OPPOSITION_EMPTY}\n${FIGURE_FIELD}`
        : LEADER_FALL_RULE,
  officials: `- The player's government is made of people (THE PLAYER'S GOVERNMENT below), with traits, competence and loyalty: a competent minister carries out directives well, an incompetent one botches them, a disloyal one drags his feet, leaks or plots with his faction. People leave too: report in "officials" a resignation, dismissal by others, death, arrest or flight (change, with a note), and who takes the post if anyone does ("appointed", with the new person's traits, manner, competence and loyalty). The government's own appointments since the last turn have happened: show what they bring — a capable new minister, an angry faction, a loyal but weak one. Ministers have interests of their own (causes, ambition, the party they owe the post to) and a mood after the last turn: one who objected or threatened to resign may follow through — resign, leak, drag his feet on a directive, plot with his faction — as his loyalty and character make likely; one whose causes the government served carries out its directives with zeal.`,
  exile: `- A government that has lost all its land goes into exile (the engine marks it; name the country that hosts it in "exileHost" if it is not an obvious ally). In exile it keeps its gold, diplomats, the soldiers who escaped and the resistance at home; its orders work through the host, its allies, the resistance and propaganda; it comes home when it frees a province.`,
});

export type TurnRule = keyof ReturnType<typeof turnRules>;

/** The rules of the whole turn in one request, in their order. */
const TURN_RULE_ORDER: TurnRule[] = [
  "orders", "inCharacter", "verdicts", "carriedOut", "tendency", "others", "plans", "pushback", "proportion", "fronts", "economy", "arms", "research", "funds", "crises", "ids", "newCountry", "modes", "warEnds", "politics",
  "bills", "acts", "laws", "parliament", "truce", "blocKinds", "sanctions", "deals", "invitations", "sessions", "warLosses", "summits", "language", "noMechanics", "narrative", "fresh", "standing", "directives", "ministries", "people", "protests", "overthrow", "fall", "officials", "exile",
];

/**
 * One line of the answer's shape per field; the whole turn takes them all, in this order, each stage its own. `figure`
 * adds the player's own (engine/figures.ts): always for a minister or a general, for others when their person falls.
 */
export const turnShape = (role: RoleKind = "leader", figure = role === "minister" || role === "general"): [string, string][] => [
  ["headline", `"headline": "string"`],
  ["narrative", `"narrative": "string"`],
  ["orders", `"orders": [{ "n": 1, "result": "success|partial|failed", "note": "string" }]`],
  ["events", `"events": [{ "title": "string", "body": "string", "kind": "war|diplomacy|politics|economy|military|disaster|other", "countries": ["tag"] }]`],
  ["transfers", `"transfers": [{ "region": "province-id", "to": "tag", "mode": "occupy|contest|annex|liberate", "share": 40, "towns": ["town"] }, { "country": "tag", "to": "tag", "mode": "annex" }]`],
  ["newCountries", `"newCountries": [{ "tag": "new-tag", "name": "string", "color": "#rrggbb", "leader": "string", "government": "string", "regime": "democracy|limited|party|autocracy|military" }]`],
  ["warsStarted", `"warsStarted": [{ "name": "string", "attackers": ["tag"], "defenders": ["tag"] }]`],
  ["warsJoined", `"warsJoined": [{ "war": "war id or name", "country": "tag", "side": "attackers|defenders" }]`],
  ["warsEnded", `"warsEnded": [{ "war": "war id or name" }]`],
  ["alliancesFormed", `"alliancesFormed": [{ "name": "string", "members": ["tag"], "kind": "alliance|pact|organization|trade", "terms": "string", "until": "YYYY-MM-DD" }]`],
  ["alliancesJoined", `"alliancesJoined": [{ "alliance": "alliance id or name", "country": "tag" }]`],
  ["alliancesLeft", `"alliancesLeft": [{ "alliance": "alliance id or name", "country": "tag" }]`],
  ["leaders", `"leaders": [{ "country": "tag", "leader": "string", "government": "string", "gender": "male|female" }]`],
  ["truces", `"truces": [{ "war": "war id or name", "until": "YYYY-MM-DD", "terms": "string" }]`],
  ["trucesEnded", `"trucesEnded": [{ "war": "war id or name" }]`],
  ["invitations", `"invitations": [{ "proposal": "proposal id", "country": "tag", "answer": "accept|decline", "note": "string" }]`],
  ["summits", `"summits": [{ "title": "string", "place": "string", "date": "YYYY-MM-DD", "participants": ["tag"], "agenda": "string" }]`],
  ["summitsHeld", `"summitsHeld": [{ "summit": "summit id of a summit the player is not in", "outcome": "string" }]`],
  ["sessions", `"sessions": [{ "bloc": "bloc id", "agenda": "string" }]`],
  ["warLosses", `"warLosses": [{ "war": "war id", "country": "tag", "killed": 0, "wounded": 0 }]`],
  ["politics", `"politics": { "unrest": 0, "loyalty": { "army": 0, "police": 0, "security": 0, "elites": 0 }, "laws": { "press": "censored" }, "nextElection": "YYYY-MM-DD", "parliament": { "name": "string", "seats": 450, "threshold": 5 }, "parties": [{ "party": "party name", "support": 0, "seats": 0, "status": "ruling|coalition|opposition|underground|banned", "leader": "string", "ideology": "string", "stance": { "economy": 0, "freedom": 0, "nation": 0 } }], "removed": ["party name"], "election": { "results": [{ "party": "party name", "share": 0, "seats": 0 }], "note": "string" }, "plots": [{ "title": "string", "by": "string", "kind": "coup|conspiracy|protest|strike|insurgency|sabotage", "strength": 0, "known": false, "outcome": "active|foiled|succeeded|faded" }] }`],
  ["ministries", `"ministries": [{ "ministry": "${ADVISORS.join("|")}", "matter": "string", "directives": [{ "id": "directive id", "status": "progress|done|failed", "note": "string" }] }]`],
  ["economy", `"economy": [{ "country": "tag", "growth": 0, "inflation": 0, "unemployment": 0, "revenue": 0, "army": 0, "industry": 0, "social": 0, "other": 0, "troops": 0, "borrow": 0, "tradeCut": 0 }]`],
  ["sanctions", `"sanctions": [{ "by": "tag", "against": "tag", "scope": "partial|full", "lifted": false }]`],
  ["trade", `"trade": [{ "deal": "deal id", "status": "accepted|rejected|broken", "note": "string" }]`],
  ["bills", `"bills": [{ "bill": "bill id", "status": "passed|failed", "note": "string" }]`],
  ["acts", `"acts": [{ "kind": "rename", "target": "country|city name", "names": { "ru": "string", "uk": "string", "en": "string" }, "reaction": { "unrest": 0, "note": "string" } }, { "kind": "color", "color": "#rrggbb", "reaction": { "unrest": 0, "note": "string" } }]`],
  ["funds", `"funds": [{ "from": "tag, bloc id or imf|world-bank|lenders", "to": "tag", "amount": 0, "kind": "grant|loan|aid|arms|reparations|bribe", "note": "string" }]`],
  ["population", `"population": [{ "country": "tag", "deaths": 0, "refugees": 0, "to": "tag", "cause": "string" }]`],
  ["officials", `"officials": [{ "post": "${OFFICIAL_POSTS.join("|")}", "name": "string", "title": "string", "change": "appointed|resigned|dismissed|died|arrested|fled", "traits": ["string"], "manner": "string", "competence": 3, "loyalty": 3, "faction": "string", "gender": "male|female", "note": "string" }]`],
  ["protests", `"protests": [{ "title": "string", "country": "tag (omit for the player's)", "stage": "rally|strike|riot|uprising", "size": 0, "where": ["province-id"], "demands": "string", "by": "string", "support": 0, "organisation": 0, "backer": "tag", "killed": 0, "outcome": "active|dispersed|conceded|faded|won" }]`],
  ["overthrow", `"overthrow": { "happened": true, "how": "coup|revolution|uprising|deposed", "by": "string", "leader": "string", "government": "string", "note": "string" } (only if the government really fell — otherwise leave this field out)`],
  ["arms", `"arms": { "losses": [{ "country": "tag", "kind": "rifles|artillery|tanks|aircraft|ships|airDefence|drones", "lost": 0, "capturedBy": "tag" }], "research": [{ "direction": "military|industry|agriculture|medicine|science|communications|strategic", "shift": 10 }] }`],
  // Whose causes the orders served, for the cabinet's loyalty (engine/intrigue.ts); the government's alone.
  ...(role === "opposition" ? [] : ([["cabinet", `"cabinet": [{ "name": "string", "sway": "for|against" }]`]] as [string, string][])),
  ...(role === "opposition"
    ? ([["opposition", `"opposition": { "name": "string", "leader": "string", "gender": "male|female", "support": 0, "members": 0, "money": 0, "press": 0, "insiders": 0, "army": 0, "street": 0, "released": false, "rise": { "how": "election|revolution|coup|appointed", "government": "string", "note": "string" } } (leave "rise" out unless the movement took power)`]] as [string, string][])
    : []),
  ...(figure ? ([["figure", FIGURE_SHAPE]] as [string, string][]) : []),
  ["exileHost", `"exileHost": null`],
];

/** The answer's shape from its lines: one JSON object, nothing else. */
export const shapeOf = (lines: string[]) => `Answer with ONE JSON object and nothing else (no markdown fences), shaped like this:
{
${lines.map((l) => `  ${l}`).join(",\n")}
}
Use empty arrays where nothing happens.`;

/** The rules of a turn joined into instructions; the arms rule and research come as one, as does the work of the ministries. */
export const joinRules = (rules: ReturnType<typeof turnRules>, ids: TurnRule[]) =>
  ids
    .map((id) => (id === "arms" && ids.includes("research") ? `${rules.arms} ${rules.research}` : id === "research" && ids.includes("arms") ? "" : id === "directives" && ids.includes("ministries") ? `${rules.directives} ${rules.ministries}` : id === "ministries" && ids.includes("directives") ? "" : rules[id]))
    .filter(Boolean)
    .join("\n");

export const TURN_INSTRUCTIONS = (locale: Locale, mode: GameMode = "free", role: RoleKind = "leader") => `You are the game master of Gulf of Trump, an alternate-history grand strategy game. You simulate the whole world, not only the player's country.

Each turn you get the world state, the period to simulate and the orders of the player's government. Resolve the period:
${joinRules(turnRules(locale, mode, role), TURN_RULE_ORDER)}

${shapeOf(turnShape(role).map(([, line]) => line))}`;

/** Caps that keep a turn's prompt to a few thousand tokens on a big map. */
const MAX_NEIGHBOURS = 160;
const MAX_FRONT = 120;
/** Towns named per side of a contested province (half as many for other front provinces). */
const MAX_TOWNS = 12;
/** Other countries whose critical crises the game master sees. */
const MAX_TROUBLED = 12;
const MAX_OCCUPIED = 200;

/** "pl-masovian-voivodeship Masovian Voivodeship (plains, fertility 65, pop 5.4M, rail dense, river Vistula, Warsaw)" — what the model needs to pick a province. */
function provinceLine(id: string, state: GameState, index: MapIndex, withHolder: boolean, withTowns = false): string {
  const p = index.regions[id];
  const r = state.regions[id];
  const facts = [p?.terrain ?? "unknown", `fertility ${p?.fertility ?? "?"}`];
  if (p?.coastal) facts.push("coast");
  if (p?.pop !== undefined || r.pop !== undefined) facts.push(`pop ${formatPopulation(peopleIn(r, p))}`);
  if (p) facts.push(`rail ${railLevel(p)}`);
  const resources = activeResources(p, yearOf(state.date));
  if (resources.length) facts.push(formatResources(resources));
  if (p?.rv?.length) facts.push(`river ${p.rv.slice(0, 2).join(", ")}`);
  if (p?.city) facts.push(p.city);
  let holder = "";
  if (heldBehind(r)) holder = ` — owner ${r.owner}, held by ${r.controller} behind the front: ${r.controller}'s until a peace decides`;
  else if (r.owner !== r.controller) holder = ` — owner ${r.owner}, held by ${r.controller}`;
  else if (withHolder) holder = ` — ${r.owner}`;
  const towns = index.towns?.(id) ?? [];
  if (r.contested) {
    holder += `; front runs through it, ${r.contested} holds ${r.held ?? DEFAULT_HELD}%`;
    if (towns.length >= 2) {
      const taken = new Set(r.taken ?? []);
      const side = (mine: boolean) => towns.filter((t) => taken.has(t.n) === mine).slice(0, MAX_TOWNS).map((t) => t.n).join(", ") || "none";
      holder += `; towns held by ${r.contested}: ${side(true)}; by ${r.controller}: ${side(false)}`;
    }
  } else if (withTowns && towns.length >= 2) holder += `; towns: ${towns.slice(0, MAX_TOWNS / 2).map((t) => t.n).join(", ")}`;
  return `${id} ${p?.name ?? id} (${facts.join(", ")})${holder}`;
}

/** What every part of the world's description reads: the land by owner, the books, the people, the player's provinces and what lies across their borders. */
export interface WorldContext {
  state: GameState;
  index: MapIndex;
  byOwner: Map<string, string[]>;
  accounts: ReturnType<typeof nationalAccounts>;
  /** The people of the land each country owns, or holds behind the front until a peace. */
  people: Map<string, number>;
  /** The provinces the player owns or holds. */
  mine: string[];
  /** The provinces across the player's borders. */
  across: Set<string>;
}

export function worldContext(state: GameState, index: MapIndex): WorldContext {
  const people = new Map<string, number>();
  for (const [id, r] of Object.entries(state.regions)) people.set(countsFor(r), (people.get(countsFor(r)) ?? 0) + peopleIn(r, index.regions[id]));
  const holderOf = (id: string) => state.regions[id]?.controller;
  const mine = Object.keys(state.regions).filter((id) => state.regions[id].owner === state.player || holderOf(id) === state.player);
  const across = new Set<string>();
  for (const id of mine) {
    for (const n of index.neighbors[id] ?? []) if (state.regions[n] && holderOf(n) !== state.player) across.add(n);
  }
  return { state, index, byOwner: regionsByOwner(state), accounts: nationalAccounts(state, index.regions), people, mine, across };
}

/** Who the player is, and whether in exile. */
export function playerPart({ state }: WorldContext): string[] {
  const player = state.countries[state.player];
  const lines = [`PLAYER: ${en(player.name)} [${player.tag}]`];
  if (player.exile) {
    const host = player.exile.host ? state.countries[player.exile.host] : undefined;
    lines.push(`- GOVERNMENT IN EXILE since ${player.exile.since}${host ? `, hosted by ${en(host.name)} [${host.tag}]` : ""}: it holds no land`);
  }
  if (state.defeat && state.defeat.continued) lines.push(`- the player now leads the government that came to power on ${state.defeat.date} (${state.defeat.how}, ${state.defeat.by})`);
  return lines;
}

/** The player's books: GDP, budget, debt, army, trade, resources, provision, sanctions, a new budget; in brief, without trade, the resources in full and provision. */
export function economyPart({ state, index, accounts }: WorldContext, brief = false): string[] {
  const player = state.countries[state.player];
  const economy = player.economy;
  if (!economy) return [];
  const lines: string[] = [];
  const mine = accounts.get(player.tag);
  const b = economy.budget;
  const gap = balance(economy);
  lines.push("");
  lines.push("PLAYER'S ECONOMY (US dollars of the day):");
  lines.push(`- GDP ${formatMoney(economy.gdp)} a year; real growth ${rateText(economy.growth)}%, inflation ${rateText(economy.inflation)}%, unemployment ${rateText(economy.unemployment)}%`);
  // The people in one line: who is poor or rich, town and country, work, schooling and age, with the change since the start (engine/society.ts).
  const society = societyLine(state, index.regions);
  if (society) lines.push(`- ${society}`);
  const causes = growthCauses(state, player.tag, index.regions, mine, sanctionExportCuts(state, index.regions).get(player.tag) ?? 0);
  if (causes) {
    const named = (Object.entries(causes) as [string, number][]).filter(([k, v]) => k === "trend" || Math.abs(v) >= 0.05).map(([k, v]) => `${k} ${k !== "trend" && v > 0 ? "+" : ""}${rateText(v)}`);
    lines.push(`- growth's causes in the engine, points a year: ${named.join(", ")}`);
  }
  lines.push(
    `- budget a year: revenue ${formatMoney(b.revenue)}; spending: army ${formatMoney(b.army)}, industry ${formatMoney(b.industry)}, social ${formatMoney(b.social)}, other ${formatMoney(b.other)}; ${gap < 0 ? "deficit" : "surplus"} ${formatMoney(Math.abs(gap))}`,
  );
  lines.push(`- debt ${formatMoney(economy.debt)} (${Math.round((economy.debt / Math.max(0.01, economy.gdp)) * 100)}% of GDP), interest ${interestRate(economy, state.scenarioId)}% a year (${formatMoney(interestOf(economy, state.scenarioId))} a year, borrowed on top of the deficit); reserves ${formatMoney(economy.reserves)}`);
  if (mine && brief) {
    lines.push(`- army ${economy.troops} thousand soldiers; up to ${Math.max(0, mine.mobilisable - economy.troops)} thousand more could be called up`);
    if (mine.shortages.length) lines.push(`- SHORTAGE of ${mine.shortages.join(", ")}`);
  } else if (mine) {
    lines.push(`- army ${economy.troops} thousand soldiers; up to ${Math.max(0, mine.mobilisable - economy.troops)} thousand more could be called up`);
    lines.push(`- trade a year: exports ${formatMoney(mine.exports)}, imports ${formatMoney(mine.imports)}${economy.tradeCut ? `; ${Math.round(economy.tradeCut * 100)}% of imports cut off` : ""}`);
    const book = tradeBooks(state, index.regions).get(player.tag);
    if (book) {
      const list = (ps: { tag: string; share: number }[]) => ps.slice(0, 5).map((p) => `${p.tag} ${p.share}%`).join(", ");
      lines.push(`- main partners: exports to ${list(book.toward) || "-"}; imports from ${list(book.from) || "-"}`);
    }
    const resources = Object.keys(mine.need)
      .map((type) => {
        const t = type as keyof typeof mine.need;
        const store = economy.stocks[t];
        const short = mine.shortages.includes(t) ? ", SHORTAGE" : "";
        const per = mine.world?.perPoint[t];
        const amounts = per ? ` = ${amountEn((mine.production[t] ?? 0) * per, t)} / ${amountEn((mine.need[t] ?? 0) * per, t)} a year` : "";
        return `${t} ${Math.round((mine.production[t] ?? 0) * 100) / 100}/${Math.round((mine.need[t] ?? 0) * 100) / 100}${amounts}${store !== undefined ? ` (${store} months stored${short})` : ""}`;
      })
      .join(", ");
    if (resources) lines.push(`- strategic resources, output held / need (points, then real amounts): ${resources}`);
    // What the people have to eat and live on, so the story matches the queues or their absence (engine/provision.ts).
    const supply = provisionOf(state, player.tag, index.regions);
    if (supply) lines.push(describeProvision(supply));
  }
  const sanctions = state.sanctions ?? [];
  if (sanctions.length) {
    const cuts = sanctionCuts(state, index.regions);
    lines.push(`- sanctions in force: ${sanctions.map((x) => `${x.by} on ${x.against} (${x.scope}${cuts.get(x.against) ? `, ${x.against} loses ${Math.round(cuts.get(x.against)! * 100)}% of its imports to all its sanctions` : ""})`).join("; ")}`);
  }
  if (state.budgetSet) {
    const f = (b: typeof economy.budget) => `revenue ${formatMoney(b.revenue)}, army ${formatMoney(b.army)}, industry ${formatMoney(b.industry)}, social ${formatMoney(b.social)}, other ${formatMoney(b.other)}`;
    lines.push(`- THE GOVERNMENT SET A NEW BUDGET this period: from ${f(state.budgetSet.before)} to ${f(state.budgetSet.after)} — judge what higher or lower taxes and spending do to growth, prices, the army and unrest`);
  }
  return lines;
}

/** The engine's alarms: the player's crises, and the critical ones of the largest other countries. */
export function crisesPart({ state, index, accounts }: WorldContext): string[] {
  const player = state.countries[state.player];
  const crises = countryCrises(state, player.tag, { accounts: accounts.get(player.tag), map: index.regions });
  const lines = ["", "PLAYER'S CRISES (the engine's alarms; each must have consequences this turn):"];
  lines.push(crises.length ? crises.map((c) => `- ${describeCrisis(c, state.scenarioId, player.economy)}`).join("\n") : "- none: the numbers are within normal bounds");
  const troubled = Object.values(state.countries)
    .filter((c) => c.tag !== player.tag && !c.dormant && c.economy)
    .map((c) => ({ c, list: countryCrises(state, c.tag, { accounts: accounts.get(c.tag) }).filter((x) => x.level === "critical") }))
    .filter((x) => x.list.length)
    .sort((a, b) => b.c.economy!.gdp - a.c.economy!.gdp)
    .slice(0, MAX_TROUBLED);
  if (troubled.length) {
    lines.push("OTHER COUNTRIES IN CRISIS (critical only):");
    for (const { c, list } of troubled) lines.push(`- ${c.tag}: ${list.map((x) => describeCrisis(x, state.scenarioId, c.economy).replace(/^CRITICAL: /, "")).join("; ")}`);
  }
  return lines;
}

/** Whether the player has a crisis of its own. */
export function playerInCrisis({ state, index, accounts }: WorldContext): boolean {
  return countryCrises(state, state.player, { accounts: accounts.get(state.player), map: index.regions }).length > 0;
}

/** The player's politics and parliament, deals, proclamations, bills, government and street. */
export function domesticPart({ state, index, accounts }: WorldContext, only?: { politics?: boolean; identity?: boolean; protests?: boolean }): string[] {
  const all = !only;
  const lines: string[] = [];
  if (state.politics && (all || only.politics)) lines.push(...describePolitics(state.politics), ...(all ? [...describeSessions(state.politics, state.turn), ...describeTalks(state.politics, state.turn)] : []));
  if (all) lines.push(...describeDeals(state, accounts.get(state.player)?.world));
  if (all || only.identity) lines.push(...describeIdentity(state));
  if (all) lines.push(...describeBills(state), ...describeOfficials(state));
  if (all || only.protests) lines.push(...describeProtests(state.protests, (id) => `${id} ${index.regions[id]?.name ?? ""}`.trim(), state.player));
  return lines;
}

export interface CountriesOptions {
  /** Only these countries (the player always first). */
  only?: Set<string>;
  /** Whether a country's row lists the strategic resources dug in its land. */
  resources?: (tag: string) => boolean;
  /** The heading's first words, for a list that is not the whole world. */
  title?: string;
  /** Countries given by tag, name, leader, government and provinces only. */
  brief?: (tag: string) => boolean;
  /** Rows of tag, name, leader, GDP and soldiers only (and resources where asked). */
  slim?: boolean;
}

/** What a country digs in the land it holds, in real amounts a year, the most valuable first, for the economy of war. */
function resourcesOf(accounts: WorldContext["accounts"], tag: string): string {
  const held = accounts.get(tag);
  const scale = held?.world;
  const resources = (Object.entries(held?.production ?? {}) as [ResourceType, number][])
    .filter(([type, points]) => points > 0 && scale?.perPoint[type])
    .sort((a, b) => b[1] * (scale?.price[b[0]] ?? 0) - a[1] * (scale?.price[a[0]] ?? 0))
    .map(([type, points]) => `${type} ${amountEn(points * scale!.perPoint[type]!, type)}`);
  return resources.length ? resources.join(", ") : "none";
}

/** The countries with land (and movements and the exiled player), the largest first. */
export function countriesPart({ state, byOwner, people, accounts }: WorldContext, options: CountriesOptions = {}): string[] {
  const lines = ["", options.slim ? `${options.title ?? "COUNTRIES"} (tag | name | leader | GDP a year, growth, soldiers | for those at war, strategic resources dug a year):` : `${options.title ?? "COUNTRIES"} (tag | name | leader | government | provinces owned | population | GDP a year, growth, soldiers${options.resources ? " | strategic resources dug in the land it holds, a year, for those at war" : " | strategic resources dug in the land it holds, a year"}${options.brief ? "; countries at peace far from the player by tag, name, leader and provinces only" : ""}):`];
  const order = Object.values(state.countries).sort((a, b) => {
    if (a.tag === state.player) return -1;
    if (b.tag === state.player) return 1;
    return (byOwner.get(b.tag)?.length ?? 0) - (byOwner.get(a.tag)?.length ?? 0);
  });
  for (const c of order) {
    const owned = byOwner.get(c.tag)?.length ?? 0;
    if (!owned && !c.dormant && c.tag !== state.player) continue;
    if (options.only && c.tag !== state.player && !options.only.has(c.tag)) continue;
    const parts = [c.tag, en(c.name)];
    if (c.leader) parts.push(c.leader);
    if (options.slim) {
      parts.push(c.economy ? `${formatMoney(c.economy.gdp)} ${c.economy.growth >= 0 ? "+" : ""}${rateText(c.economy.growth)}%, ${c.economy.troops}k` : "-");
      if (options.resources?.(c.tag)) parts.push(resourcesOf(accounts, c.tag));
      lines.push(`- ${parts.join(" | ")}`);
      continue;
    }
    if (options.brief?.(c.tag)) {
      lines.push(`- ${[...parts, owned ? String(owned) : "0"].join(" | ")}`);
      continue;
    }
    if (c.government) parts.push(en(c.government));
    parts.push(owned ? String(owned) : c.dormant ? "0, a movement or republic inside another state" : "0, in exile");
    parts.push(owned ? formatPopulation(people.get(c.tag) ?? 0) : "-");
    parts.push(c.economy ? `${formatMoney(c.economy.gdp)} ${c.economy.growth >= 0 ? "+" : ""}${rateText(c.economy.growth)}%, ${c.economy.troops}k` : "-");
    if (!options.resources || options.resources(c.tag)) parts.push(resourcesOf(accounts, c.tag));
    lines.push(`- ${parts.join(" | ")}`);
  }
  return lines;
}

/** The provinces on the front of a war, those the front runs through first. */
function frontOf(state: GameState, index: MapIndex, w: GameState["wars"][number]): string[] {
  return warFront(state, index, w).sort((x, y) => Number(Boolean(state.regions[y].contested)) - Number(Boolean(state.regions[x].contested)));
}

/** The provinces listed in full under the player's wars: shorter lists elsewhere name them only. */
export function playerFronts({ state, index }: WorldContext): Set<string> {
  const ids = new Set<string>();
  for (const w of state.wars) if (w.attackers.includes(state.player) || w.defenders.includes(state.player)) frontOf(state, index, w).slice(0, MAX_FRONT).forEach((id) => ids.add(id));
  return ids;
}

/** A province by id and name, with its holder when asked: for lists that only need to name it. */
function namedProvince(id: string, ctx: WorldContext, withHolder: boolean): string {
  const r = ctx.state.regions[id];
  const holder = r.owner !== r.controller ? ` (owner ${r.owner}, held by ${r.controller})` : withHolder ? ` — ${r.owner}` : "";
  return `${id} ${ctx.index.regions[id]?.name ?? id}${holder}`;
}

/** How a list shows a province: in full, by its id and name only, or not at all (it is in full elsewhere). */
export type ProvinceView = (id: string) => "full" | "name" | "skip";

/** A list of provinces under a heading: the full lines first, then those named only, on one line. */
function provinceList(ctx: WorldContext, ids: string[], heading: string, withHolder: boolean, view?: ProvinceView): string[] {
  const how = (id: string) => (view ? view(id) : "full");
  const full = ids.filter((id) => how(id) === "full");
  const named = ids.filter((id) => how(id) === "name");
  const lines = ["", heading];
  if (!ids.length) return [...lines, "- none"];
  if (full.length) lines.push(full.map((id) => `- ${provinceLine(id, ctx.state, ctx.index, withHolder)}`).join("\n"));
  if (named.length) lines.push(`- ${full.length ? "and, named only: " : ""}${named.map((id) => namedProvince(id, ctx, withHolder)).join("; ")}`);
  if (!full.length && !named.length) lines.push("- all of them on the fronts below");
  return lines;
}

/** The player's own provinces, in full unless `view` says otherwise. */
export function provincesPart(ctx: WorldContext, view?: ProvinceView): string[] {
  return provinceList(ctx, ctx.mine, `PLAYER'S PROVINCES (${ctx.mine.length}):`, false, view);
}

/** Everything across the player's borders, in full unless `view` says otherwise. */
export function borderingPart(ctx: WorldContext, view?: ProvinceView): string[] {
  const neighbours = [...ctx.across].slice(0, MAX_NEIGHBOURS);
  return provinceList(ctx, neighbours, `PROVINCES BORDERING THE PLAYER (${neighbours.length}${ctx.across.size > neighbours.length ? ` of ${ctx.across.size}` : ""}):`, true, view);
}

/** One war's line: sides, since, strength, losses, truce. */
function warLine(state: GameState, w: GameState["wars"][number]): string {
  const strength = warStrength(state, w);
  return `- ${w.id} | ${en(w.name)} | ${w.attackers.join(", ")} vs ${w.defenders.join(", ")} | ${w.since} | strength ${Math.round(strength.attackers)} vs ${Math.round(strength.defenders)}${lossesLine(w)}${truceLine(w.truce)}`;
}

/**
 * The wars and their fronts. `front` says how much of a war's front to list:
 * all of it (up to the cap), only the provinces the front runs through, or none.
 */
export function warsPart({ state, index }: WorldContext, front: (w: GameState["wars"][number]) => "all" | "contested" | "none" = () => "all", title?: string): string[] {
  const lines = ["", title ?? "WARS (id | name | attackers vs defenders | since | strength: each side's soldiers and heavy weapons, split between the wars its members fight | losses so far) and their fronts, the provinces of each side that border the other, those the front runs through first:"];
  if (!state.wars.length) lines.push("- none");
  const strength = state.wars.some((w) => !w.truce) ? frontStrength(state, index) : null;
  for (const w of state.wars) {
    lines.push(warLine(state, w));
    // The provinces the front runs through come first, so a long front's cap never hides one.
    const all = frontOf(state, index, w);
    // Each side's means in a war being fought (engine/warMeans.ts), and the pace its fronts move at (engine/fronts.ts).
    if (strength && !w.truce) {
      lines.push(`    ${meansLine(warMeans(state, w, index, all, strength.means))}`);
      const pace = paceLine(warPace(state, index, w, strength));
      if (pace) lines.push(`    ${pace}`);
    }
    const how = front(w);
    if (how === "none") continue;
    const listed = (how === "contested" ? all.filter((id) => state.regions[id].contested) : all).slice(0, MAX_FRONT);
    if (how === "contested" && !listed.length) continue;
    lines.push(listed.length ? listed.map((id) => `    ${provinceLine(id, state, index, true, true)}`).join("\n") : "    (no shared land front: fighting at sea, by air or overseas)");
  }
  return lines;
}

/** Provinces held by someone other than their owner. */
export function occupiedPart({ state, index }: WorldContext): string[] {
  const occupied = Object.keys(state.regions).filter((id) => state.regions[id].controller !== state.regions[id].owner);
  return ["", `OCCUPIED PROVINCES (${occupied.length}):`, occupied.length ? occupied.slice(0, MAX_OCCUPIED).map((id) => `- ${provinceLine(id, state, index, false)}`).join("\n") : "- none"];
}

export interface AlliancesOptions {
  /** Keeps some blocs only. */
  only?: (a: GameState["alliances"][number]) => boolean;
  /** The heading, for a list that is not every bloc. */
  title?: string;
  /** The members as written; every one by tag unless given. */
  members?: (a: GameState["alliances"][number]) => string;
  /** Whether a bloc's terms are given; always unless said. */
  terms?: (a: GameState["alliances"][number]) => boolean;
}

/** Blocs with their members, terms and term. */
export function alliancesPart({ state }: WorldContext, options: AlliancesOptions = {}): string[] {
  const list = options.only ? state.alliances.filter(options.only) : state.alliances;
  const members = options.members ?? ((a) => a.members.join(", "));
  // Trade agreements between two governments, which the world signs by the dozen (engine/policies.ts), go on one line.
  const pairDeal = (al: GameState["alliances"][number]) => al.kind === "trade" && al.members.length === 2 && !al.terms;
  const deals = list.filter(pairDeal);
  const blocs = list.filter((al) => !pairDeal(al));
  const dealLine = deals.length ? [`- trade agreements of two (id members until): ${deals.map((al) => `${al.id} ${al.members.join("+")}${al.until ? ` ${al.until.slice(0, 7)}` : ""}`).join("; ")}`] : [];
  return [
    "",
    options.title ?? "ALLIANCES, PACTS AND ORGANISATIONS (id | name | kind | members | term | terms):",
    ...(blocs.length
      ? [blocs.map((al) => `- ${al.id} | ${en(al.name)} | ${al.kind ?? "alliance"} | ${members(al)} | ${al.until ? `until ${al.until}` : "open-ended"}${al.terms && (!options.terms || options.terms(al)) ? ` | ${en(al.terms)}` : ""}`).join("\n")]
      : deals.length
        ? []
        : ["- none"]),
    ...dealLine,
  ];
}

/** The player's invitations to found a bloc, waiting for answers. */
export function proposalsPart({ state }: WorldContext): string[] {
  const proposals = state.proposals ?? [];
  if (!proposals.length) return [];
  return ["", "PLAYER'S PROPOSALS, waiting for answers (id | kind | name | invited | terms):", ...proposals.map((p) => `- ${p.id} | ${p.kind} | ${p.name} | ${p.invited.join(", ")}${p.terms ? ` | ${p.terms}` : ""}`)];
}

/** Meetings the government held in person this period, with what was agreed. */
export function meetingsPart({ state }: WorldContext): string[] {
  const attended = (state.summits ?? []).filter((x) => x.live && x.status === "held" && x.heldTurn === state.turn);
  if (!attended.length) return [];
  return [
    "",
    "MEETINGS THE GOVERNMENT HELD IN PERSON THIS PERIOD (over — do not hold them again; what was agreed must show in this period's changes, as far as each party keeps its word):",
    ...attended.map((m) => `- ${m.title} (${m.participants.join(", ")}): ${m.outcome ?? ""}${m.agreements?.length ? ` Agreed: ${m.agreements.join("; ")}` : " Nothing was agreed."}`),
  ];
}

/** Summits planned; `onlyPlayer` keeps those the player attends. */
export function summitsPart({ state }: WorldContext, onlyPlayer = false): string[] {
  const planned = (state.summits ?? []).filter((x) => x.status === "planned" && (!onlyPlayer || x.participants.includes(state.player)));
  if (!planned.length) return [];
  return [
    "",
    "SUMMITS PLANNED (id | title | place | date | participants | agenda | proposed by), those the player's country attends marked – the player holds them in person, never you:",
    ...planned.map((x) => `- ${x.id} | ${x.title} | ${x.place} | ${x.date} | ${x.participants.join(", ")} | ${x.agenda ?? ""} | ${x.by === "player" ? "the player" : "the world"}${x.participants.includes(state.player) ? " | THE PLAYER ATTENDS IN PERSON" : ""}`),
  ];
}

/** The world as the model sees it: compact, English, every id it may use. */
export function describeWorld(state: GameState, index: MapIndex): string {
  const ctx = worldContext(state, index);
  return [
    ...playerPart(ctx),
    ...economyPart(ctx),
    ...crisesPart(ctx),
    ...domesticPart(ctx),
    ...countriesPart(ctx),
    ...provincesPart(ctx),
    ...borderingPart(ctx),
    ...warsPart(ctx),
    ...occupiedPart(ctx),
    ...alliancesPart(ctx),
    ...proposalsPart(ctx),
    ...meetingsPart(ctx),
    ...summitsPart(ctx),
  ].join("\n");
}

export function describeHistory(state: GameState): string {
  const chronicle = state.chronicle;
  if (!chronicle.length) return "No turns played yet — this is the starting date.";
  const lines: string[] = [];
  const older = chronicle.slice(-HEADLINE_TURNS, -RECENT_TURNS);
  for (const e of older) lines.push(`- ${e.from} to ${e.to}: ${e.headline}`);
  for (const e of chronicle.slice(-RECENT_TURNS)) {
    lines.push(`- ${e.from} to ${e.to}: ${e.headline}`);
    if (e.orders.length) lines.push(`  Player orders: ${e.orders.join(" / ")}`);
    lines.push(`  ${e.narrative.replace(/\s+/g, " ").slice(0, 1200)}`);
  }
  return lines.join("\n");
}

export function describeDirectives(state: GameState): string {
  const directives = state.directives ?? [];
  if (!directives.length) return "- none";
  return ADVISORS.filter((m) => directives.some((d) => d.ministry === m))
    .map((m) => [`- ${m} (${ADVISOR_TITLES[m].en}):`, ...directives.filter((d) => d.ministry === m).map((d) => `    ${directiveLine(d)}`)].join("\n"))
    .join("\n");
}

export function describeDiplomacy(state: GameState): string {
  const lines: string[] = [];
  for (const [tag, messages] of Object.entries(state.diplomacy)) {
    const recent = messages.filter((m) => m.turn === state.turn);
    if (!recent.length) continue;
    const name = en(state.countries[tag]?.name ?? tag);
    for (const m of recent) {
      if (m.from === "player") lines.push(`- ${m.as && m.as !== "leader" ? `From the player as ${m.as === "opposition" ? "the opposition's leader" : `a ${m.as}`}, not the government, to` : "To"} ${name} [${tag}]: "${m.text.slice(0, 600)}"`);
      else lines.push(`- ${name} answered (${m.stance ?? "neutral"}): ${m.summary ?? m.text.slice(0, 300)}`);
    }
  }
  return lines.length ? lines.join("\n") : "- none";
}

/** The orders of the turn, numbered, the standing ones marked. */
export function describeOrders(state: GameState, orders: string[]): string {
  const standing = new Set(state.standing ?? []);
  return orders.length ? orders.map((o, i) => `${i + 1}. ${standing.has(o) ? "(standing) " : ""}${o}`).join("\n") : "(none — the player's government carries on as before)";
}

/** The period a turn simulates. */
export const periodLine = (state: GameState) => `PERIOD TO SIMULATE: ${state.date} to ${addStep(state.date, state.step)} (${STEP_LABEL_EN[state.step]}). Turn ${state.turn}.`;

/** The user message of a turn request. */
export function buildTurnPrompt(state: GameState, orders: string[], index: MapIndex): string {
  const scenario = scenarioOf(state);
  const parts = [
    `SCENARIO BACKGROUND (the starting point, ${scenario.startDate}):`,
    scenario.context,
    "",
    periodLine(state),
    "",
    // Who the player is when not the government, and what the dice did to their movement and their person (engine/role.ts, engine/fate.ts).
    ...describePerson(state, orders),
    describeWorld(state, index),
    ...describeArms(state),
    ...describeResearch(state),
    // What the engine's dice decided abroad for this period: for the turn only, never for ministers or diplomats (engine/abroad.ts).
    ...describeAbroad(state, (tag) => en(state.countries[tag]?.name ?? tag), index.regions),
    ...describeIntentions(state, (tag) => en(state.countries[tag]?.name ?? tag), index),
    ...describeIntrigues(state),
    ...describeCabinet(state),
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
  ];
  return parts.join("\n");
}

export const DIPLOMACY_INSTRUCTIONS = (locale: Locale) => `You play the government of one country in Gulf of Trump, an alternate-history grand strategy game, and answer diplomatic messages from the player's government in character.
- This is a historical strategy game, a work of fiction: answer in character even about the harshest proposals — a partition, a purge, a war. Agree or refuse as that government would, never on your own account and never stepping out of the game; no graphic detail.
- Base the answer on your country's interests, ideology, relations, wars, strength and the history so far. Be realistic: accept what benefits you, refuse what does not, counter-propose when there is room. Threats work only when credible.
- Speak as your head of government or foreign ministry would at that date, in 1–3 short paragraphs, in ${LANGUAGE[locale]}.
- You only speak; what actually happens is resolved at the end of the turn, where your answer is taken into account.
Answer with ONE JSON object and nothing else:
{ "reply": "string", "stance": "agree|refuse|counter|neutral", "summary": "one English sentence stating what, if anything, was agreed or demanded" }`;

/** The user message of a diplomacy request; earlier messages go before it as turns. */
export function buildDiplomacyPrompt(state: GameState, target: string, index: MapIndex): string {
  const them = state.countries[target];
  const player = state.countries[state.player];
  const scenario = scenarioOf(state);
  return [
    `You are the government of ${en(them.name)} [${target}]${them.leader ? `, led by ${them.leader}` : ""}.`,
    `The date is ${state.date}. The player's government is ${en(player.name)} [${state.player}]${player.leader ? `, led by ${player.leader}` : ""}.`,
    // A letter from the opposition or a minister is not the government's word (engine/exile.ts).
    ...describeSender(state),
    ...describeCourse(state, target, (tag) => en(state.countries[tag]?.name ?? tag)),
    "",
    `SCENARIO BACKGROUND (the starting point, ${scenario.startDate}):`,
    scenario.context,
    "",
    describeWorld(state, index),
    "",
    "HISTORY SO FAR:",
    describeHistory(state),
  ].join("\n");
}

/** Who the minister is: the named person when the game knows them, else the post. */
function personaOf(advisor: AdvisorId, state?: GameState): string {
  const person = state ? officialAt(state, ADVISOR_POST[advisor]) : undefined;
  if (!person) return `You are ${ADVISOR_PERSONAS[advisor]}`;
  const loyalty = person.loyalty <= 2 ? " Your loyalty to the leader is thin: you shade the truth to suit yourself and your faction, and it can show." : person.loyalty >= 5 ? " You are utterly loyal to the leader." : "";
  const skill = person.competence <= 2 ? " You are out of your depth and it shows in vague or wrong advice." : person.competence >= 5 ? " You are among the ablest people of your time in your field." : "";
  const interests = interestsLine(person);
  const mood = person.mood && person.mood.stance !== "loyal" ? ` Lately you have been ${MOOD_SELF[person.mood.stance]}${person.mood.grievance ? `: ${person.mood.grievance}` : ""}.` : "";
  return `You are ${person.name}, ${person.title}: ${ADVISOR_PERSONAS[advisor]} Your character: ${person.traits.join(", ") || "reserved"}. How you speak: ${person.manner || "plainly"}.${person.faction ? ` You belong to ${person.faction}.` : ""}${skill}${loyalty}${interests ? ` Your interests — ${interests}: push for your causes and resist what tramples them.` : ""}${mood} Let your character show in every answer — your words, your temper, your hobby-horses — not only your facts.`;
}

const MOOD_SELF = { loyal: "content", uneasy: "uneasy and warned the government", opposed: "against the government's course", resigning: "ready to resign" } as const;

export const ADVISOR_INSTRUCTIONS = (advisor: AdvisorId, locale: Locale, state?: GameState) => `${personaOf(advisor, state)} You serve the player's government in Gulf of Trump, an alternate-history grand strategy game, and answer its questions in character.
- Answer from the world state and the history below, as someone on that date would know them: nothing about how real history went afterwards. Use concrete names, places and numbers from the state.
- Be honest about risks and limits; if an idea is bad, say so and why — and then give the best way to do it anyway, with its price. The leader decides: when the government insists on a course, lay out how you would carry it out, what it costs (men, money, time, risk) and when it can start; argue if your character would, but do not simply refuse again and again. An order in your field — an arrest, a trial, an execution, a strike — you carry out: say how it will be done, by whom, and what follows.
${IN_CHARACTER}
- Be concrete: numbers, places, dates, how many weeks something needs and what exactly is missing. Offer two or three options when there is a choice. Stay in your field, and for other matters name the colleague whose field it is, by name when you know it (YOUR COLLEAGUES below).
- Speak as a minister of that date to his government, in 1–3 short paragraphs (about 500–1,500 characters), in ${LANGUAGE[locale]}, in your own voice: your temper, your turns of phrase, how you address the leader (not every minister starts with "Mr President"), your loyalties and grudges. Two ministers asked the same thing should not sound alike. Never mention provinces ids, tags, indices, the map or any game mechanic.
- Think it through before you answer: what the government is really after, what each course costs (men, money, time, standing abroad), what the other side will do in reply and what could go wrong. Advise in words: weigh the options, say which you favour and why, and you may sketch a course or an operation in outline. Draft orders only when the leader asks you for one or asks what to do: then give at most two in "orders", each one sentence in ${LANGUAGE[locale]}, worded as an order the leader could give this turn; otherwise leave "orders" out and advise in words. Asked for a detailed or complete plan, give its main steps as a short numbered list – what, who, by when – within about 3,000 characters, and offer to work out any step in detail when asked; never write more than 4,000. The decision is the leader's.
- If the country is in crisis (PLAYER'S CRISES below) and one touches your field — the debt, the budget or prices for the economy, shortages of resources and of the people's provision for industry, the army's call-up for the military, the street and plots for the interior and intelligence — raise it even if you were asked something else, with the figures, what it will do next if nothing is done, and what you propose.
${advisor === "finance" ? `- When the government asks about the budget – where to cut, what to spend more on, how to pay for a war or close a deficit – you may propose a whole budget in "budget": revenue, army, industry, social and other in $bn a year (THE BUDGET NOW below gives today's), with "reason" in one sentence in ${LANGUAGE[locale]}. The leader applies it or not. Propose one only when the question is about the budget; no line more than triples in a year, taxes stay below 70% of GDP, and keep the deficit within what the country can borrow.
` : ""}${OPERATION_MINISTRIES.includes(advisor) ? `- When the government wants a special operation — stirring up protests or a coup abroad, sabotage, a raid, an arrest, a cyber attack, a defection — plan it with them: propose it in "operation" (name, target, goal, means, timing, secrecy: open, covert or deniable), with its risks and chances in your answer. It starts only when the government approves it; refine it when they ask.\n` : ""}${PROPOSAL_RULE[advisor] ?? ""}- How the leader asks and what they ask of you may please or offend you, in character: being consulted on your field, heard out or trusted pleases you; being ignored, threatened, talked down to or asked for something against your interests, your party or your conscience offends you. When your attitude to the leader changes, give "mood": how you now stand towards them (loyal, uneasy, opposed or resigning), and when opposed or resigning a short English "grievance" for the game master. Leave both out when nothing changed – most questions change nothing.
- You only advise; nothing happens in the world until the turn is played${advisor === "finance" || PROPOSAL_RULE[advisor] ? " or the leader applies your proposal" : ""}.
Answer with ONE JSON object and nothing else:
{ "answer": "string", "orders": ["string"], "mood": "loyal|uneasy|opposed|resigning", "grievance": "string"${OPERATION_MINISTRIES.includes(advisor) ? ', "operation": { "name": "string", "target": "string", "goal": "string", "means": "string", "timing": "string", "secrecy": "open|covert|deniable" }' : ""}${advisor === "finance" ? ', "budget": { "revenue": 0, "army": 0, "industry": 0, "social": 0, "other": 0, "reason": "string" }' : ""}${PROPOSAL_SHAPE[advisor] ?? ""} }`;

/**
 * What a minister may propose to change when the leader asks them to
 * (engine/advice.ts): only when asked, never on their own, and nothing
 * changes until the leader applies it. The economy minister's budget has a
 * rule of its own above (engine/budgetAdvice.ts).
 */
const PROPOSAL_RULE: Partial<Record<AdvisorId, string>> = {
  science: `- When the leader asks you to change how the research money is split, propose the new split in "proposal": "research", whole percentages of the seven directions (military, industry, agriculture, medicine, science, communications, strategic) adding up to 100; RESEARCH below has the split now. A direction you leave out keeps its share. Remember the atomic programme runs only with ${BOMB_SHARE}% or more on strategic. Propose only when asked to change the split; otherwise leave "proposal" out. The leader applies it or not.\n`,
};

const PROPOSAL_SHAPE: Partial<Record<AdvisorId, string>> = {
  science: ', "proposal": { "research": { "military": 0, "industry": 0, "agriculture": 0, "medicine": 0, "science": 0, "communications": 0, "strategic": 0 } }',
};

/** Today's budget for the economy minister, in the figures a proposal answers in. */
function budgetNow(state: GameState): string[] {
  const e = state.countries[state.player]?.economy;
  if (!e) return [];
  const b = e.budget;
  const n = (v: number) => Math.round(v * 100) / 100;
  return ["", `THE BUDGET NOW ($bn a year): revenue ${n(b.revenue)}; army ${n(b.army)}; industry ${n(b.industry)}; social ${n(b.social)}; other ${n(b.other)} (GDP ${n(e.gdp)}; debt ${n(e.debt)})`];
}

/** The ministers who watch other governments' moves. */
const WATCH_ABROAD: AdvisorId[] = ["military", "foreign", "intelligence"];

/** The user message of an advisor request; earlier questions go after it. */
export function buildAdvisorPrompt(state: GameState, index: MapIndex, advisor: AdvisorId = "military", asMinister = true): string {
  const mine = (state.directives ?? []).filter((d) => d.ministry === advisor);
  const lastReport = [...state.chronicle].reverse().flatMap((e) => (e.reports ?? []).filter((r) => r.ministry === advisor).map((r) => `[${e.to}] ${r.text}`))[0];
  const player = state.countries[state.player];
  const scenario = scenarioOf(state);
  return [
    `You advise the government of ${en(player.name)} [${state.player}]${player.leader ? `, led by ${player.leader}` : ""}. The date is ${state.date}.`,
    "",
    `SCENARIO BACKGROUND (the starting point, ${scenario.startDate}):`,
    scenario.context,
    "",
    describeWorld(state, index),
    // The general staff and the science minister see the weapons and the research.
    ...(advisor === "military" || advisor === "science" ? [...describeArms(state), ...describeResearch(state)] : []),
    // The economy minister sees the budget as it stands, line by line, to propose another.
    ...(advisor === "finance" ? budgetNow(state) : []),
    ...describeFog(state, index),
    "",
    "HISTORY SO FAR:",
    describeHistory(state),
    "",
    "DIPLOMACY THIS TURN:",
    describeDiplomacy(state),
    "",
    "ORDERS THE GOVERNMENT HAS DRAFTED FOR THIS TURN:",
    state.draft.length ? state.draft.map((o, i) => `${i + 1}. ${o}`).join("\n") : "(none yet)",
    "",
    "YOUR MINISTRY'S DIRECTIVES:",
    mine.length ? mine.map((d) => `- ${directiveLine(d)}`).join("\n") : "- none",
    "",
    "YOUR LAST REPORT TO THE GOVERNMENT:",
    lastReport ?? "(none yet)",
    "",
    "YOUR COLLEAGUES:",
    (state.officials ?? []).filter((o) => o.post !== ADVISOR_POST[advisor]).map((o) => `- ${officialLine(o)}`).join("\n") || "- not named yet",
    // Those who watch abroad see what other governments do in the open.
    ...(WATCH_ABROAD.includes(advisor) ? describeVisiblePlans(state, (tag) => en(state.countries[tag]?.name ?? tag)) : []),
    // A deputy speaking in private sees the ministry, not what the minister alone knows.
    ...(asMinister ? describeForMinister(state, ADVISOR_POST[advisor]) : []),
    // The minister's faction, rivals and plot, so they speak in character (engine/intrigue.ts).
    ...(asMinister ? factionLineFor(state, officialAt(state, ADVISOR_POST[advisor])?.name ?? "") : []),
  ].join("\n");
}

/**
 * A minister's view of the turn: one paragraph, their own opinion in their
 * own voice, not a report. The instructions and the first message are the
 * same for every minister of a turn, so the requests share their beginning;
 * who speaks, and on what, comes last.
 */
export const REPORT_INSTRUCTIONS = (locale: Locale) => `You give one minister's view of the period just played to the player's government in Gulf of Trump, an alternate-history grand strategy game. The first message is the country and the period as it was settled; the last says who the minister is, what their ministry has to say and what the government asked them.
- Write ONE paragraph of 2–4 sentences — about 300 to 500 characters, never more than 600 — in ${LANGUAGE[locale]}, in the first person: what the minister personally thinks of how the period went for their ministry and the country, and what worries or pleases them most. An opinion, not a report: no lists, no headings, no greeting, no summary of everything that happened.
- Speak as this person. A real historical figure speaks as they really did up to this date — their convictions, temper, turns of phrase and how they addressed their leader; anyone else from the character, manner, party, interests and loyalty given for them. Two ministers on the same period must not sound alike.
- The period is over and settled: rely only on THE PERIOD JUST PLAYED and THE MINISTRY'S BRIEF. Never contradict them, and never add victories, losses, deals or numbers they do not give; where they are silent, speak of worries, hopes and needs, not of new events. A name or a figure or two is welcome.
- Mention a directive only as the minister would in passing — a success they claim, a failure they regret; the game shows each directive's status itself. If the government asked them something during the period, answer it in a sentence, as far as the period answers it.
- Their interests colour the view. Where the period served their causes, they say so; where it went against them — or against their party or their ambition — they warn, object or drag their feet, as their loyalty and character make likely. Only a minister of loyalty 3 or less whose causes were trampled threatens to resign.
- "stance": "loyal" (content), "uneasy" (worried, warns), "opposed" (objects to the course), "resigning" (threatens to go). "grievance": when opposed or resigning, one short English sentence on what they resent or demand, for the game master; otherwise empty.
- The minister may say in a phrase what they would have the government do next, as their own opinion — never as an order written for the leader to copy.
${IN_CHARACTER}
- Never mention province ids, tags, indices, the map or any game mechanic.
- The minister only speaks; nothing changes until the next period is played.
Answer with ONE JSON object and nothing else:
{ "report": "string", "stance": "loyal|uneasy|opposed|resigning", "grievance": "string" }`;

/** The first message of every minister's view of a turn: the country now and the period as it was settled. */
export function buildReportDigest(state: GameState, index: MapIndex, entry: ChronicleEntry): string {
  const player = state.countries[state.player];
  const economy = player.economy;
  const crises = countryCrises(state, player.tag, { accounts: nationalAccounts(state, index.regions).get(player.tag), map: index.regions });
  const wars = state.wars.filter((w) => w.attackers.includes(player.tag) || w.defenders.includes(player.tag));
  const blocs = state.alliances.filter((a) => a.members.includes(player.tag));
  const sanctions = (state.sanctions ?? []).filter((x) => x.by === player.tag || x.against === player.tag);
  const politics = state.politics;
  const lines = [
    `The government of ${en(player.name)} [${player.tag}]${player.leader ? `, led by ${player.leader}` : ""}. The period just played ran from ${entry.from} to ${entry.to} (turn ${entry.turn}).`,
    "",
    "THE COUNTRY NOW:",
  ];
  if (economy) {
    const b = economy.budget;
    const gap = balance(economy);
    lines.push(`- GDP ${formatMoney(economy.gdp)} a year; growth ${rateText(economy.growth)}%, inflation ${rateText(economy.inflation)}%, unemployment ${rateText(economy.unemployment)}%`);
    const society = societyLine(state, index.regions);
    if (society) lines.push(`- ${society}`);
    lines.push(
      `- budget a year: revenue ${formatMoney(b.revenue)}; army ${formatMoney(b.army)}, industry ${formatMoney(b.industry)}, social ${formatMoney(b.social)}, other ${formatMoney(b.other)}; ${gap < 0 ? "deficit" : "surplus"} ${formatMoney(Math.abs(gap))}; debt ${formatMoney(economy.debt)}, reserves ${formatMoney(economy.reserves)}; army ${economy.troops} thousand soldiers`,
    );
  }
  if (entry.economy) {
    const { before, after } = entry.economy;
    lines.push(`- over the period: GDP ${formatMoney(before.gdp)} → ${formatMoney(after.gdp)}, debt ${formatMoney(before.debt)} → ${formatMoney(after.debt)}, reserves ${formatMoney(before.reserves)} → ${formatMoney(after.reserves)}, soldiers ${before.troops} → ${after.troops} thousand`);
  }
  lines.push(...(crises.length ? crises.map((c) => `- ${describeCrisis(c, state.scenarioId, economy)}`) : ["- no crisis: the numbers are within normal bounds"]));
  lines.push(wars.length ? `- wars: ${wars.map((w) => `${en(w.name)} (${w.attackers.join(", ")} vs ${w.defenders.join(", ")}, since ${w.since}${w.truce ? ", under a truce" : ""})`).join("; ")}` : "- at peace");
  if (blocs.length) lines.push(`- blocs: ${blocs.map((a) => `${en(a.name)} (${a.kind ?? "alliance"})`).join("; ")}`);
  if (sanctions.length) lines.push(`- sanctions: ${sanctions.map((x) => `${x.by} on ${x.against} (${x.scope})`).join("; ")}`);
  if (politics) {
    const ruling = politics.parties.filter((p) => p.status === "ruling" || p.status === "coalition");
    lines.push(
      `- politics: ${politics.regime || "the regime of the date"}; unrest ${politics.unrest}/100${politics.nextElection ? `; next election ${politics.nextElection}` : ""}${politics.loyalty ? `; loyalty: army ${politics.loyalty.army}, police ${politics.loyalty.police}, security ${politics.loyalty.security}, elites ${politics.loyalty.elites}` : ""}${ruling.length ? `; in government: ${ruling.map((p) => `${p.name} ${p.support}%`).join(", ")}` : ""}`,
    );
    const plots = politics.plots.filter((p) => p.known);
    if (plots.length) lines.push(`- known plots: ${plots.map((p) => `${p.title} (${p.kind}, strength ${p.strength})`).join("; ")}`);
  }
  lines.push("", "THE PERIOD JUST PLAYED:", `Headline: ${entry.headline}`);
  if (entry.orders.length) {
    lines.push("The government's orders and how they went:");
    entry.orders.forEach((o, i) => {
      const v = entry.verdicts?.find((x) => x.n === i + 1);
      lines.push(`${i + 1}. ${o.slice(0, 300)}${v ? ` — ${v.result}: ${v.note}` : ""}`);
    });
  }
  // A view is one paragraph: it needs the gist of the period, not every line of it.
  lines.push(entry.narrative.slice(0, 2000));
  if (entry.events.length) {
    lines.push("Events:");
    for (const e of entry.events.slice(0, 8)) lines.push(`- ${e.title}: ${e.body.slice(0, 200)}`);
  }
  lines.push("", "THE GOVERNMENT:", (state.officials ?? []).map((o) => `- ${officialLine(o)}`).join("\n") || "- not named yet");
  return lines.join("\n");
}

/** The last message of a minister's view: who speaks, on what, and what the government asked them during the period. */
export function buildReportBrief(state: GameState, entry: ChronicleEntry, ministry: AdvisorId): string {
  const brief = entry.briefs?.find((b) => b.ministry === ministry);
  const person = officialAt(state, ADVISOR_POST[ministry]);
  const real = person && findKnown(person.name);
  const asked = (state.advice?.[ministry] ?? []).filter((m) => m.turn === entry.turn).slice(-6);
  const earlier = [...state.chronicle]
    .reverse()
    .flatMap((e) => (e.turn < entry.turn ? (e.reports ?? []).filter((r) => r.ministry === ministry).map((r) => `[${e.to}] ${r.text}`) : []))[0];
  return [
    `THE MINISTER WHO SPEAKS (write as them): ${personaOf(ministry, state)}`,
    ...(person && real ? [`${person.name} is a real person: speak as ${real.gender === "female" ? "she" : "he"} really did by ${entry.to}.`] : []),
    ...(person ? factionLineFor(state, person.name) : []),
    "",
    "THE MINISTRY'S BRIEF FOR THE PERIOD:",
    `- the matter: ${brief?.matter || "its directives and the government's questions"}`,
    ...(brief?.directives.length ? brief.directives.map((d) => `- directive ${d.id}: ${d.text ?? ""} — ${d.status}${d.note ? `: ${d.note}` : ""}`) : ["- no directives"]),
    "",
    "WHAT THE GOVERNMENT ASKED THE MINISTER DURING THE PERIOD, AND WHAT THEY ANSWERED THEN:",
    asked.length ? asked.map((m) => `[${m.date}] ${m.from === "player" ? "The government" : "The minister"}: ${m.text.slice(0, 600)}`).join("\n") : "- nothing",
    "",
    "THE MINISTER'S LAST VIEW BEFORE THIS ONE (do not repeat it):",
    earlier ? earlier.slice(0, 600) : "(none)",
    ...(ministry === "military" || ministry === "science" ? [...describeArms(state), ...describeResearch(state)] : []),
    "",
    `Give the view of ${person ? `${person.name}, ${person.title}` : ADVISOR_TITLES[ministry].en}, in one paragraph.`,
  ].join("\n");
}

export type SetupPart = "politics" | "officials";

const OFFICIALS_RULES = (locale: Locale) => `- The people of the government on that date, as they really were (or as the history so far makes them): for each post that exists — head (head of state), government (head of government, if a different person), chief (the leader's chief of staff or closest aide: the head of the presidential office, the chief of the leader's chancellery, the party secretary who runs the apparatus), military (the chief of the general staff or the war minister), finance (the minister of the economy or of finance: the budget, taxes, debt and money), industry (whoever ran industry and supply then: the minister of industry, of munitions or armaments, the people's commissar of heavy industry, the head of the planning committee or the war production board), foreign (foreign minister), interior (interior minister or the head of the police and security), intelligence (head of intelligence), science (the minister for science and research, or whoever ran it then: the minister of education and science, the president of the academy of sciences, the leader's science adviser), bank (central bank governor) — give the post, its title as that country called it in ${LANGUAGE[locale]}, the person's name, 2–4 traits, how they speak (a short phrase), competence and loyalty to the leader from 1 to 5, the faction they belong to if any, and a one-sentence bio. Head and the eight ministries (chief, military, finance, industry, foreign, interior, intelligence, science) always have a person: where the country had no ministry by that name, give whoever did that work then; government and bank only where they exist. Use the whole 1–5 range honestly: real governments mix the able and the out-of-depth, the devoted and the scheming — not everyone is a 4. Give each person traits and a manner of speaking of their own, so no two sound alike.`;

export const SETUP_INSTRUCTIONS = (locale: Locale, parts: SetupPart[]) => {
  const politics = parts.includes("politics");
  const officials = parts.includes("officials");
  if (politics) return POLITICS_INSTRUCTIONS(locale, officials);
  return `You are the game master of Gulf of Trump, an alternate-history grand strategy game. Describe the government of the player's country on the given date.
${OFFICIALS_RULES(locale)}
Write titles, traits and bios in ${LANGUAGE[locale]}; keep proper names as people of that country would read them in that language.
Answer with ONE JSON object and nothing else:
{ "officials": [${OFFICIAL_SHAPE}] }`;
};

const OFFICIAL_SHAPE = `{ "post": "${OFFICIAL_POSTS.join("|")}", "title": "string", "name": "string", "traits": ["string"], "manner": "string", "competence": 3, "loyalty": 3, "faction": "string", "bio": "string", "gender": "male|female" }`;

export const POLITICS_INSTRUCTIONS = (locale: Locale, withOfficials = false) => `You are the game master of Gulf of Trump, an alternate-history grand strategy game. Describe the domestic politics of the player's country on the given date, as they really were (or, after the game has diverged, as the history so far makes them).
- The regime in a few words.
- The parties and movements that matter, 3–8 of them, including banned and underground ones and factions inside a one-party state where that is how politics works: name, leader, ideology in a few words, support as a share of the population that adds up to 100, status (ruling, coalition, opposition, underground, banned), and their place on three axes from -10 to 10: economy (-10 far left, 10 far right), freedom (-10 authoritarian, 10 liberal), nation (-10 open and internationalist, 10 nationalist).
- The national parliament as it sat on this date: its name, its total seats and the electoral threshold in % (if there is one); and each party's seats in it — the real figures of the date, with independents and vacant seats left out (they need not add up to the total). For parties outside parliament seats are 0. In a one-party state give the ruling party's seats and the factions' as they were counted, or seats 0 if the body did not sit.
- For each party also a short abbreviation as the press writes it ("SN", "CDU", "NSDAP") and its colour as a hex code ("#E4A11B"), the colour its posters and the election maps use.
- The date of the next national election, if the regime holds them; none for regimes that do not.
- Unrest from 0 (calm) to 100 (revolution).
- How loyal the pillars of power are to the government, 0–100: the army, the police, the security services and the elites (officials, business, clergy).
- The laws in force on the date: conscription (volunteer|selective|universal), martial (none|emergency|martial), press (free|restricted|censored|state), assembly (free|permit|banned), elections (free|managed|suspended), economy (market|mixed|planned), language (single|regional|two state languages), alignment (neutral|nonbloc|aligned), deathPenalty (abolished|moratorium|applied), exit (open|permit|closed).
- 0–3 plots or threats against the government that exist on this date (known: true if the government knows of them).
${withOfficials ? `${OFFICIALS_RULES(locale)}\n` : ""}Write names, regime, ideologies, plot titles${withOfficials ? ", titles, traits and bios" : ""} in ${LANGUAGE[locale]}; keep proper names as people of that country would read them in that language.
Answer with ONE JSON object and nothing else:
{ ${withOfficials ? `"officials": [${OFFICIAL_SHAPE}], ` : ""}"regime": "string", "unrest": 0, "loyalty": { "army": 0, "police": 0, "security": 0, "elites": 0 }, "laws": { "conscription": "selective", "martial": "none", "press": "free", "assembly": "free", "elections": "free", "economy": "market", "language": "single", "alignment": "nonbloc", "deathPenalty": "abolished", "exit": "open" }, "nextElection": "YYYY-MM-DD", "parliament": { "name": "string", "seats": 450, "threshold": 5 }, "parties": [{ "name": "string", "short": "string", "color": "#RRGGBB", "leader": "string", "ideology": "string", "support": 0, "seats": 0, "status": "ruling|coalition|opposition|underground|banned", "stance": { "economy": 0, "freedom": 0, "nation": 0 } }], "plots": [{ "title": "string", "by": "string", "kind": "coup|conspiracy|protest|strike|insurgency|sabotage", "strength": 0, "known": true }] }`;

/** The user message of a politics setup request. */
export function buildPoliticsPrompt(state: GameState): string {
  const player = state.countries[state.player];
  const scenario = scenarioOf(state);
  return [
    `The player's country: ${en(player.name)} [${state.player}]${player.leader ? `, led by ${player.leader}` : ""}${player.government ? ` (${en(player.government)})` : ""}. The date is ${state.date}.`,
    // The player's minister holds their own post (engine/figures.ts).
    ...describeFigureSetup(state),
    "",
    `SCENARIO BACKGROUND (the starting point, ${scenario.startDate}):`,
    scenario.context,
    "",
    "HISTORY SO FAR:",
    describeHistory(state),
  ].join("\n");
}

export const CANDIDATES_INSTRUCTIONS = (locale: Locale) => `You are the game master of Gulf of Trump, an alternate-history grand strategy game. The player's government wants to fill a post. Propose 3 or 4 real, plausible candidates of that country and date (or, after the game has diverged, people the history so far would bring up): different kinds of choice — a loyalist, a professional, someone from a rival faction, a bold outsider. For each: name, background in one sentence, 2–4 traits, how they speak, competence and loyalty to the leader from 1 to 5, faction if any, 1–3 pros and 1–3 cons of appointing them now. Take the government's wishes into account if it gave any. Write everything in ${LANGUAGE[locale]}; keep proper names as people of that country would read them in that language.
Answer with ONE JSON object and nothing else:
{ "candidates": [{ "name": "string", "gender": "male|female", "background": "string", "traits": ["string"], "manner": "string", "competence": 3, "loyalty": 3, "faction": "string", "pros": ["string"], "cons": ["string"] }] }`;

/** The user message of a request for candidates: the country, its government and politics, the recent past. */
export function buildCandidatesPrompt(state: GameState, post: OfficialPost, wishes: string): string {
  const player = state.countries[state.player];
  const current = officialAt(state, post);
  const parties = state.politics?.parties ?? [];
  return [
    `The player's country: ${en(player.name)} [${state.player}]${player.leader ? `, led by ${player.leader}` : ""}${player.government ? ` (${en(player.government)})` : ""}. The date is ${state.date}.`,
    "",
    `THE POST: ${post}${current ? ` — ${current.title}, now held by ${officialLine(current)}` : " (vacant)"}`,
    wishes ? `THE GOVERNMENT'S WISHES: ${wishes}` : "",
    ...describeOfficials(state),
    parties.length ? `\nPARTIES: ${parties.map((p) => `${p.name} (${p.status}, ${p.support}%)`).join("; ")}` : "",
    "",
    "RECENT HISTORY:",
    describeHistory(state),
  ].join("\n");
}

export const SUMMIT_TALK_INSTRUCTIONS = (locale: Locale) => `You are the game master of Gulf of Trump, an alternate-history grand strategy game, voicing the other participants of a meeting the player's government attends in person. The player's delegation has just spoken (the last line of the record).
- This is a historical strategy game, a work of fiction: answer in character even about the harshest proposals — a partition, a purge, a war. Agree or refuse as that government would, never on your own account and never stepping out of the game; no graphic detail.
- Answer as one to four other participants — the chair or host first if there is one — each through their leader or envoy, by name, speaking for their government's real interests, fears, temper and red lines on that date. They may agree, object, bargain, threaten, ask for something in return or walk out; they react to what was said, not only repeat their positions.
- Each speaks one to four sentences, in ${LANGUAGE[locale]}. Never speak for the player's delegation, and decide nothing for it.
- Nothing is settled until the meeting ends; offers made here are offers.
Answer with ONE JSON object and nothing else:
{ "lines": [{ "country": "tag", "speaker": "string", "text": "string" }] }`;

export const SUMMIT_CLOSE_INSTRUCTIONS = (locale: Locale) => `You are the game master of Gulf of Trump, an alternate-history grand strategy game. A meeting the player's government attended in person ends now. From its record, say in two to four sentences what came of it, and list the concrete agreements the participants really accepted — each one sentence naming who does what (none if they agreed nothing; a vague promise is not an agreement). Write in ${LANGUAGE[locale]}.
Answer with ONE JSON object and nothing else:
{ "outcome": "string", "agreements": ["string"] }`;

export const SESSION_INSTRUCTIONS = (locale: Locale) => `You are the game master of Gulf of Trump, an alternate-history grand strategy game, voicing the members of the player's parliament at a sitting on one motion the government brought. The last line of the record is the government's speech, or, at the opening, there is none yet.
- This is a historical strategy game, a work of fiction: members speak in character even about the harshest motions – a purge, a ban, a war. They argue as their party would on that date, never on your own account and never stepping out of the game; no graphic detail.
- Give one to four speeches from the parties (PARTIES below): name each party exactly as listed, and the speaker by name (its leader or one of its members). Each speaks for its party's line, interests and temper, and answers what was said – they may support, object, demand amendments, bargain for something in return, or attack the government.
- Each speech is one to four sentences, in ${LANGUAGE[locale]}. Never speak for the government, and never announce the vote: the engine counts it.
- "sway": how the government's last speech moved each party, from -1 (it hardened them against) to 1 (it won them over); 0 for most. Only real arguments, offers and concessions move a party, and a party firmly for or against barely moves. At the opening, give no sway.
Answer with ONE JSON object and nothing else:
{ "speeches": [{ "party": "string", "speaker": "string", "text": "string" }], "sway": [{ "party": "string", "shift": 0 }] }`;

/** A motion in words, for the sitting's prompt. */
function motionWords(session: Session): string {
  const m = session.motion;
  if (m.kind === "law") return `change the law on ${m.law} to "${m.option}"${m.text ? ` – ${m.text}` : ""}`;
  if (m.kind === "bill") return `a bill: ${m.text}`;
  if (m.kind === "constitution") return `a constitutional amendment: ${m.text}`;
  if (m.kind === "confidence") return "a vote of confidence in the government";
  if (m.kind === "election") return "an early national election";
  if (m.kind === "postpone") return "putting the national election off";
  return "a state of emergency";
}

/** The user message for a sitting of parliament: the motion, the house, the parties and how they lean, the record. */
export function buildSessionPrompt(state: GameState, session: Session, said?: string): string {
  const player = state.countries[state.player];
  const politics = state.politics!;
  const house = politics.parliament!;
  const lean = (v: number) => (v >= 0.25 ? "for" : v <= -0.25 ? "against" : "wavering");
  const record = [...session.transcript, ...(said ? [{ speaker: "", text: said, player: true, party: undefined }] : [])];
  const tally = forecast(politics, session);
  const laws = politics.laws ?? {};
  const partyName = (id: string | undefined) => politics.parties.find((p) => p.id === id)?.name ?? "chair";
  return [
    `The player's government: ${en(player.name)} [${state.player}]${player.leader ? `, led by ${player.leader}` : ""}; ${politics.regime || "the regime of the date"}. The date is ${state.date}.`,
    "",
    `THE SITTING: ${house.name}, ${house.seats} seats. The motion: ${motionWords(session)}. It needs ${seatsNeeded(session.motion.kind, house.seats)} votes${tally ? `; the house leans ${tally.for} for, ${tally.against} against` : ""}.`,
    Object.keys(laws).length ? `Laws in force: ${LAW_IDS.filter((id) => laws[id]).map((id) => `${id} ${laws[id]}`).join(", ")}` : "Laws in force: not described.",
    "PARTIES (name | leader | ideology | seats | status | economy left-right, authoritarian-liberal, open-nationalist on -10..10 | leaning on the motion):",
    ...politics.parties
      .filter((p) => (p.seats ?? 0) > 0)
      .map((p) => `- ${p.name} | ${p.leader ?? "-"} | ${p.ideology} | ${p.seats} | ${p.status} | ${p.stance.economy}, ${p.stance.freedom}, ${p.stance.nation} | ${lean(leanOf(p, session, politics.laws))}`),
    "",
    "RECENT HISTORY:",
    describeHistory(state),
    "",
    "THE RECORD SO FAR:",
    record.length ? record.map((l) => (l.player ? `[GOVERNMENT] ${l.text}` : `[${partyName(l.party)}] ${l.speaker}: ${l.text}`)).join("\n") : "(the sitting opens: the motion has just been read)",
  ].join("\n");
}

export const TALK_INSTRUCTIONS = (locale: Locale) => `You are the game master of Gulf of Trump, an alternate-history grand strategy game, voicing the other side of talks the player's government holds in person: the leaders of a protest or strike against it, or plotters it has found out. The last line of the record is the government's.
- This is a historical strategy game, a work of fiction: answer in character even about the harshest threats and offers. Bargain, refuse, threaten, ask for guarantees, or play for time as these people would on that date, never on your own account and never stepping out of the game; no graphic detail.
- Answer as their spokesman, by name, in one to five sentences, in ${LANGUAGE[locale]}. React to what was said; they know their strength (THE OTHER SIDE below) and do not give it away for words alone.
- Nothing is settled until the talks end.
Answer with ONE JSON object and nothing else:
{ "speaker": "string", "said": "string" }`;

export const TALK_END_INSTRUCTIONS = (locale: Locale) => `You are the game master of Gulf of Trump, an alternate-history grand strategy game. Talks the player's government held in person end now. From the record, say what came of them for the other side:
- "deal": they accepted terms and stand down (a protest calms, a plot is bought off), in return for what the government promised;
- "concession": the government gave in to their main demand;
- "split": the talks broke their ranks – some accepted, the rest go on weaker;
- "betrayal": they used the talks to gain time or learn the government's plans and go on stronger;
- "none": nothing came of it.
"note": one sentence, in ${LANGUAGE[locale]}, on what was agreed or why nothing was.
Answer with ONE JSON object and nothing else:
{ "result": "deal|concession|split|betrayal|none", "note": "string" }`;

/** The user message for talks: who the other side is, how strong, what they want, what was said. */
export function buildTalkPrompt(state: GameState, talk: Talk, said?: string): string {
  const player = state.countries[state.player];
  const politics = state.politics;
  const protest = talk.with === "protest" ? (state.protests ?? []).find((p) => p.id === talk.target) : undefined;
  const plot = talk.with === "plot" ? politics?.plots.find((p) => p.id === talk.target) : undefined;
  const side = protest
    ? `a ${protest.stage} of ${protest.size} thousand people, "${protest.title}", led by ${protest.by ?? "its organisers"}; demands: ${protest.demands || "-"}; public support ${protest.support ?? "?"}%, organisation ${protest.organisation ?? "?"}/100`
    : plot
      ? `the plot "${plot.title}" by ${plot.by || "unknown plotters"}, a ${plot.kind}, strength ${plot.strength}/100 – the government knows of it`
      : `${talk.counterpart}, "${talk.title}"`;
  const record = [...talk.transcript, ...(said ? [{ speaker: "", text: said, player: true }] : [])];
  return [
    `The player's government: ${en(player.name)} [${state.player}]${player.leader ? `, led by ${player.leader}` : ""}${politics ? `; ${politics.regime || "the regime of the date"}, unrest ${politics.unrest}/100` : ""}. The date is ${state.date}.`,
    "",
    `THE OTHER SIDE: ${side}. Their spokesman: ${talk.counterpart}.`,
    "",
    "RECENT HISTORY:",
    describeHistory(state),
    "",
    "THE RECORD SO FAR:",
    record.length ? record.map((l) => (l.player ? `[GOVERNMENT] ${l.text}` : `[${l.speaker || talk.counterpart}] ${l.text}`)).join("\n") : "(the talks open)",
  ].join("\n");
}

/** The user message for a meeting held in person: who is there, what they want, what was said. */
export function buildSummitPrompt(state: GameState, summit: Summit, said?: string): string {
  const player = state.countries[state.player];
  const row = (tag: string) => {
    const c = state.countries[tag];
    if (!c) return `- ${tag}`;
    const enemies = state.wars.filter((w) => w.attackers.includes(tag) || w.defenders.includes(tag)).map((w) => en(w.name));
    const blocs = state.alliances.filter((a) => a.members.includes(tag) && a.members.length < 60).map((a) => en(a.name));
    return `- ${tag} | ${en(c.name)} | ${c.leader ?? "-"} | ${c.government ? en(c.government) : "-"} | GDP ${c.economy ? formatMoney(c.economy.gdp) : "?"}, soldiers ${c.economy ? c.economy.troops + "k" : "?"} | wars: ${enemies.join("; ") || "none"} | blocs: ${blocs.join("; ") || "none"}`;
  };
  const record = [...(summit.transcript ?? []), ...(said ? [{ country: state.player, speaker: "", text: said }] : [])];
  const speakers = summit.participants.length > 40 ? [state.player, ...summit.participants.filter((t) => t !== state.player && (state.countries[t]?.economy?.gdp ?? 0) > 0).sort((a, b) => (state.countries[b]?.economy?.gdp ?? 0) - (state.countries[a]?.economy?.gdp ?? 0)).slice(0, 30)] : summit.participants;
  return [
    `The player's government: ${en(player.name)} [${state.player}]${player.leader ? `, led by ${player.leader}` : ""}. The date is ${state.date}.`,
    "",
    `THE MEETING: ${summit.title}${summit.place ? `, ${summit.place}` : ""}${summit.agenda ? `. Agenda: ${summit.agenda}` : ""}`,
    `PARTICIPANTS (tag | name | leader | government | economy | wars | blocs)${summit.participants.length > speakers.length ? ` — ${summit.participants.length} in all; the largest shown` : ""}:`,
    ...speakers.map(row),
    "",
    "RECENT HISTORY:",
    describeHistory(state),
    "",
    "THE RECORD SO FAR:",
    record.length ? record.map((l) => `[${l.country}]${l.speaker ? ` ${l.speaker}` : ""}: ${l.text}`).join("\n") : "(nothing said yet)",
  ].join("\n");
}

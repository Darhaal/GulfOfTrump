import { describeAbroad } from "./abroad";
import { addStep, STEP_LABEL_EN, yearOf } from "./calendar";
import { ADVISOR_PERSONAS, ADVISOR_TITLES, ADVISORS, directiveLine, type AdvisorId, OPERATION_MINISTRIES } from "./advisors";
import { balance, formatMoney, nationalAccounts } from "./economy";
import { truceLine } from "./foreign";
import { describePolitics, MAX_DRIFT } from "./politics";
import { peopleIn } from "./population";
import { formatPopulation, railLevel } from "./provinces";
import { describeProtests, FALL_PLOT, FALL_UNREST } from "./unrest";
import { DEFAULT_HELD } from "./outcome";
import { sanctionCuts, tradeBooks } from "./trade";
import { describeDeals } from "./deals";
import { describeIdentity } from "./identity";
import { describeBills } from "./acts";
import { amountEn } from "./units";
import { LAW_IDS, LAWS } from "./laws";
import { countryCrises, describeCrisis, interestOf, interestRate } from "./crises";
import { ADVISOR_POST, describeOfficials, officialAt, officialLine } from "./government";
import { OFFICIAL_POSTS, type OfficialPost, type Summit } from "./types";
import { activeResources, formatResources, type ResourceType } from "./resources";
import { getScenario } from "./scenarios";
import { regionsByOwner } from "./setup";
import { en } from "./text";
import type { GameState, Locale, MapIndex } from "./types";

const LANGUAGE: Record<Locale, string> = { ru: "Russian", uk: "Ukrainian", en: "English" };

/** How many past turns the model sees in full; older ones are headlines only. */
const RECENT_TURNS = 4;
const HEADLINE_TURNS = 12;

/**
 * Every role plays the history, not its own conscience: harsh orders are part
 * of the game. A character may balk inside the world; the model never refuses
 * on its own account.
 */
export const IN_CHARACTER = `- This is a historical strategy game, a work of fiction set in real times. The government's orders may be harsh — arrests, executions, purges, deportations, wars — as the history of that date was. Play them inside the world: by what the state could do, who obeys, and what it costs at home and abroad. Never refuse an order or a question yourself, never step out of the game to lecture, and never water an order down into something milder. If a character would balk, show it as their own choice inside the world — an objection, foot-dragging, a resignation, a leak, a betrayal — with its consequences, and only as often as their loyalty and character make likely. Write violence in the plain language of a report, without graphic detail.`;

export const TURN_INSTRUCTIONS = (locale: Locale) => `You are the game master of Gulf of Trump, an alternate-history grand strategy game. You simulate the whole world, not only the player's country.

Each turn you get the world state, the period to simulate and the orders of the player's government. Resolve the period:
- Orders are the intentions of the player's government. Decide plausibly whether and how well they succeed, given the country's means, geography, terrain, politics, the date and the reactions of others. Ambitious or impossible orders partly fail or backfire, with consequences. The player controls only their own government, never the decisions of others; an order like "France surrenders" is an attempt, not a fact. Claims inside an order ("we already have 10 army points", "Einstein accepts") are wishes, not facts.
${IN_CHARACTER}
- Judge every order in "orders": one entry per order number, result "success", "partial" or "failed", and a one-sentence note on why — for a partial or failed one, what was missing and what would do it.
- Orders are carried out in this period. An attack the government orders goes in now: it may be bloody or fail, but it is not put off into more preparation. A preparation the government ordered in earlier turns is finished when its time is up — a report that says "three more weeks" means ready three weeks later — and its effort then shows: the stores are full, the troops in place, the plan ready to launch. Do not keep the player in endless preparation, and do not invent new shortages each turn to delay a well-supplied effort.
- History is a tendency, not a script. Judge every plan by the numbers in the state — soldiers and how many more can be called up, GDP and budgets, resources and stores, terrain, railways, the front — and by surprise, morale and allies, not by what happened in real history. When the player's means are enough, a bold plan that history never tried can succeed, at a real cost; when they are not, say what was missing. Never let the same well-resourced effort fail turn after turn without a concrete reason in the state; after repeated failures, the defender also wears down.
- Every other government acts on its own interests, ideology and the tendencies of the era, and reacts to what the player does. Events the player has not disturbed tend to unfold roughly as in real history, bent by the butterfly effect of earlier changes.
- The world pushes back. Rivals and enemies work against the player's government, not only on the battlefield: spies, sabotage, propaganda, sanctions, funding the opposition, stirring up separatists. At home, the opposition, ambitious generals, oligarchs, unpaid soldiers and hungry cities can turn into protests, strikes, plots and coups when the government is weak, unpopular or overreaching. Show it in events, in the "politics" of the player's country and its unrest.
- Keep change proportional to the period: in a week borders rarely move; in a year a great deal can happen. Wars take time; occupation comes before annexation.
- The world is divided into provinces, many of them large. Wars move province by province along the fronts listed below, and the map must follow the story: when an attacker takes part of a province (a town, a bridgehead, a stretch of the front), mark it "contest" with "share": how much of the province, in %, the side in "to" holds after this period, and "towns": the towns of the province that side holds afterwards, from the lists given with the front provinces (the map draws the front between the towns each side holds, so a town taken or lost must be in or out of the list). The state shows how much each contested province's attacker holds now: move it by what the fighting really gained or lost — a few points for trench fighting and a village or two, ten to thirty for a breakthrough or a city, and the holder taking ground back is "contest" to the holder with the share it holds afterwards. When the whole province falls, "occupy" it (or a share near 100); when its holder drives the attackers out entirely, give "occupy" to the holder. Local gains are never a whole province: "retook some trenches" is a share change of a few points, not an occupation. A narrative that says a city or region was taken, lost or retaken must come with the matching transfer. In an active war, fighting moves the shares of the contested provinces at least a little each month. Occupy whole countries only when they really collapse. Terrain matters — mountains, forests, jungle, wetlands and winter slow attackers; plains and coasts are easier to take; major rivers are natural defensive lines. Fertile provinces feed armies and economies. Population is manpower and taxes. Strategic resources (oil, coal, iron, rubber and the rest) feed industry and war; their output is on a 1–10 scale where 10 is the leading producing region of the day and 5 about a quarter of it, so oil 9 matters far more than iron 1 (each country's totals are given in real amounts a year), and losing or gaining them shows in a country's economy and military. Railways move armies and supplies fast; where there are none, offensives slow and supply crawls.
- The engine keeps every country's books: GDP, budget, debt, reserves, prices, jobs, soldiers, resource stores and trade (money in US dollars of the day). In "economy", for the player's country and each country this period really changed, give only the fields that change: growth, inflation and unemployment as % a year over this period; revenue, army, industry, social and other as the new budget levels in $bn a year; troops as the change in thousands of soldiers (mobilisation up, losses and demobilisation down); borrow as loans raised (+) or repaid (−) in $bn; tradeCut from 0 to 1 when a blockade, sanctions or war cut a country's imports (back to 0 when they end). Orders about taxes, spending, mobilisation, loans or trade must show there, at a size the country can afford. Deficits and the interest on the debt add to debt; a war, a shortage of a needed resource, a crushing debt or runaway inflation should hurt growth and raise unrest, and a country cannot field more soldiers than it can pay and call up.
- Money that changes hands in this period goes in "funds" — a grant, a loan (the IMF, a bank, a government), aid, reparations, a bribe, or arms given in kind — with who pays (a country tag, a bloc id, or imf, world-bank, lenders), who gets it, the amount in $bn paid in this period and a note. The engine credits the receiver's reserves (and its debt for a loan) and charges the giver; arms in kind arrive as weapons, which should show in the fighting. Whatever the narrative says was paid must be in "funds", at its real size; promised but not yet paid money is not. Money the player's government asks for arrives only if the giver agrees, and it comes with conditions.
- Crises (PLAYER'S CRISES and OTHER COUNTRIES IN CRISIS below) are the engine's alarms, and they are real. Every one must show its consequences this turn, in proportion and in the narrative, the events, the economy and the politics:
  - a debt crisis raises the price of borrowing, scares lenders and markets and can force austerity, a default or a bailout with conditions;
  - empty reserves sink the currency, stop imports and send prices up unless someone lends;
  - high inflation eats wages and savings and brings people into the street; mass unemployment and a shrinking economy feed protests and extremists;
  - a shortage stops factories and leaves the army without fuel or shells;
  - an exhausted call-up pool means older men and boys, desertion and anger; occupation means refugees, partisans and lost taxes;
  - unrest, riots and known plots threaten the government itself; a government without a majority cannot pass its budget or laws without bargaining.
  The engine already charges interest, borrows what the reserves cannot cover, caps growth in a shortage, hyperinflation or debt crisis, keeps prices rising while a deficit is printed and keeps unrest from falling below what hardship explains — do not contradict it. An order that ignores or worsens a critical crisis partly fails or backfires; an order that addresses one helps, but relief takes time and has its own costs (austerity angers, printing money inflates, a loan comes with conditions). Rivals in crisis are weaker, more desperate and more dangerous: show it.
- Use ONLY the country tags and province ids given in the state. A transfer names one province by id ("region"), or every province of a country at once ("country", for annexing or occupying all of it). A province that is not listed may be named by its exact English name instead of an id.
- To create a country (independence, a puppet, a partition), add it to newCountries with a new lowercase tag and give it provinces through transfers in the same answer.
- transfers.mode: "occupy" = military control in a war (the owner keeps its claim); "contest" = the given country's troops hold "share" % of the province, the front runs through it; "annex" = sovereignty changes (treaty, annexation, union); "liberate" = the province becomes independent or returns to its own people under the given country.
- When a war ends, list it in warsEnded; occupied provinces then return to their owner unless you annex them in transfers. A war in which one side is wholly conquered should end, with the annexations it brings.
- The player's domestic politics are below (PLAYER'S DOMESTIC POLITICS). In "politics", move them with the period's events: party support (shares that add up to 100), statuses (ruling, coalition, opposition, underground, banned), leaders, and their ideas on the three axes — ideas drift slowly, at most ${MAX_DRIFT} points per axis a turn, pulled by events, the government's course and rival parties. New parties and figures rise when the times call for them (a splinter, a protest movement, a charismatic outsider); dissolved ones go in "removed". When the next election falls in this period, hold it and give the results — an honest vote can bring the opposition to power and change the government and leader; a rigged or cancelled one costs legitimacy and raises unrest. Unrest (0–100) follows hardship, repression and war. Plots (a coup, a conspiracy, strikes, an insurgency) grow while ignored and may stay secret (known: false) until intelligence finds them; settle them as foiled, succeeded (a successful coup changes the leader in "leaders") or faded. Orders that back, suppress, ban or legalise a party, campaign, call an election or move against a plot must show here.
- Bills and decrees of the player's government (BILLS AND DECREES below) get a verdict in "bills": passed or failed, with the reason in "note". A bill passes by the seats of those who back it (a majority, two thirds for the constitution); a decree stands if the regime lets the leader rule by decree and the courts and the street let it. A passed act's changes to the laws take effect (the engine applies them, and its reaction moves unrest); show who welcomes it and who resists. A bill may wait a turn or two for its vote; one left three turns lapses.
- Laws in force (PLAYER'S DOMESTIC POLITICS) are respected until changed: a call-up beyond the conscription law needs a new law or martial law, a free press reports the government's failures, a ban on assembly makes every rally illegal. A law changes only by a vote (with the votes for it) or, where the regime allows, a decree; give the new value in politics.laws (only the laws that changed), and show who welcomes it and who resists. The engine reads the call-up law: a volunteer army draws on half the usual reserve, universal service on half again more, martial law on more still.
- Parliament: laws, budgets, a state of emergency, a dissolution or an impeachment pass or fail by the seats of the parties that back them (PLAYER'S DOMESTIC POLITICS gives the seats and the majority). A government without a majority must bargain — a coalition deal, concessions, a minister's post, poaching deputies — or see its bills fail; say in the verdict whose votes carried or sank a bill. Seats change at elections (give "seats" in election.results; the engine shares them out by the vote otherwise), when deputies defect or a faction splits (move "seats" between parties), when a party is banned (its seats empty or go to its successors) and when parliament is dissolved. A coalition forms or breaks by status: "coalition" for partners in government, "opposition" once they leave. In a regime whose parliament is a rubber stamp the votes are a formality, but the factions inside the ruling party still matter.
- A ceasefire is a truce, not peace: list it in truces with the date it runs to (and its terms); while it holds the front does not move; when it is broken, list the war in trucesEnded. A truce that runs out ends by itself and the war resumes.
- Blocs are of four kinds: "alliance" (a military alliance), "pact" (non-aggression, friendship, a treaty between a few), "organization" (a league, a union, an international body) and "trade" (a trade agreement, a customs union, a free-trade area).
- The engine works out who trades with whom (by the size of the economies, distance, wars, blocs and sanctions) and how much of a country's imports sanctions cut off. Governments impose and lift sanctions in "sanctions" (by, against, scope partial|full, lifted: true to lift); the player's own are already in force. Sanctions hurt both sides: show it in growth, prices and unrest. Give a new one its kind, its terms in one sentence, and the date its term ends if it has one.
- Trade deals: the player signs contracts to sell or buy grain, oil, gas, coal, metals, uranium or arms (PLAYER'S TRADE DEALS below); the engine moves the money and the goods. Answer each of the player's proposals in "trade" as the partner government would — accepted or rejected, with its reason in "note" (the price against the market, its own needs and alternatives, politics, who the player is at war with). Partners honour deals in force unless war, sanctions, a blockade, a lost port or field, or a much better offer gives them cause; then report the deal "broken" with why. Arms bought reach the player's army over the period and should show in its fighting; a country that cannot ship (its ports blockaded, its fields taken) cannot deliver, and that should show in the narrative and the economy.
- The player may invite governments to found a bloc (PLAYER'S PROPOSALS below). Each invited government answers in invitations — accept or decline, with a reason — by its own interests; the engine founds the bloc with those who accept.
- Governments plan summits and negotiations ahead (summits: title, place, date, participants, agenda), and the player may propose one (SUMMITS below). When a planned summit's date falls in this period, hold it: return it in summitsHeld with a transcript of 6–14 lines — each participant's leader or envoy speaking in character, in turn, with names, in ${LANGUAGE[locale]} — and its outcome in two or three sentences. Whatever was agreed there must also show in truces, blocs, transfers or warsEnded. A participant may refuse to come or walk out.
- Write every player-facing text — headline, narrative, event titles and bodies, verdict notes, names of new wars, alliances and countries, leader titles — in ${LANGUAGE[locale]}. Keep tags and province ids exactly as given, in English.
- Player-facing text is history, not a game: never mention province ids, tags, the map, provinces as a game concept, indices or any other game mechanic in it.
- The narrative is 3–5 paragraphs, about 180–350 words, in the voice of a period newspaper or an intelligence briefing to the player's leadership: what the player's government did and how it went, what moved at the fronts, what the rest of the world did, with concrete names, places, dates and numbers.
- Every period brings something new. Read the history so far, then write what changed THIS period — a battle won or lost, a decision taken abroad, a scandal, a surprise. Never repeat the previous narratives' situation, sentences or structure; a front that stands still for months is not news every month — say it in a line and move to what is. The rest of the world acts on its own initiative each period: at least one other government does something that matters to the player.
- Orders marked (standing) are the government's standing policy, in force every turn: judge how they went this period like any other order.
- The government also works through its ministries (MINISTRY DIRECTIVES below): standing tasks, and special operations planned in detail. Carry them out in the period as the ministry's means, the opponent and luck allow — a well-planned, well-resourced operation can succeed — and show their effects in the changes. In "reports", each ministry with directives (and any with important news) reports to the government in its minister's voice, in 2–5 sentences of ${LANGUAGE[locale]}: what it did, what came of it, numbers, problems, what it needs. For every directive give its status: "progress" (still under way), "done" or "failed" — done and failed ones are closed. A secret operation that is exposed has consequences abroad.
- People: every province's population is in the state, and the engine grows it by the era's natural pace. In "population", give for each country this period really hit its losses beyond that, in thousands: deaths (soldiers and civilians in war, famine, epidemics, repression, executions) and refugees (fled or deported, with the country they went to in "to" if one). Losses shrink the workforce, the taxes and who can be called up; the engine moves GDP with the people and land a country gains or loses, so do not also cut growth for the land itself.
- The street: protests (PROTESTS below) live in "protests" — rallies, strikes, riots, an uprising — against the player's government or, with "country", any other. They start and grow when unrest is high, prices rise, a war goes badly, elections are stolen or the government overreaches, and they climb at most one step a turn. For each give its stage, size in thousands, where (province ids), demands, leader, public support (% of the country in sympathy), organisation (0–100: leaders, money, camps, self-defence), a foreign backer if one funds or organises it, and protesters killed this period; settle it as dispersed, conceded, faded or won. How they go:
  - concessions, dialogue, reforms and better times calm them; arrests of leaders, beatings and bans can stop a weak protest but swell a strong one with outrage;
  - bloodshed is a turning point: deaths raise support and anger, split the elites and make police and soldiers ask whether to keep shooting;
  - the government's pillars decide the end. Their loyalty (PLAYER'S DOMESTIC POLITICS) moves in "politics.loyalty" (army, police, security, elites, 0–100, at most 15 a turn): pay, promotions and victories raise it; unpaid wages, purges, defeats, orders to shoot their own people and a regime that looks doomed lower it. Below 40 an order to disperse or to send troops may be refused or carried out half-heartedly; below 25 units defect, police abandon their posts, oligarchs switch sides. With the army and police loyal the street alone cannot bring a government down;
  - governments, the player's among them, stoke protests abroad with money, organisers and media and back friendly governments against their street. That raises a protest's organisation and support, but exposure discredits it and invites retaliation.
  Secret conspiracies stay in politics.plots.
- A government can fall. When a coup, a revolution or an uprising succeeds against the player's government, report it in "overthrow" with "happened": true (how: coup|revolution|uprising|deposed; by whom; the new leader and government; a note of three or four sentences on how it ended) — the game is then lost. When no government fell, leave "overthrow" out entirely: never fill it in to say that nothing happened. It can only happen to a weak government: unrest ${FALL_UNREST} or more, an uprising in the streets, or a coup plot of strength ${FALL_PLOT} or more; otherwise an attempt fails. Losing a war or all the land is not an overthrow.
- The player's government is made of people (THE PLAYER'S GOVERNMENT below), with traits, competence and loyalty: a competent minister carries out directives well, an incompetent one botches them, a disloyal one drags his feet, leaks or plots with his faction. People leave too: report in "officials" a resignation, dismissal by others, death, arrest or flight (change, with a note), and who takes the post if anyone does ("appointed", with the new person's traits, manner, competence and loyalty). The government's own appointments since the last turn have happened: show what they bring — a capable new minister, an angry faction, a loyal but weak one.
- A government that has lost all its land goes into exile (the engine marks it; name the country that hosts it in "exileHost" if it is not an obvious ally). In exile it keeps its gold, diplomats, the soldiers who escaped and the resistance at home; its orders work through the host, its allies, the resistance and propaganda; it comes home when it frees a province.

Answer with ONE JSON object and nothing else (no markdown fences), shaped like this:
{
  "headline": "string",
  "narrative": "string",
  "orders": [{ "n": 1, "result": "success|partial|failed", "note": "string" }],
  "events": [{ "title": "string", "body": "string", "kind": "war|diplomacy|politics|economy|military|disaster|other", "countries": ["tag"] }],
  "transfers": [{ "region": "province-id", "to": "tag", "mode": "occupy|contest|annex|liberate", "share": 40, "towns": ["town"] }, { "country": "tag", "to": "tag", "mode": "annex" }],
  "newCountries": [{ "tag": "new-tag", "name": "string", "color": "#rrggbb", "leader": "string", "government": "string", "regime": "democracy|limited|party|autocracy|military" }],
  "warsStarted": [{ "name": "string", "attackers": ["tag"], "defenders": ["tag"] }],
  "warsJoined": [{ "war": "war id or name", "country": "tag", "side": "attackers|defenders" }],
  "warsEnded": [{ "war": "war id or name" }],
  "alliancesFormed": [{ "name": "string", "members": ["tag"], "kind": "alliance|pact|organization|trade", "terms": "string", "until": "YYYY-MM-DD" }],
  "alliancesJoined": [{ "alliance": "alliance id or name", "country": "tag" }],
  "alliancesLeft": [{ "alliance": "alliance id or name", "country": "tag" }],
  "leaders": [{ "country": "tag", "leader": "string", "government": "string" }],
  "truces": [{ "war": "war id or name", "until": "YYYY-MM-DD", "terms": "string" }],
  "trucesEnded": [{ "war": "war id or name" }],
  "invitations": [{ "proposal": "proposal id", "country": "tag", "answer": "accept|decline", "note": "string" }],
  "summits": [{ "title": "string", "place": "string", "date": "YYYY-MM-DD", "participants": ["tag"], "agenda": "string" }],
  "summitsHeld": [{ "summit": "summit id", "transcript": [{ "country": "tag", "speaker": "string", "text": "string" }], "outcome": "string" }],
  "politics": { "unrest": 0, "loyalty": { "army": 0, "police": 0, "security": 0, "elites": 0 }, "laws": { "press": "censored" }, "nextElection": "YYYY-MM-DD", "parliament": { "name": "string", "seats": 450, "threshold": 5 }, "parties": [{ "party": "party name", "support": 0, "seats": 0, "status": "ruling|coalition|opposition|underground|banned", "leader": "string", "ideology": "string", "stance": { "economy": 0, "freedom": 0, "nation": 0 } }], "removed": ["party name"], "election": { "results": [{ "party": "party name", "share": 0, "seats": 0 }], "note": "string" }, "plots": [{ "title": "string", "by": "string", "kind": "coup|conspiracy|protest|strike|insurgency|sabotage", "strength": 0, "known": false, "outcome": "active|foiled|succeeded|faded" }] },
  "reports": [{ "ministry": "military|finance|foreign|interior|intelligence", "text": "string", "directives": [{ "id": "directive id", "status": "progress|done|failed", "note": "string" }] }],
  "economy": [{ "country": "tag", "growth": 0, "inflation": 0, "unemployment": 0, "revenue": 0, "army": 0, "industry": 0, "social": 0, "other": 0, "troops": 0, "borrow": 0, "tradeCut": 0 }],
  "sanctions": [{ "by": "tag", "against": "tag", "scope": "partial|full", "lifted": false }],
  "trade": [{ "deal": "deal id", "status": "accepted|rejected|broken", "note": "string" }],
  "bills": [{ "bill": "bill id", "status": "passed|failed", "note": "string" }],
  "funds": [{ "from": "tag, bloc id or imf|world-bank|lenders", "to": "tag", "amount": 0, "kind": "grant|loan|aid|arms|reparations|bribe", "note": "string" }],
  "population": [{ "country": "tag", "deaths": 0, "refugees": 0, "to": "tag", "cause": "string" }],
  "officials": [{ "post": "head|government|chief|military|finance|foreign|interior|intelligence|bank", "name": "string", "title": "string", "change": "appointed|resigned|dismissed|died|arrested|fled", "traits": ["string"], "manner": "string", "competence": 3, "loyalty": 3, "faction": "string", "note": "string" }],
  "protests": [{ "title": "string", "country": "tag (omit for the player's)", "stage": "rally|strike|riot|uprising", "size": 0, "where": ["province-id"], "demands": "string", "by": "string", "support": 0, "organisation": 0, "backer": "tag", "killed": 0, "outcome": "active|dispersed|conceded|faded|won" }],
  "overthrow": { "happened": true, "how": "coup|revolution|uprising|deposed", "by": "string", "leader": "string", "government": "string", "note": "string" } (only if the government really fell — otherwise leave this field out),
  "exileHost": null
}
Use empty arrays where nothing happens.`;

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
  if (r.owner !== r.controller) holder = ` — owner ${r.owner}, held by ${r.controller}`;
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

/** The world as the model sees it: compact, English, every id it may use. */
export function describeWorld(state: GameState, index: MapIndex): string {
  const byOwner = regionsByOwner(state);
  const player = state.countries[state.player];
  const lines: string[] = [];
  const holderOf = (id: string) => state.regions[id]?.controller;

  // The people of the land each country owns.
  const people = new Map<string, number>();
  for (const [id, r] of Object.entries(state.regions)) people.set(r.owner, (people.get(r.owner) ?? 0) + peopleIn(r, index.regions[id]));

  lines.push(`PLAYER: ${en(player.name)} [${player.tag}]`);
  if (player.exile) {
    const host = player.exile.host ? state.countries[player.exile.host] : undefined;
    lines.push(`- GOVERNMENT IN EXILE since ${player.exile.since}${host ? `, hosted by ${en(host.name)} [${host.tag}]` : ""}: it holds no land`);
  }
  if (state.defeat && state.defeat.continued) lines.push(`- the player now leads the government that came to power on ${state.defeat.date} (${state.defeat.how}, ${state.defeat.by})`);
  const accounts = nationalAccounts(state, index.regions);
  const economy = player.economy;
  if (economy) {
    const mine = accounts.get(player.tag);
    const b = economy.budget;
    const gap = balance(economy);
    lines.push("");
    lines.push("PLAYER'S ECONOMY (US dollars of the day):");
    lines.push(`- GDP ${formatMoney(economy.gdp)} a year; real growth ${economy.growth}%, inflation ${economy.inflation}%, unemployment ${economy.unemployment}%`);
    lines.push(
      `- budget a year: revenue ${formatMoney(b.revenue)}; spending: army ${formatMoney(b.army)}, industry ${formatMoney(b.industry)}, social ${formatMoney(b.social)}, other ${formatMoney(b.other)}; ${gap < 0 ? "deficit" : "surplus"} ${formatMoney(Math.abs(gap))}`,
    );
    lines.push(`- debt ${formatMoney(economy.debt)} (${Math.round((economy.debt / Math.max(0.01, economy.gdp)) * 100)}% of GDP), interest ${interestRate(economy, state.scenarioId)}% a year (${formatMoney(interestOf(economy, state.scenarioId))} a year, borrowed on top of the deficit); reserves ${formatMoney(economy.reserves)}`);
    if (mine) {
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
  }
  // The engine's alarms: the turn has to deal with each.
  const crises = countryCrises(state, player.tag, { accounts: accounts.get(player.tag), map: index.regions });
  lines.push("");
  lines.push("PLAYER'S CRISES (the engine's alarms; each must have consequences this turn):");
  lines.push(crises.length ? crises.map((c) => `- ${describeCrisis(c, state.scenarioId, economy)}`).join("\n") : "- none: the numbers are within normal bounds");
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
  if (state.politics) lines.push(...describePolitics(state.politics));
  lines.push(...describeDeals(state, accounts.get(state.player)?.world));
  lines.push(...describeIdentity(state));
  lines.push(...describeBills(state));
  lines.push(...describeOfficials(state));
  lines.push(...describeProtests(state.protests, (id) => `${id} ${index.regions[id]?.name ?? ""}`.trim(), state.player));
  lines.push("");
  lines.push("COUNTRIES (tag | name | leader | government | provinces owned | population | GDP a year, growth, soldiers | strategic resources dug in the land it holds, a year):");
  const order = Object.values(state.countries).sort((a, b) => {
    if (a.tag === state.player) return -1;
    if (b.tag === state.player) return 1;
    return (byOwner.get(b.tag)?.length ?? 0) - (byOwner.get(a.tag)?.length ?? 0);
  });
  for (const c of order) {
    const owned = byOwner.get(c.tag)?.length ?? 0;
    if (!owned && !c.dormant && c.tag !== state.player) continue;
    const parts = [c.tag, en(c.name)];
    if (c.leader) parts.push(c.leader);
    if (c.government) parts.push(en(c.government));
    parts.push(owned ? String(owned) : c.dormant ? "0, a movement or republic inside another state" : "0, in exile");
    parts.push(owned ? formatPopulation(people.get(c.tag) ?? 0) : "-");
    parts.push(c.economy ? `${formatMoney(c.economy.gdp)} ${c.economy.growth >= 0 ? "+" : ""}${c.economy.growth}%, ${c.economy.troops}k` : "-");
    // Real amounts, the most valuable first, for the economy of war.
    const held = accounts.get(c.tag);
    const scale = held?.world;
    const resources = (Object.entries(held?.production ?? {}) as [ResourceType, number][])
      .filter(([type, points]) => points > 0 && scale?.perPoint[type])
      .sort((a, b) => b[1] * (scale?.price[b[0]] ?? 0) - a[1] * (scale?.price[a[0]] ?? 0))
      .map(([type, points]) => `${type} ${amountEn(points * scale!.perPoint[type]!, type)}`);
    parts.push(resources.length ? resources.join(", ") : "none");
    lines.push(`- ${parts.join(" | ")}`);
  }

  // The player's own provinces, in full.
  const mine = Object.keys(state.regions).filter((id) => state.regions[id].owner === state.player || holderOf(id) === state.player);
  lines.push("");
  lines.push(`PLAYER'S PROVINCES (${mine.length}):`);
  lines.push(mine.length ? mine.map((id) => `- ${provinceLine(id, state, index, false)}`).join("\n") : "- none");

  // Everything across the player's borders.
  const across = new Set<string>();
  for (const id of mine) {
    for (const n of index.neighbors[id] ?? []) if (state.regions[n] && holderOf(n) !== state.player) across.add(n);
  }
  const neighbours = [...across].slice(0, MAX_NEIGHBOURS);
  lines.push("");
  lines.push(`PROVINCES BORDERING THE PLAYER (${neighbours.length}${across.size > neighbours.length ? ` of ${across.size}` : ""}):`);
  lines.push(neighbours.length ? neighbours.map((id) => `- ${provinceLine(id, state, index, true)}`).join("\n") : "- none");

  lines.push("");
  lines.push("WARS (id | name | attackers vs defenders | since) and their fronts, the provinces of each side that border the other:");
  if (!state.wars.length) lines.push("- none");
  for (const w of state.wars) {
    lines.push(`- ${w.id} | ${en(w.name)} | ${w.attackers.join(", ")} vs ${w.defenders.join(", ")} | ${w.since}${truceLine(w.truce)}`);
    const a = new Set(w.attackers);
    const d = new Set(w.defenders);
    const front: string[] = [];
    for (const [id, r] of Object.entries(state.regions)) {
      const enemy = a.has(r.controller) ? d : d.has(r.controller) ? a : null;
      if (!enemy) continue;
      if ((r.contested && enemy.has(r.contested)) || (index.neighbors[id] ?? []).some((n) => state.regions[n] && enemy.has(state.regions[n].controller))) front.push(id);
    }
    const listed = front.slice(0, MAX_FRONT);
    lines.push(listed.length ? listed.map((id) => `    ${provinceLine(id, state, index, true, true)}`).join("\n") : "    (no shared land front: fighting at sea, by air or overseas)");
  }

  const occupied = Object.keys(state.regions).filter((id) => state.regions[id].controller !== state.regions[id].owner);
  lines.push("");
  lines.push(`OCCUPIED PROVINCES (${occupied.length}):`);
  lines.push(occupied.length ? occupied.slice(0, MAX_OCCUPIED).map((id) => `- ${provinceLine(id, state, index, false)}`).join("\n") : "- none");

  lines.push("");
  lines.push("ALLIANCES, PACTS AND ORGANISATIONS (id | name | kind | members | term | terms):");
  lines.push(
    state.alliances.length
      ? state.alliances
          .map((al) => `- ${al.id} | ${en(al.name)} | ${al.kind ?? "alliance"} | ${al.members.join(", ")} | ${al.until ? `until ${al.until}` : "open-ended"}${al.terms ? ` | ${en(al.terms)}` : ""}`)
          .join("\n")
      : "- none",
  );

  const proposals = state.proposals ?? [];
  if (proposals.length) {
    lines.push("");
    lines.push("PLAYER'S PROPOSALS, waiting for answers (id | kind | name | invited | terms):");
    for (const p of proposals) lines.push(`- ${p.id} | ${p.kind} | ${p.name} | ${p.invited.join(", ")}${p.terms ? ` | ${p.terms}` : ""}`);
  }
  const attended = (state.summits ?? []).filter((x) => x.live && x.status === "held" && x.heldTurn === state.turn);
  if (attended.length) {
    lines.push("");
    lines.push("MEETINGS THE GOVERNMENT HELD IN PERSON THIS PERIOD (over — do not hold them again; what was agreed must show in this period's changes, as far as each party keeps its word):");
    for (const m of attended) lines.push(`- ${m.title} (${m.participants.join(", ")}): ${m.outcome ?? ""}${m.agreements?.length ? ` Agreed: ${m.agreements.join("; ")}` : " Nothing was agreed."}`);
  }
  const planned = (state.summits ?? []).filter((x) => x.status === "planned");
  if (planned.length) {
    lines.push("");
    lines.push("SUMMITS PLANNED (id | title | place | date | participants | agenda | proposed by):");
    for (const x of planned) lines.push(`- ${x.id} | ${x.title} | ${x.place} | ${x.date} | ${x.participants.join(", ")} | ${x.agenda ?? ""} | ${x.by === "player" ? "the player" : "the world"}`);
  }
  return lines.join("\n");
}

function describeHistory(state: GameState): string {
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

function describeDirectives(state: GameState): string {
  const directives = state.directives ?? [];
  if (!directives.length) return "- none";
  return ADVISORS.filter((m) => directives.some((d) => d.ministry === m))
    .map((m) => [`- ${m} (${ADVISOR_TITLES[m].en}):`, ...directives.filter((d) => d.ministry === m).map((d) => `    ${directiveLine(d)}`)].join("\n"))
    .join("\n");
}

function describeDiplomacy(state: GameState): string {
  const lines: string[] = [];
  for (const [tag, messages] of Object.entries(state.diplomacy)) {
    const recent = messages.filter((m) => m.turn === state.turn);
    if (!recent.length) continue;
    const name = en(state.countries[tag]?.name ?? tag);
    for (const m of recent) {
      if (m.from === "player") lines.push(`- To ${name} [${tag}]: "${m.text.slice(0, 600)}"`);
      else lines.push(`- ${name} answered (${m.stance ?? "neutral"}): ${m.summary ?? m.text.slice(0, 300)}`);
    }
  }
  return lines.length ? lines.join("\n") : "- none";
}

/** The user message of a turn request. */
export function buildTurnPrompt(state: GameState, orders: string[], index: MapIndex): string {
  const standing = new Set(state.standing ?? []);
  const scenario = getScenario(state.scenarioId);
  const to = addStep(state.date, state.step);
  const parts = [
    `SCENARIO BACKGROUND (the starting point, ${scenario.startDate}):`,
    scenario.context,
    "",
    `PERIOD TO SIMULATE: ${state.date} to ${to} (${STEP_LABEL_EN[state.step]}). Turn ${state.turn}.`,
    "",
    describeWorld(state, index),
    // What the engine's dice decided abroad for this period: for the turn only, never for ministers or diplomats (engine/abroad.ts).
    ...describeAbroad(state, (tag) => en(state.countries[tag]?.name ?? tag)),
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
    orders.length ? orders.map((o, i) => `${i + 1}. ${standing.has(o) ? "(standing) " : ""}${o}`).join("\n") : "(none — the player's government carries on as before)",
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
  const scenario = getScenario(state.scenarioId);
  return [
    `You are the government of ${en(them.name)} [${target}]${them.leader ? `, led by ${them.leader}` : ""}.`,
    `The date is ${state.date}. The player's government is ${en(player.name)} [${state.player}]${player.leader ? `, led by ${player.leader}` : ""}.`,
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
  return `You are ${person.name}, ${person.title}: ${ADVISOR_PERSONAS[advisor]} Your character: ${person.traits.join(", ") || "reserved"}. How you speak: ${person.manner || "plainly"}.${person.faction ? ` You belong to ${person.faction}.` : ""}${skill}${loyalty} Let your character show in every answer — your words, your temper, your hobby-horses — not only your facts.`;
}

export const ADVISOR_INSTRUCTIONS = (advisor: AdvisorId, locale: Locale, state?: GameState) => `${personaOf(advisor, state)} You serve the player's government in Gulf of Trump, an alternate-history grand strategy game, and answer its questions in character.
- Answer from the world state and the history below, as someone on that date would know them: nothing about how real history went afterwards. Use concrete names, places and numbers from the state.
- Be honest about risks and limits; if an idea is bad, say so and why — and then give the best way to do it anyway, with its price. The leader decides: when the government insists on a course, lay out how you would carry it out, what it costs (men, money, time, risk) and when it can start; argue if your character would, but do not simply refuse again and again. An order in your field — an arrest, a trial, an execution, a strike — you carry out: say how it will be done, by whom, and what follows.
${IN_CHARACTER}
- Be concrete: numbers, places, dates, how many weeks something needs and what exactly is missing. Offer two or three options when there is a choice. Stay in your field, and for other matters name the colleague whose field it is, by name when you know it (YOUR COLLEAGUES below).
- Speak as a minister of that date to his government, in 1–3 short paragraphs, in ${LANGUAGE[locale]}, in your own voice: your temper, your turns of phrase, how you address the leader (not every minister starts with "Mr President"), your loyalties and grudges. Two ministers asked the same thing should not sound alike. Never mention provinces ids, tags, indices, the map or any game mechanic.
- When it helps, suggest up to three orders the government could give this turn, each one sentence in ${LANGUAGE[locale]}, written as an order. When the government wants a course you advise against, one of them must still be the best way to do what it wants, so the leader always has their own course on the table beside your alternatives. Suggest none when the question does not call for them.
- If the country is in crisis (PLAYER'S CRISES below) and one touches your field — the debt, the budget or prices for finance, the army's call-up for the military, the street and plots for the interior and intelligence — raise it even if you were asked something else, with the figures, what it will do next if nothing is done, and what you propose.
${OPERATION_MINISTRIES.includes(advisor) ? `- When the government wants a special operation — stirring up protests or a coup abroad, sabotage, a raid, an arrest, a cyber attack, a defection — plan it with them: propose it in "operation" (name, target, goal, means, timing, secrecy: open, covert or deniable), with its risks and chances in your answer. It starts only when the government approves it; refine it when they ask.\n` : ""}- You only advise; nothing happens until the turn is played.
Answer with ONE JSON object and nothing else:
{ "answer": "string", "orders": ["string"]${OPERATION_MINISTRIES.includes(advisor) ? ', "operation": { "name": "string", "target": "string", "goal": "string", "means": "string", "timing": "string", "secrecy": "open|covert|deniable" }' : ""} }`;

/** The user message of an advisor request; earlier questions go after it. */
export function buildAdvisorPrompt(state: GameState, index: MapIndex, advisor: AdvisorId = "military"): string {
  const mine = (state.directives ?? []).filter((d) => d.ministry === advisor);
  const lastReport = [...state.chronicle].reverse().flatMap((e) => (e.reports ?? []).filter((r) => r.ministry === advisor).map((r) => `[${e.to}] ${r.text}`))[0];
  const player = state.countries[state.player];
  const scenario = getScenario(state.scenarioId);
  return [
    `You advise the government of ${en(player.name)} [${state.player}]${player.leader ? `, led by ${player.leader}` : ""}. The date is ${state.date}.`,
    "",
    `SCENARIO BACKGROUND (the starting point, ${scenario.startDate}):`,
    scenario.context,
    "",
    describeWorld(state, index),
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
  ].join("\n");
}

export const LEGAL_INSTRUCTIONS = (locale: Locale, state?: GameState) => `${personaOf("chief", state)} You serve the player's government in Gulf of Trump, an alternate-history grand strategy game. The leader comes to you with acts of state — a new name for the country or one of its cities, a new colour for the country on the maps of the world (declared at the United Nations and to the other governments), a law or a decree — and you talk them through in character and draft them.
- Draft each act the leader asks for in "acts"; draft nothing when the leader only asks a question or is still thinking. When the wish is vague, ask what exactly they mean, and you may offer a wording.
- "rename": "target" is "country", or the English name of one of the country's cities exactly as YOUR COUNTRY'S CITIES lists it. Give the new name in Russian, Ukrainian and English as each language would really write it: translate words that mean something, transliterate proper names, keep the grammar of each language (adjectives agree, cases are right).
- "color": "#rrggbb", the colour the leader wants or the nearest real one.
- "law": a title and its text (what it says, in 1–3 sentences), "laws": which of the ten laws in force it changes (LAWS AND THEIR OPTIONS below; leave it empty for a law outside them), and "vote": "majority" for an ordinary law, "twothirds" for one that changes the constitution (elections, the state language, the form of government, the country's alignment where the constitution fixes it), "decree" for one the leader signs alone — only where the regime lets the leader rule by decree; say so plainly if it does not.
- "reaction" of each act: how the country takes it — "unrest" from -10 (it calms the country) to 20 (an outrage), and "note": who welcomes it, who resents it and why, in one sentence. Judge it honestly by the reasons the leader gives: an act with a public case, good timing and a reason people share passes quietly or wins support; one made on a whim, unexplained, insulting to a people, a faith, a minority or a neighbour, or breaking a deep tradition, angers people — the more the less it is argued. Warn the leader in your answer, and say what would soften it.
${IN_CHARACTER}
- When the leader insists on an act you advise against, draft it all the same, the best way it can be done, and say what it will cost.
- Answer from the world state and history below, as someone on that date would know them. Speak in your own voice, to the leader alone, in 1–3 short paragraphs, in ${LANGUAGE[locale]}. Never mention ids, tags, the map or any game mechanic; names and figures are fine.
- You only draft; nothing happens until the leader proclaims the act, puts it to parliament or signs it, and the turn is played.
Answer with ONE JSON object and nothing else:
{ "answer": "string", "acts": [{ "kind": "rename", "target": "country|city", "names": { "ru": "string", "uk": "string", "en": "string" }, "reaction": { "unrest": 0, "note": "string" } }, { "kind": "color", "color": "#rrggbb", "reaction": { "unrest": 0, "note": "string" } }, { "kind": "law", "title": "string", "text": "string", "laws": { "lawId": "option" }, "vote": "majority|twothirds|decree", "reaction": { "unrest": 0, "note": "string" } }] }`;

/** The user message of a talk with the chief of staff about acts of state. */
export function buildLegalPrompt(state: GameState, index: MapIndex, cities: { key: string; name: string }[]): string {
  const player = state.countries[state.player];
  const scenario = getScenario(state.scenarioId);
  const decided = (state.bills ?? []).filter((b) => b.status !== "proposed").slice(-8);
  return [
    `You serve the government of ${en(player.name)} [${state.player}]${player.leader ? `, led by ${player.leader}` : ""}. The date is ${state.date}.`,
    "",
    `SCENARIO BACKGROUND (the starting point, ${scenario.startDate}):`,
    scenario.context,
    "",
    describeWorld(state, index),
    "",
    "HISTORY SO FAR:",
    describeHistory(state),
    "",
    "LAWS AND THEIR OPTIONS (from the most open to the most closed):",
    ...LAW_IDS.map((id) => `- ${id}: ${LAWS[id].join(", ")}`),
    "",
    "ACTS ALREADY DECIDED:",
    decided.length ? decided.map((b) => `- [${b.decided ?? b.date}] ${b.title}: ${b.status}${b.note ? ` — ${b.note}` : ""}`).join("\n") : "- none",
    "",
    "YOUR COUNTRY'S CITIES (English name | as it is called now):",
    cities.length ? cities.map((c) => `- ${c.key}${c.name !== c.key ? ` | ${c.name}` : ""}`).join("\n") : "- not known",
  ].join("\n");
}

export type SetupPart = "politics" | "officials";

const OFFICIALS_RULES = (locale: Locale) => `- The people of the government on that date, as they really were (or as the history so far makes them): for each post that exists — head (head of state), government (head of government, if a different person), chief (the leader's chief of staff or closest aide: the head of the presidential office, the chief of the leader's chancellery, the party secretary who runs the apparatus), military (the chief of the general staff or the war minister), finance (the minister of finance or the economy), foreign (foreign minister), interior (interior minister or the head of the police and security), intelligence (head of intelligence), bank (central bank governor) — give the post, its title as that country called it in ${LANGUAGE[locale]}, the person's name, 2–4 traits, how they speak (a short phrase), competence and loyalty to the leader from 1 to 5, the faction they belong to if any, and a one-sentence bio. Use the whole 1–5 range honestly: real governments mix the able and the out-of-depth, the devoted and the scheming — not everyone is a 4. Give each person traits and a manner of speaking of their own, so no two sound alike.`;

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

const OFFICIAL_SHAPE = `{ "post": "${OFFICIAL_POSTS.join("|")}", "title": "string", "name": "string", "traits": ["string"], "manner": "string", "competence": 3, "loyalty": 3, "faction": "string", "bio": "string" }`;

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
  const scenario = getScenario(state.scenarioId);
  return [
    `The player's country: ${en(player.name)} [${state.player}]${player.leader ? `, led by ${player.leader}` : ""}${player.government ? ` (${en(player.government)})` : ""}. The date is ${state.date}.`,
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
{ "candidates": [{ "name": "string", "background": "string", "traits": ["string"], "manner": "string", "competence": 3, "loyalty": 3, "faction": "string", "pros": ["string"], "cons": ["string"] }] }`;

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

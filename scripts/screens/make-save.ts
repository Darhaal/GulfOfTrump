// Writes scripts/screens/1950-usa.json: the save the screenshots load (see
// scripts/screens.mjs). One 1950 game as the United States, two turns into
// the Korean War and the third being written, played through the engine's
// own path — the government and politics as the setup call would start them,
// every turn's answer through OutcomeSchema → sanitizeOutcome → applyOutcome,
// every minister's report through MinisterReportSchema → sanitizeMinisterReport
// → applyMinisterReport — only the game master's words are written by hand.
//
//   npx vitest run --config scripts/screens/vitest.config.mts
import { writeFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import { addLegal, proposeBill, type ActDraft } from "@/engine/acts";
import { addAdvice, type AdvisorId } from "@/engine/advisors";
import { OfficialsSetupSchema, startOfficials } from "@/engine/government";
import { seedInterests } from "@/engine/interests";
import { applyOutcome, OutcomeSchema, sanitizeOutcome } from "@/engine/outcome";
import { PoliticsSetupSchema, startPolitics } from "@/engine/politics";
import { applyMinisterReport, MinisterReportSchema, reportsDue, sanitizeMinisterReport } from "@/engine/reports";
import { getScenario } from "@/engine/scenarios";
import { parseGameState } from "@/engine/schema";
import { createGame } from "@/engine/setup";
import type { GameState } from "@/engine/types";
import { mapIndexWithTowns, mapRegions } from "../../tests/support/world";

const ID = "5c1950a0-7e2b-4f3d-9a61-1950c0ffee25";
const OUT = "scripts/screens/1950-usa.json";

/** Real time moves on a little with every step, as it would while playing. */
let clock = Date.parse("2026-10-19T18:00:00Z");
const now = () => new Date((clock += 7 * 60_000));

const OFFICIALS = {
  officials: [
    { post: "head", title: "President", name: "Harry S. Truman", traits: ["decisive", "plain-spoken", "partisan"], manner: "blunt, folksy, quick to anger", competence: 4, loyalty: 5, faction: "Fair Deal Democrats" },
    { post: "chief", title: "Assistant to the President", name: "John R. Steelman", traits: ["methodical", "discreet", "labour mediator"], manner: "calm and procedural", competence: 3, loyalty: 5 },
    {
      post: "military",
      title: "Secretary of Defense",
      name: "Louis A. Johnson",
      traits: ["abrasive", "budget-cutter", "ambitious"],
      manner: "combative and sure of himself",
      competence: 2,
      loyalty: 3,
      bio: "Cut the services to the bone in 1949 and feuds openly with the Secretary of State.",
    },
    { post: "finance", title: "Secretary of the Treasury", name: "John W. Snyder", traits: ["cautious", "old friend of Truman", "sound money"], manner: "dry and careful", competence: 3, loyalty: 5 },
    { post: "foreign", title: "Secretary of State", name: "Dean Acheson", traits: ["brilliant", "patrician", "Atlanticist"], manner: "elegant, precise, cutting", competence: 5, loyalty: 5, faction: "Europe first" },
    { post: "interior", title: "Attorney General", name: "J. Howard McGrath", traits: ["party man", "smooth", "lax"], manner: "affable", competence: 2, loyalty: 4 },
    { post: "intelligence", title: "Director of Central Intelligence", name: "Roscoe H. Hillenkoetter", traits: ["naval officer", "honest", "outmatched"], manner: "stiff and formal", competence: 2, loyalty: 4 },
    { post: "bank", title: "Chairman of the Federal Reserve", name: "Thomas B. McCabe", traits: ["independent", "inflation hawk"], manner: "measured", competence: 4, loyalty: 2 },
  ],
};

const POLITICS = {
  regime: "Federal presidential republic",
  unrest: 18,
  loyalty: { army: 82, police: 86, security: 80, elites: 66 },
  laws: { conscription: "selective", martial: "none", press: "free", assembly: "free", elections: "free", economy: "market", language: "single", alignment: "aligned", deathPenalty: "applied", exit: "open" },
  nextElection: "1950-11-07",
  parliament: { name: "House of Representatives", seats: 435 },
  parties: [
    { name: "Democratic Party", short: "D", leader: "Harry S. Truman", ideology: "The New Deal and the Fair Deal, with the Southern conservatives", support: 51, status: "ruling", stance: { economy: -3, freedom: 4, nation: 1 }, seats: 263, color: "#3a66b0" },
    { name: "Republican Party", short: "R", leader: "Robert A. Taft", ideology: "Smaller government, lower taxes, Asia first against communism", support: 45, status: "opposition", stance: { economy: 5, freedom: 3, nation: 5 }, seats: 171, color: "#c43c3c" },
    { name: "American Labor Party", short: "ALP", leader: "Vito Marcantonio", ideology: "The popular-front left", support: 2, status: "opposition", stance: { economy: -8, freedom: 2, nation: -5 }, seats: 1, color: "#7b4aa6" },
    { name: "Socialist Party of America", short: "SP", leader: "Norman Thomas", ideology: "Democratic socialism, against the communists", support: 2, status: "opposition", stance: { economy: -7, freedom: 6, nation: -3 }, seats: 0, color: "#d98a2b" },
  ],
  plots: [{ title: "The China lobby's campaign against Acheson", by: "Senator Joseph McCarthy and the Republican right", kind: "conspiracy", strength: 30, known: true }],
};

/** Plays one turn as the client does: the draft becomes the turn's orders, the answer goes through the engine. */
function playTurn(state: GameState, raw: object): GameState {
  const index = mapIndexWithTowns(getScenario(state.scenarioId).map);
  const orders = [...new Set([...(state.standing ?? []), ...state.draft])];
  const outcome = sanitizeOutcome(state, OutcomeSchema.parse(raw), { orders, index });
  expect(outcome.dropped, "the engine refused part of the turn").toBe(0);
  return applyOutcome(state, outcome, orders, now(), index.regions);
}

/** A minister's report on the last turn, through the same checks as a real one. */
function report(state: GameState, ministry: AdvisorId, reply: object): GameState {
  const turn = state.chronicle.at(-1)!.turn;
  const checked = sanitizeMinisterReport(state, turn, ministry, MinisterReportSchema.parse(reply));
  expect(checked, `a report from ${ministry}`).not.toBeNull();
  return applyMinisterReport(state, checked!, now());
}

it("writes the 1950 save the screenshots load", () => {
  vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(ID);
  const scenario = getScenario("1950");
  let game = createGame(scenario, mapRegions(scenario.map), "usa", now(), "en");
  game.title = "Truman's war";

  // The setup call: the government and the politics of the date.
  game = seedInterests({
    ...game,
    politics: startPolitics(PoliticsSetupSchema.parse(POLITICS), game.date),
    officials: startOfficials(OfficialsSetupSchema.parse(OFFICIALS), game.date),
  });

  // Turn 1: 25 June 1950.
  game.directives = [
    { id: "dir-1-1", ministry: "military", text: "Hold a line in Korea until the divisions from Japan and home arrive", since: game.date },
    { id: "dir-1-2", ministry: "foreign", text: "Keep the British, the Commonwealth and the French in the UN Command", since: game.date },
    { id: "dir-1-3", ministry: "intelligence", text: "Watch Manchuria for Chinese armies moving towards the Yalu", since: game.date },
  ];
  game = addAdvice(
    game,
    "foreign",
    "Will the Soviets block us at the Security Council if we bring Korea there today?",
    {
      answer:
        "Mr. President, Malik has stayed away from the Council since January over the Chinese seat, and Moscow has not told him to come back. If we move today there is no veto in the room, and Trygve Lie is with us. Ask for a resolution that names the North as the aggressor and calls on every member to help the Republic — and ask for it before the Kremlin thinks better of the boycott.",
      orders: ["Ask the Security Council to call on members to help South Korea"],
    },
    now(),
  );
  game.draft = [
    "Order MacArthur to send the 24th Infantry Division from Japan to Korea",
    "Ask the Security Council to call on members to help South Korea",
    "Send the Seventh Fleet into the Taiwan Strait to keep both Chinas out of the war",
  ];
  game = playTurn(game, {
    headline: "Seoul falls, and the first Americans are thrown back at Osan",
    narrative: [
      "Seoul fell on the third day. The Han bridges were blown with refugees still on them, and the Republic's army, without tanks or anti-tank guns, came apart in the hills south of the city.",
      "The Security Council met twice with the Soviet seat empty. Resolution 83 called on members to help South Korea; Resolution 84 put the forces they sent under a United Nations Command, and Washington chose MacArthur to lead it. Britain, Australia, Canada and the Netherlands sent ships and aircraft at once.",
      "From Japan the 24th Division came over by sea and air to Pusan. Its first battalion, Task Force Smith, met the T-34s at Osan on 5 July with bazookas that would not stop them and was overrun in seven hours. The division fought on the Kum River and fell back through the July rains towards Taejon.",
      "The Seventh Fleet sailed into the Taiwan Strait. Peking called it aggression; Chiang Kai-shek, told not to attack the mainland, kept his troops at home.",
    ].join("\n\n"),
    events: [
      { title: "The Security Council names the North the aggressor", body: "With the Soviet delegate away, Resolutions 83 and 84 pass: members are to help South Korea under a unified command led by the United States.", kind: "diplomacy", countries: ["usa", "ussr", "south-korea"] },
      { title: "Task Force Smith overrun at Osan", body: "Four hundred Americans with no anti-tank guns slow the North Korean armour for seven hours before breaking.", kind: "military", countries: ["usa", "north-korea"] },
      { title: "The Seventh Fleet in the Taiwan Strait", body: "Truman orders the fleet between the two Chinas; Peking protests, Taipei is told to hold back.", kind: "military", countries: ["usa", "china", "taiwan"] },
    ],
    transfers: [
      { region: "kp-north-hwanghae", to: "north-korea", mode: "occupy" },
      { region: "kp-south-hwanghae", to: "north-korea", mode: "occupy" },
      { region: "kr-gangwon", to: "north-korea", mode: "occupy" },
      { region: "kr-seoul", to: "north-korea", mode: "occupy" },
      { region: "kr-incheon", to: "north-korea", mode: "occupy" },
      { region: "kr-gyeonggi", to: "north-korea", mode: "occupy" },
      { region: "kr-north-chungcheong", to: "north-korea", mode: "occupy" },
      { region: "kr-south-chungcheong", to: "north-korea", mode: "occupy" },
      { region: "kr-north-gyeongsang", to: "north-korea", mode: "contest", share: 30 },
    ],
    orders: [
      { n: 1, result: "success", note: "The 24th Division landed at Pusan from 1 July; its first battalion met the enemy at Osan on the 5th and was overrun." },
      { n: 2, result: "success", note: "Resolutions 83 and 84 passed with the Soviet seat empty; a United Nations Command under MacArthur was set up on 7 July." },
      { n: 3, result: "success", note: "The fleet is in the Taiwan Strait; Peking calls it aggression, and Taipei holds back as it was told." },
    ],
    warsJoined: [
      { war: "Korean War", country: "usa", side: "defenders" },
      { war: "Korean War", country: "uk", side: "defenders" },
      { war: "Korean War", country: "australia", side: "defenders" },
    ],
    alliancesFormed: [
      {
        name: "United Nations Command",
        members: ["usa", "south-korea", "uk", "australia", "canada", "new-zealand", "netherlands", "france", "turkey", "philippines", "thailand"],
        kind: "alliance",
        terms: "Forces sent to Korea under one command led by the United States (Security Council Resolution 84, 7 July 1950)",
      },
    ],
    // Troops are a change, in thousands: the Army fills its divisions.
    economy: [{ country: "usa", troops: 190 }],
    ministries: [
      { ministry: "military", matter: "The first American troops fought at Osan and on the Kum River and fell back towards Taejon.", directives: [{ id: "dir-1-1", status: "progress", note: "The 24th and 25th Divisions are in Korea; the 1st Cavalry is landing at Pohang." }] },
      { ministry: "foreign", matter: "The Security Council acted with the Soviet seat empty.", directives: [{ id: "dir-1-2", status: "progress", note: "Britain and Australia have sent ships and aircraft; ground troops are promised but not yet sailing." }] },
      { ministry: "intelligence", matter: "", directives: [{ id: "dir-1-3", status: "progress", note: "Two Chinese armies have moved from the coast opposite Taiwan towards Manchuria." }] },
    ],
  });
  game = report(game, "military", {
    report: "Mr. President, our first battalion was overrun at Osan and the 24th Division is falling back on Taejon, but the 25th is in line and the 1st Cavalry lands at Pohang this week. The trouble is not courage, it is what we sent them with: bazookas that bounce off a T-34 and divisions at two-thirds strength. That is the price of the economies the Congress asked of us, and I would ask that the State Department carry its share of the explaining.",
    stance: "loyal",
    orders: ["Fly the new 3.5-inch bazookas to Korea"],
  });
  game = report(game, "foreign", {
    report: "The Council has done in a week what it could not do in five years: the North is named, the members are called on, and the command is ours. Britain and Australia are with us at sea and in the air. Malik's chair is still empty, but I would not count on it staying so — he takes the presidency of the Council in August.",
    stance: "loyal",
  });
  game = report(game, "intelligence", {
    report: "We have no agents in Manchuria and must read Peking's moves from radio traffic and the press. What we see is two armies of the Third Field Army moving north from the coast opposite Formosa. It may be a precaution. It may not.",
    stance: "loyal",
    orders: ["Fly reconnaissance along the Yalu"],
  });

  // Turn 2: 25 July 1950.
  game = addAdvice(
    game,
    "foreign",
    "Can we warn Peking without going through the Russians?",
    {
      answer:
        "Through New Delhi. Panikkar, the Indian ambassador in Peking, sees Chou En-lai, and Nehru wants nothing more than to be the man who kept the war small. Tell him plainly that our quarrel is in Korea and nowhere else, and let him carry it.",
      orders: ["Warn Beijing, through India, that we have no designs on China"],
    },
    now(),
  );
  game.draft = [
    "Hold the Pusan perimeter along the Naktong at all costs",
    "Mobilise the reserves and ask Congress for emergency defence money",
    "Plan an amphibious landing behind the enemy lines at Inchon",
  ];
  game = playTurn(game, {
    headline: "The Pusan perimeter holds on the Naktong",
    narrative: [
      "By early August the UN Command held only a rectangle of the south-east, about a hundred miles by fifty, behind the Naktong River: Pusan, Taegu and the roads between. Taejon fell on 20 July and General Dean, commanding the 24th Division, was missing in the hills.",
      "Walker shifted his few reserves from one break to the next. At the Naktong bulge the Marines and the 24th Division threw the North Koreans back across the river; north of Taegu the Bowling Alley held. Pohang changed hands twice. The North Korean divisions, stretched to the end of their supply lines and bombed by day, had more men at the front than ever but fewer to replace them.",
      "Congress voted $11.6 billion more for defence without a fight. The Organized Reserve and four National Guard divisions are being called up, and the draft calls doubled.",
      "On 1 August Malik came back to the Security Council to take its chair and blocked every motion on Korea for a month. In Tokyo, MacArthur's staff are working on a landing at Inchon; the Navy says the tides are impossible.",
    ].join("\n\n"),
    events: [
      { title: "Taejon falls; General Dean missing", body: "The 24th Division is driven out of Taejon on 20 July; its commander is lost in the retreat.", kind: "military", countries: ["usa", "north-korea"] },
      { title: "The Soviet delegate returns to the Security Council", body: "Malik ends the boycott on 1 August to take the Council's chair and blocks every resolution on Korea.", kind: "diplomacy", countries: ["ussr", "usa"] },
      { title: "Congress votes $11.6 billion for defence", body: "The supplemental passes both houses almost without debate; reservists and the National Guard are called up.", kind: "economy", countries: ["usa"] },
      { title: "The British 27th Brigade lands at Pusan", body: "The first ground troops of another member of the United Nations reach Korea from Hong Kong.", kind: "military", countries: ["uk", "south-korea"] },
    ],
    transfers: [
      { region: "kr-daejeon", to: "north-korea", mode: "occupy" },
      { region: "kr-sejong", to: "north-korea", mode: "occupy" },
      { region: "kr-north-jeolla", to: "north-korea", mode: "occupy" },
      { region: "kr-south-jeolla", to: "north-korea", mode: "occupy" },
      { region: "kr-gwangju", to: "north-korea", mode: "occupy" },
      { region: "kr-north-gyeongsang", to: "north-korea", mode: "contest", share: 72 },
      { region: "kr-south-gyeongsang", to: "north-korea", mode: "contest", share: 30 },
    ],
    orders: [
      { n: 1, result: "success", note: "The Naktong line held through the August battles; the North Koreans gained ground but not Taegu." },
      { n: 2, result: "success", note: "Congress voted $11.6 billion more for defence; reservists and the National Guard are being called up." },
      { n: 3, result: "partial", note: "The landing is planned for mid-September; the Joint Chiefs doubt the tides and the harbour." },
    ],
    economy: [{ country: "usa", troops: 250, army: 24 }],
    ministries: [
      { ministry: "military", matter: "The perimeter held at the Naktong bulge and north of Taegu; losses are heavy and the reserves are being called up.", directives: [{ id: "dir-1-1", status: "done", note: "The line on the Naktong holds, and the Eighth Army now has more men in Korea than the enemy has at the front." }] },
      { ministry: "foreign", matter: "The Soviet delegate is back in the Council and blocks everything on Korea.", directives: [{ id: "dir-1-2", status: "progress", note: "The British 27th Brigade has landed; the French and the Turks promise battalions." }] },
      { ministry: "intelligence", matter: "", directives: [{ id: "dir-1-3", status: "progress", note: "Lin Piao's Fourth Field Army is moving into Manchuria; there is no sign yet that it will cross the Yalu." }] },
    ],
  });
  game = report(game, "military", {
    report: "The perimeter held, Mr. President. Walker stopped them at the Naktong bulge and north of Taegu, and for the first time we have more men in Korea than they have at the front. But the supplemental takes the services far past the ceiling we set last year, and I would rather see every dollar spent well than spent fast. With respect, it was the Secretary of State's speech in January that told Kim we would not fight for Korea; I will not be the one to answer for that on the Hill.",
    stance: "uneasy",
    grievance: "The war spending undoes the economies he made, and he blames State for Korea",
    orders: ["Send two more divisions from the United States to Korea"],
  });
  game = report(game, "foreign", {
    report: "Malik is back and has made the Council useless for August; the General Assembly is where we will go next. The British brigade is ashore, and the French and the Turks have promised battalions. Panikkar will carry a message to Chou En-lai if we give him one: it should say our quarrel is in Korea and nowhere else.",
    stance: "loyal",
    orders: ["Warn Beijing, through India, that we have no designs on China"],
  });
  game = report(game, "intelligence", {
    report: "Lin Piao's Fourth Field Army is moving into Manchuria — perhaps 180,000 men by now. Our estimate remains that Peking will not intervene, but I must tell you the estimate rests more on what the Chinese have said than on anything we have seen.",
    stance: "loyal",
    orders: ["Fly reconnaissance along the Yalu"],
  });
  expect(reportsDue(game.chronicle.at(-1))).toEqual([]);

  // Turn 3, being written: an act of state put forward, and the orders so far.
  const act: Extract<ActDraft, { kind: "law" }> = {
    kind: "law",
    title: "The Defense Production Act",
    text: "The President may set priorities for industry, allocate scarce materials and, if prices run away, control prices and wages for as long as the emergency lasts.",
    laws: { economy: "mixed" },
    vote: "majority",
    reaction: { unrest: 3, note: "Business grumbles at the controls and the unions fear a wage freeze, but most of the country wants the war won." },
  };
  game = addLegal(game, "Which law holds us back most right now? Draft a change.", { answer: "The war is being fought on a peacetime economy. Steel, aluminium and copper go to whoever pays first, and prices are already climbing on the news from Korea. Congress will give you powers to set priorities and, if it comes to it, to hold prices; here is the bill.", acts: [act] }, now());
  game = proposeBill(game, act, now());
  game.draft = ["Land the X Corps at Inchon and cut the North Korean supply lines", "Warn Beijing, through India, that we have no designs on China"];
  game.updatedAt = now().toISOString();

  // What the browser does on import: the save must come back the same.
  const parsed = parseGameState(JSON.parse(JSON.stringify(game)));
  expect(parsed).not.toBeNull();
  expect(parsed!.chronicle).toHaveLength(2);
  writeFileSync(OUT, `${JSON.stringify(parsed)}\n`);
});

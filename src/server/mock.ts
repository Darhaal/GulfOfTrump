import "server-only";
import { isDemo } from "@/constants/app";
import type { InputMessage } from "./chatgpt/responses";

/**
 * A stand-in game master for development and tests, switched on with
 * GOT_MOCK_AI=1. It answers instantly and changes almost nothing — enough to
 * click through the whole interface without a ChatGPT account.
 */
export function isMockEnabled(): boolean {
  return process.env.GOT_MOCK_AI === "1" || isDemo();
}

export async function mockComplete(instructions: string, input: InputMessage[], onDelta?: (d: string) => void): Promise<string> {
  const prompt = input.map((m) => m.content).join("\n");
  // Each request kind is told apart by the answer shape its instructions ask for.
  const officials = instructions.includes('{ "officials": [');
  const answer = instructions.includes('{ "answer": "string", "acts"')
    ? mockActs(prompt)
    : instructions.includes('{ "answer": "string"')
    ? mockAdvice(instructions)
    : instructions.includes('{ "lines": [')
      ? JSON.stringify({ lines: mockSummitLines(prompt) })
      : instructions.includes('{ "outcome": "string", "agreements"')
        ? JSON.stringify({ outcome: "[mock] The sides agreed to keep talking.", agreements: ["[mock] A working group meets next month"] })
    : instructions.includes('{ "candidates": [')
      ? mockCandidates()
      : instructions.includes('"regime": "string"')
        ? mockPolitics(officials)
        : officials
          ? JSON.stringify({ officials: MOCK_OFFICIALS })
          : instructions.includes('"reply"')
            ? mockDiplomacy()
            : mockTurn(prompt);
  // Stream in a few pieces so the progress indicator has something to show.
  for (let i = 0; i < answer.length; i += 400) {
    onDelta?.(answer.slice(i, i + 400));
    await new Promise((r) => setTimeout(r, 15));
  }
  return answer;
}

function mockTurn(prompt: string): string {
  const player = /PLAYER: .*\[([a-z0-9-]+)\]/.exec(prompt)?.[1] ?? "";
  const period = /PERIOD TO SIMULATE: (\S+) to (\S+)/.exec(prompt);
  const orders = prompt.split("PLAYER ORDERS FOR THIS PERIOD:")[1]?.trim() ?? "";
  // Every invited government accepts; every summit due in the period is held.
  const section = (title: string) => prompt.split(title)[1]?.split("\n\n")[0] ?? "";
  const proposals = [...section("PLAYER'S PROPOSALS").matchAll(/^- ([\w-]+) \| \w+ \| [^|]+ \| ([^|\n]+)/gm)].flatMap(([, id, invited]) =>
    invited.split(",").map((country) => ({ proposal: id, country: country.trim(), answer: "accept", note: "[mock] Agreed." })),
  );
  // Each ministry with directives reports them still under way.
  const directiveReports = section("MINISTRY DIRECTIVES")
    .split(/\n- /)
    .map((block) => /^-?\s*(military|finance|foreign|interior|intelligence) /.exec(block.trim()) && block)
    .filter((block): block is string => Boolean(block))
    .map((block) => ({
      ministry: /(military|finance|foreign|interior|intelligence)/.exec(block)![1],
      text: "[mock] The ministry is working on it.",
      directives: [...block.matchAll(/^\s+(d[\w-]+):/gm)].map(([, id]) => ({ id, status: "progress", note: "[mock] Under way." })),
    }));
  const summitsHeld = [...section("SUMMITS PLANNED").matchAll(/^- ([\w-]+) \| ([^|]+) \| [^|]* \| (\d{4}-\d{2}-\d{2}) \| ([^|\n]+)/gm)]
    .filter(([, , , date]) => !period || date < period[2])
    .map(([, id, title, , participants]) => ({
      summit: id,
      outcome: `[mock] ${title.trim()}: the sides agreed to meet again.`,
      transcript: participants.split(",").map((c) => ({ country: c.trim(), speaker: "", text: "[mock] We came to talk, not to fight." })),
    }));
  // A rally starts in the player's first province and climbs a stage each turn; a war costs people.
  const home = /PLAYER'S PROVINCES[^\n]*\n- ([\w-]+)/.exec(prompt)?.[1];
  const protest = /PROTESTS AGAINST THE GOVERNMENT[^\n]*\n- ([^|]+) \| (\w+)/.exec(prompt);
  const stages = ["rally", "strike", "riot", "uprising"];
  const protests = home
    ? [{ title: protest ? protest[1].trim() : "[mock] Rally against prices", stage: protest ? stages[Math.min(3, stages.indexOf(protest[2]) + 1)] : "rally", size: 20, where: [home], demands: "[mock] Cheaper bread" }]
    : [];
  // Every bill and decree passes.
  const bills = [...section("BILLS AND DECREES OF THE PLAYER'S GOVERNMENT").matchAll(/^- (bill-[\w-]+) \|/gm)].map(([, bill]) => ({ bill, status: "passed", note: "[mock] Passed by the majority." }));
  // Every trade proposal is accepted.
  const trade = [...section("PLAYER'S TRADE PROPOSALS").matchAll(/^- (deal-[\w-]+) \|/gm)].map(([, deal]) => ({ deal, status: "accepted", note: "[mock] Agreed." }));
  const atWar = player !== "" && section("WARS").includes(player);
  // One piece of news from abroad: the first other country in the list, so the world's news always has an item.
  const abroad = [...section("COUNTRIES (tag").matchAll(/^- ([\w-]+) \|/gm)].map(([, tag]) => tag).find((tag) => tag !== player);
  const population = atWar ? [{ country: player, deaths: 12, refugees: 30, cause: "[mock] the war" }] : [];
  return JSON.stringify({
    headline: `[mock] A quiet period ${period ? `from ${period[1]} to ${period[2]}` : ""}`.trim(),
    narrative: `This is the offline mock game master (GOT_MOCK_AI=1). Nothing real was simulated.\n\nOrders received:\n${orders}`,
    events: [
      { title: "[mock] Diplomats exchange notes", body: "Embassies report a calm week.", kind: "diplomacy", countries: player ? [player] : [] },
      ...(abroad ? [{ title: "[mock] A cabinet reshuffle abroad", body: "A minister resigns; the government carries on.", kind: "politics", countries: [abroad] }] : []),
    ],
    transfers: [],
    newCountries: [],
    warsStarted: [],
    warsJoined: [],
    warsEnded: [],
    alliancesFormed: [],
    alliancesJoined: [],
    alliancesLeft: [],
    stats: player ? [{ country: player, stability: 1 }] : [],
    leaders: [],
    economy: player ? [{ country: player, growth: 2.5, troops: 5 }] : [],
    invitations: proposals,
    summitsHeld,
    reports: directiveReports,
    protests,
    population,
    trade,
    bills,
  });
}

/** Two participants answer the player, picked from the meeting's list. */
function mockSummitLines(prompt: string) {
  const player = /\[([a-z0-9-]+)\]/.exec(prompt)?.[1];
  const tags = [...prompt.matchAll(/^- ([a-z0-9-]+) \|/gm)].map((m) => m[1]).filter((t) => t !== player).slice(0, 2);
  return tags.map((country, i) => ({ country, speaker: "", text: i ? "[mock] We have reservations." : "[mock] We hear you and are ready to talk." }));
}

const MOCK_OFFICIALS = [
  { post: "head", title: "[mock] President", name: "A. Ruler", traits: ["stubborn", "charismatic"], manner: "grand phrases", competence: 3, loyalty: 5 },
  { post: "chief", title: "[mock] Head of the Presidential Office", name: "D. Gatekeeper", traits: ["schemer", "tireless"], manner: "quiet, knowing", competence: 4, loyalty: 4, faction: "[mock] The inner circle" },
  { post: "military", title: "[mock] Chief of the General Staff", name: "G. Marshal", traits: ["blunt", "cautious"], manner: "short sentences, maps", competence: 4, loyalty: 3 },
  { post: "finance", title: "[mock] Minister of Finance", name: "F. Ledger", traits: ["pedantic"], manner: "numbers first", competence: 3, loyalty: 3 },
  { post: "foreign", title: "[mock] Foreign Minister", name: "E. Envoy", traits: ["polished", "vain"], manner: "diplomatic", competence: 4, loyalty: 2, faction: "[mock] The westernisers" },
  { post: "interior", title: "[mock] Minister of the Interior", name: "P. Order", traits: ["hard", "suspicious"], manner: "curt", competence: 3, loyalty: 4 },
  { post: "intelligence", title: "[mock] Head of Intelligence", name: "S. Shadow", traits: ["secretive"], manner: "in estimates", competence: 5, loyalty: 3 },
];

function mockCandidates(): string {
  return JSON.stringify({
    candidates: [
      { name: "[mock] L. Loyal", background: "Party veteran", traits: ["loyal", "grey"], manner: "agrees", competence: 2, loyalty: 5, pros: ["Never betrays"], cons: ["Out of his depth"] },
      { name: "[mock] T. Expert", background: "Career professional", traits: ["able", "independent"], manner: "precise", competence: 5, loyalty: 2, pros: ["Knows the job"], cons: ["Has his own views"] },
    ],
  });
}

function mockPolitics(withOfficials = false): string {
  return JSON.stringify({
    ...(withOfficials ? { officials: MOCK_OFFICIALS } : {}),
    regime: "[mock] Parliamentary republic",
    unrest: 25,
    nextElection: "2030-01-01",
    loyalty: { army: 55, police: 75, security: 60, elites: 50 },
    laws: { conscription: "selective", martial: "none", press: "restricted", assembly: "permit", elections: "managed", economy: "mixed", language: "single", alignment: "nonbloc", deathPenalty: "moratorium", exit: "open" },
    parliament: { name: "[mock] National Assembly", seats: 450, threshold: 5 },
    parties: [
      { name: "[mock] Party of Order", short: "PO", color: "#1f5fbf", leader: "A. Ruler", ideology: "Conservative", support: 38, seats: 201, status: "ruling", stance: { economy: 4, freedom: -2, nation: 5 } },
      { name: "[mock] Farmers Union", short: "FU", color: "#3d9a4a", leader: "D. Field", ideology: "Agrarian", support: 9, seats: 31, status: "coalition", stance: { economy: -1, freedom: 0, nation: 6 } },
      { name: "[mock] Labour", short: "LAB", color: "#d23a2f", leader: "B. Union", ideology: "Social democratic", support: 27, seats: 118, status: "opposition", stance: { economy: -5, freedom: 3, nation: -2 } },
      { name: "[mock] Free Voice", leader: "C. Critic", ideology: "Liberal", support: 15, seats: 62, status: "opposition", stance: { economy: 2, freedom: 8, nation: -6 } },
      { name: "[mock] Red Front", short: "RF", color: "#8b1a1a", leader: "E. Barricade", ideology: "Communist", support: 6, seats: 0, status: "underground", stance: { economy: -9, freedom: -6, nation: -3 } },
      { name: "[mock] Homeland First", short: "HF", color: "#5b3a8c", leader: "F. Drummer", ideology: "Nationalist", support: 5, seats: 18, status: "opposition", stance: { economy: 3, freedom: -7, nation: 9 } },
    ],
    plots: [{ title: "[mock] Officers' circle", by: "Army officers", kind: "conspiracy", strength: 15, known: true }],
  });
}

function mockAdvice(instructions: string): string {
  // Ministers who plan operations always sketch one, so the approval card can be tried.
  const operation = instructions.includes('"operation": {')
    ? { name: "[mock] Operation Quiet Lantern", target: "[mock] the neighbouring capital", goal: "[mock] Rally the opposition against its government", means: "[mock] Money to two opposition papers, organisers on the ground", timing: "[mock] Six weeks", secrecy: "deniable" }
    : undefined;
  return JSON.stringify({
    answer: "[mock] Our assessment is cautious: hold the line, keep the budget in check and watch the neighbours.",
    orders: ["[mock] Raise the readiness of the border garrisons"],
    ...(operation ? { operation } : {}),
  });
}

/** The chief of staff drafts what the leader asked for, judged by keywords. */
function mockActs(prompt: string): string {
  const said = (prompt.split(/SAYS:\n/).pop() ?? "").toLowerCase();
  const city = /^- ([^|\n]+?)(?: \||$)/m.exec(prompt.split("YOUR COUNTRY'S CITIES")[1]?.split("\n").slice(1).join("\n") ?? "")?.[1];
  const acts: unknown[] = [];
  if (/переимен|перейменув|rename|назв|name/.test(said))
    acts.push(
      /город|місто|city/.test(said) && city
        ? { kind: "rename", target: city, names: { ru: "[mock] Новоград", uk: "[mock] Новоград", en: "[mock] Novograd" }, reaction: { unrest: 3, note: "[mock] Locals shrug; the old name is dear to some." } }
        : { kind: "rename", target: "country", names: { ru: "[mock] Новая Республика", uk: "[mock] Нова Республіка", en: "[mock] New Republic" }, reaction: { unrest: said.length < 40 ? 12 : 4, note: said.length < 40 ? "[mock] Nobody understands why; the opposition calls it a whim." : "[mock] The case was made; most accept it." } },
    );
  if (/цвет|колір|colou?r/.test(said)) acts.push({ kind: "color", color: "#2a6f97", reaction: { unrest: 1, note: "[mock] A curiosity abroad, a shrug at home." } });
  if (/закон|указ|декрет|law|decree/.test(said) || !acts.length)
    acts.push({ kind: "law", title: "[mock] On the freedom of the press", text: "[mock] Censorship is lifted; newspapers need no licence.", laws: { press: "free" }, vote: "majority", reaction: { unrest: -3, note: "[mock] Journalists cheer; the security service grumbles." } });
  return JSON.stringify({ answer: "[mock] I have drafted it. Expect some noise, but it can be done.", acts });
}

function mockDiplomacy(): string {
  return JSON.stringify({
    reply: "[mock] We have received your note and will consider it carefully.",
    stance: "neutral",
    summary: "The mock government acknowledged the message without committing to anything.",
  });
}

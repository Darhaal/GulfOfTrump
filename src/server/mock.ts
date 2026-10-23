import "server-only";
import { isDemo } from "@/constants/app";
import { regimeFromText } from "@/engine/abroad";
import type { Locale } from "@/engine/types";
import { leaderName } from "@/i18n/leaders";
import type { InputMessage } from "./chatgpt/responses";

/**
 * The stand-in game master. It answers instantly and changes almost nothing,
 * in the interface language, generic enough for any date and country: enough
 * to play the whole game loop without a ChatGPT account. It answers:
 *
 * - every request when GOT_MOCK_AI=1 (development, tests) or on the public
 *   demo site;
 * - a request the player sent in the app's offline demo (server/demo.ts).
 */
export function isMockEnabled(): boolean {
  return process.env.GOT_MOCK_AI === "1" || isDemo();
}

type Text = Record<Locale, string>;

/** Everything the stand-in says, in the three languages. */
const SAY = {
  headline: {
    en: "A quiet period: the government holds its course",
    ru: "Спокойный период: правительство держит курс",
    uk: "Спокійний період: уряд тримає курс",
  },
  calm: {
    en: "No great upheavals this period. The ministries go about their work, the embassies report a calm mood abroad, and the markets wait for news.",
    ru: "Больших потрясений за этот период не случилось. Министерства занимаются своей работой, посольства сообщают о спокойной обстановке за рубежом, рынки ждут новостей.",
    uk: "Великих потрясінь за цей період не сталося. Міністерства займаються своєю роботою, посольства повідомляють про спокійну обстановку за кордоном, ринки чекають на новини.",
  },
  bio: {
    en: "The ChatGPT game master writes this person's life; the offline demo keeps it short.",
    ru: "Жизнь этого человека описывает ведущий ChatGPT; в офлайн-демо – только эта строка.",
    uk: "Життя цієї людини описує ведучий ChatGPT; в офлайн-демо – лише цей рядок.",
  },
  ordersUnderWay: { en: "The government's orders are under way:", ru: "Приказы правительства выполняются:", uk: "Накази уряду виконуються:" },
  actionsUnderWay: { en: "The movement's actions are under way:", ru: "Действия движения идут своим чередом:", uk: "Дії руху тривають:" },
  noOrders: {
    en: "The government gave no new orders; the country carries on as before.",
    ru: "Новых приказов правительство не отдавало, страна живёт прежним курсом.",
    uk: "Нових наказів уряд не віддавав, країна живе попереднім курсом.",
  },
  demoNote: {
    en: "This is the demo: an offline stand-in plays the world, so nothing is really simulated. Sign in with ChatGPT in Settings for the real game master.",
    ru: "Это демо: мир играет упрощённый офлайн-ведущий, поэтому по-настоящему ничего не моделируется. Войдите через ChatGPT в настройках, чтобы играл настоящий ведущий.",
    uk: "Це демо: світ грає спрощений офлайн-ведучий, тому насправді нічого не моделюється. Увійдіть через ChatGPT у налаштуваннях, щоб грав справжній ведучий.",
  },
  underWay: { en: "Under way.", ru: "Выполняется.", uk: "Виконується." },
  agreed: { en: "Agreed.", ru: "Согласны.", uk: "Згодні." },
  passed: { en: "Passed by the majority.", ru: "Принят большинством.", uk: "Ухвалено більшістю." },
  notesTitle: { en: "Diplomats exchange notes", ru: "Дипломаты обмениваются нотами", uk: "Дипломати обмінюються нотами" },
  notesBody: {
    en: "Embassies report a calm period and steady contacts.",
    ru: "Посольства сообщают о спокойном периоде и ровных контактах.",
    uk: "Посольства повідомляють про спокійний період і рівні контакти.",
  },
  reshuffleTitle: { en: "A cabinet reshuffle", ru: "Перестановки в правительстве", uk: "Перестановки в уряді" },
  reshuffleBody: {
    en: "A minister resigns; the government carries on.",
    ru: "Один из министров ушёл в отставку, правительство продолжает работу.",
    uk: "Один із міністрів пішов у відставку, уряд продовжує роботу.",
  },
  rally: { en: "Rally against prices", ru: "Митинг против роста цен", uk: "Мітинг проти зростання цін" },
  bread: { en: "Cheaper bread", ru: "Дешёвый хлеб", uk: "Дешевий хліб" },
  war: { en: "the war", ru: "война", uk: "війна" },
  meetAgain: {
    en: "{title}: the sides agreed to meet again.",
    ru: "{title}: стороны договорились встретиться снова.",
    uk: "{title}: сторони домовилися зустрітися знову.",
  },
  hear: { en: "We hear you and are ready to talk.", ru: "Мы вас слышим и готовы к разговору.", uk: "Ми вас чуємо і готові до розмови." },
  reservations: { en: "We have reservations.", ru: "У нас есть оговорки.", uk: "У нас є застереження." },
  keepTalking: { en: "The sides agreed to keep talking.", ru: "Стороны договорились продолжить переговоры.", uk: "Сторони домовилися продовжити переговори." },
  workingGroup: {
    en: "A working group meets next month",
    ru: "Рабочая группа соберётся в следующем месяце",
    uk: "Робоча група збереться наступного місяця",
  },
  report: {
    en: "{who}: To my mind the period changed little for us. The work goes on, and our plans still hold.",
    ru: "{who}: по-моему, период мало что изменил для нас. Работа идёт, наши планы в силе.",
    uk: "{who}: на мою думку, період мало що змінив для нас. Робота триває, наші плани в силі.",
  },
  reportFailed: {
    en: " One task failed, and I will not hide my concern.",
    ru: " Одна из задач провалена, и я не стану скрывать беспокойства.",
    uk: " Одне із завдань провалено, і я не приховуватиму занепокоєння.",
  },
  keepBudget: {
    en: "Keep the ministry's budget as it is",
    ru: "Сохранить бюджет министерства на прежнем уровне",
    uk: "Зберегти бюджет міністерства на колишньому рівні",
  },
  budgetReason: {
    en: "A little more in taxes and for the army, less for the administration: the deficit stays about where it is.",
    ru: "Чуть больше налогов и денег армии, меньше администрации: дефицит останется примерно прежним.",
    uk: "Трохи більше податків і грошей армії, менше адміністрації: дефіцит лишиться приблизно таким, як є.",
  },
  advice: {
    en: "Our assessment is cautious: hold the line, keep the budget in check and watch the neighbours.",
    ru: "Наша оценка осторожная: держать линию, следить за бюджетом и присматривать за соседями.",
    uk: "Наша оцінка обережна: тримати лінію, стежити за бюджетом і пильнувати сусідів.",
  },
  garrisons: {
    en: "Raise the readiness of the border garrisons",
    ru: "Повысить готовность пограничных гарнизонов",
    uk: "Підвищити готовність прикордонних гарнізонів",
  },
  opName: { en: "Operation Quiet Lantern", ru: "Операция «Тихий фонарь»", uk: "Операція «Тихий ліхтар»" },
  opTarget: { en: "the neighbouring capital", ru: "соседняя столица", uk: "сусідня столиця" },
  opGoal: {
    en: "Rally the opposition against its government",
    ru: "Сплотить оппозицию против её правительства",
    uk: "Згуртувати опозицію проти її уряду",
  },
  opMeans: {
    en: "Money to two opposition papers, organisers on the ground",
    ru: "Деньги двум оппозиционным газетам, организаторы на месте",
    uk: "Гроші двом опозиційним газетам, організатори на місці",
  },
  opTiming: { en: "Six weeks", ru: "Шесть недель", uk: "Шість тижнів" },
  cityShrug: {
    en: "Locals shrug; the old name is dear to some.",
    ru: "Горожане пожимают плечами, но старое имя кому-то дорого.",
    uk: "Містяни знизують плечима, але стара назва комусь дорога.",
  },
  caseMade: { en: "The case was made; most accept it.", ru: "Доводы прозвучали, большинство принимает.", uk: "Аргументи прозвучали, більшість погоджується." },
  colour: {
    en: "A curiosity abroad, a shrug at home.",
    ru: "За рубежом – любопытство, дома – равнодушие.",
    uk: "За кордоном – цікавість, удома – байдужість.",
  },
  note: {
    en: "We have received your note and will consider it carefully.",
    ru: "Мы получили вашу ноту и внимательно её рассмотрим.",
    uk: "Ми отримали вашу ноту й уважно її розглянемо.",
  },
  assembly: { en: "National Assembly", ru: "Национальное собрание", uk: "Національні збори" },
  plot: { en: "Officers' circle", ru: "Кружок офицеров", uk: "Гурток офіцерів" },
  plotBy: { en: "Army officers", ru: "Армейские офицеры", uk: "Армійські офіцери" },
  head: { en: "Head of state", ru: "Глава государства", uk: "Глава держави" },
  movementName: { en: "Civic Forum", ru: "Гражданский форум", uk: "Громадянський форум" },
  movementLeader: { en: "A. Varga", ru: "А. Варга", uk: "А. Варга" },
  regimeDemocracy: { en: "Parliamentary democracy", ru: "Парламентская демократия", uk: "Парламентська демократія" },
  regimeLimited: { en: "Authoritarian republic", ru: "Авторитарная республика", uk: "Авторитарна республіка" },
  regimeParty: { en: "One-party state", ru: "Однопартийное государство", uk: "Однопартійна держава" },
  regimeMilitary: { en: "Military rule", ru: "Военное правление", uk: "Військове правління" },
  regimeAutocracy: { en: "Dictatorship", ru: "Диктатура", uk: "Диктатура" },
  rubberStamp: { en: "Assembly of the nation", ru: "Собрание нации", uk: "Збори нації" },
  rulingParty: { en: "Party of the Nation", ru: "Партия нации", uk: "Партія нації" },
  backMotion: {
    en: "Our faction supports the government's motion: the country needs a firm hand now.",
    ru: "Наша фракция поддерживает предложение правительства: стране сейчас нужна твёрдая рука.",
    uk: "Наша фракція підтримує пропозицію уряду: країні зараз потрібна тверда рука.",
  },
  opposeMotion: {
    en: "We will vote against. The government brings this to the house without answering for what it has already done.",
    ru: "Мы будем голосовать против. Правительство несёт это в зал, не ответив за то, что уже сделало.",
    uk: "Ми голосуватимемо проти. Уряд несе це до залу, не відповівши за те, що вже зробив.",
  },
  talkReply: {
    en: "We have heard you. Put your promises on paper and name the date – until then we do not stand down.",
    ru: "Мы вас услышали. Изложите обещания на бумаге и назовите срок – до тех пор мы не отступим.",
    uk: "Ми вас почули. Викладіть обіцянки на папері й назвіть строк – доти ми не відступимо.",
  },
  talkDeal: {
    en: "They accepted the terms on paper and agreed to stand down while the government keeps its word.",
    ru: "Они приняли условия на бумаге и согласились отступить, пока правительство держит слово.",
    uk: "Вони прийняли умови на папері й погодилися відступити, поки уряд тримає слово.",
  },
} satisfies Record<string, Text>;

const say = (locale: Locale, key: keyof typeof SAY, vars: Record<string, string> = {}) =>
  Object.entries(vars).reduce((text, [k, v]) => text.replace(`{${k}}`, v), SAY[key][locale]);

/** A stage of a turn, told apart by the fields its answer's shape asks for (engine/stagePrompts.ts). */
function turnStageOf(instructions: string): "story" | "world" | "home" | null {
  const headline = instructions.includes('"headline": "string"');
  const transfers = instructions.includes('"transfers": [');
  const economy = instructions.includes('"economy": [');
  if (headline && !transfers && !economy) return "story";
  if (transfers && !headline) return "world";
  if (economy && !headline && !transfers) return "home";
  return null;
}

/** The fields each stage of a turn answers with. */
const STAGE_KEYS = {
  story: ["headline", "narrative", "orders"],
  world: ["events", "transfers", "newCountries", "warsStarted", "warsJoined", "warsEnded", "alliancesFormed", "alliancesJoined", "alliancesLeft", "leaders", "invitations", "summitsHeld", "sessions", "population"],
  home: ["opposition", "economy", "ministries", "protests", "trade", "bills", "acts"],
} as const;

/**
 * How long the stand-in waits before each stage of a turn, so the stages can
 * be watched arrive (GOT_MOCK_STAGE_MS: one figure for all, or three for the
 * story, the world and home). Nothing by default.
 */
function stageDelay(stage: "story" | "world" | "home"): number {
  const figures = (process.env.GOT_MOCK_STAGE_MS ?? "").split(",").map((x) => Number(x.trim())).filter((x) => Number.isFinite(x) && x > 0);
  if (!figures.length) return 0;
  return figures.length >= 3 ? figures[["story", "world", "home"].indexOf(stage)] : figures[0];
}

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (!ms || signal?.aborted) return resolve();
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    });
  });

export async function mockComplete(instructions: string, input: InputMessage[], onDelta?: (d: string) => void, locale: Locale = "en", signal?: AbortSignal): Promise<string> {
  const prompt = input.map((m) => m.content).join("\n");
  // A stage of a turn answers with its own fields of the whole turn's answer.
  const stage = turnStageOf(instructions);
  if (stage) {
    await wait(stageDelay(stage), signal);
    const whole = mockTurn(prompt, locale);
    const part: Record<string, unknown> = Object.fromEntries(STAGE_KEYS[stage].filter((k) => k in whole).map((k) => [k, whole[k]]));
    const arms = whole.arms as { losses: unknown[]; research: unknown[] };
    if (stage === "world") part.arms = { losses: arms.losses };
    if (stage === "home") part.arms = { research: arms.research };
    return streamOut(JSON.stringify(part), onDelta);
  }
  // Each request kind is told apart by the answer shape its instructions ask for.
  const officials = instructions.includes('{ "officials": [');
  const answer = instructions.includes('{ "bio": "string" }')
    ? JSON.stringify({ bio: say(locale, "bio") })
    : instructions.includes('{ "formations": [')
    ? mockArmy(prompt, locale)
    : instructions.includes('{ "speeches": [')
    ? mockSession(prompt, locale)
    : instructions.includes('{ "speaker": "string", "said": "string" }')
    ? JSON.stringify({ speaker: /Their spokesman: ([^\n]+?)\.\n/.exec(prompt)?.[1] ?? "", said: say(locale, "talkReply") })
    : instructions.includes('"result": "deal|concession')
    ? JSON.stringify({ result: "deal", note: say(locale, "talkDeal") })
    : instructions.includes('{ "deputies": [')
    ? JSON.stringify({ deputies: deputiesIn(locale) })
    : instructions.includes('{ "report": "string"')
    ? mockReport(prompt, locale)
    : instructions.includes('{ "answer": "string"')
      ? mockAdvice(instructions, prompt, locale)
        : instructions.includes('{ "lines": [')
          ? JSON.stringify({ lines: mockSummitLines(prompt, locale) })
          : instructions.includes('{ "outcome": "string", "agreements"')
            ? JSON.stringify({ outcome: say(locale, "keepTalking"), agreements: [say(locale, "workingGroup")] })
            : instructions.includes('{ "candidates": [')
              ? mockCandidates(locale)
              : instructions.includes('"regime": "string"')
                ? mockPolitics(prompt, locale, officials)
                : officials
                  ? JSON.stringify({ officials: mockOfficials(prompt, locale) })
                  : instructions.includes('"reply"')
                    ? mockDiplomacy(locale)
                    : JSON.stringify(mockTurn(prompt, locale));
  return streamOut(answer, onDelta);
}

/** Streams an answer in a few pieces so the progress indicator has something to show. */
async function streamOut(answer: string, onDelta?: (d: string) => void): Promise<string> {
  for (let i = 0; i < answer.length; i += 400) {
    onDelta?.(answer.slice(i, i + 400));
    await new Promise((r) => setTimeout(r, 15));
  }
  return answer;
}

/**
 * Acts of state for the orders that ask for them: "Rename X to Y" (or
 * "Переименовать X в Y", "Перейменувати X на Y") gives X the name Y in every
 * language; an order to recolour the country gives it a blue.
 */
function actsFor(orderLines: string[], locale: Locale): unknown[] {
  const acts: unknown[] = [];
  for (const line of orderLines.map((l) => l.trim().replace(/^\d+\.\s*/, ""))) {
    const rename = /(?:rename|переименовать|перейменувати)\s+(.+?)\s+(?:to|into|в|во|на)\s+(.+?)[.!]?$/i.exec(line);
    if (rename) {
      const unquote = (t: string) => t.replace(/[«»"“”„']/g, "").trim();
      const target = /^(the country|our country|страну|нашу страну|країну|нашу країну)$/i.test(unquote(rename[1])) ? "country" : unquote(rename[1]);
      const name = unquote(rename[2]);
      acts.push({ kind: "rename", target, names: { ru: name, uk: name, en: name }, reaction: { unrest: target === "country" ? 6 : 3, note: say(locale, target === "country" ? "caseMade" : "cityShrug") } });
    } else if (/цвет|колір|кольор|перекрас|перефарб|colou?r/i.test(line)) {
      acts.push({ kind: "color", color: "#2a6f97", reaction: { unrest: 1, note: say(locale, "colour") } });
    }
  }
  return acts;
}

function mockTurn(prompt: string, locale: Locale): Record<string, unknown> {
  const player = /PLAYER: .*\[([a-z0-9-]+)\]/.exec(prompt)?.[1] ?? "";
  const period = /PERIOD TO SIMULATE: (\S+) to (\S+)/.exec(prompt);
  const orderLines = (prompt.split("PLAYER ORDERS FOR THIS PERIOD:")[1] ?? "").split("\n").filter((l) => /^\d+\. /.test(l.trim()));
  // Every invited government accepts.
  const section = (title: string) => prompt.split(title)[1]?.split("\n\n")[0] ?? "";
  const proposals = [...section("PLAYER'S PROPOSALS").matchAll(/^- ([\w-]+) \| \w+ \| [^|]+ \| ([^|\n]+)/gm)].flatMap(([, id, invited]) =>
    invited.split(",").map((country) => ({ proposal: id, country: country.trim(), answer: "accept", note: say(locale, "agreed") })),
  );
  // Each ministry with directives has them still under way; its minister writes the report afterwards.
  const ministries = section("MINISTRY DIRECTIVES")
    .split(/\n- /)
    .map((block) => /^-?\s*(chief|military|finance|foreign|interior|intelligence|science) /.exec(block.trim()) && block)
    .filter((block): block is string => Boolean(block))
    .map((block) => ({
      ministry: /(chief|military|finance|foreign|interior|intelligence|science)/.exec(block)![1],
      matter: "",
      directives: [...block.matchAll(/^\s+(d[\w-]+):/gm)].map(([, id]) => ({ id, status: "progress", note: say(locale, "underWay") })),
    }));
  // Summits among other governments only, by their outcome: the player's own wait for the player to attend.
  const summitsHeld = [...section("SUMMITS PLANNED").matchAll(/^- ([\w-]+) \| ([^|]+) \| [^|]* \| (\d{4}-\d{2}-\d{2}) \| ([^|\n]+)/gm)]
    .filter(([, , , date, participants]) => (!period || date < period[2]) && !participants.split(",").map((c) => c.trim()).includes(player))
    .map(([, id, title]) => ({ summit: id, outcome: say(locale, "meetAgain", { title: title.trim() }) }));
  // An order that calls a session: of the bloc it names, or else the first organisation the player belongs to.
  const blocs = [...section("ALLIANCES, PACTS AND ORGANISATIONS").matchAll(/^- ([\w-]+) \| ([^|]+) \| (\w+) \| ([^|\n]+)/gm)]
    .map(([, id, name, kind, members]) => ({ id, name: name.trim().toLowerCase(), kind, members: members.split(",").map((m) => m.trim()) }))
    .filter((b) => b.members.includes(player));
  const calling = orderLines.map((l) => l.trim().replace(/^\d+\.\s*/, "")).find((o) => /заседан|засідан|session|созва|скликат|convene/i.test(o));
  const called = calling ? (blocs.find((b) => calling.toLowerCase().includes(b.name) || calling.includes(b.id)) ?? blocs.find((b) => b.kind === "organization")) : undefined;
  const sessions = calling && called ? [{ bloc: called.id, agenda: calling.slice(0, 200) }] : [];
  // A rally about prices in the player's first province; one already under way stays as it is.
  const home = /PLAYER'S PROVINCES[^\n]*\n- ([\w-]+)/.exec(prompt)?.[1];
  const protest = /PROTESTS AGAINST THE GOVERNMENT[^\n]*\n- ([^|]+) \| (\w+)/.exec(prompt);
  const protests = home
    ? [{ title: protest ? protest[1].trim() : say(locale, "rally"), stage: protest ? protest[2] : "rally", size: 20, where: [home], demands: say(locale, "bread") }]
    : [];
  // Every bill and decree passes.
  const bills = [...section("BILLS AND DECREES OF THE PLAYER'S GOVERNMENT").matchAll(/^- (bill-[\w-]+) \|/gm)].map(([, bill]) => ({ bill, status: "passed", note: say(locale, "passed") }));
  // Every trade proposal is accepted.
  const trade = [...section("PLAYER'S TRADE PROPOSALS").matchAll(/^- (deal-[\w-]+) \|/gm)].map(([, deal]) => ({ deal, status: "accepted", note: say(locale, "agreed") }));
  const atWar = player !== "" && section("WARS").includes(player);
  // One piece of news from abroad: the first other country in the list, so the world's news always has an item.
  const abroad = [...section("COUNTRIES (tag").matchAll(/^- ([\w-]+) \|/gm)].map(([, tag]) => tag).find((tag) => tag !== player);
  const population = atWar ? [{ country: player, deaths: 12, refugees: 30, cause: say(locale, "war") }] : [];
  const narrative = [
    say(locale, "calm"),
    orderLines.length ? `${say(locale, /THE PLAYER IS NOT THE GOVERNMENT/.test(prompt) ? "actionsUnderWay" : "ordersUnderWay")}\n${orderLines.map((l) => l.trim()).join("\n")}` : say(locale, "noOrders"),
    say(locale, "demoNote"),
  ].join("\n\n");
  // A war costs a few tanks; a directive to the science ministry puts ten more points into the direction furthest behind.
  const split = /RESEARCH OF THE PLAYER'S GOVERNMENT \([^)]*\): ([^\n]*)/.exec(prompt)?.[1] ?? "";
  const behind = [...split.matchAll(/(\w+) \d+% \(([+−])([\d.]+) yr\)/g)]
    .map(([, direction, sign, years]) => ({ direction, ahead: (sign === "−" ? -1 : 1) * Number(years) }))
    .reduce<{ direction: string; ahead: number } | undefined>((worst, d) => (!worst || d.ahead < worst.ahead ? d : worst), undefined);
  const research = ministries.some((m) => m.ministry === "science") && behind ? [{ direction: behind.direction, shift: 10 }] : [];
  const arms = { losses: atWar ? [{ country: player, kind: "tanks", lost: 3 }] : [], research };
  // A player who leads the opposition: the movement grows a little, and gets a name and a leader if it has none (engine/role.ts).
  const role = /THE PLAYER IS NOT THE GOVERNMENT: [^\n]*/.exec(prompt)?.[0];
  const opposition = role
    ? {
        ...(role.includes("name it in opposition.name") ? { name: say(locale, "movementName") } : {}),
        ...(role.includes("name them in opposition.leader") ? { leader: say(locale, "movementLeader"), gender: "male" } : {}),
        support: 1,
        members: 2,
        street: 2,
        press: 1,
      }
    : undefined;
  return {
    ...(opposition ? { opposition } : {}),
    headline: say(locale, "headline"),
    narrative,
    events: [
      { title: say(locale, "notesTitle"), body: say(locale, "notesBody"), kind: "diplomacy", countries: player ? [player] : [] },
      ...(abroad ? [{ title: say(locale, "reshuffleTitle"), body: say(locale, "reshuffleBody"), kind: "politics", countries: [abroad] }] : []),
    ],
    orders: orderLines.map((_, i) => ({ n: i + 1, result: "partial", note: say(locale, "underWay") })),
    acts: actsFor(orderLines, locale),
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
    sessions,
    ministries,
    protests,
    population,
    trade,
    bills,
    arms,
  };
}

/** Two participants answer the player, picked from the meeting's list. */
function mockSummitLines(prompt: string, locale: Locale) {
  const player = /\[([a-z0-9-]+)\]/.exec(prompt)?.[1];
  const tags = [...prompt.matchAll(/^- ([a-z0-9-]+) \|/gm)].map((m) => m[1]).filter((t) => t !== player).slice(0, 2);
  return tags.map((country, i) => ({ country, speaker: "", text: say(locale, i ? "reservations" : "hear") }));
}

/** Two deputies for any ministry, in the interface language: an ambitious climber and the minister's protégé. */
const DEPUTIES: { name: Text; title: Text; traits: Text[]; manner: Text; competence: number; loyalty: number; bio: Text }[] = [
  {
    name: { en: "V. Kramer", ru: "В. Крамер", uk: "В. Крамер" },
    title: { en: "First Deputy Minister", ru: "Первый заместитель министра", uk: "Перший заступник міністра" },
    traits: [
      { en: "ambitious", ru: "честолюбивый", uk: "честолюбний" },
      { en: "sharp", ru: "острый ум", uk: "гострий розум" },
    ],
    manner: { en: "quick, a little too eager", ru: "быстро, чуть слишком охотно", uk: "швидко, трохи надто охоче" },
    competence: 4,
    loyalty: 3,
    bio: { en: "Rose fast through the ministry.", ru: "Быстро поднялся в министерстве.", uk: "Швидко піднявся в міністерстві." },
  },
  {
    name: { en: "P. Lind", ru: "П. Линд", uk: "П. Лінд" },
    title: { en: "Deputy Minister", ru: "Заместитель министра", uk: "Заступник міністра" },
    traits: [
      { en: "careful", ru: "осторожный", uk: "обережний" },
      { en: "devoted", ru: "преданный", uk: "відданий" },
    ],
    manner: { en: "measured, formal", ru: "сдержанно, официально", uk: "стримано, офіційно" },
    competence: 3,
    loyalty: 4,
    bio: { en: "Brought in by the minister.", ru: "Его привёл министр.", uk: "Його привів міністр." },
  },
];

const deputiesIn = (locale: Locale) =>
  DEPUTIES.map((d) => ({ name: d.name[locale], title: d.title[locale], traits: d.traits.map((t) => t[locale]), manner: d.manner[locale], competence: d.competence, loyalty: d.loyalty, bio: d.bio[locale] }));

/** A cabinet for any date: its posts in the interface language, plain names, the country's own leader at the head. */
const CABINET: { post: string; title: Text; name: Text; traits: Text[]; manner: Text; competence: number; loyalty: number; faction?: Text }[] = [
  {
    post: "chief",
    title: { en: "Chief of Staff", ru: "Глава администрации", uk: "Голова адміністрації" },
    name: { en: "D. Novak", ru: "Д. Новак", uk: "Д. Новак" },
    traits: [
      { en: "schemer", ru: "интриган", uk: "інтриган" },
      { en: "tireless", ru: "неутомимый", uk: "невтомний" },
    ],
    manner: { en: "quiet, knowing", ru: "тихо и со знанием дела", uk: "тихо й зі знанням справи" },
    competence: 4,
    loyalty: 4,
    faction: { en: "The inner circle", ru: "Ближний круг", uk: "Близьке коло" },
  },
  {
    post: "military",
    title: { en: "Chief of the General Staff", ru: "Начальник Генерального штаба", uk: "Начальник Генерального штабу" },
    name: { en: "G. Brandt", ru: "Г. Брандт", uk: "Г. Брандт" },
    traits: [
      { en: "blunt", ru: "прямой", uk: "прямий" },
      { en: "cautious", ru: "осторожный", uk: "обережний" },
    ],
    manner: { en: "short sentences, maps", ru: "коротко, с картами", uk: "коротко, з мапами" },
    competence: 4,
    loyalty: 3,
  },
  {
    post: "finance",
    title: { en: "Minister of the Economy", ru: "Министр экономики", uk: "Міністр економіки" },
    name: { en: "F. Weber", ru: "Ф. Вебер", uk: "Ф. Вебер" },
    traits: [{ en: "pedantic", ru: "педант", uk: "педант" }],
    manner: { en: "numbers first", ru: "сначала цифры", uk: "спершу цифри" },
    competence: 3,
    loyalty: 3,
  },
  {
    post: "industry",
    title: { en: "Minister of Industry", ru: "Министр промышленности", uk: "Міністр промисловості" },
    name: { en: "O. Krause", ru: "О. Краузе", uk: "О. Краузе" },
    traits: [{ en: "practical", ru: "практичный", uk: "практичний" }],
    manner: { en: "tonnes and shifts", ru: "тоннами и сменами", uk: "тоннами й змінами" },
    competence: 3,
    loyalty: 3,
  },
  {
    post: "foreign",
    title: { en: "Foreign Minister", ru: "Министр иностранных дел", uk: "Міністр закордонних справ" },
    name: { en: "E. Moreau", ru: "Э. Моро", uk: "Е. Моро" },
    traits: [
      { en: "polished", ru: "лощёный", uk: "вишуканий" },
      { en: "vain", ru: "тщеславный", uk: "марнославний" },
    ],
    manner: { en: "diplomatic", ru: "дипломатично", uk: "дипломатично" },
    competence: 4,
    loyalty: 2,
    faction: { en: "The westernisers", ru: "Западники", uk: "Західники" },
  },
  {
    post: "interior",
    title: { en: "Minister of the Interior", ru: "Министр внутренних дел", uk: "Міністр внутрішніх справ" },
    name: { en: "P. Hansen", ru: "П. Хансен", uk: "П. Гансен" },
    traits: [
      { en: "hard", ru: "жёсткий", uk: "жорсткий" },
      { en: "suspicious", ru: "подозрительный", uk: "підозріливий" },
    ],
    manner: { en: "curt", ru: "отрывисто", uk: "уривчасто" },
    competence: 3,
    loyalty: 4,
  },
  {
    post: "intelligence",
    title: { en: "Head of Intelligence", ru: "Глава разведки", uk: "Голова розвідки" },
    name: { en: "S. Ilić", ru: "С. Илич", uk: "С. Ілич" },
    traits: [{ en: "secretive", ru: "скрытный", uk: "потайний" }],
    manner: { en: "in estimates", ru: "оценками", uk: "оцінками" },
    competence: 5,
    loyalty: 3,
  },
  {
    post: "science",
    title: { en: "Minister of Science", ru: "Министр науки", uk: "Міністр науки" },
    name: { en: "R. Lindqvist", ru: "Р. Линдквист", uk: "Р. Ліндквіст" },
    traits: [
      { en: "curious", ru: "любознательный", uk: "допитливий" },
      { en: "absent-minded", ru: "рассеянный", uk: "неуважний" },
    ],
    manner: { en: "with caveats", ru: "с оговорками", uk: "із застереженнями" },
    competence: 4,
    loyalty: 3,
  },
];

/** The leader the prompt names ("…, led by Chancellor Adolf Hitler (…)"), without a second office after a semicolon. */
const leaderIn = (prompt: string) => /led by ([^(;\n]+?)(?: \(|;|\. The date|\n|$)/.exec(prompt)?.[1]?.trim();

function mockOfficials(prompt: string, locale: Locale) {
  // The prompt names the leader in English; the cabinet shows them in the player's language.
  const named = leaderIn(prompt);
  const leader = named && leaderName(named, locale);
  return [
    ...(leader
      ? [{ post: "head", title: say(locale, "head"), name: leader, traits: [{ en: "resolute", ru: "решительный", uk: "рішучий" }[locale]], manner: { en: "measured", ru: "взвешенно", uk: "виважено" }[locale], competence: 3, loyalty: 5 }]
      : []),
    ...CABINET.map((o) => ({
      post: o.post,
      title: o.title[locale],
      name: o.name[locale],
      traits: o.traits.map((t) => t[locale]),
      manner: o.manner[locale],
      competence: o.competence,
      loyalty: o.loyalty,
      ...(o.faction ? { faction: o.faction[locale] } : {}),
    })),
  ];
}

function mockCandidates(locale: Locale): string {
  const pick = (t: Text) => t[locale];
  return JSON.stringify({
    candidates: [
      {
        name: pick({ en: "L. Varga", ru: "Л. Варга", uk: "Л. Варга" }),
        background: pick({ en: "Party veteran", ru: "Ветеран партии", uk: "Ветеран партії" }),
        traits: [pick({ en: "loyal", ru: "преданный", uk: "відданий" }), pick({ en: "cautious", ru: "осторожный", uk: "обережний" })],
        manner: pick({ en: "agrees", ru: "соглашается", uk: "погоджується" }),
        competence: 2,
        loyalty: 5,
        pros: [pick({ en: "Never betrays", ru: "Никогда не предаст", uk: "Ніколи не зрадить" })],
        cons: [pick({ en: "Out of his depth", ru: "Не тянет должность", uk: "Не тягне посаду" })],
      },
      {
        name: pick({ en: "T. Lind", ru: "Т. Линд", uk: "Т. Лінд" }),
        background: pick({ en: "Career professional", ru: "Профессионал с карьерой", uk: "Професіонал із кар'єрою" }),
        traits: [pick({ en: "able", ru: "способный", uk: "здібний" }), pick({ en: "independent", ru: "независимый", uk: "незалежний" })],
        manner: pick({ en: "precise", ru: "точно", uk: "точно" }),
        competence: 5,
        loyalty: 2,
        pros: [pick({ en: "Knows the job", ru: "Знает дело", uk: "Знає справу" })],
        cons: [pick({ en: "Has his own views", ru: "Имеет свои взгляды", uk: "Має свої погляди" })],
      },
    ],
  });
}

/** A sitting of parliament: the government's first party backs the motion, the largest opposition party fights it; the government's speech wins over a waverer. */
function mockSession(prompt: string, locale: Locale): string {
  const rows = [...prompt.matchAll(/^- ([^|\n]+?) \| ([^|\n]*?) \| [^|\n]*? \| (\d+) \| (\w+) \| [^|\n]*? \| (for|against|wavering)$/gm)].map((m) => ({ name: m[1], leader: m[2], status: m[4], lean: m[5] }));
  const government = rows.find((r) => r.status === "ruling") ?? rows[0];
  const opposition = rows.find((r) => r.status === "opposition");
  const spoke = /\[GOVERNMENT\][^\n]*$/.test(prompt.trim());
  const waverer = rows.find((r) => r.lean === "wavering");
  return JSON.stringify({
    speeches: [
      ...(government ? [{ party: government.name, speaker: government.leader === "-" ? "" : government.leader, text: say(locale, "backMotion") }] : []),
      ...(opposition ? [{ party: opposition.name, speaker: opposition.leader === "-" ? "" : opposition.leader, text: say(locale, "opposeMotion") }] : []),
    ].slice(0, Math.max(1, rows.length)),
    sway: spoke && waverer ? [{ party: waverer.name, shift: 0.6 }] : [],
  });
}

/** Six parties of any parliament, named plainly; the ruling one is led by the country's own leader. */
const PARTIES: { name: Text; short: string; color: string; leader: Text; ideology: Text; support: number; seats: number; status: string; stance: { economy: number; freedom: number; nation: number } }[] = [
  { name: { en: "Party of Order", ru: "Партия порядка", uk: "Партія порядку" }, short: "PO", color: "#1f5fbf", leader: { en: "", ru: "", uk: "" }, ideology: { en: "Conservative", ru: "Консерваторы", uk: "Консерватори" }, support: 38, seats: 201, status: "ruling", stance: { economy: 4, freedom: -2, nation: 5 } },
  { name: { en: "Farmers' Union", ru: "Крестьянский союз", uk: "Селянська спілка" }, short: "FU", color: "#3d9a4a", leader: { en: "M. Sorel", ru: "М. Сорель", uk: "М. Сорель" }, ideology: { en: "Agrarian", ru: "Аграрии", uk: "Аграрії" }, support: 9, seats: 31, status: "coalition", stance: { economy: -1, freedom: 0, nation: 6 } },
  { name: { en: "Labour", ru: "Рабочая партия", uk: "Робітнича партія" }, short: "LAB", color: "#d23a2f", leader: { en: "J. Baum", ru: "Я. Баум", uk: "Я. Баум" }, ideology: { en: "Social democratic", ru: "Социал-демократы", uk: "Соціал-демократи" }, support: 27, seats: 118, status: "opposition", stance: { economy: -5, freedom: 3, nation: -2 } },
  { name: { en: "Free Voice", ru: "Свободный голос", uk: "Вільний голос" }, short: "FV", color: "#c9a227", leader: { en: "C. Lenz", ru: "К. Ленц", uk: "К. Ленц" }, ideology: { en: "Liberal", ru: "Либералы", uk: "Ліберали" }, support: 15, seats: 62, status: "opposition", stance: { economy: 2, freedom: 8, nation: -6 } },
  { name: { en: "Red Front", ru: "Красный фронт", uk: "Червоний фронт" }, short: "RF", color: "#8b1a1a", leader: { en: "E. Roth", ru: "Э. Рот", uk: "Е. Рот" }, ideology: { en: "Communist", ru: "Коммунисты", uk: "Комуністи" }, support: 6, seats: 0, status: "underground", stance: { economy: -9, freedom: -6, nation: -3 } },
  { name: { en: "Homeland First", ru: "Родина прежде всего", uk: "Батьківщина понад усе" }, short: "HF", color: "#5b3a8c", leader: { en: "F. Kral", ru: "Ф. Краль", uk: "Ф. Краль" }, ideology: { en: "Nationalist", ru: "Националисты", uk: "Націоналісти" }, support: 5, seats: 18, status: "opposition", stance: { economy: 3, freedom: -7, nation: 9 } },
];

/** A date some years after another. */
const yearsAfter = (date: string, years: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Math.round(years * 365.25));
  return d.toISOString().slice(0, 10);
};

/**
 * Politics as the country's kind of government has them, read from the
 * description the prompt gives: a democracy's six parties and its next
 * election in a couple of years; a dominant party under managed elections;
 * one party in a rubber-stamp assembly, the rest underground or banned and
 * no elections at all, under a dictator, a single party or a junta.
 */
function mockPolitics(prompt: string, locale: Locale, withOfficials = false): string {
  const named = leaderIn(prompt);
  const leader = named ? leaderName(named, locale) : { en: "A. Rector", ru: "А. Ректор", uk: "А. Ректор" }[locale];
  const government = /^The player's country: [^\n]*?\(([^)]*)\)\. The date is/m.exec(prompt)?.[1];
  const date = /The date is (\d{4}-\d{2}-\d{2})/.exec(prompt)?.[1] ?? "2000-01-01";
  const kind = government ? regimeFromText(government) : "limited";
  const parties = PARTIES.map((p) => ({ ...p, name: p.name[locale], leader: p.leader[locale] || leader, ideology: p.ideology[locale] }));
  const base = {
    ...(withOfficials ? { officials: mockOfficials(prompt, locale) } : {}),
    unrest: 25,
    loyalty: { army: 55, police: 75, security: 60, elites: 50 },
    plots: [{ title: say(locale, "plot"), by: say(locale, "plotBy"), kind: "conspiracy", strength: 15, known: true }],
  };
  if (kind === "democracy" || kind === "limited") {
    const managed = kind === "limited";
    // Under managed elections the ruling party holds most of the house.
    const seats: Record<string, number> = managed ? { PO: 290, FU: 31, LAB: 70, FV: 41, RF: 0, HF: 18 } : {};
    return JSON.stringify({
      ...base,
      regime: say(locale, managed ? "regimeLimited" : "regimeDemocracy"),
      nextElection: yearsAfter(date, managed ? 3.1 : 2.3),
      laws: { conscription: "selective", martial: "none", press: managed ? "restricted" : "free", assembly: managed ? "permit" : "free", elections: managed ? "managed" : "free", economy: "mixed", language: "single", alignment: "nonbloc", deathPenalty: "moratorium", exit: "open" },
      parliament: { name: say(locale, "assembly"), seats: 450, threshold: 5 },
      parties: parties.map((p) => (managed ? { ...p, seats: seats[p.short] } : p)),
    });
  }
  // One party sits; the others are underground or banned, and nobody votes.
  return JSON.stringify({
    ...base,
    regime: say(locale, kind === "party" ? "regimeParty" : kind === "military" ? "regimeMilitary" : "regimeAutocracy"),
    laws: { conscription: "universal", martial: "none", press: "state", assembly: "banned", elections: "suspended", economy: "mixed", language: "single", alignment: "aligned", deathPenalty: "applied", exit: "permit" },
    parliament: { name: say(locale, "rubberStamp"), seats: 450 },
    parties: [
      { ...parties[0], name: say(locale, "rulingParty"), short: "PN", support: 70, seats: 450, status: "ruling" },
      { ...parties[2], support: 18, seats: 0, status: "underground" },
      { ...parties[3], support: 7, seats: 0, status: "banned" },
      { ...parties[4], support: 5, seats: 0, status: "underground" },
    ],
  });
}

/** A minister gives their view after the turn; one whose directive failed is uneasy about it. */
function mockReport(prompt: string, locale: Locale): string {
  const who = /Give the view of ([^\n]+), in one paragraph\.$/m.exec(prompt)?.[1] ?? "";
  const failed = /— failed/.test(prompt);
  return JSON.stringify({
    report: `${say(locale, "report", { who })}${failed ? say(locale, "reportFailed") : ""}`.replace(/^: /, ""),
    stance: failed ? "uneasy" : "loyal",
    grievance: "",
  });
}

/** A question that asks a minister to change something: the stand-in proposes only then, as a minister does. */
const ASKS_CHANGE = /(измен|перераспредел|сдвин|поменя|раздели|приоритет|построй|строить|змін|перерозпод|пріоритет|будуй|change|shift|split|redistribut|prioriti|build first|focus)/i;

/** A question that asks for an order or what to do: the stand-in drafts one only then. */
const ASKS_ORDER = /(что делать|что нам делать|приказ|подготовь|составь|що робити|наказ|підготуй|склади|what should|what do we do|draft|an order)/i;

function mockAdvice(instructions: string, prompt: string, locale: Locale): string {
  // Ministers who plan operations always sketch one, so the approval card can be tried.
  const operation = instructions.includes('"operation": {')
    ? { name: say(locale, "opName"), target: say(locale, "opTarget"), goal: say(locale, "opGoal"), means: say(locale, "opMeans"), timing: say(locale, "opTiming"), secrecy: "deniable" }
    : undefined;
  const question = prompt.slice(prompt.lastIndexOf("ASKS:") + 5);
  const asked = ASKS_CHANGE.test(question);
  const proposal = !asked
    ? undefined
    : instructions.includes('"proposal": { "research"')
      ? { research: { military: 20, industry: 20, agriculture: 10, medicine: 10, science: 20, communications: 10, strategic: 10 } }
      : instructions.includes('"proposal": { "focus"')
        ? { focus: ["tanks", "aircraft"] }
        : undefined;
  const orders = ASKS_ORDER.test(question) ? [say(locale, "garrisons")] : undefined;
  return JSON.stringify({
    answer: say(locale, "advice"),
    ...(orders ? { orders } : {}),
    ...(operation ? { operation } : {}),
    ...(proposal ? { proposal } : {}),
    ...(instructions.includes('"budget": {') ? mockBudget(prompt, locale) : {}),
  });
}

/** Asked about the budget, the economy minister proposes a modest shift: a little more tax and army, less administration. */
function mockBudget(prompt: string, locale: Locale): { budget?: Record<string, number | string> } {
  const asked = prompt.slice(prompt.lastIndexOf("ASKS:"));
  if (!/бюдж|budget|налог|податк|tax|деньг|грош|money|дефицит|дефіцит|deficit|расход|видат|spend/i.test(asked)) return {};
  const now = /THE BUDGET NOW \(\$bn a year\): revenue ([\d.]+); army ([\d.]+); industry ([\d.]+); social ([\d.]+); other ([\d.]+)/.exec(prompt);
  if (!now) return {};
  const [revenue, army, industry, social, other] = now.slice(1).map(Number);
  const r = (v: number) => Math.round(v * 100) / 100;
  return { budget: { revenue: r(revenue * 1.03), army: r(army * 1.1), industry: r(industry), social: r(social), other: r(other * 0.9), reason: say(locale, "budgetReason") } };
}

/** The army as a plausible split of its field strength: two armies on the front (or the borders), a reserve near the capital, a fleet and an air force. */
function mockArmy(prompt: string, locale: Locale): string {
  const field = Number(/about (\d+) divisions/.exec(prompt)?.[1] ?? 0);
  const section = (title: string) => {
    const at = prompt.indexOf(title);
    if (at < 0) return [];
    const ids: string[] = [];
    for (const line of prompt.slice(at).split("\n").slice(1)) {
      const m = /^- ([^:\s]+):/.exec(line);
      if (!m) break;
      ids.push(m[1]);
    }
    return ids;
  };
  const front = section("FRONT PROVINCES");
  const own = section("PROVINCES YOU MAY NAME");
  const line = front.length ? front : own;
  const half = Math.max(1, Math.ceil(line.length / 2));
  const NAMES = {
    first: { en: "1st Army", ru: "1-я армия", uk: "1-ша армія" },
    second: { en: "2nd Army", ru: "2-я армия", uk: "2-га армія" },
    reserve: { en: "Reserve Army", ru: "Резервная армия", uk: "Резервна армія" },
    fleet: { en: "The Fleet", ru: "Флот", uk: "Флот" },
    air: { en: "Air Force", ru: "Военно-воздушные силы", uk: "Військово-повітряні сили" },
    front: { en: "The main front", ru: "Главный фронт", uk: "Головний фронт" },
    rear: { en: "Around the capital", ru: "Под столицей", uk: "Біля столиці" },
    note: { en: "An offline estimate: sign in with ChatGPT for the real picture.", ru: "Оценка офлайн-ведущего: войдите через ChatGPT, чтобы узнать точнее.", uk: "Оцінка офлайн-ведучого: увійдіть через ChatGPT, щоб дізнатися точніше." },
  } satisfies Record<string, Text>;
  const formations = [
    { name: NAMES.first[locale], kind: "army", divisions: Math.round(field * 0.4), theatre: NAMES.front[locale], provinces: line.slice(0, half).slice(0, 8), note: NAMES.note[locale] },
    { name: NAMES.second[locale], kind: "army", divisions: Math.round(field * 0.3), theatre: NAMES.front[locale], provinces: line.slice(half).slice(0, 8), note: "" },
    { name: NAMES.reserve[locale], kind: "reserve", divisions: Math.round(field * 0.2), theatre: NAMES.rear[locale], provinces: own.slice(0, 3), note: "" },
    { name: NAMES.fleet[locale], kind: "fleet", divisions: 0, theatre: "", provinces: [], note: "" },
    { name: NAMES.air[locale], kind: "air", divisions: 0, theatre: "", provinces: [], note: "" },
  ];
  return JSON.stringify({ formations });
}

function mockDiplomacy(locale: Locale): string {
  return JSON.stringify({
    reply: say(locale, "note"),
    stance: "neutral",
    summary: "The government acknowledged the message without committing to anything.",
  });
}

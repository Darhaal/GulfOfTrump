import "server-only";
import { isDemo } from "@/constants/app";
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
  ordersUnderWay: { en: "The government's orders are under way:", ru: "Приказы правительства выполняются:", uk: "Накази уряду виконуються:" },
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
  talk: { en: "We came to talk, not to fight.", ru: "Мы приехали говорить, а не воевать.", uk: "Ми приїхали говорити, а не воювати." },
  hear: { en: "We hear you and are ready to talk.", ru: "Мы вас слышим и готовы к разговору.", uk: "Ми вас чуємо і готові до розмови." },
  reservations: { en: "We have reservations.", ru: "У нас есть оговорки.", uk: "У нас є застереження." },
  keepTalking: { en: "The sides agreed to keep talking.", ru: "Стороны договорились продолжить переговоры.", uk: "Сторони домовилися продовжити переговори." },
  workingGroup: {
    en: "A working group meets next month",
    ru: "Рабочая группа соберётся в следующем месяце",
    uk: "Робоча група збереться наступного місяця",
  },
  report: {
    en: "{who}: the ministry carried on with its work this period, and its plans hold.",
    ru: "{who}: министерство в этом периоде продолжало работу, планы в силе.",
    uk: "{who}: міністерство в цьому періоді продовжувало роботу, плани в силі.",
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
  drafted: {
    en: "I have drafted it. Expect some noise, but it can be done.",
    ru: "Я подготовил проект. Шум будет, но это выполнимо.",
    uk: "Я підготував проєкт. Галас буде, але це здійсненно.",
  },
  cityShrug: {
    en: "Locals shrug; the old name is dear to some.",
    ru: "Горожане пожимают плечами, но старое имя кому-то дорого.",
    uk: "Містяни знизують плечима, але стара назва комусь дорога.",
  },
  whim: {
    en: "Nobody understands why; the opposition calls it a whim.",
    ru: "Никто не понимает зачем; оппозиция называет это прихотью.",
    uk: "Ніхто не розуміє навіщо; опозиція називає це примхою.",
  },
  caseMade: { en: "The case was made; most accept it.", ru: "Доводы прозвучали, большинство принимает.", uk: "Аргументи прозвучали, більшість погоджується." },
  colour: {
    en: "A curiosity abroad, a shrug at home.",
    ru: "За рубежом — любопытство, дома — равнодушие.",
    uk: "За кордоном — цікавість, удома — байдужість.",
  },
  pressTitle: { en: "On the freedom of the press", ru: "О свободе печати", uk: "Про свободу друку" },
  pressText: {
    en: "Censorship is lifted; newspapers need no licence.",
    ru: "Цензура отменена, газетам не нужна лицензия.",
    uk: "Цензуру скасовано, газетам не потрібна ліцензія.",
  },
  pressNote: {
    en: "Journalists cheer; the security service grumbles.",
    ru: "Журналисты ликуют, спецслужбы ворчат.",
    uk: "Журналісти радіють, спецслужби бурчать.",
  },
  note: {
    en: "We have received your note and will consider it carefully.",
    ru: "Мы получили вашу ноту и внимательно её рассмотрим.",
    uk: "Ми отримали вашу ноту й уважно її розглянемо.",
  },
  regime: { en: "The government of the day", ru: "Нынешнее правительство", uk: "Нинішній уряд" },
  assembly: { en: "National Assembly", ru: "Национальное собрание", uk: "Національні збори" },
  plot: { en: "Officers' circle", ru: "Кружок офицеров", uk: "Гурток офіцерів" },
  plotBy: { en: "Army officers", ru: "Армейские офицеры", uk: "Армійські офіцери" },
  head: { en: "Head of state", ru: "Глава государства", uk: "Глава держави" },
} satisfies Record<string, Text>;

const say = (locale: Locale, key: keyof typeof SAY, vars: Record<string, string> = {}) =>
  Object.entries(vars).reduce((text, [k, v]) => text.replace(`{${k}}`, v), SAY[key][locale]);

export async function mockComplete(instructions: string, input: InputMessage[], onDelta?: (d: string) => void, locale: Locale = "en"): Promise<string> {
  const prompt = input.map((m) => m.content).join("\n");
  // Each request kind is told apart by the answer shape its instructions ask for.
  const officials = instructions.includes('{ "officials": [');
  const answer = instructions.includes('{ "deputies": [')
    ? JSON.stringify({ deputies: deputiesIn(locale) })
    : instructions.includes('{ "report": "string"')
    ? mockReport(prompt, locale)
    : instructions.includes('{ "answer": "string", "acts"')
      ? mockActs(prompt, locale)
      : instructions.includes('{ "answer": "string"')
        ? mockAdvice(instructions, locale)
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
                    : mockTurn(prompt, locale);
  // Stream in a few pieces so the progress indicator has something to show.
  for (let i = 0; i < answer.length; i += 400) {
    onDelta?.(answer.slice(i, i + 400));
    await new Promise((r) => setTimeout(r, 15));
  }
  return answer;
}

function mockTurn(prompt: string, locale: Locale): string {
  const player = /PLAYER: .*\[([a-z0-9-]+)\]/.exec(prompt)?.[1] ?? "";
  const period = /PERIOD TO SIMULATE: (\S+) to (\S+)/.exec(prompt);
  const orderLines = (prompt.split("PLAYER ORDERS FOR THIS PERIOD:")[1] ?? "").split("\n").filter((l) => /^\d+\. /.test(l.trim()));
  // Every invited government accepts; every summit due in the period is held.
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
  const summitsHeld = [...section("SUMMITS PLANNED").matchAll(/^- ([\w-]+) \| ([^|]+) \| [^|]* \| (\d{4}-\d{2}-\d{2}) \| ([^|\n]+)/gm)]
    .filter(([, , , date]) => !period || date < period[2])
    .map(([, id, title, , participants]) => ({
      summit: id,
      outcome: say(locale, "meetAgain", { title: title.trim() }),
      transcript: participants.split(",").map((c) => ({ country: c.trim(), speaker: "", text: say(locale, "talk") })),
    }));
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
    orderLines.length ? `${say(locale, "ordersUnderWay")}\n${orderLines.map((l) => l.trim()).join("\n")}` : say(locale, "noOrders"),
    say(locale, "demoNote"),
  ].join("\n\n");
  // A war costs a few tanks; a directive to the science ministry starts the first project on offer.
  const research = ministries.some((m) => m.ministry === "science") ? /could start[^:]*: ([\w:-]+) \(/.exec(prompt)?.[1] : undefined;
  const arms = { losses: atWar ? [{ country: player, kind: "tanks", lost: 3 }] : [], research: research ? [{ project: research, action: "start" }] : [] };
  return JSON.stringify({
    headline: say(locale, "headline"),
    narrative,
    events: [
      { title: say(locale, "notesTitle"), body: say(locale, "notesBody"), kind: "diplomacy", countries: player ? [player] : [] },
      ...(abroad ? [{ title: say(locale, "reshuffleTitle"), body: say(locale, "reshuffleBody"), kind: "politics", countries: [abroad] }] : []),
    ],
    orders: orderLines.map((_, i) => ({ n: i + 1, result: "partial", note: say(locale, "underWay") })),
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
    ministries,
    protests,
    population,
    trade,
    bills,
    arms,
  });
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
    title: { en: "Minister of Finance", ru: "Министр финансов", uk: "Міністр фінансів" },
    name: { en: "F. Weber", ru: "Ф. Вебер", uk: "Ф. Вебер" },
    traits: [{ en: "pedantic", ru: "педант", uk: "педант" }],
    manner: { en: "numbers first", ru: "сначала цифры", uk: "спершу цифри" },
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

/** Six parties of any parliament, named plainly; the ruling one is led by the country's own leader. */
const PARTIES: { name: Text; short: string; color: string; leader: Text; ideology: Text; support: number; seats: number; status: string; stance: { economy: number; freedom: number; nation: number } }[] = [
  { name: { en: "Party of Order", ru: "Партия порядка", uk: "Партія порядку" }, short: "PO", color: "#1f5fbf", leader: { en: "", ru: "", uk: "" }, ideology: { en: "Conservative", ru: "Консерваторы", uk: "Консерватори" }, support: 38, seats: 201, status: "ruling", stance: { economy: 4, freedom: -2, nation: 5 } },
  { name: { en: "Farmers' Union", ru: "Крестьянский союз", uk: "Селянська спілка" }, short: "FU", color: "#3d9a4a", leader: { en: "M. Sorel", ru: "М. Сорель", uk: "М. Сорель" }, ideology: { en: "Agrarian", ru: "Аграрии", uk: "Аграрії" }, support: 9, seats: 31, status: "coalition", stance: { economy: -1, freedom: 0, nation: 6 } },
  { name: { en: "Labour", ru: "Рабочая партия", uk: "Робітнича партія" }, short: "LAB", color: "#d23a2f", leader: { en: "J. Baum", ru: "Я. Баум", uk: "Я. Баум" }, ideology: { en: "Social democratic", ru: "Социал-демократы", uk: "Соціал-демократи" }, support: 27, seats: 118, status: "opposition", stance: { economy: -5, freedom: 3, nation: -2 } },
  { name: { en: "Free Voice", ru: "Свободный голос", uk: "Вільний голос" }, short: "FV", color: "#c9a227", leader: { en: "C. Lenz", ru: "К. Ленц", uk: "К. Ленц" }, ideology: { en: "Liberal", ru: "Либералы", uk: "Ліберали" }, support: 15, seats: 62, status: "opposition", stance: { economy: 2, freedom: 8, nation: -6 } },
  { name: { en: "Red Front", ru: "Красный фронт", uk: "Червоний фронт" }, short: "RF", color: "#8b1a1a", leader: { en: "E. Roth", ru: "Э. Рот", uk: "Е. Рот" }, ideology: { en: "Communist", ru: "Коммунисты", uk: "Комуністи" }, support: 6, seats: 0, status: "underground", stance: { economy: -9, freedom: -6, nation: -3 } },
  { name: { en: "Homeland First", ru: "Родина прежде всего", uk: "Батьківщина понад усе" }, short: "HF", color: "#5b3a8c", leader: { en: "F. Kral", ru: "Ф. Краль", uk: "Ф. Краль" }, ideology: { en: "Nationalist", ru: "Националисты", uk: "Націоналісти" }, support: 5, seats: 18, status: "opposition", stance: { economy: 3, freedom: -7, nation: 9 } },
];

function mockPolitics(prompt: string, locale: Locale, withOfficials = false): string {
  const named = leaderIn(prompt);
  const leader = named ? leaderName(named, locale) : { en: "A. Rector", ru: "А. Ректор", uk: "А. Ректор" }[locale];
  return JSON.stringify({
    ...(withOfficials ? { officials: mockOfficials(prompt, locale) } : {}),
    regime: say(locale, "regime"),
    unrest: 25,
    nextElection: "2030-01-01",
    loyalty: { army: 55, police: 75, security: 60, elites: 50 },
    laws: { conscription: "selective", martial: "none", press: "restricted", assembly: "permit", elections: "managed", economy: "mixed", language: "single", alignment: "nonbloc", deathPenalty: "moratorium", exit: "open" },
    parliament: { name: say(locale, "assembly"), seats: 450, threshold: 5 },
    parties: PARTIES.map((p) => ({ ...p, name: p.name[locale], leader: p.leader[locale] || leader, ideology: p.ideology[locale] })),
    plots: [{ title: say(locale, "plot"), by: say(locale, "plotBy"), kind: "conspiracy", strength: 15, known: true }],
  });
}

/** A minister reports after the turn; one whose directive failed is uneasy about it. */
function mockReport(prompt: string, locale: Locale): string {
  const who = /Write the report of ([^\n]+)\.$/m.exec(prompt)?.[1] ?? "";
  const failed = /— failed/.test(prompt);
  return JSON.stringify({
    report: `${say(locale, "report", { who })}${failed ? say(locale, "reportFailed") : ""}`.replace(/^: /, ""),
    stance: failed ? "uneasy" : "loyal",
    grievance: "",
    orders: [say(locale, "keepBudget")],
  });
}

function mockAdvice(instructions: string, locale: Locale): string {
  // Ministers who plan operations always sketch one, so the approval card can be tried.
  const operation = instructions.includes('"operation": {')
    ? { name: say(locale, "opName"), target: say(locale, "opTarget"), goal: say(locale, "opGoal"), means: say(locale, "opMeans"), timing: say(locale, "opTiming"), secrecy: "deniable" }
    : undefined;
  return JSON.stringify({ answer: say(locale, "advice"), orders: [say(locale, "garrisons")], ...(operation ? { operation } : {}) });
}

/** The chief of staff drafts what the leader asked for, judged by keywords. */
function mockActs(prompt: string, locale: Locale): string {
  const said = (prompt.split(/SAYS:\n/).pop() ?? "").toLowerCase();
  const city = /^- ([^|\n]+?)(?: \||$)/m.exec(prompt.split("YOUR COUNTRY'S CITIES")[1]?.split("\n").slice(1).join("\n") ?? "")?.[1];
  const acts: unknown[] = [];
  if (/переимен|перейменув|rename|назв|name/.test(said))
    acts.push(
      /город|місто|city/.test(said) && city
        ? { kind: "rename", target: city, names: { ru: "Новоград", uk: "Новоград", en: "Novograd" }, reaction: { unrest: 3, note: say(locale, "cityShrug") } }
        : {
            kind: "rename",
            target: "country",
            names: { ru: "Новая Республика", uk: "Нова Республіка", en: "New Republic" },
            reaction: { unrest: said.length < 40 ? 12 : 4, note: say(locale, said.length < 40 ? "whim" : "caseMade") },
          },
    );
  if (/цвет|колір|colou?r/.test(said)) acts.push({ kind: "color", color: "#2a6f97", reaction: { unrest: 1, note: say(locale, "colour") } });
  if (/закон|указ|декрет|law|decree/.test(said) || !acts.length)
    acts.push({ kind: "law", title: say(locale, "pressTitle"), text: say(locale, "pressText"), laws: { press: "free" }, vote: "majority", reaction: { unrest: -3, note: say(locale, "pressNote") } });
  return JSON.stringify({ answer: say(locale, "drafted"), acts });
}

function mockDiplomacy(locale: Locale): string {
  return JSON.stringify({
    reply: say(locale, "note"),
    stance: "neutral",
    summary: "The government acknowledged the message without committing to anything.",
  });
}

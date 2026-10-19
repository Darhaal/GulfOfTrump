import type { Locale } from "@/engine/types";

/**
 * The About page, in three languages. Kept apart from messages.ts because it
 * is prose, not interface strings. What the game has, here and in README.md,
 * should say the same thing.
 */
export interface AboutContent {
  title: string;
  intro: string;
  rulesTitle: string;
  rules: { title: string; body: string }[];
  featuresTitle: string;
  features: { title: string; body: string }[];
  dataTitle: string;
  data: string[];
  authorTitle: string;
  authorName: string;
  authorBio: string;
  contact: string;
  licenseTitle: string;
  license: string;
}

const en: AboutContent = {
  title: "About",
  intro:
    "Gulf of Trump is a free, open-source alternate-history sandbox. A language model plays the rest of the world as game master; the game engine keeps the map, the wars, the economy and the books honest. It runs on your own computer and your own ChatGPT plan.",
  rulesTitle: "How to play",
  rules: [
    { title: "Pick a date and a country", body: "Five turning points — 1914, 1939, 1991, 2014, 2022. Any country on the map, and in 1991 even the Soviet and Yugoslav republics that have no land of their own yet." },
    { title: "Give orders", body: "Write what your government does this turn in plain language, or take moves from the panels — the cabinet, politics, the economy, foreign policy. Up to twelve orders. They are intentions, not guarantees." },
    { title: "End the turn", body: "Choose how long a turn lasts — a week to a year. The game master decides how far each order gets and how the world answers, and a report tells you what happened." },
    { title: "Talk to the world", body: "Write to any government, sit in a session of the UN and speak there yourself, ask your ministers. What you agree on counts when the turn ends." },
    { title: "Read the map", body: "Colour shows who holds a province; hatching marks occupation. Where a war runs through a province, each side's colour covers the towns it holds and the red line is the front. Arrows show the last turn." },
    { title: "Your country, your plan", body: "There are no goals and no victory screen: what to build, whom to fight and how to rule is yours to decide. Lose your land and you govern from exile; overthrown, you play on as the new government." },
  ],
  featuresTitle: "What is in the game",
  features: [
    { title: "Provinces and fronts", body: "About 2,700 provinces with terrain, people, resources and railways. Fronts run through provinces between the towns each side holds." },
    { title: "An economy that keeps its books", body: "GDP, budget, debt, reserves, prices and the army of every country; resources against need; trade, sanctions, and deals for grain, oil, gas or arms offered each turn." },
    { title: "A government of people", body: "Named ministers with their own character answer your questions and report on your directives. Replace them: you choose among candidates." },
    { title: "Politics at home", body: "Parties and a parliament seat by seat, elections, laws that need votes, the street, plots and coups." },
    { title: "The world answers", body: "Letters to any government, alliances and blocs, summits, and sessions of the UN you attend." },
    { title: "Your games", body: "Saves stay in the browser and, if you sign in, in the cloud. Name them, copy them, download them and share them." },
  ],
  dataTitle: "Your data",
  data: [
    "Saves stay in this browser. Sign in with Google and they also sync to your account in Supabase, where only you can read them.",
    "Your ChatGPT connection is stored encrypted on your own computer and is used only to talk to OpenAI. Nothing is billed to anyone but your own plan.",
    "Historical borders come from aourednik/historical-basemaps (GPL-3.0), corrected for each start date; towns from GeoNames (CC BY 4.0); flags from flag-icons (MIT).",
  ],
  authorTitle: "Who makes it",
  authorName: "Artem Okhten",
  authorBio: "Applied Mathematics at Florida Tech, full-stack and machine-learning engineer, founder of Okhten Group LLC. Gulf of Trump is built in the open — ideas, bug reports and pull requests are welcome.",
  contact: "Write to me",
  licenseTitle: "Open source",
  license: "The code is under the MIT License; the map data under GPL-3.0. ChatGPT is a trademark of OpenAI; this project is not affiliated with OpenAI or Pax Historia.",
};

const ru: AboutContent = {
  title: "О проекте",
  intro:
    "Gulf of Trump — бесплатная песочница об альтернативной истории с открытым кодом. Языковая модель в роли ведущего играет за весь остальной мир, а игровой движок следит, чтобы карта, войны, экономика и счета оставались честными. Игра работает на вашем компьютере и на вашей подписке ChatGPT.",
  rulesTitle: "Как играть",
  rules: [
    { title: "Выберите дату и страну", body: "Пять переломных моментов — 1914, 1939, 1991, 2014, 2022. Любая страна на карте, а в 1991-м даже советские и югославские республики, у которых ещё нет своей территории." },
    { title: "Отдавайте приказы", body: "Напишите обычным языком, что делает ваше правительство за ход, или возьмите действия из панелей — кабинет, политика, экономика, внешняя политика. До двенадцати приказов. Это намерения, а не гарантии." },
    { title: "Завершите ход", body: "Выберите длину хода — от недели до года. Ведущий решит, насколько удался каждый приказ и как ответил мир, а отчёт расскажет, что произошло." },
    { title: "Говорите с миром", body: "Пишите любому правительству, участвуйте в сессиях ООН и выступайте сами, советуйтесь с министрами. Договорённости учитываются в конце хода." },
    { title: "Читайте карту", body: "Цвет показывает, кто держит провинцию; штриховка — оккупация. Где война идёт через провинцию, цвет каждой стороны покрывает её города, а красная линия — фронт. Стрелки показывают прошлый ход." },
    { title: "Ваша страна — ваш план", body: "Целей и экрана победы нет: что строить, с кем воевать и как править — решаете вы. Потеряете территорию — будете править из изгнания; свергнут — играете дальше за новую власть." },
  ],
  featuresTitle: "Что есть в игре",
  features: [
    { title: "Провинции и фронты", body: "Около 2700 провинций с ландшафтом, населением, ресурсами и железными дорогами. Фронт проходит через провинции — между городами, которые держит каждая сторона." },
    { title: "Экономика со своими счетами", body: "ВВП, бюджет, долг, резервы, цены и армия каждой страны; ресурсы против потребности; торговля, санкции и сделки — зерно, нефть, газ, оружие — каждый ход." },
    { title: "Правительство из людей", body: "Министры с именами и характером отвечают на вопросы и отчитываются по поручениям. Их можно сменить — вы выбираете из кандидатов." },
    { title: "Внутренняя политика", body: "Партии и парламент по местам, выборы, законы, которым нужны голоса, улица, заговоры и перевороты." },
    { title: "Мир отвечает", body: "Письма любому правительству, союзы и блоки, саммиты и сессии ООН, на которых вы присутствуете." },
    { title: "Ваши партии", body: "Сохранения хранятся в браузере, а если войти — ещё и в облаке. Их можно назвать, скопировать, скачать и передать." },
  ],
  dataTitle: "Ваши данные",
  data: [
    "Сохранения хранятся в этом браузере. Если войти через Google, они ещё и синхронизируются с вашим аккаунтом в Supabase, где их видите только вы.",
    "Подключение к ChatGPT хранится в зашифрованном виде на вашем компьютере и используется только для запросов к OpenAI. Платите только вы — своей подпиской.",
    "Исторические границы — из aourednik/historical-basemaps (GPL-3.0), исправлены под каждую стартовую дату; города — из GeoNames (CC BY 4.0); флаги — из flag-icons (MIT).",
  ],
  authorTitle: "Кто делает",
  authorName: "Артем Охтень",
  authorBio: "Прикладная математика во Florida Tech, full-stack и ML-инженер, основатель Okhten Group LLC. Gulf of Trump делается открыто — идеи, баг-репорты и pull request'ы приветствуются.",
  contact: "Написать мне",
  licenseTitle: "Открытый код",
  license: "Код — под лицензией MIT, данные карты — под GPL-3.0. ChatGPT — товарный знак OpenAI; проект не связан с OpenAI и Pax Historia.",
};

const uk: AboutContent = {
  title: "Про проєкт",
  intro:
    "Gulf of Trump — безкоштовна пісочниця про альтернативну історію з відкритим кодом. Мовна модель у ролі ведучого грає за весь інший світ, а ігровий рушій стежить, щоб мапа, війни, економіка й рахунки лишалися чесними. Гра працює на вашому комп'ютері й на вашій підписці ChatGPT.",
  rulesTitle: "Як грати",
  rules: [
    { title: "Оберіть дату й країну", body: "П'ять переломних моментів — 1914, 1939, 1991, 2014, 2022. Будь-яка країна на мапі, а в 1991-му навіть радянські та югославські республіки, які ще не мають власної території." },
    { title: "Віддавайте накази", body: "Напишіть звичайною мовою, що робить ваш уряд за хід, або візьміть дії з панелей — кабінет, політика, економіка, зовнішня політика. До дванадцяти наказів. Це наміри, а не гарантії." },
    { title: "Завершіть хід", body: "Оберіть тривалість ходу — від тижня до року. Ведучий вирішить, наскільки вдався кожен наказ і як відповів світ, а звіт розповість, що сталося." },
    { title: "Говоріть зі світом", body: "Пишіть будь-якому уряду, беріть участь у сесіях ООН і виступайте самі, радьтеся з міністрами. Домовленості враховуються наприкінці ходу." },
    { title: "Читайте мапу", body: "Колір показує, хто тримає провінцію; штрихування — окупація. Де війна йде через провінцію, колір кожної сторони вкриває її міста, а червона лінія — фронт. Стрілки показують минулий хід." },
    { title: "Ваша країна — ваш план", body: "Цілей та екрана перемоги немає: що будувати, з ким воювати і як правити — вирішуєте ви. Втратите територію — правитимете з вигнання; повалять — граєте далі за нову владу." },
  ],
  featuresTitle: "Що є в грі",
  features: [
    { title: "Провінції та фронти", body: "Близько 2700 провінцій з ландшафтом, населенням, ресурсами й залізницями. Фронт проходить через провінції — між містами, які тримає кожна сторона." },
    { title: "Економіка з власними рахунками", body: "ВВП, бюджет, борг, резерви, ціни й армія кожної країни; ресурси проти потреби; торгівля, санкції та угоди — зерно, нафта, газ, зброя — щоходу." },
    { title: "Уряд із людей", body: "Міністри з іменами й характером відповідають на запитання та звітують за дорученнями. Їх можна змінити — ви обираєте з кандидатів." },
    { title: "Внутрішня політика", body: "Партії й парламент за місцями, вибори, закони, яким потрібні голоси, вулиця, змови й перевороти." },
    { title: "Світ відповідає", body: "Листи будь-якому уряду, союзи й блоки, саміти та сесії ООН, на яких ви присутні." },
    { title: "Ваші партії", body: "Збереження зберігаються в браузері, а якщо увійти — ще й у хмарі. Їх можна назвати, скопіювати, завантажити й передати." },
  ],
  dataTitle: "Ваші дані",
  data: [
    "Збереження зберігаються в цьому браузері. Якщо увійти через Google, вони ще й синхронізуються з вашим акаунтом у Supabase, де їх бачите лише ви.",
    "Підключення до ChatGPT зберігається в зашифрованому вигляді на вашому комп'ютері й використовується лише для запитів до OpenAI. Платите лише ви — своєю підпискою.",
    "Історичні кордони — з aourednik/historical-basemaps (GPL-3.0), виправлені під кожну стартову дату; міста — з GeoNames (CC BY 4.0); прапори — з flag-icons (MIT).",
  ],
  authorTitle: "Хто робить",
  authorName: "Артем Охтень",
  authorBio: "Прикладна математика у Florida Tech, full-stack та ML-інженер, засновник Okhten Group LLC. Gulf of Trump робиться відкрито — ідеї, баг-репорти й pull request'и вітаються.",
  contact: "Написати мені",
  licenseTitle: "Відкритий код",
  license: "Код — під ліцензією MIT, дані мапи — під GPL-3.0. ChatGPT — торговельна марка OpenAI; проєкт не пов'язаний з OpenAI та Pax Historia.",
};

export const ABOUT: Record<Locale, AboutContent> = { en, ru, uk };

export const AUTHOR_LINKS = [
  { label: "GitHub", href: "https://github.com/Darhaal" },
  { label: "okhten.com", href: "https://okhten.com" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/artem-okhten" },
  { label: "Okhten Group", href: "https://okhtengroup.com" },
] as const;

export const AUTHOR_EMAIL = "artem@okhten.com";

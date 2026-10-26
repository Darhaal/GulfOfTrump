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
    { title: "Pick a date and a country", body: "Eight turning points – 1914, 1939, 1950, 1964, 1991, 1999, 2014, 2022. Any country on the map, and in 1991 even the Soviet and Yugoslav republics that have no land of their own yet; in 1964 the Viet Cong, in 1999 the Kosovo Liberation Army." },
    { title: "Give orders", body: "Write what your government does this turn in plain language, or take moves from the panels – the cabinet, politics, the economy, foreign policy. Up to twelve orders. They are intentions, not guarantees." },
    { title: "End the turn", body: "Choose how long a turn lasts – a week to a year. The game master decides how far each order gets and how the world answers, and a report tells you what happened." },
    { title: "Talk to the world", body: "Write to any government, sit in a session of the UN and speak there yourself, ask your ministers. What you agree on counts when the turn ends." },
    { title: "Read the map", body: "Colour shows who holds a province; hatching marks occupation. Where a war runs through a province, each side's colour covers the towns it holds and the red line is the front. Arrows show the last turn." },
    { title: "Your country, your plan", body: "There are no goals and no victory screen: what to build, whom to fight and how to rule is yours to decide. Lose your land and you govern from exile; overthrown, you play on as the new government." },
  ],
  featuresTitle: "What is in the game",
  features: [
    { title: "A map at war", body: "About 2,700 provinces with terrain, people, resources and railways, and cities by size. Fronts run through provinces between the towns each side holds and move every turn; land taken stays with its captor until a peace. Six map modes, and a diplomatic view that colours the world by its side towards any country you pick." },
    { title: "An army counted piece by piece", body: "Rifles, artillery, tanks, aircraft, ships, air defence and drones, each with its technology level, built from the army budget and lost in battle. Soldiers by training – career, trained conscripts, recruits; offensives, plans and losses; enemy divisions only as far as your intelligence sees them." },
    { title: "An economy that keeps its books", body: "GDP, budget, debt, reserves, inflation and jobs for every country, in money of the day. Resources against need with stocks in months, trade cut by blockade and sanctions, deals for grain, oil, gas, metals or arms, and crises when the books go wrong." },
    { title: "Science against history", body: "Seven directions of research – the army, industry, the land, medicine, science itself, communications and the strategic one with rockets and the bomb. Each breakthrough comes ahead of history or behind it, depending on what you put in." },
    { title: "A government of people", body: "Eight ministries led by the real ministers of the day, painted in oil, each with a character, a competence and a loyalty of their own. Ask them, give them directives, plan special operations with them; asked, they draft orders, a budget or a research split for you to apply or not – and they can take offence and resign." },
    { title: "Politics at home", body: "Parties and a parliament seat by seat with sittings and speeches, elections where the regime holds them, laws that need votes, protests, strikes and plotters you can talk to, the tension of the street – and coups." },
    { title: "A world that answers", body: "Letters to any government with the talks kept, wars, pacts and organisations, summits and sessions of the UN you sit in and speak at with your advisers beside you. Other countries pursue aims of their own whether you write to them or not." },
    { title: "A turn and its report", body: "A week to a year a turn, up to twelve orders. The story of the period comes first and the world's news follows; every turn stays in the chronicle, any of them can be shared as a picture, and the whole game replayed as a timelapse. Reports read aloud, orders dictated, and while the turn is written, 512 quotes and the author's tips." },
    { title: "Your games", body: "Saves stay on your computer and, if you sign in, in the cloud. Name them, copy them, and download them as sealed files that open only as they were written. On Windows, from the Microsoft Store or the installer." },
  ],
  dataTitle: "Your data",
  data: [
    "Saves stay in this browser. Sign in with Google and they also sync to your account in Supabase, where only you can read them.",
    "Your ChatGPT connection is stored encrypted on your own computer and is used only to talk to OpenAI. Nothing is billed to anyone but your own plan.",
    "Historical borders come from aourednik/historical-basemaps (GPL-3.0), corrected for each start date; towns from GeoNames (CC BY 4.0); flags from flag-icons (MIT).",
  ],
  authorTitle: "Who makes it",
  authorName: "Artem Okhten",
  authorBio: "Applied Mathematics at Florida Tech, full-stack and machine-learning engineer, founder of Okhten Group LLC. Gulf of Trump is built in the open – ideas, bug reports and pull requests are welcome.",
  contact: "Write to me",
  licenseTitle: "Open source",
  license: "The code is under the GNU AGPL-3.0 (up to version 1.0.5, MIT); the map data under GPL-3.0. The name Gulf of Trump and its logo are the author's trademarks. ChatGPT is a trademark of OpenAI; this project is not affiliated with OpenAI or Pax Historia.",
};

const ru: AboutContent = {
  title: "О проекте",
  intro:
    "Gulf of Trump – бесплатная песочница об альтернативной истории с открытым кодом. Языковая модель в роли ведущего играет за весь остальной мир, а игровой движок следит, чтобы карта, войны, экономика и счета оставались честными. Игра работает на вашем компьютере и на вашей подписке ChatGPT.",
  rulesTitle: "Как играть",
  rules: [
    { title: "Выберите дату и страну", body: "Восемь переломных моментов – 1914, 1939, 1950, 1964, 1991, 1999, 2014, 2022. Любая страна на карте, а в 1991-м даже советские и югославские республики, у которых ещё нет своей территории; в 1964-м – Вьетконг, в 1999-м – Армия освобождения Косова." },
    { title: "Отдавайте приказы", body: "Напишите обычным языком, что делает ваше правительство за ход, или возьмите действия из панелей – кабинет, политика, экономика, внешняя политика. До двенадцати приказов. Это намерения, а не гарантии." },
    { title: "Завершите ход", body: "Выберите длину хода – от недели до года. Ведущий решит, насколько удался каждый приказ и как ответил мир, а отчёт расскажет, что произошло." },
    { title: "Говорите с миром", body: "Пишите любому правительству, участвуйте в сессиях ООН и выступайте сами, советуйтесь с министрами. Договорённости учитываются в конце хода." },
    { title: "Читайте карту", body: "Цвет показывает, кто держит провинцию; штриховка – оккупация. Где война идёт через провинцию, цвет каждой стороны покрывает её города, а красная линия – фронт. Стрелки показывают прошлый ход." },
    { title: "Ваша страна – ваш план", body: "Целей и экрана победы нет: что строить, с кем воевать и как править – решаете вы. Потеряете территорию – будете править из изгнания; свергнут – играете дальше за новую власть." },
  ],
  featuresTitle: "Что есть в игре",
  features: [
    { title: "Карта войны", body: "Около 2700 провинций с ландшафтом, населением, ресурсами и железными дорогами, города по размеру. Фронты проходят через провинции между городами, которые держит каждая сторона, и сдвигаются каждый ход; взятая земля остаётся за захватчиком до мира. Шесть режимов карты и дипломатический вид: весь мир окрашен по отношению к выбранной стране." },
    { title: "Армия поштучно", body: "Винтовки, артиллерия, танки, самолёты, корабли, ПВО и дроны – у каждого вида свой технологический уровень; их строит военный бюджет и уносят бои. Солдаты по подготовке – кадровые, обученные призывники, новобранцы; наступления, планы и потери; дивизии врага видны настолько, насколько видит ваша разведка." },
    { title: "Экономика со своими счетами", body: "ВВП, бюджет, долг, резервы, инфляция и занятость каждой страны – в деньгах своего времени. Ресурсы против потребности и запасы в месяцах, торговля, которую режут блокада и санкции, сделки на зерно, нефть, газ, металлы и оружие, кризисы, когда счета не сходятся." },
    { title: "Наука против истории", body: "Семь направлений исследований – армия, промышленность, сельское хозяйство, медицина, сама наука, связь и стратегическое, с ракетами и бомбой. Каждый прорыв приходит раньше истории или позже – смотря сколько вы вложите." },
    { title: "Правительство из людей", body: "Восемь министерств во главе с настоящими министрами того времени, написанными маслом, – у каждого свой характер, компетентность и верность. Их можно спросить, дать поручение, спланировать с ними спецоперацию; по просьбе они готовят приказы, бюджет или распределение науки, а применять или нет – решаете вы. Они умеют обижаться и уходить в отставку." },
    { title: "Внутренняя политика", body: "Партии и парламент по местам, с заседаниями и речами, выборы там, где режим их проводит, законы, которым нужны голоса, протесты, забастовки и заговорщики, с которыми можно говорить, напряжённость на улице – и перевороты." },
    { title: "Мир отвечает", body: "Письма любому правительству с историей переговоров, войны, пакты и организации, саммиты и сессии ООН, где вы сидите и выступаете, а советники рядом. Другие страны преследуют свои цели, пишете вы им или нет." },
    { title: "Ход и его отчёт", body: "От недели до года за ход, до двенадцати приказов. Сначала приходит рассказ о периоде, следом – новости мира; каждый ход остаётся в хронике, любой можно отправить картинкой, а всю партию – пересмотреть таймлапсом. Отчёты читаются вслух, приказы диктуются, а пока ход пишется – 512 цитат и советы автора." },
    { title: "Ваши партии", body: "Сохранения хранятся на вашем компьютере, а если войти – ещё и в облаке. Их можно назвать, скопировать и скачать запечатанным файлом, который открывается только таким, каким был записан. На Windows – из Microsoft Store или установщиком." },
  ],
  dataTitle: "Ваши данные",
  data: [
    "Сохранения хранятся в этом браузере. Если войти через Google, они ещё и синхронизируются с вашим аккаунтом в Supabase, где их видите только вы.",
    "Подключение к ChatGPT хранится в зашифрованном виде на вашем компьютере и используется только для запросов к OpenAI. Платите только вы – своей подпиской.",
    "Исторические границы – из aourednik/historical-basemaps (GPL-3.0), исправлены под каждую стартовую дату; города – из GeoNames (CC BY 4.0); флаги – из flag-icons (MIT).",
  ],
  authorTitle: "Кто делает",
  authorName: "Артем Охтень",
  authorBio: "Прикладная математика во Florida Tech, full-stack и ML-инженер, основатель Okhten Group LLC. Gulf of Trump делается открыто – идеи, баг-репорты и pull request'ы приветствуются.",
  contact: "Написать мне",
  licenseTitle: "Открытый код",
  license: "Код – под лицензией GNU AGPL-3.0 (до версии 1.0.5 – MIT), данные карты – под GPL-3.0. Название Gulf of Trump и логотип – товарные знаки автора. ChatGPT – товарный знак OpenAI; проект не связан с OpenAI и Pax Historia.",
};

const uk: AboutContent = {
  title: "Про проєкт",
  intro:
    "Gulf of Trump – безкоштовна пісочниця про альтернативну історію з відкритим кодом. Мовна модель у ролі ведучого грає за весь інший світ, а ігровий рушій стежить, щоб мапа, війни, економіка й рахунки лишалися чесними. Гра працює на вашому комп'ютері й на вашій підписці ChatGPT.",
  rulesTitle: "Як грати",
  rules: [
    { title: "Оберіть дату й країну", body: "Вісім переломних моментів – 1914, 1939, 1950, 1964, 1991, 1999, 2014, 2022. Будь-яка країна на мапі, а в 1991-му навіть радянські та югославські республіки, які ще не мають власної території; у 1964-му – В'єтконг, у 1999-му – Армія визволення Косова." },
    { title: "Віддавайте накази", body: "Напишіть звичайною мовою, що робить ваш уряд за хід, або візьміть дії з панелей – кабінет, політика, економіка, зовнішня політика. До дванадцяти наказів. Це наміри, а не гарантії." },
    { title: "Завершіть хід", body: "Оберіть тривалість ходу – від тижня до року. Ведучий вирішить, наскільки вдався кожен наказ і як відповів світ, а звіт розповість, що сталося." },
    { title: "Говоріть зі світом", body: "Пишіть будь-якому уряду, беріть участь у сесіях ООН і виступайте самі, радьтеся з міністрами. Домовленості враховуються наприкінці ходу." },
    { title: "Читайте мапу", body: "Колір показує, хто тримає провінцію; штрихування – окупація. Де війна йде через провінцію, колір кожної сторони вкриває її міста, а червона лінія – фронт. Стрілки показують минулий хід." },
    { title: "Ваша країна – ваш план", body: "Цілей та екрана перемоги немає: що будувати, з ким воювати і як правити – вирішуєте ви. Втратите територію – правитимете з вигнання; повалять – граєте далі за нову владу." },
  ],
  featuresTitle: "Що є в грі",
  features: [
    { title: "Мапа війни", body: "Близько 2700 провінцій з ландшафтом, населенням, ресурсами й залізницями, міста за розміром. Фронти проходять через провінції між містами, які тримає кожна сторона, і зсуваються щоходу; захоплена земля лишається за загарбником до миру. Шість режимів мапи й дипломатичний вигляд: увесь світ забарвлено за ставленням до обраної країни." },
    { title: "Армія поштучно", body: "Гвинтівки, артилерія, танки, літаки, кораблі, ППО й дрони – у кожного виду свій технологічний рівень; їх будує військовий бюджет і забирають бої. Солдати за підготовкою – кадрові, навчені призовники, новобранці; наступи, плани й втрати; дивізії ворога видно настільки, наскільки бачить ваша розвідка." },
    { title: "Економіка з власними рахунками", body: "ВВП, бюджет, борг, резерви, інфляція й зайнятість кожної країни – у грошах свого часу. Ресурси проти потреби й запаси в місяцях, торгівля, яку ріжуть блокада й санкції, угоди на зерно, нафту, газ, метали та зброю, кризи, коли рахунки не сходяться." },
    { title: "Наука проти історії", body: "Сім напрямів досліджень – армія, промисловість, сільське господарство, медицина, сама наука, зв'язок і стратегічний, з ракетами й бомбою. Кожен прорив приходить раніше за історію або пізніше – залежно від того, скільки ви вкладете." },
    { title: "Уряд із людей", body: "Вісім міністерств на чолі зі справжніми міністрами того часу, написаними олією, – у кожного свій характер, компетентність і вірність. Їх можна запитати, дати доручення, спланувати з ними спецоперацію; на прохання вони готують накази, бюджет або розподіл науки, а застосовувати чи ні – вирішуєте ви. Вони вміють ображатися й іти у відставку." },
    { title: "Внутрішня політика", body: "Партії й парламент за місцями, із засіданнями та промовами, вибори там, де режим їх проводить, закони, яким потрібні голоси, протести, страйки й змовники, з якими можна говорити, напруга на вулиці – і перевороти." },
    { title: "Світ відповідає", body: "Листи будь-якому уряду з історією переговорів, війни, пакти й організації, саміти та сесії ООН, де ви сидите й виступаєте, а радники поруч. Інші країни переслідують власні цілі, пишете ви їм чи ні." },
    { title: "Хід і його звіт", body: "Від тижня до року за хід, до дванадцяти наказів. Спершу приходить розповідь про період, слідом – новини світу; кожен хід лишається в хроніці, будь-який можна надіслати картинкою, а всю партію – переглянути таймлапсом. Звіти читаються вголос, накази диктуються, а поки хід пишеться – 512 цитат і поради автора." },
    { title: "Ваші партії", body: "Збереження зберігаються на вашому комп'ютері, а якщо увійти – ще й у хмарі. Їх можна назвати, скопіювати й завантажити запечатаним файлом, який відкривається лише таким, яким був записаний. На Windows – з Microsoft Store або інсталятором." },
  ],
  dataTitle: "Ваші дані",
  data: [
    "Збереження зберігаються в цьому браузері. Якщо увійти через Google, вони ще й синхронізуються з вашим акаунтом у Supabase, де їх бачите лише ви.",
    "Підключення до ChatGPT зберігається в зашифрованому вигляді на вашому комп'ютері й використовується лише для запитів до OpenAI. Платите лише ви – своєю підпискою.",
    "Історичні кордони – з aourednik/historical-basemaps (GPL-3.0), виправлені під кожну стартову дату; міста – з GeoNames (CC BY 4.0); прапори – з flag-icons (MIT).",
  ],
  authorTitle: "Хто робить",
  authorName: "Артем Охтень",
  authorBio: "Прикладна математика у Florida Tech, full-stack та ML-інженер, засновник Okhten Group LLC. Gulf of Trump робиться відкрито – ідеї, баг-репорти й pull request'и вітаються.",
  contact: "Написати мені",
  licenseTitle: "Відкритий код",
  license: "Код – під ліцензією GNU AGPL-3.0 (до версії 1.0.5 – MIT), дані мапи – під GPL-3.0. Назва Gulf of Trump і логотип – торговельні марки автора. ChatGPT – торговельна марка OpenAI; проєкт не пов'язаний з OpenAI та Pax Historia.",
};

export const ABOUT: Record<Locale, AboutContent> = { en, ru, uk };

export const AUTHOR_LINKS = [
  { label: "GitHub", href: "https://github.com/Darhaal" },
  { label: "okhten.com", href: "https://okhten.com" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/artem-okhten" },
  { label: "Okhten Group", href: "https://okhtengroup.com" },
] as const;

export const AUTHOR_EMAIL = "artem@okhten.com";

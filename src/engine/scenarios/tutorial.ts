// The tutorial's words, written in advance (engine/tutorial.ts): what the
// guide suggests, the game master's answers for its first turns – the story,
// the verdicts, the world's news, the front – the ministers' answers and views,
// the replies to letters, and the government it starts with. Every text in the
// three languages, with short dashes. The engine decides what comes of them:
// each answer goes through the same schema and sanitizer as the model's.
import type { AdvisorId } from "../advisors";
import type { EventKind, Localized } from "../types";

/** What the guide offers to write: the first order, a question for the commander, a letter to Poland, and orders to try next. */
export const TUTORIAL_SUGGESTIONS = {
  order: {
    en: "Hold Kyiv: send the reserves and the territorial defence to Hostomel and the northern approaches",
    ru: "Удержать Киев: бросить резервы и терооборону к Гостомелю и на северные подступы",
    uk: "Утримати Київ: кинути резерви й тероборону до Гостомеля та на північні підступи",
  },
  question: {
    en: "Can we hold Kyiv, and what do you need most?",
    ru: "Удержим ли мы Киев и что вам нужнее всего?",
    uk: "Чи втримаємо ми Київ і що вам потрібно найбільше?",
  },
  letter: {
    to: "poland",
    text: {
      en: "Keep your border open to our refugees, and let the weapons our partners send pass through Poland.",
      ru: "Держите границу открытой для наших беженцев и пропускайте через Польшу оружие, которое шлют нам партнёры.",
      uk: "Тримайте кордон відкритим для наших біженців і пропускайте через Польщу зброю, яку надсилають нам партнери.",
    },
  },
  ideas: [
    { en: "Open humanitarian corridors out of Mariupol and Sumy", ru: "Открыть гуманитарные коридоры из Мариуполя и Сум", uk: "Відкрити гуманітарні коридори з Маріуполя та Сум" },
    { en: "Ask the West for more air defence and fighter jets", ru: "Попросить у Запада больше ПВО и истребители", uk: "Попросити в Заходу більше ППО та винищувачі" },
    { en: "Move the factories of the east to the west of the country", ru: "Перевезти заводы с востока на запад страны", uk: "Перевезти заводи зі сходу на захід країни" },
  ],
} satisfies Record<string, unknown>;

/** What an order is about, read from its words in any of the three languages; each kind has its verdict. */
export const ORDER_KINDS = ["surrender", "talks", "attack", "kyiv", "civilians", "allies", "economy", "army", "other"] as const;
export type OrderKind = (typeof ORDER_KINDS)[number];

/** The first kind whose words an order has, in this order: giving up and talking before fighting, Kyiv before the army in general. */
export const ORDER_WORDS: [Exclude<OrderKind, "other">, RegExp][] = [
  ["surrender", /капитул|капітул|сдать|сдаться|сдаём|здати|здатися|surrender|capitulat|give up/i],
  ["talks", /переговор|negotiat|talks|перемири|перемир|ceasefire|прекращени. огня|припиненн. вогню|мирн(ый|ий|ые|і) (договор|план|переговор|угод)|peace/i],
  ["attack", /контрнаступ|контратак|counter|наступлени|наступ |атак|attack|offensive|освобод|звільн|liberat|retake|recapture|отвоева|відвоюва|крым|крим|crimea/i],
  ["kyiv", /ки[еєї]в|kyiv|kiev|столиц|capital|гостомел|hostomel|ирпен|ірпін|irpin|бучу|буча|bucha/i],
  ["civilians", /эвакуа|евакуа|evacu|беженц|біженц|refugee|гуманитар|гуманітар|humanitar|мирн(ое|е) населени|мирних|civilian|коридор|corridor|укрыт|укритт|shelter/i],
  ["allies", /запад|захід|заходу|west|союзн|allies|ally|сша|usa|united states|америк|americ|nato|нато|евросоюз|євросоюз|\beu\b|europ|европ|європ|оружи|зброю|зброя|зброї|weapon|arms|javelin|stinger|санкц|sanction|swift|помощ|допомог|\baid\b|help|польш|польщ|poland|британ|британі|britain|\buk\b|пво|ппо|air defen/i],
  ["economy", /экономик|економік|econom|бюджет|budget|деньг|грош|money|финанс|фінанс|financ|банк|bank|зарплат|salar|налог|подат|\btax|цен[аы]|ціни|price|топлив|пальн|fuel|завод|factor/i],
  ["army", /мобилиз|мобіліз|mobili|арми|армі|army|військ|войск|troops|оборон|defen|терооборон|тероборон|territorial|резерв|reserve|фронт|front|харьков|харків|kharkiv|херсон|kherson|мариупол|маріупол|mariupol|чернигов|чернігів|chernihiv|сум[ыи]|sumy|одесс|одес|odesa|odessa/i],
];

/** A verdict in the three languages: the same for both written turns, or one for each. */
export interface Verdict {
  result: "success" | "partial" | "failed";
  note: Localized | [Localized, Localized];
}

export const VERDICTS: Record<OrderKind, Verdict> = {
  surrender: {
    result: "failed",
    note: {
      en: "No one in the government or the army would carry this out: the country fights on, and the order is quietly set aside.",
      ru: "Никто в правительстве и в армии не стал бы это выполнять: страна сражается, и приказ тихо отложен.",
      uk: "Ніхто в уряді й в армії не став би цього виконувати: країна бореться, і наказ тихо відкладено.",
    },
  },
  talks: {
    result: "partial",
    note: [
      {
        en: "Delegations met on the Belarusian border on 28 February. Moscow's terms amount to surrender, so the talks go on while the fighting does.",
        ru: "Делегации встретились на белорусской границе 28 февраля. Условия Москвы равны капитуляции, поэтому переговоры идут вместе с боями.",
        uk: "Делегації зустрілися на білоруському кордоні 28 лютого. Умови Москви дорівнюють капітуляції, тож переговори тривають разом із боями.",
      },
      {
        en: "A third round on the Belarusian border agreed a few corridors for civilians and nothing more; the foreign ministers met in Antalya without result.",
        ru: "Третий раунд на белорусской границе договорился о нескольких коридорах для мирных жителей, и только; министры иностранных дел встретились в Анталье без результата.",
        uk: "Третій раунд на білоруському кордоні домовився про кілька коридорів для цивільних, і все; міністри закордонних справ зустрілися в Анталії без результату.",
      },
    ],
  },
  attack: {
    result: "failed",
    note: {
      en: "There is no strength to attack yet: every brigade is holding the line, and an offensive now would open a hole in it. The order waits for better days.",
      ru: "Сил для наступления пока нет: каждая бригада держит линию, и наступление сейчас пробило бы в ней дыру. Приказ ждёт лучших дней.",
      uk: "Сил для наступу поки немає: кожна бригада тримає лінію, і наступ зараз пробив би в ній діру. Наказ чекає кращих днів.",
    },
  },
  kyiv: {
    result: "success",
    note: [
      {
        en: "The reserves and the territorial defence reached the northern approaches in time; the runway at Hostomel was shelled until no plane could land, and the columns stopped short of the city.",
        ru: "Резервы и терооборона вовремя вышли на северные подступы; полосу в Гостомеле обстреливали, пока на неё не мог сесть ни один самолёт, и колонны остановились перед городом.",
        uk: "Резерви й тероборона вчасно вийшли на північні підступи; смугу в Гостомелі обстрілювали, доки на неї не міг сісти жоден літак, і колони зупинилися перед містом.",
      },
      {
        en: "The line at Irpin and Moshchun held: the bridge over the Irpin was blown, the columns did not get into the city, and the convoy to the north still stands.",
        ru: "Линия у Ирпеня и Мощуна выдержала: мост через Ирпень взорван, колонны в город не вошли, а колонна к северу так и стоит.",
        uk: "Лінія біля Ірпеня й Мощуна витримала: міст через Ірпінь підірвано, колони в місто не ввійшли, а колона на півночі так і стоїть.",
      },
    ],
  },
  civilians: {
    result: "partial",
    note: [
      {
        en: "Trains carry women and children west day and night, and the metro shelters thousands; but in the towns under fire many cannot get out.",
        ru: "Поезда день и ночь везут женщин и детей на запад, метро укрывает тысячи людей; но из городов под обстрелом многие выбраться не могут.",
        uk: "Потяги вдень і вночі везуть жінок і дітей на захід, метро вкриває тисячі людей; але з міст під обстрілом багато хто вибратися не може.",
      },
      {
        en: "The corridors out of Sumy and Irpin worked; those out of Mariupol were agreed and broken again under shelling.",
        ru: "Коридоры из Сум и Ирпеня сработали; коридоры из Мариуполя согласовывали и снова срывали обстрелами.",
        uk: "Коридори з Сум та Ірпеня спрацювали; коридори з Маріуполя погоджували й знову зривали обстрілами.",
      },
    ],
  },
  allies: {
    result: "success",
    note: [
      {
        en: "The capitals answered faster than expected: Javelins, NLAWs and Stingers come in through Poland, and Russia's largest banks are being cut off from SWIFT.",
        ru: "Столицы ответили быстрее, чем ждали: через Польшу идут Javelin, NLAW и Stinger, а крупнейшие российские банки отключают от SWIFT.",
        uk: "Столиці відповіли швидше, ніж чекали: через Польщу йдуть Javelin, NLAW і Stinger, а найбільші російські банки відключають від SWIFT.",
      },
      {
        en: "More weapons are on their way, and the United States and Britain ban Russian oil; fighter jets and a no-fly zone, though, are refused.",
        ru: "Новое оружие уже в пути, а США и Британия запрещают российскую нефть; но в истребителях и закрытом небе отказано.",
        uk: "Нова зброя вже в дорозі, а США й Британія забороняють російську нафту; але у винищувачах і закритому небі відмовлено.",
      },
    ],
  },
  economy: {
    result: "partial",
    note: {
      en: "The National Bank fixed the hryvnia, and the government keeps paying salaries and pensions from the reserves and the partners' first loans; much of the economy has stopped.",
      ru: "Нацбанк зафиксировал курс гривны, правительство продолжает платить зарплаты и пенсии из резервов и первых кредитов партнёров; но большая часть экономики встала.",
      uk: "Нацбанк зафіксував курс гривні, уряд і далі платить зарплати й пенсії з резервів і перших кредитів партнерів; але більша частина економіки стала.",
    },
  },
  army: {
    result: "partial",
    note: [
      {
        en: "Mobilisation is under way and volunteers queue at the recruiting offices; the reserves went where the line was thinnest, but they cannot be everywhere at once.",
        ru: "Мобилизация идёт, у военкоматов очереди добровольцев; резервы ушли туда, где линия тоньше всего, но везде сразу им не успеть.",
        uk: "Мобілізація триває, біля військкоматів черги добровольців; резерви пішли туди, де лінія найтонша, але всюди одразу їм не встигнути.",
      },
      {
        en: "The army holds on every front but gives ground in the south; the new brigades will not be ready for weeks.",
        ru: "Армия держится на всех фронтах, но на юге отступает; новые бригады будут готовы только через несколько недель.",
        uk: "Армія тримається на всіх фронтах, але на півдні відступає; нові бригади будуть готові лише за кілька тижнів.",
      },
    ],
  },
  other: {
    result: "partial",
    note: {
      en: "The order went out to the ministries in the chaos of the war's first days: part of it was carried out, and the rest waits until the front settles.",
      ru: "Приказ ушёл в министерства в хаосе первых дней войны: часть выполнена, остальное ждёт, пока фронт успокоится.",
      uk: "Наказ пішов до міністерств у хаосі перших днів війни: частину виконано, решта чекає, доки фронт заспокоїться.",
    },
  },
};

/** A province the turn leaves contested: how much of it Russia holds afterwards, and the towns, besides those it held at the start. */
export interface ScriptedFront {
  region: string;
  share: number;
  towns?: string[];
}

/** One written turn: the story, the world's news, the front, the people, the sanctions and the economies. */
export interface ScriptedTurn {
  headline: Localized;
  narrative: Localized;
  events: { title: Localized; body: Localized; kind: EventKind; countries: string[] }[];
  fronts: ScriptedFront[];
  /** Thousands dead and fled from Ukraine. */
  people: { deaths: number; refugees: number; cause: Localized };
  sanctions: { by: string; scope: "partial" | "full" }[];
  economy: { country: string; growth?: number; inflation?: number; troops?: number }[];
}

export const SCRIPTED_TURNS: ScriptedTurn[] = [
  // 24 February – 3 March 2022.
  {
    headline: { en: "Kyiv holds the first week", ru: "Киев выстоял первую неделю", uk: "Київ вистояв перший тиждень" },
    narrative: {
      en: [
        "The war came before dawn. Missiles hit airfields, depots and radar sites from Lviv to Kharkiv, and by noon Russian columns were across the border from Belarus, from Russia and from Crimea. At Hostomel, just north-west of Kyiv, helicopters landed paratroopers on the airfield; the National Guard fought them all day, and by evening Ukrainian artillery had cratered the runway so that no transport plane could land.",
        "In the north the columns from Belarus came through Chernobyl and down the roads to Kyiv, but they jammed into a convoy sixty kilometres long that barely moves. Chernihiv, Sumy and Kharkiv are attacked from several sides and fight in their streets; none of them has fallen. In the south the Russians broke out of Crimea: Melitopol and Berdyansk were taken, and on 2 March Kherson became the first regional centre to fall. Mariupol is being cut off from the west.",
        "The world answered faster than anyone in Kyiv had expected. On 26 February the West agreed to cut Russia's largest banks off from SWIFT and to freeze its central bank's reserves; Germany reversed decades of policy and sends weapons; Javelins, NLAWs and Stingers come in through Poland. On 2 March 141 countries in the UN General Assembly condemned the invasion. A million people have already left Ukraine, most of them women and children.",
      ].join("\n\n"),
      ru: [
        "Война пришла до рассвета. Ракеты ударили по аэродромам, складам и радарам от Львова до Харькова, а к полудню российские колонны перешли границу из Беларуси, из России и из Крыма. В Гостомеле, к северо-западу от Киева, вертолёты высадили десант на аэродром; Нацгвардия билась с ним весь день, а к вечеру украинская артиллерия изрыла полосу так, что ни один транспортный самолёт не мог сесть.",
        "На севере колонны из Беларуси прошли через Чернобыль и двинулись по дорогам на Киев, но сбились в колонну длиной в шестьдесят километров, которая почти не движется. Чернигов, Сумы и Харьков атакуют с нескольких сторон, на их улицах идут бои; ни один из них не пал. На юге русские вырвались из Крыма: взяты Мелитополь и Бердянск, а 2 марта Херсон стал первым павшим областным центром. Мариуполь отрезают с запада.",
        "Мир ответил быстрее, чем кто-либо в Киеве ждал. 26 февраля Запад договорился отключить крупнейшие российские банки от SWIFT и заморозить резервы её центрального банка; Германия отказалась от политики десятилетий и шлёт оружие; через Польшу идут Javelin, NLAW и Stinger. 2 марта 141 страна в Генеральной ассамблее ООН осудила вторжение. Миллион человек уже покинули Украину, большинство – женщины и дети.",
      ].join("\n\n"),
      uk: [
        "Війна прийшла до світанку. Ракети вдарили по аеродромах, складах і радарах від Львова до Харкова, а до полудня російські колони перейшли кордон із Білорусі, з Росії та з Криму. У Гостомелі, на північний захід від Києва, гелікоптери висадили десант на аеродром; Нацгвардія билася з ним увесь день, а до вечора українська артилерія зорала смугу так, що жоден транспортний літак не міг сісти.",
        "На півночі колони з Білорусі пройшли через Чорнобиль і рушили дорогами на Київ, але збилися в колону завдовжки шістдесят кілометрів, яка майже не рухається. Чернігів, Суми й Харків атакують із кількох боків, на їхніх вулицях тривають бої; жоден із них не впав. На півдні росіяни вирвалися з Криму: захоплено Мелітополь і Бердянськ, а 2 березня Херсон став першим обласним центром, що впав. Маріуполь відрізають із заходу.",
        "Світ відповів швидше, ніж будь-хто в Києві чекав. 26 лютого Захід домовився відключити найбільші російські банки від SWIFT і заморозити резерви її центрального банку; Німеччина відмовилася від політики десятиліть і надсилає зброю; через Польщу йдуть Javelin, NLAW і Stinger. 2 березня 141 країна в Генеральній асамблеї ООН засудила вторгнення. Мільйон людей уже покинули Україну, більшість – жінки й діти.",
      ].join("\n\n"),
    },
    events: [
      {
        title: { en: "The battle for Hostomel", ru: "Бой за Гостомель", uk: "Бій за Гостомель" },
        body: {
          en: "Russian paratroopers take the airfield north-west of Kyiv, but the runway is shelled until no transport plane can land.",
          ru: "Российский десант захватывает аэродром к северо-западу от Киева, но полосу обстреливают, пока на неё не может сесть ни один транспортный самолёт.",
          uk: "Російський десант захоплює аеродром на північний захід від Києва, але смугу обстрілюють, доки на неї не може сісти жоден транспортний літак.",
        },
        kind: "military",
        countries: ["ukraine", "russia"],
      },
      {
        title: { en: "Kherson falls", ru: "Херсон пал", uk: "Херсон упав" },
        body: {
          en: "On 2 March Kherson becomes the first regional centre taken by Russia; Melitopol and Berdyansk fell before it.",
          ru: "2 марта Херсон становится первым областным центром, взятым Россией; до него пали Мелитополь и Бердянск.",
          uk: "2 березня Херсон стає першим обласним центром, захопленим Росією; до нього впали Мелітополь і Бердянськ.",
        },
        kind: "military",
        countries: ["russia", "ukraine"],
      },
      {
        title: { en: "Russia's banks cut off from SWIFT", ru: "Российские банки отключают от SWIFT", uk: "Російські банки відключають від SWIFT" },
        body: {
          en: "The United States, the European Union, Britain and Canada cut Russia's largest banks off from SWIFT and freeze the central bank's reserves.",
          ru: "США, Евросоюз, Британия и Канада отключают крупнейшие российские банки от SWIFT и замораживают резервы центрального банка.",
          uk: "США, Євросоюз, Британія та Канада відключають найбільші російські банки від SWIFT і заморожують резерви центрального банку.",
        },
        kind: "economy",
        countries: ["usa", "uk", "germany", "russia"],
      },
      {
        title: { en: "The UN condemns the invasion", ru: "ООН осуждает вторжение", uk: "ООН засуджує вторгнення" },
        body: {
          en: "141 countries in the General Assembly demand that Russia withdraw; five vote against, among them Russia and Belarus.",
          ru: "141 страна в Генеральной ассамблее требует, чтобы Россия вывела войска; против голосуют пятеро, среди них Россия и Беларусь.",
          uk: "141 країна в Генеральній асамблеї вимагає, щоб Росія вивела війська; проти голосують п'ятеро, серед них Росія та Білорусь.",
        },
        kind: "diplomacy",
        countries: ["ukraine", "russia", "belarus"],
      },
    ],
    fronts: [
      { region: "ua-kyiv", share: 12, towns: ["Chernobyl"] },
      { region: "ua-chernihiv", share: 25 },
      { region: "ua-sumy", share: 25, towns: ["Konotop"] },
      { region: "ua-kharkiv", share: 15, towns: ["Vovchansk", "Kupyansk"] },
      { region: "ua-luhansk", share: 48, towns: ["Starobilsk"] },
      { region: "ua-donetsk", share: 36 },
      { region: "ua-zaporizhzhia", share: 35, towns: ["Melitopol", "Berdyansk"] },
      { region: "ua-kherson", share: 75, towns: ["Kherson", "Nova Kakhovka", "Kakhovka", "Oleshky", "Henichesk", "Skadovsk"] },
    ],
    people: { deaths: 3, refugees: 1000, cause: { en: "the invasion", ru: "вторжение", uk: "вторгнення" } },
    sanctions: [
      { by: "usa", scope: "partial" },
      { by: "uk", scope: "partial" },
      { by: "canada", scope: "partial" },
      { by: "germany", scope: "partial" },
      { by: "france", scope: "partial" },
      { by: "japan", scope: "partial" },
    ],
    economy: [
      { country: "ukraine", growth: -30, inflation: 12, troops: 290 },
      { country: "russia", growth: -6, inflation: 15 },
    ],
  },
  // 3 – 10 March 2022.
  {
    headline: { en: "Mariupol under siege, Kyiv still holds", ru: "Мариуполь в осаде, Киев держится", uk: "Маріуполь в облозі, Київ тримається" },
    narrative: {
      en: [
        "The second week was a battle for Kyiv's suburbs. The Russians hold Hostomel and Bucha and are fighting in Irpin, where the bridge over the river was blown to stop them; thousands of people cross the river on planks under fire. North of the capital the long convoy still stands where it stopped, short of fuel and food. Chernihiv is shelled day and night but holds, and so does Kharkiv.",
        "In the south the Russians seized the Zaporizhzhia nuclear plant at Enerhodar on 4 March, after a night battle in which a building on its grounds caught fire. Mariupol is surrounded: its water, power and heating are gone, and the corridors agreed for its people broke down under shelling. In the Donbas Volnovakha fell; Mykolaiv held off the push from Kherson.",
        "Abroad, the pressure on Russia grows: Visa and Mastercard leave the country, the United States and Britain ban Russian oil, and the rouble has lost a third of its value. Talks on the Belarusian border gave a few corridors and nothing more, and on 10 March the foreign ministers met in Antalya without result. Two million people have now fled Ukraine.",
      ].join("\n\n"),
      ru: [
        "Вторая неделя стала битвой за пригороды Киева. Русские держат Гостомель и Бучу и воюют в Ирпене, где мост через реку взорвали, чтобы их остановить; тысячи людей переходят реку по доскам под огнём. К северу от столицы длинная колонна так и стоит там, где встала, без топлива и еды. Чернигов обстреливают день и ночь, но он держится, как и Харьков.",
        "На юге 4 марта русские захватили Запорожскую АЭС в Энергодаре после ночного боя, в котором загорелось здание на её территории. Мариуполь окружён: в нём нет воды, света и тепла, а коридоры для жителей сорваны обстрелами. В Донбассе пала Волноваха; Николаев отбил удар со стороны Херсона.",
        "За рубежом давление на Россию растёт: Visa и Mastercard уходят из страны, США и Британия запрещают российскую нефть, рубль потерял треть стоимости. Переговоры на белорусской границе дали несколько коридоров, и только, а 10 марта министры иностранных дел встретились в Анталье без результата. Из Украины бежали уже два миллиона человек.",
      ].join("\n\n"),
      uk: [
        "Другий тиждень став битвою за передмістя Києва. Росіяни тримають Гостомель і Бучу та воюють в Ірпені, де міст через річку підірвали, щоб їх зупинити; тисячі людей переходять річку по дошках під вогнем. На північ від столиці довга колона так і стоїть там, де стала, без пального й їжі. Чернігів обстрілюють удень і вночі, але він тримається, як і Харків.",
        "На півдні 4 березня росіяни захопили Запорізьку АЕС в Енергодарі після нічного бою, у якому загорілася будівля на її території. Маріуполь оточено: у ньому немає води, світла й тепла, а коридори для мешканців зірвано обстрілами. На Донбасі впала Волноваха; Миколаїв відбив удар з боку Херсона.",
        "За кордоном тиск на Росію зростає: Visa й Mastercard ідуть із країни, США й Британія забороняють російську нафту, рубль утратив третину вартості. Переговори на білоруському кордоні дали кілька коридорів, і все, а 10 березня міністри закордонних справ зустрілися в Анталії без результату. З України втекли вже два мільйони людей.",
      ].join("\n\n"),
    },
    events: [
      {
        title: { en: "Fire at the Zaporizhzhia nuclear plant", ru: "Пожар на Запорожской АЭС", uk: "Пожежа на Запорізькій АЕС" },
        body: {
          en: "Russian troops take Europe's largest nuclear plant at Enerhodar after a night battle; the reactors are unharmed.",
          ru: "Российские войска после ночного боя захватывают крупнейшую в Европе АЭС в Энергодаре; реакторы не пострадали.",
          uk: "Російські війська після нічного бою захоплюють найбільшу в Європі АЕС в Енергодарі; реактори не постраждали.",
        },
        kind: "military",
        countries: ["russia", "ukraine"],
      },
      {
        title: { en: "Mariupol surrounded", ru: "Мариуполь в окружении", uk: "Маріуполь в оточенні" },
        body: {
          en: "The city on the Sea of Azov is cut off, without water, power or heating; the corridors for its people break down under shelling.",
          ru: "Город на Азовском море отрезан, без воды, света и тепла; коридоры для жителей срываются обстрелами.",
          uk: "Місто на Азовському морі відрізане, без води, світла й тепла; коридори для мешканців зриваються обстрілами.",
        },
        kind: "war",
        countries: ["ukraine", "russia"],
      },
      {
        title: { en: "America and Britain ban Russian oil", ru: "Америка и Британия запрещают российскую нефть", uk: "Америка й Британія забороняють російську нафту" },
        body: {
          en: "Washington stops all imports of Russian oil and gas, London phases out its oil by the end of the year; the rouble falls by a third.",
          ru: "Вашингтон прекращает весь импорт российских нефти и газа, Лондон откажется от её нефти до конца года; рубль падает на треть.",
          uk: "Вашингтон припиняє весь імпорт російських нафти й газу, Лондон відмовиться від її нафти до кінця року; рубль падає на третину.",
        },
        kind: "economy",
        countries: ["usa", "uk", "russia"],
      },
      {
        title: { en: "Talks in Antalya", ru: "Переговоры в Анталье", uk: "Переговори в Анталії" },
        body: {
          en: "The Ukrainian and Russian foreign ministers meet in Turkey for the first time since the invasion; they agree on nothing.",
          ru: "Министры иностранных дел Украины и России впервые после вторжения встречаются в Турции и ни о чём не договариваются.",
          uk: "Міністри закордонних справ України та Росії вперше після вторгнення зустрічаються в Туреччині й ні про що не домовляються.",
        },
        kind: "diplomacy",
        countries: ["ukraine", "russia", "turkey"],
      },
    ],
    fronts: [
      { region: "ua-kyiv", share: 20, towns: ["Chernobyl", "Hostomel", "Bucha"] },
      { region: "ua-chernihiv", share: 35 },
      { region: "ua-sumy", share: 30, towns: ["Konotop"] },
      { region: "ua-kharkiv", share: 25, towns: ["Vovchansk", "Kupyansk", "Balakliya"] },
      { region: "ua-luhansk", share: 58, towns: ["Starobilsk", "Svatove"] },
      { region: "ua-donetsk", share: 40, towns: ["Volnovakha"] },
      { region: "ua-zaporizhzhia", share: 58, towns: ["Melitopol", "Berdyansk", "Enerhodar", "Tokmak", "Polohy", "Dniprorudne"] },
      { region: "ua-kherson", share: 90, towns: ["Kherson", "Nova Kakhovka", "Kakhovka", "Oleshky", "Henichesk", "Skadovsk"] },
    ],
    people: { deaths: 3, refugees: 1000, cause: { en: "the invasion", ru: "вторжение", uk: "вторгнення" } },
    sanctions: [
      { by: "usa", scope: "full" },
      { by: "uk", scope: "full" },
    ],
    economy: [
      { country: "ukraine", troops: 330 },
      { country: "russia", inflation: 20 },
    ],
  },
];

/** A minister's answer in the written turns, to whatever they are asked: their portfolio's view of the first days, and an order or two drafted for approval. */
export const MINISTER_ANSWERS: Record<AdvisorId, { answer: Localized; orders?: Localized[] }> = {
  military: {
    answer: {
      en: "We can hold Kyiv, Mr President, if the reserves go north now and the airfield at Hostomel stays useless to them. What I need most is anti-tank weapons and air defence – and time: every day their columns stand on the roads is a day for us. I have drafted an order for you.",
      ru: "Киев мы удержим, господин президент, если резервы пойдут на север сейчас, а аэродром в Гостомеле останется для них бесполезным. Нужнее всего мне противотанковое оружие и ПВО – и время: каждый день, что их колонны стоят на дорогах, работает на нас. Я подготовил для вас приказ.",
      uk: "Київ ми втримаємо, пане президенте, якщо резерви підуть на північ зараз, а аеродром у Гостомелі лишиться для них марним. Найбільше мені потрібні протитанкова зброя й ППО – і час: кожен день, що їхні колони стоять на дорогах, працює на нас. Я підготував для вас наказ.",
    },
    orders: [
      {
        en: "Blow the bridges on the approaches to Kyiv and hold the line of the Irpin river",
        ru: "Взорвать мосты на подступах к Киеву и держать линию по реке Ирпень",
        uk: "Підірвати мости на підступах до Києва й тримати лінію по річці Ірпінь",
      },
    ],
  },
  chief: {
    answer: {
      en: "The President stays in Kyiv, and the world must see it: a video from Bankova tonight will do more than any statement. I am on the phone to Washington, London and Warsaw every hour; they will give more than they would a week ago, if we ask for exact things.",
      ru: "Президент остаётся в Киеве, и мир должен это увидеть: видео с Банковой этой ночью сделает больше любого заявления. Я каждый час на телефоне с Вашингтоном, Лондоном и Варшавой; они дадут больше, чем неделю назад, если просить конкретное.",
      uk: "Президент лишається в Києві, і світ має це побачити: відео з Банкової цієї ночі зробить більше за будь-яку заяву. Я щогодини на телефоні з Вашингтоном, Лондоном і Варшавою; вони дадуть більше, ніж тиждень тому, якщо просити конкретне.",
    },
  },
  foreign: {
    answer: {
      en: "Our embassies work round the clock. The West will give weapons, money and sanctions, but not soldiers and not a no-fly zone – asking for those wastes time. Ask exact capitals for exact things: anti-tank weapons from London, air defence from Warsaw and Washington, sanctions on the banks from Brussels.",
      ru: "Наши посольства работают круглосуточно. Запад даст оружие, деньги и санкции, но не солдат и не закрытое небо – просить об этом значит терять время. Просите у конкретных столиц конкретное: противотанковое оружие у Лондона, ПВО у Варшавы и Вашингтона, санкции против банков у Брюсселя.",
      uk: "Наші посольства працюють цілодобово. Захід дасть зброю, гроші й санкції, але не солдатів і не закрите небо – просити про це означає втрачати час. Просіть у конкретних столиць конкретне: протитанкову зброю в Лондона, ППО у Варшави й Вашингтона, санкції проти банків у Брюсселя.",
    },
  },
  interior: {
    answer: {
      en: "The police and the National Guard keep order in the cities; there is no panic, but the roads west are jammed. We are hunting saboteurs who mark targets for the Russians, and evacuation trains leave Kyiv and Kharkiv every hour.",
      ru: "Полиция и Нацгвардия держат порядок в городах; паники нет, но дороги на запад забиты. Мы ловим диверсантов, которые размечают цели для русских, а эвакуационные поезда уходят из Киева и Харькова каждый час.",
      uk: "Поліція й Нацгвардія тримають порядок у містах; паніки немає, але дороги на захід забиті. Ми ловимо диверсантів, які розмічають цілі для росіян, а евакуаційні потяги йдуть із Києва й Харкова щогодини.",
    },
  },
  intelligence: {
    answer: {
      en: "They expected to be in Kyiv in three days and planned for no resistance. Their supply is already failing and the columns are short of fuel. Watch Hostomel and the road through Ivankiv: if they cannot land there, the attack from the north stalls.",
      ru: "Они рассчитывали быть в Киеве через три дня и сопротивления не планировали. Снабжение у них уже сыплется, колоннам не хватает топлива. Следите за Гостомелем и дорогой через Иванков: если они не смогут там садиться, удар с севера захлебнётся.",
      uk: "Вони розраховували бути в Києві за три дні й опору не планували. Постачання в них уже сиплеться, колонам бракує пального. Стежте за Гостомелем і дорогою через Іванків: якщо вони не зможуть там сідати, удар із півночі захлинеться.",
    },
  },
  finance: {
    answer: {
      en: "The National Bank has fixed the hryvnia and limited cash withdrawals; salaries and pensions will be paid. A quarter of the economy stopped in a week. We need some five billion dollars a month from the partners, and I am asking for it.",
      ru: "Нацбанк зафиксировал гривну и ограничил снятие наличных; зарплаты и пенсии будут выплачены. За неделю встала четверть экономики. Нам нужно около пяти миллиардов долларов в месяц от партнёров, и я их прошу.",
      uk: "Нацбанк зафіксував гривню й обмежив зняття готівки; зарплати й пенсії буде виплачено. За тиждень стала чверть економіки. Нам потрібно близько п'яти мільярдів доларів на місяць від партнерів, і я їх прошу.",
    },
  },
  industry: {
    answer: {
      en: "Factories in the east are moving west where they can, and the railway keeps running – it is our lifeline. Fuel is the problem: they are hitting the depots, and we must buy diesel in Europe at once.",
      ru: "Заводы с востока переезжают на запад, где это возможно, а железная дорога работает – это наша артерия. Проблема – топливо: они бьют по нефтебазам, и дизель надо срочно покупать в Европе.",
      uk: "Заводи зі сходу переїжджають на захід, де це можливо, а залізниця працює – це наша артерія. Проблема – пальне: вони б'ють по нафтобазах, і дизель треба терміново купувати в Європі.",
    },
  },
  science: {
    answer: {
      en: "Starlink terminals are coming in, and the internet holds. The IT army has thousands of volunteers, and the Diia app now lets people report enemy columns. Drones are next: we need many of them, and cheap.",
      ru: "Терминалы Starlink уже приходят, интернет держится. В IT-армии тысячи добровольцев, а приложение «Дия» теперь позволяет сообщать о колоннах врага. Следующее – дроны: их нужно много и дёшево.",
      uk: "Термінали Starlink уже надходять, інтернет тримається. В IT-армії тисячі добровольців, а застосунок «Дія» тепер дає змогу повідомляти про колони ворога. Наступне – дрони: їх потрібно багато й дешево.",
    },
  },
};

/** Each minister's view after a written turn: what their ministry saw of the week. */
export const MINISTER_VIEWS: Record<AdvisorId, Localized> = {
  military: {
    en: "The line held where it mattered: Kyiv is not surrounded and the north is stalled. The south worries me – the steppe is open, and we are giving ground there faster than we can bring up reserves.",
    ru: "Линия выдержала там, где это важнее всего: Киев не окружён, север встал. Меня тревожит юг – степь открыта, и там мы отходим быстрее, чем подтягиваем резервы.",
    uk: "Лінія витримала там, де це найважливіше: Київ не оточено, північ стала. Мене турбує південь – степ відкритий, і там ми відходимо швидше, ніж підтягуємо резерви.",
  },
  chief: {
    en: "The President's videos from Kyiv have done what no note could: the capitals are ashamed to say no. We should ask for more while the mood lasts.",
    ru: "Видео президента из Киева сделали то, чего не сделала бы ни одна нота: столицам стыдно отказывать. Нужно просить больше, пока настроение держится.",
    uk: "Відео президента з Києва зробили те, чого не зробила б жодна нота: столицям соромно відмовляти. Треба просити більше, поки настрій тримається.",
  },
  foreign: {
    en: "The coalition behind us is wider than I hoped a week ago. Sanctions hit Russia's banks; the next fight is over its oil and gas, and Europe will drag its feet.",
    ru: "Коалиция за нами шире, чем я надеялся неделю назад. Санкции бьют по российским банкам; следующий бой – за её нефть и газ, и Европа будет тянуть.",
    uk: "Коаліція за нами ширша, ніж я сподівався тиждень тому. Санкції б'ють по російських банках; наступний бій – за її нафту й газ, і Європа тягнутиме.",
  },
  interior: {
    en: "Order holds in every city we hold. The roads west are full, and the western regions take in hundreds of thousands; we need shelter and food for them.",
    ru: "Порядок держится в каждом городе, который мы удерживаем. Дороги на запад полны, западные области принимают сотни тысяч людей; им нужны кров и еда.",
    uk: "Порядок тримається в кожному місті, яке ми утримуємо. Дороги на захід повні, західні області приймають сотні тисяч людей; їм потрібні дах і їжа.",
  },
  intelligence: {
    en: "Their plan of a quick war has failed, and they know it. Expect them to turn to siege and shelling of the cities, and to look for new forces.",
    ru: "Их план быстрой войны провалился, и они это знают. Ждите, что они перейдут к осадам и обстрелам городов и начнут искать новые силы.",
    uk: "Їхній план швидкої війни провалився, і вони це знають. Чекайте, що вони перейдуть до облог і обстрілів міст і почнуть шукати нові сили.",
  },
  finance: {
    en: "The budget holds for now on the reserves and the first loans. Revenue has fallen by half, and every week of war costs us more than we collect.",
    ru: "Бюджет пока держится на резервах и первых кредитах. Доходы упали вдвое, и каждая неделя войны стоит нам больше, чем мы собираем.",
    uk: "Бюджет поки тримається на резервах і перших кредитах. Доходи впали вдвічі, і кожен тиждень війни коштує нам більше, ніж ми збираємо.",
  },
  industry: {
    en: "The railway runs and the first factories are on the move west. Fuel stays the weak point: two depots burned this week.",
    ru: "Железная дорога работает, первые заводы уже едут на запад. Слабое место – топливо: за неделю сгорели две нефтебазы.",
    uk: "Залізниця працює, перші заводи вже їдуть на захід. Слабке місце – пальне: за тиждень згоріли дві нафтобази.",
  },
  science: {
    en: "The internet and the mobile networks held, and the IT army keeps Russian sites down. Give me money for drones, and I will give you eyes over every road.",
    ru: "Интернет и мобильная связь выдержали, IT-армия держит российские сайты лежащими. Дайте денег на дроны – и я дам вам глаза над каждой дорогой.",
    uk: "Інтернет і мобільний зв'язок витримали, IT-армія тримає російські сайти лежачими. Дайте грошей на дрони – і я дам вам очі над кожною дорогою.",
  },
};

/** Replies to the government's letters in the written turns, by who writes back. */
export const LETTER_REPLIES: Record<"poland" | "friend" | "russia" | "foe" | "neutral", { reply: Localized; stance: "agree" | "refuse" | "counter" | "neutral"; summary: string }> = {
  poland: {
    reply: {
      en: "Poland stands with Ukraine. Our border is open to everyone fleeing the war, without papers if need be, and Rzeszów is already the hub through which the West's weapons reach you. Tell us what you need most, and we will press Berlin and Brussels to give it.",
      ru: "Польша с Украиной. Наша граница открыта для всех, кто бежит от войны, если нужно – без документов, а Жешув уже стал узлом, через который к вам идёт оружие Запада. Скажите, что вам нужнее всего, и мы будем давить на Берлин и Брюссель, чтобы это дали.",
      uk: "Польща з Україною. Наш кордон відкритий для всіх, хто тікає від війни, якщо треба – без документів, а Жешув уже став вузлом, через який до вас іде зброя Заходу. Скажіть, що вам потрібно найбільше, і ми тиснутимемо на Берлін і Брюссель, щоб це дали.",
    },
    stance: "agree",
    summary: "Poland keeps its border open to refugees and lets the West's weapons through.",
  },
  friend: {
    reply: {
      en: "We stand with Ukraine. We have received your message and are acting on it: help in weapons, money and shelter for your people is on its way, and we are pressing our partners to do more. What we cannot do is send our own soldiers.",
      ru: "Мы с Украиной. Ваше послание получено, и мы уже действуем: помощь оружием, деньгами и кровом для ваших людей в пути, и мы убеждаем партнёров сделать больше. Чего мы сделать не можем, так это послать своих солдат.",
      uk: "Ми з Україною. Вашого листа отримано, і ми вже діємо: допомога зброєю, грошима й притулком для ваших людей у дорозі, і ми переконуємо партнерів зробити більше. Чого ми зробити не можемо, то це надіслати своїх солдатів.",
    },
    stance: "agree",
    summary: "A Western government promises weapons, money and shelter, but no troops.",
  },
  russia: {
    reply: {
      en: "Our terms are known: Ukraine's neutrality and demilitarisation, and the recognition of the new realities in Crimea and Donbas. Until they are accepted, the special military operation will continue according to plan.",
      ru: "Наши условия известны: нейтралитет и демилитаризация Украины, признание новых реалий в Крыму и Донбассе. Пока они не приняты, специальная военная операция продолжится по плану.",
      uk: "Наші умови відомі: нейтралітет і демілітаризація України, визнання нових реалій у Криму й на Донбасі. Доки їх не прийнято, спеціальна військова операція триватиме за планом.",
    },
    stance: "refuse",
    summary: "Moscow repeats its terms and refuses to stop the war.",
  },
  foe: {
    reply: {
      en: "Our position has not changed. We call on Kyiv to accept Moscow's terms and to stop a bloodshed for which it alone is responsible.",
      ru: "Наша позиция не изменилась. Мы призываем Киев принять условия Москвы и прекратить кровопролитие, за которое отвечает он один.",
      uk: "Наша позиція не змінилася. Ми закликаємо Київ прийняти умови Москви й припинити кровопролиття, за яке відповідає він один.",
    },
    stance: "refuse",
    summary: "A government on Russia's side refuses and blames Kyiv.",
  },
  neutral: {
    reply: {
      en: "We follow the events with great concern and call on both sides to cease fire and return to talks. Your request will be considered carefully; we are ready to send humanitarian aid.",
      ru: "Мы с большой тревогой следим за событиями и призываем обе стороны прекратить огонь и вернуться к переговорам. Ваша просьба будет внимательно рассмотрена; мы готовы прислать гуманитарную помощь.",
      uk: "Ми з великою тривогою стежимо за подіями й закликаємо обидві сторони припинити вогонь і повернутися до переговорів. Ваше прохання буде уважно розглянуто; ми готові надіслати гуманітарну допомогу.",
    },
    stance: "neutral",
    summary: "A neutral government calls for a ceasefire and offers humanitarian aid.",
  },
};

/** Countries outside NATO and the EU that write back as friends. */
export const FRIENDS = ["japan", "australia", "new-zealand", "south-korea", "switzerland", "moldova", "georgia", "norway", "iceland"];
/** Countries that write back on Moscow's side, besides those at war with Ukraine. */
export const FOES = ["belarus", "north-korea", "syria", "eritrea", "nicaragua"];

// The government the tutorial starts with: Zelenskyy's cabinet and the Verkhovna Rada on the first morning.
const PARTY = {
  servant: { en: "Servant of the People", ru: "Слуга народа", uk: "Слуга народу" },
  solidarity: { en: "European Solidarity", ru: "Европейская солидарность", uk: "Європейська солідарність" },
  batkivshchyna: { en: "Batkivshchyna", ru: "Батькивщина", uk: "Батьківщина" },
  holos: { en: "Holos", ru: "Голос", uk: "Голос" },
  platform: { en: "Platform for Life and Peace", ru: "Платформа за жизнь и мир", uk: "Платформа за життя та мир" },
  future: { en: "For the Future", ru: "За будущее", uk: "За майбутнє" },
  dovira: { en: "Dovira", ru: "Доверие", uk: "Довіра" },
  restoration: { en: "Restoration of Ukraine", ru: "Восстановление Украины", uk: "Відновлення України" },
} satisfies Record<string, Localized>;

export const TUTORIAL_OFFICIALS = {
  officials: [
    {
      post: "head",
      title: { en: "President", ru: "Президент", uk: "Президент" },
      name: { en: "Volodymyr Zelenskyy", ru: "Владимир Зеленский", uk: "Володимир Зеленський" },
      traits: [
        { en: "steadfast", ru: "стойкий", uk: "стійкий" },
        { en: "a born communicator", ru: "прирождённый оратор", uk: "природжений промовець" },
        { en: "stayed in Kyiv", ru: "остался в Киеве", uk: "лишився в Києві" },
      ],
      manner: { en: "direct, warm, sharp when crossed", ru: "прямо, тепло, резко, когда перечат", uk: "прямо, тепло, різко, коли йому суперечать" },
      competence: 4,
      loyalty: 5,
      faction: PARTY.servant,
    },
    {
      post: "government",
      title: { en: "Prime Minister", ru: "Премьер-министр", uk: "Прем'єр-міністр" },
      name: { en: "Denys Shmyhal", ru: "Денис Шмыгаль", uk: "Денис Шмигаль" },
      traits: [
        { en: "manager", ru: "управленец", uk: "управлінець" },
        { en: "loyal", ru: "лоялен", uk: "лояльний" },
      ],
      manner: { en: "calm, figures first", ru: "спокойно, сначала цифры", uk: "спокійно, спершу цифри" },
      competence: 3,
      loyalty: 5,
    },
    {
      post: "chief",
      title: { en: "Head of the Office of the President", ru: "Руководитель Офиса президента", uk: "Керівник Офісу Президента" },
      name: { en: "Andrii Yermak", ru: "Андрей Ермак", uk: "Андрій Єрмак" },
      traits: [
        { en: "gatekeeper", ru: "привратник", uk: "воротар" },
        { en: "negotiator", ru: "переговорщик", uk: "переговірник" },
        { en: "ambitious", ru: "честолюбив", uk: "амбітний" },
      ],
      manner: { en: "smooth, guarded, always on the phone", ru: "гладко, осторожно, всегда на телефоне", uk: "гладко, обережно, завжди на телефоні" },
      competence: 4,
      loyalty: 5,
    },
    {
      post: "military",
      title: { en: "Commander-in-Chief of the Armed Forces", ru: "Главнокомандующий ВСУ", uk: "Головнокомандувач ЗСУ" },
      name: { en: "Valerii Zaluzhnyi", ru: "Валерий Залужный", uk: "Валерій Залужний" },
      traits: [
        { en: "modern-minded", ru: "мыслит по-новому", uk: "мислить по-новому" },
        { en: "trusted by the troops", ru: "пользуется доверием войск", uk: "має довіру війська" },
        { en: "plain-spoken", ru: "говорит прямо", uk: "каже прямо" },
      ],
      manner: { en: "blunt, in numbers and kilometres", ru: "прямо, цифрами и километрами", uk: "прямо, цифрами й кілометрами" },
      competence: 5,
      loyalty: 4,
    },
    {
      post: "finance",
      title: { en: "Minister of Finance", ru: "Министр финансов", uk: "Міністр фінансів" },
      name: { en: "Serhii Marchenko", ru: "Сергей Марченко", uk: "Сергій Марченко" },
      traits: [
        { en: "careful", ru: "осторожен", uk: "обережний" },
        { en: "counts on the partners", ru: "считает на партнёров", uk: "розраховує на партнерів" },
      ],
      manner: { en: "dry and exact", ru: "сухо и точно", uk: "сухо й точно" },
      competence: 4,
      loyalty: 4,
    },
    {
      post: "industry",
      title: { en: "First Deputy Prime Minister and Minister of Economy", ru: "Первый вице-премьер, министр экономики", uk: "Перша віцепрем'єр-міністерка, міністерка економіки" },
      name: { en: "Yulia Svyrydenko", ru: "Юлия Свириденко", uk: "Юлія Свириденко" },
      traits: [
        { en: "hard-working", ru: "трудоголик", uk: "трудоголічка" },
        { en: "trade negotiator", ru: "торговый переговорщик", uk: "торговельна переговірниця" },
      ],
      manner: { en: "brisk and practical", ru: "быстро и практично", uk: "швидко й практично" },
      competence: 4,
      loyalty: 4,
      gender: "female",
    },
    {
      post: "foreign",
      title: { en: "Minister of Foreign Affairs", ru: "Министр иностранных дел", uk: "Міністр закордонних справ" },
      name: { en: "Dmytro Kuleba", ru: "Дмитрий Кулеба", uk: "Дмитро Кулеба" },
      traits: [
        { en: "eloquent", ru: "красноречив", uk: "красномовний" },
        { en: "tireless", ru: "неутомим", uk: "невтомний" },
        { en: "presses the allies", ru: "давит на союзников", uk: "тисне на союзників" },
      ],
      manner: { en: "polished, ironic, insistent", ru: "лощёно, иронично, настойчиво", uk: "вишукано, іронічно, наполегливо" },
      competence: 5,
      loyalty: 5,
    },
    {
      post: "interior",
      title: { en: "Minister of Internal Affairs", ru: "Министр внутренних дел", uk: "Міністр внутрішніх справ" },
      name: { en: "Denys Monastyrskyi", ru: "Денис Монастырский", uk: "Денис Монастирський" },
      traits: [
        { en: "lawyer", ru: "юрист", uk: "юрист" },
        { en: "steady", ru: "надёжен", uk: "надійний" },
      ],
      manner: { en: "measured", ru: "размеренно", uk: "розмірено" },
      competence: 3,
      loyalty: 5,
    },
    {
      post: "intelligence",
      title: { en: "Chief of Defence Intelligence", ru: "Начальник Главного управления разведки", uk: "Начальник Головного управління розвідки" },
      name: { en: "Kyrylo Budanov", ru: "Кирилл Буданов", uk: "Кирило Буданов" },
      traits: [
        { en: "daring", ru: "дерзок", uk: "зухвалий" },
        { en: "secretive", ru: "скрытен", uk: "потайний" },
        { en: "likes to predict", ru: "любит предсказания", uk: "любить пророкувати" },
      ],
      manner: { en: "terse and enigmatic", ru: "кратко и загадочно", uk: "стисло й загадково" },
      competence: 4,
      loyalty: 4,
    },
    {
      post: "science",
      title: { en: "Deputy Prime Minister for Digital Transformation", ru: "Вице-премьер по цифровой трансформации", uk: "Віцепрем'єр-міністр з цифрової трансформації" },
      name: { en: "Mykhailo Fedorov", ru: "Михаил Фёдоров", uk: "Михайло Федоров" },
      traits: [
        { en: "young", ru: "молод", uk: "молодий" },
        { en: "army of drones", ru: "армия дронов", uk: "армія дронів" },
        { en: "Starlink", ru: "Starlink", uk: "Starlink" },
      ],
      manner: { en: "fast, in apps and numbers", ru: "быстро, приложениями и цифрами", uk: "швидко, застосунками й цифрами" },
      competence: 4,
      loyalty: 5,
    },
    {
      post: "bank",
      title: { en: "Governor of the National Bank", ru: "Председатель Национального банка", uk: "Голова Національного банку" },
      name: { en: "Kyrylo Shevchenko", ru: "Кирилл Шевченко", uk: "Кирило Шевченко" },
      traits: [{ en: "banker", ru: "банкир", uk: "банкір" }],
      manner: { en: "cautious", ru: "осторожно", uk: "обережно" },
      competence: 3,
      loyalty: 3,
    },
  ],
};

export const TUTORIAL_POLITICS = {
  regime: { en: "Semi-presidential republic under martial law", ru: "Парламентско-президентская республика при военном положении", uk: "Парламентсько-президентська республіка у воєнному стані" },
  unrest: 12,
  loyalty: { army: 92, police: 88, security: 86, elites: 78 },
  laws: { conscription: "universal", martial: "martial", press: "restricted", assembly: "permit", elections: "suspended", economy: "market", language: "single", alignment: "nonbloc", deathPenalty: "abolished", exit: "permit" },
  parliament: { name: { en: "Verkhovna Rada", ru: "Верховная рада", uk: "Верховна Рада" }, seats: 450, threshold: 5 },
  parties: [
    {
      name: PARTY.servant,
      short: { en: "SN", ru: "СН", uk: "СН" },
      leader: { en: "David Arakhamia", ru: "Давид Арахамия", uk: "Давид Арахамія" },
      ideology: { en: "The President's party: a centrist, pro-European majority", ru: "Партия президента: центристское проевропейское большинство", uk: "Партія президента: центристська проєвропейська більшість" },
      support: 52,
      status: "ruling",
      stance: { economy: 2, freedom: 4, nation: 5 },
      seats: 236,
      color: "#3a9a5b",
    },
    {
      name: PARTY.solidarity,
      short: { en: "ES", ru: "ЕС", uk: "ЄС" },
      leader: { en: "Petro Poroshenko", ru: "Пётр Порошенко", uk: "Петро Порошенко" },
      ideology: { en: "Army, language, faith: the national right-centre", ru: "Армия, язык, вера: национальный правый центр", uk: "Армія, мова, віра: національний правий центр" },
      support: 14,
      status: "opposition",
      stance: { economy: 3, freedom: 5, nation: 8 },
      seats: 27,
      color: "#b03a48",
    },
    {
      name: PARTY.batkivshchyna,
      short: { en: "BAT", ru: "БАТ", uk: "БАТ" },
      leader: { en: "Yulia Tymoshenko", ru: "Юлия Тимошенко", uk: "Юлія Тимошенко" },
      ideology: { en: "Populist centre-left: cheap gas, social spending", ru: "Популистский левый центр: дешёвый газ, социальные расходы", uk: "Популістський лівий центр: дешевий газ, соціальні видатки" },
      support: 9,
      status: "opposition",
      stance: { economy: -3, freedom: 3, nation: 6 },
      seats: 24,
      color: "#d9534f",
    },
    {
      name: PARTY.holos,
      short: { en: "HOL", ru: "ГОЛ", uk: "ГОЛ" },
      leader: { en: "Kira Rudyk", ru: "Кира Рудык", uk: "Кіра Рудик" },
      ideology: { en: "Liberal reformers: open tenders, the rule of law", ru: "Либеральные реформаторы: открытые тендеры, верховенство права", uk: "Ліберальні реформатори: відкриті тендери, верховенство права" },
      support: 5,
      status: "opposition",
      stance: { economy: 5, freedom: 7, nation: 6 },
      seats: 20,
      color: "#e8a33a",
    },
    {
      name: PARTY.platform,
      short: { en: "PLP", ru: "ПЖМ", uk: "ПЖМ" },
      leader: { en: "Yuriy Boyko", ru: "Юрий Бойко", uk: "Юрій Бойко" },
      ideology: { en: "The former opposition of the east, against the war's costs", ru: "Бывшая оппозиция востока, против цены войны", uk: "Колишня опозиція сходу, проти ціни війни" },
      support: 4,
      status: "opposition",
      stance: { economy: -4, freedom: 0, nation: -3 },
      seats: 25,
      color: "#4a72b8",
    },
    {
      name: PARTY.future,
      short: { en: "FF", ru: "ЗБ", uk: "ЗМ" },
      ideology: { en: "A deputies' group of regional businessmen, voting with the majority", ru: "Депутатская группа региональных бизнесменов, голосует с большинством", uk: "Депутатська група регіональних бізнесменів, голосує з більшістю" },
      support: 2,
      status: "coalition",
      stance: { economy: 4, freedom: 2, nation: 3 },
      seats: 21,
      color: "#8a6db5",
    },
    {
      name: PARTY.dovira,
      short: { en: "DOV", ru: "ДОВ", uk: "ДОВ" },
      ideology: { en: "A deputies' group of majoritarian members from the regions", ru: "Депутатская группа мажоритарщиков из регионов", uk: "Депутатська група мажоритарників із регіонів" },
      support: 1,
      status: "coalition",
      stance: { economy: 3, freedom: 2, nation: 2 },
      seats: 25,
      color: "#5aa6a0",
    },
    {
      name: PARTY.restoration,
      short: { en: "RoU", ru: "ВУ", uk: "ВУ" },
      ideology: { en: "A group of former Opposition Platform members", ru: "Группа бывших членов «Оппозиционной платформы»", uk: "Група колишніх членів «Опозиційної платформи»" },
      support: 1,
      status: "opposition",
      stance: { economy: -3, freedom: 0, nation: -2 },
      seats: 17,
      color: "#7f8fa6",
    },
  ],
  plots: [
    {
      title: { en: "Russian agents in the security services", ru: "Российская агентура в спецслужбах", uk: "Російська агентура в спецслужбах" },
      by: { en: "Russia's FSB", ru: "ФСБ России", uk: "ФСБ Росії" },
      kind: "sabotage",
      strength: 25,
      known: true,
    },
  ],
};

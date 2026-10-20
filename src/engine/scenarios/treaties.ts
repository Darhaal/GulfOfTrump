import type { AllianceSeed, Localized } from "../types";

/**
 * The treaties and organisations of each start date beyond the great
 * alliances: what each one says, in a sentence or two, so the player and
 * the game master can read what binds whom — the Budapest Memorandum, the
 * Kharkiv Pact, Montreux, the arms treaties, the clubs of the rich and the
 * regional bodies. Terms for the blocs a scenario already has go in by id.
 */

const L = (en: string, ru: string, uk: string): Localized => ({ en, ru, uk });

/** The scenario's blocs with their terms, then the treaties of the day it lacks. */
export function withTreaties(blocs: AllianceSeed[], terms: Record<string, Localized>, extra: AllianceSeed[]): AllianceSeed[] {
  return [...blocs.map((b) => (terms[b.id] && !b.terms ? { ...b, terms: terms[b.id] } : b)), ...extra.filter((e) => !blocs.some((b) => b.id === e.id))];
}

// ---- shared membership lists

const OSCE_MODERN = [
  "albania", "andorra", "armenia", "austria", "azerbaijan", "belarus", "belgium", "bosnia-and-herzegovina", "bulgaria", "canada", "croatia",
  "cyprus", "czechia", "denmark", "estonia", "finland", "france", "georgia", "germany", "greece", "hungary", "iceland", "ireland", "italy",
  "kazakhstan", "kyrgyzstan", "latvia", "liechtenstein", "lithuania", "luxembourg", "malta", "moldova", "mongolia", "montenegro", "netherlands",
  "north-macedonia", "norway", "poland", "portugal", "romania", "russia", "serbia", "slovakia", "slovenia", "spain", "sweden", "switzerland",
  "tajikistan", "turkey", "turkmenistan", "ukraine", "uk", "usa", "uzbekistan",
];
const COE_MODERN = [
  "albania", "andorra", "armenia", "austria", "azerbaijan", "belgium", "bosnia-and-herzegovina", "bulgaria", "croatia", "cyprus", "czechia",
  "denmark", "estonia", "finland", "france", "georgia", "germany", "greece", "hungary", "iceland", "ireland", "italy", "latvia", "liechtenstein",
  "lithuania", "luxembourg", "malta", "moldova", "montenegro", "netherlands", "north-macedonia", "norway", "poland", "portugal", "romania",
  "russia", "serbia", "slovakia", "slovenia", "spain", "sweden", "switzerland", "turkey", "ukraine", "uk",
];
const AFRICA_MODERN = [
  "algeria", "angola", "benin", "botswana", "burkina-faso", "burundi", "cameroon", "central-african-republic", "chad", "congo", "djibouti",
  "dr-congo", "egypt", "equatorial-guinea", "eritrea", "eswatini", "ethiopia", "gabon", "gambia", "ghana", "guinea", "guinea-bissau",
  "ivory-coast", "kenya", "lesotho", "liberia", "libya", "madagascar", "malawi", "mali", "mauritania", "mozambique", "namibia", "niger",
  "nigeria", "rwanda", "senegal", "sierra-leone", "somalia", "south-africa", "south-sudan", "sudan", "tanzania", "togo", "tunisia", "uganda",
  "zambia", "zimbabwe",
];
const ARAB_LEAGUE = [
  "algeria", "djibouti", "egypt", "iraq", "jordan", "kuwait", "lebanon", "libya", "mauritania", "morocco", "oman", "qatar", "saudi-arabia",
  "somalia", "sudan", "syria", "tunisia", "united-arab-emirates", "yemen",
];
const GCC = ["saudi-arabia", "kuwait", "qatar", "united-arab-emirates", "oman"];
const G20_REST = ["argentina", "australia", "brazil", "china", "india", "indonesia", "mexico", "russia", "saudi-arabia", "south-africa", "south-korea", "turkey"];
const G7 = ["usa", "uk", "france", "germany", "italy", "canada", "japan"];

// ---- treaties that read the same on several dates

const un = L(
  "The Charter of 1945: sovereign equality and no force against another state's territory. Only the Security Council — the US, Russia, China, Britain and France hold vetoes — can order sanctions or force.",
  "Устав 1945 года: суверенное равенство и запрет силы против территории другого государства. Только Совет Безопасности — с правом вето у США, России, Китая, Великобритании и Франции — может ввести обязательные санкции или применить силу.",
  "Статут 1945 року: суверенна рівність і заборона сили проти території іншої держави. Лише Рада Безпеки — з правом вето у США, Росії, Китаю, Великої Британії та Франції — може запровадити обов'язкові санкції чи застосувати силу.",
);

const montreuxModern: AllianceSeed = {
  id: "montreux",
  kind: "pact",
  name: L("Montreux Convention", "Конвенция Монтрё", "Конвенція Монтре"),
  members: ["turkey", "uk", "france", "russia", "bulgaria", "romania", "greece", "japan", "australia"],
  since: "1936-07-20",
  terms: L(
    "Turkey controls the Bosporus and the Dardanelles. Merchant ships pass freely; warships of powers outside the Black Sea are limited in size and may stay 21 days. In war Turkey may close the straits to the warships of the warring sides.",
    "Турция контролирует Босфор и Дарданеллы. Торговые суда проходят свободно; военные корабли нечерноморских держав ограничены тоннажем и сроком в 21 день. Во время войны Турция может закрыть проливы для военных кораблей воюющих сторон.",
    "Туреччина контролює Босфор і Дарданелли. Торговельні судна проходять вільно; військові кораблі нечорноморських держав обмежені тоннажем і строком у 21 день. Під час війни Туреччина може закрити протоки для військових кораблів сторін, що воюють.",
  ),
};

const budapest: AllianceSeed = {
  id: "budapest-memorandum",
  kind: "pact",
  name: L("Budapest Memorandum", "Будапештский меморандум", "Будапештський меморандум"),
  members: ["ukraine", "usa", "uk", "russia"],
  since: "1994-12-05",
  terms: L(
    "Ukraine gave up the world's third-largest nuclear arsenal. The US, Britain and Russia undertook to respect its independence and borders and never to threaten or use force against it — assurances, not a promise to defend it.",
    "Украина отказалась от третьего по величине ядерного арсенала в мире. США, Великобритания и Россия обязались уважать её независимость и границы и никогда не угрожать ей силой и не применять её — это заверения, а не обязательство защищать.",
    "Україна відмовилася від третього за розміром ядерного арсеналу у світі. США, Велика Британія та Росія зобов'язалися поважати її незалежність і кордони й ніколи не погрожувати їй силою та не застосовувати її — це запевнення, а не зобов'язання захищати.",
  ),
};

const usKorea = (troops: string): AllianceSeed => ({
  id: "us-korea",
  name: L("US–South Korea Mutual Defense Treaty", "Договор о взаимной обороне США и Южной Кореи", "Договір про взаємну оборону США та Південної Кореї"),
  members: ["usa", "south-korea"],
  since: "1953-10-01",
  terms: L(
    `Mutual defence since the Korean War; about ${troops} American troops stay in the South.`,
    `Взаимная оборона со времён Корейской войны; на Юге стоят около ${troops.replace(",", " ")} американских военных.`,
    `Взаємна оборона з часів Корейської війни; на Півдні стоять близько ${troops.replace(",", " ")} американських військових.`,
  ),
});

const usJapan = (troops: string): AllianceSeed => ({
  id: "us-japan",
  name: L("US–Japan Security Treaty", "Американо-японский договор о безопасности", "Американо-японський договір про безпеку"),
  members: ["usa", "japan"],
  since: "1960-06-23",
  terms: L(
    `Article 5: the US defends the territories under Japan's administration; about ${troops} American troops are based in Japan.`,
    `Статья 5: США защищают территории под управлением Японии; в Японии размещено около ${troops.replace(",", " ")} американских военных.`,
    `Стаття 5: США захищають території під управлінням Японії; в Японії розміщено близько ${troops.replace(",", " ")} американських військових.`,
  ),
});

const chinaDprk: AllianceSeed = {
  id: "china-dprk",
  name: L("Sino-North Korean Treaty of Friendship", "Китайско-корейский договор о дружбе", "Китайсько-корейський договір про дружбу"),
  members: ["china", "north-korea"],
  since: "1961-07-11",
  terms: L(
    "Article 2: if one is attacked, the other gives immediate military aid. China's only formal alliance.",
    "Статья 2: если на одну сторону нападут, другая немедленно окажет военную помощь. Единственный формальный союз Китая.",
    "Стаття 2: якщо на одну сторону нападуть, інша негайно надасть військову допомогу. Єдиний формальний союз Китаю.",
  ),
};

const anzus: AllianceSeed = {
  id: "anzus",
  name: L("ANZUS", "АНЗЮС", "АНЗЮС"),
  members: ["usa", "australia", "new-zealand"],
  since: "1952-04-29",
  terms: L(
    "Australia, New Zealand and the US act together against a common danger in the Pacific. The US suspended its obligations to New Zealand in 1986 over its ban on nuclear ships.",
    "Австралия, Новая Зеландия и США действуют вместе против общей опасности на Тихом океане. В 1986 году США приостановили обязательства перед Новой Зеландией из-за её запрета на заход атомных кораблей.",
    "Австралія, Нова Зеландія та США діють разом проти спільної небезпеки на Тихому океані. 1986 року США призупинили зобов'язання перед Новою Зеландією через її заборону на захід атомних кораблів.",
  ),
};

const guam: AllianceSeed = {
  id: "guam",
  kind: "organization",
  name: L("GUAM", "ГУАМ", "ГУАМ"),
  members: ["georgia", "ukraine", "azerbaijan", "moldova"],
  since: "1997-10-10",
  terms: L(
    "Georgia, Ukraine, Azerbaijan and Moldova — the post-Soviet states outside Moscow's blocs — on transit, energy and their unresolved conflicts.",
    "Грузия, Украина, Азербайджан и Молдова — постсоветские государства вне блоков Москвы — о транзите, энергетике и неурегулированных конфликтах.",
    "Грузія, Україна, Азербайджан і Молдова — пострадянські держави поза блоками Москви — про транзит, енергетику та неврегульовані конфлікти.",
  ),
};

const coe = (members: string[], terms: Localized): AllianceSeed => ({ id: "coe", kind: "organization", name: L("Council of Europe", "Совет Европы", "Рада Європи"), members, since: "1949-05-05", terms });
const brics: AllianceSeed = {
  id: "brics",
  kind: "organization",
  name: L("BRICS", "БРИКС", "БРІКС"),
  members: ["brazil", "russia", "india", "china", "south-africa"],
  since: "2009-06-16",
  terms: L(
    "A club of the largest emerging economies: yearly summits and its own New Development Bank. No binding obligations; its members rarely join Western sanctions.",
    "Клуб крупнейших развивающихся экономик: ежегодные саммиты и собственный Новый банк развития. Обязательств нет; к западным санкциям его члены, как правило, не присоединяются.",
    "Клуб найбільших економік, що розвиваються: щорічні саміти й власний Новий банк розвитку. Зобов'язань немає; до західних санкцій його члени, як правило, не приєднуються.",
  ),
};
const arabLeague = (members: string[], terms: Localized): AllianceSeed => ({ id: "arab-league", kind: "organization", name: L("Arab League", "Лига арабских государств", "Ліга арабських держав"), members, since: "1945-03-22", terms });
const gcc = (terms: Localized): AllianceSeed => ({
  id: "gcc",
  kind: "organization",
  name: L("Gulf Cooperation Council", "Совет сотрудничества арабских государств Персидского залива", "Рада співробітництва арабських держав Перської затоки"),
  members: GCC,
  since: "1981-05-25",
  terms,
});
const asean = (members: string[], terms: Localized): AllianceSeed => ({ id: "asean", kind: "organization", name: L("ASEAN", "АСЕАН", "АСЕАН"), members, since: "1967-08-08", terms });
const mercosur = (members: string[], terms: Localized): AllianceSeed => ({ id: "mercosur", kind: "trade", name: L("Mercosur", "МЕРКОСУР", "МЕРКОСУР"), members, since: "1991-03-26", terms });
const inf = (members: string[], terms: Localized): AllianceSeed => ({
  id: "inf",
  kind: "pact",
  name: L("INF Treaty", "Договор о ракетах средней и меньшей дальности", "Договір про ракети середньої та меншої дальності"),
  members,
  since: "1988-06-01",
  terms,
});
const sco = (members: string[], terms: Localized): AllianceSeed => ({
  id: "sco",
  kind: "organization",
  name: L("Shanghai Cooperation Organisation", "Шанхайская организация сотрудничества", "Шанхайська організація співробітництва"),
  members,
  since: "2001-06-15",
  terms,
});
const cis = (members: string[], terms: Localized): AllianceSeed => ({
  id: "cis",
  kind: "organization",
  name: L("Commonwealth of Independent States", "Содружество Независимых Государств", "Співдружність Незалежних Держав"),
  members,
  since: "1991-12-08",
  terms,
});
const osce = (terms: Localized): AllianceSeed => ({ id: "osce", kind: "organization", name: L("OSCE", "ОБСЕ", "ОБСЄ"), members: OSCE_MODERN, since: "1975-08-01", terms });
const opec = (members: string[], terms: Localized): AllianceSeed => ({ id: "opec", kind: "trade", name: L("OPEC", "ОПЕК", "ОПЕК"), members, since: "1960-09-14", terms });
const g20 = (terms: Localized): AllianceSeed => ({ id: "g20", kind: "organization", name: L("G20", "Большая двадцатка", "Велика двадцятка"), members: [...G7, ...G20_REST], since: "1999-09-26", terms });
const russiaChina = (extra: Localized): AllianceSeed => ({
  id: "russia-china",
  kind: "pact",
  name: L("Sino-Russian Treaty of Friendship", "Российско-китайский договор о добрососедстве", "Російсько-китайський договір про добросусідство"),
  members: ["russia", "china"],
  since: "2001-07-16",
  terms: L(
    `Good-neighbourliness and consultations when either is threatened, but no duty to fight for each other.${extra.en}`,
    `Добрососедство и консультации при угрозе одной из сторон, но без обязательства воевать друг за друга.${extra.ru}`,
    `Добросусідство й консультації в разі загрози одній зі сторін, але без зобов'язання воювати одне за одного.${extra.uk}`,
  ),
});
const angloPortuguese = (extra: Localized): AllianceSeed => ({
  id: "anglo-portuguese",
  name: L("Anglo-Portuguese Alliance", "Англо-португальский союз", "Англо-португальський союз"),
  members: ["uk", "portugal"],
  since: "1386-05-09",
  terms: L(
    `The oldest alliance in the world, from the Treaty of Windsor (1386), renewed over the centuries: each defends the other.${extra.en}`,
    `Старейший союз в мире, от Виндзорского договора (1386), подтверждаемый веками: каждая сторона защищает другую.${extra.ru}`,
    `Найстаріший союз у світі, від Віндзорського договору (1386), що підтверджується століттями: кожна сторона захищає іншу.${extra.uk}`,
  ),
});
const NONE = L("", "", "");

// ---- 24 February 2022

export const TERMS_2022: Record<string, Localized> = {
  un,
  nato: L(
    "Article 5: an armed attack on one member in Europe or North America is an attack on all. Since Bucharest (2008) Ukraine and Georgia are promised membership, with no date. Allied battlegroups stand in the Baltic states and Poland.",
    "Статья 5: вооружённое нападение на одного члена в Европе или Северной Америке — нападение на всех. С Бухареста (2008) Украине и Грузии обещано членство без срока. В Прибалтике и Польше стоят батальонные группы альянса.",
    "Стаття 5: збройний напад на одного члена в Європі чи Північній Америці — напад на всіх. Від Бухареста (2008) Україні й Грузії обіцяно членство без строку. У Балтії та Польщі стоять батальйонні групи альянсу.",
  ),
  eu: L(
    "A single market and customs union; sanctions need all 27. Article 42.7: members owe one under armed attack aid and assistance by all the means in their power. Ukraine has had an association agreement and free trade with the EU since 2016.",
    "Единый рынок и таможенный союз; санкции принимаются единогласно всеми 27. Статья 42.7: члены обязаны оказать подвергшемуся нападению помощь всеми доступными средствами. С 2016 года у Украины соглашение об ассоциации и зона свободной торговли с ЕС.",
    "Єдиний ринок і митний союз; санкції ухвалюють одностайно всі 27. Стаття 42.7: члени зобов'язані надати тому, хто зазнав нападу, допомогу всіма доступними засобами. З 2016 року Україна має угоду про асоціацію та зону вільної торгівлі з ЄС.",
  ),
  csto: L(
    "Article 4: aggression against one member is aggression against all. A collective rapid reaction force under Russian command; in January 2022 it went into Kazakhstan for the first time.",
    "Статья 4: агрессия против одного члена — агрессия против всех. Коллективные силы быстрого реагирования под российским командованием; в январе 2022 года они впервые вошли в Казахстан.",
    "Стаття 4: агресія проти одного члена — агресія проти всіх. Колективні сили швидкого реагування під російським командуванням; у січні 2022 року вони вперше ввійшли до Казахстану.",
  ),
  "union-state": L(
    "A common economic space, a joint defence doctrine and a regional grouping of forces. Russian troops came to Belarus for the Union Resolve exercises in February 2022 and stayed.",
    "Общее экономическое пространство, единая оборонная доктрина и региональная группировка войск. Российские войска пришли в Беларусь на учения «Союзная решимость» в феврале 2022 года и остались.",
    "Спільний економічний простір, єдина оборонна доктрина й регіональне угруповання військ. Російські війська прибули до Білорусі на навчання «Союзна рішучість» у лютому 2022 року й залишилися.",
  ),
};

export const TREATIES_2022: AllianceSeed[] = [
  osce(
    L(
      "The Helsinki Final Act (1975): borders are inviolable and change only by peaceful agreement. Its Special Monitoring Mission has watched the line in Donbas since 2014. Decisions need the consensus of all 57.",
      "Хельсинкский заключительный акт (1975): границы нерушимы и меняются только мирным соглашением. Специальная мониторинговая миссия наблюдает за линией в Донбассе с 2014 года. Решения — консенсусом всех 57.",
      "Гельсінський заключний акт (1975): кордони непорушні й змінюються лише мирною угодою. Спеціальна моніторингова місія спостерігає за лінією на Донбасі з 2014 року. Рішення — консенсусом усіх 57.",
    ),
  ),
  coe(
    COE_MODERN,
    L(
      "The European Convention on Human Rights: the Strasbourg court's judgements bind every member, and the death penalty is banned. Russia is a member the court often finds in breach.",
      "Европейская конвенция о защите прав человека: решения Страсбургского суда обязательны для всех членов, смертная казнь запрещена. Россия — член, которого суд часто признаёт нарушителем.",
      "Європейська конвенція з прав людини: рішення Страсбурзького суду обов'язкові для всіх членів, смертна кара заборонена. Росія — член, якого суд часто визнає порушником.",
    ),
  ),
  cis(
    ["russia", "belarus", "armenia", "azerbaijan", "kazakhstan", "kyrgyzstan", "moldova", "tajikistan", "uzbekistan"],
    L(
      "Founded at Belovezha as the Soviet Union ended: a free-trade zone and coordination without binding defence. Georgia left in 2009, Ukraine stopped taking part in 2018, Turkmenistan is an associate.",
      "Создано в Беловежье на обломках СССР: зона свободной торговли и координация без обязательств обороны. Грузия вышла в 2009 году, Украина прекратила участие в 2018-м, Туркменистан — ассоциированный член.",
      "Створена в Біловежжі на уламках СРСР: зона вільної торгівлі й координація без оборонних зобов'язань. Грузія вийшла 2009 року, Україна припинила участь 2018-го, Туркменистан — асоційований член.",
    ),
  ),
  {
    id: "eaeu",
    kind: "trade",
    name: L("Eurasian Economic Union", "Евразийский экономический союз", "Євразійський економічний союз"),
    members: ["russia", "belarus", "kazakhstan", "armenia", "kyrgyzstan"],
    since: "2015-01-01",
    terms: L(
      "A customs union and single market: one external tariff, free movement of goods, capital and workers. Russia makes up about four fifths of its economy.",
      "Таможенный союз и единый рынок: общий внешний тариф, свободное движение товаров, капитала и рабочей силы. Около четырёх пятых его экономики — российские.",
      "Митний союз і єдиний ринок: спільний зовнішній тариф, вільний рух товарів, капіталу й робочої сили. Близько чотирьох п'ятих його економіки — російські.",
    ),
  },
  sco(
    ["china", "russia", "kazakhstan", "kyrgyzstan", "tajikistan", "uzbekistan", "india", "pakistan"],
    L(
      "Security cooperation against terrorism, separatism and extremism, and joint exercises — but no duty of mutual defence. India and Pakistan joined in 2017.",
      "Сотрудничество в безопасности против терроризма, сепаратизма и экстремизма, совместные учения — но без обязательства взаимной обороны. Индия и Пакистан вступили в 2017 году.",
      "Співпраця в безпеці проти тероризму, сепаратизму й екстремізму, спільні навчання — але без зобов'язання взаємної оборони. Індія та Пакистан вступили 2017 року.",
    ),
  ),
  brics,
  {
    id: "g7",
    kind: "organization",
    name: L("G7", "Большая семёрка", "Велика сімка"),
    members: G7,
    since: "1975-11-15",
    terms: L(
      "The largest Western economies, with the EU at the table: they coordinate sanctions, aid and money. Russia was dropped from the G8 over Crimea in 2014.",
      "Крупнейшие западные экономики, за столом также ЕС: согласуют санкции, помощь и финансы. Россию исключили из «восьмёрки» в 2014 году из-за Крыма.",
      "Найбільші західні економіки, за столом також ЄС: узгоджують санкції, допомогу й фінанси. Росію виключили з «вісімки» 2014 року через Крим.",
    ),
  },
  g20(
    L(
      "A forum of the largest economies and the EU — about 85% of world output. Indonesia holds the presidency in 2022, with the summit on Bali in November.",
      "Форум крупнейших экономик и ЕС — около 85% мирового производства. В 2022 году председательствует Индонезия, саммит — на Бали в ноябре.",
      "Форум найбільших економік і ЄС — близько 85% світового виробництва. 2022 року головує Індонезія, саміт — на Балі в листопаді.",
    ),
  ),
  opec(
    ["algeria", "angola", "congo", "equatorial-guinea", "gabon", "iran", "iraq", "kuwait", "libya", "nigeria", "saudi-arabia", "united-arab-emirates", "venezuela"],
    L(
      "Oil exporters set output quotas. Since 2016 OPEC+ decides together with Russia, Kazakhstan, Mexico and others; Saudi Arabia and Russia lead it.",
      "Экспортёры нефти устанавливают квоты добычи. С 2016 года ОПЕК+ решает вместе с Россией, Казахстаном, Мексикой и другими; ведут её Саудовская Аравия и Россия.",
      "Експортери нафти встановлюють квоти видобутку. З 2016 року ОПЕК+ вирішує разом із Росією, Казахстаном, Мексикою та іншими; ведуть її Саудівська Аравія та Росія.",
    ),
  ),
  budapest,
  {
    id: "new-start",
    kind: "pact",
    name: L("New START", "Договор СНВ-III", "Договір СНО-III"),
    members: ["usa", "russia"],
    since: "2011-02-05",
    until: "2026-02-05",
    terms: L(
      "Each side keeps at most 1,550 deployed strategic warheads and 700 deployed missiles and bombers, with inspections on the ground. Extended in February 2021 for five years — the last arms treaty between them.",
      "У каждой стороны — не более 1550 развёрнутых стратегических боезарядов и 700 развёрнутых ракет и бомбардировщиков, с инспекциями на местах. Продлён в феврале 2021 года на пять лет — последний договор о вооружениях между ними.",
      "У кожної сторони — не більше 1550 розгорнутих стратегічних боєзарядів і 700 розгорнутих ракет і бомбардувальників, з інспекціями на місцях. Продовжений у лютому 2021 року на п'ять років — останній договір про озброєння між ними.",
    ),
  },
  montreuxModern,
  usJapan("55,000"),
  usKorea("28,500"),
  chinaDprk,
  anzus,
  {
    id: "aukus",
    kind: "pact",
    name: L("AUKUS", "AUKUS", "AUKUS"),
    members: ["australia", "uk", "usa"],
    since: "2021-09-15",
    terms: L(
      "A security pact: Britain and the US help Australia build nuclear-powered submarines and share missile, cyber and AI technology.",
      "Оборонное партнёрство: Великобритания и США помогают Австралии построить атомные подводные лодки и делятся ракетными, кибер- и ИИ-технологиями.",
      "Оборонне партнерство: Велика Британія та США допомагають Австралії збудувати атомні підводні човни й діляться ракетними, кібер- та ШІ-технологіями.",
    ),
  },
  {
    id: "quad",
    kind: "organization",
    name: L("Quadrilateral Security Dialogue (Quad)", "Четырёхсторонний диалог (Quad)", "Чотиристоронній діалог (Quad)"),
    members: ["usa", "japan", "india", "australia"],
    since: "2017-11-12",
    terms: L(
      "Talks and the Malabar naval exercises of four democracies wary of China; no treaty and no duty of defence.",
      "Встречи и военно-морские учения «Малабар» четырёх демократий, настороженных к Китаю; ни договора, ни обязательств обороны.",
      "Зустрічі та військово-морські навчання «Малабар» чотирьох демократій, насторожених щодо Китаю; ні договору, ні зобов'язань оборони.",
    ),
  },
  russiaChina(
    L(
      " On 4 February 2022 the two leaders declared a friendship without limits.",
      " 4 февраля 2022 года лидеры объявили о дружбе «без границ».",
      " 4 лютого 2022 року лідери оголосили про дружбу «без меж».",
    ),
  ),
  {
    id: "shusha",
    name: L("Shusha Declaration", "Шушинская декларация", "Шушинська декларація"),
    members: ["turkey", "azerbaijan"],
    since: "2021-06-15",
    terms: L(
      "An alliance: if a third state attacks either, the other gives aid, military aid included. Signed in Shusha, retaken by Azerbaijan in 2020.",
      "Союз: если третье государство нападёт на одну сторону, другая окажет помощь, в том числе военную. Подписана в Шуше, которую Азербайджан вернул в 2020 году.",
      "Союз: якщо третя держава нападе на одну сторону, інша надасть допомогу, зокрема військову. Підписана в Шуші, яку Азербайджан повернув 2020 року.",
    ),
  },
  {
    id: "lublin-triangle",
    kind: "organization",
    name: L("Lublin Triangle", "Люблинский треугольник", "Люблінський трикутник"),
    members: ["poland", "lithuania", "ukraine"],
    since: "2020-07-28",
    terms: L(
      "Poland, Lithuania and Ukraine coordinate their policy on Russia and Ukraine's way into the EU and NATO; they already share a brigade, LITPOLUKRBRIG.",
      "Польша, Литва и Украина согласуют политику в отношении России и путь Украины в ЕС и НАТО; у них уже есть общая бригада LITPOLUKRBRIG.",
      "Польща, Литва й Україна узгоджують політику щодо Росії та шлях України до ЄС і НАТО; у них уже є спільна бригада LITPOLUKRBRIG.",
    ),
  },
  guam,
  arabLeague(
    ARAB_LEAGUE,
    L(
      "Twenty-two Arab states; Syria's seat has been suspended since 2011. Decisions bind only those who vote for them.",
      "Двадцать два арабских государства; членство Сирии приостановлено с 2011 года. Решения обязательны только для голосовавших за них.",
      "Двадцять дві арабські держави; членство Сирії призупинено з 2011 року. Рішення обов'язкові лише для тих, хто за них голосував.",
    ),
  ),
  gcc(
    L(
      "The Gulf monarchies, Bahrain too: a customs union and the joint Peninsula Shield Force. The blockade of Qatar ended in January 2021.",
      "Монархии Залива, а также Бахрейн: таможенный союз и совместные силы «Щит полуострова». Блокада Катара закончилась в январе 2021 года.",
      "Монархії Затоки, а також Бахрейн: митний союз і спільні сили «Щит півострова». Блокада Катару скінчилася в січні 2021 року.",
    ),
  ),
  {
    id: "african-union",
    kind: "organization",
    name: L("African Union", "Африканский союз", "Африканський союз"),
    members: [...AFRICA_MODERN, "morocco"],
    since: "2002-07-09",
    terms: L(
      "Every African state; a member is suspended after a coup — Mali, Guinea, Sudan and Burkina Faso are in early 2022. Its Peace and Security Council may send troops.",
      "Все государства Африки; после переворота членство приостанавливают — в начале 2022 года приостановлены Мали, Гвинея, Судан и Буркина-Фасо. Совет мира и безопасности может направлять войска.",
      "Усі держави Африки; після перевороту членство призупиняють — на початку 2022 року призупинено Малі, Гвінею, Судан і Буркіна-Фасо. Рада миру та безпеки може направляти війська.",
    ),
  },
  asean(
    ["brunei", "cambodia", "indonesia", "laos", "malaysia", "myanmar", "philippines", "singapore", "thailand", "vietnam"],
    L(
      "Ten Southeast Asian states, Singapore too, decide by consensus and keep out of each other's affairs; a free-trade area since 1992.",
      "Десять государств Юго-Восточной Азии, включая Сингапур, решают консенсусом и не вмешиваются в дела друг друга; зона свободной торговли с 1992 года.",
      "Десять держав Південно-Східної Азії, зокрема Сінгапур, ухвалюють рішення консенсусом і не втручаються в справи одна одної; зона вільної торгівлі з 1992 року.",
    ),
  ),
  mercosur(
    ["argentina", "brazil", "paraguay", "uruguay"],
    L(
      "A customs union of South America's southern cone with a common external tariff; Venezuela has been suspended since 2016.",
      "Таможенный союз юга Южной Америки с общим внешним тарифом; Венесуэла приостановлена с 2016 года.",
      "Митний союз півдня Південної Америки зі спільним зовнішнім тарифом; Венесуелу призупинено з 2016 року.",
    ),
  ),
  {
    id: "usmca",
    kind: "trade",
    name: L("USMCA", "Соглашение США — Мексика — Канада", "Угода США — Мексика — Канада"),
    members: ["usa", "mexico", "canada"],
    since: "2020-07-01",
    terms: L(
      "Free trade across North America in place of NAFTA, with stricter rules of origin for cars.",
      "Свободная торговля в Северной Америке на смену НАФТА, со строгими правилами происхождения для автомобилей.",
      "Вільна торгівля в Північній Америці на зміну НАФТА, із суворими правилами походження для автомобілів.",
    ),
  },
];

// ---- 16 January 2014

export const TERMS_2014: Record<string, Localized> = {
  un,
  nato: L(
    "Article 5: an armed attack on one member in Europe or North America is an attack on all. Since Bucharest (2008) Ukraine and Georgia are promised membership, with no date; Ukraine has been a non-bloc state by law since 2010.",
    "Статья 5: вооружённое нападение на одного члена в Европе или Северной Америке — нападение на всех. С Бухареста (2008) Украине и Грузии обещано членство без срока; Украина по закону внеблоковая с 2010 года.",
    "Стаття 5: збройний напад на одного члена в Європі чи Північній Америці — напад на всіх. Від Бухареста (2008) Україні й Грузії обіцяно членство без строку; Україна за законом позаблокова з 2010 року.",
  ),
  eu: L(
    "A single market and customs union; sanctions need all 28. The association agreement with Ukraine, ready to sign, was turned down by Yanukovych in Vilnius in November 2013 — the spark of the Maidan.",
    "Единый рынок и таможенный союз; санкции — единогласно всеми 28. Готовое соглашение об ассоциации Янукович отверг в Вильнюсе в ноябре 2013 года — это и зажгло Майдан.",
    "Єдиний ринок і митний союз; санкції — одностайно всіма 28. Готову угоду про асоціацію Янукович відкинув у Вільнюсі в листопаді 2013 року — це й запалило Майдан.",
  ),
  csto: L(
    "Article 4: aggression against one member is aggression against all. A collective rapid reaction force under Russian command, never yet used.",
    "Статья 4: агрессия против одного члена — агрессия против всех. Коллективные силы быстрого реагирования под российским командованием ещё ни разу не применялись.",
    "Стаття 4: агресія проти одного члена — агресія проти всіх. Колективні сили швидкого реагування під російським командуванням ще жодного разу не застосовувалися.",
  ),
  "union-state": L(
    "A common economic space and a joint defence doctrine; Russia keeps an early-warning radar and a naval communications station in Belarus.",
    "Общее экономическое пространство и единая оборонная доктрина; в Беларуси у России — радиолокационная станция предупреждения о ракетном нападении и узел связи флота.",
    "Спільний економічний простір і єдина оборонна доктрина; у Білорусі Росія має радіолокаційну станцію попередження про ракетний напад і вузол зв'язку флоту.",
  ),
  "customs-union": L(
    "One external tariff and no customs posts between Russia, Belarus and Kazakhstan. Moscow presses Kyiv to join it instead of signing with the EU.",
    "Общий внешний тариф и никакой таможни между Россией, Беларусью и Казахстаном. Москва добивается, чтобы Киев вступил в него вместо соглашения с ЕС.",
    "Спільний зовнішній тариф і жодної митниці між Росією, Білоруссю та Казахстаном. Москва домагається, щоб Київ вступив до нього замість угоди з ЄС.",
  ),
};

export const TREATIES_2014: AllianceSeed[] = [
  osce(
    L(
      "The Helsinki Final Act (1975): borders are inviolable and change only by peaceful agreement. Decisions need the consensus of all 57; Ukraine holds the chairmanship in 2013 and Switzerland in 2014.",
      "Хельсинкский заключительный акт (1975): границы нерушимы и меняются только мирным соглашением. Решения — консенсусом всех 57; в 2013 году председательствовала Украина, в 2014-м — Швейцария.",
      "Гельсінський заключний акт (1975): кордони непорушні й змінюються лише мирною угодою. Рішення — консенсусом усіх 57; 2013 року головувала Україна, 2014-го — Швейцарія.",
    ),
  ),
  coe(
    COE_MODERN,
    L(
      "The European Convention on Human Rights: the Strasbourg court's judgements bind every member, and the death penalty is banned. It has condemned the jailing of Yulia Tymoshenko.",
      "Европейская конвенция о защите прав человека: решения Страсбургского суда обязательны для всех членов, смертная казнь запрещена. Суд осудил заключение Юлии Тимошенко.",
      "Європейська конвенція з прав людини: рішення Страсбурзького суду обов'язкові для всіх членів, смертна кара заборонена. Суд засудив ув'язнення Юлії Тимошенко.",
    ),
  ),
  cis(
    ["russia", "belarus", "ukraine", "armenia", "azerbaijan", "kazakhstan", "kyrgyzstan", "moldova", "tajikistan", "uzbekistan"],
    L(
      "Founded at Belovezha as the Soviet Union ended: a free-trade zone and coordination without binding defence. Ukraine takes part but never ratified the charter; Georgia left in 2009.",
      "Создано в Беловежье на обломках СССР: зона свободной торговли и координация без обязательств обороны. Украина участвует, но устав так и не ратифицировала; Грузия вышла в 2009 году.",
      "Створена в Біловежжі на уламках СРСР: зона вільної торгівлі й координація без оборонних зобов'язань. Україна бере участь, але статут так і не ратифікувала; Грузія вийшла 2009 року.",
    ),
  ),
  sco(
    ["china", "russia", "kazakhstan", "kyrgyzstan", "tajikistan", "uzbekistan"],
    L(
      "Security cooperation against terrorism, separatism and extremism, and joint exercises — but no duty of mutual defence. India and Pakistan are observers.",
      "Сотрудничество в безопасности против терроризма, сепаратизма и экстремизма, совместные учения — но без обязательства взаимной обороны. Индия и Пакистан — наблюдатели.",
      "Співпраця в безпеці проти тероризму, сепаратизму й екстремізму, спільні навчання — але без зобов'язання взаємної оборони. Індія та Пакистан — спостерігачі.",
    ),
  ),
  brics,
  {
    id: "g8",
    kind: "organization",
    name: L("G8", "Большая восьмёрка", "Велика вісімка"),
    members: [...G7, "russia"],
    since: "1997-06-20",
    terms: L(
      "The largest Western economies and Russia, with the EU at the table. Russia chairs it in 2014, with the summit in Sochi in June.",
      "Крупнейшие западные экономики и Россия, за столом также ЕС. В 2014 году председательствует Россия, саммит — в Сочи в июне.",
      "Найбільші західні економіки та Росія, за столом також ЄС. 2014 року головує Росія, саміт — у Сочі в червні.",
    ),
  },
  g20(
    L(
      "A forum of the largest economies and the EU — about 85% of world output. Australia holds the presidency in 2014, with the summit in Brisbane in November.",
      "Форум крупнейших экономик и ЕС — около 85% мирового производства. В 2014 году председательствует Австралия, саммит — в Брисбене в ноябре.",
      "Форум найбільших економік і ЄС — близько 85% світового виробництва. 2014 року головує Австралія, саміт — у Брисбені в листопаді.",
    ),
  ),
  opec(
    ["algeria", "angola", "ecuador", "iran", "iraq", "kuwait", "libya", "nigeria", "qatar", "saudi-arabia", "united-arab-emirates", "venezuela"],
    L(
      "Oil exporters set output quotas; with oil at about 110 dollars a barrel, Saudi Arabia holds the swing capacity.",
      "Экспортёры нефти устанавливают квоты добычи; при нефти около 110 долларов за баррель резервные мощности — у Саудовской Аравии.",
      "Експортери нафти встановлюють квоти видобутку; за нафти близько 110 доларів за барель резервні потужності — у Саудівської Аравії.",
    ),
  ),
  budapest,
  {
    id: "kharkiv-pact",
    kind: "pact",
    name: L("Kharkiv Pact", "Харьковские соглашения", "Харківські угоди"),
    members: ["russia", "ukraine"],
    since: "2010-04-21",
    until: "2042-05-28",
    terms: L(
      "Russia's Black Sea Fleet keeps its bases in Sevastopol and Crimea until 2042 — up to 25,000 personnel under the agreements of 1997; in return Ukraine pays 100 dollars less per thousand cubic metres of Russian gas.",
      "Черноморский флот России сохраняет базы в Севастополе и Крыму до 2042 года — по соглашениям 1997 года до 25 тысяч военнослужащих; взамен Украина платит за российский газ на 100 долларов меньше за тысячу кубометров.",
      "Чорноморський флот Росії зберігає бази в Севастополі та Криму до 2042 року — за угодами 1997 року до 25 тисяч військовослужбовців; натомість Україна платить за російський газ на 100 доларів менше за тисячу кубометрів.",
    ),
  },
  {
    id: "big-treaty",
    kind: "pact",
    name: L("Ukraine–Russia Friendship Treaty", "Большой договор Украины и России", "Великий договір України та Росії"),
    members: ["ukraine", "russia"],
    since: "1997-05-31",
    terms: L(
      "The Big Treaty: each respects the other's territorial integrity and the inviolability of their borders; renewed every ten years unless one side withdraws.",
      "«Большой договор»: стороны уважают территориальную целостность друг друга и нерушимость границ; продлевается каждые десять лет, если ни одна сторона не выйдет.",
      "«Великий договір»: сторони поважають територіальну цілісність одна одної й непорушність кордонів; продовжується кожні десять років, якщо жодна сторона не вийде.",
    ),
  },
  {
    id: "moscow-deal-2013",
    kind: "trade",
    name: L("Moscow deal of 17 December 2013", "Московские договорённости 17 декабря 2013 года", "Московські домовленості 17 грудня 2013 року"),
    members: ["russia", "ukraine"],
    since: "2013-12-17",
    terms: L(
      "After Yanukovych turned down the EU: Russia buys 15 billion dollars of Ukrainian bonds — the first 3 billion paid in December — and cuts the gas price from about 400 to 268.5 dollars per thousand cubic metres, reviewed every quarter.",
      "После отказа Януковича от соглашения с ЕС: Россия покупает украинские облигации на 15 миллиардов долларов — первые 3 миллиарда выплачены в декабре — и снижает цену газа примерно с 400 до 268,5 доллара за тысячу кубометров с пересмотром каждый квартал.",
      "Після відмови Януковича від угоди з ЄС: Росія купує українські облігації на 15 мільярдів доларів — перші 3 мільярди виплачено в грудні — і знижує ціну газу приблизно з 400 до 268,5 долара за тисячу кубометрів із переглядом щокварталу.",
    ),
  },
  {
    id: "new-start",
    kind: "pact",
    name: L("New START", "Договор СНВ-III", "Договір СНО-III"),
    members: ["usa", "russia"],
    since: "2011-02-05",
    until: "2021-02-05",
    terms: L(
      "Each side keeps at most 1,550 deployed strategic warheads and 700 deployed missiles and bombers, with inspections on the ground.",
      "У каждой стороны — не более 1550 развёрнутых стратегических боезарядов и 700 развёрнутых ракет и бомбардировщиков, с инспекциями на местах.",
      "У кожної сторони — не більше 1550 розгорнутих стратегічних боєзарядів і 700 розгорнутих ракет і бомбардувальників, з інспекціями на місцях.",
    ),
  },
  inf(
    ["usa", "russia"],
    L(
      "Bans ground-launched missiles with a range of 500 to 5,500 km. The US suspects Russia of testing a banned cruise missile.",
      "Запрещает ракеты наземного базирования дальностью от 500 до 5500 км. США подозревают Россию в испытаниях запрещённой крылатой ракеты.",
      "Забороняє ракети наземного базування дальністю від 500 до 5500 км. США підозрюють Росію у випробуваннях забороненої крилатої ракети.",
    ),
  ),
  montreuxModern,
  usJapan("50,000"),
  usKorea("28,500"),
  chinaDprk,
  anzus,
  russiaChina(NONE),
  guam,
  arabLeague(
    ARAB_LEAGUE,
    L(
      "Twenty-two Arab states; Syria's seat has been suspended since 2011. Decisions bind only those who vote for them.",
      "Двадцать два арабских государства; членство Сирии приостановлено с 2011 года. Решения обязательны только для голосовавших за них.",
      "Двадцять дві арабські держави; членство Сирії призупинено з 2011 року. Рішення обов'язкові лише для тих, хто за них голосував.",
    ),
  ),
  gcc(
    L(
      "The Gulf monarchies, Bahrain too: a customs union and the joint Peninsula Shield Force, which went into Bahrain in 2011.",
      "Монархии Залива, а также Бахрейн: таможенный союз и совместные силы «Щит полуострова», в 2011 году вошедшие в Бахрейн.",
      "Монархії Затоки, а також Бахрейн: митний союз і спільні сили «Щит півострова», що 2011 року ввійшли до Бахрейну.",
    ),
  ),
  {
    id: "african-union",
    kind: "organization",
    name: L("African Union", "Африканский союз", "Африканський союз"),
    members: AFRICA_MODERN,
    since: "2002-07-09",
    terms: L(
      "Every African state but Morocco; a member is suspended after a coup — Egypt, the Central African Republic and Guinea-Bissau are in early 2014. Its Peace and Security Council may send troops.",
      "Все государства Африки, кроме Марокко; после переворота членство приостанавливают — в начале 2014 года приостановлены Египет, ЦАР и Гвинея-Бисау. Совет мира и безопасности может направлять войска.",
      "Усі держави Африки, крім Марокко; після перевороту членство призупиняють — на початку 2014 року призупинено Єгипет, ЦАР і Гвінею-Бісау. Рада миру та безпеки може направляти війська.",
    ),
  },
  asean(
    ["brunei", "cambodia", "indonesia", "laos", "malaysia", "myanmar", "philippines", "singapore", "thailand", "vietnam"],
    L(
      "Ten Southeast Asian states, Singapore too, decide by consensus and keep out of each other's affairs; a free-trade area since 1992.",
      "Десять государств Юго-Восточной Азии, включая Сингапур, решают консенсусом и не вмешиваются в дела друг друга; зона свободной торговли с 1992 года.",
      "Десять держав Південно-Східної Азії, зокрема Сінгапур, ухвалюють рішення консенсусом і не втручаються в справи одна одної; зона вільної торгівлі з 1992 року.",
    ),
  ),
  mercosur(
    ["argentina", "brazil", "paraguay", "uruguay", "venezuela"],
    L(
      "A customs union of South America's southern cone with a common external tariff; Venezuela joined in 2012.",
      "Таможенный союз юга Южной Америки с общим внешним тарифом; Венесуэла вступила в 2012 году.",
      "Митний союз півдня Південної Америки зі спільним зовнішнім тарифом; Венесуела вступила 2012 року.",
    ),
  ),
  {
    id: "nafta",
    kind: "trade",
    name: L("NAFTA", "НАФТА", "НАФТА"),
    members: ["usa", "canada", "mexico"],
    since: "1994-01-01",
    terms: L(
      "Twenty years of free trade across North America; Mexico's car industry grew on it.",
      "Двадцать лет свободной торговли в Северной Америке; на ней выросла автомобильная промышленность Мексики.",
      "Двадцять років вільної торгівлі в Північній Америці; на ній виросла автомобільна промисловість Мексики.",
    ),
  },
];

// ---- 19 August 1991

const NATO_1991 = ["usa", "uk", "france", "germany", "italy", "canada", "netherlands", "belgium", "luxembourg", "denmark", "norway", "iceland", "portugal", "spain", "greece", "turkey"];

export const TERMS_1991: Record<string, Localized> = {
  un: L(
    "The Charter of 1945; the Security Council authorised force against Iraq in 1990. The Soviet Union holds a permanent seat with a veto, and Ukraine and Byelorussia have seats of their own.",
    "Устав 1945 года; в 1990 году Совет Безопасности разрешил применить силу против Ирака. У Советского Союза — постоянное место с правом вето, у Украины и Белоруссии — собственные места.",
    "Статут 1945 року; 1990 року Рада Безпеки дозволила застосувати силу проти Іраку. Радянський Союз має постійне місце з правом вето, Україна та Білорусь — власні місця.",
  ),
  nato: L(
    "Article 5: an armed attack on one member is an attack on all. The Warsaw Pact dissolved on 1 July 1991; in London in 1990 NATO declared its old adversaries no longer enemies.",
    "Статья 5: вооружённое нападение на одного члена — нападение на всех. Варшавский договор распущен 1 июля 1991 года; в Лондоне в 1990 году НАТО объявило, что бывшие противники больше не враги.",
    "Стаття 5: збройний напад на одного члена — напад на всіх. Варшавський договір розпущено 1 липня 1991 року; у Лондоні 1990 року НАТО оголосило, що колишні супротивники більше не вороги.",
  ),
  "european-communities": L(
    "A common market of twelve; a treaty on European Union with a single currency is being negotiated, to be agreed in Maastricht in December.",
    "Общий рынок двенадцати стран; идут переговоры о договоре о Европейском союзе с единой валютой — его должны согласовать в Маастрихте в декабре.",
    "Спільний ринок дванадцяти країн; тривають переговори про договір про Європейський союз зі спільною валютою — його мають погодити в Маастрихті в грудні.",
  ),
};

export const TREATIES_1991: AllianceSeed[] = [
  {
    id: "csce",
    kind: "organization",
    name: L("CSCE", "СБСЕ", "НБСЄ"),
    members: [
      "albania", "austria", "belgium", "bulgaria", "canada", "cyprus", "czechoslovakia", "denmark", "finland", "france", "germany", "greece",
      "hungary", "iceland", "ireland", "italy", "liechtenstein", "luxembourg", "malta", "netherlands", "norway", "poland", "portugal", "romania",
      "spain", "sweden", "switzerland", "turkey", "uk", "usa", "ussr", "yugoslavia",
    ],
    since: "1975-08-01",
    terms: L(
      "The Helsinki Final Act (1975): borders are inviolable and change only by agreement; human rights are everyone's business. The Charter of Paris (1990) declared the end of Europe's division.",
      "Хельсинкский заключительный акт (1975): границы нерушимы и меняются только по согласию; права человека — общее дело. Парижская хартия (1990) объявила конец разделения Европы.",
      "Гельсінський заключний акт (1975): кордони непорушні й змінюються лише за згодою; права людини — спільна справа. Паризька хартія (1990) проголосила кінець поділу Європи.",
    ),
  },
  {
    id: "weu",
    name: L("Western European Union", "Западноевропейский союз", "Західноєвропейський союз"),
    members: ["belgium", "france", "germany", "italy", "luxembourg", "netherlands", "uk", "spain", "portugal"],
    since: "1954-10-23",
    terms: L(
      "Article V: automatic military aid, with all means, to a member attacked in Europe — a stronger pledge than NATO's, though in practice it leans on NATO.",
      "Статья V: автоматическая военная помощь всеми средствами члену, подвергшемуся нападению в Европе, — обязательство сильнее, чем у НАТО, хотя на деле союз опирается на НАТО.",
      "Стаття V: автоматична військова допомога всіма засобами члену, на якого напали в Європі, — зобов'язання сильніше, ніж у НАТО, хоча на ділі союз спирається на НАТО.",
    ),
  },
  coe(
    [
      "austria", "belgium", "cyprus", "czechoslovakia", "denmark", "finland", "france", "germany", "greece", "hungary", "iceland", "ireland",
      "italy", "liechtenstein", "luxembourg", "malta", "netherlands", "norway", "portugal", "spain", "sweden", "switzerland", "turkey", "uk",
    ],
    L(
      "The European Convention on Human Rights; Hungary (1990) and Czechoslovakia (1991) are its first members from the East, and Poland is next.",
      "Европейская конвенция о защите прав человека; Венгрия (1990) и Чехословакия (1991) — первые члены с Востока, следующая — Польша.",
      "Європейська конвенція з прав людини; Угорщина (1990) і Чехословаччина (1991) — перші члени зі Сходу, наступна — Польща.",
    ),
  ),
  {
    id: "visegrad",
    kind: "organization",
    name: L("Visegrád Group", "Вишеградская группа", "Вишеградська група"),
    members: ["poland", "czechoslovakia", "hungary"],
    since: "1991-02-15",
    terms: L(
      "Poland, Czechoslovakia and Hungary coordinate their way out of the Soviet bloc and into the European Communities and NATO.",
      "Польша, Чехословакия и Венгрия согласуют выход из советского блока и путь в Европейские сообщества и НАТО.",
      "Польща, Чехословаччина й Угорщина узгоджують вихід із радянського блоку та шлях до Європейських співтовариств і НАТО.",
    ),
  },
  {
    id: "two-plus-four",
    kind: "pact",
    name: L("Two Plus Four Treaty", "Договор «2+4» об окончательном урегулировании в отношении Германии", "Договір «2+4» про остаточне врегулювання щодо Німеччини"),
    members: ["germany", "ussr", "usa", "uk", "france"],
    since: "1990-09-12",
    terms: L(
      "Germany unites within its present borders; Soviet troops leave the former GDR by the end of 1994; the German army is capped at 370,000 and Germany renounces nuclear, biological and chemical weapons.",
      "Германия объединяется в нынешних границах; советские войска уходят из бывшей ГДР до конца 1994 года; бундесвер ограничен 370 тысячами, а Германия отказывается от ядерного, биологического и химического оружия.",
      "Німеччина об'єднується в нинішніх кордонах; радянські війська виходять із колишньої НДР до кінця 1994 року; бундесвер обмежено 370 тисячами, а Німеччина відмовляється від ядерної, біологічної та хімічної зброї.",
    ),
  },
  {
    id: "cfe",
    kind: "pact",
    name: L("CFE Treaty", "Договор об обычных вооружённых силах в Европе", "Договір про звичайні збройні сили в Європі"),
    members: [...NATO_1991, "ussr", "poland", "czechoslovakia", "hungary", "romania", "bulgaria"],
    since: "1990-11-19",
    terms: L(
      "Ceilings from the Atlantic to the Urals: each bloc at most 20,000 tanks, 30,000 armoured vehicles, 20,000 guns, 6,800 combat aircraft and 2,000 attack helicopters, with inspections.",
      "Потолки от Атлантики до Урала: у каждого блока не более 20 тысяч танков, 30 тысяч бронемашин, 20 тысяч орудий, 6800 боевых самолётов и 2000 ударных вертолётов, с инспекциями.",
      "Стелі від Атлантики до Уралу: у кожного блоку не більше 20 тисяч танків, 30 тисяч бронемашин, 20 тисяч гармат, 6800 бойових літаків і 2000 ударних гелікоптерів, з інспекціями.",
    ),
  },
  inf(
    ["usa", "ussr"],
    L(
      "Bans ground-launched missiles with a range of 500 to 5,500 km; the last of them were destroyed in May 1991.",
      "Запрещает ракеты наземного базирования дальностью от 500 до 5500 км; последние из них уничтожены в мае 1991 года.",
      "Забороняє ракети наземного базування дальністю від 500 до 5500 км; останні з них знищено в травні 1991 року.",
    ),
  ),
  {
    id: "start-1",
    kind: "pact",
    name: L("START I", "Договор СНВ-I", "Договір СНО-I"),
    members: ["usa", "ussr"],
    since: "1991-07-31",
    terms: L(
      "Signed in Moscow on 31 July and not yet ratified: each side is to cut to 6,000 strategic warheads and 1,600 launchers within seven years.",
      "Подписан в Москве 31 июля и ещё не ратифицирован: каждая сторона должна сократить стратегические силы до 6000 боезарядов и 1600 носителей за семь лет.",
      "Підписаний у Москві 31 липня й ще не ратифікований: кожна сторона має скоротити стратегічні сили до 6000 боєзарядів і 1600 носіїв за сім років.",
    ),
  },
  {
    id: "indo-soviet",
    kind: "pact",
    name: L("Indo-Soviet Treaty of Friendship", "Советско-индийский договор о мире, дружбе и сотрудничестве", "Радянсько-індійський договір про мир, дружбу та співробітництво"),
    members: ["ussr", "india"],
    since: "1971-08-09",
    terms: L(
      "If either is attacked or threatened, both consult at once to remove the threat. Its first twenty years ran out on 9 August 1991; both still keep to it, and the USSR is India's main arms supplier.",
      "Если на одну сторону нападут или ей будут угрожать, обе немедленно совещаются, чтобы устранить угрозу. Первые двадцать лет истекли 9 августа 1991 года; обе стороны его соблюдают, а СССР — главный поставщик оружия Индии.",
      "Якщо на одну сторону нападуть або їй погрожуватимуть, обидві негайно радяться, щоб усунути загрозу. Перші двадцять років спливли 9 серпня 1991 року; обидві сторони його дотримуються, а СРСР — головний постачальник зброї Індії.",
    ),
  },
  usJapan("45,000"),
  usKorea("40,000"),
  chinaDprk,
  anzus,
  {
    id: "efta",
    kind: "trade",
    name: L("EFTA", "Европейская ассоциация свободной торговли", "Європейська асоціація вільної торгівлі"),
    members: ["austria", "finland", "iceland", "liechtenstein", "norway", "sweden", "switzerland"],
    since: "1960-05-03",
    terms: L(
      "Free trade among Western Europe's outsiders; it is negotiating a European Economic Area with the Communities, and Austria and Sweden have applied to join them.",
      "Свободная торговля западноевропейских «аутсайдеров»; ведёт переговоры о Европейском экономическом пространстве с сообществами, а Австрия и Швеция подали заявки на вступление в них.",
      "Вільна торгівля західноєвропейських «аутсайдерів»; веде переговори про Європейський економічний простір зі співтовариствами, а Австрія та Швеція подали заявки на вступ до них.",
    ),
  },
  arabLeague(
    ARAB_LEAGUE,
    L(
      "Split by the Gulf War: Egypt, Syria and the Gulf states fought in the coalition against Iraq, while Jordan, Yemen and the PLO stood by Baghdad.",
      "Расколота войной в Заливе: Египет, Сирия и страны Залива воевали в коалиции против Ирака, а Иордания, Йемен и ООП поддержали Багдад.",
      "Розколота війною в Затоці: Єгипет, Сирія та країни Затоки воювали в коаліції проти Іраку, а Йорданія, Ємен і ОВП підтримали Багдад.",
    ),
  ),
  gcc(
    L(
      "The Gulf monarchies, Bahrain too; Kuwait was freed from Iraqi occupation in February 1991 by the coalition.",
      "Монархии Залива, а также Бахрейн; в феврале 1991 года коалиция освободила Кувейт от иракской оккупации.",
      "Монархії Затоки, а також Бахрейн; у лютому 1991 року коаліція звільнила Кувейт від іракської окупації.",
    ),
  ),
  {
    id: "oau",
    kind: "organization",
    name: L("Organisation of African Unity", "Организация африканского единства", "Організація африканської єдності"),
    members: [
      "algeria", "angola", "benin", "botswana", "burkina-faso", "burundi", "cameroon", "central-african-republic", "chad", "congo", "djibouti",
      "egypt", "equatorial-guinea", "ethiopia", "gabon", "gambia", "ghana", "guinea", "guinea-bissau", "ivory-coast", "kenya", "lesotho",
      "liberia", "libya", "madagascar", "malawi", "mali", "mauritania", "mozambique", "namibia", "niger", "nigeria", "rwanda", "senegal",
      "sierra-leone", "somalia", "sudan", "swaziland", "tanzania", "togo", "tunisia", "uganda", "zaire", "zambia", "zimbabwe",
    ],
    since: "1963-05-25",
    terms: L(
      "The borders left by the colonial powers are untouchable; it fights apartheid, and South Africa is outside it. Morocco left in 1984 over Western Sahara.",
      "Границы, оставленные колонизаторами, неприкосновенны; организация борется с апартеидом, ЮАР вне её. Марокко вышло в 1984 году из-за Западной Сахары.",
      "Кордони, залишені колонізаторами, недоторканні; організація бореться з апартеїдом, ПАР поза нею. Марокко вийшло 1984 року через Західну Сахару.",
    ),
  },
  asean(
    ["brunei", "indonesia", "malaysia", "philippines", "singapore", "thailand"],
    L(
      "Six Southeast Asian states, Singapore too, deciding by consensus; Vietnam, whose army left Cambodia in 1989, is still outside.",
      "Шесть государств Юго-Восточной Азии, включая Сингапур, решают консенсусом; Вьетнам, чья армия ушла из Камбоджи в 1989 году, пока вне организации.",
      "Шість держав Південно-Східної Азії, зокрема Сінгапур, ухвалюють рішення консенсусом; В'єтнам, чия армія пішла з Камбоджі 1989 року, поки поза організацією.",
    ),
  ),
  mercosur(
    ["argentina", "brazil", "paraguay", "uruguay"],
    L(
      "Signed in Asunción in March 1991: a common market of the southern cone by the end of 1994.",
      "Подписан в Асунсьоне в марте 1991 года: общий рынок юга континента к концу 1994 года.",
      "Підписаний в Асунсьйоні в березні 1991 року: спільний ринок півдня континенту до кінця 1994 року.",
    ),
  ),
];

// ---- 1 September 1939

export const TERMS_1939: Record<string, Localized> = {
  "league-of-nations": L(
    "Collective security that failed over Manchuria, Abyssinia and Czechoslovakia; Germany, Japan and Italy have left, and its sanctions are on paper only.",
    "Коллективная безопасность, не выдержавшая Маньчжурии, Абиссинии и Чехословакии; Германия, Япония и Италия вышли, а её санкции — лишь на бумаге.",
    "Колективна безпека, що не витримала Маньчжурії, Абіссінії та Чехословаччини; Німеччина, Японія та Італія вийшли, а її санкції — лише на папері.",
  ),
  "pact-of-steel": L(
    "An offensive alliance: if one goes to war, the other joins at once with all its forces. Italy has told Germany it cannot be ready before 1942.",
    "Наступательный союз: если одна сторона вступает в войну, другая немедленно присоединяется всеми силами. Италия предупредила Германию, что не будет готова раньше 1942 года.",
    "Наступальний союз: якщо одна сторона вступає у війну, інша негайно приєднується всіма силами. Італія попередила Німеччину, що не буде готова раніше 1942 року.",
  ),
  "slovak-protection": L(
    "Germany guarantees Slovakia's independence for 25 years and keeps troops in a protected zone in its west; Slovakia's army and foreign policy follow Berlin.",
    "Германия гарантирует независимость Словакии на 25 лет и держит войска в «защитной зоне» на её западе; армия и внешняя политика Словакии следуют за Берлином.",
    "Німеччина гарантує незалежність Словаччини на 25 років і тримає війська в «захисній зоні» на її заході; армія та зовнішня політика Словаччини йдуть за Берліном.",
  ),
  "polish-guarantee": L(
    "The Anglo-Polish agreement of mutual assistance of 25 August: if a European power attacks Poland, Britain gives all the support in its power. France is bound by its own alliance of 1921.",
    "Англо-польское соглашение о взаимопомощи от 25 августа: если европейская держава нападёт на Польшу, Великобритания окажет всю возможную поддержку. Францию связывает собственный союз 1921 года.",
    "Англо-польська угода про взаємодопомогу від 25 серпня: якщо європейська держава нападе на Польщу, Велика Британія надасть усю можливу підтримку. Францію пов'язує власний союз 1921 року.",
  ),
  "molotov-ribbentrop": L(
    "Ten years of non-aggression, and neutrality if either goes to war. A secret protocol divides Eastern Europe: Finland, Estonia, Latvia, eastern Poland and Bessarabia to the Soviet sphere, western Poland and Lithuania to the German.",
    "Десять лет ненападения и нейтралитет, если одна из сторон вступит в войну. Секретный протокол делит Восточную Европу: Финляндия, Эстония, Латвия, восточная Польша и Бессарабия — советская сфера, западная Польша и Литва — германская.",
    "Десять років ненападу й нейтралітет, якщо одна зі сторін вступить у війну. Таємний протокол ділить Східну Європу: Фінляндія, Естонія, Латвія, східна Польща та Бессарабія — радянська сфера, західна Польща й Литва — німецька.",
  ),
  commonwealth: L(
    "Since the Statute of Westminster (1931) each dominion decides on war for itself; the South African cabinet is split.",
    "Со времён Вестминстерского статута (1931) каждый доминион сам решает, вступать ли в войну; кабинет Южной Африки расколот.",
    "Від Вестмінстерського статуту (1931) кожен домініон сам вирішує, чи вступати у війну; кабінет Південної Африки розколотий.",
  ),
  "soviet-mongolian": L(
    "Mutual military aid; Soviet and Mongolian troops have just routed the Japanese at Khalkhin Gol.",
    "Взаимная военная помощь; советские и монгольские войска только что разгромили японцев на Халхин-Голе.",
    "Взаємна військова допомога; радянські та монгольські війська щойно розгромили японців на Халхін-Голі.",
  ),
};

export const TREATIES_1939: AllianceSeed[] = [
  {
    id: "anti-comintern",
    kind: "pact",
    name: L("Anti-Comintern Pact", "Антикоминтерновский пакт", "Антикомінтернівський пакт"),
    members: ["germany", "japan", "italy", "hungary", "spain"],
    since: "1936-11-25",
    terms: L(
      "Against the Communist International; a secret protocol promises neutrality if the USSR attacks one of them. Germany's pact with Moscow has outraged Tokyo, and the Japanese cabinet has resigned.",
      "Против Коммунистического интернационала; секретный протокол обещает нейтралитет, если СССР нападёт на одного из них. Пакт Германии с Москвой возмутил Токио — японский кабинет ушёл в отставку.",
      "Проти Комуністичного інтернаціоналу; таємний протокол обіцяє нейтралітет, якщо СРСР нападе на одного з них. Пакт Німеччини з Москвою обурив Токіо — японський кабінет пішов у відставку.",
    ),
  },
  {
    id: "franco-polish",
    name: L("Franco-Polish Alliance", "Франко-польский союз", "Франко-польський союз"),
    members: ["france", "poland"],
    since: "1921-02-19",
    terms: L(
      "The alliance of 1921; by the convention of May 1939 France is to attack Germany with the bulk of its army by the fifteenth day of mobilisation.",
      "Союз 1921 года; по конвенции мая 1939 года Франция должна ударить по Германии основными силами армии на пятнадцатый день мобилизации.",
      "Союз 1921 року; за конвенцією травня 1939 року Франція має вдарити по Німеччині основними силами армії на п'ятнадцятий день мобілізації.",
    ),
  },
  {
    id: "polish-romanian",
    name: L("Polish–Romanian Alliance", "Польско-румынский союз", "Польсько-румунський союз"),
    members: ["poland", "romania"],
    since: "1921-03-03",
    terms: L(
      "Mutual defence against an attack from the east only — it does not bind Romania to fight Germany.",
      "Взаимная оборона только от нападения с востока — воевать с Германией он Румынию не обязывает.",
      "Взаємна оборона лише від нападу зі сходу — воювати з Німеччиною він Румунію не зобов'язує.",
    ),
  },
  {
    id: "franco-soviet",
    kind: "pact",
    name: L("Franco-Soviet Treaty of Mutual Assistance", "Франко-советский договор о взаимопомощи", "Франко-радянський договір про взаємодопомогу"),
    members: ["france", "ussr"],
    since: "1935-05-02",
    terms: L(
      "Mutual aid against unprovoked aggression — never backed by a military convention, and hollow since the Soviet pact with Germany.",
      "Взаимная помощь против неспровоцированной агрессии — так и не подкреплённая военной конвенцией и пустая после советского пакта с Германией.",
      "Взаємна допомога проти неспровокованої агресії — так і не підкріплена військовою конвенцією й порожня після радянського пакту з Німеччиною.",
    ),
  },
  {
    id: "balkan-entente",
    kind: "pact",
    name: L("Balkan Pact", "Балканская Антанта", "Балканська Антанта"),
    members: ["greece", "romania", "turkey", "yugoslavia"],
    since: "1934-02-09",
    terms: L(
      "Greece, Romania, Turkey and Yugoslavia guarantee each other's Balkan borders — against Bulgaria, not against a great power.",
      "Греция, Румыния, Турция и Югославия гарантируют друг другу балканские границы — против Болгарии, а не против великой державы.",
      "Греція, Румунія, Туреччина та Югославія гарантують одна одній балканські кордони — проти Болгарії, а не проти великої держави.",
    ),
  },
  {
    id: "baltic-entente",
    kind: "organization",
    name: L("Baltic Entente", "Балтийская Антанта", "Балтійська Антанта"),
    members: ["estonia", "latvia", "lithuania"],
    since: "1934-09-12",
    terms: L(
      "Estonia, Latvia and Lithuania coordinate their foreign policy and have declared strict neutrality; there is no common defence.",
      "Эстония, Латвия и Литва согласуют внешнюю политику и объявили строгий нейтралитет; общей обороны нет.",
      "Естонія, Латвія та Литва узгоджують зовнішню політику й оголосили суворий нейтралітет; спільної оборони немає.",
    ),
  },
  {
    id: "saadabad",
    kind: "pact",
    name: L("Saadabad Pact", "Саадабадский пакт", "Саадабадський пакт"),
    members: ["turkey", "iran", "iraq", "afghanistan"],
    since: "1937-07-08",
    terms: L(
      "Non-aggression and consultation among Turkey, Iran, Iraq and Afghanistan; each keeps the Kurdish movements along its borders in check.",
      "Ненападение и консультации между Турцией, Ираном, Ираком и Афганистаном; каждая сторона сдерживает курдские движения у своих границ.",
      "Ненапад і консультації між Туреччиною, Іраном, Іраком та Афганістаном; кожна сторона стримує курдські рухи біля своїх кордонів.",
    ),
  },
  {
    id: "anglo-egyptian",
    name: L("Anglo-Egyptian Treaty", "Англо-египетский договор", "Англо-єгипетський договір"),
    members: ["uk", "egypt"],
    since: "1936-08-26",
    terms: L(
      "An alliance for twenty years: 10,000 British troops guard the Suez Canal, and in war Egypt opens its ports, airfields and roads to Britain.",
      "Союз на двадцать лет: 10 тысяч британских солдат охраняют Суэцкий канал, а в войну Египет открывает Британии порты, аэродромы и дороги.",
      "Союз на двадцять років: 10 тисяч британських солдатів охороняють Суецький канал, а у війну Єгипет відкриває Британії порти, аеродроми й дороги.",
    ),
  },
  {
    id: "anglo-iraqi",
    name: L("Anglo-Iraqi Treaty", "Англо-иракский договор", "Англо-іракський договір"),
    members: ["uk", "iraq"],
    since: "1930-06-30",
    terms: L(
      "Britain keeps its air bases at Habbaniya and Shaibah, and in war Iraq gives it every facility, railways and rivers included.",
      "Британия сохраняет авиабазы в Хаббании и Шуайбе, а в войну Ирак предоставляет ей все возможности, включая железные дороги и реки.",
      "Британія зберігає авіабази в Хаббанії та Шуайбі, а у війну Ірак надає їй усі можливості, включно із залізницями й річками.",
    ),
  },
  {
    id: "anglo-french-turkish",
    kind: "pact",
    name: L("Anglo-French–Turkish declarations", "Англо-франко-турецкие декларации", "Англо-франко-турецькі декларації"),
    members: ["uk", "france", "turkey"],
    since: "1939-05-12",
    terms: L(
      "Mutual aid if war comes to the Mediterranean, until a full treaty is signed; France ceded Hatay to Turkey in June to win it.",
      "Взаимная помощь, если война придёт в Средиземноморье, до подписания полного договора; ради этого Франция в июне уступила Турции Хатай.",
      "Взаємна допомога, якщо війна прийде в Середземномор'я, до підписання повного договору; задля цього Франція в червні поступилася Туреччині Хатаєм.",
    ),
  },
  {
    id: "montreux",
    kind: "pact",
    name: L("Montreux Convention", "Конвенция Монтрё", "Конвенція Монтре"),
    members: ["turkey", "uk", "france", "ussr", "bulgaria", "romania", "greece", "japan", "yugoslavia", "australia"],
    since: "1936-07-20",
    terms: L(
      "Turkey controls the straits and has fortified them again. Merchant ships pass freely; warships of powers outside the Black Sea are limited in size and to 21 days; while Turkey is neutral in a war, the warring sides' warships may not pass.",
      "Турция контролирует проливы и вновь их укрепила. Торговые суда проходят свободно; военные корабли нечерноморских держав ограничены тоннажем и сроком в 21 день; пока Турция нейтральна в войне, военные корабли воюющих сторон через проливы не проходят.",
      "Туреччина контролює протоки й знову їх укріпила. Торговельні судна проходять вільно; військові кораблі нечорноморських держав обмежені тоннажем і строком у 21 день; поки Туреччина нейтральна у війні, військові кораблі сторін, що воюють, протоками не проходять.",
    ),
  },
  {
    id: "german-soviet-credit",
    kind: "trade",
    name: L("German–Soviet Credit Agreement", "Германо-советское кредитное соглашение", "Німецько-радянська кредитна угода"),
    members: ["germany", "ussr"],
    since: "1939-08-19",
    terms: L(
      "Germany lends 200 million Reichsmarks for machinery and arms; the USSR pays in grain, oil, timber and ores — a way around a British blockade.",
      "Германия даёт кредит в 200 миллионов рейхсмарок на станки и вооружение; СССР платит зерном, нефтью, лесом и рудой — путь в обход британской блокады.",
      "Німеччина дає кредит у 200 мільйонів рейхсмарок на верстати й озброєння; СРСР платить зерном, нафтою, лісом і рудою — шлях в обхід британської блокади.",
    ),
  },
  {
    id: "german-romanian",
    kind: "trade",
    name: L("German–Romanian Economic Treaty", "Германо-румынский экономический договор", "Німецько-румунський економічний договір"),
    members: ["germany", "romania"],
    since: "1939-03-23",
    terms: L(
      "Romania's oil, grain and timber for German industrial goods and arms; joint companies shape its economy to Germany's needs.",
      "Румынская нефть, зерно и лес в обмен на германские промышленные товары и оружие; совместные компании подстраивают её хозяйство под нужды Германии.",
      "Румунська нафта, зерно й ліс в обмін на німецькі промислові товари та зброю; спільні компанії підлаштовують її господарство під потреби Німеччини.",
    ),
  },
  angloPortuguese(
    L(
      " Portugal means to stay neutral, but Britain may call on its ports and the Azores.",
      " Португалия намерена сохранить нейтралитет, но Британия может попросить её порты и Азорские острова.",
      " Португалія має намір зберегти нейтралітет, але Британія може попросити її порти й Азорські острови.",
    ),
  ),
];

// ---- 28 June 1914

export const TERMS_1914: Record<string, Localized> = {
  entente: L(
    "Not one treaty but three: France and Russia are allies; Britain is bound to each only by agreements on colonies, and to France by naval talks.",
    "Не один договор, а три: Франция и Россия — союзники; Британию с каждой связывают лишь соглашения о колониях, а с Францией — морские переговоры.",
    "Не один договір, а три: Франція й Росія — союзниці; Британію з кожною пов'язують лише угоди про колонії, а з Францією — морські переговори.",
  ),
  "triple-alliance": L(
    "Germany, Austria-Hungary and Italy defend each other if attacked by two great powers; renewed in 1912. Italy is bound only to a defensive war and has secretly promised France neutrality (1902).",
    "Германия, Австро-Венгрия и Италия защищают друг друга при нападении двух великих держав; продлён в 1912 году. Италия обязана лишь к оборонительной войне и тайно обещала Франции нейтралитет (1902).",
    "Німеччина, Австро-Угорщина та Італія захищають одна одну в разі нападу двох великих держав; продовжений 1912 року. Італія зобов'язана лише до оборонної війни й таємно пообіцяла Франції нейтралітет (1902).",
  ),
  "british-empire": L(
    "When the King declares war, the whole Empire is at war; the dominions decide only how much they send.",
    "Когда король объявляет войну, воюет вся империя; доминионы решают лишь, сколько отправить.",
    "Коли король оголошує війну, воює вся імперія; домініони вирішують лише, скільки відправити.",
  ),
  "anglo-japanese": L(
    "If either is attacked in East Asia or India, the other comes to its aid; renewed in 1911 for ten years, a war with the United States excepted.",
    "Если на одну из сторон нападут в Восточной Азии или Индии, другая приходит на помощь; продлён в 1911 году на десять лет, за исключением войны с США.",
    "Якщо на одну зі сторін нападуть у Східній Азії чи Індії, інша приходить на допомогу; продовжений 1911 року на десять років, за винятком війни зі США.",
  ),
};

export const TREATIES_1914: AllianceSeed[] = [
  {
    id: "franco-russian",
    name: L("Franco-Russian Alliance", "Франко-русский союз", "Франко-російський союз"),
    members: ["france", "russia"],
    since: "1894-01-04",
    terms: L(
      "If Germany attacks either, both fight it: France with 1.3 million men, Russia at once with 700,000–800,000. French loans built Russia's strategic railways to the west.",
      "Если Германия нападёт на одну из сторон, воюют обе: Франция — 1,3 миллиона человек, Россия — сразу 700–800 тысяч. На французские займы Россия построила стратегические дороги на запад.",
      "Якщо Німеччина нападе на одну зі сторін, воюють обидві: Франція — 1,3 мільйона людей, Росія — одразу 700–800 тисяч. На французькі позики Росія збудувала стратегічні залізниці на захід.",
    ),
  },
  {
    id: "entente-cordiale",
    kind: "pact",
    name: L("Entente Cordiale", "Сердечное согласие", "Сердечна згода"),
    members: ["uk", "france"],
    since: "1904-04-08",
    terms: L(
      "Colonial quarrels settled — Egypt to Britain, Morocco to France. Since 1912 the French fleet holds the Mediterranean and the British the Channel, but Britain has signed no promise to fight.",
      "Колониальные споры улажены: Египет — Британии, Марокко — Франции. С 1912 года французский флот держит Средиземное море, а британский — Ла-Манш, но обязательства воевать Британия не подписывала.",
      "Колоніальні суперечки владнано: Єгипет — Британії, Марокко — Франції. З 1912 року французький флот тримає Середземне море, а британський — Ла-Манш, але зобов'язання воювати Британія не підписувала.",
    ),
  },
  {
    id: "anglo-russian",
    kind: "pact",
    name: L("Anglo-Russian Convention", "Англо-русское соглашение", "Англо-російська угода"),
    members: ["uk", "russia"],
    since: "1907-08-31",
    terms: L(
      "Persia divided into a Russian north, a British south and a neutral middle; Afghanistan in Britain's sphere, Tibet left to China.",
      "Персия поделена на русский север, британский юг и нейтральную середину; Афганистан — в британской сфере, Тибет оставлен Китаю.",
      "Персію поділено на російську північ, британський південь і нейтральну середину; Афганістан — у британській сфері, Тибет залишено Китаю.",
    ),
  },
  {
    id: "london-1839",
    kind: "pact",
    name: L("Treaty of London (1839)", "Лондонский договор 1839 года", "Лондонський договір 1839 року"),
    members: ["belgium", "uk", "france", "germany", "austria-hungary", "russia", "netherlands"],
    since: "1839-04-19",
    terms: L(
      "The great powers guarantee Belgium's independence and perpetual neutrality; Prussia signed, so Germany is bound by it.",
      "Великие державы гарантируют независимость и вечный нейтралитет Бельгии; Пруссия подписала — значит, связана и Германия.",
      "Великі держави гарантують незалежність і вічний нейтралітет Бельгії; Пруссія підписала — отже, пов'язана й Німеччина.",
    ),
  },
  {
    id: "dual-alliance",
    name: L("Dual Alliance", "Двойственный союз", "Подвійний союз"),
    members: ["germany", "austria-hungary"],
    since: "1879-10-07",
    terms: L(
      "If Russia attacks either, the other comes to its aid with all its forces; if another power attacks, the ally at least stays neutral. The core of the Triple Alliance.",
      "Если Россия нападёт на одну из сторон, другая приходит на помощь всеми силами; если нападёт другая держава — союзник по меньшей мере сохраняет нейтралитет. Ядро Тройственного союза.",
      "Якщо Росія нападе на одну зі сторін, інша приходить на допомогу всіма силами; якщо нападе інша держава — союзник щонайменше зберігає нейтралітет. Ядро Троїстого союзу.",
    ),
  },
  {
    id: "romania-secret",
    name: L("Romania's secret alliance", "Тайный союз Румынии с Центральными державами", "Таємний союз Румунії з Центральними державами"),
    members: ["romania", "austria-hungary", "germany"],
    since: "1883-10-30",
    terms: L(
      "Romania is secretly bound to the Triple Alliance (renewed in 1913) — known only to the king and a few ministers, while the public wants Transylvania from Austria-Hungary.",
      "Румыния тайно связана с Тройственным союзом (продлено в 1913 году) — об этом знают лишь король и несколько министров, а общество мечтает отнять у Австро-Венгрии Трансильванию.",
      "Румунія таємно пов'язана з Троїстим союзом (продовжено 1913 року) — про це знають лише король і кілька міністрів, а суспільство мріє відібрати в Австро-Угорщини Трансильванію.",
    ),
  },
  {
    id: "serbo-greek",
    name: L("Serbo-Greek Alliance", "Сербско-греческий союз", "Сербсько-грецький союз"),
    members: ["serbia", "greece"],
    since: "1913-06-01",
    terms: L(
      "Mutual defence against an attack by Bulgaria, made before the Second Balkan War; Greece reads it as not binding if a great power attacks Serbia.",
      "Взаимная оборона на случай нападения Болгарии, заключена перед Второй Балканской войной; Греция считает, что он не обязывает её, если на Сербию нападёт великая держава.",
      "Взаємна оборона на випадок нападу Болгарії, укладена перед Другою балканською війною; Греція вважає, що він не зобов'язує її, якщо на Сербію нападе велика держава.",
    ),
  },
  {
    id: "bucharest-1913",
    kind: "pact",
    name: L("Treaty of Bucharest (1913)", "Бухарестский мир 1913 года", "Бухарестський мир 1913 року"),
    members: ["romania", "serbia", "greece", "montenegro", "bulgaria"],
    since: "1913-08-10",
    terms: L(
      "Ended the Second Balkan War: Bulgaria lost most of Macedonia to Serbia and Greece and Southern Dobruja to Romania, and wants them back.",
      "Закончил Вторую Балканскую войну: Болгария потеряла большую часть Македонии в пользу Сербии и Греции и Южную Добруджу в пользу Румынии — и хочет их вернуть.",
      "Завершив Другу балканську війну: Болгарія втратила більшу частину Македонії на користь Сербії та Греції й Південну Добруджу на користь Румунії — і хоче їх повернути.",
    ),
  },
  {
    id: "franco-italian",
    kind: "pact",
    name: L("Franco-Italian Agreement (1902)", "Франко-итальянское соглашение 1902 года", "Франко-італійська угода 1902 року"),
    members: ["france", "italy"],
    since: "1902-11-01",
    terms: L(
      "A secret promise: Italy stays neutral if France is attacked, or goes to war after a provocation — which hollows out its place in the Triple Alliance.",
      "Тайное обещание: Италия сохранит нейтралитет, если на Францию нападут или если Франция начнёт войну после провокации, — это выхолащивает её место в Тройственном союзе.",
      "Таємна обіцянка: Італія збереже нейтралітет, якщо на Францію нападуть або якщо Франція почне війну після провокації, — це вихолощує її місце в Троїстому союзі.",
    ),
  },
  {
    id: "russo-japanese",
    kind: "pact",
    name: L("Russo-Japanese agreements", "Русско-японские соглашения", "Російсько-японські угоди"),
    members: ["russia", "japan"],
    since: "1907-07-30",
    terms: L(
      "After the war of 1904–05 the old enemies divided Manchuria and Inner Mongolia into spheres — the north to Russia, the south to Japan (1907, 1910, 1912).",
      "После войны 1904–1905 годов бывшие враги поделили Маньчжурию и Внутреннюю Монголию на сферы: север — России, юг — Японии (1907, 1910, 1912).",
      "Після війни 1904–1905 років колишні вороги поділили Маньчжурію та Внутрішню Монголію на сфери: північ — Росії, південь — Японії (1907, 1910, 1912).",
    ),
  },
  angloPortuguese(NONE),
];

// ---- 25 June 1950

export const TERMS_1950: Record<string, Localized> = {
  un: L(
    "The Charter of 1945: no force against another state's territory; only the Security Council can order sanctions or force. China's seat and veto are held by the Republic of China on Taiwan; the Soviet Union has boycotted the Council since January in protest, so it cannot veto.",
    "Устав 1945 года: запрет силы против территории другого государства; только Совет Безопасности может ввести санкции или применить силу. Место и вето Китая — у Китайской Республики на Тайване; Советский Союз с января бойкотирует Совет в знак протеста и потому не может наложить вето.",
    "Статут 1945 року: заборона сили проти території іншої держави; лише Рада Безпеки може запровадити санкції чи застосувати силу. Місце й вето Китаю — у Китайської Республіки на Тайвані; Радянський Союз із січня бойкотує Раду на знак протесту, тож не може накласти вето.",
  ),
  nato: L(
    "Article 5 (April 1949): an armed attack on one member in Europe or North America is an attack on all. It has no integrated command yet and few divisions; America's bomb is its shield.",
    "Статья 5 (апрель 1949): вооружённое нападение на одного члена в Европе или Северной Америке — нападение на всех. Объединённого командования ещё нет, дивизий мало; щит союза — американская бомба.",
    "Стаття 5 (квітень 1949): збройний напад на одного члена в Європі чи Північній Америці — напад на всіх. Об'єднаного командування ще немає, дивізій мало; щит союзу — американська бомба.",
  ),
  "sino-soviet": L(
    "Signed in Moscow in February 1950 for thirty years: military aid if Japan or a state allied with it attacks either; a $300 million Soviet credit; the Soviet Union keeps Port Arthur and the Manchurian railway until 1952.",
    "Подписан в Москве в феврале 1950 года на тридцать лет: военная помощь, если Япония или союзное ей государство нападёт на одну из сторон; советский кредит в 300 миллионов долларов; СССР сохраняет Порт-Артур и КВЖД до 1952 года.",
    "Підписаний у Москві в лютому 1950 року на тридцять років: військова допомога, якщо Японія чи союзна їй держава нападе на одну зі сторін; радянський кредит у 300 мільйонів доларів; СРСР зберігає Порт-Артур і КСЗ до 1952 року.",
  ),
};

const RIO_1950 = [
  "usa", "mexico", "cuba", "haiti", "dominican-republic", "guatemala", "honduras", "el-salvador", "nicaragua", "costa-rica", "panama",
  "colombia", "venezuela", "ecuador", "peru", "brazil", "bolivia", "paraguay", "chile", "argentina", "uruguay",
];

export const TREATIES_1950: AllianceSeed[] = [
  {
    id: "brussels-treaty",
    name: L("Western Union (Brussels Treaty)", "Западный союз (Брюссельский договор)", "Західний союз (Брюссельський договір)"),
    members: ["uk", "france", "belgium", "netherlands", "luxembourg"],
    since: "1948-03-17",
    terms: L(
      "Article IV: all the military aid in their power to a member attacked in Europe. Its staff under Field Marshal Montgomery at Fontainebleau is passing into NATO.",
      "Статья IV: вся возможная военная помощь члену, подвергшемуся нападению в Европе. Его штаб под началом фельдмаршала Монтгомери в Фонтенбло переходит в НАТО.",
      "Стаття IV: уся можлива військова допомога члену, на якого напали в Європі. Його штаб під орудою фельдмаршала Монтгомері у Фонтенбло переходить до НАТО.",
    ),
  },
  {
    id: "oeec",
    kind: "trade",
    name: L("OEEC (Marshall Plan)", "ОЕЭС (план Маршалла)", "ОЄЕС (план Маршалла)"),
    members: ["austria", "belgium", "denmark", "france", "greece", "iceland", "ireland", "italy", "luxembourg", "netherlands", "norway", "portugal", "sweden", "switzerland", "turkey", "uk", "west-germany"],
    since: "1948-04-16",
    terms: L(
      "Shares out the American Marshall Plan — some $13 billion over four years — and lowers trade barriers among its members; a European Payments Union starts in July.",
      "Распределяет американский план Маршалла — около 13 миллиардов долларов за четыре года — и снижает торговые барьеры между членами; в июле начинает работу Европейский платёжный союз.",
      "Розподіляє американський план Маршалла — близько 13 мільярдів доларів за чотири роки — і знижує торговельні бар'єри між членами; у липні починає роботу Європейський платіжний союз.",
    ),
  },
  coe(
    ["belgium", "denmark", "france", "ireland", "italy", "luxembourg", "netherlands", "norway", "sweden", "uk", "greece", "turkey", "iceland"],
    L(
      "Founded in London in May 1949 for democracy and human rights; its Convention on Human Rights is being drafted. West Germany is to join as an associate.",
      "Основан в Лондоне в мае 1949 года ради демократии и прав человека; его Конвенция о правах человека в работе. Западная Германия вступает как ассоциированный член.",
      "Заснована в Лондоні в травні 1949 року задля демократії та прав людини; її Конвенція з прав людини в роботі. Західна Німеччина вступає як асоційований член.",
    ),
  ),
  {
    id: "comecon",
    kind: "trade",
    name: L("Comecon", "СЭВ", "РЕВ"),
    members: ["ussr", "poland", "czechoslovakia", "hungary", "romania", "bulgaria", "albania"],
    since: "1949-01-25",
    terms: L(
      "Moscow's answer to the Marshall Plan: trade within the bloc on Soviet terms. The Soviet Union also takes reparations and runs joint companies in East Germany, Hungary and Romania.",
      "Ответ Москвы на план Маршалла: торговля внутри блока на советских условиях. СССР к тому же берёт репарации и управляет смешанными обществами в ГДР, Венгрии и Румынии.",
      "Відповідь Москви на план Маршалла: торгівля всередині блоку на радянських умовах. СРСР до того ж бере репарації та керує спільними товариствами в НДР, Угорщині й Румунії.",
    ),
  },
  {
    id: "soviet-bloc",
    name: L("Soviet treaties of friendship and mutual aid", "Советские договоры о дружбе и взаимопомощи", "Радянські договори про дружбу та взаємодопомогу"),
    members: ["ussr", "poland", "czechoslovakia", "hungary", "romania", "bulgaria"],
    since: "1943-12-12",
    terms: L(
      "Bilateral treaties of 1943–48: mutual aid against Germany or any state allied with it. Soviet troops stay in Poland, Hungary, Romania and East Germany.",
      "Двусторонние договоры 1943–1948 годов: взаимная помощь против Германии или любого её союзника. Советские войска остаются в Польше, Венгрии, Румынии и Восточной Германии.",
      "Двосторонні договори 1943–1948 років: взаємна допомога проти Німеччини чи будь-якого її союзника. Радянські війська залишаються в Польщі, Угорщині, Румунії та Східній Німеччині.",
    ),
  },
  {
    id: "finno-soviet",
    kind: "pact",
    name: L("Finno-Soviet Treaty of 1948", "Советско-финляндский договор 1948 года", "Радянсько-фінляндський договір 1948 року"),
    members: ["finland", "ussr"],
    since: "1948-04-06",
    terms: L(
      "Finland must resist an attack on the Soviet Union across its territory, with Soviet help if needed, and stays out of the blocs; the Soviet Union leases the Porkkala base near Helsinki.",
      "Финляндия обязана отражать нападение на СССР через свою территорию, при необходимости с советской помощью, и остаётся вне блоков; СССР арендует базу Порккала под Хельсинки.",
      "Фінляндія зобов'язана відбивати напад на СРСР через свою територію, за потреби з радянською допомогою, і залишається поза блоками; СРСР орендує базу Порккала під Гельсінкі.",
    ),
  },
  {
    id: "occupation",
    kind: "pact",
    name: L("Four-power occupation of Germany and Austria", "Оккупация Германии и Австрии четырьмя державами", "Окупація Німеччини та Австрії чотирма державами"),
    members: ["usa", "ussr", "uk", "france"],
    since: "1945-06-05",
    terms: L(
      "The victors keep occupation rights in both Germanies, Berlin and Austria; Western High Commissioners can overrule the Federal Republic, Soviet officers the GDR. Western access to Berlin by road and air was restored in May 1949.",
      "Победители сохраняют права оккупантов в обеих Германиях, Берлине и Австрии; западные верховные комиссары могут отменять решения ФРГ, советские офицеры — ГДР. Доступ Запада в Берлин по дорогам и воздуху восстановлен в мае 1949 года.",
      "Переможці зберігають права окупантів в обох Німеччинах, Берліні та Австрії; західні верховні комісари можуть скасовувати рішення ФРН, радянські офіцери — НДР. Доступ Заходу до Берліна дорогами й повітрям відновлено в травні 1949 року.",
    ),
  },
  {
    id: "japan-occupation",
    kind: "pact",
    name: L("Occupation of Japan", "Оккупация Японии", "Окупація Японії"),
    members: ["usa", "japan"],
    since: "1945-09-02",
    terms: L(
      "Japan is governed under General MacArthur, Supreme Commander for the Allied Powers; its 1947 constitution renounces war and armed forces (Article 9). A peace treaty and a security pact are being negotiated.",
      "Япония управляется под началом генерала Макартура, Верховного командующего союзных держав; её конституция 1947 года отказывается от войны и вооружённых сил (статья 9). Идут переговоры о мирном договоре и договоре о безопасности.",
      "Японія управляється під орудою генерала Макартура, Верховного командувача союзних держав; її конституція 1947 року відмовляється від війни та збройних сил (стаття 9). Тривають переговори про мирний договір і договір про безпеку.",
    ),
  },
  {
    id: "french-union",
    kind: "organization",
    name: L("French Union", "Французский союз", "Французький союз"),
    members: ["france", "vietnam", "laos", "cambodia"],
    since: "1946-10-27",
    terms: L(
      "The associated states of Indochina have their own governments, but France keeps their armies, foreign policy and much of their economy, and fights the Viet Minh in their name.",
      "Ассоциированные государства Индокитая имеют свои правительства, но Франция ведает их армиями, внешней политикой и значительной частью экономики и воюет с Вьетминем от их имени.",
      "Асоційовані держави Індокитаю мають свої уряди, але Франція відає їхніми арміями, зовнішньою політикою та значною частиною економіки й воює з В'єтміном від їхнього імені.",
    ),
  },
  {
    id: "commonwealth",
    kind: "organization",
    name: L("Commonwealth of Nations", "Содружество наций", "Співдружність націй"),
    members: ["uk", "canada", "australia", "new-zealand", "south-africa", "india", "pakistan", "ceylon"],
    since: "1931-12-11",
    terms: L(
      "Britain's former dominions; India stays in as a republic under the London Declaration of 1949. No duty to fight for each other, but the sterling area and imperial preference bind their trade.",
      "Бывшие британские доминионы; Индия остаётся в нём как республика по Лондонской декларации 1949 года. Обязанности воевать друг за друга нет, но торговлю связывают стерлинговая зона и имперские преференции.",
      "Колишні британські домініони; Індія залишається в ній як республіка за Лондонською декларацією 1949 року. Обов'язку воювати одне за одного немає, але торгівлю пов'язують стерлінгова зона та імперські преференції.",
    ),
  },
  {
    id: "anglo-egyptian",
    kind: "pact",
    name: L("Anglo-Egyptian Treaty of 1936", "Англо-египетский договор 1936 года", "Англо-єгипетський договір 1936 року"),
    members: ["uk", "egypt"],
    since: "1936-08-26",
    terms: L(
      "Britain may keep 10,000 troops in the Suez Canal Zone until 1956 — in fact it keeps far more; Egypt wants them gone and claims the Sudan.",
      "Британия может держать 10 тысяч солдат в зоне Суэцкого канала до 1956 года — на деле держит куда больше; Египет требует их ухода и претендует на Судан.",
      "Британія може тримати 10 тисяч солдатів у зоні Суецького каналу до 1956 року — насправді тримає значно більше; Єгипет вимагає їхнього виходу й претендує на Судан.",
    ),
  },
  {
    id: "tripartite-declaration",
    kind: "pact",
    name: L("Tripartite Declaration", "Трёхсторонняя декларация", "Тристороння декларація"),
    members: ["usa", "uk", "france"],
    since: "1950-05-25",
    terms: L(
      "The three powers ration arms to Israel and the Arab states and will act against any attempt to change the 1949 armistice lines by force.",
      "Три державы дозируют поставки оружия Израилю и арабским странам и выступят против любой попытки силой изменить линии перемирия 1949 года.",
      "Три держави дозують постачання зброї Ізраїлю та арабським країнам і виступлять проти будь-якої спроби силою змінити лінії перемир'я 1949 року.",
    ),
  },
  arabLeague(
    ["egypt", "iraq", "jordan", "lebanon", "saudi-arabia", "syria", "yemen"],
    L(
      "Defeated in Palestine in 1948–49 and divided over Jordan's annexation of the West Bank; a treaty of joint defence was signed in April 1950.",
      "Потерпела поражение в Палестине в 1948–1949 годах и расколота аннексией Западного берега Иорданией; в апреле 1950 года подписан договор о совместной обороне.",
      "Зазнала поразки в Палестині 1948–1949 років і розколота анексією Західного берега Йорданією; у квітні 1950 року підписано договір про спільну оборону.",
    ),
  ),
  {
    id: "rio-pact",
    name: L("Rio Pact", "Пакт Рио", "Пакт Ріо"),
    members: RIO_1950,
    since: "1947-09-02",
    terms: L(
      "An armed attack on one American state is an attack on all; joint measures need two thirds of the members. The Organization of American States (1948) is its political body.",
      "Вооружённое нападение на одно американское государство — нападение на всех; совместные меры требуют двух третей членов. Организация американских государств (1948) — его политический орган.",
      "Збройний напад на одну американську державу — напад на всіх; спільні заходи потребують двох третин членів. Організація американських держав (1948) — його політичний орган.",
    ),
  },
  {
    ...montreuxModern,
    members: ["turkey", "uk", "france", "ussr", "bulgaria", "romania", "greece", "yugoslavia", "japan", "australia"],
  },
  angloPortuguese(
    L(
      " Portugal let the Allies use the Azores in the war and joined NATO in 1949.",
      " Португалия дала союзникам Азорские острова во время войны и в 1949 году вступила в НАТО.",
      " Португалія надала союзникам Азорські острови під час війни й 1949 року вступила до НАТО.",
    ),
  ),
];

// ---- 2 August 1964

export const TERMS_1964: Record<string, Localized> = {
  un: L(
    "The Charter of 1945; the Republic of China on Taiwan still holds China's seat and veto. UN troops keep the peace in Cyprus and on the Israeli–Egyptian line and are leaving the Congo.",
    "Устав 1945 года; место и вето Китая по-прежнему у Китайской Республики на Тайване. Войска ООН поддерживают мир на Кипре и на египетско-израильской линии и уходят из Конго.",
    "Статут 1945 року; місце й вето Китаю досі в Китайської Республіки на Тайвані. Війська ООН підтримують мир на Кіпрі та на єгипетсько-ізраїльській лінії і виходять із Конго.",
  ),
  nato: L(
    "Article 5: an attack on one member in Europe or North America is an attack on all. Its strategy is still massive nuclear retaliation, moving to 'flexible response'; de Gaulle is pulling France's fleet out of its command.",
    "Статья 5: нападение на одного члена в Европе или Северной Америке — нападение на всех. Стратегия — по-прежнему массированный ядерный удар, на смену идёт «гибкое реагирование»; де Голль выводит французский флот из-под командования альянса.",
    "Стаття 5: напад на одного члена в Європі чи Північній Америці — напад на всіх. Стратегія — досі масований ядерний удар, на зміну йде «гнучке реагування»; де Голль виводить французький флот з-під командування альянсу.",
  ),
  "warsaw-pact": L(
    "Mutual defence under a Soviet unified command; Soviet troops are stationed in East Germany, Poland and Hungary. Albania, siding with China, has stopped taking part since 1961.",
    "Взаимная оборона под единым советским командованием; советские войска стоят в ГДР, Польше и Венгрии. Албания, вставшая на сторону Китая, с 1961 года в работе не участвует.",
    "Взаємна оборона під єдиним радянським командуванням; радянські війська стоять у НДР, Польщі та Угорщині. Албанія, що стала на бік Китаю, з 1961 року в роботі не бере участі.",
  ),
};

export const TREATIES_1964: AllianceSeed[] = [
  {
    id: "seato",
    name: L("SEATO", "СЕАТО", "СЕАТО"),
    members: ["usa", "uk", "france", "australia", "new-zealand", "pakistan", "philippines", "thailand"],
    since: "1955-02-19",
    terms: L(
      "Article IV: each member acts against aggression in Southeast Asia 'in accordance with its constitutional processes'. A protocol extends its protection to South Vietnam, Laos and Cambodia; Cambodia has refused it, France and Pakistan are lukewarm.",
      "Статья IV: каждый член действует против агрессии в Юго-Восточной Азии «в соответствии со своими конституционными процедурами». Протокол распространяет защиту на Южный Вьетнам, Лаос и Камбоджу; Камбоджа от неё отказалась, Франция и Пакистан охладели.",
      "Стаття IV: кожен член діє проти агресії в Південно-Східній Азії «відповідно до своїх конституційних процедур». Протокол поширює захист на Південний В'єтнам, Лаос і Камбоджу; Камбоджа від нього відмовилася, Франція й Пакистан охололи.",
    ),
  },
  {
    id: "cento",
    name: L("CENTO", "СЕНТО", "СЕНТО"),
    members: ["uk", "turkey", "iran", "pakistan"],
    since: "1959-08-21",
    terms: L(
      "The Baghdad Pact without Iraq, which left after its revolution: mutual co-operation for defence along the Soviet Union's southern flank. The US is an associate bound by bilateral agreements.",
      "Багдадский пакт без Ирака, вышедшего после революции: сотрудничество в обороне вдоль южного фланга СССР. США — ассоциированный участник, связанный двусторонними соглашениями.",
      "Багдадський пакт без Іраку, що вийшов після революції: співпраця в обороні вздовж південного флангу СРСР. США — асоційований учасник, пов'язаний двосторонніми угодами.",
    ),
  },
  {
    id: "anzus",
    name: L("ANZUS", "АНЗЮС", "АНЗЮС"),
    members: ["usa", "australia", "new-zealand"],
    since: "1952-04-29",
    terms: L(
      "Australia, New Zealand and the US act together against a common danger in the Pacific; Australia expects it to cover Borneo against Indonesia.",
      "Австралия, Новая Зеландия и США действуют вместе против общей опасности на Тихом океане; Австралия рассчитывает, что он прикроет Борнео от Индонезии.",
      "Австралія, Нова Зеландія та США діють разом проти спільної небезпеки на Тихому океані; Австралія розраховує, що він прикриє Борнео від Індонезії.",
    ),
  },
  usJapan("46,000"),
  usKorea("63,000"),
  {
    id: "us-roc",
    name: L("US–Republic of China Mutual Defense Treaty", "Американо-тайваньский договор о взаимной обороне", "Американо-тайванський договір про взаємну оборону"),
    members: ["usa", "taiwan"],
    since: "1954-12-02",
    terms: L(
      "The US defends Taiwan and the Pescadores; the Seventh Fleet patrols the strait. Kinmen and Matsu are covered only by the Formosa Resolution of 1955.",
      "США защищают Тайвань и Пэнхуледао; Седьмой флот патрулирует пролив. Цзиньмэнь и Мацзу прикрыты лишь Формозской резолюцией 1955 года.",
      "США захищають Тайвань і Пенху; Сьомий флот патрулює протоку. Цзіньмень і Мацзу прикриті лише Формозькою резолюцією 1955 року.",
    ),
  },
  {
    id: "us-philippines",
    name: L("US–Philippines Mutual Defense Treaty", "Договор о взаимной обороне США и Филиппин", "Договір про взаємну оборону США та Філіппін"),
    members: ["usa", "philippines"],
    since: "1951-08-30",
    terms: L(
      "Mutual defence in the Pacific; the US keeps Clark Air Base and the naval base at Subic Bay.",
      "Взаимная оборона на Тихом океане; США сохраняют авиабазу Кларк и военно-морскую базу в Субик-Бей.",
      "Взаємна оборона на Тихому океані; США зберігають авіабазу Кларк і військово-морську базу в Субік-Бей.",
    ),
  },
  chinaDprk,
  {
    id: "ussr-dprk",
    name: L("Soviet–North Korean Treaty of Friendship", "Советско-корейский договор о дружбе", "Радянсько-корейський договір про дружбу"),
    members: ["ussr", "north-korea"],
    since: "1961-07-06",
    terms: L(
      "Immediate military aid if either is attacked. Pyongyang plays Moscow and Beijing against each other and leans to Beijing.",
      "Немедленная военная помощь при нападении на одну из сторон. Пхеньян играет на противоречиях Москвы и Пекина и склоняется к Пекину.",
      "Негайна військова допомога в разі нападу на одну зі сторін. Пхеньян грає на суперечностях Москви та Пекіна й схиляється до Пекіна.",
    ),
  },
  {
    id: "sino-soviet",
    name: L("Sino-Soviet Treaty of Friendship", "Советско-китайский договор о дружбе", "Радянсько-китайський договір про дружбу"),
    members: ["ussr", "china"],
    since: "1950-02-14",
    terms: L(
      "In force in name only: the split is open since 1960, Soviet experts have gone home, and the two parties trade public insults.",
      "Действует лишь на бумаге: раскол открыт с 1960 года, советские специалисты уехали, а партии обмениваются публичными оскорблениями.",
      "Діє лише на папері: розкол відкритий з 1960 року, радянські фахівці поїхали, а партії обмінюються публічними образами.",
    ),
  },
  {
    id: "geneva-1954",
    kind: "pact",
    name: L("Geneva Accords on Indochina", "Женевские соглашения по Индокитаю", "Женевські угоди щодо Індокитаю"),
    members: ["north-vietnam", "france", "uk", "ussr", "china", "laos", "cambodia"],
    since: "1954-07-21",
    terms: L(
      "Vietnam divided at the 17th parallel pending elections in 1956, which never took place; no new foreign troops or bases in Indochina. An international commission of India, Poland and Canada watches; Saigon and Washington did not sign.",
      "Вьетнам разделён по 17-й параллели до выборов 1956 года, которые так и не прошли; никаких новых иностранных войск и баз в Индокитае. Следит международная комиссия Индии, Польши и Канады; Сайгон и Вашингтон соглашения не подписали.",
      "В'єтнам поділено по 17-й паралелі до виборів 1956 року, які так і не відбулися; жодних нових іноземних військ і баз в Індокитаї. Стежить міжнародна комісія Індії, Польщі та Канади; Сайгон і Вашингтон угод не підписали.",
    ),
  },
  {
    id: "geneva-laos",
    kind: "pact",
    name: L("Geneva Agreement on Laos", "Женевское соглашение по Лаосу", "Женевська угода щодо Лаосу"),
    members: ["laos", "usa", "ussr", "china", "uk", "france", "north-vietnam", "south-vietnam", "thailand", "burma", "cambodia", "india", "poland", "canada"],
    since: "1962-07-23",
    terms: L(
      "Laos neutral under a coalition government; all foreign troops to leave and none to use its territory. North Vietnam's troops never left, and the Trail runs through it.",
      "Лаос нейтрален под коалиционным правительством; все иностранные войска уходят, и никто не использует его территорию. Северовьетнамские войска так и не ушли, через страну идёт «тропа».",
      "Лаос нейтральний під коаліційним урядом; усі іноземні війська виходять, і ніхто не використовує його територію. Північнов'єтнамські війська так і не вийшли, країною йде «стежка».",
    ),
  },
  {
    id: "test-ban",
    kind: "pact",
    name: L("Partial Test Ban Treaty", "Договор о запрещении ядерных испытаний в трёх средах", "Договір про заборону ядерних випробувань у трьох середовищах"),
    members: ["usa", "uk", "ussr", "west-germany", "japan", "india", "italy", "canada", "australia", "yugoslavia", "poland", "czechoslovakia", "hungary", "romania", "bulgaria", "east-germany", "egypt", "israel", "mexico", "brazil"],
    since: "1963-08-05",
    terms: L(
      "No nuclear tests in the atmosphere, in space or under water; underground tests go on. France and China have not signed, and China is preparing its first test.",
      "Никаких ядерных испытаний в атмосфере, космосе и под водой; подземные продолжаются. Франция и Китай не подписали, Китай готовит своё первое испытание.",
      "Жодних ядерних випробувань в атмосфері, космосі та під водою; підземні тривають. Франція й Китай не підписали, Китай готує своє перше випробування.",
    ),
  },
  {
    id: "berlin",
    kind: "pact",
    name: L("Four-power status of Berlin", "Четырёхсторонний статус Берлина", "Чотиристоронній статус Берліна"),
    members: ["usa", "ussr", "uk", "france"],
    since: "1945-06-05",
    terms: L(
      "The four powers keep their rights over Berlin; the Wall has cut the city since August 1961. West Berlin, an enclave of the West the map draws with the GDR, is reached by three air corridors and the transit roads.",
      "Четыре державы сохраняют права в Берлине; с августа 1961 года город разрезан Стеной. Западный Берлин — анклав Запада, который карта рисует в составе ГДР, — связан с ним тремя воздушными коридорами и транзитными дорогами.",
      "Чотири держави зберігають права в Берліні; з серпня 1961 року місто розрізане Стіною. Західний Берлін — анклав Заходу, який мапа малює у складі НДР, — пов'язаний із ним трьома повітряними коридорами та транзитними дорогами.",
    ),
  },
  {
    id: "eec",
    kind: "trade",
    name: L("European Economic Community", "Европейское экономическое сообщество", "Європейська економічна спільнота"),
    members: ["france", "west-germany", "italy", "netherlands", "belgium", "luxembourg"],
    since: "1958-01-01",
    terms: L(
      "A customs union of the Six, complete by 1968, with a common farm policy since 1962. De Gaulle vetoed Britain's entry in January 1963.",
      "Таможенный союз шести стран, который будет завершён к 1968 году, с общей аграрной политикой с 1962 года. В январе 1963 года де Голль заблокировал вступление Британии.",
      "Митний союз шести країн, який буде завершено до 1968 року, зі спільною аграрною політикою з 1962 року. У січні 1963 року де Голль заблокував вступ Британії.",
    ),
  },
  {
    id: "efta",
    kind: "trade",
    name: L("EFTA", "Европейская ассоциация свободной торговли", "Європейська асоціація вільної торгівлі"),
    members: ["uk", "sweden", "norway", "denmark", "austria", "switzerland", "portugal"],
    since: "1960-05-03",
    terms: L(
      "Free trade in industrial goods among the Seven, Britain's answer to the Common Market.",
      "Свободная торговля промышленными товарами между «семёркой» — ответ Британии на Общий рынок.",
      "Вільна торгівля промисловими товарами між «сімкою» — відповідь Британії на Спільний ринок.",
    ),
  },
  {
    id: "comecon",
    kind: "trade",
    name: L("Comecon", "СЭВ", "РЕВ"),
    members: ["ussr", "poland", "czechoslovakia", "hungary", "romania", "bulgaria", "east-germany", "mongolia"],
    since: "1949-01-25",
    terms: L(
      "The Soviet bloc's division of labour; Romania refused in April 1964 to be its granary and declared its own course.",
      "Разделение труда в советском блоке; в апреле 1964 года Румыния отказалась быть его житницей и объявила о собственном курсе.",
      "Поділ праці в радянському блоці; у квітні 1964 року Румунія відмовилася бути його житницею й оголосила власний курс.",
    ),
  },
  {
    id: "elysee",
    kind: "pact",
    name: L("Élysée Treaty", "Елисейский договор", "Єлисейський договір"),
    members: ["france", "west-germany"],
    since: "1963-01-22",
    terms: L(
      "Franco-German friendship: regular consultations on foreign policy and defence, youth exchanges; the Bundestag added a preamble binding Bonn to NATO and Washington.",
      "Франко-германская дружба: регулярные консультации по внешней политике и обороне, молодёжные обмены; бундестаг добавил преамбулу, привязывающую Бонн к НАТО и Вашингтону.",
      "Франко-німецька дружба: регулярні консультації щодо зовнішньої політики й оборони, молодіжні обміни; бундестаг додав преамбулу, що прив'язує Бонн до НАТО й Вашингтона.",
    ),
  },
  {
    id: "cyprus-guarantee",
    kind: "pact",
    name: L("Treaty of Guarantee (Cyprus)", "Договор о гарантиях (Кипр)", "Договір про гарантії (Кіпр)"),
    members: ["cyprus", "uk", "greece", "turkey"],
    since: "1960-08-16",
    terms: L(
      "Britain, Greece and Turkey guarantee Cyprus's independence and constitution and may act, together or alone, to restore them. The constitution broke down in December 1963; Turkey has threatened to land.",
      "Британия, Греция и Турция гарантируют независимость и конституцию Кипра и могут действовать, вместе или по отдельности, чтобы их восстановить. Конституция рухнула в декабре 1963 года; Турция грозила высадкой.",
      "Британія, Греція й Туреччина гарантують незалежність і конституцію Кіпру й можуть діяти, разом чи окремо, щоб їх відновити. Конституція впала в грудні 1963 року; Туреччина погрожувала висадкою.",
    ),
  },
  {
    id: "rio-pact",
    name: L("Rio Pact", "Пакт Рио", "Пакт Ріо"),
    members: RIO_1950.filter((m) => m !== "cuba"),
    since: "1947-09-02",
    terms: L(
      "An attack on one American state is an attack on all. Cuba was expelled from the OAS in 1962; in July 1964 the OAS voted to break relations and trade with it.",
      "Нападение на одно американское государство — нападение на всех. Куба исключена из ОАГ в 1962 году; в июле 1964 года ОАГ решила разорвать с ней отношения и торговлю.",
      "Напад на одну американську державу — напад на всіх. Кубу виключено з ОАД 1962 року; у липні 1964 року ОАД вирішила розірвати з нею відносини й торгівлю.",
    ),
  },
  arabLeague(
    ["egypt", "iraq", "jordan", "lebanon", "saudi-arabia", "syria", "yemen", "libya", "sudan", "morocco", "tunisia", "kuwait", "algeria"],
    L(
      "Nasser's stage: the Cairo summit of January 1964 set up a joint command against Israel and founded the PLO; Egypt and Saudi Arabia fight a proxy war in Yemen.",
      "Сцена Насера: Каирский саммит в январе 1964 года создал объединённое командование против Израиля и основал ООП; Египет и Саудовская Аравия ведут войну чужими руками в Йемене.",
      "Сцена Насера: Каїрський саміт у січні 1964 року створив об'єднане командування проти Ізраїлю й заснував ОВП; Єгипет і Саудівська Аравія ведуть війну чужими руками в Ємені.",
    ),
  ),
  {
    id: "oau",
    kind: "organization",
    name: L("Organisation of African Unity", "Организация африканского единства", "Організація африканської єдності"),
    members: [
      "algeria", "benin", "burkina-faso", "burundi", "cameroon", "central-african-republic", "chad", "congo", "dr-congo", "egypt", "ethiopia",
      "gabon", "ghana", "guinea", "ivory-coast", "kenya", "liberia", "libya", "madagascar", "malawi", "mali", "mauritania", "morocco", "niger",
      "nigeria", "rwanda", "senegal", "sierra-leone", "somalia", "sudan", "tanzania", "togo", "tunisia", "uganda",
    ],
    since: "1963-05-25",
    terms: L(
      "Founded in Addis Ababa in 1963: the colonial borders are untouchable (Cairo, July 1964); it backs the liberation movements against Portugal, Rhodesia and South Africa.",
      "Основана в Аддис-Абебе в 1963 году: колониальные границы неприкосновенны (Каир, июль 1964); поддерживает освободительные движения против Португалии, Родезии и ЮАР.",
      "Заснована в Аддис-Абебі 1963 року: колоніальні кордони недоторканні (Каїр, липень 1964); підтримує визвольні рухи проти Португалії, Родезії та ПАР.",
    ),
  },
  {
    id: "non-aligned",
    kind: "organization",
    name: L("Non-Aligned Movement", "Движение неприсоединения", "Рух неприєднання"),
    members: [
      "yugoslavia", "india", "egypt", "indonesia", "ghana", "afghanistan", "algeria", "burma", "cambodia", "ceylon", "cuba", "cyprus",
      "ethiopia", "guinea", "iraq", "lebanon", "mali", "morocco", "nepal", "saudi-arabia", "somalia", "sudan", "tunisia", "yemen",
    ],
    since: "1961-09-01",
    terms: L(
      "Tito, Nehru, Nasser, Sukarno and Nkrumah's club outside both blocs; no obligations. Its second summit meets in Cairo in October.",
      "Клуб Тито, Неру, Насера, Сукарно и Нкрумы вне обоих блоков; обязательств нет. Второй саммит соберётся в Каире в октябре.",
      "Клуб Тіто, Неру, Насера, Сукарно й Нкруми поза обома блоками; зобов'язань немає. Другий саміт збереться в Каїрі в жовтні.",
    ),
  },
  opec(
    ["iran", "iraq", "kuwait", "saudi-arabia", "venezuela", "indonesia", "libya"],
    L(
      "Founded in Baghdad in 1960 to stop the oil companies cutting the posted price; it has not yet set output.",
      "Основана в Багдаде в 1960 году, чтобы не дать нефтяным компаниям снижать справочные цены; квот на добычу пока не устанавливает.",
      "Заснована в Багдаді 1960 року, щоб не дати нафтовим компаніям знижувати довідкові ціни; квот на видобуток поки не встановлює.",
    ),
  ),
  {
    id: "commonwealth",
    kind: "organization",
    name: L("Commonwealth of Nations", "Содружество наций", "Співдружність націй"),
    members: [
      "uk", "canada", "australia", "new-zealand", "india", "pakistan", "ceylon", "ghana", "malaysia", "nigeria", "cyprus", "sierra-leone",
      "tanzania", "jamaica", "trinidad-and-tobago", "uganda", "kenya", "malawi",
    ],
    since: "1931-12-11",
    terms: L(
      "Britain and its former colonies; South Africa left in 1961 over apartheid, and the new African members press London on Rhodesia.",
      "Британия и её бывшие колонии; ЮАР вышла в 1961 году из-за апартеида, а новые африканские члены давят на Лондон из-за Родезии.",
      "Британія та її колишні колонії; ПАР вийшла 1961 року через апартеїд, а нові африканські члени тиснуть на Лондон через Родезію.",
    ),
  },
  coe(
    ["austria", "belgium", "cyprus", "denmark", "france", "west-germany", "greece", "iceland", "ireland", "italy", "luxembourg", "netherlands", "norway", "sweden", "switzerland", "turkey", "uk"],
    L(
      "The European Convention on Human Rights and its court in Strasbourg; Western Europe's democracies only.",
      "Европейская конвенция о защите прав человека и её суд в Страсбурге; только демократии Западной Европы.",
      "Європейська конвенція з прав людини та її суд у Страсбурзі; лише демократії Західної Європи.",
    ),
  ),
  {
    ...montreuxModern,
    members: ["turkey", "uk", "france", "ussr", "bulgaria", "romania", "greece", "yugoslavia", "japan", "australia"],
  },
  angloPortuguese(
    L(
      " Portugal's colonial wars strain it: Britain will not help hold Angola, Guinea or Mozambique.",
      " Колониальные войны Португалии испытывают его на прочность: удерживать Анголу, Гвинею и Мозамбик Британия не поможет.",
      " Колоніальні війни Португалії випробовують його на міцність: утримувати Анголу, Гвінею та Мозамбік Британія не допоможе.",
    ),
  ),
];

// ---- 24 March 1999

const NATO_1999 = [
  "usa", "uk", "france", "germany", "italy", "canada", "netherlands", "belgium", "luxembourg", "denmark", "norway", "iceland", "portugal",
  "spain", "greece", "turkey", "poland", "czechia", "hungary",
];

export const TERMS_1999: Record<string, Localized> = {
  un: L(
    "The Charter of 1945: force only in self-defence or with the Security Council's leave. NATO strikes Yugoslavia without it, because Russia and China would veto; Yugoslavia's seat is suspended in a dispute over the old federation's succession.",
    "Устав 1945 года: сила — только для самообороны или с санкции Совета Безопасности. НАТО бьёт по Югославии без неё, потому что Россия и Китай наложили бы вето; место Югославии заморожено в споре о правопреемстве старой федерации.",
    "Статут 1945 року: сила — лише для самооборони або з дозволу Ради Безпеки. НАТО б'є по Югославії без нього, бо Росія й Китай наклали б вето; місце Югославії заморожене в суперечці про правонаступництво старої федерації.",
  ),
  nato: L(
    "Article 5: an attack on one member is an attack on all — but Allied Force is a war of choice, not of defence, waged by consensus of nineteen. Poland, the Czech Republic and Hungary joined on 12 March 1999; a new Strategic Concept is due at the Washington summit in April.",
    "Статья 5: нападение на одного члена — нападение на всех, но «Союзническая сила» — война по выбору, а не оборона, и ведётся консенсусом девятнадцати. Польша, Чехия и Венгрия вступили 12 марта 1999 года; новая стратегическая концепция ожидается на саммите в Вашингтоне в апреле.",
    "Стаття 5: напад на одного члена — напад на всіх, але «Союзницька сила» — війна за вибором, а не оборона, і ведеться консенсусом дев'ятнадцяти. Польща, Чехія та Угорщина вступили 12 березня 1999 року; нова стратегічна концепція очікується на саміті у Вашингтоні у квітні.",
  ),
  eu: L(
    "A single market of fifteen; eleven of them share the euro since January 1999. Its Commission resigned on 16 March over a corruption report; a common foreign and security policy is still mostly words.",
    "Единый рынок пятнадцати стран; одиннадцать из них с января 1999 года пользуются евро. Комиссия ушла в отставку 16 марта из-за доклада о коррупции; общая внешняя политика и политика безопасности пока в основном на словах.",
    "Єдиний ринок п'ятнадцяти країн; одинадцять із них із січня 1999 року користуються євро. Комісія пішла у відставку 16 березня через доповідь про корупцію; спільна зовнішня політика й політика безпеки поки здебільшого на словах.",
  ),
};

export const TREATIES_1999: AllianceSeed[] = [
  {
    id: "dayton",
    kind: "pact",
    name: L("Dayton Agreement", "Дейтонские соглашения", "Дейтонські угоди"),
    members: ["bosnia-and-herzegovina", "croatia", "yugoslavia", "usa", "uk", "france", "germany", "russia"],
    since: "1995-12-14",
    terms: L(
      "Ended the Bosnian war: one state of two entities, the Federation and Republika Srpska, under an international High Representative; NATO's SFOR (about 30,000 troops, Russians among them) keeps the peace.",
      "Закончили войну в Боснии: одно государство из двух образований — Федерации и Республики Сербской — под надзором международного Высокого представителя; мир поддерживают СФОР НАТО (около 30 тысяч военных, в том числе российские).",
      "Завершили війну в Боснії: одна держава з двох утворень — Федерації та Республіки Сербської — під наглядом міжнародного Високого представника; мир підтримують СФОР НАТО (близько 30 тисяч військових, серед них російські).",
    ),
  },
  {
    id: "osce",
    kind: "organization",
    name: L("OSCE", "ОБСЕ", "ОБСЄ"),
    members: [
      "albania", "andorra", "armenia", "austria", "azerbaijan", "belarus", "belgium", "bosnia-and-herzegovina", "bulgaria", "canada", "croatia",
      "cyprus", "czechia", "denmark", "estonia", "finland", "france", "georgia", "germany", "greece", "hungary", "iceland", "ireland", "italy",
      "kazakhstan", "kyrgyzstan", "latvia", "liechtenstein", "lithuania", "luxembourg", "malta", "moldova", "macedonia", "netherlands", "norway",
      "poland", "portugal", "romania", "russia", "slovakia", "slovenia", "spain", "sweden", "switzerland", "tajikistan", "turkey", "turkmenistan",
      "ukraine", "uk", "usa", "uzbekistan",
    ],
    since: "1975-08-01",
    terms: L(
      "Helsinki's principles: borders inviolable, human rights everyone's business. Its Kosovo Verification Mission, sent under the October 1998 deal with Milošević, withdrew on 20 March; Yugoslavia is suspended.",
      "Принципы Хельсинки: границы нерушимы, права человека — общее дело. Её Контрольная миссия в Косове, направленная по договорённости с Милошевичем в октябре 1998 года, ушла 20 марта; Югославия отстранена.",
      "Принципи Гельсінкі: кордони непорушні, права людини — спільна справа. Її Контрольна місія в Косові, направлена за домовленістю з Мілошевичем у жовтні 1998 року, пішла 20 березня; Югославію відсторонено.",
    ),
  },
  coe(
    [
      "albania", "andorra", "austria", "belgium", "bulgaria", "croatia", "cyprus", "czechia", "denmark", "estonia", "finland", "france",
      "germany", "greece", "hungary", "iceland", "ireland", "italy", "latvia", "liechtenstein", "lithuania", "luxembourg", "malta", "moldova",
      "netherlands", "norway", "poland", "portugal", "romania", "russia", "slovakia", "slovenia", "spain", "sweden", "switzerland", "macedonia",
      "turkey", "ukraine", "uk",
    ],
    L(
      "The European Convention on Human Rights, binding since 1998 on Russia too; Georgia joins in April.",
      "Европейская конвенция о защите прав человека, обязательная с 1998 года и для России; Грузия вступает в апреле.",
      "Європейська конвенція з прав людини, обов'язкова з 1998 року й для Росії; Грузія вступає у квітні.",
    ),
  ),
  {
    id: "weu",
    name: L("Western European Union", "Западноевропейский союз", "Західноєвропейський союз"),
    members: ["belgium", "france", "germany", "greece", "italy", "luxembourg", "netherlands", "portugal", "spain", "uk"],
    since: "1954-10-23",
    terms: L(
      "Automatic military aid to a member attacked in Europe; in practice the EU's would-be defence arm, leaning on NATO.",
      "Автоматическая военная помощь члену, подвергшемуся нападению в Европе; на деле будущая оборонная рука ЕС, опирающаяся на НАТО.",
      "Автоматична військова допомога члену, на якого напали в Європі; на ділі майбутня оборонна рука ЄС, що спирається на НАТО.",
    ),
  },
  {
    id: "euro",
    kind: "trade",
    name: L("Euro area", "Еврозона", "Єврозона"),
    members: ["france", "germany", "italy", "spain", "netherlands", "belgium", "austria", "portugal", "finland", "ireland", "luxembourg"],
    since: "1999-01-01",
    terms: L(
      "One currency since 1 January 1999 (notes and coins in 2002), run by the European Central Bank in Frankfurt; deficits capped at 3 % of GDP by the Stability Pact.",
      "Единая валюта с 1 января 1999 года (банкноты и монеты — в 2002-м), которой управляет Европейский центральный банк во Франкфурте; дефицит ограничен 3 % ВВП Пактом стабильности.",
      "Єдина валюта з 1 січня 1999 року (банкноти й монети — у 2002-му), якою керує Європейський центральний банк у Франкфурті; дефіцит обмежено 3 % ВВП Пактом стабільності.",
    ),
  },
  cis(
    ["russia", "ukraine", "belarus", "moldova", "armenia", "azerbaijan", "georgia", "kazakhstan", "kyrgyzstan", "tajikistan", "turkmenistan", "uzbekistan"],
    L(
      "Twelve former Soviet republics; a free-trade area mostly on paper. Ukraine, Georgia, Azerbaijan and Moldova keep their distance in GUAM.",
      "Двенадцать бывших советских республик; зона свободной торговли в основном на бумаге. Украина, Грузия, Азербайджан и Молдова держатся особняком в ГУАМ.",
      "Дванадцять колишніх радянських республік; зона вільної торгівлі здебільшого на папері. Україна, Грузія, Азербайджан і Молдова тримаються осторонь у ГУАМ.",
    ),
  ),
  {
    id: "cst",
    name: L("CIS Collective Security Treaty", "Договор о коллективной безопасности СНГ", "Договір про колективну безпеку СНД"),
    members: ["russia", "armenia", "belarus", "kazakhstan", "kyrgyzstan", "tajikistan", "azerbaijan", "georgia", "uzbekistan"],
    since: "1992-05-15",
    terms: L(
      "Aggression against one member is aggression against all. Its five-year term ends in April 1999, and Azerbaijan, Georgia and Uzbekistan will not renew it.",
      "Агрессия против одного участника — агрессия против всех. Его пятилетний срок истекает в апреле 1999 года, и Азербайджан, Грузия и Узбекистан продлевать его не будут.",
      "Агресія проти одного учасника — агресія проти всіх. Його п'ятирічний строк спливає у квітні 1999 року, і Азербайджан, Грузія та Узбекистан продовжувати його не будуть.",
    ),
  },
  {
    id: "union-russia-belarus",
    kind: "pact",
    name: L("Union of Russia and Belarus", "Союз Беларуси и России", "Союз Білорусі та Росії"),
    members: ["russia", "belarus"],
    since: "1997-04-02",
    terms: L(
      "A union with common bodies and a goal of one currency; a treaty on a union state is being negotiated, and Lukashenko eyes the top job.",
      "Союз с общими органами и целью единой валюты; идут переговоры о договоре о союзном государстве, Лукашенко присматривается к главной должности.",
      "Союз зі спільними органами й метою єдиної валюти; тривають переговори про договір про союзну державу, Лукашенко придивляється до головної посади.",
    ),
  },
  guam,
  budapest,
  {
    id: "russia-ukraine",
    kind: "pact",
    name: L("Russia–Ukraine Friendship Treaty", "Договор о дружбе между Россией и Украиной", "Договір про дружбу між Росією та Україною"),
    members: ["russia", "ukraine"],
    since: "1997-05-31",
    terms: L(
      "Each respects the other's borders; the Black Sea Fleet is divided and Russia leases its share of Sevastopol for twenty years.",
      "Стороны уважают границы друг друга; Черноморский флот разделён, Россия арендует свою часть Севастополя на двадцать лет.",
      "Сторони поважають кордони одна одної; Чорноморський флот поділено, Росія орендує свою частину Севастополя на двадцять років.",
    ),
  },
  {
    id: "start-1",
    kind: "pact",
    name: L("START I", "Договор СНВ-I", "Договір СНО-I"),
    members: ["usa", "russia", "ukraine", "belarus", "kazakhstan"],
    since: "1994-12-05",
    terms: L(
      "6,000 strategic warheads each by December 2001; Ukraine, Belarus and Kazakhstan have handed theirs to Russia. START II, signed in 1993, waits in the Duma, which shelved it again over the bombing.",
      "По 6000 стратегических боезарядов к декабрю 2001 года; Украина, Белоруссия и Казахстан передали свои России. СНВ-II, подписанный в 1993 году, лежит в Думе, которая снова отложила его из-за бомбардировок.",
      "По 6000 стратегічних боєзарядів до грудня 2001 року; Україна, Білорусь і Казахстан передали свої Росії. СНО-II, підписаний 1993 року, лежить у Думі, яка знову відклала його через бомбардування.",
    ),
  },
  {
    id: "cfe",
    kind: "pact",
    name: L("CFE Treaty", "Договор об обычных вооружённых силах в Европе", "Договір про звичайні збройні сили в Європі"),
    members: [...NATO_1999, "russia", "ukraine", "belarus", "moldova", "georgia", "armenia", "azerbaijan", "kazakhstan", "slovakia", "romania", "bulgaria"],
    since: "1990-11-19",
    terms: L(
      "Ceilings on tanks, armour, guns and aircraft from the Atlantic to the Urals, with inspections; an adapted treaty for national rather than bloc limits is being negotiated.",
      "Потолки на танки, бронемашины, артиллерию и авиацию от Атлантики до Урала, с инспекциями; идут переговоры об адаптированном договоре с национальными, а не блоковыми лимитами.",
      "Стелі на танки, бронемашини, артилерію та авіацію від Атлантики до Уралу, з інспекціями; тривають переговори про адаптований договір із національними, а не блоковими лімітами.",
    ),
  },
  usJapan("47,000"),
  usKorea("37,000"),
  chinaDprk,
  anzus,
  {
    id: "shanghai-five",
    kind: "pact",
    name: L("Shanghai Five", "Шанхайская пятёрка", "Шанхайська п'ятірка"),
    members: ["china", "russia", "kazakhstan", "kyrgyzstan", "tajikistan"],
    since: "1996-04-26",
    terms: L(
      "Confidence-building on the old Sino-Soviet border: troops pulled back and limited, manoeuvres announced in advance.",
      "Меры доверия на бывшей советско-китайской границе: войска отведены и ограничены, о манёврах уведомляют заранее.",
      "Заходи довіри на колишньому радянсько-китайському кордоні: війська відведено й обмежено, про маневри повідомляють заздалегідь.",
    ),
  },
  {
    id: "g8",
    kind: "organization",
    name: L("G8", "Большая восьмёрка", "Велика вісімка"),
    members: ["usa", "japan", "germany", "france", "uk", "italy", "canada", "russia"],
    since: "1997-06-20",
    terms: L(
      "The rich democracies' club, with Russia admitted to its political talks; its foreign ministers may yet be where a Kosovo peace is drafted.",
      "Клуб богатых демократий, куда допущена и Россия; возможно, именно его министры иностранных дел и напишут мир для Косова.",
      "Клуб багатих демократій, куди допущено й Росію; можливо, саме його міністри закордонних справ і напишуть мир для Косова.",
    ),
  },
  {
    id: "nafta",
    kind: "trade",
    name: L("NAFTA", "НАФТА", "НАФТА"),
    members: ["usa", "canada", "mexico"],
    since: "1994-01-01",
    terms: L(
      "Free trade in North America; tariffs among the three are being phased out over fifteen years.",
      "Свободная торговля в Северной Америке; пошлины между тремя странами отменяются в течение пятнадцати лет.",
      "Вільна торгівля в Північній Америці; мита між трьома країнами скасовуються протягом п'ятнадцяти років.",
    ),
  },
  arabLeague(
    ARAB_LEAGUE,
    L(
      "Twenty-two members; it condemns the strikes on Iraq and worries about Kosovo's Muslims at once.",
      "Двадцать два члена; осуждает удары по Ираку и одновременно тревожится за мусульман Косова.",
      "Двадцять два члени; засуджує удари по Іраку й водночас турбується за мусульман Косова.",
    ),
  ),
  {
    id: "gcc",
    kind: "organization",
    name: L("Gulf Cooperation Council", "Совет сотрудничества арабских государств Персидского залива", "Рада співробітництва арабських держав Перської затоки"),
    members: ["saudi-arabia", "kuwait", "bahrain", "qatar", "united-arab-emirates", "oman"],
    since: "1981-05-25",
    terms: L(
      "The six Gulf monarchies, sheltered by American forces since the Gulf War.",
      "Шесть монархий Залива под защитой американских войск со времён войны в Заливе.",
      "Шість монархій Затоки під захистом американських військ із часів війни в Затоці.",
    ),
  },
  {
    id: "oau",
    kind: "organization",
    name: L("Organisation of African Unity", "Организация африканского единства", "Організація африканської єдності"),
    members: [...AFRICA_MODERN.filter((m) => m !== "south-sudan" && m !== "eswatini"), "swaziland"],
    since: "1963-05-25",
    terms: L(
      "The colonial borders are untouchable; it mediates in the Congo war and between Eritrea and Ethiopia, with little to show.",
      "Колониальные границы неприкосновенны; посредничает в войне в Конго и между Эритреей и Эфиопией без особых успехов.",
      "Колоніальні кордони недоторканні; посередничає у війні в Конго та між Еритреєю й Ефіопією без особливих успіхів.",
    ),
  },
  asean(
    ["brunei", "indonesia", "malaysia", "philippines", "singapore", "thailand", "vietnam", "laos", "myanmar"],
    L(
      "Nine states after the Asian crisis of 1997; Cambodia joins in April.",
      "Девять государств после азиатского кризиса 1997 года; в апреле вступает Камбоджа.",
      "Дев'ять держав після азійської кризи 1997 року; у квітні вступає Камбоджа.",
    ),
  ),
  mercosur(
    ["argentina", "brazil", "paraguay", "uruguay"],
    L(
      "A customs union shaken by Brazil's devaluation in January 1999.",
      "Таможенный союз, потрясённый девальвацией в Бразилии в январе 1999 года.",
      "Митний союз, вражений девальвацією в Бразилії в січні 1999 року.",
    ),
  ),
  opec(
    ["algeria", "indonesia", "iran", "iraq", "kuwait", "libya", "nigeria", "qatar", "saudi-arabia", "united-arab-emirates", "venezuela"],
    L(
      "Oil fell to $10 a barrel in December 1998; on 23 March 1999 the members agreed to cut output by 1.7 million barrels a day.",
      "В декабре 1998 года нефть упала до 10 долларов за баррель; 23 марта 1999 года члены договорились сократить добычу на 1,7 миллиона баррелей в сутки.",
      "У грудні 1998 року нафта впала до 10 доларів за барель; 23 березня 1999 року члени домовилися скоротити видобуток на 1,7 мільйона барелів на добу.",
    ),
  ),
  montreuxModern,
];

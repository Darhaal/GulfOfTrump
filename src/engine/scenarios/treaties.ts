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

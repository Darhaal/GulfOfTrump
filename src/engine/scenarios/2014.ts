import type { Scenario } from "../types";
import { TERMS_2014, TREATIES_2014, withTreaties } from "./treaties";
import { COUNTRIES_TODAY, ISLANDS_TODAY } from "./islands";

const NATO_2014 = [
  "albania", "belgium", "bulgaria", "canada", "croatia", "czechia", "denmark", "estonia", "france",
  "germany", "greece", "hungary", "iceland", "italy", "latvia", "lithuania", "luxembourg", "netherlands",
  "norway", "poland", "portugal", "romania", "slovakia", "slovenia", "spain", "turkey", "uk", "usa",
];

const EU_2014 = [
  "austria", "belgium", "bulgaria", "croatia", "cyprus", "czechia", "denmark", "estonia", "finland",
  "france", "germany", "greece", "hungary", "ireland", "italy", "latvia", "lithuania", "luxembourg",
  "malta", "netherlands", "poland", "portugal", "romania", "slovakia", "slovenia", "spain", "sweden", "uk",
];

const PARLIAMENTARY = { ru: "Парламентская республика", uk: "Парламентська республіка", en: "Parliamentary republic" };
const MONARCHY = { ru: "Конституционная монархия", uk: "Конституційна монархія", en: "Constitutional monarchy" };
const PRESIDENTIAL = { ru: "Президентская республика", uk: "Президентська республіка", en: "Presidential republic" };

export const scenario2014: Scenario = {
  id: "2014",
  map: "world_2010",
  startDate: "2014-01-16",
  defaultStep: "week",
  title: {
    ru: "Евромайдан",
    uk: "Євромайдан",
    en: "Euromaidan",
  },
  tagline: {
    ru: "Восьмая неделя Майдана: Рада приняла «законы о диктатуре», и Киев на грани.",
    uk: "Восьмий тиждень Майдану: Рада ухвалила «закони про диктатуру», і Київ на межі.",
    en: "The eighth week of the Maidan: parliament has passed the \"dictatorship laws\", and Kyiv is on the edge.",
  },
  story: {
    ru: "16 января 2014 года Верховная Рада Украины поднятием рук, без нормального подсчёта голосов, принимает пакет законов, ограничивающих протесты, прессу и общественные организации; оппозиция сразу называет их «законами о диктатуре». На следующий день президент Виктор Янукович их подписывает. Восьмую неделю протестующие держат киевскую площадь Независимости, Майдан, с тех пор как в ноябре он отказался подписать соглашение об ассоциации с Европейским союзом.\n\nПротесты начинались мирно и разрослись после того, как в конце ноября «Беркут» избил студентов на Майдане. В декабре Россия предложила Украине кредит в пятнадцать миллиардов долларов и дешёвый газ, и правительство уже получило первую часть. От имени площади говорят лидеры оппозиции Виталий Кличко, Арсений Яценюк и Олег Тягнибок, но радикальные группы набирают силу, а новые законы грозят тюрьмой всем, кто там стоит.\n\nЕвропейский союз и США призывают власть к переговорам, а не к силе; Москва называет протесты попыткой переворота при поддержке Запада. Экономика Украины на грани дефолта. Разгонят ли площадь, уступит ли власть и останется ли кризис в границах Украины, пока не решено.",
    uk: "16 січня 2014 року Верховна Рада України підняттям рук, без нормального підрахунку голосів, ухвалює пакет законів, що обмежують протести, пресу й громадські організації; опозиція одразу називає їх «законами про диктатуру». Наступного дня президент Віктор Янукович їх підписує. Восьмий тиждень протестувальники тримають київський майдан Незалежності, Майдан, відтоді як у листопаді він відмовився підписати угоду про асоціацію з Європейським Союзом.\n\nПротести починалися мирно і розрослися після того, як наприкінці листопада «Беркут» побив студентів на Майдані. У грудні Росія запропонувала Україні кредит у п'ятнадцять мільярдів доларів і дешевий газ, і уряд уже отримав першу частину. Від імені площі говорять лідери опозиції Віталій Кличко, Арсеній Яценюк і Олег Тягнибок, але радикальні групи набирають сили, а нові закони загрожують в'язницею всім, хто там стоїть.\n\nЄвропейський Союз і США закликають владу до переговорів, а не до сили; Москва називає протести спробою перевороту за підтримки Заходу. Економіка України на межі дефолту. Чи розженуть площу, чи поступиться влада і чи лишиться криза в межах України, поки не вирішено.",
    en: "On 16 January 2014 Ukraine's parliament, the Verkhovna Rada, passes by a show of hands and without a proper count a package of laws restricting protest, the press and civil society, which the opposition at once calls the \"dictatorship laws\". President Viktor Yanukovych signs them the next day. For eight weeks protesters have held Kyiv's Independence Square, the Maidan, since he refused in November to sign an association agreement with the European Union.\n\nThe protests began peacefully and grew after riot police beat students on the Maidan at the end of November. In December Russia offered Ukraine a loan of fifteen billion dollars and cheaper gas, and the government has taken the first part. The opposition leaders Vitali Klitschko, Arseniy Yatsenyuk and Oleh Tyahnybok speak for the square, but radical groups are growing stronger, and the new laws threaten everyone on it with prison.\n\nThe European Union and the United States urge the government to talk rather than use force; Moscow calls the protests a Western-backed attempt at a coup. Ukraine's economy is close to default. Whether the square is cleared, whether the government gives way and whether the crisis stays within Ukraine's borders is still open.",
  },
  briefing: {
    ru: "16 января 2014 года. Два месяца назад Янукович отказался подписать соглашение об ассоциации с ЕС, и Киев вышел на Майдан. После избиения студентов «Беркутом» протест стал массовым: палатки, баррикады, захваченные КГГА и Дом профсоюзов, самооборона. Москва дала Киеву кредит в $15 млрд и скидку на газ. Сегодня Партия регионов и коммунисты подняли руки за законы, запрещающие почти всякий протест. Кличко, Яценюк и Тягнибок зовут людей на Майдан, радикалы – на Грушевского. Силовики ждут приказа, олигархи – исхода. Играйте за Януковича и решайте, удержать власть или уступить; за Россию, Запад или соседей – решайте, на чью сторону встать.",
    uk: "16 січня 2014 року. Два місяці тому Янукович відмовився підписати угоду про асоціацію з ЄС, і Київ вийшов на Майдан. Після побиття студентів «Беркутом» протест став масовим: намети, барикади, захоплені КМДА й Будинок профспілок, самооборона. Москва дала Києву кредит у $15 млрд і знижку на газ. Сьогодні Партія регіонів і комуністи підняли руки за закони, що забороняють майже будь-який протест. Кличко, Яценюк і Тягнибок кличуть людей на Майдан, радикали – на Грушевського. Силовики чекають наказу, олігархи – розв'язки. Грайте за Януковича й вирішуйте, втримати владу чи поступитися; за Росію, Захід чи сусідів – вирішуйте, на чий бік стати.",
    en: "16 January 2014. Two months ago Yanukovych refused to sign the Association Agreement with the EU, and Kyiv went out onto the Maidan. After the Berkut riot police beat students the protest became a mass movement: tents, barricades, the occupied city hall and Trade Unions building, a self-defence force. Moscow has lent Kyiv $15 billion and cut the gas price. Today the Party of Regions and the Communists raised their hands for laws that ban almost any protest. Klitschko, Yatsenyuk and Tyahnybok call people to the Maidan, the radicals to Hrushevskoho Street. The security forces await orders, the oligarchs the outcome. Play Yanukovych and decide whether to hold power or give way; play Russia, the West or the neighbours and decide whose side to take.",
  },
  context: `Date: 16 January 2014. The Euromaidan protest is in its eighth week.
How it started: on 21 November 2013 the government of Ukraine (President Viktor Yanukovych, PM Mykola Azarov) suspended the Association Agreement with the EU a week before the Vilnius summit. Students gathered on Maidan Nezalezhnosti in Kyiv. On the night of 30 November the Berkut riot police beat them; on 1 December 500,000–800,000 people marched, occupied Kyiv City Hall and the Trade Unions building and built barricades. A night attempt to clear the Maidan on 11 December failed while EU and US envoys (Ashton, Nuland) were in town. On 17 December Putin and Yanukovych agreed a $15 billion Russian loan ($3 billion paid at once, through Ukrainian Eurobonds) and a gas price cut from about $400 to $268 per 1000 m³.
Today: the Verkhovna Rada passed, by a show of hands with no proper count, the "dictatorship laws" restricting rallies, the press, NGOs ("foreign agents") and masks and helmets at protests. The Maidan is a permanent camp with tents, kitchens, a stage and barricades; the Maidan Self-Defence (Andriy Parubiy) has thousands of men in companies; Automaidan drives to officials' homes; Right Sector (Dmytro Yarosh) is a small radical force ready to fight. Weekend rallies draw 100,000–200,000; Kyiv, Lviv and the west are with the protest, the east and south mostly against it or indifferent; protesters have been beaten and some have vanished.
Opposition: Vitali Klitschko (UDAR), Arseniy Yatsenyuk (Batkivshchyna; its leader Yulia Tymoshenko is in prison in Kharkiv), Oleh Tyahnybok (Svoboda). Parliament (Verkhovna Rada, 450 seats, threshold 5%): Party of Regions about 205 seats, Batkivshchyna 88, UDAR 42, Svoboda 36, Communists 32, about 45 independents; the government's majority rests on the Party of Regions and the Communists. The next presidential election is due on 29 March 2015.
Power: the Interior Ministry (Vitaliy Zakharchenko) with Berkut and Interior troops is loyal and ready to act; the army (Defence Minister Pavlo Lebedev) is small, underfunded and neutral, reluctant to be used against civilians; the SBU (Oleksandr Yakymenko) is penetrated by Russian services; the Head of the Presidential Administration is Serhiy Lyovochkin, close to Firtash and himself hedging. Oligarchs hedge: Rinat Akhmetov, Dmytro Firtash, Ihor Kolomoisky; Petro Poroshenko supports the Maidan. Regional governors appointed by Yanukovych run the east and south.
Economy: GDP about $180 billion, no growth in 2013, a current-account deficit, reserves about $20 billion and falling, the hryvnia held at about 8 to the dollar, a gas debt to Gazprom, budget arrears; the IMF wants a flexible hryvnia and higher gas prices; Russia's money comes with the expectation that Ukraine stays out of the EU and moves towards the Customs Union.
Outside: Russia (Putin; adviser Sergey Glazyev, Vladislav Surkov) wants Ukraine in its Eurasian Customs Union and fears NATO; the Black Sea Fleet is based in Sevastopol under the Kharkiv Pact until 2042; the Sochi Winter Olympics open on 7 February. The EU (Barroso, Ashton, Füle) and Poland, Germany and the Baltic states back the protesters but avoid sanctions; the US (Obama; Nuland, Ambassador Pyatt) threatens visa bans. Crimea, Donetsk and Luhansk are Ukrainian; Crimea has a Russian-speaking majority and a pro-Russian parliament.
Real history for reference: on 19 January clashes start on Hrushevskoho Street; the first protesters are shot on 22 January; regional administrations are seized in the west; Azarov resigns on 28 January and the laws are repealed; on 18–20 February about a hundred people are killed in Kyiv, many by snipers; on 21 February an agreement brokered by the German, French and Polish foreign ministers promises early elections; that night Yanukovych flees, and on 22 February parliament removes him. Russia seizes Crimea from 27 February and annexes it after a referendum on 16 March; armed men take Sloviansk in April and the war in Donbas begins; Poroshenko is elected president on 25 May. None of this is fixed.`,
  aliases: {
    byelarus: "belarus",
    zaire: "dr-congo",
    "korea-democratic-people-s-republic-of": "north-korea",
    "korea-republic-of": "south-korea",
    "tanzania-united-republic-of": "tanzania",
    burma: "myanmar",
    swaziland: "eswatini",
    macedonia: "north-macedonia",
    "turkish-cypriot-administered-area": "northern-cyprus",
    "gambia-the": "gambia",
    "united-states": "usa",
    "united-kingdom": "uk",
    "czech-republic": "czechia",
    trinidad: "trinidad-and-tobago",
  },
  owners: {
    greenland: "denmark",
    "puerto-rico": "usa",
    "american-samoa": "usa",
    "united-states-virgin-islands": "usa",
    martinique: "france",
    guadeloupe: "france",
    "saint-martin": "france",
    "saint-barthelemy": "france",
    "french-guiana": "france",
    "wallis-and-futuna-islands": "france",
    montserrat: "uk",
    anguilla: "uk",
    "turks-and-caicos-islands": "uk",
    "netherlands-antilles": "netherlands",
    niue: "new-zealand",
    "western-sahara": "morocco",
  },
  // Borders the 2010 source predates, and the islands and slivers it draws with a neighbour (islands.ts).
  modernOwners: {
    SDS: "south-sudan",
    KOS: "kosovo",
    ...COUNTRIES_TODAY,
  },
  provinceOwners: {
    ...ISLANDS_TODAY,
    // Saaremaa, which the source gives to Latvia.
    "ee-saare": "estonia",
  },
  // The Maidan on the start date: a mass camp in Kyiv, with the west behind it.
  protests: [
    {
      title: { ru: "Евромайдан", uk: "Євромайдан", en: "Euromaidan" },
      country: "ukraine",
      stage: "rally",
      size: 200,
      where: ["ua-kyiv-2", "ua-lviv", "ua-ivano-frankivsk", "ua-ternopil", "ua-volyn"],
      demands: {
        ru: "Отставка Януковича и правительства Азарова, отмена законов 16 января, досрочные выборы, подписание соглашения с ЕС",
        uk: "Відставка Януковича й уряду Азарова, скасування законів 16 січня, дострокові вибори, підписання угоди з ЄС",
        en: "Yanukovych and the Azarov government to resign, the 16 January laws repealed, early elections, the EU agreement signed",
      },
      by: { ru: "Кличко, Яценюк, Тягнибок; Самооборона Майдана", uk: "Кличко, Яценюк, Тягнибок; Самооборона Майдану", en: "Klitschko, Yatsenyuk, Tyahnybok; the Maidan Self-Defence" },
      support: 45,
      organisation: 75,
      killed: 0,
    },
  ],
  // The pillars of Yanukovych's power on the start date.
  loyalty: { ukraine: { army: 50, police: 80, security: 55, elites: 45 } },
  countries: {
    ukraine: {
      name: { ru: "Украина", uk: "Україна", en: "Ukraine" },
      color: "#e0b93c",
      leader: "President Viktor Yanukovych; PM Mykola Azarov",
      government: { ru: "Президентско-парламентская республика", uk: "Президентсько-парламентська республіка", en: "Semi-presidential republic" },
      stats: { stability: 30, economy: 30, military: 25 },
    },
    russia: {
      name: { ru: "Россия", uk: "Росія", en: "Russia" },
      color: "#4f7d4c",
      leader: "President Vladimir Putin; PM Dmitry Medvedev",
      government: { ru: "Персоналистская авторитарная республика", uk: "Персоналістська авторитарна республіка", en: "Personalist authoritarian republic" },
      stats: { stability: 70, economy: 60, military: 75 },
    },
    belarus: {
      name: { ru: "Беларусь", uk: "Білорусь", en: "Belarus" },
      color: "#7fa86f",
      leader: "President Alexander Lukashenko",
      government: { ru: "Авторитарная республика", uk: "Авторитарна республіка", en: "Authoritarian republic" },
      stats: { stability: 55, economy: 25, military: 25 },
    },
    usa: {
      name: { ru: "США", uk: "США", en: "United States" },
      color: "#6680c2",
      leader: "President Barack Obama",
      government: { ru: "Федеративная республика", uk: "Федеративна республіка", en: "Federal republic" },
      stats: { stability: 65, economy: 90, military: 100 },
    },
    uk: {
      name: { ru: "Великобритания", uk: "Велика Британія", en: "United Kingdom" },
      color: "#d0666b",
      leader: "PM David Cameron",
      government: MONARCHY,
      stats: { stability: 65, economy: 75, military: 60 },
    },
    germany: {
      name: { ru: "Германия", uk: "Німеччина", en: "Germany" },
      color: "#6f7277",
      leader: "Chancellor Angela Merkel",
      government: { ru: "Федеративная парламентская республика", uk: "Федеративна парламентська республіка", en: "Federal parliamentary republic" },
      stats: { stability: 80, economy: 85, military: 40 },
    },
    france: {
      name: { ru: "Франция", uk: "Франція", en: "France" },
      color: "#4a72b8",
      leader: "President François Hollande",
      government: { ru: "Пятая республика", uk: "П'ята республіка", en: "Fifth Republic" },
      stats: { stability: 55, economy: 75, military: 60 },
    },
    poland: {
      name: { ru: "Польша", uk: "Польща", en: "Poland" },
      color: "#d27b93",
      leader: "President Bronisław Komorowski; PM Donald Tusk",
      government: PARLIAMENTARY,
      stats: { stability: 65, economy: 60, military: 40 },
    },
    lithuania: {
      name: { ru: "Литва", uk: "Литва", en: "Lithuania" },
      color: "#c2c34f",
      leader: "President Dalia Grybauskaitė",
      government: PARLIAMENTARY,
      stats: { stability: 65, economy: 45, military: 10 },
    },
    china: {
      name: { ru: "Китай", uk: "Китай", en: "China" },
      color: "#cf3d2e",
      leader: "General Secretary Xi Jinping",
      government: { ru: "Однопартийное коммунистическое государство", uk: "Однопартійна комуністична держава", en: "One-party communist state" },
      stats: { stability: 75, economy: 85, military: 75 },
    },
    turkey: {
      name: { ru: "Турция", uk: "Туреччина", en: "Turkey" },
      color: "#4f9a8c",
      leader: "PM Recep Tayyip Erdoğan; President Abdullah Gül",
      government: PARLIAMENTARY,
      stats: { stability: 55, economy: 55, military: 60 },
    },
    india: {
      name: { ru: "Индия", uk: "Індія", en: "India" },
      color: "#e0a458",
      leader: "PM Manmohan Singh",
      government: { ru: "Федеративная парламентская республика", uk: "Федеративна парламентська республіка", en: "Federal parliamentary republic" },
      stats: { stability: 55, economy: 60, military: 65 },
    },
    japan: {
      name: { ru: "Япония", uk: "Японія", en: "Japan" },
      color: "#e6d6a6",
      leader: "PM Shinzō Abe",
      government: MONARCHY,
      stats: { stability: 75, economy: 85, military: 45 },
    },
    italy: {
      name: { ru: "Италия", uk: "Італія", en: "Italy" },
      color: "#5a9d55",
      leader: "PM Enrico Letta",
      government: PARLIAMENTARY,
      stats: { stability: 50, economy: 65, military: 45 },
    },
    iran: {
      name: { ru: "Иран", uk: "Іран", en: "Iran" },
      color: "#7fae86",
      leader: "Supreme Leader Ali Khamenei; President Hassan Rouhani",
      government: { ru: "Исламская республика", uk: "Ісламська республіка", en: "Islamic republic" },
      stats: { stability: 55, economy: 35, military: 50 },
    },
    moldova: {
      name: { ru: "Молдова", uk: "Молдова", en: "Moldova" },
      color: "#d4a65c",
      leader: "PM Iurie Leancă; President Nicolae Timofti",
      government: PARLIAMENTARY,
      stats: { stability: 40, economy: 15, military: 5 },
    },
    georgia: {
      name: { ru: "Грузия", uk: "Грузія", en: "Georgia" },
      color: "#c96f6f",
      leader: "PM Irakli Garibashvili; President Giorgi Margvelashvili",
      government: PARLIAMENTARY,
      stats: { stability: 50, economy: 20, military: 15 },
    },
    kazakhstan: {
      name: { ru: "Казахстан", uk: "Казахстан", en: "Kazakhstan" },
      color: "#6fb1c4",
      leader: "President Nursultan Nazarbayev",
      government: PRESIDENTIAL,
      stats: { stability: 60, economy: 40, military: 20 },
    },
    hungary: {
      name: { ru: "Венгрия", uk: "Угорщина", en: "Hungary" },
      color: "#9fb06a",
      leader: "PM Viktor Orbán",
      government: PARLIAMENTARY,
      stats: { stability: 60, economy: 45, military: 20 },
    },
    romania: {
      name: { ru: "Румыния", uk: "Румунія", en: "Romania" },
      color: "#d8bd46",
      leader: "President Traian Băsescu; PM Victor Ponta",
      government: { ru: "Полупрезидентская республика", uk: "Напівпрезидентська республіка", en: "Semi-presidential republic" },
      stats: { stability: 50, economy: 40, military: 25 },
    },
    finland: {
      name: { ru: "Финляндия", uk: "Фінляндія", en: "Finland" },
      color: "#e3dfd0",
      leader: "President Sauli Niinistö; PM Jyrki Katainen",
      government: PARLIAMENTARY,
      stats: { stability: 80, economy: 60, military: 35 },
    },
    sweden: {
      name: { ru: "Швеция", uk: "Швеція", en: "Sweden" },
      color: "#5a97c9",
      leader: "PM Fredrik Reinfeldt",
      government: MONARCHY,
      stats: { stability: 80, economy: 65, military: 30 },
    },
    "north-korea": {
      name: { ru: "КНДР", uk: "КНДР", en: "North Korea" },
      color: "#a05a6a",
      leader: "Supreme Leader Kim Jong Un",
      government: { ru: "Тоталитарная диктатура", uk: "Тоталітарна диктатура", en: "Totalitarian dictatorship" },
      stats: { stability: 60, economy: 10, military: 50 },
    },
    "south-korea": {
      name: { ru: "Южная Корея", uk: "Південна Корея", en: "South Korea" },
      color: "#7f9fc9",
      leader: "President Park Geun-hye",
      government: PRESIDENTIAL,
      stats: { stability: 65, economy: 70, military: 60 },
    },
    taiwan: {
      name: { ru: "Тайвань", uk: "Тайвань", en: "Taiwan" },
      color: "#5a86c6",
      leader: "President Ma Ying-jeou",
      government: { ru: "Полупрезидентская республика", uk: "Напівпрезидентська республіка", en: "Semi-presidential republic" },
      stats: { stability: 65, economy: 65, military: 40 },
    },
    "saudi-arabia": {
      name: { ru: "Саудовская Аравия", uk: "Саудівська Аравія", en: "Saudi Arabia" },
      color: "#6f9e5a",
      leader: "King Abdullah",
      government: { ru: "Абсолютная монархия", uk: "Абсолютна монархія", en: "Absolute monarchy" },
      stats: { stability: 60, economy: 60, military: 45 },
    },
    brazil: {
      name: { ru: "Бразилия", uk: "Бразилія", en: "Brazil" },
      color: "#4f9a5f",
      leader: "President Dilma Rousseff",
      government: { ru: "Федеративная президентская республика", uk: "Федеративна президентська республіка", en: "Federal presidential republic" },
      stats: { stability: 50, economy: 55, military: 35 },
    },
    canada: {
      name: { ru: "Канада", uk: "Канада", en: "Canada" },
      color: "#c44f4f",
      leader: "PM Stephen Harper",
      government: MONARCHY,
      stats: { stability: 75, economy: 70, military: 30 },
    },
    australia: {
      name: { ru: "Австралия", uk: "Австралія", en: "Australia" },
      color: "#d88a5a",
      leader: "PM Tony Abbott",
      government: MONARCHY,
      stats: { stability: 75, economy: 65, military: 35 },
    },
  },
  wars: [],
  alliances: withTreaties([
    {
      id: "un",
      kind: "organization",
      name: { ru: "Организация Объединённых Наций", uk: "Організація Об'єднаних Націй", en: "United Nations" },
      // Everyone but Kosovo, Northern Cyprus and Taiwan.
      members: [],
      allExcept: ["kosovo", "northern-cyprus", "taiwan"],
      since: "1945-10-24",
    },
    {
      id: "nato",
      name: { ru: "НАТО", uk: "НАТО", en: "NATO" },
      members: NATO_2014,
      since: "1949-04-04",
    },
    {
      id: "eu",
      kind: "organization",
      name: { ru: "Европейский союз", uk: "Європейський союз", en: "European Union" },
      members: EU_2014,
      since: "1993-11-01",
    },
    {
      id: "csto",
      name: { ru: "ОДКБ", uk: "ОДКБ", en: "CSTO" },
      members: ["russia", "belarus", "armenia", "kazakhstan", "kyrgyzstan", "tajikistan"],
      since: "1992-05-15",
    },
    {
      id: "union-state",
      kind: "organization",
      name: { ru: "Союзное государство", uk: "Союзна держава", en: "Union State" },
      members: ["russia", "belarus"],
      since: "1999-12-08",
    },
    {
      id: "customs-union",
      kind: "trade",
      name: { ru: "Таможенный союз", uk: "Митний союз", en: "Eurasian Customs Union" },
      members: ["russia", "belarus", "kazakhstan"],
      since: "2010-01-01",
    },
  ], TERMS_2014, TREATIES_2014),
  featured: ["ukraine", "russia", "usa", "poland", "germany", "belarus", "lithuania", "uk", "turkey", "moldova"],
};

import type { Scenario } from "../types";
import { TERMS_2022, TREATIES_2022, withTreaties } from "./treaties";
import { COUNTRIES_TODAY, ISLANDS_TODAY } from "./islands";

const NATO_2022 = [
  "albania", "belgium", "bulgaria", "canada", "croatia", "czechia", "denmark", "estonia", "france",
  "germany", "greece", "hungary", "iceland", "italy", "latvia", "lithuania", "luxembourg", "montenegro",
  "netherlands", "north-macedonia", "norway", "poland", "portugal", "romania", "slovakia", "slovenia",
  "spain", "turkey", "uk", "usa",
];

const EU_2022 = [
  "austria", "belgium", "bulgaria", "croatia", "cyprus", "czechia", "denmark", "estonia", "finland",
  "france", "germany", "greece", "hungary", "ireland", "italy", "latvia", "lithuania", "luxembourg",
  "malta", "netherlands", "poland", "portugal", "romania", "slovakia", "slovenia", "spain", "sweden",
];

const PARLIAMENTARY = { ru: "Парламентская республика", uk: "Парламентська республіка", en: "Parliamentary republic" };
const MONARCHY = { ru: "Конституционная монархия", uk: "Конституційна монархія", en: "Constitutional monarchy" };

export const scenario2022: Scenario = {
  id: "2022",
  map: "world_2010",
  startDate: "2022-02-24",
  defaultStep: "month",
  title: {
    ru: "Вторжение в Украину",
    uk: "Вторгнення в Україну",
    en: "The Invasion of Ukraine",
  },
  tagline: {
    ru: "Ракеты бьют по всей Украине, колонны идут на Киев, и мир смотрит.",
    uk: "Ракети б'ють по всій Україні, колони йдуть на Київ, і світ дивиться.",
    en: "Missiles strike across Ukraine, columns head for Kyiv, and the world is watching.",
  },
  story: {
    ru: "Перед рассветом 24 февраля 2022 года Владимир Путин объявляет о «специальной военной операции» против Украины, и российские войска наступают из России, из Беларуси и из оккупированного Крыма. Ракеты бьют по аэродромам и военным объектам по всей стране, бронеколонны идут на Киев, Харьков и юг. Украина разрывает отношения с Россией и вводит военное положение; президент Владимир Зеленский остаётся в столице.\n\nВойна продолжает восемь лет конфликта. В 2014 году Россия аннексировала Крым и поддерживает сепаратистские силы в Донецке и Луганске, чьи «республики» Москва признала три дня назад. За зиму она стянула к границам Украины около 150 тысяч военных, отрицая планы вторжения, и требовала гарантий, что НАТО не расширится дальше на восток.\n\nСША, Европейский союз, Британия и их союзники обещают санкции небывалой жёсткости и посылают Украине оружие, но говорят, что сами воевать с Россией не будут. Китай призывает к сдержанности и не осуждает нападение. Сколько продержится Киев, как далеко зайдут санкции и кто кому поможет, решит ход войны и безопасность Европы на годы вперёд.",
    uk: "Перед світанком 24 лютого 2022 року Володимир Путін оголошує «спеціальну військову операцію» проти України, і російські війська наступають із Росії, з Білорусі та з окупованого Криму. Ракети б'ють по аеродромах і військових об'єктах по всій країні, бронеколони йдуть на Київ, Харків і південь. Україна розриває відносини з Росією та запроваджує воєнний стан; президент Володимир Зеленський лишається в столиці.\n\nВійна продовжує вісім років конфлікту. 2014 року Росія анексувала Крим і підтримує сепаратистські сили в Донецьку та Луганську, чиї «республіки» Москва визнала три дні тому. За зиму вона стягнула до кордонів України близько 150 тисяч військових, заперечуючи плани вторгнення, і вимагала гарантій, що НАТО не розшириться далі на схід.\n\nСША, Європейський Союз, Британія та їхні союзники обіцяють санкції небаченої жорсткості й надсилають Україні зброю, але кажуть, що самі воювати з Росією не будуть. Китай закликає до стриманості й не засуджує напад. Скільки протримається Київ, як далеко зайдуть санкції і хто кому допоможе, вирішить хід війни і безпеку Європи на роки вперед.",
    en: "Before dawn on 24 February 2022 Vladimir Putin announces a \"special military operation\" against Ukraine, and Russian forces attack from Russia, from Belarus and from the occupied Crimea. Missiles strike airfields and military sites across the country, and armoured columns head for Kyiv, Kharkiv and the south. Ukraine breaks off relations with Russia and declares martial law; President Volodymyr Zelensky stays in the capital.\n\nThe war follows eight years of conflict. Russia annexed Crimea in 2014 and has backed the separatist forces in Donetsk and Luhansk, whose \"republics\" Moscow recognised three days ago. Over the winter it massed some 150,000 troops near Ukraine's borders while denying any plan to invade, and demanded guarantees that NATO would grow no further east.\n\nThe United States, the European Union, Britain and their allies promise sanctions of a severity not seen before and send weapons to Ukraine, but say they will not fight Russia themselves. China calls for restraint and does not condemn the attack. How long Kyiv holds, how far the sanctions reach and who helps whom will decide the course of the war and Europe's security for years.",
  },
  briefing: {
    ru: "24 февраля 2022 года. Россия начала полномасштабное вторжение в Украину: удары по городам и аэродромам, наступление из Беларуси на Киев, из Крыма на юг и из России на Харьков. Зеленский ввёл военное положение. Запад готовит санкции, Европа зависит от российского газа, Китай заявил о «дружбе без границ» с Москвой. Чем кончится эта война – решаете вы и мир вокруг.",
    uk: "24 лютого 2022 року. Росія почала повномасштабне вторгнення в Україну: удари по містах і аеродромах, наступ із Білорусі на Київ, із Криму на південь і з Росії на Харків. Зеленський запровадив воєнний стан. Захід готує санкції, Європа залежить від російського газу, Китай заявив про «дружбу без меж» із Москвою. Чим закінчиться ця війна – вирішуєте ви й світ довкола.",
    en: "24 February 2022. Russia has launched a full-scale invasion of Ukraine: strikes on cities and airfields, a drive from Belarus on Kyiv, from Crimea into the south and from Russia on Kharkiv. Zelenskyy has declared martial law. The West is preparing sanctions, Europe depends on Russian gas, and China has declared a \"no limits\" friendship with Moscow. How this war ends is up to you and the world around you.",
  },
  context: `Date: 24 February 2022. Around 05:00 Moscow time Vladimir Putin announced a "special military operation"; Russia launched missile and air strikes across Ukraine and a ground invasion on several axes: from Belarus toward Kyiv (Hostomel airport assault), from Russia toward Chernihiv, Sumy and Kharkiv, from the occupied Donbas, and from Crimea toward Kherson and Melitopol. About 190,000 Russian and proxy troops are committed.
Background: Russia annexed Crimea in 2014 and has backed the separatist "DPR" and "LPR" in Donbas since then; it recognised them on 21 February 2022. On the map Crimea and Sevastopol are Ukrainian provinces held by Russia. The parts of Donetsk and Luhansk held by Russian proxies since 2014 (about a third of each oblast) are not drawn separately; both oblasts start as Ukrainian-held, with the line of contact running through them.
Ukraine (President Volodymyr Zelenskyy) has declared martial law and general mobilisation; its army has been retrained since 2014 and has Javelins and NLAWs from the West. Belarus (Lukashenko) lets Russia attack from its territory but is not formally at war.
The West: the US (Biden) and UK (Johnson) warned of the invasion publicly; sanctions on Russian banks, SWIFT exclusion and central-bank asset freezes are being prepared; Germany halted Nord Stream 2 certification on 22 February; the EU imports about 40% of its gas from Russia. NATO will not fight in Ukraine but reinforces its eastern flank; Finland and Sweden are neutral. Turkey controls the Straits under the Montreux Convention and sells Bayraktar drones to Ukraine. China declared a "no limits" partnership with Russia on 4 February. India abstains. Oil is above $95 a barrel.
Real history for reference: Kyiv holds; Russia withdraws from the north at the end of March; Ukraine counter-attacks around Kharkiv and Kherson in autumn 2022; Russia annexes four regions on paper in September and mobilises; Finland joins NATO in 2023 and Sweden in 2024. None of this is fixed.`,
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
    // Kalbajar and Lachin went back to Azerbaijan in November 2020.
    "az-kalbajar-lachin-economic-region-p2": "azerbaijan",
  },
  // Crimea: Ukrainian by law, held by Russia since 2014.
  provinceControllers: {
    "ua-autonomous-republic-of-crimea": "russia",
    "ua-sevastopol": "russia",
  },
  // A third of Donetsk and Luhansk oblasts held by Russia's proxies since 2014.
  // Before the invasion the separatist republics held about a third of each oblast.
  provinceHeld: { "ua-donetsk": 33, "ua-luhansk": 35 },
  // The towns on their side of the line of contact on 24 February 2022 (names as in public/maps).
  provinceTaken: {
    "ua-donetsk": [
      "Donetsk",
      "Makiyivka",
      "Horlivka",
      "Yenakiyeve",
      "Khartsyzk",
      "Shakhtarsk",
      "Chystyakove",
      "Snizhne",
      "Khanzhonkivskyi",
      "Khrestivka",
      "Yasynuvata",
      "Debaltseve",
      "Dokuchayevsk",
      "Zuhres",
      "Pelahiivka",
      "Amvrosiyivka",
      "Ilovays’k",
    ],
    "ua-luhansk": [
      "Luhansk",
      "Alchevsk",
      "Khrustalnyi",
      "Kadiyivka",
      "Dovzhansk",
      "Antratsyt",
      "Sorokyne",
      "Rovenky",
      "Bryanka",
      "Perevalsk",
      "Otamanivka",
      "Sukhodilsk",
      "Lutuhyne",
      "Holubivka",
      "Sokolohirsk",
      "Voznesenivka",
      "Katerynivka",
      // Donetsk of the Rostov oblast, on the border, falls inside the oblast's outline.
      "Donetsk",
    ],
  },
  provinceContested: {
    "ua-donetsk": "russia",
    "ua-luhansk": "russia",
  },
  countries: {
    ukraine: {
      name: { ru: "Украина", uk: "Україна", en: "Ukraine" },
      color: "#e0b93c",
      leader: "President Volodymyr Zelenskyy",
      government: { ru: "Президентско-парламентская республика", uk: "Президентсько-парламентська республіка", en: "Semi-presidential republic" },
      stats: { stability: 60, economy: 30, military: 50 },
    },
    russia: {
      name: { ru: "Россия", uk: "Росія", en: "Russia" },
      color: "#4f7d4c",
      leader: "President Vladimir Putin",
      government: { ru: "Персоналистская авторитарная республика", uk: "Персоналістська авторитарна республіка", en: "Personalist authoritarian republic" },
      stats: { stability: 65, economy: 50, military: 85 },
    },
    belarus: {
      name: { ru: "Беларусь", uk: "Білорусь", en: "Belarus" },
      color: "#7fa86f",
      leader: "President Alexander Lukashenko",
      government: { ru: "Авторитарная республика", uk: "Авторитарна республіка", en: "Authoritarian republic" },
      stats: { stability: 40, economy: 25, military: 25 },
    },
    usa: {
      name: { ru: "США", uk: "США", en: "United States" },
      color: "#6680c2",
      leader: "President Joe Biden",
      government: { ru: "Федеративная республика", uk: "Федеративна республіка", en: "Federal republic" },
      stats: { stability: 60, economy: 95, military: 100 },
    },
    uk: {
      name: { ru: "Великобритания", uk: "Велика Британія", en: "United Kingdom" },
      color: "#d0666b",
      leader: "PM Boris Johnson",
      government: MONARCHY,
      stats: { stability: 55, economy: 75, military: 60 },
    },
    germany: {
      name: { ru: "Германия", uk: "Німеччина", en: "Germany" },
      color: "#6f7277",
      leader: "Chancellor Olaf Scholz",
      government: { ru: "Федеративная парламентская республика", uk: "Федеративна парламентська республіка", en: "Federal parliamentary republic" },
      stats: { stability: 70, economy: 85, military: 40 },
    },
    france: {
      name: { ru: "Франция", uk: "Франція", en: "France" },
      color: "#4a72b8",
      leader: "President Emmanuel Macron",
      government: { ru: "Пятая республика", uk: "П'ята республіка", en: "Fifth Republic" },
      stats: { stability: 60, economy: 80, military: 60 },
    },
    poland: {
      name: { ru: "Польша", uk: "Польща", en: "Poland" },
      color: "#d27b93",
      leader: "President Andrzej Duda; PM Mateusz Morawiecki",
      government: PARLIAMENTARY,
      stats: { stability: 60, economy: 60, military: 45 },
    },
    china: {
      name: { ru: "Китай", uk: "Китай", en: "China" },
      color: "#cf3d2e",
      leader: "General Secretary Xi Jinping",
      government: { ru: "Однопартийное коммунистическое государство", uk: "Однопартійна комуністична держава", en: "One-party communist state" },
      stats: { stability: 75, economy: 90, military: 85 },
    },
    turkey: {
      name: { ru: "Турция", uk: "Туреччина", en: "Turkey" },
      color: "#4f9a8c",
      leader: "President Recep Tayyip Erdoğan",
      government: { ru: "Президентская республика", uk: "Президентська республіка", en: "Presidential republic" },
      stats: { stability: 50, economy: 45, military: 60 },
    },
    india: {
      name: { ru: "Индия", uk: "Індія", en: "India" },
      color: "#e0a458",
      leader: "PM Narendra Modi",
      government: { ru: "Федеративная парламентская республика", uk: "Федеративна парламентська республіка", en: "Federal parliamentary republic" },
      stats: { stability: 65, economy: 70, military: 70 },
    },
    japan: {
      name: { ru: "Япония", uk: "Японія", en: "Japan" },
      color: "#e6d6a6",
      leader: "PM Fumio Kishida",
      government: MONARCHY,
      stats: { stability: 75, economy: 85, military: 45 },
    },
    italy: {
      name: { ru: "Италия", uk: "Італія", en: "Italy" },
      color: "#5a9d55",
      leader: "PM Mario Draghi",
      government: PARLIAMENTARY,
      stats: { stability: 55, economy: 70, military: 45 },
    },
    iran: {
      name: { ru: "Иран", uk: "Іран", en: "Iran" },
      color: "#7fae86",
      leader: "Supreme Leader Ali Khamenei; President Ebrahim Raisi",
      government: { ru: "Исламская республика", uk: "Ісламська республіка", en: "Islamic republic" },
      stats: { stability: 45, economy: 30, military: 50 },
    },
    israel: {
      name: { ru: "Израиль", uk: "Ізраїль", en: "Israel" },
      color: "#7fa8d4",
      leader: "PM Naftali Bennett",
      government: PARLIAMENTARY,
      stats: { stability: 55, economy: 65, military: 70 },
    },
    moldova: {
      name: { ru: "Молдова", uk: "Молдова", en: "Moldova" },
      color: "#d4a65c",
      leader: "President Maia Sandu",
      government: PARLIAMENTARY,
      stats: { stability: 40, economy: 15, military: 5 },
    },
    georgia: {
      name: { ru: "Грузия", uk: "Грузія", en: "Georgia" },
      color: "#c96f6f",
      leader: "PM Irakli Garibashvili; President Salome Zourabichvili",
      government: PARLIAMENTARY,
      stats: { stability: 45, economy: 20, military: 15 },
    },
    kazakhstan: {
      name: { ru: "Казахстан", uk: "Казахстан", en: "Kazakhstan" },
      color: "#6fb1c4",
      leader: "President Kassym-Jomart Tokayev",
      government: { ru: "Президентская республика", uk: "Президентська республіка", en: "Presidential republic" },
      stats: { stability: 45, economy: 35, military: 20 },
    },
    finland: {
      name: { ru: "Финляндия", uk: "Фінляндія", en: "Finland" },
      color: "#e3dfd0",
      leader: "President Sauli Niinistö; PM Sanna Marin",
      government: PARLIAMENTARY,
      stats: { stability: 80, economy: 60, military: 40 },
    },
    sweden: {
      name: { ru: "Швеция", uk: "Швеція", en: "Sweden" },
      color: "#5a97c9",
      leader: "PM Magdalena Andersson",
      government: MONARCHY,
      stats: { stability: 80, economy: 65, military: 35 },
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
      leader: "President Klaus Iohannis",
      government: { ru: "Полупрезидентская республика", uk: "Напівпрезидентська республіка", en: "Semi-presidential republic" },
      stats: { stability: 55, economy: 45, military: 25 },
    },
    lithuania: {
      name: { ru: "Литва", uk: "Литва", en: "Lithuania" },
      color: "#c2c34f",
      leader: "President Gitanas Nausėda",
      government: PARLIAMENTARY,
      stats: { stability: 65, economy: 45, military: 10 },
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
      leader: "President Moon Jae-in",
      government: { ru: "Президентская республика", uk: "Президентська республіка", en: "Presidential republic" },
      stats: { stability: 65, economy: 75, military: 60 },
    },
    taiwan: {
      name: { ru: "Тайвань", uk: "Тайвань", en: "Taiwan" },
      color: "#5a86c6",
      leader: "President Tsai Ing-wen",
      government: { ru: "Полупрезидентская республика", uk: "Напівпрезидентська республіка", en: "Semi-presidential republic" },
      stats: { stability: 65, economy: 70, military: 40 },
    },
    "saudi-arabia": {
      name: { ru: "Саудовская Аравия", uk: "Саудівська Аравія", en: "Saudi Arabia" },
      color: "#6f9e5a",
      leader: "King Salman; Crown Prince Mohammed bin Salman",
      government: { ru: "Абсолютная монархия", uk: "Абсолютна монархія", en: "Absolute monarchy" },
      stats: { stability: 60, economy: 60, military: 45 },
    },
    brazil: {
      name: { ru: "Бразилия", uk: "Бразилія", en: "Brazil" },
      color: "#4f9a5f",
      leader: "President Jair Bolsonaro",
      government: { ru: "Федеративная президентская республика", uk: "Федеративна президентська республіка", en: "Federal presidential republic" },
      stats: { stability: 45, economy: 55, military: 35 },
    },
    canada: {
      name: { ru: "Канада", uk: "Канада", en: "Canada" },
      color: "#c44f4f",
      leader: "PM Justin Trudeau",
      government: MONARCHY,
      stats: { stability: 75, economy: 70, military: 30 },
    },
    australia: {
      name: { ru: "Австралия", uk: "Австралія", en: "Australia" },
      color: "#d88a5a",
      leader: "PM Scott Morrison",
      government: MONARCHY,
      stats: { stability: 75, economy: 65, military: 35 },
    },
  },
  wars: [
    {
      id: "russo-ukrainian-war",
      name: { ru: "Российско-украинская война", uk: "Російсько-українська війна", en: "Russo-Ukrainian War" },
      attackers: ["russia"],
      defenders: ["ukraine"],
      since: "2022-02-24",
    },
  ],
  alliances: withTreaties([
    {
      id: "un",
      kind: "organization",
      name: { ru: "Организация Объединённых Наций", uk: "Організація Об'єднаних Націй", en: "United Nations" },
      // Everyone but Kosovo, Northern Cyprus and Taiwan.
      members: [],
      allExcept: ["kosovo","northern-cyprus","taiwan"],
      since: "1945-10-24",
    },
    {
      id: "nato",
      name: { ru: "НАТО", uk: "НАТО", en: "NATO" },
      members: NATO_2022,
      since: "1949-04-04",
    },
    {
      id: "eu",
      kind: "organization",
      name: { ru: "Европейский союз", uk: "Європейський союз", en: "European Union" },
      members: EU_2022,
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
  ], TERMS_2022, TREATIES_2022),
  featured: ["ukraine", "russia", "usa", "belarus", "poland", "germany", "china", "uk", "turkey", "moldova"],
  // A week before the invasion: the Donbas line of contact where it stood since 2015, quiet on the map until a war; the "republics" not recognised.
  variants: {
    eve: {
      startDate: "2022-02-17",
      defaultStep: "week",
      tagline: {
        ru: "На линии в Донбассе снова рвутся снаряды, а вокруг Украины стоят 150 тысяч российских военных.",
        uk: "На лінії на Донбасі знову рвуться снаряди, а довкола України стоять 150 тисяч російських військових.",
        en: "Shells fall on the Donbas line again, and 150,000 Russian troops stand around Ukraine.",
      },
      story: {
        ru: "17 февраля 2022 года на линии соприкосновения в Донбассе, где с 2014 года украинская армия стоит против поддерживаемых Россией сил донецкой и луганской «республик», вспыхивает обстрел. Снаряд попадает в детский сад в Станице Луганской; наблюдатели ОБСЕ насчитывают за день сотни взрывов, и каждая сторона винит другую. Вашингтон предупреждает, что Россия может устроить провокацию как повод для войны.\n\nВокруг Украины – в России, в Беларуси и в оккупированном Крыму – за зиму собралось около 150 тысяч российских военных. Москва говорит, что после учений отводит часть войск; в НАТО не видят этому подтверждений. В декабре Россия потребовала гарантий, что НАТО не расширится дальше на восток и уйдёт из Восточной Европы, а два дня назад Госдума попросила Путина признать обе «республики» государствами.\n\nПрезидент Владимир Зеленский призывает к спокойствию, и жизнь в Киеве идёт своим чередом; западные посольства переехали во Львов, а США и Британия говорят, что вторжение может начаться в любой день. Запад обещает санкции небывалой жёсткости и шлёт оружие, но не войска; Европа покупает у России около сорока процентов газа, а Китай объявил о дружбе с Москвой без границ. Двинет ли Путин войска, признает ли республики, удовлетворится ли меньшим или его остановят переговоры, пока не решено.",
        uk: "17 лютого 2022 року на лінії зіткнення на Донбасі, де з 2014 року українська армія стоїть проти підтримуваних Росією сил донецької та луганської «республік», спалахує обстріл. Снаряд влучає в дитячий садок у Станиці Луганській; спостерігачі ОБСЄ нараховують за день сотні вибухів, і кожна сторона звинувачує іншу. Вашингтон попереджає, що Росія може влаштувати провокацію як привід для війни.\n\nДовкола України – у Росії, Білорусі та в окупованому Криму – за зиму зібралося близько 150 тисяч російських військових. Москва каже, що після навчань відводить частину військ; у НАТО не бачать цьому підтверджень. У грудні Росія зажадала гарантій, що НАТО не розшириться далі на схід і піде зі Східної Європи, а два дні тому Держдума попросила Путіна визнати обидві «республіки» державами.\n\nПрезидент Володимир Зеленський закликає до спокою, і життя в Києві йде своєю чергою; західні посольства переїхали до Львова, а США й Британія кажуть, що вторгнення може початися будь-якого дня. Захід обіцяє санкції небаченої жорсткості й надсилає зброю, але не війська; Європа купує в Росії близько сорока відсотків газу, а Китай оголосив про дружбу з Москвою без меж. Чи рушить Путін війська, чи визнає республіки, чи вдовольниться меншим, чи його зупинять переговори, поки не вирішено.",
        en: "On 17 February 2022 shelling flares along the line of contact in the Donbas, where Ukraine's army has faced the Russian-backed forces of the Donetsk and Luhansk 'republics' since 2014. A shell hits a kindergarten in Stanytsia Luhanska; the OSCE monitors count hundreds of explosions in a day, and each side blames the other. Washington warns that Russia may stage a provocation as a pretext for war.\n\nAround Ukraine, in Russia, in Belarus and in the occupied Crimea, some 150,000 Russian troops have gathered over the winter. Moscow says it is pulling some of them back after exercises; NATO sees no sign of it. In December Russia demanded guarantees that NATO would grow no further east and pull back from Eastern Europe, and two days ago its parliament asked Putin to recognise the two 'republics' as states.\n\nPresident Volodymyr Zelensky urges calm, and life in Kyiv goes on; Western embassies have moved to Lviv, and the United States and Britain say an invasion could come any day. The West promises sanctions of unprecedented severity and sends weapons, but no troops; Europe buys about forty per cent of its gas from Russia, and China has declared a friendship with Moscow without limits. Whether Putin moves, recognises the 'republics', settles for less or is stopped by talks is still open.",
      },
      briefing: {
        ru: "17 февраля 2022 года. На линии соприкосновения в Донбассе вспыхивают обстрелы, а около 150 тысяч российских военных стоят у границ Украины, в Беларуси и в Крыму. Москва говорит об отводе войск после учений; Вашингтон и Лондон предупреждают, что вторжение может начаться в любой день. Госдума попросила Путина признать донецкую и луганскую «республики», Европа зависит от российского газа, Китай заявил о «дружбе без границ» с Москвой. За неделю до вторжения его ещё можно предотвратить – или сделать неизбежным.",
        uk: "17 лютого 2022 року. На лінії зіткнення на Донбасі спалахують обстріли, а близько 150 тисяч російських військових стоять біля кордонів України, у Білорусі та в Криму. Москва говорить про відведення військ після навчань; Вашингтон і Лондон попереджають, що вторгнення може початися будь-якого дня. Держдума попросила Путіна визнати донецьку та луганську «республіки», Європа залежить від російського газу, Китай заявив про «дружбу без меж» із Москвою. За тиждень до вторгнення його ще можна відвернути – або зробити неминучим.",
        en: "17 February 2022. Shelling flares on the Donbas line of contact, and some 150,000 Russian troops stand on Ukraine's borders, in Belarus and in Crimea. Moscow speaks of a withdrawal after exercises; Washington and London warn that an invasion could come any day. The Duma has asked Putin to recognise the Donetsk and Luhansk 'republics', Europe depends on Russian gas, and China has declared a 'no limits' friendship with Moscow. A week before the invasion it can still be prevented – or made certain.",
      },
      context: `Date: Thursday 17 February 2022, a week before the invasion. Russia and Ukraine are not formally at war. Shelling has flared along the line of contact in Donbas since the morning: a kindergarten in Stanytsia Luhanska was hit, the OSCE Special Monitoring Mission records the most ceasefire violations in years, and the "DPR" and "LPR" accuse Kyiv of preparing an offensive, which Ukraine denies. Some 150,000 Russian troops (up to 190,000 with the proxies and the Rosgvardia, by US estimates) are deployed around Ukraine: in Russia's Bryansk, Kursk, Belgorod, Voronezh and Rostov regions, in Crimea, and in Belarus for the "Allied Resolve" exercises (10–20 February). On 15 February Moscow announced that some units were returning to base; NATO and the US see the opposite. The US and Britain warn publicly that an invasion, possibly after a staged pretext, could come any day; several Western embassies have moved from Kyiv to Lviv; US Secretary of State Antony Blinken sets out the evidence at the UN Security Council today. On 15 February the State Duma asked Putin to recognise the "DPR" and "LPR" as states; he has not done so. Russia's demands of December 2021 (no NATO membership for Ukraine, NATO's forces back to the lines of 1997) have been refused; Scholz was in Moscow on 15 February, Macron on 7 February; the Munich Security Conference opens on 18 February.
Background: Russia annexed Crimea in 2014 and has backed the separatist "DPR" and "LPR" in Donbas since then. On the map Crimea and Sevastopol are Ukrainian provinces held by Russia. The parts of Donetsk and Luhansk held by Russia's proxies since 2014 (about a third of each oblast) are not drawn separately: both oblasts are Ukrainian-held with Russia holding a share, the line of contact running through them; the line stays where it is until a war between Russia and Ukraine begins.
Ukraine (President Volodymyr Zelenskyy) has declared neither martial law nor mobilisation, and Zelenskyy urges calm against panic; its army has been retrained since 2014 and is receiving Javelins and NLAWs from the West. Belarus (Lukashenko) hosts Russian forces and is Russia's ally.
The West: the US (Biden) and UK (Johnson) promise severe sanctions on Russian banks and trade if Russia invades; Nord Stream 2 is built but not certified; the EU imports about 40% of its gas from Russia. NATO will not fight in Ukraine but reinforces its eastern flank; Finland and Sweden are neutral. Turkey controls the Straits under the Montreux Convention and sells Bayraktar drones to Ukraine. China declared a "no limits" partnership with Russia on 4 February. India keeps out. Oil is above $90 a barrel.
Real history for reference: on 21 February Putin recognised the "DPR" and "LPR" and ordered troops into them; on 22 February Germany halted Nord Stream 2's certification; on 24 February Russia invaded Ukraine from Russia, Belarus and Crimea; Kyiv held; Russia withdrew from the north at the end of March; Ukraine counter-attacked around Kharkiv and Kherson in autumn 2022; Russia annexed four regions on paper in September and mobilised; Finland joined NATO in 2023 and Sweden in 2024. None of this is fixed.`,
    },
    // The tutorial: the first morning of the invasion, played as Ukraine, a week a turn, with a guide
    // and its first turns written in advance (engine/tutorial.ts). One enemy, one front on three sides,
    // one plain first aim – hold Kyiv – and a world that answers at once, so every panel has something to show.
    tutorial: {
      startDate: "2022-02-24",
      defaultStep: "week",
      player: "ukraine",
      featured: ["ukraine"],
      tagline: {
        ru: "Первое утро войны: вы ведёте Украину, а подсказки показывают, как играть.",
        uk: "Перший ранок війни: ви ведете Україну, а підказки показують, як грати.",
        en: "The first morning of the war: you lead Ukraine, and a guide shows you how to play.",
      },
      story: {
        ru: "24 февраля 2022 года, пять часов утра. Россия начала полномасштабное вторжение: ракеты бьют по аэродромам и складам по всей стране, колонны идут на Киев из Беларуси, на Харьков и Сумы из России, на Херсон из Крыма. Над Гостомелем под Киевом высаживается вертолётный десант.\n\nЭто обучающая партия. Вы играете за правительство Украины, а пошаговые подсказки проводят вас через одну неделю войны: прочитать карту, отдать первый приказ простыми словами, закончить ход и прочитать отчёт, спросить министра, заглянуть в армию и экономику, написать письмо другому правительству.\n\nПервые ходы написаны заранее, поэтому для них не нужен ни аккаунт, ни ведущий в интернете: на ваши приказы ответит готовый сценарий, а решать, что из них выйдет, будет сам движок игры. Потом вы выберете, кто играет мир дальше: настоящий ведущий на вашей подписке ChatGPT или упрощённый офлайн-ведущий.",
        uk: "24 лютого 2022 року, п'ята ранку. Росія почала повномасштабне вторгнення: ракети б'ють по аеродромах і складах по всій країні, колони йдуть на Київ із Білорусі, на Харків і Суми з Росії, на Херсон із Криму. Над Гостомелем під Києвом висаджується вертолітний десант.\n\nЦе навчальна партія. Ви граєте за уряд України, а покрокові підказки проводять вас через один тиждень війни: прочитати мапу, віддати перший наказ простими словами, завершити хід і прочитати звіт, запитати міністра, зазирнути в армію та економіку, написати листа іншому уряду.\n\nПерші ходи написано заздалегідь, тож для них не потрібні ні акаунт, ні ведучий в інтернеті: на ваші накази відповість готовий сценарій, а вирішувати, що з них вийде, буде сам рушій гри. Потім ви оберете, хто гратиме світ далі: справжній ведучий на вашій підписці ChatGPT чи спрощений офлайн-ведучий.",
        en: "24 February 2022, five in the morning. Russia has begun a full-scale invasion: missiles strike airfields and depots across the country, columns head for Kyiv from Belarus, for Kharkiv and Sumy from Russia, and for Kherson from Crimea. Helicopters land paratroopers at Hostomel, just outside Kyiv.\n\nThis is the tutorial. You play the government of Ukraine, and a step-by-step guide takes you through one week of the war: read the map, give a first order in plain words, end the turn and read the report, ask a minister, look at the army and the economy, and write to another government.\n\nThe first turns are written in advance, so they need no account and no game master online: a prepared script answers your orders, and the game's own engine decides what comes of them. Then you choose who plays the world from there: the real game master on your own ChatGPT plan, or the simplified offline one.",
      },
      briefing: {
        ru: "24 февраля 2022 года, утро. Россия напала на Украину с севера, востока и юга: ракетные удары по всей стране, бои за аэродром в Гостомеле под Киевом, колонны на Харьков, Сумы, Чернигов и Херсон. Вы – правительство Украины. Ваша первая задача проста: удержать Киев и выиграть время, пока мир решает, чем помочь. Подсказки покажут, как отдавать приказы и читать, что из них вышло.",
        uk: "24 лютого 2022 року, ранок. Росія напала на Україну з півночі, сходу й півдня: ракетні удари по всій країні, бої за аеродром у Гостомелі під Києвом, колони на Харків, Суми, Чернігів і Херсон. Ви – уряд України. Ваше перше завдання просте: утримати Київ і виграти час, поки світ вирішує, чим допомогти. Підказки покажуть, як віддавати накази й читати, що з них вийшло.",
        en: "The morning of 24 February 2022. Russia has attacked Ukraine from the north, the east and the south: missile strikes across the country, a battle for the airfield at Hostomel outside Kyiv, columns on Kharkiv, Sumy, Chernihiv and Kherson. You are the government of Ukraine. Your first task is plain: hold Kyiv and buy time while the world decides how to help. The guide shows you how to give orders and read what came of them.",
      },
      context: `Date: Thursday 24 February 2022, the first morning of Russia's full-scale invasion of Ukraine. This is the TUTORIAL start: the player is new to the game, plays Ukraine, and a turn is a week. Its first turns were written in advance; when the game master takes over, write as for any game, but keep the story plain and easy to follow: name the places, say who holds what, and give each order a clear verdict.
Around 05:00 Moscow time Vladimir Putin announced a "special military operation"; Russia launched missile and air strikes across Ukraine and a ground invasion on several axes: from Belarus toward Kyiv (the helicopter assault on Hostomel airport, the columns through Chernobyl toward Ivankiv), from Russia toward Chernihiv, Sumy and Kharkiv, from the occupied Donbas, and from Crimea toward Kherson and Melitopol. About 190,000 Russian troops and proxies take part.
Ukraine (President Volodymyr Zelenskyy) declares martial law and general mobilisation and breaks off relations with Russia; the territorial defence hands out rifles in Kyiv; Zelenskyy stays in the capital. Belarus (Lukashenko) lets Russia attack from its territory but is not formally at war.
The West: the US (Biden) and UK (Johnson) warned of the invasion publicly; sanctions on Russian banks, SWIFT exclusion and central-bank asset freezes are being prepared; Germany halted Nord Stream 2 certification on 22 February; the EU imports about 40% of its gas from Russia. NATO will not fight in Ukraine but reinforces its eastern flank. Turkey controls the Straits under the Montreux Convention. China declared a "no limits" partnership with Russia on 4 February.
Background: Russia annexed Crimea in 2014 and has backed the separatist "DPR" and "LPR" in Donbas since then; it recognised them on 21 February 2022. On the map Crimea and Sevastopol are Ukrainian provinces held by Russia; about a third of the Donetsk and Luhansk oblasts is held by Russia's proxies, the line of contact running through them.
Real history for reference: Kyiv holds; Kherson falls on 2 March; Mariupol is besieged; Russia withdraws from the north at the end of March. None of this is fixed after the tutorial's written turns.`,
    },
  },
};

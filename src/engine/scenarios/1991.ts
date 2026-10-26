import type { CountrySeed, Localized, Scenario, Stats } from "../types";
import { TERMS_1991, TREATIES_1991, withTreaties } from "./treaties";
import { COUNTRIES_TODAY, ISLANDS_TODAY } from "./islands";

const SOVIET_REPUBLIC: Localized = {
  ru: "Союзная республика в составе СССР",
  uk: "Союзна республіка у складі СРСР",
  en: "Union republic of the USSR",
};

const YUGOSLAV_REPUBLIC: Localized = {
  ru: "Республика в составе Югославии",
  uk: "Республіка у складі Югославії",
  en: "Republic of Yugoslavia",
};

/** A republic that exists politically but holds no land until it breaks away. */
function republic(name: Localized, color: string, leader: string, government: Localized, stats: Stats): CountrySeed {
  return { name, color, leader, government, stats, dormant: true };
}

const SOVIET_REPUBLICS = [
  "russia", "byelarus", "ukraine", "moldova", "estonia", "latvia", "lithuania", "georgia",
  "armenia", "azerbaijan", "kazakhstan", "uzbekistan", "turkmenistan", "kyrgyzstan", "tajikistan",
];

const YUGOSLAV_REPUBLICS = ["slovenia", "croatia", "serbia", "bosnia-and-herzegovina", "macedonia", "montenegro"];

// The lines of the model's background that the date and its eve share.
const REPUBLICS_1991 = `In the map, all fifteen Soviet republics are regions owned by the USSR. They exist as dormant countries (Russia/RSFSR, Ukraine, Byelarus, Kazakhstan, the Baltic states and others) that hold no land until they break away: grant them their own region with a transfer (mode "liberate") when they become independent in the story. Lithuania declared independence in March 1990, Latvia and Estonia are in transition, Georgia declared independence in April 1991; Armenia and Azerbaijan are fighting over Nagorno-Karabakh.`;
const YUGOSLAVIA_1991 = `Yugoslavia is drawn as one country; its republics are dormant countries too. Slovenia and Croatia declared independence on 25 June 1991; after the Ten-Day War the federal army withdrew from Slovenia, and fighting between Croatian forces and the Yugoslav People's Army with Serb rebels is escalating. Czechoslovakia (Havel) is still one state; its Czech and Slovak parts can separate. Eritrea's EPLF has controlled Eritrea since May 1991 but it is still formally part of Ethiopia.`;
const WORLD_1991 = `Elsewhere: Germany reunified in October 1990. The Warsaw Pact dissolved on 1 July 1991 and COMECON in June. The Gulf War ended in February 1991; Saddam Hussein holds on in Iraq. START I was signed on 31 July. China (Deng Xiaoping, General Secretary Jiang Zemin) is recovering from Tiananmen. Japan's bubble has just burst. India faces a balance-of-payments crisis and has begun liberalising.`;

export const scenario1991: Scenario = {
  id: "1991",
  map: "world_1994",
  startDate: "1991-08-19",
  defaultStep: "month",
  title: {
    ru: "Августовский путч",
    uk: "Серпневий путч",
    en: "The August Coup",
  },
  tagline: {
    ru: "Горбачёв заперт в Форосе, в Москве танки, а Союз ещё жив – пока.",
    uk: "Горбачов замкнений у Форосі, у Москві танки, а Союз ще живий – поки що.",
    en: "Gorbachev is locked up in Foros, tanks are in Moscow, and the Union is still alive – for now.",
  },
  story: {
    ru: "Ранним утром 19 августа 1991 года советское радио сообщает, что Михаил Горбачёв не может исполнять обязанности «по состоянию здоровья» и власть перешла к Государственному комитету по чрезвычайному положению во главе с вице-президентом Геннадием Янаевым, куда вошли руководители КГБ, армии и МВД. Горбачёв заперт на даче в Форосе в Крыму, в Москву входят танки.\n\nПутчисты хотят сорвать новый Союзный договор, который должны подписать 20 августа и который передаёт республикам большую часть власти Москвы. Борис Ельцин, в июне избранный президентом России, отказывается подчиниться: с танка у здания российского парламента, Белого дома, он призывает к сопротивлению, и люди начинают строить баррикады. Прибалтийские республики, Грузия и другие уже объявили независимость или идут к ней.\n\nЗа рубежом холодная война заканчивается. В прошлом октябре объединилась Германия, в июле распался Варшавский договор, а в советских магазинах не хватает еды и товаров. Западные правительства поддерживали реформы Горбачёва словами и кредитами. Подчинится ли армия комитету, пойдут ли республики за Москвой или за Ельциным и как ответит мир, решит судьбу Союза.",
    uk: "Рано-вранці 19 серпня 1991 року радянське радіо повідомляє, що Михайло Горбачов не може виконувати обов'язки «за станом здоров'я» і влада перейшла до Державного комітету з надзвичайного стану на чолі з віцепрезидентом Геннадієм Янаєвим, до якого ввійшли керівники КДБ, армії та МВС. Горбачов замкнений на дачі у Форосі в Криму, до Москви входять танки.\n\nПутчисти хочуть зірвати новий Союзний договір, який мають підписати 20 серпня і який передає республікам більшу частину влади Москви. Борис Єльцин, у червні обраний президентом Росії, відмовляється підкоритися: з танка біля будівлі російського парламенту, Білого дому, він закликає до опору, і люди починають будувати барикади. Балтійські республіки, Грузія та інші вже проголосили незалежність або йдуть до неї.\n\nЗа кордоном холодна війна закінчується. Торік у жовтні об'єдналася Німеччина, у липні розпався Варшавський договір, а в радянських крамницях бракує їжі й товарів. Західні уряди підтримували реформи Горбачова словами й кредитами. Чи підкориться армія комітетові, чи підуть республіки за Москвою чи за Єльциним і як відповість світ, вирішить долю Союзу.",
    en: "Early on 19 August 1991 Soviet radio announces that Mikhail Gorbachev cannot carry out his duties \"for reasons of health\" and that a State Committee on the State of Emergency has taken power, led by Vice-President Gennady Yanayev with the heads of the KGB, the army and the interior ministry. Gorbachev is held at his dacha at Foros in the Crimea, and tanks roll into Moscow.\n\nThe plotters want to stop the new Union Treaty, due to be signed on 20 August, which would hand much of Moscow's power to the republics. Boris Yeltsin, elected President of Russia in June, refuses to obey: from a tank outside the Russian parliament, the White House, he calls for resistance, and crowds begin to build barricades. The Baltic republics, Georgia and others have already declared independence or are moving towards it.\n\nAbroad the Cold War is ending. Germany was reunited last October, the Warsaw Pact dissolved in July, and the Soviet shops are short of food and goods. Western governments have backed Gorbachev's reforms with words and credit. Whether the army obeys the committee, whether the republics follow Moscow or Yeltsin, and how the world answers will decide what becomes of the Union.",
  },
  briefing: {
    ru: "19 августа 1991 года. ГКЧП объявил, что Горбачёв «по состоянию здоровья» не может исполнять обязанности, и ввёл чрезвычайное положение. Ельцин призывает к сопротивлению с танка у Белого дома. Завтра должны были подписать новый Союзный договор. Прибалтика, Грузия и Молдова рвутся к независимости, Югославия уже воюет. Сохраните Союз, развалите его или постройте что-то третье – страны и республики доступны все.",
    uk: "19 серпня 1991 року. ДКНС оголосив, що Горбачов «за станом здоров'я» не може виконувати обов'язки, і запровадив надзвичайний стан. Єльцин закликає до опору з танка біля Білого дому. Завтра мали підписати новий Союзний договір. Балтія, Грузія та Молдова рвуться до незалежності, Югославія вже воює. Збережіть Союз, розваліть його або збудуйте щось третє – доступні всі країни й республіки.",
    en: "19 August 1991. The State Committee on the State of Emergency has announced that Gorbachev cannot serve \"for health reasons\" and declared a state of emergency. Yeltsin calls for resistance from a tank outside the White House. The new Union Treaty was to be signed tomorrow. The Baltics, Georgia and Moldova push for independence; Yugoslavia is already at war. Save the Union, break it up or build something else – every country and republic is playable.",
  },
  context: `Date: 19 August 1991, first day of the August Coup. The State Committee on the State of Emergency (GKChP) – Vice-President Gennady Yanayev, KGB chief Vladimir Kryuchkov, Defence Minister Dmitry Yazov, Interior Minister Boris Pugo, Premier Valentin Pavlov and others – has isolated President Mikhail Gorbachev at his dacha in Foros, Crimea, declared him incapacitated and sent troops and tanks into Moscow. Russian President Boris Yeltsin (elected June 1991) has denounced the coup from atop a tank outside the Russian White House; crowds are gathering. The new Union Treaty (a looser "Union of Sovereign States") was to be signed on 20 August.
${REPUBLICS_1991}
${YUGOSLAVIA_1991}
${WORLD_1991}
Real history for reference: the coup collapses on 21 August; Ukraine declares independence on 24 August; the Communist Party is banned; the Baltics are recognised in September; the Belovezha Accords of 8 December create the CIS; the USSR is dissolved on 26 December. None of this is fixed.`,
  aliases: {
    "korea-democratic-people-s-republic-of": "north-korea",
    "korea-republic-of": "south-korea",
    "tanzania-united-republic-of": "tanzania",
    burma: "myanmar",
    "gambia-the": "gambia",
    "turkish-cypriot-administered-area": "northern-cyprus",
    "united-states": "usa",
    "united-kingdom": "uk",
    trinidad: "trinidad-and-tobago",
  },
  owners: {
    ...Object.fromEntries(SOVIET_REPUBLICS.map((r) => [r, "ussr"])),
    ...Object.fromEntries(YUGOSLAV_REPUBLICS.map((r) => [r, "yugoslavia"])),
    "czech-republic": "czechoslovakia",
    slovakia: "czechoslovakia",
    eritrea: "ethiopia",
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
  // Islands and slivers the 1994 source draws with a neighbour (islands.ts).
  modernOwners: COUNTRIES_TODAY,
  provinceOwners: ISLANDS_TODAY,
  countries: {
    ussr: {
      name: { ru: "СССР", uk: "СРСР", en: "Soviet Union" },
      color: "#a3292c",
      leader: "President Mikhail Gorbachev (isolated in Foros); the GKChP under acting President Gennady Yanayev claims power",
      government: { ru: "Союзное государство в кризисе", uk: "Союзна держава в кризі", en: "Federal union in crisis" },
      stats: { stability: 15, economy: 25, military: 80 },
    },
    usa: {
      name: { ru: "США", uk: "США", en: "United States" },
      color: "#6680c2",
      leader: "President George H. W. Bush",
      government: { ru: "Федеративная республика", uk: "Федеративна республіка", en: "Federal republic" },
      stats: { stability: 70, economy: 90, military: 95 },
    },
    uk: {
      name: { ru: "Великобритания", uk: "Велика Британія", en: "United Kingdom" },
      color: "#d0666b",
      leader: "PM John Major",
      government: { ru: "Конституционная монархия", uk: "Конституційна монархія", en: "Constitutional monarchy" },
      stats: { stability: 65, economy: 75, military: 55 },
    },
    france: {
      name: { ru: "Франция", uk: "Франція", en: "France" },
      color: "#4a72b8",
      leader: "President François Mitterrand",
      government: { ru: "Пятая республика", uk: "П'ята республіка", en: "Fifth Republic" },
      stats: { stability: 60, economy: 75, military: 55 },
    },
    germany: {
      name: { ru: "Германия", uk: "Німеччина", en: "Germany" },
      color: "#6f7277",
      leader: "Chancellor Helmut Kohl",
      government: { ru: "Федеративная парламентская республика", uk: "Федеративна парламентська республіка", en: "Federal parliamentary republic" },
      stats: { stability: 70, economy: 85, military: 45 },
    },
    china: {
      name: { ru: "КНР", uk: "КНР", en: "China" },
      color: "#cf3d2e",
      leader: "Paramount leader Deng Xiaoping; General Secretary Jiang Zemin",
      government: { ru: "Однопартийное коммунистическое государство", uk: "Однопартійна комуністична держава", en: "One-party communist state" },
      stats: { stability: 60, economy: 50, military: 65 },
    },
    japan: {
      name: { ru: "Япония", uk: "Японія", en: "Japan" },
      color: "#e6d6a6",
      leader: "PM Toshiki Kaifu",
      government: { ru: "Конституционная монархия", uk: "Конституційна монархія", en: "Constitutional monarchy" },
      stats: { stability: 75, economy: 90, military: 30 },
    },
    yugoslavia: {
      name: { ru: "Югославия", uk: "Югославія", en: "Yugoslavia" },
      color: "#8873b3",
      leader: "Federal Presidency (Stjepan Mesić, disputed); PM Ante Marković",
      government: { ru: "Федерация в распаде", uk: "Федерація в розпаді", en: "Collapsing federation" },
      stats: { stability: 10, economy: 25, military: 45 },
    },
    czechoslovakia: {
      name: { ru: "Чехословакия", uk: "Чехословаччина", en: "Czechoslovakia" },
      color: "#6d9bd0",
      leader: "President Václav Havel",
      government: { ru: "Федеративная республика", uk: "Федеративна республіка", en: "Federal republic" },
      stats: { stability: 55, economy: 40, military: 30 },
    },
    poland: {
      name: { ru: "Польша", uk: "Польща", en: "Poland" },
      color: "#d27b93",
      leader: "President Lech Wałęsa",
      government: { ru: "Парламентская республика", uk: "Парламентська республіка", en: "Parliamentary republic" },
      stats: { stability: 50, economy: 30, military: 30 },
    },
    iraq: {
      name: { ru: "Ирак", uk: "Ірак", en: "Iraq" },
      color: "#9a8f5f",
      leader: "President Saddam Hussein",
      government: { ru: "Баасистская диктатура", uk: "Баасистська диктатура", en: "Ba'athist dictatorship" },
      stats: { stability: 30, economy: 15, military: 35 },
    },
    india: {
      name: { ru: "Индия", uk: "Індія", en: "India" },
      color: "#e0a458",
      leader: "PM P. V. Narasimha Rao",
      government: { ru: "Федеративная парламентская республика", uk: "Федеративна парламентська республіка", en: "Federal parliamentary republic" },
      stats: { stability: 45, economy: 35, military: 55 },
    },
    ethiopia: {
      name: { ru: "Эфиопия", uk: "Ефіопія", en: "Ethiopia" },
      color: "#7aaa5a",
      leader: "Transitional President Meles Zenawi",
      government: { ru: "Переходное правительство", uk: "Перехідний уряд", en: "Transitional government" },
      stats: { stability: 30, economy: 10, military: 30 },
    },
    russia: republic(
      { ru: "Россия (РСФСР)", uk: "Росія (РРФСР)", en: "Russia (RSFSR)" },
      "#4f7d4c",
      "President Boris Yeltsin",
      SOVIET_REPUBLIC,
      { stability: 40, economy: 30, military: 10 },
    ),
    ukraine: republic(
      { ru: "Украина", uk: "Україна", en: "Ukraine" },
      "#e0b93c",
      "Chairman of the Verkhovna Rada Leonid Kravchuk",
      SOVIET_REPUBLIC,
      { stability: 50, economy: 30, military: 5 },
    ),
    byelarus: republic(
      { ru: "Белоруссия", uk: "Білорусь", en: "Byelorussia" },
      "#7fa86f",
      "Chairman of the Supreme Soviet Mikalay Dzyemyantsyey",
      SOVIET_REPUBLIC,
      { stability: 55, economy: 25, military: 5 },
    ),
    kazakhstan: republic(
      { ru: "Казахстан", uk: "Казахстан", en: "Kazakhstan" },
      "#6fb1c4",
      "President Nursultan Nazarbayev",
      SOVIET_REPUBLIC,
      { stability: 55, economy: 20, military: 5 },
    ),
    estonia: republic(
      { ru: "Эстония", uk: "Естонія", en: "Estonia" },
      "#4d7fb8",
      "Chairman of the Supreme Council Arnold Rüütel",
      SOVIET_REPUBLIC,
      { stability: 60, economy: 20, military: 2 },
    ),
    latvia: republic(
      { ru: "Латвия", uk: "Латвія", en: "Latvia" },
      "#8f4652",
      "Chairman of the Supreme Council Anatolijs Gorbunovs",
      SOVIET_REPUBLIC,
      { stability: 55, economy: 20, military: 2 },
    ),
    lithuania: republic(
      { ru: "Литва", uk: "Литва", en: "Lithuania" },
      "#c2c34f",
      "Chairman of the Supreme Council Vytautas Landsbergis",
      SOVIET_REPUBLIC,
      { stability: 60, economy: 20, military: 3 },
    ),
    georgia: republic(
      { ru: "Грузия", uk: "Грузія", en: "Georgia" },
      "#c96f6f",
      "President Zviad Gamsakhurdia",
      SOVIET_REPUBLIC,
      { stability: 30, economy: 15, military: 5 },
    ),
    armenia: republic(
      { ru: "Армения", uk: "Вірменія", en: "Armenia" },
      "#d9895c",
      "Chairman of the Supreme Council Levon Ter-Petrosyan",
      SOVIET_REPUBLIC,
      { stability: 40, economy: 15, military: 5 },
    ),
    azerbaijan: republic(
      { ru: "Азербайджан", uk: "Азербайджан", en: "Azerbaijan" },
      "#4f9bb0",
      "President Ayaz Mutallibov",
      SOVIET_REPUBLIC,
      { stability: 35, economy: 20, military: 5 },
    ),
    moldova: republic(
      { ru: "Молдавия", uk: "Молдова", en: "Moldova" },
      "#d4a65c",
      "President Mircea Snegur",
      SOVIET_REPUBLIC,
      { stability: 35, economy: 15, military: 2 },
    ),
    uzbekistan: republic(
      { ru: "Узбекистан", uk: "Узбекистан", en: "Uzbekistan" },
      "#5f8fd0",
      "President Islam Karimov",
      SOVIET_REPUBLIC,
      { stability: 50, economy: 15, military: 3 },
    ),
    turkmenistan: republic(
      { ru: "Туркмения", uk: "Туркменістан", en: "Turkmenistan" },
      "#7fae7a",
      "President Saparmurat Niyazov",
      SOVIET_REPUBLIC,
      { stability: 55, economy: 15, military: 2 },
    ),
    kyrgyzstan: republic(
      { ru: "Киргизия", uk: "Киргизстан", en: "Kyrgyzstan" },
      "#c45a5a",
      "President Askar Akayev",
      SOVIET_REPUBLIC,
      { stability: 45, economy: 10, military: 2 },
    ),
    tajikistan: republic(
      { ru: "Таджикистан", uk: "Таджикистан", en: "Tajikistan" },
      "#d8a76b",
      "Chairman of the Supreme Soviet Kahar Makhkamov",
      SOVIET_REPUBLIC,
      { stability: 30, economy: 10, military: 2 },
    ),
    slovenia: republic(
      { ru: "Словения", uk: "Словенія", en: "Slovenia" },
      "#6aa0a0",
      "President of the Presidency Milan Kučan",
      YUGOSLAV_REPUBLIC,
      { stability: 65, economy: 35, military: 5 },
    ),
    croatia: republic(
      { ru: "Хорватия", uk: "Хорватія", en: "Croatia" },
      "#7f8fc9",
      "President Franjo Tuđman",
      YUGOSLAV_REPUBLIC,
      { stability: 35, economy: 25, military: 10 },
    ),
    serbia: republic(
      { ru: "Сербия", uk: "Сербія", en: "Serbia" },
      "#ad5b52",
      "President Slobodan Milošević",
      YUGOSLAV_REPUBLIC,
      { stability: 45, economy: 20, military: 15 },
    ),
    "bosnia-and-herzegovina": republic(
      { ru: "Босния и Герцеговина", uk: "Боснія і Герцеговина", en: "Bosnia and Herzegovina" },
      "#c9a46a",
      "President of the Presidency Alija Izetbegović",
      YUGOSLAV_REPUBLIC,
      { stability: 25, economy: 15, military: 3 },
    ),
    macedonia: republic(
      { ru: "Македония", uk: "Македонія", en: "Macedonia" },
      "#d98c5f",
      "President Kiro Gligorov",
      YUGOSLAV_REPUBLIC,
      { stability: 45, economy: 10, military: 2 },
    ),
    montenegro: republic(
      { ru: "Черногория", uk: "Чорногорія", en: "Montenegro" },
      "#9e7b6b",
      "President Momir Bulatović",
      YUGOSLAV_REPUBLIC,
      { stability: 50, economy: 10, military: 2 },
    ),
    eritrea: republic(
      { ru: "Эритрея", uk: "Еритрея", en: "Eritrea" },
      "#6fb09a",
      "EPLF leader Isaias Afwerki",
      { ru: "Де-факто независимая территория", uk: "Де-факто незалежна територія", en: "De facto independent territory" },
      { stability: 50, economy: 5, military: 10 },
    ),
  },
  wars: [
    {
      id: "croatian-war",
      name: { ru: "Война в Хорватии", uk: "Війна в Хорватії", en: "Croatian War of Independence" },
      attackers: ["yugoslavia"],
      defenders: ["croatia"],
      since: "1991-03-31",
    },
    {
      id: "karabakh",
      name: { ru: "Карабахский конфликт", uk: "Карабаський конфлікт", en: "Nagorno-Karabakh conflict" },
      attackers: ["armenia"],
      defenders: ["azerbaijan"],
      since: "1988-02-20",
    },
  ],
  alliances: withTreaties([
    {
      id: "un",
      kind: "organization",
      name: { ru: "Организация Объединённых Наций", uk: "Організація Об'єднаних Націй", en: "United Nations" },
      // Everyone but the Soviet republics (Ukraine and Byelarus held seats of their own), Yugoslavia's republics, both Koreas (they joined in September), Switzerland, Taiwan and a few small states.
      members: [],
      allExcept: ["estonia","latvia","lithuania","armenia","azerbaijan","georgia","kazakhstan","kyrgyzstan","moldova","russia","tajikistan","turkmenistan","uzbekistan","bosnia-and-herzegovina","croatia","macedonia","montenegro","serbia","slovenia","eritrea","north-korea","south-korea","switzerland","taiwan","northern-cyprus","tonga","andorra"],
      since: "1945-10-24",
    },
    {
      id: "nato",
      name: { ru: "НАТО", uk: "НАТО", en: "NATO" },
      members: [
        "usa", "uk", "france", "germany", "italy", "canada", "netherlands", "belgium", "luxembourg",
        "denmark", "norway", "iceland", "portugal", "spain", "greece", "turkey",
      ],
      since: "1949-04-04",
    },
    {
      id: "european-communities",
      kind: "organization",
      name: { ru: "Европейские сообщества", uk: "Європейські співтовариства", en: "European Communities" },
      members: [
        "france", "germany", "italy", "netherlands", "belgium", "luxembourg",
        "uk", "ireland", "denmark", "greece", "spain", "portugal",
      ],
      since: "1957-03-25",
    },
  ], TERMS_1991, TREATIES_1991),
  featured: ["ussr", "russia", "ukraine", "usa", "yugoslavia", "china", "germany", "kazakhstan", "lithuania", "georgia"],
  // A week before the coup: Gorbachev on holiday in the Crimea, the Union Treaty due on 20 August, the hardliners still in their offices.
  variants: {
    eve: {
      startDate: "1991-08-12",
      defaultStep: "week",
      tagline: {
        ru: "Горбачёв отдыхает в Крыму, а через восемь дней республики подпишут новый Союзный договор.",
        uk: "Горбачов відпочиває в Криму, а за вісім днів республіки підпишуть новий Союзний договір.",
        en: "Gorbachev is on holiday in the Crimea, and in eight days the republics sign a new Union Treaty.",
      },
      story: {
        ru: "12 августа 1991 года Михаил Горбачёв отдыхает на даче в Форосе на крымском побережье. К 20 августа он должен вернуться в Москву: в этот день Россия, Казахстан и Узбекистан подпишут новый Союзный договор, а за ними и другие республики. Договор превратит Советский Союз в более свободный Союз Суверенных Государств и передаст республикам большую часть власти Москвы над налогами, ресурсами и собственными делами.\n\nМногие в Кремле видят в договоре конец государства. Председатель КГБ Владимир Крючков, министр обороны Дмитрий Язов, премьер-министр Валентин Павлов и другие месяцами смотрят, как Горбачёв уступает, и Крючков поручил своим офицерам изучить, что потребуется для чрезвычайного положения. Борис Ельцин, в июне избранный президентом России, выводит её из-под власти Союза; Прибалтика, Грузия и Молдова хотят уйти совсем, а Армения и Азербайджан воюют за Карабах.\n\nЗа рубежом холодная война заканчивается. В прошлом октябре объединилась Германия, в июле распался Варшавский договор, а две недели назад Буш и Горбачёв подписали договор о сокращении стратегических вооружений; в Киеве Буш предостерёг украинцев от «самоубийственного национализма». В советских магазинах не хватает еды, цены растут. Будет ли подписан договор, опередят ли его люди из окружения Горбачёва и как ответят республики и мир, решит судьбу Союза.",
        uk: "12 серпня 1991 року Михайло Горбачов відпочиває на дачі у Форосі на кримському узбережжі. До 20 серпня він має повернутися до Москви: того дня Росія, Казахстан і Узбекистан підпишуть новий Союзний договір, а за ними й інші республіки. Договір перетворить Радянський Союз на вільніший Союз Суверенних Держав і передасть республікам більшу частину влади Москви над податками, ресурсами й власними справами.\n\nБагато хто в Кремлі бачить у договорі кінець держави. Голова КДБ Володимир Крючков, міністр оборони Дмитро Язов, прем'єр-міністр Валентин Павлов та інші місяцями дивляться, як Горбачов поступається, і Крючков доручив своїм офіцерам вивчити, що знадобиться для надзвичайного стану. Борис Єльцин, у червні обраний президентом Росії, виводить її з-під влади Союзу; Балтія, Грузія та Молдова хочуть піти зовсім, а Вірменія й Азербайджан воюють за Карабах.\n\nЗа кордоном холодна війна закінчується. Торік у жовтні об'єдналася Німеччина, у липні розпався Варшавський договір, а два тижні тому Буш і Горбачов підписали договір про скорочення стратегічних озброєнь; у Києві Буш застеріг українців від «самогубчого націоналізму». У радянських крамницях бракує їжі, ціни зростають. Чи буде підписано договір, чи випередять його люди з оточення Горбачова і як відповідять республіки та світ, вирішить долю Союзу.",
        en: "On 12 August 1991 Mikhail Gorbachev is on holiday at his dacha at Foros on the Crimean coast. He is due back in Moscow for 20 August, when Russia, Kazakhstan and Uzbekistan are to sign a new Union Treaty, with other republics to follow. It would turn the Soviet Union into a looser Union of Sovereign States and hand the republics much of Moscow's power over taxes, resources and their own affairs.\n\nMany in the Kremlin see the treaty as the end of the state. KGB chairman Vladimir Kryuchkov, Defence Minister Dmitry Yazov, Prime Minister Valentin Pavlov and others have watched Gorbachev give ground for months, and Kryuchkov has had his officers study what a state of emergency would take. Boris Yeltsin, elected President of Russia in June, is pulling Russia out from under the Union's rule; the Baltic republics, Georgia and Moldova want to leave altogether, and Armenia and Azerbaijan are fighting over Karabakh.\n\nAbroad the Cold War is ending. Germany was reunited last October, the Warsaw Pact dissolved in July, and two weeks ago Bush and Gorbachev signed a treaty cutting their strategic arms; in Kyiv Bush warned the Ukrainians against 'suicidal nationalism'. In the Soviet shops food is short and prices climb. Whether the treaty is signed, whether the men around Gorbachev act first, and how the republics and the world answer will decide what becomes of the Union.",
      },
      briefing: {
        ru: "12 августа 1991 года. Горбачёв в отпуске в Форосе, а 20 августа должны подписать новый Союзный договор, который передаёт республикам большую часть власти Москвы. Руководители КГБ, армии и правительства считают, что он погубит государство. Ельцин правит Россией по-своему, Прибалтика, Грузия и Молдова рвутся к независимости, Югославия уже воюет. За неделю до путча: сохраните Союз, развалите его или постройте что-то третье – страны и республики доступны все.",
        uk: "12 серпня 1991 року. Горбачов у відпустці у Форосі, а 20 серпня мають підписати новий Союзний договір, що передає республікам більшу частину влади Москви. Керівники КДБ, армії та уряду вважають, що він занапастить державу. Єльцин править Росією по-своєму, Балтія, Грузія та Молдова рвуться до незалежності, Югославія вже воює. За тиждень до путчу: збережіть Союз, розваліть його або збудуйте щось третє – доступні всі країни й республіки.",
        en: "12 August 1991. Gorbachev is on holiday at Foros, and on 20 August the new Union Treaty is to be signed, handing the republics most of Moscow's power. The heads of the KGB, the army and the government believe it will destroy the state. Yeltsin runs Russia his own way, the Baltics, Georgia and Moldova push for independence, and Yugoslavia is already at war. A week before the coup: save the Union, break it up or build something else – every country and republic is playable.",
      },
      context: `Date: Monday 12 August 1991, a week before the August Coup. President Mikhail Gorbachev has been on holiday at his dacha in Foros, Crimea, since 4 August, and is to fly to Moscow for the signing of the new Union Treaty on 20 August: a looser "Union of Sovereign States" with a common president, army and foreign policy, the republics keeping most taxes and resources. Russia, Kazakhstan and Uzbekistan are to sign first, Byelorussia, Tajikistan and others later; Ukraine has not agreed, and the Baltic states, Georgia, Moldova and Armenia refuse. Vice-President Gennady Yanayev stands in for Gorbachev in Moscow.
The hardliners: KGB chairman Vladimir Kryuchkov, Defence Minister Dmitry Yazov, Interior Minister Boris Pugo, Premier Valentin Pavlov, Gorbachev's chief of staff Valery Boldin, Oleg Baklanov of the defence industry and others see the treaty as the end of the USSR. On 29 July at Novo-Ogaryovo, Gorbachev, Yeltsin and Nazarbayev privately discussed replacing Pavlov, Kryuchkov and Yazov after the signing, and the KGB recorded it. Since early August Kryuchkov has had KGB officers draft the measures of a state of emergency. Gorbachev was warned of a coup in June, through the US ambassador, and dismissed it. Russian President Boris Yeltsin (elected June 1991) banned Communist Party cells from Russia's state bodies by his decree of 20 July. On 1 August President Bush, in Kyiv, warned against "suicidal nationalism".
${REPUBLICS_1991}
${YUGOSLAVIA_1991}
${WORLD_1991}
Real history for reference: on 18 August the plotters cut off Gorbachev at Foros, and on 19 August the State Committee on the State of Emergency (GKChP) under Yanayev declared him unable to serve and sent tanks into Moscow; Yeltsin resisted from the Russian White House, and the coup collapsed on 21 August; Ukraine declared independence on 24 August; the Communist Party was banned; the Baltics were recognised in September; the Belovezha Accords of 8 December created the CIS; the USSR was dissolved on 26 December. None of this is fixed.`,
      leaders: {
        ussr: "President Mikhail Gorbachev (on holiday at Foros); Premier Valentin Pavlov",
      },
    },
  },
};

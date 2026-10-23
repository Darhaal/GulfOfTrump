import type { Scenario } from "../types";
import { L, MODERN, seed } from "./coldwar";
import { TERMS_1999, TREATIES_1999, withTreaties } from "./treaties";

const REPUBLIC = L("Presidential republic", "Президентская республика", "Президентська республіка");
const PARLIAMENTARY = L("Parliamentary republic", "Парламентская республика", "Парламентська республіка");

/** A movement or a breakaway state that holds land it does not own (dormant: it owns none until it breaks away). */
const movement = (name: ReturnType<typeof L>, color: string, leader: string, government: ReturnType<typeof L>) => ({
  ...seed(name, color, leader, government, { stability: 50, economy: 5, military: 10 }),
  dormant: true,
});

export const scenario1999: Scenario = {
  id: "1999",
  map: "world_1994",
  startDate: "1999-03-24",
  defaultStep: "month",
  title: {
    ru: "Бомбардировки Югославии",
    uk: "Бомбардування Югославії",
    en: "NATO Bombs Yugoslavia",
  },
  tagline: {
    ru: "Переговоры в Рамбуйе провалены, и на Югославию падают первые крылатые ракеты НАТО.",
    uk: "Переговори в Рамбуйє провалено, і на Югославію падають перші крилаті ракети НАТО.",
    en: "Rambouillet has failed, and NATO's first cruise missiles fall on Yugoslavia.",
  },
  story: {
    ru: "Вечером 24 марта 1999 года НАТО начинает воздушные удары по Союзной Республике Югославии: переговоры в Рамбуйе и Париже не заставили Белград принять урегулирование для Косова с войсками НАТО на своей территории. Крылатые ракеты и самолёты бьют по ПВО и военным объектам в Сербии, Черногории и Косове. Впервые альянс воюет против суверенного государства, и делает это без мандата Совета Безопасности ООН.\n\nВ Косове, где большинство населения – албанцы, бои между Армией освобождения Косова и югославскими и сербскими силами с 1998 года только росли, сотни тысяч людей изгнаны из домов. Президент Слободан Милошевич считает Косово частью Сербии и отказывается пускать иностранные войска. Наблюдатели ОБСЕ только что покинули край.\n\nРоссия осуждает бомбардировки: накануне премьер-министр Евгений Примаков, летевший в Вашингтон, развернул самолёт над Атлантикой. Протестуют Китай и многие другие страны. Венгрия, Польша и Чехия вступили в НАТО всего двенадцать дней назад. Сломит ли воздушная кампания Белград быстро, пошлёт ли НАТО наземные войска и что сделает Россия, определит облик Балкан и Европы после холодной войны.",
    uk: "Увечері 24 березня 1999 року НАТО починає повітряні удари по Союзній Республіці Югославії: переговори в Рамбуйє і Парижі не змусили Белград прийняти врегулювання для Косова з військами НАТО на своїй території. Крилаті ракети й літаки б'ють по ППО та військових об'єктах у Сербії, Чорногорії й Косові. Уперше альянс воює проти суверенної держави, і робить це без мандата Ради Безпеки ООН.\n\nУ Косові, де більшість населення – албанці, бої між Армією визволення Косова та югославськими й сербськими силами з 1998 року лише зростали, сотні тисяч людей вигнано з домівок. Президент Слободан Мілошевич вважає Косово частиною Сербії і відмовляється пускати іноземні війська. Спостерігачі ОБСЄ щойно залишили край.\n\nРосія засуджує бомбардування: напередодні прем'єр-міністр Євгеній Примаков, який летів до Вашингтона, розвернув літак над Атлантикою. Протестують Китай і багато інших країн. Угорщина, Польща і Чехія вступили до НАТО лише дванадцять днів тому. Чи зламає повітряна кампанія Белград швидко, чи пошле НАТО наземні війська і що зробить Росія, визначить обличчя Балкан і Європи після холодної війни.",
    en: "On the evening of 24 March 1999 NATO begins air strikes on the Federal Republic of Yugoslavia, after talks at Rambouillet and Paris failed to bring Belgrade to accept a settlement for Kosovo with NATO troops on its soil. Cruise missiles and aircraft strike air defences and military targets across Serbia, Montenegro and Kosovo. It is the first time the alliance goes to war against a sovereign state, and it does so without a mandate from the UN Security Council.\n\nIn Kosovo, where most people are Albanian, fighting between the Kosovo Liberation Army and Yugoslav and Serbian forces has grown since 1998, and hundreds of thousands have been driven from their homes. President Slobodan Milošević holds Kosovo to be part of Serbia and refuses foreign troops. The OSCE monitors have just left the province.\n\nRussia condemns the bombing: Prime Minister Yevgeny Primakov, flying to Washington, turned his plane round over the Atlantic the day before. China and many other countries protest too. Hungary, Poland and the Czech Republic joined NATO only twelve days ago. Whether the air campaign breaks Belgrade quickly, whether NATO sends ground troops and what Russia does will shape the Balkans and Europe after the Cold War.",
  },
  briefing: {
    ru: "24 марта 1999 года. Милошевич отверг соглашение в Рамбуйе, наблюдатели ОБСЕ покинули Косово, сербская армия и полиция начали наступление на Армию освобождения Косова. Вечером НАТО – девятнадцать стран, из них трое приняты две недели назад, – начинает операцию «Союзническая сила» без мандата ООН. Россия в ярости, Черногория Джукановича держится в стороне, сотни тысяч косоваров бегут в Албанию и Македонию. Удержите Косово, сломайте Белград или остановите войну – играть можно за любую страну.",
    uk: "24 березня 1999 року. Мілошевич відкинув угоду в Рамбуйє, спостерігачі ОБСЄ залишили Косово, сербська армія й поліція почали наступ на Армію визволення Косова. Увечері НАТО – дев'ятнадцять країн, троє з них прийняті два тижні тому, – розпочинає операцію «Союзницька сила» без мандата ООН. Росія в люті, Чорногорія Джукановича тримається осторонь, сотні тисяч косоварів тікають до Албанії та Македонії. Утримайте Косово, зламайте Белград або зупиніть війну – грати можна за будь-яку країну.",
    en: "24 March 1999. Milošević has rejected the Rambouillet accords, the OSCE monitors have left Kosovo, and the Yugoslav army and police have opened an offensive against the Kosovo Liberation Army. Tonight NATO – nineteen countries, three of them members for two weeks – launches Operation Allied Force without a UN mandate. Russia is furious, Đukanović's Montenegro keeps its distance, and hundreds of thousands of Kosovars flee to Albania and Macedonia. Hold Kosovo, break Belgrade or stop the war – every country is playable.",
  },
  context: `Date: 24 March 1999. At about 19:00 GMT NATO began Operation Allied Force: cruise missiles and aircraft of thirteen allies (the US, Britain, France, Germany, Italy, the Netherlands, Canada, Belgium, Spain, Denmark, Norway, Portugal, Turkey) strike Yugoslav air defences and the army, without a UN Security Council mandate, which Russia and China would veto. Secretary General Javier Solana ordered the strikes; SACEUR General Wesley Clark commands. It is the first time Germany's forces have fought since 1945. The allies expect Milošević to give in after a few days of bombing; no ground invasion is planned.
Yugoslavia (the Federal Republic of Serbia and Montenegro): President Slobodan Milošević; Serbian President Milan Milutinović; the Yugoslav Army (about 110,000) and the special police (MUP). Kosovo, 90 % Albanian, lost its autonomy in 1989; the Kosovo Liberation Army (KLA, political head Hashim Thaçi) has fought an insurgency since 1998 and holds part of the countryside – Drenica, the west near Albania, the Llap – drawn as its share of the provinces; Ibrahim Rugova leads the non-violent "Republic of Kosova". The Račak massacre (January) led to the Rambouillet talks; the Kosovo Albanians signed on 18 March, Belgrade refused; the OSCE Kosovo Verification Mission left on 20 March. Yugoslav forces are now driving Albanians out of Kosovo in large numbers. Montenegro (President Milo Đukanović) is pro-Western, refuses the war and runs its own police and economy inside the federation.
Neighbours: Albania (President Rexhep Meidani, PM Pandeli Majko) and Macedonia (President Kiro Gligorov, PM Ljubčo Georgievski; NATO troops are stationed there) will receive the refugees; Bosnia lives under the Dayton Agreement (1995) with SFOR troops and High Representative Carlos Westendorp; Croatia (Franjo Tuđman, gravely ill) and Slovenia are calm; Hungary, the Czech Republic and Poland joined NATO on 12 March 1999; Bulgaria and Romania want to; Greece is in NATO but its people oppose the war.
Russia: President Boris Yeltsin (ill, impeachment pending); Prime Minister Yevgeny Primakov, flying to Washington, turned his plane round over the Atlantic on hearing of the strikes. The economy is recovering from the default of August 1998. Chechnya is de facto independent since 1996 (President Aslan Maskhadov). Russia threatens to leave the NATO–Russia Founding Act and to send its fleet; its 200 paratroopers serve in Bosnia.
The world: the US (President Bill Clinton, acquitted by the Senate in February; Secretary of State Madeleine Albright); Britain (Tony Blair), France (Jacques Chirac, PM Lionel Jospin), Germany (Gerhard Schröder, Foreign Minister Joschka Fischer of the Greens), Italy (Massimo D'Alema). The euro was launched in January; the European Commission resigned on 16 March. China (Jiang Zemin, Zhu Rongji) condemns the strikes. India and Pakistan tested nuclear weapons in 1998 and signed the Lahore Declaration in February. The Taliban hold about nine tenths of Afghanistan; Ahmad Shah Massoud's Northern Alliance holds the north-east and the Panjshir. Iraq (Saddam Hussein) is under sanctions; US and British aircraft patrol the no-fly zones after Operation Desert Fox in December. The Second Congo War (since August 1998): Rwanda and Uganda, with rebel movements, hold the east and north of the Congo against Laurent-Désiré Kabila, backed by Angola, Zimbabwe and Namibia. Eritrea and Ethiopia fight over Badme. Armenian forces hold Nagorno-Karabakh and the land around it since the 1994 ceasefire; Abkhazia is outside Georgia's control since 1993.
Real history for reference: the bombing lasted 78 days; some 850,000 Kosovo Albanians were expelled; NATO struck the Chinese embassy in Belgrade on 7 May; Milošević accepted a peace plan on 3 June, brokered by Finland's Ahtisaari and Russia's Chernomyrdin; KFOR entered Kosovo on 12 June, Russian paratroopers raced to Pristina airport first; UN Resolution 1244 put Kosovo under UN administration. None of this is fixed.`,
  aliases: {},
  owners: {},
  // Every modern country as itself (coldwar.ts), with what was different in March 1999.
  modernOwners: {
    ...MODERN,
    SRB: "yugoslavia",
    KOS: "yugoslavia",
    MNE: "yugoslavia",
    SDS: "sudan",
    TLS: "indonesia",
    HKG: "china",
    SAH: "morocco",
    CYN: "northern-cyprus",
    PSX: "israel",
    MDV: "maldives",
    MUS: "mauritius",
    COM: "comoros",
    CPV: "cape-verde",
    STP: "sao-tome-and-principe",
    SYC: "seychelles",
    VUT: "vanuatu",
    KIR: "kiribati",
    FSM: "micronesia",
    MHL: "marshall-islands",
    PLW: "palau",
    NRU: "nauru",
    TUV: "tuvalu",
  },
  provinceOwners: {
    // The Panjshir valley and the north-east, Massoud's.
    "af-badakhshan": "northern-alliance",
    "af-takhar": "northern-alliance",
    "af-parwan": "northern-alliance",
    "af-kapisa": "northern-alliance",
  },
  provinceControllers: {
    // Nagorno-Karabakh and the districts around it, held by Armenian forces since the 1994 ceasefire.
    "az-yukhari-garabakh-economic-region": "armenia",
    "az-kalbajar-lachin-economic-region": "armenia",
    "az-kalbajar-lachin-economic-region-p2": "armenia",
    "ge-abkhazia": "abkhazia",
    "ru-chechen-republic": "chechnya",
    // The Second Congo War: Rwanda and its allies hold the Kivus and Maniema.
    "cd-north-kivu": "rwanda",
    "cd-south-kivu": "rwanda",
    "cd-maniema": "rwanda",
  },
  provinceContested: {
    // The KLA's share of Kosovo's countryside.
    "xk-pec": "kosovo",
    "xk-akovica": "kosovo",
    "xk-pristina": "kosovo",
    "xk-kosovska-mitrovica": "kosovo",
    "xk-prizren": "kosovo",
    "xk-urosevac": "kosovo",
    "xk-gnjilane": "kosovo",
    // Uganda and its rebels in the north of the Congo.
    "cd-orientale": "uganda",
    "cd-equateur": "uganda",
    // The front on the Shomali plain north of Kabul.
    "af-parwan-2": "northern-alliance",
  },
  provinceHeld: {
    "xk-pec": 30,
    "xk-akovica": 30,
    "xk-pristina": 25,
    "xk-kosovska-mitrovica": 25,
    "xk-prizren": 15,
    "xk-urosevac": 20,
    "xk-gnjilane": 10,
    "cd-orientale": 45,
    "cd-equateur": 35,
    "af-parwan-2": 40,
  },
  // The Kosovo Albanians' protest against Belgrade, as old as the end of autonomy in 1989.
  protests: [
    {
      title: L("Kosovo Albanians against Belgrade's rule", "Косовские албанцы против власти Белграда", "Косовські албанці проти влади Белграда"),
      country: "yugoslavia",
      stage: "uprising",
      size: 300,
      where: ["xk-pristina", "xk-pec", "xk-akovica", "xk-prizren"],
      demands: L("Independence for Kosovo", "Независимость Косова", "Незалежність Косова"),
      by: L("The KLA (Hashim Thaçi); Ibrahim Rugova's Democratic League", "АОК (Хашим Тачи); Демократический союз Ибрагима Руговы", "АВК (Хашим Тачі); Демократичний союз Ібрагіма Ругови"),
      support: 18,
      organisation: 70,
      backer: "albania",
      killed: 2000,
    },
  ],
  loyalty: { yugoslavia: { army: 75, police: 85, security: 80, elites: 60 } },
  // People in 1999 (UN estimates, thousands); the rest a tenth more than in 1991.
  people: {
    others: 1.1,
    byCountry: {
      RUS: 146300, UKR: 49700, DEU: 82100, CHN: 1253000, IND: 1016000, USA: 279000, JPN: 126700, BRA: 171000, PAK: 138000, NGA: 119000,
      BGD: 128000, IDN: 206000, SRB: 7600, KOS: 1900, MNE: 610, BIH: 3750, HRV: 4500, SVN: 1990, MKD: 2020, ALB: 3100, COD: 47000,
      ETH: 64500, AFG: 19500, IRQ: 23000, BLR: 10000, KAZ: 15000, POL: 38600, ROU: 22500, BGR: 8200, HUN: 10200, CZE: 10300,
      GEO: 4800, ARM: 3100, AZE: 8000, MDA: 3600, EST: 1400, LVA: 2400, LTU: 3500,
    },
  },
  countries: {
    yugoslavia: seed(L("Yugoslavia (FRY)", "Югославия (СРЮ)", "Югославія (СРЮ)"), "#8873b3", "President Slobodan Milošević; Serbian President Milan Milutinović", L("Authoritarian federal republic", "Авторитарная федеративная республика", "Авторитарна федеративна республіка"), { stability: 40, economy: 15, military: 35 }),
    kosovo: movement(L("Kosovo (KLA)", "Косово (АОК)", "Косово (АВК)"), "#8aa0c4", "KLA political head Hashim Thaçi; Ibrahim Rugova, President of the self-declared Republic of Kosova", L("Insurgency and a parallel state", "Повстанцы и параллельное государство", "Повстанці й паралельна держава")),
    montenegro: movement(L("Montenegro", "Черногория", "Чорногорія"), "#9e7b6b", "President Milo Đukanović", L("Republic of Yugoslavia drifting away from it", "Республика в составе Югославии, отдаляющаяся от неё", "Республіка у складі Югославії, що віддаляється від неї")),
    usa: seed(L("United States", "США", "США"), "#6680c2", "President Bill Clinton; Secretary of State Madeleine Albright", L("Federal republic", "Федеративная республика", "Федеративна республіка"), { stability: 70, economy: 95, military: 98 }),
    russia: seed(L("Russia", "Россия", "Росія"), "#4f7d4c", "President Boris Yeltsin; PM Yevgeny Primakov", L("Semi-presidential republic", "Президентско-парламентская республика", "Президентсько-парламентська республіка"), { stability: 30, economy: 20, military: 60 }),
    uk: seed(L("United Kingdom", "Великобритания", "Велика Британія"), "#d0666b", "PM Tony Blair", L("Constitutional monarchy", "Конституционная монархия", "Конституційна монархія"), { stability: 75, economy: 75, military: 55 }),
    france: seed(L("France", "Франция", "Франція"), "#4a72b8", "President Jacques Chirac; PM Lionel Jospin", L("Fifth Republic", "Пятая республика", "П'ята республіка"), { stability: 65, economy: 75, military: 55 }),
    germany: seed(L("Germany", "Германия", "Німеччина"), "#6f7277", "Chancellor Gerhard Schröder; Foreign Minister Joschka Fischer", L("Federal parliamentary republic", "Федеративная парламентская республика", "Федеративна парламентська республіка"), { stability: 70, economy: 80, military: 40 }),
    italy: seed(L("Italy", "Италия", "Італія"), "#5a9d55", "PM Massimo D'Alema", PARLIAMENTARY, { stability: 55, economy: 65, military: 35 }),
    greece: seed(L("Greece", "Греция", "Греція"), "#79a9d4", "PM Costas Simitis", PARLIAMENTARY, { stability: 60, economy: 45, military: 30 }),
    china: seed(L("China", "КНР", "КНР"), "#cf3d2e", "President Jiang Zemin; Premier Zhu Rongji", L("One-party communist state", "Однопартийное коммунистическое государство", "Однопартійна комуністична держава"), { stability: 65, economy: 45, military: 70 }),
    "bosnia-and-herzegovina": seed(L("Bosnia and Herzegovina", "Босния и Герцеговина", "Боснія і Герцеговина"), "#c9a46a", "Presidency of Alija Izetbegović (chair), Živko Radišić and Ante Jelavić; High Representative Carlos Westendorp", L("Federation of two entities under international supervision", "Союз двух образований под международным надзором", "Союз двох утворень під міжнародним наглядом"), { stability: 35, economy: 10, military: 10 }),
    croatia: seed(L("Croatia", "Хорватия", "Хорватія"), "#7f8fc9", "President Franjo Tuđman", REPUBLIC, { stability: 50, economy: 30, military: 25 }),
    slovenia: seed(L("Slovenia", "Словения", "Словенія"), "#6aa0a0", "President Milan Kučan; PM Janez Drnovšek", PARLIAMENTARY, { stability: 70, economy: 45, military: 5 }),
    macedonia: seed(L("Macedonia", "Македония", "Македонія"), "#d98c5f", "President Kiro Gligorov; PM Ljubčo Georgievski", PARLIAMENTARY, { stability: 40, economy: 10, military: 5 }),
    albania: seed(L("Albania", "Албания", "Албанія"), "#a4453f", "President Rexhep Meidani; PM Pandeli Majko", PARLIAMENTARY, { stability: 25, economy: 5, military: 5 }),
    bulgaria: seed(L("Bulgaria", "Болгария", "Болгарія"), "#6c9a50", "President Petar Stoyanov; PM Ivan Kostov", PARLIAMENTARY, { stability: 50, economy: 15, military: 15 }),
    romania: seed(L("Romania", "Румыния", "Румунія"), "#d8bd46", "President Emil Constantinescu; PM Radu Vasile", L("Semi-presidential republic", "Президентско-парламентская республика", "Президентсько-парламентська республіка"), { stability: 40, economy: 15, military: 20 }),
    hungary: seed(L("Hungary", "Венгрия", "Угорщина"), "#9fb06a", "PM Viktor Orbán", PARLIAMENTARY, { stability: 65, economy: 30, military: 15 }),
    ukraine: seed(L("Ukraine", "Украина", "Україна"), "#e0b93c", "President Leonid Kuchma", L("Semi-presidential republic", "Президентско-парламентская республика", "Президентсько-парламентська республіка"), { stability: 45, economy: 10, military: 35 }),
    belarus: seed(L("Belarus", "Беларусь", "Білорусь"), "#7fa86f", "President Alexander Lukashenko", L("Authoritarian republic", "Авторитарная республика", "Авторитарна республіка"), { stability: 55, economy: 15, military: 20 }),
    turkey: seed(L("Turkey", "Турция", "Туреччина"), "#4f9a8c", "PM Bülent Ecevit; President Süleyman Demirel", PARLIAMENTARY, { stability: 45, economy: 35, military: 55 }),
    india: seed(L("India", "Индия", "Індія"), "#e0a458", "PM Atal Bihari Vajpayee", L("Federal parliamentary republic", "Федеративная парламентская республика", "Федеративна парламентська республіка"), { stability: 50, economy: 35, military: 55 }),
    pakistan: seed(L("Pakistan", "Пакистан", "Пакистан"), "#3f7f4f", "PM Nawaz Sharif; army chief General Pervez Musharraf", PARLIAMENTARY, { stability: 35, economy: 15, military: 45 }),
    afghanistan: seed(L("Afghanistan (Taliban)", "Афганистан (талибы)", "Афганістан (таліби)"), "#b0a070", "Mullah Mohammad Omar, leader of the Islamic Emirate", L("Islamic emirate", "Исламский эмират", "Ісламський емірат"), { stability: 40, economy: 2, military: 25 }),
    "northern-alliance": seed(L("Northern Alliance", "Северный альянс", "Північний альянс"), "#5f8a7a", "President Burhanuddin Rabbani; commander Ahmad Shah Massoud", L("The internationally recognised Islamic State of Afghanistan", "Признанное в мире Исламское Государство Афганистан", "Визнана у світі Ісламська Держава Афганістан"), { stability: 50, economy: 2, military: 10 }),
    iraq: seed(L("Iraq", "Ирак", "Ірак"), "#9a8f5f", "President Saddam Hussein", L("Ba'athist dictatorship under sanctions", "Баасистская диктатура под санкциями", "Баасистська диктатура під санкціями"), { stability: 45, economy: 10, military: 30 }),
    iran: seed(L("Iran", "Иран", "Іран"), "#7fae86", "Supreme Leader Ali Khamenei; President Mohammad Khatami", L("Islamic republic", "Исламская республика", "Ісламська республіка"), { stability: 55, economy: 25, military: 40 }),
    israel: seed(L("Israel", "Израиль", "Ізраїль"), "#7fa8d4", "PM Benjamin Netanyahu", PARLIAMENTARY, { stability: 55, economy: 55, military: 65 }),
    "dr-congo": seed(L("DR Congo", "ДР Конго", "ДР Конго"), "#6f8fb0", "President Laurent-Désiré Kabila", L("Presidential regime at war", "Президентский режим в состоянии войны", "Президентський режим у стані війни"), { stability: 15, economy: 5, military: 15 }),
    rwanda: seed(L("Rwanda", "Руанда", "Руанда"), "#8fae6a", "Vice-President Paul Kagame; President Pasteur Bizimungu", L("Transitional government led by the RPF", "Переходное правительство во главе с РПФ", "Перехідний уряд на чолі з РПФ"), { stability: 50, economy: 5, military: 25 }),
    uganda: seed(L("Uganda", "Уганда", "Уганда"), "#c4a46a", "President Yoweri Museveni", REPUBLIC, { stability: 50, economy: 10, military: 20 }),
    ethiopia: seed(L("Ethiopia", "Эфиопия", "Ефіопія"), "#7aaa5a", "PM Meles Zenawi", L("Federal parliamentary republic", "Федеративная парламентская республика", "Федеративна парламентська республіка"), { stability: 45, economy: 5, military: 35 }),
    eritrea: seed(L("Eritrea", "Эритрея", "Еритрея"), "#6fb09a", "President Isaias Afwerki", L("One-party state", "Однопартийное государство", "Однопартійна держава"), { stability: 55, economy: 3, military: 25 }),
    armenia: seed(L("Armenia", "Армения", "Вірменія"), "#d9895c", "President Robert Kocharyan", REPUBLIC, { stability: 45, economy: 10, military: 20 }),
    azerbaijan: seed(L("Azerbaijan", "Азербайджан", "Азербайджан"), "#4f9bb0", "President Heydar Aliyev", REPUBLIC, { stability: 55, economy: 15, military: 15 }),
    georgia: seed(L("Georgia", "Грузия", "Грузія"), "#c96f6f", "President Eduard Shevardnadze", REPUBLIC, { stability: 35, economy: 8, military: 8 }),
    abkhazia: movement(L("Abkhazia", "Абхазия", "Абхазія"), "#6f9e8a", "President Vladislav Ardzinba", L("Unrecognised breakaway republic", "Непризнанная отделившаяся республика", "Невизнана відокремлена республіка")),
    chechnya: movement(L("Chechnya (Ichkeria)", "Чечня (Ичкерия)", "Чечня (Ічкерія)"), "#5f7a5a", "President Aslan Maskhadov", L("Unrecognised breakaway republic", "Непризнанная отделившаяся республика", "Невизнана відокремлена республіка")),
    japan: seed(L("Japan", "Япония", "Японія"), "#e6d6a6", "PM Keizō Obuchi", L("Constitutional monarchy", "Конституционная монархия", "Конституційна монархія"), { stability: 70, economy: 80, military: 35 }),
    "north-korea": seed(L("North Korea", "КНДР", "КНДР"), "#a05a6a", "Kim Jong-il, Chairman of the National Defence Commission", L("Communist dynasty", "Коммунистическая династия", "Комуністична династія"), { stability: 50, economy: 3, military: 45 }),
    "south-korea": seed(L("South Korea", "Республика Корея", "Республіка Корея"), "#7f9fc9", "President Kim Dae-jung", REPUBLIC, { stability: 60, economy: 50, military: 45 }),
    taiwan: seed(L("Taiwan", "Тайвань", "Тайвань"), "#5a86c6", "President Lee Teng-hui", REPUBLIC, { stability: 65, economy: 60, military: 35 }),
    indonesia: seed(L("Indonesia", "Индонезия", "Індонезія"), "#c4614f", "President B. J. Habibie", L("Presidential republic in transition", "Президентская республика в переходный период", "Президентська республіка в перехідний період"), { stability: 25, economy: 15, military: 30 }),
  },
  wars: [
    {
      id: "allied-force",
      name: L("NATO's war against Yugoslavia", "Война НАТО против Югославии", "Війна НАТО проти Югославії"),
      attackers: ["usa", "uk", "france", "germany", "italy", "netherlands", "canada", "belgium", "spain", "denmark", "norway", "portugal", "turkey"],
      defenders: ["yugoslavia"],
      since: "1999-03-24",
    },
    {
      id: "kosovo-war",
      name: L("Kosovo War", "Война в Косове", "Війна в Косові"),
      attackers: ["kosovo"],
      defenders: ["yugoslavia"],
      since: "1998-02-28",
    },
    {
      id: "second-congo-war",
      name: L("Second Congo War", "Вторая конголезская война", "Друга конголезька війна"),
      attackers: ["rwanda", "uganda", "burundi"],
      defenders: ["dr-congo", "angola", "zimbabwe", "namibia"],
      since: "1998-08-02",
    },
    {
      id: "eritrean-ethiopian-war",
      name: L("Eritrean–Ethiopian War", "Эритрейско-эфиопская война", "Еритрейсько-ефіопська війна"),
      attackers: ["eritrea"],
      defenders: ["ethiopia"],
      since: "1998-05-06",
    },
    {
      id: "afghan-civil-war",
      name: L("Afghan Civil War", "Гражданская война в Афганистане", "Громадянська війна в Афганістані"),
      attackers: ["afghanistan"],
      defenders: ["northern-alliance"],
      since: "1996-09-27",
    },
  ],
  alliances: withTreaties(
    [
      {
        id: "un",
        kind: "organization",
        name: L("United Nations", "Организация Объединённых Наций", "Організація Об'єднаних Націй"),
        // Yugoslavia's seat is suspended in a dispute over succession; Afghanistan's is held by the Northern Alliance's government, not the Taliban.
        members: [],
        allExcept: ["yugoslavia", "afghanistan", "kosovo", "montenegro", "abkhazia", "chechnya", "taiwan", "northern-cyprus", "switzerland", "tonga", "kiribati", "nauru", "tuvalu"],
        since: "1945-10-24",
      },
      {
        id: "nato",
        name: L("NATO", "НАТО", "НАТО"),
        members: [
          "usa", "uk", "france", "germany", "italy", "canada", "netherlands", "belgium", "luxembourg", "denmark", "norway", "iceland",
          "portugal", "spain", "greece", "turkey", "poland", "czechia", "hungary",
        ],
        since: "1949-04-04",
      },
      {
        id: "eu",
        kind: "organization",
        name: L("European Union", "Европейский союз", "Європейський союз"),
        members: [
          "france", "germany", "italy", "netherlands", "belgium", "luxembourg", "uk", "ireland", "denmark", "greece", "spain", "portugal",
          "austria", "finland", "sweden",
        ],
        since: "1993-11-01",
      },
    ],
    TERMS_1999,
    TREATIES_1999,
  ),
  featured: ["yugoslavia", "usa", "russia", "kosovo", "montenegro", "albania", "macedonia", "germany", "uk", "china"],
};

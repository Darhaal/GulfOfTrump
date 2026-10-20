import type { Scenario } from "../types";
import { ADEN, all, CZECHOSLOVAK, EAST_GERMAN, L, MODERN, seed, SOVIET, YUGOSLAV } from "./coldwar";
import { TERMS_1964, TREATIES_1964, withTreaties } from "./treaties";

const COMMUNIST = L("One-party communist state", "Однопартийное коммунистическое государство", "Однопартійна комуністична держава");
const PEOPLES_REPUBLIC = L("People's republic", "Народная республика", "Народна республіка");
const JUNTA = L("Military government", "Военное правительство", "Військовий уряд");

/** The provinces of the map north of the 17th parallel (the line runs through the north-central coast, held by the North). */
const NORTH_VIETNAM = ["vn-tay-bac", "vn-ong-bac", "vn-northeast-vietnam", "vn-ong-b-c", "vn-ong-bang-song-hong", "vn-red-river-delta", "vn-bac-trung-bo"];

export const scenario1964: Scenario = {
  id: "1964",
  map: "world_1994",
  startDate: "1964-08-02",
  defaultStep: "month",
  title: {
    ru: "Тонкинский инцидент",
    uk: "Тонкінський інцидент",
    en: "The Gulf of Tonkin",
  },
  tagline: {
    ru: "Торпедные катера Северного Вьетнама атакуют эсминец «Мэддокс». Джонсон хочет развязанных рук.",
    uk: "Торпедні катери Північного В'єтнаму атакують есмінець «Меддокс». Джонсон хоче розв'язаних рук.",
    en: "North Vietnamese torpedo boats attack the destroyer Maddox. Johnson wants a free hand.",
  },
  briefing: {
    ru: "2 августа 1964 года. В Тонкинском заливе три северовьетнамских торпедных катера атакуют американский эсминец «Мэддокс». В Сайгоне генерал Нгуен Кхань держится полгода после переворота; Вьетконг контролирует половину деревни, Патет Лао взял Долину кувшинов. В Москве Хрущёв доживает последние месяцы у власти, Китай готовит свою первую бомбу, Сукарно грозит «сокрушить Малайзию». Эскалация, переговоры или нейтралитет — играть можно за любую страну.",
    uk: "2 серпня 1964 року. У Тонкінській затоці три північнов'єтнамські торпедні катери атакують американський есмінець «Меддокс». У Сайгоні генерал Нгуєн Кхань тримається пів року після перевороту; В'єтконг контролює половину села, Патет Лао взяв Долину глеків. У Москві Хрущов доживає останні місяці при владі, Китай готує свою першу бомбу, Сукарно погрожує «розчавити Малайзію». Ескалація, переговори чи нейтралітет — грати можна за будь-яку країну.",
    en: "2 August 1964. In the Gulf of Tonkin three North Vietnamese torpedo boats attack the US destroyer Maddox. In Saigon General Nguyen Khanh has hung on for six months since his coup; the Viet Cong hold half the countryside and the Pathet Lao have taken the Plain of Jars. Khrushchev has months left in power, China is about to test its first bomb, and Sukarno vows to 'crush Malaysia'. Escalate, negotiate or stay out — every country is playable.",
  },
  context: `Date: 2 August 1964. In the afternoon three North Vietnamese P-4 torpedo boats attacked the US destroyer USS Maddox, on an intelligence patrol (DESOTO) in the Gulf of Tonkin, after South Vietnamese commando raids on the North's coast (OPLAN 34A, run by the US). The Maddox and aircraft from the carrier Ticonderoga damaged the boats; the Maddox took one machine-gun bullet. President Lyndon B. Johnson (in office since Kennedy's assassination in November 1963, running against Barry Goldwater in November) and Defense Secretary Robert McNamara must decide how to answer; a congressional resolution giving the President a free hand has been drafted for months.
Vietnam: divided at the 17th parallel since the Geneva Accords of 1954 (the elections they promised never took place). North Vietnam: President Ho Chi Minh, First Secretary Le Duan, General Vo Nguyen Giap; it sends men and arms down the Ho Chi Minh Trail through Laos. South Vietnam: General Nguyen Khanh, who seized power in January 1964, three months after the coup that killed Ngo Dinh Diem; the army is torn by factions and Buddhists and students protest; about 16,000 US advisers serve with it. The Viet Cong (National Liberation Front) control or contest about half the South's countryside, strongest in the Mekong Delta and the Central Highlands. On the map the 17th parallel runs through the north-central coast, so the South starts holding Hue and Quang Tri inside a province the North holds; the Viet Cong's hold on the South is drawn as a share of its provinces.
Laos: the 1962 Geneva agreement made it neutral under a coalition of Prime Minister Souvanna Phouma; it has broken down. The Pathet Lao (Prince Souphanouvong), with North Vietnamese troops, took the Plain of Jars in May 1964 and hold the north-east and the eastern panhandle, where the Trail runs; US aircraft fly reconnaissance over them. Cambodia (Prince Norodom Sihanouk) is neutral and cool to Washington; Thailand (Thanom Kittikachorn) is a US ally and hosts US aircraft.
Indonesia (Sukarno, with the largest communist party outside the bloc) wages "Konfrontasi" against Malaysia, formed in September 1963 from Malaya, Singapore, Sarawak and Sabah; British, Australian and New Zealand troops defend Borneo, and Indonesian paratroopers are expected on the Malayan peninsula itself. China (Mao Zedong, President Liu Shaoqi, Premier Zhou Enlai) recovers from the Great Leap famine, is split from Moscow and will soon test an atomic bomb. The Soviet Union (Nikita Khrushchev, First Secretary and Premier) is in détente after the Cuban crisis: the hotline and the Partial Test Ban Treaty date from 1963.
Elsewhere: Europe is divided; the Berlin Wall stands since 1961. France (de Gaulle) recognised Beijing in January and goes its own way in NATO; Britain (Alec Douglas-Home, an election due in October) still holds Aden, where it fights an insurgency, and much of the Gulf and southern Africa. Southern Rhodesia (Ian Smith) refuses majority rule; Northern Rhodesia becomes independent Zambia in October. Portugal (Salazar) fights wars in Angola and Guinea. The Congo (Moïse Tshombe) faces the Simba rebellion. Cyprus has seen intercommunal fighting since December 1963; UN troops arrived in March. Egypt (Nasser, still called the United Arab Republic) has 50,000 troops in Yemen's civil war against the Saudi-backed royalists. Brazil's army overthrew President Goulart in April. Cuba (Fidel Castro) is under US embargo and OAS sanctions. The US Civil Rights Act was signed on 2 July.
Real history for reference: a second attack on 4 August was reported, probably wrongly; Johnson ordered air strikes on the North on 5 August, and Congress passed the Gulf of Tonkin Resolution on 7 August. Khrushchev was removed in October; China tested its bomb on 16 October. Johnson won the election, began bombing the North in February 1965 and landed the Marines at Da Nang in March. None of this is fixed.`,
  aliases: {},
  owners: {},
  // Every modern country given its owner of 1964 (coldwar.ts).
  modernOwners: {
    ...MODERN,
    ...all("ussr", SOVIET),
    ...all("yugoslavia", YUGOSLAV),
    ...all("czechoslovakia", CZECHOSLOVAK),
    DEU: "west-germany",
    VNM: "south-vietnam",
    BGD: "pakistan",
    LKA: "ceylon",
    MMR: "burma",
    SGP: "malaysia",
    ERI: "ethiopia",
    SDS: "sudan",
    PSX: "jordan",
    ZWE: "rhodesia",
    ...all("portugal", ["AGO", "MOZ", "GNB"]),
    GNQ: "spain",
    ...all("uk", ["ZMB", "BWA", "LSO", "SWZ", "GMB", "MLT", "BRN", "QAT", "BHR", "ARE", "GUY", "BLZ", "BRB", "BHS", "ATG", "DMA", "GRD", "KNA", "LCA", "VCT", "FJI", "SLB"]),
    DJI: "france",
    SUR: "netherlands",
    PNG: "australia",
    NAM: "south-africa",
  },
  provinceOwners: {
    ...all("east-germany", EAST_GERMAN),
    ...all("north-vietnam", NORTH_VIETNAM),
    ...all("uk", ADEN),
    "ps-gaza": "egypt",
    "jp-okinawa": "usa",
  },
  // The Pathet Lao and the North Vietnamese hold the north-east of Laos and the Trail.
  provinceControllers: {
    "la-phongsaly": "pathet-lao",
    "la-houaphanh": "pathet-lao",
    "la-houaphanh-p2": "pathet-lao",
    "la-xiangkhouang": "pathet-lao",
    "la-sekong": "pathet-lao",
    "la-attapeu": "pathet-lao",
  },
  // Hue and Quang Tri, south of the 17th parallel; the Viet Cong across the South; the Pathet Lao along the Trail.
  provinceContested: {
    "vn-bac-trung-bo": "south-vietnam",
    "vn-ong-bang-song-cuu-long": "viet-cong",
    "vn-hau-giang": "viet-cong",
    "vn-can-tho": "viet-cong",
    "vn-tay-nguyen": "viet-cong",
    "vn-quang-nam": "viet-cong",
    "vn-nam-trung-bo": "viet-cong",
    "vn-ong-nam-bo": "viet-cong",
    "la-salavan": "pathet-lao",
    "la-savannakhet": "pathet-lao",
    "la-khammouane": "pathet-lao",
  },
  provinceHeld: {
    "vn-bac-trung-bo": 27,
    "vn-ong-bang-song-cuu-long": 40,
    "vn-hau-giang": 45,
    "vn-can-tho": 25,
    "vn-tay-nguyen": 35,
    "vn-quang-nam": 30,
    "vn-nam-trung-bo": 25,
    "vn-ong-nam-bo": 20,
    "la-salavan": 40,
    "la-savannakhet": 30,
    "la-khammouane": 35,
  },
  provinceTaken: {
    "vn-bac-trung-bo": ["Huế", "Phong Điền", "Quảng Trị", "Cam Lộ", "Đông Hà"],
  },
  // Buddhists and students against the junta in Saigon, Hue and Da Nang.
  protests: [
    {
      title: L("Buddhist and student protests", "Протесты буддистов и студентов", "Протести буддистів і студентів"),
      country: "south-vietnam",
      stage: "rally",
      size: 30,
      where: ["vn-ong-nam-bo", "vn-quang-nam"],
      demands: L(
        "An end to military rule, religious freedom, a civilian government",
        "Конец военного правления, свобода вероисповедания, гражданское правительство",
        "Кінець військового правління, свобода віросповідання, цивільний уряд",
      ),
      by: L("Thich Tri Quang and the Unified Buddhist Church; student unions", "Тхить Чи Куанг и Объединённая буддийская церковь; студенческие союзы", "Тхіть Чі Куанг і Об'єднана буддійська церква; студентські спілки"),
      support: 40,
      organisation: 55,
      killed: 0,
    },
  ],
  // Saigon's generals plot against each other; the army decides who governs.
  loyalty: { "south-vietnam": { army: 45, police: 55, security: 45, elites: 35 } },
  // People in 1964 within today's borders (UN estimates, thousands); the rest at six tenths of 1991.
  people: {
    others: 0.6,
    byCountry: {
      CHN: 698000, IND: 487000, USA: 191900, RUS: 125700, JPN: 97200, IDN: 99000, DEU: 75600, BRA: 81000, GBR: 54100, ITA: 51400,
      FRA: 48300, BGD: 56000, PAK: 50700, UKR: 44600, NGA: 49600, MEX: 42200, ESP: 31700, VNM: 36100, POL: 31300, TUR: 30100,
      EGY: 29200, THA: 29500, KOR: 27700, PHL: 29000, ETH: 24200, IRN: 23800, MMR: 23000, ARG: 21800, ROU: 18900, CAN: 19300,
      ZAF: 18900, COL: 18300, COD: 17000, PRK: 12200, NLD: 12100, UZB: 10100, KAZ: 11700, TWN: 12300, AFG: 9700, MAR: 12800,
      DZA: 11700, SDN: 7700, SDS: 3200, KEN: 9400, TZA: 11200, UGA: 7900, CZE: 9600, SVK: 4300, HUN: 10100, BEL: 9400, PRT: 8900,
      GRC: 8500, BGR: 8100, SWE: 7600, AUT: 7200, CHE: 5800, SRB: 7500, KOS: 1000, HRV: 4150, BIH: 3500, SVN: 1600, MKD: 1500,
      MNE: 500, BLR: 8400, AZE: 4400, GEO: 4300, ARM: 2100, MDA: 3200, LTU: 2900, LVA: 2200, EST: 1250, KGZ: 2500, TJK: 2400,
      TKM: 1800, AUS: 11100, NZL: 2600, MYS: 9000, SGP: 1800, LKA: 11000, NPL: 10100, IRQ: 7900, SYR: 5100, SAU: 4300, YEM: 5600,
      ISR: 2400, JOR: 1000, PSX: 1100, LBN: 2200, GHA: 7500, CIV: 4100, CMR: 5600, MOZ: 8000, AGO: 5700, MDG: 5900, MLI: 5400,
      BFA: 5100, NER: 3600, SEN: 3500, ZWE: 4300, ZMB: 3600, MWI: 4000, TUN: 4500, LBY: 1500, SOM: 3100, RWA: 3100, BDI: 3000,
      GIN: 3600, TCD: 3200, BEN: 2600, TGO: 1700, SLE: 2400, LBR: 1200, CAF: 1550, COG: 1100, GAB: 520, MRT: 980, NAM: 660,
      BWA: 550, LSO: 900, ERI: 1500, PER: 10900, VEN: 8700, CHL: 8400, CUB: 7700, ECU: 5000, GTM: 4600, BOL: 3900, HTI: 4200,
      DOM: 3700, URY: 2700, SLV: 3000, HND: 2300, PRY: 2000, NIC: 1900, CRI: 1550, PAN: 1300, JAM: 1700, PRI: 2600, TTO: 900,
      GUY: 650, KHM: 6100, LAO: 2400, MNG: 1100, HKG: 3600, IRL: 2840, NOR: 3700, DNK: 4720, FIN: 4550, ALB: 1820, MLT: 320, CYP: 590,
    },
  },
  countries: {
    usa: seed(L("United States", "США", "США"), "#6680c2", "President Lyndon B. Johnson; Defense Secretary Robert McNamara", L("Federal republic", "Федеративная республика", "Федеративна республіка"), { stability: 70, economy: 95, military: 95 }),
    "north-vietnam": seed(L("North Vietnam", "Северный Вьетнам", "Північний В'єтнам"), "#b8453a", "President Ho Chi Minh; First Secretary Le Duan; General Vo Nguyen Giap", COMMUNIST, { stability: 75, economy: 10, military: 40 }),
    "south-vietnam": seed(L("South Vietnam", "Южный Вьетнам", "Південний В'єтнам"), "#d0a43a", "General Nguyen Khanh, Prime Minister and head of the Military Revolutionary Council", JUNTA, { stability: 20, economy: 15, military: 30 }),
    "viet-cong": {
      ...seed(L("Viet Cong (NLF)", "Вьетконг (НФОЮВ)", "В'єтконг (НФВПВ)"), "#8e2f36", "Chairman Nguyen Huu Tho; directed from Hanoi", L("Communist-led insurgency", "Повстанческое движение под руководством коммунистов", "Повстанський рух під проводом комуністів"), { stability: 70, economy: 2, military: 20 }),
      dormant: true,
    },
    laos: seed(L("Laos", "Лаос", "Лаос"), "#8fae6a", "PM Prince Souvanna Phouma; King Savang Vatthana", L("Neutral kingdom at civil war", "Нейтральное королевство в гражданской войне", "Нейтральне королівство в громадянській війні"), { stability: 20, economy: 5, military: 8 }),
    "pathet-lao": {
      ...seed(L("Pathet Lao", "Патет Лао", "Патет Лао"), "#7f4b6e", "Prince Souphanouvong", L("Communist-led insurgency", "Повстанческое движение под руководством коммунистов", "Повстанський рух під проводом комуністів"), { stability: 65, economy: 2, military: 10 }),
      dormant: true,
    },
    cambodia: seed(L("Cambodia", "Камбоджа", "Камбоджа"), "#6a9ab0", "Prince Norodom Sihanouk, Head of State", L("Neutral kingdom", "Нейтральное королевство", "Нейтральне королівство"), { stability: 55, economy: 10, military: 8 }),
    thailand: seed(L("Thailand", "Таиланд", "Таїланд"), "#6a8fc9", "PM Field Marshal Thanom Kittikachorn", JUNTA, { stability: 60, economy: 20, military: 25 }),
    ussr: seed(L("Soviet Union", "СССР", "СРСР"), "#a3292c", "First Secretary and Premier Nikita Khrushchev", COMMUNIST, { stability: 65, economy: 60, military: 90 }),
    china: seed(L("People's Republic of China", "КНР", "КНР"), "#cf3d2e", "Chairman Mao Zedong; President Liu Shaoqi; Premier Zhou Enlai", COMMUNIST, { stability: 55, economy: 20, military: 65 }),
    taiwan: seed(L("Republic of China", "Китайская Республика", "Китайська Республіка"), "#5a86c6", "President Chiang Kai-shek", L("One-party state under martial law", "Однопартийное государство на военном положении", "Однопартійна держава на воєнному стані"), { stability: 60, economy: 30, military: 35 }),
    "north-korea": seed(L("North Korea", "КНДР", "КНДР"), "#a05a6a", "Premier Kim Il-sung", COMMUNIST, { stability: 75, economy: 25, military: 50 }),
    "south-korea": seed(L("South Korea", "Республика Корея", "Республіка Корея"), "#7f9fc9", "President Park Chung-hee", L("Authoritarian presidential republic", "Авторитарная президентская республика", "Авторитарна президентська республіка"), { stability: 50, economy: 20, military: 40 }),
    japan: seed(L("Japan", "Япония", "Японія"), "#e6d6a6", "PM Hayato Ikeda", L("Constitutional monarchy", "Конституционная монархия", "Конституційна монархія"), { stability: 75, economy: 60, military: 15 }),
    indonesia: seed(L("Indonesia", "Индонезия", "Індонезія"), "#c4614f", "President Sukarno", L("Guided Democracy", "«Направляемая демократия»", "«Керована демократія»"), { stability: 30, economy: 10, military: 35 }),
    malaysia: seed(L("Malaysia", "Малайзия", "Малайзія"), "#5f7fb5", "PM Tunku Abdul Rahman", L("Federal constitutional monarchy", "Федеративная конституционная монархия", "Федеративна конституційна монархія"), { stability: 55, economy: 25, military: 15 }),
    philippines: seed(L("Philippines", "Филиппины", "Філіппіни"), "#6a8fd0", "President Diosdado Macapagal", L("Presidential republic", "Президентская республика", "Президентська республіка"), { stability: 45, economy: 20, military: 15 }),
    burma: seed(L("Burma", "Бирма", "Бірма"), "#c9b04a", "General Ne Win", JUNTA, { stability: 40, economy: 10, military: 20 }),
    ceylon: seed(L("Ceylon", "Цейлон", "Цейлон"), "#c98c6b", "PM Sirimavo Bandaranaike", L("Dominion of the Commonwealth", "Доминион Содружества", "Домініон Співдружності"), { stability: 50, economy: 15, military: 5 }),
    india: seed(L("India", "Индия", "Індія"), "#e0a458", "PM Lal Bahadur Shastri", L("Federal parliamentary republic", "Федеративная парламентская республика", "Федеративна парламентська республіка"), { stability: 55, economy: 20, military: 40 }),
    pakistan: seed(L("Pakistan", "Пакистан", "Пакистан"), "#3f7f4f", "President Field Marshal Ayub Khan", L("Presidential republic under military patronage", "Президентская республика под патронатом армии", "Президентська республіка під патронатом армії"), { stability: 50, economy: 15, military: 35 }),
    uk: seed(L("United Kingdom", "Великобритания", "Велика Британія"), "#d0666b", "PM Sir Alec Douglas-Home", L("Constitutional monarchy", "Конституционная монархия", "Конституційна монархія"), { stability: 65, economy: 60, military: 55 }),
    france: seed(L("France", "Франция", "Франція"), "#4a72b8", "President Charles de Gaulle; PM Georges Pompidou", L("Fifth Republic", "Пятая республика", "П'ята республіка"), { stability: 70, economy: 60, military: 55 }),
    "west-germany": seed(L("West Germany", "ФРГ", "ФРН"), "#6f7277", "Chancellor Ludwig Erhard", L("Federal parliamentary republic", "Федеративная парламентская республика", "Федеративна парламентська республіка"), { stability: 75, economy: 70, military: 40 }),
    "east-germany": seed(L("East Germany", "ГДР", "НДР"), "#a4646a", "Walter Ulbricht, Chairman of the State Council", PEOPLES_REPUBLIC, { stability: 55, economy: 40, military: 25 }),
    italy: seed(L("Italy", "Италия", "Італія"), "#5a9d55", "PM Aldo Moro", L("Parliamentary republic", "Парламентская республика", "Парламентська республіка"), { stability: 50, economy: 45, military: 25 }),
    yugoslavia: seed(L("Yugoslavia", "Югославия", "Югославія"), "#8873b3", "President Josip Broz Tito", L("Non-aligned communist federation", "Неприсоединившаяся коммунистическая федерация", "Неприєднана комуністична федерація"), { stability: 65, economy: 30, military: 40 }),
    egypt: seed(L("Egypt (UAR)", "Египет (ОАР)", "Єгипет (ОАР)"), "#d6c27a", "President Gamal Abdel Nasser", L("One-party republic", "Однопартийная республика", "Однопартійна республіка"), { stability: 60, economy: 20, military: 35 }),
    israel: seed(L("Israel", "Израиль", "Ізраїль"), "#7fa8d4", "PM Levi Eshkol", L("Parliamentary republic", "Парламентская республика", "Парламентська республіка"), { stability: 65, economy: 35, military: 40 }),
    cuba: seed(L("Cuba", "Куба", "Куба"), "#5a7fbf", "PM Fidel Castro", COMMUNIST, { stability: 65, economy: 15, military: 25 }),
    rhodesia: seed(L("Southern Rhodesia", "Южная Родезия", "Південна Родезія"), "#7a9a6e", "PM Ian Smith", L("Self-governing colony ruled by the white minority", "Самоуправляемая колония под властью белого меньшинства", "Самоврядна колонія під владою білої меншості"), { stability: 45, economy: 20, military: 10 }),
    "south-africa": seed(L("South Africa", "ЮАР", "ПАР"), "#c48a5a", "PM Hendrik Verwoerd", L("Republic ruled by the white minority (apartheid)", "Республика под властью белого меньшинства (апартеид)", "Республіка під владою білої меншості (апартеїд)"), { stability: 55, economy: 35, military: 25 }),
    "dr-congo": seed(L("Congo (Léopoldville)", "Конго (Леопольдвиль)", "Конго (Леопольдвіль)"), "#6f8fb0", "PM Moïse Tshombe; President Joseph Kasa-Vubu", L("Republic at civil war", "Республика в гражданской войне", "Республіка в громадянській війні"), { stability: 15, economy: 10, military: 10 }),
  },
  wars: [
    {
      id: "vietnam-war",
      name: L("Vietnam War", "Война во Вьетнаме", "В'єтнамська війна"),
      attackers: ["north-vietnam", "viet-cong"],
      defenders: ["south-vietnam"],
      since: "1955-11-01",
    },
    {
      id: "laotian-civil-war",
      name: L("Laotian Civil War", "Гражданская война в Лаосе", "Громадянська війна в Лаосі"),
      attackers: ["pathet-lao", "north-vietnam"],
      defenders: ["laos"],
      since: "1959-05-23",
    },
    {
      id: "konfrontasi",
      name: L("Indonesia–Malaysia confrontation", "Индонезийско-малайзийская конфронтация", "Індонезійсько-малайзійська конфронтація"),
      attackers: ["indonesia"],
      defenders: ["malaysia", "uk"],
      since: "1963-01-20",
    },
  ],
  alliances: withTreaties(
    [
      {
        id: "un",
        kind: "organization",
        name: L("United Nations", "Организация Объединённых Наций", "Організація Об'єднаних Націй"),
        // The Republic of China still holds China's seat; the divided states and a few new ones are outside.
        members: [],
        allExcept: [
          "china", "west-germany", "east-germany", "north-korea", "south-korea", "north-vietnam", "south-vietnam", "viet-cong", "pathet-lao",
          "switzerland", "rhodesia", "samoa", "bhutan", "malawi", "andorra", "liechtenstein",
        ],
        since: "1945-10-24",
      },
      {
        id: "nato",
        name: L("NATO", "НАТО", "НАТО"),
        members: ["usa", "uk", "france", "italy", "canada", "netherlands", "belgium", "luxembourg", "denmark", "norway", "iceland", "portugal", "greece", "turkey", "west-germany"],
        since: "1949-04-04",
      },
      {
        id: "warsaw-pact",
        name: L("Warsaw Pact", "Организация Варшавского договора", "Організація Варшавського договору"),
        members: ["ussr", "poland", "czechoslovakia", "hungary", "romania", "bulgaria", "east-germany", "albania"],
        since: "1955-05-14",
      },
    ],
    TERMS_1964,
    TREATIES_1964,
  ),
  featured: ["usa", "north-vietnam", "south-vietnam", "viet-cong", "ussr", "china", "laos", "indonesia", "france", "uk"],
};

import type { Scenario } from "../types";
import { ADEN, all, CZECHOSLOVAK, EAST_GERMAN, L, MODERN, seed, SOVIET, YUGOSLAV } from "./coldwar";
import { TERMS_1964, TREATIES_1964, withTreaties } from "./treaties";

const COMMUNIST = L("One-party communist state", "Однопартийное коммунистическое государство", "Однопартійна комуністична держава");
const PEOPLES_REPUBLIC = L("People's republic", "Народная республика", "Народна республіка");
const JUNTA = L("Military government", "Военное правительство", "Військовий уряд");

/** The provinces of the map north of the 17th parallel (the line runs through the north-central coast, held by the North). */
const NORTH_VIETNAM = ["vn-tay-bac", "vn-ong-bac", "vn-northeast-vietnam", "vn-ong-b-c", "vn-ong-bang-song-hong", "vn-red-river-delta", "vn-bac-trung-bo"];

// The lines of the model's background that the date and its eve share.
const VIETNAM_1964 = `Vietnam: divided at the 17th parallel since the Geneva Accords of 1954 (the elections they promised never took place). North Vietnam: President Ho Chi Minh, First Secretary Le Duan, General Vo Nguyen Giap; it sends men and arms down the Ho Chi Minh Trail through Laos. South Vietnam: General Nguyen Khanh, who seized power in January 1964, three months after the coup that killed Ngo Dinh Diem; the army is torn by factions and Buddhists and students protest; about 16,000 US advisers serve with it. The Viet Cong (National Liberation Front) control or contest about half the South's countryside, strongest in the Mekong Delta and the Central Highlands. On the map the 17th parallel runs through the north-central coast, so the South starts holding Hue and Quang Tri inside a province the North holds; the Viet Cong's hold on the South is drawn as a share of its provinces.`;
const LAOS_1964 = `Laos: the 1962 Geneva agreement made it neutral under a coalition of Prime Minister Souvanna Phouma; it has broken down. The Pathet Lao (Prince Souphanouvong), with North Vietnamese troops, took the Plain of Jars in May 1964 and hold the north-east and the eastern panhandle, where the Trail runs; US aircraft fly reconnaissance over them. Cambodia (Prince Norodom Sihanouk) is neutral and cool to Washington; Thailand (Thanom Kittikachorn) is a US ally and hosts US aircraft.`;
const POWERS_1964 = `Indonesia (Sukarno, with the largest communist party outside the bloc) wages "Konfrontasi" against Malaysia, formed in September 1963 from Malaya, Singapore, Sarawak and Sabah; British, Australian and New Zealand troops defend Borneo, and Indonesian paratroopers are expected on the Malayan peninsula itself. China (Mao Zedong, President Liu Shaoqi, Premier Zhou Enlai) recovers from the Great Leap famine, is split from Moscow and will soon test an atomic bomb. The Soviet Union (Nikita Khrushchev, First Secretary and Premier) is in détente after the Cuban crisis: the hotline and the Partial Test Ban Treaty date from 1963.`;
const WORLD_1964 = `Elsewhere: Europe is divided; the Berlin Wall stands since 1961. France (de Gaulle) recognised Beijing in January and goes its own way in NATO; Britain (Alec Douglas-Home, an election due in October) still holds Aden, where it fights an insurgency, and much of the Gulf and southern Africa. Southern Rhodesia (Ian Smith) refuses majority rule; Northern Rhodesia becomes independent Zambia in October. Portugal (Salazar) fights wars in Angola and Guinea. The Congo (Moïse Tshombe) faces the Simba rebellion. Cyprus has seen intercommunal fighting since December 1963; UN troops arrived in March. Egypt (Nasser, still called the United Arab Republic) has 50,000 troops in Yemen's civil war against the Saudi-backed royalists. Brazil's army overthrew President Goulart in April. Cuba (Fidel Castro) is under US embargo and OAS sanctions. The US Civil Rights Act was signed on 2 July.`;

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
    ru: "Катера Северного Вьетнама атакуют эсминец «Мэддокс», а Джонсон хочет развязанных рук.",
    uk: "Катери Північного В'єтнаму атакують есмінець «Меддокс», а Джонсон хоче розв'язаних рук.",
    en: "North Vietnamese boats attack the destroyer Maddox, and Johnson wants a free hand.",
  },
  story: {
    ru: "2 августа 1964 года три северовьетнамских торпедных катера атакуют американский эсминец «Мэддокс» в Тонкинском заливе, где он ведёт разведку у берегов Северного Вьетнама. Корабельные орудия и самолёты с авианосца «Тикондерога» отгоняют их; в «Мэддокс» попадает одна пулемётная пуля. За несколько дней до этого южновьетнамские диверсанты атаковали северовьетнамские острова неподалёку.\n\nВьетнам разделён по 17-й параллели с Женевских соглашений 1954 года. На Юге сайгонское правительство, которое трясёт от переворота к перевороту с тех пор, как в ноябре 1963-го свергли и убили президента Зьема, теряет позиции перед Вьетконгом; его снабжают с Севера по «тропе Хо Ши Мина» через Лаос. В Южном Вьетнаме служат больше шестнадцати тысяч американских военных советников, но американских боевых частей там нет.\n\nВ ноябре президента Линдона Джонсона ждут выборы против Барри Голдуотера, который требует жёсткой линии. Резолюция, дающая президенту широкие права применять силу в Юго-Восточной Азии, уже написана и ждёт повода. Советский Союз и Китай поддерживают Ханой, но жестоко ссорятся между собой. То, что Вашингтон сделает сейчас, решит, останется ли эта война вьетнамской.",
    uk: "2 серпня 1964 року три північнов'єтнамські торпедні катери атакують американський есмінець «Меддокс» у Тонкінській затоці, де він веде розвідку біля берегів Північного В'єтнаму. Корабельні гармати й літаки з авіаносця «Тікондерога» відганяють їх; у «Меддокс» влучає одна кулеметна куля. За кілька днів до того південнов'єтнамські диверсанти атакували північнов'єтнамські острови неподалік.\n\nВ'єтнам поділений по 17-й паралелі з Женевських угод 1954 року. На Півдні сайгонський уряд, який трясе від перевороту до перевороту відтоді, як у листопаді 1963-го повалили й убили президента Зьєма, втрачає позиції перед В'єтконгом; його постачають із Півночі «стежкою Хо Ші Міна» через Лаос. У Південному В'єтнамі служать понад шістнадцять тисяч американських військових радників, але американських бойових частин там немає.\n\nУ листопаді президента Ліндона Джонсона чекають вибори проти Баррі Голдвотера, який вимагає жорсткої лінії. Резолюцію, що дає президентові широкі права застосовувати силу в Південно-Східній Азії, уже написано, і вона чекає приводу. Радянський Союз і Китай підтримують Ханой, але запекло сваряться між собою. Те, що Вашингтон зробить зараз, вирішить, чи лишиться ця війна в'єтнамською.",
    en: "On 2 August 1964 three North Vietnamese torpedo boats attack the American destroyer USS Maddox in the Gulf of Tonkin, where she is gathering intelligence off the coast of North Vietnam. The ship's guns and aircraft from the carrier Ticonderoga drive them off; the Maddox is hit by a single machine-gun bullet. A few days earlier South Vietnamese commandos raided North Vietnamese islands nearby.\n\nVietnam has been divided at the 17th parallel since the Geneva Accords of 1954. In the South the government in Saigon, shaken by coup after coup since President Diem was overthrown and killed in November 1963, is losing ground to the Viet Cong, supplied from the North along the Ho Chi Minh trail through Laos. More than sixteen thousand American military advisers serve in South Vietnam, but no American combat units.\n\nPresident Lyndon Johnson faces an election in November against Barry Goldwater, who calls for a harder line. A resolution giving the president wide powers to use force in Southeast Asia has been drafted and waits for an occasion. The Soviet Union and China both back Hanoi but are quarrelling bitterly with each other. What Washington does now will decide whether this remains a Vietnamese war.",
  },
  briefing: {
    ru: "2 августа 1964 года. В Тонкинском заливе три северовьетнамских торпедных катера атакуют американский эсминец «Мэддокс». В Сайгоне генерал Нгуен Кхань держится полгода после переворота; Вьетконг контролирует половину деревни, Патет Лао взял Долину кувшинов. В Москве Хрущёв доживает последние месяцы у власти, Китай готовит свою первую бомбу, Сукарно грозит «сокрушить Малайзию». Эскалация, переговоры или нейтралитет – играть можно за любую страну.",
    uk: "2 серпня 1964 року. У Тонкінській затоці три північнов'єтнамські торпедні катери атакують американський есмінець «Меддокс». У Сайгоні генерал Нгуєн Кхань тримається пів року після перевороту; В'єтконг контролює половину села, Патет Лао взяв Долину глеків. У Москві Хрущов доживає останні місяці при владі, Китай готує свою першу бомбу, Сукарно погрожує «розчавити Малайзію». Ескалація, переговори чи нейтралітет – грати можна за будь-яку країну.",
    en: "2 August 1964. In the Gulf of Tonkin three North Vietnamese torpedo boats attack the US destroyer Maddox. In Saigon General Nguyen Khanh has hung on for six months since his coup; the Viet Cong hold half the countryside and the Pathet Lao have taken the Plain of Jars. Khrushchev has months left in power, China is about to test its first bomb, and Sukarno vows to 'crush Malaysia'. Escalate, negotiate or stay out – every country is playable.",
  },
  context: `Date: 2 August 1964. In the afternoon three North Vietnamese P-4 torpedo boats attacked the US destroyer USS Maddox, on an intelligence patrol (DESOTO) in the Gulf of Tonkin, after South Vietnamese commando raids on the North's coast (OPLAN 34A, run by the US). The Maddox and aircraft from the carrier Ticonderoga damaged the boats; the Maddox took one machine-gun bullet. President Lyndon B. Johnson (in office since Kennedy's assassination in November 1963, running against Barry Goldwater in November) and Defense Secretary Robert McNamara must decide how to answer; a congressional resolution giving the President a free hand has been drafted for months.
${VIETNAM_1964}
${LAOS_1964}
${POWERS_1964}
${WORLD_1964}
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
  // A week before the Maddox: the same war in the South, the United States still only advising.
  variants: {
    eve: {
      startDate: "1964-07-26",
      defaultStep: "week",
      tagline: {
        ru: "Сайгонский генерал зовёт в поход на Север, а американский флот готовит разведывательный рейд в Тонкинский залив.",
        uk: "Сайгонський генерал кличе в похід на Північ, а американський флот готує розвідувальний рейд у Тонкінську затоку.",
        en: "Saigon's general calls for a march north, and the American navy is preparing a spy patrol in the Gulf of Tonkin.",
      },
      story: {
        ru: "26 июля 1964 года война на Юге складывается для Сайгона плохо. Генерал Нгуен Кхань, пришедший к власти переворотом в январе, сталкивается с заговорами в собственной армии и протестами буддистов и студентов, а Вьетконг контролирует или оспаривает половину деревни. Неделю назад перед толпой в Сайгоне Кхань призвал к «походу на Север», чтобы перенести войну к Ханою; американцы, которые платят за его армию, ничего подобного не хотят.\n\nВ Южном Вьетнаме служат больше шестнадцати тысяч американских советников, и Вашингтон только что прислал нового посла, генерала Максвелла Тейлора, и нового командующего, генерала Уильяма Уэстморленда. Втайне южновьетнамские диверсанты, обученные американцами, совершают рейды на побережье Севера по плану OPLAN 34A, а американские эсминцы ведут разведку у его берегов. Резолюция, дающая президенту свободу применять силу в Юго-Восточной Азии, написана несколько месяцев назад и ждёт повода.\n\nВ ноябре президента Линдона Джонсона ждут выборы против Барри Голдуотера, которого республиканцы выдвинули десять дней назад, и он хочет выглядеть твёрдым, не начиная войны до выборов. Де Голль только что призвал к нейтрализации Индокитая и новой Женевской конференции; Советский Союз и Китай поддерживают Ханой, но жестоко ссорятся между собой. Один инцидент на море может превратить войну советников в американскую войну, и до него ещё неделя.",
        uk: "26 липня 1964 року війна на Півдні складається для Сайгона погано. Генерал Нгуєн Кхань, який прийшов до влади переворотом у січні, стикається зі змовами у власній армії та протестами буддистів і студентів, а В'єтконг контролює або оспорює половину села. Тиждень тому перед натовпом у Сайгоні Кхань закликав до «походу на Північ», щоб перенести війну до Ханоя; американці, які платять за його армію, нічого подібного не хочуть.\n\nУ Південному В'єтнамі служать понад шістнадцять тисяч американських радників, і Вашингтон щойно надіслав нового посла, генерала Максвелла Тейлора, і нового командувача, генерала Вільяма Вестморленда. Таємно південнов'єтнамські диверсанти, навчені американцями, здійснюють рейди на узбережжя Півночі за планом OPLAN 34A, а американські есмінці ведуть розвідку біля його берегів. Резолюцію, що дає президентові свободу застосовувати силу в Південно-Східній Азії, написано кілька місяців тому, і вона чекає приводу.\n\nУ листопаді президента Ліндона Джонсона чекають вибори проти Баррі Голдвотера, якого республіканці висунули десять днів тому, і він хоче виглядати твердим, не починаючи війни до виборів. Де Голль щойно закликав до нейтралізації Індокитаю та нової Женевської конференції; Радянський Союз і Китай підтримують Ханой, але запекло сваряться між собою. Один інцидент на морі може перетворити війну радників на американську війну, і до нього ще тиждень.",
        en: "On 26 July 1964 the war in the South is going badly for Saigon. General Nguyen Khanh, in power since his coup in January, faces plots in his own army and protests by Buddhists and students, and the Viet Cong hold or contest half the countryside. A week ago, before a crowd in Saigon, Khanh called for a 'march north' to carry the war to Hanoi; the Americans, who pay for his army, want nothing of the kind.\n\nMore than sixteen thousand American advisers serve in South Vietnam, and Washington has just sent a new ambassador, General Maxwell Taylor, and a new commander, General William Westmoreland. In secret, South Vietnamese commandos trained by the Americans raid the North's coast under a plan called OPLAN 34A, and American destroyers gather intelligence off its shore. A resolution giving the president a free hand to use force in Southeast Asia was drafted months ago and waits for an occasion.\n\nPresident Lyndon Johnson faces Barry Goldwater, nominated by the Republicans ten days ago, in November, and wants to look firm without going to war before the election. De Gaulle has just called for the neutralisation of Indochina and a new Geneva conference; the Soviet Union and China both back Hanoi but quarrel bitterly with each other. One incident at sea could turn a war of advisers into an American war, and it is still a week away.",
      },
      briefing: {
        ru: "26 июля 1964 года. В Сайгоне генерал Нгуен Кхань зовёт в поход на Север, пока его генералы плетут заговоры, а буддисты протестуют; Вьетконг держит половину деревни, Патет Лао – Долину кувшинов. Американских советников шестнадцать тысяч, диверсанты нападают на побережье Севера, а эсминец вот-вот начнёт разведрейд в Тонкинском заливе. В ноябре Джонсона ждёт Голдуотер, Хрущёву осталось несколько месяцев у власти, Сукарно грозит «сокрушить Малайзию». За неделю до инцидента: эскалация, переговоры или нейтралитет – играть можно за любую страну.",
        uk: "26 липня 1964 року. У Сайгоні генерал Нгуєн Кхань кличе в похід на Північ, поки його генерали плетуть змови, а буддисти протестують; В'єтконг тримає половину села, Патет Лао – Долину глеків. Американських радників шістнадцять тисяч, диверсанти нападають на узбережжя Півночі, а есмінець от-от почне розвідрейд у Тонкінській затоці. У листопаді Джонсона чекає Голдвотер, Хрущову лишилося кілька місяців при владі, Сукарно погрожує «розчавити Малайзію». За тиждень до інциденту: ескалація, переговори чи нейтралітет – грати можна за будь-яку країну.",
        en: "26 July 1964. In Saigon General Nguyen Khanh calls for a march north while his generals plot and the Buddhists protest; the Viet Cong hold half the countryside and the Pathet Lao the Plain of Jars. American advisers number sixteen thousand, commandos raid the North's coast, and a destroyer is about to begin a spy patrol in the Gulf of Tonkin. Johnson faces Goldwater in November, Khrushchev has months left in power, and Sukarno vows to 'crush Malaysia'. A week before the incident: escalate, negotiate or stay out – every country is playable.",
      },
      context: `Date: Sunday 26 July 1964, a week before the Gulf of Tonkin incident. The United States is not a belligerent: about 16,000 US advisers serve with South Vietnam's army, US aircraft fly reconnaissance over Laos, and under OPLAN 34A (run by the US, carried out by South Vietnamese crews) commandos in fast boats raid the North's coast; the next raids, on the islands of Hon Me and Hon Ngu, are planned for the night of 30–31 July, and the destroyer USS Maddox is to begin an intelligence patrol (DESOTO) in the Gulf of Tonkin on 31 July. General Maxwell Taylor arrived as ambassador in Saigon in July; General William Westmoreland took command of MACV on 20 June. President Lyndon B. Johnson (in office since Kennedy's assassination in November 1963) faces Barry Goldwater, nominated by the Republicans on 15 July, in November; a congressional resolution giving the President a free hand has been drafted for months and waits for an occasion. On 19 July General Nguyen Khanh called publicly for a "march north"; on 23 July de Gaulle called for the neutralisation of Indochina and a new Geneva conference, which Moscow and the UN Secretary-General U Thant also urge and Washington rejects.
${VIETNAM_1964}
${LAOS_1964}
${POWERS_1964}
${WORLD_1964}
Real history for reference: on 2 August North Vietnamese torpedo boats attacked the Maddox; a second attack on 4 August was reported, probably wrongly; Johnson ordered air strikes on the North on 5 August, and Congress passed the Gulf of Tonkin Resolution on 7 August. Khrushchev was removed in October; China tested its bomb on 16 October. Johnson won the election, began bombing the North in February 1965 and landed the Marines at Da Nang in March. None of this is fixed.`,
    },
  },
};

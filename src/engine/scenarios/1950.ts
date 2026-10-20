import type { Scenario } from "../types";
import { all, CZECHOSLOVAK, EAST_GERMAN, L, MODERN, seed, SOVIET, YUGOSLAV, ADEN } from "./coldwar";
import { TERMS_1950, TREATIES_1950, withTreaties } from "./treaties";

const COMMUNIST = L("One-party communist state", "Однопартийное коммунистическое государство", "Однопартійна комуністична держава");
const PEOPLES_REPUBLIC = L("People's republic", "Народная республика", "Народна республіка");

export const scenario1950: Scenario = {
  id: "1950",
  map: "world_1994",
  startDate: "1950-06-25",
  defaultStep: "month",
  title: {
    ru: "Корейская война",
    uk: "Корейська війна",
    en: "The Korean War",
  },
  tagline: {
    ru: "На рассвете северокорейские танки пересекают 38-ю параллель. У Вашингтона — часы на решение.",
    uk: "На світанку північнокорейські танки перетинають 38-му паралель. У Вашингтона — години на рішення.",
    en: "At dawn North Korean tanks cross the 38th parallel. Washington has hours to decide.",
  },
  briefing: {
    ru: "25 июня 1950 года, воскресенье. В 4 утра Корейская народная армия Ким Ир Сена — 135 тысяч солдат и полторы сотни Т-34 — переходит 38-ю параллель. У армии Ли Сын Мана нет ни танков, ни противотанковых пушек; Сеул в пятидесяти километрах. Советский Союз с января бойкотирует Совет Безопасности, Мао готовит десант на Тайвань, Франция увязла в Индокитае, у Сталина уже есть бомба. Защитите Юг, объедините Корею, втяните или удержите Китай — играть можно за любую страну.",
    uk: "25 червня 1950 року, неділя. О 4-й ранку Корейська народна армія Кім Ір Сена — 135 тисяч солдатів і півтори сотні Т-34 — переходить 38-му паралель. У армії Лі Син Мана немає ні танків, ні протитанкових гармат; Сеул за п'ятдесят кілометрів. Радянський Союз із січня бойкотує Раду Безпеки, Мао готує десант на Тайвань, Франція загрузла в Індокитаї, у Сталіна вже є бомба. Захистіть Південь, об'єднайте Корею, втягніть або втримайте Китай — грати можна за будь-яку країну.",
    en: "Sunday, 25 June 1950. At 4 a.m. Kim Il-sung's Korean People's Army — 135,000 men and some 150 T-34s — crosses the 38th parallel. Syngman Rhee's army has no tanks and no anti-tank guns; Seoul is fifty kilometres away. The Soviet Union has boycotted the Security Council since January, Mao is massing troops to invade Taiwan, France is bogged down in Indochina, and Stalin has the bomb. Defend the South, unite Korea, draw China in or keep it out — every country is playable.",
  },
  context: `Date: Sunday 25 June 1950, the first day of the Korean War. At 04:00 the Korean People's Army (about 135,000 men, 150 T-34/85 tanks, Soviet-trained and -equipped, with Soviet advisers) attacked across the 38th parallel at Ongjin, Kaesong, Chuncheon and on the road to Uijeongbu and Seoul. The Republic of Korea Army has about 98,000 men, no tanks, little artillery and no combat aircraft; Kaesong is falling on the first morning. On the map the 38th parallel runs through three provinces, so the front starts inside them: North Korea holds the northern towns of Gangwon (Cheorwon, Sokcho), South Korea holds Kaesong and the Ongjin peninsula north of the modern border.
Korea: Kim Il-sung (Premier of the DPRK, with Stalin's approval, given in April 1950, and Mao's consent in May) against Syngman Rhee (President of the ROK, authoritarian, with US military advisers — KMAG, about 500 men). US combat troops left Korea in June 1949; Secretary of State Acheson's speech of January 1950 left Korea outside the US "defensive perimeter". The UN Security Council meets on 25 June; the Soviet delegate has boycotted it since January over China's seat, so there is no Soviet veto.
United States: President Harry S. Truman, Secretary of State Dean Acheson. NSC-68 (April 1950) calls for a large military build-up, not yet funded; the army is ten under-strength divisions, four of them occupying Japan under General Douglas MacArthur (SCAP), who also governs Japan; the Seventh Fleet is in the western Pacific. The US has the atomic bomb, and so, since August 1949, does the Soviet Union. McCarthy's anti-communist campaign is at its height.
China: the People's Republic was proclaimed on 1 October 1949 (Chairman Mao Zedong, Premier Zhou Enlai). Hainan was taken in May 1950; the Third Field Army is preparing to invade Taiwan, where Chiang Kai-shek's Republic of China holds Taiwan, the Pescadores, Kinmen and Matsu and keeps China's seat in the UN. Tibet (under the 14th Dalai Lama, still a minor, and his regent) is de facto independent; the PLA will march on it if nothing stops it. The Sino-Soviet Treaty of Friendship (February 1950) binds Moscow and Beijing.
Soviet Union: Joseph Stalin; the Soviet bloc — Poland, Czechoslovakia, Hungary, Romania, Bulgaria, Albania, East Germany — is ruled by communist parties under Soviet tutelage. Tito's Yugoslavia was expelled from the Cominform in 1948 and is now courted by the West.
Europe: NATO was founded in April 1949. Germany is divided since 1949: the Federal Republic (Chancellor Konrad Adenauer, capital Bonn) and the German Democratic Republic (President Wilhelm Pieck, Premier Otto Grotewohl, party boss Walter Ulbricht). Berlin is drawn with the GDR, but its western sectors are an enclave of the Western Allies; the Soviet blockade ended in May 1949. The Saar is a French protectorate; Austria is occupied by the four powers. The Schuman Declaration (9 May 1950) proposes to pool French and German coal and steel. Britain (Clement Attlee, Labour) and France (Fourth Republic, President Vincent Auriol; Georges Bidault's government fell on 24 June) are rebuilding with the Marshall Plan. Spain (Franco) and Portugal (Salazar) are dictatorships; Greece won its civil war in 1949.
Asia: in Indochina the French Union and the State of Vietnam (Bảo Đại) fight the Viet Minh (Ho Chi Minh's Democratic Republic of Vietnam, General Vo Nguyen Giap), who hold the northern mountains (the Viet Bac) and much of the north-central coast; China has begun to arm them. Laos and Cambodia are kingdoms associated with France. Britain fights communist guerrillas in Malaya (the Emergency, since 1948). Indonesia (Sukarno, Hatta) won independence from the Netherlands in December 1949; the Dutch keep West New Guinea. India (Nehru; a republic since January 1950) and Pakistan (Liaquat Ali Khan; East Pakistan included) face each other over Kashmir across the 1949 ceasefire line. Burma (U Nu) fights Karen and communist rebels. Japan (Prime Minister Shigeru Yoshida) is under US occupation; Okinawa is governed by the US military.
Middle East and Africa: Israel (David Ben-Gurion) holds the 1949 armistice lines; Jordan (King Abdullah) annexed the West Bank in April 1950, Egypt (King Farouk) holds Gaza. Iran (the Shah) is debating the Anglo-Iranian Oil Company; oil is about to be nationalised. Almost all of Africa is colonial: British, French, Belgian, Portuguese and Spanish; Libya is under British and French administration until independence (promised for 1951), Eritrea under British administration, Somalia an Italian trust territory since April 1950. South Africa (D. F. Malan) is building apartheid and administers South West Africa. Ethiopia (Haile Selassie), Liberia and Egypt are independent.
Real history for reference: the UN Security Council condemned the invasion on 25 June and called for help on 27 June; Truman sent air and naval forces, then ground troops; Seoul fell on 28 June; the UN forces were pushed back to the Pusan perimeter; MacArthur landed at Incheon on 15 September and drove north to the Yalu; China entered the war in October; the front settled near the 38th parallel, and an armistice was signed in July 1953. None of this is fixed.`,
  aliases: {},
  owners: {},
  // Every modern country given its owner of 1950 (coldwar.ts); the empires, the Soviet Union and the divided states.
  modernOwners: {
    ...MODERN,
    ...all("ussr", SOVIET),
    ...all("yugoslavia", YUGOSLAV),
    ...all("czechoslovakia", CZECHOSLOVAK),
    DEU: "west-germany",
    ...all("france", ["DZA", "TUN", "MAR", "MRT", "SEN", "MLI", "NER", "BFA", "GIN", "CIV", "BEN", "TGO", "CMR", "TCD", "CAF", "COG", "GAB", "MDG", "DJI"]),
    ...all("uk", [
      "GHA", "NGA", "SLE", "GMB", "KEN", "UGA", "TZA", "MWI", "ZMB", "ZWE", "BWA", "LSO", "SWZ", "SDN", "SDS", "SOL", "LBY", "ERI", "CYP",
      "CYN", "MLT", "MYS", "SGP", "BRN", "KWT", "QAT", "BHR", "ARE", "GUY", "BLZ", "JAM", "TTO", "BRB", "BHS", "ATG", "DMA", "GRD", "KNA",
      "LCA", "VCT", "FJI", "SLB",
    ]),
    ...all("belgium", ["COD", "RWA", "BDI"]),
    ...all("portugal", ["AGO", "MOZ", "GNB"]),
    GNQ: "spain",
    SOM: "italy",
    SUR: "netherlands",
    PNG: "australia",
    WSM: "new-zealand",
    NAM: "south-africa",
    BGD: "pakistan",
    LKA: "ceylon",
    MMR: "burma",
    PSX: "jordan",
  },
  provinceOwners: {
    ...all("east-germany", EAST_GERMAN),
    "de-saarland": "france",
    "cn-tibet": "tibet",
    "in-goa": "portugal",
    "in-dadra-and-nagar-haveli-and-daman-and-diu": "portugal",
    "in-puducherry": "france",
    "id-papua": "netherlands",
    "id-west-papua": "netherlands",
    "ps-gaza": "egypt",
    "jp-okinawa": "usa",
    // The Spanish zone of Morocco, on the Mediterranean.
    "ma-tangier-tetouan": "spain",
    ...all("uk", ADEN),
    // The Viet Minh's base areas in the northern mountains.
    "vn-tay-bac": "viet-minh",
    "vn-ong-bac": "viet-minh",
    "vn-northeast-vietnam": "viet-minh",
  },
  // The Viet Minh hold most of the north-central coast (their Interzone IV); the French keep Hue and the towns south of it.
  provinceControllers: { "vn-bac-trung-bo": "viet-minh" },
  // The 38th parallel runs through three provinces of the map; the front starts inside them.
  provinceContested: {
    "kr-gangwon": "north-korea",
    "kp-north-hwanghae": "south-korea",
    "kp-south-hwanghae": "south-korea",
    "vn-bac-trung-bo": "vietnam",
    "vn-ong-bang-song-hong": "viet-minh",
  },
  provinceHeld: { "kr-gangwon": 27, "kp-north-hwanghae": 31, "kp-south-hwanghae": 28, "vn-bac-trung-bo": 35, "vn-ong-bang-song-hong": 30 },
  provinceTaken: {
    "kr-gangwon": ["Sokcho", "Kosong", "Cheorwon", "Yanggu", "Hwacheon"],
    "kp-north-hwanghae": ["Kaesong"],
    "kp-south-hwanghae": ["Paech’ŏn-ŭp", "Ch’ŏngdan-ŭp", "Kangnyŏng", "Ongjin", "Yŏnan-ŭp"],
    "vn-bac-trung-bo": ["Huế", "Phong Điền", "Quảng Trị", "Cam Lộ", "Đông Hà"],
  },
  // People in 1950 within today's borders (UN estimates, thousands); the rest at four tenths of 1991.
  people: {
    others: 0.42,
    byCountry: {
      CHN: 552000, IND: 376000, USA: 158800, RUS: 102800, JPN: 82800, IDN: 69500, DEU: 69900, BRA: 54000, GBR: 50600, ITA: 46600,
      FRA: 41800, BGD: 37900, PAK: 37500, UKR: 37300, NGA: 37900, MEX: 28000, ESP: 28100, VNM: 24800, POL: 24800, TUR: 21200,
      EGY: 20900, THA: 20700, KOR: 19200, PHL: 18600, ETH: 18100, IRN: 17100, MMR: 17500, ARG: 17200, ROU: 16200, CAN: 13700,
      ZAF: 13700, COL: 12300, COD: 12200, PRK: 10500, NLD: 10100, UZB: 6300, KAZ: 6700, TWN: 7600, AFG: 7800, MAR: 9000, DZA: 8900,
      SDN: 5700, SDS: 2600, KEN: 6100, TZA: 7600, UGA: 5200, CZE: 8900, SVK: 3500, HUN: 9300, BEL: 8600, PRT: 8400, GRC: 7500,
      BGR: 7300, SWE: 7000, AUT: 6900, CHE: 4700, SRB: 6500, KOS: 730, HRV: 3850, BIH: 2660, SVN: 1470, MKD: 1230, MNE: 400, BLR: 7700,
      AZE: 2900, GEO: 3500, ARM: 1350, MDA: 2300, LTU: 2600, LVA: 1950, EST: 1100, KGZ: 1700, TJK: 1500, TKM: 1200, AUS: 8200, NZL: 1900,
      MYS: 6100, SGP: 1000, LKA: 7900, NPL: 8500, IRQ: 5700, SYR: 3400, SAU: 3100, YEM: 4300, ISR: 1260, JOR: 450, PSX: 930, LBN: 1400,
      GHA: 5000, CIV: 2600, CMR: 4500, MOZ: 6300, AGO: 4500, MDG: 4100, MLI: 4700, BFA: 4300, NER: 2500, SEN: 2500, ZWE: 2700,
      ZMB: 2300, MWI: 2900, TUN: 3500, LBY: 1000, SOM: 2300, RWA: 2200, BDI: 2300, GIN: 3000, TCD: 2500, BEN: 2300, TGO: 1400,
      SLE: 1900, LBR: 900, CAF: 1300, COG: 800, GAB: 470, MRT: 650, NAM: 490, BWA: 410, LSO: 730, ERI: 1100, PER: 7700, VEN: 5500,
      CHL: 6100, CUB: 5900, ECU: 3400, GTM: 3100, BOL: 3100, HTI: 3200, DOM: 2400, URY: 2200, SLV: 1950, HND: 1500, PRY: 1500,
      NIC: 1300, CRI: 970, PAN: 900, JAM: 1400, PRI: 2200, TTO: 640, GUY: 420, KHM: 4500, LAO: 1700, MNG: 780, HKG: 2000,
      IRL: 2970, NOR: 3270, DNK: 4270, FIN: 4010, ALB: 1260, MLT: 310, CYP: 490,
    },
  },
  countries: {
    usa: seed(L("United States", "США", "США"), "#6680c2", "President Harry S. Truman; Secretary of State Dean Acheson", L("Federal republic", "Федеративная республика", "Федеративна республіка"), { stability: 75, economy: 95, military: 80 }),
    ussr: seed(L("Soviet Union", "СССР", "СРСР"), "#a3292c", "Joseph Stalin, Chairman of the Council of Ministers", COMMUNIST, { stability: 85, economy: 50, military: 90 }),
    china: seed(L("People's Republic of China", "КНР", "КНР"), "#cf3d2e", "Chairman Mao Zedong; Premier Zhou Enlai", COMMUNIST, { stability: 55, economy: 15, military: 60 }),
    taiwan: seed(L("Republic of China", "Китайская Республика", "Китайська Республіка"), "#5a86c6", "President Chiang Kai-shek", L("One-party state under martial law", "Однопартийное государство на военном положении", "Однопартійна держава на воєнному стані"), { stability: 40, economy: 20, military: 35 }),
    "north-korea": seed(L("North Korea", "КНДР", "КНДР"), "#a05a6a", "Premier Kim Il-sung", COMMUNIST, { stability: 65, economy: 20, military: 55 }),
    "south-korea": seed(L("South Korea", "Республика Корея", "Республіка Корея"), "#7f9fc9", "President Syngman Rhee", L("Authoritarian presidential republic", "Авторитарная президентская республика", "Авторитарна президентська республіка"), { stability: 35, economy: 15, military: 20 }),
    japan: seed(L("Japan", "Япония", "Японія"), "#e6d6a6", "PM Shigeru Yoshida, under the Allied occupation of General Douglas MacArthur", L("Constitutional monarchy under occupation", "Конституционная монархия под оккупацией", "Конституційна монархія під окупацією"), { stability: 65, economy: 30, military: 2 }),
    uk: seed(L("United Kingdom", "Великобритания", "Велика Британія"), "#d0666b", "PM Clement Attlee; King George VI", L("Constitutional monarchy and empire", "Конституционная монархия и империя", "Конституційна монархія та імперія"), { stability: 65, economy: 55, military: 60 }),
    france: seed(L("France", "Франция", "Франція"), "#4a72b8", "President Vincent Auriol; Georges Bidault's government fell on 24 June", L("Fourth Republic and colonial empire", "Четвёртая республика и колониальная империя", "Четверта республіка та колоніальна імперія"), { stability: 35, economy: 45, military: 50 }),
    "west-germany": seed(L("West Germany", "ФРГ", "ФРН"), "#6f7277", "Chancellor Konrad Adenauer; President Theodor Heuss", L("Federal republic under the Allied High Commission", "Федеративная республика под контролем союзных верховных комиссаров", "Федеративна республіка під контролем союзних верховних комісарів"), { stability: 55, economy: 40, military: 2 }),
    "east-germany": seed(L("East Germany", "ГДР", "НДР"), "#a4646a", "President Wilhelm Pieck; Premier Otto Grotewohl; party leader Walter Ulbricht", L("People's democracy under Soviet control", "Народная демократия под советским контролем", "Народна демократія під радянським контролем"), { stability: 45, economy: 25, military: 8 }),
    yugoslavia: seed(L("Yugoslavia", "Югославия", "Югославія"), "#8873b3", "Marshal Josip Broz Tito", L("Communist federation outside the Soviet bloc", "Коммунистическая федерация вне советского блока", "Комуністична федерація поза радянським блоком"), { stability: 65, economy: 25, military: 45 }),
    poland: seed(L("Poland", "Польша", "Польща"), "#d27b93", "President Bolesław Bierut", PEOPLES_REPUBLIC, { stability: 50, economy: 25, military: 30 }),
    czechoslovakia: seed(L("Czechoslovakia", "Чехословакия", "Чехословаччина"), "#6d9bd0", "President Klement Gottwald", PEOPLES_REPUBLIC, { stability: 55, economy: 40, military: 25 }),
    hungary: seed(L("Hungary", "Венгрия", "Угорщина"), "#9fb06a", "Party leader Mátyás Rákosi", PEOPLES_REPUBLIC, { stability: 40, economy: 25, military: 15 }),
    romania: seed(L("Romania", "Румыния", "Румунія"), "#d8bd46", "Party leader Gheorghe Gheorghiu-Dej; PM Petru Groza", PEOPLES_REPUBLIC, { stability: 45, economy: 20, military: 20 }),
    bulgaria: seed(L("Bulgaria", "Болгария", "Болгарія"), "#6c9a50", "PM Vulko Chervenkov", PEOPLES_REPUBLIC, { stability: 50, economy: 20, military: 20 }),
    albania: seed(L("Albania", "Албания", "Албанія"), "#a4453f", "Enver Hoxha", PEOPLES_REPUBLIC, { stability: 50, economy: 5, military: 10 }),
    italy: seed(L("Italy", "Италия", "Італія"), "#5a9d55", "PM Alcide De Gasperi", L("Parliamentary republic", "Парламентская республика", "Парламентська республіка"), { stability: 55, economy: 35, military: 25 }),
    spain: seed(L("Spain", "Испания", "Іспанія"), "#d9ab45", "Caudillo Francisco Franco", L("Dictatorship", "Диктатура", "Диктатура"), { stability: 60, economy: 20, military: 30 }),
    india: seed(L("India", "Индия", "Індія"), "#e0a458", "PM Jawaharlal Nehru; President Rajendra Prasad", L("Federal parliamentary republic", "Федеративная парламентская республика", "Федеративна парламентська республіка"), { stability: 55, economy: 20, military: 35 }),
    pakistan: seed(L("Pakistan", "Пакистан", "Пакистан"), "#3f7f4f", "PM Liaquat Ali Khan; Governor-General Khawaja Nazimuddin", L("Dominion of the Commonwealth", "Доминион Содружества", "Домініон Співдружності"), { stability: 45, economy: 15, military: 30 }),
    ceylon: seed(L("Ceylon", "Цейлон", "Цейлон"), "#c98c6b", "PM D. S. Senanayake", L("Dominion of the Commonwealth", "Доминион Содружества", "Домініон Співдружності"), { stability: 65, economy: 20, military: 5 }),
    burma: seed(L("Burma", "Бирма", "Бірма"), "#c9b04a", "PM U Nu", L("Parliamentary republic at civil war", "Парламентская республика в гражданской войне", "Парламентська республіка в громадянській війні"), { stability: 30, economy: 10, military: 15 }),
    indonesia: seed(L("Indonesia", "Индонезия", "Індонезія"), "#c4614f", "President Sukarno; PM Mohammad Hatta", L("Republic", "Республика", "Республіка"), { stability: 40, economy: 15, military: 25 }),
    vietnam: seed(L("State of Vietnam", "Государство Вьетнам", "Держава В'єтнам"), "#d0a43a", "Chief of State Bảo Đại, under the French Union", L("Associated state of the French Union", "Ассоциированное государство Французского союза", "Асоційована держава Французького союзу"), { stability: 25, economy: 15, military: 10 }),
    "viet-minh": seed(L("Viet Minh (DRV)", "Вьетминь (ДРВ)", "В'єтмінь (ДРВ)"), "#b8453a", "President Ho Chi Minh; General Vo Nguyen Giap", L("Communist-led resistance government", "Правительство сопротивления во главе с коммунистами", "Уряд опору на чолі з комуністами"), { stability: 70, economy: 5, military: 30 }),
    laos: seed(L("Laos", "Лаос", "Лаос"), "#8fae6a", "King Sisavang Vong", L("Kingdom associated with France", "Королевство, ассоциированное с Францией", "Королівство, асоційоване з Францією"), { stability: 40, economy: 5, military: 3 }),
    cambodia: seed(L("Cambodia", "Камбоджа", "Камбоджа"), "#6a9ab0", "King Norodom Sihanouk", L("Kingdom associated with France", "Королевство, ассоциированное с Францией", "Королівство, асоційоване з Францією"), { stability: 45, economy: 8, military: 3 }),
    tibet: seed(L("Tibet", "Тибет", "Тибет"), "#d8c9a8", "The 14th Dalai Lama, a minor, and the regent Taktra Rinpoche", L("Buddhist theocracy", "Буддийская теократия", "Буддійська теократія"), { stability: 50, economy: 5, military: 3 }),
    mongolia: seed(L("Mongolia", "Монголия", "Монголія"), "#9a78b8", "Marshal Khorloogiin Choibalsan", PEOPLES_REPUBLIC, { stability: 65, economy: 5, military: 8 }),
    israel: seed(L("Israel", "Израиль", "Ізраїль"), "#7fa8d4", "PM David Ben-Gurion", L("Parliamentary republic", "Парламентская республика", "Парламентська республіка"), { stability: 60, economy: 20, military: 30 }),
    egypt: seed(L("Egypt", "Египет", "Єгипет"), "#d6c27a", "King Farouk; PM Mustafa el-Nahhas", L("Constitutional monarchy", "Конституционная монархия", "Конституційна монархія"), { stability: 35, economy: 20, military: 20 }),
    jordan: seed(L("Jordan", "Иордания", "Йорданія"), "#c4a46a", "King Abdullah I", L("Constitutional monarchy", "Конституционная монархия", "Конституційна монархія"), { stability: 50, economy: 8, military: 15 }),
    iran: seed(L("Iran", "Иран", "Іран"), "#7fae86", "Shah Mohammad Reza Pahlavi; PM Ali Mansur", L("Constitutional monarchy", "Конституционная монархия", "Конституційна монархія"), { stability: 40, economy: 15, military: 20 }),
    iraq: seed(L("Iraq", "Ирак", "Ірак"), "#9a8f5f", "King Faisal II under the regent Abd al-Ilah; Nuri al-Said", L("Constitutional monarchy", "Конституционная монархия", "Конституційна монархія"), { stability: 45, economy: 12, military: 15 }),
    "saudi-arabia": seed(L("Saudi Arabia", "Саудовская Аравия", "Саудівська Аравія"), "#6f9e5a", "King Abdulaziz ibn Saud", L("Absolute monarchy", "Абсолютная монархия", "Абсолютна монархія"), { stability: 65, economy: 15, military: 10 }),
    turkey: seed(L("Turkey", "Турция", "Туреччина"), "#4f9a8c", "President Celal Bayar; PM Adnan Menderes", L("Parliamentary republic", "Парламентская республика", "Парламентська республіка"), { stability: 60, economy: 20, military: 35 }),
    canada: seed(L("Canada", "Канада", "Канада"), "#c44f4f", "PM Louis St. Laurent", L("Dominion of the Commonwealth", "Доминион Содружества", "Домініон Співдружності"), { stability: 80, economy: 70, military: 25 }),
    australia: seed(L("Australia", "Австралия", "Австралія"), "#d88a5a", "PM Robert Menzies", L("Dominion of the Commonwealth", "Доминион Содружества", "Домініон Співдружності"), { stability: 80, economy: 55, military: 20 }),
    philippines: seed(L("Philippines", "Филиппины", "Філіппіни"), "#6a8fd0", "President Elpidio Quirino", L("Presidential republic", "Президентская республика", "Президентська республіка"), { stability: 40, economy: 15, military: 15 }),
    "south-africa": seed(L("South Africa", "ЮАС", "ПАС"), "#c48a5a", "PM D. F. Malan", L("Dominion ruled by the white minority", "Доминион под властью белого меньшинства", "Домініон під владою білої меншості"), { stability: 55, economy: 35, military: 15 }),
    argentina: seed(L("Argentina", "Аргентина", "Аргентина"), "#8fbfe0", "President Juan Perón", L("Presidential republic", "Президентская республика", "Президентська республіка"), { stability: 55, economy: 35, military: 20 }),
    brazil: seed(L("Brazil", "Бразилия", "Бразилія"), "#4f9a5f", "President Eurico Gaspar Dutra", L("Presidential republic", "Президентская республика", "Президентська республіка"), { stability: 55, economy: 25, military: 20 }),
  },
  wars: [
    {
      id: "korean-war",
      name: L("Korean War", "Корейская война", "Корейська війна"),
      attackers: ["north-korea"],
      defenders: ["south-korea"],
      since: "1950-06-25",
    },
    {
      id: "indochina-war",
      name: L("First Indochina War", "Первая Индокитайская война", "Перша Індокитайська війна"),
      attackers: ["viet-minh"],
      defenders: ["france", "vietnam"],
      since: "1946-12-19",
    },
    {
      id: "chinese-civil-war",
      name: L("Chinese Civil War", "Гражданская война в Китае", "Громадянська війна в Китаї"),
      attackers: ["china"],
      defenders: ["taiwan"],
      since: "1946-06-26",
    },
  ],
  alliances: withTreaties(
    [
      {
        id: "un",
        kind: "organization",
        name: L("United Nations", "Организация Объединённых Наций", "Організація Об'єднаних Націй"),
        // The Republic of China holds China's seat; the Soviet bloc's new members, the defeated powers, the divided states and the new states of Asia wait outside.
        members: [],
        allExcept: [
          "china", "west-germany", "east-germany", "japan", "italy", "austria", "finland", "ireland", "portugal", "spain", "hungary", "romania",
          "bulgaria", "albania", "mongolia", "north-korea", "south-korea", "vietnam", "viet-minh", "laos", "cambodia", "ceylon", "nepal", "jordan",
          "indonesia", "switzerland", "tibet", "andorra", "liechtenstein",
        ],
        since: "1945-10-24",
      },
      {
        id: "nato",
        name: L("NATO", "НАТО", "НАТО"),
        members: ["usa", "uk", "france", "italy", "canada", "netherlands", "belgium", "luxembourg", "denmark", "norway", "iceland", "portugal"],
        since: "1949-04-04",
      },
      {
        id: "sino-soviet",
        name: L("Sino-Soviet Treaty of Friendship", "Советско-китайский договор о дружбе", "Радянсько-китайський договір про дружбу"),
        members: ["ussr", "china"],
        since: "1950-02-14",
      },
    ],
    TERMS_1950,
    TREATIES_1950,
  ),
  featured: ["north-korea", "south-korea", "usa", "ussr", "china", "taiwan", "japan", "uk", "france", "viet-minh"],
};

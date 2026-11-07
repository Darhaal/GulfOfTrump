import type { Scenario } from "../types";
import { scenario1950 } from "./1950";
import { scenario1964 } from "./1964";
import { ADEN, all, CZECHOSLOVAK, EAST_GERMAN, L, MODERN, seed, SOVIET, YUGOSLAV } from "./coldwar";
import { TERMS_1957, TREATIES_1957, withTreaties } from "./treaties";

const COMMUNIST = L("One-party communist state", "Однопартийное коммунистическое государство", "Однопартійна комуністична держава");
const PEOPLES_REPUBLIC = L("People's republic", "Народная республика", "Народна республіка");
const JUNTA = L("Military government", "Военное правительство", "Військовий уряд");
const PARLIAMENTARY = L("Parliamentary republic", "Парламентская республика", "Парламентська республіка");
const MONARCHY = L("Constitutional monarchy", "Конституционная монархия", "Конституційна монархія");
const DOMINION = L("Dominion of the Commonwealth", "Доминион Содружества", "Домініон Співдружності");
const PRESIDENTIAL = L("Presidential republic", "Президентская республика", "Президентська республіка");

/** The provinces of the map north of the 17th parallel, as the Geneva Accords drew it in 1954 (the line runs through the north-central coast, held by the North). */
const NORTH_VIETNAM = ["vn-tay-bac", "vn-ong-bac", "vn-northeast-vietnam", "vn-ong-b-c", "vn-ong-bang-song-hong", "vn-red-river-delta", "vn-bac-trung-bo"];

/** People in 1957 within today's borders: halfway, by growth, between the counts of 1950 and 1964 (UN estimates, thousands). */
function people1957(): NonNullable<Scenario["people"]> {
  const a = scenario1950.people!.byCountry;
  const b = scenario1964.people!.byCountry;
  const byCountry = Object.fromEntries(Object.keys(a).flatMap((k) => (b[k] ? [[k, Math.round(Math.sqrt(a[k] * b[k]))]] : [])));
  return { byCountry, others: 0.5 };
}

// The lines of the model's background that the date and its eve share.
const SPACE_1957 = `The space race: the Soviet R-7 (Korolev's OKB-1), the world's first intercontinental ballistic missile, flew its full range from Tyuratam (Baikonur) to Kamchatka on 21 August 1957; TASS announced it on 26 August. Sergei Korolev, the Chief Designer, a former Gulag prisoner whose name is a state secret, has a simple satellite (PS-1, 84 kg, two radio transmitters) ready; a larger scientific satellite (Object D) is late; a dog flight is planned. The United States has three rocket programmes: the Navy's Vanguard, chosen in 1955 for the International Geophysical Year (its first full test is set for December), the Army's Redstone and Jupiter at Huntsville under Wernher von Braun and General John Medaris (a Jupiter-C reached 1,100 km in September 1956 and could orbit a satellite within ninety days if allowed), and the Air Force's Atlas ICBM, whose first two tests in June and September failed. Cape Canaveral in Florida is the American range; the Soviet Union has Kapustin Yar and Tyuratam, and is building Plesetsk for missiles. France tests sounding rockets at Hammaguir in the Algerian Sahara; Britain has the Woomera range in Australia and is building the Blue Streak missile; China's Fifth Academy under Qian Xuesen, back from America in 1955, copies Soviet R-2 missiles; in Japan Hideo Itokawa's Tokyo University team flies small Kappa rockets. Satellite photography, an American secret project (WS-117L, later Corona), is years away; the U-2 has flown over the Soviet Union since July 1956.`;
const POWERS_1957 = `United States: President Dwight D. Eisenhower (re-elected 1956; heart attack 1955), Secretary of State John Foster Dulles, Defense Secretary Charles Wilson, about to be replaced by Neil McElroy on 9 October. The New Look: nuclear deterrence, a balanced budget, the Strategic Air Command's bombers; the Little Rock crisis is under way (paratroopers escort nine black pupils into Central High since 25 September). The Eisenhower Doctrine (March 1957) promises aid and, if asked, troops against communism in the Middle East. Soviet Union: First Secretary Nikita Khrushchev defeated Malenkov, Molotov and Kaganovich (the 'Anti-Party Group') in June with Marshal Zhukov's help; Zhukov, Minister of Defence, will be dismissed in late October; Nikolai Bulganin is Premier. The Secret Speech of February 1956 denounced Stalin; the thaw goes on at home, while Soviet troops crushed the Hungarian revolution in November 1956. China: Mao Zedong, Premier Zhou Enlai; the Hundred Flowers turned in June into the Anti-Rightist Campaign; the Great Leap Forward is being prepared; the PLA shells Kinmen from time to time; Soviet experts build China's industry and a treaty of 15 October will promise atomic help.`;
const WORLD_1957 = `Europe: NATO took West Germany in 1955, and the Warsaw Pact answered; Adenauer won an absolute majority on 15 September. The Saar returned to Germany on 1 January 1957; Austria is free and neutral since 1955. Poland's Gomułka won limited freedom in October 1956; Hungary's Kádár rules under Soviet arms. The Six signed the Treaties of Rome in March. Britain (Harold Macmillan since January) is cutting its forces (the Sandys White Paper) and tested its first H-bomb in May; it repaired relations with Washington at Bermuda. France: the Fourth Republic, President René Coty; Maurice Bourgès-Maunoury's government fell on 30 September over Algeria and no successor is named; about 400,000 French troops fight the FLN, whose network in Algiers was broken in the Battle of Algiers this year; Tunisia and Morocco, independent since 1956, shelter the ALN, and the Morice line is being built along the border. Middle East: Nasser nationalised the Suez Canal in 1956; Britain, France and Israel attacked and were made to withdraw by Washington and Moscow; UNEF stands in Sinai and Gaza. Syria, left-leaning and armed by the Soviet bloc, expelled American diplomats in August; Turkey has massed troops on its border, the Soviet Union warns Turkey and its fleet visits Latakia, and the US sends arms to Jordan, Iraq and Lebanon. Asia: Malaya became independent on 31 August, its emergency nearly won (the communists, under Chin Peng, are down to some two thousand in the jungle); Vietnam is divided since 1954 (Ngo Dinh Diem in Saigon, Ho Chi Minh in Hanoi); Sukarno proclaims 'guided democracy' and claims West New Guinea; India's Nehru is non-aligned and claims Goa. Africa: Ghana, under Kwame Nkrumah, became independent on 6 March, the first in black Africa; Sudan in 1956; the rest is still colonial. Latin America: Fidel Castro's guerrillas hold out in the Sierra Maestra against Batista; Juan Perón fell in 1955.`;

export const scenario1957: Scenario = {
  id: "1957",
  map: "world_1994",
  startDate: "1957-10-04",
  defaultStep: "month",
  title: {
    ru: "Космическая гонка",
    uk: "Космічні перегони",
    en: "The Space Race",
  },
  tagline: {
    ru: "Советская ракета выводит на орбиту первый спутник, и его сигнал слышат во всех столицах.",
    uk: "Радянська ракета виводить на орбіту перший супутник, і його сигнал чують у всіх столицях.",
    en: "A Soviet rocket puts the first satellite into orbit, and every capital hears its beep.",
  },
  story: {
    ru: "Вечером 4 октября 1957 года с полигона Тюратам в казахской степи стартует советская ракета Р-7 и выводит на орбиту алюминиевый шар весом 84 килограмма. Спутник облетает Землю за девяносто шесть минут, и его радиосигнал ловят любители в Америке, Британии и Японии. Ракета, которая его подняла, – первая в мире межконтинентальная, испытанная в августе: те же двигатели могут донести водородную бомбу до Нью-Йорка.\n\nВашингтон застигнут врасплох. Американский спутник «Авангард» ещё не летал, а армейской ракетной команде Вернера фон Брауна, которая могла запустить спутник ещё в 1956 году, велели ждать. Президент преуменьшает опасность, но газеты пишут о ракетном отставании, а в Конгрессе говорят о новом Пёрл-Харборе. В Москве Хрущёв, в июне победивший соперников в Президиуме, видит в спутнике доказательство того, что социализм побеждает.\n\nМир за пределами гонки неспокоен. Франция воюет в Алжире; Турция стягивает войска к сирийской границе, а Москва грозит Анкаре; Британия уходит из империи после унижения в Суэце, Гана и Малайя только что получили свободу; венгерское восстание раздавлено год назад; Китай обстреливает Цзиньмэнь, а Мао готовит «большой скачок». Каждое правительство теперь задаёт один вопрос: кто следующим выйдет в космос и что понесут его ракеты?",
    uk: "Увечері 4 жовтня 1957 року з полігона Тюратам у казахському степу стартує радянська ракета Р-7 і виводить на орбіту алюмінієву кулю вагою 84 кілограми. Супутник облітає Землю за дев'яносто шість хвилин, і його радіосигнал ловлять аматори в Америці, Британії та Японії. Ракета, що його підняла, – перша у світі міжконтинентальна, випробувана в серпні: ті самі двигуни можуть донести водневу бомбу до Нью-Йорка.\n\nВашингтон заскочено зненацька. Американський супутник «Авангард» ще не літав, а армійській ракетній команді Вернера фон Брауна, яка могла запустити супутник ще 1956 року, наказали чекати. Президент применшує небезпеку, але газети пишуть про ракетне відставання, а в Конгресі говорять про новий Перл-Гарбор. У Москві Хрущов, який у червні переміг суперників у Президії, бачить у супутнику доказ того, що соціалізм перемагає.\n\nСвіт за межами перегонів неспокійний. Франція воює в Алжирі; Туреччина стягує війська до сирійського кордону, а Москва погрожує Анкарі; Британія йде з імперії після приниження в Суеці, Гана й Малая щойно здобули свободу; угорське повстання розчавлено рік тому; Китай обстрілює Цзіньмень, а Мао готує «великий стрибок». Кожен уряд тепер ставить одне питання: хто наступним вийде в космос і що понесуть його ракети?",
    en: "On the evening of 4 October 1957 a Soviet R-7 rocket rises from the steppe at Tyuratam in Kazakhstan and puts an aluminium sphere of 84 kilograms into orbit. Sputnik circles the Earth every ninety-six minutes, and its radio beep is picked up by amateurs in America, Britain and Japan. The rocket that carried it is the world's first intercontinental missile, tested in August: the same engines could carry a hydrogen bomb to New York.\n\nWashington is caught off guard. America's satellite, Vanguard, has not yet flown, and the Army's rocket team under Wernher von Braun, which could have launched one in 1956, was told to wait. The President plays down the danger, but the newspapers speak of a missile gap, and Congress of a new Pearl Harbor. In Moscow Khrushchev, who beat his rivals in the Presidium in June, sees the satellite as proof that socialism is winning.\n\nThe world beyond the race is restless. France fights in Algeria; Turkey masses troops on the Syrian border while Moscow threatens Ankara; Britain is leaving its empire after the humiliation of Suez, and Ghana and Malaya are newly free; the Hungarian rising was crushed a year ago; China shells Kinmen and Mao prepares his Great Leap. Every government now asks the same question: who goes into space next, and what will its rockets carry?",
  },
  briefing: {
    ru: "Пятница, 4 октября 1957 года. В 22:28 по московскому времени Р-7 выводит с Тюратама первый искусственный спутник – на ракете, которая стала и первой межконтинентальной. «Авангард» в недели от первой попытки, команда фон Брауна ждёт разрешения, газеты кричат о ракетном отставании. Франция воюет с ФНО в Алжире, и её правительство только что пало; турецкая армия стоит у границы Сирии; Венгрия раздавлена год назад, Суэц стоил Британии влияния. Решите, кто следующим полетит в космос – и что понесут ракеты.",
    uk: "П'ятниця, 4 жовтня 1957 року. О 22:28 за московським часом Р-7 виводить із Тюратама перший штучний супутник – на ракеті, яка стала й першою міжконтинентальною. «Авангард» за тижні від першої спроби, команда фон Брауна чекає дозволу, газети кричать про ракетне відставання. Франція воює з ФНВ в Алжирі, і її уряд щойно впав; турецька армія стоїть біля кордону Сирії; Угорщину розчавлено рік тому, Суец коштував Британії впливу. Вирішіть, хто наступним полетить у космос – і що понесуть ракети.",
    en: "Friday, 4 October 1957. At 22:28 Moscow time an R-7 lifts the first artificial satellite from Tyuratam, on the rocket that is also the first intercontinental missile. Vanguard is weeks from its first try, von Braun's team waits for permission, and the newspapers cry missile gap. France fights the FLN in Algeria and its government has just fallen; Turkey's army stands on Syria's border; Hungary was crushed a year ago, and Suez cost Britain its standing. Decide who goes into space next, and what the rockets carry.",
  },
  context: `Date: Friday 4 October 1957, the day Sputnik 1 was launched. At 22:28 Moscow time (19:28 GMT) an R-7 rocket put PS-1 into orbit from Tyuratam (Baikonur): 84 kg, an orbit of about 228 by 947 km, a period of 96 minutes; its signal (20 and 40 MHz) is heard worldwide, and TASS announces it the next morning. Pravda's first report is modest; the world's reaction will make the Soviet leaders understand what they have done. In the United States the launch causes alarm ('Sputnik crisis'): talk of a missile gap, the Gaither Report (November) warns that the Soviet Union may soon outstrip the US in missiles; the first Vanguard test is set for December.
${SPACE_1957}
${POWERS_1957}
${WORLD_1957}
Real history for reference: Sputnik 2 carried the dog Laika into orbit on 3 November 1957; Vanguard TV3 exploded on the pad on 6 December ('Flopnik'); von Braun's Explorer 1 reached orbit on 31 January 1958 and found the Van Allen belts; NASA was founded on 1 October 1958 (T. Keith Glennan its first administrator; James Webb from 1961); Luna 2 hit the Moon in 1959 and Luna 3 photographed its far side; the first reconnaissance photographs from orbit came back from Corona (Discoverer 14) in August 1960; Yuri Gagarin orbited the Earth on 12 April 1961, Alan Shepard flew a suborbital flight on 5 May and Kennedy called for the Moon on 25 May; John Glenn orbited in February 1962; Alexei Leonov walked in space on 18 March 1965; Korolev died in January 1966; Apollo 8 orbited the Moon at Christmas 1968 and Apollo 11 landed on 20 July 1969; the Soviet N1 Moon rocket failed four times. Elsewhere: the Gaillard government in France in November 1957, the Fourth Republic's fall in May 1958 and de Gaulle's return; the Syrian crisis ended in late October 1957 without war, and Syria joined Egypt in the United Arab Republic in February 1958; the Iraqi revolution of July 1958 and the US landing in Lebanon; the second Taiwan Strait crisis (August 1958); the Ifni War (November 1957); Castro's victory on 1 January 1959.`,
  aliases: {},
  owners: {},
  // Every modern country given its owner of October 1957 (coldwar.ts): Ghana, Sudan, Morocco, Tunisia and Malaya free, Algeria French at war,
  // the Saar back in Germany, Austria whole, Vietnam divided, Rhodesia and Nyasaland one federation, most of Africa still colonial.
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
    PSX: "jordan",
    ERI: "ethiopia",
    SDS: "sudan",
    ...all("rhodesia", ["ZWE", "ZMB", "MWI"]),
    ...all("france", ["DZA", "MRT", "SEN", "MLI", "NER", "BFA", "GIN", "CIV", "BEN", "TGO", "CMR", "TCD", "CAF", "COG", "GAB", "MDG", "DJI"]),
    ...all("uk", [
      "NGA", "SLE", "GMB", "KEN", "UGA", "TZA", "BWA", "LSO", "SWZ", "SOL", "CYP", "CYN", "MLT", "SGP", "BRN", "KWT", "QAT", "BHR", "ARE",
      "GUY", "BLZ", "JAM", "TTO", "BRB", "BHS", "ATG", "DMA", "GRD", "KNA", "LCA", "VCT", "FJI", "SLB",
    ]),
    ...all("belgium", ["COD", "RWA", "BDI"]),
    ...all("portugal", ["AGO", "MOZ", "GNB"]),
    GNQ: "spain",
    SOM: "italy",
    SUR: "netherlands",
    PNG: "australia",
    WSM: "new-zealand",
    NAM: "south-africa",
  },
  provinceOwners: {
    ...all("east-germany", EAST_GERMAN),
    ...all("north-vietnam", NORTH_VIETNAM),
    ...all("uk", ADEN),
    // North Borneo and Sarawak stay British colonies until Malaysia (1963); the British Cameroons are a trust territory run from Nigeria.
    "my-sabah": "uk",
    "my-sarawak": "uk",
    "my-labuan": "uk",
    "cm-northwest": "uk",
    "cm-southwest": "uk",
    "ps-gaza": "egypt",
    "jp-okinawa": "usa",
    "in-goa": "portugal",
    "in-dadra-and-nagar-haveli-and-daman-and-diu": "portugal",
    "id-papua": "netherlands",
    "id-west-papua": "netherlands",
  },
  // The FLN's guerrillas in the Aurès, Kabylia and the North Constantinois; the last Malayan communists in the jungle; Castro in the Sierra Maestra.
  provinceContested: {
    "dz-batna": "fln",
    "dz-khenchela": "fln",
    "dz-tizi-ouzou": "fln",
    "dz-bejaia": "fln",
    "dz-jijel": "fln",
    "dz-souk-ahras": "fln",
    "my-perak": "malayan-communists",
    "my-pahang": "malayan-communists",
    "my-johor": "malayan-communists",
    "cu-granma": "july-26-movement",
    "cu-santiago-de-cuba": "july-26-movement",
  },
  provinceHeld: {
    "dz-batna": 30,
    "dz-khenchela": 30,
    "dz-tizi-ouzou": 25,
    "dz-bejaia": 20,
    "dz-jijel": 20,
    "dz-souk-ahras": 15,
    "my-perak": 10,
    "my-pahang": 10,
    "my-johor": 10,
    "cu-granma": 20,
    "cu-santiago-de-cuba": 10,
  },
  people: people1957(),
  countries: {
    usa: seed(L("United States", "США", "США"), "#6680c2", "President Dwight D. Eisenhower; Secretary of State John Foster Dulles", L("Federal republic", "Федеративная республика", "Федеративна республіка"), { stability: 75, economy: 95, military: 85 }),
    ussr: seed(L("Soviet Union", "СССР", "СРСР"), "#a3292c", "First Secretary Nikita Khrushchev; Premier Nikolai Bulganin", COMMUNIST, { stability: 75, economy: 55, military: 90 }),
    china: seed(L("People's Republic of China", "КНР", "КНР"), "#cf3d2e", "Chairman Mao Zedong; Premier Zhou Enlai", COMMUNIST, { stability: 60, economy: 18, military: 60 }),
    taiwan: seed(L("Republic of China", "Китайская Республика", "Китайська Республіка"), "#5a86c6", "President Chiang Kai-shek", L("One-party state under martial law", "Однопартийное государство на военном положении", "Однопартійна держава на воєнному стані"), { stability: 60, economy: 12, military: 25 }),
    "north-korea": seed(L("North Korea", "КНДР", "КНДР"), "#a05a6a", "Premier Kim Il-sung", COMMUNIST, { stability: 70, economy: 18, military: 40 }),
    "south-korea": seed(L("South Korea", "Республика Корея", "Республіка Корея"), "#7f9fc9", "President Syngman Rhee", L("Authoritarian presidential republic", "Авторитарная президентская республика", "Авторитарна президентська республіка"), { stability: 40, economy: 12, military: 40 }),
    japan: seed(L("Japan", "Япония", "Японія"), "#e6d6a6", "PM Nobusuke Kishi", MONARCHY, { stability: 70, economy: 45, military: 10 }),
    uk: seed(L("United Kingdom", "Великобритания", "Велика Британія"), "#d0666b", "PM Harold Macmillan; Queen Elizabeth II", L("Constitutional monarchy and empire", "Конституционная монархия и империя", "Конституційна монархія та імперія"), { stability: 70, economy: 55, military: 55 }),
    france: seed(L("France", "Франция", "Франція"), "#4a72b8", "President René Coty; Maurice Bourgès-Maunoury's government fell on 30 September", L("Fourth Republic and colonial empire", "Четвёртая республика и колониальная империя", "Четверта республіка та колоніальна імперія"), { stability: 30, economy: 50, military: 45 }),
    "west-germany": seed(L("West Germany", "ФРГ", "ФРН"), "#6f7277", "Chancellor Konrad Adenauer; President Theodor Heuss", L("Federal parliamentary republic", "Федеративная парламентская республика", "Федеративна парламентська республіка"), { stability: 80, economy: 55, military: 15 }),
    "east-germany": seed(L("East Germany", "ГДР", "НДР"), "#a4646a", "First Secretary Walter Ulbricht; Premier Otto Grotewohl; President Wilhelm Pieck", PEOPLES_REPUBLIC, { stability: 45, economy: 35, military: 15 }),
    italy: seed(L("Italy", "Италия", "Італія"), "#5a9d55", "PM Adone Zoli; President Giovanni Gronchi", PARLIAMENTARY, { stability: 55, economy: 40, military: 25 }),
    spain: seed(L("Spain", "Испания", "Іспанія"), "#d9ab45", "Caudillo Francisco Franco", L("Dictatorship", "Диктатура", "Диктатура"), { stability: 65, economy: 22, military: 25 }),
    portugal: seed(L("Portugal", "Португалия", "Португалія"), "#4e8a5e", "PM António de Oliveira Salazar", L("Dictatorship (the Estado Novo) and colonial empire", "Диктатура («Новое государство») и колониальная империя", "Диктатура («Нова держава») та колоніальна імперія"), { stability: 70, economy: 15, military: 15 }),
    austria: seed(L("Austria", "Австрия", "Австрія"), "#c96f6f", "Chancellor Julius Raab; President Adolf Schärf", L("Neutral federal republic", "Нейтральная федеративная республика", "Нейтральна федеративна республіка"), { stability: 75, economy: 25, military: 5 }),
    greece: seed(L("Greece", "Греция", "Греція"), "#5b8fd6", "PM Konstantinos Karamanlis", MONARCHY, { stability: 55, economy: 15, military: 20 }),
    turkey: seed(L("Turkey", "Турция", "Туреччина"), "#4f9a8c", "President Celal Bayar; PM Adnan Menderes", PARLIAMENTARY, { stability: 50, economy: 20, military: 40 }),
    poland: seed(L("Poland", "Польша", "Польща"), "#d27b93", "First Secretary Władysław Gomułka", PEOPLES_REPUBLIC, { stability: 50, economy: 25, military: 30 }),
    czechoslovakia: seed(L("Czechoslovakia", "Чехословакия", "Чехословаччина"), "#6d9bd0", "First Secretary Antonín Novotný; President Antonín Zápotocký", PEOPLES_REPUBLIC, { stability: 60, economy: 40, military: 25 }),
    hungary: seed(L("Hungary", "Венгрия", "Угорщина"), "#9fb06a", "János Kádár, First Secretary and Premier", L("People's republic under Soviet occupation", "Народная республика под советской оккупацией", "Народна республіка під радянською окупацією"), { stability: 30, economy: 22, military: 5 }),
    romania: seed(L("Romania", "Румыния", "Румунія"), "#d8bd46", "First Secretary Gheorghe Gheorghiu-Dej; PM Chivu Stoica", PEOPLES_REPUBLIC, { stability: 55, economy: 20, military: 20 }),
    bulgaria: seed(L("Bulgaria", "Болгария", "Болгарія"), "#6c9a50", "First Secretary Todor Zhivkov; PM Anton Yugov", PEOPLES_REPUBLIC, { stability: 60, economy: 18, military: 20 }),
    albania: seed(L("Albania", "Албания", "Албанія"), "#a4453f", "Enver Hoxha", PEOPLES_REPUBLIC, { stability: 60, economy: 5, military: 8 }),
    yugoslavia: seed(L("Yugoslavia", "Югославия", "Югославія"), "#8873b3", "President Josip Broz Tito", L("Communist federation outside the blocs", "Коммунистическая федерация вне блоков", "Комуністична федерація поза блоками"), { stability: 70, economy: 25, military: 40 }),
    india: seed(L("India", "Индия", "Індія"), "#e0a458", "PM Jawaharlal Nehru; President Rajendra Prasad", L("Federal parliamentary republic", "Федеративная парламентская республика", "Федеративна парламентська республіка"), { stability: 60, economy: 18, military: 25 }),
    pakistan: seed(L("Pakistan", "Пакистан", "Пакистан"), "#3f7f4f", "President Iskander Mirza; PM Huseyn Shaheed Suhrawardy", L("Islamic republic", "Исламская республика", "Ісламська республіка"), { stability: 30, economy: 12, military: 20 }),
    ceylon: seed(L("Ceylon", "Цейлон", "Цейлон"), "#c98c6b", "PM S. W. R. D. Bandaranaike", DOMINION, { stability: 50, economy: 15, military: 3 }),
    burma: seed(L("Burma", "Бирма", "Бірма"), "#c9b04a", "PM U Nu", L("Parliamentary republic at civil war", "Парламентская республика в гражданской войне", "Парламентська республіка в громадянській війні"), { stability: 35, economy: 8, military: 12 }),
    indonesia: seed(L("Indonesia", "Индонезия", "Індонезія"), "#c4614f", "President Sukarno; PM Djuanda Kartawidjaja", L("Republic turning to 'guided democracy'", "Республика на пути к «направляемой демократии»", "Республіка на шляху до «керованої демократії»"), { stability: 30, economy: 12, military: 25 }),
    malaysia: seed(L("Federation of Malaya", "Малайская Федерация", "Малайська Федерація"), "#5f7fb5", "PM Tunku Abdul Rahman", L("Federal constitutional monarchy, newly independent", "Федеративная конституционная монархия, только что независимая", "Федеративна конституційна монархія, щойно незалежна"), { stability: 55, economy: 12, military: 8 }),
    thailand: seed(L("Thailand", "Таиланд", "Таїланд"), "#6a8fc9", "Field Marshal Sarit Thanarat; caretaker PM Pote Sarasin", JUNTA, { stability: 45, economy: 15, military: 20 }),
    "north-vietnam": seed(L("North Vietnam", "Северный Вьетнам", "Північний В'єтнам"), "#b8453a", "President Ho Chi Minh; Premier Pham Van Dong", COMMUNIST, { stability: 65, economy: 8, military: 35 }),
    "south-vietnam": seed(L("South Vietnam", "Южный Вьетнам", "Південний В'єтнам"), "#d0a43a", "President Ngo Dinh Diem", L("Authoritarian presidential republic", "Авторитарная президентская республика", "Авторитарна президентська республіка"), { stability: 45, economy: 10, military: 20 }),
    laos: seed(L("Laos", "Лаос", "Лаос"), "#8fae6a", "PM Prince Souvanna Phouma; King Sisavang Vong", L("Kingdom negotiating with the Pathet Lao", "Королевство в переговорах с Патет Лао", "Королівство в переговорах з Патет Лао"), { stability: 35, economy: 4, military: 5 }),
    cambodia: seed(L("Cambodia", "Камбоджа", "Камбоджа"), "#6a9ab0", "King Norodom Suramarit; Prince Norodom Sihanouk, leader of the Sangkum", L("Neutral kingdom", "Нейтральное королевство", "Нейтральне королівство"), { stability: 60, economy: 5, military: 6 }),
    philippines: seed(L("Philippines", "Филиппины", "Філіппіни"), "#6a8fd0", "President Carlos P. Garcia", PRESIDENTIAL, { stability: 50, economy: 15, military: 12 }),
    mongolia: seed(L("Mongolia", "Монголия", "Монголія"), "#9a78b8", "Yumjaagiin Tsedenbal, Chairman of the Council of Ministers", PEOPLES_REPUBLIC, { stability: 65, economy: 5, military: 6 }),
    israel: seed(L("Israel", "Израиль", "Ізраїль"), "#7fa8d4", "PM David Ben-Gurion", PARLIAMENTARY, { stability: 65, economy: 20, military: 35 }),
    egypt: seed(L("Egypt", "Египет", "Єгипет"), "#d6c27a", "President Gamal Abdel Nasser", L("Republic of the Free Officers", "Республика «Свободных офицеров»", "Республіка «Вільних офіцерів»"), { stability: 65, economy: 18, military: 25 }),
    syria: seed(L("Syria", "Сирия", "Сирія"), "#8c9a5a", "President Shukri al-Quwatli; Chief of Staff Afif al-Bizri", L("Parliamentary republic under the army's sway", "Парламентская республика под влиянием армии", "Парламентська республіка під впливом армії"), { stability: 30, economy: 10, military: 15 }),
    jordan: seed(L("Jordan", "Иордания", "Йорданія"), "#c4a46a", "King Hussein", MONARCHY, { stability: 40, economy: 6, military: 12 }),
    iraq: seed(L("Iraq", "Ирак", "Ірак"), "#9a8f5f", "King Faisal II; PM Ali Jawdat al-Ayyubi", MONARCHY, { stability: 40, economy: 14, military: 15 }),
    lebanon: seed(L("Lebanon", "Ливан", "Ліван"), "#7fb58a", "President Camille Chamoun", L("Confessional parliamentary republic", "Конфессиональная парламентская республика", "Конфесійна парламентська республіка"), { stability: 40, economy: 10, military: 4 }),
    "saudi-arabia": seed(L("Saudi Arabia", "Саудовская Аравия", "Саудівська Аравія"), "#6f9e5a", "King Saud", L("Absolute monarchy", "Абсолютная монархия", "Абсолютна монархія"), { stability: 55, economy: 18, military: 8 }),
    iran: seed(L("Iran", "Иран", "Іран"), "#7fae86", "Shah Mohammad Reza Pahlavi; PM Manouchehr Eghbal", MONARCHY, { stability: 50, economy: 18, military: 22 }),
    afghanistan: seed(L("Afghanistan", "Афганистан", "Афганістан"), "#a3876a", "King Zahir Shah; PM Mohammad Daoud Khan", L("Kingdom", "Королевство", "Королівство"), { stability: 55, economy: 4, military: 8 }),
    ethiopia: seed(L("Ethiopia", "Эфиопия", "Ефіопія"), "#7f9a4f", "Emperor Haile Selassie", L("Empire", "Империя", "Імперія"), { stability: 55, economy: 6, military: 10 }),
    sudan: seed(L("Sudan", "Судан", "Судан"), "#b0905a", "PM Abdallah Khalil", PARLIAMENTARY, { stability: 35, economy: 8, military: 6 }),
    libya: seed(L("Libya", "Ливия", "Лівія"), "#9fb07a", "King Idris", MONARCHY, { stability: 50, economy: 4, military: 3 }),
    morocco: seed(L("Morocco", "Марокко", "Марокко"), "#a0523d", "King Mohammed V", MONARCHY, { stability: 55, economy: 10, military: 8 }),
    tunisia: seed(L("Tunisia", "Тунис", "Туніс"), "#c26b5a", "President Habib Bourguiba", L("Republic of the Neo Destour", "Республика Нео-Дестура", "Республіка Нео-Дестуру"), { stability: 60, economy: 8, military: 4 }),
    ghana: seed(L("Ghana", "Гана", "Гана"), "#c9a13a", "PM Kwame Nkrumah", DOMINION, { stability: 60, economy: 8, military: 3 }),
    rhodesia: seed(L("Federation of Rhodesia and Nyasaland", "Федерация Родезии и Ньясаленда", "Федерація Родезії та Ньясаленду"), "#7a9a6e", "PM Roy Welensky", L("Self-governing federation ruled by the white minority", "Самоуправляемая федерация под властью белого меньшинства", "Самоврядна федерація під владою білої меншості"), { stability: 45, economy: 10, military: 5 }),
    "south-africa": seed(L("South Africa", "ЮАС", "ПАС"), "#c48a5a", "PM J. G. Strijdom", L("Dominion ruled by the white minority (apartheid)", "Доминион под властью белого меньшинства (апартеид)", "Домініон під владою білої меншості (апартеїд)"), { stability: 50, economy: 25, military: 10 }),
    canada: seed(L("Canada", "Канада", "Канада"), "#c44f4f", "PM John Diefenbaker", DOMINION, { stability: 80, economy: 65, military: 25 }),
    australia: seed(L("Australia", "Австралия", "Австралія"), "#d88a5a", "PM Robert Menzies", DOMINION, { stability: 80, economy: 50, military: 15 }),
    "new-zealand": seed(L("New Zealand", "Новая Зеландия", "Нова Зеландія"), "#4f7fb0", "PM Keith Holyoake", DOMINION, { stability: 80, economy: 30, military: 5 }),
    mexico: seed(L("Mexico", "Мексика", "Мексика"), "#5f9e6a", "President Adolfo Ruiz Cortines", L("One-party republic (the PRI)", "Однопартийная республика (ИРП)", "Однопартійна республіка (ІРП)"), { stability: 65, economy: 20, military: 10 }),
    cuba: seed(L("Cuba", "Куба", "Куба"), "#5a7fbf", "President Fulgencio Batista", L("Military dictatorship", "Военная диктатура", "Військова диктатура"), { stability: 30, economy: 15, military: 10 }),
    argentina: seed(L("Argentina", "Аргентина", "Аргентина"), "#8fbfe0", "Provisional President Pedro Aramburu", JUNTA, { stability: 40, economy: 30, military: 18 }),
    brazil: seed(L("Brazil", "Бразилия", "Бразилія"), "#4f9a5f", "President Juscelino Kubitschek", PRESIDENTIAL, { stability: 55, economy: 25, military: 15 }),
    venezuela: seed(L("Venezuela", "Венесуэла", "Венесуела"), "#c9a65a", "President Marcos Pérez Jiménez", JUNTA, { stability: 35, economy: 22, military: 10 }),
    fln: {
      ...seed(L("FLN (Algeria)", "ФНО (Алжир)", "ФНВ (Алжир)"), "#3f8f5a", "Krim Belkacem and the Committee of Coordination and Execution", L("National liberation front at war", "Фронт национального освобождения в войне", "Фронт національного визволення у війні"), { stability: 55, economy: 1, military: 12 }),
      dormant: true,
    },
    "malayan-communists": {
      ...seed(L("Malayan Communist Party", "Компартия Малайи", "Компартія Малаї"), "#9a3b3b", "Secretary-General Chin Peng", L("Communist insurgency", "Коммунистическое повстанческое движение", "Комуністичний повстанський рух"), { stability: 25, economy: 1, military: 2 }),
      dormant: true,
    },
    "july-26-movement": {
      ...seed(L("26th of July Movement", "Движение 26 июля", "Рух 26 липня"), "#7a1f2b", "Fidel Castro", L("Revolutionary insurgency", "Революционное повстанческое движение", "Революційний повстанський рух"), { stability: 60, economy: 1, military: 2 }),
      dormant: true,
    },
  },
  wars: [
    {
      id: "algerian-war",
      name: L("Algerian War", "Алжирская война", "Алжирська війна"),
      attackers: ["fln"],
      defenders: ["france"],
      since: "1954-11-01",
    },
    {
      id: "malayan-emergency",
      name: L("Malayan Emergency", "Малайское чрезвычайное положение", "Малайський надзвичайний стан"),
      attackers: ["malayan-communists"],
      defenders: ["malaysia", "uk"],
      since: "1948-06-16",
    },
    {
      id: "cuban-revolution",
      name: L("Cuban Revolution", "Кубинская революция", "Кубинська революція"),
      attackers: ["july-26-movement"],
      defenders: ["cuba"],
      since: "1956-12-02",
    },
  ],
  alliances: withTreaties(
    [
      {
        id: "un",
        kind: "organization",
        name: L("United Nations", "Организация Объединённых Наций", "Організація Об'єднаних Націй"),
        // The Republic of China holds China's seat; the divided states, Switzerland and Mongolia are outside; Ghana and Malaya joined this year.
        members: [],
        allExcept: [
          "china", "west-germany", "east-germany", "north-korea", "south-korea", "north-vietnam", "south-vietnam", "switzerland", "mongolia",
          "oman", "bhutan", "andorra", "liechtenstein", "rhodesia", "fln", "malayan-communists", "july-26-movement",
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
    TERMS_1957,
    TREATIES_1957,
  ),
  featured: ["ussr", "usa", "uk", "france", "china", "west-germany", "egypt", "turkey", "syria", "india"],
  // A week before Sputnik: the R-7 has flown, the satellite waits on the pad, America's Vanguard is weeks away, France still has a government.
  variants: {
    eve: {
      startDate: "1957-09-27",
      defaultStep: "week",
      tagline: {
        ru: "Советская ракета уже долетела до Камчатки, на старте в Тюратаме ждёт спутник, а американский «Авангард» ещё в неделях от запуска.",
        uk: "Радянська ракета вже долетіла до Камчатки, на старті в Тюратамі чекає супутник, а американський «Авангард» ще за тижні від запуску.",
        en: "A Soviet rocket has already flown to Kamchatka, a satellite waits on the pad at Tyuratam, and America's Vanguard is still weeks from launch.",
      },
      story: {
        ru: "27 сентября 1957 года космос ещё пуст. Месяц назад ТАСС объявил об испытании межконтинентальной ракеты: Р-7 Королёва пролетела от казахской степи до Камчатки. Теперь на стартовом столе в Тюратаме собирают ракету с простейшим спутником – шаром с двумя передатчиками. Королёв торопится: он слышал, что американцы готовят запуск, и хочет успеть к годовщине.\n\nВ Америке спутник считают делом науки, а не престижа. Флотский «Авангард», выбранный для Международного геофизического года, не готов до декабря. Армейская команда Вернера фон Брауна в Хантсвилле держит на складе ракету «Юпитер-С», способную вывести спутник за три месяца, но Пентагон запретил ей соперничать с флотом. Президент Эйзенхауэр не видит в гонке причин для спешки.\n\nВ остальном мире хватает своих забот. Турецкие войска стоят у сирийской границы, советский флот идёт к Латакии, американское оружие летит в Иорданию и Ирак. Во Франции правительство Бурже-Монури обсуждает закон об Алжире и может пасть. Кто первым выйдет на орбиту, ещё не решено – и это может решить ваш приказ.",
        uk: "27 вересня 1957 року космос ще порожній. Місяць тому ТАРС оголосив про випробування міжконтинентальної ракети: Р-7 Корольова пролетіла від казахського степу до Камчатки. Тепер на стартовому столі в Тюратамі збирають ракету з найпростішим супутником – кулею з двома передавачами. Корольов поспішає: він чув, що американці готують запуск, і хоче встигнути до річниці.\n\nВ Америці супутник вважають справою науки, а не престижу. Флотський «Авангард», обраний для Міжнародного геофізичного року, не готовий до грудня. Армійська команда Вернера фон Брауна в Гантсвіллі тримає на складі ракету «Юпітер-С», здатну вивести супутник за три місяці, але Пентагон заборонив їй змагатися з флотом. Президент Ейзенгауер не бачить у перегонах причин для поспіху.\n\nРешта світу має свої клопоти. Турецькі війська стоять біля сирійського кордону, радянський флот іде до Латакії, американська зброя летить до Йорданії та Іраку. У Франції уряд Бурже-Монурі обговорює закон про Алжир і може впасти. Хто першим вийде на орбіту, ще не вирішено – і це може вирішити ваш наказ.",
        en: "On 27 September 1957 space is still empty. A month ago TASS announced the test of an intercontinental missile: Korolev's R-7 flew from the Kazakh steppe to Kamchatka. Now a rocket with the simplest of satellites, a sphere with two transmitters, is being assembled on the pad at Tyuratam. Korolev is in a hurry: he has heard that the Americans are preparing a launch and wants to be first.\n\nIn America a satellite is a matter of science, not prestige. The Navy's Vanguard, chosen for the International Geophysical Year, will not be ready before December. Wernher von Braun's Army team at Huntsville keeps a Jupiter-C in storage that could orbit a satellite within three months, but the Pentagon has forbidden it to compete with the Navy. President Eisenhower sees no reason to hurry.\n\nThe rest of the world has troubles of its own. Turkish troops stand on the Syrian border, the Soviet fleet sails for Latakia, and American arms fly to Jordan and Iraq. In France, Bourgès-Maunoury's government debates a law for Algeria and may fall. Who reaches orbit first is not yet decided, and your orders may decide it.",
      },
      briefing: {
        ru: "27 сентября 1957 года. Р-7 Королёва пролетела до Камчатки, и на старте в Тюратаме готовят спутник; флотский «Авангард» не полетит до декабря, ракета фон Брауна стоит на складе. Турецкая армия у границы Сирии, Москва грозит Анкаре; во Франции шатается правительство Бурже-Монури, в Алжире идёт война. Космос пуст: первый спутник может стать советским, американским – или ничьим ещё долго.",
        uk: "27 вересня 1957 року. Р-7 Корольова пролетіла до Камчатки, і на старті в Тюратамі готують супутник; флотський «Авангард» не полетить до грудня, ракета фон Брауна стоїть на складі. Турецька армія біля кордону Сирії, Москва погрожує Анкарі; у Франції хитається уряд Бурже-Монурі, в Алжирі триває війна. Космос порожній: перший супутник може стати радянським, американським – або нічиїм ще довго.",
        en: "27 September 1957. Korolev's R-7 has flown to Kamchatka and a satellite is being readied on the pad at Tyuratam; the Navy's Vanguard will not fly before December, and von Braun's rocket sits in storage. Turkey's army stands on Syria's border and Moscow threatens Ankara; in France Bourgès-Maunoury's government is tottering, and the Algerian war goes on. Space is empty: the first satellite may be Soviet, American, or no one's for a long while.",
      },
      context: `Date: Friday 27 September 1957, a week before Sputnik. No satellite has been launched. The R-7 ICBM flew its full range on 21 August and again on 7 September (both warheads broke up on re-entry); the next R-7, with the simple satellite PS-1, is being prepared at Tyuratam for launch in early October. Korolev pushed for the simple satellite in place of the late Object D, fearing an American launch first. In the US, Vanguard's first test with a satellite is set for December; the Army's Jupiter-C (Redstone with upper stages), which reached 1,100 km in September 1956, is barred from orbiting a satellite; the Atlas ICBM failed its second test on 25 September. The Little Rock crisis is at its height (101st Airborne in the city since 24 September).
${SPACE_1957}
${POWERS_1957}
${WORLD_1957.replace("Maurice Bourgès-Maunoury's government fell on 30 September over Algeria and no successor is named", "Prime Minister Maurice Bourgès-Maunoury's government faces a vote on its Algerian framework law (it will fall on 30 September)")}
Real history for reference: on 4 October 1957 an R-7 put Sputnik 1 into orbit from Tyuratam; the world's reaction made it a sensation; Sputnik 2 carried the dog Laika into orbit on 3 November; Vanguard TV3 exploded on the pad on 6 December; Explorer 1 reached orbit on 31 January 1958; NASA was founded on 1 October 1958; Gagarin orbited the Earth on 12 April 1961; Apollo 11 landed on the Moon on 20 July 1969. The Syrian crisis ended in late October 1957 without war; the Gaillard government took office in France on 6 November.`,
      leaders: {
        france: "President René Coty; PM Maurice Bourgès-Maunoury",
      },
    },
  },
};

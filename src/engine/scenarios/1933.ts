import type { Scenario } from "../types";
import { scenario1939 } from "./1939";
import { ADEN, L, seed } from "./coldwar";
import { TERMS_1933, TREATIES_1933, withTreaties } from "./treaties";

const COMMONWEALTH_DOMINION = L("Dominion of the British Commonwealth", "Доминион Британского Содружества", "Домініон Британської Співдружності");
const MONARCHY = L("Constitutional monarchy", "Конституционная монархия", "Конституційна монархія");
const PARLIAMENTARY = L("Parliamentary republic", "Парламентская республика", "Парламентська республіка");
const PRESIDENTIAL = L("Presidential republic", "Президентская республика", "Президентська республіка");
const DICTATORSHIP = L("Dictatorship", "Диктатура", "Диктатура");
const ABSOLUTE = L("Absolute monarchy", "Абсолютная монархия", "Абсолютна монархія");

/**
 * The parts of the 1938 map's Manchuria that were Manchukuo's in January
 * 1933, standard provinces whose finer parts follow them; Jehol, which Japan
 * took in February and March, is given back to China part by part below.
 */
const MANCHURIA = ["cn-heilongjiang", "cn-jilin", "cn-liaoning", "cn-inner-mongolia-p2"];
const JEHOL = ["cn-liaoning-chaoyang", "cn-liaoning-chaoyang-p2", "cn-liaoning-lingyuan", "cn-liaoning-lingyuan-p2", "cn-liaoning-liaoning-west"];

// The lines of the model's background that the date and its eve share.
const DEPRESSION_1933 = `The Great Depression is at its worst: world trade has fallen by two-thirds since 1929; Germany has about six million registered unemployed, the United States about thirteen million (a quarter of the workforce), Britain nearly three million. Britain left the gold standard in September 1931 and turned to imperial preference (Ottawa, 1932); the United States, France, the Netherlands, Belgium, Switzerland and Italy still hold to gold. Reparations were all but ended at Lausanne in July 1932; the war debts to America are in default. In the United States banks are failing again and a banking panic is building in Michigan; Herbert Hoover, beaten in November, governs until Franklin D. Roosevelt's inauguration on 4 March. The Soviet Union has declared its first five-year plan fulfilled in four years (Magnitogorsk, the Dnieper dam, the tractor plants), at the price of forced collectivisation and a famine that is killing millions in Ukraine, the Kuban, the Volga and Kazakhstan; the internal passport and the decree of 22 January 1933 seal the starving villages in.`;
const POWERS_1933 = `Germany: the Weimar Republic under emergency decrees since 1930. President Paul von Hindenburg is 85. The Nazi party won 37% in July 1932 and 33% in November; the Communists 17%. The Reichswehr (100,000 men under Versailles) is secretly rearming; Germany demands equality of rights at the Disarmament Conference in Geneva, granted in principle in December 1932. France: the Third Republic, President Albert Lebrun; governments fall every few months (Joseph Paul-Boncour's fell on 28 January; Édouard Daladier is forming the next); the army is the strongest in Europe, and the Maginot Line is being built. Britain: Ramsay MacDonald's National Government, King George V; disarmament and the ten-year rule. Italy: Mussolini, ten years in power. Japan: Emperor Hirohito, Prime Minister Admiral Saitō Makoto; the army runs policy in Manchuria. The Soviet Union: Stalin, Premier Vyacheslav Molotov; non-aggression pacts with Poland, France, Finland and the Baltic states signed in 1932. Poland: Marshal Józef Piłsudski, master of the state. Austria: Chancellor Engelbert Dollfuss, governing by a one-vote majority.`;
const WORLD_1933 = `Asia: Japan seized Manchuria after the Mukden incident (September 1931) and set up Manchukuo (March 1932) under Puyi, the last Qing emperor, as Chief Executive; Japanese troops took Shanhaiguan, where the Great Wall meets the sea, on 3 January 1933, and the Kwantung Army is preparing to take the province of Jehol. The League's Lytton Commission called Manchukuo a Japanese creation; the Assembly is to vote on its report in February. China: Chiang Kai-shek's Nationalist government in Nanjing (Premier Wang Jingwei), many provinces under their own warlords; the Communists hold a Soviet Republic in southern Jiangxi and western Fujian (capital Ruijin; Mao Zedong chairs its government, Bo Gu leads the party), and Chiang's fourth encirclement campaign has begun against it. Siam became a constitutional monarchy after the coup of June 1932. Middle East: Iraq became independent and joined the League in October 1932; Ibn Saud proclaimed the Kingdom of Saudi Arabia in September 1932; Persia is ruled by Reza Shah; Palestine, Transjordan, Syria and Lebanon are British and French mandates. Africa: Ethiopia under Haile Selassie is independent and a League member; Italy holds Eritrea, Somalia and Libya. Latin America: Bolivia and Paraguay fight the Chaco War (Bolivia's attack under General Hans Kundt on the Paraguayan fort of Nanawa failed last week); Peruvian irregulars seized Leticia from Colombia in September 1932 and Colombia is sending an expedition up the Amazon; Getúlio Vargas rules Brazil after the revolution of 1930; Gerardo Machado's dictatorship in Cuba is besieged by strikes and terror. Spain: the Second Republic (Manuel Azaña's government); an anarchist rising was crushed this month, and the massacre of Casas Viejas shakes the government. The Saar is governed by a League commission until a plebiscite in 1935; Danzig is a Free City under the League; Memel is Lithuanian; Austria and Czechoslovakia are whole.`;

export const scenario1933: Scenario = {
  id: "1933",
  map: "world_1938",
  startDate: "1933-01-30",
  defaultStep: "month",
  title: {
    ru: "Гитлер приходит к власти",
    uk: "Гітлер приходить до влади",
    en: "Hitler Comes to Power",
  },
  tagline: {
    ru: "Гинденбург назначает Гитлера канцлером, а его консервативные партнёры уверены, что удержат его в узде.",
    uk: "Гінденбург призначає Гітлера канцлером, а його консервативні партнери певні, що втримають його в шорах.",
    en: "Hindenburg makes Hitler Chancellor, and his conservative partners are sure they can keep him in check.",
  },
  story: {
    ru: "Утром 30 января 1933 года президент Пауль фон Гинденбург приводит к присяге Адольфа Гитлера как рейхсканцлера Германии. Вождь национал-социалистов, крупнейшей партии рейхстага, возглавляет кабинет, где у его партии всего два министерских кресла кроме его собственного; вице-канцлер Франц фон Папен и консерваторы вокруг старого фельдмаршала уверены, что наняли Гитлера себе на службу. Вечером колонны штурмовиков с факелами проходят через Бранденбургские ворота.\n\nГермания живёт четвёртый год Великой депрессии: шесть миллионов безработных, в 1931 году рухнули банки, коммунисты и нацисты дерутся на улицах. Вместе с ней страдает весь мир. В Соединённых Штатах без работы четверть рабочих, и банки снова закрываются; Франклин Рузвельт, избранный в ноябре, вступит в должность только в марте, а Герберт Гувер правит без мандата. В Советском Союзе первая пятилетка Сталина построила заводы ценой голода, от которого гибнут миллионы на Украине и в Казахстане.\n\nКоллективная безопасность проходит испытание и не выдерживает его. Япония превратила Маньчжурию в марионеточное Маньчжоу-го и готовит удар по Жэхэ; Лига Наций скоро проголосует по докладу Литтона, и Япония грозит уйти. Конференция по разоружению в Женеве не может решить, можно ли Германии вооружаться. Боливия и Парагвай воюют за Чако, Перу и Колумбия за Летисию, а в Китае армии Чан Кайши осаждают советский район Мао в Цзянси. Удастся ли сдержать Гитлера, партнёрам дома или державам за границей, – главный вопрос года.",
    uk: "Уранці 30 січня 1933 року президент Пауль фон Гінденбург приводить до присяги Адольфа Гітлера як рейхсканцлера Німеччини. Вождь націонал-соціалістів, найбільшої партії рейхстагу, очолює кабінет, де його партія має лише два міністерські крісла, крім його власного; віцеканцлер Франц фон Папен і консерватори довкола старого фельдмаршала певні, що найняли Гітлера собі на службу. Увечері колони штурмовиків зі смолоскипами проходять крізь Бранденбурзькі ворота.\n\nНімеччина живе четвертий рік Великої депресії: шість мільйонів безробітних, 1931 року впали банки, комуністи й нацисти б'ються на вулицях. Разом із нею страждає весь світ. У Сполучених Штатах без роботи чверть робітників, і банки знову зачиняються; Франклін Рузвельт, обраний у листопаді, обійме посаду лише в березні, а Герберт Гувер править без мандата. У Радянському Союзі перша п'ятирічка Сталіна збудувала заводи ціною голоду, від якого гинуть мільйони в Україні та Казахстані.\n\nКолективна безпека проходить випробування й не витримує його. Японія перетворила Маньчжурію на маріонеткове Маньчжоу-го і готує удар по Жехе; Ліга Націй незабаром голосуватиме щодо доповіді Літтона, і Японія погрожує вийти. Конференція з роззброєння в Женеві не може вирішити, чи можна Німеччині озброюватися. Болівія і Парагвай воюють за Чако, Перу й Колумбія за Летисію, а в Китаї армії Чан Кайші облягають радянський район Мао в Цзянсі. Чи вдасться стримати Гітлера, партнерам удома чи державам за кордоном, – головне питання року.",
    en: "On the morning of 30 January 1933 President Paul von Hindenburg swears in Adolf Hitler as Chancellor of Germany. The leader of the National Socialists, the largest party in the Reichstag, heads a cabinet in which his party holds only two seats besides his own; Vice-Chancellor Franz von Papen and the conservatives around the old field marshal are sure they have hired Hitler to do their work. That evening columns of storm troopers march with torches through the Brandenburg Gate.\n\nGermany is in the fourth year of the Great Depression: six million are out of work, the banks failed in 1931, and Communists and Nazis fight in the streets. The whole world suffers with it. In the United States a quarter of the workforce is idle and banks are closing again; Franklin D. Roosevelt, elected in November, takes office only in March, and Herbert Hoover governs without a mandate. In the Soviet Union Stalin's first five-year plan has built factories at the price of a famine that is killing millions in Ukraine and Kazakhstan.\n\nCollective security is being tested and is failing. Japan has turned Manchuria into the puppet state of Manchukuo and is preparing to strike at Jehol; the League of Nations will soon vote on the Lytton Report, and Japan threatens to walk out. The Disarmament Conference in Geneva cannot decide whether Germany may rearm. Bolivia and Paraguay fight over the Chaco, Peru and Colombia over Leticia, and in China Chiang Kai-shek's armies besiege Mao's soviet in Jiangxi. Whether Hitler can be contained, by his partners at home or by the powers abroad, is the question of the year.",
  },
  briefing: {
    ru: "30 января 1933 года. Гинденбург назначил Гитлера канцлером в кабинете, где нацистов меньшинство, а Папен надеется ими управлять. Шесть миллионов немцев без работы, Рузвельт ждёт инаугурации, пока американские банки падают, на Украине и в Казахстане голод. Япония готовит захват Жэхэ и уход из Лиги Наций, Боливия и Парагвай воюют в Чако, Чан Кайши окружает советский Цзянси. Мир ещё можно удержать – или сломать.",
    uk: "30 січня 1933 року. Гінденбург призначив Гітлера канцлером у кабінеті, де нацисти в меншості, а Папен сподівається ними керувати. Шість мільйонів німців без роботи, Рузвельт чекає інавгурації, поки американські банки падають, в Україні та Казахстані голод. Японія готує захоплення Жехе й вихід із Ліги Націй, Болівія і Парагвай воюють у Чако, Чан Кайші оточує радянський Цзянсі. Мир ще можна втримати – або зламати.",
    en: "30 January 1933. Hindenburg has made Hitler Chancellor of a cabinet in which the Nazis are a minority and Papen expects to steer them. Six million Germans are out of work, Roosevelt waits for his inauguration while American banks fail, and famine grips Ukraine and Kazakhstan. Japan prepares to take Jehol and to leave the League, Bolivia and Paraguay fight in the Chaco, and Chiang Kai-shek encircles the Jiangxi Soviet. The peace can still be kept – or broken.",
  },
  context: `Date: Monday 30 January 1933. At about 11:30 President Paul von Hindenburg appointed Adolf Hitler Reich Chancellor. The cabinet of "national concentration" has three Nazis – Hitler, Wilhelm Frick (Interior) and Hermann Göring (minister without portfolio and Prussian interior minister, with command of the Prussian police) – among conservatives: Vice-Chancellor Franz von Papen (also Reich Commissioner for Prussia), Alfred Hugenberg of the DNVP (economy and agriculture), Konstantin von Neurath (foreign affairs), Lutz Schwerin von Krosigk (finance) and General Werner von Blomberg (Reichswehr). The Reichstag elected in November 1932 has 196 Nazis, 52 DNVP, 121 Social Democrats and 100 Communists among 584 deputies: the cabinet has no majority, and Hitler wants new elections (set for 5 March). Kurt von Schleicher's cabinet resigned on 28 January after Hindenburg refused him a dissolution. In the evening the SA, the SS and the Stahlhelm march with torches through the Brandenburg Gate; the Communists call for a general strike, and the Social Democrats and trade unions wait.
${DEPRESSION_1933}
${POWERS_1933}
${WORLD_1933}
Real history for reference: the Reichstag burned on 27 February 1933 and the decree of the next day suspended civil liberties; the Nazis won 44% on 5 March; the Enabling Act passed on 23 March; the first concentration camp opened at Dachau on 22 March; the boycott of Jewish shops came on 1 April, the trade unions were abolished on 2 May and the other parties dissolved by July; Germany left the League and the Disarmament Conference on 14 October 1933. Japan took Jehol in February–March, the League adopted the Lytton Report on 24 February and Japan announced its withdrawal on 27 March; the Tanggu Truce of 31 May 1933 left a demilitarised zone south of the Great Wall. Roosevelt took office on 4 March 1933 amid a banking collapse and began the New Deal. The famine ended with the 1933 harvest; about 3.9 million died in Ukraine and 1.5 million in Kazakhstan. Germany and Poland signed a non-aggression pact in January 1934; Dollfuss suspended parliament in March 1933 and was murdered in a Nazi putsch in July 1934; the Night of the Long Knives (30 June 1934) destroyed the SA's leadership; Hindenburg died on 2 August 1934 and Hitler became Führer. The Soviet Union joined the League in September 1934; the Saar voted to return to Germany in January 1935; Germany announced conscription in March 1935; Italy invaded Ethiopia in October 1935; Germany remilitarised the Rhineland in March 1936; the Spanish Civil War began in July 1936; Japan's war on China began at the Marco Polo Bridge in July 1937; Stalin's Great Purge killed some 700,000 in 1937–38; Germany annexed Austria in March 1938 and the Sudetenland at Munich in September. None of this is fixed.`,
  aliases: scenario1939.aliases,
  // The 1938 map's colonial owners, as on 1 September 1939, with Albania and Czechoslovakia their own and Ethiopia free.
  owners: { ...Object.fromEntries(Object.entries(scenario1939.owners).filter(([hist]) => hist !== "czechoslovakia" && hist !== "albania")), "ethiopia-italy": "ethiopia" },
  modernOwners: {
    ...scenario1939.modernOwners,
    // Austria, the Sudeten lands and southern Slovakia, which the 1938 map gives to Germany and Hungary, as they were before 1938.
    AUT: "austria",
    CZE: "czechoslovakia",
    SVK: "czechoslovakia",
    LIE: "liechtenstein",
    MLT: "uk",
    // Taiwan was Japan's colony; the source draws a sliver of it with China. Imam Yahya's Yemen was its own kingdom, not Ibn Saud's.
    TWN: "japan",
    YEM: "yemen",
    // Macau, which the source draws with the warlords' China, was Portuguese.
    MAC: "portugal",
  },
  provinceOwners: {
    // The island corrections of 1939 that hold in 1933 too (the Riau Islands, Ceuta and Melilla, Madeira, the Aegean, the Pacific).
    ...Object.fromEntries(
      Object.entries(scenario1939.provinceOwners ?? {}).filter(
        ([id]) => !id.startsWith("sk-") && id !== "ua-zakarpattia" && id !== "lt-klaipeda" && !id.startsWith("cn-liaoning"),
      ),
    ),
    // Carpatho-Ukraine was Czechoslovak until March 1939, Memel Lithuanian since 1923.
    "ua-zakarpattia": "czechoslovakia",
    "ua-zakarpattia-p2": "czechoslovakia",
    "lt-klaipeda": "lithuania",
    // The Saar Basin is governed by a League of Nations commission until the plebiscite of January 1935.
    "de-saarland": "saar",
    // The Sanjak of Alexandretta belonged to French Syria until 1939.
    "tr-hatay": "france",
    ...Object.fromEntries(MANCHURIA.map((id) => [id, "manchukuo"])),
    ...Object.fromEntries(JEHOL.map((id) => [id, "china"])),
    // The Kwantung Leased Territory at Dairen and Port Arthur was Japan's own.
    "cn-liaoning-dalian": "japan",
    // Aden and its protectorates were British; the rest of Yemen the Imam's.
    ...Object.fromEntries(ADEN.map((id) => [id, "uk"])),
  },
  // Japan's troops at Shanhaiguan since 3 January; the Chinese Soviet Republic in Jiangxi and western Fujian, the Fourth Front Army in
  // northern Sichuan; the Bolivian forts of the western Chaco; Peru's irregulars at Leticia.
  provinceContested: {
    "cn-hebei-qinhuangdao": "japan",
    "cn-jiangxi-ganzhou": "chinese-soviet-republic",
    "cn-jiangxi-jiangxi-south": "chinese-soviet-republic",
    "cn-jiangxi-ji-an": "chinese-soviet-republic",
    "cn-jiangxi-jiangxi-south-west": "chinese-soviet-republic",
    "cn-jiangxi-linchuan": "chinese-soviet-republic",
    "cn-fujian-changting": "chinese-soviet-republic",
    "cn-fujian-fujian-west": "chinese-soviet-republic",
    "cn-fujian-longyan": "chinese-soviet-republic",
    "cn-sichuan-dazhou": "chinese-soviet-republic",
    "py-boqueron-general-eugenio-alejandrino-garay": "bolivia",
    "py-boqueron": "bolivia",
    "py-alto-paraguay-mayor-pablo-lagerenza": "bolivia",
    "co-amazonas": "peru",
  },
  provinceHeld: {
    "cn-hebei-qinhuangdao": 10,
    "cn-jiangxi-ganzhou": 60,
    "cn-jiangxi-jiangxi-south": 50,
    "cn-jiangxi-ji-an": 35,
    "cn-jiangxi-jiangxi-south-west": 25,
    "cn-jiangxi-linchuan": 20,
    "cn-fujian-changting": 70,
    "cn-fujian-fujian-west": 40,
    "cn-fujian-longyan": 30,
    "cn-sichuan-dazhou": 20,
    "py-boqueron-general-eugenio-alejandrino-garay": 60,
    "py-boqueron": 35,
    "py-alto-paraguay-mayor-pablo-lagerenza": 40,
    "co-amazonas": 40,
  },
  protests: [
    {
      title: L("Rallies of the left against Hitler", "Митинги левых против Гитлера", "Мітинги лівих проти Гітлера"),
      country: "germany",
      stage: "rally",
      size: 150,
      where: ["de-berlin", "de-hamburg", "de-saxony", "de-north-rhine-westphalia"],
      demands: L(
        "No Hitler government, a general strike, the defence of the Republic",
        "Нет правительству Гитлера, всеобщая забастовка, защита республики",
        "Ні уряду Гітлера, загальний страйк, захист республіки",
      ),
      by: L("The Communist Party (Ernst Thälmann); the Iron Front of the Social Democrats", "Компартия (Эрнст Тельман); «Железный фронт» социал-демократов", "Компартія (Ернст Тельман); «Залізний фронт» соціал-демократів"),
      support: 35,
      organisation: 55,
      killed: 0,
    },
    {
      title: L("Hunger marches and farm strikes", "Голодные марши и фермерские забастовки", "Голодні марші та фермерські страйки"),
      country: "usa",
      stage: "rally",
      size: 60,
      where: ["us-iowa", "us-nebraska", "us-michigan", "us-illinois", "us-new-york"],
      demands: L(
        "Relief for the unemployed, an end to farm foreclosures, prices that cover a farmer's costs",
        "Помощь безработным, конец распродаже ферм за долги, цены, покрывающие затраты фермера",
        "Допомога безробітним, кінець розпродажу ферм за борги, ціни, що покривають витрати фермера",
      ),
      by: L("The Farmers' Holiday Association; the Unemployed Councils", "Ассоциация фермерских каникул; советы безработных", "Асоціація фермерських канікул; ради безробітних"),
      support: 45,
      organisation: 35,
      killed: 0,
    },
    {
      title: L("Anarchist rising", "Анархистское восстание", "Анархістське повстання"),
      country: "spain",
      stage: "riot",
      size: 15,
      where: ["es-andalucia", "es-cataluna", "es-valenciana"],
      demands: L("Libertarian communism, land to those who work it", "Либертарный коммунизм, земля тем, кто её обрабатывает", "Лібертарний комунізм, земля тим, хто її обробляє"),
      by: L("The CNT and the FAI", "НКТ и ФАИ", "НКП і ФАІ"),
      support: 15,
      organisation: 40,
      killed: 80,
    },
  ],
  // The Reichswehr waits on Blomberg and Hindenburg; Göring has the Prussian police from today; the old elites think Hitler theirs.
  loyalty: {
    germany: { army: 55, police: 65, security: 50, elites: 60 },
    spain: { army: 40, police: 60, security: 55, elites: 35 },
  },
  // People in 1933 within today's borders: the 1938 map's, less the growth of five years.
  people: { byCountry: {}, others: 0.94 },
  countries: {
    germany: seed(L("Germany", "Германия", "Німеччина"), "#6f7277", "Chancellor Adolf Hitler; President Paul von Hindenburg; Vice-Chancellor Franz von Papen", L("Weimar Republic under presidential emergency rule", "Веймарская республика на чрезвычайных указах президента", "Веймарська республіка на надзвичайних указах президента"), { stability: 35, economy: 55, military: 30 }),
    ussr: seed(L("Soviet Union", "СССР", "СРСР"), "#a3292c", "General Secretary Joseph Stalin; Premier Vyacheslav Molotov", L("One-party communist state", "Однопартийное коммунистическое государство", "Однопартійна комуністична держава"), { stability: 50, economy: 40, military: 55 }),
    uk: seed(L("United Kingdom", "Великобритания", "Велика Британія"), "#d0666b", "King George V; PM Ramsay MacDonald", L("Constitutional monarchy and empire", "Конституционная монархия и империя", "Конституційна монархія та імперія"), { stability: 70, economy: 70, military: 50 }),
    france: seed(L("France", "Франция", "Франція"), "#4a72b8", "President Albert Lebrun; PM-designate Édouard Daladier", L("Third Republic and colonial empire", "Третья республика и колониальная империя", "Третя республіка та колоніальна імперія"), { stability: 50, economy: 60, military: 70 }),
    italy: seed(L("Italy", "Италия", "Італія"), "#5a9d55", "Duce Benito Mussolini; King Victor Emmanuel III", L("Fascist dictatorship", "Фашистская диктатура", "Фашистська диктатура"), { stability: 65, economy: 40, military: 45 }),
    japan: seed(L("Empire of Japan", "Японская империя", "Японська імперія"), "#e6d6a6", "Emperor Hirohito; PM Saitō Makoto", L("Constitutional monarchy under the army's sway", "Конституционная монархия под влиянием армии", "Конституційна монархія під впливом армії"), { stability: 55, economy: 45, military: 60 }),
    usa: seed(L("United States", "США", "США"), "#6680c2", "President Herbert Hoover; President-elect Franklin D. Roosevelt", L("Federal republic", "Федеративная республика", "Федеративна республіка"), { stability: 45, economy: 70, military: 25 }),
    china: seed(L("Republic of China", "Китайская Республика", "Китайська Республіка"), "#cf3d2e", "Generalissimo Chiang Kai-shek; Premier Wang Jingwei", L("Kuomintang one-party rule over warlord provinces", "Однопартийное правление Гоминьдана над провинциями милитаристов", "Однопартійне правління Гоміньдану над провінціями мілітаристів"), { stability: 25, economy: 20, military: 35 }),
    manchukuo: seed(L("Manchukuo", "Маньчжоу-го", "Маньчжоу-го"), "#c9b26a", "Chief Executive Aisin-Gioro Puyi; PM Zheng Xiaoxu", L("Puppet state of the Kwantung Army", "Марионеточное государство Квантунской армии", "Маріонеткова держава Квантунської армії"), { stability: 30, economy: 12, military: 10 }),
    "chinese-soviet-republic": {
      ...seed(L("Chinese Soviet Republic", "Китайская Советская Республика", "Китайська Радянська Республіка"), "#9e3b35", "Chairman Mao Zedong; Bo Gu", L("Communist soviet republic at war", "Советская коммунистическая республика в войне", "Радянська комуністична республіка у війні"), { stability: 55, economy: 2, military: 10 }),
      dormant: true,
    },
    saar: seed(L("Saar Territory", "Саар", "Саар"), "#8fa0b0", "Chairman of the Governing Commission Geoffrey Knox", L("Territory governed by the League of Nations", "Территория под управлением Лиги Наций", "Територія під управлінням Ліги Націй"), { stability: 60, economy: 5, military: 0 }),
    spain: seed(L("Spain", "Испания", "Іспанія"), "#d9ab45", "PM Manuel Azaña; President Niceto Alcalá-Zamora", L("Second Republic", "Вторая республика", "Друга республіка"), { stability: 35, economy: 25, military: 25 }),
    portugal: seed(L("Portugal", "Португалия", "Португалія"), "#4e8a5e", "PM António de Oliveira Salazar; President Óscar Carmona", L("Military dictatorship becoming the Estado Novo, and colonial empire", "Военная диктатура на пути к «Новому государству» и колониальная империя", "Військова диктатура на шляху до «Нової держави» та колоніальна імперія"), { stability: 60, economy: 12, military: 12 }),
    poland: seed(L("Poland", "Польша", "Польща"), "#d27b93", "Marshal Józef Piłsudski; President Ignacy Mościcki; PM Aleksander Prystor", L("Authoritarian republic (Sanation)", "Авторитарная республика (санация)", "Авторитарна республіка (санація)"), { stability: 60, economy: 30, military: 45 }),
    czechoslovakia: seed(L("Czechoslovakia", "Чехословакия", "Чехословаччина"), "#6d9bd0", "President Tomáš Garrigue Masaryk; PM Jan Malypetr; Foreign Minister Edvard Beneš", PARLIAMENTARY, { stability: 65, economy: 40, military: 35 }),
    austria: seed(L("Austria", "Австрия", "Австрія"), "#c96f6f", "Chancellor Engelbert Dollfuss; President Wilhelm Miklas", L("Federal republic on the brink of dictatorship", "Федеративная республика на пороге диктатуры", "Федеративна республіка на порозі диктатури"), { stability: 35, economy: 20, military: 8 }),
    hungary: seed(L("Hungary", "Венгрия", "Угорщина"), "#9fb06a", "Regent Miklós Horthy; PM Gyula Gömbös", L("Regency", "Регентство", "Регентство"), { stability: 55, economy: 22, military: 15 }),
    romania: seed(L("Romania", "Румыния", "Румунія"), "#d8bd46", "King Carol II; PM Alexandru Vaida-Voevod", MONARCHY, { stability: 40, economy: 25, military: 30 }),
    yugoslavia: seed(L("Yugoslavia", "Югославия", "Югославія"), "#8873b3", "King Alexander I; PM Milan Srškić", L("Royal dictatorship", "Королевская диктатура", "Королівська диктатура"), { stability: 40, economy: 20, military: 30 }),
    bulgaria: seed(L("Bulgaria", "Болгария", "Болгарія"), "#6c9a50", "Tsar Boris III; PM Nikola Mushanov", MONARCHY, { stability: 40, economy: 12, military: 10 }),
    greece: seed(L("Greece", "Греция", "Греція"), "#79a9d4", "PM Eleftherios Venizelos; President Alexandros Zaimis", PARLIAMENTARY, { stability: 40, economy: 15, military: 18 }),
    albania: seed(L("Albania", "Албания", "Албанія"), "#a4453f", "King Zog I", L("Kingdom under Italian patronage", "Королевство под покровительством Италии", "Королівство під протекторатом Італії"), { stability: 50, economy: 3, military: 4 }),
    turkey: seed(L("Turkey", "Турция", "Туреччина"), "#4f9a8c", "President Mustafa Kemal Atatürk; PM İsmet İnönü", L("One-party republic", "Однопартийная республика", "Однопартійна республіка"), { stability: 70, economy: 18, military: 30 }),
    finland: seed(L("Finland", "Финляндия", "Фінляндія"), "#e3dfd0", "President Pehr Evind Svinhufvud; PM Toivo Mikael Kivimäki", PARLIAMENTARY, { stability: 65, economy: 20, military: 15 }),
    estonia: seed(L("Estonia", "Эстония", "Естонія"), "#5b7fa6", "State Elder Konstantin Päts", PARLIAMENTARY, { stability: 50, economy: 8, military: 5 }),
    latvia: seed(L("Latvia", "Латвия", "Латвія"), "#9a4a4f", "President Alberts Kviesis; PM Marģers Skujenieks", PARLIAMENTARY, { stability: 50, economy: 9, military: 5 }),
    lithuania: seed(L("Lithuania", "Литва", "Литва"), "#c2c34f", "President Antanas Smetona; PM Juozas Tūbelis", L("Authoritarian republic", "Авторитарная республика", "Авторитарна республіка"), { stability: 55, economy: 8, military: 6 }),
    netherlands: seed(L("Netherlands", "Нидерланды", "Нідерланди"), "#e38b3f", "Queen Wilhelmina; PM Charles Ruijs de Beerenbrouck", L("Constitutional monarchy and colonial empire", "Конституционная монархия и колониальная империя", "Конституційна монархія та колоніальна імперія"), { stability: 70, economy: 45, military: 15 }),
    belgium: seed(L("Belgium", "Бельгия", "Бельгія"), "#e0c855", "King Albert I; PM Charles de Broqueville", MONARCHY, { stability: 60, economy: 40, military: 18 }),
    sweden: seed(L("Sweden", "Швеция", "Швеція"), "#5a97c9", "King Gustaf V; PM Per Albin Hansson", MONARCHY, { stability: 70, economy: 35, military: 12 }),
    norway: seed(L("Norway", "Норвегия", "Норвегія"), "#c96f62", "King Haakon VII; PM Jens Hundseid", MONARCHY, { stability: 60, economy: 15, military: 5 }),
    denmark: seed(L("Denmark", "Дания", "Данія"), "#c75b5b", "King Christian X; PM Thorvald Stauning", MONARCHY, { stability: 70, economy: 18, military: 4 }),
    switzerland: seed(L("Switzerland", "Швейцария", "Швейцарія"), "#d94f4f", "President of the Confederation Edmund Schulthess", L("Neutral federal republic", "Нейтральная федеративная республика", "Нейтральна федеративна республіка"), { stability: 85, economy: 30, military: 10 }),
    ireland: seed(L("Irish Free State", "Ирландское Свободное государство", "Ірландська Вільна держава"), "#6aa36f", "President of the Executive Council Éamon de Valera", COMMONWEALTH_DOMINION, { stability: 55, economy: 8, military: 3 }),
    ethiopia: seed(L("Ethiopia", "Эфиопия", "Ефіопія"), "#7f9a4f", "Emperor Haile Selassie", L("Empire", "Империя", "Імперія"), { stability: 45, economy: 3, military: 8 }),
    egypt: seed(L("Egypt", "Египет", "Єгипет"), "#d6c27a", "King Fuad I; PM Ismail Sidqi", L("Kingdom under British tutelage", "Королевство под британской опекой", "Королівство під британською опікою"), { stability: 40, economy: 12, military: 5 }),
    iraq: seed(L("Iraq", "Ирак", "Ірак"), "#9a8f5f", "King Faisal I; PM Naji Shawkat", L("Kingdom allied to Britain", "Королевство в союзе с Британией", "Королівство в союзі з Британією"), { stability: 40, economy: 6, military: 5 }),
    iran: seed(L("Persia", "Персия", "Персія"), "#7fae86", "Reza Shah Pahlavi; PM Mehdi Qoli Hedayat", L("Monarchy ruled by the Shah", "Монархия под властью шаха", "Монархія під владою шаха"), { stability: 60, economy: 10, military: 12 }),
    "saudi-arabia": seed(L("Saudi Arabia", "Саудовская Аравия", "Саудівська Аравія"), "#6f9e5a", "King Abdulaziz ibn Saud", ABSOLUTE, { stability: 55, economy: 3, military: 6 }),
    yemen: seed(L("Yemen", "Йемен", "Ємен"), "#a8826a", "Imam Yahya Muhammad Hamid ed-Din", L("Imamate", "Имамат", "Імамат"), { stability: 55, economy: 2, military: 5 }),
    afghanistan: seed(L("Afghanistan", "Афганистан", "Афганістан"), "#a3876a", "King Mohammed Nadir Shah", L("Kingdom", "Королевство", "Королівство"), { stability: 45, economy: 3, military: 6 }),
    thailand: seed(L("Siam", "Сиам", "Сіам"), "#6a8fc9", "King Prajadhipok; PM Phraya Manopakorn Nitithada", L("Constitutional monarchy since the revolution of 1932", "Конституционная монархия после революции 1932 года", "Конституційна монархія після революції 1932 року"), { stability: 40, economy: 8, military: 8 }),
    mongolia: seed(L("Mongolian People's Republic", "Монгольская Народная Республика", "Монгольська Народна Республіка"), "#9a78b8", "PM Peljidiin Genden", L("Soviet satellite", "Советский сателлит", "Радянський сателіт"), { stability: 40, economy: 2, military: 5 }),
    "south-africa": seed(L("Union of South Africa", "Южно-Африканский Союз", "Південно-Африканський Союз"), "#c48a5a", "PM J. B. M. Hertzog", COMMONWEALTH_DOMINION, { stability: 50, economy: 25, military: 8 }),
    liberia: seed(L("Liberia", "Либерия", "Ліберія"), "#8f6a9a", "President Edwin Barclay", L("Republic ruled by the True Whig Party", "Республика под властью партии истинных вигов", "Республіка під владою партії справжніх вігів"), { stability: 40, economy: 1, military: 1 }),
    canada: seed(L("Canada", "Канада", "Канада"), "#c44f4f", "PM R. B. Bennett", COMMONWEALTH_DOMINION, { stability: 60, economy: 45, military: 8 }),
    australia: seed(L("Australia", "Австралия", "Австралія"), "#d88a5a", "PM Joseph Lyons", COMMONWEALTH_DOMINION, { stability: 65, economy: 35, military: 8 }),
    "new-zealand": seed(L("New Zealand", "Новая Зеландия", "Нова Зеландія"), "#4f8a8a", "PM George Forbes", COMMONWEALTH_DOMINION, { stability: 60, economy: 20, military: 3 }),
    mexico: seed(L("Mexico", "Мексика", "Мексика"), "#5f9e6a", "President Abelardo L. Rodríguez; Jefe Máximo Plutarco Elías Calles", L("One-party republic (the PNR) under the Jefe Máximo", "Однопартийная республика (НРП) под властью «верховного вождя»", "Однопартійна республіка (НРП) під владою «верховного вождя»"), { stability: 55, economy: 15, military: 10 }),
    brazil: seed(L("Brazil", "Бразилия", "Бразилія"), "#4f9a5f", "Provisional President Getúlio Vargas", L("Provisional government after the revolution of 1930", "Временное правительство после революции 1930 года", "Тимчасовий уряд після революції 1930 року"), { stability: 45, economy: 20, military: 12 }),
    argentina: seed(L("Argentina", "Аргентина", "Аргентина"), "#8fbfe0", "President Agustín P. Justo", L("Conservative republic of the Concordancia", "Консервативная республика «Конкорданса»", "Консервативна республіка «Конкордансу»"), { stability: 50, economy: 25, military: 12 }),
    chile: seed(L("Chile", "Чили", "Чилі"), "#b04a5a", "President Arturo Alessandri", PRESIDENTIAL, { stability: 45, economy: 10, military: 8 }),
    cuba: seed(L("Cuba", "Куба", "Куба"), "#5a7fbf", "President Gerardo Machado", DICTATORSHIP, { stability: 20, economy: 6, military: 4 }),
    bolivia: seed(L("Bolivia", "Боливия", "Болівія"), "#a3a35a", "President Daniel Salamanca", L("Republic at war", "Республика в войне", "Республіка у війні"), { stability: 35, economy: 4, military: 10 }),
    paraguay: seed(L("Paraguay", "Парагвай", "Парагвай"), "#5a8fb0", "President Eusebio Ayala", L("Republic at war", "Республика в войне", "Республіка у війні"), { stability: 55, economy: 2, military: 9 }),
    colombia: seed(L("Colombia", "Колумбия", "Колумбія"), "#d6b84a", "President Enrique Olaya Herrera", PRESIDENTIAL, { stability: 55, economy: 8, military: 5 }),
    peru: seed(L("Peru", "Перу", "Перу"), "#c45a4a", "President Luis Miguel Sánchez Cerro", L("Authoritarian presidential republic", "Авторитарная президентская республика", "Авторитарна президентська республіка"), { stability: 30, economy: 7, military: 7 }),
    venezuela: seed(L("Venezuela", "Венесуэла", "Венесуела"), "#c9a65a", "General Juan Vicente Gómez", DICTATORSHIP, { stability: 60, economy: 8, military: 5 }),
    uruguay: seed(L("Uruguay", "Уругвай", "Уругвай"), "#7fb0d6", "President Gabriel Terra", PRESIDENTIAL, { stability: 45, economy: 6, military: 3 }),
  },
  wars: [
    {
      id: "manchurian-conflict",
      name: L("Sino-Japanese conflict over Manchuria", "Японо-китайский конфликт в Маньчжурии", "Японсько-китайський конфлікт у Маньчжурії"),
      attackers: ["japan", "manchukuo"],
      defenders: ["china"],
      since: "1931-09-18",
    },
    {
      id: "chinese-civil-war",
      name: L("Chinese Civil War (the encirclement campaigns)", "Гражданская война в Китае (походы на окружение)", "Громадянська війна в Китаї (походи на оточення)"),
      attackers: ["chinese-soviet-republic"],
      defenders: ["china"],
      since: "1927-08-01",
      civil: { of: "china", rebels: "chinese-soviet-republic", how: "rising", legitimacy: { government: 60, rebels: 25 } },
    },
    {
      id: "chaco-war",
      name: L("Chaco War", "Чакская война", "Чакська війна"),
      attackers: ["bolivia"],
      defenders: ["paraguay"],
      since: "1932-06-15",
    },
    {
      id: "leticia-war",
      name: L("Colombia–Peru War", "Колумбийско-перуанская война", "Колумбійсько-перуанська війна"),
      attackers: ["peru"],
      defenders: ["colombia"],
      since: "1932-09-01",
    },
  ],
  alliances: withTreaties(
    [
      {
        id: "league-of-nations",
        kind: "organization",
        name: L("League of Nations", "Лига Наций", "Ліга Націй"),
        // Members on 30 January 1933: Germany, Japan and Italy still in; the United States, the Soviet Union, Brazil, Egypt and Saudi Arabia out.
        members: [
          "uk", "france", "germany", "italy", "japan", "china", "poland", "czechoslovakia", "austria", "hungary", "romania", "yugoslavia", "bulgaria",
          "greece", "albania", "turkey", "finland", "estonia", "latvia", "lithuania", "netherlands", "belgium", "luxembourg", "sweden", "norway",
          "denmark", "switzerland", "ireland", "spain", "portugal", "iraq", "iran", "thailand", "ethiopia", "liberia", "south-africa", "canada",
          "australia", "new-zealand", "mexico", "argentina", "chile", "bolivia", "paraguay", "colombia", "peru", "venezuela", "uruguay", "cuba",
          "panama", "guatemala", "honduras", "nicaragua", "el-salvador", "haiti", "dominican-republic",
        ],
        since: "1920-01-10",
      },
      {
        id: "commonwealth",
        kind: "organization",
        name: L("British Commonwealth", "Британское Содружество", "Британська Співдружність"),
        members: ["uk", "canada", "australia", "new-zealand", "south-africa", "ireland"],
        since: "1931-12-11",
      },
    ],
    TERMS_1933,
    TREATIES_1933,
  ),
  featured: ["germany", "ussr", "usa", "uk", "france", "italy", "japan", "china", "poland", "austria"],
  // A week before: Schleicher's cabinet falling, Papen and Oskar von Hindenburg bargaining with Hitler at Ribbentrop's villa.
  variants: {
    eve: {
      startDate: "1933-01-23",
      defaultStep: "week",
      tagline: {
        ru: "Кабинет Шлейхера рушится, а на вилле в Далеме Папен и сын президента торгуются с Гитлером.",
        uk: "Кабінет Шлейхера валиться, а на віллі в Далемі Папен і син президента торгуються з Гітлером.",
        en: "Schleicher's cabinet is falling, and in a villa in Dahlem Papen and the President's son are bargaining with Hitler.",
      },
      story: {
        ru: "23 января 1933 года канцлер Курт фон Шлейхер просит президента Гинденбурга распустить рейхстаг и отложить выборы, чтобы править указами. Генерал, сменивший Папена в декабре, хотел расколоть нацистов и опереться на профсоюзы, но не сумел ни того, ни другого. Старый президент колеблется: нарушить конституцию ради Шлейхера он не хочет, а помещики и промышленники уже требуют его отставки.\n\nНакануне вечером на вилле Иоахима фон Риббентропа в берлинском Далеме Франц фон Папен и Оскар фон Гинденбург, сын и адъютант президента, тайно встретились с Гитлером. Нацисты только что выиграли выборы в маленьком Липпе и снова выглядят победителями, хотя в ноябре потеряли два миллиона голосов и залезли в долги. Гитлер требует для себя поста канцлера; Папен готов стать при нём вице-канцлером и верит, что консерваторы в кабинете будут держать его в руках.\n\nТем временем Германия голодает без работы, коммунисты собирают на Бюловплац десятки тысяч, а за её пределами мир занят своими бедами. Америка ждёт Рузвельта, пока её банки снова шатаются; Япония стягивает войска к Жэхэ; в Женеве спорят о разоружении. Через неделю у Германии может быть канцлер Гитлер, военная диктатура Шлейхера или ещё одни выборы.",
        uk: "23 січня 1933 року канцлер Курт фон Шлейхер просить президента Гінденбурга розпустити рейхстаг і відкласти вибори, щоб правити указами. Генерал, який змінив Папена в грудні, хотів розколоти нацистів і спертися на профспілки, але не зумів ні того, ні іншого. Старий президент вагається: порушувати конституцію заради Шлейхера він не хоче, а поміщики й промисловці вже вимагають його відставки.\n\nНапередодні ввечері на віллі Йоахіма фон Ріббентропа в берлінському Далемі Франц фон Папен і Оскар фон Гінденбург, син і ад'ютант президента, таємно зустрілися з Гітлером. Нацисти щойно виграли вибори в маленькому Ліппе і знову здаються переможцями, хоча в листопаді втратили два мільйони голосів і влізли в борги. Гітлер вимагає для себе посади канцлера; Папен готовий стати при ньому віцеканцлером і вірить, що консерватори в кабінеті триматимуть його в руках.\n\nТим часом Німеччина голодує без роботи, комуністи збирають на Бюловплац десятки тисяч, а за її межами світ зайнятий своїми бідами. Америка чекає на Рузвельта, поки її банки знову хитаються; Японія стягує війська до Жехе; у Женеві сперечаються про роззброєння. За тиждень Німеччина може мати канцлера Гітлера, військову диктатуру Шлейхера або ще одні вибори.",
        en: "On 23 January 1933 Chancellor Kurt von Schleicher asks President Hindenburg to dissolve the Reichstag and put off new elections so that he can govern by decree. The general who replaced Papen in December meant to split the Nazis and win over the trade unions, and has done neither. The old President hesitates: he will not break the constitution for Schleicher, and the landowners and industrialists already want him gone.\n\nThe night before, in Joachim von Ribbentrop's villa in the Berlin suburb of Dahlem, Franz von Papen and Oskar von Hindenburg, the President's son and aide, met Hitler in secret. The Nazis have just won the election in little Lippe and look like winners again, though they lost two million votes in November and are deep in debt. Hitler demands the chancellorship for himself; Papen is ready to serve under him as Vice-Chancellor and believes the conservatives in the cabinet will keep him in hand.\n\nMeanwhile Germany goes hungry without work, the Communists fill the Bülowplatz with tens of thousands, and beyond its borders the world has troubles of its own. America waits for Roosevelt while its banks totter again; Japan gathers troops on the edge of Jehol; Geneva argues about disarmament. In a week Germany may have Chancellor Hitler, Schleicher's military dictatorship, or yet another election.",
      },
      briefing: {
        ru: "23 января 1933 года. Канцлер Шлейхер просит Гинденбурга о роспуске рейхстага и праве править без выборов, а Папен и сын президента вчера тайно договаривались с Гитлером на вилле Риббентропа. Шесть миллионов немцев без работы, коммунисты выходят на улицы, Америка ждёт Рузвельта, Япония готовит удар по Жэхэ. За неделю до 30 января: Гитлер у власти ещё не решён – его можно остановить или впустить.",
        uk: "23 січня 1933 року. Канцлер Шлейхер просить Гінденбурга розпустити рейхстаг і дозволити правити без виборів, а Папен і син президента вчора таємно домовлялися з Гітлером на віллі Ріббентропа. Шість мільйонів німців без роботи, комуністи виходять на вулиці, Америка чекає Рузвельта, Японія готує удар по Жехе. За тиждень до 30 січня: Гітлер при владі ще не вирішений – його можна зупинити або впустити.",
        en: "23 January 1933. Chancellor Schleicher asks Hindenburg to dissolve the Reichstag and let him govern without elections, while Papen and the President's son bargained with Hitler in secret last night at Ribbentrop's villa. Six million Germans are out of work, the Communists march, America waits for Roosevelt and Japan prepares to strike at Jehol. A week before 30 January, Hitler in power is not yet decided – he can be stopped, or let in.",
      },
      context: `Date: Monday 23 January 1933, a week before Hitler's appointment. Germany's Chancellor is General Kurt von Schleicher (since 3 December 1932), who failed to split the Nazis through Gregor Strasser (who resigned his party posts on 8 December) or to win the trade unions; today he asks Hindenburg for a dissolution of the Reichstag and the postponement of elections beyond the constitution's 60 days, a "state of emergency" the President is refusing. The Reichstag meets on 31 January and a vote of no confidence is certain. On the night of 22 January, at Joachim von Ribbentrop's villa in Dahlem, Franz von Papen and Oskar von Hindenburg met Hitler, Göring and Frick: Papen has given up the chancellorship for himself and will serve as Vice-Chancellor under Hitler; the Reichslandbund attacked Schleicher on 11 January, and the industrialists' contacts (Kurt von Schröder's house in Cologne, 4 January) are with Papen. The Nazis won 39.5% in the Lippe state election on 15 January after a vast campaign. On 22 January the SA marched on the Communists' headquarters at the Bülowplatz under police guard; on 25 January the Communists will answer with a march of 130,000. Alfred Hugenberg (DNVP) and the Stahlhelm are bargaining for posts.
${DEPRESSION_1933}
${POWERS_1933.replace("Joseph Paul-Boncour's fell on 28 January; Édouard Daladier is forming the next", "Joseph Paul-Boncour's, formed in December, depends on the Socialists' votes on the budget")}
${WORLD_1933.replace(" (Bolivia's attack under General Hans Kundt on the Paraguayan fort of Nanawa failed last week)", " (Bolivia's attack under General Hans Kundt on the Paraguayan fort of Nanawa is under way)")}
Real history for reference: Schleicher resigned on 28 January when Hindenburg refused him a dissolution; Hindenburg appointed Hitler Chancellor on 30 January with Papen as Vice-Chancellor and only three Nazis in the cabinet; the Reichstag fire came on 27 February, the elections of 5 March gave the Nazis 44%, and the Enabling Act passed on 23 March. Japan took Jehol in February–March and left the League on 27 March; Roosevelt took office on 4 March. None of this is fixed.`,
      leaders: {
        germany: "Chancellor Kurt von Schleicher; President Paul von Hindenburg",
        france: "President Albert Lebrun; PM Joseph Paul-Boncour",
      },
    },
  },
};

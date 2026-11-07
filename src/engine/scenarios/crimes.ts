import type { CrimeKind, Localized, RegimeKind } from "../types";

/**
 * History's own mass crimes, for the historical mode only (engine/repressions.ts):
 * each comes as a dated event with its toll, carried out by the government
 * that did it – as long as that government still stands, is governed as it
 * was (`regimes`), is led by the man who ordered it (`leader`) and holds at
 * least a fifth of the land where it fell. When the player rules that
 * government they see it coming and may stop it, or order a deportation or a
 * purge harsher; a minister of the security services is ordered to carry it
 * out and may refuse. The free mode never reads this table.
 *
 * Each date's twenty years were checked: 1914 holds the Armenian Genocide,
 * dekulakisation, the Kazakh famine and the Holodomor; 1933 the end of the
 * famines, the Night of the Long Knives, the Great Purge, Kristallnacht and
 * the wartime crimes after; 1939 the wartime and post-war Soviet
 * deportations, Katyn, Aktion T4 and the Holocaust, and China's campaigns
 * from 1950; 1950 and 1957 the Leningrad affair and Operation North, China's
 * campaigns, the Great Famine and the Cultural Revolution, Indonesia 1965–66,
 * and from 1957 Cambodia and the juntas of Chile and Argentina; 1964 East
 * Pakistan 1971 besides; 1973 and 1979 Chile, Argentina, Cambodia, the Red
 * Terror, East Timor, Hama and the Anfal; 1991 and 1999 Rwanda, Kosovo and
 * Darfur; 1999 and 2014 the Rohingya and Xinjiang; 2022 the deportation of
 * children from occupied Ukraine.
 *
 * Tolls are thousands: deaths (`toll`), people deported (`moved`) or held
 * (`held`, a purge's arrests), at a middle estimate where historians differ;
 * the sources are noted by each. Names and victims in the three languages;
 * the lines the engine writes are dry, and nothing here is graphic.
 */
export interface HistoricCrime {
  id: string;
  /** The government that did it: the first of these tags the game has. */
  by: string[];
  kind: CrimeKind;
  /** The first and the last day. */
  from: string;
  to: string;
  toll: number;
  moved?: number;
  held?: number;
  /**
   * Where it fell: modern countries (a list, or each with its share of the toll), English province names, or the
   * owner the era's map gives the land (`hist`); a province must be held by the perpetrator to count.
   */
  where: { adm0?: string[] | Record<string, number>; names?: RegExp; hist?: string[] };
  /** Where the deported were sent, by modern country; `abroad`: driven out of the country. */
  into?: string[];
  abroad?: boolean;
  /** Only while its government is governed so, and led by this man. */
  regimes?: RegimeKind[];
  leader?: RegExp;
  name: Localized;
  who: Localized;
  /** How an order names it, in the three languages: to stop it, or to make it harsher. */
  match: RegExp;
}

const STALIN = /stalin|сталин|сталін|джугашвили|джугашвілі/i;
const MAO = /mao|мао/i;
const HITLER = /hitler|гитлер|гітлер/i;
const SOVIET = ["ussr", "russia"];

export const HISTORIC_CRIMES: HistoricCrime[] = [
  // 1914 ————————————————————————————————————————————————————————————————
  {
    // Deportation marches and massacres, April 1915 – 1916: estimates from 0.6 to 1.5 million dead.
    id: "armenian-genocide",
    by: ["ottoman"],
    kind: "deportation",
    from: "1915-04-24",
    to: "1916-12-31",
    toll: 1000,
    moved: 1100,
    where: { names: /^(Erzurum|Van|Bitlis|Muş|Diyarbakır|Elazığ|Sivas|Trabzon|Malatya|Erzincan|Bayburt|Gümüşhane|Kayseri|Adana|Kahramanmaraş|Tokat|Amasya|Siirt|Batman|Bingöl|Tunceli|Ağrı|Hakkâri|Mardin|Adıyaman|Gaziantep)$/ },
    into: ["SYR"],
    name: { en: "The Armenian Genocide", ru: "Геноцид армян", uk: "Геноцид вірмен" },
    who: { en: "the Armenians of Anatolia", ru: "армяне Анатолии", uk: "вірмени Анатолії" },
    match: /armenian|армян|вірмен/i,
  },
  {
    // "Special settlers": about 1.8 million deported in 1930–31; about 390 thousand died by 1933 (Zemskov; Viola).
    id: "dekulakisation",
    by: SOVIET,
    kind: "deportation",
    from: "1930-02-01",
    to: "1931-12-31",
    toll: 390,
    moved: 1800,
    where: { adm0: ["UKR", "RUS", "BLR", "KAZ"] },
    into: ["RUS", "KAZ"],
    regimes: ["party"],
    name: { en: "Dekulakisation", ru: "Раскулачивание", uk: "Розкуркулення" },
    who: { en: "peasants branded as kulaks", ru: "крестьяне, объявленные кулаками", uk: "селяни, оголошені куркулями" },
    match: /kulak|кулак|кулач|куркул/i,
  },
  {
    // Asharshylyk: about 1.5 million dead, close to two-fifths of the Kazakhs (Pianciola; Cameron).
    id: "kazakh-famine",
    by: SOVIET,
    kind: "famine",
    from: "1930-09-01",
    to: "1933-06-30",
    toll: 1500,
    where: { adm0: ["KAZ"] },
    regimes: ["party"],
    name: { en: "The famine in Kazakhstan", ru: "Голод в Казахстане", uk: "Голод у Казахстані" },
    who: { en: "the Kazakhs", ru: "казахи", uk: "казахи" },
    match: /kazakh|казах|asharshyl|ашаршил/i,
  },
  {
    // About 3.9 million excess deaths in Ukraine, 1932–33 (Rudnytskyi et al., 2015).
    id: "holodomor",
    by: SOVIET,
    kind: "famine",
    from: "1932-07-01",
    to: "1933-11-30",
    toll: 3900,
    where: { adm0: ["UKR"] },
    regimes: ["party"],
    name: { en: "The Holodomor", ru: "Голодомор", uk: "Голодомор" },
    who: { en: "the peasants of Ukraine", ru: "крестьяне Украины", uk: "селяни України" },
    match: /holodomor|голодомор/i,
  },
  // 1933 ————————————————————————————————————————————————————————————————
  {
    // 30 June – 2 July 1934: at least 85 killed, probably near 200; about a thousand arrested (Evans).
    id: "night-of-the-long-knives",
    by: ["germany"],
    kind: "purge",
    from: "1934-06-30",
    to: "1934-07-02",
    toll: 0.15,
    held: 1,
    where: { adm0: ["DEU"] },
    regimes: ["autocracy", "party", "limited"],
    leader: HITLER,
    name: { en: "The Night of the Long Knives", ru: "Ночь длинных ножей", uk: "Ніч довгих ножів" },
    who: { en: "the SA's leaders and the regime's old enemies", ru: "руководители СА и старые враги режима", uk: "керівники СА та старі вороги режиму" },
    match: /long knives|длинных ножей|довгих ножів|röhm|rohm|рём|рьом/i,
  },
  {
    // August 1936 – November 1938: 681,692 shot by the NKVD's own count, about 1.5 million arrested (the Pavlov report, 1953).
    id: "great-purge",
    by: SOVIET,
    kind: "purge",
    from: "1936-08-19",
    to: "1938-11-17",
    toll: 680,
    held: 1500,
    where: { adm0: { RUS: 445, UKR: 120, BLR: 30, KAZ: 25, GEO: 15, ARM: 5, AZE: 10, UZB: 15, TKM: 5, TJK: 5, KGZ: 5 } },
    regimes: ["party"],
    leader: STALIN,
    name: { en: "The Great Purge", ru: "Большой террор", uk: "Великий терор" },
    who: { en: "party members, officers, the intelligentsia, peasants and the 'national contingents'", ru: "члены партии, командиры, интеллигенция, крестьяне и «национальные контингенты»", uk: "члени партії, командири, інтелігенція, селяни та «національні контингенти»" },
    match: /great purge|great terror|yezhov|ezhov|большо\S* террор|ежовщин|велик\S* терор|єжовщин/i,
  },
  {
    // 9–10 November 1938: 91 murdered that night, some 30,000 Jewish men sent to the camps (Gilbert).
    id: "kristallnacht",
    by: ["germany"],
    kind: "purge",
    from: "1938-11-09",
    to: "1938-11-10",
    toll: 0.1,
    held: 30,
    where: { adm0: ["DEU", "AUT"] },
    regimes: ["autocracy", "party"],
    leader: HITLER,
    name: { en: "Kristallnacht", ru: "Хрустальная ночь", uk: "Кришталева ніч" },
    who: { en: "the Jews of Germany and Austria", ru: "евреи Германии и Австрии", uk: "євреї Німеччини та Австрії" },
    match: /kristallnacht|crystal night|хрустальн\S* ноч|кришталев\S* ніч/i,
  },
  // 1939 ————————————————————————————————————————————————————————————————
  {
    // The T4 programme's own count: 70,273 killed by August 1941.
    id: "aktion-t4",
    by: ["germany"],
    kind: "massacre",
    from: "1939-09-01",
    to: "1941-08-24",
    toll: 70,
    where: { adm0: ["DEU", "AUT"] },
    regimes: ["autocracy", "party"],
    leader: HITLER,
    name: { en: "Aktion T4", ru: "Программа T4", uk: "Програма T4" },
    who: { en: "people with disabilities", ru: "люди с инвалидностью", uk: "люди з інвалідністю" },
    match: /\bt-?4\b|т-?4|euthanas|эвтаназ|евтаназ/i,
  },
  {
    // About 5.7 million Jews murdered, by the country they lived in (Hilberg; Benz); the part of a land the Reich never held does not happen.
    id: "holocaust",
    by: ["germany"],
    kind: "massacre",
    from: "1941-06-22",
    to: "1945-05-08",
    toll: 5700,
    where: { adm0: { POL: 3000, UKR: 900, BLR: 250, RUS: 100, LTU: 140, LVA: 70, HUN: 560, ROU: 270, CZE: 150, SVK: 100, DEU: 160, AUT: 65, NLD: 100, FRA: 75, GRC: 60, SRB: 30, HRV: 30, BEL: 25, ITA: 8 } },
    regimes: ["autocracy", "party"],
    leader: HITLER,
    name: { en: "The Holocaust", ru: "Холокост", uk: "Голокост" },
    who: { en: "the Jews of Europe", ru: "евреи Европы", uk: "євреї Європи" },
    match: /holocaust|shoah|холокост|голокост|final solution|окончательн\S* решени|остаточн\S* розв/i,
  },
  {
    // 21,857 Polish prisoners shot in April–May 1940 (the Shelepin note, 1959).
    id: "katyn",
    by: ["ussr"],
    kind: "massacre",
    from: "1940-04-03",
    to: "1940-05-19",
    toll: 22,
    where: { names: /^(Smolensk|Kharkiv|Tver)$/ },
    regimes: ["party"],
    leader: STALIN,
    name: { en: "The Katyn massacre", ru: "Катынский расстрел", uk: "Катинський розстріл" },
    who: { en: "Polish officers and officials held prisoner", ru: "польские офицеры и чиновники в плену", uk: "польські офіцери та урядовці в полоні" },
    match: /katyn|катын|катин/i,
  },
  {
    // Four deportations from the annexed east of Poland, February 1940 – June 1941: about 320 thousand by the NKVD's count.
    id: "eastern-poland",
    by: ["ussr"],
    kind: "deportation",
    from: "1940-02-10",
    to: "1941-06-20",
    toll: 30,
    moved: 320,
    where: { hist: ["poland"] },
    into: ["KAZ", "RUS"],
    regimes: ["party"],
    leader: STALIN,
    name: { en: "The deportations from eastern Poland", ru: "Депортации из восточной Польши", uk: "Депортації зі східної Польщі" },
    who: { en: "Polish citizens of the annexed east", ru: "польские граждане присоединённых земель", uk: "польські громадяни приєднаних земель" },
    match: /eastern poland|восточн\S* польш|східн\S* польщ/i,
  },
  {
    // 14 June 1941: about 40 thousand from Estonia, Latvia and Lithuania; many of the men died in the camps.
    id: "june-deportation",
    by: ["ussr"],
    kind: "deportation",
    from: "1941-06-14",
    to: "1941-06-17",
    toll: 13,
    moved: 40,
    where: { adm0: ["EST", "LVA", "LTU"] },
    into: ["RUS"],
    regimes: ["party"],
    leader: STALIN,
    name: { en: "The June deportation", ru: "Июньская депортация", uk: "Червнева депортація" },
    who: { en: "Estonians, Latvians and Lithuanians", ru: "эстонцы, латыши и литовцы", uk: "естонці, латиші та литовці" },
    match: /june deportation|июньск\S* депорт|червнев\S* депорт/i,
  },
  {
    // The Volga German republic deported in September 1941: about 440 thousand.
    id: "volga-germans",
    by: ["ussr"],
    kind: "deportation",
    from: "1941-09-03",
    to: "1941-09-20",
    toll: 60,
    moved: 440,
    where: { names: /^(Saratov|Volgograd)$/ },
    into: ["KAZ", "RUS"],
    regimes: ["party"],
    leader: STALIN,
    name: { en: "The deportation of the Volga Germans", ru: "Депортация поволжских немцев", uk: "Депортація поволзьких німців" },
    who: { en: "the Volga Germans", ru: "поволжские немцы", uk: "поволзькі німці" },
    match: /volga german|поволжск\S* немц|немц\S* поволж|поволзьк\S* німц|німц\S* поволж/i,
  },
  {
    id: "karachays",
    by: ["ussr"],
    kind: "deportation",
    from: "1943-11-02",
    to: "1943-11-02",
    toll: 13,
    moved: 69,
    where: { names: /Karachay/ },
    into: ["KAZ", "KGZ"],
    regimes: ["party"],
    leader: STALIN,
    name: { en: "The deportation of the Karachays", ru: "Депортация карачаевцев", uk: "Депортація карачаївців" },
    who: { en: "the Karachays", ru: "карачаевцы", uk: "карачаївці" },
    match: /karachay|карача/i,
  },
  {
    id: "kalmyks",
    by: ["ussr"],
    kind: "deportation",
    from: "1943-12-28",
    to: "1943-12-31",
    toll: 16,
    moved: 93,
    where: { names: /Kalmyk/ },
    into: ["RUS"],
    regimes: ["party"],
    leader: STALIN,
    name: { en: "Operation Ulusy", ru: "Операция «Улусы»", uk: "Операція «Улуси»" },
    who: { en: "the Kalmyks", ru: "калмыки", uk: "калмики" },
    match: /kalmyk|калмык|калмик|ulusy|улус/i,
  },
  {
    // 23 February 1944: about 496 thousand deported; about a quarter died by 1948 (NKVD special settlement records).
    id: "chechens-ingush",
    by: ["ussr"],
    kind: "deportation",
    from: "1944-02-23",
    to: "1944-03-01",
    toll: 100,
    moved: 496,
    where: { names: /Chechen|Ingush/ },
    into: ["KAZ", "KGZ"],
    regimes: ["party"],
    leader: STALIN,
    name: { en: "Operation Lentil", ru: "Операция «Чечевица»", uk: "Операція «Сочевиця»" },
    who: { en: "the Chechens and Ingush", ru: "чеченцы и ингуши", uk: "чеченці та інгуші" },
    match: /chechen|ingush|чечен|ингуш|інгуш|lentil|чечевиц|сочевиц/i,
  },
  {
    id: "balkars",
    by: ["ussr"],
    kind: "deportation",
    from: "1944-03-08",
    to: "1944-03-09",
    toll: 8,
    moved: 37,
    where: { names: /Kabardino/ },
    into: ["KAZ", "KGZ"],
    regimes: ["party"],
    leader: STALIN,
    name: { en: "The deportation of the Balkars", ru: "Депортация балкарцев", uk: "Депортація балкарців" },
    who: { en: "the Balkars", ru: "балкарцы", uk: "балкарці" },
    match: /balkar|балкар/i,
  },
  {
    // 18–20 May 1944: about 191 thousand; NKVD records count some 18% dead within eighteen months, the Crimean Tatars' own counts far more.
    id: "crimean-tatars",
    by: ["ussr"],
    kind: "deportation",
    from: "1944-05-18",
    to: "1944-05-20",
    toll: 35,
    moved: 191,
    where: { names: /Crimea/ },
    into: ["UZB"],
    regimes: ["party"],
    leader: STALIN,
    name: { en: "Sürgünlik", ru: "Сюргюнлик", uk: "Сюргюнлік" },
    who: { en: "the Crimean Tatars", ru: "крымские татары", uk: "кримські татари" },
    match: /crimean tatar|крымск\S* татар|кримськ\S* татар|sürgün|surgun|сюргюн/i,
  },
  {
    id: "meskhetians",
    by: ["ussr"],
    kind: "deportation",
    from: "1944-11-15",
    to: "1944-11-17",
    toll: 15,
    moved: 92,
    where: { names: /Samtskhe|Adjara/ },
    into: ["UZB", "KAZ", "KGZ"],
    regimes: ["party"],
    leader: STALIN,
    name: { en: "The deportation of the Meskhetian Turks", ru: "Депортация турок-месхетинцев", uk: "Депортація турків-месхетинців" },
    who: { en: "the Meskhetian Turks", ru: "турки-месхетинцы", uk: "турки-месхетинці" },
    match: /meskhet|месхет/i,
  },
  {
    // 25–28 March 1949: about 90 thousand from the Baltic republics.
    id: "priboi",
    by: ["ussr"],
    kind: "deportation",
    from: "1949-03-25",
    to: "1949-03-28",
    toll: 5,
    moved: 90,
    where: { adm0: ["EST", "LVA", "LTU"] },
    into: ["RUS"],
    regimes: ["party"],
    leader: STALIN,
    name: { en: "Operation Priboi", ru: "Операция «Прибой»", uk: "Операція «Прибій»" },
    who: { en: "Estonians, Latvians and Lithuanians", ru: "эстонцы, латыши и литовцы", uk: "естонці, латиші та литовці" },
    match: /priboi|прибой|прибій/i,
  },
  // 1950 ————————————————————————————————————————————————————————————————
  {
    // The Leningrad affair's trial, 29 September – 1 October 1950: Voznesensky, Kuznetsov and four more shot; about two thousand repressed in all.
    id: "leningrad-affair",
    by: ["ussr"],
    kind: "purge",
    from: "1950-09-29",
    to: "1950-10-01",
    toll: 0.026,
    held: 2,
    where: { adm0: ["RUS"] },
    regimes: ["party"],
    leader: STALIN,
    name: { en: "The Leningrad affair", ru: "Ленинградское дело", uk: "Ленінградська справа" },
    who: { en: "Leningrad's party leaders", ru: "руководители ленинградской парторганизации", uk: "керівники ленінградської парторганізації" },
    match: /leningrad affair|ленинградск\S* дел|ленінградськ\S* справ/i,
  },
  {
    // 1–2 April 1951: about 8,600 Jehovah's Witnesses sent to Siberia.
    id: "operation-north",
    by: ["ussr"],
    kind: "deportation",
    from: "1951-04-01",
    to: "1951-04-02",
    toll: 0.3,
    moved: 8.6,
    where: { adm0: ["UKR", "MDA", "BLR", "LTU", "LVA", "EST"] },
    into: ["RUS"],
    regimes: ["party"],
    leader: STALIN,
    name: { en: "Operation North", ru: "Операция «Север»", uk: "Операція «Північ»" },
    who: { en: "Jehovah's Witnesses", ru: "свидетели Иеговы", uk: "свідки Єгови" },
    match: /operation north|операци\S* .?север|операці\S* .?північ|jehovah|иегов|єгов/i,
  },
  {
    // Mao's own figures (1957): 712 thousand executed, 1.29 million imprisoned.
    id: "counterrevolutionaries",
    by: ["china"],
    kind: "purge",
    from: "1950-10-10",
    to: "1951-10-31",
    toll: 712,
    held: 1290,
    where: { adm0: ["CHN"] },
    regimes: ["party"],
    name: { en: "The Campaign to Suppress Counterrevolutionaries", ru: "Кампания по подавлению контрреволюционеров", uk: "Кампанія з придушення контрреволюціонерів" },
    who: { en: "former officials, landlords, believers and others called counter-revolutionaries", ru: "бывшие чиновники, помещики, верующие и прочие «контрреволюционеры»", uk: "колишні урядовці, поміщики, вірні та інші «контрреволюціонери»" },
    match: /counter-?revolutionar|контрреволюц/i,
  },
  {
    // The land reform's killings, 1950–52: estimates from one to two million landlords and their families.
    id: "land-reform",
    by: ["china"],
    kind: "massacre",
    from: "1950-06-30",
    to: "1952-12-31",
    toll: 1000,
    where: { adm0: ["CHN"] },
    regimes: ["party"],
    name: { en: "The land reform", ru: "Земельная реформа", uk: "Земельна реформа" },
    who: { en: "landlords and their families", ru: "помещики и их семьи", uk: "поміщики та їхні родини" },
    match: /land reform|земельн\S* реформ|аграрн\S* реформ/i,
  },
  {
    // The Great Leap Forward's famine, 1959–61: estimates from 15 to 45 million; 30 million is the figure most cited.
    id: "great-leap-famine",
    by: ["china"],
    kind: "famine",
    from: "1959-01-01",
    to: "1961-12-31",
    toll: 30000,
    where: { adm0: ["CHN"] },
    regimes: ["party"],
    leader: MAO,
    name: { en: "The Great Chinese Famine", ru: "Великий китайский голод", uk: "Великий китайський голод" },
    who: { en: "the peasants of China", ru: "крестьяне Китая", uk: "селяни Китаю" },
    match: /great leap|great chinese famine|большо\S* скач|великого стрибка|великий стрибок|китайск\S* голод|китайськ\S* голод/i,
  },
  {
    // 1966–76: deaths estimated from half a million to two million, many millions persecuted.
    id: "cultural-revolution",
    by: ["china"],
    kind: "purge",
    from: "1966-05-16",
    to: "1976-10-06",
    toll: 1500,
    held: 3000,
    where: { adm0: ["CHN"] },
    regimes: ["party"],
    leader: MAO,
    name: { en: "The Cultural Revolution", ru: "Культурная революция", uk: "Культурна революція" },
    who: { en: "officials, teachers, intellectuals and others called class enemies", ru: "чиновники, учителя, интеллигенция и прочие «классовые враги»", uk: "урядовці, вчителі, інтелігенція та інші «класові вороги»" },
    match: /cultural revolution|культурн\S* революц/i,
  },
  {
    // October 1965 – March 1966: about half a million killed (estimates up to a million).
    id: "indonesia-1965",
    by: ["indonesia"],
    kind: "massacre",
    from: "1965-10-01",
    to: "1966-03-31",
    toll: 500,
    where: { adm0: ["IDN"] },
    name: { en: "The killings of 1965–66", ru: "Массовые убийства 1965–1966 годов", uk: "Масові вбивства 1965–1966 років" },
    who: { en: "members and supposed members of the Communist Party", ru: "члены компартии и те, кого ими считали", uk: "члени компартії та ті, кого ними вважали" },
    match: /\bpki\b|\bпки\b|killings of 1965|убийства 1965|вбивства 1965/i,
  },
  {
    // From 25 March 1971: estimates from 300 thousand to 3 million; the lowest is taken.
    id: "east-pakistan",
    by: ["pakistan"],
    kind: "massacre",
    from: "1971-03-25",
    to: "1971-12-16",
    toll: 300,
    where: { adm0: ["BGD"] },
    regimes: ["military"],
    name: { en: "Operation Searchlight", ru: "Операция «Прожектор»", uk: "Операція «Прожектор»" },
    who: { en: "the Bengalis of East Pakistan", ru: "бенгальцы Восточного Пакистана", uk: "бенгальці Східного Пакистану" },
    match: /searchlight|прожектор|east pakistan|восточн\S* пакистан|східн\S* пакистан|бенгал|bengal/i,
  },
  {
    // The Rettig and Valech commissions: 3,197 killed or disappeared, about 38 thousand imprisoned and tortured, most in 1973–77.
    id: "chile-1973",
    by: ["chile"],
    kind: "purge",
    from: "1973-09-11",
    to: "1977-12-31",
    toll: 3.2,
    held: 38,
    where: { adm0: ["CHL"] },
    regimes: ["military"],
    name: { en: "The repression after the coup", ru: "Репрессии после переворота", uk: "Репресії після перевороту" },
    who: { en: "the left and the junta's opponents", ru: "левые и противники хунты", uk: "ліві та противники хунти" },
    match: /\bdina\b|caravan of death|караван смерт|repression after the coup|репресси\S* после переворот|репресі\S* після переворот/i,
  },
  {
    // CONADEP documented 8,961 disappeared; human rights groups say up to 30 thousand.
    id: "dirty-war",
    by: ["argentina"],
    kind: "purge",
    from: "1976-03-24",
    to: "1983-12-10",
    toll: 9,
    held: 30,
    where: { adm0: ["ARG"] },
    regimes: ["military"],
    name: { en: "The Dirty War", ru: "Грязная война", uk: "Брудна війна" },
    who: { en: "the left and the junta's opponents", ru: "левые и противники хунты", uk: "ліві та противники хунти" },
    match: /dirty war|грязн\S* войн|брудн\S* війн|desaparecid/i,
  },
  {
    // April 1975 – January 1979: estimates from 1.5 to 2 million dead. In 1973 the Khmer Rouge are their own side, Lon Nol's republic the other.
    id: "khmer-rouge",
    by: ["khmer-rouge", "cambodia"],
    kind: "massacre",
    from: "1975-04-17",
    to: "1979-01-07",
    toll: 1700,
    where: { adm0: ["KHM"] },
    regimes: ["party"],
    name: { en: "The Cambodian genocide", ru: "Геноцид в Камбодже", uk: "Геноцид у Камбоджі" },
    who: { en: "the people of Cambodia: townspeople, minorities, the educated", ru: "народ Камбоджи: горожане, меньшинства, образованные", uk: "народ Камбоджі: містяни, меншини, освічені" },
    match: /khmer|кхмер|cambodian genocide|геноцид в камбодж|геноцид у камбодж|killing fields|поля смерт/i,
  },
  // 1973 and 1979 ———————————————————————————————————————————————————————
  {
    // 1977–78: the Derg's Red Terror; estimates from 30 thousand to half a million, Amnesty's figure of about 100 thousand most cited.
    id: "red-terror",
    by: ["ethiopia"],
    kind: "purge",
    from: "1977-04-01",
    to: "1978-12-31",
    toll: 100,
    held: 200,
    where: { adm0: ["ETH", "ERI"] },
    regimes: ["military", "party"],
    leader: /mengistu|менгисту|менгісту/i,
    name: { en: "The Red Terror", ru: "Красный террор", uk: "Червоний терор" },
    who: { en: "students, the EPRP and anyone called a counter-revolutionary", ru: "студенты, ЭНРП и все, кого назвали контрреволюционерами", uk: "студенти, ЕНРП та всі, кого назвали контрреволюціонерами" },
    match: /red terror|красн\S* террор|червон\S* терор|qey shibir|кей шибир/i,
  },
  {
    // From the invasion of December 1975 to 1979: killings, and the famine of the forced resettlement; about 100 thousand dead (the CAVR's lower estimate).
    id: "east-timor",
    by: ["indonesia"],
    kind: "famine",
    from: "1975-12-07",
    to: "1979-12-31",
    toll: 100,
    where: { adm0: ["TLS"] },
    regimes: ["military"],
    leader: /suharto|сухарто/i,
    name: { en: "The occupation of East Timor", ru: "Оккупация Восточного Тимора", uk: "Окупація Східного Тимору" },
    who: { en: "the people of East Timor", ru: "народ Восточного Тимора", uk: "народ Східного Тимору" },
    match: /east timor|timor|тимор/i,
  },
  {
    // February 1982: the army's siege of Hama after the Muslim Brotherhood's rising; estimates from 10 to 40 thousand.
    id: "hama",
    by: ["syria"],
    kind: "massacre",
    from: "1982-02-02",
    to: "1982-02-28",
    toll: 20,
    where: { names: /^Hama$/ },
    regimes: ["party"],
    leader: /assad|асад/i,
    name: { en: "The Hama massacre", ru: "Резня в Хаме", uk: "Різанина в Хамі" },
    who: { en: "the people of Hama", ru: "жители Хамы", uk: "мешканці Хами" },
    match: /\bhama\b|хам[аеыу](?![а-яіїє])|хамі(?![а-яіїє])/i,
  },
  {
    // 1987–89, with the gassing of Halabja in March 1988: estimates from 50 to 180 thousand Kurds killed, thousands of villages razed (Human Rights Watch).
    id: "anfal",
    by: ["iraq"],
    kind: "massacre",
    from: "1987-03-29",
    to: "1989-02-28",
    toll: 100,
    where: { names: /^(Duhok|Erbil|Sulaymaniyah|Kirkuk|Nineveh)$/ },
    regimes: ["party"],
    leader: /saddam|саддам/i,
    name: { en: "The Anfal campaign", ru: "Операция «Анфаль»", uk: "Операція «Анфаль»" },
    who: { en: "the Kurds of Iraq", ru: "курды Ирака", uk: "курди Іраку" },
    match: /anfal|анфал|halabja|халабдж|kurd|курд/i,
  },
  // 1991 ————————————————————————————————————————————————————————————————
  {
    // 7 April – mid-July 1994: estimates from 500 to 800 thousand.
    id: "rwanda",
    by: ["rwanda"],
    kind: "massacre",
    from: "1994-04-07",
    to: "1994-07-15",
    toll: 600,
    where: { adm0: ["RWA"] },
    name: { en: "The genocide against the Tutsi", ru: "Геноцид тутси", uk: "Геноцид тутсі" },
    who: { en: "the Tutsi and moderate Hutu", ru: "тутси и умеренные хуту", uk: "тутсі та помірковані хуту" },
    match: /tutsi|тутси|тутсі/i,
  },
  {
    // March – June 1999: about 850 thousand driven out, about 10 thousand killed.
    id: "kosovo",
    by: ["yugoslavia", "serbia"],
    kind: "deportation",
    from: "1999-03-24",
    to: "1999-06-10",
    toll: 10,
    moved: 850,
    where: { adm0: ["KOS"] },
    abroad: true,
    name: { en: "The expulsions from Kosovo", ru: "Изгнание албанцев Косова", uk: "Вигнання албанців Косова" },
    who: { en: "the Kosovo Albanians", ru: "албанцы Косова", uk: "албанці Косова" },
    match: /kosov|косов/i,
  },
  {
    // 2003–05: about 300 thousand dead with the hunger and disease of the camps, a third of them killed outright.
    id: "darfur",
    by: ["sudan"],
    kind: "massacre",
    from: "2003-04-25",
    to: "2005-12-31",
    toll: 300,
    where: { names: /Darfur/ },
    name: { en: "The killings in Darfur", ru: "Массовые убийства в Дарфуре", uk: "Масові вбивства в Дарфурі" },
    who: { en: "the Fur, Masalit and Zaghawa", ru: "фур, масалит и загава", uk: "фур, масаліт і загава" },
    match: /darfur|дарфур/i,
  },
  // 2014 ————————————————————————————————————————————————————————————————
  {
    // August – December 2017: about 700 thousand driven into Bangladesh; at least 6,700 killed in the first month (MSF).
    id: "rohingya",
    by: ["myanmar", "burma"],
    kind: "deportation",
    from: "2017-08-25",
    to: "2017-12-31",
    toll: 10,
    moved: 700,
    where: { names: /Rakhine/ },
    abroad: true,
    name: { en: "The expulsion of the Rohingya", ru: "Изгнание рохинджа", uk: "Вигнання рохінджа" },
    who: { en: "the Rohingya", ru: "рохинджа", uk: "рохінджа" },
    match: /rohingya|рохинджа|рохінджа|rakhine|ракхайн/i,
  },
  {
    // From 2017: estimates of up to a million or more held in the camps.
    id: "xinjiang",
    by: ["china"],
    kind: "purge",
    from: "2017-04-01",
    to: "2019-12-31",
    toll: 0,
    held: 1000,
    where: { names: /Xinjiang/ },
    regimes: ["party"],
    name: { en: "The camps in Xinjiang", ru: "Лагеря в Синьцзяне", uk: "Табори в Сіньцзяні" },
    who: { en: "the Uyghurs and other Muslims of Xinjiang", ru: "уйгуры и другие мусульмане Синьцзяна", uk: "уйгури та інші мусульмани Сіньцзяну" },
    match: /xinjiang|uyghur|uighur|синьцзян|сіньцзян|уйгур/i,
  },
  // 2022 ————————————————————————————————————————————————————————————————
  {
    // Ukraine has identified about 19,500 children taken; the International Criminal Court's warrants of March 2023.
    id: "ukrainian-children",
    by: ["russia"],
    kind: "deportation",
    from: "2022-02-24",
    to: "2023-12-31",
    toll: 0,
    moved: 19.5,
    where: { adm0: ["UKR"] },
    into: ["RUS"],
    name: { en: "The deportation of Ukrainian children", ru: "Депортация украинских детей", uk: "Депортація українських дітей" },
    who: { en: "children from the occupied lands of Ukraine", ru: "дети с оккупированных земель Украины", uk: "діти з окупованих земель України" },
    match: /children|детей|дітей/i,
  },
];

/** History's event by id. */
export const historicCrime = (id: string): HistoricCrime | undefined => HISTORIC_CRIMES.find((c) => c.id === id);

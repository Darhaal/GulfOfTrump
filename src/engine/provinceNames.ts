/**
 * Russian and Ukrainian names for the provinces Natural Earth leaves without
 * them: the regions a country's divisions are grouped into on the standard
 * maps (French, Italian and Spanish regions, British NUTS regions, Japan's
 * regions, the Philippines' regions…), small countries and territories that
 * are one province, and a few specks Natural Earth names only by a code.
 * Applied when a map is loaded (`buildMapIndex`), so the map files stay as
 * `npm run maps` builds them. Keyed by province id; a part cut off by a
 * historical border ("…-p2", "Grand Est (east)") takes its province's name
 * and its side. An entry wins over the map's own name in that language.
 */

/** [Russian, Ukrainian, English where the map's own is only a code]. */
type Names = [ru: string, uk: string, en?: string];

export const PROVINCE_NAMES: Record<string, Names> = {
  // Countries and territories that are one province.
  aw: ["Аруба", "Аруба"],
  ai: ["Ангилья", "Ангілья"],
  ax: ["Аландские острова", "Аландські острови"],
  ad: ["Андорра", "Андорра"],
  as: ["Американское Самоа", "Американське Самоа"],
  au: ["Острова Ашмор и Картье", "Острови Ашмор і Картьє"],
  ag: ["Антигуа и Барбуда", "Антигуа і Барбуда"],
  bi: ["Бурунди", "Бурунді"],
  bh: ["Бахрейн", "Бахрейн"],
  bs: ["Багамские Острова", "Багамські Острови"],
  bl: ["Сен-Бартелеми", "Сен-Бартелемі"],
  bm: ["Бермудские Острова", "Бермудські Острови"],
  bb: ["Барбадос", "Барбадос"],
  ch: ["Швейцария", "Швейцарія"],
  clp: ["Остров Клиппертон", "Острів Кліппертон"],
  ck: ["Острова Кука", "Острови Кука"],
  km: ["Коморы", "Комори"],
  cv: ["Кабо-Верде", "Кабо-Верде"],
  cw: ["Кюрасао", "Кюрасао"],
  ky: ["Каймановы Острова", "Кайманові Острови"],
  cyn: ["Северный Кипр", "Північний Кіпр"],
  dm: ["Доминика", "Домініка"],
  do: ["Доминиканская Республика", "Домініканська Республіка"],
  esb: ["Суверенная база Декелия", "Суверенна база Декелія"],
  wsb: ["Суверенная база Акротири", "Суверенна база Акротирі"],
  fo: ["Фарерские острова", "Фарерські острови"],
  fm: ["Федеративные Штаты Микронезии", "Федеративні Штати Мікронезії"],
  gg: ["Гернси", "Гернсі"],
  gi: ["Гибралтар", "Гібралтар"],
  gd: ["Гренада", "Гренада"],
  gu: ["Гуам", "Гуам"],
  hk: ["Гонконг", "Гонконг"],
  hm: ["Остров Херд и острова Макдональд", "Острів Герд і острови Макдональд"],
  im: ["Остров Мэн", "Острів Мен"],
  ioa: ["Австралийские территории в Индийском океане", "Австралійські території в Індійському океані"],
  io: ["Британская территория в Индийском океане", "Британська територія в Індійському океані"],
  jm: ["Ямайка", "Ямайка"],
  je: ["Джерси", "Джерсі"],
  kas: ["Ледник Сиачен", "Льодовик Сіачен"],
  ki: ["Кирибати", "Кірибаті"],
  kn: ["Сент-Китс и Невис", "Сент-Кіттс і Невіс"],
  lc: ["Сент-Люсия", "Сент-Люсія"],
  li: ["Лихтенштейн", "Ліхтенштейн"],
  lu: ["Люксембург", "Люксембург"],
  mo: ["Макао", "Макао"],
  mf: ["Сен-Мартен", "Сен-Мартен"],
  mc: ["Монако", "Монако"],
  md: ["Молдова", "Молдова"],
  mv: ["Мальдивы", "Мальдіви"],
  mh: ["Маршалловы Острова", "Маршаллові Острови"],
  mt: ["Мальта", "Мальта"],
  me: ["Черногория", "Чорногорія"],
  mp: ["Северные Марианские Острова", "Північні Маріанські Острови"],
  ms: ["Монтсеррат", "Монтсеррат"],
  mu: ["Маврикий", "Маврикій"],
  nf: ["Остров Норфолк", "Острів Норфолк"],
  nu: ["Ниуэ", "Ніуе"],
  nr: ["Науру", "Науру"],
  pn: ["Острова Питкэрн", "Острови Піткерн"],
  pga: ["Острова Спратли", "Острови Спратлі"],
  pw: ["Палау", "Палау"],
  pf: ["Французская Полинезия", "Французька Полінезія"],
  sg: ["Сингапур", "Сінгапур"],
  gs: ["Южная Георгия и Южные Сандвичевы Острова", "Південна Джорджія та Південні Сандвічеві Острови"],
  sh: ["Остров Святой Елены", "Острів Святої Єлени"],
  sv: ["Сальвадор", "Сальвадор"],
  sm: ["Сан-Марино", "Сан-Марино"],
  pm: ["Сен-Пьер и Микелон", "Сен-П'єр і Мікелон"],
  st: ["Сан-Томе и Принсипи", "Сан-Томе і Принсіпі"],
  sx: ["Синт-Мартен", "Сінт-Мартен"],
  sc: ["Сейшельские Острова", "Сейшельські Острови"],
  tc: ["Острова Теркс и Кайкос", "Острови Теркс і Кайкос"],
  tl: ["Восточный Тимор", "Східний Тимор"],
  to: ["Тонга", "Тонга"],
  tt: ["Тринидад и Тобаго", "Тринідад і Тобаго"],
  tv: ["Тувалу", "Тувалу"],
  um: ["Внешние малые острова США", "Зовнішні малі острови США"],
  usg: ["База Гуантанамо", "База Гуантанамо"],
  vc: ["Сент-Винсент и Гренадины", "Сент-Вінсент і Гренадини"],
  vg: ["Британские Виргинские Острова", "Британські Віргінські Острови"],
  vi: ["Американские Виргинские Острова", "Американські Віргінські Острови"],
  wf: ["Уоллис и Футуна", "Волліс і Футуна"],
  ws: ["Самоа", "Самоа"],

  // Specks Natural Earth names by a code, and two small pieces it mislabels.
  "co-col-99": ["Остров Мальпело", "Острів Мальпело", "Malpelo Island"],
  "mx-mex-99": ["Риф Алакранес", "Риф Алакранес", "Alacranes Reef"],
  "ru-rus-99": ["Острова Байдарацкой губы", "Острови Байдарацької губи", "Baydaratskaya Bay islands"],
  "ae-fujairah": ["Фуджейра", "Фуджейра"],
  "ae-sayh-mudayrah": ["Сайх-Мудайра", "Сайх-Мудайра"],
  "mg-androy": ["Андруй", "Андрой"],

  // Azerbaijan's economic regions.
  "az-absheron-economic-region": ["Апшеронский экономический район", "Апшеронський економічний район"],
  "az-aran-economic-region": ["Аранский экономический район", "Аранський економічний район"],
  "az-daghlig-shirvan-economic-region": ["Горно-Ширванский экономический район", "Гірсько-Ширванський економічний район"],
  "az-ganja-gazakh-economic-region": ["Гянджа-Газахский экономический район", "Гянджа-Газахський економічний район"],
  "az-guba-khachmaz-economic-region": ["Губа-Хачмазский экономический район", "Губа-Хачмазький економічний район"],
  "az-kalbajar-lachin-economic-region": ["Кельбаджар-Лачинский экономический район", "Кельбаджар-Лачинський економічний район"],
  "az-lankaran-economic-region": ["Ленкоранский экономический район", "Ленкоранський економічний район"],
  "az-naxc-van-autonomous-republic": ["Нахичеванская Автономная Республика", "Нахічеванська Автономна Республіка"],
  "az-shaki-zaqatala-economic-region": ["Шеки-Закатальский экономический район", "Шекі-Закатальський економічний район"],
  "az-yukhari-garabakh-economic-region": ["Верхне-Карабахский экономический район", "Верхньокарабаський економічний район"],

  // Burkina Faso's regions.
  "bf-boucle-du-mouhoun": ["Букль-дю-Мухун", "Букль-дю-Мухун"],
  "bf-cascades": ["Каскады", "Каскади"],
  "bf-centre": ["Центральная область", "Центральна область"],
  "bf-centre-est": ["Центрально-Восточная область", "Центрально-Східна область"],
  "bf-centre-nord": ["Центрально-Северная область", "Центрально-Північна область"],
  "bf-centre-ouest": ["Центрально-Западная область", "Центрально-Західна область"],
  "bf-centre-sud": ["Центрально-Южная область", "Центрально-Південна область"],
  "bf-est": ["Восточная область", "Східна область"],
  "bf-hauts-bassins": ["О-Бассен", "О-Бассен"],
  "bf-nord": ["Северная область", "Північна область"],
  "bf-plateau-central": ["Центральное Плато", "Центральне Плато"],
  "bf-sahel": ["Сахель", "Сахель"],
  "bf-sud-ouest": ["Юго-Западная область", "Південно-Західна область"],

  // Spain's autonomous communities.
  "es-andalucia": ["Андалусия", "Андалусія"],
  "es-aragon": ["Арагон", "Арагон"],
  "es-canary-is": ["Канарские острова", "Канарські острови"],
  "es-castilla-la-mancha": ["Кастилия – Ла-Манча", "Кастилія – Ла-Манча"],
  "es-castilla-y-leon": ["Кастилия и Леон", "Кастилія і Леон"],
  "es-cataluna": ["Каталония", "Каталонія"],
  "es-extremadura": ["Эстремадура", "Естремадура"],
  "es-foral-de-navarra": ["Наварра", "Наварра"],
  "es-galicia": ["Галисия", "Галісія"],
  "es-islas-baleares": ["Балеарские острова", "Балеарські острови"],
  "es-madrid": ["Мадрид", "Мадрид"],
  "es-pais-vasco": ["Страна Басков", "Країна Басків"],
  "es-valenciana": ["Валенсия", "Валенсія"],

  // France's regions.
  "fr-auvergne-rhone-alpes": ["Овернь – Рона – Альпы", "Овернь – Рона – Альпи"],
  "fr-bourgogne-franche-comte": ["Бургундия – Франш-Конте", "Бургундія – Франш-Конте"],
  "fr-bretagne": ["Бретань", "Бретань"],
  "fr-centre-val-de-loire": ["Центр – Долина Луары", "Центр – Долина Луари"],
  "fr-corse": ["Корсика", "Корсика"],
  "fr-grand-est": ["Гранд-Эст", "Гранд-Ест"],
  "fr-guyane-francaise": ["Французская Гвиана", "Французька Гвіана"],
  "fr-hauts-de-france": ["О-де-Франс", "О-де-Франс"],
  "fr-ile-de-france": ["Иль-де-Франс", "Іль-де-Франс"],
  "fr-normandie": ["Нормандия", "Нормандія"],
  "fr-nouvelle-aquitaine": ["Новая Аквитания", "Нова Аквітанія"],
  "fr-occitanie": ["Окситания", "Окситанія"],
  "fr-pays-de-la-loire": ["Земли Луары", "Пеї-де-ла-Луар"],
  "fr-provence-alpes-cote-d-azur": ["Прованс – Альпы – Лазурный Берег", "Прованс – Альпи – Лазурний Берег"],

  // The United Kingdom's regions (Scotland's by their NUTS names).
  "gb-east": ["Восток Англии", "Схід Англії"],
  "gb-east-midlands": ["Восточный Мидленд", "Східний Мідленд"],
  "gb-east-wales": ["Восточный Уэльс", "Східний Уельс"],
  "gb-eastern": ["Восточная Шотландия", "Східна Шотландія"],
  "gb-greater-london": ["Большой Лондон", "Великий Лондон"],
  "gb-highlands-and-islands": ["Хайленд и острова", "Гайленд і острови"],
  "gb-north-east": ["Северо-Восточная Англия", "Північно-Східна Англія"],
  "gb-north-eastern": ["Северо-Восточная Шотландия", "Північно-Східна Шотландія"],
  "gb-north-west": ["Северо-Западная Англия", "Північно-Західна Англія"],
  "gb-northern-ireland": ["Северная Ирландия", "Північна Ірландія"],
  "gb-south-east": ["Юго-Восточная Англия", "Південно-Східна Англія"],
  "gb-south-west": ["Юго-Западная Англия", "Південно-Західна Англія"],
  "gb-south-western": ["Юго-Западная Шотландия", "Південно-Західна Шотландія"],
  "gb-west-midlands": ["Западный Мидленд", "Західний Мідленд"],
  "gb-west-wales-and-the-valleys": ["Западный Уэльс и Долины", "Західний Уельс і Долини"],
  "gb-yorkshire-and-the-humber": ["Йоркшир и Хамбер", "Йоркшир і Гамбер"],

  // Hungary's regions.
  "hu-central-hungary": ["Центральная Венгрия", "Центральна Угорщина"],
  "hu-central-transdanubia": ["Центральное Задунайское", "Центральне Задунав'я"],
  "hu-great-southern-plain": ["Южный Альфёльд", "Південний Альфельд"],
  "hu-northern-great-plain": ["Северный Альфёльд", "Північний Альфельд"],
  "hu-northern-hungary": ["Северная Венгрия", "Північна Угорщина"],
  "hu-southern-transdanubia": ["Южное Задунайское", "Південне Задунав'я"],
  "hu-western-transdanubia": ["Западное Задунайское", "Західне Задунав'я"],

  // Italy's regions.
  "it-abruzzo": ["Абруццо", "Абруццо"],
  "it-apulia": ["Апулия", "Апулія"],
  "it-basilicata": ["Базиликата", "Базиліката"],
  "it-calabria": ["Калабрия", "Калабрія"],
  "it-campania": ["Кампания", "Кампанія"],
  "it-emilia-romagna": ["Эмилия-Романья", "Емілія-Романья"],
  "it-friuli-venezia-giulia": ["Фриули – Венеция-Джулия", "Фріулі – Венеція-Джулія"],
  "it-lazio": ["Лацио", "Лаціо"],
  "it-lombardia": ["Ломбардия", "Ломбардія"],
  "it-marche": ["Марке", "Марке"],
  "it-molise": ["Молизе", "Молізе"],
  "it-piemonte": ["Пьемонт", "П'ємонт"],
  "it-sardegna": ["Сардиния", "Сардинія"],
  "it-sicily": ["Сицилия", "Сицилія"],
  "it-toscana": ["Тоскана", "Тоскана"],
  "it-trentino-alto-adige": ["Трентино – Альто-Адидже", "Трентіно – Альто-Адідже"],
  "it-umbria": ["Умбрия", "Умбрія"],
  "it-valle-d-aosta": ["Валле-д'Аоста", "Валле-д'Аоста"],
  "it-veneto": ["Венето", "Венето"],

  // Japan's regions.
  "jp-chubu": ["Тюбу", "Тюбу"],
  "jp-chugoku": ["Тюгоку", "Тюґоку"],
  "jp-hokkaido": ["Хоккайдо", "Хоккайдо"],
  "jp-kanto": ["Канто", "Канто"],
  "jp-kinki": ["Кинки", "Кінкі"],
  "jp-kyushu": ["Кюсю", "Кюсю"],
  "jp-okinawa": ["Окинава", "Окінава"],
  "jp-shikoku": ["Сикоку", "Сікоку"],
  "jp-tohoku": ["Тохоку", "Тохоку"],

  // Kosovo's districts.
  "xk-akovica": ["Джяковица", "Джяковиця"],
  "xk-pec": ["Печ", "Печ"],
  "xk-pristina": ["Приштина", "Приштина"],
  "xk-prizren": ["Призрен", "Призрен"],
  "xk-urosevac": ["Урошевац", "Урошевац"],

  // Latvia's historical lands.
  "lv-kurzeme": ["Курземе", "Курземе"],
  "lv-latgale": ["Латгалия", "Латгалія"],
  "lv-vidzeme": ["Видземе", "Відземе"],
  "lv-zemgale": ["Земгале", "Земгале"],

  // North Macedonia's statistical regions.
  "mk-eastern": ["Восточный регион", "Східний регіон"],
  "mk-greater-skopje": ["Скопский регион", "Скопський регіон"],
  "mk-northeastern": ["Северо-Восточный регион", "Північно-Східний регіон"],
  "mk-pelagonia": ["Пелагонийский регион", "Пелагонійський регіон"],
  "mk-polog": ["Положский регион", "Положський регіон"],
  "mk-southeastern": ["Юго-Восточный регион", "Південно-Східний регіон"],
  "mk-southwestern": ["Юго-Западный регион", "Південно-Західний регіон"],
  "mk-vardar": ["Вардарский регион", "Вардарський регіон"],

  // The Philippines' regions.
  "ph-autonomous-region-in-muslim-mindanao-armm": ["Автономный регион в Мусульманском Минданао", "Автономний регіон у Мусульманському Мінданао"],
  "ph-bicol-region-v": ["Бикол", "Бікол"],
  "ph-cagayan-valley-region-ii": ["Долина Кагаян", "Долина Кагаян"],
  "ph-calabarzon-region-iv-a": ["Калабарсон", "Калабарсон"],
  "ph-central-luzon-region-iii": ["Центральный Лусон", "Центральний Лусон"],
  "ph-central-visayas-region-vii": ["Центральные Висайи", "Центральні Вісаї"],
  "ph-cordillera-administrative-region-car": ["Кордильерский административный регион", "Кордильєрський адміністративний регіон"],
  "ph-davao-region-xi": ["Давао", "Давао"],
  "ph-dinagat-islands-region-xiii": ["Карага", "Карага"],
  "ph-eastern-visayas-region-viii": ["Восточные Висайи", "Східні Вісаї"],
  "ph-ilocos-region-i": ["Илокос", "Ілокос"],
  "ph-mimaropa-region-iv-b": ["Мимаропа", "Мімаропа"],
  "ph-national-capital-region": ["Метро Манила", "Метро Маніла"],
  "ph-northern-mindanao-region-x": ["Северный Минданао", "Північний Мінданао"],
  "ph-soccsksargen-region-xii": ["Соксарген", "Соксарген"],
  "ph-western-visayas-region-vi": ["Западные Висайи", "Західні Вісаї"],
  "ph-zamboanga-peninsula-region-ix": ["Полуостров Замбоанга", "Півострів Замбоанга"],

  // Slovenia's statistical regions.
  "si-gorenjska": ["Горенска", "Горенська"],
  "si-goriska": ["Горишка", "Горишка"],
  "si-jugovzhodna-slovenija": ["Юго-Восточная Словения", "Південно-Східна Словенія"],
  "si-koroska": ["Корошка", "Корошка"],
  "si-notranjsko-kraska": ["Нотраньско-Крашка", "Нотраньсько-Крашка"],
  "si-obalno-kraska": ["Обално-Крашка", "Обально-Крашка"],
  "si-osrednjeslovenska": ["Осреднесловенска", "Осередньословенська"],
  "si-podravska": ["Подравска", "Подравська"],
  "si-pomurska": ["Помурска", "Помурська"],
  "si-savinjska": ["Савиньска", "Савинська"],
  "si-spodnjeposavska": ["Споднепосавска", "Споднєпосавська"],
  "si-zasavska": ["Засавска", "Засавська"],

  // Thailand's regions.
  "th-central": ["Центральный Таиланд", "Центральний Таїланд"],
  "th-eastern": ["Восточный Таиланд", "Східний Таїланд"],
  "th-northeastern": ["Исан", "Ісан"],
  "th-northern": ["Северный Таиланд", "Північний Таїланд"],
  "th-southern": ["Южный Таиланд", "Південний Таїланд"],
  "th-western": ["Западный Таиланд", "Західний Таїланд"],

  // Taiwan.
  "tw-fujian-province": ["Фуцзянь (Цзиньмэнь и Мацзу)", "Фуцзянь (Цзіньмень і Мацзу)"],
  "tw-special-municipalities": ["Города центрального подчинения", "Міста центрального підпорядкування"],
  "tw-taiwan-province": ["Провинция Тайвань", "Провінція Тайвань"],

  // Uganda's regions.
  "ug-central": ["Центральная область", "Центральна область"],
  "ug-eastern": ["Восточная область", "Східна область"],
  "ug-northern": ["Северная область", "Північна область"],
  "ug-western": ["Западная область", "Західна область"],

  // Vietnam's regions.
  "vn-bac-trung-bo": ["Северо-Центральное побережье", "Північно-Центральне узбережжя"],
  "vn-nam-trung-bo": ["Южно-Центральное побережье", "Південно-Центральне узбережжя"],
  "vn-ong-bac": ["Северо-Восток", "Північний Схід"],
  "vn-ong-b-c": ["Тхайнгуен", "Тхайнгуєн", "Thái Nguyên"],
  "vn-ong-bang-song-cuu-long": ["Дельта Меконга", "Дельта Меконгу"],
  "vn-ong-bang-song-hong": ["Дельта Красной реки", "Дельта Червоної річки"],
  "vn-tay-bac": ["Северо-Запад", "Північний Захід"],
  "vn-tay-nguyen": ["Центральное нагорье", "Центральне нагір'я"],
};

/** The side a part cut off by a historical border lies on, as scripts/build-maps.mjs names it. */
const SIDES: Record<string, [ru: string, uk: string]> = {
  north: ["север", "північ"],
  south: ["юг", "південь"],
  east: ["восток", "схід"],
  west: ["запад", "захід"],
};

/** A compound side, as the finer map's split names its parts ("north-west"). */
const COMPOUND: Record<string, [ru: string, uk: string]> = {
  "north-west": ["северо-запад", "північний захід"],
  "north-east": ["северо-восток", "північний схід"],
  "south-west": ["юго-запад", "південний захід"],
  "south-east": ["юго-восток", "південний схід"],
};

/** "Selva (Loreto) (north-west)" → the base name and the side, in each language, when the name ends with a side. */
function sideOf(name: string): { base: string; side: [string, string] } | undefined {
  const m = /^(.*) \(([a-z-]+)\)$/.exec(name);
  if (!m) return undefined;
  const side = SIDES[m[2]] ?? COMPOUND[m[2]];
  return side ? { base: m[1], side } : undefined;
}

/** A province's names from the table: its own entry, or its province's with the side of a cut-off part. */
export function provinceNamesOf(id: string, name: string): Names | undefined {
  const own = PROVINCE_NAMES[id];
  if (own) return own;
  const part = /^(.*)-p\d+$/.exec(id);
  const base = part && PROVINCE_NAMES[part[1]];
  const side = /\((north|south|east|west)\)$/.exec(name)?.[1];
  if (!base || !side) return undefined;
  const [ru, uk] = SIDES[side];
  return [`${base[0]} (${ru})`, `${base[1]} (${uk})`, ...(base[2] ? [`${base[2]} (${side})`] : [])] as Names;
}

/**
 * The city a province is known by where Natural Earth's pick is another
 * place's: its Nakhodka (the Primorye port) lands in the Yamal north. The
 * province card names the era's largest city itself (components/map/cities.ts);
 * this is what the game master reads.
 */
const PROVINCE_CITY: Record<string, string> = {
  "ru-yamalo-nenets-autonomous-okrug": "Salekhard",
};

/** Fills in, in place, the names a map's provinces lack (the table wins where it has an entry), and corrects a wrong city. */
export function nameProvinces(list: Iterable<{ id: string; name: string; ru?: string; uk?: string; city?: string }>): void {
  const regions = [...list];
  for (const r of regions) {
    if (PROVINCE_CITY[r.id]) r.city = PROVINCE_CITY[r.id];
    // The player's dashes are short: Natural Earth writes "Эль-Аюн — Буждур".
    if (r.ru?.includes("—")) r.ru = r.ru.replaceAll("—", "–");
    if (r.uk?.includes("—")) r.uk = r.uk.replaceAll("—", "–");
    const names = provinceNamesOf(r.id, r.name);
    if (!names) continue;
    r.ru = names[0];
    r.uk = names[1];
    if (names[2]) r.name = names[2];
  }
  // A part named after its province and a side ("Davao (Region XI) (south)", "Selva (Loreto) (north-west)"), with no names of its own:
  // its province's names, wherever that province is named, and the side.
  const named = new Map(regions.filter((r) => r.ru && r.uk).map((r) => [r.name, r] as const));
  for (const r of regions) {
    if (r.ru && r.uk) continue;
    const parsed = sideOf(r.name);
    const base = parsed && named.get(parsed.base);
    if (!parsed || !base?.ru || !base.uk) continue;
    r.ru = `${base.ru} (${parsed.side[0]})`;
    r.uk = `${base.uk} (${parsed.side[1]})`;
  }
}

import type { Locale, ScenarioId, Localized } from "@/engine/types";

/** One place from public/maps/cities.json (populations in thousands). */
export interface CityRecord {
  n: string;
  ru?: string;
  uk?: string;
  x: number;
  y: number;
  /** Natural Earth scale rank: 0 = world city … 10 = small town. */
  r: number;
  cap?: 1;
  /** The seat of a first-level division: a provincial capital. */
  adm1?: 1;
  a: string;
  p50: number;
  p90: number;
  p20: number;
}

export type CityKind = "capital" | "city" | "seat" | "town";

export interface EraCity {
  name: string;
  x: number;
  y: number;
  kind: CityKind;
  /** The zoom from which the place may be drawn (if its name finds room). */
  minZoom: number;
  /** Population on the start date, thousands (estimated where unknown). */
  pop: number;
  /** Higher wins a spot when names would collide: capitals, then flashpoints, then size. */
  priority: number;
}

/** A town from public/maps/towns.json: [name, x, y, population today in thousands, seat, ru?, uk?]. */
export type TownRecord = [string, number, number, number, 0 | 1, (string | 0)?, (string | 0)?];

type Names = { en: string; ru: string; uk: string };
const N = (en: string, ru: string, uk: string): Names => ({ en, ru, uk });

/**
 * What a city was called on each start date, where that differs from today.
 * Keys are Natural Earth's English names.
 */
const HISTORICAL_NAMES: Record<string, Partial<Record<ScenarioId, Names>>> = {
  "Saint Petersburg": { "1939": N("Leningrad", "Ленинград", "Ленінград"), "1991": N("Leningrad", "Ленинград", "Ленінград") },
  Volgograd: { "1914": N("Tsaritsyn", "Царицын", "Царицин"), "1939": N("Stalingrad", "Сталинград", "Сталінград") },
  Kaliningrad: { "1914": N("Königsberg", "Кёнигсберг", "Кенігсберг"), "1939": N("Königsberg", "Кёнигсберг", "Кенігсберг") },
  Gdańsk: { "1914": N("Danzig", "Данциг", "Данциг"), "1939": N("Danzig", "Данциг", "Данциг") },
  Szczecin: { "1914": N("Stettin", "Штеттин", "Штеттін"), "1939": N("Stettin", "Штеттин", "Штеттін") },
  Poznań: { "1914": N("Posen", "Позен", "Позен") },
  Klaipėda: { "1914": N("Memel", "Мемель", "Мемель"), "1939": N("Memel", "Мемель", "Мемель") },
  Lviv: { "1914": N("Lemberg", "Лемберг", "Лемберг"), "1939": N("Lwów", "Львов", "Львів") },
  "Ivano-Frankivsk": { "1914": N("Stanislau", "Станислав", "Станіслав"), "1939": N("Stanisławów", "Станиславов", "Станиславів") },
  Chernivtsi: { "1914": N("Czernowitz", "Черновцы", "Чернівці"), "1939": N("Cernăuți", "Черновцы", "Чернівці") },
  Uzhhorod: { "1914": N("Ungvár", "Ужгород", "Ужгород"), "1939": N("Ungvár", "Ужгород", "Ужгород") },
  Vilnius: { "1914": N("Vilna", "Вильна", "Вільна"), "1939": N("Wilno", "Вильно", "Вільно") },
  Kaunas: { "1914": N("Kovno", "Ковно", "Ковно") },
  Tallinn: { "1914": N("Reval", "Ревель", "Ревель") },
  Tbilisi: { "1914": N("Tiflis", "Тифлис", "Тифліс") },
  Istanbul: { "1914": N("Constantinople", "Константинополь", "Константинополь") },
  İzmir: { "1914": N("Smyrna", "Смирна", "Смірна") },
  Oslo: { "1914": N("Kristiania", "Христиания", "Христианія") },
  Beijing: { "1914": N("Peking", "Пекин", "Пекін"), "1939": N("Peiping", "Бэйпин", "Бейпін") },
  Nanjing: { "1914": N("Nanking", "Нанкин", "Нанкін"), "1939": N("Nanking", "Нанкин", "Нанкін") },
  Guangzhou: { "1914": N("Canton", "Кантон", "Кантон"), "1939": N("Canton", "Кантон", "Кантон") },
  Shenyang: { "1914": N("Mukden", "Мукден", "Мукден"), "1939": N("Mukden", "Мукден", "Мукден") },
  Seoul: { "1914": N("Keijō", "Кэйдзё", "Кейдзьо"), "1939": N("Keijō", "Кэйдзё", "Кейдзьо") },
  Taipei: { "1914": N("Taihoku", "Тайхоку", "Тайхоку"), "1939": N("Taihoku", "Тайхоку", "Тайхоку") },
  "Ho Chi Minh City": { "1914": N("Saigon", "Сайгон", "Сайгон"), "1939": N("Saigon", "Сайгон", "Сайгон") },
  Yangon: { "1914": N("Rangoon", "Рангун", "Рангун"), "1939": N("Rangoon", "Рангун", "Рангун") },
  Mumbai: { "1914": N("Bombay", "Бомбей", "Бомбей"), "1939": N("Bombay", "Бомбей", "Бомбей"), "1991": N("Bombay", "Бомбей", "Бомбей") },
  Kolkata: { "1914": N("Calcutta", "Калькутта", "Калькутта"), "1939": N("Calcutta", "Калькутта", "Калькутта"), "1991": N("Calcutta", "Калькутта", "Калькутта") },
  Chennai: { "1914": N("Madras", "Мадрас", "Мадрас"), "1939": N("Madras", "Мадрас", "Мадрас"), "1991": N("Madras", "Мадрас", "Мадрас") },
  Dhaka: { "1914": N("Dacca", "Дакка", "Дакка"), "1939": N("Dacca", "Дакка", "Дакка") },
  Jakarta: { "1914": N("Batavia", "Батавия", "Батавія"), "1939": N("Batavia", "Батавия", "Батавія") },
  Kinshasa: { "1914": N("Léopoldville", "Леопольдвиль", "Леопольдвіль"), "1939": N("Léopoldville", "Леопольдвиль", "Леопольдвіль") },
  Harare: { "1914": N("Salisbury", "Солсбери", "Солсбері"), "1939": N("Salisbury", "Солсбери", "Солсбері") },
  Maputo: { "1914": N("Lourenço Marques", "Лоренсу-Маркиш", "Лоренсу-Маркіш"), "1939": N("Lourenço Marques", "Лоренсу-Маркиш", "Лоренсу-Маркіш") },
  Yekaterinburg: { "1939": N("Sverdlovsk", "Свердловск", "Свердловськ"), "1991": N("Sverdlovsk", "Свердловск", "Свердловськ") },
  "Nizhny Novgorod": { "1939": N("Gorky", "Горький", "Горький"), "1991": N("Gorky", "Горький", "Горький") },
  Samara: { "1939": N("Kuybyshev", "Куйбышев", "Куйбишев"), "1991": N("Kuybyshev", "Куйбышев", "Куйбишев") },
  Novosibirsk: { "1914": N("Novonikolayevsk", "Новониколаевск", "Новомиколаївськ") },
  Kirov: { "1914": N("Vyatka", "Вятка", "Вятка") },
  Donetsk: { "1914": N("Yuzovka", "Юзовка", "Юзівка"), "1939": N("Stalino", "Сталино", "Сталіно") },
  Dnipro: { "1914": N("Yekaterinoslav", "Екатеринослав", "Катеринослав"), "1939": N("Dnepropetrovsk", "Днепропетровск", "Дніпропетровськ"), "1991": N("Dnepropetrovsk", "Днепропетровск", "Дніпропетровськ"), "2014": N("Dnipropetrovsk", "Днепропетровск", "Дніпропетровськ") },
  Luhansk: { "1939": N("Voroshilovgrad", "Ворошиловград", "Ворошиловград") },
  Zaporizhzhia: { "1914": N("Aleksandrovsk", "Александровск", "Олександрівськ") },
  Kropyvnytskyi: { "1914": N("Yelisavetgrad", "Елисаветград", "Єлисаветград"), "1939": N("Kirovo", "Кирово", "Кірове"), "1991": N("Kirovograd", "Кировоград", "Кіровоград"), "2014": N("Kirovohrad", "Кировоград", "Кіровоград") },
  Almaty: { "1914": N("Verny", "Верный", "Вірний"), "1939": N("Alma-Ata", "Алма-Ата", "Алма-Ата"), "1991": N("Alma-Ata", "Алма-Ата", "Алма-Ата") },
  Bishkek: { "1914": N("Pishpek", "Пишпек", "Пішпек"), "1939": N("Frunze", "Фрунзе", "Фрунзе") },
  Dushanbe: { "1939": N("Stalinabad", "Сталинабад", "Сталінабад") },
  Bratislava: { "1914": N("Pressburg", "Пресбург", "Пресбург") },
  Ljubljana: { "1914": N("Laibach", "Лайбах", "Лайбах") },
  Zagreb: { "1914": N("Agram", "Аграм", "Аграм") },
  Ankara: { "1914": N("Angora", "Ангора", "Ангора") },
};

/** Cities that did not exist yet, or were villages, before a year. */
const FOUNDED: Record<string, number> = {
  Brasília: 1960,
  Abuja: 1976,
  Islamabad: 1961,
  Chandigarh: 1953,
  Naypyidaw: 2005,
  Gaborone: 1964,
  Nouakchott: 1958,
  Shenzhen: 1979,
  Belmopan: 1970,
  Putrajaya: 1995,
  Togliatti: 1964,
  Astana: 1997,
  "Nur-Sultan": 1997,
  Dodoma: 1973,
  Lilongwe: 1965,
  Gdynia: 1926,
};

/** Places that matter on a start date whatever their size: flashpoints of the scenario. */
const NOTABLE: Record<string, ScenarioId[]> = {
  Sarajevo: ["1914"],
  Sevastopol: ["1914", "1939", "1991", "2014", "2022"],
  Simferopol: ["2014"],
  Donetsk: ["2014"],
  Luhansk: ["2014"],
  Narvik: ["1939"],
  Tobruk: ["1939"],
  Kaunas: ["1939"],
  Gdańsk: ["1991", "2022"],
  Lviv: ["1991", "2014", "2022"],
  Kharkiv: ["1914", "1939", "1991", "2014", "2022"],
};

const START_YEAR: Record<ScenarioId, number> = { "1914": 1914, "1939": 1939, "1991": 1991, "2014": 2014, "2022": 2022 };

/** National capitals on each start date (Natural Earth names); 1991 and 2022 use today's, corrected. */
const CAPITALS: Partial<Record<ScenarioId, string[]>> = {
  "1914": [
    "London", "Paris", "Berlin", "Saint Petersburg", "Vienna", "Rome", "Istanbul", "Belgrade", "Washington", "Tokyo", "Madrid",
    "Lisbon", "Brussels", "Amsterdam", "Stockholm", "Oslo", "Copenhagen", "Bern", "Bucharest", "Sofia", "Athens", "Beijing",
    "Tehran", "Ottawa", "Melbourne", "Pretoria", "Wellington", "Rio de Janeiro", "Buenos Aires", "Mexico City", "Havana",
    "Bangkok", "Addis Ababa", "Kabul", "Luxembourg", "Monrovia", "Lima", "Santiago", "Bogotá", "Caracas", "Montevideo",
  ],
  "1939": [
    "London", "Paris", "Berlin", "Moscow", "Rome", "Warsaw", "Tokyo", "Washington", "Chongqing", "Madrid", "Budapest",
    "Bucharest", "Helsinki", "Ankara", "Belgrade", "Athens", "Amsterdam", "Brussels", "Stockholm", "Oslo", "Copenhagen", "Bern",
    "Lisbon", "Kaunas", "Riga", "Tallinn", "Bratislava", "Sofia", "Dublin", "Ottawa", "Canberra", "Pretoria", "Wellington",
    "Rio de Janeiro", "Buenos Aires", "Mexico City", "Ulaanbaatar", "Tehran", "Baghdad", "Cairo", "Bangkok", "Kabul",
    "Luxembourg", "Havana", "Lima", "Santiago", "Bogotá", "Caracas", "Montevideo", "Monrovia",
  ],
};

/** Today's capitals that were not national capitals in August 1991. */
const NOT_CAPITAL_1991 = new Set([
  "UKR", "BLR", "LTU", "LVA", "EST", "MDA", "GEO", "ARM", "AZE", "KAZ", "UZB", "TKM", "KGZ", "TJK",
  "SVN", "HRV", "BIH", "MKD", "MNE", "SVK", "ERI", "SDS", "KOS", "TLS", "NGA", "MMR", "TZA",
]);
const EXTRA_CAPITALS_1991 = ["Lagos", "Yangon", "Dar es Salaam"];

/** Population on the start date in thousands: the series where it exists, else today's scaled back. */
function eraPopulation(c: CityRecord, era: ScenarioId): number {
  if (era === "2022" || era === "2014") return c.p20;
  if (era === "1991") return c.p90 || c.p20 * 0.65;
  return c.p50 ? c.p50 * (era === "1914" ? 0.55 : 0.8) : c.p20 * (era === "1914" ? 0.2 : 0.3);
}

/**
 * Detail grows with zoom: the world view is the countries alone; capitals
 * come at 1.8×, then cities over five, two and one million, big cities and
 * the scenario's flashpoints, provincial capitals at 6×, smaller cities at
 * 8× and every town by the closest zoom. Names that would collide make way
 * for more important ones, so these are the earliest a place may show.
 */
function minZoomOf(kind: CityKind, pop: number, notable: boolean): number {
  if (kind === "capital") return 1.8;
  if (pop >= 5000) return 2.2;
  if (pop >= 2000) return 2.8;
  if (pop >= 1000) return 3.5;
  if (pop >= 400 || notable) return 4.5;
  if (kind === "seat" || pop >= 150) return 6;
  return 8;
}

const priorityOf = (kind: CityKind, pop: number, notable: boolean) => (kind === "capital" ? 1e7 : 0) + (notable ? 5e5 : 0) + pop;

/** A city's name on a scenario's map: proclaimed in play, else the era's, else today's. */
export function cityNameIn(c: CityRecord, era: ScenarioId, locale: Locale, renamed: Record<string, Localized> = {}): string {
  const historical = HISTORICAL_NAMES[c.n]?.[era];
  return renamed[c.n] ? renamed[c.n][locale] : historical ? historical[locale] : locale === "ru" ? (c.ru ?? c.n) : locale === "uk" ? (c.uk ?? c.n) : c.n;
}

/** Whether a city stood on a scenario's start date. */
export const foundedBy = (c: CityRecord, era: ScenarioId) => (FOUNDED[c.n] ?? 0) <= START_YEAR[era];

/** The cities that mattered on a scenario's start date, with their names then. */
export function eraCities(cities: CityRecord[], era: ScenarioId, locale: Locale, renamed: Record<string, Localized> = {}): EraCity[] {
  const year = START_YEAR[era];
  const capitals = CAPITALS[era] ? new Set(CAPITALS[era]) : null;
  const isCapital = (c: CityRecord) => {
    if (capitals) return capitals.has(c.n);
    if (era === "1991") return (Boolean(c.cap) && !NOT_CAPITAL_1991.has(c.a)) || EXTRA_CAPITALS_1991.includes(c.n);
    return Boolean(c.cap);
  };
  const out: EraCity[] = [];
  for (const c of cities) {
    if ((FOUNDED[c.n] ?? 0) > year) continue;
    const historical = HISTORICAL_NAMES[c.n]?.[era];
    // A city renamed in this era, or a flashpoint of it, is shown early whatever its size.
    const notable = Boolean(historical) || Boolean(NOTABLE[c.n]?.includes(era));
    const pop = eraPopulation(c, era);
    const kind: CityKind = isCapital(c) ? "capital" : pop >= 400 ? "city" : c.adm1 ? "seat" : "town";
    // A name proclaimed in play wins over the era's.
    const name = cityNameIn(c, era, locale, renamed);
    out.push({ name, x: c.x, y: c.y, kind, minZoom: minZoomOf(kind, pop, notable), pop, priority: priorityOf(kind, pop, notable) });
  }
  return out;
}

/**
 * GeoNames' towns for the close-in map. Only today's population is known, so
 * on earlier dates a town counts as a fraction of it, like the cities do.
 */
export function eraTowns(towns: TownRecord[], era: ScenarioId, locale: Locale): EraCity[] {
  const scale = era === "2022" || era === "2014" ? 1 : era === "1991" ? 0.7 : era === "1939" ? 0.35 : 0.25;
  return towns.map(([n, x, y, today, seat, ru, uk]) => {
    const pop = today * scale;
    const kind: CityKind = seat ? "seat" : "town";
    // Seats show a step earlier than towns of their size.
    const minZoom = (today >= 100 ? 8 : today >= 50 ? 10 : today >= 25 ? 13 : 16) - (seat ? 1.5 : 0);
    const name = locale === "ru" ? ru || n : locale === "uk" ? uk || n : n;
    return { name, x, y, kind, minZoom, pop, priority: pop + (seat ? 20 : 0) };
  });
}

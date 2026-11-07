import { geoBounds, geoContains, geoDistance, type GeoPermissibleObjects } from "d3-geo";
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
  /** English name on the map files: the key the game state uses for towns. */
  key: string;
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
  "Saint Petersburg": { "1939": N("Leningrad", "Ленинград", "Ленінград"), "1991": N("Leningrad", "Ленинград", "Ленінград"), "1950": N("Leningrad", "Ленинград", "Ленінград"), "1964": N("Leningrad", "Ленинград", "Ленінград") },
  Volgograd: { "1914": N("Tsaritsyn", "Царицын", "Царицин"), "1939": N("Stalingrad", "Сталинград", "Сталінград"), "1950": N("Stalingrad", "Сталинград", "Сталінград") },
  Kaliningrad: { "1914": N("Königsberg", "Кёнигсберг", "Кенігсберг"), "1939": N("Königsberg", "Кёнигсберг", "Кенігсберг") },
  Gdańsk: { "1914": N("Danzig", "Данциг", "Данциг"), "1939": N("Danzig", "Данциг", "Данциг") },
  Szczecin: { "1914": N("Stettin", "Штеттин", "Штеттін"), "1939": N("Stettin", "Штеттин", "Штеттін") },
  Poznań: { "1914": N("Posen", "Позен", "Позен") },
  Klaipėda: { "1914": N("Memel", "Мемель", "Мемель"), "1939": N("Memel", "Мемель", "Мемель") },
  Lviv: { "1914": N("Lemberg", "Лемберг", "Лемберг"), "1939": N("Lwów", "Львов", "Львів") },
  "Ivano-Frankivsk": { "1914": N("Stanislau", "Станислав", "Станіслав"), "1939": N("Stanisławów", "Станиславов", "Станиславів"), "1950": N("Stanislav", "Станислав", "Станіслав"), "1964": N("Ivano-Frankovsk", "Ивано-Франковск", "Івано-Франківськ") },
  Chernivtsi: { "1914": N("Czernowitz", "Черновцы", "Чернівці"), "1939": N("Cernăuți", "Черновцы", "Чернівці") },
  Uzhhorod: { "1914": N("Ungvár", "Ужгород", "Ужгород"), "1939": N("Ungvár", "Ужгород", "Ужгород") },
  Vilnius: { "1914": N("Vilna", "Вильна", "Вільна"), "1939": N("Wilno", "Вильно", "Вільно") },
  Kaunas: { "1914": N("Kovno", "Ковно", "Ковно") },
  Tallinn: { "1914": N("Reval", "Ревель", "Ревель") },
  Tbilisi: { "1914": N("Tiflis", "Тифлис", "Тифліс") },
  Istanbul: { "1914": N("Constantinople", "Константинополь", "Константинополь") },
  İzmir: { "1914": N("Smyrna", "Смирна", "Смірна") },
  Oslo: { "1914": N("Kristiania", "Христиания", "Христианія") },
  Beijing: { "1914": N("Peking", "Пекин", "Пекін"), "1939": N("Peiping", "Бэйпин", "Бейпін"), "1950": N("Peking", "Пекин", "Пекін"), "1964": N("Peking", "Пекин", "Пекін") },
  Nanjing: { "1914": N("Nanking", "Нанкин", "Нанкін"), "1939": N("Nanking", "Нанкин", "Нанкін") },
  Guangzhou: { "1914": N("Canton", "Кантон", "Кантон"), "1939": N("Canton", "Кантон", "Кантон"), "1950": N("Canton", "Кантон", "Кантон"), "1964": N("Canton", "Кантон", "Кантон") },
  Shenyang: { "1914": N("Mukden", "Мукден", "Мукден"), "1939": N("Mukden", "Мукден", "Мукден") },
  Seoul: { "1914": N("Keijō", "Кэйдзё", "Кейдзьо"), "1939": N("Keijō", "Кэйдзё", "Кейдзьо") },
  Taipei: { "1914": N("Taihoku", "Тайхоку", "Тайхоку"), "1939": N("Taihoku", "Тайхоку", "Тайхоку") },
  "Ho Chi Minh City": { "1914": N("Saigon", "Сайгон", "Сайгон"), "1939": N("Saigon", "Сайгон", "Сайгон"), "1950": N("Saigon", "Сайгон", "Сайгон"), "1964": N("Saigon", "Сайгон", "Сайгон") },
  Yangon: { "1914": N("Rangoon", "Рангун", "Рангун"), "1939": N("Rangoon", "Рангун", "Рангун"), "1950": N("Rangoon", "Рангун", "Рангун"), "1964": N("Rangoon", "Рангун", "Рангун") },
  Mumbai: { "1914": N("Bombay", "Бомбей", "Бомбей"), "1939": N("Bombay", "Бомбей", "Бомбей"), "1991": N("Bombay", "Бомбей", "Бомбей"), "1950": N("Bombay", "Бомбей", "Бомбей"), "1964": N("Bombay", "Бомбей", "Бомбей") },
  Kolkata: { "1914": N("Calcutta", "Калькутта", "Калькутта"), "1939": N("Calcutta", "Калькутта", "Калькутта"), "1991": N("Calcutta", "Калькутта", "Калькутта"), "1950": N("Calcutta", "Калькутта", "Калькутта"), "1964": N("Calcutta", "Калькутта", "Калькутта"), "1999": N("Calcutta", "Калькутта", "Калькутта") },
  Chennai: { "1914": N("Madras", "Мадрас", "Мадрас"), "1939": N("Madras", "Мадрас", "Мадрас"), "1991": N("Madras", "Мадрас", "Мадрас"), "1950": N("Madras", "Мадрас", "Мадрас"), "1964": N("Madras", "Мадрас", "Мадрас") },
  Dhaka: { "1914": N("Dacca", "Дакка", "Дакка"), "1939": N("Dacca", "Дакка", "Дакка"), "1950": N("Dacca", "Дакка", "Дакка"), "1964": N("Dacca", "Дакка", "Дакка") },
  Jakarta: { "1914": N("Batavia", "Батавия", "Батавія"), "1939": N("Batavia", "Батавия", "Батавія"), "1950": N("Djakarta", "Джакарта", "Джакарта"), "1964": N("Djakarta", "Джакарта", "Джакарта") },
  Kinshasa: { "1914": N("Léopoldville", "Леопольдвиль", "Леопольдвіль"), "1939": N("Léopoldville", "Леопольдвиль", "Леопольдвіль"), "1950": N("Léopoldville", "Леопольдвиль", "Леопольдвіль"), "1964": N("Léopoldville", "Леопольдвиль", "Леопольдвіль") },
  Harare: { "1914": N("Salisbury", "Солсбери", "Солсбері"), "1939": N("Salisbury", "Солсбери", "Солсбері"), "1950": N("Salisbury", "Солсбери", "Солсбері"), "1964": N("Salisbury", "Солсбери", "Солсбері") },
  Maputo: { "1914": N("Lourenço Marques", "Лоренсу-Маркиш", "Лоренсу-Маркіш"), "1939": N("Lourenço Marques", "Лоренсу-Маркиш", "Лоренсу-Маркіш"), "1950": N("Lourenço Marques", "Лоренсу-Маркиш", "Лоренсу-Маркіш"), "1964": N("Lourenço Marques", "Лоренсу-Маркиш", "Лоренсу-Маркіш") },
  Yekaterinburg: { "1939": N("Sverdlovsk", "Свердловск", "Свердловськ"), "1991": N("Sverdlovsk", "Свердловск", "Свердловськ"), "1950": N("Sverdlovsk", "Свердловск", "Свердловськ"), "1964": N("Sverdlovsk", "Свердловск", "Свердловськ") },
  "Nizhny Novgorod": { "1939": N("Gorky", "Горький", "Горький"), "1991": N("Gorky", "Горький", "Горький"), "1950": N("Gorky", "Горький", "Горький"), "1964": N("Gorky", "Горький", "Горький") },
  Samara: { "1939": N("Kuybyshev", "Куйбышев", "Куйбишев"), "1991": N("Kuybyshev", "Куйбышев", "Куйбишев"), "1950": N("Kuybyshev", "Куйбышев", "Куйбишев"), "1964": N("Kuybyshev", "Куйбышев", "Куйбишев") },
  Novosibirsk: { "1914": N("Novonikolayevsk", "Новониколаевск", "Новомиколаївськ") },
  Kirov: { "1914": N("Vyatka", "Вятка", "Вятка") },
  Donetsk: { "1914": N("Yuzovka", "Юзовка", "Юзівка"), "1939": N("Stalino", "Сталино", "Сталіно"), "1950": N("Stalino", "Сталино", "Сталіно") },
  Dnipro: { "1914": N("Yekaterinoslav", "Екатеринослав", "Катеринослав"), "1939": N("Dnepropetrovsk", "Днепропетровск", "Дніпропетровськ"), "1991": N("Dnepropetrovsk", "Днепропетровск", "Дніпропетровськ"), "2014": N("Dnipropetrovsk", "Днепропетровск", "Дніпропетровськ"), "1950": N("Dnepropetrovsk", "Днепропетровск", "Дніпропетровськ"), "1964": N("Dnepropetrovsk", "Днепропетровск", "Дніпропетровськ"), "1999": N("Dnipropetrovsk", "Днепропетровск", "Дніпропетровськ") },
  Luhansk: { "1939": N("Voroshilovgrad", "Ворошиловград", "Ворошиловград"), "1950": N("Voroshilovgrad", "Ворошиловград", "Ворошиловград"), "1964": N("Lugansk", "Луганск", "Луганськ") },
  Zaporizhzhia: { "1914": N("Aleksandrovsk", "Александровск", "Олександрівськ") },
  Kropyvnytskyi: { "1914": N("Yelisavetgrad", "Елисаветград", "Єлисаветград"), "1939": N("Kirovo", "Кирово", "Кірове"), "1991": N("Kirovograd", "Кировоград", "Кіровоград"), "2014": N("Kirovohrad", "Кировоград", "Кіровоград"), "1950": N("Kirovograd", "Кировоград", "Кіровоград"), "1964": N("Kirovograd", "Кировоград", "Кіровоград"), "1999": N("Kirovohrad", "Кировоград", "Кіровоград") },
  Almaty: { "1914": N("Verny", "Верный", "Вірний"), "1939": N("Alma-Ata", "Алма-Ата", "Алма-Ата"), "1991": N("Alma-Ata", "Алма-Ата", "Алма-Ата"), "1950": N("Alma-Ata", "Алма-Ата", "Алма-Ата"), "1964": N("Alma-Ata", "Алма-Ата", "Алма-Ата") },
  Bishkek: { "1914": N("Pishpek", "Пишпек", "Пішпек"), "1939": N("Frunze", "Фрунзе", "Фрунзе"), "1950": N("Frunze", "Фрунзе", "Фрунзе"), "1964": N("Frunze", "Фрунзе", "Фрунзе") },
  Dushanbe: { "1939": N("Stalinabad", "Сталинабад", "Сталінабад"), "1950": N("Stalinabad", "Сталинабад", "Сталінабад") },
  Bratislava: { "1914": N("Pressburg", "Пресбург", "Пресбург") },
  Ljubljana: { "1914": N("Laibach", "Лайбах", "Лайбах") },
  Zagreb: { "1914": N("Agram", "Аграм", "Аграм") },
  Ankara: { "1914": N("Angora", "Ангора", "Ангора") },
  Tver: { "1950": N("Kalinin", "Калинин", "Калінін"), "1964": N("Kalinin", "Калинин", "Калінін") },
  Perm: { "1950": N("Molotov", "Молотов", "Молотов") },
  Vladikavkaz: { "1950": N("Dzaudzhikau", "Дзауджикау", "Дзауджикау"), "1957": N("Ordzhonikidze", "Орджоникидзе", "Орджонікідзе"), "1964": N("Ordzhonikidze", "Орджоникидзе", "Орджонікідзе") },
  Mariupol: { "1950": N("Zhdanov", "Жданов", "Жданов"), "1964": N("Zhdanov", "Жданов", "Жданов") },
  Varna: { "1950": N("Stalin", "Сталин", "Сталін") },
  Gyumri: { "1950": N("Leninakan", "Ленинакан", "Ленінакан"), "1964": N("Leninakan", "Ленинакан", "Ленінакан") },
  "Chișinău": { "1950": N("Kishinev", "Кишинёв", "Кишинів"), "1964": N("Kishinev", "Кишинёв", "Кишинів") },
  "Nur-Sultan": { "1950": N("Akmolinsk", "Акмолинск", "Акмолінськ"), "1964": N("Tselinograd", "Целиноград", "Целіноград"), "1999": N("Astana", "Астана", "Астана") },
  Podgorica: { "1950": N("Titograd", "Титоград", "Тітоград"), "1964": N("Titograd", "Титоград", "Тітоград") },
  Kisangani: { "1950": N("Stanleyville", "Стэнливиль", "Стенлівіль"), "1964": N("Stanleyville", "Стэнливиль", "Стенлівіль") },
  Lubumbashi: { "1950": N("Élisabethville", "Элизабетвиль", "Елізабетвіль"), "1964": N("Élisabethville", "Элизабетвиль", "Елізабетвіль") },
  Salekhard: { "1914": N("Obdorsk", "Обдорск", "Обдорськ") },
};

/**
 * The names of 1933, 1973 and 1979 where they differ from the date they
 * borrow the rest from (FALLBACK): today's name where the city had not yet
 * been renamed, or had been renamed back.
 */
const LATER_NAMES: Record<string, Partial<Record<ScenarioId, Names>>> = {
  Samara: { "1933": N("Samara", "Самара", "Самара") },
  Luhansk: { "1933": N("Lugansk", "Луганск", "Луганськ"), "1973": N("Voroshilovgrad", "Ворошиловград", "Ворошиловград"), "1979": N("Voroshilovgrad", "Ворошиловград", "Ворошиловград") },
  Kropyvnytskyi: { "1933": N("Zinovyevsk", "Зиновьевск", "Зінов'євськ") },
  Klaipėda: { "1933": N("Klaipėda", "Клайпеда", "Клайпеда") },
  Uzhhorod: { "1933": N("Užhorod", "Ужгород", "Ужгород") },
  Kirov: { "1933": N("Vyatka", "Вятка", "Вятка") },
  Tbilisi: { "1933": N("Tiflis", "Тифлис", "Тифліс") },
  Vladikavkaz: { "1933": N("Ordzhonikidze", "Орджоникидзе", "Орджонікідзе") },
  Jakarta: { "1973": N("Jakarta", "Джакарта", "Джакарта"), "1979": N("Jakarta", "Джакарта", "Джакарта") },
  Kinshasa: { "1973": N("Kinshasa", "Киншаса", "Кіншаса"), "1979": N("Kinshasa", "Киншаса", "Кіншаса") },
  Kisangani: { "1973": N("Kisangani", "Кисангани", "Кісангані"), "1979": N("Kisangani", "Кисангани", "Кісангані") },
  Lubumbashi: { "1973": N("Lubumbashi", "Лубумбаши", "Лубумбаші"), "1979": N("Lubumbashi", "Лубумбаши", "Лубумбаші") },
  Maputo: { "1979": N("Maputo", "Мапуту", "Мапуту") },
  "Ho Chi Minh City": { "1979": N("Ho Chi Minh City", "Хошимин", "Хошимін") },
  Beijing: { "1979": N("Beijing", "Пекин", "Пекін") },
  Guangzhou: { "1979": N("Guangzhou", "Гуанчжоу", "Гуанчжоу") },
};

/** The date whose names a date has where it has none of its own: Stalingrad, Stanislav and Akmolinsk were renamed after 1957; 1933 is 1939 but a few, 1973 and 1979 are 1964 but a few. */
const FALLBACK: Partial<Record<ScenarioId, ScenarioId>> = { "1933": "1939", "1957": "1950", "1973": "1964", "1979": "1964" };

/** A city's name of a date. */
function historicalName(city: string, era: ScenarioId): Names | undefined {
  const later = LATER_NAMES[city]?.[era];
  if (later) return later.en === city ? undefined : later;
  const names = HISTORICAL_NAMES[city];
  const fallback = FALLBACK[era];
  return names?.[era] ?? (fallback ? names?.[fallback] : undefined);
}

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
  // The gas towns of the Yamal north, built from nothing.
  "Novy Urengoy": 1975,
  Noyabrsk: 1976,
  Nadym: 1972,
};

/**
 * People where Natural Earth's series is wrong or missing, thousands: the
 * censuses of 1989 and 2021 (Novy Urengoy is the Yamal-Nenets okrug's
 * largest city, Noyabrsk second).
 */
const CENSUS: Record<string, Partial<Pick<CityRecord, "p50" | "p90" | "p20">>> = {
  "Novy Urengoy": { p90: 94, p20: 108 },
  Noyabrsk: { p90: 86, p20: 107 },
};

/** Places that matter on a start date whatever their size: flashpoints of the scenario. */
const NOTABLE: Record<string, ScenarioId[]> = {
  Sarajevo: ["1914", "1999"],
  Sevastopol: ["1914", "1933", "1939", "1950", "1957", "1964", "1973", "1979", "1991", "1999", "2014", "2022"],
  Algiers: ["1957"],
  Damascus: ["1957", "1973"],
  Qinhuangdao: ["1933"],
  Saarbrücken: ["1933"],
  Gdańsk: ["1933", "1991", "2022"],
  Leticia: ["1933"],
  Suez: ["1973"],
  Ismailia: ["1973"],
  Quneitra: ["1973"],
  "Tel Aviv": ["1973"],
  "Phnom Penh": ["1973", "1979"],
  Herat: ["1979"],
  Kandahar: ["1979"],
  Tehran: ["1979"],
  Busan: ["1950"],
  Incheon: ["1950"],
  Daegu: ["1950"],
  "Da Nang": ["1964"],
  Huế: ["1964"],
  Vinh: ["1964"],
  Haiphong: ["1964"],
  Pristina: ["1999"],
  Podgorica: ["1999"],
  Tetovo: ["1999"],
  Shkodër: ["1999"],
  Simferopol: ["2014"],
  Donetsk: ["2014"],
  Luhansk: ["2014"],
  Narvik: ["1939"],
  Tobruk: ["1939"],
  Kaunas: ["1939"],
  Lviv: ["1991", "2014", "2022"],
  Kharkiv: ["1914", "1939", "1991", "2014", "2022"],
};

const START_YEAR: Record<ScenarioId, number> = {
  "1914": 1914, "1933": 1933, "1939": 1939, "1950": 1950, "1957": 1957, "1964": 1964, "1973": 1973, "1979": 1979, "1991": 1991, "1999": 1999, "2014": 2014, "2022": 2022,
};

/** National capitals on each start date (Natural Earth names); 1973 and later use today's, corrected. */
const CAPITALS: Partial<Record<ScenarioId, string[]>> = {
  // January 1933: Nanjing is the Nationalists' capital, Changchun (Hsinking) Manchukuo's, Kaunas Lithuania's; Vienna, Prague, Tirana and Addis Ababa stand.
  "1933": [
    "London", "Paris", "Berlin", "Moscow", "Rome", "Warsaw", "Prague", "Vienna", "Tokyo", "Washington", "Nanjing", "Changchun", "Madrid",
    "Budapest", "Bucharest", "Helsinki", "Ankara", "Belgrade", "Athens", "Tirana", "Amsterdam", "Brussels", "Stockholm", "Oslo", "Copenhagen",
    "Bern", "Lisbon", "Kaunas", "Riga", "Tallinn", "Sofia", "Dublin", "Ottawa", "Canberra", "Pretoria", "Wellington", "Rio de Janeiro",
    "Buenos Aires", "Mexico City", "Ulaanbaatar", "Tehran", "Baghdad", "Cairo", "Riyadh", "Sanaa", "Bangkok", "Kabul", "Addis Ababa",
    "Luxembourg", "Havana", "Lima", "Santiago", "Bogotá", "Caracas", "Montevideo", "Asunción", "Quito", "Monrovia",
  ],
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
  // Bonn, the Federal Republic's capital, is not among the map's cities; Berlin stands for the GDR's.
  "1950": [
    "London", "Paris", "Berlin", "Moscow", "Rome", "Warsaw", "Prague", "Budapest", "Bucharest", "Sofia", "Belgrade", "Tirana", "Athens",
    "Ankara", "Vienna", "Bern", "Brussels", "Amsterdam", "Luxembourg", "Copenhagen", "Oslo", "Stockholm", "Helsinki", "Reykjavík", "Dublin",
    "Lisbon", "Madrid", "Washington", "Ottawa", "Mexico City", "Havana", "Guatemala City", "San Salvador", "Tegucigalpa", "Managua",
    "San José", "Panama City", "Bogotá", "Caracas", "Quito", "Lima", "La Paz", "Santiago", "Buenos Aires", "Montevideo", "Asunción",
    "Rio de Janeiro", "Port-au-Prince", "Santo Domingo", "Tokyo", "Seoul", "Pyongyang", "Beijing", "Taipei", "Ulaanbaatar", "Lhasa",
    "Ho Chi Minh City", "Phnom Penh", "Vientiane", "Bangkok", "Yangon", "New Delhi", "Karachi", "Colombo", "Kathmandu", "Kabul", "Tehran",
    "Baghdad", "Damascus", "Beirut", "Amman", "Jerusalem", "Riyadh", "Sanaa", "Cairo", "Addis Ababa", "Monrovia", "Pretoria", "Canberra",
    "Wellington", "Manila", "Jakarta",
  ],
  // October 1957: Tunis, Rabat, Khartoum, Tripoli, Accra and Kuala Lumpur newly sovereign, Hanoi the North's; Lhasa is China's.
  "1957": [
    "London", "Paris", "Berlin", "Moscow", "Rome", "Warsaw", "Prague", "Budapest", "Bucharest", "Sofia", "Belgrade", "Tirana", "Athens",
    "Ankara", "Vienna", "Bern", "Brussels", "Amsterdam", "Luxembourg", "Copenhagen", "Oslo", "Stockholm", "Helsinki", "Reykjavík", "Dublin",
    "Lisbon", "Madrid", "Washington", "Ottawa", "Mexico City", "Havana", "Guatemala City", "San Salvador", "Tegucigalpa", "Managua",
    "San José", "Panama City", "Bogotá", "Caracas", "Quito", "Lima", "La Paz", "Santiago", "Buenos Aires", "Montevideo", "Asunción",
    "Rio de Janeiro", "Port-au-Prince", "Santo Domingo", "Tokyo", "Seoul", "Pyongyang", "Beijing", "Taipei", "Ulaanbaatar", "Hanoi",
    "Ho Chi Minh City", "Phnom Penh", "Vientiane", "Bangkok", "Yangon", "Kuala Lumpur", "Jakarta", "Manila", "New Delhi", "Karachi",
    "Colombo", "Kathmandu", "Kabul", "Tehran", "Baghdad", "Damascus", "Beirut", "Amman", "Jerusalem", "Riyadh", "Sanaa", "Cairo",
    "Khartoum", "Tripoli", "Tunis", "Rabat", "Accra", "Addis Ababa", "Monrovia", "Pretoria", "Canberra", "Wellington",
  ],
  "1964": [
    "London", "Paris", "Berlin", "Moscow", "Rome", "Warsaw", "Prague", "Budapest", "Bucharest", "Sofia", "Belgrade", "Tirana", "Athens",
    "Ankara", "Vienna", "Bern", "Brussels", "Amsterdam", "Luxembourg", "Copenhagen", "Oslo", "Stockholm", "Helsinki", "Reykjavík", "Dublin",
    "Lisbon", "Madrid", "Nicosia", "Washington", "Ottawa", "Mexico City", "Havana", "Guatemala City", "San Salvador", "Tegucigalpa",
    "Managua", "San José", "Panama City", "Bogotá", "Caracas", "Quito", "Lima", "La Paz", "Santiago", "Buenos Aires", "Montevideo",
    "Asunción", "Brasília", "Port-au-Prince", "Santo Domingo", "Kingston", "Port of Spain", "Tokyo", "Seoul", "Pyongyang", "Beijing",
    "Taipei", "Ulaanbaatar", "Hanoi", "Ho Chi Minh City", "Phnom Penh", "Vientiane", "Bangkok", "Yangon", "Kuala Lumpur", "Jakarta",
    "Manila", "New Delhi", "Rawalpindi", "Colombo", "Kathmandu", "Kabul", "Tehran", "Baghdad", "Damascus", "Beirut", "Amman", "Jerusalem",
    "Riyadh", "Sanaa", "Kuwait City", "Cairo", "Khartoum", "Tripoli", "Tunis", "Algiers", "Rabat", "Nouakchott", "Dakar", "Bamako",
    "Conakry", "Freetown", "Monrovia", "Abidjan", "Ouagadougou", "Niamey", "Accra", "Lomé", "Cotonou", "Lagos", "Yaoundé", "N'Djamena",
    "Bangui", "Libreville", "Brazzaville", "Kinshasa", "Kigali", "Bujumbura", "Kampala", "Nairobi", "Dar es Salaam", "Mogadishu",
    "Addis Ababa", "Zomba", "Antananarivo", "Pretoria", "Canberra", "Wellington", "Apia",
  ],
};

/** On the dates that use today's capitals: the countries whose capital was not yet a national one, and the capitals of the day instead. */
const TODAY_CAPITALS: Partial<Record<ScenarioId, { not: Set<string>; extra: string[] }>> = {
  // October 1973: the Soviet and Yugoslav republics, Portugal's colonies, Namibia and the last British islands not yet sovereign; Saigon and Aden capitals.
  "1973": {
    not: new Set([
      "UKR", "BLR", "LTU", "LVA", "EST", "MDA", "GEO", "ARM", "AZE", "KAZ", "UZB", "TKM", "KGZ", "TJK",
      "SVN", "HRV", "BIH", "MKD", "MNE", "KOS", "SVK", "ERI", "SDS", "TLS", "NAM", "AGO", "MOZ", "GNB", "CPV", "STP", "COM", "DJI",
      "SUR", "PNG", "SLB", "VUT", "KIR", "TUV", "SYC", "DMA", "LCA", "VCT", "ATG", "KNA", "BLZ", "BRN", "GRD", "PSX",
      "NGA", "MMR", "TZA", "CIV", "MWI", "LKA",
    ]),
    extra: ["Lagos", "Yangon", "Dar es Salaam", "Abidjan", "Zomba", "Colombo", "Ho Chi Minh City", "Aden"],
  },
  // December 1979: Portugal's colonies, the Comoros, Djibouti, Suriname and Papua New Guinea free; Saigon no longer a capital.
  "1979": {
    not: new Set([
      "UKR", "BLR", "LTU", "LVA", "EST", "MDA", "GEO", "ARM", "AZE", "KAZ", "UZB", "TKM", "KGZ", "TJK",
      "SVN", "HRV", "BIH", "MKD", "MNE", "KOS", "SVK", "ERI", "SDS", "TLS", "NAM", "VUT", "ATG", "KNA", "BLZ", "BRN", "PSX",
      "NGA", "MMR", "TZA", "CIV", "LKA",
    ]),
    extra: ["Lagos", "Yangon", "Dar es Salaam", "Abidjan", "Colombo", "Aden"],
  },
  "1991": {
    not: new Set([
      "UKR", "BLR", "LTU", "LVA", "EST", "MDA", "GEO", "ARM", "AZE", "KAZ", "UZB", "TKM", "KGZ", "TJK",
      "SVN", "HRV", "BIH", "MKD", "MNE", "SVK", "ERI", "SDS", "KOS", "TLS", "NGA", "MMR", "TZA",
    ]),
    extra: ["Lagos", "Yangon", "Dar es Salaam"],
  },
  "1999": { not: new Set(["MNE", "KOS", "SDS", "TLS", "SOL", "MMR"]), extra: ["Yangon"] },
};

/** Population on the start date in thousands: the series where it exists, between its years where the date falls between them, else today's scaled back. */
function eraPopulation(record: CityRecord, era: ScenarioId): number {
  const c = CENSUS[record.n] ? { ...record, ...CENSUS[record.n] } : record;
  if (era === "2022" || era === "2014") return c.p20;
  if (era === "1999") return c.p90 && c.p20 ? c.p90 * (c.p20 / c.p90) ** 0.3 : c.p20 * 0.85;
  if (era === "1991") return c.p90 || c.p20 * 0.65;
  // 1973 and 1979 lie between the series' 1950 and 1990, by their years.
  if (era === "1979") return c.p50 && c.p90 ? c.p50 * (c.p90 / c.p50) ** 0.725 : c.p90 ? c.p90 * 0.85 : c.p20 * 0.55;
  if (era === "1973") return c.p50 && c.p90 ? c.p50 * (c.p90 / c.p50) ** 0.575 : c.p90 ? c.p90 * 0.75 : c.p20 * 0.5;
  if (era === "1933") return c.p50 ? c.p50 * 0.72 : c.p20 * 0.27;
  if (era === "1964") return c.p50 && c.p90 ? c.p50 * (c.p90 / c.p50) ** 0.35 : c.p90 ? c.p90 * 0.6 : c.p20 * 0.4;
  if (era === "1957") return c.p50 && c.p90 ? c.p50 * (c.p90 / c.p50) ** 0.17 : c.p50 || c.p20 * 0.35;
  if (era === "1950") return c.p50 || c.p20 * 0.3;
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
  const historical = historicalName(c.n, era);
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
    const today = TODAY_CAPITALS[era];
    if (today) return (Boolean(c.cap) && !today.not.has(c.a)) || today.extra.includes(c.n);
    return Boolean(c.cap);
  };
  const out: EraCity[] = [];
  for (const c of cities) {
    if ((FOUNDED[c.n] ?? 0) > year) continue;
    const historical = historicalName(c.n, era);
    // A city renamed in this era, or a flashpoint of it, is shown early whatever its size.
    const notable = Boolean(historical) || Boolean(NOTABLE[c.n]?.includes(era));
    const pop = eraPopulation(c, era);
    const kind: CityKind = isCapital(c) ? "capital" : pop >= 400 ? "city" : c.adm1 ? "seat" : "town";
    // A name proclaimed in play wins over the era's.
    const name = cityNameIn(c, era, locale, renamed);
    out.push({ name, key: c.n, x: c.x, y: c.y, kind, minZoom: minZoomOf(kind, pop, notable), pop, priority: priorityOf(kind, pop, notable) });
  }
  return out;
}

/**
 * GeoNames' towns for the close-in map. Only today's population is known, so
 * on earlier dates a town counts as a fraction of it, like the cities do.
 */
/** What a town of today counted on each date. */
const TOWN_SCALE: Record<ScenarioId, number> = { "1914": 0.25, "1933": 0.32, "1939": 0.35, "1950": 0.38, "1957": 0.44, "1964": 0.5, "1973": 0.58, "1979": 0.63, "1991": 0.7, "1999": 0.8, "2014": 1, "2022": 1 };

export function eraTowns(towns: TownRecord[], era: ScenarioId, locale: Locale): EraCity[] {
  const scale = TOWN_SCALE[era];
  return towns.map(([n, x, y, today, seat, ru, uk]) => {
    const pop = today * scale;
    const kind: CityKind = seat ? "seat" : "town";
    // Seats show a step earlier than towns of their size; by 12× every town may show.
    const minZoom = (today >= 100 ? 7 : today >= 50 ? 8.5 : today >= 25 ? 10 : 12) - (seat ? 1 : 0);
    const name = locale === "ru" ? ru || n : locale === "uk" ? uk || n : n;
    return { name, key: n, x, y, kind, minZoom, pop, priority: pop + (seat ? 20 : 0) };
  });
}

/**
 * The biggest city standing in a province on the start date: the era's
 * cities inside its outline, by their people then, with the name it had (or
 * was given in play). None when no city of cities.json stands there.
 */
export function largestCityIn(cities: CityRecord[], outline: GeoPermissibleObjects, era: ScenarioId, locale: Locale, renamed: Record<string, Localized> = {}): EraCity | undefined {
  const [[w, s], [e, n]] = geoBounds(outline);
  // A province across the antimeridian wraps round.
  const across = w > e;
  let best: EraCity | undefined;
  for (const c of eraCities(cities, era, locale, renamed)) {
    if (c.y < s || c.y > n || (across ? c.x < w && c.x > e : c.x < w || c.x > e)) continue;
    if ((!best || c.pop > best.pop) && geoContains(outline, [c.x, c.y])) best = c;
  }
  return best;
}

/** A city the map file names, in the locale and as it was called on the date: the one of that name nearest the province. */
export function cityNamed(cities: CityRecord[], name: string, near: [number, number], era: ScenarioId, locale: Locale, renamed: Record<string, Localized> = {}): string {
  let best: CityRecord | undefined;
  let gap = Infinity;
  for (const c of cities) {
    if (c.n !== name) continue;
    const d = geoDistance([c.x, c.y], near);
    if (d < gap) [best, gap] = [c, d];
  }
  // Farther than about 600 km it is another place of the same name.
  return best && gap < 0.1 ? cityNameIn(best, era, locale, renamed) : name;
}

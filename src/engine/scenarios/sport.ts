import type { GamesKind, Localized } from "../types";

/**
 * The Olympic Games and the World Cup as history held them (engine/sport.ts):
 * each Games with its opening day and the hosts it had in turn – the day each
 * was chosen and, where one gave the Games up, the day it did (Tokyo and
 * Sapporo in 1938, Denver in 1972, Colombia in 1982) – and, for the Games the
 * game may begin after, who led the medal table or won the Cup. The Games
 * the world wars cancelled (1916, 1940, 1944) are marked only so that a
 * save's last Games are found: the engine cancels Games by the wars of the
 * game, not by history's.
 * History's boycotts and bans are anchors the historical mode follows while
 * their causes hold.
 */

const L = (en: string, ru: string, uk: string): Localized => ({ en, ru, uk });

/** A host history chose, and the day it gave the Games up, if it did. */
export interface Tenure {
  hosts: string[];
  city?: Localized;
  awarded: string;
  withdrew?: string;
}

export interface HistoryGames {
  kind: GamesKind;
  year: number;
  opens: string;
  tenures: Tenure[];
  /** Who led the medal table (most golds) or won the Cup: only for Games a start date comes after. */
  champion?: string;
  /** History cancelled them (a world war): never the last Games before a start. */
  cancelled?: true;
}

const C = {
  stockholm: L("Stockholm", "Стокгольм", "Стокгольм"),
  berlin: L("Berlin", "Берлин", "Берлін"),
  antwerp: L("Antwerp", "Антверпен", "Антверпен"),
  paris: L("Paris", "Париж", "Париж"),
  amsterdam: L("Amsterdam", "Амстердам", "Амстердам"),
  losAngeles: L("Los Angeles", "Лос-Анджелес", "Лос-Анджелес"),
  tokyo: L("Tokyo", "Токио", "Токіо"),
  helsinki: L("Helsinki", "Хельсинки", "Гельсінкі"),
  london: L("London", "Лондон", "Лондон"),
  melbourne: L("Melbourne", "Мельбурн", "Мельбурн"),
  rome: L("Rome", "Рим", "Рим"),
  mexico: L("Mexico City", "Мехико", "Мехіко"),
  munich: L("Munich", "Мюнхен", "Мюнхен"),
  montreal: L("Montreal", "Монреаль", "Монреаль"),
  moscow: L("Moscow", "Москва", "Москва"),
  seoul: L("Seoul", "Сеул", "Сеул"),
  barcelona: L("Barcelona", "Барселона", "Барселона"),
  atlanta: L("Atlanta", "Атланта", "Атланта"),
  sydney: L("Sydney", "Сидней", "Сідней"),
  athens: L("Athens", "Афины", "Афіни"),
  beijing: L("Beijing", "Пекин", "Пекін"),
  rio: L("Rio de Janeiro", "Рио-де-Жанейро", "Ріо-де-Жанейро"),
  brisbane: L("Brisbane", "Брисбен", "Брисбен"),
  chamonix: L("Chamonix", "Шамони", "Шамоні"),
  stMoritz: L("St. Moritz", "Санкт-Мориц", "Санкт-Моріц"),
  lakePlacid: L("Lake Placid", "Лейк-Плэсид", "Лейк-Плесід"),
  garmisch: L("Garmisch-Partenkirchen", "Гармиш-Партенкирхен", "Гарміш-Партенкірхен"),
  sapporo: L("Sapporo", "Саппоро", "Саппоро"),
  cortina: L("Cortina d’Ampezzo", "Кортина-д’Ампеццо", "Кортіна-д’Ампеццо"),
  oslo: L("Oslo", "Осло", "Осло"),
  squaw: L("Squaw Valley", "Скво-Вэлли", "Скво-Веллі"),
  innsbruck: L("Innsbruck", "Инсбрук", "Інсбрук"),
  grenoble: L("Grenoble", "Гренобль", "Гренобль"),
  denver: L("Denver", "Денвер", "Денвер"),
  sarajevo: L("Sarajevo", "Сараево", "Сараєво"),
  calgary: L("Calgary", "Калгари", "Калгарі"),
  albertville: L("Albertville", "Альбервиль", "Альбервіль"),
  lillehammer: L("Lillehammer", "Лиллехаммер", "Ліллегаммер"),
  nagano: L("Nagano", "Нагано", "Нагано"),
  saltLake: L("Salt Lake City", "Солт-Лейк-Сити", "Солт-Лейк-Сіті"),
  turin: L("Turin", "Турин", "Турин"),
  vancouver: L("Vancouver", "Ванкувер", "Ванкувер"),
  sochi: L("Sochi", "Сочи", "Сочі"),
  pyeongchang: L("Pyeongchang", "Пхёнчхан", "Пхьончхан"),
  milan: L("Milan–Cortina", "Милан–Кортина", "Мілан–Кортіна"),
  alps: L("the French Alps", "Французские Альпы", "Французькі Альпи"),
};

const one = (hosts: string | string[], awarded: string, city?: Localized, withdrew?: string): Tenure => ({ hosts: typeof hosts === "string" ? [hosts] : hosts, awarded, ...(city ? { city } : {}), ...(withdrew ? { withdrew } : {}) });

export const HISTORY_GAMES: HistoryGames[] = [
  // The Summer Games.
  { kind: "summer", year: 1912, opens: "1912-07-06", tenures: [one("sweden", "1909-05-28", C.stockholm)], champion: "usa" },
  { kind: "summer", year: 1916, opens: "1916-07-01", tenures: [one("germany", "1912-07-04", C.berlin)], cancelled: true },
  { kind: "summer", year: 1920, opens: "1920-08-14", tenures: [one("belgium", "1919-04-05", C.antwerp)] },
  { kind: "summer", year: 1924, opens: "1924-07-05", tenures: [one("france", "1921-06-02", C.paris)] },
  { kind: "summer", year: 1928, opens: "1928-07-28", tenures: [one("netherlands", "1921-06-02", C.amsterdam)] },
  { kind: "summer", year: 1932, opens: "1932-07-30", tenures: [one("usa", "1923-04-09", C.losAngeles)] },
  { kind: "summer", year: 1936, opens: "1936-08-01", tenures: [one("germany", "1931-04-26", C.berlin)], champion: "germany" },
  { kind: "summer", year: 1940, opens: "1940-07-20", tenures: [one("japan", "1936-07-31", C.tokyo, "1938-07-16"), one("finland", "1938-07-20", C.helsinki)], cancelled: true },
  { kind: "summer", year: 1944, opens: "1944-07-01", tenures: [one("uk", "1939-06-09", C.london)], cancelled: true },
  { kind: "summer", year: 1948, opens: "1948-07-29", tenures: [one("uk", "1946-03-01", C.london)], champion: "usa" },
  { kind: "summer", year: 1952, opens: "1952-07-19", tenures: [one("finland", "1947-06-21", C.helsinki)] },
  { kind: "summer", year: 1956, opens: "1956-11-22", tenures: [one("australia", "1949-04-28", C.melbourne)], champion: "ussr" },
  { kind: "summer", year: 1960, opens: "1960-08-25", tenures: [one("italy", "1955-06-15", C.rome)], champion: "ussr" },
  { kind: "summer", year: 1964, opens: "1964-10-10", tenures: [one("japan", "1959-05-26", C.tokyo)] },
  { kind: "summer", year: 1968, opens: "1968-10-12", tenures: [one("mexico", "1963-10-18", C.mexico)] },
  { kind: "summer", year: 1972, opens: "1972-08-26", tenures: [one("west-germany", "1966-04-26", C.munich)] },
  { kind: "summer", year: 1976, opens: "1976-07-17", tenures: [one("canada", "1970-05-12", C.montreal)] },
  { kind: "summer", year: 1980, opens: "1980-07-19", tenures: [one("ussr", "1974-10-23", C.moscow)] },
  { kind: "summer", year: 1984, opens: "1984-07-28", tenures: [one("usa", "1978-05-18", C.losAngeles)] },
  { kind: "summer", year: 1988, opens: "1988-09-17", tenures: [one("south-korea", "1981-09-30", C.seoul)], champion: "ussr" },
  { kind: "summer", year: 1992, opens: "1992-07-25", tenures: [one("spain", "1986-10-17", C.barcelona)] },
  { kind: "summer", year: 1996, opens: "1996-07-19", tenures: [one("usa", "1990-09-18", C.atlanta)], champion: "usa" },
  { kind: "summer", year: 2000, opens: "2000-09-15", tenures: [one("australia", "1993-09-23", C.sydney)] },
  { kind: "summer", year: 2004, opens: "2004-08-13", tenures: [one("greece", "1997-09-05", C.athens)] },
  { kind: "summer", year: 2008, opens: "2008-08-08", tenures: [one("china", "2001-07-13", C.beijing)] },
  { kind: "summer", year: 2012, opens: "2012-07-27", tenures: [one("uk", "2005-07-06", C.london)], champion: "usa" },
  { kind: "summer", year: 2016, opens: "2016-08-05", tenures: [one("brazil", "2009-10-02", C.rio)] },
  // Tokyo's Games were put off to 2021 by the pandemic, which the game does not have.
  { kind: "summer", year: 2020, opens: "2020-07-24", tenures: [one("japan", "2013-09-07", C.tokyo)], champion: "usa" },
  { kind: "summer", year: 2024, opens: "2024-07-26", tenures: [one("france", "2017-09-13", C.paris)] },
  { kind: "summer", year: 2028, opens: "2028-07-14", tenures: [one("usa", "2017-09-13", C.losAngeles)] },
  { kind: "summer", year: 2032, opens: "2032-07-23", tenures: [one("australia", "2021-07-21", C.brisbane)] },

  // The Winter Games.
  { kind: "winter", year: 1924, opens: "1924-01-25", tenures: [one("france", "1921-06-02", C.chamonix)] },
  { kind: "winter", year: 1928, opens: "1928-02-11", tenures: [one("switzerland", "1926-05-06", C.stMoritz)] },
  { kind: "winter", year: 1932, opens: "1932-02-04", tenures: [one("usa", "1929-04-10", C.lakePlacid)] },
  { kind: "winter", year: 1936, opens: "1936-02-06", tenures: [one("germany", "1933-06-07", C.garmisch)], champion: "norway" },
  {
    kind: "winter",
    year: 1940,
    opens: "1940-02-02",
    tenures: [one("japan", "1937-06-09", C.sapporo, "1938-07-16"), one("switzerland", "1938-07-20", C.stMoritz, "1939-06-01"), one("germany", "1939-06-09", C.garmisch)],
    cancelled: true,
  },
  { kind: "winter", year: 1944, opens: "1944-02-01", tenures: [one("italy", "1939-06-09", C.cortina)], cancelled: true },
  { kind: "winter", year: 1948, opens: "1948-01-30", tenures: [one("switzerland", "1946-09-04", C.stMoritz)], champion: "norway" },
  { kind: "winter", year: 1952, opens: "1952-02-14", tenures: [one("norway", "1947-06-21", C.oslo)] },
  { kind: "winter", year: 1956, opens: "1956-01-26", tenures: [one("italy", "1949-04-28", C.cortina)], champion: "ussr" },
  { kind: "winter", year: 1960, opens: "1960-02-18", tenures: [one("usa", "1955-06-15", C.squaw)] },
  { kind: "winter", year: 1964, opens: "1964-01-29", tenures: [one("austria", "1959-05-26", C.innsbruck)], champion: "ussr" },
  { kind: "winter", year: 1968, opens: "1968-02-06", tenures: [one("france", "1964-01-28", C.grenoble)] },
  { kind: "winter", year: 1972, opens: "1972-02-03", tenures: [one("japan", "1966-04-26", C.sapporo)] },
  { kind: "winter", year: 1976, opens: "1976-02-04", tenures: [one("usa", "1970-05-12", C.denver, "1972-11-15"), one("austria", "1973-02-05", C.innsbruck)] },
  { kind: "winter", year: 1980, opens: "1980-02-13", tenures: [one("usa", "1974-10-23", C.lakePlacid)] },
  { kind: "winter", year: 1984, opens: "1984-02-08", tenures: [one("yugoslavia", "1978-05-18", C.sarajevo)] },
  { kind: "winter", year: 1988, opens: "1988-02-13", tenures: [one("canada", "1981-09-30", C.calgary)], champion: "ussr" },
  { kind: "winter", year: 1992, opens: "1992-02-08", tenures: [one("france", "1986-10-17", C.albertville)] },
  { kind: "winter", year: 1994, opens: "1994-02-12", tenures: [one("norway", "1988-09-15", C.lillehammer)] },
  { kind: "winter", year: 1998, opens: "1998-02-07", tenures: [one("japan", "1991-06-15", C.nagano)], champion: "germany" },
  { kind: "winter", year: 2002, opens: "2002-02-08", tenures: [one("usa", "1995-06-16", C.saltLake)] },
  { kind: "winter", year: 2006, opens: "2006-02-10", tenures: [one("italy", "1999-06-19", C.turin)] },
  { kind: "winter", year: 2010, opens: "2010-02-12", tenures: [one("canada", "2003-07-02", C.vancouver)], champion: "canada" },
  { kind: "winter", year: 2014, opens: "2014-02-07", tenures: [one("russia", "2007-07-04", C.sochi)] },
  { kind: "winter", year: 2018, opens: "2018-02-09", tenures: [one("south-korea", "2011-07-06", C.pyeongchang)] },
  { kind: "winter", year: 2022, opens: "2022-02-04", tenures: [one("china", "2015-07-31", C.beijing)], champion: "norway" },
  { kind: "winter", year: 2026, opens: "2026-02-06", tenures: [one("italy", "2019-06-24", C.milan)] },
  { kind: "winter", year: 2030, opens: "2030-02-01", tenures: [one("france", "2024-07-24", C.alps)] },
  { kind: "winter", year: 2034, opens: "2034-02-10", tenures: [one("usa", "2024-07-24", C.saltLake)] },

  // The World Cup.
  { kind: "cup", year: 1930, opens: "1930-07-13", tenures: [one("uruguay", "1929-05-18")] },
  { kind: "cup", year: 1934, opens: "1934-05-27", tenures: [one("italy", "1932-10-09")] },
  { kind: "cup", year: 1938, opens: "1938-06-04", tenures: [one("france", "1936-08-13")], champion: "italy" },
  { kind: "cup", year: 1950, opens: "1950-06-24", tenures: [one("brazil", "1946-07-26")] },
  { kind: "cup", year: 1954, opens: "1954-06-16", tenures: [one("switzerland", "1946-07-26")], champion: "west-germany" },
  { kind: "cup", year: 1958, opens: "1958-06-08", tenures: [one("sweden", "1950-06-23")] },
  { kind: "cup", year: 1962, opens: "1962-05-30", tenures: [one("chile", "1956-06-10")], champion: "brazil" },
  { kind: "cup", year: 1966, opens: "1966-07-11", tenures: [one("uk", "1960-08-22")] },
  { kind: "cup", year: 1970, opens: "1970-05-31", tenures: [one("mexico", "1964-10-08")] },
  { kind: "cup", year: 1974, opens: "1974-06-13", tenures: [one("west-germany", "1966-07-06")] },
  { kind: "cup", year: 1978, opens: "1978-06-01", tenures: [one("argentina", "1966-07-06")] },
  { kind: "cup", year: 1982, opens: "1982-06-13", tenures: [one("spain", "1966-07-06")] },
  { kind: "cup", year: 1986, opens: "1986-05-31", tenures: [one("colombia", "1974-06-09", undefined, "1982-11-05"), one("mexico", "1983-05-20")] },
  { kind: "cup", year: 1990, opens: "1990-06-08", tenures: [one("italy", "1984-05-19")], champion: "west-germany" },
  { kind: "cup", year: 1994, opens: "1994-06-17", tenures: [one("usa", "1988-07-04")] },
  { kind: "cup", year: 1998, opens: "1998-06-10", tenures: [one("france", "1992-07-01")], champion: "france" },
  { kind: "cup", year: 2002, opens: "2002-05-31", tenures: [one(["south-korea", "japan"], "1996-05-31")] },
  { kind: "cup", year: 2006, opens: "2006-06-09", tenures: [one("germany", "2000-07-06")] },
  { kind: "cup", year: 2010, opens: "2010-06-11", tenures: [one("south-africa", "2004-05-15")], champion: "spain" },
  { kind: "cup", year: 2014, opens: "2014-06-12", tenures: [one("brazil", "2007-10-30")] },
  { kind: "cup", year: 2018, opens: "2018-06-14", tenures: [one("russia", "2010-12-02")], champion: "france" },
  { kind: "cup", year: 2022, opens: "2022-11-20", tenures: [one("qatar", "2010-12-02")] },
  { kind: "cup", year: 2026, opens: "2026-06-11", tenures: [one(["usa", "canada", "mexico"], "2018-06-13")] },
  { kind: "cup", year: 2030, opens: "2030-06-08", tenures: [one(["morocco", "portugal", "spain"], "2024-12-11")] },
  { kind: "cup", year: 2034, opens: "2034-06-15", tenures: [one("saudi-arabia", "2024-12-11")] },
];

/**
 * History's boycotts: the government that led one and those that followed it.
 * In the historical mode they come again when the Games are where history held
 * them and the leader still distrusts the host; a follower comes along when
 * the leader does and it has no warmth for the host either.
 */
export interface HistoryBoycott {
  games: string;
  host: string;
  lead: string;
  follow: string[];
}

export const HISTORY_BOYCOTTS: HistoryBoycott[] = [
  // Twenty-nine African countries over New Zealand's rugby tour of apartheid South Africa.
  { games: "summer-1976", host: "canada", lead: "tanzania", follow: ["kenya", "nigeria", "ghana", "ethiopia", "uganda", "zambia", "algeria", "iraq", "guyana", "congo", "madagascar", "mali", "niger", "sudan"] },
  // Sixty-five countries over the Soviet war in Afghanistan.
  {
    games: "summer-1980",
    host: "ussr",
    lead: "usa",
    follow: ["west-germany", "japan", "canada", "china", "kenya", "norway", "turkey", "south-korea", "israel", "egypt", "argentina", "chile", "pakistan", "indonesia", "malaysia", "philippines", "thailand", "saudi-arabia", "iran", "taiwan"],
  },
  // The Soviet bloc's answer.
  { games: "summer-1984", host: "usa", lead: "ussr", follow: ["east-germany", "bulgaria", "mongolia", "vietnam", "laos", "czechoslovakia", "afghanistan", "hungary", "poland", "cuba", "north-korea", "ethiopia", "south-yemen", "angola"] },
  { games: "summer-1988", host: "south-korea", lead: "north-korea", follow: ["cuba", "ethiopia", "nicaragua", "albania"] },
];

/** History's bans: South Africa under apartheid; Russia and Belarus while the war on Ukraine lasts. */
export interface HistoryBan {
  tag: string;
  since: string;
  until?: string;
  /** It holds while these two are at war. */
  war?: [string, string];
}

export const HISTORY_BANS: HistoryBan[] = [
  { tag: "south-africa", since: "1963-10-01", until: "1991-07-09" },
  { tag: "russia", since: "2022-02-28", war: ["russia", "ukraine"] },
  { tag: "belarus", since: "2022-02-28", war: ["russia", "ukraine"] },
];

/** The city a country puts forward when a vote, not history, gives it the Games: summer and winter. */
export const BID_CITIES: Record<string, { summer?: Localized; winter?: Localized }> = {
  usa: { summer: L("Chicago", "Чикаго", "Чикаго"), winter: C.denver },
  ussr: { summer: C.moscow, winter: L("Alma-Ata", "Алма-Ата", "Алма-Ата") },
  russia: { summer: C.moscow, winter: C.sochi },
  uk: { summer: C.london },
  france: { summer: C.paris, winter: C.chamonix },
  germany: { summer: C.berlin, winter: C.garmisch },
  "west-germany": { summer: C.munich, winter: L("Berchtesgaden", "Берхтесгаден", "Берхтесгаден") },
  "east-germany": { summer: L("Leipzig", "Лейпциг", "Лейпциг"), winter: L("Oberhof", "Оберхоф", "Оберхоф") },
  italy: { summer: C.rome, winter: C.cortina },
  japan: { summer: C.tokyo, winter: C.sapporo },
  china: { summer: C.beijing, winter: L("Harbin", "Харбин", "Харбін") },
  canada: { summer: L("Toronto", "Торонто", "Торонто"), winter: C.calgary },
  australia: { summer: C.sydney },
  spain: { summer: L("Madrid", "Мадрид", "Мадрид"), winter: L("Jaca", "Хака", "Хака") },
  netherlands: { summer: C.amsterdam },
  belgium: { summer: L("Brussels", "Брюссель", "Брюссель") },
  sweden: { summer: C.stockholm, winter: L("Östersund", "Эстерсунд", "Естерсунд") },
  norway: { summer: C.oslo, winter: C.lillehammer },
  finland: { summer: C.helsinki, winter: L("Lahti", "Лахти", "Лахті") },
  switzerland: { summer: L("Lausanne", "Лозанна", "Лозанна"), winter: C.stMoritz },
  austria: { summer: L("Vienna", "Вена", "Відень"), winter: C.innsbruck },
  mexico: { summer: C.mexico },
  brazil: { summer: C.rio },
  argentina: { summer: L("Buenos Aires", "Буэнос-Айрес", "Буенос-Айрес") },
  "south-korea": { summer: C.seoul, winter: C.pyeongchang },
  india: { summer: L("New Delhi", "Нью-Дели", "Нью-Делі") },
  turkey: { summer: L("Istanbul", "Стамбул", "Стамбул"), winter: L("Erzurum", "Эрзурум", "Ерзурум") },
  egypt: { summer: L("Cairo", "Каир", "Каїр") },
  hungary: { summer: L("Budapest", "Будапешт", "Будапешт") },
  poland: { summer: L("Warsaw", "Варшава", "Варшава"), winter: L("Zakopane", "Закопане", "Закопане") },
  czechoslovakia: { summer: L("Prague", "Прага", "Прага"), winter: L("the High Tatras", "Высокие Татры", "Високі Татри") },
  yugoslavia: { summer: L("Belgrade", "Белград", "Белград"), winter: C.sarajevo },
  greece: { summer: C.athens },
  portugal: { summer: L("Lisbon", "Лиссабон", "Лісабон") },
  "south-africa": { summer: L("Cape Town", "Кейптаун", "Кейптаун") },
  israel: { summer: L("Tel Aviv", "Тель-Авив", "Тель-Авів") },
  iran: { summer: L("Tehran", "Тегеран", "Тегеран") },
  "saudi-arabia": { summer: L("Riyadh", "Эр-Рияд", "Ер-Ріяд") },
  qatar: { summer: L("Doha", "Доха", "Доха") },
  romania: { summer: L("Bucharest", "Бухарест", "Бухарест") },
  bulgaria: { summer: L("Sofia", "София", "Софія"), winter: L("Sofia", "София", "Софія") },
  denmark: { summer: L("Copenhagen", "Копенгаген", "Копенгаген") },
  ukraine: { summer: L("Kyiv", "Киев", "Київ"), winter: L("Lviv", "Львов", "Львів") },
  kazakhstan: { summer: L("Almaty", "Алматы", "Алмати"), winter: L("Almaty", "Алматы", "Алмати") },
  indonesia: { summer: L("Jakarta", "Джакарта", "Джакарта") },
  "new-zealand": { summer: L("Auckland", "Окленд", "Окленд") },
  chile: { summer: L("Santiago", "Сантьяго", "Сантьяго") },
  cuba: { summer: L("Havana", "Гавана", "Гавана") },
  morocco: { summer: L("Casablanca", "Касабланка", "Касабланка") },
  nigeria: { summer: L("Lagos", "Лагос", "Лагос") },
  thailand: { summer: L("Bangkok", "Бангкок", "Бангкок") },
};

/** Countries with the snow, the mountains and the habit to hold the Winter Games. */
export const WINTER_HOSTS = new Set([
  "usa", "canada", "france", "switzerland", "austria", "italy", "germany", "west-germany", "east-germany", "norway", "sweden", "finland", "japan", "south-korea", "china", "ussr", "russia",
  "yugoslavia", "spain", "poland", "czechoslovakia", "czech-republic", "slovakia", "slovenia", "bulgaria", "romania", "kazakhstan", "ukraine", "georgia", "turkey", "argentina", "chile", "new-zealand", "andorra", "bosnia-and-herzegovina",
]);

/**
 * How much a country's winter sport outweighs what its people and wealth
 * alone would give: the skiers of the Alps and the North, the Dutch on
 * skates. A country not listed wins little on snow and ice.
 */
export const WINTER_STRENGTH: Record<string, number> = {
  norway: 5, austria: 2.6, switzerland: 1.8, finland: 1.8, sweden: 2, netherlands: 2.2, canada: 2, germany: 2, "west-germany": 1.6, "east-germany": 1.6, ussr: 1.2, russia: 1.2, usa: 0.7,
  italy: 0.9, france: 0.9, czechoslovakia: 1, "czech-republic": 1, slovenia: 1.2, poland: 0.6, japan: 0.5, "south-korea": 0.9, china: 0.5, slovakia: 0.6, belarus: 0.8, ukraine: 0.5, kazakhstan: 0.5,
  liechtenstein: 2, yugoslavia: 0.4, bulgaria: 0.3, "new-zealand": 0.3, australia: 0.3, croatia: 0.6, estonia: 0.6, latvia: 0.5, spain: 0.2, hungary: 0.3, romania: 0.2, "united-kingdom": 0.3, uk: 0.3,
};

/**
 * State sport systems beyond the one-party regime's own (engine/sport.ts):
 * East Germany's, the strongest of all, Cuba's and the Soviet Union's above
 * it, China's and North Korea's below.
 */
export const SYSTEM_EXTRA: Record<string, number> = { "east-germany": 1.8, cuba: 1.5, ussr: 1.1, china: 0.7, "north-korea": 0.6, mongolia: 0.7, vietnam: 0.5, laos: 0.5 };
/** The year such an edge began: East Germany's machine was built for its own team, first sent in 1968; Cuba's after the revolution's first decade. */
export const SYSTEM_FROM: Record<string, number> = { "east-germany": 1968, cuba: 1970 };

/** What a state sport system leaves once its regime is gone, from 1990: the schools, coaches and habits of the Soviet Union and its bloc. */
export const SYSTEM_LEGACY: Record<string, number> = {
  russia: 2.2, ukraine: 2, belarus: 2.2, kazakhstan: 2, uzbekistan: 1.8, georgia: 1.6, azerbaijan: 1.6, armenia: 1.5, moldova: 1.3, lithuania: 1.4, latvia: 1.3, estonia: 1.4,
  hungary: 1.8, romania: 1.8, bulgaria: 1.6, poland: 1.3, czechoslovakia: 1.3, "czech-republic": 1.3, slovakia: 1.3, yugoslavia: 1.3, croatia: 1.3, serbia: 1.4, slovenia: 1.3, germany: 1.15, mongolia: 1.3,
};

/**
 * A sporting tradition beyond what people, wealth and a system give: the
 * Hungarian pools and fencing halls, Kenya's and Ethiopia's runners,
 * Jamaica's sprinters, the Nordic and Antipodean clubs; and the countries
 * history shows winning less than their size and wealth would (Japan between
 * its home Games, India, the Gulf). A country not listed has none.
 */
export const TRADITION: Record<string, number> = {
  usa: 1.15, hungary: 2.2, sweden: 1.6, finland: 1.6, norway: 1.3, denmark: 1.2, netherlands: 1.3, "new-zealand": 1.6, australia: 1.5, kenya: 4, ethiopia: 4, jamaica: 4, cuba: 1.3,
  "south-korea": 1.5, italy: 1.3, romania: 1.2, bulgaria: 1.2, georgia: 1.5, azerbaijan: 1.3, uzbekistan: 1.3, turkey: 1.2, iran: 1.1, croatia: 1.3, belarus: 1.1, "czech-republic": 1.1,
  japan: 0.6, uk: 0.8, india: 0.4, pakistan: 0.5, bangladesh: 0.3, indonesia: 0.6, nigeria: 0.7, egypt: 0.6, mexico: 0.6, brazil: 0.7, "saudi-arabia": 0.3, qatar: 0.5, kuwait: 0.4,
  "united-arab-emirates": 0.3, "north-vietnam": 0.3, vietnam: 0.3, laos: 0.3, philippines: 0.4, thailand: 0.7,
};

/** Governments of one party that ran no Soviet-style sport system. */
export const NO_SYSTEM = new Set(["mexico", "turkey", "taiwan", "tunisia", "singapore", "egypt", "syria", "iraq"]);

/**
 * Football strength, Elo-like, in 1930, 1970 and 2010 (straight lines between,
 * level beyond): the game's World Cups draw on it with the host's edge and
 * the dice. A country not listed plays at a strength its people and wealth
 * give, below the football nations.
 */
export const FOOTBALL: Record<string, [number, number, number]> = {
  brazil: [1850, 2060, 2060],
  argentina: [1920, 1900, 2000],
  uruguay: [1960, 1850, 1850],
  italy: [1920, 1960, 1900],
  germany: [1820, 2000, 2010],
  "west-germany": [1820, 2010, 2010],
  "east-germany": [1650, 1760, 1760],
  uk: [1950, 1960, 1900],
  france: [1760, 1800, 1960],
  spain: [1860, 1850, 2060],
  netherlands: [1760, 1960, 2010],
  portugal: [1600, 1860, 1950],
  belgium: [1720, 1760, 1950],
  hungary: [1910, 1860, 1650],
  czechoslovakia: [1860, 1850, 1800],
  "czech-republic": [1800, 1800, 1800],
  austria: [1910, 1720, 1720],
  sweden: [1810, 1800, 1800],
  switzerland: [1760, 1700, 1800],
  yugoslavia: [1760, 1860, 1800],
  serbia: [1700, 1760, 1800],
  croatia: [1700, 1760, 1920],
  ussr: [1700, 1910, 1910],
  russia: [1700, 1850, 1800],
  ukraine: [1650, 1750, 1800],
  poland: [1660, 1860, 1760],
  denmark: [1700, 1700, 1820],
  norway: [1660, 1600, 1720],
  ireland: [1600, 1650, 1760],
  romania: [1700, 1760, 1760],
  bulgaria: [1620, 1760, 1700],
  greece: [1500, 1600, 1760],
  turkey: [1600, 1600, 1800],
  mexico: [1560, 1720, 1850],
  usa: [1650, 1550, 1800],
  chile: [1680, 1720, 1860],
  colombia: [1500, 1660, 1900],
  paraguay: [1680, 1660, 1760],
  peru: [1620, 1760, 1760],
  ecuador: [1400, 1520, 1760],
  "costa-rica": [1400, 1560, 1720],
  "south-korea": [1400, 1560, 1820],
  japan: [1400, 1520, 1820],
  australia: [1400, 1560, 1760],
  iran: [1400, 1620, 1760],
  "saudi-arabia": [1300, 1450, 1650],
  qatar: [1300, 1400, 1620],
  egypt: [1560, 1600, 1720],
  morocco: [1300, 1620, 1860],
  tunisia: [1300, 1560, 1700],
  algeria: [1300, 1560, 1720],
  nigeria: [1300, 1560, 1800],
  cameroon: [1300, 1600, 1760],
  ghana: [1300, 1620, 1760],
  senegal: [1300, 1500, 1800],
  "ivory-coast": [1300, 1520, 1780],
  "south-africa": [1450, 1500, 1700],
  "north-korea": [1400, 1600, 1550],
  scotland: [1800, 1760, 1720],
};

/** Medal events at the Summer and Winter Games over the years (straight lines between). */
export const EVENTS: Record<Exclude<GamesKind, "cup">, [number, number][]> = {
  summer: [
    [1912, 102],
    [1920, 154],
    [1928, 109],
    [1936, 129],
    [1952, 149],
    [1964, 163],
    [1972, 195],
    [1984, 221],
    [1992, 257],
    [2000, 300],
    [2016, 306],
    [2020, 339],
    [2024, 329],
  ],
  winter: [
    [1924, 16],
    [1948, 22],
    [1960, 27],
    [1964, 34],
    [1980, 38],
    [1988, 46],
    [1992, 57],
    [2002, 78],
    [2014, 98],
    [2022, 109],
    [2026, 116],
  ],
};

import type { ColonyHow, Localized } from "../types";
import { L } from "./coldwar";

/**
 * Decolonisation as history dated it (engine/colonies.ts): every colony's
 * independence from 1914 on, with the day it came, how it came, the new
 * state's first leader and, where it was fought for, the colonial war.
 *
 * One calendar serves every date: a game plays the seeds whose day falls
 * after its start, once the colony's land is held by a power the seed names
 * (`from`). In the historical mode the day is a tendency the engine moves
 * the plan toward, hastened by a metropole's weakness, delayed or fought
 * over by its course; in the free mode only the land, the name, the leader
 * and the strength of the movement on the start date are read from it.
 *
 * Land is given as modern countries (Natural Earth adm0, the map's `adm0`)
 * with provinces added (`plus`) or left out (`minus`) by the standard map's
 * ids, which the finer map's provinces carry as `was`: a new state takes its
 * modern borders.
 */

export interface ColonialWarSeed {
  /** The day the rising began. */
  since: string;
  name: Localized;
  /** The movement's name while it fights. */
  movement: Localized;
  /** Its leaders, as a leader line. */
  leader: string;
  /** Provinces (the standard map's ids) where it fights first. */
  where: string[];
  /** A date's own movement, when a scenario already has it at war (1957's FLN). */
  tag?: string;
  /** The day it ended before independence: crushed (Mau Mau) or settled by agreement (EOKA). */
  until?: string;
  ends?: "crushed" | "agreement";
  /** The state is not the movement's: Kenya went to Kenyatta's KANU, not to the Mau Mau. */
  apart?: true;
}

export interface ColonySeed {
  id: string;
  /** The state it becomes, or for a union the state it joins. */
  tag: string;
  /** Its land: modern countries. */
  adm0: string[];
  plus?: string[];
  minus?: string[];
  /** The powers it is won from. */
  from: string[];
  /** History's day of independence. */
  due: string;
  how: ColonyHow;
  /** The name of the day, where the modern one would be wrong; for a union, the land's own. */
  name?: Localized;
  /** The first government, as a leader line. */
  leader?: string;
  government?: Localized;
  war?: ColonialWarSeed;
  /** The historical mode only: a federation of settlers, a union, a partition, a secession. */
  history?: true;
}

const DOMINION = L("Dominion of the Commonwealth", "Доминион Содружества", "Домініон Співдружності");
const PARLIAMENTARY = L("Parliamentary republic", "Парламентская республика", "Парламентська республіка");
const PRESIDENTIAL = L("Presidential republic", "Президентская республика", "Президентська республіка");
const MONARCHY = L("Constitutional monarchy", "Конституционная монархия", "Конституційна монархія");
const ONE_PARTY = L("One-party republic", "Однопартийная республика", "Однопартійна республіка");
const SOCIALIST = L("One-party socialist republic", "Однопартийная социалистическая республика", "Однопартійна соціалістична республіка");
const MARXIST = L("One-party Marxist-Leninist state", "Однопартийное марксистско-ленинское государство", "Однопартійна марксистсько-ленінська держава");
const EMIRATE = L("Emirate", "Эмират", "Емірат");
const KINGDOM_ADVISED = L("Kingdom under British influence", "Королевство под британским влиянием", "Королівство під британським впливом");
const COMMUNITY_REPUBLIC = L("Republic in the French Community", "Республика во Французском сообществе", "Республіка у Французькій спільноті");

/** The Aden hinterland and the Hadhramaut, as coldwar.ts ADEN (kept apart to keep the data free of scenarios). */
const SOUTH_YEMEN = ["ye-adan", "ye-lahij", "ye-abyan", "ye-ad-dali", "ye-shabwah", "ye-hadhramaut", "ye-al-mahrah"];
/** North of the 17th parallel, as the 1957 and 1964 dates have it. */
const NORTH_VIETNAM = ["vn-tay-bac", "vn-ong-bac", "vn-northeast-vietnam", "vn-ong-b-c", "vn-ong-bang-song-hong", "vn-red-river-delta", "vn-bac-trung-bo"];
const BORNEO = ["my-sabah", "my-sarawak", "my-labuan"];
const WEST_NEW_GUINEA = ["id-papua", "id-west-papua"];
const BRITISH_CAMEROONS = ["cm-northwest", "cm-southwest"];

export const COLONIES: ColonySeed[] = [
  // 1914 and after: the Great War's aftermath.
  {
    id: "ireland-1922",
    tag: "ireland",
    adm0: ["IRL"],
    from: ["uk"],
    due: "1922-12-06",
    how: "community",
    name: L("Irish Free State", "Ирландское свободное государство", "Ірландська вільна держава"),
    leader: "President of the Executive Council W. T. Cosgrave",
    government: DOMINION,
    war: {
      since: "1919-01-21",
      name: L("Irish War of Independence", "Ирландская война за независимость", "Ірландська війна за незалежність"),
      movement: L("Irish Republic (Dáil Éireann)", "Ирландская республика (Дойл Эрән)", "Ірландська республіка (Дойл Ерен)"),
      leader: "President Éamon de Valera; Michael Collins",
      where: ["ie-cork", "ie-kerry", "ie-tipperary"],
      until: "1921-07-11",
      ends: "agreement",
    },
  },
  {
    id: "egypt-1922",
    tag: "egypt",
    adm0: ["EGY"],
    from: ["uk"],
    due: "1922-02-28",
    how: "handover",
    name: L("Kingdom of Egypt", "Королевство Египет", "Королівство Єгипет"),
    leader: "King Fuad I; PM Abdel Khalek Sarwat Pasha",
    government: KINGDOM_ADVISED,
  },
  {
    id: "iraq-1932",
    tag: "iraq",
    adm0: ["IRQ"],
    from: ["uk"],
    due: "1932-10-03",
    how: "handover",
    name: L("Kingdom of Iraq", "Королевство Ирак", "Королівство Ірак"),
    leader: "King Faisal I; PM Nuri as-Said",
    government: KINGDOM_ADVISED,
  },
  // 1939 and after: the war and the first wave.
  { id: "lebanon-1943", tag: "lebanon", adm0: ["LBN"], from: ["france"], due: "1943-11-22", how: "handover", leader: "President Bechara El Khoury; PM Riad Al Solh", government: PARLIAMENTARY },
  { id: "iceland-1944", tag: "iceland", adm0: ["ISL"], from: ["denmark"], due: "1944-06-17", how: "handover", leader: "President Sveinn Björnsson", government: PARLIAMENTARY },
  { id: "syria-1946", tag: "syria", adm0: ["SYR"], from: ["france"], due: "1946-04-17", how: "handover", leader: "President Shukri al-Quwatli", government: PARLIAMENTARY },
  {
    id: "jordan-1946",
    tag: "jordan",
    adm0: ["JOR"],
    from: ["uk"],
    due: "1946-05-25",
    how: "handover",
    name: L("Transjordan", "Трансиордания", "Трансйорданія"),
    leader: "King Abdullah I of Jordan",
    government: KINGDOM_ADVISED,
  },
  { id: "philippines-1946", tag: "philippines", adm0: ["PHL", "PGA"], from: ["usa"], due: "1946-07-04", how: "handover", leader: "President Manuel Roxas", government: PRESIDENTIAL },
  { id: "pakistan-1947", tag: "pakistan", adm0: ["PAK", "BGD"], from: ["uk"], due: "1947-08-14", how: "community", leader: "Governor-General Muhammad Ali Jinnah; PM Liaquat Ali Khan", government: DOMINION },
  { id: "india-1947", tag: "india", adm0: ["IND", "KAS"], from: ["uk"], due: "1947-08-15", how: "community", leader: "PM Jawaharlal Nehru; Governor-General Louis Mountbatten", government: DOMINION },
  { id: "burma-1948", tag: "burma", adm0: ["MMR"], from: ["uk"], due: "1948-01-04", how: "handover", name: L("Burma", "Бирма", "Бірма"), leader: "PM U Nu; President Sao Shwe Thaik", government: PARLIAMENTARY },
  { id: "ceylon-1948", tag: "ceylon", adm0: ["LKA"], from: ["uk"], due: "1948-02-04", how: "community", name: L("Ceylon", "Цейлон", "Цейлон"), leader: "PM D. S. Senanayake", government: DOMINION },
  { id: "israel-1948", tag: "israel", adm0: ["ISR"], from: ["uk"], due: "1948-05-14", how: "handover", leader: "PM David Ben-Gurion; President Chaim Weizmann", government: PARLIAMENTARY },
  {
    id: "indonesia-1949",
    tag: "indonesia",
    adm0: ["IDN"],
    minus: WEST_NEW_GUINEA,
    from: ["netherlands"],
    due: "1949-12-27",
    how: "war",
    leader: "President Sukarno; PM Mohammad Hatta",
    government: L("Federal republic", "Федеративная республика", "Федеративна республіка"),
    war: {
      since: "1945-08-17",
      name: L("Indonesian National Revolution", "Индонезийская национальная революция", "Індонезійська національна революція"),
      movement: L("Republic of Indonesia", "Республика Индонезия", "Республіка Індонезія"),
      leader: "President Sukarno; Vice-President Mohammad Hatta",
      where: ["id-central-java", "id-yogyakarta", "id-east-java", "id-west-java"],
    },
  },
  {
    id: "laos-1953",
    tag: "laos",
    adm0: ["LAO"],
    from: ["france"],
    due: "1953-10-22",
    how: "community",
    name: L("Kingdom of Laos", "Королевство Лаос", "Королівство Лаос"),
    leader: "King Sisavang Vong",
    government: MONARCHY,
  },
  {
    id: "cambodia-1953",
    tag: "cambodia",
    adm0: ["KHM"],
    from: ["france"],
    due: "1953-11-09",
    how: "community",
    name: L("Kingdom of Cambodia", "Королевство Камбоджа", "Королівство Камбоджа"),
    leader: "King Norodom Sihanouk",
    government: MONARCHY,
  },
  {
    id: "vietnam-1954",
    tag: "vietnam",
    adm0: ["VNM"],
    minus: NORTH_VIETNAM,
    from: ["france"],
    due: "1954-06-04",
    how: "community",
    name: L("State of Vietnam", "Государство Вьетнам", "Держава В'єтнам"),
    leader: "Chief of State Bảo Đại; PM Ngô Đình Diệm",
    government: L("State associated with France", "Государство, ассоциированное с Францией", "Держава, асоційована з Францією"),
    history: true,
  },
  {
    id: "north-vietnam-1954",
    tag: "north-vietnam",
    adm0: [],
    plus: NORTH_VIETNAM,
    from: ["france"],
    due: "1954-07-21",
    how: "war",
    name: L("North Vietnam", "Северный Вьетнам", "Північний В'єтнам"),
    leader: "President Ho Chi Minh; General Vo Nguyen Giap",
    government: L("One-party communist state", "Однопартийное коммунистическое государство", "Однопартійна комуністична держава"),
    war: {
      since: "1946-12-19",
      name: L("First Indochina War", "Первая Индокитайская война", "Перша індокитайська війна"),
      movement: L("Viet Minh (DRV)", "Вьетминь (ДРВ)", "В'єтмінь (ДРВ)"),
      leader: "President Ho Chi Minh; General Vo Nguyen Giap",
      where: ["vn-tay-bac", "vn-ong-bac", "vn-northeast-vietnam"],
    },
    history: true,
  },
  // 1950 and after: Africa, the Caribbean, the Gulf and the Pacific.
  {
    id: "libya-1951",
    tag: "libya",
    adm0: ["LBY"],
    from: ["uk", "france"],
    due: "1951-12-24",
    how: "handover",
    name: L("United Kingdom of Libya", "Объединённое королевство Ливия", "Об'єднане королівство Лівія"),
    leader: "King Idris I of Libya; PM Mahmud al-Muntasir",
    government: KINGDOM_ADVISED,
  },
  { id: "eritrea-1952", tag: "ethiopia", adm0: ["ERI"], from: ["uk"], due: "1952-09-15", how: "union", name: L("Eritrea", "Эритрея", "Еритрея"), history: true },
  {
    id: "rhodesia-1953",
    tag: "rhodesia",
    adm0: ["ZWE", "ZMB", "MWI"],
    from: ["uk"],
    due: "1953-08-01",
    how: "community",
    name: L("Federation of Rhodesia and Nyasaland", "Федерация Родезии и Ньясаленда", "Федерація Родезії та Ньясаленду"),
    leader: "PM Godfrey Huggins",
    government: L("Self-governing federation ruled by the white minority", "Самоуправляемая федерация под властью белого меньшинства", "Самоврядна федерація під владою білої меншості"),
    history: true,
  },
  { id: "sudan-1956", tag: "sudan", adm0: ["SDN", "SDS"], from: ["uk"], due: "1956-01-01", how: "handover", leader: "PM Ismail al-Azhari", government: PARLIAMENTARY },
  {
    id: "morocco-1956",
    tag: "morocco",
    adm0: ["MAR"],
    from: ["france", "spain"],
    due: "1956-03-02",
    how: "handover",
    leader: "Sultan Mohammed V of Morocco; PM Mbarek Bekkai",
    government: L("Monarchy of the Sultan", "Монархия султана", "Монархія султана"),
  },
  {
    id: "tunisia-1956",
    tag: "tunisia",
    adm0: ["TUN"],
    from: ["france"],
    due: "1956-03-20",
    how: "handover",
    leader: "PM Habib Bourguiba; Bey Muhammad VIII al-Amin",
    government: L("Kingdom of the Bey, governed by the Neo Destour", "Королевство бея под властью Нео-Дестура", "Королівство бея під владою Нео-Дестуру"),
  },
  { id: "ghana-1957", tag: "ghana", adm0: ["GHA"], from: ["uk"], due: "1957-03-06", how: "community", leader: "PM Kwame Nkrumah", government: DOMINION },
  {
    id: "malaya-1957",
    tag: "malaysia",
    adm0: ["MYS"],
    minus: BORNEO,
    from: ["uk"],
    due: "1957-08-31",
    how: "community",
    name: L("Federation of Malaya", "Малайская Федерация", "Малайська Федерація"),
    leader: "PM Tunku Abdul Rahman",
    government: L("Federal constitutional monarchy", "Федеративная конституционная монархия", "Федеративна конституційна монархія"),
  },
  { id: "guinea-1958", tag: "guinea", adm0: ["GIN"], from: ["france"], due: "1958-10-02", how: "handover", leader: "President Ahmed Sékou Touré", government: ONE_PARTY },
  // The year of Africa: seventeen states in 1960.
  { id: "cameroon-1960", tag: "cameroon", adm0: ["CMR"], minus: BRITISH_CAMEROONS, from: ["france"], due: "1960-01-01", how: "handover", leader: "President Ahmadou Ahidjo", government: PRESIDENTIAL },
  { id: "togo-1960", tag: "togo", adm0: ["TGO"], from: ["france"], due: "1960-04-27", how: "handover", leader: "PM Sylvanus Olympio", government: PRESIDENTIAL },
  {
    id: "madagascar-1960",
    tag: "madagascar",
    adm0: ["MDG"],
    from: ["france"],
    due: "1960-06-26",
    how: "community",
    name: L("Malagasy Republic", "Малагасийская Республика", "Малагасійська Республіка"),
    leader: "President Philibert Tsiranana",
    government: COMMUNITY_REPUBLIC,
    war: {
      since: "1947-03-29",
      name: L("Malagasy Uprising", "Мадагаскарское восстание", "Мадагаскарське повстання"),
      movement: L("Malagasy insurgents (MDRM)", "Малагасийские повстанцы (ДМРМ)", "Малагасійські повстанці (ДМРМ)"),
      leader: "Joseph Raseta; Joseph Ravoahangy",
      where: ["mg-vatovavy-fitovinany", "mg-toamasina"],
      until: "1949-02-01",
      ends: "crushed",
      apart: true,
    },
  },
  {
    id: "congo-1960",
    tag: "dr-congo",
    adm0: ["COD"],
    from: ["belgium"],
    due: "1960-06-30",
    how: "handover",
    name: L("Congo (Léopoldville)", "Конго (Леопольдвиль)", "Конго (Леопольдвіль)"),
    leader: "President Joseph Kasa-Vubu; PM Patrice Lumumba",
    government: PARLIAMENTARY,
  },
  {
    id: "somalia-1960",
    tag: "somalia",
    adm0: ["SOM", "SOL"],
    from: ["italy", "uk"],
    due: "1960-07-01",
    how: "handover",
    name: L("Somali Republic", "Сомалийская Республика", "Сомалійська Республіка"),
    leader: "President Aden Abdullah Osman Daar; PM Abdirashid Ali Sharmarke",
    government: PARLIAMENTARY,
  },
  { id: "dahomey-1960", tag: "benin", adm0: ["BEN"], from: ["france"], due: "1960-08-01", how: "handover", name: L("Dahomey", "Дагомея", "Дагомея"), leader: "President Hubert Maga", government: PRESIDENTIAL },
  { id: "niger-1960", tag: "niger", adm0: ["NER"], from: ["france"], due: "1960-08-03", how: "handover", leader: "President Hamani Diori", government: ONE_PARTY },
  { id: "upper-volta-1960", tag: "burkina-faso", adm0: ["BFA"], from: ["france"], due: "1960-08-05", how: "handover", name: L("Upper Volta", "Верхняя Вольта", "Верхня Вольта"), leader: "President Maurice Yaméogo", government: ONE_PARTY },
  { id: "ivory-coast-1960", tag: "ivory-coast", adm0: ["CIV"], from: ["france"], due: "1960-08-07", how: "handover", leader: "President Félix Houphouët-Boigny", government: ONE_PARTY },
  { id: "chad-1960", tag: "chad", adm0: ["TCD"], from: ["france"], due: "1960-08-11", how: "community", leader: "President François Tombalbaye", government: COMMUNITY_REPUBLIC },
  { id: "car-1960", tag: "central-african-republic", adm0: ["CAF"], from: ["france"], due: "1960-08-13", how: "community", leader: "President David Dacko", government: COMMUNITY_REPUBLIC },
  {
    id: "congo-brazzaville-1960",
    tag: "congo",
    adm0: ["COG"],
    from: ["france"],
    due: "1960-08-15",
    how: "community",
    name: L("Congo (Brazzaville)", "Конго (Браззавиль)", "Конго (Браззавіль)"),
    leader: "President Fulbert Youlou",
    government: COMMUNITY_REPUBLIC,
  },
  { id: "gabon-1960", tag: "gabon", adm0: ["GAB"], from: ["france"], due: "1960-08-17", how: "community", leader: "President Léon M'ba", government: COMMUNITY_REPUBLIC },
  { id: "cyprus-1960", tag: "cyprus", adm0: ["CYP", "CYN"], from: ["uk"], due: "1960-08-16", how: "community", leader: "President Makarios III; Vice-President Fazıl Küçük", government: PRESIDENTIAL, war: {
    since: "1955-04-01",
    name: L("Cyprus Emergency", "Кипрское чрезвычайное положение", "Кіпрський надзвичайний стан"),
    movement: L("EOKA", "ЭОКА", "ЕОКА"),
    leader: "Georgios Grivas",
    where: ["cy-nicosia", "cy-limassol", "cy-paphos"],
    until: "1959-03-13",
    ends: "agreement",
    apart: true,
  } },
  { id: "senegal-1960", tag: "senegal", adm0: ["SEN"], from: ["france"], due: "1960-08-20", how: "community", leader: "President Léopold Sédar Senghor; PM Mamadou Dia", government: COMMUNITY_REPUBLIC },
  { id: "mali-1960", tag: "mali", adm0: ["MLI"], from: ["france"], due: "1960-09-22", how: "handover", leader: "President Modibo Keïta", government: SOCIALIST },
  { id: "nigeria-1960", tag: "nigeria", adm0: ["NGA"], from: ["uk"], due: "1960-10-01", how: "community", leader: "PM Abubakar Tafawa Balewa; Governor-General Nnamdi Azikiwe", government: DOMINION },
  { id: "mauritania-1960", tag: "mauritania", adm0: ["MRT"], from: ["france"], due: "1960-11-28", how: "handover", leader: "President Moktar Ould Daddah", government: L("Islamic republic", "Исламская республика", "Ісламська республіка") },
  // The sixties.
  { id: "sierra-leone-1961", tag: "sierra-leone", adm0: ["SLE"], from: ["uk"], due: "1961-04-27", how: "community", leader: "PM Milton Margai", government: DOMINION },
  { id: "kuwait-1961", tag: "kuwait", adm0: ["KWT"], from: ["uk"], due: "1961-06-19", how: "handover", leader: "Emir Abdullah III Al-Salim Al-Sabah", government: EMIRATE },
  { id: "southern-cameroons-1961", tag: "cameroon", adm0: [], plus: BRITISH_CAMEROONS, from: ["uk"], due: "1961-10-01", how: "union", name: L("Southern Cameroons", "Южный Камерун", "Південний Камерун"), history: true },
  { id: "tanganyika-1961", tag: "tanzania", adm0: ["TZA"], from: ["uk"], due: "1961-12-09", how: "community", name: L("Tanganyika", "Танганьика", "Танганьїка"), leader: "PM Julius Nyerere", government: DOMINION },
  {
    id: "samoa-1962",
    tag: "samoa",
    adm0: ["WSM"],
    from: ["new-zealand"],
    due: "1962-01-01",
    how: "handover",
    name: L("Western Samoa", "Западное Самоа", "Західне Самоа"),
    leader: "Head of State Malietoa Tanumafili II; PM Fiame Mata'afa",
    government: L("Parliamentary state of the chiefs", "Парламентское государство вождей", "Парламентська держава вождів"),
  },
  { id: "rwanda-1962", tag: "rwanda", adm0: ["RWA"], from: ["belgium"], due: "1962-07-01", how: "handover", leader: "President Grégoire Kayibanda", government: ONE_PARTY },
  { id: "burundi-1962", tag: "burundi", adm0: ["BDI"], from: ["belgium"], due: "1962-07-01", how: "handover", leader: "King Mwambutsa IV; PM André Muhirwa", government: MONARCHY },
  {
    id: "algeria-1962",
    tag: "algeria",
    adm0: ["DZA"],
    from: ["france"],
    due: "1962-07-05",
    how: "war",
    leader: "PM Ahmed Ben Bella; President Ferhat Abbas",
    government: SOCIALIST,
    war: {
      since: "1954-11-01",
      name: L("Algerian War", "Алжирская война", "Алжирська війна"),
      movement: L("FLN (Algeria)", "ФНО (Алжир)", "ФНВ (Алжир)"),
      leader: "Ahmed Ben Bella; Krim Belkacem",
      where: ["dz-batna", "dz-khenchela", "dz-tizi-ouzou", "dz-bejaia", "dz-jijel", "dz-souk-ahras"],
      tag: "fln",
    },
  },
  { id: "jamaica-1962", tag: "jamaica", adm0: ["JAM"], from: ["uk"], due: "1962-08-06", how: "community", leader: "PM Alexander Bustamante", government: DOMINION },
  { id: "trinidad-1962", tag: "trinidad-and-tobago", adm0: ["TTO"], from: ["uk"], due: "1962-08-31", how: "community", leader: "PM Eric Williams", government: DOMINION },
  { id: "uganda-1962", tag: "uganda", adm0: ["UGA"], from: ["uk"], due: "1962-10-09", how: "community", leader: "PM Milton Obote", government: DOMINION },
  { id: "west-new-guinea-1963", tag: "indonesia", adm0: [], plus: WEST_NEW_GUINEA, from: ["netherlands"], due: "1963-05-01", how: "union", name: L("West New Guinea", "Западная Новая Гвинея", "Західна Нова Гвінея"), history: true },
  {
    id: "malaysia-1963",
    tag: "malaysia",
    adm0: ["SGP"],
    plus: BORNEO,
    from: ["uk"],
    due: "1963-09-16",
    how: "union",
    name: L("North Borneo, Sarawak and Singapore", "Северное Борнео, Саравак и Сингапур", "Північне Борнео, Саравак і Сінгапур"),
    history: true,
  },
  {
    id: "kenya-1963",
    tag: "kenya",
    adm0: ["KEN"],
    from: ["uk"],
    due: "1963-12-12",
    how: "community",
    leader: "PM Jomo Kenyatta",
    government: DOMINION,
    war: {
      since: "1952-10-20",
      name: L("Mau Mau Uprising", "Восстание мау-мау", "Повстання мау-мау"),
      movement: L("Kenya Land and Freedom Army (Mau Mau)", "Армия земли и свободы Кении (мау-мау)", "Армія землі та свободи Кенії (мау-мау)"),
      leader: "Dedan Kimathi",
      where: ["ke-central", "ke-rift-valley"],
      until: "1956-10-21",
      ends: "crushed",
      apart: true,
    },
  },
  { id: "malawi-1964", tag: "malawi", adm0: ["MWI"], from: ["rhodesia", "uk"], due: "1964-07-06", how: "community", leader: "PM Hastings Banda", government: DOMINION },
  { id: "malta-1964", tag: "malta", adm0: ["MLT"], from: ["uk"], due: "1964-09-21", how: "community", leader: "PM George Borg Olivier", government: DOMINION },
  { id: "zambia-1964", tag: "zambia", adm0: ["ZMB"], from: ["rhodesia", "uk"], due: "1964-10-24", how: "community", leader: "President Kenneth Kaunda", government: PRESIDENTIAL },
  { id: "gambia-1965", tag: "gambia", adm0: ["GMB"], from: ["uk"], due: "1965-02-18", how: "community", leader: "PM Dawda Jawara", government: DOMINION },
  { id: "singapore-1965", tag: "singapore", adm0: ["SGP"], from: ["malaysia"], due: "1965-08-09", how: "handover", leader: "PM Lee Kuan Yew", government: PARLIAMENTARY, history: true },
  { id: "guyana-1966", tag: "guyana", adm0: ["GUY"], from: ["uk"], due: "1966-05-26", how: "community", leader: "PM Forbes Burnham", government: DOMINION },
  { id: "botswana-1966", tag: "botswana", adm0: ["BWA"], from: ["uk"], due: "1966-09-30", how: "community", leader: "President Seretse Khama", government: PRESIDENTIAL },
  { id: "lesotho-1966", tag: "lesotho", adm0: ["LSO"], from: ["uk"], due: "1966-10-04", how: "community", leader: "PM Leabua Jonathan; King Moshoeshoe II", government: MONARCHY },
  { id: "barbados-1966", tag: "barbados", adm0: ["BRB"], from: ["uk"], due: "1966-11-30", how: "community", leader: "PM Errol Barrow", government: DOMINION },
  {
    id: "south-yemen-1967",
    tag: "south-yemen",
    adm0: [],
    plus: SOUTH_YEMEN,
    from: ["uk"],
    due: "1967-11-30",
    how: "war",
    name: L("South Yemen", "Южный Йемен", "Південний Ємен"),
    leader: "President Qahtan al-Shaabi",
    government: SOCIALIST,
    war: {
      since: "1963-12-10",
      name: L("Aden Emergency", "Аденское чрезвычайное положение", "Аденський надзвичайний стан"),
      movement: L("National Liberation Front (NLF)", "Национальный фронт освобождения (НФО)", "Національний фронт визволення (НФВ)"),
      leader: "Qahtan al-Shaabi",
      where: ["ye-ad-dali", "ye-lahij", "ye-adan"],
    },
  },
  { id: "swaziland-1968", tag: "swaziland", adm0: ["SWZ"], from: ["uk"], due: "1968-09-06", how: "community", leader: "King Sobhuza II", government: L("Absolute monarchy", "Абсолютная монархия", "Абсолютна монархія") },
  { id: "equatorial-guinea-1968", tag: "equatorial-guinea", adm0: ["GNQ"], from: ["spain"], due: "1968-10-12", how: "handover", leader: "President Francisco Macías Nguema", government: PRESIDENTIAL },
  { id: "fiji-1970", tag: "fiji", adm0: ["FJI"], from: ["uk"], due: "1970-10-10", how: "community", leader: "PM Kamisese Mara", government: DOMINION },
  { id: "bahrain-1971", tag: "bahrain", adm0: ["BHR"], from: ["uk"], due: "1971-08-15", how: "handover", leader: "Emir Isa bin Salman Al Khalifa", government: EMIRATE },
  { id: "qatar-1971", tag: "qatar", adm0: ["QAT"], from: ["uk"], due: "1971-09-03", how: "handover", leader: "Emir Ahmad bin Ali Al Thani", government: EMIRATE },
  { id: "uae-1971", tag: "united-arab-emirates", adm0: ["ARE"], from: ["uk"], due: "1971-12-02", how: "handover", leader: "President Zayed bin Sultan Al Nahyan", government: L("Federation of emirates", "Федерация эмиратов", "Федерація еміратів") },
  {
    id: "bangladesh-1971",
    tag: "bangladesh",
    adm0: ["BGD"],
    from: ["pakistan"],
    due: "1971-12-16",
    how: "war",
    leader: "President Sheikh Mujibur Rahman; PM Tajuddin Ahmad",
    government: PARLIAMENTARY,
    war: {
      since: "1971-03-26",
      name: L("Bangladesh Liberation War", "Война за независимость Бангладеш", "Війна за незалежність Бангладеш"),
      movement: L("Mukti Bahini (Provisional Government of Bangladesh)", "Мукти-бахини (Временное правительство Бангладеш)", "Мукті-бахіні (Тимчасовий уряд Бангладеш)"),
      leader: "Sheikh Mujibur Rahman; Tajuddin Ahmad",
      where: ["bd-dhaka", "bd-chattogram", "bd-khulna"],
    },
  },
  { id: "bahamas-1973", tag: "bahamas", adm0: ["BHS"], from: ["uk"], due: "1973-07-10", how: "community", leader: "PM Lynden Pindling", government: DOMINION },
  { id: "grenada-1974", tag: "grenada", adm0: ["GRD"], from: ["uk"], due: "1974-02-07", how: "community", leader: "PM Eric Gairy", government: DOMINION },
  {
    id: "guinea-bissau-1974",
    tag: "guinea-bissau",
    adm0: ["GNB"],
    from: ["portugal"],
    due: "1974-09-10",
    how: "war",
    leader: "President Luís Cabral",
    government: L("One-party state of the PAIGC", "Однопартийное государство ПАИГК", "Однопартійна держава ПАІГК"),
    war: {
      since: "1963-01-23",
      name: L("Guinea-Bissau War of Independence", "Война за независимость Гвинеи-Бисау", "Війна за незалежність Гвінеї-Бісау"),
      movement: L("PAIGC", "ПАИГК", "ПАІГК"),
      leader: "Amílcar Cabral",
      where: ["gw-oio", "gw-tombali", "gw-quinara"],
      tag: "paigc",
    },
  },
  {
    id: "mozambique-1975",
    tag: "mozambique",
    adm0: ["MOZ"],
    from: ["portugal"],
    due: "1975-06-25",
    how: "war",
    leader: "President Samora Machel",
    government: MARXIST,
    war: {
      since: "1964-09-25",
      name: L("Mozambican War of Independence", "Война за независимость Мозамбика", "Війна за незалежність Мозамбіку"),
      movement: L("FRELIMO", "ФРЕЛИМО", "ФРЕЛІМО"),
      leader: "Eduardo Mondlane; Samora Machel",
      where: ["mz-cabo-delgado", "mz-niassa", "mz-tete"],
      tag: "frelimo",
    },
  },
  { id: "png-1975", tag: "papua-new-guinea", adm0: ["PNG"], from: ["australia"], due: "1975-09-16", how: "community", leader: "PM Michael Somare", government: DOMINION },
  {
    id: "angola-1975",
    tag: "angola",
    adm0: ["AGO"],
    from: ["portugal"],
    due: "1975-11-11",
    how: "war",
    leader: "President Agostinho Neto",
    government: MARXIST,
    war: {
      since: "1961-02-04",
      name: L("Angolan War of Independence", "Война за независимость Анголы", "Війна за незалежність Анголи"),
      movement: L("MPLA", "МПЛА", "МПЛА"),
      leader: "Agostinho Neto",
      where: ["ao-uige", "ao-zaire", "ao-bengo", "ao-cuanza-norte"],
      tag: "mpla",
    },
  },
  {
    id: "western-sahara-1976",
    tag: "morocco",
    adm0: ["SAH"],
    plus: ["ma-laayoune-boujdour-sakia-el-hamra", "ma-oued-ed-dahab"],
    from: ["spain"],
    due: "1976-02-26",
    how: "union",
    name: L("Spanish Sahara", "Испанская Сахара", "Іспанська Сахара"),
    history: true,
  },
  {
    id: "east-timor-1976",
    tag: "indonesia",
    adm0: ["TLS"],
    from: ["portugal"],
    due: "1976-07-17",
    how: "union",
    name: L("Portuguese Timor", "Португальский Тимор", "Португальський Тимор"),
    history: true,
  },
  { id: "suriname-1975", tag: "suriname", adm0: ["SUR"], from: ["netherlands"], due: "1975-11-25", how: "handover", leader: "PM Henck Arron", government: PARLIAMENTARY },
  { id: "djibouti-1977", tag: "djibouti", adm0: ["DJI"], from: ["france"], due: "1977-06-27", how: "handover", leader: "President Hassan Gouled Aptidon", government: PRESIDENTIAL },
  { id: "solomon-islands-1978", tag: "solomon-islands", adm0: ["SLB"], from: ["uk"], due: "1978-07-07", how: "community", leader: "PM Peter Kenilorea", government: DOMINION },
  { id: "dominica-1978", tag: "dominica", adm0: ["DMA"], from: ["uk"], due: "1978-11-03", how: "community", leader: "PM Patrick John", government: PARLIAMENTARY },
  { id: "saint-lucia-1979", tag: "saint-lucia", adm0: ["LCA"], from: ["uk"], due: "1979-02-22", how: "community", leader: "PM John Compton", government: DOMINION },
  { id: "saint-vincent-1979", tag: "saint-vincent-and-the-grenadines", adm0: ["VCT"], from: ["uk"], due: "1979-10-27", how: "community", leader: "PM Milton Cato", government: DOMINION },
  {
    id: "zimbabwe-1980",
    tag: "zimbabwe",
    adm0: ["ZWE"],
    from: ["rhodesia", "uk"],
    due: "1980-04-18",
    how: "war",
    leader: "PM Robert Mugabe; President Canaan Banana",
    government: PARLIAMENTARY,
    war: {
      since: "1966-04-28",
      name: L("Rhodesian Bush War", "Война в Родезии", "Війна в Родезії"),
      movement: L("ZANU", "ЗАНУ", "ЗАНУ"),
      leader: "Robert Mugabe; Joshua Nkomo",
      where: ["zw-mashonaland-central", "zw-manicaland", "zw-mashonaland-east"],
      tag: "zanu",
      // The Lancaster House ceasefire of December 1979, the elections of February 1980.
      until: "1979-12-21",
      ends: "agreement",
    },
  },
  { id: "belize-1981", tag: "belize", adm0: ["BLZ"], from: ["uk"], due: "1981-09-21", how: "community", leader: "PM George Price", government: DOMINION },
  { id: "antigua-1981", tag: "antigua-and-barbuda", adm0: ["ATG"], from: ["uk"], due: "1981-11-01", how: "community", leader: "PM Vere Bird", government: DOMINION },
  { id: "saint-kitts-1983", tag: "saint-kitts-and-nevis", adm0: ["KNA"], from: ["uk"], due: "1983-09-19", how: "community", leader: "PM Kennedy Simmonds", government: DOMINION },
  { id: "brunei-1984", tag: "brunei", adm0: ["BRN"], from: ["uk"], due: "1984-01-01", how: "handover", leader: "Sultan Hassanal Bolkiah", government: L("Absolute sultanate", "Абсолютный султанат", "Абсолютний султанат") },
  {
    id: "namibia-1990",
    tag: "namibia",
    adm0: ["NAM"],
    from: ["south-africa"],
    due: "1990-03-21",
    how: "war",
    leader: "President Sam Nujoma",
    government: PRESIDENTIAL,
    war: {
      since: "1966-08-26",
      name: L("Namibian War of Independence", "Война за независимость Намибии", "Війна за незалежність Намібії"),
      movement: L("SWAPO", "СВАПО", "СВАПО"),
      leader: "Sam Nujoma",
      where: ["na-ohangwena", "na-omusati", "na-oshana"],
      // The New York Accords of December 1988; the ceasefire of April 1989.
      until: "1989-04-01",
      ends: "agreement",
    },
  },
  // After the Cold War: the last handovers and secessions history dated.
  {
    id: "eritrea-1993",
    tag: "eritrea",
    adm0: ["ERI"],
    from: ["ethiopia"],
    due: "1993-05-24",
    how: "handover",
    leader: "President Isaias Afwerki",
    government: L("One-party state of the PFDJ", "Однопартийное государство НФДС", "Однопартійна держава НФДС"),
    // Thirty years of war from Awate's first shots; the EPLF of the 1973 and 1979 dates fights it.
    war: {
      since: "1961-09-01",
      name: L("Eritrean War of Independence", "Война за независимость Эритреи", "Війна за незалежність Еритреї"),
      movement: L("Eritrean Liberation Front", "Фронт освобождения Эритреи", "Фронт визволення Еритреї"),
      leader: "Idris Muhammad Adam",
      where: ["er-gash-barka", "er-anseba", "er-northern-red-sea"],
      tag: "eplf",
    },
    history: true,
  },
  { id: "hong-kong-1997", tag: "china", adm0: ["HKG"], from: ["uk"], due: "1997-07-01", how: "union", name: L("Hong Kong", "Гонконг", "Гонконг"), history: true },
  {
    id: "east-timor-2002",
    tag: "east-timor",
    adm0: ["TLS"],
    from: ["indonesia"],
    due: "2002-05-20",
    how: "handover",
    name: L("East Timor", "Восточный Тимор", "Східний Тимор"),
    leader: "President Xanana Gusmão; PM Mari Alkatiri",
    government: PARLIAMENTARY,
  },
  { id: "south-sudan-2011", tag: "south-sudan", adm0: ["SDS"], from: ["sudan"], due: "2011-07-09", how: "handover", leader: "President Salva Kiir Mayardit", government: PRESIDENTIAL, history: true },
];

/**
 * Colonies the free mode groups as one where a modern border would split
 * them: Korea under Japan is one country to free, not two.
 */
export const FREE_GROUPS: Omit<ColonySeed, "due" | "how" | "from">[] = [{ id: "korea", tag: "korea", adm0: ["KOR", "PRK"], name: L("Korea", "Корея", "Корея") }];

/**
 * Colonies with many settlers, which their metropoles fought hardest to
 * keep: Algeria, Kenya, Southern Rhodesia, Angola, Mozambique, South West Africa.
 */
export const SETTLER_COLONIES = new Set(["DZA", "KEN", "ZWE", "AGO", "MOZ", "NAM"]);

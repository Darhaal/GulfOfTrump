import { LEVEL_YEARS, NUCLEAR_SINCE } from "./arsenal";
import { roll } from "./dice";
import { officialAt } from "./government";
import { money } from "./economy";
import { aheadOf, outputBonus, techYear, yearFraction } from "./researchEffects";
import { regimeNow } from "./role";
import { RESEARCH_DIRECTIONS, WEAPON_KINDS, type AppliedChange, type GameState, type Localized, type RegimeKind, type Research, type ResearchDirection, type ScenarioId, type WeaponKind } from "./types";

/**
 * The player's research: money split between seven directions, each with
 * the year of technology it has reached — the calendar's at the start, then
 * ahead of it with money and an able minister, behind it when neglected.
 * The money is a fixed part of two budget lines the game already has, a
 * fifth of the army's and three tenths of industry's (the pools the old
 * research projects drew on): spending more on the army or on industry
 * buys more research, and the split moves money between directions, not
 * away from the factories — every government researches, history's pace
 * included, and the arms money of the rest of the world pays for theirs the
 * same way. Science and education speed up all the others; the dice bring
 * setbacks and lucky turns. A direction passing the year history made a
 * breakthrough makes it in this game, earlier or later than history did.
 * What the directions bring is read in engine/researchEffects.ts.
 */

export interface Breakthrough {
  id: string;
  direction: ResearchDirection;
  /** When history made it. */
  year: number;
  name: Localized;
  effect: Localized;
  /** The atomic bomb: made by the bomb programme, not by the direction's year alone. */
  bomb?: boolean;
}

const B = (direction: ResearchDirection, id: string, year: number, name: Localized, effect: Localized, bomb?: boolean): Breakthrough => ({ id, direction, year, name, effect, ...(bomb ? { bomb } : {}) });
const L = (en: string, ru: string, uk: string): Localized => ({ en, ru, uk });

/**
 * The named breakthroughs of each direction, by the year history made them.
 * The military ones mark the years new levels of weapons came (arsenal.ts's
 * LEVEL_YEARS); the ids of the old research projects are kept for their
 * namesakes, so a save's finished projects read as breakthroughs.
 */
export const BREAKTHROUGHS: Breakthrough[] = [
  B("military", "tanks", 1915, L("Tanks and anti-aircraft guns", "Танки и зенитные орудия", "Танки та зенітні гармати"), L("The first tanks and guns against aircraft", "Первые танки и пушки против самолётов", "Перші танки й гармати проти літаків")),
  B("military", "motorised", 1925, L("Motorised artillery", "Моторизованная артиллерия", "Моторизована артилерія"), L("Guns towed by tractors: artillery of the second level", "Пушки на тягачах: артиллерия второго уровня", "Гармати на тягачах: артилерія другого рівня")),
  B("military", "monoplanes", 1930, L("Monoplanes and interwar tanks", "Монопланы и межвоенные танки", "Моноплани та міжвоєнні танки"), L("Aircraft and tanks of the second level", "Самолёты и танки второго уровня", "Літаки й танки другого рівня")),
  B("military", "radar", 1935, L("Radar", "Радиолокация", "Радіолокація"), L("Fast battleships and carriers, aimed anti-aircraft fire: ships and air defence of the second level", "Быстроходные линкоры и авианосцы, прицельный зенитный огонь: флот и ПВО второго уровня", "Швидкохідні лінкори й авіаносці, прицільний зенітний вогонь: флот і ППО другого рівня")),
  B("military", "self-loading", 1940, L("Self-loading rifles", "Самозарядные винтовки", "Самозарядні гвинтівки"), L("Rifles and sub-machine guns of the second level", "Винтовки и пистолеты-пулемёты второго уровня", "Гвинтівки й пістолети-кулемети другого рівня")),
  B("military", "heavy-armour", 1943, L("Heavy armour and rocket artillery", "Тяжёлая броня и реактивная артиллерия", "Важка броня та реактивна артилерія"), L("Tanks and artillery of the third level", "Танки и артиллерия третьего уровня", "Танки й артилерія третього рівня")),
  B("military", "jets", 1944, L("Jet engines", "Реактивные двигатели", "Реактивні двигуни"), L("Jet aircraft, radar fleets and radar-laid air defence: the third level", "Реактивная авиация, флот и ПВО с радарами: третий уровень", "Реактивна авіація, флот і ППО з радарами: третій рівень")),
  B("military", "assault-rifles", 1947, L("Assault rifles", "Автоматы", "Автомати"), L("Infantry weapons of the third level", "Стрелковое оружие третьего уровня", "Стрілецька зброя третього рівня")),
  B("military", "supersonic", 1955, L("Supersonic jets and main battle tanks", "Сверхзвуковые самолёты и основные танки", "Надзвукові літаки й основні танки"), L("Aircraft and tanks of the fourth level", "Самолёты и танки четвёртого уровня", "Літаки й танки четвертого рівня")),
  B("military", "sam", 1957, L("Surface-to-air missiles", "Зенитные ракеты", "Зенітні ракети"), L("Air defence of the fourth level", "ПВО четвёртого уровня", "ППО четвертого рівня")),
  B("military", "missile-ships", 1960, L("Missile ships and self-propelled guns", "Ракетные корабли и самоходные орудия", "Ракетні кораблі й самохідні гармати"), L("Ships, artillery and infantry weapons of the fourth level", "Корабли, артиллерия и стрелковое оружие четвёртого уровня", "Кораблі, артилерія й стрілецька зброя четвертого рівня")),
  B("military", "precision", 1975, L("Precision-guided munitions", "Высокоточное оружие", "Високоточна зброя"), L("Aircraft of the fifth level", "Авиация пятого уровня", "Авіація п'ятого рівня")),
  B("military", "composite", 1979, L("Composite armour and modern missiles", "Композитная броня и современные ракеты", "Композитна броня й сучасні ракети"), L("Tanks, artillery, ships and air defence of the fifth level", "Танки, артиллерия, корабли и ПВО пятого уровня", "Танки, артилерія, кораблі й ППО п'ятого рівня")),
  B("military", "drones", 1982, L("Reconnaissance drones", "Разведывательные дроны", "Розвідувальні дрони"), L("Opens drones", "Открывает дроны", "Відкриває дрони")),
  B("military", "night-vision", 1990, L("Night sights and optics", "Ночные прицелы и оптика", "Нічні приціли й оптика"), L("Infantry weapons of the fifth level", "Стрелковое оружие пятого уровня", "Стрілецька зброя п'ятого рівня")),
  B("military", "armed-drones", 2001, L("Armed drones", "Ударные дроны", "Ударні дрони"), L("Drones of the second level", "Дроны второго уровня", "Дрони другого рівня")),
  B("military", "stealth", 2005, L("Stealth aircraft and guided shells", "Малозаметные самолёты и управляемые снаряды", "Малопомітні літаки й керовані снаряди"), L("Aircraft, artillery and air defence of the sixth level", "Авиация, артиллерия и ПВО шестого уровня", "Авіація, артилерія й ППО шостого рівня")),
  B("military", "active-protection", 2010, L("Active protection and long-range drones", "Активная защита и дальнобойные дроны", "Активний захист і далекобійні дрони"), L("Tanks, ships and infantry weapons of the sixth level, drones of the third", "Танки, корабли и стрелковое оружие шестого уровня, дроны третьего", "Танки, кораблі й стрілецька зброя шостого рівня, дрони третього")),
  B("military", "loitering", 2020, L("Loitering munitions", "Барражирующие боеприпасы", "Баражувальні боєприпаси"), L("Drones of the fourth level", "Дроны четвёртого уровня", "Дрони четвертого рівня")),
  B("military", "swarms", 2030, L("Drone swarms", "Рои дронов", "Рої дронів"), L("Beyond today's weapons: the game master weighs it in battle", "Дальше сегодняшнего оружия: ведущий учтёт это в боях", "Далі сьогоднішньої зброї: ведучий врахує це в боях")),

  B("industry", "electrification", 1920, L("Electrified factories", "Электрификация заводов", "Електрифікація заводів"), L("Electric motors in every workshop", "Электромоторы в каждом цеху", "Електромотори в кожному цеху")),
  B("industry", "synthetics", 1936, L("Synthetic fuel and rubber", "Синтетическое топливо и каучук", "Синтетичне паливо й каучук"), L("Chemistry in place of imports", "Химия вместо импорта", "Хімія замість імпорту")),
  B("industry", "mass-production", 1942, L("Mass production", "Массовое производство", "Масове виробництво"), L("Conveyor lines for weapons and cars", "Конвейеры для оружия и машин", "Конвеєри для зброї й машин")),
  B("industry", "nuclear-power", 1954, L("Nuclear power", "Атомная энергетика", "Атомна енергетика"), L("Power stations without coal", "Электростанции без угля", "Електростанції без вугілля")),
  B("industry", "automation", 1961, L("Factory automation", "Автоматизация заводов", "Автоматизація заводів"), L("Machine tools that run themselves", "Станки, которые работают сами", "Верстати, що працюють самі")),
  B("industry", "robots", 1978, L("Industrial robots", "Промышленные роботы", "Промислові роботи"), L("Robots on the assembly line", "Роботы на сборочной линии", "Роботи на складальній лінії")),
  B("industry", "cad", 1990, L("Computer-aided manufacturing", "Компьютерное проектирование и производство", "Комп'ютерне проєктування й виробництво"), L("Designs and machine tools run by computers", "Чертежи и станки под управлением компьютеров", "Креслення й верстати під керуванням комп'ютерів")),
  B("industry", "renewables", 2012, L("Cheap solar and wind power", "Дешёвая солнечная и ветровая энергия", "Дешева сонячна й вітрова енергія"), L("Power that needs no fuel", "Энергия без топлива", "Енергія без палива")),
  B("industry", "industrial-ai", 2028, L("AI-run factories", "Заводы под управлением ИИ", "Заводи під керуванням ШІ"), L("Production with few hands", "Производство почти без рабочих", "Виробництво майже без робітників")),

  B("agriculture", "nitrogen", 1920, L("Synthetic fertiliser", "Синтетические удобрения", "Синтетичні добрива"), L("Nitrogen from the air for the fields", "Азот из воздуха для полей", "Азот із повітря для полів")),
  B("agriculture", "tractors", 1928, L("Tractors and combines", "Тракторы и комбайны", "Трактори й комбайни"), L("Fewer hands on the land", "Меньше рук на земле", "Менше рук на землі")),
  B("agriculture", "hybrid", 1940, L("Hybrid seed", "Гибридные семена", "Гібридне насіння"), L("Higher-yielding grain", "Более урожайное зерно", "Урожайніше зерно")),
  B("agriculture", "pesticides", 1946, L("Pesticides", "Пестициды", "Пестициди"), L("Less of the harvest lost to pests", "Вредители губят меньше урожая", "Шкідники гублять менше врожаю")),
  B("agriculture", "green", 1965, L("The green revolution", "Зелёная революция", "Зелена революція"), L("New wheat and rice, cheaper bread", "Новые сорта пшеницы и риса, хлеб дешевле", "Нові сорти пшениці й рису, хліб дешевший")),
  B("agriculture", "irrigation", 1978, L("Drip irrigation", "Капельное орошение", "Крапельне зрошення"), L("Harvests from dry land", "Урожаи на сухих землях", "Урожаї на сухих землях")),
  B("agriculture", "gm-crops", 1996, L("Genetically modified crops", "Генно-модифицированные культуры", "Генно-модифіковані культури"), L("Crops that resist pests and drought", "Культуры, устойчивые к вредителям и засухе", "Культури, стійкі до шкідників і посухи")),
  B("agriculture", "precision-farming", 2010, L("Precision farming", "Точное земледелие", "Точне землеробство"), L("Fields worked by satellite", "Поля обрабатываются по спутнику", "Поля обробляються за супутником")),
  B("agriculture", "gene-edited", 2027, L("Gene-edited crops", "Культуры с редактированным геномом", "Культури з редагованим геномом"), L("More grain from the same land", "Больше зерна с той же земли", "Більше зерна з тієї ж землі")),

  B("medicine", "transfusion", 1917, L("Blood banks", "Банки крови", "Банки крові"), L("Fewer of the wounded die", "Меньше раненых умирает", "Менше поранених помирає")),
  B("medicine", "insulin", 1922, L("Insulin", "Инсулин", "Інсулін"), L("Diabetes is no longer a death sentence", "Диабет больше не приговор", "Діабет більше не вирок")),
  B("medicine", "sulfa", 1935, L("Sulfa drugs", "Сульфаниламиды", "Сульфаніламіди"), L("The first drugs against infection", "Первые лекарства от инфекций", "Перші ліки від інфекцій")),
  B("medicine", "antibiotics", 1942, L("Antibiotics", "Антибиотики", "Антибіотики"), L("Healthier workers, fewer deaths from wounds", "Здоровее работники, меньше умирает от ран", "Здоровіші працівники, менше помирає від ран")),
  B("medicine", "polio", 1955, L("The polio vaccine", "Вакцина от полиомиелита", "Вакцина від поліомієліту"), L("Children grow up healthy", "Дети растут здоровыми", "Діти ростуть здоровими")),
  B("medicine", "transplants", 1967, L("Organ transplants", "Пересадка органов", "Пересадка органів"), L("Surgery that saves the hopeless", "Хирургия спасает безнадёжных", "Хірургія рятує безнадійних")),
  B("medicine", "ct", 1975, L("CT scanners", "Компьютерная томография", "Комп'ютерна томографія"), L("Illness found early", "Болезни находят рано", "Хвороби знаходять рано")),
  B("medicine", "statins", 1987, L("Statins", "Статины", "Статини"), L("Fewer heart attacks", "Меньше инфарктов", "Менше інфарктів")),
  B("medicine", "antiretrovirals", 1996, L("Drugs against HIV", "Лекарства от ВИЧ", "Ліки від ВІЛ"), L("An epidemic held back", "Эпидемия сдержана", "Епідемію стримано")),
  B("medicine", "biotech", 2003, L("Biotechnology", "Биотехнологии", "Біотехнології"), L("New medicines from genes", "Новые лекарства из генов", "Нові ліки з генів")),
  B("medicine", "mrna", 2020, L("mRNA vaccines", "мРНК-вакцины", "мРНК-вакцини"), L("A vaccine within months of a new disease", "Вакцина через месяцы после новой болезни", "Вакцина за кілька місяців після нової хвороби")),
  B("medicine", "gene-therapy", 2030, L("Gene therapy", "Генная терапия", "Генна терапія"), L("Inherited diseases cured", "Наследственные болезни излечимы", "Спадкові хвороби виліковні")),

  B("science", "quantum", 1926, L("Quantum mechanics", "Квантовая механика", "Квантова механіка"), L("A new physics", "Новая физика", "Нова фізика")),
  B("science", "fission", 1938, L("Nuclear fission", "Деление ядра", "Поділ ядра"), L("Opens the way to an atomic programme", "Открывает путь к атомной программе", "Відкриває шлях до атомної програми")),
  B("science", "big-science", 1946, L("State laboratories", "Государственные лаборатории", "Державні лабораторії"), L("Science on the scale of the state", "Наука в масштабе государства", "Наука в масштабі держави")),
  B("science", "universities", 1960, L("Mass higher education", "Массовое высшее образование", "Масова вища освіта"), L("Engineers by the hundred thousand", "Инженеры сотнями тысяч", "Інженери сотнями тисяч")),
  B("science", "supercomputers", 1976, L("Supercomputers", "Суперкомпьютеры", "Суперкомп'ютери"), L("Calculations no team of people could do", "Расчёты, непосильные людям", "Розрахунки, непосильні людям")),
  B("science", "space-telescopes", 1990, L("Space telescopes", "Космические телескопы", "Космічні телескопи"), L("Science beyond the atmosphere", "Наука за пределами атмосферы", "Наука за межами атмосфери")),
  B("science", "colliders", 2008, L("Giant colliders", "Гигантские коллайдеры", "Гігантські колайдери"), L("Physics at its edge", "Физика на пределе", "Фізика на межі")),
  B("science", "quantum-computers", 2019, L("Quantum computers", "Квантовые компьютеры", "Квантові комп'ютери"), L("Machines that compute with atoms", "Машины, считающие атомами", "Машини, що рахують атомами")),
  B("science", "ai-science", 2030, L("AI in the laboratory", "ИИ в лабораториях", "ШІ в лабораторіях"), L("Machines that make discoveries", "Машины делают открытия", "Машини роблять відкриття")),

  B("communications", "radio", 1920, L("Radio broadcasting", "Радиовещание", "Радіомовлення"), L("A voice in every home", "Голос в каждом доме", "Голос у кожному домі")),
  B("communications", "television", 1936, L("Television", "Телевидение", "Телебачення"), L("Pictures over the air", "Изображение в эфире", "Зображення в ефірі")),
  B("communications", "computing", 1947, L("Transistors and computers", "Транзисторы и ЭВМ", "Транзистори та ЕОМ"), L("Machines that calculate", "Машины, которые считают", "Машини, що рахують")),
  B("communications", "chips", 1959, L("Integrated circuits", "Интегральные схемы", "Інтегральні схеми"), L("Electronics on a chip", "Электроника на кристалле", "Електроніка на кристалі")),
  B("communications", "pc", 1977, L("Personal computers", "Персональные компьютеры", "Персональні комп'ютери"), L("A computer on every desk", "Компьютер на каждом столе", "Комп'ютер на кожному столі")),
  B("communications", "mobile", 1985, L("Mobile phones", "Мобильная связь", "Мобільний зв'язок"), L("Calls from anywhere", "Звонки откуда угодно", "Дзвінки звідусіль")),
  B("communications", "internet", 1991, L("The internet", "Интернет", "Інтернет"), L("A network of all networks", "Сеть всех сетей", "Мережа всіх мереж")),
  B("communications", "smartphones", 2007, L("Smartphones", "Смартфоны", "Смартфони"), L("The internet in every pocket", "Интернет в каждом кармане", "Інтернет у кожній кишені")),
  B("communications", "ai", 2025, L("Artificial intelligence", "Искусственный интеллект", "Штучний інтелект"), L("Machines that read, write and reason", "Машины читают, пишут и рассуждают", "Машини читають, пишуть і міркують")),
  B("communications", "6g", 2032, L("Sixth-generation networks", "Сети шестого поколения", "Мережі шостого покоління"), L("Everything connected", "Всё на связи", "Усе на зв'язку")),

  B("strategic", "liquid-rockets", 1926, L("Liquid-fuel rockets", "Жидкостные ракеты", "Рідинні ракети"), L("The first step to missiles and space", "Первый шаг к ракетам и космосу", "Перший крок до ракет і космосу")),
  B("strategic", "rockets", 1944, L("Rocketry", "Ракетная техника", "Ракетна техніка"), L("Ballistic missiles", "Баллистические ракеты", "Балістичні ракети")),
  B("strategic", "nuclear", 1945, L("The atomic bomb", "Атомная бомба", "Атомна бомба"), L("Nuclear weapons", "Ядерное оружие", "Ядерна зброя"), true),
  B("strategic", "satellites", 1957, L("Satellites and intercontinental missiles", "Спутники и межконтинентальные ракеты", "Супутники й міжконтинентальні ракети"), L("Reconnaissance from orbit: more is known of other countries", "Разведка с орбиты: о других странах известно больше", "Розвідка з орбіти: про інші країни відомо більше")),
  B("strategic", "spaceflight", 1961, L("Human spaceflight", "Полёт человека в космос", "Політ людини в космос"), L("Prestige in the world", "Престиж в мире", "Престиж у світі")),
  B("strategic", "moon", 1969, L("The Moon landing", "Высадка на Луну", "Висадка на Місяць"), L("Prestige and new know-how", "Престиж и новые технологии", "Престиж і нові технології")),
  B("strategic", "gps", 1993, L("Satellite navigation", "Спутниковая навигация", "Супутникова навігація"), L("Armies and ships know where they are", "Армия и флот точно знают, где они", "Армія й флот точно знають, де вони")),
  B("strategic", "reusable", 2015, L("Reusable rockets", "Многоразовые ракеты", "Багаторазові ракети"), L("Cheap access to orbit", "Дешёвый выход на орбиту", "Дешевий вихід на орбіту")),
  B("strategic", "hypersonic", 2019, L("Hypersonic missiles", "Гиперзвуковые ракеты", "Гіперзвукові ракети"), L("Missiles air defence can hardly stop", "Ракеты, которые ПВО почти не сбивает", "Ракети, які ППО майже не збиває")),
  B("strategic", "lunar-base", 2030, L("A base on the Moon", "База на Луне", "База на Місяці"), L("Prestige in the world", "Престиж в мире", "Престиж у світі")),
];

const BY_ID = new Map(BREAKTHROUGHS.map((b) => [b.id, b]));

/** A breakthrough by its id. */
export const breakthroughOf = (id: string): Breakthrough | undefined => BY_ID.get(id);

/** A direction's breakthroughs in the order history made them; the bomb, made by its programme, left out. */
export const breakthroughsOf = (direction: ResearchDirection): Breakthrough[] => BREAKTHROUGHS.filter((b) => b.direction === direction && !b.bomb);

/** The shares of the army and industry budgets that go to research. */
export const RESEARCH_POOL = { army: 0.2, industry: 0.3 };
/** What an era's government normally puts into research, as a share of GDP: the pools at the era's usual budget (economy.ts). History's pace is kept at it. */
const NORM: Record<ScenarioId, number> = { "1914": 0.01, "1939": 0.017, "1950": 0.022, "1964": 0.024, "1991": 0.018, "1999": 0.0164, "2014": 0.0156, "2022": 0.016 };

/** How an era's governments split their research: a new game's split before its government's lean. */
const BASE: Record<ScenarioId, Record<ResearchDirection, number>> = {
  "1914": { military: 22, industry: 22, agriculture: 16, medicine: 10, science: 14, communications: 11, strategic: 5 },
  "1939": { military: 25, industry: 20, agriculture: 12, medicine: 10, science: 13, communications: 12, strategic: 8 },
  "1950": { military: 20, industry: 18, agriculture: 12, medicine: 12, science: 13, communications: 12, strategic: 13 },
  "1964": { military: 18, industry: 17, agriculture: 11, medicine: 13, science: 14, communications: 13, strategic: 14 },
  "1991": { military: 14, industry: 17, agriculture: 9, medicine: 16, science: 15, communications: 20, strategic: 9 },
  "1999": { military: 13, industry: 16, agriculture: 8, medicine: 17, science: 15, communications: 22, strategic: 9 },
  "2014": { military: 13, industry: 15, agriculture: 8, medicine: 18, science: 15, communications: 22, strategic: 9 },
  "2022": { military: 16, industry: 15, agriculture: 7, medicine: 17, science: 15, communications: 21, strategic: 9 },
};

/** How each kind of government leans, in percentage points of the split. */
const TILT: Record<RegimeKind, Partial<Record<ResearchDirection, number>>> = {
  democracy: { military: -3, strategic: -2, medicine: 2, communications: 2, science: 1 },
  limited: {},
  party: { military: 3, industry: 3, strategic: 3, medicine: -3, agriculture: -3, communications: -3 },
  autocracy: { military: 4, strategic: 2, medicine: -2, science: -2, communications: -2 },
  military: { military: 8, strategic: 2, medicine: -3, science: -3, agriculture: -2, communications: -2 },
};

/** Below this pace a direction's own work stops counting; what the world publishes still reaches it. */
const MIN_RATE = 0.3;
/** Years of technology a year that leak in from the world, per year a direction is behind it. */
const DIFFUSION = 0.1;
/** A direction this many years ahead of history goes at half the pace its money would buy: the unknown is slower to find. */
const LEAD_DRAG = 10;
const MAX_RATE = 2.5;
/** The atomic programme runs while strategic programmes get at least this share. */
export const BOMB_SHARE = 15;
/** Years of an atomic programme at history's pace, before the bomb was known to be possible; it gets easier as the world learns. */
const BOMB_YEARS = 6;
/** The year fission is published to the world, whatever the player's science. */
const FISSION_KNOWN = 1945;
/** A country that built the bomb within this many years of the start begins with its atomic programme funded. */
const BOMB_HORIZON = 30;
/** The share a country with a programme in its history starts with for strategic programmes. */
const BOMB_START_SHARE = 20;
/** The largest shift of the split a directive can make in a turn, percentage points. */
export const MAX_SHIFT = 15;
/** A direction with less than this share is not worked enough for the dice to land on it. */
const DICE_SHARE = 5;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const round2 = (v: number) => Math.round(v * 100) / 100;
/**
 * The year of technology is kept to four decimals (under an hour of
 * history's pace): kept to two, a weekly turn's 0.02 years were rounded so
 * that every pace from 0.78 to 1.3 years a year moved +0.02 a week, and the
 * split of the money stopped mattering.
 */
const round4 = (v: number) => Math.round(v * 10000) / 10000;

/** The first of the month a fractional year falls in: 1943.6 → "1943-08-01". */
function monthOf(year: number): string {
  const y = Math.floor(year);
  const m = Math.min(12, Math.floor((year - y) * 12 + 1e-6) + 1);
  return `${y}-${String(m).padStart(2, "0")}-01`;
}

/** Splits `total` into whole numbers in proportion to `values`, by the largest remainders. */
function apportion(values: number[], total: number): number[] {
  const sum = values.reduce((a, b) => a + b, 0);
  const raw = values.map((v) => (sum > 0 ? (v / sum) * total : total / values.length));
  const out = raw.map(Math.floor);
  const order = raw.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0]);
  for (let k = 0, left = total - out.reduce((a, b) => a + b, 0); left > 0; k++, left--) out[order[k % order.length][1]]++;
  return out;
}

/** Shares of any size, missing or negative ones as nothing, made whole percentages that add up to 100. */
export function normalizeShares(shares: Partial<Record<ResearchDirection, number>>): Record<ResearchDirection, number> {
  const values = RESEARCH_DIRECTIONS.map((d) => Math.max(0, Number.isFinite(shares[d]) ? shares[d]! : 0));
  const whole = apportion(values, 100);
  return Object.fromEntries(RESEARCH_DIRECTIONS.map((d, i) => [d, whole[i]])) as Record<ResearchDirection, number>;
}

/** One direction's share moved by `delta` points; the others give or take the difference in proportion to what they have. */
export function shiftShares(shares: Record<ResearchDirection, number>, direction: ResearchDirection, delta: number): Record<ResearchDirection, number> {
  const target = clamp(Math.round(shares[direction] + delta), 0, 100);
  const others = RESEARCH_DIRECTIONS.filter((d) => d !== direction);
  const rest = apportion(
    others.map((d) => shares[d]),
    100 - target,
  );
  return { ...(Object.fromEntries(others.map((d, i) => [d, rest[i]])) as Record<ResearchDirection, number>), [direction]: target };
}

type StartState = Pick<GameState, "scenarioId" | "player" | "date" | "politics"> & { defeat?: GameState["defeat"] };

/** A new game's split: the era's, leaned by the kind of government, with an atomic programme for a country that built the bomb soon after. */
export function defaultShares(state: StartState): Record<ResearchDirection, number> {
  const base = { ...BASE[state.scenarioId] };
  const tilt = TILT[regimeNow(state)];
  for (const d of RESEARCH_DIRECTIONS) base[d] = Math.max(0, base[d] + (tilt[d] ?? 0));
  const since = NUCLEAR_SINCE[state.player];
  const now = yearFraction(state.date);
  if (since !== undefined && since > now && since - now <= BOMB_HORIZON) base.strategic = Math.max(base.strategic, BOMB_START_SHARE);
  const shares = normalizeShares(base);
  // The bomb's share stays whole after the others are scaled around it.
  return since !== undefined && since > now && since - now <= BOMB_HORIZON && shares.strategic < BOMB_START_SHARE ? shiftShares(shares, "strategic", BOMB_START_SHARE - shares.strategic) : shares;
}

/** A new game's research: the default split, which then keeps history's pace, every direction at the calendar's year, no breakthroughs yet. */
export function startingResearch(state: StartState): Research {
  const now = round4(yearFraction(state.date));
  const shares = defaultShares(state);
  return { shares, base: { ...shares }, tech: Object.fromEntries(RESEARCH_DIRECTIONS.map((d) => [d, now])) as Record<ResearchDirection, number>, done: [] };
}

type PaceState = Pick<GameState, "research" | "date" | "countries" | "player" | "scenarioId" | "officials">;

/**
 * The research money a year, $bn; what the era's governments spend for an
 * economy of this size (`usual`); and the ratio of the two that the pace
 * counts, kept from a third to twice.
 */
export function researchMoney(state: Pick<GameState, "countries" | "player" | "scenarioId">): { pool: number; ratio: number; usual: number } {
  const e = state.countries[state.player]?.economy;
  if (!e) return { pool: 0, ratio: 1, usual: 0 };
  const pool = e.budget.army * RESEARCH_POOL.army + e.budget.industry * RESEARCH_POOL.industry;
  const usual = Math.max(0.01, e.gdp) * NORM[state.scenarioId];
  return { pool, ratio: clamp(pool / usual, 1 / 3, 2), usual };
}

/** The science minister's hand: 1.0 at an ordinary competence of 3, from 0.8 to 1.2. */
export const ministerPace = (state: Pick<GameState, "officials">): number => 0.7 + 0.1 * (officialAt(state, "science")?.competence ?? 3);

/** What science and education ahead of the world (or behind it) do to every other direction. */
export const scienceBoost = (state: Pick<GameState, "research" | "date">): number => clamp(1 + 0.04 * aheadOf(state, "science"), 0.8, 1.4);

/**
 * Strategic programmes cost the same whoever runs them: the player's research
 * money against what the largest economy normally spends on research, from
 * 0.4 to 1. Measured by GDP, as it was, the Soviet Union of 1950 – spending
 * more on research than the United States – ran its rockets at 0.45.
 */
export function sizeOf(state: Pick<GameState, "countries" | "player" | "scenarioId">): number {
  const gdp = state.countries[state.player]?.economy?.gdp ?? 0;
  const largest = Math.max(gdp, ...Object.values(state.countries).flatMap((c) => (c.economy && !c.dormant ? [c.economy.gdp] : [])));
  if (largest <= 0) return 1;
  return clamp(Math.sqrt(researchMoney(state).pool / (largest * NORM[state.scenarioId])), 0.4, 1);
}

/**
 * What a direction's money, minister and science buy, in years of
 * technology a year: 1 keeps history's pace. The game's starting split is
 * the measure — a share above it buys more, below it less — and money
 * beyond the era's usual share of GDP buys more for every direction.
 */
export function investment(state: PaceState, direction: ResearchDirection): number {
  const shares = state.research?.shares;
  if (!shares) return 1;
  const share = shares[direction] ?? 0;
  const base = Math.max(1, state.research?.base?.[direction] ?? BASE[state.scenarioId][direction]);
  const { ratio } = researchMoney(state);
  return Math.sqrt(share / base) * Math.cbrt(ratio) * ministerPace(state) * (direction === "science" ? 1 : scienceBoost(state)) * (direction === "strategic" ? sizeOf(state) : 1);
}

/** Years of technology a direction gains a year now: what its money buys, slowed far ahead of history, helped by the world when behind it. */
export function researchRate(state: PaceState, direction: ResearchDirection): number {
  const ahead = aheadOf(state, direction);
  const own = Math.max(MIN_RATE, investment(state, direction) / (1 + Math.max(0, ahead) / LEAD_DRAG));
  return clamp(own + DIFFUSION * Math.max(0, -ahead), 0, MAX_RATE);
}

/** How the atomic programme stands: the country has the bomb, runs a programme, or cannot run one (too little money, or fission not yet known). */
export function bombStatus(state: PaceState): { has: true } | { has: false; progress: number; running: boolean; blocked?: "share" | "fission" } {
  if (state.countries[state.player]?.arsenal?.nuclear) return { has: true };
  const progress = state.research?.bomb ?? 0;
  const fission = techYear(state, "science") >= 1938 || yearFraction(state.date) >= FISSION_KNOWN;
  const share = state.research?.shares?.strategic ?? 0;
  const blocked = !fission ? "fission" : share < BOMB_SHARE ? "share" : undefined;
  return { has: false, progress, running: !blocked, ...(blocked ? { blocked } : {}) };
}

/** Of the bomb programme, a year now: history's pace makes the bomb in BOMB_YEARS, fewer once the world knows how. */
function bombRate(state: PaceState): number {
  const known = clamp(1 - Math.max(0, yearFraction(state.date) - 1945) / 100, 0.5, 1);
  return investment(state, "strategic") / (BOMB_YEARS * known);
}

export interface DirectionView {
  direction: ResearchDirection;
  share: number;
  /** The year of technology reached. */
  tech: number;
  /** Years ahead of the calendar (negative: behind). */
  ahead: number;
  /** Years of technology a year now. */
  rate: number;
  /** The next breakthrough, if history has one left in this direction. */
  next?: Breakthrough;
  /** 0–1 of the way from the last breakthrough to the next. */
  progress: number;
  /** When the next breakthrough comes at this pace. */
  expected?: number;
  /** Years before history's date it comes (negative: after it). */
  versus?: number;
}

/** A direction as the science panel and the game master see it. */
export function directionView(state: PaceState, direction: ResearchDirection): DirectionView {
  const tech = techYear(state, direction);
  const now = yearFraction(state.date);
  const rate = researchRate(state, direction);
  const list = breakthroughsOf(direction);
  const next = list.find((b) => b.year > tech);
  const last = [...list].reverse().find((b) => b.year <= tech)?.year ?? (next ? Math.min(tech, next.year - 15) : tech);
  const view: DirectionView = { direction, share: state.research?.shares?.[direction] ?? 0, tech, ahead: tech - now, rate, progress: 1 };
  if (!next) return view;
  const expected = now + (next.year - tech) / Math.max(0.05, rate);
  return { ...view, next, progress: clamp((tech - last) / Math.max(0.01, next.year - last), 0, 1), expected, versus: next.year - expected };
}

/** What the science minister says of the split, for the panel: the first thing that matters. */
export type ResearchNote =
  | { kind: "scienceLow" }
  | { kind: "lopsided"; direction: ResearchDirection; n: number }
  | { kind: "behind"; direction: ResearchDirection; n: number }
  | { kind: "bomb"; n: number }
  | { kind: "balanced" };

export function researchNote(state: PaceState): ResearchNote {
  const shares = state.research?.shares;
  if (!shares) return { kind: "balanced" };
  if (shares.science < 8) return { kind: "scienceLow" };
  const top = RESEARCH_DIRECTIONS.reduce((a, b) => (shares[b] > shares[a] ? b : a));
  if (shares[top] >= 40) return { kind: "lopsided", direction: top, n: shares[top] };
  const worst = RESEARCH_DIRECTIONS.reduce((a, b) => (aheadOf(state, b) < aheadOf(state, a) ? b : a));
  if (aheadOf(state, worst) <= -3) return { kind: "behind", direction: worst, n: Math.round(-aheadOf(state, worst)) };
  const bomb = bombStatus(state);
  if (!bomb.has && bomb.running) return { kind: "bomb", n: Math.round(bomb.progress * 100) };
  return { kind: "balanced" };
}

/** The player's new split, made whole. */
export function setShares<T extends Pick<GameState, "research" | "scenarioId" | "player" | "date" | "politics">>(state: T, shares: Partial<Record<ResearchDirection, number>>): T {
  const research = state.research?.shares ? state.research : startingResearch(state);
  return { ...state, research: { ...research, shares: normalizeShares(shares) } };
}

export type ResearchWord = { direction: ResearchDirection; shift: number };

/** What the game master may shift by a directive: known directions, by whole points within MAX_SHIFT, each once. */
export function sanitizeResearch(state: GameState, words: { direction: string; shift: number }[]): ResearchWord[] {
  if (!state.research?.shares) return [];
  const seen = new Set<string>();
  return words.flatMap((w) => {
    if (!(RESEARCH_DIRECTIONS as readonly string[]).includes(w.direction) || seen.has(w.direction)) return [];
    const shift = Math.round(clamp(Number(w.shift) || 0, -MAX_SHIFT, MAX_SHIFT));
    if (!shift) return [];
    seen.add(w.direction);
    return [{ direction: w.direction as ResearchDirection, shift }];
  });
}

/** The game master's shifts of the split, in the record of the turn. Mutates `next`. */
export function applyResearchWords(next: GameState, words: { direction: string; shift: number }[], applied: AppliedChange[]): void {
  for (const w of sanitizeResearch(next, words)) {
    const research = next.research;
    if (!research?.shares) return;
    const shares = shiftShares(research.shares, w.direction, w.shift);
    const moved = shares[w.direction] - research.shares[w.direction];
    if (!moved) continue;
    next.research = { ...research, shares };
    applied.push({ kind: "research", project: w.direction, change: "focus", shift: moved });
  }
}

/**
 * Moves the player's research through a turn of `years` ending on `to`:
 * every direction gains the years of technology its pace buys, the dice
 * set some back and carry others forward, breakthroughs whose year a
 * direction passes are made, the atomic programme advances (and gives the
 * bomb), and industry and communications ahead of the world lift GDP.
 * Mutates `next`.
 */
export function advanceResearch(next: GameState, years: number, applied: AppliedChange[], to: string): void {
  const research = next.research;
  const economy = next.countries[next.player]?.economy;
  if (!research?.shares || !research.tech || !economy || years <= 0) return;
  const game = next.seed ?? next.id;
  const months = years * 12;
  const competence = officialAt(next, "science")?.competence ?? 3;
  const chance = 1 - 0.995 ** months;
  const after = yearFraction(to);
  const tech = { ...research.tech };
  const done = [...research.done];
  const made = new Set(done.map((d) => d.id));
  for (const d of RESEARCH_DIRECTIONS) {
    const before = techYear(next, d);
    let reached = before + researchRate(next, d) * years;
    if ((research.shares[d] ?? 0) >= DICE_SHARE) {
      const r = roll(game, next.turn, `research:${d}`);
      const size = 0.3 + 0.5 * roll(game, next.turn, `research:${d}:size`);
      if (r < chance * (1.3 - 0.1 * competence)) {
        reached = Math.max(before, reached - size);
        applied.push({ kind: "research", project: d, change: "setback" });
      } else if (r > 1 - chance * (0.7 + 0.1 * competence)) {
        reached += size;
        applied.push({ kind: "research", project: d, change: "lucky" });
      }
    }
    // The breakthroughs are read off the kept year, so none falls between two turns.
    reached = round4(reached);
    tech[d] = reached;
    for (const b of breakthroughsOf(d)) {
      if (b.year <= before || b.year > reached || made.has(b.id)) continue;
      // Dated, and set against history, by when in the turn the direction got there.
      const at = after - years + years * clamp((b.year - before) / Math.max(0.01, reached - before), 0, 1);
      done.push({ id: b.id, date: monthOf(at) });
      made.add(b.id);
      applied.push({ kind: "research", project: b.id, change: "done", ahead: round2(b.year - at) });
    }
  }
  // The atomic programme, for a country without the bomb.
  const bomb = bombStatus(next);
  let progress = research.bomb;
  if (!bomb.has && bomb.running) {
    const gained = bombRate(next) * years;
    progress = Math.min(1, (research.bomb ?? 0) + gained);
    const arsenal = next.countries[next.player].arsenal;
    if (progress >= 1 && arsenal) {
      arsenal.nuclear = true;
      progress = undefined;
      if (!made.has("nuclear")) {
        const at = after - years + years * clamp((1 - (research.bomb ?? 0)) / Math.max(0.001, gained), 0, 1);
        done.push({ id: "nuclear", date: monthOf(at) });
        applied.push({ kind: "research", project: "nuclear", change: "done", ahead: round2(1945 - at) });
      }
    }
  }
  if (bomb.has) progress = undefined;
  const was = outputBonus({ research, date: next.date });
  next.research = { shares: research.shares, ...(research.base ? { base: research.base } : {}), tech, ...(progress !== undefined ? { bomb: Math.round(progress * 1000) / 1000 } : {}), done };
  // Industry and communications gaining on the world raise the economy's output, and taxes with it; falling behind lowers them.
  const ratio = (1 + outputBonus({ research: next.research, date: to })) / (1 + was);
  if (ratio !== 1) {
    economy.gdp = money(economy.gdp * ratio);
    economy.budget.revenue = money(economy.budget.revenue * ratio);
  }
}

/** "military 25% (+1.2 yr)": a direction for the game master. */
const directionLine = (state: PaceState, d: ResearchDirection) => {
  const ahead = aheadOf(state, d);
  return `${d} ${state.research?.shares?.[d] ?? 0}% (${ahead >= 0 ? "+" : "−"}${Math.abs(ahead).toFixed(1)} yr)`;
};

/** The player's research for the game master, in a line or two: the split, how far ahead or behind each direction is, the bomb, recent breakthroughs. */
export function describeResearch(state: GameState): string[] {
  const research = state.research;
  if (!research?.shares) return [];
  const bomb = bombStatus(state);
  const programme = !bomb.has && bomb.progress > 0 ? `; atomic programme ${Math.round(bomb.progress * 100)}%${bomb.running ? "" : " (stalled)"}` : "";
  const lines = ["", `RESEARCH OF THE PLAYER'S GOVERNMENT (share of the research money; technology against the calendar): ${RESEARCH_DIRECTIONS.map((d) => directionLine(state, d)).join(", ")}${programme}`];
  const recent = research.done.slice(-3).flatMap((d) => {
    const b = breakthroughOf(d.id);
    return b ? [`${b.name.en} (${d.date.slice(0, 7)}, history: ${b.year})`] : [];
  });
  if (recent.length) lines.push(`- recent breakthroughs: ${recent.join("; ")}`);
  return lines;
}

/** The directions the old research projects belonged to, with the year history made them. */
const OLD_PROJECTS: Record<string, { direction: ResearchDirection; year: number }> = {
  rockets: { direction: "strategic", year: 1944 },
  nuclear: { direction: "strategic", year: 1945 },
  satellites: { direction: "strategic", year: 1957 },
  antibiotics: { direction: "medicine", year: 1942 },
  biotech: { direction: "medicine", year: 2003 },
  computing: { direction: "communications", year: 1946 },
  internet: { direction: "communications", year: 1991 },
  ai: { direction: "communications", year: 2025 },
  automation: { direction: "industry", year: 1961 },
  green: { direction: "agriculture", year: 1965 },
};

/** An old project's direction and year: a generation of weapons belongs to the military direction. */
function oldProject(id: string): { direction: ResearchDirection; year: number } | null {
  const [prefix, kind, n] = id.split(":");
  if (prefix !== "gen") return OLD_PROJECTS[id] ?? null;
  if (!(WEAPON_KINDS as readonly string[]).includes(kind)) return null;
  const year = LEVEL_YEARS[kind as WeaponKind][Number(n) - 1];
  return year ? { direction: "military", year } : null;
}

/** No direction is carried by an old save more than this many years ahead of history. */
const MAX_CARRIED = 10;

/**
 * A save from before research directions (migration step 16): the default
 * split; each direction as far ahead of the calendar as the save's projects
 * took it — a finished one still ahead of history to its year, an
 * unfinished one by its progress toward it; an unfinished bomb as the
 * atomic programme; finished projects kept as breakthroughs.
 */
export function migrateResearch<T extends StartState & Pick<GameState, "research" | "countries">>(state: T): T {
  const old = state.research as (Partial<Research> & { active?: Research["active"]; done?: Research["done"] }) | undefined;
  if (old?.shares && old.tech) return state;
  const research = startingResearch(state);
  const now = yearFraction(state.date);
  const reach = (d: ResearchDirection, year: number) => {
    research.tech[d] = round2(Math.max(research.tech[d], Math.min(year, now + MAX_CARRIED)));
  };
  for (const d of old?.done ?? []) {
    const p = oldProject(d.id);
    if (p && p.year > now) reach(p.direction, p.year);
  }
  for (const a of old?.active ?? []) {
    const p = oldProject(a.id);
    if (!p) continue;
    if (a.id === "nuclear" && !state.countries[state.player]?.arsenal?.nuclear) research.bomb = Math.round(Math.min(0.99, a.progress) * 1000) / 1000;
    if (p.year > now) reach(p.direction, now + clamp(a.progress, 0, 1) * (p.year - now));
  }
  research.done = [...(old?.done ?? [])];
  return { ...state, research };
}

import { LEVEL_YEARS, NUCLEAR_SINCE } from "./arsenal";
import { BOMB_SHARE, bombStatus } from "./atom";
import { roll } from "./dice";
import { officialAt } from "./government";
import { money, RESEARCH_POOL } from "./economy";
import { aheadOf, outputBonus, techYear, yearFraction } from "./researchEffects";
import { regimeNow } from "./role";
import { describeSpace, MAX_SHARE, startShareOf } from "./space";
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
  /** When history made it: the year with its fraction (1957.76 is Sputnik's 4 October). */
  year: number;
  name: Localized;
  effect: Localized;
  /** The atomic bomb: made by the bomb programme, not by the direction's year alone. */
  bomb?: boolean;
}

/** A breakthrough on the day history made it: its year with its fraction, so none falls on the first of January by itself. */
const B = (direction: ResearchDirection, id: string, date: string, name: Localized, effect: Localized, bomb?: boolean): Breakthrough => ({ id, direction, year: Math.round(yearFraction(date) * 1000) / 1000, name, effect, ...(bomb ? { bomb } : {}) });
const L = (en: string, ru: string, uk: string): Localized => ({ en, ru, uk });

/**
 * The named breakthroughs of each direction, on the day history made them
 * (the first in battle, in service or in print; a day in mid-year where a
 * generation had none, and for the years still to come). The military ones
 * mark the generations of weapons arsenal.ts's LEVEL_YEARS count; the ids of
 * the old research projects are kept for their namesakes, so a save's
 * finished projects read as breakthroughs. Each effect says what changes.
 */
export const BREAKTHROUGHS: Breakthrough[] = [
  B("military", "tanks", "1916-09-15", L("Tanks and anti-aircraft guns", "Танки и зенитные орудия", "Танки та зенітні гармати"), L("Tanks cross trenches under fire; guns are turned on aircraft", "Танки проходят через окопы под огнём; орудия начинают бить по самолётам", "Танки долають окопи під вогнем; гармати починають бити по літаках")),
  B("military", "motorised", "1925-07-01", L("Motorised artillery", "Моторизованная артиллерия", "Моторизована артилерія"), L("Guns move behind tractors and lorries and keep up with the troops", "Орудия идут за тягачами и грузовиками и не отстают от войск", "Гармати рухаються за тягачами й вантажівками й не відстають від військ")),
  B("military", "monoplanes", "1930-05-06", L("Monoplanes and interwar tanks", "Монопланы и межвоенные танки", "Моноплани та міжвоєнні танки"), L("All-metal monoplanes fly faster and higher; tanks get turrets and radios", "Цельнометаллические монопланы летают быстрее и выше; у танков башни и рации", "Суцільнометалеві моноплани літають швидше й вище; у танків башти й рації")),
  B("military", "radar", "1935-02-26", L("Radar", "Радиолокация", "Радіолокація"), L("Aircraft are seen beyond the horizon; anti-aircraft fire is aimed; fleets add fast battleships and carriers", "Самолёты видны из-за горизонта; зенитный огонь становится прицельным; во флоте появляются быстроходные линкоры и авианосцы", "Літаки видно з-за обрію; зенітний вогонь стає прицільним; у флоті з'являються швидкохідні лінкори й авіаносці")),
  B("military", "self-loading", "1940-04-13", L("Self-loading rifles", "Самозарядные винтовки", "Самозарядні гвинтівки"), L("Infantry fire faster: self-loading rifles and sub-machine guns", "Пехота стреляет чаще: самозарядные винтовки и пистолеты-пулемёты", "Піхота стріляє частіше: самозарядні гвинтівки й пістолети-кулемети")),
  B("military", "heavy-armour", "1943-07-05", L("Heavy armour and rocket artillery", "Тяжёлая броня и реактивная артиллерия", "Важка броня та реактивна артилерія"), L("Thicker armour and longer guns on tanks; rocket launchers fire whole salvoes", "Броня толще и пушки длиннее у танков; реактивные установки бьют залпами", "Броня товща й гармати довші в танків; реактивні установки б'ють залпами")),
  B("military", "jets", "1944-07-25", L("Jet engines", "Реактивные двигатели", "Реактивні двигуни"), L("Jet fighters outrun propeller aircraft; radar guides ships and anti-aircraft guns", "Реактивные истребители обгоняют винтовые; радар наводит корабли и зенитки", "Реактивні винищувачі обганяють гвинтові; радар наводить кораблі й зенітки")),
  B("military", "assault-rifles", "1947-11-15", L("Assault rifles", "Автоматы", "Автомати"), L("An automatic rifle for every infantryman", "Автомат у каждого пехотинца", "Автомат у кожного піхотинця")),
  B("military", "supersonic", "1955-03-01", L("Supersonic jets and main battle tanks", "Сверхзвуковые самолёты и основные танки", "Надзвукові літаки й основні танки"), L("Fighters break the sound barrier; one main battle tank replaces the medium and heavy ones", "Истребители преодолевают звуковой барьер; основной танк заменяет средние и тяжёлые", "Винищувачі долають звуковий бар'єр; основний танк замінює середні й важкі")),
  B("military", "sam", "1957-12-11", L("Surface-to-air missiles", "Зенитные ракеты", "Зенітні ракети"), L("Guided missiles bring down bombers at high altitude", "Управляемые ракеты сбивают бомбардировщики на большой высоте", "Керовані ракети збивають бомбардувальники на великій висоті")),
  B("military", "missile-ships", "1960-11-15", L("Missile ships and self-propelled guns", "Ракетные корабли и самоходные орудия", "Ракетні кораблі й самохідні гармати"), L("Ships and submarines carry missiles; guns move on their own tracks; infantry weapons get lighter", "Корабли и подлодки несут ракеты; орудия становятся самоходными; стрелковое оружие легче", "Кораблі й підводні човни несуть ракети; гармати стають самохідними; стрілецька зброя легша")),
  B("military", "precision", "1975-07-01", L("Precision-guided munitions", "Высокоточное оружие", "Високоточна зброя"), L("Laser- and television-guided bombs destroy a bridge in one sortie", "Бомбы с лазерным и телевизионным наведением разрушают мост за один вылет", "Бомби з лазерним і телевізійним наведенням руйнують міст за один виліт")),
  B("military", "composite", "1979-10-25", L("Composite armour and modern missiles", "Композитная броня и современные ракеты", "Композитна броня й сучасні ракети"), L("Composite armour stops most anti-tank rounds; air defence and ships get modern missiles", "Композитная броня держит большинство противотанковых снарядов; у ПВО и флота современные ракеты", "Композитна броня тримає більшість протитанкових снарядів; у ППО та флоту сучасні ракети")),
  B("military", "drones", "1982-06-09", L("Reconnaissance drones", "Разведывательные дроны", "Розвідувальні дрони"), L("Small unmanned aircraft watch the battlefield and find targets", "Небольшие беспилотники следят за полем боя и находят цели", "Невеликі безпілотники стежать за полем бою й знаходять цілі")),
  B("military", "night-vision", "1990-06-01", L("Night sights and optics", "Ночные прицелы и оптика", "Нічні приціли й оптика"), L("Infantry fight at night with thermal and night sights", "Пехота воюет ночью с тепловизорами и ночными прицелами", "Піхота воює вночі з тепловізорами й нічними прицілами")),
  B("military", "armed-drones", "2001-10-07", L("Armed drones", "Ударные дроны", "Ударні дрони"), L("Drones carry missiles and strike what they find", "Беспилотники несут ракеты и бьют по тому, что находят", "Безпілотники несуть ракети й б'ють по тому, що знаходять")),
  B("military", "stealth", "2005-12-15", L("Stealth aircraft and guided shells", "Малозаметные самолёты и управляемые снаряды", "Малопомітні літаки й керовані снаряди"), L("Aircraft radar barely sees; artillery shells guided to within metres", "Самолёты, которые радар почти не видит; артиллерийские снаряды с точностью до метров", "Літаки, яких радар майже не бачить; артилерійські снаряди з точністю до метрів")),
  B("military", "active-protection", "2010-07-01", L("Active protection and long-range drones", "Активная защита и дальнобойные дроны", "Активний захист і далекобійні дрони"), L("Tanks shoot down the missiles fired at them; drones reach far behind the front", "Танки сбивают летящие в них ракеты; дроны достают далеко за линию фронта", "Танки збивають ракети, що летять у них; дрони дістають далеко за лінію фронту")),
  B("military", "loitering", "2020-09-27", L("Loitering munitions", "Барражирующие боеприпасы", "Баражувальні боєприпаси"), L("Cheap munitions circle over the front and dive on targets", "Дешёвые боеприпасы кружат над фронтом и пикируют на цели", "Дешеві боєприпаси кружляють над фронтом і пікірують на цілі")),
  B("military", "swarms", "2030-07-01", L("Drone swarms", "Рои дронов", "Рої дронів"), L("Hundreds of drones attack together; the game master weighs it in battle", "Сотни дронов атакуют вместе; ведущий учтёт это в боях", "Сотні дронів атакують разом; ведучий врахує це в боях")),

  B("industry", "electrification", "1920-12-22", L("Electrified factories", "Электрификация заводов", "Електрифікація заводів"), L("Electric motors drive the machine tools", "Станки работают от электромоторов", "Верстати працюють від електромоторів")),
  B("industry", "synthetics", "1936-10-18", L("Synthetic fuel and rubber", "Синтетическое топливо и каучук", "Синтетичне паливо й каучук"), L("Fuel and rubber are made from coal", "Топливо и каучук делают из угля", "Пальне й каучук роблять з вугілля")),
  B("industry", "mass-production", "1942-11-12", L("Mass production", "Массовое производство", "Масове виробництво"), L("Ships, tanks and aircraft come off assembly lines in days", "Корабли, танки и самолёты сходят с конвейера за дни", "Кораблі, танки й літаки сходять з конвеєра за дні")),
  B("industry", "nuclear-power", "1954-06-27", L("Nuclear power", "Атомная энергетика", "Атомна енергетика"), L("The first reactors feed the grid", "Первые реакторы дают ток в сеть", "Перші реактори дають струм у мережу")),
  B("industry", "automation", "1961-06-01", L("Factory automation", "Автоматизация заводов", "Автоматизація заводів"), L("Machine tools follow a programme without an operator", "Станки работают по программе без станочника", "Верстати працюють за програмою без верстатника")),
  B("industry", "robots", "1978-06-01", L("Industrial robots", "Промышленные роботы", "Промислові роботи"), L("Robots weld and paint on the assembly line", "Роботы варят и красят на конвейере", "Роботи зварюють і фарбують на конвеєрі")),
  B("industry", "cad", "1990-06-01", L("Computer-aided manufacturing", "Компьютерное проектирование и производство", "Комп'ютерне проєктування й виробництво"), L("Parts are designed on computers and cut by computer-run machines", "Детали проектируют на компьютере и режут на станках с программным управлением", "Деталі проєктують на комп'ютері й ріжуть на верстатах із програмним керуванням")),
  B("industry", "renewables", "2012-06-01", L("Cheap solar and wind power", "Дешёвая солнечная и ветровая энергия", "Дешева сонячна й вітрова енергія"), L("Solar and wind power cost less than a new coal plant", "Солнечная и ветровая энергия дешевле новой угольной станции", "Сонячна й вітрова енергія дешевша за нову вугільну станцію")),
  B("industry", "industrial-ai", "2028-07-01", L("AI-run factories", "Заводы под управлением ИИ", "Заводи під керуванням ШІ"), L("Factories run with few workers", "Заводы работают почти без рабочих", "Заводи працюють майже без робітників")),

  B("agriculture", "nitrogen", "1920-06-01", L("Synthetic fertiliser", "Синтетические удобрения", "Синтетичні добрива"), L("Fertiliser is made from the nitrogen of the air", "Удобрения делают из азота воздуха", "Добрива роблять з азоту повітря")),
  B("agriculture", "tractors", "1928-10-01", L("Tractors and combines", "Тракторы и комбайны", "Трактори й комбайни"), L("Tractors and combines do the work of many hands", "Тракторы и комбайны заменяют многие руки", "Трактори й комбайни замінюють багато рук")),
  B("agriculture", "hybrid", "1940-06-01", L("Hybrid seed", "Гибридные семена", "Гібридне насіння"), L("Hybrid maize gives more grain per hectare", "Гибридная кукуруза даёт больше зерна с гектара", "Гібридна кукурудза дає більше зерна з гектара")),
  B("agriculture", "pesticides", "1946-03-01", L("Pesticides", "Пестициды", "Пестициди"), L("Chemicals keep pests off the fields", "Химия защищает поля от вредителей", "Хімія захищає поля від шкідників")),
  B("agriculture", "green", "1966-11-28", L("The green revolution", "Зелёная революция", "Зелена революція"), L("New wheat and rice double the yield where they are sown", "Новые сорта пшеницы и риса удваивают урожай там, где их сеют", "Нові сорти пшениці й рису подвоюють урожай там, де їх сіють")),
  B("agriculture", "irrigation", "1978-06-01", L("Drip irrigation", "Капельное орошение", "Крапельне зрошення"), L("Drip irrigation brings harvests from dry land", "Капельное орошение даёт урожай на сухих землях", "Крапельне зрошення дає врожай на сухих землях")),
  B("agriculture", "gm-crops", "1996-04-01", L("Genetically modified crops", "Генно-модифицированные культуры", "Генно-модифіковані культури"), L("Crops bred to resist pests and herbicides", "Культуры, устойчивые к вредителям и гербицидам", "Культури, стійкі до шкідників і гербіцидів")),
  B("agriculture", "precision-farming", "2010-06-01", L("Precision farming", "Точное земледелие", "Точне землеробство"), L("Machines guided by satellite sow and spray to the metre", "Техника по спутнику сеет и опрыскивает с точностью до метра", "Техніка за супутником сіє й обприскує з точністю до метра")),
  B("agriculture", "gene-edited", "2027-07-01", L("Gene-edited crops", "Культуры с редактированным геномом", "Культури з редагованим геномом"), L("Gene-edited crops give more grain from the same land", "Культуры с редактированным геномом дают больше зерна с той же земли", "Культури з редагованим геномом дають більше зерна з тієї ж землі")),

  B("medicine", "transfusion", "1917-11-20", L("Blood banks", "Банки крови", "Банки крові"), L("Stored blood saves the badly wounded", "Консервированная кровь спасает тяжелораненых", "Консервована кров рятує тяжкопоранених")),
  B("medicine", "insulin", "1922-01-11", L("Insulin", "Инсулин", "Інсулін"), L("Diabetics live on insulin", "Диабетики живут на инсулине", "Діабетики живуть на інсуліні")),
  B("medicine", "sulfa", "1935-02-15", L("Sulfa drugs", "Сульфаниламиды", "Сульфаніламіди"), L("The first drugs that cure infections", "Первые лекарства, излечивающие инфекции", "Перші ліки, що виліковують інфекції")),
  B("medicine", "antibiotics", "1942-03-14", L("Antibiotics", "Антибиотики", "Антибіотики"), L("Penicillin cures infected wounds and pneumonia", "Пенициллин лечит заражённые раны и пневмонию", "Пеніцилін лікує заражені рани й пневмонію")),
  B("medicine", "polio", "1955-04-12", L("The polio vaccine", "Вакцина от полиомиелита", "Вакцина від поліомієліту"), L("Children are vaccinated against polio", "Детей прививают от полиомиелита", "Дітей щеплять від поліомієліту")),
  B("medicine", "transplants", "1967-12-03", L("Organ transplants", "Пересадка органов", "Пересадка органів"), L("Hearts and kidneys are transplanted", "Пересаживают сердце и почки", "Пересаджують серце й нирки")),
  B("medicine", "ct", "1975-06-01", L("CT scanners", "Компьютерная томография", "Комп'ютерна томографія"), L("Scanners show the inside of the body", "Томографы показывают тело изнутри", "Томографи показують тіло зсередини")),
  B("medicine", "statins", "1987-08-31", L("Statins", "Статины", "Статини"), L("Drugs lower cholesterol and the number of heart attacks", "Лекарства снижают холестерин и число инфарктов", "Ліки знижують холестерин і кількість інфарктів")),
  B("medicine", "antiretrovirals", "1996-07-07", L("Drugs against HIV", "Лекарства от ВИЧ", "Ліки від ВІЛ"), L("Combined drugs hold HIV back", "Комбинированная терапия сдерживает ВИЧ", "Комбінована терапія стримує ВІЛ")),
  B("medicine", "biotech", "2003-04-14", L("Biotechnology", "Биотехнологии", "Біотехнології"), L("Medicines designed from the human genome", "Лекарства, созданные на основе генома человека", "Ліки, створені на основі геному людини")),
  B("medicine", "mrna", "2020-12-11", L("mRNA vaccines", "мРНК-вакцины", "мРНК-вакцини"), L("A vaccine within a year of a new disease", "Вакцина в течение года после появления болезни", "Вакцина протягом року після появи хвороби")),
  B("medicine", "gene-therapy", "2030-07-01", L("Gene therapy", "Генная терапия", "Генна терапія"), L("Inherited diseases treated by repairing genes", "Наследственные болезни лечат, исправляя гены", "Спадкові хвороби лікують, виправляючи гени")),

  B("science", "quantum", "1926-01-27", L("Quantum mechanics", "Квантовая механика", "Квантова механіка"), L("Atoms and their radiation can be calculated", "Атомы и их излучение поддаются расчёту", "Атоми та їхнє випромінювання піддаються розрахунку")),
  B("science", "fission", "1938-12-17", L("Nuclear fission", "Деление ядра", "Поділ ядра"), L("Uranium nuclei split and release energy: an atomic programme becomes possible", "Ядра урана делятся с выделением энергии: атомная программа становится возможной", "Ядра урану діляться з виділенням енергії: атомна програма стає можливою")),
  B("science", "big-science", "1946-08-01", L("State laboratories", "Государственные лаборатории", "Державні лабораторії"), L("The state keeps laboratories of thousands", "Государство содержит лаборатории на тысячи человек", "Держава утримує лабораторії на тисячі людей")),
  B("science", "universities", "1960-06-01", L("Mass higher education", "Массовое высшее образование", "Масова вища освіта"), L("Universities train engineers by the hundred thousand", "Университеты выпускают инженеров сотнями тысяч", "Університети випускають інженерів сотнями тисяч")),
  B("science", "supercomputers", "1976-03-04", L("Supercomputers", "Суперкомпьютеры", "Суперкомп'ютери"), L("Computers model the weather, bombs and aircraft", "Компьютеры моделируют погоду, бомбы и самолёты", "Комп'ютери моделюють погоду, бомби й літаки")),
  B("science", "space-telescopes", "1990-04-24", L("Space telescopes", "Космические телескопы", "Космічні телескопи"), L("Telescopes in orbit see without the atmosphere in the way", "Телескопы на орбите видят без помех атмосферы", "Телескопи на орбіті бачать без завад атмосфери")),
  B("science", "colliders", "2008-09-10", L("Giant colliders", "Гигантские коллайдеры", "Гігантські колайдери"), L("Particle physics at the highest energies", "Физика частиц на предельных энергиях", "Фізика частинок на граничних енергіях")),
  B("science", "quantum-computers", "2019-10-23", L("Quantum computers", "Квантовые компьютеры", "Квантові комп'ютери"), L("Quantum processors solve tasks beyond ordinary computers", "Квантовые процессоры решают задачи, недоступные обычным компьютерам", "Квантові процесори розв'язують задачі, недоступні звичайним комп'ютерам")),
  B("science", "ai-science", "2030-07-01", L("AI in the laboratory", "ИИ в лабораториях", "ШІ в лабораторіях"), L("Machines propose and test hypotheses", "Машины выдвигают и проверяют гипотезы", "Машини висувають і перевіряють гіпотези")),

  B("communications", "radio", "1920-11-02", L("Radio broadcasting", "Радиовещание", "Радіомовлення"), L("Broadcasts reach every home with a receiver", "Радиопередачи доходят до каждого дома с приёмником", "Радіопередачі доходять до кожного дому з приймачем")),
  B("communications", "television", "1936-11-02", L("Television", "Телевидение", "Телебачення"), L("Regular television broadcasts", "Регулярное телевещание", "Регулярне телемовлення")),
  B("communications", "computing", "1947-12-23", L("Transistors and computers", "Транзисторы и ЭВМ", "Транзистори та ЕОМ"), L("The transistor; electronic computers calculate for the state", "Транзистор; электронные машины считают для государства", "Транзистор; електронні машини рахують для держави")),
  B("communications", "chips", "1959-07-30", L("Integrated circuits", "Интегральные схемы", "Інтегральні схеми"), L("Whole circuits on one chip", "Целые схемы на одном кристалле", "Цілі схеми на одному кристалі")),
  B("communications", "pc", "1977-06-10", L("Personal computers", "Персональные компьютеры", "Персональні комп'ютери"), L("Computers small and cheap enough for offices and homes", "Компьютеры достаточно малы и дёшевы для контор и домов", "Комп'ютери досить малі й дешеві для контор і домівок")),
  B("communications", "mobile", "1983-10-13", L("Mobile phones", "Мобильная связь", "Мобільний зв'язок"), L("Telephones without wires", "Телефоны без проводов", "Телефони без дротів")),
  B("communications", "internet", "1991-08-06", L("The internet", "Интернет", "Інтернет"), L("Computers worldwide joined in one network", "Компьютеры всего мира в одной сети", "Комп'ютери всього світу в одній мережі")),
  B("communications", "smartphones", "2007-06-29", L("Smartphones", "Смартфоны", "Смартфони"), L("The internet in every pocket", "Интернет в каждом кармане", "Інтернет у кожній кишені")),
  B("communications", "ai", "2025-06-01", L("Artificial intelligence", "Искусственный интеллект", "Штучний інтелект"), L("Language models read, write and translate", "Языковые модели читают, пишут и переводят", "Мовні моделі читають, пишуть і перекладають")),
  B("communications", "6g", "2032-07-01", L("Sixth-generation networks", "Сети шестого поколения", "Мережі шостого покоління"), L("Every device connected", "Все устройства на связи", "Усі пристрої на зв'язку")),

  // The rockets the space programme needs (engine/space.ts): the feats themselves are its launches.
  B("strategic", "liquid-rockets", "1926-03-16", L("Liquid-fuel rockets", "Жидкостные ракеты", "Рідинні ракети"), L("Rockets on liquid fuel fly: the beginning of missiles and spaceflight", "Летают ракеты на жидком топливе: начало боевых ракет и космонавтики", "Літають ракети на рідкому паливі: початок бойових ракет і космонавтики")),
  B("strategic", "rockets", "1944-09-08", L("Rocketry", "Ракетная техника", "Ракетна техніка"), L("Ballistic missiles strike cities hundreds of kilometres away", "Баллистические ракеты поражают города за сотни километров", "Балістичні ракети уражають міста за сотні кілометрів")),
  B("strategic", "nuclear", "1945-07-16", L("The atomic bomb", "Атомная бомба", "Атомна бомба"), L("One bomb destroys a city", "Одна бомба уничтожает город", "Одна бомба знищує місто"), true),
  B("strategic", "satellites", "1957-10-04", L("Satellites and intercontinental missiles", "Спутники и межконтинентальные ракеты", "Супутники й міжконтинентальні ракети"), L("Missiles reach another continent; the first satellites open the way to reconnaissance from orbit", "Ракеты достают до другого континента; первые спутники открывают путь к разведке с орбиты", "Ракети дістають до іншого континенту; перші супутники відкривають шлях до розвідки з орбіти")),
  B("strategic", "spaceflight", "1961-04-12", L("Crewed spacecraft", "Пилотируемые корабли", "Пілотовані кораблі"), L("Capsules that bring a crew back from orbit", "Капсулы, которые возвращают экипаж с орбиты", "Капсули, що повертають екіпаж з орбіти")),
  B("strategic", "moon", "1969-07-20", L("Moon rockets", "Лунные ракеты", "Місячні ракети"), L("Rockets that carry a crew to the Moon and back", "Ракеты, способные доставить экипаж к Луне и обратно", "Ракети, здатні доставити екіпаж до Місяця й назад")),
  B("strategic", "gps", "1993-12-08", L("Satellite navigation", "Спутниковая навигация", "Супутникова навігація"), L("Satellites give armies and ships their position to within metres", "Спутники дают армии и флоту их координаты с точностью до метров", "Супутники дають армії й флоту їхні координати з точністю до метрів")),
  B("strategic", "reusable", "2015-12-21", L("Reusable rockets", "Многоразовые ракеты", "Багаторазові ракети"), L("Rocket stages land and fly again: a launch costs a fraction of what it did", "Ступени ракет садятся и летают снова: запуск стоит в разы дешевле", "Ступені ракет сідають і літають знову: запуск коштує в рази дешевше")),
  B("strategic", "hypersonic", "2019-12-27", L("Hypersonic missiles", "Гиперзвуковые ракеты", "Гіперзвукові ракети"), L("Missiles at many times the speed of sound that air defence can hardly stop", "Ракеты в несколько скоростей звука, которые ПВО почти не сбивает", "Ракети в кілька швидкостей звуку, які ППО майже не збиває")),
  B("strategic", "lunar-base", "2030-07-01", L("A base on the Moon", "База на Луне", "База на Місяці"), L("People live and work on the Moon", "Люди живут и работают на Луне", "Люди живуть і працюють на Місяці")),
];

const BY_ID = new Map(BREAKTHROUGHS.map((b) => [b.id, b]));

/** A breakthrough by its id. */
export const breakthroughOf = (id: string): Breakthrough | undefined => BY_ID.get(id);

/** A direction's breakthroughs in the order history made them; the bomb, made by its programme, left out. */
export const breakthroughsOf = (direction: ResearchDirection): Breakthrough[] => BREAKTHROUGHS.filter((b) => b.direction === direction && !b.bomb);

/** The shares of the army and industry budgets that go to research: kept with the books (engine/economy.ts), which spend the industry line once. */
export { RESEARCH_POOL };
/** What an era's government normally puts into research, as a share of GDP: the pools at the era's usual budget (economy.ts). History's pace is kept at it. */
const NORM: Record<ScenarioId, number> = { "1914": 0.01, "1933": 0.014, "1939": 0.017, "1950": 0.022, "1957": 0.023, "1964": 0.024, "1973": 0.023, "1979": 0.021, "1991": 0.018, "1999": 0.0164, "2014": 0.0156, "2022": 0.016 };

/** How an era's governments split their research: a new game's split before its government's lean. */
const BASE: Record<ScenarioId, Record<ResearchDirection, number>> = {
  "1914": { military: 22, industry: 22, agriculture: 16, medicine: 10, science: 14, communications: 11, strategic: 5 },
  "1933": { military: 20, industry: 22, agriculture: 15, medicine: 11, science: 14, communications: 12, strategic: 6 },
  "1939": { military: 25, industry: 20, agriculture: 12, medicine: 10, science: 13, communications: 12, strategic: 8 },
  "1950": { military: 20, industry: 18, agriculture: 12, medicine: 12, science: 13, communications: 12, strategic: 13 },
  "1957": { military: 19, industry: 17, agriculture: 11, medicine: 12, science: 13, communications: 12, strategic: 16 },
  "1964": { military: 18, industry: 17, agriculture: 11, medicine: 13, science: 14, communications: 13, strategic: 14 },
  "1973": { military: 17, industry: 17, agriculture: 10, medicine: 14, science: 14, communications: 15, strategic: 13 },
  "1979": { military: 17, industry: 17, agriculture: 10, medicine: 14, science: 14, communications: 16, strategic: 12 },
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
/** The atomic programme runs while strategic programmes get at least this share (engine/atom.ts). */
export { BOMB_SHARE, bombStatus };
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
export function researchMoney(state: Pick<GameState, "countries" | "player" | "scenarioId"> & Partial<Pick<GameState, "space">>): { pool: number; ratio: number; usual: number } {
  const e = state.countries[state.player]?.economy;
  if (!e) return { pool: 0, ratio: 1, usual: 0 };
  // The space programme takes its share first (engine/space.ts): rockets to the Moon compete with every other laboratory.
  // History's pace was kept with history's programme, so what the era's government put into it is left out of the usual too.
  const space = Math.min(MAX_SHARE, Math.max(0, state.space?.programmes[state.player]?.share ?? 0)) / 100;
  const historical = Math.min(MAX_SHARE, startShareOf(state.scenarioId, state.player) ?? 0) / 100;
  const pool = (e.budget.army * RESEARCH_POOL.army + e.budget.industry * RESEARCH_POOL.industry) * (1 - space);
  const usual = Math.max(0.01, e.gdp) * NORM[state.scenarioId] * (1 - historical);
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
  // Measured before the space programme takes its share: a country's means, not its choice.
  return clamp(Math.sqrt(researchMoney({ ...state, space: undefined }).pool / (largest * NORM[state.scenarioId])), 0.4, 1);
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

/**
 * The pace of the player's atomic programme, years of its work a year
 * (engine/atom.ts): what the strategic direction's money buys, quicker once
 * the world knows how; nothing while the programme cannot run.
 */
export function playerAtomRate(state: PaceState & Partial<Pick<GameState, "atom">>): number {
  const bomb = bombStatus(state);
  if (bomb.has || !bomb.running) return 0;
  const known = clamp(1 - Math.max(0, yearFraction(state.date) - 1945) / 100, 0.5, 1);
  return investment(state, "strategic") / known;
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
 * direction passes are made, and industry and communications ahead of the
 * world lift GDP. The atomic programme runs on its own (engine/atom.ts), at
 * the pace the strategic direction buys (playerAtomRate). Mutates `next`.
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
  // The atomic programme runs on its own, at the pace the strategic direction buys (engine/atom.ts, playerAtomRate).
  const was = outputBonus({ research, date: next.date });
  next.research = { shares: research.shares, ...(research.base ? { base: research.base } : {}), tech, ...(research.bomb !== undefined ? { bomb: research.bomb } : {}), done };
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
    return b ? [`${b.name.en} (${d.date.slice(0, 7)}, history: ${Math.floor(b.year)})`] : [];
  });
  if (recent.length) lines.push(`- recent breakthroughs: ${recent.join("; ")}`);
  // The space race reads with the research it runs on (engine/space.ts).
  return [...lines, ...describeSpace(state)];
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

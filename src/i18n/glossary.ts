import type { Locale } from "@/engine/types";

/**
 * The game's terms, explained in a sentence or three, in every language: the
 * hints a highlighted word opens (components/ui/Term.tsx). A text may mark
 * other terms as `[[id]]`, shown as the term's own name, or `[[id|words]]`,
 * shown as those words (a case form, a plural), each opening that term's
 * hint in turn. Interface strings in messages.ts may mark terms the same way
 * where they are drawn through GlossaryText.
 *
 * The texts say what the engine does (src/engine, docs/world.md), no more:
 * a term whose rule changes changes here too.
 */

/** A term's name and its explanation. */
type Entry = readonly [title: string, text: string];

const GLOSSARY = {
  // The economy.
  gdp: {
    en: ["GDP", "Everything the country produces in a year, in dollars of the day. It rises with real [[growth]] and the dollar's own inflation, and with land won; men called up from work take their share of it with them. [[revenue|Taxes]] follow it."],
    ru: ["ВВП", "Всё, что страна производит за год, в долларах своего времени. Растёт с реальным [[growth|ростом]] и инфляцией самого доллара, с приобретёнными землями; призванные с работы уносят с собой свою долю. За ним следуют [[revenue|налоги]]."],
    uk: ["ВВП", "Усе, що країна виробляє за рік, у доларах свого часу. Зростає з реальним [[growth|зростанням]] та інфляцією самого долара, зі здобутими землями; призвані з роботи забирають із собою свою частку. За ним ідуть [[revenue|податки]]."],
  },
  growth: {
    en: ["Growth", "The real rise of [[gdp|GDP]], % a year. It drifts back to the era's trend; [[industryBudget|industry spending]] past the era's usual share and policies add to it; taxes far above the usual take take from it. [[sanctions|Sanctions]], cut imports, a shortage of power and a [[front|war on the country's own soil]] hold output below its level while they last and give it back as they go – a gap, not a fall every year. A debt crisis or runaway [[inflation]] holds growth down whatever else happens. The game master may move it a little for what the turn brings."],
    ru: ["Рост", "Реальный прирост [[gdp|ВВП]], % в год. Тяготеет к тренду эпохи; его ускоряют [[industryBudget|расходы на промышленность]] сверх обычной для эпохи доли и политики, замедляют налоги намного выше обычных. [[sanctions|Санкции]], отрезанный импорт, нехватка электричества и [[front|война на своей земле]] держат выпуск ниже обычного, пока длятся, и возвращают его, когда проходят, – это разрыв, а не падение каждый год. Долговой кризис или безудержная [[inflation|инфляция]] держат рост внизу, что бы ещё ни случилось. Ведущий может немного сдвинуть его по событиям хода."],
    uk: ["Зростання", "Реальний приріст [[gdp|ВВП]], % на рік. Тяжіє до тренду епохи; його прискорюють [[industryBudget|видатки на промисловість]] понад звичну для епохи частку й політики, сповільнюють податки значно вищі за звичні. [[sanctions|Санкції]], відрізаний імпорт, брак електрики й [[front|війна на власній землі]] тримають випуск нижче звичного, поки тривають, і повертають його, коли минають, – це розрив, а не падіння щороку. Боргова криза чи нестримна [[inflation|інфляція]] тримають зростання внизу, хоч би що ще сталося. Ведучий може трохи зсунути його за подіями ходу."],
  },
  budget: {
    en: ["Budget", "The treasury's year: [[revenue]] against the army, industry, social and other lines and the [[interest]] on the debt. A gap is a [[deficit]]; a surplus goes half to paying off the [[debt]] and half to the [[reserves]]."],
    ru: ["Бюджет", "Год казны: [[revenue|доходы]] против армии, промышленности, соцсферы, прочих статей и [[interest|процентов]] по долгу. Разрыв – это [[deficit|дефицит]]; профицит идёт наполовину на погашение [[debt|долга]], наполовину в [[reserves|резервы]]."],
    uk: ["Бюджет", "Рік скарбниці: [[revenue|доходи]] проти армії, промисловості, соцсфери, інших статей і [[interest|відсотків]] за боргом. Розрив – це [[deficit|дефіцит]]; профіцит іде наполовину на погашення [[debt|боргу]], наполовину до [[reserves|резервів]]."],
  },
  revenue: {
    en: ["Revenue", "Taxes and the state's other income. Left alone, it keeps its share of [[gdp|GDP]] as the economy grows. Taxes far past the era's usual take hold [[growth]] back."],
    ru: ["Доходы", "Налоги и прочие доходы государства. Если их не трогать, они сохраняют свою долю [[gdp|ВВП]] по мере роста экономики. Налоги намного выше обычных для эпохи тормозят [[growth|рост]]."],
    uk: ["Доходи", "Податки та інші доходи держави. Якщо їх не чіпати, вони зберігають свою частку [[gdp|ВВП]] у міру зростання економіки. Податки значно вищі за звичні для епохи гальмують [[growth|зростання]]."],
  },
  armyBudget: {
    en: ["Army budget", "Pays, feeds and arms the soldiers; a fifth of it goes to military [[research|research]]. Half of it follows the number of soldiers. Past 8% of GDP it takes [[goods]] from the people: the war economy."],
    ru: ["Военный бюджет", "Жалованье, снабжение и оружие армии; пятая часть идёт на военные [[research|исследования]]. Половина следует за численностью солдат. Свыше 8% ВВП отнимает [[goods|товары]] у населения: это военная экономика."],
    uk: ["Військовий бюджет", "Платня, постачання й зброя армії; п'ята частина йде на військові [[research|дослідження]]. Половина йде за чисельністю солдатів. Понад 8% ВВП забирає [[goods|товари]] в населення: це воєнна економіка."],
  },
  industryBudget: {
    en: ["Industry spending", "Factories, roads and power; three tenths of it goes to [[research|research]]. Past the era's usual share of GDP it raises [[growth]] – less for every doubling – and, over months, the [[goods]] in the shops and the output of mines and wells; below it lowers them."],
    ru: ["Расходы на промышленность", "Заводы, дороги и энергетика; три десятых идёт на [[research|исследования]]. Выше обычной для эпохи доли ВВП ускоряют [[growth|рост]] – каждое удвоение даёт меньше, – а за несколько месяцев [[goods|товары]] в магазинах и добычу шахт и скважин; ниже – снижают их."],
    uk: ["Видатки на промисловість", "Заводи, дороги й енергетика; три десятих іде на [[research|дослідження]]. Понад звичну для епохи частку ВВП прискорюють [[growth|зростання]] – кожне подвоєння дає менше, – а за кілька місяців [[goods|товари]] в крамницях і видобуток шахт і свердловин; нижче – знижують їх."],
  },
  socialBudget: {
    en: ["Social spending", "Schools, hospitals, pensions and homes. Below the era's usual share of GDP, the people's [[housing]] and [[medicine]] go short."],
    ru: ["Социальные расходы", "Школы, больницы, пенсии и жильё. Ниже обычной для эпохи доли ВВП людям не хватает [[housing|жилья]] и [[medicine|медицины]]."],
    uk: ["Соціальні видатки", "Школи, лікарні, пенсії та житло. Нижче звичної для епохи частки ВВП людям бракує [[housing|житла]] й [[medicine|медицини]]."],
  },
  otherBudget: {
    en: ["Other spending", "The administration, police, courts, roads and the rest of the state. Kept below its usual share, the state runs down over months: [[growth]] falls, order and housing suffer. It counts in the [[deficit]] too."],
    ru: ["Прочие расходы", "Управление, полиция, суды, дороги и остальное государство. Если держать их ниже обычной доли, государство за несколько месяцев приходит в упадок: падает [[growth|рост]], страдают порядок и жильё. Учитываются и в [[deficit|дефиците]]."],
    uk: ["Інші видатки", "Управління, поліція, суди, дороги й решта держави. Якщо тримати їх нижче звичної частки, держава за кілька місяців занепадає: падає [[growth|зростання]], страждають порядок і житло. Ураховуються й у [[deficit|дефіциті]]."],
  },
  deficit: {
    en: ["Deficit", "Spending and [[interest]] above [[revenue]] over a year. Part of it comes from the [[reserves]] while they stand above half the era's usual holdings; the rest is borrowed into the [[debt]]. Past 4% of GDP it keeps [[inflation]] up. With reserves below 1% of GDP lenders lend a tenth of GDP a year, nothing once the debt passes 150% of GDP or for three years after a default: the rest is printed, not borrowed. Projects, the Games and warheads paid outside the budget count in it too."],
    ru: ["Дефицит", "Превышение расходов и [[interest|процентов]] над [[revenue|доходами]] за год. Часть покрывают [[reserves|резервы]], пока они выше половины обычного для эпохи уровня; остальное занимают, и оно ложится в [[debt|долг]]. Свыше 4% ВВП он держит [[inflation|инфляцию]]. При резервах ниже 1% ВВП кредиторы дают десятую часть ВВП в год, а когда долг выше 150% ВВП или три года после дефолта – ничего: остальное печатают, а не занимают. Проекты, Игры и боеголовки, оплаченные сверх бюджета, тоже входят в него."],
    uk: ["Дефіцит", "Перевищення видатків і [[interest|відсотків]] над [[revenue|доходами]] за рік. Частину покривають [[reserves|резерви]], поки вони вищі за половину звичного для епохи рівня; решту позичають, і вона лягає в [[debt|борг]]. Понад 4% ВВП він тримає [[inflation|інфляцію]]. За резервів нижче 1% ВВП кредитори дають десяту частину ВВП на рік, а коли борг понад 150% ВВП чи три роки після дефолту – нічого: решту друкують, а не позичають. Проєкти, Ігри й боєголовки, оплачені понад бюджет, теж входять у нього."],
  },
  debt: {
    en: ["Public debt", "What the state owes. Every [[deficit]] adds to it, and [[interest]] on it is paid every turn. From 90% of GDP it is a warning, from 150% a crisis: then, with reserves below 1% of GDP, the economy cannot grow and lenders lend nothing. Past 300% of GDP the state defaults: the debt is written down to 120%, and for three years no one lends."],
    ru: ["Госдолг", "Сколько государство должно. Каждый [[deficit|дефицит]] увеличивает его, а [[interest|проценты]] по нему платятся каждый ход. С 90% ВВП – тревожный знак, со 150% – кризис: тогда при резервах ниже 1% ВВП экономика не может расти и никто не даёт в долг. Свыше 300% ВВП государство объявляет дефолт: долг списывают до 120%, и три года никто не одалживает."],
    uk: ["Держборг", "Скільки держава винна. Кожен [[deficit|дефіцит]] збільшує його, а [[interest|відсотки]] за ним сплачуються щоходу. З 90% ВВП – тривожний знак, зі 150% – криза: тоді за резервів нижче 1% ВВП економіка не може зростати й ніхто не позичає. Понад 300% ВВП держава оголошує дефолт: борг списують до 120%, і три роки ніхто не позичає."],
  },
  interest: {
    en: ["Interest", "What the [[debt]] costs a year: the era's rate, plus 0.03 points for each point the debt passes 90% of GDP, at most 15%. A trusted borrower – [[reserves]] of a tenth of GDP and [[inflation]] under 10% – pays two fifths of the rate and a fifth of the premium."],
    ru: ["Проценты", "Сколько стоит [[debt|долг]] в год: ставка эпохи плюс 0,03 пункта за каждый пункт долга сверх 90% ВВП, не больше 15%. Надёжный заёмщик – [[reserves|резервы]] в десятую часть ВВП и [[inflation|инфляция]] ниже 10% – платит две пятых ставки и пятую часть надбавки."],
    uk: ["Відсотки", "Скільки коштує [[debt|борг]] на рік: ставка епохи плюс 0,03 пункту за кожен пункт боргу понад 90% ВВП, не більше 15%. Надійний позичальник – [[reserves|резерви]] в десяту частину ВВП та [[inflation|інфляція]] нижче 10% – платить дві п'ятих ставки й п'яту частину надбавки."],
  },
  reserves: {
    en: ["Reserves", "The central bank's currency and gold. They pay for imports and for [[goods]] bought abroad for the people, and cover part of a [[deficit]]; trade pulls them back towards half to twice the era's usual holdings. Below 2% of GDP a warning, below 0.5% a crisis."],
    ru: ["Резервы", "Валюта и золото центрального банка. Из них платят за импорт и за [[goods|товары]], купленные для населения за границей, и покрывают часть [[deficit|дефицита]]; торговля возвращает их к уровню от половины до двух обычных для эпохи. Ниже 2% ВВП – тревожный знак, ниже 0,5% – кризис."],
    uk: ["Резерви", "Валюта й золото центрального банку. З них платять за імпорт і за [[goods|товари]], куплені для населення за кордоном, і покривають частину [[deficit|дефіциту]]; торгівля повертає їх до рівня від половини до двох звичних для епохи. Нижче 2% ВВП – тривожний знак, нижче 0,5% – криза."],
  },
  inflation: {
    en: ["Inflation", "How fast prices rise in a year. It drifts back to the era's norm, held up by a [[deficit]] past 4% of GDP, cut imports and shortages; a printed deficit drives it up as far as it is printed, 8 points a year for a tenth of GDP. From 15% a warning, from 50% a crisis that stops [[growth]]; from 100% the economy shrinks."],
    ru: ["Инфляция", "Насколько дорожают цены за год. Тяготеет к норме эпохи; её держат [[deficit|дефицит]] свыше 4% ВВП, отрезанный импорт и нехватка; напечатанный дефицит поднимает её тем сильнее, чем больше печатают: на 8 пунктов в год за десятую часть ВВП. С 15% – тревожный знак, с 50% – кризис, останавливающий [[growth|рост]]; со 100% экономика сжимается."],
    uk: ["Інфляція", "Наскільки дорожчають ціни за рік. Тяжіє до норми епохи; її тримають [[deficit|дефіцит]] понад 4% ВВП, відрізаний імпорт і нестача; надрукований дефіцит піднімає її тим більше, що більше друкують: на 8 пунктів на рік за десяту частину ВВП. З 15% – тривожний знак, з 50% – криза, що зупиняє [[growth|зростання]]; зі 100% економіка стискається."],
  },
  unemployment: {
    en: ["Unemployment", "The share of the workforce without work. It rises a point for every two and a half points of [[growth]] below the trend, falls as men are called up ([[mobilisation]]) and drifts back to the era's usual level. From 12% a warning, from 20% a crisis."],
    ru: ["Безработица", "Доля рабочей силы без работы. Растёт на пункт за каждые два с половиной пункта [[growth|роста]] ниже тренда, падает с призывом ([[mobilisation|мобилизация]]) и тяготеет к обычному для эпохи уровню. С 12% – тревожный знак, с 20% – кризис."],
    uk: ["Безробіття", "Частка робочої сили без роботи. Зростає на пункт за кожні два з половиною пункти [[growth|зростання]] нижче тренду, падає з призовом ([[mobilisation|мобілізація]]) і тяжіє до звичного для епохи рівня. З 12% – тривожний знак, з 20% – криза."],
  },

  // The people's provision.
  provision: {
    en: ["Provision", "How well the people have what they need – [[food]], [[energy]], [[goods]], [[housing]] and [[medicine]] – each as a share of need; food weighs most in the overall figure. Under 85% overall, or any need under 70%, is a crisis that keeps [[unrest]] from falling; abroad it wears down a government's [[support]]."],
    ru: ["Обеспеченность", "Насколько у людей есть необходимое – [[food|еда]], [[energy|энергия]], [[goods|товары]], [[housing|жильё]] и [[medicine|медицина]], – каждое как доля потребности; в общей оценке больше всего весит еда. Ниже 85% в целом или любая статья ниже 70% – кризис, который не даёт [[unrest|напряжённости]] упасть; за границей он подтачивает [[support|поддержку]] правительства."],
    uk: ["Забезпеченість", "Наскільки люди мають необхідне – [[food|їжу]], [[energy|енергію]], [[goods|товари]], [[housing|житло]] й [[medicine|медицину]], – кожне як частку потреби; у загальній оцінці найбільше важить їжа. Нижче 85% загалом або будь-яка стаття нижче 70% – криза, що не дає [[unrest|напруженості]] впасти; за кордоном вона підточує [[support|підтримку]] уряду."],
  },
  food: {
    en: ["Food", "The harvest of the land the country holds, food bought abroad and grain contracts, and the stores. A [[blockade]], no money for imports, occupied land and war at home cut it; agricultural [[research|research]] adds to the harvest."],
    ru: ["Еда", "Урожай своей земли, продовольствие из-за границы и зерновые контракты, запасы. Её урезают [[blockade|блокада]], нехватка денег на импорт, оккупированные земли и война дома; аграрные [[research|исследования]] прибавляют урожая."],
    uk: ["Їжа", "Урожай власної землі, продовольство з-за кордону й зернові контракти, запаси. Її урізають [[blockade|блокада]], брак грошей на імпорт, окуповані землі та війна вдома; аграрні [[research|дослідження]] додають урожаю."],
  },
  energy: {
    en: ["Energy and fuel", "Coal, gas and oil for homes and transport: the country's own output, imports and the stores. A [[blockade]] and no money for imports cut it; a war at home costs it too."],
    ru: ["Энергия и топливо", "Уголь, газ и нефть для домов и транспорта: своя добыча, импорт и запасы. Её урезают [[blockade|блокада]] и нехватка денег на импорт; дорого обходится и война дома."],
    uk: ["Енергія й паливо", "Вугілля, газ і нафта для домівок і транспорту: власний видобуток, імпорт і запаси. Її урізають [[blockade|блокада]] й брак грошей на імпорт; дорого коштує і війна вдома."],
  },
  goods: {
    en: ["Everyday goods", "What is left for the shops once the [[armyBudget|army]] has taken its share, prices allow and the metals are there, with what comes from abroad while trade is open. With more than 8% of GDP on the army, goods give way to the war economy; [[industryBudget|industry spending]] wins part of them back over months."],
    ru: ["Товары", "Что остаётся магазинам, когда [[armyBudget|армия]] взяла своё, цены позволяют и есть металлы, вместе с ввозом, пока торговля открыта. Когда на армию идёт свыше 8% ВВП, товары уступают военной экономике; [[industryBudget|расходы на промышленность]] за несколько месяцев возвращают часть."],
    uk: ["Товари", "Що лишається крамницям, коли [[armyBudget|армія]] взяла своє, ціни дозволяють і є метали, разом із ввезенням, поки торгівля відкрита. Коли на армію йде понад 8% ВВП, товари поступаються воєнній економіці; [[industryBudget|видатки на промисловість]] за кілька місяців повертають частину."],
  },
  housing: {
    en: ["Housing", "Homes for the people. Occupied land, war at home, [[socialBudget|social spending]] below the era's usual share and a recession take from it."],
    ru: ["Жильё", "Крыша над головой. Его отнимают оккупированные земли, война дома, [[socialBudget|соцрасходы]] ниже обычной для эпохи доли и спад."],
    uk: ["Житло", "Дах над головою. Його забирають окуповані землі, війна вдома, [[socialBudget|соцвидатки]] нижчі за звичну для епохи частку та спад."],
  },
  medicine: {
    en: ["Medicine", "Hospitals the state pays for and medicines from abroad. [[socialBudget|Social spending]] below the era's usual share, a [[blockade]], the wounded of a war and high prices take from it; medical [[research|research]] adds to it."],
    ru: ["Медицина", "Больницы за счёт государства и лекарства из-за границы. Её урезают [[socialBudget|соцрасходы]] ниже обычной для эпохи доли, [[blockade|блокада]], раненые войны и высокие цены; медицинские [[research|исследования]] прибавляют."],
    uk: ["Медицина", "Лікарні коштом держави й ліки з-за кордону. Її урізають [[socialBudget|соцвидатки]] нижчі за звичну для епохи частку, [[blockade|блокада]], поранені війни та високі ціни; медичні [[research|дослідження]] додають."],
  },

  // War.
  warFooting: {
    en: ["War footing", "A government abroad at war raises its [[armyBudget|army budget]]: half as much again as the era's usual share in a war abroad, up to a tenth of GDP or three times the usual share as the front reaches its people. Most of the rise comes within half a year, three tenths in war taxes and the rest borrowed, and goes again after the peace. Your own budget stays yours to set."],
    ru: ["Военное положение экономики", "Правительство за границей, воюя, поднимает [[armyBudget|военный бюджет]]: в полтора раза выше обычной для эпохи доли в войне за рубежом и до десятой части ВВП или трёх обычных долей, когда фронт подходит к его людям. Основной рост – за полгода, три десятых за счёт военных налогов, остальное в долг; после мира он уходит. Свой бюджет вы задаёте сами."],
    uk: ["Воєнний стан економіки", "Уряд за кордоном, воюючи, піднімає [[armyBudget|військовий бюджет]]: у півтора раза вище за звичну для епохи частку у війні за кордоном і до десятої частини ВВП або трьох звичних часток, коли фронт підходить до його людей. Основне зростання – за пів року, три десятих коштом воєнних податків, решта в борг; після миру воно минає. Свій бюджет ви задаєте самі."],
  },
  mobilisation: {
    en: ["Mobilisation", "Calling men up. How many can be called depends on the population, the era and the conscription law: a volunteer army halves it, universal service adds half, emergency rule a third more; captured land gives few. A turn takes at most a third of them a month, and men taken from work take their output with them. Past 80% of them in uniform a warning, past 95% a crisis."],
    ru: ["Мобилизация", "Призыв. Сколько можно призвать, зависит от населения, эпохи и закона о призыве: контрактная армия вдвое меньше, всеобщая повинность – в полтора раза больше, особое положение – ещё на треть; с захваченных земель почти никого. За месяц – не больше трети резерва, а призванные с работы уносят с собой свою выработку. Свыше 80% резерва под ружьём – тревожный знак, свыше 95% – кризис."],
    uk: ["Мобілізація", "Призов. Скільки можна призвати, залежить від населення, епохи й закону про призов: контрактна армія вдвічі менша, загальний обов'язок – у півтора раза більший, особливий стан – ще на третину; із захоплених земель майже нікого. За місяць – не більше третини резерву, а призвані з роботи забирають із собою свій виробіток. Понад 80% резерву під зброєю – тривожний знак, понад 95% – криза."],
  },
  readiness: {
    en: ["Readiness", "How much of the army fights at full weight, 40–100%. The side that chose the moment starts at 75%, a later entrant at 65%, the side attacked at 50%, more with career soldiers; all reach full weight over the era's [[mobilisation]] – a month in 1914, three and a half in 2022."],
    ru: ["Готовность", "Какая часть армии воюет в полную силу, 40–100%. Сторона, выбравшая момент, начинает с 75%, вступившая позже – с 65%, атакованная – с 50%, с кадровыми солдатами больше; все выходят на полную силу за время [[mobilisation|мобилизации]] эпохи – месяц в 1914-м, три с половиной в 2022-м."],
    uk: ["Готовність", "Яка частина армії воює на повну силу, 40–100%. Сторона, що обрала момент, починає з 75%, та, що вступила пізніше, – з 65%, атакована – з 50%, із кадровими солдатами більше; усі виходять на повну силу за час [[mobilisation|мобілізації]] епохи – місяць у 1914-му, три з половиною у 2022-му."],
  },
  reach: {
    en: ["Supply (reach)", "How much of a side's strength gets to a province: full within 1,000 km of home over land or a narrow strait, less beyond. Overseas it takes landing ships and transports and [[seaCommand|command of the sea]], and an expedition builds up over months; a [[landing]] gets no more than its ships carry."],
    ru: ["Снабжение (досягаемость)", "Какая часть силы стороны доходит до провинции: вся – в пределах 1000 км от дома по суше или через узкий пролив, дальше меньше. За морем нужны десантные корабли, транспорты и [[seaCommand|господство на море]], а экспедиция наращивается месяцами; [[landing|десант]] получает не больше, чем везут корабли."],
    uk: ["Постачання (досяжність)", "Яка частина сили сторони доходить до провінції: уся – в межах 1000 км від дому суходолом або через вузьку протоку, далі менше. За морем потрібні десантні кораблі, транспорти й [[seaCommand|панування на морі]], а експедиція нарощується місяцями; [[landing|десант]] отримує не більше, ніж везуть кораблі."],
  },
  will: {
    en: ["Will to fight", "0–100: [[support]] for the war at home, weighed by the regime; an invaded people rallies to at least 70. Losses of people and [[weariness|war-weariness]] wear it down. An army fights at full weight only with the will; below 25 a government asks for terms."],
    ru: ["Воля к борьбе", "0–100: [[support|поддержка]] войны дома с поправкой на режим; народ, на который напали, сплачивается минимум до 70. Её подтачивают потери людей и [[weariness|усталость от войны]]. Армия воюет в полную силу только с волей; ниже 25 правительство просит об условиях мира."],
    uk: ["Воля до боротьби", "0–100: [[support|підтримка]] війни вдома з поправкою на режим; народ, на який напали, гуртується щонайменше до 70. Її підточують втрати людей і [[weariness|втома від війни]]. Армія воює на повну силу лише з волею; нижче 25 уряд просить про умови миру."],
  },
  weariness: {
    en: ["War-weariness", "0–100: the war's pain – the dead, a quarter of the wounded and half of those taken prisoner, against the population – and its years. Democracies feel losses most, autocracies and one-party states least; a people defending its own land bears more. It wears down the [[will]] and keeps your [[unrest]] up."],
    ru: ["Усталость от войны", "0–100: боль войны – убитые, четверть раненых и половина попавших в плен относительно населения – и её годы. Демократии острее всего чувствуют потери, автократии и однопартийные государства – слабее; народ, защищающий свою землю, выносит больше. Она подтачивает [[will|волю]] и держит вашу [[unrest|напряжённость]]."],
    uk: ["Втома від війни", "0–100: біль війни – убиті, чверть поранених і половина полонених відносно населення – та її роки. Демократії найгостріше відчувають втрати, автократії й однопартійні держави – найслабше; народ, що захищає свою землю, витримує більше. Вона підточує [[will|волю]] й тримає вашу [[unrest|напруженість]]."],
  },
  resistance: {
    en: ["Resistance", "0–100 in a province an enemy took: its people's will to fight the occupier, harsher under a dictatorship, rising over months and fading after a peace. Partisans tie down up to 20 soldiers per thousand people (at most half an army), kill part of the garrison and cut supply at the [[front]] by up to 30%."],
    ru: ["Сопротивление", "0–100 в провинции, занятой врагом: готовность её людей бороться с оккупантом – жёстче при диктатуре, растёт месяцами и угасает после мира. Партизаны сковывают до 20 солдат на тысячу жителей (не больше половины армии), убивают часть гарнизона и урезают снабжение на [[front|фронте]] до 30%."],
    uk: ["Опір", "0–100 у провінції, яку зайняв ворог: готовність її людей боротися з окупантом – жорсткіша за диктатури, зростає місяцями й згасає після миру. Партизани сковують до 20 солдатів на тисячу мешканців (не більше половини армії), убивають частину гарнізону й урізають постачання на [[front|фронті]] до 30%."],
  },
  airCommand: {
    en: ["Command of the air", "Fighters – with attack planes and bombers counting for less – against the enemy's aircraft and air defence. It speeds a [[front]]'s advance, and in a [[landing]] adds or takes up to a third of what comes ashore."],
    ru: ["Господство в воздухе", "Истребители – штурмовики и бомбардировщики идут в зачёт меньше – против вражеской авиации и ПВО. Оно ускоряет продвижение [[front|фронта]], а при [[landing|десанте]] добавляет или отнимает до трети высаженного."],
    uk: ["Панування в повітрі", "Винищувачі – штурмовики й бомбардувальники йдуть у залік менше – проти ворожої авіації та ППО. Воно прискорює просування [[front|фронту]], а під час [[landing|десанту]] додає або забирає до третини висадженого."],
  },
  seaCommand: {
    en: ["Command of the sea", "A side's fleet against the enemy's: a capital ship counts three, an escort one, a submarine 0.6. It decides how much reaches a shore overseas ([[reach|reach]]), and past 60% of the sea it lets a side [[blockade]] the enemy."],
    ru: ["Господство на море", "Флот стороны против вражеского: линейный корабль или авианосец считается за три, эскортный – за один, подлодка – за 0,6. От него зависит, сколько дойдёт до берега за морем ([[reach|снабжение]]), а свыше 60% моря оно позволяет [[blockade|блокировать]] врага."],
    uk: ["Панування на морі", "Флот сторони проти ворожого: лінійний корабель чи авіаносець рахується за три, ескортний – за один, підводний човен – за 0,6. Від нього залежить, скільки дійде до берега за морем ([[reach|постачання]]), а понад 60% моря воно дає змогу [[blockade|блокувати]] ворога."],
  },
  blockade: {
    en: ["Blockade", "Cutting a country's sea trade: up to 20% of its imports when the enemy holds over 60% of the sea, and submarines raid up to 25% more – at most 45% together, less for a country that also trades by land. It joins [[sanctions]] in the economy's import cut, which hurts [[growth]], prices and [[provision]]."],
    ru: ["Блокада", "Перекрытие морской торговли страны: до 20% её импорта, когда враг держит больше 60% моря, и подлодки отнимают ещё до 25% – вместе не больше 45%, меньше для страны, торгующей и по суше. Вместе с [[sanctions|санкциями]] входит в урезание импорта, которое бьёт по [[growth|росту]], ценам и [[provision|обеспеченности]]."],
    uk: ["Блокада", "Перекриття морської торгівлі країни: до 20% її імпорту, коли ворог тримає понад 60% моря, і підводні човни забирають ще до 25% – разом не більше 45%, менше для країни, що торгує й суходолом. Разом із [[sanctions|санкціями]] входить в урізання імпорту, яке б'є по [[growth|зростанню]], цінах і [[provision|забезпеченості]]."],
  },
  landing: {
    en: ["Landing", "Fighting on a shore where a side holds nothing within three provinces: no more soldiers than its landing ships and transports carry, fewer with an enemy fleet in the way, more or fewer by [[airCommand|command of the air]], building up over the first months. The engine lands on an enemy island by itself when the odds allow; a landing on a mainland coast is for orders."],
    ru: ["Десант", "Бой на берегу, где у стороны нет ничего в пределах трёх провинций: солдат не больше, чем везут десантные корабли и транспорты, меньше при вражеском флоте на пути, больше или меньше по [[airCommand|господству в воздухе]], с наращиванием в первые месяцы. На вражеский остров движок высаживается сам, когда позволяет перевес; десант на материковое побережье – дело приказов."],
    uk: ["Десант", "Бій на березі, де сторона не має нічого в межах трьох провінцій: солдатів не більше, ніж везуть десантні кораблі й транспорти, менше з ворожим флотом на шляху, більше чи менше за [[airCommand|пануванням у повітрі]], із нарощуванням у перші місяці. На ворожий острів рушій висаджується сам, коли дозволяє перевага; десант на материкове узбережжя – справа наказів."],
  },
  theatre: {
    en: ["Theatre", "A part of a war's [[front]] joined by land or a narrow strait. A country with no province in a theatre sends only a quarter of what it could there."],
    ru: ["Театр военных действий", "Часть [[front|фронта]] войны, связанная сушей или узким проливом. Страна без провинций на театре посылает туда лишь четверть того, что могла бы."],
    uk: ["Театр воєнних дій", "Частина [[front|фронту]] війни, пов'язана суходолом або вузькою протокою. Країна без провінцій на театрі посилає туди лише чверть того, що могла б."],
  },
  front: {
    en: ["Front", "The provinces where two sides at war meet ([[contested|contested provinces]] among them). Every turn the engine fights there: the side with the edge in strength, tanks and the air gains ground – a stalemate, attrition, a breakthrough or a pursuit – and both lose men. A front on a country's own soil holds its output below its level while it stands ([[growth]])."],
    ru: ["Фронт", "Провинции, где сходятся воюющие стороны (среди них [[contested|спорные провинции]]). Каждый ход движок ведёт там бои: сторона с перевесом в силе, танках и воздухе продвигается – застой, изматывание, прорыв или преследование, – и обе теряют людей. Фронт на своей земле держит выпуск страны ниже обычного, пока стоит ([[growth|рост]])."],
    uk: ["Фронт", "Провінції, де сходяться сторони війни (серед них [[contested|спірні провінції]]). Щоходу рушій веде там бої: сторона з перевагою в силі, танках і повітрі просувається – застій, виснаження, прорив або переслідування, – і обидві втрачають людей. Фронт на власній землі тримає випуск країни нижче звичного, поки стоїть ([[growth|зростання]])."],
  },
  contested: {
    en: ["Contested province", "A province two sides fight over: the attacker holds a share of it and some of its towns, and takes it once the share is whole. Its people count as living under a war at home."],
    ru: ["Спорная провинция", "Провинция, за которую бьются две стороны: нападающий держит её долю и часть городов и берёт её, когда доля становится полной. Её люди считаются живущими под войной дома."],
    uk: ["Спірна провінція", "Провінція, за яку б'ються дві сторони: нападник тримає її частку й частину міст і бере її, коли частка стає повною. Її люди вважаються такими, що живуть під війною вдома."],
  },

  // The world.
  sanctions: {
    en: ["Sanctions", "Trade one government cuts off against another, in part or in full: the target loses the imports that came from those who impose them. Rivals and democracies impose them, and members at a world body's call, most of all after an act of aggression. They hurt [[growth]], prices and [[provision]]."],
    ru: ["Санкции", "Торговля, которую одно правительство частично или полностью прекращает с другим: цель теряет импорт, шедший от тех, кто их ввёл. Их вводят соперники и демократии, а также члены международной организации по её призыву, больше всего после агрессии. Они бьют по [[growth|росту]], ценам и [[provision|обеспеченности]]."],
    uk: ["Санкції", "Торгівля, яку один уряд частково чи повністю припиняє з іншим: ціль втрачає імпорт, що йшов від тих, хто їх запровадив. Їх запроваджують суперники й демократії, а також члени міжнародної організації на її заклик, найбільше після агресії. Вони б'ють по [[growth|зростанню]], цінах і [[provision|забезпеченості]]."],
  },
  pledge: {
    en: ["Pledge", "A great power's word to defend a country, given since 1950 after a grave attack nearby: an attack on the country it protects calls it into the war by treaty."],
    ru: ["Гарантия", "Слово великой державы защищать страну, которое с 1950 года даётся после тяжёлого нападения рядом: нападение на страну под защитой призывает её в войну по договору."],
    uk: ["Гарантія", "Слово великої держави захищати країну, яке з 1950 року дають після тяжкого нападу поруч: напад на країну під захистом кличе її у війну за договором."],
  },
  bloc: {
    en: ["Bloc", "A group of countries: a military alliance, whose members are called into each other's wars by treaty; a pact; an organisation; or a trade agreement. A shared bloc makes trade easier; a world body – the UN, the League of Nations – takes up acts of aggression."],
    ru: ["Блок", "Объединение стран: военный союз, члены которого по договору вступают в войны друг друга; пакт; организация; торговое соглашение. Общий блок облегчает торговлю; международная организация – ООН, Лига Наций – рассматривает акты агрессии."],
    uk: ["Блок", "Об'єднання країн: військовий союз, члени якого за договором вступають у війни одне одного; пакт; організація; торговельна угода. Спільний блок полегшує торгівлю; міжнародна організація – ООН, Ліга Націй – розглядає акти агресії."],
  },
  securityCouncil: {
    en: ["UN Security Council", "Five permanent members with a [[veto]] – America, Britain, France, the Soviet Union (later Russia) and China – and the six strongest of the rest, ten from 1966. Seven votes of eleven carry a resolution, nine of fifteen from 1966: a condemnation, [[sanctions]] or collective action."],
    ru: ["Совет Безопасности ООН", "Пять постоянных членов с правом [[veto|вето]] – США, Великобритания, Франция, СССР (затем Россия) и Китай – и шесть сильнейших из остальных, с 1966 года десять. Резолюцию принимают семь голосов из одиннадцати, с 1966 года девять из пятнадцати: осуждение, [[sanctions|санкции]] или коллективные действия."],
    uk: ["Рада Безпеки ООН", "П'ять постійних членів із правом [[veto|вето]] – США, Велика Британія, Франція, СРСР (згодом Росія) і Китай – та шість найсильніших із решти, з 1966 року десять. Резолюцію ухвалюють сім голосів з одинадцяти, з 1966 року дев'ять з п'ятнадцяти: засудження, [[sanctions|санкції]] чи колективні дії."],
  },
  veto: {
    en: ["Veto", "A permanent member's vote against in the [[securityCouncil|Security Council]]: the resolution falls, however many vote for it. From November 1950 the case then goes to the General Assembly ([[unitingForPeace|Uniting for Peace]])."],
    ru: ["Вето", "Голос постоянного члена против в [[securityCouncil|Совете Безопасности]]: резолюция не проходит, сколько бы ни голосовали «за». С ноября 1950 года дело тогда переходит в Генеральную Ассамблею ([[unitingForPeace|«Единство в пользу мира»]])."],
    uk: ["Вето", "Голос постійного члена проти в [[securityCouncil|Раді Безпеки]]: резолюція не проходить, скільки б не голосували «за». З листопада 1950 року справа тоді переходить до Генеральної Асамблеї ([[unitingForPeace|«Єдність заради миру»]])."],
  },
  unitingForPeace: {
    en: ["Uniting for Peace", "The General Assembly's resolution of 3 November 1950: what a [[veto]] blocks in the Security Council goes to the Assembly the same turn, where two thirds of those voting carry it, and a third of all members at least. Before that date a vetoed case waits for it."],
    ru: ["«Единство в пользу мира»", "Резолюция Генеральной Ассамблеи от 3 ноября 1950 года: то, что в Совете Безопасности блокирует [[veto|вето]], в тот же ход переходит в Ассамблею, где решают две трети голосующих, но не меньше трети всех членов. До этой даты дело с вето ждёт её."],
    uk: ["«Єдність заради миру»", "Резолюція Генеральної Асамблеї від 3 листопада 1950 року: те, що в Раді Безпеки блокує [[veto|вето]], того ж ходу переходить до Асамблеї, де вирішують дві третини тих, хто голосує, але не менше третини всіх членів. До цієї дати справа з вето чекає на неї."],
  },

  // Politics.
  support: {
    en: ["Support", "How much of the country backs the government, 0–100 – for yours, the parties in it. It feeds the [[will]] to fight, and where votes count it decides elections. Abroad, a government below 42 is in trouble at home: where votes count it starts fewer wars, an autocracy more."],
    ru: ["Поддержка", "Какая часть страны поддерживает правительство, 0–100; у вашего – партии, которые в него входят. Она питает [[will|волю]] к борьбе, а там, где голоса что-то решают, определяет выборы. За границей правительство ниже 42 в беде дома: там, где голосуют, оно реже начинает войны, автократия – чаще."],
    uk: ["Підтримка", "Яка частина країни підтримує уряд, 0–100; у вашого – партії, що до нього входять. Вона живить [[will|волю]] до боротьби, а там, де голоси щось вирішують, визначає вибори. За кордоном уряд нижче 42 у біді вдома: там, де голосують, він рідше починає війни, автократія – частіше."],
  },
  stability: {
    en: ["Stability", "How firmly the state holds together, 0–100. Liberalising costs it and a crackdown buys it; purging a faction of the cabinet costs it too. Abroad, a state below 50 counts as shaky, which weighs on its plans like low [[support]]."],
    ru: ["Стабильность", "Насколько прочно держится государство, 0–100. Либерализация стоит её, закручивание гаек прибавляет, чистка кабинета тоже стоит её. За границей государство ниже 50 считается шатким, и это давит на его планы, как низкая [[support|поддержка]]."],
    uk: ["Стабільність", "Наскільки міцно тримається держава, 0–100. Лібералізація коштує її, закручування гайок додає, чистка кабінету теж коштує її. За кордоном держава нижче 50 вважається хиткою, і це тисне на її плани, як низька [[support|підтримка]]."],
  },
  unrest: {
    en: ["Unrest", "How restless the country is, 0–100: discontent, protests, rumours. War, poverty, prices and unpopular decisions raise it; concessions and order lower it, but each economic crisis and [[weariness|war-weariness]] keep a floor under it. From 65 the government can fall – unless the army and police stand loyal ([[loyalty]] 70 or more): then only a coup ([[plots]]) can bring it down."],
    ru: ["Напряжённость", "Насколько неспокойна страна, 0–100: недовольство, протесты, слухи. Её поднимают война, бедность, цены и непопулярные решения, снижают уступки и порядок, но каждый экономический кризис и [[weariness|усталость от войны]] держат нижнюю границу. С 65 правительство может пасть – если только армия и полиция не верны ([[loyalty|лояльность]] от 70): тогда свергнуть его может лишь переворот ([[plots|заговоры]])."],
    uk: ["Напруженість", "Наскільки неспокійна країна, 0–100: невдоволення, протести, чутки. Її піднімають війна, бідність, ціни й непопулярні рішення, знижують поступки й порядок, але кожна економічна криза та [[weariness|втома від війни]] тримають нижню межу. З 65 уряд може впасти – якщо тільки армія й поліція не вірні ([[loyalty|лояльність]] від 70): тоді повалити його може лише переворот ([[plots|змови]])."],
  },
  plots: {
    en: ["Plots", "Conspiracies against the government: a [[factions|faction]] that has lost faith plots to replace a minister or the leader. The intelligence service hears first a rumour, which may blame the wrong people, then the truth. A coup plot at strength 60 can bring the government down whatever the street."],
    ru: ["Заговоры", "Сговоры против правительства: [[factions|фракция]], потерявшая веру, замышляет сместить министра или самого лидера. Разведка слышит сперва слух, который может винить не тех, и лишь потом правду. Заговор переворота силой от 60 может свергнуть правительство, что бы ни творилось на улице."],
    uk: ["Змови", "Змови проти уряду: [[factions|фракція]], що втратила віру, задумує змістити міністра чи самого лідера. Розвідка чує спершу чутку, яка може звинувачувати не тих, і лише потім правду. Змова перевороту силою від 60 може повалити уряд, хоч би що діялося на вулиці."],
  },
  factions: {
    en: ["Factions", "Ministers and deputies grouped by what they want: hawks and doves, reformers and hardliners, a security clique, a coalition partner's people. A faction whose [[loyalty]] fails drags its feet in its ministries, leaks to the press and [[plots|plots]]."],
    ru: ["Фракции", "Министры и заместители, сгруппированные по тому, чего хотят: ястребы и голуби, реформаторы и консерваторы, силовая клика, люди партнёра по коалиции. Фракция, чья [[loyalty|лояльность]] иссякла, саботирует работу своих министерств, сливает прессе и [[plots|плетёт заговор]]."],
    uk: ["Фракції", "Міністри й заступники, згруповані за тим, чого хочуть: яструби й голуби, реформатори й консерватори, силова кліка, люди партнера по коаліції. Фракція, чия [[loyalty|лояльність]] вичерпалася, саботує роботу своїх міністерств, зливає пресі й [[plots|плете змову]]."],
  },
  loyalty: {
    en: ["Loyalty", "A minister's or deputy's devotion to the leader, 1–5: orders and laws for their causes, favours and promotions raise it a step at a time; going against their causes, humiliations and dismissing their allies lower it. The pillars of power – army, police, security services, elites – have a loyalty of 0–100: below 40 orders to use force may be refused, below 25 they defect."],
    ru: ["Лояльность", "Преданность министра или заместителя лидеру, 1–5: приказы и законы в духе их целей, милости и повышения поднимают её по шагу; решения против их целей, унижения и увольнение их союзников снижают. У опор власти – армии, полиции, спецслужб, элит – лояльность 0–100: ниже 40 приказы применить силу могут не выполнить, ниже 25 они переходят на другую сторону."],
    uk: ["Лояльність", "Відданість міністра чи заступника лідерові, 1–5: накази й закони в дусі їхніх цілей, милості й підвищення піднімають її крок за кроком; рішення проти їхніх цілей, приниження та звільнення їхніх союзників знижують. В опор влади – армії, поліції, спецслужб, еліт – лояльність 0–100: нижче 40 накази застосувати силу можуть не виконати, нижче 25 вони переходять на інший бік."],
  },

  // Science and society.
  research: {
    en: ["Research directions", "The research money – a fifth of the army budget and three tenths of industry's – is shared among directions such as military technology, industry and energy, agriculture, medicine and strategic programmes. Each gains years of technology a year; years ahead of history bring better weapons, a larger economy, more food and medicine and sharper intelligence, and years behind cost as much. Science and education speed every other direction."],
    ru: ["Направления исследований", "Деньги на науку – пятая часть военного бюджета и три десятых промышленного – делятся между направлениями: военные технологии, промышленность и энергетика, сельское хозяйство, медицина, стратегические программы и другие. Каждое набирает годы технологий в год; опережение истории даёт лучшее оружие, бо́льшую экономику, больше еды и медицины, зоркую разведку, отставание стоит столько же. Наука и образование ускоряют все остальные направления."],
    uk: ["Напрями досліджень", "Гроші на науку – п'ята частина військового бюджету й три десятих промислового – діляться між напрямами: військові технології, промисловість і енергетика, сільське господарство, медицина, стратегічні програми та інші. Кожен набирає роки технологій на рік; випередження історії дає кращу зброю, більшу економіку, більше їжі й медицини, пильнішу розвідку, відставання коштує стільки ж. Наука й освіта прискорюють усі інші напрями."],
  },
  strata: {
    en: ["Society's strata", "The people split into the poor, the middle and the rich. The poor live below the World Bank's societal poverty line – $1.15 a day plus half the median income, at least $3 ($3.65 from 1991) – and the rich above three times the median, at least $40 a day. Growth widens the middle; slumps, prices, [[sanctions]] and occupation push people into poverty."],
    ru: ["Слои общества", "Население делится на бедных, средний слой и богатых. Бедные живут ниже общественной черты бедности Всемирного банка – $1,15 в день плюс половина медианного дохода, не меньше $3 (с 1991 года $3,65), – богатые выше трёх медиан, не меньше $40 в день. Рост расширяет средний слой; спад, цены, [[sanctions|санкции]] и оккупация толкают людей в бедность."],
    uk: ["Верстви суспільства", "Населення ділиться на бідних, середню верству й багатих. Бідні живуть нижче суспільної межі бідності Світового банку – $1,15 на день плюс половина медіанного доходу, не менше $3 (з 1991 року $3,65), – багаті вище трьох медіан, не менше $40 на день. Зростання розширює середню верству; спад, ціни, [[sanctions|санкції]] й окупація штовхають людей у бідність."],
  },
} satisfies Record<string, Record<Locale, Entry>>;

export type TermId = keyof typeof GLOSSARY;
export const TERM_IDS = Object.keys(GLOSSARY) as TermId[];

export const isTermId = (id: string): id is TermId => Object.prototype.hasOwnProperty.call(GLOSSARY, id);

/** A term's name and explanation in the language, falling back to English. */
export function glossary(id: TermId, locale: Locale): { title: string; text: string } {
  const [title, text] = GLOSSARY[id][locale] ?? GLOSSARY[id].en;
  return { title, text };
}

/** `[[id]]` or `[[id|words]]`. */
const REF = /\[\[([A-Za-z]+)(?:\|([^\]]*))?\]\]/g;

/** A text cut into plain runs and marked terms, in order. */
export type TermPart = { text: string; id?: undefined } | { id: string; text?: string };

export function termParts(text: string): TermPart[] {
  const parts: TermPart[] = [];
  let at = 0;
  for (const m of text.matchAll(REF)) {
    if (m.index > at) parts.push({ text: text.slice(at, m.index) });
    parts.push({ id: m[1], text: m[2] });
    at = m.index + m[0].length;
  }
  if (at < text.length) parts.push({ text: text.slice(at) });
  return parts;
}

/** The ids a text marks. */
export const termRefs = (text: string): string[] => termParts(text).flatMap((p) => (p.id ? [p.id] : []));

/** The text as it reads, the marks taken out: where it cannot be drawn with its terms (a `title`, an aria label). */
export function plainTerms(text: string, locale: Locale): string {
  return termParts(text)
    .map((p) => (p.id === undefined ? p.text : (p.text ?? (isTermId(p.id) ? inlineTitle(glossary(p.id, locale).title) : p.id))))
    .join("");
}

/** A term's name inside a sentence: "growth", but "GDP" and "UN Security Council" as they are. */
export function inlineTitle(title: string): string {
  const second = title.charAt(1);
  return second && second !== second.toLowerCase() ? title : title.charAt(0).toLowerCase() + title.slice(1);
}

import type { Scenario, WarSeed } from "../types";
import { ADEN, all, CZECHOSLOVAK, EAST_GERMAN, L, MODERN, seed, SOVIET, YUGOSLAV } from "./coldwar";
import { TERMS_1979, TREATIES_1979, withTreaties } from "./treaties";

const COMMUNIST = L("One-party communist state", "Однопартийное коммунистическое государство", "Однопартійна комуністична держава");
const PEOPLES_REPUBLIC = L("People's republic", "Народная республика", "Народна республіка");
const JUNTA = L("Military government", "Военное правительство", "Військовий уряд");
const PARLIAMENTARY = L("Parliamentary republic", "Парламентская республика", "Парламентська республіка");
const MONARCHY = L("Constitutional monarchy", "Конституционная монархия", "Конституційна монархія");
const PRESIDENTIAL = L("Presidential republic", "Президентская республика", "Президентська республіка");
const ONE_PARTY = L("One-party republic", "Однопартийная республика", "Однопартійна республіка");
const ABSOLUTE = L("Absolute monarchy", "Абсолютная монархия", "Абсолютна монархія");
const DOMINION = L("Parliamentary monarchy of the Commonwealth", "Парламентская монархия Содружества", "Парламентська монархія Співдружності");
const INSURGENCY = L("Liberation movement at war", "Освободительное движение в войне", "Визвольний рух у війні");
const BAATH = L("Ba'athist one-party republic", "Баасистская однопартийная республика", "Баасистська однопартійна республіка");

// The lines of the model's background that the date and its eve share.
const AFGHANISTAN_1979 = `Afghanistan: the communist People's Democratic Party took power in the Saur Revolution of April 1978, killing President Daoud. Its Khalq faction purged the Parcham faction (Babrak Karmal was sent abroad as ambassador to Prague, then into hiding in Moscow) and forced land reform, literacy for women and atheist propaganda on the villages; risings followed – Nuristan and Kunar in 1978, Herat in March 1979, where mutinous troops killed Soviet advisers and the regime's bombers killed thousands. In September 1979 Hafizullah Amin had President Nur Muhammad Taraki, Brezhnev's protégé, arrested and smothered; Moscow distrusts Amin, suspects him of talking to the Americans and fears an Islamic, Western-leaning Afghanistan on its southern border after Iran's revolution. The mujahideen are many: Burhanuddin Rabbani's Jamiat-e Islami (Ahmad Shah Massoud in the Panjshir), Gulbuddin Hekmatyar's Hezb-e Islami, the Hazara of the Hazarajat (largely free of Kabul's rule), Sibghatullah Mojaddedi and the traditionalist parties, most based in Peshawar under Pakistan's protection (General Zia-ul-Haq); the CIA has given small non-lethal aid since July 1979. The Afghan army is shrinking through desertion; some 4,000 Soviet advisers serve with it, and Soviet "Muslim battalion" troops guard Amin at Bagram and the Tajbeg Palace.`;
const POWERS_1979 = `The United States: Jimmy Carter faces re-election in 1980 (Ronald Reagan and, in his own party, Edward Kennedy); inflation above 13%, petrol queues after Iran's revolution; Paul Volcker at the Fed has begun to squeeze money. Since 4 November Iranian students hold 52 Americans in the US embassy in Tehran, demanding the Shah, who is in the US for cancer treatment; Carter froze Iran's assets. SALT II was signed in June but is stalled in the Senate. NATO decided on 12 December to deploy Pershing II and cruise missiles in Europe from 1983 unless the Soviets withdraw their SS-20s. The Soviet Union: Leonid Brezhnev is 73 and ill; a small circle – Andropov (KGB), Ustinov (defence), Gromyko (foreign affairs), Suslov – decides; Kosygin is sidelined. China: Deng Xiaoping leads the "reform and opening" decided in December 1978; China fought a month-long war with Vietnam in February–March 1979 to "teach it a lesson" for invading Cambodia; diplomatic relations with the US since 1 January 1979. Britain: Margaret Thatcher, Prime Minister since May; France: Valéry Giscard d'Estaing; West Germany: Helmut Schmidt, author of the double-track idea; Japan: Masayoshi Ōhira. Pakistan: Zia-ul-Haq hanged Zulfikar Ali Bhutto in April and is isolated by the West over his nuclear programme. India votes in early January; Indira Gandhi is expected to return.`;
const WORLD_1979 = `Middle East: Iran's revolution overthrew the Shah in February; Ayatollah Ruhollah Khomeini rules through the Revolutionary Council and the Revolutionary Guards; the Islamic constitution was approved on 2–3 December; Kurdish and Arab risings are being fought; the army is purged and demoralised. Iraq: Saddam Hussein took the presidency in July and purged the Ba'ath; he fears Iran's call to Iraq's Shia and covets the Shatt al-Arab. Egypt signed peace with Israel in March (Camp David); the Arab states have expelled it from the League. Israel (Menachem Begin) is withdrawing from Sinai in stages and keeps the Golan, the West Bank and Gaza. Saudi Arabia was shaken by the seizure of the Grand Mosque in Mecca (20 November – 4 December). Lebanon is in its fifth year of civil war, with Syria's army in the Bekaa and Beirut and Israel's ally Saad Haddad in the south. Indochina: Vietnam invaded Cambodia on 25 December 1978, took Phnom Penh on 7 January and installed Heng Samrin's People's Republic of Kampuchea; the Khmer Rouge, who killed some 1.7 million Cambodians in four years, fight on from the Thai border and keep Cambodia's UN seat; boat people flee Vietnam by the hundred thousand. Africa: Rhodesia's settlement was signed at Lancaster House on 21 December – a ceasefire from 28 December, elections in February under the British governor Lord Soames; Angola (José Eduardo dos Santos since September, with Cuban troops) fights UNITA (Jonas Savimbi, backed by South Africa); Ethiopia's Derg (Mengistu) won the Ogaden war with Soviet and Cuban help and fights the Eritrean fronts; Morocco fights Polisario for the Western Sahara, which it annexed whole when Mauritania made peace in August; Tanzania overthrew Idi Amin in April. Latin America: the Sandinistas overthrew Somoza in July; El Salvador's junta took power in October as civil war nears; Grenada's New Jewel Movement seized power in March. Poland is deep in debt; the Polish pope, John Paul II, drew millions in June.`;

/** The War in Afghanistan, the Soviet army among its defenders from 25 December. */
const AFGHAN_WAR: WarSeed = {
  id: "afghan-war",
  name: L("War in Afghanistan", "Война в Афганистане", "Війна в Афганістані"),
  attackers: ["mujahideen"],
  defenders: ["afghanistan", "ussr"],
  since: "1979-03-15",
  // The Soviet Union is in it at the government's side, an intervener.
  civil: { of: "afghanistan", rebels: "mujahideen", how: "rising", legitimacy: { government: 35, rebels: 40 } },
};
const WARS: WarSeed[] = [
  AFGHAN_WAR,
  {
    id: "cambodian-vietnamese-war",
    name: L("Cambodian–Vietnamese War", "Камбоджийско-вьетнамская война", "Камбоджійсько-в'єтнамська війна"),
    attackers: ["vietnam", "cambodia"],
    defenders: ["khmer-rouge"],
    since: "1978-12-25",
  },
  {
    id: "western-sahara-war",
    name: L("Western Sahara War", "Война в Западной Сахаре", "Війна в Західній Сахарі"),
    attackers: ["polisario"],
    defenders: ["morocco"],
    since: "1975-11-14",
  },
  {
    id: "angolan-civil-war",
    name: L("Angolan Civil War", "Гражданская война в Анголе", "Громадянська війна в Анголі"),
    attackers: ["unita"],
    defenders: ["angola"],
    since: "1975-11-11",
    civil: { of: "angola", rebels: "unita", how: "rising", legitimacy: { government: 55, rebels: 30 } },
  },
  {
    id: "rhodesian-bush-war",
    name: L("Rhodesian Bush War", "Война в Родезии", "Війна в Родезії"),
    attackers: ["zanu"],
    defenders: ["rhodesia"],
    since: "1966-04-28",
  },
  {
    id: "eritrean-war",
    name: L("Eritrean War of Independence", "Война за независимость Эритреи", "Війна за незалежність Еритреї"),
    attackers: ["eplf"],
    defenders: ["ethiopia"],
    since: "1961-09-01",
  },
];

export const scenario1979: Scenario = {
  id: "1979",
  map: "world_1994",
  startDate: "1979-12-25",
  defaultStep: "month",
  title: {
    ru: "Ввод войск в Афганистан",
    uk: "Введення військ в Афганістан",
    en: "Into Afghanistan",
  },
  tagline: {
    ru: "Советские войска переходят Амударью, а в Тегеране третий месяц держат американских заложников.",
    uk: "Радянські війська переходять Амудар'ю, а в Тегерані третій місяць тримають американських заручників.",
    en: "Soviet troops cross the Amu Darya, while in Tehran the American hostages enter their third month.",
  },
  story: {
    ru: "В три часа дня 25 декабря 1979 года по понтонному мосту через Амударью у Термеза в Афганистан входит советская мотострелковая дивизия, а на аэродромы Кабула и Баграма один за другим садятся транспортные самолёты с десантниками. Политбюро решило это двенадцатого декабря узким кругом: Брежнев, Андропов, Устинов и Громыко. Официально войска идут по просьбе афганского правительства; на деле спецназ готовится штурмовать дворец Хафизуллы Амина, а в обозе едет Бабрак Кармаль.\n\nАфганские коммунисты взяли власть в апреле 1978 года и восстановили против себя деревню реформами и террором. Восстали Нуристан, Кунар, Герат, Хазараджат; моджахеды из лагерей в Пакистане зовут к джихаду, армия разбегается. В сентябре Амин свергнул и задушил президента Тараки, любимца Брежнева, и Москва больше ему не верит. Ей кажется, что после иранской революции на её южной границе может вырасти враждебное исламское государство.\n\nСоседний Иран живёт по законам аятоллы Хомейни, и с 4 ноября студенты держат в американском посольстве пятьдесят двух заложников. Ирак Саддама Хусейна присматривается к ослабевшему соседу, нефть стоит больше тридцати долларов, а в Вашингтоне Картер готовится к выборам против Рейгана. Две недели назад НАТО решило разместить в Европе новые ракеты. Ввод войск может стать короткой операцией – или войной на десятилетие, которая похоронит разрядку.",
    uk: "О третій годині дня 25 грудня 1979 року понтонним мостом через Амудар'ю біля Термеза в Афганістан входить радянська мотострілецька дивізія, а на аеродроми Кабула й Баграма один за одним сідають транспортні літаки з десантниками. Політбюро вирішило це дванадцятого грудня вузьким колом: Брежнєв, Андропов, Устинов і Громико. Офіційно війська йдуть на прохання афганського уряду; насправді спецназ готується штурмувати палац Хафізулли Аміна, а в обозі їде Бабрак Кармаль.\n\nАфганські комуністи взяли владу у квітні 1978 року й налаштували проти себе село реформами та терором. Повстали Нурістан, Кунар, Герат, Хазараджат; моджахеди з таборів у Пакистані кличуть до джихаду, армія розбігається. У вересні Амін скинув і задушив президента Таракі, улюбленця Брежнєва, і Москва більше йому не вірить. Їй здається, що після іранської революції на її південному кордоні може вирости ворожа ісламська держава.\n\nСусідній Іран живе за законами аятоли Хомейні, і з 4 листопада студенти тримають в американському посольстві п'ятдесят двох заручників. Ірак Саддама Хусейна придивляється до ослаблого сусіда, нафта коштує понад тридцять доларів, а у Вашингтоні Картер готується до виборів проти Рейгана. Два тижні тому НАТО вирішило розмістити в Європі нові ракети. Введення військ може стати короткою операцією – або війною на десятиліття, яка поховає розрядку.",
    en: "At three in the afternoon on 25 December 1979 a Soviet motor-rifle division crosses into Afghanistan over a pontoon bridge on the Amu Darya at Termez, while transport aircraft carrying paratroopers land one after another at Kabul and Bagram. The Politburo decided it on 12 December in a narrow circle: Brezhnev, Andropov, Ustinov and Gromyko. Officially the troops come at the Afghan government's request; in truth special forces are preparing to storm Hafizullah Amin's palace, and Babrak Karmal travels with them.\n\nAfghanistan's communists took power in April 1978 and turned the villages against them with reforms and terror. Nuristan, Kunar, Herat and the Hazarajat have risen; mujahideen in camps in Pakistan call for jihad, and the army is melting away. In September Amin overthrew and smothered President Taraki, Brezhnev's favourite, and Moscow no longer trusts him. It fears that after Iran's revolution a hostile Islamic state could grow on its southern border.\n\nNext door Iran lives by Ayatollah Khomeini's law, and since 4 November students have held fifty-two Americans hostage in the US embassy. Saddam Hussein's Iraq eyes its weakened neighbour, oil costs over thirty dollars, and in Washington Carter prepares to face Reagan. Two weeks ago NATO decided to deploy new missiles in Europe. The intervention may be a short operation – or a decade's war that buries détente.",
  },
  briefing: {
    ru: "25 декабря 1979 года. Советские войска входят в Афганистан, где моджахеды восстали против коммунистов, а спецназ готовится свергнуть Амина. В Тегеране Хомейни держит американских заложников, Саддам Хусейн смотрит на Иран, вьетнамская армия добивает красных кхмеров в Камбодже, в Родезии подписано перемирие. Картер, Брежнев, Тэтчер и Дэн Сяопин – ответ на ввод войск решит, чем станут восьмидесятые.",
    uk: "25 грудня 1979 року. Радянські війська входять в Афганістан, де моджахеди повстали проти комуністів, а спецназ готується скинути Аміна. У Тегерані Хомейні тримає американських заручників, Саддам Хусейн дивиться на Іран, в'єтнамська армія добиває червоних кхмерів у Камбоджі, у Родезії підписано перемир'я. Картер, Брежнєв, Тетчер і Ден Сяопін – відповідь на введення військ вирішить, чим стануть вісімдесяті.",
    en: "25 December 1979. Soviet troops are entering Afghanistan, where the mujahideen have risen against the communists, and special forces prepare to overthrow Amin. In Tehran Khomeini holds American hostages, Saddam Hussein eyes Iran, Vietnam's army hunts the Khmer Rouge in Cambodia, and a ceasefire is signed in Rhodesia. Carter, Brezhnev, Thatcher and Deng Xiaoping – the answer to the intervention will decide what the eighties become.",
  },
  context: `Date: Tuesday 25 December 1979. At 15:00 Moscow time the 108th Motor Rifle Division began crossing the Amu Darya at Termez, and the 103rd Guards Airborne Division began landing at Kabul and Bagram; the 5th Guards Motor Rifle Division moves from Kushka toward Herat and Shindand. The Politburo's decision of 12 December (Brezhnev, Andropov, Ustinov, Gromyko, Suslov) was to send a "limited contingent" – the 40th Army, some 80,000 men within weeks – and to replace Hafizullah Amin with Babrak Karmal. KGB and GRU special forces (Grom, Zenit and the Muslim Battalion) are to storm Amin's Tajbeg Palace on the evening of 27 December (Operation Storm-333); Amin, who asked for Soviet troops himself, does not know he is the target. On the map the Soviet Union enters the War in Afghanistan on the government's side; the coup against Amin is the game master's to tell.
${AFGHANISTAN_1979}
${POWERS_1979}
${WORLD_1979}
Real history for reference: Amin was killed on 27 December and Karmal installed; the UN General Assembly condemned the intervention on 14 January 1980 (104 to 18); Carter announced a grain embargo and a boycott of the Moscow Olympics and declared the Carter Doctrine for the Gulf; the US and Saudi Arabia armed the mujahideen through Pakistan, with Stinger missiles from 1986; the Soviets withdrew under the Geneva Accords by 15 February 1989 after some 15,000 dead. Iraq invaded Iran on 22 September 1980, beginning an eight-year war; the hostages were freed on 20 January 1981 as Reagan took office; Solidarity was born in the Gdańsk shipyard in August 1980 and crushed by martial law in December 1981; Robert Mugabe won Zimbabwe's election in February 1980; Turkey's army took power on 12 September 1980; Sadat was assassinated in October 1981; Argentina seized the Falklands on 2 April 1982 and lost them in June; Israel invaded Lebanon in June 1982; Brezhnev died in November 1982; Mikhail Gorbachev became General Secretary in March 1985. None of this is fixed.`,
  aliases: {},
  owners: {},
  // Every modern country given its owner of December 1979 (coldwar.ts): Portugal's colonies free, Djibouti, Suriname, Papua New Guinea and the
  // Solomons too; East Timor annexed by Indonesia, the whole Western Sahara by Morocco; Rhodesia back under a British governor; Brunei and Belize British.
  modernOwners: {
    ...MODERN,
    ...all("ussr", SOVIET),
    ...all("yugoslavia", YUGOSLAV),
    ...all("czechoslovakia", CZECHOSLOVAK),
    DEU: "west-germany",
    MMR: "burma",
    ERI: "ethiopia",
    SDS: "sudan",
    PSX: "jordan",
    ZWE: "rhodesia",
    YEM: "north-yemen",
    SAH: "morocco",
    TLS: "indonesia",
    ...all("uk", ["BRN", "BLZ", "ATG", "KNA"]),
    NAM: "south-africa",
  },
  provinceOwners: {
    ...all("east-germany", EAST_GERMAN),
    ...all("south-yemen", ADEN),
    "ps-gaza": "egypt",
  },
  // What Israel still holds: the Golan, the West Bank, Gaza and the eastern Sinai it gives back by April 1982.
  provinceControllers: {
    "eg-south-sinai": "israel",
    "ps-west-bank": "israel",
    "ps-gaza": "israel",
    "sy-quneitra": "israel",
  },
  // The mujahideen in the mountains; the Khmer Rouge along the Thai border; Polisario in the desert; UNITA in the south-east; the Patriotic Front
  // across Rhodesia before the ceasefire; the Eritreans' Sahel redoubt.
  provinceContested: {
    "af-kunar": "mujahideen",
    "af-nuristan": "mujahideen",
    "af-paktia": "mujahideen",
    "af-badakhshan": "mujahideen",
    "af-bamyan": "mujahideen",
    "af-herat": "mujahideen",
    "af-kapisa": "mujahideen",
    "af-ghazni": "mujahideen",
    "af-urozgan": "mujahideen",
    "af-badghis": "mujahideen",
    "kh-battambang": "khmer-rouge",
    "kh-pursat": "khmer-rouge",
    "kh-koh-kong": "khmer-rouge",
    "kh-pailin": "khmer-rouge",
    "kh-oddar-meanchey": "khmer-rouge",
    "kh-banteay-meanchey": "khmer-rouge",
    "kh-preah-vihear": "khmer-rouge",
    "eh-western-sahara": "polisario",
    "ma-laayoune-boujdour-sakia-el-hamra": "polisario",
    "ma-oued-ed-dahab": "polisario",
    "ao-cuando-cubango": "unita",
    "ao-moxico": "unita",
    "ao-bie": "unita",
    "zw-mashonaland-central": "zanu",
    "zw-manicaland": "zanu",
    "zw-masvingo": "zanu",
    "zw-mashonaland-east": "zanu",
    "zw-matabeleland-north": "zanu",
    "zw-midlands": "zanu",
    "er-northern-red-sea": "eplf",
    "er-anseba": "eplf",
    "er-gash-barka": "eplf",
  },
  provinceHeld: {
    "af-kunar": 50,
    "af-nuristan": 60,
    "af-paktia": 35,
    "af-badakhshan": 35,
    "af-bamyan": 50,
    "af-herat": 20,
    "af-kapisa": 35,
    "af-ghazni": 30,
    "af-urozgan": 40,
    "af-badghis": 30,
    "kh-battambang": 30,
    "kh-pursat": 35,
    "kh-koh-kong": 40,
    "kh-pailin": 60,
    "kh-oddar-meanchey": 40,
    "kh-banteay-meanchey": 30,
    "kh-preah-vihear": 30,
    "eh-western-sahara": 40,
    "ma-laayoune-boujdour-sakia-el-hamra": 25,
    "ma-oued-ed-dahab": 30,
    "ao-cuando-cubango": 50,
    "ao-moxico": 25,
    "ao-bie": 15,
    "zw-mashonaland-central": 40,
    "zw-manicaland": 40,
    "zw-masvingo": 35,
    "zw-mashonaland-east": 30,
    "zw-matabeleland-north": 30,
    "zw-midlands": 20,
    "er-northern-red-sea": 40,
    "er-anseba": 30,
    "er-gash-barka": 15,
  },
  protests: [
    {
      title: L("Students and dissidents for democracy", "Студенты и диссиденты за демократию", "Студенти й дисиденти за демократію"),
      country: "south-korea",
      stage: "rally",
      size: 20,
      where: ["kr-seoul", "kr-gwangju"],
      demands: L(
        "Repeal of the Yushin constitution, a direct presidential election, an end to martial law",
        "Отмена конституции «Юсин», прямые президентские выборы, конец военного положения",
        "Скасування конституції «Юсін», прямі президентські вибори, кінець воєнного стану",
      ),
      by: L("Students; the followers of Kim Dae-jung and Kim Young-sam", "Студенты; сторонники Ким Дэ Чжуна и Ким Ён Сама", "Студенти; прихильники Кім Де Чжуна та Кім Йон Сама"),
      support: 55,
      organisation: 40,
      killed: 0,
    },
  ],
  // Amin's army deserting and his party split; Khomeini's guards trusted where the Shah's army is not; Chun Doo-hwan's coup of 12 December;
  // the Rhodesian forces under a British governor; the Sandinistas' new army.
  loyalty: {
    afghanistan: { army: 35, police: 45, security: 50, elites: 25 },
    iran: { army: 45, police: 50, security: 75, elites: 55 },
    "south-korea": { army: 60, police: 60, security: 55, elites: 45 },
    rhodesia: { army: 60, police: 70, security: 60, elites: 50 },
    nicaragua: { army: 70, police: 65, security: 70, elites: 40 },
  },
  // People in 1979 within today's borders: five-ninths of the way, by growth, from the counts of 1964 (UN estimates) to the map's of 1991;
  // China's grew faster early, Cambodia's fell under the Khmer Rouge, Afghanistan's refugees fled only after.
  people: {
    others: 0.8,
    byCountry: {
      CHN: 970000, IND: 673500, USA: 223300, IDN: 139700, RUS: 137900, BRA: 114500, JPN: 111200, BGD: 81500, PAK: 79900, DEU: 78000,
      NGA: 71600, MEX: 62300, GBR: 55900, ITA: 54300, FRA: 53700, VNM: 51000, UKR: 48500, PHL: 44600, EGY: 42300, TUR: 42100, THA: 42100,
      IRN: 38300, ETH: 36200, ESP: 35500, KOR: 35500, POL: 35000, MMR: 31700, ZAF: 27900, ARG: 27300, COD: 26200, COL: 25800, CAN: 23700,
      ROU: 21100, MAR: 18600, DZA: 18300, TZA: 18100, TWN: 16400, PRK: 16300, PER: 16200, KEN: 15800, UZB: 15100, NPL: 14300, AUS: 14200,
      KAZ: 14100, LKA: 14100, SDN: 13800, VEN: 13700, NLD: 13600, MYS: 13400, UGA: 12300, IRQ: 12300, GHA: 11200, AFG: 13000, MOZ: 10900,
      CHL: 10900, HUN: 10200, CZE: 10000, BEL: 9700, PRT: 9500, GRC: 9400, BLR: 9400, SAU: 9200, CUB: 9200, MDG: 8800, YEM: 8700,
      CMR: 8600, AGO: 8600, BGR: 8500, SYR: 8400, SWE: 8100, KHM: 6600, SRB: 7700, CIV: 7600, ECU: 7600, AUT: 7500, MLI: 7100, BFA: 7100,
      ZWE: 7100, GTM: 6800, MWI: 6500, CHE: 6300, TUN: 6300, AZE: 5800, NER: 5700, ZMB: 5600, HTI: 5600, SEN: 5400, DOM: 5400, BOL: 5300,
      DNK: 5000, GEO: 4900, SOM: 4900, RWA: 4900, GIN: 4900, SVK: 4800, FIN: 4800, HRV: 4500, TCD: 4500, HKG: 4400, SDS: 4300, BDI: 4300,
      SLV: 4100, BIH: 4000, NOR: 4000, MDA: 3800, TJK: 3800, BEN: 3700, ISR: 3600, HND: 3500, KGZ: 3400, LTU: 3300, LAO: 3300, SLE: 3200,
      IRL: 3200, NZL: 3100, PRY: 3100, PRI: 3100, URY: 2900, NIC: 2900, ARM: 2800, TKM: 2700, LBY: 2700, TGO: 2700, LBN: 2500, ALB: 2500,
      LVA: 2400, SGP: 2400, ERI: 2300, CRI: 2300, CAF: 2200, JAM: 2100, JOR: 2000, SVN: 1800, MKD: 1800, PAN: 1800, COG: 1700, LBR: 1600,
      MNG: 1600, PSX: 1500, MRT: 1500, KOS: 1400, EST: 1400, NAM: 1000, BWA: 900, LSO: 900, TTO: 900, GAB: 700, CYP: 700, MNE: 600,
      GUY: 600, MLT: 400,
    },
  },
  countries: {
    usa: seed(L("United States", "США", "США"), "#6680c2", "President Jimmy Carter; National Security Adviser Zbigniew Brzezinski", L("Federal republic", "Федеративная республика", "Федеративна республіка"), { stability: 55, economy: 95, military: 85 }),
    ussr: seed(L("Soviet Union", "СССР", "СРСР"), "#a3292c", "General Secretary Leonid Brezhnev; Premier Alexei Kosygin", COMMUNIST, { stability: 70, economy: 60, military: 95 }),
    uk: seed(L("United Kingdom", "Великобритания", "Велика Британія"), "#d0666b", "PM Margaret Thatcher; Queen Elizabeth II", MONARCHY, { stability: 55, economy: 55, military: 50 }),
    france: seed(L("France", "Франция", "Франція"), "#4a72b8", "President Valéry Giscard d'Estaing; PM Raymond Barre", L("Fifth Republic", "Пятая республика", "П'ята республіка"), { stability: 65, economy: 60, military: 55 }),
    "west-germany": seed(L("West Germany", "ФРГ", "ФРН"), "#6f7277", "Chancellor Helmut Schmidt", L("Federal parliamentary republic", "Федеративная парламентская республика", "Федеративна парламентська республіка"), { stability: 75, economy: 70, military: 45 }),
    "east-germany": seed(L("East Germany", "ГДР", "НДР"), "#a4646a", "General Secretary Erich Honecker", PEOPLES_REPUBLIC, { stability: 60, economy: 40, military: 25 }),
    italy: seed(L("Italy", "Италия", "Італія"), "#5a9d55", "PM Francesco Cossiga; President Sandro Pertini", PARLIAMENTARY, { stability: 40, economy: 45, military: 25 }),
    spain: seed(L("Spain", "Испания", "Іспанія"), "#d9ab45", "King Juan Carlos I; PM Adolfo Suárez", L("Constitutional monarchy, a democracy since 1977", "Конституционная монархия, демократия с 1977 года", "Конституційна монархія, демократія з 1977 року"), { stability: 50, economy: 35, military: 25 }),
    portugal: seed(L("Portugal", "Португалия", "Португалія"), "#4e8a5e", "President António Ramalho Eanes; PM Maria de Lourdes Pintasilgo", L("Semi-presidential republic", "Полупрезидентская республика", "Напівпрезидентська республіка"), { stability: 45, economy: 15, military: 12 }),
    greece: seed(L("Greece", "Греция", "Греція"), "#5b8fd6", "PM Konstantinos Karamanlis; President Konstantinos Tsatsos", PARLIAMENTARY, { stability: 60, economy: 18, military: 25 }),
    turkey: seed(L("Turkey", "Турция", "Туреччина"), "#4f9a8c", "PM Süleyman Demirel; President Fahri Korutürk", L("Parliamentary republic in a street war of left and right", "Парламентская республика в уличной войне левых и правых", "Парламентська республіка у вуличній війні лівих і правих"), { stability: 25, economy: 18, military: 40 }),
    austria: seed(L("Austria", "Австрия", "Австрія"), "#c96f6f", "Chancellor Bruno Kreisky", L("Neutral federal republic", "Нейтральная федеративная республика", "Нейтральна федеративна республіка"), { stability: 80, economy: 22, military: 5 }),
    poland: seed(L("Poland", "Польша", "Польща"), "#d27b93", "First Secretary Edward Gierek", PEOPLES_REPUBLIC, { stability: 45, economy: 28, military: 30 }),
    czechoslovakia: seed(L("Czechoslovakia", "Чехословакия", "Чехословаччина"), "#6d9bd0", "General Secretary Gustáv Husák", PEOPLES_REPUBLIC, { stability: 60, economy: 33, military: 25 }),
    hungary: seed(L("Hungary", "Венгрия", "Угорщина"), "#9fb06a", "First Secretary János Kádár", PEOPLES_REPUBLIC, { stability: 65, economy: 25, military: 10 }),
    romania: seed(L("Romania", "Румыния", "Румунія"), "#d8bd46", "President Nicolae Ceaușescu", L("One-party state of Ceaușescu", "Однопартийное государство Чаушеску", "Однопартійна держава Чаушеску"), { stability: 60, economy: 22, military: 20 }),
    bulgaria: seed(L("Bulgaria", "Болгария", "Болгарія"), "#6c9a50", "General Secretary Todor Zhivkov", PEOPLES_REPUBLIC, { stability: 70, economy: 18, military: 18 }),
    yugoslavia: seed(L("Yugoslavia", "Югославия", "Югославія"), "#8873b3", "President Josip Broz Tito", L("Non-aligned communist federation", "Неприсоединившаяся коммунистическая федерация", "Неприєднана комуністична федерація"), { stability: 55, economy: 25, military: 35 }),
    albania: seed(L("Albania", "Албания", "Албанія"), "#a4453f", "Enver Hoxha", PEOPLES_REPUBLIC, { stability: 70, economy: 4, military: 8 }),
    china: seed(L("People's Republic of China", "КНР", "КНР"), "#cf3d2e", "Vice-Chairman Deng Xiaoping; Chairman Hua Guofeng", COMMUNIST, { stability: 60, economy: 30, military: 70 }),
    taiwan: seed(L("Republic of China", "Китайская Республика", "Китайська Республіка"), "#5a86c6", "President Chiang Ching-kuo", L("One-party state under martial law", "Однопартийное государство на военном положении", "Однопартійна держава на воєнному стані"), { stability: 65, economy: 35, military: 35 }),
    japan: seed(L("Japan", "Япония", "Японія"), "#e6d6a6", "PM Masayoshi Ōhira", MONARCHY, { stability: 70, economy: 80, military: 20 }),
    "north-korea": seed(L("North Korea", "КНДР", "КНДР"), "#a05a6a", "President Kim Il-sung", COMMUNIST, { stability: 80, economy: 18, military: 55 }),
    "south-korea": seed(L("South Korea", "Республика Корея", "Республіка Корея"), "#7f9fc9", "President Choi Kyu-hah; Major General Chun Doo-hwan", L("Presidential republic under martial law after Park's murder", "Президентская республика на военном положении после убийства Пака", "Президентська республіка на воєнному стані після вбивства Пака"), { stability: 35, economy: 30, military: 45 }),
    vietnam: seed(L("Vietnam", "Вьетнам", "В'єтнам"), "#b8453a", "General Secretary Le Duan; PM Pham Van Dong", COMMUNIST, { stability: 55, economy: 8, military: 60 }),
    cambodia: seed(L("People's Republic of Kampuchea", "Народная Республика Кампучия", "Народна Республіка Кампучія"), "#6a9ab0", "President Heng Samrin", L("People's republic under Vietnamese occupation", "Народная республика под вьетнамской оккупацией", "Народна республіка під в'єтнамською окупацією"), { stability: 20, economy: 1, military: 5 }),
    "khmer-rouge": {
      ...seed(L("Democratic Kampuchea (Khmer Rouge)", "Демократическая Кампучия (красные кхмеры)", "Демократична Кампучія (червоні кхмери)"), "#5a2a2a", "Pol Pot; PM Khieu Samphan", L("The overthrown regime fighting from the Thai border", "Свергнутый режим, воюющий с таиландской границы", "Повалений режим, що воює з таїландського кордону"), { stability: 50, economy: 1, military: 8 }),
      dormant: true,
    },
    laos: seed(L("Laos", "Лаос", "Лаос"), "#8fae6a", "General Secretary Kaysone Phomvihane; President Souphanouvong", COMMUNIST, { stability: 55, economy: 2, military: 6 }),
    thailand: seed(L("Thailand", "Таиланд", "Таїланд"), "#6a8fc9", "PM Kriangsak Chomanan", JUNTA, { stability: 45, economy: 22, military: 25 }),
    burma: seed(L("Burma", "Бирма", "Бірма"), "#c9b04a", "General Ne Win", L("One-party socialist state of the army", "Однопартийное социалистическое государство армии", "Однопартійна соціалістична держава армії"), { stability: 45, economy: 7, military: 20 }),
    india: seed(L("India", "Индия", "Індія"), "#e0a458", "PM Charan Singh; President Neelam Sanjiva Reddy", L("Federal parliamentary republic", "Федеративная парламентская республика", "Федеративна парламентська республіка"), { stability: 45, economy: 28, military: 50 }),
    pakistan: seed(L("Pakistan", "Пакистан", "Пакистан"), "#3f7f4f", "President General Muhammad Zia-ul-Haq", L("Military rule under martial law", "Военное правление на военном положении", "Військове правління на воєнному стані"), { stability: 40, economy: 12, military: 35 }),
    bangladesh: seed(L("Bangladesh", "Бангладеш", "Бангладеш"), "#2f7f5f", "President Ziaur Rahman", PRESIDENTIAL, { stability: 40, economy: 6, military: 8 }),
    "sri-lanka": seed(L("Sri Lanka", "Шри-Ланка", "Шрі-Ланка"), "#c98c6b", "President J. R. Jayewardene", PRESIDENTIAL, { stability: 50, economy: 6, military: 4 }),
    indonesia: seed(L("Indonesia", "Индонезия", "Індонезія"), "#c4614f", "President Suharto", L("Military-backed New Order", "«Новый порядок» военных", "«Новий порядок» військових"), { stability: 60, economy: 22, military: 35 }),
    malaysia: seed(L("Malaysia", "Малайзия", "Малайзія"), "#5f7fb5", "PM Hussein Onn", L("Federal constitutional monarchy", "Федеративная конституционная монархия", "Федеративна конституційна монархія"), { stability: 60, economy: 18, military: 12 }),
    singapore: seed(L("Singapore", "Сингапур", "Сінгапур"), "#c94f5f", "PM Lee Kuan Yew", L("Parliamentary republic of the People's Action Party", "Парламентская республика Партии народного действия", "Парламентська республіка Партії народної дії"), { stability: 80, economy: 14, military: 7 }),
    philippines: seed(L("Philippines", "Филиппины", "Філіппіни"), "#6a8fd0", "President Ferdinand Marcos", L("Presidential republic under martial law", "Президентская республика на военном положении", "Президентська республіка на воєнному стані"), { stability: 40, economy: 15, military: 15 }),
    afghanistan: seed(L("Afghanistan", "Афганистан", "Афганістан"), "#a3876a", "General Secretary Hafizullah Amin", L("Democratic Republic of the communist party (Khalq)", "Демократическая Республика коммунистической партии (Хальк)", "Демократична Республіка комуністичної партії (Хальк)"), { stability: 15, economy: 3, military: 10 }),
    mujahideen: {
      ...seed(L("Mujahideen", "Моджахеды", "Моджахеди"), "#4f6f4f", "Burhanuddin Rabbani; Gulbuddin Hekmatyar", L("Islamic insurgency of many parties", "Исламское повстанческое движение многих партий", "Ісламський повстанський рух багатьох партій"), { stability: 40, economy: 1, military: 5 }),
      dormant: true,
    },
    iran: seed(L("Iran", "Иран", "Іран"), "#7fae86", "Supreme Leader Ruhollah Khomeini", L("Islamic Republic in revolution", "Исламская республика в революции", "Ісламська республіка в революції"), { stability: 40, economy: 20, military: 25 }),
    iraq: seed(L("Iraq", "Ирак", "Ірак"), "#9a8f5f", "President Saddam Hussein", BAATH, { stability: 60, economy: 22, military: 40 }),
    israel: seed(L("Israel", "Израиль", "Ізраїль"), "#7fa8d4", "PM Menachem Begin", PARLIAMENTARY, { stability: 60, economy: 30, military: 65 }),
    egypt: seed(L("Egypt", "Египет", "Єгипет"), "#d6c27a", "President Anwar Sadat", L("Presidential republic of the National Democratic Party", "Президентская республика Национально-демократической партии", "Президентська республіка Національно-демократичної партії"), { stability: 55, economy: 20, military: 45 }),
    syria: seed(L("Syria", "Сирия", "Сирія"), "#8c9a5a", "President Hafez al-Assad", BAATH, { stability: 50, economy: 10, military: 45 }),
    jordan: seed(L("Jordan", "Иордания", "Йорданія"), "#c4a46a", "King Hussein", MONARCHY, { stability: 60, economy: 7, military: 20 }),
    lebanon: seed(L("Lebanon", "Ливан", "Ліван"), "#7fb58a", "President Elias Sarkis", L("Republic torn by civil war", "Республика, расколотая гражданской войной", "Республіка, розколота громадянською війною"), { stability: 10, economy: 5, military: 3 }),
    "saudi-arabia": seed(L("Saudi Arabia", "Саудовская Аравия", "Саудівська Аравія"), "#6f9e5a", "King Khalid bin Abdulaziz; Crown Prince Fahd bin Abdulaziz", ABSOLUTE, { stability: 60, economy: 35, military: 15 }),
    kuwait: seed(L("Kuwait", "Кувейт", "Кувейт"), "#6aa38f", "Emir Jaber Al-Ahmad Al-Sabah", L("Emirate", "Эмират", "Емірат"), { stability: 70, economy: 15, military: 4 }),
    libya: seed(L("Libya", "Ливия", "Лівія"), "#9fb07a", "Colonel Muammar Gaddafi", L("Jamahiriya of the people's committees", "Джамахирия народных комитетов", "Джамахирія народних комітетів"), { stability: 60, economy: 18, military: 15 }),
    "north-yemen": seed(L("North Yemen", "Северный Йемен", "Північний Ємен"), "#a8826a", "President Ali Abdullah Saleh", L("Yemen Arab Republic under the army", "Йеменская Арабская Республика под властью армии", "Єменська Арабська Республіка під владою армії"), { stability: 35, economy: 3, military: 8 }),
    "south-yemen": seed(L("South Yemen", "Южный Йемен", "Південний Ємен"), "#b06a5a", "Abdul Fattah Ismail", L("Marxist People's Democratic Republic of Yemen", "Марксистская Народная Демократическая Республика Йемен", "Марксистська Народна Демократична Республіка Ємен"), { stability: 45, economy: 2, military: 6 }),
    oman: seed(L("Oman", "Оман", "Оман"), "#b5735a", "Sultan Qaboos bin Said", ABSOLUTE, { stability: 60, economy: 6, military: 6 }),
    algeria: seed(L("Algeria", "Алжир", "Алжир"), "#5f8f6a", "President Chadli Bendjedid", ONE_PARTY, { stability: 65, economy: 18, military: 18 }),
    morocco: seed(L("Morocco", "Марокко", "Марокко"), "#a0523d", "King Hassan II", MONARCHY, { stability: 50, economy: 12, military: 18 }),
    polisario: {
      ...seed(L("Polisario Front (SADR)", "Фронт Полисарио (САДР)", "Фронт Полісаріо (САДР)"), "#3f8f6a", "Secretary-General Mohamed Abdelaziz", INSURGENCY, { stability: 65, economy: 1, military: 4 }),
      dormant: true,
    },
    tunisia: seed(L("Tunisia", "Тунис", "Туніс"), "#c26b5a", "President Habib Bourguiba", ONE_PARTY, { stability: 55, economy: 9, military: 4 }),
    ethiopia: seed(L("Ethiopia", "Эфиопия", "Ефіопія"), "#7f9a4f", "Chairman Mengistu Haile Mariam", L("Marxist military junta (the Derg)", "Марксистская военная хунта (Дерг)", "Марксистська військова хунта (Дерг)"), { stability: 35, economy: 5, military: 30 }),
    eplf: {
      ...seed(L("Eritrean fronts (EPLF and ELF)", "Фронты Эритреи (НФОЭ и ФОЭ)", "Фронти Еритреї (НФВЕ і ФВЕ)"), "#4f8f7a", "EPLF leader Isaias Afwerki", INSURGENCY, { stability: 65, economy: 1, military: 8 }),
      dormant: true,
    },
    somalia: seed(L("Somalia", "Сомали", "Сомалі"), "#6fa0d0", "President Siad Barre", L("Military regime after the lost Ogaden war", "Военный режим после проигранной огаденской войны", "Військовий режим після програної огаденської війни"), { stability: 35, economy: 2, military: 10 }),
    sudan: seed(L("Sudan", "Судан", "Судан"), "#b0905a", "President Gaafar Nimeiry", ONE_PARTY, { stability: 40, economy: 6, military: 10 }),
    nigeria: seed(L("Nigeria", "Нигерия", "Нігерія"), "#5aa36a", "President Shehu Shagari", L("Presidential republic, civilian since October", "Президентская республика, гражданская с октября", "Президентська республіка, цивільна з жовтня"), { stability: 50, economy: 22, military: 20 }),
    "dr-congo": seed(L("Zaire", "Заир", "Заїр"), "#6f8fb0", "President Mobutu Sese Seko", ONE_PARTY, { stability: 35, economy: 6, military: 10 }),
    uganda: seed(L("Uganda", "Уганда", "Уганда"), "#c78f3f", "President Godfrey Binaisa", L("Provisional government under Tanzanian occupation", "Временное правительство под танзанийской оккупацией", "Тимчасовий уряд під танзанійською окупацією"), { stability: 20, economy: 2, military: 3 }),
    tanzania: seed(L("Tanzania", "Танзания", "Танзанія"), "#4fa0a0", "President Julius Nyerere", ONE_PARTY, { stability: 60, economy: 4, military: 8 }),
    zambia: seed(L("Zambia", "Замбия", "Замбія"), "#5f9e5a", "President Kenneth Kaunda", ONE_PARTY, { stability: 50, economy: 5, military: 4 }),
    mozambique: seed(L("Mozambique", "Мозамбик", "Мозамбік"), "#3a7f5a", "President Samora Machel", L("Marxist one-party state of FRELIMO", "Марксистское однопартийное государство ФРЕЛИМО", "Марксистська однопартійна держава ФРЕЛІМО"), { stability: 45, economy: 3, military: 8 }),
    angola: seed(L("Angola", "Ангола", "Ангола"), "#b34a3a", "President José Eduardo dos Santos", L("Marxist one-party state of the MPLA", "Марксистское однопартийное государство МПЛА", "Марксистська однопартійна держава МПЛА"), { stability: 40, economy: 6, military: 12 }),
    unita: {
      ...seed(L("UNITA", "УНИТА", "УНІТА"), "#8a6a3a", "Jonas Savimbi", INSURGENCY, { stability: 60, economy: 1, military: 6 }),
      dormant: true,
    },
    rhodesia: seed(L("Southern Rhodesia", "Южная Родезия", "Південна Родезія"), "#7a9a6e", "Governor Lord Soames", L("British colony under a governor until the elections", "Британская колония под властью губернатора до выборов", "Британська колонія під владою губернатора до виборів"), { stability: 35, economy: 8, military: 15 }),
    zanu: {
      ...seed(L("Patriotic Front (ZANU and ZAPU)", "Патриотический фронт (ЗАНУ и ЗАПУ)", "Патріотичний фронт (ЗАНУ і ЗАПУ)"), "#3f6f3a", "Robert Mugabe; Joshua Nkomo", INSURGENCY, { stability: 60, economy: 1, military: 8 }),
      dormant: true,
    },
    "south-africa": seed(L("South Africa", "ЮАР", "ПАР"), "#c48a5a", "PM P. W. Botha", L("Republic ruled by the white minority (apartheid)", "Республика под властью белого меньшинства (апартеид)", "Республіка під владою білої меншості (апартеїд)"), { stability: 55, economy: 35, military: 35 }),
    cuba: seed(L("Cuba", "Куба", "Куба"), "#5a7fbf", "President Fidel Castro", COMMUNIST, { stability: 70, economy: 12, military: 30 }),
    nicaragua: seed(L("Nicaragua", "Никарагуа", "Нікарагуа"), "#4f6fb0", "Junta coordinator Daniel Ortega", L("Revolutionary junta of the Sandinistas", "Революционная хунта сандинистов", "Революційна хунта сандиністів"), { stability: 50, economy: 2, military: 6 }),
    mexico: seed(L("Mexico", "Мексика", "Мексика"), "#5f9e6a", "President José López Portillo", L("One-party republic (the PRI)", "Однопартийная республика (ИРП)", "Однопартійна республіка (ІРП)"), { stability: 60, economy: 35, military: 10 }),
    brazil: seed(L("Brazil", "Бразилия", "Бразилія"), "#4f9a5f", "President João Figueiredo", L("Military regime opening slowly", "Военный режим, медленно открывающийся", "Військовий режим, що повільно відкривається"), { stability: 50, economy: 40, military: 25 }),
    argentina: seed(L("Argentina", "Аргентина", "Аргентина"), "#8fbfe0", "President Jorge Rafael Videla", L("Military junta (the National Reorganisation Process)", "Военная хунта («Процесс национальной реорганизации»)", "Військова хунта («Процес національної реорганізації»)"), { stability: 45, economy: 25, military: 25 }),
    chile: seed(L("Chile", "Чили", "Чилі"), "#b04a5a", "President Augusto Pinochet", L("Military dictatorship", "Военная диктатура", "Військова диктатура"), { stability: 55, economy: 12, military: 18 }),
    venezuela: seed(L("Venezuela", "Венесуэла", "Венесуела"), "#c9a65a", "President Luis Herrera Campins", PRESIDENTIAL, { stability: 60, economy: 25, military: 10 }),
    canada: seed(L("Canada", "Канада", "Канада"), "#c44f4f", "PM Joe Clark", DOMINION, { stability: 60, economy: 55, military: 20 }),
    australia: seed(L("Australia", "Австралия", "Австралія"), "#d88a5a", "PM Malcolm Fraser", DOMINION, { stability: 70, economy: 45, military: 15 }),
    "new-zealand": seed(L("New Zealand", "Новая Зеландия", "Нова Зеландія"), "#4f7fb0", "PM Robert Muldoon", DOMINION, { stability: 70, economy: 20, military: 5 }),
    mongolia: seed(L("Mongolia", "Монголия", "Монголія"), "#9a78b8", "General Secretary Yumjaagiin Tsedenbal", PEOPLES_REPUBLIC, { stability: 70, economy: 3, military: 6 }),
  },
  wars: WARS,
  alliances: withTreaties(
    [
      {
        id: "un",
        kind: "organization",
        name: L("United Nations", "Организация Объединённых Наций", "Організація Об'єднаних Націй"),
        // Taiwan has been out since 1971; the Koreas and Switzerland are outside; Cambodia's seat is the Khmer Rouge's, not the new government's.
        members: [],
        allExcept: [
          "taiwan", "north-korea", "south-korea", "switzerland", "cambodia", "rhodesia", "zanu", "mujahideen", "unita", "polisario", "eplf",
          "andorra", "liechtenstein",
        ],
        since: "1945-10-24",
      },
      {
        id: "nato",
        name: L("NATO", "НАТО", "НАТО"),
        members: ["usa", "uk", "france", "italy", "canada", "netherlands", "belgium", "luxembourg", "denmark", "norway", "iceland", "portugal", "greece", "turkey", "west-germany"],
        since: "1949-04-04",
      },
      {
        id: "warsaw-pact",
        name: L("Warsaw Pact", "Организация Варшавского договора", "Організація Варшавського договору"),
        members: ["ussr", "poland", "czechoslovakia", "hungary", "romania", "bulgaria", "east-germany"],
        since: "1955-05-14",
      },
    ],
    TERMS_1979,
    TREATIES_1979,
  ),
  featured: ["ussr", "afghanistan", "usa", "iran", "iraq", "china", "vietnam", "uk", "israel", "pakistan"],
  // A week before: the 40th Army assembled at Termez and Kushka, paratroopers already at Bagram, Amin asking for more Soviet help; Lancaster House not yet signed.
  variants: {
    eve: {
      startDate: "1979-12-18",
      defaultStep: "week",
      wars: WARS.map((w) => (w.id === AFGHAN_WAR.id ? { ...w, defenders: ["afghanistan"] } : w)),
      tagline: {
        ru: "У Термеза собирается 40-я армия, Амин просит у Москвы ещё войск, не зная, что решено его свергнуть.",
        uk: "Біля Термеза збирається 40-а армія, Амін просить у Москви ще військ, не знаючи, що вирішено його скинути.",
        en: "The 40th Army gathers at Termez, and Amin asks Moscow for more troops, not knowing it has decided to overthrow him.",
      },
      story: {
        ru: "18 декабря 1979 года у Термеза и Кушки на советской границе с Афганистаном собирается 40-я армия: мотострелковые дивизии из резервистов Средней Азии, понтонные парки, тыловые колонны. Решение принято шесть дней назад узким кругом Политбюро и не записано полностью даже в протоколе. Под видом охраны на аэродроме Баграм уже стоят советские десантники, а в Кабуле «мусульманский батальон» ГРУ в афганской форме охраняет дворец Тадж-Бек.\n\nХафизулла Амин, свергнувший и убивший Тараки, сам просит Москву прислать войска против моджахедов, которые восстали в горах и захватывают уезд за уездом. Он не знает, что КГБ уже дважды пытался его отравить и что в Москве ему готовят замену – Бабрака Кармаля. Армия Афганистана тает, а в лагерях беженцев в Пакистане партии моджахедов зовут к джихаду.\n\nМир смотрит в другую сторону. В Тегеране сорок пятый день держат американских заложников, Картер заморозил иранские вклады, НАТО шесть дней назад решило разместить в Европе «Першинги». В Лондоне вот-вот подпишут соглашение о Родезии, Вьетнам добивает красных кхмеров в камбоджийских джунглях. Через неделю колонны двинутся через Амударью – если ничто их не остановит.",
        uk: "18 грудня 1979 року біля Термеза й Кушки на радянському кордоні з Афганістаном збирається 40-а армія: мотострілецькі дивізії з резервістів Середньої Азії, понтонні парки, тилові колони. Рішення ухвалено шість днів тому вузьким колом Політбюро й не записано повністю навіть у протоколі. Під виглядом охорони на аеродромі Баграм уже стоять радянські десантники, а в Кабулі «мусульманський батальйон» ГРУ в афганській формі охороняє палац Тадж-Бек.\n\nХафізулла Амін, який скинув і вбив Таракі, сам просить Москву надіслати війська проти моджахедів, що повстали в горах і захоплюють повіт за повітом. Він не знає, що КДБ уже двічі намагався його отруїти й що в Москві йому готують заміну – Бабрака Кармаля. Армія Афганістану тане, а в таборах біженців у Пакистані партії моджахедів кличуть до джихаду.\n\nСвіт дивиться в інший бік. У Тегерані сорок п'ятий день тримають американських заручників, Картер заморозив іранські вклади, НАТО шість днів тому вирішило розмістити в Європі «Першинги». У Лондоні от-от підпишуть угоду про Родезію, В'єтнам добиває червоних кхмерів у камбоджійських джунглях. За тиждень колони рушать через Амудар'ю – якщо ніщо їх не зупинить.",
        en: "On 18 December 1979 the 40th Army is gathering at Termez and Kushka on the Soviet border with Afghanistan: motor-rifle divisions filled with Central Asian reservists, pontoon parks, supply columns. The decision was taken six days ago by a narrow circle of the Politburo and is not fully written down even in the minutes. Soviet paratroopers already stand at Bagram airfield as guards, and in Kabul the GRU's 'Muslim battalion', in Afghan uniform, guards the Tajbeg Palace.\n\nHafizullah Amin, who overthrew and killed Taraki, himself asks Moscow to send troops against the mujahideen, who have risen in the mountains and take district after district. He does not know that the KGB has twice tried to poison him, or that Moscow has his replacement ready – Babrak Karmal. Afghanistan's army is melting away, and in the refugee camps of Pakistan the mujahideen parties call for jihad.\n\nThe world is looking the other way. In Tehran the American hostages are in their forty-fifth day, Carter has frozen Iran's assets, and six days ago NATO decided to deploy Pershings in Europe. In London a Rhodesian settlement is about to be signed, and Vietnam hunts the Khmer Rouge in the Cambodian jungle. In a week the columns will cross the Amu Darya – unless something stops them.",
      },
      briefing: {
        ru: "18 декабря 1979 года. Политбюро тайно решило ввести войска в Афганистан и заменить Амина Кармалем; 40-я армия собирается у границы, десантники уже в Баграме. Моджахеды наступают, Амин сам просит о помощи. В Тегеране заложники, в Лондоне готово соглашение о Родезии, в Камбодже вьетнамцы добивают красных кхмеров. За неделю до ввода войск его ещё можно отменить, предупредить или подготовить ответ.",
        uk: "18 грудня 1979 року. Політбюро таємно вирішило ввести війська в Афганістан і замінити Аміна Кармалем; 40-а армія збирається біля кордону, десантники вже в Баграмі. Моджахеди наступають, Амін сам просить про допомогу. У Тегерані заручники, у Лондоні готова угода про Родезію, у Камбоджі в'єтнамці добивають червоних кхмерів. За тиждень до введення військ його ще можна скасувати, попередити або підготувати відповідь.",
        en: "18 December 1979. The Politburo has decided in secret to send troops into Afghanistan and replace Amin with Karmal; the 40th Army gathers at the border and paratroopers are already at Bagram. The mujahideen advance, and Amin himself asks for help. Hostages are held in Tehran, a Rhodesian settlement is ready in London, and in Cambodia the Vietnamese hunt the Khmer Rouge. A week before the troops go in, it can still be called off, forestalled or answered in advance.",
      },
      context: `Date: Tuesday 18 December 1979, a week before the Soviet intervention in Afghanistan. The Politburo decided on 12 December (Brezhnev, Andropov, Ustinov, Gromyko, Suslov; recorded only as "Concerning the situation in 'A'") to send troops and to remove Hafizullah Amin; Babrak Karmal waits at Bagram under Soviet guard. The 40th Army (Lieutenant General Yuri Tukharinov) is forming at Termez and Kushka from mobilised reservists; a battalion of the 345th Airborne Regiment has guarded Bagram since July, and the GRU's Muslim Battalion has guarded the Tajbeg Palace since 14 December. Amin, wounded in a shooting on 17 December, asks for Soviet divisions himself. The Soviet Union is not yet at war in Afghanistan; the insurgents fight only the Afghan government. Lancaster House has not been signed (it will be on 21 December); Lord Soames has governed Southern Rhodesia since 12 December.
${AFGHANISTAN_1979}
${POWERS_1979}
${WORLD_1979.replace("Rhodesia's settlement was signed at Lancaster House on 21 December – a ceasefire from 28 December, elections in February under the British governor Lord Soames", "Rhodesia's settlement is all but agreed at Lancaster House – a ceasefire, then elections in February under the British governor Lord Soames, who arrived in Salisbury on 12 December")}
Real history for reference: the troops crossed on 25 December; special forces stormed the Tajbeg Palace on 27 December and killed Amin; Karmal was installed; the UN condemned the intervention in January 1980; the war lasted until February 1989. The Lancaster House Agreement was signed on 21 December and the ceasefire began on 28 December. None of this is fixed.`,
    },
  },
};

// Where the mines, wells and plantations of the resource regions the finer
// maps split lay: points (lon, lat) and the share of each resource's output
// dug, drilled or tapped around them (scripts/resources.mjs RESOURCE_POINTS,
// placed by the map build's placeMines). Each region's shares add up to one
// for every resource it has. The points are on land: an offshore field is
// placed at the coast it is worked from (Macaé for the Campos basin, Ciudad
// del Carmen for Cantarell, Sullom Voe for the North Sea's Shetland oil).
// Real deposits, rounded to a few kilometres; the first point of each list
// is the largest.

/** A mine: where, and the share of each resource's output there. */
const m = (lon, lat, shares) => ({ at: [lon, lat], ...shares });

export const MINES = {
  // --- Russia ---
  "RUS|Chechen Republic": [m(45.7, 43.3, { oil: 1 })],
  "RUS|Krasnodar Krai": [m(39.53, 44.42, { oil: 0.6 }), m(38.05, 45.25, { oil: 0.4 })],
  "RUS|Republic of Tatarstan": [m(52.3, 54.9, { oil: 0.75 }), m(50.8, 54.43, { oil: 0.25 })],
  "RUS|Bashkortostan": [m(53.7, 54.6, { oil: 0.4 }), m(54.25, 56.1, { oil: 0.35 }), m(56.05, 53.45, { oil: 0.25 })],
  "RUS|Samara": [m(51.35, 53.38, { oil: 0.5 }), m(51.17, 52.8, { oil: 0.5 })],
  "RUS|Orenburg": [m(52.25, 52.78, { oil: 1 }), m(55.6, 51.7, { gas: 1 })],
  "RUS|Volgograd": [m(44.8, 50.98, { oil: 0.5 }), m(44.3, 50.3, { oil: 0.5 })],
  "RUS|Perm Krai": [m(56.07, 56.5, { oil: 0.6 }), m(55.75, 58.08, { oil: 0.4 })],
  "RUS|Udmurt Republic": [m(53.05, 57.55, { oil: 0.6 }), m(53.8, 56.47, { oil: 0.4 })],
  "RUS|Astrakhan": [m(47.4, 46.7, { gas: 1 })],
  "RUS|Stavropol Krai": [m(41.7, 45.37, { gas: 0.7 }), m(44.75, 44.75, { gas: 0.3 })],
  // Samotlor, Surgut, the Krasnoleninsky arch and Shaim.
  "RUS|Khanty-Mansi Autonomous Okrug": [m(76.6, 61.0, { oil: 0.45, gas: 0.6 }), m(73.4, 61.25, { oil: 0.35, gas: 0.4 }), m(65.4, 62.15, { oil: 0.1 }), m(64.8, 60.13, { oil: 0.1 })],
  // Urengoy, Yamburg, Medvezhye and Bovanenkovo; the oil of Noyabrsk and Gubkinsky.
  "RUS|Yamalo-Nenets Autonomous Okrug": [m(76.65, 66.08, { gas: 0.4 }), m(75.6, 67.9, { gas: 0.25 }), m(72.5, 65.5, { gas: 0.15 }), m(68.4, 70.4, { gas: 0.2 }), m(75.45, 63.2, { oil: 0.6 }), m(76.55, 64.43, { oil: 0.4 })],
  "RUS|Tomsk": [m(77.6, 60.73, { oil: 0.6 }), m(79.6, 57.6, { oil: 0.4 })],
  // Usinsk and Ukhta's oil, Vorkuta and Inta's coal, Vuktyl's gas.
  "RUS|Komi Republic": [m(57.5, 66.0, { oil: 0.6 }), m(53.7, 63.56, { oil: 0.4 }), m(64.0, 67.5, { coal: 0.7 }), m(60.15, 66.03, { coal: 0.3 }), m(57.3, 63.85, { gas: 1 })],
  // The Kuzbass.
  "RUS|Kemerovo": [m(87.1, 53.75, { coal: 0.4 }), m(86.7, 53.9, { coal: 0.2 }), m(86.17, 54.65, { coal: 0.2 }), m(88.07, 53.69, { coal: 0.2 })],
  // The eastern Donbas: Shakhty and Gukovo.
  "RUS|Rostov": [m(40.22, 47.71, { coal: 0.6 }), m(39.95, 48.05, { coal: 0.4 })],
  "RUS|Chelyabinsk": [m(59.0, 53.4, { iron: 0.6 }), m(58.8, 54.9, { iron: 0.4 }), m(61.6, 55.1, { coal: 0.7 }), m(61.4, 54.9, { coal: 0.3 })],
  // Kachkanar and Nizhny Tagil's iron, Kirovgrad and Revda's copper, Severouralsk's bauxite.
  "RUS|Sverdlovsk": [m(59.5, 58.7, { iron: 0.5 }), m(59.95, 57.92, { iron: 0.5 }), m(60.1, 57.43, { copper: 0.6 }), m(59.92, 56.8, { copper: 0.4 }), m(60.15, 60.15, { bauxite: 1 })],
  "RUS|Kursk": [m(35.35, 52.35, { iron: 1 })],
  "RUS|Belgorod": [m(37.55, 51.28, { iron: 0.6 }), m(37.85, 51.3, { iron: 0.4 })],
  "RUS|Murmansk": [m(32.9, 67.93, { nickel: 0.5 }), m(30.8, 69.4, { nickel: 0.5 })],
  // Norilsk's nickel and copper, the Yenisei ridge's gold, Vankor's oil, the Kansk-Achinsk basin's coal.
  "RUS|Krasnoyarsk Krai": [m(88.2, 69.35, { nickel: 1, copper: 1 }), m(93.05, 60.37, { gold: 0.7 }), m(94.6, 58.18, { gold: 0.3 }), m(83.5, 67.8, { oil: 1 }), m(95.1, 55.9, { coal: 0.4 }), m(90.4, 56.0, { coal: 0.3 }), m(89.2, 55.53, { coal: 0.3 })],
  // Kolyma's gold.
  "RUS|Magadan": [m(148.15, 62.78, { gold: 0.5 }), m(149.6, 62.52, { gold: 0.3 }), m(155.8, 62.5, { gold: 0.2 })],
  "RUS|Sakha Republic": [m(125.4, 58.6, { gold: 0.6 }), m(143.2, 64.57, { gold: 0.4 }), m(124.7, 56.65, { coal: 1 }), m(111.0, 59.85, { oil: 0.6 }), m(113.0, 61.5, { oil: 0.4 })],
  "RUS|Irkutsk": [m(114.2, 57.85, { gold: 1 }), m(103.07, 53.15, { coal: 0.7 }), m(100.6, 54.56, { coal: 0.3 }), m(107.0, 60.75, { oil: 0.6 }), m(106.0, 57.9, { oil: 0.4 })],
  "RUS|Zabaykalsky Krai": [m(116.63, 51.58, { gold: 0.6 }), m(117.6, 51.2, { gold: 0.4 }), m(118.05, 50.1, { uranium: 1 })],
  "RUS|Amur": [m(127.27, 53.73, { gold: 0.4 }), m(126.4, 53.8, { gold: 0.3 }), m(132.95, 53.07, { gold: 0.3 })],
  "RUS|Tula": [m(38.13, 53.77, { coal: 0.5 }), m(38.34, 53.97, { coal: 0.5 })],
  "RUS|Khabarovsk Krai": [m(135.5, 52.4, { gold: 0.4 }), m(139.9, 53.9, { gold: 0.3 }), m(143.3, 59.37, { gold: 0.3 })],
  "RUS|Kurgan": [m(62.93, 56.26, { uranium: 1 })],
  "RUS|Republic of Buryatia": [m(114.0, 54.4, { uranium: 1 })],

  // --- Kazakhstan, Turkmenistan ---
  "KAZ|Atyrau": [m(53.4, 46.15, { oil: 0.6 }), m(53.98, 46.95, { oil: 0.25 }), m(53.33, 47.65, { oil: 0.15 })],
  "KAZ|West Kazakhstan": [m(53.0, 51.17, { gas: 1, oil: 1 })],
  "KAZ|Aktobe": [m(57.0, 48.6, { oil: 1 })],
  "KAZ|Karaganda": [m(72.8, 49.75, { coal: 1 }), m(67.7, 47.8, { copper: 0.7 }), m(74.95, 46.85, { copper: 0.3 })],
  "KAZ|Pavlodar": [m(75.32, 51.72, { coal: 1 })],
  "KAZ|East Kazakhstan": [m(83.5, 50.35, { copper: 0.5, gold: 0.4 }), m(84.27, 49.73, { copper: 0.5 }), m(81.5, 49.7, { gold: 0.6 })],
  "KAZ|Kostanay": [m(63.12, 52.97, { iron: 0.7 }), m(62.5, 52.53, { iron: 0.3 }), m(62.15, 52.3, { bauxite: 0.6 }), m(66.9, 50.25, { bauxite: 0.4 })],
  "KAZ|Kyzylorda": [m(66.75, 44.17, { uranium: 0.5 }), m(67.25, 43.9, { uranium: 0.5 }), m(65.3, 45.8, { oil: 1 })],
  "KAZ|Turkistan": [m(68.5, 44.5, { uranium: 1 })],
  "TKM|Balkan": [m(53.1, 39.4, { oil: 0.5 }), m(54.37, 39.5, { oil: 0.5, gas: 0.5 }), m(53.9, 38.05, { gas: 0.5 })],
  "TKM|Lebap": [m(63.9, 38.8, { gas: 1 })],

  // --- Ukraine, Poland, Italy ---
  "UKR|Donetsk": [m(37.9, 48.0, { coal: 0.5 }), m(38.05, 48.3, { coal: 0.2 }), m(37.18, 48.28, { coal: 0.3 })],
  "UKR|Luhansk": [m(38.8, 48.47, { coal: 0.5 }), m(39.73, 48.3, { coal: 0.5 })],
  "UKR|Dnipropetrovsk": [m(33.4, 47.9, { iron: 1 }), m(35.87, 48.53, { coal: 1 })],
  "UKR|Kharkiv": [m(36.45, 49.4, { gas: 0.7 }), m(35.45, 49.37, { gas: 0.3 })],
  // Boryslav's oil, Chervonohrad's coal, Dashava's gas.
  "UKR|Lviv": [m(23.42, 49.28, { oil: 1 }), m(24.2, 50.39, { coal: 1 }), m(23.98, 49.26, { gas: 1 })],
  "UKR|Kirovohrad": [m(31.4, 48.25, { uranium: 0.5 }), m(32.25, 48.5, { uranium: 0.5 })],
  "UKR|Poltava": [m(34.0, 50.37, { gas: 1 }), m(33.25, 50.37, { oil: 1 }), m(33.65, 49.0, { iron: 1 })],
  "UKR|Volyn": [m(24.17, 50.73, { coal: 1 })],
  "POL|Lower Silesian Voivodeship": [m(16.28, 50.77, { coal: 0.6 }), m(14.9, 50.95, { coal: 0.4 }), m(16.2, 51.4, { copper: 0.5 }), m(16.07, 51.5, { copper: 0.5 })],
  "POL|Lublin Voivodeship": [m(22.95, 51.3, { coal: 1 })],
  "POL|Łódź Voivodeship": [m(19.35, 51.3, { coal: 1 })],
  "POL|Greater Poland Voivodeship": [m(18.25, 52.2, { coal: 0.7 }), m(18.5, 52.0, { coal: 0.3 })],
  "ITA|Apulia": [m(16.08, 41.0, { bauxite: 0.6 }), m(15.75, 41.75, { bauxite: 0.4 })],

  // --- Germany ---
  // The Ruhr, the Rhineland's lignite, the Siegerland's iron.
  "DEU|North Rhine-Westphalia": [m(7.1, 51.5, { coal: 0.4 }), m(7.2, 51.47, { coal: 0.3 }), m(6.5, 50.95, { coal: 0.3 }), m(8.02, 50.87, { iron: 1 })],
  "DEU|Saxony": [m(14.25, 51.43, { coal: 0.6 }), m(12.5, 50.72, { coal: 0.4 }), m(12.67, 50.6, { uranium: 0.7 }), m(14.07, 50.92, { uranium: 0.3 })],
  "DEU|Thuringia": [m(12.18, 50.86, { uranium: 1 })],
  "DEU|Brandenburg": [m(14.0, 51.52, { coal: 0.6 }), m(14.53, 51.83, { coal: 0.4 })],
  "DEU|Saxony-Anhalt": [m(12.32, 51.62, { coal: 0.5 }), m(12.2, 51.12, { coal: 0.5 }), m(11.5, 51.55, { copper: 1 })],
  "DEU|Lower Saxony": [m(7.3, 52.7, { oil: 0.6 }), m(10.1, 52.55, { oil: 0.4 }), m(10.4, 52.15, { iron: 0.8 }), m(10.23, 52.32, { iron: 0.2 }), m(9.4, 53.1, { gas: 0.7 }), m(8.05, 52.85, { gas: 0.3 })],
  "DEU|Hesse": [m(8.5, 50.55, { iron: 1 })],

  // --- Britain ---
  "GBR|Yorkshire and the Humber": [m(-1.48, 53.55, { coal: 0.4 }), m(-1.13, 53.52, { coal: 0.3 }), m(-1.3, 53.7, { coal: 0.3 })],
  "GBR|East Midlands": [m(-1.2, 53.14, { coal: 0.6 }), m(-1.42, 53.24, { coal: 0.4 }), m(-0.69, 52.49, { iron: 0.6 }), m(-0.9, 52.77, { iron: 0.4 })],
  "GBR|North West": [m(-2.63, 53.55, { coal: 0.6 }), m(-3.55, 54.64, { coal: 0.4 }), m(-3.2, 54.15, { iron: 1 })],
  "GBR|West Midlands": [m(-2.08, 52.5, { coal: 0.5, iron: 0.6 }), m(-2.03, 52.69, { coal: 0.3 }), m(-2.18, 53.0, { coal: 0.2, iron: 0.4 })],
  // Scotland's South Western region: Lanarkshire and Ayrshire.
  "GBR|South Western": [m(-4.05, 55.77, { coal: 0.6 }), m(-4.26, 55.45, { coal: 0.4 })],
  // The North Sea's oil comes ashore at Sullom Voe and Flotta: both in the islands' part, Shetland too small for the map to hold a point.
  "GBR|Highlands and Islands": [m(-3.12, 58.83, { oil: 1 })],
  // Scotland's Eastern region: Fife and the Lothians.
  "GBR|Eastern": [m(-3.35, 56.1, { coal: 0.6 }), m(-3.07, 55.89, { coal: 0.4 })],
  // Cornwall's tin at Camborne and Redruth (St Just's Geevor, on a tip the map smooths away, with them).
  "GBR|South West": [m(-5.25, 50.22, { tin: 1 })],
  // The southern North Sea's gas comes ashore at Bacton.
  "GBR|East": [m(1.48, 52.85, { gas: 1 })],

  // --- France, Spain, Sweden ---
  "FRA|Hauts-de-France": [m(2.83, 50.43, { coal: 0.6 }), m(3.3, 50.37, { coal: 0.4 })],
  "FRA|Provence-Alpes-Côte-d'Azur": [m(6.06, 43.4, { bauxite: 1 })],
  "FRA|Nouvelle-Aquitaine": [m(-0.62, 43.42, { gas: 1 }), m(1.37, 46.1, { uranium: 1 })],
  "FRA|Guyane française": [m(-53.03, 4.82, { gold: 0.5 }), m(-53.7, 3.7, { gold: 0.5 })],
  "FRA|Auvergne-Rhône-Alpes": [m(4.39, 45.43, { coal: 0.8 }), m(2.75, 46.29, { coal: 0.2 })],
  "FRA|Occitanie": [m(4.08, 44.13, { coal: 0.5 }), m(2.16, 44.05, { coal: 0.3 }), m(2.25, 44.56, { coal: 0.2 })],
  "ESP|País Vasco": [m(-3.05, 43.32, { iron: 1 })],
  "ESP|Andalucía": [m(-6.6, 37.7, { copper: 0.7 }), m(-7.12, 37.6, { copper: 0.3 }), m(-3.1, 37.18, { iron: 1 })],
  "SWE|Västerbotten": [m(20.38, 64.87, { copper: 0.6, gold: 0.6 }), m(18.6, 65.07, { copper: 0.4 }), m(20.6, 64.9, { gold: 0.4 })],

  // --- The Middle East, North Africa ---
  "IRN|Khuzestan": [m(48.7, 31.3, { oil: 0.4, gas: 0.5 }), m(49.3, 31.95, { oil: 0.2 }), m(49.8, 30.7, { oil: 0.4, gas: 0.5 })],
  "IRN|Kermanshah": [m(45.5, 33.98, { oil: 1 })],
  "IRN|Kerman": [m(55.87, 29.95, { copper: 1 }), m(55.33, 29.1, { iron: 1 })],
  // Ghawar, Abqaiq and Ras Tanura; Ghawar's and Berri's gas.
  "SAU|Eastern": [m(49.6, 25.4, { oil: 0.6, gas: 0.7 }), m(49.68, 25.94, { oil: 0.25 }), m(50.05, 26.65, { oil: 0.15 }), m(49.6, 27.0, { gas: 0.3 })],
  "ARE|Emirate of Abu Dhabi": [m(53.0, 23.75, { oil: 0.6 }), m(52.73, 24.1, { oil: 0.4 }), m(53.75, 23.85, { gas: 1 })],
  "DZA|Ouargla": [m(6.07, 31.68, { oil: 1 })],
  "EGY|Red Sea": [m(33.1, 28.35, { oil: 0.6 }), m(33.8, 27.25, { oil: 0.4 })],
  "EGY|Matrouh": [m(27.2, 30.6, { oil: 1 })],
  "SDN|River Nile": [m(33.32, 19.53, { gold: 0.6 }), m(34.0, 18.0, { gold: 0.4 })],

  // --- Africa south of the Sahara ---
  "NGA|Rivers State": [m(7.0, 4.8, { oil: 1 }), m(7.17, 4.45, { gas: 1 })],
  "NGA|Delta State": [m(5.75, 5.52, { oil: 1, gas: 1 })],
  "NGA|Plateau State": [m(8.88, 9.92, { tin: 1 })],
  "NGA|Edo State": [m(5.62, 6.33, { rubber: 1 })],
  // The Witwatersrand: Johannesburg, the West Rand, the East Rand.
  "ZAF|Gauteng": [m(28.0, -26.2, { gold: 0.5 }), m(27.4, -26.36, { gold: 0.3 }), m(28.43, -26.25, { gold: 0.2 })],
  "ZAF|Free State": [m(26.73, -27.98, { gold: 1, uranium: 1 })],
  "ZAF|Northern Cape": [m(23.0, -27.7, { iron: 0.8 }), m(23.07, -28.33, { iron: 0.2 })],
  "ZAF|Mpumalanga": [m(29.23, -25.87, { coal: 0.7 }), m(29.17, -26.5, { coal: 0.3 })],
  "ZAF|Limpopo": [m(31.14, -23.95, { copper: 1 }), m(27.7, -23.67, { coal: 1 })],
  "ZAF|North West": [m(26.65, -26.95, { gold: 1 }), m(27.25, -25.67, { nickel: 1 })],
  "ZAF|KwaZulu-Natal": [m(30.1, -28.0, { coal: 1 })],
  // The Copperbelt's Congolese side: Kolwezi, Lubumbashi, Likasi; Shinkolobwe's uranium; Manono's tin.
  "COD|Katanga": [m(25.47, -10.72, { copper: 0.5 }), m(27.47, -11.66, { copper: 0.3 }), m(26.73, -10.98, { copper: 0.2 }), m(26.55, -11.05, { uranium: 1 }), m(27.4, -7.3, { tin: 1 })],
  "COD|North Kivu": [m(28.07, -1.42, { tin: 1 })],
  "COD|Orientale": [m(30.25, 1.56, { gold: 0.5 }), m(29.53, 3.03, { gold: 0.5 })],
  "ZMB|Copperbelt": [m(28.2, -12.8, { copper: 0.4 }), m(27.85, -12.53, { copper: 0.35 }), m(28.24, -12.55, { copper: 0.25 })],
  "ZMB|Northwestern": [m(26.4, -12.1, { copper: 0.6 }), m(25.8, -12.25, { copper: 0.4 })],
  "ZWE|Midlands": [m(29.8, -18.93, { gold: 0.6 }), m(30.0, -19.67, { gold: 0.4 })],
  "GHA|Ashanti": [m(-1.67, 6.2, { gold: 1 })],
  "MLI|Kayes": [m(-11.7, 13.9, { gold: 0.5 }), m(-11.25, 13.1, { gold: 0.5 })],
  "BFA|Sahel": [m(-0.08, 14.37, { gold: 0.6 }), m(-1.85, 14.1, { gold: 0.4 })],
  "NER|Agadez": [m(7.38, 18.74, { uranium: 1 })],
  "CIV|Lagunes": [m(-4.38, 5.32, { rubber: 0.5 }), m(-4.05, 5.5, { rubber: 0.5 })],

  // --- The United States ---
  // The Permian, East Texas, the Gulf coast and the Panhandle; Eagle Ford and the Barnett's gas; the lignite; South Texas uranium.
  "USA|Texas": [
    m(-102.3, 31.9, { oil: 0.45, gas: 0.3 }), m(-94.88, 32.38, { oil: 0.2 }), m(-94.6, 30.0, { oil: 0.2 }), m(-101.4, 35.67, { oil: 0.15, gas: 0.2 }),
    m(-98.8, 28.3, { gas: 0.3 }), m(-97.5, 32.8, { gas: 0.2 }), m(-96.2, 31.8, { coal: 1 }), m(-98.0, 28.7, { uranium: 1 }),
  ],
  "USA|Oklahoma": [m(-97.5, 35.45, { oil: 0.4 }), m(-96.0, 35.9, { oil: 0.4 }), m(-99.4, 35.4, { oil: 0.2, gas: 0.6 }), m(-101.5, 36.7, { gas: 0.4 })],
  "USA|California": [m(-119.0, 35.4, { oil: 0.6, gas: 0.4 }), m(-118.2, 33.8, { oil: 0.4 }), m(-121.0, 39.2, { gold: 0.6 }), m(-120.4, 37.95, { gold: 0.4 }), m(-121.7, 38.15, { gas: 0.6 })],
  "USA|Louisiana": [m(-92.0, 30.2, { oil: 0.4 }), m(-90.7, 29.6, { oil: 0.4, gas: 0.5 }), m(-93.75, 32.45, { oil: 0.2, gas: 0.5 })],
  "USA|Pennsylvania": [m(-80.2, 40.0, { coal: 0.6, gas: 0.4 }), m(-75.9, 41.25, { coal: 0.4 }), m(-79.7, 41.6, { oil: 0.6 }), m(-78.65, 41.95, { oil: 0.4 }), m(-76.4, 41.8, { gas: 0.6 })],
  "USA|West Virginia": [m(-82.0, 37.8, { coal: 0.5 }), m(-81.2, 37.78, { coal: 0.3 }), m(-80.15, 39.5, { coal: 0.2 }), m(-80.35, 39.28, { gas: 0.6 }), m(-81.6, 38.35, { gas: 0.4 })],
  "USA|Kentucky": [m(-83.1, 37.0, { coal: 0.7 }), m(-87.5, 37.33, { coal: 0.3 })],
  "USA|Illinois": [m(-89.0, 37.95, { coal: 0.7 }), m(-89.65, 39.8, { coal: 0.3 }), m(-88.5, 38.6, { oil: 1 })],
  "USA|Ohio": [m(-81.0, 40.05, { coal: 0.7 }), m(-82.1, 39.4, { coal: 0.3 }), m(-81.1, 40.3, { gas: 0.6 }), m(-82.6, 39.7, { gas: 0.4 })],
  "USA|Alabama": [m(-86.8, 33.5, { iron: 1 }), m(-87.25, 33.8, { coal: 1 })],
  // The Mesabi and Cuyuna ranges.
  "USA|Minnesota": [m(-92.9, 47.45, { iron: 0.85 }), m(-93.95, 46.5, { iron: 0.15 })],
  // The Marquette, Menominee and Gogebic ranges; the Keweenaw's copper.
  "USA|Michigan": [m(-87.6, 46.5, { iron: 0.6 }), m(-87.95, 45.95, { iron: 0.25 }), m(-90.17, 46.45, { iron: 0.15 }), m(-88.55, 47.2, { copper: 0.85 }), m(-89.6, 46.75, { copper: 0.15 })],
  "USA|Montana": [m(-112.53, 46.0, { copper: 1 }), m(-106.62, 45.88, { coal: 0.6 }), m(-106.88, 45.12, { coal: 0.4 })],
  "USA|Arizona": [m(-109.35, 33.05, { copper: 0.35 }), m(-110.85, 33.4, { copper: 0.2 }), m(-109.9, 31.45, { copper: 0.15 }), m(-113.2, 34.6, { copper: 0.15 }), m(-112.87, 32.37, { copper: 0.15 })],
  "USA|Utah": [m(-112.15, 40.52, { copper: 1 })],
  "USA|Nevada": [m(-116.1, 40.9, { gold: 0.7 }), m(-117.07, 38.71, { gold: 0.2 }), m(-119.65, 39.31, { gold: 0.1 }), m(-114.95, 39.25, { copper: 0.7 }), m(-119.15, 38.98, { copper: 0.3 })],
  "USA|Wyoming": [m(-106.25, 43.35, { oil: 0.7 }), m(-108.9, 44.4, { oil: 0.3 }), m(-107.6, 42.5, { uranium: 0.6 }), m(-105.8, 43.7, { uranium: 0.4 }), m(-105.5, 44.3, { coal: 1 }), m(-109.9, 42.6, { gas: 0.7 }), m(-109.2, 41.6, { gas: 0.3 })],
  "USA|Colorado": [m(-105.18, 38.75, { gold: 0.6 }), m(-106.3, 39.25, { gold: 0.4 }), m(-108.75, 38.35, { uranium: 1 }), m(-108.8, 40.1, { oil: 0.5 }), m(-104.7, 40.3, { oil: 0.5 }), m(-108.0, 39.5, { gas: 0.5 }), m(-107.9, 37.2, { gas: 0.5 }), m(-107.4, 40.5, { coal: 0.6 }), m(-104.5, 37.17, { coal: 0.4 })],
  "USA|New Mexico": [m(-103.2, 32.7, { oil: 0.7, gas: 0.3 }), m(-104.4, 32.85, { oil: 0.3 }), m(-107.85, 35.15, { uranium: 1 }), m(-108.2, 36.73, { gas: 0.7 }), m(-108.07, 32.8, { copper: 1 })],
  "USA|Alaska": [m(-148.35, 70.25, { oil: 0.9 }), m(-151.25, 60.55, { oil: 0.1 }), m(-147.7, 64.84, { gold: 0.4 }), m(-165.4, 64.5, { gold: 0.3 }), m(-134.4, 58.3, { gold: 0.3 })],
  "USA|Arkansas": [m(-92.5, 34.55, { bauxite: 1 })],
  "USA|North Dakota": [m(-103.6, 48.15, { oil: 1 }), m(-101.8, 47.26, { coal: 1 })],
  "USA|Indiana": [m(-87.3, 38.5, { coal: 1 })],
  "USA|Virginia": [m(-82.4, 37.1, { coal: 1 })],
  "USA|South Dakota": [m(-103.77, 44.35, { gold: 1 })],
  "USA|Kansas": [m(-98.85, 38.9, { oil: 0.6 }), m(-96.85, 37.82, { oil: 0.4 }), m(-100.9, 37.05, { gas: 1 })],

  // --- Canada ---
  // The deep basin, Medicine Hat and Edson's gas; the oil sands, Leduc and Swan Hills; the mountain and plains coal.
  "CAN|Alberta": [
    m(-118.8, 55.17, { gas: 0.5 }), m(-110.7, 50.04, { gas: 0.2 }), m(-116.4, 53.58, { gas: 0.3 }),
    m(-111.4, 56.73, { oil: 0.5 }), m(-113.55, 53.27, { oil: 0.3 }), m(-115.4, 54.7, { oil: 0.2 }),
    m(-117.57, 53.4, { coal: 0.5 }), m(-114.5, 49.63, { coal: 0.2 }), m(-112.3, 51.5, { coal: 0.3 }),
  ],
  "CAN|Ontario": [m(-81.0, 46.5, { nickel: 1, copper: 0.7 }), m(-81.33, 48.48, { gold: 0.5 }), m(-80.03, 48.15, { gold: 0.25 }), m(-93.83, 51.02, { gold: 0.25 }), m(-82.65, 46.38, { uranium: 0.85 }), m(-77.85, 45.05, { uranium: 0.15 }), m(-81.37, 48.68, { copper: 0.3 }), m(-82.2, 42.8, { gas: 1 })],
  "CAN|Quebec": [m(-77.78, 48.1, { gold: 0.6 }), m(-79.02, 48.24, { gold: 0.4, copper: 0.6 }), m(-74.37, 49.92, { copper: 0.4 }), m(-67.35, 52.75, { iron: 0.6 }), m(-66.82, 54.8, { iron: 0.4 }), m(-73.6, 61.6, { nickel: 1 })],
  "CAN|Yukon": [m(-139.43, 64.06, { gold: 1 })],
  "CAN|Saskatchewan": [m(-103.0, 49.4, { oil: 0.6 }), m(-110.0, 53.3, { oil: 0.4 }), m(-105.6, 57.5, { uranium: 0.8 }), m(-108.6, 59.57, { uranium: 0.2 })],
  "CAN|British Columbia": [m(-114.88, 49.73, { coal: 0.8 }), m(-121.0, 55.13, { coal: 0.2 }), m(-120.8, 50.47, { copper: 0.6 }), m(-120.5, 49.45, { copper: 0.2 }), m(-123.2, 49.62, { copper: 0.2 }), m(-120.85, 56.25, { gas: 0.7 }), m(-122.7, 58.8, { gas: 0.3 }), m(-121.55, 53.07, { gold: 0.4 }), m(-130.0, 56.1, { gold: 0.3 }), m(-122.82, 50.78, { gold: 0.3 })],
  "CAN|Nova Scotia": [m(-59.95, 46.2, { coal: 0.7 }), m(-62.65, 45.56, { coal: 0.3 })],
  "CAN|Northwest Territories": [m(-126.84, 65.28, { oil: 1 }), m(-118.0, 66.08, { uranium: 1 }), m(-114.37, 62.45, { gold: 1 })],
  // Labrador's iron and Voisey's Bay's nickel; the Grand Banks' oil comes ashore at Come By Chance.
  "CAN|Newfoundland and Labrador": [m(-66.9, 52.95, { iron: 1 }), m(-53.98, 47.82, { oil: 1 }), m(-62.1, 56.33, { nickel: 1 })],
  "CAN|Manitoba": [m(-97.85, 55.75, { nickel: 1 }), m(-101.88, 54.77, { copper: 0.7 }), m(-100.03, 54.88, { copper: 0.3 })],

  // --- Mexico ---
  "MEX|Veracruz": [m(-97.45, 20.53, { oil: 0.6 }), m(-94.55, 18.0, { oil: 0.25 }), m(-97.73, 21.2, { oil: 0.15 })],
  "MEX|Tamaulipas": [m(-97.86, 22.25, { oil: 0.6 }), m(-98.3, 26.08, { oil: 0.4 })],
  "MEX|Tabasco": [m(-93.0, 18.0, { oil: 0.7, gas: 1 }), m(-93.2, 18.27, { oil: 0.3 })],
  // Cantarell is worked from Ciudad del Carmen.
  "MEX|Campeche": [m(-91.83, 18.65, { oil: 1, gas: 1 })],
  "MEX|Sonora": [m(-110.3, 30.98, { copper: 0.5 }), m(-109.68, 30.37, { copper: 0.5 }), m(-112.15, 30.7, { gold: 0.6 }), m(-108.93, 27.02, { gold: 0.4 })],
  "MEX|Coahuila": [m(-101.2, 27.9, { coal: 1 })],
  "MEX|Zacatecas": [m(-102.87, 23.17, { gold: 0.6 }), m(-101.55, 24.65, { gold: 0.4 })],
  "MEX|Baja California Sur": [m(-112.27, 27.34, { copper: 1 })],
  "MEX|Chihuahua": [m(-108.4, 28.2, { gold: 0.6 }), m(-105.67, 26.93, { gold: 0.4 })],
  "MEX|Durango": [m(-105.93, 24.1, { gold: 0.6 }), m(-105.97, 25.93, { gold: 0.4 })],
  "MEX|Guerrero": [m(-99.6, 17.93, { gold: 0.6 }), m(-99.6, 18.55, { gold: 0.4 })],

  // --- South America ---
  "VEN|Zulia": [m(-71.45, 10.4, { oil: 0.7, gas: 1 }), m(-71.13, 9.95, { oil: 0.3 })],
  "VEN|Anzoátegui": [m(-64.25, 8.9, { oil: 0.7 }), m(-64.47, 9.43, { oil: 0.3, gas: 1 })],
  "VEN|Bolívar": [m(-61.82, 7.35, { gold: 1 }), m(-63.3, 7.45, { iron: 0.7 }), m(-62.67, 8.02, { iron: 0.3 }), m(-66.75, 6.58, { bauxite: 1 })],
  "COL|Santander": [m(-73.85, 7.07, { oil: 1 })],
  "COL|Antioquia": [m(-74.7, 7.08, { gold: 0.6 }), m(-74.8, 7.6, { gold: 0.4 })],
  "COL|Casanare": [m(-72.65, 5.05, { oil: 1 })],
  "COL|Meta": [m(-71.4, 3.85, { oil: 0.6 }), m(-73.75, 3.95, { oil: 0.4 })],
  "PER|Arequipa": [m(-71.6, -16.53, { copper: 1 }), m(-72.35, -15.3, { gold: 0.5 }), m(-74.25, -15.85, { gold: 0.5 })],
  "PER|Cusco Departament": [m(-71.35, -14.9, { copper: 1 })],
  "PER|Junín": [m(-76.13, -11.6, { copper: 0.6 }), m(-75.9, -11.52, { copper: 0.4 })],
  "PER|Puno": [m(-70.32, -14.23, { tin: 1 })],
  "PER|Madre de Dios": [m(-70.53, -12.98, { gold: 0.6 }), m(-69.6, -12.7, { gold: 0.4 })],
  "BOL|Potosí": [m(-66.58, -18.42, { tin: 0.6 }), m(-65.75, -19.6, { tin: 0.4 })],
  "BOL|Santa Cruz": [m(-63.0, -18.2, { gas: 0.5 }), m(-63.5, -20.05, { gas: 0.5 })],
  "CHL|Antofagasta": [m(-68.9, -22.3, { copper: 0.6 }), m(-69.07, -24.27, { copper: 0.4 })],
  "CHL|Atacama": [m(-69.62, -26.25, { copper: 0.6 }), m(-70.27, -27.48, { copper: 0.4 }), m(-69.3, -26.85, { gold: 1 }), m(-70.75, -28.6, { iron: 1 })],
  "CHL|Magellan and the Chilean Antarctic": [m(-69.25, -52.77, { oil: 1 })],
  "CHL|Coquimbo": [m(-71.08, -30.23, { copper: 0.5 }), m(-70.5, -31.8, { copper: 0.5 }), m(-71.15, -29.75, { iron: 1 })],
  "ARG|Chubut": [m(-67.5, -45.87, { oil: 1 })],
  "ARG|Mendoza": [m(-68.9, -33.05, { oil: 0.6 }), m(-69.58, -35.47, { oil: 0.4 })],
  "ARG|Santa Cruz": [m(-69.25, -48.4, { gold: 0.6 }), m(-70.9, -46.6, { gold: 0.4 })],
  "ARG|San Juan": [m(-69.95, -29.35, { gold: 0.7 }), m(-68.65, -29.75, { gold: 0.3 })],
  // The Iron Quadrangle and Itabira; Paracatu's gold; Poços de Caldas and Cataguases' bauxite.
  "BRA|Minas Gerais": [m(-43.85, -20.0, { gold: 0.7 }), m(-46.87, -17.22, { gold: 0.3 }), m(-43.23, -19.62, { iron: 0.5 }), m(-43.45, -20.3, { iron: 0.5 }), m(-46.56, -21.79, { bauxite: 0.5 }), m(-42.6, -21.2, { bauxite: 0.5 })],
  // The Tapajós and Marajó's rubber, Trombetas and Paragominas' bauxite, Carajás' iron and copper, the Tapajós and Serra Pelada's gold.
  "BRA|Pará": [m(-54.7, -2.43, { rubber: 0.5 }), m(-50.48, -1.68, { rubber: 0.5 }), m(-56.4, -1.5, { bauxite: 0.6 }), m(-47.35, -3.0, { bauxite: 0.4 }), m(-50.1, -6.07, { iron: 1 }), m(-56.0, -4.3, { gold: 0.6 }), m(-49.65, -5.95, { gold: 0.4 }), m(-49.88, -6.5, { copper: 1 })],
  "BRA|Amazonas": [m(-60.0, -3.1, { rubber: 0.4 }), m(-64.8, -7.25, { rubber: 0.3 }), m(-64.7, -3.35, { rubber: 0.3 }), m(-60.1, -0.8, { tin: 1 })],
  "BRA|Acre": [m(-68.5, -10.65, { rubber: 0.5 }), m(-67.8, -9.97, { rubber: 0.3 }), m(-72.67, -7.63, { rubber: 0.2 })],
  "BRA|Bahia": [m(-38.4, -12.6, { oil: 1 })],
  // The Campos basin is worked from Macaé.
  "BRA|Rio de Janeiro": [m(-41.78, -22.37, { oil: 1 })],
  "BRA|Rondônia": [m(-63.0, -9.9, { tin: 1 })],
  "BRA|Espírito Santo": [m(-39.85, -18.72, { oil: 1 })],
  "BRA|Mato Grosso": [m(-54.98, -10.22, { gold: 0.6 }), m(-56.63, -16.25, { gold: 0.4 })],
  "BRA|Goiás": [m(-48.47, -14.47, { nickel: 0.6 }), m(-48.9, -15.05, { nickel: 0.4 })],
  "BRA|São Paulo": [m(-49.38, -20.8, { rubber: 1 })],
  "JAM|Jamaica": [m(-77.5, 18.05, { bauxite: 0.5 }), m(-77.4, 18.4, { bauxite: 0.5 })],
  "DOM|Dominican Republic": [m(-70.15, 19.05, { gold: 1 })],

  // --- Southeast Asia ---
  "IDN|North Sumatra": [m(98.3, 4.03, { oil: 1 }), m(99.6, 2.98, { rubber: 0.6 }), m(99.15, 3.33, { rubber: 0.4 }), m(99.05, 1.52, { gold: 1 })],
  "IDN|South Sumatra": [m(104.25, -3.43, { oil: 1, rubber: 0.5 }), m(103.8, -3.75, { coal: 1 }), m(103.85, -2.88, { rubber: 0.5 }), m(103.6, -2.4, { gas: 1 })],
  "IDN|Riau": [m(101.45, 1.25, { oil: 1 }), m(101.15, 0.35, { rubber: 1 })],
  "IDN|East Kalimantan": [m(116.85, -1.25, { oil: 0.6 }), m(117.3, -0.5, { oil: 0.4 }), m(117.55, 0.5, { coal: 0.5 }), m(117.5, 2.15, { coal: 0.25 }), m(117.15, -0.5, { coal: 0.25 }), m(117.47, 0.13, { gas: 1 })],
  "IDN|West Java": [m(106.9, -6.9, { rubber: 0.5 }), m(107.45, -6.55, { rubber: 0.5 })],
  "IDN|Aceh": [m(97.1, 5.18, { gas: 1 })],
  "IDN|Papua": [m(137.1, -4.05, { copper: 1, gold: 1 })],
  "IDN|Jambi": [m(102.1, -1.5, { rubber: 1 })],
  "IDN|West Kalimantan": [m(110.6, 0.12, { rubber: 0.6 }), m(111.5, 0.07, { rubber: 0.4 }), m(110.1, -0.03, { bauxite: 0.6 }), m(110.0, -1.85, { bauxite: 0.4 })],
  "IDN|South Kalimantan": [m(116.0, -3.4, { coal: 0.5 }), m(115.4, -2.1, { coal: 0.5 })],
  "IDN|East Java": [m(111.85, -7.2, { oil: 1 })],
  "IDN|West Papua": [m(133.15, -2.3, { gas: 1 })],
  "IDN|West Nusa Tenggara": [m(116.87, -8.97, { copper: 1 })],
  "IDN|Southeast Sulawesi": [m(121.6, -4.15, { nickel: 1 })],
  "IDN|Central Sulawesi": [m(122.2, -2.85, { nickel: 1 })],
  "IDN|South Sulawesi": [m(121.35, -2.53, { nickel: 1 })],
  "IDN|North Maluku": [m(127.87, 0.35, { nickel: 0.6 }), m(128.27, 0.88, { nickel: 0.4 }), m(127.85, 1.1, { gold: 1 })],
  "PHL|MIMAROPA (Region IV-B)": [m(117.38, 8.53, { nickel: 1 })],
  "PHL|Cordillera Administrative Region (CAR)": [m(120.67, 16.37, { gold: 1 })],
  "PHL|SOCCSKSARGEN (Region XII)": [m(125.1, 7.0, { rubber: 1 })],
  "MYS|Perak": [m(101.1, 4.6, { tin: 1 }), m(100.9, 4.85, { rubber: 0.5 }), m(101.0, 4.03, { rubber: 0.5 })],
  "MYS|Johor": [m(103.3, 2.0, { rubber: 0.6 }), m(102.8, 2.5, { rubber: 0.4 })],
  "MYS|Sarawak": [m(114.0, 4.4, { oil: 1 }), m(113.03, 3.17, { gas: 1 })],
  "MYS|Pahang": [m(102.4, 3.45, { rubber: 1 })],
  "THA|Southern": [m(98.38, 7.9, { tin: 0.5 }), m(98.5, 8.45, { tin: 0.3 }), m(98.63, 9.97, { tin: 0.2 }), m(100.47, 7.0, { rubber: 0.4 }), m(99.33, 9.13, { rubber: 0.3 }), m(99.6, 7.55, { rubber: 0.3 })],
  "THA|Northeastern": [m(102.8, 17.4, { rubber: 0.5 }), m(103.1, 14.99, { rubber: 0.5 })],
  "THA|Eastern": [m(101.15, 12.68, { gas: 1 })],
  "MMR|Magway": [m(94.87, 20.47, { oil: 0.6 }), m(94.82, 20.9, { oil: 0.4 })],
  "MMR|Tanintharyi": [m(98.3, 14.1, { tin: 0.6 }), m(98.6, 12.43, { tin: 0.4 }), m(98.17, 14.6, { gas: 1 })],
  // Man Maw in the Wa hills.
  "MMR|Shan State": [m(99.1, 22.4, { tin: 1 })],
  "VNM|Đông Nam Bộ": [m(106.6, 11.85, { rubber: 0.6 }), m(106.1, 11.3, { rubber: 0.4 }), m(107.08, 10.35, { oil: 1 })],
  "VNM|Đông Bắc": [m(107.3, 21.0, { coal: 1 })],

  // --- China ---
  "CHN|Shanxi": [m(113.3, 40.08, { coal: 0.35 }), m(112.4, 37.85, { coal: 0.2 }), m(113.58, 37.86, { coal: 0.15 }), m(112.85, 35.6, { coal: 0.15 }), m(112.43, 39.33, { coal: 0.15 }), m(111.78, 37.15, { bauxite: 0.6 }), m(110.7, 35.6, { bauxite: 0.4 })],
  "CHN|Liaoning": [m(123.95, 41.88, { coal: 0.5 }), m(121.65, 42.0, { coal: 0.3 }), m(123.77, 41.3, { coal: 0.2, iron: 0.3 }), m(122.99, 41.12, { iron: 0.7 }), m(122.05, 41.12, { oil: 1 })],
  "CHN|Hebei": [m(118.2, 39.65, { coal: 0.6 }), m(114.2, 36.42, { coal: 0.4 }), m(118.7, 40.0, { iron: 0.6 }), m(114.2, 36.7, { iron: 0.4 })],
  "CHN|Heilongjiang": [m(125.1, 46.6, { oil: 1 }), m(130.3, 47.35, { coal: 0.35 }), m(130.97, 45.3, { coal: 0.35 }), m(131.15, 46.65, { coal: 0.15 }), m(130.95, 45.8, { coal: 0.15 }), m(125.8, 50.25, { copper: 1 })],
  "CHN|Gansu": [m(97.05, 40.27, { oil: 0.5 }), m(107.65, 36.0, { oil: 0.5 }), m(102.18, 38.5, { nickel: 1, copper: 0.4 }), m(104.17, 36.55, { copper: 0.6 }), m(105.0, 33.4, { gold: 0.6 }), m(102.9, 35.0, { gold: 0.4 })],
  "CHN|Xinjiang": [m(84.9, 45.6, { oil: 0.5 }), m(84.2, 41.6, { oil: 0.5 }), m(83.0, 41.7, { gas: 0.8 }), m(89.2, 42.95, { gas: 0.2 }), m(89.0, 44.8, { coal: 0.5 }), m(93.5, 42.8, { coal: 0.3 }), m(81.3, 43.95, { coal: 0.2 }), m(86.3, 47.6, { copper: 0.5 }), m(92.5, 42.2, { copper: 0.5 }), m(86.4, 48.05, { gold: 0.5 }), m(83.6, 45.9, { gold: 0.5 })],
  "CHN|Shandong": [m(118.5, 37.45, { oil: 1 }), m(116.85, 35.55, { coal: 0.6 }), m(117.55, 34.85, { coal: 0.2 }), m(117.75, 35.9, { coal: 0.2 }), m(120.4, 37.35, { gold: 0.6 }), m(119.95, 37.18, { gold: 0.4 })],
  // Ordos, Xilinhot, Hulunbuir and Wuhai's coal; Bayan Obo's iron; Huogeqi's copper; Chifeng's gold and tin.
  "CHN|Inner Mongolia": [m(110.0, 39.6, { coal: 0.5 }), m(116.1, 43.95, { coal: 0.2 }), m(119.75, 49.15, { coal: 0.2 }), m(106.8, 39.65, { coal: 0.1 }), m(109.95, 41.78, { iron: 1 }), m(106.9, 41.3, { copper: 0.6 }), m(117.3, 49.4, { copper: 0.4 }), m(118.9, 42.27, { gold: 0.6 }), m(110.0, 40.75, { gold: 0.4 }), m(117.6, 43.6, { tin: 1 })],
  "CHN|Yunnan": [m(103.15, 23.36, { tin: 1 }), m(103.18, 26.08, { copper: 0.6 }), m(102.15, 24.67, { copper: 0.4 }), m(101.0, 23.5, { gold: 0.5 }), m(100.2, 26.0, { gold: 0.5 }), m(100.8, 22.0, { rubber: 1 })],
  "CHN|Hubei": [m(114.95, 30.1, { iron: 0.7 }), m(114.88, 30.4, { iron: 0.3 })],
  "CHN|Sichuan": [m(105.0, 29.2, { gas: 0.5 }), m(107.5, 31.2, { gas: 0.5 }), m(101.7, 26.58, { iron: 1, coal: 0.3 }), m(104.6, 28.2, { coal: 0.4 }), m(106.77, 30.38, { coal: 0.3 })],
  "CHN|Jiangxi": [m(117.6, 28.95, { copper: 0.8, gold: 0.6 }), m(117.2, 28.3, { copper: 0.2 }), m(115.67, 29.67, { gold: 0.4 })],
  "CHN|Shaanxi": [m(110.5, 38.85, { coal: 0.7 }), m(109.1, 35.1, { coal: 0.3 }), m(110.0, 36.6, { oil: 0.6 }), m(107.6, 37.6, { oil: 0.4 }), m(108.8, 37.6, { gas: 0.7 }), m(109.5, 38.0, { gas: 0.3 })],
  "CHN|Henan": [m(113.3, 33.75, { coal: 0.4 }), m(113.25, 35.2, { coal: 0.2 }), m(114.3, 35.75, { coal: 0.2 }), m(116.45, 33.93, { coal: 0.2 }), m(110.9, 34.5, { gold: 0.7 }), m(111.6, 34.4, { gold: 0.3 }), m(113.0, 34.75, { bauxite: 0.5 }), m(111.75, 34.77, { bauxite: 0.5 })],
  "CHN|Guizhou": [m(104.85, 26.6, { coal: 0.6 }), m(105.75, 26.65, { coal: 0.4 }), m(106.47, 26.55, { bauxite: 0.6 }), m(107.9, 28.5, { bauxite: 0.4 })],
  "CHN|Guangxi": [m(107.6, 23.33, { bauxite: 0.7 }), m(106.42, 23.13, { bauxite: 0.3 }), m(107.55, 24.98, { tin: 0.7 }), m(111.55, 24.4, { tin: 0.3 })],
  "CHN|Anhui": [m(117.0, 32.6, { coal: 0.5 }), m(116.8, 33.95, { coal: 0.5 }), m(117.8, 30.93, { copper: 1 })],
  "CHN|Tianjin": [m(117.45, 38.85, { oil: 1 })],
  "CHN|Guangdong": [m(114.5, 22.75, { oil: 0.6 }), m(110.9, 21.7, { oil: 0.4 })],
  "CHN|Tibet": [m(97.75, 31.4, { copper: 0.5 }), m(91.6, 29.65, { copper: 0.5 })],
  "CHN|Hainan": [m(109.6, 19.4, { rubber: 1 })],
  "CHN|Hunan": [m(110.4, 28.45, { gold: 0.6 }), m(113.6, 28.7, { gold: 0.4 }), m(113.0, 25.75, { tin: 1 })],
  "CHN|Fujian": [m(116.4, 25.18, { gold: 1 })],
  "PRK|South Pyongan": [m(125.9, 39.6, { coal: 0.5 }), m(126.0, 39.4, { coal: 0.5 })],

  // --- Japan ---
  "JPN|Kyushu": [m(130.68, 33.65, { coal: 0.5 }), m(130.45, 33.03, { coal: 0.5 }), m(130.67, 32.03, { gold: 1 })],
  "JPN|Hokkaido": [m(141.97, 43.05, { coal: 0.7 }), m(144.38, 42.98, { coal: 0.3 })],
  "JPN|Kanto": [m(139.45, 36.63, { copper: 1 })],
  "JPN|Shikoku": [m(133.3, 33.92, { copper: 1 })],
  "JPN|Tohoku": [m(140.75, 40.33, { copper: 0.6 }), m(140.55, 40.3, { copper: 0.4 })],

  // --- South Asia ---
  "IND|Jharkhand": [m(86.4, 23.75, { coal: 0.5 }), m(85.8, 23.65, { coal: 0.3 }), m(87.2, 24.8, { coal: 0.2 }), m(85.47, 22.15, { iron: 1 }), m(86.45, 22.5, { copper: 1 }), m(86.35, 22.65, { uranium: 1 }), m(84.68, 23.43, { bauxite: 1 })],
  "IND|West Bengal": [m(87.0, 23.65, { coal: 1 })],
  "IND|Odisha": [m(85.4, 22.1, { iron: 1 }), m(85.23, 20.95, { coal: 0.6 }), m(83.85, 21.85, { coal: 0.4 }), m(82.9, 18.75, { bauxite: 0.7 }), m(83.4, 19.2, { bauxite: 0.3 })],
  "IND|Assam": [m(95.7, 27.3, { coal: 1 }), m(95.3, 27.37, { oil: 0.6 }), m(95.62, 27.4, { oil: 0.4 })],
  "IND|Chhattisgarh": [m(81.25, 18.63, { iron: 0.7 }), m(81.08, 20.58, { iron: 0.3 }), m(82.7, 22.35, { coal: 0.6 }), m(83.4, 21.9, { coal: 0.4 })],
  "IND|Gujarat": [m(73.0, 21.6, { oil: 0.6 }), m(72.4, 23.6, { oil: 0.4 }), m(68.8, 23.5, { bauxite: 0.7 }), m(69.4, 22.0, { bauxite: 0.3 })],
  // Bombay High comes ashore at Uran.
  "IND|Maharashtra": [m(72.95, 18.88, { oil: 1 }), m(79.3, 19.95, { coal: 0.5 }), m(79.2, 21.1, { coal: 0.3 }), m(78.95, 20.05, { coal: 0.2 })],
  "IND|Karnataka": [m(78.27, 12.95, { gold: 0.6 }), m(76.65, 16.2, { gold: 0.4 }), m(76.55, 15.1, { iron: 1 })],
  "IND|Kerala": [m(76.52, 9.6, { rubber: 0.6 }), m(76.78, 9.27, { rubber: 0.4 })],
  "IND|Madhya Pradesh": [m(82.6, 24.2, { coal: 0.6 }), m(81.4, 23.3, { coal: 0.4 })],
  "IND|Telangana": [m(80.63, 17.55, { coal: 0.6 }), m(79.5, 18.8, { coal: 0.4 })],
  "IND|Rajasthan": [m(71.3, 25.7, { oil: 1 })],
  "IND|Andhra Pradesh": [m(82.0, 16.8, { gas: 1 })],
  "PAK|Sindh": [m(69.7, 28.05, { gas: 0.6 }), m(68.85, 24.65, { gas: 0.4 })],
  "BGD|Sylhet": [m(91.9, 24.95, { gas: 0.6 }), m(91.65, 24.65, { gas: 0.4 })],

  // --- Australia ---
  "AUS|New South Wales": [m(151.0, -32.4, { coal: 0.6 }), m(150.85, -34.4, { coal: 0.25 }), m(151.75, -32.9, { coal: 0.15 }), m(145.83, -31.5, { copper: 0.6 }), m(149.0, -33.45, { copper: 0.4, gold: 0.5 }), m(149.4, -33.4, { gold: 0.3 }), m(148.0, -32.9, { gold: 0.2 }), m(151.2, -29.95, { tin: 0.6 }), m(146.9, -34.35, { tin: 0.4 })],
  "AUS|Queensland": [m(139.5, -20.73, { copper: 0.8 }), m(150.38, -23.65, { copper: 0.2, gold: 0.3 }), m(141.87, -12.65, { bauxite: 1 }), m(148.05, -22.0, { coal: 0.6 }), m(148.88, -23.58, { coal: 0.25 }), m(152.75, -27.6, { coal: 0.15 }), m(146.27, -20.07, { gold: 0.5 }), m(152.67, -26.19, { gold: 0.2 }), m(149.0, -26.6, { gas: 1 }), m(145.38, -17.38, { tin: 1 })],
  // Kalgoorlie's gold, the Darling Range's bauxite, the Pilbara's iron, Kambalda's nickel; the North West Shelf comes ashore at Karratha.
  "AUS|Western Australia": [
    m(121.47, -30.75, { gold: 0.7 }), m(116.47, -32.8, { gold: 0.15 }), m(122.22, -21.7, { gold: 0.15 }),
    m(116.1, -32.6, { bauxite: 1 }), m(119.73, -23.36, { iron: 0.5 }), m(117.8, -22.7, { iron: 0.5 }),
    m(121.67, -31.2, { nickel: 0.6 }), m(120.7, -27.6, { nickel: 0.4 }), m(116.95, -28.75, { copper: 0.5 }), m(121.6, -21.7, { copper: 0.5 }),
    m(116.85, -20.73, { oil: 1, gas: 1 }),
  ],
  "AUS|Northern Territory": [m(132.9, -12.68, { uranium: 1 }), m(136.78, -12.18, { bauxite: 1 }), m(130.87, -12.5, { gas: 0.7 }), m(131.6, -24.0, { gas: 0.3 })],
  "AUS|South Australia": [m(136.88, -30.45, { copper: 0.7, uranium: 0.8 }), m(137.6, -34.07, { copper: 0.3 }), m(139.6, -30.2, { uranium: 0.2 }), m(137.1, -32.75, { iron: 1 })],
  "AUS|Victoria": [m(143.85, -37.56, { gold: 0.5 }), m(144.28, -36.76, { gold: 0.5 }), m(146.4, -38.23, { coal: 1 }), m(147.1, -38.2, { oil: 1, gas: 1 })],
};

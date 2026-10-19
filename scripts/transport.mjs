// When railways came. Natural Earth draws today's network without dates; a
// line inside one of these boxes is shown from the box's year on (the latest
// year wins where boxes overlap), a line in no box is treated as older than
// 1914. Each box is drawn around a line or a region built after one of the
// start dates — rough, but it keeps the BAM out of 1939 and Tibet's railway
// out of 1991, which is what a player would notice.

/** [west, south, east, north, first year, what] */
export const RAIL_SINCE = [
  // Russia and the Soviet Union
  [31.5, 61.5, 41, 69.6, 1916, "Murmansk Railway"],
  [47, 61.3, 66, 68.5, 1941, "Pechora Railway (Kotlas–Vorkuta)"],
  [64, 66.5, 72, 71.6, 1955, "Salekhard and Yamal"],
  [64, 57.3, 80, 67.5, 1975, "Tyumen–Surgut–Novy Urengoy"],
  [84, 52.5, 88.5, 55.5, 1916, "Kuznetsk Basin lines"],
  [88, 51.5, 98, 55.3, 1959, "Abakan lines"],
  [86, 69, 89, 70, 1937, "Norilsk–Dudinka"],
  [99.5, 55.4, 104.5, 58.4, 1951, "Taishet–Bratsk–Ust-Kut"],
  [118.5, 50, 134.5, 54.5, 1916, "Amur Railway"],
  [104.5, 55, 122, 58.5, 1984, "Baikal–Amur Mainline, west"],
  [122, 54.6, 136, 58, 1984, "Baikal–Amur Mainline, centre"],
  [129, 51, 137.5, 54.6, 1984, "Baikal–Amur Mainline, east"],
  [124, 57.5, 131, 63, 2004, "Amur–Yakutsk Mainline"],
  [136.5, 48.5, 141.5, 51.5, 1945, "Komsomolsk–Sovetskaya Gavan"],
  [69.5, 42, 87, 54, 1931, "Turksib and the Kazakh lines"],
  [49.5, 41, 56.5, 50.5, 1936, "Western Kazakhstan"],
  [50, 41, 59, 46, 1964, "Mangyshlak and Beyneu"],
  [58, 39.8, 63, 43.5, 1955, "Chardzhou–Kungrad"],
  [67.5, 37, 70, 39, 1929, "Dushanbe line"],
  [38.9, 43, 41.3, 44.2, 1929, "Tuapse–Adler"],
  [39.9, 42.7, 41.3, 43.5, 1942, "Adler–Sukhumi"],

  // China and Mongolia
  [73, 36.5, 96, 49.5, 1962, "Xinjiang"],
  [93, 36.5, 104, 42.5, 1958, "Gansu corridor"],
  [100.5, 35.5, 103.5, 37.2, 1959, "Lanzhou–Xining"],
  [94, 35.8, 101.8, 37.5, 1984, "Xining–Golmud"],
  [89, 27, 96.5, 36, 2006, "Golmud–Lhasa"],
  [86, 28.5, 91, 30.2, 2014, "Lhasa–Shigatse"],
  [104, 33, 110, 36.5, 1934, "Longhai line to Xi'an"],
  [103.5, 34, 107, 36.5, 1952, "Baoji–Lanzhou"],
  [97, 25.2, 110.5, 33, 1952, "Sichuan and Guizhou"],
  [97, 21, 102.5, 25.2, 1970, "Western Yunnan"],
  [104, 21.5, 110.5, 25.2, 1951, "Guangxi"],
  [110.5, 23.6, 118, 30.3, 1936, "Canton–Hankou and Zhejiang–Jiangxi"],
  [115.5, 23.5, 120.5, 28.5, 1957, "Fujian"],
  [87, 41.5, 116.5, 50.3, 1949, "Trans-Mongolian"],

  // Middle East
  [38, 16, 56, 29.5, 1951, "Saudi Arabia"],
  [38, 29.5, 44, 32, 2011, "Saudi north–south line"],
  [48.2, 25, 63.5, 39.3, 1938, "Trans-Iranian Railway"],
  [54, 25, 63.5, 37.5, 1957, "Eastern Iran"],
  [44, 35, 48.2, 39.3, 1916, "Tabriz–Julfa"],
  [35.5, 37.5, 42.5, 41.6, 1930, "Eastern Anatolia"],
  [41.5, 33.6, 44.2, 37.2, 1940, "Baghdad–Mosul"],
  [32.3, 29.5, 34.5, 31.3, 1916, "Sinai"],
  [66, 36, 70, 37.2, 2011, "Hairatan"],

  // Africa
  [13.3, -13.5, 22.5, -10.5, 1929, "Benguela Railway"],
  [29.5, -11.5, 39, -7.2, 1975, "TAZARA"],
  [29, -13.6, 31.5, -10, 1975, "TAZARA, Zambia"],
  [-15.5, 13.2, -11.5, 15, 1923, "Dakar–Niger"],
  [9.3, -2.2, 13.8, 0.6, 1986, "Trans-Gabon"],
  [11.8, -4.9, 15.3, -3.8, 1934, "Congo–Ocean"],
  [6.8, 4.5, 9.5, 9, 1916, "Eastern Nigeria"],
  [9.5, 9.5, 13.5, 12, 1964, "Maiduguri line"],
  [38.5, 8.8, 43.2, 11.7, 1917, "Djibouti–Addis Ababa"],
  [24, 7, 31.5, 12.5, 1959, "Darfur and Bahr el Ghazal"],
  [-17.2, 19.5, -12, 23, 1963, "Mauritania iron line"],
  [29.5, -1, 34.6, 3.5, 1931, "Uganda"],
  [-10, 29, -1.5, 35.9, 1923, "Morocco"],

  // Australia
  [122, -32.5, 137.5, -30, 1917, "Trans-Australian"],
  [133, -27.5, 136.5, -23.6, 1929, "Ghan to Alice Springs"],
  [130.5, -24.5, 134.5, -14.6, 2004, "Alice Springs–Darwin"],
  [115.5, -24, 120.5, -20, 1966, "Pilbara iron lines"],

  // The Americas
  [-101.5, 53.8, -93.5, 59, 1929, "Hudson Bay Railway"],
  [-68, 50.2, -64.5, 55, 1954, "Quebec North Shore and Labrador"],
  [-118.5, 56.8, -113.5, 61, 1964, "Great Slave Lake Railway"],
  [-124, 54.5, -120, 57, 1958, "British Columbia north"],
  [-81.5, 49.5, -80.3, 51.4, 1932, "Moosonee"],
  [-150.5, 60, -147, 65, 1923, "Alaska Railroad"],
  [-94.3, 17, -90.6, 19.5, 1950, "Mexican Southeastern"],
  [-109.2, 25.8, -106.2, 28.5, 1961, "Chihuahua–Pacific"],
  [-115, 30.5, -112.5, 32.4, 1948, "Baja California"],
  [-51, -6.5, -44, -2.5, 1985, "Carajás"],
  [-50, -12, -47, -5.5, 1996, "North–South Railway"],
  [-62.5, -19.5, -57.7, -17.5, 1955, "Santa Cruz–Corumbá"],

  // Asia
  [72.8, 12.8, 74.2, 18.6, 1998, "Konkan Railway"],
  [61, 28.5, 66, 30.5, 1918, "Nushki–Zahedan"],
  [99, 6.5, 101.5, 11, 1918, "Thai southern line"],
  [98.8, 17.5, 100.5, 19, 1922, "Chiang Mai"],
  [101.5, 14.5, 105.5, 18, 1930, "Northeast Thailand"],
  [107.5, 12.2, 109.5, 16, 1936, "Trans-Indochinese, south"],
  [105.7, 16.5, 107.5, 18.8, 1927, "Trans-Indochinese, centre"],
  [127.5, 39.5, 130.7, 43, 1928, "Hamgyong line"],
  [101.8, 2.7, 103.5, 6.3, 1931, "Malayan east coast"],

  // Europe
  [12, 64.5, 15.5, 67.4, 1940, "Nordland Line"],
  [24, 66.6, 29.5, 69, 1934, "Finnish Lapland"],
  [19, 42, 20.5, 44, 1976, "Belgrade–Bar"],
  [19.2, 39.8, 20.6, 42.3, 1947, "Albania"],
  [21.5, 39.5, 23, 40.6, 1916, "Larissa–Thessaloniki"],
];

/** The year a railway at this point was built, by the boxes above. */
export function railSince([x, y]) {
  let since = 0;
  for (const [w, s, e, n, year] of RAIL_SINCE) if (x >= w && x <= e && y >= s && y <= n && year > since) since = year;
  return since;
}

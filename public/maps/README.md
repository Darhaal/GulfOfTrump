# Map data

Four province maps, one per historical base year, built by
[`scripts/build-maps.mjs`](../../scripts/build-maps.mjs) (`npm run maps`)
from two pinned sources:

| Source | Used for | License |
|--------|----------|---------|
| [Natural Earth](https://www.naturalearthdata.com/) 10m admin-1, geography regions, populated places, railroads and ports, 50m admin-0, via [nvkelso/natural-earth-vector](https://github.com/nvkelso/natural-earth-vector) at `ca96624a56bd078437bca8184e78163e5039ad19` | Province shapes and names (with Russian and Ukrainian names), terrain, fertility, largest city, population, railways, ports | Public domain |
| [aourednik/historical-basemaps](https://github.com/aourednik/historical-basemaps) at `da7a4b735ecef70aebdc9c73e409d8a2500d50f3` (Ourednik, A. 2021, *Historical Basemaps*) | Borders of 1914, 1938, 1994 and 2010 | GPL-3.0 |

| File | Historical borders | Used by |
|------|--------------------|---------|
| `world_1914.json` | `world_1914.geojson` | 1914 — The Shot at Sarajevo |
| `world_1938.json` | `world_1938.geojson` | 1939 — The Invasion of Poland |
| `world_1994.json` | `world_1994.geojson` | 1991 — The August Coup |
| `world_2010.json` | `world_2010.geojson` | 2022 — The Invasion of Ukraine |

**How a map is made.**

1. Natural Earth's first-level divisions become provinces. Where a country's
   divisions are tiny they are merged by region (England's regions instead of
   232 councils) or into one province; microstates are one province;
   Antarctica is left out.
2. Each province gets a terrain and a fertility from points sampled on a grid
   inside it ([`scripts/land.mjs`](../../scripts/land.mjs)): Natural Earth's
   geography regions, a few of them reclassified; hand-drawn climate zones for
   the dry lands Natural Earth leaves unnamed (Arabia, Iran, the Horn of
   Africa, Patagonia) and the savannas; the latitude elsewhere; and great
   rivers watering the dry land along them. A short table sets the few
   provinces the samples still misread. Each also gets an area, a coast flag
   and its largest city.
3. The historical borders are cleaned (unnamed islets merged into their
   neighbours, same-name pieces dissolved, overlapping duplicates removed) and
   every province is cut along them. A side that holds at least 15% and
   1,500 km² of a province becomes its own province, named after the side it
   lies on ("Minsk (west)"); smaller slivers go to the main part.
4. Each province gets its population on the scenario's start date
   (`pop`, thousands), its people's natural growth in the era (`gr`, % a
   year: the country's pace from the start to the next date in the table, or
   the last thirty years' pace slowed a quarter after 2022), its centre
   (`at`, [lon, lat]) and its kilometres of main railway then (`rail`). The
   country totals for today's borders are written by hand in
   [`scripts/population.mjs`](../../scripts/population.mjs) (Natural Earth's
   2019 estimate scaled by regional growth for the rest); within a country the
   cities' people go to the provinces they stand in and the rest follows
   settlement (every town counts by the square root of its size), or today's
   census shares for China, India, Russia and Nigeria. Railways are Natural
   Earth's network dated by the boxes in
   [`scripts/transport.mjs`](../../scripts/transport.mjs). Both are
   estimates for a game, not data for research.
5. The result is simplified and written as TopoJSON. Each province records
   the historical polygon it lies in (`hist`, `owner`); the scenarios turn
   those into owners for their own date, in code (`src/engine/scenarios/`).

**Shared layers.** `water.json` holds Natural Earth rivers (scale rank up to
7) and lakes (up to 5); `transport.json` the railways of scale rank up to 8
(`r`, and `s`, the year a line opened where after 1914) and about 1,100 ports;
`cities.json` about 3,900 places (scale rank up to 6, every national and
provincial capital — `adm1` — and a few flashpoints) with names in three
languages and their populations in 1950, 1990 and 2020, in thousands. All are
public domain.

`towns.json` adds about 25,000 towns of 15,000 people and more from
[GeoNames](https://www.geonames.org/) (`cities15000`, licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)) that `cities.json`
does not hold: `[name, x, y, population today in thousands, seat, ru?, uk?]`.
Russian and Ukrainian names come from GeoNames' language-tagged alternate
names for the former Soviet Union and Poland, and are picked from its other
Cyrillic names elsewhere ([`scripts/towns.mjs`](../../scripts/towns.mjs)).

**Resources** (`res` on a province: `[type, [[year, output], …]]`, output 0–10
against the leading region of its day) come from
[`scripts/resources.mjs`](../../scripts/resources.mjs), a hand-written table
of about 230 fields and mines matched to provinces by country and name;
**rivers** (`rv`) are the major rivers whose line passes through the province.

**License.** These files are derived from the historical-basemaps data and are
distributed under the GNU General Public License v3.0 — full text in
[`LICENSE`](LICENSE) in this folder. The Natural Earth part is public domain.
The rest of the repository (the game's code) is under the MIT License; the
game reads these files as data at run time.

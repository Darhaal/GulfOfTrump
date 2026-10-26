# Portraits

The leaders and ministers of the game, painted in oil by `npm run portraits`
(`scripts/portraits.mjs`) from photographs on Wikimedia Commons.

- **Who:** `scripts/portraits/people.json` – every leader of the eight start
  dates, the ministers, chiefs of staff, central bankers and heads of
  intelligence and science of the countries that matter on each date, their
  deputies (`deputyOf`: the post they stand in for) and the party leaders,
  rebels and commanders the game shows, each with a Wikidata id. Most were
  taken from the offices they held on the date (Wikidata P39 with start and
  end), the rest checked against Wikidata by name and year of birth.
  The script reads each person's picture (P18) and sex (P21) from Wikidata.
  `scripts/portraits/quoted.json` holds the writers and thinkers quoted while
  a turn is written who are not the game's people; `npm run portraits --
  --quoted` paints them the same way (an old painting, bust or engraving for
  the ancients) and credits them here, but they stay out of the engine's
  index.
- **Which photographs:** only those Commons gives a free licence — public
  domain, CC0, CC BY, CC BY-SA or the Open Government Licence. Nothing under
  NC, ND, GFDL alone or fair use.
- **What was changed:** each photograph is cropped to head and shoulders,
  turned grey, smoothed like paint, lit on the face, given brush strokes, a
  warm umber-to-ivory tone, a glaze and the weave of a canvas, and saved as a
  256×320 WebP.
- **Who made them:** `credits.json` gives each portrait's source file, its
  author, its licence and the change made; the About page lists them.
- **No photograph:** a shadow, `_shadow-<era>-<sex>-<n>.webp`: a dark bust
  drawn for the game (`scripts/portraits/shadows.mjs`) and painted the same
  way. Each era (1914, the forties, the fifties to seventies, the nineties,
  today) has its own hair, beards, hats, caps, collars and shoulders, several
  looks to each sex; a stranger gets one fixed by their name. The shadows are
  the game's own work, under its licence (AGPL-3.0); `npm run portraits -- --shadows`
  paints them again.

## Licences

The portraits are not under the game's AGPL-3.0 licence. Each keeps the licence of
its photograph:

- from a public-domain or CC0 photograph: public domain;
- from a CC BY photograph: CC BY, crediting the photographer as `credits.json`
  does;
- from a CC BY-SA photograph: CC BY-SA under the same version, crediting the
  photographer;
- from an OGL photograph: the Open Government Licence.

Showing real people here does not mean they or anyone else endorse the game.

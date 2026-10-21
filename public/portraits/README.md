# Portraits

The leaders and ministers of the game, painted in oil by `npm run portraits`
(`scripts/portraits.mjs`) from photographs on Wikimedia Commons.

- **Who:** `scripts/portraits/people.json` — every leader of the eight start
  dates and the key ministers of the main countries, each with a Wikidata id.
  The script reads each person's picture (P18) and sex (P21) from Wikidata.
- **Which photographs:** only those Commons gives a free licence — public
  domain, CC0, CC BY, CC BY-SA or the Open Government Licence. Nothing under
  NC, ND, GFDL alone or fair use.
- **What was changed:** each photograph is cropped to head and shoulders,
  turned grey, smoothed like paint, lit on the face, given brush strokes, a
  warm umber-to-ivory tone, a glaze and the weave of a canvas, and saved as a
  256×320 WebP.
- **Who made them:** `credits.json` gives each portrait's source file, its
  author, its licence and the change made; the About page lists them.
- **No photograph:** `_shadow-male.webp` and `_shadow-female.webp`, painted the
  same way from Wikimedia's public-domain placeholder busts ("Black - replace
  this image male/female.svg").

## Licences

The portraits are not under the game's MIT licence. Each keeps the licence of
its photograph:

- from a public-domain or CC0 photograph: public domain;
- from a CC BY photograph: CC BY, crediting the photographer as `credits.json`
  does;
- from a CC BY-SA photograph: CC BY-SA under the same version, crediting the
  photographer;
- from an OGL photograph: the Open Government Licence.

Showing real people here does not mean they or anyone else endorse the game.

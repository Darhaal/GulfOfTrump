# Scenes

The pictures of the eight start dates on the front page, painted in oil by
`npm run scenes` (`scripts/scenes.mjs`) from pictures on Wikimedia Commons.

- **Which pictures:** one of each date's moment, chosen by hand in
  `scripts/scenes.mjs`, kept only if Commons gives it a free licence (the
  portraits' rule: public domain, CC0, CC BY, CC BY-SA and the others in
  `scripts/portraits/oil.mjs`).
- **What was changed:** each picture is cropped to 5:3, turned grey,
  smoothed like paint, lit in the middle, given brush strokes, the warm
  umber-to-ivory tone, a glaze and the weave of a canvas, and saved as a
  720×432 WebP.
- **Who made them:** `credits.json` gives each scene's source file, its
  author, its licence and the change made; the About page lists them.

## Licences

The scenes are not under the game's MIT licence. Each keeps the licence of
its picture: public domain stays public domain; a CC BY or CC BY-SA picture
keeps that licence, crediting its author as `credits.json` does.

The worn paper under the pages (`public/paper/`) is drawn by the same script
from noise, with no source picture, and is the game's own work under MIT.

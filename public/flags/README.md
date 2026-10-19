# Flags

Today's national flags, as SVG, from [flag-icons](https://github.com/lipis/flag-icons)
(MIT licence; the flags themselves are public domain). Only the flags of
countries in the scenarios are copied here, by `npm run flags`
([scripts/flags.mjs](../../scripts/flags.mjs)), which also writes the tag →
ISO code table `src/engine/flagCodes.ts`.

States that no longer exist (the USSR, Austria-Hungary, the Ottoman Empire,
Yugoslavia…) and flags that changed since a scenario's date are drawn in
[src/components/Flag.tsx](../../src/components/Flag.tsx); which flag a country
flies on a date is decided in [src/engine/flags.ts](../../src/engine/flags.ts).

# The public demo on Vercel

The site testers open is the game itself built in **demo mode**:

- the offline game master answers every request, so a turn costs nobody's
  plan and changes almost nothing;
- ChatGPT sign-in is switched off;
- a strip under the header says it is a demo and links to the front page's
  "Play for real" section: how to run the game locally, the source and the
  bug forms;
- the front page begins with four played games to open (below).

Real play stays local, on each player's own ChatGPT plan. OpenAI's terms keep
a player's tokens and requests on their own machine
([ai-providers.md](ai-providers.md)), so the hosted copy is a demo and stays
one.

**On Vercel the demo needs no flag**: a build there is always the demo, since
the game recognises Vercel's own variables. On another host set the flag
before the build — `NEXT_PUBLIC_` variables are baked into it.

The front page's "Play for real" section offers the Windows app from the
public repository's latest release.

## Setting it up

1. Import the public repository `Darhaal/GulfOfTrump` into Vercel (framework:
   Next.js; build and install commands as detected).
2. Node.js 22.x in the project settings.
3. Environment variable, for Production and Preview:

   | Name | Value |
   |------|-------|
   | `NEXT_PUBLIC_GOT_DEMO` | `1` |

   Leave the Supabase variables unset: the demo has no accounts, and saves
   stay in the visitor's browser.
4. Deploy. Every push to `main` deploys again.

## What demo mode changes

| Where | Locally | Demo |
|-------|---------|------|
| Game master | ChatGPT (or the mock with `GOT_MOCK_AI=1`) | The mock, always |
| Request guard | Loopback hosts only | Any host; same-origin and JSON checks stay |
| `POST /api/ai/connect`, `/disconnect` | Sign-in | 403 `demo` |
| Interface | — | Demo strip; "Play for real" on the front page |
| Played games | Quiet examples below "Your games"; one opens as a copy among them | "Open a played game" first on the front page; one opens in memory |

The map files travel with the functions through `outputFileTracingIncludes`
in `next.config.ts`, since the game routes read them from disk.

## Played games

A turn of the offline game master shows little of the game, so the demo's
front page offers four games already played, to open at their last turn:
Austria-Hungary from 28 June 1914, Poland from 1 September 1939, the United
States from 2 August 1964 and Ukraine from 24 February 2022. Their turns,
the ministers' views and answers, letters and the army's organisation were
written for them and run through the engine's own path, in English, Russian
and Ukrainian; the Store's screenshots are taken from the same games
(`scripts/screens.mjs`).

- **Files**: `public/played/<game>.<locale>.gotsave`, sealed like an
  exported save, served as static files. A visitor fetches one, in the
  interface language: 72–124 KB (12 files, 1.1 MB in all). Most of a file
  is the world's state (about 2,700 provinces and every country), not
  the chronicle, so trimming the chronicle would save little.
- **Opening**: the front page reads the file as "Import a save" reads one
  (`openSave`, then the schema) and goes to the game, which runs the save's
  migrations and `refreshSave` as for any save; a game from before a new
  migration keeps opening. The demo keeps it in memory, under its own id,
  and `/play/<id>` opens it again from its file after a reload; the app
  adds a copy to the player's games, which keeps the game's seed.
- **Playing on**: from the last turn the demo's offline game master plays.
  The front page says so before a game opens, and while one plays, the
  strip under the header says which turns were written for it.
- **The list**: `src/lib/played.ts` – each game's file, id, country, dates,
  turn and its line on the front page (`played.line.*` in
  `src/i18n/messages.ts`).
- **Writing them again** after the game's state changes shape, or after a
  game's script in `scripts/screens/games/` changes (the public copy of the
  repository ships the files but not the games' scripts or the test runner):

  ```bash
  npm run played                                  # all four, every language
  SCREENS_GAMES=1939-poland npm run played        # only these
  ```

  The files change only when a game does: the seal's nonce is fixed.
  `tests/played.test.ts` opens each file in every language through the
  schema, the migrations and `refreshSave`, and checks what the front page
  says of it, its size and its dashes.

## Checking a build before it goes up

```bash
NEXT_PUBLIC_GOT_DEMO=1 npm run build
NEXT_PUBLIC_GOT_DEMO=1 npm start
```

Open http://127.0.0.1:3000: the demo strip shows, a turn ends instantly with
`[mock]` text, and Settings says sign-in is not available. Open a played
game: it opens at its last turn in the interface language, the strip says
its turns were written for it, and End turn plays on with the offline game
master.

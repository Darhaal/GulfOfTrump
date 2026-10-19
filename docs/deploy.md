# The public demo on Vercel

The site testers open is the game itself built in **demo mode**:

- the offline game master answers every request, so a turn costs nobody's
  plan and changes almost nothing;
- ChatGPT sign-in is switched off;
- a strip under the header says it is a demo and links to the front page's
  "Play for real" section: how to run the game locally, the source and the
  bug forms.

Real play stays local, on each player's own ChatGPT plan. Sign in with ChatGPT
in a hosted app needs OpenAI's approval ([ai-providers.md](ai-providers.md));
until then the hosted copy is the demo.

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

The map files travel with the functions through `outputFileTracingIncludes`
in `next.config.ts`, since the game routes read them from disk.

## Checking a build before it goes up

```bash
NEXT_PUBLIC_GOT_DEMO=1 npm run build
NEXT_PUBLIC_GOT_DEMO=1 npm start
```

Open http://127.0.0.1:3000: the demo strip shows, a turn ends instantly with
`[mock]` text, and Settings says sign-in is not available.

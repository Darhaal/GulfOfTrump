# Security

## What is worth protecting

1. **The player's ChatGPT tokens** — whoever has them can spend the player's
   plan and see their name and email.
2. **The player's plan through the game server** — anyone who can call the
   game's AI routes spends the plan of the person running it.
3. **Cloud saves** — each player's games, readable and writable by them only.
4. **What anonymous telemetry may carry** — nothing that names the player or
   repeats what they or the model wrote, and nothing at all without consent.

Cheating is out of scope: the state lives in the player's own browser and they
may edit it as they like. There is nothing to win from anyone else.

## Guards on the local server

Every API route calls `rejectNonLocal` ([`src/server/guard.ts`](../src/server/guard.ts)) first:

- **Host must be loopback** (`127.0.0.1`, `localhost`, `[::1]`). A request from
  another machine on the LAN, or a DNS-rebinding page (which arrives with its
  own host name), gets 403.
- **No cross-site requests.** If the browser sends `Origin`, it must equal the
  server's own origin; `Sec-Fetch-Site` must be `same-origin` or `none`. A
  malicious website open in another tab cannot drive turns.
- **JSON bodies only.** A plain HTML form cannot send `application/json`
  without a CORS preflight, and the server never answers one.

`npm run dev` / `npm start` bind to `127.0.0.1`, so the port is not even
reachable from the network. The sign-in callback listener binds to
`127.0.0.1` on a random port, accepts one request carrying the right `state`
(compared in constant time), and closes.

The return URL after sign-in is built from the server's own host, never taken
from the request body, so the sign-in cannot be turned into an open redirect.

### The desktop app

The Windows app ([desktop/README.md](../desktop/README.md)) runs this same
server on `127.0.0.1:41914` and shows it in its own window. The guards are
unchanged. Sign-in opens the system browser and returns to the loopback
listener, and the tokens live in the same encrypted store. Links outside the
game open in the system browser, never in the app's window. Desktop builds
carry no `.env` file; the release workflows build in only the Supabase URL
and anon key (public by design) from the repository's variables.

Neither the app's window nor `next.config.ts` sets a Content-Security-Policy
(only the loading screen, `desktop/splash.html`, has its own). If one is
added, its `connect-src` must allow the Supabase origin, which the page calls
directly for cloud saves and telemetry.

### The public demo

With `NEXT_PUBLIC_GOT_DEMO=1` (the Vercel site, see [deploy.md](deploy.md)) the
loopback check is lifted, because every AI route then runs the offline mock
and spends nobody's plan. The same-origin and JSON checks stay, and the
sign-in routes refuse with `demo`, so no tokens are ever handled there.

## Token storage

[`src/server/chatgpt/store.ts`](../src/server/chatgpt/store.ts):

- Location: `~/.gulf-of-trump/` (or `$GOT_HOME`), **outside the project
  folder**, so `git add .` or zipping the repo cannot include it.
- `chatgpt.json` is AES-256-GCM encrypted; the 256-bit key is in `secret.key`
  next to it. Both files are created with mode `0600`, the folder with `0700`
  (on Windows these modes are not enforced; the files inherit the ACLs of
  your user profile, which other standard users cannot read).
- A file that fails to decrypt is treated as no connection (sign in again).

**Accepted risk:** the key sits beside the ciphertext. This protects against
accidental disclosure (a copied file, a screen share, a backup of one file); it
does **not** protect against malware or another program running as your user,
which could read both. Moving the key into the OS keychain (Windows DPAPI,
macOS Keychain, libsecret) is not done yet.

Tokens are sent only to `auth.openai.com` and `api.openai.com`, with
`redirect: "error"` so a redirect cannot carry them elsewhere. Errors shown to
the player carry a code and a fixed message, never a token or prompt text.

## What the model can do to the game

The model's answer is untrusted input. It is parsed as JSON, validated with
zod, and every reference to a region, country, war or alliance is checked
against the state before anything is applied; stat changes are clamped to
±15 per turn. Model text is rendered as React text, never as HTML.

## Supabase

[`supabase/migrations/20261016000000_init.sql`](../supabase/migrations/20261016000000_init.sql):

- Row-level security on `profiles` and `games`; every policy is
  `auth.uid() = owner` (or `= id`), for the `authenticated` role only.
- No privileges for `anon` on either (its only right anywhere is to insert
  telemetry, below). `TRUNCATE`, `REFERENCES` and `TRIGGER` are
  revoked from `authenticated` — RLS does not cover `TRUNCATE`.
- The profile trigger is `security definer` with an empty `search_path`.
- Saves are capped at 5 MB per row.
- Exported save files are sealed (gzip, then AES-GCM, `src/lib/saveFile.ts`):
  one changed byte and the game refuses the file. The key is in the open
  code, so this stops editing by hand, not a programmer; on every load the
  engine also brings back what no game could reach – reserves past two years
  of output and one more for every year played, taxes past two, stores past
  twelve months
  (`boundEconomy` in `src/engine/economy.ts`). Plain JSON saves import only
  from before sealed files (save step 21 or earlier).

The anon key in `.env.local` is public by design; RLS is what protects the data.

## Anonymous telemetry

Opt-in statistics ([telemetry.md](telemetry.md)) go from the page straight
to the same Supabase project, by a plain `fetch` to PostgREST:

- **Consent first.** Off until the player says yes (the front page asks
  once; Settings switches it). Before a yes and after a no nothing is queued
  or sent; a no deletes the install id and aborts a request on its way. Tests,
  CI (`NEXT_PUBLIC_GOT_TELEMETRY=off`), builds without Supabase and runs with
  `GOT_MOCK_AI=1` never send.
- **A whitelist, not a convention.** Every event is rebuilt from a fixed list
  of columns, each checked (`src/lib/telemetry/events.ts`), so there is no
  field a text, a name, an e-mail, an account id, a token or a save could
  travel in; `tests/telemetry.test.ts` tries. Error codes that are not plain
  machine words become `other`; only the scenario's own country tags pass.
- **Not linked to accounts.** The install id is random and local; requests
  carry the anon key, never the signed-in player's session, and
  `credentials: "omit"`. A game is named by a salted hash whose salt never
  leaves the computer, so rows cannot be joined to `games`. The table has no
  IP column.
- **Insert only.** [`20261023000000_telemetry.sql`](../supabase/migrations/20261023000000_telemetry.sql)
  turns on RLS with one `insert` policy for `anon` and `authenticated` and
  grants nothing else; the game sends `Prefer: return=minimal`, so it needs
  no right to read. Every column has a check of the same shape as the
  whitelist. pg_cron deletes rows after twelve months.
- **Accepted risk:** whoever holds the public anon key can insert junk rows.
  The checks keep them small and well-formed, and they can be deleted by
  install id or time. A failing endpoint costs the game nothing: batches are
  dropped, never retried, and sending stops after three failures in a row.

## Reporting a problem

Open a GitHub issue, or for anything sensitive email artem@okhten.com.

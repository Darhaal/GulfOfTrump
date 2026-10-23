# Security

## What is worth protecting

1. **The player's ChatGPT tokens** — whoever has them can spend the player's
   plan and see their name and email.
2. **The player's plan through the game server** — anyone who can call the
   game's AI routes spends the plan of the person running it.
3. **Cloud saves** — each player's games, readable and writable by them only.

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
carry no Supabase project and no `.env` file.

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
- No privileges for `anon` at all. `TRUNCATE`, `REFERENCES` and `TRIGGER` are
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

## Reporting a problem

Open a GitHub issue, or for anything sensitive email artem@okhten.com.

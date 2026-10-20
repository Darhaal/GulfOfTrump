# Getting started

## 1. Run the game

Requirements: Node.js 22.12 or newer, git, a ChatGPT account.

```bash
git clone https://github.com/Darhaal/GulfOfTrump.git
cd GulfOfTrump
npm install
npm run dev
```

Open **http://127.0.0.1:3000**. (Use `127.0.0.1`, not a LAN address — the game
server answers only this computer.)

## 2. Connect ChatGPT

Settings → **Sign in with ChatGPT**. A tab opens on `auth.openai.com`:

1. Sign in to ChatGPT if needed.
2. Approve **Gulf of Trump** and its use of your ChatGPT plan.
3. The tab returns to the game's settings page — "ChatGPT connected".

Optionally pick a model in Settings; by default the first one your account
offers is used. Your usage and per-app limits are in ChatGPT → Settings → Usage.

The connection is stored encrypted in `~/.gulf-of-trump/` (or `$GOT_HOME`).
"Disconnect" revokes it at OpenAI and deletes the file.

## 3. Play

Main menu → pick a date → pick a country (map or list) → **Start**.

- **Orders**: write what your government does this turn, one order per line,
  in any of the three languages. Pick the turn length (week … year).
- **End turn**: the game master resolves the period — usually 10–60 seconds
  depending on the model. A report opens with the headline, narrative, events
  and what changed.
- **Diplomacy**: write to any government; it answers in character. Agreements
  are taken into account when the turn ends.
- **Chronicle**: every turn so far.

Games save automatically in the browser (and to your account, if signed in).

## 4. Optional: Google sign-in and cloud saves (Supabase)

1. Create a project at [supabase.com](https://supabase.com).
2. Apply the schema — either paste
   [`supabase/migrations/20261016000000_init.sql`](../supabase/migrations/20261016000000_init.sql)
   into the SQL editor and run it, or with the CLI:
   ```bash
   npx supabase link --project-ref <your-ref>
   npx supabase db push
   ```
3. Authentication → Providers → **Google**: enable it with a Google OAuth
   client (Google Cloud Console → Credentials → OAuth client ID, type "Web
   application", authorised redirect URI
   `https://<your-ref>.supabase.co/auth/v1/callback`).
4. Set the site URL and redirect URLs (`http://127.0.0.1:3000/auth/callback`,
   `http://localhost:3000/auth/callback`, and for the desktop app
   `http://127.0.0.1:41914/auth/app/**`) — they are declared in
   [`supabase/config.toml`](../supabase/config.toml), so with a linked CLI:
   ```bash
   npx supabase config push
   ```
   (It changes only what the file declares; the Google provider stays as set in
   the dashboard.) Or add them by hand under Authentication → URL Configuration.
5. Copy `.env.example` to `.env.local` and fill in
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   (Project Settings → API). Restart `npm run dev`.

Settings → Account → **Sign in with Google**. From then on saves go to both the
browser and your account, and appear on any computer you sign in from.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| "The game server only answers this computer" | Open `http://127.0.0.1:3000`, not a LAN IP or a tunnel. |
| The sign-in tab does not open | Allow pop-ups for 127.0.0.1:3000 and click again. |
| "Plan usage was not allowed" | Sign in again and approve the plan-usage permission. |
| "Usage limit for apps is reached" | Your plan's app allowance is spent; see ChatGPT → Settings → Usage. |
| "The game master's answer could not be read" | Try the turn again, or pick another model in Settings. |
| Turns are slow | Pick a faster model in Settings; reasoning models think longer. |

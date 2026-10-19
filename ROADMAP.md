# Roadmap

What comes next for Gulf of Trump, in order. There are no dates: a step is
done when it works, and testers' reports can reorder what follows.

The game stays a sandbox — no goals, no score, no end. The work below gives
players more to do and makes it easier to start.

## 1.0.0-beta — the first public beta

The code goes public and a site goes up for testers. Real play stays local,
on each player's own ChatGPT plan, until OpenAI approves a hosted version.

1. **Resources per country.** Each country's output and use match the real
   figures of its date, not only the world totals.
2. **A first-run tour.** Five or six hints over the interface on the first
   game, and two or three suggested first orders for the chosen date and
   country. Easy to skip, can be replayed from Settings.
3. **Saves in IndexedDB.** Room for hundreds of games instead of about ten.
   Existing saves move over by themselves; cloud saves stay optional.
4. **A site on Vercel:**
   - what the game is, with screenshots, in the browser's language (RU, UK
     or EN);
   - an interactive demo with the offline game master, where every panel
     can be tried;
   - how to download and run the game on your own computer.
5. **Bug reports.** Issue forms on GitHub for bugs and ideas, asking for the
   date, the country, the turn and the save file.
6. **Phones.** The game is for computers; the site works on any phone, and
   the game must not break on one.
7. **The release:**
   - version 1.0.0-beta in the app, `package.json` and the changelog;
   - the public repository `Darhaal/GulfOfTrump`, starting from one clean
     commit;
   - a GitHub release, and the Vercel site built from the public
     repository.
8. **The application to OpenAI** for Sign in with ChatGPT in a hosted app,
   prepared and sent by the owner.

## After the beta

- **Lighter turns.** Detail only where it matters (the front, neighbours,
  allies, the great powers) and a summary of the rest; a short context for
  ministers and diplomats. Target: 6–10 thousand tokens a turn and 2–4
  thousand a message, down from 12–23 and 6–16.
- **Play in the browser,** once OpenAI approves:
  - a hosted sign-in, and each player's tokens kept encrypted on the server;
  - the request guard in a hosted mode, with per-player limits;
  - privacy and terms pages.
- **Testers' reports** — fixes first, then the most requested changes.
- **Upkeep:**
  - load the Supabase client only when cloud saves are on;
  - split the largest files;
  - an interface smoke test in CI;
  - checks on real model answers before prompts change;
  - numbered save migrations;
  - a turn answer that streams its story first.

## Later

- **Cosmetics, paid.** The game stays free. Map skins and era themes (a 1914
  atlas, a 1939 staff map) and other looks are sold separately. This needs:
  - accounts and payments;
  - a licence for paid assets, which stay out of the MIT code;
  - a commercial hosting plan.
- **Sharing.** An image of a turn with its headline, and a timelapse of a
  whole game.
- **More dates and countries,** chosen from what testers ask for.

## Not planned

- **Claude subscription sign-in.** Anthropic's terms forbid it in
  third-party apps.
- **API keys as a second provider.** The game plays on the player's ChatGPT
  plan.
- **Telemetry inside the game.**

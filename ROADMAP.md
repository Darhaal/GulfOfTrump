# Roadmap

What comes next for Gulf of Trump, in order. There are no dates: a step is
done when it works, and testers' reports can reorder what follows.

The game stays a sandbox — no goals, no score, no end. The guiding idea from
here on: **the player is one participant in history, not its hero.** The
world should move on its own, and every result should hold up to scrutiny.

## Done: 1.0.0-beta, the first public beta

- The code went public and a demo site went up.
- Each country's resources sit close to its real figures.
- A first-run tour, and saves in IndexedDB.
- Bug and idea forms on GitHub.
- OpenAI's terms checked. Sign in with ChatGPT keeps a player's tokens and
  requests on their own machine, so real play stays local and the site stays a
  demo.

## Done since the beta

- **A Windows app** with an installer: no Git and no terminal. Sign-in and
  its tokens stay on the player's computer; Google sign-in and cloud saves
  work in it too. It opens full screen. The Microsoft Store copy is in
  certification.
- **Characters that stay in the game.** Ministers carry out harsh orders and
  argue in character instead of refusing, always lay the leader's own course
  on the table, and long answers open at their first line.
- **Eight dates:** Korea 1950, the Gulf of Tonkin 1964 and NATO against
  Yugoslavia 1999 join 1914, 1939, 1991, 2014 and 2022.
- **Sharing:** a turn as a picture with its headline, and a whole game as a
  timelapse.
- **Upkeep:** an interface smoke test in CI, numbered save migrations, and
  the Supabase client loaded only when cloud saves are on.
- **Politics in every country, in brief** (the first step of a living
  world): every government's support, stability, next election and risk of
  a coup, moved by the engine. Elections and coups happen by seeded dice
  whether the player acts or not.
- **World news:** what happened elsewhere, turn by turn; each item opens on
  the story of its country, war or bloc.
- **Countries with intentions** (the living world's items 1–4, first pass):
  foreign courses, ties and memory; plans that grow from an incident to
  action and can fade or fail; wars and military blocs among other
  governments only from those plans; new governments that change course;
  a free and a historical mode chosen when a game is created.
- **Fog of war, first step:** other countries' figures are what the player's
  government knows of them — estimates and ranges by openness, alliances,
  borders and intelligence — and what governments hide is a rumour.
- **Ministers report after the turn**, each in a request of their own and in
  their own window, so the turn's answer is shorter. Each has interests — two
  causes, an ambition, a party — that colour their answers, and may object
  or threaten to resign.
- **Resources on all eight dates** follow the real output of the year before.

## Next: turns that are cheaper and proven

1. **Lighter turns.** Detail only where it matters — the front, the
   neighbours, the allies, the great powers — and a summary of the rest. A
   short context for ministers and diplomats. Target: 6–10 thousand tokens a
   turn and 2–4 thousand a message, down from 12–23 and 6–16.
2. **Campaigns as tests.** Reproducible games that check the simulation, not
   just the shape of the data:
   - a war, an economic crisis, a state falling apart;
   - long games of 50–100 turns.

   They catch results no state could achieve, numbers that drift, and stories
   that contradict the map.
3. **The first ten minutes.**
   - A 1939 campaign that makes you want to go on after ten turns.
   - A first screen that shows a real game.
   - Readable small labels on the map, and a legend for the front lines.
   - A short video of orders and their consequences.

## Then: a living world

The test: if the player does nothing for ten turns, the world still changes,
and in ways that make sense. That can mean elections, reforms, alliances,
crises or breakthroughs, not only wars.

1. **Countries with intentions.** Each has goals, a leader with an agenda,
   and plans that last several turns. It remembers who helped it and who
   betrayed it. A country preparing an operation does not forget it because
   the player turned to reforms.
2. **Relations and tension** between the countries that matter: trust,
   interests, dependence, fear and commitments. What a government promises in
   public can differ from what it intends.
3. **Crises that grow in stages**: an incident, then escalation, preparation,
   a decision and an outcome. The odds come from the state of the world.
   Seeded dice mean reloading a save does not reroll them. In one game a
   crisis ends in war, in another it fades.
4. **Politics that steer policy.** The engine now keeps every country's
   support, stability, elections and coups; next, they should change what a
   government does abroad. A crisis in Spain can change Spain's support for
   Ukraine.
5. **Wars need means.** Distance, supply, readiness and the will to fight
   decide what an attack can do. Taking a capital is not winning a war:
   holding ground, keeping it safe, being accepted there and settling the war
   are separate things.
6. **World news that explains.** The feed is in; next, each item should say
   why it happened — the slump before a coup, the war before a lost vote.

This is built into the engine, with no model call per country. The engine
moves every country and its plans; the game master settles the few decisions
that matter and tells the story.

## Then: play a person, not only a country

The player is one participant in history — so the game can follow one person
as well as one state. It builds on the leaders and ministers as people, with
portraits, and on deputies who can plot against their chiefs.

1. **Choose who you are at the start.** The country's leader, or any figure
   of the date: a minister, a general, a party leader in opposition, a
   dissident, an émigré. Each has their own goals, means and people around
   them, and sees only what their post lets them see.
2. **Losing power is not the end.** When the player's leader falls — a coup,
   a lost election, a resignation, death — the player chooses:
   - stay with the country and play its next government;
   - stay with the person: into opposition, exile or the underground.
3. **Opposition, with an interface of its own.** A party or a movement
   instead of a state: support and members, money, the press, allies inside
   the government and abroad, the street. Its actions are campaigns, rallies,
   coalitions, leaks, plots and a way back — by election, by revolution or by
   a foreign hand — while the country goes on under someone else.
4. **Any person can rise.** A deputy, a general or an opposition leader the
   player plays can become the country's leader, and the game turns back
   into governing.

**Phase 1 is in:** the leader or the opposition at the start; after a coup,
a revolution or a lost election, the choice to stay with the country or go
into opposition or underground; the movement's strength, the state's hand
by the dice, and its rise to power by election, revolution, coup or a call
into government; a panel of its own. Next: ministers and generals as roles,
exile with a host government, resignation and death as falls, and the
movement's own contacts abroad as letters.

## Later

- **Fog of war, deeper.** Intelligence reports with their reliability,
  rumours and mistakes, on both sides; the map and the news under it too.
- **A cabinet that intrigues.** Ministers with interests are in; next, they
  form factions, plot and become opponents.
- **Actors beyond states**: parties, armed movements, companies and elites.
- **Cascades.** A shock in one country spreads through prices, trade and
  politics, and reaches yours turns later.
- **International bodies that act**: the UN calls an emergency session,
  alliances consult, lenders step in before a default.
- **People who react**: emigration, draft evasion, and a generation shaped by
  a war.
- **World memory.** The major events, broken treaties and claims of this
  game, kept so that every later answer builds on them.
- **Technology over decades**, without a fixed tree: what a country invests
  in arrives sooner.
- **Cosmetics, paid.** The game stays free, and playing on your ChatGPT plan
  never costs anything: the terms forbid charging for it. Map skins and era
  themes (a 1914 atlas, a 1939 staff map) need:
  - accounts and payments;
  - a licence for paid assets, which stay out of the MIT code.
- **More dates and countries,** chosen from what testers ask for.

## Upkeep, alongside

- Split the largest files.
- A turn answer that streams its story first.

## Not planned

- **Hosted play on players' ChatGPT plans.** OpenAI's terms keep tokens and
  requests on the player's own machine.
- **Claude subscription sign-in.** Anthropic's terms forbid it in third-party
  apps.
- **API keys as a second provider.**
- **Telemetry inside the game.**

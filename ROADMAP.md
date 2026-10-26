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
- **Crises in stages, politics that steer policy, news that explains** (the
  living world's items 3, 4 and 6, second pass): a crisis between two states
  climbs incident, escalation, preparation, a decision at the brink and an
  outcome, with odds read off the world – everyone who would stand by each
  side and how firmly, a great power's guarantee, mediators, talks, trade,
  each government's trouble at home, the era; trouble at home holds a
  government back where votes count and tempts an autocracy abroad, cools
  its support for a friend at war and its appetite for sanctions; new
  governments lift or raise sanctions; the news and the game master are
  told why.
- **Wars need means** (the living world's item 5, first pass): readiness,
  reach, the will to fight and war-weariness at the fronts; partisans in
  occupied land; wars that end by terms, not by a capital falling.
- **Fog of war, first step:** other countries' figures are what the player's
  government knows of them — estimates and ranges by openness, alliances,
  borders and intelligence — and what governments hide is a rumour.
- **Ministers report after the turn**, each in a request of their own and in
  their own window, so the turn's answer is shorter. Each has interests — two
  causes, an ambition, a party — that colour their answers, and may object
  or threaten to resign.
- **Resources on all eight dates** follow the real output of the year before.
- **A cabinet that intrigues.** Ministers and deputies form factions from
  their causes, party and ambition, and rivals from posts they both want
  and causes that clash. Loyalty answers to the player's orders, laws,
  favours and humiliations. A disloyal faction drags its feet (the engine
  marks its orders down and holds its directives up), leaks to the press
  and plots against a minister or the leader in the plots of the player's
  politics; intelligence hears rumours before it knows. The government
  favours, promotes, reshuffles, dismisses, investigates and purges, by the
  engine's dice. Next: factions that reach beyond the cabinet – into
  parliament, the army's command and the parties – the same moves on
  deputies in their ministry's tab, and loyalty itself seen through
  intelligence rather than in plain figures.
- **Anonymous statistics, only with consent.** The first start asks once and
  Settings switches them; nothing is sent without a yes. The game's own
  Supabase learns which dates and countries are played, what turns take and
  cost, which errors players meet and which panels they use, under a random
  id of the copy – never a text, a name or an account, which a whitelist
  keeps out – and forgets it after twelve months (docs/telemetry.md).

## 1.1.0: simulation quality

Not new mechanics: proof that the world left alone produces plausible
alternate histories over 10–30 years, and the fixes the proof asks for. The
statistics bound the implausible – explosions, freezes, causeless flips,
impossible conquests – and never ask for a minimum of wars: long quiet
stretches are history too.

| Criterion | How it is measured | Assertion |
|---|---|---|
| Impossible wars | provinces taken (a front crossing the middle, or the whole) by a side whose best reach there is below 0.15, beyond its limited aims, or annexed unheld; wars begun far short of the means | none, in every seed; wars begun far short (attack means below 0.3) – none but history's dates |
| Territory | a state-invariant checker every turn (owners and holders that exist, fronts in range and inside a war, behind-the-front marks, no land held without a war beyond the start's standing occupations, wars, blocs, sanctions and plans that point at real countries) and the save schema every 12 turns | none, in every seed and in the ordinary suite's long runs |
| Peaceful life | policies adopted a year, programmes run to their end, growth a year per country (median, lowest, highest), states that ever act (and by half of the alphabet) | someone acts every year (no stretch of 12 months with nobody acting) |
| Political stability | regime changes and course resets with their recorded cause; flips within a year (a regime back and forth, a course set twice, policies that undo each other, sanctions on and off) | no regime change or flip without a cause (an election, a coup, a new government, trouble at home) |
| Blocs | trust, tension and threat inside every bloc and pact formed, and what explains it (a shared threat, an accord after talks, a trusted leader) | no bloc between open enemies (trust ≤ −50 or tension ≥ 60) |
| Diversity | distinct histories, distinct sets of wars, and provinces whose owner differs between two seeds | at least half the seeds tell different histories |
| Long runs | time a turn, economies out of bounds (debt, inflation, growth, joblessness), wars begun a decade | slowest turn under 20 s, median under 3 s; growth beyond ±15% in at most a handful of country-years; at most 8 wars a decade in 2022, 16 in 1939 |
| Causality | counterfactuals: the same seeds with one change (lower tension, more trust, a great power's word withdrawn, a government's support crashed before its election, no fleet for a distant war), paired, with a 95% interval and McNemar's test | no change moves the odds the wrong way beyond noise; the clearest (tension, guarantee, trouble at home, fleet, the fall of a crashed government) must move them the right way |

**Done:** fair caps on the world's peaceful plans and incidents (every
government casts its dice, a seeded priority by need and weight decides when
the cap binds, and the caps are backstops, not quotas); the game master and
the news limited by relevance instead; the multi-seed harness
(`WORLD_STATS=1`, reports in docs/playtests/world-stats-2022.md and
world-stats-1939.md, chronicles beside them) and the counterfactuals
(docs/playtests/world-counterfactuals.md); and the contained fixes they
found (docs/world.md, "What the statistics changed"): an ally's land
returned to it, fronts that end with their war, treaties that defend only
the attacked, neighbours by land that need no fleet, patrons that back
only their own quarrels, blocs in their own part of the world, goodwill
that holds a quarrel back, coups that follow trouble, sanctions that stand
a year. With them every seed of both dates and both modes passes every
assertion (eight seeds each; two 2022 seeds played thirty years pass
too), and every counterfactual moves the odds the expected way.

**Remains** (docs/world.md, "Still open"): more seeds of 20–30 years (two
so far) and the same statistics for the other six dates; a guarantee aimed at
one power rather than any aggressor; a fleet that weighs more at the brink
of a war across the sea (stripping a whole navy lowers the odds of such a
war by only a few points – the fronts then stall it); every economy
drifting to one trend growth for its era; fronts that move at one pace
whatever the era; mobilisation that raises soldiers, not only readiness;
a supporter already at war elsewhere counting fully behind its friends;
wartime elections held on their dates; incumbents who lose most elections;
the Sino-Japanese war and the Russo-Ukrainian war ending too soon by terms;
and the statistics and counterfactuals run on a schedule rather than by
hand.

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

   **First pass is in:** readiness by mobilisation, reach from home across
   land and sea, the will to fight and war-weariness weigh every side's
   strength at the fronts; a planner short of them backs down or fights for
   a border; occupied peoples resist and accept new rulers only years after
   a peace; a side whose will breaks seeks terms. Next: a front pace by era
   and mechanisation (a 1939 Blitzkrieg is still too slow in a world left
   alone), mobilisation that raises soldiers rather than only readiness, and
   the people of a province as more than the country it was taken from.
6. **World news that explains.** The feed is in; next, each item should say
   why it happened — the slump before a coup, the war before a lost vote.

**Items 3, 4 and 6 are in (second pass):** crises climb their five steps in
the open, end in war in one game and fade in another – talked down,
mediated by a great power or a bloc's leader, deterred by the target's
friends, dropped by a new government or for the economy's sake; politics at
home steer wars, aid to friends at war and sanctions; crises, coups, lost
elections and sanctions say why in the news. Next: aid to a country at war
as a deed of its own (money and arms the engine sends, not only sanctions
and the word given), mediation as a visible step (an envoy, a conference),
and the reasons of policies and alliances.

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
into government; a panel of its own.

**Phase 2 is in:** ministers of the eight ministries and generals of the
forces or a front as roles, real people of the date where the data has
them, each with its standing, its orders accepted or refused by the dice,
its own panel and what its post lets it see; their rise – named head of
government, a coup, a resignation that topples a coalition cabinet; exile
with the government that would shelter the person, lobbying and
broadcasting from abroad and coming home; the movement's contacts abroad
as letters; resignation, dismissal and death as falls, each with the
choice to go on with the country, with the person or with a successor.
Next: a dissident and an émigré as starting roles, deputies who rise, and
the people around each role – an aide, a rival, a patron – as people.

## Later

- **Fog of war, deeper.** Intelligence reports with their reliability,
  rumours and mistakes, on both sides; the map and the news under it too.
- **Actors beyond states**: parties, armed movements, companies and elites.
- **Cascades.** A shock in one country spreads through prices, trade and
  politics, and reaches yours turns later.
- **International bodies that act**: the UN calls an emergency session,
  alliances consult, lenders step in before a default.
- **The human cost of war, felt.** The engine now counts each war's dead,
  wounded and prisoners; next, they should matter:
  - prisoner exchanges and their terms, negotiated in talks, and what a
    country does to win its people back;
  - honours, funerals and memorials for the fallen, which rally a country;
  - anger at heavy losses, at men lost for nothing, at families waiting for
    news of the missing, which turns into protests and lost elections;
  - how prisoners are treated, and the outrage abroad when they are not.
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
  - a licence for paid assets, which stay out of the AGPL code.
- **Multiplayer.** Several players, each governing a different country in
  one world on a server we host, each still playing on their own ChatGPT
  plan: the engine settles the shared world, and each player's plan writes
  only that player's part of the turn, so the parts run side by side.
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

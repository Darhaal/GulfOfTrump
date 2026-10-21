# Changelog

All notable changes to Gulf of Trump. The app shows its version from
[`src/constants/app.ts`](src/constants/app.ts) — keep both in sync when
releasing.

Format: [Semantic Versioning](https://semver.org/). Types: **major** = game
milestone, **minor** = new scenario / feature, **patch** = fixes & improvements.
Alphas and betas (up to and including 1.0.0-beta): anything may change, saves
included.

## [Unreleased]

## [1.0.4-beta] — 2026-10-21

Fronts that move, ministers who think, and faces of their time. Since
1.0.3-beta:

- fronts move by the balance of strength when the game master leaves them
  alone, the living world's wars included;
- ministers give one paragraph of their own view after a turn, three at
  most, and advise in words: the orders are the player's own;
- 46 shadows drawn for the game dress strangers for their era; larger
  portraits framed like little mirrors; the ruler leads, not a ceremonial
  head of state;
- research by directions instead of projects;
- play a person: lead the opposition, and play on after losing power;
- a loading screen with the era's quotes, updates you can see, the map
  zooms to 64×, and a sitemap for the demo site.

### Fixed
- **Fronts no longer stand still.** Every front moved only when the game
  master wrote it into the turn, and it seldom did for wars far from the
  player: in twelve quiet months of each start date not one front moved,
  and the wars the living world starts (Austria-Hungary on Serbia, the
  Soviet Union on Poland and Finland, Russia on Ukraine in 2014) never got
  a front at all; in the offline demo nothing ever moved. Now the engine
  moves every front the turn's answer leaves alone, by the balance of
  strength where it runs: soldiers and heavy weapons, spread along every
  front a country fights on. The stronger side gains ground and breaks into
  provinces next to its own; in an even fight the defender holds; mountains,
  forests, marshes, rivers and a lack of railways slow the attacker; a war
  with no fighting yet sees its attacker probe the line. The game master's
  own moves come first: where it moved a war's front, the rest only drifts.
  Nothing moves in a war under a truce or one the turn ends. The game master
  sees each war's strength, and the provinces the front runs through are
  listed first, so a long front's limit never hides one.
- **An attacker the game master leaves with almost nothing of a province is
  driven out of it.** A share under 5% was ignored, and the front stayed
  where it was.
- **The ruler, not a ceremonial head of state, leads the country.** North
  Korea in 1950 showed Kim Du-bong, the Presidium's chairman, as its leader;
  it is Kim Il-sung, whom the leader line names. When the cabinet's top posts
  change, the one who ruled stays first in the line, or whoever takes their
  post: a new president leads, a new ceremonial head under a ruling premier
  does not. Feminine titles ("Президентка") are read as titles.
- **Dialogs are no longer cut off by the header.** The quit dialog opened
  inside the blurred header and showed only its bottom; every dialog is now
  drawn over the whole window.
- **Larger portraits, framed like little mirrors** (an oval arch on top):
  the leader at the top of the cabinet, the ministers
  as portrait tiles, the government list, a country's rulers, diplomacy, the
  opposition and the fall of a government.

### Added
- **People without a photograph look like their era, and not all alike.**
  The one borrowed placeholder bust gives way to 46 shadows drawn for the
  game and painted in oil: beards, stiff collars, plumed hats and the Kaiser's
  officers in 1914; padded shoulders, homburgs and peaked caps in 1939; crew
  cuts and the marshals' big caps in the fifties and sixties; full heads of
  hair and shoulder pads in the nineties; short cuts, trimmed beards and long
  hair today. A stranger keeps the one their name gives them; the era follows
  the game's year.
- **The map zooms closer**, to 64× instead of 24×: labels, towns and fronts
  keep their size on screen.
- **The loading screen scales up on big monitors**, to 1.6× at 1920 px.
- **A loading screen worth waiting on.** The app starts on the emblem, a
  bar that follows the real start (the port, the server, the wait for it,
  opening the game — paced by how long the last start took) and quotes of
  the game's eras with their speakers' oil portraits: 37 lines from Grey's
  lamps going out in 1914 to Zelensky's "we are all here" in 2022, each with
  its source, none repeated until all have been shown. The same quotes keep
  the player company while a turn is being written.
- **Updates you can see.** The app checks at start and every four hours,
  shows the download with its percent, then "Update ready — Restart now or
  Later" (later installs on quit), and on the first start of a new version
  says what it came from with a link to what's new. Settings has the
  version, a "Check for updates" button and the result. Every step goes to
  `logs/updater.log`. The Microsoft Store copy says the Store updates it.
- **The developer, painted in oil** like the game's leaders, on the about
  page, the app's loading screen and the site's footer.
- **A sitemap and robots.txt for the demo site**, so Google can find its
  front page, the eight dates, about and privacy. A copy of the game on
  someone's own computer still asks search engines to stay away.
- **Eighteen more portraits.** The portraits now also take photographs
  under the open licences of the Indian and Korean governments and of the
  European Parliament, the Free Art License, or with no known copyright
  restrictions: de Gaulle, Modi, Shastri, Vajpayee, Manmohan Singh, Kim
  Dae-jung, Moon Jae-in, Park Geun-hye, Zhu Rongji, Iohannis, Jospin,
  Bethmann-Hollweg, George Marshall and others. A photograph chosen by hand
  (`photo` in people.json) comes before Wikidata's: Wałęsa is painted as he
  looked in 1990, not decades later.
- **Ten more portraits**, found beyond Wikidata in Commons categories,
  archives and other Wikipedias: Naftali Bennett, General Nguyễn Khánh (the
  data had confused him with a namesake), Subandrio, Luo Ruiqing, Yim
  Byeong-jik, Kyrylo Shevchenko and others; Jürgen Mertens is cut from a
  group photograph, and his credit says so.
- **Play a person: the opposition** ([src/engine/role.ts](src/engine/role.ts)).
  On the pick screen the player chooses who they are: the country's leader,
  as before, or its opposition — a legal party where votes can change the
  government, a movement underground where they cannot — with their own
  name and the movement's, or names the game master gives them.
  - In opposition the player does not govern. The game master plays the
    government like any other, and the orders are the movement's: rallies,
    the press, coalitions, friends in the government and the army, help
    from abroad, strikes, elections. The sanitizer keeps them off the state:
    no ministries' reports, contracts, bills, arms priorities or research.
  - The engine keeps the movement: support, members, money, press, friends
    in the government and in the army, the street. Each turn it moves only
    within the turn's reach, and the state's hand falls by the game's dice
    — hounding, a ban, the leader's arrest, exile — at a risk the regime,
    its laws and police, and the movement's own noise and friends decide.
  - Power is taken by an election (a legal party with a quarter of the
    country), a revolution (the street when the country boils over), a coup
    (friends in the army) or a call into government (friends inside). The
    engine checks the strength before it lets the game master say so; then
    the player's person leads the country, with their portrait, the
    movement's party rules, and the game turns back into governing.
- **Losing power is not the end.** A government that falls — by a coup, a
  revolution, or now also by losing an election (its party out of the
  government) — offers two ways on: stay with the country and play its next
  government, or stay with the leader who fell, into opposition after a lost
  vote or underground after a coup. A coup or a revolution makes the regime
  harsher for the movement until the game master describes the new one.
- **An interface for the opposition**: a panel with the person and the
  movement, its strength, the risk of repression, actions that add an order,
  and how close each road to power is; the header shows the player's person
  and the movement's standing. The cabinet, acts of state and letters to
  governments are hidden, and the economy, army, research and foreign
  panels can be read but not changed. Saves begin to keep the player's role
  by migration step 15; older games are the leader's, as they were.

### Fixed
- **A click in the app's first moment no longer turns off its updates.**
  Leaving the front page before it had finished loading stopped the start
  short of the update check, and a failed check said nothing anywhere.
### Changed
- **Ministers give their view, not a report**
  ([src/engine/reports.ts](src/engine/reports.ts)). After a turn a minister
  speaks one paragraph of 2–4 sentences in the first person — what they
  think of the period, in their own voice: a real historical minister as
  they really spoke, anyone else from their character, party, interests and
  loyalty. Only the three with most to say speak on their own (a question
  the government put to them, a task done or failed, news, work under way);
  the others stay quiet, their tasks still shown, and can be asked in the
  cabinet. A view runs to 700 characters at most and is cut at its last
  whole sentence rather than asked for again. The turn report and the
  cabinet show each view as a quote beside the minister's portrait. A turn now asks for three views at most instead
  of one report per ministry with anything to say, each from a shorter
  digest of the period: fewer requests and far fewer words on the player's
  plan.
- **Ministers and deputies advise; the orders are the player's.** No more
  ready-made orders under a minister's answer, view or a deputy's word,
  added to the turn with a click. They think a question through — what the
  government is after, what each course costs, what the other side will do,
  what could go wrong — weigh the options, say which they favour and may
  sketch a course or an operation, but the decision and its wording come
  from the player. Special operations are still proposed for approval.
- **The ministry's deputies are under "Ministry"** (Министерство,
  Міністерство), not "People".
- **Research by directions instead of projects**
  ([src/engine/research.ts](src/engine/research.ts),
  [src/engine/researchEffects.ts](src/engine/researchEffects.ts)). The
  research money is split in percent between seven directions: military
  technology, industry and energy, agriculture, medicine and health, science
  and education, communications and computing, and strategic programmes
  (the bomb, rockets, space).
  - The money is the same as before, with no new budget line: a fifth of
    the army budget and three tenths of industry's. It no longer comes out
    of the money for new weapons.
  - Each direction has reached a year of technology. At the game's starting
    split and its era's usual money it keeps history's pace. More of the
    money, a bigger budget, an able science minister, and science and
    education ahead of the world take it ahead. Neglect leaves it behind,
    where the world's published work still reaches it. The game's dice
    bring setbacks and lucky turns. Strategic programmes also need a big
    economy.
  - **Effects are continuous and modest.**
    - The military direction raises every kind of weapon the player builds
      to the level of the year it has reached, ahead of history or behind
      it, and opens drones early.
    - Industry adds growth and makes arms production more efficient.
    - Agriculture raises the harvest in the food provision.
    - Medicine raises the medicine provision and the population's growth.
    - Communications adds a little growth and knowledge of other countries
      under the fog of war.
    - Science and education speed up every other direction.
  - **Named breakthroughs** come when a direction passes the year history
    made them, so heavy investment brings them early and neglect late. There
    are 79 of them, from tanks and blood banks in 1915–17 to drone swarms and
    gene therapy around 2030; examples are radar, jet engines, antibiotics,
    transistors and computers, the green revolution, satellites, the
    internet, drones and precision munitions. Each is announced in the
    chronicle with how far ahead of history or behind it the country is,
    and with what the breakthrough brings.
  - **The bomb comes from an atomic programme.** The programme runs once
    nuclear fission is known and strategic programmes get at least 15% of
    the money, and a bigger economy runs it faster. A country that built
    the bomb within a generation of the start date begins with its
    programme funded.
  - **The science panel** shows the money and the pace, and the science
    minister's word on the split. For each direction it has a share stepper
    (the split always adds up to 100%) and the year of technology reached.
    It also shows the progress to the next breakthrough, when it is
    expected against history, and what the direction gives now. Then come
    the atomic programme and the breakthroughs made, with their dates.
  - **The game master** sees the split and the recent breakthroughs in a
    line or two. A directive to the science minister may shift the split by
    up to 15 points, within bounds, as `arms.research`. The stand-in game
    master answers such a directive by putting more into the direction
    furthest behind.
  - **Migration step 16** gives an old save the default split. Each
    direction goes as far ahead as the save's projects took it: a finished
    project that is still ahead of history counts up to its year, and an
    unfinished one by its progress. An unfinished bomb becomes the atomic
    programme. Finished projects are kept as breakthroughs.

## [1.0.3-beta] — 2026-10-20

A living world, and people in it. Since 1.0.2-beta:

- the countries that matter have aims, relations, memory and plans that
  grow over several turns — a war, a bloc, a peace — whether you act or
  not; a game is free history or historical, chosen at the start;
- fog of war: other countries' figures are what your government knows;
- leaders and ministers are people with oil portraits and interests of
  their own; ministers report after the turn, have deputies, and deputies
  can be turned against their chiefs; anyone can rise to lead;
- an army of tanks, aircraft, guns, ships, air defence and drones, and
  research with a minister of science;
- an economy whose books hold over fifty turns, and the people's provision;
- reading aloud and voice input; the app opens full screen; an offline
  demo game master in every copy, no account needed;
- resources on 1950, 1964 and 1999 follow real output; Turkey has its
  borders in 1914 and 1939.

### Added
- **Leaders and ministers have faces.** Every leader of the eight start dates
  and the key ministers of the main countries are painted in oil from
  photographs Wikimedia Commons gives a free licence (public domain, CC0,
  CC BY, CC BY-SA, OGL), living leaders too; whoever has no free photograph,
  and anyone the game brings in later, gets a shadow of their sex
  ([public/portraits](public/portraits), [scripts/portraits.mjs](scripts/portraits.mjs),
  `npm run portraits`). Each portrait keeps its photograph's licence, apart
  from the MIT code, and the About page lists every photographer.
  - The player's leader sits in the game's header (a click opens the
    country's card) and at the top of the cabinet; foreign leaders appear in
    the country card, the diplomacy panel and on the pick screen; ministers'
    portraits replace their initials.
  - **Anyone can lead.** A leader is a person now, read from the leader line
    ([src/engine/people.ts](src/engine/people.ts)): a name the portrait data
    knows, in English, Russian or Ukrainian, brings its portrait; anyone else
    comes with the shadow of the sex the game master gives, or a guess fixed
    for the name with women as rare as they were in power that year. A
    minister named head of state or of government leaves their old post and
    becomes the country's leader line; so does a deputy, who leaves the
    ministry's deputies with their portrait. Under a king who reigns the prime
    minister leads; in 1914 the ruling emperors still did.
  - Deputies have portraits too, or the shadow of their sex, in the
    ministry's people as in the cabinet.
  - Older saves read their leaders and dress their ministers by migration
    step 13, and again on every load, since an older build drops them.
- **Countries with intentions.** The governments that matter — the
  strongest, the largest economies, and any at war or planning — keep a
  foreign course, moved by the engine every turn with no model call
  ([src/engine/relations.ts](src/engine/relations.ts),
  [src/engine/intentions.ts](src/engine/intentions.ts)):
  - an appetite for force and how far it looks abroad; aims: land to win
    back, designs on a neighbour, countries it protects;
  - ties to the countries that matter to it: trust, tension, the threat it
    sees (strength, distance, hostility) and trade;
  - a memory of who attacked it, came to its aid, stood aside, left its
    bloc, sanctioned or paid it — the player's deeds included;
  - plans that take several turns — a war, entering a war, founding or
    joining a bloc, leaving one, seeking peace — growing from an incident
    through tension and a secret decision to preparation and action. A plan
    can fade (a compromise) or fail (allies refuse, protests at home, the
    other side is too strong, a new government). The dice are seeded, so a
    reload rolls nothing again.
- **Relations and alliances that answer each other.** A country attacked
  calls its allies and protectors to the war; one that enters calls its
  own, and every country facing a new enemy calls its friends. An ally that
  stands aside is remembered.
- **Politics that steer policy.** A lost election swings a government's
  appetite for force, a coup hardens it; a new government judges the plans
  it inherited, may seek peace or leave a bloc. Crises, war-weariness and a
  weak government turn a country inward.
- **The game master follows the plans.** It is told the stage each plan
  reaches; a war, a war entry or a military alliance or pact among other
  governments happens only when a plan reaches action, and one the answer
  leaves out the engine carries out itself. The player's own wars and
  alliances, secessions, and governments that agreed with the player that
  turn are free. Diplomats speak with their government's secret course in
  mind; the military, foreign and intelligence ministers see others' moves
  in the open.
- **Two modes, chosen when a game is created.** Free: from the start date
  the world goes its own way. Historical: the date's later history is
  planned for its date (Barbarossa, Pearl Harbor, Kargil…) and stays a
  strong tendency until the player's actions change the world. Both seed
  the crises under way on the start date and each government's claims
  ([src/engine/scenarios/intentions.ts](src/engine/scenarios/intentions.ts)).
- **The world's news follows plans**: an item opens on the story of its
  plan — the incident, the tension, the preparation, the war. Entering a
  war and joining a bloc are news too.
- **The country panel shows a foreign course**: appetite, aims, plans in
  the open with their stage, relations and what it remembers; on your own
  country, the plans aimed at you and how the powers see you.
- **An offline demo in every copy of the game.** Without a ChatGPT account
  the game no longer stops at the first turn: "End turn" and the game master
  chip in the header ask who plays the world — sign in with ChatGPT, or play
  the demo — and Settings → Game master has the same switch, remembered on
  this computer. In the demo a simple offline game master answers every
  turn, minister, letter, law, candidate and meeting
  ([src/server/mock.ts](src/server/mock.ts)); the chip reads "Demo" and a
  thin banner says so. Nothing reaches ChatGPT: each request carries the
  choice, every route reads it right after its local-only check
  ([src/server/demo.ts](src/server/demo.ts)), and no token is read. Signing
  in with ChatGPT turns the demo off. The Microsoft Store's testers asked
  for this (policy 10.3.1): they could not test without an account.
- **The people's provision.** How well people are supplied with food,
  energy and fuel, everyday goods, housing and medicine, each as a share of
  what they need and with what holds it up or pulls it down
  ([src/engine/provision.ts](src/engine/provision.ts)). The engine reads it
  off what the game already keeps:
  - food from the harvest of the land the country holds, and imports while
    they come in and can be paid for (and the player's grain contracts);
  - energy from its own coal, gas and oil, imports, and the stores while
    they last;
  - goods from what the army leaves, prices, imports, metals and the
    economy's growth;
  - housing and medicine from the war and the occupation and from what
    the budget spends on the people.
  At peace on any start date nobody is short; a war at home, a blockade, a
  war economy or austerity shows. Below 85% it is a warning and below 70% a
  crisis that keeps the player's people restless. Governments abroad lose
  support for it, and the game master is told it in a line.
- **The economy panel has five tabs:** the budget now opens with the debt,
  the interest it costs, the reserves, prices and jobs, and how they are
  linked; then trade, deals, the strategic resources and the people's
  provision.
- **Weapons, counted.** Every country has rifles, artillery, tanks, combat
  aircraft, warships, air defence and drones, each with a technology level
  from 1 (the Great War) to 6 (today)
  ([src/engine/arsenal.ts](src/engine/arsenal.ts)):
  - each kind only from the year it existed: no tanks before 1916, no
    drones before 1982;
  - the main powers of each start date begin with the counts of the day
    (Germany's 3,200 tanks in 1939, the 242 T-34s of North Korea in 1950,
    Russia's 3,300 and Ukraine's 900 tanks in 2022), the rest by their army
    and what it spends on each soldier;
  - the army budget buys new ones every month, a third of it in peace and
    half at war, at the prices of the day, slowed by a shortage of iron,
    coal, oil or bauxite; old ones retire, 3% a year;
  - a war wears them down by the fighting on the country's fronts and the
    balance of strength; the game master may report what a battle really
    cost and what was captured, within a turn of the hardest fighting;
  - arms bought by contract and arms given in kind arrive as weapons, the
    latter out of the giver's stores;
  - the game master sees each side's arms and the strength of each side in
    every war, and battles should reflect them.
- **Research, and a science minister.** A short list of projects: the next
  level of each kind of weapon before history brings it, rockets, the bomb,
  satellites, and civil ones (antibiotics, computers, the green revolution,
  automation, the internet, biotechnology, AI) that lift growth while the
  world catches up. The further ahead of history, the longer and dearer.
  Military research is paid from the army budget, civil from industry's;
  the science minister's competence sets the pace and the dice bring
  setbacks ([src/engine/research.ts](src/engine/research.ts)). The
  minister sits in the cabinet with interests of their own, answers
  questions, takes directives and reports after the turn; a directive can
  start or stop a project or tell industry what to build first.
- **Army and Science panels** in the game: the arsenal with its levels,
  what was built, received and lost last turn, two kinds to build first,
  the strength in each war; the projects under way and on offer, their
  funding, cost and time left. Older saves get weapons and an empty
  research list by migration step 12; the science post stays vacant until
  someone is appointed.
- **Deputies, and plots against their chiefs.** A ministry has one to three
  deputies besides its minister — a "People" tab in the minister's window
  ([src/engine/deputies.ts](src/engine/deputies.ts)):
  - the game master names them the first time the player asks after a
    ministry's people (one short request, never in the turn); the game's
    dice deal what the model is not trusted with — their ambition, their
    causes and how they stand with their own chief;
  - a deputy can be spoken to in private: they talk more frankly than their
    minister about how the ministry really works, and the minister never
    hears of it;
  - the government can sound a deputy out against their chief — to push
    the minister out, take the post, gather evidence or undermine a
    directive. The dice answer for the deputy, weighted by their ambition,
    their grudge or loyalty to their chief and to the leader: they join,
    name a price (the post, money, the leader's protection), decline, or
    tell their chief, who then knows the government tried;
  - a plot grows every turn and may leak, both by the dice before the turn
    is written; the game master is told how it fell and the engine applies
    it: the chief dismissed (and the deputy promoted if they were promised
    the post), the chief brought into line by evidence, the directive
    undone — or, exposed, an angrier, less loyal minister and a deputy
    thrown out or made an enemy;
  - a minister knows only what has leaked; the turn's game master sees the
    deputies and can name one to a post that falls empty;
  - older saves get empty lists by migration step 14.
- **The desktop app opens full screen.** F11 or Settings → Window switches
  to a window and back, and the next start remembers it. The header has a
  Quit button in the app, since a full-screen window has none.
- **Fog of war.** Other countries are shown as the player's government
  knows them ([src/engine/fog.ts](src/engine/fog.ts)):
  - how much it knows of a country is a score: free elections publish more
    than one-party states and juntas; an alliance, a pact or a small
    organisation shared with it, a shared border, letters from its
    government, an intelligence task or operation aimed at it and an able
    head of intelligence raise it; a war and sanctions lower it. The
    country card says how well it is known and why;
  - its GDP, growth, debt and soldiers are estimates: "≈" for a country
    known well, a range the truth lies in for the rest, wider the less is
    known, armies wider still. They hold still all turn and move with the
    next turn's reports;
  - what governments hide is a rumour or unknown: support and stability
    below a score of 35; the risk of a coup is a rumour from 35 and known
    with its figure from 60;
  - the game master and the ministers still see the truth, with a short
    note of what the player's government knows and how big its
    intelligence puts the enemy's armies, so the narrative does not let
    out what the government cannot know;
  - on for a new game (a box on the pick screen turns it off); a game begun
    before it keeps the true figures (migration step 8). The eye in the
    game's header turns it on and off.
- **Ministers have interests of their own.** Each cabinet minister pushes
  two causes of their portfolio (a balanced budget, a professional army,
  keeping out of other people's wars…), has an ambition from 1 to 5 and
  owes the post to a party in government. The game's dice deal them when
  someone takes a post, the same in a copy of the game; older saves get
  them by migration step 9 ([src/engine/interests.ts](src/engine/interests.ts)).
  They show in the minister's window and colour every answer and report:
  where the government tramples their causes they warn, object or — if
  their loyalty is 3 or less — threaten to resign. Their mood after the
  last report goes to the next turn's game master, who decides whether
  they follow through.
- **Reading aloud.** A speaker beside the turn's story, each ministry's
  report, ministers' and governments' answers, the speakers at a summit and
  each turn of the world's news reads them with the system's voices
  (`speechSynthesis`); pressed again, it stops. Settings → Voice: on or off,
  the voice, the speed, and reading each new turn as it arrives (off by
  default). Markdown, links and emoji are not read out; long text goes in
  sentence-sized pieces, since Chrome's online voices stop after about
  fifteen seconds. Where Windows has no Ukrainian voice, a Russian one reads
  Ukrainian, and the game says so once.
- **Voice input.** A microphone in the corner of the orders box, the
  questions to ministers and the state, their directives, letters, a
  summit's speech and the adviser beside it, bloc terms and agendas, and an
  appointment's wishes. On the site in Chrome, Edge and Safari it uses the
  browser's own speech service. The desktop app cannot: its Chromium has
  the API but no service behind it. There, and in browsers without it,
  Whisper (base, multilingual) recognises speech on the computer itself,
  after a one-time download of about 100 MB the player agrees to first
  (`public/voice/whisper-worker.js`). Its code comes from fixed versions on
  jsDelivr and is refused unless its SHA-384 matches; the model comes from
  a fixed revision. A browser whose service fails moves to Whisper too.
  Settings can turn the microphone off or delete the model. Sign in with
  ChatGPT cannot be used for this: OpenAI's preview limits leave the
  transcription API out.
- **The desktop app grants the game's page only what it uses:** the
  microphone (sound, never the camera), the clipboard and full screen;
  other pages and other permissions are refused.

### Changed
- Save migration step 10 gives older saves the courses, the historical mode
  (what the game master was told before) and the date's plans still to come.
- Turn prompts gain a dozen lines at most for the plans that matter.
- **The demo site can be found.** It no longer asks search engines to stay
  away, and it carries Google Search Console's verification tag; a copy of
  the game on someone's own computer still does.
- **The offline game master speaks plainly**, in the interface language:
  no "[mock]" marks or developer wording, a quiet period with a verdict for
  every order, a cabinet headed by the country's own leader, and parties and
  ministers with ordinary names. A rally about prices no longer grows into
  an uprising turn after turn. The site's demo gets the same texts.
- **The Store's keywords** are seven and name no other product (policy
  10.1.3): strategy, alternative history, grand strategy, geopolitics,
  sandbox, AI, history.
- **The screenshots show today's game, and can be taken again.** The ten
  pictures of the 1950 game on the demo's front page and in the README, and
  the Store's eight, are retaken from the game as it is now: no "Details"
  toggle, ministers with interests and a report after the turn, China under
  fog of war (its figures as Washington estimates them, a coup risk with no
  reliable information). The demo's front page shows the turn's chronicle
  beside the title, where a visitor sees it first. `scripts/screens.mjs`
  takes them all against a production build with the offline game master;
  the save it opens, `scripts/screens/1950-usa.json`, is played through the
  engine by `scripts/screens/make-save.ts` — the government and politics as
  the setup call starts them, every turn and minister's report through its
  schema and sanitizer — so it stays a save the game itself could have made.
  The three older pictures nothing used are gone.
- **Ministers report after the turn, each in their own window.** The turn's
  game master no longer writes the ministries' reports. It says in a few
  English words what each ministry has to report on and what became of its
  directives (`ministries`); the engine closes what is done or failed and
  keeps a brief per ministry in the chronicle. Once the turn is applied,
  every minister with directives, a question from the government during the
  turn, or news in their field writes their report in a request of their
  own, one after another in the background, from the settled turn, their
  portfolio and their interests. Each lands in the minister's window in the
  cabinet and in the turn's report as it comes; one that fails, or was
  still being written when the game closed, can be asked for again. The
  main answer gets shorter, so the turn comes back sooner; the report
  requests carry a short digest of the country and the period instead of
  the whole world, and every request of a turn begins with the same text,
  so the service can reuse it
  ([src/engine/reports.ts](src/engine/reports.ts),
  [src/app/api/game/report/route.ts](src/app/api/game/report/route.ts)).
  A report changes only what its sanitizer lets through: its text, the
  orders the minister suggests (one click to add) and the minister's mood.
- **No notes for developers on the player's screens.** Settings no longer
  says the sign-in needs `npm run dev` or why Claude is not offered, and the
  site's "Play for real" shows the download and the code, not the commands
  to build it.

### Fixed
- **A province's change in people counts from the start of the game.** On
  1950 and 1964, drawn on the 1994 map, the card compared today's people
  with the map's 1994 figure, so Liaoning showed "−52% since the start"
  on the first turn; it now compares with the people it began with.
- **The economy keeps its books over a long game.** Fifty quiet turns
  exposed what drifted with no cause; the engine now moves each figure by
  what causes it ([src/engine/economy.ts](src/engine/economy.ts)):
  - reserves: the trade in strategic resources still moves them, and the
    rest of the economy pulls them back towards the era's normal holdings,
    so Japan or Germany no longer ran dry in peace (and then paid crisis
    rates on their debt) while Saudi Arabia piled up reserves worth half its
    GDP;
  - inflation drifts back to a calm level unless a deficit, cut imports or a
    shortage hold it up: Indonesia's 110% of 1964 or Turkey's 70% of 2022 no
    longer last forever, and the printing of a deficit still keeps prices
    rising;
  - unemployment follows growth against the trend, and soldiers called up
    leave the workforce;
  - a call-up costs money: half of the army's budget follows the number of
    soldiers unless the game master sets the budget itself;
  - a blockade the game master reported fades once the country is at peace,
    never below the sanctions in force; before, a cut stayed for good;
  - sanctions also take away the exports the sanctioning countries bought
    (half of them sold elsewhere at a discount), and both lost exports and
    imports gone without slow growth;
  - governments abroad keep their books like most did: a deficit that does
    not raise their debt against GDP runs on, the rest is closed over a few
    years; a war is paid for first. The player's budget stays the player's;
  - money is kept to six significant figures: a small country's monthly
    growth used to be lost to rounding, so its GDP and budget froze;
  - a buyer short of reserves borrows what a trade deal costs instead of
    paying nothing.
  A campaign test plays three dates fifty turns each, a call-up, a blockade
  and sanctions, and checks the books stay within sane bounds
  ([tests/campaign-economy.test.ts](tests/campaign-economy.test.ts)).
- **Turkey has its borders in 1939 and 1914.** The 1938 map's source drew
  Turkey within the Sèvres lines of 1920: in 1939 its east was Soviet, the
  south-east from Hatay to Malatya French, and Smyrna Greek. Turkey now holds
  all its present land, Hatay included (it joined in June 1939), and Iran its
  part of Azerbaijan. In 1914 Constantinople and Eastern Thrace were
  Bulgarian; they are Ottoman again, as after the Second Balkan War.
- **The resources list scrolls.** A country with many resources ran the
  list off the screen; it now scrolls inside its drop-down. The "Details"
  toggle beside it is gone: the full accounts are on the player's own
  country card.
- **Resources on the three newer dates follow real output.** 1950, 1964 and
  1999 had only points drawn between the older dates, so in 1999 Qatar
  produced 135 bcm of gas instead of 20, Norway 243 instead of 48 and
  Bolivia 63 instead of 3, and Indonesia's tin in 1964 was five times too
  much. The curves now have checkpoints on these dates from the output of
  the year before, for the main producers of every resource; the older
  dates keep their figures. Where the leader went above 10 points (South
  Africa's gold in 1964, uranium in Katanga in 1950 and Saskatchewan in
  1999), the whole resource is scaled on that date, so the shares stay and
  10 is still the leading region.
- **Armies need a war and a way there.** An occupation or a contest the game
  master writes now needs a war between the side taking the land and its
  holder (one started or joined in the same answer counts); otherwise the
  engine drops it, for one province or a whole country. One province must
  also be within reach of that side, its co-belligerents or its allies: land
  they hold or fight in next to it, a strait, or a landing on a coast within
  2,000 km of a coast they hold — Normandy and Inchon stay possible, Hawaii
  from Tokyo does not; a movement with no land may still rise inside a
  province. Occupying a whole country with no foothold in it lands only
  where such a landing could. Annexing by treaty still goes anywhere
  ([src/engine/outcome.ts](src/engine/outcome.ts),
  [src/engine/provinces.ts](src/engine/provinces.ts)).
- **Land lost is counted in people.** Coup risk, support and stability
  abroad weigh each lost province by the people in it, so losing the
  capital shakes a government more than losing an empty province
  ([src/engine/abroad.ts](src/engine/abroad.ts)).
- **Election dates that decide the government.** Where the table had a
  vote that could not change the government, or a date that was not due,
  it now has the one that could:
  - France 1939: 1942, as the decrees of July 1939 extended the Chamber;
  - Chile 1939: the presidential election of 1944, every six years;
  - Colombia 1991 and Georgia 1999: the presidential elections of 1994 and
    2000;
  - Portugal 1914 votes every three years;
  - Iran 1999: the presidential election of 2001; Azerbaijan 1999: the
    presidential election of 2003; Moldova 2022: the parliamentary
    election of 2025, not the presidential one;
  - Turkey 2014: the general election of June 2015, not the presidential
    vote of 2014; Fiji 2014 holds its election of September 2014 and no
    longer stays a junta for good; Portugal 2022: autumn 2026, when the
    legislature elected in the snap vote of 2022 was due to end;
  - terms of the day: Chile's president six years from 1994, Turkey's
    parliament five in 1999, Latvia's Saeima three, Austria's parliament
    five from 2014;
  - real dates for Peru, Japan and Finland in 1939, and for Chile and
    Costa Rica in 1914.
- **Taiwan under the Kuomintang** is a one-party state in 1950 and 1964:
  the party holds the army, so a coup is all but ruled out.
- **A year between coups, whatever the turn.** The pause after an attempt
  is measured by the calendar, so leap years no longer shorten it, and
  monthly, quarterly and yearly turns give the same number of coups.
- **No coup risk where no coup can happen**: the country panel and the
  game master's list of shaky governments leave out countries with no
  land, movements without territory and governments abroad.
- **New leaders are asked for until they are named.** A government that
  fell keeps being listed for the game master until it names a leader,
  however the turn fell.
- **Countries born in play** get the kind of government the game master
  gives them; when it gives none, the description is read in Russian and
  Ukrainian too, not only in English.
- **A copy of a game keeps its dice.** A copy made to try another course
  no longer rerolls the world's elections and coups.

## [1.0.2-beta] — 2026-10-20

The world moves on its own. Since 1.0.1-beta:

- every country you do not play keeps its politics: support, stability,
  the next election and the risk of a coup;
- elections fall on their real dates and coups come with their risk, by
  the engine's seeded dice, whether you act or not;
- the chronicle has a second view, the world's news, and each item opens
  on its story.

### Added
- **Politics in every country, in brief.** The engine now keeps the politics
  of every country you do not play, with no model call
  ([src/engine/abroad.ts](src/engine/abroad.ts)):
  - how it is governed: free elections, managed elections, one-party rule,
    no contested vote, or military rule, for every country on each date
    ([src/engine/scenarios/regimes.ts](src/engine/scenarios/regimes.ts));
  - the government's support, which follows growth, prices, jobs,
    blockade, land lost, a war (a rally at first, weariness after) and the
    years in office;
  - stability, which follows support and the country's crises;
  - the next election that can change the government: the real date where
    it is known (about 350 of them across the eight dates), else a day in
    its term;
  - the risk of a coup, from the kind of government, stability, a slump,
    runaway inflation and lost land. A settled democracy, a one-party state
    or a country with almost no army is all but safe; a junta is not.
- **The world moves on its own.** Elections fall on their dates and coups
  come with their risk, decided by the engine's dice before the turn is
  written. The game master is told what happened and names the new leaders.
  The turn report lists each election and coup.
  - Left alone, the dates run close to history: about five coups a year in
    the 1960s and the 1990s, two or three in the 2010s and 2020s, and governments
    losing 40–50% of free elections.
  - The country panel shows support, stability, the next election and the
    risk of a coup, and how the government came to power.
- **World news.** The chronicle has a second view, "The world": what
  happened elsewhere, turn by turn, from the game master's events and the
  engine's changes (elections, coups, new leaders, wars, truces and peace,
  blocs, sanctions, land that changed hands)
  ([src/engine/news.ts](src/engine/news.ts)).
  - Filter by wars, politics, diplomacy or the economy.
  - An item opens on its story: everything before and after about the same
    country, war or bloc, with its date. From there, open the country.
  - Governments that keep power at elections fold into one line a turn.
  - Read from the chronicle, so games saved before it have their news too.
- **Seeded dice** ([src/engine/dice.ts](src/engine/dice.ts)). A roll is
  fixed by the game, the turn and what it is for, so playing a turn again or
  reloading the save before it never rerolls: a lost election stays lost.
  The server and the browser cast the same dice.

### Changed
- Saves go through migration step 7: every country but the player's gets
  its politics, with elections already past moved to their next date.

## [1.0.1-beta] — 2026-10-19

The Windows app and three more dates. Since 1.0.0-beta:

- the game installs on Windows, signs in with ChatGPT and Google there, and
  updates itself;
- Korea 1950, the Gulf of Tonkin 1964 and NATO against Yugoslavia 1999 join
  the five dates;
- a turn as a picture and a whole game as a timelapse;
- characters stay in the game and always lay out your own course;
- choosing a country side by side, with leaders in your language;
- a privacy policy and a way to report the game master's text.

### Added
- **The Windows app.** Gulf of Trump installs like any game, with no Node.js
  and no terminal ([desktop/README.md](desktop/README.md)):
  - It runs the game's own server on this computer and shows it in its own
    window.
  - Signing in with ChatGPT opens the system browser and comes back to the
    app, as OpenAI's guide for open-source apps describes. The tokens stay on
    this computer.
  - It updates itself from the public repository's releases. A release tag
    builds the installer on GitHub.
  - The installer asks what a player expects: the language (English,
    Russian or Ukrainian), the licence, whether to install for this user or
    for everyone, the folder, and whether to put shortcuts on the desktop
    and in the Start menu. At the end it offers to start the game. Its pages
    carry the emblem in the brand's black and orange.
  - Uninstalling asks whether to delete the saved games and the ChatGPT
    sign-in as well. They stay by default, so a reinstall brings them back.
    An update asks nothing and keeps the shortcuts as they are.
  - The installer from GitHub is not signed yet, so SmartScreen warns about
    it.
  - The site's "Play for real" section offers it first.
  - Google sign-in and cloud saves work in it too. Google's page opens in
    the system browser (Google refuses embedded browsers). The browser comes
    back to the game's own server, which passes the one-time code to the
    app's window, and the window finishes the sign-in. The code is accepted
    only for a sign-in the window started, and it is handed out once.
- **A package for the Microsoft Store** (`npm run desktop -- --store`,
  [docs/store.md](docs/store.md)). The Store signs and updates it, so Windows
  shows no warning and the publisher is the developer's own account:
  - It is the same app, except that it never checks GitHub for updates: the
    Store alone updates games.
  - Its tiles and logos are drawn from the emblem at build time. Its identity
    comes from Partner Center in `desktop/store.json`, and the build refuses
    to run without it.
- **A privacy policy** at `/privacy`, in three languages, linked from the
  front page and Settings. It covers what the game sends where: to OpenAI
  for turns, to Supabase for cloud saves, to GitHub for updates.
- **Reporting the game master's text.** A flag button in the game's header,
  in Settings and on the privacy page opens a public "AI text report" form.
  The Store asks this of apps with live generative AI.
- **The brand: black, white and orange.**
  - The accent is a deep orange from the new emblem (a spruce, an eagle and
    mountains at sunset), brighter in the dark theme.
  - The emblem is the favicon and the app icon, and sits beside the name on
    the front page. The version badge is orange.
- **Three new dates, eight in all.**
  - **25 June 1950, the Korean War.** The 38th parallel runs through three
    provinces, so the front starts inside them. Around it: the Soviet
    boycott of the Security Council, Mao's army facing Taiwan, the two
    Germanies, France and the Viet Minh in Indochina, and an Africa that is
    almost all colonies.
  - **2 August 1964, the Gulf of Tonkin.** Vietnam is divided at the 17th
    parallel; the Viet Cong hold shares of the South's provinces and the
    Pathet Lao the north-east of Laos. Also: Indonesia's confrontation with
    Malaysia, Khrushchev's last months, Southern Rhodesia, Portugal's
    colonial wars, and protests against the junta in Saigon.
  - **24 March 1999, NATO bombs Yugoslavia.** The KLA in Kosovo, Montenegro
    drifting away, an alliance of nineteen, and Primakov's U-turn over the
    Atlantic. Also: the Taliban against the Northern Alliance, the Second
    Congo War, Eritrea against Ethiopia, Chechnya and Abkhazia outside
    Moscow's and Tbilisi's control.
  - Each date has its own leaders, treaties and organisations with their
    terms, economy, city names (Stalingrad, Saigon, Léopoldville, Titograd)
    and capitals, flags of the day, and first-turn ideas in the tour.
  - **People on the start date.** The new dates use the 1994 map, so a
    scenario can now give the population of its own year by country (UN
    estimates); the provinces share it out, and economies start from it.
- **A turn as a picture.** "Picture" in the chronicle and in the turn report
  draws the map as the turn left it, centred on what changed, with the
  turn's moves, its headline, its dates and the country played.
  - 1600×900 PNG: save it, copy it, or hand it to the system's share sheet
    where the browser has one.
  - Drawn in the browser in the light theme's colours, so a picture looks
    the same whoever made it; nothing is uploaded.
- **The game as a timelapse.** "Timelapse" in the chronicle plays the whole
  game on one map: the start, then every turn with its moves and headline.
  - Scrub to any turn, play at three speeds.
  - Save it as a video the browser records itself (MP4 or WebM), in real
    time, so the tab has to stay in front.
- **Every turn keeps the borders it changed** (`borders` in a chronicle
  entry: how those provinces stood before it), so the map of any past turn
  can be drawn again exactly. Turns played before this keep only their list
  of changes, from which the timelapse draws them close but not exact; it
  says so.
- **An interface smoke test** ([scripts/smoke.mjs](scripts/smoke.mjs)),
  run in CI on the production build with the offline game master: a game
  started, a turn played, every panel and dialog opened, the game at phone
  size; any error on the page fails it. It plays a turn on every date.
- **How it plays, on the demo's front page.** Ten mechanics, each with an
  English screenshot of one 1950 game as the United States (in
  `public/screens/1950`): orders, the turn's chronicle, ministers, politics,
  the economy, wars and blocs, acts of state, the six map modes, a turn as
  a picture and the timelapse. The texts are in all three languages; the
  README shows the same screenshots.

### Changed
- **Choosing a country.** The list is on the left, the chosen country on
  the right, and the button to start sits at the foot of the briefing, under
  the map:
  - On a wide screen the page stays put and each column scrolls on its own.
    On narrower screens the country moves under the map. On phones the list
    comes before it.
  - The country's card keeps what matters for the choice: the leader, the
    economy and budget, provinces, people, wars, alliances and pacts. Trade,
    resources and organisations wait for the game.
- **Leaders in your language.** Every leader of every date reads in Russian
  and Ukrainian too ("Фюрер Адольф Гитлер", "Прем'єр Кім Ір Сен"). The game
  master still gets them in English. A test makes sure a new date names its
  leaders in all three languages.
- **Alliances and pacts apart.** A country's card lists its military
  alliances, its pacts and, in the game, its organisations separately.
- **Settings without cloud saves** no longer show the developer's note about
  Supabase: the account section is simply absent.
- **Characters stay in the game.**
  - The game master, ministers, the chief of staff and foreign governments
    play harsh orders as history did: arrests, executions, purges,
    deportations, wars. None of them refuses on the model's own account or
    lectures. A character may still object, drag their feet, resign or
    betray inside the world, as their loyalty allows. Violence is written
    like a report, without graphic detail.
  - A minister carries out an order in their field and says how.
- **Your own course is always on the table.** When a minister advises against
  what you want, one of the suggested orders is still the best way to do it.
  The chief of staff drafts an act you insist on all the same.
- **Long answers open at their first line.** In every conversation, a reply
  taller than the window starts at the top instead of the bottom.
- **The site is always a demo on Vercel.** A build there turns demo mode on by
  itself, so a forgotten variable can no longer leave every turn refused.
- **Fronts and violent protests keep their red** (a `war` colour of their
  own), apart from the new orange accent.
- **OpenAI's terms in the docs.** Sign in with ChatGPT keeps tokens and
  requests on the player's own machine, so a hosted copy cannot play on
  players' plans. The docs, the front page and the roadmap say so.
- **The roadmap is rebuilt:**
  1. turns that are cheaper and proven by campaign tests;
  2. a living world, where countries have intentions, relations, crises in
     stages and politics of their own;
  3. a desktop app.

- **Saves upgrade through numbered migrations**
  ([src/engine/migrations.ts](src/engine/migrations.ts)). A save records
  the last one it has been through (`migration`); the rest run once, in
  order, when the game opens, and those that need the map wait for it. The
  upgrades that used to run on every load are the first six steps: politics,
  bloc kinds, false defeats, fronts past half, provinces, the economy. What
  the game ships as data (the palette, world bodies, treaties) is still
  picked up on every load. A new game starts at the latest step.
- **Supabase loads only when cloud saves are configured.** Without its two
  variables (the demo, most local copies) the pages no longer carry its
  code: 235 KB less script on the front page (1,360 KB
  instead of 1,595, uncompressed). With them, it loads on the pages that
  sign in or sync saves.

### Fixed
- **Cloud saves of the 2014 scenario** were refused by the database, whose
  first schema knew only 1914, 1939, 1991 and 2022. A new migration lets in
  2014 and the three new dates, and a test keeps the database's list in step
  with the game's scenarios.

## [1.0.0-beta] — 2026-10-19 (the first public beta)

The first version published in the open, with a demo site for testers. Since
0.2.0 the game has gained:

- acts of state drafted in conversation;
- special operations planned with ministers;
- the 2014 Maidan as a fifth date;
- laws and symbols of the state;
- money that changes hands;
- the loyalty of the army, police, security services and elites;
- crises that bite;
- the treaties and organisations of every date;
- resources in real amounts, near each country's real figures.

For new players there is a first-run tour, and saves live in IndexedDB.

### Added
- **A first-run tour.** Seven short steps on the first game: the map, the
  orders, the turn, the cabinet, the state and diplomacy. It ends with three
  ideas for a first turn on the chosen date, each one click into the orders.
  Skip it at any step; Settings can show it again.
- **The public demo.** Built with `NEXT_PUBLIC_GOT_DEMO=1` for the site
  testers open ([docs/deploy.md](docs/deploy.md)):
  - every request is answered by the offline game master, so it costs nobody
    a plan;
  - ChatGPT sign-in is off;
  - a strip under the header says it is a demo;
  - the front page shows screenshots and how to play for real on your own
    computer.
- **Bug and idea forms** on GitHub, in English and Russian, asking for the
  date, the country, the turn and the save file.
- **The roadmap** ([ROADMAP.md](ROADMAP.md)): what comes next, in order,
  without dates.
- **The laws of the state.**
  - **The list.** Ten laws every country has an answer to: conscription,
    emergency rule, the press, assembly, elections, the economy, the state
    language, alignment, the death penalty and leaving the country.
  - **Who sets them.** The game master gives them for the date and changes
    them when a vote or a decree does, and must respect them in play.
  - **The call-up law** decides the reserve: a volunteer army draws on half
    the usual pool, universal service on half again more, martial law on
    more still.
- **The State tab** on the left rail, for the laws and symbols of the
  country, changed in conversation rather than picked from a list.
  - **Talk.** Tell the chief of staff what to rename, recolour or enact, and
    why. They answer in character and draft each act:
    - a new name for the country or a city, translated into Russian,
      Ukrainian and English;
    - a new colour on the world's maps, declared at the UN;
    - a law or a decree: its text, which laws in force it changes and the
      vote it needs (a majority, two thirds for the constitution, or the
      leader's signature where the regime allows decrees).
  - **The reaction.** Every draft says how the country will take it, from
    support to outrage, judged on the reasons given: an act with a public
    case passes quietly, one made on a whim stirs anger. The reaction moves
    unrest when the act takes effect.
  - **One click** proclaims a draft or puts it before parliament. A
    proclamation takes effect when the turn ends; a bill waits for the game
    master's verdict, passed or failed with the reason, and lapses after
    three turns without a vote. A passed act changes the laws it names.
  - **Laws** lists the ten laws with what each means, the scale of its
    options and what is before parliament.
  - **Acts** lists what waits for the end of the turn (withdrawable), what
    was passed or failed, and what was proclaimed before.
  - A proclamation is told to the game master so the people, the neighbours
    and the UN react, and then shows on the map, in the header and in the
    chronicle. A colour the player chose survives reloading the save.
- **Treaties and organisations of each date,** with what each one binds its
  members to, readable in Foreign policy and known to the game master.
  - **2022 and 2014:** the OSCE, the Council of Europe, the CIS, the SCO,
    BRICS, the G7 (the G8 in 2014), the G20, OPEC, the Budapest Memorandum,
    New START, the Montreux Convention, the US alliances with Japan and
    South Korea, ANZUS, China's treaty with North Korea, GUAM, the Arab
    League, the Gulf Cooperation Council, the African Union, ASEAN,
    Mercosur and North American free trade.
    - In 2014 also the Kharkiv Pact (the Black Sea Fleet in Crimea to
      2042), the Ukraine–Russia Friendship Treaty, the Moscow deal of
      December 2013 and the INF Treaty.
    - In 2022 also the Eurasian Economic Union, AUKUS, the Quad, the
      Sino-Russian treaty, the Shusha Declaration and the Lublin Triangle.
  - **1991:** the CSCE, the Western European Union, the Council of Europe,
    the Visegrád Group, the Two Plus Four Treaty, CFE, INF, START I, the
    Indo-Soviet treaty, EFTA, the OAU and others.
  - **1939:** the Anti-Comintern Pact, the Franco-Polish and Polish–Romanian
    alliances, the Franco-Soviet treaty, the Balkan and Baltic Ententes,
    the Saadabad Pact, Britain's treaties with Egypt and Iraq, Montreux,
    the German–Soviet credit agreement and more.
  - **1914:** the Franco-Russian Alliance, the Entente Cordiale, the
    Anglo-Russian Convention, the Treaty of London of 1839, the Dual
    Alliance, Romania's secret alliance, the Treaty of Bucharest and more.
  - **The blocs that were already there** have their terms too: NATO's
    Article 5, the Molotov–Ribbentrop protocol, the Pact of Steel.
  - A save not yet played gets the new treaties; any save gets the terms.
  - **Foreign policy** shows your country's blocs first, the whole world's
    on request, filtered by kind.
- **A fifth date: 16 January 2014, Euromaidan.**
  - **The start.** The eighth week of the Maidan, on the day parliament
    passes the "dictatorship laws".
    - The protest is already on the map: 200,000 at weekends, in Kyiv and
      the west, organised and with 45% support.
    - Yanukovych's police are loyal, the army wavers, the security services
      are penetrated and the oligarchs wait.
    - Russia's $15bn loan, the EU and US envoys, Crimea still Ukrainian,
      NATO and the EU of 2014, and the Eurasian Customs Union.
  - **Who to play.** Play Yanukovych, the West, Russia or the neighbours.
  - **On the map**, cities have their 2014 names (Dnipropetrovsk,
    Kirovohrad).
- **Money that changes hands arrives.** When the game master writes that a
  government, a bloc or the IMF pays — a grant, a loan, aid, reparations, a
  bribe, arms in kind — it goes in a new `funds` field.
  - The engine credits the receiver's reserves (and its debt, for a loan)
    and charges the giver, who borrows what its reserves cannot cover.
  - The amounts are checked against both economies, and the turn report
    names every transfer.
- **The pillars of power.**
  - **Loyalty.** The army, the police, the security services and the elites
    each have a loyalty from 0 to 100 that moves at most 15 points a turn.
  - **Below 40** orders to use force may be refused; **below 25** they
    defect.
  - **A government falls** only when it is weak: high unrest, an uprising,
    ready plotters, or forces that defect during riots. With the army and
    police loyal, only a coup from inside can bring it down.
  - **On screen.** Wavering pillars are crises in the top bar, and the
    Threats tab shows them as bars with their change.
- **Protests worth the name.**
  - **What they have:** public support, an organisation, a foreign sponsor
    and their dead.
  - **How they move:** they climb at most one stage a turn, and a crowd
    cannot grow more than fourfold in one.
  - **Anywhere.** They can rise against any government, not only yours.
  - **At home, eleven measures,** each with what it gives and what it
    risks: concede, talk, disperse, the army, arrests, a counter-rally,
    a curfew, smears on television, early elections, posts for the
    leaders, an amnesty. The risk of force follows the loyalty of whoever
    has to use it.
  - **Abroad:** condemn the crackdown or help the government crush them in
    the open. Covert help — money, organisers, the media — and stirring up
    protests in any country are planned with the head of intelligence:
    one button opens the cabinet with the question ready.
  - **New measures** in the catalogue: a pay rise for the army and police,
    and a deal with the elites.
- **Crises that matter.**
  - **The alarms.** The engine flags dangerous numbers as a warning or
    critical:
    - debt, deficit, inflation, unemployment, a shrinking economy, low
      reserves while something drains them;
    - shortages, an exhausted call-up pool, sanctions, occupation;
    - unrest, riots or an uprising, a strong plot, a government without a
      majority.
  - **The engine makes them bite:**
    - debt carries interest that rises past 90% of GDP (a trusted borrower
      with big reserves and steady prices pays far less);
    - what the reserves cannot cover is borrowed;
    - a shortage, hyperinflation or a debt crisis caps growth;
    - printing a deficit keeps prices rising;
    - unrest cannot fall below what hardship explains.
  - **The game master** sees the player's crises and the critical ones of
    other countries. The rules require consequences for each, in
    proportion. An order that ignores a critical crisis partly fails, and
    one that addresses it helps at a price. Ministers raise the crises in
    their field unasked.
  - **In the top bar,** a chip shows how many crises there are, red when one
    is critical. Its list says what each one leads to.

### Changed
- **Saves live in IndexedDB.** The browser keeps hundreds of games instead of
  about ten. Games saved in localStorage move over by themselves on the
  first load; a browser that refuses IndexedDB keeps using localStorage.
- **Special operations are planned in conversation.** Ask the head of
  intelligence, the general staff or the interior minister for a coup or
  protests abroad, sabotage, a raid or an arrest. The minister drafts the
  operation (target, goal, means, timing, secrecy) with its risks, and one
  click approves it as a standing directive. This replaces the form.
- **Resources in real amounts.** The resources shelf and the economy panel
  count each resource in tonnes or cubic metres a year:
  - what the country digs and uses;
  - what it sells or buys abroad, and for how much;
  - its store against the size of its stores, and how long it lasts when
    imports are cut.

  The game's points are scaled so the world's output matches the real
  figure for the start year. Contracts count their volumes the same way, so
  a deal and the surplus it comes from read in the same tonnes. The game
  master sees the real amounts beside the points.
- **Each country's resources near its real figures**, not only the world's.
  On every start date the main producers now dig within about 40% of their
  real output: Ukraine about 85 Mt of coal in 2014 (it showed 270),
  Saudi Arabia about 515 Mt of oil in 2022, Norway about 114 bcm of gas.
  - **Output.** A province's points are a square root of its output; the
    engine now squares them back, so small producers no longer swell. The
    points of every field on the five start dates follow real statistics
    (USGS, BP, historical yearbooks), and the big producers the map lacked
    are on it: Shaanxi's and Xinjiang's coal, Indonesian and Philippine
    nickel, Côte d'Ivoire's rubber, Mali's and Tanzania's gold and more.
  - **Use.** A country's need grows with its people as well as its income,
    so poor countries burn what they really burn (Ukraine about 75 Mt of
    coal and 45 bcm of gas in 2014, up from 16 Mt of coal). Coal, gas and,
    less, oil are partly used where they are dug, so China burns its own
    coal and Russia its gas. A short table covers the countries that lean
    harder or lighter on a resource (China's metals, Korea's industry), and
    only countries with reactors need uranium. An occupied coalfield leaves
    its owner short; the need stays with the owner.
  - **Prices.** The world market of each resource is worth its output at
    the prices of the day: uranium, bauxite and tin had been several times
    too dear, and every metal two to three times before 1991.
  - **Deals** in 1914 and 1939 trade in the millions of the day: the
    smallest contract shrinks with the era, so the Ruhr's coal still finds
    buyers.
  - **The game master** sees each country's resources in real amounts too.
- **Detail grows with zoom.** At the whole-world view the map shows no front
  lines and no province borders. Fronts appear first as you zoom in, then
  province borders.
- **The selected province** is outlined dark on a light halo, no longer in
  the front's red.

### Fixed
- **A province cut by a historical border counted its mines on every
  part.** Lorraine's iron, Upper Silesia's coal and the Jiu valley's in
  1914 now go to the side they lay on, and Oman's oil no longer reappears
  in the Emirates.
- **Islands and enclaves had the wrong owner.** The map sources draw many
  with a neighbour; now they have their real owners on every date:
  - New Caledonia is French, with its nickel, and the Riau Islands Dutch,
    then Indonesian, with Bintan's bauxite and Natuna's gas;
  - Singapore and the Solomon Islands are countries of their own from 1991,
    and Singapore is in ASEAN;
  - Réunion, Mayotte, Ceuta, Melilla, Madeira, the Azores, the Andaman
    Islands, Lesbos and Chios, Saaremaa, Pemba, the Chatham and Kermadec
    Islands, Macquarie, Bouvet, Annobón, San Andrés, Kinmen and Matsu,
    Perlis, Temburong and Rason are no longer their neighbours';
  - Kuwait is British in 1939, not Iraqi, and the Lachin corridor is
    Azerbaijan's in 2022.
- **Trade deals could be signed without end.** After a signature the market
  offered the same good from the next partner, as if nothing were
  contracted, and arms came back after every purchase. Now:
  - offers count what is already under contract on both sides;
  - a government makes at most three new contracts a turn;
  - arms from abroad stay within 4% of GDP a year;
  - only an offer the market has right now can be signed;
  - a proposal is cut to what the country can deliver.

  The Deals tab shows the contracts left, what is under contract and what
  can still be contracted.

## [0.2.0] — 2026-10-18 (beta)

The first beta. The game is a sandbox: no goals and no victory screen; the
player makes their own plan and the game gives them the mechanics. Since the
alpha it has gained a map of provinces with fronts between towns, an
economy with trade and deals, a government of people, domestic politics
with a parliament, and foreign policy with blocs and live summits. Every
date was played through on the mock game master before the release.

### Added
- **The About page** describes what is in the game, with the author's photo,
  and its rules match the game as it is now. The roadmap is gone from the
  page and the README.
- **Parliament, seat by seat.**
  - **The house.** The game master gives its name, size, threshold and every
    party's seats on the date, with each party's colour and press abbreviation.
  - **The panel** draws it as a hemicycle with one wedge per faction, a
    majority line and the government's seats against it.
  - **Elections** share the seats out by the D'Hondt method when the model
    gives only the vote.
  - **The game master** sees who holds a majority. A government without one
    has to bargain for its laws, and seats move with defections, bans and
    dissolutions.
- **A catalogue of moves at home**, each with what it gives, what it risks
  and, for a vote, the seats it needs against the seats the government has:
  - **Laws and parliament:** bills, the constitution, a confidence vote,
    calling, postponing or dissolving.
  - **People and press:** addresses, propaganda, referendums, welfare,
    anti-corruption, press freedom or censorship, amnesty.
  - **Force and order:** a state of emergency, the security services, purges.
  - **Party cards** open into what can be done with that party: a coalition,
    a deal, poaching deputies, discrediting, arresting the leader, a ban,
    secret talks with the underground.
- **Trade deals.**
  - **The market's offers.** Each turn the market makes offers built from
    what the country really has: grain from its farmland, oil, gas, coal,
    metals and uranium from its fields, sold to the countries short of them.
    It also offers what the country lacks, and arms from the big makers who
    are not on the enemy's side while it fights.
  - **The terms.** Each offer comes with a volume (millions of tonnes,
    barrels, bcm), a price against the market and a term. Sign or decline
    at once.
  - **Your own proposals.** The partner answers during the turn.
  - **A signed deal** moves hard currency every turn, refills the stores of a
    resource bought and shows in the trade books. A war or full sanctions
    break it.
- **The economy panel** has tabs: budget, trade, deals.
- **Managing saved games.** Every save can be renamed, copied (to try
  another course from the same point), downloaded as a file or deleted from
  its menu. The list has search, a filter by date, sorting (recent, furthest,
  by name), each country's flag and when it was last played. A save file can
  be dropped onto the list to bring it in. A game's own name shows in its
  header.
- **The front page** opens with the last game, ready to continue; each date
  shows the flags of its main countries.
- **Fronts run between towns.**
  - **On the map.** A contested province is divided among its towns, each
    taking the land nearest to it. The towns the attacker holds are painted
    solid in its colour, with no more stripes over the whole province. The
    red front runs between the towns each side holds, and no longer along
    the old border where the attacker is already inside.
  - **2022** starts on the real line of contact: the DPR and LNR hold
    Donetsk, Makiivka, Horlivka, Luhansk, Alchevsk and the rest; Ukraine
    holds Mariupol, Kramatorsk, Sloviansk, Avdiivka, Popasna and the others.
  - **The game master** sees each contested province's towns, each side's
    listed apart, and names those that change hands. Any of a town's names
    is accepted, and unknown ones are dropped.
  - **Given only a share,** the engine moves the towns itself: the attacker
    takes those nearest the towns it already holds and gives up its
    farthest forward first.

- **The front moves through a province by shares.**
  - **The data.** A contested province records how much of it the attacking
    side holds; Donetsk and Luhansk start 2022 at about a third.
  - **The model** moves the share by what the fighting gained or lost: a few
    points for trench fighting, tens for a breakthrough. A province changes
    hands only when it really falls.
  - **The map** draws the stripes as wide as the share.
  - **The report** says "Brest: Ukraine holds 46% (+16)".
  - **Arrows** show every move of a front, the holder pushing back included.
- **"Turn N: what changed"** in the map legend brings the turn's changes into
  view.
- **The government is made of people.**
  - **Who.** The game master names them for the country and date: the head
    of state and of government, the leader's chief of staff, the ministers,
    the head of intelligence and the central banker.
  - **What each has.** A title, traits, a manner of speaking, ability and
    loyalty from 1 to 5, a faction.
  - **Ministers in the cabinet** speak in their own name and character and
    name their colleagues.
  - **The chief of staff** joins the cabinet as a sixth adviser.
  - **The roster** in the cabinet's "Government" view lists everyone, with a
    "replace" button on each.
- **Appointments.**
  - **The dialog.** It proposes candidates, each with traits, ability,
    loyalty and the pros and cons of appointing them. You can also name
    anyone you like, and talk the choice over with a minister first.
  - **Taking effect.** The appointment takes effect at once; the next turn's
    game master judges what it brings.
  - **Events.** Turns can also remove people from the government:
    resignations, deaths, arrests, flight.
- **Meetings held in person.**
  - **Starting one.** Call a session of any organisation you belong to, or
    attend a planned summit before the turn ends.
  - **Speaking.** You write your own statements and the other participants
    answer in character.
  - **"A word in your ear".** Beside the meeting, a minister — the chief of
    staff by default — can be asked quietly what is going on.
  - **Ending it** sums up what was agreed, and the next turn has to honour
    it.
- **The United Nations and the League of Nations.** The League of Nations in
  1939, with its members on 1 September; the UN in 1991 and 2022, with
  everyone who held a seat. Older saves get them when opened.
- **Trade and economy.**
  - **Trade between countries.** Who trades with whom follows the size of the
    economies, the distance between them, wars, blocs and sanctions; the
    main buyers and suppliers are shown with their flags.
  - **Sanctions.** You impose and lift your own at once; governments do so in
    turns. Sanctions cut the target's imports by the share that came from
    those who impose them.
  - **Trade agreements** are a new kind of bloc.
  - **The "Economy" panel.**
    - A budget you set yourself, with the deficit shown as you type.
    - Trade partners, and sanctions both ways.
    - Economic decisions as one-click orders: war economy, nationalisation,
      rationing, war bonds, devaluation, austerity, foreign investment.
- **Flags.**
  - **Where.** On the header, the country card, diplomacy, blocs and wars,
    summits and the pick screen.
  - **Which.** Today's flags for countries that exist; flags drawn in the
    game for those that no longer do or whose flag changed (the USSR,
    Austria-Hungary, the Ottoman Empire, Yugoslavia, the German tricolour of
    1914 and 1939, the Republic of China in 1914…).
- **Conversations stay on the latest message.** The cabinet, diplomacy,
  appointment and meeting chats scroll to the newest reply by themselves.
- **The map shows what happened in a turn.**
  - **Front lines.** They run between sides at war, dashed while a truce
    holds.
  - **Highlighted provinces.** Provinces that changed hands this turn are
    highlighted in the new holder's colour. The highlight flashes when the
    game opens and when the report closes.
  - **Arrows.** Each push gets one, from the land beside it; a landing gets a
    dashed one from the nearest province.
  - **"Show on the map".** It is in the turn report and on every chronicle
    entry, and brings the changes into view.
  - **The camera.** The game opens on the player's country.
  - **Layers.** Fronts and changes are layers that can be switched off.
- **People move with the game.**
  - **Natural growth.** Every province's population grows at its country's
    historical pace for the era (from the population table: fast in Africa,
    flat in Europe, falling in Russia and Ukraine after 1991).
  - **Fighting.** Fighting inside a province drives people out.
  - **Losses reported by the game master.** It reports each country's dead
    (war, famine, epidemics, repression) and refugees, with where they fled.
    The engine limits the losses and lays them heaviest on the front.
  - **What population drives.** It now sets the call-up limit, the economy,
    the population map mode, the province card (with the change since the
    start) and the turn report.
- **GDP follows land and people.**
  - **Annexation.** An annexed province takes its output to the new owner.
  - **Occupation.** It leaves a part to the owner and gives a part to the
    occupier.
  - **Losses.** People lost to war or flight take their share.
  - **Taxes** follow GDP.
- **Exile, protests and the fall of a government.**
  - **Exile.**
    - A government that loses all its land goes into exile with an ally.
    - Its war goes on.
    - It returns when it frees a province.
  - **Protests.**
    - Rallies grow into strikes, riots and an uprising, in named provinces.
    - They are marked on the map and listed under "The street" in the
      politics panel, with orders to concede, talk, disperse or send in the
      army.
  - **The fall.** The game is lost only when the government is overthrown,
    and the engine allows that only for a weak government (low stability,
    high unrest, an uprising, or a strong coup plot). The player can play on
    as the new rulers.
- **Audits.** Two audits of the game: the whole game (design, player,
  developer, product, graphics, performance) and what it lacks for realism.
- **Govern through ministries.** The cabinet is now five ministries — the
  general staff, economy and finance, foreign affairs, the interior (police,
  parties, elections, the press) and intelligence. For each:
  - talk to the minister;
  - give the ministry standing **directives** ("raise the grain harvest by a
    fifth"), in force every turn until done or failed;
  - in the general staff, the interior and intelligence, plan a **special
    operation** in detail: codename, target, goal, forces and means, timing,
    secrecy.

  Every turn ends with the general summary and **a report from each
  ministry** on its directives (under way, done, failed); a minister answers
  questions knowing his directives and last report.
- **Domestic politics** (roadmap step 4, first part). A Politics panel on
  the left rail. The game master first describes your country on its date:
  the regime, 3–8 parties and movements (banned and underground ones too),
  their leaders, support and place on three axes — economy left–right,
  authoritarian–liberal, open–nationalist — the next election and current
  plots. Every turn moves it:
  - support shifts with events; ideas drift slowly (at most 3 points per axis
    a turn), drawn as arrows on a map of where the parties stand;
  - new parties and figures rise (a splinter, a protest movement, a second
    Navalny), others dissolve;
  - elections are held on their date — the opposition can win, a rigged or
    cancelled vote costs legitimacy;
  - unrest follows hardship, repression and war;
  - plots grow in secret until they are found out, foiled, fade or succeed.

  Back, campaign for, suppress, ban or legalise a party, call an election or
  move against a plot from the panel: each becomes an order for the turn.
- **Foreign policy** (roadmap step 3, first part). A Foreign Policy panel on
  the left rail:
  - wars with their truces and the date each truce runs to (a truce that
    runs out ends by itself and the war resumes);
  - alliances, pacts and organisations, each with its members, terms and the
    date its term ends;
  - **invitations**: found a bloc yourself, invite governments, and each
    answers by its own interests with the next turn;
  - **summits**: propose talks with a place, a date, participants and an
    agenda, or watch the world plan its own; when the date comes, a window
    opens with the record of the talks — each leader speaking in turn — and
    the outcome, and whatever was agreed lands in truces, blocs and borders.
- **A bolder game master**: history is a tendency, not a script — a plan
  backed by enough soldiers, money and surprise can succeed where real
  history never tried, and the same well-resourced effort no longer fails
  turn after turn without a reason. Rivals work against you beyond the
  battlefield (spies, sabotage, propaganda, funding the opposition), and at
  home a weak or overreaching government meets protests, strikes and plots.
- **A new game screen.** A rail on the left opens Orders, the Chronicle or
  the Cabinet in a panel beside the map; the right side keeps the selected
  country and diplomacy (on narrower screens an open panel takes its place,
  on a phone one panel at a time sits under the map). Along the top, the
  state of the nation — GDP and growth, the budget, debt, reserves,
  inflation, soldiers and every strategic resource produced against need —
  unfolds into the full accounts.
- **Cities only as you zoom in, every town at the closest zoom**: the world
  view shows the countries alone, capitals come at 1.8×, and from 10× every
  place that fits keeps its dot even where its name does not. Dots grow with
  a place's size, and names, dots and markers keep their size in pixels
  however wide the map is.
- **Fronts inside a province.** A side can now hold part of a province — a
  bridgehead, a city, a stretch of the front — shown as stripes in its colour
  and listed on the war's front; taking the rest occupies it, and the holder
  can push the attackers back out. The game master is told that every claim
  in the story ("Lyman retaken") must move the map. On 24 February 2022 the
  front already runs through Donetsk and Luhansk.
- **Standing orders.** Pin an order and it goes into every turn until you
  unpin it ("keep asking the allies for aid"); a button repeats last turn's
  orders.
- **A cabinet you can question.** A new Cabinet tab with four ministers —
  the chief of the general staff, the minister of finance, the foreign
  minister and the head of intelligence — each with his own field and voice.
  They answer from the world as it stands on the date (the economy and your
  drafted orders included), say when an idea is bad, and suggest up to three
  orders you add to the turn with one click. Asking takes no game time and
  changes nothing in the world; conversations are kept in the save.
- **An economy for every country.** GDP and growth, a budget (revenue;
  army, industry, social and other spending), deficits that add to public
  debt, reserves, inflation, unemployment, soldiers under arms and how many
  more can be called up, and the strategic resources each country produces
  against what its economy needs — the surplus exported, the gap imported,
  and when a blockade or sanctions cut the imports, the stores run down to a
  shortage. Starting figures come from each province's income and population
  scaled back to the date, with hand-set figures for the main countries
  (Germany in 1939: $43 bn, 2.7 million soldiers, oil 0.8 against a need of
  10). The game master proposes economic changes every turn — taxes,
  spending, mobilisation, loans, trade cut off — and the engine limits them
  and keeps the books. The country card shows the economy, in full for your
  own country; the turn report shows what changed.
- **A world of provinces.** About 2,700 provinces instead of one region per
  country, cut along each era's historical borders: Poland in 1914 falls into
  its Russian, German and Austrian parts, the 1939 partition can be fought
  province by province, a war's front moves on the map. Each province has a
  terrain (plains, forest, hills, mountains, desert, tundra, jungle, wetlands),
  a fertility, an area, a coast flag and its largest city; names in Russian and
  Ukrainian. The map has political, terrain and fertility modes, and a click
  opens a province card.
- **Cities, rivers and resources on the map.** Cities with the names they had
  on each start date (Danzig, Königsberg, Lemberg and Batavia in 1914;
  Leningrad, Stalingrad and Peiping in 1939), the capitals of the time, and
  cities that did not exist yet left out (Brasília, Shenzhen); major rivers and
  lakes; eleven strategic resources (oil, gas, coal, iron, copper, gold,
  nickel, tin, bauxite, rubber, uranium) on about 230 provinces.
- **Resources have amounts.** Each field and mine has its output over the
  years on a 1–10 scale against the leading region of its day — Saudi oil
  appears in 1938 and leads the world from the 1970s, Baku leads in 1901, the
  Amazon rubber boom ends in 1920 — so Kursk iron no longer weighs as much as
  Saudi oil. The resources mode shows bubbles sized by output, or one
  resource alone with provinces shaded by output and the year's top producing
  countries.
- **Population.** Every province has its population on the start date (1.8
  billion people in 1914, 8 billion in 2022): country totals for today's
  borders written by hand, shared out by cities, towns and fertile land, with
  today's census for China, India, Russia and Nigeria. A population density mode; the
  province card shows people and density, the country card the total.
- **Railways and ports.** A transport mode and overlays: Natural Earth's
  railways dated by hand (the Murmansk line from 1916, the Turksib from 1931,
  the BAM from 1984, the Tibet railway from 2006), shown by rank as you zoom
  in, and about 1,100 ports. Each province's railway density is on its card.
- **Places appear as you zoom in, and their names never overlap**: capitals
  and cities over five million on the world view, then millions, big cities
  and the scenario's flashpoints, provincial capitals at 5×, and close in
  about 25,000 towns from GeoNames with their Russian and Ukrainian names —
  about 29,000 places. Where names would collide the more important place
  wins, so a region stays readable at every zoom. Calmer markers and labels.
- **A faster map**: panning and zooming move the drawing directly and the
  page catches up when the gesture pauses; only places on screen are laid
  out, towns load the first time you zoom in, and each province is one
  element.
- **A layers panel in the bottom-right corner** next to zoom: six map modes,
  a resource picker, overlays for rivers, railways, ports, cities and province
  borders, remembered per browser; legends in the bottom-left. On a narrow map
  the zoom buttons step aside for pinch.
- **The game master weighs land, people and transport**: each province line
  names its population, railway density, resource output and rivers, each
  country line its population and the output it holds; the rules say what
  population, output, railways and rivers mean for war and economy.
- **A product plan for the map.**
- **A verdict for every order** — done, partly or failed, with a line on why —
  shown next to the order in the turn report and the chronicle.
- **Export and import.** Download a game as a save file or its chronicle as
  Markdown; load a save on the main menu.
- **Corrections for the start dates at province level**: in 1914 Bessarabia
  and Kars are Russian and Transylvania Hungarian; in 1939 Slovakia is a
  German client that joins the attack on Poland, Carpatho-Ukraine is Hungarian
  and Memel German; in 2022 Crimea is Ukrainian land held by Russia, and South
  Sudan and Kosovo exist.

### Changed
- **A sandbox, said plainly.** The front page, the About page and the README
  call the game a sandbox. Being overthrown no longer says "the game is
  lost": the government is gone, the country goes on, and you play on as the
  new rulers.
- **The stage shows in the interface language** ("бета", "beta") on the front
  page, the settings and the About page; the settings link to the About page.
- **The politics panel** is rebuilt in tabs: parliament, parties, actions,
  threats.
  - **The ideas compass** is bigger: abbreviations sit inside the circles,
    overlapping circles are moved apart, the colours are distinct, and an
    axis switch shows economy against freedom or nation.
- **The top bar** keeps the six key figures in one row that the mouse wheel
  scrolls. The resources fold into a chip with a dropdown list (production
  against need, stores), and "More" stays in view.
- **The resource and transport maps** draw the land in grey (dark grey in the
  dark theme) with the countries' borders.
  - **Resources:** provinces take the colour of their main resource, and the
    circles are bigger and outlined.
- **Protest markers** on the map are about twice as big, with a halo.
- **The turn's arrows and highlights** start visible and only flash on top, so
  they show even where the animation does not run (a tab in the background).
- **Occupation hatching** is lighter.
- **The front is one line.** It is the outline of everything a side holds,
  whole provinces and captured towns alike, drawn where it faces the other
  side. It no longer breaks at province borders or runs between two towns of
  the same side. State borders are not drawn through captured towns.
- **A province changes hands when more than half of it is taken.** The
  other side then contests the rest. Luhansk at 66% Russian is now Russia's,
  with Ukraine holding a third, instead of staying Ukraine's. Older saves
  are put right when opened.
- **The game master moves the story on.**
  - An attack the government orders goes in that period, even if it fails.
  - Preparations finish when their time is up.
  - Every period brings something new, the rest of the world acts on its own,
    and a partial or failed order says what was missing.
- **Ministers serve the leader's decision.** They lay out how to do it, what
  it costs and when it can start, with numbers and options, instead of
  refusing again and again. Each speaks in a voice of their own, and the
  first description of the government uses the whole 1–5 range for ability
  and loyalty.
- **More room for the map.** Below 1536 px the right panel steps aside while
  a left panel is open.
- **Ministers are a row of avatars.** Each shows initials, surname, office
  and a count of directives, with a card for the one selected.
- **Chronicle entries fold the story** to its first paragraph; the orders and
  changes stay in view.
- **The 0–100 ratings are retired.** Army, economy and stability ratings are
  gone from the screen, the game master's prompt and its answers. The real
  economy and the army's numbers took their place. Stability is now the
  player's unrest, which every game has from the start, before the parties
  are described. A government can fall only when unrest is high, an uprising
  is in the streets or a strong coup plot is ready.
- **Contested provinces** are striped more boldly, so a front through a
  province reads from afar.
- **A bloc with many members** shows the first twelve and "+N more".
- **A softer map**: place names in a muted grey with a thin, faint halo
  instead of a thick white outline, smaller markers, quieter country names
  and borders, and country colours a shade more pastel (the same hues).
- **Wars end on their own** once a whole side has been annexed, instead of
  lingering in the list.
- **Fuller turn reports and steadier indices**: the game master writes 3–5
  paragraphs on what the government did, what moved at the fronts and what the
  world did, and changes stability, economy and military only for a clear
  cause. Findings behind this came from playtests of the USSR in 1939 and
  Ukraine in 2022.
- **Canonical country colours**: Britain rose-red, France blue, Germany grey,
  Russia green, the Soviet Union crimson, China red, Japan cream, the
  Habsburgs yellow, the Netherlands orange, and about a hundred more; saved
  games pick them up when opened.
- **The game master works with provinces**: it sees the player's provinces,
  their neighbours, every war's front and occupied land, may name provinces by
  id or name or move a whole country, and is told how terrain and fertility
  weigh. It no longer mentions ids, maps or game mechanics in the story.
- **The turn report is easier to read**: occupations are grouped per country,
  your own indices and big swings come first and the rest fold away; province
  and country names are in your language, without the "оккупирован(а)" hack.
- **The chronicle folds** to one headline per turn; the latest is open.
- Saves from alpha 0.1.0 are upgraded to provinces when opened, keeping their
  borders.
- **An About page** — the rules in short, where your data lives, who makes
  the game with links to the author, and the roadmap: a new world map with
  provinces and terrain, then economy, foreign policy and domestic politics.
  Linked from the header and the main menu's footer.
- **`supabase/config.toml`** declares the auth site URL and redirect URLs,
  so `npx supabase config push` sets them on a linked project without
  touching anything else.

### Fixed
- **Town lists in development.** The server could keep a map from before
  the towns existed, so a turn ran without them. The map cache is now
  renewed when the map data gains a field.
- **A government no longer falls because the model wrote that it did not.**
  - An overthrow now needs an explicit `"happened": true`.
  - A false defeat left by this in an older save is dropped when the game
    opens.
- **A turn's changes show on land of any colour.** The highlight has a dark
  outline, so a province regained by the player is no longer invisible in
  the player's own colour.
- **Saves with new kinds of entries load again.** The save schema listed the
  ministries and the bloc kinds by hand, so a report from the chief of staff
  or a trade agreement would have broken loading. Both lists are now shared
  with the engine.
- **"The game master's answer could not be read"** on every turn.
  - The rules show `"overthrow": null`, and the model copied it, but the
    answer's schema did not accept null there. The same went for a
    refugee's destination or a protest's leader.
  - Null now means "nothing" anywhere in a model's answer, except a null
    next election, which still cancels the election.
- **Phones.** "End turn" no longer shows twice in the header, and the
  country's name and date are visible again.
- **Country names** sit on the country's home land. Germany is no longer
  labelled over occupied Greenland, nor France over the Sahara.
- **Occupying a whole country** spreads over land and across straits from
  where the occupier stands. It no longer takes Greenland with Denmark or the
  Indies with the Netherlands.
- **Terrain and fertility read right in the dry lands, the taiga and the
  savanna.** Sinai, Arabia, Iran and Balochistan are desert instead of green
  plains; the Punjab, Sindh, the Nile valley, Cairo and Mesopotamia are
  farmland instead of desert; the Sahel and Gezira are dry plains, not
  Sahara; Khabarovsk, Amur and Sakhalin are taiga; Quebec, Ontario and
  Wisconsin are no longer tundra; Somalia, Nigeria's north and East Africa
  are savanna, not jungle. A province's fertility is now the mean of its
  parts, so the Po valley no longer counts as bare mountain. Province ids are
  unchanged.

## [0.1.0] — 2026-10-16 (alpha)

The first playable version.

### Added
- **Four scenarios, any country.** 28 June 1914 (Sarajevo), 1 September 1939
  (the invasion of Poland), 19 August 1991 (the August Coup — every Soviet and
  Yugoslav republic playable as a country without land yet) and 24 February
  2022 (the invasion of Ukraine), each with its borders corrected for the
  date, leaders, wars, alliances and a briefing.
- **A language model as game master.** Plain-language orders, turn lengths
  from a week to a year, a turn report with headline, narrative, world events
  and the changes that actually happened, and a chronicle of every turn.
- **Diplomacy.** Write to any government; it answers in character, and the
  answer is taken into account when the turn ends.
- **An engine that keeps the books.** Structured world state; the model's
  answer is schema-checked, references to unknown regions or countries are
  dropped, stat swings are clamped, a broken answer gets one repair round.
  Occupation is separate from annexation, and peace returns occupied land.
- **Sign in with ChatGPT.** Turns run on the player's own ChatGPT plan through
  OpenAI's official programme for open-source local apps, with model choice,
  token refresh and revocation on sign-out. Tokens are stored encrypted
  outside the project folder.
- **The map.** Historical borders for 1914, 1938, 1994 and 2010 from
  aourednik/historical-basemaps, fill by holder, hatching for occupation,
  borders that follow the front, labels, wheel/pinch zoom and drag.
- **Accounts and saves.** Automatic saves in the browser; with Supabase
  configured, Google sign-in and cloud saves under row-level security.
- **Interface in Russian, Ukrainian and English**, light and dark themes, and a
  layout that works on a phone.
- **A local-only server.** AI routes answer only a loopback host, refuse
  cross-site requests and accept only JSON.
- An offline mock game master (`GOT_MOCK_AI=1`) for interface work, 69 tests,
  and CI running typecheck, lint, tests and build.

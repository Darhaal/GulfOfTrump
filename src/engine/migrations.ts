import { seedDomestic } from "./abroad";
import { seedMen } from "./army";
import { seedArsenals } from "./arsenal";
import { seedCivilWars } from "./civilWar";
import { ensureDeputies } from "./deputies";
import { recolor } from "./colors";
import { chooseHost } from "./exile";
import { boundEconomies, nationalAccounts, seedEconomies } from "./economy";
import { STAGE_WORK, startingAtom } from "./atom";
import { startingEnergy } from "./energy";
import { splitArsenals } from "./forces";
import { ensureWorldBodies, fillBlocKinds, fillTreaties } from "./foreign";
import { seedIntentions } from "./intentions";
import { settleFronts } from "./outcome";
import { seedInterests } from "./interests";
import { withPeople } from "./people";
import { seedPartyStrength } from "./partyLife";
import { ensurePolitics } from "./politics";
import { migrateToProvinces, startingOwner } from "./provinces";
import { refineSave } from "./refine";
import { migrateResearch } from "./research";
import { roleOf } from "./role";
import { dropFalseDefeat } from "./unrest";
import { seedResistance } from "./warMeans";
import { startingSpace } from "./space";
import { startingSport } from "./sport";
import type { AdviceMessage, AdviceProposal } from "./advisors";
import type { Arsenal, GameState, MapRegion, Research, Scenario } from "./types";

/**
 * Saves are upgraded by numbered steps. A save's `migration` is the number
 * of the last step it has been through (none when it is missing); the steps
 * it has not been through run once, in order, when the game opens. A step
 * that needs the map waits until the map has loaded, and the steps after it
 * wait with it, so the order always holds.
 *
 * A change to what a save holds adds a step at the end. A released step is
 * never edited, renumbered or removed: saves in the wild have been through
 * it as it was.
 */

export interface MigrationContext {
  /** The save's scenario as it was begun, with its start (scenarios/index.ts scenarioOf). */
  scenario: Scenario;
  /** The scenario's map, once it has loaded. */
  map?: { regions: MapRegion[]; byId: Record<string, MapRegion> };
}

interface Migration {
  /** The save's `migration` once this step has run. */
  n: number;
  /** What the step does, for whoever reads the list. */
  what: string;
  /** It needs the map. */
  map?: boolean;
  run: (state: GameState, context: Required<MigrationContext>) => GameState;
}

/** Every step, oldest first. */
const MIGRATIONS: Migration[] = [
  { n: 1, what: "Politics at home for a save from before them.", run: (s) => ensurePolitics(s) },
  { n: 2, what: "The scenario's kinds for the blocs a save from before bloc kinds started with.", run: (s, { scenario }) => fillBlocKinds(s, scenario.alliances) },
  {
    n: 3,
    what: "A defeat whose note says nothing happened, from before an overthrow had to be said to happen, is dropped.",
    run: (s) => dropFalseDefeat(s),
  },
  { n: 4, what: "A front past half of a province hands the province to the side holding most of it.", run: (s) => settleFronts(s) },
  { n: 5, what: "Provinces instead of one region per country (schema 2).", map: true, run: (s, { scenario, map }) => migrateToProvinces(s, scenario, map.regions) },
  { n: 6, what: "An economy for every country, for a save from before the economy.", map: true, run: (s, { map }) => seedEconomies(s, map.byId) },
  { n: 7, what: "Politics in brief for every country but the player's, with elections already past moved to their next date.", run: (s, { scenario }) => seedDomestic(s, scenario) },
  {
    n: 8,
    what: "Fog of war, off for a game begun before it: its player has seen the true figures and planned by them. The eye in the game's header turns it on.",
    run: (s) => ({ ...s, fog: s.fog ?? false }),
  },
  { n: 9, what: "Interests of their own for the cabinet's ministers, dealt by the game's dice.", run: (s) => seedInterests(s) },
  {
    n: 10,
    what: "Foreign courses for the countries that matter, the historical mode (what the game master was told before), and the date's plans for a save not yet past them.",
    run: (s, { scenario }) => seedIntentions(s, scenario, { mode: s.mode ?? "historical" }),
  },
  {
    n: 12,
    what: "Weapons for every country by the counts of its start date, and an empty research list for the player; the science post stays vacant until someone is appointed.",
    map: true,
    // The research list of the day, empty; step 16 turns it into directions.
    run: (s, { map }) => seedArsenals({ ...s, research: s.research ?? ({ active: [], done: [] } as unknown as Research) }, map.byId),
  },
  { n: 13, what: "Leaders and ministers as people: who each leader line names, their sex and their portrait.", run: (s) => withPeople(s) },
  { n: 14, what: "Deputies in the ministries and the government's own plots against their chiefs: empty lists, filled when the player first asks after a ministry's people.", run: (s) => ensureDeputies(s) },
  { n: 15, what: "The player's role: a game begun before roles is played as the country's leader, as it always was.", run: (s) => ({ ...s, role: s.role ?? { ...roleOf(s), how: "start" } }) },
  {
    n: 16,
    what: "Research directions instead of projects: the default split, each direction as far ahead as the save's projects took it (unfinished ones by their progress), an unfinished bomb as the atomic programme, finished projects kept as breakthroughs.",
    run: (s) => migrateResearch(s),
  },
  {
    n: 17,
    what: "Soldiers by training for every army: career soldiers, trained conscripts and recruits, by the split of the era and, for the player, the conscription law.",
    run: (s) => seedMen(s),
  },
  {
    n: 21,
    what: "An eighth ministry, industry, split from the economy: in a game begun before it the post stays vacant until someone is appointed, and the economy (still the finance ministry underneath) keeps its minister, directives and conversations.",
    run: (s) => s,
  },
  {
    n: 22,
    what: "Peaceful plans (policies, sanctions, trade agreements, talks), programmes at work and incidents: a save from before them has none, and the first turn opens them.",
    run: (s) => s,
  },
  {
    n: 23,
    what: "Industry builds no kind of weapon first any more: the player's two kinds and the general staff's proposals of them are dropped, and the arms money is split by the era's mix.",
    run: (s) => dropArmsFocus(s),
  },
  {
    n: 24,
    what: "The start a game was begun on, chosen on its date's card: a save from before the choice has none and plays its date's own day, as it always did.",
    run: (s) => s,
  },
  {
    n: 25,
    what: "A crisis climbs incident, escalation, preparation, the decision at the brink and war: a war plan saved at its old secret decision, which came before mobilising, goes back to escalation, as the panel showed it.",
    run: (s) => crisisLadder(s),
  },
  {
    n: 26,
    what: "Resistance in occupied land: every province an enemy took in play, by the chronicle's record of its occupation, gets its people's resistance, grown for the time it has been held; land held since the start date has none.",
    run: (s) => seedResistance(s),
  },
  {
    n: 27,
    what: "Ministers and generals as roles, exile with a host government, resignation and death as falls: a save from before them keeps its role as it was, and a movement already in exile is sheltered by the government that would take it in.",
    run: (s) => hostExiles(s),
  },
  {
    n: 28,
    what: "A cabinet that intrigues: factions follow from the ministers' causes, so a save from before has them at once; its people start with no favour gathered, the government with no moves in its cabinet, and its politics with no plots inside the cabinet.",
    run: (s) => s,
  },
  {
    n: 31,
    what: "Society in numbers: every country's people are derived from its land and economy, so a save from before needs nothing at once; the player's record (the trend arrows' base, the poverty line's anchor) opens from the save as it was loaded when its next turn is played.",
    run: (s) => s,
  },
  {
    n: 33,
    what: "The world's answer to aggression: acts of aggression, who condemned, sanctioned, armed or pledged, and the world body's resolutions are kept from the next turn on; a save from before has none, and wars begun before it are not judged again.",
    run: (s) => s,
  },
  {
    n: 35,
    what: "The finer maps every era plays: a save of the standard map has each province shared out among its parts – owner, holder, people, occupation and resistance to every part, a front laid out again from the side holding part of it – and its chronicle, formations and protests moved to the parts. Without the map at hand it passes, and the load carries the save over once the map is there (fitToMap), so the steps after it need not wait.",
    run: (s, context) => {
      const map = (context as MigrationContext).map;
      return map ? fitToMap(s, context.scenario, map.regions) : s;
    },
  },
  {
    n: 37,
    what: "Aircraft, ships and tanks by type: each old total is split by the era's mix (the great powers' own on the start date), and the support types – transport aircraft, landing ships, infantry fighting vehicles – are added on top at the era's ratio, as a new game has them.",
    run: (s) => splitArsenals(s),
  },
  {
    n: 38,
    what: "Demography that follows the game: every country's age cohorts are opened from history as of the save's own year, with the gaps its wars left (engine/society.ts seedDemography), and age, are born and die by the game's conditions from then on. A save from before needs nothing at once – until then its pyramid is that same history – and its cohorts open from the save as it was loaded when its next turn is played, so the step waits for no map.",
    run: (s) => s,
  },
  {
    n: 39,
    what: "The space race: every country's rocket programme as history had it on the save's date, its feats and the world's firsts so far; launch sites follow their provinces, and the space programme takes its share of the research money from the next turn.",
    run: (s) => (s.space ? s : { ...s, space: startingSpace(s) }),
  },
  {
    n: 40,
    what: "Parties that live and die: every banned or underground party gets the strength of its organisation from its support, for the engine to wear down; a save from before has no ended parties and no parties the engine made.",
    run: (s) => seedPartyStrength(s),
  },
  // Steps 41 and 42 were held for the finer map and repressions, which needed none.
  {
    n: 43,
    what: "Sport: the Olympic Games and the World Cup as history had chosen them by the save's date – the last held of each kind with its champion, the hosts of the next twelve years, history's bans in force; the player's government gives sport the era's usual share of its social budget.",
    run: (s) => (s.sport ? s : { ...s, sport: startingSport(s) }),
  },
  {
    n: 45,
    what: "Decolonisation as a process: a save from before has no colonies; they are read from the map as the save stands when its next turn is played (engine/colonies.ts) – the calendar's in the historical mode, a dated independence already past its day coming in the first turns – so the step waits for no map.",
    run: (s) => s,
  },
  {
    n: 47,
    what: "Energy and the atom: every country's power plants and demand for electricity as history had them on the start date, grown into the save's own date (engine/energy.ts); every atomic programme with its stages and stockpile as of the save's date, the bombs the save already counts kept, and the player's old atomic progress carried into its programme's stages (engine/atom.ts). Needs no map: the plants lean on the land once it is there.",
    run: (s, context) => seedEnergyAndAtom(s, (context as MigrationContext).map?.byId ?? null),
  },
  // Steps 48 and 49 are held for the branches merged alongside this one.
  {
    n: 50,
    what: "People and society: the society tab's record opens with the save as it stands when its next turn is played (engine/societyRecord.ts), the classes take their moods from that turn's conditions (engine/classes.ts), and every economy's two industries stand at the usual split and structure for its era, income and system until the government or a new system moves them (engine/industry.ts); refugees leave by age and sex from that turn on. A save from before needs nothing at once, so the step waits for no map.",
    run: (s) => s,
  },
  // Step 51 is held for the rest of the war; 48 for the new dates.
  {
    n: 52,
    what: "Joint actions with allies (engine/joint.ts): a save from before has none and needs nothing – its sanctions are each government's own; in the historical mode history's joint programmes and projects under way on the save's date open with their progress on its next turn, and the rest on their days.",
    run: (s) => s,
  },
  {
    n: 53,
    what: "Civil wars under way on the date (China's of 1933 and 1950, Laos's, Cambodia's, Angola's, Afghanistan's): a save from before has them as ordinary wars; those still fought are recorded as civil wars – legitimacy, defections, recognition, volunteers, their end – and a rump smaller than the usual threshold loses only below half of what it holds on its next turn.",
    run: (s, { scenario }) => {
      const add = seedCivilWars(s, scenario.wars);
      return add.length ? { ...s, civilWars: [...(s.civilWars ?? []), ...add] } : s;
    },
  },
];

/** Power plants and atomic programmes for a save from before them (step 47). */
export function seedEnergyAndAtom(state: GameState, map: Record<string, MapRegion> | null): GameState {
  const energy = state.energy ?? startingEnergy(state, map, map ? nationalAccounts(state, map) : null);
  if (state.atom) return { ...state, energy };
  const atom = startingAtom(state);
  // The player's progress from before: research's share of the way to the bomb, as the stages' work.
  const progress = state.research?.bomb;
  const mine = atom.programmes[state.player];
  if (progress && mine && !state.countries[state.player]?.arsenal?.nuclear) {
    let left = progress * TO_BOMB_WORK;
    for (const s of ["reactor", "material", "device", "test"] as const) {
      if (mine.done.some((d) => d.id === s)) {
        left -= STAGE_WORK[s];
        continue;
      }
      if (left <= 0) break;
      const w = Math.min(STAGE_WORK[s], left);
      if (w >= STAGE_WORK[s] && s !== "test") mine.done.push({ id: s, date: state.date });
      else mine.work[s] = Math.round(w * 1000) / 1000;
      left -= w;
      if (w < STAGE_WORK[s]) break;
    }
  }
  const research = state.research ? { ...state.research } : undefined;
  if (research) delete research.bomb;
  return { ...state, energy, atom, ...(research ? { research } : {}) };
}

/** The work up to a first test, years at history's pace. */
const TO_BOMB_WORK = STAGE_WORK.reactor + STAGE_WORK.material + STAGE_WORK.device + STAGE_WORK.test;

/**
 * A save carried over to the map it is played on (engine/refine.ts): step 35,
 * and on every load where the map's provinces are not the save's, since a
 * save could pass step 35 unchanged while the finer maps were a prototype
 * behind a flag.
 */
export function fitToMap(state: GameState, scenario: Scenario, map: readonly MapRegion[]): GameState {
  return refineSave(state, map, (r) => {
    const owner = startingOwner(scenario, r);
    return { owner, controller: owner };
  });
}

/** War plans on the crisis ladder (step 25): the old decision before preparation is the new escalation. */
function crisisLadder(state: GameState): GameState {
  if (!state.plans?.some((p) => p.kind === "war" && p.stage === "decision" && !p.end)) return state;
  return { ...state, plans: state.plans.map((p) => (p.kind === "war" && p.stage === "decision" && !p.end ? { ...p, stage: "tension" as const } : p)) };
}

/** A movement in exile from before hosts (step 27): sheltered by whoever would take it in now (engine/exile.ts). */
function hostExiles(state: GameState): GameState {
  const m = state.role?.movement;
  if (state.role?.kind !== "opposition" || !m || m.kind !== "exile" || m.host) return state;
  const host = chooseHost(state);
  return host ? { ...state, role: { ...state.role, movement: { ...m, host } } } : state;
}

/** A save without what industry was told to build first (step 23): in any country's arsenal, or proposed in the general staff's conversation. */
function dropArmsFocus(state: GameState): GameState {
  const countries = Object.fromEntries(
    Object.entries(state.countries).map(([tag, c]) => {
      if (!c.arsenal || !("focus" in c.arsenal)) return [tag, c];
      const arsenal: Arsenal & { focus?: unknown } = { ...c.arsenal };
      delete arsenal.focus;
      return [tag, { ...c, arsenal }];
    }),
  );
  const thread = state.advice?.military;
  const military = thread?.map((m) => {
    if (!m.proposal || !("focus" in m.proposal)) return m;
    const proposal: AdviceProposal & { focus?: unknown } = { ...m.proposal };
    delete proposal.focus;
    const message: AdviceMessage = { ...m, proposal };
    if (!Object.keys(proposal).length) delete message.proposal;
    return message;
  });
  return { ...state, countries, ...(thread ? { advice: { ...state.advice, military } } : {}) };
}

/** The number of the last step: what a new game starts at. */
export const SAVE_MIGRATION = MIGRATIONS[MIGRATIONS.length - 1].n;

/** The steps a save has not been through, run in order as far as they can go: up to the first that needs a map it does not have. */
export function migrateSave(state: GameState, context: MigrationContext): GameState {
  let next = state;
  for (const step of MIGRATIONS) {
    if ((next.migration ?? 0) >= step.n) continue;
    if (!context.map && step.map) break;
    next = { ...step.run(next, context as Required<MigrationContext>), migration: step.n };
  }
  return next;
}

/** Whether a save has been through every step. */
export function isMigrated(state: Pick<GameState, "migration">): boolean {
  return (state.migration ?? 0) >= SAVE_MIGRATION;
}

/**
 * What the game ships as data, picked up on every load rather than once: the
 * palette (a colour the player chose stays), the world bodies, the terms of
 * treaties and the treaties added to a scenario since the save was made, the
 * politics of any country that has none, and a foreign course for any country
 * that matters and has none.
 */
export function refreshSave(state: GameState, scenario: Scenario): GameState {
  const seeds = scenario.alliances;
  // Politics abroad, the ministers' interests and the courses of the countries that matter fill in on every load as well as by steps 7, 9 and 10: a save an older build wrote back has lost them.
  // Leader lines are read into people on every load too (step 13), so a portrait added later reaches an old save.
  // An economy edited outside the game is brought back within what any country could have by this date (engine/economy.ts).
  const years = (Date.parse(state.date) - Date.parse(scenario.startDate)) / (365.25 * 86_400_000);
  return boundEconomies(withPeople(seedIntentions(seedInterests(seedDomestic(fillTreaties(ensureWorldBodies(recolor(state), seeds), seeds), scenario)), scenario)), years);
}

import { z } from "zod";
import { applyAbroad, castAbroad } from "./abroad";
import { advanceArsenals, armsField, sanitizeArms } from "./arsenal";
import { ADVISORS } from "./advisors";
import { applyIntrigues, castIntrigues } from "./deputies";
import { countryColor, isHexColor } from "./colors";
import { addStep } from "./calendar";
import { countryCrises, unrestFloor } from "./crises";
import { advanceEconomies, followLand, limitChange, nationalAccounts, seedEconomies, snapshot, STEP_YEARS } from "./economy";
import { applyForeign, BLOC_KINDS, endWar, foreignFields, sanitizeForeign } from "./foreign";
import { frontMoves } from "./fronts";
import { clearOrphanFronts, markBehind, returnToAllies } from "./occupation";
import { recordWarLosses, sanitizeWarLosses, warExchange, warLossesField, type WarLossEntry } from "./warLosses";
import { applyWarMeans } from "./warMeans";
import { advanceIntentions, carryOutPlans, castPlans, planGate } from "./intentions";
import { castIncidents } from "./incidents";
import { applyCabinet, cabinetField, holdUpDirectives, markDownVerdicts, sanitizeSway } from "./intrigue";
import { syncRulers } from "./people";
import { applyPolitics, politicsField } from "./politics";
import { briefsFor, ministriesField, sanitizeMinistries } from "./reports";
import { applyOfficials, officialsField } from "./government";
import { growPopulation, losePopulation, peopleOf, populationField } from "./population";
import { warBetween } from "./relations";
import { applySanctions, sanctionCuts, sanctionExportCuts, sanctionsField } from "./trade";
import { applyDeals, dealsField, settleDeals } from "./deals";
import { applyFunds, fundsField, keepFunds } from "./funds";
import { applyProclamation } from "./identity";
import { advanceResearch, applyResearchWords, sanitizeResearch } from "./research";
import { populationBonus } from "./researchEffects";
import { applyOpposition, castRepression, checkElectionDefeat, isOpposition, oppositionField, sanitizeOpposition } from "./role";
import { figureField, governs, isFigure, sanitizeFigure, withoutPlayerPost } from "./figures";
import { applyFate, castFate } from "./fate";
import { actsField, applyBills, billsField, type CityName, proclamationOf, sanitizeActs, type TurnAct } from "./acts";
import { adjustTaken, carry, matchTown, townShare } from "./towns";
import { reachableProvinces, withinReach } from "./provinces";
import { applyOverthrow, applyProtests, overthrowField, protestsField, updateExile } from "./unrest";
import { bordersBefore } from "./history";
import { advanceSociety } from "./society";
import { withoutNulls } from "./json";
import { slug } from "./text";
import { EVENT_KINDS, REGIME_KINDS } from "./types";
import type { AppliedChange, ChronicleEntry, GameState, MapIndex, MapRegion, OrderVerdict, RegionState, War, WeaponKind } from "./types";

/**
 * What the model returns for a turn. The schema is lenient on purpose:
 * missing arrays become empty and unknown enum values fall back, so a
 * slightly-off answer still plays. Whether a change is *allowed* is decided
 * afterwards by sanitizeOutcome, against the state.
 */
const tag = z.string().trim().min(1).max(80);
const shortText = z.string().trim().max(300);

export const OutcomeFields = z.object({
  headline: z.string().trim().min(1).max(400),
  narrative: z.string().trim().min(1).max(8000),
  events: z
    .array(
      z.object({
        title: shortText.min(1),
        body: z.string().trim().max(2000).default(""),
        kind: z.enum(EVENT_KINDS).catch("other"),
        countries: z.array(tag).default([]),
      }),
    )
    .max(16)
    .default([]),
  // A province by id (or exact name), or every province of a country at once.
  transfers: z
    .array(
      z.object({
        region: tag.optional(),
        country: tag.optional(),
        to: tag,
        mode: z.enum(["annex", "occupy", "liberate", "contest"]).catch("annex"),
        // For a contest: how much of the province the side named in "to" holds after the period, %.
        share: z.number().finite().optional().catch(undefined),
        // For a contest: the towns of the province the side named in "to" holds after the period.
        towns: z.array(z.string().trim().min(1).max(80)).max(60).optional().catch(undefined),
      }),
    )
    .max(120)
    .default([]),
  orders: z
    .array(
      z.object({
        n: z.coerce.number().int(),
        result: z.enum(["success", "partial", "failed"]).catch("partial"),
        note: shortText.default(""),
        // The ministry that carried the order out, asked for when one drags its feet (engine/intrigue.ts).
        by: z.enum(ADVISORS).optional().catch(undefined),
      }),
    )
    .max(12)
    .default([]),
  newCountries: z
    .array(
      z.object({
        tag,
        name: shortText.min(1),
        color: z.string().optional(),
        leader: shortText.optional(),
        government: shortText.optional(),
        // How it is governed (engine/abroad.ts); read from "government" when left out.
        regime: z.enum(REGIME_KINDS).optional().catch(undefined),
      }),
    )
    .max(8)
    .default([]),
  warsStarted: z
    .array(z.object({ name: shortText.min(1), attackers: z.array(tag).default([]), defenders: z.array(tag).default([]) }))
    .max(6)
    .default([]),
  warsJoined: z
    .array(z.object({ war: shortText.min(1), country: tag, side: z.enum(["attackers", "defenders"]).catch("defenders") }))
    .max(12)
    .default([]),
  warsEnded: z.array(z.object({ war: shortText.min(1) })).max(8).default([]),
  alliancesFormed: z
    .array(
      z.object({
        name: shortText.min(1),
        members: z.array(tag).default([]),
        kind: z.enum(BLOC_KINDS).catch("alliance").default("alliance"),
        until: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
        terms: shortText.optional(),
      }),
    )
    .max(6)
    .default([]),
  alliancesJoined: z.array(z.object({ alliance: shortText.min(1), country: tag })).max(12).default([]),
  alliancesLeft: z.array(z.object({ alliance: shortText.min(1), country: tag })).max(12).default([]),
  // Elections and coups abroad can bring many new leaders in a long turn (engine/abroad.ts).
  leaders: z.array(z.object({ country: tag, leader: shortText.min(1), government: shortText.optional(), gender: z.enum(["male", "female"]).optional().catch(undefined) })).max(48).default([]),
  // New levels and rates for economies this period changed; the engine limits them.
  economy: z
    .array(
      z.object({
        country: tag,
        growth: z.number().finite().optional(),
        inflation: z.number().finite().optional(),
        unemployment: z.number().finite().optional(),
        revenue: z.number().finite().optional(),
        army: z.number().finite().optional(),
        industry: z.number().finite().optional(),
        social: z.number().finite().optional(),
        other: z.number().finite().optional(),
        troops: z.number().finite().optional(),
        borrow: z.number().finite().optional(),
        tradeCut: z.number().finite().optional(),
      }),
    )
    .max(24)
    .default([]),
  ...foreignFields,
  politics: politicsField,
  ministries: ministriesField,
  population: populationField,
  officials: officialsField,
  // Whose causes the period's orders served or trampled, for their loyalty (engine/intrigue.ts).
  cabinet: cabinetField,
  sanctions: sanctionsField,
  trade: dealsField,
  funds: fundsField,
  bills: billsField,
  // A new name or colour the player's orders asked for (engine/acts.ts).
  acts: actsField,
  protests: protestsField,
  overthrow: overthrowField,
  arms: armsField,
  // Soldiers killed and wounded this period, by war and side (engine/warLosses.ts).
  warLosses: warLossesField,
  // The player's opposition movement, when the player leads one (engine/role.ts).
  opposition: oppositionField,
  // The player's standing as a minister or a general, and who takes over when the player's person falls (engine/figures.ts, engine/fate.ts).
  figure: figureField,
  // Where the player's government goes when it loses all its land.
  exileHost: tag.optional().catch(undefined),
});

/** A turn's answer as the model may write it: nulls for "nothing" are read as left out. */
export const OutcomeSchema = z.preprocess(withoutNulls, OutcomeFields);

/** A contested province's share held by the other side, %: below the first it is driven out, above the second the province falls. */
const MIN_HELD = 5;
const MAX_HELD = 95;
/** What an older save's contested province counts as: about a third. */
export const DEFAULT_HELD = 30;

/**
 * Whoever holds more than half of a contested province holds the province:
 * the other side becomes the one contesting it, with the rest of it and
 * its own towns (when known). Returns whether the province changed hands.
 */
export function settleMajority(region: RegionState, rest?: string[]): boolean {
  const held = region.held ?? DEFAULT_HELD;
  if (!region.contested || held <= 50) return false;
  const holder = region.controller;
  region.controller = region.contested;
  region.contested = holder;
  region.held = 100 - held;
  if (rest?.length) region.taken = rest;
  else delete region.taken;
  return true;
}

/** A save from before the rule above, brought in line with it. */
export function settleFronts<T extends Pick<GameState, "regions">>(state: T): T {
  if (!Object.values(state.regions).some((r) => r.contested && (r.held ?? DEFAULT_HELD) > 50)) return state;
  const regions = structuredClone(state.regions);
  for (const r of Object.values(regions)) settleMajority(r);
  return { ...state, regions };
}

export type RawOutcome = z.infer<typeof OutcomeSchema>;

export interface Transfer {
  region: string;
  to: string;
  /** "contest": the side's troops hold part of the province; the front runs through it. */
  mode: "annex" | "occupy" | "liberate" | "contest";
  /** For a contest: the share of the province the side in "to" holds afterwards, %. */
  share?: number;
  /** For a contest: the towns the attacking side (not the holder) holds afterwards, by their English names. */
  taken?: string[];
  /** For a contest: the towns the holder keeps — the contested ones if the attacker comes to hold most of the province. */
  rest?: string[];
}

/** A turn outcome whose every reference is known to exist in the state. */
export type Outcome = Omit<RawOutcome, "transfers" | "orders" | "acts" | "warLosses"> & {
  transfers: Transfer[];
  /** The acts of state the orders asked for, checked (engine/acts.ts); missing in outcomes written before them. */
  acts?: TurnAct[];
  /** The period's losses by war (its id) and side, within what the fighting allows. */
  warLosses: WarLossEntry[];
  /** The engine's own moves on the fronts the answer left alone (engine/fronts.ts), applied after the answer's. */
  fronts?: Transfer[];
  verdicts: OrderVerdict[];
  dropped: number;
};

/** Finds a war or alliance by id or by (case-insensitive) name. */
export function matchByName<T extends { id: string; name: unknown }>(list: T[], key: string): T | undefined {
  const needle = key.trim().toLowerCase();
  const names = (item: T) =>
    typeof item.name === "string" ? [item.name] : Object.values(item.name as Record<string, string>);
  const exact =
    list.find((item) => item.id.toLowerCase() === needle) ??
    list.find((item) => names(item).some((n) => n.toLowerCase() === needle));
  if (exact || needle.length < 5) return exact;
  // The model sometimes shortens a name ("Sino-Japanese War" for "Second
  // Sino-Japanese War"); a containment match is accepted only when unique.
  const loose = list.filter((item) =>
    names(item).some((n) => n.toLowerCase().includes(needle) || needle.includes(n.toLowerCase())),
  );
  return loose.length === 1 ? loose[0] : undefined;
}

/** Province ids by lowercased English, Russian and Ukrainian name. */
function namesIndex(index: MapIndex | undefined): Map<string, string[]> {
  const byName = new Map<string, string[]>();
  if (!index) return byName;
  for (const r of Object.values(index.regions)) {
    for (const n of [r.name, r.ru, r.uk]) {
      if (!n) continue;
      const key = n.trim().toLowerCase();
      const list = byName.get(key) ?? [];
      if (!list.includes(r.id)) list.push(r.id);
      byName.set(key, list);
    }
  }
  return byName;
}

/**
 * The towns behind a contest. The game master names those the side in "to"
 * holds afterwards (for the holder, the ones it keeps), checked against the
 * province's towns; or it gives only a share, and the attacker's towns are
 * adjusted to it — nearest its side taken first, farthest given up first.
 * Shares are of the province's land, towns' people are another measure,
 * so each moves the other in proportion: taking half of the towns the
 * holder still had takes about half of the land it still had. Without a share the attacker gains
 * ten points from where it stood, as the engine does anyway.
 */
function frontTowns(state: GameState, index: MapIndex | undefined, t: Transfer, named: string[] | undefined): void {
  const towns = index?.towns?.(t.region) ?? [];
  const region = state.regions[t.region];
  if (towns.length < 2 || !region) return;
  const holderPushes = region.controller === t.to;
  const attacker = holderPushes ? region.contested : t.to;
  if (!attacker) return;
  const was = region.contested === attacker ? (region.held ?? DEFAULT_HELD) : 0;
  // Where the attacker's own land lies, for the order in which towns change hands.
  const p = index?.regions[t.region];
  const near = (index?.neighbors[t.region] ?? []).filter((n) => state.regions[n]?.controller === attacker).map((n) => index?.regions[n]?.at).filter((a): a is [number, number] => Boolean(a));
  const toward: [number, number] | null = near.length ? [near.reduce((s, a) => s + a[0], 0) / near.length, near.reduce((s, a) => s + a[1], 0) / near.length] : null;
  const adjust = (from: string[], target: number) => (p?.at && toward ? adjustTaken(towns, from, target, p.at, toward) : from);
  // What it held: the towns on record, or for an older save, as many as its share.
  let before = region.contested === attacker ? (region.taken ?? []) : [];
  if (!before.length && was > 0) before = adjust([], was);

  const names = [...new Set((named ?? []).map((n) => matchTown(towns, n)).filter((n): n is string => Boolean(n)))];
  if (names.length) {
    t.taken = holderPushes ? towns.map((x) => x.n).filter((n) => !names.includes(n)) : names;
    t.rest = towns.map((x) => x.n).filter((n) => !t.taken!.includes(n));
    if (t.share === undefined) {
      const share = Math.round(carry(townShare(towns, before), townShare(towns, t.taken), was));
      t.share = holderPushes ? 100 - share : share;
    }
    return;
  }
  const share = holderPushes ? (t.share === undefined ? undefined : 100 - t.share) : (t.share ?? (region.contested === t.to ? Math.min(MAX_HELD, was + 10) : 20));
  if (share === undefined) return;
  if (!holderPushes && t.share === undefined) t.share = share;
  t.taken = adjust(before, carry(was, share, townShare(towns, before)));
  t.rest = towns.map((x) => x.n).filter((n) => !t.taken!.includes(n));
}

interface Sides {
  attackers: string[];
  defenders: string[];
}

/**
 * Who can stage the troops of `country` against `enemy` once the answer
 * lands: itself, everyone on its side of a war against `enemy` (counting wars
 * that start or gain members in the same answer), and its military allies.
 * Empty when the two are not at war.
 */
function sideAgainst(wars: Sides[], blocs: string[][], country: string, enemy: string): Set<string> {
  const side = new Set<string>();
  for (const w of wars) {
    if (w.attackers.includes(country) && w.defenders.includes(enemy)) w.attackers.forEach((t) => side.add(t));
    if (w.defenders.includes(country) && w.attackers.includes(enemy)) w.defenders.forEach((t) => side.add(t));
  }
  if (side.size) for (const members of blocs) if (members.includes(country)) members.forEach((t) => side.add(t));
  return side;
}

/**
 * Turns the model's transfers into one entry per province: an id is taken
 * as is; a name is looked up (preferring a province the recipient does not
 * hold yet); a whole country expands to every province it owns — for an
 * occupation or a contest, only those the recipient can reach from where it
 * stands (see reachableProvinces), and not those it already holds.
 * An occupation or a contest needs a war with the province's holder; one
 * province alone must also be within reach of the recipient's side (see
 * withinReach), unless the recipient holds no land at all: a rising comes
 * from within. Annexing and liberating by treaty go anywhere.
 */
function expandTransfers(
  state: GameState,
  raw: RawOutcome["transfers"],
  index: MapIndex | undefined,
  exists: (t: string) => boolean,
  sides: (country: string, enemy: string) => Set<string>,
) {
  const byName = namesIndex(index);
  const out: Transfer[] = [];
  let dropped = 0;
  const seen = new Set<string>();
  const atWar = (id: string, to: string) => sides(to, state.regions[id].controller).size > 0;
  const landless = (tag: string) => !Object.values(state.regions).some((r) => r.controller === tag || r.contested === tag);
  // The holder fighting in its own province needs neither.
  const canTake = (id: string, to: string) => {
    const holder = state.regions[id].controller;
    if (holder === to) return true;
    const side = sides(to, holder);
    return side.size > 0 && (!index || landless(to) || withinReach(state, index, id, side));
  };
  const push = (region: string, to: string, mode: Transfer["mode"], share?: number, towns?: string[]) => {
    if (seen.has(region)) return;
    seen.add(region);
    const t: Transfer = { region, to, mode, ...(mode === "contest" && share !== undefined ? { share: Math.min(100, Math.max(0, share)) } : {}) };
    if (mode === "contest") frontTowns(state, index, t, towns);
    out.push(t);
  };
  for (const t of raw) {
    if (!exists(t.to)) {
      dropped += 1;
      continue;
    }
    const military = t.mode === "occupy" || t.mode === "contest";
    if (t.region) {
      let id: string | undefined = state.regions[t.region] ? t.region : undefined;
      if (!id) {
        const candidates = (byName.get(t.region.trim().toLowerCase()) ?? []).filter((r) => state.regions[r]);
        id = candidates.find((r) => state.regions[r].controller !== t.to) ?? candidates[0];
      }
      if (id && (!military || canTake(id, t.to))) push(id, t.to, t.mode, t.share, t.towns);
      else dropped += 1;
      continue;
    }
    if (t.country && state.countries[t.country]) {
      const reach = military && index ? reachableProvinces(state, index, t.country, t.to) : null;
      const ids = (reach ?? Object.keys(state.regions).filter((id) => state.regions[id].owner === t.country)).filter(
        (id) => !military || (state.regions[id].controller !== t.to && atWar(id, t.to)),
      );
      if (!ids.length) dropped += 1;
      ids.forEach((id) => push(id, t.to, t.mode));
      continue;
    }
    dropped += 1;
  }
  return { transfers: out, dropped };
}

/**
 * A turn is written in three stages (engine/stages.ts): the story, the world
 * and home. Each stage's answer holds only its own fields and is checked by
 * its own sanitizer below, against the state before the turn; none needs
 * another stage's answer, so the stages can be written apart and merged in
 * any order. The whole answer of one request is checked by running all three.
 */
export type SanitizeOptions = { orders?: string[]; index?: MapIndex; cities?: CityName[] };

/** The fields of each stage's answer (the keys of OutcomeFields). */
export const STORY_FIELDS = ["headline", "narrative", "orders"] as const;
export const WORLD_FIELDS = [
  "events",
  "transfers",
  "newCountries",
  "warsStarted",
  "warsJoined",
  "warsEnded",
  "alliancesFormed",
  "alliancesJoined",
  "alliancesLeft",
  "leaders",
  "truces",
  "trucesEnded",
  "invitations",
  "summits",
  "summitsHeld",
  "sessions",
  "population",
  "sanctions",
  "warLosses",
  "exileHost",
  "arms",
] as const;
export const HOME_FIELDS = ["economy", "politics", "ministries", "officials", "cabinet", "opposition", "figure", "trade", "funds", "bills", "acts", "protests", "overthrow", "arms"] as const;

type Mask<K extends readonly string[]> = { [P in K[number]]: true };
const mask = <K extends readonly (keyof typeof OutcomeFields.shape)[]>(keys: K) => Object.fromEntries(keys.map((k) => [k, true])) as Mask<K>;

/** Each stage's answer as the model may write it: its own fields only, as lenient as the whole. */
export const StorySchema = z.preprocess(withoutNulls, OutcomeFields.pick(mask(STORY_FIELDS)));
export const WorldSchema = z.preprocess(withoutNulls, OutcomeFields.pick(mask(WORLD_FIELDS)));
export const HomeSchema = z.preprocess(withoutNulls, OutcomeFields.pick(mask(HOME_FIELDS)));
export type RawStory = z.infer<typeof StorySchema>;
export type RawWorld = z.infer<typeof WorldSchema>;
export type RawHome = z.infer<typeof HomeSchema>;

/** The story, checked: the headline, the narrative and one verdict per order. */
export type StoryPart = Pick<Outcome, "headline" | "narrative" | "verdicts"> & { dropped: number };
/** The world, checked: the map, wars and blocs, other governments, the world's news, the losses. */
export type WorldPart = Pick<Outcome, Exclude<(typeof WORLD_FIELDS)[number], "arms"> | "fronts"> & { arms: Pick<Outcome["arms"], "losses">; dropped: number };
/** Home, checked: the economies, the player's politics and government, money and deals, the street. */
export type HomePart = Pick<Outcome, Exclude<(typeof HOME_FIELDS)[number], "arms">> & { arms: Omit<Outcome["arms"], "losses">; dropped: number };

/** A filter that counts what it drops. */
function keeper() {
  const counter = { dropped: 0 };
  const keep = <T>(items: T[], ok: (item: T) => boolean): T[] =>
    items.filter((item) => {
      const pass = ok(item);
      if (!pass) counter.dropped += 1;
      return pass;
    });
  return { counter, keep };
}

/** The story's verdicts: one per order, in order, for orders that were given. */
export function sanitizeStory(state: GameState, raw: RawStory, options: SanitizeOptions = {}): StoryPart {
  const orderCount = options.orders?.length ?? 12;
  // An order an obstructing ministry carried out comes off at best partly (engine/intrigue.ts).
  const verdicts = markDownVerdicts(
    state,
    raw.orders
      .filter((v) => v.n >= 1 && v.n <= orderCount)
      .filter((v, i, list) => list.findIndex((o) => o.n === v.n) === i)
      .sort((a, b) => a.n - b.n),
  );
  return { headline: raw.headline, narrative: raw.narrative, verdicts, dropped: 0 };
}

/**
 * The world's answer checked: provinces resolved and checked against wars and
 * reach, wars and military blocs among other governments only as their plans
 * allow, the engine's own front moves added, references to countries, wars
 * and blocs that do not exist dropped.
 */
export function sanitizeWorld(state: GameState, raw: RawWorld, options: SanitizeOptions = {}): WorldPart {
  const { counter, keep } = keeper();
  const newCountries = keep(
    raw.newCountries.map((c) => ({ ...c, tag: slug(c.tag) })),
    (c) => c.tag.length > 0 && !state.countries[c.tag],
  ).filter((c, i, list) => list.findIndex((o) => o.tag === c.tag) === i);
  const isNew = (t: string) => newCountries.some((c) => c.tag === t);
  const exists = (t: string) => Boolean(state.countries[t]) || isNew(t);
  const knownTags = (tags: string[]) => [...new Set(tags.filter(exists))];
  // Wars and military blocs among other governments come only from the plans that reach action (engine/intentions.ts).
  const gate = planGate(state, isNew);

  const warsStarted = keep(
    raw.warsStarted.map((w) => {
      const known = { attackers: knownTags(w.attackers), defenders: knownTags(w.defenders) };
      return { ...w, ...(gate.war(known) ?? { attackers: [], defenders: [] }) };
    }),
    (w) => w.attackers.length > 0 && w.defenders.length > 0 && !w.attackers.some((a) => w.defenders.includes(a)),
  );
  const warsJoined = keep(raw.warsJoined, (j) => {
    const war = matchByName(state.wars, j.war);
    return exists(j.country) && Boolean(war) && gate.join(j.country, war!, j.side);
  });
  const alliancesFormed = keep(
    raw.alliancesFormed.map((a) => ({ ...a, members: gate.bloc(knownTags(a.members), a.kind) ?? [] })),
    (a) => a.members.length >= 2,
  );
  const alliancesJoined = keep(raw.alliancesJoined, (j) => {
    const bloc = matchByName(state.alliances, j.alliance);
    return exists(j.country) && Boolean(bloc) && gate.accession(j.country, bloc!);
  });

  // The wars and military alliances as they stand once this answer lands, for what troops may take.
  const wars = new Map<string, Sides>(state.wars.map((w) => [w.id, { attackers: [...w.attackers], defenders: [...w.defenders] }]));
  for (const j of warsJoined) wars.get(matchByName(state.wars, j.war)!.id)![j.side].push(j.country);
  const militaryBloc = (a: { kind?: string }) => (a.kind ?? "alliance") === "alliance";
  const blocs = new Map<string, string[]>(state.alliances.filter(militaryBloc).map((a) => [a.id, [...a.members]]));
  for (const j of alliancesJoined) blocs.get(matchByName(state.alliances, j.alliance)!.id)?.push(j.country);
  const sides = (country: string, enemy: string) =>
    sideAgainst([...wars.values(), ...warsStarted], [...blocs.values(), ...alliancesFormed.filter(militaryBloc).map((a) => a.members)], country, enemy);

  const expanded = expandTransfers(state, raw.transfers, options.index, exists, sides);
  counter.dropped += expanded.dropped;
  // The fronts the answer left alone move by the balance of strength (engine/fronts.ts); not those of a war it ends or pauses.
  const fronts: Transfer[] = [];
  if (options.index) {
    const pausing = [...raw.warsEnded, ...raw.truces].map((e) => matchByName(state.wars, e.war)?.id).filter((id): id is string => Boolean(id));
    for (const move of frontMoves(state, options.index, new Set(expanded.transfers.map((t) => t.region)), new Set(pausing))) {
      const t: Transfer = { ...move };
      if (t.mode === "contest") frontTowns(state, options.index, t, undefined);
      fronts.push(t);
    }
  }

  return {
    events: raw.events.map((e) => ({ ...e, countries: knownTags(e.countries) })),
    transfers: expanded.transfers,
    fronts,
    newCountries,
    warsStarted,
    warsJoined,
    warsEnded: keep(raw.warsEnded, (e) => Boolean(matchByName(state.wars, e.war))),
    alliancesFormed,
    alliancesJoined,
    alliancesLeft: keep(raw.alliancesLeft, (l) => exists(l.country) && Boolean(matchByName(state.alliances, l.alliance))),
    leaders: keep(raw.leaders, (l) => exists(l.country)),
    ...(() => {
      const foreign = sanitizeForeign(state, raw, (w) => Boolean(matchByName(state.wars, w)), exists);
      counter.dropped += foreign.dropped;
      return foreign.result;
    })(),
    population: keep(raw.population, (p) => exists(p.country)).map((p) => (p.to && !exists(p.to) ? { ...p, to: undefined } : p)),
    sanctions: keep(raw.sanctions, (s) => exists(s.by) && exists(s.against) && s.by !== s.against),
    exileHost: raw.exileHost && exists(raw.exileHost) ? raw.exileHost : undefined,
    // Weapons lost and captured only by countries at war, within a turn of the hardest fighting (engine/arsenal.ts).
    arms: (() => {
      const fighting = new Set<string>([...state.wars.filter((w) => !w.truce), ...warsStarted].flatMap((w) => [...w.attackers, ...w.defenders]));
      for (const j of warsJoined) fighting.add(j.country);
      return { losses: sanitizeArms(state, { losses: raw.arms.losses, research: [] }, fighting).losses };
    })(),
    // Losses only of wars that exist and countries that fight them, within a period of the hardest fighting (engine/warLosses.ts).
    warLosses: sanitizeWarLosses(state, raw.warLosses, (key) => matchByName(state.wars, key), STEP_YEARS[state.step]),
    dropped: counter.dropped,
  };
}

/**
 * Home's answer checked: one economic change per country, limited against
 * its economy now; the government's word on ministries, deals, bills, acts
 * and research only while the player governs; places of protests resolved; the
 * fall of a government the player's movement brought about read as its rise.
 */
export function sanitizeHome(state: GameState, raw: RawHome, options: SanitizeOptions = {}): HomePart {
  const { counter, keep } = keeper();
  let names: ReturnType<typeof namesIndex> | undefined;
  const placeNames = () => (names ??= namesIndex(options.index));
  // A player who does not govern — the opposition, a minister, a general — does not set the state's ministries, contracts, bills and research (engine/role.ts, engine/figures.ts).
  const opposition = isOpposition(state);
  const ruling = governs(state);
  const figure = isFigure(state);
  // A fall of the government the movement brought about is its rise; so is one a general's own troops brought about.
  const movementName = state.role?.movement?.name?.trim().toLowerCase();
  const personName = state.role?.person?.name.trim().toLowerCase();
  const theirs = (by: string) => {
    const b = by.trim().toLowerCase();
    return Boolean((movementName && (b.includes(movementName) || movementName.includes(b))) || (personName && b.includes(personName)));
  };
  const risenBy = (opposition || figure) && raw.overthrow && theirs(raw.overthrow.by) ? raw.overthrow : undefined;
  const figureWord = risenBy && figure ? { ...(raw.figure ?? {}), rise: { how: "coup" as const, government: risenBy.government, note: risenBy.note } } : raw.figure;
  const oppositionWord = risenBy && opposition
    ? { ...(raw.opposition ?? {}), rise: { how: risenBy.how === "coup" ? ("coup" as const) : risenBy.how === "deposed" ? ("appointed" as const) : ("revolution" as const), government: risenBy.government, note: risenBy.note } }
    : raw.opposition;

  return {
    // The player's politics, limited when applied (engine/politics.ts).
    politics: raw.politics,
    // One word per ministry, about directives that exist; the ministers write their reports after the turn.
    // Directives an obstructing ministry holds up stay under way (engine/intrigue.ts).
    ministries: ruling ? holdUpDirectives(state, sanitizeMinistries(state, raw.ministries)) : [],
    // Places of protests as province ids: an id the state knows, or a province's name.
    protests: raw.protests.map((p) => ({
      ...p,
      where: p.where
        .map((w) => (state.regions[w] ? w : (placeNames().get(w.trim().toLowerCase()) ?? []).find((id) => state.regions[id]?.owner === state.player)))
        .filter((id): id is string => Boolean(id)),
    })),
    overthrow: risenBy ? undefined : raw.overthrow,
    // What becomes of the player's own post is the engine's to decide (engine/fate.ts).
    officials: withoutPlayerPost(state, raw.officials),
    cabinet: ruling ? sanitizeSway(state, raw.cabinet) : [],
    opposition: sanitizeOpposition(state, oppositionWord),
    figure: sanitizeFigure(state, figureWord),
    trade: keep(raw.trade, (c) => ruling && Boolean(state.deals?.some((d) => d.id === c.deal))),
    funds: keepFunds(state, raw.funds),
    bills: keep(raw.bills, (b) => ruling && Boolean(state.bills?.some((x) => x.id === b.bill && x.status === "proposed"))),
    // Acts of state only as the orders asked for them, pointing at the country or a city it has.
    acts: (() => {
      const acts = sanitizeActs(state, raw.acts, { orders: options.orders, cities: options.cities, opposition: !ruling });
      counter.dropped += acts.dropped;
      return acts.acts;
    })(),
    // The player's research by what exists (engine/research.ts).
    arms: { research: ruling ? sanitizeResearch(state, raw.arms.research) : [] },
    // One change per country, limited against its economy now; new countries start from their land.
    economy: keep(raw.economy, (c) => Boolean(state.countries[c.country]?.economy))
      .filter((c, i, list) => list.findIndex((o) => o.country === c.country) === i)
      .map((c) => limitChange(c, state.countries[c.country].economy!)),
    dropped: counter.dropped,
  };
}

/** The three checked stages as one outcome, ready for applyOutcome. */
export function mergeStages(story: StoryPart, world: WorldPart, home: HomePart): Outcome {
  return { ...story, ...world, ...home, arms: { ...world.arms, ...home.arms }, dropped: story.dropped + world.dropped + home.dropped };
}

/**
 * Drops every change that points at a region or country the state does not
 * know, normalises new country tags, and clamps stat deltas. The count of
 * what was dropped is kept, so a test or a log can tell a sloppy turn.
 * With the map index, provinces may also be named instead of given by id;
 * with the player's cities, an act may rename one of them by any of its names.
 * A whole answer is checked as its three stages are, so a turn written in
 * one request and one written in stages come to the same outcome.
 */
export function sanitizeOutcome(state: GameState, raw: RawOutcome, options: SanitizeOptions = {}): Outcome {
  return mergeStages(sanitizeStory(state, raw, options), sanitizeWorld(state, raw, options), sanitizeHome(state, raw, options));
}

/**
 * Applies a sanitized outcome: the world moves to the end of the period, the
 * changes land in order, and the turn goes into the chronicle with the list
 * of what actually changed. Pure — returns a new state. With the map's
 * `neighbors`, land the front has left behind counts as its captor's until a
 * peace (engine/occupation.ts); without them the marks stay as they were.
 */
export function applyOutcome(
  state: GameState,
  outcome: Outcome,
  orders: string[],
  now = new Date(),
  regions: Record<string, MapRegion> | null = null,
  neighbors: Record<string, string[]> | null = null,
): GameState {
  let next: GameState = structuredClone(state);
  const from = state.date;
  const to = addStep(state.date, state.step);
  const applied: AppliedChange[] = [];
  const years = STEP_YEARS[state.step];
  const peopleBefore = peopleOf(state, regions, state.player);
  // The elections and coups abroad, and how other governments' plans move, were decided before the turn was written (engine/abroad.ts, engine/intentions.ts).
  const abroad = castAbroad(state, regions);
  const plans = castPlans(state);
  // So were the period's incidents between states (engine/incidents.ts).
  const incidents = castIncidents(state, regions, neighbors);
  // So were the government's own plots in its ministries (engine/deputies.ts), and the state's hand against the player's opposition (engine/role.ts).
  const intrigues = castIntrigues(state);
  const repression = castRepression(state);
  // And what became of the player's person: the government's word on a minister's or a general's orders, a resignation, a dismissal, a death (engine/fate.ts).
  const fate = castFate(state, orders);

  // People grow before the borders move; GDP then follows the land and the
  // losses measured from here, so natural growth does not count twice.
  if (regions) growPopulation(next.regions, regions, years, (owner) => (owner === state.player ? populationBonus(state) : 0));
  const grown = regions ? structuredClone(next.regions) : null;

  for (const c of outcome.newCountries) {
    next.countries[c.tag] = {
      tag: c.tag,
      name: c.name,
      color: isHexColor(c.color) ? c.color : countryColor(c.tag),
      ...(c.leader ? { leader: c.leader } : {}),
      ...(c.government ? { government: c.government } : {}),
    };
    applied.push({ kind: "new-country", country: c.tag });
  }

  for (const t of [...outcome.transfers, ...(outcome.fronts ?? [])]) {
    const region = next.regions[t.region];
    let falls = false;
    if (t.mode === "contest" || (t.mode === "occupy" && region.controller === t.to && region.contested)) {
      // The front through a province moves by shares: how much of it the attacking side holds.
      const was = region.contested ? (region.held ?? DEFAULT_HELD) : 0;
      if (region.controller === t.to) {
        // The holder fights back: with a share it holds that much and the other side keeps the rest; by occupying, or nearly all, it drives them out.
        const kept = t.mode === "contest" && t.share !== undefined ? 100 - t.share : 0;
        if (region.contested && kept >= MIN_HELD) {
          const held = Math.round(Math.min(kept, MAX_HELD));
          if (held !== was) applied.push({ kind: "contest", region: t.region, by: region.contested, holder: t.to, held, was });
          region.held = held;
          if (t.taken) region.taken = t.taken;
          settleMajority(region, t.rest);
        } else {
          if (region.contested) applied.push({ kind: "repel", region: t.region, by: region.contested, holder: t.to });
          delete region.contested;
          delete region.held;
          delete region.taken;
        }
        continue;
      }
      const share = t.share ?? (region.contested === t.to ? Math.min(MAX_HELD, was + 10) : 20);
      if (share > MAX_HELD) falls = true;
      else if (share < MIN_HELD) {
        // The side fighting in the province is left with almost nothing of it: it is driven out.
        if (region.contested === t.to) {
          applied.push({ kind: "repel", region: t.region, by: t.to, holder: region.controller });
          delete region.contested;
          delete region.held;
          delete region.taken;
        }
        continue;
      } else {
        const held = Math.round(share);
        const before = region.contested === t.to ? was : 0;
        if (region.contested !== t.to || held !== before) applied.push({ kind: "contest", region: t.region, by: t.to, holder: region.controller, held, ...(before ? { was: before } : {}) });
        region.contested = t.to;
        region.held = held;
        if (t.taken) region.taken = t.taken;
        else delete region.taken;
        settleMajority(region, t.rest);
        continue;
      }
    }
    // Taking the whole province ends the fight for it.
    delete region.contested;
    delete region.held;
    delete region.taken;
    const mode = falls ? "occupy" : t.mode;
    if (mode === "occupy") {
      // Taking back your own land under occupation is a liberation, not an occupation.
      if (region.owner === t.to) {
        if (region.controller === t.to) continue;
        applied.push({ kind: "liberate", region: t.region, from: region.controller, to: t.to });
      } else {
        if (region.controller === t.to) continue;
        applied.push({ kind: "occupy", region: t.region, from: region.controller, to: t.to });
      }
      region.controller = t.to;
    } else {
      if (region.owner === t.to && region.controller === t.to) continue;
      applied.push({ kind: mode as "annex" | "liberate", region: t.region, from: region.owner, to: t.to });
      region.owner = t.to;
      region.controller = t.to;
    }
    // A country that gains land is no longer a movement without territory.
    if (next.countries[t.to]?.dormant) delete next.countries[t.to].dormant;
  }
  // An ally's land the fighting took back from the enemy goes back to the ally now, while they still fight the same enemy –
  // before a peace in the same turn leaves the liberator holding a country's land it is at war with no longer.
  for (const { id, from: holder } of returnToAllies(next)) applied.push({ kind: "liberate", region: id, from: holder, to: next.regions[id].owner });

  outcome.warsStarted.forEach((w, i) => {
    const war: War = { id: `w${state.turn}-${i + 1}`, name: w.name, attackers: w.attackers, defenders: w.defenders, since: from };
    next.wars.push(war);
    applied.push({ kind: "war", war: war.id, name: war.name, sides: [...war.attackers, ...war.defenders] });
  });

  for (const j of outcome.warsJoined) {
    const war = matchByName(next.wars, j.war);
    if (!war || war.attackers.includes(j.country) || war.defenders.includes(j.country)) continue;
    war[j.side].push(j.country);
    applied.push({ kind: "enter", war: war.id, name: war.name, country: j.country, side: j.side });
  }

  // Peace returns occupied land to its owner unless the treaty annexed it,
  // which the model reports as an annex transfer in the same turn.
  for (const e of outcome.warsEnded) {
    const war = matchByName(next.wars, e.war);
    if (war) endWar(next, war, applied);
  }

  // A war is over once a whole side has been annexed: nobody is left to fight
  // for. Countries that never held land (a republic waiting to break away)
  // are not conquered, and a side with allies still standing fights on.
  const owners = new Set(Object.values(next.regions).map((r) => r.owner));
  // The player is never conquered this way: a government with no land fights on in exile.
  const conquered = (side: string[]) => side.length > 0 && side.every((tag) => tag !== next.player && !owners.has(tag) && !next.countries[tag]?.dormant);
  for (const war of [...next.wars]) {
    if (!conquered(war.attackers) && !conquered(war.defenders)) continue;
    next.wars = next.wars.filter((w) => w.id !== war.id);
    applied.push({ kind: "peace", war: war.id, name: war.name, sides: [...war.attackers, ...war.defenders] });
    const sides = new Set([...war.attackers, ...war.defenders]);
    for (const region of Object.values(next.regions)) {
      if (region.contested && sides.has(region.contested) && sides.has(region.controller)) {
        delete region.contested;
        delete region.held;
        delete region.taken;
      }
    }
  }

  outcome.alliancesFormed.forEach((a, i) => {
    const id = `a${state.turn}-${i + 1}`;
    next.alliances.push({
      id,
      name: a.name,
      members: a.members,
      since: from,
      ...(a.kind !== "alliance" ? { kind: a.kind } : {}),
      ...(a.until && a.until > from ? { until: a.until } : {}),
      ...(a.terms ? { terms: a.terms } : {}),
    });
    applied.push({ kind: "alliance", alliance: id, name: a.name, members: [...a.members] });
  });

  for (const j of outcome.alliancesJoined) {
    const alliance = matchByName(next.alliances, j.alliance);
    if (!alliance || alliance.members.includes(j.country)) continue;
    alliance.members.push(j.country);
    applied.push({ kind: "accession", alliance: alliance.id, name: alliance.name, country: j.country });
  }

  for (const l of outcome.alliancesLeft) {
    const alliance = matchByName(next.alliances, l.alliance);
    if (!alliance || !alliance.members.includes(l.country)) continue;
    alliance.members = alliance.members.filter((m) => m !== l.country);
    applied.push({ kind: "leave", alliance: alliance.id, name: alliance.name, country: l.country });
  }
  // A bloc that members' leaving brings below two is over; one that never had two is dropped without a word.
  for (const a of next.alliances) {
    const was = state.alliances.find((x) => x.id === a.id);
    if (a.members.length < 2 && was && was.members.length >= 2) applied.push({ kind: "alliance-ended", alliance: a.id, name: a.name, members: [...was.members] });
  }
  next.alliances = next.alliances.filter((a) => a.members.length >= 2);
  // Plans at action are carried out: what the answer did counts, what it left out the engine does.
  if (next.plans) carryOutPlans(next, plans, { turn: state.turn, from }, applied);

  // Who has a new leader this turn, and of those who replaced one in office (rather than filling a name a fall left empty).
  const named = new Set<string>();
  const replaced = new Set<string>();
  for (const l of outcome.leaders) {
    const country = next.countries[l.country];
    if (country.leader === l.leader) continue;
    if (country.leader) replaced.add(l.country);
    named.add(l.country);
    country.leader = l.leader;
    if (l.government) country.government = l.government;
    applied.push({ kind: "leader", country: l.country, leader: l.leader });
  }

  const held = applyForeign(next, outcome, { from, to, turn: state.turn, findWar: (key) => matchByName(next.wars, key) }, applied);
  if (next.politics) next.politics = applyPolitics(next.politics, outcome.politics, { turn: state.turn, to }, applied);
  // A government whose party lost the vote has fallen with it (engine/role.ts).
  const election = Boolean(outcome.politics?.election);
  checkElectionDefeat(state, next, { turn: state.turn, to, election }, applied);
  // Hardship keeps people restless whatever the game master writes: a floor under unrest from the crises the turn began with.
  if (next.politics && regions) {
    const floor = unrestFloor(countryCrises(state, state.player, { accounts: nationalAccounts(state, regions).get(state.player), map: regions }));
    if (next.politics.unrest < floor) next.politics = { ...next.politics, unrest: floor };
  }
  next.protests = applyProtests(state.protests ?? [], outcome.protests, { turn: state.turn, to, resolve: (id) => (next.regions[id] ? id : undefined), player: state.player, exists: (t) => Boolean(next.countries[t]) }, applied);
  if (!next.protests.length) delete next.protests;
  if (outcome.overthrow) applyOverthrow(next, outcome.overthrow, { turn: state.turn, to }, applied);
  updateExile(next, outcome.exileHost, { to }, applied);
  // The player's movement, when the player leads the opposition: the state's dice, the period's changes, and power if it is taken.
  applyOpposition(next, outcome.opposition, repression, { to, election }, applied);
  // The player's appointments since the last turn go into its record; events then change the government.
  for (const p of state.personnel ?? []) applied.push({ kind: "official", post: p.post, title: p.title, name: p.to, change: "appointed" });
  delete next.personnel;
  applyOfficials(next, outcome.officials, { to }, applied);
  applyIntrigues(next, intrigues, { turn: state.turn, to, seed: state.seed ?? state.id }, applied);
  // The player's person: a minister's or a general's standing and way up, and the falls the dice decided (engine/fate.ts).
  applyFate(state, next, outcome.figure, fate, { turn: state.turn, to }, applied);
  applySanctions(next, outcome.sanctions, { to }, applied);
  // The player's proclamations take effect as the turn ends, the acts the orders asked for with them; bills get their verdicts.
  applyProclamation(next, state.proclamation, applied);
  applyProclamation(next, proclamationOf(outcome.acts ?? []), applied);
  applyBills(next, outcome.bills, { turn: state.turn, to }, applied);
  applyDeals(next, outcome.trade, { turn: state.turn, to }, applied);
  // Money paid this period arrives before the books are kept.
  applyFunds(next, outcome.funds, applied);
  if (state.budgetSet && governs(state)) applied.push({ kind: "budget", country: state.player });
  // The cabinet's factions and plots, once the turn's government, laws, deals and budget have landed (engine/intrigue.ts).
  applyCabinet(next, state, outcome.cabinet ?? [], { turn: state.turn, to }, applied);
  delete next.budgetSet;
  if (regions) losePopulation(next.regions, regions, outcome.population, years, applied, (a, b) => Boolean(warBetween(next, a, b)));
  // Each ministry's brief for the report its minister writes after the turn; what is done or failed leaves the list of directives.
  const briefs = briefsFor(state, outcome.ministries);
  const closed = new Set(briefs.flatMap((b) => b.directives.filter((d) => d.status !== "progress").map((d) => d.id)));
  if (next.directives) next.directives = next.directives.filter((d) => !closed.has(d.id));
  // Once the borders are settled, a side with no war against a province's holder leaves its fight there, an ally's
  // land taken back from the enemy goes back to the ally,
  for (const { id, by, holder } of clearOrphanFronts(next)) applied.push({ kind: "repel", region: id, by, holder });
  for (const { id, from: holder } of returnToAllies(next)) applied.push({ kind: "liberate", region: id, from: holder, to: next.regions[id].owner });
  // and the land the front has left behind counts as its captor's until a peace.
  if (neighbors) for (const id of markBehind(next.regions, next.wars, neighbors)) applied.push({ kind: "behind", region: id, from: next.regions[id].owner, to: next.regions[id].controller });

  // Economies move after the borders do, so production follows who holds the land.
  if (regions) next = seedEconomies(next, regions);
  const economies = advanceEconomies(next, outcome.economy, years, regions, regions ? sanctionCuts(next, regions) : new Map(), regions ? sanctionExportCuts(next, regions) : new Map());
  // GDP and taxes follow land and people gained or lost (economy.ts).
  if (regions && grown) followLand(grown, next.regions, regions, state.scenarioId, economies, (tag) => Boolean(state.countries[tag]?.economy));
  // Deals in force pay out and deliver over the turn.
  settleDeals(next, economies, years, regions);
  for (const [tag, economy] of Object.entries(economies)) next.countries[tag].economy = economy;
  // The split of the research money a directive shifted; weapons are then built at the level research had reached, retired and lost.
  applyResearchWords(next, outcome.arms.research, applied);
  // Arms given in kind come out of the giver's stores; arms bought by contract are newly made for the buyer.
  const deliveries = [
    ...outcome.funds.filter((f) => f.kind === "arms").map((f) => ({ from: f.from, to: f.to, money: f.amount, fromStock: Boolean(state.countries[f.from]) })),
    ...(state.deals ?? [])
      .filter((d) => d.status === "active" && d.good === "arms")
      .map((d) => ({ from: d.side === "buy" ? d.partner : state.player, to: d.side === "buy" ? state.player : d.partner, money: d.value * years, fromStock: false })),
  ];
  const armsLost = new Map<string, Partial<Record<WeaponKind, number>>>();
  // What the period's fighting cost each side, province by province, once the fronts have moved (engine/warLosses.ts); with the map only.
  const exchange = regions && neighbors ? warExchange(state, next, { neighbors, regions }, years) : undefined;
  advanceArsenals(next, state, outcome.arms, years, regions, applied, deliveries, armsLost, exchange);
  // Each war's record of what it cost: the answer's dead and wounded within what the fighting allows, else the engine's; the weapons lost split between a country's wars.
  recordWarLosses(next, state, outcome.warLosses ?? [], years, armsLost, exchange);
  // Research runs on the period's budget (engine/research.ts).
  advanceResearch(next, years, applied, to);
  // Politics abroad follow the economies and the war; then the dice land.
  const regimes = new Map(outcome.newCountries.flatMap((c) => (c.regime ? [[c.tag, c.regime] as const] : [])));
  applyAbroad(next, abroad, { to, years, named, replaced, map: regions, regimes }, applied);
  // Occupied land resists, partisans take their toll, war-weariness holds support down, and a side whose will has broken seeks terms (engine/warMeans.ts).
  applyWarMeans(state, next, { to, years, map: regions, neighbors });
  // The people the war took and the births it cost, the sectors programmes moved (engine/society.ts).
  if (regions) advanceSociety(state, next, years, regions);
  // Courses and plans follow: what the turn taught each government, new governments' courses, new plans.
  advanceIntentions(state, next, { turn: state.turn, from, to, years, regions, neighbors, events: outcome.events, incidents }, applied);
  const before = state.countries[state.player]?.economy;
  const after = next.countries[state.player]?.economy;
  const borders = bordersBefore(state.regions, next.regions);

  const entry: ChronicleEntry = {
    turn: state.turn,
    from,
    to,
    orders,
    ...(outcome.verdicts.length ? { verdicts: outcome.verdicts } : {}),
    headline: outcome.headline,
    narrative: outcome.narrative,
    events: outcome.events,
    applied,
    ...(before && after
      ? { economy: { before: { ...snapshot(before), ...(regions ? { people: Math.round(peopleBefore) } : {}) }, after: { ...snapshot(after), ...(regions ? { people: Math.round(peopleOf(next, regions, state.player)) } : {}) } } }
      : {}),
    ...(held.length ? { summits: held } : {}),
    ...(briefs.length ? { briefs } : {}),
    ...(Object.keys(borders).length ? { borders } : {}),
  };
  next.chronicle.push(entry);
  next.date = to;
  next.turn = state.turn + 1;
  next.draft = [];
  next.updatedAt = now.toISOString();
  // Every leader line that changed is read again into people, with the sex the game master gave a new leader.
  syncRulers(next, new Map(outcome.leaders.flatMap((l) => (l.gender ? [[l.country, l.gender] as const] : []))));
  return next;
}

/** Regions a country owns; zero means it has fallen (it can still play on, in exile). */
export function ownedRegions(state: GameState, country: string): number {
  let n = 0;
  for (const region of Object.values(state.regions)) if (region.owner === country) n += 1;
  return n;
}

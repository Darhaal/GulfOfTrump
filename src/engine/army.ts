import { z } from "zod";
import { yearOf } from "./calendar";
import { roll } from "./dice";
import type { Laws } from "./laws";
import type { ArmyMen, ArmyOrganisation, CountryState, Formation, GameState } from "./types";

/**
 * The men of an army by their training: career soldiers (officers, NCOs and
 * long-serving regulars), conscripts already trained, and recruits still in
 * training, all in thousands, adding up to the economy's soldiers. The
 * call-up adds recruits, time turns recruits into trained soldiers, and war
 * wears down all three. Training counts in a war's strength: a career
 * soldier weighs more than a conscript, a recruit about half.
 *
 * Also the army's organisation as the game master last described it for
 * the player: its armies, fleets and air forces, their divisions and where
 * they stand (the route /api/game/army).
 */

/** Countries whose armies were all volunteers, from the year given. */
const VOLUNTEER_SINCE: Record<string, number> = {
  uk: 1963,
  usa: 1973,
  canada: 0,
  australia: 1973,
  "new-zealand": 1973,
  ireland: 0,
  india: 0,
  pakistan: 0,
  japan: 1946,
  "south-africa": 1994,
  netherlands: 1996,
  belgium: 1995,
  france: 2001,
  spain: 2001,
  italy: 2005,
  czechia: 2005,
  hungary: 2004,
  romania: 2007,
  bulgaria: 2008,
  poland: 2009,
  germany: 2011,
  argentina: 1995,
};

/** The career share of a conscript army, by era: thin cadres in 1914, more professional with every decade. */
const careerShare = (year: number) => (year < 1930 ? 0.15 : year < 1950 ? 0.18 : year < 1980 ? 0.22 : year < 2005 ? 0.28 : 0.35);

/** Months of basic training a recruit needs, by era. */
export const trainingMonths = (year: number) => (year < 1950 ? 3 : 4);

/** A career soldier, a trained conscript and a recruit, against a trained conscript. */
export const TRAINING_WEIGHT = { pro: 1.25, trained: 1, recruits: 0.55 } as const;

/** The share of an army's men by training when nothing tracks it yet: by the conscription law where known, else by the era and the country. */
export function defaultShares(tag: string, year: number, laws?: Pick<Laws, "conscription">): ArmyMen {
  const volunteer = laws?.conscription ? laws.conscription === "volunteer" : (VOLUNTEER_SINCE[tag] ?? Infinity) <= year;
  if (volunteer) return { pro: 0.88, trained: 0.07, recruits: 0.05 };
  const pro = Math.min(0.6, careerShare(year) + (laws?.conscription === "selective" ? 0.15 : 0));
  const recruits = 0.08;
  return { pro, trained: 1 - pro - recruits, recruits };
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/** Shares of a total, in thousands, the rounding left in the trained. */
function split(total: number, shares: ArmyMen): ArmyMen {
  const pro = round1(total * shares.pro);
  const recruits = round1(total * shares.recruits);
  return { pro, trained: round1(Math.max(0, total - pro - recruits)), recruits };
}

export const menTotal = (m: ArmyMen) => m.pro + m.trained + m.recruits;

/**
 * A country's men by training, adding up to its soldiers: what the engine
 * tracks, scaled to the soldiers if the two have drifted apart, or the
 * default split of its era and law.
 */
export function menOf(state: Pick<GameState, "date"> & Partial<Pick<GameState, "player" | "politics">>, c: Pick<CountryState, "tag" | "economy" | "arsenal"> | undefined): ArmyMen {
  const troops = c?.economy?.troops ?? 0;
  if (!c || troops <= 0) return { pro: 0, trained: 0, recruits: 0 };
  const kept = c.arsenal?.men;
  const total = kept ? menTotal(kept) : 0;
  if (kept && total > 0) {
    if (Math.abs(total - troops) < 0.5) return kept;
    const k = troops / total;
    return split(troops, { pro: (kept.pro * k) / troops, trained: (kept.trained * k) / troops, recruits: (kept.recruits * k) / troops });
  }
  const laws = c.tag === state.player ? state.politics?.laws : undefined;
  return split(troops, defaultShares(c.tag, yearOf(state.date), laws));
}

/** An army's men on its start date: the split of its era. */
export const startingMen = (tag: string, troops: number, year: number): ArmyMen => split(Math.max(0, troops), defaultShares(tag, year));

/** How much an army's training adds to its numbers: 1 for trained conscripts, up to 1.25 for career soldiers, about half for recruits. */
export function trainingQuality(m: ArmyMen): number {
  const total = menTotal(m);
  if (total <= 0) return 1;
  return (TRAINING_WEIGHT.pro * m.pro + TRAINING_WEIGHT.trained * m.trained + TRAINING_WEIGHT.recruits * m.recruits) / total;
}

/**
 * The men after a period of `months`: recruits finish their training, a
 * few conscripts sign on in peace, and the army grows by recruits or
 * shrinks — in war across all three, recruits worst; in peace the newest
 * go home first.
 */
export function advanceMen(before: ArmyMen, troopsAfter: number, months: number, year: number, atWar: boolean): ArmyMen {
  const m = { ...before };
  const trained = m.recruits * (1 - (1 - 1 / trainingMonths(year)) ** Math.max(0, months));
  m.recruits -= trained;
  m.trained += trained;
  if (!atWar) {
    const signed = m.trained * 0.03 * (months / 12);
    m.trained -= signed;
    m.pro += signed;
  }
  const change = troopsAfter - menTotal(m);
  if (change > 0) m.recruits += change;
  else if (change < 0) {
    let cut = -change;
    if (atWar) {
      // The fighting takes from all three, recruits hardest.
      const weights = { pro: m.pro, trained: m.trained, recruits: m.recruits * 1.4 };
      const sum = weights.pro + weights.trained + weights.recruits;
      if (sum > 0) for (const k of ["pro", "trained", "recruits"] as const) m[k] -= Math.min(m[k], (weights[k] / sum) * cut);
      cut = menTotal(m) - troopsAfter;
    }
    for (const k of ["recruits", "trained", "pro"] as const) {
      if (cut <= 0) break;
      const take = Math.min(m[k], cut);
      m[k] -= take;
      cut -= take;
    }
  }
  const out = { pro: round1(Math.max(0, m.pro)), trained: round1(Math.max(0, m.trained)), recruits: round1(Math.max(0, m.recruits)) };
  // Rounding stays in the trained, so the three add up to the soldiers.
  out.trained = round1(Math.max(0, troopsAfter - out.pro - out.recruits));
  return out;
}

/**
 * A count as the army's own books would give it rather than a round
 * estimate: what the engine keeps in thousands (rifles, soldiers) in single
 * units, and a round count of pieces with a small tail. The tail is fixed by
 * the game, the country, what is counted and the turn, so a turn reads the
 * same every time it is looked at; it moves the shown figure by well under a
 * per cent and changes nothing the engine counts.
 */
export function tally(n: number, game: string, turn: number, key: string, unit: "thousands" | "pieces" = "pieces"): number {
  if (!(n > 0)) return 0;
  const r = roll(game, turn, `tally:${key}`);
  if (unit === "thousands") return Math.max(1, Math.round(n * 1000 - 500 + r * 1000));
  const whole = Math.round(n);
  if (whole < 100 || whole % 10 !== 0) return whole;
  const spread = Math.max(1, Math.min(9, Math.round(whole * 0.002)));
  return whole + Math.round((r * 2 - 1) * spread);
}

/** Thousands of men in a division (or its equivalent in brigades), by era. */
export const divisionSize = (year: number) => (year < 1930 ? 18 : year < 1950 ? 15 : year < 1980 ? 13 : 10);

/** The share of an army's men in its fighting divisions; the rest serve behind them. */
const IN_DIVISIONS = 0.55;

/** About how many divisions so many thousand soldiers make, in a year. */
export const divisionsOf = (troops: number, year: number) => Math.round((troops * IN_DIVISIONS) / divisionSize(year));

/** The most divisions the game master may give an army: all its men in divisions. */
export const maxDivisions = (troops: number, year: number) => Math.max(1, Math.ceil(troops / divisionSize(year)));

export const FORMATION_KINDS = ["front", "army", "corps", "fleet", "air", "reserve"] as const;

/** The army's organisation, as the game master writes it. */
export const ArmyOrganisationSchema = z.object({
  formations: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        kind: z.enum(FORMATION_KINDS).catch("army").default("army"),
        divisions: z.number().finite().catch(0).default(0),
        commander: z.string().trim().max(80).catch("").default(""),
        theatre: z.string().trim().max(80).catch("").default(""),
        provinces: z.array(z.string().trim()).max(40).catch([]).default([]),
        note: z.string().trim().max(240).catch("").default(""),
      }),
    )
    .max(16)
    .catch([])
    .default([]),
});

export type ArmyOrganisationReply = z.infer<typeof ArmyOrganisationSchema>;

/** Provinces the player's armies can stand in: its own land and what it holds or contests. */
export function armyGround(state: Pick<GameState, "regions" | "player">): Set<string> {
  const out = new Set<string>();
  for (const [id, r] of Object.entries(state.regions)) if (r.controller === state.player || r.contested === state.player || r.owner === state.player) out.add(id);
  return out;
}

/**
 * The organisation checked against the state: only provinces the player
 * holds, owns or fights in; whole divisions; no more divisions than its
 * soldiers can fill (scaled down together when the answer claims more);
 * fleets and air forces may have none. Named once each.
 */
export function sanitizeArmyOrganisation(state: Pick<GameState, "regions" | "player" | "countries" | "date" | "turn">, reply: ArmyOrganisationReply): ArmyOrganisation {
  const ground = armyGround(state);
  const year = yearOf(state.date);
  const troops = state.countries[state.player]?.economy?.troops ?? 0;
  const seen = new Set<string>();
  let formations: Formation[] = [];
  for (const f of reply.formations) {
    const key = f.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const provinces = [...new Set(f.provinces.filter((id) => ground.has(id)))].slice(0, 24);
    const divisions = Math.max(0, Math.round(f.divisions));
    if (!divisions && f.kind !== "fleet" && f.kind !== "air") continue;
    formations.push({
      name: f.name,
      kind: f.kind,
      divisions,
      ...(f.commander ? { commander: f.commander } : {}),
      ...(f.theatre ? { theatre: f.theatre } : {}),
      provinces,
      ...(f.note ? { note: f.note } : {}),
    });
  }
  const cap = maxDivisions(troops, year);
  const claimed = formations.reduce((sum, f) => sum + f.divisions, 0);
  if (claimed > cap) {
    const k = cap / claimed;
    formations = formations.map((f) => ({ ...f, divisions: Math.floor(f.divisions * k) })).filter((f) => f.divisions > 0 || f.kind === "fleet" || f.kind === "air");
  }
  return { date: state.date, turn: state.turn, formations };
}

/** The player's organisation, with the date and turn it was described at. */
export function setArmyOrganisation<T extends Pick<GameState, "countries" | "player" | "updatedAt">>(state: T, organisation: ArmyOrganisation, now = new Date()): T {
  const country = state.countries[state.player];
  if (!country?.arsenal) return state;
  return { ...state, countries: { ...state.countries, [state.player]: { ...country, arsenal: { ...country.arsenal, organisation } } }, updatedAt: now.toISOString() };
}

/** Every country with weapons gets its men by training, by the default split of its era and law. */
export function seedMen<T extends Pick<GameState, "countries" | "date"> & Partial<Pick<GameState, "player" | "politics">>>(state: T): T {
  const countries = { ...state.countries };
  let changed = false;
  for (const c of Object.values(state.countries)) {
    if (!c.arsenal || !c.economy || c.arsenal.men) continue;
    countries[c.tag] = { ...c, arsenal: { ...c.arsenal, men: menOf(state, c) } };
    changed = true;
  }
  return changed ? { ...state, countries } : state;
}

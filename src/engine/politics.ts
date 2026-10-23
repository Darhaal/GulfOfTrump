import { z } from "zod";
import { slug } from "./text";
import type { AppliedChange, GameState, Loyalty, Parliament, Party, PartyStance, Plot, Politics } from "./types";
import { PILLARS } from "./types";
import { applyLaws, describeLaws, lawsShape, startLaws } from "./laws";

/**
 * The player's domestic politics: the regime, the parties with their support
 * and their place on three axes (economy left–right, authoritarian–liberal,
 * open–nationalist), how their ideas drift, elections, unrest and plots.
 * The landscape is first described by the model for the country and date
 * (POLITICS_SETUP), then moved every turn by the "politics" part of the
 * outcome, limited here: support adds up to 100, ideas drift at most a few
 * points a turn, unrest and plot strength stay within 0–100. Parliament
 * seats change at elections (by the model's figures, or shared out by the
 * D'Hondt method above the threshold), by defections and by bans.
 */

export const PARTY_STATUSES = ["ruling", "coalition", "opposition", "underground", "banned"] as const;
export const PLOT_KINDS = ["coup", "conspiracy", "protest", "strike", "insurgency", "sabotage"] as const;
export const PLOT_OUTCOMES = ["active", "foiled", "succeeded", "faded"] as const;

/** How far a party's ideas may move on one axis in one turn. */
export const MAX_DRIFT = 3;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const shortText = z.string().trim().max(300);
const axis = z.number().finite();
const stance = z.object({ economy: axis.default(0), freedom: axis.default(0), nation: axis.default(0) });

const seats = z.number().finite().min(0).optional().catch(undefined);
const color = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).optional().catch(undefined);
const short = z.string().trim().min(1).max(8).optional().catch(undefined);

const party = z.object({
  name: shortText.min(1),
  short,
  leader: shortText.optional(),
  ideology: shortText.default(""),
  support: z.number().finite().default(0),
  status: z.enum(PARTY_STATUSES).catch("opposition").default("opposition"),
  stance: stance.default({ economy: 0, freedom: 0, nation: 0 }),
  seats,
  color,
});

const parliament = z
  .object({ name: shortText.min(1), seats: z.number().int().min(1).max(5000), threshold: z.number().finite().min(0).max(20).optional().catch(undefined) })
  .optional()
  .catch(undefined);

const plot = z.object({
  title: shortText.min(1),
  by: shortText.default(""),
  kind: z.enum(PLOT_KINDS).catch("conspiracy").default("conspiracy"),
  strength: z.number().finite().default(20),
  known: z.boolean().default(false),
});

/** How far a pillar's loyalty can move in one turn. */
export const MAX_LOYALTY_SWING = 15;

const pillar = z.number().finite().optional().catch(undefined);
const loyaltyShape = z.object({ army: pillar, police: pillar, security: pillar, elites: pillar }).optional().catch(undefined);

/** Loyalty when nobody has said: the calmer the country, the more loyal its pillars. */
export function defaultLoyalty(unrest: number): Loyalty {
  const base = 70 - unrest / 4;
  return { army: clamp(Math.round(base), 0, 100), police: clamp(Math.round(base + 5), 0, 100), security: clamp(Math.round(base + 5), 0, 100), elites: clamp(Math.round(base - 5), 0, 100) };
}

/** The pillars' loyalty, with a default for saves from before it was kept. */
export const loyaltyOf = (p: Pick<Politics, "loyalty" | "unrest">): Loyalty => p.loyalty ?? defaultLoyalty(p.unrest);

/** The model's first description of a country's politics. */
export const PoliticsSetupSchema = z.object({
  regime: shortText.min(1),
  unrest: z.number().finite().default(20),
  loyalty: loyaltyShape,
  laws: lawsShape,
  nextElection: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  parliament,
  parties: z.array(party).min(1).max(10),
  plots: z.array(plot).max(4).default([]),
});

/** What a turn changes in the player's politics (merged into OutcomeSchema as `politics`). */
export const politicsField = z
  .object({
    regime: shortText.optional(),
    unrest: z.number().finite().optional(),
    loyalty: loyaltyShape,
    laws: lawsShape,
    nextElection: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().catch(undefined),
    parliament,
    parties: z
      .array(
        z.object({
          party: shortText.min(1),
          leader: shortText.optional(),
          ideology: shortText.optional(),
          support: z.number().finite().optional(),
          status: z.enum(PARTY_STATUSES).optional().catch(undefined),
          stance: z.object({ economy: axis.optional(), freedom: axis.optional(), nation: axis.optional() }).optional(),
          seats,
          color,
          short,
        }),
      )
      .max(12)
      .default([]),
    removed: z.array(shortText.min(1)).max(6).default([]),
    election: z
      .object({ results: z.array(z.object({ party: shortText.min(1), share: z.number().finite(), seats })).min(1).max(12), note: shortText.default("") })
      .optional(),
    plots: z
      .array(plot.extend({ outcome: z.enum(PLOT_OUTCOMES).catch("active").default("active") }))
      .max(6)
      .default([]),
  })
  .optional();

export type PoliticsChange = NonNullable<z.infer<typeof politicsField>>;

const round = (v: number) => Math.round(v * 10) / 10;
const clampStance = (s: Partial<PartyStance>, from?: PartyStance): PartyStance => {
  const at = (key: keyof PartyStance) => {
    const target = clamp(s[key] ?? from?.[key] ?? 0, -10, 10);
    return round(from ? clamp(target, from[key] - MAX_DRIFT, from[key] + MAX_DRIFT) : target);
  };
  return { economy: at("economy"), freedom: at("freedom"), nation: at("nation") };
};

/** Shares rescaled to add up to 100, one decimal. */
function normalise(parties: Party[]): Party[] {
  const total = parties.reduce((s, p) => s + Math.max(0, p.support), 0);
  if (total <= 0) return parties;
  return parties.map((p) => ({ ...p, support: round((Math.max(0, p.support) / total) * 100) }));
}

const uniqueId = (name: string, taken: Set<string>) => {
  const base = slug(name) || "party";
  let id = base;
  for (let i = 2; taken.has(id); i += 1) id = `${base}-${i}`;
  taken.add(id);
  return id;
};

/**
 * The player's politics before the game master has described the parties:
 * only how restless the country is, from the scenario's old stability
 * figure. The parties come with the first description, or as the turns
 * bring them.
 */
export function startingPolitics(stability = 60): Politics {
  const unrest = clamp(Math.round((100 - stability) * 0.6 + 5), 0, 100);
  return { regime: "", unrest, loyalty: defaultLoyalty(unrest), parties: [], plots: [] };
}

/** A save from before every player had politics gets the skeleton. */
export function ensurePolitics<T extends Pick<GameState, "politics" | "player" | "countries">>(state: T): T {
  if (state.politics) return state;
  return { ...state, politics: startingPolitics(state.countries[state.player]?.stats?.stability) };
}

/**
 * Seats shared out by the D'Hondt method among the parties above the
 * threshold (all of them if none clears it).
 */
export function allocateSeats(shares: { id: string; share: number }[], total: number, threshold = 5): Map<string, number> {
  const above = shares.filter((s) => s.share >= threshold && s.share > 0);
  const pool = above.length ? above : shares.filter((s) => s.share > 0);
  const out = new Map(shares.map((s) => [s.id, 0]));
  if (!pool.length) return out;
  for (let i = 0; i < total; i++) {
    let best = pool[0];
    let quotient = -1;
    for (const s of pool) {
      const q = s.share / ((out.get(s.id) ?? 0) + 1);
      if (q > quotient) {
        quotient = q;
        best = s;
      }
    }
    out.set(best.id, (out.get(best.id) ?? 0) + 1);
  }
  return out;
}

/** Seats as whole numbers that never add up to more than the parliament has. */
function fitSeats(parties: Party[], total: number | undefined): Party[] {
  const list = parties.map((p) => (p.seats === undefined ? p : { ...p, seats: Math.max(0, Math.round(p.seats)) }));
  if (!total) return list;
  const sum = list.reduce((s, p) => s + (p.seats ?? 0), 0);
  if (sum <= total) return list;
  const scaled = allocateSeats(list.map((p) => ({ id: p.id, share: p.seats ?? 0 })), total, 0);
  return list.map((p) => (p.seats === undefined ? p : { ...p, seats: scaled.get(p.id) ?? 0 }));
}

/** The seats of the government: its ruling party and coalition partners. */
export function governmentSeats(politics: Pick<Politics, "parties">): number {
  return politics.parties.filter((p) => p.status === "ruling" || p.status === "coalition").reduce((s, p) => s + (p.seats ?? 0), 0);
}

/** Politics as the model first describes it, made consistent. */
export function startPolitics(raw: z.infer<typeof PoliticsSetupSchema>, date: string): Politics {
  const taken = new Set<string>();
  const parties = normalise(
    raw.parties.map((p) => ({
      id: uniqueId(p.name, taken),
      name: p.name,
      ...(p.leader ? { leader: p.leader } : {}),
      ideology: p.ideology,
      support: clamp(p.support, 0, 100),
      status: p.status,
      stance: clampStance(p.stance),
      ...(p.seats !== undefined ? { seats: p.seats } : {}),
      ...(p.color ? { color: p.color } : {}),
      ...(p.short ? { short: p.short } : {}),
    })),
  );
  const start = defaultLoyalty(raw.unrest);
  return {
    regime: raw.regime,
    ...(raw.parliament ? { parliament: raw.parliament } : {}),
    unrest: clamp(Math.round(raw.unrest), 0, 100),
    loyalty: Object.fromEntries(PILLARS.map((k) => [k, clamp(Math.round(raw.loyalty?.[k] ?? start[k]), 0, 100)])) as Loyalty,
    ...(startLaws(raw.laws) ? { laws: startLaws(raw.laws) } : {}),
    ...(raw.nextElection && raw.nextElection > date ? { nextElection: raw.nextElection } : {}),
    parties: fitSeats(parties, raw.parliament?.seats),
    plots: raw.plots.map((p, i) => ({ id: `plot-0-${i + 1}`, title: p.title, by: p.by, kind: p.kind, strength: clamp(Math.round(p.strength), 0, 100), known: p.known, since: date })),
  };
}

const findParty = (parties: Party[], key: string) => {
  const needle = key.trim().toLowerCase();
  return parties.find((p) => p.id === needle || p.name.trim().toLowerCase() === needle);
};

/**
 * One turn of politics: parties move (ideas within MAX_DRIFT), new ones
 * appear, some dissolve, an election sets support from its results, plots
 * grow, are found out, foiled or succeed. Returns the new politics and logs
 * what the player should read in the report.
 */
export function applyPolitics(current: Politics, change: PoliticsChange | undefined, ctx: { turn: number; to: string }, applied: AppliedChange[]): Politics {
  const before = new Map(current.parties.map((p) => [p.id, p]));
  let parties: Party[] = current.parties.map((p) => ({ ...p, was: p.stance, trend: 0 }));
  const taken = new Set(parties.map((p) => p.id));
  if (change) {
    for (const u of change.parties) {
      const existing = findParty(parties, u.party);
      if (existing) {
        if (u.leader) existing.leader = u.leader;
        if (u.ideology) existing.ideology = u.ideology;
        if (u.support !== undefined) existing.support = clamp(u.support, 0, 100);
        if (u.status && u.status !== existing.status) {
          existing.status = u.status;
          applied.push({ kind: "party", party: existing.name, change: u.status });
        }
        if (u.stance) existing.stance = clampStance(u.stance, existing.stance);
        if (u.seats !== undefined) existing.seats = u.seats;
        if (u.color) existing.color = u.color;
        if (u.short) existing.short = u.short;
      } else {
        const created: Party = {
          id: uniqueId(u.party, taken),
          name: u.party,
          ...(u.leader ? { leader: u.leader } : {}),
          ideology: u.ideology ?? "",
          support: clamp(u.support ?? 2, 0, 100),
          status: u.status ?? "opposition",
          stance: clampStance(u.stance ?? {}),
          ...(u.seats !== undefined ? { seats: u.seats } : {}),
          ...(u.color ? { color: u.color } : {}),
          ...(u.short ? { short: u.short } : {}),
        };
        parties.push(created);
        applied.push({ kind: "party", party: created.name, change: "new" });
      }
    }
    for (const r of change.removed) {
      const gone = findParty(parties, r);
      if (!gone) continue;
      parties = parties.filter((p) => p.id !== gone.id);
      applied.push({ kind: "party", party: gone.name, change: "dissolved" });
    }
    if (change.election) {
      for (const result of change.election.results) {
        const p = findParty(parties, result.party);
        if (p) p.support = clamp(result.share, 0, 100);
      }
      // Seats: the model's figures where it gives them, else shared out by the vote.
      const house = change.parliament ?? current.parliament;
      if (house && !change.election.results.some((r) => r.seats !== undefined)) {
        const won = allocateSeats(
          parties.map((p) => ({ id: p.id, share: p.status === "banned" ? 0 : (change.election!.results.find((r) => findParty([p], r.party))?.share ?? 0) })),
          house.seats,
          house.threshold ?? 5,
        );
        for (const p of parties) p.seats = won.get(p.id) ?? 0;
      } else {
        for (const result of change.election.results) {
          const p = findParty(parties, result.party);
          if (p && result.seats !== undefined) p.seats = result.seats;
        }
      }
      const winner = [...change.election.results].sort((a, b) => b.share - a.share)[0];
      applied.push({ kind: "election", winner: findParty(parties, winner.party)?.name ?? winner.party, share: round(winner.share) });
    }
  }
  const house: Parliament | undefined = change?.parliament ?? current.parliament;
  parties = fitSeats(normalise(parties), house?.seats).map((p) => ({ ...p, trend: round(p.support - (before.get(p.id)?.support ?? 0)) }));

  // Plots: updated by title, new ones added, settled ones leave the list.
  let plots: Plot[] = current.plots.map((p) => ({ ...p }));
  for (const [i, u] of (change?.plots ?? []).entries()) {
    const needle = u.title.trim().toLowerCase();
    const existing = plots.find((p) => p.title.trim().toLowerCase() === needle);
    const plot: Plot = existing ?? { id: `plot-${ctx.turn}-${i + 1}`, title: u.title, by: u.by, kind: u.kind, strength: 0, known: false, since: ctx.to };
    plot.strength = clamp(Math.round(u.strength), 0, 100);
    if (u.known && !plot.known) applied.push({ kind: "plot", title: plot.title, change: "discovered" });
    plot.known = plot.known || u.known;
    if (!existing) plots.push(plot);
    if (u.outcome !== "active") {
      plots = plots.filter((p) => p !== plot);
      if (u.outcome !== "faded" || plot.known) applied.push({ kind: "plot", title: plot.title, change: u.outcome });
    }
  }

  const election = change?.election;
  const laws = applyLaws(current.laws, change?.laws, applied);
  // The pillars move slowly: at most MAX_LOYALTY_SWING a turn.
  const was = loyaltyOf(current);
  const loyalty = Object.fromEntries(
    PILLARS.map((k) => {
      const wanted = change?.loyalty?.[k];
      return [k, wanted === undefined ? was[k] : clamp(Math.round(clamp(wanted, was[k] - MAX_LOYALTY_SWING, was[k] + MAX_LOYALTY_SWING)), 0, 100)];
    }),
  ) as Loyalty;
  return {
    regime: change?.regime || current.regime,
    ...(house ? { parliament: house } : {}),
    unrest: clamp(Math.round(change?.unrest ?? current.unrest), 0, 100),
    loyalty,
    loyaltyWas: was,
    ...(laws ? { laws } : {}),
    ...(change?.nextElection === null
      ? {}
      : change?.nextElection && change.nextElection > ctx.to
        ? { nextElection: change.nextElection }
        : current.nextElection && current.nextElection >= ctx.to && !election
          ? { nextElection: current.nextElection }
          : {}),
    parties,
    plots,
    ...(election
      ? {
          lastElection: {
            date: ctx.to,
            results: election.results.map((r) => {
              const p = findParty(parties, r.party);
              return { party: p?.name ?? r.party, share: round(r.share), ...(p?.seats !== undefined ? { seats: p.seats } : {}) };
            }),
            note: election.note,
          },
        }
      : current.lastElection
        ? { lastElection: current.lastElection }
        : {}),
    // Sittings and talks held between turns stay on record (engine/parliament.ts, engine/talks.ts).
    ...(current.sessions ? { sessions: current.sessions } : {}),
    ...(current.talks ? { talks: current.talks } : {}),
  };
}

/** The player's politics as the model reads it every turn. */
export function describePolitics(politics: Politics): string[] {
  const house = politics.parliament;
  const held = governmentSeats(politics);
  const majority = house ? Math.floor(house.seats / 2) + 1 : 0;
  const lines = [
    "",
    `PLAYER'S DOMESTIC POLITICS: ${politics.regime || "the regime of the date"}; unrest ${politics.unrest}/100; ${politics.nextElection ? `next national election ${politics.nextElection}` : "no election scheduled"}`,
    `Loyalty of the pillars of power (0–100): army ${loyaltyOf(politics).army}, police ${loyaltyOf(politics).police}, security services ${loyaltyOf(politics).security}, elites ${loyaltyOf(politics).elites}${politics.loyaltyWas ? ` (a turn ago: ${PILLARS.map((k) => politics.loyaltyWas![k]).join(", ")})` : ""}`,
    describeLaws(politics.laws),
    house
      ? `Parliament: ${house.name}, ${house.seats} seats${house.threshold !== undefined ? `, threshold ${house.threshold}%` : ""}; the government (ruling party and coalition) holds ${held} — a majority needs ${majority}${held >= majority ? "" : ": THE GOVERNMENT HAS NO MAJORITY and must bargain for every law"}`
      : politics.parties.length
        ? "Parliament: not described yet — give politics.parliament (name, seats, threshold) and each party's seats this turn (or seats 0 where a regime's parliament does not really sit)."
        : "",
    politics.parties.length
      ? "Parties (name | short | leader | ideology | support % | seats | status | economy left-right, authoritarian-liberal, open-nationalist on -10..10 | support change last turn):"
      : "Parties: not described yet — add the ones that matter in politics.parties when they act.",
    ...politics.parties.map(
      (p) =>
        `- ${p.name} | ${p.short ?? "-"} | ${p.leader ?? "-"} | ${p.ideology} | ${p.support}% | ${p.seats ?? "?"} | ${p.status} | ${p.stance.economy}, ${p.stance.freedom}, ${p.stance.nation} | ${p.trend && p.trend > 0 ? "+" : ""}${p.trend ?? 0}`,
    ),
  ].filter((l, i) => i === 0 || l !== "");
  if (politics.plots.length) {
    lines.push("Plots against the government (title | by | kind | strength 0-100 | known to the government):");
    for (const p of politics.plots) lines.push(`- ${p.title} | ${p.by} | ${p.kind} | ${p.strength} | ${p.known ? "known" : "secret"}`);
  }
  return lines;
}

import { z } from "zod";
import { loyaltyOf } from "./politics";
import type { AppliedChange, CountryState, Defeat, GameState, Protest } from "./types";
import { PROTEST_STAGES } from "./types";

/**
 * The street and the fall of a government. Protests — against the player's
 * government or any other — climb a ladder (rallies, strikes, riots, an
 * uprising) one step a turn at most, or are dispersed, met with concessions,
 * or fade. Each has a size, public support, an organisation, maybe a foreign
 * backer, and its dead. A government falls only when it is weak: unrest is
 * high, an uprising is in the streets, plotters are ready, or the army or
 * police have stopped obeying — and with the army and police loyal, only a
 * coup from inside can bring it down. Otherwise an overthrow the model
 * reports was an attempt that failed. A government that loses all its land
 * is not overthrown: it goes into exile and fights on.
 */

const shortText = z.string().trim().max(300);

export const PROTEST_OUTCOMES = ["active", "dispersed", "conceded", "faded", "won"] as const;

/** What a turn says about protests (merged into OutcomeSchema as `protests`). */
export const protestsField = z
  .array(
    z.object({
      title: shortText.min(1),
      stage: z.enum(PROTEST_STAGES).catch("rally").default("rally"),
      size: z.number().finite().min(0).catch(0).default(0),
      where: z.array(z.string().trim().min(1).max(120)).max(8).default([]),
      demands: shortText.default(""),
      by: shortText.optional(),
      // Whose government it stands against (the player's when missing), and who backs it from abroad.
      country: z.string().trim().max(80).optional(),
      backer: z.string().trim().max(80).optional(),
      support: z.number().finite().optional().catch(undefined),
      organisation: z.number().finite().optional().catch(undefined),
      // Protesters killed in this period.
      killed: z.number().finite().optional().catch(undefined),
      outcome: z.enum(PROTEST_OUTCOMES).catch("active").default("active"),
    }),
  )
  .max(10)
  .default([]);

/** The player's government overthrown, as the model reports it (merged into OutcomeSchema as `overthrow`). */
export const overthrowField = z
  .object({
    // A model asked to leave the field out when nothing happened still fills it in now and then ("nobody, there was no coup"): only an explicit yes counts.
    happened: z.literal(true),
    how: z.enum(["coup", "revolution", "uprising", "deposed"]).catch("coup"),
    by: shortText.min(1),
    leader: shortText.optional(),
    government: shortText.optional(),
    note: z.string().trim().max(2000).default(""),
  })
  .optional()
  .catch(undefined);

/** Where a government can fall: unrest at or above this. */
export const FALL_UNREST = 65;
/** A coup plot at least this strong can bring a government down whatever the street. */
export const FALL_PLOT = 60;

/** Loyalty at which the army or police stop obeying; at or above the second they hold the line. */
export const DEFECT_LOYALTY = 25;
export const LOYAL = 70;

/** Protests against the player's own government. */
export const ownProtests = (protests: Protest[] | undefined, player: string) => (protests ?? []).filter((p) => !p.country || p.country === player);

/**
 * Whether the player's government is weak enough to be overthrown this
 * turn: unrest, an uprising, ready plotters, or forces that no longer obey.
 * A loyal army and police shield it from the street: then only a coup can.
 */
export function canFall(state: Pick<GameState, "politics" | "protests" | "player">): boolean {
  const own = ownProtests(state.protests, state.player);
  const loyalty = state.politics ? loyaltyOf(state.politics) : null;
  const coup = (state.politics?.plots ?? []).some((p) => p.kind === "coup" && p.strength >= FALL_PLOT);
  const violent = own.some((p) => p.stage === "riot" || p.stage === "uprising");
  const weak =
    (state.politics?.unrest ?? 0) >= FALL_UNREST ||
    own.some((p) => p.stage === "uprising") ||
    coup ||
    Boolean(loyalty && violent && Math.min(loyalty.army, loyalty.police) <= DEFECT_LOYALTY);
  const shielded = Boolean(loyalty && loyalty.army >= LOYAL && loyalty.police >= LOYAL);
  return weak && (!shielded || coup);
}

const rank = (stage: Protest["stage"]) => PROTEST_STAGES.indexOf(stage);

/**
 * Updates the protests by title: new ones join, the stage moves (each step
 * up is logged), settled ones leave the list. Places are province ids the
 * state knows; `resolve` turns a name into an id.
 */
export function applyProtests(
  current: Protest[],
  changes: z.infer<typeof protestsField>,
  ctx: { turn: number; to: string; resolve: (place: string) => string | undefined; player?: string; exists?: (tag: string) => boolean },
  applied: AppliedChange[],
): Protest[] {
  let list = current.map((p) => ({ ...p }));
  const known = (tag: string | undefined) => (tag && (ctx.exists?.(tag) ?? true) ? tag : undefined);
  const pct = (v: number | undefined) => (v === undefined ? undefined : Math.max(0, Math.min(100, Math.round(v))));
  changes.forEach((u, i) => {
    const needle = u.title.trim().toLowerCase();
    const existing = list.find((p) => p.title.trim().toLowerCase() === needle);
    const where = [...new Set(u.where.map(ctx.resolve).filter((id): id is string => Boolean(id)))];
    const country = known(u.country);
    const backer = known(u.backer);
    if (u.outcome !== "active") {
      if (existing) {
        list = list.filter((p) => p !== existing);
        applied.push({ kind: "protest", title: existing.title, change: u.outcome });
      }
      return;
    }
    if (!existing) {
      // A new protest starts no higher than riots: an uprising needs a turn of building.
      const stage = rank(u.stage) > rank("riot") ? "riot" : u.stage;
      list.push({
        id: `protest-${ctx.turn}-${i + 1}`,
        title: u.title,
        stage,
        size: Math.round(u.size),
        where,
        demands: u.demands,
        ...(u.by ? { by: u.by } : {}),
        since: ctx.to,
        ...(country && country !== ctx.player ? { country } : {}),
        ...(backer ? { backer } : {}),
        ...(pct(u.support) !== undefined ? { support: pct(u.support) } : {}),
        ...(pct(u.organisation) !== undefined ? { organisation: pct(u.organisation) } : {}),
        ...(u.killed ? { killed: Math.max(0, Math.round(u.killed)) } : {}),
      });
      applied.push({ kind: "protest", title: u.title, change: "new" });
      return;
    }
    // One step up the ladder a turn at most; down as far as it goes.
    const stage = rank(u.stage) > rank(existing.stage) + 1 ? PROTEST_STAGES[rank(existing.stage) + 1] : u.stage;
    if (rank(stage) > rank(existing.stage)) applied.push({ kind: "protest", title: existing.title, change: stage });
    existing.stage = stage;
    // A crowd grows fast, but not from nothing to a nation in a month.
    const size = Math.round(Math.min(u.size, existing.size * 4 + 50));
    existing.grew = size - existing.size;
    existing.size = size;
    if (where.length) existing.where = where;
    if (u.demands) existing.demands = u.demands;
    if (u.by) existing.by = u.by;
    if (backer) existing.backer = backer;
    if (pct(u.support) !== undefined) existing.support = pct(u.support);
    if (pct(u.organisation) !== undefined) existing.organisation = pct(u.organisation);
    if (u.killed && u.killed > 0) existing.killed = (existing.killed ?? 0) + Math.round(u.killed);
  });
  return list;
}

/** Sets a defeat when the government falls and the engine allows it; otherwise logs a failed attempt. */
export function applyOverthrow(
  next: GameState,
  overthrow: NonNullable<z.infer<typeof overthrowField>>,
  ctx: { turn: number; to: string },
  applied: AppliedChange[],
): void {
  if (next.defeat && !next.defeat.continued) return;
  if (!canFall(next)) {
    applied.push({ kind: "plot", title: overthrow.by, change: "foiled" });
    return;
  }
  const defeat: Defeat = { date: ctx.to, turn: ctx.turn, how: overthrow.how, by: overthrow.by, note: overthrow.note };
  next.defeat = defeat;
  const player: CountryState = next.countries[next.player];
  if (overthrow.leader) player.leader = overthrow.leader;
  if (overthrow.government) player.government = overthrow.government;
  // The old regime's street and plotters have had their day.
  next.protests = [];
  if (next.politics) next.politics = { ...next.politics, plots: [] };
  applied.push({ kind: "overthrown", how: overthrow.how, by: overthrow.by });
}

/**
 * A government with no land goes into exile — with an ally that still has
 * land if the model names none — and comes home once it holds a province
 * again.
 */
export function updateExile(next: GameState, hostHint: string | undefined, ctx: { to: string }, applied: AppliedChange[]): void {
  const tag = next.player;
  const country = next.countries[tag];
  if (!country || country.dormant) return;
  const holds = Object.values(next.regions).some((r) => r.controller === tag);
  if (holds) {
    if (country.exile) {
      delete country.exile;
      applied.push({ kind: "return", country: tag });
    }
    return;
  }
  if (country.exile) return;
  const landed = (t: string) => t !== tag && Object.values(next.regions).some((r) => r.controller === t);
  const friends = new Set<string>();
  for (const a of next.alliances) if (a.members.includes(tag)) a.members.forEach((m) => friends.add(m));
  for (const w of next.wars) {
    if (w.attackers.includes(tag)) w.attackers.forEach((m) => friends.add(m));
    if (w.defenders.includes(tag)) w.defenders.forEach((m) => friends.add(m));
  }
  const host = hostHint && next.countries[hostHint] && landed(hostHint) ? hostHint : [...friends].find(landed);
  country.exile = { since: ctx.to, ...(host ? { host } : {}) };
  applied.push({ kind: "exile", country: tag, ...(host ? { host } : {}) });
}

/** The protests as the model reads them. */
export function describeProtests(protests: Protest[] | undefined, name: (id: string) => string, player = ""): string[] {
  if (!protests?.length) return [];
  const line = (p: Protest) =>
    `- ${p.title} | ${p.stage} | ${p.size}${p.grew ? ` (${p.grew > 0 ? "+" : ""}${p.grew})` : ""} | ${p.where.map(name).join(", ") || "-"} | ${p.demands || "-"} | ${p.by ?? "-"} | support ${p.support ?? "?"}% | organisation ${p.organisation ?? "?"} | ${p.backer ? `backed by ${p.backer}` : "-"} | killed ${p.killed ?? 0}`;
  const own = ownProtests(protests, player);
  const abroad = protests.filter((p) => !own.includes(p));
  return [
    ...(own.length ? ["", "PROTESTS AGAINST THE GOVERNMENT (title | stage | thousands taking part (change) | where | demands | led by | public support | organisation 0–100 | foreign backer | killed so far):", ...own.map(line)] : []),
    ...(abroad.length ? ["", "PROTESTS ELSEWHERE (the same, against the government named):", ...abroad.map((p) => line(p).replace(/^- /, `- [${p.country}] `))] : []),
  ];
}


/** Words of a model that filled in an overthrow to say there was none. */
const NOTHING_HAPPENED = /никто|ніхто|nobody|no one|не было|не було|was no |there was no|did not happen|не произош|не відбул/i;

/**
 * Before overthrows needed an explicit "happened", a model's note that
 * nothing had happened could end the game. Such a defeat, in a save from
 * then, is dropped when the game opens.
 */
export function dropFalseDefeat<T extends Pick<GameState, "defeat">>(state: T): T {
  const d = state.defeat;
  if (!d || !NOTHING_HAPPENED.test(`${d.by} ${d.note}`)) return state;
  const next = { ...state };
  delete next.defeat;
  return next;
}

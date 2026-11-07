import { z } from "zod";
import { addTension, remember } from "./relations";
import { en } from "./text";
import { DELEGATION_VOTES, type AppliedChange, type DelegationVote, type Envoy, type EnvoyStatus, type GameState } from "./types";

/**
 * Diplomatic relations between two governments, beside trust and tension
 * (engine/relations.ts): normal, ambassadors recalled, broken off, or closed
 * by a war. A war between two governments closes their embassies at once and
 * keeps them closed while it lasts, truce or not; its end brings the
 * ambassadors back after a year, unless an order or the story says otherwise.
 * The player's government recalls, breaks or restores by its orders; the game
 * master tells the same of others. Only the pairs that are not normal are kept.
 */

/** The relations of two governments as everyone sees them. */
export type Relations = "war" | EnvoyStatus | "normal";

/** How long a peace keeps the ambassadors away. */
const AFTER_WAR_YEARS = 1;
/** Pairs other than the player's the game master is shown. */
const MAX_OTHERS = 20;

export const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const pairOf = (key: string) => key.split("|") as [string, string];

const atWar = (state: Pick<GameState, "wars">, a: string, b: string) =>
  state.wars.some((w) => (w.attackers.includes(a) && w.defenders.includes(b)) || (w.attackers.includes(b) && w.defenders.includes(a)));

export function relationsOf(state: Pick<GameState, "wars" | "envoys">, a: string, b: string): Relations {
  if (atWar(state, a, b)) return "war";
  return state.envoys?.[pairKey(a, b)]?.status ?? "normal";
}

/** What the turn says about relations: a government recalls its ambassador, breaks them off, or restores them. */
export const envoysField = z
  .array(z.object({ country: z.string().optional(), with: z.string(), status: z.enum(["recalled", "broken", "restored"]), note: z.string().optional() }))
  .catch([])
  .default([]);

export type EnvoyWord = { country: string; with: string; status: "recalled" | "broken" | "restored" };

/** Only between governments that exist, once per pair, the player's when no country is given; never restored in a war. */
export function sanitizeEnvoys(state: Pick<GameState, "countries" | "wars" | "player">, raw: z.infer<typeof envoysField>): EnvoyWord[] {
  const seen = new Set<string>();
  const out: EnvoyWord[] = [];
  for (const w of raw) {
    const country = w.country ?? state.player;
    if (!state.countries[country] || !state.countries[w.with] || country === w.with) continue;
    const key = pairKey(country, w.with);
    if (seen.has(key)) continue;
    if (w.status === "restored" && atWar(state, country, w.with)) continue;
    seen.add(key);
    out.push({ country, with: w.with, status: w.status });
  }
  return out;
}

const enemyPairs = (war: GameState["wars"][number]) => war.attackers.flatMap((a) => war.defenders.map((d) => [a, d] as const));
const addYears = (date: string, years: number) => `${Number(date.slice(0, 4)) + years}${date.slice(4)}`;

/**
 * The turn's relations, once its wars are begun and ended: a pair newly at war
 * – a new war, or a country entering one – closes its embassies (news for the
 * player's own), a pair no longer at war – a peace, or one of them leaving a
 * war that goes on – has its ambassadors recalled for a year, the orders and
 * the story recall, break or restore, and a recall whose year is up ends.
 */
export function applyEnvoys(state: Pick<GameState, "wars" | "player">, next: GameState, words: EnvoyWord[], to: string, applied: AppliedChange[]): void {
  const envoys: Record<string, Envoy> = { ...(next.envoys ?? {}) };
  const mine = (a: string, b: string) => a === next.player || b === next.player;
  // Enemy pairs before the turn and after it, whatever war they fight in.
  const pairs = (wars: GameState["wars"]) => new Map(wars.flatMap((w) => enemyPairs(w)).map(([a, d]) => [pairKey(a, d), [a, d] as const]));
  const before = pairs(state.wars);
  const after = pairs(next.wars);
  for (const [key, [a, d]] of after) {
    if (before.has(key)) continue;
    delete envoys[key];
    if (mine(a, d)) applied.push({ kind: "envoy", country: a === next.player ? d : a, status: "war" });
  }
  for (const [key, [a, d]] of before) {
    if (after.has(key) || !next.countries[a] || !next.countries[d]) continue;
    envoys[key] = { status: "recalled", since: to, until: addYears(to, AFTER_WAR_YEARS) };
  }
  for (const w of words) {
    const key = pairKey(w.country, w.with);
    if (w.status === "restored") {
      if (!envoys[key]) continue;
      delete envoys[key];
    } else {
      if (envoys[key]?.status === w.status) continue;
      envoys[key] = { status: w.status, since: to, by: w.country };
      // The other side takes it as a slight: a recall a little, a break more (engine/relations.ts).
      const broken = w.status === "broken";
      remember(next, w.with, w.country, broken ? "broke-relations" : "recalled", broken ? -15 : -5, to);
      addTension(next, w.with, w.country, broken ? 15 : 5);
    }
    if (mine(w.country, w.with) || w.status !== "recalled") applied.push({ kind: "envoy", country: w.country, partner: w.with, status: w.status });
  }
  for (const [key, e] of Object.entries(envoys)) {
    const [a, b] = pairOf(key);
    if (!next.countries[a] || !next.countries[b]) delete envoys[key];
    else if (e.until && e.until <= to) {
      delete envoys[key];
      if (mine(a, b)) applied.push({ kind: "envoy", country: a, partner: b, status: "restored" });
    }
  }
  if (Object.keys(envoys).length) next.envoys = envoys;
  else delete next.envoys;
}

/** How the orders tell the player's delegation to vote on the world body's resolutions about an aggressor. */
export const delegationField = z
  .array(z.object({ against: z.string(), vote: z.enum(DELEGATION_VOTES), inPerson: z.boolean().optional() }))
  .catch([])
  .default([]);

/** One line for the delegation: how it votes on an aggressor, and whether the leader goes to the session in person. */
export type DelegationLine = { against: string; vote: DelegationVote; inPerson?: boolean };

/** Lines about aggressors that exist and are not the player's own government. */
export function sanitizeDelegation(state: Pick<GameState, "countries" | "player">, raw: z.infer<typeof delegationField>): DelegationLine[] {
  const out = new Map<string, DelegationLine>();
  for (const d of raw) if (state.countries[d.against] && d.against !== state.player) out.set(d.against, { against: d.against, vote: d.vote, ...(d.inPerson ? { inPerson: true } : {}) });
  return [...out.values()];
}

/**
 * The orders' lines join the delegation's standing instructions; lines about governments that are gone go with them.
 * The leader's presence at a session is this turn's only: it is set anew by each turn's lines.
 */
export function applyDelegation(next: GameState, lines: DelegationLine[]): void {
  const kept: Record<string, DelegationVote> = Object.fromEntries(Object.entries(next.delegation ?? {}).filter(([tag]) => next.countries[tag]));
  for (const l of lines) kept[l.against] = l.vote;
  if (Object.keys(kept).length) next.delegation = kept;
  else delete next.delegation;
  const present = lines.filter((l) => l.inPerson).map((l) => l.against);
  if (present.length) next.delegationInPerson = present;
  else delete next.delegationInPerson;
}

/** Relations that are not normal, for the game master: the player's all, others' up to a few. */
export function describeEnvoys(state: Pick<GameState, "wars" | "envoys" | "delegation" | "delegationInPerson" | "player" | "countries">): string[] {
  const name = (tag: string) => `${en(state.countries[tag]?.name ?? tag)} [${tag}]`;
  const lines: string[] = [];
  const atWarWith = [...new Set(state.wars.flatMap((w) => (w.attackers.includes(state.player) ? w.defenders : w.defenders.includes(state.player) ? w.attackers : [])))];
  if (atWarWith.length) lines.push(`- At war, embassies closed: ${atWarWith.map(name).join(", ")}`);
  const kept = Object.entries(state.envoys ?? {});
  const line = ([key, e]: [string, Envoy]) => {
    const [a, b] = pairOf(key);
    return `- ${name(a)} and ${name(b)}: ${e.status === "broken" ? "relations broken off" : "ambassadors recalled"} since ${e.since}${e.by ? ` by ${state.countries[e.by] ? e.by : "?"}` : ""}${e.until ? `, back by ${e.until}` : ""}`;
  };
  const own = kept.filter(([key]) => pairOf(key).includes(state.player));
  const others = kept.filter(([key]) => !pairOf(key).includes(state.player)).slice(0, MAX_OTHERS);
  lines.push(...own.map(line), ...others.map(line));
  const votes = Object.entries(state.delegation ?? {});
  if (votes.length) lines.push(`- The player's delegation at the world body is told to ${votes.map(([tag, v]) => `${v} on ${name(tag)}`).join(", ")}`);
  if (state.delegationInPerson?.length) lines.push(`- The player's leader spoke in person at the world body's session on ${state.delegationInPerson.map(name).join(", ")}: tell the speech, how the hall took it and who it swayed`);
  return lines.length ? ["", "DIPLOMATIC RELATIONS (all others are normal):", ...lines] : [];
}

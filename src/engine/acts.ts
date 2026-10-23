import { z } from "zod";
import { isHexColor } from "./colors";
import { applyLaws, LAW_IDS, lawsShape, type Laws, startLaws } from "./laws";
import { en } from "./text";
import type { AppliedChange, Bill, GameState, Localized, Politics, Proclamation } from "./types";

/**
 * Acts of state. A new name for the country or one of its cities, or a new
 * colour on the maps of the world, comes from the player's orders: the turn's
 * game master answers such an order in "acts" (in three languages, with how
 * the country takes it) and the engine proclaims what checks out when the turn
 * ends (engine/identity.ts). Laws change by the game master's word on the laws
 * in force, or as bills and decrees that wait for a verdict: a passed act
 * changes the laws it names, and its reaction moves unrest.
 */

const text = (max: number) => z.string().trim().min(1).max(max);
const localized = z.object({ ru: text(80), uk: text(80), en: text(80) });
const reaction = z
  .object({ unrest: z.number().finite().catch(0).default(0), note: z.string().trim().max(400).default("") })
  .catch({ unrest: 0, note: "" })
  .default({ unrest: 0, note: "" });

export const VOTES = ["majority", "twothirds", "decree"] as const;

const renameShape = z.object({ kind: z.literal("rename"), target: text(80), names: localized, reaction });
const colorShape = z.object({ kind: z.literal("color"), color: z.string().trim(), reaction });
/** A law or decree drafted for a vote: what it says, the laws it changes, the vote it needs, how the country takes it. */
export const LawDraftSchema = z.object({ kind: z.literal("law"), title: text(200), text: z.string().trim().max(1500).default(""), laws: lawsShape, vote: z.enum(VOTES).catch("majority").default("majority"), reaction });

/** One act of state: a new name, a new colour, or a law. */
export type ActDraft = z.infer<typeof renameShape> | z.infer<typeof colorShape> | z.infer<typeof LawDraftSchema>;
export type LawDraft = Extract<ActDraft, { kind: "law" }>;

/** The acts a turn's game master answers the player's orders with (merged into OutcomeSchema as `acts`); a malformed one is dropped. */
export const actsField = z
  .array(z.discriminatedUnion("kind", [renameShape, colorShape]).nullable().catch(null))
  .max(8)
  .catch([])
  .default([]);
export type TurnAct = Exclude<z.infer<typeof actsField>[number], null>;

/** Reactions within reason: a single act moves unrest by at most this much either way. */
const REACTION = { min: -10, max: 20 };
export const boundReaction = (r: { unrest: number; note: string }) => ({ unrest: Math.round(Math.max(REACTION.min, Math.min(REACTION.max, r.unrest))), note: r.note });

/** How many acts one turn may bring. */
const MAX_ACTS = 4;

/**
 * Orders that ask for an act of state: a new name for the country or a city,
 * or a new colour on the maps, in any of the game's languages. Without one,
 * a turn brings no acts, whatever its answer says.
 */
const ASKS_FOR_ACTS = /renam|re-nam|new name|call (it|the|our)|colou?r|переимен|назва|назов|имен[уо]|перейменув|наймен|ім'я|цвет|перекрас|колір|кольор|перефарб/i;
export const asksForActs = (orders: string[] | undefined) => (orders ?? []).some((o) => ASKS_FOR_ACTS.test(o));

/** A city the player may rename: its key on the map and every name it goes by now (any language, any era). */
export interface CityName {
  key: string;
  names: string[];
}

/**
 * The acts a turn's answer brings, checked against the state: only when an
 * order asks for one; a rename of the country, or of one of the player's
 * cities named by any of its names; a real colour that is not the current
 * one; one of each at most, with the reaction within reason. An opposition
 * movement does not govern, and proclaims nothing.
 */
export function sanitizeActs(state: GameState, acts: z.infer<typeof actsField>, options: { orders?: string[]; cities?: CityName[]; opposition?: boolean }): { acts: TurnAct[]; dropped: number } {
  const given = acts.filter((a): a is TurnAct => Boolean(a));
  if (options.opposition || !asksForActs(options.orders)) return { acts: [], dropped: given.length };
  const country = state.countries[state.player];
  const byName = new Map<string, string>();
  for (const c of options.cities ?? []) for (const n of [c.key, ...c.names]) byName.set(n.trim().toLowerCase(), c.key);
  const seen = new Set<string>();
  const out: TurnAct[] = [];
  for (const a of given) {
    let act: TurnAct | null = null;
    if (a.kind === "color") {
      const color = a.color.toLowerCase();
      if (isHexColor(color) && color !== country?.color.toLowerCase()) act = { ...a, color };
    } else {
      const target = a.target.trim().toLowerCase();
      const key = target === "country" || (country && target === en(country.name).toLowerCase()) ? "country" : byName.get(target);
      if (key) act = { ...a, target: key };
    }
    const id = act ? (act.kind === "color" ? "color" : `rename:${act.target}`) : "";
    if (!act || seen.has(id) || out.length >= MAX_ACTS) continue;
    seen.add(id);
    out.push({ ...act, reaction: boundReaction(act.reaction) });
  }
  return { acts: out, dropped: given.length - out.length };
}

/** The acts as a proclamation, to take effect when the turn ends (engine/identity.ts). */
export function proclamationOf(acts: TurnAct[]): Proclamation | undefined {
  const p: Proclamation = {};
  const reactions: NonNullable<Proclamation["reactions"]> = {};
  for (const a of acts) {
    if (a.kind === "color") {
      p.color = a.color;
      reactions.color = a.reaction;
    } else if (a.target === "country") {
      p.name = a.names;
      reactions.name = a.reaction;
    } else {
      p.places = { ...(p.places ?? {}), [a.target]: a.names };
      reactions[`place:${a.target}`] = a.reaction;
    }
  }
  if (!p.name && !p.color && !p.places) return undefined;
  return { ...p, reactions };
}

/** A drafted law put before parliament (or signed as a decree): it waits for the game master's verdict. */
export function proposeBill(state: GameState, draft: LawDraft, now = new Date()): GameState {
  const id = `bill-${state.turn}-${(state.bills?.length ?? 0) + 1}`;
  const laws = startLaws(draft.laws);
  const bill: Bill = {
    id,
    title: draft.title,
    text: draft.text,
    ...(laws ? { laws } : {}),
    vote: draft.vote,
    status: "proposed",
    turn: state.turn,
    date: state.date,
    reaction: boundReaction(draft.reaction),
  };
  return { ...state, bills: [...(state.bills ?? []), bill], updatedAt: now.toISOString() };
}

/** A bill not yet decided can be withdrawn. */
export function withdrawBill(state: GameState, id: string, now = new Date()): GameState {
  return { ...state, bills: (state.bills ?? []).filter((b) => b.id !== id || b.status !== "proposed"), updatedAt: now.toISOString() };
}

/** The game master's verdicts on the bills. */
export const billsField = z
  .array(z.object({ bill: text(80), status: z.enum(["passed", "failed"]), note: z.string().trim().max(400).default("") }))
  .max(10)
  .default([]);

/** Turns a bill may wait for a vote before it lapses. */
const PATIENCE = 3;

/**
 * A turn for the bills: the verdicts land, a passed bill changes the laws
 * and moves unrest by its reaction; one left too long lapses.
 */
export function applyBills(next: GameState, verdicts: z.infer<typeof billsField>, ctx: { turn: number; to: string }, applied: AppliedChange[]): void {
  if (!next.bills?.length) return;
  next.bills = next.bills.map((b) => {
    if (b.status !== "proposed") return b;
    const verdict = verdicts.find((v) => v.bill === b.id);
    // A bill proposed on turn n has its last chance on turn n + PATIENCE - 1.
    const status = verdict?.status ?? (ctx.turn - b.turn + 1 >= PATIENCE ? "failed" : undefined);
    if (!status) return b;
    applied.push({ kind: "bill", title: b.title, change: status, ...(verdict?.note ? { note: verdict.note } : {}) });
    if (status === "passed" && next.politics) {
      const laws = applyLaws(next.politics.laws, b.laws, applied);
      next.politics = { ...next.politics, ...(laws ? { laws } : {}), unrest: clampUnrest(next.politics, b.reaction?.unrest ?? 0) };
    }
    return { ...b, status, decided: ctx.to, ...(verdict?.note ? { note: verdict.note } : {}) };
  });
}

const clampUnrest = (p: Politics, delta: number) => Math.max(0, Math.min(100, Math.round(p.unrest + delta)));

/** The bills awaiting a verdict, for the game master. */
export function describeBills(state: GameState): string[] {
  const open = (state.bills ?? []).filter((b) => b.status === "proposed");
  if (!open.length) return [];
  const changes = (laws?: Laws) => (laws ? LAW_IDS.filter((id) => laws[id]).map((id) => `${id} → ${laws[id]}`).join(", ") : "");
  return [
    "",
    "BILLS AND DECREES OF THE PLAYER'S GOVERNMENT AWAITING A VERDICT (id | title | needs | changes to the laws | what it says | expected reaction):",
    ...open.map((b) => `- ${b.id} | ${b.title} | ${b.vote === "decree" ? "a decree" : b.vote === "twothirds" ? "two thirds of the seats" : "a majority of the seats"} | ${changes(b.laws) || "-"} | ${b.text || "-"} | ${b.reaction?.note || "-"}`),
  ];
}

/** Turns a reaction into what the game master is told about a proclamation part. */
export const reactionLine = (what: string, r?: { unrest: number; note: string }) => (r ? `${what}: expected unrest ${r.unrest > 0 ? "+" : ""}${r.unrest}${r.note ? ` (${r.note})` : ""}` : what);

export type { Localized };

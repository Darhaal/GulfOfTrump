import { z } from "zod";
import type { AdvisorId } from "./advisors";
import type { AppliedChange, GameState, Official, OfficialPost } from "./types";
import { OFFICIAL_POSTS } from "./types";

/**
 * The people of the player's government: the head of state and of
 * government, the leader's chief of staff, the ministers the cabinet talks
 * to, the head of intelligence and the central banker. Each has a name,
 * traits, a manner of speaking, competence and loyalty (1–5) and maybe a
 * faction. The game master first names them for the country and date; the
 * player appoints and dismisses them between turns (the turn then judges
 * what it did); turns can also take them away — resignations, deaths,
 * arrests, defections.
 */

const shortText = z.string().trim().max(300);
const traits = z.array(z.string().trim().min(1).max(60)).max(5).catch([]).default([]);
const score = z.number().finite().catch(3).default(3);

const person = z.object({
  name: shortText.min(1),
  traits,
  manner: shortText.default(""),
  competence: score,
  loyalty: score,
  faction: shortText.optional(),
  bio: z.string().trim().max(500).optional(),
});

/** The government as the game master first describes it. */
export const OfficialsSetupSchema = z.object({
  officials: z.array(person.extend({ post: z.enum(OFFICIAL_POSTS), title: shortText.min(1) })).min(3).max(12),
});

/** Candidates for a post, for the appointment dialog. */
export const CandidatesSchema = z.object({
  candidates: z
    .array(person.extend({ background: shortText.default(""), pros: z.array(shortText).max(4).catch([]).default([]), cons: z.array(shortText).max(4).catch([]).default([]) }))
    .min(1)
    .max(5),
});
export type Candidate = z.infer<typeof CandidatesSchema>["candidates"][number];

export const OFFICIAL_CHANGES = ["appointed", "resigned", "dismissed", "died", "arrested", "fled"] as const;

/** A turn's changes to the government by events (merged into OutcomeSchema as `officials`). */
export const officialsField = z
  .array(
    person.partial().extend({
      post: z.enum(OFFICIAL_POSTS),
      name: shortText.min(1),
      title: shortText.optional(),
      change: z.enum(OFFICIAL_CHANGES).catch("appointed").default("appointed"),
      note: shortText.default(""),
    }),
  )
  .max(6)
  .default([]);

/** The post each minister of the cabinet holds. */
export const ADVISOR_POST: Record<AdvisorId, OfficialPost> = {
  chief: "chief",
  military: "military",
  finance: "finance",
  foreign: "foreign",
  interior: "interior",
  intelligence: "intelligence",
};

const clampScore = (v: number) => Math.min(5, Math.max(1, Math.round(v)));

function official(raw: z.infer<typeof person> & { post: OfficialPost; title: string }, since: string): Official {
  return {
    post: raw.post,
    title: raw.title,
    name: raw.name,
    traits: raw.traits.slice(0, 4),
    manner: raw.manner,
    competence: clampScore(raw.competence),
    loyalty: clampScore(raw.loyalty),
    ...(raw.faction ? { faction: raw.faction } : {}),
    ...(raw.bio ? { bio: raw.bio } : {}),
    since,
  };
}

/** The government as first described, one person per post, in the order of OFFICIAL_POSTS. */
export function startOfficials(raw: z.infer<typeof OfficialsSetupSchema>, date: string): Official[] {
  const byPost = new Map<OfficialPost, Official>();
  for (const o of raw.officials) if (!byPost.has(o.post)) byPost.set(o.post, official(o, date));
  return OFFICIAL_POSTS.flatMap((p) => (byPost.has(p) ? [byPost.get(p)!] : []));
}

export const officialAt = (state: Pick<GameState, "officials">, post: OfficialPost) => state.officials?.find((o) => o.post === post);

/**
 * The player appoints someone to a post: the person takes it now, and the
 * change waits in `personnel` for the next turn, whose game master judges
 * what it does (and whom it angers).
 */
export function appoint(state: GameState, post: OfficialPost, person: Omit<Official, "post" | "since" | "title"> & { title?: string }, note = "", now = new Date()): GameState {
  const before = officialAt(state, post);
  const title = person.title || before?.title || post;
  const next: Official = {
    post,
    title,
    name: person.name.trim(),
    traits: person.traits.slice(0, 4),
    manner: person.manner,
    competence: clampScore(person.competence),
    loyalty: clampScore(person.loyalty),
    ...(person.faction ? { faction: person.faction } : {}),
    ...(person.bio ? { bio: person.bio } : {}),
    since: state.date,
  };
  const officials = [...(state.officials ?? []).filter((o) => o.post !== post), next].sort((a, b) => OFFICIAL_POSTS.indexOf(a.post) - OFFICIAL_POSTS.indexOf(b.post));
  return {
    ...state,
    officials,
    personnel: [...(state.personnel ?? []), { date: state.date, post, title, ...(before ? { from: before.name } : {}), to: next.name, ...(note ? { note } : {}) }],
    updatedAt: now.toISOString(),
  };
}

/** A turn's changes to the government: someone leaves a post, someone takes it. */
export function applyOfficials(next: GameState, changes: z.infer<typeof officialsField>, ctx: { to: string }, applied: AppliedChange[]): void {
  for (const c of changes) {
    const before = officialAt(next, c.post);
    if (c.change === "appointed") {
      if (before?.name === c.name) continue;
      const taken: Official = {
        post: c.post,
        title: c.title || before?.title || c.post,
        name: c.name,
        traits: (c.traits ?? []).slice(0, 4),
        manner: c.manner ?? "",
        competence: clampScore(c.competence ?? 3),
        loyalty: clampScore(c.loyalty ?? 3),
        ...(c.faction ? { faction: c.faction } : {}),
        since: ctx.to,
      };
      next.officials = [...(next.officials ?? []).filter((o) => o.post !== c.post), taken].sort((a, b) => OFFICIAL_POSTS.indexOf(a.post) - OFFICIAL_POSTS.indexOf(b.post));
      applied.push({ kind: "official", post: c.post, title: taken.title, name: c.name, change: "appointed" });
    } else if (before && before.name === c.name) {
      // The post stays empty until someone is named; the cabinet falls back to a deputy.
      next.officials = (next.officials ?? []).filter((o) => o.post !== c.post);
      applied.push({ kind: "official", post: c.post, title: before.title, name: c.name, change: c.change });
    }
  }
}

/** The government as the model reads it, and the player's appointments since the last turn. */
export function describeOfficials(state: Pick<GameState, "officials" | "personnel">): string[] {
  const lines: string[] = [];
  if (state.officials?.length) {
    lines.push("", "THE PLAYER'S GOVERNMENT (post | title | name | traits | manner | competence 1-5 | loyalty 1-5 | faction):");
    for (const o of state.officials) lines.push(`- ${o.post} | ${o.title} | ${o.name} | ${o.traits.join(", ") || "-"} | ${o.manner || "-"} | ${o.competence} | ${o.loyalty} | ${o.faction ?? "-"}`);
  }
  if (state.personnel?.length) {
    lines.push("", "APPOINTMENTS BY THE GOVERNMENT SINCE THE LAST TURN (they have happened; judge what they bring):");
    for (const p of state.personnel) lines.push(`- ${p.date}: ${p.title}: ${p.from ? `${p.from} replaced by ` : ""}${p.to}${p.note ? ` (${p.note})` : ""}`);
  }
  return lines;
}

/** One person in a line, for a minister's own prompt. */
export const officialLine = (o: Official) =>
  `${o.name}, ${o.title}${o.faction ? ` (${o.faction})` : ""}; traits: ${o.traits.join(", ") || "—"}; manner: ${o.manner || "—"}; competence ${o.competence}/5, loyalty ${o.loyalty}/5`;

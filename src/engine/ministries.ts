import { ADVISOR_PERSONAS, ADVISOR_POST, ADVISOR_TITLES, ADVISORS, NEW_MINISTRIES, type AdvisorId, type NewMinistryId } from "./advisors";
import type { AppliedChange, CabinetShape, GameState, Localized, NewMinistry, OfficialPost } from "./types";

/**
 * The cabinet's shape, the government's own to change between turns: a
 * ministry closed (its minister, deputies, plots and directives go with it,
 * its portfolio passes to the chief of staff), a closed one reopened, and new
 * ministries created with a name and a portfolio in the player's words – up
 * to twelve ministries in all, the chief of staff's office among them. A new
 * ministry takes one of four places (`NEW_MINISTRIES`, m1–m4): a post of its
 * own for its minister, a conversation, directives and reports like any
 * other. The changes wait in `cabinetShape.changes` for the next game master,
 * who judges what they bring, and go into the turn's record.
 */

/** Ministries the cabinet can hold, the chief of staff's office among them. */
export const MAX_MINISTRIES = 12;
export const MINISTRY_NAME_CHARS = 80;
export const PORTFOLIO_CHARS = 300;

export type ShapeRefusal = "chief" | "own" | "closed" | "open" | "full" | "name" | "unknown";

type Shaped = Pick<GameState, "cabinetShape">;

/**
 * The icons a ministry may wear on the cabinet's tiles, the orders' settings and the reports, by name (the interface
 * draws each one: components/game/ministryIcons.tsx). The player may choose another for any ministry, and one for a
 * new ministry when creating it; it is the interface's, not an act of state, and changes at once.
 */
export const MINISTRY_ICON_KEYS = [
  "user", "landmark", "shield", "banknote", "factory", "globe", "shield-half", "eye", "flask", "rocket", "briefcase",
  "scale", "gavel", "megaphone", "newspaper", "radio", "tractor", "wheat", "train", "ship", "plane", "hospital",
  "graduation", "church", "building", "handshake", "hammer", "zap", "fuel", "leaf", "trophy", "palette", "mail", "map",
  "anchor", "swords", "heart", "book", "users", "coins", "pickaxe", "droplets", "baby", "home", "flag", "star",
] as const;
export type MinistryIconKey = (typeof MINISTRY_ICON_KEYS)[number];

/** Each ministry's usual icon; a new ministry's is a briefcase until the player picks one. */
const USUAL_ICON: Partial<Record<AdvisorId, MinistryIconKey>> = { chief: "user", military: "shield", finance: "banknote", industry: "factory", foreign: "globe", interior: "shield-half", intelligence: "eye", science: "flask", space: "rocket" };

/** The icon a ministry wears now. */
export const ministryIcon = (state: Shaped, id: AdvisorId): MinistryIconKey => {
  const chosen = state.cabinetShape?.icons?.[id];
  return chosen && (MINISTRY_ICON_KEYS as readonly string[]).includes(chosen) ? (chosen as MinistryIconKey) : (USUAL_ICON[id] ?? "briefcase");
};

/** A ministry given another icon by the player, at once; its usual one clears the choice. */
export function setMinistryIcon<T extends GameState>(state: T, id: AdvisorId, icon: MinistryIconKey, now = new Date()): T {
  const shape = state.cabinetShape ?? {};
  const icons = { ...(shape.icons ?? {}) };
  if (icon === (USUAL_ICON[id] ?? "briefcase")) delete icons[id];
  else icons[id] = icon;
  const next: CabinetShape = { ...shape, icons };
  if (!Object.keys(icons).length) delete next.icons;
  return { ...state, cabinetShape: Object.keys(next).length ? next : undefined, updatedAt: now.toISOString() };
}

/** The colour the player chose for a ministry's icon, if any. */
export const ministryColour = (state: Shaped, id: AdvisorId): string | undefined => state.cabinetShape?.colours?.[id];

/** A ministry's icon given a colour by the player, at once; null gives it back the ink. */
export function setMinistryColour<T extends GameState>(state: T, id: AdvisorId, hex: string | null, now = new Date()): T {
  const shape = state.cabinetShape ?? {};
  const colours = { ...(shape.colours ?? {}) };
  if (hex && /^#[0-9a-f]{6}$/i.test(hex)) colours[id] = hex.toLowerCase();
  else delete colours[id];
  const next: CabinetShape = { ...shape, colours };
  if (!Object.keys(colours).length) delete next.colours;
  return { ...state, cabinetShape: Object.keys(next).length ? next : undefined, updatedAt: now.toISOString() };
}

/** The tasks a new ministry may be set, and how long each. */
export const MAX_MINISTRY_TASKS = 8;
export const TASK_CHARS = 140;

/** The tasks as the ministry keeps them: trimmed, short, each once, no more than eight. */
export function cleanTasks(tasks: readonly string[]): string[] {
  const out: string[] = [];
  for (const t of tasks) {
    const line = t.replace(/\s+/g, " ").trim().slice(0, TASK_CHARS);
    if (line && !out.some((o) => o.toLowerCase() === line.toLowerCase())) out.push(line);
  }
  return out.slice(0, MAX_MINISTRY_TASKS);
}

export const isNewMinistry = (id: string): id is NewMinistryId => (NEW_MINISTRIES as readonly string[]).includes(id);

/** A ministry the government created, by its place. */
export const newMinistry = (state: Shaped, id: string): NewMinistry | undefined => state.cabinetShape?.created?.find((m) => m.id === id);

/**
 * A new ministry's name for a small tile: without the word every ministry
 * starts with – "Министерство цифровой трансформации" is "Цифровой
 * трансформации", "Ministry of Propaganda" is "Propaganda".
 */
export function shortMinistryName(name: string): string {
  const short = name.replace(/^(министерство|міністерство|министр|міністр|ministry( of| for)?|department( of| for)?|office( of| for)?)\s+/i, "").trim();
  return short ? short.charAt(0).toLocaleUpperCase() + short.slice(1) : name;
}

/** Whether a ministry is part of the cabinet now: a standard one not closed, a new one created. */
export function ministryOpen(state: Shaped, id: AdvisorId): boolean {
  if (isNewMinistry(id)) return Boolean(newMinistry(state, id));
  return !state.cabinetShape?.closed?.some((c) => c.id === id);
}

/** The ministries of the cabinet now, in the order it shows them: the standard ones, then the new. */
export const openMinistries = (state: Shaped): AdvisorId[] => ADVISORS.filter((id) => id !== "space" && ministryOpen(state, id));

/**
 * The open ministries with the head of the space programme after the standard ones: no ministry of the twelve, he
 * sits in the cabinet only while the government runs a programme (engine/space.ts cabinetAdvisors filters him then).
 */
export function withSpaceHead(ids: readonly AdvisorId[]): AdvisorId[] {
  const at = ids.findIndex((id) => isNewMinistry(id));
  const cut = at < 0 ? ids.length : at;
  return [...ids.slice(0, cut), "space", ...ids.slice(cut)];
}

/** The standard ministries the government closed, to reopen. */
export const closedMinistries = (state: Shaped): AdvisorId[] => (state.cabinetShape?.closed ?? []).map((c) => c.id);

/** Whether a post belongs to a ministry that is not part of the cabinet now (a closed one, or a new one's place left empty). */
export function postClosed(state: Shaped, post: OfficialPost): boolean {
  const id = ADVISORS.find((a) => ADVISOR_POST[a] === post);
  return id !== undefined && !ministryOpen(state, id);
}

/** What a ministry's minister is called by default: the standard ones' titles, a new one's name in every language. */
export function ministryTitle(state: Shaped, id: AdvisorId): Localized {
  const created = isNewMinistry(id) ? newMinistry(state, id) : undefined;
  return created ? (created.names ?? { ru: created.name, uk: created.name, en: created.name }) : (state.cabinetShape?.renamed?.[id] ?? ADVISOR_TITLES[id]);
}

/** Who the minister is, for the model: a new ministry speaks for the portfolio the government gave it. */
export function ministryPersona(state: Shaped, id: AdvisorId): string {
  const created = isNewMinistry(id) ? newMinistry(state, id) : undefined;
  if (!created) return ADVISOR_PERSONAS[id];
  return `the minister of a ministry the government created on ${created.since}, "${created.name}"${created.portfolio ? `, whose portfolio is: ${created.portfolio}` : ""}${created.tasks?.length ? `; the government set it these tasks: ${created.tasks.join("; ")}` : ""}. You fight to prove the ministry was worth creating – its remit, staff and budget – and guard its turf against the older ministries. Practical; speak of what the ministry can deliver, by when, and what it needs.`;
}

const touched = (state: GameState, cabinetShape: GameState["cabinetShape"], now: Date): GameState => {
  const next: GameState = { ...state, updatedAt: now.toISOString() };
  if (cabinetShape && (cabinetShape.closed?.length || cabinetShape.created?.length || cabinetShape.changes?.length)) next.cabinetShape = cabinetShape;
  else delete next.cabinetShape;
  return next;
};

/**
 * The government closes a ministry: its minister leaves the government, its
 * deputies and their plots go, its directives end; a new ministry's place is
 * freed. Not the chief of staff's office, and not the player's own ministry.
 */
export function closeMinistry(state: GameState, id: AdvisorId, now = new Date()): { state: GameState; why?: ShapeRefusal } {
  if (id === "chief") return { state, why: "chief" };
  if (!ministryOpen(state, id)) return { state, why: "closed" };
  const post = ADVISOR_POST[id];
  if (state.role?.kind === "minister" && state.role.post === post) return { state, why: "own" };
  const minister = state.officials?.find((o) => o.post === post);
  const shape = state.cabinetShape ?? {};
  const name = newMinistry(state, id)?.name;
  const next = touched(
    state,
    {
      ...shape,
      ...(isNewMinistry(id) ? { created: (shape.created ?? []).filter((m) => m.id !== id) } : { closed: [...(shape.closed ?? []), { id, since: state.date }] }),
      changes: [...(shape.changes ?? []), { kind: "closed", id, ...(name ? { name } : {}), date: state.date, ...(minister ? { minister: { post, title: minister.title, name: minister.name } } : {}) }],
    },
    now,
  );
  if (state.officials) next.officials = state.officials.filter((o) => o.post !== post);
  if (state.deputies) next.deputies = state.deputies.filter((d) => d.deputyOf !== post);
  if (state.intrigues) next.intrigues = state.intrigues.filter((i) => i.post !== post);
  if (state.directives) next.directives = state.directives.filter((d) => d.ministry !== id);
  // A new ministry's place may be taken by another: its conversation goes with it.
  if (isNewMinistry(id) && state.advice?.[id]) {
    const advice = { ...state.advice };
    delete advice[id];
    next.advice = advice;
  }
  return { state: next };
}

/** A closed standard ministry is opened again, its minister's post vacant until someone is named. */
export function reopenMinistry(state: GameState, id: AdvisorId, now = new Date()): { state: GameState; why?: ShapeRefusal } {
  if (isNewMinistry(id) || !state.cabinetShape?.closed?.some((c) => c.id === id)) return { state, why: "unknown" };
  if (openMinistries(state).length >= MAX_MINISTRIES) return { state, why: "full" };
  const shape = state.cabinetShape;
  return {
    state: touched(state, { ...shape, closed: shape.closed!.filter((c) => c.id !== id), changes: [...(shape.changes ?? []), { kind: "reopened", id, date: state.date }] }, now),
  };
}

/**
 * The government creates a ministry: a name and a portfolio in the player's
 * words, in the first free place, while the cabinet has fewer than twelve.
 * Its minister is named as any other.
 */
export function createMinistry(state: GameState, name: string, portfolio: string, now = new Date(), tasks: readonly string[] = []): { state: GameState; id?: NewMinistryId; why?: ShapeRefusal } {
  const title = name.replace(/\s+/g, " ").trim().slice(0, MINISTRY_NAME_CHARS);
  if (!title) return { state, why: "name" };
  const key = title.toLowerCase();
  const taken = (state.cabinetShape?.created ?? []).some((m) => m.name.toLowerCase() === key);
  if (taken) return { state, why: "name" };
  if (openMinistries(state).length >= MAX_MINISTRIES) return { state, why: "full" };
  const id = NEW_MINISTRIES.find((m) => !newMinistry(state, m));
  if (!id) return { state, why: "full" };
  const shape = state.cabinetShape ?? {};
  const set = cleanTasks(tasks);
  const created: NewMinistry = { id, name: title, portfolio: portfolio.replace(/\s+/g, " ").trim().slice(0, PORTFOLIO_CHARS), ...(set.length ? { tasks: set } : {}), since: state.date };
  const next = touched(state, { ...shape, created: [...(shape.created ?? []), created], changes: [...(shape.changes ?? []), { kind: "created", id, name: title, date: state.date }] }, now);
  if (state.advice?.[id]) {
    const advice = { ...state.advice };
    delete advice[id];
    next.advice = advice;
  }
  return { state: next, id };
}

const POST_EN: Record<string, string> = {
  chief: "the chief of staff's office",
  foreign: "foreign affairs",
  interior: "the interior",
  military: "the general staff",
  intelligence: "intelligence",
  finance: "the economy",
  industry: "industry",
  science: "science",
};

const ministryEn = (state: Shaped, id: AdvisorId, name?: string) => (isNewMinistry(id) ? `"${name ?? newMinistry(state, id)?.name ?? id}"` : POST_EN[id]);

/** The cabinet's shape for the game master: what is closed, what is new, and what changed since the last turn. */
export function describeCabinetShape(state: Shaped): string[] {
  const shape = state.cabinetShape;
  if (!shape) return [];
  const lines: string[] = [];
  const closed = shape.closed ?? [];
  const created = shape.created ?? [];
  if (closed.length || created.length) {
    lines.push("", "THE CABINET'S SHAPE (the government's own decisions; report nothing for a closed ministry and appoint no one to it):");
    for (const c of closed) lines.push(`- The ministry of ${POST_EN[c.id]} is CLOSED since ${c.since}: no minister, deputies or directives; its portfolio passes to the chief of staff and the other ministries.`);
    for (const m of created)
      lines.push(
        `- ${m.id}: a ministry the government created on ${m.since}, "${m.name}"${m.portfolio ? ` – portfolio: ${m.portfolio}` : ""}${m.tasks?.length ? ` – tasks the government set it: ${m.tasks.join("; ")}` : ""}. Its minister holds post "${m.id}" in "officials"; its id in "ministries" is "${m.id}".${m.names ? "" : ` Give its name in Russian, Ukrainian and English in "names" of its entry in "ministries" this turn, as each language would really write it.`}`,
      );
  }
  if (shape.changes?.length) {
    lines.push("CHANGES TO THE CABINET SINCE THE LAST TURN (they have happened; judge what they bring – staff and money moved, turf won and lost, a bureaucracy grown or cut, how the elites and the public take it):");
    for (const c of shape.changes) {
      const what = ministryEn(state, c.id, c.name);
      lines.push(`- ${c.date}: ${c.kind === "closed" ? `closed ${what}${c.minister ? ` (its minister ${c.minister.name} is out of the government)` : ""}` : c.kind === "reopened" ? `reopened ${what}` : `created ${what}`}`);
    }
  }
  return lines;
}

/** The names the game master gave the new ministries in each language, kept once. In place. */
export function nameNewMinistries(next: GameState, word: { ministry: AdvisorId; names?: Localized }[]): void {
  const created = next.cabinetShape?.created;
  if (!created?.length) return;
  next.cabinetShape = {
    ...next.cabinetShape,
    created: created.map((m) => {
      const names = word.find((w) => w.ministry === m.id)?.names;
      return names && !m.names ? { ...m, names } : m;
    }),
  };
}

/** The turn's record of the cabinet's changes since the last turn, and their slate wiped. In place. */
export function applyCabinetShape(next: GameState, state: Shaped, applied: AppliedChange[]): void {
  const changes = state.cabinetShape?.changes;
  if (!changes?.length) return;
  for (const c of changes) {
    applied.push({ kind: "ministry", change: c.kind, id: c.id, ...(c.name ? { name: c.name } : {}) });
    if (c.minister) applied.push({ kind: "official", post: c.minister.post, title: c.minister.title, name: c.minister.name, change: "dismissed" });
  }
  if (!next.cabinetShape) return;
  const shape = { ...next.cabinetShape };
  delete shape.changes;
  if (shape.closed?.length || shape.created?.length) next.cabinetShape = shape;
  else delete next.cabinetShape;
}

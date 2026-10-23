import { z } from "zod";
import { type BudgetProposal, budgetProposalField, sanitizeBudgetProposal } from "./budgetAdvice";
import { MINISTER_STANCES, type Directive, type GameState, type Localized, type MinisterMood, type Official, type OfficialPost, type Operation, type ResearchDirection, type WeaponKind } from "./types";

/**
 * The cabinet: the leader's chief of staff and seven ministries the player governs through, in the order the
 * cabinet shows them (ids stay as saves have them: "finance" is the economy). Each minister can
 * be questioned between turns (answers in character and advises; the orders
 * are the player's own, though asked for one a minister drafts up to two for
 * the player to add or not), given standing directives — special operations planned
 * in detail among them — and reports on them after every turn, in a request
 * of its own once the turn is played (engine/reports.ts). Asked to, the
 * economy minister proposes a whole budget (engine/budgetAdvice.ts), the
 * science minister a research split and the general staff what industry
 * builds first (engine/advice.ts); the player applies each or not. The
 * turn's game master sees the directives, not the conversations.
 */
export const ADVISORS = ["chief", "foreign", "interior", "military", "intelligence", "finance", "industry", "science"] as const;
export type AdvisorId = (typeof ADVISORS)[number];

/** The post each minister of the cabinet holds. */
export const ADVISOR_POST: Record<AdvisorId, OfficialPost> = {
  chief: "chief",
  foreign: "foreign",
  interior: "interior",
  military: "military",
  intelligence: "intelligence",
  finance: "finance",
  industry: "industry",
  science: "science",
};

export const ADVISOR_TITLES: Record<AdvisorId, Localized> = {
  chief: { ru: "Глава администрации", uk: "Глава адміністрації", en: "Chief of Staff" },
  military: { ru: "Начальник генштаба", uk: "Начальник генштабу", en: "Chief of the General Staff" },
  finance: { ru: "Министр экономики", uk: "Міністр економіки", en: "Minister of the Economy" },
  industry: { ru: "Министр промышленности", uk: "Міністр промисловості", en: "Minister of Industry" },
  foreign: { ru: "Министр иностранных дел", uk: "Міністр закордонних справ", en: "Foreign Minister" },
  interior: { ru: "Министр внутренних дел", uk: "Міністр внутрішніх справ", en: "Minister of the Interior" },
  intelligence: { ru: "Глава разведки", uk: "Голова розвідки", en: "Head of Intelligence" },
  science: { ru: "Министр науки", uk: "Міністр науки", en: "Minister of Science" },
};

/** Who each minister is, for the model. */
export const ADVISOR_PERSONAS: Record<AdvisorId, string> = {
  chief:
    "the head of the leader's office, the chief of staff: the closest adviser, who runs the government's agenda and sees everything — politics, people, appointments, the leader's image, the court and its intrigues, and what every minister is really up to. Speaks frankly to the leader alone.",
  military:
    "the chief of the general staff: armies, fronts, terrain, railways, supply, mobilisation and what the enemy can do. Blunt and practical; thinks in divisions, distances and weeks.",
  finance:
    "the minister of the economy: GDP, the budget, taxes, debt, reserves, prices, the currency and money. Cautious; counts every dollar and warns about deficits, debt and inflation.",
  industry:
    "the minister of industry: factories and production, the strategic resources and their output, trade deals and exports, the people's provision — bread, fuel and goods in the shops — and the war economy: arms production and turning plants over to it. Practical; speaks in tonnes, plants, shifts and shortages.",
  foreign:
    "the foreign minister: alliances, rivals, what each government wants and fears, treaties and how others will react. Polished; sees several moves ahead.",
  interior:
    "the minister of the interior: the police and security at home, public order, the parties and the opposition, elections, the press, propaganda and censorship. Watchful; counts protesters, informers and votes.",
  intelligence:
    "the head of intelligence: what other governments are planning in secret, their weak points, unrest, agents and propaganda. Terse; speaks in estimates and probabilities.",
  science:
    "the minister of science and research: the laboratories, the universities and the academy, the research projects under way (RESEARCH below) and what the scientists can deliver and when — new weapons, industry, medicine, harvests. Precise; speaks in years, budgets and what is physically possible, and fights for money for the scientists.",
};

export interface AdviceMessage {
  from: "player" | "advisor";
  text: string;
  date: string;
  turn: number;
  /** A special operation the minister proposes, for the government to approve. */
  operation?: Operation;
  /** A budget the economy minister proposes, checked by the engine, for the government to apply or not. */
  budget?: BudgetProposal;
  /** A change in the minister's field the leader asked for, checked by the engine (engine/advice.ts), to apply or not. */
  proposal?: AdviceProposal;
  /** The budget or the proposal on this message was applied. */
  applied?: boolean;
  /** Orders the minister drafted because the leader asked for them, to add to the turn as they are (engine/advice.ts). */
  orders?: string[];
}

/** What a minister may propose to change, each in their own field: the science minister the research split, the general staff what industry builds first. */
export interface AdviceProposal {
  research?: Record<ResearchDirection, number>;
  focus?: WeaponKind[];
}

/**
 * A special operation as a minister proposes it or the government plans it
 * itself: a name, every other field capped, the secrecy one of three.
 */
export const OperationSchema = z.object({
  name: z.string().trim().min(1).max(120),
  target: z.string().trim().max(200).default(""),
  goal: z.string().trim().max(400).default(""),
  means: z.string().trim().max(400).default(""),
  timing: z.string().trim().max(120).default(""),
  secrecy: z.enum(["open", "covert", "deniable"]).catch("covert").default("covert"),
});

/** The longest answer kept: a detailed plan the leader asked for fits, a runaway one is cut. */
export const ANSWER_CHARS = 5000;

/**
 * An answer cut to ANSWER_CHARS with its paragraphs kept: at the last
 * sentence or line that fits, or at a word with an ellipsis. A minister who
 * runs long costs a cut, never the whole answer.
 */
export function clipAnswer(text: string): string {
  const all = text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (all.length <= ANSWER_CHARS) return all;
  const head = all.slice(0, ANSWER_CHARS + 1);
  // Where the last whole sentence or line ends, its closing quote kept; the "12." of a numbered step is no end.
  let end = -1;
  for (const m of head.matchAll(/[.!?…]["»”]?(?=\s)|\n/g)) {
    const line = head.slice(head.lastIndexOf("\n", m.index - 1) + 1, m.index);
    if (m[0] !== "\n" && /^\s*\d+$/.test(line)) continue;
    end = m[0] === "\n" ? m.index : m.index + m[0].length;
  }
  if (end >= ANSWER_CHARS * 0.6) return head.slice(0, end).trim();
  return `${head.slice(0, head.lastIndexOf(" ", ANSWER_CHARS - 1)).trim()}…`;
}

export const AdviceSchema = z.object({
  answer: z.string().trim().min(1).transform(clipAnswer),
  // A special operation the minister proposes; it starts only when the government approves it.
  operation: OperationSchema.optional().catch(undefined),
  // A budget the economy minister proposes; the engine bounds it and the player applies it or not.
  budget: budgetProposalField,
  // How the question left the minister towards the leader, when it moved them; the engine moves them one step at most.
  mood: z.enum(MINISTER_STANCES).optional().catch(undefined),
  grievance: z.string().trim().max(300).optional().catch(undefined),
  // Orders drafted at the leader's request; engine/advice.ts trims them and drops what the turn already has.
  orders: z.array(z.string()).optional().catch(undefined),
  // A change the leader asked for, as the model words it; engine/advice.ts keeps only what the minister may propose.
  proposal: z
    .object({
      research: z.record(z.string(), z.number()).optional().catch(undefined),
      focus: z.array(z.string()).optional().catch(undefined),
    })
    .optional()
    .catch(undefined),
});

export type AdviceReply = z.infer<typeof AdviceSchema>;

/**
 * A person's mood after a question, as the answer proposes it: one step at
 * most from where they stood (loyal, uneasy, opposed, resigning), never past
 * opposed for someone devoted to the leader (loyalty 4 or more), with a
 * grievance only when they object. Nothing when the answer leaves them as
 * they were. The turn is the current one, so a view of the turn before that
 * arrives later does not undo it.
 */
export function swayOf(person: Pick<Official, "loyalty" | "mood"> | undefined, reply: Pick<AdviceReply, "mood" | "grievance">, turn: number): MinisterMood | undefined {
  if (!person || !reply.mood) return undefined;
  const now = person.mood?.stance ?? "loyal";
  const from = MINISTER_STANCES.indexOf(now);
  let stance = MINISTER_STANCES[from + Math.sign(MINISTER_STANCES.indexOf(reply.mood) - from)];
  if (stance === "resigning" && person.loyalty >= 4) stance = "opposed";
  if (stance === now) return undefined;
  const grievance = (stance === "opposed" || stance === "resigning") && reply.grievance ? reply.grievance : undefined;
  return { stance, ...(grievance ? { grievance } : {}), turn };
}

/** How many earlier messages with a minister the model sees, and how many a save keeps. */
export const ADVISOR_HISTORY = 8;
export const MAX_ADVICE = 40;

export function addAdvice(state: GameState, advisor: AdvisorId, question: string, reply: AdviceReply, now = new Date()): GameState {
  const next = structuredClone(state);
  const thread = next.advice?.[advisor] ?? [];
  const asked: AdviceMessage = { from: "player", text: question, date: state.date, turn: state.turn };
  const answered: AdviceMessage = {
    from: "advisor",
    text: reply.answer,
    date: state.date,
    turn: state.turn,
    ...(reply.operation ? { operation: reply.operation } : {}),
  };
  const economy = state.countries[state.player]?.economy;
  const budget = advisor === "finance" && reply.budget && economy ? sanitizeBudgetProposal(economy, reply.budget) : null;
  if (budget) answered.budget = budget;
  next.advice = { ...next.advice, [advisor]: [...thread, asked, answered].slice(-MAX_ADVICE) };
  // How it was asked may please or offend the minister.
  const post = ADVISOR_POST[advisor];
  const mood = swayOf(next.officials?.find((o) => o.post === post), reply, state.turn);
  if (mood) next.officials = next.officials?.map((o) => (o.post === post ? { ...o, mood } : o));
  next.updatedAt = now.toISOString();
  return next;
}

/** Ministries that plan special operations in detail. */
export const OPERATION_MINISTRIES: AdvisorId[] = ["military", "intelligence", "interior"];

/** How many directives may stand at once, across the cabinet. */
export const MAX_DIRECTIVES = 12;

/** A ministry's report on one directive. */
export const DIRECTIVE_STATUSES = ["progress", "done", "failed"] as const;

/** The first directive id of this turn that no standing directive has. */
export function nextDirectiveId(directives: Pick<Directive, "id">[], turn: number): string {
  let n = directives.length + 1;
  while (directives.some((d) => d.id === `d${turn}-${n}`)) n++;
  return `d${turn}-${n}`;
}

/**
 * A special operation the government plans itself (the orders panel's
 * operations tab), held to the rules of one a minister proposes: a ministry
 * that runs operations, every field checked and capped (OperationSchema), a
 * name not already running in that ministry, and room among the directives.
 * It starts as a standing directive, as an approved proposal does: the game
 * master carries it out turn by turn and reports it done or failed, and the
 * engine closes it. `describe` gives its line in the interface language. The
 * directives with it added, or null when it does not pass.
 */
export function planOperation(
  state: Pick<GameState, "directives" | "turn" | "date">,
  ministry: AdvisorId,
  input: unknown,
  describe: (o: Operation) => string,
): Directive[] | null {
  if (!OPERATION_MINISTRIES.includes(ministry)) return null;
  const parsed = OperationSchema.safeParse(input);
  if (!parsed.success) return null;
  const operation: Operation = parsed.data;
  const directives = state.directives ?? [];
  if (directives.length >= MAX_DIRECTIVES) return null;
  if (directives.some((d) => d.ministry === ministry && d.operation?.name.toLowerCase() === operation.name.toLowerCase())) return null;
  const text = describe(operation).trim().slice(0, 300) || operation.name;
  return [...directives, { id: nextDirectiveId(directives, state.turn), ministry, text, since: state.date, operation }];
}

/** A directive in one line for the game master: the task, or the operation in full. */
export function directiveLine(d: Directive): string {
  if (!d.operation) return `${d.id}: ${d.text} (since ${d.since})`;
  const o = d.operation;
  return `${d.id}: SPECIAL OPERATION "${o.name}" — target: ${o.target}; goal: ${o.goal}; means: ${o.means}; timing: ${o.timing}; secrecy: ${o.secrecy} (ordered ${d.since})`;
}

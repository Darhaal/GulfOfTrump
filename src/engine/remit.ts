import { ADVISOR_POST, ADVISORS, forNew, type AdvisorId } from "./advisors";
import { happens } from "./dice";
import { isFigure, ministryOf, standingOf } from "./figures";
import { officialAt } from "./government";
import { cabinetPlots, standing as officialStanding } from "./intrigue";
import { samePerson } from "./people";
import { regimeNow } from "./role";
import type { AppliedChange, GameState, PlayerRole, RegimeKind, RoleArea, RoleProposal } from "./types";

/**
 * Each role its own game. The leader governs every part of the state. A
 * minister governs the part their ministry runs and reads the rest; a
 * general commands the army and reads the rest; the opposition runs its own
 * party (its own panel) and plays parliament from the opposition benches,
 * and reads the rest. What a minister or a general wants beyond their post
 * they can only propose to the leader, who takes it up or not by the
 * engine's dice: the kind of rule, the player's standing, and how far the
 * leader trusts the colleague whose business it is.
 */

/** How a role stands to a part of the state: it governs it, plays it from the opposition, or only reads it. */
export type Access = "govern" | "opposition" | "read";

/** The parts of the state each ministry runs. The leader's office and the intelligence service run none of the panels: theirs is the court and the shadows. */
export const MINISTRY_AREAS: Record<AdvisorId, readonly RoleArea[]> = {
  chief: [],
  foreign: ["foreign"],
  interior: ["politics"],
  military: ["army"],
  intelligence: [],
  finance: ["economy"],
  industry: ["economy"],
  science: ["science"],
  space: ["science"],
  // A ministry the government created runs none of the panels: its portfolio is its own words.
  ...forNew([] as readonly RoleArea[]),
};

/** What a ministry may not touch in a panel it shares with another: the budget is the finance ministry's; trade deals and the industry line's split between heavy and light industry are industry's. */
export type EconomyPart = "budget" | "deals" | "split";
const ECONOMY_PART: Partial<Record<AdvisorId, EconomyPart[]>> = { finance: ["budget"], industry: ["deals", "split"] };

/** The parts of the state a role governs. */
export function areasOf(role: PlayerRole | undefined): readonly RoleArea[] {
  if (!role || role.kind === "leader") return ["politics", "foreign", "economy", "army", "science"];
  if (role.kind === "general") return ["army"];
  if (role.kind === "minister") {
    const ministry = role.post ? ministryOf(role.post) : undefined;
    return ministry ? MINISTRY_AREAS[ministry] : [];
  }
  return [];
}

/** How the player's role stands to a part of the state. */
export function accessTo(state: Pick<GameState, "role">, area: RoleArea): Access {
  const role = state.role;
  if (!role || role.kind === "leader") return "govern";
  if (role.kind === "opposition") return area === "politics" ? "opposition" : "read";
  return areasOf(role).includes(area) ? "govern" : "read";
}

/** Which part of the economy panel the player may change: all of it for the leader, the ministry's own part for a minister, none for the rest. */
export function economyParts(state: Pick<GameState, "role">): EconomyPart[] {
  if (accessTo(state, "economy") !== "govern") return [];
  const role = state.role;
  if (role?.kind !== "minister" || !role.post) return ["budget", "deals", "split"];
  return ECONOMY_PART[ministryOf(role.post) ?? "chief"] ?? [];
}

/** The ministry whose business a part of the state is, the first of them where two share it. */
export const ministryFor = (area: RoleArea): AdvisorId | undefined => ADVISORS.find((a) => MINISTRY_AREAS[a].includes(area));

/** Proposals a minister or a general can put to the leader at once. */
export const MAX_PROPOSALS = 2;
/** The longest proposal, characters. */
export const PROPOSAL_CHARS = 300;

/**
 * Whether the player can put a proposal on this part of the state to the leader: a minister or a general, on what
 * lies beyond their post – and the minister who governs politics (the interior) on the motions of state, which are
 * the leader's: an early election, putting one off, a vote of confidence, an amendment, emergency rule
 * (engine/parliament.ts MINISTER_MOTIONS).
 */
export const canPropose = (state: Pick<GameState, "role">, area: RoleArea): boolean =>
  isFigure(state) && !state.role?.fall && (accessTo(state, area) === "read" || (area === "politics" && state.role?.kind === "minister"));

/** How readily a leader takes up a proposal from beyond a person's post, by the kind of rule: a cabinet that decides together listens more. */
const EAR: Record<RegimeKind, number> = { democracy: 0.42, limited: 0.36, party: 0.3, autocracy: 0.26, military: 0.3 };

/**
 * The chance the leader takes up the player's proposal on a part of the
 * state, 0–1: the kind of rule; how far the leader listens to the player;
 * the leader's own chief of staff is heard on anything, a general less
 * beyond the army; and the colleague whose business it is — the more the
 * leader trusts them (their standing, 1–5), the less he lets another
 * minister into their field.
 */
export function proposalChance(state: Pick<GameState, "role" | "politics" | "scenarioId" | "player" | "defeat" | "officials">, area: RoleArea): number {
  if (!isFigure(state)) return 0;
  const role = state.role!;
  const s = standingOf(role);
  let chance = EAR[regimeNow(state)] + (s.influence - 50) / 120 + (s.loyalty - 50) / 400;
  if (role.kind === "minister" && role.post === "chief") chance += 0.1;
  if (role.kind === "general") chance -= 0.05;
  const ministry = ministryFor(area);
  const owner = ministry ? officialAt(state, ADVISOR_POST[ministry]) : undefined;
  if (owner && !(role.person && samePerson(owner.name, role.person.name))) chance -= (officialStanding(owner) - 3) * 0.05;
  return Math.round(Math.max(0.05, Math.min(0.85, chance)) * 100) / 100;
}

/** The player puts a proposal to the leader; nothing changes when it cannot be made or there are as many as the turn takes. */
export function addProposal(state: GameState, text: string, area: RoleArea, now = new Date()): GameState {
  const words = text.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, PROPOSAL_CHARS);
  const pending = state.role?.proposals ?? [];
  if (words.length < 3 || !canPropose(state, area) || pending.length >= MAX_PROPOSALS || pending.some((p) => p.text === words)) return state;
  const proposal: RoleProposal = { id: `prop-${state.turn}-${pending.length + 1}-${now.getTime().toString(36)}`, text: words, area, date: state.date };
  return { ...state, role: { ...state.role!, proposals: [...pending, proposal] }, updatedAt: now.toISOString() };
}

/** The player takes a proposal back before the turn is played. */
export function withdrawProposal(state: GameState, id: string, now = new Date()): GameState {
  const pending = state.role?.proposals ?? [];
  if (!pending.some((p) => p.id === id)) return state;
  const rest = pending.filter((p) => p.id !== id);
  const role: PlayerRole = { ...state.role!, proposals: rest };
  if (!rest.length) delete role.proposals;
  return { ...state, role, updatedAt: now.toISOString() };
}

/** Which of the player's proposals the leader takes up this turn, by the game's dice: the same for the same game, turn and proposal. */
export function castProposals(state: GameState): boolean[] {
  if (!isFigure(state)) return [];
  return (state.role?.proposals ?? []).map((p) => happens(proposalChance(state, p.area), state.seed ?? state.id, state.turn, `proposal:${p.id}`));
}

/** The prompt's lines on the player's proposals and the leader's answer to each, as the dice cast it. */
export function describeProposals(state: GameState, answers: boolean[]): string[] {
  const proposals = isFigure(state) ? (state.role?.proposals ?? []) : [];
  if (!proposals.length) return [];
  return [
    "THE PLAYER'S PROPOSALS TO THE LEADER (beyond the player's post; the leader's answer is the engine's dice and final):",
    ...proposals.map((p, i) => `- "${p.text.replaceAll('"', "'")}" (${p.area}): the leader ${answers[i] ? "TAKES IT UP – the government carries it out as its own decision, and credits the player or not as the leader would" : "TURNS IT DOWN – nothing is done; the colleague whose business it is may resent the meddling"}.`),
  ];
}

/** Applies the leader's answers: logged, a little standing won or lost, and the proposals cleared. In place. */
export function applyProposals(next: GameState, answers: boolean[], applied: AppliedChange[]): void {
  const role = next.role;
  const proposals = role?.proposals ?? [];
  if (!role || !proposals.length) return;
  const accepted = proposals.filter((_, i) => answers[i]).map((p) => p.text);
  const refused = proposals.filter((_, i) => !answers[i]).map((p) => p.text);
  applied.push({ kind: "proposals", accepted, refused });
  const kept: PlayerRole = { ...role };
  delete kept.proposals;
  if (kept.standing) kept.standing = { ...kept.standing, influence: Math.max(0, Math.min(100, kept.standing.influence + Math.max(-2, Math.min(2, accepted.length - refused.length)))) };
  next.role = kept;
}

/** How the leader hears the player, by their influence: hardly, coolly, readily, or as a confidant. */
export type Ear = "deaf" | "cool" | "warm" | "close";
export const earOf = (influence: number): Ear => (influence < 30 ? "deaf" : influence < 50 ? "cool" : influence < 70 ? "warm" : "close");

/** The cabinet's plots aimed at the player's own post or person, as far as anyone in the cabinet hears of them: known, or rumoured. */
export function plotsAgainst(state: Pick<GameState, "role" | "politics">) {
  const role = state.role;
  if (role?.kind !== "minister") return [];
  return cabinetPlots(state).filter((p) => (p.known || p.cabinet.rumour) && (p.cabinet.target === role.post || (role.person && samePerson(p.cabinet.targetName, role.person.name))));
}

/** Whole months between two dates. */
export function monthsIn(since: string, now: string): number {
  const [y1, m1] = since.split("-").map(Number);
  const [y2, m2] = now.split("-").map(Number);
  return Math.max(0, (y2 - y1) * 12 + (m2 - m1));
}

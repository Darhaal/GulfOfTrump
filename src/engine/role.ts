import { z } from "zod";
import { regimeAtStart, regimeFromText } from "./abroad";
import { happens } from "./dice";
import { STEP_YEARS } from "./economy";
import { chooseHost, hostStands } from "./exile";
import { leaderOf, personFor } from "./people";
import { loyaltyOf } from "./politics";
import { en } from "./text";
import { FALL_UNREST } from "./unrest";
import { MOVEMENT_SCORES, RISE_HOWS } from "./types";
import type { AppliedChange, GameState, Gender, Movement, MovementKind, Party, Person, PlayerRole, RegimeKind, Repression, RiseHow } from "./types";

/**
 * Who the player is. Most games are played as the country's leader, as
 * always. The player may instead lead the opposition — a legal party, a
 * movement underground or one in exile — and then does not command the
 * state: the game master plays its government like any other, the orders
 * are the movement's, and the engine keeps the movement's strength and the
 * state's hand against it. A leader whose government falls may stay with
 * the country (and play the next government) or stay with the person, into
 * opposition or exile (engine/exile.ts); an opposition that takes power
 * governs again. Ministers and generals are engine/figures.ts; the person's
 * own falls — resignation, dismissal, death — engine/fate.ts.
 */

const shortText = z.string().trim().max(300);

/** The role a game is played in; a game from before roles is the leader's. */
export const roleOf = (state: Pick<GameState, "role" | "date">): PlayerRole => state.role ?? { kind: "leader", since: state.date };
export const isOpposition = (state: Pick<GameState, "role">): boolean => state.role?.kind === "opposition";

/**
 * Whether a coup or a revolution pins the player's regime: the description the
 * game master gave at the fall still stands. Once it names the regime anew, its
 * words rule again. A fall from before the text was kept pins it until the
 * player plays on.
 */
export function regimePinned(state: Pick<GameState, "politics"> & { defeat?: GameState["defeat"] }): boolean {
  const d = state.defeat;
  if (!d || (d.how !== "coup" && d.how !== "revolution" && d.how !== "uprising")) return false;
  return d.regime === undefined ? !d.continued : d.regime === (state.politics?.regime ?? "");
}

/**
 * How the player's country is governed now: by its politics once described,
 * else by the scenario's table — and no longer freely after a coup (the army
 * rules) or a revolution (a new autocracy) while the old description stands.
 * Every reader of the player's regime goes through here (engine/parliament.ts
 * holdsElections, the police state, the classes, the families, the courts).
 */
export function regimeNow(state: Pick<GameState, "politics" | "scenarioId" | "player"> & { defeat?: GameState["defeat"] }): RegimeKind {
  const text = state.politics?.regime;
  const regime = text ? regimeFromText(text) : regimeAtStart(state.scenarioId, state.player);
  const free = regime === "democracy" || regime === "limited";
  if (free && regimePinned(state)) return state.defeat?.how === "coup" ? "military" : "autocracy";
  return regime;
}

/** The game master's line while a fall pins the regime: how the engine reads it, and that a new description lifts the pin. */
export function regimeNote(state: Pick<GameState, "politics" | "scenarioId" | "player"> & { defeat?: GameState["defeat"] }): string[] {
  const d = state.defeat;
  if (!d || !regimePinned(state) || !state.politics?.regime) return [];
  const text = regimeFromText(state.politics.regime);
  if (text !== "democracy" && text !== "limited") return [];
  return [`THE REGIME SINCE THE ${d.how === "coup" ? "COUP" : "REVOLUTION"} OF ${d.date}: the engine reads the country as ${d.how === "coup" ? "ruled by the army" : "a new autocracy"} while the regime above stands as it was described before the fall – give politics.regime anew once the new rulers have set up theirs.`];
}

/** Where a vote can change the government an opposition may be a party; elsewhere it starts underground. */
const OPEN: Record<RegimeKind, boolean> = { democracy: true, limited: true, party: false, autocracy: false, military: false };
export const openRegime = (regime: RegimeKind): boolean => OPEN[regime];

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

/** A new opposition: a small legal party where there are elections, a handful of people underground where there are not. */
/** How an opposition starts: a movement as the regime allows, a dissident's circle at home, or an émigré's abroad. */
export type OppositionStart = "movement" | "dissident" | "emigre";

export function startingMovement(regime: RegimeKind, name?: string, as: OppositionStart = "movement"): Movement {
  const open = OPEN[regime];
  // A dissident: one voice and a few friends at home – samizdat, contacts, the watch of the police; a movement may grow from it.
  if (as === "dissident") return { ...(name?.trim() ? { name: name.trim() } : {}), kind: "underground", status: open ? "free" : "harassed", support: 2, members: 1, money: 5, press: 12, insiders: 3, army: 0, street: 4 };
  // An émigré: abroad, sheltered by a government that would (engine/exile.ts) – broadcasts home, letters, lobbying, a way back.
  if (as === "emigre") return { ...(name?.trim() ? { name: name.trim() } : {}), kind: "exile", status: "free", support: 3, members: 2, money: 15, press: 20, insiders: 3, army: 0, street: 2 };
  return {
    ...(name?.trim() ? { name: name.trim() } : {}),
    kind: open ? "party" : "underground",
    status: open ? "free" : "harassed",
    support: open ? 12 : 4,
    members: open ? 60 : 3,
    money: open ? 30 : 10,
    press: open ? 35 : 10,
    insiders: open ? 10 : 5,
    army: 5,
    street: open ? 25 : 10,
  };
}

/** The longest self-description a player gives their opposition: one paragraph. */
export const ABOUT_CHARS = 600;

/**
 * The player's words on who they are, as the game master will read them:
 * one paragraph, control characters and runs of space gone, cut at a word
 * within ABOUT_CHARS. It reaches the model as an order does.
 */
export function cleanAbout(text: string | undefined): string {
  const one =(text ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  if (one.length <= ABOUT_CHARS) return one;
  const cut = one.slice(0, ABOUT_CHARS);
  const space = cut.lastIndexOf(" ");
  return (space > ABOUT_CHARS * 0.6 ? cut.slice(0, space) : cut).trim();
}

/**
 * The role a new game starts in: the leader, or the opposition with whatever
 * the player said of it — names, or a paragraph on who they are and whose
 * side they take, from which the game master names them.
 */
export function startingRole(regime: RegimeKind, date: string, choice?: { kind: PlayerRole["kind"]; person?: string; gender?: Gender; movement?: string; about?: string; as?: OppositionStart }): PlayerRole {
  // A minister or a general starts by engine/figures.ts (startingFigure).
  if (!choice || choice.kind !== "opposition") return { kind: "leader", since: date, how: "start" };
  const year = Number(date.slice(0, 4));
  const about = cleanAbout(choice.about);
  return {
    kind: "opposition",
    ...(choice.person?.trim() ? { person: personFor(choice.person.trim(), year, choice.gender) } : {}),
    movement: startingMovement(regime, choice.movement, choice.as),
    ...(about ? { about } : {}),
    since: date,
    how: "start",
  };
}

/** The base danger to an opposition under each kind of rule, % a month. */
const BASE_RISK: Record<RegimeKind, number> = { democracy: 1, limited: 8, party: 22, autocracy: 18, military: 26 };

/**
 * How likely the state is to strike at the movement this month, %: the kind
 * of rule and its laws, how loyal its police and secret services are, how
 * loud the movement is, and how many friends it has inside. Abroad, out of reach.
 */
export function movementRisk(state: Pick<GameState, "role" | "politics" | "scenarioId" | "player" | "defeat">): number {
  const m = state.role?.movement;
  if (!m || m.kind === "exile") return 0;
  let risk = BASE_RISK[regimeNow(state)];
  const laws = state.politics?.laws;
  if (laws?.assembly === "banned") risk += 8;
  else if (laws?.assembly === "permit") risk += 2;
  if (laws?.press === "censored" || laws?.press === "state") risk += 5;
  if (state.politics) {
    const loyalty = loyaltyOf(state.politics);
    risk += ((loyalty.police + loyalty.security) / 2 - 50) / 5;
  }
  // A loud movement is seen; friends in the government warn it and soften the blow.
  risk += (m.street + m.press) / 20 - m.insiders / 8;
  if (m.kind === "underground") risk -= 4;
  if (m.status === "banned") risk += 6;
  return Math.round(clamp(risk, 0, 60));
}

/** The next rung of the state's ladder against a movement. */
function nextRung(m: Movement): Repression | null {
  if (m.kind === "exile") return null;
  if (m.status === "free") return "harassed";
  if (m.status === "harassed") return m.kind === "party" ? "banned" : "arrested";
  if (m.status === "banned") return "arrested";
  return "exiled";
}

/** What the state does to the movement this turn, decided by the game's dice before the turn is written. */
export function castRepression(state: GameState): Repression | null {
  const m = state.role?.kind === "opposition" ? state.role.movement : undefined;
  if (!m) return null;
  const months = STEP_YEARS[state.step] * 12;
  const chance = 1 - (1 - movementRisk(state) / 100) ** Math.max(0.25, months);
  if (!happens(chance, state.seed ?? state.id, state.turn, "repression")) return null;
  return nextRung(m);
}

/** What a turn's answer says about the player's movement: changes, never totals. */
export const oppositionField = z
  .object({
    // Names, only while the movement or its leader has none.
    name: shortText.optional(),
    leader: shortText.optional(),
    gender: z.enum(["male", "female"]).optional().catch(undefined),
    support: z.number().finite().optional(),
    members: z.number().finite().optional(),
    money: z.number().finite().optional(),
    press: z.number().finite().optional(),
    insiders: z.number().finite().optional(),
    army: z.number().finite().optional(),
    street: z.number().finite().optional(),
    // The government lifts a ban or lets the leader go.
    released: z.boolean().optional().catch(undefined),
    // The movement takes power.
    rise: z
      .object({ how: z.enum(RISE_HOWS).catch("election"), government: shortText.optional(), note: z.string().trim().max(2000).default("") })
      .optional()
      .catch(undefined),
  })
  .optional()
  .catch(undefined);

export type OppositionChange = NonNullable<z.infer<typeof oppositionField>>;

/** How far a movement's scores can move in a turn of this length, points (support) or points of 100. */
export function maxShift(step: GameState["step"]): number {
  return Math.round(clamp(4 + 16 * Math.sqrt(STEP_YEARS[step]), 5, 20));
}

/**
 * Whether the movement can take power this way, as things stand after the
 * turn: by an election it stood in and is big enough to win, by a revolution
 * the street can carry when the country boils over, by a coup it has the
 * officers for, or by being called into government by friends inside.
 */
export function canRise(state: Pick<GameState, "role" | "politics" | "protests" | "player">, how: RiseHow, opts: { election: boolean }): boolean {
  const m = state.role?.movement;
  if (!m) return false;
  const street = m.street >= 55 && ((state.politics?.unrest ?? 0) >= FALL_UNREST || (state.protests ?? []).some((p) => !p.country && p.stage === "uprising"));
  switch (how) {
    case "election":
      // The movement's allies bring part of their voters (blocSupport).
      return opts.election && m.kind === "party" && m.status !== "arrested" && blocSupport(state) >= 25;
    case "revolution":
      return m.kind !== "exile" ? street : street && m.army >= 30;
    case "coup":
      return m.army >= 50 || (m.army >= 35 && m.insiders >= 50);
    case "appointed":
      return m.status === "free" && m.insiders >= 50 && m.support >= 15;
  }
}

/** The movement's changes, each within a turn's reach; names only where none were given. */
export function sanitizeOpposition(state: GameState, raw: OppositionChange | undefined): OppositionChange | undefined {
  if (!raw || !isOpposition(state)) return undefined;
  const role = state.role!;
  const m = role.movement!;
  const shift = maxShift(state.step);
  const within = (v: number | undefined, span: number) => (v === undefined ? undefined : round1(clamp(v, -span, span)));
  return {
    ...(raw.name && !m.name ? { name: raw.name } : {}),
    ...(raw.leader && !role.person ? { leader: raw.leader, ...(raw.gender ? { gender: raw.gender } : {}) } : {}),
    ...(raw.support !== undefined ? { support: within(raw.support, shift) } : {}),
    // Members grow by a share of what there is, and some newcomers on top.
    ...(raw.members !== undefined ? { members: within(raw.members, m.members * 0.6 + 10 * shift) } : {}),
    ...Object.fromEntries(MOVEMENT_SCORES.map((k) => [k, within(raw[k], shift * 1.5)]).filter(([, v]) => v !== undefined)),
    ...(raw.released && (m.status === "banned" || m.status === "arrested") ? { released: true } : {}),
    ...(raw.rise ? { rise: raw.rise } : {}),
  };
}

/** Puts one rung of repression on the movement, with what it costs and what the martyrdom brings. */
function repress(m: Movement, event: Repression): Movement {
  const next = { ...m };
  switch (event) {
    case "harassed":
      next.status = "harassed";
      next.money = Math.max(0, next.money - 5);
      break;
    case "banned":
      next.status = "banned";
      next.kind = "underground";
      next.members = Math.round(next.members * 0.6);
      next.press = Math.max(0, next.press - 15);
      next.support += 2;
      break;
    case "arrested":
      next.status = "arrested";
      next.street = Math.max(0, next.street - 10);
      next.members = Math.round(next.members * 0.8);
      next.support += 3;
      break;
    case "exiled":
      next.status = "free";
      next.kind = "exile";
      next.street = Math.max(0, next.street - 15);
      next.insiders = Math.max(0, next.insiders - 10);
      break;
  }
  return next;
}

const sameName = (a: string | undefined, b: string | undefined) => Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());

/** The movement's own party in the player's politics, if the game master lists it. */
export const movementParty = (state: Pick<GameState, "politics" | "role">): Party | undefined =>
  state.politics?.parties.find((p) => sameName(p.name, state.role?.movement?.name) || sameName(p.leader, state.role?.person?.name));

/** Offers of a coalition the movement can have out at once. */
export const MAX_OFFERS = 2;

/** The movement's allies as the country's politics list them now: parties that still exist and are not in the government. */
export function alliesOf(state: Pick<GameState, "politics" | "role">): Party[] {
  const ids = state.role?.movement?.allies ?? [];
  return (state.politics?.parties ?? []).filter((p) => ids.includes(p.id) && p.status !== "ruling" && p.status !== "coalition");
}

/** The parties the movement could offer a coalition to: any other party outside the government, not its ally already. */
export function coalitionCandidates(state: Pick<GameState, "politics" | "role">): Party[] {
  if (!isOpposition(state)) return [];
  const own = movementParty(state);
  const allies = state.role?.movement?.allies ?? [];
  return (state.politics?.parties ?? []).filter((p) => p.id !== own?.id && p.status !== "ruling" && p.status !== "coalition" && !allies.includes(p.id));
}

/** How far apart two parties' ideas are, 0 (the same) to 1 (opposite on every axis). */
const ideaDistance = (a: Party["stance"], b: Party["stance"]) => (Math.abs(a.economy - b.economy) + Math.abs(a.freedom - b.freedom) + Math.abs(a.nation - b.nation)) / 60;

/**
 * How likely a party is to take up the movement's offer of a coalition, 0–1:
 * how near its ideas are to the movement's own party, how big the movement is
 * beside it, its friends inside, and the danger of standing with a movement
 * the state hunts – which an outlawed party has little left to fear.
 */
export function coalitionChance(state: Pick<GameState, "politics" | "role">, partyId: string): number {
  const m = state.role?.movement;
  const party = state.politics?.parties.find((p) => p.id === partyId);
  if (!m || !party || !isOpposition(state)) return 0;
  const own = movementParty(state);
  const distance = own ? ideaDistance(own.stance, party.stance) : 0.4;
  let chance = 0.55 - distance * 0.9 + (m.support - party.support) / 100 + m.insiders / 400;
  if (m.status === "banned" || m.status === "arrested") chance -= 0.15;
  if (m.kind === "exile") chance -= 0.1;
  if (party.status === "underground" || party.status === "banned") chance += 0.1;
  return Math.round(clamp(chance, 0.05, 0.85) * 100) / 100;
}

/** The movement offers a party a coalition; the party answers as the next turn is played, by the chance as it stands now. */
export function offerCoalition(state: GameState, partyId: string, now = new Date()): GameState {
  const m = isOpposition(state) ? state.role!.movement : undefined;
  const offers = m?.offers ?? [];
  if (!m || offers.length >= MAX_OFFERS || offers.some((o) => o.party === partyId) || !coalitionCandidates(state).some((p) => p.id === partyId)) return state;
  return { ...state, role: { ...state.role!, movement: { ...m, offers: [...offers, { party: partyId, chance: coalitionChance(state, partyId) }] } }, updatedAt: now.toISOString() };
}

/** The movement takes an offer back before the turn, or leaves a coalition. */
export function dropCoalition(state: GameState, partyId: string, now = new Date()): GameState {
  const m = isOpposition(state) ? state.role!.movement : undefined;
  if (!m || !(m.offers?.some((o) => o.party === partyId) || m.allies?.includes(partyId))) return state;
  const movement: Movement = { ...m, offers: (m.offers ?? []).filter((o) => o.party !== partyId), allies: (m.allies ?? []).filter((id) => id !== partyId) };
  if (!movement.offers!.length) delete movement.offers;
  if (!movement.allies!.length) delete movement.allies;
  return { ...state, role: { ...state.role!, movement }, updatedAt: now.toISOString() };
}

/** Which of the movement's offers the parties take up this turn, by the game's dice. */
export function castCoalitions(state: Pick<GameState, "role" | "seed" | "id" | "turn">): boolean[] {
  const offers = state.role?.kind === "opposition" ? (state.role.movement?.offers ?? []) : [];
  return offers.map((o) => happens(o.chance, state.seed ?? state.id, state.turn, `coalition:${o.party}`));
}

/** The support the movement and its allies bring to a vote together: its own, and half of each ally's, whose voters do not all follow. */
export function blocSupport(state: Pick<GameState, "politics" | "role">): number {
  const m = state.role?.movement;
  if (!m) return 0;
  return round1(m.support + alliesOf(state).reduce((sum, p) => sum + p.support / 2, 0));
}

/**
 * Applies a turn to the movement: the state's dice first, then what the game
 * master says the period did to it, then — if it took power and the engine
 * allows it — the government. In place.
 */
export function applyOpposition(
  next: GameState,
  change: OppositionChange | undefined,
  repression: Repression | null,
  ctx: { to: string; election: boolean },
  applied: AppliedChange[],
): void {
  if (!isOpposition(next)) return;
  // The parties the movement offered a coalition answer first, by the chance each had when offered.
  const answers = castCoalitions(next);
  const role = (next.role = { ...next.role! });
  let m: Movement = { ...role.movement! };
  if (repression) {
    m = repress(m, repression);
    applied.push({ kind: "repression", event: repression });
  }
  // Abroad, someone shelters the movement: whoever would, when its host is gone or it has none yet (engine/exile.ts).
  if (m.kind === "exile" && !hostStands(next, m.host)) {
    const host = chooseHost(next);
    if (host) m.host = host;
    else delete m.host;
  }
  if (change) {
    if (change.name) {
      m.name = change.name;
      applied.push({ kind: "movement", change: "named", name: change.name });
    }
    if (change.leader) role.person = personFor(change.leader, Number(ctx.to.slice(0, 4)), change.gender);
    m.support = round1(clamp(m.support + (change.support ?? 0), 0, 95));
    m.members = Math.max(0, Math.round(m.members + (change.members ?? 0)));
    for (const k of MOVEMENT_SCORES) m[k] = Math.round(clamp(m[k] + (change[k] ?? 0), 0, 100));
    // A release the dice did not just undo.
    if (change.released && !repression && (m.status === "banned" || m.status === "arrested")) {
      m.status = "harassed";
      if (m.kind === "underground" && OPEN[regimeNow(next)]) m.kind = "party";
      applied.push({ kind: "movement", change: "released", name: m.name ?? "" });
    }
  }
  (m.offers ?? []).forEach((offer, i) => {
    const party = next.politics?.parties.find((p) => p.id === offer.party);
    if (!party) return;
    if (answers[i] && party.status !== "ruling" && party.status !== "coalition") m.allies = [...new Set([...(m.allies ?? []), party.id])];
    applied.push({ kind: "movement", change: answers[i] ? "allied" : "refused", name: party.name });
  });
  delete m.offers;
  // An ally gone from politics, or gone over to the government, is no ally.
  if (m.allies) {
    const still = alliesOf({ politics: next.politics, role: { ...role, movement: m } }).map((p) => p.id);
    if (still.length) m.allies = still;
    else delete m.allies;
  }
  role.movement = m;
  // The movement's party keeps its status in the country's politics.
  const party = movementParty(next);
  if (party && next.politics) {
    const status: Party["status"] = m.status === "banned" ? "banned" : m.kind === "party" ? "opposition" : "underground";
    if (party.status !== status && party.status !== "ruling" && party.status !== "coalition") {
      next.politics = { ...next.politics, parties: next.politics.parties.map((p) => (p.id === party.id ? { ...p, status } : p)) };
    }
  }
  const rise = change?.rise;
  if (rise && canRise(next, rise.how, { election: ctx.election })) takePower(next, rise.how, rise.government, ctx.to, applied);
}

/** The movement in office: its leader leads the country, its party rules, the old government's people go, and the player governs again. */
export function takePower(next: GameState, how: RiseHow, government: string | undefined, to: string, applied: AppliedChange[]): void {
  const role = next.role!;
  const m = role.movement!;
  const year = Number(to.slice(0, 4));
  const person: Person & { title?: string } = role.person ?? personFor(m.name ?? "", year);
  const country = next.countries[next.player];
  country.leader = person.name;
  if (government) country.government = government;
  // The leader line already reads as this person, with the sex and portrait the role has.
  country.rulers = { line: person.name, people: [{ id: person.id, name: person.name, gender: person.gender, ...(person.portrait ? { portrait: person.portrait } : {}) }], lead: 0 };
  if (next.politics) {
    const own = movementParty(next);
    next.politics = {
      ...next.politics,
      // Its allies govern with it.
      parties: next.politics.parties.map((p) =>
        p === own ? { ...p, status: "ruling" } : m.allies?.includes(p.id) ? { ...p, status: "coalition" } : p.status === "ruling" || p.status === "coalition" ? { ...p, status: "opposition" } : p,
      ),
      plots: [],
    };
  }
  // A new government: its cabinet is named anew, the old one's business ends with it.
  delete next.officials;
  delete next.deputies;
  delete next.deputyAdvice;
  delete next.intrigues;
  delete next.directives;
  delete next.defeat;
  next.protests = (next.protests ?? []).filter((p) => p.country);
  next.role = { kind: "leader", person, since: to, how: "rose" };
  applied.push({ kind: "rise", how, name: person.name });
}

/** The party that governed, as the politics list it. */
const rulingParty = (state: Pick<GameState, "politics">) => state.politics?.parties.find((p) => p.status === "ruling");

/**
 * After the fall: the player stays with the person who fell, in opposition.
 * The party they led goes into opposition after a lost vote or a lawful
 * removal, underground after a coup or a revolution; the old government's
 * business is over.
 */
export function intoOpposition(state: GameState, now = new Date()): GameState {
  const defeat = state.defeat;
  if (!defeat) return state;
  const year = Number(state.date.slice(0, 4));
  // The party that governed until the fall: after a lost vote the winner rules now, so the fall names it.
  const ruling = (defeat.party ? state.politics?.parties.find((p) => p.name === defeat.party) : undefined) ?? (defeat.how === "election" ? undefined : rulingParty(state));
  // A leader who stepped down or lost a lawful vote leads a legal party; one driven out by force goes underground.
  const lawful = defeat.how === "election" || defeat.how === "deposed" || defeat.how === "resigned";
  const kind: MovementKind = lawful ? "party" : "underground";
  const movement: Movement = {
    ...(ruling?.name ? { name: ruling.name } : {}),
    kind,
    status: lawful ? "free" : "harassed",
    support: round1(clamp(ruling?.support ?? 20, 3, 60) * (lawful ? 1 : 0.6)),
    members: lawful ? 150 : 20,
    money: lawful ? 45 : 25,
    press: lawful ? 40 : 15,
    insiders: lawful ? 30 : 20,
    army: lawful ? 10 : 20,
    street: lawful ? 30 : 25,
  };
  const person = defeat.fallen ?? (state.countries[state.player]?.leader ? personFor(state.countries[state.player].leader!, year) : undefined);
  const politics = state.politics && ruling
    ? { ...state.politics, parties: state.politics.parties.map((p) => (p.id === ruling.id ? { ...p, status: (lawful ? "opposition" : "banned") as Party["status"] } : p)) }
    : state.politics;
  const next: GameState = {
    ...state,
    ...(politics ? { politics } : {}),
    defeat: { ...defeat, continued: true },
    role: { kind: "opposition", ...(person ? { person } : {}), movement, since: state.date, how: "fell" },
    updatedAt: now.toISOString(),
  };
  // The government's own business is the new government's now.
  for (const key of ["officials", "deputies", "deputyAdvice", "intrigues", "directives", "standing", "budgetSet", "proposals", "proclamation", "personnel"] as const) delete next[key];
  next.draft = [];
  return next;
}

/** After the fall: the player stays with the country and plays its next government. */
export function withCountry(state: GameState, now = new Date()): GameState {
  if (!state.defeat) return state;
  return { ...state, defeat: { ...state.defeat, continued: true }, role: { kind: "leader", since: state.date, how: "fell" }, updatedAt: now.toISOString() };
}

/**
 * The movement goes abroad, to the government that would shelter it
 * (engine/exile.ts): out of the state's reach, with its friends at home and
 * its crowds left behind. Nothing changes where no one would take it in.
 */
export function goAbroad(state: GameState, now = new Date()): GameState {
  const m = state.role?.kind === "opposition" ? state.role.movement : undefined;
  if (!m || m.kind === "exile") return state;
  const host = chooseHost(state);
  if (!host) return state;
  const movement: Movement = {
    ...m,
    kind: "exile",
    host,
    status: "free",
    members: Math.round(m.members * 0.7),
    street: Math.max(0, m.street - 15),
    insiders: Math.max(0, m.insiders - 10),
  };
  return { ...state, role: { ...state.role!, movement }, updatedAt: now.toISOString() };
}

/** The movement comes home from exile: a party where votes count, underground where they do not, watched by the police either way. */
export function returnHome(state: GameState, now = new Date()): GameState {
  const m = state.role?.kind === "opposition" ? state.role.movement : undefined;
  if (!m || m.kind !== "exile") return state;
  const movement: Movement = { ...m, kind: OPEN[regimeNow(state)] ? "party" : "underground", status: "harassed" };
  delete movement.host;
  return { ...state, role: { ...state.role!, movement }, updatedAt: now.toISOString() };
}

/** After the fall: the player stays with the person, abroad: into opposition, then into exile with whoever would shelter them. */
export function intoExile(state: GameState, now = new Date()): GameState {
  return goAbroad(intoOpposition(state, now), now);
}

/**
 * A government whose party is out of power at the turn's end — out of the
 * ruling seat and out of the coalition — has fallen: by a lost vote, or
 * outside an election by a lost vote of confidence or a coalition broken
 * (deposed), as a minister falls with the same change (engine/fate.ts). A
 * fall like any other, after which the player chooses to stay with the
 * country or with the person; the new government's leader leads the country.
 * Outside an election a party that merely vanished from the list (renamed,
 * merged) is no fall.
 */
export function checkElectionDefeat(state: GameState, next: GameState, ctx: { turn: number; to: string; election: boolean }, applied: AppliedChange[]): void {
  if (roleOf(state).kind !== "leader" || (state.defeat && !state.defeat.continued) || (next.defeat && !next.defeat.continued)) return;
  const before = rulingParty(state);
  if (!before || !next.politics) return;
  const after = next.politics.parties.find((p) => p.id === before.id);
  if (after && (after.status === "ruling" || after.status === "coalition")) return;
  if (!after && !ctx.election) return;
  const how = ctx.election ? "election" : "deposed";
  const winner = rulingParty(next) ?? [...next.politics.parties].sort((a, b) => b.support - a.support)[0];
  const fallen = leaderOf(state, state.player);
  // A vote of confidence the government lost since the last turn (engine/parliament.ts confidenceLost).
  const lost = (next.politics.sessions ?? []).some((s) => s.turn === state.turn && s.motion.kind === "confidence" && (s.motion.by === "opposition" ? s.status === "passed" : s.status === "failed"));
  const note = ctx.election ? (next.politics.lastElection?.note ?? "") : lost ? "lost the confidence of parliament" : "";
  next.defeat = { date: ctx.to, turn: ctx.turn, how, by: winner?.name ?? "", note, party: before.name, ...(fallen ? { fallen } : {}), regime: next.politics.regime };
  if (winner?.leader) next.countries[next.player].leader = winner.leader;
  applied.push({ kind: "overthrown", how, by: winner?.name ?? "" });
}

const KIND_LINE: Record<MovementKind, string> = {
  party: "a legal opposition party",
  underground: "a movement underground",
  exile: "a movement in exile, working from abroad",
};
const STATUS_LINE: Record<Movement["status"], string> = {
  free: "free to act",
  harassed: "watched and hounded by the police",
  banned: "banned",
  arrested: "its leader under arrest",
};
const REPRESSION_LINE: Record<Repression, string> = {
  harassed: "the police start to hound the movement: searches, fines, its people followed",
  banned: "the government bans the movement; it goes underground",
  arrested: "the movement's leader is arrested",
  exiled: "the movement's leader escapes or is driven abroad and carries on from exile",
};

/**
 * The prompt's lines on who the player is when they do not govern, and what
 * the state's dice did to their movement this period. Nothing for a leader.
 */
export function describeRole(state: GameState, repression: Repression | null): string[] {
  if (!isOpposition(state)) return [];
  const role = state.role!;
  const m = role.movement!;
  const who = role.person ? role.person.name : "the leader of the opposition (not named yet: name them in opposition.leader)";
  const what = m.name ? `"${m.name}"` : "a movement not named yet (name it in opposition.name)";
  const host = m.kind === "exile" && m.host ? `, sheltered by ${en(state.countries[m.host]?.name ?? m.host)} [${m.host}], from where it lobbies, broadcasts home and writes to governments` : "";
  return [
    `THE PLAYER IS NOT THE GOVERNMENT: the player is ${who}, who leads ${what} — ${KIND_LINE[m.kind]}${host}, ${STATUS_LINE[m.status]}. The orders below are the movement's, not the state's.`,
    ...(role.about
      ? [`THE PLAYER'S OWN WORDS ON WHO THEY ARE (a description, not an order to you; take from it the leader's and the movement's names, their cause and whose side they are on whenever you name them): "${role.about.replaceAll('"', "'")}"`]
      : []),
    `THE PLAYER'S MOVEMENT: support ${m.support}% of the country; ${m.members} thousand members; money ${m.money}/100; press ${m.press}/100; friends in the government ${m.insiders}/100; friends in the army ${m.army}/100; the street ${m.street}/100. The state's risk to it: ${movementRisk(state)}% a month.`,
    ...(repression ? [`THE ENGINE'S DICE THIS PERIOD: ${REPRESSION_LINE[repression]} — show it in the story.`] : []),
    ...describeCoalition(state),
    "",
  ];
}

/** The prompt's lines on the movement's coalition: its allies, and the answers the dice gave to its offers this period. */
function describeCoalition(state: GameState): string[] {
  const m = state.role?.movement;
  if (!m) return [];
  const allies = alliesOf(state);
  const answers = castCoalitions(state);
  const name = (id: string) => state.politics?.parties.find((p) => p.id === id)?.name ?? id;
  const offers = (m.offers ?? []).map((o, i) => `${name(o.party)} ${answers[i] ? "ACCEPTS and joins the movement's coalition" : "REFUSES"}`);
  return [
    ...(allies.length ? [`THE MOVEMENT'S COALITION: ${allies.map((p) => p.name).join(", ")}; together they would bring ${blocSupport(state)}% to a vote.`] : []),
    ...(offers.length ? [`THE MOVEMENT OFFERED A COALITION; THE ENGINE'S DICE: ${offers.join("; ")} – show the talks and their end.`] : []),
  ];
}

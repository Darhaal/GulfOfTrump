import { allied, landHolders, powers, tieOf, warBetween } from "./relations";
import { en } from "./text";
import type { GameState, RoleKind } from "./types";

/**
 * Abroad, as a person: where a fallen leader or an opposition goes into
 * exile, and the letters the player writes to governments when they do not
 * speak for their own. The host is whoever would shelter them — a rival of
 * the government at home, one at war with it, a democracy that takes in
 * dissidents, a power strong enough to protect them — never its allies, who
 * would hand them back. From abroad the movement lobbies its host, broadcasts
 * home and writes to governments: the same letters the government writes,
 * answered as a government answers an opponent of another.
 */

type HostState = Pick<GameState, "player" | "countries" | "regions" | "alliances" | "wars"> & Partial<Pick<GameState, "sanctions">>;

/** How willing each government is to shelter the player's exiles, the most willing first; ties by tag. */
export function hostScores(state: HostState): [string, number][] {
  const holders = landHolders(state);
  const power = powers(state, holders);
  const home = state.player;
  const out: [string, number][] = [];
  for (const c of Object.values(state.countries)) {
    if (c.tag === home || c.dormant || !holders.has(c.tag)) continue;
    // How the host sees the government at home: rivals take in its opponents, friends do not.
    const tie = tieOf(state, c.tag, home);
    let score = tie.tension * 0.5 - tie.trust * 0.5 + tie.near * 0.15;
    if (warBetween(state, c.tag, home)) score += 25;
    if (allied(state, c.tag, home)) score -= 40;
    if ((state.sanctions ?? []).some((s) => s.by === c.tag && s.against === home)) score += 10;
    const regime = c.domestic?.regime;
    if (regime === "democracy") score += 12;
    else if (regime === "limited") score += 5;
    score += (power.get(c.tag) ?? 0) * 30;
    out.push([c.tag, Math.round(score * 10) / 10]);
  }
  return out.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/** The government that would shelter the player's exiles now, if any would: one with more reasons to than not. */
export function chooseHost(state: HostState): string | undefined {
  const [best] = hostScores(state);
  return best && best[1] > 0 ? best[0] : undefined;
}

/** Whether the host still stands: a government with land of its own. */
export function hostStands(state: Pick<GameState, "regions" | "countries">, host: string | undefined): boolean {
  return Boolean(host && state.countries[host] && !state.countries[host].dormant && Object.values(state.regions).some((r) => r.owner === host));
}

/**
 * Whether the player can write to governments: the leader for the
 * government, the opposition for its movement (at home or abroad), and the
 * foreign minister for the ministry.
 */
export function canWriteLetters(state: Pick<GameState, "role">): boolean {
  const role = state.role;
  return !role || role.kind === "leader" || role.kind === "opposition" || (role.kind === "minister" && role.post === "foreign");
}

/** The role a letter is written in, kept on the message when it is not the government's. */
export const letterRole = (state: Pick<GameState, "role">): RoleKind | undefined => (state.role && state.role.kind !== "leader" ? state.role.kind : undefined);

/** Who signs the player's letters, in English: the country for its government, else the person and what they lead. */
export function senderLabel(state: Pick<GameState, "role" | "countries" | "player">, as: RoleKind | undefined = letterRole(state)): string {
  const country = en(state.countries[state.player]?.name ?? state.player);
  if (!as || as === "leader") return country;
  const role = state.role;
  const who = role?.person?.name;
  if (as === "opposition") {
    const movement = role?.movement?.name;
    return `${who ?? "the leader of the opposition"}${movement ? ` (${movement})` : ""}, opposition to the government of ${country}`;
  }
  return `${who ?? "a minister"}, foreign minister of ${country}`;
}

/** The lines that tell a government answering a letter who wrote it, when it is not the player's government. */
export function describeSender(state: Pick<GameState, "role" | "countries" | "player">): string[] {
  const role = state.role;
  const as = letterRole(state);
  if (!as || !role) return [];
  const country = en(state.countries[state.player]?.name ?? state.player);
  if (as === "opposition") {
    const host = role.movement?.kind === "exile" && role.movement.host ? en(state.countries[role.movement.host]?.name ?? role.movement.host) : undefined;
    return [
      `THE LETTER IS NOT FROM THE GOVERNMENT: it comes from ${senderLabel(state, as)}${host ? `, in exile in ${host}` : ""}. Answer as your government would answer an opponent of the government in power in ${country}: weigh what backing them gains you and what it costs you with that government; promises to them are not treaties with ${country}.`,
    ];
  }
  return [`THE LETTER COMES FROM ${senderLabel(state, as)}, writing as the ministry, not as the head of the government: an agreement needs the government's word.`];
}

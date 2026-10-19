import { isHexColor } from "./colors";
import { en } from "./text";
import { reactionLine } from "./acts";
import type { AppliedChange, GameState, Localized, Proclamation, Reaction } from "./types";

/**
 * The player's government proclaims what its state is called, the colour
 * it wears on the map and what its cities are called. A proclamation waits
 * until the turn ends, then takes effect — it is the government's own
 * decision — and the game master is told, so the people, the neighbours
 * and the UN can take it well or badly.
 */

const NAME = 80;

/** A name in each language, trimmed; empty languages keep the old one. */
function name(next: Partial<Localized>, old: Localized): Localized | null {
  const out = {
    ru: next.ru?.trim().slice(0, NAME) || old.ru,
    uk: next.uk?.trim().slice(0, NAME) || old.uk,
    en: next.en?.trim().slice(0, NAME) || old.en,
  };
  return out.ru === old.ru && out.uk === old.uk && out.en === old.en ? null : out;
}

const asLocalized = (t: GameState["countries"][string]["name"]): Localized => (typeof t === "string" ? { ru: t, uk: t, en: t } : t);

/** Sets (or clears, with an empty object) what the player will proclaim this turn. */
export function proclaim(
  state: GameState,
  change: { name?: Partial<Localized> | null; color?: string | null; place?: { key: string; name: Partial<Localized> | null } },
  now = new Date(),
  reaction?: Reaction,
): GameState {
  const current = state.proclamation ?? {};
  const next: Proclamation = { ...current };
  const country = state.countries[state.player];
  if (!country) return state;
  if (change.name !== undefined) {
    const n = change.name ? name(change.name, asLocalized(country.name)) : null;
    if (n) next.name = n;
    else delete next.name;
  }
  if (change.color !== undefined) {
    if (change.color && isHexColor(change.color) && change.color.toLowerCase() !== country.color.toLowerCase()) next.color = change.color.toLowerCase();
    else delete next.color;
  }
  if (change.place) {
    const places = { ...(next.places ?? {}) };
    const old = state.placeNames?.[change.place.key] ?? { ru: change.place.key, uk: change.place.key, en: change.place.key };
    const n = change.place.name ? name(change.place.name, old) : null;
    if (n) places[change.place.key] = n;
    else delete places[change.place.key];
    if (Object.keys(places).length) next.places = places;
    else delete next.places;
  }
  // The expected reaction travels with the part it belongs to.
  const part = change.name !== undefined ? "name" : change.color !== undefined ? "color" : change.place ? `place:${change.place.key}` : "";
  const reactions = { ...(next.reactions ?? {}) };
  const kept = part === "name" ? next.name : part === "color" ? next.color : change.place ? next.places?.[change.place.key] : undefined;
  if (part && kept && reaction) reactions[part] = reaction;
  else if (part) delete reactions[part];
  if (Object.keys(reactions).length) next.reactions = reactions;
  else delete next.reactions;
  const proclamation = Object.keys(next).filter((k) => k !== "reactions").length ? next : undefined;
  const out: GameState = { ...state, updatedAt: now.toISOString() };
  if (proclamation) out.proclamation = proclamation;
  else delete out.proclamation;
  return out;
}

/** At the end of the turn the proclamation takes effect; each part goes into the chronicle. */
export function applyProclamation(next: GameState, p: Proclamation | undefined, applied: AppliedChange[]): void {
  if (!p) return;
  const country = next.countries[next.player];
  if (country) {
    if (p.name) {
      applied.push({ kind: "identity", what: "name", from: en(country.name), to: p.name });
      country.name = p.name;
    }
    if (p.color && isHexColor(p.color)) {
      applied.push({ kind: "identity", what: "color", from: country.color, to: p.color });
      country.color = p.color;
      country.customColor = true;
    }
  }
  for (const [key, n] of Object.entries(p.places ?? {})) {
    applied.push({ kind: "identity", what: "place", from: key, to: n });
    next.placeNames = { ...(next.placeNames ?? {}), [key]: n };
  }
  // How the country takes it: unrest moves by the reactions, within reason.
  const delta = Object.values(p.reactions ?? {}).reduce((s, r) => s + r.unrest, 0);
  if (delta && next.politics) next.politics = { ...next.politics, unrest: Math.max(0, Math.min(100, Math.round(next.politics.unrest + Math.max(-10, Math.min(25, delta))))) };
  delete next.proclamation;
}

/** The proclamation and the places renamed so far, for the game master. */
export function describeIdentity(state: GameState): string[] {
  const p = state.proclamation;
  const lines: string[] = [];
  if (p) {
    const r = p.reactions ?? {};
    const parts = [
      p.name && reactionLine(`the country is renamed "${p.name.en}" (in Russian "${p.name.ru}", in Ukrainian "${p.name.uk}"; was "${en(state.countries[state.player]?.name)}")`, r.name),
      p.color && reactionLine(`it takes a new colour on maps and in international bodies (${p.color})`, r.color),
      ...Object.entries(p.places ?? {}).map(([key, n]) => reactionLine(`the city of ${state.placeNames?.[key]?.en ?? key} is renamed "${n.en}"`, r[`place:${key}`])),
    ].filter(Boolean);
    lines.push("", `PROCLAMATIONS OF THE PLAYER'S GOVERNMENT THIS TURN (they take effect; show how the people, the neighbours and the UN take them): ${parts.join("; ")}.`);
  }
  const renamed = Object.entries(state.placeNames ?? {});
  if (renamed.length) lines.push(`Places renamed in play: ${renamed.map(([key, n]) => `${key} → ${n.en}`).join(", ")}.`);
  return lines;
}

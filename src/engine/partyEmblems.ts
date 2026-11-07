import { campOf } from "./partyLife";
import type { GameState, OpinionCamp, Party } from "./types";

/**
 * The painted emblems a party wears in the interface beside its leader's
 * portrait, by name (the interface draws each, components/game/politics/oil.tsx):
 * each party gets the one of the camp its ideas stand nearest, and the
 * player's own party – the ruling one, or the movement's – may wear another.
 * The choice is the interface's own: the game master never reads it.
 */
export const PARTY_EMBLEM_KEYS = [
  // The signs of the great movements and faiths first (components/game/politics/emblems.tsx draws those lucide lacks).
  "hammer-sickle", "star", "fist", "rose", "anarchy", "cog", "wheat", "tractor", "torch", "scale", "dove", "olive",
  "eagle", "eagle-double", "crown", "landmark", "castle", "flag", "fasces", "bolt", "skull", "swords", "shield",
  "cross", "orthodox-cross", "crescent", "star-david", "church", "leaf", "sprout", "tree", "sun", "sunrise",
  "heart", "handshake", "people", "book", "lightbulb", "factory", "hammer", "anchor", "mountain", "globe", "gem", "key", "feather",
] as const;
export type PartyEmblemKey = (typeof PARTY_EMBLEM_KEYS)[number];

/** Each camp of opinion's usual emblem. */
const CAMP_EMBLEM: Record<OpinionCamp, PartyEmblemKey> = {
  communist: "hammer-sickle",
  socialist: "rose",
  agrarian: "wheat",
  liberal: "torch",
  conservative: "landmark",
  nationalist: "eagle",
  religious: "cross",
  green: "leaf",
};

/**
 * The movements a party's own words name – its ideology and its name, in the three languages – and their signs,
 * tried in this order (a national socialist is a nationalist first, a social democrat a socialist).
 * Cyrillic has no word boundaries in JavaScript: "international" is kept out by hand.
 */
const NAMED: [RegExp, PartyEmblemKey][] = [
  [/коммун|комуніст|communis|bolshevi|большеви|більшови/i, "hammer-sickle"],
  [/анарх|anarch/i, "anarchy"],
  [/фаши|фашис|fascis/i, "fasces"],
  [/монарх|monarch|royalis|роялис|рояліс/i, "crown"],
  [/(?<!интер)национал|(?<!інтер)націонал|\bnationalis/i, "eagle"],
  [/ислам|іслам|islam|muslim|мусульм/i, "crescent"],
  [/сионис|сіоніс|zionis|еврей|єврей|jewish/i, "star-david"],
  [/православ|orthodox/i, "orthodox-cross"],
  [/христиан|християн|christian|catholic|католи/i, "cross"],
  [/зелён|зелен|эколог|еколог|\bgreen|ecolog/i, "leaf"],
  [/аграр|крестьян|селян|agrarian|peasant|farmer/i, "wheat"],
  [/социал|соціал|\bsocial|labou?r|лейбор|рабоч|робітн/i, "rose"],
  [/либерал|ліберал|liberal|libertarian|либертари|лібертарі/i, "torch"],
  [/консерват|conservativ/i, "landmark"],
  [/популис|популіс|populis/i, "people"],
  [/центрис|центрист|centris/i, "handshake"],
];

/** The emblem a party wears unless the player chose one: the sign its own words name, else its camp's. */
function usualEmblem(party: Pick<Party, "stance"> & Partial<Pick<Party, "ideology" | "name">>): PartyEmblemKey {
  const words = `${party.ideology ?? ""} ${party.name ?? ""}`;
  return NAMED.find(([re]) => re.test(words))?.[1] ?? CAMP_EMBLEM[campOf(party.stance)];
}

type EmblemParty = Pick<Party, "id" | "stance"> & Partial<Pick<Party, "ideology" | "name">>;

/** The emblem a party wears: the player's choice for it, else the usual one. */
export function partyEmblem(state: Pick<GameState, "partyEmblems">, party: EmblemParty): PartyEmblemKey {
  return state.partyEmblems?.[party.id] ?? usualEmblem(party);
}

/** The state with a party's emblem changed; back to its usual one, nothing is kept. */
export function setPartyEmblem(state: GameState, party: EmblemParty, emblem: PartyEmblemKey): GameState {
  const emblems = { ...(state.partyEmblems ?? {}) };
  if (emblem === usualEmblem(party)) delete emblems[party.id];
  else emblems[party.id] = emblem;
  const next: GameState = { ...state, partyEmblems: emblems };
  if (!Object.keys(emblems).length) delete next.partyEmblems;
  return next;
}

/** The longest picture kept for a party, as a data URL: a small painting, never a photograph's full file. */
export const PARTY_IMAGE_CHARS = 90_000;
const IMAGE_URL = /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/;

/** A picture the player painted for a party (components/game/politics/paintPhoto.ts), when it is one the save may keep. */
export const validPartyImage = (url: string) => url.length <= PARTY_IMAGE_CHARS && IMAGE_URL.test(url);

/** The state with a party's own picture set, or taken away with null. */
export function setPartyImage(state: GameState, partyId: string, url: string | null): GameState {
  const images = { ...(state.partyImages ?? {}) };
  if (url && validPartyImage(url)) images[partyId] = url;
  else delete images[partyId];
  const next: GameState = { ...state, partyImages: images };
  if (!Object.keys(images).length) delete next.partyImages;
  return next;
}

/** The colours offered for the player's party: the press's usual ones, from red round to black. */
export const PARTY_COLOUR_PRESETS = [
  "#c62828", "#8e1b1b", "#e8772e", "#e3b505", "#2e8b3e", "#1f5e3b", "#1aa3a3",
  "#4a90d9", "#1f4e9b", "#1b2a5e", "#6a3d9a", "#b0457a", "#7a4a2a", "#2b2b2b",
] as const;

const HEX = /^#[0-9a-f]{6}$/i;
/** A colour the save may keep for a party: #rrggbb. */
export const validPartyColour = (hex: string) => HEX.test(hex);

/** The state with a party's colour set by the player, or given back to the press's with null. */
export function setPartyColour(state: GameState, partyId: string, hex: string | null): GameState {
  const colours = { ...(state.partyColours ?? {}) };
  if (hex && validPartyColour(hex)) colours[partyId] = hex.toLowerCase();
  else delete colours[partyId];
  const next: GameState = { ...state, partyColours: colours };
  if (!Object.keys(colours).length) delete next.partyColours;
  return next;
}

/** The parties with the colours the player chose for them in place of the press's. */
export function withPartyColours<P extends Pick<Party, "id" | "color">>(state: Pick<GameState, "partyColours">, parties: P[]): P[] {
  const chosen = state.partyColours;
  return chosen ? parties.map((p) => (chosen[p.id] ? { ...p, color: chosen[p.id] } : p)) : parties;
}

/** The keys a person's own picture is kept under: their id and their name, so every portrait of them finds it. */
export const portraitKeys = (person: { id?: string; name: string }) => [...(person.id ? [person.id] : []), `name:${person.name}`];

/** The state with a person's own picture set (painted in oil, components/game/politics/paintPhoto.ts), or taken away with null. */
export function setPortraitImage(state: GameState, person: { id?: string; name: string }, url: string | null): GameState {
  const images = { ...(state.portraitImages ?? {}) };
  for (const key of portraitKeys(person)) {
    if (url && validPartyImage(url)) images[key] = url;
    else delete images[key];
  }
  const next: GameState = { ...state, portraitImages: images };
  if (!Object.keys(images).length) delete next.portraitImages;
  return next;
}

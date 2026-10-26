import { divisionsOf, maxDivisions, menOf } from "./army";
import { arsenalLine, enemiesOf } from "./arsenal";
import { yearOf } from "./calendar";
import { describeFigureSetup } from "./figures";
import { peopleIn } from "./population";
import { LANGUAGE } from "./prompts";
import { en } from "./text";
import type { GameState, Locale, MapIndex } from "./types";

/** The provinces the answer may name: the front first, then the most populous of the player's own. */
const MAX_PROVINCES = 120;

/**
 * Asking the game master how the player's army is organised now: its
 * armies, fleets and air forces, their divisions and where they stand. The
 * engine checks the answer (engine/army.ts sanitizeArmyOrganisation).
 */
export const ARMY_INSTRUCTIONS = (locale: Locale) => `You describe how the player's armed forces are organised right now in Gulf of Trump, an alternate-history grand strategy game. The message gives the country, the date, its soldiers by training, its weapons, its wars and fronts, and the provinces you may name.
- Name the formations as that country's forces were organised on that date: army groups, fronts, armies and corps on land, with their divisions (or brigades counted as division equivalents); the fleets; the air forces. Use the names, numbering and commanders of that army and date where history gives them for this situation, and plausible ones where it does not; a commander only when you are sure.
- Put the strength where the fighting and the threats are: most divisions on the fronts given, the rest in reserve, on quiet borders, guarding the capital or in occupied land.
- "divisions": whole numbers of divisions or division equivalents. All formations together should come to about the field strength given, never more than the most given. A fleet or an air force may have 0.
- "provinces": where the formation stands, by the ids given in PROVINCES YOU MAY NAME, at most eight each; leave it empty for a fleet at sea.
- "theatre": the front or region in a few words; "note": one short sentence on its state or task.
- Write names, theatres and notes in ${LANGUAGE[locale]}. Never mention ids, tags or game mechanics outside "provinces". Short dashes only (–).
- At most 12 formations.
Answer with ONE JSON object and nothing else:
{ "formations": [{ "name": "string", "kind": "front|army|corps|fleet|air|reserve", "divisions": 0, "commander": "string", "theatre": "string", "provinces": ["id"], "note": "string" }] }`;

/** The message for the army's organisation: what the player's government has to fight with, and where. */
export function buildArmyPrompt(state: GameState, index: Pick<MapIndex, "regions" | "neighbors">): string {
  const tag = state.player;
  const c = state.countries[tag];
  const year = yearOf(state.date);
  const troops = c?.economy?.troops ?? 0;
  const men = menOf(state, c);
  const field = divisionsOf(troops, year);
  const lines: string[] = [
    `COUNTRY: ${en(c?.name) || tag} [${tag}], ${c?.government ? en(c.government) : ""}`.trim(),
    `DATE: ${state.date}`,
    `SOLDIERS: ${troops} thousand – ${Math.round(men.pro)} career, ${Math.round(men.trained)} trained conscripts, ${Math.round(men.recruits)} recruits still in training`,
    `FIELD STRENGTH: about ${field} divisions or division equivalents; at most ${maxDivisions(troops, year)}`,
    `WEAPONS: ${arsenalLine(c?.arsenal) || "none recorded"}`,
    // The player's general commands a formation of their own: the answer names them its commander (engine/figures.ts).
    ...(state.role?.kind === "general" ? describeFigureSetup(state).map((l) => `${l} Name them the commander of that formation.`) : []),
  ];

  const enemies = enemiesOf(state).get(tag) ?? new Set<string>();
  const wars = state.wars.filter((w) => !w.truce && (w.attackers.includes(tag) || w.defenders.includes(tag)));
  const front = new Set<string>();
  if (wars.length) {
    lines.push("", "WARS:");
    for (const w of wars) {
      const theirs = w.attackers.includes(tag) ? w.defenders : w.attackers;
      lines.push(`- ${en(w.name)}: against ${theirs.map((t) => en(state.countries[t]?.name) || t).join(", ")}`);
    }
  }
  // The front: provinces fought over with an enemy, and the player's own that border the enemy's.
  for (const [id, r] of Object.entries(state.regions)) {
    const fought = r.contested && ((r.contested === tag && enemies.has(r.controller)) || (r.controller === tag && enemies.has(r.contested)));
    const facing = r.controller === tag && (index.neighbors[id] ?? []).some((n) => enemies.has(state.regions[n]?.controller ?? ""));
    if (fought || facing) front.add(id);
  }
  if (front.size) {
    lines.push("", "FRONT PROVINCES (id: name – who holds it):");
    for (const id of [...front].slice(0, 60)) {
      const r = state.regions[id];
      const holder = en(state.countries[r.controller]?.name) || r.controller;
      const contest = r.contested ? `, ${en(state.countries[r.contested]?.name) || r.contested} holds ${r.held ?? 33}%` : "";
      lines.push(`- ${id}: ${index.regions[id]?.name ?? id} – ${holder}${contest}`);
    }
  }

  const own = Object.entries(state.regions)
    .filter(([id, r]) => !front.has(id) && (r.controller === tag || r.owner === tag))
    .sort(([a, ra], [b, rb]) => peopleIn(rb, index.regions[b]) - peopleIn(ra, index.regions[a]))
    .slice(0, Math.max(0, MAX_PROVINCES - Math.min(60, front.size)));
  lines.push("", "PROVINCES YOU MAY NAME (id: name) – the front provinces above and these:");
  for (const [id] of own) lines.push(`- ${id}: ${index.regions[id]?.name ?? id}`);
  return lines.join("\n");
}

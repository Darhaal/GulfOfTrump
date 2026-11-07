import { z } from "zod";
import { newDomestic } from "./abroad";
import { countryColor, isHexColor } from "./colors";
import { roll } from "./dice";
import { raisedArmy } from "./economy";
import { peopleIn } from "./population";
import { addTension, allied, remember, tieOf, warBetween } from "./relations";
import { en, slug } from "./text";
import { regimeOf } from "./warMeans";
import { dissolve, holdingLand, leaveWar } from "./warEnd";
import type { AppliedChange, Because, Client, CountryState, GameState, Localized, RegimeKind, Text } from "./types";

/**
 * Provisional and puppet governments. An occupier sets up a government of a
 * country's own people in land it has taken: the "Finnish Democratic
 * Republic" of 1939, the governments installed in occupied countries, the
 * provisional governments after a collapse.
 *
 * - The player does it by order: the game master proposes it in
 *   `provisional` and the engine checks that the player has taken the
 *   country or most of it. Governments abroad do it now and then when a
 *   country capitulates to them (engine/warEnd.ts), a party state most often.
 * - A country whose old government is gone (dissolved, or with no land and no
 *   war) is brought back under the new government; one whose old government
 *   still holds land or fights on in exile gets a new government beside it,
 *   which joins its patron's side of their war.
 * - It is tied to its patron by a treaty; the land it takes passes to it at
 *   once or a share a turn.
 * - How far its people accept it (0–100) moves resistance in its land: an
 *   accepted government calms it, a puppet stirs it (engine/warMeans.ts).
 *   Its patron's allies recognise it, its rivals refuse, and the refusal
 *   costs the patron their trust – the road to sanctions.
 * - The player can grant it independence or annex it, by order.
 * - Its army is raised from the land it gets: the era's soldiers for its
 *   people and the era's army budget, with what is left of the old
 *   government's weapons – never the old government's whole army.
 *
 * Pure and deterministic.
 */

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const YEAR_MS = 365.25 * 86400000;
const yearsBetween = (from: string, to: string) => Math.max(0, (Date.parse(to) - Date.parse(from)) / YEAR_MS);

const shortText = z.string().trim().max(300);
const tag = z.string().trim().min(1).max(80);

/** A government the player's orders set up (merged into OutcomeSchema as `provisional`). */
export const provisionalField = z
  .array(
    z.object({
      // The country taken: its tag.
      country: tag,
      name: shortText.optional(),
      leader: shortText.optional(),
      government: shortText.optional(),
      // The land passes at once, or a share a turn.
      land: z.enum(["now", "gradual"]).catch("gradual").default("gradual"),
      color: z.string().optional(),
    }),
  )
  .max(2)
  .default([]);

/** What the player's orders do with one of its client governments (merged into OutcomeSchema as `clients`). */
export const clientsField = z
  .array(z.object({ country: tag, action: z.enum(["independence", "annex"]) }))
  .max(4)
  .default([]);

export type ProvisionalEntry = { country: string; name?: string; leader?: string; government?: string; land: "now" | "gradual"; color?: string };
export type ClientAction = { country: string; action: "independence" | "annex" };

/** The share of a country the occupier must hold, unless its government holds nothing at all. */
const TAKEN = 0.5;
/** Half-life of the land still to pass, years: most of it in about three months. */
const PASS_HALF = 0.15;
/** Half-life of acceptance moving to where its causes put it, years. */
const ACCEPT_HALF = 0.5;
/** How often a government abroad sets up a provisional government when a country capitulates to it, by its kind of government. */
const INSTALL: Record<RegimeKind, number> = { party: 0.45, autocracy: 0.3, military: 0.3, limited: 0.15, democracy: 0.1 };

const GOVERNMENT: Localized = { ru: "Временное правительство", uk: "Тимчасовий уряд", en: "Provisional government" };

/** Each country's land taken from it, by the regions it owns under another's hand, its people's resistance and the chronicle's record: one pass for many questions. */
export function takenIndex(state: Pick<GameState, "regions" | "chronicle">): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const add = (country: string, id: string) => {
    let s = out.get(country);
    if (!s) out.set(country, (s = new Set()));
    s.add(id);
  };
  for (const [id, r] of Object.entries(state.regions)) {
    if (r.controller !== r.owner) add(r.owner, id);
    if (r.resistance && r.resistance.of !== r.controller) add(r.resistance.of, id);
  }
  for (const e of state.chronicle) for (const c of e.applied) if ((c.kind === "annex" || c.kind === "occupy") && c.from !== c.to) add(c.from, c.region);
  return out;
}

/** The provinces that were a country's and are now held by another: occupied, or taken from it in play and still held. */
export function takenLand(state: Pick<GameState, "regions" | "chronicle">, country: string, holder: string, index = takenIndex(state)): string[] {
  const out: string[] = [];
  for (const id of index.get(country) ?? []) {
    const r = state.regions[id];
    if (!r || r.controller !== holder || r.contested) continue;
    if (r.owner === country || r.owner === holder || r.resistance?.of === country) out.push(id);
  }
  return out.sort();
}

/** Whether a country's old government is gone: dissolved, or with no land and no war to carry on. */
function goneGovernment(state: GameState, country: string, holders: Set<string>): boolean {
  const c = state.countries[country];
  if (!c) return true;
  if (c.dormant) return true;
  if (holders.has(country)) return false;
  return !state.wars.some((w) => w.attackers.includes(country) || w.defenders.includes(country));
}

/** Whether `patron` may set up a government in `country` now: what passes to it, and whether the country itself is brought back. */
export function provisionalChance(
  state: GameState,
  patron: string,
  country: string,
  index = takenIndex(state),
  holders = holdingLand(state),
): { land: string[]; revive: boolean } | null {
  const c = state.countries[country];
  if (!c || country === patron || country === state.player || c.client) return null;
  if (!index.has(country)) return null;
  // A government the patron already set up for that country's people.
  if (Object.values(state.countries).some((x) => x.client?.patron === patron && x.client.of === country && !x.dormant)) return null;
  const land = takenLand(state, country, patron, index);
  if (!land.length) return null;
  const revive = goneGovernment(state, country, holders);
  if (!revive && holders.has(country)) {
    let owns = 0;
    let held = 0;
    for (const r of Object.values(state.regions)) {
      if (r.owner !== country) continue;
      owns += 1;
      if (r.controller === patron) held += 1;
    }
    if (!owns || held / owns < TAKEN) return null;
  }
  return { land, revive };
}

/** The governments abroad that recognise a client government, and those that refuse: its patron's friends and its rivals. */
export function recognition(state: GameState, client: string): { recognised: string[]; refused: string[] } {
  const c = state.countries[client];
  const patron = c?.client?.patron;
  if (!c || !patron) return { recognised: [], refused: [] };
  const holders = holdingLand(state);
  const old = c.client?.of;
  const recognised: string[] = [];
  const refused: string[] = [];
  // A treaty between a few, not a convention of many (the Montreux Convention binds no one to anyone's governments).
  const close = (a: string, b: string) => state.alliances.some((x) => x.members.length <= 3 && x.members.includes(a) && x.members.includes(b) && (x.kind ?? "alliance") !== "organization");
  for (const o of Object.values(state.countries).sort((a, b) => a.tag.localeCompare(b.tag))) {
    if (o.tag === client || o.tag === patron || o.dormant || o.exile || !holders.has(o.tag)) continue;
    if (warBetween(state, o.tag, patron) || warBetween(state, o.tag, client) || (old && (o.tag === old || allied(state, o.tag, old)))) refused.push(o.tag);
    else if (allied(state, o.tag, patron) || close(o.tag, patron)) recognised.push(o.tag);
    else if (o.course) {
      const tie = tieOf(state, o.tag, patron);
      if (tie.trust >= 50 && tie.tension < 30) recognised.push(o.tag);
      else if (tie.trust <= 0 || tie.tension >= 30) refused.push(o.tag);
    }
  }
  return { recognised, refused };
}

/**
 * Where its people's acceptance of a client government heads, 0–100: a
 * government of their own whose rival still fights on, set up by a
 * dictatorship, is a puppet; one that came after the old government fell,
 * recognised abroad and given time, is accepted.
 */
export function acceptanceTarget(state: GameState, tag: string, to = state.date): number {
  const c = state.countries[tag];
  const client = c?.client;
  if (!client) return 50;
  let t = 45;
  const old = client.of;
  if (old && state.countries[old] && !state.countries[old].dormant && state.wars.some((w) => w.attackers.includes(old) || w.defenders.includes(old))) t -= 25;
  else t += 10;
  const regime = regimeOf(state, client.patron);
  if (regime === "party" || regime === "autocracy" || regime === "military") t -= 10;
  else if (regime === "democracy") t += 5;
  const voices = client.recognised.length + client.refused.length;
  if (voices) t += (20 * (client.recognised.length - client.refused.length)) / voices;
  t += Math.min(15, 5 * yearsBetween(client.since, to));
  let levels = 0;
  let n = 0;
  for (const r of Object.values(state.regions)) {
    if (r.controller !== tag || !r.resistance) continue;
    levels += r.resistance.level;
    n += 1;
  }
  if (n) t -= levels / n / 4;
  return clamp(Math.round(t), 5, 95);
}

/** A tag for a new government: from its name, else from the country, never one already taken. */
function newTag(state: GameState, name: string | undefined, country: string): string {
  const base = (name && slug(name)) || `${country}-provisional`;
  let t = base;
  for (let i = 2; state.countries[t]; i++) t = `${base}-${i}`;
  return t;
}

/** The treaty that ties a client government to its patron. */
function treatyName(state: GameState, patron: string, client: string): Localized {
  const n = (t: string, l: keyof Localized) => {
    const name = state.countries[t]?.name;
    return typeof name === "string" ? name : (name?.[l] ?? t);
  };
  return {
    ru: `Договор о дружбе и взаимопомощи (${n(patron, "ru")} – ${n(client, "ru")})`,
    uk: `Договір про дружбу і взаємодопомогу (${n(patron, "uk")} – ${n(client, "uk")})`,
    en: `Treaty of Friendship and Mutual Assistance (${n(patron, "en")} – ${n(client, "en")})`,
  };
}

/** The kind of government a client of a patron has: a party state's is a party state, a democracy's a limited one. */
const clientRegime = (patron: RegimeKind): RegimeKind => (patron === "democracy" ? "limited" : patron);

/**
 * A client government's army, raised from the land it gets: the era's soldiers for its people and army budget for its
 * output; of the old government's weapons, what is left of them for so many soldiers, and its men split afresh. Without
 * people on record (a turn the map has not moved them yet) its soldiers stay as they are. Mutates `c`.
 */
function raiseArmy(next: GameState, c: CountryState, land: readonly string[]): void {
  const e = c.economy;
  if (!e) return;
  const people = land.reduce((sum, id) => sum + peopleIn(next.regions[id], undefined), 0);
  if (people <= 0) return;
  const raised = raisedArmy(people, e.gdp, next.scenarioId);
  const k = e.troops > 0 ? Math.min(1, raised.troops / e.troops) : 1;
  c.economy = { ...e, troops: raised.troops, budget: { ...e.budget, army: raised.army } };
  if (c.arsenal) {
    const stock: typeof c.arsenal.stock = {};
    for (const [kind, st] of Object.entries(c.arsenal.stock)) {
      if (!st) continue;
      const n = Math.round(st.n * k * 10) / 10;
      stock[kind as keyof typeof stock] = st.types ? { ...st, n, types: Object.fromEntries(Object.entries(st.types).map(([t, v]) => [t, Math.round((v ?? 0) * k)])) } : { ...st, n };
    }
    const arsenal = { ...c.arsenal, stock };
    delete arsenal.men;
    c.arsenal = arsenal;
  }
}

/** Land passes from the patron to its client government. */
function pass(next: GameState, ids: string[], patron: string, client: string, applied: AppliedChange[]): string[] {
  const passed: string[] = [];
  for (const id of ids) {
    const r = next.regions[id];
    if (!r || r.controller !== patron || r.contested) continue;
    applied.push({ kind: "annex", region: id, from: r.owner, to: client });
    r.owner = client;
    r.controller = client;
    delete r.behind;
    if (next.countries[client]?.dormant) delete next.countries[client].dormant;
    passed.push(id);
  }
  return passed;
}

/**
 * Sets up a government in a country `by` has taken, if the engine allows it:
 * the country brought back or a new one beside it, its name, leader and
 * colour, politics like its patron's, a treaty with the patron, and the land
 * passing to it. Returns its tag, or null when the conditions do not hold.
 */
export function setUpProvisional(next: GameState, entry: ProvisionalEntry & { by: string }, ctx: { turn: number; to: string }, applied: AppliedChange[]): string | null {
  const chance = provisionalChance(next, entry.by, entry.country);
  if (!chance) return null;
  const patron = entry.by;
  const old = next.countries[entry.country];
  const tag = chance.revive ? entry.country : newTag(next, entry.name, entry.country);
  const name: Text = entry.name ?? (chance.revive ? old.name : { ru: `${tr(old.name, "ru")} (временное правительство)`, uk: `${tr(old.name, "uk")} (тимчасовий уряд)`, en: `${en(old.name)} (provisional government)` });
  const government: Text = entry.government ?? GOVERNMENT;
  const color = isHexColor(entry.color) ? entry.color : chance.revive ? old.color : countryColor(tag);
  const was: CountryState | undefined = chance.revive ? old : undefined;
  const country: CountryState = {
    ...(was ?? {}),
    tag,
    name,
    color,
    government,
    ...(entry.leader ? { leader: entry.leader } : {}),
  };
  if (!entry.leader) delete country.leader;
  delete country.dormant;
  delete country.exile;
  delete country.rulers;
  // The old government's aims and quarrels are not the new one's: its course is set afresh when it comes to matter (engine/relations.ts).
  delete country.course;
  delete country.programmes;
  country.domestic = newDomestic({ tag, government: { ru: "", uk: "", en: "" } }, next.scenarioId, ctx.to, clientRegime(regimeOf(next, patron)));
  // A government brought back raises its army from the land it gets, not from the old one's (a new one starts from its land, engine/economy.ts seedEconomies).
  if (chance.revive) raiseArmy(next, country, chance.land);
  next.countries[tag] = country;

  // The treaty with its patron.
  const bloc = `a${ctx.turn}-pg-${tag}`;
  next.alliances.push({ id: bloc, name: treatyName(next, patron, tag), members: [patron, tag], since: ctx.to, kind: "alliance", founder: patron, terms: { ru: "Взаимная помощь и согласование внешней политики", uk: "Взаємна допомога й узгодження зовнішньої політики", en: "Mutual assistance and a common foreign policy" } });

  const client: Client = { patron, since: ctx.to, ...(chance.revive ? {} : { of: entry.country }), land: [], accepted: 0, recognised: [], refused: [], bloc };
  country.client = client;
  applied.push({ kind: "provisional", country: tag, patron, ...(chance.revive ? {} : { of: entry.country }), change: "set-up" });
  if (entry.land === "now") pass(next, chance.land, patron, tag, applied);
  else {
    // A first share at once; the rest a share a turn.
    const first = Math.max(1, Math.ceil(chance.land.length / 4));
    const passed = pass(next, chance.land.slice(0, first), patron, tag, applied);
    client.land = chance.land.filter((id) => !passed.includes(id));
  }

  // Beside an old government that fights on, it joins its patron's side of their war.
  if (!chance.revive) {
    for (const w of next.wars) {
      const side = w.attackers.includes(patron) ? "attackers" : w.defenders.includes(patron) ? "defenders" : null;
      const other = side === "attackers" ? w.defenders : w.attackers;
      if (!side || !other.includes(entry.country) || w[side].includes(tag)) continue;
      w[side].push(tag);
      applied.push({ kind: "enter", war: w.id, name: w.name, country: tag, side });
    }
  }

  // Recognition abroad, and what the refusal costs the patron.
  const r = recognition(next, tag);
  client.recognised = r.recognised;
  client.refused = r.refused;
  client.accepted = acceptanceTarget(next, tag, ctx.to);
  for (const o of r.refused) {
    addTension(next, o, patron, 10);
    remember(next, o, patron, "provoked", client.accepted < 35 ? -12 : -6, ctx.to);
  }
  return tag;
}

/** A country's name in one language. */
function tr(name: Text, locale: keyof Localized): string {
  return typeof name === "string" ? name : (name[locale] ?? name.en);
}

/** Checks the player's requests: a government in a country it may set one up in, one per country; what it does with its own client governments. */
export function sanitizeProvisional(state: GameState, raw: z.infer<typeof provisionalField>): { entries: ProvisionalEntry[]; dropped: number } {
  const entries: ProvisionalEntry[] = [];
  let dropped = 0;
  for (const p of raw) {
    if (entries.some((e) => e.country === p.country) || !provisionalChance(state, state.player, p.country)) {
      dropped += 1;
      continue;
    }
    entries.push({ country: p.country, land: p.land, ...(p.name ? { name: p.name } : {}), ...(p.leader ? { leader: p.leader } : {}), ...(p.government ? { government: p.government } : {}), ...(p.color ? { color: p.color } : {}) });
  }
  return { entries, dropped };
}

export function sanitizeClients(state: GameState, raw: z.infer<typeof clientsField>): { actions: ClientAction[]; dropped: number } {
  const actions: ClientAction[] = [];
  let dropped = 0;
  for (const a of raw) {
    if (state.countries[a.country]?.client?.patron !== state.player || actions.some((x) => x.country === a.country)) {
      dropped += 1;
      continue;
    }
    actions.push(a);
  }
  return { actions, dropped };
}

/** The player grants a client government independence – the land still to pass goes at once – or annexes it. */
export function applyClientActions(next: GameState, actions: ClientAction[], ctx: { turn: number; to: string }, applied: AppliedChange[]): void {
  for (const a of actions) {
    const c = next.countries[a.country];
    const client = c?.client;
    if (!client || client.patron !== next.player) continue;
    if (a.action === "independence") {
      pass(next, client.land, client.patron, a.country, applied);
      delete c.client;
      if (c.domestic) c.domestic = { ...c.domestic, support: clamp(c.domestic.support + 10, 5, 90) };
      applied.push({ kind: "provisional", country: a.country, patron: client.patron, ...(client.of ? { of: client.of } : {}), change: "independent" });
      continue;
    }
    for (const [id, r] of Object.entries(next.regions).sort((x, y) => x[0].localeCompare(y[0]))) {
      if (r.owner !== a.country && r.controller !== a.country) continue;
      applied.push({ kind: "annex", region: id, from: a.country, to: client.patron });
      r.owner = client.patron;
      r.controller = client.patron;
    }
    applied.push({ kind: "provisional", country: a.country, patron: client.patron, ...(client.of ? { of: client.of } : {}), change: "annexed" });
    // Its wars are its patron's now: it leaves them, and a side left with nobody ends its war.
    for (const w of next.wars.filter((x) => x.attackers.includes(a.country) || x.defenders.includes(a.country))) leaveWar(next, w, a.country, applied);
    dissolve(next, a.country, ctx, applied);
  }
}

/**
 * A client government that has turned against its patron declares itself independent (engine/intentions.ts decides
 * when, and the patron's answer): the tie ends, and with it the treaty that bound them; land still to pass stays with
 * the patron. Returns the patron, or null for a country that is no client. Mutates `next`.
 */
export function declareIndependence(next: GameState, tag: string, because: Because, applied: AppliedChange[]): string | null {
  const c = next.countries[tag];
  const client = c?.client;
  if (!client) return null;
  delete c.client;
  const bond = next.alliances.find((a) => a.id === client.bloc);
  if (bond) {
    applied.push({ kind: "alliance-ended", alliance: bond.id, name: bond.name, members: [...bond.members] });
    next.alliances = next.alliances.filter((a) => a !== bond);
  }
  applied.push({ kind: "provisional", country: tag, patron: client.patron, ...(client.of ? { of: client.of } : {}), change: "independent", because });
  return client.patron;
}

/**
 * Client governments through the turn: the land still to pass, a share
 * (most of it in about three months); recognition abroad; their people's
 * acceptance moving to where its causes put it. One whose patron is gone is
 * on its own; one with no land and none to come is dissolved. Mutates `next`.
 */
export function advanceClients(next: GameState, ctx: { turn: number; to: string; years: number }, applied: AppliedChange[]): void {
  const holders = holdingLand(next);
  for (const tag of Object.keys(next.countries).sort()) {
    const c = next.countries[tag];
    const client = c.client;
    if (!client || c.dormant) continue;
    const patron = next.countries[client.patron];
    if (!patron || patron.dormant || !holders.has(client.patron)) {
      delete c.client;
      applied.push({ kind: "provisional", country: tag, patron: client.patron, ...(client.of ? { of: client.of } : {}), change: "independent" });
      continue;
    }
    if (client.land.length) {
      const share = 1 - 0.5 ** (ctx.years / PASS_HALF);
      const want = Math.max(1, Math.round(client.land.length * share));
      const held = client.land.filter((id) => next.regions[id]?.controller === client.patron);
      const passed = pass(next, held.slice(0, want), client.patron, tag, applied);
      client.land = held.filter((id) => !passed.includes(id));
    }
    if (!holdingLand(next).has(tag) && !client.land.length) {
      applied.push({ kind: "provisional", country: tag, patron: client.patron, ...(client.of ? { of: client.of } : {}), change: "dissolved" });
      dissolve(next, tag, ctx, applied);
      continue;
    }
    const r = recognition(next, tag);
    client.recognised = r.recognised;
    client.refused = r.refused;
    const target = acceptanceTarget(next, tag, ctx.to);
    client.accepted = Math.round(client.accepted + (target - client.accepted) * (1 - 0.5 ** (ctx.years / ACCEPT_HALF)));
  }
}

/**
 * A government abroad that a country capitulates to may set up a government
 * of that country's own instead of annexing it: by the dice, a party state
 * most often, and only where it holds most of the country. The country is
 * brought back under the new government with the land its patron held.
 */
export function installOnCapitulation(next: GameState, tag: string, patron: string, ctx: { turn: number; to: string }, applied: AppliedChange[]): boolean {
  if (patron === next.player || tag === next.player) return false;
  let owns = 0;
  let held = 0;
  for (const r of Object.values(next.regions)) {
    if (r.owner !== tag) continue;
    owns += 1;
    if (r.controller === patron) held += 1;
  }
  if (owns < 2 || held / owns < 0.6) return false;
  if (roll(next.seed ?? next.id, ctx.turn, `install:${tag}:${patron}`) >= INSTALL[regimeOf(next, patron)]) return false;
  const c = next.countries[tag];
  c.government = GOVERNMENT;
  delete c.leader;
  delete c.rulers;
  delete c.exile;
  delete c.course;
  delete c.programmes;
  c.domestic = newDomestic({ tag, government: { ru: "", uk: "", en: "" } }, next.scenarioId, ctx.to, clientRegime(regimeOf(next, patron)));
  const bloc = `a${ctx.turn}-pg-${tag}`;
  next.alliances.push({ id: bloc, name: treatyName(next, patron, tag), members: [patron, tag], since: ctx.to, kind: "alliance", founder: patron });
  const client: Client = { patron, since: ctx.to, land: [], accepted: 0, recognised: [], refused: [], bloc };
  c.client = client;
  // The land its patron held goes back to the country under its new government.
  for (const [id, r] of Object.entries(next.regions).sort((a, b) => a[0].localeCompare(b[0]))) {
    if (r.owner !== tag || r.controller !== patron) continue;
    applied.push({ kind: "liberate", region: id, from: patron, to: tag });
    r.controller = tag;
    delete r.behind;
  }
  // Its army is raised from that land: the old one laid down its arms (engine/warEnd.ts routArmy).
  raiseArmy(next, c, Object.keys(next.regions).filter((id) => next.regions[id].owner === tag && next.regions[id].controller === tag));
  applied.push({ kind: "provisional", country: tag, patron, change: "set-up" });
  const r = recognition(next, tag);
  client.recognised = r.recognised;
  client.refused = r.refused;
  client.accepted = acceptanceTarget(next, tag, ctx.to);
  for (const o of r.refused) addTension(next, o, patron, 5);
  return true;
}

/** The client governments for the game master: whose they are, their acceptance, recognition and the land still to pass. */
export function describeClients(state: GameState): string[] {
  const list = Object.values(state.countries).filter((c) => c.client && !c.dormant);
  const name = (t: string) => `${en(state.countries[t]?.name ?? t)} [${t}]`;
  const lines: string[] = [];
  if (list.length) {
    lines.push("", "PROVISIONAL AND PUPPET GOVERNMENTS (government | set up by | since | accepted by its people 0–100 | recognised by / refused by | land still to pass):");
    for (const c of list) {
      const k = c.client!;
      lines.push(`- ${name(c.tag)}${k.of ? ` beside the old government of ${name(k.of)}` : ""} | ${name(k.patron)} | ${k.since} | ${k.accepted} | ${k.recognised.length} / ${k.refused.length} | ${k.land.length} provinces`);
    }
  }
  // Where the player may set one up now: only countries with land taken from them are asked.
  const index = takenIndex(state);
  const holders = holdingLand(state);
  const candidates = [...index.keys()]
    .filter((t) => t !== state.player && state.countries[t])
    .sort()
    .map((t) => ({ t, chance: provisionalChance(state, state.player, t, index, holders) }))
    .filter((x) => x.chance)
    .slice(0, 6);
  if (candidates.length) {
    lines.push("", `THE PLAYER MAY SET UP A PROVISIONAL GOVERNMENT (if the orders do, give it in "provisional"; the engine passes the land): ${candidates.map((x) => `${name(x.t)} (${x.chance!.land.length} provinces${x.chance!.revive ? ", its old government gone" : ""})`).join("; ")}`);
  }
  return lines;
}

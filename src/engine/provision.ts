import { grainBooks, type GrainBook } from "./deals";
import { type Accounts, nationalAccounts, RICH_INCOME, socialNorm } from "./economy";
import { peopleIn } from "./population";
import type { ResourceType } from "./resources";
import type { GameState, MapRegion } from "./types";

/**
 * How well a country's people are supplied: food, energy and fuel for their
 * homes, everyday goods, housing and medicine, each as a share of what they
 * need, with what causes a shortfall. Read off what the game already keeps —
 * the land and its harvest, the strategic resources, trade and its cuts, the
 * budget's social spending, the war and the occupation — so it needs no
 * state of its own. A shortfall is a crisis for the player (engine/crises.ts)
 * and wears down the support of governments abroad (engine/abroad.ts).
 */

export const PROVISION_KINDS = ["food", "energy", "goods", "housing", "medicine"] as const;
export type ProvisionKind = (typeof PROVISION_KINDS)[number];

export const PROVISION_CAUSES = [
  "harvest",
  "imports",
  "deals",
  "stores",
  "blockade",
  "broke",
  "shortage",
  "occupation",
  "war",
  "warEconomy",
  "inflation",
  "recession",
  "austerity",
] as const;
export type ProvisionCause = (typeof PROVISION_CAUSES)[number];

export interface ProvisionLine {
  kind: ProvisionKind;
  /** % of need, 5–100. */
  level: number;
  /** What holds it up or pulls it down, the main one first. */
  causes: ProvisionCause[];
}

export interface Provision {
  lines: ProvisionLine[];
  /** The lines weighted by how much each matters to people, %. */
  overall: number;
}

/** How much each need weighs in the overall figure. */
const WEIGHTS: Record<ProvisionKind, number> = { food: 0.35, energy: 0.2, goods: 0.15, housing: 0.15, medicine: 0.15 };
/** Fuels that heat homes and run transport. */
const FUELS: ResourceType[] = ["coal", "gas", "oil"];
/** Resources everyday goods are made of. */
const METALS: ResourceType[] = ["iron", "copper", "nickel", "tin", "bauxite", "rubber"];
/** An army costing more than this share of GDP takes from what people can buy. */
const PEACE_ARMY = 0.08;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** The books every country's provision is read from, worked out once for the world. */
export interface ProvisionBooks {
  accounts: Map<string, Accounts>;
  grain: Map<string, GrainBook>;
}

type ProvisionState = Pick<GameState, "countries" | "regions" | "scenarioId" | "date" | "wars"> & Partial<Pick<GameState, "player" | "deals" | "politics">>;

export function provisionBooks(state: ProvisionState, map: Record<string, MapRegion>): ProvisionBooks {
  return { accounts: nationalAccounts(state, map), grain: grainBooks(state, map) };
}

/** In a war that is not under a truce. */
function fighting(state: ProvisionState, tag: string): boolean {
  return state.wars.some((w) => (w.attackers.includes(tag) || w.defenders.includes(tag)) && !(w.truce && w.truce.until > state.date));
}

/** A country's people's provision now, or null for a country without an economy or people. */
export function provisionOf(state: ProvisionState, tag: string, map: Record<string, MapRegion>, books: ProvisionBooks = provisionBooks(state, map)): Provision | null {
  const country = state.countries[tag];
  const e = country?.economy;
  if (!e) return null;
  // The land: how many of its people live under someone else's guns or on a front, and how rich it is.
  let people = 0;
  let held = 0;
  let front = 0;
  let richness = 0;
  for (const [id, r] of Object.entries(state.regions)) {
    if (r.owner !== tag) continue;
    const p = map[id];
    const n = peopleIn(r, p);
    people += n;
    richness += n * (p?.inc ?? 3000);
    if (r.controller !== tag) held += r.contested === tag ? (n * (100 - (r.held ?? 30))) / 100 : n;
    else if (r.contested) {
      held += (n * (r.held ?? 30)) / 100;
      front += 1;
    }
  }
  if (people <= 0) return null;
  const occupied = held / people;
  const atWar = fighting(state, tag);
  const atHome = atWar && (front > 0 || occupied > 0.01);
  const a = books.accounts.get(tag);
  const gdp = Math.max(0.01, e.gdp);
  const cut = clamp(e.tradeCut, 0, 1);
  const broke = e.reserves / gdp < 0.01;
  const rich = richness / people >= RICH_INCOME;
  const social = e.budget.social / gdp / Math.max(0.001, socialNorm(state.scenarioId, rich));

  const lines: ProvisionLine[] = [];
  const line = (kind: ProvisionKind, value: number, causes: ProvisionCause[]) => lines.push({ kind, level: Math.round(clamp(value, 0.05, 1) * 100), causes });

  // Food: the harvest of the land it holds, and imports for the rest while they can come in and be paid for.
  {
    const causes: ProvisionCause[] = [];
    let food = 1;
    const g = books.grain.get(tag);
    if (g && g.need > 0) {
      const own = g.harvest / g.need;
      if (own >= 1) causes.push("harvest");
      else {
        const gap = 1 - own;
        const imported = gap * (1 - cut) * (broke ? 0.6 : 1);
        const contracted =
          tag === state.player && g.price > 0
            ? (state.deals ?? []).filter((d) => d.status === "active" && d.good === "grain" && d.side === "buy").reduce((s, d) => s + d.value / (g.need * g.price), 0)
            : 0;
        const bought = Math.min(gap - imported, contracted);
        food = own + imported + bought;
        if (own >= 0.5) causes.push("harvest");
        if (imported > 0.05) causes.push("imports");
        if (bought > 0.02) causes.push("deals");
        if (cut > 0.05) causes.unshift("blockade");
        if (broke) causes.unshift("broke");
      }
    }
    if (occupied > 0.05) {
      causes.unshift("occupation");
    }
    if (atHome) {
      food -= 0.05;
      causes.unshift("war");
    }
    line("food", food, causes);
  }

  // Energy for homes and transport: own coal, gas and oil, imports while they come, the stores while they last.
  {
    const causes: ProvisionCause[] = [];
    let need = 0;
    let got = 0;
    let stored = false;
    let short = false;
    let bought = false;
    for (const f of FUELS) {
      const n = a?.need[f] ?? 0;
      if (!n) continue;
      const own = Math.min(1, (a?.production[f] ?? 0) / n);
      const rest = 1 - own;
      let covered = own + rest * (1 - cut) * (broke ? 0.6 : 1);
      if (rest > 0.05) bought = true;
      if (rest > 0 && cut > 0) {
        if (a?.shortages.includes(f)) short = true;
        else if ((e.stocks[f] ?? 3) > 0) {
          covered = own + rest;
          stored = true;
        }
      }
      need += n;
      got += n * covered;
    }
    let energy = need > 0 ? got / need : 1;
    if (short) causes.push("shortage");
    if (stored) causes.push("stores");
    if (cut > 0.05) causes.push("blockade");
    if (broke) causes.push("broke");
    if (bought && !causes.length) causes.push("imports");
    if (atHome) {
      energy -= 0.05;
      causes.unshift("war");
    }
    line("energy", energy, causes);
  }

  // Everyday goods: what is left once the army has taken its share, prices allow, imports come in and the metals are there.
  {
    const causes: ProvisionCause[] = [];
    let goods = 1;
    const army = e.budget.army / gdp;
    if (army > PEACE_ARMY) {
      goods -= (army - PEACE_ARMY) * 1.5;
      causes.push("warEconomy");
    }
    if (e.inflation > 15) {
      goods -= Math.min(0.3, (e.inflation - 15) * 0.003);
      causes.push("inflation");
    }
    if (cut > 0.05) {
      goods -= cut * 0.3;
      causes.push("blockade");
    }
    if (e.growth < 0) {
      goods -= Math.min(0.2, -e.growth * 0.02);
      causes.push("recession");
    }
    const lacking = a ? a.shortages.filter((t) => METALS.includes(t)).length : 0;
    if (lacking) {
      goods -= Math.min(0.2, lacking * 0.1);
      causes.push("shortage");
    }
    if (broke) {
      goods -= 0.1;
      causes.push("broke");
    }
    line("goods", goods, causes.sort((x, y) => order(x) - order(y)));
  }

  // Housing: homes lost to the war and the occupation, and what the state spends on its people.
  {
    const causes: ProvisionCause[] = [];
    let housing = 1;
    if (occupied > 0.01) {
      housing -= occupied * 0.6;
      causes.push("occupation");
    }
    if (atHome) {
      housing -= 0.05 + Math.min(0.1, front * 0.01);
      causes.push("war");
    }
    if (social < 1) {
      housing -= (1 - social) * 0.2;
      if (social < 0.8) causes.push("austerity");
    }
    if (e.growth < -5) {
      housing -= 0.05;
      causes.push("recession");
    }
    line("housing", housing, causes);
  }

  // Medicine: hospitals the state pays for, medicines that come from abroad, and the wounded of a war.
  {
    const causes: ProvisionCause[] = [];
    let medicine = 0.75 + 0.25 * Math.min(1, social);
    if (social < 0.8) causes.push("austerity");
    if (cut > 0.05) {
      medicine -= cut * 0.25;
      causes.push("blockade");
    }
    if (atWar) {
      medicine -= atHome ? 0.1 : 0.05;
      causes.unshift("war");
    }
    if (e.inflation > 50) {
      medicine -= 0.1;
      causes.push("inflation");
    }
    line("medicine", medicine, causes);
  }

  const overall = Math.round(lines.reduce((s, l) => s + WEIGHTS[l.kind] * l.level, 0));
  return { lines, overall };
}

/** The order causes are named in: the war and the blockade before the slower ones. */
function order(c: ProvisionCause): number {
  return PROVISION_CAUSES.indexOf(c);
}

/** The worst-supplied need, the one a crisis names. */
export function worstProvision(p: Provision): ProvisionLine {
  return p.lines.reduce((w, l) => (l.level < w.level ? l : w));
}

/** "food 95%, energy 80% (blockade, stores), …" — for the game master. */
export function describeProvision(p: Provision): string {
  return `- the people's provision, % of need: ${p.lines.map((l) => `${l.kind} ${l.level}%${l.level < 100 && l.causes.length ? ` (${l.causes.join(", ")})` : ""}`).join("; ")}; overall ${p.overall}%`;
}

import { grainBooks, type GrainBook } from "./deals";
import { extractionOf, goodsLine, researchGoods } from "./development";
import { type Accounts, nationalAccounts, reserveNorm, RICH_INCOME, socialNorm } from "./economy";
import { countsFor } from "./occupation";
import { peopleIn } from "./population";
import { aheadOf, harvestBonus, medicineBonus } from "./researchEffects";
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
  "research",
  "industry",
] as const;
export type ProvisionCause = (typeof PROVISION_CAUSES)[number];

export interface ProvisionLine {
  kind: ProvisionKind;
  /** % of need, 5–100. */
  level: number;
  /** What holds it up or pulls it down, the main one first. */
  causes: ProvisionCause[];
  /** Of the causes, those that hold it up. */
  up: ProvisionCause[];
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
/** The causes that hold a line up, where they are named: the rest pull it down. */
const SUPPORTS: ProvisionCause[] = ["harvest", "imports", "deals", "stores", "industry"];

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** The books every country's provision is read from, worked out once for the world. */
export interface ProvisionBooks {
  accounts: Map<string, Accounts>;
  grain: Map<string, GrainBook>;
}

type ProvisionState = Pick<GameState, "countries" | "regions" | "scenarioId" | "date" | "wars"> & Partial<Pick<GameState, "player" | "deals" | "politics" | "research">>;

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
  // Land the front has left behind is its captor's to feed (engine/occupation.ts).
  let people = 0;
  let held = 0;
  let front = 0;
  let richness = 0;
  for (const [id, r] of Object.entries(state.regions)) {
    if (countsFor(r) !== tag) continue;
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
  const line = (kind: ProvisionKind, value: number, causes: ProvisionCause[], up: ProvisionCause[] = causes.filter((c) => SUPPORTS.includes(c))) =>
    lines.push({ kind, level: Math.round(clamp(value, 0.05, 1) * 100), causes, up });
  // The player's farming and medical research, ahead of the world or behind it (engine/researchEffects.ts).
  const researched = tag === state.player && state.research?.tech;
  const harvest = researched ? harvestBonus(state) : 0;
  const cure = researched ? medicineBonus(state) : 0;

  // Food: the harvest of the land it holds, and imports for the rest while they can come in and be paid for.
  {
    const causes: ProvisionCause[] = [];
    let food = 1;
    const g = books.grain.get(tag);
    if (g && g.need > 0) {
      const own = (g.harvest * (1 + harvest)) / g.need;
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
      if (Math.abs(harvest) >= 0.02 && own < 1.2) causes.push("research");
    }
    if (occupied > 0.05) {
      causes.unshift("occupation");
    }
    if (atHome) {
      food -= 0.05;
      causes.unshift("war");
    }
    line("food", food, causes, causes.filter((c) => SUPPORTS.includes(c) || (c === "research" && harvest > 0)));
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
    // Mines and wells worked harder by industry spending and policies (engine/development.ts).
    const dug = FUELS.some((f) => (a?.production[f] ?? 0) > 0);
    if (short) causes.push("shortage");
    if (stored) causes.push("stores");
    if (cut > 0.05) causes.push("blockade");
    if (broke) causes.push("broke");
    if (bought && !causes.length) causes.push("imports");
    if (dug && need > 0 && extractionOf(e) >= 1.02) causes.push("industry");
    if (atHome) {
      energy -= 0.05;
      causes.unshift("war");
    }
    line("energy", energy, causes);
  }

  // Everyday goods: what is left once the army has taken its share, prices allow and the metals are there, held up by the
  // factories industry spending built, the industry research lead and imports (engine/development.ts).
  {
    const g = goodsLine({
      army: e.budget.army / gdp,
      inflation: e.inflation,
      cut,
      growth: e.growth,
      metalsLacking: a ? a.shortages.filter((t) => METALS.includes(t)).length : 0,
      broke,
      factories: e.factories ?? 0,
      research: researched ? researchGoods(aheadOf(state, "industry")) : 0,
      reserves: e.reserves / gdp,
      reserveNorm: reserveNorm(state.scenarioId),
    });
    line("goods", g.level, g.causes, g.up);
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
    let medicine = 0.75 + 0.25 * Math.min(1, social) + cure;
    if (social < 0.8) causes.push("austerity");
    if (Math.abs(cure) >= 0.02) causes.push("research");
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
    line("medicine", medicine, causes, cure > 0 && causes.includes("research") ? ["research"] : []);
  }

  const overall = Math.round(lines.reduce((s, l) => s + WEIGHTS[l.kind] * l.level, 0));
  return { lines, overall };
}

/** The worst-supplied need, the one a crisis names. */
export function worstProvision(p: Provision): ProvisionLine {
  return p.lines.reduce((w, l) => (l.level < w.level ? l : w));
}

/**
 * "food 95%, energy 80% (blockade; held up by stores), …" — for the game
 * master, with the levers the engine moves goods and stores by while the
 * goods are short, so the story promises nothing the engine will not do.
 */
export function describeProvision(p: Provision): string {
  const causes = (l: ProvisionLine) => {
    const down = l.causes.filter((c) => !l.up.includes(c));
    const parts = [down.join(", "), l.up.length ? `held up by ${l.up.join(", ")}` : ""].filter(Boolean);
    return l.level < 100 && parts.length ? ` (${parts.join("; ")})` : "";
  };
  const short = p.lines.some((l) => l.kind === "goods" && l.level < 100);
  return [
    `- the people's provision, % of need: ${p.lines.map((l) => `${l.kind} ${l.level}%${causes(l)}`).join("; ")}; overall ${p.overall}%`,
    ...(short ? [PROVISION_LEVERS] : []),
  ].join("\n");
}

/** What moves goods and stores in the engine, in a line. */
const PROVISION_LEVERS =
  "- provision levers in the engine: goods rise only with a smaller army share, industry spending past the era's share or industry/infrastructure policies (over months), an industry research lead and imports while reserves last; resource stores refill only when output passes need (industry effort raises it slowly, at most 30% in a decade) or by contract";

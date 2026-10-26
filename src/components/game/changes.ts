import type { MessageKey } from "@/i18n/messages";
import { INSTITUTIONS } from "@/engine/funds";
import { formatPopulation } from "@/engine/provinces";
import { breakthroughOf } from "@/engine/research";
import type { AppliedChange, Because, CabinetPlot, GameState, PlanKind, PlanStage, Plot, PolicyKind, ResearchDirection, Stats, Text } from "@/engine/types";
import { researchLabel, versusText } from "./armsText";

/** Directions whose breakthroughs say what the direction brings; the military and strategic ones say it themselves. */
const GIVES = new Set<ResearchDirection>(["industry", "agriculture", "medicine", "science", "communications"]);

type T = (key: MessageKey, vars?: Record<string, string | number>) => string;
type TextFn = (value: Text | undefined) => string;
type RegionName = (id: string) => string;

const STAT_KEY: Record<keyof Stats, MessageKey> = {
  stability: "country.stability",
  economy: "country.economy",
  military: "country.military",
};

/** Who a plan is by and aimed at: "Austria-Hungary → Serbia". */
export function planWho(plan: { by: string; target?: string }, country: (tag: string) => string, t: T): string {
  return plan.target ? t("plan.pair", { by: country(plan.by), target: country(plan.target) }) : country(plan.by);
}

/** The name of a plan's kind: lifting sanctions reads apart from imposing them, a policy by its own name. */
export function planKindKey(plan: { kind: PlanKind; lift?: boolean; policy?: PolicyKind }): MessageKey {
  if (plan.kind === "policy" && plan.policy) return `policy.${plan.policy}` as MessageKey;
  return (plan.kind === "sanction" && plan.lift ? "plan.kind.sanctionLift" : `plan.kind.${plan.kind}`) as MessageKey;
}

/** A faction of the cabinet by its id (engine/intrigue.ts): "hawks", …, or a coalition partner's "party:<name>". */
export function factionName(id: string, t: T): string {
  return id.startsWith("party:") ? t("faction.party.named", { party: id.slice(6) }) : t(`faction.${id}` as MessageKey);
}

/** A plot inside the cabinet in the interface language: its faction (or who is blamed for it) and whom it aims at. */
export function cabinetPlotTitle(cabinet: Pick<CabinetPlot, "faction" | "target" | "targetName">, t: T, faction = factionName(cabinet.faction, t)): string {
  return cabinet.target === "leader" ? t("plot.cabinet.leader", { faction }) : t("plot.cabinet", { faction, target: cabinet.targetName });
}

/** A plot's title as the player reads it: a cabinet plot's in their language, any other as the game master wrote it. */
export const plotTitle = (plot: Pick<Plot, "title" | "cabinet">, t: T): string => (plot.cabinet ? cabinetPlotTitle(plot.cabinet, t) : plot.title);

/** The words for a stage a plan has reached. */
export function planStageKey(plan: { kind: PlanKind; lift?: boolean }, stage: PlanStage): MessageKey {
  return `plan.stage.${plan.kind === "sanction" && plan.lift ? "sanctionLift" : plan.kind}.${stage}` as MessageKey;
}

/** Why something happened (engine/standoffs.ts), in the interface language: "after the border clash of May 2024", "deterred by the United States". */
export function becauseText(b: Because, country: (tag: string) => string, t: T, month: (iso: string) => string): string {
  if (b.kind === "incident") return t(`because.incident.${b.incident ?? "border"}` as MessageKey, { month: b.date ? month(b.date) : "" });
  return t(`because.${b.kind}` as MessageKey, { country: b.country ? country(b.country) : "" });
}

/** One applied change as a line of the chronicle, in the interface language; `date` formats a calendar date, `month` a month ("2024-05"). */
export function describeChange(
  change: AppliedChange,
  state: GameState,
  t: T,
  text: TextFn,
  region: RegionName,
  date: (iso: string) => string = (iso) => iso,
  month: (iso: string) => string = (iso) => iso.slice(0, 7),
): string {
  const country = (tag: string) => text(state.countries[tag]?.name ?? tag);
  const line = describeLine(change, state, t, text, region, date);
  // What the engine knows of why: the incident a crisis grew from, the mediator, the slump before a coup.
  const because = "because" in change && change.because ? becauseText(change.because, country, t, month) : "";
  return because ? t("change.because", { line, because }) : line;
}

function describeLine(change: AppliedChange, state: GameState, t: T, text: TextFn, region: RegionName, date: (iso: string) => string): string {
  const country = (tag: string) => text(state.countries[tag]?.name ?? tag);
  switch (change.kind) {
    case "annex":
      return t("change.annex", { region: region(change.region), from: country(change.from), to: country(change.to) });
    case "occupy":
      return t("change.occupy", { region: region(change.region), to: country(change.to) });
    case "liberate":
      return t("change.liberate", { region: region(change.region), to: country(change.to) });
    case "behind":
      return t("change.behind", { region: region(change.region), to: country(change.to) });
    case "contest":
      if (change.held === undefined) return t("change.contest", { region: region(change.region), by: country(change.by) });
      return t("change.contestShare", {
        region: region(change.region),
        by: country(change.by),
        held: change.held,
        delta: change.was === undefined ? t("change.newFront") : `${change.held > change.was ? "+" : "−"}${Math.abs(change.held - change.was)}`,
      });
    case "repel":
      return t("change.repel", { region: region(change.region), by: country(change.by), holder: country(change.holder) });
    case "new-country":
      return t("change.newCountry", { country: country(change.country) });
    case "war":
      return t("change.war", { name: text(change.name) });
    case "peace":
      return t("change.peace", { name: text(change.name) });
    case "alliance":
      return t("change.alliance", { name: text(change.name) });
    case "leave":
      return t("change.leave", { country: country(change.country), alliance: text(change.name) });
    case "leader":
      return t("change.leader", { country: country(change.country), leader: change.leader });
    case "enter":
      return t("change.enter", { country: country(change.country), name: text(change.name) });
    case "accession":
      return t("change.accession", { country: country(change.country), name: text(change.name) });
    case "plan":
      if (change.type === "policy" && change.policy) return t("change.policyPlan", { country: country(change.by), policy: t(`policy.${change.policy}` as MessageKey), stage: t(planStageKey({ kind: change.type }, change.stage)) });
      return t("change.plan", { who: planWho(change, country, t), stage: t(planStageKey({ kind: change.type, lift: change.lift }, change.stage)) });
    case "plan-end": {
      if (change.type === "policy" && change.policy) return t("change.policyEnd", { country: country(change.by), policy: t(`policy.${change.policy}` as MessageKey), why: t(`plan.end.${change.why}` as MessageKey) });
      const drop = t((change.type === "sanction" && change.lift ? "plan.drop.sanctionLift" : `plan.drop.${change.type}`) as MessageKey);
      // A reason the engine knows says it better than the kind of end: "– after mediation by Turkey".
      if (change.because) return t("change.plan", { who: planWho(change, country, t), stage: drop });
      return t("change.planEnd", { who: planWho(change, country, t), drop, why: t(`plan.end.${change.why}` as MessageKey) });
    }
    case "policy":
      return t("change.policy", { country: country(change.country), policy: t(`policy.${change.policy}` as MessageKey) });
    case "accord":
      return t(change.pact ? "change.accordPact" : "change.accord", { by: country(change.by), with: country(change.with) });
    case "incident":
      return t((change.answer === "none" ? "change.incident" : `change.incident.${change.answer}`) as MessageKey, { what: t(`incident.${change.what}` as MessageKey), by: country(change.by), target: country(change.target) });
    case "truce":
      return t("change.truce", { name: text(change.name), date: date(change.until) });
    case "truce-ended":
      return t("change.truceEnded", { name: text(change.name) });
    case "alliance-ended":
      return t("change.allianceEnded", { name: text(change.name) });
    case "invitation":
      return t(change.answer === "accept" ? "change.invitationAccept" : "change.invitationDecline", { country: country(change.country), name: text(change.name) });
    case "summit-planned": {
      // A bloc's session reads as the session of that bloc, in the player's language.
      const bloc = state.alliances.find((a) => a.id === (state.summits ?? []).find((s) => s.id === change.summit)?.bloc);
      return t("change.summitPlanned", { title: bloc ? t("live.sessionOf", { name: text(bloc.name) }) : change.title, date: date(change.date) });
    }
    case "party":
      return t(`change.party.${change.change}` as MessageKey, { party: change.party });
    case "election":
      return t("change.election", { party: change.winner, share: change.share });
    case "vote":
      return t(change.kept ? "change.vote.kept" : "change.vote.lost", { country: country(change.country) });
    case "coup":
      return t(change.succeeded ? "change.coup.succeeded" : "change.coup.failed", { country: country(change.country) });
    case "plot":
      return t(`change.plot.${change.change}` as MessageKey, { title: change.cabinet ? cabinetPlotTitle(change.cabinet, t) : change.title });
    case "cabinet":
      if (change.event === "loyalty") return t(change.to > change.from ? "change.cabinet.loyaltyUp" : "change.cabinet.loyaltyDown", { name: change.name, from: change.from, to: change.to });
      return change.operation
        ? t("change.cabinet.leakOperation", { by: change.by, faction: factionName(change.faction, t), operation: change.operation })
        : t("change.cabinet.leak", { by: change.by, faction: factionName(change.faction, t) });
    case "exile":
      return change.host ? t("change.exileTo", { country: country(change.country), host: country(change.host) }) : t("change.exile", { country: country(change.country) });
    case "return":
      return t("change.return", { country: country(change.country) });
    case "protest":
      return t(`change.protest.${change.change}` as MessageKey, { title: change.title });
    case "overthrown":
      return t(`change.overthrown.${change.how}` as MessageKey, { by: change.by });
    case "sanction":
      return t(`change.sanction.${change.change}` as MessageKey, { by: country(change.by), against: country(change.against) });
    case "budget":
      return t("change.budget", { country: country(change.country) });
    case "funds": {
      const bloc = state.alliances.find((x) => x.id === change.from);
      const from = state.countries[change.from]
        ? country(change.from)
        : bloc
          ? text(bloc.name)
          : (INSTITUTIONS as readonly string[]).includes(change.from)
            ? t(`funds.from.${change.from}` as MessageKey)
            : change.from;
      const value = change.amount >= 1 ? t("unit.money.billion", { n: change.amount }) : t("unit.money.million", { n: Math.round(change.amount * 1000) });
      const line = t(`change.funds.${change.type}` as MessageKey, { from, to: country(change.to), value });
      return change.note ? `${line}. ${change.note}` : line;
    }
    case "bill":
      return t(change.change === "passed" ? "change.bill.passed" : "change.bill.failed", { title: change.title }) + (change.note ? ` – ${change.note}` : "");
    case "law":
      return t("change.law", { law: t(`law.${change.law}` as MessageKey), to: t(`law.${change.law}.${change.to}` as MessageKey) });
    case "identity":
      return change.what === "name"
        ? t("change.identity.name", { to: text(change.to) })
        : change.what === "color"
          ? t("change.identity.color")
          : t("change.identity.place", { from: change.from ?? "", to: text(change.to) });
    case "deal": {
      const what = t(`deals.${change.side}.what` as MessageKey, { good: t(`goods.gen.${change.good}` as MessageKey) });
      const value = change.value >= 1 ? t("unit.money.billion", { n: change.value }) : t("unit.money.million", { n: Math.round(change.value * 1000) });
      const line = t(`change.deal.${change.change}` as MessageKey, { what, partner: country(change.partner), value });
      return change.note ? `${line}. ${change.note}` : line;
    }
    case "official":
      return t(`change.official.${change.change}` as MessageKey, { title: change.title, name: change.name });
    case "research": {
      const project = researchLabel(change.project, t, text);
      if (change.change === "focus") return t("change.research.focus", { project, shift: `${(change.shift ?? 0) > 0 ? "+" : "−"}${Math.abs(change.shift ?? 0)}` });
      const line = t(`change.research.${change.change}` as MessageKey, { project });
      const b = change.change === "done" ? breakthroughOf(change.project) : undefined;
      if (!b) return line;
      // A breakthrough with when it came against history, what it is and what its direction brings.
      const when = change.ahead === undefined ? "" : `, ${versusText(change.ahead, t)}`;
      const gives = GIVES.has(b.direction) ? ` – ${t(`research.gives.${b.direction}` as MessageKey)}` : "";
      return `${line}${when}. ${text(b.effect)}${gives}`;
    }
    case "captured":
      return t("change.captured", { by: country(change.by), from: country(change.from), n: change.n.toLocaleString(), kind: t(`arms.kind.${change.arms}` as MessageKey) });
    case "intrigue":
      return t((change.event === "done" ? `change.intrigue.done.${change.goal}` : "change.intrigue.exposed") as MessageKey, { deputy: change.deputy, target: change.target });
    case "rise":
      return t(`change.rise.${change.how}` as MessageKey, { name: change.name });
    case "fate":
      return t((change.event === "died" && change.cause === "assassination" ? "change.fate.assassinated" : `change.fate.${change.event}`) as MessageKey, { name: change.name || t(`change.fate.who.${change.role}` as MessageKey) });
    case "approval":
      return t("change.approval", { yes: change.accepted.join(", ") || "–", no: change.refused.join(", ") || "–" });
    case "repression":
      return t(`change.repression.${change.event}` as MessageKey);
    case "movement":
      return t(`change.movement.${change.change}` as MessageKey, { name: change.name });
    case "population": {
      const parts = [
        change.deaths > 0 ? t("change.population.deaths", { n: formatPopulation(change.deaths) }) : "",
        change.refugees > 0
          ? change.to
            ? t("change.population.refugeesTo", { n: formatPopulation(change.refugees), to: country(change.to) })
            : t("change.population.refugees", { n: formatPopulation(change.refugees) })
          : "",
      ].filter(Boolean);
      return t("change.population", { country: country(change.country), what: parts.join(", "), cause: change.cause || "–" });
    }
    case "stats": {
      const delta = (Object.entries(change.delta) as [keyof Stats, number][])
        .map(([k, v]) => `${t(STAT_KEY[k])} ${v > 0 ? "+" : ""}${v}`)
        .join(", ");
      return t("change.stats", { country: country(change.country), delta });
    }
  }
}

/**
 * A front's movement: a share of a province won or lost, a new front, a
 * front pushed back. The ministers tell of the fronts when asked; the lists
 * of what changed leave them out and keep land that changed hands.
 */
export const isFrontMovement = (change: AppliedChange): boolean => change.kind === "contest" || change.kind === "repel";

/** What a turn lists as changed: everything but the fronts' movements. */
export const listedChanges = (applied: AppliedChange[]): AppliedChange[] => applied.filter((c) => !isFrontMovement(c));

/** Map changes first, then politics, then the numbers. */
export function sortChanges(changes: AppliedChange[]): AppliedChange[] {
  const rank: Record<AppliedChange["kind"], number> = {
    overthrown: -2, rise: -1.9, fate: -1.95, approval: 18.15, exile: -1, return: -1, "new-country": 0, war: 1, peace: 2, truce: 3, "truce-ended": 4, annex: 5, liberate: 6, occupy: 7, behind: 7.5, contest: 8, repel: 9, alliance: 10, invitation: 11, "alliance-ended": 12, leave: 13, "summit-planned": 14, election: 15, coup: 15.2, vote: 15.4, party: 16, protest: 16.5, plot: 17, leader: 18, official: 18.2, enter: 1.5, accession: 10.5, plan: 14.2, "plan-end": 14.3, incident: 14.15, policy: 14.25, accord: 14.35, sanction: 14.5, deal: 14.6, funds: 14.7, law: 16.8, bill: 16.7, identity: 0.5, budget: 18.3, population: 18.5, stats: 19, research: 18.25, captured: 14.8, intrigue: 18.1, cabinet: 18.16, repression: 16.6, movement: 16.65,
  };
  return [...changes].sort((a, b) => rank[a.kind] - rank[b.kind]);
}

/** A stat change worth showing up front: the player's own, or a big swing. */
export function isNotableStats(change: AppliedChange, player: string): boolean {
  if (change.kind !== "stats") return true;
  if (change.country === player) return true;
  return Object.values(change.delta).some((v) => Math.abs(v ?? 0) >= 5);
}

/**
 * Occupations of many provinces in one turn read as a list of dozens of
 * lines; they are grouped per recipient and former holder instead.
 */
export function groupTerritory(changes: AppliedChange[]): { lines: AppliedChange[]; groups: { kind: "annex" | "occupy" | "liberate" | "behind"; from: string; to: string; regions: string[] }[] } {
  const groups = new Map<string, { kind: "annex" | "occupy" | "liberate" | "behind"; from: string; to: string; regions: string[] }>();
  const lines: AppliedChange[] = [];
  for (const c of changes) {
    if (c.kind === "annex" || c.kind === "occupy" || c.kind === "liberate" || c.kind === "behind") {
      const key = `${c.kind}|${c.from}|${c.to}`;
      const group = groups.get(key) ?? { kind: c.kind, from: c.from, to: c.to, regions: [] };
      group.regions.push(c.region);
      groups.set(key, group);
    } else lines.push(c);
  }
  return { lines, groups: [...groups.values()] };
}

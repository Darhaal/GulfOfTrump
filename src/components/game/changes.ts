import type { MessageKey } from "@/i18n/messages";
import { INSTITUTIONS } from "@/engine/funds";
import { formatPopulation } from "@/engine/provinces";
import type { AppliedChange, GameState, Stats, Text } from "@/engine/types";
import { projectLabel } from "./armsText";

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

/** One applied change as a line of the chronicle, in the interface language; `date` formats a calendar date. */
export function describeChange(change: AppliedChange, state: GameState, t: T, text: TextFn, region: RegionName, date: (iso: string) => string = (iso) => iso): string {
  const country = (tag: string) => text(state.countries[tag]?.name ?? tag);
  switch (change.kind) {
    case "annex":
      return t("change.annex", { region: region(change.region), from: country(change.from), to: country(change.to) });
    case "occupy":
      return t("change.occupy", { region: region(change.region), to: country(change.to) });
    case "liberate":
      return t("change.liberate", { region: region(change.region), to: country(change.to) });
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
      return t("change.plan", { who: planWho(change, country, t), stage: t(`plan.stage.${change.type}.${change.stage}` as MessageKey) });
    case "plan-end":
      return t("change.planEnd", { who: planWho(change, country, t), drop: t(`plan.drop.${change.type}` as MessageKey), why: t(`plan.end.${change.why}` as MessageKey) });
    case "truce":
      return t("change.truce", { name: text(change.name), date: date(change.until) });
    case "truce-ended":
      return t("change.truceEnded", { name: text(change.name) });
    case "alliance-ended":
      return t("change.allianceEnded", { name: text(change.name) });
    case "invitation":
      return t(change.answer === "accept" ? "change.invitationAccept" : "change.invitationDecline", { country: country(change.country), name: text(change.name) });
    case "summit-planned":
      return t("change.summitPlanned", { title: change.title, date: date(change.date) });
    case "party":
      return t(`change.party.${change.change}` as MessageKey, { party: change.party });
    case "election":
      return t("change.election", { party: change.winner, share: change.share });
    case "vote":
      return t(change.kept ? "change.vote.kept" : "change.vote.lost", { country: country(change.country) });
    case "coup":
      return t(change.succeeded ? "change.coup.succeeded" : "change.coup.failed", { country: country(change.country) });
    case "plot":
      return t(`change.plot.${change.change}` as MessageKey, { title: change.title });
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
      return t(change.change === "passed" ? "change.bill.passed" : "change.bill.failed", { title: change.title }) + (change.note ? ` — ${change.note}` : "");
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
    case "research":
      return t(`change.research.${change.change}` as MessageKey, { project: projectLabel(change.project, state, t, text) });
    case "captured":
      return t("change.captured", { by: country(change.by), from: country(change.from), n: change.n.toLocaleString(), kind: t(`arms.kind.${change.arms}` as MessageKey) });
    case "intrigue":
      return t((change.event === "done" ? `change.intrigue.done.${change.goal}` : "change.intrigue.exposed") as MessageKey, { deputy: change.deputy, target: change.target });
    case "population": {
      const parts = [
        change.deaths > 0 ? t("change.population.deaths", { n: formatPopulation(change.deaths) }) : "",
        change.refugees > 0
          ? change.to
            ? t("change.population.refugeesTo", { n: formatPopulation(change.refugees), to: country(change.to) })
            : t("change.population.refugees", { n: formatPopulation(change.refugees) })
          : "",
      ].filter(Boolean);
      return t("change.population", { country: country(change.country), what: parts.join(", "), cause: change.cause || "—" });
    }
    case "stats": {
      const delta = (Object.entries(change.delta) as [keyof Stats, number][])
        .map(([k, v]) => `${t(STAT_KEY[k])} ${v > 0 ? "+" : ""}${v}`)
        .join(", ");
      return t("change.stats", { country: country(change.country), delta });
    }
  }
}

/** Map changes first, then politics, then the numbers. */
export function sortChanges(changes: AppliedChange[]): AppliedChange[] {
  const rank: Record<AppliedChange["kind"], number> = {
    overthrown: -2, exile: -1, return: -1, "new-country": 0, war: 1, peace: 2, truce: 3, "truce-ended": 4, annex: 5, liberate: 6, occupy: 7, contest: 8, repel: 9, alliance: 10, invitation: 11, "alliance-ended": 12, leave: 13, "summit-planned": 14, election: 15, coup: 15.2, vote: 15.4, party: 16, protest: 16.5, plot: 17, leader: 18, official: 18.2, enter: 1.5, accession: 10.5, plan: 14.2, "plan-end": 14.3, sanction: 14.5, deal: 14.6, funds: 14.7, law: 16.8, bill: 16.7, identity: 0.5, budget: 18.3, population: 18.5, stats: 19, research: 18.25, captured: 14.8, intrigue: 18.1,
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
export function groupTerritory(changes: AppliedChange[]): { lines: AppliedChange[]; groups: { kind: "annex" | "occupy" | "liberate"; from: string; to: string; regions: string[] }[] } {
  const groups = new Map<string, { kind: "annex" | "occupy" | "liberate"; from: string; to: string; regions: string[] }>();
  const lines: AppliedChange[] = [];
  for (const c of changes) {
    if (c.kind === "annex" || c.kind === "occupy" || c.kind === "liberate") {
      const key = `${c.kind}|${c.from}|${c.to}`;
      const group = groups.get(key) ?? { kind: c.kind, from: c.from, to: c.to, regions: [] };
      group.regions.push(c.region);
      groups.set(key, group);
    } else lines.push(c);
  }
  return { lines, groups: [...groups.values()] };
}

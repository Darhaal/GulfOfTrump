import type { MessageKey } from "@/i18n/messages";
import { INSTITUTIONS } from "@/engine/funds";
import { officialTitle } from "@/engine/government";
import { formatPopulation } from "@/engine/provinces";
import { breakthroughOf } from "@/engine/research";
import { historicCrime } from "@/engine/scenarios/crimes";
import { COSMODROMES, MILESTONES } from "@/engine/space";
import { LADDER_STEPS, type AppliedChange, type Because, type CabinetPlot, type Forum, type GameState, type PlanKind, type PlanStage, type Plot, type PolicyKind, type ResearchDirection, type Resolution, type Stats, type Text } from "@/engine/types";
import { researchLabel, versusText } from "./armsText";
import { jointTitle } from "./jointText";
import { gamesTitle, gamesWhere } from "./sportText";

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

/** A world body's forum by name: the UN's Security Council or General Assembly, or the League of Nations (engine/aggression.ts). */
export function forumName(body: string, forum: Forum, t: T): string {
  if (body !== "un") return t("body.league");
  return t(forum === "council" ? "body.council" : "body.assembly");
}

/** A resolution's result in a word or two, with the votes: passed, vetoed by whom, failed. */
export function resolutionResult(r: Pick<Resolution, "passed" | "veto" | "yes" | "no" | "abstain">, country: (tag: string) => string, t: T): string {
  const votes = t("resolution.votes", { yes: r.yes, no: r.no, abstain: r.abstain });
  if (r.passed) return t("resolution.passed", { votes });
  if (r.veto?.length) return t("resolution.vetoed", { who: r.veto.map(country).join(", "), votes });
  return t("resolution.failed", { votes });
}

/** A world body's vote on an act of aggression as a line of the news. */
function resolutionLine(change: Extract<AppliedChange, { kind: "resolution" }>, country: (tag: string) => string, t: T): string {
  const what = t(`change.resolution.${change.resolution}` as MessageKey, { body: forumName(change.body, change.forum, t), by: country(change.by), against: country(change.against) });
  const line = t("change.resolutionResult", { what, result: resolutionResult(change, country, t) });
  return change.expelled ? t("change.resolutionExpelled", { line, by: country(change.by) }) : line;
}

/** What the leader ordered the player to do (engine/repressions.ts): a case against a person, or history's operation by its name. */
export function demandWhat(d: { name: string; measure: string; history?: string }, t: T, text: TextFn): string {
  if (d.history) return text(historicCrime(d.history)?.name ?? d.name);
  return t(`repress.what.${d.measure}` as MessageKey, { name: d.name });
}

/** A mass crime's line (engine/repressions.ts): what was done to whom, its toll; or what came of it later. */
function crimeLine(change: Extract<AppliedChange, { kind: "crime" }>, country: (tag: string) => string, t: T, text: TextFn): string {
  const kind = t(`repress.kind.${change.crime}` as MessageKey);
  const who = text(change.who);
  if (change.result !== "done" && change.result !== "ongoing") return t(`change.crime.${change.result}` as MessageKey, { kind, who });
  let line = t(`change.crime.${change.crime}` as MessageKey, { who, toll: formatPopulation(change.toll), moved: formatPopulation(change.moved ?? 0), held: formatPopulation(change.held ?? 0) });
  if (change.harsher) line = t("change.crime.harsher", { line });
  if (change.result === "ongoing") line = t("change.crime.ongoing", { line });
  if (change.condemned?.length) line = t("change.crime.condemnedBy", { line, countries: change.condemned.slice(0, 5).map(country).join(", ") });
  return change.origin === "history" ? t("change.crime.history", { country: country(change.by), line }) : line;
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
      return t(change.settled ? "change.repel.settled" : "change.repel", { region: region(change.region), by: country(change.by), holder: country(change.holder) });
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
    case "outcry": {
      const named = change.countries.map(country);
      const list = change.n > named.length ? t("change.outcryMore", { list: named.join(", "), n: change.n - named.length }) : named.join(", ");
      return t("change.outcry", { list, by: country(change.by), against: country(change.against) });
    }
    case "session":
      return t("change.session", { body: forumName(change.body, "council", t), by: country(change.by), against: country(change.against) });
    case "resolution":
      return resolutionLine(change, country, t);
    case "aid":
      return t("change.aid", { by: country(change.by), to: country(change.to) });
    case "pledge":
      return t("change.pledge", { by: country(change.by), to: country(change.to), against: country(change.against) });
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
    case "party": {
      // The engine's parties (engine/partyLife.ts) read by their camp until the game master names them.
      const camp = t(`politics.camp.${change.camp ?? "socialist"}` as MessageKey);
      if (change.change === "rose") return t("change.party.rose", { camp });
      if (change.change === "split") return t("change.party.split", { from: change.from ?? "", camp });
      if (change.change === "merged") return t("change.party.merged", { from: change.from ?? "", party: change.party });
      if (change.change === "named") return change.from ? t("change.party.namedSplit", { from: change.from, party: change.party }) : t("change.party.named", { camp, party: change.party });
      // One the engine made and that ended before it had a name reads by where it came from.
      const party = change.unnamed ? (change.from ? t("politics.unnamedSplit", { party: change.from }) : t("politics.unnamed", { camp })) : change.party;
      return t(`change.party.${change.change}` as MessageKey, { party });
    }
    case "election":
      return t("change.election", { party: change.winner, share: change.share });
    case "parliament":
      return t(`change.parliament.${change.change}` as MessageKey, { name: change.name });
    case "ministry":
      return t(`change.ministry.${change.change}` as MessageKey, { name: change.name ?? t(`post.${change.id}` as MessageKey) });
    case "vote":
      return t(change.postponed ? "change.vote.postponed" : change.kept ? "change.vote.kept" : "change.vote.lost", { country: country(change.country) });
    case "coup":
      return t(change.succeeded ? "change.coup.succeeded" : "change.coup.failed", { country: country(change.country) });
    case "plot":
      return t(`change.plot.${change.change}` as MessageKey, { title: change.cabinet ? cabinetPlotTitle(change.cabinet, t) : change.title });
    // Repressions and mass crimes (engine/repressions.ts): the engine's dry line, in the player's language.
    case "case": {
      const who = change.title ? `${change.name} (${change.title})` : change.name;
      const measure = t(`repress.measure.${change.measure}` as MessageKey);
      const line = change.result === "done" ? t(`change.case.${change.measure}` as MessageKey, { who }) : t(`change.case.${change.result}` as MessageKey, { who, measure });
      const martyr = change.martyr ? t("change.case.martyr", { line }) : line;
      return change.player && change.result === "done" ? t("change.case.byPlayer", { line: martyr }) : martyr;
    }
    case "crime":
      return crimeLine(change, country, t, text);
    case "demand": {
      const what = demandWhat(change, t, text);
      return change.answer ? t(`change.demand.${change.answer}` as MessageKey, { what }) : t("change.demand.raised", { by: change.by, what });
    }
    case "cabinet":
      if (change.event === "loyalty") return t(change.to > change.from ? "change.cabinet.loyaltyUp" : "change.cabinet.loyaltyDown", { name: change.name, from: change.from, to: change.to });
      return change.operation
        ? t("change.cabinet.leakOperation", { by: change.by, faction: factionName(change.faction, t), operation: change.operation })
        : t("change.cabinet.leak", { by: change.by, faction: factionName(change.faction, t) });
    case "exile":
      return change.host ? t("change.exileTo", { country: country(change.country), host: country(change.host) }) : t("change.exile", { country: country(change.country) });
    case "return":
      return t("change.return", { country: country(change.country) });
    case "capitulation":
      return change.to ? t(`change.capitulation.${change.why}`, { country: country(change.country), to: country(change.to) }) : t("change.capitulation.gone", { country: country(change.country) });
    case "terms":
      return t(`change.terms.${change.terms}`, { by: country(change.by), with: country(change.with), name: text(change.name) });
    case "offer":
      return t(change.change === "lapsed" ? "change.offer.lapsed" : "change.offer", { by: country(change.by), name: text(change.name) });
    case "provisional":
      return t(`change.provisional.${change.change}`, { country: country(change.country), patron: country(change.patron), of: change.of ? country(change.of) : country(change.country) });
    case "protest":
      return t(`change.protest.${change.change}` as MessageKey, { title: change.title });
    case "overthrown":
      return t(`change.overthrown.${change.how}` as MessageKey, { by: change.by });
    case "sanction":
      return t(`change.sanction.${change.change}` as MessageKey, { by: country(change.by), against: country(change.against) });
    case "envoy":
      return change.status === "war" ? t("change.envoy.war", { country: country(change.country) }) : t(`change.envoy.${change.status}` as MessageKey, { country: country(change.country), partner: country(change.partner ?? "") });
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
    case "order-lapsed":
      return t("change.orderLapsed", { order: change.order.length > 80 ? `${change.order.slice(0, 79)}…` : change.order });
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
      const partner = country(change.partner);
      const cause = change.cause ? t(`deals.cause.${change.cause}` as MessageKey) : "";
      // A deal the player could not deliver reads apart from one the partner broke; refusals say why, signings after haggling how long it took.
      let line =
        change.change === "broken" && change.by === "player"
          ? t("change.deal.failed", { what, partner, cause })
          : t(`change.deal.${change.change}` as MessageKey, { what, partner, value, cause, n: Math.round((change.share ?? 0) * 100) });
      if (change.change === "broken" && change.by !== "player" && cause) line += ` (${cause})`;
      if (change.change === "rejected" && change.reason) line += ` – ${t(`deals.reason.${change.reason}` as MessageKey)}`;
      if ((change.change === "signed" || change.change === "renegotiated") && (change.rounds ?? 0) > 1) line += ` – ${t("change.deal.after", { n: change.rounds ?? 0 })}`;
      return change.note ? `${line}. ${change.note}` : line;
    }
    case "official":
      return t(`change.official.${change.change}` as MessageKey, { title: officialTitle(change, text), name: change.name });
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
    case "space": {
      // The space race (engine/space.ts): a feat with when it came against history, a lost rocket, a launch site.
      const feat = change.milestone ? text(MILESTONES[change.milestone].name) : "";
      const site = change.site ? text(COSMODROMES.find((c) => c.id === change.site)?.name ?? state.space?.sites?.find((s) => s.id === change.site)?.name ?? change.site) : "";
      if (change.change === "done") {
        const line = t(change.first ? "change.space.first" : "change.space.done", { country: country(change.country), feat });
        const when = change.first && change.ahead !== undefined && Math.abs(change.ahead) >= 0.25 ? `, ${versusText(change.ahead, t)}` : "";
        return `${line}${when}. ${text(MILESTONES[change.milestone!].effect)}`;
      }
      if (change.change === "failed") return t("change.space.failed", { country: country(change.country), feat });
      if (change.change === "captured") return t("change.space.captured", { site, from: country(change.from ?? ""), country: country(change.country) });
      const ordered = state.space?.sites?.some((s) => s.id === change.site);
      return t(ordered ? "change.space.ordered" : "change.space.site", { country: country(change.country), site });
    }
    case "sport": {
      // The Olympic Games and the World Cup (engine/sport.ts): a host chosen or lost, Games cancelled or boycotted, a ban, the results.
      const games = change.games ? gamesTitle(change.games, t) : "";
      const where = gamesWhere(change.hosts ?? [], change.city, country, text);
      const countries = (change.countries ?? []).map(country).join(", ");
      switch (change.change) {
        case "awarded": {
          const line = t("change.sport.awarded", { games, where });
          return change.bids && change.bids.length > 1 ? `${line} (${t("change.sport.bids", { bids: change.bids.map(country).join(", ") })})` : line;
        }
        case "replaced":
          return t("change.sport.replaced", { games, from: gamesWhere(change.from ?? [], change.city, country, text), why: t(`sport.why.${change.why ?? "collapsed"}` as MessageKey) });
        case "cancelled":
          return t("change.sport.cancelled", { games, why: t(change.why === "host" ? "sport.cancel.host" : "sport.cancel.war") });
        case "boycott":
          return t("change.sport.boycott", { games, where, countries });
        case "ban":
          return t("change.sport.ban", { country: countries, why: t(`sport.ban.${change.why ?? "history"}` as MessageKey) });
        case "unban":
          return t("change.sport.unban", { country: countries });
        case "refused":
          return t("change.sport.refused", { country: countries });
        case "held": {
          const line = change.leader ? t("change.sport.held", { games, where, leader: country(change.leader), gold: change.gold ?? 0 }) : `${games} (${where})`;
          const ours = change.rank ? t("change.sport.ours", { rank: change.rank, medals: change.medals ?? 0 }) : t("change.sport.oursNone");
          return `${line}; ${ours}`;
        }
        case "final": {
          const score = `${(change.score ?? [0, 0]).join("–")}${change.penalties ? ` (${t("sport.penalties")})` : ""}`;
          return t("change.sport.final", { games, winner: country(change.winner ?? ""), runnerUp: country(change.runnerUp ?? ""), score });
        }
      }
      return games;
    }
    case "energy": {
      // Electricity (engine/energy.ts): plants on line or begun, plants lost to the war, a shortage and its end.
      const source = change.source ? t(`energy.source.${change.source}` as MessageKey) : "";
      const gw = (change.gw ?? 0).toLocaleString(undefined, { maximumFractionDigits: 1 });
      return t(`change.energy.${change.change}` as MessageKey, { country: country(change.country), source, gw, n: change.share ?? 0 });
    }
    case "atom": {
      // The atom (engine/atom.ts): a stage reached, the first test in the world, a programme begun or given up, a strike.
      // A computer government's escalation ladder (engine/nuclear.ts): a rung climbed, a demonstration, a rung down, its forces stood down.
      if (change.change === "ladder") {
        const step = change.step ? t(`nuclear.step.${LADDER_STEPS[change.step - 1]}` as MessageKey) : "";
        const key = change.step === 0 ? "change.atom.ladder.stood" : change.down ? "change.atom.ladder.down" : change.demo ? `change.atom.ladder.${change.demo}` : `change.atom.ladder.${change.step}`;
        return t(key as MessageKey, { country: country(change.country), against: country(change.against ?? ""), step });
      }
      if (change.change === "strike") {
        const key = change.tactical ? (change.answer ? "change.atom.tacticalAnswer" : "change.atom.tactical") : change.answer ? "change.atom.answer" : "change.atom.strike";
        return t(key, { country: country(change.country), against: country(change.against ?? ""), place: change.province ? region(change.province) : "", n: change.n ?? 1, deaths: formatPopulation(change.deaths ?? 0) });
      }
      if (change.change === "stage") {
        const line = t(change.first ? "change.atom.first" : `change.atom.${change.stage}` as MessageKey, { country: country(change.country), stage: t(`atom.stage.${change.stage}` as MessageKey) });
        const when = change.ahead !== undefined && Math.abs(change.ahead) >= 0.5 && (change.stage === "test" || change.stage === "hydrogen") ? `, ${versusText(change.ahead, t)}` : "";
        return `${line}${when}`;
      }
      return t(`change.atom.${change.change}` as MessageKey, { country: country(change.country) });
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
    case "proposals":
      return t("change.proposals", { yes: change.accepted.map((p) => `«${p}»`).join(", ") || "–", no: change.refused.map((p) => `«${p}»`).join(", ") || "–" });
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
    case "civilians": {
      // A war's toll on the people (engine/civilians.ts): its dead by their main cause, and those who fled.
      const parts = [
        change.dead > 0 ? t(`change.civilians.${change.cause}` as MessageKey, { n: formatPopulation(change.dead) }) : "",
        change.fled > 0 ? t("change.civilians.fled", { n: formatPopulation(change.fled) }) : "",
      ].filter(Boolean);
      return t("change.civilians", { country: country(change.country), what: parts.join(", ") });
    }
    case "mobilisation":
      return t(`change.mobilisation.${change.change}` as MessageKey, { country: country(change.country), n: change.strain });
    case "civil":
      return civilLine(change, country, t);
    case "stats": {
      const delta = (Object.entries(change.delta) as [keyof Stats, number][])
        .map(([k, v]) => `${t(STAT_KEY[k])} ${v > 0 ? "+" : ""}${v}`)
        .join(", ");
      return t("change.stats", { country: country(change.country), delta });
    }
    case "colony":
      return colonyLine(change, country, t, text, date);
    case "joint": {
      // A joint action of allies (engine/joint.ts): begun, offered, turned down, carried out, built or broken off.
      const what = jointTitle({ kind: change.type, name: change.name, target: change.target, project: change.project, direction: change.direction }, t, text, country);
      const members = change.members.map(country).join(", ");
      const reason = change.reason ? t(`joint.reason.${change.reason}` as MessageKey) : "–";
      const target = country(change.target ?? "");
      switch (change.change) {
        case "begun":
          return t("change.joint.begun", { what, members });
        case "offered":
          return t("change.joint.offered", { what, by: country(change.by ?? change.members[0]) });
        case "refused":
          return t("change.joint.refused", { what, members, reason });
        case "built":
          return t("change.joint.built", { what, members, gdp: (change.gdp ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 }) });
        case "ended":
          return t("change.joint.ended", { what, reason });
        case "done":
          if (change.km !== undefined) return t("change.joint.km", { what, members, km: change.km.toLocaleString(undefined, { maximumFractionDigits: 1 }) });
          if (change.yielded !== undefined) return t(change.yielded ? "change.joint.yielded" : "change.joint.rejected", { what, target });
          return t("change.joint.done", { what, members });
      }
      return what;
    }
  }
}

/** A civil war's step, as a line of the news (engine/civilWar.ts). */
export function civilLine(change: Extract<AppliedChange, { kind: "civil" }>, country: (tag: string) => string, t: T): string {
  const vars = { country: country(change.country), rebels: country(change.rebels), by: change.by ? country(change.by) : "", n: change.n ?? 0, regions: change.regions ?? 0 };
  switch (change.change) {
    case "split":
      return t(`change.civil.split.${change.how ?? "rising"}` as MessageKey, vars);
    case "defected": {
      const to = change.side === "rebels" ? vars.rebels : vars.country;
      const men = (change.n ?? 0) >= 1 ? t("change.civil.defectedMen", { n: formatPopulation(change.n ?? 0) }) : "";
      const land = change.regions ? t("change.civil.defectedRegions", { n: change.regions }) : "";
      return t("change.civil.defected", { to, what: [men, land].filter(Boolean).join(", ") });
    }
    case "volunteers":
      return t("change.civil.volunteers", { ...vars, side: change.side === "rebels" ? vars.rebels : vars.country, n: formatPopulation(change.n ?? 0) });
    default:
      return t(`change.civil.${change.change}` as MessageKey, vars);
  }
}

/** A colony's step on its way, as a line of the news (engine/colonies.ts). */
export function colonyLine(
  change: Extract<AppliedChange, { kind: "colony" }>,
  country: (tag: string) => string,
  t: T,
  text: TextFn,
  date: (iso: string) => string = (iso) => iso,
): string {
  const vars = { colony: text(change.name), country: country(change.country), of: country(change.of), movement: change.movement ? country(change.movement) : text(change.name) };
  if (change.change !== "independence") {
    const line = t(`change.colony.${change.change}` as MessageKey, vars);
    return change.change === "talks" && change.due ? t("change.colony.dueOn", { line, date: date(change.due) }) : line;
  }
  const line = t(`change.colony.independence.${change.how ?? "handover"}` as MessageKey, vars);
  return change.leader && change.how !== "union" ? t("change.colony.led", { line, leader: change.leader }) : line;
}

/**
 * A front's movement: a share of a province won or lost, a new front, a
 * front pushed back. The ministers tell of the fronts when asked; the lists
 * of what changed leave them out and keep land that changed hands.
 */
export const isFrontMovement = (change: AppliedChange): boolean => change.kind === "contest" || (change.kind === "repel" && !change.settled);

/** What a turn lists as changed: everything but the fronts' movements. */
export const listedChanges = (applied: AppliedChange[]): AppliedChange[] => applied.filter((c) => !isFrontMovement(c));

/** The stages a turn's report tells after its story, in order (TurnReport). */
export const REPORT_STAGES = ["politics", "economy", "army", "world"] as const;
export type ReportStage = (typeof REPORT_STAGES)[number];

/**
 * A change of the war's map: land that changed hands, a front that moved
 * through a province, land the front left behind. The report counts them in
 * one line and leaves the telling to the army tab and the map.
 */
export const isFrontChange = (change: AppliedChange): boolean =>
  change.kind === "occupy" || change.kind === "liberate" || change.kind === "behind" || isFrontMovement(change);

/** How many provinces changed hands in a turn, and in how many more the front moved. */
export function frontCounts(applied: AppliedChange[]): { taken: number; moved: number } {
  const taken = new Set<string>();
  const moved = new Set<string>();
  for (const c of applied) {
    if ((c.kind === "occupy" || c.kind === "liberate") && c.from !== c.to) taken.add(c.region);
    else if (c.kind === "contest" || (c.kind === "repel" && !c.settled)) moved.add(c.region);
  }
  for (const id of taken) moved.delete(id);
  return { taken: taken.size, moved: moved.size };
}

/**
 * The stage of the report a change belongs to: home politics (laws,
 * parliament, the cabinet, the street, the government's fate), the economy
 * (budget, money, deals, research, the numbers), the army (wars, truces,
 * captured weapons, the people a war takes) or the world (blocs, plans and
 * accords abroad, other governments, sanctions, borders redrawn by treaty).
 * The fronts' changes belong to none: they are counted (frontCounts).
 */
export function reportStage(change: AppliedChange, player: string, atWar: boolean): ReportStage | null {
  if (isFrontChange(change)) return null;
  switch (change.kind) {
    case "law":
    case "bill":
    case "order-lapsed":
    case "election":
    case "parliament":
    case "ministry":
    case "party":
    case "plot":
    case "cabinet":
    case "official":
    case "protest":
    case "repression":
    case "case":
    case "demand":
    case "movement":
    case "intrigue":
    case "approval":
    case "proposals":
    case "rise":
    case "fate":
    case "exile":
    case "return":
    case "overthrown":
    case "identity":
      return "politics";
    case "leader":
    case "coup":
    case "vote":
    case "policy":
      return change.country === player ? "politics" : "world";
    case "crime":
      return change.by === player ? "politics" : "world";
    case "budget":
    case "funds":
    case "deal":
    case "research":
      return "economy";
    case "energy":
      return change.country === player ? "economy" : "world";
    case "atom":
      return (change.change === "strike" || change.change === "ladder") && (change.country === player || change.against === player) ? "army" : change.country === player ? "economy" : "world";
    case "stats":
      return change.country === player ? "economy" : "world";
    case "war":
    case "peace":
    case "truce":
    case "truce-ended":
    case "enter":
    case "captured":
      return "army";
    case "population":
      return change.country === player ? (atWar ? "army" : "politics") : "world";
    case "civilians":
      return change.country === player ? "army" : "world";
    case "mobilisation":
      return "politics";
    case "civil":
      // The player's own country's civil war is its army's story; recognition of its rebels its diplomacy's, which the report tells with the world.
      return change.country === player || change.rebels === player ? (change.change === "recognised" || change.change === "seat" ? "world" : "army") : "world";
    case "colony":
      // The player's own colonies are its politics, their wars its army's.
      return change.of === player ? (change.change === "rising" || change.change === "crushed" ? "army" : "politics") : "world";
    case "joint":
      // The player's joint actions: an offensive or an operation the army's, a programme or a project the economy's, the rest the world's.
      if (!change.members.includes(player)) return "world";
      return change.type === "offensive" || change.type === "operation" ? "army" : change.type === "project" || change.type === "research" || change.type === "space" || change.type === "atom" ? "economy" : "world";
    default:
      return "world";
  }
}

/** Map changes first, then politics, then the numbers. */
export function sortChanges(changes: AppliedChange[]): AppliedChange[] {
  const rank: Record<AppliedChange["kind"], number> = {
    overthrown: -2, rise: -1.9, fate: -1.95, approval: 18.15, exile: -1, return: -1, capitulation: 1.8, terms: 1.9, offer: 1.95, provisional: 0.2, "new-country": 0, war: 1, peace: 2, truce: 3, "truce-ended": 4, annex: 5, liberate: 6, occupy: 7, behind: 7.5, contest: 8, repel: 9, alliance: 10, invitation: 11, "alliance-ended": 12, leave: 13, "summit-planned": 14, election: 15, coup: 15.2, vote: 15.4, party: 16, protest: 16.5, plot: 17, leader: 18, official: 18.2, enter: 1.5, accession: 10.5, plan: 14.2, "plan-end": 14.3, incident: 14.15, policy: 14.25, accord: 14.35, sanction: 14.5, envoy: 14.4, deal: 14.6, funds: 14.7, law: 16.8, bill: 16.7, "order-lapsed": 16.75, identity: 0.5, budget: 18.3, population: 18.5, stats: 19, research: 18.25, captured: 14.8, intrigue: 18.1, cabinet: 18.16, repression: 16.6, movement: 16.65, proposals: 18.155,
    outcry: 1.6, session: 1.7, resolution: 1.75, pledge: 10.6, aid: 14.75, space: 14.9, crime: 16.55, case: 16.58, demand: 16.59, sport: 14.95, colony: 0.1, energy: 18.27, atom: 1.65, joint: 10.8,
    civil: 0.15, civilians: 18.45, mobilisation: 16.52, parliament: 15.1, ministry: 18.17,
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

"use client";

import { ArrowDownRight, ArrowUpRight, Briefcase, Check, ChevronDown, Clock, Gavel, Handshake, Landmark, Loader2, type LucideIcon, Megaphone, MessagesSquare, Plus, Shield, ShieldAlert, ShieldX, Siren, Tv, Unlock, Users, Vote } from "lucide-react";
import { type ReactNode, useId, useMemo, useState } from "react";
import { ui } from "@/components/ui/classes";
import DoneButton, { Hint } from "@/components/ui/DoneButton";
import { MAX_ORDERS } from "@/constants/app";
import { formatDate } from "@/engine/calendar";
import { LAW_IDS, LAWS, type LawId } from "@/engine/laws";
import { availableMotions, checkMotion, holdsElections, openSession, seatsNeeded } from "@/engine/parliament";
import { governmentSeats, loyaltyOf } from "@/engine/politics";
import { talksWith } from "@/engine/talks";
import { ownProtests } from "@/engine/unrest";
import { type GameState, type Loyalty, type Motion, type MotionKind, type Parliament, type Party, PILLARS, type Protest, type Session, type Talk } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import { plotTitle } from "./changes";
import { partyActions, type PoliticsAction } from "./politics/actions";
import { abbreviation, hemicycle, INNER, inkOn, partyColors, seatingOrder, spread } from "./politics/layout";
import { useMotionLabel } from "./politics/motion";
import { OilDefs, oilFills, oilFilter } from "./politics/oil";

interface PoliticsPanelProps {
  state: GameState;
  busy: { chars: number } | null;
  disabled: boolean;
  onLoad: () => void;
  /** Adds an order to the turn; moves here are orders the game master judges. */
  onOrder: (order: string) => void;
  /** A province's name in the interface language. */
  regionName: (id: string) => string;
  /** Opens a sitting of parliament on a motion (engine/parliament.ts). */
  onConvene: (motion: Motion) => void;
  /** Opens the sitting under way again. */
  onResumeSession: (id: string) => void;
  /** Opens talks with a protest's leaders or with plotters, or takes them up again (engine/talks.ts). */
  onTalks: (kind: Talk["with"], target: string) => void;
}

type Tab = "parliament" | "parties" | "street";

const STAGE_TONE: Record<Protest["stage"], string> = {
  rally: "bg-amber-50 text-amber-700",
  strike: "bg-amber-50 text-amber-700",
  riot: "bg-red-50 text-red-700",
  uprising: "bg-red-600 text-white",
};

const RISK_TONE = { low: "bg-emerald-500", medium: "bg-amber-500", high: "bg-red-600" } as const;

/** Above this many seats the hemicycle is drawn as wedges, not dots. */
const MAX_DOTS = 1000;

/** Measures against a protest at home; the risk of force follows the loyalty of whoever must use it. Talks are held in person. */
const HOME_MEASURES = ["concede", "disperse", "troops", "arrestLeaders", "counterRally", "curfew", "smearProtest", "offerElections", "offerPosts", "protestAmnesty"] as const;
const HOME_ICONS: Record<(typeof HOME_MEASURES)[number], PoliticsAction["icon"]> = {
  concede: Handshake,
  disperse: Shield,
  troops: Siren,
  arrestLeaders: Gavel,
  counterRally: Megaphone,
  curfew: Clock,
  smearProtest: Tv,
  offerElections: Vote,
  offerPosts: Briefcase,
  protestAmnesty: Unlock,
};
/** Open moves on a protest abroad. */
const ABROAD_MEASURES = [
  { id: "condemnCrackdown", icon: Megaphone, risk: "low" },
  { id: "backRegime", icon: Shield, risk: "medium" },
] as const satisfies readonly PoliticsAction[];

const riskOf = (loyalty: number): PoliticsAction["risk"] => (loyalty < 40 ? "high" : loyalty < 60 ? "medium" : "low");

/** An id safe inside url(#…). */
const safeId = (id: string) => id.replace(/[^a-zA-Z0-9-]/g, "");

/** The pillars of power, as bars with their change over the last turn. */
function Pillars({ loyalty, was }: { loyalty: Loyalty; was?: Loyalty }) {
  const { t } = useI18n();
  return (
    <section className="rounded-xl bg-page p-3">
      <div className={`${ui.label} mb-1`}>{t("politics.pillars")}</div>
      <p className="mb-2 text-2xs font-medium text-muted">{t("politics.pillarsHint")}</p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        {PILLARS.map((k) => {
          const v = loyalty[k];
          const d = was ? v - was[k] : 0;
          const tone = v < 25 ? "bg-red-600" : v < 40 ? "bg-amber-500" : v < 60 ? "bg-amber-300" : "bg-emerald-500";
          return (
            <div key={k}>
              <div className="flex items-baseline justify-between text-xs">
                <span className="font-bold text-ink">{t(`politics.pillar.${k}` as MessageKey)}</span>
                <span className="font-black tabular-nums text-ink">
                  {v}
                  {d !== 0 && <span className={`ml-1 text-2xs ${d > 0 ? "text-emerald-700" : "text-red-600"}`}>{d > 0 ? `+${d}` : d}</span>}
                </span>
              </div>
              <div className="relative mt-1 h-1.5 rounded-full bg-divider">
                <span className={`absolute inset-y-0 left-0 rounded-full ${tone}`} style={{ width: `${v}%` }} />
                <span className="absolute -inset-y-0.5 left-[25%] w-px bg-ink/30" />
                <span className="absolute -inset-y-0.5 left-[40%] w-px bg-ink/30" />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** A protest's figures in one line: size and its change, support, organisation, the dead, a sponsor. */
function ProtestFacts({ p, state, regionName }: { p: Protest; state: GameState; regionName: (id: string) => string }) {
  const { t, text, people } = useI18n();
  const facts = [
    `${t("politics.protest.size", { n: people(p.size) })}${p.grew ? ` (${p.grew > 0 ? "+" : "−"}${people(Math.abs(p.grew))})` : ""}`,
    p.support !== undefined && t("politics.protest.support", { n: p.support }),
    p.organisation !== undefined && t("politics.protest.organisation", { n: p.organisation }),
    p.killed ? t("politics.protest.killed", { n: p.killed }) : "",
    p.backer && t("politics.protest.backer", { country: text(state.countries[p.backer]?.name ?? p.backer) }),
    p.by,
    p.where.map(regionName).join(", "),
  ].filter(Boolean);
  return <div className="mt-0.5 text-xs font-medium text-muted">{facts.join(" · ")}</div>;
}

/** Moves that become orders: the turn's orders so far, whether there is room for one more, and the way to add it. */
interface Ordering {
  orders: Set<string>;
  full: boolean;
  disabled: boolean;
  order: (line: string) => boolean;
}

/** A small square control on a card, so the card's title keeps its width; its words show in a hint above the row it sits in (made `relative`). */
const SQUARE = "grid h-7 w-7 shrink-0 place-items-center rounded-lg border sheet transition-colors disabled:cursor-not-allowed disabled:border-line disabled:text-faded";

/** The button that opens talks, or takes them up again: a square, its words in a hint; filled while talks are under way. */
function TalksButton({ under, disabled, onClick, align }: { under: boolean; disabled: boolean; onClick: () => void; align?: "start" | "end" }) {
  const { t } = useI18n();
  const label = under ? t("politics.talk.resume") : t("politics.talk.open");
  return (
    <button type="button" disabled={disabled} onClick={onClick} aria-label={label} className={`group ${SQUARE} ${under ? "border-accent bg-accent/10 text-accent" : "border-accent/40 text-accent hover:bg-accent/10"}`}>
      <MessagesSquare className="h-3.5 w-3.5" />
      <Hint label={label} align={align} />
    </button>
  );
}

/** A move on a card that becomes an order: a square with its name and the order in a hint; once ordered, a tick and "In orders". */
function OrderSquare({ id, icon, line, ordering, align, tone = "text-muted hover:border-accent/40 hover:text-accent" }: { id: string; icon: LucideIcon; line: string; ordering: Ordering; align?: "start" | "end"; tone?: string }) {
  const { t } = useI18n();
  const done = ordering.orders.has(line);
  return (
    <DoneButton
      compact
      icon={icon}
      label={t(`politics.act.${id}` as MessageKey)}
      hint={ordering.full && !done ? t("game.orders.limit", { n: MAX_ORDERS }) : line}
      doneLabel={t("done.inOrders")}
      done={done}
      disabled={ordering.disabled || ordering.full}
      onAct={() => ordering.order(line)}
      align={align}
      className={`${SQUARE} border-line ${tone}`}
    />
  );
}

/**
 * The street and the forces that face it: the loyalty of the army, police,
 * security services and elites; the protests at home, with talks in person
 * and every other measure against them; protests abroad to condemn or back.
 */
function Street({ state, ordering, regionName, onTalks }: { state: GameState; ordering: Ordering; regionName: (id: string) => string; onTalks: (kind: Talk["with"], target: string) => void }) {
  const { t, text } = useI18n();
  const [open, setOpen] = useState<string | null>(null);
  const loyalty = state.politics ? loyaltyOf(state.politics) : null;
  const home = ownProtests(state.protests, state.player);
  const abroad = (state.protests ?? []).filter((p) => !home.includes(p));
  const row = (action: PoliticsAction, line: string) => (
    <ActionRow key={action.id} action={action} label={t(`politics.act.${action.id}` as MessageKey)} desc={t(`politics.desc.${action.id}` as MessageKey)} line={line} ordering={ordering} />
  );

  return (
    <div className="flex flex-col gap-4">
      {loyalty && <Pillars loyalty={loyalty} was={state.politics?.loyaltyWas} />}

      <section>
        <div className={`${ui.label} mb-2 flex items-center gap-1.5`}>
          <Megaphone className="h-3.5 w-3.5" />
          {t("politics.protests")}
        </div>
        {home.length === 0 ? (
          <p className="text-xs font-medium text-muted">{t("politics.noProtests")}</p>
        ) : (
          <ul className="grid gap-2">
            {home.map((p) => (
              <li key={p.id} className="rounded-xl border border-line sheet p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-black text-ink">{p.title}</div>
                    <ProtestFacts p={p} state={state} regionName={regionName} />
                  </div>
                  <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-2xs font-black uppercase tracking-wider ${STAGE_TONE[p.stage]}`}>{t(`politics.protest.${p.stage}` as MessageKey)}</span>
                </div>
                {p.demands && <p className="mt-1.5 text-xs font-medium text-ink">{t("politics.protest.demands", { demands: p.demands })}</p>}
                <div className="relative mt-2 flex flex-wrap items-center gap-1.5">
                  <TalksButton under={Boolean(talksWith(state.politics, p.id))} disabled={ordering.disabled} onClick={() => onTalks("protest", p.id)} align="start" />
                  {(["concede", "disperse", "troops"] as const).map((action) => (
                    <OrderSquare key={action} id={action} icon={HOME_ICONS[action]} line={t(`politics.order.${action}` as MessageKey, { title: p.title, demands: p.demands || "–" })} ordering={ordering} align="start" />
                  ))}
                  <button
                    type="button"
                    onClick={() => setOpen(open === p.id ? null : p.id)}
                    aria-expanded={open === p.id}
                    className="ml-auto inline-flex items-center gap-1 text-2xs font-black uppercase tracking-wider text-muted hover:text-ink"
                  >
                    {t("politics.protest.more")}
                    <ChevronDown className={`h-3 w-3 transition-transform ${open === p.id ? "rotate-180" : ""}`} />
                  </button>
                </div>
                {open === p.id && (
                  <div className="mt-2 grid gap-1.5">
                    {HOME_MEASURES.map((id) => {
                      const risk = id === "disperse" && loyalty ? riskOf(loyalty.police) : id === "troops" && loyalty ? (loyalty.army < 60 ? "high" : "medium") : (["concede", "offerElections", "protestAmnesty"] as string[]).includes(id) ? "low" : "medium";
                      return row({ id, icon: HOME_ICONS[id], risk }, t(`politics.order.${id}` as MessageKey, { title: p.title, demands: p.demands || "–" }));
                    })}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {abroad.length > 0 && (
        <section>
          <div className={`${ui.label} mb-2`}>{t("politics.abroad")}</div>
          <ul className="grid gap-2">
            {abroad.map((p) => {
              const country = text(state.countries[p.country!]?.name ?? p.country);
              return (
                <li key={p.id} className="rounded-xl border border-line sheet p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-black text-ink">{p.title}</div>
                      <div className="text-2xs font-black uppercase tracking-wider text-muted">{t("politics.abroadAgainst", { country })}</div>
                      <ProtestFacts p={p} state={state} regionName={regionName} />
                    </div>
                    <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-2xs font-black uppercase tracking-wider ${STAGE_TONE[p.stage]}`}>{t(`politics.protest.${p.stage}` as MessageKey)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(open === p.id ? null : p.id)}
                    aria-expanded={open === p.id}
                    className="mt-2 inline-flex items-center gap-1 text-2xs font-black uppercase tracking-wider text-muted hover:text-ink"
                  >
                    {t("politics.partyActions")}
                    <ChevronDown className={`h-3 w-3 transition-transform ${open === p.id ? "rotate-180" : ""}`} />
                  </button>
                  {open === p.id && <div className="mt-2 grid gap-1.5">{ABROAD_MEASURES.map((a) => row(a, t(`politics.order.${a.id}` as MessageKey, { title: p.title, country })))}</div>}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

/** The house as the press draws it, painted: a half ring of seats, one wedge per faction, left to right. */
function Hemicycle({ house, parties, colors, focus, onFocus }: { house: Parliament; parties: Party[]; colors: Map<string, string>; focus: string | null; onFocus: (id: string) => void }) {
  const { t } = useI18n();
  const id = `hemi-${safeId(useId())}`;
  const fills = useMemo(() => oilFills(id, colors), [id, colors]);
  const W = 320;
  const S = 150;
  const cx = W / 2;
  const cy = 166;
  const seated = seatingOrder(parties.filter((p) => (p.seats ?? 0) > 0));
  // Seat owners in order: each faction's seats, then the rest of the house.
  const owners: (Party | null)[] = seated.flatMap((p) => Array.from({ length: p.seats ?? 0 }, () => p));
  while (owners.length < house.seats) owners.push(null);
  const majority = Math.floor(house.seats / 2) + 1;
  const fill = (p: Party | null) => (p ? fills.get(p.id)! : "var(--divider)");
  const faded = (p: Party | null) => (focus && p?.id !== focus ? 0.28 : 1);

  let wedges: ReactNode = null;
  if (house.seats > MAX_DOTS) {
    // A wedge per faction on the ring.
    let from = 0;
    const groups = [...seated.map((p) => ({ p, n: p.seats ?? 0 })), { p: null, n: Math.max(0, house.seats - seated.reduce((s, p) => s + (p.seats ?? 0), 0)) }];
    wedges = groups.map(({ p, n }, i) => {
      if (n <= 0) return null;
      const a0 = Math.PI * (1 - from / house.seats);
      const a1 = Math.PI * (1 - (from + n) / house.seats);
      from += n;
      const pt = (a: number, r: number) => `${cx + Math.cos(a) * r * S},${cy - Math.sin(a) * r * S}`;
      const large = a0 - a1 > Math.PI ? 1 : 0;
      const d = `M${pt(a0, 1)} A${S},${S} 0 ${large} 1 ${pt(a1, 1)} L${pt(a1, INNER)} A${S * INNER},${S * INNER} 0 ${large} 0 ${pt(a0, INNER)} Z`;
      return <path key={p?.id ?? `rest-${i}`} d={d} fill={p ? colors.get(p.id) : "var(--divider)"} opacity={faded(p)} stroke="var(--surface)" strokeWidth="1" onClick={() => p && onFocus(p.id)} className={p ? "cursor-pointer" : ""} />;
    });
  }
  const dots = house.seats > MAX_DOTS ? [] : hemicycle(house.seats);

  return (
    <svg viewBox={`0 0 ${W} ${cy + 6}`} className="mx-auto block w-full max-w-[360px]" role="img" aria-label={`${house.name}: ${house.seats}`}>
      <OilDefs id={id} colors={colors} />
      {wedges && <g filter={oilFilter(id)}>{wedges}</g>}
      <g filter={oilFilter(id)}>
        {dots.map((d, i) => {
          const p = owners[i] ?? null;
          return (
            <circle key={i} cx={cx + d.x * S} cy={cy - d.y * S} r={d.r * S * 1.08} fill={fill(p)} opacity={faded(p)} onClick={() => p && onFocus(p.id)} className={p ? "cursor-pointer" : ""}>
              {p && <title>{`${p.name}: ${p.seats}`}</title>}
            </circle>
          );
        })}
      </g>
      {/* Half the house: a majority has to cross this line. */}
      <line x1={cx} y1={cy - S - 5} x2={cx} y2={cy - S * INNER + 3} stroke="var(--ink)" strokeWidth="1" strokeDasharray="2 2" opacity="0.5" />
      <text x={cx} y={cy - 26} textAnchor="middle" fontSize="28" className="fill-ink font-black tabular-nums">
        {house.seats}
      </text>
      <text x={cx} y={cy - 12} textAnchor="middle" fontSize="9" className="fill-muted font-bold uppercase" letterSpacing="0.08em">
        {t("politics.seatsTotal")}
      </text>
      <text x={cx} y={cy + 1} textAnchor="middle" fontSize="9" className="fill-muted font-bold">
        {t("politics.majorityNeeds", { n: majority })}
      </text>
    </svg>
  );
}

/** The government's seats against the line of a majority. */
function GovernmentBar({ house, parties, colors }: { house: Parliament; parties: Party[]; colors: Map<string, string> }) {
  const { t } = useI18n();
  const government = parties.filter((p) => (p.status === "ruling" || p.status === "coalition") && (p.seats ?? 0) > 0).sort((a, b) => (a.status === "ruling" ? -1 : 1) - (b.status === "ruling" ? -1 : 1));
  const held = governmentSeats({ parties });
  const majority = Math.floor(house.seats / 2) + 1;
  const ok = held >= majority;
  return (
    <div>
      <div className="relative h-3 overflow-hidden rounded-full bg-divider">
        <div className="flex h-full">
          {government.map((p) => (
            <span key={p.id} style={{ width: `${((p.seats ?? 0) / house.seats) * 100}%`, background: colors.get(p.id) }} />
          ))}
        </div>
        <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-ink" />
      </div>
      <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-2 text-xs font-bold">
        <span className="tabular-nums text-ink">{t("politics.govSeats", { held, total: house.seats })}</span>
        <span className={ok ? "text-emerald-700" : "text-amber-700"}>{ok ? t("politics.govMajority") : t("politics.govMinority", { n: majority - held })}</span>
      </div>
    </div>
  );
}

/** Where the parties stand, drawn so every circle and its letters stay readable; the circles painted like the house's seats. */
function IdeasCompass({ parties, colors, focus, onFocus }: { parties: Party[]; colors: Map<string, string>; focus: string | null; onFocus: (id: string) => void }) {
  const { t } = useI18n();
  const id = `ideas-${safeId(useId())}`;
  const fills = useMemo(() => oilFills(id, colors), [id, colors]);
  const [vertical, setVertical] = useState<"freedom" | "nation">("freedom");
  const size = 300;
  const pad = 18;
  const at = (v: number) => pad + ((v + 10) / 20) * (size - pad * 2);
  // Freedom (or nationalism) grows upwards.
  const y = (v: number) => size - at(v);
  const ordered = [...parties].sort((a, b) => b.support - a.support);
  const truth = ordered.map((p) => ({ x: at(p.stance.economy), y: y(p.stance[vertical]), r: 9 + Math.sqrt(Math.max(0, p.support)) * 2.3 }));
  const drawn = spread(truth, { min: pad, max: size - pad });
  const top = vertical === "freedom" ? t("politics.axis.liberal") : t("politics.axis.nationalist");
  const bottom = vertical === "freedom" ? t("politics.axis.authoritarian") : t("politics.axis.open");
  const label = { fontSize: 10, className: "fill-muted font-black uppercase", letterSpacing: "0.06em" } as const;
  return (
    <div>
      <div className="mb-2 grid grid-cols-2 gap-1 rounded-xl bg-page p-1">
        {(["freedom", "nation"] as const).map((v) => (
          <button key={v} type="button" onClick={() => setVertical(v)} className={`${ui.segment} ${vertical === v ? ui.segmentOn : ui.segmentOff}`}>
            {t(`politics.compass.${v}` as MessageKey)}
          </button>
        ))}
      </div>
      <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto block w-full max-w-[360px]" role="img" aria-label={t("politics.ideas")}>
        <OilDefs id={id} colors={colors} />
        <defs>
          <marker id={`${id}-drift`} viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0,0 L6,3 L0,6 z" fill="var(--muted)" />
          </marker>
          <clipPath id={`${id}-box`}>
            <rect x={pad} y={pad} width={size - pad * 2} height={size - pad * 2} rx="12" />
          </clipPath>
        </defs>
        <rect x={pad} y={pad} width={size - pad * 2} height={size - pad * 2} rx="12" fill="var(--page)" />
        <g clipPath={`url(#${id}-box)`} fill="var(--divider)" opacity="0.45">
          <rect x={pad} y={pad} width={size / 2 - pad} height={size / 2 - pad} />
          <rect x={size / 2} y={size / 2} width={size / 2 - pad} height={size / 2 - pad} />
        </g>
        <rect x={pad} y={pad} width={size - pad * 2} height={size - pad * 2} rx="12" fill="none" stroke="var(--line)" />
        <line x1={size / 2} y1={pad} x2={size / 2} y2={size - pad} stroke="var(--line)" />
        <line x1={pad} y1={size / 2} x2={size - pad} y2={size / 2} stroke="var(--line)" />
        <text x={pad + 6} y={size / 2 - 6} {...label}>{t("politics.axis.left")}</text>
        <text x={size - pad - 6} y={size / 2 - 6} textAnchor="end" {...label}>{t("politics.axis.right")}</text>
        <text x={size / 2} y={pad + 13} textAnchor="middle" {...label}>{top}</text>
        <text x={size / 2} y={size - pad - 6} textAnchor="middle" {...label}>{bottom}</text>
        {ordered.map((p) => {
          const was = p.was;
          if (!was || (was.economy === p.stance.economy && was[vertical] === p.stance[vertical])) return null;
          return <line key={`d-${p.id}`} x1={at(was.economy)} y1={y(was[vertical])} x2={at(p.stance.economy)} y2={y(p.stance[vertical])} stroke="var(--muted)" strokeWidth="1.2" strokeDasharray="3 2" markerEnd={`url(#${id}-drift)`} />;
        })}
        {ordered.map((p, i) => {
          const { x: tx, y: ty, r } = truth[i];
          const { x, y: dy } = drawn[i];
          const color = colors.get(p.id)!;
          const text = abbreviation(p);
          const font = Math.max(7, Math.min(13, r * 0.8, (2 * r - 5) / (text.length * 0.74)));
          const dim = focus && focus !== p.id ? 0.35 : 1;
          return (
            <g key={p.id} opacity={dim} onClick={() => onFocus(p.id)} className="cursor-pointer">
              <title>{`${p.name} · ${p.support}%`}</title>
              {Math.hypot(x - tx, dy - ty) > 3 && (
                <>
                  <line x1={tx} y1={ty} x2={x} y2={dy} stroke={color} strokeWidth="1" />
                  <circle cx={tx} cy={ty} r="2" fill={color} />
                </>
              )}
              <circle cx={x} cy={dy} r={r} fill={fills.get(p.id)} filter={oilFilter(id)} stroke={focus === p.id ? "var(--ink)" : "var(--surface)"} strokeWidth={focus === p.id ? 2.5 : 1.5} />
              <text x={x} y={dy + font * 0.36} textAnchor="middle" fontSize={font} fontWeight="900" fill={inkOn(color)}>
                {text}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** One thing the government can do: what it gives, what it risks, and the button that orders it – "In orders" once it is. */
function ActionRow({ action, label, desc, line, ordering }: { action: PoliticsAction; label: string; desc: string; line: string; ordering: Ordering }) {
  const { t } = useI18n();
  const Icon = action.icon;
  const done = ordering.orders.has(line);
  return (
    <div className="rounded-xl border border-line sheet p-2.5">
      <div className="flex items-start gap-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-page text-muted">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-black text-ink">{label}</div>
          <p className="mt-0.5 text-xs font-medium leading-snug text-muted">{desc}</p>
          <div className="relative mt-1.5 flex flex-wrap items-center justify-between gap-1.5">
            <span className="inline-flex items-center gap-1 text-2xs font-bold text-muted">
              <span className={`h-1.5 w-1.5 rounded-full ${RISK_TONE[action.risk]}`} />
              {t(`politics.risk.${action.risk}` as MessageKey)}
            </span>
            <DoneButton
              icon={Plus}
              label={t("politics.add")}
              doneLabel={t("done.inOrders")}
              done={done}
              disabled={ordering.disabled || ordering.full}
              hint={ordering.full && !done ? t("game.orders.limit", { n: MAX_ORDERS }) : undefined}
              onAct={() => ordering.order(line)}
              className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-2xs font-black uppercase tracking-wider text-ink transition-colors hover:border-accent/40 hover:text-accent disabled:cursor-not-allowed disabled:text-faded"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/** A small mark of where a party stands on one axis, and where it stood a turn ago. */
function AxisBar({ name, left, right, value, was, color }: { name: string; left: string; right: string; value: number; was?: number; color: string }) {
  const pos = (v: number) => `${((v + 10) / 20) * 100}%`;
  return (
    <div>
      <div className="flex items-baseline justify-between text-2xs font-bold text-muted">
        <span>{left}</span>
        <span className="font-black text-ink">{name}</span>
        <span>{right}</span>
      </div>
      <div className="relative mt-1 h-1.5 rounded-full bg-divider">
        <span className="absolute inset-y-0 left-1/2 w-px bg-line" />
        {was !== undefined && was !== value && <span className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-muted sheet" style={{ left: pos(was) }} />}
        <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface" style={{ left: pos(value), background: color }} />
      </div>
    </div>
  );
}

/**
 * A new sitting: what parliament is to vote on, a bill unless the player
 * picks otherwise. A change of one law is chosen from the law's options; a
 * bill or an amendment is written; the motions of state need nothing more.
 * The seats it needs show before it opens.
 */
function MotionForm({ state, disabled, onConvene }: { state: GameState; disabled: boolean; onConvene: (motion: Motion) => void }) {
  const { t } = useI18n();
  const kinds = availableMotions(state);
  const laws = state.politics?.laws;
  const [kind, setKind] = useState<MotionKind>(kinds[0] ?? "bill");
  const [law, setLaw] = useState<LawId>("press");
  const options = (LAWS[law] as readonly string[]).filter((o) => o !== laws?.[law]);
  const [option, setOption] = useState<string>("");
  const [text, setText] = useState("");
  const picked = options.includes(option) ? option : (options[0] ?? "");
  const motion: Motion = kind === "law" ? { kind, text, law, option: picked } : { kind, text };
  const valid = checkMotion(state, motion) !== null;
  const house = state.politics?.parliament;
  if (!kinds.length || !house) return null;
  return (
    <section className="grid gap-2 rounded-xl border border-line sheet p-3">
      <div className={ui.label}>{t("politics.session.new")}</div>
      <select value={kind} onChange={(e) => setKind(e.target.value as MotionKind)} aria-label={t("politics.session.motion")} className={`${ui.input} py-2 text-xs`}>
        {kinds.map((k) => (
          <option key={k} value={k}>
            {t(`politics.motion.${k}` as MessageKey)}
          </option>
        ))}
      </select>
      {kind === "law" && (
        <div className="grid grid-cols-2 gap-1.5">
          <select value={law} onChange={(e) => setLaw(e.target.value as LawId)} aria-label={t("politics.session.law")} className={`${ui.input} py-2 text-xs`}>
            {LAW_IDS.map((id) => (
              <option key={id} value={id}>
                {t(`law.${id}` as MessageKey)}
              </option>
            ))}
          </select>
          <select value={picked} onChange={(e) => setOption(e.target.value)} aria-label={t("politics.session.option")} className={`${ui.input} py-2 text-xs`}>
            {options.map((o) => (
              <option key={o} value={o}>
                {t(`law.${law}.${o}` as MessageKey)}
              </option>
            ))}
          </select>
        </div>
      )}
      {(kind === "law" || kind === "bill" || kind === "constitution") && (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 600))}
          rows={2}
          placeholder={t(`politics.session.text.${kind}` as MessageKey)}
          className={`${ui.input} resize-none py-2 text-xs`}
        />
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="text-2xs font-bold tabular-nums text-muted">{t("politics.session.needs", { n: seatsNeeded(kind, house.seats), total: house.seats })}</span>
        <button type="button" disabled={disabled || !valid} onClick={() => onConvene(motion)} className={`${ui.primary} px-3 py-2 text-2xs`}>
          <Landmark className="h-3.5 w-3.5" />
          {t("politics.session.open")}
        </button>
      </div>
    </section>
  );
}

/** The sittings already held: what was voted on and how. */
function RecentSessions({ sessions }: { sessions: Session[] }) {
  const { t } = useI18n();
  const label = useMotionLabel();
  if (!sessions.length) return null;
  return (
    <section>
      <div className={`${ui.label} mb-2`}>{t("politics.session.recent")}</div>
      <ul className="grid gap-1.5">
        {sessions.map((s) => (
          <li key={s.id} className="rounded-lg bg-page px-3 py-2">
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0 text-xs font-bold leading-snug text-ink">{label(s.motion)}</span>
              <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-2xs font-black uppercase tracking-wider ${s.status === "passed" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                {t(s.status === "passed" ? "politics.session.passed" : "politics.session.failed")}
              </span>
            </div>
            {s.vote && <div className="mt-0.5 text-2xs font-bold tabular-nums text-muted">{t("politics.session.tally", { for: s.vote.for, against: s.vote.against, abstain: s.vote.abstain })}</div>}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The player's domestic politics: the regime, the elections and the
 * government's majority; parliament seat by seat, where the government
 * brings motions to sittings and speaks; every party with its support and
 * ideas; and the threats in the street and in the shadows, with talks in
 * person. The other moves become orders the game master judges.
 */
export default function PoliticsPanel({ state, busy, disabled, onLoad, onOrder, regionName, onConvene, onResumeSession, onTalks }: PoliticsPanelProps) {
  const { t, text, locale } = useI18n();
  const politics = state.politics;
  const [tab, setTab] = useState<Tab>("parliament");
  const [focus, setFocus] = useState<string | null>(null);
  const label = useMotionLabel();
  const orders = useMemo(() => new Set([...state.draft, ...(state.standing ?? [])]), [state.draft, state.standing]);
  const full = state.draft.length + (state.standing?.length ?? 0) >= MAX_ORDERS;
  // Each move answers on its own button ("In orders"); once the turn is full the buttons say why they are off.
  const ordering: Ordering = {
    orders,
    full,
    disabled,
    order: (line) => {
      if (orders.has(line) || full) return false;
      onOrder(line);
      return true;
    },
  };

  const parties = useMemo(() => [...(politics?.parties ?? [])].sort((a, b) => (b.seats ?? -1) - (a.seats ?? -1) || b.support - a.support), [politics?.parties]);
  const colors = useMemo(() => partyColors(parties), [parties]);
  const house = politics?.parliament;
  const held = politics ? governmentSeats(politics) : 0;
  const majority = house ? Math.floor(house.seats / 2) + 1 : 0;
  const plots = politics?.plots.filter((p) => p.known) ?? [];
  const threats = ownProtests(state.protests, state.player).length + plots.length;
  const elections = holdsElections(state);
  const sitting = openSession(politics);
  const pastSessions = (politics?.sessions ?? []).filter((s) => s.status !== "open").slice(-4).reverse();
  const loadButton = (
    <button type="button" onClick={onLoad} disabled={disabled || Boolean(busy)} className={`${ui.primary} w-full px-4 py-3 text-xs`}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Landmark className="h-4 w-4" />}
      {busy ? t("politics.loading") : t("politics.load")}
      {busy && busy.chars > 0 && <span className="tabular-nums">· {busy.chars}</span>}
    </button>
  );
  const focusParty = (id: string) => {
    setFocus((f) => (f === id ? null : id));
    setTab("parties");
  };
  const partyOrder = (action: PoliticsAction, party: Party) => {
    const line = t(`politics.order.${action.id}` as MessageKey, { party: party.name });
    return action.id === "arrest" && party.leader ? `${line} (${party.leader})` : line;
  };

  const tabs: { id: Tab; icon: typeof Landmark; badge?: number }[] = [
    { id: "parliament", icon: Landmark },
    { id: "parties", icon: Users },
    { id: "street", icon: ShieldAlert, badge: threats },
  ];

  return (
    <div className="flex flex-col gap-3">
      <section className="rounded-xl bg-page p-3">
        <div className={ui.label}>{t("politics.regime")}</div>
        <div className="mt-1 text-sm font-black leading-snug text-ink">{politics?.regime || text(state.countries[state.player]?.government)}</div>
        <div className="mt-3 grid grid-cols-2 gap-1.5">
          <div className="min-w-0 rounded-lg border border-line sheet p-2" title={elections ? undefined : t("politics.noElectionsNote")}>
            <div className="truncate text-2xs font-bold text-muted">{t("politics.electionTile")}</div>
            <div className="mt-0.5 text-xs font-black leading-tight text-ink">
              {!elections ? t("politics.noElections") : politics?.nextElection ? formatDate(politics.nextElection, locale) : "–"}
            </div>
          </div>
          <div className="min-w-0 rounded-lg border border-line sheet p-2">
            <div className="truncate text-2xs font-bold text-muted">{t("politics.majorityTile")}</div>
            {house ? (
              <div className={`mt-0.5 flex items-center gap-1 text-sm font-black tabular-nums ${held >= majority ? "text-emerald-700" : "text-amber-700"}`}>
                {held}/{majority}
                {held >= majority && <Check className="h-3.5 w-3.5" />}
              </div>
            ) : (
              <div className="mt-0.5 text-sm font-black text-muted">–</div>
            )}
          </div>
        </div>
        {!elections && <p className="mt-2 text-2xs font-medium text-muted">{t("politics.noElectionsNote")}</p>}
      </section>

      {parties.length === 0 && (
        <section className="flex flex-col gap-2 rounded-xl border-2 border-dashed border-line p-3">
          <p className="text-xs font-medium text-muted">{t("politics.loadNote")}</p>
          {loadButton}
        </section>
      )}

      <div className="grid grid-cols-3 gap-1 rounded-xl bg-page p-1">
        {tabs.map(({ id, icon: Icon, badge }) => (
          <button key={id} type="button" onClick={() => setTab(id)} aria-pressed={tab === id} className={`${ui.segment} ${tab === id ? ui.segmentOn : ui.segmentOff} relative flex flex-col items-center gap-0.5 px-1`}>
            <Icon className="h-3.5 w-3.5" />
            <span className="truncate text-2xs">{t(`politics.tab.${id}` as MessageKey)}</span>
            {badge ? <span className="absolute right-1 top-1 min-w-4 rounded-full bg-red-600 px-1 text-center text-[9px] font-black leading-4 text-white">{badge}</span> : null}
          </button>
        ))}
      </div>

      {tab === "parliament" && (
        <div className="flex flex-col gap-3">
          {house ? (
            <section className="rounded-xl border border-line sheet p-3">
              <div className="mb-1 text-sm font-black text-ink">{house.name}</div>
              <Hemicycle house={house} parties={parties} colors={colors} focus={focus} onFocus={focusParty} />
              <div className="mt-2">
                <GovernmentBar house={house} parties={parties} colors={colors} />
              </div>
            </section>
          ) : (
            parties.length > 0 && <p className="rounded-xl bg-page px-3 py-2 text-xs font-medium text-muted">{t("politics.noSitting")}</p>
          )}
          {house && sitting && (
            <section className="flex items-center justify-between gap-2 rounded-xl border border-accent/40 sheet p-3">
              <div className="min-w-0">
                <div className={ui.label}>{t("politics.session.under")}</div>
                <div className="mt-0.5 text-xs font-bold leading-snug text-ink">{label(sitting.motion)}</div>
              </div>
              <button type="button" onClick={() => onResumeSession(sitting.id)} className={`${ui.primary} shrink-0 px-3 py-2 text-2xs`}>
                {t("politics.session.resume")}
              </button>
            </section>
          )}
          {house && !sitting && parties.length > 0 && <MotionForm state={state} disabled={disabled} onConvene={onConvene} />}
          {parties.length > 0 && (
            <ul className="flex flex-col gap-0.5">
              {parties.map((p) => {
                const gov = p.status === "ruling" || p.status === "coalition";
                return (
                  <li key={p.id} className="min-w-0">
                    <button type="button" onClick={() => focusParty(p.id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-page">
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: colors.get(p.id) }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-black text-ink">{p.name}</span>
                        <span className={`text-2xs font-bold uppercase tracking-wider ${gov ? "text-emerald-700" : p.status === "banned" || p.status === "underground" ? "text-red-600" : "text-muted"}`}>
                          {t(`politics.status.${p.status}` as MessageKey)}
                        </span>
                      </span>
                      {house && <span className="w-10 shrink-0 text-right text-sm font-black tabular-nums text-ink">{p.seats ?? "–"}</span>}
                      <span className="w-10 shrink-0 text-right text-xs font-bold tabular-nums text-muted">{p.support}%</span>
                    </button>
                  </li>
                );
              })}
              {house && house.seats > parties.reduce((s, p) => s + (p.seats ?? 0), 0) && (
                <li className="flex items-center gap-2 px-2 py-1.5">
                  <span className="h-3 w-3 shrink-0 rounded-full bg-divider" />
                  <span className="min-w-0 flex-1 truncate text-xs font-bold text-muted">{t("politics.others")}</span>
                  <span className="w-10 shrink-0 text-right text-sm font-black tabular-nums text-muted">{house.seats - parties.reduce((s, p) => s + (p.seats ?? 0), 0)}</span>
                  <span className="w-10 shrink-0" />
                </li>
              )}
            </ul>
          )}
          <RecentSessions sessions={pastSessions} />
          {elections && politics?.lastElection && (
            <section>
              <div className={`${ui.label} mb-2`}>{t("politics.lastElection", { date: formatDate(politics.lastElection.date, locale) })}</div>
              <ul className="flex flex-col gap-1">
                {politics.lastElection.results.map((r) => (
                  <li key={r.party} className="flex items-center justify-between gap-2 rounded-lg bg-page px-3 py-1.5 text-xs font-bold text-ink">
                    <span className="min-w-0 truncate">{r.party}</span>
                    <span className="shrink-0 tabular-nums">
                      {r.share}%{r.seats !== undefined && <span className="ml-2 text-muted">{t("politics.seatsN", { n: r.seats })}</span>}
                    </span>
                  </li>
                ))}
              </ul>
              {politics.lastElection.note && <p className="mt-1.5 text-xs font-medium text-muted">{politics.lastElection.note}</p>}
            </section>
          )}
        </div>
      )}

      {tab === "parties" && parties.length > 0 && (
        <div className="flex flex-col gap-3">
          <IdeasCompass parties={parties} colors={colors} focus={focus} onFocus={(id) => setFocus((f) => (f === id ? null : id))} />
          <ul className="flex flex-col gap-2">
            {parties.map((p) => {
              const color = colors.get(p.id)!;
              const open = focus === p.id;
              const gov = p.status === "ruling" || p.status === "coalition";
              const outlawed = p.status === "banned" || p.status === "underground";
              return (
                <li key={p.id} className={`overflow-hidden rounded-xl border sheet ${open ? "border-accent/40 shadow-sm" : "border-line"}`} style={{ borderLeftWidth: 4, borderLeftColor: color }}>
                  <button type="button" onClick={() => setFocus(open ? null : p.id)} aria-expanded={open} className="block w-full p-3 text-left">
                    <div className="flex items-start gap-2.5">
                      <span className="grid h-9 min-w-9 shrink-0 place-items-center rounded-lg px-1 text-2xs font-black" style={{ background: color, color: inkOn(color) }}>
                        {abbreviation(p)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-black leading-tight text-ink">{p.name}</div>
                        <div className="mt-0.5 truncate text-xs font-medium text-muted">{[p.leader, p.ideology].filter(Boolean).join(" · ")}</div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-base font-black tabular-nums text-ink">{p.support}%</div>
                        {p.trend ? (
                          <div className={`flex items-center justify-end text-2xs font-black tabular-nums ${p.trend > 0 ? "text-emerald-700" : "text-red-600"}`}>
                            {p.trend > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                            {p.trend > 0 ? "+" : ""}
                            {p.trend}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className={`rounded-md px-1.5 py-0.5 text-2xs font-black uppercase tracking-wider ${gov ? "bg-emerald-50 text-emerald-700" : outlawed ? "bg-red-50 text-red-700" : "bg-page text-muted"}`}>
                        {t(`politics.status.${p.status}` as MessageKey)}
                      </span>
                      {p.seats !== undefined && house && <span className="text-2xs font-bold tabular-nums text-muted">{t("politics.seatsN", { n: p.seats })}</span>}
                      <span className="ml-auto flex items-center gap-1 text-2xs font-black uppercase tracking-wider text-muted">
                        {t("politics.partyActions")}
                        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
                      </span>
                    </div>
                  </button>
                  {open && (
                    <div className="flex flex-col gap-3 border-t border-divider p-3">
                      <div className="grid gap-2.5">
                        <AxisBar name={t("politics.axisName.economy")} left={t("politics.axis.left")} right={t("politics.axis.right")} value={p.stance.economy} was={p.was?.economy} color={color} />
                        <AxisBar name={t("politics.axisName.freedom")} left={t("politics.axis.authoritarian")} right={t("politics.axis.liberal")} value={p.stance.freedom} was={p.was?.freedom} color={color} />
                        <AxisBar name={t("politics.axisName.nation")} left={t("politics.axis.open")} right={t("politics.axis.nationalist")} value={p.stance.nation} was={p.was?.nation} color={color} />
                      </div>
                      <div className="grid gap-1.5">
                        {partyActions(p).map((action) => (
                          <ActionRow
                            key={action.id}
                            action={action}
                            label={t(`politics.act.${action.id}` as MessageKey)}
                            desc={t(`politics.desc.${action.id}` as MessageKey)}
                            line={partyOrder(action, p)}
                            ordering={ordering}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {tab === "parties" && parties.length === 0 && <p className="text-xs font-medium text-muted">{t("politics.loadNote")}</p>}

      {tab === "street" && (
        <div className="flex flex-col gap-4">
          <Street state={state} ordering={ordering} regionName={regionName} onTalks={onTalks} />
          <section>
            <div className={`${ui.label} mb-2`}>{t("politics.plots")}</div>
            {plots.length === 0 ? (
              <p className="text-xs font-medium text-muted">{t("politics.noPlots")}</p>
            ) : (
              <ul className="grid gap-2">
                {plots.map((p) => (
                  <li key={p.id} className="rounded-xl bg-red-50/60 p-3">
                    {/* The title and who is behind it across the card; its strength and the two moves on a row below. */}
                    <div className="text-sm font-black leading-snug text-ink">{plotTitle(p, t)}</div>
                    {p.by && <div className="mt-0.5 text-xs font-medium text-muted">{p.by}</div>}
                    <div className="relative mt-2 flex items-center gap-1.5">
                      <div className="mr-1 h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-divider">
                        <div className="h-full rounded-full bg-red-600" style={{ width: `${p.strength}%` }} />
                      </div>
                      <TalksButton under={Boolean(talksWith(politics, p.id))} disabled={disabled} onClick={() => onTalks("plot", p.id)} />
                      <OrderSquare id="foil" icon={ShieldX} line={t("politics.order.foil", { title: plotTitle(p, t) })} ordering={ordering} tone="text-red-700 hover:border-red-300" />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

"use client";

import Dictation from "@/components/voice/Dictation";
import { Eye, FlaskConical, Send, Swords, X } from "lucide-react";
import { useState } from "react";
import Flag from "@/components/Flag";
import { ui } from "@/components/ui/classes";
import { ADVISOR_TITLES } from "@/engine/advisors";
import { formatDate } from "@/engine/calendar";
import { ministryOf } from "@/engine/figures";
import { dressing, homeView, type HomeFigure, type Seen } from "@/engine/official";
import { accessTo, canPropose, MAX_PROPOSALS, PROPOSAL_CHARS, proposalChance } from "@/engine/remit";
import { breakthroughOf } from "@/engine/research";
import { RESEARCH_DIRECTIONS, type GameState, type RoleArea } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import { researchLabel } from "./armsText";
import { playerWars, sidesOf } from "./army/common";

/**
 * What a role that does not govern a part of the state sees of it
 * (engine/remit.ts, engine/official.ts): a note on why it only reads here,
 * the figures as the role knows them – the official ones, an estimate or a
 * secret, each marked – and, for a minister or a general, the way to put a
 * proposal to the leader. No button here does the government's work.
 */

const LABEL: Record<HomeFigure, MessageKey> = {
  gdp: "economy.gdp",
  growth: "econ.growthLine",
  inflation: "economy.inflation",
  unemployment: "economy.unemployment",
  debt: "econ.debtLine",
  reserves: "econ.reservesLine",
  balance: "economy.budget",
  troops: "economy.troops",
  unrest: "politics.unrest",
};

/** Why the role only reads this part of the state, and how it knows what it sees. */
export function ReadOnlyNote({ state, area }: { state: GameState; area: RoleArea }) {
  const { t, text } = useI18n();
  const role = state.role;
  if (!role || role.kind === "leader") return null;
  const ministry = role.kind === "minister" && role.post ? ministryOf(role.post) : undefined;
  const d = role.kind === "opposition" ? dressing(state) : 0;
  const body =
    role.kind === "opposition"
      ? t("remit.read.opposition", { how: t(d <= 0 ? "remit.dress.none" : d < 0.4 ? "remit.dress.some" : "remit.dress.heavy") })
      : role.kind === "general"
        ? t("remit.read.general")
        : t("remit.read.minister", { post: ministry ? text(ADVISOR_TITLES[ministry]) : t("remit.ministry") });
  return (
    <section className="flex gap-2 rounded-xl border border-dashed border-line px-3 py-2.5">
      <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" />
      <div className="min-w-0">
        <div className={ui.label}>{t(`remit.readTitle.${area}` as MessageKey)}</div>
        <p className="mt-0.5 text-2xs font-medium leading-snug text-muted">{body}</p>
      </div>
    </section>
  );
}

/** One figure as the role knows it: the value, a mark for how it is known, and the range or the rumour. */
function FigureRow({ k, seen }: { k: HomeFigure; seen: Seen }) {
  const { t, money, moneyFine, people, locale } = useI18n();
  const fmt = (n: number) =>
    k === "gdp" || k === "debt" || k === "reserves"
      ? moneyFine(n)
      : k === "balance"
        ? `${n < 0 ? "−" : "+"}${money(Math.abs(n))}`
        : k === "troops"
          ? people(n)
          : k === "unrest"
            ? `${Math.round(n)}/100`
            : `${n.toLocaleString(locale, { maximumFractionDigits: 1 })}%`;
  const value = seen.value === undefined ? "–" : `${seen.sight === "estimated" ? "≈ " : ""}${fmt(seen.value)}`;
  const range = (low: number, high: number) => `${fmt(low)} – ${fmt(high)}`;
  return (
    <li className="grid gap-0.5 rounded-lg bg-page px-3 py-2">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="min-w-0 font-bold text-muted">{t(LABEL[k])}</span>
        <span className="flex shrink-0 items-baseline gap-1.5">
          <span className="font-black tabular-nums text-ink">{value}</span>
          {seen.sight !== "true" && <span className="rounded-md sheet px-1.5 py-0.5 text-[9.5px] font-black uppercase tracking-wider text-muted">{t(`sight.mark.${seen.sight}` as MessageKey)}</span>}
        </span>
      </div>
      {seen.sight === "estimated" && seen.low !== undefined && seen.high !== undefined && <div className="text-right text-2xs font-bold tabular-nums text-muted">{t("sight.range", { range: range(seen.low, seen.high) })}</div>}
      {seen.rumour && <div className="text-right text-2xs font-bold tabular-nums text-muted">{t("sight.rumour", { range: range(seen.rumour.low, seen.rumour.high) })}</div>}
    </li>
  );
}

/** The figures of the player's own country the role knows, among these. */
export function SeenFigures({ state, keys }: { state: GameState; keys: readonly HomeFigure[] }) {
  const view = homeView(state);
  return (
    <ul className="grid gap-1">
      {keys.map((k) => (
        <FigureRow key={k} k={k} seen={view[k]} />
      ))}
    </ul>
  );
}

/** A minister's or a general's proposals to the leader on this part of the state: the ones put, and a new one. */
export function ProposalBox({ state, area, disabled, onPropose, onWithdraw }: { state: GameState; area: RoleArea; disabled: boolean; onPropose: (text: string, area: RoleArea) => void; onWithdraw: (id: string) => void }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState("");
  if (!canPropose(state, area)) return null;
  const pending = state.role?.proposals ?? [];
  const full = pending.length >= MAX_PROPOSALS;
  const chance = Math.round(proposalChance(state, area) * 100);
  return (
    <section className={`${ui.card} grid gap-2 p-3`}>
      <div className={`${ui.label} flex items-center gap-1.5`}>
        <Send className="h-3.5 w-3.5" />
        {t("proposal.title")}
      </div>
      <p className="text-2xs font-medium leading-snug text-muted">{t("proposal.hint", { n: chance })}</p>
      {area === "politics" && accessTo(state, "politics") === "govern" && <p className="text-2xs font-medium leading-snug text-muted">{t("proposal.stateMotions")}</p>}
      {pending.length > 0 && (
        <ul className="grid gap-1">
          {pending.map((p) => (
            <li key={p.id} className="flex items-start gap-2 rounded-lg bg-page px-3 py-2">
              <span className="min-w-0 flex-1 text-xs font-medium leading-snug text-ink">
                {p.text}
                <span className="ml-1.5 text-2xs font-black uppercase tracking-wider text-muted">{t(`game.tab.${p.area}` as MessageKey)}</span>
              </span>
              <button type="button" disabled={disabled} onClick={() => onWithdraw(p.id)} title={t("proposal.withdraw")} aria-label={t("proposal.withdraw")} className="shrink-0 rounded-md p-0.5 text-muted hover:text-red-600 disabled:opacity-50">
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Dictation id="proposal" set={setDraft} max={PROPOSAL_CHARS}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, PROPOSAL_CHARS))}
          rows={2}
          disabled={disabled || full}
          placeholder={t(`proposal.placeholder.${area}` as MessageKey)}
          aria-label={t("proposal.title")}
          className={`${ui.input} resize-none py-2 text-xs`}
        />
      </Dictation>
      <div className="flex items-center justify-between gap-2">
        <span className="text-2xs font-bold text-muted">{full ? t("proposal.full", { n: MAX_PROPOSALS }) : t("proposal.when")}</span>
        <button
          type="button"
          disabled={disabled || full || draft.trim().length < 3}
          onClick={() => {
            onPropose(draft, area);
            setDraft("");
          }}
          className={`${ui.primary} shrink-0 px-3 py-2 text-2xs`}
        >
          <Send className="h-3.5 w-3.5" />
          {t("proposal.send")}
        </button>
      </div>
    </section>
  );
}

/** The wars the country fights, as anyone can read them in the papers: who against whom, and since when. */
function Wars({ state }: { state: GameState }) {
  const { t, text, locale } = useI18n();
  const wars = playerWars(state);
  return (
    <section>
      <div className={`${ui.label} mb-2 flex items-center gap-1.5`}>
        <Swords className="h-3.5 w-3.5" />
        {t("foreign.section.wars")}
      </div>
      {wars.length === 0 ? (
        <p className="text-xs font-medium text-muted">{t("foreign.noWars")}</p>
      ) : (
        <ul className="grid gap-1.5">
          {wars.map((w) => {
            const { theirs } = sidesOf(state, w);
            return (
              <li key={w.id} className="rounded-lg bg-page px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 text-xs font-black leading-snug text-ink">{text(w.name)}</span>
                  {w.truce && <span className="shrink-0 text-2xs font-black uppercase tracking-wider text-amber-700">{t("foreign.truceUntil", { date: formatDate(w.truce.until, locale) })}</span>}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  {theirs.slice(0, 8).map((tag) => (
                    <Flag key={tag} tag={tag} scenario={state.scenarioId} color={state.countries[tag]?.color} size="sm" />
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Research as the role knows it: the cabinet's split of the money, roughly, for those inside; the breakthroughs announced, for everyone (the opposition hears nothing of the weapons). */
function Research({ state }: { state: GameState }) {
  const { t, text } = useI18n();
  const inside = state.role?.kind === "minister" || state.role?.kind === "general";
  const shares = state.research?.shares;
  const done = [...(state.research?.done ?? [])].reverse().filter((d) => inside || !["military", "strategic"].includes(breakthroughOf(d.id)?.direction ?? ""));
  return (
    <>
      {inside && shares && (
        <section>
          <div className={`${ui.label} mb-2 flex items-center gap-1.5`}>
            <FlaskConical className="h-3.5 w-3.5" />
            {t("sight.research.shares")}
          </div>
          <ul className="grid gap-1">
            {RESEARCH_DIRECTIONS.map((d) => (
              <li key={d} className="flex items-baseline justify-between gap-2 rounded-lg bg-page px-3 py-1.5 text-xs">
                <span className="font-bold text-muted">{t(`research.dir.${d}` as MessageKey)}</span>
                <span className="font-black tabular-nums text-ink">≈ {Math.round((shares[d] ?? 0) / 5) * 5}%</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <div className={`${ui.label} mb-1.5`}>{t(inside ? "research.done" : "sight.research.announced")}</div>
        {done.length === 0 ? (
          <p className="text-xs font-medium text-muted">{t("research.noneDone")}</p>
        ) : (
          <ul className="flex flex-col gap-1 text-xs font-medium text-ink">
            {done.map((d) => (
              <li key={`${d.id}:${d.date}`} className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 flex-1">{researchLabel(d.id, t, text)}</span>
                <span className="shrink-0 text-2xs font-bold tabular-nums text-muted">{d.date.slice(0, 7)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

const ECONOMY: readonly HomeFigure[] = ["gdp", "growth", "inflation", "unemployment", "debt", "reserves", "balance"];

/** A part of the state the role only reads: the economy, the army or research, as it knows them, and a proposal to the leader. */
export default function RoleView({
  state,
  area,
  disabled,
  onPropose,
  onWithdraw,
}: {
  state: GameState;
  area: Extract<RoleArea, "economy" | "army" | "science">;
  disabled: boolean;
  onPropose: (text: string, area: RoleArea) => void;
  onWithdraw: (id: string) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-4">
      <ReadOnlyNote state={state} area={area} />
      {area === "economy" && <SeenFigures state={state} keys={ECONOMY} />}
      {area === "army" && (
        <>
          <SeenFigures state={state} keys={["troops"]} />
          <Wars state={state} />
        </>
      )}
      {area === "science" && <Research state={state} />}
      {state.role?.kind === "opposition" && <p className="text-2xs font-medium leading-snug text-muted">{t("sight.opposition.note")}</p>}
      <ProposalBox state={state} area={area} disabled={disabled} onPropose={onPropose} onWithdraw={onWithdraw} />
    </div>
  );
}

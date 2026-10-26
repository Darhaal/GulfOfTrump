"use client";

import { ArrowDown, ArrowLeftRight, ArrowUp, Award, Gift, Minus, Search, Skull, UserMinus } from "lucide-react";
import { useState } from "react";
import { ui } from "@/components/ui/classes";
import Dialog from "@/components/ui/Dialog";
import DoneButton, { Hint } from "@/components/ui/DoneButton";
import { agendaOf, MINISTRY_OF } from "@/engine/interests";
import {
  cabinetPlots,
  cannotMove,
  courtPerson,
  dismissMinister,
  factionOf,
  insidersOf,
  investigateFaction,
  purgeFaction,
  reshuffle,
  rivalsOf,
  type CabinetRefusal,
  type Faction,
  type Temper,
} from "@/engine/intrigue";
import type { CabinetMove, GameState, Official } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import { cabinetPlotTitle, factionName } from "./changes";

/**
 * The cabinet's intrigues as the government sees them (engine/intrigue.ts):
 * the factions with their temper, what the intelligence service reports of
 * plots – a rumour that may blame the wrong people, or a plot it is sure
 * of – and the government's own moves since the last turn with what came
 * of them. Each minister carries a faction badge and a loyalty mark with a
 * hint, and the moves the government can make on them. Every move is the
 * engine's dice, decided at once; the next turn's game master tells it.
 */

const TEMPER_TONE: Record<Temper, string> = {
  loyal: "border border-line text-muted",
  restive: "bg-amber-50 text-amber-700",
  disloyal: "bg-red-50 text-red-700",
};

const TEMPER_DOT: Record<Temper, string> = { loyal: "bg-emerald-500", restive: "bg-amber-500", disloyal: "bg-red-600" };

const surname = (name: string) => name.trim().split(/\s+/).at(-1) ?? name;

/** What a plot has come to, in a word: talk, a conspiracy, or plotters ready to strike. */
const stageOf = (strength: number) => (strength < 35 ? "talk" : strength < 70 ? "organised" : "ready");

/** The reason a move cannot be made, for its hint. */
function useWhy() {
  const { t } = useI18n();
  return (why: CabinetRefusal | null) => (why ? t((["this-turn", "once", "no-service"].includes(why) ? `cabinet.why.${why}` : "cabinet.why.other") as MessageKey) : undefined);
}

/** A faction's name as a chip, its temper in its tone, and what its people want in a hint, above the nearest positioned row. */
export function FactionBadge({ faction, state }: { faction: Faction; state: GameState }) {
  const { t, text } = useI18n();
  const people = insidersOf(state).filter((p) => faction.members.includes(p.name));
  const causes = [...new Set(people.flatMap((p) => agendaOf(p.person).map((a) => text(a.label))))].slice(0, 4);
  return (
    <span tabIndex={0} className={`group inline-flex items-center rounded-md px-1.5 py-0.5 text-2xs font-black uppercase tracking-wider outline-none ${TEMPER_TONE[faction.temper]}`}>
      {factionName(faction.id, t)}
      <Hint label={`${factionName(faction.id, t)} · ${t(`faction.temper.${faction.temper}` as MessageKey)}`} text={t("faction.wants", { causes: causes.join(" · ") })} align="start" />
    </span>
  );
}

/** A minister's place in the cabinet beside their loyalty: the faction badge, and a mark for where their loyalty is heading, with their rivals in its hint (above the row, which is positioned). */
export function MinisterMarks({ state, person, factions }: { state: GameState; person: Official; factions: Faction[] }) {
  const { t } = useI18n();
  const faction = factionOf(factions, person.name);
  const rivals = rivalsOf(state, person.name);
  const favour = person.favour ?? 0;
  const trend = favour >= 1 ? "rising" : favour <= -1 ? "falling" : "steady";
  const Icon = trend === "rising" ? ArrowUp : trend === "falling" ? ArrowDown : Minus;
  const tone = trend === "rising" ? "text-emerald-700" : trend === "falling" ? "text-red-600" : "text-muted";
  const rivalry = rivals.map((r) => `${surname(r.name)} (${t(`cabinet.rival.${r.why}` as MessageKey)})`).join(", ");
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span tabIndex={0} aria-label={t(`cabinet.loyalty.${trend}` as MessageKey)} className={`group inline-grid h-4 w-4 place-items-center rounded-full border border-line outline-none ${tone}`}>
        <Icon className="h-2.5 w-2.5" />
        <Hint label={t(`cabinet.loyalty.${trend}` as MessageKey)} text={`${t("cabinet.loyalty.hint")}${rivalry ? ` ${t("cabinet.rivals", { names: rivalry })}` : ""}`} align="start" />
      </span>
      {faction && <FactionBadge faction={faction} state={state} />}
    </span>
  );
}

/** The moves the government can make on one minister: a favour, a seat at the top table, a swap of posts, a dismissal. */
export function MinisterMoves({ state, person, disabled, onChange }: { state: GameState; person: Official; disabled: boolean; onChange: (next: GameState) => void }) {
  const { t } = useI18n();
  const why = useWhy();
  const [swapping, setSwapping] = useState(false);
  const others = (state.officials ?? []).filter((o) => o.name !== person.name && MINISTRY_OF[o.post] && insidersOf(state).some((p) => p.name === o.name && !p.deputy));
  const [partner, setPartner] = useState(others[0]?.post ?? "");
  const mine = MINISTRY_OF[person.post];
  if (!mine || !insidersOf(state).some((p) => p.name === person.name && !p.deputy)) return null;
  const moved = (kind: CabinetMove["kind"]) => (state.cabinet?.moves ?? []).some((m) => m.kind === kind && m.who === person.name && m.turn === state.turn);
  const compact = (kind: "favour" | "post" | "dismiss") => cannotMove(state, kind, person.name);
  const swapWhy = cannotMove(state, "reshuffle", person.name);
  const square = `${ui.secondary} h-7 w-7 shrink-0 rounded-lg p-0`;
  return (
    <>
      <span className="relative ml-auto flex items-center gap-1">
        <DoneButton
          compact
          icon={Gift}
          label={t("cabinet.act.favour")}
          hint={why(compact("favour")) ?? t("cabinet.act.favour.hint")}
          doneLabel={t("done.done")}
          done={moved("favour")}
          disabled={disabled || Boolean(compact("favour"))}
          onAct={() => onChange(courtPerson(state, person.name, "favour").state)}
          className={square}
        />
        <DoneButton
          compact
          icon={Award}
          label={t("cabinet.act.post")}
          hint={why(compact("post")) ?? t("cabinet.act.post.hint")}
          doneLabel={t("done.done")}
          done={Boolean(person.raised)}
          disabled={disabled || Boolean(compact("post"))}
          onAct={() => onChange(courtPerson(state, person.name, "post").state)}
          className={square}
        />
        <button
          type="button"
          aria-label={t("cabinet.act.move")}
          aria-expanded={swapping}
          disabled={disabled || Boolean(swapWhy) || !others.length}
          onClick={() => setSwapping((v) => !v)}
          className={`group ${square} ${swapping ? "border-accent/40 text-ink" : ""}`}
        >
          <ArrowLeftRight className="h-3.5 w-3.5" />
          <Hint label={t("cabinet.act.move")} text={why(swapWhy) ?? t("cabinet.act.move.hint")} />
        </button>
        <DoneButton
          compact
          icon={UserMinus}
          label={t("cabinet.act.dismiss")}
          hint={why(compact("dismiss")) ?? t("cabinet.act.dismiss.hint")}
          doneLabel={t("done.done")}
          disabled={disabled || Boolean(compact("dismiss"))}
          onAct={() => onChange(dismissMinister(state, person.name).state)}
          className={`${square} hover:border-red-200 hover:text-red-600`}
        />
      </span>
      {swapping && others.length > 0 && (
        <div className="flex w-full items-end gap-1.5">
          <label className="grid min-w-0 flex-1 gap-1">
            <span className="text-2xs font-black uppercase tracking-wider text-muted">{t("cabinet.act.swapWith")}</span>
            <select value={partner} onChange={(e) => setPartner(e.target.value as Official["post"])} className={`${ui.input} min-w-0 py-1.5 text-xs`}>
              {others.map((o) => (
                <option key={o.post} value={o.post}>
                  {o.name} – {o.title}
                </option>
              ))}
            </select>
          </label>
          <DoneButton
            label={t("cabinet.act.swap")}
            icon={ArrowLeftRight}
            doneLabel={t("done.done")}
            disabled={disabled || !partner}
            onAct={() => {
              const theirs = MINISTRY_OF[partner as Official["post"]];
              if (!theirs) return false;
              const result = reshuffle(state, mine, theirs);
              if (result.why) return false;
              onChange(result.state);
              setSwapping(false);
            }}
            className={`${ui.secondary} shrink-0 px-3 py-1.5 text-xs`}
          />
        </div>
      )}
    </>
  );
}

/** One move since the last turn and what came of it, in a sentence. */
function moveLine(m: CabinetMove, t: ReturnType<typeof useI18n>["t"]): string {
  const faction = m.kind === "investigate" || m.kind === "purge" ? factionName(m.who, t) : "";
  const names = (m.names ?? []).map(surname).join(", ");
  const head = m.kind === "reshuffle" ? t("cabinet.move.reshuffle", { name: m.who, other: m.with ?? "" }) : t(`cabinet.move.${m.kind}` as MessageKey, { name: m.who, faction });
  const result = t(`cabinet.result.${m.result}` as MessageKey, { names });
  return `${head} – ${result}${m.noticed ? ` ${t("cabinet.result.noticed")}` : ""}`;
}

/**
 * The factions at the top of the ministers: each with its people, temper and
 * the two moves aimed at a whole faction – an investigation and a purge –
 * then what the intelligence service reports of plots in the cabinet, and
 * the government's moves since the last turn.
 */
export default function CabinetFactions({ state, factions, disabled, onChange }: { state: GameState; factions: Faction[]; disabled: boolean; onChange: (next: GameState) => void }) {
  const { t } = useI18n();
  const why = useWhy();
  const [purging, setPurging] = useState<Faction | null>(null);
  const plots = cabinetPlots(state).filter((p) => p.known || p.cabinet.rumour);
  const moves = (state.cabinet?.moves ?? []).filter((m) => m.turn === state.turn);
  if (!insidersOf(state).length) return null;
  return (
    // One column that may shrink below its content, so long names truncate instead of widening the panel.
    <section className="grid grid-cols-1 gap-2 rounded-xl border border-line sheet p-3">
      <div className={ui.label}>{t("cabinet.factions")}</div>
      {factions.length === 0 ? (
        <p className="text-xs font-medium text-muted">{t("cabinet.factions.empty")}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-1.5">
          {factions.map((f) => {
            const investigated = moves.some((m) => m.kind === "investigate" && m.who === f.id);
            const lookWhy = cannotMove(state, "investigate", f.id);
            const purgeWhy = cannotMove(state, "purge", f.id);
            return (
              <li key={f.id} className="relative flex items-center gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${TEMPER_DOT[f.temper]}`} title={t(`faction.temper.${f.temper}` as MessageKey)} aria-hidden />
                <FactionBadge faction={f} state={state} />
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-ink">{f.members.map(surname).join(", ")}</span>
                <DoneButton
                  compact
                  icon={Search}
                  label={t("cabinet.act.investigate")}
                  hint={investigated ? undefined : (why(lookWhy) ?? t("cabinet.act.investigate.hint"))}
                  doneLabel={t("done.done")}
                  done={investigated}
                  disabled={disabled || Boolean(lookWhy)}
                  onAct={() => onChange(investigateFaction(state, f.id).state)}
                  className={`${ui.secondary} h-7 w-7 shrink-0 rounded-lg p-0`}
                />
                <button
                  type="button"
                  aria-label={t("cabinet.act.purge")}
                  disabled={disabled || Boolean(purgeWhy)}
                  onClick={() => setPurging(f)}
                  className={`group ${ui.secondary} h-7 w-7 shrink-0 rounded-lg p-0 hover:border-red-200 hover:text-red-600`}
                >
                  <Skull className="h-3.5 w-3.5" />
                  <Hint label={t("cabinet.act.purge")} text={why(purgeWhy) ?? t("cabinet.act.purge.hint")} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-1 grid grid-cols-1 gap-1 border-t border-divider pt-2">
        <div className={ui.label}>{t("cabinet.plots")}</div>
        {plots.length === 0 ? (
          <p className="text-xs font-medium text-muted">{t("cabinet.plots.none")}</p>
        ) : (
          <ul className="grid grid-cols-1 gap-1">
            {plots.map((p) => {
              // A rumour names the faction the service suspects, which may not be the one behind it.
              const faction = p.known ? p.cabinet.faction : (p.cabinet.rumour?.faction ?? "");
              const title = cabinetPlotTitle(p.cabinet, t, faction ? factionName(faction, t) : t("cabinet.plot.unknownFaction"));
              return (
                <li key={p.id} tabIndex={0} className="group relative flex items-center gap-2 rounded-lg bg-red-50/60 px-2.5 py-1.5 text-xs outline-none">
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-2xs font-black uppercase tracking-wider ${p.known ? "bg-red-600 text-on-ink" : "border border-red-200 text-red-700"}`}>{t(p.known ? "cabinet.plot.known" : "cabinet.plot.rumoured")}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold text-ink">{title}</span>
                  <span className="shrink-0 text-2xs font-bold text-muted">{t(`cabinet.plot.stage.${stageOf(p.strength)}` as MessageKey)}</span>
                  <Hint label={title} text={t(p.known ? "cabinet.plot.known.hint" : "cabinet.plot.rumoured.hint")} />
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {moves.length > 0 && (
        <div className="mt-1 grid gap-1 border-t border-divider pt-2">
          <div className={ui.label}>{t("cabinet.moves")}</div>
          <ul className="grid gap-0.5">
            {moves.map((m, i) => (
              <li key={i} className="text-2xs font-medium leading-snug text-muted">
                {moveLine(m, t)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Dialog
        open={Boolean(purging)}
        onClose={() => setPurging(null)}
        title={purging ? t("cabinet.purge.title", { faction: factionName(purging.id, t) }) : ""}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setPurging(null)} className={`${ui.secondary} px-4 py-2 text-xs`}>
              {t("cabinet.purge.cancel")}
            </button>
            <DoneButton
              label={t("cabinet.act.purge")}
              icon={Skull}
              doneLabel={t("done.done")}
              disabled={disabled || !purging}
              onAct={() => {
                if (!purging) return false;
                const result = purgeFaction(state, purging.id);
                if (result.why) return false;
                onChange(result.state);
                setPurging(null);
              }}
              className={`${ui.primary} px-4 py-2 text-xs`}
            />
          </div>
        }
      >
        {purging && <p className="text-sm font-medium leading-relaxed text-ink">{t("cabinet.purge.body", { names: purging.members.join(", ") })}</p>}
      </Dialog>
    </section>
  );
}

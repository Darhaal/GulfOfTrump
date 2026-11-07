"use client";

import { BookOpen, Handshake, Plus, Vote, X } from "lucide-react";
import { ui } from "@/components/ui/classes";
import DoneButton from "@/components/ui/DoneButton";
import { MAX_ORDERS } from "@/constants/app";
import { formatDate } from "@/engine/calendar";
import { holdsElections } from "@/engine/parliament";
import { alliesOf, blocSupport, coalitionCandidates, coalitionChance, MAX_OFFERS, movementParty } from "@/engine/role";
import type { GameState } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import { ordersFull } from "./DraftedOrders";
import { partyName } from "./politics/PartyLife";
import { AxisBar } from "./PoliticsPanel";

/** What the movement's support must reach, with its allies, to win an election (engine/role.ts canRise). */
const TO_WIN = 25;

/** Campaign moves, each an order the game master judges. */
const CAMPAIGN = ["canvass", "debate", "manifesto"] as const;

/**
 * The party's own play beside its strength (OppositionPanel): its programme
 * as its ideas stand; coalitions with other parties – offered here and
 * answered by the engine's dice as the turn is played (engine/role.ts) –
 * and the allies it has; and the campaign: the next election, how far the
 * movement and its allies are from winning one, and the campaign's moves.
 */
export default function PartyPlay({ state, disabled, onOrder, onOffer, onDrop }: { state: GameState; disabled: boolean; onOrder: (order: string) => void; onOffer: (party: string) => void; onDrop: (party: string) => void }) {
  const { t, locale } = useI18n();
  const m = state.role?.movement;
  if (!m) return null;
  const own = movementParty(state);
  const allies = alliesOf(state);
  const offers = m.offers ?? [];
  const candidates = coalitionCandidates(state).filter((p) => !offers.some((o) => o.party === p.id));
  const name = (id: string) => {
    const p = state.politics?.parties.find((x) => x.id === id);
    return p ? (p.unnamed ? partyName(p, t) : p.name) : id;
  };
  const bloc = blocSupport(state);
  const elections = holdsElections(state) && m.kind === "party";
  const full = ordersFull(state);
  const color = "var(--accent)";

  return (
    <>
      <section>
        <div className={`${ui.label} mb-2 flex items-center gap-1.5`}>
          <BookOpen className="h-3.5 w-3.5" />
          {t("party.programme")}
        </div>
        {own ? (
          <div className="grid gap-2.5 rounded-xl bg-page p-3">
            {own.ideology && <p className="text-xs font-bold leading-snug text-ink">{own.ideology}</p>}
            <AxisBar name={t("politics.axisName.economy")} left={t("politics.axis.left")} right={t("politics.axis.right")} value={own.stance.economy} was={own.was?.economy} color={color} />
            <AxisBar name={t("politics.axisName.freedom")} left={t("politics.axis.authoritarian")} right={t("politics.axis.liberal")} value={own.stance.freedom} was={own.was?.freedom} color={color} />
            <AxisBar name={t("politics.axisName.nation")} left={t("politics.axis.open")} right={t("politics.axis.nationalist")} value={own.stance.nation} was={own.was?.nation} color={color} />
          </div>
        ) : (
          <p className="text-xs font-medium text-muted">{t("party.programme.none")}</p>
        )}
      </section>

      <section>
        <div className={`${ui.label} mb-2 flex items-center gap-1.5`}>
          <Handshake className="h-3.5 w-3.5" />
          {t("party.coalition")}
        </div>
        {allies.length > 0 && (
          <ul className="mb-2 grid gap-1">
            {allies.map((p) => (
              <li key={p.id} className="flex items-center gap-2 rounded-lg bg-page px-2.5 py-1.5 text-xs">
                <span className="min-w-0 flex-1 truncate font-black text-ink">{name(p.id)}</span>
                <span className="shrink-0 font-bold tabular-nums text-muted">{p.support}%</span>
                <button type="button" disabled={disabled} onClick={() => onDrop(p.id)} title={t("party.coalition.leave")} aria-label={t("party.coalition.leave")} className="shrink-0 rounded-md p-0.5 text-muted hover:text-red-600 disabled:opacity-50">
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {offers.length > 0 && (
          <ul className="mb-2 grid gap-1">
            {offers.map((o) => (
              <li key={o.party} className="flex items-center gap-2 rounded-lg border border-dashed border-line px-2.5 py-1.5 text-xs">
                <span className="min-w-0 flex-1 truncate font-bold text-ink">{t("party.coalition.offered", { party: name(o.party) })}</span>
                <span className="shrink-0 font-bold tabular-nums text-muted">{Math.round(o.chance * 100)}%</span>
                <button type="button" disabled={disabled} onClick={() => onDrop(o.party)} title={t("party.coalition.withdraw")} aria-label={t("party.coalition.withdraw")} className="shrink-0 rounded-md p-0.5 text-muted hover:text-red-600 disabled:opacity-50">
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {candidates.length === 0 ? (
          <p className="text-xs font-medium text-muted">{t(state.politics?.parties.length ? "party.coalition.none" : "politics.loadNote")}</p>
        ) : (
          <ul className="grid gap-1">
            {candidates.map((p) => {
              const chance = Math.round(coalitionChance(state, p.id) * 100);
              const room = offers.length < MAX_OFFERS;
              return (
                <li key={p.id} className="relative flex items-center gap-2 rounded-lg bg-page px-2.5 py-1.5 text-xs">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-black text-ink">{name(p.id)}</span>
                    <span className="block text-2xs font-bold text-muted">{t("party.coalition.chance", { n: chance, support: p.support })}</span>
                  </span>
                  <DoneButton
                    compact
                    icon={Handshake}
                    label={t("party.coalition.offer")}
                    hint={room ? t("party.coalition.offerHint", { party: name(p.id), n: chance }) : t("party.coalition.full", { n: MAX_OFFERS })}
                    doneLabel={t("done.sent")}
                    disabled={disabled || !room}
                    onAct={() => onOffer(p.id)}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-line sheet text-muted transition-colors hover:border-accent/40 hover:text-accent disabled:cursor-not-allowed disabled:text-faded"
                  />
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-1.5 text-2xs font-medium leading-snug text-muted">{t("party.coalition.note")}</p>
      </section>

      <section className="flex flex-col gap-2 rounded-2xl bg-page p-3">
        <div className={`${ui.label} flex items-center gap-1.5`}>
          <Vote className="h-3.5 w-3.5" />
          {t("party.campaign")}
        </div>
        {elections ? (
          <>
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-bold text-muted">{t("politics.electionTile")}</span>
              <span className="font-black tabular-nums text-ink">{state.politics?.nextElection ? formatDate(state.politics.nextElection, locale) : "–"}</span>
            </div>
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-bold text-muted">{t("party.campaign.bloc")}</span>
              <span className={`font-black tabular-nums ${bloc >= TO_WIN ? "text-emerald-700" : "text-ink"}`}>{t("party.campaign.blocValue", { n: bloc, need: TO_WIN })}</span>
            </div>
            <div className="relative h-1.5 overflow-hidden rounded-full bg-divider">
              <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (bloc / 50) * 100)}%` }} />
              <span className="absolute inset-y-0 w-px bg-ink/40" style={{ left: `${(TO_WIN / 50) * 100}%` }} />
            </div>
            <div className="relative mt-1 flex flex-col gap-1.5">
              {CAMPAIGN.map((c) => {
                const order = t(`party.campaign.${c}` as MessageKey);
                const done = state.draft.includes(order);
                return (
                  <DoneButton
                    key={c}
                    keepLabel
                    icon={Plus}
                    label={order}
                    doneLabel={t("done.inOrders")}
                    done={done}
                    disabled={disabled || full}
                    hint={full && !done ? t("game.orders.limit", { n: MAX_ORDERS }) : undefined}
                    onAct={() => onOrder(order)}
                    className={`${ui.secondary} justify-start px-3 py-2 text-left text-xs`}
                    doneClassName={`${ui.done} gap-2 rounded-xl px-3 py-2 text-left text-xs`}
                  />
                );
              })}
            </div>
          </>
        ) : (
          <p className="text-xs font-medium leading-snug text-muted">{t(m.kind === "party" ? "party.campaign.noElections" : "party.campaign.underground")}</p>
        )}
      </section>
    </>
  );
}

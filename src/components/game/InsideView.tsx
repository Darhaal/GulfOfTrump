"use client";

import { Award, Ear, Send, ShieldAlert, Users, X } from "lucide-react";
import { ui } from "@/components/ui/classes";
import { formatDate } from "@/engine/calendar";
import { ownFormation, standingOf } from "@/engine/figures";
import { officialAt, officialTitle } from "@/engine/government";
import { factionOf, factionsOf, standing, temperOf, type Temper } from "@/engine/intrigue";
import { leaderOf, personName, samePerson } from "@/engine/people";
import { loyaltyOf } from "@/engine/politics";
import { earOf, monthsIn, plotsAgainst } from "@/engine/remit";
import type { GameState, Official } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import { FactionBadge } from "./CabinetFactions";
import { cabinetPlotTitle } from "./changes";

const TEMPER_DOT: Record<Temper, string> = { loyal: "bg-emerald-500", restive: "bg-amber-500", disloyal: "bg-red-600" };

/**
 * The game inside the government, for a minister or a general
 * (engine/remit.ts): how the leader hears them; a minister's colleagues with
 * their factions and how each stands with the leader, and the intrigues that
 * reach the player; a general's general staff and the other commanders; the
 * career so far; and the proposals put to the leader, waiting for the turn.
 */
export default function InsideView({ state, disabled, onWithdraw }: { state: GameState; disabled: boolean; onWithdraw: (id: string) => void }) {
  const { t, text, locale } = useI18n();
  const role = state.role;
  if (!role || (role.kind !== "minister" && role.kind !== "general")) return null;
  const s = standingOf(role);
  const leader = leaderOf(state, state.player);
  const me = role.person?.name;
  const factions = factionsOf(state);
  const colleagues = (state.officials ?? []).filter((o) => o.post !== role.post && !(me && samePerson(o.name, me)) && o.post !== "head" && o.post !== "government");
  const plots = plotsAgainst(state);
  const months = monthsIn(role.since, state.date);
  const staff = role.kind === "general" ? officialAt(state, "military") : undefined;
  const own = ownFormation(state);
  const commanders = role.kind === "general" ? (state.countries[state.player]?.arsenal?.organisation?.formations ?? []).filter((f) => f.commander && f !== own && !(me && samePerson(f.commander, me))).slice(0, 6) : [];
  const army = state.politics ? loyaltyOf(state.politics).army : undefined;
  const pending = role.proposals ?? [];
  const tempered = (o: Official) => temperOf(standing(o));

  return (
    <>
      <section className="flex flex-col gap-2 rounded-2xl bg-page p-3">
        <div className={`${ui.label} flex items-center gap-1.5`}>
          <Ear className="h-3.5 w-3.5" />
          {t("inside.leader")}
        </div>
        <div className="flex items-baseline justify-between gap-2 text-xs">
          <span className="min-w-0 truncate font-black text-ink">{leader ? personName(leader, locale) : t("inside.leaderUnknown")}</span>
          <span className="shrink-0 font-bold text-muted">{t(`inside.ear.${earOf(s.influence)}` as MessageKey)}</span>
        </div>
        <p className="text-2xs font-medium leading-snug text-muted">{t(`inside.earNote.${earOf(s.influence)}` as MessageKey)}</p>
      </section>

      {role.kind === "minister" && (
        <section>
          <div className={`${ui.label} mb-2 flex items-center gap-1.5`}>
            <Users className="h-3.5 w-3.5" />
            {t("inside.colleagues")}
          </div>
          {colleagues.length === 0 ? (
            <p className="text-xs font-medium text-muted">{t("inside.noCabinet")}</p>
          ) : (
            <ul className="grid gap-1">
              {colleagues.map((o) => {
                const faction = factionOf(factions, o.name);
                const temper = tempered(o);
                return (
                  <li key={`${o.post}:${o.name}`} className="relative flex items-center gap-2 rounded-lg bg-page px-2.5 py-1.5">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${TEMPER_DOT[temper]}`} title={t(`faction.temper.${temper}` as MessageKey)} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-black text-ink">{o.name}</span>
                      <span className="block truncate text-2xs font-medium text-muted">{officialTitle(o, text)}</span>
                    </span>
                    {faction && <FactionBadge faction={faction} state={state} />}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-1.5 text-2xs font-medium leading-snug text-muted">{t("inside.colleaguesNote")}</p>
        </section>
      )}

      {role.kind === "minister" && (
        <section>
          <div className={`${ui.label} mb-2 flex items-center gap-1.5`}>
            <ShieldAlert className="h-3.5 w-3.5" />
            {t("inside.intrigue")}
          </div>
          {plots.length === 0 ? (
            <p className="text-xs font-medium text-muted">{t("inside.noPlots")}</p>
          ) : (
            <ul className="grid gap-1">
              {plots.map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-2 rounded-lg bg-red-50/60 px-2.5 py-1.5 text-xs">
                  <span className="min-w-0 font-bold leading-snug text-ink">{cabinetPlotTitle(p.cabinet, t)}</span>
                  <span className="shrink-0 text-2xs font-black uppercase tracking-wider text-red-700">{t(p.known ? "inside.plot.known" : "inside.plot.rumour")}</span>
                </li>
              ))}
            </ul>
          )}
          {factions.some((f) => f.temper !== "loyal") && (
            <div className="mt-2 flex flex-wrap gap-1">
              {factions
                .filter((f) => f.temper !== "loyal")
                .map((f) => (
                  <span key={f.id} className="relative">
                    <FactionBadge faction={f} state={state} />
                  </span>
                ))}
            </div>
          )}
        </section>
      )}

      {role.kind === "general" && (
        <section className="flex flex-col gap-1.5">
          <div className={`${ui.label} mb-0.5 flex items-center gap-1.5`}>
            <Users className="h-3.5 w-3.5" />
            {t("inside.staff")}
          </div>
          {staff ? (
            <div className="flex items-center gap-2 rounded-lg bg-page px-2.5 py-1.5">
              <span className={`h-2 w-2 shrink-0 rounded-full ${TEMPER_DOT[tempered(staff)]}`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-black text-ink">{staff.name}</span>
                <span className="block truncate text-2xs font-medium text-muted">{officialTitle(staff, text)}</span>
              </span>
              <span className="shrink-0 text-2xs font-bold text-muted">{t(s.influence >= 55 && s.means >= 50 ? "inside.staff.backs" : s.influence < 35 ? "inside.staff.doubts" : "inside.staff.watches")}</span>
            </div>
          ) : (
            <p className="text-xs font-medium text-muted">{t("inside.noCabinet")}</p>
          )}
          {army !== undefined && (
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-bold text-muted">{t("inside.armyLoyalty")}</span>
              <span className="font-black tabular-nums text-ink">{army}</span>
            </div>
          )}
          {commanders.length > 0 && (
            <ul className="mt-1 grid gap-0.5">
              {commanders.map((f) => (
                <li key={f.name} className="flex items-baseline justify-between gap-2 text-2xs">
                  <span className="min-w-0 truncate font-bold text-ink">{f.commander}</span>
                  <span className="shrink-0 truncate font-medium text-muted">{f.name}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="rounded-2xl bg-page p-3">
        <div className={`${ui.label} mb-1 flex items-center gap-1.5`}>
          <Award className="h-3.5 w-3.5" />
          {t("inside.career")}
        </div>
        <p className="text-xs font-medium leading-snug text-ink">{t(`inside.how.${role.how ?? "start"}` as MessageKey, { date: formatDate(role.since, locale), n: months })}</p>
      </section>

      {pending.length > 0 && (
        <section>
          <div className={`${ui.label} mb-2 flex items-center gap-1.5`}>
            <Send className="h-3.5 w-3.5" />
            {t("proposal.pending")}
          </div>
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
        </section>
      )}
      <p className="text-2xs font-medium leading-snug text-muted">{t("proposal.where")}</p>
    </>
  );
}

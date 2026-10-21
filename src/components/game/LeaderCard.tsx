"use client";

import { leaderOf, personName, samePerson } from "@/engine/people";
import type { GameState } from "@/engine/types";
import { useI18n } from "@/i18n/useI18n";
import { Traits } from "./AppointmentDialog";
import Portrait from "./Portrait";

/** Who leads the player's country, at the top of the cabinet: portrait, name, title and traits. */
export default function LeaderCard({ state }: { state: GameState }) {
  const { t, locale } = useI18n();
  const leader = leaderOf(state, state.player);
  if (!leader) return null;
  const official = state.officials?.find((o) => (o.post === "head" || o.post === "government") && samePerson(o.name, leader.name));
  const name = personName(leader, locale);
  return (
    <div className="flex items-start gap-4 rounded-2xl bg-page p-3">
      <Portrait portrait={leader.portrait} gender={leader.gender} name={name} size="hero" className="ring-2 ring-accent/50" />
      <div className="min-w-0 pt-1">
        <div className="text-2xs font-black uppercase tracking-widest text-muted">{t("cabinet.leader")}</div>
        <div className="text-lg font-black leading-tight text-ink">{name}</div>
        {(official?.title ?? leader.title) && <div className="mt-0.5 text-xs font-medium leading-snug text-muted">{official?.title ?? leader.title}</div>}
        {official && official.traits.length > 0 && (
          <div className="mt-1.5">
            <Traits traits={official.traits} />
          </div>
        )}
      </div>
    </div>
  );
}

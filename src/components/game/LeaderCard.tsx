"use client";

import { leaderOf, leaderOfficial, personName } from "@/engine/people";
import type { GameState } from "@/engine/types";
import { useI18n } from "@/i18n/useI18n";
import { Traits } from "./AppointmentDialog";
import Portrait from "./Portrait";

/** A person's short biography (engine/bios.ts) when it has come, two quiet lines while it is being written, nothing otherwise. */
export function Bio({ text, loading }: { text?: string; loading?: boolean }) {
  if (text) return <p className="mt-1.5 text-xs font-medium leading-relaxed text-muted">{text}</p>;
  if (!loading) return null;
  return (
    <div className="mt-2 grid gap-1.5" aria-hidden>
      <span className="h-2 w-44 max-w-full animate-pulse rounded bg-line" />
      <span className="h-2 w-28 max-w-full animate-pulse rounded bg-line" />
    </div>
  );
}

/**
 * Who leads the player's country, at the top of the cabinet: the portrait
 * with the name, title and faction beside it; the biography and the traits
 * under both, the card's full width, so a long life does not stretch a
 * narrow column.
 */
export default function LeaderCard({ state, bio, bioLoading }: { state: GameState; bio?: string; bioLoading?: boolean }) {
  const { t, locale } = useI18n();
  const leader = leaderOf(state, state.player);
  if (!leader) return null;
  const official = leaderOfficial(state);
  const name = personName(leader, locale);
  const title = official?.title ?? leader.title;
  const traits = official?.traits ?? [];
  return (
    <div className="rounded-2xl bg-page p-3">
      <div className="flex items-start gap-4">
        <Portrait portrait={leader.portrait} gender={leader.gender} name={name} size="hero" className="ring-1 ring-accent/40 ring-offset-2 ring-offset-page" />
        <div className="min-w-0 pt-1">
          <div className="text-2xs font-black uppercase tracking-widest text-muted">{t("cabinet.leader")}</div>
          <div className="text-lg font-black leading-tight text-ink">{name}</div>
          {title && <div className="mt-0.5 text-xs font-medium leading-snug text-muted">{title}</div>}
          {official?.faction && <div className="mt-1.5 text-2xs font-bold text-muted">{official.faction}</div>}
        </div>
      </div>
      {(bio || bioLoading || traits.length > 0) && (
        <div className="mt-2">
          <Bio text={bio} loading={bioLoading} />
          {traits.length > 0 && (
            <div className="mt-2">
              <Traits traits={traits} onPage />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

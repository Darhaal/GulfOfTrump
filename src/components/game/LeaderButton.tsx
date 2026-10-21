"use client";

import { leaderOf, personName } from "@/engine/people";
import type { GameState } from "@/engine/types";
import { useI18n } from "@/i18n/useI18n";
import Portrait from "./Portrait";

/** The player's leader in the game's header: a small portrait that opens the country's card. */
export default function LeaderButton({ state, onOpen }: { state: GameState; onOpen: () => void }) {
  const { t, locale } = useI18n();
  const leader = leaderOf(state, state.player);
  if (!leader) return null;
  const name = personName(leader, locale);
  return (
    <button type="button" onClick={onOpen} className="group shrink-0 rounded-full" aria-label={`${t("country.leaderCard")}: ${name}`} title={leader.title ? `${leader.title} ${name}` : name}>
      <Portrait portrait={leader.portrait} gender={leader.gender} name={name} size="xs" className="transition-shadow group-hover:ring-2 group-hover:ring-accent/60" />
    </button>
  );
}

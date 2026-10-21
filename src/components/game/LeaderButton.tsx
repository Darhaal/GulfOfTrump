"use client";

import { leaderOf, personName } from "@/engine/people";
import { isOpposition } from "@/engine/role";
import type { GameState } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import Portrait from "./Portrait";

/**
 * Who the player is, in the game's header: the country's leader, a small
 * portrait that opens the country's card; or, in opposition, the player's
 * own person with the movement's standing (engine/role.ts).
 */
export default function LeaderButton({ state, onOpen, onOpposition }: { state: GameState; onOpen: () => void; onOpposition?: () => void }) {
  const { t, locale } = useI18n();
  if (isOpposition(state)) {
    const role = state.role!;
    const name = role.person ? personName(role.person, locale) : t("role.opposition");
    const kind = t(`movement.kind.${role.movement!.kind}` as MessageKey);
    return (
      <button type="button" onClick={onOpposition} className="group flex shrink-0 items-center gap-1.5 rounded-full" aria-label={`${name} · ${kind}`} title={`${name} · ${role.movement!.name ?? t("role.movementUnnamed")}`}>
        <Portrait portrait={role.person?.portrait} gender={role.person?.gender} name={name} size="xs" className="transition-shadow group-hover:ring-2 group-hover:ring-accent/60" />
        <span className="rounded-md bg-accent/10 px-1.5 py-0.5 text-2xs font-black text-accent max-sm:hidden">{kind}</span>
      </button>
    );
  }
  const leader = leaderOf(state, state.player);
  if (!leader) return null;
  const name = personName(leader, locale);
  return (
    <button type="button" onClick={onOpen} className="group shrink-0 rounded-full" aria-label={`${t("country.leaderCard")}: ${name}`} title={leader.title ? `${leader.title} ${name}` : name}>
      <Portrait portrait={leader.portrait} gender={leader.gender} name={name} size="xs" className="transition-shadow group-hover:ring-2 group-hover:ring-accent/60" />
    </button>
  );
}

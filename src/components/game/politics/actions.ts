import { Ban, Gavel, HandCoins, Handshake, LogOut, type LucideIcon, Megaphone, RefreshCw, Search, ShieldAlert, Undo2, UserMinus, UserPlus } from "lucide-react";
import type { Party } from "@/engine/types";

export type Risk = "low" | "medium" | "high";

/**
 * Something the government can do about a party or the street. Each becomes
 * an order the game master judges; the strings live under
 * politics.act.<id> (label), politics.desc.<id> (what it gives and what it
 * risks) and politics.order.<id> (the order). Laws, amendments and votes of
 * state go to parliament instead (engine/parliament.ts).
 */
export interface PoliticsAction {
  id: string;
  icon: LucideIcon;
  risk: Risk;
}

/** What the government can do about one party, by where that party stands. */
export const PARTY_ACTIONS: Record<string, PoliticsAction> = {
  campaign: { id: "campaign", icon: Megaphone, risk: "low" },
  renew: { id: "renew", icon: RefreshCw, risk: "medium" },
  support: { id: "support", icon: HandCoins, risk: "low" },
  negotiate: { id: "negotiate", icon: Handshake, risk: "low" },
  leave: { id: "leave", icon: LogOut, risk: "medium" },
  coalition: { id: "coalition", icon: UserPlus, risk: "low" },
  poach: { id: "poach", icon: UserMinus, risk: "medium" },
  smear: { id: "smear", icon: Megaphone, risk: "medium" },
  suppress: { id: "suppress", icon: ShieldAlert, risk: "high" },
  arrest: { id: "arrest", icon: Gavel, risk: "high" },
  ban: { id: "ban", icon: Ban, risk: "high" },
  legalise: { id: "legalise", icon: Undo2, risk: "medium" },
  secretTalks: { id: "secretTalks", icon: Handshake, risk: "medium" },
  crackdown: { id: "crackdown", icon: Search, risk: "high" },
};

/** Seats a vote needs. */
export const needed = (vote: "majority" | "twothirds", total: number) => (vote === "majority" ? Math.floor(total / 2) + 1 : Math.ceil((total * 2) / 3));

export function partyActions(p: Party): PoliticsAction[] {
  const ids =
    p.status === "ruling"
      ? ["campaign", "renew"]
      : p.status === "coalition"
        ? ["support", "negotiate", "leave"]
        : p.status === "opposition"
          ? ["coalition", "negotiate", "poach", "support", "smear", "suppress", "arrest", "ban"]
          : ["legalise", "secretTalks", "crackdown"];
  return ids.map((id) => PARTY_ACTIONS[id]);
}

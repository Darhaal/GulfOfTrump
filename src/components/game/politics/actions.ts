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

/** What an opposition party can do about another (engine/remit.ts): attack it, lure its members, run on one list; an outlawed one, defend. The coalition itself is offered on the party's own panel. */
const OPPOSITION_ACTIONS: Record<string, PoliticsAction> = {
  attack: { id: "attack", icon: Megaphone, risk: "medium" },
  lure: { id: "lure", icon: UserPlus, risk: "medium" },
  jointList: { id: "jointList", icon: Handshake, risk: "low" },
  defend: { id: "defend", icon: ShieldAlert, risk: "medium" },
};

export function oppositionActions(p: Party): PoliticsAction[] {
  const ids = p.status === "ruling" || p.status === "coalition" ? ["attack", "lure"] : p.status === "opposition" ? ["jointList", "lure", "attack"] : ["defend"];
  return ids.map((id) => OPPOSITION_ACTIONS[id]);
}

/** What an opposition party can do in a protest at home: lead it under its own banner, or keep its distance. */
export const OPPOSITION_STREET: readonly PoliticsAction[] = [
  { id: "leadProtest", icon: Megaphone, risk: "high" },
  { id: "distanceProtest", icon: LogOut, risk: "low" },
];

/** What the government can do with one party, on its card: campaign, talk, court, support, legalise. */
export function partyActions(p: Party): PoliticsAction[] {
  const ids =
    p.status === "ruling"
      ? ["campaign", "renew"]
      : p.status === "coalition"
        ? ["support", "negotiate", "leave"]
        : p.status === "opposition"
          ? ["coalition", "negotiate", "poach", "support"]
          : ["legalise", "secretTalks"];
  return ids.map((id) => PARTY_ACTIONS[id]);
}

/** What the government can do against one party, with the threats in the street: smear it, hold it down, arrest its leader, ban it; hunt it underground. */
export function pressureActions(p: Party): PoliticsAction[] {
  const ids = p.status === "opposition" ? ["smear", "suppress", "arrest", "ban"] : p.status === "banned" || p.status === "underground" ? ["crackdown"] : [];
  return ids.map((id) => PARTY_ACTIONS[id]);
}

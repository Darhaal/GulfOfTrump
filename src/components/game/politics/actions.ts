import {
  Ban,
  BookOpen,
  Eye,
  EyeOff,
  Gavel,
  HandCoins,
  Handshake,
  Landmark,
  LogOut,
  type LucideIcon,
  Megaphone,
  Mic,
  Radio,
  RefreshCw,
  Scale,
  ScrollText,
  Search,
  Shield,
  ShieldAlert,
  Siren,
  Undo2,
  UserMinus,
  UserPlus,
  Users,
  Vote,
} from "lucide-react";
import type { Party } from "@/engine/types";

export type ActionCategory = "parliament" | "people" | "force";
export type Risk = "low" | "medium" | "high";

/**
 * Something the government can do at home. Each becomes an order the game
 * master judges; the strings live under politics.act.<id> (label),
 * politics.desc.<id> (what it gives and what it risks) and
 * politics.order.<id> (the order, with {text}, {date} or {party}).
 */
export interface PoliticsAction {
  id: string;
  icon: LucideIcon;
  risk: Risk;
  /** A vote of parliament: a simple majority or two thirds of the seats. */
  vote?: "majority" | "twothirds";
  /** What the player writes in: the law, the message, the question, the date. */
  input?: "bill" | "text" | "referendum" | "constitution" | "date";
}

export const ACTIONS: Record<ActionCategory, PoliticsAction[]> = {
  parliament: [
    { id: "bill", icon: ScrollText, risk: "low", vote: "majority", input: "bill" },
    { id: "constitution", icon: BookOpen, risk: "medium", vote: "twothirds", input: "constitution" },
    { id: "confidence", icon: Scale, risk: "high", vote: "majority" },
    { id: "election", icon: Vote, risk: "medium", input: "date" },
    { id: "dissolve", icon: Gavel, risk: "high" },
    { id: "postpone", icon: Undo2, risk: "high" },
  ],
  people: [
    { id: "address", icon: Mic, risk: "low", input: "text" },
    { id: "propaganda", icon: Radio, risk: "low", input: "text" },
    { id: "referendum", icon: Landmark, risk: "medium", input: "referendum" },
    { id: "welfare", icon: HandCoins, risk: "low" },
    { id: "corruption", icon: Search, risk: "medium" },
    { id: "pressFree", icon: Eye, risk: "medium" },
    { id: "censor", icon: EyeOff, risk: "medium" },
    { id: "amnesty", icon: Users, risk: "low" },
  ],
  force: [
    { id: "emergency", icon: Siren, risk: "high", vote: "majority" },
    { id: "security", icon: Shield, risk: "medium" },
    { id: "purge", icon: ShieldAlert, risk: "high" },
    { id: "securityPay", icon: HandCoins, risk: "low" },
    { id: "elitesDeal", icon: Handshake, risk: "medium" },
  ],
};

export const CATEGORY_ICONS: Record<ActionCategory, LucideIcon> = { parliament: Landmark, people: Megaphone, force: Shield };

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

/** Seats a vote needs. */
export const needed = (vote: "majority" | "twothirds", total: number) => (vote === "majority" ? Math.floor(total / 2) + 1 : Math.ceil((total * 2) / 3));

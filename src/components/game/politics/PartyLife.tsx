"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { ui } from "@/components/ui/classes";
import { formatMonth } from "@/engine/calendar";
import type { GoneParty, Party } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";

type T = (key: MessageKey, vars?: Record<string, string | number>) => string;

/** A party's name as the player reads it: one the engine made reads by its camp, or the party it left, until the game master names it (engine/partyLife.ts). */
export function partyName(p: Pick<Party, "name" | "unnamed" | "origin">, t: T): string {
  if (!p.unnamed || !p.origin) return p.name;
  return p.origin.from ? t("politics.unnamedSplit", { party: p.origin.from }) : t("politics.unnamed", { camp: t(`politics.camp.${p.origin.camp}` as MessageKey) });
}

/** How strong an outlawed party's organisation is, and who backs it from abroad. */
export function UndergroundStrength({ party, backer }: { party: Party; backer?: string }) {
  const { t } = useI18n();
  if (party.strength === undefined) return null;
  const strength = Math.round(party.strength);
  return (
    <div className="mt-2" title={t("politics.strengthNote")}>
      <div className="flex items-center justify-between gap-2 text-2xs font-bold text-muted">
        <span>{t("politics.strength")}</span>
        <span className="tabular-nums text-ink">{strength}/100</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-divider">
        <div className="h-full rounded-full bg-war" style={{ width: `${strength}%` }} />
      </div>
      {backer && <div className="mt-1 text-2xs font-medium text-muted">{t("politics.backer", { country: backer })}</div>}
    </div>
  );
}

/** The parties that ended in play, folded: each with how and when it ended, the latest first. */
export function GoneParties({ gone }: { gone: GoneParty[] }) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  if (!gone.length) return null;
  return (
    <section className="rounded-xl border border-line sheet">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
        <span className={ui.label}>{t("politics.gone", { n: gone.length })}</span>
        <ChevronDown className={`ml-auto h-3.5 w-3.5 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul className="grid gap-1.5 border-t border-divider px-3 py-2.5">
          {[...gone].reverse().map((g) => (
            <li key={`${g.id}-${g.turn}`} className="flex items-baseline gap-2 text-xs">
              <span className="h-2 w-2 shrink-0 rounded-full bg-muted" style={g.color ? { background: g.color } : undefined} />
              <span className="min-w-0 flex-1 truncate font-bold text-ink">{partyName(g, t)}</span>
              <span className="shrink-0 text-2xs font-medium text-muted">
                {t(`politics.goneHow.${g.how}` as MessageKey, { party: g.into ?? "" })} · {formatMonth(g.date, locale)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

"use client";

import { Landmark } from "lucide-react";
import { useMemo, useState } from "react";
import Dialog from "@/components/ui/Dialog";
import { ui } from "@/components/ui/classes";
import { formatDate } from "@/engine/calendar";
import { provisionalChance, takenIndex } from "@/engine/provisional";
import type { GameState } from "@/engine/types";
import { exileSupport, holdingLand, monthsLeft } from "@/engine/warEnd";
import { useI18n } from "@/i18n/useI18n";

interface SettlementCardProps {
  state: GameState;
  /** The country on the card. */
  tag: string;
  /** Adds an order to the turn. */
  onOrder: (order: string) => void;
  /** The player cannot give orders now (not governing, or a turn under way). */
  disabled?: boolean;
}

/** A 0–100 figure as a thin bar. */
function Bar({ value }: { value: number }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-divider" aria-hidden>
      <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(3, Math.min(100, value))}%` }} />
    </div>
  );
}

/**
 * A country's card, on how its war may end and who governs it
 * (engine/provisional.ts, engine/warEnd.ts): a provisional government – who
 * set it up, how far its people accept it, who abroad recognises it, the
 * land still to pass, and for the player's own the orders to grant it
 * independence or annex it; a government in exile – its host, its standing
 * and how soon it gives up; and, where the player has taken the country or
 * most of it, the order to set up a government there.
 */
export default function SettlementCard({ state, tag, onOrder, disabled }: SettlementCardProps) {
  const { t, text, locale } = useI18n();
  // The country a government is being set up in: this one, or one picked from the player's own card.
  const [target, setTarget] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [leader, setLeader] = useState("");
  const [land, setLand] = useState<"now" | "gradual">("gradual");
  const country = state.countries[tag];
  const own = tag === state.player;
  const chance = useMemo(() => (own ? null : provisionalChance(state, state.player, tag)), [state, tag, own]);
  // On the player's own card: every country it may set a government up in, those whose government is gone among them.
  const candidates = useMemo(() => {
    if (!own) return [];
    const index = takenIndex(state);
    const holders = holdingLand(state);
    return [...index.keys()]
      .filter((t2) => t2 !== state.player && state.countries[t2])
      .map((t2) => ({ tag: t2, chance: provisionalChance(state, state.player, t2, index, holders) }))
      .filter((x): x is { tag: string; chance: NonNullable<typeof x.chance> } => Boolean(x.chance))
      .sort((a, b) => b.chance.land.length - a.chance.land.length || a.tag.localeCompare(b.tag))
      .slice(0, 5);
  }, [state, own]);
  const exile = useMemo(() => {
    if (!country?.exile || own || country.dormant) return null;
    const support = exileSupport(state, tag);
    const standing = country.exile.standing ?? 50;
    return { standing, months: monthsLeft(standing, support.total), host: country.exile.host };
  }, [state, tag, country, own]);
  if (!country) return null;
  const client = country.client;
  const nameOf = (t2: string) => text(state.countries[t2]?.name ?? t2);
  const countryName = text(country.name);
  if (!client && !exile && !chance && !candidates.length) return null;

  const order = () =>
    [
      t("provisional.order", { country: nameOf(target ?? tag) }),
      name.trim() ? t("provisional.orderName", { name: name.trim() }) : "",
      leader.trim() ? t("provisional.orderLeader", { leader: leader.trim() }) : "",
      t(land === "now" ? "provisional.orderNow" : "provisional.orderGradual"),
    ].join("");

  return (
    <div className="flex flex-col gap-2.5 rounded-xl bg-page p-3">
      {client && (
        <div className="grid gap-2">
          <div className={`${ui.label} flex items-center gap-1.5`}>
            <Landmark className="h-3.5 w-3.5" />
            {t("provisional.title")}
          </div>
          <p className="text-xs font-medium text-muted">{t("provisional.client", { patron: nameOf(client.patron), date: formatDate(client.since, locale) })}</p>
          <div className="grid gap-1" title={t("provisional.acceptedHint")}>
            <div className="flex items-center justify-between text-xs">
              <span className="cursor-help font-bold text-muted">{t("provisional.accepted")}</span>
              <span className="font-black tabular-nums text-ink">{client.accepted}</span>
            </div>
            <Bar value={client.accepted} />
          </div>
          <p className="text-xs font-medium text-muted" title={[...client.recognised.slice(0, 12).map(nameOf)].join(", ")}>
            {t("provisional.recognised", { n: client.recognised.length, m: client.refused.length })}
          </p>
          {client.land.length > 0 && <p className="text-xs font-medium text-muted">{t("provisional.landLeft", { n: client.land.length })}</p>}
          {client.patron === state.player && (
            <div className="flex flex-wrap gap-1.5">
              <button type="button" disabled={disabled} onClick={() => onOrder(t("provisional.orderIndependence", { country: countryName }))} className={`${ui.secondary} px-3 py-1.5 text-xs`}>
                {t("provisional.independence")}
              </button>
              <button type="button" disabled={disabled} onClick={() => onOrder(t("provisional.orderAnnex", { country: countryName }))} className={`${ui.secondary} px-3 py-1.5 text-xs`}>
                {t("provisional.annex")}
              </button>
            </div>
          )}
        </div>
      )}

      {exile && (
        <div className="grid gap-1.5">
          <div className={ui.label}>{t("provisional.exile")}</div>
          {exile.host && <p className="text-xs font-medium text-muted">{t("provisional.hosted", { host: nameOf(exile.host) })}</p>}
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-muted">{t("provisional.standing")}</span>
            <span className="font-black tabular-nums text-ink">{Math.round(exile.standing)}</span>
          </div>
          <Bar value={exile.standing} />
          <p className="text-xs font-medium text-muted">{exile.months !== undefined ? t("provisional.fades", { n: exile.months }) : t("provisional.holdsOn")}</p>
        </div>
      )}

      {chance && (
        <div className="grid gap-1.5">
          {!client && !exile && <div className={ui.label}>{t("provisional.title")}</div>}
          <p className="text-xs font-medium leading-snug text-muted">{chance.revive ? t("provisional.canRevive") : t("provisional.can", { n: chance.land.length })}</p>
          <button type="button" disabled={disabled} onClick={() => setTarget(tag)} title={t("provisional.hint")} className={`${ui.secondary} w-full py-2 text-xs`}>
            <Landmark className="h-3.5 w-3.5" />
            {t("provisional.action")}
          </button>
        </div>
      )}

      {candidates.length > 0 && (
        <div className="grid gap-1.5">
          <div className={`${ui.label} flex items-center gap-1.5`} title={t("provisional.hint")}>
            <Landmark className="h-3.5 w-3.5" />
            {t("provisional.title")}
          </div>
          <ul className="grid gap-1">
            {candidates.map((c) => (
              <li key={c.tag} className="flex items-center justify-between gap-2 text-xs">
                <span className="min-w-0 truncate font-bold text-ink" title={c.chance.revive ? t("provisional.canRevive") : t("provisional.can", { n: c.chance.land.length })}>
                  {nameOf(c.tag)} <span className="font-medium tabular-nums text-muted">· {c.chance.land.length}</span>
                </span>
                <button type="button" disabled={disabled} onClick={() => setTarget(c.tag)} className={`${ui.secondary} shrink-0 px-2 py-1 text-2xs`}>
                  {t("provisional.action")}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Dialog
        open={target !== null}
        onClose={() => setTarget(null)}
        title={`${t("provisional.title")}: ${target ? nameOf(target) : countryName}`}
        footer={
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              onOrder(order());
              setTarget(null);
            }}
            className={`${ui.primary} w-full py-3 text-sm`}
          >
            {t("provisional.submit")}
          </button>
        }
      >
        <div className="grid gap-3">
          <p className="text-xs font-medium leading-snug text-muted">{t("provisional.hint")}</p>
          <label className="grid gap-1">
            <span className={ui.label}>{t("provisional.name")}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder={t("provisional.namePlaceholder")} className={ui.input} />
          </label>
          <label className="grid gap-1">
            <span className={ui.label}>{t("provisional.leader")}</span>
            <input value={leader} onChange={(e) => setLeader(e.target.value)} maxLength={120} placeholder={t("provisional.leaderPlaceholder")} className={ui.input} />
          </label>
          <div className="grid gap-1">
            <span className={ui.label}>{t("provisional.land")}</span>
            <div className="flex gap-1 rounded-xl bg-page p-1" role="tablist">
              {(["gradual", "now"] as const).map((k) => (
                <button key={k} type="button" role="tab" aria-selected={land === k} onClick={() => setLand(k)} className={`${ui.segment} flex-1 ${land === k ? `${ui.segmentOn} bg-surface shadow-sm` : ui.segmentOff}`}>
                  {t(k === "now" ? "provisional.landNow" : "provisional.landGradual")}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

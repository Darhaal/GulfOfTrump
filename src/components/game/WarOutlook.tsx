"use client";

import { useMemo, type ReactNode } from "react";
import { ui } from "@/components/ui/classes";
import { Term, TextTip } from "@/components/ui/Term";
import { formatDate } from "@/engine/calendar";
import { fogOn } from "@/engine/fog";
import type { GameState, MapIndex, PeaceTerms, War } from "@/engine/types";
import { PEACE_TERMS } from "@/engine/types";
import { provisionalChance } from "@/engine/provisional";
import { dictable, warOutlook, type ExileView, type SideState, type WarEnd } from "@/engine/warEnd";
import { useI18n } from "@/i18n/useI18n";

/** How each side's state is drawn: holding plain, collapsing in the accent, broken in the war's red, in exile in the sea's blue. */
const TONE: Record<SideState, string> = {
  holding: "bg-divider text-ink",
  collapsing: "bg-accent/15 text-accent",
  broken: "bg-war/15 text-war",
  exile: "bg-sea text-ink",
};

interface WarOutlookProps {
  state: GameState;
  war: War;
  index: MapIndex | null;
  /** How each side is labelled, attackers first. */
  labels: [ReactNode, ReactNode];
  /** Adds an order to the turn: the terms the player dictates. Without it the terms are not offered. */
  onOrder?: (order: string) => void;
  disabled?: boolean;
}

/**
 * How a war is likely to end (engine/warEnd.ts), briefly: each side's state
 * – holding, collapsing, broken, in exile – with its will or its government
 * in exile's standing; what would end the war and how close each is; one
 * sentence on the likeliest. When the player's enemy has collapsed or asked
 * for terms, the terms the player may dictate, each an order with its
 * consequences on hover. With the fog of war, the enemy's figures are the
 * intelligence's estimate, to the nearest ten. Hints are Tips, with the
 * glossary's terms inside (components/ui/Term.tsx).
 */
export default function WarOutlook({ state, war, index, labels, onOrder, disabled }: WarOutlookProps) {
  const { t, text, locale } = useI18n();
  const outlook = useMemo(() => warOutlook(state, war, index?.regions ?? null), [state, war, index]);
  const terms = useMemo(() => (onOrder ? dictable(state).filter((d) => d.war.id === war.id) : []), [state, war, onOrder]);
  const fog = fogOn(state);
  const name = (tag: string) => text(state.countries[tag]?.name ?? tag);
  const mine = (tags: string[]) => tags.includes(state.player);
  const rough = (n: number, side: string[]) => (fog && !mine(side) ? `≈ ${Math.round(n / 10) * 10}` : String(n));

  const supportHint = (e: ExileView) =>
    t("outlook.support", {
      allies: `${Math.round(e.support.allies * 100)}%`,
      host: e.support.hostTag ? name(e.support.hostTag) : "–",
      army: `${Math.round(e.support.army * 100)}%`,
      resistance: `${Math.round(e.support.resistance * 100)}%`,
      total: e.support.total,
    });
  const exileLine = (e: ExileView) => (
    <TextTip text={supportHint(e)} className="cursor-help">
      {t("outlook.standing", { n: e.standing })} · {e.months !== undefined ? t("outlook.fades", { n: e.months }) : t("outlook.holdsOn")}
    </TextTip>
  );
  const endText = (e: WarEnd) => t(`outlook.end.${e.kind === "none" ? "allies" : e.kind}`, { country: name(e.tag) });
  const valueText = (e: WarEnd) => {
    if (e.value === undefined) return "";
    switch (e.kind) {
      case "exile":
        return t("outlook.value.months", { n: e.value });
      case "will":
        return fog && !mine(war[e.side]) ? `≈ ${t("outlook.value.points", { n: Math.round(e.value / 10) * 10 })}` : t("outlook.value.points", { n: e.value });
      case "land":
        return t("outlook.value.left", { n: e.value });
      case "allies":
        return t("outlook.value.allies", { n: e.value });
      default:
        return "";
    }
  };
  const chip = (s: SideState) => (
    <TextTip text={t(`outlook.stateHint.${s}`)} label={t(`outlook.state.${s}`)} className={`cursor-help rounded-md px-1.5 py-0.5 text-2xs font-black uppercase tracking-wider ${TONE[s]}`}>
      {t(`outlook.state.${s}`)}
    </TextTip>
  );

  return (
    <div>
      <div className={`${ui.label} mb-1`}>
        <TextTip text={t("outlook.hint")} label={t("outlook.title")} className="cursor-help">
          {t("outlook.title")}
        </TextTip>
      </div>
      <ul className="grid gap-1">
        {outlook.sides.map((s, i) => (
          <li key={s.side} className="grid gap-0.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
              <span className="inline-flex">{labels[i]}</span>
              {chip(s.state)}
              <span className="font-medium tabular-nums text-muted">
                {s.exile ? (
                  exileLine(s.exile)
                ) : (
                  <>
                    <Term id="will">{t("outlook.will", { n: rough(s.will, war[s.side]) })}</Term> ·{" "}
                    <TextTip text={t("outlook.holdsHint")} className="cursor-help">
                      {t("outlook.holds", { n: s.holds, m: s.owns })}
                    </TextTip>
                  </>
                )}
              </span>
            </div>
            {s.members.map((m) => (
              <div key={m.tag} className="flex flex-wrap items-center gap-x-2 pl-3 text-2xs font-medium text-muted">
                <span className="font-bold text-ink">{name(m.tag)}</span>
                {chip(m.state)}
                {m.exile && exileLine(m.exile)}
              </div>
            ))}
          </li>
        ))}
      </ul>
      {outlook.ends.length > 0 && (
        <div className="mt-2">
          <div className="text-2xs font-black uppercase tracking-wider text-muted">{t("outlook.ends")}</div>
          <ul className="mt-0.5 grid gap-1">
            {outlook.ends.slice(0, 3).map((e) => (
              <TextTip as="li" key={`${e.kind}:${e.tag}:${e.side}`} text={t(`outlook.endHint.${e.kind === "none" ? "allies" : e.kind}`)} label={endText(e)} className="grid gap-0.5 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/50">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="min-w-0 cursor-help font-medium text-ink">{endText(e)}</span>
                  <span className="shrink-0 font-bold tabular-nums text-muted">{valueText(e)}</span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-divider" aria-hidden>
                  <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(4, Math.round(e.near * 100))}%` }} />
                </div>
              </TextTip>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-1.5 text-xs font-bold leading-snug text-ink">{outlook.likely.kind === "none" ? t("outlook.none") : t("outlook.likely", { what: endText(outlook.likely) })}</p>

      {terms.length > 0 && onOrder && (
        <div className="mt-2 grid gap-2 border-t border-divider pt-2">
          <div className={ui.label}>{t("terms.title")}</div>
          {terms.map((d) => {
            const offer = d.war.offers?.find((o) => o.by === d.enemy);
            const country = name(d.enemy);
            const order = (k: PeaceTerms) => t(`terms.order.${k}`, { country });
            const drafted = PEACE_TERMS.some((k) => state.draft.includes(order(k)));
            // A government only where the player holds enough of the country to set one up (engine/provisional.ts).
            const canGovern = Boolean(provisionalChance(state, state.player, d.enemy));
            return (
              <div key={d.enemy} className="grid gap-1.5">
                <p className="text-xs font-medium leading-snug text-ink">{offer ? t("terms.why.offer", { country, date: formatDate(offer.until, locale) }) : t(`terms.why.${d.why}`, { country })}</p>
                <div className="flex flex-wrap gap-1">
                  {PEACE_TERMS.map((k) => (
                    <TextTip
                      as="button"
                      key={k}
                      text={t(`terms.hint.${k}`)}
                      label={t(`terms.${k}`)}
                      pinnable={false}
                      disabled={disabled || drafted || (k === "government" && !canGovern)}
                      onClick={() => onOrder(order(k))}
                      className={`${ui.secondary} px-2 py-1 text-2xs ${state.draft.includes(order(k)) ? "border-accent text-accent" : ""}`}
                    >
                      {t(`terms.${k}`)}
                    </TextTip>
                  ))}
                </div>
                {drafted && <p className="text-2xs font-bold text-muted">{t("terms.inOrders")}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

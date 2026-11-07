"use client";

import { Briefcase, CalendarClock, Check, Clock, EyeOff, Flame, Infinity as Always, Lock } from "lucide-react";
import { useState } from "react";
import Dialog from "@/components/ui/Dialog";
import { ui } from "@/components/ui/classes";
import type { AdvisorId } from "@/engine/advisors";
import { addDays, daysBetween, formatDate } from "@/engine/calendar";
import { ministryIcon, ministryTitle, openMinistries } from "@/engine/ministries";
import { daysOf, MAX_ORDER_DAYS, metaOf, type OrderChange, QUICK_DAYS, spanEnd, spanOf, turnsLeft } from "@/engine/orderMeta";
import { isOpposition } from "@/engine/role";
import type { GameState, OrderPriority } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import { MINISTRY_ICON_SET } from "./ministryIcons";

/** The ministries an order may be entrusted to or kept from: the open ones, none for an opposition player. */
const ministriesFor = (state: GameState): AdvisorId[] => (isOpposition(state) ? [] : openMinistries(state));

/**
 * An order's marks on its card (engine/orderMeta.ts): the ministry entrusted with it, how many it is kept from, and
 * the date it stands until – each a small icon with its words on hover; a click opens the order's settings.
 */
export function OrderBadges({ state, order, disabled, onOpen }: { state: GameState; order: string; disabled?: boolean; onOpen: () => void }) {
  const { t, text, locale } = useI18n();
  const m = metaOf(state, order);
  if (!m) return null;
  const name = (id: AdvisorId) => text(ministryTitle(state, id));
  const marks: { icon: typeof Clock; label: string; accent?: boolean; count?: number }[] = [];
  if (m.to) marks.push({ icon: MINISTRY_ICON_SET[ministryIcon(state, m.to)], label: t("orders.mods.to", { ministry: name(m.to) }), accent: true });
  if (m.hiddenFrom?.length) marks.push({ icon: EyeOff, label: t("orders.mods.hidden", { list: m.hiddenFrom.map(name).join(", ") }), count: m.hiddenFrom.length });
  if (m.priority) marks.push({ icon: Flame, label: t(`orders.priority.${m.priority}` as MessageKey), accent: m.priority === "urgent" });
  if (m.secret) marks.push({ icon: Lock, label: t("orders.mods.secret") });
  if (m.from && m.from >= state.date) marks.push({ icon: CalendarClock, label: t("orders.mods.waits", { date: formatDate(m.from, locale) }) });
  if (m.until) marks.push({ icon: Clock, label: t("orders.mods.until", { date: formatDate(m.until, locale), n: turnsLeft(state, m.until) }) });
  if (!marks.length) return null;
  return (
    <button type="button" disabled={disabled} onClick={onOpen} className="-my-0.5 flex shrink-0 items-center gap-0.5 rounded-lg px-1 py-0.5 hover:bg-divider" aria-label={marks.map((x) => x.label).join("; ")}>
      {marks.map(({ icon: Icon, label, accent, count }) => (
        <span key={label} title={label} className={`inline-flex items-center gap-0.5 text-2xs font-black tabular-nums ${accent ? "text-accent" : "text-muted"}`}>
          <Icon className="h-3.5 w-3.5" />
          {count && count > 1 ? count : null}
        </span>
      ))}
    </button>
  );
}

/** A ministry as a small icon to press: its name on hover, marked when chosen (crossed out when kept from it). */
function MinistryToggle({ state, id, on, kind, onClick }: { state: GameState; id: AdvisorId; on: boolean; kind: "to" | "hide"; onClick: () => void }) {
  const { text } = useI18n();
  const Icon = MINISTRY_ICON_SET[ministryIcon(state, id)];
  const name = text(ministryTitle(state, id));
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={name}
      title={name}
      className={`relative grid h-10 w-10 place-items-center rounded-xl border transition-colors ${
        on ? (kind === "to" ? "border-accent bg-accent text-on-ink" : "border-ink bg-ink text-on-ink") : "border-line sheet text-muted hover:border-accent/40 hover:text-ink"
      }`}
    >
      <Icon className="h-4.5 w-4.5" />
      {on && kind === "hide" && <EyeOff className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-surface p-0.5 text-ink" />}
    </button>
  );
}

/** A number of days, typed, within bounds. */
function DaysInput({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  // The input recipe fills its box: the box is what keeps it narrow.
  return (
    <span className="inline-block w-20 shrink-0">
      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={MAX_ORDER_DAYS}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Math.max(1, Math.min(MAX_ORDER_DAYS, Math.round(Number(e.target.value) || 1))))}
        className={`${ui.input} px-2 py-1.5 text-center text-sm font-bold tabular-nums`}
      />
    </span>
  );
}

type SpanChoice = "turn" | "days" | "always";

/**
 * How an order is carried out, set in a pop-up: the ministry entrusted with it and those kept from it, each an icon
 * with its name on hover; how pressing and how secret it is; when it begins; how long it runs, in days typed or picked
 * – 50 days on weekly turns is eight turns.
 */
export function OrderModifiersDialog({ state, order, onSave, onClose }: { state: GameState; order: string; onSave: (change: OrderChange) => void; onClose: () => void }) {
  const { t, text, locale } = useI18n();
  const m = metaOf(state, order);
  const ministries = ministriesFor(state);
  const [to, setTo] = useState<AdvisorId | null>(m?.to ?? null);
  const [hidden, setHidden] = useState<AdvisorId[]>(m?.hiddenFrom ?? []);
  const was = spanOf(state, order);
  const [span, setSpan] = useState<SpanChoice>(was === "turn" || was === "always" ? was : "days");
  const [days, setDays] = useState<number>(daysOf(state, order));
  const [priority, setPriority] = useState<OrderPriority | null>(m?.priority ?? null);
  const [secret, setSecret] = useState(Boolean(m?.secret));
  const [later, setLater] = useState(Boolean(m?.from && m.from > state.date));
  const [startIn, setStartIn] = useState<number>(m?.from ? Math.max(1, daysBetween(state.date, m.from)) : 7);
  const name = (id: AdvisorId) => text(ministryTitle(state, id));
  const start = later ? addDays(state.date, startIn) : state.date;
  const until = span === "days" ? spanEnd(start, "days", days) : undefined;
  const turns = until ? turnsLeft({ date: start, step: state.step }, until) : 0;
  const segment = (on: boolean) => `${ui.segment} inline-flex items-center gap-1 ${on ? `${ui.segmentOn} bg-surface shadow-sm` : ui.segmentOff}`;
  const heading = (Icon: typeof Clock, label: string) => (
    <div className={`${ui.label} flex items-center gap-1.5`}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </div>
  );

  return (
    <Dialog
      open
      onClose={onClose}
      wide
      title={t("orders.mods.title")}
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={`${ui.secondary} px-4 py-2.5 text-xs`}>
            {t("orders.cancel")}
          </button>
          <button
            type="button"
            onClick={() => onSave({ to, hiddenFrom: hidden.filter((h) => h !== to), span, days, priority, secret, startIn: later ? startIn : 0 })}
            className={`${ui.primary} px-5 py-2.5 text-xs`}
          >
            <Check className="h-4 w-4" />
            {t("orders.save")}
          </button>
        </div>
      }
    >
      <div className="grid gap-5">
        <blockquote className="rounded-xl bg-page px-3.5 py-2.5 text-sm font-medium leading-relaxed text-ink">{order}</blockquote>

        {ministries.length > 0 && (
          <section className="grid gap-2">
            {heading(Briefcase, t("orders.mods.toTitle"))}
            <div className="flex flex-wrap gap-1.5">
              {ministries.map((id) => (
                <MinistryToggle key={id} state={state} id={id} kind="to" on={to === id} onClick={() => setTo((x) => (x === id ? null : id))} />
              ))}
            </div>
            <p className="text-xs font-medium text-muted">{to ? t("orders.mods.toChosen", { ministry: name(to) }) : t("orders.mods.toHint")}</p>
          </section>
        )}

        {ministries.length > 0 && (
          <section className="grid gap-2">
            {heading(EyeOff, t("orders.mods.hiddenTitle"))}
            <div className="flex flex-wrap gap-1.5">
              {ministries.map((id) =>
                id === to ? null : (
                  <MinistryToggle key={id} state={state} id={id} kind="hide" on={hidden.includes(id)} onClick={() => setHidden((h) => (h.includes(id) ? h.filter((x) => x !== id) : [...h, id]))} />
                ),
              )}
            </div>
            <p className="text-xs font-medium text-muted">{hidden.filter((h) => h !== to).length ? t("orders.mods.hiddenChosen", { list: hidden.filter((h) => h !== to).map(name).join(", ") }) : t("orders.mods.hiddenHint")}</p>
          </section>
        )}

        <section className="grid gap-2">
          {heading(Flame, t("orders.mods.priorityTitle"))}
          <div className="flex flex-wrap gap-1 rounded-xl bg-page p-1">
            {([null, "high", "urgent"] as const).map((p) => (
              <button key={p ?? "normal"} type="button" onClick={() => setPriority(p)} className={segment(priority === p)}>
                {t(`orders.priority.${p ?? "normal"}` as MessageKey)}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs font-bold text-ink">
            <input type="checkbox" checked={secret} onChange={(e) => setSecret(e.target.checked)} className="h-4 w-4 accent-[var(--color-accent)]" />
            <Lock className="h-3.5 w-3.5 text-muted" />
            {t("orders.mods.secret")}
          </label>
          <p className="text-xs font-medium text-muted">{t("orders.mods.secretHint")}</p>
        </section>

        <section className="grid gap-2">
          {heading(Clock, t("orders.mods.spanTitle"))}
          <label className="flex flex-wrap items-center gap-2 text-xs font-bold text-ink">
            <input type="checkbox" checked={later} onChange={(e) => setLater(e.target.checked)} className="h-4 w-4 accent-[var(--color-accent)]" />
            {t("orders.mods.later")}
            {later && (
              <>
                <DaysInput value={startIn} onChange={setStartIn} label={t("orders.mods.laterDays")} />
                <span className="font-medium text-muted">{t("orders.mods.laterFrom", { date: formatDate(start, locale) })}</span>
              </>
            )}
          </label>
          <div className="flex flex-wrap gap-1 rounded-xl bg-page p-1">
            {(["turn", "days", "always"] as const).map((s) => (
              <button key={s} type="button" onClick={() => setSpan(s)} className={segment(span === s)}>
                {s === "always" && <Always className="h-3.5 w-3.5" />}
                {t(`orders.span.${s}` as MessageKey)}
              </button>
            ))}
          </div>
          {span === "days" && (
            <div className="flex flex-wrap items-center gap-1.5">
              <DaysInput value={days} onChange={setDays} label={t("orders.mods.daysLabel")} />
              <span className="text-xs font-bold text-muted">{t("orders.mods.daysUnit")}</span>
              {QUICK_DAYS.map((d) => (
                <button key={d} type="button" onClick={() => setDays(d)} className={`rounded-lg border px-2 py-1 text-2xs font-bold ${days === d ? "border-ink bg-ink text-on-ink" : "border-line sheet text-muted hover:text-ink"}`}>
                  {t(`orders.quick.${d}` as MessageKey)}
                </button>
              ))}
            </div>
          )}
          <p className="text-xs font-medium text-muted">
            {span === "turn"
              ? later
                ? t("orders.mods.spanTurnLater", { date: formatDate(start, locale) })
                : t("orders.mods.spanTurn")
              : span === "always"
                ? t("orders.mods.spanAlways")
                : t("orders.mods.spanUntil", { date: formatDate(until!, locale), n: turns })}
          </p>
        </section>
      </div>
    </Dialog>
  );
}

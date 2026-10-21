"use client";

import { CalendarPlus, Handshake, Mic, Search, Swords, Users, X } from "lucide-react";
import { useMemo, useState } from "react";
import Flag from "@/components/Flag";
import { ui } from "@/components/ui/classes";
import Dictation from "@/components/voice/Dictation";
import { addStep, formatDate } from "@/engine/calendar";
import { BLOC_KINDS, canHoldNow, type BlocKind } from "@/engine/foreign";
import type { GameState, Proposal, Summit } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";

interface ForeignPanelProps {
  state: GameState;
  disabled: boolean;
  onPropose: (proposal: Proposal) => void;
  onWithdraw: (id: string) => void;
  onSchedule: (summit: Summit) => void;
  onOpenSummit: (summit: Summit) => void;
  /** Hold a planned meeting in person now. */
  onLive: (summit: Summit) => void;
  /** Call a meeting of a bloc the player belongs to, now, in person. */
  onConvene: (bloc: string, agenda: string) => void;
}

/** A searchable list of countries to tick, for invitations and summits. */
function CountryPicker({ state, picked, onChange }: { state: GameState; picked: string[]; onChange: (tags: string[]) => void }) {
  const { t, text, locale } = useI18n();
  const [query, setQuery] = useState("");
  const options = useMemo(
    () =>
      Object.values(state.countries)
        .filter((c) => c.tag !== state.player && !c.dormant)
        .sort((a, b) => text(a.name).localeCompare(text(b.name), locale)),
    [state.countries, state.player, text, locale],
  );
  const q = query.trim().toLowerCase();
  const shown = options.filter((c) => !q || text(c.name).toLowerCase().includes(q) || c.tag.includes(q)).slice(0, 40);
  const toggle = (tag: string) => onChange(picked.includes(tag) ? picked.filter((x) => x !== tag) : [...picked, tag]);
  return (
    <div className="grid gap-2">
      {picked.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {picked.map((tag) => (
            <button key={tag} type="button" onClick={() => toggle(tag)} className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-2 py-1 text-xs font-bold text-on-ink">
              <Flag tag={tag} scenario={state.scenarioId} color={state.countries[tag]?.color} size="sm" />
              {text(state.countries[tag]?.name ?? tag)}
              <X className="h-3 w-3" />
            </button>
          ))}
        </div>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("foreign.search")} className={`${ui.input} py-2 pl-9`} />
      </div>
      <div className="grid max-h-40 gap-0.5 overflow-y-auto rounded-xl border border-line bg-surface p-1">
        {shown.map((c) => (
          <label key={c.tag} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-bold text-ink hover:bg-page">
            <input type="checkbox" checked={picked.includes(c.tag)} onChange={() => toggle(c.tag)} className="h-3.5 w-3.5 accent-current" />
            <Flag tag={c.tag} scenario={state.scenarioId} color={c.color} size="sm" />
            {text(c.name)}
          </label>
        ))}
      </div>
    </div>
  );
}

/**
 * Foreign policy at a glance and in hand: wars and truces, the blocs with
 * their kind, members and terms, the player's invitations waiting for
 * answers, summits planned and held — and forms to found a bloc or propose
 * a summit, which go out with the next turn.
 */
export default function ForeignPanel({ state, disabled, onPropose, onWithdraw, onSchedule, onOpenSummit, onLive, onConvene }: ForeignPanelProps) {
  const { t, text, locale } = useI18n();
  const name = (tag: string) => text(state.countries[tag]?.name ?? tag);
  const [form, setForm] = useState<"bloc" | "summit" | null>(null);
  const [kind, setKind] = useState<BlocKind>("alliance");
  const [title, setTitle] = useState("");
  const [terms, setTerms] = useState("");
  const [place, setPlace] = useState("");
  const [date, setDate] = useState(() => addStep(state.date, "month"));
  const [picked, setPicked] = useState<string[]>([]);
  const [convening, setConvening] = useState<string | null>(null);
  const [agenda, setAgenda] = useState("");
  const [openBlocs, setOpenBlocs] = useState<Set<string>>(new Set());
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [kindShown, setKindShown] = useState<BlocKind | null>(null);
  const periodEnd = addStep(state.date, state.step);

  const reset = () => {
    setForm(null);
    setTitle("");
    setTerms("");
    setPlace("");
    setPicked([]);
  };
  const mine = (tags: string[]) => tags.includes(state.player);
  const wars = [...state.wars].sort((a, b) => Number(mine([...b.attackers, ...b.defenders])) - Number(mine([...a.attackers, ...a.defenders])));
  const blocs = [...state.alliances].sort((a, b) => Number(mine(b.members)) - Number(mine(a.members)));
  const ours = blocs.filter((a) => mine(a.members));
  // The country's own blocs first; the whole world's on request, by kind.
  const shown = (scope === "mine" && ours.length ? ours : blocs).filter((a) => !kindShown || (a.kind ?? "alliance") === kindShown);
  const summits = [...(state.summits ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  const chip = (tag: string) => (
    <span key={tag} className="inline-flex items-center gap-1 text-xs font-bold text-ink">
      <Flag tag={tag} scenario={state.scenarioId} color={state.countries[tag]?.color} size="sm" />
      {name(tag)}
    </span>
  );

  return (
    <div className="flex flex-col gap-5">
      <section>
        <div className={`${ui.label} mb-2 flex items-center gap-1.5`}>
          <Swords className="h-3.5 w-3.5" />
          {t("foreign.wars")}
        </div>
        {wars.length === 0 ? (
          <p className="text-xs font-medium text-muted">{t("foreign.noWars")}</p>
        ) : (
          <ul className="grid gap-1.5">
            {wars.map((w) => (
              <li key={w.id} className="rounded-xl bg-page px-3 py-2">
                <div className="text-sm font-black text-ink">{text(w.name)}</div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  {w.attackers.map(chip)}
                  <span className="text-2xs font-black text-muted">vs</span>
                  {w.defenders.map(chip)}
                </div>
                {w.truce && (
                  <div className="mt-1.5 inline-block rounded-md bg-amber-50 px-2 py-0.5 text-2xs font-black uppercase tracking-wider text-amber-700">
                    {t("foreign.truceUntil", { date: formatDate(w.truce.until, locale) })}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className={`${ui.label} mb-2 flex items-center gap-1.5`}>
          <Handshake className="h-3.5 w-3.5" />
          {t("foreign.blocs")}
        </div>
        {blocs.length > 0 && (
          <div className="mb-2 grid gap-1.5">
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-page p-1">
              {(["mine", "all"] as const).map((id) => (
                <button key={id} type="button" onClick={() => setScope(id)} aria-pressed={scope === id} className={`${ui.segment} ${scope === id ? `${ui.segmentOn} bg-surface shadow-sm` : ui.segmentOff}`}>
                  {t(`foreign.scope.${id}` as MessageKey, { n: id === "mine" ? ours.length : blocs.length })}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              {[null, ...BLOC_KINDS].map((k) => (
                <button
                  key={k ?? "any"}
                  type="button"
                  onClick={() => setKindShown(k)}
                  aria-pressed={kindShown === k}
                  className={`rounded-md px-2 py-0.5 text-2xs font-black uppercase tracking-wider transition-colors ${kindShown === k ? "bg-ink text-on-ink" : "bg-page text-muted hover:text-ink"}`}
                >
                  {k ? t(`foreign.kind.${k}` as MessageKey) : t("foreign.kind.any")}
                </button>
              ))}
            </div>
          </div>
        )}
        {blocs.length === 0 ? (
          <p className="text-xs font-medium text-muted">{t("foreign.noBlocs")}</p>
        ) : (
          <ul className="grid gap-1.5">
            {shown.map((a) => (
              <li key={a.id} className="rounded-xl bg-page px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-black text-ink">{text(a.name)}</span>
                  <span className="shrink-0 rounded-md bg-surface px-1.5 py-0.5 text-2xs font-black uppercase tracking-wider text-muted">
                    {t(`foreign.kind.${a.kind ?? "alliance"}` as MessageKey)}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                  {(a.members.length > 14 && !openBlocs.has(a.id) ? a.members.slice(0, 12) : a.members).map(chip)}
                  {a.members.length > 14 && !openBlocs.has(a.id) && (
                    <button type="button" onClick={() => setOpenBlocs((s) => new Set(s).add(a.id))} className="text-2xs font-black uppercase tracking-wider text-muted hover:text-accent">
                      {t("foreign.more", { n: a.members.length - 12 })}
                    </button>
                  )}
                </div>
                {(a.terms || a.until) && (
                  <div className="mt-1 text-xs font-medium text-muted">
                    {a.terms ? text(a.terms) : ""}
                    {a.terms && a.until ? " · " : ""}
                    {a.until ? t("foreign.until", { date: formatDate(a.until, locale) }) : ""}
                  </div>
                )}
                {a.members.includes(state.player) &&
                  (convening === a.id ? (
                    <div className="mt-2 grid gap-1.5">
                      <input value={agenda} onChange={(e) => setAgenda(e.target.value)} placeholder={t("foreign.sessionAgenda")} className={`${ui.input} py-2`} />
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            onConvene(a.id, agenda.trim());
                            setConvening(null);
                            setAgenda("");
                          }}
                          className={`${ui.primary} flex-1 px-3 py-2 text-2xs`}
                        >
                          <Mic className="h-3.5 w-3.5" />
                          {t("foreign.open")}
                        </button>
                        <button type="button" onClick={() => setConvening(null)} className={`${ui.secondary} px-3 py-2 text-2xs`}>
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => setConvening(a.id)}
                      className="mt-1.5 inline-flex items-center gap-1 text-2xs font-black uppercase tracking-wider text-muted hover:text-accent disabled:opacity-50"
                    >
                      <Mic className="h-3 w-3" />
                      {t("foreign.convene")}
                    </button>
                  ))}
              </li>
            ))}
          </ul>
        )}
      </section>

      {(state.proposals ?? []).length > 0 && (
        <section>
          <div className={`${ui.label} mb-2`}>{t("foreign.proposals")}</div>
          <ul className="grid gap-1.5">
            {(state.proposals ?? []).map((p) => (
              <li key={p.id} className="flex items-start gap-2 rounded-xl border border-dashed border-line px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-black text-ink">
                    {p.name} <span className="text-2xs font-black uppercase tracking-wider text-muted">{t(`foreign.kind.${p.kind}` as MessageKey)}</span>
                  </div>
                  <div className="text-xs font-medium text-muted">{t("foreign.waiting", { countries: p.invited.map(name).join(", ") })}</div>
                </div>
                <button type="button" disabled={disabled} onClick={() => onWithdraw(p.id)} className="text-2xs font-black uppercase tracking-wider text-muted hover:text-red-600">
                  {t("foreign.withdraw")}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <div className={`${ui.label} mb-2 flex items-center gap-1.5`}>
          <Users className="h-3.5 w-3.5" />
          {t("foreign.summits")}
        </div>
        {summits.length === 0 ? (
          <p className="text-xs font-medium text-muted">{t("foreign.noSummits")}</p>
        ) : (
          <ul className="grid gap-1.5">
            {summits.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  disabled={s.status !== "held"}
                  onClick={() => onOpenSummit(s)}
                  className="block w-full rounded-xl bg-page px-3 py-2 text-left transition-colors enabled:hover:bg-divider"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-black text-ink">{s.title}</span>
                    <span className={`shrink-0 text-2xs font-black uppercase tracking-wider ${s.status === "held" ? "text-accent" : s.status === "missed" ? "text-muted" : "text-amber-700"}`}>
                      {t(`foreign.summit.${s.status}` as MessageKey)}
                    </span>
                  </div>
                  <div className="text-xs font-medium tabular-nums text-muted">
                    {[s.place, formatDate(s.date, locale)].filter(Boolean).join(" · ")}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5">{(s.participants.length > 14 ? s.participants.slice(0, 12) : s.participants).map(chip)}</div>
                </button>
                {canHoldNow(state, s, periodEnd) && (
                  <button type="button" disabled={disabled} onClick={() => onLive(s)} className={`${ui.primary} mt-1 w-full px-3 py-2 text-2xs`}>
                    <Mic className="h-3.5 w-3.5" />
                    {(s.transcript ?? []).length ? t("foreign.resume") : t("foreign.attend")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {form === null && (
        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" disabled={disabled} onClick={() => setForm("bloc")} className={`${ui.secondary} px-3 py-2.5 text-xs`}>
            <Handshake className="h-4 w-4" />
            {t("foreign.found")}
          </button>
          <button type="button" disabled={disabled} onClick={() => setForm("summit")} className={`${ui.secondary} px-3 py-2.5 text-xs`}>
            <CalendarPlus className="h-4 w-4" />
            {t("foreign.propose")}
          </button>
        </div>
      )}

      {form === "bloc" && (
        <section className={`${ui.card} grid gap-3 p-4`}>
          <div className={ui.label}>{t("foreign.found")}</div>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-page p-1">
            {BLOC_KINDS.map((k) => (
              <button key={k} type="button" onClick={() => setKind(k)} className={`${ui.segment} ${kind === k ? `${ui.segmentOn} bg-surface shadow-sm` : ui.segmentOff}`}>
                {t(`foreign.kind.${k}` as MessageKey)}
              </button>
            ))}
          </div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder={t("foreign.blocNamePlaceholder")} aria-label={t("foreign.blocName")} className={`${ui.input} py-2.5`} />
          <div className={ui.label}>{t("foreign.invite")}</div>
          <CountryPicker state={state} picked={picked} onChange={setPicked} />
          <Dictation id="bloc-terms" set={setTerms} max={300}>
            <textarea value={terms} onChange={(e) => setTerms(e.target.value)} maxLength={300} rows={2} placeholder={t("foreign.termsPlaceholder")} aria-label={t("foreign.terms")} className={`${ui.input} resize-none`} />
          </Dictation>
          <p className="text-2xs font-medium text-muted">{t("foreign.sent")}</p>
          <div className="flex gap-2">
            <button type="button" onClick={reset} className={`${ui.secondary} flex-1 px-3 py-2.5 text-xs`}>
              {t("foreign.cancel")}
            </button>
            <button
              type="button"
              disabled={!title.trim() || picked.length === 0}
              onClick={() => {
                onPropose({ id: `p${state.turn}-${Date.now().toString(36)}`, kind, name: title.trim(), invited: picked, ...(terms.trim() ? { terms: terms.trim() } : {}), date: state.date });
                reset();
              }}
              className={`${ui.primary} flex-1 px-3 py-2.5 text-xs`}
            >
              {t("foreign.send")}
            </button>
          </div>
        </section>
      )}

      {form === "summit" && (
        <section className={`${ui.card} grid gap-3 p-4`}>
          <div className={ui.label}>{t("foreign.propose")}</div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder={t("foreign.summitTitlePlaceholder")} aria-label={t("foreign.summitTitle")} className={`${ui.input} py-2.5`} />
          <div className="grid grid-cols-2 gap-2">
            <input value={place} onChange={(e) => setPlace(e.target.value)} maxLength={80} placeholder={t("foreign.place")} aria-label={t("foreign.place")} className={`${ui.input} py-2.5`} />
            <input type="date" value={date} min={state.date} max={addStep(state.date, "year")} onChange={(e) => setDate(e.target.value)} aria-label={t("foreign.date")} className={`${ui.input} py-2.5`} />
          </div>
          <div className={ui.label}>{t("foreign.participants")}</div>
          <CountryPicker state={state} picked={picked} onChange={setPicked} />
          <Dictation id="summit-agenda" set={setTerms} max={300}>
            <textarea value={terms} onChange={(e) => setTerms(e.target.value)} maxLength={300} rows={2} placeholder={t("foreign.agenda")} aria-label={t("foreign.agenda")} className={`${ui.input} resize-none`} />
          </Dictation>
          <div className="flex gap-2">
            <button type="button" onClick={reset} className={`${ui.secondary} flex-1 px-3 py-2.5 text-xs`}>
              {t("foreign.cancel")}
            </button>
            <button
              type="button"
              disabled={!title.trim() || picked.length === 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date < state.date}
              onClick={() => {
                onSchedule({
                  id: `ps${state.turn}-${Date.now().toString(36)}`,
                  title: title.trim(),
                  place: place.trim(),
                  date,
                  participants: [state.player, ...picked],
                  ...(terms.trim() ? { agenda: terms.trim() } : {}),
                  by: "player",
                  status: "planned",
                });
                reset();
              }}
              className={`${ui.primary} flex-1 px-3 py-2.5 text-xs`}
            >
              {t("foreign.schedule")}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

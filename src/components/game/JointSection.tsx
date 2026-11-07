"use client";

import { Handshake } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import Flag from "@/components/Flag";
import { ui } from "@/components/ui/classes";
import { formatDate } from "@/engine/calendar";
import { appraiseJoint, isLive, mayPropose, meetingPoints, sharedWars, type JointDraft } from "@/engine/joint";
import { allied, pacted } from "@/engine/relations";
import { JOINT_KINDS, PROJECT_KINDS, RESEARCH_DIRECTIONS, type DelegationVote, type GameState, type JointAction, type JointKind, type MapIndex, type ProjectKind, type ResearchDirection } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import { jointTitle } from "./jointText";

/** The kinds aimed at another government, and those that run for a term. */
const AIMED: ReadonlySet<JointKind> = new Set(["exercise", "note", "sanctions", "line"]);
const TERMED: ReadonlySet<JointKind> = new Set(["operation", "research", "space", "atom", "sanctions", "line"]);
const TERMS = [0.5, 1, 2, 3, 5, 10];
const VOTES: DelegationVote[] = ["condemn", "oppose", "abstain"];

/**
 * Joint actions with allies on the foreign panel (engine/joint.ts): what
 * other governments offer the player's, with an answer; the actions under way
 * with their progress and a way out; a form to propose one to an ally or to a
 * bloc's members, with each one's likely answer before it is sent; what came
 * of the last ones; and what other governments do together.
 */
export default function JointSection({
  state,
  index,
  places,
  disabled,
  readOnly,
  onPropose,
  onAnswer,
  onWithdraw,
}: {
  state: GameState;
  index?: MapIndex | null;
  places?: (id: string) => string;
  disabled: boolean;
  readOnly: boolean;
  onPropose: (draft: JointDraft) => void;
  onAnswer: (id: string, yes: boolean) => void;
  onWithdraw: (id: string) => void;
}) {
  const { t, text, locale } = useI18n();
  const country = (tag: string) => text(state.countries[tag]?.name ?? tag);
  const place = (id: string) => places?.(id) ?? id;
  const acting = !readOnly && mayPropose(state);
  const list = state.joint ?? [];
  const offers = list.filter((j) => j.status === "proposed" && j.members.includes(state.player));
  const live = list.filter((j) => j.status === "active" && j.members.includes(state.player));
  const past = list.filter((j) => (j.status === "done" || j.status === "ended" || j.status === "refused") && j.members.includes(state.player)).slice(-6).reverse();
  const abroad = list.filter((j) => j.status === "active" && !j.members.includes(state.player)).slice(-8).reverse();

  // The form: to whom (a government, or a bloc's members), what, and what it is about.
  const [to, setTo] = useState("");
  const [kind, setKind] = useState<JointKind>("offensive");
  const [war, setWar] = useState("");
  const [at, setAt] = useState("");
  const [later, setLater] = useState(false);
  const [target, setTarget] = useState("");
  const [direction, setDirection] = useState<ResearchDirection>("science");
  const [project, setProject] = useState<ProjectKind>("pipeline");
  const [scope, setScope] = useState<"partial" | "full">("partial");
  const [vote, setVote] = useState<DelegationVote>("condemn");
  const [share, setShare] = useState<"equal" | "lead">("lead");
  const [years, setYears] = useState<number | null>(null);
  const [sent, setSent] = useState<number | null>(null);

  const others = useMemo(
    () =>
      Object.values(state.countries)
        .filter((c) => c.tag !== state.player && !c.dormant && c.economy)
        .sort((a, b) => text(a.name).localeCompare(text(b.name), locale)),
    [state.countries, state.player, text, locale],
  );
  const friends = others.filter((c) => allied(state, state.player, c.tag) || pacted(state, state.player, c.tag));
  const blocs = state.alliances.filter((a) => a.members.includes(state.player) && a.members.length > 2 && a.members.length < 40);
  const partners = to.startsWith("bloc:") ? (blocs.find((b) => `bloc:${b.id}` === to)?.members ?? []).filter((m) => m !== state.player && state.countries[m] && !state.countries[m].dormant) : to ? [to] : [];
  const first = partners[0];

  // The wars an offensive or an operation may be fought in with the first partner, and where the lines meet.
  const wars = !first ? [] : kind === "offensive" ? sharedWars(state, state.player, first) : state.wars.filter((w) => !w.truce && [state.player, first].some((x) => w.attackers.includes(x) || w.defenders.includes(x)));
  const warId = wars.some((w) => w.id === war) ? war : (wars[0]?.id ?? "");
  const theWar = wars.find((w) => w.id === warId);
  const points = kind === "offensive" && theWar && first && index ? meetingPoints(state, index, theWar, state.player, first) : [];
  const atId = points.includes(at) ? at : (points[0] ?? "");
  const targetId = target && target !== first && state.countries[target] ? target : "";

  const draft: JointDraft = {
    kind,
    partners,
    ...(kind === "offensive" || kind === "operation" ? { war: warId } : {}),
    ...(kind === "offensive" && atId ? { at: atId } : {}),
    ...(kind === "offensive" && later ? { later: true } : {}),
    ...(AIMED.has(kind) && targetId ? { target: targetId } : {}),
    ...(kind === "research" ? { direction } : {}),
    ...(kind === "project" ? { project } : {}),
    ...(kind === "sanctions" ? { scope } : {}),
    ...(kind === "line" ? { vote } : {}),
    ...(kind === "atom" ? { share } : {}),
    ...(TERMED.has(kind) && years ? { years } : {}),
  };
  const ready = partners.length > 0 && (!AIMED.has(kind) || Boolean(targetId)) && (!(kind === "offensive" || kind === "operation") || Boolean(warId)) && (kind !== "offensive" || Boolean(atId));
  const views = ready ? partners.map((p) => ({ p, a: appraiseJoint(state, draft, p, index) })) : [];
  const lastSent = sent !== null ? list.find((j) => j.by === state.player && j.turn === state.turn && list.indexOf(j) >= sent) : undefined;

  const flags = (tags: string[]) => (
    <span className="flex flex-wrap items-center gap-1">
      {tags.map((tag) => (
        <span key={tag} title={country(tag)} aria-label={country(tag)} role="img" className="inline-flex">
          <Flag tag={tag} scenario={state.scenarioId} color={state.countries[tag]?.color} size="sm" />
        </span>
      ))}
    </span>
  );
  const title = (j: JointAction) => jointTitle(j, t, text, country);
  const reason = (j: JointAction) => (j.reason ? t(`joint.reason.${j.reason}` as MessageKey) : "");
  const resultLine = (j: JointAction) => {
    if (j.result?.km !== undefined) return t("joint.result.km", { n: j.result.km.toLocaleString(locale, { maximumFractionDigits: 1 }) });
    if (j.result?.yielded !== undefined) return t(j.result.yielded ? "joint.result.yielded" : "joint.result.rejected", { target: country(j.target ?? "") });
    if (j.result?.gdp !== undefined) return t("joint.result.built", { n: j.result.gdp.toLocaleString(locale, { maximumFractionDigits: 2 }) });
    return j.status === "refused" || j.status === "ended" ? reason(j) : "";
  };
  const details = (j: JointAction) =>
    [
      j.at ? place(j.at) : "",
      j.from && j.from > state.date ? t("joint.from", { date: formatDate(j.from, locale) }) : "",
      j.until ? t("joint.until", { date: formatDate(j.until, locale) }) : "",
      j.kind === "project" && j.cost ? t("joint.cost", { n: (j.cost * 100).toLocaleString(locale, { maximumFractionDigits: 2 }) }) : "",
      j.declined?.length ? t("joint.declined", { names: j.declined.map(country).join(", ") }) : "",
    ]
      .filter(Boolean)
      .join(" · ");

  const row = (j: JointAction, actions?: ReactNode) => (
    <li key={j.id} className={`${ui.card} grid gap-1.5 p-3`}>
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 text-sm font-black text-ink">{title(j)}</span>
        <span className={`shrink-0 text-2xs font-black uppercase tracking-wider ${j.status === "active" ? "text-accent" : "text-muted"}`}>{t(`joint.status.${j.status}` as MessageKey)}</span>
      </div>
      {flags(j.members)}
      {details(j) && <p className="text-xs font-medium text-muted">{details(j)}</p>}
      {j.status === "active" && j.progress !== undefined && (
        <div className="h-1.5 overflow-hidden rounded-full bg-divider" aria-hidden>
          <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(2, Math.min(100, Math.round(j.progress * 100)))}%` }} />
        </div>
      )}
      {resultLine(j) && <p className="text-xs font-bold text-ink">{resultLine(j)}</p>}
      {actions}
    </li>
  );

  const segment = <K extends string>(value: K, current: K, label: string, set: (v: K) => void) => (
    <button key={value} type="button" aria-pressed={value === current} onClick={() => set(value)} className={`${ui.segment} border border-line ${value === current ? `${ui.segmentOn} bg-surface shadow-sm` : ui.segmentOff}`}>
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs font-medium leading-relaxed text-muted">{t("joint.help")}</p>

      {offers.length > 0 && (
        <section>
          <div className={`${ui.label} mb-2`}>{t("joint.offers")}</div>
          <ul className="grid gap-2">
            {offers.map((j) =>
              row(
                j,
                acting && (
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" disabled={disabled} onClick={() => onAnswer(j.id, true)} className={`${ui.primary} px-3 py-2 text-2xs`}>
                      {t("joint.accept")}
                    </button>
                    <button type="button" disabled={disabled} onClick={() => onAnswer(j.id, false)} className={`${ui.secondary} px-3 py-2 text-2xs`}>
                      {t("joint.decline")}
                    </button>
                  </div>
                ),
              ),
            )}
          </ul>
        </section>
      )}

      <section>
        <div className={`${ui.label} mb-2 flex items-center gap-1.5`}>
          <Handshake className="h-3.5 w-3.5" />
          {t("joint.live")}
        </div>
        {live.length ? (
          <ul className="grid gap-2">
            {live.map((j) =>
              row(
                j,
                acting && isLive(j, state.date) && j.kind !== "offensive" && (
                  <button type="button" disabled={disabled} onClick={() => onWithdraw(j.id)} className="justify-self-start text-2xs font-black uppercase tracking-wider text-muted hover:text-war">
                    {t("joint.withdraw")}
                  </button>
                ),
              ),
            )}
          </ul>
        ) : (
          <p className="text-xs font-medium text-muted">{t("joint.none")}</p>
        )}
      </section>

      {acting && (
        <section className={`${ui.card} grid gap-3 p-4`}>
          <div className={ui.label}>{t("joint.propose")}</div>
          <label className="grid gap-1">
            <span className={ui.label}>{t("joint.partner")}</span>
            <select value={to} onChange={(e) => setTo(e.target.value)} className={`${ui.input} py-2`}>
              <option value="">{t("joint.partner.pick")}</option>
              {blocs.map((b) => (
                <option key={b.id} value={`bloc:${b.id}`}>
                  {t("joint.bloc", { name: text(b.name) })}
                </option>
              ))}
              {friends.map((c) => (
                <option key={`f-${c.tag}`} value={c.tag}>
                  {text(c.name)}
                </option>
              ))}
              {others
                .filter((c) => !friends.includes(c))
                .map((c) => (
                  <option key={c.tag} value={c.tag}>
                    {text(c.name)}
                  </option>
                ))}
            </select>
          </label>

          <div className="grid gap-1">
            <span className={ui.label}>{t("joint.what")}</span>
            <div className="grid grid-cols-2 gap-1">{JOINT_KINDS.map((k) => segment(k, kind, t(`joint.kind.${k}` as MessageKey), setKind))}</div>
            <p className="text-2xs font-medium leading-snug text-muted">{t(`joint.about.${kind}` as MessageKey)}</p>
          </div>

          {(kind === "offensive" || kind === "operation") && first && (
            <>
              {wars.length ? (
                <label className="grid gap-1">
                  <span className={ui.label}>{t("joint.war")}</span>
                  <select value={warId} onChange={(e) => setWar(e.target.value)} className={`${ui.input} py-2`}>
                    {wars.map((w) => (
                      <option key={w.id} value={w.id}>
                        {text(w.name)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <p className="text-xs font-medium text-muted">{t("joint.noWar")}</p>
              )}
              {kind === "offensive" && theWar && (
                <>
                  {points.length ? (
                    <label className="grid gap-1">
                      <span className={ui.label}>{t("joint.at")}</span>
                      <select value={atId} onChange={(e) => setAt(e.target.value)} className={`${ui.input} py-2`}>
                        {points.map((id) => (
                          <option key={id} value={id}>
                            {place(id)}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <p className="text-xs font-medium text-muted">{t("joint.noMeeting")}</p>
                  )}
                  <div className="grid gap-1">
                    <span className={ui.label}>{t("joint.when")}</span>
                    <div className="grid grid-cols-2 gap-1">
                      {segment("now", later ? "later" : "now", t("joint.now"), () => setLater(false))}
                      {segment("later", later ? "later" : "now", t("joint.later"), () => setLater(true))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {AIMED.has(kind) && (
            <label className="grid gap-1">
              <span className={ui.label}>{t("joint.target")}</span>
              <select value={targetId} onChange={(e) => setTarget(e.target.value)} className={`${ui.input} py-2`}>
                <option value="">{t("joint.partner.pick")}</option>
                {others
                  .filter((c) => !partners.includes(c.tag))
                  .map((c) => (
                    <option key={c.tag} value={c.tag}>
                      {text(c.name)}
                    </option>
                  ))}
              </select>
            </label>
          )}

          {kind === "research" && (
            <label className="grid gap-1">
              <span className={ui.label}>{t("joint.direction")}</span>
              <select value={direction} onChange={(e) => setDirection(e.target.value as ResearchDirection)} className={`${ui.input} py-2`}>
                {RESEARCH_DIRECTIONS.map((d) => (
                  <option key={d} value={d}>
                    {t(`research.dir.${d}` as MessageKey)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {kind === "project" && (
            <label className="grid gap-1">
              <span className={ui.label}>{t("joint.project")}</span>
              <select value={project} onChange={(e) => setProject(e.target.value as ProjectKind)} className={`${ui.input} py-2`}>
                {PROJECT_KINDS.map((p) => (
                  <option key={p} value={p}>
                    {t(`joint.project.${p}` as MessageKey)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {kind === "sanctions" && <div className="grid grid-cols-2 gap-1">{(["partial", "full"] as const).map((s) => segment(s, scope, t(`joint.scope.${s}` as MessageKey), setScope))}</div>}
          {kind === "line" && <div className="grid grid-cols-3 gap-1">{VOTES.map((v) => segment(v, vote, t(`joint.vote.${v}` as MessageKey), setVote))}</div>}
          {kind === "atom" && (
            <div className="grid gap-1">
              <span className={ui.label}>{t("joint.share")}</span>
              <div className="grid grid-cols-2 gap-1">{(["lead", "equal"] as const).map((s) => segment(s, share, t(`joint.share.${s}` as MessageKey), setShare))}</div>
            </div>
          )}
          {TERMED.has(kind) && (
            <label className="grid gap-1">
              <span className={ui.label}>{t("joint.years")}</span>
              <select value={years ?? ""} onChange={(e) => setYears(e.target.value ? Number(e.target.value) : null)} className={`${ui.input} py-2`}>
                <option value="">–</option>
                {TERMS.map((y) => (
                  <option key={y} value={y}>
                    {t("joint.years.n", { n: y.toLocaleString(locale) })}
                  </option>
                ))}
              </select>
            </label>
          )}

          {views.length > 0 && (
            <ul className="grid gap-1">
              {views.map(({ p, a }) => (
                <li key={p} className="flex items-start gap-2 rounded-xl bg-page px-3 py-2 text-xs">
                  <Flag tag={p} scenario={state.scenarioId} color={state.countries[p]?.color} size="sm" />
                  <span className="min-w-0 flex-1 font-medium text-ink">
                    {a.blocked ? (
                      t("joint.blocked", { reason: t(`joint.reason.${a.blocked}` as MessageKey) })
                    ) : (
                      <>
                        {t("joint.likely", { stance: t(`joint.stance.${a.stance}` as MessageKey), chance: Math.round(a.chance * 100) })}
                        <span className="text-muted"> · {t("joint.why", { reason: t(`joint.reason.${a.why}` as MessageKey) })}</span>
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            disabled={disabled || !ready || views.every((v) => v.a.blocked)}
            onClick={() => {
              setSent(list.length);
              onPropose(draft);
            }}
            className={`${ui.primary} px-3 py-2.5 text-xs`}
          >
            {t("joint.send")}
          </button>
          {lastSent && (
            <p className={`text-xs font-bold ${lastSent.status === "active" ? "text-accent" : "text-muted"}`}>
              {title(lastSent)}: {t(`joint.status.${lastSent.status}` as MessageKey).toLowerCase()}
              {lastSent.status === "refused" && lastSent.reason ? ` – ${reason(lastSent)}` : ""}
            </p>
          )}
        </section>
      )}

      {past.length > 0 && (
        <section>
          <div className={`${ui.label} mb-2`}>{t("joint.past")}</div>
          <ul className="grid gap-2">{past.map((j) => row(j))}</ul>
        </section>
      )}

      {abroad.length > 0 && (
        <section>
          <div className={`${ui.label} mb-2`}>{t("joint.abroad")}</div>
          <ul className="grid gap-2">{abroad.map((j) => row(j))}</ul>
        </section>
      )}
    </div>
  );
}

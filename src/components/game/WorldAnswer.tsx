"use client";

import { Globe, Landmark, Mic } from "lucide-react";
import Flag from "@/components/Flag";
import { ui } from "@/components/ui/classes";
import { TextTip } from "@/components/ui/Term";
import { formatMonth } from "@/engine/calendar";
import { shownStage } from "@/engine/intentions";
import type { Aggression, GameState, Resolution, War } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import { forumName, resolutionResult } from "./changes";

/** Flags past this many are counted, not shown. */
const SHOWN = 12;

/** Countries as flags, each name on hover; those only planning (`dim`) paler. */
function FlagRow({ state, tags, dim }: { state: GameState; tags: string[]; dim?: Set<string> }) {
  const { t, text } = useI18n();
  return (
    <span className="flex flex-wrap items-center gap-1">
      {tags.slice(0, SHOWN).map((tag) => {
        const name = text(state.countries[tag]?.name ?? tag);
        return (
          <span key={tag} title={name} aria-label={name} role="img" className={`inline-flex ${dim?.has(tag) ? "opacity-50" : ""}`}>
            <Flag tag={tag} scenario={state.scenarioId} color={state.countries[tag]?.color} size="sm" />
          </span>
        );
      })}
      {tags.length > SHOWN && <span className="text-2xs font-black uppercase tracking-wider text-muted">{t("foreign.more", { n: tags.length - SHOWN })}</span>}
    </span>
  );
}

/** Who sanctions the attacker since the attack: imposed, and still being prepared. */
function sanctionersOf(state: GameState, c: Aggression): { tags: string[]; planned: Set<string> } {
  const imposed = (state.sanctions ?? []).filter((s) => s.against === c.by && s.since >= c.date).map((s) => s.by);
  const planned = (state.plans ?? []).filter((p) => !p.end && p.kind === "sanction" && !p.lift && p.target === c.by && p.since >= c.date && !imposed.includes(p.by)).map((p) => p.by);
  return { tags: [...new Set([...imposed, ...planned])], planned: new Set(planned) };
}

/** One world body's vote, with what its forum and its kind mean on hover. */
function ResolutionRow({ state, body, r }: { state: GameState; body: string; r: Resolution }) {
  const { t, text, locale } = useI18n();
  const country = (tag: string) => text(state.countries[tag]?.name ?? tag);
  const where = body !== "un" ? "resolution.leagueHint" : r.forum === "council" ? "resolution.councilHint" : "resolution.assemblyHint";
  const hint = [t(`resolution.${r.kind}Hint` as MessageKey), t(where), `${t("resolution.votes", { yes: r.yes, no: r.no, abstain: r.abstain })}: ${t("resolution.votesHint")}`].join(" ");
  return (
    <TextTip as="li" text={hint} label={`${forumName(body, r.forum, t)} · ${t(`resolution.${r.kind}` as MessageKey)}`} className="flex cursor-help flex-wrap items-baseline gap-x-1.5 rounded-sm text-2xs leading-snug outline-none focus-visible:ring-2 focus-visible:ring-accent/50">
      <span className="tabular-nums text-muted">{formatMonth(r.date.slice(0, 7), locale)}</span>
      <span className="font-bold text-ink">
        {forumName(body, r.forum, t)} · {t(`resolution.${r.kind}` as MessageKey)}
      </span>
      <span className={`font-black ${r.passed ? "text-accent" : "text-muted"}`}>– {resolutionResult(r, country, t)}</span>
    </TextTip>
  );
}

/**
 * The world's answer to an act of aggression on its war's card: how grave it
 * was judged, who condemned it, who sanctions the attacker, who sends the
 * victim arms, who may enter the war on its side, who pledged to defend whom,
 * and the world body's votes – each with a hint (Tip) whose terms open their own.
 */
export function WarAnswer({ state, war }: { state: GameState; war: War }) {
  const { t, text } = useI18n();
  const cases = (state.aggressions ?? []).filter((a) => a.war === war.id);
  if (!cases.length) return null;
  const country = (tag: string) => text(state.countries[tag]?.name ?? tag);
  return (
    <div className="grid gap-2">
      <div className={`${ui.label} flex items-center gap-1.5`}>
        <Globe className="h-3.5 w-3.5" />
        {t("response.title")}
      </div>
      {cases.map((c) => {
        const side = war.defenders.includes(c.against) ? war.defenders : war.attackers;
        const joining = (state.plans ?? []).filter((p) => !p.end && p.kind === "join" && p.war === war.id && p.side !== undefined && war[p.side] === side && shownStage(p)).map((p) => p.by);
        const sanctions = sanctionersOf(state, c);
        const rows: { key: string; label: string; hint: string; tags: string[]; dim?: Set<string> }[] = [
          { key: "condemned", label: t("response.condemned"), hint: t("response.condemnedHint"), tags: c.condemned },
          { key: "sanctions", label: t("response.sanctions"), hint: t("response.sanctionsHint"), tags: sanctions.tags, dim: sanctions.planned },
          { key: "aid", label: t("response.aid"), hint: t("response.aidHint"), tags: c.aid ?? [] },
          { key: "joining", label: t("response.joining"), hint: t("response.joiningHint"), tags: joining },
        ].filter((r) => r.tags.length);
        return (
          <div key={c.id} className="grid gap-1.5">
            <TextTip as="p" text={t("response.gravityHint")} label={t("response.gravity", { n: c.weight })} className="cursor-help text-2xs font-medium leading-snug text-muted">
              <span className="font-bold text-ink">
                {country(c.by)} → {country(c.against)}
              </span>
              {" · "}
              {t("response.gravity", { n: c.weight })}
              {c.repeat > 0 ? ` · ${t("response.repeat", { n: c.repeat + 1 })}` : ""}
            </TextTip>
            {rows.length === 0 && !c.pledges?.length && !c.resolutions?.length && <p className="text-xs font-medium text-muted">{t("response.none")}</p>}
            {rows.length > 0 && (
              <ul className="grid gap-1">
                {rows.map((r) => (
                  <li key={r.key} className="grid grid-cols-[7rem_1fr] items-center gap-2 text-2xs">
                    <TextTip text={r.hint} label={r.label} className="cursor-help font-black uppercase tracking-wider text-muted underline decoration-dotted decoration-1 underline-offset-2">
                      {r.label}
                    </TextTip>
                    <FlagRow state={state} tags={r.tags} dim={r.dim} />
                  </li>
                ))}
              </ul>
            )}
            {c.pledges?.length ? (
              <div className="grid grid-cols-[7rem_1fr] items-start gap-2 text-2xs">
                <TextTip text={t("response.pledgesHint")} label={t("response.pledges")} className="cursor-help font-black uppercase tracking-wider text-muted underline decoration-dotted decoration-1 underline-offset-2">
                  {t("response.pledges")}
                </TextTip>
                <span className="flex flex-wrap gap-x-2 gap-y-1">
                  {c.pledges.map((p) => (
                    <span key={`${p.by}-${p.to}`} className="inline-flex items-center gap-1 font-bold text-ink">
                      <FlagRow state={state} tags={[p.by]} />→<FlagRow state={state} tags={[p.to]} />
                    </span>
                  ))}
                </span>
              </div>
            ) : null}
            {c.body && (c.resolutions?.length || c.blocked) ? (
              <ul className="grid gap-0.5">
                {(c.resolutions ?? []).map((r, i) => (
                  <ResolutionRow key={i} state={state} body={c.body!} r={r} />
                ))}
                {c.blocked && (
                  <TextTip as="li" text={t("un.waitingHint")} className="cursor-help text-2xs font-bold text-muted">
                    {forumName(c.body, "assembly", t)}: {t("un.waiting")}
                  </TextTip>
                )}
              </ul>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** The cases a world body took up, the latest first: who attacked whom, and every vote on it. */
export function WorldBodyCases({ state, onOrder }: { state: GameState; onOrder?: (order: string) => void }) {
  const { t, text } = useI18n();
  const cases = (state.aggressions ?? []).filter((a) => a.body && (a.resolutions?.length || a.blocked)).reverse().slice(0, 6);
  if (!cases.length) return null;
  const country = (tag: string) => text(state.countries[tag]?.name ?? tag);
  return (
    <section>
      <div className={`${ui.label} mb-2 flex items-center gap-1.5`}>
        <Landmark className="h-3.5 w-3.5" />
        {t("un.resolutions")}
      </div>
      <ul className="grid gap-1.5">
        {cases.map((c) => (
          <li key={c.id} className="grid gap-1 rounded-xl bg-page px-3 py-2">
            <TextTip as="div" text={t("response.gravityHint")} label={t("response.gravity", { n: c.weight })} className="flex cursor-help flex-wrap items-center gap-1.5 text-xs">
              <FlagRow state={state} tags={[c.by]} />
              <span className="font-black text-muted">→</span>
              <FlagRow state={state} tags={[c.against]} />
              <span className="min-w-0 font-bold text-ink">
                {country(c.by)} – {country(c.against)}
              </span>
              <span className="text-2xs font-medium text-muted">{t("response.gravity", { n: c.weight })}</span>
            </TextTip>
            {/* The leader goes to the session in person: an order the game master answers in "delegation" (engine/envoys.ts). */}
            {onOrder && c.by !== state.player && (
              <button
                type="button"
                onClick={() => onOrder(t("un.inPerson.order", { by: country(c.by), against: country(c.against) }))}
                title={t("un.inPerson.hint")}
                aria-label={t("un.inPerson.hint")}
                className="inline-flex w-fit items-center gap-1 rounded-lg px-1.5 py-1 text-2xs font-bold text-muted transition-colors hover:bg-surface hover:text-ink"
              >
                <Mic className="h-3.5 w-3.5" />
                {t("un.inPerson")}
              </button>
            )}
            <ul className="grid gap-0.5">
              {(c.resolutions ?? []).map((r, i) => (
                <ResolutionRow key={i} state={state} body={c.body!} r={r} />
              ))}
              {c.blocked && (
                <TextTip as="li" text={t("un.waitingHint")} className="cursor-help text-2xs font-bold text-muted">
                  {forumName(c.body!, "assembly", t)}: {t("un.waiting")}
                </TextTip>
              )}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}

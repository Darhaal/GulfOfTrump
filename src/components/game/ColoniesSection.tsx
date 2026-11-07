"use client";

import Flag from "@/components/Flag";
import { ui } from "@/components/ui/classes";
import { formatDate } from "@/engine/calendar";
import { colonyName, colonySeed } from "@/engine/colonies";
import { countryColor } from "@/engine/colors";
import { governs } from "@/engine/figures";
import { COLONY_COURSES, type Colony, type ColonyCourse, type GameState } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";

/** Years between two days. */
const yearsBetween = (from: string, to: string) => (Date.parse(to) - Date.parse(from)) / (365.25 * 86_400_000);

/**
 * Decolonisation on the foreign panel (engine/colonies.ts): the player's own
 * colonies, each with its movement's pressure, its stage and history's day,
 * and the answer the government gives – hand over, delay, fight, offer a
 * federation – acted on when the turn is played; then the world's colonial
 * wars, the independences history set that are coming, and the states lately
 * free.
 */
export default function ColoniesSection({
  state,
  colonies,
  disabled,
  readOnly,
  onCourse,
}: {
  state: GameState;
  /** The game's colonies as the engine reads them (engine/colonies.ts coloniesOf). */
  colonies: Colony[];
  disabled: boolean;
  readOnly: boolean;
  onCourse: (colony: string, course: ColonyCourse) => void;
}) {
  const { t, text, locale } = useI18n();
  const country = (tag: string) => text(state.countries[tag]?.name ?? tag);
  const mine = colonies.filter((c) => !c.end && c.of === state.player);
  const answering = governs(state) && !readOnly;
  const wars = colonies.filter((c) => !c.end && c.of !== state.player && c.war && state.wars.some((w) => w.id === c.war));
  const coming = state.mode === "historical" ? colonies.filter((c) => !c.end && c.due && c.of !== state.player && !c.war).sort((a, b) => a.due!.localeCompare(b.due!)).slice(0, 8) : [];
  const free = colonies
    .filter((c) => c.end && c.end.how !== "gone" && yearsBetween(c.end.date, state.date) <= 5)
    .sort((a, b) => b.end!.date.localeCompare(a.end!.date))
    .slice(0, 12);

  const dueLine = (c: Colony) => {
    if (!c.due) return "";
    const date = formatDate(c.due, locale);
    return c.stage === "talks" ? t("colonies.due.set", { date }) : c.seed && colonySeed(c) ? t("colonies.due.history", { date }) : t("colonies.due.set", { date });
  };

  const row = (c: Colony) => (
    <li key={c.id} className={`${ui.card} grid gap-2 p-3`}>
      <div className="flex items-center gap-2">
        <Flag tag={c.tag} scenario={state.scenarioId} color={countryColor(c.tag)} size="md" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-black text-ink">{text(colonyName(c))}</span>
          <span className="block truncate text-xs font-medium text-muted">{t(`colonies.stage.${c.stage}` as MessageKey)}</span>
        </span>
        <span className="shrink-0 text-xs font-black text-ink">{t("colonies.pressure", { n: Math.round(c.pressure) })}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-divider" aria-hidden>
        <div className={`h-full rounded-full ${c.pressure >= 70 ? "bg-war" : "bg-accent"}`} style={{ width: `${Math.max(2, Math.min(100, c.pressure))}%` }} />
      </div>
      {c.due && <p className="text-xs font-medium text-muted">{dueLine(c)}</p>}
      {answering && (
        <div className="grid grid-cols-2 gap-1">
          {COLONY_COURSES.map((course) => (
            <button
              key={course}
              type="button"
              disabled={disabled}
              title={t(`colonies.course.${course}.hint` as MessageKey)}
              aria-pressed={c.course === course}
              onClick={() => onCourse(c.id, course)}
              className={`${ui.segment} border border-line ${c.course === course ? `${ui.segmentOn} bg-surface shadow-sm` : ui.segmentOff} disabled:opacity-50`}
            >
              {t(`colonies.course.${course}` as MessageKey)}
            </button>
          ))}
        </div>
      )}
      {c.course && c.course !== c.answered && <p className="text-2xs font-bold text-accent">{t("colonies.pending")}</p>}
    </li>
  );

  return (
    <div className="flex flex-col gap-4">
      <section>
        <div className={`${ui.label} mb-2`}>{t("colonies.mine")}</div>
        {mine.length ? <ul className="grid gap-2">{mine.map(row)}</ul> : <p className="text-xs font-medium text-muted">{t("colonies.none")}</p>}
      </section>
      {wars.length > 0 && (
        <section>
          <div className={`${ui.label} mb-2`}>{t("colonies.wars")}</div>
          <ul className="grid gap-1.5">
            {wars.map((c) => (
              <li key={c.id} className="flex items-center gap-2 rounded-xl bg-page px-3 py-2 text-xs font-medium text-ink">
                <Flag tag={c.of} scenario={state.scenarioId} color={state.countries[c.of]?.color} size="sm" />
                <span className="min-w-0 flex-1 truncate">{t("colonies.war", { colony: text(colonyName(c)), movement: country(c.movement ?? c.tag), of: country(c.of) })}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {coming.length > 0 && (
        <section>
          <div className={`${ui.label} mb-2`}>{t("colonies.coming")}</div>
          <ul className="grid gap-1.5">
            {coming.map((c) => (
              <li key={c.id} className="flex items-center gap-2 rounded-xl bg-page px-3 py-2 text-xs font-medium text-ink">
                <Flag tag={c.tag} scenario={state.scenarioId} color={countryColor(c.tag)} size="sm" />
                <span className="min-w-0 flex-1 truncate">{t("colonies.from", { colony: text(colonyName(c)), of: country(c.of) })}</span>
                <span className="shrink-0 text-muted">{formatDate(c.due!, locale)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {free.length > 0 && (
        <section>
          <div className={`${ui.label} mb-2`}>{t("colonies.free")}</div>
          <ul className="grid gap-1.5">
            {free.map((c) => (
              <li key={c.id} className="flex items-center gap-2 rounded-xl bg-page px-3 py-2 text-xs font-medium text-ink">
                <Flag tag={c.tag} scenario={state.scenarioId} color={state.countries[c.tag]?.color ?? countryColor(c.tag)} size="sm" />
                <span className="min-w-0 flex-1 truncate">{t("colonies.from", { colony: c.end!.how === "union" ? text(colonyName(c)) : country(c.tag), of: country(c.of) })}</span>
                <span className="shrink-0 text-muted">{formatDate(c.end!.date, locale)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

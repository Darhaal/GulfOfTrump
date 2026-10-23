"use client";

import { CalendarDays, MapPin, Quote } from "lucide-react";
import Dialog from "@/components/ui/Dialog";
import { ui } from "@/components/ui/classes";
import { formatDate } from "@/engine/calendar";
import Flag from "@/components/Flag";
import type { CountryState, ScenarioId, Summit } from "@/engine/types";
import { useI18n } from "@/i18n/useI18n";

/**
 * A summit as it happened: who came, what came of it, and for a meeting the
 * player held, what each delegation said in turn. Opens by itself when other
 * governments met during a turn, and from the foreign policy panel afterwards.
 */
export default function SummitDialog({
  summit,
  heading,
  countries,
  scenario,
  onClose,
}: {
  summit: Summit | null;
  /** The title in the player's language, when it has one (a bloc's session). */
  heading?: string;
  countries: Record<string, CountryState>;
  scenario: ScenarioId;
  onClose: () => void;
}) {
  const { t, text, locale } = useI18n();
  const name = (tag: string) => text(countries[tag]?.name ?? tag);
  return (
    <Dialog
      open={summit !== null}
      onClose={onClose}
      wide
      title={heading ?? summit?.title ?? ""}
      footer={
        <button type="button" onClick={onClose} className={`${ui.primary} w-full py-3 text-sm`}>
          {t("summit.close")}
        </button>
      }
    >
      {summit && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold text-muted">
            {summit.place && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {summit.place}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <CalendarDays className="h-3.5 w-3.5" />
              {formatDate(summit.date, locale)}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {summit.participants.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1.5 rounded-lg bg-page px-2 py-1 text-xs font-bold text-ink">
                <Flag tag={tag} scenario={scenario} color={countries[tag]?.color} size="sm" />
                {name(tag)}
              </span>
            ))}
          </div>
          {summit.agenda && <p className="text-sm font-medium text-muted">{summit.agenda}</p>}

          {summit.transcript && summit.transcript.length > 0 && (
            <section>
              <div className={`${ui.label} mb-2`}>{t("summit.record")}</div>
              <ol className="grid gap-2.5">
                {summit.transcript.map((line, i) => (
                  <li key={i} className="flex gap-3">
                    <Flag tag={line.country} scenario={scenario} color={countries[line.country]?.color} className="mt-1" />
                    <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-line sheet px-3.5 py-2.5">
                      <div className="mb-1 flex flex-wrap items-baseline gap-x-2 text-2xs font-black uppercase tracking-widest text-muted">
                        <span className="text-ink">{line.speaker || name(line.country)}</span>
                        {line.speaker && <span className="font-bold normal-case tracking-normal">{name(line.country)}</span>}
                      </div>
                      <p className="text-sm font-medium leading-relaxed text-ink">{line.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {summit.outcome && (
            <section className="rounded-2xl bg-page p-4">
              <div className={`${ui.label} mb-1.5 flex items-center gap-1.5`}>
                <Quote className="h-3.5 w-3.5" />
                {t("summit.outcome")}
              </div>
              <p className="text-sm font-semibold leading-relaxed text-ink">{summit.outcome}</p>
            </section>
          )}
        </div>
      )}
    </Dialog>
  );
}

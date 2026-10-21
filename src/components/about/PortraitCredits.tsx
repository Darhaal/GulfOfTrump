"use client";

import { ChevronDown, ExternalLink } from "lucide-react";
import { useState } from "react";
import { ui } from "@/components/ui/classes";
import { useI18n } from "@/i18n/useI18n";

interface Credit {
  name: string;
  source: string;
  file: string;
  author: string;
  licence: string;
  licenceName?: string;
  licenceUrl?: string;
}

/**
 * Who made the photographs the portraits are painted from, and under what
 * licence (public/portraits/credits.json, written by npm run portraits).
 * The list loads when it is opened.
 */
export default function PortraitCredits() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [credits, setCredits] = useState<[string, Credit][] | null>(null);
  const [failed, setFailed] = useState(false);

  const toggle = () => {
    setOpen((v) => !v);
    if (credits || failed) return;
    fetch("/portraits/credits.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((all: Record<string, Credit>) => setCredits(Object.entries(all).sort(([, a], [, b]) => a.name.localeCompare(b.name))))
      .catch(() => setFailed(true));
  };

  return (
    <section className={`${ui.card} p-5 md:p-6`}>
      <h2 className={`${ui.label} mb-2`}>{t("portraits.title")}</h2>
      <p className="text-sm font-medium leading-relaxed text-muted">{t("portraits.about")}</p>
      <button type="button" onClick={toggle} aria-expanded={open} className={`${ui.secondary} mt-4 px-4 py-2.5 text-xs`}>
        {t(open ? "portraits.hide" : "portraits.show")}
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && failed && <p className="mt-3 text-xs font-medium text-muted">{t("portraits.failed")}</p>}
      {open && credits && (
        <ul className="mt-4 grid max-h-[60vh] gap-2 overflow-y-auto overscroll-contain pr-1">
          {credits.map(([id, c]) => (
            <li key={id} className="rounded-xl bg-page p-3 text-xs font-medium leading-relaxed text-muted">
              <span className="font-black text-ink">{c.name}</span> —{" "}
              <a href={c.source} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-bold text-ink hover:text-accent">
                {c.file.replace(/^File:/, "")}
                <ExternalLink className="h-3 w-3" />
              </a>
              {" · "}
              {c.author}
              {" · "}
              {c.licenceUrl ? (
                <a href={c.licenceUrl} target="_blank" rel="noreferrer" className="font-bold text-ink hover:text-accent">
                  {c.licenceName || c.licence}
                </a>
              ) : (
                <span className="font-bold text-ink">{c.licenceName || c.licence}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

"use client";

import { Flag } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { ui } from "@/components/ui/classes";
import { APP_NAME, CONTENT_REPORT_URL } from "@/constants/app";
import { PRIVACY } from "@/i18n/privacy";
import { useI18n } from "@/i18n/useI18n";

/** The privacy policy: what the game sends where, and how to report the AI's text. */
export default function PrivacyClient() {
  const { locale, t } = useI18n();
  const p = PRIVACY[locale];

  return (
    <div className="min-h-screen">
      <AppHeader back="/" title={p.title} subtitle={APP_NAME} />
      <main className="mx-auto grid max-w-3xl gap-4 px-4 py-8">
        <section className="pb-2">
          <h1 className="text-3xl md:text-4xl font-black tracking-tighter leading-none text-ink">
            {p.title}
            <span className="text-accent">.</span>
          </h1>
          <p className="mt-2 text-xs font-medium text-muted">{p.updated}</p>
          <p className="mt-4 text-base font-medium leading-relaxed text-muted">{p.intro}</p>
        </section>

        {p.sections.map((section) => (
          <section key={section.title} className={`${ui.card} p-5 md:p-6`}>
            <h2 className={`${ui.label} mb-3`}>{section.title}</h2>
            <div className="grid gap-2">
              {section.body.map((paragraph) => (
                <p key={paragraph} className="text-sm font-medium leading-relaxed text-ink">
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        ))}

        <a href={CONTENT_REPORT_URL} target="_blank" rel="noreferrer" className={`${ui.secondary} w-fit px-4 py-2.5 text-xs`}>
          <Flag className="h-4 w-4" />
          {t("report.ai")}
        </a>
      </main>
    </div>
  );
}

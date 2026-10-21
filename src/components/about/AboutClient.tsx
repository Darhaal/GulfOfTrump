"use client";

import { Check, CodeXml, ExternalLink, Globe2, Landmark, Mail, Map, Save, TrendingUp, Users } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { ui } from "@/components/ui/classes";
import PortraitCredits from "./PortraitCredits";
import { APP_NAME, APP_VERSION, REPO_URL } from "@/constants/app";
import { ABOUT, AUTHOR_EMAIL, AUTHOR_LINKS } from "@/i18n/about";
import { useI18n } from "@/i18n/useI18n";

/** One icon per entry of "what is in the game", in order. */
const FEATURE_ICONS = [Map, TrendingUp, Users, Landmark, Globe2, Save];

/** Rules in short, what the game has, where the data lives and who makes it. */
export default function AboutClient() {
  const { locale, t } = useI18n();
  const a = ABOUT[locale];

  return (
    <div className="min-h-screen">
      <AppHeader back="/" title={a.title} subtitle={`${APP_NAME} · ${t("app.stage")} ${APP_VERSION}`} />
      <main className="mx-auto grid max-w-4xl gap-4 px-4 py-8">
        <section className="pb-4">
          <h1 className="text-3xl md:text-5xl font-black tracking-tighter leading-none text-ink">
            {APP_NAME}
            <span className="text-accent">.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-base font-medium leading-relaxed text-muted">{a.intro}</p>
        </section>

        <section className={`${ui.card} p-5 md:p-6`}>
          <h2 className={`${ui.label} mb-4`}>{a.rulesTitle}</h2>
          <ol className="grid gap-4 sm:grid-cols-2">
            {a.rules.map((rule, i) => (
              <li key={rule.title} className="flex gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-ink text-xs font-black text-on-ink tabular-nums">{i + 1}</span>
                <div>
                  <div className="text-sm font-black text-ink">{rule.title}</div>
                  <p className="mt-1 text-sm font-medium leading-relaxed text-muted">{rule.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className={`${ui.card} p-5 md:p-6`}>
          <h2 className={`${ui.label} mb-4`}>{a.featuresTitle}</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {a.features.map((f, i) => {
              const Icon = FEATURE_ICONS[i] ?? Check;
              return (
                <li key={f.title} className="rounded-2xl bg-page p-4">
                  <Icon className="h-5 w-5 text-accent" />
                  <div className="mt-2 text-sm font-black text-ink">{f.title}</div>
                  <p className="mt-1 text-sm font-medium leading-relaxed text-muted">{f.body}</p>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <section className={`${ui.card} p-5 md:p-6`}>
            <h2 className={`${ui.label} mb-4`}>{a.authorTitle}</h2>
            <div className="flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- a static file, no optimisation needed */}
              <img src="/about/artem-okhten.webp" alt={a.authorName} width={80} height={80} className="h-20 w-20 shrink-0 rounded-2xl border border-line object-cover shadow-sm" />
              <div className="text-xl font-black leading-tight text-ink">{a.authorName}</div>
            </div>
            <p className="mt-2 text-sm font-medium leading-relaxed text-muted">{a.authorBio}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {AUTHOR_LINKS.map((link) => (
                <a key={link.href} href={link.href} target="_blank" rel="noreferrer" className={`${ui.secondary} px-3 py-2 text-xs`}>
                  {link.label}
                  <ExternalLink className="h-3 w-3 text-muted" />
                </a>
              ))}
              <a href={`mailto:${AUTHOR_EMAIL}`} className={`${ui.primary} px-3 py-2 text-xs`}>
                <Mail className="h-3.5 w-3.5" />
                {a.contact}
              </a>
            </div>
          </section>

          <section className={`${ui.card} p-5 md:p-6`}>
            <h2 className={`${ui.label} mb-4`}>{a.dataTitle}</h2>
            <ul className="grid gap-2.5">
              {a.data.map((line) => (
                <li key={line} className="text-sm font-medium leading-relaxed text-ink">
                  {line}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <PortraitCredits />

        <section className={`${ui.card} flex flex-wrap items-center gap-4 p-5 md:p-6`}>
          <div className="min-w-0 flex-1">
            <h2 className={`${ui.label} mb-2`}>{a.licenseTitle}</h2>
            <p className="text-sm font-medium leading-relaxed text-muted">{a.license}</p>
          </div>
          <a href={REPO_URL} target="_blank" rel="noreferrer" className={`${ui.secondary} px-4 py-2.5 text-xs`}>
            <CodeXml className="h-4 w-4" />
            GitHub
          </a>
        </section>
      </main>
    </div>
  );
}

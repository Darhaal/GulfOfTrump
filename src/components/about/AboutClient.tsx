"use client";

import { Check, CodeXml, Download, ExternalLink, FlaskConical, Globe2, Landmark, Mail, Map, Newspaper, Save, Shield, Store, TrendingUp, Users } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { ui } from "@/components/ui/classes";
import PortraitCredits from "./PortraitCredits";
import { BUILTIN_VOICES } from "@/lib/voice/builtin";
import { APP_NAME, APP_VERSION, DOWNLOAD_URL, REPO_URL, STORE_URL } from "@/constants/app";
import { ABOUT, AUTHOR_EMAIL, AUTHOR_LINKS } from "@/i18n/about";
import { useI18n } from "@/i18n/useI18n";

/** One icon per entry of "what is in the game", in order. */
const FEATURE_ICONS = [Map, Shield, TrendingUp, FlaskConical, Users, Landmark, Globe2, Newspaper, Save];

/** Rules in short, what the game has, where the data lives and who makes it; `embedded` is the header's popup, without a header of its own. */
export default function AboutClient({ embedded = false }: { embedded?: boolean }) {
  const { locale, t } = useI18n();
  const a = ABOUT[locale];

  return (
    <div className={embedded ? "" : "min-h-screen"}>
      {!embedded && <AppHeader back="/" title={a.title} subtitle={`${APP_NAME} · ${t("app.stage")} ${APP_VERSION}`} />}
      <main className={embedded ? "grid gap-4" : "mx-auto grid max-w-4xl gap-4 px-4 py-8"}>
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
            <div className="flex items-end gap-5">
              {/* eslint-disable-next-line @next/next/no-img-element -- a static file, no optimisation needed */}
              <img src="/about/artem-okhten-oil.webp" alt={a.authorName} width={128} height={160} className="h-40 w-32 shrink-0 rounded-2xl border border-line object-cover shadow-lg" />
              <div className="pb-1 text-2xl font-black leading-tight text-ink">{a.authorName}</div>
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
        <PortraitCredits kind="scenes" />
        <PortraitCredits kind="quotes" />

        {/* The open models the voice features download and run on the player's computer. */}
        <section className={`${ui.card} p-5 md:p-6`}>
          <h2 className={`${ui.label} mb-2`}>{t("about.voices.title")}</h2>
          <p className="mb-3 text-sm font-medium leading-relaxed text-muted">{t("about.voices.lead")}</p>
          <ul className="grid gap-1.5 text-sm font-medium text-ink">
            {[...Object.values(BUILTIN_VOICES).map((v) => v.credit), { name: "Whisper base · onnx-community/whisper-base", url: "https://huggingface.co/onnx-community/whisper-base", licence: "MIT" }].map((c) => (
              <li key={c.url}>
                <a href={c.url} target="_blank" rel="noreferrer" className="font-bold underline decoration-line underline-offset-2 hover:text-accent">
                  {c.name}
                </a>{" "}
                <span className="text-muted">· {c.licence}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className={`${ui.card} flex flex-wrap items-center gap-4 p-5 md:p-6`}>
          <div className="min-w-0 flex-1">
            <h2 className={`${ui.label} mb-2`}>{a.licenseTitle}</h2>
            <p className="text-sm font-medium leading-relaxed text-muted">{a.license}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={STORE_URL} target="_blank" rel="noreferrer" className={`${ui.primary} px-4 py-2.5 text-xs`}>
              <Store className="h-4 w-4" />
              {t("download.store")}
            </a>
            <a href={DOWNLOAD_URL} target="_blank" rel="noreferrer" className={`${ui.secondary} px-4 py-2.5 text-xs`}>
              <Download className="h-4 w-4" />
              {t("download.installer")}
            </a>
            <a href={REPO_URL} target="_blank" rel="noreferrer" className={`${ui.secondary} px-4 py-2.5 text-xs`}>
              <CodeXml className="h-4 w-4" />
              GitHub
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}

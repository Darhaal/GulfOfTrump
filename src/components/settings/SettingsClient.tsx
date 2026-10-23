"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CodeXml, Flag, Gamepad2, GraduationCap, ExternalLink, Info, Loader2, LogIn, LogOut, ShieldCheck, Sparkles, Unplug } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import AppHeader from "@/components/AppHeader";
import GoogleMark from "@/components/GoogleMark";
import { ui } from "@/components/ui/classes";
import { APP_VERSION, CHATGPT_USAGE_URL, CONTENT_REPORT_URL, REPO_URL, isDemo, isDesktopApp } from "@/constants/app";
import { LOCALES, type Locale } from "@/engine/types";
import { errorKey, useI18n } from "@/i18n/useI18n";
import { ApiError, connectAi, disconnectAi, getModels } from "@/lib/api";
import { useDesktopWindow } from "@/lib/desktop";
import UpdatesSection from "./UpdatesSection";
import { usePreference, type Theme } from "@/lib/preferences";
import { displayName, isCloudEnabled, signInWithGoogle, signOut, useUser } from "@/lib/supabase";
import { useGameMaster } from "@/lib/gameMaster";
import { replayTour } from "@/components/game/Tour";
import VoiceSettings from "./VoiceSettings";

const LANGUAGE_NAMES: Record<Locale, string> = { ru: "Русский", uk: "Українська", en: "English" };

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={`${ui.card} p-5 md:p-6`}>
      <h2 className={`${ui.label} mb-4`}>{title}</h2>
      {children}
    </section>
  );
}

/** Settings as a page, or `embedded` in the header's popup: no header of its own, and About opens beside it. */
export default function SettingsClient({ embedded = false, onOpenAbout }: { embedded?: boolean; onOpenAbout?: () => void }) {
  const { t, locale, setLocale } = useI18n();
  const { desktop, fullScreen } = useDesktopWindow();
  const [theme, setTheme] = usePreference("theme");
  const [model, setModel] = usePreference("model");
  const gameMaster = useGameMaster();
  const { status, refresh } = gameMaster;
  const { user } = useUser();
  const params = useSearchParams();
  const [models, setModels] = useState<{ slug: string; displayName: string }[] | null>(null);
  const [modelsFailed, setModelsFailed] = useState(false);
  const [working, setWorking] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [tourNote, setTourNote] = useState(false);
  const [google, setGoogle] = useState<"idle" | "waiting" | "failed">("idle");

  const connected = status?.status === "connected";

  const googleSignIn = async () => {
    setGoogle("waiting");
    try {
      await signInWithGoogle();
      setGoogle("idle");
    } catch {
      setGoogle("failed");
    }
  };

  useEffect(() => {
    if (!connected) return;
    let alive = true;
    getModels().then(
      ({ models }) => alive && (setModels(models), setModelsFailed(false)),
      () => alive && setModelsFailed(true),
    );
    return () => {
      alive = false;
    };
  }, [connected]);

  const errorText = (code: string, fallback: string) => {
    const key = errorKey(code);
    return key ? t(key) : fallback;
  };

  const flash = params.get("chatgpt");
  const flashError = flash === "error" && status?.error ? errorText(status.error.code, status.error.message) : null;

  const connect = async () => {
    setAiError(null);
    // Open the tab synchronously, inside the click, or the browser blocks it.
    // The desktop app opens the system browser instead and gets no handle back.
    const desktop = isDesktopApp();
    const tab = desktop ? null : window.open("about:blank", "_blank");
    setWorking(true);
    try {
      const { authUrl } = await connectAi();
      if (tab) {
        tab.opener = null;
        tab.location.href = authUrl;
      }
      else if (desktop) window.open(authUrl, "_blank");
      else if (!window.open(authUrl, "_blank")) setAiError(t("ai.popupBlocked"));
      await refresh();
    } catch (error) {
      tab?.close();
      setAiError(error instanceof ApiError ? errorText(error.code, error.message) : t("error.generic"));
    } finally {
      setWorking(false);
    }
  };

  const disconnect = async () => {
    setWorking(true);
    try {
      await disconnectAi();
      setModels(null);
      await refresh();
    } finally {
      setWorking(false);
    }
  };

  const cloud = isCloudEnabled();

  return (
    <div className={embedded ? "" : "min-h-screen"}>
      {!embedded && <AppHeader back="/" title={t("settings.title")} subtitle={`${t("app.stage")} ${APP_VERSION}`} />}
      <main className={embedded ? "grid gap-4" : "mx-auto grid max-w-3xl gap-4 px-4 py-6"}>
        <Section title={t("ai.title")}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-xl border border-line bg-page text-ink">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 font-black text-ink">
                  <span className={`h-2 w-2 rounded-full ${connected && status?.sharing ? "bg-emerald-500" : "bg-amber-500"}`} />
                  {status === null ? "…" : connected ? t("ai.connected") : t("ai.notConnected")}
                </div>
                {status?.identity && (
                  <div className="truncate text-xs font-medium text-muted">{status.identity.email ?? status.identity.name}</div>
                )}
              </div>
              {status?.provider !== "mock" &&
                (connected ? (
                  <button type="button" onClick={disconnect} disabled={working} className={`${ui.destructive} px-4 py-2.5 text-xs font-bold`}>
                    <Unplug className="h-4 w-4" />
                    {t("ai.disconnect")}
                  </button>
                ) : (
                  <button type="button" onClick={connect} disabled={working} className={`${ui.primary} px-4 py-2.5 text-xs`}>
                    {working || status?.status === "connecting" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {t("ai.signIn")}
                  </button>
                ))}
            </div>

            {status?.provider === "mock" && <p className="rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-700">{isDemo() ? t("demo.banner") : t("ai.mock")}</p>}
            {gameMaster.canChoose && status !== null && (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-page p-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-black text-ink">{t("demo.try")}</div>
                  <p className="mt-0.5 text-xs font-medium leading-relaxed text-muted">{gameMaster.demo ? t("demo.on") : t("demo.tryBody")}</p>
                </div>
                <button
                  type="button"
                  onClick={() => gameMaster.setDemo(!gameMaster.demo)}
                  aria-pressed={gameMaster.demo}
                  className={`${gameMaster.demo ? ui.secondary : ui.primary} px-4 py-2.5 text-xs`}
                >
                  <Gamepad2 className="h-4 w-4" />
                  {gameMaster.demo ? t("demo.stop") : t("demo.play")}
                </button>
              </div>
            )}
            {status?.status === "connecting" && <p className="text-xs font-bold text-ink">{t("ai.connecting")}</p>}
            {status?.status === "reauth_required" && <p className="rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-700">{t("ai.reauth")}</p>}
            {connected && !status?.sharing && <p className="rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-700">{t("ai.noSharing")}</p>}
            {(aiError || flashError) && <p className="rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">{aiError ?? flashError}</p>}

            {connected && (
              <label className="block">
                <span className={`${ui.label} mb-1.5 block`}>{t("ai.model")}</span>
                <select value={model} onChange={(e) => setModel(e.target.value)} className={`${ui.input} appearance-none py-2.5`}>
                  <option value="">{t("ai.modelAuto")}</option>
                  {models?.map((m) => (
                    <option key={m.slug} value={m.slug}>
                      {m.displayName}
                    </option>
                  ))}
                </select>
                {modelsFailed && <span className="mt-1 block text-xs font-medium text-red-600">{t("ai.modelsFailed")}</span>}
              </label>
            )}

            <div className="grid gap-1.5 text-xs font-medium text-muted">
              <p>{t("ai.planNote")}</p>
              <a href={CHATGPT_USAGE_URL} target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-1 font-bold text-ink hover:text-accent">
                {t("ai.usage")}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </Section>

        {cloud && (
        <Section title={t("account.title")}>
          {user ? (
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="truncate font-black text-ink">{t("account.signedIn", { name: displayName(user) })}</div>
                <div className="text-xs font-medium text-muted">{t("account.cloudOn")}</div>
              </div>
              <button type="button" onClick={() => void signOut()} className={`${ui.secondary} px-4 py-2.5 text-xs`}>
                <LogOut className="h-4 w-4" />
                {t("account.signOut")}
              </button>
            </div>
          ) : (
            <div className="grid gap-2">
              <div className="flex flex-wrap items-center gap-3">
                <p className="min-w-0 flex-1 text-sm font-medium text-muted">{t("account.guest")}</p>
                <button type="button" onClick={() => void googleSignIn()} disabled={google === "waiting"} className={`${ui.secondary} px-4 py-2.5 text-xs`}>
                  <GoogleMark />
                  {t("account.google")}
                  {google === "waiting" ? <Loader2 className="h-4 w-4 animate-spin text-muted" /> : <LogIn className="h-4 w-4 text-muted" />}
                </button>
              </div>
              {google === "waiting" && isDesktopApp() && <p className="text-xs font-medium text-muted">{t("account.googleWaiting")}</p>}
              {google === "failed" && <p className="text-xs font-medium text-war">{t("account.googleFailed")}</p>}
            </div>
          )}
        </Section>
        )}

        <Section title={t("settings.language")}>
          <div className="flex flex-wrap gap-1 rounded-xl bg-page p-1">
            {LOCALES.map((l) => (
              <button key={l} type="button" onClick={() => setLocale(l)} className={`${ui.segment} flex-1 ${l === locale ? `${ui.segmentOn} bg-surface shadow-sm` : ui.segmentOff}`}>
                {LANGUAGE_NAMES[l]}
              </button>
            ))}
          </div>
        </Section>

        <Section title={t("settings.voice")}>
          <VoiceSettings />
        </Section>

        <Section title={t("settings.theme")}>
          <div className="flex flex-wrap gap-1 rounded-xl bg-page p-1">
            {(["system", "light", "dark"] as Theme[]).map((th) => (
              <button key={th} type="button" onClick={() => setTheme(th)} className={`${ui.segment} flex-1 ${th === theme ? `${ui.segmentOn} bg-surface shadow-sm` : ui.segmentOff}`}>
                {t(`settings.theme.${th}`)}
              </button>
            ))}
          </div>
        </Section>

        {desktop && fullScreen !== null && (
          <Section title={t("settings.window")}>
            <div className="flex flex-wrap gap-1 rounded-xl bg-page p-1">
              {[true, false].map((on) => (
                <button key={String(on)} type="button" onClick={() => void desktop.setFullScreen(on)} className={`${ui.segment} flex-1 ${on === fullScreen ? `${ui.segmentOn} bg-surface shadow-sm` : ui.segmentOff}`}>
                  {t(on ? "settings.window.full" : "settings.window.windowed")}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs font-medium text-muted">{t("settings.window.hint")}</p>
          </Section>
        )}

        <UpdatesSection />

        <Section title={t("settings.about")}>
          <p className="text-sm font-medium leading-relaxed text-ink">{t("settings.aboutText")}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {onOpenAbout ? (
              <button type="button" onClick={onOpenAbout} className={`${ui.secondary} px-4 py-2.5 text-xs`}>
                <Info className="h-4 w-4" />
                {t("nav.about")}
              </button>
            ) : (
              <Link href="/about" className={`${ui.secondary} px-4 py-2.5 text-xs`}>
                <Info className="h-4 w-4" />
                {t("nav.about")}
              </Link>
            )}
            <Link href="/privacy" className={`${ui.secondary} px-4 py-2.5 text-xs`}>
              <ShieldCheck className="h-4 w-4" />
              {t("nav.privacy")}
            </Link>
            <a href={REPO_URL} target="_blank" rel="noreferrer" className={`${ui.secondary} px-4 py-2.5 text-xs`}>
              <CodeXml className="h-4 w-4" />
              {t("settings.source")}
            </a>
            <a href={CONTENT_REPORT_URL} target="_blank" rel="noreferrer" className={`${ui.secondary} px-4 py-2.5 text-xs`}>
              <Flag className="h-4 w-4" />
              {t("report.ai")}
            </a>
            <button
              type="button"
              onClick={() => {
                replayTour();
                setTourNote(true);
              }}
              className={`${ui.secondary} px-4 py-2.5 text-xs`}
            >
              <GraduationCap className="h-4 w-4" />
              {t("tour.replay")}
            </button>
          </div>
          {tourNote && <p className="mt-2 text-xs font-bold text-emerald-700">{t("tour.replayNote")}</p>}
        </Section>
      </main>
    </div>
  );
}

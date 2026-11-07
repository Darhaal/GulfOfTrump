import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { THEME_SCRIPT } from "@/components/ThemeController";
import { ui } from "@/components/ui/classes";
import { APP_NAME } from "@/constants/app";
import type { Locale } from "@/engine/types";
import { translate } from "@/i18n/translate";
import { localePath } from "@/lib/localePath";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin", "cyrillic"], display: "swap" });

// Next.js adds noindex to every page answered with 404.
export const metadata: Metadata = { title: `404 · ${APP_NAME}` };

/**
 * An address that matches no page (/nothing, /ru/new/1800: the dates take
 * only their own params). Its language is not known, so it says so in all
 * three, each with the way to its own front page.
 */
export default function GlobalNotFound() {
  const locales: Locale[] = ["en", "ru", "uk"];
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className={`${geistSans.variable} font-sans antialiased bg-page text-ink`}>
        <main className="grid min-h-screen place-items-center px-4">
          <div className={`${ui.card} flex max-w-md flex-col items-center gap-4 p-8 text-center`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- a static file, and this page has no image optimiser behind it */}
            <img src="/brand/emblem.webp" alt="" width={56} height={56} className="h-14 w-14" />
            <h1 className="text-5xl font-black tracking-tighter text-accent tabular-nums">404</h1>
            {locales.map((locale) => (
              <section key={locale} lang={locale} className="grid gap-1">
                <h2 className="text-lg font-black tracking-tight text-ink">{translate(locale, "notFound.title")}</h2>
                <p className="text-sm font-medium leading-relaxed text-muted">{translate(locale, "notFound.body")}</p>
                <a href={localePath(locale, "/")} className="text-sm font-bold text-accent underline-offset-2 hover:underline">
                  {translate(locale, "notFound.home")}
                </a>
              </section>
            ))}
          </div>
        </main>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Geist, Geist_Mono } from "next/font/google";
import Telemetry from "@/components/Telemetry";
import ThemeController, { ThemeScript } from "@/components/ThemeController";
import { APP_NAME } from "@/constants/app";
import { LOCALES, type Locale } from "@/engine/types";
import { RouteLocaleProvider } from "@/i18n/routeLocale";
import { translate } from "@/i18n/translate";
import { siteMetadata } from "@/lib/seo";
import "../globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin", "cyrillic"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });

const isLocale = (value: string): value is Locale => (LOCALES as readonly string[]).includes(value);

/** Every page in English (served at the bare address by src/proxy.ts), Russian and Ukrainian. */
export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const locale = isLocale(lang) ? lang : "en";
  return {
    ...siteMetadata(),
    title: { default: translate(locale, "seo.home.title"), template: `%s · ${APP_NAME}` },
    description: translate(locale, "seo.home.description"),
    // The emblem: a spruce, an eagle and mountains at sunset (public/brand).
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "any" },
        { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
        { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
      ],
      apple: "/apple-icon.png",
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#F5F0E6",
  width: "device-width",
  initialScale: 1,
};

/**
 * The root of every page, in the language of its address: <html lang> is
 * the page's language, and on /ru and /uk the pages render in it
 * (i18n/routeLocale.tsx). On the bare address the player's own language
 * takes over once the page opens, as the theme script sets it before paint.
 */
export default async function RootLayout({ children, params }: Readonly<{ children: React.ReactNode; params: Promise<{ lang: string }> }>) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <html lang={lang} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased bg-page text-ink`}>
        <RouteLocaleProvider locale={lang === "en" ? null : lang}>
          <ThemeController />
          {children}
          <Telemetry />
        </RouteLocaleProvider>
      </body>
    </html>
  );
}

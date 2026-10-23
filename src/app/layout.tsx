import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import ThemeController, { THEME_SCRIPT } from "@/components/ThemeController";
import { APP_NAME, isDemo } from "@/constants/app";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin", "cyrillic"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: { default: `${APP_NAME} – alternate-history strategy`, template: `%s · ${APP_NAME}` },
  description: "Open-source alternate-history grand strategy where a language model is the game master. Plays on your own ChatGPT plan.",
  applicationName: APP_NAME,
  // The demo site is there to be found; a game on someone's own computer is nothing for search engines.
  robots: isDemo() ? { index: true, follow: true } : { index: false, follow: false },
  // Google Search Console's proof that the demo site is ours.
  ...(isDemo() ? { verification: { google: "Uf2dB5O6FWcwR6d-kSoT59ECv9t65HY8yGvp3sji8ZE" } } : {}),
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

export const viewport: Viewport = {
  themeColor: "#F5F0E6",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased bg-page text-ink`}>
        <ThemeController />
        {children}
      </body>
    </html>
  );
}

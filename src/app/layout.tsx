import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import ThemeController, { THEME_SCRIPT } from "@/components/ThemeController";
import { APP_NAME } from "@/constants/app";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin", "cyrillic"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: { default: `${APP_NAME} — alternate-history strategy`, template: `%s · ${APP_NAME}` },
  description: "Open-source alternate-history grand strategy where a language model is the game master. Plays on your own ChatGPT plan.",
  applicationName: APP_NAME,
  // A local game: nothing here is for search engines.
  robots: { index: false, follow: false },
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
  themeColor: "#F8FAFC",
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

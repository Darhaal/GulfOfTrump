import type { Metadata } from "next";
import { APP_NAME, APP_VERSION, DOWNLOAD_URL, isDemo, ITCH_URL, LICENSE_URL, REPO_URL, SITE_URL, SITE_VERIFICATION, STORE_URL } from "@/constants/app";
import { yearOf } from "@/engine/calendar";
import { getScenario, newGamePath } from "@/engine/scenarios";
import { LOCALES, type Locale, type ScenarioId, type StartVariant } from "@/engine/types";
import { AUTHOR_LINKS } from "@/i18n/about";
import { translate } from "@/i18n/translate";
import { faqEntries, plainDate } from "./faq";
import { localePath } from "./localePath";

/**
 * What search engines and link previews read of the demo site: each page's
 * title, description, address in each language and card, and the structured
 * data (JSON-LD) of the front page and the dates. Pure, so tests read it as
 * the pages do. docs/seo.md has the whole picture.
 */

/** The author's own site, his page in the structured data. */
const AUTHOR_SITE = AUTHOR_LINKS.find((l) => l.label === "okhten.com")?.href ?? AUTHOR_LINKS[0].href;

/** Open Graph's names for the languages. */
const OG_LOCALE: Record<Locale, string> = { en: "en_US", ru: "ru_RU", uk: "uk_UA" };

/** The cards drawn by scripts/og.mjs (npm run og), 1200×630. */
export const OG_SIZE = { width: 1200, height: 630 } as const;
export const ogImage = (id: ScenarioId | "home") => `/og/${id}.jpg`;

/** A page's full address on the demo site; the front page is the bare site. */
export const absoluteUrl = (path: string) => (path === "/" ? SITE_URL : `${SITE_URL}${path}`);

/** The page in every language, for hreflang: English is also the default for any other language. */
export function languageAlternates(path: string): Record<Locale | "x-default", string> {
  const urls = Object.fromEntries(LOCALES.map((l) => [l, absoluteUrl(localePath(l, path))])) as Record<Locale, string>;
  return { ...urls, "x-default": urls.en };
}

/** What the root layout says for every page: the site's address, the name, the icons' companions, and who may index it. */
export function siteMetadata(): Metadata {
  const demo = isDemo();
  const yandex = SITE_VERIFICATION.yandex();
  const bing = SITE_VERIFICATION.bing();
  return {
    metadataBase: new URL(SITE_URL),
    applicationName: APP_NAME,
    authors: [{ name: "Artem Okhten", url: AUTHOR_SITE }],
    creator: "Artem Okhten",
    // The demo site is there to be found; a game on someone's own computer is nothing for search engines.
    robots: demo ? { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } } : { index: false, follow: false },
    // The search engines' proof that the demo site is ours.
    ...(demo
      ? {
          verification: {
            google: SITE_VERIFICATION.google,
            ...(yandex ? { yandex } : {}),
            ...(bing ? { other: { "msvalidate.01": bing } } : {}),
          },
        }
      : {}),
    formatDetection: { telephone: false, address: false, email: false },
  };
}

interface PageSeo {
  locale: Locale;
  /** The page's address without its language: "/", "/new/1939/eve". */
  path: string;
  title: string;
  description: string;
  image: { url: string; alt: string };
  /** The front page's title stands alone; the rest end in " · Gulf of Trump". */
  absoluteTitle?: boolean;
}

/** A page's title, description, canonical address, its other languages, and its Open Graph and Twitter cards. */
export function pageMetadata({ locale, path, title, description, image, absoluteTitle = false }: PageSeo): Metadata {
  const url = absoluteUrl(localePath(locale, path));
  const fullTitle = absoluteTitle ? title : `${title} · ${APP_NAME}`;
  const images = [{ url: image.url, ...OG_SIZE, alt: image.alt, type: "image/jpeg" }];
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: url, languages: languageAlternates(path) },
    openGraph: {
      type: "website",
      siteName: APP_NAME,
      url,
      title: fullTitle,
      description,
      locale: OG_LOCALE[locale],
      alternateLocale: LOCALES.filter((l) => l !== locale).map((l) => OG_LOCALE[l]),
      images,
    },
    twitter: { card: "summary_large_image", title: fullTitle, description, images: [{ url: image.url, alt: image.alt }] },
  };
}

/** The front page. */
export function homeMetadata(locale: Locale): Metadata {
  return pageMetadata({
    locale,
    path: "/",
    title: translate(locale, "seo.home.title"),
    description: translate(locale, "seo.home.description"),
    image: { url: ogImage("home"), alt: translate(locale, "seo.image.home") },
    absoluteTitle: true,
  });
}

/** A date's name for its page: "1 September 1939 – The Invasion of Poland", the week before marked so. */
export function dateTitle(id: ScenarioId, variant: StartVariant | null, locale: Locale): string {
  const s = getScenario(id, variant);
  const title = `${plainDate(s.startDate, locale)} – ${s.title[locale]}`;
  return variant ? `${title} (${translate(locale, variant === "eve" ? "start.eve" : "start.tutorial").toLowerCase()})` : title;
}

/** A date or one of its starts: its day and name, its tagline, its card. */
export function dateMetadata(id: ScenarioId, variant: StartVariant | null, locale: Locale): Metadata {
  const s = getScenario(id, variant);
  const base = pageMetadata({
    locale,
    path: newGamePath(id, variant),
    title: dateTitle(id, variant, locale),
    description: translate(locale, "seo.date.description", { tagline: s.tagline[locale] }),
    image: { url: ogImage(id), alt: translate(locale, "seo.image.date", { year: yearOf(s.startDate), title: s.title[locale] }) },
  });
  // The tutorial begins a game the moment it opens: nothing to index.
  return s.player ? { ...base, robots: { index: false, follow: true } } : base;
}

/** A page with no address of its own in search: a game, the settings, sign-in. */
export const privateMetadata: Metadata = { robots: { index: false, follow: false } };

const author = {
  "@type": "Person",
  "@id": `${SITE_URL}/#author`,
  name: "Artem Okhten",
  url: AUTHOR_SITE,
  sameAs: AUTHOR_LINKS.map((l) => l.href).filter((href) => href !== AUTHOR_SITE),
};

type JsonLd = Record<string, unknown>;

/** The front page's structured data: the site, the game itself, and the questions the page answers (on the demo, which shows them). */
export function homeJsonLd(locale: Locale): JsonLd {
  const url = absoluteUrl(localePath(locale, "/"));
  const description = translate(locale, "seo.home.description");
  const graph: JsonLd[] = [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url,
      name: APP_NAME,
      description,
      inLanguage: LOCALES,
      publisher: { "@id": author["@id"] },
    },
    {
      "@type": "VideoGame",
      "@id": `${SITE_URL}/#game`,
      name: APP_NAME,
      url,
      description,
      image: absoluteUrl(ogImage("home")),
      screenshot: ["turn", "orders", "cabinet", "diplomacy"].map((name) => absoluteUrl(`/screens/${name}.jpg`)),
      genre: ["Strategy", "Grand strategy", "Alternate history"],
      applicationCategory: "GameApplication",
      gamePlatform: ["Windows", "Web browser"],
      operatingSystem: "Windows 10, Windows 11",
      playMode: "SinglePlayer",
      inLanguage: LOCALES,
      softwareVersion: APP_VERSION,
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD", availability: "https://schema.org/InStock" },
      license: LICENSE_URL,
      downloadUrl: DOWNLOAD_URL,
      installUrl: STORE_URL,
      sameAs: [REPO_URL, STORE_URL, ITCH_URL],
      author,
    },
  ];
  if (isDemo()) {
    graph.push({
      "@type": "FAQPage",
      "@id": `${url}#faq`,
      inLanguage: locale,
      mainEntity: faqEntries(locale).map(({ question, answer }) => ({ "@type": "Question", name: question, acceptedAnswer: { "@type": "Answer", text: answer } })),
    });
  }
  return { "@context": "https://schema.org", "@graph": graph };
}

/** The way from the front page to a date and to its other start, for a date's page. */
export function dateJsonLd(id: ScenarioId, variant: StartVariant | null, locale: Locale): JsonLd {
  const s = getScenario(id);
  const crumbs = [
    { name: APP_NAME, path: "/" },
    { name: `${yearOf(s.startDate)} – ${s.title[locale]}`, path: newGamePath(id) },
    ...(variant ? [{ name: dateTitle(id, variant, locale), path: newGamePath(id, variant) }] : []),
  ];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: absoluteUrl(localePath(locale, c.path)) })),
  };
}

/** JSON-LD for a <script> tag: "<" escaped, so no text in it can close the tag. */
export const jsonLdScript = (data: JsonLd) => JSON.stringify(data).replace(/</g, "\\u003c");

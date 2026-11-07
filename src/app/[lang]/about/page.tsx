import type { Metadata } from "next";
import AboutClient from "@/components/about/AboutClient";
import { pageLocale } from "@/app/[lang]/locale";
import { ABOUT } from "@/i18n/about";
import { translate } from "@/i18n/translate";
import { ogImage, pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const locale = pageLocale((await params).lang);
  return pageMetadata({
    locale,
    path: "/about",
    title: ABOUT[locale].title,
    description: translate(locale, "seo.about.description"),
    image: { url: ogImage("home"), alt: translate(locale, "seo.image.home") },
  });
}

export default function AboutPage() {
  return <AboutClient />;
}

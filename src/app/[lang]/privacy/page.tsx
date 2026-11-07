import type { Metadata } from "next";
import PrivacyClient from "@/components/about/PrivacyClient";
import { pageLocale } from "@/app/[lang]/locale";
import { PRIVACY } from "@/i18n/privacy";
import { translate } from "@/i18n/translate";
import { ogImage, pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const locale = pageLocale((await params).lang);
  return pageMetadata({
    locale,
    path: "/privacy",
    title: PRIVACY[locale].title,
    description: translate(locale, "seo.privacy.description"),
    image: { url: ogImage("home"), alt: translate(locale, "seo.image.home") },
  });
}

export default function PrivacyPage() {
  return <PrivacyClient />;
}

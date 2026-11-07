import type { Metadata } from "next";
import HomeClient from "@/components/home/HomeClient";
import { pageLocale } from "@/app/[lang]/locale";
import { homeJsonLd, homeMetadata, jsonLdScript } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  return homeMetadata(pageLocale((await params).lang));
}

export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const locale = pageLocale((await params).lang);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(homeJsonLd(locale)) }} />
      <HomeClient />
    </>
  );
}

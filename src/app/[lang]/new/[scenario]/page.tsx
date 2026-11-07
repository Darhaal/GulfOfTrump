import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PickClient from "@/components/pick/PickClient";
import { pageLocale } from "@/app/[lang]/locale";
import { isScenarioId, SCENARIO_ORDER } from "@/engine/scenarios";
import { dateJsonLd, dateMetadata, jsonLdScript } from "@/lib/seo";

export function generateStaticParams() {
  return SCENARIO_ORDER.map((scenario) => ({ scenario }));
}

// Any other date is no page: it gets the 404 of an address that matches nothing (app/global-not-found.tsx).
export const dynamicParams = false;

type Params = { params: Promise<{ lang: string; scenario: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang, scenario } = await params;
  if (!isScenarioId(scenario)) notFound();
  return dateMetadata(scenario, null, pageLocale(lang));
}

export default async function NewGamePage({ params }: Params) {
  const { lang, scenario } = await params;
  if (!isScenarioId(scenario)) notFound();
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(dateJsonLd(scenario, null, pageLocale(lang))) }} />
      <PickClient scenarioId={scenario} />
    </>
  );
}

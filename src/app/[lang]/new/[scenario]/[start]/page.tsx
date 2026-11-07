import type { Metadata } from "next";
import { notFound } from "next/navigation";
import TutorialStart from "@/components/home/TutorialStart";
import PickClient from "@/components/pick/PickClient";
import { pageLocale } from "@/app/[lang]/locale";
import { getScenario, isScenarioId, isStartVariant, SCENARIO_ORDER, startsOf } from "@/engine/scenarios";
import type { ScenarioId, StartVariant } from "@/engine/types";
import { dateJsonLd, dateMetadata, jsonLdScript } from "@/lib/seo";

export function generateStaticParams() {
  return SCENARIO_ORDER.flatMap((scenario) => startsOf(scenario).flatMap((start) => (start ? [{ scenario, start }] : [])));
}

// Any other start is no page: it gets the 404 of an address that matches nothing (app/global-not-found.tsx).
export const dynamicParams = false;

type Params = { params: Promise<{ lang: string; scenario: string; start: string }> };

/** The date and start of the address, or not a page. */
function startOf(scenario: string, start: string): { id: ScenarioId; variant: StartVariant } {
  if (!isScenarioId(scenario) || !isStartVariant(start) || !startsOf(scenario).includes(start)) notFound();
  return { id: scenario, variant: start };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang, scenario, start } = await params;
  const { id, variant } = startOf(scenario, start);
  return dateMetadata(id, variant, pageLocale(lang));
}

export default async function NewGameStartPage({ params }: Params) {
  const { lang, scenario, start } = await params;
  const { id, variant } = startOf(scenario, start);
  // A start played as one country (the tutorial) has no country to pick: the game begins at once.
  if (getScenario(id, variant).player) return <TutorialStart />;
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(dateJsonLd(id, variant, pageLocale(lang))) }} />
      <PickClient scenarioId={id} variant={variant} />
    </>
  );
}

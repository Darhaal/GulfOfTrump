import { notFound } from "next/navigation";
import TutorialStart from "@/components/home/TutorialStart";
import PickClient from "@/components/pick/PickClient";
import { getScenario, isScenarioId, isStartVariant, SCENARIO_ORDER, startsOf } from "@/engine/scenarios";

export function generateStaticParams() {
  return SCENARIO_ORDER.flatMap((scenario) => startsOf(scenario).flatMap((start) => (start ? [{ scenario, start }] : [])));
}

export default async function NewGameStartPage({ params }: { params: Promise<{ scenario: string; start: string }> }) {
  const { scenario, start } = await params;
  if (!isScenarioId(scenario) || !isStartVariant(start) || !startsOf(scenario).includes(start)) notFound();
  // A start played as one country (the tutorial) has no country to pick: the game begins at once.
  if (getScenario(scenario, start).player) return <TutorialStart />;
  return <PickClient scenarioId={scenario} variant={start} />;
}

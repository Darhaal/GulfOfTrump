import { notFound } from "next/navigation";
import PickClient from "@/components/pick/PickClient";
import { isScenarioId, SCENARIO_ORDER } from "@/engine/scenarios";

export function generateStaticParams() {
  return SCENARIO_ORDER.map((scenario) => ({ scenario }));
}

export default async function NewGamePage({ params }: { params: Promise<{ scenario: string }> }) {
  const { scenario } = await params;
  if (!isScenarioId(scenario)) notFound();
  return <PickClient scenarioId={scenario} />;
}

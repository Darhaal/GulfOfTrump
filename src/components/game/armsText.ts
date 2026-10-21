import { Bomb, Cpu, Crosshair, Drone, Factory, FlaskConical, HeartPulse, Plane, Radar, Rocket, Ship, Shield, Truck, Wheat, type LucideIcon } from "lucide-react";
import { breakthroughOf } from "@/engine/research";
import { RESEARCH_DIRECTIONS, type ResearchDirection, type Text, type WeaponKind } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";

type T = (key: MessageKey, vars?: Record<string, string | number>) => string;

export const ARMS_ICONS: Record<WeaponKind, LucideIcon> = { rifles: Crosshair, artillery: Bomb, tanks: Truck, aircraft: Plane, ships: Ship, airDefence: Radar, drones: Drone };

export const DIRECTION_ICONS: Record<ResearchDirection, LucideIcon> = {
  military: Shield,
  industry: Factory,
  agriculture: Wheat,
  medicine: HeartPulse,
  science: FlaskConical,
  communications: Cpu,
  strategic: Rocket,
};

const isDirection = (id: string): id is ResearchDirection => (RESEARCH_DIRECTIONS as readonly string[]).includes(id);

/**
 * What a research record names, in the interface language: a direction, a
 * breakthrough, or a generation of weapons an old save researched as a
 * project ("Tanks, level 3").
 */
export function researchLabel(id: string, t: T, text: (value: Text | undefined) => string): string {
  if (isDirection(id)) return t(`research.dir.${id}` as MessageKey);
  const b = breakthroughOf(id);
  if (b) return text(b.name);
  const [prefix, kind, level] = id.split(":");
  if (prefix === "gen") return t("research.gen", { kind: t(`arms.kind.${kind}` as MessageKey), level });
  return id;
}

/** Years before history (negative: after it), as the interface says them. */
export function versusText(years: number, t: T): string {
  const n = Math.max(1, Math.round(Math.abs(years)));
  return years >= 0.5 ? t("research.early", { n }) : years <= -0.5 ? t("research.late", { n }) : t("research.onTime");
}

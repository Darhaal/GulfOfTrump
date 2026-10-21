import { Atom, Bomb, Brain, Cpu, Crosshair, Dna, Drone, Factory, Globe, Pill, Plane, Radar, Rocket, Satellite, Ship, Truck, Wheat, type LucideIcon } from "lucide-react";
import { projectOf } from "@/engine/research";
import type { GameState, Text, WeaponKind } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";

type T = (key: MessageKey, vars?: Record<string, string | number>) => string;

export const ARMS_ICONS: Record<WeaponKind, LucideIcon> = { rifles: Crosshair, artillery: Bomb, tanks: Truck, aircraft: Plane, ships: Ship, airDefence: Radar, drones: Drone };

const PROJECT_ICONS: Record<string, LucideIcon> = { rockets: Rocket, nuclear: Atom, computing: Cpu, antibiotics: Pill, green: Wheat, automation: Factory, satellites: Satellite, internet: Globe, biotech: Dna, ai: Brain };

/** A project's icon: its kind of weapon, or its own. */
export function projectIcon(id: string): LucideIcon {
  const [prefix, kind] = id.split(":");
  return prefix === "gen" ? (ARMS_ICONS[kind as WeaponKind] ?? Rocket) : (PROJECT_ICONS[id] ?? Rocket);
}

/** A research project's name in the interface language: "Tanks, level 3", or its own name. */
export function projectLabel(id: string, state: Pick<GameState, "research" | "date" | "player" | "countries">, t: T, text: (value: Text | undefined) => string): string {
  const p = projectOf(state, id);
  if (!p) return id;
  if (p.gen) return t("research.gen", { kind: t(`arms.kind.${p.gen.kind}` as MessageKey), level: p.gen.level });
  return text(p.name);
}

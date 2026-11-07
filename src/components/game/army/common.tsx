"use client";

import { MapPin } from "lucide-react";
import type { ReactNode } from "react";
import Flag from "@/components/Flag";
import { tally } from "@/engine/army";
import { provinceName } from "@/engine/provinces";
import type { GameState, Locale, MapRegion, SectorTurn, War } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";

/** The army tab's sections, in the order of its segment buttons. */
export const ARMY_SECTIONS = ["forces", "fronts", "losses", "command"] as const;
export type ArmySection = (typeof ARMY_SECTIONS)[number];

/** Shows a turn's changes on the map, as the chronicle's "On the map" does, brought into view or only some of its provinces. */
export type ShowTurn = (turn: number, regions?: string[]) => void;

/** Full months from one date to another. */
export function monthsBetween(from: string, to: string): number {
  const [ya, ma, da] = from.split("-").map(Number);
  const [yb, mb, db] = to.split("-").map(Number);
  return Math.max(0, (yb - ya) * 12 + (mb - ma) - (db < da ? 1 : 0));
}

/** The player's wars, the fighting ones first. */
export const playerWars = (state: GameState): War[] =>
  state.wars.filter((w) => w.attackers.includes(state.player) || w.defenders.includes(state.player)).sort((a, b) => Number(Boolean(a.truce)) - Number(Boolean(b.truce)));

/** The player's side of a war and the enemy's. */
export const sidesOf = (state: GameState, war: War): { mine: string[]; theirs: string[] } =>
  war.attackers.includes(state.player) ? { mine: war.attackers, theirs: war.defenders } : { mine: war.defenders, theirs: war.attackers };

/**
 * The words every section of the army tab uses: numbers in the interface
 * language, the army's figures as its books count them (engine/army.ts
 * tally), countries and provinces by name, and soldiers in thousands.
 */
export function useArmyWords(state: GameState, regions?: Record<string, MapRegion> | null) {
  const { text, locale, people } = useI18n();
  const game = state.seed ?? state.id;
  const num = (n: number) => n.toLocaleString(locale);
  const count = (n: number, key: string, unit: "thousands" | "pieces" = "pieces") => num(tally(n, game, state.turn, `${state.player}:${key}`, unit));
  const country = (tag: string) => text(state.countries[tag]?.name ?? tag);
  const place = (id: string) => (regions?.[id] ? provinceName(regions[id], locale) : id);
  /** Soldiers, thousands: exact under a thousand, short above. */
  const soldiers = (thousands: number) => (thousands < 1 ? Math.round(thousands * 1000).toLocaleString(locale) : people(thousands));
  return { num, count, country, place, soldiers };
}

/** A number as an ordinal for a feminine noun (армия, армія) or in English: "1st", "1-я", "1-ша". */
export function ordinal(n: number, locale: Locale): string {
  const tens = n % 100;
  const last = n % 10;
  if (locale === "ru") return `${n}-я`;
  if (locale === "uk") return `${n}-${tens >= 11 && tens <= 19 ? "та" : last === 1 ? "ша" : last === 2 ? "га" : last === 3 ? "тя" : last === 7 || last === 8 ? "ма" : "та"}`;
  return `${n}${tens >= 11 && tens <= 13 ? "th" : (["th", "st", "nd", "rd"][last] ?? "th")}`;
}

/** A formation's name: the game master's, or its number for one the engine made (engine/formations.ts). */
export function useUnitName() {
  const { t, locale } = useI18n();
  return (u: { name?: string; n: number }) => u.name ?? t("units.army", { n: ordinal(u.n, locale) });
}

/** A commander's character in a word, from his temper (−2 timid … 2 reckless). */
export const TEMPER_KEY: Record<number, MessageKey> = { [-2]: "units.temper.timid", [-1]: "units.temper.careful", 0: "units.temper.steady", 1: "units.temper.bold", 2: "units.temper.reckless" };

/** A formation's turn in one line, as the army tab tells it: "Assault at the Somme: 57 thousand lost, 2 km gained". */
export function useSectorLine(state: GameState, regions?: Record<string, MapRegion> | null) {
  const { t } = useI18n();
  const { place, soldiers } = useArmyWords(state, regions);
  return (s: SectorTurn) => {
    const posture = t(`posture.${s.posture}` as MessageKey);
    const head = s.at ? t("sectors.at", { posture, place: place(s.at) }) : posture;
    const km = Math.abs(s.km) >= 0.5 ? t(s.km > 0 ? "sectors.gained" : "sectors.given", { n: Math.round(Math.abs(s.km)) }) : t("sectors.held");
    return `${head}: ${t("sectors.lost", { n: soldiers(s.lost) })}, ${km}`;
  };
}

/** A country as its flag, its name on hover. */
export function CountryFlag({ state, tag }: { state: GameState; tag: string }) {
  const { text } = useI18n();
  const name = text(state.countries[tag]?.name ?? tag);
  return (
    <span title={name} aria-label={name} role="img" className="inline-flex shrink-0">
      <Flag tag={tag} scenario={state.scenarioId} color={state.countries[tag]?.color} size="sm" />
    </span>
  );
}

/** A province named as a link to the map. */
export function PlaceLink({ name, onClick, children }: { name: string; onClick: () => void; children?: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="min-w-0 truncate text-left font-bold text-ink underline decoration-line decoration-dotted underline-offset-2 hover:text-accent hover:decoration-accent">
      {name}
      {children}
    </button>
  );
}

/** "On the map": a small accent action that brings provinces into view. */
export function MapButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex shrink-0 items-center gap-1 text-2xs font-black uppercase tracking-wider text-muted hover:text-accent">
      <MapPin className="h-3 w-3" />
      {label}
    </button>
  );
}

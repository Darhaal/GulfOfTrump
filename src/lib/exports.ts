"use client";

import { formatDate } from "@/engine/calendar";
import { regionLabel } from "@/engine/provinces";
import type { GameState, Locale, MapIndex, Text } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { describeChange, sortChanges } from "@/components/game/changes";

type T = (key: MessageKey, vars?: Record<string, string | number>) => string;

/** Hands the browser a file to save, without a server round trip. */
export function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The whole chronicle as Markdown — for reading, or for sending to whoever reviews the game. */
export function chronicleMarkdown(state: GameState, index: MapIndex | null, locale: Locale, t: T, text: (v: Text | undefined) => string): string {
  const lines: string[] = [];
  const player = text(state.countries[state.player]?.name);
  lines.push(`# Gulf of Trump — ${player}, ${state.scenarioId}`);
  lines.push("");
  lines.push(`${formatDate(state.date, locale)} · ${t("game.turn", { n: state.turn })}`);
  for (const e of [...state.chronicle].reverse()) {
    lines.push("");
    lines.push(`## ${t("game.turn", { n: e.turn })} · ${formatDate(e.from, locale)} → ${formatDate(e.to, locale)}`);
    lines.push("");
    lines.push(`**${e.headline}**`);
    lines.push("");
    lines.push(e.narrative);
    if (e.orders.length) {
      lines.push("");
      lines.push(`### ${t("game.yourOrders")}`);
      e.orders.forEach((o, i) => {
        const v = e.verdicts?.find((x) => x.n === i + 1);
        lines.push(`${i + 1}. ${o}${v ? ` — **${t(`verdict.${v.result}` as MessageKey)}**${v.note ? `: ${v.note}` : ""}` : ""}`);
      });
    }
    if (e.applied.length) {
      lines.push("");
      lines.push(`### ${t("game.changes")}`);
      for (const c of sortChanges(e.applied)) lines.push(`- ${describeChange(c, state, t, text, (id) => regionLabel(id, index, locale), (iso) => formatDate(iso, locale))}`);
    }
    if (e.events.length) {
      lines.push("");
      lines.push(`### ${t("game.events")}`);
      for (const ev of e.events) lines.push(`- **${ev.title}** — ${ev.body}`);
    }
  }
  return lines.join("\n") + "\n";
}

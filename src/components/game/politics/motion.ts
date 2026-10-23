"use client";

import type { Motion } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";

/** A motion in a line: its kind, and for a law the change it makes, for a bill or an amendment its words. */
export function useMotionLabel() {
  const { t } = useI18n();
  return (m: Motion) =>
    m.kind === "law" && m.law && m.option
      ? `${t(`law.${m.law}` as MessageKey)}: ${t(`law.${m.law}.${m.option}` as MessageKey)}`
      : m.text && (m.kind === "bill" || m.kind === "constitution")
        ? `${t(`politics.motion.${m.kind}` as MessageKey)}: ${m.text}`
        : t(`politics.motion.${m.kind}` as MessageKey);
}

"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { useI18n } from "@/i18n/useI18n";
import { useAiStatus } from "@/lib/useAiStatus";

/** A small pill in the header: is the game master connected? Links to Settings. */
export default function AiStatusChip() {
  const { t } = useI18n();
  const { status } = useAiStatus();
  const ok = status?.status === "connected" && status.sharing;
  return (
    <Link
      href="/settings"
      className={`group hidden sm:inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition-all ${
        ok ? "border-line bg-surface text-ink hover:border-accent/30" : "border-amber-500/40 bg-amber-50 text-amber-700 hover:border-amber-500"
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${ok ? "bg-emerald-500" : "bg-amber-500"}`} />
      <Sparkles className="h-3.5 w-3.5" />
      {status === null ? "…" : ok ? (status.provider === "mock" ? "Mock" : "ChatGPT") : t("ai.notConnected")}
    </Link>
  );
}

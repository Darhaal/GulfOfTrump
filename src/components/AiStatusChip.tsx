"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/i18n/useI18n";
import { useGameMaster } from "@/lib/gameMaster";
import GameMasterChoice from "./GameMasterChoice";

/**
 * A small pill in the header: who plays the world. Connected or in the demo
 * it links to Settings; with no game master it offers the choice — sign in
 * with ChatGPT, or play the demo.
 */
export default function AiStatusChip() {
  const { t } = useI18n();
  const { status, chatgpt, demo, canChoose } = useGameMaster();
  const [choosing, setChoosing] = useState(false);
  const ok = chatgpt || demo;
  const className = `group hidden sm:inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition-all ${
    chatgpt ? "border-line bg-surface text-ink hover:border-accent/30" : "border-amber-500/40 bg-amber-50 text-amber-700 hover:border-amber-500"
  }`;
  const content = (
    <>
      <span className={`h-2 w-2 rounded-full ${ok ? "bg-emerald-500" : "bg-amber-500"}`} />
      <Sparkles className="h-3.5 w-3.5" />
      {status === null ? "…" : demo ? t("demo.chip") : chatgpt ? "ChatGPT" : t("ai.notConnected")}
    </>
  );
  if (ok || !canChoose || status === null)
    return (
      <Link href="/settings" className={className}>
        {content}
      </Link>
    );
  return (
    <>
      <button type="button" onClick={() => setChoosing(true)} className={className}>
        {content}
      </button>
      <GameMasterChoice open={choosing} onClose={() => setChoosing(false)} />
    </>
  );
}

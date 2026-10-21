"use client";

import Link from "next/link";
import { Gamepad2, Sparkles } from "lucide-react";
import { useI18n } from "@/i18n/useI18n";
import { useGameMaster } from "@/lib/gameMaster";
import Dialog from "./ui/Dialog";
import { ui } from "./ui/classes";

/** The two ways to get a game master: sign in with ChatGPT (in Settings), or play the offline demo. */
export function GameMasterOffer({ onDemo, compact }: { onDemo?: () => void; compact?: boolean }) {
  const { t } = useI18n();
  const { setDemo } = useGameMaster();
  const size = compact ? "px-3 py-2 text-xs" : "px-4 py-2.5 text-xs";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href="/settings" className={`${ui.primary} ${size}`}>
        <Sparkles className="h-4 w-4" />
        {t("ai.signIn")}
      </Link>
      <button
        type="button"
        onClick={() => {
          setDemo(true);
          onDemo?.();
        }}
        className={`${ui.secondary} ${size}`}
      >
        <Gamepad2 className="h-4 w-4" />
        {t("demo.play")}
      </button>
    </div>
  );
}

/** Asked when a turn has no game master: sign in, or play the demo — the game never dead-ends without an account. */
export default function GameMasterChoice({ open, onClose, onDemo }: { open: boolean; onClose: () => void; onDemo?: () => void }) {
  const { t } = useI18n();
  return (
    <Dialog open={open} onClose={onClose} title={t("demo.chooseTitle")}>
      <p className="text-sm font-medium leading-relaxed text-ink">{t("demo.chooseBody")}</p>
      <p className="mt-2 text-xs font-medium leading-relaxed text-muted">{t("demo.tryBody")}</p>
      <div className="mt-4">
        <GameMasterOffer
          onDemo={() => {
            onClose();
            onDemo?.();
          }}
        />
      </div>
    </Dialog>
  );
}

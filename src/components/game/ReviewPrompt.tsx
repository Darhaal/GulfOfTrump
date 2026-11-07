"use client";

import { Mail, Star } from "lucide-react";
import { useEffect, useState } from "react";
import Dialog from "@/components/ui/Dialog";
import { ui } from "@/components/ui/classes";
import { AUTHOR_EMAIL } from "@/i18n/about";
import { useI18n } from "@/i18n/useI18n";
import { desktopWindow } from "@/lib/desktop";
import { addPlay, answerReview, readReview, reviewDue, writeReview, type ReviewAnswer } from "@/lib/review";
import { useUpdates } from "@/lib/updates";

/** How often the time on a game's screen is counted, in seconds. */
const TICK = 60;

/**
 * The Store copy asks for a review in the Microsoft Store after half an hour
 * of play (lib/review.ts): only while the game is on screen and the window
 * shown, a minute into it at least, never over a turn being written, its
 * report, the tour or the tutorial. Nothing in a browser or the other
 * desktop copies.
 */
export default function ReviewPrompt({ quiet }: { quiet: boolean }) {
  const { t } = useI18n();
  const updates = useUpdates();
  const store = Boolean(updates?.store && desktopWindow()?.openStoreReview);
  // Asked at a tick, never the moment a game opens: a minute on screen at least.
  const [due, setDue] = useState(false);

  useEffect(() => {
    if (!store) return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const next = addPlay(readReview(), TICK);
      writeReview(next);
      if (reviewDue(next)) setDue(true);
    }, TICK * 1000);
    return () => window.clearInterval(id);
  }, [store]);

  const answer = (a: ReviewAnswer) => {
    writeReview(answerReview(readReview(), a));
    setDue(false);
    if (a === "review") void desktopWindow()?.openStoreReview?.();
    // A letter in the mail app (desktop/main.cjs opens mailto: outside): what went wrong, said in private.
    if (a === "write") window.open(`mailto:${AUTHOR_EMAIL}?subject=${encodeURIComponent(t("review.mailSubject", { v: updates?.current ?? "" }))}`, "_blank");
  };

  return (
    <Dialog
      open={store && due && !quiet}
      onClose={() => answer("later")}
      title={
        <span className="inline-flex items-center gap-2">
          <Star className="h-5 w-5 text-accent" />
          {t("review.title")}
        </span>
      }
      footer={
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={() => answer("review")} className={`${ui.primary} flex-1 py-3 text-sm`}>
              <Star className="h-4 w-4" />
              {t("review.rate")}
            </button>
            <button type="button" onClick={() => answer("write")} className={`${ui.secondary} flex-1 py-3 text-sm`}>
              <Mail className="h-4 w-4" />
              {t("review.write")}
            </button>
          </div>
          <div className="flex items-center justify-center gap-4 text-xs font-bold text-muted">
            <button type="button" onClick={() => answer("later")} className="hover:text-ink">
              {t("review.later")}
            </button>
            <button type="button" onClick={() => answer("never")} className="hover:text-ink">
              {t("review.never")}
            </button>
          </div>
        </div>
      }
    >
      <p className="text-sm font-medium leading-relaxed text-ink">{t("review.body")}</p>
    </Dialog>
  );
}

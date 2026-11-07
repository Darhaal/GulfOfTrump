"use client";

import { ExternalLink, Gamepad2, Hourglass } from "lucide-react";
import { CHATGPT_USAGE_URL } from "@/constants/app";
import { clockText, untilText } from "@/i18n/countdown";
import { useI18n } from "@/i18n/useI18n";
import { useGameMaster } from "@/lib/gameMaster";
import { closePlanLimit, useNow, usePlanUsage } from "@/lib/planUsage";
import Dialog from "./ui/Dialog";
import { ui } from "./ui/classes";

/**
 * The ChatGPT plan's usage limit, told the game's own way: red, with the
 * time left until the plan resets counting down, and what the player can do
 * meanwhile. Opens over any screen when a request meets the limit
 * (lib/planUsage.ts); every other error keeps its plain notice.
 */
export default function PlanLimitDialog() {
  const { alert } = usePlanUsage();
  return alert ? <LimitDialog resetsAt={alert.resetsAt} /> : null;
}

function LimitDialog({ resetsAt }: { resetsAt?: number }) {
  const { t, locale } = useI18n();
  const gameMaster = useGameMaster();
  const now = useNow(1000);
  const left = resetsAt === undefined ? null : resetsAt - now;
  // The offline game master can stand in while ChatGPT is connected but limited.
  const offline = gameMaster.limited && !gameMaster.demo;
  const point = "flex items-start gap-2.5";
  const icon = "mt-0.5 h-4 w-4 shrink-0 text-war";

  return (
    <Dialog
      open
      onClose={closePlanLimit}
      title={
        <span className="flex items-center gap-2 text-war">
          <Hourglass className="h-5 w-5 shrink-0" />
          {t("limit.title")}
        </span>
      }
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <a href={CHATGPT_USAGE_URL} target="_blank" rel="noreferrer" className={`${ui.secondary} px-4 py-2.5 text-xs`}>
            {t("limit.checkButton")}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          {offline && (
            <button
              type="button"
              onClick={() => {
                gameMaster.setDemo(true);
                closePlanLimit();
              }}
              className={`${ui.secondary} px-4 py-2.5 text-xs`}
            >
              <Gamepad2 className="h-4 w-4" />
              {t("limit.offlineButton")}
            </button>
          )}
          <button type="button" onClick={closePlanLimit} className={`${ui.primary} px-4 py-2.5 text-xs`}>
            {t("limit.close")}
          </button>
        </div>
      }
    >
      <div className="grid gap-4">
        <div className="rounded-2xl border border-war/40 bg-war/10 p-4 text-war">
          {left === null ? (
            <p className="text-sm font-bold">{t("limit.unknown")}</p>
          ) : left > 0 ? (
            <>
              <div className="text-2xs font-black uppercase tracking-widest">{t("limit.resetsIn")}</div>
              <div className="mt-1 text-3xl font-black tabular-nums tracking-tight">{untilText(locale, left)}</div>
              <div className="mt-0.5 text-xs font-bold opacity-80">{clockText(locale, resetsAt!, now)}</div>
            </>
          ) : (
            <p className="text-sm font-bold">{t("limit.over")}</p>
          )}
        </div>
        <p className="text-sm font-medium leading-relaxed text-ink">{t("limit.body")}</p>
        <div>
          <h3 className={`${ui.label} mb-2`}>{t("limit.meanwhile")}</h3>
          <ul className="grid gap-2 text-sm font-medium leading-relaxed text-ink">
            <li className={point}>
              <Hourglass className={icon} />
              {t("limit.wait")}
            </li>
            {offline && (
              <li className={point}>
                <Gamepad2 className={icon} />
                {t("limit.offline")}
              </li>
            )}
            <li className={point}>
              <ExternalLink className={icon} />
              {t("limit.check")}
            </li>
          </ul>
        </div>
      </div>
    </Dialog>
  );
}

"use client";

import { Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import { Suspense, useSyncExternalStore } from "react";
import { useI18n } from "@/i18n/useI18n";
import Dialog from "./ui/Dialog";

/**
 * About and Settings as popups over the screen the player is on, so opening
 * them never leaves a game. Any component opens one with openAppDialog; the
 * header draws them. The /about and /settings pages stay for links.
 */
export type AppDialog = "about" | "settings";

let current: AppDialog | null = null;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function openAppDialog(which: AppDialog | null) {
  current = which;
  for (const l of listeners) l();
}

/** The popup open now, if any: the tutorial's guide steps aside for it. */
export const useAppDialog = () => useSyncExternalStore(subscribe, () => current, () => null);

/** While a popup's contents load. */
function Loading() {
  return (
    <div className="grid place-items-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-muted" />
    </div>
  );
}

// Loaded when first opened, so every screen does not carry them.
const AboutClient = dynamic(() => import("./about/AboutClient"), { ssr: false, loading: Loading });
const SettingsClient = dynamic(() => import("./settings/SettingsClient"), { ssr: false, loading: Loading });

export default function AppDialogs() {
  const { t } = useI18n();
  const open = useSyncExternalStore(subscribe, () => current, () => null);
  const close = () => openAppDialog(null);
  return (
    <>
      <Dialog open={open === "about"} onClose={close} title={t("nav.about")} huge>
        <AboutClient embedded />
      </Dialog>
      <Dialog open={open === "settings"} onClose={close} title={t("settings.title")} wide>
        {/* Settings reads the address for the sign-in's outcome; a popup has none to wait for. */}
        <Suspense>
          <SettingsClient embedded onOpenAbout={() => openAppDialog("about")} />
        </Suspense>
      </Dialog>
    </>
  );
}

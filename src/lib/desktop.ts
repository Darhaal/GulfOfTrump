"use client";

import { useSyncExternalStore } from "react";

import type { UpdateEvent, UpdateSnapshot } from "./updates";

/** What the desktop app's window lets the game do (desktop/preload.cjs). */
export interface DesktopWindow {
  isFullScreen(): Promise<boolean>;
  setFullScreen(on: boolean): Promise<boolean>;
  onFullScreen(listener: (on: boolean) => void): () => void;
  quit(): Promise<void>;
  /** Missing in an app built before visible updates. */
  updates?: {
    get(): Promise<UpdateSnapshot | null>;
    check(): Promise<UpdateSnapshot | null>;
    restart(): Promise<void>;
    seen(): Promise<void>;
    onEvent(listener: (event: UpdateEvent) => void): () => void;
  };
}

/** The desktop app's window, or nothing in a browser. */
export const desktopWindow = (): DesktopWindow | undefined =>
  typeof window === "undefined" ? undefined : (window as Window & { gulfDesktop?: DesktopWindow }).gulfDesktop;

let fullScreen: boolean | null = null;
const listeners = new Set<() => void>();
let unhook: (() => void) | undefined;

function subscribe(listener: () => void) {
  const desktop = desktopWindow();
  if (!desktop) return () => {};
  listeners.add(listener);
  if (!unhook) {
    const set = (on: boolean) => {
      fullScreen = on;
      for (const l of listeners) l();
    };
    unhook = desktop.onFullScreen(set);
    void desktop.isFullScreen().then(set);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size) return;
    unhook?.();
    unhook = undefined;
  };
}

const none = () => () => {};

/**
 * The desktop app's window and whether it is full screen; nothing in a
 * browser. The server's HTML has neither, so the first render agrees with it.
 */
export function useDesktopWindow(): { desktop: DesktopWindow | undefined; fullScreen: boolean | null } {
  const desktop = useSyncExternalStore(none, desktopWindow, () => undefined);
  const on = useSyncExternalStore(subscribe, () => fullScreen, () => null);
  return { desktop, fullScreen: on };
}

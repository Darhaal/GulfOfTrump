"use client";

import { useSyncExternalStore } from "react";

/**
 * The microphones this browser or app can hear through, for Settings. Their
 * names stay hidden until the page has once been allowed the microphone;
 * `revealMicrophones` asks for it, stops at once and lists them again.
 */
let microphones: MediaDeviceInfo[] = [];
const listeners = new Set<() => void>();
const none: MediaDeviceInfo[] = [];

async function list() {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) return;
  try {
    const all = await navigator.mediaDevices.enumerateDevices();
    // "default" and "communications" are aliases Chrome adds for whatever the system picked.
    microphones = all.filter((d) => d.kind === "audioinput" && d.deviceId !== "default" && d.deviceId !== "communications");
  } catch {
    microphones = [];
  }
  for (const l of listeners) l();
}

const changed = () => void list();

function subscribe(listener: () => void) {
  listeners.add(listener);
  const devices = typeof navigator === "undefined" ? undefined : navigator.mediaDevices;
  if (listeners.size === 1) {
    void list();
    devices?.addEventListener?.("devicechange", changed);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) devices?.removeEventListener?.("devicechange", changed);
  };
}

/** Asks for the microphone once, so the list can show the devices' names. */
export async function revealMicrophones() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    for (const track of stream.getTracks()) track.stop();
  } catch {
    // Refused or no microphone: the list stays as it was.
  }
  await list();
}

export function useMicrophones(): { microphones: MediaDeviceInfo[]; named: boolean } {
  const all = useSyncExternalStore(subscribe, () => microphones, () => none);
  return { microphones: all, named: all.some((m) => m.label) };
}

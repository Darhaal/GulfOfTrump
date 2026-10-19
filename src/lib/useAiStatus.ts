"use client";

import { useCallback, useEffect, useState } from "react";
import { getAiStatus, type AiStatus } from "./api";

/**
 * The game master's connection, polled while a sign-in is in progress (the
 * browser tab finishes it on its own) and refreshed when the page regains focus.
 */
export function useAiStatus() {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [failed, setFailed] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setStatus(await getAiStatus());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch of external state
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  useEffect(() => {
    if (status?.status !== "connecting") return;
    const timer = setInterval(() => void refresh(), 1500);
    return () => clearInterval(timer);
  }, [status?.status, refresh]);

  return { status, failed, refresh };
}

"use client";

import { useEffect } from "react";
import { setPreference, usePreference } from "./preferences";
import { useAiStatus } from "./useAiStatus";

/**
 * Who plays the world: the player's ChatGPT plan, or the offline demo.
 *
 * The demo is the player's choice, remembered on this computer: with it on,
 * every game request carries the demo header (lib/api.ts) and the server
 * answers from the stand-in (server/demo.ts), so the whole game can be
 * played without an account. Signing in with ChatGPT turns it off; it can be
 * turned on again while ChatGPT is not connected. The public demo site and
 * GOT_MOCK_AI=1 run the stand-in for everyone and count as the demo too.
 */
export function useGameMaster() {
  const { status, failed, refresh } = useAiStatus();
  const [choice, setChoice] = usePreference("demo");
  const chatgpt = status?.provider === "chatgpt" && status.status === "connected" && status.sharing;
  const everyone = status?.provider === "mock";

  useEffect(() => {
    if (chatgpt && choice === "1") setPreference("demo", "");
  }, [chatgpt, choice]);

  const demo = everyone || (choice === "1" && !chatgpt);
  return {
    status,
    failed,
    refresh,
    /** ChatGPT signed in with plan sharing allowed. */
    chatgpt,
    /** The stand-in answers: chosen here, or for everyone on this server. */
    demo,
    /** Turns, questions and letters can be sent. */
    ready: Boolean(chatgpt || demo),
    /** The player may switch the demo here (not on the demo site, not while ChatGPT is connected). */
    canChoose: !everyone && !chatgpt,
    setDemo: (on: boolean) => setChoice(on ? "1" : ""),
  };
}

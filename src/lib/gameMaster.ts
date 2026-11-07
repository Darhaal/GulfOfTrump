"use client";

import { useEffect } from "react";
import { usePlanLimit } from "./planUsage";
import { setPreference, usePreference } from "./preferences";
import { useAiStatus } from "./useAiStatus";

/**
 * Who plays the world: the player's ChatGPT plan, or the offline demo.
 *
 * The demo is the player's choice, remembered on this computer: with it on,
 * every game request carries the demo header (lib/api.ts) and the server
 * answers from the stand-in (server/demo.ts), so the whole game can be
 * played without an account. Signing in with ChatGPT turns it off; it can be
 * turned on again while ChatGPT is not connected, or while the plan's usage
 * limit stands (lib/planUsage.ts) – then it turns off by itself when the
 * plan resets. The public demo site and GOT_MOCK_AI=1 run the stand-in for
 * everyone and count as the demo too.
 */
export function useGameMaster() {
  const { status, failed, refresh } = useAiStatus();
  const [choice, setChoice] = usePreference("demo");
  const plan = usePlanLimit();
  const chatgpt = status?.provider === "chatgpt" && status.status === "connected" && status.sharing;
  const everyone = status?.provider === "mock";
  /** ChatGPT is connected but its plan's usage limit stands. */
  const limited = chatgpt && plan.limit !== null;

  useEffect(() => {
    // Wait for the plan's word: a demo chosen to wait out a limit survives a reload.
    if (chatgpt && plan.settled && !limited && choice === "1") setPreference("demo", "");
  }, [chatgpt, plan.settled, limited, choice]);

  const demo = everyone || (choice === "1" && (!chatgpt || limited));
  return {
    status,
    failed,
    refresh,
    /** ChatGPT signed in with plan sharing allowed. */
    chatgpt,
    /** ChatGPT's plan has hit its usage limit (lib/planUsage.ts). */
    limited,
    /** The stand-in answers: chosen here, or for everyone on this server. */
    demo,
    /** Turns, questions and letters can be sent. */
    ready: Boolean(chatgpt || demo),
    /** The player may switch the demo here (not on the demo site; with ChatGPT connected only while its limit stands). */
    canChoose: !everyone && (!chatgpt || limited),
    setDemo: (on: boolean) => setChoice(on ? "1" : ""),
  };
}

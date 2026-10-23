"use client";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { isDesktopApp } from "@/constants/app";

/**
 * Supabase is optional. Without NEXT_PUBLIC_SUPABASE_URL and
 * NEXT_PUBLIC_SUPABASE_ANON_KEY the game runs as a guest with saves in the
 * browser; with them, Google sign-in turns on and saves sync to the account,
 * on the site and in the desktop app alike. The library loads only when it
 * is configured, so a game without it (the demo, most local copies) does not
 * carry it.
 */
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const CONFIGURED = Boolean(URL_ && KEY && /^https?:\/\//.test(URL_));

let client: Promise<SupabaseClient | null> | undefined;

/** The client, made once; null without Supabase, or while its code cannot be loaded (tried again next time). */
export function getSupabase(): Promise<SupabaseClient | null> {
  client ??= CONFIGURED
    ? import("@supabase/supabase-js").then(
        ({ createClient }) => createClient(URL_!, KEY!, { auth: { flowType: "pkce", persistSession: true, detectSessionInUrl: true } }),
        () => {
          client = undefined;
          return null;
        },
      )
    : Promise.resolve(null);
  return client;
}

export const isCloudEnabled = () => CONFIGURED;

export function useUser(): { user: User | null; ready: boolean } {
  const [user, setUser] = useState<User | null>(null);
  // Without Supabase there is nothing to wait for.
  const [ready, setReady] = useState(!CONFIGURED);
  useEffect(() => {
    if (!CONFIGURED) return;
    let alive = true;
    let unsubscribe: (() => void) | undefined;
    void getSupabase().then(async (supabase) => {
      if (!alive) return;
      if (!supabase) return setReady(true);
      const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
      unsubscribe = () => data.subscription.unsubscribe();
      const { data: current } = await supabase.auth.getSession();
      if (!alive) return;
      setUser(current.session?.user ?? null);
      setReady(true);
    });
    return () => {
      alive = false;
      unsubscribe?.();
    };
  }, []);
  return { user, ready };
}

/**
 * Google sign-in. On the site the page goes to Google and comes back to
 * /auth/callback. In the desktop app Google's page opens in the system
 * browser instead (Google refuses embedded browsers): that browser returns
 * to the game's own server, and this window collects the one-time code from
 * it and finishes the sign-in with the PKCE verifier it kept. Resolves once
 * signed in; throws when the sign-in fails or is abandoned.
 */
export async function signInWithGoogle(): Promise<void> {
  const supabase = await getSupabase();
  if (!supabase) return;
  if (!isDesktopApp()) {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    return;
  }

  const nonce = crypto.randomUUID().replace(/-/g, "");
  const relay = async (step: "begin" | "poll") => {
    const response = await fetch("/api/account/google", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nonce, step }),
    });
    if (!response.ok) throw new Error("relay");
    return (await response.json()) as { status?: string; code?: string; error?: string };
  };
  await relay("begin");
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/auth/app/${nonce}`, skipBrowserRedirect: true },
  });
  if (error || !data.url) throw error ?? new Error("no_url");
  // The app's window sends every outside address to the system browser.
  window.open(data.url, "_blank");

  const until = Date.now() + 10 * 60_000;
  while (Date.now() < until) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const result = await relay("poll").catch(() => null);
    if (!result || result.status === "waiting") continue;
    if (!result.code) throw new Error(result.error ?? "unknown");
    const { error: exchange } = await supabase.auth.exchangeCodeForSession(result.code);
    if (exchange) throw exchange;
    return;
  }
  throw new Error("timeout");
}

export async function signOut() {
  await (await getSupabase())?.auth.signOut();
}

export function displayName(user: User): string {
  const meta = user.user_metadata as { full_name?: string; name?: string } | undefined;
  return meta?.full_name || meta?.name || user.email || "–";
}

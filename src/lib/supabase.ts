"use client";

import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

/**
 * Supabase is optional. Without NEXT_PUBLIC_SUPABASE_URL and
 * NEXT_PUBLIC_SUPABASE_ANON_KEY the game runs as a guest with saves in the
 * browser; with them, Google sign-in turns on and saves sync to the account.
 */
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const CONFIGURED = Boolean(URL_ && KEY && /^https?:\/\//.test(URL_));

let client: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  client = CONFIGURED
    ? createClient(URL_!, KEY!, { auth: { flowType: "pkce", persistSession: true, detectSessionInUrl: true } })
    : null;
  return client;
}

export const isCloudEnabled = () => CONFIGURED;

export function useUser(): { user: User | null; ready: boolean } {
  const [user, setUser] = useState<User | null>(null);
  // Without Supabase there is nothing to wait for.
  const [ready, setReady] = useState(!CONFIGURED);
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  return { user, ready };
}

export async function signInWithGoogle() {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  });
}

export async function signOut() {
  await getSupabase()?.auth.signOut();
}

export function displayName(user: User): string {
  const meta = user.user_metadata as { full_name?: string; name?: string } | undefined;
  return meta?.full_name || meta?.name || user.email || "—";
}

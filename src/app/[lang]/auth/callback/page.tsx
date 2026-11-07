"use client";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { getSupabase } from "@/lib/supabase";

/**
 * Where Google sign-in returns. supabase-js reads the PKCE code from the URL
 * itself (detectSessionInUrl); this page waits for the session and goes home.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  useEffect(() => {
    let alive = true;
    let cleanup: (() => void) | undefined;
    void getSupabase().then((supabase) => {
      if (!alive) return;
      if (!supabase) {
        router.replace("/");
        return;
      }
      const done = () => router.replace("/settings");
      const { data } = supabase.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_IN" || event === "INITIAL_SESSION") done();
      });
      const timer = setTimeout(done, 8000);
      cleanup = () => {
        data.subscription.unsubscribe();
        clearTimeout(timer);
      };
    });
    return () => {
      alive = false;
      cleanup?.();
    };
  }, [router]);

  return (
    <div className="grid min-h-screen place-items-center">
      <Loader2 className="h-6 w-6 animate-spin text-accent" />
    </div>
  );
}

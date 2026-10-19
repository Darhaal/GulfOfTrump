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
    const supabase = getSupabase();
    if (!supabase) {
      router.replace("/");
      return;
    }
    const done = () => router.replace("/settings");
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") done();
    });
    const timer = setTimeout(done, 8000);
    return () => {
      data.subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, [router]);

  return (
    <div className="grid min-h-screen place-items-center">
      <Loader2 className="h-6 w-6 animate-spin text-accent" />
    </div>
  );
}

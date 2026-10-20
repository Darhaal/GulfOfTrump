import { isDemo } from "@/constants/app";
import { settleGoogle } from "@/server/account/googleRelay";
import { rejectNonLoopback } from "@/server/guard";
import { appReturnPage } from "@/server/returnPage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Where the system browser lands after Google sign-in started from the
 * desktop app: it keeps Supabase's one-time code for the app's window and
 * tells the player to go back to the game. See `googleRelay.ts`.
 */
export async function GET(request: Request, { params }: { params: Promise<{ nonce: string }> }) {
  const rejected = rejectNonLoopback(request);
  if (rejected) return rejected;
  if (isDemo()) return new Response(null, { status: 404 });
  const { nonce } = await params;
  const url = new URL(request.url);
  const ok = settleGoogle(nonce, { code: url.searchParams.get("code"), error: url.searchParams.get("error") });
  return new Response(appReturnPage(ok), {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "referrer-policy": "no-referrer" },
  });
}

import { z } from "zod";
import { beginGoogle, takeGoogle } from "@/server/account/googleRelay";
import { rejectInDemo, rejectNonLocal } from "@/server/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ nonce: z.string().max(64), step: z.enum(["begin", "poll"]) });

/**
 * The desktop app's window and its Google sign-in in the system browser:
 * `begin` registers the sign-in, `poll` collects the one-time code once the
 * browser has come back. See `googleRelay.ts`.
 */
export async function POST(request: Request) {
  const rejected = rejectNonLocal(request) ?? rejectInDemo();
  if (rejected) return rejected;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: { code: "bad_request", message: "Expected a nonce and a step." } }, { status: 400 });
  const { nonce, step } = parsed.data;
  if (step === "begin") {
    return beginGoogle(nonce)
      ? Response.json({ ok: true }, { headers: { "cache-control": "no-store" } })
      : Response.json({ error: { code: "bad_request", message: "Malformed nonce." } }, { status: 400 });
  }
  return Response.json(takeGoogle(nonce), { headers: { "cache-control": "no-store" } });
}

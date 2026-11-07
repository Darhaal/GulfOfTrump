import { planUsage } from "@/server/chatgpt/usage";
import { rejectNonLocal } from "@/server/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The ChatGPT plan's latest usage numbers, as the last answer reported them
 * (server/chatgpt/usage.ts): the share of each window used, when it resets,
 * and a usage limit while it stands. Numbers only; it spends nothing.
 */
export async function GET(request: Request) {
  const rejected = rejectNonLocal(request);
  if (rejected) return rejected;
  return Response.json({ usage: await planUsage() }, { headers: { "cache-control": "no-store" } });
}

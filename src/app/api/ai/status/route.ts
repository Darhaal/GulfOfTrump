import { connectionStatus } from "@/server/chatgpt/oauth";
import { rejectNonLocal } from "@/server/guard";
import { isMockEnabled } from "@/server/mock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const rejected = rejectNonLocal(request);
  if (rejected) return rejected;
  if (isMockEnabled()) {
    return Response.json({ provider: "mock", status: "connected", sharing: true });
  }
  return Response.json(await connectionStatus(), { headers: { "cache-control": "no-store" } });
}

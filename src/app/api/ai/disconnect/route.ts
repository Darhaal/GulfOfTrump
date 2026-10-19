import { disconnect } from "@/server/chatgpt/oauth";
import { rejectInDemo, rejectNonLocal } from "@/server/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rejected = rejectNonLocal(request) ?? rejectInDemo();
  if (rejected) return rejected;
  return Response.json(await disconnect());
}

import { AiError } from "@/server/errors";
import { rejectNonLocal } from "@/server/guard";
import { availableModels } from "@/server/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const rejected = rejectNonLocal(request);
  if (rejected) return rejected;
  try {
    return Response.json({ models: await availableModels() });
  } catch (error) {
    const e = error instanceof AiError ? error : new AiError("internal_error", "Could not load the model list.", true);
    return Response.json({ error: { code: e.code, message: e.message } }, { status: e.code === "not_connected" ? 401 : 502 });
  }
}

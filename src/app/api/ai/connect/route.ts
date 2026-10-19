import { startSignIn } from "@/server/chatgpt/oauth";
import { AiError } from "@/server/errors";
import { rejectInDemo, rejectNonLocal } from "@/server/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rejected = rejectNonLocal(request) ?? rejectInDemo();
  if (rejected) return rejected;
  // The way back is always this server's own settings page — never a URL
  // from the request body, which would make the sign-in an open redirect.
  const returnTo = new URL("/settings", `http://${request.headers.get("host")}`).toString();
  try {
    return Response.json(await startSignIn(returnTo));
  } catch (error) {
    const e = error instanceof AiError ? error : new AiError("sign_in_failed", "Could not start the sign-in.", true);
    return Response.json({ error: { code: e.code, message: e.message } }, { status: 502 });
  }
}

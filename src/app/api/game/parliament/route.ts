import { SessionTalkSchema } from "@/engine/parliament";
import { buildSessionPrompt, SESSION_INSTRUCTIONS } from "@/engine/prompts";
import { wantsDemo } from "@/server/demo";
import { rejectNonLocal } from "@/server/guard";
import { completeJson } from "@/server/llm";
import { badRequest, MAX_MESSAGE_CHARS, readGameRequest } from "@/server/requests";
import { ndjsonResponse } from "@/server/stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * A sitting of parliament the player holds: at the opening, and after each
 * of the government's speeches, members of the parties answer in character
 * and the model says how the speech moved them. The engine applies the
 * sway within its limits and counts the vote itself (engine/parliament.ts).
 */
export async function POST(request: Request) {
  const rejected = rejectNonLocal(request);
  if (rejected) return rejected;
  const demo = wantsDemo(request);
  const parsed = await readGameRequest(request);
  if (parsed instanceof Response) return parsed;
  const { state, locale, model, body } = parsed;
  const session = state.politics?.sessions?.find((s) => s.id === body.session && s.status === "open");
  if (!session || !state.politics?.parliament) return badRequest("No such sitting under way.");
  const line = typeof body.line === "string" ? body.line.trim() : "";
  const opening = body.open === true;
  if (!opening && (!line || line.length > MAX_MESSAGE_CHARS)) return badRequest("The speech is empty or too long.");

  return ndjsonResponse(request, async ({ signal, progress }) => {
    let chars = 0;
    const onDelta = (delta: string) => progress((chars += delta.length));
    const answer = await completeJson(
      { model, demo, locale, instructions: SESSION_INSTRUCTIONS(locale), input: [{ role: "user", content: buildSessionPrompt(state, session, opening ? undefined : line) }], signal, onDelta },
      SessionTalkSchema,
    );
    return { speeches: answer.speeches, sway: opening ? [] : answer.sway };
  });
}

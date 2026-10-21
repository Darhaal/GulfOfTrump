import { SummitCloseSchema, SummitTalkSchema } from "@/engine/foreign";
import { buildSummitPrompt, SUMMIT_CLOSE_INSTRUCTIONS, SUMMIT_TALK_INSTRUCTIONS } from "@/engine/prompts";
import { wantsDemo } from "@/server/demo";
import { rejectNonLocal } from "@/server/guard";
import { completeJson } from "@/server/llm";
import { badRequest, MAX_MESSAGE_CHARS, readGameRequest } from "@/server/requests";
import { ndjsonResponse } from "@/server/stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * A meeting the player holds in person: after each of the player's
 * statements the other participants answer in character; at the end the
 * game master sums up what was agreed.
 */
export async function POST(request: Request) {
  const rejected = rejectNonLocal(request);
  if (rejected) return rejected;
  const demo = wantsDemo(request);
  const parsed = await readGameRequest(request);
  if (parsed instanceof Response) return parsed;
  const { state, locale, model, body } = parsed;
  const summit = (state.summits ?? []).find((s) => s.id === body.summit);
  if (!summit || summit.status !== "planned" || !summit.participants.includes(state.player)) return badRequest("No such meeting to attend.");
  const finish = body.finish === true;
  const line = typeof body.line === "string" ? body.line.trim() : "";
  if (!finish && (!line || line.length > MAX_MESSAGE_CHARS)) return badRequest("The statement is empty or too long.");

  return ndjsonResponse(request, async ({ signal, progress }) => {
    let chars = 0;
    const onDelta = (delta: string) => progress((chars += delta.length));
    if (finish) {
      const result = await completeJson(
        { model, demo, locale, instructions: SUMMIT_CLOSE_INSTRUCTIONS(locale), input: [{ role: "user", content: buildSummitPrompt(state, summit) }], signal, onDelta },
        SummitCloseSchema,
      );
      return { outcome: result.outcome, agreements: result.agreements };
    }
    const reply = await completeJson(
      { model, demo, locale, instructions: SUMMIT_TALK_INSTRUCTIONS(locale), input: [{ role: "user", content: buildSummitPrompt(state, summit, line) }], signal, onDelta },
      SummitTalkSchema,
    );
    return { lines: reply.lines.filter((l) => l.country !== state.player && state.countries[l.country]) };
  });
}

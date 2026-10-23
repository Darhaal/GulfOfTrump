import { buildTalkPrompt, TALK_END_INSTRUCTIONS, TALK_INSTRUCTIONS } from "@/engine/prompts";
import { canEndTalks, TalkEndSchema, TalkReplySchema } from "@/engine/talks";
import { wantsDemo } from "@/server/demo";
import { rejectNonLocal } from "@/server/guard";
import { completeJson } from "@/server/llm";
import { badRequest, MAX_MESSAGE_CHARS, readGameRequest } from "@/server/requests";
import { ndjsonResponse } from "@/server/stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Talks the player holds in person with the leaders of a protest or with
 * plotters: after each of the government's words their side answers in
 * character; at the end the model says what came of the talks, and the
 * engine decides and applies it (engine/talks.ts).
 */
export async function POST(request: Request) {
  const rejected = rejectNonLocal(request);
  if (rejected) return rejected;
  const demo = wantsDemo(request);
  const parsed = await readGameRequest(request);
  if (parsed instanceof Response) return parsed;
  const { state, locale, model, body } = parsed;
  const talk = state.politics?.talks?.find((t) => t.id === body.talk && t.status === "open");
  if (!talk) return badRequest("No such talks under way.");
  const finish = body.finish === true;
  const line = typeof body.line === "string" ? body.line.trim() : "";
  if (!finish && (!line || line.length > MAX_MESSAGE_CHARS)) return badRequest("The words are empty or too long.");
  // The model never settles talks the player has not spoken in.
  if (finish && !canEndTalks(talk)) return badRequest("Say something before ending the talks.");

  return ndjsonResponse(request, async ({ signal, progress }) => {
    let chars = 0;
    const onDelta = (delta: string) => progress((chars += delta.length));
    if (finish) {
      const end = await completeJson({ model, demo, locale, instructions: TALK_END_INSTRUCTIONS(locale), input: [{ role: "user", content: buildTalkPrompt(state, talk) }], signal, onDelta }, TalkEndSchema);
      return { result: end.result, note: end.note };
    }
    const reply = await completeJson({ model, demo, locale, instructions: TALK_INSTRUCTIONS(locale), input: [{ role: "user", content: buildTalkPrompt(state, talk, line) }], signal, onDelta }, TalkReplySchema);
    return { speaker: reply.speaker, said: reply.said };
  });
}

import { buildSpeechPrompt, cleanSpeech, SPEECH_INSTRUCTIONS, SpeechSchema, speechKey } from "@/engine/speech";
import { scenarioOf } from "@/engine/scenarios";
import { wantsDemo } from "@/server/demo";
import { rejectNonLocal } from "@/server/guard";
import { completeJson } from "@/server/llm";
import { badRequest, readGameRequest } from "@/server/requests";
import { ndjsonResponse } from "@/server/stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * How one person speaks (engine/speech.ts): register, turns of phrase, how
 * they argue, what they avoid, their habits – from the record for a figure
 * of history, from the traits and manner of an invented one, in the player's
 * language. The client asks once per person and language, only for people
 * about to speak, and keeps the cleaned answer in the save.
 */
export async function POST(request: Request) {
  const rejected = rejectNonLocal(request);
  if (rejected) return rejected;
  const demo = wantsDemo(request);
  const parsed = await readGameRequest(request);
  if (parsed instanceof Response) return parsed;
  const { state, locale, model, body } = parsed;

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 120) return badRequest("The name is empty or too long.");
  const startDate = scenarioOf(state).startDate;

  return ndjsonResponse(request, async ({ signal, progress }) => {
    let chars = 0;
    const reply = await completeJson(
      {
        model,
        demo,
        locale,
        instructions: SPEECH_INSTRUCTIONS(locale, state.date),
        input: [{ role: "user", content: buildSpeechPrompt(state, name, startDate) }],
        signal,
        onDelta: (delta) => progress((chars += delta.length)),
      },
      SpeechSchema,
    );
    return { key: speechKey(state, name), profile: cleanSpeech(reply) };
  });
}

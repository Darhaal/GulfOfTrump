import { ActReplySchema, keepActs, LEGAL_HISTORY } from "@/engine/acts";
import { buildLegalPrompt, LEGAL_INSTRUCTIONS } from "@/engine/prompts";
import { getScenario } from "@/engine/scenarios";
import { en } from "@/engine/text";
import { rejectNonLocal } from "@/server/guard";
import { completeJson } from "@/server/llm";
import { loadMapIndex } from "@/server/maps";
import { badRequest, MAX_MESSAGE_CHARS, readGameRequest } from "@/server/requests";
import { ndjsonResponse } from "@/server/stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** The cities a request may name: the country's own, as the client lists them. */
const MAX_CITIES = 120;

/** A word with the chief of staff about acts of state, who drafts them in character. */
export async function POST(request: Request) {
  const rejected = rejectNonLocal(request);
  if (rejected) return rejected;
  const parsed = await readGameRequest(request);
  if (parsed instanceof Response) return parsed;
  const { state, locale, model, body } = parsed;

  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question || question.length > MAX_MESSAGE_CHARS) return badRequest("The question is empty or too long.");
  const cities = (Array.isArray(body.cities) ? body.cities : [])
    .filter((c): c is { key: string; name: string } => typeof c?.key === "string" && typeof c?.name === "string")
    .slice(0, MAX_CITIES)
    .map((c) => ({ key: c.key.slice(0, 80), name: c.name.slice(0, 80) }));

  const government = en(state.countries[state.player].name);
  const transcript = (state.legal ?? [])
    .slice(-LEGAL_HISTORY)
    .map((m) => `[${m.date}] ${m.from === "player" ? "The leader" : "You"}: ${m.text}`)
    .join("\n");

  const index = await loadMapIndex(getScenario(state.scenarioId).map);
  return ndjsonResponse(request, async ({ signal, progress }) => {
    let chars = 0;
    const reply = await completeJson(
      {
        model,
        instructions: LEGAL_INSTRUCTIONS(locale, state),
        input: [
          { role: "user", content: buildLegalPrompt(state, index, cities) },
          { role: "user", content: `${transcript ? `EARLIER CONVERSATION:\n${transcript}\n\n` : ""}THE LEADER OF ${government.toUpperCase()} SAYS:\n${question}` },
        ],
        signal,
        onDelta: (delta) => progress((chars += delta.length)),
      },
      ActReplySchema,
    );
    return { reply: { answer: reply.answer, acts: keepActs(reply, cities.map((c) => c.key)) } };
  });
}

import { ADVISOR_HISTORY, ADVISORS, AdviceSchema, type AdvisorId } from "@/engine/advisors";
import { ADVISOR_INSTRUCTIONS, buildAdvisorPrompt } from "@/engine/prompts";
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

/** One question to a minister of the player's cabinet, answered in character. */
export async function POST(request: Request) {
  const rejected = rejectNonLocal(request);
  if (rejected) return rejected;
  const parsed = await readGameRequest(request);
  if (parsed instanceof Response) return parsed;
  const { state, locale, model, body } = parsed;

  const advisor = body.advisor as AdvisorId;
  if (!ADVISORS.includes(advisor)) return badRequest("Unknown advisor.");
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question || question.length > MAX_MESSAGE_CHARS) return badRequest("The question is empty or too long.");
  // What the government is in the middle of — candidates for a post, a summit under way — when it asks.
  const context = typeof body.context === "string" ? body.context.trim().slice(0, 6000) : "";

  const government = en(state.countries[state.player].name);
  const transcript = (state.advice?.[advisor] ?? [])
    .slice(-ADVISOR_HISTORY)
    .map((m) => `[${m.date}] ${m.from === "player" ? "The government" : "You"}: ${m.text}`)
    .join("\n");

  const index = await loadMapIndex(getScenario(state.scenarioId).map);
  return ndjsonResponse(request, async ({ signal, progress }) => {
    let chars = 0;
    const reply = await completeJson(
      {
        model,
        instructions: ADVISOR_INSTRUCTIONS(advisor, locale, state),
        input: [
          { role: "user", content: buildAdvisorPrompt(state, index, advisor) },
          {
            role: "user",
            content: `${transcript ? `EARLIER CONVERSATION:\n${transcript}\n\n` : ""}${context ? `WHAT THE GOVERNMENT IS DOING RIGHT NOW:\n${context}\n\n` : ""}THE GOVERNMENT OF ${government.toUpperCase()} ASKS:\n${question}`,
          },
        ],
        signal,
        onDelta: (delta) => progress((chars += delta.length)),
      },
      AdviceSchema,
    );
    return { reply };
  });
}

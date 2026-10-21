import { ADVISOR_HISTORY, ADVISORS, AdviceSchema, type AdvisorId } from "@/engine/advisors";
import { deputyById, ministryOfDeputy } from "@/engine/deputies";
import { deputyContext, DEPUTY_INSTRUCTIONS } from "@/engine/deputyPrompts";
import { ADVISOR_INSTRUCTIONS, buildAdvisorPrompt } from "@/engine/prompts";
import { getScenario } from "@/engine/scenarios";
import { en } from "@/engine/text";
import { wantsDemo } from "@/server/demo";
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
  const demo = wantsDemo(request);
  const parsed = await readGameRequest(request);
  if (parsed instanceof Response) return parsed;
  const { state, locale, model, body } = parsed;

  const advisor = body.advisor as AdvisorId;
  if (!ADVISORS.includes(advisor)) return badRequest("Unknown advisor.");
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question || question.length > MAX_MESSAGE_CHARS) return badRequest("The question is empty or too long.");
  // What the government is in the middle of — candidates for a post, a summit under way — when it asks.
  const context = typeof body.context === "string" ? body.context.trim().slice(0, 6000) : "";

  // A deputy of this ministry, spoken to in private (engine/deputies.ts), instead of the minister.
  const deputy = typeof body.deputy === "string" ? deputyById(state, body.deputy) : undefined;
  if (typeof body.deputy === "string" && (!deputy || ministryOfDeputy(deputy) !== advisor)) return badRequest("Unknown deputy.");

  const government = en(state.countries[state.player].name);
  const transcript = (deputy ? (state.deputyAdvice?.[deputy.id] ?? []) : (state.advice?.[advisor] ?? []))
    .slice(-ADVISOR_HISTORY)
    .map((m) => `[${m.date}] ${m.from === "player" ? "The government" : "You"}: ${m.text}`)
    .join("\n");

  const index = await loadMapIndex(getScenario(state.scenarioId).map);
  return ndjsonResponse(request, async ({ signal, progress }) => {
    let chars = 0;
    const reply = await completeJson(
      {
        model,
        demo,
        locale,
        instructions: deputy ? DEPUTY_INSTRUCTIONS(advisor, locale, state, deputy) : ADVISOR_INSTRUCTIONS(advisor, locale, state),
        input: [
          { role: "user", content: deputy ? `${buildAdvisorPrompt(state, index, advisor, false)}${deputyContext(state, deputy)}` : buildAdvisorPrompt(state, index, advisor) },
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

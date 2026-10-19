import { DIPLOMACY_HISTORY, DiplomacySchema } from "@/engine/diplomacy";
import { buildDiplomacyPrompt, DIPLOMACY_INSTRUCTIONS } from "@/engine/prompts";
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

/** One diplomatic message to another government, answered in character. */
export async function POST(request: Request) {
  const rejected = rejectNonLocal(request);
  if (rejected) return rejected;
  const parsed = await readGameRequest(request);
  if (parsed instanceof Response) return parsed;
  const { state, locale, model, body } = parsed;

  const target = typeof body.target === "string" ? body.target : "";
  if (!state.countries[target] || target === state.player) return badRequest("Unknown recipient.");
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message || message.length > MAX_MESSAGE_CHARS) return badRequest("The message is empty or too long.");

  const playerName = en(state.countries[state.player].name);
  const transcript = (state.diplomacy[target] ?? [])
    .slice(-DIPLOMACY_HISTORY)
    .map((m) => `[${m.date}] ${m.from === "player" ? playerName : "You"}: ${m.text}`)
    .join("\n");

  const index = await loadMapIndex(getScenario(state.scenarioId).map);
  return ndjsonResponse(request, async ({ signal, progress }) => {
    let chars = 0;
    const reply = await completeJson(
      {
        model,
        instructions: DIPLOMACY_INSTRUCTIONS(locale),
        input: [
          { role: "user", content: buildDiplomacyPrompt(state, target, index) },
          {
            role: "user",
            content: `${transcript ? `EARLIER CORRESPONDENCE:\n${transcript}\n\n` : ""}NEW MESSAGE FROM ${playerName.toUpperCase()}:\n${message}`,
          },
        ],
        signal,
        onDelta: (delta) => progress((chars += delta.length)),
      },
      DiplomacySchema,
    );
    return { reply };
  });
}

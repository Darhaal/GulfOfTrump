import { OutcomeSchema, sanitizeOutcome } from "@/engine/outcome";
import { buildTurnPrompt, TURN_INSTRUCTIONS } from "@/engine/prompts";
import { getScenario } from "@/engine/scenarios";
import { wantsDemo } from "@/server/demo";
import { rejectNonLocal } from "@/server/guard";
import { completeJson } from "@/server/llm";
import { loadMapIndex } from "@/server/maps";
import { badRequest, readGameRequest, readOrders } from "@/server/requests";
import { ndjsonResponse } from "@/server/stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

/**
 * Resolves one turn. The server is stateless: the client sends the state and
 * its orders, gets back an outcome already checked against that state, and
 * applies it with the same engine function the tests use.
 */
export async function POST(request: Request) {
  const rejected = rejectNonLocal(request);
  if (rejected) return rejected;
  const demo = wantsDemo(request);
  const parsed = await readGameRequest(request);
  if (parsed instanceof Response) return parsed;
  const { state, locale, model, body } = parsed;
  const orders = readOrders(body.orders);
  if (!orders) return badRequest("Orders must be a list of up to 12 short strings.");

  const index = await loadMapIndex(getScenario(state.scenarioId).map);
  return ndjsonResponse(request, async ({ signal, progress }) => {
    let chars = 0;
    const raw = await completeJson(
      {
        model,
        demo,
        locale,
        instructions: TURN_INSTRUCTIONS(locale, state.mode),
        input: [{ role: "user", content: buildTurnPrompt(state, orders, index) }],
        signal,
        onDelta: (delta) => progress((chars += delta.length)),
      },
      OutcomeSchema,
    );
    return { outcome: sanitizeOutcome(state, raw, { orders, index }) };
  });
}

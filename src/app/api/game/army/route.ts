import { ArmyOrganisationSchema, sanitizeArmyOrganisation } from "@/engine/army";
import { ARMY_INSTRUCTIONS, buildArmyPrompt } from "@/engine/armyPrompts";
import { scenarioOf } from "@/engine/scenarios";
import { wantsDemo } from "@/server/demo";
import { rejectNonLocal } from "@/server/guard";
import { completeJson } from "@/server/llm";
import { loadMapIndex } from "@/server/maps";
import { readGameRequest } from "@/server/requests";
import { ndjsonResponse } from "@/server/stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * The player's army as the game master describes it now: its armies,
 * fleets and air forces, their divisions and where they stand, checked by
 * the engine against the soldiers and the land the player holds.
 */
export async function POST(request: Request) {
  const rejected = rejectNonLocal(request);
  if (rejected) return rejected;
  const demo = wantsDemo(request);
  const parsed = await readGameRequest(request);
  if (parsed instanceof Response) return parsed;
  const { state, locale, model } = parsed;
  const index = await loadMapIndex(scenarioOf(state).map);

  return ndjsonResponse(request, async ({ signal, progress }) => {
    let chars = 0;
    const raw = await completeJson(
      {
        model,
        demo,
        locale,
        instructions: ARMY_INSTRUCTIONS(locale),
        input: [{ role: "user", content: buildArmyPrompt(state, index) }],
        signal,
        onDelta: (delta) => progress((chars += delta.length)),
      },
      ArmyOrganisationSchema,
    );
    return { organisation: sanitizeArmyOrganisation(state, raw) };
  });
}

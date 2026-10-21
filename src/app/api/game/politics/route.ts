import type { z } from "zod";
import { OfficialsSetupSchema, startOfficials } from "@/engine/government";
import { PoliticsSetupSchema, startPolitics } from "@/engine/politics";
import { buildPoliticsPrompt, SETUP_INSTRUCTIONS, type SetupPart } from "@/engine/prompts";
import { wantsDemo } from "@/server/demo";
import { rejectNonLocal } from "@/server/guard";
import { completeJson } from "@/server/llm";
import { readGameRequest } from "@/server/requests";
import { ndjsonResponse } from "@/server/stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * The player's domestic politics and the people of the government,
 * described once by the game master for the country and date — both in one
 * request, or whichever the save still lacks.
 */
export async function POST(request: Request) {
  const rejected = rejectNonLocal(request);
  if (rejected) return rejected;
  const demo = wantsDemo(request);
  const parsed = await readGameRequest(request);
  if (parsed instanceof Response) return parsed;
  const { state, locale, model, body } = parsed;
  const asked = Array.isArray(body.parts) ? body.parts.filter((p): p is SetupPart => p === "politics" || p === "officials") : [];
  const parts: SetupPart[] = asked.length ? [...new Set(asked)] : ["politics"];
  const withPolitics = parts.includes("politics");
  const withOfficials = parts.includes("officials");
  const schema = (withPolitics ? (withOfficials ? PoliticsSetupSchema.extend({ officials: OfficialsSetupSchema.shape.officials }) : PoliticsSetupSchema) : OfficialsSetupSchema) as unknown as z.ZodType<Record<string, unknown>>;

  return ndjsonResponse(request, async ({ signal, progress }) => {
    let chars = 0;
    const raw = await completeJson(
      {
        model,
        demo,
        locale,
        instructions: SETUP_INSTRUCTIONS(locale, parts),
        input: [{ role: "user", content: buildPoliticsPrompt(state) }],
        signal,
        onDelta: (delta) => progress((chars += delta.length)),
      },
      schema,
    );
    return {
      ...(withPolitics ? { politics: startPolitics(raw as never, state.date) } : {}),
      ...(withOfficials ? { officials: startOfficials(raw as never, state.date) } : {}),
    };
  });
}

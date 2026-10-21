import { ADVISORS, type AdvisorId } from "@/engine/advisors";
import { buildReportBrief, buildReportDigest, REPORT_INSTRUCTIONS } from "@/engine/prompts";
import { MinisterReportSchema, sanitizeMinisterReport } from "@/engine/reports";
import { getScenario } from "@/engine/scenarios";
import { wantsDemo } from "@/server/demo";
import { rejectNonLocal } from "@/server/guard";
import { completeJson } from "@/server/llm";
import { loadMapIndex } from "@/server/maps";
import { badRequest, readGameRequest } from "@/server/requests";
import { ndjsonResponse } from "@/server/stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * One minister's view of a turn already played (engine/reports.ts). The
 * client asks for each view once the turn is applied, in the background (a
 * quiet minister's only when the player asks), and applies the checked view
 * with the engine.
 */
export async function POST(request: Request) {
  const rejected = rejectNonLocal(request);
  if (rejected) return rejected;
  const demo = wantsDemo(request);
  const parsed = await readGameRequest(request);
  if (parsed instanceof Response) return parsed;
  const { state, locale, model, body } = parsed;

  const ministry = body.ministry as AdvisorId;
  if (!ADVISORS.includes(ministry)) return badRequest("Unknown ministry.");
  const turn = typeof body.turn === "number" ? body.turn : NaN;
  const entry = state.chronicle.find((e) => e.turn === turn);
  if (!entry?.briefs?.some((b) => b.ministry === ministry)) return badRequest("That ministry has nothing to report on that turn.");

  const index = await loadMapIndex(getScenario(state.scenarioId).map);
  return ndjsonResponse(request, async ({ signal, progress }) => {
    let chars = 0;
    const reply = await completeJson(
      {
        model,
        demo,
        locale,
        instructions: REPORT_INSTRUCTIONS(locale),
        input: [
          { role: "user", content: buildReportDigest(state, index, entry) },
          { role: "user", content: buildReportBrief(state, entry, ministry) },
        ],
        signal,
        onDelta: (delta) => progress((chars += delta.length)),
      },
      MinisterReportSchema,
    );
    return { report: sanitizeMinisterReport(state, turn, ministry, reply) };
  });
}

import { asksForActs } from "@/engine/acts";
import { HomeSchema, mergeStages, sanitizeHome, sanitizeStory, sanitizeWorld, StorySchema, WorldSchema, type HomePart, type StoryPart, type WorldPart } from "@/engine/outcome";
import { getScenario } from "@/engine/scenarios";
import { stageRequest } from "@/engine/stagePrompts";
import { storyCarry, StoryCarrySchema, TURN_STAGES, type StoryCarry, type TurnStage } from "@/engine/stages";
import { playerCities } from "@/server/cities";
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
 * Resolves one turn, in stages (engine/stages.ts). The server is stateless:
 * the client sends the state, its orders and the stage it wants — "story"
 * first, then "world" and "home" side by side with the story that came
 * back — and gets each stage's part already checked against that state; it
 * applies the three together with the same engine function the tests use.
 * Without a stage the server writes all three and returns the whole outcome.
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
  if (body.stage !== undefined && !TURN_STAGES.includes(body.stage as TurnStage)) return badRequest("Unknown stage.");
  const stage = body.stage as TurnStage | undefined;
  const story = body.story === undefined ? undefined : StoryCarrySchema.safeParse(body.story);
  if (story && !story.success) return badRequest("The story is malformed.");
  if ((stage === "world" || stage === "home") && !story) return badRequest("The world and home stages need the story.");

  const index = await loadMapIndex(getScenario(state.scenarioId).map);
  // An order may rename one of the player's cities by any of its names.
  const cities = asksForActs(orders) ? await playerCities(state, index) : [];
  const options = { orders, index, cities };
  return ndjsonResponse(request, async ({ signal, progress }) => {
    let chars = 0;
    const ask = <T>(s: TurnStage, schema: Parameters<typeof completeJson<T>>[1], carry?: StoryCarry) => {
      const { instructions, prompt } = stageRequest(s, state, orders, index, locale, carry);
      return completeJson({ model, demo, locale, instructions, input: [{ role: "user", content: prompt }], signal, onDelta: (delta) => progress((chars += delta.length)) }, schema);
    };
    const tellStory = async (): Promise<StoryPart> => sanitizeStory(state, await ask("story", StorySchema), options);
    const settleWorld = async (carry: StoryCarry): Promise<WorldPart> => sanitizeWorld(state, await ask("world", WorldSchema, carry), options);
    const settleHome = async (carry: StoryCarry): Promise<HomePart> => sanitizeHome(state, await ask("home", HomeSchema, carry), options);

    if (stage === "story") return { stage, part: await tellStory() };
    if (stage === "world") return { stage, part: await settleWorld(story!.data!) };
    if (stage === "home") return { stage, part: await settleHome(story!.data!) };
    // The whole turn here: the story, then the world and home side by side.
    const told = await tellStory();
    const carry = storyCarry(told);
    const [world, home] = await Promise.all([settleWorld(carry), settleHome(carry)]);
    return { outcome: mergeStages(told, world, home) };
  });
}

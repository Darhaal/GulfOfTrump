import "server-only";
import { parseGameState } from "@/engine/schema";
import { LOCALES, type GameState, type Locale } from "@/engine/types";

export const MAX_ORDERS = 12;
export const MAX_ORDER_CHARS = 1000;
export const MAX_MESSAGE_CHARS = 2000;

export interface GameRequest {
  state: GameState;
  locale: Locale;
  model?: string;
  body: Record<string, unknown>;
}

/** The common part of every game request body, or an error response. */
export async function readGameRequest(request: Request): Promise<GameRequest | Response> {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return badRequest("Expected a JSON object.");
  const state = parseGameState(body.state);
  if (!state) return badRequest("The game state is missing or malformed.");
  if (state.schema !== 2) return badRequest("This save predates provinces. Open it in the game once to upgrade it.");
  const locale = LOCALES.includes(body.locale as Locale) ? (body.locale as Locale) : "en";
  const model = typeof body.model === "string" && body.model.trim() ? body.model.trim().slice(0, 200) : undefined;
  return { state, locale, model, body };
}

export function readOrders(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > MAX_ORDERS) return null;
  const orders = value.filter((o): o is string => typeof o === "string").map((o) => o.trim()).filter(Boolean);
  if (orders.length !== value.length || orders.some((o) => o.length > MAX_ORDER_CHARS)) return null;
  return orders;
}

export function badRequest(message: string): Response {
  return Response.json({ error: { code: "bad_request", message } }, { status: 400 });
}

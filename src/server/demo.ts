import "server-only";
import { DEMO_HEADER } from "@/constants/app";

/**
 * The player chose the offline demo in this app (Settings → Game master, or
 * the choice offered when a turn has no game master): the request is
 * answered by the stand-in (server/mock.ts), never by ChatGPT. Every route
 * that calls the model reads it right after rejectNonLocal. It spends
 * nothing, so it needs no more trust than the route already demands.
 */
export const wantsDemo = (request: Request): boolean => request.headers.get(DEMO_HEADER) === "1";

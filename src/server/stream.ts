import "server-only";
import { AiError } from "./errors";

export type StreamEvent =
  | { type: "progress"; chars: number }
  | { type: "done"; [key: string]: unknown }
  | { type: "error"; code: string; message: string; retryable: boolean };

/**
 * A newline-delimited JSON response: progress events while the model writes,
 * then one `done` or `error`. The client shows the progress so a minute-long
 * turn does not look frozen. Aborting the request aborts the model call.
 */
export function ndjsonResponse(
  request: Request,
  run: (helpers: { signal: AbortSignal; progress: (chars: number) => void }) => Promise<Record<string, unknown>>,
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StreamEvent) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // The client went away; nothing to tell.
        }
      };
      let last = 0;
      const progress = (chars: number) => {
        // At most a few updates a second.
        if (chars - last < 200) return;
        last = chars;
        send({ type: "progress", chars });
      };
      try {
        const result = await run({ signal: request.signal, progress });
        send({ type: "done", ...result });
      } catch (error) {
        const e = error instanceof AiError ? error : new AiError("internal_error", "Something went wrong on the game server.", true);
        if (!(error instanceof AiError)) console.error(error);
        send({ type: "error", code: e.code, message: e.message, retryable: e.retryable });
      } finally {
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });
  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
}

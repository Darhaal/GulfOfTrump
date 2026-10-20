import "server-only";
import { isDemo } from "@/constants/app";

const LOOPBACK = new Set(["127.0.0.1", "localhost", "[::1]"]);

/**
 * The AI routes spend the ChatGPT plan of whoever runs this server, so they
 * answer only the browser on the same machine:
 *
 * - the Host must be a loopback name, which also defeats DNS rebinding (a
 *   rebound page arrives with its own host name);
 * - a cross-site request is refused — Origin, when the browser sends one,
 *   must be this very origin, and Sec-Fetch-Site must not say cross-site;
 * - bodies are JSON, which a plain HTML form cannot send without a CORS
 *   preflight that this server never approves.
 *
 * Returns a response to send back, or null when the request may proceed.
 */
export function rejectNonLocal(request: Request): Response | null {
  const host = request.headers.get("host") ?? "";
  const hostname = host.replace(/:\d+$/, "");
  // The public demo runs the offline game master only, so any host may use it.
  if (!LOOPBACK.has(hostname) && !isDemo()) return forbidden("This server only answers requests from the same computer.");

  const origin = request.headers.get("origin");
  if (origin && origin !== `http://${host}` && origin !== `https://${host}`) return forbidden("Cross-site request refused.");

  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return forbidden("Cross-site request refused.");

  if (request.method !== "GET" && !request.headers.get("content-type")?.includes("application/json")) {
    return forbidden("Expected a JSON body.");
  }
  return null;
}

/**
 * For a page the browser reaches by a sign-in provider's redirect. Such a
 * request is a cross-site navigation by design, so only the Host is checked
 * (a loopback name, which still defeats DNS rebinding). A route behind this
 * check may only accept what the provider hands back for a sign-in this
 * computer started: it spends nothing and reveals nothing.
 */
export function rejectNonLoopback(request: Request): Response | null {
  const hostname = (request.headers.get("host") ?? "").replace(/:\d+$/, "");
  return LOOPBACK.has(hostname) ? null : forbidden("This server only answers requests from the same computer.");
}

/** Signing in with ChatGPT is off in the public demo. */
export function rejectInDemo(): Response | null {
  return isDemo() ? Response.json({ error: { code: "demo", message: "Signing in is not available in the demo." } }, { status: 403 }) : null;
}

function forbidden(message: string): Response {
  return Response.json({ error: { code: "forbidden", message } }, { status: 403 });
}

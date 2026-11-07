import { NextResponse, type NextRequest } from "next/server";
import { localeRoute } from "@/lib/localePath";

/** Marks a request this proxy has already rewritten, should it come round again. */
const REWRITTEN = "x-got-locale-rewrite";

/**
 * The language of a page's address (lib/localePath.ts): every page lives in
 * app/[lang]; a bare address is served from its English page, /en/… is sent
 * back to the bare address so English has one, and /ru or /uk in front of a
 * game, the settings or sign-in is dropped. The API, Next.js's own files and
 * anything with a file extension (public/, robots.txt, sitemap.xml) pass by.
 */
export function proxy(request: NextRequest) {
  if (request.headers.get(REWRITTEN)) return NextResponse.next();
  const route = localeRoute(request.nextUrl.pathname);
  if (!route) return NextResponse.next();
  const url = request.nextUrl.clone();
  // The address the browser used: a server on 127.0.0.1 (the desktop app, `npm start`) sees "localhost" in
  // request.url, and a rewrite to another host would be fetched as a new request instead of served.
  const host = request.headers.get("host");
  if (host) {
    try {
      const seen = new URL(`${url.protocol}//${host}`);
      url.hostname = seen.hostname;
      url.port = seen.port;
    } catch {
      // A malformed Host header: keep Next.js's own address.
    }
  }
  if ("redirect" in route) {
    url.pathname = route.redirect;
    return NextResponse.redirect(url, 308);
  }
  url.pathname = route.rewrite;  const headers = new Headers(request.headers);
  headers.set(REWRITTEN, "1");
  return NextResponse.rewrite(url, { request: { headers } });
}

export const config = {
  // The ChatGPT sign-in's return (/auth/app/…) is a route handler outside app/[lang].
  matcher: ["/((?!api/|_next/|__next|auth/app/|.*\\.[\\w]+$).*)"],
};

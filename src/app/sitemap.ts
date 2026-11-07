import type { MetadataRoute } from "next";
import { getScenario, newGamePath, SCENARIO_ORDER, startsOf } from "@/engine/scenarios";
import type { Locale } from "@/engine/types";
import { localePath } from "@/lib/localePath";
import { absoluteUrl, languageAlternates, ogImage } from "@/lib/seo";

/**
 * The demo site's pages for search engines, each in English, Russian and
 * Ukrainian with the other two as its alternates: the front page, the twelve
 * dates with each of their starts, about and privacy. Games themselves live
 * in the player's browser, and so does the tutorial, which starts a game at
 * once. The site is built only for a release, so the build's day is the day
 * its pages last changed.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const dates = SCENARIO_ORDER.flatMap((id) =>
    startsOf(id)
      .filter((start) => !start || !getScenario(id, start).player)
      .map((start) => ({ path: newGamePath(id, start), image: ogImage(id) })),
  );
  const pages: { path: string; image?: string }[] = [{ path: "/", image: ogImage("home") }, ...dates, { path: "/about" }, { path: "/privacy" }];
  return pages.flatMap(({ path, image }) =>
    (["en", "ru", "uk"] as Locale[]).map((locale) => ({
      url: absoluteUrl(localePath(locale, path)),
      lastModified,
      changeFrequency: path === "/" ? ("weekly" as const) : ("monthly" as const),
      priority: path === "/" ? 1 : path.startsWith("/new/") ? 0.8 : 0.5,
      alternates: { languages: languageAlternates(path) },
      ...(image ? { images: [absoluteUrl(image)] } : {}),
    })),
  );
}

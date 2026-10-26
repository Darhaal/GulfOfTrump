import type { MetadataRoute } from "next";
import { SITE_URL } from "@/constants/app";
import { getScenario, newGamePath, SCENARIO_ORDER, startsOf } from "@/engine/scenarios";

/**
 * The demo site's pages for search engines: the front page, the eight dates
 * with each of their starts, about and privacy. Games themselves live in the
 * player's browser, and so does the tutorial, which starts a game at once.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", ...SCENARIO_ORDER.flatMap((id) => startsOf(id).filter((start) => !start || !getScenario(id, start).player).map((start) => newGamePath(id, start))), "/about", "/privacy"];
  return pages.map((page) => ({
    url: `${SITE_URL}${page}`,
    changeFrequency: page === "" ? "weekly" : "monthly",
    priority: page === "" ? 1 : page.startsWith("/new/") ? 0.8 : 0.5,
  }));
}

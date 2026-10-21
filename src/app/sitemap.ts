import type { MetadataRoute } from "next";
import { SITE_URL } from "@/constants/app";
import { SCENARIO_ORDER } from "@/engine/scenarios";

/** The demo site's pages for search engines: the front page, the eight dates, about and privacy. Games themselves live in the player's browser. */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", ...SCENARIO_ORDER.map((id) => `/new/${id}`), "/about", "/privacy"];
  return pages.map((page) => ({
    url: `${SITE_URL}${page}`,
    changeFrequency: page === "" ? "weekly" : "monthly",
    priority: page === "" ? 1 : page.startsWith("/new/") ? 0.8 : 0.5,
  }));
}

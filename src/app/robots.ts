import type { MetadataRoute } from "next";
import { isDemo, SITE_URL } from "@/constants/app";

/** The demo site welcomes search engines and points them at its sitemap; a game on someone's own computer turns them away. */
export default function robots(): MetadataRoute.Robots {
  if (!isDemo()) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/play/", "/settings", "/auth/"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}

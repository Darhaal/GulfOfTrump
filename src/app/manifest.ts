import type { MetadataRoute } from "next";
import { APP_NAME } from "@/constants/app";
import { translate } from "@/i18n/translate";

/** The web app manifest: the game's name, emblem and paper colours, for a phone's home screen and for search engines. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: translate("en", "seo.home.description"),
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#F5F0E6",
    theme_color: "#F5F0E6",
    lang: "en",
    categories: ["games", "education"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // The desktop app ships its own small server (desktop/README.md).
  ...(process.env.GOT_DESKTOP === "1" ? { output: "standalone" as const } : {}),
  // The game routes read the map files from disk; on a host such as Vercel
  // they must travel with the functions.
  outputFileTracingIncludes: {
    "/api/game/*": ["./public/maps/**/*"],
  },
  // The game runs on the player's own machine (the public demo aside), so the
  // browser is told not to leak the local URL anywhere.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;

import GameClient from "@/components/game/GameClient";
import { privateMetadata } from "@/lib/seo";

/** A game lives in its player's browser: nothing for search engines. */
export const metadata = privateMetadata;

export default async function PlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <GameClient id={id} />;
}

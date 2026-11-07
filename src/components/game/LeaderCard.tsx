"use client";

import { Camera, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";
import { setPortraitImage } from "@/engine/partyEmblems";
import { paintPhoto } from "./politics/paintPhoto";
import { officialTitle } from "@/engine/government";
import { leaderOf, leaderOfficial, personName } from "@/engine/people";
import type { GameState } from "@/engine/types";
import { useI18n } from "@/i18n/useI18n";
import { Traits } from "./AppointmentDialog";
import Portrait from "./Portrait";

/** A person's short biography (engine/bios.ts) when it has come, two quiet lines while it is being written, nothing otherwise. */
export function Bio({ text, loading }: { text?: string; loading?: boolean }) {
  if (text) return <p className="mt-1.5 text-xs font-medium leading-relaxed text-muted">{text}</p>;
  if (!loading) return null;
  return (
    <div className="mt-2 grid gap-1.5" aria-hidden>
      <span className="h-2 w-44 max-w-full animate-pulse rounded bg-line" />
      <span className="h-2 w-28 max-w-full animate-pulse rounded bg-line" />
    </div>
  );
}

/**
 * Who leads the player's country, at the top of the cabinet: the portrait
 * with the name, title and faction beside it; the biography and the traits
 * under both, the card's full width, so a long life does not stretch a
 * narrow column.
 */
export default function LeaderCard({ state, bio, bioLoading, onChange }: { state: GameState; bio?: string; bioLoading?: boolean; onChange?: (next: GameState) => void }) {
  const { t, text, locale } = useI18n();
  const [painting, setPainting] = useState(false);
  const [failed, setFailed] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const leader = leaderOf(state, state.player);
  if (!leader) return null;
  const hasOwn = Boolean(state.portraitImages?.[leader.id] ?? state.portraitImages?.[`name:${leader.name}`]);
  // Only a leader the game has no portrait of – a shadow – takes the player's own photo; a real one is never replaced.
  const mayBring = Boolean(onChange) && !leader.portrait;
  // The player's own photo of the leader, painted in oil as the portraits are (politics/paintPhoto.ts).
  const bring = async (file: File | undefined) => {
    if (!file || !onChange) return;
    setPainting(true);
    setFailed(false);
    const url = await paintPhoto(file);
    setPainting(false);
    if (url) onChange(setPortraitImage(state, leader, url));
    else setFailed(true);
  };
  const official = leaderOfficial(state);
  const name = personName(leader, locale);
  const title = official ? officialTitle(official, text) : leader.title;
  const traits = official?.traits ?? [];
  return (
    <div className="rounded-2xl bg-page p-3">
      <div className="flex items-start gap-4">
        <div className="relative shrink-0">
          <Portrait portrait={leader.portrait} gender={leader.gender} name={name} size="hero" className="ring-1 ring-accent/40 ring-offset-2 ring-offset-page" />
          {onChange && (mayBring || hasOwn) && (
            <>
              <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => void bring(e.target.files?.[0])} />
              <button
                type="button"
                disabled={painting}
                onClick={() => (hasOwn ? onChange(setPortraitImage(state, leader, null)) : mayBring && input.current?.click())}
                title={t(hasOwn ? "leader.photo.remove" : "leader.photo.upload")}
                aria-label={t(hasOwn ? "leader.photo.remove" : "leader.photo.upload")}
                className="absolute -bottom-1.5 -right-1.5 grid h-7 w-7 place-items-center rounded-full border border-line sheet text-muted shadow-sm transition-colors hover:text-ink disabled:opacity-60"
              >
                {painting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : hasOwn ? <X className="h-3.5 w-3.5" /> : <Camera className="h-3.5 w-3.5" />}
              </button>
            </>
          )}
        </div>
        <div className="min-w-0 pt-1">
          <div className="text-2xs font-black uppercase tracking-widest text-muted">{t("cabinet.leader")}</div>
          <div className="text-lg font-black leading-tight text-ink">{name}</div>
          {title && <div className="mt-0.5 text-xs font-medium leading-snug text-muted">{title}</div>}
          {official?.faction && <div className="mt-1.5 text-2xs font-bold text-muted">{official.faction}</div>}
          {painting && <div className="mt-1.5 text-2xs font-bold text-muted">{t("politics.emblem.painting")}</div>}
          {failed && <div className="mt-1.5 text-2xs font-bold text-red-600">{t("politics.emblem.failed")}</div>}
        </div>
      </div>
      {(bio || bioLoading || traits.length > 0) && (
        <div className="mt-2">
          <Bio text={bio} loading={bioLoading} />
          {traits.length > 0 && (
            <div className="mt-2">
              <Traits traits={traits} onPage />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

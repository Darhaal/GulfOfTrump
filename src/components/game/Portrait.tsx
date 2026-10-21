"use client";

import Image from "next/image";
import { createContext, useContext, useState } from "react";
import { portraitSrc } from "@/engine/people";
import type { Gender } from "@/engine/types";

/** The year of the game on screen: the shadows of people without a portrait dress for its era. */
export const PortraitYear = createContext<number | undefined>(undefined);

/** A little mirror's frame: an oval arch on top, soft corners below. */
export const ARCH = "rounded-[50%_50%_14px_14px/40%_40%_14px_14px]";

const SIZES = {
  xs: { w: 28, h: 28, cls: "h-7 w-7 rounded-full" },
  sm: { w: 40, h: 40, cls: "h-10 w-10 rounded-full" },
  avatar: { w: 44, h: 44, cls: "h-11 w-11 rounded-full" },
  md: { w: 56, h: 70, cls: `h-[70px] w-14 ${ARCH}` },
  card: { w: 64, h: 80, cls: `h-20 w-16 ${ARCH}` },
  lg: { w: 72, h: 90, cls: `h-[90px] w-[72px] ${ARCH}` },
  xl: { w: 96, h: 120, cls: `h-[120px] w-24 ${ARCH}` },
  hero: { w: 128, h: 160, cls: `h-40 w-32 ${ARCH}` },
} as const;

/**
 * A person's portrait in oil (public/portraits), loaded when it scrolls into
 * view; when they have none or the file is missing, a shadow of their sex
 * dressed for the game's era, fixed by their name.
 */
export default function Portrait({
  portrait,
  gender,
  name,
  size = "md",
  className = "",
}: {
  portrait?: string;
  gender?: Gender;
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const year = useContext(PortraitYear);
  const s = SIZES[size];
  const src = portrait && failed !== portrait ? portraitSrc({ portrait }) : portraitSrc({ gender, name, year });
  return (
    <Image
      src={src}
      alt={name}
      title={name}
      width={s.w}
      height={s.h}
      unoptimized
      loading="lazy"
      onError={() => portrait && setFailed(portrait)}
      className={`${s.cls} shrink-0 border border-line bg-night object-cover object-top ${className}`}
    />
  );
}

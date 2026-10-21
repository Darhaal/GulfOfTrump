"use client";

import Image from "next/image";
import { useState } from "react";
import { portraitSrc } from "@/engine/people";
import type { Gender } from "@/engine/types";

const SIZES = {
  xs: { w: 28, h: 28, cls: "h-7 w-7 rounded-full" },
  sm: { w: 40, h: 40, cls: "h-10 w-10 rounded-full" },
  avatar: { w: 44, h: 44, cls: "h-11 w-11 rounded-full" },
  md: { w: 56, h: 70, cls: "h-[70px] w-14 rounded-xl" },
  lg: { w: 72, h: 90, cls: "h-[90px] w-[72px] rounded-xl" },
  xl: { w: 96, h: 120, cls: "h-[120px] w-24 rounded-2xl" },
} as const;

/**
 * A person's portrait in oil (public/portraits), loaded when it scrolls into
 * view; the shadow of their sex when they have none or the file is missing.
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
  const s = SIZES[size];
  const src = portrait && failed !== portrait ? portraitSrc({ portrait, gender }) : portraitSrc({ gender });
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

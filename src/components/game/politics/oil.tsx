"use client";

import {
  Anchor, Bird, BookOpen, Castle, Church, Cog, Crown, Factory, Feather, Flag, Flower2, Gem, Globe, Hammer, HandFist, Handshake, Heart, Key, Landmark, Leaf, Lightbulb, Mountain, Scale, Shield,
  Sprout, Star, Sun, Sunrise, Swords, Tractor, TreePine, Users, Wheat, Zap,
} from "lucide-react";
import type { ComponentType } from "react";
import { Anarchy, CrescentStar, Eagle, EagleDouble, type EmblemProps, Fasces, HammerSickle, LatinCross, Olive, OrthodoxCross, Skull, StarDavid, Torch } from "./emblems";
import { ImageUp, Loader2, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { ui } from "@/components/ui/classes";
import { paintPhoto } from "./paintPhoto";
import { PARTY_COLOUR_PRESETS, type PartyEmblemKey } from "@/engine/partyEmblems";
import { ARCH } from "../Portrait";
import { channels, paintTone, shade } from "./layout";

/**
 * Party colours painted rather than printed, in the spirit of the game's oil
 * portraits: the press's bright colours toned down as a painter's pigments
 * are, each dot given a little volume, and the group of dots one filter that
 * drags a brush across them – strokes with a faint relief lit from the upper
 * left, edges broken where the brush left the shape. One filter for the
 * whole group keeps a house of hundreds of seats quick to draw.
 */

/** Each party's painted fill: its gradient, by its place among the colours (party ids may hold any letters). */
export const oilFills = (id: string, colors: Map<string, string>) => new Map([...colors.keys()].map((party, i) => [party, `url(#${id}-${i})`]));

/** The filter of a painted group of dots. */
export const oilFilter = (id: string) => `url(#${id}-oil)`;

/** The brush: strokes dragged one way, a faint relief of paint lit from the upper left, broken edges. */
function BrushFilter({ id, strokes = "0.06 0.13", edge = 2, relief = 0.9 }: { id: string; strokes?: string; edge?: number; relief?: number }) {
  return (
    <filter id={id} x="-8%" y="-8%" width="116%" height="116%" colorInterpolationFilters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency={strokes} numOctaves="3" seed="7" result="strokes" />
      <feDisplacementMap in="SourceGraphic" in2="strokes" scale={edge} xChannelSelector="R" yChannelSelector="G" result="brushed" />
      <feDiffuseLighting in="strokes" surfaceScale={relief} diffuseConstant="1" lightingColor="#fff3df" result="relief">
        <feDistantLight azimuth="225" elevation="50" />
      </feDiffuseLighting>
      <feComposite in="brushed" in2="relief" operator="arithmetic" k1="0.8" k2="0.42" k3="0" k4="-0.04" result="painted" />
      <feComposite in="painted" in2="brushed" operator="in" />
    </filter>
  );
}

/** The gradients and the brush filter, once per drawing; `id` keeps two drawings apart. Colours come toned (paintTone). */
export function OilDefs({ id, colors }: { id: string; colors: Map<string, string> }) {
  return (
    <defs>
      <BrushFilter id={`${id}-oil`} />
      {[...colors].map(([party, color], i) => (
        <radialGradient key={party} id={`${id}-${i}`} cx="40%" cy="34%" r="72%">
          <stop offset="0%" stopColor={shade(color, 0.16)} />
          <stop offset="62%" stopColor={color} />
          <stop offset="100%" stopColor={shade(color, -0.26)} />
        </radialGradient>
      ))}
    </defs>
  );
}

/** What each party emblem draws (engine/partyEmblems.ts). */
export const PARTY_EMBLEM_SET: Record<PartyEmblemKey, ComponentType<EmblemProps>> = {
  "hammer-sickle": HammerSickle, star: Star, fist: HandFist, rose: Flower2, anarchy: Anarchy, cog: Cog, wheat: Wheat, tractor: Tractor, torch: Torch, scale: Scale, dove: Bird, olive: Olive,
  eagle: Eagle, "eagle-double": EagleDouble, crown: Crown, landmark: Landmark, castle: Castle, flag: Flag, fasces: Fasces, bolt: Zap, skull: Skull, swords: Swords, shield: Shield,
  cross: LatinCross, "orthodox-cross": OrthodoxCross, crescent: CrescentStar, "star-david": StarDavid, church: Church, leaf: Leaf, sprout: Sprout, tree: TreePine, sun: Sun, sunrise: Sunrise,
  heart: Heart, handshake: Handshake, people: Users, book: BookOpen, lightbulb: Lightbulb, factory: Factory, hammer: Hammer, anchor: Anchor, mountain: Mountain, globe: Globe, gem: Gem, key: Key, feather: Feather,
};

const EMBLEM_SIZES = {
  xs: { w: 28, h: 35, cls: "h-[35px] w-7" },
  sm: { w: 40, h: 50, cls: "h-[50px] w-10" },
  md: { w: 56, h: 70, cls: "h-[70px] w-14" },
} as const;

/** The light paint an emblem is laid in on a dark ground, and the dark on a light one. */
const IVORY = "#efe3c8";
const SEPIA = "#2b2118";

/**
 * A party's emblem as a small oil painting in the officials' portrait frame:
 * a ground in the party's toned colour, laid with broad strokes and darker
 * at the edges like an old canvas, and the emblem painted on it in ivory –
 * all through the same brush.
 */
export function PartyEmblem({ emblem, color, name, image, size = "md", className = "" }: { emblem: PartyEmblemKey; color: string; name: string; image?: string; size?: keyof typeof EMBLEM_SIZES; className?: string }) {
  const id = `emb-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const Icon = PARTY_EMBLEM_SET[emblem];
  const s = EMBLEM_SIZES[size];
  // The colour comes toned already (layout.ts partyColors).
  const tone = color;
  const lightGround = (() => {
    const c = channels(tone);
    return c ? 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2] > 150 : false;
  })();
  const ink = lightGround ? SEPIA : IVORY;
  // The canvas is 40×50; the glyph sits a little above the middle, as a portrait's face does.
  const glyph = 24;
  return (
    <svg viewBox="0 0 40 50" width={s.w} height={s.h} role="img" aria-label={name} className={`${s.cls} ${ARCH} shrink-0 overflow-hidden border border-line/50 bg-night ${className}`}>
      <title>{name}</title>
      <defs>
        <BrushFilter id={`${id}-brush`} strokes="0.08 0.15" edge={1.2} relief={0.9} />
        <linearGradient id={`${id}-ground`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={shade(tone, 0.2)} />
          <stop offset="55%" stopColor={tone} />
          <stop offset="100%" stopColor={shade(tone, -0.35)} />
        </linearGradient>
        <radialGradient id={`${id}-vignette`} cx="50%" cy="42%" r="70%">
          <stop offset="55%" stopColor={SEPIA} stopOpacity="0" />
          <stop offset="100%" stopColor={SEPIA} stopOpacity="0.55" />
        </radialGradient>
      </defs>
      {/* The player's own picture, painted in oil when it was brought (paintPhoto.ts), takes the emblem's place. */}
      {image ? (
        <image href={image} x="0" y="0" width="40" height="50" preserveAspectRatio="xMidYMid slice" />
      ) : (
      <g filter={`url(#${id}-brush)`}>
        <rect x="-2" y="-2" width="44" height="54" fill={`url(#${id}-ground)`} />
        {/* Broad strokes of the ground, lighter and darker, as a painter lays a background. */}
        <path d="M-2 14 C 10 9, 24 17, 42 11 L 42 19 C 26 24, 12 16, -2 22 Z" fill={shade(tone, 0.12)} opacity="0.55" />
        <path d="M-2 36 C 12 31, 28 40, 42 33 L 42 42 C 28 47, 12 39, -2 45 Z" fill={shade(tone, -0.18)} opacity="0.6" />
        <Icon x={(40 - glyph) / 2 + 0.6} y={11.6} size={glyph} color={SEPIA} strokeWidth={2.2} opacity={0.35} />
        <Icon x={(40 - glyph) / 2} y={11} size={glyph} color={ink} strokeWidth={2} />
      </g>
      )}
      <rect x="0" y="0" width="40" height="50" fill={`url(#${id}-vignette)`} />
    </svg>
  );
}

/**
 * The emblems to choose one from, each painted in the party's colour, the
 * chosen one marked; and first a tile to bring a picture of one's own, which
 * the browser paints in oil (paintPhoto.ts) – taken away again from the same
 * place.
 */
export function EmblemPicker({ value, color, image, onPick, onImage, label, labels }: {
  value: PartyEmblemKey;
  color: string;
  image?: string;
  onPick: (emblem: PartyEmblemKey) => void;
  onImage: (url: string | null) => void;
  label: string;
  labels: { upload: string; painting: string; remove: string; failed: string };
}) {
  const [painting, setPainting] = useState(false);
  const [failed, setFailed] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const bring = async (file: File | undefined) => {
    if (!file) return;
    setPainting(true);
    setFailed(false);
    const url = await paintPhoto(file);
    setPainting(false);
    if (url) onImage(url);
    else setFailed(true);
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => void bring(e.target.files?.[0])} />
        <button type="button" disabled={painting} onClick={() => input.current?.click()} className={`${ui.secondary} px-3 py-2 text-xs`}>
          {painting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageUp className="h-4 w-4" />}
          {painting ? labels.painting : labels.upload}
        </button>
        {image && (
          <button type="button" disabled={painting} onClick={() => onImage(null)} className={`${ui.secondary} px-3 py-2 text-xs`}>
            <X className="h-4 w-4" />
            {labels.remove}
          </button>
        )}
      </div>
      {failed && <p className="text-xs font-bold text-red-600">{labels.failed}</p>}
      <div role="radiogroup" aria-label={label} className="grid grid-cols-6 gap-2 sm:grid-cols-8">
        {(Object.keys(PARTY_EMBLEM_SET) as PartyEmblemKey[]).map((key, i) => {
          const on = !image && key === value;
          return (
            <button key={key} type="button" role="radio" aria-checked={on} aria-label={`${label} ${i + 1}`} onClick={() => onPick(key)} className={`grid place-items-center rounded-xl p-1 transition-colors ${on ? "bg-ink/10 ring-2 ring-ink" : "hover:bg-page"}`}>
              <PartyEmblem emblem={key} color={color} name={`${label} ${i + 1}`} size="sm" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * A party's colour, on its own: the press's usual ones, from red round to black, any other from the palette, and
 * back to the press's own.
 */
export function ColourPicker({ chosen, onColour, labels }: { chosen?: string; onColour: (hex: string | null) => void; labels: { colour: string; palette: string; usual: string } }) {
  const custom = Boolean(chosen && !PARTY_COLOUR_PRESETS.includes(chosen as (typeof PARTY_COLOUR_PRESETS)[number]));
  const ring = "ring-2 ring-ink ring-offset-2 ring-offset-surface";
  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label={labels.colour} className="grid grid-cols-8 gap-2">
        {PARTY_COLOUR_PRESETS.map((hex) => (
          <button
            key={hex}
            type="button"
            role="radio"
            aria-checked={chosen === hex}
            aria-label={`${labels.colour} ${hex}`}
            onClick={() => onColour(hex)}
            className={`aspect-square w-full rounded-full border border-shade/30 shadow-sm transition-transform hover:scale-110 ${chosen === hex ? ring : ""}`}
            style={{ background: `radial-gradient(circle at 35% 30%, ${shade(paintTone(hex), 0.25)}, ${paintTone(hex)} 60%, ${shade(paintTone(hex), -0.25)})` }}
          />
        ))}
        <label title={labels.palette} className={`relative aspect-square w-full cursor-pointer overflow-hidden rounded-full border border-shade/30 shadow-sm transition-transform hover:scale-110 ${custom ? ring : ""}`} style={{ background: "conic-gradient(#c62828, #e3b505, #2e8b3e, #1aa3a3, #1f4e9b, #6a3d9a, #c62828)" }}>
          <span className="sr-only">{labels.palette}</span>
          <input type="color" value={chosen ?? "#1f4e9b"} onChange={(e) => onColour(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
        </label>
      </div>
      {chosen && (
        <button type="button" onClick={() => onColour(null)} className="w-fit text-xs font-bold text-muted underline decoration-dotted underline-offset-2 hover:text-ink">
          {labels.usual}
        </button>
      )}
    </div>
  );
}

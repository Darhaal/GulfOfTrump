"use client";

import {
  Anchor, Baby, Banknote, BookOpen, Briefcase, Building2, Church, Coins, Droplets, Eye, Factory, Flag, FlaskConical, Fuel, Gavel, Globe, GraduationCap, Hammer, Handshake, Heart, Hospital, House, Landmark, Leaf, type LucideIcon, Mail, Map as MapIcon, Megaphone, Newspaper, Palette, Pickaxe, Plane, Radio, Rocket, Scale, Shield, ShieldHalf, Ship, Star, Swords, Tractor, TrainFront, Trophy, UserRound, Users, Wheat, Zap,
} from "lucide-react";
import { MINISTRY_ICON_KEYS, type MinistryIconKey } from "@/engine/ministries";

/** What each of the ministries' icons draws (engine/ministries.ts MINISTRY_ICON_KEYS). */
export const MINISTRY_ICON_SET: Record<MinistryIconKey, LucideIcon> = {
  user: UserRound, landmark: Landmark, shield: Shield, banknote: Banknote, factory: Factory, globe: Globe, "shield-half": ShieldHalf, eye: Eye, flask: FlaskConical, rocket: Rocket, briefcase: Briefcase,
  scale: Scale, gavel: Gavel, megaphone: Megaphone, newspaper: Newspaper, radio: Radio, tractor: Tractor, wheat: Wheat, train: TrainFront, ship: Ship, plane: Plane, hospital: Hospital,
  graduation: GraduationCap, church: Church, building: Building2, handshake: Handshake, hammer: Hammer, zap: Zap, fuel: Fuel, leaf: Leaf, trophy: Trophy, palette: Palette, mail: Mail, map: MapIcon,
  anchor: Anchor, swords: Swords, heart: Heart, book: BookOpen, users: Users, coins: Coins, pickaxe: Pickaxe, droplets: Droplets, baby: Baby, home: House, flag: Flag, star: Star,
};

/** A grid of the icons to choose one from: the chosen one marked. */
export function IconPicker({ value, onPick, label }: { value: MinistryIconKey; onPick: (icon: MinistryIconKey) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-8 gap-1.5">
      {MINISTRY_ICON_KEYS.map((key) => {
        const Icon = MINISTRY_ICON_SET[key];
        const on = key === value;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={key}
            onClick={() => onPick(key)}
            className={`grid aspect-square place-items-center rounded-xl border transition-colors ${on ? "border-ink bg-ink text-on-ink" : "border-line sheet text-muted hover:border-accent/40 hover:text-ink"}`}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}

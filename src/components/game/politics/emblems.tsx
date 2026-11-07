/**
 * Party emblems lucide has no drawing for – the signs of the great movements
 * and faiths: the hammer and sickle, the eagle (one head and two), the skull,
 * the crescent and star, the fasces, the anarchists' A, the Latin and the
 * Orthodox cross, the star of David, the olive branch, the torch. Drawn on
 * lucide's 24 grid and taking its props, so oil.tsx paints them as it paints
 * the others. Generated with scripts in the session; edit the shapes here.
 */

export interface EmblemProps {
  x?: number;
  y?: number;
  size?: number;
  color?: string;
  strokeWidth?: number;
  opacity?: number;
}

// A little closer than lucide's grid: these signs are filled shapes and would look smaller beside its line drawings.
const frame = ({ x, y, size = 24, opacity }: EmblemProps) => ({ x, y, width: size, height: size, viewBox: "1.5 1.5 21 21", opacity, overflow: "visible" as const });

export function HammerSickle(props: EmblemProps) {
  const { color = "currentColor", strokeWidth: sw = 2 } = props;
  return (
    <svg {...frame(props)}>
      <path d="M8.4 4.4 A 7.4 7.4 0 1 1 5.8 16.3" fill="none" stroke={color} strokeWidth={sw * 1.3} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.8 16.3 L 3.3 19.8" fill="none" stroke={color} strokeWidth={sw * 1.6} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.8 6.8 L 17.8 17.8" fill="none" stroke={color} strokeWidth={sw * 1.15} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.3 9.3 L 9.3 4.3" fill="none" stroke={color} strokeWidth={sw * 2.0} strokeLinecap="butt" strokeLinejoin="round" />
    </svg>
  );
}

export function Eagle(props: EmblemProps) {
  const { color = "currentColor", strokeWidth: sw = 2 } = props;
  return (
    <svg {...frame(props)}>
      <path d="M12 8.4 C 9.4 5.6 5.6 4.6 1.6 5.4 C 3.6 6.4 4.2 7.4 3 8.4 C 5.4 8.6 6 9.6 4.4 10.8 C 6.8 10.8 7.6 11.6 7.2 12.8 C 8.8 12.2 10 12.6 10.6 13.6 Z" fill={color} fillRule="nonzero" />
      <path d="M12 8.4 C 14.6 5.6 18.4 4.6 22.4 5.4 C 20.4 6.4 19.8 7.4 21 8.4 C 18.6 8.6 18 9.6 19.6 10.8 C 17.2 10.8 16.4 11.6 16.8 12.8 C 15.2 12.2 14 12.6 13.4 13.6 Z" fill={color} fillRule="nonzero" />
      <path d="M12 7.4 C 13.5 7.4 14.3 9.2 14 12.4 C 13.8 14.6 13 16.2 12 16.8 C 11 16.2 10.2 14.6 10 12.4 C 9.7 9.2 10.5 7.4 12 7.4 Z" fill={color} fillRule="nonzero" />
      <path d="M12 3.4 C 13.2 3.4 13.9 4.2 13.9 5.2 L 15.6 5.9 L 13.7 6.4 C 13.4 7.2 12.8 7.6 12 7.6 C 10.9 7.6 10.1 6.6 10.1 5.5 C 10.1 4.3 10.9 3.4 12 3.4 Z" fill={color} fillRule="nonzero" />
      <path d="M12 16.2 L 8.8 20.8 L 10.6 20.2 L 12 21.4 L 13.4 20.2 L 15.2 20.8 Z" fill={color} fillRule="nonzero" />
      <path d="M10.6 15.6 L 8.6 17.6 M13.4 15.6 L 15.4 17.6" fill="none" stroke={color} strokeWidth={sw * 0.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function EagleDouble(props: EmblemProps) {
  const { color = "currentColor" } = props;
  return (
    <svg {...frame(props)}>
      <path d="M12 9.4 C 9.4 6.6 5.6 5.6 1.6 6.4 C 3.6 7.4 4.2 8.4 3 9.4 C 5.4 9.6 6 10.6 4.4 11.8 C 6.8 11.8 7.6 12.6 7.2 13.8 C 8.8 13.2 10 13.6 10.6 14.6 Z" fill={color} fillRule="nonzero" />
      <path d="M12 9.4 C 14.6 6.6 18.4 5.6 22.4 6.4 C 20.4 7.4 19.8 8.4 21 9.4 C 18.6 9.6 18 10.6 19.6 11.8 C 17.2 11.8 16.4 12.6 16.8 13.8 C 15.2 13.2 14 13.6 13.4 14.6 Z" fill={color} fillRule="nonzero" />
      <path d="M12 8.4 C 13.5 8.4 14.3 10.2 14 13.2 C 13.8 15.2 13 16.6 12 17.2 C 11 16.6 10.2 15.2 10 13.2 C 9.7 10.2 10.5 8.4 12 8.4 Z" fill={color} fillRule="nonzero" />
      <path d="M11.4 9 C 10.6 7.6 9.8 6.6 9.6 5.4 C 9.4 4.2 8.6 3.4 7.6 3.6 C 6.8 3.8 6.6 4.4 6.6 4.8 L 5.2 5.4 L 6.8 5.8 C 7.2 6.6 8 7 8.6 7.2 C 9.4 8 10 8.8 10.6 9.8 Z" fill={color} fillRule="nonzero" />
      <path d="M12.6 9 C 13.4 7.6 14.2 6.6 14.4 5.4 C 14.6 4.2 15.4 3.4 16.4 3.6 C 17.2 3.8 17.4 4.4 17.4 4.8 L 18.8 5.4 L 17.2 5.8 C 16.8 6.6 16 7 15.4 7.2 C 14.6 8 14 8.8 13.4 9.8 Z" fill={color} fillRule="nonzero" />
      <path d="M10.2 2.6 L 11 1.6 L 12 2.4 L 13 1.6 L 13.8 2.6 L 13.4 4 L 10.6 4 Z" fill={color} fillRule="nonzero" />
      <path d="M12 16.6 L 8.8 21 L 10.6 20.4 L 12 21.6 L 13.4 20.4 L 15.2 21 Z" fill={color} fillRule="nonzero" />
    </svg>
  );
}

export function Skull(props: EmblemProps) {
  const { color = "currentColor" } = props;
  return (
    <svg {...frame(props)}>
      <path d="M12 2.8 C 7.4 2.8 4.4 6 4.4 10.1 C 4.4 12.7 5.7 14.6 7.4 15.6 L 7.4 18.2 C 7.4 19 8 19.6 8.8 19.6 L 15.2 19.6 C 16 19.6 16.6 19 16.6 18.2 L 16.6 15.6 C 18.3 14.6 19.6 12.7 19.6 10.1 C 19.6 6 16.6 2.8 12 2.8 Z M6.8 10.6 a 2.2 2.2 0 1 0 4.4 0 a 2.2 2.2 0 1 0 -4.4 0 Z M12.8 10.6 a 2.2 2.2 0 1 0 4.4 0 a 2.2 2.2 0 1 0 -4.4 0 Z M12 13 L 10.9 15.2 L 13.1 15.2 Z M10.2 17.2 h 0.9 v 2.5 h -0.9 Z M11.55 17.2 h 0.9 v 2.5 h -0.9 Z M12.9 17.2 h 0.9 v 2.5 h -0.9 Z" fill={color} fillRule="evenodd" />
    </svg>
  );
}

export function CrescentStar(props: EmblemProps) {
  const { color = "currentColor" } = props;
  return (
    <svg {...frame(props)}>
      <path d="M12.24 4.1 A 8 8 0 1 0 18.07 15.75 A 6.6 6.6 0 1 1 12.24 4.1 Z" fill={color} fillRule="nonzero" />
      <path d="M18.60 11.00 L19.22 12.75 L21.07 12.80 L19.60 13.92 L20.13 15.70 L18.60 14.65 L17.07 15.70 L17.60 13.92 L16.13 12.80 L17.98 12.75 Z" fill={color} fillRule="nonzero" />
    </svg>
  );
}

export function Fasces(props: EmblemProps) {
  const { color = "currentColor" } = props;
  return (
    <svg {...frame(props)}>
      <path d="M9.2 5.6 a 0.8 0.8 0 0 1 1.6 0 v 15.2 a 0.8 0.8 0 0 1 -1.6 0 Z M11.2 5.6 a 0.8 0.8 0 0 1 1.6 0 v 15.2 a 0.8 0.8 0 0 1 -1.6 0 Z M13.2 5.6 a 0.8 0.8 0 0 1 1.6 0 v 15.2 a 0.8 0.8 0 0 1 -1.6 0 Z" fill={color} fillRule="nonzero" />
      <path d="M8.6 8.6 h 6.8 v 1.3 h -6.8 Z M8.6 13.2 h 6.8 v 1.3 h -6.8 Z M8.6 17.8 h 6.8 v 1.3 h -6.8 Z" fill={color} fillRule="nonzero" />
      <path d="M14.8 5.2 C 18.8 3.6 21.2 6 20.6 9.8 C 19 8.8 16.8 8.6 14.8 9.4 Z" fill={color} fillRule="nonzero" />
      <path d="M11.4 4.8 L 12 2.4 L 12.6 4.8 Z" fill={color} fillRule="nonzero" />
    </svg>
  );
}

export function Anarchy(props: EmblemProps) {
  const { color = "currentColor", strokeWidth: sw = 2 } = props;
  return (
    <svg {...frame(props)}>
      <path d="M12 3.4 a 8.6 8.6 0 1 0 0.01 0 Z" fill="none" stroke={color} strokeWidth={sw * 1.0} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.8 19.4 L 12 4.4 L 17.2 19.4" fill="none" stroke={color} strokeWidth={sw * 1.1} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.2 14 L 20.8 14" fill="none" stroke={color} strokeWidth={sw * 1.1} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LatinCross(props: EmblemProps) {
  const { color = "currentColor" } = props;
  return (
    <svg {...frame(props)}>
      <path d="M10.6 2.4 h 2.8 v 5.4 h 5 v 2.8 h -5 v 11 h -2.8 v -11 h -5 v -2.8 h 5 Z" fill={color} fillRule="nonzero" />
    </svg>
  );
}

export function OrthodoxCross(props: EmblemProps) {
  const { color = "currentColor" } = props;
  return (
    <svg {...frame(props)}>
      <path d="M10.9 1.8 h 2.2 v 20.4 h -2.2 Z M8.8 4.4 h 6.4 v 1.8 h -6.4 Z M5.2 8 h 13.6 v 2.2 h -13.6 Z M7.4 17.6 L 16.4 14.4 L 17 16.1 L 8 19.3 Z" fill={color} fillRule="nonzero" />
    </svg>
  );
}

export function StarDavid(props: EmblemProps) {
  const { color = "currentColor", strokeWidth: sw = 2 } = props;
  return (
    <svg {...frame(props)}>
      <path d="M12 2.8 L 20.2 17 L 3.8 17 Z M12 21.2 L 3.8 7 L 20.2 7 Z" fill="none" stroke={color} strokeWidth={sw * 1.0} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Olive(props: EmblemProps) {
  const { color = "currentColor", strokeWidth: sw = 2 } = props;
  return (
    <svg {...frame(props)}>
      <path d="M4.4 20 C 8 16.4 12.4 11.6 19.6 4" fill="none" stroke={color} strokeWidth={sw * 0.9} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.4 16.8 C 5.2 16.6 4 15.2 4 13.4 C 6 13.4 7.4 14.8 7.4 16.8 Z M8.2 15.8 C 8.6 13.6 10 12.8 11.6 13 C 11.2 14.8 9.8 15.8 8.2 15.8 Z M10.4 13.2 C 8.4 12.6 7.6 11 8 9.4 C 9.8 9.8 10.8 11.4 10.4 13.2 Z M11.4 12.2 C 12 10.2 13.4 9.4 15 9.8 C 14.4 11.6 13 12.4 11.4 12.2 Z M13.6 9.8 C 11.8 9 11.2 7.4 11.8 5.8 C 13.4 6.4 14.2 8 13.6 9.8 Z M14.6 8.8 C 15.4 7 16.8 6.4 18.2 7 C 17.4 8.6 16 9.2 14.6 8.8 Z" fill={color} fillRule="nonzero" />
    </svg>
  );
}

export function Torch(props: EmblemProps) {
  const { color = "currentColor" } = props;
  return (
    <svg {...frame(props)}>
      <path d="M10.4 13.2 L 13.6 13.2 L 12.6 21.4 L 11.4 21.4 Z" fill={color} fillRule="nonzero" />
      <path d="M8.4 10.8 L 15.6 10.8 L 14.6 13.2 L 9.4 13.2 Z" fill={color} fillRule="nonzero" />
      <path d="M12 2.2 C 14.6 4.8 15.6 7 14.6 9.2 C 14.1 10.1 13.2 10.6 12 10.6 C 10.5 10.6 9.3 9.6 9.3 8.1 C 9.3 6.6 10.6 6 10.6 4.6 C 11.6 5.4 12 6.4 11.8 7.4 C 12.9 6.2 13 4.4 12 2.2 Z" fill={color} fillRule="nonzero" />
    </svg>
  );
}

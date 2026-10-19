/**
 * Country colours as atlases and strategy games taught everyone to read
 * them: Britain rose-red, France blue, Germany grey, Russia green, the Soviet
 * Union crimson, China red, Japan cream, the Habsburgs yellow, the
 * Netherlands orange. Muted enough to sit together and stay readable under a
 * dark label. The scenarios seed their countries from this table; a save is
 * brought up to date with it when opened.
 */
export const COUNTRY_COLORS: Record<string, string> = {
  // Great powers
  uk: "#d0666b",
  france: "#4a72b8",
  germany: "#6f7277",
  russia: "#4f7d4c",
  ussr: "#a3292c",
  "austria-hungary": "#d9b65c",
  italy: "#5a9d55",
  ottoman: "#4f9a8c",
  turkey: "#4f9a8c",
  usa: "#6680c2",
  japan: "#e6d6a6",
  china: "#cf3d2e",
  // Europe
  spain: "#d9ab45",
  portugal: "#3f8a64",
  netherlands: "#e38b3f",
  belgium: "#e0c855",
  luxembourg: "#7fa3d0",
  switzerland: "#c44e4e",
  austria: "#dcd6c4",
  hungary: "#9fb06a",
  czechoslovakia: "#6d9bd0",
  czechia: "#6d9bd0",
  slovakia: "#8aa6d6",
  poland: "#d27b93",
  denmark: "#c75b6c",
  norway: "#b25a4e",
  sweden: "#5a97c9",
  finland: "#e3dfd0",
  iceland: "#86abd8",
  ireland: "#62a45e",
  romania: "#d8bd46",
  bulgaria: "#6c9a50",
  serbia: "#ad5b52",
  montenegro: "#9e7b6b",
  yugoslavia: "#8873b3",
  croatia: "#7f8fc9",
  slovenia: "#6aa0a0",
  "bosnia-and-herzegovina": "#c9a46a",
  macedonia: "#d98c5f",
  "north-macedonia": "#d98c5f",
  kosovo: "#8aa0c4",
  albania: "#a4453f",
  greece: "#79a9d4",
  cyprus: "#d8a76b",
  malta: "#c97e86",
  estonia: "#4d7fb8",
  latvia: "#8f4652",
  lithuania: "#c2c34f",
  // The former Soviet Union
  byelarus: "#7fa86f",
  belarus: "#7fa86f",
  ukraine: "#e0b93c",
  moldova: "#d4a65c",
  georgia: "#c96f6f",
  armenia: "#d9895c",
  azerbaijan: "#4f9bb0",
  kazakhstan: "#6fb1c4",
  uzbekistan: "#5f8fd0",
  turkmenistan: "#7fae7a",
  kyrgyzstan: "#c45a5a",
  tajikistan: "#d8a76b",
  // Asia
  mongolia: "#9a78b8",
  tibet: "#d8c9a8",
  manchukuo: "#c9a35a",
  taiwan: "#5a86c6",
  "north-korea": "#a05a6a",
  "south-korea": "#7f9fc9",
  persia: "#7fae86",
  iran: "#7fae86",
  afghanistan: "#b0a070",
  india: "#e0a458",
  pakistan: "#3f7f4f",
  bangladesh: "#5a9a6a",
  "sri-lanka": "#c98c6b",
  nepal: "#c46b6b",
  bhutan: "#e0a86a",
  siam: "#6a8fc9",
  thailand: "#6a8fc9",
  myanmar: "#c9b04a",
  vietnam: "#d0a43a",
  laos: "#8fae6a",
  cambodia: "#6a9ab0",
  malaysia: "#5f7fb5",
  indonesia: "#c4614f",
  philippines: "#6a8fd0",
  // Middle East and Africa
  iraq: "#9a8f5f",
  syria: "#b8866a",
  lebanon: "#6fae8a",
  israel: "#7fa8d4",
  jordan: "#c4a46a",
  nejd: "#6f9e5a",
  "saudi-arabia": "#6f9e5a",
  yemen: "#c48a7a",
  oman: "#b56a5a",
  "united-arab-emirates": "#8fa36a",
  kuwait: "#6a9a8a",
  qatar: "#8f4a5a",
  egypt: "#d6c27a",
  libya: "#5a9a5a",
  ethiopia: "#7aaa5a",
  liberia: "#d4795f",
  "south-africa": "#c48a5a",
  // The Americas and Oceania
  canada: "#c44f4f",
  mexico: "#3f8f6a",
  cuba: "#5a7fbf",
  brazil: "#4f9a5f",
  argentina: "#8fbfe0",
  chile: "#c4554f",
  peru: "#cf8a8a",
  colombia: "#e0c45c",
  venezuela: "#b85a5a",
  ecuador: "#e0b850",
  bolivia: "#d4a65c",
  paraguay: "#8aa0c4",
  uruguay: "#7fb0d8",
  australia: "#d88a5a",
  "new-zealand": "#4f8a8a",
};

/**
 * Muted tones for countries the table leaves out. The choice is a hash of the
 * tag, so a country keeps its colour across turns, saves and machines.
 */
const PALETTE = [
  "#b8a17a", "#9fb38a", "#c9a27e", "#8fa7b8", "#b48da3", "#a8b07a",
  "#c2b28f", "#8db3a8", "#b9967c", "#a39cbf", "#c7a96b", "#91a88c",
  "#b5838a", "#7fa3a0", "#c4b37a", "#9c8fb0", "#a9c08f", "#c39a8e",
  "#8aa0c4", "#b8b089", "#9fb9b2", "#c1918f", "#a0ad6f", "#b29f8c",
];

export function hashColor(tag: string): string {
  let h = 2166136261;
  for (let i = 0; i < tag.length; i += 1) {
    h ^= tag.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return PALETTE[(h >>> 0) % PALETTE.length];
}

/** The colour a country wears on the map: its canonical one, else one from its tag. */
export function countryColor(tag: string): string {
  return COUNTRY_COLORS[tag] ?? hashColor(tag);
}

/** A save made with older colours, brought up to the table; countries it does not know keep theirs. */
export function recolor<T extends { countries: Record<string, { color: string; customColor?: boolean }> }>(state: T): T {
  const stale = Object.entries(state.countries).filter(([tag, c]) => COUNTRY_COLORS[tag] && !c.customColor && c.color !== COUNTRY_COLORS[tag]);
  if (!stale.length) return state;
  const countries = { ...state.countries };
  for (const [tag, c] of stale) countries[tag] = { ...c, color: COUNTRY_COLORS[tag] };
  return { ...state, countries };
}

const HEX = /^#[0-9a-f]{6}$/i;

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX.test(value);
}

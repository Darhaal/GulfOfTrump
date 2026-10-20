import type { AppliedChange, ChronicleEntry, GameState, RegionBorder, RegionState } from "./types";

/**
 * The map of every turn, for the picture of a turn and the timelapse of a
 * game. A save keeps only the world as it is now; each chronicle entry keeps
 * how the provinces it changed stood before it (`borders`), so the past is
 * the present with the turns undone, newest first. Entries from before
 * `borders` existed are undone from their list of changes instead: close,
 * though a front's exact share and land handed back silently at a peace are
 * not in that list.
 */

/** The parts of a province the map draws: who owns it, who holds it, and a front through it. */
const borderOf = (r: RegionState): RegionBorder => ({
  owner: r.owner,
  controller: r.controller,
  ...(r.contested ? { contested: r.contested, ...(r.held !== undefined ? { held: r.held } : {}) } : {}),
});

const sameBorder = (a: RegionState, b: RegionState) =>
  a.owner === b.owner && a.controller === b.controller && a.contested === b.contested && (a.contested ? a.held === b.held : true);

/** The provinces whose holder or front a turn changed, as they stood before it. */
export function bordersBefore(before: Record<string, RegionState>, after: Record<string, RegionState>): Record<string, RegionBorder> {
  const out: Record<string, RegionBorder> = {};
  for (const [id, was] of Object.entries(before)) {
    const now = after[id];
    if (now && !sameBorder(was, now)) out[id] = borderOf(was);
  }
  return out;
}

/** One province with a border put back, keeping what the map does not draw (people, towns). */
function restore(region: RegionState | undefined, border: RegionBorder): RegionState {
  const next: RegionState = { ...region, owner: border.owner, controller: border.controller };
  if (border.contested) {
    next.contested = border.contested;
    if (border.held !== undefined) next.held = border.held;
    else delete next.held;
  } else {
    delete next.contested;
    delete next.held;
    delete next.taken;
  }
  return next;
}

/** A turn's changes undone one by one, last first, where the entry did not record its borders. */
function undoChanges(regions: Record<string, RegionState>, applied: AppliedChange[]) {
  for (const c of [...applied].reverse()) {
    if (c.kind !== "annex" && c.kind !== "occupy" && c.kind !== "liberate" && c.kind !== "contest" && c.kind !== "repel") continue;
    const r = regions[c.region];
    if (!r) continue;
    if (c.kind === "annex") {
      regions[c.region] = { ...r, owner: c.from, controller: c.from };
    } else if (c.kind === "occupy" || c.kind === "liberate") {
      regions[c.region] = { ...r, controller: c.from };
    } else if (c.kind === "contest") {
      // A front past half hands the province over (settleMajority), so the holder comes back too.
      const next = { ...r, controller: c.holder };
      if (c.was !== undefined) {
        next.contested = c.by;
        next.held = c.was;
      } else {
        delete next.contested;
        delete next.held;
        delete next.taken;
      }
      regions[c.region] = next;
    } else {
      const next = { ...r, contested: c.by };
      delete next.held;
      regions[c.region] = next;
    }
  }
}

/** The world before a turn, from the world after it. */
export function undoTurn(after: Record<string, RegionState>, entry: ChronicleEntry): Record<string, RegionState> {
  const regions = { ...after };
  if (entry.borders) {
    for (const [id, border] of Object.entries(entry.borders)) if (regions[id]) regions[id] = restore(regions[id], border);
  } else undoChanges(regions, entry.applied);
  return regions;
}

/** A moment of the game the map can show. */
export interface MapFrame {
  /** The turn that ended here; 0 for the start. */
  turn: number;
  date: string;
  /** The turn's headline; none at the start. */
  headline?: string;
  /** The chronicle entry of the turn that ended here. */
  entry?: ChronicleEntry;
  regions: Record<string, RegionState>;
}

/**
 * The map at the start and after every turn, oldest first. The last frame is
 * the world as it is now, so changes made between turns (fronts settled on
 * load, a new government) show from the latest turn on.
 */
export function mapFrames(state: GameState): MapFrame[] {
  const chronicle = state.chronicle;
  const frames: MapFrame[] = [];
  let regions = state.regions;
  for (let i = chronicle.length - 1; i >= 0; i -= 1) {
    const entry = chronicle[i];
    frames.push({ turn: entry.turn, date: entry.to, headline: entry.headline, entry, regions });
    regions = undoTurn(regions, entry);
  }
  frames.push({ turn: 0, date: chronicle[0]?.from ?? state.date, regions });
  return frames.reverse();
}

/** The map right after a turn, or now when the turn is the last one. */
export function regionsAfter(state: GameState, turn: number): Record<string, RegionState> {
  let regions = state.regions;
  for (let i = state.chronicle.length - 1; i >= 0 && state.chronicle[i].turn > turn; i -= 1) regions = undoTurn(regions, state.chronicle[i]);
  return regions;
}

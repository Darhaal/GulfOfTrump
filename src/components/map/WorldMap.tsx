"use client";

import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature, merge, mesh, neighbors as topoNeighbors } from "topojson-client";
import { Anchor, Building2, Flag, Flame, Gem, Grid2x2, Handshake, Layers, Maximize2, Megaphone, Minus, Mountain, MoveUpRight, Plus, Rocket, Star, Swords, TrainFront, Type, Users, Waves, Wheat, X, type LucideIcon } from "lucide-react";
import { memo, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import type { Feature, FeatureCollection, MultiLineString, MultiPolygon, Point, Polygon } from "geojson";
import type { GeometryObject } from "topojson-specification";
import { Medal } from "./medal";
import { ui } from "@/components/ui/classes";
import { useI18n } from "@/i18n/useI18n";
import type { MessageKey } from "@/i18n/messages";
import { formatDate } from "@/engine/calendar";
import type { RegionTopology } from "@/lib/maps";
import { peopleIn } from "@/engine/population";
import { populationDensity, provinceName, railLevel } from "@/engine/provinces";
import { activeResources, RESOURCE_TYPES, resourceOutput, type ResourceType } from "@/engine/resources";
import type { AppliedChange, Formation, MapRegion, Protest, RegionState, ScenarioId, Text, Localized } from "@/engine/types";
import type { SiteView } from "@/engine/space";
import { useCities, useTowns, useTransport, useWater } from "@/lib/assets";
import { MAP_LAYERS, MAP_MODES, QUICK_LAYERS, useMapSettings, type MapLayer, type MapMode } from "@/lib/mapSettings";
import { eraCities, eraTowns } from "./cities";
import { cityRadiusKm, dotRadius, labelGap, layoutPlaces, PLACE_STYLE, PlaceIndex, placeAt, placeRadius, SegmentIndex, type PlacedLabel, type PlacePoint } from "./places";
import { DENSITY_STOPS, densityColor, fertilityColor, QUIET_LAND, RESOURCE_COLORS, resourceTint, SIDE_FILL, sideFill, softened, TERRAIN_COLORS } from "./colors";
import type { Side } from "@/engine/sides";
import { riverName } from "./rivers";
import { DEFAULT_HELD } from "@/engine/outcome";
import { adjustTaken, mergePlaces } from "@/engine/towns";
import { arrowPath, countryLabels, headquartersAt, insideRings, pathRings, splitByTowns, splitProvince, turnMoves } from "./overlays";

/** The SVG is drawn in this coordinate box and scaled to fit its container. */
const W = 1000;
const H = 540;
const MIN_ZOOM = 1;
const MAX_ZOOM = 64;
/** Detail grows with zoom: from the whole world down, fronts appear first, then province borders. */
const FRONTS_FROM = 2;
const PROVINCES_FROM = 2.6;

export interface MapCountry {
  name: Text;
  color: string;
}

const MODE_ICONS: Record<MapMode, LucideIcon> = {
  political: Flag,
  diplomacy: Handshake,
  terrain: Mountain,
  fertility: Wheat,
  population: Users,
  resources: Gem,
  transport: TrainFront,
};

const LAYER_ICONS: Record<MapLayer, LucideIcon> = {
  fronts: Swords,
  changes: MoveUpRight,
  headquarters: Star,
  cities: Building2,
  labels: Type,
  ports: Anchor,
  protests: Megaphone,
  rivers: Waves,
  railways: TrainFront,
  provinces: Grid2x2,
};

/** One of the player's formations for its headquarters marker (engine/army.ts), with the provinces it still stands in. */
export interface MapHeadquarters {
  name: string;
  kind: Formation["kind"];
  divisions: number;
  commander?: string;
  theatre?: string;
  provinces: string[];
  /** The formation the player commands as a general (engine/figures.ts ownFormation). */
  own?: boolean;
}

/** A headquarters' size on screen, in pixels: a front's is larger than an army's. */
const HQ_SIZE = { front: 11, other: 9 } as const;

interface WorldMapProps {
  topology: RegionTopology;
  regions: Record<string, RegionState>;
  countries: Record<string, MapCountry>;
  selected?: string | null;
  selectedProvince?: string | null;
  player?: string;
  /** Which era's city names and capitals to show. */
  era: ScenarioId;
  /** The in-game year: resource output and railways follow it. */
  year: number;
  onSelect?: (country: string | null, province: string | null) => void;
  /** Wars, for the front lines between their sides. */
  wars?: { name?: Text; since?: string; attackers: string[]; defenders: string[]; truce?: { until?: string } }[];
  /**
   * A turn's changes to show: provinces that changed hands or where the front
   * moved, and arrows; `before` is the map as it stood before the turn, where
   * the arrows start. A new key replays the highlight.
   */
  changes?: { key: string | number; applied: AppliedChange[]; before?: Record<string, RegionState>; turn: number; onLatest?: () => void; onShow?: () => void } | null;
  /** The player's armies and fronts, each with a headquarters where it stands. */
  headquarters?: MapHeadquarters[];
  /** City names proclaimed in play, by their English map name. */
  placeNames?: Record<string, Localized>;
  /** Protests against the player's government, marked where they are strongest. */
  protests?: Protest[];
  /** Launch sites open on the date and who holds them (engine/space.ts), a small marker each. */
  sites?: SiteView[];
  /** A click on a marker of a protest against the player's own government: open it (the street in domestic politics). */
  onProtest?: (id: string) => void;
  /** Brings these provinces, or a country's home land, into view whenever the key changes. */
  focus?: { key: string | number; regions?: string[]; country?: string } | null;
  /** The diplomatic view: the country it is about and every country's side towards it (engine/sides.ts). */
  diplomacy?: { subject: string | null; sides: Record<string, Side> } | null;
  /** The game's own controls, in the map's column under the zoom buttons (the turn length). */
  controls?: ReactNode;
  className?: string;
}

interface View {
  k: number;
  x: number;
  y: number;
}

type RegionFeature = Feature<Polygon | MultiPolygon, MapRegion>;

const clampView = ({ k, x, y }: View): View => {
  const kk = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, k));
  return {
    k: kk,
    x: Math.min(0, Math.max(W * (1 - kk), x)),
    y: Math.min(0, Math.max(H * (1 - kk), y)),
  };
};

const idOf = (g: GeometryObject) => ((g as GeometryObject<MapRegion>).properties as MapRegion).id;

/** The stripe band of a contested province's share held by the other side: 1 (a quarter) to 4 (nearly all). */
const shareBand = (held: number | undefined) => Math.min(4, Math.max(1, Math.round((held ?? 30) / 25)));

/** A resource bubble's radius on screen: area grows with output. */
const bubbleRadius = (output: number) => 2.4 + 2.7 * Math.sqrt(output);

/**
 * Markers – arrowheads, places and their names, ports, protests, resource
 * bubbles – keep one size on screen at every zoom. Each is drawn in pixels
 * around its own point and scaled back by `--z` (viewBox units per pixel over
 * the zoom), which the markers' group carries; country names by `--zl`, so
 * they grow only as the square root of the zoom. A gesture moves the drawing
 * before React renders, and moves the two variables with it (`showView`), so
 * nothing swells while the wheel turns and shrinks back when it stops.
 */
const zoomVars = (k: number, unit: number) => ({ "--z": unit / k, "--zl": 1 / Math.sqrt(k) });
const pin = (x: number, y: number, turn = 0): CSSProperties => ({ transform: `translate(${x}px, ${y}px)${turn ? ` rotate(${turn}deg)` : ""} scale(var(--z))` });
/** Of an arrowhead's length, how far inside it the line ends: deep enough to stay joined to it while a gesture changes the zoom under both. */
const HEAD_INSET = 0.6;

/**
 * The province map. Modes colour the land by holder, by its holder's side
 * towards one country (the diplomatic view), terrain, fertility,
 * population density, resource output (on grey land) or grey for transport; rivers,
 * railways, ports, cities and province borders are overlays. Places and lines
 * appear as the zoom grows. Wheel or pinch zooms around the pointer, drag
 * pans, a click picks the province and its sovereign.
 */
export default function WorldMap({ topology, regions, countries, selected, selectedProvince, player, era, year, onSelect, wars, changes, headquarters, protests, onProtest, sites, focus, diplomacy, controls, className, placeNames }: WorldMapProps) {
  const { text, t, locale, people } = useI18n();
  const uid = useId().replace(/:/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  // ViewBox units per screen pixel: names, dots and markers are sized in
  // pixels, so they read the same on a wide map and beside open panels.
  const [unit, setUnit] = useState(1);
  // The map's size on screen, so a card near its right or bottom edge opens the other way.
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const measure = () => {
      const { width, height } = svg.getBoundingClientRect();
      if (width > 0 && height > 0) {
        setUnit(1 / Math.min(width / W, height / H));
        setBox({ w: width, h: height });
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);
  const groupRef = useRef<SVGGElement>(null);
  const markersRef = useRef<SVGGElement>(null);
  // The committed view drives React; during a gesture the drawing moves
  // directly with `live` and React catches up once the gesture pauses.
  const [view, setView] = useState<View>({ k: 1, x: 0, y: 0 });
  const live = useRef<View>(view);
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [settings, updateSettings] = useMapSettings();
  const { mode, resource, layers } = settings;
  const [layersOpen, setLayersOpen] = useState(false);
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  // The city under the pointer (or tapped), with the province beneath it; its card asks for railways and ports once.
  const [cityHover, setCityHover] = useState<{ place: PlacePoint; region: string | null; x: number; y: number } | null>(null);
  const [cityFacts, setCityFacts] = useState(false);
  // The headquarters under the pointer: its formation's card.
  const [hqHover, setHqHover] = useState<{ i: number; x: number; y: number } | null>(null);
  // The protest marker under the pointer (or tapped): what the people want, how many, who leads them.
  const [protestHover, setProtestHover] = useState<{ i: number; x: number; y: number } | null>(null);
  const [moveHover, setMoveHover] = useState<{ i: number; x: number; y: number } | null>(null);
  const [frontHover, setFrontHover] = useState<{ i: number; x: number; y: number } | null>(null);
  const placedRef = useRef<PlacedLabel[]>([]);
  const showRail = mode === "transport" || layers.railways;
  const showPorts = mode === "transport" || layers.ports;
  // "Ports and resources" brings the resource bubbles to every mode; the resources mode always has them.
  const showBubbles = mode === "resources" || layers.ports;
  /** A layer a mode always shows: railways and ports in transport, resources in the resources mode. */
  const forcedLayer = (layer: MapLayer) => (mode === "transport" && (layer === "railways" || layer === "ports")) || (mode === "resources" && layer === "ports");
  const setLayer = (layer: MapLayer, on: boolean) => updateSettings({ layers: { ...layers, [layer]: on } });
  const water = useWater();
  const cities = useCities();
  const transport = useTransport(showRail || showPorts || cityFacts);
  // Towns also draw the fronts through contested provinces, so they load whenever there is one.
  const contestedAny = useMemo(() => Object.values(regions).some((r) => r.contested), [regions]);
  const towns = useTowns((layers.cities && view.k >= 3.5) || contestedAny);
  const places = useMemo(() => (cities && towns ? mergePlaces(cities, towns) : null), [cities, towns]);

  const geometry = useMemo(() => {
    const collection = feature(topology, topology.objects.regions) as unknown as FeatureCollection<Polygon | MultiPolygon, MapRegion>;
    const projection = geoNaturalEarth1().fitExtent(
      [
        [6, 6],
        [W - 6, H - 6],
      ],
      collection,
    );
    const path = geoPath(projection);
    const shapes = collection.features.map((f: RegionFeature) => ({ id: f.properties.id, d: path(f) ?? "", props: f.properties, c: path.centroid(f) }));
    const byId = new Map(shapes.map((s) => [s.id, s.props]));
    const features = new Map(collection.features.map((f) => [f.properties.id, f]));
    const centres = new Map(shapes.map((s) => [s.id, s.c as [number, number]]));
    const paths = new Map(shapes.map((s) => [s.id, s.d]));
    return { projection, path, shapes, byId, features, centres, paths, sphere: path({ type: "Sphere" }) ?? "" };
  }, [topology]);

  /** Who borders whom, by geometry index and by province id. */
  const adjacency = useMemo(() => {
    const geoms = topology.objects.regions.geometries;
    const list = topoNeighbors(geoms as never) as number[][];
    const byId = new Map<string, string[]>();
    list.forEach((ns, i) => byId.set(idOf(geoms[i] as GeometryObject), ns.map((j) => idOf(geoms[j] as GeometryObject))));
    return { list, byId };
  }, [topology]);

  /** Rivers in three levels of importance, drawn as zoom allows; lakes as water. */
  const waterPaths = useMemo(() => {
    if (!water) return null;
    const rivers = feature(water, water.objects.rivers) as unknown as FeatureCollection<MultiLineString, { n: string; r: number }>;
    const lakes = feature(water, water.objects.lakes) as unknown as FeatureCollection<Polygon | MultiPolygon, { n: string; r: number }>;
    const level = (min: number, max: number) =>
      geometry.path({ type: "FeatureCollection", features: rivers.features.filter((f) => f.properties.r >= min && f.properties.r <= max) } as never) ?? "";
    return { major: level(0, 3), middle: level(4, 5), minor: level(6, 7), lakes: geometry.path(lakes as never) ?? "" };
  }, [water, geometry]);

  /** Railways open by the in-game year, in three ranks: trunk lines, main lines, branches. */
  const railPaths = useMemo(() => {
    if (!transport) return null;
    const rails = feature(transport, transport.objects.railways) as unknown as FeatureCollection<MultiLineString, { r: number; s: number }>;
    const level = (min: number, max: number) =>
      geometry.path({
        type: "FeatureCollection",
        features: rails.features.filter((f) => f.properties.s <= year && f.properties.r >= min && f.properties.r <= max),
      } as never) ?? "";
    return { trunk: level(0, 4), main: level(5, 6), branch: level(7, 8) };
  }, [transport, geometry, year]);

  const portPoints = useMemo(() => {
    if (!transport) return [];
    const ports = feature(transport, transport.objects.ports) as unknown as FeatureCollection<Point, { n: string; r: number }>;
    return ports.features
      .map((f) => {
        const p = geometry.projection(f.geometry.coordinates as [number, number]);
        return p ? { name: f.properties.n, rank: f.properties.r, px: p[0], py: p[1] } : null;
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);
  }, [transport, geometry]);

  /** Railways open by the in-game year, by grid cell: what a city's card asks of them. */
  const railIndex = useMemo(() => {
    if (!transport) return null;
    const rails = feature(transport, transport.objects.railways) as unknown as FeatureCollection<MultiLineString, { r: number; s: number }>;
    const index = new SegmentIndex();
    for (const f of rails.features) {
      if (f.properties.s > year) continue;
      const lines = (f.geometry.type as string) === "LineString" ? [f.geometry.coordinates as unknown as [number, number][]] : f.geometry.coordinates;
      for (const line of lines) {
        let prev: [number, number] | null = null;
        for (const point of line) {
          const p = geometry.projection(point as [number, number]);
          // A line across the date line would span the map: it is cut there.
          if (p && prev && Math.abs(p[0] - prev[0]) < W / 2) index.add(prev[0], prev[1], p[0], p[1], f.properties.r);
          prev = p ?? null;
        }
      }
    }
    return index;
  }, [transport, geometry, year]);

  /** The era's places and GeoNames' towns, projected and indexed; names as they were on the start date. */
  const placeIndex = useMemo(() => {
    const points: PlacePoint[] = [];
    const add = (list: ReturnType<typeof eraCities>) => {
      for (const c of list) {
        const p = geometry.projection([c.x, c.y]);
        if (!p) continue;
        // The built-up radius in map units: its kilometres measured north of the place on this projection.
        const north = geometry.projection([c.x, Math.min(89, c.y + cityRadiusKm(c.pop) / 111)]);
        const extent = north ? Math.hypot(north[0] - p[0], north[1] - p[1]) : 0;
        points.push({ name: c.name, key: c.key, pop: c.pop, px: p[0], py: p[1], kind: c.kind, minZoom: c.minZoom, priority: c.priority, r: placeRadius(c.kind, c.pop), extent });
      }
    };
    if (cities) add(eraCities(cities, era, locale, placeNames));
    if (towns) add(eraTowns(towns, era, locale));
    return new PlaceIndex(points);
  }, [cities, towns, era, locale, geometry, placeNames]);

  /** Resource bubbles: the province's top three, or the picked resource alone; big ones under small ones. */
  const bubbles = useMemo(() => {
    if (!showBubbles) return [];
    const out: { key: string; type: ResourceType; output: number; x: number; y: number; slot: number; slots: number; widest: number }[] = [];
    for (const s of geometry.shapes) {
      if (!Number.isFinite(s.c[0])) continue;
      const list = activeResources(s.props, year)
        .filter((r) => mode !== "resources" || resource === "all" || r.type === resource)
        .slice(0, 3);
      const widest = list.length ? bubbleRadius(list[0].output) : 0;
      list.forEach((r, slot) => out.push({ key: `${s.id}-${r.type}`, ...r, x: s.c[0], y: s.c[1], slot, slots: list.length, widest }));
    }
    return out.sort((a, b) => b.output - a.output);
  }, [showBubbles, mode, resource, geometry, year]);

  /** Who holds the most of the picked resource this year. */
  const producers = useMemo(() => {
    if (mode !== "resources" || resource === "all") return [];
    const totals = new Map<string, number>();
    for (const s of geometry.shapes) {
      const output = resourceOutput(s.props, resource, year);
      const holder = regions[s.id]?.controller;
      if (output && holder) totals.set(holder, (totals.get(holder) ?? 0) + output);
    }
    return [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [mode, resource, geometry, year, regions]);

  /** Sides holding part of some province, with the share bands they need: a stripe pattern of their colour for each. */
  const contesters = useMemo(
    () => [...new Set(Object.values(regions).flatMap((r) => (r.contested ? [`${r.contested}|${shareBand(r.held)}`] : [])))].map((key) => key.split("|") as [string, string]),
    [regions],
  );

  const borders = useMemo(() => {
    const obj = topology.objects.regions;
    const holder = (g: GeometryObject) => regions[idOf(g)]?.controller;
    const country = mesh(topology, obj, (a, b) => a === b || holder(a) !== holder(b)) as MultiLineString;
    const internal = mesh(topology, obj, (a, b) => a !== b && holder(a) === holder(b)) as MultiLineString;
    return { country: geometry.path(country) ?? "", internal: geometry.path(internal) ?? "" };
  }, [topology, regions, geometry]);

  const selectedOutline = useMemo(() => {
    if (!selected) return "";
    const geoms = topology.objects.regions.geometries.filter((g) => regions[idOf(g as GeometryObject)]?.owner === selected);
    if (!geoms.length) return "";
    return geometry.path(merge(topology, geoms as never) as MultiPolygon) ?? "";
  }, [selected, topology, regions, geometry]);

  const provinceOutline = useMemo(() => {
    if (!selectedProvince) return "";
    return geometry.shapes.find((s) => s.id === selectedProvince)?.d ?? "";
  }, [selectedProvince, geometry]);

  /** One name per holder, on its home land (see overlays.ts). */
  const labels = useMemo(() => countryLabels(topology, adjacency.list, regions, geometry.path), [topology, adjacency, regions, geometry]);

  /**
   * Contested provinces split along the front: the share the attacker holds
   * painted in its colour on the side facing its own land, the front line
   * across the province where the cut runs.
   */
  const splits = useMemo(() => {
    const out = new Map<string, { held: string; free: string; front: string; by: string; holder: string }>();
    for (const [id, r] of Object.entries(regions)) {
      if (!r.contested) continue;
      const d = geometry.paths.get(id);
      const c = geometry.centres.get(id);
      if (!d || !c || !Number.isFinite(c[0])) continue;
      // Towards the attacker's own land next door, or else its nearest province.
      const near = (adjacency.byId.get(id) ?? []).filter((n) => regions[n]?.controller === r.contested).map((n) => geometry.centres.get(n)).filter((p): p is [number, number] => Boolean(p && Number.isFinite(p[0])));
      let toward: [number, number] | null = near.length ? [near.reduce((s, p) => s + p[0], 0) / near.length, near.reduce((s, p) => s + p[1], 0) / near.length] : null;
      if (!toward) {
        let best = Infinity;
        for (const sh of geometry.shapes) {
          if (regions[sh.id]?.controller !== r.contested || !Number.isFinite(sh.c[0])) continue;
          const dist = Math.hypot(sh.c[0] - c[0], sh.c[1] - c[1]);
          if (dist < best) {
            best = dist;
            toward = sh.c as [number, number];
          }
        }
      }
      if (!toward) continue;
      const straight = splitProvince(d, c, toward, r.held ?? DEFAULT_HELD);
      // By towns: each takes the land nearest it; the attacker's are those on record, or else those on its side of the share.
      const rings = pathRings(d);
      const xs = rings.flat().map((p) => p[0]);
      const ys = rings.flat().map((p) => p[1]);
      const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      const inside = (places ?? [])
        .map((t) => ({ t, at: geometry.projection(t.at) as [number, number] | null }))
        .filter((x): x is { t: (typeof x)["t"]; at: [number, number] } => Boolean(x.at) && x.at![0] >= x0 && x.at![0] <= x1 && x.at![1] >= y0 && x.at![1] <= y1 && insideRings(rings, x.at!));
      // Without a list on record, the towns are chosen as the engine would: from the side of the attacker's own land, up to its share.
      const lonLat = (n: string) => geometry.byId.get(n)?.at;
      const from = (adjacency.byId.get(id) ?? []).filter((n) => regions[n]?.controller === r.contested).map(lonLat).filter((p): p is [number, number] => Boolean(p));
      const centre = lonLat(id);
      const derived =
        centre && from.length
          ? adjustTaken(inside.map((x) => x.t), [], r.held ?? DEFAULT_HELD, centre, [from.reduce((s, p) => s + p[0], 0) / from.length, from.reduce((s, p) => s + p[1], 0) / from.length])
          : inside.filter((x) => insideRings(straight ? pathRings(straight.held) : [], x.at)).map((x) => x.t.n);
      const taken = new Set(r.taken?.length ? r.taken : derived);
      const split = splitByTowns(d, inside.map((x) => ({ at: x.at, taken: taken.has(x.t.n) }))) ?? straight;
      if (split) out.set(id, { ...split, by: r.contested, holder: r.controller });
    }
    return out;
  }, [regions, geometry, adjacency, places]);
  const splitIds = useMemo(() => new Set(splits.keys()), [splits]);

  /**
   * Front lines, one per war: the outline of everything one side holds —
   * whole provinces and the towns it holds in contested ones — shown only
   * where it runs over land the other side holds (a mask), so the line is
   * whole whatever the province borders, and silent along the sea or a third
   * country. Dashed while a truce holds.
   */
  const fronts = useMemo(() => {
    if (!wars?.length || !layers.fronts) return null;
    const geoms = topology.objects.regions.geometries as GeometryObject[];
    const out: { id: string; war: number; truce: boolean; outline: string; land: string; inside: string }[] = [];
    for (const [war, w] of wars.entries()) {
      const a = new Set(w.attackers);
      const d = new Set(w.defenders);
      // A side's whole provinces; one with the other side's towns inside counts by its own part alone (below).
      const merged = (side: Set<string>, other: Set<string>) => {
        const list = geoms.filter((g) => {
          const id = idOf(g);
          const sp = splits.get(id);
          return side.has(regions[id]?.controller ?? "") && !(sp && other.has(sp.by));
        });
        return list.length ? (geometry.path(merge(topology, list as never) as MultiPolygon) ?? "") : "";
      };
      // Towns one side holds inside the other's provinces; where the other side holds A's province, A's own part of it is outlined
      // instead, so the edges between two of the other side's towns are no front.
      const inside = (by: Set<string>, holder: Set<string>, part: "held" | "free") => [...splits.values()].filter((sp) => by.has(sp.by) && holder.has(sp.holder)).map((sp) => sp[part]).join("");
      const ofA = inside(a, d, "held");
      const ofD = inside(d, a, "held");
      const outline = merged(a, d) + ofA + inside(d, a, "free");
      if (!outline) continue;
      out.push({ id: `${w.attackers.join("+")}-${w.defenders.join("+")}`, war, truce: Boolean(w.truce), outline, land: merged(d, new Set()) + ofD, inside: ofA });
    }
    return out.length ? out : null;
  }, [wars, layers.fronts, topology, regions, geometry, splits]);
  const frontKinds = { war: view.k >= FRONTS_FROM && Boolean(fronts?.some((f) => !f.truce)), truce: view.k >= FRONTS_FROM && Boolean(fronts?.some((f) => f.truce)) };

  /** The shown turn: provinces that changed hands and the pushes behind them. */
  const turn = useMemo(() => {
    if (!changes || !layers.changes) return null;
    return turnMoves(changes.applied, regions, (id) => geometry.centres.get(id), (id) => adjacency.byId.get(id) ?? [], { before: changes.before });
  }, [changes, layers.changes, regions, geometry, adjacency]);

  /** The headquarters: each formation's where it stands; several in one province side by side. */
  const hqs = useMemo(() => {
    if (!headquarters?.length || !layers.headquarters) return [];
    const taken = new Map<string, number>();
    const out: (MapHeadquarters & { region: string; at: [number, number]; slot: number })[] = [];
    for (const f of headquarters) {
      const spot = headquartersAt(f.provinces, (id) => geometry.centres.get(id));
      if (!spot) continue;
      const slot = taken.get(spot.region) ?? 0;
      taken.set(spot.region, slot + 1);
      out.push({ ...f, ...spot, slot });
    }
    return out;
  }, [headquarters, layers.headquarters, geometry]);

  // ---- pan & zoom -------------------------------------------------------
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ moved: number; pinch?: { dist: number; view: View; mid: { x: number; y: number } } }>({ moved: 0 });

  const toSvg = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return { x: 0, y: 0 };
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  /** Moves the drawing to a view now; React's render follows at once or when the gesture pauses. */
  const showView = (v: View, commit: "now" | "soon") => {
    const zoomed = v.k !== live.current.k;
    live.current = v;
    groupRef.current?.setAttribute("transform", `translate(${v.x} ${v.y}) scale(${v.k})`);
    // Markers and stripes keep their size on screen meanwhile, as React will draw them; a pan leaves them be.
    if (zoomed) {
      for (const [name, value] of Object.entries(zoomVars(v.k, unit))) markersRef.current?.style.setProperty(name, String(value));
      svgRef.current?.querySelectorAll<SVGPatternElement>("pattern[data-turn]").forEach((p) => p.setAttribute("patternTransform", `rotate(${p.dataset.turn}) scale(${1 / v.k})`));
    }
    if (commitTimer.current) clearTimeout(commitTimer.current);
    if (commit === "now") setView(v);
    else commitTimer.current = setTimeout(() => setView(live.current), 150);
  };

  const zoomAt = (factor: number, at: { x: number; y: number }, from: View) => {
    const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, from.k * factor));
    const ratio = k / from.k;
    return clampView({ k, x: at.x - (at.x - from.x) * ratio, y: at.y - (at.y - from.y) * ratio });
  };

  const showViewRef = useRef(showView);
  useEffect(() => {
    showViewRef.current = showView;
  });

  // A native, non-passive listener: React's wheel handler cannot stop the
  // page from scrolling underneath the map.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
      setCityHover(null);
      setHqHover(null);
      setProtestHover(null);
      setMoveHover(null);
      setFrontHover(null);
      const factor = Math.pow(1.0018, -e.deltaY);
      const v = live.current;
      const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.k * factor));
      const ratio = k / v.k;
      showViewRef.current(clampView({ k, x: p.x - (p.x - v.x) * ratio, y: p.y - (p.y - v.y) * ratio }), "soon");
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    gesture.current.moved = 0;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current.pinch = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        view: live.current,
        mid: toSvg((a.x + b.x) / 2, (a.y + b.y) / 2),
      };
    }
  };

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) {
      // Plain hover: position the tooltip relative to the map box.
      const target = (e.target as Element).closest("[data-region]");
      const box = e.currentTarget.getBoundingClientRect();
      const region = target?.getAttribute("data-region") ?? null;
      const at = { x: e.clientX - box.left, y: e.clientY - box.top };
      setHover(region ? { id: region, ...at } : null);
      const hq = (e.target as Element).closest("[data-hq]")?.getAttribute("data-hq");
      setHqHover(hq ? { i: Number(hq), ...at } : null);
      const protest = (e.target as Element).closest("[data-protest]")?.getAttribute("data-protest");
      setProtestHover(protest ? { i: Number(protest), ...at } : null);
      const move = (e.target as Element).closest("[data-move]")?.getAttribute("data-move");
      setMoveHover(move ? { i: Number(move), ...at } : null);
      const front = (e.target as Element).closest("[data-front]")?.getAttribute("data-front");
      setFrontHover(front ? { i: Number(front), ...at } : null);
      // A city's dot takes no pointer events: the nearest drawn place within reach is the one under the pointer.
      const point = toSvg(e.clientX, e.clientY);
      const city = placeAt(placedRef.current, point.x, point.y, live.current, unit);
      setCityHover(city ? { place: city, region, ...at } : null);
      if (city && !cityFacts) setCityFacts(true);
      return;
    }
    const next = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, next);
    const pinch = gesture.current.pinch;
    if (pinch && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      gesture.current.moved += 10;
      showView(zoomAt(dist / pinch.dist, pinch.mid, pinch.view), "soon");
      return;
    }
    const ctm = svgRef.current?.getScreenCTM();
    const scale = ctm ? ctm.a : 1;
    const dx = (next.x - prev.x) / scale;
    const dy = (next.y - prev.y) / scale;
    gesture.current.moved += Math.abs(next.x - prev.x) + Math.abs(next.y - prev.y);
    if (gesture.current.moved > 3 && hover) setHover(null);
    if (gesture.current.moved > 3 && cityHover) setCityHover(null);
    if (gesture.current.moved > 3 && hqHover) setHqHover(null);
    if (gesture.current.moved > 3 && protestHover) setProtestHover(null);
    if (gesture.current.moved > 3 && moveHover) setMoveHover(null);
    if (gesture.current.moved > 3 && frontHover) setFrontHover(null);
    const v = live.current;
    showView(clampView({ k: v.k, x: v.x + dx, y: v.y + dy }), "soon");
  };

  const onPointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    const wasClick = gesture.current.moved < 5 && pointers.current.size === 1;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) gesture.current.pinch = undefined;
    if (!wasClick) showView(live.current, "now");
    if (!wasClick) return;
    // An arrow or a front answers the pointer with its card, but a click goes to what lies beneath it.
    const beneath = document.elementsFromPoint(e.clientX, e.clientY).find((el) => !el.closest("[data-move], [data-front]"));
    const target = beneath?.closest("[data-region]");
    const id = target?.getAttribute("data-region") ?? null;
    // A tap on a touch screen opens a city's card, as hovering does with a mouse.
    if (e.pointerType !== "mouse") {
      const point = toSvg(e.clientX, e.clientY);
      const city = placeAt(placedRef.current, point.x, point.y, live.current, unit);
      const box = e.currentTarget.getBoundingClientRect();
      setCityHover(city ? { place: city, region: id, x: e.clientX - box.left, y: e.clientY - box.top } : null);
      if (city) setCityFacts(true);
      const hq = beneath?.closest("[data-hq]")?.getAttribute("data-hq");
      setHqHover(hq ? { i: Number(hq), x: e.clientX - box.left, y: e.clientY - box.top } : null);
      const protest = beneath?.closest("[data-protest]")?.getAttribute("data-protest");
      setProtestHover(protest ? { i: Number(protest), x: e.clientX - box.left, y: e.clientY - box.top } : null);
      const move = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-move]")?.getAttribute("data-move");
      setMoveHover(move ? { i: Number(move), x: e.clientX - box.left, y: e.clientY - box.top } : null);
      const front = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-front]")?.getAttribute("data-front");
      setFrontHover(front ? { i: Number(front), x: e.clientX - box.left, y: e.clientY - box.top } : null);
    }
    // A protest against the player's own government opens in domestic politics; one abroad picks its country as any click does.
    const marker = beneath?.closest("[data-protest]")?.getAttribute("data-protest");
    const protest = marker !== undefined && marker !== null ? protests?.[Number(marker)] : undefined;
    if (protest && onProtest && (!protest.country || protest.country === player)) {
      onProtest(protest.id);
      return;
    }
    if (!onSelect) return;
    onSelect(id ? (regions[id]?.owner ?? null) : null, id);
  };

  /** A zoom button: in or out around the centre, or 0 for the whole world. */
  function zoomButton(factor: number) {
    showView(factor ? zoomAt(factor, { x: W / 2, y: H / 2 }, live.current) : { k: 1, x: 0, y: 0 }, "now");
  }

  // Bring the asked-for provinces into view, once per key.
  const focusKey = focus?.key;
  useEffect(() => {
    if (focusKey === undefined || !focus) return;
    const ids = focus.regions?.length ? focus.regions : focus.country ? (labels.find((l) => l.tag === focus.country)?.core ?? []) : [];
    let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const id of ids) {
      const f = geometry.features.get(id);
      if (!f) continue;
      const [[a, b], [c, d]] = geometry.path.bounds(f);
      // A province across the date line spans the whole map; leave it out.
      if (c - a > W / 2) continue;
      [x0, y0, x1, y1] = [Math.min(x0, a), Math.min(y0, b), Math.max(x1, c), Math.max(y1, d)];
    }
    if (!Number.isFinite(x0)) return;
    const k = Math.min(10, Math.max(1, Math.min(W / ((x1 - x0) * 1.6 || 1), H / ((y1 - y0) * 1.6 || 1))));
    showViewRef.current(clampView({ k, x: W / 2 - ((x0 + x1) / 2) * k, y: H / 2 - ((y0 + y1) / 2) * k }), "now");
    // Only a new key moves the camera; the rest is read as it is at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey, geometry]);

  const hovered = hover ? regions[hover.id] : null;
  const hoveredProps = hover ? geometry.byId.get(hover.id) : undefined;
  const k = view.k;
  // What is on screen, in map units, with a margin: places outside are not drawn.
  const margin = 30 / k;
  const onScreen = (x: number, y: number) =>
    x >= -view.x / k - margin && x <= (W - view.x) / k + margin && y >= -view.y / k - margin && y <= (H - view.y) / k + margin;
  const transportMode = mode === "transport";
  const diplomatic = mode === "diplomacy";
  // The modes that colour countries as countries, and so name them.
  const named = mode === "political" || transportMode || diplomatic;
  const showLabels = named && layers.labels;

  /** Names that fit: country names first, then places by importance (see places.ts). */
  const placed = useMemo((): PlacedLabel[] => {
    if (!layers.cities) return [];
    const kk = view.k;
    const obstacles: [number, number, number, number][] = [];
    if (showLabels) {
      for (const l of labels) {
        if (l.size * kk < 34) continue;
        const size = Math.min(15, Math.max(4, l.size / 7)) * (1 / Math.sqrt(kk)) * kk;
        const sx = l.x * kk + view.x;
        const sy = l.y * kk + view.y;
        const half = (text(countries[l.tag]?.name ?? l.tag).length * size * 0.7) / 2;
        obstacles.push([sx - half, sy - size * 0.6, sx + half, sy + size * 0.6]);
      }
    }
    const pad = 40 / kk;
    const candidates = placeIndex.query(-view.x / kk - pad, -view.y / kk - pad, (W - view.x) / kk + pad, (H - view.y) / kk + pad, kk);
    return layoutPlaces(candidates, view, W, H, obstacles, unit);
  }, [layers.cities, view, showLabels, labels, countries, text, placeIndex, unit]);
  useEffect(() => {
    placedRef.current = placed;
  }, [placed]);

  /** The card of the city under the pointer: what it is, its people, who holds it and what stands there. */
  const cityCard = useMemo(() => {
    if (!cityHover) return null;
    const c = cityHover.place;
    const region = cityHover.region ? regions[cityHover.region] : undefined;
    const props = cityHover.region ? geometry.byId.get(cityHover.region) : undefined;
    // The start date's people, moved as the province's have since (war, famine, growth).
    const moved = region && props?.pop ? Math.min(3, Math.max(0.2, peopleIn(region, props) / props.pop)) : 1;
    // A town of a contested province is the other side's when the game names it among those it holds.
    const holder = region ? (region.contested && c.key && region.taken?.includes(c.key) ? region.contested : region.controller) : undefined;
    const perKm = c.extent && c.pop ? c.extent / cityRadiusKm(c.pop) : 1 / 35;
    const near = Math.max(c.extent ?? 0, 6 * perKm);
    const rail = railIndex?.nearest(c.px, c.py, near) ?? null;
    const port = portPoints.some((p) => Math.hypot(p.px - c.px, p.py - c.py) <= Math.max(c.extent ?? 0, 10 * perKm));
    return {
      ...cityHover,
      people: c.pop !== undefined ? c.pop * moved : undefined,
      holder,
      occupied: Boolean(region && holder && holder !== region.owner),
      front: Boolean(region?.contested),
      rail: rail === null ? null : rail <= 4 ? ("trunk" as const) : ("line" as const),
      port,
    };
  }, [cityHover, regions, geometry, railIndex, portPoints]);
  const resourceName = (type: ResourceType) => t(`resource.${type}` as MessageKey);
  const hqCard = hqHover ? hqs[hqHover.i] : undefined;
  /** Where a hover card goes: below right of the pointer, or above and to the left near the map's far edges. */
  const cardAt = (x: number, y: number): CSSProperties => {
    const flipX = box.w > 0 && x > box.w - 280;
    const flipY = box.h > 0 && y > box.h - 220;
    // Anchored by the far side when it opens the other way, so the card keeps its width.
    return { ...(flipX ? { right: box.w - x + 14 } : { left: x + 14 }), ...(flipY ? { bottom: box.h - y + 14 } : { top: y + 14 }) };
  };
  const protestCard = !hqCard && protestHover && layers.protests && mode === "political" ? protests?.[protestHover.i] : undefined;
  const moveCard = !hqCard && !protestCard && moveHover && turn ? turn.moves[moveHover.i] : undefined;
  const frontAt = !hqCard && !protestCard && !moveCard && frontHover ? fronts?.[frontHover.i] : undefined;
  const frontCard = frontAt ? wars?.[frontAt.war] : undefined;
  const sideNames = (tags: string[]) => tags.map((tag) => text(countries[tag]?.name ?? tag)).join(", ");
  /** The arrow's provinces by name, the first four and how many more. */
  const moveNames = (() => {
    if (!moveCard) return "";
    const names = moveCard.regions.flatMap((id) => {
      const props = geometry.byId.get(id);
      return props ? [provinceName(props, locale)] : [];
    });
    const shown = names.slice(0, 4).join(", ");
    return names.length > 4 ? t("map.move.more", { list: shown, n: names.length - 4 }) : shown;
  })();

  return (
    <div className={`@container relative overflow-hidden select-none touch-none ${className ?? ""}`}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="block w-full h-full cursor-grab active:cursor-grabbing"
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => {
          setHover(null);
          setCityHover(null);
          setHqHover(null);
          setProtestHover(null);
          setMoveHover(null);
          setFrontHover(null);
        }}
        role="img"
        aria-label="World map"
      >
        <defs>
          {/* The stripes live in the zoomed group's space; scaling them back (here and in showView) keeps them thin at any zoom. */}
          <pattern id={`hatch-${uid}`} data-turn="45" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform={`rotate(45) scale(${1 / k})`}>
            <line x1="0" y1="0" x2="0" y2="4" stroke="rgba(20,20,20,0.22)" strokeWidth="0.9" />
          </pattern>
          {/* Contested provinces: stripes in the colour of the side holding part of them. */}
          {contesters.map(([tag, band]) => (
            <pattern key={`${tag}-${band}`} id={`contest-${uid}-${tag}-${band}`} data-turn="-45" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform={`rotate(-45) scale(${1 / k})`}>
              {/* Stripes as wide as the share the other side holds: a sliver at a quarter, nearly solid near all of it. */}
              <line x1="3" y1="0" x2="3" y2="6" stroke={countries[tag]?.color ?? "rgba(20,20,20,0.5)"} strokeWidth={(Number(band) / 4) * 5.4} strokeOpacity="0.95" />
            </pattern>
          ))}
        </defs>
        <rect width={W} height={H} fill="var(--sea)" />
        <g ref={groupRef} transform={`translate(${view.x} ${view.y}) scale(${k})`}>
          <path d={geometry.sphere} fill="var(--sea)" stroke="none" />
          <Regions shapes={geometry.shapes} regions={regions} countries={countries} mode={mode} resource={resource} year={year} hatch={`url(#hatch-${uid})`} contestPrefix={`contest-${uid}-`} split={splitIds} sides={diplomatic ? diplomacy?.sides : undefined} />
          {named && splits.size > 0 && (
            <g pointerEvents="none">
              {[...splits].map(([id, sp]) => {
                const color = countries[sp.by]?.color;
                const fill = transportMode ? "var(--map-quiet)" : diplomatic ? sideFill(diplomacy?.sides[sp.by]) : softened(color);
                return color ? <path key={id} d={sp.held} style={{ fill, stroke: fill }} strokeWidth={0.6} vectorEffect="non-scaling-stroke" /> : null;
              })}
            </g>
          )}
          {waterPaths && layers.rivers && (
            <g pointerEvents="none">
              <path d={waterPaths.lakes} fill="var(--sea)" stroke="var(--river)" strokeWidth={0.4} vectorEffect="non-scaling-stroke" />
              <path d={waterPaths.major} fill="none" stroke="var(--river)" strokeWidth={1.4} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              {k >= 2 && <path d={waterPaths.middle} fill="none" stroke="var(--river)" strokeWidth={1} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
              {k >= 4.5 && <path d={waterPaths.minor} fill="none" stroke="var(--river)" strokeOpacity={0.8} strokeWidth={0.6} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
            </g>
          )}
          {layers.provinces && k >= PROVINCES_FROM && (
            <path
              d={borders.internal}
              fill="none"
              stroke="var(--map-line)"
              strokeOpacity={k > 4 ? 0.3 : 0.16}
              strokeWidth={0.4}
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
          )}
          {splits.size > 0 && (
            <mask id={`borders-${uid}`} maskUnits="userSpaceOnUse" x={-W} y={-H} width={W * 3} height={H * 3}>
              <rect x={-W} y={-H} width={W * 3} height={H * 3} fill="white" />
              <path d={[...splits.values()].map((sp) => sp.held).join("")} fill="black" stroke="black" strokeWidth={3 / k} />
            </mask>
          )}
          <path
            d={borders.country}
            mask={splits.size > 0 ? `url(#borders-${uid})` : undefined}
            fill="none"
            stroke="var(--map-line)"
            strokeOpacity={mode === "resources" || transportMode ? 0.8 : 0.55}
            strokeWidth={mode === "resources" || transportMode ? 1.2 : 0.8}
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
          {turn && turn.changed.size > 0 && (
            <g key={changes?.key} className="map-pulse" pointerEvents="none">
              {[...turn.changed].map(([id, c]) => {
                const d = geometry.paths.get(id);
                if (!d) return null;
                const color = countries[c.by]?.color ?? "var(--ink)";
                // A dark outline over a light one, so the change shows on land of any colour, the mover's own included.
                return (
                  <g key={id}>
                    <path d={d} fill={color} fillOpacity={c.kind === "push" || c.kind === "hold" ? 0.18 : 0.32} stroke="var(--map-glow)" strokeWidth={4} vectorEffect="non-scaling-stroke" />
                    <path d={d} fill="none" stroke="var(--ink)" strokeWidth={1.8} strokeDasharray={c.kind === "push" || c.kind === "hold" ? "5 3" : undefined} vectorEffect="non-scaling-stroke" />
                  </g>
                );
              })}
            </g>
          )}
          {showRail && railPaths && (
            <g pointerEvents="none" fill="none" stroke="var(--ink)" strokeLinejoin="round" strokeLinecap="round">
              <path d={railPaths.trunk} strokeOpacity={transportMode ? 0.85 : 0.55} strokeWidth={transportMode ? 1.7 : 1.1} vectorEffect="non-scaling-stroke" />
              {k >= (transportMode ? 1.8 : 2.5) && (
                <path d={railPaths.main} strokeOpacity={transportMode ? 0.75 : 0.5} strokeWidth={transportMode ? 1.2 : 0.9} vectorEffect="non-scaling-stroke" />
              )}
              {k >= (transportMode ? 3.5 : 4.5) && (
                <path d={railPaths.branch} strokeOpacity={transportMode ? 0.6 : 0.4} strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
              )}
              {transportMode && k >= 3 && (
                <path d={railPaths.trunk} stroke="var(--surface)" strokeWidth={0.7} strokeDasharray="4 4" strokeLinecap="butt" vectorEffect="non-scaling-stroke" />
              )}
            </g>
          )}
          {selectedOutline && (
            <path d={selectedOutline} fill="none" stroke="var(--ink)" strokeWidth={2} vectorEffect="non-scaling-stroke" pointerEvents="none" />
          )}
          {provinceOutline && (
            <g fill="none" pointerEvents="none" strokeLinejoin="round">
              <path d={provinceOutline} stroke="var(--map-halo)" strokeWidth={6} vectorEffect="non-scaling-stroke" />
              <path d={provinceOutline} stroke="var(--ink)" strokeWidth={2.4} vectorEffect="non-scaling-stroke" />
            </g>
          )}
          {/* Over the selection outline, which would otherwise hide the front along the player's border. */}
          {k >= FRONTS_FROM && fronts?.map((f, i) => (
            <g key={`${f.id}-${i}`} pointerEvents="none">
              {/* White where the other side holds the land: only that half of the stroke shows. */}
              <mask id={`front-${uid}-${i}`} maskUnits="userSpaceOnUse" x={-W} y={-H} width={W * 3} height={H * 3}>
                <path d={f.land} fill="white" />
                {f.inside && <path d={f.inside} fill="black" />}
              </mask>
              <g mask={`url(#front-${uid}-${i})`} fill="none" strokeLinejoin="round" strokeLinecap="round">
                <path d={f.outline} stroke="var(--map-glow)" strokeWidth={f.truce ? 8 : 10} vectorEffect="non-scaling-stroke" />
                <path
                  d={f.outline}
                  stroke={f.truce ? "var(--muted)" : "var(--war)"}
                  strokeWidth={f.truce ? 4 : 5.2}
                  strokeDasharray={f.truce ? "6 4" : undefined}
                  vectorEffect="non-scaling-stroke"
                />
              </g>
              {/* A wider line no one sees, clipped as the drawn half is, takes the pointer for the war's card. */}
              <clipPath id={`front-hit-${uid}-${i}`}>
                <path d={f.land} />
              </clipPath>
              <path
                d={f.outline}
                fill="none"
                stroke="transparent"
                strokeWidth={16}
                vectorEffect="non-scaling-stroke"
                clipPath={`url(#front-hit-${uid}-${i})`}
                pointerEvents="stroke"
                data-front={i}
                className="cursor-help"
              />
            </g>
          ))}
          {/* Markers, drawn in pixels around their points (see zoomVars). */}
          <g ref={markersRef} style={zoomVars(k, unit) as CSSProperties}>
            {/* Over another mode's colours the bubbles wait for the provinces to be big enough to hold them. */}
            {bubbles.length > 0 && (mode === "resources" || k >= PROVINCES_FROM) && (
              <g pointerEvents="none">
                {bubbles.map((b) => {
                  if (!onScreen(b.x, b.y)) return null;
                  const r = bubbleRadius(b.output);
                  const cx = (b.slot - (b.slots - 1) / 2) * (b.widest * 2 + 1.5);
                  return (
                    <g key={b.key} style={pin(b.x, b.y)}>
                      <circle cx={cx} r={r + 1.4} fill="var(--map-halo)" />
                      <circle cx={cx} r={r} fill={RESOURCE_COLORS[b.type]} stroke="var(--map-line)" strokeOpacity={0.55} strokeWidth={0.8} />
                      {mode === "resources" && resource !== "all" && k >= 3 && (
                        <text
                          x={cx}
                          fontSize={Math.max(6, r * 0.9)}
                          textAnchor="middle"
                          dominantBaseline="central"
                          className="fill-ink font-black"
                          style={{ paintOrder: "stroke", stroke: "var(--map-halo)", strokeWidth: 1.5 }}
                        >
                          {b.output}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            )}
            {showPorts && (
              <g pointerEvents="none">
                {portPoints.map((p, i) => {
                  const min = p.rank <= 3 ? (transportMode ? 1 : 2) : p.rank <= 5 ? 2.5 : p.rank <= 7 ? 5 : 8;
                  if (k < min || !onScreen(p.px, p.py)) return null;
                  const s = 9;
                  return (
                    <g key={i} style={pin(p.px, p.py)}>
                      <Medal r={s * 0.62} tone="sea" icon={Anchor} sign={0.62} stroke={2.6} />
                      {k >= (p.rank <= 5 ? 6 : 9) && (
                        <text
                          x={s * 0.85}
                          fontSize={9}
                          dominantBaseline="middle"
                          fill="var(--river)"
                          className="font-semibold italic"
                          style={{ paintOrder: "stroke", stroke: "var(--map-glow)", strokeWidth: 1.5 }}
                        >
                          {p.name}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            )}
            {turn && turn.moves.length > 0 && (
              <g key={"moves-" + changes?.key} className="map-pulse" pointerEvents="none">
                {turn.moves.map((m, i) => {
                  // The line runs between the provinces; the head is a marker at the point, its length in pixels.
                  const head = 10 + Math.min(m.count, 6);
                  const { line, angle } = arrowPath(m.to, m.from, (head * unit) / k, HEAD_INSET);
                  const color = countries[m.by]?.color ?? "var(--ink)";
                  const width = 3 + Math.min(m.count, 6) * 0.4;
                  // The mover's colour inside a dark outline: an arrow stays readable over its own side's land.
                  return (
                    <g key={m.key} data-move={i}>
                      <path d={line} fill="none" stroke="var(--ink)" strokeOpacity={0.75} strokeWidth={width + 2.4} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                      <path
                        d={line}
                        fill="none"
                        stroke={color}
                        strokeWidth={width}
                        strokeLinecap="round"
                        strokeDasharray={m.kind === "push" || m.sea ? "7 4" : undefined}
                        vectorEffect="non-scaling-stroke"
                      />
                      <path
                        d={`M0,0L${-head},${head * 0.55}L${-head},${-head * 0.55}Z`}
                        style={pin(m.to[0], m.to[1], angle)}
                        fill={color}
                        stroke="var(--ink)"
                        strokeOpacity={0.75}
                        strokeWidth={1.4}
                        strokeLinejoin="round"
                        pointerEvents="all"
                        className="cursor-help"
                      />
                      {/* A wider line no one sees takes the pointer, for the arrow's card. */}
                      <path d={line} fill="none" stroke="transparent" strokeWidth={width + 10} vectorEffect="non-scaling-stroke" pointerEvents="stroke" className="cursor-help" />
                    </g>
                  );
                })}
              </g>
            )}
            {/* Each marker answers the pointer with the protest's card; a click still picks the province beneath. */}
            {mode === "political" && layers.protests && protests && protests.length > 0 && (
              <g>
                {protests.flatMap((p, i) =>
                  p.where.map((id) => {
                    const c = geometry.centres.get(id);
                    if (!c || !Number.isFinite(c[0])) return null;
                    const violent = p.stage === "riot" || p.stage === "uprising";
                    const s = p.stage === "uprising" ? 30 : violent ? 26 : 22;
                    const Icon = violent ? Flame : Megaphone;
                    return (
                      <g key={`${p.id}-${id}`} style={pin(c[0], c[1])} data-protest={i} data-region={id} className="cursor-help">
                        <Medal r={s * 0.62} tone={violent ? "war" : "ivory"} icon={Icon} sign={0.58} ring />
                      </g>
                    );
                  }),
                )}
              </g>
            )}
            {mode === "political" && sites && sites.length > 0 && (
              <g>
                {sites.map((s) => {
                  const p = s.at ? geometry.projection(s.at) : geometry.centres.get(s.province);
                  if (!p || !Number.isFinite(p[0]) || !onScreen(p[0], p[1])) return null;
                  const r = 7;
                  return (
                    <g key={s.id} style={pin(p[0], p[1])} className="cursor-pointer" onClick={() => onSelect?.(s.holder, s.province)}>
                      <title>{t("map.site", { name: text(s.name), holder: text(countries[s.holder]?.name ?? s.holder) })}</title>
                      <Medal r={r} tone="accent" icon={Rocket} sign={0.62} />
                    </g>
                  );
                })}
              </g>
            )}
            {placed.length > 0 && <Places placed={placed} />}
            {showLabels && (
              <g pointerEvents="none">
                {labels.map((l) => {
                  // Shown once the land is big enough on screen to hold its name, which grows as the square root of the zoom.
                  if (l.size * k < 34) return null;
                  const size = Math.min(15, Math.max(4, l.size / 7));
                  const country = countries[l.tag];
                  return (
                    <text
                      key={l.tag}
                      fontSize={size}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="var(--map-text)"
                      fillOpacity={l.tag === player ? 0.85 : 0.6}
                      className="font-semibold uppercase"
                      style={{
                        transform: `translate(${l.x}px, ${l.y}px) scale(var(--zl))`,
                        paintOrder: "stroke",
                        stroke: "var(--map-glow)",
                        strokeWidth: size / 6,
                        strokeLinejoin: "round",
                        letterSpacing: size / 10,
                      }}
                    >
                      {text(country?.name ?? l.tag)}
                    </text>
                  );
                })}
              </g>
            )}
            {/* The army's headquarters, over the places and names so neither hides one; each answers the pointer with its formation's card. */}
            {hqs.length > 0 && (
              <g>
                {hqs.map((h, i) => {
                  if (!onScreen(h.at[0], h.at[1])) return null;
                  const s = h.kind === "front" ? HQ_SIZE.front : HQ_SIZE.other;
                  const Icon = h.kind === "front" ? Star : Flag;
                  return (
                    <g key={`${h.name}-${i}`} style={pin(h.at[0], h.at[1])} data-hq={i} data-region={h.region} className="cursor-pointer">
                      <g transform={`translate(${h.slot * (HQ_SIZE.front * 2 + 2)} 0)`}>
                        <Medal r={s} tone={h.own ? "accent" : "ivory"} icon={Icon} sign={0.58} />
                      </g>
                    </g>
                  );
                })}
              </g>
            )}
          </g>
        </g>
      </svg>

      {mode === "political" && (frontKinds.war || frontKinds.truce || hqs.length > 0 || (turn && turn.changed.size > 0)) && (
        <div className="absolute left-3 top-3 flex max-w-[16rem] flex-col gap-1 rounded-xl border border-line sheet p-2.5 shadow-sm @lg:bottom-3 @lg:top-auto">
          {hqs.length > 0 && (
            <span className="inline-flex items-center gap-2 text-2xs font-bold text-ink">
              <span className="grid h-4 w-5 place-items-center">
                <span className="grid h-3.5 w-3.5 place-items-center rounded-full border border-ink sheet">
                  <Flag className="h-2 w-2" />
                </span>
              </span>
              {t("map.legend.hq")}
            </span>
          )}
          {frontKinds.war && (
            <span className="inline-flex items-center gap-2 text-2xs font-bold text-ink">
              <span className="h-0.5 w-5 rounded-full bg-war" />
              {t("map.legend.front")}
            </span>
          )}
          {frontKinds.truce && (
            <span className="inline-flex items-center gap-2 text-2xs font-bold text-ink">
              <span className="w-5 border-t-2 border-dashed border-muted" />
              {t("map.legend.truce")}
            </span>
          )}
          {turn && turn.changed.size > 0 && changes && (
            <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs font-bold text-ink">
              <span className="h-2.5 w-2.5 rounded-sm border border-ink/40 bg-ink/15" />
              {changes.onShow ? (
                <button type="button" onClick={changes.onShow} className="underline decoration-dotted underline-offset-2 hover:text-accent">
                  {t("map.legend.turn", { n: changes.turn })} · {turn.changed.size}
                </button>
              ) : (
                t("map.legend.turn", { n: changes.turn })
              )}
              {changes.onLatest && (
                <button type="button" onClick={changes.onLatest} className="rounded-md bg-page px-1.5 py-0.5 text-accent hover:bg-divider">
                  {t("map.legend.latest")}
                </button>
              )}
            </span>
          )}
        </div>
      )}

      {mode !== "political" && (
        <div className="absolute left-3 top-3 max-w-[15rem] rounded-xl border border-line sheet p-2.5 shadow-sm @lg:bottom-3 @lg:top-auto @lg:max-w-[17rem]">
          {diplomatic && (
            <div className="flex flex-col gap-1.5">
              <div className="text-2xs font-black uppercase tracking-wider text-muted">
                {diplomacy?.subject && countries[diplomacy.subject] ? t("map.legend.relations", { country: text(countries[diplomacy.subject].name) }) : t("map.legend.pickCountry")}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {LEGEND_SIDES.map(([side, key]) => (
                  <span key={side} className="inline-flex items-center gap-1.5 text-2xs font-bold text-ink">
                    <span className="h-2.5 w-2.5 rounded-sm border border-line" style={{ background: SIDE_FILL[side] }} />
                    {t(key)}
                  </span>
                ))}
              </div>
            </div>
          )}
          {mode === "terrain" && (
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {(Object.keys(TERRAIN_COLORS) as (keyof typeof TERRAIN_COLORS)[]).map((key) => (
                <span key={key} className="inline-flex items-center gap-1.5 text-2xs font-bold text-ink">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: TERRAIN_COLORS[key] }} />
                  {t(`terrain.${key}` as MessageKey)}
                </span>
              ))}
            </div>
          )}
          {mode === "fertility" && (
            <span className="flex w-48 items-center gap-2 text-2xs font-bold text-ink">
              0
              <span
                className="h-2 flex-1 rounded-full"
                style={{ background: `linear-gradient(to right, ${fertilityColor(0)}, ${fertilityColor(35)}, ${fertilityColor(65)}, ${fertilityColor(100)})` }}
              />
              100
            </span>
          )}
          {mode === "population" && (
            <div className="w-52">
              <div className="mb-1 text-2xs font-black uppercase tracking-wider text-muted">{t("map.legend.density")}</div>
              <div className="h-2 rounded-full" style={{ background: `linear-gradient(to right, ${DENSITY_STOPS.map(([, c]) => c).join(", ")})` }} />
              <div className="mt-1 flex justify-between text-2xs font-bold tabular-nums text-ink">
                {DENSITY_STOPS.filter((_, i) => i % 2 === 0).map(([v]) => (
                  <span key={v}>{v >= 2000 ? "2000+" : v}</span>
                ))}
              </div>
            </div>
          )}
          {mode === "resources" && resource === "all" && (
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2 text-2xs font-black uppercase tracking-wider text-muted">
                {t("map.legend.output")}
                <span className="flex items-end gap-1">
                  {[1, 5, 10].map((o) => (
                    <span key={o} className="flex flex-col items-center gap-0.5">
                      <span className="rounded-full border border-line bg-muted/40" style={{ width: bubbleRadius(o) * 2, height: bubbleRadius(o) * 2 }} />
                      <span className="tabular-nums">{o}</span>
                    </span>
                  ))}
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {RESOURCE_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => updateSettings({ resource: type })}
                    className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-2xs font-bold text-ink transition-colors hover:bg-page"
                  >
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: RESOURCE_COLORS[type] }} />
                    {resourceName(type)}
                  </button>
                ))}
              </div>
              <div className="mt-1 text-2xs font-medium text-muted">{t("map.legend.pick")}</div>
            </div>
          )}
          {mode === "resources" && resource !== "all" && (
            <div className="w-52">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-black text-ink">
                  <span className="h-3 w-3 rounded-full" style={{ background: RESOURCE_COLORS[resource] }} />
                  {resourceName(resource)}
                </span>
                <button
                  type="button"
                  onClick={() => updateSettings({ resource: "all" })}
                  title={t("map.resource.all")}
                  aria-label={t("map.resource.all")}
                  className="grid h-6 w-6 place-items-center rounded-md text-muted transition-colors hover:bg-page hover:text-ink"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-1.5 flex items-center gap-2 text-2xs font-bold text-ink">
                0
                <span
                  className="h-2 flex-1 rounded-full"
                  style={{ background: `linear-gradient(to right, ${QUIET_LAND}, ${resourceTint(RESOURCE_COLORS[resource], 1)}, ${resourceTint(RESOURCE_COLORS[resource], 10)})` }}
                />
                10
              </div>
              <div className="mt-2 text-2xs font-black uppercase tracking-wider text-muted">{t("map.legend.top", { year })}</div>
              {producers.length ? (
                <ol className="mt-1 grid gap-0.5">
                  {producers.map(([tag, total]) => (
                    <li key={tag} className="flex items-center justify-between gap-2 text-xs font-bold text-ink">
                      <span className="inline-flex min-w-0 items-center gap-1.5">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: countries[tag]?.color }} />
                        <span className="truncate">{text(countries[tag]?.name ?? tag)}</span>
                      </span>
                      <span className="tabular-nums">{Math.round(total * 10) / 10}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="mt-1 text-xs font-medium text-muted">{t("map.legend.none", { year })}</div>
              )}
            </div>
          )}
          {transportMode && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs font-bold text-ink">
              <span className="inline-flex items-center gap-1.5">
                <svg width="22" height="6" aria-hidden>
                  <line x1="1" y1="3" x2="21" y2="3" stroke="var(--ink)" strokeWidth="2" />
                  <line x1="1" y1="3" x2="21" y2="3" stroke="var(--surface)" strokeWidth="0.8" strokeDasharray="3 3" />
                </svg>
                {t("map.legend.railway")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="grid h-3.5 w-3.5 place-items-center rounded-full border border-line sheet">
                  <Anchor className="h-2.5 w-2.5" color="var(--river)" />
                </span>
                {t("map.legend.port")}
              </span>
            </div>
          )}
        </div>
      )}

      {hqCard && hqHover && (
        <div
          className="pointer-events-none absolute z-10 max-w-64 rounded-xl border border-line sheet px-3 py-2 text-xs shadow-lg shadow-shade/10"
          style={cardAt(hqHover.x, hqHover.y)}
        >
          <div className="font-black text-ink">{hqCard.name}</div>
          <div className="font-bold text-muted">
            {t(`army.kind.${hqCard.kind}` as MessageKey)}
            {hqCard.divisions > 0 && <> · {t("army.divisions", { n: hqCard.divisions.toLocaleString(locale) })}</>}
          </div>
          <div className={`mt-1 font-bold ${hqCard.commander ? "text-ink" : "text-muted"}`}>{hqCard.commander ? t("army.commander", { name: hqCard.commander }) : t("map.hq.noCommander")}</div>
          {hqCard.theatre && <div className="mt-0.5 font-medium text-muted">{hqCard.theatre}</div>}
          {hqCard.own && <span className="mt-1 inline-block rounded-md bg-accent/15 px-1.5 py-0.5 font-bold text-accent">{t("map.hq.own")}</span>}
        </div>
      )}

      {protestCard && protestHover && (
        <div
          className="pointer-events-none absolute z-10 max-w-72 rounded-xl border border-line sheet px-3 py-2 text-xs shadow-lg shadow-shade/10"
          style={cardAt(protestHover.x, protestHover.y)}
        >
          <div className="font-black text-ink">{protestCard.title}</div>
          <div className="font-bold text-muted">
            <span className={protestCard.stage === "riot" || protestCard.stage === "uprising" ? "text-war" : ""}>{t(`politics.protest.${protestCard.stage}` as MessageKey)}</span>
            {" · "}
            {t("politics.protest.size", { n: people(protestCard.size) })}
            {protestCard.grew ? ` (${protestCard.grew > 0 ? "+" : "−"}${people(Math.abs(protestCard.grew))})` : ""}
          </div>
          {protestCard.country && protestCard.country !== player && (
            <div className="mt-0.5 font-bold text-muted">{t("map.protest.against", { country: text(countries[protestCard.country]?.name ?? protestCard.country) })}</div>
          )}
          {protestCard.demands && <div className="mt-1 font-medium text-ink">{t("politics.protest.demands", { demands: protestCard.demands })}</div>}
          {protestCard.by && <div className="mt-0.5 font-bold text-ink">{t("map.protest.by", { by: protestCard.by })}</div>}
          <div className="mt-0.5 font-medium text-muted">
            {[
              protestCard.support !== undefined && t("politics.protest.support", { n: protestCard.support }),
              protestCard.organisation !== undefined && t("politics.protest.organisation", { n: protestCard.organisation }),
              protestCard.killed ? t("politics.protest.killed", { n: protestCard.killed }) : "",
              protestCard.backer && t("politics.protest.backer", { country: text(countries[protestCard.backer]?.name ?? protestCard.backer) }),
              t("map.protest.since", { date: formatDate(protestCard.since, locale) }),
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
          {onProtest && (!protestCard.country || protestCard.country === player) && <div className="mt-1 font-bold text-accent">{t("map.protest.open")}</div>}
        </div>
      )}

      {moveCard && moveHover && (
        <div
          className="pointer-events-none absolute z-10 max-w-72 rounded-xl border border-line sheet px-3 py-2 text-xs shadow-lg shadow-shade/10"
          style={cardAt(moveHover.x, moveHover.y)}
        >
          <div className="flex items-center gap-1.5 font-black text-ink">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: countries[moveCard.by]?.color }} />
            {text(countries[moveCard.by]?.name ?? moveCard.by)}
          </div>
          <div className="font-bold text-muted">{t(`map.move.${moveCard.back ? "back" : moveCard.sea && moveCard.kind === "take" ? "landing" : moveCard.kind}` as MessageKey)}</div>
          {moveCard.against && <div className="mt-0.5 font-bold text-muted">{t("map.move.against", { country: text(countries[moveCard.against]?.name ?? moveCard.against) })}</div>}
          {moveNames && <div className="mt-1 font-medium text-ink">{t("map.move.provinces", { list: moveNames })}</div>}
        </div>
      )}

      {frontCard && frontHover && (
        <div
          className="pointer-events-none absolute z-10 max-w-72 rounded-xl border border-line sheet px-3 py-2 text-xs shadow-lg shadow-shade/10"
          style={cardAt(frontHover.x, frontHover.y)}
        >
          {frontCard.name && <div className="font-black text-ink">{text(frontCard.name)}</div>}
          <div className={frontCard.name ? "font-bold text-ink" : "font-black text-ink"}>
            {sideNames(frontCard.attackers)} – {sideNames(frontCard.defenders)}
          </div>
          {frontCard.since && <div className="mt-0.5 font-medium text-muted">{t("map.front.since", { date: formatDate(frontCard.since, locale) })}</div>}
          {frontCard.truce && (
            <div className="mt-1 font-bold text-muted">{frontCard.truce.until ? t("map.front.truceUntil", { date: formatDate(frontCard.truce.until, locale) }) : t("map.front.truce")}</div>
          )}
        </div>
      )}

      {!hqCard && !protestCard && !moveCard && !frontCard && cityCard && (
        <div
          className="pointer-events-none absolute z-10 max-w-64 rounded-xl border border-line sheet px-3 py-2 text-xs shadow-lg shadow-shade/10"
          style={cardAt(cityCard.x, cityCard.y)}
        >
          <div className="font-black text-ink">{cityCard.place.name}</div>
          <div className="font-bold text-muted">
            {t(`map.city.${cityCard.place.kind}` as MessageKey)}
            {cityCard.people !== undefined && <> · {t("map.city.people", { n: people(cityCard.people) })}</>}
          </div>
          {cityCard.holder && (
            <div className={`mt-1 font-bold ${cityCard.occupied ? "text-red-600" : "text-muted"}`}>
              {t("map.city.heldBy", { country: text(countries[cityCard.holder]?.name ?? cityCard.holder) })}
            </div>
          )}
          {(cityCard.front || cityCard.rail || cityCard.port) && (
            <div className="mt-1 flex flex-wrap gap-1">
              {cityCard.front && <span className="rounded-md bg-war/15 px-1.5 py-0.5 font-bold text-war">{t("map.city.front")}</span>}
              {cityCard.rail && <span className="rounded-md bg-page px-1.5 py-0.5 font-bold text-ink">{t(`map.city.rail.${cityCard.rail}` as MessageKey)}</span>}
              {cityCard.port && <span className="rounded-md bg-sea/15 px-1.5 py-0.5 font-bold text-ink">{t("map.city.port")}</span>}
            </div>
          )}
        </div>
      )}

      {!hqCard && !protestCard && !moveCard && !frontCard && !cityCard && hover && hovered && hoveredProps && (
        <div
          className="pointer-events-none absolute z-10 max-w-64 rounded-xl border border-line sheet px-3 py-2 text-xs shadow-lg shadow-shade/10"
          style={cardAt(hover.x, hover.y)}
        >
          <div className="font-black text-ink">{provinceName(hoveredProps, locale)}</div>
          <div className="font-bold text-muted">{text(countries[hovered.owner]?.name ?? hovered.owner)}</div>
          <div className="mt-1 flex flex-wrap gap-x-2 text-muted font-medium">
            <span>{t(`terrain.${hoveredProps.terrain}` as MessageKey)}</span>
            <span>
              {t("province.fertility")} {hoveredProps.fertility}
            </span>
          </div>
          {hoveredProps.pop !== undefined && (
            <div className="mt-0.5 font-medium text-muted">
              {t("province.population")}: <b className="text-ink">{people(peopleIn(hovered, hoveredProps))}</b> ·{" "}
              {t("province.density", { n: Math.round(populationDensity({ pop: peopleIn(hovered, hoveredProps), area: hoveredProps.area })).toLocaleString(locale) })}
            </div>
          )}
          {showRail && (
            <div className="mt-0.5 font-medium text-muted">
              {t("province.rail")}: <b className="text-ink">{t(`rail.${railLevel(hoveredProps)}` as MessageKey)}</b>
            </div>
          )}
          {activeResources(hoveredProps, year).length > 0 && (
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-bold text-ink">
              {activeResources(hoveredProps, year).map((r) => (
                <span key={r.type} className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full" style={{ background: RESOURCE_COLORS[r.type] }} />
                  {resourceName(r.type)} <span className="tabular-nums text-muted">{r.output}</span>
                </span>
              ))}
            </div>
          )}
          {hoveredProps.rv && hoveredProps.rv.length > 0 && (
            <div className="mt-0.5 font-medium text-muted">{hoveredProps.rv.map((r) => riverName(r, locale)).join(", ")}</div>
          )}
          {hovered.contested && (
            <div className="mt-1 font-bold text-amber-700">{t("map.contested", { country: text(countries[hovered.contested]?.name ?? hovered.contested) })}</div>
          )}
          {hovered.controller !== hovered.owner && (
            <div className="mt-1 font-bold text-red-600">{t("map.occupied", { country: text(countries[hovered.controller]?.name ?? hovered.controller) })}</div>
          )}
        </div>
      )}

      <div className="absolute bottom-2 right-2 flex flex-col items-end gap-2 @md:bottom-3 @md:right-3">
        {/* Narrow maps zoom by pinch; the buttons would cover them. */}
        <div className="hidden flex-col gap-1.5 @md:flex">
          {(
            [
              { label: t("map.zoomIn"), icon: Plus, factor: 1.6 },
              { label: t("map.zoomOut"), icon: Minus, factor: 1 / 1.6 },
              { label: t("map.reset"), icon: Maximize2, factor: 0 },
            ] as const
          ).map(({ label, icon: Icon, factor }) => (
            <button
              key={label}
              type="button"
              onClick={() => zoomButton(factor)}
              title={label}
              aria-label={label}
              className="group grid h-9 w-9 place-items-center rounded-xl border border-line sheet shadow-sm transition-all hover:border-accent/30"
            >
              <Icon className="h-4 w-4 text-muted group-hover:text-accent" />
            </button>
          ))}
        </div>

        {/*
          The dock: the turn's length over the layers over the modes, a stair from five to eight, folded to the
          right with only the length and the mode chosen showing; a hover or a focus unfolds it (dock, globals.css).
        */}
        <div className="dock flex flex-col items-end">
          {controls}

          {/* What is drawn over the land, one tap each; every layer, base map included, is also in the layers menu (narrow maps have only that). */}
          <div className="dock-row hidden @md:block">
          <div role="group" aria-label={t("map.layers.quick")} className="flex items-center rounded-xl border border-line sheet p-1 shadow-sm">
            {QUICK_LAYERS.map((layer) => {
              const Icon = LAYER_ICONS[layer];
              const forced = forcedLayer(layer);
              const on = forced || layers[layer];
              const label = t(`map.layer.${layer}` as MessageKey);
              return (
                <button
                  key={layer}
                  type="button"
                  aria-pressed={on}
                  aria-label={label}
                  disabled={forced}
                  onClick={() => setLayer(layer, !layers[layer])}
                  className={`group dock-item relative grid h-7 w-7 place-items-center rounded-lg transition-all disabled:opacity-60 @md:h-8 @md:w-8 ${on ? ui.segmentOn : ui.segmentOff}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {!on && <span aria-hidden className="pointer-events-none absolute h-px w-5 -rotate-45 rounded-full bg-current" />}
                  <span className="pointer-events-none absolute bottom-full right-0 mb-1.5 hidden whitespace-nowrap rounded-lg border border-line sheet px-2 py-1 text-2xs font-bold text-ink shadow-sm group-hover:block group-focus-visible:block">
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
          </div>

          {layersOpen && (
            <div className="mt-1.5 w-56 rounded-xl border border-line sheet p-1.5 shadow-lg shadow-shade/10">
              {MAP_LAYERS.map((layer, i) => {
                const forced = forcedLayer(layer);
                const Icon = LAYER_ICONS[layer];
                // The base map's layers after a line.
                const base = i === QUICK_LAYERS.length;
                return (
                  <label
                    key={layer}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-bold text-ink transition-colors hover:bg-page ${forced ? "opacity-60" : ""} ${base ? "mt-1 border-t border-divider pt-2" : ""}`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0 text-muted" />
                    <span className="min-w-0 flex-1">{t(`map.layer.${layer}` as MessageKey)}</span>
                    <input type="checkbox" className="h-3.5 w-3.5 accent-current" checked={forced || layers[layer]} disabled={forced} onChange={(e) => setLayer(layer, e.target.checked)} />
                  </label>
                );
              })}
            </div>
          )}

          {mode === "resources" && (
            <select
              value={resource}
              onChange={(e) => updateSettings({ resource: e.target.value as ResourceType | "all" })}
              aria-label={t("map.mode.resources")}
              className="mt-1.5 rounded-lg border border-line sheet px-2 py-1 text-xs font-bold text-ink outline-none focus:border-ink"
            >
              <option value="all">{t("map.resource.all")}</option>
              {RESOURCE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {resourceName(type)}
                </option>
              ))}
            </select>
          )}
          <div className="mt-1.5 flex items-center rounded-xl border border-line sheet p-1 shadow-sm">
            {MAP_MODES.map((m) => {
              const Icon = MODE_ICONS[m];
              const label = t(`map.mode.${m}` as MessageKey);
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => updateSettings({ mode: m })}
                  title={label}
                  aria-label={label}
                  aria-pressed={mode === m}
                  className={`grid h-7 w-7 place-items-center rounded-lg transition-all @md:h-8 @md:w-8 ${mode === m ? "ml-0.5 bg-ink text-on-ink" : "dock-item text-muted hover:bg-page hover:text-ink"}`}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setLayersOpen((open) => !open)}
              title={t("map.layers")}
              aria-label={t("map.layers")}
              aria-expanded={layersOpen}
              className={`ml-0.5 grid h-7 w-7 place-items-center rounded-lg border-l border-line transition-all @md:h-8 @md:w-8 ${layersOpen ? "bg-divider text-ink" : "text-muted hover:bg-page hover:text-ink"}`}
            >
              <Layers className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The sides the diplomatic view's legend names, in its order; a truce shares the pact's colour. */
const LEGEND_SIDES: [Side, MessageKey][] = [
  ["ally", "map.legend.ally"],
  ["partner", "map.legend.partner"],
  ["enemy", "map.legend.enemy"],
  ["pact", "map.legend.pact"],
];

interface RegionsProps {
  shapes: { id: string; d: string; props: MapRegion }[];
  regions: Record<string, RegionState>;
  countries: Record<string, MapCountry>;
  mode: MapMode;
  resource: ResourceType | "all";
  year: number;
  hatch: string;
  /** Id prefix of the contested patterns; the contesting tag completes it. */
  contestPrefix: string;
  /** Contested provinces drawn split along the front, without stripes. */
  split: Set<string>;
  /** In the diplomatic view, each country's side towards the one it is about. */
  sides?: Record<string, Side>;
}

/** The colour of a province in a mode. */
function fillOf(props: MapRegion, region: RegionState | undefined, countries: Record<string, MapCountry>, mode: MapMode, resource: ResourceType | "all", year: number, sides?: Record<string, Side>): string {
  const holderColor = region ? countries[region.controller]?.color : undefined;
  switch (mode) {
    case "diplomacy":
      // Who holds the land, by their side towards the country the view is about; the rest is quiet.
      return sideFill(region ? sides?.[region.controller] : undefined);
    case "terrain":
      return TERRAIN_COLORS[props.terrain];
    case "fertility":
      return fertilityColor(props.fertility);
    case "population":
      return densityColor(populationDensity({ pop: peopleIn(region, props), area: props.area }));
    case "resources": {
      // Grey land; a province with resources takes the colour of its main one (or of the one picked).
      if (resource === "all") {
        const top = activeResources(props, year)[0];
        return top ? resourceTint(RESOURCE_COLORS[top.type], top.output, 18) : QUIET_LAND;
      }
      return resourceTint(RESOURCE_COLORS[resource], resourceOutput(props, resource, year));
    }
    case "transport":
      // Grey land, so the railways and ports stand out; the borders tell the countries apart.
      return QUIET_LAND;
    default:
      return holderColor ? softened(holderColor) : "var(--line)";
  }
}

/** The filled provinces; memoised so panning only moves the group transform. */
const Regions = memo(function Regions({ shapes, regions, countries, mode, resource, year, hatch, contestPrefix, split, sides }: RegionsProps) {
  const hatched = mode === "political" || mode === "transport";
  // One path per province; the hatching of occupied ones is a separate,
  // click-through layer, so the map holds as few elements as it can.
  return (
    <g>
      {shapes.map((s) => (
        <path key={s.id} d={s.d} data-region={s.id} style={{ fill: fillOf(s.props, regions[s.id], countries, mode, resource, year, sides) }} className="cursor-pointer hover:brightness-110" />
      ))}
      {hatched && (
        <g pointerEvents="none">
          {shapes.map((s) => {
            const r = regions[s.id];
            return r && r.controller !== r.owner ? <path key={s.id} d={s.d} fill={hatch} /> : null;
          })}
          {shapes.map((s) => {
            const r = regions[s.id];
            return r?.contested && !split.has(s.id) ? <path key={`c-${s.id}`} d={s.d} fill={`url(#${contestPrefix}${r.contested}-${shareBand(r.held)})`} /> : null;
          })}
        </g>
      )}
    </g>
  );
});

/** The places whose names fit, with their dots; quiet markers, the capitals a ring. Each is drawn in pixels around its point (see zoomVars). */
const Places = memo(function Places({ placed }: { placed: PlacedLabel[] }) {
  return (
    <g pointerEvents="none">
      {placed.map(({ place: c, side }, i) => {
        const capital = c.kind === "capital";
        const { font } = PLACE_STYLE[c.kind];
        const r = dotRadius(c);
        const gap = labelGap(r);
        const at =
          side === "left"
            ? { x: -gap, y: 0, anchor: "end" as const }
            : side === "above"
              ? { x: 0, y: -gap - font * 0.45, anchor: "middle" as const }
              : side === "below"
                ? { x: 0, y: gap + font * 0.5, anchor: "middle" as const }
                : { x: gap, y: 0, anchor: "start" as const };
        return (
          <g key={i} style={pin(c.px, c.py)}>
            {capital ? (
              <>
                <circle r={r} fill="none" stroke="var(--map-text)" strokeOpacity={0.6} strokeWidth={0.9} />
                <circle r={r * 0.45} fill="var(--map-text)" fillOpacity={0.6} />
              </>
            ) : (
              <circle r={r} fill="var(--map-text)" fillOpacity={c.kind === "city" ? 0.5 : 0.35} />
            )}
            {side && (
              <text
                x={at.x}
                y={at.y}
                fontSize={font}
                textAnchor={at.anchor}
                dominantBaseline="middle"
                fill="var(--map-text)"
                fillOpacity={capital ? 0.85 : c.kind === "city" ? 0.75 : 0.62}
                className={capital ? "font-semibold" : "font-medium"}
                style={{ paintOrder: "stroke", stroke: "var(--map-glow)", strokeWidth: font / 6, strokeLinejoin: "round" }}
              >
                {c.name}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
});

"use client";

import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature, merge, mesh, neighbors as topoNeighbors } from "topojson-client";
import { Anchor, Flag, Flame, Gem, Layers, Maximize2, Megaphone, Minus, Mountain, Plus, TrainFront, Users, Wheat, X, type LucideIcon } from "lucide-react";
import { memo, useEffect, useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { Feature, FeatureCollection, MultiLineString, MultiPolygon, Point, Polygon } from "geojson";
import type { GeometryObject } from "topojson-specification";
import { useI18n } from "@/i18n/useI18n";
import type { MessageKey } from "@/i18n/messages";
import type { RegionTopology } from "@/lib/maps";
import { peopleIn } from "@/engine/population";
import { populationDensity, provinceName, railLevel } from "@/engine/provinces";
import { activeResources, RESOURCE_TYPES, resourceOutput, type ResourceType } from "@/engine/resources";
import type { AppliedChange, MapRegion, Protest, RegionState, ScenarioId, Text, Localized } from "@/engine/types";
import { useCities, useTowns, useTransport, useWater } from "@/lib/assets";
import { MAP_LAYERS, MAP_MODES, useMapSettings, type MapMode } from "@/lib/mapSettings";
import { eraCities, eraTowns } from "./cities";
import { layoutPlaces, PLACE_STYLE, PlaceIndex, placeRadius, type PlacedLabel, type PlacePoint } from "./places";
import { DENSITY_STOPS, densityColor, fertilityColor, QUIET_LAND, RESOURCE_COLORS, resourceTint, softened, TERRAIN_COLORS } from "./colors";
import { riverName } from "./rivers";
import { DEFAULT_HELD } from "@/engine/outcome";
import { adjustTaken, mergePlaces } from "@/engine/towns";
import { arrowPath, countryLabels, insideRings, pathRings, splitByTowns, splitProvince, turnMoves } from "./overlays";

/** The SVG is drawn in this coordinate box and scaled to fit its container. */
const W = 1000;
const H = 540;
const MIN_ZOOM = 1;
const MAX_ZOOM = 24;
/** Detail grows with zoom: from the whole world down, fronts appear first, then province borders. */
const FRONTS_FROM = 2;
const PROVINCES_FROM = 2.6;

export interface MapCountry {
  name: Text;
  color: string;
}

const MODE_ICONS: Record<MapMode, LucideIcon> = {
  political: Flag,
  terrain: Mountain,
  fertility: Wheat,
  population: Users,
  resources: Gem,
  transport: TrainFront,
};

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
  wars?: { attackers: string[]; defenders: string[]; truce?: unknown }[];
  /** A turn's changes to show: provinces that changed hands and arrows; a new key replays the highlight. */
  changes?: { key: string | number; applied: AppliedChange[]; turn: number; onLatest?: () => void; onShow?: () => void } | null;
  /** City names proclaimed in play, by their English map name. */
  placeNames?: Record<string, Localized>;
  /** Protests against the player's government, marked where they are strongest. */
  protests?: Protest[];
  /** Brings these provinces, or a country's home land, into view whenever the key changes. */
  focus?: { key: string | number; regions?: string[]; country?: string } | null;
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
 * The province map. Modes colour the land by holder, terrain, fertility,
 * population density, resource output (on grey land) or grey for transport; rivers,
 * railways, ports, cities and province borders are overlays. Places and lines
 * appear as the zoom grows. Wheel or pinch zooms around the pointer, drag
 * pans, a click picks the province and its sovereign.
 */
export default function WorldMap({ topology, regions, countries, selected, selectedProvince, player, era, year, onSelect, wars, changes, protests, focus, className, placeNames }: WorldMapProps) {
  const { text, t, locale, people } = useI18n();
  const uid = useId().replace(/:/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  // ViewBox units per screen pixel: names, dots and markers are sized in
  // pixels, so they read the same on a wide map and beside open panels.
  const [unit, setUnit] = useState(1);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const measure = () => {
      const { width, height } = svg.getBoundingClientRect();
      if (width > 0 && height > 0) setUnit(1 / Math.min(width / W, height / H));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);
  const groupRef = useRef<SVGGElement>(null);
  const hatchRef = useRef<SVGPatternElement>(null);
  // The committed view drives React; during a gesture the drawing moves
  // directly with `live` and React catches up once the gesture pauses.
  const [view, setView] = useState<View>({ k: 1, x: 0, y: 0 });
  const live = useRef<View>(view);
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [settings, updateSettings] = useMapSettings();
  const { mode, resource, layers } = settings;
  const [layersOpen, setLayersOpen] = useState(false);
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const showRail = mode === "transport" || layers.railways;
  const showPorts = mode === "transport" || layers.ports;
  const water = useWater();
  const cities = useCities();
  const transport = useTransport(showRail || showPorts);
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

  /** The era's places and GeoNames' towns, projected and indexed; names as they were on the start date. */
  const placeIndex = useMemo(() => {
    const points: PlacePoint[] = [];
    const add = (list: ReturnType<typeof eraCities>) => {
      for (const c of list) {
        const p = geometry.projection([c.x, c.y]);
        if (p) points.push({ name: c.name, px: p[0], py: p[1], kind: c.kind, minZoom: c.minZoom, priority: c.priority, r: placeRadius(c.kind, c.pop) });
      }
    };
    if (cities) add(eraCities(cities, era, locale, placeNames));
    if (towns) add(eraTowns(towns, era, locale));
    return new PlaceIndex(points);
  }, [cities, towns, era, locale, geometry, placeNames]);

  /** Resource bubbles: the province's top three, or the picked resource alone; big ones under small ones. */
  const bubbles = useMemo(() => {
    if (mode !== "resources") return [];
    const out: { key: string; type: ResourceType; output: number; x: number; y: number; slot: number; slots: number; widest: number }[] = [];
    for (const s of geometry.shapes) {
      if (!Number.isFinite(s.c[0])) continue;
      const list = activeResources(s.props, year)
        .filter((r) => resource === "all" || r.type === resource)
        .slice(0, 3);
      const widest = list.length ? bubbleRadius(list[0].output) : 0;
      list.forEach((r, slot) => out.push({ key: `${s.id}-${r.type}`, ...r, x: s.c[0], y: s.c[1], slot, slots: list.length, widest }));
    }
    return out.sort((a, b) => b.output - a.output);
  }, [mode, resource, geometry, year]);

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
    const out: { id: string; truce: boolean; outline: string; land: string; inside: string }[] = [];
    for (const w of wars) {
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
      out.push({ id: `${w.attackers.join("+")}-${w.defenders.join("+")}`, truce: Boolean(w.truce), outline, land: merged(d, new Set()) + ofD, inside: ofA });
    }
    return out.length ? out : null;
  }, [wars, layers.fronts, topology, regions, geometry, splits]);
  const frontKinds = { war: view.k >= FRONTS_FROM && Boolean(fronts?.some((f) => !f.truce)), truce: view.k >= FRONTS_FROM && Boolean(fronts?.some((f) => f.truce)) };

  /** The shown turn: provinces that changed hands and the pushes behind them. */
  const turn = useMemo(() => {
    if (!changes || !layers.changes) return null;
    return turnMoves(changes.applied, regions, (id) => geometry.centres.get(id), (id) => adjacency.byId.get(id) ?? []);
  }, [changes, layers.changes, regions, geometry, adjacency]);

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
    live.current = v;
    groupRef.current?.setAttribute("transform", `translate(${v.x} ${v.y}) scale(${v.k})`);
    hatchRef.current?.setAttribute("patternTransform", `rotate(45) scale(${1 / v.k})`);
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
      setHover(target ? { id: target.getAttribute("data-region")!, x: e.clientX - box.left, y: e.clientY - box.top } : null);
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
    const v = live.current;
    showView(clampView({ k: v.k, x: v.x + dx, y: v.y + dy }), "soon");
  };

  const onPointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    const wasClick = gesture.current.moved < 5 && pointers.current.size === 1;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) gesture.current.pinch = undefined;
    if (!wasClick) showView(live.current, "now");
    if (!wasClick || !onSelect) return;
    const target = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-region]");
    const id = target?.getAttribute("data-region") ?? null;
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
  const labelScale = 1 / Math.sqrt(k);
  // What is on screen, in map units, with a margin: places outside are not drawn.
  const margin = 30 / k;
  const onScreen = (x: number, y: number) =>
    x >= -view.x / k - margin && x <= (W - view.x) / k + margin && y >= -view.y / k - margin && y <= (H - view.y) / k + margin;
  const transportMode = mode === "transport";

  /** Names that fit: country names first, then places by importance (see places.ts). */
  const placed = useMemo((): PlacedLabel[] => {
    if (!layers.cities) return [];
    const kk = view.k;
    const obstacles: [number, number, number, number][] = [];
    if (mode === "political" || mode === "transport") {
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
  }, [layers.cities, view, mode, labels, countries, text, placeIndex, unit]);
  const resourceName = (type: ResourceType) => t(`resource.${type}` as MessageKey);

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
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label="World map"
      >
        <defs>
          {/* The hatch lives in the zoomed group's space; scaling it back keeps the stripes thin at any zoom. */}
          <pattern ref={hatchRef} id={`hatch-${uid}`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform={`rotate(45) scale(${1 / k})`}>
            <line x1="0" y1="0" x2="0" y2="4" stroke="rgba(20,20,20,0.22)" strokeWidth="0.9" />
          </pattern>
          {/* Contested provinces: stripes in the colour of the side holding part of them. */}
          {contesters.map(([tag, band]) => (
            <pattern key={`${tag}-${band}`} id={`contest-${uid}-${tag}-${band}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform={`rotate(-45) scale(${1 / k})`}>
              {/* Stripes as wide as the share the other side holds: a sliver at a quarter, nearly solid near all of it. */}
              <line x1="3" y1="0" x2="3" y2="6" stroke={countries[tag]?.color ?? "rgba(20,20,20,0.5)"} strokeWidth={(Number(band) / 4) * 5.4} strokeOpacity="0.95" />
            </pattern>
          ))}
        </defs>
        <rect width={W} height={H} fill="var(--sea)" />
        <g ref={groupRef} transform={`translate(${view.x} ${view.y}) scale(${k})`}>
          <path d={geometry.sphere} fill="var(--sea)" stroke="none" />
          <Regions shapes={geometry.shapes} regions={regions} countries={countries} mode={mode} resource={resource} year={year} hatch={`url(#hatch-${uid})`} contestPrefix={`contest-${uid}-`} split={splitIds} />
          {(mode === "political" || transportMode) && splits.size > 0 && (
            <g pointerEvents="none">
              {[...splits].map(([id, sp]) => {
                const color = countries[sp.by]?.color;
                const fill = transportMode ? "var(--map-quiet)" : softened(color);
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
            </g>
          ))}
          {bubbles.length > 0 && (
            <g pointerEvents="none">
              {bubbles.map((b) => {
                if (!onScreen(b.x, b.y)) return null;
                const r = (bubbleRadius(b.output) * unit) / k;
                const gap = ((b.widest * 2 + 1.5) * unit) / k;
                const cx = b.x + (b.slot - (b.slots - 1) / 2) * gap;
                return (
                  <g key={b.key}>
                    <circle cx={cx} cy={b.y} r={r + (1.4 * unit) / k} fill="var(--map-halo)" />
                    <circle cx={cx} cy={b.y} r={r} fill={RESOURCE_COLORS[b.type]} stroke="var(--map-line)" strokeOpacity={0.55} strokeWidth={(0.8 * unit) / k} />
                    {resource !== "all" && k >= 3 && (
                      <text
                        x={cx}
                        y={b.y}
                        fontSize={Math.max(6 * unit, r * k * 0.9) / k}
                        textAnchor="middle"
                        dominantBaseline="central"
                        className="fill-ink font-black"
                        style={{ paintOrder: "stroke", stroke: "var(--map-halo)", strokeWidth: 2 / k }}
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
                const s = (9 * unit) / k;
                return (
                  <g key={i}>
                    <circle cx={p.px} cy={p.py} r={s * 0.62} fill="var(--surface)" stroke="var(--river)" strokeWidth={0.8 / k} />
                    <Anchor x={p.px - s * 0.38} y={p.py - s * 0.38} width={s * 0.76} height={s * 0.76} color="var(--river)" strokeWidth={2.6} />
                    {k >= (p.rank <= 5 ? 6 : 9) && (
                      <text
                        x={p.px + s * 0.85}
                        y={p.py}
                        fontSize={(9 * unit) / k}
                        dominantBaseline="middle"
                        fill="var(--river)"
                        className="font-semibold italic"
                        style={{ paintOrder: "stroke", stroke: "var(--map-glow)", strokeWidth: (1.5 * unit) / k }}
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
              {turn.moves.map((m) => {
                const head = ((10 + Math.min(m.count, 6)) * unit) / k;
                const { line, tip } = arrowPath(m.to, m.from, head);
                const color = countries[m.by]?.color ?? "var(--ink)";
                const width = 3 + Math.min(m.count, 6) * 0.4;
                // The mover's colour inside a dark outline: an arrow stays readable over its own side's land.
                return (
                  <g key={m.key}>
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
                    <path d={tip} fill={color} stroke="var(--ink)" strokeOpacity={0.75} strokeWidth={1.4} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                  </g>
                );
              })}
            </g>
          )}
          {mode === "political" && protests && protests.length > 0 && (
            <g pointerEvents="none">
              {protests.flatMap((p) =>
                p.where.map((id) => {
                  const c = geometry.centres.get(id);
                  if (!c || !Number.isFinite(c[0])) return null;
                  const violent = p.stage === "riot" || p.stage === "uprising";
                  const s = ((p.stage === "uprising" ? 30 : violent ? 26 : 22) * unit) / k;
                  const Icon = violent ? Flame : Megaphone;
                  return (
                    <g key={`${p.id}-${id}`}>
                      <title>{p.title}</title>
                      <circle cx={c[0]} cy={c[1]} r={s * 0.82} fill="var(--war)" fillOpacity={0.18} stroke="var(--war)" strokeOpacity={0.55} strokeWidth={(1.2 * unit) / k} />
                      <circle cx={c[0]} cy={c[1]} r={s * 0.62} fill={violent ? "var(--war)" : "var(--surface)"} stroke={violent ? "var(--surface)" : "var(--war)"} strokeWidth={(2 * unit) / k} />
                      <Icon x={c[0] - s * 0.36} y={c[1] - s * 0.36} width={s * 0.72} height={s * 0.72} color={violent ? "var(--map-glow)" : "var(--war)"} strokeWidth={2.4} />
                    </g>
                  );
                }),
              )}
            </g>
          )}
          {placed.length > 0 && <Places placed={placed} k={k} unit={unit} />}
          {(mode === "political" || transportMode) && (
            <g pointerEvents="none">
              {labels.map((l) => {
                // Shown once the land is big enough on screen to hold its name.
                if (l.size * k < 34) return null;
                const size = Math.min(15, Math.max(4, l.size / 7)) * labelScale;
                const country = countries[l.tag];
                return (
                  <text
                    key={l.tag}
                    x={l.x}
                    y={l.y}
                    fontSize={size}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="var(--map-text)"
                    fillOpacity={l.tag === player ? 0.85 : 0.6}
                    className="font-semibold uppercase"
                    style={{ paintOrder: "stroke", stroke: "var(--map-glow)", strokeWidth: size / 6, strokeLinejoin: "round", letterSpacing: size / 10 }}
                  >
                    {text(country?.name ?? l.tag)}
                  </text>
                );
              })}
            </g>
          )}
        </g>
      </svg>

      {mode === "political" && (frontKinds.war || frontKinds.truce || (turn && turn.changed.size > 0)) && (
        <div className="absolute left-3 top-3 flex max-w-[16rem] flex-col gap-1 rounded-xl border border-line bg-surface/90 p-2.5 shadow-sm backdrop-blur @lg:bottom-3 @lg:top-auto">
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
        <div className="absolute left-3 top-3 max-w-[15rem] rounded-xl border border-line bg-surface/90 p-2.5 shadow-sm backdrop-blur @lg:bottom-3 @lg:top-auto @lg:max-w-[17rem]">
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
                <span className="grid h-3.5 w-3.5 place-items-center rounded-full border border-line bg-surface">
                  <Anchor className="h-2.5 w-2.5" color="var(--river)" />
                </span>
                {t("map.legend.port")}
              </span>
            </div>
          )}
        </div>
      )}

      {hover && hovered && hoveredProps && (
        <div
          className="pointer-events-none absolute z-10 max-w-64 rounded-xl border border-line bg-surface/95 px-3 py-2 text-xs shadow-lg shadow-shade/10 backdrop-blur"
          style={{ left: hover.x + 14, top: hover.y + 14 }}
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
              className="group grid h-9 w-9 place-items-center rounded-xl border border-line bg-surface/90 shadow-sm backdrop-blur transition-all hover:border-accent/30"
            >
              <Icon className="h-4 w-4 text-muted group-hover:text-accent" />
            </button>
          ))}
        </div>

        {layersOpen && (
          <div className="w-52 rounded-xl border border-line bg-surface/95 p-1.5 shadow-lg shadow-shade/10 backdrop-blur">
            {MAP_LAYERS.map((layer) => {
              const forced = transportMode && (layer === "railways" || layer === "ports");
              return (
                <label
                  key={layer}
                  className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs font-bold text-ink transition-colors hover:bg-page ${forced ? "opacity-60" : ""}`}
                >
                  {t(`map.layer.${layer}` as MessageKey)}
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-current"
                    checked={forced || layers[layer]}
                    disabled={forced}
                    onChange={(e) => updateSettings({ layers: { ...layers, [layer]: e.target.checked } })}
                  />
                </label>
              );
            })}
          </div>
        )}

        <div className="flex flex-col items-end gap-1 rounded-xl border border-line bg-surface/90 p-1 shadow-sm backdrop-blur">
          {mode === "resources" && (
            <select
              value={resource}
              onChange={(e) => updateSettings({ resource: e.target.value as ResourceType | "all" })}
              aria-label={t("map.mode.resources")}
              className="w-full rounded-lg border border-line bg-surface px-2 py-1 text-xs font-bold text-ink outline-none focus:border-ink"
            >
              <option value="all">{t("map.resource.all")}</option>
              {RESOURCE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {resourceName(type)}
                </option>
              ))}
            </select>
          )}
          <div className="flex items-center gap-0.5">
            <span className="hidden px-1.5 text-2xs font-black uppercase tracking-wider text-ink @2xl:inline">{t(`map.mode.${mode}` as MessageKey)}</span>
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
                  className={`grid h-7 w-7 place-items-center rounded-lg @md:h-8 @md:w-8 transition-all ${mode === m ? "bg-ink text-on-ink" : "text-muted hover:bg-page hover:text-ink"}`}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
            <span className="mx-0.5 h-5 w-px bg-line" />
            <button
              type="button"
              onClick={() => setLayersOpen((open) => !open)}
              title={t("map.layers")}
              aria-label={t("map.layers")}
              aria-expanded={layersOpen}
              className={`grid h-7 w-7 place-items-center rounded-lg @md:h-8 @md:w-8 transition-all ${layersOpen ? "bg-divider text-ink" : "text-muted hover:bg-page hover:text-ink"}`}
            >
              <Layers className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

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
}

/** The colour of a province in a mode. */
function fillOf(props: MapRegion, region: RegionState | undefined, countries: Record<string, MapCountry>, mode: MapMode, resource: ResourceType | "all", year: number): string {
  const holderColor = region ? countries[region.controller]?.color : undefined;
  switch (mode) {
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
const Regions = memo(function Regions({ shapes, regions, countries, mode, resource, year, hatch, contestPrefix, split }: RegionsProps) {
  const hatched = mode === "political" || mode === "transport";
  // One path per province; the hatching of occupied ones is a separate,
  // click-through layer, so the map holds as few elements as it can.
  return (
    <g>
      {shapes.map((s) => (
        <path key={s.id} d={s.d} data-region={s.id} style={{ fill: fillOf(s.props, regions[s.id], countries, mode, resource, year) }} className="cursor-pointer hover:brightness-110" />
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

/** The places whose names fit, with their dots; quiet markers, the capitals a ring. */
const Places = memo(function Places({ placed, k, unit }: { placed: PlacedLabel[]; k: number; unit: number }) {
  return (
    <g pointerEvents="none">
      {placed.map(({ place: c, side }, i) => {
        const capital = c.kind === "capital";
        const { font: fs } = PLACE_STYLE[c.kind];
        const r = (c.r * unit) / k;
        const font = (fs * unit) / k;
        const gap = r * 1.7;
        const at =
          side === "left"
            ? { x: c.px - gap, y: c.py, anchor: "end" as const }
            : side === "above"
              ? { x: c.px, y: c.py - gap - font * 0.45, anchor: "middle" as const }
              : side === "below"
                ? { x: c.px, y: c.py + gap + font * 0.5, anchor: "middle" as const }
                : { x: c.px + gap, y: c.py, anchor: "start" as const };
        return (
          <g key={i}>
            {capital ? (
              <>
                <circle cx={c.px} cy={c.py} r={r} fill="none" stroke="var(--map-text)" strokeOpacity={0.6} strokeWidth={(0.9 * unit) / k} />
                <circle cx={c.px} cy={c.py} r={r * 0.45} fill="var(--map-text)" fillOpacity={0.6} />
              </>
            ) : (
              <circle
                cx={c.px}
                cy={c.py}
                r={r}
                fill="var(--map-text)"
                fillOpacity={c.kind === "city" ? 0.5 : 0.35}
              />
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

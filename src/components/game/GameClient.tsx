"use client";

import Link from "next/link";
import { Briefcase, Clapperboard, Coins, Crosshair, Download, Eye, EyeOff, Flag as ReportIcon, FlaskConical, Globe, Image as ImageIcon, Landmark, Loader2, MapPin, Megaphone, MessageSquare, PanelLeftClose, Play, Scale, ScrollText, Swords, TriangleAlert, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AppHeader from "@/components/AppHeader";
import Flag from "@/components/Flag";
import WorldMap from "@/components/map/WorldMap";
import { changedRegions } from "@/components/map/overlays";
import Dialog from "@/components/ui/Dialog";
import { ui } from "@/components/ui/classes";
import { addStep, formatDate, yearOf } from "@/engine/calendar";
import { CONTENT_REPORT_URL, MAX_ORDERS as MAX_TURN_ORDERS } from "@/constants/app";
import { coupRiskIn, lostShares } from "@/engine/abroad";
import { borderingPlayer, fogOn, foreignView } from "@/engine/fog";
import { addAdvice, type AdvisorId } from "@/engine/advisors";
import { countryCrises } from "@/engine/crises";
import { nationalAccounts, seedEconomies, setBudget } from "@/engine/economy";
import { setFocus as setArmsFocus } from "@/engine/arsenal";
import { setShares } from "@/engine/research";
import { setSanction } from "@/engine/trade";
import { cancelDeal, declineOffer, proposeDeal, signOffer } from "@/engine/deals";
import EconomyCenter from "./EconomyCenter";
import ArmyPanel from "./ArmyPanel";
import SciencePanel from "./SciencePanel";
import { addDiplomacyExchange } from "@/engine/diplomacy";
import { applyOutcome, ownedRegions } from "@/engine/outcome";
import { proclaim } from "@/engine/identity";
import { addLegal, proposeBill, withdrawBill } from "@/engine/acts";
import { isMigrated, migrateSave, refreshSave } from "@/engine/migrations";
import { peopleByOwner, provinceName } from "@/engine/provinces";
import { intoOpposition, isOpposition, withCountry } from "@/engine/role";
import { getScenario } from "@/engine/scenarios";
import { peopleScale } from "@/engine/setup";
import type { ChronicleEntry, GameState, OfficialPost, Summit, TimeStep } from "@/engine/types";
import { errorKey, useI18n } from "@/i18n/useI18n";
import { ApiError, askAdvisor, askChiefOfActs, findCandidates, playTurn, requestReport, sendDiplomacy, setupDeputies, setupPolitics, summitClose, summitTalk } from "@/lib/api";
import { seedInterests } from "@/engine/interests";
import { applyMinisterReport, reportsDue, type MinisterReport } from "@/engine/reports";
import LiveSummitDialog from "./LiveSummitDialog";
import { ADVISOR_POST, appoint, type Candidate } from "@/engine/government";
import { addDeputyAdvice, startDeputies } from "@/engine/deputies";
import { useMap } from "@/lib/maps";
import { usePreference } from "@/lib/preferences";
import { chronicleMarkdown, downloadFile } from "@/lib/exports";
import { loadSave, writeSave } from "@/lib/saves";
import { readNewTurn } from "@/lib/voice/speaker";
import VoiceLayer from "@/components/voice/VoiceLayer";
import { useGameMaster } from "@/lib/gameMaster";
import GameMasterChoice, { GameMasterOffer } from "@/components/GameMasterChoice";
import { PortraitYear } from "./Portrait";
import CountryDetails from "./CountryDetails";
import LeaderButton from "./LeaderButton";
import OppositionPanel from "./OppositionPanel";
import DefeatDialog from "./DefeatDialog";
import CabinetPanel, { type ReportStatus } from "./CabinetPanel";
import DiplomacyPanel from "./DiplomacyPanel";
import ForeignPanel from "./ForeignPanel";
import { closeSummit, conveneSummit, speakAtSummit } from "@/engine/foreign";
import PoliticsPanel from "./PoliticsPanel";
import StatePanel, { type CityChoice } from "./StatePanel";
import Tour, { tourSeen } from "./Tour";
import SummitDialog from "./SummitDialog";
import OrdersPanel from "./OrdersPanel";
import ProvinceDetails from "./ProvinceDetails";
import ResourceBar from "./ResourceBar";
import TurnQuote from "./TurnQuote";
import SharePicture from "./SharePicture";
import Timelapse from "./Timelapse";
import TurnReport from "./TurnReport";
import WorldNews from "./WorldNews";

/** Panels that open on the left, from the rail; the right side shows the selection. */
type LeftPanel = "orders" | "opposition" | "chronicle" | "cabinet" | "politics" | "state" | "foreign" | "economy" | "army" | "science";
type RightTab = "country" | "diplomacy";

interface Busy {
  kind: "turn" | "diplomacy" | "advice" | "acts" | "politics" | "candidates" | "summit" | "deputies" | "deputy";
  /** The minister being asked, for "advice"; the ministry, for "deputies" and "deputy". */
  advisor?: AdvisorId;
  /** The deputy being spoken to in private, for "deputy". */
  deputy?: string;
  chars: number;
  startedAt: number;
  controller: AbortController;
}

function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return <span className="tabular-nums">{Math.max(0, Math.round((now - since) / 1000))} s</span>;
}

/**
 * The game screen: the state of the nation along the top, a rail on the left
 * that opens orders, the chronicle or the cabinet, the map in the middle, and
 * the selected country or diplomacy on the right. On a phone the map comes
 * first and one panel at a time fills the space below it.
 */
export default function GameClient({ id }: { id: string }) {
  const { t, text, locale } = useI18n();
  const [model] = usePreference("model");
  // ChatGPT, or the offline demo the player chose (lib/gameMaster.ts).
  const { status, ready: aiReady } = useGameMaster();
  const [choosingMaster, setChoosingMaster] = useState(false);
  const [state, setState] = useState<GameState | null>(null);
  const [missing, setMissing] = useState(false);
  const [left, setLeft] = useState<LeftPanel | null>("orders");
  const [right, setRight] = useState<RightTab>("country");
  // Summits held in the last turn open one by one before its report; any summit can be reread.
  const [summitQueue, setSummitQueue] = useState<string[]>([]);
  const [rereading, setRereading] = useState<Summit | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [openTurns, setOpenTurns] = useState<Set<number>>(new Set());
  // The chronicle shows the player's own turns, or the world's news (engine/news.ts).
  const [chronicleView, setChronicleView] = useState<"ours" | "world">("ours");
  const [diplomacyTarget, setDiplomacyTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy | null>(null);
  // A question for a minister prepared elsewhere (a protest abroad, a plot): the cabinet opens on it.
  const [consult, setConsult] = useState<{ advisor: AdvisorId; question: string; n: number } | null>(null);
  // The first-run tour, once the game has loaded.
  const [touring, setTouring] = useState(false);
  const [report, setReport] = useState<ChronicleEntry | null>(null);
  // A turn being made into a picture, and the timelapse of the whole game.
  const [picture, setPicture] = useState<ChronicleEntry | null>(null);
  const [timelapse, setTimelapse] = useState(false);
  // The turn whose changes the map shows (null: the last one), a counter that
  // replays their highlight, and where the camera was last asked to go.
  const [mapTurn, setMapTurn] = useState<number | null>(null);
  const [pulse, setPulse] = useState(0);
  const [focus, setFocus] = useState<{ key: number; regions?: string[]; country?: string } | null>(null);
  // The meeting the player is holding in person, if any.
  const [live, setLive] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The ministers' views of the last turn, given in the background after it (engine/reports.ts).
  const [reporting, setReporting] = useState<Partial<Record<AdvisorId, ReportStatus>>>({});
  // Reports that have arrived: every update keeps them, so an answer begun before one arrived cannot drop it.
  const arrived = useRef(new Map<string, MinisterReport>());
  const latest = useRef<GameState | null>(null);
  const reportsRun = useRef<AbortController | null>(null);

  useEffect(() => {
    latest.current = state;
  }, [state]);
  useEffect(() => () => reportsRun.current?.abort(), []);

  useEffect(() => {
    let alive = true;
    loadSave(id).then((s) => {
      if (!alive) return;
      if (s) {
        // The save's migrations that need no map run now, the rest once the map is here.
        const scenario = getScenario(s.scenarioId);
        setState(refreshSave(migrateSave(s, { scenario }), scenario));
        setSelected(s.player);
        setTouring(!tourSeen());
      } else setMissing(true);
    });
    return () => {
      alive = false;
    };
  }, [id]);

  const scenario = state ? getScenario(state.scenarioId) : null;
  const { map } = useMap(scenario?.map ?? null);
  // The people a province had when the game began: a map drawn for a later year is scaled to the start date (engine/setup.ts).
  const startScale = useMemo(() => (scenario && map ? peopleScale(scenario, Object.values(map.index.regions)) : null), [scenario, map]);

  // The migrations that need the map run once it is here; a country still without an economy gets one.
  useEffect(() => {
    if (!state || !map || !scenario) return;
    const needsEconomy = Object.values(state.countries).some((c) => !c.economy);
    if (isMigrated(state) && !needsEconomy) return;
    const migrated = seedEconomies(migrateSave(state, { scenario, map: { regions: map.regions, byId: map.index.regions } }), map.index.regions);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time upgrade of loaded data
    setState(migrated);
    void writeSave(migrated);
  }, [state, map, scenario]);

  const persist = useCallback(
    async (next: GameState, immediate = false) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const run = async () => {
        try {
          await writeSave(next);
        } catch {
          setNotice(t("game.saveFailed"));
        }
      };
      if (immediate) await run();
      else saveTimer.current = setTimeout(run, 600);
    },
    [t],
  );

  const update = (next: GameState, immediate = false) => {
    const merged = [...arrived.current.values()].reduce((s, report) => applyMinisterReport(s, report), next);
    latest.current = merged;
    setState(merged);
    void persist(merged, immediate);
  };

  const explain = (error: unknown) => {
    if (error instanceof ApiError) {
      if (error.code === "cancelled") return null;
      const key = errorKey(error.code);
      return key ? t(key) : error.message || t("error.generic");
    }
    return t("error.generic");
  };


  /**
   * The ministers give their views of a turn one after another, in the
   * background: the game goes on meanwhile, and each report lands in its
   * minister's window as it comes. One that fails can be asked for again.
   */
  const writeReports = async (turn: number, ministries: AdvisorId[], fresh = false) => {
    if (!ministries.length) return;
    if (fresh) {
      // A new turn: the reports still owed on the one before are not waited for.
      reportsRun.current?.abort();
      reportsRun.current = null;
      setReporting({});
    }
    const run = (reportsRun.current ??= new AbortController());
    setReporting((r) => ({ ...r, ...Object.fromEntries(ministries.map((m) => [m, { turn, status: "writing", chars: 0 }])) }));
    for (const ministry of ministries) {
      const base = latest.current;
      if (!base || run.signal.aborted) return;
      try {
        const { report } = await requestReport(base, ministry, turn, {
          locale,
          model,
          signal: run.signal,
          onProgress: (chars) => setReporting((r) => (r[ministry] ? { ...r, [ministry]: { ...r[ministry]!, chars } } : r)),
        });
        if (report) {
          arrived.current.set(`${turn}:${ministry}`, report);
          if (latest.current) update(latest.current, true);
        }
        setReporting((r) => Object.fromEntries(Object.entries(r).filter(([m]) => m !== ministry)));
      } catch {
        if (run.signal.aborted) return;
        setReporting((r) => ({ ...r, [ministry]: { turn, status: "failed", chars: 0 } }));
      }
    }
  };

  const endTurn = async () => {
    if (!state || busy) return;
    // Standing orders go first, every turn; the turn's own follow.
    const orders = [...new Set([...(state.standing ?? []), ...state.draft])].slice(0, MAX_TURN_ORDERS);
    const controller = new AbortController();
    setNotice(null);
    setBusy({ kind: "turn", chars: 0, startedAt: Date.now(), controller });
    try {
      const { outcome } = await playTurn(state, orders, {
        locale,
        model,
        signal: controller.signal,
        onProgress: (chars) => setBusy((b) => (b ? { ...b, chars } : b)),
      });
      const next = applyOutcome(state, outcome, orders, new Date(), map?.index.regions ?? null);
      const entry = next.chronicle[next.chronicle.length - 1];
      // Reports written for an earlier try at this turn belong to another outcome.
      for (const [key, r] of arrived.current) if (r.turn >= entry.turn) arrived.current.delete(key);
      update(next, true);
      setSummitQueue(entry.summits ?? []);
      setReport(entry);
      if (!next.defeat || next.defeat.continued) void writeReports(entry.turn, reportsDue(entry), true);
      readNewTurn(entry, locale);
    } catch (error) {
      const message = explain(error);
      if (message) setNotice(message);
    } finally {
      setBusy(null);
    }
  };

  /** Shows a turn's changes on the map and brings them into view. */
  const showOnMap = (entry: ChronicleEntry) => {
    const last = state?.chronicle.at(-1)?.turn;
    setMapTurn(entry.turn === last ? null : entry.turn);
    setPulse((p) => p + 1);
    setFocus({ key: Date.now(), regions: changedRegions(entry.applied) });
  };

  const send = async (target: string, message: string) => {
    if (!state || busy) return false;
    const controller = new AbortController();
    setNotice(null);
    setBusy({ kind: "diplomacy", chars: 0, startedAt: Date.now(), controller });
    try {
      const { reply } = await sendDiplomacy(state, target, message, {
        locale,
        model,
        signal: controller.signal,
        onProgress: (chars) => setBusy((b) => (b ? { ...b, chars } : b)),
      });
      update(addDiplomacyExchange(state, target, message, reply), true);
      return true;
    } catch (error) {
      const text = explain(error);
      if (text) setNotice(text);
      return false;
    } finally {
      setBusy(null);
    }
  };

  const ask = async (advisor: AdvisorId, question: string, context?: string) => {
    if (!state || busy) return false;
    const controller = new AbortController();
    setNotice(null);
    setBusy({ kind: "advice", advisor, chars: 0, startedAt: Date.now(), controller });
    try {
      const { reply } = await askAdvisor(state, advisor, question, {
        locale,
        model,
        signal: controller.signal,
        onProgress: (chars) => setBusy((b) => (b ? { ...b, chars } : b)),
        context,
      });
      update(addAdvice(state, advisor, question, reply), true);
      return true;
    } catch (error) {
      const text = explain(error);
      if (text) setNotice(text);
      return false;
    } finally {
      setBusy(null);
    }
  };

  /** A ministry's deputies, named once by the game master; the dice deal the rest (engine/deputies.ts). */
  const setupDeputiesFor = async (advisor: AdvisorId) => {
    if (!state || busy) return;
    const controller = new AbortController();
    setNotice(null);
    setBusy({ kind: "deputies", advisor, chars: 0, startedAt: Date.now(), controller });
    try {
      const { deputies } = await setupDeputies(state, advisor, { locale, model, signal: controller.signal, onProgress: (chars) => setBusy((b) => (b ? { ...b, chars } : b)) });
      update({ ...startDeputies(state, ADVISOR_POST[advisor], { deputies }), updatedAt: new Date().toISOString() }, true);
    } catch (error) {
      const text = explain(error);
      if (text) setNotice(text);
    } finally {
      setBusy(null);
    }
  };

  /** A word in private with a deputy, behind their minister's back. */
  const askDeputy = async (advisor: AdvisorId, deputy: string, question: string) => {
    if (!state || busy) return false;
    const controller = new AbortController();
    setNotice(null);
    setBusy({ kind: "deputy", advisor, deputy, chars: 0, startedAt: Date.now(), controller });
    try {
      const { reply } = await askAdvisor(state, advisor, question, { locale, model, signal: controller.signal, onProgress: (chars) => setBusy((b) => (b ? { ...b, chars } : b)), deputy });
      update(addDeputyAdvice(state, deputy, question, reply), true);
      return true;
    } catch (error) {
      const text = explain(error);
      if (text) setNotice(text);
      return false;
    } finally {
      setBusy(null);
    }
  };

  /** A word with the chief of staff about acts of state; the drafts come with the answer. */
  const askActs = async (question: string, cities: CityChoice[]) => {
    if (!state || busy) return false;
    const controller = new AbortController();
    setNotice(null);
    setBusy({ kind: "acts", chars: 0, startedAt: Date.now(), controller });
    try {
      const { reply } = await askChiefOfActs(state, question, cities, {
        locale,
        model,
        signal: controller.signal,
        onProgress: (chars) => setBusy((b) => (b ? { ...b, chars } : b)),
      });
      update(addLegal(state, question, reply), true);
      return true;
    } catch (error) {
      const text = explain(error);
      if (text) setNotice(text);
      return false;
    } finally {
      setBusy(null);
    }
  };

  /** The parties, the people of the government, or both — whatever is asked and still missing comes in one request. */
  const setupGovernment = async (wanted: ("politics" | "officials")[]) => {
    if (!state || busy) return;
    const parts = [...new Set([...wanted, ...(state.politics?.parties.length ? [] : (["politics"] as const)), ...(state.officials?.length ? [] : (["officials"] as const))])];
    const controller = new AbortController();
    setNotice(null);
    setBusy({ kind: "politics", chars: 0, startedAt: Date.now(), controller });
    try {
      const { politics, officials } = await setupPolitics(state, parts, {
        locale,
        model,
        signal: controller.signal,
        onProgress: (chars) => setBusy((b) => (b ? { ...b, chars } : b)),
      });
      update(seedInterests({ ...state, ...(politics ? { politics } : {}), ...(officials?.length ? { officials } : {}), updatedAt: new Date().toISOString() }), true);
    } catch (error) {
      const text = explain(error);
      if (text) setNotice(text);
    } finally {
      setBusy(null);
    }
  };

  /** The player speaks at a meeting held in person; the others answer. */
  const speakLive = async (line: string) => {
    if (!state || busy || !live) return false;
    const controller = new AbortController();
    setNotice(null);
    setBusy({ kind: "summit", chars: 0, startedAt: Date.now(), controller });
    try {
      const { lines } = await summitTalk(state, live, line, { locale, model, signal: controller.signal, onProgress: (chars) => setBusy((b) => (b ? { ...b, chars } : b)) });
      update(speakAtSummit(state, live, { country: state.player, speaker: state.countries[state.player]?.leader ?? "", text: line }, lines), true);
      return true;
    } catch (error) {
      const text = explain(error);
      if (text) setNotice(text);
      return false;
    } finally {
      setBusy(null);
    }
  };

  const finishLive = async () => {
    if (!state || busy || !live) return false;
    const controller = new AbortController();
    setNotice(null);
    setBusy({ kind: "summit", chars: 0, startedAt: Date.now(), controller });
    try {
      const { outcome, agreements } = await summitClose(state, live, { locale, model, signal: controller.signal, onProgress: (chars) => setBusy((b) => (b ? { ...b, chars } : b)) });
      update(closeSummit(state, live, outcome, agreements), true);
      return true;
    } catch (error) {
      const text = explain(error);
      if (text) setNotice(text);
      return false;
    } finally {
      setBusy(null);
    }
  };

  const candidatesFor = async (post: OfficialPost, wishes: string): Promise<Candidate[] | null> => {
    if (!state || busy) return null;
    const controller = new AbortController();
    setNotice(null);
    setBusy({ kind: "candidates", chars: 0, startedAt: Date.now(), controller });
    try {
      const { candidates } = await findCandidates(state, post, wishes, {
        locale,
        model,
        signal: controller.signal,
        onProgress: (chars) => setBusy((b) => (b ? { ...b, chars } : b)),
      });
      return candidates;
    } catch (error) {
      const text = explain(error);
      if (text) setNotice(text);
      return null;
    } finally {
      setBusy(null);
    }
  };

  const counts = useMemo(() => {
    const result = new Map<string, number>();
    if (state) for (const r of Object.values(state.regions)) result.set(r.owner, (result.get(r.owner) ?? 0) + 1);
    return result;
  }, [state]);
  const population = useMemo(() => (state ? peopleByOwner(state.regions, map?.index) : new Map<string, number>()), [state, map]);
  const accounts = useMemo(() => (state && map ? nationalAccounts(state, map.index.regions) : null), [state, map]);
  const crises = useMemo(() => (state ? countryCrises(state, state.player, { accounts: accounts?.get(state.player), map: map?.index.regions }) : []), [state, accounts, map]);
  // Fog of war: the selected foreign country as the player's government knows it this turn.
  const borders = useMemo(() => (state && fogOn(state) ? borderingPlayer(state, map?.index.neighbors) : undefined), [state, map]);
  const fogView = useMemo(
    () => (state && fogOn(state) && selected && selected !== state.player && state.countries[selected] ? foreignView(state, selected, { borders, map: map?.index.regions }) : undefined),
    [state, selected, borders, map],
  );

  if (missing) {
    return (
      <div className="min-h-screen">
        <AppHeader back="/" title={t("nav.home")} />
        <div className="mx-auto max-w-md px-4 py-20 text-center">
          <p className="text-sm font-medium text-muted">{t("game.notFound")}</p>
          <Link href="/" className={`${ui.primary} mt-6 px-5 py-3 text-sm`}>
            {t("nav.home")}
          </Link>
        </div>
      </div>
    );
  }

  if (!state || !scenario || state.schema !== 2) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    );
  }

  const player = state.countries[state.player];
  const shownTurn = (mapTurn !== null ? state.chronicle.find((e) => e.turn === mapTurn) : undefined) ?? state.chronicle.at(-1);
  const nextDate = addStep(state.date, state.step);
  // A save from before exile has no mark of it; a country with no land of its own is in exile all the same.
  const exile = player.exile ?? (ownedRegions(state, state.player) === 0 && !player.dormant ? { since: state.date } : undefined);
  const lost = Boolean(state.defeat && !state.defeat.continued);
  const selectedCountry = selected ? state.countries[selected] : null;
  // A player in opposition does not govern: no cabinet or acts of state, and the state's panels are only to look at (engine/role.ts).
  const opposition = isOpposition(state);
  const allTabs: { id: LeftPanel; label: string; icon: typeof ScrollText }[] = [
    { id: "orders", label: t("game.tab.orders"), icon: ScrollText },
    { id: "opposition", label: t("game.tab.opposition"), icon: Megaphone },
    { id: "chronicle", label: t("game.tab.chronicle"), icon: Swords },
    { id: "cabinet", label: t("game.tab.cabinet"), icon: Briefcase },
    { id: "politics", label: t("game.tab.politics"), icon: Landmark },
    { id: "state", label: t("game.tab.state"), icon: Scale },
    { id: "foreign", label: t("game.tab.foreign"), icon: Globe },
    { id: "economy", label: t("game.tab.economy"), icon: Coins },
    { id: "army", label: t("game.tab.army"), icon: Crosshair },
    { id: "science", label: t("game.tab.science"), icon: FlaskConical },
  ];
  const leftTabs = allTabs.filter((tab) => (opposition ? tab.id !== "cabinet" && tab.id !== "state" : tab.id !== "opposition"));
  // A panel the role no longer has (the opposition's after taking power, the cabinet after a fall) gives way to the orders.
  const leftNow: LeftPanel | null = left && !leftTabs.some((tab) => tab.id === left) ? "orders" : left;
  const allRight: { id: RightTab; label: string; icon: typeof ScrollText }[] = [
    { id: "country", label: t("game.tab.country"), icon: Users },
    { id: "diplomacy", label: t("game.tab.diplomacy"), icon: MessageSquare },
  ];
  // Letters to governments speak for the state: not an opposition's.
  const rightTabs = allRight.filter((tab) => !opposition || tab.id !== "diplomacy");

  const endTurnButton = (className: string) => (
    <button type="button" data-tour="end-turn" onClick={aiReady ? endTurn : () => setChoosingMaster(true)} disabled={Boolean(busy) || lost || !status} className={`${ui.primary} ${className}`}>
      {busy?.kind === "turn" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
      {t("game.endTurn")}
    </button>
  );

  const screen = (
    <div className="flex h-dvh flex-col overflow-hidden">
      <AppHeader
        back="/"
        title={
          <span className="flex items-center gap-2">
            <Flag tag={state.player} scenario={state.scenarioId} color={player.color} />
            <span className="truncate">{state.title || text(player.name)}</span>
            <LeaderButton
              state={state}
              onOpen={() => {
                setSelected(state.player);
                setSelectedProvince(null);
                setRight("country");
              }}
              onOpposition={() => setLeft("opposition")}
            />
          </span>
        }
        subtitle={
          <span className="tabular-nums">
            {state.title ? `${text(player.name)} · ` : ""}
            {formatDate(state.date, locale)} · {t("game.turn", { n: state.turn })} · {text(scenario.title)} · {t(state.mode === "historical" ? "game.mode.historical" : "game.mode.free")}
          </span>
        }
        actions={
          <>
            {/* The game master's text can be reported (Microsoft Store policy 11.16). */}
            <a href={CONTENT_REPORT_URL} target="_blank" rel="noreferrer" className={ui.iconButton} aria-label={t("report.ai")} title={t("report.ai")}>
              <ReportIcon className="h-5 w-5 text-muted group-hover:text-accent" />
            </a>
            <button
              type="button"
              aria-pressed={fogOn(state)}
              onClick={() => update({ ...state, fog: !fogOn(state), updatedAt: new Date().toISOString() })}
              className={ui.iconButton}
              aria-label={t(fogOn(state) ? "fog.turnOff" : "fog.turnOn")}
              title={t(fogOn(state) ? "fog.turnOff" : "fog.turnOn")}
            >
              {fogOn(state) ? <EyeOff className="h-5 w-5 text-muted group-hover:text-accent" /> : <Eye className="h-5 w-5 text-muted group-hover:text-accent" />}
            </button>
            {endTurnButton("max-md:hidden px-4 py-2.5 text-xs")}
          </>
        }
      />
      {player.economy && (
        <ResourceBar economy={player.economy} accounts={accounts?.get(state.player)} crises={crises} era={state.scenarioId} />
      )}

      <main className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <nav className="hidden w-[4.5rem] shrink-0 flex-col gap-1 border-r border-line bg-surface p-1.5 lg:flex" aria-label={t("game.tab.panel")}>
          {leftTabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              data-tour={`tab-${id}`}
              aria-pressed={left === id}
              onClick={() => setLeft(left === id ? null : id)}
              title={label}
              className={`flex flex-col items-center gap-1 rounded-xl px-0.5 py-2.5 text-[9.5px] font-bold leading-tight tracking-tight transition-all ${left === id ? "bg-ink text-on-ink" : "text-muted hover:bg-page hover:text-ink"}`}
            >
              <Icon className="h-4.5 w-4.5" />
              <span className="w-full hyphens-auto break-words text-center">{label}</span>
            </button>
          ))}
        </nav>

        {leftNow && (
          <aside className="order-3 flex min-h-0 flex-1 flex-col bg-page lg:order-none lg:w-[360px] lg:flex-none lg:border-r lg:border-line xl:w-[380px]">
            <div className="hidden items-center justify-between border-b border-line bg-surface px-4 py-2.5 lg:flex">
              <span className={ui.label}>{leftTabs.find((x) => x.id === leftNow)?.label}</span>
              <button type="button" onClick={() => setLeft(null)} title={t("panel.close")} aria-label={t("panel.close")} className="rounded-lg p-1 text-muted hover:bg-page hover:text-ink">
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {leftNow === "orders" && (
              <OrdersPanel
                orders={state.draft}
                standing={state.standing ?? []}
                previous={state.chronicle.at(-1)?.orders ?? []}
                step={state.step}
                disabled={Boolean(busy)}
                onChange={(draft) => update({ ...state, draft, updatedAt: new Date().toISOString() })}
                onStanding={(standing) => update({ ...state, standing, updatedAt: new Date().toISOString() })}
                onStep={(step: TimeStep) => update({ ...state, step, updatedAt: new Date().toISOString() })}
              />
            )}

            {leftNow === "chronicle" && state.chronicle.length > 0 && (
              <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-page p-1">
                {(["ours", "world"] as const).map((view) => (
                  <button
                    key={view}
                    type="button"
                    aria-pressed={chronicleView === view}
                    onClick={() => setChronicleView(view)}
                    className={`rounded-lg px-1 py-2 text-2xs font-bold transition-all ${chronicleView === view ? `${ui.segmentOn} bg-surface shadow-sm` : ui.segmentOff}`}
                  >
                    {t(view === "ours" ? "news.view.ours" : "news.view.world")}
                  </button>
                ))}
              </div>
            )}

            {leftNow === "chronicle" && chronicleView === "world" && state.chronicle.length > 0 && (
              <WorldNews
                state={state}
                index={map?.index ?? null}
                onCountry={(tag) => {
                  setSelected(tag);
                  setSelectedProvince(null);
                  if (tag !== state.player) setDiplomacyTarget(tag);
                  setRight("country");
                  setFocus({ key: Date.now(), country: tag });
                  // Where both side panels do not fit, the country replaces the chronicle, as a click on the map does.
                  if (!window.matchMedia("(min-width: 1536px)").matches) setLeft(null);
                }}
              />
            )}

            {leftNow === "chronicle" &&
              (chronicleView === "ours" || state.chronicle.length === 0) &&
              (state.chronicle.length === 0 ? (
                <p className="rounded-xl border-2 border-dashed border-line px-4 py-8 text-center text-xs font-medium text-muted">{t("game.chronicle.empty")}</p>
              ) : (
                <div className="grid gap-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => downloadFile(`gulf-of-trump-${state.scenarioId}-${state.player}-turn-${state.turn}.json`, JSON.stringify(state, null, 1), "application/json")}
                      className={`${ui.secondary} px-3 py-2 text-xs`}
                    >
                      <Download className="h-3.5 w-3.5" />
                      {t("game.export.save")}
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadFile(`gulf-of-trump-${state.scenarioId}-${state.player}-chronicle.md`, chronicleMarkdown(state, map?.index ?? null, locale, t, text), "text/markdown")}
                      className={`${ui.secondary} px-3 py-2 text-xs`}
                    >
                      <Download className="h-3.5 w-3.5" />
                      {t("game.export.chronicle")}
                    </button>
                    {map && (
                      <button type="button" onClick={() => setTimelapse(true)} className={`${ui.secondary} px-3 py-2 text-xs`}>
                        <Clapperboard className="h-3.5 w-3.5" />
                        {t("timelapse.open")}
                      </button>
                    )}
                  </div>
                  {[...state.chronicle].reverse().map((entry, i) => {
                    const open = i === 0 ? !openTurns.has(-entry.turn) : openTurns.has(entry.turn);
                    const toggle = () =>
                      setOpenTurns((prev) => {
                        const next = new Set(prev);
                        const key = i === 0 ? -entry.turn : entry.turn;
                        if (next.has(key)) next.delete(key);
                        else next.add(key);
                        return next;
                      });
                    return (
                      <div key={entry.turn} className={`${ui.card} p-4`}>
                        {open ? (
                          <>
                            <TurnReport entry={entry} state={state} index={map?.index ?? null} compact reporting={reporting} />
                            <div className="mt-3 flex items-center gap-4">
                              <button type="button" onClick={toggle} className="text-2xs font-black uppercase tracking-wider text-muted hover:text-accent">
                                {t("game.chronicle.collapse")}
                              </button>
                              {changedRegions(entry.applied).length > 0 && (
                                <button type="button" onClick={() => showOnMap(entry)} className="inline-flex items-center gap-1 text-2xs font-black uppercase tracking-wider text-muted hover:text-accent">
                                  <MapPin className="h-3 w-3" />
                                  {t("chronicle.onMap")}
                                </button>
                              )}
                              {map && (
                                <button type="button" onClick={() => setPicture(entry)} className="inline-flex items-center gap-1 text-2xs font-black uppercase tracking-wider text-muted hover:text-accent">
                                  <ImageIcon className="h-3 w-3" />
                                  {t("share.turn")}
                                </button>
                              )}
                            </div>
                          </>
                        ) : (
                          <button type="button" onClick={toggle} className="block w-full text-left">
                            <div className={`${ui.label} tabular-nums`}>
                              {t("game.turn", { n: entry.turn })} · {formatDate(entry.from, locale)}
                            </div>
                            <div className="mt-1 text-sm font-black leading-snug text-ink">{entry.headline}</div>
                            <div className="mt-1 text-2xs font-black uppercase tracking-wider text-muted">{t("game.chronicle.expand")}</div>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}

            {leftNow === "opposition" && opposition && (
              <OppositionPanel
                state={state}
                disabled={Boolean(busy) || lost}
                onOrder={(order) => {
                  if (state.draft.includes(order) || state.draft.length + (state.standing?.length ?? 0) >= MAX_TURN_ORDERS) return;
                  update({ ...state, draft: [...state.draft, order], updatedAt: new Date().toISOString() });
                }}
              />
            )}
            {leftNow === "cabinet" && !opposition && (
              <CabinetPanel
                key={consult?.n ?? 0}
                prefill={consult ?? undefined}
                state={state}
                busy={busy?.kind === "advice" && busy.advisor ? { chars: busy.chars, advisor: busy.advisor } : null}
                disabled={!aiReady}
                onAsk={ask}
                onDirectives={(directives) => update({ ...state, directives, updatedAt: new Date().toISOString() })}
                anyBusy={busy ? { kind: busy.kind, chars: busy.chars, advisor: busy.advisor, deputy: busy.deputy } : null}
                onSetup={() => void setupGovernment(["officials"])}
                onSetupDeputies={(advisor) => void setupDeputiesFor(advisor)}
                onAskDeputy={askDeputy}
                onChange={(next) => update(next, true)}
                onFind={candidatesFor}
                onAppoint={(post, person, note) => update(appoint(state, post, person, note), true)}
                reporting={reporting}
                onRequestReport={lost || !aiReady ? undefined : (ministry) => void writeReports(state.chronicle.at(-1)?.turn ?? 0, [ministry])}
              />
            )}
            {leftNow === "politics" && (
              <PoliticsPanel
                state={state}
                busy={busy?.kind === "politics" ? busy : null}
                disabled={!aiReady || Boolean(busy)}
                onLoad={() => void setupGovernment(["politics"])}
                regionName={(id) => (map?.index.regions[id] ? provinceName(map.index.regions[id], locale) : id)}
                onConsult={(advisor, question) => {
                  if (opposition) return;
                  setConsult((c) => ({ advisor, question, n: (c?.n ?? 0) + 1 }));
                  setLeft("cabinet");
                }}
                onOrder={(order) => {
                  if (state.draft.includes(order) || state.draft.length + (state.standing?.length ?? 0) >= MAX_TURN_ORDERS) return;
                  update({ ...state, draft: [...state.draft, order], updatedAt: new Date().toISOString() });
                }}
              />
            )}
            {leftNow === "state" && !opposition && (
              <StatePanel
                state={state}
                regions={map?.index.regions ?? null}
                busy={busy?.kind === "acts" ? busy : null}
                askDisabled={!aiReady || Boolean(busy) || lost}
                locked={busy?.kind === "turn" || lost}
                onAsk={askActs}
                onProclaim={(change, reaction) => update(proclaim(state, change, undefined, reaction), true)}
                onPropose={(draft) => update(proposeBill(state, draft), true)}
                onWithdraw={(id) => update(withdrawBill(state, id), true)}
              />
            )}
            {leftNow === "economy" && (
              <EconomyCenter
                state={state}
                accounts={accounts?.get(state.player)}
                regions={map?.index.regions ?? null}
                disabled={Boolean(busy) || opposition}
                onBudget={(budget) => update(setBudget(state, budget), true)}
                onSanction={(against, scope) => update(setSanction(state, against, scope), true)}
                onSign={(offer) => map && update(signOffer(state, offer.id, map.index.regions), true)}
                onDecline={(offer) => update(declineOffer(state, offer), true)}
                onPropose={(terms) => map && update(proposeDeal(state, terms, map.index.regions), true)}
                onCancel={(id) => update(cancelDeal(state, id), true)}
                onOrder={(order) => {
                  if (state.draft.includes(order) || state.draft.length + (state.standing?.length ?? 0) >= MAX_TURN_ORDERS) return;
                  update({ ...state, draft: [...state.draft, order], updatedAt: new Date().toISOString() });
                }}
              />
            )}
            {leftNow === "army" && (
              <ArmyPanel
                state={state}
                accounts={accounts?.get(state.player)}
                disabled={Boolean(busy) || lost || opposition}
                onFocus={(kinds) => update(setArmsFocus(state, kinds), true)}
                onConsult={() => {
                  if (opposition) return;
                  setConsult((c) => ({ advisor: "military", question: t("arms.question"), n: (c?.n ?? 0) + 1 }));
                  setLeft("cabinet");
                }}
              />
            )}
            {leftNow === "science" && (
              <SciencePanel
                state={state}
                disabled={Boolean(busy) || lost || opposition}
                onShares={(shares) => update({ ...setShares(state, shares), updatedAt: new Date().toISOString() }, true)}
                onConsult={() => {
                  if (opposition) return;
                  setConsult((c) => ({ advisor: "science", question: t("research.question"), n: (c?.n ?? 0) + 1 }));
                  setLeft("cabinet");
                }}
              />
            )}
            {leftNow === "foreign" && (
              <ForeignPanel
                state={state}
                disabled={Boolean(busy) || opposition}
                onPropose={(proposal) => update({ ...state, proposals: [...(state.proposals ?? []), proposal], updatedAt: new Date().toISOString() })}
                onWithdraw={(id) => update({ ...state, proposals: (state.proposals ?? []).filter((p) => p.id !== id), updatedAt: new Date().toISOString() })}
                onSchedule={(summit) => update({ ...state, summits: [...(state.summits ?? []), summit], updatedAt: new Date().toISOString() })}
                onOpenSummit={setRereading}
                onLive={(summit) => setLive(summit.id)}
                onConvene={(bloc, agenda) => {
                  const org = state.alliances.find((a) => a.id === bloc);
                  if (!org) return;
                  const { state: next, summit } = conveneSummit(state, { title: t("live.sessionOf", { name: text(org.name) }), place: "", participants: org.members, agenda });
                  update(next, true);
                  setLive(summit.id);
                }}
              />
            )}

            </div>
          </aside>
        )}

        <section data-tour="map" className="relative order-1 h-[42vh] shrink-0 border-b border-line lg:order-none lg:h-auto lg:min-w-0 lg:flex-1 lg:border-b-0">
          {map ? (
            <WorldMap
              topology={map.topology}
              regions={state.regions}
              countries={state.countries}
              selected={selected}
              selectedProvince={selectedProvince}
              player={state.player}
              era={state.scenarioId}
              year={yearOf(state.date)}
              wars={state.wars}
              protests={state.protests}
              placeNames={state.placeNames}
              changes={shownTurn ? { key: `${shownTurn.turn}-${pulse}`, applied: shownTurn.applied, turn: shownTurn.turn, onLatest: mapTurn !== null ? () => setMapTurn(null) : undefined, onShow: () => showOnMap(shownTurn) } : null}
              focus={focus ?? { key: 0, country: state.player }}
              onSelect={(tag, province) => {
                if (!tag) return;
                setSelected(tag);
                setSelectedProvince(province);
                if (tag !== state.player) setDiplomacyTarget(tag);
                setRight("country");
                // Where both side panels do not fit, the selection replaces the open one.
                if (!window.matchMedia("(min-width: 1536px)").matches) setLeft(null);
              }}
              className="h-full w-full bg-sea"
            />
          ) : (
            <div className="grid h-full place-items-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted" />
            </div>
          )}

          {notice && (
            <div className="absolute inset-x-3 top-3 z-20 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-bold text-red-700 shadow-lg animate-in fade-in slide-in-from-top-2">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="flex-1">{notice}</span>
              <button type="button" onClick={() => setNotice(null)} className="text-xs font-black uppercase tracking-wider hover:underline">
                ×
              </button>
            </div>
          )}

          {!aiReady && status && (
            <div className="absolute inset-x-3 bottom-3 z-20 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-500/40 bg-surface/95 p-3 shadow-lg backdrop-blur sm:right-auto">
              <span className="text-sm font-bold text-ink">{t("game.needAi")}</span>
              <GameMasterOffer compact />
            </div>
          )}
          <GameMasterChoice open={choosingMaster} onClose={() => setChoosingMaster(false)} onDemo={() => void endTurn()} />

          {busy?.kind === "turn" && (
            <div className="absolute inset-0 z-30 grid place-items-center bg-scrim/40 backdrop-blur-[2px] animate-in fade-in">
              <div className={`${ui.card} w-[min(92%,26rem)] p-6 text-center shadow-2xl`}>
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-accent" />
                <div className="mt-4 text-lg font-black text-ink">{t("game.resolving")}</div>
                <div className="mt-1 text-xs font-medium text-muted tabular-nums">
                  {t("game.period", { from: formatDate(state.date, locale), to: formatDate(nextDate, locale) })}
                </div>
                <div className="mt-3 flex justify-center gap-3 text-xs font-bold text-muted">
                  <Elapsed since={busy.startedAt} />
                  {busy.chars > 0 && <span>{t("game.received", { n: busy.chars })}</span>}
                </div>
                <button type="button" onClick={() => busy.controller.abort()} className={`${ui.secondary} mt-5 px-4 py-2 text-xs`}>
                  {t("game.cancel")}
                </button>
                <TurnQuote />
              </div>
            </div>
          )}
        </section>

        <nav className="order-2 flex gap-1 border-b border-line bg-surface p-1.5 lg:hidden" role="tablist">
          {[...leftTabs, ...rightTabs].map(({ id, label, icon: Icon }) => {
            const on = left ? left === id : right === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => {
                  if (id === "country" || id === "diplomacy") {
                    setLeft(null);
                    setRight(id);
                  } else setLeft(id as LeftPanel);
                }}
                title={label}
                className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-1 py-2 text-2xs font-bold transition-all ${on ? ui.segmentOn : ui.segmentOff}`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0 sm:hidden" />
                <span className="hidden truncate sm:inline">{label}</span>
              </button>
            );
          })}
        </nav>

        <aside className={`order-3 min-h-0 flex-1 flex-col bg-page lg:order-none lg:w-[360px] lg:flex-none lg:border-l lg:border-line xl:w-[400px] ${left ? "hidden 2xl:flex" : "flex"}`}>
          <nav className="hidden gap-1 border-b border-line bg-surface p-1.5 lg:flex" role="tablist">
            {rightTabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                data-tour={`tab-${id}`}
                type="button"
                role="tab"
                aria-selected={right === id}
                onClick={() => setRight(id as RightTab)}
                className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-1 py-2 text-2xs font-bold transition-all ${right === id ? ui.segmentOn : ui.segmentOff}`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{label}</span>
              </button>
            ))}
          </nav>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {exile && (
              <div className="mb-4 rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-700">
                <div>
                  {exile.host
                    ? t("game.exileIn", { host: text(state.countries[exile.host]?.name ?? exile.host), date: formatDate(exile.since, locale) })
                    : t("game.exile", { date: formatDate(exile.since, locale) })}
                </div>
                <div className="mt-1 font-medium">{t("game.exileNote")}</div>
              </div>
            )}
            {right === "diplomacy" && !opposition && (
              <DiplomacyPanel
                state={state}
                target={diplomacyTarget}
                busy={busy?.kind === "diplomacy" ? busy : null}
                disabled={!aiReady}
                onTarget={setDiplomacyTarget}
                onSend={send}
              />
            )}

            {right === "country" && selectedProvince && map?.index.regions[selectedProvince] && state.regions[selectedProvince] && (
              <div className="mb-4">
                <ProvinceDetails
                  province={map.index.regions[selectedProvince]}
                  region={state.regions[selectedProvince]}
                  countries={state.countries}
                  year={yearOf(state.date)}
                  start={startScale && map.index.regions[selectedProvince].pop !== undefined ? map.index.regions[selectedProvince].pop! * startScale(map.index.regions[selectedProvince].adm0) : undefined}
                />
              </div>
            )}

            {right === "country" && selectedCountry && (
              <CountryDetails
                country={selectedCountry}
                scenario={state.scenarioId}
                regionCount={counts.get(selectedCountry.tag) ?? 0}
                population={map ? population.get(selectedCountry.tag) ?? 0 : undefined}
                accounts={accounts?.get(selectedCountry.tag)}
                detailed={selectedCountry.tag === state.player}
                wars={state.wars}
                alliances={state.alliances}
                countries={state.countries}
                isPlayer={selectedCountry.tag === state.player}
                coupRisk={selectedCountry.domestic && !selectedCountry.dormant && (counts.get(selectedCountry.tag) ?? 0) > 0 ? coupRiskIn(state, selectedCountry.tag, lostShares(state, map?.index.regions)) : undefined}
                plans={state.plans ?? []}
                player={state.player}
                view={fogView}
                footer={
                  selectedCountry.tag !== state.player && !opposition && (
                    <button
                      type="button"
                      onClick={() => {
                        setDiplomacyTarget(selectedCountry.tag);
                        setRight("diplomacy");
                      }}
                      className={`${ui.secondary} w-full py-3 text-sm`}
                    >
                      <MessageSquare className="h-4 w-4" />
                      {t("country.message")}
                    </button>
                  )
                }
              />
            )}
          </div>
        </aside>

        <div className="order-4 border-t border-line bg-surface p-3 md:hidden">{endTurnButton("w-full py-3.5 text-sm")}</div>
      </main>

      <SummitDialog
        summit={rereading ?? (summitQueue.length ? (state.summits ?? []).find((s) => s.id === summitQueue[0]) ?? null : null)}
        countries={state.countries}
        scenario={state.scenarioId}
        onClose={() => (rereading ? setRereading(null) : setSummitQueue((q) => q.slice(1)))}
      />

      <LiveSummitDialog
        state={state}
        summit={live ? ((state.summits ?? []).find((s) => s.id === live) ?? null) : null}
        busy={busy ? { kind: busy.kind, chars: busy.chars, advisor: busy.advisor } : null}
        disabled={!aiReady}
        onSpeak={speakLive}
        onFinish={finishLive}
        onAsk={ask}
        onClose={() => setLive(null)}
      />

      {touring && (
        <Tour
          scenario={state.scenarioId}
          country={text(player.name)}
          opposition={opposition}
          orders={state.draft}
          onAddOrder={(order) => {
            if (state.draft.includes(order) || state.draft.length + (state.standing?.length ?? 0) >= MAX_TURN_ORDERS) return;
            update({ ...state, draft: [...state.draft, order], updatedAt: new Date().toISOString() });
            setLeft("orders");
          }}
          onClose={() => setTouring(false)}
        />
      )}

      <VoiceLayer />

      <DefeatDialog
        state={state}
        onContinue={() => update(withCountry(state), true)}
        onOpposition={() => {
          update(intoOpposition(state), true);
          setLeft("opposition");
        }}
      />

      <Dialog
        open={report !== null && summitQueue.length === 0 && !rereading && !lost}
        onClose={() => {
          setReport(null);
          setPulse((p) => p + 1);
        }}
        wide
        title={t("game.report")}
        footer={
          <div className="flex flex-col gap-2 sm:flex-row">
            {report && changedRegions(report.applied).length > 0 && (
              <button
                type="button"
                onClick={() => {
                  showOnMap(report);
                  setReport(null);
                }}
                className={`${ui.secondary} w-full py-3 text-sm`}
              >
                <MapPin className="h-4 w-4" />
                {t("game.report.showOnMap")}
              </button>
            )}
            {report && map && (
              <button
                type="button"
                onClick={() => {
                  setPicture(report);
                  setReport(null);
                }}
                className={`${ui.secondary} w-full py-3 text-sm`}
              >
                <ImageIcon className="h-4 w-4" />
                {t("share.turn")}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setReport(null);
                setPulse((p) => p + 1);
              }}
              className={`${ui.primary} w-full py-3 text-sm`}
            >
              {t("game.report.close")}
            </button>
          </div>
        }
      >
        {/* The entry as it stands now: the ministers' reports come in while it is open. */}
        {report && <TurnReport entry={state.chronicle.find((e) => e.turn === report.turn) ?? report} state={state} index={map?.index ?? null} reporting={reporting} />}
      </Dialog>

      {picture && map && <SharePicture key={picture.turn} state={state} entry={picture} topology={map.topology} onClose={() => setPicture(null)} />}
      {timelapse && map && <Timelapse state={state} topology={map.topology} onClose={() => setTimelapse(false)} />}
    </div>
  );
  // People without a portrait dress for the game's year.
  return <PortraitYear.Provider value={yearOf(state.date)}>{screen}</PortraitYear.Provider>;
}


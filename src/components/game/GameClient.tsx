"use client";

import Link from "next/link";
import { Briefcase, Clapperboard, Coins, Crosshair, Download, Flag as ReportIcon, FlaskConical, Globe, Image as ImageIcon, Landmark, Loader2, MapPin, Megaphone, MessageSquare, PanelLeftClose, Play, ScrollText, Swords, TriangleAlert, Users } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import AppHeader from "@/components/AppHeader";
import DownloadButton from "@/components/DownloadButton";
import Flag from "@/components/Flag";
import WorldMap from "@/components/map/WorldMap";
import { changedRegions } from "@/components/map/overlays";
import Dialog from "@/components/ui/Dialog";
import { ui } from "@/components/ui/classes";
import { addStep, formatDate, yearOf } from "@/engine/calendar";
import { CONTENT_REPORT_URL, isDemo, MAX_ORDERS as MAX_TURN_ORDERS } from "@/constants/app";
import { coupRiskIn, incomes, lostShares } from "@/engine/abroad";
import { borderingPlayer, fogOn, foreignView } from "@/engine/fog";
import { sidesOf } from "@/engine/sides";
import { applyProposal, takeAdvice } from "@/engine/advice";
import { addAdvice, type AdvisorId } from "@/engine/advisors";
import { countryCrises } from "@/engine/crises";
import { nationalAccounts, seedEconomies, setBudget } from "@/engine/economy";
import { setArmyOrganisation } from "@/engine/army";
import { setFocus as setArmsFocus } from "@/engine/arsenal";
import { setShares } from "@/engine/research";
import { cancelDeal, declineOffer, signOffer } from "@/engine/deals";
import EconomyCenter from "./EconomyCenter";
import ArmyPanel from "./ArmyPanel";
import SciencePanel from "./SciencePanel";
import { addDiplomacyExchange } from "@/engine/diplomacy";
import { applyOutcome, ownedRegions, type HomePart, type WorldPart } from "@/engine/outcome";
import { completeOutcome, missingStages, pendingFor, previewEntry, storyCarry, turnKey, type PendingTurn, type TurnStage } from "@/engine/stages";
import { isMigrated, migrateSave, refreshSave } from "@/engine/migrations";
import { peopleByOwner, provinceName } from "@/engine/provinces";
import { intoOpposition, isOpposition, withCountry } from "@/engine/role";
import { getScenario } from "@/engine/scenarios";
import { peopleScale } from "@/engine/setup";
import type { ChronicleEntry, GameState, Locale, Motion, OfficialPost, Summit, Talk, TimeStep } from "@/engine/types";
import { errorKey, useI18n } from "@/i18n/useI18n";
import type { MessageKey } from "@/i18n/messages";
import { ApiError, askAdvisor, findCandidates, learnArmy, playTurnStage, requestBio, requestReport, sendDiplomacy, sessionTalk, setupDeputies, setupPolitics, summitClose, summitTalk, talksFinish, talksSpeak } from "@/lib/api";
import { convene, speakInSession, takeVote } from "@/engine/parliament";
import { openTalks, settleTalks, speakInTalks } from "@/engine/talks";
import SessionDialog from "./politics/SessionDialog";
import TalkDialog from "./politics/TalkDialog";
import { addBio, bioKey, bioOf } from "@/engine/bios";
import { seedInterests } from "@/engine/interests";
import { applyMinisterReport, reportsDue, type MinisterReport } from "@/engine/reports";
import LiveSummitDialog from "./LiveSummitDialog";
import { ADVISOR_POST, appoint, type Candidate } from "@/engine/government";
import { addDeputyAdvice, startDeputies } from "@/engine/deputies";
import { useMap } from "@/lib/maps";
import { usePreference } from "@/lib/preferences";
import { chronicleMarkdown, downloadFile } from "@/lib/exports";
import { saveFileName, sealSave } from "@/lib/saveFile";
import { loadSave, writeSave } from "@/lib/saves";
import { clearPendingTurn, readPendingTurn, writePendingTurn } from "@/lib/pendingTurn";
import { readNewTurn } from "@/lib/voice/speaker";
import VoiceLayer from "@/components/voice/VoiceLayer";
import { useGameMaster } from "@/lib/gameMaster";
import GameMasterChoice, { GameMasterOffer } from "@/components/GameMasterChoice";
import { PortraitYear } from "./Portrait";
import CountryDetails from "./CountryDetails";
import LeaderButton from "./LeaderButton";
import OppositionPanel from "./OppositionPanel";
import DefeatDialog from "./DefeatDialog";
import AdvisorStrip from "./AdvisorStrip";
import { tabAdvisors } from "./advisorTabs";
import CabinetPanel, { type ReportStatus } from "./CabinetPanel";
import ForeignPanel, { type ForeignSection } from "./ForeignPanel";
import { closeSummit, dueSessions, speakAtSummit } from "@/engine/foreign";
import PoliticsPanel from "./PoliticsPanel";
import Tour, { tourSeen } from "./Tour";
import SummitDialog from "./SummitDialog";
import OperationsPanel from "./OperationsPanel";
import OrdersPanel from "./OrdersPanel";
import TurnLength from "./TurnLength";
import ProvinceDetails from "./ProvinceDetails";
import ResourceBar from "./ResourceBar";
import TurnQuote from "./TurnQuote";
import { listedChanges } from "./changes";
import SharePicture from "./SharePicture";
import Timelapse from "./Timelapse";
import TurnReport from "./TurnReport";
import WorldNews from "./WorldNews";

/** Panels that open on the left, from the rail; the right side shows the selection. */
type LeftPanel = "orders" | "opposition" | "chronicle" | "cabinet" | "politics" | "foreign" | "economy" | "army" | "science";
type RightTab = "country";

interface Busy {
  kind: "turn" | "diplomacy" | "advice" | "politics" | "candidates" | "summit" | "deputies" | "deputy" | "army" | "parliament" | "talks";
  /** The minister being asked, for "advice"; the ministry, for "deputies" and "deputy". */
  advisor?: AdvisorId;
  /** The deputy being spoken to in private, for "deputy". */
  deputy?: string;
  chars: number;
  startedAt: number;
  controller: AbortController;
  /** For a turn: the stages still being written (engine/stages.ts). */
  stages?: TurnStage[];
}

function Elapsed({ since }: { since: number }) {
  const { t } = useI18n();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return <span className="tabular-nums">{t("game.seconds", { n: Math.max(0, Math.round((now - since) / 1000)) })}</span>;
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
  // The foreign policy panel's section: with the talks open, a click on the map picks whom to write to.
  const [foreignSection, setForeignSection] = useState<ForeignSection>("wars");
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
  // The sitting of parliament and the talks shown in their dialogs, if any.
  const [sitting, setSitting] = useState<string | null>(null);
  const [talksOpen, setTalksOpen] = useState<string | null>(null);
  // A session or summit due this period that the player has not attended yet: it opens once the turn's report is closed.
  const [autoLive, setAutoLive] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The ministers' views of the last turn, given in the background after it (engine/reports.ts).
  const [reporting, setReporting] = useState<Partial<Record<AdvisorId, ReportStatus>>>({});
  // Reports that have arrived: every update keeps them, so an answer begun before one arrived cannot drop it.
  const arrived = useRef(new Map<string, MinisterReport>());
  const latest = useRef<GameState | null>(null);
  // The side panels stay where they were across a turn: their scroll is held when the turn begins
  // and put back when it lands and when its report closes, whatever came in meanwhile.
  const leftScroll = useRef<HTMLDivElement>(null);
  const rightScroll = useRef<HTMLDivElement>(null);
  const heldScroll = useRef<{ left: number; right: number } | null>(null);
  useLayoutEffect(() => {
    const held = heldScroll.current;
    if (!held) return;
    if (leftScroll.current) leftScroll.current.scrollTop = held.left;
    if (rightScroll.current) rightScroll.current.scrollTop = held.right;
    if (!busy && !report) heldScroll.current = null;
  }, [state?.turn, report, busy]);
  // Biographies that have arrived, applied again on every update so a change made from an older state keeps them.
  const bios = useRef(new Map<string, { name: string; locale: Locale; text: string }>());
  const biosAsked = useRef(new Set<string>());
  const [bioStatus, setBioStatus] = useState<Record<string, "loading" | "failed">>({});
  const reportsRun = useRef<AbortController | null>(null);
  // The turn under way: the stages that landed, and its report before it is applied.
  const pendingTurn = useRef<PendingTurn | null>(null);
  const [preview, setPreview] = useState<ChronicleEntry | null>(null);

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
    const reported = [...arrived.current.values()].reduce((s, report) => applyMinisterReport(s, report), next);
    const merged = [...bios.current.values()].reduce((s, b) => addBio(s, b.name, b.locale, b.text), reported);
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

  /**
   * A person's short biography (engine/bios.ts), asked for once per person
   * and language, in the background: the cabinet shows it when it comes.
   */
  const requestBioFor = async (name: string) => {
    const base = latest.current;
    if (!base || !aiReady || bioOf(base, name, locale)) return;
    const key = `${bioKey(base, name)}:${locale}`;
    if (biosAsked.current.has(key)) return;
    biosAsked.current.add(key);
    setBioStatus((s) => ({ ...s, [key]: "loading" }));
    try {
      const { bio } = await requestBio(base, name, { locale, model });
      bios.current.set(key, { name, locale, text: bio });
      if (latest.current) update(latest.current, true);
      setBioStatus((s) => Object.fromEntries(Object.entries(s).filter(([k]) => k !== key)));
    } catch {
      setBioStatus((s) => ({ ...s, [key]: "failed" }));
    }
  };

  /**
   * A turn is written in stages (engine/stages.ts): the story first — the
   * waiting screen gives way to its report at once — then the world and home
   * side by side, filling the report in. Nothing is applied until all three
   * are in, so the map and the panels change once. A turn cancelled or cut
   * off keeps the stages that landed, and played again for the same state and
   * orders it asks only for the rest.
   */
  const endTurn = async () => {
    if (!state || busy) return;
    const base = state;
    // Standing orders go first, every turn; the turn's own follow.
    const orders = [...new Set([...(base.standing ?? []), ...base.draft])].slice(0, MAX_TURN_ORDERS);
    const controller = new AbortController();
    heldScroll.current = { left: leftScroll.current?.scrollTop ?? 0, right: rightScroll.current?.scrollTop ?? 0 };
    setNotice(null);
    const pending = pendingFor(pendingTurn.current ?? readPendingTurn(base.id), turnKey(base, orders, locale), base.turn);
    pendingTurn.current = pending;
    const landed = () => {
      writePendingTurn(base.id, pending);
      const entry = previewEntry(base, orders, pending.parts);
      setPreview(entry);
      setReport(entry);
      setBusy((b) => (b ? { ...b, stages: missingStages(pending.parts) } : b));
    };
    setBusy({ kind: "turn", chars: 0, startedAt: Date.now(), controller, stages: missingStages(pending.parts) });
    try {
      if (!pending.parts.story) {
        const { part } = await playTurnStage(base, orders, "story", { locale, model, signal: controller.signal, onProgress: (chars) => setBusy((b) => (b ? { ...b, chars } : b)) });
        pending.parts.story = part;
        readNewTurn(previewEntry(base, orders, pending.parts), locale);
      }
      landed();
      // The world and home carry the story out side by side; one that fails leaves the other's work kept.
      const story = storyCarry(pending.parts.story);
      const rest = (["world", "home"] as const).filter((stage) => !pending.parts[stage]);
      const settled = await Promise.allSettled(
        rest.map(async (stage) => {
          const { part } = await playTurnStage(base, orders, stage, { locale, model, signal: controller.signal, onProgress: () => {}, story });
          if (stage === "world") pending.parts.world = part as WorldPart;
          else pending.parts.home = part as HomePart;
          landed();
        }),
      );
      const failed = settled.find((r): r is PromiseRejectedResult => r.status === "rejected");
      if (failed) throw failed.reason;
      const outcome = completeOutcome(pending.parts);
      if (!outcome) throw new ApiError("network_error", "The turn is incomplete.", true);
      pendingTurn.current = null;
      clearPendingTurn(base.id);
      const next = applyOutcome(base, outcome, orders, new Date(), map?.index.regions ?? null, map?.index.neighbors ?? null);
      const entry = next.chronicle[next.chronicle.length - 1];
      // Reports written for an earlier try at this turn belong to another outcome.
      for (const [key, r] of arrived.current) if (r.turn >= entry.turn) arrived.current.delete(key);
      update(next, true);
      setSummitQueue(entry.summits ?? []);
      setAutoLive(dueSessions(next, addStep(next.date, next.step))[0]?.id ?? null);
      setReport(entry);
      if (!next.defeat || next.defeat.continued) void writeReports(entry.turn, reportsDue(entry), true);
    } catch (error) {
      // The unfinished report closes; it opens again when the turn is played on.
      setReport((r) => (r && r.turn === base.turn && !base.chronicle.some((e) => e.turn === r.turn) ? null : r));
      const message = explain(error);
      if (message) setNotice(message);
    } finally {
      setPreview(null);
      setBusy(null);
    }
  };

  /** Shows a turn's changes on the map and brings them into view. */
  const showOnMap = (entry: ChronicleEntry) => {
    const last = state?.chronicle.at(-1)?.turn;
    setMapTurn(entry.turn === last ? null : entry.turn);
    setPulse((p) => p + 1);
    setFocus({ key: Date.now(), regions: changedRegions(listedChanges(entry.applied)) });
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
      update(takeAdvice(state, advisor, question, reply), true);
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

  /** The game master describes the player's army as it stands now: its armies, their divisions and where they are. */
  const describeArmy = async () => {
    if (!state || busy) return;
    const controller = new AbortController();
    setNotice(null);
    setBusy({ kind: "army", chars: 0, startedAt: Date.now(), controller });
    try {
      const { organisation } = await learnArmy(state, { locale, model, signal: controller.signal, onProgress: (chars) => setBusy((b) => (b ? { ...b, chars } : b)) });
      update(setArmyOrganisation(state, organisation), true);
    } catch (error) {
      const text = explain(error);
      if (text) setNotice(text);
    } finally {
      setBusy(null);
    }
  };

  /** The player speaks at a meeting held in person; the others answer. */
  // The meeting the player sits at: one opened by hand, or a due one once the turn's report and the records are closed.
  const liveId = live ?? (report === null && summitQueue.length === 0 && !rereading ? autoLive : null);
  // The record on screen: one reread by hand, else the next held while the turn was played.
  const rereadingNow = rereading ?? (summitQueue.length && report === null ? ((state?.summits ?? []).find((s) => s.id === summitQueue[0]) ?? null) : null);
  // A bloc's session reads as the session of that bloc, in the player's language.
  const summitHeading = (s: Summit) => {
    const bloc = s.bloc ? state?.alliances.find((a) => a.id === s.bloc) : undefined;
    return bloc ? t("live.sessionOf", { name: text(bloc.name) }) : s.title;
  };

  const speakLive = async (line: string) => {
    if (!state || busy || !liveId) return false;
    const controller = new AbortController();
    setNotice(null);
    setBusy({ kind: "summit", chars: 0, startedAt: Date.now(), controller });
    try {
      const { lines } = await summitTalk(state, liveId, line, { locale, model, signal: controller.signal, onProgress: (chars) => setBusy((b) => (b ? { ...b, chars } : b)) });
      update(speakAtSummit(state, liveId, { country: state.player, speaker: state.countries[state.player]?.leader ?? "", text: line }, lines), true);
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
    if (!state || busy || !liveId) return false;
    const controller = new AbortController();
    setNotice(null);
    setBusy({ kind: "summit", chars: 0, startedAt: Date.now(), controller });
    try {
      const { outcome, agreements } = await summitClose(state, liveId, { locale, model, signal: controller.signal, onProgress: (chars) => setBusy((b) => (b ? { ...b, chars } : b)) });
      update(closeSummit(state, liveId, outcome, agreements), true);
      return true;
    } catch (error) {
      const text = explain(error);
      if (text) setNotice(text);
      return false;
    } finally {
      setBusy(null);
    }
  };

  /** The house speaks at a sitting: at its opening (no line) or after the government's speech; the engine applies the sway (engine/parliament.ts). */
  const speakSession = async (from: GameState, id: string, line: string | null) => {
    if (busy) return false;
    const controller = new AbortController();
    setNotice(null);
    setBusy({ kind: "parliament", chars: 0, startedAt: Date.now(), controller });
    try {
      const answer = await sessionTalk(from, id, line, { locale, model, signal: controller.signal, onProgress: (chars) => setBusy((b) => (b ? { ...b, chars } : b)) });
      update(speakInSession(from, id, line, answer), true);
      return true;
    } catch (error) {
      const text = explain(error);
      if (text) setNotice(text);
      return false;
    } finally {
      setBusy(null);
    }
  };

  /** The player brings a motion to parliament: the sitting opens and the house gives its first speeches. */
  const openSitting = (motion: Motion) => {
    if (!state || busy) return;
    const { state: next, session } = convene(state, motion);
    if (!session) return;
    update(next, true);
    setSitting(session.id);
    void speakSession(next, session.id, null);
  };

  /**
   * The interior minister drafts the government's words for a sitting or
   * talks, on request. The draft goes into the player's box to edit and give;
   * it is never said for them. It also stays in the cabinet's thread.
   */
  const draftWords = async (question: string, context: string): Promise<string | null> => {
    if (!state || busy) return null;
    const controller = new AbortController();
    setNotice(null);
    setBusy({ kind: "advice", advisor: "interior", chars: 0, startedAt: Date.now(), controller });
    try {
      const { reply } = await askAdvisor(state, "interior", question, { locale, model, signal: controller.signal, onProgress: (chars) => setBusy((b) => (b ? { ...b, chars } : b)), context });
      update(addAdvice(state, "interior", question, reply), true);
      return reply.answer;
    } catch (error) {
      const text = explain(error);
      if (text) setNotice(text);
      return null;
    } finally {
      setBusy(null);
    }
  };

  const draftForSitting = () => {
    const s = sitting ? state?.politics?.sessions?.find((x) => x.id === sitting) : undefined;
    if (!s || !state) return Promise.resolve(null);
    const name = (party?: string) => state.politics?.parties.find((p) => p.id === party)?.name ?? "chair";
    const context = [
      `The government is at a sitting of parliament on: ${s.motion.kind}${s.motion.law ? ` (${s.motion.law} → ${s.motion.option})` : ""}${s.motion.text ? ` – ${s.motion.text}` : ""}.`,
      "What has been said:",
      ...s.transcript.slice(-10).map((l) => (l.player ? `[GOVERNMENT] ${l.text}` : `[${name(l.party)}] ${l.speaker}: ${l.text}`)),
    ].join("\n");
    return draftWords(t("politics.draft.ask.session"), context);
  };

  const draftForTalks = () => {
    const x = talksOpen ? state?.politics?.talks?.find((y) => y.id === talksOpen) : undefined;
    if (!x) return Promise.resolve(null);
    const context = [`The government is in talks with ${x.counterpart} ("${x.title}", a ${x.with}).`, "What has been said:", ...x.transcript.slice(-10).map((l) => (l.player ? `[GOVERNMENT] ${l.text}` : `[${l.speaker || x.counterpart}] ${l.text}`))].join("\n");
    return draftWords(t("politics.draft.ask.talks"), context);
  };

  /** The player opens talks with a protest's leaders or with plotters, or takes them up again (engine/talks.ts). */
  const startTalks = (kind: Talk["with"], target: string) => {
    if (!state) return;
    const { state: next, talk } = openTalks(state, kind, target);
    if (!talk) return;
    if (next !== state) update(next, true);
    setTalksOpen(talk.id);
  };

  const sayInTalks = async (line: string) => {
    if (!state || busy || !talksOpen) return false;
    const controller = new AbortController();
    setNotice(null);
    setBusy({ kind: "talks", chars: 0, startedAt: Date.now(), controller });
    try {
      const reply = await talksSpeak(state, talksOpen, line, { locale, model, signal: controller.signal, onProgress: (chars) => setBusy((b) => (b ? { ...b, chars } : b)) });
      update(speakInTalks(state, talksOpen, line, reply), true);
      return true;
    } catch (error) {
      const text = explain(error);
      if (text) setNotice(text);
      return false;
    } finally {
      setBusy(null);
    }
  };

  const finishTalks = async () => {
    if (!state || busy || !talksOpen) return false;
    const controller = new AbortController();
    setNotice(null);
    setBusy({ kind: "talks", chars: 0, startedAt: Date.now(), controller });
    try {
      const end = await talksFinish(state, talksOpen, { locale, model, signal: controller.signal, onProgress: (chars) => setBusy((b) => (b ? { ...b, chars } : b)) });
      update(settleTalks(state, talksOpen, end), true);
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
  // The map's diplomatic view: the selected country's friends and foes, or the player's when none is picked.
  const diplomacy = useMemo(() => {
    if (!state) return null;
    const subject = selected && state.countries[selected] ? selected : state.player;
    return { subject, sides: sidesOf(state, subject, { state, borders }) };
  }, [state, selected, borders]);

  if (missing) {
    return (
      <div className="min-h-screen">
        <AppHeader back="/" title={t("nav.home")} />
        <div className="mx-auto max-w-md px-4 py-20 text-center">
          {/* The public demo keeps games only while the page is open. */}
          <p className="text-sm font-medium text-muted">{t(isDemo() ? "demo.gone" : "game.notFound")}</p>
          <div className="mt-6 flex flex-wrap items-start justify-center gap-3">
            <Link href="/" className={`${ui.primary} px-5 py-3 text-sm`}>
              {t("nav.home")}
            </Link>
            <DownloadButton variant="primary" />
          </div>
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
  const writing = busy?.kind === "turn" && report && !state.chronicle.some((e) => e.turn === report.turn) ? (busy.stages ?? []) : null;
  const shownTurn = (mapTurn !== null ? state.chronicle.find((e) => e.turn === mapTurn) : undefined) ?? state.chronicle.at(-1);
  const nextDate = addStep(state.date, state.step);
  // A save from before exile has no mark of it; a country with no land of its own is in exile all the same.
  const exile = player.exile ?? (ownedRegions(state, state.player) === 0 && !player.dormant ? { since: state.date } : undefined);
  const lost = Boolean(state.defeat && !state.defeat.continued);
  const selectedCountry = selected ? state.countries[selected] : null;
  // A player in opposition does not govern: no cabinet, and the state's panels are only to look at (engine/role.ts).
  const opposition = isOpposition(state);
  const allTabs: { id: LeftPanel; label: string; icon: typeof ScrollText }[] = [
    { id: "orders", label: t("game.tab.orders"), icon: ScrollText },
    { id: "opposition", label: t("game.tab.opposition"), icon: Megaphone },
    { id: "chronicle", label: t("game.tab.chronicle"), icon: Swords },
    { id: "cabinet", label: t("game.tab.cabinet"), icon: Briefcase },
    { id: "politics", label: t("game.tab.politics"), icon: Landmark },
    { id: "foreign", label: t("game.tab.foreign"), icon: Globe },
    { id: "economy", label: t("game.tab.economy"), icon: Coins },
    { id: "army", label: t("game.tab.army"), icon: Crosshair },
    { id: "science", label: t("game.tab.science"), icon: FlaskConical },
  ];
  const leftTabs = allTabs.filter((tab) => (opposition ? tab.id !== "cabinet" : tab.id !== "opposition"));
  // A panel the role no longer has (the opposition's after taking power, the cabinet after a fall) gives way to the orders.
  const leftNow: LeftPanel | null = left && !leftTabs.some((tab) => tab.id === left) ? "orders" : left;
  // Talks with governments live in the foreign policy panel.
  const rightTabs: { id: RightTab; label: string; icon: typeof ScrollText }[] = [{ id: "country", label: t("game.tab.country"), icon: Users }];

  /** An order added to the turn from a panel or a minister's draft: once, and while the turn has room. */
  const addOrder = (order: string) => {
    if (state.draft.includes(order) || state.draft.length + (state.standing?.length ?? 0) >= MAX_TURN_ORDERS) return;
    update({ ...state, draft: [...state.draft, order], updatedAt: new Date().toISOString() });
  };

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
        actions={endTurnButton("max-md:hidden px-4 py-2.5 text-xs")}
        trailing={
          // The game master's text can be reported (Microsoft Store policy 11.16).
          <a href={CONTENT_REPORT_URL} target="_blank" rel="noreferrer" className={ui.iconButton} aria-label={t("report.ai")} title={t("report.ai")}>
            <ReportIcon className="h-5 w-5 text-muted group-hover:text-accent" />
          </a>
        }
      />
      {player.economy && (
        <ResourceBar economy={player.economy} accounts={accounts?.get(state.player)} crises={crises} era={state.scenarioId} unrest={state.politics?.unrest} />
      )}

      <main className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <nav className="hidden w-[4.5rem] shrink-0 flex-col gap-1 border-r border-line sheet p-1.5 lg:flex" aria-label={t("game.tab.panel")}>
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
          <aside className="order-3 flex min-h-0 flex-1 flex-col paper lg:order-none lg:w-[360px] lg:flex-none lg:border-r lg:border-line xl:w-[380px]">
            <div className="hidden items-center justify-between border-b border-line sheet px-4 py-2.5 lg:flex">
              <span className={ui.label}>{leftTabs.find((x) => x.id === leftNow)?.label}</span>
              <button type="button" onClick={() => setLeft(null)} title={t("panel.close")} aria-label={t("panel.close")} className="rounded-lg p-1 text-muted hover:bg-page hover:text-ink">
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </div>
            <div ref={leftScroll} className="min-h-0 flex-1 overflow-y-auto p-4">
            {!opposition && !lost && tabAdvisors(leftNow).length > 0 && (
              <AdvisorStrip
                key={leftNow}
                state={state}
                advisors={tabAdvisors(leftNow)}
                busy={busy?.kind === "advice" && busy.advisor ? { advisor: busy.advisor, chars: busy.chars } : null}
                askDisabled={!aiReady || Boolean(busy)}
                disabled={Boolean(busy)}
                setupBusy={busy?.kind === "politics"}
                onAsk={ask}
                onSetup={() => void setupGovernment(["officials"])}
                onApply={(advisor, at) => update(applyProposal(state, advisor, at), true)}
                onAddOrder={addOrder}
              />
            )}
            {leftNow === "orders" && (
              <OrdersPanel
                orders={state.draft}
                standing={state.standing ?? []}
                previous={state.chronicle.at(-1)?.orders ?? []}
                disabled={Boolean(busy)}
                onChange={(draft) => update({ ...state, draft, updatedAt: new Date().toISOString() })}
                onStanding={(standing) => update({ ...state, standing, updatedAt: new Date().toISOString() })}
                operationsCount={(state.directives ?? []).filter((d) => d.operation).length}
                operations={
                  opposition ? undefined : (
                    <OperationsPanel
                      state={state}
                      disabled={Boolean(busy)}
                      onDirectives={(directives) => update({ ...state, directives, updatedAt: new Date().toISOString() })}
                      onConsult={(advisor) => {
                        setConsult((c) => ({ advisor, question: "", n: (c?.n ?? 0) + 1 }));
                        setLeft("cabinet");
                      }}
                    />
                  )
                }
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
                      onClick={() => void sealSave(state).then((sealed) => downloadFile(saveFileName(`${state.scenarioId}-${state.player}`, state.turn), sealed, "application/octet-stream"))}
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
                              {changedRegions(listedChanges(entry.applied)).length > 0 && (
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
                onAddOrder={addOrder}
                onApply={(advisor, at) => update(applyProposal(state, advisor, at), true)}
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
                bioStatus={bioStatus}
                onRequestBio={(name) => void requestBioFor(name)}
              />
            )}
            {leftNow === "politics" && (
              <PoliticsPanel
                state={state}
                busy={busy?.kind === "politics" ? busy : null}
                disabled={!aiReady || Boolean(busy)}
                onLoad={() => void setupGovernment(["politics"])}
                regionName={(id) => (map?.index.regions[id] ? provinceName(map.index.regions[id], locale) : id)}
                onConvene={openSitting}
                onResumeSession={setSitting}
                onTalks={startTalks}
                onOrder={(order) => {
                  if (state.draft.includes(order) || state.draft.length + (state.standing?.length ?? 0) >= MAX_TURN_ORDERS) return;
                  update({ ...state, draft: [...state.draft, order], updatedAt: new Date().toISOString() });
                }}
              />
            )}
            {leftNow === "economy" && (
              <EconomyCenter
                state={state}
                accounts={accounts?.get(state.player)}
                regions={map?.index.regions ?? null}
                disabled={Boolean(busy) || opposition}
                onBudget={(budget) => update(setBudget(state, budget), true)}
                onSign={(offer) => map && update(signOffer(state, offer.id, map.index.regions), true)}
                onDecline={(offer) => update(declineOffer(state, offer), true)}
                onCancel={(id) => update(cancelDeal(state, id), true)}
              />
            )}
            {leftNow === "army" && (
              <ArmyPanel
                state={state}
                accounts={accounts?.get(state.player)}
                regions={map?.index.regions}
                disabled={Boolean(busy) || lost || opposition}
                learning={busy?.kind === "army"}
                onFocus={(kinds) => update(setArmsFocus(state, kinds), true)}
                onLearn={() => void describeArmy()}
                onShowRegions={(regions) => setFocus({ key: Date.now(), regions })}
                onOrder={(order) => {
                  if (state.draft.includes(order) || state.draft.length + (state.standing?.length ?? 0) >= MAX_TURN_ORDERS) return false;
                  update({ ...state, draft: [...state.draft, order], updatedAt: new Date().toISOString() });
                  return true;
                }}
              />
            )}
            {leftNow === "science" && (
              <SciencePanel
                state={state}
                disabled={Boolean(busy) || lost || opposition}
                onShares={(shares) => update({ ...setShares(state, shares), updatedAt: new Date().toISOString() }, true)}
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
                section={foreignSection}
                onSection={setForeignSection}
                places={map ? (id) => (map.index.regions[id] ? provinceName(map.index.regions[id], locale) : id) : undefined}
                talkTarget={diplomacyTarget}
                onTalkTarget={setDiplomacyTarget}
                talking={busy?.kind === "diplomacy" ? busy : null}
                canTalk={aiReady}
                talksOff={opposition}
                onSend={send}
              />
            )}

            </div>
          </aside>
        )}

        <section data-tour="map" className="relative order-1 h-[42vh] shrink-0 border-b border-line lg:order-none lg:h-auto lg:min-w-0 lg:flex-1 lg:border-b-0">
          {map ? (
            <WorldMap
              controls={<TurnLength step={state.step} disabled={Boolean(busy)} onStep={(step: TimeStep) => update({ ...state, step, updatedAt: new Date().toISOString() })} />}
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
              changes={shownTurn ? { key: `${shownTurn.turn}-${pulse}`, applied: listedChanges(shownTurn.applied), turn: shownTurn.turn, onLatest: mapTurn !== null ? () => setMapTurn(null) : undefined, onShow: () => showOnMap(shownTurn) } : null}
              focus={focus ?? { key: 0, country: state.player }}
              diplomacy={diplomacy}
              onSelect={(tag, province) => {
                if (!tag) {
                  setSelectedProvince(null);
                  setSelected((now) => now ?? state.player);
                  return;
                }
                // With the talks open, a country picked on the map is the one to write to; the panel stays.
                if (leftNow === "foreign" && foreignSection === "talks" && !opposition && tag !== state.player) {
                  setDiplomacyTarget(tag);
                  setSelected(tag);
                  setSelectedProvince(province);
                  return;
                }
                setSelected(tag);
                setSelectedProvince(province);
                if (tag !== state.player) setDiplomacyTarget(tag);
                setRight("country");
                // Where both side panels do not fit, the selection replaces the open one.
                if (!window.matchMedia("(min-width: 1536px)").matches) setLeft(null);
              }}
              className="h-full w-full bg-sea map-frame"
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
            <div className="absolute inset-x-3 bottom-3 z-20 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-500/40 sheet p-3 shadow-lg sm:right-auto">
              <span className="text-sm font-bold text-ink">{t("game.needAi")}</span>
              <GameMasterOffer compact />
            </div>
          )}
          <GameMasterChoice open={choosingMaster} onClose={() => setChoosingMaster(false)} onDemo={() => void endTurn()} />

          {busy?.kind === "turn" && !report && (
            <div className="absolute inset-0 z-30 grid place-items-center bg-page/55 backdrop-blur-[2px] animate-in fade-in">
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
                {preview && <div className="mt-3 text-xs font-bold text-ink">{t("turn.storyIn")}</div>}
                <div className="mt-5 flex justify-center gap-2">
                  {preview && (
                    <button type="button" onClick={() => setReport(preview)} className={`${ui.primary} px-4 py-2 text-xs`}>
                      {t("game.report.read")}
                    </button>
                  )}
                  <button type="button" onClick={() => busy.controller.abort()} className={`${ui.secondary} px-4 py-2 text-xs`}>
                    {t("game.cancel")}
                  </button>
                </div>
                <TurnQuote date={state.date} />
              </div>
            </div>
          )}
        </section>

        <nav className="order-2 flex gap-1 border-b border-line sheet p-1.5 lg:hidden" role="tablist">
          {[...leftTabs, ...rightTabs].map(({ id, label, icon: Icon }) => {
            const on = left ? left === id : right === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => {
                  if (id === "country") {
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

        <aside className={`order-3 min-h-0 flex-1 flex-col paper lg:order-none lg:w-[360px] lg:flex-none lg:border-l lg:border-line xl:w-[400px] ${left ? "hidden 2xl:flex" : "flex"}`}>
          <nav className="hidden gap-1 border-b border-line sheet p-1.5 lg:flex" role="tablist">
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
          <div ref={rightScroll} className="min-h-0 flex-1 overflow-y-auto p-4">
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
                coupRisk={selectedCountry.domestic && !selectedCountry.dormant && (counts.get(selectedCountry.tag) ?? 0) > 0 ? coupRiskIn(state, selectedCountry.tag, lostShares(state, map?.index.regions), incomes(state, map?.index.regions)) : undefined}
                plans={state.plans ?? []}
                player={state.player}
                view={fogView}
                laws={selectedCountry.tag === state.player ? (state.politics?.laws ?? null) : undefined}
                provinceKey={selectedProvince}
                province={
                  selectedProvince && map?.index.regions[selectedProvince] && state.regions[selectedProvince] ? (
                    <ProvinceDetails
                      province={map.index.regions[selectedProvince]}
                      region={state.regions[selectedProvince]}
                      countries={state.countries}
                      year={yearOf(state.date)}
                      start={startScale && map.index.regions[selectedProvince].pop !== undefined ? map.index.regions[selectedProvince].pop! * startScale(map.index.regions[selectedProvince].adm0) : undefined}
                    />
                  ) : undefined
                }
                footer={
                  selectedCountry.tag !== state.player && !opposition && (
                    <button
                      type="button"
                      onClick={() => {
                        setDiplomacyTarget(selectedCountry.tag);
                        setForeignSection("talks");
                        setLeft("foreign");
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

        <div className="order-4 border-t border-line sheet p-3 md:hidden">{endTurnButton("w-full py-3.5 text-sm")}</div>
      </main>

      <SummitDialog
        summit={rereadingNow}
        heading={rereadingNow ? summitHeading(rereadingNow) : undefined}
        countries={state.countries}
        scenario={state.scenarioId}
        onClose={() => (rereading ? setRereading(null) : setSummitQueue((q) => q.slice(1)))}
      />

      <LiveSummitDialog
        state={state}
        summit={liveId ? ((state.summits ?? []).find((s) => s.id === liveId) ?? null) : null}
        busy={busy ? { kind: busy.kind, chars: busy.chars, advisor: busy.advisor } : null}
        disabled={!aiReady}
        onSpeak={speakLive}
        onFinish={finishLive}
        onAsk={ask}
        onClose={() => {
          setLive(null);
          setAutoLive(null);
        }}
      />

      <SessionDialog
        state={state}
        session={sitting ? (state.politics?.sessions?.find((s) => s.id === sitting) ?? null) : null}
        busy={busy ? { kind: busy.kind, chars: busy.chars } : null}
        disabled={!aiReady}
        onSpeak={(line) => (sitting ? speakSession(state, sitting, line) : Promise.resolve(false))}
        onVote={() => sitting && update(takeVote(state, sitting), true)}
        onDraft={draftForSitting}
        onClose={() => setSitting(null)}
      />

      <TalkDialog
        talk={talksOpen ? (state.politics?.talks?.find((x) => x.id === talksOpen) ?? null) : null}
        busy={busy ? { kind: busy.kind, chars: busy.chars } : null}
        disabled={!aiReady}
        onSay={sayInTalks}
        onFinish={finishTalks}
        onDraft={draftForTalks}
        onClose={() => setTalksOpen(null)}
      />

      {touring && (
        <Tour
          scenario={state.scenarioId}
          country={text(player.name)}
          opposition={opposition}
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
        open={report !== null && !rereading && !lost}
        onClose={() => {
          setReport(null);
          setPulse((p) => p + 1);
        }}
        wide
        title={t("game.report")}
        footer={
          writing ? (
            // The rest of the turn is still being written: how long, what is left, and a way to stop.
            <div className="flex items-center gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-2 text-xs font-bold text-muted">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent" />
                <span className="min-w-0 truncate">{writing.length ? t("turn.stages.writing", { list: writing.map((s) => t(`turn.stage.${s}` as MessageKey)).join(", ") }) : t("turn.stages.counting")}</span>
                {busy && <Elapsed since={busy.startedAt} />}
              </div>
              <button type="button" onClick={() => busy?.controller.abort()} className={`${ui.secondary} shrink-0 px-4 py-2.5 text-xs`}>
                {t("game.cancel")}
              </button>
            </div>
          ) : (
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
          )
        }
      >
        {/* The entry as it stands now: the ministers' reports come in while it is open, and a turn still being written fills in. */}
        {report && <TurnReport entry={state.chronicle.find((e) => e.turn === report.turn) ?? report} state={state} index={map?.index ?? null} reporting={reporting} pending={writing ?? undefined} />}
      </Dialog>

      {picture && map && <SharePicture key={picture.turn} state={state} entry={picture} topology={map.topology} onClose={() => setPicture(null)} />}
      {timelapse && map && <Timelapse state={state} topology={map.topology} onClose={() => setTimelapse(false)} />}
    </div>
  );
  // People without a portrait dress for the game's year.
  return <PortraitYear.Provider value={yearOf(state.date)}>{screen}</PortraitYear.Provider>;
}


"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Bug, Cloud, CodeXml, Copy, Download, HardDrive, MoreHorizontal, Pencil, Play, Search, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import AppHeader from "@/components/AppHeader";
import Flag from "@/components/Flag";
import Dialog from "@/components/ui/Dialog";
import { ui } from "@/components/ui/classes";
import { APP_NAME, APP_VERSION, DOWNLOAD_URL, isDemo, ISSUES_URL, REPO_URL } from "@/constants/app";
import { formatDate, yearOf } from "@/engine/calendar";
import { SCENARIO_ORDER, SCENARIOS } from "@/engine/scenarios";
import { parseGameState } from "@/engine/schema";
import type { ScenarioId } from "@/engine/types";
import { ABOUT } from "@/i18n/about";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import { downloadFile } from "@/lib/exports";
import { deleteSave, duplicateSave, listSaves, loadSave, renameSave, writeSave, type ListedSave } from "@/lib/saves";
import { useUser } from "@/lib/supabase";

type Sort = "recent" | "turn" | "name";

/**
 * The public demo's tour of the game, screenshots of one 1950 game in
 * public/screens/1950. Each row's columns follow its pictures' proportions, so
 * the pictures in a row come out the same height.
 */
const HOW = [
  {
    cols: "md:grid-cols-2",
    cards: [
      { name: "orders", width: 1600, height: 1000 },
      { name: "turn", width: 1600, height: 1000 },
    ],
  },
  {
    cols: "sm:grid-cols-2 lg:grid-cols-3",
    cards: [
      { name: "cabinet", width: 760, height: 950 },
      { name: "parliament", width: 760, height: 950 },
      { name: "economy", width: 760, height: 950 },
      { name: "foreign", width: 760, height: 950 },
      { name: "state", width: 760, height: 950 },
      { name: "modes", width: 900, height: 1124 },
    ],
  },
  {
    cols: "md:grid-cols-[minmax(0,1.78fr)_minmax(0,1.37fr)]",
    cards: [
      { name: "picture", width: 1600, height: 900 },
      { name: "timelapse", width: 996, height: 727 },
    ],
  },
] as const;

/** "2 hours ago" in the interface language. */
function useAgo() {
  const { locale } = useI18n();
  return (iso: string) => {
    const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    const steps: [Intl.RelativeTimeFormatUnit, number][] = [
      ["year", 31536000],
      ["month", 2592000],
      ["week", 604800],
      ["day", 86400],
      ["hour", 3600],
      ["minute", 60],
    ];
    for (const [unit, size] of steps) if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
    return rtf.format(0, "minute");
  };
}

/** The actions of one save behind a "…" button. */
function SaveMenu({ onRename, onDuplicate, onExport, onDelete }: { onRename: () => void; onDuplicate: () => void; onExport: () => void; onDelete: () => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  const item = (Icon: typeof Pencil, label: string, run: () => void, danger = false) => (
    <button
      type="button"
      role="menuitem"
      onClick={() => {
        setOpen(false);
        run();
      }}
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-bold transition-colors ${danger ? "text-red-600 hover:bg-red-50" : "text-ink hover:bg-page"}`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu" aria-label={t("home.more")} title={t("home.more")} className={`${ui.iconButton} ${open ? "border-accent/30" : ""}`}>
        <MoreHorizontal className="h-4 w-4 text-muted group-hover:text-ink" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-20 mt-1.5 w-52 rounded-xl border border-line bg-surface p-1.5 shadow-lg shadow-shade/10">
          {item(Pencil, t("home.rename"), onRename)}
          {item(Copy, t("home.duplicate"), onDuplicate)}
          {item(Download, t("home.export"), onExport)}
          <div className="my-1 h-px bg-divider" />
          {item(Trash2, t("home.delete"), onDelete, true)}
        </div>
      )}
    </div>
  );
}

/**
 * The front page: the last game to pick up, the dates to start from,
 * and every saved game — searched, sorted, filtered by date, renamed,
 * copied, downloaded, deleted, or brought in from a file.
 */
export default function HomeClient() {
  const { t, text, locale } = useI18n();
  const ago = useAgo();
  const { user, ready } = useUser();
  const demo = isDemo();
  const [saves, setSaves] = useState<ListedSave[] | null>(null);
  const [toDelete, setToDelete] = useState<ListedSave | null>(null);
  const [toRename, setToRename] = useState<{ save: ListedSave; name: string } | null>(null);
  const [importError, setImportError] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [era, setEra] = useState<ScenarioId | "all">("all");
  const fileInput = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const refresh = () => listSaves().then(setSaves, () => setSaves([]));

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    listSaves().then((list) => alive && setSaves(list), () => alive && setSaves([]));
    return () => {
      alive = false;
    };
  }, [ready, user]);

  /** What a save is called: the player's name for it, or its country and year. */
  const nameOf = (s: ListedSave) => s.title || `${text(s.playerName)} · ${yearOf(s.date)}`;

  /** A save downloaded from the chronicle (here or on a friend's machine) goes back in as is. */
  const importSave = async (file: File | undefined) => {
    if (!file) return;
    setImportError(false);
    try {
      const state = parseGameState(JSON.parse(await file.text()));
      if (!state) throw new Error("not a save");
      await writeSave(state);
      router.push(`/play/${state.id}`);
    } catch {
      setImportError(true);
    }
  };

  const exportSave = async (save: ListedSave) => {
    const state = await loadSave(save.id);
    if (!state) return;
    const slug = (save.title ?? `${state.scenarioId}-${state.player}`).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
    downloadFile(`gulf-of-trump-${slug}-turn-${state.turn}.json`, JSON.stringify(state, null, 1), "application/json");
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    await deleteSave(toDelete.id);
    setSaves((list) => list?.filter((s) => s.id !== toDelete.id) ?? null);
    setToDelete(null);
  };

  const confirmRename = async () => {
    if (!toRename) return;
    await renameSave(toRename.save.id, toRename.name);
    setToRename(null);
    await refresh();
  };

  const shown = useMemo(() => {
    if (!saves) return null;
    const q = query.trim().toLowerCase();
    const list = saves.filter(
      (s) => (era === "all" || s.scenarioId === era) && (!q || [s.title ?? "", text(s.playerName), s.scenarioId, s.player].some((v) => v.toLowerCase().includes(q))),
    );
    const by: Record<Sort, (a: ListedSave, b: ListedSave) => number> = {
      recent: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
      turn: (a, b) => b.turn - a.turn || b.updatedAt.localeCompare(a.updatedAt),
      name: (a, b) => nameOf(a).localeCompare(nameOf(b), locale),
    };
    return [...list].sort(by[sort]);
    // nameOf depends only on text, already listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saves, query, era, sort, text, locale]);

  const last = saves && saves.length ? [...saves].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] : null;
  const eras = saves ? SCENARIO_ORDER.filter((id) => saves.some((s) => s.scenarioId === id)) : [];

  return (
    <div className="min-h-screen">
      <AppHeader
        title={
          <span className="flex items-center gap-2">
            <Image src="/brand/emblem.webp" alt="" width={28} height={28} unoptimized className="h-7 w-7 shrink-0" />
            {APP_NAME}
            <span className="rounded-md bg-accent px-1.5 py-0.5 text-2xs font-black uppercase tracking-widest text-on-ink">
              {t("app.stage")} {APP_VERSION}
            </span>
          </span>
        }
        subtitle={t("app.openSource")}
      />

      <main className="mx-auto max-w-6xl px-4 pb-16">
        <section
          className={`grid gap-6 pt-10 pb-8 md:pt-16 md:pb-12 animate-in fade-in slide-in-from-bottom-2 duration-500 ${
            demo ? "lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-center lg:gap-10" : "md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] md:items-end"
          }`}
        >
          <div>
            <h1 className="text-4xl md:text-7xl font-black tracking-tighter leading-none text-ink">
              {APP_NAME}
              <span className="text-accent">.</span>
            </h1>
            <p className="mt-4 max-w-2xl text-base md:text-lg font-medium text-muted">{t("app.tagline")}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <a href="#dates" className={`${ui.secondary} px-4 py-2.5 text-sm`}>
                {t("home.newGame")}
                <ArrowRight className="h-4 w-4" />
              </a>
              {demo && (
                <a href="#how" className={`${ui.secondary} px-4 py-2.5 text-sm`}>
                  {t("home.how.title")}
                </a>
              )}
            </div>
          </div>
          {demo && (
            // The game itself, where a visitor sees it first: the turn's chronicle beside the front it moved.
            <a href="#how" className="group block min-w-0 lg:row-span-2">
              <figure>
                <div className={`${ui.card} overflow-hidden shadow-xl shadow-shade/10 transition-all duration-300 group-hover:-translate-y-1 group-hover:border-accent/20`}>
                  <Image src="/screens/1950/turn.jpg" alt={t("home.how.turn.title")} width={1600} height={1000} unoptimized priority className="h-auto w-full" />
                </div>
                <figcaption className="mt-2.5 flex items-center gap-1.5 px-1 text-xs font-bold text-muted transition-colors group-hover:text-accent">
                  {t("home.hero.caption")}
                  <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                </figcaption>
              </figure>
            </a>
          )}
          {last && (
            <Link href={`/play/${last.id}`} className={`${ui.row} group flex flex-col gap-3 p-5 ${demo ? "lg:max-w-md" : ""}`}>
              <div className={ui.label}>{t("home.lastGame")}</div>
              <div className="flex items-center gap-3">
                <Flag tag={last.player} scenario={last.scenarioId} size="xl" />
                <div className="min-w-0">
                  <div className="truncate text-lg font-black leading-tight text-ink">{nameOf(last)}</div>
                  <div className="mt-0.5 text-xs font-medium text-muted">
                    {formatDate(last.date, locale)} · {t("home.turn", { n: last.turn })}
                  </div>
                </div>
              </div>
              <span className={`${ui.primary} px-4 py-3 text-xs`}>
                <Play className="h-4 w-4" />
                {t("home.continue")}
              </span>
            </Link>
          )}
        </section>

        <section id="dates" className="scroll-mt-20">
          <h2 className={`${ui.label} mb-1`}>{t("home.chooseDate")}</h2>
          <p className="mb-4 text-sm text-muted font-medium">{t("home.chooseDateHint")}</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SCENARIO_ORDER.map((id, i) => {
              const s = SCENARIOS[id];
              return (
                <Link
                  key={id}
                  href={`/new/${id}`}
                  className="group flex flex-col overflow-hidden rounded-[28px] border border-line bg-surface shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-accent/20 hover:shadow-xl hover:shadow-shade/5 animate-in fade-in slide-in-from-bottom-3"
                  style={{ animationDelay: `${i * 70}ms`, animationFillMode: "both" }}
                >
                  <div className="relative bg-night px-5 pt-6 pb-5 text-white">
                    <div className="text-6xl font-black tracking-tighter leading-none tabular-nums">{yearOf(s.startDate)}</div>
                    <div className="mt-2 text-xs font-bold uppercase tracking-widest text-white/60">{formatDate(s.startDate, locale)}</div>
                    <ArrowRight className="absolute right-5 top-6 h-5 w-5 text-white/40 transition-all group-hover:translate-x-1 group-hover:text-white" />
                    <div className="mt-4 flex gap-1.5">
                      {s.featured.slice(0, 6).map((tag) => (
                        <Flag key={tag} tag={tag} scenario={id} color={s.countries[tag]?.color} size="md" className="border-white/20" />
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-5">
                    <div className="text-lg font-black leading-tight text-ink">{text(s.title)}</div>
                    <p className="text-sm font-medium text-muted">{text(s.tagline)}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {demo && (
          <section id="how" className="mt-14 scroll-mt-20">
            <h2 className={`${ui.label} mb-1`}>{t("home.how.title")}</h2>
            <p className="mb-4 text-sm font-medium text-muted">{t("home.how.lead")}</p>
            <div className="flex flex-col gap-4">
              {HOW.map(({ cols, cards }) => (
                <div key={cards[0].name} className={`grid gap-4 ${cols}`}>
                  {cards.map(({ name, width, height }) => (
                    <figure key={name} className={`${ui.card} flex flex-col overflow-hidden`}>
                      <Image
                        src={`/screens/1950/${name}.jpg`}
                        alt={t(`home.how.${name}.title` as MessageKey)}
                        width={width}
                        height={height}
                        unoptimized
                        loading="lazy"
                        className="h-auto w-full border-b border-line"
                      />
                      <figcaption className="p-5">
                        <h3 className="text-lg font-black leading-tight text-ink">{t(`home.how.${name}.title` as MessageKey)}</h3>
                        <p className="mt-1.5 text-sm font-medium leading-relaxed text-muted">{t(`home.how.${name}.body` as MessageKey)}</p>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              ))}
            </div>
          </section>
        )}

        {demo && (
          <section id="real" className={`${ui.card} mt-12 scroll-mt-20 p-6 md:p-8`}>
            <div className="max-w-2xl">
              <h2 className="text-2xl font-black tracking-tight text-ink">{t("home.real.title")}</h2>
              <p className="mt-2 text-sm font-medium leading-relaxed text-muted">{t("home.real.body")}</p>
              <a href={DOWNLOAD_URL} target="_blank" rel="noreferrer" className={`${ui.primary} mt-5 px-5 py-3 text-sm`}>
                <Download className="h-4 w-4" />
                {t("home.real.download")}
              </a>
              <p className="mt-2 text-xs font-medium leading-relaxed text-muted">{t("home.real.unsigned")}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <a href={REPO_URL} target="_blank" rel="noreferrer" className={`${ui.secondary} px-4 py-2.5 text-xs`}>
                  <CodeXml className="h-4 w-4" />
                  {t("home.real.source")}
                </a>
                <a href={ISSUES_URL} target="_blank" rel="noreferrer" className={`${ui.secondary} px-4 py-2.5 text-xs`}>
                  <Bug className="h-4 w-4" />
                  {t("home.real.report")}
                </a>
              </div>
            </div>
          </section>
        )}

        <section
          className={`mt-12 rounded-3xl transition-colors ${dragging ? "bg-accent/5 ring-2 ring-accent/40 ring-offset-8 ring-offset-page" : ""}`}
          onDragOver={(e) => {
            if (!e.dataTransfer.types.includes("Files")) return;
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void importSave(e.dataTransfer.files?.[0]);
          }}
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className={ui.label}>
              {t("home.saves")}
              {saves && saves.length > 0 && <span className="ml-2 rounded-md bg-page px-1.5 py-0.5 tabular-nums">{saves.length}</span>}
            </h2>
            <button type="button" onClick={() => fileInput.current?.click()} className={`${ui.secondary} px-3 py-2 text-xs`}>
              <Upload className="h-3.5 w-3.5" />
              {t("home.import")}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                void importSave(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>

          {saves && saves.length > 1 && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-line bg-surface px-3 focus-within:border-ink sm:max-w-xs">
                <Search className="h-4 w-4 shrink-0 text-muted" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("home.search")} className="w-full bg-transparent py-2 text-sm font-medium text-ink outline-none placeholder:text-muted" />
              </label>
              {eras.length > 1 && (
                <div className="flex gap-1 rounded-xl bg-page p-1">
                  {(["all", ...eras] as const).map((id) => (
                    <button key={id} type="button" onClick={() => setEra(id)} className={`${ui.segment} ${era === id ? ui.segmentOn : ui.segmentOff} tabular-nums`}>
                      {id === "all" ? t("home.filter.all") : id}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-1 rounded-xl bg-page p-1">
                {(["recent", "turn", "name"] as const).map((id) => (
                  <button key={id} type="button" onClick={() => setSort(id)} className={`${ui.segment} ${sort === id ? ui.segmentOn : ui.segmentOff}`}>
                    {t(`home.sort.${id}`)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {importError && <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{t("home.importFailed")}</p>}
          {shown === null ? (
            <div className="h-20 animate-pulse rounded-2xl border border-line bg-surface" />
          ) : saves!.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1 rounded-3xl border-2 border-dashed border-line px-6 py-10 text-center text-sm font-medium text-muted">
              {t("home.noSaves")}
              <span className="text-xs">{t("home.dropHere")}</span>
            </div>
          ) : shown.length === 0 ? (
            <p className="rounded-2xl border border-line bg-surface px-4 py-6 text-center text-sm font-medium text-muted">{t("home.nothingFound")}</p>
          ) : (
            <ul className="grid gap-3">
              {shown.map((save) => (
                <li key={save.id} className={`${ui.row} flex items-center gap-4 p-4`}>
                  <div className="relative shrink-0">
                    <Flag tag={save.player} scenario={save.scenarioId} size="xl" />
                    <span className="absolute -bottom-2 -right-2 rounded-md bg-night px-1 text-[10px] font-black leading-4 text-white tabular-nums">{save.scenarioId}</span>
                  </div>
                  <Link href={`/play/${save.id}`} className="min-w-0 flex-1">
                    <div className="truncate font-black text-ink">{nameOf(save)}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-muted">
                      {save.title && <span className="font-bold text-ink/70">{text(save.playerName)}</span>}
                      <span className="tabular-nums">{formatDate(save.date, locale)}</span>
                      <span>{t("home.turn", { n: save.turn })}</span>
                      <span>{t("home.updated", { when: ago(save.updatedAt) })}</span>
                      {save.sources.includes("local") && (
                        <span className="inline-flex items-center gap-1" title={t("home.local")}>
                          <HardDrive className="h-3 w-3" />
                          <span className="max-sm:hidden">{t("home.local")}</span>
                        </span>
                      )}
                      {save.sources.includes("cloud") && (
                        <span className="inline-flex items-center gap-1" title={t("home.cloud")}>
                          <Cloud className="h-3 w-3" />
                          <span className="max-sm:hidden">{t("home.cloud")}</span>
                        </span>
                      )}
                    </div>
                  </Link>
                  <SaveMenu
                    onRename={() => setToRename({ save, name: save.title ?? "" })}
                    onDuplicate={async () => {
                      await duplicateSave(save.id, t("home.copyOf", { name: nameOf(save) }));
                      await refresh();
                    }}
                    onExport={() => void exportSave(save)}
                    onDelete={() => setToDelete(save)}
                  />
                  <Link href={`/play/${save.id}`} className={`${ui.primary} px-4 py-2.5 text-xs max-sm:px-3`}>
                    <Play className="h-4 w-4" />
                    <span className="max-sm:hidden">{t("home.play")}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6 text-xs font-medium text-muted">
          <span>
            {APP_NAME} {t("app.stage")} {APP_VERSION} · MIT ·{" "}
            <Link href="/about" className="inline-flex items-center gap-2 align-middle font-bold text-ink hover:text-accent">
              {/* eslint-disable-next-line @next/next/no-img-element -- a small static portrait */}
              <img src="/about/artem-okhten-oil.webp" alt="" width={24} height={30} className="h-[30px] w-6 rounded-md border border-line object-cover" />
              {t("home.madeBy", { name: ABOUT[locale].authorName })}
            </Link>
          </span>
          <span className="flex items-center gap-4">
            <Link href="/about" className="hover:text-accent">
              {t("nav.about")}
            </Link>
            <Link href="/privacy" className="hover:text-accent">
              {t("nav.privacy")}
            </Link>
            <a href={REPO_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-accent">
              <CodeXml className="h-4 w-4" />
              GitHub
            </a>
          </span>
        </footer>
      </main>

      <Dialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title={t("home.delete")}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setToDelete(null)} className={`${ui.secondary} px-4 py-2.5 text-sm`}>
              {t("home.cancel")}
            </button>
            <button type="button" onClick={confirmDelete} className={`${ui.primary} px-4 py-2.5 text-sm`}>
              {t("home.delete")}
            </button>
          </div>
        }
      >
        <p className="text-sm font-medium text-ink">{t("home.deleteConfirm")}</p>
        {toDelete && (
          <p className="mt-2 text-sm text-muted">
            {nameOf(toDelete)} · {formatDate(toDelete.date, locale)}
          </p>
        )}
      </Dialog>

      <Dialog
        open={toRename !== null}
        onClose={() => setToRename(null)}
        title={t("home.rename")}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setToRename(null)} className={`${ui.secondary} px-4 py-2.5 text-sm`}>
              {t("home.cancel")}
            </button>
            <button type="button" onClick={confirmRename} className={`${ui.primary} px-4 py-2.5 text-sm`}>
              {t("home.save")}
            </button>
          </div>
        }
      >
        {toRename && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void confirmRename();
            }}
          >
            <input
              autoFocus
              value={toRename.name}
              maxLength={120}
              onChange={(e) => setToRename({ ...toRename, name: e.target.value })}
              placeholder={`${text(toRename.save.playerName)} · ${yearOf(toRename.save.date)}`}
              className={ui.input}
            />
            <p className="mt-2 text-xs font-medium text-muted">{t("home.renameHint")}</p>
          </form>
        )}
      </Dialog>
    </div>
  );
}

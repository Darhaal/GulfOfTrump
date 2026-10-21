"use client";

import { useRouter } from "next/navigation";
import { Flag, Loader2, Search } from "lucide-react";
import { useMemo, useState } from "react";
import CountryFlag from "@/components/Flag";
import AppHeader from "@/components/AppHeader";
import CountryDetails from "@/components/game/CountryDetails";
import WorldMap from "@/components/map/WorldMap";
import { ui } from "@/components/ui/classes";
import { formatDate, yearOf } from "@/engine/calendar";
import { getScenario } from "@/engine/scenarios";
import { nationalAccounts, seedEconomies } from "@/engine/economy";
import { peopleByOwner } from "@/engine/provinces";
import { createGame, regionsByOwner, startingWorld } from "@/engine/setup";
import { tr } from "@/engine/text";
import { GAME_MODES, ROLE_KINDS, type GameMode, type RoleKind, type ScenarioId } from "@/engine/types";
import { useI18n } from "@/i18n/useI18n";
import { useMap } from "@/lib/maps";
import { writeSave } from "@/lib/saves";

/** Pick a country for a scenario: the start-date map, a searchable list, the briefing. */
export default function PickClient({ scenarioId }: { scenarioId: ScenarioId }) {
  const router = useRouter();
  const { t, text, locale } = useI18n();
  const scenario = getScenario(scenarioId);
  const { map, error } = useMap(scenario.map);
  const [selected, setSelected] = useState<string | null>(scenario.featured[0] ?? null);
  const [query, setQuery] = useState("");
  const [starting, setStarting] = useState(false);
  const [mode, setMode] = useState<GameMode>("free");
  const [fog, setFog] = useState(true);
  // Who the player is: the country's leader, or its opposition with the names they give (engine/role.ts).
  const [role, setRole] = useState<RoleKind>("leader");
  const [person, setPerson] = useState("");
  const [movement, setMovement] = useState("");

  // The starting world with every country's economy, as a new game will have it.
  const world = useMemo(
    () => (map ? seedEconomies({ ...startingWorld(scenario, map.regions), scenarioId: scenario.id }, map.index.regions) : null),
    [map, scenario],
  );
  const accounts = useMemo(
    () => (world && map ? nationalAccounts({ ...world, date: scenario.startDate }, map.index.regions) : null),
    [world, map, scenario],
  );
  const counts = useMemo(() => (world ? regionsByOwner(world) : new Map<string, string[]>()), [world]);
  const population = useMemo(() => (world ? peopleByOwner(world.regions, map?.index) : new Map<string, number>()), [world, map]);

  const groups = useMemo(() => {
    if (!world) return null;
    const q = query.trim().toLowerCase();
    const matches = (tag: string) => {
      const c = world.countries[tag];
      return !q || [tr(c.name, "en"), tr(c.name, locale), tag].some((s) => s.toLowerCase().includes(q));
    };
    const all = Object.keys(world.countries).filter(matches);
    const byName = (a: string, b: string) => text(world.countries[a].name).localeCompare(text(world.countries[b].name), locale);
    const featured = scenario.featured.filter((tag) => all.includes(tag));
    const dormant = all.filter((tag) => world.countries[tag].dormant && !featured.includes(tag)).sort(byName);
    const rest = all.filter((tag) => !featured.includes(tag) && !dormant.includes(tag)).sort(byName);
    return { featured, dormant, rest };
  }, [world, query, locale, scenario.featured, text]);

  const start = async () => {
    if (!map || !selected) return;
    setStarting(true);
    try {
      const state = createGame(scenario, map.regions, selected, new Date(), locale, { fog, mode, role: { kind: role, person, movement } });
      await writeSave(state);
      router.push(`/play/${state.id}`);
    } catch {
      setStarting(false);
    }
  };

  const country = world && selected ? world.countries[selected] : null;

  const listButton = (tag: string) => {
    const c = world!.countries[tag];
    const active = tag === selected;
    return (
      <button
        key={tag}
        type="button"
        onClick={() => setSelected(tag)}
        className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-bold transition-all ${
          active ? "bg-ink text-on-ink" : "text-ink hover:bg-warm"
        }`}
      >
        <CountryFlag tag={c.tag} scenario={scenario.id} color={c.color} size="sm" />
        <span className="min-w-0 flex-1 truncate">{text(c.name)}</span>
        <span className={`text-2xs tabular-nums ${active ? "text-on-ink/60" : "text-muted"}`}>{counts.get(tag)?.length ?? 0}</span>
      </button>
    );
  };

  const list = (
    <div className={`${ui.card} flex min-h-[320px] flex-col overflow-hidden lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] xl:static xl:h-full xl:max-h-none`}>
      <div className="border-b border-divider p-3">
        <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-page px-3 focus-within:border-ink focus-within:bg-surface">
          <Search className="h-4 w-4 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("pick.search")}
            className="w-full bg-transparent py-2.5 text-sm font-medium text-ink outline-none placeholder:text-gray-400"
          />
        </label>
      </div>
      <div className="max-h-[60vh] min-h-0 flex-1 overflow-y-auto p-2 lg:max-h-none">
        {groups && (
          <>
            {groups.featured.length > 0 && (
              <>
                <div className={`${ui.label} px-3 pt-2 pb-1`}>{t("pick.featured")}</div>
                {groups.featured.map(listButton)}
              </>
            )}
            {groups.dormant.length > 0 && (
              <>
                <div className={`${ui.label} px-3 pt-4 pb-1`}>{t("pick.dormant")}</div>
                {groups.dormant.map(listButton)}
              </>
            )}
            {groups.rest.length > 0 && (
              <>
                <div className={`${ui.label} px-3 pt-4 pb-1`}>{t("pick.all")}</div>
                {groups.rest.map(listButton)}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );

  // The list on the left, the map and the briefing (the start button in its
  // footer) in the middle, the chosen country on the right. On wide screens the page
  // itself stays put and each column scrolls on its own. Narrower screens
  // move the country under the map, phones stack everything.
  return (
    <div className="flex min-h-screen flex-col xl:h-dvh xl:min-h-0 xl:overflow-hidden">
      <AppHeader back="/" title={text(scenario.title)} subtitle={`${formatDate(scenario.startDate, locale)} · ${t("pick.title")}`} />

      <main className="mx-auto grid w-full max-w-[1600px] flex-1 items-start gap-4 p-4 lg:grid-cols-[240px_minmax(0,1fr)] xl:min-h-0 xl:grid-cols-[260px_minmax(0,1fr)_360px] xl:grid-rows-[minmax(0,1fr)] xl:items-stretch">
        <aside className="order-2 lg:order-none lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:self-stretch xl:row-span-1 xl:min-h-0">{list}</aside>

        <div className="order-1 flex min-w-0 flex-col gap-4 lg:order-none lg:col-start-2 lg:row-start-1 xl:min-h-0 xl:overflow-y-auto">
          <div className={`${ui.card} relative aspect-[1000/540] w-full overflow-hidden`}>
            {map && world ? (
              <WorldMap
                topology={map.topology}
                regions={world.regions}
                countries={world.countries}
                selected={selected}
                era={scenario.id}
                year={yearOf(scenario.startDate)}
                onSelect={(tag) => tag && setSelected(tag)}
                className="h-full w-full"
              />
            ) : (
              <div className="grid h-full place-items-center text-sm font-medium text-muted">
                {error ? t("error.network_error") : (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("pick.loading")}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className={`${ui.card} p-5`}>
            <div className={`${ui.label} mb-2`}>{t("pick.briefing")}</div>
            <p className="text-sm font-medium leading-relaxed text-ink">{text(scenario.briefing)}</p>
            <div className="mt-4 border-t border-divider pt-4">
              <div className={`${ui.label} mb-2`}>{t("pick.mode")}</div>
              <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={t("pick.mode")}>
                {GAME_MODES.map((m) => (
                  <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={`${ui.segment} ${mode === m ? ui.segmentOn : ui.segmentOff}`}>
                    {t(`pick.mode.${m}`)}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs font-medium text-muted">{t(`pick.mode.${mode}.hint`)}</p>
            </div>
            <div className="mt-4 border-t border-divider pt-4">
              <div className={`${ui.label} mb-2`}>{t("pick.role")}</div>
              <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={t("pick.role")}>
                {ROLE_KINDS.map((r) => (
                  <button key={r} type="button" role="radio" aria-checked={role === r} onClick={() => setRole(r)} className={`${ui.segment} ${role === r ? ui.segmentOn : ui.segmentOff}`}>
                    {t(`pick.role.${r}`)}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs font-medium text-muted">{t(`pick.role.${role}.hint`)}</p>
              {role === "opposition" && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <label className="block">
                    <span className={`${ui.label} mb-1 block`}>{t("pick.role.person")}</span>
                    <input value={person} onChange={(e) => setPerson(e.target.value)} maxLength={80} placeholder={t("pick.role.optional")} className={`${ui.input} py-2 text-sm`} />
                  </label>
                  <label className="block">
                    <span className={`${ui.label} mb-1 block`}>{t("pick.role.movement")}</span>
                    <input value={movement} onChange={(e) => setMovement(e.target.value)} maxLength={80} placeholder={t("pick.role.optional")} className={`${ui.input} py-2 text-sm`} />
                  </label>
                </div>
              )}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-divider pt-4">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted">{t("pick.hint")}</p>
                <label className="mt-2 flex cursor-pointer items-start gap-2 text-xs">
                  <input type="checkbox" checked={fog} onChange={(e) => setFog(e.target.checked)} className="mt-0.5 h-3.5 w-3.5 accent-current" />
                  <span>
                    <span className="font-bold text-ink">{t("pick.fog")}</span>
                    <span className="block font-medium text-muted">{t("pick.fogNote")}</span>
                  </span>
                </label>
              </div>
              {country && (
                <button type="button" onClick={start} disabled={starting || !map} className={`${ui.primary} max-w-full px-5 py-3 text-sm`}>
                  {starting ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Flag className="h-4 w-4 shrink-0" />}
                  <span className="truncate">{t("pick.start", { country: text(country.name) })}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <aside className="order-3 min-w-0 lg:order-none lg:col-start-2 lg:row-start-2 xl:col-start-3 xl:row-start-1 xl:min-h-0 xl:overflow-y-auto">
          {country && world && (
            <div className={`${ui.card} p-5`}>
              <CountryDetails
                country={country}
                scenario={scenario.id}
                regionCount={counts.get(country.tag)?.length ?? 0}
                population={population.get(country.tag) ?? 0}
                accounts={accounts?.get(country.tag)}
                detailed
                wars={scenario.wars.map((w) => ({ ...w }))}
                alliances={scenario.alliances.map((a) => ({ ...a }))}
                countries={world.countries}
                brief
              />
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}

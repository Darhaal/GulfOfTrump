"use client";

import { useRouter } from "next/navigation";
import { Flag, Loader2, Search } from "lucide-react";
import { useMemo, useState } from "react";
import CountryFlag from "@/components/Flag";
import AppHeader from "@/components/AppHeader";
import DownloadButton from "@/components/DownloadButton";
import CountryDetails from "@/components/game/CountryDetails";
import Portrait from "@/components/game/Portrait";
import WorldMap from "@/components/map/WorldMap";
import { ui } from "@/components/ui/classes";
import { ADVISOR_POST, ADVISOR_TITLES, ADVISORS } from "@/engine/advisors";
import { formatDate, yearOf } from "@/engine/calendar";
import { figuresOn } from "@/engine/figures";
import { personName } from "@/engine/people";
import { getScenario, newGamePath, startsOf } from "@/engine/scenarios";
import { nationalAccounts, seedEconomies } from "@/engine/economy";
import { peopleByOwner } from "@/engine/provinces";
import { ABOUT_CHARS } from "@/engine/role";
import { createGame, regionsByOwner, startingWorld } from "@/engine/setup";
import { sidesOf } from "@/engine/sides";
import { tr } from "@/engine/text";
import { COMMAND_SCOPES, GAME_MODES, ROLE_KINDS, type CommandScope, type GameMode, type OfficialPost, type RoleKind, type ScenarioId, type StartVariant } from "@/engine/types";
import { useI18n } from "@/i18n/useI18n";
import { useMap } from "@/lib/maps";
import { writeSave } from "@/lib/saves";
import { trackGameStart } from "@/lib/telemetry/game";

/** Pick a country for a scenario: the start-date map, a searchable list, the briefing, and the start (the date's day or the week before). */
export default function PickClient({ scenarioId, variant = null }: { scenarioId: ScenarioId; variant?: StartVariant | null }) {
  const router = useRouter();
  const { t, text, locale } = useI18n();
  // The start the card chose, switched here without leaving the page: the address follows, so a reload or a shared link opens the same start.
  const [chosen, setChosen] = useState<StartVariant | null>(variant);
  const starts = startsOf(scenarioId);
  const scenario = getScenario(scenarioId, chosen);
  const chooseStart = (next: StartVariant | null) => {
    // A start played as one country (the tutorial) has nothing to pick here: it begins at once.
    if (next && getScenario(scenarioId, next).player) return router.push(newGamePath(scenarioId, next));
    setChosen(next);
    window.history.replaceState(null, "", newGamePath(scenarioId, next));
  };
  const { map, error } = useMap(scenario.map);
  const [selected, setSelected] = useState<string | null>(scenario.featured[0] ?? null);
  const [query, setQuery] = useState("");
  const [starting, setStarting] = useState(false);
  const [mode, setMode] = useState<GameMode>(GAME_MODES[0]);
  // Who the player is: the country's leader, or its opposition as they describe it in a paragraph (engine/role.ts).
  const [role, setRole] = useState<RoleKind>("leader");
  const [about, setAbout] = useState("");
  // A minister's ministry or a general's command, and who they are: a person of the date or one of the player's own (engine/figures.ts).
  const [post, setPost] = useState<OfficialPost>("foreign");
  const [scope, setScope] = useState<CommandScope>("front");
  const [front, setFront] = useState("");
  const [figureName, setFigureName] = useState("");
  const [picks, setPicks] = useState<Record<string, string>>({});
  const figureRole = role === "minister" || role === "general";
  const figurePost: OfficialPost = role === "general" ? "military" : post;
  const candidates = useMemo(() => (figureRole && selected ? figuresOn(scenario.id, selected, figurePost) : []), [figureRole, selected, scenario.id, figurePost]);
  const pickKey = `${scenario.id}|${selected}|${figurePost}`;
  // The first person of the date unless the player picked another, or someone of their own ("").
  const personId = picks[pickKey] ?? candidates[0]?.id ?? "";

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
  // The map's diplomatic view of the picked country, from the start date's wars and treaties; no player yet, so no fog.
  const diplomacy = useMemo(() => ({ subject: selected, sides: selected ? sidesOf(scenario, selected) : {} }), [scenario, selected]);

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
      const chosen = figureRole ? { kind: role, post, scope, front, ...(personId ? { personId } : { person: figureName }) } : { kind: role, about };
      const state = createGame(scenario, map.regions, selected, new Date(), locale, { mode, role: chosen });
      await writeSave(state);
      trackGameStart(state);
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
      </button>
    );
  };

  const list = (
    <div className={`${ui.card} flex min-h-[320px] flex-col overflow-hidden lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] xl:static xl:h-full xl:max-h-none`}>
      <div className="border-b border-divider p-3">
        <label className="flex items-center gap-2 rounded-xl border border-line bg-page/70 px-3 focus-within:border-ink focus-within:bg-surface">
          <Search className="h-4 w-4 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("pick.search")}
            className="w-full bg-transparent py-2.5 text-sm font-medium text-ink outline-none placeholder:text-faded"
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
          {/* The map gives way so the start button stays in view, but no further than 240px: a taller briefing scrolls the column instead. */}
          <div className={`${ui.card} relative aspect-[1000/540] min-h-[240px] w-full overflow-hidden`}>
            {map && world ? (
              <WorldMap
                topology={map.topology}
                regions={world.regions}
                countries={world.countries}
                selected={selected}
                era={scenario.id}
                year={yearOf(scenario.startDate)}
                onSelect={(tag) => tag && setSelected(tag)}
                diplomacy={diplomacy}
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
            {starts.length > 1 && (
              <div className="mb-4 border-b border-divider pb-4">
                <div className={`${ui.label} mb-2`}>{t("start.label")}</div>
                <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={t("start.label")}>
                  {starts.map((v) => (
                    <button
                      key={v ?? "day"}
                      type="button"
                      role="radio"
                      aria-checked={chosen === v}
                      onClick={() => chooseStart(v)}
                      className={`${ui.segment} ${chosen === v ? ui.segmentOn : ui.segmentOff} flex flex-col items-start gap-0.5 text-left`}
                    >
                      <span className="tabular-nums">{formatDate(getScenario(scenarioId, v).startDate, locale)}</span>
                      <span className={`text-2xs font-black uppercase tracking-widest ${chosen === v ? "text-accent" : "text-faded"}`}>{t(v && getScenario(scenarioId, v).player ? "start.tutorial" : v ? "start.eve" : "start.day")}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs font-medium text-muted">{t(chosen ? "pick.start.eve.hint" : "pick.start.day.hint")}</p>
              </div>
            )}
            <div className={`${ui.label} mb-2`}>{t("pick.briefing")}</div>
            <p key={chosen ?? "day"} className="text-sm font-medium leading-relaxed text-ink animate-in fade-in duration-300">
              {text(scenario.briefing)}
            </p>
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
                <label className="mt-3 block">
                  <span className={`${ui.label} mb-1 flex items-baseline justify-between gap-2`}>
                    {t("pick.role.about")}
                    <span className="font-medium normal-case tracking-normal tabular-nums">
                      {about.length}/{ABOUT_CHARS}
                    </span>
                  </span>
                  <textarea
                    value={about}
                    onChange={(e) => setAbout(e.target.value)}
                    maxLength={ABOUT_CHARS}
                    rows={4}
                    placeholder={t("pick.role.aboutPlaceholder")}
                    className={`${ui.input} resize-y py-2 text-sm leading-relaxed`}
                  />
                </label>
              )}
              {figureRole && (
                <div className="mt-3 flex flex-col gap-3">
                  {role === "minister" ? (
                    <div>
                      <div className={`${ui.label} mb-2`}>{t("pick.figure.post")}</div>
                      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={t("pick.figure.post")}>
                        {ADVISORS.map((a) => (
                          <button key={a} type="button" role="radio" aria-checked={post === ADVISOR_POST[a]} onClick={() => setPost(ADVISOR_POST[a])} className={`${ui.segment} ${post === ADVISOR_POST[a] ? ui.segmentOn : ui.segmentOff}`}>
                            {text(ADVISOR_TITLES[a])}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className={`${ui.label} mb-2`}>{t("pick.figure.scope")}</div>
                      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={t("pick.figure.scope")}>
                        {COMMAND_SCOPES.map((s) => (
                          <button key={s} type="button" role="radio" aria-checked={scope === s} onClick={() => setScope(s)} className={`${ui.segment} ${scope === s ? ui.segmentOn : ui.segmentOff}`}>
                            {t(`pick.figure.scope.${s}`)}
                          </button>
                        ))}
                      </div>
                      {scope === "front" && (
                        <label className="mt-2 block">
                          <span className={`${ui.label} mb-1 block`}>{t("pick.figure.front")}</span>
                          <input value={front} onChange={(e) => setFront(e.target.value)} maxLength={80} placeholder={t("pick.figure.frontPlaceholder")} className={`${ui.input} py-2`} />
                        </label>
                      )}
                    </div>
                  )}
                  <div>
                    <div className={`${ui.label} mb-2`}>{t("pick.figure.person")}</div>
                    {candidates.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("pick.figure.person")}>
                        {[...candidates.map((p) => ({ id: p.id, person: p })), { id: "", person: null }].map(({ id, person }) => {
                          const on = personId === id;
                          const label = person ? personName(person, locale) : t("pick.figure.someone");
                          return (
                            <button
                              key={id || "someone"}
                              type="button"
                              role="radio"
                              aria-checked={on}
                              onClick={() => setPicks((all) => ({ ...all, [pickKey]: id }))}
                              className={`flex items-center gap-2 rounded-xl border px-2 py-1.5 text-xs font-bold transition-all ${on ? "border-ink bg-divider text-ink" : "border-line text-muted hover:text-ink"}`}
                            >
                              {/* A portrait only of the person themselves; someone without one has none. */}
                              {person?.portrait && <Portrait portrait={person.portrait} gender={person.gender} name={label} size="xs" />}
                              <span>{label}</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs font-medium text-muted">{t("pick.figure.none")}</p>
                    )}
                    {!personId && (
                      <input value={figureName} onChange={(e) => setFigureName(e.target.value)} maxLength={80} placeholder={t("pick.figure.namePlaceholder")} className={`${ui.input} mt-2 py-2`} />
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-divider pt-4">
              <p className="min-w-0 flex-1 text-xs font-medium text-muted">{t("pick.hint")}</p>
              {country && (
                <button type="button" onClick={start} disabled={starting || !map} className={`${ui.primary} max-w-full px-5 py-3 text-sm`}>
                  {starting ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Flag className="h-4 w-4 shrink-0" />}
                  <span className="truncate">{t("pick.start", { country: text(country.name) })}</span>
                </button>
              )}
            </div>
            <DownloadButton variant="link" why className="mt-3 text-xs" />
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

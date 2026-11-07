import { z } from "zod";
import { roll } from "./dice";
import { payOffBudget, STEP_YEARS } from "./economy";
import { officialAt } from "./government";
import { dressOfficial } from "./people";
import { raiseAlarm } from "./relations";
import { aheadOf, techYear, yearFraction } from "./researchEffects";
import {
  SPACE_FOCUSES,
  SPACE_MILESTONES,
  type AppliedChange,
  type GameState,
  type Locale,
  type Localized,
  type Official,
  type ScenarioId,
  type SpaceFocus,
  type SpaceMilestone,
  type SpaceProgramme,
  type SpaceState,
} from "./types";

/**
 * The space race. Every country with a rocket programme moves along the same
 * road history's leaders took – intercontinental missiles, the first
 * satellite, an animal and then a man in orbit, a walk in space, a crew around
 * the Moon and on it, a station, reusable craft, navigation from orbit – each
 * feat reached by the engine's dice and the programme's means, never by the
 * calendar.
 *
 * A programme has a year of space technology (`level`): the leading
 * programme at history's pace keeps the calendar's, the rest lag behind it.
 * Money buys the pace: a share of the research money (for the player, taken
 * from what the seven directions get; for every other government, of the
 * research money its budgets would give), against what history's leader
 * spent, with the player's rockets and missiles (the strategic direction of
 * research, engine/research.ts) and industry ahead of the world helping and
 * the head of the programme's hand. Each feat needs the technology of the day
 * it was first made and work of its own – years of it at history's pace,
 * begun once the technology is near – and then a launch from a site the
 * country holds, which can fail. So the Soviet Union of 1957, a little ahead
 * and spending heavily, is likelier to orbit the first satellite, the United
 * States, richer, likelier to reach the Moon; neither is sure.
 *
 * A feat brings prestige: support at home, trust abroad, a headline in the
 * world's news; the first in the world brings most. Missiles, reconnaissance
 * and early-warning satellites are the army's: they raise a nuclear power's
 * deterrence a little, and a government with eyes in orbit knows more of
 * the world (engine/fog.ts). Launch sites are real places on provinces with
 * the year each opened; one passes with its province to whoever holds it,
 * and the player can order one built.
 */

const L = (en: string, ru: string, uk: string): Localized => ({ en, ru, uk });
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const round2 = (v: number) => Math.round(v * 100) / 100;
const round4 = (v: number) => Math.round(v * 10000) / 10000;

/** The date some years later, to the day. */
function addYears(date: string, years: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Math.round(years * 365.25));
  return d.toISOString().slice(0, 10);
}

export interface MilestoneInfo {
  /** The day history first made it: its year is the technology it needs. */
  first: string;
  /** Years of work at history's pace. */
  cost: number;
  /** What must be done first. */
  needs: SpaceMilestone[];
  /** The army's: no crowd watches it, rivals fear it. */
  military?: true;
  /** What the first in the world is worth at home and abroad; the rest get a third. */
  prestige: number;
  name: Localized;
  effect: Localized;
}

export const MILESTONES: Record<SpaceMilestone, MilestoneInfo> = {
  icbm: {
    first: "1957-08-21",
    cost: 2,
    needs: [],
    military: true,
    prestige: 0,
    name: L("Intercontinental missile", "Межконтинентальная ракета", "Міжконтинентальна ракета"),
    effect: L("A nuclear power's bombs can reach any enemy: deterrence grows", "Бомбы ядерной державы достают любого врага: сдерживание растёт", "Бомби ядерної держави дістають будь-якого ворога: стримування зростає"),
  },
  satellite: {
    first: "1957-10-04",
    cost: 1.5,
    needs: [],
    prestige: 10,
    name: L("The first satellite", "Первый спутник", "Перший супутник"),
    effect: L("An artificial moon over every capital", "Искусственная луна над каждой столицей", "Штучний місяць над кожною столицею"),
  },
  animal: {
    first: "1957-11-03",
    cost: 0.3,
    needs: ["satellite"],
    prestige: 3,
    name: L("An animal in orbit", "Животное на орбите", "Тварина на орбіті"),
    effect: L("A living creature survives the launch: the way to a man is open", "Живое существо пережило запуск: путь человеку открыт", "Жива істота пережила запуск: шлях людині відкрито"),
  },
  recon: {
    first: "1960-08-18",
    cost: 2,
    needs: ["satellite"],
    military: true,
    prestige: 0,
    name: L("Reconnaissance satellites", "Спутники-разведчики", "Супутники-розвідники"),
    effect: L("Photographs from orbit: more is known of every country and its army", "Снимки с орбиты: о каждой стране и её армии известно больше", "Знімки з орбіти: про кожну країну та її армію відомо більше"),
  },
  human: {
    first: "1961-04-12",
    cost: 2.5,
    needs: ["animal"],
    prestige: 10,
    name: L("A man in orbit", "Человек на орбите", "Людина на орбіті"),
    effect: L("A cosmonaut around the Earth and back", "Космонавт облетел Землю и вернулся", "Космонавт облетів Землю й повернувся"),
  },
  spacewalk: {
    first: "1965-03-18",
    cost: 1,
    needs: ["human"],
    prestige: 4,
    name: L("A walk in space", "Выход в открытый космос", "Вихід у відкритий космос"),
    effect: L("A man outside his craft", "Человек вне корабля", "Людина поза кораблем"),
  },
  "lunar-flyby": {
    first: "1968-12-24",
    cost: 3,
    needs: ["human"],
    prestige: 6,
    name: L("A crew around the Moon", "Экипаж облетел Луну", "Екіпаж облетів Місяць"),
    effect: L("People see the far side with their own eyes", "Люди своими глазами видят обратную сторону", "Люди на власні очі бачать зворотний бік"),
  },
  moon: {
    first: "1969-07-20",
    cost: 1.5,
    needs: ["lunar-flyby", "spacewalk"],
    prestige: 12,
    name: L("Men on the Moon", "Люди на Луне", "Люди на Місяці"),
    effect: L("A flag on another world", "Флаг на другом небесном теле", "Прапор на іншому небесному тілі"),
  },
  warning: {
    first: "1970-11-06",
    cost: 3,
    needs: ["recon"],
    military: true,
    prestige: 0,
    name: L("Early-warning satellites", "Спутники раннего предупреждения", "Супутники раннього попередження"),
    effect: L("A missile launch is seen as it leaves the ground: no strike can disarm the country", "Пуск ракеты виден с момента старта: обезоружить страну ударом нельзя", "Пуск ракети видно від старту: роззброїти країну ударом неможливо"),
  },
  station: {
    first: "1971-04-19",
    cost: 2.5,
    needs: ["human"],
    prestige: 4,
    name: L("A space station", "Орбитальная станция", "Орбітальна станція"),
    effect: L("People live and work in orbit", "Люди живут и работают на орбите", "Люди живуть і працюють на орбіті"),
  },
  reusable: {
    first: "1981-04-12",
    cost: 7,
    needs: ["human"],
    prestige: 4,
    name: L("A reusable spacecraft", "Многоразовый корабль", "Багаторазовий корабель"),
    effect: L("A craft that flies again", "Корабль, который летает снова", "Корабель, що літає знову"),
  },
  navigation: {
    first: "1993-12-08",
    cost: 5,
    needs: ["satellite"],
    military: true,
    prestige: 2,
    name: L("Satellite navigation", "Спутниковая навигация", "Супутникова навігація"),
    effect: L("Armies, ships and aircraft know where they are anywhere on Earth", "Армия, флот и авиация знают, где они, в любой точке Земли", "Армія, флот і авіація знають, де вони, у будь-якій точці Землі"),
  },
};

/** The year of technology a feat needs. */
export const needYear = (m: SpaceMilestone): number => yearFraction(MILESTONES[m].first);

// ---- launch sites

export interface Cosmodrome {
  id: string;
  name: Localized;
  /** The standard map's province, and the part of it on a finer map where that differs (engine/refine.ts). */
  province: string;
  fine?: string;
  /** The day it opened. */
  opened: string;
  /** Longitude and latitude, for the map's marker. */
  at: [number, number];
}

/** The world's launch sites, real ones only, with the day each opened (the first launch, or the decree that founded it). */
export const COSMODROMES: Cosmodrome[] = [
  { id: "kapustin-yar", name: L("Kapustin Yar", "Капустин Яр", "Капустин Яр"), province: "ru-astrakhan", fine: "ru-astrakhan-akhtubinsk", opened: "1946-05-13", at: [45.8, 48.6] },
  { id: "wallops", name: L("Wallops Island", "Уоллопс", "Воллопс"), province: "us-virginia", opened: "1945-07-04", at: [-75.47, 37.84] },
  { id: "hammaguir", name: L("Hammaguir", "Хаммагир", "Хаммагір"), province: "dz-bechar", opened: "1947-04-24", at: [-3.05, 30.9] },
  { id: "woomera", name: L("Woomera", "Вумера", "Вумера"), province: "au-south-australia", fine: "au-south-australia-port-augusta", opened: "1947-04-01", at: [136.5, -30.95] },
  { id: "cape-canaveral", name: L("Cape Canaveral", "Мыс Канаверал", "Мис Канаверал"), province: "us-florida", fine: "us-florida-melbourne", opened: "1950-07-24", at: [-80.6, 28.5] },
  { id: "baikonur", name: L("Baikonur (Tyuratam)", "Байконур (Тюратам)", "Байконур (Тюратам)"), province: "kab-baikonur", opened: "1955-06-02", at: [63.3, 45.9] },
  { id: "plesetsk", name: L("Plesetsk", "Плесецк", "Плесецьк"), province: "ru-arkhangelsk", fine: "ru-arkhangelsk-velsk", opened: "1957-07-15", at: [40.6, 62.9] },
  { id: "jiuquan", name: L("Jiuquan", "Цзюцюань", "Цзюцюань"), province: "cn-inner-mongolia", fine: "cn-inner-mongolia-gobi-desert-inner-mongolia", opened: "1958-10-20", at: [100.3, 40.96] },
  { id: "vandenberg", name: L("Vandenberg", "Ванденберг", "Ванденберг"), province: "us-california", fine: "us-california-santa-maria", opened: "1958-10-04", at: [-120.6, 34.7] },
  { id: "uchinoura", name: L("Uchinoura (Kagoshima)", "Утиноура (Кагосима)", "Утіноура (Каґосіма)"), province: "jp-kyushu", fine: "jp-kagoshima-prefecture", opened: "1962-02-01", at: [131.08, 31.25] },
  { id: "kourou", name: L("Kourou", "Куру", "Куру"), province: "fr-guyane-francaise", fine: "fr-french-guiana", opened: "1968-04-09", at: [-52.8, 5.2] },
  { id: "taiyuan", name: L("Taiyuan", "Тайюань", "Тайюань"), province: "cn-shanxi", fine: "cn-shanxi-yangjiaying", opened: "1968-12-18", at: [111.6, 38.85] },
  { id: "tanegashima", name: L("Tanegashima", "Танэгасима", "Танеґасіма"), province: "jp-kyushu", fine: "jp-kagoshima-prefecture", opened: "1969-10-01", at: [130.97, 30.4] },
  { id: "sriharikota", name: L("Sriharikota", "Шрихарикота", "Шріхарікота"), province: "in-andhra-pradesh", fine: "in-andhra-pradesh-srikalahasti", opened: "1971-10-09", at: [80.23, 13.72] },
  { id: "xichang", name: L("Xichang", "Сичан", "Січан"), province: "cn-sichuan", fine: "cn-sichuan-xichang", opened: "1984-01-29", at: [102.03, 28.25] },
  { id: "palmachim", name: L("Palmachim", "Пальмахим", "Пальмахім"), province: "il-central", opened: "1988-09-19", at: [34.69, 31.88] },
  { id: "alcantara", name: L("Alcântara", "Алкантара", "Алкантара"), province: "br-maranhao", fine: "br-maranhao-sao-jose-de-ribamar", opened: "1990-02-21", at: [-44.4, -2.37] },
  { id: "semnan", name: L("Semnan", "Семнан", "Семнан"), province: "ir-semnan", fine: "ir-semnan-semnan-semnan", opened: "2009-02-02", at: [53.9, 35.23] },
  { id: "naro", name: L("Naro", "Наро", "Наро"), province: "kr-south-jeolla", opened: "2009-08-25", at: [127.53, 34.43] },
  { id: "sohae", name: L("Sohae", "Сохэ", "Сохе"), province: "kp-north-pyongan", opened: "2012-04-13", at: [124.7, 39.66] },
  { id: "vostochny", name: L("Vostochny", "Восточный", "Східний"), province: "ru-amur", opened: "2016-04-28", at: [128.33, 51.88] },
  { id: "wenchang", name: L("Wenchang", "Вэньчан", "Веньчан"), province: "cn-hainan", opened: "2016-06-25", at: [110.95, 19.61] },
];

/** A launch site as it stands: open or not on the date, who holds it. */
export interface SiteView {
  id: string;
  name: Localized | string;
  province: string;
  holder: string;
  /** Opens on this day, when not yet open. */
  opens?: string;
  /** Ordered in play. */
  built?: boolean;
  at?: [number, number];
}

type SiteState = Pick<GameState, "regions" | "date"> & { space?: SpaceState };

/** The province a site lies in on the map the game is played on. */
export function siteRegion(state: Pick<GameState, "regions">, site: Pick<Cosmodrome, "province" | "fine">): string | undefined {
  if (site.fine && state.regions[site.fine]) return site.fine;
  return state.regions[site.province] ? site.province : undefined;
}

/** Every launch site, the real ones and those built in play, with whoever holds its province; those not yet open only when asked. */
export function sitesOf(state: SiteState, options: { coming?: boolean } = {}): SiteView[] {
  const out: SiteView[] = [];
  for (const c of COSMODROMES) {
    const id = siteRegion(state, c);
    if (!id) continue;
    const open = c.opened <= state.date;
    if (!open && !options.coming) continue;
    out.push({ id: c.id, name: c.name, province: id, holder: state.regions[id].controller, at: c.at, ...(open ? {} : { opens: c.opened }) });
  }
  for (const s of state.space?.sites ?? []) {
    if (!state.regions[s.province]) continue;
    const open = s.opens <= state.date;
    if (!open && !options.coming) continue;
    out.push({ id: s.id, name: s.name, province: s.province, holder: state.regions[s.province].controller, built: true, ...(open ? {} : { opens: s.opens }) });
  }
  return out;
}

/** Whether two governments share a military alliance: an ally lends its launch site. */
function allied(state: Pick<GameState, "alliances">, a: string, b: string): boolean {
  return state.alliances.some((x) => (!x.kind || x.kind === "alliance") && x.members.length <= 30 && x.members.includes(a) && x.members.includes(b));
}

/** The sites a country can launch from: its own, or an ally's. */
export function launchSites(state: SiteState & Pick<GameState, "alliances">, tag: string): SiteView[] {
  return sitesOf(state).filter((s) => s.holder === tag || allied(state, s.holder, tag));
}

// ---- history: who made what, and when

/** Each country's feats as history dated them. The Russian Federation carries on the Soviet programme. */
const SOVIET: Partial<Record<SpaceMilestone, string>> = {
  icbm: "1957-08-21",
  satellite: "1957-10-04",
  animal: "1957-11-03",
  human: "1961-04-12",
  recon: "1962-04-26",
  spacewalk: "1965-03-18",
  station: "1971-04-19",
  warning: "1972-09-19",
  reusable: "1988-11-15",
  navigation: "1995-12-14",
};
const HISTORY: Record<string, Partial<Record<SpaceMilestone, string>>> = {
  ussr: SOVIET,
  russia: SOVIET,
  usa: {
    satellite: "1958-02-01",
    icbm: "1958-11-28",
    recon: "1960-08-18",
    animal: "1961-11-29",
    human: "1962-02-20",
    spacewalk: "1965-06-03",
    "lunar-flyby": "1968-12-24",
    moon: "1969-07-20",
    warning: "1970-11-06",
    station: "1973-05-14",
    reusable: "1981-04-12",
    navigation: "1993-12-08",
  },
  france: { satellite: "1965-11-26", recon: "1995-07-07" },
  china: { satellite: "1970-04-24", recon: "1975-11-26", icbm: "1980-05-18", animal: "1990-10-05", human: "2003-10-15", spacewalk: "2008-09-27", station: "2011-09-29", navigation: "2012-12-27" },
  japan: { satellite: "1970-02-11", recon: "2003-03-28", navigation: "2018-11-01" },
  uk: { satellite: "1971-10-28" },
  india: { satellite: "1980-07-18", recon: "2001-10-22", icbm: "2012-04-19", navigation: "2016-04-28" },
  israel: { satellite: "1988-09-19", recon: "1995-04-05" },
  iran: { satellite: "2009-02-02" },
  "north-korea": { satellite: "2012-12-12", icbm: "2017-07-04" },
  "south-korea": { satellite: "2013-01-30" },
};

/**
 * Before the war no one had flown anything, so history's lags cannot place
 * the rocket programmes: how many years each was behind the leader instead.
 */
const EARLY: Partial<Record<ScenarioId, Record<string, number>>> = {
  // January 1933: the Army's rocket station at Kummersdorf has von Braun since October; the Soviet GIRD launches its first rockets this summer.
  "1933": { germany: 0, ussr: 1, usa: 4, uk: 8, france: 7, japan: 10, italy: 9 },
  "1939": { germany: 0, ussr: 2, usa: 3, uk: 6, france: 6, japan: 8, italy: 8 },
};

/**
 * What each government put into its rocket and space programme on the start
 * date, % of its research money; a country with a programme not listed puts
 * in a little. The Soviet Union of 1957 spent about a hundredth of its output
 * on rockets, NASA at its height seven tenths of America's.
 */
const START_SHARE: Partial<Record<ScenarioId, Record<string, number>>> = {
  "1933": { germany: 3, ussr: 2 },
  "1939": { germany: 10, ussr: 4, usa: 1 },
  "1950": { ussr: 25, usa: 6, uk: 3, france: 3 },
  "1957": { ussr: 35, usa: 8, uk: 4, france: 5, china: 6, japan: 2 },
  "1964": { usa: 30, ussr: 35, france: 10, china: 10, uk: 3, japan: 3, india: 2 },
  // After Apollo: NASA's budget halved since 1966, Skylab in orbit; the Soviets' Salyut stations and their failing N1 Moon rocket.
  "1973": { usa: 20, ussr: 30, france: 8, china: 10, japan: 5, "west-germany": 3, india: 3, uk: 2 },
  // The Shuttle late and over budget; Ariane's first flight on 24 December 1979; Salyut 6 crewed for months at a time.
  "1979": { usa: 15, ussr: 28, france: 10, china: 10, japan: 6, "west-germany": 3, india: 5, uk: 1 },
  "1991": { ussr: 15, usa: 12, china: 8, france: 8, japan: 6, india: 6, israel: 4, uk: 1 },
  "1999": { russia: 6, usa: 10, china: 10, france: 7, japan: 6, india: 7, israel: 4 },
  "2014": { usa: 8, russia: 8, china: 12, france: 6, japan: 6, india: 8, israel: 4, iran: 4, "north-korea": 10, "south-korea": 4, uk: 1 },
  "2022": { usa: 8, russia: 7, china: 13, france: 6, japan: 6, india: 8, israel: 4, iran: 5, "north-korea": 12, "south-korea": 5, uk: 2 },
};

/** A country with no programme of its own starts this far behind the leader. */
const DEFAULT_LAG = 25;
/** Most the research money a programme takes, %. */
export const MAX_SHARE = 50;
/** The share a programme takes when nothing else says, %. */
const SMALL_SHARE = 2;

/** "1957-10" from a year with its fraction. */
function monthOf(year: number): string {
  const y = Math.floor(year);
  const m = Math.min(12, Math.floor((year - y) * 12 + 1e-6) + 1);
  return `${y}-${String(m).padStart(2, "0")}-01`;
}

/** What history's government put into its programme on a start date, % of its research money, where the game knows it. */
export const startShareOf = (era: ScenarioId, tag: string): number | undefined => START_SHARE[era]?.[tag];

/** The share a government's programme drifts back to: its start's, or a little. */
const baseShare = (era: ScenarioId, tag: string) => START_SHARE[era]?.[tag] ?? SMALL_SHARE;

type StartState = Pick<GameState, "scenarioId" | "date" | "player" | "countries">;

/** One country's programme on the start date: its feats so far, its lag behind the leader, the work under way on the next. */
function startingProgramme(state: StartState, tag: string): SpaceProgramme {
  const now = yearFraction(state.date);
  const history = HISTORY[tag] ?? {};
  const dated = (Object.entries(history) as [SpaceMilestone, string][]).sort((a, b) => a[1].localeCompare(b[1]));
  const done = dated.filter(([, d]) => d <= state.date);
  const next = dated.find(([, d]) => d > state.date);
  const lagOf = ([m, d]: [SpaceMilestone, string]) => Math.max(0, yearFraction(d) - needYear(m));
  const early = EARLY[state.scenarioId]?.[tag];
  const lag = early ?? (next ? lagOf(next) : done.length ? lagOf(done[done.length - 1]) : DEFAULT_LAG);
  const work: Partial<Record<SpaceMilestone, number>> = {};
  for (const [m, d] of dated) {
    if (d <= state.date) continue;
    const left = yearFraction(d) - now;
    const w = MILESTONES[m].cost - left;
    if (w > 0) work[m] = round2(Math.min(MILESTONES[m].cost, w));
  }
  return {
    level: round4(now - lag),
    share: baseShare(state.scenarioId, tag),
    work,
    done: done.map(([id, d]) => ({ id, date: `${d.slice(0, 7)}-01` })),
  };
}

/**
 * The space race on a new game's start date: a programme for every country
 * history gives one (whose next feat came within forty years) and for the
 * player's, and the firsts the world had made by then.
 */
export function startingSpace(state: StartState): SpaceState {
  const now = yearFraction(state.date);
  const programmes: Record<string, SpaceProgramme> = {};
  const tags = new Set([...Object.keys(HISTORY), ...Object.keys(EARLY[state.scenarioId] ?? {}), ...Object.keys(START_SHARE[state.scenarioId] ?? {})]);
  for (const tag of tags) {
    if (!state.countries[tag] || state.countries[tag].dormant) continue;
    const history = Object.values(HISTORY[tag] ?? {});
    const soon = history.some((d) => d <= state.date || yearFraction(d) - now <= 40) || EARLY[state.scenarioId]?.[tag] !== undefined;
    if (soon) programmes[tag] = startingProgramme(state, tag);
  }
  if (state.countries[state.player] && !programmes[state.player]) programmes[state.player] = { ...startingProgramme(state, state.player), share: START_SHARE[state.scenarioId]?.[state.player] ?? 0 };
  const firsts: SpaceState["firsts"] = {};
  for (const [tag, history] of Object.entries(HISTORY)) {
    // The Russian Federation's feats are the Soviet Union's.
    if (tag === "russia") continue;
    for (const [m, d] of Object.entries(history) as [SpaceMilestone, string][]) {
      if (d > state.date) continue;
      const before = firsts[m];
      if (!before || d < before.date) firsts[m] = { by: tag, date: `${d.slice(0, 7)}-01` };
    }
  }
  return { programmes, firsts };
}

// ---- what a programme can do

type PaceState = Pick<GameState, "countries" | "date" | "scenarioId" | "player"> & Partial<Pick<GameState, "research" | "officials" | "space">>;

/** The shares of the army and industry budgets that are research money (engine/research.ts's RESEARCH_POOL). */
const POOL = { army: 0.2, industry: 0.3 };

/** A country's research money a year, $bn, before its space programme takes its share. */
export function researchPool(state: Pick<GameState, "countries">, tag: string): number {
  const e = state.countries[tag]?.economy;
  return e ? Math.max(0, e.budget.army) * POOL.army + Math.max(0, e.budget.industry) * POOL.industry : 0;
}

/** A programme's money a year, $bn. */
export function spaceMoney(state: PaceState, tag: string): number {
  const p = state.space?.programmes[tag];
  return p ? (researchPool(state, tag) * clamp(p.share, 0, MAX_SHARE)) / 100 : 0;
}

/**
 * The money that keeps history's pace, as a share of the largest economy:
 * what the leading programme of the day spent. The race of the sixties, to
 * the Moon, cost most; satellites and stations cost less once known.
 */
function referenceShare(year: number): number {
  const points: [number, number][] = [
    [1945, 0.003],
    [1957, 0.004],
    [1965, 0.007],
    [1975, 0.005],
    [1990, 0.004],
    [2010, 0.003],
  ];
  if (year <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [y1, v1] = points[i];
    const [y0, v0] = points[i - 1];
    if (year <= y1) return v0 + ((v1 - v0) * (year - y0)) / (y1 - y0);
  }
  return points[points.length - 1][1];
}

/** The largest economy in the world, $bn. */
function largestEconomy(state: Pick<GameState, "countries">): number {
  return Math.max(0.01, ...Object.values(state.countries).flatMap((c) => (c.economy && !c.dormant ? [c.economy.gdp] : [])));
}

/** The head of the player's programme: 1 at an ordinary competence of 3, from 0.8 to 1.2; a vacant post costs a little. */
export function headPace(state: Pick<GameState, "officials">): number {
  const head = officialAt(state, "space");
  return head ? 0.7 + 0.1 * head.competence : 0.95;
}

const MAX_RATE = 2.5;
/** A programme this many years ahead of history goes at half the pace its money would buy. */
const LEAD_DRAG = 5;
/** What the world publishes reaches a programme behind it: years a year per year behind the newest feat, at most. */
const DIFFUSION = 0.1;
const MAX_DIFFUSION = 0.5;
/** The player's programme cannot run more than this far ahead of its rockets (the strategic direction of research). */
const ROCKET_LEAD = 1;

/** The newest feat the world has made: what is known to be possible. */
function frontier(state: Pick<GameState, "space">): number {
  const firsts = Object.keys(state.space?.firsts ?? {}) as SpaceMilestone[];
  return firsts.length ? Math.max(...firsts.map(needYear)) : 1940;
}

/** Years of space technology a programme gains a year now: its money against history's leader's, its rockets and industry, its head. */
export function spaceRate(state: PaceState, tag: string): number {
  const p = state.space?.programmes[tag];
  if (!p || p.share <= 0) return 0;
  const now = yearFraction(state.date);
  const reference = largestEconomy(state) * referenceShare(now);
  let rate = Math.sqrt(spaceMoney(state, tag) / reference);
  if (tag === state.player && state.research?.tech) {
    rate *= clamp(1 + 0.08 * aheadOf({ research: state.research, date: state.date }, "strategic"), 0.6, 1.4);
    rate *= clamp(1 + 0.03 * aheadOf({ research: state.research, date: state.date }, "industry"), 0.85, 1.2);
  }
  if (tag === state.player) rate *= headPace(state);
  rate /= 1 + Math.max(0, p.level - now) / LEAD_DRAG;
  rate += Math.min(MAX_DIFFUSION, DIFFUSION * Math.max(0, frontier(state) - p.level));
  return clamp(rate, 0, MAX_RATE);
}

/** How much faster a programme's focus works on a feat. */
function focusPace(focus: SpaceFocus | undefined, m: SpaceMilestone): number {
  if (!focus || focus === "balanced") return 1;
  const military = Boolean(MILESTONES[m].military);
  return (focus === "military") === military ? 1.3 : 0.7;
}

/** Whether a feat's work has begun: what it needs is done, and the technology is near enough. */
function workable(p: SpaceProgramme, m: SpaceMilestone): boolean {
  if (p.done.some((d) => d.id === m)) return false;
  const info = MILESTONES[m];
  return info.needs.every((n) => p.done.some((d) => d.id === n)) && p.level >= needYear(m) - info.cost;
}

/** Whether a feat can be tried now: its work done and the technology reached. */
const ready = (p: SpaceProgramme, m: SpaceMilestone) => workable(p, m) && (p.work[m] ?? 0) >= MILESTONES[m].cost - 1e-6 && p.level >= needYear(m);

/** Launches a year a programme ready for a feat makes. */
const ATTEMPTS = 6;

/** How likely one launch for a feat is to succeed: better past the technology it needs, with a good head and after failures learned from. */
function reliability(p: SpaceProgramme, m: SpaceMilestone, competence: number): number {
  return clamp(0.55 + 0.1 * (p.level - needYear(m)) + 0.05 * (competence - 3) + 0.03 * (p.failed ?? 0), 0.25, 0.9);
}

export interface FeatView {
  id: SpaceMilestone;
  /** 0–1 of the work done. */
  work: number;
  /** The technology it needs is reached. */
  reached: boolean;
  /** When it can be tried at this pace, as a year with its fraction. */
  expected?: number;
}

export interface ProgrammeView {
  tag: string;
  level: number;
  share: number;
  focus: SpaceFocus;
  money: number;
  rate: number;
  done: SpaceProgramme["done"];
  /** The feats under way or next, soonest first. */
  next: FeatView[];
  /** Sites it can launch from. */
  sites: SiteView[];
  /** Held back by its rockets: the strategic direction of research is behind. */
  rockets?: boolean;
}

/** A programme as the science panel and the game master see it. */
export function programmeView(state: PaceState & Pick<GameState, "regions" | "alliances">, tag: string): ProgrammeView | null {
  const p = state.space?.programmes[tag];
  if (!p) return null;
  const rate = spaceRate(state, tag);
  const now = yearFraction(state.date);
  const next: FeatView[] = SPACE_MILESTONES.filter((m) => !p.done.some((d) => d.id === m) && MILESTONES[m].needs.every((n) => p.done.some((d) => d.id === n))).map((m) => {
    const info = MILESTONES[m];
    const work = clamp((p.work[m] ?? 0) / info.cost, 0, 1);
    const pace = rate * focusPace(p.focus, m);
    // The technology to reach and the work to do go on side by side; the later of the two decides.
    const toTech = Math.max(0, needYear(m) - p.level) / Math.max(0.05, rate);
    const toStart = Math.max(0, needYear(m) - info.cost - p.level) / Math.max(0.05, rate);
    const toWork = toStart + (info.cost - (p.work[m] ?? 0)) / Math.max(0.05, pace);
    return { id: m, work, reached: p.level >= needYear(m), ...(rate > 0 ? { expected: round2(now + Math.max(toTech, toWork)) } : {}) };
  });
  next.sort((a, b) => (a.expected ?? Infinity) - (b.expected ?? Infinity) || needYear(a.id) - needYear(b.id));
  const rockets = tag === state.player && state.research?.tech ? p.level >= techYear({ research: state.research, date: state.date }, "strategic") + ROCKET_LEAD - 0.05 : undefined;
  return { tag, level: p.level, share: p.share, focus: p.focus ?? "balanced", money: round2(spaceMoney(state, tag)), rate: round2(rate), done: p.done, next, sites: launchSites(state, tag), ...(rockets ? { rockets } : {}) };
}

/** Whether a country has made a feat. */
export const hasFeat = (state: Pick<GameState, "space">, tag: string, m: SpaceMilestone): boolean => Boolean(state.space?.programmes[tag]?.done.some((d) => d.id === m));

/** Most an intercontinental missile and early warning add to a nuclear power's deterrence. */
const ICBM_DETERRENCE = 0.1;
const WARNING_DETERRENCE = 0.05;

/**
 * How much more a nuclear power's bombs hold others back, 1 and a little up:
 * missiles that reach any enemy, satellites that see a strike coming. Nothing
 * for a country without the bomb.
 */
export function deterrenceOf(state: Pick<GameState, "space" | "countries">, tag: string): number {
  if (!state.countries[tag]?.arsenal?.nuclear) return 1;
  return 1 + (hasFeat(state, tag, "icbm") ? ICBM_DETERRENCE : 0) + (hasFeat(state, tag, "warning") ? WARNING_DETERRENCE : 0);
}

/** What the first reconnaissance satellites add to what is known of a country they watch, and the most years of better cameras make of it. */
export const RECON_SIGHT = 6;
const RECON_MAX = 15;
/** An army this large (thousands) is worth the film. */
const WATCHED_ARMY = 200;

/**
 * What the player's reconnaissance satellites add to what its government
 * knows of a country (engine/fog.ts): film from orbit counts divisions,
 * airfields, missile sites and factories, so the estimates of armies and
 * industry narrow. The first cameras are coarse; each year after the first
 * photographs adds a little, as Corona gave way to real-time pictures. The
 * orbits are aimed at rivals, enemies and the great armies; the rest of the
 * world is covered half as well.
 */
export function reconSight(state: Pick<GameState, "space" | "player" | "countries" | "wars"> & Partial<Pick<GameState, "date">>, tag?: string): number {
  const since = state.space?.programmes[state.player]?.done.find((d) => d.id === "recon")?.date;
  if (!since) return 0;
  const years = state.date ? Math.max(0, yearFraction(state.date) - yearFraction(since)) : 0;
  const sight = Math.min(RECON_MAX, RECON_SIGHT + years / 2);
  if (!tag) return Math.round(sight);
  const atWar = state.wars.some((w) => (w.attackers.includes(tag) && w.defenders.includes(state.player)) || (w.defenders.includes(tag) && w.attackers.includes(state.player)));
  const distrust = Math.min(state.countries[tag]?.course?.ties[state.player]?.trust ?? 0, state.countries[state.player]?.course?.ties[tag]?.trust ?? 0) <= -20;
  const watched = atWar || distrust || (state.countries[tag]?.economy?.troops ?? 0) >= WATCHED_ARMY;
  return Math.round(watched ? sight : sight / 2);
}

// ---- the turn

/** A great power keeps pace with its rivals' firsts: points of share for each first a rival has and it lacks, up to the most. */
const RIVAL_PUSH = 6;
const MAX_PUSH = 30;
/** Points of share a leader gives up for each first its rivals still lack. */
const RIVAL_REST = 3;
/** How fast a government's share moves towards what it wants, of the gap a year. */
const SHARE_PACE = 1;

/** Whether two governments are rivals: at war, or one distrusts the other deeply. */
function rivals(state: GameState, a: string, b: string): boolean {
  if (state.wars.some((w) => (w.attackers.includes(a) && w.defenders.includes(b)) || (w.defenders.includes(a) && w.attackers.includes(b)))) return true;
  const ab = state.countries[a]?.course?.ties[b]?.trust ?? 0;
  const ba = state.countries[b]?.course?.ties[a]?.trust ?? 0;
  return Math.min(ab, ba) <= -20;
}

/**
 * The share a great power that the player does not lead wants for its
 * programme: its own, more while its rivals hold more of the world's firsts
 * than it does (America after Sputnik and Gagarin, all through the sixties),
 * less while it holds more than they do (a leader resting on its lead, as the
 * Soviet programme split between rival design bureaus once it was ahead),
 * never below half its own.
 */
function wantedShare(state: GameState, tag: string, great: Set<string>): number {
  const base = baseShare(state.scenarioId, tag);
  if (!great.has(tag)) return base;
  const firsts = Object.entries(state.space!.firsts) as [SpaceMilestone, { by: string }][];
  const weight = (m: SpaceMilestone) => (MILESTONES[m].military ? 0.5 : 1);
  const own = firsts.filter(([, f]) => f.by === tag).reduce((s, [m]) => s + weight(m), 0);
  const theirs = firsts.filter(([, f]) => f.by !== tag && great.has(f.by) && rivals(state, tag, f.by)).reduce((s, [m]) => s + weight(m), 0);
  // Only a race between rivals moves the money: a lead over no one is no lead.
  const raced = Object.keys(state.space!.programmes).some((o) => o !== tag && great.has(o) && rivals(state, tag, o));
  if (!raced) return base;
  const score = theirs - own;
  const want = score > 0 ? base + Math.min(MAX_PUSH, RIVAL_PUSH * score) : base - Math.min(base / 2, RIVAL_REST * -score);
  return clamp(want, 0, MAX_SHARE);
}

/** A government's people take pride in a feat, other governments note it; rivals fear a missile or the first satellite. Mutates `next`. */
export function prestige(next: GameState, tag: string, m: SpaceMilestone, first: boolean): void {
  const info = MILESTONES[m];
  const weight = info.prestige * (first ? 1 : 1 / 3);
  const country = next.countries[tag];
  if (weight > 0) {
    if (tag === next.player && next.politics) next.politics = { ...next.politics, unrest: Math.max(0, Math.round(next.politics.unrest - weight * 0.4)) };
    else if (country?.domestic) country.domestic = { ...country.domestic, support: clamp(Math.round(country.domestic.support + weight * 0.5), 0, 100) };
  }
  const fear = first && (m === "icbm" || m === "satellite") ? 10 : 0;
  for (const other of Object.values(next.countries)) {
    const course = other.course;
    if (!course || other.tag === tag) continue;
    const tie = course.ties[tag];
    // Admiration is the onlookers' and the friends': an enemy at war or a rival fears the feat, it does not trust the more for it.
    const rival = rivals(next, other.tag, tag);
    if (weight > 0 && !rival) {
      const trust = Math.round(weight * (first ? 0.3 : 0.15));
      if (tie) tie.trust = clamp(tie.trust + trust, -100, 100);
      else course.ties[tag] = { trust, tension: 0, threat: 0, near: 50 };
    }
    // The fear lasts beyond the turn: the courses' threat keeps it, halving in a year (engine/relations.ts).
    if (fear && rival) raiseAlarm(next, other.tag, tag, fear);
  }
}

/** The great powers of the race: the six largest economies. */
function greatEconomies(state: GameState): Set<string> {
  return new Set(
    Object.values(state.countries)
      .filter((c) => c.economy && !c.dormant)
      .sort((a, b) => b.economy!.gdp - a.economy!.gdp || a.tag.localeCompare(b.tag))
      .slice(0, 6)
      .map((c) => c.tag),
  );
}

/**
 * Moves every programme through a turn of `years` ending on `to`: the shares
 * others choose, the technology and the work their money buys, the launches
 * the dice decide – feats made, the firsts in the world among them, and
 * launches lost – with what each feat does at home and abroad; and the
 * launch sites that changed hands with their provinces, and those that open.
 * `before` is the state the turn began from. Mutates `next`.
 */
export function advanceSpace(before: GameState, next: GameState, years: number, applied: AppliedChange[], to: string): void {
  const space = next.space;
  if (!space || years <= 0) return;
  const game = next.seed ?? next.id;
  const from = before.date;
  // The sites whose province changed hands this turn, and those that open.
  const held = new Map(sitesOf(before).map((s) => [s.id, s.holder]));
  const after = sitesOf({ ...next, date: to });
  for (const s of after) {
    const was = held.get(s.id);
    if (was === undefined) {
      if (s.built || COSMODROMES.some((c) => c.id === s.id && c.opened > from)) applied.push({ kind: "space", country: s.holder, change: "site", site: s.id });
    } else if (was !== s.holder) applied.push({ kind: "space", country: s.holder, change: "captured", site: s.id, from: was });
  }
  const great = greatEconomies(next);
  const pace: PaceState = { ...next, date: from };
  const end = yearFraction(to);
  const made: { tag: string; m: SpaceMilestone; at: number }[] = [];
  for (const tag of Object.keys(space.programmes).sort()) {
    const p = space.programmes[tag];
    const country = next.countries[tag];
    if (!country?.economy || country.dormant || country.exile) continue;
    if (tag !== next.player) {
      const want = wantedShare(next, tag, great);
      p.share = Math.round((p.share + (want - p.share) * Math.min(1, SHARE_PACE * years)) * 10) / 10;
    }
    const rate = spaceRate(pace, tag);
    if (rate <= 0) continue;
    let level = p.level + rate * years;
    if (tag === next.player && next.research?.tech) level = Math.min(level, Math.max(p.level, techYear({ research: next.research, date: to }, "strategic") + ROCKET_LEAD));
    p.level = round4(level);
    for (const m of SPACE_MILESTONES) {
      if (!workable(p, m)) continue;
      p.work[m] = round2(Math.min(MILESTONES[m].cost, (p.work[m] ?? 0) + rate * focusPace(p.focus, m) * years));
    }
    // A launch needs a site the country holds, or an ally's.
    if (!launchSites({ ...next, date: to }, tag).length) continue;
    const competence = tag === next.player ? (officialAt(next, "space")?.competence ?? 2.5) : 3;
    const due = SPACE_MILESTONES.filter((m) => ready(p, m));
    // One feat a turn at most: the likeliest first.
    for (const m of due) {
      const q = reliability(p, m, competence);
      const tries = ATTEMPTS * years;
      const success = 1 - (1 - q) ** tries;
      const lost = Math.min(0.5, (1 - q) * Math.min(1, tries) * 0.5);
      const r = roll(game, next.turn, `space:${tag}:${m}`);
      if (r < success) {
        made.push({ tag, m, at: end - years + years * clamp(r / Math.max(1e-6, success), 0, 1) });
        break;
      }
      if (r > 1 - lost) {
        p.work[m] = round2(Math.max(0, (p.work[m] ?? 0) - 0.15 * MILESTONES[m].cost));
        p.failed = (p.failed ?? 0) + 1;
        if (tag === next.player || great.has(tag)) applied.push({ kind: "space", country: tag, change: "failed", milestone: m });
        break;
      }
    }
  }
  // Feats in the order they came within the turn: the first in the world is whoever got there first.
  made.sort((a, b) => a.at - b.at || a.tag.localeCompare(b.tag));
  for (const { tag, m, at } of made) {
    const p = space.programmes[tag];
    const date = monthOf(at);
    p.done.push({ id: m, date });
    delete p.work[m];
    delete p.failed;
    const first = !space.firsts[m];
    if (first) space.firsts[m] = { by: tag, date };
    prestige(next, tag, m, first);
    applied.push({ kind: "space", country: tag, change: "done", milestone: m, ...(first ? { first: true, ahead: round2(needYear(m) - at) } : {}) });
  }
}

// ---- what the game master proposes, the player sets

/** What a turn may change in the player's programme (merged into OutcomeSchema as `space`): its share, its focus, a site to build. */
export const spaceField = z
  .object({
    share: z.number().finite().optional().catch(undefined),
    focus: z.enum(SPACE_FOCUSES).optional().catch(undefined),
    build: z
      .array(z.object({ province: z.string().trim().min(1).max(120), name: z.string().trim().max(80).default("") }))
      .max(2)
      .catch([])
      .default([]),
  })
  .optional()
  .catch(undefined);
export type SpaceWords = { share?: number; focus?: SpaceFocus; build: { province: string; name: string }[] };

/** The most a turn moves the player's share, points. */
const MAX_SHIFT = 15;
/** Building a launch site takes this long, years; its cost is this share of GDP, at least the floor ($bn). */
const BUILD_YEARS = 2;
const BUILD_COST = 0.002;
const BUILD_FLOOR = 0.05;
/** No one builds a launch site before rockets could use one. */
const SITES_FROM = 1944;

/** The cost of a new launch site for the player, $bn. */
export const siteCost = (state: Pick<GameState, "countries" | "player">): number => Math.max(BUILD_FLOOR, round2((state.countries[state.player]?.economy?.gdp ?? 0) * BUILD_COST));

/**
 * What the game master may change: the share within MAX_SHIFT of the
 * player's, a known focus, and one site in a province the player holds where
 * none is, once rockets exist; names given instead of ids are looked up.
 */
export function sanitizeSpace(state: GameState, words: z.infer<typeof spaceField>, lookup?: (name: string) => string[] | undefined): SpaceWords | undefined {
  const p = state.space?.programmes[state.player];
  if (!words || !p) return undefined;
  const out: SpaceWords = { build: [] };
  if (words.share !== undefined) {
    const share = Math.round(clamp(words.share, Math.max(0, p.share - MAX_SHIFT), Math.min(MAX_SHARE, p.share + MAX_SHIFT)));
    if (share !== p.share) out.share = share;
  }
  if (words.focus && words.focus !== (p.focus ?? "balanced")) out.focus = words.focus;
  const taken = new Set(sitesOf(state, { coming: true }).map((s) => s.province));
  if (yearFraction(state.date) >= SITES_FROM) {
    for (const b of words.build) {
      const id = state.regions[b.province] ? b.province : lookup?.(b.province.trim().toLowerCase())?.find((x) => state.regions[x]?.controller === state.player);
      if (!id || state.regions[id]?.controller !== state.player || taken.has(id)) continue;
      out.build.push({ province: id, name: b.name });
      break;
    }
  }
  return out.share !== undefined || out.focus || out.build.length ? out : undefined;
}

/** The checked words applied to the player's programme: the share and focus at once, a site paid for and opening in two years. Mutates `next`. */
export function applySpaceWords(next: GameState, words: SpaceWords | undefined, applied: AppliedChange[], to: string): void {
  const p = next.space?.programmes[next.player];
  if (!words || !p || !next.space) return;
  if (words.share !== undefined) p.share = clamp(Math.round(words.share), 0, MAX_SHARE);
  if (words.focus) p.focus = words.focus;
  const e = next.countries[next.player]?.economy;
  for (const b of words.build) {
    if (!e) break;
    // Paid outside the budget, from the reserves, the rest borrowed (economy.ts payOffBudget).
    payOffBudget(e, siteCost(next), STEP_YEARS[next.step] ?? 1 / 12);
    const id = `site-${next.turn}-${(next.space.sites?.length ?? 0) + 1}`;
    next.space.sites = [...(next.space.sites ?? []), { id, name: b.name || id, province: b.province, opens: addYears(to, BUILD_YEARS), by: next.player }];
    applied.push({ kind: "space", country: next.player, change: "site", site: id });
  }
}

/** The player sets the programme's share of the research money. */
export function setSpaceShare<T extends Pick<GameState, "space" | "player">>(state: T, share: number): T {
  const p = state.space?.programmes[state.player];
  if (!p || !state.space) return state;
  return { ...state, space: { ...state.space, programmes: { ...state.space.programmes, [state.player]: { ...p, share: clamp(Math.round(share), 0, MAX_SHARE) } } } };
}

/** The player sets what the programme puts first. */
export function setSpaceFocus<T extends Pick<GameState, "space" | "player">>(state: T, focus: SpaceFocus): T {
  const p = state.space?.programmes[state.player];
  if (!p || !state.space) return state;
  return { ...state, space: { ...state.space, programmes: { ...state.space.programmes, [state.player]: { ...p, focus } } } };
}

// ---- the head of the programme

interface Head {
  country: string;
  from: string;
  to: string;
  name: Localized;
  title: Localized;
  competence: number;
  traits: Localized[];
}

const T = {
  chief: L("Chief Designer of the space programme", "Главный конструктор космической программы", "Головний конструктор космічної програми"),
  minister: L("Minister of General Machine Building", "Министр общего машиностроения", "Міністр загального машинобудування"),
  vonBraun: L("Technical director of the Army's rocket programme", "Технический директор ракетной программы армии", "Технічний директор ракетної програми армії"),
  nasa: L("NASA Administrator", "Администратор НАСА", "Адміністратор НАСА"),
  roscosmos: L("Head of the Russian Space Agency", "Руководитель Российского космического агентства", "Керівник Російського космічного агентства"),
  roscosmosDg: L("Director General of Roscosmos", "Генеральный директор Роскосмоса", "Генеральний директор Роскосмосу"),
  peenemunde: L("Head of the Army rocket programme at Peenemünde", "Начальник ракетной программы вермахта в Пенемюнде", "Начальник ракетної програми вермахту в Пенемюнде"),
  fifth: L("Director of the Fifth Academy (rockets)", "Директор Пятой академии (ракеты)", "Директор П'ятої академії (ракети)"),
  cnsa: L("Administrator of the China National Space Administration", "Глава Национального космического управления Китая", "Голова Національного космічного управління Китаю"),
  cnes: L("Director General of CNES", "Генеральный директор CNES", "Генеральний директор CNES"),
  cnesPresident: L("President of CNES", "Президент CNES", "Президент CNES"),
  tokyo: L("Head of rocket research at the University of Tokyo", "Руководитель ракетных исследований Токийского университета", "Керівник ракетних досліджень Токійського університету"),
  jaxa: L("President of JAXA", "Президент JAXA", "Президент JAXA"),
  incospar: L("Chairman of the Indian space research committee", "Председатель Индийского комитета космических исследований", "Голова Індійського комітету космічних досліджень"),
  isro: L("Chairman of ISRO", "Председатель ISRO", "Голова ISRO"),
};

const TRAIT = {
  driven: L("driven", "одержимый делом", "одержимий справою"),
  secretive: L("secretive", "скрытный", "потайний"),
  organiser: L("a born organiser", "прирождённый организатор", "природжений організатор"),
  showman: L("a showman", "умеет себя подать", "вміє себе подати"),
  visionary: L("a visionary", "мечтатель", "мрійник"),
  manager: L("a careful manager", "осторожный управленец", "обережний управлінець"),
  political: L("politically shrewd", "искушён в политике", "досвідчений у політиці"),
  engineer: L("an engineer first", "прежде всего инженер", "передусім інженер"),
  scientist: L("a scientist", "учёный", "науковець"),
  bureaucrat: L("a bureaucrat", "аппаратчик", "апаратник"),
};

/** Who ran each country's rocket and space programme, and when: the people the game seeds at the start, by the day. */
const HEADS: Head[] = [
  { country: "germany", from: "1937-05-01", to: "1945-05-08", name: L("Walter Dornberger", "Вальтер Дорнбергер", "Вальтер Дорнбергер"), title: T.peenemunde, competence: 4, traits: [TRAIT.organiser, TRAIT.driven] },
  { country: "ussr", from: "1946-08-09", to: "1966-01-14", name: L("Sergei Korolev", "Сергей Королёв", "Сергій Корольов"), title: T.chief, competence: 5, traits: [TRAIT.driven, TRAIT.secretive, TRAIT.organiser] },
  { country: "ussr", from: "1966-01-14", to: "1974-05-22", name: L("Vasily Mishin", "Василий Мишин", "Василь Мішин"), title: T.chief, competence: 3, traits: [TRAIT.engineer] },
  { country: "ussr", from: "1974-05-22", to: "1989-01-10", name: L("Valentin Glushko", "Валентин Глушко", "Валентин Глушко"), title: T.chief, competence: 4, traits: [TRAIT.engineer, TRAIT.driven] },
  { country: "ussr", from: "1989-01-10", to: "1991-12-26", name: L("Oleg Shishkin", "Олег Шишкин", "Олег Шишкін"), title: T.minister, competence: 3, traits: [TRAIT.bureaucrat] },
  { country: "usa", from: "1950-04-15", to: "1958-08-19", name: L("Wernher von Braun", "Вернер фон Браун", "Вернер фон Браун"), title: T.vonBraun, competence: 5, traits: [TRAIT.visionary, TRAIT.showman, TRAIT.engineer] },
  { country: "usa", from: "1958-08-19", to: "1961-01-20", name: L("T. Keith Glennan", "Томас Кит Гленнан", "Томас Кіт Гленнан"), title: T.nasa, competence: 4, traits: [TRAIT.manager, TRAIT.organiser] },
  { country: "usa", from: "1961-02-14", to: "1968-10-07", name: L("James E. Webb", "Джеймс Уэбб", "Джеймс Вебб"), title: T.nasa, competence: 5, traits: [TRAIT.political, TRAIT.organiser] },
  { country: "usa", from: "1989-07-01", to: "1992-03-31", name: L("Richard H. Truly", "Ричард Трули", "Річард Трулі"), title: T.nasa, competence: 3, traits: [TRAIT.engineer] },
  { country: "usa", from: "1992-04-01", to: "2001-11-17", name: L("Daniel Goldin", "Дэниел Голдин", "Деніел Голдін"), title: T.nasa, competence: 4, traits: [TRAIT.manager, TRAIT.driven] },
  { country: "usa", from: "2009-07-17", to: "2017-01-20", name: L("Charles Bolden", "Чарльз Болден", "Чарльз Болден"), title: T.nasa, competence: 3, traits: [TRAIT.manager] },
  { country: "usa", from: "2021-05-03", to: "2025-01-20", name: L("Bill Nelson", "Билл Нельсон", "Білл Нельсон"), title: T.nasa, competence: 3, traits: [TRAIT.political] },
  { country: "russia", from: "1992-02-25", to: "2004-03-12", name: L("Yuri Koptev", "Юрий Коптев", "Юрій Коптєв"), title: T.roscosmos, competence: 3, traits: [TRAIT.manager] },
  { country: "russia", from: "2013-10-10", to: "2015-01-21", name: L("Oleg Ostapenko", "Олег Остапенко", "Олег Остапенко"), title: T.roscosmos, competence: 3, traits: [TRAIT.bureaucrat] },
  { country: "russia", from: "2018-05-24", to: "2022-07-15", name: L("Dmitry Rogozin", "Дмитрий Рогозин", "Дмитро Рогозін"), title: T.roscosmosDg, competence: 2, traits: [TRAIT.showman, TRAIT.political] },
  { country: "china", from: "1956-10-08", to: "1970-04-24", name: L("Qian Xuesen", "Цянь Сюэсэнь", "Цянь Сюесень"), title: T.fifth, competence: 5, traits: [TRAIT.scientist, TRAIT.organiser] },
  { country: "china", from: "2018-04-01", to: "2024-04-01", name: L("Zhang Kejian", "Чжан Кэцзянь", "Чжан Кецзянь"), title: T.cnsa, competence: 4, traits: [TRAIT.manager] },
  { country: "france", from: "1962-03-01", to: "1972-06-01", name: L("Robert Aubinière", "Робер Обиньер", "Робер Обіньєр"), title: T.cnes, competence: 4, traits: [TRAIT.organiser] },
  { country: "france", from: "2013-04-01", to: "2021-04-01", name: L("Jean-Yves Le Gall", "Жан-Ив Ле Галль", "Жан-Ів Ле Галль"), title: T.cnesPresident, competence: 4, traits: [TRAIT.manager] },
  { country: "france", from: "2021-04-01", to: "2024-03-01", name: L("Philippe Baptiste", "Филипп Батист", "Філіп Батіст"), title: T.cnesPresident, competence: 4, traits: [TRAIT.scientist] },
  { country: "japan", from: "1955-04-12", to: "1967-03-31", name: L("Hideo Itokawa", "Хидэо Итокава", "Хідео Ітокава"), title: T.tokyo, competence: 4, traits: [TRAIT.visionary, TRAIT.engineer] },
  { country: "japan", from: "2018-04-01", to: "2024-04-01", name: L("Hiroshi Yamakawa", "Хироси Ямакава", "Хіросі Ямакава"), title: T.jaxa, competence: 3, traits: [TRAIT.scientist] },
  { country: "india", from: "1962-02-16", to: "1971-12-30", name: L("Vikram Sarabhai", "Викрам Сарабхай", "Вікрам Сарабхаї"), title: T.incospar, competence: 5, traits: [TRAIT.visionary, TRAIT.scientist] },
  { country: "india", from: "1984-10-01", to: "1994-03-31", name: L("U. R. Rao", "Удупи Рамачандра Рао", "Удупі Рамачандра Рао"), title: T.isro, competence: 4, traits: [TRAIT.scientist] },
  { country: "india", from: "1994-04-01", to: "2003-08-27", name: L("Krishnaswamy Kasturirangan", "Кришнасвами Кастурирангану", "Крішнасвамі Кастурірангану"), title: T.isro, competence: 4, traits: [TRAIT.scientist, TRAIT.manager] },
  { country: "india", from: "2009-10-31", to: "2014-12-31", name: L("Koppillil Radhakrishnan", "Коппиллил Радхакришнан", "Коппілліл Радхакрішнан"), title: T.isro, competence: 4, traits: [TRAIT.manager] },
  { country: "india", from: "2022-01-14", to: "2025-01-13", name: L("S. Somanath", "С. Соманат", "С. Сомунат"), title: T.isro, competence: 4, traits: [TRAIT.engineer] },
];

/** Who ran a country's programme on a day, as history has it. */
export function headOf(tag: string, date: string): Head | undefined {
  return HEADS.find((h) => h.country === tag && h.from <= date && date < h.to);
}

/**
 * The head of the player's programme, as history had them on the start date,
 * when the government's people are first named and the game master left the
 * post out: a person in the government like a minister, with a portrait
 * where one is known (engine/people.ts).
 */
export function withSpaceHead(officials: Official[], state: Pick<GameState, "player" | "date">, locale: Locale): Official[] {
  if (officials.some((o) => o.post === "space")) return officials;
  const head = headOf(state.player, state.date);
  if (!head) return officials;
  const year = Number(state.date.slice(0, 4));
  const official: Official = dressOfficial(
    {
      post: "space",
      title: head.title[locale],
      name: head.name[locale],
      traits: head.traits.map((t) => t[locale]),
      manner: "",
      competence: head.competence,
      loyalty: 4,
      since: state.date,
    },
    year,
  );
  return [...officials, official];
}

/** Whether the player's government runs a programme the cabinet should show: a head in post, or money going into rockets once there are any. */
export function spaceActive(state: Pick<GameState, "space" | "player" | "date" | "officials">): boolean {
  if (officialAt(state, "space")) return true;
  const p = state.space?.programmes[state.player];
  return Boolean(p && (p.share > 0 || p.done.length) && Number(state.date.slice(0, 4)) >= SITES_FROM);
}

/** The cabinet's ministers to show (engine/advisors.ts's list): the head of the space programme only while there is a programme. */
export function cabinetAdvisors<T extends string>(state: Pick<GameState, "space" | "player" | "date" | "officials">, advisors: readonly T[]): T[] {
  const active = spaceActive(state);
  return advisors.filter((a) => a !== "space" || active);
}

// ---- the game master's view

const featName = (m: SpaceMilestone) => MILESTONES[m].name.en.toLowerCase();

/**
 * The space race for the game master: the player's programme (its share and
 * money, what it has made, what is next and when, its sites, its head), and
 * the world's firsts and the other programmes' last feats.
 */
export function describeSpace(state: GameState): string[] {
  const space = state.space;
  if (!space) return [];
  const lines: string[] = [];
  const view = programmeView(state, state.player);
  if (view && (view.share > 0 || view.done.length)) {
    const done = view.done.map((d) => `${featName(d.id)} (${d.date.slice(0, 7)})`).join(", ") || "nothing yet";
    const next = view.next
      .slice(0, 3)
      .map((f) => `${featName(f.id)} ${Math.round(f.work * 100)}%${f.expected ? ` (about ${Math.floor(f.expected)})` : ""}`)
      .join(", ");
    const sites = view.sites.length ? view.sites.map((s) => (typeof s.name === "string" ? s.name : s.name.en)).join(", ") : "none – no launch is possible until a site is held or built";
    lines.push(
      "",
      `SPACE PROGRAMME OF THE PLAYER'S GOVERNMENT: ${view.share}% of the research money ($${view.money}bn a year), focus ${view.focus}; done: ${done}; next: ${next || "–"}; launch sites: ${sites}${view.rockets ? "; held back by its rockets (strategic research)" : ""}.`,
    );
  }
  const firsts = (Object.entries(space.firsts) as [SpaceMilestone, { by: string; date: string }][]).map(([m, f]) => `${featName(m)}: ${f.by} ${f.date.slice(0, 7)}`);
  const others = Object.entries(space.programmes)
    .filter(([tag, p]) => tag !== state.player && p.done.length && state.countries[tag])
    .map(([tag, p]) => `${tag} ${p.done.length} feats, last ${featName(p.done[p.done.length - 1].id)}`);
  if (firsts.length || others.length) {
    lines.push(`- the space race: firsts – ${firsts.join("; ") || "none yet"}${others.length ? `; others – ${others.join("; ")}` : ""}. The engine decides every launch and its outcome once the turn is written: never report a feat as made, or a launch as lost, that it has not recorded.`);
  }
  return lines;
}

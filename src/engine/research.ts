import { baseLevel, LEVEL_YEARS, maxLevel, researchedLevel } from "./arsenal";
import { yearOf } from "./calendar";
import { roll } from "./dice";
import { officialAt } from "./government";
import { WEAPON_KINDS, type AppliedChange, type GameState, type Localized, type Research, type WeaponKind } from "./types";

/**
 * The player's research: a short list of projects, each with a cost a year
 * (a share of GDP), a length at full funding and what it brings. Weapons
 * of the next level come before history brings them to everyone; a few
 * projects of their own — rockets, the bomb, computers, satellites — and
 * civil ones that lift growth while the rest of the world has not caught
 * up. No tree beyond a few prerequisites: what is near in time can be
 * tried, and the further ahead of history, the longer and dearer it is.
 * Military projects are paid from the army budget (up to a fifth of it),
 * civil ones from industry's (up to a third); the science minister's
 * competence sets the pace and the game's dice bring setbacks.
 */

export interface Project {
  id: string;
  field: "military" | "civil";
  /** When history brought it. */
  year: number;
  /** Months at full funding. */
  months: number;
  /** % of GDP a year. */
  cost: number;
  /** For a project of its own; a generation of weapons is named by its kind and level. */
  name?: Localized;
  effect?: Localized;
  requires?: string[];
  /** A generation of weapons: "gen:tanks:3". */
  gen?: { kind: WeaponKind; level: number };
  /** Percentage points of GDP growth a year while the world has not caught up. */
  growth?: number;
  /** It makes the bomb. */
  nuclear?: boolean;
}

interface Special extends Omit<Project, "id" | "months" | "cost"> {
  base: number;
  share: number;
}

const SPECIALS: Record<string, Special> = {
  rockets: {
    field: "military",
    year: 1944,
    base: 24,
    share: 0.15,
    name: { ru: "Ракетная техника", uk: "Ракетна техніка", en: "Rocketry" },
    effect: { ru: "Баллистические ракеты; открывает зенитные ракеты и ракетный флот", uk: "Балістичні ракети; відкриває зенітні ракети та ракетний флот", en: "Ballistic missiles; opens air-defence missiles and missile ships" },
  },
  nuclear: {
    field: "military",
    year: 1945,
    base: 30,
    share: 0.4,
    nuclear: true,
    name: { ru: "Атомная бомба", uk: "Атомна бомба", en: "The atomic bomb" },
    effect: { ru: "Ядерное оружие", uk: "Ядерна зброя", en: "Nuclear weapons" },
  },
  antibiotics: {
    field: "civil",
    year: 1942,
    base: 12,
    share: 0.05,
    growth: 0.1,
    name: { ru: "Антибиотики", uk: "Антибіотики", en: "Antibiotics" },
    effect: { ru: "Здоровее работники, меньше умирает от ран", uk: "Здоровіші працівники, менше помирає від ран", en: "Healthier workers, fewer deaths from wounds" },
  },
  computing: {
    field: "civil",
    year: 1946,
    base: 18,
    share: 0.1,
    growth: 0.15,
    name: { ru: "Вычислительные машины", uk: "Обчислювальні машини", en: "Computers" },
    effect: { ru: "Рост экономики; открывает дроны раньше срока", uk: "Зростання економіки; відкриває дрони раніше строку", en: "Growth; opens drones before their time" },
  },
  satellites: {
    field: "military",
    year: 1957,
    base: 24,
    share: 0.2,
    requires: ["rockets"],
    name: { ru: "Спутники", uk: "Супутники", en: "Satellites" },
    effect: { ru: "Разведка и связь с орбиты", uk: "Розвідка та зв'язок з орбіти", en: "Reconnaissance and communications from orbit" },
  },
  automation: {
    field: "civil",
    year: 1961,
    base: 18,
    share: 0.12,
    growth: 0.2,
    name: { ru: "Автоматизация заводов", uk: "Автоматизація заводів", en: "Factory automation" },
    effect: { ru: "Рост промышленности", uk: "Зростання промисловості", en: "Industrial growth" },
  },
  green: {
    field: "civil",
    year: 1965,
    base: 18,
    share: 0.1,
    growth: 0.2,
    name: { ru: "Зелёная революция", uk: "Зелена революція", en: "The green revolution" },
    effect: { ru: "Урожаи выше, хлеб дешевле", uk: "Урожаї вищі, хліб дешевший", en: "Bigger harvests, cheaper bread" },
  },
  internet: {
    field: "civil",
    year: 1991,
    base: 18,
    share: 0.1,
    growth: 0.2,
    requires: ["computing"],
    name: { ru: "Интернет", uk: "Інтернет", en: "The internet" },
    effect: { ru: "Рост экономики и связи", uk: "Зростання економіки та зв'язку", en: "Growth of the economy and communications" },
  },
  biotech: {
    field: "civil",
    year: 2003,
    base: 18,
    share: 0.1,
    growth: 0.15,
    name: { ru: "Биотехнологии", uk: "Біотехнології", en: "Biotechnology" },
    effect: { ru: "Медицина и сельское хозяйство", uk: "Медицина та сільське господарство", en: "Medicine and farming" },
  },
  ai: {
    field: "civil",
    year: 2025,
    base: 24,
    share: 0.15,
    growth: 0.3,
    requires: ["computing"],
    name: { ru: "Искусственный интеллект", uk: "Штучний інтелект", en: "Artificial intelligence" },
    effect: { ru: "Рост экономики", uk: "Зростання економіки", en: "Economic growth" },
  },
};

/** Projects tried no more than this many years ahead of history. */
const HORIZON = 25;
/** Projects under way at once. */
export const MAX_RESEARCH = 4;
/** The shares of the army and industry budgets research may take. */
export const RESEARCH_POOL = { military: 0.2, civil: 0.3 };

/** The date as a year with its months, for "years ahead of history". */
const yearNow = (date: string) => yearOf(date) + (Number(date.slice(5, 7)) - 1) / 12;
const round2 = (v: number) => Math.round(v * 100) / 100;

const doneIds = (state: Pick<GameState, "research">) => new Set((state.research?.done ?? []).map((d) => d.id));

/** A prerequisite is met when the player has it, or history has given it to everyone. */
function met(state: Pick<GameState, "research" | "date">, id: string): boolean {
  if (doneIds(state).has(id)) return true;
  const special = SPECIALS[id];
  return Boolean(special && special.year <= yearNow(state.date));
}

/** Months and cost of a project so far ahead of history. */
const scale = (base: number, share: number, ahead: number) => ({ months: Math.round(base + 4 * Math.max(0, ahead)), cost: round2(share * (1 + Math.max(0, ahead) / 8)) });

/** The next generation of a kind for the player, if history has not brought it yet. */
function generation(state: Pick<GameState, "research" | "date">, kind: WeaponKind): Project | null {
  const now = yearNow(state.date);
  const level = Math.max(baseLevel(kind, Math.floor(now)), researchedLevel(state, kind)) + 1;
  if (level > maxLevel(kind)) return null;
  const year = LEVEL_YEARS[kind][level - 1];
  const ahead = year - now;
  if (ahead <= 0 || ahead > HORIZON) return null;
  const requires = (kind === "drones" && year <= 1982) || (kind === "airDefence" && level >= 4) || (kind === "ships" && level >= 4) ? [kind === "drones" ? "computing" : "rockets"] : undefined;
  return { id: `gen:${kind}:${level}`, field: "military", year, ...scale(9, 0.1, ahead), gen: { kind, level }, ...(requires ? { requires } : {}) };
}

/** A project by its id, as it stands now: a generation, or one of its own. */
export function projectOf(state: Pick<GameState, "research" | "date" | "player" | "countries">, id: string): Project | null {
  const [prefix, kind, n] = id.split(":");
  if (prefix === "gen") {
    if (!(WEAPON_KINDS as readonly string[]).includes(kind)) return null;
    const level = Number(n);
    const k = kind as WeaponKind;
    if (!level || level > maxLevel(k)) return null;
    const year = LEVEL_YEARS[k][level - 1];
    return { id, field: "military", year, ...scale(9, 0.1, year - yearNow(state.date)), gen: { kind: k, level } };
  }
  const s = SPECIALS[id];
  if (!s) return null;
  const ahead = s.year - yearNow(state.date);
  // The bomb can still be built after 1945, by a country that has none: a few years and a lot of money.
  const { base, share, ...rest } = s;
  const sized = s.nuclear && ahead <= 0 ? { months: base + 6, cost: 0.3 } : scale(base, share, ahead);
  return { id, ...rest, ...sized };
}

/** What the player can start now: not done, not under way, near enough in time, its prerequisites met. */
export function availableProjects(state: Pick<GameState, "research" | "date" | "player" | "countries">): Project[] {
  const done = doneIds(state);
  const active = new Set((state.research?.active ?? []).map((p) => p.id));
  const out: Project[] = [];
  for (const kind of WEAPON_KINDS) {
    const g = generation(state, kind);
    if (g && !active.has(g.id)) out.push(g);
  }
  const now = yearNow(state.date);
  const nuclear = Boolean(state.countries[state.player]?.arsenal?.nuclear);
  for (const id of Object.keys(SPECIALS)) {
    if (done.has(id) || active.has(id)) continue;
    const s = SPECIALS[id];
    const ahead = s.year - now;
    if (s.nuclear ? nuclear || ahead > HORIZON : ahead <= 0 || ahead > HORIZON) continue;
    out.push(projectOf(state, id)!);
  }
  return out.filter((p) => (p.requires ?? []).every((r) => met(state, r)));
}

/** A project's cost a year now, $bn. */
export const yearlyCost = (p: Project, gdp: number) => (p.cost / 100) * gdp;

/** How the money for the projects under way stands: each field's pool and spending a year, and the share of it funded. */
export function funding(state: Pick<GameState, "research" | "date" | "player" | "countries">): Record<Project["field"], { pool: number; spend: number; share: number }> {
  const e = state.countries[state.player]?.economy;
  const out = { military: { pool: 0, spend: 0, share: 1 }, civil: { pool: 0, spend: 0, share: 1 } };
  if (!e) return out;
  out.military.pool = e.budget.army * RESEARCH_POOL.military;
  out.civil.pool = e.budget.industry * RESEARCH_POOL.civil;
  for (const a of state.research?.active ?? []) {
    if (!a.on) continue;
    const p = projectOf(state, a.id);
    if (p) out[p.field].spend += yearlyCost(p, e.gdp);
  }
  for (const f of ["military", "civil"] as const) out[f].share = out[f].spend > 0 ? Math.min(1, out[f].pool / out[f].spend) : 1;
  return out;
}

/** The player starts a project, or takes up one set aside; at most MAX_RESEARCH at once. */
export function startResearch<T extends Pick<GameState, "research" | "date" | "player" | "countries">>(state: T, id: string): T {
  const research: Research = state.research ?? { active: [], done: [] };
  const paused = research.active.find((p) => p.id === id);
  const running = research.active.filter((p) => p.on).length;
  if (running >= MAX_RESEARCH || paused?.on) return state;
  if (paused) return { ...state, research: { ...research, active: research.active.map((p) => (p.id === id ? { ...p, on: true } : p)) } };
  if (!availableProjects(state).some((p) => p.id === id)) return state;
  return { ...state, research: { ...research, active: [...research.active, { id, progress: 0, since: state.date, on: true }] } };
}

/** The player sets a project aside: its progress is kept, its money stops. */
export function stopResearch<T extends Pick<GameState, "research">>(state: T, id: string): T {
  const research = state.research;
  if (!research?.active.some((p) => p.id === id && p.on)) return state;
  return { ...state, research: { ...research, active: research.active.map((p) => (p.id === id ? { ...p, on: false } : p)) } };
}

/** What the game master may start or stop by a directive: projects that can be started, and projects under way. */
export function sanitizeResearch(state: GameState, words: { project: string; action: "start" | "stop" }[]): { project: string; action: "start" | "stop" }[] {
  const can = new Set(availableProjects(state).map((p) => p.id));
  const active = state.research?.active ?? [];
  return words.filter((w, i, list) => list.findIndex((o) => o.project === w.project) === i).filter((w) => (w.action === "start" ? can.has(w.project) || active.some((p) => p.id === w.project && !p.on) : active.some((p) => p.id === w.project && p.on)));
}

/** The game master's starts and stops, in the record of the turn. Mutates `next`. */
export function applyResearchWords(next: GameState, words: { project: string; action: "start" | "stop" }[], applied: AppliedChange[]): void {
  for (const w of words) {
    const after = w.action === "start" ? startResearch(next, w.project) : stopResearch(next, w.project);
    if (after === next) continue;
    next.research = after.research;
    applied.push({ kind: "research", project: w.project, change: w.action === "start" ? "started" : "stopped" });
  }
}

/**
 * Moves the player's research through a turn of `years`: projects history
 * has overtaken are dropped, the rest advance by their funding and the
 * science minister's competence, the dice may set one back, finished ones
 * take effect, and civil ones still ahead of history lift GDP. Returns the
 * military research spent, $bn a year, which comes out of the arms money.
 * Mutates `next`.
 */
export function advanceResearch(next: GameState, years: number, applied: AppliedChange[]): number {
  const research = next.research;
  const economy = next.countries[next.player]?.economy;
  if (!research || !economy) return 0;
  const game = next.seed ?? next.id;
  const months = years * 12;
  const money = funding(next);
  const competence = officialAt(next, "science")?.competence ?? 3;
  const pace = 0.7 + 0.1 * competence;
  const now = yearNow(next.date);
  const active: Research["active"] = [];
  const done = [...research.done];
  for (const a of research.active) {
    const p = projectOf(next, a.id);
    // History got there first: the project has nothing left to bring.
    if (!p || (p.year <= now && !p.nuclear)) continue;
    if (!a.on) {
      active.push(a);
      continue;
    }
    let progress = a.progress + (months * money[p.field].share * pace) / p.months;
    if (roll(game, next.turn, `research:${a.id}`) < 1 - 0.97 ** months) {
      progress = Math.max(0, progress - (1 + 2 * roll(game, next.turn, `research:${a.id}:lost`)) / p.months);
      applied.push({ kind: "research", project: a.id, change: "setback" });
    }
    if (progress >= 1) {
      done.push({ id: a.id, date: next.date });
      applied.push({ kind: "research", project: a.id, change: "done" });
      const arsenal = next.countries[next.player].arsenal;
      if (p.nuclear && arsenal) arsenal.nuclear = true;
    } else active.push({ ...a, progress: round2(progress) });
  }
  next.research = { active, done };
  // Civil projects still ahead of history make the country grow faster.
  const growth = done.reduce((sum, d) => {
    const p = projectOf(next, d.id);
    return sum + (p?.growth && p.year > now ? p.growth : 0);
  }, 0);
  if (growth > 0) economy.gdp = round2(economy.gdp * (1 + growth / 100) ** years);
  return Math.min(money.military.pool, money.military.spend);
}

/** The player's research for the game master: what is under way, what it has ahead of history, and the ids a directive can start. */
export function describeResearch(state: GameState): string[] {
  const research = state.research;
  if (!research) return [];
  const now = yearNow(state.date);
  const label = (p: Project) => (p.gen ? `${p.gen.kind} of level ${p.gen.level}` : (p.name?.en ?? p.id));
  const lines = ["", "RESEARCH OF THE PLAYER'S GOVERNMENT (id | what | in history | progress):"];
  for (const a of research.active) {
    const p = projectOf(state, a.id);
    if (p) lines.push(`- ${a.id} | ${label(p)} | ${p.year} | ${Math.round(a.progress * 100)}%${a.on ? "" : " (set aside)"}`);
  }
  const ahead = research.done.flatMap((d) => {
    const p = projectOf(state, d.id);
    return p && p.year > now ? [`${label(p)} (done ${d.date}, history: ${p.year})`] : [];
  });
  if (ahead.length) lines.push(`- ahead of history: ${ahead.join("; ")}`);
  const open = availableProjects(state);
  if (open.length) lines.push(`- could start (by a directive to the science or military ministry, in "arms.research"): ${open.map((p) => `${p.id} (${label(p)}, ${p.year})`).join(", ")}`);
  return lines.length > 2 ? lines : [];
}

/** A new game's research: nothing under way. */
export const startingResearch = (): Research => ({ active: [], done: [] });

"use client";

import { Baby, Briefcase, GraduationCap, HeartPulse, type LucideIcon, Plane, ShoppingBasket, Skull, Smile, UsersRound, Wallet } from "lucide-react";
import { type ReactNode, useMemo } from "react";
import { ui } from "@/components/ui/classes";
import { formatDate } from "@/engine/calendar";
import { classesOf, type ClassView } from "@/engine/classes";
import { plannedness } from "@/engine/industry";
import { provisionOf } from "@/engine/provision";
import { lifeExpectancy, societyOf, type Society } from "@/engine/society";
import { seenClasses, seenRecord, societySight } from "@/engine/societyRecord";
import { SOCIAL_CLASSES, type GameState, type MapRegion, type SocialClass, type SocietyPoint } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";

/** Each class's colour in the charts: theme tokens, the same in both themes' sense. */
const CLASS_COLOR: Record<SocialClass, string> = { workers: "var(--accent)", peasants: "var(--map-ally)", middle: "var(--river)", intelligentsia: "var(--ink)", elites: "var(--faded)" };

/** A class's name by the system and the era: the collective farmers, office workers and nomenklatura of a planned economy, the nobility before 1918. */
function classKey(id: SocialClass, planned: number, year: number): MessageKey {
  if (planned >= 0.7 && (id === "peasants" || id === "middle" || id === "elites")) return `society.class.${id}.planned` as MessageKey;
  if (year < 1918 && id === "elites") return "society.class.elites.old";
  return `society.class.${id}` as MessageKey;
}

/** A mood in a word, and its colour. */
function moodOf(mood: number): { key: MessageKey; tone: string; bar: string } {
  if (mood < 25) return { key: "society.mood.angry", tone: "text-war", bar: "var(--war)" };
  if (mood < 45) return { key: "society.mood.uneasy", tone: "text-amber-700", bar: "var(--accent)" };
  if (mood < 65) return { key: "society.mood.calm", tone: "text-muted", bar: "var(--faded)" };
  return { key: "society.mood.content", tone: "text-emerald-700", bar: "var(--map-ally)" };
}

interface Series {
  key: string;
  label: string;
  color: string;
  values: (number | undefined)[];
}

const W = 300;
const H = 64;

/** A section's title with its icon. */
function Title({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <div className={`${ui.label} flex items-center gap-1.5`}>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{children}</span>
    </div>
  );
}

/** The record's first and last dates under a chart. */
function Span({ points }: { points: SocietyPoint[] }) {
  const { locale } = useI18n();
  if (points.length < 2) return null;
  return (
    <div className="flex justify-between text-2xs font-bold text-faded">
      <span>{formatDate(points[0].d, locale)}</span>
      <span>{formatDate(points.at(-1)!.d, locale)}</span>
    </div>
  );
}

/** Each series' colour, name and latest figure. */
function Legend({ series, format }: { series: Series[]; format: (v: number) => string }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-2xs font-bold text-muted">
      {series.map((s) => {
        const last = [...s.values].reverse().find((v) => v !== undefined);
        return (
          <span key={s.key} className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
            {s.label}
            {last !== undefined && <span className="tabular-nums text-ink">{format(last)}</span>}
          </span>
        );
      })}
    </div>
  );
}

/**
 * Lines over the record's turns, one per series, on a scale from the lowest
 * to the highest figure (or the given bounds; or at least `span` wide within
 * `limits`, so small moves do not fill the chart); a figure the role does
 * not know is a gap in its line.
 */
function LineChart({ points, series, format, bounds, span, limits }: { points: SocietyPoint[]; series: Series[]; format: (v: number) => string; bounds?: [number, number]; span?: number; limits?: [number, number] }) {
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== undefined && Number.isFinite(v)));
  if (!all.length || points.length < 2) return null;
  let lo = bounds?.[0] ?? Math.min(...all);
  let hi = bounds?.[1] ?? Math.max(...all);
  if (span && hi - lo < span) {
    const mid = (lo + hi) / 2;
    lo = mid - span / 2;
    hi = mid + span / 2;
    if (limits && lo < limits[0]) [lo, hi] = [limits[0], limits[0] + span];
    if (limits && hi > limits[1]) [lo, hi] = [limits[1] - span, limits[1]];
  }
  if (hi - lo < 1e-9) {
    lo -= Math.max(1, Math.abs(lo) * 0.05);
    hi += Math.max(1, Math.abs(hi) * 0.05);
  }
  const x = (i: number) => (i / (points.length - 1)) * (W - 4) + 2;
  const y = (v: number) => H - 3 - ((v - lo) / (hi - lo)) * (H - 6);
  const path = (values: (number | undefined)[]) => {
    let d = "";
    let pen = false;
    values.forEach((v, i) => {
      if (v === undefined || !Number.isFinite(v)) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };
  return (
    <figure className="grid gap-1">
      <div className="flex justify-between text-2xs font-bold tabular-nums text-faded">
        <span>{format(hi)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={series.map((s) => s.label).join(", ")}>
        <line x1={0} x2={W} y1={y(hi)} y2={y(hi)} stroke="var(--divider)" strokeWidth={1} />
        <line x1={0} x2={W} y1={y(lo)} y2={y(lo)} stroke="var(--divider)" strokeWidth={1} />
        {series.map((s) => (
          <path key={s.key} d={path(s.values)} fill="none" stroke={s.color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
        ))}
      </svg>
      <div className="flex justify-between text-2xs font-bold tabular-nums text-faded">
        <span>{format(lo)}</span>
      </div>
      <Span points={points} />
      <Legend series={series} format={format} />
    </figure>
  );
}

/** Bars over the record's turns, the series stacked: what each turn cost. */
function BarChart({ points, series, format }: { points: SocietyPoint[]; series: Series[]; format: (v: number) => string }) {
  const totals = points.map((_, i) => series.reduce((t, s) => t + Math.max(0, s.values[i] ?? 0), 0));
  const most = Math.max(...totals, 0);
  if (most <= 0 || points.length < 2) return null;
  const step = (W - 2) / points.length;
  const width = Math.max(1, step * 0.7);
  return (
    <figure className="grid gap-1">
      <div className="text-2xs font-bold tabular-nums text-faded">{format(most)}</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={series.map((s) => s.label).join(", ")}>
        <line x1={0} x2={W} y1={H - 1} y2={H - 1} stroke="var(--divider)" strokeWidth={1} />
        {points.map((_, i) => {
          let top = H - 1;
          return series.map((s) => {
            const v = Math.max(0, s.values[i] ?? 0);
            if (!v) return null;
            const h = (v / most) * (H - 4);
            top -= h;
            return <rect key={`${s.key}${i}`} x={1 + i * step + (step - width) / 2} y={top} width={width} height={h} rx={0.8} fill={s.color} />;
          });
        })}
      </svg>
      <Span points={points} />
    </figure>
  );
}

/** The totals of a record's flows, as the role knows them: a figure kept secret is missing. */
const total = (points: SocietyPoint[], key: "out" | "in" | "dep" | "war" | "civ" | "crime") => points.reduce((t, p) => t + (p[key] ?? 0), 0);

/** The age pyramid now, with the one the record opened with drawn in outline: men to the left, women to the right. */
function PyramidThen({ society, first }: { society: Society; first?: { m: number[]; f: number[] } }) {
  const { t, locale } = useI18n();
  const rows = society.bands.length;
  const step = 7;
  const width = 300;
  const mid = width / 2;
  const gutter = 16;
  const now = society.bands.map((b) => ({ m: (b.m / Math.max(1, society.people)) * 100, f: (b.f / Math.max(1, society.people)) * 100 }));
  const most = Math.max(...now.map((b) => Math.max(b.m, b.f)), ...(first ? [...first.m, ...first.f] : []), 0.01);
  const scale = (n: number) => (n / most) * (mid - gutter - 2);
  const men = now.reduce((s, b) => s + b.m, 0);
  /** The start's pyramid as a stepped line along the ends of its bars, one side. */
  const contour = (side: number[], sign: 1 | -1) =>
    side
      .map((v, i) => {
        const x = mid + sign * (gutter + scale(v ?? 0));
        const top = (rows - 1 - i) * step + 1;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${(top + step - 1.5).toFixed(1)}L${x.toFixed(1)},${top.toFixed(1)}`;
      })
      .join("");
  return (
    <figure className="grid gap-1">
      <svg viewBox={`0 0 ${width} ${rows * step + 2}`} className="h-auto w-full" role="img" aria-label={t("society.age")}>
        {now.map((b, i) => {
          const y = (rows - 1 - i) * step + 1;
          return (
            <g key={i}>
              <rect x={mid - gutter - scale(b.m)} y={y} width={scale(b.m)} height={step - 1.5} rx={1} fill="var(--river)" />
              <rect x={mid + gutter} y={y} width={scale(b.f)} height={step - 1.5} rx={1} fill="var(--accent)" opacity={0.85} />
              {i % 4 === 0 && (
                <text x={mid} y={y + step - 2} textAnchor="middle" fontSize={6.5} fontWeight={700} fill="var(--muted)">
                  {i === rows - 1 ? "80+" : i * 5}
                </text>
              )}
            </g>
          );
        })}
        {first && (
          <>
            <path d={contour(first.m, -1)} fill="none" stroke="var(--ink)" strokeWidth={1} strokeLinejoin="round" opacity={0.75} />
            <path d={contour(first.f, 1)} fill="none" stroke="var(--ink)" strokeWidth={1} strokeLinejoin="round" opacity={0.75} />
          </>
        )}
      </svg>
      <div className="flex justify-between gap-2 text-2xs font-bold text-muted">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm" style={{ background: "var(--river)" }} />
          {t("society.men")} {Math.round(men).toLocaleString(locale)}%
        </span>
        <span className="inline-flex items-center gap-1">
          {t("society.women")} {Math.round(100 - men).toLocaleString(locale)}%
          <span className="h-2 w-2 rounded-sm" style={{ background: "var(--accent)" }} />
        </span>
      </div>
      {first && (
        <div className="inline-flex items-center justify-center gap-1.5 text-2xs font-bold text-faded">
          <span className="h-0 w-4 border-t border-ink/70" />
          {t("society.pyramidThen")}
        </div>
      )}
    </figure>
  );
}

/** The classes: each with its share, its mood and what it wants most. */
function Classes({ views, planned, year }: { views: ClassView[]; planned: number; year: number }) {
  const { t, locale } = useI18n();
  return (
    <ul className="grid gap-2">
      {views.map((v) => {
        const m = moodOf(v.mood);
        const moving = v.target - v.mood;
        return (
          <li key={v.id} className="grid gap-1">
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="min-w-0 truncate font-black text-ink">
                {t(classKey(v.id, planned, year))} <span className="font-bold tabular-nums text-muted">{Math.round(v.share).toLocaleString(locale)}%</span>
              </span>
              <span className={`shrink-0 text-2xs font-black ${m.tone}`}>
                {t(m.key)} <span className="tabular-nums">{v.mood}</span>
                {Math.abs(moving) >= 3 && <span className="ml-0.5 text-muted">{moving > 0 ? "▲" : "▼"}</span>}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-divider">
              <div className="h-full rounded-full" style={{ width: `${v.mood}%`, background: m.bar }} />
            </div>
            <div className="text-2xs font-bold text-muted">{t("society.wants", { want: t(`society.want.${v.want}` as MessageKey) })}</div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Society, its own tab in domestic affairs: the people now and how they
 * moved turn by turn (engine/societyRecord.ts) – the population and its
 * pyramid against the one the record opened with, births and deaths,
 * health and life expectancy, schooling and towns, incomes and inequality,
 * the jobless, the people's provision, migration and refugees, the toll of
 * wars and crimes – and the classes with their moods and wants
 * (engine/classes.ts). A role that does not govern sees what it would know:
 * the state's statistics, the cabinet's rough figures or the official ones.
 */
export default function SocietyTab({ state, regions }: { state: GameState; regions: Record<string, MapRegion> | null }) {
  const { t, people, locale } = useI18n();
  const me = state.player;
  const society = useMemo(() => (regions ? societyOf(state, regions, me) : null), [state, regions, me]);
  const provision = useMemo(() => (regions && society ? provisionOf(state, me, regions) : null), [state, regions, me, society]);
  const views = useMemo(() => (society ? seenClasses(state, classesOf(state, society, provision)) : []), [state, society, provision]);
  const track = state.society?.[me];
  const points = useMemo(() => seenRecord(state, track?.record ?? []), [state, track?.record]);
  const { sight, dressed } = societySight(state);
  const life = useMemo(() => (regions && society ? lifeExpectancy(state, regions, me) : null), [state, regions, me, society]);
  if (!society) return <p className="text-xs font-medium text-muted">{t("society.none")}</p>;

  const planned = plannedness(state, me);
  const year = Number(state.date.slice(0, 4));
  const pct = (v: number) => `${v.toLocaleString(locale, { maximumFractionDigits: 1 })}%`;
  const whole = (v: number) => Math.round(v).toLocaleString(locale);
  const thousands = (v: number) => people(v);
  // The chart's scale needs finer steps than the tiles: a month's growth is a few hundredths of a million.
  const peopleFine = (v: number) => (v < 1000 ? people(v) : t("unit.million", { n: (v / 1000).toLocaleString(locale, { maximumFractionDigits: 2 }) }));
  const col = <K extends keyof SocietyPoint>(key: K) => points.map((p) => (typeof p[key] === "number" ? (p[key] as number) : undefined));
  const start = points[0];
  const peopleNow = points.at(-1)?.p ?? society.people;
  const grew = start ? peopleNow - start.p : 0;
  const tolls = { war: total(points, "war"), civ: total(points, "civ"), crime: total(points, "crime") };
  const moves = { out: total(points, "out"), in: total(points, "in"), dep: total(points, "dep") };
  // Where the regime and the press let it, the state publishes nothing of its own crimes (engine/societyRecord.ts).
  const hidden = sight === "official" && dressed >= 0.5;

  return (
    <div className="flex flex-col gap-4">
      {sight !== "true" && <p className="rounded-xl border border-line sheet px-3 py-2 text-2xs font-bold leading-snug text-muted">{t(`society.sight.${sight}` as MessageKey)}</p>}

      <section className="grid gap-3 rounded-xl bg-page p-3">
        <Title icon={UsersRound}>{t("society.chart.people")}</Title>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            [t("society.people"), people(peopleNow), grew && Math.abs(grew) >= 1 ? `${grew > 0 ? "+" : "−"}${people(Math.abs(grew))}` : ""],
            [t("society.life"), life !== null ? t("society.years", { n: (points.at(-1)?.e ?? life).toLocaleString(locale, { maximumFractionDigits: 1 }) }) : "–", ""],
            [t("society.literate"), pct(points.at(-1)?.lit ?? society.literate), ""],
          ].map(([label, value, note], i) => (
            <div key={i} className="min-w-0 rounded-lg border border-line sheet p-2">
              <div className="text-2xs font-bold leading-tight text-muted">{label}</div>
              <div className="mt-0.5 text-sm font-black tabular-nums leading-tight text-ink">{value}</div>
              {note && <div className="text-2xs font-bold tabular-nums text-muted">{note}</div>}
            </div>
          ))}
        </div>
        <LineChart points={points} series={[{ key: "p", label: t("society.people"), color: "var(--ink)", values: col("p") }]} format={peopleFine} />
        <PyramidThen society={society} first={track?.first} />
        {points.length < 2 && <p className="text-2xs font-medium leading-snug text-muted">{t("society.recordNote")}</p>}
      </section>

      <section className="grid gap-2 rounded-xl bg-page p-3">
        <Title icon={Smile}>{t("society.classes")}</Title>
        <Classes views={views} planned={planned} year={year} />
        <LineChart
          points={points}
          span={30}
          limits={[0, 100]}
          series={SOCIAL_CLASSES.map((id, j) => ({ key: id, label: t(classKey(id, planned, year)), color: CLASS_COLOR[id], values: points.map((p) => p.mood?.[j]) }))}
          format={whole}
        />
        <p className="text-2xs font-medium leading-snug text-muted">{t("society.classesNote")}</p>
      </section>

      {points.length >= 2 && (
        <>
          <section className="grid gap-2 rounded-xl bg-page p-3">
            <Title icon={Baby}>{t("society.chart.vital")}</Title>
            <LineChart
              points={points}
              series={[
                { key: "b", label: t("society.births"), color: "var(--map-ally)", values: col("b") },
                { key: "m", label: t("society.deaths"), color: "var(--war)", values: col("m") },
              ]}
              format={(v) => v.toLocaleString(locale, { maximumFractionDigits: 1 })}
            />
            <p className="text-2xs font-medium text-muted">{t("society.perThousand")}</p>
          </section>

          <section className="grid gap-2 rounded-xl bg-page p-3">
            <Title icon={HeartPulse}>{t("society.chart.health")}</Title>
            <LineChart points={points} series={[{ key: "e", label: t("society.life"), color: "var(--accent)", values: col("e") }]} format={(v) => t("society.years", { n: v.toLocaleString(locale, { maximumFractionDigits: 1 }) })} />
            <LineChart points={points} bounds={[0, 100]} series={[{ key: "med", label: t("society.medicine"), color: "var(--river)", values: col("med") }]} format={whole} />
          </section>

          <section className="grid gap-2 rounded-xl bg-page p-3">
            <Title icon={GraduationCap}>{t("society.chart.school")}</Title>
            <LineChart
              points={points}
              bounds={[0, 100]}
              series={[
                { key: "lit", label: t("society.literate"), color: "var(--ink)", values: col("lit") },
                { key: "urb", label: t("society.urban"), color: "var(--river)", values: col("urb") },
              ]}
              format={whole}
            />
          </section>

          <section className="grid gap-2 rounded-xl bg-page p-3">
            <Title icon={Wallet}>{t("society.chart.income")}</Title>
            <LineChart points={points} series={[{ key: "inc", label: t("society.incomeHead"), color: "var(--ink)", values: col("inc") }]} format={(v) => `$${Math.round(v).toLocaleString(locale)}`} />
            <LineChart
              points={points}
              series={[
                { key: "poor", label: t("society.poor"), color: "var(--war)", values: col("poor") },
                { key: "rich", label: t("society.rich"), color: "var(--accent)", values: col("rich") },
                { key: "gini", label: t("society.gini"), color: "var(--muted)", values: col("gini") },
              ]}
              format={whole}
            />
          </section>

          <section className="grid gap-2 rounded-xl bg-page p-3">
            <Title icon={Briefcase}>{t("society.chart.jobs")}</Title>
            <LineChart points={points} series={[{ key: "job", label: t("society.jobless"), color: "var(--war)", values: col("job") }]} format={pct} />
          </section>

          <section className="grid gap-2 rounded-xl bg-page p-3">
            <Title icon={ShoppingBasket}>{t("society.chart.provision")}</Title>
            <LineChart points={points} bounds={[0, 100]} series={[{ key: "pro", label: t("society.provisionAll"), color: "var(--map-ally)", values: col("pro") }]} format={whole} />
          </section>

          <section className="grid gap-2 rounded-xl bg-page p-3">
            <Title icon={Plane}>{t("society.chart.migration")}</Title>
            {moves.out + moves.in + moves.dep > 0 ? (
              <>
                <BarChart
                  points={points}
                  series={[
                    { key: "out", label: t("society.fled"), color: "var(--war)", values: col("out") },
                    { key: "in", label: t("society.came"), color: "var(--map-ally)", values: col("in") },
                    { key: "dep", label: t("society.deported"), color: "var(--ink)", values: col("dep") },
                  ]}
                  format={thousands}
                />
                <Legend
                  series={[
                    { key: "out", label: t("society.fled"), color: "var(--war)", values: [moves.out] },
                    { key: "in", label: t("society.came"), color: "var(--map-ally)", values: [moves.in] },
                    { key: "dep", label: t("society.deported"), color: "var(--ink)", values: [moves.dep] },
                  ].filter((s) => (s.values[0] ?? 0) > 0)}
                  format={thousands}
                />
              </>
            ) : (
              <p className="text-2xs font-medium text-muted">{t("society.noMigration")}</p>
            )}
          </section>

          <section className="grid gap-2 rounded-xl bg-page p-3">
            <Title icon={Skull}>{t("society.chart.toll")}</Title>
            {tolls.war + tolls.civ + tolls.crime > 0 ? (
              <>
                <BarChart
                  points={points}
                  series={[
                    { key: "war", label: t("society.warDead"), color: "var(--war)", values: col("war") },
                    { key: "civ", label: t("society.civilians"), color: "var(--accent)", values: col("civ") },
                    { key: "crime", label: t("society.crimes"), color: "var(--ink)", values: col("crime") },
                  ]}
                  format={thousands}
                />
                <Legend
                  series={[
                    { key: "war", label: t("society.warDead"), color: "var(--war)", values: [tolls.war] },
                    { key: "civ", label: t("society.civilians"), color: "var(--accent)", values: [tolls.civ] },
                    { key: "crime", label: t("society.crimes"), color: "var(--ink)", values: [tolls.crime] },
                  ].filter((s) => (s.values[0] ?? 0) > 0)}
                  format={thousands}
                />
              </>
            ) : (
              <p className="text-2xs font-medium text-muted">{t("society.noToll")}</p>
            )}
            {hidden && <p className="text-2xs font-medium text-muted">{t("society.secret")}</p>}
          </section>
        </>
      )}
    </div>
  );
}

"use client";

import { Anchor, Building2, Gem, Mountain, Ruler, Sprout, TrainFront, Users, Waves } from "lucide-react";
import { ui } from "@/components/ui/classes";
import { RESOURCE_COLORS, TERRAIN_COLORS } from "@/components/map/colors";
import { riverName } from "@/components/map/rivers";
import { activeResources } from "@/engine/resources";
import { peopleIn } from "@/engine/population";
import { populationDensity, provinceName, railLevel } from "@/engine/provinces";
import type { CountryState, MapRegion, RegionState } from "@/engine/types";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";

/** The clicked province: who owns and holds it, and the land itself. */
export default function ProvinceDetails({
  province,
  region,
  countries,
  year,
  start,
}: {
  province: MapRegion;
  region: RegionState;
  countries: Record<string, CountryState>;
  year: number;
  /** Its people when the game began; the map's own count when the start date is the map's. */
  start?: number;
}) {
  const { t, text, locale, people } = useI18n();
  const before = start ?? province.pop;
  const resources = activeResources(province, year);
  const owner = countries[region.owner];
  const holder = countries[region.controller];
  const fact = (icon: React.ReactNode, label: string, value: React.ReactNode) => (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-page px-3 py-2 text-xs">
      <span className="flex items-center gap-1.5 font-bold text-muted">
        {icon}
        {label}
      </span>
      <span className="text-right font-black text-ink">{value}</span>
    </div>
  );

  return (
    <div className={`${ui.card} p-4`}>
      <div className={ui.label}>{t("province.title")}</div>
      <h3 className="mt-1 text-lg font-black leading-tight text-ink">{provinceName(province, locale)}</h3>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: owner?.color }} />
          {t("province.owner")}: <b className="text-ink">{text(owner?.name ?? region.owner)}</b>
        </span>
        {region.contested && (
          <span className="inline-flex items-center gap-1.5 font-bold text-amber-700">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: countries[region.contested]?.color }} />
            {t("province.contested", { country: text(countries[region.contested]?.name ?? region.contested) })}
          </span>
        )}
        {region.controller !== region.owner && (
          <span className="inline-flex items-center gap-1.5 font-bold text-red-600">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: holder?.color }} />
            {t("province.heldBy")}: {text(holder?.name ?? region.controller)}
          </span>
        )}
      </div>
      <div className="mt-3 grid gap-1.5">
        {fact(
          <Mountain className="h-3.5 w-3.5" />,
          t("province.terrain"),
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: TERRAIN_COLORS[province.terrain] }} />
            {t(`terrain.${province.terrain}` as MessageKey)}
          </span>,
        )}
        <div className="rounded-xl bg-page px-3 py-2 text-xs">
          <div className="mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-bold text-muted">
              <Sprout className="h-3.5 w-3.5" />
              {t("province.fertility")}
            </span>
            <span className="font-black tabular-nums text-ink">{province.fertility}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-divider">
            <div className="h-full rounded-full bg-emerald-600" style={{ width: `${province.fertility}%` }} />
          </div>
        </div>
        {province.pop !== undefined &&
          fact(
            <Users className="h-3.5 w-3.5" />,
            t("province.population"),
            <span>
              {people(peopleIn(region, province))}
              <span className="ml-1.5 font-bold text-muted">{t("province.density", { n: Math.round(populationDensity({ pop: peopleIn(region, province), area: province.area })).toLocaleString(locale) })}</span>
              {/* How the province's people changed since the start: war, flight, growth. */}
              {before !== undefined && before > 0 && region?.pop !== undefined && Math.abs(region.pop / before - 1) >= 0.01 && (
                <span className={`ml-1.5 font-bold ${region.pop < before ? "text-red-600" : "text-emerald-700"}`}>
                  {t("province.popChange", { n: `${region.pop > before ? "+" : ""}${Math.round((region.pop / before - 1) * 100)}` })}
                </span>
              )}
            </span>,
          )}
        {fact(<Ruler className="h-3.5 w-3.5" />, t("province.area"), t("province.areaValue", { n: province.area.toLocaleString(locale) }))}
        {fact(<TrainFront className="h-3.5 w-3.5" />, t("province.rail"), t(`rail.${railLevel(province)}` as MessageKey))}
        {fact(<Anchor className="h-3.5 w-3.5" />, province.coastal ? t("province.coastal") : t("province.inland"), province.coastal ? "✓" : "—")}
        {province.city && fact(<Building2 className="h-3.5 w-3.5" />, t("province.city"), province.city)}
        {resources.length > 0 && (
          <div className="rounded-xl bg-page px-3 py-2 text-xs">
            <div className="mb-1.5 flex items-center gap-1.5 font-bold text-muted">
              <Gem className="h-3.5 w-3.5" />
              {t("province.resources")}
            </div>
            <div className="grid gap-1">
              {resources.map((r) => (
                <div key={r.type} className="grid grid-cols-[5.5rem_1fr_2rem] items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 font-bold text-ink">
                    <span className="h-2 w-2 rounded-full" style={{ background: RESOURCE_COLORS[r.type] }} />
                    {t(`resource.${r.type}` as MessageKey)}
                  </span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-divider">
                    <span className="block h-full rounded-full" style={{ width: `${r.output * 10}%`, background: RESOURCE_COLORS[r.type] }} />
                  </span>
                  <span className="text-right font-black tabular-nums text-ink">{r.output}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {province.rv && province.rv.length > 0 &&
          fact(<Waves className="h-3.5 w-3.5" />, t("province.rivers"), province.rv.map((r) => riverName(r, locale)).join(", "))}
      </div>
    </div>
  );
}

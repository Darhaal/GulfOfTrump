"use client";

import { Download, Loader2, Trash2 } from "lucide-react";
import { useSyncExternalStore } from "react";
import { ui } from "@/components/ui/classes";
import { useI18n } from "@/i18n/useI18n";
import { downloadMb, type BuiltinLang } from "@/lib/voice/builtin";
import { canRunBuiltin, deleteBuiltin, downloadBuiltin, useBuiltin } from "@/lib/voice/builtinVoice";

const none = () => () => {};

/**
 * The game's own voice for a language: what it is and its size, then the
 * download with its progress, then "downloaded" (and, in Settings, a delete).
 * Nothing where this browser cannot run it.
 */
export default function BuiltinDownload({ lang, compact = false }: { lang: BuiltinLang; compact?: boolean }) {
  const { t } = useI18n();
  const able = useSyncExternalStore(none, canRunBuiltin, () => false);
  const { ready, loading, progress, failed } = useBuiltin();
  if (!able) return null;
  const mb = downloadMb(lang);
  const pct = Math.min(99, Math.round(progress * 100));

  if (ready[lang])
    return compact ? (
      <p className="text-xs font-bold text-ink">{t("voice.builtin.again")}</p>
    ) : (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-ink">{t("voice.builtin.ready")}</span>
        <button type="button" onClick={() => void deleteBuiltin(lang)} className={`${ui.destructive} px-3 py-2 text-xs`}>
          <Trash2 className="h-3.5 w-3.5" />
          {t("voice.builtin.delete")}
        </button>
      </div>
    );

  return (
    <div className="grid gap-2">
      {!compact && <p className="text-xs font-medium leading-relaxed text-muted">{t("voice.builtin.about", { mb })}</p>}
      {loading === lang ? (
        <div>
          <div className="h-2 overflow-hidden rounded-full bg-page">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1.5 text-xs font-bold tabular-nums text-muted">{t("voice.download.progress", { pct })}</p>
        </div>
      ) : (
        <button type="button" disabled={loading !== null} onClick={() => void downloadBuiltin(lang)} className={`${ui.secondary} w-fit px-3 py-2 text-xs`}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          {t("voice.builtin.download", { mb })}
        </button>
      )}
      {failed === lang && <p className="text-xs font-bold text-war">{t("voice.builtin.failed")}</p>}
    </div>
  );
}

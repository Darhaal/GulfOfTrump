"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import Dialog from "@/components/ui/Dialog";
import type { SuggestRequest } from "@/engine/suggest";
import { useI18n } from "@/i18n/useI18n";

/** Asks the game master for lines to pick from (engine/suggest.ts); missing while no game master is connected. */
export type Suggest = (request: SuggestRequest) => Promise<string[]>;

/** One request at a time: its lines, whether it is on its way, and a failure to say. */
export function useSuggestions(suggest: Suggest | undefined) {
  const [options, setOptions] = useState<string[] | null>(null);
  const [asking, setAsking] = useState(false);
  const [failed, setFailed] = useState(false);
  const turn = useRef(0);
  const ask = async (request: SuggestRequest) => {
    if (!suggest || asking) return;
    const n = ++turn.current;
    setAsking(true);
    setFailed(false);
    try {
      const got = await suggest(request);
      if (n === turn.current) setOptions(got);
    } catch {
      if (n === turn.current) setFailed(true);
    } finally {
      if (n === turn.current) setAsking(false);
    }
  };
  const clear = () => {
    turn.current += 1;
    setOptions(null);
    setFailed(false);
    setAsking(false);
  };
  return { options, asking, failed, ask, clear };
}

/** The button that asks: a small spark with its hint on hover, and a spinner while the game master writes. */
export function SuggestButton({ hint, asking, disabled, onClick, size = "h-4 w-4" }: { hint: string; asking: boolean; disabled?: boolean; onClick: () => void; size?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled || asking} title={hint} aria-label={hint} className="-m-1 shrink-0 rounded-lg p-1 text-accent transition-colors hover:bg-warm disabled:opacity-50">
      {asking ? <Loader2 className={`${size} animate-spin`} /> : <Sparkles className={size} />}
    </button>
  );
}

/**
 * An order already in the turn, drafted anew by the game master: the spark on its card asks, this shows the two
 * versions to pick; the one picked takes the order's place, its marks with it (engine/orderMeta.ts).
 */
export function TidyDialog({ order, state, onPick, onClose }: { order: string | null; state: ReturnType<typeof useSuggestions>; onPick: (line: string) => void; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Dialog open={Boolean(order)} onClose={onClose} title={t("orders.tidy.title")}>
      <div className="flex flex-col gap-3">
        <p className="rounded-xl bg-page p-3 text-sm font-medium leading-relaxed text-muted">{order}</p>
        {state.asking ? (
          <p className="flex items-center gap-2 text-xs font-bold text-muted">
            <Loader2 className="h-4 w-4 animate-spin text-accent" />
            {t("orders.tidy.writing")}
          </p>
        ) : (
          <SuggestChips options={state.options} failed={state.failed} onPick={onPick} />
        )}
      </div>
    </Dialog>
  );
}

/** The lines to pick from, each a chip that puts itself in the box; a word when none came. */
export function SuggestChips({ options, failed, onPick }: { options: string[] | null; failed: boolean; onPick: (line: string) => void }) {
  const { t } = useI18n();
  if (failed) return <p className="text-2xs font-medium text-muted">{t("suggest.failed")}</p>;
  if (!options) return null;
  if (!options.length) return <p className="text-2xs font-medium text-muted">{t("suggest.none")}</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button key={o} type="button" onClick={() => onPick(o)} className="rounded-xl border border-line bg-page px-2.5 py-1.5 text-left text-xs font-semibold leading-snug text-ink transition-colors hover:border-accent hover:text-accent">
          {o}
        </button>
      ))}
    </div>
  );
}

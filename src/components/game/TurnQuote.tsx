"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/useI18n";
import { AUTHOR_PORTRAIT, loadLines, nextItem, quotesUpTo, readMs, type QuoteLine, type ShownKind, type TipLine } from "@/lib/quotes";
import { ARCH } from "./Portrait";

const SEEN_KEY = "got_quotes_seen";
const TIPS_SEEN_KEY = "got_tips_seen";
/** How long a line takes to fade out before the next fades in. */
const FADE_MS = 1000;

function readSeen(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeSeen(key: string, seen: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(seen));
  } catch {
    // Not remembered: a line may come round again sooner.
  }
}

type Shown = { kind: "quote"; quote: QuoteLine } | { kind: "tip"; tip: TipLine };

/**
 * While the turn is written: a line said before the game's date, by one of
 * its statesmen or a writer or thinker of any age, then a small tip from the
 * author, by turns, each staying as
 * long as it takes to read (readMs) and fading out gently, none repeated
 * until all have been shown.
 */
export default function TurnQuote({ date }: { date: string }) {
  const { t, locale } = useI18n();
  const [shown, setShown] = useState<Shown | null>(null);
  const [leaving, setLeaving] = useState(false);
  const last = useRef<ShownKind | null>(null);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const show = async () => {
      const { quotes: all, tips } = await loadLines(locale);
      if (!alive) return;
      const quotes = quotesUpTo(all, date);
      const next = nextItem(
        { quotes: quotes.map((q) => q.id), tips: tips.map((x) => x.id) },
        { quotes: readSeen(SEEN_KEY), tips: readSeen(TIPS_SEEN_KEY) },
        last.current,
      );
      if (!next) return;
      writeSeen(SEEN_KEY, next.seen.quotes);
      writeSeen(TIPS_SEEN_KEY, next.seen.tips);
      last.current = next.kind;
      const quote = next.kind === "quote" ? quotes.find((q) => q.id === next.id) : undefined;
      const tip = next.kind === "tip" ? tips.find((x) => x.id === next.id) : undefined;
      if (!quote && !tip) return;
      setLeaving(false);
      setShown(quote ? { kind: "quote", quote } : { kind: "tip", tip: tip! });
      // Read in comfort, then a gentle fade before the next.
      timer = setTimeout(
        () => {
          if (!alive) return;
          setLeaving(true);
          timer = setTimeout(() => void show(), FADE_MS);
        },
        readMs(quote ? quote.text : tip!.text),
      );
    };
    void show();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [date, locale]);

  const fade = `transition-opacity duration-1000 ${leaving ? "opacity-0" : "opacity-100"}`;

  if (!shown) return null;
  if (shown.kind === "tip") {
    return (
      <figure key={`tip-${shown.tip.id}`} className={`mt-5 flex items-start gap-3 border-t border-divider pt-4 text-left animate-in fade-in duration-1000 ${fade}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- a small static portrait */}
        <img src={AUTHOR_PORTRAIT} alt="" width={44} height={55} className={`h-[55px] w-11 shrink-0 ${ARCH} border border-line bg-night object-cover object-top shadow-sm shadow-shade/20`} />
        <div className="min-w-0">
          <p className="text-sm font-medium leading-snug text-ink">{shown.tip.text}</p>
          <figcaption className="mt-1.5 text-2xs font-black uppercase tracking-wider text-muted">{t("quote.tip")}</figcaption>
        </div>
      </figure>
    );
  }
  const q = shown.quote;
  const [open, close] = locale === "en" ? ["“", "”"] : ["«", "»"];
  return (
    <figure key={q.id} className={`mt-5 flex items-start gap-3 border-t border-divider pt-4 text-left animate-in fade-in duration-1000 ${fade}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a small static portrait */}
      <img src={q.portrait} alt="" width={44} height={55} className={`h-[55px] w-11 shrink-0 ${ARCH} border border-line bg-night object-cover object-top shadow-sm shadow-shade/20`} />
      <div className="min-w-0">
        <blockquote className="font-serif text-sm italic leading-snug text-ink">
          {open}
          {q.text}
          {close}
        </blockquote>
        <figcaption className="mt-1.5 text-2xs font-black uppercase tracking-wider text-muted">
          {q.name}, {q.when}
        </figcaption>
      </div>
    </figure>
  );
}

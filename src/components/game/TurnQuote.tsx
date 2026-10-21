"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/useI18n";
import { loadQuotes, nextQuote, quoteIn, type Quote } from "@/lib/quotes";

const SEEN_KEY = "got_quotes_seen";
const EVERY_MS = 12_000;

function readSeen(): string[] {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeSeen(seen: string[]) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch {
    // Not remembered: a quote may come round again sooner.
  }
}

/** A line of the game's eras while the turn is written, a new one every few seconds, none repeated until all have been shown. */
export default function TurnQuote() {
  const { locale } = useI18n();
  const [quote, setQuote] = useState<Quote | null>(null);

  useEffect(() => {
    let alive = true;
    const show = async () => {
      const all = await loadQuotes();
      if (!alive || !all.length) return;
      const { id, seen } = nextQuote(
        all.map((q) => q.id),
        readSeen(),
      );
      writeSeen(seen);
      setQuote(all.find((q) => q.id === id) ?? null);
    };
    void show();
    const timer = setInterval(() => void show(), EVERY_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  if (!quote) return null;
  const q = quoteIn(quote, locale);
  const [open, close] = locale === "en" ? ["“", "”"] : ["«", "»"];
  return (
    <figure key={quote.id} className="mt-5 flex items-start gap-3 border-t border-divider pt-4 text-left animate-in fade-in duration-700">
      {quote.person && (
        // eslint-disable-next-line @next/next/no-img-element -- a small static portrait
        <img src={`/portraits/${quote.person}.webp`} alt="" width={44} height={55} className="h-[55px] w-11 shrink-0 rounded-lg border border-line object-cover" />
      )}
      <div className="min-w-0">
        <blockquote className="font-serif text-sm italic leading-snug text-ink">
          {open}
          {q.text}
          {close}
        </blockquote>
        <figcaption className="mt-1.5 text-2xs font-black uppercase tracking-wider text-muted">
          {q.name}, {q.year}
        </figcaption>
      </div>
    </figure>
  );
}

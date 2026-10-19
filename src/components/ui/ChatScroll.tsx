"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * A conversation that stays on its latest message: a box of its own height
 * that scrolls to the bottom whenever `watch` changes (a message arrives, a
 * reply starts streaming, another person is picked), so a long history never
 * has to be scrolled through to reach the reply.
 */
export default function ChatScroll({ children, watch, className }: { children: ReactNode; watch: unknown; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [watch]);
  return (
    <div ref={ref} className={`grid max-h-[52vh] content-start gap-2 overflow-y-auto overscroll-contain pr-1 ${className ?? ""}`}>
      {children}
    </div>
  );
}

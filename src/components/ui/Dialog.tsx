"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  /** For two columns side by side: a live meeting with an adviser beside it. */
  huge?: boolean;
}

/** The app's own modal — never window.confirm. Escape and the backdrop close it. */
export default function Dialog({ open, onClose, title, children, footer, wide, huge }: DialogProps) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    panel.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div className="absolute inset-0 bg-scrim/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={`relative w-full ${huge ? "sm:max-w-4xl" : wide ? "sm:max-w-2xl" : "sm:max-w-md"} max-h-[92vh] flex flex-col bg-surface border border-line rounded-t-[24px] sm:rounded-[24px] shadow-2xl shadow-shade/10 outline-none animate-in fade-in zoom-in-95 duration-200`}
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3 border-b border-divider">
          <div className="text-lg font-black text-ink tracking-tight leading-tight">{title}</div>
          <button type="button" onClick={onClose} aria-label="Close" className="group -m-1 p-1 rounded-lg hover:bg-warm">
            <X className="w-5 h-5 text-muted group-hover:text-accent" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="px-5 pb-5 pt-3 border-t border-divider">{footer}</div>}
      </div>
    </div>
  );
}

/**
 * Class recipes from the Darhaal design system (docs/design-system.md), so
 * every screen draws its cards, buttons and labels the same way.
 */
export const ui = {
  card: "bg-surface rounded-2xl border border-line shadow-sm",
  row: "group bg-surface border border-line rounded-2xl hover:shadow-lg hover:shadow-shade/5 hover:border-accent/20 transition-all duration-300",
  label: "text-2xs font-black text-muted uppercase tracking-widest",
  primary:
    "inline-flex items-center justify-center gap-2 bg-ink text-on-ink rounded-xl font-black uppercase tracking-wide hover:bg-accent hover:text-on-ink hover:shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none",
  secondary:
    "inline-flex items-center justify-center gap-2 bg-surface border border-line rounded-xl font-bold text-ink hover:border-accent/30 hover:shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none",
  iconButton: "group grid place-items-center p-2.5 bg-surface border border-line rounded-xl hover:border-accent/30 hover:shadow-sm transition-all",
  destructive:
    "inline-flex items-center justify-center gap-2 bg-surface border border-line text-muted rounded-xl shadow-sm hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-colors",
  input:
    "w-full bg-page border border-gray-200 focus:bg-surface focus:border-ink rounded-xl py-3 px-4 font-medium text-ink outline-none transition-all placeholder:text-gray-400 text-sm",
  chip: "bg-page px-2 py-1 rounded-md text-xs font-medium",
  segment: "py-2 px-3 rounded-lg text-xs font-bold transition-all",
  segmentOn: "bg-divider text-ink",
  segmentOff: "text-gray-500 hover:bg-gray-50",
} as const;

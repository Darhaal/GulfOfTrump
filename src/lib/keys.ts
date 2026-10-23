/**
 * Whether a key press in a text field sends what is written: Ctrl+Enter, or
 * Cmd+Enter on a Mac. Plain Enter starts a new line, and Enter while an input
 * method is still composing a word belongs to the word.
 */
export function isSendShortcut(e: { key: string; ctrlKey: boolean; metaKey: boolean; isComposing?: boolean }): boolean {
  return e.key === "Enter" && (e.ctrlKey || e.metaKey) && !e.isComposing;
}

/** The modifier to name in a hint: ⌘ on Apple systems, Ctrl elsewhere. */
export function sendModifier(platform: string): string {
  return /Mac|iPhone|iPad|iPod/i.test(platform) ? "⌘" : "Ctrl";
}

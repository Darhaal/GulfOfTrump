/** The longest order the field takes. */
export const ORDER_CHARS = 1000;

/**
 * An order rewritten in place: trimmed and capped. Null when nothing is to
 * change – the text is empty (removing is a button of its own), the same, or
 * the same as another order in the list.
 */
export function editOrder(list: string[], index: number, text: string): string[] | null {
  const next = text.trim().slice(0, ORDER_CHARS);
  if (!next || index < 0 || index >= list.length || next === list[index]) return null;
  if (list.some((o, i) => i !== index && o === next)) return null;
  return list.map((o, i) => (i === index ? next : o));
}

/**
 * An order of the last turn taken back into the draft to edit and send
 * again: the draft with it and where it stands, to open for editing. One
 * already in the draft is opened where it is; a standing one is in force
 * anyway; none comes back when the turn's orders are full.
 */
export function takeBack(draft: string[], standing: string[], order: string, max: number): { draft: string[]; index: number } | null {
  const at = draft.indexOf(order);
  if (at >= 0) return { draft, index: at };
  if (standing.includes(order) || draft.length + standing.length >= max) return null;
  return { draft: [...draft, order], index: draft.length };
}

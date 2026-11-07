import type { MessageKey } from "@/i18n/messages";
import type { JointKind, Localized, ProjectKind, ResearchDirection } from "@/engine/types";

type T = (key: MessageKey, params?: Record<string, string | number>) => string;
type TextFn = (value: string | Localized) => string;

/** What a joint action is about, for its title. */
export interface JointTitled {
  kind: JointKind;
  name?: Localized;
  target?: string;
  project?: ProjectKind;
  direction?: ResearchDirection;
}

/**
 * A joint action's title in the interface language (engine/joint.ts): history's
 * name with its kind, else its kind with what it builds or studies, and the
 * government it is aimed at after an arrow.
 */
export function jointTitle(j: JointTitled, t: T, text: TextFn, country: (tag: string) => string): string {
  const kind = t(`joint.kind.${j.kind}` as MessageKey);
  if (j.name) return `${text(j.name)} (${kind.toLowerCase()})`;
  const detail = j.project ? t(`joint.project.${j.project}` as MessageKey).toLowerCase() : j.direction ? t(`research.dir.${j.direction}` as MessageKey).toLowerCase() : "";
  const base = detail ? `${kind}: ${detail}` : kind;
  return j.target && j.kind !== "offensive" && j.kind !== "operation" ? `${base} → ${country(j.target)}` : base;
}

import { ADVISORS, type AdvisorId } from "@/engine/advisors";

/**
 * Who answers on each tab, by the tab's id. An adviser the cabinet does not
 * have (yet) is left out, so the table may name one before it exists.
 */
const TAB_ADVISORS: Record<string, readonly string[]> = {
  army: ["military"],
  science: ["science"],
  foreign: ["foreign"],
  politics: ["interior"],
  economy: ["finance", "industry"],
};

/** The ministers who answer on a tab: none where the tab has no adviser. */
export const tabAdvisors = (tab: string | null, advisors: readonly string[] = ADVISORS): AdvisorId[] =>
  (tab ? (TAB_ADVISORS[tab] ?? []) : []).filter((a): a is AdvisorId => advisors.includes(a));

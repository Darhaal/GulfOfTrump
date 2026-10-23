export type StartupPhase = "port" | "server" | "waiting" | "opening" | "done";
export type QuoteLocale = "en" | "ru" | "uk";

export const FIRST_GUESS_MS: number;
export function startupProgress(phase: StartupPhase, elapsedMs: number, expectedMs: number): number;
export function nextEstimate(previousMs: number, actualMs: number): number;
export function pickQuotes(ids: string[], seen: string[] | undefined, count: number, random?: () => number): { picked: string[]; seen: string[] };
export function localeOf(systemLocale: string | undefined): QuoteLocale;
export function linesFile(publicDir: string, locale: QuoteLocale): string;
export function publicFile(publicDir: string, webPath: string | undefined): string | null;
export function interleave<A, B>(a: A[], b: B[]): (A | B)[];
export function readMs(text: string): number;

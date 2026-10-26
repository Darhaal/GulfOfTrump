import { TIME_STEPS } from "@/engine/calendar";
import { GAME_MODES, LOCALES, ROLE_KINDS, START_VARIANTS } from "@/engine/types";

/**
 * What anonymous telemetry may contain, and nothing else (docs/telemetry.md).
 *
 * Every event is rebuilt here from a fixed list of columns, each with its own
 * check: a field that is not on the event's list, or a value that fails its
 * check, never reaches the queue. So texts the player or the model wrote,
 * names, e-mails, account ids, tokens and save contents cannot get through by
 * accident – there is no column they would fit in. The database checks the
 * same shapes again (supabase/migrations/20261023000000_telemetry.sql).
 *
 * Pure: no browser, no storage, no network.
 */

/** The table the rows go to, through PostgREST. */
export const TELEMETRY_TABLE = "telemetry_events";

export const TELEMETRY_EVENTS = ["app_start", "game_start", "game_load", "turn_end", "error", "feature"] as const;
export type TelemetryEvent = (typeof TELEMETRY_EVENTS)[number];

/** Where the game runs: the installer from GitHub, the Microsoft Store copy, the demo site, a browser on a copy built from source, or `next dev`. */
export const TELEMETRY_PLATFORMS = ["desktop", "store", "demo", "web", "dev"] as const;
export type TelemetryPlatform = (typeof TELEMETRY_PLATFORMS)[number];

/**
 * The major panels and actions a `feature` event may name: the game's left
 * panels, and the requests to the game master other than a turn (a letter,
 * a question to a minister, a sitting of parliament…), the timelapse and a
 * turn as a picture.
 */
export const TELEMETRY_FEATURES = [
  "panel_orders",
  "panel_opposition",
  "panel_post",
  "panel_chronicle",
  "panel_cabinet",
  "panel_politics",
  "panel_foreign",
  "panel_economy",
  "panel_army",
  "panel_science",
  "letter",
  "advice",
  "deputies",
  "deputy",
  "candidates",
  "politics",
  "army",
  "summit",
  "parliament",
  "talks",
  "timelapse",
  "picture",
] as const;
export type TelemetryFeature = (typeof TELEMETRY_FEATURES)[number];

/** The fields an event may carry besides the common ones. */
const EVENT_FIELDS = ["scenario", "variant", "country", "mode", "role", "game_key", "turn", "turn_length", "duration_ms", "tokens_in", "tokens_out", "model", "ok", "error_code", "feature"] as const;
export type TelemetryField = (typeof EVENT_FIELDS)[number];

/** Every column a row sends, in order; each row carries all of them (null when unused), as PostgREST's bulk insert wants. */
export const TELEMETRY_COLUMNS = ["install_id", "event", "app_version", "platform", "locale", ...EVENT_FIELDS] as const;
export type TelemetryColumn = (typeof TELEMETRY_COLUMNS)[number];

export type TelemetryValue = string | number | boolean | null;
export type TelemetryRow = Record<TelemetryColumn, TelemetryValue>;

/** Which fields each event may carry, and which of them it must. */
const ALLOWED: Record<TelemetryEvent, { fields: readonly TelemetryField[]; required: readonly TelemetryField[] }> = {
  app_start: { fields: [], required: [] },
  game_start: { fields: ["scenario", "variant", "country", "mode", "role", "game_key"], required: ["scenario"] },
  game_load: { fields: ["scenario", "variant", "country", "mode", "role", "game_key", "turn"], required: ["scenario"] },
  turn_end: { fields: ["scenario", "game_key", "turn", "turn_length", "duration_ms", "tokens_in", "tokens_out", "model", "ok", "error_code"], required: ["turn", "ok"] },
  error: { fields: ["error_code"], required: ["error_code"] },
  feature: { fields: ["feature"], required: ["feature"] },
};

const oneOf =
  <T extends string>(values: readonly T[]) =>
  (value: unknown): T | null =>
    typeof value === "string" && (values as readonly string[]).includes(value) ? (value as T) : null;

const matching = (pattern: RegExp, lower = false) => (value: unknown) => {
  if (typeof value !== "string") return null;
  const v = lower ? value.toLowerCase() : value;
  return pattern.test(v) ? v : null;
};

const whole = (min: number, max: number) => (value: unknown) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const n = Math.round(value);
  return n >= min && n <= max ? n : null;
};

/** An error code is a short machine word (`rate_limit_exceeded`); anything else is reported as "other", never as itself. */
const errorCode = (value: unknown) => {
  if (typeof value !== "string" || !value) return null;
  const code = value.toLowerCase();
  return /^[a-z0-9_.-]{1,64}$/.test(code) ? code : "other";
};

/** The check for each event field: its value as sent, or null when it does not pass. */
const CHECKS: Record<TelemetryField, (value: unknown) => TelemetryValue> = {
  scenario: matching(/^\d{4}$/),
  variant: oneOf(START_VARIANTS),
  // A country's tag from the scenario's own list (the caller makes sure): lower-case letters, never a name typed in a game.
  country: matching(/^[a-z][a-z0-9_-]{0,39}$/),
  mode: oneOf(GAME_MODES),
  role: oneOf(ROLE_KINDS),
  // An anonymous key of one game (telemetry/core.ts), never the save's own id.
  game_key: matching(/^[0-9a-f]{16}$/),
  turn: whole(1, 100_000),
  turn_length: oneOf(TIME_STEPS),
  duration_ms: whole(0, 86_400_000),
  tokens_in: whole(0, 100_000_000),
  tokens_out: whole(0, 100_000_000),
  // A model's slug from the account's list ("gpt-5.1"), or "demo" for the offline game master.
  model: matching(/^[a-z0-9][a-z0-9._:-]{0,63}$/, true),
  ok: (value) => (typeof value === "boolean" ? value : null),
  error_code: errorCode,
  feature: oneOf(TELEMETRY_FEATURES),
};

/** An event as it waits in the queue: already whitelisted, without the fields only the sender knows. */
export interface ShapedEvent {
  event: TelemetryEvent;
  locale: (typeof LOCALES)[number];
  fields: Partial<Record<TelemetryField, TelemetryValue>>;
}

/**
 * Shapes one event: only the fields the event may carry, each checked, built
 * afresh (nothing of the input object is kept). Null for an unknown event, a
 * language the game does not have, or a required field that is missing.
 */
export function shapeEvent(event: unknown, input: unknown, locale: unknown): ShapedEvent | null {
  const name = oneOf(TELEMETRY_EVENTS)(event);
  const language = oneOf(LOCALES)(locale);
  if (!name || !language) return null;
  const given = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const fields: ShapedEvent["fields"] = {};
  for (const field of ALLOWED[name].fields) {
    if (!Object.prototype.hasOwnProperty.call(given, field)) continue;
    const value = CHECKS[field](given[field]);
    if (value !== null) fields[field] = value;
  }
  if (ALLOWED[name].required.some((field) => fields[field] === undefined)) return null;
  return { event: name, locale: language, fields };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const isInstallId = (value: unknown): value is string => typeof value === "string" && UUID.test(value);

/** What the sender adds to every row. */
export interface RowCommon {
  install_id: string;
  app_version: string;
  platform: TelemetryPlatform;
}

/**
 * The row as sent: every column, in order, from the shaped event and the
 * common fields, checked once more. Null when the common fields are not what
 * they should be.
 */
export function buildRow(shaped: ShapedEvent, common: RowCommon): TelemetryRow | null {
  if (!isInstallId(common.install_id)) return null;
  const version = matching(/^[0-9A-Za-z.+-]{1,32}$/)(common.app_version);
  const platform = oneOf(TELEMETRY_PLATFORMS)(common.platform);
  const again = shapeEvent(shaped.event, shaped.fields, shaped.locale);
  if (!version || !platform || !again) return null;
  const row = {} as TelemetryRow;
  for (const column of TELEMETRY_COLUMNS) {
    if (column === "install_id") row[column] = common.install_id;
    else if (column === "event") row[column] = again.event;
    else if (column === "app_version") row[column] = version;
    else if (column === "platform") row[column] = platform;
    else if (column === "locale") row[column] = again.locale;
    else row[column] = again.fields[column] ?? null;
  }
  return row;
}

/** Where telemetry would go, and whether this build may send it at all. */
export interface TelemetryConfig {
  /** `{NEXT_PUBLIC_SUPABASE_URL}/rest/v1/telemetry_events`, or null without Supabase. */
  endpoint: string | null;
  /** The project's public anon key, or null without Supabase. */
  apiKey: string | null;
  /** False when switched off by NEXT_PUBLIC_GOT_TELEMETRY, or under tests; the switch in Settings then says so. */
  enabled: boolean;
}

/** Values of NEXT_PUBLIC_GOT_TELEMETRY that switch telemetry off for the whole build. */
const SWITCHED_OFF = new Set(["0", "off", "false", "no"]);

/**
 * The configuration from the environment. Next.js inlines NEXT_PUBLIC_*
 * variables at build time, so the caller passes them in by name. Telemetry
 * is available only with Supabase configured, never under tests, and never
 * when NEXT_PUBLIC_GOT_TELEMETRY is off (CI sets it so).
 */
export function telemetryConfig(env: Partial<Record<"NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY" | "NEXT_PUBLIC_GOT_TELEMETRY" | "NODE_ENV" | "VITEST", string | undefined>>): TelemetryConfig {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, "");
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const configured = Boolean(url && key && /^https?:\/\/[^/\s]+$/.test(url));
  const switchedOff = SWITCHED_OFF.has((env.NEXT_PUBLIC_GOT_TELEMETRY ?? "").trim().toLowerCase());
  const testing = env.NODE_ENV === "test" || Boolean(env.VITEST);
  return {
    endpoint: configured ? `${url}/rest/v1/${TELEMETRY_TABLE}` : null,
    apiKey: configured ? key! : null,
    enabled: configured && !switchedOff && !testing,
  };
}

import { buildRow, isInstallId, shapeEvent, type ShapedEvent, type TelemetryConfig, type TelemetryPlatform, type TelemetryRow } from "./events";

/**
 * Anonymous telemetry: the player's consent, the queue and the sender
 * (docs/telemetry.md). Everything it touches comes in through the options –
 * storage, fetch, timers, the platform – so the tests drive it directly; the
 * browser's copy is made in telemetry/index.ts.
 *
 * - Off until the player says yes. Before a yes and after a no nothing is
 *   queued and nothing is sent; a no also forgets the install id, so a later
 *   yes starts with a new one.
 * - Events are whitelisted as they are tracked (events.ts) and wait in a
 *   small queue, sent in batches every half a minute, at once when a batch is
 *   full, and on leaving the page.
 * - One request at a time. A batch that fails is dropped, never retried, and
 *   after a few failures in a row nothing more is tried until the next start.
 */

/** The player's answer: not asked yet, yes, or no. */
export type Consent = "unasked" | "on" | "off";
/** Whether this copy can send: not at all (no Supabase, switched off), being checked, yes, or not this session (the mock game master, failures). */
export type Availability = "off" | "checking" | "ready" | "blocked";

export interface TelemetrySnapshot {
  consent: Consent;
  availability: Availability;
  /** The random id of this copy while telemetry is on, shown in Settings so its rows can be erased on request. */
  installId: string | null;
}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface TelemetryOptions {
  config: TelemetryConfig;
  /** Local storage, or null where there is none; the answer then lasts the session. */
  storage: KeyValueStore | null;
  fetch: typeof fetch;
  appVersion: string;
  /** Where the game runs; asked once, before the first send. */
  platform: () => Promise<TelemetryPlatform>;
  /** The interface language at the moment of the event. */
  locale: () => string;
  /** Whether this session may send at all (false while the mock game master runs); asked once. */
  gate: () => Promise<boolean>;
  randomId: () => string;
  /** SHA-256 of a text, as hex. */
  sha256: (text: string) => Promise<string>;
  setTimer: (run: () => void, ms: number) => unknown;
  clearTimer: (timer: unknown) => void;
  /** Milliseconds between batches. */
  flushMs?: number;
  batchSize?: number;
  /** The most events kept waiting; older ones are dropped beyond it. */
  maxQueue?: number;
  /** Failed requests in a row after which nothing more is tried this session. */
  maxFailures?: number;
}

export interface Telemetry {
  snapshot(): TelemetrySnapshot;
  subscribe(listener: () => void): () => void;
  /** Runs the gate once; later calls wait for the same answer. */
  check(): Promise<void>;
  setConsent(on: boolean): void;
  /** Queues an event when telemetry is on; otherwise does nothing at all. */
  track(event: string, fields?: Record<string, unknown>): void;
  /** An anonymous key for one game: the save's id hashed with a secret that never leaves this copy, so rows cannot be matched to saves. */
  gameKey(saveId: string): Promise<string | null>;
  /** Sends what is waiting: one batch, or on leaving the page all of it, with keepalive. */
  flush(leaving?: boolean): Promise<void>;
  /** Events waiting to be sent. */
  queued(): number;
}

export const CONSENT_KEY = "got_telemetry";
export const INSTALL_KEY = "got_telemetry_id";

interface Install {
  id: string;
  /** Never sent: the secret that makes game keys unmatchable to saves. */
  salt: string;
}

export function createTelemetry(options: TelemetryOptions): Telemetry {
  const { config, storage } = options;
  const flushMs = options.flushMs ?? 30_000;
  const batchSize = options.batchSize ?? 20;
  const maxQueue = options.maxQueue ?? 100;
  const maxFailures = options.maxFailures ?? 3;
  const configured = Boolean(config.enabled && config.endpoint && config.apiKey);

  // What could not be stored stays here for the session.
  const memory = new Map<string, string>();
  const read = (key: string): string | null => {
    if (memory.has(key)) return memory.get(key)!;
    try {
      return storage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  };
  const write = (key: string, value: string | null) => {
    try {
      if (!storage) throw new Error("no storage");
      if (value === null) storage.removeItem(key);
      else storage.setItem(key, value);
      memory.delete(key);
    } catch {
      if (value === null) memory.delete(key);
      else memory.set(key, value);
    }
  };

  const consent = (): Consent => {
    const value = read(CONSENT_KEY);
    return value === "on" || value === "off" ? value : "unasked";
  };

  const install = (): Install | null => {
    try {
      const parsed = JSON.parse(read(INSTALL_KEY) ?? "null") as Partial<Install> | null;
      return parsed && isInstallId(parsed.id) && typeof parsed.salt === "string" && parsed.salt.length >= 16 ? { id: parsed.id, salt: parsed.salt } : null;
    } catch {
      return null;
    }
  };
  /** The install while telemetry is on, made afresh when there is none. */
  const ensureInstall = (): Install => {
    const found = install();
    if (found) return found;
    const made = { id: options.randomId(), salt: `${options.randomId()}${options.randomId()}` };
    write(INSTALL_KEY, JSON.stringify(made));
    return made;
  };

  let availability: Availability = configured ? "checking" : "off";
  let gate: Promise<void> | null = null;
  let platform: Promise<TelemetryPlatform> | null = null;
  let queue: ShapedEvent[] = [];
  let timer: unknown = null;
  // Requests on their way: one at a time, besides a last one on leaving the page.
  const sending = new Set<AbortController>();
  let failures = 0;

  const listeners = new Set<() => void>();
  let snap: TelemetrySnapshot = { consent: consent(), availability, installId: consent() === "on" ? (install()?.id ?? null) : null };
  const notify = () => {
    const c = consent();
    snap = { consent: c, availability, installId: c === "on" ? (install()?.id ?? null) : null };
    for (const listener of listeners) listener();
  };

  const active = () => consent() === "on" && (availability === "checking" || availability === "ready");

  const stopTimer = () => {
    if (timer !== null) options.clearTimer(timer);
    timer = null;
  };
  const drop = () => {
    queue = [];
    stopTimer();
  };
  const schedule = () => {
    if (timer === null) timer = options.setTimer(() => void flush(), flushMs);
  };
  const block = () => {
    availability = "blocked";
    drop();
    notify();
  };

  const check = () =>
    (gate ??= !configured
      ? Promise.resolve()
      : options.gate().then(
          (ok) => {
            if (availability !== "checking") return;
            if (ok) {
              availability = "ready";
              notify();
            } else block();
          },
          () => block(),
        ));

  /** A batch being prepared or sent; another flush meanwhile waits for it (except the last one, on leaving). */
  let flushing = false;

  async function send(rows: TelemetryRow[], leaving: boolean) {
    const controller = new AbortController();
    sending.add(controller);
    const timeout = options.setTimer(() => controller.abort(), 15_000);
    try {
      const response = await options.fetch(config.endpoint!, {
        method: "POST",
        headers: {
          apikey: config.apiKey!,
          authorization: `Bearer ${config.apiKey}`,
          "content-type": "application/json",
          // Nothing comes back, so the anon role needs no right to read the table.
          prefer: "return=minimal",
        },
        body: JSON.stringify(rows),
        credentials: "omit",
        cache: "no-store",
        referrerPolicy: "no-referrer",
        keepalive: leaving,
        signal: controller.signal,
      });
      failures = response.ok ? 0 : failures + 1;
    } catch {
      failures += 1;
    } finally {
      options.clearTimer(timeout);
      sending.delete(controller);
    }
  }

  async function flush(leaving = false): Promise<void> {
    stopTimer();
    if (!queue.length || (flushing && !leaving)) return;
    const mine = !leaving;
    if (mine) flushing = true;
    try {
      await check();
      if (!active()) return drop();
      const who = install();
      if (!who) return drop();
      const where = await (platform ??= options.platform().catch((): TelemetryPlatform => "web"));
      // The answer may have changed while waiting.
      if (!active()) return drop();
      const batch = queue.splice(0, leaving ? maxQueue : batchSize);
      const rows = batch.map((shaped) => buildRow(shaped, { install_id: who.id, app_version: options.appVersion, platform: where })).filter((row): row is TelemetryRow => row !== null);
      if (rows.length) await send(rows, leaving);
      if (failures >= maxFailures) return block();
    } finally {
      if (mine) flushing = false;
    }
    if (queue.length && active()) {
      if (queue.length >= batchSize) void flush();
      else schedule();
    }
  }

  return {
    snapshot: () => snap,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    check,
    setConsent(on) {
      write(CONSENT_KEY, on ? "on" : "off");
      failures = 0;
      if (on) ensureInstall();
      else {
        // A no forgets this copy's id and everything waiting, and stops a request on its way.
        write(INSTALL_KEY, null);
        drop();
        for (const request of sending) request.abort();
        sending.clear();
      }
      notify();
    },
    track(event, fields) {
      if (!active()) return;
      const shaped = shapeEvent(event, fields, options.locale());
      if (!shaped) return;
      ensureInstall();
      queue.push(shaped);
      if (queue.length > maxQueue) queue.splice(0, queue.length - maxQueue);
      if (queue.length >= batchSize) void flush();
      else schedule();
    },
    async gameKey(saveId) {
      if (consent() !== "on") return null;
      const { salt } = ensureInstall();
      try {
        return (await options.sha256(`${salt}:${saveId}`)).slice(0, 16);
      } catch {
        return null;
      }
    },
    flush,
    queued: () => queue.length,
  };
}

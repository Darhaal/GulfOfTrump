import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from "node:crypto";
import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/**
 * Local storage for the ChatGPT connection, outside the project folder so a
 * `git add .` can never pick it up: ~/.gulf-of-trump (or $GOT_HOME).
 *
 * The connection file is encrypted with AES-256-GCM under a random key kept
 * in a separate file with owner-only permissions. That stops the tokens from
 * leaking through a copied folder, a backup of one file or a screen share of
 * an editor; it does not stop malware running as your user, which could read
 * both files. See docs/security.md.
 */
export function homeDir(): string {
  return process.env.GOT_HOME || path.join(os.homedir(), ".gulf-of-trump");
}

const file = (name: string) => path.join(homeDir(), name);

async function ensureHome() {
  await mkdir(homeDir(), { recursive: true, mode: 0o700 });
}

async function writePrivate(name: string, data: string | Buffer) {
  await ensureHome();
  await writeFile(file(name), data, { mode: 0o600 });
  // writeFile's mode applies only on creation; keep it tight on rewrite too.
  await chmod(file(name), 0o600).catch(() => undefined);
}

async function readOptional(name: string): Promise<Buffer | null> {
  try {
    return await readFile(file(name));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function secretKey(): Promise<Buffer> {
  const existing = await readOptional("secret.key");
  if (existing?.length === 32) return existing;
  const key = randomBytes(32);
  await writePrivate("secret.key", key);
  return key;
}

async function writeEncrypted(name: string, value: unknown) {
  const key = await secretKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const payload = { v: 1, iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: data.toString("base64") };
  await writePrivate(name, JSON.stringify(payload));
}

async function readEncrypted<T>(name: string): Promise<T | null> {
  const raw = await readOptional(name);
  if (!raw) return null;
  try {
    const payload = JSON.parse(raw.toString("utf8")) as { iv: string; tag: string; data: string };
    const decipher = createDecipheriv("aes-256-gcm", await secretKey(), Buffer.from(payload.iv, "base64"));
    decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
    const text = Buffer.concat([decipher.update(Buffer.from(payload.data, "base64")), decipher.final()]).toString("utf8");
    return JSON.parse(text) as T;
  } catch {
    // A file from another key or a damaged one is as good as none: sign in again.
    return null;
  }
}

export interface StoredConnection {
  version: 1;
  clientId: string;
  subject: string;
  identity: { name?: string; email?: string };
  scopes: string[];
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  savedAt: string;
}

export const loadConnection = () => readEncrypted<StoredConnection>("chatgpt.json");
export const saveConnection = (connection: StoredConnection) => writeEncrypted("chatgpt.json", connection);
export const clearConnection = () => rm(file("chatgpt.json"), { force: true });

/**
 * The OAuth client id OpenAI issues on the first sign-in from this machine.
 * Kept across sign-outs so signing in again does not register a new app.
 */
export async function loadClientId(): Promise<string | null> {
  const raw = await readOptional("registration.json");
  if (!raw) return null;
  try {
    const { clientId } = JSON.parse(raw.toString("utf8")) as { clientId?: unknown };
    return typeof clientId === "string" && /^[A-Za-z0-9_-]{1,200}$/.test(clientId) ? clientId : null;
  } catch {
    return null;
  }
}

export async function saveClientId(clientId: string) {
  await writePrivate("registration.json", JSON.stringify({ clientId }));
}

/** An opaque, stable id for this installation, sent with sign-in. */
export async function hostId(): Promise<string> {
  const raw = await readOptional("host.json");
  if (raw) {
    try {
      const { hostId } = JSON.parse(raw.toString("utf8")) as { hostId?: unknown };
      if (typeof hostId === "string" && hostId.startsWith("urn:uuid:")) return hostId;
    } catch {
      // fall through and mint a new one
    }
  }
  const id = `urn:uuid:${randomUUID()}`;
  await writePrivate("host.json", JSON.stringify({ hostId: id }));
  return id;
}

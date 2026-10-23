/**
 * A save as a file: what "Export a save" writes and "Import a save" reads.
 *
 * The file is the game's state, compressed and sealed with AES-GCM, so it
 * cannot be read or edited by hand: a file changed by a single byte no
 * longer opens. The key is written below, in open code, so this keeps
 * honest players from editing numbers in a text editor rather than a
 * programmer from anything; the engine bounds what no country could have on
 * every load as well (engine/economy.ts, boundEconomy).
 *
 * Plain JSON saves still import, but only those exported before sealed
 * files existed (migration 21 or earlier): a newer plain file can only have
 * been written by hand.
 */

/** The start of a sealed file, with its format's version. */
export const SEALED = "GOTSAVE1:";
/** The extension of a sealed file. */
export const SAVE_EXTENSION = ".gotsave";
/** The last save step that exported plain JSON. */
export const LAST_PLAIN_MIGRATION = 21;

/** Not a secret – the code is open; only the key every copy of the game shares. */
const PASSPHRASE = "Gulf of Trump · save file · v1";

let keyPromise: Promise<CryptoKey> | null = null;
const key = () =>
  (keyPromise ??= crypto.subtle
    .digest("SHA-256", new TextEncoder().encode(PASSPHRASE))
    .then((raw) => crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"])));

async function through(bytes: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

const fromBase64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

/** The game as a sealed file's text. */
export async function sealSave(state: unknown): Promise<string> {
  const packed = await through(new TextEncoder().encode(JSON.stringify(state)), new CompressionStream("gzip"));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(), packed));
  const out = new Uint8Array(iv.length + sealed.length);
  out.set(iv);
  out.set(sealed, iv.length);
  return SEALED + toBase64(out);
}

/** Why a file did not open: not a save at all, or a save changed by hand or damaged. */
export class SaveFileError extends Error {
  constructor(readonly reason: "notSave" | "tampered") {
    super(reason === "tampered" ? "The save file was changed or damaged." : "The file is not a save.");
  }
}

/** The state in a save file's text, sealed or an old plain one; the caller still checks it against the schema. */
export async function openSave(text: string): Promise<unknown> {
  const body = text.trim();
  if (body.startsWith(SEALED)) {
    try {
      const bytes = fromBase64(body.slice(SEALED.length));
      const packed = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.subarray(0, 12) }, await key(), bytes.subarray(12));
      return JSON.parse(new TextDecoder().decode(await through(new Uint8Array(packed), new DecompressionStream("gzip"))));
    } catch {
      throw new SaveFileError("tampered");
    }
  }
  let plain: unknown;
  try {
    plain = JSON.parse(body);
  } catch {
    throw new SaveFileError("notSave");
  }
  const migration = (plain as { migration?: unknown } | null)?.migration;
  if (typeof migration === "number" && migration > LAST_PLAIN_MIGRATION) throw new SaveFileError("tampered");
  return plain;
}

/** A save file's name: the game, the turn and the sealed extension. */
export const saveFileName = (slug: string, turn: number) => `gulf-of-trump-${slug}-turn-${turn}${SAVE_EXTENSION}`;

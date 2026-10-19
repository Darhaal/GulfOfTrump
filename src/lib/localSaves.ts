"use client";

import type { SaveMeta } from "@/engine/types";

/**
 * Where a browser keeps its games. IndexedDB holds hundreds of megabytes;
 * localStorage, the old home, holds about five and stores text as UTF-16,
 * so it filled after some ten games. On first use the games in localStorage
 * move to IndexedDB and leave localStorage. A browser without IndexedDB (or
 * one that refuses it, as some private windows do) keeps using localStorage.
 */
export interface LocalStore {
  kind: "indexeddb" | "localstorage";
  list(): Promise<SaveMeta[]>;
  get(id: string): Promise<unknown | null>;
  put(id: string, state: unknown, meta: SaveMeta): Promise<void>;
  remove(id: string): Promise<void>;
}

// ---- localStorage, the fallback and the old home

const LS_INDEX = "got_saves";
const lsKey = (id: string) => `got_save_${id}`;

function lsIndex(): SaveMeta[] {
  try {
    const list = JSON.parse(localStorage.getItem(LS_INDEX) ?? "[]") as SaveMeta[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

const localStorageStore: LocalStore = {
  kind: "localstorage",
  async list() {
    return lsIndex();
  },
  async get(id) {
    try {
      const raw = localStorage.getItem(lsKey(id));
      return raw ? (JSON.parse(raw) as unknown) : null;
    } catch {
      return null;
    }
  },
  async put(id, state, meta) {
    localStorage.setItem(lsKey(id), JSON.stringify(state));
    localStorage.setItem(LS_INDEX, JSON.stringify([meta, ...lsIndex().filter((m) => m.id !== id)]));
  },
  async remove(id) {
    localStorage.removeItem(lsKey(id));
    localStorage.setItem(LS_INDEX, JSON.stringify(lsIndex().filter((m) => m.id !== id)));
  },
};

// ---- IndexedDB

const DB_NAME = "gulf-of-trump";
const DB_VERSION = 1;
const GAMES = "games";
const INDEX = "index";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(GAMES)) db.createObjectStore(GAMES);
      if (!db.objectStoreNames.contains(INDEX)) db.createObjectStore(INDEX);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB did not open."));
    request.onblocked = () => reject(new Error("IndexedDB is blocked by another tab."));
  });
}

const finished = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("The save transaction failed."));
    tx.onabort = () => reject(tx.error ?? new Error("The save transaction was aborted."));
  });

const answer = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("The read failed."));
  });

function indexedDbStore(db: IDBDatabase): LocalStore {
  return {
    kind: "indexeddb",
    async list() {
      return answer(db.transaction(INDEX, "readonly").objectStore(INDEX).getAll() as IDBRequest<SaveMeta[]>);
    },
    async get(id) {
      return (await answer(db.transaction(GAMES, "readonly").objectStore(GAMES).get(id))) ?? null;
    },
    async put(id, state, meta) {
      // The game and its line in the list are written together, or not at all.
      const tx = db.transaction([GAMES, INDEX], "readwrite");
      tx.objectStore(GAMES).put(state, id);
      tx.objectStore(INDEX).put(meta, id);
      await finished(tx);
    },
    async remove(id) {
      const tx = db.transaction([GAMES, INDEX], "readwrite");
      tx.objectStore(GAMES).delete(id);
      tx.objectStore(INDEX).delete(id);
      await finished(tx);
    },
  };
}

/** Moves the games from localStorage into IndexedDB, keeping the newer copy of each, then clears them from localStorage. */
async function moveFromLocalStorage(store: LocalStore): Promise<void> {
  let old: SaveMeta[];
  try {
    old = lsIndex();
  } catch {
    return;
  }
  if (!old.length) return;
  const have = new Map((await store.list()).map((m) => [m.id, m.updatedAt]));
  const left: SaveMeta[] = [];
  for (const meta of old) {
    try {
      const state = await localStorageStore.get(meta.id);
      const newer = (have.get(meta.id) ?? "") >= meta.updatedAt;
      if (state && !newer) await store.put(meta.id, state, meta);
      // Only once the game is safe in IndexedDB does it leave localStorage.
      localStorage.removeItem(lsKey(meta.id));
    } catch {
      // It stays where it was; the next page load tries again.
      left.push(meta);
    }
  }
  if (left.length) localStorage.setItem(LS_INDEX, JSON.stringify(left));
  else localStorage.removeItem(LS_INDEX);
}

let opened: Promise<LocalStore> | null = null;

/** The browser's store for games, opened (and moved over from localStorage) once per page. */
export function localStore(): Promise<LocalStore> {
  opened ??= (async () => {
    if (typeof indexedDB === "undefined") return localStorageStore;
    try {
      const store = indexedDbStore(await openDb());
      await moveFromLocalStorage(store).catch(() => undefined);
      return store;
    } catch {
      return localStorageStore;
    }
  })();
  return opened;
}

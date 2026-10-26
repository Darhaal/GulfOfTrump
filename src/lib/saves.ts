"use client";

import { isDemo } from "@/constants/app";
import { parseGameState } from "@/engine/schema";
import { newGameId } from "@/engine/setup";
import { START_VARIANTS, type GameState, type SaveMeta, type StartVariant } from "@/engine/types";
import { localStore } from "./localSaves";
import { getSupabase } from "./supabase";

/**
 * Saves live in the browser always (IndexedDB, see localSaves.ts), and in
 * the player's Supabase account as well when they are signed in. A list
 * merges both, newest copy winning; a load tries this device first. The
 * public demo saves nothing: its games stay in memory (localSaves.ts) and
 * never reach the cloud.
 */

export function metaOf(state: GameState): SaveMeta {
  return {
    id: state.id,
    ...(state.title ? { title: state.title } : {}),
    scenarioId: state.scenarioId,
    ...(state.variant ? { variant: state.variant } : {}),
    player: state.player,
    playerName: state.countries[state.player]?.name ?? state.player,
    date: state.date,
    turn: state.turn,
    updatedAt: state.updatedAt,
  };
}

export type SaveSource = "local" | "cloud";
export type ListedSave = SaveMeta & { sources: SaveSource[] };

async function cloudUserId(): Promise<string | null> {
  if (isDemo()) return null;
  const supabase = await getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

export async function listSaves(): Promise<ListedSave[]> {
  const merged = new Map<string, ListedSave>();
  const local = await (await localStore()).list().catch(() => [] as SaveMeta[]);
  for (const meta of local) merged.set(meta.id, { ...meta, sources: ["local"] });

  const supabase = await getSupabase();
  if (supabase && (await cloudUserId())) {
    const { data } = await supabase
      .from("games")
      .select("id, scenario_id, player, player_name, game_date, turn, updated_at, title:state->>title, variant:state->>variant")
      .order("updated_at", { ascending: false })
      .limit(100);
    for (const row of data ?? []) {
      const meta: SaveMeta = {
        id: row.id,
        ...(row.title ? { title: row.title as string } : {}),
        scenarioId: row.scenario_id,
        ...(START_VARIANTS.includes(row.variant as StartVariant) ? { variant: row.variant as StartVariant } : {}),
        player: row.player,
        playerName: row.player_name,
        date: row.game_date,
        turn: row.turn,
        updatedAt: row.updated_at,
      };
      const existing = merged.get(meta.id);
      if (!existing) merged.set(meta.id, { ...meta, sources: ["cloud"] });
      else {
        const newer = meta.updatedAt > existing.updatedAt ? meta : existing;
        merged.set(meta.id, { ...newer, sources: ["local", "cloud"] });
      }
    }
  }
  return [...merged.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function loadSave(id: string): Promise<GameState | null> {
  let local: GameState | null = null;
  try {
    const raw = await (await localStore()).get(id);
    local = raw ? parseGameState(raw) : null;
  } catch {
    local = null;
  }
  const supabase = await getSupabase();
  if (supabase && (await cloudUserId())) {
    const { data } = await supabase.from("games").select("state").eq("id", id).maybeSingle();
    const cloud = data ? parseGameState(data.state) : null;
    if (cloud && (!local || cloud.updatedAt > local.updatedAt)) return cloud;
  }
  return local;
}

/** Writes the save locally, then to the cloud. Throws only if neither worked. */
export async function writeSave(state: GameState): Promise<{ local: boolean; cloud: boolean }> {
  let local = false;
  try {
    await (await localStore()).put(state.id, state, metaOf(state));
    local = true;
  } catch {
    local = false;
  }

  let cloud = false;
  const supabase = await getSupabase();
  const userId = supabase ? await cloudUserId() : null;
  if (supabase && userId) {
    const meta = metaOf(state);
    const { error } = await supabase.from("games").upsert({
      id: state.id,
      owner: userId,
      scenario_id: meta.scenarioId,
      player: meta.player,
      player_name: meta.playerName,
      game_date: meta.date,
      turn: meta.turn,
      state,
      updated_at: state.updatedAt,
    });
    cloud = !error;
  }
  if (!local && !cloud) throw new Error("The game could not be saved anywhere.");
  return { local, cloud };
}

export async function deleteSave(id: string): Promise<void> {
  try {
    await (await localStore()).remove(id);
  } catch {
    // nothing stored locally
  }
  const supabase = await getSupabase();
  if (supabase && (await cloudUserId())) await supabase.from("games").delete().eq("id", id);
}

/** Gives a game a name of its own (an empty one goes back to country and year). */
export async function renameSave(id: string, title: string): Promise<GameState | null> {
  const state = await loadSave(id);
  if (!state) return null;
  const name = title.trim().slice(0, 120);
  const next: GameState = { ...state, updatedAt: new Date().toISOString() };
  if (name) next.title = name;
  else delete next.title;
  await writeSave(next);
  return next;
}

/** A copy of a game under a new id, to try another course from the same point. */
export async function duplicateSave(id: string, title: string): Promise<GameState | null> {
  const state = await loadSave(id);
  if (!state) return null;
  const now = new Date().toISOString();
  // The copy keeps the game's dice: trying another course does not reroll the world's elections and coups.
  const copy: GameState = { ...structuredClone(state), id: newGameId(), seed: state.seed ?? state.id, title: title.slice(0, 120), createdAt: now, updatedAt: now };
  await writeSave(copy);
  return copy;
}

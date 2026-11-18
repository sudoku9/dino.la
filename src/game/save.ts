import type { MetaState } from "./state";

const KEY = "arrows.meta";

export interface GameApi {
  storage: {
    get(key: string): Promise<unknown>;
    set(key: string, value: unknown): Promise<void>;
  };
  leaderboard?: {
    available: boolean;
    submit(board: string, score: number, opts?: { order?: "asc" | "desc" }): Promise<unknown>;
  };
  auth?: {
    available: boolean;
    player?: { id: string; name: string } | null;
    signIn(): Promise<unknown>;
  };
}

let game: GameApi | null = null;

export function setGame(api: GameApi): void {
  game = api;
}

export function getGame(): GameApi | null {
  return game;
}

export async function loadMeta(): Promise<MetaState | undefined> {
  if (!game) return undefined;
  const raw = await game.storage.get(KEY);
  if (raw && typeof raw === "object") {
    return raw as MetaState;
  }
  return undefined;
}

export async function saveMeta(meta: MetaState): Promise<void> {
  if (!game) return;
  try {
    await game.storage.set(KEY, meta);
  } catch (err) {
    console.error("save failed", err);
  }
}

export async function submitScore(board: string, score: number): Promise<void> {
  if (!game || !game.leaderboard || !game.leaderboard.available) return;
  try {
    await game.leaderboard.submit(board, score);
  } catch (err) {
    console.error("leaderboard submit failed", err);
  }
}

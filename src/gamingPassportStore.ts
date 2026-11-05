export const PASSPORT_KEY = "oxygen-gaming-passport-v1";
export const PASSPORT_EVENT = "m8m8s-passport-change";
export const GAME_STATUSES = { wishlist: "Wishlist", owned: "Owned", playing: "Playing", finished: "Finished" };
export type GameStatus = keyof typeof GAME_STATUSES;
export const GAME_PLATFORMS = ["Steam", "Epic Games", "GOG", "itch.io", "PlayStation", "Xbox", "Nintendo", "Mobile", "Other"];
export type PassportGame = { id: string; title: string; platform: string; status: GameStatus; notes: string; rating: number; addedAt: string; finishedAt?: string };
export function parseGameLibrary(raw: string | null): PassportGame[] {
  try {
    const value: unknown = JSON.parse(raw || "[]"); if (!Array.isArray(value)) return [];
    const ids = new Set<string>();
    return value.filter((game): game is PassportGame => {
      if (!game || typeof game.id !== "string" || game.id.length > 100 || ids.has(game.id) || typeof game.title !== "string" || !game.title.trim() || game.title.length > 180 || typeof game.platform !== "string" || game.platform.length > 50 || !Object.hasOwn(GAME_STATUSES, game.status) || typeof game.notes !== "string" || game.notes.length > 2000 || !Number.isInteger(game.rating) || game.rating < 0 || game.rating > 5 || typeof game.addedAt !== "string" || !Number.isFinite(Date.parse(game.addedAt)) || (game.finishedAt !== undefined && (typeof game.finishedAt !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(game.finishedAt)))) return false;
      ids.add(game.id); return true;
    }).slice(0, 1000);
  } catch { return []; }
}
let cachedRaw: string | null | undefined; let cachedGames: PassportGame[] = [];
export function gameLibrarySnapshot(): PassportGame[] {
  let raw: string | null = null; try { raw = localStorage.getItem(PASSPORT_KEY); } catch { /* A locked browser starts with an empty library. */ }
  if (raw !== cachedRaw) { cachedRaw = raw; cachedGames = parseGameLibrary(raw); }
  return cachedGames;
}
export function subscribeGameLibrary(changed: () => void) {
  const storage = (event: StorageEvent) => { if (event.key === PASSPORT_KEY || event.key === null) changed(); };
  window.addEventListener(PASSPORT_EVENT, changed); window.addEventListener("storage", storage);
  return () => { window.removeEventListener(PASSPORT_EVENT, changed); window.removeEventListener("storage", storage); };
}
export function saveGameLibrary(games: PassportGame[]) {
  if (games.length > 1000) throw new Error("Your passport has reached 1,000 games. Export a copy before removing entries.");
  localStorage.setItem(PASSPORT_KEY, JSON.stringify(games)); window.dispatchEvent(new Event(PASSPORT_EVENT));
}
export function addGiveawayToPassport(title: string, platform: string): boolean {
  const games = gameLibrarySnapshot();
  if (games.some(game => game.title.toLowerCase() === title.toLowerCase() && game.platform === platform)) return false;
  saveGameLibrary([{ id: crypto.randomUUID(), title: title.slice(0, 180), platform, status: "wishlist", notes: "Discovered in Free Games. Check the giveaway page to claim it; saving here does not claim or purchase the game.", rating: 0, addedAt: new Date().toISOString() }, ...games]);
  return true;
}

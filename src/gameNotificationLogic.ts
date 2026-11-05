export const TIER_ENDPOINT = "https://wxszznrkuozyptkekhjp.supabase.co/functions/v1/games-tierlist";
export const GIVEAWAY_FEED = "https://www.gamerpower.com/api/filter?platform=steam%2Bepic-games-store%2Bgog%2Bitchio&type=game&sort-by=date";
export const NOTIFICATION_KEY = "oxygen-game-notifications-v1";
export const GAME_NAMES = { zzz: "Zenless Zone Zero", genshin: "Genshin Impact", origin: "Seven Deadly Sins: Origin", hsr: "Honkai: Star Rail", grandcross: "7DS Grand Cross" };
export type GameId = keyof typeof GAME_NAMES;
export type GameNotice = { id: string; kind: "tierlist" | "freegames"; title: string; body: string; createdAt: number; read: boolean; game?: GameId; offerId?: number };
export type NoticeStore = { version: 1; items: GameNotice[]; tiers: Partial<Record<GameId, string>>; seenOffers: number[] | null; tierAlerts: boolean; freeGameAlerts: boolean };
export type OfferUpdate = { id: number; title: string; stores: string };
export type TierUpdate = { game: GameId; fingerprint: string; updatedAt: string };
const isGame = (value: unknown): value is GameId => typeof value === "string" && Object.hasOwn(GAME_NAMES, value);
const object = (value: unknown): Record<string, unknown> | null => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
export function emptyNoticeStore(): NoticeStore { return { version: 1, items: [], tiers: {}, seenOffers: null, tierAlerts: true, freeGameAlerts: true }; }
export function parseNoticeStore(raw: string | null): NoticeStore {
  const fallback = emptyNoticeStore();
  try {
    const data = object(JSON.parse(raw || "null")); if (!data || data.version !== 1) return fallback;
    const tiers: Partial<Record<GameId, string>> = {};
    for (const [game, value] of Object.entries(object(data.tiers) || {})) if (isGame(game) && typeof value === "string" && /^[a-f0-9]{64}$/.test(value)) tiers[game] = value;
    const seen = new Set<string>();
    const items = Array.isArray(data.items) ? data.items.filter((value): value is GameNotice => {
      const item = object(value); if (!item || typeof item.id !== "string" || item.id.length > 200 || seen.has(item.id) || (item.kind !== "tierlist" && item.kind !== "freegames") || typeof item.title !== "string" || item.title.length > 180 || typeof item.body !== "string" || item.body.length > 600 || typeof item.createdAt !== "number" || !Number.isFinite(item.createdAt) || typeof item.read !== "boolean" || (item.kind === "tierlist" && !isGame(item.game)) || (item.offerId !== undefined && (!Number.isSafeInteger(item.offerId) || Number(item.offerId) <= 0))) return false;
      seen.add(item.id); return true;
    }).slice(0, 100) : [];
    return { version: 1, items, tiers, seenOffers: Array.isArray(data.seenOffers) ? [...new Set(data.seenOffers.filter((id): id is number => Number.isSafeInteger(id) && id > 0))].slice(-2000) : null, tierAlerts: typeof data.tierAlerts === "boolean" ? data.tierAlerts : true, freeGameAlerts: typeof data.freeGameAlerts === "boolean" ? data.freeGameAlerts : true };
  } catch { return fallback; }
}
function characters(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error("Incomplete ranking data");
  return value.map(item => {
    const character = object(item); if (!character || typeof character.name !== "string" || !character.name.trim()) throw new Error("Incomplete character data");
    return [character.name, ...["rarity", "attribute", "race", "color"].map(key => typeof character[key] === "string" ? character[key] : "")];
  }).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
function rankingRows(value: unknown): unknown[] {
  if (!Array.isArray(value) || !value.length) throw new Error("Incomplete ranking rows");
  return value.map(item => {
    const row = object(item); if (!row || typeof row.tier !== "string") throw new Error("Incomplete ranking row");
    const roles = object(row.roles);
    return [row.tier, roles ? Object.keys(roles).sort().map(role => [role, characters(roles[role])]) : characters(row.characters)];
  }).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
async function digest(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
}
export async function readTierUpdate(value: unknown, game: GameId): Promise<TierUpdate> {
  const data = object(value); if (!data || data.game !== game || data.status !== "available" || data.stale === true || data.cache_status === "stale") throw new Error("Rankings are unavailable or stale");
  const grids = object(data.grids) || {};
  const canonical = { tiers: rankingRows(data.tiers), grids: Object.keys(grids).sort().map(key => [key, rankingRows(grids[key])]) };
  if (!(data.tiers as unknown[]).some(row => { const tier = object(row); return tier && Array.isArray(tier.characters) && tier.characters.length > 0; })) throw new Error("Empty rankings");
  return { game, fingerprint: await digest(JSON.stringify(canonical)), updatedAt: typeof data.updated_at === "string" && Number.isFinite(Date.parse(data.updated_at)) ? data.updated_at : "" };
}
export function readOfferUpdates(value: unknown): OfferUpdate[] {
  if (!Array.isArray(value)) throw new Error("Giveaway feed unavailable");
  const offers = new Map<number, OfferUpdate>(); let validRows = 0;
  for (const entry of value) {
    const item = object(entry);
    if (!item || !Number.isSafeInteger(item.id) || Number(item.id) <= 0 || typeof item.title !== "string" || !item.title.trim() || typeof item.platforms !== "string" || typeof item.status !== "string" || typeof item.type !== "string" || typeof item.description !== "string" || typeof item.gamerpower_url !== "string") continue;
    try { const url = new URL(item.gamerpower_url); if (url.protocol !== "https:" || url.hostname !== "www.gamerpower.com") continue; } catch { continue; }
    validRows++; if (item.status !== "Active" || item.type !== "Game") continue;
    const stores = [[/Steam/i, "Steam"], [/Epic Games Store/i, "Epic Games"], [/GOG/i, "GOG"], [/Itch\.io/i, "itch.io"]] as const;
    const labels = stores.filter(([pattern]) => pattern.test(String(item.platforms))).map(([, name]) => name);
    if (labels.length) offers.set(Number(item.id), { id: Number(item.id), title: item.title.slice(0, 150), stores: labels.join(" · ") });
  }
  if (value.length && !validRows) throw new Error("No valid giveaway data");
  return [...offers.values()];
}
export function applyTierUpdate(state: NoticeStore, update: TierUpdate, now: number): NoticeStore {
  if (!state.tierAlerts) return state;
  const previous = state.tiers[update.game]; const next = { ...state, tiers: { ...state.tiers, [update.game]: update.fingerprint } };
  if (!previous || previous === update.fingerprint) return next;
  const item: GameNotice = { id: `tier:${update.game}:${update.fingerprint}:${update.updatedAt || now}`, kind: "tierlist", title: `${GAME_NAMES[update.game]} updated`, body: "The rankings have changed. Open the latest tier list to see what’s new.", game: update.game, createdAt: now, read: false };
  return { ...next, items: [item, ...state.items.filter(existing => existing.id !== item.id)].slice(0, 100) };
}
export function applyOfferUpdates(state: NoticeStore, offers: OfferUpdate[], now: number): NoticeStore {
  if (!state.freeGameAlerts) return state;
  const seen = new Set(state.seenOffers || []); const fresh = offers.filter(offer => !seen.has(offer.id));
  const next = { ...state, seenOffers: [...new Set([...(state.seenOffers || []), ...offers.map(offer => offer.id)])].slice(-2000) };
  if (state.seenOffers === null || !fresh.length) return next;
  const single = fresh.length === 1 ? fresh[0] : null;
  let hash = 0xcbf29ce484222325n;
  for (const character of fresh.map(offer => offer.id).sort((a, b) => a - b).join(",")) hash = BigInt.asUintN(64, (hash ^ BigInt(character.charCodeAt(0))) * 0x100000001b3n);
  const id = `offers:${hash.toString(16)}`;
  const item: GameNotice = { id, kind: "freegames", title: single ? "New free game to claim" : `${fresh.length} new free games`, body: single ? `${single.title} · ${single.stores}` : fresh.slice(0, 3).map(offer => offer.title).join(" · ") + (fresh.length > 3 ? ` · +${fresh.length - 3} more` : ""), ...(single ? { offerId: single.id } : {}), createdAt: now, read: false };
  return { ...next, items: [item, ...state.items.filter(existing => existing.id !== id)].slice(0, 100) };
}

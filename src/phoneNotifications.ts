import { invoke } from "@tauri-apps/api/core";
export type PhoneOpen = { kind?: "tierlist" | "freegames" | "test" | "announcement"; game?: string; offerId?: number; announcementId?: string };
export function phoneNotifications<T>(action: string, payload = {}) { return invoke<T>("phone_notifications", { action, payload }); }
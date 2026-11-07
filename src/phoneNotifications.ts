import { invoke } from "@tauri-apps/api/core";
export type PhoneOpen = { kind?: "tierlist" | "freegames" | "test"; game?: string; offerId?: number };
export function phoneNotifications<T>(action: string, payload = {}) { return invoke<T>("phone_notifications", { action, payload }); }
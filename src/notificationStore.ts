import { useSyncExternalStore } from "react";
import { NOTIFICATION_KEY, parseNoticeStore, type NoticeStore } from "./gameNotificationLogic";
function read() { try { return parseNoticeStore(localStorage.getItem(NOTIFICATION_KEY)); } catch { return parseNoticeStore(null); } }
let snapshot = read();
const listeners = new Set<() => void>();
const refresh = () => { snapshot = read(); listeners.forEach(listener => listener()); };
function subscribe(listener: () => void) {
 if (!listeners.size) { window.addEventListener("storage", refresh); window.addEventListener("m8m8s-notifications-change", refresh); }
 listeners.add(listener);
 return () => { listeners.delete(listener); if (!listeners.size) { window.removeEventListener("storage", refresh); window.removeEventListener("m8m8s-notifications-change", refresh); } };
}
export function notificationSnapshot() { return snapshot; }
export function saveNotifications(next: NoticeStore) {
 localStorage.setItem(NOTIFICATION_KEY, JSON.stringify(next));
 window.dispatchEvent(new Event("m8m8s-notifications-change"));
 if (!listeners.size) snapshot = next;
}
export function useNotifications() { return useSyncExternalStore(subscribe, notificationSnapshot); }

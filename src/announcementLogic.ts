import type { GameNotice, NoticeStore } from "./gameNotificationLogic";
export const ANNOUNCEMENT_ENDPOINT = "https://wxszznrkuozyptkekhjp.supabase.co/functions/v1/announcements";
export type Announcement = { id: string; title: string; body: string; published_at: string };
export function readAnnouncements(value: unknown): Announcement[] {
 if (!Array.isArray(value) || value.length > 100) throw new Error("Invalid announcement feed");
 return value.map(raw => {
  if (!raw || typeof raw !== "object") throw new Error("Invalid announcement");
  const item = raw as Record<string,unknown>;
  if (typeof item.id !== "string" || !/^[a-f0-9-]{36}$/i.test(item.id) || typeof item.title !== "string" || !item.title.trim() || item.title.length > 140 || typeof item.body !== "string" || !item.body.trim() || item.body.length > 2000 || typeof item.published_at !== "string" || !Number.isFinite(Date.parse(item.published_at))) throw new Error("Invalid announcement");
  return { id:item.id, title:item.title, body:item.body, published_at:item.published_at };
 });
}
export function applyAnnouncements(state: NoticeStore, announcements: Announcement[]): NoticeStore {
 const seen = new Set(state.announcementSeen || []), existing = new Map(state.items.map(item=>[item.id,item]));
 const notices: GameNotice[] = announcements.map(item => {
  const id="announcement:"+item.id, saved=existing.get(id);
  return saved || {id,announcementId:item.id,kind:"announcement",title:item.title,body:item.body,createdAt:Date.parse(item.published_at),read:state.announcementSeen===null || seen.has(item.id) || !state.announcementAlerts};
 });
 const merged=new Map([...state.items,...notices].map(item=>[item.id,item]));
 return {...state,announcementSeen:[...new Set([...(state.announcementSeen||[]),...announcements.map(item=>item.id)])].slice(-2000),items:[...merged.values()].sort((a,b)=>b.createdAt-a.createdAt).slice(0,100)};
}

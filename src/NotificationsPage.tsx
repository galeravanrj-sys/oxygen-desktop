import { useEffect, useState } from "react";
import { ArrowLeft, Bell, CheckCheck, Gift, Megaphone, Settings, Trophy } from "lucide-react";
import { saveNotifications, useNotifications } from "./notificationStore";
import type { GameNotice } from "./gameNotificationLogic";
import "./NotificationPage.css";
export default function NotificationsPage({ onOpen, onSettings, initialId }: { onOpen: (notice: GameNotice) => void; onSettings: () => void; initialId?: string }) {
 const state = useNotifications(), [selected, setSelected] = useState<string | null>(initialId || null), [error, setError] = useState("");
 useEffect(() => { const notice=state.items.find(item=>item.id===initialId); if(notice&&!notice.read) { try { saveNotifications({...state,items:state.items.map(item=>item.id===initialId?{...item,read:true}:item)}); } catch { /* Read status can be retried in the list. */ } } },[initialId,state]);
 const detail = state.items.find(item => item.id === selected);
 function save(items: GameNotice[]) { try { saveNotifications({ ...state, items }); setError(""); } catch { setError("Could not save read status. Try again."); } }
 function follow(item: GameNotice) { save(state.items.map(entry => entry.id === item.id ? { ...entry, read: true } : entry)); if (item.kind === "announcement") setSelected(item.id); else onOpen(item); }
 const today = new Date(); today.setHours(0, 0, 0, 0);
 const sorted = [...state.items].sort((a,b) => b.createdAt-a.createdAt);
 const groups = [{ title: "New", items: sorted.filter(item => !item.read) }, { title: "Today", items: sorted.filter(item => item.read && item.createdAt >= today.getTime()) }, { title: "Earlier", items: sorted.filter(item => item.read && item.createdAt < today.getTime()) }];
 return <section className="notification-page" aria-label="Notification history">
  {detail ? <><button className="notification-back" onClick={() => setSelected(null)}><ArrowLeft size={18}/> All notifications</button><article className="announcement-detail"><span className="notification-category"><Megaphone size={16}/> M8M8S announcement</span><h1>{detail.title}</h1><time>{new Date(detail.createdAt).toLocaleString()}</time><p>{detail.body}</p></article></> : <>
   <header className="notification-page-heading"><div><span className="notification-category">YOUR UPDATES</span><h1>Notifications</h1><p>Everything new. Everything you missed.</p></div><button aria-label="Open notification settings" onClick={onSettings}><Settings size={20}/></button></header>
   <div className="notification-page-actions"><span>{state.items.filter(item => !item.read).length} unread</span><button disabled={!state.items.some(item => !item.read)} onClick={() => save(state.items.map(item => ({ ...item, read: true })))}><CheckCheck size={16}/> Mark all read</button></div>
   {!sorted.length && <div className="notification-page-empty"><Bell size={32}/><h2>A quiet moment.</h2><p>Your announcements, giveaways, and tier-list updates will appear here.</p></div>}
   {groups.filter(group => group.items.length).map(group => <section className="notification-group" key={group.title}><h2>{group.title}<span>{group.items.length}</span></h2><div>{group.items.map(item => <button className={`notification-history-item ${item.read ? "" : "unread"}`} key={item.id} onClick={() => follow(item)}><span className={`notification-history-icon ${item.kind}`}>{item.kind === "tierlist" ? <Trophy size={20}/> : item.kind === "announcement" ? <Megaphone size={20}/> : <Gift size={20}/>}</span><span><strong>{item.title}</strong><p>{item.body}</p><time>{new Date(item.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time></span>{!item.read && <i aria-label="Unread"/>}</button>)}</div></section>)}
  </>}{error && <p role="status">{error}</p>}
 </section>;
}

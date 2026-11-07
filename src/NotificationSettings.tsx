import { Bell } from "lucide-react";
import PhoneNotificationSettings from "./PhoneNotificationSettings";
import { saveNotifications, useNotifications } from "./notificationStore";
import { useState } from "react";
export default function NotificationSettings() {
 const state = useNotifications(), [error, setError] = useState("");
 function toggle(key: "tierAlerts" | "freeGameAlerts" | "announcementAlerts", value: boolean) { try { saveNotifications({ ...state, [key]: value }); setError(""); } catch { setError("Could not save notification settings."); } }
 return <section className="notification-settings-card" aria-label="Notification settings"><header><Bell size={21}/><div><h3>Notifications</h3><p>Choose what reaches you.</p></div></header>
 {([{key:"announcementAlerts",title:"Announcements",body:"News and messages from M8M8S."},{key:"tierAlerts",title:"Tier-list updates",body:"Changes to your game rankings."},{key:"freeGameAlerts",title:"Free games",body:"New giveaways to discover."}] as const).map(item => <label key={item.key}><span><strong>{item.title}</strong><small>{item.body}</small></span><input type="checkbox" role="switch" aria-label={item.title} checked={state[item.key]} onChange={event => toggle(item.key,event.target.checked)}/></label>)}
 <PhoneNotificationSettings tierAlerts={state.tierAlerts} freeGameAlerts={state.freeGameAlerts} announcementAlerts={state.announcementAlerts}/>{error && <p role="status">{error}</p>}</section>;
}

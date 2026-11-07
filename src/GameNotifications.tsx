import { Bell } from "lucide-react";
import { useNotifications } from "./notificationStore";
import "./GameNotifications.css";
export default function GameNotifications({onShow}:{onShow:()=>void}) {
 const state=useNotifications(),unread=state.items.filter(item=>!item.read).length;
 return <button className="m8-notification-bell" type="button" aria-label={`Notifications${unread?`, ${unread} unread`:""}`} onClick={onShow}><Bell size={18}/>{unread>0&&<span>{unread>99?"99+":unread}</span>}</button>;
}

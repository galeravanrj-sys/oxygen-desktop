import { useEffect, useRef } from "react";
import AdminApp from "./AdminApp";
export default function AdminPanel({onClose}:{onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const element=dialog.current;if(element&&!element.open)element.showModal();return()=>{element?.close();};},[]);
 return <dialog className="admin-overlay" ref={dialog} aria-label="Announcement administration" onCancel={event=>{event.preventDefault();onClose();}}><AdminApp onExit={onClose}/></dialog>;
}

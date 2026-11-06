import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
const rooms=["general","gaming","help"];
function read(key:string):Record<string,string>{try{const value=JSON.parse(localStorage.getItem(key)||"{}");return Object.fromEntries(rooms.filter(room=>typeof value?.[room]==="string"&&Number.isFinite(Date.parse(value[room]))).map(room=>[room,value[room]]));}catch{return {};}}
export function useChatUnread(room:string,active:boolean,userId:string){
 const key=`oxygen-chat-read-v1:${userId||"guest"}`;
 const [counts,setCounts]=useState<Record<string,number>>({});const seen=useRef<Record<string,string>>({});
 useEffect(()=>{let alive=true,pending=false;seen.current=read(key);async function refresh(){if(pending||document.hidden)return;pending=true;try{const{data,error}=await supabase.rpc("community_room_activity",{since:seen.current});if(!alive||error||!Array.isArray(data))return;const next={...seen.current};const result:Record<string,number>={};for(const row of data){if(!rooms.includes(row.room))continue;const baseline=!next[row.room];if(row.latest_at&&(baseline||(active&&row.room===room)))next[row.room]=row.latest_at;result[row.room]=baseline||(active&&row.room===room)?0:Number(row.unread)||0;}seen.current=next;try{localStorage.setItem(key,JSON.stringify(next));}catch{/* Session still tracks unread. */}setCounts(result);}catch{/* The core chat still works until the feature migration is installed. */}finally{pending=false;}}
 void refresh();const channel=supabase.channel(`chat-unread:${crypto.randomUUID()}`).on("postgres_changes",{event:"INSERT",schema:"public",table:"community_messages"},()=>{void refresh();}).subscribe();const interval=setInterval(()=>{void refresh();},15000);const resume=()=>{void refresh();};window.addEventListener("focus",resume);document.addEventListener("visibilitychange",resume);return()=>{alive=false;clearInterval(interval);window.removeEventListener("focus",resume);document.removeEventListener("visibilitychange",resume);void supabase.removeChannel(channel);};},[room,active,key]);
 return counts;
}

import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { ChatMessage } from "./ChatMessageExtras";
type Reaction={message_id:string;user_id:string;emoji:string};
export function useChatReactions(messages:ChatMessage[]){
 const signature=messages.map(m=>m.id).sort().join(",");const[reactions,setReactions]=useState<Reaction[]>([]);const[available,setAvailable]=useState(true);const[revision,setRevision]=useState(0);
 useEffect(()=>{if(!signature)return;let alive=true;async function get(){try{const{data,error}=await supabase.from("community_reactions").select("message_id,user_id,emoji").in("message_id",signature.split(",")).limit(2000);if(alive){setAvailable(!error);if(!error)setReactions(data||[]);}}catch{if(alive)setAvailable(false);}}void get();const channel=supabase.channel(`chat-reactions:${crypto.randomUUID()}`).on("postgres_changes",{event:"*",schema:"public",table:"community_reactions"},()=>{void get();}).subscribe();const interval=setInterval(()=>{if(!document.hidden)void get();},15000);return()=>{alive=false;clearInterval(interval);void supabase.removeChannel(channel);};},[signature,revision]);
 return{reactions:reactions.filter(r=>signature.split(",").includes(r.message_id)),available,refresh:()=>setRevision(value=>value+1)};
}

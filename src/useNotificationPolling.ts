import { useEffect } from "react";
import { applyOfferUpdates, applyTierUpdate, GAME_NAMES, GIVEAWAY_FEED, readOfferUpdates, readTierUpdate, TIER_ENDPOINT, type GameId } from "./gameNotificationLogic";
import { ANNOUNCEMENT_ENDPOINT, applyAnnouncements, readAnnouncements } from "./announcementLogic";
import { notificationSnapshot, saveNotifications } from "./notificationStore";
export default function useNotificationPolling() {
 useEffect(() => {
  let active=true,inFlight=false,lastAttempt=0;let controller:AbortController|null=null;
  async function check(){
   if(inFlight||document.visibilityState==="hidden"||Date.now()-lastAttempt<60000)return;
   inFlight=true;lastAttempt=Date.now();controller=new AbortController();const request=controller;
   const state=notificationSnapshot();
   const fetchJSON=async(url:string)=>{const response=await fetch(url,{cache:"no-cache",signal:AbortSignal.any([request.signal,AbortSignal.timeout(20000)])});if(!response.ok)throw new Error("Updates unavailable");return response.status===201?[]:await response.json();};
   const tasks:Promise<(next:ReturnType<typeof notificationSnapshot>)=>ReturnType<typeof notificationSnapshot>>[]=[];
   if(state.tierAlerts)for(const game of Object.keys(GAME_NAMES)as GameId[])tasks.push((async()=>{const update=await readTierUpdate(await fetchJSON(TIER_ENDPOINT+"?game="+game),game);return next=>applyTierUpdate(next,update,Date.now());})());
   if(state.freeGameAlerts)tasks.push((async()=>{const offers=readOfferUpdates(await fetchJSON(GIVEAWAY_FEED));return next=>applyOfferUpdates(next,offers,Date.now());})());
   tasks.push((async()=>{const announcements=readAnnouncements(await fetchJSON(ANNOUNCEMENT_ENDPOINT));return next=>applyAnnouncements(next,announcements);})());
   try{const results=await Promise.allSettled(tasks);if(!active||request.signal.aborted)return;let next=notificationSnapshot();for(const result of results)if(result.status==="fulfilled")next=result.value(next);saveNotifications(next);}catch{/* Keep saved history during network or storage failures. */}finally{inFlight=false;}
  }
  const first=window.setTimeout(()=>void check(),0),timer=window.setInterval(()=>void check(),300000);
  const resume=()=>{if(document.visibilityState==="visible")void check();};
  window.addEventListener("focus",resume);window.addEventListener("online",resume);document.addEventListener("visibilitychange",resume);
  return()=>{active=false;controller?.abort();clearTimeout(first);clearInterval(timer);window.removeEventListener("focus",resume);window.removeEventListener("online",resume);document.removeEventListener("visibilitychange",resume);};
 },[]);
}

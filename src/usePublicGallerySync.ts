import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { GALLERY_BUCKET, supabase } from "./supabase";

export const GALLERY_SYNC_TOPIC = "oxygen-gallery-public-v1";
export function usePublicGallerySync() {
  const [photos, setPhotos] = useState<{ name: string; url: string }[]>([]);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Auto-sync connecting");
  const channel = useRef<RealtimeChannel | null>(null);
  const work = useRef({ alive: false, generation: 0, request: null as Promise<void> | null, repeat: false });
  const refresh = useCallback((): Promise<void> => {
    const state = work.current;
    if (!state.alive) return Promise.resolve();
    if (state.request) { state.repeat = true; return state.request; }
    const generation = state.generation;
    const current = () => state.alive && state.generation === generation;
    const request = (async () => {
      do {
        state.repeat = false;
        try {
          const { data, error: listError } = await supabase.storage.from(GALLERY_BUCKET).list("photos", { limit: 100, sortBy: { column: "created_at", order: "desc" } });
          if (!current()) return;
          if (listError) { setError(`Public photos unavailable: ${listError.message}`); return; }
          // Broadcasts are only change hints. Always read the real, authorized Storage list.
          setPhotos((data ?? []).filter(item => /\.(jpe?g|png|webp)$/i.test(item.name)).map(item => ({ name: item.name, url: supabase.storage.from(GALLERY_BUCKET).getPublicUrl(`photos/${item.name}`).data.publicUrl })));
          setError("");
        } catch { if (current()) setError("Public photos could not sync. Your current photos are kept; reconnect or try again."); return; }
      } while (state.repeat && current());
    })();
    state.request = request;
    void request.finally(() => { if (current()) state.request = null; });
    return request;
  }, []);
  useEffect(() => {
    const state = work.current;
    state.alive = true; state.generation++; state.request = null; state.repeat = false;
    let timer: number | undefined;
    const schedule = () => {
      if (document.hidden || timer !== undefined) return;
      timer = window.setTimeout(() => { timer = undefined; void refresh(); }, 500);
    };
    const active = supabase.channel(GALLERY_SYNC_TOPIC).on("broadcast", { event: "changed" }, schedule).subscribe(connection => {
      if (!state.alive || channel.current !== active) return;
      setStatus(connection === "SUBSCRIBED" ? "Live auto-sync" : "Auto-sync every 10 seconds");
      if (connection === "SUBSCRIBED") schedule();
    });
    channel.current = active;
    schedule();
    const interval = window.setInterval(schedule, 10000);
    window.addEventListener("online", schedule);
    window.addEventListener("focus", schedule);
    document.addEventListener("visibilitychange", schedule);
    return () => {
      state.alive = false; state.generation++; state.repeat = false;
      clearTimeout(timer); clearInterval(interval);
      window.removeEventListener("online", schedule); window.removeEventListener("focus", schedule); document.removeEventListener("visibilitychange", schedule);
      if (channel.current === active) channel.current = null;
      void supabase.removeChannel(active);
    };
  }, [refresh]);
  const announce = useCallback(() => {
    // No file contents, filenames, account information, or private photos are broadcast.
    const active = channel.current;
    if (active) void active.httpSend("changed", {}, { timeout: 3000 }).catch(() => { /* Other clients retain the polling fallback. */ });
  }, []);
  return { photos, syncError: error, syncStatus: status, refresh, announce };
}

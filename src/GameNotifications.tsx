import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, CheckCheck, Gift, RefreshCw, Trophy, X } from "lucide-react";
import { applyOfferUpdates, applyTierUpdate, GAME_NAMES, GIVEAWAY_FEED, NOTIFICATION_KEY, parseNoticeStore, readOfferUpdates, readTierUpdate, TIER_ENDPOINT, type GameId, type GameNotice, type NoticeStore } from "./gameNotificationLogic";
import "./GameNotifications.css";

function load() { try { return parseNoticeStore(localStorage.getItem(NOTIFICATION_KEY)); } catch { return parseNoticeStore(null); } }
export default function GameNotifications({ onOpen, onPanelOpen }: { onOpen: (notice: GameNotice) => void; onPanelOpen: () => void }) {
  const [state, setState] = useState(load); const current = useRef(state); const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false); const [lastCheck, setLastCheck] = useState(""); const [checkError, setCheckError] = useState(""); const [storageError, setStorageError] = useState(""); const bell = useRef<HTMLButtonElement>(null); const panel = useRef<HTMLElement>(null); const checkNow = useRef<() => void>(() => {});
  const commit = useCallback((next: NoticeStore) => {
    current.current = next; setState(next);
    try { localStorage.setItem(NOTIFICATION_KEY, JSON.stringify(next)); setStorageError(""); } catch { setStorageError("Notifications could not be saved to this browser. They are available for this session."); }
  }, []);
  useEffect(() => {
    let active = true, inFlight = false, lastAttempt = 0; let request: AbortController | null = null;
    async function check(manual = false) {
      if (inFlight || (!manual && document.visibilityState === "hidden") || (!manual && Date.now() - lastAttempt < 60000)) return;
      if (!current.current.tierAlerts && !current.current.freeGameAlerts) return;
      inFlight = true; lastAttempt = Date.now(); request = new AbortController(); const controller = request;
      setBusy(true); setCheckError("");
      const games = current.current.tierAlerts ? Object.keys(GAME_NAMES) as GameId[] : [];
      const tasks: Promise<{ type: "tier"; value: Awaited<ReturnType<typeof readTierUpdate>> } | { type: "offers"; value: ReturnType<typeof readOfferUpdates> }>[] = games.map(async game => {
        const response = await fetch(`${TIER_ENDPOINT}?game=${game}`, { cache: "no-cache", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]) });
        if (!response.ok) throw new Error("Tier list unavailable");
        return { type: "tier" as const, value: await readTierUpdate(await response.json(), game) };
      });
      if (current.current.freeGameAlerts) tasks.push((async () => {
        const response = await fetch(GIVEAWAY_FEED, { cache: "no-cache", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]) });
        if (!response.ok) throw new Error("Giveaways unavailable");
        return { type: "offers" as const, value: readOfferUpdates(response.status === 201 ? [] : await response.json()) };
      })());
      try {
        const results = await Promise.allSettled(tasks); if (!active || controller.signal.aborted) return;
        let next = current.current; let failed = 0;
        for (const result of results) {
          if (result.status === "rejected") { failed++; continue; }
          next = result.value.type === "tier" ? applyTierUpdate(next, result.value.value, Date.now()) : applyOfferUpdates(next, result.value.value, Date.now());
        }
        if (!active || controller.signal.aborted) return;
        commit(next); setLastCheck(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
        setCheckError(failed ? `${failed} ${failed === 1 ? "source could" : "sources could"} not be checked. Your saved updates are kept.` : "");
      } finally { inFlight = false; if (active) setBusy(false); }
    }
    checkNow.current = () => { void check(true); };
    const first = window.setTimeout(() => { void check(); }, 0); const timer = window.setInterval(() => { void check(); }, 5 * 60000);
    const visible = () => { if (document.visibilityState === "visible") void check(); };
    const synchronize = (event: StorageEvent) => { if (event.key === NOTIFICATION_KEY) { const next = parseNoticeStore(event.newValue); current.current = next; setState(next); } };
    const localUpdate = () => { const next = load(); current.current = next; setState(next); };
    window.addEventListener("m8m8s-notifications-change", localUpdate);
    document.addEventListener("visibilitychange", visible); window.addEventListener("focus", visible); window.addEventListener("storage", synchronize);
    return () => { active = false; request?.abort(); window.clearTimeout(first); window.clearInterval(timer); document.removeEventListener("visibilitychange", visible); window.removeEventListener("focus", visible); window.removeEventListener("storage", synchronize); window.removeEventListener("m8m8s-notifications-change", localUpdate); };
  }, [commit]);
  useEffect(() => {
    if (!open) return; panel.current?.focus({ preventScroll: true });
    const outside = (event: PointerEvent) => { const target = event.target as Node; if (!panel.current?.contains(target) && !bell.current?.contains(target)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); bell.current?.focus(); } };
    document.addEventListener("pointerdown", outside); window.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); window.removeEventListener("keydown", escape); };
  }, [open]);
  const unread = state.items.filter(item => !item.read).length;
  function toggle(kind: "tierAlerts" | "freeGameAlerts", value: boolean) { commit({ ...current.current, [kind]: value }); if (value) checkNow.current(); }
  function follow(item: GameNotice) { commit({ ...current.current, items: current.current.items.map(notice => notice.id === item.id ? { ...notice, read: true } : notice) }); setOpen(false); onOpen(item); }
  return <>
    <button ref={bell} className="m8-notification-bell" type="button" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} aria-expanded={open} aria-haspopup="dialog" aria-controls="m8-notification-center" onClick={() => { if (!open) onPanelOpen(); setOpen(value => !value); }}><Bell size={18}/>{unread > 0 && <span>{unread > 99 ? "99+" : unread}</span>}</button>
    {open && createPortal(<section ref={panel} tabIndex={-1} className="m8-notification-panel" id="m8-notification-center" role="dialog" aria-label="Notifications">
      <header><div><span className="m8-notification-eyebrow">STAY IN THE LOOP</span><h2>Notifications {unread > 0 && <small>{unread} new</small>}</h2></div><button type="button" aria-label="Close notifications" onClick={() => { setOpen(false); bell.current?.focus(); }}><X size={18}/></button></header>
      <div className="m8-notification-actions"><button type="button" disabled={!unread} onClick={() => commit({ ...current.current, items: current.current.items.map(item => ({ ...item, read: true })) })}><CheckCheck size={15}/> Mark all read</button><button type="button" aria-label="Check for updates now" disabled={busy || (!state.tierAlerts && !state.freeGameAlerts)} onClick={() => checkNow.current()}><RefreshCw size={15} className={busy ? "m8-checking" : ""}/> {busy ? "Checking…" : "Check now"}</button></div>
      <div className="m8-notification-list">{state.items.length ? state.items.map(item => <button type="button" className={`m8-notice ${item.read ? "is-read" : "is-unread"}`} key={item.id} onClick={() => follow(item)}><span className={`m8-notice-icon ${item.kind}`}>{item.kind === "tierlist" ? <Trophy size={18}/> : <Gift size={18}/>}</span><span className="m8-notice-copy"><strong>{item.title}</strong><span>{item.body}</span><small>{new Date(item.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</small></span>{!item.read && <i aria-label="Unread"/>}</button>) : <div className="m8-notifications-empty"><Bell size={28}/><h3>You’re all caught up</h3><p>New giveaways and changed rankings will appear here after the first successful check.</p></div>}</div>
      <details className="m8-notification-settings"><summary>Notification settings</summary><label><input type="checkbox" checked={state.tierAlerts} onChange={event => toggle("tierAlerts", event.target.checked)}/> Tier-list changes</label><label><input type="checkbox" checked={state.freeGameAlerts} onChange={event => toggle("freeGameAlerts", event.target.checked)}/> New free games</label><p>The first check sets a baseline. Scheduled refreshes with unchanged rankings don’t create alerts.</p></details>
      <footer><p role="status">{storageError || (!state.tierAlerts && !state.freeGameAlerts ? "Notifications are paused." : checkError) || (lastCheck ? `Last check ${lastCheck}` : "Preparing the first check…")}</p><div><span>Checks every 5 minutes while this website is open and visible.</span><button type="button" disabled={!state.items.some(item => item.read)} onClick={() => commit({ ...current.current, items: current.current.items.filter(item => !item.read) })}>Clear read</button></div></footer>
    </section>, document.querySelector(".os-shell") || document.body)}
  </>;
}

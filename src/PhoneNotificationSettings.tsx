import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { phoneNotifications } from "./phoneNotifications";
type PhoneStatus = { enabled: boolean; granted: boolean; lastCheck: number };
export default function PhoneNotificationSettings({ tierAlerts, freeGameAlerts, announcementAlerts }: { tierAlerts: boolean; freeGameAlerts: boolean; announcementAlerts: boolean }) {
  const [status, setStatus] = useState<PhoneStatus | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  useEffect(() => {
    if (!isTauri()) return;
    let active = true;
    const refresh = () => { void phoneNotifications<PhoneStatus>("status").then(value => { if (active) setStatus(value); }).catch(() => { if (active) setMessage("Phone notifications could not be loaded."); }); };
    refresh(); window.addEventListener("focus", refresh);
    return () => { active = false; window.removeEventListener("focus", refresh); };
  }, []);
  useEffect(() => {
    if (status?.enabled) void phoneNotifications<PhoneStatus>("configure", { enabled: true, tierAlerts, freeGameAlerts, announcementAlerts }).then(setStatus).catch(() => setMessage("Could not save phone alert preferences. Try again."));
  }, [tierAlerts, freeGameAlerts, announcementAlerts, status?.enabled]);
  if (!isTauri()) return null;
  async function action(name: string) {
    setBusy(true); setMessage("");
    try {
      if (name === "enable") {
        const permission = await phoneNotifications<PhoneStatus>("requestPermission");
        if (!permission.granted) { setStatus(permission); setMessage("Allow M8M8S notifications in Android settings, then enable them here."); return; }
        setStatus(await phoneNotifications<PhoneStatus>("configure", { enabled: true, tierAlerts, freeGameAlerts, announcementAlerts }));
        setMessage("Phone alerts are enabled. The first check sets a quiet baseline.");
      } else if (name === "disable") {
        setStatus(await phoneNotifications<PhoneStatus>("configure", { enabled: false, tierAlerts, freeGameAlerts, announcementAlerts }));
      } else {
        await phoneNotifications(name);
        if (name === "test") setMessage("Test sent. Look in your phone's notification panel.");
      }
    } catch { setMessage("Could not update phone notifications. Try again or check Android settings."); }
    finally { setBusy(false); }
  }
  return <section className="m8-phone-settings" aria-label="Phone notifications"><strong>On your phone</strong>
    <p>{status?.enabled && status.granted ? "Phone alerts are enabled." : "Get announcements, tier-list updates, and giveaways in your phone's notification panel."}</p>
    <div><button type="button" disabled={busy || !status} onClick={() => void action(status?.enabled ? "disable" : "enable")}>{status?.enabled ? "Turn off phone alerts" : "Enable phone alerts"}</button>
    {status?.enabled && status.granted && <button type="button" disabled={busy} onClick={() => void action("test")}>Send test</button>}
    <button type="button" disabled={busy} onClick={() => void action("openSettings")}>Android settings</button></div>
    <p>Checks about every 15 minutes, including in the background. Android may delay alerts to save battery. Force-stopping the app pauses checks until you reopen it.</p>
    {message && <p role="status">{message}</p>}</section>;
}

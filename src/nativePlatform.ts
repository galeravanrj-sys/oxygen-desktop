import { isTauri } from "@tauri-apps/api/core";
import { siteAlert } from "./websiteDialogStore";

export async function openExternal(url: string) {
  const target = new URL(url, location.href);
  if (!["https:", "http:"].includes(target.protocol)) return;
  if (isTauri()) {
    try { const { openUrl } = await import("@tauri-apps/plugin-opener"); await openUrl(target.href); }
    catch { await siteAlert("The link could not be opened. Check that a browser is installed and try again."); }
  } else window.open(target.href, "_blank", "noopener,noreferrer");
}

export function installNativePlatform() {
  if (!isTauri()) return;
  document.documentElement.classList.add("native-app");
  document.addEventListener("click", event => {
    const link = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href]");
    if (!link || link.hasAttribute("download") || !["https:", "http:"].includes(new URL(link.href).protocol)) return;
    if (link.target !== "_blank" && new URL(link.href).origin === location.origin) return;
    event.preventDefault(); void openExternal(link.href);
  });
}

import { useState, type ChangeEvent } from "react";
import { ArrowDown, ArrowUp, Star } from "lucide-react";
import "./PersonalApps.css";
import { themes, type Preferences } from "./desktopPreferences";
async function wallpaperData(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) throw new Error("Choose a JPG, PNG, or WebP image up to 10 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Could not prepare this image.");
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL("image/jpeg", .8);
    if (data.length > 1800000) throw new Error("This image is too detailed to save. Please choose a smaller image.");
    return data;
  } finally { bitmap.close(); }
}
export default function Personalization({ preferences, onChange }: { preferences: Preferences; onChange: (value: Preferences) => void }) {
  const [error, setError] = useState(""); const [uploading, setUploading] = useState(false);
  function save(next: Preferences) { try { onChange(next); setError(""); } catch { setError("Could not save your settings. Your browser storage may be full."); } }
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    setUploading(true); setError("");
    try { const wallpaper = await wallpaperData(file); onChange({ ...preferences, wallpaper }); } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save wallpaper."); } finally { setUploading(false); }
  }
  function move(index: number, offset: number) { const order = [...preferences.order]; [order[index], order[index + offset]] = [order[index + offset], order[index]]; save({ ...preferences, order }); }
  return <section className="pa-settings"><h3>Make it yours</h3><p>Saved on this browser. Favorites stay pinned to your taskbar.</p>
    <div className="pa-themes">{Object.entries(themes).map(([id, background]) => <button type="button" key={id} aria-pressed={preferences.theme === id && !preferences.wallpaper} style={{ background }} onClick={() => save({ ...preferences, theme: id, wallpaper: "" })}>{id === "default" ? "Classic" : id}</button>)}</div>
    <label className="pa-upload">{uploading ? "Preparing wallpaper…" : "Upload wallpaper"}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={event => void upload(event)}/></label>
    {preferences.wallpaper && <button type="button" onClick={() => save({ ...preferences, wallpaper: "" })}>Remove uploaded wallpaper</button>}
    <p role="status">{error}</p><h3>Home-screen apps</h3><p>Use the arrows to rearrange apps. Select a star to favorite an app.</p>
    <ol className="pa-order">{preferences.order.map((name, index) => <li key={name}><span>{name}</span><button type="button" aria-label={`Favorite ${name}`} aria-pressed={preferences.favorites.includes(name)} onClick={() => save({ ...preferences, favorites: preferences.favorites.includes(name) ? preferences.favorites.filter(item => item !== name) : [...preferences.favorites, name] })}><Star size={16} fill={preferences.favorites.includes(name) ? "currentColor" : "none"}/></button><button type="button" aria-label={`Move ${name} earlier`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={16}/></button><button type="button" aria-label={`Move ${name} later`} disabled={index === preferences.order.length - 1} onClick={() => move(index, 1)}><ArrowDown size={16}/></button></li>)}</ol>
  </section>;
}

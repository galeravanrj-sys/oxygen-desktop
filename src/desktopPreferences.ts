export type Preferences = { accent: string; iconStyle: "rounded" | "circle" | "square"; windowOpacity: number; theme: string; wallpaper: string; order: string[]; favorites: string[] };
export const PREF_KEY = "oxygen-personalization-v1";
export const themes: Record<string, string> = {
  default: "linear-gradient(125deg,#c9a6c9,#9faddb 35%,#7895d6 65%,#5069aa)",
  ocean: "linear-gradient(125deg,#093b59,#267e98,#8acac1)",
  sunset: "linear-gradient(125deg,#4e3979,#be6e97,#eab28b)",
  forest: "linear-gradient(125deg,#173e3b,#477c69,#a0bfa2)",
};
export function loadPreferences(names: string[]): Preferences {
  let value: Partial<Preferences> = {};
  try { value = JSON.parse(localStorage.getItem(PREF_KEY) || "{}") || {}; } catch { /* Use defaults. */ }
  const order = Array.isArray(value.order) ? [...new Set(value.order.filter(name => names.includes(name)))] : [];
  return { accent: typeof value.accent === "string" && /^#[0-9a-f]{6}$/i.test(value.accent) ? value.accent : "#8b5cf6", iconStyle: value.iconStyle === "circle" || value.iconStyle === "square" ? value.iconStyle : "rounded", windowOpacity: typeof value.windowOpacity === "number" && Number.isFinite(value.windowOpacity) ? Math.max(.65, Math.min(1, value.windowOpacity)) : 1, theme: typeof value.theme === "string" && Object.hasOwn(themes, value.theme) ? value.theme : "default", wallpaper: typeof value.wallpaper === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(value.wallpaper) ? value.wallpaper : "", order: [...order, ...names.filter(name => !order.includes(name))], favorites: Array.isArray(value.favorites) ? [...new Set(value.favorites.filter(name => names.includes(name)))] : [] };
}

export function accentInk(accent: string) {
  const channels = [1, 3, 5].map(index => parseInt(accent.slice(index, index + 2), 16) / 255).map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
  const luminance = .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
  return luminance > .179 ? "#000000" : "#ffffff";
}

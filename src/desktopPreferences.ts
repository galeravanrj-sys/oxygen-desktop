export type Preferences = { theme: string; wallpaper: string; order: string[]; favorites: string[] };
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
  return { theme: typeof value.theme === "string" && value.theme in themes ? value.theme : "default", wallpaper: typeof value.wallpaper === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(value.wallpaper) ? value.wallpaper : "", order: [...order, ...names.filter(name => !order.includes(name))], favorites: Array.isArray(value.favorites) ? [...new Set(value.favorites.filter(name => names.includes(name)))] : [] };
}

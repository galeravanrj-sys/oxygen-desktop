import type { MobileData } from "../types/models";
import { parseGameLibrary } from "./gamingPassport";
import { validHistory } from "./calculatorEngine";
export const defaultSettings: MobileData["settings"] = {
  theme: "system",
  accent: "#7253ba",
  iconStyle: "rounded",
  wallpaper: "",
  favorites: ["tasks", "notes", "gallery", "camera"],
  order: [],
  city: null,
  backgroundUpdates: false,
};
export function emptyData(): MobileData {
  return {
    version: 1,
    notes: [],
    tasks: [],
    events: [],
    games: [],
    photos: [],
    files: [{ id: "root", parent: null, name: "Home", kind: "folder" }],
    bookmarks: [],
    history: [],
    settings: { ...defaultSettings },
    chatName: "",
    chatSeen: {},
  };
}
const record = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const text = (v: unknown, max = 2000): v is string =>
  typeof v === "string" && v.length <= max;
const objects = (v: unknown) =>
  Array.isArray(v) ? v.map(record).slice(0, 2000) : [];
/** A backup is data, never instructions or executable settings. Ignore unsupported fields. */
export function validateData(input: unknown): MobileData {
  const raw = record(input);
  if (raw.version !== 1)
    throw new Error("This is not a supported M8M8S backup (version 1).");
  const next = emptyData();
  next.notes = objects(raw.notes).filter(
    (n) => text(n.id, 100) && text(n.title, 160) && text(n.body, 200000),
  ) as MobileData["notes"];
  next.tasks = objects(raw.tasks).filter(
    (n) =>
      text(n.id, 100) &&
      text(n.title, 300) &&
      typeof n.done === "boolean" &&
      text(n.due, 32),
  ) as MobileData["tasks"];
  next.events = objects(raw.events).filter(
    (n) =>
      text(n.id, 100) &&
      text(n.title, 300) &&
      typeof n.date === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(n.date),
  ) as MobileData["events"];
  next.games = parseGameLibrary(JSON.stringify(raw.games));
  next.history = validHistory(raw.history);
  next.photos = objects(raw.photos).filter(
    (n) =>
      text(n.id, 100) &&
      text(n.name, 300) &&
      typeof n.uri === "string" &&
      n.uri.startsWith("file://") &&
      text(n.createdAt, 64),
  ) as MobileData["photos"];
  next.files = objects(raw.files).filter(
    (n) =>
      text(n.id, 100) &&
      text(n.name, 300) &&
      (n.parent === null || text(n.parent, 100)) &&
      (n.kind === "folder" ||
        (n.kind === "file" &&
          typeof n.uri === "string" &&
          n.uri.startsWith("file://"))),
  ) as MobileData["files"];
  if (!next.files.some((f) => f.id === "root" && f.parent === null))
    next.files.unshift({
      id: "root",
      parent: null,
      name: "Home",
      kind: "folder",
    });
  next.bookmarks = objects(raw.bookmarks).filter(
    (n) =>
      text(n.id, 100) &&
      text(n.title, 300) &&
      typeof n.url === "string" &&
      /^https?:\/\//i.test(n.url),
  ) as MobileData["bookmarks"];
  const s = record(raw.settings);
  next.settings = {
    ...defaultSettings,
    theme: ["light", "dark", "system"].includes(String(s.theme))
      ? (s.theme as MobileData["settings"]["theme"])
      : "system",
    accent:
      typeof s.accent === "string" && /^#[0-9a-f]{6}$/i.test(s.accent)
        ? s.accent
        : defaultSettings.accent,
    iconStyle: ["circle", "square", "rounded"].includes(String(s.iconStyle))
      ? (s.iconStyle as MobileData["settings"]["iconStyle"])
      : "rounded",
    favorites: Array.isArray(s.favorites)
      ? s.favorites.filter((v): v is string => text(v, 100))
      : defaultSettings.favorites,
    order: Array.isArray(s.order)
      ? s.order.filter((v): v is string => text(v, 100))
      : [],
    wallpaper:
      typeof s.wallpaper === "string" && s.wallpaper.startsWith("file://")
        ? s.wallpaper
        : "",
    city: null,
    backgroundUpdates: s.backgroundUpdates === true,
  };
  const city = record(s.city);
  if (
    text(city.name, 200) &&
    typeof city.id === "number" &&
    typeof city.latitude === "number" &&
    Number.isFinite(city.latitude) &&
    Math.abs(city.latitude) <= 90 &&
    typeof city.longitude === "number" &&
    Number.isFinite(city.longitude) &&
    Math.abs(city.longitude) <= 180
  )
    next.settings.city = city as MobileData["settings"]["city"];
  next.chatName = text(raw.chatName, 32) ? raw.chatName : "";
  next.chatSeen = Object.fromEntries(
    Object.entries(record(raw.chatSeen)).filter(
      ([k, v]) =>
        ["general", "gaming", "help"].includes(k) &&
        typeof v === "string" &&
        Number.isFinite(Date.parse(v)),
    ),
  ) as Record<string, string>;
  return next;
}
export function browserAddress(input: string) {
  const raw = input.trim();
  if (!raw) throw new Error("Enter an address or search.");
  if (/^[a-z][a-z\d+.-]*:/i.test(raw) && !/^https?:\/\//i.test(raw))
    throw new Error("Only HTTP and HTTPS addresses are supported.");
  const target = /^https?:\/\//i.test(raw)
    ? raw
    : /^[^\s]+\.[^\s]+$/.test(raw)
      ? `https://${raw}`
      : `https://www.google.com/search?q=${encodeURIComponent(raw)}`;
  const parsed = new URL(target);
  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password
  )
    throw new Error("Enter a public HTTP or HTTPS address.");
  return parsed.href;
}
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

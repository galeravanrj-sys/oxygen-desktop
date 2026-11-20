import type { PassportGame } from "../lib/gamingPassport";
import type { HistoryItem } from "../lib/calculatorEngine";
export type Note = { id: string; title: string; body: string };
export type Task = {
  id: string;
  title: string;
  done: boolean;
  due: string;
  reminder?: string;
};
export type CalendarEvent = {
  id: string;
  date: string;
  title: string;
  reminder?: string;
};
export type LocalPhoto = {
  id: string;
  name: string;
  uri: string;
  createdAt: string;
};
export type FileEntry = {
  id: string;
  parent: string | null;
  name: string;
  kind: "folder" | "file";
  uri?: string;
  mime?: string;
  size?: number;
};
export type City = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
};
export type Bookmark = { id: string; title: string; url: string };
export type Settings = {
  theme: "system" | "light" | "dark";
  accent: string;
  iconStyle: "rounded" | "circle" | "square";
  wallpaper: string;
  favorites: string[];
  order: string[];
  city: City | null;
  backgroundUpdates: boolean;
};
export type MobileData = {
  version: 1;
  notes: Note[];
  tasks: Task[];
  events: CalendarEvent[];
  games: PassportGame[];
  photos: LocalPhoto[];
  files: FileEntry[];
  bookmarks: Bookmark[];
  history: HistoryItem[];
  settings: Settings;
  chatName: string;
  chatSeen: Record<string, string>;
};
export type ChatMessage = {
  id: string;
  room: string;
  user_id: string;
  display_name: string;
  body: string;
  created_at: string;
  reply_to?: string | null;
};
export type Reaction = { message_id: string; user_id: string; emoji: string };
export type Announcement = {
  id: string;
  title: string;
  body: string;
  status?: "draft" | "published";
  published_at?: string;
  created_at?: string;
};
export type Offer = {
  id: number;
  title: string;
  description: string;
  platforms: string;
  image?: string;
  gamerpower_url: string;
  end_date: string;
  status: string;
  type: string;
  worth?: string;
};
export type TierCharacter = {
  name: string;
  image?: string;
  url?: string;
  rarity?: string;
  attribute?: string;
  subtitle?: string;
  role?: string;
};
export type TierRow = {
  tier: string;
  characters?: TierCharacter[];
  roles?: Record<string, TierCharacter[]>;
};
export type TierPayload = {
  game: string;
  status?: string;
  title?: string;
  source?: string;
  stale?: boolean;
  cache_status?: string;
  updated_at?: string;
  imported_at?: string;
  source_updated?: string;
  tiers: TierRow[];
  grids?: Record<string, TierRow[]>;
  previous?: TierPayload;
  previous_updated_at?: string;
  modes?: { id: string; label: string; tiers: TierRow[] }[];
};

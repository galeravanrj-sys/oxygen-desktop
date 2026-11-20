import "react-native-url-polyfill/auto";
import { createClient, processLock } from "@supabase/supabase-js";
import { sessionStorage } from "./storage";
const raw = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim()
  .replace(/\/(rest|storage|auth)\/v1\/?$/, "")
  .replace(/\/+$/, "");
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
export const backendConfigured = !!raw && !!key;
// No request uses these fallback values. They keep offline tools available before configuration.
export const supabase = createClient(
  raw || "https://unconfigured.supabase.co",
  key || "unconfigured-public-key",
  {
    auth: {
      storage: sessionStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      lock: processLock,
    },
  },
);
export const GALLERY_BUCKET = "oxygen-public-gallery";
export const GALLERY_TOPIC = "oxygen-gallery-public-v1";
export const PUBLIC_ORIGIN = "https://wxszznrkuozyptkekhjp.supabase.co";
export function requireBackend() {
  if (!backendConfigured)
    throw new Error(
      "Configure the existing Supabase public URL and publishable key in .env.local. Offline tools remain available.",
    );
}

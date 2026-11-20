import type { City, Offer, TierPayload } from "../types/models";
import { GIVEAWAY_FEED, TIER_ENDPOINT } from "../lib/gameNotificationLogic";
import naruto from "../../assets/tierlists/naruto-blazing.json";
import clover from "../../assets/tierlists/black-clover-m.json";
import grandcrossLR from "../../assets/tierlists/grandcross-lr.json";
export async function fetchJSON<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok)
      throw new Error(
        `Service unavailable (${response.status}). Try again later.`,
      );
    if (response.status === 201) return [] as T;
    return (await response.json()) as T;
  } catch (e) {
    if (controller.signal.aborted)
      throw new Error(
        "The request timed out. Check your connection and retry.",
      );
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
export async function getOffers() {
  const raw = await fetchJSON<unknown>(GIVEAWAY_FEED);
  if (!Array.isArray(raw))
    throw new Error("The giveaway service returned invalid data.");
  return raw.filter(
    (x): x is Offer =>
      !!x &&
      typeof x === "object" &&
      Number.isSafeInteger(x.id) &&
      typeof x.title === "string" &&
      typeof x.description === "string" &&
      typeof x.platforms === "string" &&
      x.type === "Game" &&
      x.status === "Active" &&
      typeof x.gamerpower_url === "string" &&
      /^https:\/\/www\.gamerpower\.com\//.test(x.gamerpower_url),
  );
}
export async function getTier(game: string): Promise<TierPayload> {
  if (game === "naruto-blazing") return naruto as unknown as TierPayload;
  if (game === "black-clover-m") return clover as unknown as TierPayload;
  if (game === "grandcross-lr") return grandcrossLR as unknown as TierPayload;
  const raw = await fetchJSON<TierPayload>(
    `${TIER_ENDPOINT}?game=${encodeURIComponent(game)}`,
  );
  if (
    raw.game !== game ||
    raw.status !== "available" ||
    !Array.isArray(raw.tiers)
  )
    throw new Error(
      "These rankings are not available yet. Refresh or open the source.",
    );
  return raw;
}
export async function searchCities(query: string) {
  const raw = await fetchJSON<{ results?: City[] }>(
    `https://geocoding-api.open-meteo.com/v1/search?${new URLSearchParams({ name: query.trim(), count: "8", language: "en", format: "json" })}`,
  );
  return (raw.results || []).filter(
    (c) =>
      typeof c.name === "string" &&
      Number.isFinite(c.latitude) &&
      Number.isFinite(c.longitude),
  );
}
export type Forecast = {
  timezone: string;
  current: {
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    weather_code: number;
    wind_speed_10m: number;
  };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: number[];
  };
};
export async function getForecast(city: City) {
  const raw = await fetchJSON<Forecast>(
    `https://api.open-meteo.com/v1/forecast?${new URLSearchParams({ latitude: String(city.latitude), longitude: String(city.longitude), current: "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m", daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max", timezone: "auto", forecast_days: "7" })}`,
  );
  if (!raw.current || !Array.isArray(raw.daily?.time))
    throw new Error("The weather service returned incomplete data.");
  return raw;
}
export function condition(code: number) {
  if (code === 0) return "Clear sky";
  if (code <= 3) return "Partly cloudy";
  if (code <= 48) return "Fog";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Rain showers";
  if (code <= 86) return "Snow showers";
  return "Thunderstorms";
}

import { useEffect, useRef, useState, type FormEvent } from "react";
import { CloudSun, RefreshCw, Search } from "lucide-react";
import "./PersonalApps.css";
type City = { id: number; name: string; latitude: number; longitude: number; country?: string; admin1?: string };
type Forecast = { timezone: string; current: { temperature_2m: number | null; apparent_temperature: number | null; relative_humidity_2m: number | null; weather_code: number | null; wind_speed_10m: number | null; time: string }; daily: { time: string[]; weather_code: (number | null)[]; temperature_2m_max: (number | null)[]; temperature_2m_min: (number | null)[]; precipitation_probability_max: (number | null)[] } };
const KEY = "oxygen-weather-city-v1";
function isCity(value: unknown): value is City { const c = value as City | null; return !!c && typeof c.name === "string" && typeof c.id === "number" && Number.isFinite(c.latitude) && Number.isFinite(c.longitude) && Math.abs(c.latitude) <= 90 && Math.abs(c.longitude) <= 180; }
function savedCity(): City | null { try { const city: unknown = JSON.parse(localStorage.getItem(KEY) || "null"); return isCity(city) ? city : null; } catch { return null; } }
function condition(code: number | null) { if (code === null) return "Conditions unavailable"; if (code === 0) return "Clear sky"; if (code <= 3) return "Partly cloudy"; if (code <= 48) return "Fog"; if (code <= 57) return "Drizzle"; if (code <= 67) return "Rain"; if (code <= 77) return "Snow"; if (code <= 82) return "Rain showers"; if (code <= 86) return "Snow showers"; return "Thunderstorms"; }
const number = (value: number | null, suffix = "") => typeof value === "number" && Number.isFinite(value) ? `${Math.round(value)}${suffix}` : "—";
export default function WeatherApp() {
  const [city, setCity] = useState<City | null>(savedCity); const [query, setQuery] = useState(""); const [results, setResults] = useState<City[]>([]); const [searching, setSearching] = useState(false); const [searchError, setSearchError] = useState(""); const [forecast, setForecast] = useState<Forecast | null>(null); const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [revision, setRevision] = useState(0); const searchRequest = useRef<AbortController | null>(null);
  useEffect(() => () => searchRequest.current?.abort(), []);
  useEffect(() => {
    if (!city) return;
    const controller = new AbortController(); const selected = city;
    async function load() {
      setLoading(true); setError(""); setForecast(null);
      try {
        const params = new URLSearchParams({ latitude: String(selected.latitude), longitude: String(selected.longitude), current: "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m", daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max", timezone: "auto", forecast_days: "7" });
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]) });
        if (!response.ok) throw new Error("Weather is unavailable. Please refresh or try another city.");
        const data = await response.json() as Forecast;
        if (!data.current || !Array.isArray(data.daily?.time) || !Array.isArray(data.daily.weather_code) || !Array.isArray(data.daily.temperature_2m_max) || !Array.isArray(data.daily.temperature_2m_min) || !Array.isArray(data.daily.precipitation_probability_max)) throw new Error("The weather service returned incomplete data.");
        if (!controller.signal.aborted) setForecast(data);
      } catch (reason) { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Could not load weather."); } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load(); return () => controller.abort();
  }, [city, revision]);
  async function search(event: FormEvent) {
    event.preventDefault(); if (query.trim().length < 2) return;
    searchRequest.current?.abort(); const controller = new AbortController(); searchRequest.current = controller;
    setSearching(true); setSearchError(""); setResults([]);
    try {
      const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${new URLSearchParams({ name: query.trim(), count: "8", language: "en", format: "json" })}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]) });
      if (!response.ok) throw new Error("City search is unavailable. Please try again.");
      const data = await response.json(); const cities = Array.isArray(data.results) ? data.results.filter(isCity) : [];
      if (!controller.signal.aborted) { setResults(cities); if (!cities.length) setSearchError("No cities found. Try a nearby city or a different spelling."); }
    } catch (reason) { if (!controller.signal.aborted) setSearchError(reason instanceof Error ? reason.message : "Could not search cities."); } finally { if (!controller.signal.aborted) setSearching(false); }
  }
  return <div className="pa-app pa-weather"><header><span className="pa-eyebrow"><CloudSun size={17}/> A LOOK OUTSIDE</span><h2>Your city, your forecast</h2><p>Current conditions and the next seven days.</p></header>
    <form className="pa-city-search" onSubmit={event => void search(event)}><label><Search size={17}/><input aria-label="Search city" placeholder="Search for a city…" value={query} minLength={2} maxLength={100} onChange={e => setQuery(e.target.value)} required/></label><button disabled={searching}>{searching ? "Searching…" : "Search"}</button></form>
    <p role="status">{searchError}</p><div className="pa-city-results">{results.map(result => <button type="button" key={result.id} onClick={() => { setCity(result); setResults([]); try { localStorage.setItem(KEY, JSON.stringify(result)); setSearchError(""); } catch { setSearchError("Weather will load, but this city could not be saved."); } }}>{result.name} · {[result.admin1, result.country].filter(Boolean).join(", ")}</button>)}</div>
    {!city && <div className="pa-empty">Search for a city above to see its weather.</div>}
    {city && <><div className="pa-city-heading"><h3>{city.name}{city.country ? `, ${city.country}` : ""}</h3><button type="button" aria-label="Refresh weather" disabled={loading} onClick={() => setRevision(n => n + 1)}><RefreshCw size={16}/></button></div><p role="status">{loading ? "Fetching forecast…" : error}</p></>}
    {forecast && <><section className="pa-weather-now"><CloudSun size={38}/><strong>{number(forecast.current.temperature_2m, "°C")}</strong><span>{condition(forecast.current.weather_code)}</span><p>Feels like {number(forecast.current.apparent_temperature, "°C")} · Humidity {number(forecast.current.relative_humidity_2m, "%")} · Wind {number(forecast.current.wind_speed_10m, " km/h")}</p><small>As of {forecast.current.time.replace("T", " ")} · {forecast.timezone}</small></section><div className="pa-forecast">{forecast.daily.time.map((day, i) => <article key={day}><strong>{new Date(day + "T12:00:00").toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}</strong><span>{condition(forecast.daily.weather_code[i] ?? null)}</span><b>{number(forecast.daily.temperature_2m_max[i], "°")} / {number(forecast.daily.temperature_2m_min[i], "°")}</b><small>Rain {number(forecast.daily.precipitation_probability_max[i], "%")}</small></article>)}</div></>}
    <footer>Weather and city search by <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a>. Forecast times use the selected city’s time zone.</footer>
  </div>;
}

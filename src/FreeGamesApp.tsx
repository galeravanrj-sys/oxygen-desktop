import { addGiveawayToPassport } from "./gamingPassportStore";
import { useGameLibrary } from "./useGameLibrary";
import { useEffect, useState } from "react";
import { ExternalLink, Gift, RefreshCw, Search } from "lucide-react";
import "./FreeGamesApp.css";

type Offer = { id: number; title: string; description: string; image: string; platforms: string; worth: string; end_date: string; gamerpower_url: string; status: string; type: string };
const FEED = "https://www.gamerpower.com/api/filter?platform=steam%2Bepic-games-store%2Bgog%2Bitchio&type=game&sort-by=date";
const STORES = [
  { id: "steam", name: "Steam", pattern: /Steam/i },
  { id: "epic", name: "Epic Games", pattern: /Epic Games Store/i },
  { id: "gog", name: "GOG", pattern: /GOG/i },
  { id: "itchio", name: "itch.io", pattern: /Itch\.io/i },
];
function matchingStores(platforms: string) { return STORES.filter(store => store.pattern.test(platforms)); }
function safeLink(value: string) {
  try { const url = new URL(value); return url.protocol === "https:" && url.hostname === "www.gamerpower.com" ? url.href : null; } catch { return null; }
}

export default function FreeGamesApp({ initialOfferId }: { initialOfferId?: number } = {}) {
  const passport = useGameLibrary();
  const [passportMessage, setPassportMessage] = useState("");
  const [focusedOffer, setFocusedOffer] = useState(initialOfferId ?? null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [store, setStore] = useState("all");
  const [search, setSearch] = useState("");
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updated, setUpdated] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true); setError("");
      try {
        const response = await fetch(FEED, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(25000)]) });
        if (!response.ok) throw new Error("The giveaway feed is unavailable. Please try again.");
        const data: unknown = response.status === 201 ? [] : await response.json();
        if (!Array.isArray(data)) throw new Error("The giveaway feed returned an unexpected response.");
        const valid = data.filter((item): item is Offer => item && typeof item.id === "number" && typeof item.title === "string" && typeof item.platforms === "string" && item.status === "Active" && item.type === "Game" && typeof item.description === "string" && typeof item.gamerpower_url === "string" && !!safeLink(item.gamerpower_url) && matchingStores(item.platforms).length > 0);
        if (!controller.signal.aborted) { setOffers(valid); setUpdated(new Date().toLocaleTimeString()); }
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Could not load giveaways.");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [revision]);
  const visible = offers.filter(offer => (focusedOffer === null || offer.id === focusedOffer) && (store === "all" || matchingStores(offer.platforms).some(platform => platform.id === store)) && offer.title.toLowerCase().includes(search.toLowerCase()));
  return <div className="free-games">
    <header className="fg-heading"><div><span className="fg-eyebrow"><Gift size={16}/> FREE TO CLAIM</span><h2>Your next game, on the house.</h2><p>Discover Steam, Epic Games, GOG, and itch.io giveaways. Claim before the offer ends.</p></div><button className="fg-refresh" type="button" disabled={loading} onClick={() => setRevision(value => value + 1)} aria-label="Refresh giveaways"><RefreshCw size={18}/></button></header>
    {focusedOffer !== null && <div className="fg-focused-offer"><span>Showing the giveaway from your notification</span><button type="button" onClick={() => setFocusedOffer(null)}>Show all offers</button></div>}
    <div className="fg-controls"><div className="fg-stores" aria-label="Filter by store">{[{ id: "all", name: "All stores" }, ...STORES].map(tab => <button type="button" key={tab.id} aria-pressed={store === tab.id} onClick={() => setStore(tab.id)}>{tab.name}</button>)}</div><label className="fg-search"><Search size={16}/><input aria-label="Search giveaways" placeholder="Find a game…" value={search} onChange={event => setSearch(event.target.value)}/></label></div>
    <div className="fg-status" role="status">{loading ? "Checking current giveaways…" : error ? error : `${visible.length} offers · Checked at ${updated}`}{error && offers.length > 0 && " Showing previously loaded offers; availability may have changed."}</div>
    {!loading && !error && visible.length === 0 && <div className="fg-empty"><Gift size={32}/><h3>No matching giveaways right now</h3><p>{focusedOffer !== null ? "This offer may have ended or is no longer listed. Choose Show all offers to browse current giveaways." : "Try another store or check back later."}</p></div>}
    {passportMessage && <p className="fg-status" role="status">{passportMessage}</p>}
    <div className="fg-grid">{visible.map(offer => <article className="fg-card" key={offer.id}>
      {typeof offer.image === "string" && offer.image.startsWith("https://") && <img src={offer.image} alt="" loading="lazy"/>}
      <div className="fg-card-body"><div className="fg-meta"><span>{matchingStores(offer.platforms).map(platform => platform.name).join(" · ")}</span><strong>FREE</strong></div><h3>{offer.title}</h3><p className="fg-description">{offer.description}</p><p className="fg-deadline">{offer.end_date && offer.end_date !== "N/A" ? `Listed end: ${offer.end_date} (source time)` : "End date not listed"}</p><a className="fg-claim" href={safeLink(offer.gamerpower_url)!} target="_blank" rel="noopener noreferrer">View giveaway <ExternalLink size={14}/></a><button type="button" className="passport-save" disabled={passport.some(game => game.title.toLowerCase() === offer.title.toLowerCase() && game.platform === (matchingStores(offer.platforms)[0]?.name ?? "Other"))} onClick={() => { try { addGiveawayToPassport(offer.title, matchingStores(offer.platforms)[0]?.name ?? "Other"); setPassportMessage("Saved to your Gaming Passport wishlist. Open the giveaway page to claim it separately."); } catch { setPassportMessage("Could not save this game. Browser storage may be full."); } }}>{passport.some(game => game.title.toLowerCase() === offer.title.toLowerCase() && game.platform === (matchingStores(offer.platforms)[0]?.name ?? "Other")) ? "Saved in Passport" : "Save to Passport"}</button></div>
    </article>)}</div>
    <footer>Giveaway data by <a href="https://www.gamerpower.com" target="_blank" rel="noopener noreferrer">GamerPower</a>. Check the linked offer for region, account, redemption requirements, and availability. Listed end times use the source’s time zone.</footer>
  </div>;
}

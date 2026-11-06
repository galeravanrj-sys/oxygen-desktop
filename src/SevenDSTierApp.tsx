import HideoutTierList from "./HideoutTierList";
import GrandCrossLR from "./GrandCrossLR";
import TierComparison from "./RankingChanges";
import type { RankingPayload } from "./tierComparison";
type GenshinCharacter = {
  name: string;
  image?: string;
};

type GenshinRow = {
  tier: string;
  roles: {
    mainDps: GenshinCharacter[];
    subDps: GenshinCharacter[];
    support: GenshinCharacter[];
  };
};

type GenshinData = {
  game: string;
  title: string;
  source: string;
  status: string;
  grids: Record<string, GenshinRow[]>;
  updated_at?: string;
  previous?: RankingPayload | null;
  previous_updated_at?: string | null;
  stale?: boolean;
};
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, ExternalLink, Globe2, RefreshCw, Search, Trophy, X } from "lucide-react";
import "./SevenDSTierApp.css";

type Game = { id: string; title: string; subtitle: string; url: string; color: string; initials: string; image: string };
const GAMES: Game[] = [
  { id: "naruto-blazing", title: "Naruto Blazing", subtitle: "PVE & Phantom Castle · Hideout Guides", url: "https://www.hideoutgacha.com/games/naruto-blazing/tier-list", color: "naruto", image: `${import.meta.env.BASE_URL}games-tierlist/naruto-blazing.jpg`, initials: "NB" },
  { id: "black-clover-m", title: "Black Clover M", subtitle: "PvP & PvE · Hideout Guides", url: "https://www.hideoutgacha.com/games/black-clover-m/tier-list", color: "blackclover", image: `${import.meta.env.BASE_URL}games-tierlist/black-clover-m.jpg`, initials: "BC" },
  { id: "zzz", title: "Zenless Zone Zero", subtitle: "Agent Tier List · Game8", url: "https://game8.co/games/Zenless-Zone-Zero/archives/435685", color: "zzz", image: `${import.meta.env.BASE_URL}games-tierlist/zzz.png`, initials: "ZZZ" },
  { id: "genshin", title: "Genshin Impact", subtitle: "Character Tier List · Game8", url: "https://game8.co/games/Genshin-Impact/archives/297465", color: "genshin", image: `${import.meta.env.BASE_URL}games-tierlist/genshin.webp`, initials: "GI" },
  { id: "origin", title: "The Seven Deadly Sins: Origin", subtitle: "Tier List · Game8", url: "https://game8.co/games/The-Seven-Deadly-Sins-Origin/archives/584624", color: "origin", image: `${import.meta.env.BASE_URL}games-tierlist/origin.webp`, initials: "7DS" },
  { id: "hsr", title: "Honkai: Star Rail", subtitle: "Character Tier List · Game8", url: "https://game8.co/games/Honkai-Star-Rail/archives/409604", color: "hsr", image: `${import.meta.env.BASE_URL}games-tierlist/hsr.webp`, initials: "HSR" },
  { id: "grandcross", title: "7DS Grand Cross", subtitle: "General Tier List · Grand Cross Wiki", url: "https://7dsgc.fandom.com/wiki/General_Tier_List", color: "grandcross", image: `${import.meta.env.BASE_URL}games-tierlist/grandcross.webp`, initials: "GC" },
];

type TierCharacter = {
  name: string;
  image?: string;
};

type TierGroup = {
  tier: string;
  characters: TierCharacter[];
};

type TierResponse = {
  previous?: RankingPayload | null;
  previous_updated_at?: string | null;
  game: string;
  title: string;
  source: string;
  status: string;
  tiers: TierGroup[];
  grids?: Record<string, TierGroup[]>;
  message?: string;
  updated_at?: string;
  stale?: boolean;
};

const TIER_API =
  "https://wxszznrkuozyptkekhjp.supabase.co/functions/v1/games-tierlist";
export default function SevenDSTierApp({ initialGame }: { initialGame?: string } = {}) {
  const initialSelection = GAMES.find(game => game.id === initialGame) ?? null;
  const [selected, setSelected] = useState<Game | null>(initialSelection);
  const [search, setSearch] = useState("");
  const [revision, setRevision] = useState(0);
  const [history, setHistory] = useState<Game[]>(initialSelection ? [initialSelection] : []);
  const [historyIndex, setHistoryIndex] = useState(initialSelection ? 0 : -1);

  const [tierData, setTierData] = useState<TierResponse | null>(null);
  const [genshinData, setGenshinData] = useState<GenshinData | null>(null);
  const [grandCrossTab, setGrandCrossTab] = useState("general");
  const [zzzTab, setZzzTab] = useState("overall");
  const [genshinTab, setGenshinTab] = useState("main");
  const [characterSearch, setCharacterSearch] = useState("");
  const [tierError, setTierError] = useState("");
  const [tierLoading, setTierLoading] = useState(false);

  const currentSource = selected?.id === "grandcross" && grandCrossTab === "lr" ? "https://7dsgc.fandom.com/wiki/LR_HERO" : selected?.url;
  const hideoutGame = selected?.id === "naruto-blazing" || selected?.id === "black-clover-m";
  useEffect(() => {
    if (!selected || selected.id === "naruto-blazing" || selected.id === "black-clover-m") {
      setTierLoading(false); setTierError("");
      setTierData(null);
    setGenshinData(null);
      return;
    }

    const controller = new AbortController();

    setTierLoading(true);
    setTierError("");
    setTierData(null);
    setGenshinData(null);

    fetch(`${TIER_API}?game=${encodeURIComponent(selected.id)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        return (await response.json()) as TierResponse;
      })
      .then((data) => {
        if (!controller.signal.aborted) {
          if (data.status !== "available" || !Array.isArray(data.tiers)) {
            throw new Error(data.message ?? "Rankings are not available yet.");
          }
          if (selected.id === "genshin") {
            setGenshinData(data as unknown as GenshinData);
            setTierData(null);
          } else {
            setTierData(data);
            setGenshinData(null);
          }
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setTierError(String(error));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setTierLoading(false);
      });

    return () => controller.abort();
  }, [selected, revision]);
  const open = (game: Game) => {
    setCharacterSearch(""); setZzzTab("overall"); setGrandCrossTab("general");
    setSelected(game);
    setHistory(prev => [...prev.slice(0, historyIndex + 1), game]);
    setHistoryIndex(i => i + 1);
    setRevision(v => v + 1);

  };
  const travel = (index: number) => {
    if (index < 0 || index >= history.length) return;
    setHistoryIndex(index);
    setSelected(history[index]);
    setRevision(v => v + 1);

  };
  const reload = () => { setRevision(v => v + 1); };
  const home = () => { setSelected(null); };
  return (
    <div className="gtl-app">
      <div className="gtl-tabs">
        <div className="gtl-tab"><Trophy size={16}/><span>{selected ? selected.title : "Games Tierlist"}</span></div>
        {selected && <button type="button" className="gtl-tab-close" title="All tier lists" onClick={home}><X size={15}/></button>}
      </div>
      <div className="gtl-toolbar">
        <button type="button" aria-label="Back" title="Back" disabled={historyIndex <= 0} onClick={() => travel(historyIndex - 1)}><ArrowLeft size={17}/></button>
        <button type="button" aria-label="Forward" title="Forward" disabled={historyIndex >= history.length - 1} onClick={() => travel(historyIndex + 1)}><ArrowRight size={17}/></button>
        <button type="button" aria-label="Refresh" title="Refresh" onClick={selected ? reload : home}><RefreshCw size={17}/></button>
        <button type="button" title="All tier lists" onClick={home}><Trophy size={17}/></button>
        <div className="gtl-address"><Globe2 size={15}/><span>{selected ? currentSource!.replace(/^https:\/\//, "") : "oxygen://games-tierlist"}</span></div>
        {selected && <button type="button" title="Open current live tier list in browser" aria-label="Open in browser" onClick={() => window.open(currentSource!, "_blank", "noopener,noreferrer")}><ExternalLink size={17}/></button>}
      </div>
      {!selected ? (
        <div className="gtl-home">
          <div className="gtl-hero"><div className="gtl-hero-icon"><Trophy size={26}/></div><h2>Games Tierlist</h2><p>Find the latest rankings from the original game guides.</p></div>
          <div className="gtl-search"><Search size={17}/><input aria-label="Search games" placeholder="Search games..." value={search} onChange={e => setSearch(e.target.value)}/></div>
          <div className="gtl-grid">
            {GAMES.filter(game => `${game.title} ${game.subtitle}`.toLowerCase().includes(search.toLowerCase())).map(game => (
              <button className="gtl-card" type="button" key={game.id} onClick={() => open(game)}>
                <span className={`gtl-art gtl-${game.color}`}><img src={game.image} alt={`${game.title} cover artwork`} loading="lazy" /></span>
                <span className="gtl-card-info"><strong>{game.title}</strong><small>{game.subtitle}</small><span className="gtl-view">View live tier list <ExternalLink size={12}/></span></span>
              </button>
            ))}
          </div>
        </div>
      ) : (
                <div className="gtl-viewer gtl-native-viewer">
          <div className="gtl-native-content">
            <h2>{selected.title}</h2>
            <p>Character Tier List · {hideoutGame ? "Hideout Guides" : selected.id === "grandcross" ? "Grand Cross Wiki" : "Game8"}</p>

            {(selected.id !== "grandcross" || grandCrossTab === "general") && (genshinData?.updated_at || tierData?.updated_at) && (
              <p className="gtl-genshin-source">
                Last updated: {new Date((genshinData?.updated_at ?? tierData?.updated_at)!).toLocaleString()}
                {(genshinData?.stale || tierData?.stale) && " — Showing the last successful rankings; the latest refresh failed."}
              </p>
            )}

            {selected.id === "grandcross" && <div className="gtl-genshin-tabs gtl-grandcross-tabs" role="group" aria-label="Grand Cross category">{[{id:"general",label:"General Tier List"},{id:"lr",label:"LR Heroes"}].map(tab=><button key={tab.id} aria-pressed={grandCrossTab===tab.id} className={grandCrossTab===tab.id?"active":""} onClick={()=>setGrandCrossTab(tab.id)}>{tab.label}</button>)}</div>}
            {selected.id === "grandcross" && grandCrossTab === "lr" && <GrandCrossLR revision={revision}/>}
            {hideoutGame && <HideoutTierList key={selected.id} game={selected.id} revision={revision}/>}
            {!hideoutGame && (selected.id !== "grandcross" || grandCrossTab === "general") && <>
            {(tierData || genshinData) && <TierComparison current={(tierData || genshinData) as unknown as RankingPayload} previous={(tierData || genshinData)?.previous} previousAt={(tierData || genshinData)?.previous_updated_at} />}
            {tierLoading && (
              <div className="gtl-native-status">Loading rankings...</div>
            )}

            {tierError && (
              <div className="gtl-native-status">
                Could not load rankings: {tierError}
              </div>
            )}

            {!tierLoading && !tierError && selected.id === "genshin" && genshinData && (
              <div className="gtl-genshin-panel">
                <div className="gtl-genshin-tabs">
                  {[
                    { id: "main", label: "Main Tier List" },
                    { id: "c0", label: "C0 Tier List" },
                    { id: "c6", label: "C6 Tier List" }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      className={genshinTab === tab.id ? "active" : ""}
                      onClick={() => setGenshinTab(tab.id)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <input
                  className="gtl-character-search"
                  placeholder="Search characters..."
                  value={characterSearch}
                  onChange={event => setCharacterSearch(event.target.value)}
                />

                <div className="gtl-genshin-table">
                  <div className="gtl-genshin-header">
                    <span>Tier</span>
                    <span>Main DPS</span>
                    <span>Sub-DPS</span>
                    <span>Support</span>
                  </div>

                  {genshinData.grids[genshinTab]?.map(row => (
                      <div className="gtl-genshin-row" key={row.tier}>
                        <div className={`gtl-genshin-rank rank-${row.tier.replace("+","plus")}`}>
                          {row.tier}
                        </div>

                        {(["mainDps","subDps","support"] as const).map(role => (
                          <div className="gtl-genshin-characters" key={role}>
                            {row.roles[role]
                              .filter(character =>
                                character.name.toLowerCase().includes(characterSearch.toLowerCase())
                              )
                              .map((character,index) => (
                                <div className="gtl-genshin-character" key={`${character.name}-${index}`}>
                                  {character.image && (
                                    <img
                                      src={character.image}
                                      alt={character.name}
                                      loading="lazy"
                                    />
                                  )}
                                  <span>{character.name}</span>
                                </div>
                              ))}
                          </div>
                        ))}
                      </div>
                    ))}
                </div>

                <p className="gtl-genshin-source">
                  Rankings: Game8. Automatically updated daily.
                </p>
              </div>
            )}
            {!tierLoading && !tierError && selected.id !== "genshin" && tierData?.status !== "available" && (
              <div className="gtl-native-status">
                <h3>Rankings unavailable</h3>
                <p>{tierData?.message ?? "No ranking data is available."}</p>
              </div>
            )}

            {!tierLoading && !tierError && selected.id !== "genshin" && tierData?.status === "available" && (
              <div className={`gtl-native-tiers ${selected.id === "zzz" ? "gtl-zzz-tiers" : ""}`}>
                {selected.id === "zzz" && <div className="gtl-zzz-controls"><div className="gtl-genshin-tabs" role="group" aria-label="Zenless ranking category">{[{id:"overall",label:"Overall"},{id:"dps",label:"DPS"},{id:"stun",label:"Stun"},{id:"support",label:"Support"}].map(tab => <button key={tab.id} type="button" className={zzzTab === tab.id ? "active" : ""} aria-pressed={zzzTab === tab.id} onClick={() => setZzzTab(tab.id)}>{tab.label}</button>)}</div><label className="gtl-zzz-search"><Search size={15}/><input aria-label="Search Zenless agents" placeholder="Search agents…" value={characterSearch} onChange={event => setCharacterSearch(event.target.value)}/></label><p className="gtl-genshin-source">Game8’s original ranks: T0, T1+, T1, T2, T3, T4. Lower tiers may be absent in individual role lists.</p></div>}
                {(selected.id === "zzz" ? tierData.grids?.[zzzTab] ?? tierData.tiers : tierData.tiers).map(group => ({ ...group, characters: selected.id === "zzz" ? group.characters.filter(character => character.name.toLowerCase().includes(characterSearch.trim().toLowerCase())) : group.characters })).filter(group => group.characters.length > 0).map((group) => (
                  <div className="gtl-tier-row" key={group.tier}>
                    <div className="gtl-tier-label">{group.tier}</div>
                    <div className="gtl-tier-characters">
                      {group.characters.map((character, index) => (
                        <div className="gtl-character" key={`${character.name}-${index}`}>
                          {character.image && (
                            <img src={character.image} alt={character.name} />
                          )}
                          <span>{character.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {selected.id === "zzz" && <p className="gtl-genshin-source">{(tierData.grids?.[zzzTab] ?? tierData.tiers).some(group => group.characters.some(character => character.name.toLowerCase().includes(characterSearch.trim().toLowerCase()))) ? "Rankings from Game8 · Refreshed by the daily cache." : "No agents match your search."} <a href={selected.url} target="_blank" rel="noopener noreferrer">View original guide</a></p>}
              </div>
            )}
            </>}
          </div>
        </div>
      )}
    </div>
  );
}

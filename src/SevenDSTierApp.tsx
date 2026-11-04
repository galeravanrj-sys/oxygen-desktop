import { useState } from "react";
import { ArrowLeft, ArrowRight, ExternalLink, Globe2, RefreshCw, Search, Trophy, X } from "lucide-react";
import "./SevenDSTierApp.css";

type Game = { id: string; title: string; subtitle: string; url: string; color: string; initials: string };
const GAMES: Game[] = [
  { id: "genshin", title: "Genshin Impact", subtitle: "Character Tier List • Game8", url: "https://game8.co/games/Genshin-Impact/archives/297465", color: "genshin", initials: "GI" },
  { id: "origin", title: "The Seven Deadly Sins: Origin", subtitle: "Tier List • Game8", url: "https://game8.co/games/The-Seven-Deadly-Sins-Origin/archives/584624", color: "origin", initials: "7DS" },
  { id: "hsr", title: "Honkai: Star Rail", subtitle: "Character Tier List • Game8", url: "https://game8.co/games/Honkai-Star-Rail/archives/409604", color: "hsr", initials: "HSR" },
  { id: "grandcross", title: "7DS Grand Cross", subtitle: "General Tier List • Fandom", url: "https://7dsgc.fandom.com/wiki/General_Tier_List", color: "grandcross", initials: "GC" },
];

export default function SevenDSTierApp() {
  const [selected, setSelected] = useState<Game | null>(null);
  const [search, setSearch] = useState("");
  const [revision, setRevision] = useState(0);
  const [history, setHistory] = useState<Game[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const open = (game: Game) => {
    setSelected(game);
    setHistory(prev => [...prev.slice(0, historyIndex + 1), game]);
    setHistoryIndex(i => i + 1);
    setRevision(v => v + 1);
    setLoading(true);
  };
  const travel = (index: number) => {
    if (index < 0 || index >= history.length) return;
    setHistoryIndex(index);
    setSelected(history[index]);
    setRevision(v => v + 1);
    setLoading(true);
  };
  const reload = () => { setLoading(true); setRevision(v => v + 1); };
  const home = () => { setSelected(null); setLoading(false); };
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
        <div className="gtl-address"><Globe2 size={15}/><span>{selected ? selected.url.replace(/^https:\/\//, "") : "oxygen://games-tierlist"}</span></div>
        {selected && <button type="button" title="Open current live tier list in browser" aria-label="Open in browser" onClick={() => window.open(selected.url, "_blank", "noopener,noreferrer")}><ExternalLink size={17}/></button>}
      </div>
      {!selected ? (
        <div className="gtl-home">
          <div className="gtl-hero"><div className="gtl-hero-icon"><Trophy size={26}/></div><h2>Games Tierlist</h2><p>Find the latest rankings from the original game guides.</p></div>
          <div className="gtl-search"><Search size={17}/><input aria-label="Search games" placeholder="Search games..." value={search} onChange={e => setSearch(e.target.value)}/></div>
          <div className="gtl-grid">
            {GAMES.filter(game => `${game.title} ${game.subtitle}`.toLowerCase().includes(search.toLowerCase())).map(game => (
              <button className="gtl-card" type="button" key={game.id} onClick={() => open(game)}>
                <span className={`gtl-art gtl-${game.color}`}><span>{game.initials}</span></span>
                <span className="gtl-card-info"><strong>{game.title}</strong><small>{game.subtitle}</small><span className="gtl-view">View live tier list <ExternalLink size={12}/></span></span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="gtl-viewer">
          {loading && <div className="gtl-loading">Loading {selected.title}…</div>}
          <iframe key={`${selected.id}-${revision}`} title={`${selected.title} live tier list`} src={selected.url} onLoad={() => setLoading(false)} referrerPolicy="strict-origin-when-cross-origin"/>
          <div className="gtl-fallback">If this website prevents embedded viewing, <button type="button" onClick={() => window.open(selected.url, "_blank", "noopener,noreferrer")}>open the live tier list in your browser <ExternalLink size={13}/></button>.</div>
        </div>
      )}
    </div>
  );
}

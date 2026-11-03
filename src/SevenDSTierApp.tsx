import { useMemo, useState } from "react";
import { Search, Plus, ExternalLink, RotateCcw, Download, Trash2, Crown, GripVertical } from "lucide-react";
import "./SevenDSTierApp.css";

type Tier = "SSS" | "SS" | "S" | "A" | "B" | "C" | "D" | "Unranked";
type Hero = { id: string; name: string; tier: Tier };
const KEY = "oxygen-7ds-tier-v1";
const TIERS: Tier[] = ["SSS", "SS", "S", "A", "B", "C", "D", "Unranked"];
const DESCRIPTIONS: Record<Tier, string> = {
  SSS: "Best heroes in the game", SS: "Top-tier heroes", S: "High value; worth building",
  A: "Excellent in at least one mode", B: "Niche or support roles",
  C: "Limited usefulness", D: "Very limited usefulness", Unranked: "Place characters using the Fandom reference",
};
// This is an unranked starter roster, NOT a transcription of Fandom's image-based rankings.
const STARTERS = ["Meliodas", "Elizabeth", "Escanor", "Ban", "King", "Diane", "Gowther", "Merlin", "Zeldris", "Estarossa", "Ludociel", "Sariel", "Tarmiel", "Arthur", "Derieri", "Freyr", "Brunhild", "Chandler", "Cusack", "Elaine", "Hendrickson", "Jericho", "Gilthunder", "Valenti", "Roxy", "Shin", "Nanashi", "Megellda", "Gloxinia", "Drole"];
const initial = (): Hero[] => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((x): x is Hero => Boolean(x && typeof x.id === "string" && typeof x.name === "string" && TIERS.includes(x.tier)));
    }
  } catch { /* use starter roster */ }
  return STARTERS.map((name, index) => ({ id: `starter-${index}`, name, tier: "Unranked" }));
};

export default function SevenDSTierApp() {
  const [heroes, setHeroes] = useState<Hero[]>(initial);
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [active, setActive] = useState<Tier | "All">("All");
  const [dragged, setDragged] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const update = (next: Hero[]) => { setHeroes(next); try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { setNotice("Browser storage is full or unavailable."); } };
  const move = (id: string, tier: Tier) => update(heroes.map(h => h.id === id ? { ...h, tier } : h));
  const add = () => {
    const name = newName.trim();
    if (!name) return;
    if (heroes.some(h => h.name.toLowerCase() === name.toLowerCase())) { setNotice("That character is already in the list."); return; }
    update([...heroes, { id: crypto.randomUUID(), name, tier: "Unranked" }]);
    setNewName(""); setNotice("");
  };
  const reset = () => {
    if (!window.confirm("Reset all character placements and restore the starter roster?")) return;
    update(STARTERS.map((name, index) => ({ id: `starter-${index}`, name, tier: "Unranked" })));
    setNotice("Tier list reset.");
  };
  const exportList = () => {
    const blob = new Blob([JSON.stringify({ source: "https://7dsgc.fandom.com/wiki/General_Tier_List", characters: heroes }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "oxygen-7ds-tier-list.json"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const filtered = useMemo(() => heroes.filter(h => h.name.toLowerCase().includes(search.trim().toLowerCase())), [heroes, search]);
  return (
    <div className="seven-tier-app">
      <header className="seven-hero-header">
        <div className="seven-kicker"><Crown size={15}/> OXYGEN GAMES / GRAND CROSS</div>
        <h1>SEVEN DEADLY SINS <span>TIER LIST</span></h1>
        <p>Build your rankings with the community's General Tier List as a reference.</p>
        <div className="seven-actions">
          <a href="https://7dsgc.fandom.com/wiki/General_Tier_List" target="_blank" rel="noopener noreferrer"><ExternalLink size={15}/> Fandom reference</a>
          <button onClick={exportList}><Download size={15}/> Export</button>
          <button onClick={reset}><RotateCcw size={15}/> Reset</button>
        </div>
      </header>
      <div className="seven-toolbar">
        <label className="seven-search"><Search size={18}/><input aria-label="Search characters" placeholder="Search characters..." value={search} onChange={e => setSearch(e.target.value)}/></label>
        <form onSubmit={e => { e.preventDefault(); add(); }} className="seven-add">
          <input aria-label="New character name" placeholder="Add character name" value={newName} maxLength={70} onChange={e => setNewName(e.target.value)}/>
          <button type="submit"><Plus size={16}/> Add</button>
        </form>
      </div>
      <div className="seven-filters" aria-label="Filter tiers">
        {(["All", ...TIERS] as const).map(t => <button key={t} className={active === t ? "selected" : ""} onClick={() => setActive(t)}>{t} <small>{t === "All" ? heroes.length : heroes.filter(h => h.tier === t).length}</small></button>)}
      </div>
      <p className="seven-hint">Drag a character to another tier, or use its dropdown. Starter characters are intentionally unranked: the Fandom page's placements could not be verified from its image-only table. Characters with different versions can be added separately.</p>
      {notice && <p className="seven-notice" role="status">{notice}</p>}
      <div className="seven-board">
        {TIERS.filter(t => active === "All" || t === active).map(tier => {
          const list = filtered.filter(h => h.tier === tier);
          return <section key={tier} className={`seven-tier-row tier-${tier.toLowerCase()}`}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); if (dragged) move(dragged, tier); setDragged(null); }}>
            <div className="seven-tier-label"><strong>{tier === "Unranked" ? "?" : tier}</strong><span>{DESCRIPTIONS[tier]}</span></div>
            <div className="seven-tier-characters">
              {list.length === 0 ? <span className="seven-empty">{search ? "No matching characters" : "Drop characters here"}</span> : list.map(hero => <div key={hero.id} className="seven-character" draggable onDragStart={e => { setDragged(hero.id); e.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => setDragged(null)}>
                <GripVertical size={14} className="seven-grip"/>
                <span title={hero.name}>{hero.name}</span>
                <select aria-label={`Rank ${hero.name}`} value={hero.tier} onChange={e => move(hero.id, e.target.value as Tier)}>{TIERS.map(t => <option key={t} value={t}>{t}</option>)}</select>
                <button className="seven-remove" title={`Remove ${hero.name}`} aria-label={`Remove ${hero.name}`} onClick={() => update(heroes.filter(h => h.id !== hero.id))}><Trash2 size={13}/></button>
              </div>)}
            </div>
          </section>;
        })}
      </div>
      <footer className="seven-footer">Fan-made tier editor • Saved locally in this browser • Reference: 7DS Grand Cross Wiki</footer>
    </div>
  );
}
